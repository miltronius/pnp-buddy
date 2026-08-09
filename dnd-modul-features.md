# D&D 5e (2024) — Modul-Spezifikation

Feature-Liste für die Erweiterung einer bestehenden Multi-System-PnP-App um einen D&D-5e-Teil.
Grundlage: reale Verwirrungspunkte aus einer Level-4-Sorcerer-Kampagne — jeder Punkt ist ein Feature.

---

## 0. Leitgedanke: Was ist wirklich neu?

Die App kann vermutlich schon: Character-Sheets rendern, Würfeln, Kampagnen/Sessions verwalten, Inventar.
**Nicht** übernehmen lässt sich aus generischen Systemen die D&D-spezifische Ressourcen- und Aktionslogik. Genau das ist der Kern dieses Moduls:

1. **Action Economy** — vier Töpfe pro Runde, Bonusaktion nur bei expliziter Erlaubnis
2. **Getrennte Ressourcen-Pools** — Slots ≠ Sorcery Points ≠ X/Rest ≠ At-will
3. **Konzentration** — genau einer, Auto-Konflikt
4. **Prepared vs. Known + Upcasting** — Cantrip skaliert mit Level, Spell mit Slot
5. **Feature-Herkunft** — Species / Class / Subclass / Feat / Background als getrennte Quellen
6. **Vorberechnete Modifikatoren** — Proficiency ist überall schon eingerechnet
7. **Attack Roll vs. Saving Throw** — zwei getrennte Mechaniken
8. **Regelversion 2014 vs. 2024** — schaltet Werte um

Wenn dein bestehendes Datenmodell diese Konzepte nicht kennt, brauchst du für D&D eine eigene Regel-Engine hinter der gemeinsamen UI-Schicht.

---

## 1. Architektur-Empfehlung

### 1.1 Gemeinsame Kern-Abstraktion: `Effect`

Alles, was ein Charakter „tun kann", als ein Typ modellieren — egal ob Zauber, Speziesmerkmal, Klassenfeature oder Feat. Das verhindert Sonderfälle und beantwortet die häufigsten Fragen automatisch.

```ts
interface Effect {
  id: string
  name: string
  source: 'SPECIES' | 'CLASS' | 'SUBCLASS' | 'FEAT' | 'BACKGROUND' | 'UNIVERSAL'
  actionType: 'ACTION' | 'BONUS' | 'REACTION' | 'FREE' | 'NONE'
  cost: {
    pool: 'SLOT' | 'SORCERY_POINT' | 'USES' | 'NONE'
    slotLevel?: number          // bei pool=SLOT: Mindeststufe
    amount?: number
  }
  recharge: 'LONG_REST' | 'SHORT_REST' | 'AT_WILL' | 'NONE'
  concentration: boolean
  targeting: 'ATTACK_ROLL' | 'SAVE' | 'AUTO' | 'NONE'
  saveAbility?: 'STR'|'DEX'|'CON'|'INT'|'WIS'|'CHA'
  scaling?: { by: 'CHARACTER_LEVEL' | 'SLOT_LEVEL', table: ScalingRow[] }
  constraints?: string[]        // z.B. "nur Humanoide", "braucht Sichtlinie", "kein Geruch"
  rulesVersion: '2014' | '2024'
}
```

Damit fällt die halbe Feature-Liste unten fast von selbst raus: „Was kann ich jetzt?" ist ein Filter über `Effect[]`, und die Herkunftsfrage ist das Feld `source`.

### 1.2 Ressourcen als getrennte, benannte Pools

```ts
interface ResourcePool {
  id: string                    // 'slots_1', 'slots_2', 'sorcery_points', 'breath_weapon', ...
  label: string
  max: number
  current: number
  recharge: 'LONG_REST' | 'SHORT_REST'
}
```

Kritisch: **Pools mischen sich nicht.** Die einzige Brücke sind explizite Konvertierungs-`Effects` (z.B. Font of Magic). Kein globaler „Mana"-Wert.

### 1.3 State als append-only Event-Log

Alle Verbräuche als Events, nie den State direkt mutieren. Ermöglicht Undo und Replay — im Spiel ständig gebraucht („war das der erste oder zweite Einsatz?").

```ts
type GameEvent =
  | { t: 'CAST', effectId, slotLevel?, at }
  | { t: 'USE_RESOURCE', poolId, amount, at }
  | { t: 'CONVERT', from, to, at }
  | { t: 'CONCENTRATION_START', effectId, at }
  | { t: 'CONCENTRATION_END', reason, at }
  | { t: 'REST', kind: 'SHORT'|'LONG', at }
  | { t: 'UNDO', targetEventId, at }
```

---

## 2. Must-Have Features

### 2.1 Live-Ressourcentracker
Alle Pools als tappbare Zähler, mit Long-/Short-Rest-Reset per Knopf. Häufigste Frage im Spiel überhaupt: „wie viele Slots hab ich noch". Muss ohne Scrollen sichtbar sein.

### 2.2 Runden-Tracker (Action Economy)
Vier Flags pro Runde: Bewegung / Aktion / Bonusaktion / Reaktion. Jede Nutzung setzt das Flag, „Neue Runde" resettet.
Regel-Enforcement:
- Nur **eine** Bonusaktion pro Runde.
- Reaktion auch ausserhalb des eigenen Zuges nutzbar, resettet zu Rundenbeginn.
- Warnung bei Quickened-Spell-artigen Effekten: „Bonusaktions-Zauber gewirkt → als Aktion nur noch Cantrip erlaubt" (2024-Regel).

### 2.3 „Was kann ich jetzt?"-Ansicht
Der eigentliche Killer-View. Filtert `Effect[]` nach **zwei** Achsen gleichzeitig:
- genug Ressourcen im passenden Pool vorhanden?
- passende Action-Economy-Slot noch frei?

Ausgabe gruppiert: „Jetzt sofort möglich" / „Möglich, aber kostet die letzte X" / „Blockiert (Grund)". Beantwortet die Frage, bevor der Spieler die Tabelle selbst durchgeht.

### 2.4 Herkunfts-Tag auf jeder Fähigkeit
`source` immer sichtbar (Icon/Farbe). Löst „woher hab ich Dash / Innate Sorcery / diesen Gratis-Teleport" — der zweithäufigste Fragetyp. `UNIVERSAL` = Standard-Aktionen, die jeder kann (Dash, Dodge, Disengage, Hide, Help, Ready, Influence, Study).

### 2.5 Konzentration als First-Class-State
- Nur ein Effekt gleichzeitig; neuer Konzentrations-`Effect` beendet den alten automatisch (mit sichtbarem Hinweis).
- „Konzentration fallen lassen" als 0-Kosten-Aktion jederzeit verfügbar.
- Con-Save-Helfer bei Schaden: DC = max(10, ⌊Schaden/2⌋), würfelt mit vorberechnetem Save-Mod.
- Aktuell konzentrierter Effekt permanent im HUD.

### 2.6 Wurf-Helfer mit vorberechneten Modifikatoren
- Attack Roll: d20 + gespeicherter Attack-Mod, gegen AC. **Proficiency nie separat addieren** — sie steckt im Mod. (Der klassische „9 + Proficiency"-Fehler.)
- Saving Throw: Gegner würfelt gegen deine DC — andere Mechanik, klar getrennt dargestellt.
- Advantage/Disadvantage-Toggle (2 d20).
- Crit: **nur Würfel verdoppeln, keine Boni**. Bei Save-Zaubern kein Crit.

### 2.7 Event-Log mit Undo
Chronologische Liste aller Verbräuche, jeder Eintrag einzeln zurücknehmbar. Muss auch „ich hab mich verzählt, das war Einsatz 1 nicht 2" sauber abbilden.

### 2.8 Regelversion-Flag (2014/2024) pro Charakter
Schaltet betroffene Werte um (z.B. Breath Weapon 1d10 vs. 2d6-Progression, Background-Boni, Subclass-Level). Verhindert stille Diskrepanzen zwischen Spielrunde und App.

---

## 3. Sehr wertvoll

### 3.1 Upcast-Vorschau
Slider über Slot-Level, zeigt Schaden/Effekt pro Stufe live. Cantrips: Slider gesperrt, stattdessen Charakterlevel-Skalierung anzeigen (nur so lässt sich „Cantrip auf Lvl 2?" strukturell verhindern).

### 3.2 Constraint-Warnungen statt reinem Beschreibungstext
`constraints` maschinell auswerten:
- „Ziel ist Warforged/Construct → Hold Person & Charm Person wirken nicht (nur Humanoide)."
- „Minor Illusion kann keinen Geruch — nutze Prestidigitation."
- „Misty Step braucht Sichtlinie zum Zielfeld."
Das ist der Übergang von „digitales Blatt" zu „Assistent, der mitdenkt".

### 3.3 Ressourcen-Konvertierung als Transaktion
Font-of-Magic-artige Umwandlungen mit Vorschau: „4 SP = 2× Slot L1 oder 1× Slot L2". Als eigenes Event, undo-bar. Zeigt „effektive Reserve" (echte Slots + konvertierbare Punkte).

### 3.4 Level-Up-Diff & Vorschau
„Auf Level 5 bekommst du: Draconic Flight, Slots L3, +1 Würfel Sorcerous Burst." Beantwortet „kann ich schon fliegen?" proaktiv. Beim Level-Up: Sorcerer tauscht 1 Cantrip + 1 Spell — als geführter Schritt, nicht frei editierbar (sonst entstehen illegale Sheets).

### 3.5 Prepared/Known-Modell korrekt abbilden
- **Known-Caster** (Sorcerer): feste Liste, Tausch nur beim Level-Up.
- **Prepared-Caster** (Cleric, Wizard-Variante): täglicher Wechsel.
- „Immer vorbereitet"-Grants (Subclass, Feat) getrennt führen — zählen nicht gegen das Limit, sind nicht tauschbar.

### 3.6 Import & Diff gegen bestehendes Blatt
Import aus D&D Beyond o.ä., dann Diff gegen den geplanten Build. Fängt genau den Fehler, dass ein importiertes Sheet AC 14 / Init +0 zeigt, obwohl der Build AC 16 / +2 vorsieht (falsche Werte eingetragen).

---

## 4. Integration in die bestehende Multi-System-App

- **Gemeinsam lassen:** Sheet-Chrome, Würfler-UI, Kampagnen-/Session-Modell, Inventar, Notizen. Nur die *Werte-Berechnung* und *Ressourcen-Logik* sind system-spezifisch.
- **Als Plugin kapseln:** Eine `RuleSystem`-Schnittstelle mit Methoden wie `computeDerivedStats()`, `availableEffects(state)`, `applyEvent(state, event)`. D&D ist eine Implementierung davon, deine bestehenden Systeme andere.
- **Nicht** versuchen, D&D-Slots in ein generisches „Ressourcen"-Feld eines anderen Systems zu pressen — die Recharge- und Konvertierungslogik ist zu eigen. Eigener Pool-Typ, gemeinsame Anzeige-Komponente.
- **UI-Wiederverwendung** über generische Komponenten (Zähler, Toggle, Roller), die per System-Config befüllt werden.

---

## 5. Content & Lizenz (wichtig vor dem ersten Commit)

- **SRD 5.2** (System Reference Document) steht unter **CC-BY-4.0** und deckt Grundklassen, viele Zauber, Grundregeln ab. Legal einbettbar mit Namensnennung.
- Alles darüber hinaus (z.B. Eberron-Spezies, viele Subclasses, Feats wie Fey Touched) ist **nicht** frei — nicht mitliefern. Stattdessen: User trägt eigene Homebrew-/Buch-Inhalte selbst ein, App liefert nur das Gerüst.
- Genau diese Lizenzgrenze ist der Grund, warum es wenige vollständige Tools gibt. Sauber trennen: „mitgelieferte SRD-Daten" vs. „User-Content".

---

## 6. Priorisierte Roadmap

**MVP (macht das Blatt lebendig)**
Ressourcentracker · Runden-Tracker · Herkunfts-Tags · Konzentrations-State · Event-Log/Undo · Wurf-Helfer

**V2 (macht es zum Assistenten)**
„Was kann ich jetzt?"-View · Constraint-Warnungen · Upcast-Vorschau · Ressourcen-Konvertierung

**V3 (Komfort & Wachstum)**
Level-Up-Diff · Import/Diff · Prepared-Caster-Support · weitere Klassen über die `RuleSystem`-Schnittstelle

---

*Ableitung: Jedes Feature entspricht einem konkreten Verständnisproblem am Tisch. Wenn ein geplantes Feature auf keinen realen Stolperstein zurückgeht, ist es vermutlich Ballast.*
