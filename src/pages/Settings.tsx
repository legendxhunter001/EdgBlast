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

const NOTIFS: { key: string; title: string; desc: string }[] = [
  { key: 'trade_synced', title: 'Trade synced', desc: 'When a new trade lands from MT5.' },
  { key: 'rule_violation', title: 'Rule broken', desc: 'When a trade breaks one of your rules.' },
  { key: 'weekly_report', title: 'Weekly report', desc: 'Your week in numbers, every Sunday.' },
  { key: 'ai_coaching_summary', title: 'Coach summary', desc: 'Regular notes from your coach.' },
];

const NotificationsSection = () => {
  const s = useSection<Record<string, boolean>>('notification_settings', {
    trade_synced: true, rule_violation: true, weekly_report: true, ai_coaching_summary: false,
  }, 'user_id');
  return (
    <Section title="Notifications">
      {NOTIFS.map((n) => (
        <div key={n.key} className="flex items-center justify-between gap-4 py-3 border-t border-border first:border-t-0">
          <div className="min-w-0"><div className="text-[15px]">{n.title}</div><div className="text-[12.5px] text-muted-foreground">{n.desc}</div></div>
          <Switch label={n.title} on={!!s.value[n.key]} onChange={(v) => s.set({ [n.key]: v })} />
        </div>
      ))}
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
