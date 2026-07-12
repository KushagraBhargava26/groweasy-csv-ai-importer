// Mirrors backend/src/types/crm-record.ts for all types/interfaces below.
// (CRM_FIELDS is the one frontend-only addition — a utility constant with
// no backend equivalent, used for generating the example CSV download.)
// Kept as a separate file
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

// Ordered field list for the CRM record — frontend-only utility (not mirrored
// from the backend), used to generate the downloadable example CSV so its
// column order/names can never drift from the actual CrmRecord shape above.
export const CRM_FIELDS: (keyof CrmRecord)[] = [
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
  "created_at",
];

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