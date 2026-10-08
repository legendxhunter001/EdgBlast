import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTrades, type Trade } from '@/hooks/useTrades';
import { useCountUp } from '@/hooks/useCountUp';
import { useRiskRules } from '@/hooks/useRiskRules';
import { computeProfile } from '@/lib/traderProfile';
import { formatCurrency } from '@/lib/format';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { format, parseISO, isToday, isThisWeek, isThisMonth } from 'date-fns';
import { ArrowUpRight, ChevronRight, TrendingDown, TrendingUp, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { OnboardingDashboard } from '@/components/OnboardingDashboard';
import { SymbolLogo } from '@/components/SymbolLogo';
import { GreetingTitle, MotivationLine, NamePrompt } from '@/components/Greeting';

const ONBOARDING_KEY = 'eb-onboarding-skipped';
const SURFACE = 'bg-card border border-border rounded-[24px]';
const SHADOW = { boxShadow: 'var(--ios-sh, 0 1px 2px rgba(0,0,0,.05))' } as const;
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const BULL = 'hsl(var(--bull))', BEAR = 'hsl(var(--bear))';
const tone = (n: number) => (n >= 0 ? BULL : BEAR);
const money = (n: number) => formatCurrency(n, { sign: true });
const when = (t: Trade) => t.exit_at || t.entry_at || t.created_at;

const Dashboard = () => {
  const { data: trades, isLoading } = useTrades();
  const { rules } = useRiskRules();
  const [onboardingSkipped, setOnboardingSkipped] = useState(false);
  useEffect(() => { setOnboardingSkipped(localStorage.getItem(ONBOARDING_KEY) === '1'); }, []);

  const closed = useMemo(() => (trades ?? []).filter((t) => t.status === 'closed' && t.pnl !== null), [trades]);

  const S = useMemo(() => {
    const pnl = (t: Trade) => Number(t.pnl ?? 0);
    const wins = closed.filter((t) => pnl(t) > 0), losses = closed.filter((t) => pnl(t) < 0);
    const total = closed.reduce((s, t) => s + pnl(t), 0);
    const avgWin = wins.length ? wins.reduce((s, t) => s + pnl(t), 0) / wins.length : null;
    const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + pnl(t), 0) / losses.length) : null;
    const sum = (l: Trade[]) => l.reduce((s, t) => s + pnl(t), 0);
    const inPeriod = (fn: (d: Date) => boolean) => closed.filter((t) => fn(parseISO(when(t))));
    const today = inPeriod(isToday), week = inPeriod((d) => isThisWeek(d, { weekStartsOn: 1 })), month = inPeriod(isThisMonth);

    const sorted = [...closed].sort((a, b) => when(a).localeCompare(when(b)));
    let streak = 0, kind: 'win' | 'loss' | null = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const k = pnl(sorted[i]) > 0 ? 'win' : 'loss';
      if (kind === null) { kind = k; streak = 1; } else if (kind === k) streak++; else break;
    }
    let eq = 0;
    const curve = [{ date: 'Start', equity: 0 }, ...sorted.map((t) => { eq += pnl(t); return { date: format(parseISO(when(t)), 'MMM d'), equity: Math.round(eq * 100) / 100 }; })];
    const ranked = [...closed].sort((a, b) => pnl(b) - pnl(a));
    return {
      total, n: closed.length, winRate: closed.length ? (wins.length / closed.length) * 100 : null,
      payoff: avgWin !== null && avgLoss ? avgWin / avgLoss : null, streak, kind, curve,
      periods: [['Today', today], ['This week', week], ['This month', month]] as const,
      best: ranked.slice(0, 3).filter((t) => pnl(t) > 0), worst: ranked.slice(-3).reverse().filter((t) => pnl(t) < 0),
      sum,
    };
  }, [closed]);

  const profile = useMemo(() => computeProfile(closed, rules), [closed, rules]);
  const shown = useCountUp(S.n ? S.total : null);
  const recent = (trades ?? []).slice(0, 6);
  const color = tone(S.total);

  if (isLoading) {
    return (
      <div className="px-4 md:px-8 pt-4 pb-10 max-w-5xl mx-auto space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-[320px] rounded-[24px]" />
        <Skeleton className="h-[170px] rounded-[24px]" />
      </div>
    );
  }
  const empty = (trades ?? []).length === 0;

  return (
    <div className="px-4 md:px-8 pt-4 pb-10 max-w-5xl mx-auto">
      <NamePrompt />
      {empty && !onboardingSkipped ? (
        <OnboardingDashboard onSkip={() => { localStorage.setItem(ONBOARDING_KEY, '1'); setOnboardingSkipped(true); }} />
      ) : (
        <div className="space-y-4">
          <header className="flex items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-[34px] leading-[1.1] font-bold tracking-tight"><GreetingTitle /></h1>
              <p className="text-[14px] text-muted-foreground mt-1"><MotivationLine /></p>
            </div>
            <Link to="/trades/new" className={`${FOCUS} hidden md:inline-flex h-11 items-center gap-2 px-5 rounded-[14px] bg-primary text-primary-foreground text-[15px] font-semibold`}>
              <Plus className="size-4" /> Log a trade
            </Link>
          </header>

          {S.n === 0 ? (
            <div className={`${SURFACE} p-8 text-center`} style={SHADOW}>
              <div className="font-display text-[18px] font-bold">No closed trades yet</div>
              <p className="text-[14px] text-muted-foreground mt-1">Your open trades are in the journal. Once one closes, your numbers show up here.</p>
              <Link to="/trades" className={`${FOCUS} inline-flex mt-4 h-11 items-center px-5 rounded-[14px] bg-primary text-primary-foreground text-[15px] font-semibold`}>Open your journal</Link>
            </div>
          ) : (
            <>
              <div className={`${SURFACE} pt-5 overflow-hidden`} style={SHADOW}>
                <div className="px-5">
                  <div className="text-[13px] text-muted-foreground">Total result</div>
                  <div className="font-display text-[44px] leading-none font-bold tracking-tight tabular-nums mt-1" style={{ color }}>{money(shown)}</div>
                  <div className="text-[13px] text-muted-foreground mt-1.5">{S.n} closed trade{S.n === 1 ? '' : 's'}</div>
                </div>
                <div className="h-[170px] mt-2" role="img" aria-label="Running total of your closed trades">
                  <ResponsiveContainer>
                    <AreaChart data={S.curve} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="dashEq" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" style={{ stopColor: color }} stopOpacity={0.28} />
                          <stop offset="100%" style={{ stopColor: color }} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" hide />
                      <YAxis hide domain={['dataMin', 'dataMax']} />
                      <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                      <Tooltip cursor={{ stroke: 'hsl(var(--border))' }} content={({ active, payload, label }) => active && payload?.length ? (
                        <div className="rounded-2xl bg-card/95 backdrop-blur border border-border px-3 py-2 shadow-lg text-[13px]"><div className="text-[12px] text-muted-foreground">{label}</div><div className="font-semibold tabular-nums">{money(Number(payload[0].value))}</div></div>
                      ) : null} />
                      <Area type="monotone" dataKey="equity" stroke={color} strokeWidth={2.5} fill="url(#dashEq)" animationDuration={800} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-3 border-t border-border">
                  {[
                    ['Win rate', S.winRate === null ? '—' : `${S.winRate.toFixed(0)}%`],
                    ['Avg win vs loss', S.payoff === null ? '—' : `${S.payoff.toFixed(2)}x`],
                    ['Current run', S.kind ? `${S.streak} ${S.kind === 'win' ? 'won' : 'lost'}` : '—'],
                  ].map(([l, v], i) => (
                    <div key={l} className={`py-3.5 px-4 ${i ? 'border-l border-border' : ''}`}>
                      <div className="text-[12px] text-muted-foreground">{l}</div>
                      <div className="text-[18px] font-semibold tabular-nums">{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${SURFACE} px-4`} style={SHADOW}>
                {S.periods.map(([label, list]) => (
                  <div key={label} className="flex items-center justify-between py-3.5 border-t border-border first:border-t-0">
                    <div><div className="text-[15px]">{label}</div><div className="text-[12.5px] text-muted-foreground">{list.length} trade{list.length === 1 ? '' : 's'}</div></div>
                    <div className="text-[17px] font-semibold tabular-nums" style={list.length ? { color: tone(S.sum(list)) } : undefined}>{list.length ? money(S.sum(list)) : '—'}</div>
                  </div>
                ))}
              </div>

              <Link to="/reviews" className={`${FOCUS} ${SURFACE} flex items-center gap-4 p-4 active:scale-[.98] transition`} style={SHADOW}>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-muted-foreground">Review score</div>
                  {profile.overall !== null ? (
                    <>
                      <div className="font-display text-[26px] font-bold tabular-nums leading-tight">{Math.round(profile.overall)}<span className="text-[14px] font-medium text-muted-foreground"> out of 100</span></div>
                      <div className="text-[12.5px] text-muted-foreground">From {profile.measured} of 7 areas that have enough of your trades to measure.</div>
                    </>
                  ) : (
                    <div className="text-[14px] mt-0.5">Not enough recorded data to score yet. Open your review to see what's missing.</div>
                  )}
                </div>
                <ChevronRight className="size-[18px] text-muted-foreground shrink-0" aria-hidden />
              </Link>

              <div className="grid md:grid-cols-2 gap-4">
                {([['Best trades', S.best, 'No winning trades yet.'], ['Worst trades', S.worst, 'No losing trades yet.']] as const).map(([title, list, none]) => (
                  <section key={title}>
                    <h2 className="text-[13px] font-semibold text-muted-foreground px-1.5 pb-2">{title}</h2>
                    <div className={`${SURFACE} px-4`} style={SHADOW}>
                      {list.length === 0 && <div className="py-4 text-[14px] text-muted-foreground">{none}</div>}
                      {list.map((t) => <TradeRow key={t.id} t={t} />)}
                    </div>
                  </section>
                ))}
              </div>

              <section>
                <div className="flex items-end justify-between px-1.5 pb-2">
                  <h2 className="text-[13px] font-semibold text-muted-foreground">Recent trades</h2>
                  <Link to="/trades" className={`${FOCUS} text-[13px] font-semibold rounded inline-flex items-center gap-0.5`} style={{ color: 'hsl(var(--primary))' }}>See all <ArrowUpRight className="size-3.5" /></Link>
                </div>
                <div className={`${SURFACE} px-4`} style={SHADOW}>
                  {recent.map((t) => <TradeRow key={t.id} t={t} showSide />)}
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const TradeRow = ({ t, showSide }: { t: Trade; showSide?: boolean }) => (
  <Link to={`/trades/${t.id}`} className={`${FOCUS} flex items-center gap-3 py-3 border-t border-border first:border-t-0`}>
    <SymbolLogo symbol={t.asset} size={28} />
    <div className="flex-1 min-w-0">
      <div className="text-[15px] font-semibold">{t.asset}{showSide && <span className="font-normal text-muted-foreground"> {t.direction === 'short' ? 'Short' : 'Long'}</span>}</div>
      <div className="text-[12.5px] text-muted-foreground">{t.entry_at ? format(parseISO(t.entry_at), 'MMM d, yyyy') : 'No date'}{t.status !== 'closed' ? ' · open' : ''}</div>
    </div>
    <div className="text-[15px] font-semibold tabular-nums" style={t.pnl === null ? undefined : { color: tone(Number(t.pnl)) }}>{t.pnl === null ? '—' : money(Number(t.pnl))}</div>
  </Link>
);

export const DirectionBadge = ({ dir }: { dir: 'long' | 'short' }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${dir === 'long' ? 'bg-bull/15 text-bull' : 'bg-bear/15 text-bear'}`}>
    {dir === 'long' ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
    {dir === 'long' ? 'Long' : 'Short'}
  </span>
);

export default Dashboard;
