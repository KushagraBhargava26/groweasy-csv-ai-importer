import { z } from "zod";
import {
  CrmRecord,
  RawCsvRow,
  SkippedRow,
  CRM_STATUS_VALUES,
  DATA_SOURCE_VALUES,
} from "../types/crm-record";
import { logger } from "../utils/logger";

const crmStatusEnum = z.enum(CRM_STATUS_VALUES);
const dataSourceEnum = z.enum(DATA_SOURCE_VALUES);

// _row_id is required: it's how we match this AI-returned record back to
// the specific original row it came from, regardless of array position.
// See crm-mapper.service.ts for why matching by position isn't safe.
const crmRecordInputSchema = z.object({
  _row_id: z.string(),
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
  unmatchedIds: string[];
}

function normalizeCreatedAt(value: string): string {
  if (!value || value.trim() === "") return "";
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) {
    logger.warn("Invalid created_at value from AI, clearing it", { value });
    return "";
  }
  return value;
}

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

function hasContactInfo(record: { email: string; mobile_without_country_code: string }): boolean {
  return record.email.trim().length > 0 || record.mobile_without_country_code.trim().length > 0;
}

/**
 * Validates a batch of raw AI output records, matching each back to its
 * original row via the `_row_id` the AI was instructed to echo. Any
 * original row whose id never appears in the AI's output at all (not even
 * as a broken record) comes back in `unmatchedIds`, so the orchestrator can
 * account for it as skipped too — this is the expected path for rows the
 * AI correctly omitted per the skip rule.
 */
export function validateAiOutput(
  aiRecords: unknown[],
  rowById: Map<string, RawCsvRow>
): ValidationOutcome {
  const kept: CrmRecord[] = [];
  const skipped: SkippedRow[] = [];
  const matchedIds = new Set<string>();

  aiRecords.forEach((raw, index) => {
    const parsed = crmRecordInputSchema.safeParse(raw);

    if (!parsed.success) {
      const fallbackId =
        typeof raw === "object" && raw !== null && "_row_id" in raw
          ? String((raw as Record<string, unknown>)._row_id)
          : undefined;
      logger.warn("AI record failed schema validation, skipping", {
        index,
        fallbackId,
        issues: parsed.error.issues,
      });
      const originalRow = fallbackId ? rowById.get(fallbackId) : undefined;
      if (fallbackId) matchedIds.add(fallbackId);
      skipped.push({
        originalRow: originalRow ?? {},
        reason: "AI output did not match expected record shape",
      });
      return;
    }

    const data = parsed.data;
    matchedIds.add(data._row_id);
    const originalRow = rowById.get(data._row_id) ?? {};

    if (!hasContactInfo(data)) {
      skipped.push({
        originalRow,
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

  const unmatchedIds = Array.from(rowById.keys()).filter((id) => !matchedIds.has(id));

  logger.info("Validation complete for batch", {
    inputCount: aiRecords.length,
    keptCount: kept.length,
    skippedCount: skipped.length,
    unmatchedCount: unmatchedIds.length,
  });

  return { kept, skipped, unmatchedIds };
}