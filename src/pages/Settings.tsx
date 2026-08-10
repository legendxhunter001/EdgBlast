import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccountScope } from '@/hooks/useAccountScope';
import { toast } from 'sonner';

const styles = `
.eb-set, .eb-set *{ box-sizing:border-box; }
.eb-set{
  --bg:#0A0A0C; --elev:#131316; --teal:#14C9AE; --blue:#3D6FE5; --rose:#C98A93;
  --text:#F3F1EC; --dim:#9B9A97; --dim2:#66655F;
  --line:rgba(255,255,255,.08); --line2:rgba(255,255,255,.16);
  background:var(--bg); color:var(--text); min-height:100vh;
  font-family:'Inter',-apple-system,sans-serif; padding-bottom:4rem;
}
.eb-set header.hd{ padding:2rem 1.5rem 1.4rem; border-bottom:1px solid var(--line); }
.eb-set h1{ font-family:'Newsreader',serif; font-size:1.9rem; font-weight:600; }
.eb-set .sub{ color:var(--dim); font-size:.9rem; margin-top:.4rem; }
.eb-set .wrap{ max-width:720px; margin:0 auto; padding:1.6rem 1.5rem 0; display:grid; gap:1.2rem; }
.eb-sec{ background:var(--elev); border:1px solid var(--line); border-radius:16px; padding:1.4rem; animation:ebs-in .4s cubic-bezier(.22,1,.36,1) both; }
@keyframes ebs-in{ from{opacity:0; transform:translateY(8px);} to{opacity:1; transform:none;} }
.eb-sec h2{ font-size:1rem; font-weight:650; }
.eb-sec .desc{ color:var(--dim); font-size:.82rem; margin-top:.3rem; margin-bottom:1.1rem; line-height:1.5; }
.eb-row2{ display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
@media (max-width:560px){ .eb-row2{ grid-template-columns:1fr; } }
.eb-f{ display:flex; flex-direction:column; gap:.45rem; font-size:.78rem; color:var(--dim); margin-bottom:1rem; }
.eb-f input, .eb-f select{
  background:rgba(255,255,255,.03); border:1px solid var(--line2); border-radius:9px;
  padding:.7rem .85rem; color:var(--text); font-size:.92rem; font-family:inherit; outline:none;
  transition:border-color .18s ease;
}
.eb-f input:focus, .eb-f select:focus{ border-color:var(--teal); }
.eb-f select option{ background:#131316; }
.eb-toggle-row{ display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:.85rem 0; border-bottom:1px solid var(--line); }
.eb-toggle-row:last-of-type{ border-bottom:none; }
.eb-toggle-row .t{ font-size:.9rem; font-weight:550; }
.eb-toggle-row .d{ font-size:.76rem; color:var(--dim2); margin-top:.2rem; }
.eb-sw{ width:44px; height:25px; border-radius:999px; border:1px solid var(--line2); background:rgba(255,255,255,.05); position:relative; cursor:pointer; flex-shrink:0; transition:background .25s ease, border-color .25s ease; }
.eb-sw span{ position:absolute; top:2px; left:2px; width:19px; height:19px; border-radius:50%; background:var(--dim); transition:transform .25s cubic-bezier(.22,1,.36,1), background .25s ease; }
.eb-sw.on{ background:rgba(20,201,174,.22); border-color:var(--teal); }
.eb-sw.on span{ transform:translateX(19px); background:var(--teal); }
.eb-btn{ display:inline-flex; align-items:center; gap:.45rem; padding:.62rem 1.1rem; border-radius:9px; font-size:.85rem; font-weight:600; font-family:inherit; cursor:pointer; border:1px solid var(--line2); background:transparent; color:var(--text); transition:transform .15s ease, border-color .2s ease, color .2s ease, filter .2s ease; }
.eb-btn:hover:not(:disabled){ transform:translateY(-1px); border-color:var(--teal); color:var(--teal); }
.eb-btn.filled{ background:linear-gradient(135deg,var(--teal),var(--blue)); color:#06110E; border-color:transparent; }
.eb-btn.filled:hover:not(:disabled){ filter:brightness(1.07); color:#06110E; border-color:transparent; }
.eb-btn:disabled{ opacity:.55; cursor:default; }
.eb-save{ display:flex; align-items:center; gap:.75rem; margin-top:.5rem; }
.eb-ok{ font-size:.8rem; color:var(--teal); animation:ebs-in .3s ease both; }
.eb-spin{ width:13px; height:13px; border-radius:50%; border:2px solid rgba(255,255,255,.25); border-top-color:currentColor; animation:ebs-spin .7s linear infinite; }
@keyframes ebs-spin{ to{ transform:rotate(360deg);} }
.eb-link-row{ display:flex; align-items:center; justify-content:space-between; gap:1rem; }
.eb-link-row a{ color:var(--teal); font-size:.85rem; font-weight:600; text-decoration:none; }
.eb-link-row a:hover{ text-decoration:underline; }
.eb-mono{ font-family:'IBM Plex Mono',monospace; font-size:.85rem; color:var(--dim); }
@media (prefers-reduced-motion: reduce){ .eb-set *{ animation:none !important; transition:none !important; } }
`;

const Switch = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label}
    className={`eb-sw ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
    <span />
  </button>
);

const SaveBar = ({ saving, saved, onSave }: { saving: boolean; saved: boolean; onSave: () => void }) => (
  <div className="eb-save">
    <button className="eb-btn filled" onClick={onSave} disabled={saving} type="button">
      {saving ? (<><span className="eb-spin" /> Saving…</>) : 'Save changes'}
    </button>
    {saved && !saving && <span className="eb-ok">Saved</span>}
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

const ProfileSection = () => {
  const s = useSection('profiles', { display_name: '', avatar_url: '', timezone: 'UTC' }, 'id');
  return (
    <section className="eb-sec">
      <h2>Profile</h2>
      <p className="desc">How you appear inside Edge Blast and which timezone your sessions are grouped by.</p>
      <div className="eb-row2">
        <label className="eb-f">Display name
          <input value={s.value.display_name ?? ''} onChange={(e) => s.set({ display_name: e.target.value })} placeholder="Your name" />
        </label>
        <label className="eb-f">Timezone
          <input value={s.value.timezone ?? ''} onChange={(e) => s.set({ timezone: e.target.value })} placeholder="Europe/London" />
        </label>
      </div>
      <label className="eb-f">Avatar URL
        <input value={s.value.avatar_url ?? ''} onChange={(e) => s.set({ avatar_url: e.target.value })} placeholder="https://…" />
      </label>
      <SaveBar saving={s.saving} saved={s.saved} onSave={s.save} />
    </section>
  );
};

const RulesSection = () => {
  const s = useSection('trading_rules', {
    max_risk_pct: 1, min_rr: 2, confirmation_tf: 'M15',
    entry_trigger: '', max_trades_per_day: 3, max_trades_per_week: 10,
  }, 'user_id');
  const num = (v: string) => (v === '' ? 0 : Number(v));
  return (
    <section className="eb-sec">
      <h2>Trading Rules</h2>
      <p className="desc">Your own playbook. Trades are reviewed against these limits to flag rule violations.</p>
      <div className="eb-row2">
        <label className="eb-f">Max risk per trade (%)
          <input type="number" step="0.1" value={s.value.max_risk_pct ?? ''} onChange={(e) => s.set({ max_risk_pct: num(e.target.value) })} />
        </label>
        <label className="eb-f">Minimum R:R
          <input type="number" step="0.1" value={s.value.min_rr ?? ''} onChange={(e) => s.set({ min_rr: num(e.target.value) })} />
        </label>
        <label className="eb-f">Confirmation timeframe
          <select value={s.value.confirmation_tf ?? 'M15'} onChange={(e) => s.set({ confirmation_tf: e.target.value })}>
            {['M1','M5','M15','M30','H1','H4','D1'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="eb-f">Entry trigger
          <input value={s.value.entry_trigger ?? ''} onChange={(e) => s.set({ entry_trigger: e.target.value })} placeholder="Break & retest of OB" />
        </label>
        <label className="eb-f">Max trades per day
          <input type="number" value={s.value.max_trades_per_day ?? ''} onChange={(e) => s.set({ max_trades_per_day: num(e.target.value) })} />
        </label>
        <label className="eb-f">Max trades per week
          <input type="number" value={s.value.max_trades_per_week ?? ''} onChange={(e) => s.set({ max_trades_per_week: num(e.target.value) })} />
        </label>
      </div>
      <SaveBar saving={s.saving} saved={s.saved} onSave={s.save} />
    </section>
  );
};

const NOTIFS: { key: string; title: string; desc: string }[] = [
  { key: 'trade_synced', title: 'Trade synced', desc: 'When a new trade lands from MT5.' },
  { key: 'rule_violation', title: 'Rule violation', desc: 'When a trade breaks one of your rules.' },
  { key: 'weekly_report', title: 'Weekly report', desc: 'Your performance digest every Sunday.' },
  { key: 'ai_coaching_summary', title: 'AI coaching summary', desc: 'Periodic notes from your AI coach.' },
];

const NotificationsSection = () => {
  const s = useSection<Record<string, boolean>>('notification_settings', {
    trade_synced: true, rule_violation: true, weekly_report: true, ai_coaching_summary: false,
  }, 'user_id');
  return (
    <section className="eb-sec">
      <h2>Notifications</h2>
      <p className="desc">Choose what Edge Blast tells you about.</p>
      {NOTIFS.map((n) => (
        <div className="eb-toggle-row" key={n.key}>
          <div>
            <div className="t">{n.title}</div>
            <div className="d">{n.desc}</div>
          </div>
          <Switch label={n.title} on={!!s.value[n.key]} onChange={(v) => s.set({ [n.key]: v })} />
        </div>
      ))}
      <div style={{ marginTop: '1rem' }}>
        <SaveBar saving={s.saving} saved={s.saved} onSave={s.save} />
      </div>
    </section>
  );
};

const AiCoachSection = () => {
  const s = useSection<{ enabled: boolean; coaching_frequency: string; tone: string }>('ai_coach_settings', {
    enabled: true, coaching_frequency: 'daily', tone: 'direct',
  }, 'user_id');
  return (
    <section className="eb-sec">
      <h2>AI Coach</h2>
      <p className="desc">Automated review of your trades against your rules and psychology notes.</p>
      <div className="eb-toggle-row">
        <div>
          <div className="t">Enable AI coaching</div>
          <div className="d">Turn structured feedback on or off.</div>
        </div>
        <Switch label="Enable AI coaching" on={!!s.value.enabled} onChange={(v) => s.set({ enabled: v })} />
      </div>
      <div className="eb-row2" style={{ marginTop: '1.1rem' }}>
        <label className="eb-f">Coaching frequency
          <select value={s.value.coaching_frequency} onChange={(e) => s.set({ coaching_frequency: e.target.value })}>
            <option value="after_each_trade">After each trade</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>
        <label className="eb-f">Tone
          <select value={s.value.tone} onChange={(e) => s.set({ tone: e.target.value })}>
            <option value="direct">Direct</option>
            <option value="encouraging">Encouraging</option>
            <option value="strict">Strict</option>
          </select>
        </label>
      </div>
      <SaveBar saving={s.saving} saved={s.saved} onSave={s.save} />
    </section>
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
    <section className="eb-sec">
      <h2>Account &amp; Security</h2>
      <p className="desc">Your sign-in details.</p>
      <label className="eb-f">Email
        <input value={user?.email ?? ''} readOnly />
      </label>
      <div className="eb-row2">
        <label className="eb-f">New password
          <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="••••••••" />
        </label>
        <label className="eb-f">Confirm new password
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
        </label>
      </div>
      <button className="eb-btn" onClick={change} disabled={busy} type="button">
        {busy ? (<><span className="eb-spin" /> Updating…</>) : 'Change password'}
      </button>
    </section>
  );
};

export default function SettingsPage() {
  const { connections } = useAccountScope();
  return (
    <div className="eb-set">
      <style>{styles}</style>
      <header className="hd">
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h1>Settings</h1>
          <p className="sub">Profile, rules, notifications and coaching preferences.</p>
        </div>
      </header>

      <div className="wrap">
        <section className="eb-sec">
          <div className="eb-link-row">
            <div>
              <h2>MT5 Connections</h2>
              <p className="desc" style={{ marginBottom: 0 }}>
                <span className="eb-mono">{connections.length}</span> MT5 account{connections.length === 1 ? '' : 's'} connected
              </p>
            </div>
            <Link to="/connections">Manage →</Link>
          </div>
        </section>

        <ProfileSection />
        <RulesSection />
        <NotificationsSection />
        <AiCoachSection />
        <SecuritySection />
      </div>
    </div>
  );
}
