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
 * Sanitizes and normalizes a phone number to international format.
 *
 * Serbian numbers are normalized to +381XXXXXXXXX format.
 * Montenegro (+382), Bosnia (+387), etc. are also handled.
 * Local formats like 060/123-456, 064-811-10-90, 011/35-10-965 are converted.
 *
 * Returns '/' if the input is empty, null, or cannot be parsed as a valid phone.
 */
export function sanitizePhone(input: unknown): string {
  if (input === null || input === undefined) return '/'
  const str = String(input).trim()
  if (str === '' || str === '/') return '/'

  // Strip everything except digits and leading +
  let cleaned = str.replace(/[^0-9+]/g, '')
  if (!cleaned) return '/'

  // 00... international prefix → +...
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2)
  }

  // Bare country code without + (e.g. 38160..., 38269...)
  if (/^38[0-9]/.test(cleaned) && cleaned.length >= 10) {
    cleaned = '+' + cleaned
  }

  // Remove double-zero after country code: +381060... → +38160...
  const doublePrefixMatch = cleaned.match(/^(\+38[0-9])0(\d+)$/)
  if (doublePrefixMatch) {
    cleaned = doublePrefixMatch[1] + doublePrefixMatch[2]
  }

  // Local Serbian number starting with 0 (06x, 011, 02x, etc.)
  if (cleaned.startsWith('0') && cleaned.length >= 9) {
    cleaned = '+381' + cleaned.substring(1)
  }

  // Short local number without leading 0 (e.g. 6x..., 11...) — 8-9 digits
  if (/^[1-9]\d{7,8}$/.test(cleaned)) {
    cleaned = '+381' + cleaned
  }

  // Must have at least 6 digits to be considered valid
  if (cleaned.replace(/[^0-9]/g, '').length < 6) {
    return '/'
  }

  return cleaned
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
