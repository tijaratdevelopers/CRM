-- =====================================================================
-- Adds an optional p_project_id filter to the three dashboard stats RPCs so
-- the admin dashboard can be scoped to one project. p_project_id defaults to
-- null, which preserves today's org-wide behavior exactly — existing callers
-- that don't pass it are unaffected.
-- Run AFTER migration_06_project_enhancements.sql.
-- =====================================================================

drop function if exists public.get_admin_dashboard_stats();
create or replace function public.get_admin_dashboard_stats(p_project_id uuid default null)
returns table (
  total_leads bigint, todays_leads bigint, active_staff bigint, team_leads bigint,
  meetings_today bigint, pending_follow_ups bigint, total_calls bigint,
  won_leads bigint, lost_leads bigint,
  meta_leads bigint, whatsapp_leads bigint, active_teams bigint,
  in_progress_leads bigint
) language sql stable as $$
  select
    (select count(*) from public.leads l where p_project_id is null or l.project_id = p_project_id),
    (select count(*) from public.leads l where l.created_at::date = current_date
      and (p_project_id is null or l.project_id = p_project_id)),
    (select count(*) from public.users u where u.role = 'staff' and u.is_active
      and (p_project_id is null or u.team_id in (select id from public.teams where project_id = p_project_id))),
    (select count(*) from public.users u where u.role = 'team_lead' and u.is_active
      and (p_project_id is null or u.id in (select team_lead_id from public.teams where project_id = p_project_id))),
    (select count(*) from public.meetings m join public.leads l on l.id = m.lead_id
      where m.meeting_date = current_date and (p_project_id is null or l.project_id = p_project_id)),
    (select count(*) from public.follow_ups f join public.leads l on l.id = f.lead_id
      where f.status = 'pending' and (p_project_id is null or l.project_id = p_project_id)),
    (select count(*) from public.call_logs c join public.leads l on l.id = c.lead_id
      where p_project_id is null or l.project_id = p_project_id),
    (select count(*) from public.leads l where l.status = 'won'
      and (p_project_id is null or l.project_id = p_project_id)),
    (select count(*) from public.leads l where l.status = 'lost'
      and (p_project_id is null or l.project_id = p_project_id)),
    (select count(*) from public.leads l join public.lead_sources s on s.id = l.source_id
      where s.name = 'Meta Lead Ads' and (p_project_id is null or l.project_id = p_project_id)),
    (select count(*) from public.leads l join public.lead_sources s on s.id = l.source_id
      where s.name = 'WhatsApp' and (p_project_id is null or l.project_id = p_project_id)),
    (select count(*) from public.teams t where t.is_active
      and (p_project_id is null or t.project_id = p_project_id)),
    (select count(*) from public.leads l where l.status in (
      'assigned', 'contacted', 'interested', 'meeting_scheduled',
      'follow_up', 'proposal_sent', 'quotation_sent', 'negotiation'
    ) and (p_project_id is null or l.project_id = p_project_id));
$$;

drop function if exists public.get_team_lead_dashboard_stats(uuid);
create or replace function public.get_team_lead_dashboard_stats(p_team_lead_id uuid, p_project_id uuid default null)
returns table (
  assigned_staff bigint, assigned_leads bigint, pending_follow_ups bigint,
  meetings_today bigint, won_leads bigint, lost_leads bigint,
  in_progress_leads bigint
) language sql stable as $$
  select
    (select count(*) from public.users where team_lead_id = p_team_lead_id and role = 'staff'),
    (select count(*) from public.leads l where l.assigned_team_lead_id = p_team_lead_id
      and (p_project_id is null or l.project_id = p_project_id)),
    (select count(*) from public.follow_ups f
       join public.users u on u.id = f.staff_id
       where u.team_lead_id = p_team_lead_id and f.status = 'pending'),
    (select count(*) from public.meetings m
       join public.users u on u.id = m.staff_id
       where u.team_lead_id = p_team_lead_id and m.meeting_date = current_date),
    (select count(*) from public.leads l where l.assigned_team_lead_id = p_team_lead_id and l.status = 'won'
      and (p_project_id is null or l.project_id = p_project_id)),
    (select count(*) from public.leads l where l.assigned_team_lead_id = p_team_lead_id and l.status = 'lost'
      and (p_project_id is null or l.project_id = p_project_id)),
    (select count(*) from public.leads l where l.assigned_team_lead_id = p_team_lead_id and l.status in (
      'assigned', 'contacted', 'interested', 'meeting_scheduled',
      'follow_up', 'proposal_sent', 'quotation_sent', 'negotiation'
    ) and (p_project_id is null or l.project_id = p_project_id));
$$;

drop function if exists public.get_staff_dashboard_stats(uuid);
create or replace function public.get_staff_dashboard_stats(p_staff_id uuid, p_project_id uuid default null)
returns table (
  my_leads bigint, calls_today bigint, meetings_today bigint,
  pending_follow_ups bigint, new_leads bigint,
  in_progress_leads bigint
) language sql stable as $$
  select
    (select count(*) from public.leads l where l.assigned_staff_id = p_staff_id
      and (p_project_id is null or l.project_id = p_project_id)),
    (select count(*) from public.call_logs where staff_id = p_staff_id and call_date = current_date),
    (select count(*) from public.meetings where staff_id = p_staff_id and meeting_date = current_date),
    (select count(*) from public.follow_ups where staff_id = p_staff_id and status = 'pending'),
    (select count(*) from public.leads l where l.assigned_staff_id = p_staff_id and l.status = 'new'
      and (p_project_id is null or l.project_id = p_project_id)),
    (select count(*) from public.leads l where l.assigned_staff_id = p_staff_id and l.status in (
      'assigned', 'contacted', 'interested', 'meeting_scheduled',
      'follow_up', 'proposal_sent', 'quotation_sent', 'negotiation'
    ) and (p_project_id is null or l.project_id = p_project_id));
$$;
