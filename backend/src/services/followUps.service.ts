import { supabaseAdmin } from '../config/supabaseAdmin';
import { HttpError } from '../middleware/auth';
import { unwrap } from '../utils/db';
import { resolveStaffScope } from '../utils/scope';
import { AuthUser } from '../types';

export type FollowUpStatus = 'pending' | 'done' | 'missed';

export interface FollowUp {
  id: string;
  lead_id: string;
  staff_id: string;
  reminder_date: string;
  reminder_time: string;
  notes: string | null;
  reminder_sent: boolean;
  status: FollowUpStatus;
  created_at: string;
  updated_at: string;
}

export interface ListFollowUpsFilters {
  status?: FollowUpStatus;
  date?: string;
  leadId?: string;
}

export interface CreateFollowUpInput {
  leadId: string;
  staffId?: string;
  reminderDate: string;
  reminderTime: string;
  notes?: string;
}

export interface UpdateFollowUpInput {
  notes?: string;
  reminderDate?: string;
  reminderTime?: string;
  status?: FollowUpStatus;
}

/** Admin sees all follow-ups; team_lead sees their team's follow-ups + their own; staff sees only their own. */
export async function listFollowUps(user: AuthUser, filters: ListFollowUpsFilters): Promise<FollowUp[]> {
  const scope = await resolveStaffScope(user);

  let query = supabaseAdmin.from('follow_ups').select('*');
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.date) query = query.eq('reminder_date', filters.date);
  if (filters.leadId) query = query.eq('lead_id', filters.leadId);
  if (scope) query = query.in(scope.column, scope.ids);

  const { data, error } = await query
    .order('reminder_date', { ascending: true })
    .order('reminder_time', { ascending: true });
  if (error) {
    throw new HttpError(400, error.message);
  }
  return (data ?? []) as FollowUp[];
}

/** Fetches a single follow-up, scoped to the requesting user's role. 404s (never 403s) if out of scope. */
export async function getFollowUpById(user: AuthUser, id: string): Promise<FollowUp> {
  const scope = await resolveStaffScope(user);

  let query = supabaseAdmin.from('follow_ups').select('*').eq('id', id);
  if (scope) query = query.in(scope.column, scope.ids);

  const { data, error } = await query.single();
  if (error || !data) {
    throw new HttpError(404, 'Follow-up not found');
  }
  return data as FollowUp;
}

export async function createFollowUp(user: AuthUser, input: CreateFollowUpInput): Promise<FollowUp> {
  const staffId = user.role === 'staff' ? user.id : input.staffId ?? user.id;

  const followUp = unwrap(
    await supabaseAdmin
      .from('follow_ups')
      .insert({
        lead_id: input.leadId,
        staff_id: staffId,
        reminder_date: input.reminderDate,
        reminder_time: input.reminderTime,
        notes: input.notes ?? null,
      })
      .select()
      .single(),
  ) as FollowUp;

  // Advance the parent lead's lifecycle status now that a follow-up exists.
  unwrap(
    await supabaseAdmin
      .from('leads')
      .update({ status: 'follow_up', last_modified_by: user.id })
      .eq('id', input.leadId)
      .select()
      .single(),
  );

  return followUp;
}

export async function updateFollowUp(
  user: AuthUser,
  id: string,
  patch: UpdateFollowUpInput,
): Promise<FollowUp> {
  // Scoped fetch: 404s (not 403) if this follow-up is outside the user's visibility,
  // and for staff this also guarantees current.staff_id === user.id.
  await getFollowUpById(user, id);

  const updates: Record<string, unknown> = {};
  if (patch.notes !== undefined) updates.notes = patch.notes;
  if (patch.reminderDate !== undefined) updates.reminder_date = patch.reminderDate;
  if (patch.reminderTime !== undefined) updates.reminder_time = patch.reminderTime;
  if (patch.status !== undefined) updates.status = patch.status;

  if (Object.keys(updates).length === 0) {
    throw new HttpError(400, 'No fields provided to update');
  }

  return unwrap(
    await supabaseAdmin.from('follow_ups').update(updates).eq('id', id).select().single(),
  ) as FollowUp;
}

export async function deleteFollowUp(user: AuthUser, id: string): Promise<void> {
  // Scoped existence check (404 if out of scope) before allowing the delete.
  await getFollowUpById(user, id);

  const { error } = await supabaseAdmin.from('follow_ups').delete().eq('id', id);
  if (error) {
    throw new HttpError(400, error.message);
  }
}
