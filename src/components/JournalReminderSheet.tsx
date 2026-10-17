import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const DAYS: [number, string][] = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [7, 'Sun']];

// the reminder columns are newer than the generated types
const db = supabase as unknown as { from: (t: string) => any };

/** Pick the days (and exact time) for journal reminders. No days picked = reminders follow the trading plan automatically. */
export const JournalReminderSheet = ({ onClose }: { onClose: () => void }) => {
  const { session } = useAuth();
  const [days, setDays] = useState<number[]>([]);
  const [time, setTime] = useState('19:00');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) return;
    db.from('notification_settings')
      .select('journal_days, journal_time')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }: { data: { journal_days: number[] | null; journal_time: string | null } | null }) => {
        if (data) {
          setDays((data.journal_days ?? []).map(Number));
          setTime((data.journal_time ?? '19:00').slice(0, 5));
        }
        setLoaded(true);
      });
  }, [session]);

  const toggle = (n: number) => setDays((d) => (d.includes(n) ? d.filter((x) => x !== n) : [...d, n].sort()));

  const save = async () => {
    if (!session) return;
    setSaving(true);
    const uid = session.user.id;
    const row = { user_id: uid, journal_days: days.length ? days : null, journal_time: time };
    const { data: existing } = await db.from('notification_settings').select('id').eq('user_id', uid).maybeSingle();
    const { error } = existing
      ? await db.from('notification_settings').update(row).eq('user_id', uid)
      : await db.from('notification_settings').insert(row);
    setSaving(false);
    if (error) { toast.error('Could not save your reminder days'); return; }
    toast.success(days.length ? 'Journal reminders saved' : 'Reminders will follow your trading plan');
    onClose();
  };

  return (
    <div className="album-modal fixed-modal" onClick={onClose}>
      <div className="album-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        <h3>Journal reminders</h3>
        <p style={{ color: 'var(--dim)', fontSize: '.85rem', margin: '0 0 .9rem', lineHeight: 1.45 }}>
          Logging trades by hand? Pick the days you want a nudge to journal.
        </p>
        <div className="fchips" role="group" aria-label="Reminder days" style={{ flexWrap: 'wrap' }}>
          {DAYS.map(([n, label]) => (
            <button key={n} className={`fchip ${days.includes(n) ? 'on' : ''}`} onClick={() => toggle(n)} aria-pressed={days.includes(n)}>{label}</button>
          ))}
        </div>
        {days.length > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '.6rem', margin: '.9rem 0 0', color: 'var(--text)', fontSize: '.9rem' }}>
            Remind me at
            <input
              type="time"
              value={time}
              onChange={(e) => e.target.value && setTime(e.target.value)}
              style={{ height: 36, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--elev)', color: 'var(--text)', padding: '0 .6rem', font: 'inherit' }}
            />
          </label>
        )}
        <p style={{ color: 'var(--dim)', fontSize: '.8rem', margin: '.9rem 0 1rem', lineHeight: 1.45 }}>
          {days.length === 0
            ? 'No days picked: reminders follow your trading plan, after a trade closes and as a day or week wrap-up.'
            : 'One reminder on those days, only if you have not written yet that day. Trade notes reminders come on those days too.'}
        </p>
        <div className="album-sheet-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={saving || !loaded}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
};
