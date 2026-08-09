-- =====================================================================
-- Migration 08 — Per-project WhatsApp numbers.
--
-- Each project can have its own WhatsApp Business phone number. Inbound
-- messages are routed to the right project by matching the Cloud API
-- webhook's `metadata.phone_number_id` against this table; leads created
-- from an unrecognized/unconfigured number still fall back to Default
-- Project (leads.project_id already defaults there — see migration_05).
-- Run AFTER migration_07_dashboard_project_scope.sql. Safe to re-run.
-- =====================================================================

create table if not exists public.whatsapp_integrations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  phone_number_id text not null,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id),
  unique (phone_number_id)
);

drop trigger if exists trg_whatsapp_integrations_updated_at on public.whatsapp_integrations;
create trigger trg_whatsapp_integrations_updated_at before update on public.whatsapp_integrations
  for each row execute function public.set_updated_at();

create index if not exists idx_whatsapp_integrations_phone_number_id
  on public.whatsapp_integrations (phone_number_id);
