import { useCallback, useMemo, useState } from 'react';
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
import { Upload, FileSpreadsheet, X, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';

interface ImportCsvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Our target trade fields, with the header aliases we'll try to auto-match against.
const FIELD_DEFS: { key: string; label: string; required?: boolean; aliases: string[] }[] = [
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
  { key: 'thesis', label: 'Trade thesis', aliases: ['thesis', 'setup', 'idea', 'rationale'] },
  { key: 'entry_reasoning', label: 'Entry explanation', aliases: ['entry_reasoning', 'entry_explanation', 'entry_reason', 'entry_notes', 'why'] },
  { key: 'exit_reasoning', label: 'Exit explanation', aliases: ['exit_reasoning', 'exit_explanation', 'exit_reason', 'exit_notes'] },
  { key: 'execution_notes', label: 'Execution notes', aliases: ['execution_notes', 'execution', 'execution_quality'] },
  { key: 'psychology_review', label: 'Psychology review', aliases: ['psychology_review', 'psych_review', 'mental_state', 'mindset'] },
  { key: 'what_went_well', label: 'What went well', aliases: ['what_went_well', 'went_well', 'strengths', 'positives'] },
  { key: 'mistakes', label: 'Mistakes', aliases: ['mistakes', 'errors', 'negatives', 'what_went_wrong'] },
  { key: 'lessons_learned', label: 'Lessons learned', aliases: ['lessons_learned', 'lessons', 'takeaway', 'takeaways'] },
];

const normalize = (s: string) => s.toLowerCase().trim().replace(/[\s_-]+/g, '');

const guessMapping = (headers: string[]): Record<string, string> => {
  const mapping: Record<string, string> = {};
  const normHeaders = headers.map((h) => ({ raw: h, norm: normalize(h) }));
  for (const def of FIELD_DEFS) {
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

type Stage = 'upload' | 'map' | 'importing' | 'done';

export default function ImportCsvDialog({ open, onOpenChange }: ImportCsvDialogProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [stage, setStage] = useState<Stage>('upload');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  const reset = () => {
    setStage('upload');
    setFileName('');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setResult(null);
  };

  const handleFile = useCallback((file: File) => {
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
        setHeaders(cols);
        setRows(res.data);
        setMapping(guessMapping(cols));
        setStage('map');
      },
      error: (err) => toast.error(`Could not read CSV: ${err.message}`),
    });
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);

  const missingRequired = FIELD_DEFS.filter((f) => f.required && !mapping[f.key]);

  const handleImport = async () => {
    if (!user) return;
    setStage('importing');

    const built = rows.map((row) => {
      const get = (key: string) => (mapping[key] ? row[mapping[key]] : undefined);

      const asset = get('asset')?.trim();
      const directionRaw = get('direction');
      if (!asset || !directionRaw) return null;

      const entry_price = parseNum(get('entry_price'));
      const exit_price = parseNum(get('exit_price'));
      const position_size = parseNum(get('position_size'));
      const stop_loss = parseNum(get('stop_loss'));
      const take_profit = parseNum(get('take_profit'));
      const fees = parseNum(get('fees')) ?? 0;
      let pnl = parseNum(get('pnl'));
      const entry_at = parseDate(get('entry_at'));
      const exit_at = parseDate(get('exit_at'));
      const notes = get('notes')?.trim() || null;
      const direction = parseDirection(directionRaw);
      const emoRaw = get('emotional_state')?.trim().toLowerCase();
      const validEmotions = ['calm','confident','anxious','fearful','greedy','frustrated','excited','neutral'];
      const emotional_state = emoRaw && validEmotions.includes(emoRaw) ? emoRaw : null;
      const confRaw = parseNum(get('confidence_rating'));
      const confidence_rating = confRaw !== null ? Math.min(10, Math.max(1, Math.round(confRaw))) : null;
      const ratingRaw = parseNum(get('review_score'));
      const review_score = ratingRaw !== null ? Math.min(10, Math.max(1, Math.round(ratingRaw))) : null;
      const thesis = get('thesis')?.trim() || null;
      const entry_reasoning = get('entry_reasoning')?.trim() || null;
      const exit_reasoning = get('exit_reasoning')?.trim() || null;
      const execution_notes = get('execution_notes')?.trim() || null;
      const psychology_review = get('psychology_review')?.trim() || null;
      const what_went_well = get('what_went_well')?.trim() || null;
      const mistakes = get('mistakes')?.trim() || null;
      const lessons_learned = get('lessons_learned')?.trim() || null;

      if (pnl === null && entry_price !== null && exit_price !== null && position_size !== null) {
        const dir = direction === 'long' ? 1 : -1;
        pnl = (exit_price - entry_price) * position_size * dir - fees;
      }

      return {
        user_id: user.id,
        asset: asset.toUpperCase(),
        direction,
        status: exit_price !== null ? 'closed' as const : 'open' as const,
        entry_price,
        exit_price,
        position_size,
        stop_loss,
        take_profit,
        fees,
        pnl,
        entry_at,
        exit_at,
        notes,
        emotional_state: emotional_state as any,
        confidence_rating,
        review_score,
        thesis,
        entry_reasoning,
        exit_reasoning,
        execution_notes,
        psychology_review,
        what_went_well,
        mistakes,
        lessons_learned,
      };
    });

    const valid = built.filter((r): r is NonNullable<typeof r> => r !== null);
    const skipped = built.length - valid.length;

    let imported = 0;
    const CHUNK = 200;
    for (let i = 0; i < valid.length; i += CHUNK) {
      const chunk = valid.slice(i, i + CHUNK);
      const { error, count } = await supabase.from('trades').insert(chunk, { count: 'exact' });
      if (error) {
        toast.error(`Import stopped: ${error.message}`);
        break;
      }
      imported += count ?? chunk.length;
    }

    setResult({ imported, skipped });
    setStage('done');
    if (imported > 0) {
      qc.invalidateQueries({ queryKey: ['trades'] });
    }
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Import trades from CSV</DialogTitle>
          <DialogDescription>
            {stage === 'upload' && 'Upload a CSV export from your broker or another journal.'}
            {stage === 'map' && `${rows.length} rows found in ${fileName}. Check the column mapping below.`}
            {stage === 'importing' && 'Importing your trades…'}
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
              Any CSV works — columns are matched automatically, and you can adjust the mapping next.
            </div>
          </div>
        )}

        {stage === 'map' && (
          <div className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-3">
              {FIELD_DEFS.map((f) => (
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

            <div>
              <div className="text-xs text-muted-foreground mb-2">Preview (first 5 rows)</div>
              <div className="rounded-lg border border-border overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/40">
                    <tr>
                      {FIELD_DEFS.filter((f) => mapping[f.key]).map((f) => (
                        <th key={f.key} className="text-left px-2.5 py-1.5 font-medium whitespace-nowrap">{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-t border-border/50">
                        {FIELD_DEFS.filter((f) => mapping[f.key]).map((f) => (
                          <td key={f.key} className="px-2.5 py-1.5 whitespace-nowrap text-muted-foreground">
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
            Importing {rows.length} rows…
          </div>
        )}

        {stage === 'done' && result && (
          <div className="py-6 text-center space-y-2">
            <CheckCircle2 className="size-10 mx-auto text-bull" />
            <div className="font-medium">{result.imported} trade{result.imported === 1 ? '' : 's'} imported</div>
            {result.skipped > 0 && (
              <div className="text-xs text-muted-foreground">
                {result.skipped} row{result.skipped === 1 ? '' : 's'} skipped (missing asset or direction)
              </div>
            )}
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
