-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query)
-- Replaces the old Firestore "users_profiles" / "users_projects" collections.

-- ---------------------------------------------------------------------------
-- profiles: one row per signed-in user, keyed by their Supabase auth UID
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  email text,
  avatar_url text,
  provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- projects: one saved workspace per user (config, lyrics, audio ref, peaks)
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  user_id uuid primary key references auth.users (id) on delete cascade,
  config jsonb,
  lyrics jsonb,
  audio_url text,
  waveform_peaks jsonb,
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "Users can view their own project"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "Users can insert their own project"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own project"
  on public.projects for update
  using (auth.uid() = user_id);

-- Reminder: also enable "Google" and "Spotify" under
-- Authentication -> Providers in the Supabase Dashboard, and add your
-- deployed app URL (and http://localhost:3000 for local dev) under
-- Authentication -> URL Configuration (Site URL + Redirect URLs) so
-- OAuth redirects work.
