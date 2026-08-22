-- Marking a lead "Lost" previously recorded no reason, making lost-lead
-- reports useless for spotting patterns (pricing, competitors, etc).
-- This adds a required-at-the-app-layer reason, mirroring how "Won" already
-- requires a booking record (see migration_10_daily_sales_report.sql).
do $$ begin
  create type lead_lost_reason_enum as enum (
    'price_issue', 'no_response', 'competitor', 'not_interested', 'invalid_lead', 'other'
  );
exception when duplicate_object then null; end $$;

alter table public.leads
  add column if not exists lost_reason lead_lost_reason_enum,
  add column if not exists lost_reason_note text;
