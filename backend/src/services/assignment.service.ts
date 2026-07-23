import { supabaseAdmin } from '../config/supabaseAdmin';
import { createNotification } from './notifications.service';
import { logActivity } from '../utils/activityLog';

export interface AutoAssignResult {
  staffId: string;
  teamId: string | null;
  teamLeadId: string | null;
}

/**
 * Assigns one lead within its project. If the project has a `direct_staff_id`
 * set (Feature 5 — project routed straight to one staff member), round robin
 * is skipped entirely and the lead goes to that staff member. Otherwise runs
 * the persistent, project-scoped round-robin engine (`assign_lead_round_robin`
 * Postgres function — round_robin_state row locked FOR UPDATE per project),
 * safe under concurrent webhooks / bulk imports / multiple serverless
 * instances and survives restarts and deployments.
 *
 * Returns null (never throws) when no active team/staff is available or the
 * RPC fails — lead creation must not break because assignment couldn't run.
 */
export async function autoAssignLead(
  leadId: string,
  leadName: string,
  projectId: string,
): Promise<AutoAssignResult | null> {
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('direct_staff_id')
    .eq('id', projectId)
    .maybeSingle();

  if (project?.direct_staff_id) {
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
