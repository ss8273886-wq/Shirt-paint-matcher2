-- Run this entire file in Supabase Dashboard > SQL Editor.
create table if not exists public.matcher_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pants text[] not null default array[]::text[],
  shirts text[] not null default array[]::text[],
  updated_at timestamptz not null default now()
);

alter table public.matcher_data enable row level security;

-- A signed-in user can only read and modify their own record.
drop policy if exists "read own matcher data" on public.matcher_data;
create policy "read own matcher data"
  on public.matcher_data for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "insert own matcher data" on public.matcher_data;
create policy "insert own matcher data"
  on public.matcher_data for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "update own matcher data" on public.matcher_data;
create policy "update own matcher data"
  on public.matcher_data for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- No public/anonymous policies are created.
