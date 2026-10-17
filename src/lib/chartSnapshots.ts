import type { IChartApi } from 'lightweight-charts';
import { supabase } from '@/integrations/supabase/client';

// chart_snapshots is newer than the generated types, so it is reached through an untyped handle.
const db = supabase as unknown as { from: (t: string) => any };
const BUCKET = 'chart-snapshots';

export type SnapshotDrawing = { drawing_type: 'trendline' | 'horizontal'; points: { time: number; price: number }[]; color: string };
export type SnapshotCandle = { time: number; open: number; high: number; low: number; close: number };

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

export const TF_LABEL: Record<string, string> = { '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1H', '4h': '4H', '1d': '1D', '1w': '1W' };

/** What is on screen right now: the chart picture with the drawings on top, as one image. */
export function captureChart(chart: IChartApi, overlay: HTMLCanvasElement | null, background: string): HTMLCanvasElement {
  const shot = chart.takeScreenshot();
  const scale = Math.min(1, 1280 / shot.width);
  const out = document.createElement('canvas');
  out.width = Math.round(shot.width * scale);
  out.height = Math.round(shot.height * scale);
  const ctx = out.getContext('2d');
  if (!ctx) return shot;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(shot, 0, 0, out.width, out.height);
  if (overlay && overlay.width > 0 && overlay.height > 0) ctx.drawImage(overlay, 0, 0, out.width, out.height);
  return out;
}

export type SnapshotDraft = {
  canvas: HTMLCanvasElement;
  symbol: string;
  timeframe: string;
  from: number;
  to: number;
  candles: SnapshotCandle[];
  drawings: SnapshotDrawing[];
};

export async function saveSnapshot(userId: string, draft: SnapshotDraft, title: string, notes: string): Promise<void> {
  const blob: Blob | null = await new Promise((res) => draft.canvas.toBlob(res, 'image/jpeg', 0.82));
  if (!blob) throw new Error('Could not make the picture');
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
  if (up.error) throw up.error;
  const { error } = await db.from('chart_snapshots').insert({
    user_id: userId, title, symbol: draft.symbol, timeframe: draft.timeframe, notes: notes.trim() || null,
    visible_from: draft.from, visible_to: draft.to, candle_count: draft.candles.length,
    candles: draft.candles, drawings: draft.drawings, image_path: path,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
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
