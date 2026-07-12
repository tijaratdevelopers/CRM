# CRM System

A production-style CRM: React 19 + Vite + TypeScript frontend, Express + TypeScript backend, Supabase (Postgres + Auth + Storage + Realtime) as the database and identity provider. Role-based access for **Admin**, **Team Lead**, and **Staff**.

## Tech stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, shadcn-style components (Radix primitives), React Router, TanStack Query + TanStack Table, Axios, React Hook Form + Zod, Recharts, Socket.io client.
- **Backend**: Node.js, Express, TypeScript, Supabase JS SDK (service role), Socket.io, ExcelJS + PDFKit for report exports.
- **Database**: Supabase Postgres with Row Level Security, Realtime, Storage, and stored SQL functions for dashboard stats.

## Project layout

```
crm-system/
  supabase/        SQL schema + seed data — run these in the Supabase SQL editor
  backend/         Express API (port 4000)
  frontend/        React app (port 5173)
```

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In **Project Settings → API**, copy the **Project URL**, **anon public key**, and **service_role key** — you'll need all three below.
3. Open the **SQL Editor** and run, in order:
   1. `supabase/schema.sql` — creates enums, tables, indexes, triggers, dashboard RPC functions, RLS policies, and the `lead-documents` storage bucket.
   2. Read the comment block at the top of `supabase/seed.sql` before running it — you must first create 7 demo auth accounts (one admin, two team leads, four staff) either via **Authentication → Users → Add user** in the dashboard, or via the CRM's own "Add User" screen once the backend is running with a first admin account created manually. Then run `supabase/seed.sql` to backfill their CRM profiles and some sample leads/meetings/follow-ups/call logs.

## 2. Configure and run the backend

```bash
cd backend
cp .env.example .env
# edit .env: paste your Supabase URL + anon key + service role key
npm install
npm run dev
```

The API listens on `http://localhost:4000`. Check `http://localhost:4000/health`.

## 3. Configure and run the frontend

```bash
cd frontend
cp .env.example .env
# edit .env: paste your Supabase URL + anon key (VITE_API_URL/VITE_SOCKET_URL already point at localhost:4000)
npm install
npm run dev
```

The app runs on `http://localhost:5173`. Log in with one of the seeded accounts (see `supabase/seed.sql`).

## Roles

- **Admin** — full system access: users, team leads, staff, all leads, reports, settings, activity logs.
- **Team Lead** — manages their assigned staff, views team performance, approves tasks.
- **Staff** — manages only their assigned leads: calls, meetings, follow-ups, notes, documents.

## Notable design choices

- **Auth**: the frontend talks to Supabase Auth directly (anon key) for sign-in; the Express backend verifies the resulting JWT on every request (`supabaseAdmin.auth.getUser(token)`) and loads the caller's role from `public.users`. The backend then uses the **service role** key for all data access, enforcing role checks itself — Supabase RLS is a defense-in-depth layer for anything read directly from the frontend (Realtime subscriptions).
- **Realtime**: Supabase Realtime is enabled on `notifications`, `leads`, and `whatsapp_messages`. The backend also runs a Socket.io server so newly-created notifications reach the browser instantly (no wait on Realtime replication).
- **Reminders**: an in-process poller (`backend/src/jobs/reminderChecker.ts`) checks for upcoming meeting/follow-up reminders every 60s and fires a notification — swap for a real cron/queue in production.
- **WhatsApp / Meta integrations**: the webhook routes, message/template CRUD, and chat UI are fully functional against the database. The actual outbound Graph API calls (`backend/src/integrations/whatsapp.service.ts`, `meta.service.ts`) are stubbed with clear `// TODO` markers — plug in real WhatsApp Business/Meta app credentials in `backend/.env` and replace the stub bodies with real `fetch()` calls when you have verified business accounts.
- **Document uploads**: lead documents go straight from the frontend to Supabase Storage (bucket `lead-documents`) + a `lead_documents` metadata table, both protected by RLS — no backend involvement needed.
- **Reports**: CSV/Excel/PDF exports are generated server-side (`backend/src/reports/`) and streamed as file downloads.

## Adding more users after the first admin

Once logged in as an admin, use the **Users** screen to create Team Lead and Staff accounts — this calls the backend, which creates the Supabase Auth user and the matching `public.users` profile in one step, and shows you a temporary password to share with them (there's no email delivery configured in this dev setup).
