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
  model: "gemini-2.0-flash",
  systemInstruction: buildCrmExtractionPrompt(),
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: crmRecordSchema,
    temperature: 0.1, // mapping task, not creative — we want consistent output, not variation between runs
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
