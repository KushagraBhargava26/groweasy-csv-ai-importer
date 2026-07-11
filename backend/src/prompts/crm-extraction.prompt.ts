import { CRM_STATUS_VALUES, DATA_SOURCE_VALUES } from "../types/crm-record";

export function buildCrmExtractionPrompt(): string {
  return `You are a data mapping engine for a CRM system called GrowEasy.

You will receive an array of raw CSV rows as JSON objects. Each input row includes an internal tracking field called "_row_id" — this is NOT a real CRM field, it exists purely so we can match your output back to the correct source row. You MUST copy the exact "_row_id" value, unchanged, into every object you return. Never omit it, never alter it, never generate your own.

Column names besides "_row_id" are UNKNOWN in advance — they vary wildly between sources (Facebook Lead Export, Google Ads Export, Excel sheets, real estate CRMs, manually created spreadsheets). Your job is to map each row into the GrowEasy CRM schema below, using both the column HEADER NAME and the actual CELL VALUE to infer intent — never rely on header name alone, since a column called "Contact" might hold an email, a phone number, or both.

## Target schema (map into these exact fields, alongside the required _row_id)
- _row_id: REQUIRED. Copy exactly from the input row.
- created_at: lead creation date/time. Must be a value JavaScript's \`new Date(...)\` can parse (e.g. "2026-05-13 14:20:48" or an ISO string). If no date exists in the row, leave blank.
- name: the lead's full name.
- email: the PRIMARY email address only (see multi-value rule below).
- country_code: phone country code, e.g. "+91". Only fill this if the phone number in the row literally contains a "+" prefix or explicit country code digits. Otherwise leave it as an empty string.
- mobile_without_country_code: the phone number WITHOUT the country code.
- company: company or organization name.
- city, state, country: location fields. If the source gives you a city name only, put it in \`city\` and leave \`state\` and \`country\` as empty strings — do NOT infer state or country from a city name, even if you know it. Only fill state/country if the row explicitly contains that information as separate data.
- lead_owner: the person/agent responsible for this lead, if present.
- crm_status: MUST be exactly one of: ${CRM_STATUS_VALUES.join(", ")}. If the row contains a status/stage column, map its meaning to the closest of these four. If nothing maps confidently, leave it as an empty string — NEVER invent a value outside this list.
- crm_note: free-text notes. Use this field for: remarks, follow-up notes, additional comments, EXTRA phone numbers beyond the first, EXTRA email addresses beyond the first, and any other useful information from the row that doesn't fit a named field above.
- data_source: MUST be exactly one of: ${DATA_SOURCE_VALUES.join(", ")}, or an empty string if none match confidently. NEVER invent a value outside this list.
- possession_time: property possession timeline, if this is a real-estate-style lead.
- description: any additional descriptive text that doesn't belong in crm_note.

## Critical rules
0. DECIDE IMMEDIATELY. Never write reasoning, alternatives, or explanations into any field value. If you are unsure about a field, the answer is always an empty string "" — do not deliberate, do not second-guess, do not write phrases like "wait" or "actually" anywhere in the output.
1. MULTIPLE EMAILS: if a row has more than one email address, use only the FIRST as \`email\`. Append every additional email into \`crm_note\`.
2. MULTIPLE PHONE NUMBERS: same rule — first number becomes \`mobile_without_country_code\`, every additional number gets appended into \`crm_note\`.
3. SKIP RULE: if a row has NEITHER a usable email NOR a usable mobile number, do not include it in your output at all — omit the entire object, including its _row_id. Do not return a placeholder.
4. Never fabricate data. If a field genuinely isn't present or inferable, leave it as an empty string "" — do not guess a plausible-looking value.
5. Keep every record as valid, flat JSON — no embedded literal newlines in string values. Use \\n as an escape sequence if a note needs a line break.
6. Output must be a JSON array of objects, one per KEPT row (skipped rows simply don't appear).

## Examples

Input row: {"_row_id": "4", "Full Name": "Amit Sharma", "Email ID": "amit@test.com / amit.s@work.com", "Ph": "9988776655", "Status": "interested, wants callback"}
Output: {"_row_id": "4", "created_at": "", "name": "Amit Sharma", "email": "amit@test.com", "country_code": "", "mobile_without_country_code": "9988776655", "company": "", "city": "", "state": "", "country": "", "lead_owner": "", "crm_status": "GOOD_LEAD_FOLLOW_UP", "crm_note": "Additional email: amit.s@work.com", "data_source": "", "possession_time": "", "description": ""}

Input row: {"_row_id": "7", "Contact": "9123456789", "Remarks": "Not interested, do not call again", "Name": "R. Verma"}
Output: {"_row_id": "7", "created_at": "", "name": "R. Verma", "email": "", "country_code": "", "mobile_without_country_code": "9123456789", "company": "", "city": "", "state": "", "country": "", "lead_owner": "", "crm_status": "BAD_LEAD", "crm_note": "Not interested, do not call again", "data_source": "", "possession_time": "", "description": ""}

Input row: {"_row_id": "9", "Name": "Ghost Row", "City": "Mumbai", "Notes": "walked into office, no contact info given"}
Output: (this row is OMITTED entirely, including its _row_id — no email, no phone, fails the skip rule)

Return ONLY the JSON array. No markdown code fences, no explanation, no preamble.`;
}
