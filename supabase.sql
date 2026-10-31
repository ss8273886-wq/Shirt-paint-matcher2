-- Shared public Shirt & Pant Matcher.
-- WARNING: Anyone with the website URL can read, add, edit, and delete the shared list.
-- Run this in Supabase SQL Editor.

create table if not exists public.shared_matcher_data (
  id integer primary key check (id = 1),
  pants text[] not null default array[]::text[],
  shirts text[] not null default array[]::text[],
  updated_at timestamptz not null default now()
);

alter table public.shared_matcher_data enable row level security;

-- Remove any previous policies before creating the intended public policies.
drop policy if exists "public read shared matcher" on public.shared_matcher_data;
drop policy if exists "public insert shared matcher" on public.shared_matcher_data;
drop policy if exists "public update shared matcher" on public.shared_matcher_data;
drop policy if exists "public delete shared matcher" on public.shared_matcher_data;

create policy "public read shared matcher"
  on public.shared_matcher_data for select
  to anon, authenticated
  using (true);

create policy "public insert shared matcher"
  on public.shared_matcher_data for insert
  to anon, authenticated
  with check (id = 1);

create policy "public update shared matcher"
  on public.shared_matcher_data for update
  to anon, authenticated
  using (id = 1)
  with check (id = 1);

create policy "public delete shared matcher"
  on public.shared_matcher_data for delete
  to anon, authenticated
  using (id = 1);

-- Ensure the one shared row exists.
insert into public.shared_matcher_data (id, pants, shirts)
values (1, array[]::text[], array[]::text[])
on conflict (id) do nothing;

-- Enable Supabase Realtime for cross-device live updates.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'shared_matcher_data'
  ) then
    alter publication supabase_realtime add table public.shared_matcher_data;
  end if;
end
$$;
