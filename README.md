# ⚓ Grand Line Assistant

Pen-&-Paper-Begleiter für One-Piece-Runden: Charakterbögen, ein Würfeltisch mit
echter Starrkörper-Physik, Kampf-Tracker, Karten, Kartografie, Schauplatz-Editor
und Logbuch. React 19 + TypeScript + Vite, Daten in Supabase, gehostet auf Vercel.

---

## Schnellstart

```bash
pnpm install
pnpm dev
```

Die App läuft sofort — **ohne** Supabase-Zugangsdaten im **lokalen Modus**:
alle Daten liegen im Browser-Storage unter denselben `gla:*`-Schlüsseln wie im
Prototyp. Eine bestehende Runde findet ihre Daten also wieder.

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
   Publishable Key (früher „anon key“) ist öffentlich — die Sicherheit kommt aus
   RLS, nicht aus Geheimhaltung. **Der Service-Role-Key gehört niemals ins
   Frontend.**
4. Neu starten (`pnpm dev`). Es erscheint die Anmeldemaske.

### Nach dem Aufsetzen prüfen

- Mit einem **zweiten Testkonto** anmelden: Es darf nichts vom ersten Konto
  sichtbar sein. Ohne Policy liefert eine RLS-Tabelle leer zurück — sieht man
  fremde Daten, fehlt eine Policy oder RLS ist aus.
- Anlegen → ändern → neu laden: Kommen die Daten korrekt zurück?

---

## Deployment auf Vercel

1. Repository zu GitHub pushen.
2. Auf Vercel *New Project* → Repo importieren. `vercel.json` liegt bei, Vite
   wird erkannt (Build `pnpm build`, Output `dist`).
3. Unter *Settings → Environment Variables* dieselben zwei Variablen setzen wie
   in `.env.local`.
4. In Supabase unter *Authentication → URL Configuration* die Vercel-Domain als
   Site-URL / erlaubte Redirect-URL eintragen — sonst schlägt der Login in
   Produktion fehl.

Jeder Push auf `main` löst ein neues Deployment aus.

---

## Aufbau

```text
src/
  components/     Ein Bauteil je Reiter + Würfeltisch, Anmeldung, Eingabefelder
  lib/
    spiel.ts      ausgleich, parseDamage, fruchtBilanz — die Regeln
    physik.ts     Quaternionen, konvexe Hüllen, Trägheitstensoren, readFace
    speicher.ts   Persistenz-Fassade (Cloud oder lokal)
    db.ts         Supabase-Zugriff + Mapper DB-Zeile ↔ Prototyp-Objekt
    normalisieren.ts  fremde Daten begradigen
    bilder.ts     clientseitiges Verkleinern vor dem Hochladen
    pdf.ts        Druckansicht des Charakterbogens
  state/
    KampagneContext.tsx   gespeicherte Daten + entprelltes Autosave
    SitzungContext.tsx    Reiter, Kampf-Tracker, Würfe (nicht gespeichert)
  hooks/          useAuth, useAutosave
supabase/migrations/      SQL für Schema, RLS und Storage
```

**Speichern** läuft automatisch: 800 ms nach der letzten Änderung wird der
betroffene Bereich geschrieben, der Status steht oben rechts. Die
Speichern-Knöpfe aus dem Prototyp sind geblieben und erzwingen ein sofortiges
Schreiben mit Rückmeldung.

**Bilder** (Porträts, Jolly Roger, Kartenbilder) werden clientseitig
verkleinert und im Cloud-Modus in den Storage-Bucket geladen; in der Zeile steht
nur der Pfad. Im lokalen Modus bleiben sie Data-URLs.

---

## Spielsystem

- 9 Attribute: Nahkampf, Fernkampf, Blocken, Geschicklichkeit, Intelligenz,
  Konstitution, Charisma, Navigation, Heilkunde.
- Ausgleich je Stufe: ≤1 → −4, ≤3 → −3, ≤5 → −2, ≤7 → −1, ≤12 → 0, ≤15 → +1,
  ≤17 → +2, ≤19 → +3, sonst +4.
- Probe = 2W6 + Ausgleich · ≥10 GESCHAFFT · 7–9 TEILWEISE · ≤6 FEHLSCHLAG.
- Schadensausdrücke: `2W6+3`, `W8`, `W6 + W6`, `3d10-2`.
- Teufelsfrucht: eine pro Charakter, Rang-Track, Freischalten kostet Stufen.

Die Augenzahl auf dem Würfeltisch wird aus der Fläche gelesen, die am Ende oben
liegt — nichts wird vorgegeben. Der W4 wird unten abgelesen.

`grandline-assistant.jsx` im Wurzelverzeichnis ist der ursprüngliche Prototyp und
bleibt als Referenz liegen.
