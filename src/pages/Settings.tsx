import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccountScope } from '@/hooks/useAccountScope';
import { toast } from 'sonner';
import { FileUp, ImageDown, Link2, User, ShieldCheck, Bell, MessageCircle, Lock } from 'lucide-react';
import ImportCsvDialog from '@/components/ImportCsvDialog';
import ImportScreenshotsDialog from '@/components/ImportScreenshotsDialog';

const styles = `
.eb-set, .eb-set *{ box-sizing:border-box; }
.eb-set{
  --bg:#0A0A0C; --elev:#131316; --teal:#14C9AE; --blue:#3D6FE5; --rose:#C98A93;
  --text:#F3F1EC; --dim:#9B9A97; --dim2:#66655F;
  --line:rgba(255,255,255,.08); --line2:rgba(255,255,255,.16);
  background:var(--bg); color:var(--text); min-height:100vh;
  font-family:'Inter',-apple-system,sans-serif; padding-bottom:4rem;
}
html.light .eb-set{
  --bg:#FAFAF9; --elev:#FFFFFF; --teal:#098070; --blue:#2F5FD1; --rose:#A85864;
  --text:#16161A; --dim:#6B6B72; --dim2:#8F8F96;
  --line:rgba(10,10,12,.08); --line2:rgba(10,10,12,.14);
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

.eb-ic{ display:none; }
/* ===== iOS phone layer: inset grouped settings in the Edge Blast palette ===== */
@media (min-width:0px){
  html .eb-set, html.light .eb-set{
    --bg:hsl(var(--background)); --elev:hsl(var(--card)); --teal:hsl(var(--primary)); --blue:hsl(var(--primary-glow)); --rose:hsl(var(--bear));
    --text:hsl(var(--foreground)); --dim:hsl(var(--muted-foreground)); --dim2:hsl(var(--muted-foreground) / .8);
    --line:hsl(var(--border)); --line2:hsl(var(--border));
    --tint:hsl(var(--primary) / .08);
    font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Inter',system-ui,sans-serif; min-height:0; padding-bottom:1rem;
  }
  .eb-set header.hd{ border-bottom:0; }
  .eb-set h1{ font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Inter',system-ui,sans-serif; font-size:34px; font-weight:800; letter-spacing:-.04em; line-height:1.1; }
  .eb-set .sub{ font-size:.9rem; }
  .eb-sec{
    border-radius:20px; padding:1.2rem 1.1rem;
    background:linear-gradient(145deg, hsl(215 22% 52% / .10), hsl(215 22% 52% / .04) 55%, transparent), hsl(var(--card));
    border:1px solid hsl(215 22% 52% / .16);
    box-shadow:0 1px 2px rgba(20,24,40,.05), 0 12px 26px -14px rgba(20,24,40,.18);
  }
  html.dark .eb-sec{ background:linear-gradient(145deg, hsl(215 22% 52% / .20), hsl(215 22% 52% / .07) 55%, transparent), hsl(var(--card)); box-shadow:inset 0 1px 0 rgba(255,255,255,.05), 0 12px 26px -14px rgba(0,0,0,.7); }
  .eb-sec h2{ display:flex; align-items:center; gap:.65rem; font-size:1.06rem; font-weight:700; letter-spacing:-.01em; }
  .eb-ic{ display:inline-grid; place-items:center; width:30px; height:30px; border-radius:9px; color:#fff; flex:none; box-shadow:0 6px 12px -6px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.35); }
  .ic-indigo{ background:linear-gradient(135deg, hsl(248 85% 64%), hsl(275 78% 64%)); }
  .ic-green{ background:linear-gradient(135deg, hsl(135 59% 46%), hsl(160 60% 44%)); }
  .ic-blue{ background:linear-gradient(135deg, hsl(211 100% 52%), hsl(195 100% 56%)); }
  .ic-orange{ background:linear-gradient(135deg, hsl(37 100% 52%), hsl(20 100% 58%)); }
  .ic-red{ background:linear-gradient(135deg, hsl(3 100% 59%), hsl(340 90% 62%)); }
  .ic-purple{ background:linear-gradient(135deg, hsl(280 68% 60%), hsl(316 80% 62%)); }
  .ic-slate{ background:linear-gradient(135deg, hsl(220 12% 48%), hsl(225 14% 38%)); }
  .eb-sec .desc{ margin-left:calc(30px + .65rem); font-size:.8rem; }
  .eb-f{ font-size:.72rem; letter-spacing:.06em; text-transform:uppercase; font-weight:650; }
  .eb-f input, .eb-f select{ background:var(--tint); border:1px solid transparent; border-radius:12px; min-height:46px; padding:.65rem .85rem; font-size:16px; text-transform:none; letter-spacing:0; font-weight:500; }
  .eb-f input:focus, .eb-f select:focus{ border-color:hsl(var(--primary)); background:hsl(var(--card)); box-shadow:0 0 0 3px hsl(var(--primary) / .15); }
  .eb-f select option{ background:hsl(var(--card)); }
  /* inset grouped rows + real iOS switch */
  .eb-toggle-row{ padding:.85rem 0; border-bottom:.5px solid var(--line); min-height:52px; }
  .eb-toggle-row .t{ font-size:1rem; font-weight:500; }
  .eb-toggle-row .d{ font-size:.78rem; }
  .eb-sw{ width:51px; height:31px; border:0; background:hsl(var(--muted)); }
  .eb-sw span{ top:2px; left:2px; width:27px; height:27px; background:#fff; box-shadow:0 2px 4px rgba(0,0,0,.28); }
  .eb-sw.on{ background:hsl(135 59% 46%); border:0; }
  html.dark .eb-sw.on{ background:hsl(135 64% 50%); }
  .eb-sw.on span{ transform:translateX(20px); background:#fff; }
  /* buttons */
  .eb-btn{ border:0; border-radius:14px; min-height:46px; padding:.7rem 1.1rem; background:var(--tint); color:hsl(var(--primary)); font-size:.95rem; }
  .eb-btn:hover:not(:disabled){ transform:none; color:hsl(var(--primary)); border:0; }
  .eb-btn:active:not(:disabled){ transform:scale(.97); }
  .eb-btn.filled, .eb-btn.filled:hover:not(:disabled){ background:hsl(var(--primary)); color:hsl(var(--primary-foreground)); }
  .eb-ok{ color:hsl(135 59% 43%); }
  .eb-link-row a{ color:hsl(var(--primary)); }
}

@media (max-width:767px){
  .eb-set header.hd{ padding:1.1rem 1rem .4rem; }
  .eb-set .wrap{ padding:.9rem 1rem 0; gap:1rem; }
  .eb-sec{ border-radius:24px; padding:1.1rem 1rem; }
}
@media (min-width:768px){ .eb-set h1{ font-size:30px; } .eb-set header.hd{ padding:2rem 1.5rem 1rem; } }
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

const ImportSection = () => {
  const [csvOpen, setCsvOpen] = useState(false);
  const [shotsOpen, setShotsOpen] = useState(false);
  return (
    <section className="eb-sec">
      <h2><i className="eb-ic ic-green"><FileUp size={15} /></i>Import data</h2>
      <p className="desc">Bring in past trades from a broker CSV or from platform screenshots.</p>
      <div className="eb-toggle-row">
        <div><div className="t">Import CSV</div><div className="d">Upload a trade history export from your broker.</div></div>
        <button type="button" className="eb-btn" onClick={() => setCsvOpen(true)}><FileUp size={15} /> Import CSV</button>
      </div>
      <div className="eb-toggle-row">
        <div><div className="t">Import screenshots</div><div className="d">Turn trade screenshots into journal entries.</div></div>
        <button type="button" className="eb-btn" onClick={() => setShotsOpen(true)}><ImageDown size={15} /> Import screenshots</button>
      </div>
      <ImportCsvDialog open={csvOpen} onOpenChange={setCsvOpen} />
      <ImportScreenshotsDialog open={shotsOpen} onOpenChange={setShotsOpen} />
    </section>
  );
};

const ProfileSection = () => {
  const s = useSection('profiles', { display_name: '', avatar_url: '', timezone: 'UTC' }, 'id');
  return (
    <section className="eb-sec">
      <h2><i className="eb-ic ic-blue"><User size={15} /></i>Profile</h2>
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
      <h2><i className="eb-ic ic-orange"><ShieldCheck size={15} /></i>Trading Rules</h2>
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
  { key: 'ai_coaching_summary', title: 'Coach summary', desc: 'Regular notes from your coach.' },
];

const NotificationsSection = () => {
  const s = useSection<Record<string, boolean>>('notification_settings', {
    trade_synced: true, rule_violation: true, weekly_report: true, ai_coaching_summary: false,
  }, 'user_id');
  return (
    <section className="eb-sec">
      <h2><i className="eb-ic ic-red"><Bell size={15} /></i>Notifications</h2>
      <p className="desc">Choose what you want to hear about.</p>
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
      <h2><i className="eb-ic ic-purple"><MessageCircle size={15} /></i>Coach</h2>
      <p className="desc">Your coach goes over your trades against your rules and notes.</p>
      <div className="eb-toggle-row">
        <div>
          <div className="t">Coach feedback</div>
          <div className="d">Get feedback on your trades.</div>
        </div>
        <Switch label="Coach feedback" on={!!s.value.enabled} onChange={(v) => s.set({ enabled: v })} />
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
      <h2><i className="eb-ic ic-slate"><Lock size={15} /></i>Account &amp; Security</h2>
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
              <h2><i className="eb-ic ic-indigo"><Link2 size={15} /></i>MT5 Connections</h2>
              <p className="desc" style={{ marginBottom: 0 }}>
                <span className="eb-mono">{connections.length}</span> MT5 account{connections.length === 1 ? '' : 's'} connected
              </p>
            </div>
            <Link to="/connections">Manage →</Link>
          </div>
        </section>

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
