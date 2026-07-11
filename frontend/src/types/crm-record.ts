// Mirrors backend/src/types/crm-record.ts exactly. Kept as a separate file
// (not a shared package) since this is a simple two-folder monorepo, not an
// npm workspace setup — duplication here is a deliberate, small tradeoff for
// simplicity. If these two files ever drift apart, the frontend will start
// getting fields it doesn't expect from real API responses — worth keeping
// this file's shape identical to the backend's whenever that one changes.

export const CRM_STATUS_VALUES = [
  "GOOD_LEAD_FOLLOW_UP",
  "DID_NOT_CONNECT",
  "BAD_LEAD",
  "SALE_DONE",
] as const;

export type CrmStatus = (typeof CRM_STATUS_VALUES)[number];

export const DATA_SOURCE_VALUES = [
  "leads_on_demand",
  "meridian_tower",
  "eden_park",
  "varah_swamy",
  "sarjapur_plots",
] as const;

export type DataSource = (typeof DATA_SOURCE_VALUES)[number];

export interface CrmRecord {
  created_at?: string;
  name?: string;
  email?: string;
  country_code?: string;
  mobile_without_country_code?: string;
  company?: string;
  city?: string;
  state?: string;
  country?: string;
  lead_owner?: string;
  crm_status?: CrmStatus;
  crm_note?: string;
  data_source?: DataSource;
  possession_time?: string;
  description?: string;
}

// A raw row from the uploaded CSV, before any AI processing — this is what
// Step 2 (preview) displays. Column names are unknown ahead of time.
export type RawCsvRow = Record<string, string>;

export interface SkippedRow {
  originalRow: RawCsvRow;
  reason: string;
}

// Exactly matches the backend's ImportResult response shape.
export interface ImportResult {
  imported: CrmRecord[];
  skipped: SkippedRow[];
  totalImported: number;
  totalSkipped: number;
  batchesProcessed: number;
  batchesFailed: number;
}