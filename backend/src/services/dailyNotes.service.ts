import { supabaseAdmin } from '../config/supabaseAdmin';
import { unwrap } from '../utils/db';
import { AuthUser } from '../types';

export interface StaffDailyNote {
  id: string;
  staff_id: string;
  note_date: string;
  remarks: string;
  created_at: string;
  updated_at: string;
}

export interface UpsertDailyNoteInput {
  date: string;
  remarks: string;
}

/** Every user records only their own note for a given day — upserted on (staff_id, note_date). */
export async function upsertMyDailyNote(user: AuthUser, input: UpsertDailyNoteInput): Promise<StaffDailyNote> {
  return unwrap(
    await supabaseAdmin
      .from('staff_daily_notes')
      .upsert(
        { staff_id: user.id, note_date: input.date, remarks: input.remarks },
        { onConflict: 'staff_id,note_date' },
      )
      .select()
      .single(),
  ) as StaffDailyNote;
}

export async function getMyDailyNote(user: AuthUser, date: string): Promise<StaffDailyNote | null> {
  const { data } = await supabaseAdmin
    .from('staff_daily_notes')
    .select('*')
    .eq('staff_id', user.id)
    .eq('note_date', date)
    .maybeSingle();
  return (data as StaffDailyNote | null) ?? null;
}

/** Batch lookup used by the Daily Sales Report — one note per staff for a given date. */
export async function getDailyNotesByStaffIds(
  staffIds: string[],
  date: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (staffIds.length === 0) return map;

  const rows = unwrap(
    await supabaseAdmin
      .from('staff_daily_notes')
      .select('staff_id, remarks')
      .in('staff_id', staffIds)
      .eq('note_date', date),
  ) as { staff_id: string; remarks: string }[];

  for (const row of rows) {
    map.set(row.staff_id, row.remarks);
  }
  return map;
}
