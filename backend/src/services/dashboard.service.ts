import { supabaseAdmin } from '../config/supabaseAdmin';
import { unwrap } from '../utils/db';
import { applyLeadScope } from '../utils/scope';
import { AuthUser } from '../types';
import { getStaffPerformanceReport, getConversionReport } from './reports.service';

export async function getDashboardSummary(user: AuthUser) {
  if (user.role === 'admin') {
    const { data, error } = await supabaseAdmin.rpc('get_admin_dashboard_stats');
    if (error) throw error;
    return data?.[0] ?? null;
  }
  if (user.role === 'team_lead') {
    const { data, error } = await supabaseAdmin.rpc('get_team_lead_dashboard_stats', {
      p_team_lead_id: user.id,
    });
    if (error) throw error;
    return data?.[0] ?? null;
  }
  const { data, error } = await supabaseAdmin.rpc('get_staff_dashboard_stats', { p_staff_id: user.id });
  if (error) throw error;
  return data?.[0] ?? null;
}

/** Admin/Team Lead only — feeds the dashboard charts. */
export async function getDashboardCharts(user: AuthUser) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);

  let leadsQuery = supabaseAdmin
    .from('leads')
    .select('created_at, status, source_id')
    .gte('created_at', sixMonthsAgo.toISOString());
  leadsQuery = applyLeadScope(leadsQuery, user);

  const leads = unwrap(await leadsQuery) as { created_at: string; status: string; source_id: string | null }[];

  const monthlyCounts = new Map<string, number>();
  for (const lead of leads) {
    const month = lead.created_at.slice(0, 7); // YYYY-MM
    monthlyCounts.set(month, (monthlyCounts.get(month) ?? 0) + 1);
  }
  const monthlyLeads = Array.from(monthlyCounts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));

  const sourceIds = Array.from(new Set(leads.map((l) => l.source_id).filter((id): id is string => Boolean(id))));
  const sourceNames =
    sourceIds.length > 0
      ? (unwrap(await supabaseAdmin.from('lead_sources').select('id, name').in('id', sourceIds)) as {
          id: string;
          name: string;
        }[])
      : [];
  const sourceNameById = new Map(sourceNames.map((s) => [s.id, s.name]));

  const sourceCounts = new Map<string, number>();
  for (const lead of leads) {
    const name = (lead.source_id && sourceNameById.get(lead.source_id)) || 'Unknown';
    sourceCounts.set(name, (sourceCounts.get(name) ?? 0) + 1);
  }
  const leadSources = Array.from(sourceCounts.entries()).map(([source, count]) => ({ source, count }));

  const [staffPerformanceRows, conversion] = await Promise.all([
    getStaffPerformanceReport(user),
    getConversionReport(user),
  ]);
  const staffPerformance = staffPerformanceRows.map((row) => ({
    staff: row.full_name as string,
    leadsWon: row.leads_won as number,
  }));

  const won = (conversion.find((c) => c.status === 'won')?.count as number) ?? 0;
  const total = (conversion.find((c) => c.status === 'TOTAL')?.count as number) ?? 0;
  const conversionRate = total > 0 ? Number(((won / total) * 100).toFixed(1)) : 0;

  return { monthlyLeads, leadSources, staffPerformance, conversionRate };
}
