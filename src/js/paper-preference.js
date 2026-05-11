/**
 * Shared paper-size preference module (Story 2.7).
 *
 * Single source of truth for the user's A4/Letter choice across all three
 * print surfaces: script-sheet builder, night-sheet builder, sleeve generator.
 *
 * Priority order:
 *   1. localStorage — user has explicitly set a preference
 *   2. navigator.language locale detection — first visit
 *   3. A4 — fallback for any locale not in the Letter list
 *
 * Consumers:
 *   import { getPaperSize, setPaperSize } from '/js/paper-preference.js';
 *
 *   getPaperSize()          — returns 'A4' or 'Letter'
 *   setPaperSize('Letter')  — persists to localStorage; call on every toggle change
 */

const STORAGE_KEY = 'rvb:paper-size';
const VALID = new Set(['A4', 'Letter']);

// Locales whose users typically print on Letter.
// Full tag match (case-insensitive): en-US, en-CA, es-MX, en-LR.
// Prefix match: fil (covers fil, fil-PH, etc.).
const LETTER_LOCALES = new Set(['en-us', 'en-ca', 'es-mx', 'en-lr']);
const LETTER_PREFIXES = ['fil'];

function detectFromLocale() {
  const lang = (typeof navigator !== 'undefined' ? (navigator.language ?? '') : '').toLowerCase();
  if (LETTER_LOCALES.has(lang)) return 'Letter';
  if (LETTER_PREFIXES.some(p => lang === p || lang.startsWith(`${p}-`))) return 'Letter';
  return 'A4';
}

export function getPaperSize() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID.has(stored)) return stored;
  } catch {
    // localStorage may be blocked in strict private-browsing contexts.
  }
  return detectFromLocale();
}

export function setPaperSize(size) {
  if (!VALID.has(size)) return;
  try {
    localStorage.setItem(STORAGE_KEY, size);
  } catch {
    // Ignore write errors; the in-memory state in the caller remains correct.
  }
}
