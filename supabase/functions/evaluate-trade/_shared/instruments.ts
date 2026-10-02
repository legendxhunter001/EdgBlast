// Instrument specs for the risk engine. MIRRORS src/lib/pips.ts (same tick sizes, tick values, FX pip table).
// Edge Functions can't import from src/, so this is a copy; supabase/tests/instruments_parity.test.ts
// fails if the two ever drift. Change pips.ts => change this file.
//
// Difference from pips.ts: pips.ts falls back to "10 USD/pip" for anything unknown, which is fine for a
// calculator but dangerous for a hard risk gate. Here unknown => null => the trade is BLOCKED.
// Account currency is assumed USD until the MT5 bridge supplies real contract specs.

export type AssetClass = "fx" | "metal" | "futures" | "crypto" | "index" | "stock";

export interface InstrumentSpec {
  assetClass: AssetClass;
  pipSize: number;     // price increment that counts as one pip/tick
  pipValue: number;    // USD per pip/tick per 1.0 lot (contract / share / coin)
  lotStep: number;
  minLot: number;
  maxLot: number;
  riskBuffer: number;  // loss per lot is multiplied by this when the pip value is approximate (1 = exact)
  warn: boolean;       // true => verdict can't be a clean PASS until the broker's real specs are known
  note: string | null;
}

const FUTURES: Record<string, { tick: number; tickValue: number }> = {
  ES: { tick: 0.25, tickValue: 12.5 }, MES: { tick: 0.25, tickValue: 1.25 },
  NQ: { tick: 0.25, tickValue: 5 }, MNQ: { tick: 0.25, tickValue: 0.5 },
  YM: { tick: 1, tickValue: 5 }, MYM: { tick: 1, tickValue: 0.5 },
  RTY: { tick: 0.1, tickValue: 5 },
  CL: { tick: 0.01, tickValue: 10 }, MCL: { tick: 0.01, tickValue: 1 },
  NG: { tick: 0.001, tickValue: 10 },
  GC: { tick: 0.1, tickValue: 10 }, MGC: { tick: 0.1, tickValue: 1 },
  SI: { tick: 0.005, tickValue: 25 },
  ZB: { tick: 0.03125, tickValue: 31.25 }, ZN: { tick: 0.015625, tickValue: 15.625 },
};
const CRYPTO_LARGE = ["BTC"];
const CRYPTO_MID = ["ETH", "SOL", "AVAX", "BNB", "LTC"];
const CRYPTO_SMALL = ["XRP", "ADA", "DOGE", "DOT", "MATIC", "TRX"];
const KNOWN_FX_PIP_VALUES: Record<string, number> = {
  EURUSD: 10, GBPUSD: 10, AUDUSD: 10, NZDUSD: 10,
  USDCAD: 7.4, USDCHF: 11.2, USDJPY: 6.7, EURJPY: 6.7, GBPJPY: 6.7,
  EURGBP: 12.7, XAUUSD: 10,
};
const CCY = new Set(["USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF"]);
const INDEX_RE = /^(US30|NAS100|NASDAQ|SPX|SP500|GER30|GER40|DAX|UK100|FTSE|JP225|NIKKEI)/;
const COMMODITY_CFD_RE = /^(USOIL|UKOIL|XTI|XBR|WTI|BRENT|NATGAS|XNG|COPPER)/; // brokers differ wildly; unsupported until bridge specs

const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

function futuresRoot(sym: string): string | null {
  for (const root of Object.keys(FUTURES))
    if (sym === root || /^[ZHMU]\d{1,2}$/.test(sym.slice(root.length)) && sym.startsWith(root)) return root;
  return null;
}
function cryptoBase(sym: string): string | null {
  return [...CRYPTO_LARGE, ...CRYPTO_MID, ...CRYPTO_SMALL].find((c) => sym.startsWith(c)) ?? null;
}

export function instrumentSpec(symbol: string, clientRateToUsd?: number): { spec: InstrumentSpec | null; reason: string | null } {
  const sym = clean(symbol);
  const ok = (spec: InstrumentSpec) => ({ spec, reason: null });
  const no = (reason: string) => ({ spec: null, reason });
  const m = sym.match(/^([A-Z]{3})([A-Z]{3})/); // broker suffixes (EURUSDm, EURUSD.pro) are ignored
  const base = m?.[1], quote = m?.[2];

  // Metals vs USD (exact: USD quote)
  if (m && (base === "XAU" || base === "XAG") && quote === "USD")
    return ok({ assetClass: "metal", pipSize: base === "XAU" ? 0.1 : 0.01, pipValue: base === "XAU" ? 10 : 50, lotStep: 0.01, minLot: 0.01, maxLot: 100, riskBuffer: 1, warn: false, note: null });

  // FX
  if (m && CCY.has(base!) && CCY.has(quote!)) {
    const pair = base! + quote!;
    const pipSize = quote === "JPY" ? 0.01 : 0.0001;
    const common = { assetClass: "fx" as const, pipSize, lotStep: 0.01, minLot: 0.01, maxLot: 100 };
    if (quote === "USD") return ok({ ...common, pipValue: 10, riskBuffer: 1, warn: false, note: null });
    const known = KNOWN_FX_PIP_VALUES[pair] ?? (quote === "JPY" ? 6.7 : undefined);
    if (known !== undefined) // static value depends on today's rate => pad risk 10%; client-supplied rates are ignored here on purpose
      return ok({ ...common, pipValue: known, riskBuffer: 1.1, warn: false, note: `Pip value for ${pair} is a static approximation; risk is padded 10% until the MT5 bridge supplies the live rate.` });
    if (clientRateToUsd && clientRateToUsd > 0)
      return ok({ ...common, pipValue: 100_000 * pipSize * clientRateToUsd, riskBuffer: 1.1, warn: true, note: `${pair}: ${quote}→USD rate came from the client and can't be verified yet.` });
    return no(`${pair} needs a ${quote}→USD rate that isn't in the static table. Not supported until the MT5 bridge supplies specs.`);
  }

  const fut = futuresRoot(sym);
  if (fut) return ok({ assetClass: "futures", pipSize: FUTURES[fut].tick, pipValue: FUTURES[fut].tickValue, lotStep: 1, minLot: 1, maxLot: 1000, riskBuffer: 1.1, warn: true,
    note: `Standard ${fut} exchange tick value. Your broker's CFD contract may differ; verify before trusting the size.` });

  const crypto = cryptoBase(sym);
  if (crypto) {
    const pipSize = CRYPTO_LARGE.includes(crypto) ? 1 : CRYPTO_MID.includes(crypto) ? 0.01 : 0.0001;
    return ok({ assetClass: "crypto", pipSize, pipValue: pipSize, lotStep: 0.01, minLot: 0.01, maxLot: 100, riskBuffer: 1.1, warn: true,
      note: "Crypto sizing assumes 1 lot = 1 coin. Brokers differ; verify contract size." });
  }

  if (INDEX_RE.test(sym))
    return ok({ assetClass: "index", pipSize: 1, pipValue: 1, lotStep: 0.01, minLot: 0.01, maxLot: 100, riskBuffer: 1.1, warn: true,
      note: "Index CFD sizing assumes $1 per point per lot. Brokers differ; verify contract size." });

  if (COMMODITY_CFD_RE.test(sym)) return no("Oil/commodity CFDs vary too much by broker. Not supported until the MT5 bridge supplies specs.");

  if (/^[A-Z]{1,5}$/.test(sym))
    return ok({ assetClass: "stock", pipSize: 0.01, pipValue: 0.01, lotStep: 1, minLot: 1, maxLot: 100_000, riskBuffer: 1, warn: true,
      note: "Treated as a share (1 lot = 1 share). Verify this is a stock on your broker." });

  return no(`Unrecognized instrument "${symbol}".`);
}
