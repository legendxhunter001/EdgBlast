import { Link } from 'react-router-dom';
import { ArrowUpRight, Camera, CheckCircle2, Circle, LineChart, Repeat, Sparkles, Target, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const benefits = [
  { icon: Target, title: 'Find your edge', body: 'Spot which setups, sessions, and assets actually make you money.' },
  { icon: TrendingUp, title: 'Compound consistency', body: 'Small habits, logged daily, become measurable performance gains.' },
  { icon: Sparkles, title: 'Master your psychology', body: 'Track emotions and discipline alongside every entry and exit.' },
];

const steps = [
  { icon: LineChart, label: 'Create your first trade', to: '/trades/new', done: false },
  { icon: Camera, label: 'Upload screenshots', to: '/trades/new', done: false },
  { icon: TrendingUp, label: 'Review performance', to: '/analytics', done: false },
  { icon: Repeat, label: 'Build consistency', to: '/reviews', done: false },
];

export const OnboardingDashboard = ({ onSkip }: { onSkip: () => void }) => {
  return (
    <div className="space-y-8 animate-fade-up">
      <section className="luxe-card relative overflow-hidden p-8 md:p-12">
        <div className="absolute inset-0 pointer-events-none opacity-60"
             style={{ background: 'var(--gradient-glow)' }} />
        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium uppercase tracking-wider mb-4">
              <Sparkles className="size-3.5" /> Welcome to Edge Blast
            </div>
            <h1 className="font-display text-3xl md:text-5xl font-semibold tracking-tight mb-3">
              Your trading journal,<br className="hidden md:block" /> elevated.
            </h1>
            <p className="text-sm md:text-base text-muted-foreground max-w-xl leading-relaxed">
              A calm, professional workspace built to help you log trades, study your edge,
              and grow as a consistent trader. Let's get you set up in under a minute.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-6">
              <Link
                to="/trades/new"
                className="press inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:opacity-95 transition"
              >
                Create your first trade <ArrowUpRight className="size-4" />
              </Link>
              <button
                onClick={onSkip}
                className="text-sm text-muted-foreground hover:text-foreground transition px-3 py-2"
              >
                Skip onboarding
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="font-display text-xl font-semibold">Why traders journal</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {benefits.map(({ icon: Icon, title, body }) => (
              <div key={title} className="luxe-card p-5">
                <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <Icon className="size-4 text-primary" />
                </div>
                <div className="font-semibold text-sm mb-1.5">{title}</div>
                <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>

          <div className="luxe-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-semibold text-sm">A peek at your future dashboard</div>
                <p className="text-xs text-muted-foreground">Sample data — yours fills in as you log trades.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { l: 'Total P&L', v: '+$4,820', tone: 'pnl-pos' },
                { l: 'Win Rate', v: '58.4%', tone: '' },
                { l: 'Avg R:R', v: '2.1', tone: '' },
                { l: 'Streak', v: '4W', tone: 'pnl-pos' },
              ].map(s => (
                <div key={s.l} className="rounded-xl border border-border/60 bg-card/60 p-4">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.l}</div>
                  <div className={cn('font-mono text-lg font-semibold mt-1.5', s.tone)}>{s.v}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 h-24 rounded-xl border border-border/60 bg-gradient-to-tr from-bull/5 via-transparent to-primary/5 relative overflow-hidden">
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
                <path d="M0,80 C50,70 80,60 120,55 S200,40 240,30 320,15 400,10" stroke="hsl(var(--bull))" strokeWidth="2" fill="none" />
                <path d="M0,80 C50,70 80,60 120,55 S200,40 240,30 320,15 400,10 L400,100 L0,100 Z" fill="hsl(var(--bull) / 0.10)" />
              </svg>
            </div>
          </div>
        </div>

        <div className="luxe-card p-5 h-fit">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold">Getting started</h2>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">0 / 4</span>
          </div>
          <ol className="space-y-3">
            {steps.map((s, i) => (
              <li key={s.label}>
                <Link
                  to={s.to}
                  className="group flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-secondary/40 transition"
                >
                  {s.done ? (
                    <CheckCircle2 className="size-5 text-bull shrink-0" />
                  ) : (
                    <Circle className="size-5 text-muted-foreground/50 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Step {i + 1}</div>
                    <div className="text-sm font-medium truncate group-hover:text-primary transition">{s.label}</div>
                  </div>
                  <s.icon className="size-4 text-muted-foreground group-hover:text-primary transition" />
                </Link>
              </li>
            ))}
          </ol>
          <button
            onClick={onSkip}
            className="mt-4 w-full text-xs text-muted-foreground hover:text-foreground transition py-2"
          >
            I'll explore on my own
          </button>
        </div>
      </div>
    </div>
  );
};
