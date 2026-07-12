import { supabaseAdmin } from '../config/supabaseAdmin';
import { unwrap } from '../utils/db';
import { applyLeadScope, resolveStaffScope, getTeamStaffIds } from '../utils/scope';
import { AuthUser, LeadStatus } from '../types';

// ---------------------------------------------------------------------------
// Shared lookup helpers — resolve foreign keys to display data in application
// code rather than guessing Supabase's auto-generated FK constraint names.
// ---------------------------------------------------------------------------

function uniqueIds(ids: (string | null | undefined)[]): string[] {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}

async function fetchUserNamesByIds(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = uniqueIds(ids);
  if (unique.length === 0) return new Map();

  const rows = unwrap(
    await supabaseAdmin.from('users').select('id, full_name').in('id', unique),
  ) as { id: string; full_name: string }[];

  return new Map(rows.map((row) => [row.id, row.full_name]));
}

async function fetchLeadNamesByIds(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = uniqueIds(ids);
  if (unique.length === 0) return new Map();

  const rows = unwrap(
    await supabaseAdmin.from('leads').select('id, name').in('id', unique),
  ) as { id: string; name: string }[];

  return new Map(rows.map((row) => [row.id, row.name]));
}

async function fetchLeadSourceNamesByIds(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = uniqueIds(ids);
  if (unique.length === 0) return new Map();

  const rows = unwrap(
    await supabaseAdmin.from('lead_sources').select('id, name').in('id', unique),
  ) as { id: string; name: string }[];

  return new Map(rows.map((row) => [row.id, row.name]));
}

/** Counts rows in `table` grouped by `column`, restricted to `ids`, with an optional equality filter. */
async function countGroupedBy(
  table: 'leads' | 'call_logs' | 'meetings',
  column: string,
  ids: string[],
  extraFilter?: { column: string; value: string },
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (ids.length === 0) return counts;

  let query = supabaseAdmin.from(table).select(column).in(column, ids);
  if (extraFilter) {
    query = query.eq(extraFilter.column, extraFilter.value);
  }

  const rows = unwrap(await query) as unknown as Record<string, string>[];
  for (const row of rows) {
    const id = row[column];
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Row shapes for the raw (unresolved) queries
// ---------------------------------------------------------------------------

interface LeadRow {
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  status: LeadStatus;
  priority: string;
  source_id: string | null;
  assigned_staff_id: string | null;
  assigned_team_lead_id: string | null;
  created_at: string;
}

interface CallLogRow {
  lead_id: string;
  staff_id: string;
  call_date: string;
  call_time: string;
  duration_seconds: number;
  status: string;
  notes: string | null;
}

interface MeetingRow {
  lead_id: string;
  staff_id: string;
  title: string;
  meeting_date: string;
  meeting_time: string;
  mode: string;
  status: string;
}

interface FollowUpRow {
  lead_id: string;
  staff_id: string;
  reminder_date: string;
  reminder_time: string;
  status: string;
  notes: string | null;
}

// ---------------------------------------------------------------------------
// Report builders
// ---------------------------------------------------------------------------

export async function getLeadsReport(user: AuthUser): Promise<Record<string, unknown>[]> {
  let query = supabaseAdmin
    .from('leads')
    .select(
      'name, phone, email, company, status, priority, source_id, assigned_staff_id, assigned_team_lead_id, created_at',
    );
  query = applyLeadScope(query, user);

  const leads = unwrap(await query.order('created_at', { ascending: false })) as LeadRow[];
  if (leads.length === 0) return [];

  const [sourceNames, userNames] = await Promise.all([
    fetchLeadSourceNamesByIds(leads.map((lead) => lead.source_id)),
    fetchUserNamesByIds([
      ...leads.map((lead) => lead.assigned_staff_id),
      ...leads.map((lead) => lead.assigned_team_lead_id),
    ]),
  ]);

  return leads.map((lead) => ({
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    company: lead.company,
    status: lead.status,
    priority: lead.priority,
    source: (lead.source_id && sourceNames.get(lead.source_id)) ?? null,
    assigned_staff: (lead.assigned_staff_id && userNames.get(lead.assigned_staff_id)) ?? null,
    assigned_team_lead: (lead.assigned_team_lead_id && userNames.get(lead.assigned_team_lead_id)) ?? null,
    created_at: lead.created_at,
  }));
}

export async function getCallsReport(user: AuthUser): Promise<Record<string, unknown>[]> {
  const scope = await resolveStaffScope(user);
  let query = supabaseAdmin
    .from('call_logs')
    .select('lead_id, staff_id, call_date, call_time, duration_seconds, status, notes')
    .order('call_date', { ascending: false });
  if (scope) query = query.in(scope.column, scope.ids);

  const calls = unwrap(await query) as CallLogRow[];
  if (calls.length === 0) return [];

  const [leadNames, staffNames] = await Promise.all([
    fetchLeadNamesByIds(calls.map((call) => call.lead_id)),
    fetchUserNamesByIds(calls.map((call) => call.staff_id)),
  ]);

  return calls.map((call) => ({
    lead_name: leadNames.get(call.lead_id) ?? null,
    staff_name: staffNames.get(call.staff_id) ?? null,
    call_date: call.call_date,
    call_time: call.call_time,
    duration_seconds: call.duration_seconds,
    status: call.status,
    notes: call.notes,
  }));
}

export async function getMeetingsReport(user: AuthUser): Promise<Record<string, unknown>[]> {
  const scope = await resolveStaffScope(user);
  let query = supabaseAdmin
    .from('meetings')
    .select('lead_id, staff_id, title, meeting_date, meeting_time, mode, status')
    .order('meeting_date', { ascending: false });
  if (scope) query = query.in(scope.column, scope.ids);

  const meetings = unwrap(await query) as MeetingRow[];
  if (meetings.length === 0) return [];

  const [leadNames, staffNames] = await Promise.all([
    fetchLeadNamesByIds(meetings.map((meeting) => meeting.lead_id)),
    fetchUserNamesByIds(meetings.map((meeting) => meeting.staff_id)),
  ]);

  return meetings.map((meeting) => ({
    lead_name: leadNames.get(meeting.lead_id) ?? null,
    staff_name: staffNames.get(meeting.staff_id) ?? null,
    title: meeting.title,
    meeting_date: meeting.meeting_date,
    meeting_time: meeting.meeting_time,
    mode: meeting.mode,
    status: meeting.status,
  }));
}

export async function getFollowUpsReport(user: AuthUser): Promise<Record<string, unknown>[]> {
  const scope = await resolveStaffScope(user);
  let query = supabaseAdmin
    .from('follow_ups')
    .select('lead_id, staff_id, reminder_date, reminder_time, status, notes')
    .order('reminder_date', { ascending: false });
  if (scope) query = query.in(scope.column, scope.ids);

  const followUps = unwrap(await query) as FollowUpRow[];
  if (followUps.length === 0) return [];

  const [leadNames, staffNames] = await Promise.all([
    fetchLeadNamesByIds(followUps.map((followUp) => followUp.lead_id)),
    fetchUserNamesByIds(followUps.map((followUp) => followUp.staff_id)),
  ]);

  return followUps.map((followUp) => ({
    lead_name: leadNames.get(followUp.lead_id) ?? null,
    staff_name: staffNames.get(followUp.staff_id) ?? null,
    reminder_date: followUp.reminder_date,
    reminder_time: followUp.reminder_time,
    status: followUp.status,
    notes: followUp.notes,
  }));
}

/** Admin sees all staff; team_lead is scoped to their own staff via getTeamStaffIds. */
export async function getStaffPerformanceReport(user: AuthUser): Promise<Record<string, unknown>[]> {
  let staffQuery = supabaseAdmin.from('users').select('id, full_name').eq('role', 'staff');

  if (user.role === 'team_lead') {
    const staffIds = await getTeamStaffIds(user.id);
    if (staffIds.length === 0) return [];
    staffQuery = staffQuery.in('id', staffIds);
  }

  const staff = unwrap(await staffQuery) as { id: string; full_name: string }[];
  if (staff.length === 0) return [];

  const staffIds = staff.map((row) => row.id);

  const [totalLeads, wonLeads, calls, completedMeetings] = await Promise.all([
    countGroupedBy('leads', 'assigned_staff_id', staffIds),
    countGroupedBy('leads', 'assigned_staff_id', staffIds, { column: 'status', value: 'won' }),
    countGroupedBy('call_logs', 'staff_id', staffIds),
    countGroupedBy('meetings', 'staff_id', staffIds, { column: 'status', value: 'completed' }),
  ]);

  return staff.map((row) => ({
    full_name: row.full_name,
    total_leads_assigned: totalLeads.get(row.id) ?? 0,
    calls_made: calls.get(row.id) ?? 0,
    meetings_held: completedMeetings.get(row.id) ?? 0,
    leads_won: wonLeads.get(row.id) ?? 0,
  }));
}

/** Admin only. */
export async function getTeamPerformanceReport(_user: AuthUser): Promise<Record<string, unknown>[]> {
  const teamLeads = unwrap(
    await supabaseAdmin.from('users').select('id, full_name').eq('role', 'team_lead'),
  ) as { id: string; full_name: string }[];

  if (teamLeads.length === 0) return [];

  const teamLeadIds = teamLeads.map((row) => row.id);

  const staffRows = unwrap(
    await supabaseAdmin
      .from('users')
      .select('team_lead_id')
      .eq('role', 'staff')
      .in('team_lead_id', teamLeadIds),
  ) as { team_lead_id: string }[];

  const staffCounts = new Map<string, number>();
  for (const row of staffRows) {
    staffCounts.set(row.team_lead_id, (staffCounts.get(row.team_lead_id) ?? 0) + 1);
  }

  const leadRows = unwrap(
    await supabaseAdmin
      .from('leads')
      .select('assigned_team_lead_id, status')
      .in('assigned_team_lead_id', teamLeadIds),
  ) as { assigned_team_lead_id: string; status: LeadStatus }[];

  const totalCounts = new Map<string, number>();
  const wonCounts = new Map<string, number>();
  const lostCounts = new Map<string, number>();
  for (const row of leadRows) {
    const id = row.assigned_team_lead_id;
    totalCounts.set(id, (totalCounts.get(id) ?? 0) + 1);
    if (row.status === 'won') wonCounts.set(id, (wonCounts.get(id) ?? 0) + 1);
    if (row.status === 'lost') lostCounts.set(id, (lostCounts.get(id) ?? 0) + 1);
  }

  return teamLeads.map((row) => {
    const total = totalCounts.get(row.id) ?? 0;
    const won = wonCounts.get(row.id) ?? 0;
    const lost = lostCounts.get(row.id) ?? 0;
    const conversionRate = total > 0 ? `${((won / total) * 100).toFixed(1)}%` : '0.0%';

    return {
      full_name: row.full_name,
      staff_count: staffCounts.get(row.id) ?? 0,
      total_leads: total,
      won_leads: won,
      lost_leads: lost,
      conversion_rate: conversionRate,
    };
  });
}

export async function getConversionReport(user: AuthUser): Promise<Record<string, unknown>[]> {
  let query = supabaseAdmin.from('leads').select('status');
  query = applyLeadScope(query, user);

  const rows = unwrap(await query) as { status: LeadStatus }[];

  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }

  const result: Record<string, unknown>[] = Array.from(counts.entries()).map(([status, count]) => ({
    status,
    count,
  }));
  result.push({ status: 'TOTAL', count: rows.length });

  return result;
}
