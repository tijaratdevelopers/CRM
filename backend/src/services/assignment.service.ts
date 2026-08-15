import { supabaseAdmin } from '../config/supabaseAdmin';
import { createNotification } from './notifications.service';
import { logActivity } from '../utils/activityLog';

export interface AutoAssignResult {
  staffId: string | null;
  teamId: string | null;
  teamLeadId: string | null;
}

export interface CampaignRouting {
  directStaffId?: string | null;
  directTeamLeadId?: string | null;
}

async function isActiveUser(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from('users').select('is_active').eq('id', userId).maybeSingle();
  return data?.is_active === true;
}

/**
 * Assigns one lead within its project. Precedence, most to least specific:
 * 1. `campaignRouting` — the Meta campaign this lead came from is routed
 *    straight to one staff member or one team lead (set on meta_campaigns).
 * 2. The project's `direct_staff_id` (Feature 5 — whole project routed to one
 *    staff member).
 * 3. The persistent, project-scoped round-robin engine
 *    (`assign_lead_round_robin` Postgres function — round_robin_state row
 *    locked FOR UPDATE per project), safe under concurrent webhooks / bulk
 *    imports / multiple serverless instances and survives restarts/deploys.
 *
 * Returns null (never throws) when no active team/staff is available or the
 * RPC fails — lead creation must not break because assignment couldn't run.
 */
export async function autoAssignLead(
  leadId: string,
  leadName: string,
  projectId: string,
  campaignRouting?: CampaignRouting,
): Promise<AutoAssignResult | null> {
  if (campaignRouting?.directStaffId && (await isActiveUser(campaignRouting.directStaffId))) {
    return assignDirectToStaff(leadId, leadName, campaignRouting.directStaffId);
  }
  if (campaignRouting?.directTeamLeadId && (await isActiveUser(campaignRouting.directTeamLeadId))) {
    return assignDirectToTeamLead(leadId, leadName, campaignRouting.directTeamLeadId);
  }

  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('direct_staff_id')
    .eq('id', projectId)
    .maybeSingle();

  // Falls through to round robin below if the routed staff member has since
  // been deactivated, rather than silently handing them a lead they can no
  // longer act on.
  if (project?.direct_staff_id && (await isActiveUser(project.direct_staff_id))) {
    return assignDirectToStaff(leadId, leadName, project.direct_staff_id);
  }

  const { data, error } = await supabaseAdmin.rpc('assign_lead_round_robin', {
    p_lead_id: leadId,
    p_project_id: projectId,
  });

  if (error) {
    console.error(`Round robin assignment failed for lead ${leadId}:`, error.message);
    return null;
  }

  const row = (data as { out_staff_id: string; out_team_id: string; out_team_lead_id: string | null }[])?.[0];
  if (!row?.out_staff_id) {
    // Feature 10, rule 4 — nobody available to receive this lead. Tag it so
    // it's easy to find in the "pending leads" report and leave it in the
    // unassigned queue; the caller (webhook/leads.service) notifies admins.
    await supabaseAdmin.from('leads').update({ assignment_rule_used: 'unassigned' }).eq('id', leadId);
    return null;
  }

  await createNotification({
    userId: row.out_staff_id,
    type: 'lead_assigned',
    title: 'New lead assigned',
    body: leadName,
    payload: { leadId, autoAssigned: true },
  });

  return { staffId: row.out_staff_id, teamId: row.out_team_id, teamLeadId: row.out_team_lead_id };
}

async function assignDirectToStaff(
  leadId: string,
  leadName: string,
  staffId: string,
): Promise<AutoAssignResult | null> {
  const { error } = await supabaseAdmin
    .from('leads')
    .update({
      assigned_staff_id: staffId,
      status: 'assigned',
      assignment_rule_used: 'direct_staff',
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId);

  if (error) {
    console.error(`Direct staff assignment failed for lead ${leadId}:`, error.message);
    return null;
  }

  await createNotification({
    userId: staffId,
    type: 'lead_assigned',
    title: 'New lead assigned',
    body: leadName,
    payload: { leadId, autoAssigned: true },
  });

  await logActivity({
    actorId: null,
    entityType: 'lead',
    entityId: leadId,
    action: 'direct_assigned',
    metadata: { staffId, engine: 'direct_project_assignment' },
  });

  return { staffId, teamId: null, teamLeadId: null };
}

/** Tags the lead to a team lead directly (no staff pick) — same semantics as manually assigning a lead to a team lead elsewhere in the app; the team lead distributes it to their own staff from here. */
async function assignDirectToTeamLead(
  leadId: string,
  leadName: string,
  teamLeadId: string,
): Promise<AutoAssignResult | null> {
  const { error } = await supabaseAdmin
    .from('leads')
    .update({
      assigned_team_lead_id: teamLeadId,
      status: 'assigned',
      assignment_rule_used: 'direct_team_lead',
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId);

  if (error) {
    console.error(`Direct team-lead assignment failed for lead ${leadId}:`, error.message);
    return null;
  }

  await createNotification({
    userId: teamLeadId,
    type: 'lead_assigned',
    title: 'New lead assigned',
    body: leadName,
    payload: { leadId, autoAssigned: true },
  });

  await logActivity({
    actorId: null,
    entityType: 'lead',
    entityId: leadId,
    action: 'direct_assigned',
    metadata: { teamLeadId, engine: 'direct_campaign_assignment' },
  });

  return { staffId: null, teamId: null, teamLeadId };
}

export interface DistributionState {
  teamPointer: number;
  staffPointer: number;
  updatedAt: string | null;
}

export async function getDistributionState(projectId: string): Promise<DistributionState> {
  const { data } = await supabaseAdmin
    .from('round_robin_state')
    .select('team_pointer, staff_pointer, updated_at')
    .eq('project_id', projectId)
    .maybeSingle();

  return {
    teamPointer: data?.team_pointer ?? 0,
    staffPointer: data?.staff_pointer ?? 0,
    updatedAt: data?.updated_at ?? null,
  };
}
