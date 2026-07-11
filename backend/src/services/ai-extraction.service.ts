import { Batch } from "./batching.service";
import { buildCrmExtractionPrompt } from "../prompts/crm-extraction.prompt";
import { logger } from "../utils/logger";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

// Fails fast and loudly at startup if the key is missing, rather than
// failing confusingly deep inside the first API call.
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set in the environment (.env)");
}

// NOTE: migrated from `@google/generative-ai` (now archived/deprecated by
// Google as of Nov 30 2025) to `@google/genai`, the current unified SDK.
// The old SDK predates Gemini 3.x and silently ignores config fields it
// doesn't recognize — including thinkingConfig, which is why setting
// thinkingLevel had no real effect and the model kept reasoning at an
// unbounded default, leaking its internal thoughts into schema fields.
const ai = new GoogleGenAI({ apiKey });

// Describes the exact shape we want Gemini to return, field by field.
// This is what makes the output reliable: Gemini's structured-output mode
// constrains generation to match this schema, so we get a clean JSON array
// back instead of prose we'd have to regex/parse out of markdown fences.
// Note: the new SDK uses `Type` instead of the old `SchemaType` — same
// concept, different import.
const crmRecordSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      _row_id: { type: Type.STRING },
      created_at: { type: Type.STRING },
      name: { type: Type.STRING },
      email: { type: Type.STRING },
      country_code: { type: Type.STRING },
      mobile_without_country_code: { type: Type.STRING },
      company: { type: Type.STRING },
      city: { type: Type.STRING },
      state: { type: Type.STRING },
      country: { type: Type.STRING },
      lead_owner: { type: Type.STRING },
      crm_status: { type: Type.STRING },
      crm_note: { type: Type.STRING },
      data_source: { type: Type.STRING },
      possession_time: { type: Type.STRING },
      description: { type: Type.STRING },
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

const MODEL_NAME = "gemini-3.1-flash-lite";
const systemInstruction = buildCrmExtractionPrompt();

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
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: inputPayload,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: crmRecordSchema,
        thinkingConfig: {
          // Straightforward per-row field mapping, not complex multi-step
          // reasoning — LOW is the documented sweet spot for high-volume,
          // moderate-complexity extraction. This now actually takes effect,
          // unlike under the old SDK.
          thinkingLevel: ThinkingLevel.LOW,
        },
        // temperature intentionally left UNSET — Gemini 3.x docs recommend
        // not overriding temperature/top_p/top_k, since its reasoning
        // behavior is tuned around the defaults.
      },
    });

    const responseText = result.text ?? "";

    // TEMP DEBUG — remove once this migration is confirmed working.
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
