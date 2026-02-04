# Supabase Setup

This app uses Supabase Auth + Postgres (RLS) for per-user request storage.

## 1) Configure environment variables

Create a `.env.local` in the repo root:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
```

For GitHub Pages deploys, add GitHub repo **Secrets**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The workflow `.github/workflows/deploy-pages.yml` reads these at build time.

## 2) Create the `requests` table + RLS policies

Run this SQL in Supabase (SQL Editor):

```sql
create table if not exists public.requests (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,

  student_name text not null,
  song_title text not null,
  artist text not null,

  date_requested date not null,
  due_date date null,
  archived_date date null,

  score_link text null,
  cost numeric null,

  only_deliverable_if_reimbursed boolean not null default false,

  delivered boolean not null default false,
  reimbursed boolean not null default false,

  notes text null,

  created_at timestamptz not null,
  updated_at timestamptz not null
);

alter table public.requests enable row level security;

drop policy if exists "requests_select_own" on public.requests;
create policy "requests_select_own"
on public.requests
for select
using (auth.uid() = user_id);

drop policy if exists "requests_insert_own" on public.requests;
create policy "requests_insert_own"
on public.requests
for insert
with check (auth.uid() = user_id);

drop policy if exists "requests_update_own" on public.requests;
create policy "requests_update_own"
on public.requests
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "requests_delete_own" on public.requests;
create policy "requests_delete_own"
on public.requests
for delete
using (auth.uid() = user_id);

create index if not exists requests_user_id_idx on public.requests (user_id);
create index if not exists requests_date_requested_idx on public.requests (user_id, date_requested desc);
create index if not exists requests_status_idx on public.requests (user_id, delivered, reimbursed);
```

## 3) Auth redirect URLs

In Supabase Auth settings, allow:

- `http://localhost:5173`
- `https://lwassmer42.github.io/CodexMusicRequestMobileSite_App/`

(and any custom domain you add later).

