// Fails if supabase/functions/_shared/instruments.ts drifts from src/lib/pips.ts.
// Run from repo root:  npx tsx --test supabase/tests/instruments_parity.test.ts
import { test } from "node:test";
import assert from "node:assert";
import { getPipSize, getPipValue } from "../../src/lib/pips.ts";
import { instrumentSpec } from "../functions/_shared/instruments.ts";

const SYMBOLS = [
  "EURUSD", "GBPUSD", "AUDUSD", "NZDUSD", "USDCAD", "USDCHF", "USDJPY", "EURJPY", "GBPJPY", "AUDJPY", "EURGBP",
  "XAUUSD", "XAGUSD", "ES", "MES", "NQ", "MNQ", "YM", "RTY", "CL", "NG", "GC", "SI", "ZB", "ZN", "ESZ25", "NQH26",
  "BTCUSD", "ETHUSD", "SOLUSD", "XRPUSD", "DOGEUSD", "US30", "NAS100", "GER40", "UK100", "AAPL", "TSLA", "NVDA",
];

for (const sym of SYMBOLS) {
  test(`parity ${sym}`, () => {
    const { spec } = instrumentSpec(sym);
    assert.ok(spec, `${sym} should be supported`);
    assert.strictEqual(spec!.pipSize, getPipSize(sym), "pipSize");
    assert.strictEqual(spec!.pipValue, getPipValue(sym), "pipValue");
  });
}
