import { supabaseAdmin } from '../config/supabaseAdmin';
import { unwrap } from '../utils/db';
import { applyLeadScope, resolveStaffScope, getTeamStaffIds } from '../utils/scope';
import { listProjects } from './projects.service';
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

/** Counts rows in `table` grouped by `column`, restricted to `ids`, with optional equality filters. */
async function countGroupedBy(
  table: 'leads' | 'call_logs' | 'meetings',
  column: string,
  ids: string[],
  extraFilters?: { column: string; value: string }[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (ids.length === 0) return counts;

  let query = supabaseAdmin.from(table).select(column).in(column, ids);
  for (const filter of extraFilters ?? []) {
    query = query.eq(filter.column, filter.value);
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

export async function getLeadsReport(user: AuthUser, projectId?: string): Promise<Record<string, unknown>[]> {
  let query = supabaseAdmin
    .from('leads')
    .select(
      'name, phone, email, company, status, priority, source_id, assigned_staff_id, assigned_team_lead_id, created_at',
    );
  query = applyLeadScope(query, user);
  if (projectId) query = query.eq('project_id', projectId);

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

/** Ids of leads belonging to one project — used to scope tables that only carry a lead_id (calls, meetings, follow-ups). */
async function resolveProjectLeadIds(projectId: string): Promise<string[]> {
  const rows = unwrap(
    await supabaseAdmin.from('leads').select('id').eq('project_id', projectId),
  ) as { id: string }[];
  return rows.map((row) => row.id);
}

export async function getCallsReport(user: AuthUser, projectId?: string): Promise<Record<string, unknown>[]> {
  const scope = await resolveStaffScope(user);
  let query = supabaseAdmin
    .from('call_logs')
    .select('lead_id, staff_id, call_date, call_time, duration_seconds, status, notes')
    .order('call_date', { ascending: false });
  if (scope) query = query.in(scope.column, scope.ids);
  if (projectId) query = query.in('lead_id', await resolveProjectLeadIds(projectId));

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

export async function getMeetingsReport(user: AuthUser, projectId?: string): Promise<Record<string, unknown>[]> {
  const scope = await resolveStaffScope(user);
  let query = supabaseAdmin
    .from('meetings')
    .select('lead_id, staff_id, title, meeting_date, meeting_time, mode, status')
    .order('meeting_date', { ascending: false });
  if (scope) query = query.in(scope.column, scope.ids);
  if (projectId) query = query.in('lead_id', await resolveProjectLeadIds(projectId));

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

export async function getFollowUpsReport(user: AuthUser, projectId?: string): Promise<Record<string, unknown>[]> {
  const scope = await resolveStaffScope(user);
  let query = supabaseAdmin
    .from('follow_ups')
    .select('lead_id, staff_id, reminder_date, reminder_time, status, notes')
    .order('reminder_date', { ascending: false });
  if (scope) query = query.in(scope.column, scope.ids);
  if (projectId) query = query.in('lead_id', await resolveProjectLeadIds(projectId));

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
export async function getStaffPerformanceReport(
  user: AuthUser,
  projectId?: string,
): Promise<Record<string, unknown>[]> {
  let staffQuery = supabaseAdmin.from('users').select('id, full_name').eq('role', 'staff');

  if (user.role === 'team_lead') {
    const staffIds = await getTeamStaffIds(user.id);
    if (staffIds.length === 0) return [];
    staffQuery = staffQuery.in('id', staffIds);
  }
  if (projectId) {
    const teams = unwrap(
      await supabaseAdmin.from('teams').select('id').eq('project_id', projectId),
    ) as { id: string }[];
    staffQuery = staffQuery.in('team_id', teams.map((t) => t.id));
  }

  const staff = unwrap(await staffQuery) as { id: string; full_name: string }[];
  if (staff.length === 0) return [];

  const staffIds = staff.map((row) => row.id);
  const leadFilters = projectId ? [{ column: 'project_id', value: projectId }] : [];

  const [totalLeads, wonLeads, calls, completedMeetings] = await Promise.all([
    countGroupedBy('leads', 'assigned_staff_id', staffIds, leadFilters),
    countGroupedBy('leads', 'assigned_staff_id', staffIds, [...leadFilters, { column: 'status', value: 'won' }]),
    countGroupedBy('call_logs', 'staff_id', staffIds),
    countGroupedBy('meetings', 'staff_id', staffIds, [{ column: 'status', value: 'completed' }]),
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
export async function getTeamPerformanceReport(
  _user: AuthUser,
  projectId?: string,
): Promise<Record<string, unknown>[]> {
  let teamLeadsQuery = supabaseAdmin.from('users').select('id, full_name').eq('role', 'team_lead');
  if (projectId) {
    const teams = unwrap(
      await supabaseAdmin.from('teams').select('team_lead_id').eq('project_id', projectId),
    ) as { team_lead_id: string | null }[];
    const leadIds = teams.map((t) => t.team_lead_id).filter((id): id is string => Boolean(id));
    if (leadIds.length === 0) return [];
    teamLeadsQuery = teamLeadsQuery.in('id', leadIds);
  }
  const teamLeads = unwrap(await teamLeadsQuery) as { id: string; full_name: string }[];

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

  let leadRowsQuery = supabaseAdmin
    .from('leads')
    .select('assigned_team_lead_id, status')
    .in('assigned_team_lead_id', teamLeadIds);
  if (projectId) leadRowsQuery = leadRowsQuery.eq('project_id', projectId);
  const leadRows = unwrap(await leadRowsQuery) as { assigned_team_lead_id: string; status: LeadStatus }[];

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

export async function getConversionReport(user: AuthUser, projectId?: string): Promise<Record<string, unknown>[]> {
  let query = supabaseAdmin.from('leads').select('status');
  query = applyLeadScope(query, user);
  if (projectId) query = query.eq('project_id', projectId);

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

// ---------------------------------------------------------------------------
// Feature 13 — project & campaign performance
// ---------------------------------------------------------------------------

/** Admin sees every project; team_lead/staff see only the project(s) their team belongs to. */
export async function getProjectPerformanceReport(user: AuthUser): Promise<Record<string, unknown>[]> {
  const projects = await listProjects(user);
  if (projects.length === 0) return [];

  const projectIds = projects.map((p) => p.id);

  const leadRows = unwrap(
    await supabaseAdmin.from('leads').select('project_id, status').in('project_id', projectIds),
  ) as { project_id: string; status: LeadStatus }[];
  const teamRows = unwrap(
    await supabaseAdmin.from('teams').select('id, project_id').in('project_id', projectIds).eq('is_active', true),
  ) as { id: string; project_id: string }[];
  const staffRows = unwrap(
    await supabaseAdmin
      .from('users')
      .select('team_id')
      .eq('role', 'staff')
      .eq('is_active', true)
      .not('team_id', 'is', null),
  ) as { team_id: string }[];

  const teamsByProject = new Map<string, string[]>();
  for (const team of teamRows) {
    const list = teamsByProject.get(team.project_id) ?? [];
    list.push(team.id);
    teamsByProject.set(team.project_id, list);
  }

  const staffCountByTeam = new Map<string, number>();
  for (const staff of staffRows) {
    staffCountByTeam.set(staff.team_id, (staffCountByTeam.get(staff.team_id) ?? 0) + 1);
  }

  const totals = new Map<string, number>();
  const won = new Map<string, number>();
  const lost = new Map<string, number>();
  for (const lead of leadRows) {
    totals.set(lead.project_id, (totals.get(lead.project_id) ?? 0) + 1);
    if (lead.status === 'won') won.set(lead.project_id, (won.get(lead.project_id) ?? 0) + 1);
    if (lead.status === 'lost') lost.set(lead.project_id, (lost.get(lead.project_id) ?? 0) + 1);
  }

  return projects.map((project) => {
    const total = totals.get(project.id) ?? 0;
    const wonCount = won.get(project.id) ?? 0;
    const lostCount = lost.get(project.id) ?? 0;
    const teamIds = teamsByProject.get(project.id) ?? [];
    const staffCount = teamIds.reduce((sum, teamId) => sum + (staffCountByTeam.get(teamId) ?? 0), 0);

    return {
      project: project.name,
      total_leads: total,
      won_leads: wonCount,
      lost_leads: lostCount,
      conversion_rate: total > 0 ? `${((wonCount / total) * 100).toFixed(1)}%` : '0.0%',
      active_teams: teamIds.length,
      active_staff: staffCount,
      direct_staff_routing: Boolean(project.direct_staff_id),
    };
  });
}

interface CampaignAttributedLead {
  status: LeadStatus;
  campaign_id: string | null;
  meta_campaign_id: string | null;
}

/** Groups leads by their attributed campaign — Meta ad campaigns first, falling back to the legacy manual campaigns table. */
export async function getCampaignPerformanceReport(
  user: AuthUser,
  projectId?: string,
): Promise<Record<string, unknown>[]> {
  let query = supabaseAdmin.from('leads').select('status, campaign_id, meta_campaign_id');
  query = applyLeadScope(query, user);
  if (projectId) query = query.eq('project_id', projectId);

  const leads = unwrap(await query) as CampaignAttributedLead[];
  if (leads.length === 0) return [];

  const metaCampaignIds = uniqueIds(leads.map((l) => l.meta_campaign_id));
  const legacyCampaignIds = uniqueIds(leads.map((l) => (l.meta_campaign_id ? null : l.campaign_id)));

  const [metaCampaigns, legacyCampaigns] = await Promise.all([
    metaCampaignIds.length > 0
      ? (unwrap(
          await supabaseAdmin.from('meta_campaigns').select('id, name').in('id', metaCampaignIds),
        ) as { id: string; name: string | null }[])
      : [],
    legacyCampaignIds.length > 0
      ? (unwrap(
          await supabaseAdmin.from('campaigns').select('id, name').in('id', legacyCampaignIds),
        ) as { id: string; name: string }[])
      : [],
  ]);
  const metaNameById = new Map(metaCampaigns.map((c) => [c.id, c.name ?? 'Unnamed Meta campaign']));
  const legacyNameById = new Map(legacyCampaigns.map((c) => [c.id, c.name]));

  interface Bucket {
    name: string;
    source: 'Meta' | 'Manual';
    total: number;
    won: number;
    lost: number;
  }
  const buckets = new Map<string, Bucket>();

  for (const lead of leads) {
    const key = lead.meta_campaign_id ?? lead.campaign_id ?? 'uncategorized';
    const name = lead.meta_campaign_id
      ? (metaNameById.get(lead.meta_campaign_id) ?? 'Unnamed Meta campaign')
      : lead.campaign_id
        ? (legacyNameById.get(lead.campaign_id) ?? 'Unnamed campaign')
        : 'Uncategorized';
    const source: 'Meta' | 'Manual' = lead.meta_campaign_id ? 'Meta' : 'Manual';

    const bucket = buckets.get(key) ?? { name, source, total: 0, won: 0, lost: 0 };
    bucket.total += 1;
    if (lead.status === 'won') bucket.won += 1;
    if (lead.status === 'lost') bucket.lost += 1;
    buckets.set(key, bucket);
  }

  return Array.from(buckets.values()).map((bucket) => ({
    campaign: bucket.name,
    source: bucket.source,
    total_leads: bucket.total,
    won_leads: bucket.won,
    lost_leads: bucket.lost,
    conversion_rate: bucket.total > 0 ? `${((bucket.won / bucket.total) * 100).toFixed(1)}%` : '0.0%',
  }));
}
