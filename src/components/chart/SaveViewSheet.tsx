import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { IosSheet } from '@/components/IosSheet';
import { useAuth } from '@/hooks/useAuth';
import { saveSnapshot, TF_LABEL, type SnapshotDraft } from '@/lib/chartSnapshots';

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[12px] font-medium text-muted-foreground">{children}</span>
);

/** Save what is on the chart right now: the picture, the visible candles and the drawings. Nothing else. */
export const SaveViewSheet = ({ draft, onClose, onSaved }: { draft: SnapshotDraft; onClose: () => void; onSaved: () => void }) => {
  const { user } = useAuth();
  const tf = TF_LABEL[draft.timeframe] ?? draft.timeframe;
  const [title, setTitle] = useState(`${draft.symbol} · ${tf}`);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const preview = useMemo(() => draft.canvas.toDataURL('image/jpeg', 0.8), [draft.canvas]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await saveSnapshot(user.id, draft, title.trim() || `${draft.symbol} · ${tf}`, notes);
      toast.success('View saved');
      onSaved();
    } catch {
      toast.error('Could not save this view');
      setBusy(false);
    }
  };

  return (
    <IosSheet title="Save this view" onClose={onClose} z={320}>
      <img src={preview} alt="Chart preview" className="w-full rounded-[18px] border border-border shadow-sm" />
      <div className="mt-3 flex flex-wrap gap-2">
        <Chip>{draft.symbol}</Chip>
        <Chip>{tf}</Chip>
        <Chip>{draft.candles.length} candles</Chip>
        <Chip>{draft.drawings.length} {draft.drawings.length === 1 ? 'drawing' : 'drawings'}</Chip>
      </div>
      <label className="mt-4 block text-[12.5px] font-medium text-muted-foreground">Title</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80}
        className="mt-1 h-12 w-full rounded-2xl border border-border bg-card px-4 text-[16px] outline-none focus:ring-2 focus:ring-primary" />
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
