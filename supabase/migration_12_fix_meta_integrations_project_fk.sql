-- meta_integrations.project_id was added in migration_06 without ON DELETE
-- CASCADE (unlike its sibling connection tables meta_ad_accounts and
-- whatsapp_integrations, which already cascade correctly) — this made
-- deleting a project fail with a raw foreign key violation whenever it had a
-- Meta integration connected. A project's Meta connection is config, not
-- business data worth blocking a delete over (unlike teams/leads, which
-- intentionally still restrict), so this brings it in line with the rest.
alter table public.meta_integrations
  drop constraint if exists meta_integrations_project_id_fkey;

alter table public.meta_integrations
  add constraint meta_integrations_project_id_fkey
  foreign key (project_id) references public.projects (id) on delete cascade;
