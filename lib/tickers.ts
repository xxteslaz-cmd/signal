// Ticker validation/normalization shared by watchlist routes.

export function normalizeTicker(raw: string): string {
  return raw.trim().toUpperCase();
}

// Allow letters, digits, dot and dash (e.g. BRK.B, RDS-A). 1-6 core chars.
const TICKER_RE = /^[A-Z]{1,6}([.\-][A-Z]{1,3})?$/;

export function isValidTicker(t: string): boolean {
  return TICKER_RE.test(t);
}
