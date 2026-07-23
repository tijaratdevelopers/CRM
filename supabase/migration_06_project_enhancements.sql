-- =====================================================================
-- Migration 06 — Per-project Meta ads hierarchy, lead attribution,
-- configurable staff round-robin sequencing.
-- Run AFTER migration_05_projects.sql. Safe to re-run.
-- =====================================================================

-- 1) META GOES PER-PROJECT ------------------------------------------------
alter table public.meta_integrations add column if not exists project_id uuid references public.projects (id);

update public.meta_integrations
set project_id = (select id from public.projects where name = 'Default Project')
where project_id is null;

drop index if exists idx_meta_integrations_project_id;
create unique index idx_meta_integrations_project_id on public.meta_integrations (project_id);

-- 2) META AD HIERARCHY -----------------------------------------------------
create table if not exists public.meta_pages (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.meta_integrations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  page_id text not null,
  name text not null,
  page_access_token text, -- encrypted (AES-256-GCM, "enc:v1:..." — see backend/src/utils/crypto.ts)
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (integration_id, page_id)
);

drop trigger if exists trg_meta_pages_updated_at on public.meta_pages;
create trigger trg_meta_pages_updated_at before update on public.meta_pages
  for each row execute function public.set_updated_at();

create table if not exists public.meta_forms (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.meta_pages (id) on delete cascade,
  form_id text not null,
  name text not null,
  status text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (page_id, form_id)
);

create table if not exists public.meta_ad_accounts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  integration_id uuid references public.meta_integrations (id) on delete cascade,
  ad_account_id text not null,
  name text,
  currency text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, ad_account_id)
);

drop trigger if exists trg_meta_ad_accounts_updated_at on public.meta_ad_accounts;
create trigger trg_meta_ad_accounts_updated_at before update on public.meta_ad_accounts
  for each row execute function public.set_updated_at();

create table if not exists public.meta_campaigns (
  id uuid primary key default gen_random_uuid(),
  ad_account_id uuid not null references public.meta_ad_accounts (id) on delete cascade,
  campaign_id text not null,
  name text,
  objective text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ad_account_id, campaign_id)
);

drop trigger if exists trg_meta_campaigns_updated_at on public.meta_campaigns;
create trigger trg_meta_campaigns_updated_at before update on public.meta_campaigns
  for each row execute function public.set_updated_at();

create table if not exists public.meta_ad_sets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.meta_campaigns (id) on delete cascade,
  ad_set_id text not null,
  name text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, ad_set_id)
);

drop trigger if exists trg_meta_ad_sets_updated_at on public.meta_ad_sets;
create trigger trg_meta_ad_sets_updated_at before update on public.meta_ad_sets
  for each row execute function public.set_updated_at();

create table if not exists public.meta_ads (
  id uuid primary key default gen_random_uuid(),
  ad_set_id uuid not null references public.meta_ad_sets (id) on delete cascade,
  ad_id text not null,
  name text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ad_set_id, ad_id)
);

drop trigger if exists trg_meta_ads_updated_at on public.meta_ads;
create trigger trg_meta_ads_updated_at before update on public.meta_ads
  for each row execute function public.set_updated_at();

create table if not exists public.meta_pixels (
  id uuid primary key default gen_random_uuid(),
  ad_account_id uuid not null references public.meta_ad_accounts (id) on delete cascade,
  pixel_id text not null,
  name text,
  created_at timestamptz not null default now(),
  unique (ad_account_id, pixel_id)
);

create index if not exists idx_meta_pages_project on public.meta_pages (project_id);
create index if not exists idx_meta_forms_page on public.meta_forms (page_id);
create index if not exists idx_meta_ad_accounts_project on public.meta_ad_accounts (project_id);
create index if not exists idx_meta_campaigns_ad_account on public.meta_campaigns (ad_account_id);
create index if not exists idx_meta_ad_sets_campaign on public.meta_ad_sets (campaign_id);
create index if not exists idx_meta_ads_ad_set on public.meta_ads (ad_set_id);
create index if not exists idx_meta_pixels_ad_account on public.meta_pixels (ad_account_id);

-- 3) LEAD ATTRIBUTION (Feature 12) -----------------------------------------
alter table public.leads add column if not exists meta_page_id uuid references public.meta_pages (id) on delete set null;
alter table public.leads add column if not exists meta_form_id uuid references public.meta_forms (id) on delete set null;
alter table public.leads add column if not exists meta_campaign_id uuid references public.meta_campaigns (id) on delete set null;
alter table public.leads add column if not exists meta_ad_set_id uuid references public.meta_ad_sets (id) on delete set null;
alter table public.leads add column if not exists meta_ad_id uuid references public.meta_ads (id) on delete set null;
-- 'direct_staff' | 'round_robin' | 'unassigned' | 'manual'
alter table public.leads add column if not exists assignment_rule_used text;

-- Raw Meta object ids captured immediately from the webhook payload, before
-- any admin "Sync" has imported the local meta_campaigns/meta_ad_sets/meta_ads
-- rows to link the *_id FK columns above to. Backfilled onto the FK columns
-- (by matching these text ids) the first time that ad account is synced —
-- see metaIntegration.service.ts syncCampaigns/syncAdSets/syncAds.
alter table public.leads add column if not exists meta_campaign_ref text;
alter table public.leads add column if not exists meta_ad_set_ref text;
alter table public.leads add column if not exists meta_ad_ref text;

create index if not exists idx_leads_meta_campaign on public.leads (meta_campaign_id);
create index if not exists idx_leads_meta_ad_set on public.leads (meta_ad_set_id);
create index if not exists idx_leads_meta_ad on public.leads (meta_ad_id);

-- 4) STAFF SEQUENCING (Features 8/9) ---------------------------------------
-- Null = fall back to created_at/id ordering (today's behavior, unchanged
-- until an admin explicitly reorders a team's staff).
alter table public.users add column if not exists round_robin_position integer;

-- 5) ASSIGNMENT ENGINE: honor staff sequencing ------------------------------
drop function if exists public.assign_lead_round_robin(uuid, uuid);
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

    -- Admin-configurable order (Features 8/9): explicit round_robin_position
    -- first, then created_at/id for staff that haven't been manually ordered.
    select array_agg(u.id order by u.round_robin_position nulls last, u.created_at, u.id) into v_staff
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
      assignment_rule_used = 'round_robin',
      updated_at = now()
  where id = p_lead_id;

  insert into public.activity_logs (actor_id, entity_type, entity_id, action, metadata)
  values (null, 'lead', p_lead_id, 'auto_assigned',
    jsonb_build_object('staff_id', v_chosen_staff, 'team_id', v_chosen_team, 'project_id', p_project_id, 'engine', 'round_robin'));

  return query select v_chosen_staff, v_chosen_team, v_team_lead;
end;
$$;

-- 6) RLS ---------------------------------------------------------------------
-- Same posture as meta_integrations: backend reads/writes with the service
-- role key; these tables carry Meta tokens/config, so no broad read policy.
alter table public.meta_pages enable row level security;
alter table public.meta_forms enable row level security;
alter table public.meta_ad_accounts enable row level security;
alter table public.meta_campaigns enable row level security;
alter table public.meta_ad_sets enable row level security;
alter table public.meta_ads enable row level security;
alter table public.meta_pixels enable row level security;

drop policy if exists p_meta_pages_admin_all on public.meta_pages;
create policy p_meta_pages_admin_all on public.meta_pages for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
drop policy if exists p_meta_forms_admin_all on public.meta_forms;
create policy p_meta_forms_admin_all on public.meta_forms for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
drop policy if exists p_meta_ad_accounts_admin_all on public.meta_ad_accounts;
create policy p_meta_ad_accounts_admin_all on public.meta_ad_accounts for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
drop policy if exists p_meta_campaigns_admin_all on public.meta_campaigns;
create policy p_meta_campaigns_admin_all on public.meta_campaigns for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
drop policy if exists p_meta_ad_sets_admin_all on public.meta_ad_sets;
create policy p_meta_ad_sets_admin_all on public.meta_ad_sets for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
drop policy if exists p_meta_ads_admin_all on public.meta_ads;
create policy p_meta_ads_admin_all on public.meta_ads for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
drop policy if exists p_meta_pixels_admin_all on public.meta_pixels;
create policy p_meta_pixels_admin_all on public.meta_pixels for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
