import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { enablePush, getPushState, sendTestPush } from '@/lib/push';

const DISMISS_KEY = 'eb-push-dismissed';
const WEEK = 7 * 24 * 60 * 60 * 1000;

/** One quiet card asking to turn on phone alerts. Shows only when it can work and never twice in a week. */
export const PushPrompt = () => {
  const { session } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    const last = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (Date.now() - last < WEEK) return;
    let alive = true;
    const t = window.setTimeout(async () => {
      if ((await getPushState()) === 'off' && alive) setShow(true);
    }, 4000);
    return () => { alive = false; window.clearTimeout(t); };
  }, [session]);

  if (!show || !session) return null;

  const dismiss = () => { localStorage.setItem(DISMISS_KEY, String(Date.now())); setShow(false); };
  const turnOn = async () => {
    setBusy(true);
    try {
      const state = await enablePush(session.user.id);
      if (state === 'on') {
        toast.success('Alerts are on for this phone');
        void sendTestPush();
        setShow(false);
      } else if (state === 'blocked') {
        toast.error('Notifications are blocked. Allow them in your browser settings for this site.');
        dismiss();
      } else {
        dismiss();
      }
    } catch {
      toast.error('Could not turn on alerts. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-x-3 z-[60] mx-auto max-w-md rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-xl animate-in slide-in-from-bottom-4"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
      role="dialog"
      aria-label="Turn on alerts"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Bell className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-tight">Get alerts on this phone</p>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">Trades synced, rule blocks and trading locks, the moment they happen.</p>
          <div className="mt-3 flex gap-2">
            <button onClick={turnOn} disabled={busy} className="h-9 rounded-full bg-primary px-4 text-[14px] font-semibold text-primary-foreground disabled:opacity-60">
              {busy ? 'Turning on…' : 'Turn on'}
            </button>
            <button onClick={dismiss} className="h-9 rounded-full px-4 text-[14px] font-medium text-muted-foreground">Not now</button>
          </div>
        </div>
      </div>
    </div>
  );
};
