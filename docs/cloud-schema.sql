-- Run in your Supabase project using SQL Editor.
create table if not exists public.user_studio_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_studio_data enable row level security;
revoke all on public.user_studio_data from anon;
grant select, insert, update, delete on public.user_studio_data to authenticated;
drop policy if exists "own_studio_data_select" on public.user_studio_data;
drop policy if exists "own_studio_data_insert" on public.user_studio_data;
drop policy if exists "own_studio_data_update" on public.user_studio_data;
drop policy if exists "own_studio_data_delete" on public.user_studio_data;
create policy "own_studio_data_select" on public.user_studio_data for select to authenticated using (auth.uid() = user_id);
create policy "own_studio_data_insert" on public.user_studio_data for insert to authenticated with check (auth.uid() = user_id);
create policy "own_studio_data_update" on public.user_studio_data for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_studio_data_delete" on public.user_studio_data for delete to authenticated using (auth.uid() = user_id);
