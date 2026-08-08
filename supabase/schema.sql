



-- =====================================================================
-- CRM System — Supabase Postgres schema
-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query)
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where possible.
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
-- 1. ENUMS
-- =====================================================================
do $$ begin
  create type role_enum as enum ('admin', 'team_lead', 'staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_status_enum as enum (
    'new', 'assigned', 'contacted', 'interested', 'meeting_scheduled',
    'follow_up', 'proposal_sent', 'negotiation', 'won', 'lost', 'closed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_priority_enum as enum ('low', 'medium', 'high', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type meeting_mode_enum as enum ('online', 'offline');
exception when duplicate_object then null; end $$;

do $$ begin
  create type meeting_status_enum as enum ('scheduled', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type follow_up_status_enum as enum ('pending', 'done', 'missed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type call_status_enum as enum ('completed', 'no_answer', 'busy', 'voicemail', 'wrong_number');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status_enum as enum ('pending', 'submitted', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type wa_direction_enum as enum ('inbound', 'outbound');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- 2. TABLES
-- =====================================================================

-- Mirrors auth.users 1:1. Row is created by the backend right after
-- supabaseAdmin.auth.admin.createUser() succeeds.
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null,
  phone text,
  role role_enum not null default 'staff',
  team_lead_id uuid references public.users (id) on delete set null,
  is_active boolean not null default true,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_id uuid references public.lead_sources (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  whatsapp text,
  email text,
  company text,
  city text,
  country text,
  source_id uuid references public.lead_sources (id) on delete set null,
  campaign_id uuid references public.campaigns (id) on delete set null,
  assigned_staff_id uuid references public.users (id) on delete set null,
  assigned_team_lead_id uuid references public.users (id) on delete set null,
  status lead_status_enum not null default 'new',
  priority lead_priority_enum not null default 'medium',
  notes text,
  created_by uuid references public.users (id) on delete set null,
  last_modified_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_documents (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  uploaded_by uuid references public.users (id) on delete set null,
  file_path text not null,
  file_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  staff_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  meeting_date date not null,
  meeting_time time not null,
  mode meeting_mode_enum not null default 'online',
  meet_link text,
  zoom_link text,
  location text,
  notes text,
  reminder_at timestamptz,
  reminder_sent boolean not null default false,
  status meeting_status_enum not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  staff_id uuid not null references public.users (id) on delete cascade,
  reminder_date date not null,
  reminder_time time not null,
  notes text,
  reminder_sent boolean not null default false,
  status follow_up_status_enum not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  staff_id uuid not null references public.users (id) on delete cascade,
  call_date date not null,
  call_time time not null,
  duration_seconds integer not null default 0,
  status call_status_enum not null default 'completed',
  notes text,
  recording_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_by uuid references public.users (id) on delete set null,
  assigned_to uuid references public.users (id) on delete set null,
  status task_status_enum not null default 'pending',
  approved_by uuid references public.users (id) on delete set null,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  is_read boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body text not null,
  variables jsonb not null default '[]'::jsonb,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete cascade,
  direction wa_direction_enum not null,
  body text,
  template_id uuid references public.message_templates (id) on delete set null,
  status text not null default 'sent',
  wa_message_id text,
  assigned_to uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users (id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- 3. INDEXES
-- =====================================================================
create index if not exists idx_users_role on public.users (role);
create index if not exists idx_users_team_lead_id on public.users (team_lead_id);

create index if not exists idx_leads_status on public.leads (status);
create index if not exists idx_leads_assigned_staff on public.leads (assigned_staff_id);
create index if not exists idx_leads_assigned_team_lead on public.leads (assigned_team_lead_id);
create index if not exists idx_leads_source on public.leads (source_id);
create index if not exists idx_leads_created_at on public.leads (created_at);

create index if not exists idx_meetings_lead on public.meetings (lead_id);
create index if not exists idx_meetings_staff on public.meetings (staff_id);
create index if not exists idx_meetings_date on public.meetings (meeting_date);

create index if not exists idx_follow_ups_staff on public.follow_ups (staff_id);
create index if not exists idx_follow_ups_date on public.follow_ups (reminder_date);
create index if not exists idx_follow_ups_status on public.follow_ups (status);

create index if not exists idx_call_logs_lead on public.call_logs (lead_id);
create index if not exists idx_call_logs_staff on public.call_logs (staff_id);

create index if not exists idx_tasks_assigned_to on public.tasks (assigned_to);

create index if not exists idx_notifications_user_unread on public.notifications (user_id, is_read);

create index if not exists idx_whatsapp_messages_lead on public.whatsapp_messages (lead_id);

create index if not exists idx_activity_logs_entity on public.activity_logs (entity_type, entity_id);
create index if not exists idx_activity_logs_created_at on public.activity_logs (created_at desc);

-- =====================================================================
-- 4. TRIGGER FUNCTIONS + TRIGGERS
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists trg_leads_updated_at on public.leads;
create trigger trg_leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

drop trigger if exists trg_meetings_updated_at on public.meetings;
create trigger trg_meetings_updated_at before update on public.meetings
  for each row execute function public.set_updated_at();

drop trigger if exists trg_follow_ups_updated_at on public.follow_ups;
create trigger trg_follow_ups_updated_at before update on public.follow_ups
  for each row execute function public.set_updated_at();

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- Automatically captures the lead lifecycle (New -> Assigned -> Contacted -> ... -> Won/Lost)
-- into activity_logs. Services also call the explicit logActivity() helper for actions that
-- aren't a plain row mutation (e.g. "sent WhatsApp template"); this trigger is the safety net
-- for status/assignment changes specifically since those are easy to forget to log manually.
create or replace function public.log_lead_activity()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_logs (actor_id, entity_type, entity_id, action, metadata)
    values (new.last_modified_by, 'lead', new.id, 'lead_created', jsonb_build_object('status', new.status));
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into public.activity_logs (actor_id, entity_type, entity_id, action, metadata)
      values (new.last_modified_by, 'lead', new.id, 'status_changed',
        jsonb_build_object('from', old.status, 'to', new.status));
    end if;
    if new.assigned_staff_id is distinct from old.assigned_staff_id
       or new.assigned_team_lead_id is distinct from old.assigned_team_lead_id then
      insert into public.activity_logs (actor_id, entity_type, entity_id, action, metadata)
      values (new.last_modified_by, 'lead', new.id, 'reassigned',
        jsonb_build_object(
          'staff_from', old.assigned_staff_id, 'staff_to', new.assigned_staff_id,
          'team_lead_from', old.assigned_team_lead_id, 'team_lead_to', new.assigned_team_lead_id
        ));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leads_activity on public.leads;
create trigger trg_leads_activity after insert or update on public.leads
  for each row execute function public.log_lead_activity();

-- =====================================================================
-- 5. DASHBOARD STATS FUNCTIONS
-- =====================================================================
create or replace function public.get_admin_dashboard_stats()
returns table (
  total_leads bigint, todays_leads bigint, active_staff bigint, team_leads bigint,
  meetings_today bigint, pending_follow_ups bigint, total_calls bigint,
  won_leads bigint, lost_leads bigint
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
    (select count(*) from public.leads where status = 'lost');
$$;

create or replace function public.get_team_lead_dashboard_stats(p_team_lead_id uuid)
returns table (
  assigned_staff bigint, assigned_leads bigint, pending_follow_ups bigint,
  meetings_today bigint, won_leads bigint, lost_leads bigint
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
    (select count(*) from public.leads where assigned_team_lead_id = p_team_lead_id and status = 'lost');
$$;

create or replace function public.get_staff_dashboard_stats(p_staff_id uuid)
returns table (
  my_leads bigint, calls_today bigint, meetings_today bigint,
  pending_follow_ups bigint, new_leads bigint
) language sql stable as $$
  select
    (select count(*) from public.leads where assigned_staff_id = p_staff_id),
    (select count(*) from public.call_logs where staff_id = p_staff_id and call_date = current_date),
    (select count(*) from public.meetings where staff_id = p_staff_id and meeting_date = current_date),
    (select count(*) from public.follow_ups where staff_id = p_staff_id and status = 'pending'),
    (select count(*) from public.leads where assigned_staff_id = p_staff_id and status = 'new');
$$;

-- =====================================================================
-- 6. ROW LEVEL SECURITY
-- =====================================================================
-- NOTE: the Express backend authenticates every request itself and then uses
-- the Supabase *service role* key (which bypasses RLS) to perform the actual
-- query, enforcing role checks in application middleware. RLS below is the
-- defense-in-depth layer for anything queried directly from the frontend with
-- the user's own session (Supabase Realtime subscriptions, and any direct
-- reads), so it's read-oriented; almost all writes go through the API.

create or replace function public.current_user_role()
returns role_enum language sql stable security definer
set search_path = public as $$
  select role from public.users where id = auth.uid();
$$;

alter table public.users enable row level security;
alter table public.lead_sources enable row level security;
alter table public.campaigns enable row level security;
alter table public.leads enable row level security;
alter table public.lead_documents enable row level security;
alter table public.meetings enable row level security;
alter table public.follow_ups enable row level security;
alter table public.call_logs enable row level security;
alter table public.tasks enable row level security;
alter table public.notifications enable row level security;
alter table public.message_templates enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.activity_logs enable row level security;

drop policy if exists p_users_admin_all on public.users;
create policy p_users_admin_all on public.users for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
drop policy if exists p_users_self_read on public.users;
create policy p_users_self_read on public.users for select using (id = auth.uid());
drop policy if exists p_users_team_lead_reads_staff on public.users;
create policy p_users_team_lead_reads_staff on public.users for select
  using (public.current_user_role() = 'team_lead' and team_lead_id = auth.uid());

drop policy if exists p_lookup_read_all on public.lead_sources;
create policy p_lookup_read_all on public.lead_sources for select using (true);
drop policy if exists p_lookup_admin_write on public.lead_sources;
create policy p_lookup_admin_write on public.lead_sources for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

drop policy if exists p_campaigns_read_all on public.campaigns;
create policy p_campaigns_read_all on public.campaigns for select using (true);
drop policy if exists p_campaigns_admin_write on public.campaigns;
create policy p_campaigns_admin_write on public.campaigns for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

drop policy if exists p_leads_admin_all on public.leads;
create policy p_leads_admin_all on public.leads for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
drop policy if exists p_leads_team_lead on public.leads;
create policy p_leads_team_lead on public.leads for select
  using (public.current_user_role() = 'team_lead' and assigned_team_lead_id = auth.uid());
drop policy if exists p_leads_staff on public.leads;
create policy p_leads_staff on public.leads for select
  using (public.current_user_role() = 'staff' and assigned_staff_id = auth.uid());
drop policy if exists p_leads_staff_update on public.leads;
create policy p_leads_staff_update on public.leads for update
  using (public.current_user_role() = 'staff' and assigned_staff_id = auth.uid());

drop policy if exists p_lead_documents_scoped on public.lead_documents;
create policy p_lead_documents_scoped on public.lead_documents for all
  using (
    public.current_user_role() = 'admin'
    or exists (select 1 from public.leads l where l.id = lead_id and (
      l.assigned_staff_id = auth.uid() or l.assigned_team_lead_id = auth.uid()
    ))
  );

drop policy if exists p_meetings_scoped on public.meetings;
create policy p_meetings_scoped on public.meetings for all
  using (
    public.current_user_role() = 'admin'
    or staff_id = auth.uid()
    or exists (select 1 from public.users u where u.id = meetings.staff_id and u.team_lead_id = auth.uid())
  );

drop policy if exists p_follow_ups_scoped on public.follow_ups;
create policy p_follow_ups_scoped on public.follow_ups for all
  using (
    public.current_user_role() = 'admin'
    or staff_id = auth.uid()
    or exists (select 1 from public.users u where u.id = follow_ups.staff_id and u.team_lead_id = auth.uid())
  );

drop policy if exists p_call_logs_scoped on public.call_logs;
create policy p_call_logs_scoped on public.call_logs for all
  using (
    public.current_user_role() = 'admin'
    or staff_id = auth.uid()
    or exists (select 1 from public.users u where u.id = call_logs.staff_id and u.team_lead_id = auth.uid())
  );

drop policy if exists p_tasks_scoped on public.tasks;
create policy p_tasks_scoped on public.tasks for all
  using (
    public.current_user_role() = 'admin'
    or assigned_to = auth.uid()
    or created_by = auth.uid()
  );

drop policy if exists p_notifications_owner on public.notifications;
create policy p_notifications_owner on public.notifications for all
  using (user_id = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists p_templates_read_all on public.message_templates;
create policy p_templates_read_all on public.message_templates for select using (true);
drop policy if exists p_templates_admin_write on public.message_templates;
create policy p_templates_admin_write on public.message_templates for all
  using (public.current_user_role() in ('admin', 'team_lead'))
  with check (public.current_user_role() in ('admin', 'team_lead'));

drop policy if exists p_whatsapp_scoped on public.whatsapp_messages;
create policy p_whatsapp_scoped on public.whatsapp_messages for all
  using (
    public.current_user_role() = 'admin'
    or assigned_to = auth.uid()
    or exists (select 1 from public.leads l where l.id = lead_id and (
      l.assigned_staff_id = auth.uid() or l.assigned_team_lead_id = auth.uid()
    ))
  );

drop policy if exists p_activity_logs_read on public.activity_logs;
create policy p_activity_logs_read on public.activity_logs for select
  using (
    public.current_user_role() = 'admin'
    or actor_id = auth.uid()
    or exists (
      select 1 from public.leads l where l.id = activity_logs.entity_id and (
        l.assigned_staff_id = auth.uid() or l.assigned_team_lead_id = auth.uid()
      )
    )
  );

-- =====================================================================
-- 7. STORAGE BUCKET
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('lead-documents', 'lead-documents', false)
on conflict (id) do nothing;

drop policy if exists p_storage_lead_documents on storage.objects;
create policy p_storage_lead_documents on storage.objects for all
  using (bucket_id = 'lead-documents' and auth.role() = 'authenticated')
  with check (bucket_id = 'lead-documents' and auth.role() = 'authenticated');

-- =====================================================================
-- 8. REALTIME
-- =====================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'leads'
  ) then
    alter publication supabase_realtime add table public.leads;
  end if;
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'whatsapp_messages'
  ) then
    alter publication supabase_realtime add table public.whatsapp_messages;
  end if;
end $$;
