-- ============================================================
-- Grand Line Assistant — Grundgerüst
-- Im Supabase-Dashboard unter SQL Editor ausführen (oder per
-- `supabase db push`, wenn die CLI eingerichtet ist).
--
-- Grundprinzip: eine Kampagne bündelt alles. Jeder Datensatz
-- gehört einem Benutzer (owner). RLS stellt sicher, dass niemand
-- fremde Daten sieht.
-- ============================================================

-- ── Kampagnen ────────────────────────────────────────────────
create table if not exists campaigns (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users (id) on delete cascade,
  name        text not null default 'Neue Kampagne',
  created_at  timestamptz not null default now()
);
create index if not exists campaigns_owner_idx on campaigns (owner);

-- ── Charaktere ───────────────────────────────────────────────
-- Kernfelder als Spalten, der Rest (Waffen, Skills, Frucht, Inventar) als jsonb.
--
-- Hinweis zu `schaden`: Das ist KEIN Zahlenwert, sondern der Schadens-
-- ausdruck des Charakters ("W6 + W6", "2W6+3"). Deshalb text, nicht int.
create table if not exists characters (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid not null references auth.users (id) on delete cascade,
  campaign_id   uuid references campaigns (id) on delete cascade,
  name          text not null default '',
  epitheton     text default '',
  stufe         int  not null default 0,
  leben         int  not null default 14,
  schaden       text not null default 'W6 + W6',
  berries       bigint not null default 0,
  kopfgeld      bigint not null default 0,
  aussehen      text default '',
  ziel          text default '',
  spezial       text default '',
  eigenschaften text default '',
  attribute     jsonb not null default '{}'::jsonb,
  hab_und_gut   jsonb not null default '[]'::jsonb,
  waffen        jsonb not null default '[]'::jsonb,
  skills        jsonb not null default '[]'::jsonb,
  teufelsfrucht jsonb not null default '{"name":"","typ":"","raenge":[]}'::jsonb,
  portrait_path text,                       -- Pfad im Storage, nicht das Bild selbst
  sortierung    int not null default 0,     -- Reihenfolge der Chips im Bogen
  updated_at    timestamptz not null default now()
);
create index if not exists characters_owner_idx on characters (owner);
create index if not exists characters_campaign_idx on characters (campaign_id);

-- ── Crew / Schiff (genau eine pro Kampagne) ──────────────────
create table if not exists crews (
  id                  uuid primary key default gen_random_uuid(),
  owner               uuid not null references auth.users (id) on delete cascade,
  campaign_id         uuid not null references campaigns (id) on delete cascade,
  name                text default '',
  jolly_roger_path    text,
  schiff_name         text default '',
  schiff_beschreibung text default '',
  flotte              text default '',
  updated_at          timestamptz not null default now(),
  constraint crews_campaign_unique unique (campaign_id)
);

-- ── Editor-Zustände als jsonb (Karte, Zeichnung, Schauplatz) ─
create table if not exists maps (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users (id) on delete cascade,
  campaign_id uuid not null references campaigns (id) on delete cascade,
  kind        text not null check (kind in ('tracker', 'drawing', 'detail')),
  data        jsonb not null default '{}'::jsonb,
  bg_path     text,                -- großes Hintergrundbild im Storage, nicht in der Zeile
  updated_at  timestamptz not null default now(),
  constraint maps_campaign_kind_unique unique (campaign_id, kind)
);

-- ── Logbuch ──────────────────────────────────────────────────
create table if not exists logbooks (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users (id) on delete cascade,
  campaign_id uuid not null references campaigns (id) on delete cascade,
  notizen     text default '',
  quests      jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now(),
  constraint logbooks_campaign_unique unique (campaign_id)
);

-- ============================================================
-- updated_at automatisch pflegen
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
-- Ohne RLS gewährt der öffentliche Key vollen Tabellenzugriff.
-- Mit RLS aber ohne Policy liefert jede Abfrage leer zurück.
-- ============================================================
alter table campaigns  enable row level security;
alter table characters enable row level security;
alter table crews      enable row level security;
alter table maps       enable row level security;
alter table logbooks   enable row level security;

-- Kampagnen
drop policy if exists "Eigene Kampagnen lesen"   on campaigns;
drop policy if exists "Eigene Kampagnen anlegen" on campaigns;
drop policy if exists "Eigene Kampagnen ändern"  on campaigns;
drop policy if exists "Eigene Kampagnen löschen" on campaigns;
create policy "Eigene Kampagnen lesen"   on campaigns for select using (auth.uid() = owner);
create policy "Eigene Kampagnen anlegen" on campaigns for insert with check (auth.uid() = owner);
create policy "Eigene Kampagnen ändern"  on campaigns for update using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "Eigene Kampagnen löschen" on campaigns for delete using (auth.uid() = owner);

-- Charaktere
drop policy if exists "Eigene Charaktere lesen"   on characters;
drop policy if exists "Eigene Charaktere anlegen" on characters;
drop policy if exists "Eigene Charaktere ändern"  on characters;
drop policy if exists "Eigene Charaktere löschen" on characters;
create policy "Eigene Charaktere lesen"   on characters for select using (auth.uid() = owner);
create policy "Eigene Charaktere anlegen" on characters for insert with check (auth.uid() = owner);
create policy "Eigene Charaktere ändern"  on characters for update using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "Eigene Charaktere löschen" on characters for delete using (auth.uid() = owner);

-- Crew
drop policy if exists "Eigene Crew lesen"   on crews;
drop policy if exists "Eigene Crew anlegen" on crews;
drop policy if exists "Eigene Crew ändern"  on crews;
drop policy if exists "Eigene Crew löschen" on crews;
create policy "Eigene Crew lesen"   on crews for select using (auth.uid() = owner);
create policy "Eigene Crew anlegen" on crews for insert with check (auth.uid() = owner);
create policy "Eigene Crew ändern"  on crews for update using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "Eigene Crew löschen" on crews for delete using (auth.uid() = owner);

-- Karten / Zeichnungen / Schauplätze
drop policy if exists "Eigene Karten lesen"   on maps;
drop policy if exists "Eigene Karten anlegen" on maps;
drop policy if exists "Eigene Karten ändern"  on maps;
drop policy if exists "Eigene Karten löschen" on maps;
create policy "Eigene Karten lesen"   on maps for select using (auth.uid() = owner);
create policy "Eigene Karten anlegen" on maps for insert with check (auth.uid() = owner);
create policy "Eigene Karten ändern"  on maps for update using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "Eigene Karten löschen" on maps for delete using (auth.uid() = owner);

-- Logbuch
drop policy if exists "Eigenes Logbuch lesen"   on logbooks;
drop policy if exists "Eigenes Logbuch anlegen" on logbooks;
drop policy if exists "Eigenes Logbuch ändern"  on logbooks;
drop policy if exists "Eigenes Logbuch löschen" on logbooks;
create policy "Eigenes Logbuch lesen"   on logbooks for select using (auth.uid() = owner);
create policy "Eigenes Logbuch anlegen" on logbooks for insert with check (auth.uid() = owner);
create policy "Eigenes Logbuch ändern"  on logbooks for update using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "Eigenes Logbuch löschen" on logbooks for delete using (auth.uid() = owner);

-- ============================================================
-- Storage: Bucket "bilder" für Porträts, Jolly Roger, Kartenbilder.
-- Der erste Pfadabschnitt ist die User-ID — daran hängen die Policies.
-- Lesen ist öffentlich (die Pfade sind zufällige uuids), Schreiben
-- darf nur, wem der Ordner gehört.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('bilder', 'bilder', true)
on conflict (id) do nothing;

drop policy if exists "Bilder öffentlich lesen"    on storage.objects;
drop policy if exists "Eigene Bilder hochladen"    on storage.objects;
drop policy if exists "Eigene Bilder überschreiben" on storage.objects;
drop policy if exists "Eigene Bilder löschen"      on storage.objects;

create policy "Bilder öffentlich lesen"
  on storage.objects for select
  using (bucket_id = 'bilder');

create policy "Eigene Bilder hochladen"
  on storage.objects for insert
  with check (bucket_id = 'bilder' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Eigene Bilder überschreiben"
  on storage.objects for update
  using (bucket_id = 'bilder' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Eigene Bilder löschen"
  on storage.objects for delete
  using (bucket_id = 'bilder' and (storage.foldername(name))[1] = auth.uid()::text);
