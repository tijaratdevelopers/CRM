-- Adds an "in_progress_leads" count to each dashboard stats RPC, matching the
-- frontend's IN_PROGRESS_STATUSES list (frontend/src/types/index.ts).

drop function if exists public.get_admin_dashboard_stats();
create or replace function public.get_admin_dashboard_stats()
returns table (
  total_leads bigint, todays_leads bigint, active_staff bigint, team_leads bigint,
  meetings_today bigint, pending_follow_ups bigint, total_calls bigint,
  won_leads bigint, lost_leads bigint,
  meta_leads bigint, whatsapp_leads bigint, active_teams bigint,
  in_progress_leads bigint
) language sql stable as $$
  select
    (select count(*) from public.leads),
    (select count(*) from public.leads where created_at::date = current_date),
    (select count(*) from public.users where role = 'staff' and is_active),
    (select count(*) from public.users where role = 'team_lead' and is_active),
    (select count(*) from public.meetings where meeting_date = current_date),
    (select count(*) from public.follow_ups where status = 'pending'),
    (select count(*) from public.call_logs),
    (select count(*) from public.leads where status = 'won'),
    (select count(*) from public.leads where status = 'lost'),
    (select count(*) from public.leads l join public.lead_sources s on s.id = l.source_id
      where s.name = 'Meta Lead Ads'),
    (select count(*) from public.leads l join public.lead_sources s on s.id = l.source_id
      where s.name = 'WhatsApp'),
    (select count(*) from public.teams where is_active),
    (select count(*) from public.leads where status in (
      'assigned', 'contacted', 'interested', 'meeting_scheduled',
      'follow_up', 'proposal_sent', 'quotation_sent', 'negotiation'
    ));
$$;

drop function if exists public.get_team_lead_dashboard_stats(uuid);
create or replace function public.get_team_lead_dashboard_stats(p_team_lead_id uuid)
returns table (
  assigned_staff bigint, assigned_leads bigint, pending_follow_ups bigint,
  meetings_today bigint, won_leads bigint, lost_leads bigint,
  in_progress_leads bigint
) language sql stable as $$
  select
    (select count(*) from public.users where team_lead_id = p_team_lead_id and role = 'staff'),
    (select count(*) from public.leads where assigned_team_lead_id = p_team_lead_id),
    (select count(*) from public.follow_ups f
       join public.users u on u.id = f.staff_id
       where u.team_lead_id = p_team_lead_id and f.status = 'pending'),
    (select count(*) from public.meetings m
       join public.users u on u.id = m.staff_id
       where u.team_lead_id = p_team_lead_id and m.meeting_date = current_date),
    (select count(*) from public.leads where assigned_team_lead_id = p_team_lead_id and status = 'won'),
    (select count(*) from public.leads where assigned_team_lead_id = p_team_lead_id and status = 'lost'),
    (select count(*) from public.leads where assigned_team_lead_id = p_team_lead_id and status in (
      'assigned', 'contacted', 'interested', 'meeting_scheduled',
      'follow_up', 'proposal_sent', 'quotation_sent', 'negotiation'
    ));
$$;

drop function if exists public.get_staff_dashboard_stats(uuid);
create or replace function public.get_staff_dashboard_stats(p_staff_id uuid)
returns table (
  my_leads bigint, calls_today bigint, meetings_today bigint,
  pending_follow_ups bigint, new_leads bigint,
  in_progress_leads bigint
) language sql stable as $$
  select
    (select count(*) from public.leads where assigned_staff_id = p_staff_id),
    (select count(*) from public.call_logs where staff_id = p_staff_id and call_date = current_date),
    (select count(*) from public.meetings where staff_id = p_staff_id and meeting_date = current_date),
    (select count(*) from public.follow_ups where staff_id = p_staff_id and status = 'pending'),
    (select count(*) from public.leads where assigned_staff_id = p_staff_id and status = 'new'),
    (select count(*) from public.leads where assigned_staff_id = p_staff_id and status in (
      'assigned', 'contacted', 'interested', 'meeting_scheduled',
      'follow_up', 'proposal_sent', 'quotation_sent', 'negotiation'
    ));
$$;
