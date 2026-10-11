import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { pipsBetween, getPipValue } from '@/lib/pips';
import { formatCurrency } from '@/lib/format';
import { IosSheet } from '@/components/IosSheet';
import type { Trade } from '@/hooks/useTrades';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const BARE = { background: 'transparent', border: 0, padding: 0, minHeight: 0, borderRadius: 0, boxShadow: 'none' } as const;
const tap = () => { try { navigator.vibrate?.(8); } catch { /* not supported */ } };

const local = (iso: string | null) => (iso ? format(parseISO(iso), "yyyy-MM-dd'T'HH:mm") : '');
const toNum = (s: string) => (s.trim() === '' ? null : Number(s));

const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-4">
    <h3 className="text-[13px] font-semibold text-muted-foreground px-1.5 pb-2">{title}</h3>
    <div className="bg-card border border-border rounded-[20px] px-4">{children}</div>
  </section>
);
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="flex items-center justify-between gap-4 py-3.5 border-t border-border first:border-t-0">
    <span className="text-[15px] shrink-0">{label}</span>
    <span className="flex-1 min-w-0 flex justify-end">{children}</span>
  </label>
);

/** Edit the prices, lot size and times of a trade. */
export const EditTradeSheet = ({ trade, onClose }: { trade: Trade; onClose: () => void }) => {
  const qc = useQueryClient();
  // trades that came from MT5 or an import carry a result reported by the broker
  const raw = trade as unknown as Record<string, unknown>;
  const fromBroker = !!(raw.mt5_ticket || raw.mt5_connection_id || raw.import_fingerprint);

  const [f, setF] = useState({
    entry: trade.entry_price?.toString() ?? '',
    exit: trade.exit_price?.toString() ?? '',
    stop: trade.stop_loss?.toString() ?? '',
    tp: trade.take_profit?.toString() ?? '',
    size: trade.position_size?.toString() ?? '',
    entryAt: local(trade.entry_at),
    exitAt: local(trade.exit_at),
  });
  const [recalc, setRecalc] = useState(!fromBroker);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const long = trade.direction !== 'short';
  const fees = Number(trade.fees ?? 0);

  const calc = useMemo(() => {
    const entry = toNum(f.entry), exit = toNum(f.exit), size = toNum(f.size), stop = toNum(f.stop);
    let pnl: number | null = null, pct: number | null = null, rr: number | null = null;
    if (entry && exit && size) {
      const dir = long ? 1 : -1;
      const moved = pipsBetween(entry, exit, trade.asset) * (exit >= entry ? 1 : -1);
      pnl = moved * getPipValue(trade.asset) * size * dir - fees;
      pct = ((exit - entry) / entry) * 100 * dir;
    }
    if (entry && exit && stop) {
      const risk = Math.abs(entry - stop);
      if (risk > 0) rr = (Math.abs(exit - entry) / risk) * (long ? (exit > entry ? 1 : -1) : (exit < entry ? 1 : -1));
    }
    return { pnl, pct, rr };
  }, [f.entry, f.exit, f.size, f.stop, long, fees, trade.asset]);

  const save = async () => {
    const entry = toNum(f.entry), exit = toNum(f.exit), stop = toNum(f.stop), tp = toNum(f.tp), size = toNum(f.size);
    const prices = [entry, exit, stop, tp, size];
    if (prices.some((v) => v !== null && (!Number.isFinite(v) || v <= 0))) { toast.error('Prices and lot size must be numbers above 0.'); return; }
    if (f.entryAt && f.exitAt && new Date(f.exitAt) < new Date(f.entryAt)) { toast.error('The exit time is before the entry time.'); return; }

    const patch: Record<string, unknown> = {
      entry_price: entry, exit_price: exit, stop_loss: stop, take_profit: tp, position_size: size,
      entry_at: f.entryAt ? new Date(f.entryAt).toISOString() : null,
      exit_at: f.exitAt ? new Date(f.exitAt).toISOString() : null,
    };
    if (!fromBroker) patch.status = exit !== null ? 'closed' : 'open';
    if (recalc) {
      if (exit === null) { patch.pnl = null; patch.pnl_percent = null; patch.risk_reward = null; }
      else if (calc.pnl !== null) { patch.pnl = calc.pnl; patch.pnl_percent = calc.pct; patch.risk_reward = calc.rr; }
    }

    setSaving(true);
    const { error } = await supabase.from('trades').update(patch as never).eq('id', trade.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    tap();
    qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('trade') });
    toast.success('Trade updated');
    onClose();
  };

  const num = (k: keyof typeof f, label: string) => (
    <Field label={label}>
      <input type="number" step="any" inputMode="decimal" value={f[k]} onChange={(e) => set(k, e.target.value)} placeholder="—"
        style={BARE} className="w-full text-right text-[16px] tabular-nums outline-none placeholder:text-muted-foreground/50" />
    </Field>
  );

  return (
    <IosSheet title={`Edit ${trade.asset}`} onClose={onClose}>
      <Group title="Prices">
        {num('entry', 'Entry')}{num('exit', 'Exit')}{num('stop', 'Stop loss')}{num('tp', 'Take profit')}
      </Group>
      <Group title="Lot size">{num('size', 'Lots')}</Group>
      <Group title="Time">
        <Field label="Entered"><input type="datetime-local" value={f.entryAt} onChange={(e) => set('entryAt', e.target.value)} style={BARE} className="text-right text-[16px] outline-none" /></Field>
        <Field label="Exited"><input type="datetime-local" value={f.exitAt} onChange={(e) => set('exitAt', e.target.value)} style={BARE} className="text-right text-[16px] outline-none" /></Field>
      </Group>

      <section className="mb-5">
        <div className="bg-card border border-border rounded-[20px] px-4 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[15px]">Recalculate the result</div>
              <div className="text-[12.5px] text-muted-foreground">
                {fromBroker ? 'This trade came from your broker, so its result is kept as it is unless you turn this on.' : 'Updates the result and R from the new numbers.'}
              </div>
            </div>
            <button type="button" role="switch" aria-checked={recalc} aria-label="Recalculate the result" onClick={() => { tap(); setRecalc((v) => !v); }}
              className={`${FOCUS} relative w-[51px] h-[31px] rounded-full shrink-0 transition-colors duration-200 ${recalc ? 'bg-bull' : 'bg-muted'}`}>
              <span className={`absolute top-[2px] left-[2px] size-[27px] rounded-full bg-white shadow-md transition-transform duration-200 ${recalc ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          {recalc && calc.pnl !== null && (
            <div className="flex items-baseline justify-between mt-3 pt-3 border-t border-border">
              <span className="text-[13px] text-muted-foreground">New result</span>
              <span className="text-[17px] font-semibold tabular-nums" style={{ color: calc.pnl >= 0 ? 'hsl(var(--bull))' : 'hsl(var(--bear))' }}>{formatCurrency(calc.pnl, { sign: true })}</span>
            </div>
          )}
        </div>
      </section>

      <button type="button" onClick={save} disabled={saving} className={`${FOCUS} w-full h-12 rounded-[16px] bg-primary text-primary-foreground text-[16px] font-semibold disabled:opacity-50 active:scale-[.98] transition`}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </IosSheet>
  );
};
