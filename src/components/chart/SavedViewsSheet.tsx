import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bookmark, ChevronLeft, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  deleteSnapshot, listSnapshots, signedUrls, TF_LABEL, updateSnapshot, type ChartSnapshot,
} from '@/lib/chartSnapshots';

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const rangeText = (s: ChartSnapshot) => {
  if (!s.visible_from || !s.visible_to) return null;
  const f = (t: number) => new Date(t * 1000).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `${f(s.visible_from)} → ${f(s.visible_to)}`;
};

const Pill = ({ children, dark }: { children: React.ReactNode; dark?: boolean }) => (
  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${dark ? 'bg-black/55 text-white backdrop-blur' : 'border border-border bg-secondary/40 text-muted-foreground'}`}>{children}</span>
);

/** The saved views, as its own screen: picture cards, search, symbol filter, and a detail page per view. */
export const SavedViewsSheet = ({ onClose, onOpenOnChart }: { onClose: () => void; onOpenOnChart: (s: ChartSnapshot) => void }) => {
  const [items, setItems] = useState<ChartSnapshot[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [symbol, setSymbol] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await listSnapshots();
      setItems(rows);
      setUrls(await signedUrls(rows.map((r) => r.image_path).filter((p): p is string => !!p)));
    } catch {
      setItems([]);
      toast.error('Could not load your saved views');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (zoom) setZoom(false); else if (openId) setOpenId(null); else onClose(); } };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [zoom, openId, onClose]);

  const symbols = useMemo(() => Array.from(new Set((items ?? []).map((i) => i.symbol))), [items]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter((i) => (symbol === 'all' || i.symbol === symbol)
      && (!q || `${i.title} ${i.symbol} ${i.notes ?? ''}`.toLowerCase().includes(q)));
  }, [items, query, symbol]);
  const current = items?.find((i) => i.id === openId) ?? null;

  const patch = async (s: ChartSnapshot, p: { title?: string; notes?: string | null }) => {
    setItems((prev) => (prev ?? []).map((i) => (i.id === s.id ? { ...i, ...p } : i)));
    try { await updateSnapshot(s.id, p); } catch { toast.error('Could not save the change'); }
  };
  const remove = async (s: ChartSnapshot) => {
    try {
      await deleteSnapshot(s);
      setItems((prev) => (prev ?? []).filter((i) => i.id !== s.id));
      setOpenId(null); setConfirmDelete(false);
      toast.success('Deleted');
    } catch { toast.error('Could not delete'); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/45 backdrop-blur-sm md:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Saved views" onClick={(e) => e.stopPropagation()}
        className="relative flex h-[94%] w-full max-w-3xl flex-col overflow-hidden rounded-t-[28px] border border-border bg-background/95 shadow-2xl backdrop-blur-xl md:h-[86%] md:rounded-[28px]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>

        {!current ? (
          <>
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <div>
                <h3 className="font-display text-[22px] font-bold leading-tight">Saved views</h3>
                <div className="text-[12.5px] text-muted-foreground">{items ? `${items.length} saved` : 'Loading…'}</div>
              </div>
              <button onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground"><X className="size-4" /></button>
            </div>
            <div className="px-5 pb-2">
              <div className="flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4">
                <Search className="size-4 text-muted-foreground" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, pair or notes"
                  className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
              </div>
              {symbols.length > 1 && (
                <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {['all', ...symbols].map((s) => (
                    <button key={s} onClick={() => setSymbol(s)}
                      className={`h-8 shrink-0 rounded-full border px-3.5 text-[13px] font-medium transition active:scale-[.97] ${symbol === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'}`}>
                      {s === 'all' ? 'All' : s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-5 pt-2">
              {items && items.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-secondary/60 text-muted-foreground"><Bookmark className="size-6" /></div>
                  <div className="text-[16px] font-semibold">No saved views yet</div>
                  <p className="mt-1 max-w-[260px] text-[13.5px] text-muted-foreground">Tap Snapshot on the chart to keep exactly what is on your screen.</p>
                </div>
              )}
              {items && items.length > 0 && shown.length === 0 && <p className="py-10 text-center text-[14px] text-muted-foreground">Nothing matches that.</p>}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {shown.map((s) => (
                  <button key={s.id} onClick={() => { setOpenId(s.id); setConfirmDelete(false); }}
                    className="overflow-hidden rounded-[20px] border border-border bg-card/70 text-left shadow-sm transition active:scale-[.98]">
                    <div className="relative aspect-[16/10] bg-secondary/40">
                      {s.image_path && urls[s.image_path] && <img src={urls[s.image_path]} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
                      <div className="absolute left-2 top-2 flex gap-1.5"><Pill dark>{s.symbol}</Pill><Pill dark>{TF_LABEL[s.timeframe] ?? s.timeframe}</Pill></div>
                    </div>
                    <div className="p-3">
                      <div className="truncate text-[14px] font-semibold">{s.title}</div>
                      <div className="mt-0.5 text-[12px] text-muted-foreground">{when(s.created_at)}</div>
                      {s.notes && <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-snug text-muted-foreground">{s.notes}</p>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <button onClick={() => setOpenId(null)} className="flex items-center gap-1 text-[15px] font-semibold text-primary"><ChevronLeft className="size-5" /> Saved</button>
              <button onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground"><X className="size-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-5">
              <button onClick={() => setZoom(true)} className="block w-full overflow-hidden rounded-[22px] border border-border bg-secondary/40 shadow-sm" aria-label="View full size">
                {current.image_path && urls[current.image_path]
                  ? <img src={urls[current.image_path]} alt={current.title} className="w-full" />
                  : <div className="aspect-[16/10]" />}
              </button>
              <div className="mt-3 flex flex-wrap gap-2">
                <Pill>{current.symbol}</Pill><Pill>{TF_LABEL[current.timeframe] ?? current.timeframe}</Pill>
                <Pill>{current.candle_count} candles</Pill>
                <Pill>{current.drawings.length} {current.drawings.length === 1 ? 'drawing' : 'drawings'}</Pill>
              </div>
              <input defaultValue={current.title} maxLength={80} aria-label="Title"
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== current.title) void patch(current, { title: v }); }}
                className="mt-4 h-12 w-full rounded-2xl border border-border bg-card px-4 text-[17px] font-semibold outline-none focus:ring-2 focus:ring-primary" />
              <div className="mt-1.5 px-1 text-[12.5px] text-muted-foreground">Saved {when(current.created_at)}{rangeText(current) ? ` · ${rangeText(current)}` : ''}</div>
              <textarea defaultValue={current.notes ?? ''} rows={4} maxLength={1000} aria-label="Notes" placeholder="Add notes"
                onBlur={(e) => { const v = e.target.value.trim(); if (v !== (current.notes ?? '')) void patch(current, { notes: v || null }); }}
                className="mt-3 w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-[16px] outline-none focus:ring-2 focus:ring-primary" />
              <button onClick={() => onOpenOnChart(current)}
                className="mt-4 h-12 w-full rounded-2xl bg-primary text-[16px] font-semibold text-primary-foreground transition active:scale-[.98]">Open on chart</button>
              <button onClick={() => (confirmDelete ? void remove(current) : setConfirmDelete(true))}
                className={`mt-2.5 h-12 w-full rounded-2xl border text-[15px] font-semibold transition active:scale-[.98] ${confirmDelete ? 'border-destructive bg-destructive text-destructive-foreground' : 'border-border text-muted-foreground'}`}>
                {confirmDelete ? 'Tap again to delete' : 'Delete'}
              </button>
            </div>
          </>
        )}

        {zoom && current?.image_path && urls[current.image_path] && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black p-2" onClick={() => setZoom(false)}>
            <img src={urls[current.image_path]} alt={current.title} className="max-h-full max-w-full object-contain" />
            <button aria-label="Close" className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-white/15 text-white"><X className="size-4" /></button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
