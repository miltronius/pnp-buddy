# CLAUDE.md — Grand Line Assistant

Arbeitsanweisung für Claude-Instanzen, die an diesem Projekt weiterarbeiten.

**UI-Sprache:** Die gesamte Benutzeroberfläche ist auf Deutsch. UI-Texte,
Fehlermeldungen, Toast-Hinweise → Deutsch. **Code-Sprache:** alle Dateinamen,
Funktionen, Variablen, Typen, Exports → Englisch.

---

## 1. Was das Projekt ist

Ein Pen-&-Paper-Begleiter für One-Piece-Runden (PnP-Modus) und D&D (D&D-Modus),
selbst gehostet auf Vercel, Daten in Supabase. Piraten-Ästhetik:
Schriften *Pirata One* + *IM Fell English*, Pergament `#e7d3a8`, dunkle See
`#14222e`, Rot `#8b2e1f`, Gold `#b8862b`.

### PnP-Tabs (intern)

| Tab-ID     | Titel          | Komponente        |
|------------|----------------|-------------------|
| `bogen`    | Charakterbogen | `CharacterSheet`  |
| `wuerfel`  | Würfeltisch    | `DiceTable`       |
| `kampf`    | Kampf          | `CombatTracker`   |
| `karte`    | Karte          | `MapTracker`      |
| `zeichnen` | Kartografie    | `Cartography`     |
| `detail`   | Schauplatz     | `Scene`           |
| `notizen`  | Logbuch        | `Logbook`         |
| `crew`     | Steckbriefe    | `WantedPosters`   |

### D&D-Tabs

| Tab-ID          | Titel           | Komponente     |
|-----------------|-----------------|----------------|
| `bogen`         | Charakterbogen  | `DnDSheet`     |
| `faehigkeiten`  | Fähigkeiten     | `DnDSkills`    |
| `merkmale`      | Merkmale ✦      | `DnDFeatures`  |
| `zauber`        | Zauber & Slots  | `DnDSpells`    |

---

## 2. Tech-Stack

- **pnpm** — Paketmanager.
- **Vite** + **React 19** + **TypeScript**.
- **Tailwind CSS v4** via `@tailwindcss/vite` — Konfiguration in `index.css`
  im `@theme`-Block; kein `tailwind.config.js`.
- **Supabase** (`@supabase/supabase-js` v2) — Datenbank, Auth, Storage.
- **Vercel** — Hosting, automatischer Deploy bei Push auf `main`.

---

## 3. Dateistruktur

```text
src/
  components/
    GrandLineAssistant.tsx    PnP-Hub
    DnDAssistant.tsx          D&D-Hub
    CharacterSheet.tsx
    CombatTracker.tsx
    MapTracker.tsx
    Cartography.tsx
    Scene.tsx
    Logbook.tsx
    WantedPosters.tsx
    DiceTable.tsx
    DiceOverlay.tsx
    LoginScreen.tsx
    LoadingScreen.tsx
    dnd/
      DnDSheet.tsx
      DnDSkills.tsx
      DnDFeatures.tsx
      DnDSpells.tsx
  lib/
    game.ts           PnP-Regeln: balanceValue, parseDamage, fruitBalance,
                      newCharacter, newCrew, newMap … VERDICT_TEXT
    physics.ts        Würfel-Physik: Quaternionen, separateOverlaps, readFace
    storage.ts        Storage-Interface + createLocalStorage + createStorage
    db.ts             createCloudStorage (Supabase-Zugriff + Mapper)
    normalize.ts      normalizeCharacter, normalizeCrew, normalizeMap …
    images.ts         loadImageScaled, scaleMapImage, dataUrlToBlob
    dndGame.ts        D&D-Regeln: proficiencyBonus, modDisplay, skillMod,
                      DND_SKILLS, ABILITY_NAMES, SOURCE_LABEL …
    dndSpellDB.ts     spellSuche, srdUrl, SPELL_DB_GROESSE, SPELL_DB_SRD
    pdf.ts            Druckansicht des PnP-Bogens
    supabase.ts       Supabase-Singleton, isCloudConfigured, IMAGE_BUCKET
  hooks/
    useAuth.ts        useAuth + signIn / signUp / signOut (named exports)
    useAutosave.ts    entprelltes Speichern, 800 ms Standard
    useDnDCharacter.ts
  state/
    CampaignContext.tsx   CampaignProvider, useCampaign, CampaignValue
    SessionContext.tsx    SessionProvider, useSession, SessionValue
  data/
    dndSpells.json        1 319 Zauber aus Open5e v2
    dndSpellNames.ts      SPELL_NAMES_DE (englischer Name → deutscher Name)
  types/
    index.ts    Charakter, Crew, Kaempfer, TabName, SystemName …
    dnd.ts      DnDCharakter, DnDZauber, AbilityKey, HerkunftArt …
supabase/
  migrations/0001_grundgeruest.sql
```

---

## 4. PnP-Spielsystem (nicht verändern)

- **9 Attribute:** Nahkampf, Fernkampf, Blocken, Geschicklichkeit,
  Intelligenz, Konstitution, Charisma, Navigation, Heilkunde.
- **Ausgleich** (`balanceValue`): ≤1 → −4, ≤3 → −3, ≤5 → −2, ≤7 → −1,
  ≤12 → 0, ≤15 → +1, ≤17 → +2, ≤19 → +3, sonst +4.
- **Probe** = 2W6 + Ausgleich · ≥10 GESCHAFFT · 7–9 TEILWEISE · ≤6 FEHLSCHLAG.
  Verdikt-Text in `VERDICT_TEXT`.
- **Schadensausdrücke:** `parseDamage` versteht `2W6+3`, `W8`, `W6 + W6`,
  `3d10-2`.
- **Teufelsfrucht:** eine pro Charakter, Rang-Track. `fruitBalance(stufe, raenge)`
  → `{ available, spent }`.
- **Würfel-Physik:** die gesamte Mathematik in `physics.ts` — Quaternionen,
  konvexe Hüllen, Trägheitstensoren, `readFace`. Nichts davon anfassen.

---

## 5. Datenzugriff und Persistenz

Die `Storage`-Fassade in `storage.ts` abstrahiert Cloud und lokal:

```ts
interface Storage {
  modus: "cloud" | "lokal";
  ladeAlles(): Promise<KampagnenDaten>;
  speichereCharaktere(chars): Promise<void>;
  loescheCharakter(id): Promise<void>;
  speichereCrew(crew): Promise<void>;
  speichereKarte(k): Promise<void>;
  speichereZeichnung(z): Promise<void>;
  speichereSchauplatz(s): Promise<void>;
  speichereLogbuch(l): Promise<void>;
  bildSpeichern(datenUrl): Promise<string>;
  bildUrl(wert): string | null;
}
```

`createStorage(userId)` gibt Cloud zurück, wenn `userId` gesetzt ist,
sonst `createLocalStorage()`. Der lokale Modus verwendet `localStorage`
mit `gla:*`-Schlüsseln.

**Autosave:** `useAutosave(value, ready, saveFn, 800)` — feuert 800 ms nach
der letzten Änderung, solange `ready` true ist. Erster Render wird
übersprungen.

**Bilder:** Vor dem Hochladen clientseitig verkleinern (`loadImageScaled`,
max. 1600 px Kante / 600 px für Jolly Roger, JPEG). Im Cloud-Modus Pfad in
`*_path`-Spalte ablegen; URL über `bildUrl()` auflösen.

---

## 6. Datenbank-Schema (Supabase)

Tabellen: `campaigns`, `characters`, `crews`, `maps`, `logbooks`.

- `characters` hat strukturierte Spalten für Kernfelder; `attribute`,
  `hab_und_gut`, `waffen`, `skills`, `teufelsfrucht` sind `jsonb`.
- `maps` ist polymorph: `kind IN ('tracker','drawing','detail')`.
- Jede Zeile trägt `owner uuid → auth.users` und `campaign_id`.
- **RLS ist für alle Tabellen aktiv.** Die Policy-Formel ist immer
  `auth.uid() = owner`. Storage-Bucket `bilder` hat eigene Policies
  (Pfad-Präfix = User-ID).

Vollständiges SQL: `supabase/migrations/0001_grundgeruest.sql`.

---

## 7. Authentifizierung

`useAuth` liefert `{ session, user, loading, cloud }`. `cloud` ist `false`,
wenn keine Supabase-Zugangsdaten hinterlegt sind — dann läuft die App lokal
ohne Login. Auth-Aktionen `signIn`, `signUp`, `signOut` sind named exports
aus `hooks/useAuth.ts`.

`App.tsx` zeigt `LoginScreen` nur wenn `cloud && !user`. Sonst:

```tsx
<CampaignProvider userId={user?.id ?? null}>
  <SessionProvider>
    <GrandLineAssistant email={user?.email ?? null} />
  </SessionProvider>
</CampaignProvider>
```

---

## 8. D&D-Assistent

`useDnDCharacter` hält den gesamten D&D-Zustand im `localStorage`
(Schlüssel `gla:dnd:char`). Kein Supabase-Anschluss — Meilenstein 2.

**Spell-DB:** `dndSpells.json` enthält 1 319 Zauber aus Open5e v2.
`spellSuche(q, { nurSRD?, max? })` durchsucht sie. Jeder Eintrag hat
`isHomebrew: boolean` und `sourceDoc`. `srdUrl(nameEn)` erzeugt einen
5esrd.com-Link. DE/EN-Toggle und Homebrew-Filter liegen in `localStorage`
(`gla:dnd:zeigeDe`, `gla:dnd:zeigeHomebrew`).

---

## 9. Konventionen

- **Dateien, Funktionen, Variablen, Typen, Exports** → Englisch.
- **UI-Texte, Toast-Meldungen, Kommentare im Code** → Deutsch.
- Tab-ID-Strings (`"bogen"`, `"wuerfel"`, `"karte"` …) und DB-Felder
  (`notizen`, `quests`, `hab_und_gut` …) bleiben deutsch — das ist der
  Persistenz-Vertrag und darf nicht still umbenannt werden.
- Optik bewahren: Prototyp-CSS in `index.css` nicht ohne Grund anfassen.
  Tailwind nur für neue Bauteile.
- Kein Service-Role-Key im Frontend.

---

## 10. Zweiter Meilenstein: Mehrspieler

Erst bauen, wenn Login + private Cloud-Speicherung stabil sind.

- Tabelle `campaign_members (campaign_id, user_id, rolle)` mit `gm | spieler`.
- RLS erweitern: Lesen auch für Kampagnen-Mitglieder; Schreiben je nach Rolle.
- Einladungscode pro Kampagne.
- Supabase Realtime für geteilte Karte und Kampf-Tracker.
- D&D-Charaktere an Supabase anbinden (analog zu PnP `characters`-Tabelle).

---

☠ Auf hohe Kopfgelder.
