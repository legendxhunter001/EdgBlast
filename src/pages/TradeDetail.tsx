import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTrade, useScreenshots, useStrategies } from '@/hooks/useTrades';
import { useCountUp } from '@/hooks/useCountUp';
import { IosSheet } from '@/components/IosSheet';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2, Upload, X, CheckCircle2, Loader2, ChevronLeft, ChevronRight, Star, ZoomIn, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { formatCurrency, formatPct, pnlClass } from '@/lib/format';
import { DirectionBadge } from './Dashboard';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SymbolLogo } from '@/components/SymbolLogo';

const KINDS = [
  { kind: 'entry' as const, label: 'Entry' },
  { kind: 'exit' as const, label: 'Exit' },
  { kind: 'analysis' as const, label: 'Post-trade analysis' },
];

type StepId = 'overview' | 'entry' | 'exit' | 'psychology' | 'lessons' | 'rating';
const STEPS: { id: StepId; label: string; desc: string }[] = [
  { id: 'overview', label: 'Overview', desc: 'Trade summary & thesis' },
  { id: 'entry', label: 'Entry review', desc: 'Setup, reasoning, screenshot' },
  { id: 'exit', label: 'Exit review', desc: 'Execution & exit logic' },
  { id: 'psychology', label: 'Psychology', desc: 'Mental state & discipline' },
  { id: 'lessons', label: 'Lessons', desc: 'Wins, mistakes & takeaways' },
  { id: 'rating', label: 'Final rating', desc: 'Score this trade' },
];

const TradeDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: trade, isLoading } = useTrade(id);
  const { data: shots, refetch: refetchShots } = useScreenshots(id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: strategies = [] } = useStrategies();
  const shownPnl = useCountUp(trade && trade.pnl !== null ? Number(trade.pnl) : null);
  const [confirmDel, setConfirmDel] = useState(false);

  const [step, setStep] = useState<StepId>('overview');
  const [fields, setFields] = useState({
    thesis: '', entry_reasoning: '', exit_reasoning: '', execution_notes: '',
    psychology_review: '', mistakes: '', what_went_well: '', lessons_learned: '', notes: '',
  });
  const [rating, setRating] = useState<number>(0);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimer = useRef<number | undefined>(undefined);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (trade) {
      setFields({
        thesis: trade.thesis ?? '',
        entry_reasoning: trade.entry_reasoning ?? '',
        exit_reasoning: trade.exit_reasoning ?? '',
        execution_notes: trade.execution_notes ?? '',
        psychology_review: trade.psychology_review ?? '',
        mistakes: trade.mistakes ?? '',
        what_went_well: trade.what_went_well ?? '',
        lessons_learned: trade.lessons_learned ?? '',
        notes: trade.notes ?? '',
      });
      setRating(trade.review_score ?? 0);
    }
  }, [trade?.id]);

  const persist = (payload: Record<string, any>) => {
    if (!id) return;
    setSaving('saving');
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const { error } = await supabase.from('trades').update(payload as any).eq('id', id);
      if (!error) {
        setSaving('saved');
        qc.invalidateQueries({ queryKey: ['trade', id] });
        window.setTimeout(() => setSaving('idle'), 1800);
      } else {
        setSaving('idle');
        toast.error(error.message);
      }
    }, 600);
  };

  const updateField = (k: keyof typeof fields, v: string) => {
    setFields(f => ({ ...f, [k]: v }));
    persist({ [k]: v || null });
  };

  const setReviewScore = (n: number) => {
    setRating(n);
    persist({ review_score: n });
  };

  const handleUpload = async (kind: 'entry' | 'exit' | 'analysis', file: File) => {
    if (!user || !id) return;
    const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
    if (!ALLOWED.includes(file.type)) {
      toast.error('Only image files are allowed (JPG, PNG, GIF, WEBP, AVIF)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB');
      return;
    }
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/${id}/${kind}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('trade-screenshots').upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) return toast.error(upErr.message);
    const { data: signed } = await supabase.storage.from('trade-screenshots').createSignedUrl(path, 60 * 60);

    const existing = shots?.find(s => s.kind === kind);
    if (existing) {
      await supabase.storage.from('trade-screenshots').remove([existing.storage_path]);
      await supabase.from('trade_screenshots').delete().eq('id', existing.id);
    }
    const { error } = await supabase.from('trade_screenshots').insert({
      trade_id: id, user_id: user.id, kind, url: signed?.signedUrl ?? '', storage_path: path,
    });
    if (error) return toast.error(error.message);
    toast.success('Screenshot uploaded');
    refetchShots();
  };

  const handleRemoveShot = async (shotId: string, path: string) => {
    await supabase.storage.from('trade-screenshots').remove([path]);
    await supabase.from('trade_screenshots').delete().eq('id', shotId);
    refetchShots();
  };

  const setStrategy = async (value: string) => {
    if (!id) return;
    const { error } = await supabase.from('trades').update({ strategy_id: value || null }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('trade') });
    toast.success(value ? 'Strategy set' : 'Strategy removed');
  };

  const handleDelete = async () => {
    if (!id) return;
    await supabase.from('trades').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['trades'] });
    toast.success('Trade deleted');
    navigate('/trades');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA/)) return;
      if (e.key === 'Escape' && lightbox) setLightbox(null);
      if (e.key === 'ArrowRight') setStep(s => STEPS[Math.min(STEPS.findIndex(x => x.id === s) + 1, STEPS.length - 1)].id);
      if (e.key === 'ArrowLeft') setStep(s => STEPS[Math.max(STEPS.findIndex(x => x.id === s) - 1, 0)].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  if (isLoading) {
    return (
      <div className="px-4 md:px-8 pt-3 pb-10 max-w-3xl mx-auto space-y-4" aria-busy="true">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-[290px] rounded-[24px]" />
        <Skeleton className="h-[120px] rounded-[24px]" />
        <Skeleton className="h-[260px] rounded-[24px]" />
      </div>
    );
  }
  if (!trade) {
    return (
      <div className="px-4 md:px-8 pt-3 pb-10 max-w-3xl mx-auto">
        <Link to="/trades" className="inline-flex items-center -ml-1.5 text-[17px] font-medium" style={{ color: 'hsl(var(--primary))' }}><ChevronLeft className="size-6" /> Trades</Link>
        <div className="bg-card border border-border rounded-[24px] p-8 text-center mt-4">
          <div className="font-display text-[18px] font-bold">Trade not found</div>
          <p className="text-[14px] text-muted-foreground mt-1">It may have been deleted, or the link is wrong.</p>
        </div>
      </div>
    );
  }

  const stepIndex = STEPS.findIndex(s => s.id === step);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;
  const stepDef = STEPS[stepIndex];

  return (
    <div className="px-4 md:px-8 pt-3 pb-10 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link to="/trades" className="inline-flex items-center -ml-1.5 text-[17px] font-medium rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" style={{ color: 'hsl(var(--primary))' }}>
          <ChevronLeft className="size-6" aria-hidden /> Trades
        </Link>
        <div className="flex items-center gap-2">
          <SaveIndicator state={saving} />
          <button onClick={() => setConfirmDel(true)} aria-label="Delete trade" className="size-10 rounded-full grid place-items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" style={{ color: 'hsl(var(--bear))' }}>
            <Trash2 className="size-5" />
          </button>
        </div>
      </div>

      <section className="bg-card border border-border rounded-[24px] p-5 md:p-6" style={{ boxShadow: 'var(--ios-sh, 0 1px 2px rgba(0,0,0,.05))' }}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-[28px] leading-tight font-bold tracking-tight flex items-center gap-2.5"><SymbolLogo symbol={trade.asset} size={32} />{trade.asset}</h1>
            <div className="text-[14px] text-muted-foreground mt-1">
              {trade.direction === 'short' ? 'Short' : 'Long'}
              {trade.entry_at && <> · {format(parseISO(trade.entry_at), 'MMM d, yyyy, HH:mm')}</>}
              {trade.exit_at && <> to {format(parseISO(trade.exit_at), 'HH:mm')}</>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[12.5px] text-muted-foreground">Result</div>
            {trade.pnl === null
              ? <div className="font-display text-[26px] leading-none font-bold mt-1">Open</div>
              : <div className="font-display text-[32px] leading-none font-bold tracking-tight tabular-nums mt-1" style={{ color: Number(trade.pnl) >= 0 ? 'hsl(var(--bull))' : 'hsl(var(--bear))' }}>{formatCurrency(shownPnl, { sign: true })}</div>}
            {trade.pnl_percent !== null && <div className="text-[13px] tabular-nums text-muted-foreground mt-1">{formatPct(trade.pnl_percent, { sign: true })}</div>}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 sm:gap-x-10 mt-4">
          <Row label="Entry">{trade.entry_price ?? '—'}</Row>
          <Row label="Exit">{trade.exit_price ?? '—'}</Row>
          <Row label="Stop">{trade.stop_loss ?? '—'}</Row>
          <Row label="Target">{trade.take_profit ?? '—'}</Row>
          <Row label="Size">{trade.position_size ?? '—'}</Row>
          <Row label="Result in R">{trade.risk_reward ? `${Number(trade.risk_reward).toFixed(2)}R` : '—'}</Row>
          <Row label="Confidence">{trade.confidence_rating ? `${trade.confidence_rating} of 10` : '—'}</Row>
          <Row label="Mood"><span className="capitalize">{trade.emotional_state ?? '—'}</span></Row>
          <Row label="Strategy">
            <select value={trade.strategy_id ?? ''} onChange={(e) => setStrategy(e.target.value)} aria-label="Strategy"
              className="bg-secondary rounded-[10px] px-2.5 py-1.5 text-[14px] max-w-[11rem] outline-none focus:ring-2 focus:ring-primary">
              <option value="">None</option>
              {strategies.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
            </select>
          </Row>
        </div>
      </section>

      <section className="bg-card border border-border rounded-[24px] p-4 md:p-5" style={{ boxShadow: 'var(--ios-sh, 0 1px 2px rgba(0,0,0,.05))' }}>
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <div className="text-[17px] font-semibold">{stepDef.label}</div>
            <div className="text-[13px] text-muted-foreground">{stepDef.desc}</div>
          </div>
          <div className="text-[13px] text-muted-foreground tabular-nums shrink-0">{stepIndex + 1} of {STEPS.length}</div>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1" role="tablist" aria-label="Review steps">
          {STEPS.map((st, i) => {
            const active = st.id === step, done = i < stepIndex;
            return (
              <button key={st.id} role="tab" aria-selected={active} onClick={() => setStep(st.id)}
                className={cn('shrink-0 h-9 px-3.5 rounded-full text-[14px] font-semibold inline-flex items-center gap-1.5 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  active ? 'bg-primary text-primary-foreground' : done ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground')}>
                {done && <CheckCircle2 className="size-3.5" />}{st.label}
              </button>
            );
          })}
        </div>
      </section>

      {confirmDel && (
        <IosSheet title="Delete this trade?" onClose={() => setConfirmDel(false)}>
          <p className="text-[14px] text-muted-foreground mb-4">This removes the trade and everything you wrote about it. It can't be undone.</p>
          <button onClick={handleDelete} className="w-full h-12 rounded-[16px] font-semibold text-[15px] text-white active:scale-[.97] transition" style={{ background: 'hsl(var(--bear))' }}>Delete trade</button>
        </IosSheet>
      )}

      <div key={step} className="animate-fade-up">
        {step === 'overview' && (
          <div className="space-y-5">
            <JournalField label="Trade thesis" placeholder="What was the underlying idea? Market context, key levels, catalyst…" value={fields.thesis} onChange={v => updateField('thesis', v)} large />
            <ScreenshotGrid shots={shots} onUpload={handleUpload} onRemove={handleRemoveShot} onZoom={setLightbox} />
          </div>
        )}

        {step === 'entry' && (
          <div className="space-y-5">
            <JournalField label="Entry reasoning" placeholder="Why did you take this entry? Setup, confluences, timing…" value={fields.entry_reasoning} onChange={v => updateField('entry_reasoning', v)} large />
            <SingleSlot kind="entry" label="Entry screenshot" shots={shots} onUpload={handleUpload} onRemove={handleRemoveShot} onZoom={setLightbox} />
          </div>
        )}

        {step === 'exit' && (
          <div className="space-y-5">
            <JournalField label="Exit reasoning" placeholder="Why did you exit when you did? Did you follow your plan?" value={fields.exit_reasoning} onChange={v => updateField('exit_reasoning', v)} large />
            <JournalField label="Execution notes" placeholder="How was your execution? Slippage, hesitation, scaling…" value={fields.execution_notes} onChange={v => updateField('execution_notes', v)} />
            <SingleSlot kind="exit" label="Exit screenshot" shots={shots} onUpload={handleUpload} onRemove={handleRemoveShot} onZoom={setLightbox} />
          </div>
        )}

        {step === 'psychology' && (
          <div className="space-y-5">
            <JournalField label="Psychology review" placeholder="How were you feeling? Emotional triggers, discipline, focus level…" value={fields.psychology_review} onChange={v => updateField('psychology_review', v)} large />
          </div>
        )}

        {step === 'lessons' && (
          <div className="grid gap-5 lg:grid-cols-2">
            <JournalField label="What went well" placeholder="Strengths to repeat" value={fields.what_went_well} onChange={v => updateField('what_went_well', v)} accent="bull" />
            <JournalField label="Mistakes made" placeholder="Errors to avoid" value={fields.mistakes} onChange={v => updateField('mistakes', v)} accent="bear" />
            <div className="lg:col-span-2"><JournalField label="Lessons learned" placeholder="The single biggest takeaway from this trade" value={fields.lessons_learned} onChange={v => updateField('lessons_learned', v)} accent="accent" large /></div>
            <div className="lg:col-span-2"><SingleSlot kind="analysis" label="Post-trade analysis screenshot" shots={shots} onUpload={handleUpload} onRemove={handleRemoveShot} onZoom={setLightbox} /></div>
          </div>
        )}

        {step === 'rating' && (
          <div className="bg-card border border-border rounded-[24px] p-6 md:p-8 text-center space-y-5">
            <div>
              <div className="text-[12.5px] text-muted-foreground">Final rating</div>
              <h3 className="font-display text-2xl mt-1">How well did you execute this trade?</h3>
              <p className="text-sm text-muted-foreground mt-1">Score the quality of execution, not the outcome.</p>
            </div>
            <div className="flex justify-center gap-1.5">
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button
                  key={n}
                  onClick={() => setReviewScore(n)}
                  className={cn(
                    'tap size-9 md:size-10 rounded-lg press transition-all flex items-center justify-center tabular-nums text-sm font-semibold',
                    rating >= n
                      ? 'bg-primary text-primary-foreground shadow-sm scale-105'
                      : 'bg-secondary text-muted-foreground hover:bg-muted'
                  )}
                  aria-label={`Rate ${n}/10`}
                >
                  {n}
                </button>
              ))}
            </div>
            {rating > 0 && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 text-gold animate-scale-in">
                <Star className="size-4 fill-current" />
                <span className="text-sm font-semibold">{rating}/10, saved</span>
              </div>
            )}
            <div>
              <JournalField label="Additional notes" placeholder="Anything else worth remembering?" value={fields.notes} onChange={v => updateField('notes', v)} />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          variant="outline"
          disabled={stepIndex === 0}
          onClick={() => setStep(STEPS[stepIndex - 1].id)}
          className="press tap"
        >
          <ChevronLeft className="size-4 mr-1" /> Previous
        </Button>
        <div className="hidden sm:flex gap-1.5">
          {STEPS.map((s, i) => (
            <span key={s.id} className={cn('h-1.5 rounded-full transition-all', i === stepIndex ? 'w-6 bg-primary' : i < stepIndex ? 'w-1.5 bg-primary/40' : 'w-1.5 bg-muted')} />
          ))}
        </div>
        <Button
          disabled={stepIndex === STEPS.length - 1}
          onClick={() => setStep(STEPS[stepIndex + 1].id)}
          className="press tap bg-primary text-primary-foreground shadow-sm hover:opacity-90"
        >
          Next <ChevronRight className="size-4 ml-1" />
        </Button>
      </div>

      <ImportedDataSection trade={trade} />

      {lightbox && (
        <Lightbox url={lightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
};

const ImportedDataSection = ({ trade }: { trade: any }) => {
  const raw = trade?.raw_import_data as Record<string, string> | null | undefined;
  const [open, setOpen] = useState(false);
  if (!raw || typeof raw !== 'object') return null;

  const entries = Object.entries(raw).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '');
  if (entries.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-[24px] p-5">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between text-left">
        <div>
          <div className="text-[12.5px] text-muted-foreground">From your CSV import</div>
          <div className="text-section mt-0.5">All original columns ({entries.length})</div>
        </div>
        <ChevronRight className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-90')} />
      </button>
      {open && (
        <div className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-3">
          {entries.map(([key, value]) => (
            <div key={key} className="min-w-0">
              <div className="text-[11px] text-muted-foreground font-semibold truncate">{key}</div>
              <div className="text-sm mt-0.5 whitespace-pre-wrap break-words">{String(value)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SaveIndicator = ({ state }: { state: 'idle' | 'saving' | 'saved' }) => {
  if (state === 'idle') return null;
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-xs text-muted-foreground animate-fade-up">
      {state === 'saving' ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3 text-bull" />}
      {state === 'saving' ? 'Saving…' : 'Saved'}
    </div>
  );
};

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4 py-3 border-t border-border first:border-t-0 sm:[&:nth-child(2)]:border-t-0">
    <span className="text-[14px] text-muted-foreground">{label}</span>
    <span className="text-[15px] font-medium tabular-nums text-right">{children}</span>
  </div>
);

const Stat = ({ label, value, capitalize }: { label: string; value: any; capitalize?: boolean }) => (
  <div>
    <div className="text-[12.5px] text-muted-foreground">{label}</div>
    <div className={cn('tabular-nums text-sm mt-1', capitalize && 'capitalize font-sans')}>{value}</div>
  </div>
);

const JournalField = ({ label, value, onChange, accent, placeholder, large }: { label: string; value: string; onChange: (v: string) => void; accent?: 'bull' | 'bear' | 'accent'; placeholder?: string; large?: boolean }) => (
  <div className="bg-card border border-border rounded-[24px] p-5">
    <div className="flex items-center gap-2 mb-3">
      {accent && <div className={cn('size-1.5 rounded-full', accent === 'bull' ? 'bg-bull' : accent === 'bear' ? 'bg-bear' : 'bg-primary')} />}
      <h4 className="text-section">{label}</h4>
    </div>
    <Textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={large ? 6 : 4}
      placeholder={placeholder ?? `Write your ${label.toLowerCase()}…`}
      className="bg-secondary/40 border-border/60 resize-none focus-visible:ring-primary/40"
    />
  </div>
);

const ScreenshotGrid = ({ shots, onUpload, onRemove, onZoom }: any) => (
  <div className="bg-card border border-border rounded-[24px] p-5">
    <div className="flex items-center gap-2 mb-3">
      <Camera className="size-4 text-primary" />
      <h4 className="text-section">Screenshots</h4>
      <span className="text-xs text-muted-foreground ml-auto">3 slots</span>
    </div>
    <div className="grid md:grid-cols-3 gap-3">
      {KINDS.map(({ kind, label }) => {
        const shot = shots?.find((s: any) => s.kind === kind);
        return (
          <ScreenshotSlot key={kind} kind={kind} label={label} url={shot?.url}
            onUpload={(f: File) => onUpload(kind, f)}
            onRemove={shot ? () => onRemove(shot.id, shot.storage_path) : undefined}
            onZoom={onZoom}
          />
        );
      })}
    </div>
  </div>
);

const SingleSlot = ({ kind, label, shots, onUpload, onRemove, onZoom }: any) => {
  const shot = shots?.find((s: any) => s.kind === kind);
  return (
    <div className="bg-card border border-border rounded-[24px] p-5">
      <div className="flex items-center gap-2 mb-3">
        <Camera className="size-4 text-primary" />
        <h4 className="text-section">{label}</h4>
      </div>
      <ScreenshotSlot kind={kind} label={label} url={shot?.url}
        onUpload={(f: File) => onUpload(kind, f)}
        onRemove={shot ? () => onRemove(shot.id, shot.storage_path) : undefined}
        onZoom={onZoom}
        tall
      />
    </div>
  );
};

const ScreenshotSlot = ({ kind, label, url, onUpload, onRemove, onZoom, tall }: { kind: string; label: string; url?: string; onUpload: (f: File) => void; onRemove?: () => void; onZoom: (url: string) => void; tall?: boolean }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.[0]) return;
    setUploading(true);
    try { await onUpload(files[0]); } finally { setUploading(false); }
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
      className={cn(
        'relative rounded-xl border-2 border-dashed transition-all duration-300 overflow-hidden cursor-pointer group',
        tall ? 'aspect-[16/10]' : 'aspect-video',
        drag ? 'border-primary bg-primary/10 scale-[1.01]' : 'border-border bg-secondary/30 hover:border-primary/50 hover:bg-secondary/50'
      )}
      onClick={() => !url && inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFiles(e.target.files)} />
      {url ? (
        <>
          <img src={url} alt={label} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onZoom(url); }}
            className="absolute inset-0 bg-background/0 group-hover:bg-background/60 backdrop-blur-0 group-hover:backdrop-blur-sm transition-all flex items-center justify-center"
            aria-label="Zoom"
          >
            <span className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/90 text-sm font-medium shadow-card transition-opacity">
              <ZoomIn className="size-4" /> View full
            </span>
          </button>
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-card/90 backdrop-blur shadow-xs">
            {kind}
          </div>
          <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}>Replace</Button>
            {onRemove && <Button size="sm" variant="destructive" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); onRemove(); }}><X className="size-3" /></Button>}
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
          {uploading ? (
            <>
              <Loader2 className="size-6 text-primary mb-2 animate-spin" />
              <div className="text-sm font-medium">Uploading…</div>
            </>
          ) : (
            <>
              <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Upload className="size-5 text-primary" />
              </div>
              <div className="text-sm font-medium">{label}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Drop or tap to upload</div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const Lightbox = ({ url, onClose }: { url: string; onClose: () => void }) => {
  const [zoom, setZoom] = useState(1);
  return (
    <div
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex items-center justify-center p-4 animate-scale-in"
      onClick={onClose}
    >
      <button onClick={onClose} className="absolute top-4 right-4 tap rounded-full bg-card/80 hover:bg-card text-foreground shadow-elevated size-10 flex items-center justify-center press z-10">
        <X className="size-5" />
      </button>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-2 py-1.5 rounded-full bg-card/90 backdrop-blur shadow-elevated z-10" onClick={e => e.stopPropagation()}>
        <Button size="sm" variant="ghost" className="h-8 px-3" onClick={() => setZoom(z => Math.max(1, z - 0.25))}>−</Button>
        <span className="text-xs tabular-nums w-12 text-center">{Math.round(zoom * 100)}%</span>
        <Button size="sm" variant="ghost" className="h-8 px-3" onClick={() => setZoom(z => Math.min(4, z + 0.25))}>+</Button>
        <Button size="sm" variant="ghost" className="h-8 px-3" onClick={() => setZoom(1)}>Reset</Button>
      </div>
      <div className="overflow-auto max-w-full max-h-full" onClick={e => e.stopPropagation()}>
        <img
          src={url}
          alt="Screenshot"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 200ms var(--transition-smooth)' }}
          className="max-w-[92vw] max-h-[88vh] object-contain rounded-lg shadow-elevated"
        />
      </div>
    </div>
  );
};

export default TradeDetail;
