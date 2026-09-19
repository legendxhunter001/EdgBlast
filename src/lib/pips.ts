// Single source of truth for pip/point sizing across the app — the CSV
// importer's decimal-fix, the lot calculator, and trade logging all use
// this same logic so a given symbol is never treated two different ways.

// A curated list of pip VALUES (per standard lot, in USD) for common pairs —
// this can't be derived from the symbol name alone since it depends on the
// current exchange rate, so these are reasonable static approximations.
const KNOWN_PIP_VALUES: Record<string, number> = {
  EURUSD: 10, GBPUSD: 10, AUDUSD: 10, NZDUSD: 10,
  USDCAD: 7.4, USDCHF: 11.2, USDJPY: 6.7, EURJPY: 6.7, GBPJPY: 6.7,
  EURGBP: 12.7, XAUUSD: 10,
};

/** The size of one "pip" for a given symbol — the decimal increment that counts as one pip. */
export function getPipSize(asset: string): number {
  const sym = asset.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (sym.startsWith('XAU')) return 0.1;                 // gold
  if (sym.startsWith('XAG')) return 0.01;                // silver
  if (sym.startsWith('BTC') || sym.startsWith('ETH')) return 1; // crypto — whole units
  if (/^(US30|NAS100|NASDAQ|SPX|SP500|GER30|GER40|DAX|UK100|FTSE|JP225|NIKKEI)/.test(sym)) return 1; // indices
  if (sym.endsWith('JPY') && /^[A-Z]{6}$/.test(sym)) return 0.01;  // JPY pairs
  if (/^[A-Z]{6}$/.test(sym)) return 0.0001;             // standard 6-letter FX pair
  return 0.0001; // fallback — most instruments not otherwise recognized
}

/** Approximate USD value of one pip per standard lot for a given symbol. */
export function getPipValue(asset: string): number {
  const sym = asset.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (KNOWN_PIP_VALUES[sym] !== undefined) return KNOWN_PIP_VALUES[sym];
  if (sym.startsWith('XAU')) return 10;
  if (sym.startsWith('XAG')) return 50;
  if (sym.startsWith('BTC')) return 1;
  if (sym.startsWith('ETH')) return 1;
  if (/^(US30|NAS100|NASDAQ|SPX|SP500|GER30|GER40|DAX|UK100|FTSE|JP225|NIKKEI)/.test(sym)) return 1;
  if (sym.endsWith('JPY') && /^[A-Z]{6}$/.test(sym)) return 6.7;
  return 10; // reasonable default for an unrecognized 6-letter FX pair
}

/** Real pip distance between two prices for a given symbol — never a raw price difference. */
export function pipsBetween(priceA: number, priceB: number, asset: string): number {
  if (!asset || !isFinite(priceA) || !isFinite(priceB)) return 0;
  return Math.abs(priceA - priceB) / getPipSize(asset);
}
