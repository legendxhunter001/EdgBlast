// Correct per-pair pip calculation — the bug being fixed here is that a naive
// price-difference calculation doesn't account for how many decimal places
// each pair actually uses. JPY pairs quote 2-3 decimals (pip = 0.01), XAU
// quotes 2 decimals but pip = 0.1, and standard FX pairs quote 4-5 decimals
// (pip = 0.0001). Getting this per-pair factor right is the whole fix.
export function pipFactor(symbol: string): number {
  const s = symbol.toUpperCase()
  if (s.includes('JPY')) return 100
  if (s.includes('XAU') || s.includes('GOLD')) return 10
  if (s.includes('XAG') || s.includes('SILVER')) return 100
  return 10000
}

export function calculatePips(symbol: string, priceFrom: number, priceTo: number): number {
  const factor = pipFactor(symbol)
  return Math.round((priceTo - priceFrom) * factor * 10) / 10
}

// Minimal symbol -> flag pair mapping for common FX pairs (extendable).
export function currencyFlags(symbol: string): string {
  const flagMap: Record<string, string> = {
    EUR: '🇪🇺', USD: '🇺🇸', GBP: '🇬🇧', JPY: '🇯🇵', AUD: '🇦🇺',
    NZD: '🇳🇿', CAD: '🇨🇦', CHF: '🇨🇭', XAU: '🥇', XAG: '🥈',
  }
  const clean = symbol.toUpperCase().replace(/[^A-Z]/g, '')
  const first = clean.slice(0, 3)
  const second = clean.slice(3, 6)
  return `${flagMap[first] ?? ''}${flagMap[second] ?? ''}`
}
