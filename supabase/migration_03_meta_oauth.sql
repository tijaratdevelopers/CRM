-- =====================================================================
-- Migration 03 — Meta Lead Ads OAuth integration
-- Stores the OAuth-based Meta connection (tokens are encrypted by the
-- backend before insert — never stored in plaintext).
-- Run once in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

create table if not exists public.meta_integrations (
  id uuid primary key default gen_random_uuid(),

  -- Encrypted (AES-256-GCM, "enc:v1:..." format) — decrypted only by the backend.
  user_access_token text,
  page_access_token text,
  token_expires_at timestamptz,

  business_id text,
  business_name text,
  page_id text,
  page_name text,

  -- [{ "id": "...", "name": "Honda Campaign" }, ...]
  forms jsonb not null default '[]'::jsonb,

  -- pending_setup -> connected. Expiry is computed from token_expires_at.
  status text not null default 'pending_setup',
  webhook_subscribed boolean not null default false,

  connected_by uuid references public.users (id) on delete set null,
  last_synced_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_meta_integrations_updated_at on public.meta_integrations;
create trigger trg_meta_integrations_updated_at before update on public.meta_integrations
  for each row execute function public.set_updated_at();

-- Backend accesses this table with the service role key only.
alter table public.meta_integrations enable row level security;
