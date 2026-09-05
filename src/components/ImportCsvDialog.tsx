import { useMemo, useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Upload, FileSpreadsheet, X, ArrowLeft, CheckCircle2, AlertTriangle, ArrowLeftRight } from 'lucide-react';

interface ImportCsvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ImportMode = 'trade' | 'journal';

// Trade fields — every column we know how to place on a trade row.
const TRADE_FIELD_DEFS: { key: string; label: string; required?: boolean; aliases: string[] }[] = [
  { key: 'asset', label: 'Asset / Symbol', required: true, aliases: ['asset', 'symbol', 'pair', 'ticker', 'instrument'] },
  { key: 'direction', label: 'Direction', required: true, aliases: ['direction', 'side', 'type', 'buy/sell', 'action'] },
  { key: 'entry_price', label: 'Entry price', aliases: ['entry_price', 'entry', 'open_price', 'openprice', 'price_open'] },
  { key: 'exit_price', label: 'Exit price', aliases: ['exit_price', 'exit', 'close_price', 'closeprice', 'price_close'] },
  { key: 'position_size', label: 'Position size', aliases: ['position_size', 'size', 'volume', 'lots', 'lot_size', 'quantity', 'qty'] },
  { key: 'stop_loss', label: 'Stop loss', aliases: ['stop_loss', 'sl', 'stoploss'] },
  { key: 'take_profit', label: 'Take profit', aliases: ['take_profit', 'tp', 'takeprofit'] },
  { key: 'fees', label: 'Fees / commission', aliases: ['fees', 'commission', 'fee', 'costs'] },
  { key: 'pnl', label: 'P&L', aliases: ['pnl', 'profit', 'p&l', 'p/l', 'net_profit', 'result'] },
  { key: 'entry_at', label: 'Entry date/time', aliases: ['entry_at', 'entry_time', 'open_time', 'opentime', 'date_open', 'entry_date', 'date'] },
  { key: 'exit_at', label: 'Exit date/time', aliases: ['exit_at', 'exit_time', 'close_time', 'closetime', 'date_close', 'exit_date'] },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'comment', 'comments', 'remarks'] },
  { key: 'emotional_state', label: 'Emotional state', aliases: ['emotional_state', 'emotion', 'mood', 'feeling', 'psychology'] },
  { key: 'confidence_rating', label: 'Confidence (1-10)', aliases: ['confidence_rating', 'confidence', 'conviction'] },
  { key: 'review_score', label: 'Rating (1-10)', aliases: ['review_score', 'rating', 'score', 'grade', 'trade_rating'] },
  { key: 'thesis', label: 'Trade thesis', aliases: ['thesis', 'setup', 'idea', 'rationale', 'definition'] },
  { key: 'entry_reasoning', label: 'Entry explanation', aliases: ['entry_reasoning', 'entry_explanation', 'entry_reason', 'entry_notes', 'why'] },
  { key: 'exit_reasoning', label: 'Exit explanation', aliases: ['exit_reasoning', 'exit_explanation', 'exit_reason', 'exit_notes'] },
  { key: 'execution_notes', label: 'Execution notes', aliases: ['execution_notes', 'execution', 'execution_quality'] },
  { key: 'psychology_review', label: 'Psychology review', aliases: ['psychology_review', 'psych_review', 'mental_state', 'mindset'] },
  { key: 'what_went_well', label: 'What went well', aliases: ['what_went_well', 'went_well', 'strengths', 'positives'] },
  { key: 'mistakes', label: 'Mistakes', aliases: ['mistakes', 'errors', 'negatives', 'what_went_wrong'] },
  { key: 'lessons_learned', label: 'Lessons learned', aliases: ['lessons_learned', 'lessons', 'takeaway', 'takeaways', 'experience'] },
];

// Journal fields — used when a CSV clearly represents journal/notepad entries
// rather than trades (e.g. exported from a separate notes/journal table).
const JOURNAL_FIELD_DEFS: { key: string; label: string; required?: boolean; aliases: string[] }[] = [
  { key: 'title', label: 'Title', aliases: ['title', 'subject', 'heading', 'name'] },
  { key: 'content', label: 'Content', required: true, aliases: ['content', 'note', 'notes', 'journal', 'description', 'experience', 'reflection', 'entry', 'body', 'text', 'definition'] },
  { key: 'mood', label: 'Mood', aliases: ['mood', 'emotion', 'emotional_state', 'feeling'] },
  { key: 'created_at', label: 'Date', aliases: ['created_at', 'date', 'entry_date', 'timestamp'] },
];

const normalize = (s: string) => s.toLowerCase().trim().replace(/[\s_-]+/g, '');

const guessMapping = (headers: string[], defs: typeof TRADE_FIELD_DEFS): Record<string, string> => {
  const mapping: Record<string, string> = {};
  const normHeaders = headers.map((h) => ({ raw: h, norm: normalize(h) }));
  for (const def of defs) {
    const aliasesNorm = def.aliases.map(normalize);
    const match = normHeaders.find((h) => aliasesNorm.includes(h.norm));
    if (match) mapping[def.key] = match.raw;
  }
  return mapping;
};

const parseDirection = (raw: string): 'long' | 'short' => {
  const v = raw.trim().toLowerCase();
  if (['short', 'sell', 's'].includes(v)) return 'short';
  return 'long';
};

const parseNum = (raw: string | undefined): number | null => {
  if (!raw) return null;
  const cleaned = raw.replace(/[$,\s]/g, '');
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
};

const parseDate = (raw: string | undefined): string | null => {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

// Deterministic fingerprint so re-importing the same file never creates duplicates.
const fingerprintTrade = (row: Record<string, string>, mapping: Record<string, string>): string => {
  const get = (k: string) => (mapping[k] ? (row[mapping[k]] ?? '') : '');
  const parts = [get('asset'), get('direction'), get('entry_at'), get('exit_at'), get('entry_price'), get('position_size')]
    .map((v) => v.trim().toLowerCase());
  if (parts.some(Boolean)) return parts.join('|');
  // Fall back to the entire raw row if trade-identifying columns are too sparse.
  return JSON.stringify(row);
};

const fingerprintJournal = (row: Record<string, string>, mapping: Record<string, string>): string => {
  const get = (k: string) => (mapping[k] ? (row[mapping[k]] ?? '') : '');
  const parts = [get('title'), get('content').slice(0, 120), get('created_at')].map((v) => v.trim().toLowerCase());
  if (parts.some(Boolean)) return parts.join('|');
  return JSON.stringify(row);
};

type Stage = 'upload' | 'map' | 'importing' | 'done';

export default function ImportCsvDialog({ open, onOpenChange }: ImportCsvDialogProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [stage, setStage] = useState<Stage>('upload');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mode, setMode] = useState<ImportMode>('trade');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; duplicates: number; errors: number } | null>(null);

  const fieldDefs = mode === 'trade' ? TRADE_FIELD_DEFS : JOURNAL_FIELD_DEFS;

  const reset = () => {
    setStage('upload'); setFileName(''); setHeaders([]); setRows([]); setMapping({}); setResult(null);
  };

  const detectMode = (cols: string[]): ImportMode => {
    const tradeGuess = guessMapping(cols, TRADE_FIELD_DEFS);
    const journalGuess = guessMapping(cols, JOURNAL_FIELD_DEFS);
    // A trade import needs at least an asset column; a pure journal export
    // won't have one. Prefer journal mode only when trade signals are absent.
    if (!tradeGuess.asset && journalGuess.content) return 'journal';
    return 'trade';
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const cols = res.meta.fields ?? [];
        if (cols.length === 0 || res.data.length === 0) {
          toast.error("Couldn't find any rows in that file.");
          return;
        }
        const detected = detectMode(cols);
        setMode(detected);
        setHeaders(cols);
        setRows(res.data);
        setMapping(guessMapping(cols, detected === 'trade' ? TRADE_FIELD_DEFS : JOURNAL_FIELD_DEFS));
        setStage('map');
      },
      error: (err) => toast.error(`Could not read CSV: ${err.message}`),
    });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const switchMode = (next: ImportMode) => {
    setMode(next);
    setMapping(guessMapping(headers, next === 'trade' ? TRADE_FIELD_DEFS : JOURNAL_FIELD_DEFS));
  };

  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);
  const missingRequired = fieldDefs.filter((f) => f.required && !mapping[f.key]);
  const mappedSourceCols = new Set(Object.values(mapping));
  const unmappedColumns = headers.filter((h) => !mappedSourceCols.has(h));

  const handleImport = async () => {
    if (!user) return;
    setStage('importing');

    const get = (row: Record<string, string>, key: string) => (mapping[key] ? row[mapping[key]] : undefined);

    if (mode === 'journal') {
      let imported = 0; let skipped = 0; let errors = 0;
      for (const row of rows) {
        const content = get(row, 'content')?.trim();
        if (!content) { skipped++; continue; }
        const fingerprint = fingerprintJournal(row, mapping);
        const { data: dup } = await supabase.from('journal_entries').select('id').eq('user_id', user.id).eq('import_fingerprint', fingerprint).maybeSingle();
        if (dup) { skipped++; continue; }
        const { error } = await supabase.from('journal_entries').insert({
          user_id: user.id,
          title: get(row, 'title')?.trim() || 'Imported entry',
          content,
          mood: get(row, 'mood')?.trim() || null,
          created_at: parseDate(get(row, 'created_at')) ?? undefined,
          raw_import_data: row as any,
          import_fingerprint: fingerprint,
        });
        if (error) errors++; else imported++;
      }
      setResult({ imported, skipped: 0, duplicates: skipped, errors });
      setStage('done');
      if (imported > 0) qc.invalidateQueries({ queryKey: ['journal_entries'] });
      return;
    }

    // Trade mode
    let imported = 0; let skippedInvalid = 0; let duplicates = 0; let errors = 0;

    for (const row of rows) {
      const asset = get(row, 'asset')?.trim();
      const directionRaw = get(row, 'direction');
      if (!asset || !directionRaw) { skippedInvalid++; continue; }

      const fingerprint = fingerprintTrade(row, mapping);
      const { data: dup } = await supabase.from('trades').select('id').eq('user_id', user.id).eq('import_fingerprint', fingerprint).maybeSingle();
      if (dup) { duplicates++; continue; }

      const entry_price = parseNum(get(row, 'entry_price'));
      const exit_price = parseNum(get(row, 'exit_price'));
      const position_size = parseNum(get(row, 'position_size'));
      const stop_loss = parseNum(get(row, 'stop_loss'));
      const take_profit = parseNum(get(row, 'take_profit'));
      const fees = parseNum(get(row, 'fees')) ?? 0;
      let pnl = parseNum(get(row, 'pnl'));
      const entry_at = parseDate(get(row, 'entry_at'));
      const exit_at = parseDate(get(row, 'exit_at'));
      const notes = get(row, 'notes')?.trim() || null;
      const direction = parseDirection(directionRaw);
      const emoRaw = get(row, 'emotional_state')?.trim().toLowerCase();
      const validEmotions = ['calm', 'confident', 'anxious', 'fearful', 'greedy', 'frustrated', 'excited', 'neutral'];
      const emotional_state = emoRaw && validEmotions.includes(emoRaw) ? emoRaw : null;
      const confRaw = parseNum(get(row, 'confidence_rating'));
      const confidence_rating = confRaw !== null ? Math.min(10, Math.max(1, Math.round(confRaw))) : null;
      const ratingRaw = parseNum(get(row, 'review_score'));
      const review_score = ratingRaw !== null ? Math.min(10, Math.max(1, Math.round(ratingRaw))) : null;
      const thesis = get(row, 'thesis')?.trim() || null;
      const entry_reasoning = get(row, 'entry_reasoning')?.trim() || null;
      const exit_reasoning = get(row, 'exit_reasoning')?.trim() || null;
      const execution_notes = get(row, 'execution_notes')?.trim() || null;
      const psychology_review = get(row, 'psychology_review')?.trim() || null;
      const what_went_well = get(row, 'what_went_well')?.trim() || null;
      const mistakes = get(row, 'mistakes')?.trim() || null;
      const lessons_learned = get(row, 'lessons_learned')?.trim() || null;

      if (pnl === null && entry_price !== null && exit_price !== null && position_size !== null) {
        const dir = direction === 'long' ? 1 : -1;
        pnl = (exit_price - entry_price) * position_size * dir - fees;
      }

      const { error } = await supabase.from('trades').insert({
        user_id: user.id,
        asset: asset.toUpperCase(),
        direction,
        status: exit_price !== null ? 'closed' as const : 'open' as const,
        entry_price, exit_price, position_size, stop_loss, take_profit, fees, pnl,
        entry_at, exit_at, notes,
        emotional_state: emotional_state as any,
        confidence_rating, review_score, thesis, entry_reasoning, exit_reasoning,
        execution_notes, psychology_review, what_went_well, mistakes, lessons_learned,
        raw_import_data: row as any,
        import_fingerprint: fingerprint,
      });
      if (error) errors++; else imported++;
    }

    setResult({ imported, skipped: skippedInvalid, duplicates, errors });
    setStage('done');
    if (imported > 0) qc.invalidateQueries({ queryKey: ['trades'] });
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Import from CSV</DialogTitle>
          <DialogDescription>
            {stage === 'upload' && 'Upload a CSV export — trades, journal entries, or a full migration from another EdgeBlast/Lovable project.'}
            {stage === 'map' && `${rows.length} rows found in ${fileName}, detected as ${mode === 'trade' ? 'trades' : 'journal entries'}. Check the mapping below.`}
            {stage === 'importing' && 'Importing…'}
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
            onClick={() => document.getElementById('csv-file-input')?.click()}
          >
            <input
              id="csv-file-input"
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <FileSpreadsheet className="size-10 mx-auto text-primary/70 mb-3" />
            <div className="font-medium text-sm">Drop your CSV here, or tap to browse</div>
            <div className="text-xs text-muted-foreground mt-1.5">
              We auto-detect whether this is trades or journal entries, and every original column is kept even if unmapped.
            </div>
          </div>
        )}

        {stage === 'map' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 bg-secondary/20">
              <div className="text-xs text-muted-foreground">
                Detected as <b className="text-foreground capitalize">{mode}</b> import
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => switchMode(mode === 'trade' ? 'journal' : 'trade')}>
                <ArrowLeftRight className="size-3.5" /> Switch to {mode === 'trade' ? 'journal' : 'trade'}
              </Button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {fieldDefs.map((f) => (
                <label key={f.key} className="space-y-1.5 text-sm">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    {f.label}{f.required && <span className="text-bear">*</span>}
                  </span>
                  <Select
                    value={mapping[f.key] ?? '__none__'}
                    onValueChange={(v) => setMapping((m) => ({ ...m, [f.key]: v === '__none__' ? '' : v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Not mapped" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not mapped</SelectItem>
                      {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
              ))}
            </div>

            {missingRequired.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-bear bg-bear/10 rounded-lg px-3 py-2">
                <AlertTriangle className="size-3.5 shrink-0" />
                Map {missingRequired.map((f) => f.label).join(' and ')} to continue.
              </div>
            )}

            {unmappedColumns.length > 0 && (
              <div className="text-xs text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2">
                <span className="font-medium text-foreground">{unmappedColumns.length} unmapped column{unmappedColumns.length === 1 ? '' : 's'}</span> — not lost:
                stored on every row's original data so nothing you wrote disappears: {unmappedColumns.join(', ')}
              </div>
            )}

            <div>
              <div className="text-xs text-muted-foreground mb-2">Preview (first 5 rows)</div>
              <div className="rounded-lg border border-border overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/40">
                    <tr>
                      {fieldDefs.filter((f) => mapping[f.key]).map((f) => (
                        <th key={f.key} className="text-left px-2.5 py-1.5 font-medium whitespace-nowrap">{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-t border-border/50">
                        {fieldDefs.filter((f) => mapping[f.key]).map((f) => (
                          <td key={f.key} className="px-2.5 py-1.5 max-w-[220px] truncate text-muted-foreground" title={row[mapping[f.key]]}>
                            {row[mapping[f.key]] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {stage === 'importing' && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <div className="size-8 mx-auto mb-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            Importing {rows.length} rows — checking each against your existing data to avoid duplicates…
          </div>
        )}

        {stage === 'done' && result && (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="size-10 mx-auto text-bull" />
            <div className="font-medium">{result.imported} {mode === 'trade' ? 'trade' : 'entry'}{result.imported === 1 ? '' : mode === 'trade' ? 's' : 'ies'} imported</div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              {result.duplicates > 0 && <div>{result.duplicates} already existed — skipped to avoid duplicates</div>}
              {result.skipped > 0 && <div>{result.skipped} row{result.skipped === 1 ? '' : 's'} skipped (missing required fields)</div>}
              {result.errors > 0 && <div className="text-bear">{result.errors} row{result.errors === 1 ? '' : 's'} failed — check they have valid data</div>}
            </div>
          </div>
        )}

        <DialogFooter>
          {stage === 'map' && (
            <>
              <Button variant="ghost" onClick={() => setStage('upload')}>
                <ArrowLeft className="size-4 mr-1.5" /> Back
              </Button>
              <Button onClick={handleImport} disabled={missingRequired.length > 0}>
                <Upload className="size-4 mr-1.5" /> Import {rows.length} rows
              </Button>
            </>
          )}
          {stage === 'upload' && (
            <Button variant="ghost" onClick={close}><X className="size-4 mr-1.5" /> Cancel</Button>
          )}
          {stage === 'done' && (
            <Button onClick={close}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
