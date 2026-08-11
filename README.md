# ⚓ Grand Line Assistant

Pen-&-Paper-Begleiter für One-Piece- und D&D-Runden: Charakterbögen,
Würfeltisch mit echter Starrkörper-Physik, Kampf-Tracker, Karten,
Kartografie, Schauplatz-Editor und Logbuch. React 19 + TypeScript + Vite,
Daten in Supabase, gehostet auf Vercel.

---

## Schnellstart

```bash
pnpm install
pnpm dev
```

Die App läuft sofort — **ohne** Supabase-Zugangsdaten im **lokalen Modus**:
alle Daten liegen im Browser-Storage unter `gla:*`-Schlüsseln.

Sobald `.env.local` gesetzt ist, verlangt die App eine Anmeldung und speichert
alles im Konto — geräteübergreifend.

| Befehl           | Wirkung                                       |
|------------------|-----------------------------------------------|
| `pnpm dev`       | Entwicklungsserver auf localhost:5173         |
| `pnpm build`     | Typprüfung + Produktionsbuild nach `dist/`    |
| `pnpm typecheck` | nur die Typprüfung                            |
| `pnpm preview`   | den gebauten Stand lokal ansehen              |

---

## Supabase einrichten

1. Projekt auf [supabase.com](https://supabase.com) anlegen.
2. `supabase/migrations/0001_grundgeruest.sql` im **SQL Editor** ausführen.
   Das legt Tabellen, Trigger, **Row Level Security** und den Storage-Bucket
   `bilder` samt Policies an.
3. `.env.example` nach `.env.local` kopieren und ausfüllen:

   ```ini
   VITE_SUPABASE_URL=https://<projekt>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
   ```

   Beides steht im Dashboard unter *Project Settings → API Keys*. Der
   Publishable Key (früher „anon key") ist öffentlich — die Sicherheit kommt aus
   RLS, nicht aus Geheimhaltung. **Der Service-Role-Key gehört niemals ins
   Frontend.**
4. Neu starten (`pnpm dev`). Es erscheint die Anmeldemaske.

### Nach dem Aufsetzen prüfen

- Mit einem **zweiten Testkonto** anmelden: Es darf nichts vom ersten Konto
  sichtbar sein.
- Anlegen → ändern → neu laden: Kommen die Daten korrekt zurück?

---

## Deployment auf Vercel

1. Repository zu GitHub pushen.
2. Auf Vercel *New Project* → Repo importieren. `vercel.json` liegt bei,
   Vite wird erkannt (Build `pnpm build`, Output `dist`).
3. Unter *Settings → Environment Variables* dieselben zwei Variablen setzen.
4. In Supabase unter *Authentication → URL Configuration* die Vercel-Domain
   als Site-URL / erlaubte Redirect-URL eintragen — sonst schlägt der Login
   in Produktion fehl.

Jeder Push auf `main` löst ein neues Deployment aus.

---

## Aufbau

```text
src/
  components/
    GrandLineAssistant.tsx    PnP-Hub: Tab-Leiste, Systemwahl, Topbar
    DnDAssistant.tsx          D&D-Hub: Tab-Leiste, Sprachschalter
    CharacterSheet.tsx        PnP-Charakterbogen
    CombatTracker.tsx         Initiative-Tracker
    MapTracker.tsx            Figuren-Karte mit Tokens
    Cartography.tsx           Insel-Zeichentool
    Scene.tsx                 Schauplatz-/Dungeon-Editor
    Logbook.tsx               Notizen + Questlog
    WantedPosters.tsx         WANTED-Poster + Crew-/Schiffsbogen
    DiceTable.tsx             Vollbild-Würfeltisch (Starrkörper-Physik)
    DiceOverlay.tsx           Overlay-Würfeltisch für Proben aus dem Bogen
    LoginScreen.tsx           E-Mail-/Passwort-Anmeldung
    LoadingScreen.tsx         Ladebildschirm
    dnd/
      DnDSheet.tsx            Grundinfos, Kampfwerte, Attribute, Rettungswürfe
      DnDSkills.tsx           Fähigkeiten mit Profizienz/Expertise
      DnDFeatures.tsx         Merkmale & Features mit Herkunfts-Filter
      DnDSpells.tsx           Zauberliste, Slots, Ressourcen, Spell-DB-Suche
      DnDClassRoadmap.tsx     Klassen-Stufenplan, Metamagic-Picker (Sorcerer)
      DnDCombatRound.tsx      Kampfrunden-Tracker (Aktion/Bonus/Reaktion/Bewegung)
      DnDResourceHUD.tsx      Kopfleiste: Slots + Ressourcen + Rast-Buttons
      Autocomplete.tsx        Dropdown-Eingabefeld mit Tastaturnavigation
  lib/
    game.ts         balanceValue, parseDamage, fruitBalance — die PnP-Regeln
    physics.ts      Quaternionen, konvexe Hüllen, Trägheitstensoren, readFace
    storage.ts      Persistenz-Fassade (Cloud oder lokal)
    db.ts           Supabase-Zugriff + Mapper DB-Zeile ↔ Objekt
    normalize.ts    eingehende Daten begradigen
    images.ts       clientseitiges Verkleinern vor dem Hochladen
    dndGame.ts      D&D-Regeln (proficiencyBonus, modDisplay, skillMod …)
    dndSpellDB.ts   Suche in dndSpells.json (1 319 Zauber, Open5e v2)
    dndClasses.ts   Slot-Tabellen, classLevelProgression, applyClass
    dndSpecies.ts   Spezies-Definitionen (D&D 2024 PHB), applySpeciesToCharacter
    pdf.ts          Druckansicht des PnP-Charakterbogens
    supabase.ts     Supabase-Singleton
  hooks/
    useAuth.ts          Session + signIn / signUp / signOut
    useAutosave.ts      entprelltes Speichern (800 ms)
    useDnDCharacter.ts  D&D-Charakterzustand (Slots, Ressourcen, Zauber …)
  state/
    CampaignContext.tsx   gespeicherte PnP-Daten + Autosave-Status
    SessionContext.tsx    Reiter, Kampf-Tracker, Würfe (nicht gespeichert)
  i18n/
    index.tsx   LangProvider, useLang, useT, LangToggle, useGameLabels
    de.ts       Deutsche Strings
    en.ts       Englische Strings
  data/
    dndSpells.json        1 319 Zauber aus Open5e v2 (SRD + Homebrew)
    dndSpellNames.ts      deutsche Zaubernamen (SPELL_NAMES_DE)
  types/
    index.ts    PnP-Typen (Charakter, Crew, Kaempfer …)
    dnd.ts      D&D-Typen (DnDCharakter, DnDZauber …)
supabase/migrations/      SQL für Schema, RLS und Storage-Bucket
```

**Speichern** läuft automatisch: 800 ms nach der letzten Änderung wird der
betroffene Bereich geschrieben, der Status steht oben rechts. Die
Speichern-Knöpfe erzwingen ein sofortiges Schreiben mit Rückmeldung.

**Bilder** (Porträts, Jolly Roger, Kartenbilder) werden clientseitig
verkleinert und im Cloud-Modus in den Storage-Bucket `bilder` geladen; in der
Zeile steht nur der Pfad. Im lokalen Modus bleiben sie Data-URLs.

---

## PnP-Spielsystem

- 9 Attribute: Nahkampf, Fernkampf, Blocken, Geschicklichkeit, Intelligenz,
  Konstitution, Charisma, Navigation, Heilkunde.
- Ausgleich je Stufe: ≤1 → −4, ≤3 → −3, ≤5 → −2, ≤7 → −1, ≤12 → 0, ≤15 → +1,
  ≤17 → +2, ≤19 → +3, sonst +4.
- Probe = 2W6 + Ausgleich · ≥10 GESCHAFFT · 7–9 TEILWEISE · ≤6 FEHLSCHLAG.
- Schadensausdrücke: `2W6+3`, `W8`, `W6 + W6`, `3d10-2`.
- Teufelsfrucht: eine pro Charakter, Rang-Track, Freischalten kostet Stufen.

Die Augenzahl auf dem Würfeltisch wird aus der Fläche gelesen, die am Ende
oben liegt — nichts wird vorgegeben. Der W4 wird unten abgelesen.

---

## D&D-Assistent

Der D&D-Modus ist vollständig vom PnP-Modus getrennt und speichert seinen
Zustand lokal (`gla:dnd:char`). Tabs:

- **Charakterbogen** — Name, Spezies, Klasse, Unterklasse, Hintergrund und
  Stufe als Autocomplete-Felder; Kampfwerte (RK, TP, Geschwindigkeit,
  Übungsbonus); Attribute mit Modifikatoren; Rettungswürfe.
- **Fähigkeiten** — alle 18 D&D-Fähigkeiten mit Profizienz- und
  Expertise-Markierung.
- **Merkmale** — Features nach Herkunft (Klasse, Unterklasse, Spezies, Talent,
  Hintergrund) gefiltert; Hinzufügen, Bearbeiten, Löschen.
- **Zauber & Slots** — Zauberliste, Slot-Konfiguration, Konzentrations-Banner,
  benutzerdefinierte Ressourcen (Ki, Arcane Recovery …), eingebettete Spell-DB.
- **Kampfrunde** — Tracker für Aktion, Bonusaktion, Reaktion und Bewegung pro
  Runde; Reset-Knopf für die nächste Runde.

### Klassen & Spezies

`dndClasses.ts` kennt alle Klassen aus dem D&D 2024 PHB mit korrekten
Slot-Tabellen (Voll-/Halb-/Drittelzauberer) und Feature-Listen pro Stufe.
`dndSpecies.ts` enthält alle Spezies mit ihren Merkmalen und Stufen-Progressionen.
Beide Module speisen die Autocomplete-Felder im Charakterbogen und liefern
die Vorschau beim „Klasse anwenden"-Dialog.

### Spell-Datenbank

1 319 Zauber aus Open5e v2, durchsuchbar nach Name (DE/EN), Stufe und
Homebrew-Status. Klick auf einen Treffer befüllt das Zauber-Formular vor.
Direkter Link zur 5esrd.com-Seite pro SRD-Zauber. Die DE/EN-Anzeige folgt
dem globalen Sprachschalter im Header.

### Ressourcen-HUD

Dauerhaft sichtbare Kopfleiste mit Slot-Blasen (je Stufe) und
Ressourcen-Chips; Klick verbraucht / hält Ctrl zum Wiederherstellen.
Lang- und Kurzrast-Buttons daneben.

### Sprache

DE/EN-Schalter oben rechts im D&D-Header. Steuert alle UI-Texte **und** die
Zaubernamen in der Spell-DB-Suche (kein getrennter Schalter mehr).

---

`grandline-assistant.jsx` im Wurzelverzeichnis ist der ursprüngliche Prototyp
und bleibt als Referenz liegen.
