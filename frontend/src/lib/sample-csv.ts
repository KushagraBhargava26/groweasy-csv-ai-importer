import { CrmRecord, SkippedRow, CRM_FIELDS } from "@/types/crm-record";

/**
 * Builds and triggers a download of an example CSV showing the CRM field
 * names the AI maps into. This is a real, accurate representation of the
 * schema (driven by CRM_FIELDS, not hand-typed) — not a decorative stand-in.
 * One example data row is included to show the expected shape/format per
 * field, not as sample "real" data.
 */
const EXAMPLE_ROW: Record<(typeof CRM_FIELDS)[number], string> = {
  name: "Riya Sharma",
  email: "riya.sharma@example.com",
  country_code: "+91",
  mobile_without_country_code: "9876543210",
  company: "Acme Realty",
  city: "Mumbai",
  state: "Maharashtra",
  country: "India",
  lead_owner: "Amit Kumar",
  crm_status: "GOOD_LEAD_FOLLOW_UP",
  crm_note: "Interested in 2BHK, follow up next week",
  data_source: "leads_on_demand",
  possession_time: "Ready to move",
  description: "Referred by existing customer",
  created_at: "2026-07-01T10:30:00Z",
};

function escapeCsvValue(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadExampleCsv(): void {
  const header = CRM_FIELDS.map(escapeCsvValue).join(",");
  const row = CRM_FIELDS.map((field) => escapeCsvValue(EXAMPLE_ROW[field])).join(",");
  const csvContent = `${header}\n${row}\n`;

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "groweasy-example-format.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads the real imported records as a CSV, in the same field order
 * as CRM_FIELDS — this is actual converted data from the completed import,
 * not a template or sample.
 */
export function downloadImportedCsv(records: CrmRecord[]): void {
  const header = CRM_FIELDS.map(escapeCsvValue).join(",");
  const rows = records.map((record) => CRM_FIELDS.map((field) => escapeCsvValue(record[field] ?? "")).join(","));
  const csvContent = [header, ...rows].join("\n") + "\n";
  triggerCsvDownload(csvContent, "groweasy-imported-records.csv");
}

/**
 * Downloads the skipped rows as a CSV — each row's original raw data plus
 * the reason it was skipped, so the user can see exactly why without
 * digging through the app.
 */
export function downloadSkippedCsv(skipped: SkippedRow[]): void {
  if (skipped.length === 0) return;

  const originalColumns = Object.keys(skipped[0].originalRow);
  const header = [...originalColumns, "skip_reason"].map(escapeCsvValue).join(",");
  const rows = skipped.map((item) => {
    const originalValues = originalColumns.map((col) => escapeCsvValue(item.originalRow[col] ?? ""));
    return [...originalValues, escapeCsvValue(item.reason)].join(",");
  });
  const csvContent = [header, ...rows].join("\n") + "\n";
  triggerCsvDownload(csvContent, "groweasy-skipped-records.csv");
}

function triggerCsvDownload(csvContent: string, fileName: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
