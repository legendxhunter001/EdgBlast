// One place that knows how to load every page, so navigation can prefetch ahead of the click.
export const loaders = {
  trades: () => import('@/pages/Trades'),
  newTrade: () => import('@/pages/NewTrade'),
  tradeDetail: () => import('@/pages/TradeDetail'),
  calendar: () => import('@/pages/Calendar'),
  analytics: () => import('@/pages/Analytics'),
  reviews: () => import('@/pages/Reviews'),
  settings: () => import('@/pages/Settings'),
  connections: () => import('@/pages/Connections'),
  tools: () => import('@/pages/TradingTools'),
  mt5: () => import('@/pages/MT5'),
  coach: () => import('@/pages/AICoach'),
  journey: () => import('@/pages/Journey'),
};

const byPath: [string, () => Promise<unknown>][] = [
  ['/trades/new', loaders.newTrade],
  ['/trades', loaders.trades],
  ['/calendar', loaders.calendar],
  ['/analytics', loaders.analytics],
  ['/reviews', loaders.reviews],
  ['/settings', loaders.settings],
  ['/connections', loaders.connections],
  ['/trading-tools', loaders.tools],
  ['/mt5', loaders.mt5],
  ['/ai-coach', loaders.coach],
  ['/journey', loaders.journey],
];

/** Start loading a page's code when the pointer/finger gets near its link. */
export const prefetch = (to: string) => {
  const path = to.split('?')[0];
  const hit = byPath.find(([p]) => path === p || path.startsWith(p + '/'));
  hit?.[1]().catch(() => undefined);
};

/** After the first screen is idle, warm every page so later taps feel instant. */
export const prefetchAll = () => {
  const run = () => { Object.values(loaders).forEach((l) => l().catch(() => undefined)); };
  const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, o?: { timeout: number }) => void);
  if (ric) ric(run, { timeout: 4000 }); else setTimeout(run, 2500);
};
