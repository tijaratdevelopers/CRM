-- Lets a specific Meta ad campaign be routed straight to one staff member or
-- one team lead, bypassing the project's round-robin pool for that
-- campaign's leads only — the project-level equivalent is projects.direct_staff_id.
alter table public.meta_campaigns
  add column if not exists direct_staff_id uuid references public.users(id) on delete set null,
  add column if not exists direct_team_lead_id uuid references public.users(id) on delete set null;
