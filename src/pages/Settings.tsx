import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccountScope } from '@/hooks/useAccountScope';
import { toast } from 'sonner';
import { Check, ChevronRight, FileUp, ImageDown } from 'lucide-react';
import ImportCsvDialog from '@/components/ImportCsvDialog';
import ImportScreenshotsDialog from '@/components/ImportScreenshotsDialog';
import { ThemeToggle } from '@/components/ThemeToggle';
import { disablePush, enablePush, getPushState, sendTestPush, type PushState } from '@/lib/push';
import { isNative } from '@/lib/native';

const SURFACE = 'bg-card border border-border rounded-[24px]';
const SHADOW = { boxShadow: 'var(--ios-sh, 0 1px 2px rgba(0,0,0,.05))' } as const;
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const BARE = { background: 'transparent', border: 0, padding: 0, minHeight: 0, borderRadius: 0, boxShadow: 'none' } as const;
const tap = () => { try { navigator.vibrate?.(8); } catch { /* not supported */ } };

const Section = ({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) => (
  <section>
    <h2 className="text-[13px] font-semibold text-muted-foreground px-1.5 pb-2">{title}</h2>
    <div className={`${SURFACE} px-4`} style={SHADOW}>{children}</div>
    {note && <p className="text-[12.5px] text-muted-foreground px-1.5 pt-2 leading-relaxed">{note}</p>}
  </section>
);

const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <label className="flex items-center justify-between gap-4 py-3.5 border-t border-border first:border-t-0">
    <span className="min-w-0 shrink-0">
      <span className="block text-[15px]">{label}</span>
      {hint && <span className="block text-[12.5px] text-muted-foreground">{hint}</span>}
    </span>
    <span className="flex-1 min-w-0 flex justify-end">{children}</span>
  </label>
);

const input = 'w-full text-right text-[16px] outline-none placeholder:text-muted-foreground/50';

const Switch = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => { tap(); onChange(!on); }}
    className={`${FOCUS} relative w-[51px] h-[31px] rounded-full shrink-0 transition-colors duration-200 ${on ? 'bg-bull' : 'bg-muted'}`}>
    <span className={`absolute top-[2px] left-[2px] size-[27px] rounded-full bg-white shadow-md transition-transform duration-200 ease-[cubic-bezier(.22,1,.36,1)] ${on ? 'translate-x-5' : ''}`} />
  </button>
);

const SaveBar = ({ saving, saved, onSave }: { saving: boolean; saved: boolean; onSave: () => void }) => (
  <div className="flex items-center gap-3 py-3.5 border-t border-border">
    <button type="button" onClick={onSave} disabled={saving} className={`${FOCUS} h-11 px-5 rounded-[14px] bg-primary text-primary-foreground text-[15px] font-semibold disabled:opacity-50 active:scale-[.97] transition`}>
      {saving ? 'Saving…' : 'Save changes'}
    </button>
    {saved && !saving && <span className="inline-flex items-center gap-1 text-[14px] font-medium" style={{ color: 'hsl(var(--bull))' }}><Check className="size-4" /> Saved</span>}
  </div>
);

function useSection<T extends Record<string, any>>(table: string, defaults: T, userKey: 'user_id' | 'id') {
  const { user } = useAuth();
  const [value, setValue] = useState<T>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const { data } = await supabase.from(table as any).select('*').eq(userKey, user.id).maybeSingle();
      if (!alive) return;
      if (data) {
        const next = { ...defaults } as any;
        Object.keys(defaults).forEach((k) => { if ((data as any)[k] !== null && (data as any)[k] !== undefined) next[k] = (data as any)[k]; });
        setValue(next);
      } else {
        await supabase.from(table as any).upsert({ [userKey]: user.id, ...defaults } as any, { onConflict: userKey });
      }
      setLoading(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, table]);

  const save = async () => {
    if (!user) return;
    setSaving(true); setSaved(false);
    const { error } = await supabase
      .from(table as any)
      .upsert({ [userKey]: user.id, ...value } as any, { onConflict: userKey });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const set = (patch: Partial<T>) => setValue((v) => ({ ...v, ...patch }));
  return { value, set, save, saving, saved, loading };
}

const ImportSection = () => {
  const [csvOpen, setCsvOpen] = useState(false);
  const [shotsOpen, setShotsOpen] = useState(false);
  return (
    <Section title="Import" note="Bring in past trades from a broker export or from screenshots.">
      {([['Import a CSV', 'A trade history export from your broker', FileUp, () => setCsvOpen(true)], ['Import screenshots', 'Turn trade screenshots into journal entries', ImageDown, () => setShotsOpen(true)]] as const).map(([t, d, Icon, fn]) => (
        <button key={t} type="button" onClick={fn} className={`${FOCUS} w-full flex items-center gap-3 py-3.5 border-t border-border first:border-t-0 text-left active:opacity-60 transition-opacity`}>
          <span className="size-9 rounded-[10px] grid place-items-center bg-secondary shrink-0"><Icon className="size-[18px]" /></span>
          <span className="flex-1 min-w-0"><span className="block text-[15px]">{t}</span><span className="block text-[12.5px] text-muted-foreground">{d}</span></span>
          <ChevronRight className="size-[18px] text-muted-foreground shrink-0" />
        </button>
      ))}
      <ImportCsvDialog open={csvOpen} onOpenChange={setCsvOpen} />
      <ImportScreenshotsDialog open={shotsOpen} onOpenChange={setShotsOpen} />
    </Section>
  );
};

const ProfileSection = () => {
  const s = useSection('profiles', { display_name: '', avatar_url: '', timezone: 'UTC' }, 'id');
  return (
    <Section title="Profile" note="Your timezone decides which day and session each trade is grouped into.">
      <Row label="Name"><input value={s.value.display_name ?? ''} onChange={(e) => s.set({ display_name: e.target.value })} placeholder="Your name" style={BARE} className={input} /></Row>
      <Row label="Timezone"><input value={s.value.timezone ?? ''} onChange={(e) => s.set({ timezone: e.target.value })} placeholder="Europe/London" style={BARE} className={input} /></Row>
      <Row label="Avatar link"><input value={s.value.avatar_url ?? ''} onChange={(e) => s.set({ avatar_url: e.target.value })} placeholder="https://" style={BARE} className={input} /></Row>
      <SaveBar saving={s.saving} saved={s.saved} onSave={s.save} />
    </Section>
  );
};

const RulesSection = () => {
  const s = useSection('trading_rules', {
    max_risk_pct: 1, min_rr: 2, confirmation_tf: 'M15',
    entry_trigger: '', max_trades_per_day: 3, max_trades_per_week: 10,
  }, 'user_id');
  const num = (v: string) => (v === '' ? 0 : Number(v));
  return (
    <Section title="Trading rules" note="Your playbook. Your Review score checks your trades against the minimum R:R and the daily trade limit set here.">
      <Row label="Max risk per trade"><span className="flex items-center gap-1 w-full"><input type="number" step="0.1" inputMode="decimal" value={s.value.max_risk_pct ?? ''} onChange={(e) => s.set({ max_risk_pct: num(e.target.value) })} style={BARE} className={`${input} tabular-nums`} /><span className="text-muted-foreground">%</span></span></Row>
      <Row label="Minimum R:R" hint="Reward for every 1 risked"><input type="number" step="0.1" inputMode="decimal" value={s.value.min_rr ?? ''} onChange={(e) => s.set({ min_rr: num(e.target.value) })} style={BARE} className={`${input} tabular-nums`} /></Row>
      <Row label="Confirmation timeframe">
        <select value={s.value.confirmation_tf ?? 'M15'} onChange={(e) => s.set({ confirmation_tf: e.target.value })} style={{ ...BARE, textAlign: 'right' }} className="text-[16px] outline-none">
          {['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Row>
      <Row label="Entry trigger"><input value={s.value.entry_trigger ?? ''} onChange={(e) => s.set({ entry_trigger: e.target.value })} placeholder="Break and retest" style={BARE} className={input} /></Row>
      <Row label="Max trades per day"><input type="number" inputMode="numeric" value={s.value.max_trades_per_day ?? ''} onChange={(e) => s.set({ max_trades_per_day: num(e.target.value) })} style={BARE} className={`${input} tabular-nums`} /></Row>
      <Row label="Max trades per week"><input type="number" inputMode="numeric" value={s.value.max_trades_per_week ?? ''} onChange={(e) => s.set({ max_trades_per_week: num(e.target.value) })} style={BARE} className={`${input} tabular-nums`} /></Row>
      <SaveBar saving={s.saving} saved={s.saved} onSave={s.save} />
    </Section>
  );
};

const NOTIFS: { key: string; title: string; desc: string; soon?: boolean }[] = [
  { key: 'trade_synced', title: 'Trades from MT5', desc: 'When a trade lands or closes from your MT5 account.' },
  { key: 'mt5_status', title: 'MT5 connection', desc: 'When your account connects, disconnects or fails to sync.' },
  { key: 'rule_violation', title: 'Rules and locks', desc: 'When a trade is blocked, a rule is broken or trading is locked.' },
  { key: 'goal_progress', title: 'Goals', desc: 'When you reach a goal milestone.' },
  { key: 'journal_reminder', title: 'Journal reminders', desc: 'A nudge to write up your trades, on your plan or your own days.' },
  { key: 'weekly_report', title: 'Weekly review', desc: 'Your week in numbers.', soon: true },
  { key: 'ai_coaching_summary', title: 'Coach summary', desc: 'Regular notes from your coach.', soon: true },
];

const DAY_CHIPS: [number, string][] = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [7, 'Sun']];
const REMINDER_HOURS = [12, 14, 16, 18, 19, 20];

/** Alerts on this phone, even with the app closed (browser and installed web app). Inside the Android app they show while it is open. */
const PhoneAlertsRow = () => {
  const { user } = useAuth();
  const [state, setState] = useState<PushState | 'app'>('off');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNative()) { setState('app'); return; }
    void getPushState().then(setState);
  }, []);

  const toggle = async (on: boolean) => {
    if (!user) return;
    setBusy(true);
    try {
      if (on) {
        const next = await enablePush(user.id);
        setState(next);
        if (next === 'on') { toast.success('Alerts are on for this phone'); void sendTestPush(); }
        else if (next === 'blocked') toast.error('Notifications are blocked. Allow them in your browser settings for this site.');
      } else {
        await disablePush();
        setState('off');
      }
    } catch {
      toast.error('Could not change phone alerts');
    } finally {
      setBusy(false);
    }
  };

  const desc =
    state === 'app' ? 'Inside the app, alerts appear as phone notifications while it is open.'
    : state === 'needs-install' ? 'On iPhone, add Edge Blast to your Home Screen first, then turn this on.'
    : state === 'unsupported' ? 'This browser cannot show phone alerts.'
    : state === 'blocked' ? 'Blocked in your browser settings. Allow notifications for this site, then try again.'
    : 'Get alerts on this phone, even when the app is closed.';
  const usable = state === 'on' || state === 'off';

  return (
    <div className="py-3.5 border-t border-border first:border-t-0">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0"><div className="text-[15px]">Phone alerts</div><div className="text-[12.5px] text-muted-foreground">{desc}</div></div>
        {state !== 'app' && (
          <div className={busy || !usable ? 'opacity-50 pointer-events-none' : ''}>
            <Switch label="Phone alerts" on={state === 'on'} onChange={toggle} />
          </div>
        )}
      </div>
      {state === 'on' && (
        <button type="button" onClick={() => { void sendTestPush(); toast('Test alert sent'); }} className={`${FOCUS} mt-2.5 h-9 px-4 rounded-full border border-border text-[13.5px] font-medium active:scale-[.97] transition`}>
          Send a test alert
        </button>
      )}
    </div>
  );
};

const DELAY_OPTIONS: [string, string][] = [
  ['', 'Plan default'], ['15', '15 minutes'], ['30', '30 minutes'], ['60', '1 hour'], ['120', '2 hours'], ['180', '3 hours'],
  ['240', '4 hours'], ['360', '6 hours'], ['480', '8 hours'], ['720', '12 hours'], ['1080', '18 hours'], ['1440', '1 day'], ['2880', '2 days'],
];
const WEEKDAY_OPTIONS: [number, string][] = [[1, 'Monday'], [2, 'Tuesday'], [3, 'Wednesday'], [4, 'Thursday'], [5, 'Friday'], [6, 'Saturday'], [7, 'Sunday']];
const hhmm = (v: unknown, fallback: string) => (typeof v === 'string' && v.length >= 5 ? v.slice(0, 5) : fallback);
const inQuiet = (t: string, start: string, end: string) => (start === end ? false : start < end ? t >= start && t < end : t >= start || t < end);
const FIELD = 'h-9 rounded-[10px] border border-border bg-card px-2.5 text-[14px]';

const TimeField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <input type="time" aria-label={label} value={value} onChange={(e) => e.target.value && onChange(e.target.value)} className={FIELD} />
);

const NotificationsSection = () => {
  const s = useSection<Record<string, any>>('notification_settings', {
    trade_synced: true, mt5_status: true, rule_violation: true, goal_progress: true, journal_reminder: true,
    journal_days: [], journal_time: '19:00', trade_nudge: true, trade_delay_min: null, day_wrap: true,
    week_wrap: true, week_day: 5, week_time: '17:00', quiet_start: '21:00', quiet_end: '08:00',
    // weekly review and coach summary are left alone until they exist
  }, 'user_id');
  const days: number[] = Array.isArray(s.value.journal_days) ? s.value.journal_days.map(Number) : [];
  const toggleDay = (n: number) => s.set({ journal_days: days.includes(n) ? days.filter((x) => x !== n) : [...days, n].sort() });

  return (
    <Section title="Notifications" note="Everything you turn on also appears in the bell inbox.">
      <PhoneAlertsRow />
      {NOTIFS.map((n) => (
        <div key={n.key} className="flex items-center justify-between gap-4 py-3.5 border-t border-border">
          <div className="min-w-0">
            <div className="text-[15px] flex items-center gap-2">
              {n.title}
              {n.soon && <span className="text-[11px] font-medium text-muted-foreground border border-border rounded-full px-2 py-0.5">Soon</span>}
            </div>
            <div className="text-[12.5px] text-muted-foreground">{n.desc}</div>
          </div>
          <div className={n.soon ? 'opacity-40 pointer-events-none' : ''}>
            <Switch label={n.title} on={!n.soon && !!s.value[n.key]} onChange={(v) => s.set({ [n.key]: v })} />
          </div>
        </div>
      ))}
      {s.value.journal_reminder && (
        <div className="border-t border-border">
          <div className="pt-4 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Journal reminder timing</div>

          <div className="py-3.5 border-b border-border">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0"><div className="text-[15px]">After a trade closes</div><div className="text-[12.5px] text-muted-foreground">One nudge for each trade you have not written about.</div></div>
              <Switch label="After a trade closes" on={!!s.value.trade_nudge} onChange={(v) => s.set({ trade_nudge: v })} />
            </div>
            {s.value.trade_nudge && (
              <label className="mt-2.5 flex items-center gap-3 text-[14px]">
                Wait
                <select value={s.value.trade_delay_min == null ? '' : String(s.value.trade_delay_min)} onChange={(e) => s.set({ trade_delay_min: e.target.value === '' ? null : Number(e.target.value) })} className={FIELD}>
                  {DELAY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <span className="text-muted-foreground">after it closes</span>
              </label>
            )}
          </div>

          <div className="py-3.5 border-b border-border">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[15px]">Daily reminder time</div>
                <div className="text-[12.5px] text-muted-foreground">{days.length ? 'When you get the reminder on your chosen days.' : 'End-of-day wrap-up for short-term plans.'}</div>
              </div>
              <TimeField label="Daily reminder time" value={hhmm(s.value.journal_time, '19:00')} onChange={(v) => s.set({ journal_time: v })} />
            </div>
            {!days.length && (
              <div className="mt-2.5 flex items-center justify-between gap-4">
                <div className="text-[12.5px] text-muted-foreground">Send the end-of-day wrap-up</div>
                <Switch label="Day wrap-up" on={!!s.value.day_wrap} onChange={(v) => s.set({ day_wrap: v })} />
              </div>
            )}
          </div>

          <div className="py-3.5 border-b border-border">
            <div className="text-[15px]">Reminder days</div>
            <div className="text-[12.5px] text-muted-foreground">
              {days.length === 0 ? 'None picked: reminders follow your trading plan. Logging by hand? Pick your days.' : 'One reminder on these days if you have not written yet.'}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {DAY_CHIPS.map(([n, label]) => (
                <button key={n} type="button" aria-pressed={days.includes(n)} onClick={() => { tap(); toggleDay(n); }}
                  className={`${FOCUS} h-9 px-3.5 rounded-full border text-[13.5px] font-medium active:scale-[.97] transition ${days.includes(n) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {!days.length && (
            <div className="py-3.5 border-b border-border">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0"><div className="text-[15px]">Weekly wrap-up</div><div className="text-[12.5px] text-muted-foreground">For swing plans: one nudge at the end of your week.</div></div>
                <Switch label="Weekly wrap-up" on={!!s.value.week_wrap} onChange={(v) => s.set({ week_wrap: v })} />
              </div>
              {s.value.week_wrap && (
                <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[14px]">
                  On
                  <select value={Number(s.value.week_day ?? 5)} onChange={(e) => s.set({ week_day: Number(e.target.value) })} className={FIELD}>
                    {WEEKDAY_OPTIONS.map(([n, l]) => <option key={n} value={n}>{l}</option>)}
                  </select>
                  at
                  <TimeField label="Weekly wrap-up time" value={hhmm(s.value.week_time, '17:00')} onChange={(v) => s.set({ week_time: v })} />
                </div>
              )}
            </div>
          )}

          <div className="py-3.5">
            <div className="text-[15px]">Quiet hours</div>
            <div className="text-[12.5px] text-muted-foreground">No journal reminders in this window.</div>
            <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[14px]">
              From <TimeField label="Quiet hours start" value={hhmm(s.value.quiet_start, '21:00')} onChange={(v) => s.set({ quiet_start: v })} />
              to <TimeField label="Quiet hours end" value={hhmm(s.value.quiet_end, '08:00')} onChange={(v) => s.set({ quiet_end: v })} />
            </div>
            {inQuiet(hhmm(s.value.journal_time, '19:00'), hhmm(s.value.quiet_start, '21:00'), hhmm(s.value.quiet_end, '08:00')) && (
              <div className="mt-2 text-[12.5px] text-destructive">Your daily reminder time falls inside quiet hours, so it will not be sent.</div>
            )}
          </div>
        </div>
      )}
      <SaveBar saving={s.saving} saved={s.saved} onSave={s.save} />
    </Section>
  );
};

const AiCoachSection = () => {
  const s = useSection<{ enabled: boolean; coaching_frequency: string; tone: string }>('ai_coach_settings', {
    enabled: true, coaching_frequency: 'daily', tone: 'direct',
  }, 'user_id');
  const sel = (value: string, onChange: (v: string) => void, opts: [string, string][]) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...BARE, textAlign: 'right' }} className="text-[16px] outline-none">
      {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
  return (
    <Section title="Coach" note="Your coach goes over your trades against your rules and notes.">
      <div className="flex items-center justify-between gap-4 py-3 border-t border-border first:border-t-0">
        <div><div className="text-[15px]">Coach feedback</div><div className="text-[12.5px] text-muted-foreground">Get feedback on your trades.</div></div>
        <Switch label="Coach feedback" on={!!s.value.enabled} onChange={(v) => s.set({ enabled: v })} />
      </div>
      <Row label="How often">{sel(s.value.coaching_frequency, (v) => s.set({ coaching_frequency: v }), [['after_each_trade', 'After each trade'], ['daily', 'Daily'], ['weekly', 'Weekly']])}</Row>
      <Row label="Tone">{sel(s.value.tone, (v) => s.set({ tone: v }), [['direct', 'Direct'], ['encouraging', 'Encouraging'], ['strict', 'Strict']])}</Row>
      <SaveBar saving={s.saving} saved={s.saved} onSave={s.save} />
    </Section>
  );
};

const SecuritySection = () => {
  const { user } = useAuth();
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const change = async () => {
    if (pwd.length < 8) { toast.error('Password must be at least 8 characters.'); return; }
    if (pwd !== confirm) { toast.error('Passwords do not match.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setPwd(''); setConfirm('');
    toast.success('Password updated');
  };

  return (
    <Section title="Account and security">
      <Row label="Email"><span className="text-[16px] text-muted-foreground truncate">{user?.email ?? ''}</span></Row>
      <Row label="New password"><input type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="At least 8 characters" style={BARE} className={input} /></Row>
      <Row label="Confirm password"><input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type it again" style={BARE} className={input} /></Row>
      <div className="py-3.5 border-t border-border">
        <button type="button" onClick={change} disabled={busy || !pwd} className={`${FOCUS} h-11 px-5 rounded-[14px] bg-secondary text-[15px] font-semibold disabled:opacity-50 active:scale-[.97] transition`}>
          {busy ? 'Updating…' : 'Change password'}
        </button>
      </div>
    </Section>
  );
};

export default function SettingsPage() {
  const { connections } = useAccountScope();
  return (
    <div className="px-4 md:px-8 pt-4 pb-10 max-w-2xl mx-auto">
      <h1 className="font-display text-[34px] leading-[1.1] font-bold tracking-tight">Settings</h1>
      <p className="text-[14px] text-muted-foreground mt-1 mb-5">Your profile, rules and preferences.</p>
      <div className="space-y-6">
        <Section title="Connections">
          <Link to="/connections" className={`${FOCUS} flex items-center justify-between gap-3 py-3.5 active:opacity-60 transition-opacity`}>
            <span><span className="block text-[15px]">MT5 accounts</span><span className="block text-[12.5px] text-muted-foreground tabular-nums">{connections.length} connected</span></span>
            <ChevronRight className="size-[18px] text-muted-foreground" />
          </Link>
        </Section>
        <Section title="Appearance">
          <div className="flex items-center justify-between gap-3 py-3"><span className="text-[15px]">Light or dark</span><ThemeToggle /></div>
        </Section>
        <ImportSection />
        <ProfileSection />
        <RulesSection />
        <NotificationsSection />
        <AiCoachSection />
        <SecuritySection />
      </div>
    </div>
  );
}
