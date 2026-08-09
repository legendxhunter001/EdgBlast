import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import {
  ArrowRight, Brain, Calendar as CalIcon, LineChart, Sparkles, Shield,
  Check, BarChart3, Camera, Zap, Cpu,
  Gauge as GaugeIcon, MessageSquare, Layers, RefreshCw, ChevronRight,
} from 'lucide-react';

const useMouseParallax = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--mx', x.toFixed(3));
      el.style.setProperty('--my', y.toFixed(3));
    };
    const onLeave = () => {
      el.style.setProperty('--mx', '0');
      el.style.setProperty('--my', '0');
    };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, []);
  return ref;
};

const useInView = <T extends HTMLElement>(rootMargin = '-10% 0px') => {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && setInView(true),
      { rootMargin, threshold: 0.15 },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [rootMargin]);
  return { ref, inView };
};

const CountUp = ({
  to, prefix = '', suffix = '', decimals = 0, duration = 1400,
}: { to: number; prefix?: string; suffix?: string; decimals?: number; duration?: number }) => {
  const { ref, inView } = useInView<HTMLSpanElement>();
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);
  return (
    <span ref={ref}>
      {prefix}{val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </span>
  );
};

const useLivePath = (points = 48, speed = 2400) => {
  const [data, setData] = useState<number[]>(() => {
    const arr: number[] = [];
    let v = 50;
    for (let i = 0; i < points; i++) {
      v += (Math.random() - 0.35) * 6;
      arr.push(v);
    }
    return arr;
  });
  useEffect(() => {
    const id = setInterval(() => {
      setData((prev) => {
        const next = prev.slice(1);
        const last = prev[prev.length - 1];
        next.push(Math.max(10, Math.min(140, last + (Math.random() - 0.35) * 8)));
        return next;
      });
    }, speed);
    return () => clearInterval(id);
  }, [speed]);
  return data;
};

const EquityChart = ({ height = 120 }: { height?: number }) => {
  const data = useLivePath(56, 1800);
  const w = 320;
  const h = height;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(1, max - min);
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d - min) / range) * (h - 10) - 4;
    return [x, y] as const;
  });
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--bull))" stopOpacity="0.35" />
          <stop offset="100%" stopColor="hsl(var(--bull))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#eqFill)" style={{ transition: 'd 1.6s ease' }} />
      <path d={line} fill="none" stroke="hsl(var(--bull))" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'd 1.6s ease' }} />
    </svg>
  );
};

const MiniBars = ({ n = 12 }: { n?: number }) => {
  const [vals, setVals] = useState<number[]>(() => Array.from({ length: n }, () => 20 + Math.random() * 70));
  useEffect(() => {
    const id = setInterval(() => {
      setVals((p) => p.map((v) => Math.max(15, Math.min(90, v + (Math.random() - 0.5) * 22))));
    }, 2200);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-end gap-[3px] h-16">
      {vals.map((v, i) => (
        <div key={i} className="flex-1 rounded-sm eb-bar" style={{ height: `${v}%`, background: i % 3 === 0 ? 'hsl(var(--bear) / 0.6)' : 'hsl(var(--bull) / 0.8)' }} />
      ))}
    </div>
  );
};

const Gauge = ({ value, label, hue }: { value: number; label: string; hue: string }) => {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1200);
      setV(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);
  const r = 26;
  const c = 2 * Math.PI * r;
  const dash = c * (v / 100);
  return (
    <div ref={ref} className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="4" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={hue} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`} style={{ transition: 'stroke-dasharray 200ms linear' }} />
      </svg>
      <div className="text-center leading-tight">
        <div className="text-sm font-semibold tabular tracking-tight">{Math.round(v)}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </div>
    </div>
  );
};

const Typewriter = ({ text, speed = 22 }: { text: string; speed?: number }) => {
  const { ref, inView } = useInView<HTMLParagraphElement>();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    setN(0);
    const id = setInterval(() => setN((v) => (v >= text.length ? v : v + 1)), speed);
    return () => clearInterval(id);
  }, [inView, text, speed]);
  return (
    <p ref={ref} className="text-sm leading-relaxed text-foreground/85">
      {text.slice(0, n)}
      <span className="inline-block w-[6px] h-[14px] align-[-2px] ml-[2px] bg-primary/80 animate-pulse" />
    </p>
  );
};

const CalendarMock = () => {
  const days = useMemo(() => {
    const arr: { d: number; pnl: number }[] = [];
    for (let i = 1; i <= 30; i++) {
      const r = Math.random();
      const pnl = r < 0.25 ? -(50 + Math.random() * 400) : r < 0.85 ? 50 + Math.random() * 600 : 0;
      arr.push({ d: i, pnl });
    }
    return arr;
  }, []);
  const total = days.reduce((s, d) => s + d.pnl, 0);
  return (
    <div className="w-full">
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const win = d.pnl > 0;
          const loss = d.pnl < 0;
          const intensity = Math.min(1, Math.abs(d.pnl) / 500);
          const bg = loss
            ? `hsl(0 30% ${65 - intensity * 20}% / ${0.35 + intensity * 0.5})`
            : win
            ? `hsl(217 36% ${63 - intensity * 15}% / ${0.35 + intensity * 0.55})`
            : 'hsl(var(--muted) / 0.4)';
          return (
            <div key={d.d}
              className="aspect-square rounded-md text-[10px] flex items-start justify-start p-1 font-mono text-foreground/80 eb-cal-cell"
              style={{ background: bg }}>
              {d.d}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>January</span>
        <span className="tabular font-semibold text-foreground">
          {total >= 0 ? '+' : '-'}${Math.abs(total).toFixed(0)}
        </span>
      </div>
    </div>
  );
};

const SYNC_STEPS = [
  { icon: Zap, label: 'Trade closes in MT5' },
  { icon: RefreshCw, label: 'Sync relays instantly' },
  { icon: Layers, label: 'Journal writes trade' },
  { icon: BarChart3, label: 'Analytics recalculate' },
  { icon: CalIcon, label: 'Calendar updates' },
  { icon: Brain, label: 'AI coach reviews' },
];

const SyncLoop = () => {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % SYNC_STEPS.length), 1400);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex flex-col gap-2">
      {SYNC_STEPS.map((s, idx) => {
        const active = idx === i;
        const done = idx < i;
        const Icon = s.icon;
        return (
          <div key={idx}
            className="flex items-center gap-3 px-3 py-2 rounded-lg border transition-all duration-500"
            style={{
              borderColor: active ? 'hsl(var(--primary) / 0.6)' : 'hsl(var(--border))',
              background: active ? 'hsl(var(--primary) / 0.08)' : 'transparent',
              transform: active ? 'translateX(4px)' : 'translateX(0)',
            }}>
            <div className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{
                background: active ? 'hsl(var(--primary))' : done ? 'hsl(var(--primary) / 0.2)' : 'hsl(var(--muted))',
                color: active ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
              }}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-medium">{s.label}</span>
            {active && <span className="ml-auto text-[10px] uppercase tracking-wider text-primary">running</span>}
          </div>
        );
      })}
    </div>
  );
};

const CandleChart = () => {
  const candles = useMemo(() => {
    const arr: { o: number; c: number; h: number; l: number }[] = [];
    let last = 50;
    for (let i = 0; i < 42; i++) {
      const o = last;
      const c = o + (Math.random() - 0.45) * 8;
      const h = Math.max(o, c) + Math.random() * 3;
      const l = Math.min(o, c) - Math.random() * 3;
      arr.push({ o, c, h, l });
      last = c;
    }
    return arr;
  }, []);
  const all = candles.flatMap((c) => [c.h, c.l]);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const w = 420, hgt = 200;
  const cw = w / candles.length;
  const y = (v: number) => hgt - ((v - min) / (max - min)) * (hgt - 20) - 10;
  return (
    <svg viewBox={`0 0 ${w} ${hgt}`} className="w-full h-full">
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1="0" x2={w} y1={hgt * g} y2={hgt * g} stroke="hsl(var(--border))" strokeDasharray="2 4" strokeWidth="0.5" />
      ))}
      {candles.map((cd, i) => {
        const up = cd.c >= cd.o;
        const color = up ? 'hsl(var(--bull))' : 'hsl(var(--bear))';
        const x = i * cw + cw / 2;
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={y(cd.h)} y2={y(cd.l)} stroke={color} strokeWidth="1" />
            <rect x={i * cw + 1.5} width={cw - 3} y={y(Math.max(cd.o, cd.c))} height={Math.max(1, Math.abs(y(cd.o) - y(cd.c)))} fill={color} />
          </g>
        );
      })}
      <rect x="0" y={y(min + (max - min) * 0.28)} width={w} height="16" fill="hsl(var(--bull) / 0.10)" />
      <rect x="0" y={y(min + (max - min) * 0.72)} width={w} height="16" fill="hsl(var(--bear) / 0.10)" />
    </svg>
  );
};

const Landing = () => {
  const heroRef = useMouseParallax();

  return (
    <div className="eb-landing min-h-screen relative overflow-x-hidden">
      <ScopedStyles />

      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="eb-bg-grad" />
        <div className="eb-bg-grid" />
        <div className="eb-blob eb-blob-a" />
        <div className="eb-blob eb-blob-b" />
        <div className="eb-blob eb-blob-c" />
      </div>

      <nav className="sticky top-0 z-50 border-b border-white/[0.06] backdrop-blur-xl bg-[hsl(210_20%_6%/0.7)]">
        <div className="max-w-[1240px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <span className="font-semibold tracking-tight text-[15px]">Edge<span className="text-primary">Blast</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-foreground/70">
            <a href="#platform" className="hover:text-foreground transition">Platform</a>
            <a href="#coach" className="hover:text-foreground transition">AI Coach</a>
            <a href="#sync" className="hover:text-foreground transition">MT5 Sync</a>
            <a href="#psychology" className="hover:text-foreground transition">Psychology</a>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost" size="sm">Sign In</Button></Link>
            <Link to="/auth"><Button size="sm" className="eb-btn-primary">Get Started</Button></Link>
          </div>
        </div>
      </nav>

      <section className="max-w-[1240px] mx-auto px-6 pt-16 md:pt-24 pb-24">
        <div className="grid lg:grid-cols-[1.05fr_1.15fr] gap-14 items-center">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 border border-white/10 rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.15em] text-primary font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              MT5 auto-sync · live
            </div>
            <h1 className="mt-6 font-display text-[clamp(2.5rem,5.6vw,4.75rem)] leading-[1.02] tracking-tight">
              The operating system<br />for professional traders.
            </h1>
            <p className="mt-6 text-lg text-foreground/70 max-w-xl leading-relaxed">
              Every trade auto-synced from MT5. Reviewed against your rules. Reflected on by an AI coach that never forgets. Edge Blast turns discipline into evidence.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link to="/auth"><Button size="lg" className="eb-btn-primary h-12 px-7">Start free <ArrowRight className="w-4 h-4" /></Button></Link>
              <a href="#platform" className="text-sm text-foreground/70 hover:text-foreground transition inline-flex items-center gap-1">
                See the platform <ChevronRight className="w-4 h-4" />
              </a>
            </div>
            <div className="mt-10 flex items-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-primary" /> No card required</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-primary" /> MT4 · MT5 ready</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-primary" /> Encrypted</span>
            </div>
          </div>

          <div ref={heroRef} className="eb-hero-stage animate-fade-up" style={{ animationDelay: '120ms' }}>
            <div className="eb-hero-glow" />
            <div className="eb-hero-scene">
              <div className="eb-dash-main">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Portfolio</div>
                    <div className="font-display text-2xl mt-0.5">
                      $<CountUp to={128450} />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Today</div>
                    <div className="font-mono text-primary text-lg">+<CountUp to={2384} prefix="$" /></div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <MiniKpi label="Win rate" value="62%" tone="pos" />
                  <MiniKpi label="Avg RR" value="2.34R" tone="neu" />
                  <MiniKpi label="Trades" value="384" tone="neu" />
                  <MiniKpi label="Discipline" value="94" tone="pos" />
                </div>
                <div className="h-[140px] rounded-lg border border-white/[0.06] bg-black/20 p-2">
                  <EquityChart height={124} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Sessions</div>
                    <MiniBars n={10} />
                  </div>
                  <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2 flex flex-col justify-between">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Strategy</div>
                    <div className="text-xs font-medium">London Reversal</div>
                    <div className="flex items-end gap-1">
                      <span className="font-mono text-primary text-lg leading-none">+18.4%</span>
                      <span className="text-[10px] text-muted-foreground pb-0.5">30d</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="eb-float eb-f-ticket">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">GBP/USD</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[hsl(40_55%_55%/0.2)] text-[hsl(40_55%_60%)]">SELL</span>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-primary">
                    <span className="w-1 h-1 rounded-full bg-primary" /> synced
                  </span>
                </div>
                <div className="space-y-1 font-mono text-[11px]">
                  <Row k="Entry" v="1.27450" />
                  <Row k="Stop" v="1.27890" tone="warn" />
                  <Row k="Target" v="1.26440" tone="pos" />
                </div>
                <div className="mt-2 pt-2 border-t border-white/10 flex items-baseline gap-2">
                  <span className="font-mono text-primary text-xl">2.3R</span>
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground">reward : risk</span>
                </div>
              </div>

              <div className="eb-float eb-f-ai eb-ai-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center bg-primary/20 text-primary">
                    <Brain className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold">Claude · Weekly Review</span>
                </div>
                <Typewriter text="Excellent discipline this week. You respected risk on 96% of trades. London session outperforming NY." />
                <div className="mt-2 text-[10px] text-muted-foreground">Confidence 94%</div>
              </div>

              <div className="eb-float eb-f-gauges">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Psychology</div>
                <div className="grid grid-cols-3 gap-2">
                  <Gauge value={82} label="Discipline" hue="hsl(var(--primary))" />
                  <Gauge value={71} label="Patience" hue="hsl(217 36% 63%)" />
                  <Gauge value={64} label="Confidence" hue="hsl(var(--bull))" />
                </div>
              </div>

              <div className="eb-float eb-f-cal">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Journal</span>
                  <span className="text-[10px] font-mono text-primary">Jan · +$4,820</span>
                </div>
                <div className="grid grid-cols-7 gap-[3px]">
                  {Array.from({ length: 28 }).map((_, i) => {
                    const r = ((i * 37) % 100) / 100;
                    const win = r > 0.35;
                    const bg = r < 0.15 ? 'hsl(var(--muted) / 0.4)' : win
                      ? `hsl(217 36% 63% / ${0.35 + r * 0.5})`
                      : `hsl(0 30% 65% / ${0.35 + (1 - r) * 0.4})`;
                    return <div key={i} className="aspect-square rounded-sm" style={{ background: bg }} />;
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.06] bg-black/20">
        <div className="max-w-[1240px] mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          <StatBig label="Trades journaled" to={182400} suffix="+" />
          <StatBig label="Avg win rate lift" to={14} suffix="%" />
          <StatBig label="Auto-sync latency" to={0.8} decimals={1} suffix="s" />
          <StatBig label="Trader hours saved" to={26800} suffix="+" />
        </div>
      </section>

      <section id="platform" className="max-w-[1240px] mx-auto px-6 py-28">
        <SectionHead
          eyebrow="The platform"
          title="Everything a serious trader tracks, in one workspace."
          sub="Nine modules, one coherent system. Built for repetition — the kind that turns effort into edge."
        />
        <div className="grid md:grid-cols-3 gap-5 mt-14">
          <FeatureCard icon={LineChart} title="Performance analytics" desc="Equity curve, RR, expectancy, drawdown — recalculated on every close.">
            <div className="h-24 mt-4"><EquityChart height={96} /></div>
          </FeatureCard>
          <FeatureCard icon={CalIcon} title="Trading calendar" desc="See discipline as heatmap. Winning days blue, losing days rose.">
            <div className="mt-4"><CalendarMock /></div>
          </FeatureCard>
          <FeatureCard icon={Brain} title="AI trade coach" desc="Weekly reviews and pattern detection with memory of every trade.">
            <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/20 p-3">
              <Typewriter text="Your patience improved 18% over the last 43 trades." speed={26} />
            </div>
          </FeatureCard>
          <FeatureCard icon={GaugeIcon} title="Psychology tracking" desc="Discipline, patience, confidence — measured, not guessed.">
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Gauge value={78} label="Discipline" hue="hsl(var(--primary))" />
              <Gauge value={66} label="Patience" hue="hsl(217 36% 63%)" />
              <Gauge value={83} label="Focus" hue="hsl(var(--bull))" />
            </div>
          </FeatureCard>
          <FeatureCard icon={Camera} title="Screenshot journal" desc="Entry, exit, analysis — three shots per trade, exactly.">
            <ScreenshotSlots />
          </FeatureCard>
          <FeatureCard icon={Shield} title="Risk management" desc="Rule violations flagged instantly. No trade slips past standard.">
            <div className="mt-4 space-y-1.5 text-xs">
              <RuleRow k="Max risk" v="0.60%" ok />
              <RuleRow k="Min R:R" v="2.0R" ok />
              <RuleRow k="Confirmation" v="4H close" ok />
              <RuleRow k="Position size" v="+38%" ok={false} />
            </div>
          </FeatureCard>
        </div>
      </section>

      <section id="sync" className="border-t border-white/[0.06] bg-black/20">
        <div className="max-w-[1240px] mx-auto px-6 py-28 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <SectionHead
              eyebrow="MT5 auto-sync"
              title="Trades log themselves. You stay in the flow."
              sub="Sync fires the instant a position closes. The trade lands in your journal, analytics recompute, the calendar fills in, and your AI coach reviews it — all before you switch tabs."
              align="left"
            />
            <div className="mt-8 flex flex-wrap gap-3">
              <Pill icon={Zap}>Instant relay</Pill>
              <Pill icon={Shield}>Account-scoped</Pill>
              <Pill icon={Cpu}>Zero manual entry</Pill>
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[hsl(210_20%_10%/0.6)] backdrop-blur-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Sync pipeline</span>
              <span className="flex items-center gap-1.5 text-xs text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> live
              </span>
            </div>
            <SyncLoop />
          </div>
        </div>
      </section>

      <section className="max-w-[1240px] mx-auto px-6 py-28">
        <SectionHead
          eyebrow="Chart workspace"
          title="TradingView-grade chart, journal-native."
          sub="Analyze with the tools you already know. One click snapshots the setup straight into the trade."
        />
        <div className="mt-14 rounded-2xl border border-white/[0.08] bg-[hsl(210_20%_10%/0.7)] overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-black/30">
            <div className="flex items-center gap-3 text-xs">
              <span className="font-semibold">EURUSD</span>
              <span className="text-muted-foreground">1H</span>
              <span className="text-primary tabular">1.08421</span>
              <span className="text-[hsl(var(--bull))] tabular">+0.24%</span>
            </div>
            <div className="flex items-center gap-2">
              {['1m','5m','15m','1H','4H','1D'].map((t) => (
                <button key={t} className={`text-[11px] px-2 py-0.5 rounded ${t==='1H' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>{t}</button>
              ))}
              <div className="w-px h-4 bg-white/10 mx-1" />
              <button className="text-xs flex items-center gap-1 text-primary"><Camera className="w-3.5 h-3.5" /> Snap</button>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_180px]">
            <div className="p-4 h-[260px]"><CandleChart /></div>
            <div className="border-l border-white/[0.06] p-3 space-y-1.5 text-xs">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Watchlist</div>
              {[
                ['EURUSD','1.0842','+0.24%',true],
                ['GBPUSD','1.2745','-0.12%',false],
                ['XAUUSD','2384.2','+0.68%',true],
                ['USDJPY','156.14','-0.31%',false],
                ['BTCUSD','67,240','+1.42%',true],
              ].map(([s,,c,up]) => (
                <div key={s as string} className="flex items-center justify-between font-mono">
                  <span>{s}</span>
                  <span className={up ? 'text-[hsl(var(--bull))]' : 'text-[hsl(var(--bear))]'}>{c}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="psychology" className="border-t border-white/[0.06] bg-black/20">
        <div className="max-w-[1240px] mx-auto px-6 py-28 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <SectionHead
              eyebrow="Trader psychology"
              title="Measure the mind behind the P&L."
              sub="Fear, greed, patience, discipline — rated after every session. Over time the pattern becomes impossible to hide from."
              align="left"
            />
            <div className="mt-8 grid grid-cols-3 gap-4 max-w-md">
              <Gauge value={78} label="Discipline" hue="hsl(var(--primary))" />
              <Gauge value={62} label="Patience" hue="hsl(217 36% 63%)" />
              <Gauge value={71} label="Focus" hue="hsl(var(--bull))" />
              <Gauge value={44} label="Fear" hue="hsl(var(--bear))" />
              <Gauge value={38} label="Greed" hue="hsl(40 55% 55%)" />
              <Gauge value={84} label="Consistency" hue="hsl(var(--primary))" />
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[hsl(210_20%_10%/0.6)] backdrop-blur-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-md flex items-center justify-center bg-primary/20 text-primary">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Session reflection</div>
                <div className="text-[11px] text-muted-foreground">Auto-prompted after every close</div>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { q: 'How present were you during entry?', v: 8 },
                { q: 'Did you honor your stop?', v: 10 },
                { q: 'Was size within plan?', v: 6 },
                { q: 'Emotional state 1-10', v: 7 },
              ].map((r) => (
                <div key={r.q}>
                  <div className="flex justify-between text-xs mb-1"><span className="text-foreground/80">{r.q}</span><span className="text-primary font-mono">{r.v}</span></div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full bg-primary eb-fill" style={{ width: `${r.v * 10}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="coach" className="max-w-[1240px] mx-auto px-6 py-28">
        <SectionHead
          eyebrow="AI memory"
          title="Your trading coach never forgets."
          sub="Every trade, every reflection, every rule — the coach carries context forward. Insights compound the way your account should."
        />
        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            'Over your last 43 trades, patience improved 18%.',
            'You perform 27% better during the London session.',
            'Average R:R climbed from 1.8R to 2.3R this quarter.',
            'Most losing trades follow two consecutive wins — size creep detected.',
            'Your best setup is the 4H engulfing reversal (68% win rate).',
            'Discipline drops after 3 losing trades in a row — consider a hard stop.',
            'Fridays account for 41% of your rule violations.',
            'Trades taken within 15m of your plan outperform by 1.4R.',
          ].map((m, i) => (
            <div key={i} className="eb-memory-card p-5 rounded-xl border border-white/[0.08] bg-[hsl(210_20%_10%/0.55)] backdrop-blur-xl"
              style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary mb-2">
                <Sparkles className="w-3 h-3" /> insight
              </div>
              <p className="text-sm text-foreground/85 leading-relaxed">{m}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-white/[0.06] bg-black/20">
        <div className="max-w-[1240px] mx-auto px-6 py-20">
          <div className="text-center mb-10">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Works with the tools you already use</div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 opacity-80">
            {['MT4','MT5','TradingView','Google','Claude AI','Supabase'].map((b) => (
              <span key={b} className="text-lg font-semibold tracking-tight text-foreground/60 hover:text-foreground transition">{b}</span>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-3">
            {[
              'Automatic trade import','AI coaching','Psychology tracking',
              'Performance analytics','Screenshot journal','Rule enforcement',
            ].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-white/[0.08] bg-black/20">
                <Check className="w-3.5 h-3.5 text-primary" /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-[1240px] mx-auto px-6 py-28 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display text-4xl md:text-5xl tracking-tight leading-tight">
            Stop reconstructing trades from memory.
          </h2>
          <p className="mt-5 text-foreground/70 text-lg">
            Set up in under two minutes. Your next closed trade will be logged, reviewed, and remembered — automatically.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/auth"><Button size="lg" className="eb-btn-primary h-12 px-8">Get started free <ArrowRight className="w-4 h-4" /></Button></Link>
            <Link to="/auth"><Button size="lg" variant="outline" className="h-12 px-6">Sign in</Button></Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] py-8">
        <div className="max-w-[1240px] mx-auto px-6 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <BrandMark small />
            <span>Edge Blast — built for traders who track everything.</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#" className="hover:text-foreground transition">Privacy</a>
            <a href="#" className="hover:text-foreground transition">Terms</a>
            <a href="#" className="hover:text-foreground transition">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

const BrandMark = ({ small = false }: { small?: boolean }) => (
  <svg viewBox="0 0 512 512" width={small ? 18 : 26} height={small ? 18 : 26} aria-hidden>
    <defs>
      <linearGradient id="ebMark" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0%" stopColor="hsl(var(--primary))" />
        <stop offset="100%" stopColor="hsl(217 36% 63%)" />
      </linearGradient>
    </defs>
    <rect x="132" y="96" width="54" height="320" rx="10" fill="url(#ebMark)" />
    <polygon points="132,96 391,125 132,154" fill="url(#ebMark)" />
    <polygon points="132,227 351,256 132,285" fill="url(#ebMark)" />
    <polygon points="132,358 316,387 132,416" fill="url(#ebMark)" />
  </svg>
);

const Row = ({ k, v, tone }: { k: string; v: string; tone?: 'pos' | 'warn' }) => (
  <div className="flex justify-between">
    <span className="text-muted-foreground">{k}</span>
    <span className={tone === 'pos' ? 'text-[hsl(var(--bull))]' : tone === 'warn' ? 'text-[hsl(40_55%_60%)]' : ''}>{v}</span>
  </div>
);

const MiniKpi = ({ label, value, tone }: { label: string; value: string; tone?: 'pos' | 'neu' }) => (
  <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2">
    <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
    <div className={`text-sm font-mono mt-0.5 ${tone === 'pos' ? 'text-primary' : ''}`}>{value}</div>
  </div>
);

const StatBig = ({ label, to, suffix, decimals }: { label: string; to: number; suffix?: string; decimals?: number }) => (
  <div>
    <div className="font-display text-3xl md:text-4xl tracking-tight">
      <CountUp to={to} suffix={suffix} decimals={decimals} />
    </div>
    <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{label}</div>
  </div>
);

const SectionHead = ({
  eyebrow, title, sub, align = 'center',
}: { eyebrow: string; title: string; sub: string; align?: 'center' | 'left' }) => (
  <div className={align === 'center' ? 'text-center max-w-2xl mx-auto' : 'max-w-xl'}>
    <div className="text-[11px] uppercase tracking-[0.18em] text-primary font-mono mb-3">{eyebrow}</div>
    <h2 className="font-display text-3xl md:text-[2.75rem] leading-[1.08] tracking-tight">{title}</h2>
    <p className="mt-4 text-foreground/70 leading-relaxed">{sub}</p>
  </div>
);

const FeatureCard = ({
  icon: Icon, title, desc, children,
}: { icon: any; title: string; desc: string; children?: React.ReactNode }) => (
  <div className="eb-feature-card group p-6 rounded-2xl border border-white/[0.08] bg-[hsl(210_20%_10%/0.55)] backdrop-blur-xl">
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/15 text-primary group-hover:bg-primary/25 transition">
        <Icon className="w-4.5 h-4.5" />
      </div>
      <h3 className="font-semibold tracking-tight">{title}</h3>
    </div>
    <p className="mt-3 text-sm text-foreground/70 leading-relaxed">{desc}</p>
    {children}
  </div>
);

const Pill = ({ icon: Icon, children }: { icon: any; children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-white/[0.08] bg-black/20">
    <Icon className="w-3.5 h-3.5 text-primary" /> {children}
  </span>
);

const RuleRow = ({ k, v, ok }: { k: string; v: string; ok: boolean }) => (
  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md border border-white/[0.06] bg-black/20">
    <span className="text-muted-foreground">{k}</span>
    <span className={`font-mono ${ok ? 'text-primary' : 'text-[hsl(var(--bear))]'}`}>{ok ? '✓ ' : '✗ '}{v}</span>
  </div>
);

const ScreenshotSlots = () => (
  <div className="mt-4 grid grid-cols-3 gap-2">
    {['Entry','Exit','Analysis'].map((l) => (
      <div key={l} className="aspect-[4/3] rounded-lg border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent flex flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground">
        <Camera className="w-4 h-4 text-primary/70" />
        <span className="uppercase tracking-wider">{l}</span>
      </div>
    ))}
  </div>
);

const ScopedStyles = () => (
  <style>{`
    .eb-landing {
  color-scheme: dark;
  --background: 210 12% 9%;
  --foreground: 204 15% 94%;
  --card: 213 12% 17%;
  --card-foreground: 204 15% 94%;
  --popover: 213 12% 17%;
  --popover-foreground: 204 15% 94%;
  --primary: 187 21% 53%;
  --primary-foreground: 210 12% 9%;
  --secondary: 213 12% 13%;
  --secondary-foreground: 204 15% 94%;
  --muted: 213 12% 15%;
  --muted-foreground: 210 8% 69%;
  --accent: 187 21% 53%;
  --accent-foreground: 210 12% 9%;
  --border: 213 11% 26%;
  --bull: 211 71% 59%;
  --bear: 1 70% 58%;
}
.eb-landing { color: hsl(var(--foreground)); background: hsl(210 20% 6%); }
    .eb-landing .eb-bg-grad {
      position:absolute; inset:0;
      background:
        radial-gradient(1200px circle at 15% 10%, hsl(187 60% 30% / 0.25), transparent 60%),
        radial-gradient(1000px circle at 85% 90%, hsl(217 60% 40% / 0.20), transparent 60%),
        linear-gradient(180deg, hsl(210 20% 6%), hsl(210 22% 4%));
    }
    .eb-landing .eb-bg-grid {
      position:absolute; inset:0;
      background-image:
        linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
      background-size: 56px 56px;
      mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
    }
    .eb-landing .eb-blob { position:absolute; border-radius:50%; filter:blur(140px); opacity:0.25; }
    .eb-landing .eb-blob-a { width:520px; height:520px; background: hsl(187 60% 45%); top:-160px; left:-120px; }
    .eb-landing .eb-blob-b { width:620px; height:620px; background: hsl(217 60% 50%); bottom:-260px; right:-180px; }
    .eb-landing .eb-blob-c { width:400px; height:400px; background: hsl(40 55% 45% / 0.4); top:40%; left:50%; }
    .eb-landing .eb-btn-primary { background: linear-gradient(135deg, hsl(187 60% 48%), hsl(217 60% 55%)); border-color: transparent; color: #06110E; font-weight: 600; }
    .eb-landing .eb-btn-primary:hover { filter: brightness(1.08); transform: translateY(-1px); }
    .eb-hero-stage { position:relative; perspective:1600px; min-height: 520px; }
    .eb-hero-glow { position:absolute; inset:-40px; background: radial-gradient(circle at 55% 45%, hsl(187 60% 45% / 0.35), transparent 65%); filter:blur(60px); z-index:-1; }
    .eb-hero-scene {
      position:relative; height:100%; transform-style: preserve-3d;
      transform: rotateX(calc(var(--my,0) * -4deg)) rotateY(calc(var(--mx,0) * 6deg));
      transition: transform 400ms cubic-bezier(0.22,1,0.36,1);
    }
    .eb-hero-scene .eb-dash-main {
      position: relative; width: 100%; max-width: 520px; margin: 0 auto; padding: 1.25rem; border-radius: 20px;
      background: linear-gradient(165deg, hsl(210 22% 12% / 0.9), hsl(210 22% 8% / 0.9));
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: 0 40px 100px -20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04);
      backdrop-filter: blur(24px); transform: translateZ(0);
    }
    .eb-hero-scene .eb-float {
      position: absolute; padding: 0.85rem 1rem; border-radius: 14px;
      background: linear-gradient(165deg, hsl(210 22% 14% / 0.95), hsl(210 22% 10% / 0.95));
      border: 1px solid rgba(255,255,255,0.09); box-shadow: 0 20px 50px -18px rgba(0,0,0,0.7);
      backdrop-filter: blur(20px); animation: eb-hover 7s ease-in-out infinite;
    }
    .eb-hero-scene .eb-f-ticket { top: -4%; right: -6%; width: 210px; animation-delay: 0s; transform: translateZ(60px); }
    .eb-hero-scene .eb-f-ai { bottom: -6%; right: 4%; width: 260px; animation-delay: -2s; transform: translateZ(40px); }
    .eb-hero-scene .eb-f-gauges { top: 8%; left: -8%; width: 220px; animation-delay: -3.5s; transform: translateZ(50px); }
    .eb-hero-scene .eb-f-cal { bottom: 4%; left: -6%; width: 200px; animation-delay: -1s; transform: translateZ(30px); }
    @keyframes eb-hover { 0%,100% { transform: translateY(0) translateZ(var(--tz, 40px)); } 50% { transform: translateY(-10px) translateZ(var(--tz, 40px)); } }
    @media (max-width: 1024px) { .eb-hero-scene .eb-f-ticket, .eb-hero-scene .eb-f-ai, .eb-hero-scene .eb-f-gauges, .eb-hero-scene .eb-f-cal { display: none; } }
    .eb-feature-card { transition: transform 300ms cubic-bezier(0.22,1,0.36,1), border-color 300ms, box-shadow 300ms; }
    .eb-feature-card:hover { transform: translateY(-3px); border-color: hsl(var(--primary) / 0.35); box-shadow: 0 20px 50px -20px hsl(var(--primary) / 0.25); }
    .eb-memory-card { animation: eb-in 0.7s cubic-bezier(0.22,1,0.36,1) both; transition: transform 250ms, border-color 250ms; }
    .eb-memory-card:hover { transform: translateY(-2px); border-color: hsl(var(--primary) / 0.35); }
    @keyframes eb-in { from { opacity:0; transform: translateY(14px); } to { opacity:1; transform:none; } }
    .eb-bar { transition: height 1.4s cubic-bezier(0.22,1,0.36,1); }
    .eb-fill { transition: width 1.2s cubic-bezier(0.22,1,0.36,1); }
    .eb-cal-cell { transition: transform 200ms, background 400ms; }
    .eb-cal-cell:hover { transform: scale(1.08); }
    .eb-ai-card::before {
      content:''; position:absolute; inset:0; border-radius:14px; pointer-events:none;
      background: linear-gradient(90deg, transparent, hsl(var(--primary) / 0.15), transparent);
      opacity: 0; animation: eb-shine 5s ease-in-out infinite;
    }
    @keyframes eb-shine { 0%,100% { opacity:0; transform: translateX(-30%); } 50% { opacity: 0.6; transform: translateX(30%); } }
    @media (prefers-reduced-motion: reduce) {
      .eb-hero-scene, .eb-float, .eb-memory-card, .eb-bar, .eb-fill, .eb-ai-card::before { animation: none !important; transition: none !important; transform: none !important; }
    }
  `}</style>
);

export default Landing;
