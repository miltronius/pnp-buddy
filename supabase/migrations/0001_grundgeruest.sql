-- ============================================================
-- Grand Line Assistant — Base Schema
-- Run in the Supabase Dashboard under SQL Editor, or via
-- `supabase db push` if the CLI is configured.
--
-- Core principle: a campaign bundles everything. Every row
-- belongs to one user (owner). RLS ensures no one can access
-- another user's data.
-- ============================================================

-- ── Campaigns ────────────────────────────────────────────────
create table if not exists campaigns (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users (id) on delete cascade,
  name        text not null default 'New Campaign',
  created_at  timestamptz not null default now()
);
create index if not exists campaigns_owner_idx on campaigns (owner);

-- ── Characters ───────────────────────────────────────────────
-- Core fields as columns; the rest (weapons, skills, devil fruit,
-- inventory) stored as jsonb.
--
-- Note on `damage`: this is NOT a number but a damage expression
-- ("W6 + W6", "2W6+3"). Hence text, not int.
create table if not exists characters (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid not null references auth.users (id) on delete cascade,
  campaign_id   uuid references campaigns (id) on delete cascade,
  name          text not null default '',
  epithet       text default '',
  level         int  not null default 0,
  hp            int  not null default 14,
  damage        text not null default 'W6 + W6',
  berries       bigint not null default 0,
  bounty        bigint not null default 0,
  appearance    text default '',
  goal          text default '',
  special       text default '',
  traits        text default '',
  attributes    jsonb not null default '{}'::jsonb,
  inventory     jsonb not null default '[]'::jsonb,
  weapons       jsonb not null default '[]'::jsonb,
  skills        jsonb not null default '[]'::jsonb,
  devil_fruit   jsonb not null default '{"name":"","typ":"","raenge":[]}'::jsonb,
  portrait_path text,                       -- storage path, not the image itself
  sort_order    int not null default 0,     -- order of chips on the character sheet
  updated_at    timestamptz not null default now()
);
create index if not exists characters_owner_idx on characters (owner);
create index if not exists characters_campaign_idx on characters (campaign_id);

-- ── Crew / Ship (exactly one per campaign) ───────────────────
create table if not exists crews (
  id                uuid primary key default gen_random_uuid(),
  owner             uuid not null references auth.users (id) on delete cascade,
  campaign_id       uuid not null references campaigns (id) on delete cascade,
  name              text default '',
  jolly_roger_path  text,
  ship_name         text default '',
  ship_description  text default '',
  fleet             text default '',
  updated_at        timestamptz not null default now(),
  constraint crews_campaign_unique unique (campaign_id)
);

-- ── Editor states as jsonb (map, drawing, scene) ─────────────
create table if not exists maps (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users (id) on delete cascade,
  campaign_id uuid not null references campaigns (id) on delete cascade,
  kind        text not null check (kind in ('tracker', 'drawing', 'detail')),
  data        jsonb not null default '{}'::jsonb,
  bg_path     text,                -- large background image in storage, not inline
  updated_at  timestamptz not null default now(),
  constraint maps_campaign_kind_unique unique (campaign_id, kind)
);

-- ── Logbook ──────────────────────────────────────────────────
create table if not exists logbooks (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users (id) on delete cascade,
  campaign_id uuid not null references campaigns (id) on delete cascade,
  notes       text default '',
  quests      jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now(),
  constraint logbooks_campaign_unique unique (campaign_id)
);

-- ============================================================
-- Auto-update updated_at
-- ============================================================
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists t_characters on characters;
create trigger t_characters before update on characters
  for each row execute function touch_updated_at();

drop trigger if exists t_crews on crews;
create trigger t_crews before update on crews
  for each row execute function touch_updated_at();

drop trigger if exists t_maps on maps;
create trigger t_maps before update on maps
  for each row execute function touch_updated_at();

drop trigger if exists t_logbooks on logbooks;
create trigger t_logbooks before update on logbooks
  for each row execute function touch_updated_at();

-- ============================================================
-- Row Level Security
-- Without RLS the public key grants full table access.
-- With RLS but no policy every query returns empty.
-- ============================================================
alter table campaigns  enable row level security;
alter table characters enable row level security;
alter table crews      enable row level security;
alter table maps       enable row level security;
alter table logbooks   enable row level security;

-- Campaigns
drop policy if exists "Read own campaigns"   on campaigns;
drop policy if exists "Create own campaigns" on campaigns;
drop policy if exists "Update own campaigns" on campaigns;
drop policy if exists "Delete own campaigns" on campaigns;
create policy "Read own campaigns"   on campaigns for select using (auth.uid() = owner);
create policy "Create own campaigns" on campaigns for insert with check (auth.uid() = owner);
create policy "Update own campaigns" on campaigns for update using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "Delete own campaigns" on campaigns for delete using (auth.uid() = owner);

-- Characters
drop policy if exists "Read own characters"   on characters;
drop policy if exists "Create own characters" on characters;
drop policy if exists "Update own characters" on characters;
drop policy if exists "Delete own characters" on characters;
create policy "Read own characters"   on characters for select using (auth.uid() = owner);
create policy "Create own characters" on characters for insert with check (auth.uid() = owner);
create policy "Update own characters" on characters for update using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "Delete own characters" on characters for delete using (auth.uid() = owner);

-- Crew
drop policy if exists "Read own crew"   on crews;
drop policy if exists "Create own crew" on crews;
drop policy if exists "Update own crew" on crews;
drop policy if exists "Delete own crew" on crews;
create policy "Read own crew"   on crews for select using (auth.uid() = owner);
create policy "Create own crew" on crews for insert with check (auth.uid() = owner);
create policy "Update own crew" on crews for update using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "Delete own crew" on crews for delete using (auth.uid() = owner);

-- Maps / Drawings / Scenes
drop policy if exists "Read own maps"   on maps;
drop policy if exists "Create own maps" on maps;
drop policy if exists "Update own maps" on maps;
drop policy if exists "Delete own maps" on maps;
create policy "Read own maps"   on maps for select using (auth.uid() = owner);
create policy "Create own maps" on maps for insert with check (auth.uid() = owner);
create policy "Update own maps" on maps for update using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "Delete own maps" on maps for delete using (auth.uid() = owner);

-- Logbook
drop policy if exists "Read own logbook"   on logbooks;
drop policy if exists "Create own logbook" on logbooks;
drop policy if exists "Update own logbook" on logbooks;
drop policy if exists "Delete own logbook" on logbooks;
create policy "Read own logbook"   on logbooks for select using (auth.uid() = owner);
create policy "Create own logbook" on logbooks for insert with check (auth.uid() = owner);
create policy "Update own logbook" on logbooks for update using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "Delete own logbook" on logbooks for delete using (auth.uid() = owner);

-- ============================================================
-- Storage: bucket "images" for portraits, jolly rogers, map backgrounds.
-- The first path segment is the user ID — policies are scoped to it.
-- Read is public (paths are random UUIDs); write is owner-only.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

drop policy if exists "Public image read"    on storage.objects;
drop policy if exists "Upload own images"    on storage.objects;
drop policy if exists "Update own images"    on storage.objects;
drop policy if exists "Delete own images"    on storage.objects;

create policy "Public image read"
  on storage.objects for select
  using (bucket_id = 'images');

create policy "Upload own images"
  on storage.objects for insert
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Update own images"
  on storage.objects for update
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Delete own images"
  on storage.objects for delete
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
