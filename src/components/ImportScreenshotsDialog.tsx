import { useMemo, useState } from 'react';
import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTrades } from '@/hooks/useTrades';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileArchive, X, ArrowLeft, CheckCircle2, AlertTriangle, Upload } from 'lucide-react';

interface ImportScreenshotsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Stage = 'upload' | 'preview' | 'importing' | 'done';
type ParsedFile = {
  name: string;
  blob: Blob;
  date: string | null;
  asset: string | null;
  kind: 'entry' | 'exit' | 'analysis' | null;
  tradeId: string | null;
};

// Matches the naming convention Edge Blast's export uses: 2026-09-10_XAUUSD_entry.jpg
const FILENAME_RE = /^(\d{4}-\d{2}-\d{2})_([A-Za-z0-9]+)_(entry|exit|analysis)\.\w+$/i;

export default function ImportScreenshotsDialog({ open, onOpenChange }: ImportScreenshotsDialogProps) {
  const { user } = useAuth();
  const { data: trades } = useTrades();
  const qc = useQueryClient();
  const [stage, setStage] = useState<Stage>('upload');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: number } | null>(null);

  const reset = () => { setStage('upload'); setFileName(''); setParsed([]); setResult(null); };

  const matchTrade = (date: string, asset: string): string | null => {
    if (!trades) return null;
    const match = trades.find((t) => {
      if (t.asset.toUpperCase() !== asset.toUpperCase()) return false;
      const entryDate = t.entry_at?.slice(0, 10);
      const exitDate = t.exit_at?.slice(0, 10);
      return entryDate === date || exitDate === date;
    });
    return match?.id ?? null;
  };

  const handleZip = async (file: File) => {
    setFileName(file.name);
    try {
      const zip = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files).filter((f) => !f.dir && /\.(jpe?g|png|gif|webp|avif)$/i.test(f.name));
      if (entries.length === 0) {
        toast.error("Couldn't find any images in that zip.");
        return;
      }
      const results: ParsedFile[] = [];
      for (const entry of entries) {
        const baseName = entry.name.split('/').pop() ?? entry.name;
        const m = baseName.match(FILENAME_RE);
        const blob = await entry.async('blob');
        if (!m) {
          results.push({ name: baseName, blob, date: null, asset: null, kind: null, tradeId: null });
          continue;
        }
        const [, date, asset, kind] = m;
        const tradeId = matchTrade(date, asset);
        results.push({ name: baseName, blob, date, asset, kind: kind.toLowerCase() as any, tradeId });
      }
      setParsed(results);
      setStage('preview');
    } catch (err) {
      toast.error(err instanceof Error ? `Could not read that zip: ${err.message}` : 'Could not read that zip file.');
    }
  };

  // Some browsers/OSes auto-extract a downloaded zip, so the person ends up
  // selecting individual image files instead of the zip itself — this reads
  // those directly, same matching logic, no zip parsing needed.
  const handleImageFiles = (files: File[]) => {
    setFileName(files.length === 1 ? files[0].name : `${files.length} images`);
    const results: ParsedFile[] = files.map((file) => {
      const m = file.name.match(FILENAME_RE);
      if (!m) return { name: file.name, blob: file, date: null, asset: null, kind: null, tradeId: null };
      const [, date, asset, kind] = m;
      const tradeId = matchTrade(date, asset);
      return { name: file.name, blob: file, date, asset, kind: kind.toLowerCase() as any, tradeId };
    });
    setParsed(results);
    setStage('preview');
  };

  const handleFiles = (files: File[]) => {
    if (files.length === 1 && /\.zip$/i.test(files[0].name)) { handleZip(files[0]); return; }
    const images = files.filter((f) => /\.(jpe?g|png|gif|webp|avif)$/i.test(f.name));
    if (images.length === 0) {
      toast.error("Couldn't find a zip file or any images in what you selected.");
      return;
    }
    handleImageFiles(images);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) handleFiles(files);
  };

  const matched = useMemo(
    () => parsed.filter((p): p is ParsedFile & { tradeId: string; kind: 'entry' | 'exit' | 'analysis' } => !!p.tradeId && !!p.kind),
    [parsed]
  );
  const unmatched = useMemo(() => parsed.filter((p) => !p.tradeId), [parsed]);

  const handleImport = async () => {
    if (!user) return;
    setStage('importing');
    let imported = 0;
    let errors = 0;

    for (const item of matched) {
      try {
        const ext = item.name.split('.').pop() || 'jpg';
        const path = `${user.id}/${item.tradeId}/${item.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('trade-screenshots').upload(path, item.blob, { upsert: true, contentType: item.blob.type || 'image/jpeg' });
        if (upErr) { errors++; continue; }
        const { data: signed } = await supabase.storage.from('trade-screenshots').createSignedUrl(path, 60 * 60);

        // Replace any existing screenshot of the same kind for this trade,
        // matching the single-screenshot-per-kind behavior used elsewhere.
        const { data: existing } = await supabase.from('trade_screenshots').select('id, storage_path').eq('trade_id', item.tradeId).eq('kind', item.kind).maybeSingle();
        if (existing) {
          await supabase.storage.from('trade-screenshots').remove([existing.storage_path]);
          await supabase.from('trade_screenshots').delete().eq('id', existing.id);
        }
        const { error } = await supabase.from('trade_screenshots').insert({
          trade_id: item.tradeId, user_id: user.id, kind: item.kind as any, url: signed?.signedUrl ?? '', storage_path: path,
        });
        if (error) errors++; else imported++;
      } catch {
        errors++;
      }
    }

    setResult({ imported, errors });
    setStage('done');
    if (imported > 0) qc.invalidateQueries({ queryKey: ['trade_screenshots'] });
  };

  const close = () => { onOpenChange(false); setTimeout(reset, 200); };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Import screenshots</DialogTitle>
          <DialogDescription>
            {stage === 'upload' && 'Upload the "Download all screenshots" zip from your Lovable export — each image gets matched to the right trade automatically.'}
            {stage === 'preview' && `${parsed.length} images found in ${fileName}.`}
            {stage === 'importing' && 'Uploading and linking screenshots…'}
            {stage === 'done' && 'Import complete.'}
          </DialogDescription>
        </DialogHeader>

        {stage === 'upload' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors cursor-pointer ${
              dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
            onClick={() => document.getElementById('screenshots-zip-input')?.click()}
          >
            <input
              id="screenshots-zip-input"
              type="file"
              accept=".zip,application/zip,image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files?.length && handleFiles(Array.from(e.target.files))}
            />
            <FileArchive className="size-10 mx-auto text-primary/70 mb-3" />
            <div className="font-medium text-sm">Drop your zip — or the individual screenshots — here, or tap to browse</div>
            <div className="text-xs text-muted-foreground mt-1.5">
              Works either way: the zip from Lovable, or the extracted image files themselves. Names should look like <span className="font-mono">2026-09-10_XAUUSD_entry.jpg</span> — that's what the export produces.
            </div>
          </div>
        )}

        {stage === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-bull"><CheckCircle2 className="size-4" /> {matched.length} matched to a trade</span>
              {unmatched.length > 0 && (
                <span className="flex items-center gap-1.5 text-bear"><AlertTriangle className="size-4" /> {unmatched.length} unmatched</span>
              )}
            </div>

            {unmatched.length > 0 && (
              <div className="text-xs text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2 max-h-32 overflow-y-auto">
                <div className="font-medium text-foreground mb-1">Couldn't match these — check the filename or that the trade exists:</div>
                {unmatched.map((u, i) => <div key={i} className="truncate">{u.name}</div>)}
              </div>
            )}

            {matched.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/40">
                    <tr>
                      <th className="text-left px-2.5 py-1.5 font-medium">File</th>
                      <th className="text-left px-2.5 py-1.5 font-medium">Asset</th>
                      <th className="text-left px-2.5 py-1.5 font-medium">Kind</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matched.map((m, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="px-2.5 py-1.5 truncate max-w-[160px] text-muted-foreground">{m.name}</td>
                        <td className="px-2.5 py-1.5">{m.asset}</td>
                        <td className="px-2.5 py-1.5 capitalize">{m.kind}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {stage === 'importing' && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <div className="size-8 mx-auto mb-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            Uploading {matched.length} screenshots…
          </div>
        )}

        {stage === 'done' && result && (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="size-10 mx-auto text-bull" />
            <div className="font-medium">{result.imported} screenshot{result.imported === 1 ? '' : 's'} added to your trades</div>
            {result.errors > 0 && <div className="text-xs text-bear">{result.errors} failed to upload — try those again individually from the trade page.</div>}
          </div>
        )}

        <DialogFooter>
          {stage === 'preview' && (
            <>
              <Button variant="ghost" onClick={() => setStage('upload')}><ArrowLeft className="size-4 mr-1.5" /> Back</Button>
              <Button onClick={handleImport} disabled={matched.length === 0}>
                <Upload className="size-4 mr-1.5" /> Import {matched.length} screenshots
              </Button>
            </>
          )}
          {stage === 'upload' && <Button variant="ghost" onClick={close}><X className="size-4 mr-1.5" /> Cancel</Button>}
          {stage === 'done' && <Button onClick={close}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
