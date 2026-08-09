-- =====================================================================
-- Migration 09 — Hard uniqueness guarantee for Meta leads.
--
-- The old dedupe check searched `notes` with ilike + .maybeSingle(), which
-- throws once two rows already match the same pattern — and that error was
-- silently swallowed, so every poll after the first duplicate re-inserted
-- the same lead again (one lead reached 24 copies before this was caught).
-- A real unique constraint makes that class of bug impossible: duplicate
-- inserts now fail fast with a Postgres error the app catches and ignores,
-- instead of a fragile pre-check race.
-- Run AFTER migration_08_whatsapp_projects.sql. Safe to re-run.
-- =====================================================================

alter table public.leads add column if not exists meta_leadgen_id text;

-- Backfill from the existing "Meta leadgen_id: <id>" line in notes for
-- leads created before this column existed.
update public.leads
set meta_leadgen_id = substring(notes from 'Meta leadgen_id: ([0-9]+)')
where meta_leadgen_id is null
  and notes ilike '%Meta leadgen_id:%';

-- Partial: only Meta-sourced leads have this id, so don't constrain nulls.
create unique index if not exists idx_leads_meta_leadgen_id_unique
  on public.leads (meta_leadgen_id)
  where meta_leadgen_id is not null;
