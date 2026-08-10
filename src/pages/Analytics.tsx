import { useMemo } from 'react';
import { useTrades } from '@/hooks/useTrades';
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, parseISO, getDay, differenceInMinutes } from 'date-fns';
import { formatCurrency } from '@/lib/format';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const Analytics = () => {
  const { data: trades } = useTrades();
  const closed = (trades ?? []).filter(t => t.status === 'closed' && t.pnl !== null);

  const byDow = useMemo(() => {
    const m = new Array(7).fill(0).map((_, i) => ({ day: DAYS[i], pnl: 0, count: 0 }));
    closed.forEach(t => {
      if (!t.exit_at) return;
      const d = getDay(parseISO(t.exit_at));
      m[d].pnl += Number(t.pnl ?? 0);
      m[d].count += 1;
    });
    return m;
  }, [closed]);

  const winLoss = useMemo(() => {
    const w = closed.filter(t => Number(t.pnl) > 0).length;
    const l = closed.filter(t => Number(t.pnl) < 0).length;
    const be = closed.filter(t => Number(t.pnl) === 0).length;
    return [
      { name: 'Wins', value: w, color: 'hsl(var(--bull))' },
      { name: 'Losses', value: l, color: 'hsl(var(--bear))' },
      { name: 'Breakeven', value: be, color: 'hsl(var(--muted-foreground))' },
    ];
  }, [closed]);

  const byEmotion = useMemo(() => {
    const m = new Map<string, { pnl: number; count: number }>();
    closed.forEach(t => {
      const k = t.emotional_state ?? 'unknown';
      const cur = m.get(k) ?? { pnl: 0, count: 0 };
      cur.pnl += Number(t.pnl ?? 0); cur.count += 1;
      m.set(k, cur);
    });
    return Array.from(m.entries()).map(([emotion, v]) => ({ emotion, pnl: v.pnl, avg: v.pnl / v.count, count: v.count }));
  }, [closed]);

  const avgHoldMin = useMemo(() => {
    const holds = closed.filter(t => t.entry_at && t.exit_at).map(t => differenceInMinutes(parseISO(t.exit_at!), parseISO(t.entry_at!)));
    if (!holds.length) return 0;
    return holds.reduce((a, b) => a + b, 0) / holds.length;
  }, [closed]);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Patterns, edges, and blind spots.</p>
      </header>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glass rounded-xl p-5 lg:col-span-2">
          <h3 className="font-display font-semibold mb-4">P&L by day of week</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={byDow}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                  {byDow.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? 'hsl(var(--bull))' : 'hsl(var(--bear))'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-xl p-5">
          <h3 className="font-display font-semibold mb-4">Win / Loss</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={winLoss} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {winLoss.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Metric label="Avg hold time" value={avgHoldMin >= 60 ? `${(avgHoldMin/60).toFixed(1)}h` : `${Math.round(avgHoldMin)}m`} />
        <Metric label="Best day" value={byDow.reduce((a, b) => a.pnl > b.pnl ? a : b).day} />
        <Metric label="Total trades" value={String(closed.length)} />
      </div>

      <div className="glass rounded-xl p-5">
        <h3 className="font-display font-semibold mb-4">Emotional correlation</h3>
        <div className="space-y-2">
          {byEmotion.length === 0 && <div className="text-sm text-muted-foreground">No data yet.</div>}
          {byEmotion.map(e => (
            <div key={e.emotion} className="flex items-center justify-between p-2 rounded hover:bg-secondary/40">
              <div className="capitalize text-sm">{e.emotion}</div>
              <div className="flex items-center gap-4 text-sm">
                <div className="text-muted-foreground text-xs">{e.count} trades</div>
                <div className={`font-mono font-semibold w-28 text-right ${e.pnl >= 0 ? 'text-bull' : 'text-bear'}`}>{formatCurrency(e.pnl, { sign: true })}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass rounded-xl p-5">
    <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="font-mono text-2xl font-semibold mt-2">{value}</div>
  </div>
);

export default Analytics;
