import { supabase } from '@/integrations/supabase/client';

// chart_snapshots is newer than the generated types, so it is reached through an untyped handle.
const db = supabase as unknown as { from: (t: string) => any };
const BUCKET = 'chart-snapshots';

export type SnapshotDrawing = { drawing_type: string; points: { time: number; price: number }[]; color: string };

export type ChartSnapshot = {
  id: string;
  title: string;
  symbol: string;
  timeframe: string;
  notes: string | null;
  visible_from: number | null;
  visible_to: number | null;
  candle_count: number;
  drawings: SnapshotDrawing[];
  image_path: string | null;
  created_at: string;
};

export const TIMEFRAMES: [string, string][] = [['1m', '1m'], ['5m', '5m'], ['15m', '15m'], ['30m', '30m'], ['1h', '1H'], ['4h', '4H'], ['1d', '1D'], ['1w', '1W']];
export const TF_LABEL: Record<string, string> = Object.fromEntries(TIMEFRAMES);
/** the TradingView chart's interval code for each saved timeframe */
export const TV_INTERVAL: Record<string, string> = { '1m': '1', '5m': '5', '15m': '15', '30m': '30', '1h': '60', '4h': '240', '1d': 'D', '1w': 'W' };

export type SnapshotInput = { symbol: string; timeframe: string; title: string; notes: string; file: File | null };

/** Shrinks a screenshot so it stays light (long side 1600px, JPEG). */
async function toJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('image');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('image'))), 'image/jpeg', 0.85));
}

export async function saveSnapshot(userId: string, input: SnapshotInput): Promise<void> {
  let path: string | null = null;
  if (input.file) {
    const blob = await toJpeg(input.file);
    path = `${userId}/${crypto.randomUUID()}.jpg`;
    const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
    if (up.error) throw up.error;
  }
  const { error } = await db.from('chart_snapshots').insert({
    user_id: userId, title: input.title, symbol: input.symbol, timeframe: input.timeframe,
    notes: input.notes.trim() || null, image_path: path,
  });
  if (error) {
    if (path) await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
}

export async function listSnapshots(): Promise<ChartSnapshot[]> {
  const { data, error } = await db
    .from('chart_snapshots')
    .select('id, title, symbol, timeframe, notes, visible_from, visible_to, candle_count, drawings, image_path, created_at')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? []) as ChartSnapshot[];
}

export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  const out: Record<string, string> = {};
  (data ?? []).forEach((r) => { if (r.path && r.signedUrl) out[r.path] = r.signedUrl; });
  return out;
}

export async function updateSnapshot(id: string, patch: { title?: string; notes?: string | null }): Promise<void> {
  const { error } = await db.from('chart_snapshots').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function deleteSnapshot(s: ChartSnapshot): Promise<void> {
  const { error } = await db.from('chart_snapshots').delete().eq('id', s.id);
  if (error) throw error;
  if (s.image_path) await supabase.storage.from(BUCKET).remove([s.image_path]);
}
