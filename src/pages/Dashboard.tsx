import { useMemo, useState, useEffect } from 'react';
import { useTrades, Trade } from '@/hooks/useTrades';
import { formatCurrency, pnlClass } from '@/lib/format';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Target, Activity, Trophy, AlertTriangle, ArrowUpRight, Flame, CalendarRange, CalendarDays, Sun, Brain, ShieldCheck } from 'lucide-react';
import { ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Area, AreaChart } from 'recharts';
import { format, parseISO, isToday, isThisWeek, isThisMonth } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { OnboardingDashboard } from '@/components/OnboardingDashboard';

const Stat = ({ label, value, sub, icon: Icon, glow }: { label: string; value: string; sub?: string; icon: any; glow?: 'bull' | 'bear' | 'accent' | 'gold' }) => (
  <div className="luxe-card card-hover p-5 relative overflow-hidden">
    {glow && <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-25 ${glow === 'bull' ? 'bg-bull' : glow === 'bear' ? 'bg-bear' : glow === 'gold' ? 'bg-gold' : 'bg-primary'}`} />}
    <div className="flex items-start justify-between relative">
      <div>
        <div className="text-caption text-muted-foreground">{label}</div>
        <div className="font-mono text-2xl font-semibold mt-2 tracking-tight">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </div>
      <div className="size-9 rounded-lg bg-secondary/60 flex items-center justify-center">
        <Icon className="size-4 text-muted-foreground" />
      </div>
    </div>
  </div>
);

const ONBOARDING_KEY = 'eb-onboarding-skipped';

const Dashboard = () => {
  const { data: trades, isLoading } = useTrades();
  const [onboardingSkipped, setOnboardingSkipped] = useState(false);

  useEffect(() => {
    setOnboardingSkipped(localStorage.getItem(ONBOARDING_KEY) === '1');
  }, []);

  const stats = useMemo(() => {
    const closed = (trades ?? []).filter(t => t.status === 'closed' && t.pnl !== null);
    const wins = closed.filter(t => (t.pnl ?? 0) > 0);
    const losses = closed.filter(t => (t.pnl ?? 0) < 0);
    const totalPnl = closed.reduce((s, t) => s + Number(t.pnl ?? 0), 0);
    const winRate = closed.length ? (wins.length / closed.length) * 100 : 0;
    const avgWin = wins.length ? wins.reduce((s, t) => s + Number(t.pnl ?? 0), 0) / wins.length : 0;
    const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + Number(t.pnl ?? 0), 0) / losses.length) : 0;
    const avgRR = avgLoss ? avgWin / avgLoss : 0;

    const refDate = (t: Trade) => t.exit_at || t.entry_at || t.created_at;
    const today = closed.filter(t => isToday(parseISO(refDate(t))));
    const week = closed.filter(t => isThisWeek(parseISO(refDate(t)), { weekStartsOn: 1 }));
    const month = closed.filter(t => isThisMonth(parseISO(refDate(t))));
    const sumPnl = (arr: Trade[]) => arr.reduce((s, t) => s + Number(t.pnl ?? 0), 0);

    const sorted = [...closed].sort((a, b) => (a.exit_at || a.created_at).localeCompare(b.exit_at || b.created_at));
    let streak = 0;
    let streakKind: 'win' | 'loss' | null = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const isWin = (sorted[i].pnl ?? 0) > 0;
      const k = isWin ? 'win' : 'loss';
      if (streakKind === null) { streakKind = k; streak = 1; }
      else if (streakKind === k) streak++;
      else break;
    }

    const confidences = closed.map(t => Number(t.confidence_rating ?? 0)).filter(v => v > 0);
    const psychology = confidences.length
      ? Math.round((confidences.reduce((s, v) => s + v, 0) / confidences.length) * 10)
      : 0;
    const reviewed = closed.filter(t => (t.review_score ?? 0) > 0).length;
    const discipline = closed.length ? Math.round((reviewed / closed.length) * 100) : 0;

    return {
      totalPnl, winRate, avgRR, totalTrades: closed.length, wins: wins.length, losses: losses.length,
      streak, streakKind,
      today: { pnl: sumPnl(today), count: today.length },
      week: { pnl: sumPnl(week), count: week.length },
      month: { pnl: sumPnl(month), count: month.length },
      psychology, discipline,
    };
  }, [trades]);

  const equityData = useMemo(() => {
    const closed = (trades ?? []).filter(t => t.status === 'closed' && t.pnl !== null && (t.exit_at || t.created_at));
    const sorted = [...closed].sort((a, b) => (a.exit_at || a.created_at).localeCompare(b.exit_at || b.created_at));
    let equity = 0;
    return sorted.map(t => {
      equity += Number(t.pnl ?? 0);
      return { date: format(parseISO(t.exit_at || t.created_at), 'MMM d'), equity: Number(equity.toFixed(2)) };
    });
  }, [trades]);

  const best = useMemo(() => [...(trades ?? [])].filter(t => t.pnl !== null).sort((a, b) => Number(b.pnl) - Number(a.pnl)).slice(0, 3), [trades]);
  const worst = useMemo(() => [...(trades ?? [])].filter(t => t.pnl !== null).sort((a, b) => Number(a.pnl) - Number(b.pnl)).slice(0, 3), [trades]);
  const recent = (trades ?? []).slice(0, 6);

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 space-y-6 max-w-[1400px] mx-auto">
        <div className="flex justify-between"><Skeleton className="h-10 w-48" /><Skeleton className="h-10 w-36 rounded-lg" /></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
          <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
          <div className="space-y-4">
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
          </div>
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const empty = (trades ?? []).length === 0;

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-[1400px] mx-auto">
      {empty && !onboardingSkipped ? (
        <OnboardingDashboard onSkip={() => {
          localStorage.setItem(ONBOARDING_KEY, '1');
          setOnboardingSkipped(true);
        }} />
      ) : (
        <>
          <header className="flex flex-wrap items-end justify-between gap-4 animate-fade-up">
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-1.5">Your performance at a glance.</p>
            </div>
            <Link to="/trades/new" className="press tap inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:opacity-95 transition-all">
              Log new trade <ArrowUpRight className="size-4" />
            </Link>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 animate-fade-up">
            <PeriodCard label="Today" pnl={stats.today.pnl} count={stats.today.count} icon={Sun} />
            <PeriodCard label="This week" pnl={stats.week.pnl} count={stats.week.count} icon={CalendarDays} />
            <PeriodCard label="This month" pnl={stats.month.pnl} count={stats.month.count} icon={CalendarRange} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div className="animate-fade-up stagger-1"><Stat label="Total P&L" value={formatCurrency(stats.totalPnl, { sign: true })} sub={`${stats.totalTrades} closed trades`} icon={stats.totalPnl >= 0 ? TrendingUp : TrendingDown} glow={stats.totalPnl >= 0 ? 'bull' : 'bear'} /></div>
            <div className="animate-fade-up stagger-2"><Stat label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} sub={`${stats.wins}W · ${stats.losses}L`} icon={Target} glow="accent" /></div>
            <div className="animate-fade-up stagger-3"><Stat label="Avg R:R" value={stats.avgRR ? stats.avgRR.toFixed(2) : '—'} sub="Win/loss ratio" icon={Activity} /></div>
            <div className="animate-fade-up stagger-4"><Stat label="Current Streak" value={`${stats.streak}${stats.streakKind === 'win' ? 'W' : stats.streakKind === 'loss' ? 'L' : ''}`} sub={stats.streakKind === 'win' ? 'On a roll' : stats.streakKind === 'loss' ? 'Stay disciplined' : '—'} icon={Flame} glow={stats.streakKind === 'win' ? 'bull' : stats.streakKind === 'loss' ? 'bear' : undefined} /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 animate-fade-up">
            <ScoreCard label="Psychology score" value={stats.psychology} icon={Brain} hint="Avg confidence across logged trades" />
            <ScoreCard label="Discipline score" value={stats.discipline} icon={ShieldCheck} hint="% of trades you've reviewed" />
          </div>

          <div className="grid lg:grid-cols-3 gap-4 md:gap-6 animate-fade-up">
            <div className="luxe-card p-5 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display font-semibold">Equity curve</h3>
                  <p className="text-xs text-muted-foreground">Cumulative P&L over time</p>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityData} margin={{ left: -10, right: 8, top: 8 }}>
                    <defs>
                      <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--bull))" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(var(--bull))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} strokeOpacity={0.5} />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12, boxShadow: 'var(--shadow-elevated)' }} cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Area type="monotone" dataKey="equity" stroke="hsl(var(--bull))" strokeWidth={2.5} fill="url(#eq)" animationDuration={800} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-6">
              <TopList title="Best trades" icon={Trophy} trades={best} kind="bull" />
              <TopList title="Worst trades" icon={AlertTriangle} trades={worst} kind="bear" />
            </div>
          </div>

          <div className="luxe-card p-5 animate-fade-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold">Recent trades</h3>
              <Link to="/trades" className="text-xs text-primary hover:underline">View all →</Link>
            </div>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2.5 font-medium">Asset</th>
                    <th className="font-medium">Side</th>
                    <th className="font-medium">Date</th>
                    <th className="font-medium text-right">P&L</th>
                    <th className="font-medium text-right">R:R</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map(t => (
                    <tr key={t.id} className="border-b border-border/40 last:border-0 hover:bg-secondary/40 transition">
                      <td className="py-3"><Link to={`/trades/${t.id}`} className="font-medium hover:text-primary">{t.asset}</Link></td>
                      <td><DirectionBadge dir={t.direction} /></td>
                      <td className="text-muted-foreground">{t.entry_at ? format(parseISO(t.entry_at), 'MMM d, yyyy') : '—'}</td>
                      <td className={`text-right font-mono ${pnlClass(t.pnl)}`}>{formatCurrency(t.pnl, { sign: true })}</td>
                      <td className="text-right font-mono text-muted-foreground">{t.risk_reward ? `${Number(t.risk_reward).toFixed(2)}R` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const TopList = ({ title, icon: Icon, trades, kind }: { title: string; icon: any; trades: Trade[]; kind: 'bull' | 'bear' }) => (
  <div className="luxe-card card-hover p-5">
    <div className="flex items-center gap-2 mb-3">
      <Icon className={`size-4 ${kind === 'bull' ? 'text-bull' : 'text-bear'}`} />
      <h3 className="font-display font-semibold text-sm">{title}</h3>
    </div>
    <div className="space-y-2">
      {trades.length === 0 && <div className="text-xs text-muted-foreground">No data yet</div>}
      {trades.map(t => (
        <Link key={t.id} to={`/trades/${t.id}`} className="flex items-center justify-between p-2 rounded-md hover:bg-secondary/50 transition">
          <div>
            <div className="text-sm font-medium">{t.asset}</div>
            <div className="text-[10px] text-muted-foreground">{t.entry_at ? format(parseISO(t.entry_at), 'MMM d') : '—'}</div>
          </div>
          <div className={`font-mono text-sm ${pnlClass(t.pnl)}`}>{formatCurrency(t.pnl, { sign: true })}</div>
        </Link>
      ))}
    </div>
  </div>
);

const PeriodCard = ({ label, pnl, count, icon: Icon }: { label: string; pnl: number; count: number; icon: any }) => (
  <div className="luxe-card card-hover p-5 flex items-center gap-4">
    <div className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${pnl > 0 ? 'bg-bull/10 text-bull' : pnl < 0 ? 'bg-bear/10 text-bear' : 'bg-secondary text-muted-foreground'}`}>
      <Icon className="size-5" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono text-xl md:text-2xl font-semibold tracking-tight mt-0.5 ${pnlClass(pnl)}`}>
        {count === 0 ? '—' : formatCurrency(pnl, { sign: true })}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">{count} trade{count === 1 ? '' : 's'}</div>
    </div>
  </div>
);

const ScoreCard = ({ label, value, icon: Icon, hint }: { label: string; value: number; icon: any; hint: string }) => {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="luxe-card card-hover p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="size-4 text-primary" />
          </div>
          <div className="text-sm font-semibold">{label}</div>
        </div>
        <div className="font-mono text-lg font-semibold">{value}<span className="text-xs text-muted-foreground">/100</span></div>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-muted-foreground mt-2">{hint}</div>
    </div>
  );
};

export const DirectionBadge = ({ dir }: { dir: 'long' | 'short' }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${dir === 'long' ? 'bg-bull/15 text-bull' : 'bg-bear/15 text-bear'}`}>
    {dir === 'long' ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
    {dir}
  </span>
);

export default Dashboard;
