import { supabaseAdmin } from '../config/supabaseAdmin';
import { HttpError } from '../middleware/auth';
import { applyLeadScope } from '../utils/scope';
import { AuthUser } from '../types';

export interface ActivityLog {
  id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ListActivityLogsFilters {
  entityType?: string;
  entityId?: string;
}

export interface ListActivityLogsResult {
  data: ActivityLog[];
  total: number;
  page: number;
  pageSize: number;
}

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * Admin sees every log. team_lead/staff see logs they authored themselves,
 * plus logs against 'lead' entities that are within their applyLeadScope
 * visibility (team_lead: assigned_team_lead_id=self; staff: assigned_staff_id=self).
 */
export async function listActivityLogs(
  user: AuthUser,
  filters: ListActivityLogsFilters,
  page: number,
  pageSize: number,
): Promise<ListActivityLogsResult> {
  let query = supabaseAdmin.from('activity_logs').select('*', { count: 'exact' });

  if (user.role !== 'admin') {
    let leadScopeQuery = supabaseAdmin.from('leads').select('id');
    leadScopeQuery = applyLeadScope(leadScopeQuery, user);
    const { data: scopedLeads, error: leadsError } = await leadScopeQuery;
    if (leadsError) {
      throw new HttpError(400, leadsError.message);
    }

    const leadIds = (scopedLeads ?? []).map((l) => l.id as string);
    const leadIdList = leadIds.length > 0 ? leadIds.join(',') : NIL_UUID;

    query = query.or(`actor_id.eq.${user.id},and(entity_type.eq.lead,entity_id.in.(${leadIdList}))`);
  }

  if (filters.entityType) query = query.eq('entity_type', filters.entityType);
  if (filters.entityId) query = query.eq('entity_id', filters.entityId);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
  if (error) {
    throw new HttpError(400, error.message);
  }

  return { data: (data ?? []) as ActivityLog[], total: count ?? 0, page, pageSize };
}
