import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const NewTrade = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
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
    entry_at: new Date().toISOString().slice(0, 16),
    exit_at: '',
    emotional_state: 'neutral',
    confidence_rating: '7',
    thesis: '',
    notes: '',
  });

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

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
      pnl = (exit - entry) * size * dir - fees;
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
      emotional_state: form.emotional_state as any,
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
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <Link to="/trades" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition">
        <ArrowLeft className="size-4" /> Back to trades
      </Link>

      <h1 className="font-display text-3xl font-semibold mb-1">Log a new trade</h1>
      <p className="text-sm text-muted-foreground mb-8">Capture the data, the reasoning, and the psychology.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="glass rounded-xl p-6 space-y-4">
          <h3 className="font-display font-semibold">Trade details</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Asset / pair *</Label>
              <Input required value={form.asset} onChange={e => set('asset', e.target.value)} placeholder="BTCUSD" />
            </div>
            <div className="space-y-1.5">
              <Label>Direction</Label>
              <Select value={form.direction} onValueChange={v => set('direction', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Entry price</Label>
              <Input type="number" step="any" value={form.entry_price} onChange={e => set('entry_price', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Exit price</Label>
              <Input type="number" step="any" value={form.exit_price} onChange={e => set('exit_price', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Position size</Label>
              <Input type="number" step="any" value={form.position_size} onChange={e => set('position_size', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fees</Label>
              <Input type="number" step="any" value={form.fees} onChange={e => set('fees', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Stop loss</Label>
              <Input type="number" step="any" value={form.stop_loss} onChange={e => set('stop_loss', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Take profit</Label>
              <Input type="number" step="any" value={form.take_profit} onChange={e => set('take_profit', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Entry time</Label>
              <Input type="datetime-local" value={form.entry_at} onChange={e => set('entry_at', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Exit time</Label>
              <Input type="datetime-local" value={form.exit_at} onChange={e => set('exit_at', e.target.value)} />
            </div>
          </div>
        </section>

        <section className="glass rounded-xl p-6 space-y-4">
          <h3 className="font-display font-semibold">Psychology</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Emotional state</Label>
              <Select value={form.emotional_state} onValueChange={v => set('emotional_state', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['calm','confident','anxious','fearful','greedy','frustrated','excited','neutral'].map(e =>
                    <SelectItem key={e} value={e}>{e[0].toUpperCase()+e.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Confidence (1–10)</Label>
              <Input type="number" min={1} max={10} value={form.confidence_rating} onChange={e => set('confidence_rating', e.target.value)} />
            </div>
          </div>
        </section>

        <section className="glass rounded-xl p-6 space-y-4">
          <h3 className="font-display font-semibold">Notes</h3>
          <div className="space-y-1.5">
            <Label>Thesis</Label>
            <Textarea rows={3} value={form.thesis} onChange={e => set('thesis', e.target.value)} placeholder="Why are you taking this trade?" />
          </div>
          <div className="space-y-1.5">
            <Label>Quick notes</Label>
            <Textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </section>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving} className="bg-gradient-bull text-primary-foreground shadow-glow-bull">
            {saving ? 'Saving…' : 'Save trade'}
          </Button>
          <Link to="/trades"><Button type="button" variant="ghost">Cancel</Button></Link>
        </div>
      </form>
    </div>
  );
};

export default NewTrade;
