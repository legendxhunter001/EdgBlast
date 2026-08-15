// Lightweight symbol "logo" — flag pairs for forex, distinct icons for metals,
// crypto, and indices. No network dependency, works offline, never broken.
const FLAGS: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', AUD: '🇦🇺', NZD: '🇳🇿',
  CAD: '🇨🇦', CHF: '🇨🇭', CNH: '🇨🇳', CNY: '🇨🇳', HKD: '🇭🇰', SGD: '🇸🇬',
  SEK: '🇸🇪', NOK: '🇳🇴', DKK: '🇩🇰', ZAR: '🇿🇦', MXN: '🇲🇽', TRY: '🇹🇷',
  PLN: '🇵🇱', HUF: '🇭🇺', CZK: '🇨🇿', ILS: '🇮🇱', INR: '🇮🇳', KRW: '🇰🇷',
};

export function symbolGlyph(raw: string): string {
  const clean = (raw || '').split(':').pop()?.replace('/', '').toUpperCase().trim() ?? '';
  if (/^XAU/.test(clean)) return '🥇';
  if (/^XAG/.test(clean)) return '🥈';
  if (/^(BTC|ETH|XRP|LTC|SOL|DOGE|ADA|BNB)/.test(clean)) return '🪙';
  if (/^(US30|NAS100|SPX500|US500|GER30|UK100|JPN225|GER40|DE30)/.test(clean)) return '📈';
  if (/OIL|WTI|BRENT/.test(clean)) return '🛢️';
  if (clean.length === 6) {
    const base = clean.slice(0, 3);
    const quote = clean.slice(3, 6);
    const b = FLAGS[base];
    const q = FLAGS[quote];
    if (b && q) return `${b}${q}`;
    if (b) return b;
    if (q) return q;
  }
  return '💱';
}

export const SymbolLogo = ({ symbol, size = 14, className = '' }: { symbol: string; size?: number; className?: string }) => (
  <span
    className={className}
    style={{ fontSize: size, lineHeight: 1, display: 'inline-block' }}
    aria-hidden="true"
  >
    {symbolGlyph(symbol)}
  </span>
);
