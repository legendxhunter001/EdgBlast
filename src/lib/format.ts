export const formatCurrency = (n: number | null | undefined, opts: { sign?: boolean } = {}) => {
  if (n === null || n === undefined || isNaN(Number(n))) return '—';
  const v = Number(n);
  const sign = opts.sign && v > 0 ? '+' : '';
  return sign + v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
};

export const formatPct = (n: number | null | undefined, opts: { sign?: boolean } = {}) => {
  if (n === null || n === undefined || isNaN(Number(n))) return '—';
  const v = Number(n);
  const sign = opts.sign && v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
};

export const formatNumber = (n: number | null | undefined, decimals = 2) => {
  if (n === null || n === undefined || isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: decimals });
};

export const pnlClass = (v: number | null | undefined) =>
  v === null || v === undefined || v === 0 ? 'text-foreground' : v > 0 ? 'text-bull' : 'text-bear';
