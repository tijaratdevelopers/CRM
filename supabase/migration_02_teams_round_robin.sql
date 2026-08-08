-- =====================================================================
-- Teams + persistent Round Robin lead distribution engine.
-- Run AFTER migration_01_statuses.sql. Safe to re-run.
-- =====================================================================

-- 1) TEAMS ------------------------------------------------------------
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  team_lead_id uuid references public.users (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_teams_updated_at on public.teams;
create trigger trg_teams_updated_at before update on public.teams
  for each row execute function public.set_updated_at();

alter table public.users add column if not exists team_id uuid references public.teams (id) on delete set null;
alter table public.leads add column if not exists assigned_team_id uuid references public.teams (id) on delete set null;
alter table public.leads add column if not exists tags text[] not null default '{}';

create index if not exists idx_users_team_id on public.users (team_id);
create index if not exists idx_leads_assigned_team on public.leads (assigned_team_id);
create index if not exists idx_leads_tags on public.leads using gin (tags);

-- Backfill: one team per existing team lead; put their staff into it.
insert into public.teams (name, team_lead_id)
select 'Team ' || u.full_name, u.id
from public.users u
where u.role = 'team_lead'
  and not exists (select 1 from public.teams t where t.team_lead_id = u.id)
on conflict (name) do nothing;

update public.users u
set team_id = t.id
from public.teams t
where u.role = 'staff' and u.team_id is null and u.team_lead_id = t.team_lead_id;

-- Backfill leads' team from their assigned team lead.
update public.leads l
set assigned_team_id = t.id
from public.teams t
where l.assigned_team_id is null and l.assigned_team_lead_id = t.team_lead_id;

-- 2) ROUND ROBIN STATE (single row — pointers live in the DB, never in memory)
create table if not exists public.round_robin_state (
  id smallint primary key default 1 check (id = 1),
  team_pointer integer not null default 0,
  staff_pointer integer not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.round_robin_state (id) values (1) on conflict (id) do nothing;

-- 3) ASSIGNMENT ENGINE ------------------------------------------------
-- Round robin across teams first, then staff (T1S1, T2S1, T3S1, T1S2, ...).
-- FOR UPDATE on the state row serializes concurrent calls (webhooks, bulk
-- import, several serverless instances). Inactive teams/staff are skipped;
-- teams with no active staff are skipped. Returns nothing if no one is
-- available (lead stays unassigned).
create or replace function public.assign_lead_round_robin(p_lead_id uuid)
returns table (out_staff_id uuid, out_team_id uuid, out_team_lead_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state public.round_robin_state%rowtype;
  v_teams uuid[];
  v_team_count int;
  v_attempt int := 0;
  v_team_idx int := 0;
  v_team uuid;
  v_staff uuid[];
  v_staff_count int;
  v_chosen_staff uuid := null;
  v_chosen_team uuid := null;
  v_team_lead uuid;
  v_max_staff int;
begin
  select * into v_state from public.round_robin_state where id = 1 for update;
  if not found then
    insert into public.round_robin_state (id) values (1)
    on conflict (id) do update set id = excluded.id
    returning * into v_state;
  end if;

  select array_agg(t.id order by t.created_at, t.id) into v_teams
  from public.teams t
  where t.is_active
    and exists (
      select 1 from public.users u
      where u.team_id = t.id and u.role = 'staff' and u.is_active
    );

  v_team_count := coalesce(array_length(v_teams, 1), 0);
  if v_team_count = 0 then
    return;
  end if;

  select coalesce(max(cnt), 0)::int into v_max_staff from (
    select count(*) as cnt
    from public.users u
    where u.team_id = any (v_teams) and u.role = 'staff' and u.is_active
    group by u.team_id
  ) s;

  -- Normalize pointers in case teams/staff shrank since the last assignment.
  if v_state.team_pointer >= v_team_count or v_state.team_pointer < 0 then
    v_state.team_pointer := 0;
  end if;
  if v_max_staff > 0 and (v_state.staff_pointer >= v_max_staff or v_state.staff_pointer < 0) then
    v_state.staff_pointer := v_state.staff_pointer % v_max_staff;
  end if;

  while v_attempt < v_team_count loop
    v_team_idx := (v_state.team_pointer + v_attempt) % v_team_count;
    v_team := v_teams[v_team_idx + 1];

    select array_agg(u.id order by u.created_at, u.id) into v_staff
    from public.users u
    where u.team_id = v_team and u.role = 'staff' and u.is_active;

    v_staff_count := coalesce(array_length(v_staff, 1), 0);
    if v_staff_count > 0 then
      v_chosen_staff := v_staff[(v_state.staff_pointer % v_staff_count) + 1];
      v_chosen_team := v_team;
      exit;
    end if;
    v_attempt := v_attempt + 1;
  end loop;

  if v_chosen_staff is null then
    return;
  end if;

  -- Advance: team pointer moves past the team just used; when it wraps,
  -- the staff pointer advances so the next full round hits everyone's #2.
  v_state.team_pointer := v_team_idx + 1;
  if v_state.team_pointer >= v_team_count then
    v_state.team_pointer := 0;
    v_state.staff_pointer := v_state.staff_pointer + 1;
    if v_max_staff > 0 and v_state.staff_pointer >= v_max_staff then
      v_state.staff_pointer := 0;
    end if;
  end if;

  update public.round_robin_state
  set team_pointer = v_state.team_pointer,
      staff_pointer = v_state.staff_pointer,
      updated_at = now()
  where id = 1;

  select t.team_lead_id into v_team_lead from public.teams t where t.id = v_chosen_team;

  update public.leads
  set assigned_staff_id = v_chosen_staff,
      assigned_team_id = v_chosen_team,
      assigned_team_lead_id = v_team_lead,
      status = case when status = 'new' then 'assigned'::lead_status_enum else status end,
      updated_at = now()
  where id = p_lead_id;

  insert into public.activity_logs (actor_id, entity_type, entity_id, action, metadata)
  values (null, 'lead', p_lead_id, 'auto_assigned',
    jsonb_build_object('staff_id', v_chosen_staff, 'team_id', v_chosen_team, 'engine', 'round_robin'));

  return query select v_chosen_staff, v_chosen_team, v_team_lead;
end;
$$;

-- 4) DASHBOARD: extend admin stats with Meta/WhatsApp/teams widgets ----
drop function if exists public.get_admin_dashboard_stats();
create or replace function public.get_admin_dashboard_stats()
returns table (
  total_leads bigint, todays_leads bigint, active_staff bigint, team_leads bigint,
  meetings_today bigint, pending_follow_ups bigint, total_calls bigint,
  won_leads bigint, lost_leads bigint,
  meta_leads bigint, whatsapp_leads bigint, active_teams bigint
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
    (select count(*) from public.teams where is_active);
$$;

-- 5) RLS --------------------------------------------------------------
alter table public.teams enable row level security;
alter table public.round_robin_state enable row level security;
-- round_robin_state: no policies — only the backend (service role) touches it.

drop policy if exists p_teams_read_all on public.teams;
create policy p_teams_read_all on public.teams for select using (true);
drop policy if exists p_teams_admin_write on public.teams;
create policy p_teams_admin_write on public.teams for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

-- 6) REALTIME (leads publication already includes leads) ---------------
