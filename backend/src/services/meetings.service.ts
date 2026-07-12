import { supabaseAdmin } from '../config/supabaseAdmin';
import { HttpError } from '../middleware/auth';
import { unwrap } from '../utils/db';
import { resolveStaffScope } from '../utils/scope';
import { AuthUser } from '../types';

export type MeetingMode = 'online' | 'offline';
export type MeetingStatus = 'scheduled' | 'completed' | 'cancelled';

export interface Meeting {
  id: string;
  lead_id: string;
  staff_id: string;
  title: string;
  meeting_date: string;
  meeting_time: string;
  mode: MeetingMode;
  meet_link: string | null;
  zoom_link: string | null;
  location: string | null;
  notes: string | null;
  reminder_at: string | null;
  reminder_sent: boolean;
  status: MeetingStatus;
  created_at: string;
  updated_at: string;
}

export interface ListMeetingsFilters {
  date?: string;
  status?: MeetingStatus;
  leadId?: string;
}

export interface CreateMeetingInput {
  leadId: string;
  staffId?: string;
  title: string;
  meetingDate: string;
  meetingTime: string;
  mode: MeetingMode;
  meetLink?: string;
  zoomLink?: string;
  location?: string;
  notes?: string;
  reminderAt?: string;
}

export interface UpdateMeetingInput {
  title?: string;
  meetingDate?: string;
  meetingTime?: string;
  mode?: MeetingMode;
  meetLink?: string;
  zoomLink?: string;
  location?: string;
  notes?: string;
  reminderAt?: string;
  status?: MeetingStatus;
}

/** Admin sees all meetings; team_lead sees their team's meetings + their own; staff sees only their own. */
export async function listMeetings(user: AuthUser, filters: ListMeetingsFilters): Promise<Meeting[]> {
  const scope = await resolveStaffScope(user);

  let query = supabaseAdmin.from('meetings').select('*');
  if (filters.date) query = query.eq('meeting_date', filters.date);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.leadId) query = query.eq('lead_id', filters.leadId);
  if (scope) query = query.in(scope.column, scope.ids);

  const { data, error } = await query
    .order('meeting_date', { ascending: true })
    .order('meeting_time', { ascending: true });
  if (error) {
    throw new HttpError(400, error.message);
  }
  return (data ?? []) as Meeting[];
}

/** Fetches a single meeting, scoped to the requesting user's role. 404s (never 403s) if out of scope. */
export async function getMeetingById(user: AuthUser, id: string): Promise<Meeting> {
  const scope = await resolveStaffScope(user);

  let query = supabaseAdmin.from('meetings').select('*').eq('id', id);
  if (scope) query = query.in(scope.column, scope.ids);

  const { data, error } = await query.single();
  if (error || !data) {
    throw new HttpError(404, 'Meeting not found');
  }
  return data as Meeting;
}

export async function createMeeting(user: AuthUser, input: CreateMeetingInput): Promise<Meeting> {
  const staffId = user.role === 'staff' ? user.id : input.staffId ?? user.id;

  const meeting = unwrap(
    await supabaseAdmin
      .from('meetings')
      .insert({
        lead_id: input.leadId,
        staff_id: staffId,
        title: input.title,
        meeting_date: input.meetingDate,
        meeting_time: input.meetingTime,
        mode: input.mode,
        meet_link: input.meetLink ?? null,
        zoom_link: input.zoomLink ?? null,
        location: input.location ?? null,
        notes: input.notes ?? null,
        reminder_at: input.reminderAt ?? null,
      })
      .select()
      .single(),
  ) as Meeting;

  // Advance the parent lead's lifecycle status now that a meeting exists.
  unwrap(
    await supabaseAdmin
      .from('leads')
      .update({ status: 'meeting_scheduled', last_modified_by: user.id })
      .eq('id', input.leadId)
      .select()
      .single(),
  );

  return meeting;
}

export async function updateMeeting(user: AuthUser, id: string, patch: UpdateMeetingInput): Promise<Meeting> {
  // Scoped fetch: 404s (not 403) if this meeting is outside the user's visibility,
  // and for staff this also guarantees current.staff_id === user.id.
  await getMeetingById(user, id);

  const updates: Record<string, unknown> = {};
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.meetingDate !== undefined) updates.meeting_date = patch.meetingDate;
  if (patch.meetingTime !== undefined) updates.meeting_time = patch.meetingTime;
  if (patch.mode !== undefined) updates.mode = patch.mode;
  if (patch.meetLink !== undefined) updates.meet_link = patch.meetLink;
  if (patch.zoomLink !== undefined) updates.zoom_link = patch.zoomLink;
  if (patch.location !== undefined) updates.location = patch.location;
  if (patch.notes !== undefined) updates.notes = patch.notes;
  if (patch.reminderAt !== undefined) updates.reminder_at = patch.reminderAt;
  if (patch.status !== undefined) updates.status = patch.status;

  if (Object.keys(updates).length === 0) {
    throw new HttpError(400, 'No fields provided to update');
  }

  return unwrap(
    await supabaseAdmin.from('meetings').update(updates).eq('id', id).select().single(),
  ) as Meeting;
}

export async function deleteMeeting(user: AuthUser, id: string): Promise<void> {
  // Scoped existence check (404 if out of scope) before allowing the delete.
  await getMeetingById(user, id);

  const { error } = await supabaseAdmin.from('meetings').delete().eq('id', id);
  if (error) {
    throw new HttpError(400, error.message);
  }
}
