-- =====================================================================
-- CRM System — demo seed data
-- Run AFTER schema.sql. This seeds lookup data and sample CRM records.
--
-- IMPORTANT: auth.users rows CANNOT be created via plain SQL (Supabase manages
-- password hashing through GoTrue). Create the demo accounts first, then run
-- this file:
--
--   1. Go to Authentication -> Users -> Add user (in the Supabase dashboard),
--      or use the backend once it's running: it exposes an admin-only
--      POST /api/users endpoint that calls supabaseAdmin.auth.admin.createUser().
--   2. Create these 7 accounts (any password, e.g. "Password123!"):
--        admin@crm.test          (you'll set role='admin' below)
--        teamlead1@crm.test      (role='team_lead')
--        teamlead2@crm.test      (role='team_lead')
--        staff1@crm.test         (role='staff', reports to teamlead1)
--        staff2@crm.test         (role='staff', reports to teamlead1)
--        staff3@crm.test         (role='staff', reports to teamlead2)
--        staff4@crm.test         (role='staff', reports to teamlead2)
--   3. Come back and run this script — it looks up each auth.users row by
--      email and fills in public.users + sample leads/meetings/etc.
--
-- The very first admin must be created this way (chicken-and-egg: creating
-- users normally requires an already-authenticated admin). After that, use
-- the CRM's own "Add User" screen for everyone else.
-- =====================================================================

-- 1) Upsert public.users profiles for whichever of the demo emails already
--    exist in auth.users (safe to run before all 7 are created — it just
--    skips missing ones and you can re-run this file after adding more).
insert into public.users (id, email, full_name, role, is_active)
select id, email, 'Admin User', 'admin', true
from auth.users where email = 'admin@crm.test'
on conflict (id) do update set role = 'admin', full_name = 'Admin User';

insert into public.users (id, email, full_name, role, is_active)
select id, email, 'Taylor Team Lead', 'team_lead', true
from auth.users where email = 'teamlead1@crm.test'
on conflict (id) do update set role = 'team_lead', full_name = 'Taylor Team Lead';

insert into public.users (id, email, full_name, role, is_active)
select id, email, 'Jordan Team Lead', 'team_lead', true
from auth.users where email = 'teamlead2@crm.test'
on conflict (id) do update set role = 'team_lead', full_name = 'Jordan Team Lead';

insert into public.users (id, email, full_name, role, team_lead_id, is_active)
select u.id, u.email, 'Sam Staff', 'staff', tl.id, true
from auth.users u, public.users tl
where u.email = 'staff1@crm.test' and tl.email = 'teamlead1@crm.test'
on conflict (id) do update set role = 'staff', team_lead_id = excluded.team_lead_id, full_name = 'Sam Staff';

insert into public.users (id, email, full_name, role, team_lead_id, is_active)
select u.id, u.email, 'Casey Staff', 'staff', tl.id, true
from auth.users u, public.users tl
where u.email = 'staff2@crm.test' and tl.email = 'teamlead1@crm.test'
on conflict (id) do update set role = 'staff', team_lead_id = excluded.team_lead_id, full_name = 'Casey Staff';

insert into public.users (id, email, full_name, role, team_lead_id, is_active)
select u.id, u.email, 'Riley Staff', 'staff', tl.id, true
from auth.users u, public.users tl
where u.email = 'staff3@crm.test' and tl.email = 'teamlead2@crm.test'
on conflict (id) do update set role = 'staff', team_lead_id = excluded.team_lead_id, full_name = 'Riley Staff';

insert into public.users (id, email, full_name, role, team_lead_id, is_active)
select u.id, u.email, 'Morgan Staff', 'staff', tl.id, true
from auth.users u, public.users tl
where u.email = 'staff4@crm.test' and tl.email = 'teamlead2@crm.test'
on conflict (id) do update set role = 'staff', team_lead_id = excluded.team_lead_id, full_name = 'Morgan Staff';

-- 2) Lead sources & campaigns
insert into public.lead_sources (name, description) values
  ('Meta Lead Ads', 'Facebook/Instagram lead ads'),
  ('WhatsApp Business API', 'Inbound WhatsApp conversations'),
  ('Manual Entry', 'Entered directly by staff/admin'),
  ('CSV Upload', 'Bulk imported leads'),
  ('Website Contact Form', 'Leads from the public website form')
on conflict (name) do nothing;

insert into public.campaigns (name, source_id, is_active)
select 'Summer Promo 2026', id, true from public.lead_sources where name = 'Meta Lead Ads'
on conflict do nothing;
insert into public.campaigns (name, source_id, is_active)
select 'Website Evergreen', id, true from public.lead_sources where name = 'Website Contact Form'
on conflict do nothing;

-- 3) Sample leads distributed across staff (only runs once staff exist)
insert into public.leads (name, phone, whatsapp, email, company, city, country, source_id, campaign_id, assigned_staff_id, assigned_team_lead_id, status, priority, notes, created_by, last_modified_by)
select
  v.name, v.phone, v.phone, v.email, v.company, v.city, v.country,
  (select id from public.lead_sources order by random() limit 1),
  (select id from public.campaigns order by random() limit 1),
  s.id, s.team_lead_id, v.status::lead_status_enum, v.priority::lead_priority_enum, v.notes,
  a.id, a.id
from (values
  ('Ali Raza', '+923001234567', 'ali.raza@example.com', 'Raza Traders', 'Lahore', 'Pakistan', 'new', 'medium', 'Interested in bulk pricing'),
  ('Sana Khan', '+923004567891', 'sana.khan@example.com', 'Khan Textiles', 'Karachi', 'Pakistan', 'contacted', 'high', 'Follow up next week'),
  ('John Miller', '+14155550100', 'john.miller@example.com', 'Miller & Co', 'New York', 'USA', 'meeting_scheduled', 'high', 'Demo scheduled'),
  ('Fatima Noor', '+923214567890', 'fatima.noor@example.com', 'Noor Enterprises', 'Islamabad', 'Pakistan', 'won', 'medium', 'Deal closed, onboarding started'),
  ('David Lee', '+821012345678', 'david.lee@example.com', 'Lee Corp', 'Seoul', 'South Korea', 'lost', 'low', 'Budget constraints'),
  ('Emma Wilson', '+447911123456', 'emma.wilson@example.com', 'Wilson Ltd', 'London', 'UK', 'proposal_sent', 'urgent', 'Awaiting signature'),
  ('Ahmed Siddiqui', '+923331234567', 'ahmed.s@example.com', 'Siddiqui Group', 'Faisalabad', 'Pakistan', 'follow_up', 'medium', 'Requested pricing sheet'),
  ('Maria Garcia', '+34911234567', 'maria.garcia@example.com', 'Garcia SA', 'Madrid', 'Spain', 'negotiation', 'high', 'Negotiating contract terms')
) as v(name, phone, email, company, city, country, status, priority, notes)
cross join lateral (
  select id, team_lead_id from public.users where role = 'staff' order by random() limit 1
) as s
cross join lateral (
  select id from public.users where role = 'admin' limit 1
) as a
where exists (select 1 from public.users where role = 'staff');

-- 4) A couple of meetings, follow-ups, and call logs against the seeded leads
insert into public.meetings (lead_id, staff_id, title, meeting_date, meeting_time, mode, meet_link, notes)
select l.id, l.assigned_staff_id, 'Intro call with ' || l.name, current_date, '14:00', 'online',
  'https://meet.google.com/demo-link', 'Discuss requirements'
from public.leads l where l.status = 'meeting_scheduled' limit 1;

insert into public.follow_ups (lead_id, staff_id, reminder_date, reminder_time, notes, status)
select l.id, l.assigned_staff_id, current_date + 1, '10:00', 'Send pricing sheet', 'pending'
from public.leads l where l.status = 'follow_up' limit 1;

insert into public.call_logs (lead_id, staff_id, call_date, call_time, duration_seconds, status, notes)
select l.id, l.assigned_staff_id, current_date, '11:30', 320, 'completed', 'Discussed requirements, positive response'
from public.leads l where l.status = 'contacted' limit 1;

-- 5) Message templates
insert into public.message_templates (name, body, variables)
values
  ('Welcome', 'Hi {{name}}, thanks for reaching out to us! How can we help you today?', '["name"]'::jsonb),
  ('Follow Up', 'Hi {{name}}, just following up on our last conversation. Are you still interested?', '["name"]'::jsonb)
on conflict do nothing;
