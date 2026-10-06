import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Plus, Layers, ChevronRight, Pencil, Trash2, ListChecks, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useStrategies, type Trade } from '@/hooks/useTrades';
import { formatCurrency } from '@/lib/format';
import { IosSheet } from '@/components/IosSheet';

const SURFACE = 'bg-card border border-border rounded-[24px]';
const SHADOW = { boxShadow: 'var(--ios-sh, 0 1px 2px rgba(0,0,0,.05))' } as const;
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const tap = () => { try { navigator.vibrate?.(8); } catch { /* unsupported */ } };

const COLORS: Record<string, string> = {
  primary: 'hsl(var(--primary))', bull: 'hsl(var(--bull))', gold: 'hsl(var(--gold))', bear: 'hsl(var(--bear))',
  teal: 'hsl(190 80% 45%)', purple: 'hsl(280 70% 62%)', pink: 'hsl(330 75% 58%)',
};
const colorOf = (c?: string | null) => (c && c.startsWith('#') ? c : COLORS[c ?? ''] ?? COLORS.primary);
const tint = (col: string, a: number) => `color-mix(in srgb, ${col} ${Math.round(a * 100)}%, transparent)`;
const TIMEFRAMES = ['M5', 'M15', 'H1', 'H4', 'D1', 'W1'];
const SESSIONS = ['Asian', 'London', 'New York', 'Any'];

const num = (v: unknown) => { if (v === null || v === undefined || v === '') return null; const x = Number(v); return Number.isFinite(x) ? x : null; };

/** Real stats from the closed trades tagged to a strategy. Nothing here is estimated. */
function statsFor(list: Trade[]) {
  const n = list.length;
  const pnls = list.map((t) => Number(t.pnl ?? 0));
  const net = pnls.reduce((a, b) => a + b, 0);
  const wins = pnls.filter((v) => v > 0).length;
  const gp = pnls.filter((v) => v > 0).reduce((a, b) => a + b, 0);
  const gl = Math.abs(pnls.filter((v) => v < 0).reduce((a, b) => a + b, 0));
  const rrs = list.map((t) => num(t.risk_reward)).filter((v): v is number => v !== null && v !== 0);
  const bySym: Record<string, { n: number; net: number }> = {};
  list.forEach((t) => { const s = (bySym[t.asset] ??= { n: 0, net: 0 }); s.n++; s.net += Number(t.pnl ?? 0); });
  const syms = Object.entries(bySym).filter(([, v]) => v.n >= 2).sort((a, b) => b[1].net - a[1].net);
  const longs = list.filter((t) => t.direction !== 'short'), shorts = list.filter((t) => t.direction === 'short');
  const wr = (l: Trade[]) => (l.length ? (l.filter((t) => Number(t.pnl) > 0).length / l.length) * 100 : 0);
  return {
    n, net, wins, winRate: n ? (wins / n) * 100 : 0, pf: gl > 0 ? gp / gl : null, expectancy: n ? net / n : 0,
    avgR: rrs.length ? rrs.reduce((a, b) => a + b, 0) / rrs.length : null,
    best: syms.length >= 2 ? syms[0] : null, worst: syms.length >= 2 ? syms[syms.length - 1] : null,
    side: longs.length >= 3 && shorts.length >= 3 ? { l: wr(longs), s: wr(shorts), ln: longs.length, sn: shorts.length } : null,
  };
}

type Strat = NonNullable<ReturnType<typeof useStrategies>['data']>[number];
const Stat = ({ label, value, tone }: { label: string; value: string; tone?: 'bull' | 'bear' }) => (
  <div className="rounded-[14px] bg-secondary px-3 py-2.5">
    <div className="text-[11.5px] text-muted-foreground">{label}</div>
    <div className="text-[16px] font-semibold tabular-nums" style={tone ? { color: `hsl(var(--${tone}))` } : undefined}>{value}</div>
  </div>
);
const field = 'w-full mt-1 px-3 py-2.5 bg-secondary rounded-[14px] text-[16px] outline-none border border-transparent focus:border-primary';

export const StrategiesPanel = ({ closed }: { closed: Trade[] }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: strategies = [], isLoading } = useStrategies();
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<{ id?: string } | null>(null);
  const [tagFor, setTagFor] = useState<Strat | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const refresh = () => { qc.invalidateQueries({ queryKey: ['strategies'] }); qc.invalidateQueries({ queryKey: ['trades'] }); };
  const untagged = closed.filter((t) => !t.strategy_id).length;
  const baseline = closed.length ? closed.reduce((s, t) => s + Number(t.pnl ?? 0), 0) / closed.length : 0;

  const remove = async (s: Strat) => {
    await supabase.from('trades').update({ strategy_id: null }).eq('strategy_id', s.id);
    const { error } = await supabase.from('strategies').delete().eq('id', s.id);
    if (error) { toast.error(error.message); return; }
    tap(); setConfirmDel(null); setOpenId(null); refresh(); toast.success('Strategy deleted. Its trades are now untagged.');
  };

  if (isLoading) return <div className="h-40 rounded-[24px] bg-secondary animate-pulse" aria-busy="true" />;

  return (
    <div className="space-y-3.5">
      {closed.length > 0 && (
        <div className={`${SURFACE} p-4 flex items-center gap-3`} style={SHADOW}>
          <div className="size-10 rounded-[12px] grid place-items-center shrink-0" style={{ background: tint('hsl(var(--primary))', 0.15), color: 'hsl(var(--primary))' }}><ListChecks className="size-5" /></div>
          <div className="text-[14px]">
            <b>{closed.length - untagged} of {closed.length}</b> closed trades have a strategy.
            <span className="text-muted-foreground">{untagged > 0 ? ` Tag the other ${untagged} to see which setups actually pay.` : ' Every trade is tagged.'}</span>
          </div>
        </div>
      )}

      {strategies.length === 0 && (
        <div className={`${SURFACE} p-8 text-center`} style={SHADOW}>
          <div className="size-12 rounded-[14px] grid place-items-center mx-auto mb-3" style={{ background: tint('hsl(var(--primary))', 0.15), color: 'hsl(var(--primary))' }}><Layers className="size-6" /></div>
          <div className="font-display text-[18px] font-bold">Add your first strategy</div>
          <p className="text-[14px] text-muted-foreground mt-1">Name your setup, write its rules, then tag trades to it. Edge Blast shows its real win rate, profit factor and expectancy.</p>
        </div>
      )}

      {strategies.map((s) => {
        const mine = closed.filter((t) => t.strategy_id === s.id);
        const st = statsFor(mine);
        const col = colorOf(s.color);
        const open = openId === s.id;
        const sub = [s.market, s.timeframe, s.session].filter(Boolean).join(' · ');
        return (
          <div key={s.id} className={`${SURFACE} overflow-hidden`} style={SHADOW}>
            <button onClick={() => { tap(); setOpenId(open ? null : s.id); setConfirmDel(null); }} aria-expanded={open} className={`${FOCUS} w-full flex items-center gap-3 p-4 text-left`}>
              <div className="size-10 rounded-[12px] grid place-items-center shrink-0" style={{ background: tint(col, 0.16), color: col }}><Layers className="size-[22px]" aria-hidden /></div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[16px] truncate">{s.name}</div>
                <div className="text-[13px] text-muted-foreground truncate tabular-nums">
                  {st.n === 0 ? 'No trades tagged yet' : `${st.n} trade${st.n === 1 ? '' : 's'} · ${st.winRate.toFixed(0)}% win · ${formatCurrency(st.net)}`}
                  {sub ? ` · ${sub}` : ''}
                </div>
              </div>
              <ChevronRight className={`size-[18px] text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden />
            </button>

            {open && (
              <div className="border-t border-border p-4 space-y-4">
                {st.n === 0 ? (
                  <p className="text-[14px] text-muted-foreground">No data yet. Tag trades to this strategy and its real numbers show up here.</p>
                ) : (
                  <>
                    {st.n < 10 && <p className="text-[12.5px]" style={{ color: 'hsl(var(--gold))' }}>Early read: only {st.n} trade{st.n === 1 ? '' : 's'}. Don't trust it as a verdict until you have 10 or more.</p>}
                    <div className="grid grid-cols-3 gap-2">
                      <Stat label="Win rate" value={`${st.winRate.toFixed(0)}%`} />
                      <Stat label="Profit factor" value={st.pf === null ? 'No losses' : st.pf.toFixed(2)} />
                      <Stat label="Avg per trade" value={formatCurrency(st.expectancy)} tone={st.expectancy >= 0 ? 'bull' : 'bear'} />
                      <Stat label="Net P&L" value={formatCurrency(st.net)} tone={st.net >= 0 ? 'bull' : 'bear'} />
                      <Stat label="Avg R" value={st.avgR === null ? 'n/a' : `${st.avgR.toFixed(2)}R`} />
                      <Stat label="Trades" value={String(st.n)} />
                    </div>
                    <div className="space-y-1.5 text-[13.5px]">
                      {st.n >= 5 && <p>Compared with your average trade of {formatCurrency(baseline)}, this setup averages <b style={{ color: `hsl(var(--${st.expectancy >= baseline ? 'bull' : 'bear'}))` }}>{st.expectancy - baseline >= 0 ? '+' : ''}{formatCurrency(st.expectancy - baseline)}</b> per trade.</p>}
                      {st.best && st.worst && st.best[0] !== st.worst[0] && <p>Best pair: <b>{st.best[0]}</b> ({formatCurrency(st.best[1].net)} over {st.best[1].n} trades). Weakest: <b>{st.worst[0]}</b> ({formatCurrency(st.worst[1].net)} over {st.worst[1].n}).</p>}
                      {st.side && <p>Long win rate {st.side.l.toFixed(0)}% ({st.side.ln} trades) vs short {st.side.s.toFixed(0)}% ({st.side.sn} trades).</p>}
                    </div>
                  </>
                )}
                {[['Entry rules', s.entry_rules], ['Exit rules', s.exit_rules], ['Risk notes', s.risk_notes], ['About', s.description]].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k as string}><div className="text-[12px] font-semibold text-muted-foreground">{k}</div><p className="text-[14px] whitespace-pre-wrap">{v}</p></div>
                ))}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button onClick={() => setTagFor(s)} className={`${FOCUS} inline-flex items-center gap-1.5 h-10 px-3.5 rounded-[12px] font-semibold text-[14px] text-primary-foreground`} style={{ background: 'hsl(var(--primary))' }}><ListChecks className="size-4" /> Tag trades</button>
                  <button onClick={() => setForm({ id: s.id })} className={`${FOCUS} inline-flex items-center gap-1.5 h-10 px-3.5 rounded-[12px] bg-secondary font-semibold text-[14px]`}><Pencil className="size-4" /> Edit</button>
                  {confirmDel === s.id ? (
                    <button onClick={() => remove(s)} className={`${FOCUS} ml-auto h-10 px-3.5 rounded-[12px] font-semibold text-[14px] text-white`} style={{ background: 'hsl(var(--bear))' }}>Confirm delete</button>
                  ) : (
                    <button onClick={() => setConfirmDel(s.id)} aria-label={`Delete ${s.name}`} className={`${FOCUS} ml-auto size-10 rounded-[12px] grid place-items-center`} style={{ color: 'hsl(var(--bear))' }}><Trash2 className="size-5" /></button>
                  )}
                </div>
                {confirmDel === s.id && <p className="text-[12.5px] text-muted-foreground">Its {mine.length} tagged trade{mine.length === 1 ? '' : 's'} will become untagged. Your trades are not deleted.</p>}
              </div>
            )}
          </div>
        );
      })}

      <button onClick={() => { tap(); setForm({}); }} className={`${FOCUS} w-full h-12 rounded-[16px] font-semibold text-[15px] text-primary-foreground inline-flex items-center justify-center gap-2 active:scale-[.97] transition`} style={{ background: 'hsl(var(--primary))' }}>
        <Plus className="size-5" /> Add strategy
      </button>

      {form && <StrategyForm existing={strategies.find((x) => x.id === form.id)} names={strategies.filter((x) => x.id !== form.id).map((x) => x.name.toLowerCase())} userId={user?.id} onClose={() => setForm(null)} onSaved={() => { setForm(null); refresh(); }} />}
      {tagFor && <TagSheet strategy={tagFor} closed={closed} strategies={strategies} onClose={() => setTagFor(null)} onSaved={() => { setTagFor(null); refresh(); }} />}
    </div>
  );
};

/* ───────── add / edit ───────── */
const StrategyForm = ({ existing, names, userId, onClose, onSaved }: { existing?: Strat; names: string[]; userId?: string; onClose: () => void; onSaved: () => void }) => {
  const [v, setV] = useState({
    name: existing?.name ?? '', description: existing?.description ?? '', market: existing?.market ?? '',
    timeframe: existing?.timeframe ?? '', session: existing?.session ?? '', entry_rules: existing?.entry_rules ?? '',
    exit_rules: existing?.exit_rules ?? '', risk_notes: existing?.risk_notes ?? '', color: existing?.color ?? 'primary',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof v, x: string) => setV((p) => ({ ...p, [k]: x }));
  const name = v.name.trim();
  const dup = names.includes(name.toLowerCase());
  const valid = name.length > 0 && !dup;

  const save = async () => {
    if (!valid || !userId || saving) return;
    setSaving(true);
    const row = {
      name, description: v.description.trim() || null, market: v.market.trim() || null, timeframe: v.timeframe || null,
      session: v.session || null, entry_rules: v.entry_rules.trim() || null, exit_rules: v.exit_rules.trim() || null,
      risk_notes: v.risk_notes.trim() || null, color: v.color,
    };
    const { error } = existing
      ? await supabase.from('strategies').update(row).eq('id', existing.id)
      : await supabase.from('strategies').insert({ ...row, user_id: userId });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    tap(); toast.success(existing ? 'Strategy updated' : 'Strategy added'); onSaved();
  };

  const chips = (key: 'timeframe' | 'session', opts: string[]) => (
    <div className="flex flex-wrap gap-1.5 mt-1.5" role="group">
      {opts.map((o) => (
        <button key={o} type="button" aria-pressed={v[key] === o} onClick={() => set(key, v[key] === o ? '' : o)}
          className={`${FOCUS} px-3 h-9 rounded-full text-[13.5px] font-semibold transition ${v[key] === o ? 'text-primary-foreground' : 'bg-secondary text-foreground'}`}
          style={v[key] === o ? { background: 'hsl(var(--primary))' } : undefined}>{o}</button>
      ))}
    </div>
  );

  return (
    <IosSheet title={existing ? 'Edit strategy' : 'New strategy'} onClose={onClose}>
      <div className="space-y-3.5">
        <label className="block">
          <span className="text-[12px] text-muted-foreground ml-1">Name</span>
          <input autoFocus value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="Liquidity sweep reversal" maxLength={60} className={field} aria-invalid={dup} />
          {dup && <span className="text-[12px] ml-1" style={{ color: 'hsl(var(--bear))' }}>You already have a strategy with this name.</span>}
        </label>
        <label className="block"><span className="text-[12px] text-muted-foreground ml-1">Market</span><input value={v.market} onChange={(e) => set('market', e.target.value)} placeholder="Forex majors, Gold" className={field} /></label>
        <div><span className="text-[12px] text-muted-foreground ml-1">Timeframe</span>{chips('timeframe', TIMEFRAMES)}</div>
        <div><span className="text-[12px] text-muted-foreground ml-1">Session</span>{chips('session', SESSIONS)}</div>
        <label className="block"><span className="text-[12px] text-muted-foreground ml-1">Entry rules</span><textarea rows={3} value={v.entry_rules} onChange={(e) => set('entry_rules', e.target.value)} placeholder="What must be true before you enter?" className={field} /></label>
        <label className="block"><span className="text-[12px] text-muted-foreground ml-1">Exit rules</span><textarea rows={2} value={v.exit_rules} onChange={(e) => set('exit_rules', e.target.value)} placeholder="Where do you take profit or cut?" className={field} /></label>
        <label className="block"><span className="text-[12px] text-muted-foreground ml-1">Risk notes</span><textarea rows={2} value={v.risk_notes} onChange={(e) => set('risk_notes', e.target.value)} placeholder="Risk per trade, max trades, what to avoid" className={field} /></label>
        <label className="block"><span className="text-[12px] text-muted-foreground ml-1">About (optional)</span><textarea rows={2} value={v.description} onChange={(e) => set('description', e.target.value)} className={field} /></label>
        <div>
          <span className="text-[12px] text-muted-foreground ml-1">Color</span>
          <div className="flex gap-2.5 mt-1.5" role="group" aria-label="Color">
            {Object.keys(COLORS).map((k) => (
              <button key={k} type="button" aria-label={k} aria-pressed={v.color === k} onClick={() => set('color', k)}
                className={`${FOCUS} size-8 rounded-full grid place-items-center border-2`} style={{ background: COLORS[k], borderColor: v.color === k ? 'hsl(var(--foreground))' : 'transparent' }}>
                {v.color === k && <Check className="size-4 text-white" />}
              </button>
            ))}
          </div>
        </div>
      </div>
      <button onClick={save} disabled={!valid || saving} className={`${FOCUS} w-full h-12 mt-5 rounded-[16px] font-semibold text-[15px] text-primary-foreground disabled:opacity-40 active:scale-[.97] transition`} style={{ background: 'hsl(var(--primary))' }}>
        {saving ? 'Saving…' : existing ? 'Save changes' : 'Add strategy'}
      </button>
    </IosSheet>
  );
};

/* ───────── tag trades to a strategy ───────── */
const TagSheet = ({ strategy, closed, strategies, onClose, onSaved }: { strategy: Strat; closed: Trade[]; strategies: Strat[]; onClose: () => void; onSaved: () => void }) => {
  const hasUntagged = closed.some((t) => !t.strategy_id);
  const [onlyUntagged, setOnlyUntagged] = useState(hasUntagged);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(closed.filter((t) => t.strategy_id === strategy.id).map((t) => t.id)));
  const [saving, setSaving] = useState(false);
  const nameOf = (id: string | null) => strategies.find((x) => x.id === id)?.name;

  const rows = useMemo(() => {
    const all = [...closed].sort((a, b) => String(b.exit_at ?? '').localeCompare(String(a.exit_at ?? '')));
    return onlyUntagged ? all.filter((t) => !t.strategy_id || picked.has(t.id)) : all;
  }, [closed, onlyUntagged, picked]);

  const toAdd = closed.filter((t) => picked.has(t.id) && t.strategy_id !== strategy.id).map((t) => t.id);
  const toRemove = closed.filter((t) => !picked.has(t.id) && t.strategy_id === strategy.id).map((t) => t.id);
  const changes = toAdd.length + toRemove.length;
  const toggle = (id: string) => { tap(); setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); };

  const apply = async (ids: string[], value: string | null) => {
    for (let i = 0; i < ids.length; i += 150) {
      const { error } = await supabase.from('trades').update({ strategy_id: value }).in('id', ids.slice(i, i + 150));
      if (error) return error;
    }
    return null;
  };
  const save = async () => {
    if (!changes || saving) return;
    setSaving(true);
    const e1 = toAdd.length ? await apply(toAdd, strategy.id) : null;
    const e2 = toRemove.length ? await apply(toRemove, null) : null;
    setSaving(false);
    if (e1 || e2) { toast.error((e1 ?? e2)!.message); return; }
    toast.success(`${strategy.name}: ${toAdd.length} added, ${toRemove.length} removed`); onSaved();
  };

  return (
    <IosSheet title={`Tag trades to ${strategy.name}`} onClose={onClose}>
      <div className="flex p-[3px] rounded-[10px] bg-secondary mb-3" role="group">
        {[[true, 'Untagged'], [false, 'All trades']].map(([val, label]) => (
          <button key={String(label)} onClick={() => setOnlyUntagged(val as boolean)} aria-pressed={onlyUntagged === val}
            className={`${FOCUS} flex-1 rounded-[8px] py-1.5 text-[13px] font-semibold transition ${onlyUntagged === val ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>{label as string}</button>
        ))}
      </div>
      <div className="flex items-center justify-between text-[13px] text-muted-foreground mb-1.5 px-1">
        <span>{picked.size} selected</span>
        <button onClick={() => setPicked(new Set(rows.map((t) => t.id)))} className="font-semibold" style={{ color: 'hsl(var(--primary))' }}>Select all shown</button>
      </div>
      <div className="rounded-[18px] bg-card border border-border divide-y divide-border max-h-[46vh] overflow-auto">
        {rows.length === 0 && <div className="p-6 text-center text-[14px] text-muted-foreground">No trades to show.</div>}
        {rows.map((t) => {
          const on = picked.has(t.id), other = t.strategy_id && t.strategy_id !== strategy.id ? nameOf(t.strategy_id) : null;
          const pnl = Number(t.pnl ?? 0);
          return (
            <button key={t.id} onClick={() => toggle(t.id)} role="checkbox" aria-checked={on} className={`${FOCUS} w-full flex items-center gap-3 px-3.5 py-3 text-left`}>
              <span className="size-[22px] rounded-full grid place-items-center border-2 shrink-0 transition" style={on ? { background: 'hsl(var(--primary))', borderColor: 'hsl(var(--primary))' } : { borderColor: 'hsl(var(--border))' }}>
                {on && <Check className="size-3.5 text-primary-foreground" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold">{t.asset} <span className="font-normal text-muted-foreground">{t.direction === 'short' ? 'Short' : 'Long'}</span></span>
                <span className="block text-[12.5px] text-muted-foreground">{t.exit_at ? format(parseISO(t.exit_at), 'MMM d, yyyy') : 'No exit date'}{other ? ` · currently ${other}` : ''}</span>
              </span>
              <span className="text-[14px] font-semibold tabular-nums" style={{ color: `hsl(var(--${pnl >= 0 ? 'bull' : 'bear'}))` }}>{formatCurrency(pnl)}</span>
            </button>
          );
        })}
      </div>
      <button onClick={save} disabled={!changes || saving} className={`${FOCUS} w-full h-12 mt-4 rounded-[16px] font-semibold text-[15px] text-primary-foreground disabled:opacity-40 active:scale-[.97] transition`} style={{ background: 'hsl(var(--primary))' }}>
        {saving ? 'Saving…' : changes ? `Save ${changes} change${changes === 1 ? '' : 's'}` : 'No changes'}
      </button>
    </IosSheet>
  );
};
