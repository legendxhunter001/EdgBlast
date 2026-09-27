// Single source of truth for pip/point/tick sizing across the app — the CSV
// importer's decimal-fix, the lot calculator, and trade logging all use
// this same logic so a given symbol is never treated two different ways.

// Common futures contract roots — tick size (smallest meaningful price move)
// and USD value per tick per contract. These vary by exchange/contract, so
// these are the standard, widely-known values for the most common contracts.
const FUTURES: Record<string, { tick: number; tickValue: number }> = {
  ES: { tick: 0.25, tickValue: 12.5 },   // S&P 500 e-mini
  MES: { tick: 0.25, tickValue: 1.25 },  // S&P 500 micro
  NQ: { tick: 0.25, tickValue: 5 },      // Nasdaq e-mini
  MNQ: { tick: 0.25, tickValue: 0.5 },   // Nasdaq micro
  YM: { tick: 1, tickValue: 5 },         // Dow e-mini
  MYM: { tick: 1, tickValue: 0.5 },      // Dow micro
  RTY: { tick: 0.1, tickValue: 5 },      // Russell 2000
  CL: { tick: 0.01, tickValue: 10 },     // Crude oil
  MCL: { tick: 0.01, tickValue: 1 },     // Crude oil micro
  NG: { tick: 0.001, tickValue: 10 },    // Natural gas
  GC: { tick: 0.1, tickValue: 10 },      // Gold futures
  MGC: { tick: 0.1, tickValue: 1 },      // Gold micro
  SI: { tick: 0.005, tickValue: 25 },    // Silver futures
  ZB: { tick: 0.03125, tickValue: 31.25 }, // 30-year bond
  ZN: { tick: 0.015625, tickValue: 15.625 }, // 10-year note
};

// Common crypto tickers, grouped by typical price magnitude so a coin worth
// cents (DOGE) isn't measured on the same scale as one worth thousands (BTC).
const CRYPTO_LARGE = ['BTC'];                      // whole-dollar pip
const CRYPTO_MID = ['ETH', 'SOL', 'AVAX', 'BNB', 'LTC'];  // cent-level pip
const CRYPTO_SMALL = ['XRP', 'ADA', 'DOGE', 'DOT', 'MATIC', 'TRX']; // sub-cent pip

// A curated list of pip VALUES (per standard lot, in USD) for common FX
// pairs — this can't be derived from the symbol name alone since it depends
// on the current exchange rate, so these are reasonable static approximations.
const KNOWN_FX_PIP_VALUES: Record<string, number> = {
  EURUSD: 10, GBPUSD: 10, AUDUSD: 10, NZDUSD: 10,
  USDCAD: 7.4, USDCHF: 11.2, USDJPY: 6.7, EURJPY: 6.7, GBPJPY: 6.7,
  EURGBP: 12.7, XAUUSD: 10,
};

function cleanSymbol(asset: string): string {
  return asset.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function futuresRoot(sym: string): keyof typeof FUTURES | null {
  // Futures tickers are often root + expiry code, e.g. ESZ25 or ES.
  for (const root of Object.keys(FUTURES)) {
    if (sym === root || sym.startsWith(root + 'Z') || sym.startsWith(root + 'H') || sym.startsWith(root + 'M') || sym.startsWith(root + 'U')) {
      return root as keyof typeof FUTURES;
    }
  }
  return null;
}

function cryptoBase(sym: string): string | null {
  const all = [...CRYPTO_LARGE, ...CRYPTO_MID, ...CRYPTO_SMALL];
  return all.find((c) => sym.startsWith(c)) ?? null;
}

/** Is this a real ticker-style stock symbol (1-5 letters, not a 6-letter FX pair, not a known index/crypto/futures root)? */
function looksLikeStock(sym: string): boolean {
  if (!/^[A-Z]{1,5}$/.test(sym)) return false;
  if (sym.length === 6) return false; // handled as FX elsewhere
  if (futuresRoot(sym)) return false;
  if (cryptoBase(sym)) return false;
  if (/^(US30|NAS100|NASDAQ|SPX|SP500|GER30|GER40|DAX|UK100|FTSE|JP225|NIKKEI|XAU|XAG)/.test(sym)) return false;
  return true;
}

/** The size of one "pip" (or tick) for a given symbol — the decimal increment that counts as one unit of movement. */
export function getPipSize(asset: string): number {
  const sym = cleanSymbol(asset);
  const fut = futuresRoot(sym);
  if (fut) return FUTURES[fut].tick;
  if (sym.startsWith('XAU')) return 0.1;                 // gold spot
  if (sym.startsWith('XAG')) return 0.01;                // silver spot
  const crypto = cryptoBase(sym);
  if (crypto) {
    if (CRYPTO_LARGE.includes(crypto)) return 1;
    if (CRYPTO_MID.includes(crypto)) return 0.01;
    return 0.0001; // small-cap coins
  }
  if (/^(US30|NAS100|NASDAQ|SPX|SP500|GER30|GER40|DAX|UK100|FTSE|JP225|NIKKEI)/.test(sym)) return 1; // CFD indices
  if (sym.endsWith('JPY') && /^[A-Z]{6}$/.test(sym)) return 0.01;  // JPY pairs
  if (/^[A-Z]{6}$/.test(sym)) return 0.0001;             // standard 6-letter FX pair
  if (looksLikeStock(sym)) return 0.01;                  // stocks — one cent
  return 0.0001; // fallback — unrecognized instrument
}

/** Approximate USD value of one pip/tick per standard position size for a given symbol. */
export function getPipValue(asset: string): number {
  const sym = cleanSymbol(asset);
  const fut = futuresRoot(sym);
  if (fut) return FUTURES[fut].tickValue;
  if (KNOWN_FX_PIP_VALUES[sym] !== undefined) return KNOWN_FX_PIP_VALUES[sym];
  if (sym.startsWith('XAU')) return 10;
  if (sym.startsWith('XAG')) return 50;
  const crypto = cryptoBase(sym);
  if (crypto) return getPipSize(asset); // for crypto, 1 unit size = 1 coin, so pip value = pip size in USD
  if (/^(US30|NAS100|NASDAQ|SPX|SP500|GER30|GER40|DAX|UK100|FTSE|JP225|NIKKEI)/.test(sym)) return 1;
  if (sym.endsWith('JPY') && /^[A-Z]{6}$/.test(sym)) return 6.7;
  if (looksLikeStock(sym)) return 0.01; // 1 share, 1 cent move = $0.01
  return 10; // reasonable default for an unrecognized 6-letter FX pair
}

/** Real pip/tick distance between two prices for a given symbol — never a raw price difference. */
export function pipsBetween(priceA: number, priceB: number, asset: string): number {
  if (!asset || !isFinite(priceA) || !isFinite(priceB)) return 0;
  return Math.abs(priceA - priceB) / getPipSize(asset);
}
