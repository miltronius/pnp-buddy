# CLAUDE.md — Grand Line Assistant

Dieses Dokument leitet die Migration des Prototyps `grandline-assistant.jsx`
(ein einzelnes React-Artifact) zu einer selbst gehosteten Web-App mit
Benutzerkonten und Datenbank an. Es ist so geschrieben, dass eine Claude-Instanz
(oder ein Mensch) es Schritt für Schritt abarbeiten kann.

**Sprache:** Die gesamte Benutzeroberfläche ist auf Deutsch. Kommentare im Code
sind auf Deutsch. Bitte dabei bleiben.

---

## 1. Was existiert bereits

`grandline-assistant.jsx` ist ein voll funktionsfähiger Prototyp: ein One-Piece-
Pen-&-Paper-Begleiter mit Piraten-Ästhetik (Schriften *Pirata One* + *IM Fell
English*, Pergament `#e7d3a8`, dunkle See `#14222e`, Rot `#8b2e1f`, Gold
`#b8862b`). Er ist ein einziges React-Bauteil, das seinen Zustand über eine
`window.storage`-API (Schlüssel-Wert) hält.

**Acht Tabs / Funktionsbereiche:**

| Tab (intern)  | Titel          | Inhalt |
|---------------|----------------|--------|
| `bogen`       | Charakterbogen | Editierbarer Bogen: Name, Stufe (Strichliste), Leben/Schaden/Berries, Aussehen/Ziel/Spezial/Eigenschaften, Inventar, Waffen, Skills, Teufelsfrucht, 9 Attribut-Kreise mit Proben |
| `wuerfel`     | Würfeltisch    | Vollbild-Würfeltisch mit echter Starrkörper-Physik (W4/6/8/10/12/20/100). Ergebnisse werden aus der obenliegenden Fläche gelesen. |
| `kampf`       | Kampf          | Initiative-Tracker: Kämpfer aus Crew + freie Gegner, 2W6+Mod-Initiative, Runden, Trefferpunkte, Waffenangriffe direkt aus dem Tracker |
| `karte`       | Karte          | Figuren-Tracker: Hintergrundbild oder See-Raster, frei verschiebbare Token (Crew/Gegner/Inseln/Schiffe/Ziele) |
| `zeichnen`    | Kartografie    | Insel-Zeichentool von oben: Terrain-Pinsel (Wiese/Wald/Strand/Wasser/Fels/Weg) + Gebäude-Marker |
| `detail`      | Schauplatz     | Detail-Editor (Dungeon/Palast/Casino): Vektor-Formen (Rechteck/Kreis), Wände & Türen, Text-Labels, Kampfraster |
| `notizen`     | Logbuch        | Freie Notizen + Questlog (offen/erledigt) |
| `crew`        | Steckbriefe    | WANTED-Poster pro Charakter (Kopfgeld, Porträt) + Crew-/Schiffsbogen (Jolly Roger, Schiffsname) |

**Spielsystem (unbedingt beibehalten):**
- 9 Attribute (deutsch): Nahkampf, Fernkampf, Blocken, Geschicklichkeit,
  Intelligenz, Konstitution, Charisma, Navigation, Heilkunde.
- Ausgleichs-Wert pro Attributstufe (Nachschlagetabelle):
  ≤1 → −4, ≤3 → −3, ≤5 → −2, ≤7 → −1, ≤12 → 0, ≤15 → +1, ≤17 → +2, ≤19 → +3, sonst +4.
- Probe = 2W6 + Ausgleich. Drei Stufen: ≥10 GESCHAFFT, 7–9 TEILWEISE, ≤6 FEHLSCHLAG.
- Schadensausdrücke: `2W6+3`, `W8`, `W6 + W6`, `3d10-2` (Parser `parseDamage`).
- Teufelsfrucht: genau eine pro Charakter, Rang-Track, Freischalten kostet
  Charakterstufen (Bilanzfunktion `fruchtBilanz`).

**Persistenz-Schlüssel im Prototyp** (das ist der Migrationsvertrag):

| Schlüssel      | Inhalt |
|----------------|--------|
| `gla:chars`    | Array aller Charaktere (siehe Datenmodell unten) |
| `gla:crew`     | `{ name, jollyRoger, schiffName, schiffBeschreibung, flotte }` |
| `gla:map`      | `{ bg, gridOn, tokens: [...] }` |
| `gla:drawing`  | `{ grid: {cols, rows, cells[]}, buildings: [...] }` |
| `gla:detail`   | `{ objects: [...], bg }` |
| `gla:notes`    | `{ notizen: string, quests: [...] }` |

**Charakter-Datenmodell (`newChar()`):**
```
{
  id, name, stufe, leben, schaden,
  aussehen, ziel, spezial, eigenschaften,
  habUndGut: [{ id, text, anzahl }],
  waffen:   [{ id, name, att, schaden }],
  skills:   [{ id, name, att, beschreibung }],
  teufelsfrucht: { name, typ, raenge: [{ id, name, beschreibung, kostenLevel,
                   wurfTyp, wurfAtt, wurfSchaden, kostenText, unlocked }] },
  kopfgeld, portrait, epitheton,
  berries,
  attribute: { Nahkampf, Fernkampf, ... }  // 9 Schlüssel
}
```

---

## 2. Zielbild

Wie beim Projekt „Töggelo": **selbst gehostet auf Vercel, Daten in Supabase,
Benutzer-Authentifizierung über Supabase Auth.** Mehrere Geräte, mehrere
Benutzer, alles in der Datenbank statt im Browser-Storage.

**Rollen:**
- **Spielleiter (GM):** legt eine Kampagne an, verwaltet Karten, Kampf, Logbuch,
  Gegner, sieht die Charakterbögen aller Spieler.
- **Spieler:** bearbeiten den eigenen Charakterbogen, würfeln, sehen die
  gemeinsame Karte.

Für den ersten Meilenstein reicht: **eingeloggte Benutzer, deren Daten privat
gespeichert und geräteübergreifend synchron sind.** Die Mehrspieler-Freigabe
(GM sieht Spielerbögen, geteilte Karte) ist ein zweiter Meilenstein und weiter
unten als Erweiterung beschrieben.

---

## 3. Technik-Stack (Stand 2026, vor dem Bau verifizieren)

- **pnpm** als Paketmanager.
- **Vite** (neueste Version; unterstützt React 19 direkt, kein manuelles Upgrade
  mehr nötig).
- **React 19**.
- **Tailwind CSS v4** über das offizielle Vite-Plugin `@tailwindcss/vite`
  (kein PostCSS-Setup mehr, kein `tailwind.config.js` zwingend — Konfiguration
  läuft über CSS `@theme`).
- **Supabase** (`@supabase/supabase-js` v2) für Datenbank, Auth und Storage.
- **Vercel** fürs Hosting.

> **Wichtig:** Versionsnummern und Setup-Kommandos vor dem Ausführen kurz gegen
> die offizielle Doku prüfen (`vite.dev`, `tailwindcss.com`, `supabase.com/docs`).
> Dieses Dokument nennt bewusst wenige exakte Versionsnummern, weil sie schnell
> veralten. Bei Widersprüchen gilt die offizielle Doku, nicht dieses Dokument.

---

## 4. Projekt aufsetzen

```bash
# 1. Vite-Projekt (React) anlegen
pnpm create vite@latest grandline-assistant --template react
cd grandline-assistant

# 2. Abhängigkeiten
pnpm install
pnpm add @supabase/supabase-js
pnpm add -D @tailwindcss/vite
```

**`vite.config.js`** — Tailwind-Plugin einhängen:
```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

**`src/index.css`** — Tailwind v4 wird per Single-Import geladen; das Piraten-
Thema kommt in einen `@theme`-Block:
```css
@import "tailwindcss";

@theme {
  --color-parchment: #e7d3a8;
  --color-sea: #14222e;
  --color-blood: #8b2e1f;
  --color-gold: #b8862b;
  --color-ink: #2b2014;
  --font-pirate: "Pirata One", Georgia, serif;
  --font-fell: "IM Fell English", Georgia, serif;
}

/* Google-Schriften einbinden (oder self-hosten, siehe Abschnitt 9) */
@import url("https://fonts.googleapis.com/css2?family=Pirata+One&family=IM+Fell+English:ital@0;1&display=swap");
```

> Der Prototyp benutzt reines CSS mit CSS-Variablen. Beim Portieren kann dieses
> CSS zunächst **1:1 übernommen** werden (in `index.css` einfügen), damit das
> Aussehen sofort stimmt. Tailwind ist optional und muss nicht jede bestehende
> Regel ersetzen — es ist für neue Komponenten (Auth, Kampagnen-Auswahl) da.
> Priorität hat, dass die Piraten-Optik erhalten bleibt.

**`.env.local`** (nicht committen — steht in `.gitignore`):
```
VITE_SUPABASE_URL=https://<dein-projekt>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<dein-publishable-key>
```
> Supabase nennt den öffentlichen Client-Schlüssel inzwischen „Publishable Key"
> (früher „anon key"). Beide funktionieren; der neue Name ist im Dashboard unter
> *Project Settings → API Keys* zu finden. Der Key ist öffentlich — die
> Sicherheit kommt aus Row Level Security (RLS), nicht aus Geheimhaltung.

---

## 5. Supabase-Client

**`src/lib/supabase.js`** — Singleton, überall importierbar:
```js
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(url, key);
```

---

## 6. Datenbank-Schema

Grundprinzip: **Eine Kampagne bündelt alles.** Jeder Datensatz gehört einem
Benutzer (`owner`) und optional einer Kampagne. RLS stellt sicher, dass niemand
fremde Daten sieht.

Der einfachste Migrationsweg wäre, die sechs `gla:*`-Blobs als sechs
`jsonb`-Spalten zu speichern. Das funktioniert, verschenkt aber die Datenbank.
Empfohlen ist ein **hybrider Ansatz**: strukturierte Tabellen für die Dinge, die
von mehreren Ansichten geteilt werden (Charaktere, Kampagne), und `jsonb` für
die in sich geschlossenen Editor-Zustände (Karten, Zeichnungen), deren innere
Struktur die DB nicht kennen muss.

```sql
-- ── Kampagnen ────────────────────────────────────────────────
create table campaigns (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users (id) on delete cascade,
  name        text not null default 'Neue Kampagne',
  created_at  timestamptz not null default now()
);

-- ── Charaktere ───────────────────────────────────────────────
-- Kernfelder als Spalten, der Rest (Waffen, Skills, Frucht, Inventar) als jsonb.
create table characters (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid not null references auth.users (id) on delete cascade,
  campaign_id   uuid references campaigns (id) on delete set null,
  name          text not null default '',
  epitheton     text default '',
  stufe         int  not null default 0,
  leben         int  not null default 10,
  schaden       int  not null default 0,
  berries       bigint not null default 0,
  kopfgeld      bigint not null default 0,
  aussehen      text default '',
  ziel          text default '',
  spezial       text default '',
  eigenschaften text default '',
  attribute     jsonb not null default '{}',  -- { Nahkampf: 8, ... }
  hab_und_gut   jsonb not null default '[]',
  waffen        jsonb not null default '[]',
  skills        jsonb not null default '[]',
  teufelsfrucht jsonb not null default '{"name":"","typ":"","raenge":[]}',
  portrait_path text,                          -- Pfad im Storage, nicht das Bild selbst
  updated_at    timestamptz not null default now()
);

-- ── Crew / Schiff (eine pro Kampagne) ────────────────────────
create table crews (
  id                  uuid primary key default gen_random_uuid(),
  owner               uuid not null references auth.users (id) on delete cascade,
  campaign_id         uuid references campaigns (id) on delete cascade,
  name                text default '',
  jolly_roger_path    text,
  schiff_name         text default '',
  schiff_beschreibung text default '',
  flotte              text default '',
  updated_at          timestamptz not null default now()
);

-- ── Editor-Zustände als jsonb (Karte, Zeichnung, Schauplatz) ─
create table maps (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users (id) on delete cascade,
  campaign_id uuid references campaigns (id) on delete cascade,
  kind        text not null,       -- 'tracker' | 'drawing' | 'detail'
  data        jsonb not null default '{}',
  bg_path     text,                -- großes Hintergrundbild in Storage, nicht in der Zeile
  updated_at  timestamptz not null default now()
);

-- ── Logbuch ──────────────────────────────────────────────────
create table logbooks (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users (id) on delete cascade,
  campaign_id uuid references campaigns (id) on delete cascade,
  notizen     text default '',
  quests      jsonb not null default '[]',
  updated_at  timestamptz not null default now()
);
```

> **Bilder gehören in Supabase Storage, nicht in die DB-Zeile.** Der Prototyp
> speichert Porträts, Jolly Roger und Kartenbilder als base64-Data-URLs. Das
> sprengt Zeilen und Transfer. In der App: Bild in einen Storage-Bucket laden,
> nur den **Pfad** in `*_path` ablegen. Beim Anzeigen eine signierte oder
> öffentliche URL erzeugen. Der Verkleinerungs-Code aus dem Prototyp
> (`loadImageScaled`, max. Kante 1600 px bzw. 600 px, JPEG-Qualität senken)
> bleibt clientseitig sinnvoll, bevor hochgeladen wird.

### Row Level Security

**Für jede Tabelle** RLS aktivieren und eine Eigentümer-Policy setzen. Muster
(für `characters`, analog für alle anderen):
```sql
alter table characters enable row level security;

create policy "Eigene Charaktere lesen"
  on characters for select
  using (auth.uid() = owner);

create policy "Eigene Charaktere anlegen"
  on characters for insert
  with check (auth.uid() = owner);

create policy "Eigene Charaktere ändern"
  on characters for update
  using (auth.uid() = owner);

create policy "Eigene Charaktere löschen"
  on characters for delete
  using (auth.uid() = owner);
```
> Ohne RLS gewährt der öffentliche Key vollen Tabellenzugriff. Mit aktivem RLS
> aber ohne Policy liefert jede Abfrage leer zurück — Policies also nicht
> vergessen. Storage-Buckets brauchen **eigene** Policies (im Storage-Bereich
> des Dashboards); dieselbe `auth.uid()`-Logik über den Objektpfad anwenden,
> z. B. Pfad-Präfix = User-ID.

### `updated_at` automatisch pflegen (optional, empfohlen)
```sql
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger t_characters before update on characters
  for each row execute function touch_updated_at();
-- analog für crews, maps, logbooks
```

---

## 7. Authentifizierung

Supabase Auth mit **E-Mail + Passwort** als Einstieg (Magic Link oder OAuth
später ergänzbar).

**`src/hooks/useAuth.js`** — Session bereitstellen:
```js
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, loading };
}
```

**Auth-Aktionen** (in einer Anmelde-Komponente `AnmeldeMaske.jsx`):
```js
// Registrieren
await supabase.auth.signUp({ email, password });
// Anmelden
await supabase.auth.signInWithPassword({ email, password });
// Abmelden
await supabase.auth.signOut();
```

**App-Struktur:** Ist keine Session vorhanden, die Anmelde-Maske zeigen. Sonst
die eigentliche App. Beispiel `App.jsx`:
```jsx
function App() {
  const { session, loading } = useAuth();
  if (loading) return <Ladebildschirm />;
  if (!session) return <AnmeldeMaske />;
  return <GrandLineAssistant userId={session.user.id} />;
}
```

---

## 8. Den Prototyp portieren

Das Herzstück (`grandline-assistant.jsx`) bleibt weitgehend erhalten — es ist
reines React. Zu ersetzen ist nur die **Persistenzschicht**. Der Prototyp
kapselt sie bereits hinter wenigen Funktionen; genau diese werden umgeleitet.

### 8.1 `window.storage` → Supabase

Im Prototyp gibt es Lade- und Speicherstellen mit `window.storage.get/set` und
den `gla:*`-Schlüsseln. Diese durch eine Datenzugriffsschicht ersetzen.

**`src/lib/db.js`** — pro Bereich eine Lade-/Speicherfunktion. Skizze für
Charaktere:
```js
import { supabase } from "./supabase";

export async function ladeCharaktere(userId) {
  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("owner", userId)
    .order("updated_at", { ascending: true });
  if (error) throw error;
  return data.map(zuPrototypCharakter);   // DB-Zeile → Prototyp-Objekt
}

export async function speichereCharakter(userId, c) {
  const row = zuDbZeile(userId, c);        // Prototyp-Objekt → DB-Zeile
  const { error } = await supabase.from("characters").upsert(row);
  if (error) throw error;
}

// Mapper: die jsonb-Felder heißen im Prototyp anders (habUndGut ↔ hab_und_gut)
function zuPrototypCharakter(r) {
  return {
    id: r.id, name: r.name, epitheton: r.epitheton, stufe: r.stufe,
    leben: r.leben, schaden: r.schaden, berries: Number(r.berries),
    kopfgeld: Number(r.kopfgeld), aussehen: r.aussehen, ziel: r.ziel,
    spezial: r.spezial, eigenschaften: r.eigenschaften,
    attribute: r.attribute, habUndGut: r.hab_und_gut, waffen: r.waffen,
    skills: r.skills, teufelsfrucht: r.teufelsfrucht,
    portrait: r.portrait_path,   // später zu signierter URL auflösen
  };
}
function zuDbZeile(userId, c) {
  return {
    id: c.id, owner: userId, name: c.name, epitheton: c.epitheton,
    stufe: c.stufe, leben: c.leben, schaden: c.schaden, berries: c.berries,
    kopfgeld: c.kopfgeld, aussehen: c.aussehen, ziel: c.ziel,
    spezial: c.spezial, eigenschaften: c.eigenschaften,
    attribute: c.attribute, hab_und_gut: c.habUndGut, waffen: c.waffen,
    skills: c.skills, teufelsfrucht: c.teufelsfrucht,
    portrait_path: c.portrait,
  };
}
```
Analog `ladeCrew/speichereCrew`, `ladeKarte/speichereKarte` (kind = 'tracker'),
`ladeZeichnung/speichereZeichnung` (kind = 'drawing'),
`ladeSchauplatz/speichereSchauplatz` (kind = 'detail'),
`ladeLogbuch/speichereLogbuch`.

**Vorsicht `id`:** Der Prototyp erzeugt IDs wie `"f" + Date.now()`. In der DB
sind es `uuid`. Zwei Optionen: (a) beim ersten Upsert vom Prototyp erzeugte
String-IDs durch `gen_random_uuid()` ersetzen und die neue ID zurücklesen, oder
(b) die Charakter-Haupt-ID zu `uuid` machen und **innere** IDs (Waffen, Skills,
Token …) als beliebige Strings im `jsonb` belassen — das ist unkritisch, weil
sie nie gegen DB-Spalten laufen. Empfehlung: **(b)**.

### 8.2 Wann speichern?

Der Prototyp speichert auf Knopfdruck. Für eine Cloud-App ist automatisches,
entprelltes Speichern angenehmer:
- Nach jeder Änderung einen Timer (z. B. 800 ms) setzen, der die betroffene
  Einheit per `upsert` schreibt („debounced autosave").
- Alternativ die bestehenden Speichern-Knöpfe beibehalten — einfacher, aber
  weniger komfortabel. Für den ersten Meilenstein völlig ausreichend.

### 8.3 Bilder

Die drei Upload-Stellen (`onPortraitUpload`, `onJollyUpload`, `onMapUpload`)
behalten ihre clientseitige Verkleinerung, laden dann aber statt einer Data-URL
in einen Storage-Bucket hoch:
```js
const pfad = `${userId}/${crypto.randomUUID()}.jpg`;
const blob = await (await fetch(dataUrl)).blob();
await supabase.storage.from("bilder").upload(pfad, blob, { contentType: "image/jpeg" });
// pfad in der jeweiligen *_path-Spalte speichern; zum Anzeigen URL erzeugen:
const { data } = supabase.storage.from("bilder").getPublicUrl(pfad);
```

### 8.4 Was unverändert bleibt

Die gesamte Spiel-Logik bleibt gleich und muss **nicht** angefasst werden:
`ausgleich()`, `parseDamage()`, `fruchtBilanz()`, die Würfel-Physik (Quaternion-
Mathematik, `separateOverlaps`, `readFace`), der Initiative-Tracker, die
SVG-/Canvas-Editoren. Diese Funktionen sind reine Berechnung und haben nichts
mit Speicherung zu tun. Beim Aufteilen des Prototyps in Dateien am besten so
schneiden:
```
src/
  components/
    Charakterbogen.jsx
    Wuerfeltisch.jsx        (+ physics.js für die Mathematik)
    KampfTracker.jsx
    KartenTracker.jsx
    Kartografie.jsx
    Schauplatz.jsx
    Logbuch.jsx
    Steckbriefe.jsx
    AnmeldeMaske.jsx
  lib/
    supabase.js
    db.js
    spiel.js               (ausgleich, parseDamage, fruchtBilanz …)
  hooks/
    useAuth.js
  App.jsx
  index.css                (das übernommene Prototyp-CSS + @theme)
```

---

## 9. Feinschliff

- **Schriften:** Für Offline-Fähigkeit und Tempo die zwei Google-Fonts
  self-hosten (Dateien in `public/fonts`, `@font-face` in `index.css`) statt per
  CDN zu laden. Optional.
- **`.gitignore`:** `.env.local`, `node_modules`, `dist` müssen drin sein
  (Vite-Default deckt das ab).
- **Kein Service-Role-Key im Frontend.** Nur der Publishable Key gehört in den
  Client. Der Service-Role-Key umgeht RLS und darf ausschließlich serverseitig
  (Edge Function) verwendet werden — im Prototyp/MVP gar nicht nötig.

---

## 10. Deployment auf Vercel

1. Repository zu GitHub pushen.
2. Auf Vercel „New Project" → das Repo importieren. Vercel erkennt Vite
   automatisch (Build `vite build`, Output `dist`).
3. Unter *Settings → Environment Variables* dieselben zwei Variablen setzen wie
   in `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).
4. In Supabase unter *Authentication → URL Configuration* die Vercel-Domain als
   erlaubte Redirect-URL / Site-URL eintragen, sonst schlägt der Login in
   Produktion fehl.
5. Deployen. Jeder Push auf `main` löst automatisch ein neues Deployment aus.

---

## 11. Zweiter Meilenstein: Mehrspieler-Freigabe

Erst bauen, wenn Meilenstein 1 (Login + private Cloud-Speicherung) steht.

- **Mitgliedschaft:** Tabelle `campaign_members (campaign_id, user_id, rolle)`
  mit Rolle `gm` | `spieler`.
- **RLS erweitern:** Lesen nicht nur bei `auth.uid() = owner`, sondern auch,
  wenn der Benutzer Mitglied der Kampagne ist. Schreiben je nach Rolle
  einschränken (Spieler nur eigener Charakter; GM Karten/Kampf/Logbuch).
- **Beitreten:** Einladungscode pro Kampagne; „Kampagne beitreten" fügt eine
  Zeile in `campaign_members` ein.
- **Echtzeit:** Supabase Realtime abonnieren
  (`supabase.channel(...).on('postgres_changes', …)`), damit die geteilte Karte
  und der Kampf-Tracker live aktualisieren, wenn der GM etwas ändert. Damit wird
  aus dem Einzelgerät-Werkzeug das ursprünglich erträumte Live-Werkzeug für den
  ganzen Tisch.

---

## 12. Arbeitsanweisung für Claude

Wenn du (Claude) dieses Projekt umsetzt:

1. **Ein Schritt nach dem anderen.** Erst Projektgerüst + Login lauffähig, dann
   einen Bereich nach dem anderen an Supabase anbinden — beginne mit dem
   Charakterbogen (`characters`), weil er das Kernstück ist.
2. **Die Spiel-Logik nicht neu erfinden.** `ausgleich`, `parseDamage`,
   `fruchtBilanz`, die Würfel-Physik und die Editoren aus dem Prototyp
   übernehmen. Sie sind im Prototyp verifiziert.
3. **Deutsch bleiben** — UI-Texte, Kommentare, Commit-Nachrichten.
4. **Optik bewahren.** Zuerst das Prototyp-CSS übernehmen, damit nichts an
   Piraten-Atmosphäre verloren geht; Tailwind nur für neue Teile.
5. **Nach jedem Bereich testen:** anlegen, ändern, neu laden — kommen die Daten
   aus Supabase korrekt zurück? Ausloggen/einloggen: bleibt alles privat?
6. **RLS zuerst.** Keine Tabelle ohne aktiviertes RLS und Policies produktiv
   nehmen. Kurz mit einem zweiten Testkonto prüfen, dass niemand fremde Daten
   sieht.
7. **Versionen live prüfen.** Setup-Kommandos und Paketversionen gegen die
   offizielle Doku abgleichen, bevor du sie festschreibst.

Viel Erfolg — und auf hohe Kopfgelder. ☠
