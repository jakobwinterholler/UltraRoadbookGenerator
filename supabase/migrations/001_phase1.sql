-- Phase 1: auth profiles, races, storage bucket, RLS policies
-- Run once against project lxorwwrtxwffiwzdmtez via scripts/apply_supabase_migration.py

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users who signed in before this migration
insert into public.profiles (id, email, display_name, avatar_url)
select
  id,
  email,
  coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name'),
  coalesce(raw_user_meta_data->>'avatar_url', raw_user_meta_data->>'picture')
from auth.users
on conflict (id) do update set
  email = excluded.email,
  display_name = excluded.display_name,
  avatar_url = excluded.avatar_url,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Races
-- ---------------------------------------------------------------------------
create table if not exists public.races (
  id                   uuid primary key,
  user_id              uuid not null references public.profiles(id) on delete cascade,
  name                 text not null,
  distance_km          double precision,
  elevation_gain_m     double precision,
  preparation          jsonb not null default '{}'::jsonb,
  companion_revision   integer not null default 0,
  has_bundle           boolean not null default false,
  analyzed_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz
);

create index if not exists races_user_id_idx on public.races (user_id);
create index if not exists races_user_updated_idx on public.races (user_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.races enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles for select using (auth.uid() = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update using (auth.uid() = id);

drop policy if exists "Users read own races" on public.races;
create policy "Users read own races"
  on public.races for select
  using (auth.uid() = user_id and deleted_at is null);

-- ---------------------------------------------------------------------------
-- Storage bucket (private race assets)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'race-assets',
  'race-assets',
  false,
  52428800,
  array['application/json', 'application/gpx+xml', 'text/xml', 'application/octet-stream']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users read own race assets" on storage.objects;
create policy "Users read own race assets"
  on storage.objects for select
  using (
    bucket_id = 'race-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ---------------------------------------------------------------------------
-- Refresh PostgREST schema cache
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
