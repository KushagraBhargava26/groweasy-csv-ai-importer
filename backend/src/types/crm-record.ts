// The two controlled vocabularies from the assignment spec.
// Defining these as literal union types (not just `string`) means TypeScript
// will error at compile time if any code path tries to assign a value
// outside this exact list — this is our first line of defense, before
// the Zod runtime validation we'll add later.

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

// The core CRM record shape. Every field the AI extracts must conform to this.
// Fields are optional (`?`) where the source CSV may genuinely lack that data —
// per the spec, only email/mobile presence is mandatory (enforced separately,
// not through the type system, since "at least one of two fields" isn't
// expressible as a plain optional).
export interface CrmRecord {
  created_at?: string; // must be parseable by `new Date(...)` — validated at runtime, not by this type
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

// A raw row from the uploaded CSV, before any AI processing.
// Column names are unknown ahead of time — hence Record<string, string>
// rather than a fixed interface.
export type RawCsvRow = Record<string, string>;

// What we return for a row the AI (or our own validator) decided to skip.
export interface SkippedRow {
  originalRow: RawCsvRow;
  reason: string;
}

// The full response shape the frontend will consume in Step 4.
export interface ImportResult {
  imported: CrmRecord[];
  skipped: SkippedRow[];
  totalImported: number;
  totalSkipped: number;
  batchesProcessed: number;
  batchesFailed: number;
}