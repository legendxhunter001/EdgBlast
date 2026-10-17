import { useEffect, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { IosSheet } from '@/components/IosSheet';
import { useAuth } from '@/hooks/useAuth';
import { saveSnapshot, TF_LABEL, TIMEFRAMES } from '@/lib/chartSnapshots';

const FIELD = 'mt-1 h-12 w-full rounded-2xl border border-border bg-card px-4 text-[16px] outline-none focus:ring-2 focus:ring-primary';

/** Save a view of the TradingView chart: your screenshot of it, the pair, the timeframe and your notes. */
export const SaveViewSheet = ({ defaults, onClose, onSaved }: { defaults: { symbol: string; timeframe: string }; onClose: () => void; onSaved: () => void }) => {
  const { user } = useAuth();
  const [symbol, setSymbol] = useState(defaults.symbol);
  const [timeframe, setTimeframe] = useState(defaults.timeframe);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // a picture copied from TradingView (its camera button, "Copy image") can be pasted straight in
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.files ?? []).find((x) => x.type.startsWith('image/'));
      if (f) setFile(f);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);

  const tf = TF_LABEL[timeframe] ?? timeframe;
  const save = async () => {
    if (!user) return;
    const sym = symbol.trim().toUpperCase();
    if (!sym) { toast.error('Add the pair'); return; }
    setBusy(true);
    try {
      await saveSnapshot(user.id, { symbol: sym, timeframe, title: title.trim() || `${sym} · ${tf}`, notes, file });
      toast.success('View saved');
      onSaved();
    } catch {
      toast.error('Could not save this view');
      setBusy(false);
    }
  };

  return (
    <IosSheet title="Save this view" onClose={onClose} z={320}>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); e.target.value = ''; }} />
      <button type="button" onClick={() => input.current?.click()}
        className="flex w-full flex-col items-center justify-center overflow-hidden rounded-[18px] border border-dashed border-border bg-secondary/30 text-muted-foreground transition active:scale-[.99]">
        {preview
          ? <img src={preview} alt="Your screenshot" className="w-full" />
          : <span className="flex flex-col items-center gap-2 px-6 py-8 text-center">
              <ImagePlus className="size-7" />
              <span className="text-[15px] font-medium text-foreground">Add your chart screenshot</span>
              <span className="text-[12.5px] leading-snug">Take a screenshot of the chart, or use TradingView's camera button, then pick it here. You can also paste it.</span>
            </span>}
      </button>
      {preview && <button type="button" onClick={() => setFile(null)} className="mt-2 text-[13px] font-medium text-muted-foreground">Remove picture</button>}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="text-[12.5px] font-medium text-muted-foreground">Pair</label>
          <input value={symbol} onChange={(e) => setSymbol(e.target.value)} maxLength={20} autoCapitalize="characters" className={FIELD} />
        </div>
        <div>
          <label className="text-[12.5px] font-medium text-muted-foreground">Timeframe</label>
          <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} className={FIELD}>
            {TIMEFRAMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <label className="mt-3 block text-[12.5px] font-medium text-muted-foreground">Title</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder={`${symbol.trim().toUpperCase() || 'Pair'} · ${tf}`} className={FIELD} />
      <label className="mt-3 block text-[12.5px] font-medium text-muted-foreground">Notes</label>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={1000} placeholder="What do you see? What is the plan?"
        className="mt-1 w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-[16px] outline-none focus:ring-2 focus:ring-primary" />
      <button onClick={save} disabled={busy}
        className="mt-4 h-12 w-full rounded-2xl bg-primary text-[16px] font-semibold text-primary-foreground transition active:scale-[.98] disabled:opacity-60">
        {busy ? 'Saving…' : 'Save view'}
      </button>
    </IosSheet>
  );
};
