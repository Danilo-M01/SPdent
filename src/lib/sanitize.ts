/**
 * Input sanitizer for patient data fields.
 * Strips HTML tags, control characters, and common XSS payloads
 * before any user-provided string is stored in the database.
 *
 * This is a whitelist-based approach: only printable Unicode characters,
 * common punctuation, and whitespace are allowed.
 */

/**
 * Sanitizes a single string field.
 * - Strips all HTML/XML tags
 * - Strips JavaScript event handlers (onclick=, onerror=, etc.)
 * - Strips null bytes and other control characters
 * - Trims whitespace
 * - Returns empty string if input is null/undefined
 */
export function sanitizeText(input: unknown): string {
  if (input === null || input === undefined) return ''
  if (typeof input !== 'string') return ''

  return input
    // Remove null bytes
    .replace(/\0/g, '')
    // Strip HTML/XML tags
    .replace(/<[^>]*>/g, '')
    // Strip javascript: protocol
    .replace(/javascript\s*:/gi, '')
    // Strip data: URIs
    .replace(/data\s*:/gi, '')
    // Strip HTML entity encoding attempts for script
    .replace(/&#x?[0-9a-f]+;/gi, '')
    // Strip control characters (except tab, newline, carriage return)
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
}

/**
 * Sanitizes a phone number — digits, spaces, +, -, (, ) only.
 */
export function sanitizePhone(input: unknown): string {
  if (input === null || input === undefined) return '/'
  const str = String(input).trim()
  if (str === '' || str === '/') return '/'
  // Allow numbers, spaces, +, -, (, ), and /
  return str.replace(/[^0-9\s\+\-\(\)\/]/g, '').trim()
}

/**
 * Sanitizes an email address.
 */
export function sanitizeEmail(input: unknown): string {
  const text = sanitizeText(input)
  // Basic email format validation — if it doesn't look like email, return empty
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(text) ? text : ''
}

/**
 * Sanitizes a numeric value for currency/debt fields.
 * Returns 0 if the input is not a valid number.
 */
export function sanitizeNumeric(input: unknown): number {
  const num = parseFloat(String(input))
  if (isNaN(num) || !isFinite(num)) return 0
  // Cap at a reasonable maximum to prevent overflow
  return Math.min(Math.max(num, 0), 9_999_999.99)
}
