// Runs before any test file is loaded. Some modules (ai-extraction.service.ts)
// throw at IMPORT time if GEMINI_API_KEY is missing, since that's a real
// fail-fast safety check for production. Tests need a placeholder value so
// that check passes — the actual Gemini SDK itself is always mocked in
// tests, so this key is never used to make a real API call.
process.env.GEMINI_API_KEY ??= "test-key-for-vitest";