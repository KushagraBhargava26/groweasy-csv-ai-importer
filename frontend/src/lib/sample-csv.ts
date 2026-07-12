import { CRM_FIELDS } from "@/types/crm-record";

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