import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTrade, useScreenshots } from '@/hooks/useTrades';
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

  const handleDelete = async () => {
    if (!id || !confirm('Delete this trade? This cannot be undone.')) return;
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
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 rounded-2xl" />
        <div className="grid md:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }
  if (!trade) return <div className="p-8 text-center text-muted-foreground">Trade not found</div>;

  const stepIndex = STEPS.findIndex(s => s.id === step);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;
  const stepDef = STEPS[stepIndex];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-5 md:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link to="/trades" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors press tap">
          <ArrowLeft className="size-4" /> <span className="hidden sm:inline">Back to trades</span>
        </Link>
        <div className="flex items-center gap-2">
          <SaveIndicator state={saving} />
          <Button variant="ghost" size="sm" onClick={handleDelete} className="text-bear hover:text-bear hover:bg-bear/10 tap">
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <section className="luxe-card p-5 md:p-7 animate-fade-up">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2"><SymbolLogo symbol={trade.asset} size={22} />{trade.asset}</h1>
              <DirectionBadge dir={trade.direction} />
            </div>
            <div className="text-sm text-muted-foreground">
              {trade.entry_at && format(parseISO(trade.entry_at), 'MMM d, yyyy · HH:mm')}
              {trade.exit_at && <> → {format(parseISO(trade.exit_at), 'HH:mm')}</>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-caption text-muted-foreground">P&L</div>
            <div className={cn('font-mono text-2xl md:text-3xl font-semibold tracking-tight mt-0.5', pnlClass(trade.pnl))}>
              {formatCurrency(trade.pnl, { sign: true })}
            </div>
            <div className={cn('font-mono text-xs', pnlClass(trade.pnl_percent))}>{formatPct(trade.pnl_percent, { sign: true })}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <Stat label="Entry" value={trade.entry_price ?? '—'} />
          <Stat label="Exit" value={trade.exit_price ?? '—'} />
          <Stat label="Size" value={trade.position_size ?? '—'} />
          <Stat label="R:R" value={trade.risk_reward ? `${Number(trade.risk_reward).toFixed(2)}R` : '—'} />
          <Stat label="Stop" value={trade.stop_loss ?? '—'} />
          <Stat label="Target" value={trade.take_profit ?? '—'} />
          <Stat label="Confidence" value={trade.confidence_rating ? `${trade.confidence_rating}/10` : '—'} />
          <Stat label="Mood" value={trade.emotional_state ?? '—'} capitalize />
        </div>
      </section>

      <section className="luxe-card p-4 md:p-6 animate-fade-up stagger-1">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-caption text-muted-foreground">Review workflow</div>
            <div className="text-section mt-0.5">{stepDef.label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{stepDef.desc}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-caption text-muted-foreground">Step</div>
            <div className="font-mono text-lg font-semibold">{stepIndex + 1}<span className="text-muted-foreground text-sm">/{STEPS.length}</span></div>
          </div>
        </div>

        <div className="h-1 rounded-full bg-muted overflow-hidden mb-4">
          <div className="h-full bg-gradient-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <div className="flex gap-1.5 overflow-x-auto scrollbar-thin -mx-1 px-1 pb-1">
          {STEPS.map((s, i) => {
            const active = s.id === step;
            const done = i < stepIndex;
            return (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                className={cn(
                  'tap shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium press transition-all flex items-center gap-1.5',
                  active && 'bg-primary text-primary-foreground shadow-glow-primary',
                  !active && done && 'bg-primary/10 text-primary',
                  !active && !done && 'bg-secondary text-muted-foreground hover:text-foreground'
                )}
              >
                {done && <CheckCircle2 className="size-3.5" />}
                <span className="font-mono text-[10px] opacity-70">{i + 1}</span>
                {s.label}
              </button>
            );
          })}
        </div>
      </section>

      <div key={step} className="animate-scale-in">
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
          <div className="luxe-card p-6 md:p-8 text-center space-y-5">
            <div>
              <div className="text-caption text-muted-foreground">Final rating</div>
              <h3 className="font-display text-2xl mt-1">How well did you execute this trade?</h3>
              <p className="text-sm text-muted-foreground mt-1">Score the quality of execution, not the outcome.</p>
            </div>
            <div className="flex justify-center gap-1.5">
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button
                  key={n}
                  onClick={() => setReviewScore(n)}
                  className={cn(
                    'tap size-9 md:size-10 rounded-lg press transition-all flex items-center justify-center font-mono text-sm font-semibold',
                    rating >= n
                      ? 'bg-gradient-primary text-primary-foreground shadow-glow-primary scale-105'
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
                <span className="text-sm font-semibold">{rating}/10 — saved</span>
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
          className="press tap bg-gradient-primary text-primary-foreground shadow-glow-primary hover:opacity-90"
        >
          Next <ChevronRight className="size-4 ml-1" />
        </Button>
      </div>

      {lightbox && (
        <Lightbox url={lightbox} onClose={() => setLightbox(null)} />
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

const Stat = ({ label, value, capitalize }: { label: string; value: any; capitalize?: boolean }) => (
  <div>
    <div className="text-caption text-muted-foreground">{label}</div>
    <div className={cn('font-mono text-sm mt-1', capitalize && 'capitalize font-sans')}>{value}</div>
  </div>
);

const JournalField = ({ label, value, onChange, accent, placeholder, large }: { label: string; value: string; onChange: (v: string) => void; accent?: 'bull' | 'bear' | 'accent'; placeholder?: string; large?: boolean }) => (
  <div className="luxe-card p-5">
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
  <div className="luxe-card p-5">
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
    <div className="luxe-card p-5">
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
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-card/90 backdrop-blur shadow-xs">
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
        <span className="text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
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
