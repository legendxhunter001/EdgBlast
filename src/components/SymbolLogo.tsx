import { useState } from 'react';

// Real TradingView symbol logos — same CDN their own widgets use.
// Forex pairs render as two overlapping circular flags (base + quote),
// matching TradingView's own convention. Falls back to a simple emoji glyph
// if a specific logo fails to load, so nothing ever shows a broken image icon.

const BASE_URL = 'https://s3-symbol-logo.tradingview.com';

const COUNTRY: Record<string, string> = {
  USD: 'US', EUR: 'EU', GBP: 'GB', JPY: 'JP', AUD: 'AU', NZD: 'NZ',
  CAD: 'CA', CHF: 'CH', CNH: 'CN', CNY: 'CN', HKD: 'HK', SGD: 'SG',
  SEK: 'SE', NOK: 'NO', DKK: 'DK', ZAR: 'ZA', MXN: 'MX', TRY: 'TR',
  PLN: 'PL', HUF: 'HU', CZK: 'CZ', ILS: 'IL', INR: 'IN', KRW: 'KR',
};

const CRYPTO: Record<string, string> = {
  BTC: 'XTVCBTC', ETH: 'XTVCETH', BNB: 'XTVCBNB', SOL: 'XTVCSOL',
  XRP: 'XTVCXRP', ADA: 'XTVCADA', DOGE: 'XTVCDOGE', AVAX: 'XTVCAVAX',
  DOT: 'XTVCDOT', LINK: 'XTVCLINK', LTC: 'XTVCLTC',
};

const INDICES: [string, string][] = [
  ['NAS100', 'indices/nasdaq-100.svg'], ['US100', 'indices/nasdaq-100.svg'],
  ['SPX500', 'indices/s-and-p-500.svg'], ['US500', 'indices/s-and-p-500.svg'], ['SPX', 'indices/s-and-p-500.svg'],
  ['US30', 'indices/dow-30.svg'], ['DJI', 'indices/dow-30.svg'],
  ['GER40', 'indices/dax.svg'], ['GER30', 'indices/dax.svg'], ['DE30', 'indices/dax.svg'],
  ['UK100', 'indices/ftse-100.svg'],
  ['JPN225', 'indices/nikkei-225.svg'], ['NI225', 'indices/nikkei-225.svg'],
  ['HSI', 'indices/hang-seng.svg'],
  ['DXY', 'indices/u-s-dollar-index.svg'],
  ['VIX', 'indices/volatility-s-and-p-500.svg'],
];

function clean(raw: string): string {
  return (raw || '').split(':').pop()?.replace('/', '').toUpperCase().trim() ?? '';
}

export function symbolLogoUrls(raw: string): string[] {
  const c = clean(raw);
  if (/^XAU/.test(c)) return [`${BASE_URL}/metal/gold.svg`];
  if (/^XAG/.test(c)) return [`${BASE_URL}/metal/silver.svg`];
  for (const [prefix, path] of INDICES) {
    if (c.startsWith(prefix)) return [`${BASE_URL}/${path}`];
  }
  for (const [code, slug] of Object.entries(CRYPTO)) {
    if (c.startsWith(code)) return [`${BASE_URL}/crypto/${slug}.svg`];
  }
  if (c.length === 6) {
    const base = c.slice(0, 3);
    const quote = c.slice(3, 6);
    const b = COUNTRY[base];
    const q = COUNTRY[quote];
    if (b && q) return [`${BASE_URL}/country/${b}.svg`, `${BASE_URL}/country/${q}.svg`];
    if (b) return [`${BASE_URL}/country/${b}.svg`];
    if (q) return [`${BASE_URL}/country/${q}.svg`];
  }
  return [];
}

export function symbolGlyph(raw: string): string {
  const c = clean(raw);
  if (/^XAU/.test(c)) return '🥇';
  if (/^XAG/.test(c)) return '🥈';
  if (/^(BTC|ETH|XRP|LTC|SOL|DOGE|ADA|BNB)/.test(c)) return '🪙';
  if (/OIL|WTI|BRENT/.test(c)) return '🛢️';
  return '💱';
}

export const SymbolLogo = ({ symbol, size = 14, className = '' }: { symbol: string; size?: number; className?: string }) => {
  const [failed, setFailed] = useState(false);
  const urls = symbolLogoUrls(symbol);

  if (failed || urls.length === 0) {
    return (
      <span className={className} style={{ fontSize: size, lineHeight: 1, display: 'inline-block' }} aria-hidden="true">
        {symbolGlyph(symbol)}
      </span>
    );
  }

  if (urls.length === 2) {
    const offset = Math.round(size * 0.62);
    const width = size + offset;
    return (
      <span className={className} style={{ position: 'relative', display: 'inline-block', width, height: size, flexShrink: 0 }} aria-hidden="true">
        <img
          src={urls[0]}
          alt=""
          onError={() => setFailed(true)}
          style={{
            position: 'absolute', left: 0, top: 0, width: size, height: size, borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.15)', background: '#1a1a1f', objectFit: 'cover', zIndex: 1,
          }}
        />
        <img
          src={urls[1]}
          alt=""
          onError={() => setFailed(true)}
          style={{
            position: 'absolute', left: offset, top: 0, width: size, height: size, borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.15)', background: '#1a1a1f', objectFit: 'cover', zIndex: 2,
          }}
        />
      </span>
    );
  }

  return (
    <img
      src={urls[0]}
      alt=""
      onError={() => setFailed(true)}
      className={className}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'contain', display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    />
  );
};
