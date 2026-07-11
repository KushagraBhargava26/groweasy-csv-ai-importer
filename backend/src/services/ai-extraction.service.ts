import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Batch } from "./batching.service";
import { buildCrmExtractionPrompt } from "../prompts/crm-extraction.prompt";
import { logger } from "../utils/logger";

// Fails fast and loudly at startup if the key is missing, rather than
// failing confusingly deep inside the first API call.
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set in the environment (.env)");
}

const genAI = new GoogleGenerativeAI(apiKey);

// Describes the exact shape we want Gemini to return, field by field.
// This is what makes the output reliable: Gemini's structured-output mode
// constrains generation to match this schema, so we get a clean JSON array
// back instead of prose we'd have to regex/parse out of markdown fences.
const crmRecordSchema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      _row_id: { type: SchemaType.STRING },
      created_at: { type: SchemaType.STRING },
      name: { type: SchemaType.STRING },
      email: { type: SchemaType.STRING },
      country_code: { type: SchemaType.STRING },
      mobile_without_country_code: { type: SchemaType.STRING },
      company: { type: SchemaType.STRING },
      city: { type: SchemaType.STRING },
      state: { type: SchemaType.STRING },
      country: { type: SchemaType.STRING },
      lead_owner: { type: SchemaType.STRING },
      crm_status: { type: SchemaType.STRING },
      crm_note: { type: SchemaType.STRING },
      data_source: { type: SchemaType.STRING },
      possession_time: { type: SchemaType.STRING },
      description: { type: SchemaType.STRING },
    },
    required: ["_row_id"],
  },
};
// crm_status/data_source are plain STRING here, not a Gemini schema
// enum, on purpose: a strict schema enum can cause the whole batch to
// fail if the model can't confidently pick one. Treating them as free
// strings (constrained by the PROMPT instead) lets the model leave a
// field blank when unsure, and validation.service.ts (next file) is
// what actually guarantees only the allowed values reach the frontend.

const model = genAI.getGenerativeModel({
  model: "gemini-3.1-flash-lite",
  systemInstruction: buildCrmExtractionPrompt(),
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: crmRecordSchema,
    thinkingConfig: {
      // This is straightforward per-row field mapping, not complex multi-step
      // reasoning — "low" is Google's documented sweet spot for high-volume,
      // moderate-complexity extraction pipelines like this one. Leaving
      // thinkingConfig unset lets Gemini 3.x default to a much higher thinking
      // level, which is what caused the earlier bug: the model "reasoned" about
      // the whole 5-row batch as a single unit and collapsed its answer into one
      // record, repeated 5 times, instead of mapping each row independently.
      thinkingLevel: "low",
    },
    // temperature intentionally left UNSET here. We previously pinned this to
    // 0.1 assuming "mapping task, not creative, so force low variance" — that
    // was the right instinct for older (2.x) models, but Gemini 3.x's own docs
    // explicitly recommend NOT overriding temperature/top_p/top_k, since its
    // reasoning behavior is tuned around the default values. Overriding it
    // fights against how the model's internal reasoning was calibrated.
  },
});

export class AiExtractionError extends Error {
  constructor(
    message: string,
    public readonly batchIndex: number,
  ) {
    super(message);
    this.name = "AiExtractionError";
  }
}

/**
 * Sends one batch of raw rows to Gemini and returns the extracted CRM records.
 * Does NOT enforce enum values or the skip rule as a safety net — that's
 * validation.service.ts's job, next. This function's only responsibility
 * is "call the model, get parsed JSON back."
 */
export async function extractBatch(batch: Batch): Promise<unknown[]> {
  const inputPayload = JSON.stringify(batch.rows);

  try {
    const result = await model.generateContent(inputPayload);
    const responseText = result.response.text();

    // TEMP DEBUG — remove once the thinkingLevel fix is confirmed working.
    console.log("RAW AI RESPONSE:", responseText);

    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      logger.error("Gemini returned non-JSON output despite responseSchema", {
        batchIndex: batch.batchIndex,
        rawResponse: responseText.slice(0, 500),
      });
      throw new AiExtractionError(`Batch ${batch.batchIndex}: model response was not valid JSON`, batch.batchIndex);
    }

    if (!Array.isArray(parsed)) {
      throw new AiExtractionError(`Batch ${batch.batchIndex}: expected a JSON array, got ${typeof parsed}`, batch.batchIndex);
    }

    logger.info("Batch extracted successfully", {
      batchIndex: batch.batchIndex,
      inputRows: batch.rows.length,
      outputRecords: parsed.length,
    });

    return parsed;
  } catch (err) {
    if (err instanceof AiExtractionError) throw err;

    logger.error("Gemini API call failed", {
      batchIndex: batch.batchIndex,
      error: err instanceof Error ? err.message : String(err),
    });
    throw new AiExtractionError(
      `Batch ${batch.batchIndex}: Gemini API call failed — ${err instanceof Error ? err.message : String(err)}`,
      batch.batchIndex,
    );
  }
}