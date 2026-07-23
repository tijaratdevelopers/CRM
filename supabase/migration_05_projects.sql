-- =====================================================================
-- Multi-Project foundation. Run AFTER migration_04_in_progress_stat.sql.
-- Backfills everything into one "Default Project" so existing behavior is
-- 100% unchanged until an admin creates a second project.
-- =====================================================================

-- 1) PROJECTS -----------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  -- When set, ALL of this project's leads go straight to this one staff
  -- member — round robin is skipped entirely for this project.
  direct_staff_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

insert into public.projects (name, description)
values ('Default Project', 'Auto-created to hold all pre-existing teams and leads.')
on conflict (name) do nothing;

-- Postgres doesn't allow a bare subquery in a column DEFAULT expression, but
-- it does allow a function call — this wraps the same lookup so leads.project_id
-- can default to it below.
create or replace function public.default_project_id()
returns uuid
language sql
stable
as $$
  select id from public.projects where name = 'Default Project';
$$;

-- 2) TEAMS: scope by project --------------------------------------------
alter table public.teams add column if not exists project_id uuid references public.projects (id) on delete restrict;

update public.teams t
set project_id = (select id from public.projects where name = 'Default Project')
where t.project_id is null;

alter table public.teams alter column project_id set not null;

-- Team names were globally unique; make them unique per project instead.
alter table public.teams drop constraint if exists teams_name_key;
drop index if exists idx_teams_project_name;
create unique index idx_teams_project_name on public.teams (project_id, name);

create index if not exists idx_teams_project_id on public.teams (project_id);

-- 3) LEADS: scope by project ---------------------------------------------
alter table public.leads add column if not exists project_id uuid references public.projects (id) on delete restrict;

update public.leads l
set project_id = (select id from public.projects where name = 'Default Project')
where l.project_id is null;

alter table public.leads alter column project_id set not null;
-- Safety net: any insert path that forgets to pass project_id lands in
-- Default Project instead of failing outright.
alter table public.leads alter column project_id
  set default public.default_project_id();

create index if not exists idx_leads_project_id on public.leads (project_id);

-- 4) ROUND ROBIN STATE: one pointer-pair row per project ------------------
alter table public.round_robin_state add column if not exists project_id uuid references public.projects (id);

update public.round_robin_state
set project_id = (select id from public.projects where name = 'Default Project')
where project_id is null;

alter table public.round_robin_state drop constraint if exists round_robin_state_pkey;
alter table public.round_robin_state drop constraint if exists round_robin_state_id_check;
alter table public.round_robin_state alter column project_id set not null;
alter table public.round_robin_state add primary key (project_id);
alter table public.round_robin_state drop column if exists id;

-- 5) ASSIGNMENT ENGINE: project-scoped -----------------------------------
drop function if exists public.assign_lead_round_robin(uuid);
create or replace function public.assign_lead_round_robin(p_lead_id uuid, p_project_id uuid)
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
  select * into v_state from public.round_robin_state where project_id = p_project_id for update;
  if not found then
    insert into public.round_robin_state (project_id) values (p_project_id)
    on conflict (project_id) do update set project_id = excluded.project_id
    returning * into v_state;
  end if;

  select array_agg(t.id order by t.created_at, t.id) into v_teams
  from public.teams t
  where t.is_active
    and t.project_id = p_project_id
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
  where project_id = p_project_id;

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
    jsonb_build_object('staff_id', v_chosen_staff, 'team_id', v_chosen_team, 'project_id', p_project_id, 'engine', 'round_robin'));

  return query select v_chosen_staff, v_chosen_team, v_team_lead;
end;
$$;

-- 6) RLS ------------------------------------------------------------------
alter table public.projects enable row level security;

drop policy if exists p_projects_read_all on public.projects;
create policy p_projects_read_all on public.projects for select using (true);
drop policy if exists p_projects_admin_write on public.projects;
create policy p_projects_admin_write on public.projects for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
