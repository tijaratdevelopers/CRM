-- Adds an "in_progress_leads" count to the admin dashboard stats RPC.
-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query -> paste -> Run).
-- Statuses match frontend `IN_PROGRESS_STATUSES` in frontend/src/types/index.ts.

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
