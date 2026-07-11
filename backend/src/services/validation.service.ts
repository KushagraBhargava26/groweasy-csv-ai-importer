import { z } from "zod";
import {
  CrmRecord,
  RawCsvRow,
  SkippedRow,
  CRM_STATUS_VALUES,
  DATA_SOURCE_VALUES,
} from "../types/crm-record";
import { logger } from "../utils/logger";

// Built directly from the same const arrays used in the type definitions
// and the AI prompt — one source of truth, three consumers. If these lists
// ever need a new status/source, updating crm-record.ts updates all three
// automatically.
const crmStatusEnum = z.enum(CRM_STATUS_VALUES);
const dataSourceEnum = z.enum(DATA_SOURCE_VALUES);

// The schema Gemini's raw output gets checked against. Every field is
// optional/nullable-ish because the AI is instructed to leave unknown
// fields as empty strings, not omit them — but we defend against both
// cases (missing key vs empty string) since we don't fully control the
// model's exact output shape.
const crmRecordInputSchema = z.object({
  created_at: z.string().optional().default(""),
  name: z.string().optional().default(""),
  email: z.string().optional().default(""),
  country_code: z.string().optional().default(""),
  mobile_without_country_code: z.string().optional().default(""),
  company: z.string().optional().default(""),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  country: z.string().optional().default(""),
  lead_owner: z.string().optional().default(""),
  crm_status: z.string().optional().default(""),
  crm_note: z.string().optional().default(""),
  data_source: z.string().optional().default(""),
  possession_time: z.string().optional().default(""),
  description: z.string().optional().default(""),
});

export interface ValidationOutcome {
  kept: CrmRecord[];
  skipped: SkippedRow[];
}

/**
 * Checks a value against the created_at date rule from the spec:
 * "must be convertible using new Date(created_at)".
 * An empty string is allowed (means "unknown date"), but a non-empty
 * string that produces an Invalid Date is corrected to empty rather
 * than passed through broken.
 */
function normalizeCreatedAt(value: string): string {
  if (!value || value.trim() === "") return "";
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) {
    logger.warn("Invalid created_at value from AI, clearing it", { value });
    return "";
  }
  return value;
}

/**
 * Re-checks crm_status against the whitelist. The AI is instructed to only
 * use these 4 values, but we never assume compliance — if it returns
 * anything else (a typo, a synonym, a hallucinated status), we blank it
 * rather than let an invalid value reach the frontend/CRM.
 */
function normalizeCrmStatus(value: string): CrmRecord["crm_status"] {
  if (!value) return undefined;
  const result = crmStatusEnum.safeParse(value);
  if (!result.success) {
    logger.warn("AI returned an out-of-whitelist crm_status, clearing it", { value });
    return undefined;
  }
  return result.data;
}

function normalizeDataSource(value: string): CrmRecord["data_source"] {
  if (!value) return undefined;
  const result = dataSourceEnum.safeParse(value);
  if (!result.success) {
    logger.warn("AI returned an out-of-whitelist data_source, clearing it", { value });
    return undefined;
  }
  return result.data;
}

/**
 * The hard skip rule from the spec: a record with neither email nor
 * mobile number must not be imported. The AI is instructed to already
 * apply this rule itself — but we enforce it again here as a backend
 * guarantee, since this rule has zero tolerance for exceptions.
 */
function hasContactInfo(record: { email: string; mobile_without_country_code: string }): boolean {
  return record.email.trim().length > 0 || record.mobile_without_country_code.trim().length > 0;
}

/**
 * Validates and normalizes a batch of raw AI output against the CRM schema.
 * Takes the ORIGINAL rows too, purely so a skipped record can carry back
 * enough context (in `originalRow`) for the frontend to show the user
 * why something didn't import.
 */
export function validateAiOutput(
  aiRecords: unknown[],
  originalRows: RawCsvRow[]
): ValidationOutcome {
  const kept: CrmRecord[] = [];
  const skipped: SkippedRow[] = [];

  aiRecords.forEach((raw, index) => {
    const parsed = crmRecordInputSchema.safeParse(raw);

    if (!parsed.success) {
      logger.warn("AI record failed schema validation, skipping", {
        index,
        issues: parsed.error.issues,
      });
      skipped.push({
        originalRow: originalRows[index] ?? {},
        reason: "AI output did not match expected record shape",
      });
      return;
    }

    const data = parsed.data;

    if (!hasContactInfo(data)) {
      skipped.push({
        originalRow: originalRows[index] ?? {},
        reason: "No email or mobile number found — record skipped per import rules",
      });
      return;
    }

    const record: CrmRecord = {
      created_at: normalizeCreatedAt(data.created_at),
      name: data.name || undefined,
      email: data.email || undefined,
      country_code: data.country_code || undefined,
      mobile_without_country_code: data.mobile_without_country_code || undefined,
      company: data.company || undefined,
      city: data.city || undefined,
      state: data.state || undefined,
      country: data.country || undefined,
      lead_owner: data.lead_owner || undefined,
      crm_status: normalizeCrmStatus(data.crm_status),
      crm_note: data.crm_note || undefined,
      data_source: normalizeDataSource(data.data_source),
      possession_time: data.possession_time || undefined,
      description: data.description || undefined,
    };

    kept.push(record);
  });

  logger.info("Validation complete for batch", {
    inputCount: aiRecords.length,
    keptCount: kept.length,
    skippedCount: skipped.length,
  });

  return { kept, skipped };
}