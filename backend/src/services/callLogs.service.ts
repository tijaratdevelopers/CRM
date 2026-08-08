import { supabaseAdmin } from '../config/supabaseAdmin';
import { HttpError } from '../middleware/auth';
import { unwrap } from '../utils/db';
import { resolveStaffScope } from '../utils/scope';
import { AuthUser, LeadStatus } from '../types';

export type CallStatus = 'completed' | 'no_answer' | 'busy' | 'voicemail' | 'wrong_number';

export interface CallLog {
  id: string;
  lead_id: string;
  staff_id: string;
  call_date: string;
  call_time: string;
  duration_seconds: number;
  status: CallStatus;
  notes: string | null;
  recording_url: string | null;
  created_at: string;
}

export interface ListCallLogsFilters {
  leadId?: string;
  date?: string;
}

export interface CreateCallLogInput {
  leadId: string;
  staffId?: string;
  callDate: string;
  callTime: string;
  durationSeconds: number;
  status: CallStatus;
  notes?: string;
  recordingUrl?: string;
}

export interface UpdateCallLogInput {
  callDate?: string;
  callTime?: string;
  durationSeconds?: number;
  status?: CallStatus;
  notes?: string;
  recordingUrl?: string;
}

const LEAD_STATUSES_ADVANCED_BY_CALL: LeadStatus[] = ['new', 'assigned'];

/** Admin sees all call logs; team_lead sees their team's call logs + their own; staff sees only their own. */
export async function listCallLogs(user: AuthUser, filters: ListCallLogsFilters): Promise<CallLog[]> {
  const scope = await resolveStaffScope(user);

  let query = supabaseAdmin.from('call_logs').select('*');
  if (filters.leadId) query = query.eq('lead_id', filters.leadId);
  if (filters.date) query = query.eq('call_date', filters.date);
  if (scope) query = query.in(scope.column, scope.ids);

  const { data, error } = await query
    .order('call_date', { ascending: false })
    .order('call_time', { ascending: false });
  if (error) {
    throw new HttpError(400, error.message);
  }
  return (data ?? []) as CallLog[];
}

/** Fetches a single call log, scoped to the requesting user's role. 404s (never 403s) if out of scope. */
export async function getCallLogById(user: AuthUser, id: string): Promise<CallLog> {
  const scope = await resolveStaffScope(user);

  let query = supabaseAdmin.from('call_logs').select('*').eq('id', id);
  if (scope) query = query.in(scope.column, scope.ids);

  const { data, error } = await query.single();
  if (error || !data) {
    throw new HttpError(404, 'Call log not found');
  }
  return data as CallLog;
}

export async function createCallLog(user: AuthUser, input: CreateCallLogInput): Promise<CallLog> {
  const staffId = user.role === 'staff' ? user.id : input.staffId ?? user.id;

  const callLog = unwrap(
    await supabaseAdmin
      .from('call_logs')
      .insert({
        lead_id: input.leadId,
        staff_id: staffId,
        call_date: input.callDate,
        call_time: input.callTime,
        duration_seconds: input.durationSeconds,
        status: input.status,
        notes: input.notes ?? null,
        recording_url: input.recordingUrl ?? null,
      })
      .select()
      .single(),
  ) as CallLog;

  const lead = unwrap(
    await supabaseAdmin.from('leads').select('status').eq('id', input.leadId).single(),
  ) as { status: LeadStatus };

  if (LEAD_STATUSES_ADVANCED_BY_CALL.includes(lead.status)) {
    unwrap(
      await supabaseAdmin
        .from('leads')
        .update({ status: 'contacted', last_modified_by: user.id })
        .eq('id', input.leadId)
        .select()
        .single(),
    );
  }

  return callLog;
}

export async function updateCallLog(
  user: AuthUser,
  id: string,
  patch: UpdateCallLogInput,
): Promise<CallLog> {
  // Scoped fetch: 404s (not 403) if this call log is outside the user's visibility,
  // and for staff this also guarantees current.staff_id === user.id.
  await getCallLogById(user, id);

  const updates: Record<string, unknown> = {};
  if (patch.callDate !== undefined) updates.call_date = patch.callDate;
  if (patch.callTime !== undefined) updates.call_time = patch.callTime;
  if (patch.durationSeconds !== undefined) updates.duration_seconds = patch.durationSeconds;
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.notes !== undefined) updates.notes = patch.notes;
  if (patch.recordingUrl !== undefined) updates.recording_url = patch.recordingUrl;

  if (Object.keys(updates).length === 0) {
    throw new HttpError(400, 'No fields provided to update');
  }

  return unwrap(
    await supabaseAdmin.from('call_logs').update(updates).eq('id', id).select().single(),
  ) as CallLog;
}

export async function deleteCallLog(user: AuthUser, id: string): Promise<void> {
  // Scoped existence check (404 if out of scope) before allowing the delete.
  await getCallLogById(user, id);

  const { error } = await supabaseAdmin.from('call_logs').delete().eq('id', id);
  if (error) {
    throw new HttpError(400, error.message);
  }
}
