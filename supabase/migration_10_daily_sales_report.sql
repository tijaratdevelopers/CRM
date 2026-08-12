-- =====================================================================
-- migration_10_daily_sales_report.sql
-- Run AFTER migration_09_meta_leadgen_dedupe.sql (and the base schema.sql).
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS throughout.
--
-- Adds the data the "Daily Sales Report" (admin-only, auto-aggregated
-- per staff per day) needs that doesn't exist yet:
--   - meetings.meeting_type: categorizes a meeting as a site visit, an
--     end-user client meeting, a dealer meeting, or other.
--   - bookings: one row per lead that gets marked "won" with sale details.
--   - staff_daily_notes: one optional free-text remark per staff per day.
-- =====================================================================

do $$ begin
  create type meeting_type_enum as enum ('site_visit', 'end_user', 'dealer', 'other');
exception when duplicate_object then null; end $$;

alter table public.meetings
  add column if not exists meeting_type meeting_type_enum not null default 'other';

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  staff_id uuid not null references public.users (id) on delete cascade,
  project_id uuid not null references public.projects (id),
  property_plot text not null,
  amount numeric not null,
  down_payment_done boolean not null default false,
  booking_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bookings_staff_date on public.bookings (staff_id, booking_date);
create index if not exists idx_bookings_lead on public.bookings (lead_id);

drop trigger if exists trg_bookings_updated_at on public.bookings;
create trigger trg_bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

create table if not exists public.staff_daily_notes (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.users (id) on delete cascade,
  note_date date not null default current_date,
  remarks text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id, note_date)
);

drop trigger if exists trg_staff_daily_notes_updated_at on public.staff_daily_notes;
create trigger trg_staff_daily_notes_updated_at before update on public.staff_daily_notes
  for each row execute function public.set_updated_at();

alter table public.bookings enable row level security;
alter table public.staff_daily_notes enable row level security;

drop policy if exists p_bookings_scoped on public.bookings;
create policy p_bookings_scoped on public.bookings for all
  using (
    public.current_user_role() = 'admin'
    or staff_id = auth.uid()
    or exists (select 1 from public.users u where u.id = bookings.staff_id and u.team_lead_id = auth.uid())
  );

drop policy if exists p_staff_daily_notes_scoped on public.staff_daily_notes;
create policy p_staff_daily_notes_scoped on public.staff_daily_notes for all
  using (
    public.current_user_role() = 'admin'
    or staff_id = auth.uid()
    or exists (select 1 from public.users u where u.id = staff_daily_notes.staff_id and u.team_lead_id = auth.uid())
  );
