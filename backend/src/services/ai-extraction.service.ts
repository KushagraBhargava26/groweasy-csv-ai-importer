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
// The old SDK predates Gemini 3.x and silently ignored thinkingConfig.
const ai = new GoogleGenAI({ apiKey });

// Describes the exact shape we want Gemini to return, field by field.
// Every field carries a `description` telling the model to return ONLY
// the extracted value — no reasoning, no explanation. This was added
// after a real bug: with a very low thinking budget, the model started
// "thinking out loud" INSIDE field values (e.g. state: "Wait, the
// instructions say...") instead of in its private reasoning channel.
// The explicit per-field instruction closes that gap.
const VALUE_ONLY = "The extracted value only. No explanation or reasoning text.";

function buildCrmRecordSchema(rowCount: number) {
  return {
    type: Type.ARRAY,
    maxItems: rowCount,
    items: {
      type: Type.OBJECT,
      properties: {
        _row_id: { type: Type.STRING, description: "Copy the input row's _row_id exactly, unchanged." },
        created_at: { type: Type.STRING, description: VALUE_ONLY },
        name: { type: Type.STRING, description: VALUE_ONLY },
        email: { type: Type.STRING, description: VALUE_ONLY },
        country_code: { type: Type.STRING, description: VALUE_ONLY },
        mobile_without_country_code: { type: Type.STRING, description: VALUE_ONLY },
        company: { type: Type.STRING, description: VALUE_ONLY },
        city: { type: Type.STRING, description: VALUE_ONLY },
        state: { type: Type.STRING, description: VALUE_ONLY },
        country: { type: Type.STRING, description: VALUE_ONLY },
        lead_owner: { type: Type.STRING, description: VALUE_ONLY },
        crm_status: { type: Type.STRING, description: VALUE_ONLY },
        crm_note: { type: Type.STRING, description: VALUE_ONLY },
        data_source: { type: Type.STRING, description: VALUE_ONLY },
        possession_time: { type: Type.STRING, description: VALUE_ONLY },
        description: { type: Type.STRING, description: VALUE_ONLY },
      },
      required: [
        "_row_id",
        "created_at",
        "name",
        "email",
        "country_code",
        "mobile_without_country_code",
        "company",
        "city",
        "state",
        "country",
        "lead_owner",
        "crm_status",
        "crm_note",
        "data_source",
        "possession_time",
        "description",
      ],
    },
  };
}
// crm_status/data_source are plain STRING here, not a Gemini schema
// enum, on purpose: a strict schema enum can cause the whole batch to
// fail if the model can't confidently pick one. Treating them as free
// strings (constrained by the PROMPT instead) lets the model leave a
// field blank when unsure, and validation.service.ts is what actually
// guarantees only the allowed values reach the frontend.

const MODEL_NAME = "gemini-3.1-flash-lite";
const systemInstruction = buildCrmExtractionPrompt();

export type AiExtractionErrorKind = "QUOTA_EXCEEDED" | "MALFORMED_RESPONSE" | "API_ERROR";

export class AiExtractionError extends Error {
  constructor(
    message: string,
    public readonly batchIndex: number,
    public readonly kind: AiExtractionErrorKind = "API_ERROR",
  ) {
    super(message);
    this.name = "AiExtractionError";
  }
}

/**
 * Sends one batch of raw rows to Gemini and returns the extracted CRM records.
 * Does NOT enforce enum values or the skip rule as a safety net — that's
 * validation.service.ts's job. This function's only responsibility is
 * "call the model, get parsed JSON back."
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
        responseSchema: buildCrmRecordSchema(batch.rows.length),
        thinkingConfig: {
          // LOW is sufficient now that responseSchema enforces all 16
          // fields as `required` and caps the array with `maxItems`,
          // which together stopped the model from truncating output or
          // looping on repeated rows regardless of thinking budget size.
          thinkingLevel: ThinkingLevel.LOW,
        },
        maxOutputTokens: 8192,
        // temperature intentionally left UNSET — Gemini 3.x docs recommend
        // not overriding temperature/top_p/top_k, since its reasoning
        // behavior is tuned around the defaults.
      },
    });

    const responseText = result.text ?? "";

    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      logger.error("Gemini returned non-JSON output despite responseSchema", {
        batchIndex: batch.batchIndex,
        rawResponse: responseText.slice(0, 500),
      });
      throw new AiExtractionError(`Batch ${batch.batchIndex}: model response was not valid JSON`, batch.batchIndex, "MALFORMED_RESPONSE");
    }

    if (!Array.isArray(parsed)) {
      throw new AiExtractionError(
        `Batch ${batch.batchIndex}: expected a JSON array, got ${typeof parsed}`,
        batch.batchIndex,
        "MALFORMED_RESPONSE",
      );
    }

    logger.info("Batch extracted successfully", {
      batchIndex: batch.batchIndex,
      inputRows: batch.rows.length,
      outputRecords: parsed.length,
    });

    return parsed;
  } catch (err) {
    if (err instanceof AiExtractionError) throw err;

    const errMessage = err instanceof Error ? err.message : String(err);
    const isQuotaError = errMessage.includes("RESOURCE_EXHAUSTED") || errMessage.includes("429");

    // Log the FULL error object, not just .message — Google's error messages
    // are often a generic outer wrapper ("Request contains an invalid
    // argument") with the actual specific cause nested deeper (a details
    // array, a field path, etc.) that .message alone doesn't surface.
    logger.error("Gemini API call failed", {
      batchIndex: batch.batchIndex,
      error: errMessage,
      isQuotaError,
      fullError: JSON.stringify(err, Object.getOwnPropertyNames(err instanceof Error ? err : {})),
      batchRowCount: batch.rows.length,
    });
    throw new AiExtractionError(
      `Batch ${batch.batchIndex}: Gemini API call failed — ${errMessage}`,
      batch.batchIndex,
      isQuotaError ? "QUOTA_EXCEEDED" : "API_ERROR",
    );
  }
}
