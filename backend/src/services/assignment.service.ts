import { supabaseAdmin } from '../config/supabaseAdmin';
import { createNotification } from './notifications.service';

export interface AutoAssignResult {
  staffId: string;
  teamId: string;
  teamLeadId: string | null;
}

/**
 * Runs the persistent round-robin engine for one lead. All pointer state and
 * the actual assignment live in the `assign_lead_round_robin` Postgres
 * function (round_robin_state row locked FOR UPDATE), so this is safe under
 * concurrent webhooks / bulk imports / multiple serverless instances and
 * survives restarts and deployments.
 *
 * Returns null (never throws) when no active team/staff is available or the
 * RPC fails — lead creation must not break because assignment couldn't run.
 */
export async function autoAssignLead(leadId: string, leadName: string): Promise<AutoAssignResult | null> {
  const { data, error } = await supabaseAdmin.rpc('assign_lead_round_robin', { p_lead_id: leadId });

  if (error) {
    console.error(`Round robin assignment failed for lead ${leadId}:`, error.message);
    return null;
  }

  const row = (data as { out_staff_id: string; out_team_id: string; out_team_lead_id: string | null }[])?.[0];
  if (!row?.out_staff_id) {
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

export interface DistributionState {
  teamPointer: number;
  staffPointer: number;
  updatedAt: string | null;
}

export async function getDistributionState(): Promise<DistributionState> {
  const { data } = await supabaseAdmin
    .from('round_robin_state')
    .select('team_pointer, staff_pointer, updated_at')
    .eq('id', 1)
    .maybeSingle();

  return {
    teamPointer: data?.team_pointer ?? 0,
    staffPointer: data?.staff_pointer ?? 0,
    updatedAt: data?.updated_at ?? null,
  };
}
