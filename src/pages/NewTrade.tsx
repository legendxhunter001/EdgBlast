import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { format } from 'date-fns';
import { ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useStrategies } from '@/hooks/useTrades';
import { pipsBetween, getPipValue } from '@/lib/pips';
import { fmtRiskReward } from '@/lib/traderProfile';

const SURFACE = 'bg-card border border-border rounded-[24px]';
const SHADOW = { boxShadow: 'var(--ios-sh, 0 1px 2px rgba(0,0,0,.05))' } as const;
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const BARE = { background: 'transparent', border: 0, padding: 0, minHeight: 0, borderRadius: 0, boxShadow: 'none' } as const;
const MOODS = ['calm', 'confident', 'excited', 'neutral', 'anxious', 'fearful', 'greedy', 'frustrated'];
const tap = () => { try { navigator.vibrate?.(8); } catch { /* not supported */ } };

const Group = ({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) => (
  <section>
    <h2 className="text-[13px] font-semibold text-muted-foreground px-1.5 pb-2">{title}</h2>
    <div className={`${SURFACE} px-4`} style={SHADOW}>{children}</div>
    {note && <p className="text-[12.5px] text-muted-foreground px-1.5 pt-2">{note}</p>}
  </section>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="flex items-center justify-between gap-4 py-3.5 border-t border-border first:border-t-0 cursor-text">
    <span className="text-[15px] shrink-0">{label}</span>
    <span className="flex-1 min-w-0 flex justify-end">{children}</span>
  </label>
);

const NewTrade = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const reduce = !!useReducedMotion();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    asset: '',
    direction: 'long' as 'long' | 'short',
    entry_price: '',
    exit_price: '',
    position_size: '',
    stop_loss: '',
    take_profit: '',
    fees: '',
    entry_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    exit_at: '',
    emotional_state: 'none',
    strategy_id: 'none',
    confidence_rating: '7',
    thesis: '',
    notes: '',
  });

  const { data: strategies = [] } = useStrategies();
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const entryNum = Number(form.entry_price) || 0;
  const sizeNum = Number(form.position_size) || 0;
  const stopPips = entryNum > 0 && form.stop_loss ? pipsBetween(entryNum, Number(form.stop_loss), form.asset) : null;
  const targetPips = entryNum > 0 && form.take_profit ? pipsBetween(entryNum, Number(form.take_profit), form.asset) : null;
  const pipValue = form.asset ? getPipValue(form.asset) : 0;
  const riskAmount = stopPips !== null && sizeNum > 0 ? stopPips * pipValue * sizeNum : null;
  const potentialProfit = targetPips !== null && sizeNum > 0 ? targetPips * pipValue * sizeNum : null;

  // planned risk to reward, only when the levels make sense for the direction
  const e = Number(form.entry_price), sl = Number(form.stop_loss), tp = Number(form.take_profit);
  const haveLevels = !!form.entry_price && !!form.stop_loss && !!form.take_profit && e !== sl;
  const levelsOk = haveLevels && (form.direction === 'long' ? tp > e && e > sl : tp < e && e < sl);
  const plannedRR = levelsOk ? Math.abs(tp - e) / Math.abs(e - sl) : null;
  const levelHint = haveLevels && !levelsOk
    ? (form.direction === 'long' ? 'For a long, the stop should be below your entry and the target above it.' : 'For a short, the stop should be above your entry and the target below it.')
    : null;
  const canSave = form.asset.trim().length > 0 && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.asset.trim()) return;
    setSaving(true);

    const entry = form.entry_price ? Number(form.entry_price) : null;
    const exit = form.exit_price ? Number(form.exit_price) : null;
    const size = form.position_size ? Number(form.position_size) : null;
    const stop = form.stop_loss ? Number(form.stop_loss) : null;
    const fees = form.fees ? Number(form.fees) : 0;

    let pnl: number | null = null;
    let pnl_pct: number | null = null;
    let rr: number | null = null;

    if (entry !== null && exit !== null && size !== null) {
      const dir = form.direction === 'long' ? 1 : -1;
      const movedPips = pipsBetween(entry, exit, form.asset) * (exit >= entry ? 1 : -1);
      pnl = movedPips * getPipValue(form.asset) * size * dir - fees;
      pnl_pct = ((exit - entry) / entry) * 100 * dir;
    }
    if (entry !== null && exit !== null && stop !== null) {
      const risk = Math.abs(entry - stop);
      const reward = Math.abs(exit - entry);
      if (risk > 0) rr = reward / risk * (form.direction === 'long' ? (exit > entry ? 1 : -1) : (exit < entry ? 1 : -1));
    }

    const { data, error } = await supabase.from('trades').insert({
      user_id: user.id,
      asset: form.asset.trim().toUpperCase(),
      direction: form.direction,
      status: form.exit_price ? 'closed' : 'open',
      entry_price: entry,
      exit_price: exit,
      position_size: size,
      stop_loss: stop,
      take_profit: form.take_profit ? Number(form.take_profit) : null,
      fees,
      pnl,
      pnl_percent: pnl_pct,
      risk_reward: rr,
      entry_at: form.entry_at ? new Date(form.entry_at).toISOString() : null,
      exit_at: form.exit_at ? new Date(form.exit_at).toISOString() : null,
      emotional_state: (form.emotional_state === 'none' ? null : form.emotional_state) as any,
      strategy_id: form.strategy_id === 'none' ? null : form.strategy_id,
      confidence_rating: Number(form.confidence_rating),
      thesis: form.thesis || null,
      notes: form.notes || null,
    }).select().single();

    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Trade logged');
    qc.invalidateQueries({ queryKey: ['trades'] });
    navigate(`/trades/${data.id}`);
  };

  return (
    <form onSubmit={handleSubmit} className="px-4 md:px-8 pt-3 pb-10 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <Link to="/trades" className={`${FOCUS} inline-flex items-center -ml-1.5 text-[17px] font-medium rounded`} style={{ color: 'hsl(var(--primary))' }}>
          <ChevronLeft className="size-6" aria-hidden /> Trades
        </Link>
        <button type="submit" disabled={!canSave} className={`${FOCUS} h-9 px-4 rounded-full bg-primary text-primary-foreground text-[15px] font-semibold disabled:opacity-40 active:scale-95 transition`}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <h1 className="font-display text-[34px] leading-[1.1] font-bold tracking-tight mt-3">New trade</h1>
      <p className="text-[14px] text-muted-foreground mt-1 mb-5">Log it while it's fresh. Only the pair is required.</p>

      <div className="space-y-5">
        <Group title="Trade">
          <Field label="Pair">
            <input required value={form.asset} onChange={(ev) => set('asset', ev.target.value.toUpperCase())} placeholder="EURUSD" autoCapitalize="characters" autoComplete="off"
              style={BARE} className="w-full text-right text-[16px] font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground/60" />
          </Field>
          <div className="py-3 border-t border-border">
            <div className="flex p-[3px] rounded-[12px] bg-secondary" role="group" aria-label="Direction">
              {(['long', 'short'] as const).map((d) => {
                const on = form.direction === d;
                return (
                  <button key={d} type="button" aria-pressed={on} onClick={() => { tap(); set('direction', d); }}
                    className={`${FOCUS} relative flex-1 h-10 rounded-[10px] text-[15px] font-semibold transition-colors ${on ? 'text-white' : 'text-muted-foreground'}`}>
                    {on && <motion.span layoutId="dir-thumb" className="absolute inset-0 rounded-[10px]" style={{ background: d === 'long' ? 'hsl(var(--bull))' : 'hsl(var(--bear))' }} transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }} />}
                    <span className="relative">{d === 'long' ? 'Long' : 'Short'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </Group>

        <Group title="Prices">
          {([['Entry', 'entry_price'], ['Stop loss', 'stop_loss'], ['Take profit', 'take_profit'], ['Exit (when closed)', 'exit_price'], ['Position size', 'position_size'], ['Fees', 'fees']] as const).map(([label, key]) => (
            <Field key={key} label={label}>
              <input type="number" step="any" inputMode="decimal" value={form[key]} onChange={(ev) => set(key, ev.target.value)} placeholder="0"
                style={BARE} className="w-full text-right text-[16px] tabular-nums outline-none placeholder:text-muted-foreground/50" />
            </Field>
          ))}
        </Group>

        <section aria-live="polite">
          <h2 className="text-[13px] font-semibold text-muted-foreground px-1.5 pb-2">Your plan</h2>
          <div className={`${SURFACE} p-4`} style={SHADOW}>
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] text-muted-foreground">Risk : reward</span>
              <span className="font-display text-[30px] leading-none font-bold tabular-nums">{fmtRiskReward(plannedRR)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="rounded-[14px] bg-secondary px-3 py-2.5">
                <div className="text-[12px] text-muted-foreground">Stop distance</div>
                <div className="text-[17px] font-semibold tabular-nums">{stopPips !== null ? `${stopPips.toFixed(1)} pips` : '—'}</div>
                {riskAmount !== null && <div className="text-[12.5px] tabular-nums" style={{ color: 'hsl(var(--bear))' }}>-${riskAmount.toFixed(2)} at risk</div>}
                {stopPips !== null && riskAmount === null && <div className="text-[12px] text-muted-foreground">Add a size for the dollar risk</div>}
              </div>
              <div className="rounded-[14px] bg-secondary px-3 py-2.5">
                <div className="text-[12px] text-muted-foreground">Target distance</div>
                <div className="text-[17px] font-semibold tabular-nums">{targetPips !== null ? `${targetPips.toFixed(1)} pips` : '—'}</div>
                {potentialProfit !== null && <div className="text-[12.5px] tabular-nums" style={{ color: 'hsl(var(--bull))' }}>+${potentialProfit.toFixed(2)} if hit</div>}
                {targetPips !== null && potentialProfit === null && <div className="text-[12px] text-muted-foreground">Add a size for the dollar profit</div>}
              </div>
            </div>
            {levelHint && <p className="text-[12.5px] mt-3" style={{ color: 'hsl(var(--gold))' }}>{levelHint}</p>}
            {!haveLevels && <p className="text-[12.5px] text-muted-foreground mt-3">Add an entry, stop and target to see your planned risk to reward.</p>}
          </div>
        </section>

        <Group title="Time">
          <Field label="Entered">
            <input type="datetime-local" value={form.entry_at} onChange={(ev) => set('entry_at', ev.target.value)} style={BARE} className="text-right text-[16px] outline-none" />
          </Field>
          <Field label="Exited">
            <input type="datetime-local" value={form.exit_at} onChange={(ev) => set('exit_at', ev.target.value)} style={BARE} className="text-right text-[16px] outline-none" />
          </Field>
        </Group>

        <Group title="Mind and setup" note="Mood is optional. Leave it unset if you don't want it counted.">
          <Field label="Strategy">
            <select value={form.strategy_id} onChange={(ev) => set('strategy_id', ev.target.value)} style={{ ...BARE, textAlign: 'right' }} className="text-[16px] outline-none max-w-full">
              <option value="none">None</option>
              {strategies.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
            </select>
          </Field>
          <div className="py-3.5 border-t border-border">
            <div className="text-[15px] mb-2.5">How did you feel going in?</div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Mood">
              {MOODS.map((m) => {
                const on = form.emotional_state === m;
                return (
                  <button key={m} type="button" aria-pressed={on} onClick={() => { tap(); set('emotional_state', on ? 'none' : m); }}
                    className={`${FOCUS} h-9 px-3.5 rounded-full text-[14px] font-semibold capitalize transition active:scale-95 ${on ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}>{m}</button>
                );
              })}
            </div>
          </div>
          <div className="py-3.5 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[15px]">Confidence</span>
              <span className="text-[15px] font-semibold tabular-nums">{form.confidence_rating} of 10</span>
            </div>
            <input type="range" min={1} max={10} step={1} value={form.confidence_rating} onChange={(ev) => set('confidence_rating', ev.target.value)} aria-label="Confidence from 1 to 10"
              style={{ ...BARE, width: '100%', accentColor: 'hsl(var(--primary))' }} />
          </div>
        </Group>

        <Group title="Notes">
          <div className="py-3.5">
            <div className="text-[13px] text-muted-foreground mb-1.5">Why are you taking this trade?</div>
            <textarea rows={3} value={form.thesis} onChange={(ev) => set('thesis', ev.target.value)} style={BARE} className="w-full text-[16px] outline-none resize-none" placeholder="Your reasoning" />
          </div>
          <div className="py-3.5 border-t border-border">
            <div className="text-[13px] text-muted-foreground mb-1.5">Anything else</div>
            <textarea rows={3} value={form.notes} onChange={(ev) => set('notes', ev.target.value)} style={BARE} className="w-full text-[16px] outline-none resize-none" placeholder="Notes" />
          </div>
        </Group>

        <button type="submit" disabled={!canSave} className={`${FOCUS} w-full h-12 rounded-[16px] bg-primary text-primary-foreground text-[16px] font-semibold disabled:opacity-40 active:scale-[.98] transition`}>
          {saving ? 'Saving…' : 'Save trade'}
        </button>
      </div>
    </form>
  );
};

export default NewTrade;
