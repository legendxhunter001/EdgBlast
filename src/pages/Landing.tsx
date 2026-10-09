import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, BarChart3, CalendarDays, Gauge, Layers, Link2, MessageCircle, NotebookPen, ShieldCheck,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const CARD = 'bg-card border border-border rounded-[24px]';
const SOFT = { boxShadow: '0 1px 2px rgba(0,0,0,.05), 0 12px 32px -16px rgba(0,0,0,.18)' } as const;
const BULL = 'hsl(var(--bull))', BEAR = 'hsl(var(--bear))';

const STEPS = [
  { icon: Link2, title: 'Connect your MT5 account', body: 'Link it once. You can also log a trade by hand whenever you want.' },
  { icon: NotebookPen, title: 'Your trades log themselves', body: 'When a trade closes it shows up in your journal with its result, ready for your notes and screenshots.' },
  { icon: BarChart3, title: 'See what your numbers say', body: 'Check results by pair, weekday and strategy, then go over each trade while it is still fresh.' },
];

const FEATURES = [
  { icon: NotebookPen, title: 'Journal', body: 'Notes, screenshots and a short review for every trade, all in one place.' },
  { icon: CalendarDays, title: 'Calendar', body: 'Every trading day colored by how it went. Tap a day to see its trades.' },
  { icon: BarChart3, title: 'Analytics', body: 'Profit factor, risk to reward, streaks, and results by pair and weekday.' },
  { icon: Layers, title: 'Strategies', body: 'Tag your trades with a setup and see which one actually pays you.' },
  { icon: Gauge, title: 'Review score', body: 'A score worked out from your own trades and your own rules, with the evidence shown.' },
  { icon: MessageCircle, title: 'Coach', body: 'Ask about a trade, a rule you keep breaking, or how your week went.' },
];

const SAMPLE = [
  { pair: 'EURUSD', meta: 'Long · Oct 3', pnl: '+$240.00' },
  { pair: 'XAUUSD', meta: 'Short · Oct 2', pnl: '-$110.00' },
  { pair: 'GBPJPY', meta: 'Long · Oct 1', pnl: '+$385.50' },
];

const Landing = () => {
  const reduce = !!useReducedMotion();
  const reveal = (delay = 0) => reduce ? {} : {
    initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' },
    transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] as const },
  };

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link to="/" className={`${FOCUS} flex items-center gap-2.5 rounded-lg`}>
            <Logo size={30} />
            <span className="font-semibold tracking-tight text-[16px]">Edge Blast</span>
          </Link>
          <div className="hidden md:flex items-center gap-7 text-[14px] text-muted-foreground">
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#inside" className="hover:text-foreground transition-colors">What's inside</a>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Link to="/auth" className={`${FOCUS} hidden sm:inline-flex h-9 items-center px-3.5 rounded-full text-[14px] font-semibold`}>Sign in</Link>
            <Link to="/auth" className={`${FOCUS} inline-flex h-9 items-center px-4 rounded-full bg-primary text-primary-foreground text-[14px] font-semibold`}>Get started</Link>
          </div>
        </div>
      </nav>

      <header className="max-w-5xl mx-auto px-5 pt-14 md:pt-24 pb-10 md:pb-16 grid md:grid-cols-[1.1fr_.9fr] gap-12 items-center">
        <div>
          <motion.h1 {...(reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } })}
            className="font-display text-[42px] md:text-[60px] leading-[1.04] font-bold tracking-tight">
            A trading journal that keeps you honest.
          </motion.h1>
          <motion.p {...(reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] } })}
            className="mt-5 text-[18px] leading-relaxed text-muted-foreground max-w-xl">
            Edge Blast logs your MT5 trades, lines them up against your own rules, and shows what your numbers really say. No spreadsheets.
          </motion.p>
          <motion.div {...(reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay: 0.16, ease: [0.22, 1, 0.36, 1] } })}
            className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/auth" className={`${FOCUS} inline-flex h-12 items-center gap-2 px-6 rounded-full bg-primary text-primary-foreground text-[16px] font-semibold active:scale-[.97] transition-transform`}>
              Start free <ArrowRight className="size-4" />
            </Link>
            <a href="#how" className={`${FOCUS} inline-flex h-12 items-center px-5 rounded-full bg-secondary text-[16px] font-semibold`}>See how it works</a>
          </motion.div>
        </div>

        {/* sample, clearly labeled */}
        <motion.div {...(reduce ? {} : { initial: { opacity: 0, y: 28, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] } })}
          className={`${CARD} p-5`} style={SOFT} aria-label="Sample of the dashboard">
          <div className="text-[12px] text-muted-foreground">Sample numbers</div>
          <div className="text-[13px] text-muted-foreground mt-3">This month</div>
          <div className="font-display text-[40px] leading-none font-bold tracking-tight tabular-nums mt-1" style={{ color: BULL }}>+$1,420.50</div>
          <div className="grid grid-cols-3 border-t border-border mt-4 -mx-5 px-5 pt-3">
            {[['Win rate', '58%'], ['Risk : reward', '1:2.4'], ['Trades', '19']].map(([l, v]) => (
              <div key={l}><div className="text-[11.5px] text-muted-foreground">{l}</div><div className="text-[16px] font-semibold tabular-nums">{v}</div></div>
            ))}
          </div>
          <div className="mt-3 -mx-1">
            {SAMPLE.map((t) => (
              <div key={t.pair} className="flex items-center justify-between py-2.5 px-1 border-t border-border first:border-t-0">
                <div><div className="text-[15px] font-semibold">{t.pair}</div><div className="text-[12.5px] text-muted-foreground">{t.meta}</div></div>
                <div className="text-[15px] font-semibold tabular-nums" style={{ color: t.pnl.startsWith('-') ? BEAR : BULL }}>{t.pnl}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </header>

      <section id="how" className="max-w-5xl mx-auto px-5 py-14 md:py-20">
        <motion.h2 {...reveal()} className="font-display text-[30px] md:text-[40px] font-bold tracking-tight">How it works</motion.h2>
        <div className="grid md:grid-cols-3 gap-4 mt-8">
          {STEPS.map((s, i) => (
            <motion.div key={s.title} {...reveal(i * 0.08)} className={`${CARD} p-6`} style={SOFT}>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-[12px] grid place-items-center" style={{ background: 'hsl(var(--primary) / .14)', color: 'hsl(var(--primary))' }}><s.icon className="size-5" /></div>
                <span className="text-[13px] font-semibold text-muted-foreground">Step {i + 1}</span>
              </div>
              <h3 className="text-[19px] font-semibold mt-4">{s.title}</h3>
              <p className="text-[15px] text-muted-foreground mt-1.5 leading-relaxed">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="inside" className="max-w-5xl mx-auto px-5 py-14 md:py-20">
        <motion.h2 {...reveal()} className="font-display text-[30px] md:text-[40px] font-bold tracking-tight">What's inside</motion.h2>
        <motion.p {...reveal(0.05)} className="text-[17px] text-muted-foreground mt-3 max-w-xl">A journal, a calendar, your numbers, your strategies and a coach. They all read from the same trades.</motion.p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} {...reveal((i % 3) * 0.07)} className={`${CARD} p-6`}>
              <div className="size-10 rounded-[12px] grid place-items-center bg-secondary"><f.icon className="size-5" /></div>
              <h3 className="text-[18px] font-semibold mt-4">{f.title}</h3>
              <p className="text-[15px] text-muted-foreground mt-1.5 leading-relaxed">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-5 py-10">
        <motion.div {...reveal()} className={`${CARD} p-7 md:p-9 flex flex-col md:flex-row md:items-center gap-5`}>
          <div className="size-12 rounded-[14px] grid place-items-center shrink-0" style={{ background: 'hsl(var(--bull) / .14)', color: BULL }}><ShieldCheck className="size-6" /></div>
          <div>
            <h3 className="text-[20px] font-semibold">Real numbers only</h3>
            <p className="text-[15px] text-muted-foreground mt-1 leading-relaxed max-w-2xl">Every figure comes from your own closed trades. When something can't be measured yet, it tells you what's missing instead of guessing. Your trades stay private to your account.</p>
          </div>
        </motion.div>
      </section>

      <section className="max-w-5xl mx-auto px-5 py-16 md:py-24 text-center">
        <motion.h2 {...reveal()} className="font-display text-[32px] md:text-[46px] leading-tight font-bold tracking-tight">Know what's working.</motion.h2>
        <motion.p {...reveal(0.06)} className="text-[17px] text-muted-foreground mt-3">Setting up takes a couple of minutes. After that, your closed trades log themselves.</motion.p>
        <motion.div {...reveal(0.12)} className="mt-7 flex flex-wrap justify-center gap-3">
          <Link to="/auth" className={`${FOCUS} inline-flex h-12 items-center gap-2 px-7 rounded-full bg-primary text-primary-foreground text-[16px] font-semibold active:scale-[.97] transition-transform`}>Start free <ArrowRight className="size-4" /></Link>
          <Link to="/auth" className={`${FOCUS} inline-flex h-12 items-center px-6 rounded-full bg-secondary text-[16px] font-semibold`}>Sign in</Link>
        </motion.div>
      </section>

      <footer className="border-t border-border py-8" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="max-w-5xl mx-auto px-5 flex items-center justify-between text-[13px] text-muted-foreground">
          <span className="inline-flex items-center gap-2"><Logo size={22} />Edge Blast</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
