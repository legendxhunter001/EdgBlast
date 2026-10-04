import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useProfileName } from '@/hooks/useProfileName';

const LINES = [
  'Plan the trade. Trade the plan.',
  'Protect your capital first. Profit follows discipline.',
  'One clean execution beats ten rushed ones.',
  'Consistency is the edge nobody can copy.',
  'Process over outcome. Every single trade.',
  'Patience pays the sniper, not the gambler.',
  'Small risk, clear rules, calm mind.',
  'Your journal is your coach. Be honest with it.',
  'Respect the stop. Respect yourself.',
  'Boring trading is profitable trading.',
  'Review yesterday, then trade today with intent.',
  'Great traders are built one disciplined day at a time.',
  'No setup, no trade. That is a win too.',
  'Stay focused on the next right decision.',
];

export const greetingFor = (d = new Date()) => {
  const h = d.getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  return 'Good evening';
};

const dayOfYear = (d = new Date()) => Math.floor((+d - +new Date(d.getFullYear(), 0, 0)) / 86_400_000);
export const motivationFor = (d = new Date()) => LINES[dayOfYear(d) % LINES.length];

const useGreeting = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);
  return { greeting: greetingFor(now), line: motivationFor(now) };
};

/** "Good afternoon, Amin" with the name in a living gradient. */
export const GreetingTitle = () => {
  const { greeting } = useGreeting();
  const { firstName } = useProfileName();
  return (
    <>
      {greeting}
      {firstName && <>, <span className="eb-name">{firstName}</span></>}
    </>
  );
};

export const MotivationLine = () => {
  const { line } = useGreeting();
  return <>{line}</>;
};

const SKIP_KEY = 'eb-name-skipped';

/** First time in with no name on file: ask what to call them. */
export const NamePrompt = () => {
  const { name, loading, save, hasUser } = useProfileName();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [skipped, setSkipped] = useState(() => { try { return localStorage.getItem(SKIP_KEY) === '1'; } catch { return false; } });

  if (loading || !hasUser || name || skipped) return null;

  const submit = async () => {
    if (!value.trim() || busy) return;
    setBusy(true);
    const ok = await save(value);
    setBusy(false);
    if (ok) toast.success(`Nice to meet you, ${value.trim().split(/\s+/)[0]}`);
    else toast.error('Could not save your name. You can add it later in Settings.');
  };

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center p-4 bg-black/40 backdrop-blur-md animate-fade-up" role="dialog" aria-modal="true" aria-label="Welcome">
      <div className="w-full max-w-md rounded-3xl bg-card border border-border p-7 shadow-elevated">
        <div className="text-caption mb-2">Welcome to Edge Blast</div>
        <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">
          What should we <span className="eb-name">call you?</span>
        </h2>
        <p className="text-sm text-muted-foreground mt-2">Your name shows up on your dashboard, so Edge Blast feels like yours from day one.</p>
        <input
          autoFocus value={value} maxLength={40} placeholder="Your first name"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          className="mt-5 w-full h-12 rounded-xl border border-border bg-background px-4 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
        />
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={submit} disabled={!value.trim() || busy}
            className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50 press"
          >
            {busy ? 'Saving…' : 'Continue'}
          </button>
          <button
            onClick={() => { try { localStorage.setItem(SKIP_KEY, '1'); } catch { /* ignore */ } setSkipped(true); }}
            className="h-12 px-4 rounded-xl text-sm text-muted-foreground hover:text-foreground"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
};
