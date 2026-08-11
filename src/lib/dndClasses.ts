import type { AbilityKey, ActionType, DnDCharacter, DnDFeature, DnDResource, DnDSlotLevel, DnDSpell } from "../types/dnd";
import { newId } from "./dndGame";
import { spellNachSlug } from "./dndSpellDB";

// ── Spell slot tables ──────────────────────────────────────────────────────

// Full caster (Sorcerer, Wizard, Bard, Cleric, Druid) — index = charLevel-1
const VOLL: number[][] = [
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

// Half caster (Paladin, Ranger) — starts level 2
const HALB: number[][] = [
  [0, 0, 0, 0, 0],
  [2, 0, 0, 0, 0],
  [3, 0, 0, 0, 0],
  [3, 0, 0, 0, 0],
  [4, 2, 0, 0, 0],
  [4, 2, 0, 0, 0],
  [4, 3, 0, 0, 0],
  [4, 3, 0, 0, 0],
  [4, 3, 2, 0, 0],
  [4, 3, 2, 0, 0],
  [4, 3, 3, 0, 0],
  [4, 3, 3, 0, 0],
  [4, 3, 3, 1, 0],
  [4, 3, 3, 1, 0],
  [4, 3, 3, 2, 0],
  [4, 3, 3, 2, 0],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2],
];

// Warlock pact magic — [numSlots, slotLevel] per char level
const PAKT: [number, number][] = [
  [1, 1], [2, 1], [2, 2], [2, 2], [2, 3],
  [2, 3], [2, 4], [2, 4], [2, 5], [2, 5],
  [3, 5], [3, 5], [3, 5], [3, 5], [3, 5],
  [3, 5], [4, 5], [4, 5], [4, 5], [4, 5],
];

function tableToSlots(reihe: number[]): Record<number, DnDSlotLevel> {
  const result: Record<number, DnDSlotLevel> = {};
  reihe.forEach((max, i) => {
    if (max > 0) result[i + 1] = { max, current: max };
  });
  return result;
}

function fullCasterSlots(stufe: number): Record<number, DnDSlotLevel> {
  return tableToSlots(VOLL[Math.min(stufe, 20) - 1]);
}

function halfCasterSlots(stufe: number): Record<number, DnDSlotLevel> {
  return tableToSlots(HALB[Math.min(stufe, 20) - 1]);
}

function pactSlots(stufe: number): Record<number, DnDSlotLevel> {
  const [num, rank] = PAKT[Math.min(stufe, 20) - 1];
  return { [rank]: { max: num, current: num } };
}

// ── Type definitions ───────────────────────────────────────────────────────

export interface FeatureDef {
  stufe: number;
  name: string;
  description: string;
  herkunft: 'CLASS' | 'SUBCLASS';
}

interface ZauberGrant {
  stufe: number;
  slug: string;
}

interface SubclassDef {
  schluessel: string[];
  name: string;
  nameEn: string;
  merkmale: FeatureDef[];
  zauberGrants?: ZauberGrant[];
}

export interface ClassDef {
  schluessel: string[];
  name: string;
  nameEn: string;
  rettungswuerfe: AbilityKey[];
  schlitze: ((stufe: number) => Record<number, DnDSlotLevel>) | null;
  merkmale: FeatureDef[];
  ressourcen: (stufe: number) => Omit<DnDResource, 'id'>[];
  unterklassen: SubclassDef[];
  zauberGrants?: ZauberGrant[];
}

// ── Class definitions ──────────────────────────────────────────────────────

const KLASSEN: ClassDef[] = [
  // ── Zauberer (Sorcerer) ──────────────────────────────────────────────────
  {
    schluessel: ['zauberer', 'sorcerer', 'hexer'],
    name: 'Zauberer',
    nameEn: 'Sorcerer',
    rettungswuerfe: ['CON', 'CHA'],
    schlitze: fullCasterSlots,
    merkmale: [
      { stufe: 1, herkunft: 'CLASS', name: 'Zauberei', description: 'CHA-basiertes Zaubern. Angriffswurf: +PB+CHA-Mod. Rettungs-SG: 8+PB+CHA-Mod.' },
      { stufe: 1, herkunft: 'CLASS', name: 'Zauberhafter Ursprung', description: 'Unterklasse wählen — bestimmt die Quelle deiner arkanen Kraft.' },
      { stufe: 2, herkunft: 'CLASS', name: 'Magische Quelle', description: 'Zauberpunkte = Stufe. Bonusaktion, 1×/Runde. Schlitz erzeugen: 1.→2 ZP · 2.→3 · 3.→5 · 4.→6 · 5.→7 ZP. Schlitz aufgeben → ZP in Höhe seines Rangs gewinnen.' },
      { stufe: 3, herkunft: 'CLASS', name: 'Metamagie', description: '2 Metamagie-Optionen wählen (z.B. Weitreichend, Zwillingszauber, Kraftvoll). Kosten: 1–2 Zauberpunkte.' },
      { stufe: 4, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2 auf ein Attribut oder +1 auf zwei (max. 20), oder ein Talent.' },
      { stufe: 8, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2 auf ein Attribut oder +1 auf zwei (max. 20), oder ein Talent.' },
      { stufe: 10, herkunft: 'CLASS', name: 'Metamagie (zusätzlich)', description: 'Weitere Metamagie-Option.' },
      { stufe: 12, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2 auf ein Attribut oder +1 auf zwei (max. 20), oder ein Talent.' },
      { stufe: 16, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2 auf ein Attribut oder +1 auf zwei (max. 20), oder ein Talent.' },
      { stufe: 17, herkunft: 'CLASS', name: 'Metamagie (zusätzlich)', description: 'Weitere Metamagie-Option.' },
      { stufe: 19, herkunft: 'CLASS', name: 'Attributsteigerung (Epos)', description: '+2 auf ein Attribut oder +1 auf zwei (kein 20er-Limit).' },
      { stufe: 20, herkunft: 'CLASS', name: 'Magische Wiederherstellung', description: 'Nach kurzer Rast: 4 Zauberpunkte zurückgewinnen.' },
    ],
    ressourcen: (stufe) => stufe >= 2
      ? [{ name: 'Zauberpunkte', max: stufe, current: stufe, recharge: 'LONG_REST' }]
      : [],
    unterklassen: [
      {
        schluessel: ['drakonisch', 'draconic', 'draconic bloodline', 'drakonisches blut', 'drakonische abstammung', 'drakonische blutlinie'],
        name: 'Drakonische Abstammung',
        nameEn: 'Draconic Sorcerer',
        merkmale: [
          { stufe: 1, herkunft: 'SUBCLASS', name: 'Drachenahnherr', description: 'Drachen-Vorfahren-Typ wählen (Farbe/Metall → Schadenstyp). Drakonisch als Bonussprache.' },
          { stufe: 1, herkunft: 'SUBCLASS', name: 'Drakonische Belastbarkeit', description: 'LP: +1 pro Stufe (retrospektiv). RK: 13 + GES-Mod wenn du keine Rüstung trägst.' },
          { stufe: 6, herkunft: 'SUBCLASS', name: 'Elementare Affinität', description: 'Schaden vom Drachen-Typ: +CHA-Mod. 1 Zauberpunkt ausgeben → 1 Stunde Resistenz gegen diesen Typ.' },
          { stufe: 14, herkunft: 'SUBCLASS', name: 'Drakonische Flügel', description: 'Bonus-Aktion: Drachenflügel entfalten → Fluggeschwindigkeit = Gehgeschwindigkeit. Rüstung darf nicht im Weg sein.' },
          { stufe: 18, herkunft: 'SUBCLASS', name: 'Drakonische Präsenz', description: 'Aktion: 6m-Aura, 1 Min. (Konzentration). Feinde WIS-Rettung oder Angst/Bezaubert. Kosten: 5 Zauberpunkte.' },
        ],
      },
      {
        schluessel: ['wilde magie', 'wild magic', 'wilder zauberer', 'wilde magie-quelle'],
        name: 'Wilde Magie',
        nameEn: 'Wild Magic',
        merkmale: [
          { stufe: 1, herkunft: 'SUBCLASS', name: 'Wilde Magieschwingung', description: 'SL kann nach deinem Zaubern (ab Rang 1) einen W20 werfen; bei 1 ein zufälliger Effekt (Tabelle PHB).' },
          { stufe: 1, herkunft: 'SUBCLASS', name: 'Schicksal wenden', description: '1×/Rast (lange Rast): einem anderen Wesen Vorteil auf Angriff, Probe oder Rettungswurf.' },
          { stufe: 6, herkunft: 'SUBCLASS', name: 'Zufällige Magie-Welle', description: 'Wenn keine Wilde-Magie-Welle ausgelöst: SL löst automatisch eine aus (kein Wurf nötig).' },
          { stufe: 14, herkunft: 'SUBCLASS', name: 'Kontrolliertes Chaos', description: 'Bei Wilde-Magie-Welle: 2× W100 würfeln, einen wählen.' },
          { stufe: 18, herkunft: 'SUBCLASS', name: 'Induzierte Welle', description: 'Bonus-Aktion: Wilde-Magie-Welle sofort auslösen.' },
        ],
      },
      {
        schluessel: ['göttliche seele', 'divine soul', 'göttlich'],
        name: 'Göttliche Seele',
        nameEn: 'Divine Soul',
        merkmale: [
          { stufe: 1, herkunft: 'SUBCLASS', name: 'Göttliche Magie', description: 'Klerikerzauber gelten als Zauberer-Zauber für dich. Jeder Zauberliste Affinität wählen → Bonus-Zauber.' },
          { stufe: 1, herkunft: 'SUBCLASS', name: 'Gnadenhafte Berührung', description: 'PB/Langer Rast: Sterbenden Stabilisieren als Aktion (kein Wurf nötig).' },
          { stufe: 6, herkunft: 'SUBCLASS', name: 'Stärkende Energie', description: 'Wenn du einen Heilzauber wirkst: du oder ein Ziel in 1,5m gewinnt TW+CHA-Mod TP.' },
          { stufe: 14, herkunft: 'SUBCLASS', name: 'Schützende Aura', description: 'Bonus-Aktion: 3m-Aura, 1 Min. Verbündete in der Aura: PB auf alle Rettungswürfe.' },
          { stufe: 18, herkunft: 'SUBCLASS', name: 'Heilige Gestalt', description: 'Bonus-Aktion: Flügel (10m Fliegen), Licht-Aura, Immunität Angst/Charm. 1 Min., 1×/langer Rast.' },
        ],
      },
    ],
  },

  // ── Magier (Wizard) ──────────────────────────────────────────────────────
  {
    schluessel: ['magier', 'wizard', 'arkanist'],
    name: 'Magier',
    nameEn: 'Wizard',
    rettungswuerfe: ['INT', 'WIS'],
    schlitze: fullCasterSlots,
    merkmale: [
      { stufe: 1, herkunft: 'CLASS', name: 'Zauberei', description: 'INT-basiertes Zaubern. Angriffswurf: +PB+INT-Mod. Rettungs-SG: 8+PB+INT-Mod.' },
      { stufe: 1, herkunft: 'CLASS', name: 'Arkane Wiederherstellung', description: '1×/Tag nach kurzer Rast: Schlitze mit Gesamt-Rang ≤ Stufe/2 (aufgerundet, max. Rang 5) zurückgewinnen.' },
      { stufe: 2, herkunft: 'CLASS', name: 'Arkane Tradition', description: 'Schulen-Unterklasse wählen (z.B. Beschwörung, Illusion, Verzauberung).' },
      { stufe: 4, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2 auf ein Attribut oder +1 auf zwei (max. 20), oder ein Talent.' },
      { stufe: 8, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2 auf ein Attribut oder +1 auf zwei (max. 20), oder ein Talent.' },
      { stufe: 12, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2 auf ein Attribut oder +1 auf zwei (max. 20), oder ein Talent.' },
      { stufe: 16, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2 auf ein Attribut oder +1 auf zwei (max. 20), oder ein Talent.' },
      { stufe: 18, herkunft: 'CLASS', name: 'Zauberfähigkeit', description: 'Zauber Rang 1–2 ohne Schlitz wirken (je 1×/langer Rast pro Zauber).' },
      { stufe: 19, herkunft: 'CLASS', name: 'Attributsteigerung (Epos)', description: '+2 auf ein Attribut oder +1 auf zwei (kein 20er-Limit).' },
      { stufe: 20, herkunft: 'CLASS', name: 'Signaturzauber', description: 'Zwei Rang-3-Zauber: je 1×/kurze Rast ohne Schlitz wirken.' },
    ],
    ressourcen: () => [],
    unterklassen: [
      {
        schluessel: ['beschwörung', 'conjuration', 'beschwörer'],
        name: 'Schule der Beschwörung',
        nameEn: 'Conjurer',
        merkmale: [
          { stufe: 2, herkunft: 'SUBCLASS', name: 'Beschwörungsgelehrter', description: 'Halb die Zeit für das Kopieren von Beschwörungszaubern; Goldkosten halbiert.' },
          { stufe: 2, herkunft: 'SUBCLASS', name: 'Kleine Beschwörung', description: 'Unbelebten Gegenstand (max. 3 kg, 30 cm) sofort beschwören (keine Schlitze).' },
          { stufe: 6, herkunft: 'SUBCLASS', name: 'Begleitender Reisender', description: 'Teleportation: ein williges Wesen in 1,5m mitnehmen.' },
          { stufe: 10, herkunft: 'SUBCLASS', name: 'Fokussierter Beschwörer', description: 'Konzentration auf Beschwörungszauber: Vorteil auf Konzentrations-Rettungswurf.' },
          { stufe: 14, herkunft: 'SUBCLASS', name: 'Dauerhafte Beschwörung', description: 'Beschworene Kreaturen: WEI-Mod als Bonus auf Angriff+Schaden.' },
        ],
      },
      {
        schluessel: ['evokation', 'evocation', 'evokations', 'evokationsmagier'],
        name: 'Schule der Evokation',
        nameEn: 'Evoker',
        merkmale: [
          { stufe: 2, herkunft: 'SUBCLASS', name: 'Evokationsgelehrter', description: 'Halb Zeit und Gold beim Kopieren von Evokationszaubern.' },
          { stufe: 2, herkunft: 'SUBCLASS', name: 'Formender Zauber', description: 'Evokationszauber: bis zu INT-Mod Kreaturen ausschließen (kein Schaden).' },
          { stufe: 6, herkunft: 'SUBCLASS', name: 'Potenter Zauber', description: 'Evokation Cantrips: INT-Mod zum Schaden hinzufügen (1×/Zug).' },
          { stufe: 10, herkunft: 'SUBCLASS', name: 'Stärkender Zauber', description: 'Einmal pro Zug Schadensrolle wiederholen und höheres Ergebnis behalten.' },
          { stufe: 14, herkunft: 'SUBCLASS', name: 'Überladener Zauber', description: 'Cantrips: INT-Mod zum Schaden (statt normaler Stufe), 1×/Zug.' },
        ],
      },
    ],
  },

  // ── Kleriker (Cleric) ────────────────────────────────────────────────────
  {
    schluessel: ['kleriker', 'cleric', 'priester', 'geistlicher'],
    name: 'Kleriker',
    nameEn: 'Cleric',
    rettungswuerfe: ['WIS', 'CHA'],
    schlitze: fullCasterSlots,
    merkmale: [
      { stufe: 1, herkunft: 'CLASS', name: 'Zauberei', description: 'WEI-basiertes Zaubern. Rettungs-SG: 8+PB+WEI-Mod.' },
      { stufe: 1, herkunft: 'CLASS', name: 'Göttliches Wirken', description: '2×/langer Rast: einen WEI-Check oder Rettungswurf mit Vorteil ablegen.' },
      { stufe: 1, herkunft: 'CLASS', name: 'Göttliche Domäne', description: 'Unterklasse wählen; gewährt Domänen-Zauber und Kanalgottes-Optionen.' },
      { stufe: 2, herkunft: 'CLASS', name: 'Kanalgottes', description: '1×/kurze Rast (mehr ab Stufe 6): Göttliche Energie für Untote Abwehren oder Domänen-Effekte.' },
      { stufe: 4, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2 auf ein Attribut oder +1 auf zwei (max. 20), oder ein Talent.' },
      { stufe: 5, herkunft: 'CLASS', name: 'Göttliche Intervention', description: '1×/langer Rast: Gott um Eingriff bitten (WEI×5 % Chance; ab Stufe 20 immer).' },
      { stufe: 6, herkunft: 'CLASS', name: 'Kanalgottes (2×/Rast)', description: 'Kanalgottes nun 2× pro kurzer Rast nutzbar.' },
      { stufe: 8, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2 auf ein Attribut oder +1 auf zwei (max. 20), oder ein Talent.' },
      { stufe: 10, herkunft: 'CLASS', name: 'Göttliche Intervention (verbessert)', description: 'Göttliche Intervention: immer erfolgreich bei 1×/Woche.' },
      { stufe: 12, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2 auf ein Attribut oder +1 auf zwei (max. 20), oder ein Talent.' },
      { stufe: 16, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2 auf ein Attribut oder +1 auf zwei (max. 20), oder ein Talent.' },
      { stufe: 18, herkunft: 'CLASS', name: 'Kanalgottes (3×/Rast)', description: 'Kanalgottes nun 3× pro kurzer Rast nutzbar.' },
      { stufe: 19, herkunft: 'CLASS', name: 'Attributsteigerung (Epos)', description: '+2 auf ein Attribut oder +1 auf zwei (kein 20er-Limit).' },
    ],
    ressourcen: () => [],
    unterklassen: [
      {
        schluessel: ['leben', 'life', 'lebensdomäne'],
        name: 'Lebensdomäne',
        nameEn: 'Life Domain',
        merkmale: [
          { stufe: 1, herkunft: 'SUBCLASS', name: 'Domänen-Rüstungsprofizienz', description: 'Profizienz mit schwerer Rüstung.' },
          { stufe: 1, herkunft: 'SUBCLASS', name: 'Schüler des Lebens', description: 'Heilzauber heilen 2+Rang zusätzliche TP.' },
          { stufe: 2, herkunft: 'SUBCLASS', name: 'Kanalgottes: Heilung bewahren', description: 'Als Bonus-Aktion: Heilmagie auf andere Kreatur umleiten (Viertel der Heilung).' },
          { stufe: 6, herkunft: 'SUBCLASS', name: 'Gesegnete Heiler', description: 'Wenn du einen Heilzauber wirkst: du selbst gewinnst 2+Rang TP.' },
          { stufe: 8, herkunft: 'SUBCLASS', name: 'Göttlicher Schlag', description: '1×/Zug: Nahkampfangriff +WEI-Mod Strahlen-Schaden (ab Stufe 14: +2×WEI-Mod).' },
          { stufe: 17, herkunft: 'SUBCLASS', name: 'Höchste Heilung', description: 'Bei Heilzaubern: Maximale Würfelzahl (kein Würfeln).' },
        ],
        zauberGrants: [
          { stufe: 1, slug: 'srd_bless' },
          { stufe: 1, slug: 'srd_cure-wounds' },
          { stufe: 3, slug: 'srd_aid' },
          { stufe: 3, slug: 'srd_lesser-restoration' },
          { stufe: 5, slug: 'srd_beacon-of-hope' },
          { stufe: 5, slug: 'srd_revivify' },
          { stufe: 7, slug: 'srd_death-ward' },
          { stufe: 7, slug: 'srd_guardian-of-faith' },
          { stufe: 9, slug: 'srd_mass-cure-wounds' },
          { stufe: 9, slug: 'srd_raise-dead' },
        ],
      },
    ],
  },

  // ── Druide (Druid) ───────────────────────────────────────────────────────
  {
    schluessel: ['druide', 'druid'],
    name: 'Druide',
    nameEn: 'Druid',
    rettungswuerfe: ['INT', 'WIS'],
    schlitze: fullCasterSlots,
    merkmale: [
      { stufe: 1, herkunft: 'CLASS', name: 'Zauberei', description: 'WEI-basiertes Zaubern. Rettungs-SG: 8+PB+WEI-Mod.' },
      { stufe: 1, herkunft: 'CLASS', name: 'Druidische Sprache', description: 'Druidisch sprechen und schreiben.' },
      { stufe: 2, herkunft: 'CLASS', name: 'Wildgestalt', description: '2×/kurze Rast: CR ≤ Stufe/4 (max. CR 1 ab St.4, keine Flieger bis St.8). Bonus-Aktion ab Stufe 2.' },
      { stufe: 2, herkunft: 'CLASS', name: 'Druidenkreis', description: 'Unterklasse wählen.' },
      { stufe: 4, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 4, herkunft: 'CLASS', name: 'Wildgestalt (verbessert)', description: 'CR ≤ Stufe/2. Flugformen bis CR 1 ab Stufe 8.' },
      { stufe: 8, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 12, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 16, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 18, herkunft: 'CLASS', name: 'Zeitloser Körper', description: 'Nicht mehr schneller altern (Magie); Immunität gegen Gift und Krankheit.' },
      { stufe: 18, herkunft: 'CLASS', name: 'Tierzauber', description: 'In Wildgestalt Konzentrationszauber aufrechterhalten.' },
      { stufe: 19, herkunft: 'CLASS', name: 'Attributsteigerung (Epos)', description: '+2/+1, kein 20er-Limit.' },
      { stufe: 20, herkunft: 'CLASS', name: 'Archdruide', description: 'Wildgestalt unbegrenzt oft nutzen.' },
    ],
    ressourcen: () => [],
    unterklassen: [],
  },

  // ── Barde (Bard) ─────────────────────────────────────────────────────────
  {
    schluessel: ['barde', 'bard'],
    name: 'Barde',
    nameEn: 'Bard',
    rettungswuerfe: ['DEX', 'CHA'],
    schlitze: fullCasterSlots,
    merkmale: [
      { stufe: 1, herkunft: 'CLASS', name: 'Zauberei', description: 'CHA-basiertes Zaubern. Rettungs-SG: 8+PB+CHA-Mod.' },
      { stufe: 1, herkunft: 'CLASS', name: 'Bardische Inspiration', description: 'Bonus-Aktion: Kreatur in 18m Inspirations-Würfel geben (W6→…→W12). Anzahl = CHA-Mod/langer Rast.' },
      { stufe: 2, herkunft: 'CLASS', name: 'Alleskönner', description: 'Hälfte PB auf alle Proben ohne Profizienz.' },
      { stufe: 2, herkunft: 'CLASS', name: 'Lied der Rast', description: 'Kurze Rast: Inspirierte können W6 TW-Würfel zurückgewinnen.' },
      { stufe: 3, herkunft: 'CLASS', name: 'Bardenkolleg', description: 'Unterklasse wählen.' },
      { stufe: 3, herkunft: 'CLASS', name: 'Fachwissen', description: '2 Profizienz-Fähigkeiten: Expertise (doppelter PB).' },
      { stufe: 4, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 5, herkunft: 'CLASS', name: 'Fontäne der Inspiration', description: 'Bardische Inspiration zurückgewinnen nach kurzer Rast.' },
      { stufe: 6, herkunft: 'CLASS', name: 'Gegenzauber', description: 'Reaktion: Gegenzauber wirken.' },
      { stufe: 8, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 10, herkunft: 'CLASS', name: 'Magische Geheimnisse', description: '2 Zauber beliebiger Klasse lernen.' },
      { stufe: 12, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 14, herkunft: 'CLASS', name: 'Magische Geheimnisse (zusätzlich)', description: '2 weitere Zauber beliebiger Klasse.' },
      { stufe: 16, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 18, herkunft: 'CLASS', name: 'Magische Geheimnisse (zusätzlich)', description: '2 weitere Zauber beliebiger Klasse.' },
      { stufe: 19, herkunft: 'CLASS', name: 'Attributsteigerung (Epos)', description: '+2/+1, kein 20er-Limit.' },
      { stufe: 20, herkunft: 'CLASS', name: 'Höhere Inspiration', description: 'Bei Initiative: mind. 1 Bardische Inspiration vorhanden.' },
    ],
    ressourcen: (stufe) => {
      const chaMod = 0; // unknown at apply time, user sets CHA separately
      const max = Math.max(1, chaMod);
      return [{ name: 'Bardische Inspiration', max, current: max, recharge: stufe >= 5 ? 'SHORT_REST' : 'LONG_REST' }];
    },
    unterklassen: [],
  },

  // ── Hexenmeister (Warlock) ───────────────────────────────────────────────
  {
    schluessel: ['hexenmeister', 'warlock', 'paktzauberer'],
    name: 'Hexenmeister',
    nameEn: 'Warlock',
    rettungswuerfe: ['WIS', 'CHA'],
    schlitze: pactSlots,
    merkmale: [
      { stufe: 1, herkunft: 'CLASS', name: 'Übernatürlicher Patron', description: 'Unterklasse wählen (Erzfey, Großer Alte, Teufel …).' },
      { stufe: 1, herkunft: 'CLASS', name: 'Paktmagie', description: 'CHA-basiert. Schlitze laden nach kurzer Rast vollständig auf (Höhe je nach Stufe).' },
      { stufe: 2, herkunft: 'CLASS', name: 'Eldritch-Anrufungen', description: '2 Anrufungen wählen (+1 jede gerade Stufe bis max. 8).' },
      { stufe: 3, herkunft: 'CLASS', name: 'Paktgabe', description: 'Pakt der Klinge/Kette/des Tomes wählen.' },
      { stufe: 4, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 8, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 12, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 16, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 19, herkunft: 'CLASS', name: 'Attributsteigerung (Epos)', description: '+2/+1, kein 20er-Limit.' },
      { stufe: 20, herkunft: 'CLASS', name: 'Schöpfungsmagie', description: 'Einige Klassen-Fähigkeiten werden dauerhaft verstärkt (je nach Patron).' },
    ],
    ressourcen: () => [],
    unterklassen: [
      {
        schluessel: ['erzfey', 'archfey', 'fee', 'fey'],
        name: 'Erzfey',
        nameEn: 'Archfey',
        merkmale: [
          { stufe: 1, herkunft: 'SUBCLASS', name: 'Bezaubernde Erscheinung', description: 'Aktion: Kreatur in 9m WEI-Rettung oder Bezaubert (1 Min.). 1×/langer Rast.' },
          { stufe: 1, herkunft: 'SUBCLASS', name: 'Feenhafter Schritt', description: 'Bonus-Aktion: Kurze Teleportation (9m) zu freiem Feld.' },
          { stufe: 6, herkunft: 'SUBCLASS', name: 'Misty Escape', description: 'Reaktion bei Treffer: Teleportation + Unsichtbar bis Ende deines nächsten Zuges. 1×/kurze Rast.' },
          { stufe: 10, herkunft: 'SUBCLASS', name: 'Beguiling Defenses', description: 'Immunität gegen Bezaubert; Reaktion: Bezauberung auf Angreifer ummünzen.' },
          { stufe: 14, herkunft: 'SUBCLASS', name: 'Dark Delirium', description: 'Aktion: Kreatur WEI-Rettung oder Bezaubert/Verängstigt + halluziniert. 1 Min., Konzentration. 1×/kurze Rast.' },
        ],
        zauberGrants: [
          { stufe: 1, slug: 'srd_calm-emotions' },
          { stufe: 1, slug: 'srd_faerie-fire' },
          { stufe: 3, slug: 'srd_misty-step' },
          { stufe: 3, slug: 'srd-2024_phantasmal-force' },
          { stufe: 5, slug: 'srd_blink' },
          { stufe: 5, slug: 'srd_plant-growth' },
          { stufe: 7, slug: 'srd_dominate-beast' },
          { stufe: 7, slug: 'srd_greater-invisibility' },
          { stufe: 9, slug: 'srd_dominate-person' },
          { stufe: 9, slug: 'srd_seeming' },
        ],
      },
      {
        schluessel: ['großer alte', 'great old one', 'ctulhu', 'kosmisch'],
        name: 'Großer Alter',
        nameEn: 'Great Old One',
        merkmale: [
          { stufe: 1, herkunft: 'SUBCLASS', name: 'Erwachtes Verstehen', description: 'Telepathisch mit anderen Wesen in 9m kommunizieren (kein gemeinsames Sprachverständnis nötig).' },
          { stufe: 1, herkunft: 'SUBCLASS', name: 'Entwirrender Verstand', description: 'Bei Rettungswurf gegen Bezaubert oder Angst: PB als Bonus.' },
          { stufe: 6, herkunft: 'SUBCLASS', name: 'Gedankenäquivalenz', description: 'Telepathischer Austausch mit dem Patron verbessert sich.' },
          { stufe: 10, herkunft: 'SUBCLASS', name: 'Gedankenbarriere', description: 'Immunität gegen Gedankenlesen; Reaktion: Schaden an Angreifer bei Gedanken-Eingriff.' },
          { stufe: 14, herkunft: 'SUBCLASS', name: 'Schöpfungsgemeinschaft', description: 'Wenn ein Feind stirbt: Wesen unter Kontrolle des Patrons erscheinen.' },
        ],
        zauberGrants: [
          { stufe: 1, slug: 'srd-2024_dissonant-whispers' },
          { stufe: 1, slug: 'srd_hideous-laughter' },
          { stufe: 3, slug: 'srd_detect-thoughts' },
          { stufe: 3, slug: 'srd-2024_phantasmal-force' },
          { stufe: 5, slug: 'srd_clairvoyance' },
          { stufe: 5, slug: 'srd_black-tentacles' },
          { stufe: 7, slug: 'srd_dominate-beast' },
          { stufe: 7, slug: 'srd_modify-memory' },
          { stufe: 9, slug: 'srd_dominate-person' },
          { stufe: 9, slug: 'srd_seeming' },
        ],
      },
    ],
  },

  // ── Paladin ──────────────────────────────────────────────────────────────
  {
    schluessel: ['paladin', 'heiliger krieger'],
    name: 'Paladin',
    nameEn: 'Paladin',
    rettungswuerfe: ['WIS', 'CHA'],
    schlitze: halfCasterSlots,
    merkmale: [
      { stufe: 1, herkunft: 'CLASS', name: 'Göttlicher Sinn', description: '1+CHA-Mod/langer Rast: Übernatürliche Wesen in 18m erspüren (Aktion).' },
      { stufe: 1, herkunft: 'CLASS', name: 'Handauflegen', description: 'Pool = Stufe×5 TP; TP zuteilen oder Krankheit/Gift heilen.' },
      { stufe: 2, herkunft: 'CLASS', name: 'Kampfstil', description: 'Einen Kampfstil wählen.' },
      { stufe: 2, herkunft: 'CLASS', name: 'Zauberei', description: 'CHA-basiertes Zaubern. Rettungs-SG: 8+PB+CHA-Mod.' },
      { stufe: 2, herkunft: 'CLASS', name: 'Göttlicher Schlag', description: '1×/Zug Bonus-Aktion: +2W8 Strahlungsschaden bei Treffer (steigt mit Stufe).' },
      { stufe: 3, herkunft: 'CLASS', name: 'Eid des Heiligen', description: 'Unterklasse wählen (Hingabe, Rache, Ahnen …); Eidschwur mit Paladinpflichten.' },
      { stufe: 3, herkunft: 'CLASS', name: 'Heilige Gesundheit', description: 'Immunität gegen Krankheiten.' },
      { stufe: 4, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 5, herkunft: 'CLASS', name: 'Mehrangriff', description: '2 Angriffe pro Angriffs-Aktion.' },
      { stufe: 6, herkunft: 'CLASS', name: 'Aura des Schutzes', description: '3m-Aura: Freunde (+ du) +CHA-Mod auf alle Rettungswürfe (min. +1).' },
      { stufe: 8, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 10, herkunft: 'CLASS', name: 'Aura des Mutes', description: '3m-Aura: Freunde können nicht durch Magie verängstigt werden.' },
      { stufe: 11, herkunft: 'CLASS', name: 'Verbesserter Göttlicher Schlag', description: 'Göttlicher Schlag: +3W8 Strahlungsschaden.' },
      { stufe: 12, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 14, herkunft: 'CLASS', name: 'Reinigende Berührung', description: 'CHA-Mod/langer Rast: Zauberbindung mit Handauflegen beenden.' },
      { stufe: 16, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 19, herkunft: 'CLASS', name: 'Attributsteigerung (Epos)', description: '+2/+1, kein 20er-Limit.' },
      { stufe: 20, herkunft: 'CLASS', name: 'Heilige Erscheinung', description: 'Unterklassen-Feature auf Stufe 20.' },
    ],
    ressourcen: () => [],
    unterklassen: [],
  },

  // ── Waldläufer (Ranger) ──────────────────────────────────────────────────
  {
    schluessel: ['waldläufer', 'ranger', 'waldlaufer'],
    name: 'Waldläufer',
    nameEn: 'Ranger',
    rettungswuerfe: ['STR', 'DEX'],
    schlitze: halfCasterSlots,
    merkmale: [
      { stufe: 1, herkunft: 'CLASS', name: 'Bevorzugter Feind', description: '2 Feind-Typen wählen; Vorteil auf Spurensuche und Erinnern.' },
      { stufe: 1, herkunft: 'CLASS', name: 'Naturkundiger', description: '1 Geländetyp wählen: bessere Orientierung und Erkundung.' },
      { stufe: 2, herkunft: 'CLASS', name: 'Kampfstil', description: 'Einen Kampfstil wählen.' },
      { stufe: 2, herkunft: 'CLASS', name: 'Zauberei', description: 'WEI-basiertes Zaubern. Rettungs-SG: 8+PB+WEI-Mod.' },
      { stufe: 3, herkunft: 'CLASS', name: 'Urgewaltsarchiv', description: 'Unterklasse wählen.' },
      { stufe: 3, herkunft: 'CLASS', name: 'Urgewaltige Awareness', description: 'PB/langer Rast: übernatürliche Bedrohungen in Nähe aufspüren.' },
      { stufe: 4, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 5, herkunft: 'CLASS', name: 'Mehrangriff', description: '2 Angriffe pro Angriffs-Aktion.' },
      { stufe: 8, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 10, herkunft: 'CLASS', name: 'Natürliche Verborgenheit', description: 'Sich in natürlichem Gelände verbergen ohne Sichtdeckung.' },
      { stufe: 12, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 14, herkunft: 'CLASS', name: 'Verschwinden', description: 'Jede Runde Bonusaktion: Verstecken.' },
      { stufe: 16, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 18, herkunft: 'CLASS', name: 'Feral Senses', description: 'Unsichtbare Kreaturen nicht ignoriert; 9m-Wahrnehmung ohne Sicht.' },
      { stufe: 19, herkunft: 'CLASS', name: 'Attributsteigerung (Epos)', description: '+2/+1, kein 20er-Limit.' },
      { stufe: 20, herkunft: 'CLASS', name: 'Feind-Vernichter', description: '+2W10 Schaden gegen Bevorzugte Feinde 1×/Zug.' },
    ],
    ressourcen: () => [],
    unterklassen: [],
  },

  // ── Barbar (Barbarian) ───────────────────────────────────────────────────
  {
    schluessel: ['barbar', 'barbarian', 'berserker'],
    name: 'Barbar',
    nameEn: 'Barbarian',
    rettungswuerfe: ['STR', 'CON'],
    schlitze: null,
    merkmale: [
      { stufe: 1, herkunft: 'CLASS', name: 'Raserei', description: '2×/langer Rast (→ ∞ Stufe 20): Bonus-Aktion; +2 STR-Schaden, Resistenz gegen Hieb/Stich/Wucht; dauert 1 Min.' },
      { stufe: 1, herkunft: 'CLASS', name: 'Ungerüstete Verteidigung', description: 'Keine Rüstung: RK = 10 + GES-Mod + KON-Mod.' },
      { stufe: 2, herkunft: 'CLASS', name: 'Rücksichtsloser Angriff', description: 'Vor Angriff ansagen: Vorteil, aber nächster Angriff auf dich auch Vorteil.' },
      { stufe: 2, herkunft: 'CLASS', name: 'Gefahreninstinkt', description: 'Vorteil auf GES-Rettungswürfe gegen sichtbare Fallen/Zaubern. Nicht in Rüstung.' },
      { stufe: 3, herkunft: 'CLASS', name: 'Urweg', description: 'Unterklasse wählen (Berserker, Totem …).' },
      { stufe: 4, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 5, herkunft: 'CLASS', name: 'Mehrangriff', description: '2 Angriffe pro Angriffs-Aktion.' },
      { stufe: 5, herkunft: 'CLASS', name: 'Schneller Bewegung', description: 'Nicht in Rüstung: Geschwindigkeit +3m.' },
      { stufe: 7, herkunft: 'CLASS', name: 'Tierhafter Instinkt', description: 'Nicht überrascht in Raserei; Initiative Vorteil.' },
      { stufe: 8, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 9, herkunft: 'CLASS', name: 'Brutaler kritischer Treffer', description: 'Kritischer Treffer: +1 Schadenwürfel.' },
      { stufe: 11, herkunft: 'CLASS', name: 'Unerbittliche Raserei', description: 'In Raserei auf 0 LP: KON-Rettung SG 10 → 1 LP behalten (Schaden erhöht SG).' },
      { stufe: 12, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 15, herkunft: 'CLASS', name: 'Hartnäckige Wut', description: 'Nichts kann deine Raserei ungewollt beenden (außer du selbst).' },
      { stufe: 16, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 17, herkunft: 'CLASS', name: 'Raserei (4×/Rast)', description: 'Raserei 4× pro langer Rast.' },
      { stufe: 19, herkunft: 'CLASS', name: 'Attributsteigerung (Epos)', description: '+2/+1, kein 20er-Limit.' },
      { stufe: 20, herkunft: 'CLASS', name: 'Urner Kraft', description: 'STR und KON um 4 erhöhen (max. 24).' },
    ],
    ressourcen: (stufe) => {
      const max = stufe < 3 ? 2 : stufe < 6 ? 3 : stufe < 12 ? 4 : stufe < 17 ? 5 : stufe < 20 ? 6 : 999;
      return [{ name: 'Raserei', max: max === 999 ? 99 : max, current: max === 999 ? 99 : max, recharge: 'LONG_REST' }];
    },
    unterklassen: [],
  },

  // ── Kämpfer (Fighter) ────────────────────────────────────────────────────
  {
    schluessel: ['kämpfer', 'fighter', 'krieger', 'kampfer'],
    name: 'Kämpfer',
    nameEn: 'Fighter',
    rettungswuerfe: ['STR', 'CON'],
    schlitze: null,
    merkmale: [
      { stufe: 1, herkunft: 'CLASS', name: 'Kampfstil', description: 'Einen Kampfstil wählen.' },
      { stufe: 1, herkunft: 'CLASS', name: 'Zweiter Atem', description: 'Bonus-Aktion 1×/kurze Rast: 1W10+Stufe TP zurückgewinnen.' },
      { stufe: 2, herkunft: 'CLASS', name: 'Aktionsschwall', description: '1×/kurze Rast: zusätzliche Aktion in deinem Zug.' },
      { stufe: 3, herkunft: 'CLASS', name: 'Martial Archetype', description: 'Unterklasse wählen (Champion, Battle Master, Eldritch Knight …).' },
      { stufe: 4, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 5, herkunft: 'CLASS', name: 'Mehrangriff (2)', description: '2 Angriffe pro Angriffs-Aktion.' },
      { stufe: 6, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 7, herkunft: 'CLASS', name: 'Unterklassen-Merkmal', description: 'Unterklassen-Merkmal auf Stufe 7.' },
      { stufe: 8, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 9, herkunft: 'CLASS', name: 'Unermüdlich', description: '3×/langer Rast: Aktionsschwall ohne Verbrauch nutzen.' },
      { stufe: 10, herkunft: 'CLASS', name: 'Unterklassen-Merkmal', description: 'Unterklassen-Merkmal auf Stufe 10.' },
      { stufe: 11, herkunft: 'CLASS', name: 'Mehrangriff (3)', description: '3 Angriffe pro Angriffs-Aktion.' },
      { stufe: 12, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 13, herkunft: 'CLASS', name: 'Unermüdlich (5×)', description: '5×/langer Rast: Aktionsschwall ohne Verbrauch.' },
      { stufe: 14, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 15, herkunft: 'CLASS', name: 'Unterklassen-Merkmal', description: 'Unterklassen-Merkmal auf Stufe 15.' },
      { stufe: 16, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 17, herkunft: 'CLASS', name: 'Aktionsschwall (2×)', description: 'Aktionsschwall 2× pro kurze Rast.' },
      { stufe: 18, herkunft: 'CLASS', name: 'Unterklassen-Merkmal', description: 'Unterklassen-Merkmal auf Stufe 18.' },
      { stufe: 19, herkunft: 'CLASS', name: 'Attributsteigerung (Epos)', description: '+2/+1, kein 20er-Limit.' },
      { stufe: 20, herkunft: 'CLASS', name: 'Mehrangriff (4)', description: '4 Angriffe pro Angriffs-Aktion.' },
    ],
    ressourcen: (stufe) => [
      { name: 'Zweiter Atem', max: 1, current: 1, recharge: 'SHORT_REST' },
      { name: 'Aktionsschwall', max: stufe >= 17 ? 2 : 1, current: stufe >= 17 ? 2 : 1, recharge: 'SHORT_REST' },
    ],
    unterklassen: [],
  },

  // ── Mönch (Monk) ─────────────────────────────────────────────────────────
  {
    schluessel: ['mönch', 'monk', 'monch'],
    name: 'Mönch',
    nameEn: 'Monk',
    rettungswuerfe: ['STR', 'DEX'],
    schlitze: null,
    merkmale: [
      { stufe: 1, herkunft: 'CLASS', name: 'Ungerüstete Verteidigung', description: 'Keine Rüstung/Schild: RK = 10 + GES-Mod + WEI-Mod.' },
      { stufe: 1, herkunft: 'CLASS', name: 'Kampfkünste', description: 'Ungerüstet oder Mönchswaffe: W4 Schaden. Bonus-Aktion: unbewaffneter Angriff.' },
      { stufe: 2, herkunft: 'CLASS', name: 'Ki', description: 'Ki-Punkte = Stufe/langer Rast. Flurry of Blows (2 unbewaffnet, 1 Ki), Patient Defense (Ausweichen, 1 Ki), Step of the Wind (Dash/Disengage, 1 Ki).' },
      { stufe: 2, herkunft: 'CLASS', name: 'Ungerüstete Bewegung', description: '+3m Geschwindigkeit. Ohne Rüstung/Schild.' },
      { stufe: 3, herkunft: 'CLASS', name: 'Klosterweg', description: 'Unterklasse wählen.' },
      { stufe: 3, herkunft: 'CLASS', name: 'Ablenken von Geschossen', description: 'Reaktion: Wurfwaffen-Schaden um W10+GES/DEX+Stufe reduzieren.' },
      { stufe: 4, herkunft: 'CLASS', name: 'Langsames Fallen', description: 'Reaktion: Stufe×5 Fallschaden vermeiden.' },
      { stufe: 4, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 5, herkunft: 'CLASS', name: 'Mehrangriff', description: '2 Angriffe pro Angriffs-Aktion.' },
      { stufe: 5, herkunft: 'CLASS', name: 'Betäubender Schlag', description: '1 Ki: Nach Treffer KON-Rettung oder Betäubt bis Ende deines nächsten Zuges.' },
      { stufe: 8, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 12, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 16, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 19, herkunft: 'CLASS', name: 'Attributsteigerung (Epos)', description: '+2/+1, kein 20er-Limit.' },
      { stufe: 20, herkunft: 'CLASS', name: 'Perfekte Seele', description: 'Am Beginn jedes Zuges: 4 Ki-Punkte zurückgewinnen.' },
    ],
    ressourcen: (stufe) => [
      { name: 'Ki-Punkte', max: stufe, current: stufe, recharge: 'SHORT_REST' },
    ],
    unterklassen: [],
  },

  // ── Schurke (Rogue) ──────────────────────────────────────────────────────
  {
    schluessel: ['schurke', 'rogue', 'dieb'],
    name: 'Schurke',
    nameEn: 'Rogue',
    rettungswuerfe: ['DEX', 'INT'],
    schlitze: null,
    merkmale: [
      { stufe: 1, herkunft: 'CLASS', name: 'Fachwissen', description: '2 Profizienz-Fähigkeiten: Expertise (doppelter PB).' },
      { stufe: 1, herkunft: 'CLASS', name: 'Heimtückischer Angriff', description: '1×/Zug +1W6 Schaden wenn Vorteil oder Verbündeter benachbart (steigt alle 2 Stufen).' },
      { stufe: 1, herkunft: 'CLASS', name: 'Gaunersprache', description: 'Geheimsprache der Unterwelt.' },
      { stufe: 2, herkunft: 'CLASS', name: 'Schlaues Handeln', description: 'Bonus-Aktion: Ausweichen, Angriff (Armbrust/Hand), Dash, Verstecken oder Interagieren.' },
      { stufe: 3, herkunft: 'CLASS', name: 'Roguish Archetype', description: 'Unterklasse wählen (Dieb, Assassine, Arcane Trickster …).' },
      { stufe: 3, herkunft: 'CLASS', name: 'Schadensminimierung', description: 'GES-Rettungswürfe mit Profizienz: Bei Erfolg kein Schaden; bei Fehlschlag halber Schaden.' },
      { stufe: 4, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 5, herkunft: 'CLASS', name: 'Unheimliche Ausweichung', description: 'Reaktion: Angreifer-Schaden halbieren.' },
      { stufe: 6, herkunft: 'CLASS', name: 'Fachwissen (zusätzlich)', description: '2 weitere Expertise-Fähigkeiten.' },
      { stufe: 7, herkunft: 'CLASS', name: 'Bedrohungsbewusstsein', description: 'Nicht überrascht wenn nicht kampfunfähig.' },
      { stufe: 8, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 10, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 11, herkunft: 'CLASS', name: 'Zuverlässiges Talent', description: 'Profizienz-Würfe: min. 10 auf dem Würfel.' },
      { stufe: 12, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 14, herkunft: 'CLASS', name: 'Blindes Gespür', description: '6m Blindsicht (kein Sehen/Hören nötig).' },
      { stufe: 16, herkunft: 'CLASS', name: 'Attributsteigerung', description: '+2/+1 oder Talent.' },
      { stufe: 18, herkunft: 'CLASS', name: 'Schwer zu fassen', description: 'In jedem Zug: Schlaues Handeln kostenlos nutzen.' },
      { stufe: 19, herkunft: 'CLASS', name: 'Attributsteigerung (Epos)', description: '+2/+1, kein 20er-Limit.' },
      { stufe: 20, herkunft: 'CLASS', name: 'Schlagkraft', description: '1×/Zug Heim. Angriff ohne Vorteil/Verbündeten (sofern kein Nachteil).' },
    ],
    ressourcen: () => [],
    unterklassen: [],
  },
];

// ── Lookup helpers ─────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().trim()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');
}

export function findClass(name: string): ClassDef | undefined {
  const q = normalize(name);
  return KLASSEN.find(k => k.schluessel.some(s => normalize(s) === q || normalize(s).includes(q) || q.includes(normalize(s))));
}

export interface ClassOption {
  label: string;
  sublabel?: string;
  icon?: string;
}

const CLASS_ICONS: Record<string, string> = {
  Barbar: '🪓',
  Barde: '🎵',
  Druide: '🌿',
  Hexenmeister: '👁️',
  Kämpfer: '⚔️',
  Kleriker: '✝️',
  Magier: '📚',
  Mönch: '🥋',
  Paladin: '🛡️',
  Schurke: '🗡️',
  Waldläufer: '🏹',
  Zauberer: '🔮',
};

const SUBCLASS_ICONS: Record<string, string> = {
  'Draconic Sorcerer': '🐉',
  'Wild Magic': '🎲',
  'Divine Soul': '✨',
  Conjurer: '🌀',
  Evoker: '💥',
  'Life Domain': '💚',
};

export function allClassNames(lang?: string): ClassOption[] {
  const opts = lang === 'en'
    ? KLASSEN.map(k => ({ label: k.nameEn, icon: CLASS_ICONS[k.name] }))
    : KLASSEN.map(k => ({ label: k.name, sublabel: k.nameEn, icon: CLASS_ICONS[k.name] }));
  return opts.sort((a, b) => a.label.localeCompare(b.label, lang === 'en' ? 'en' : 'de'));
}

export function subclassesForClass(klasse: string, lang?: string): ClassOption[] {
  const kl = findClass(klasse);
  if (!kl) return [];
  const opts = lang === 'en'
    ? kl.unterklassen.map(u => ({ label: u.nameEn, icon: SUBCLASS_ICONS[u.nameEn] }))
    : kl.unterklassen.map(u => ({ label: u.name, sublabel: u.nameEn, icon: SUBCLASS_ICONS[u.nameEn] }));
  return opts.sort((a, b) => a.label.localeCompare(b.label, lang === 'en' ? 'en' : 'de'));
}

export function findSubclass(kl: ClassDef, name: string): SubclassDef | undefined {
  if (!name.trim()) return undefined;
  const q = normalize(name);
  return kl.unterklassen.find(u => u.schluessel.some(s => normalize(s) === q || normalize(s).includes(q) || q.includes(normalize(s))));
}

// ── Apply class to character ───────────────────────────────────────────────

export function applyClassToCharacter(char: DnDCharacter): DnDCharacter {
  const kl = findClass(char.charClass);
  if (!kl) return char;

  const ukl = findSubclass(kl, char.subclass);
  const stufe = char.level;

  // Build new slot map (keep existing if class has no spells)
  const neueSchlitze = kl.schlitze ? kl.schlitze(stufe) : char.spellSlots;

  // Merge saving throw proficiencies (add, never remove)
  const neueRettungen = Array.from(new Set([...char.saveProficiencies, ...kl.rettungswuerfe]));

  // Build features: remove CLASS/SUBCLASS, then add up to current level
  const bestehende = char.features.filter(m => m.origin !== 'CLASS' && m.origin !== 'SUBCLASS');
  const klasseMerkmale: Omit<DnDFeature, 'id'>[] = [
    ...kl.merkmale.filter(m => m.stufe <= stufe).map(m => ({ name: m.name, description: m.description, origin: m.herkunft as 'CLASS' | 'SUBCLASS' })),
    ...(ukl ? ukl.merkmale.filter(m => m.stufe <= stufe).map(m => ({ name: m.name, description: m.description, origin: m.herkunft as 'CLASS' | 'SUBCLASS' })) : []),
  ];
  const neueMerkmale: DnDFeature[] = [
    ...bestehende,
    ...klasseMerkmale.map(m => ({ ...m, id: newId() })),
  ];

  // Resources: update by name, add new ones
  const defRes = kl.ressourcen(stufe);
  const aktRessourcen = [...char.resources];
  for (const r of defRes) {
    const idx = aktRessourcen.findIndex(x => x.name === r.name);
    if (idx >= 0) {
      aktRessourcen[idx] = { ...aktRessourcen[idx], max: r.max, recharge: r.recharge };
    } else {
      aktRessourcen.push({ ...r, id: newId() });
    }
  }

  // Spell grants: only replace CLASS/SUBCLASS spells when the class/subclass
  // actually defines zauberGrants — otherwise leave the user's spell list alone.
  const grants: { stufe: number; slug: string; origin: 'CLASS' | 'SUBCLASS' }[] = [
    ...(kl.zauberGrants ?? []).map(g => ({ ...g, origin: 'CLASS' as const })),
    ...(ukl?.zauberGrants ?? []).map(g => ({ ...g, origin: 'SUBCLASS' as const })),
  ];
  const neueZauber: DnDSpell[] = grants.length > 0
    ? (() => {
        const basis = char.spells.filter(z => z.origin !== 'CLASS' && z.origin !== 'SUBCLASS');
        for (const g of grants) {
          if (g.stufe > stufe) continue;
          const eintrag = spellNachSlug(g.slug);
          if (!eintrag) continue;
          basis.push({
            id: newId(),
            name: eintrag.nameDe,
            nameEn: eintrag.name,
            level: eintrag.stufe,
            school: eintrag.schule,
            origin: g.origin,
            action: eintrag.aktion as ActionType,
            concentration: eintrag.konzentration,
            description: eintrag.beschreibung,
            components: eintrag.komponenten,
            range: eintrag.reichweite,
            isHomebrew: eintrag.isHomebrew,
            slug: eintrag.slug,
          });
        }
        return basis;
      })()
    : char.spells;

  return {
    ...char,
    spellSlots: neueSchlitze,
    saveProficiencies: neueRettungen as AbilityKey[],
    features: neueMerkmale,
    resources: aktRessourcen,
    spells: neueZauber,
  };
}

export interface ClassPreview {
  erkannt: boolean;
  klasseName: string;
  unterklasseName: string;
  unterklasseErkannt: boolean;
  merkmaleAnzahl: number;
  ressourcenAnzahl: number;
  hatSchlitze: boolean;
}

export function classPreview(klasse: string, unterklasse: string, stufe: number, lang?: string): ClassPreview {
  const kl = findClass(klasse);
  if (!kl) return { erkannt: false, klasseName: klasse, unterklasseName: unterklasse, unterklasseErkannt: false, merkmaleAnzahl: 0, ressourcenAnzahl: 0, hatSchlitze: false };
  const ukl = findSubclass(kl, unterklasse);
  const mAnz = kl.merkmale.filter(m => m.stufe <= stufe).length + (ukl ? ukl.merkmale.filter(m => m.stufe <= stufe).length : 0);
  const rAnz = kl.ressourcen(stufe).length;
  return {
    erkannt: true,
    klasseName: lang === 'en' ? kl.nameEn : kl.name,
    unterklasseName: ukl ? (lang === 'en' ? ukl.nameEn : ukl.name) : unterklasse,
    unterklasseErkannt: !!ukl,
    merkmaleAnzahl: mAnz,
    ressourcenAnzahl: rAnz,
    hatSchlitze: !!kl.schlitze,
  };
}

// ── Class level progression ────────────────────────────────────────────────

export interface ClassLevelGroup {
  level: number;
  features: FeatureDef[];
}

export function classLevelProgression(klasse: string, unterklasse: string): ClassLevelGroup[] {
  const kl = findClass(klasse);
  if (!kl) return [];
  const uk = unterklasse ? findSubclass(kl, unterklasse) : undefined;
  const all: FeatureDef[] = [...kl.merkmale, ...(uk ? uk.merkmale : [])];
  const groups: ClassLevelGroup[] = [];
  for (let lvl = 1; lvl <= 20; lvl++) {
    const features = all.filter(x => x.stufe === lvl);
    if (features.length > 0) groups.push({ level: lvl, features });
  }
  return groups;
}

// ── Metamagic options (SRD 5.1) ───────────────────────────────────────────

export interface MetamagicOption {
  name: string;
  nameEn: string;
  cost: number | 'variabel';
  description: string;
}

export const METAMAGIC_OPTIONS: MetamagicOption[] = [
  {
    name: 'Vorsichtiger Zauber',
    nameEn: 'Careful Spell',
    cost: 1,
    description: '1 ZP: Bis zu CHA-Mod Kreaturen automatisch bestehen den Rettungswurf des Zaubers.',
  },
  {
    name: 'Weitreichender Zauber',
    nameEn: 'Distant Spell',
    cost: 1,
    description: '1 ZP: Reichweite des Zaubers verdoppeln. Berührungszauber erhalten Reichweite 9 m.',
  },
  {
    name: 'Ermächtigter Zauber',
    nameEn: 'Empowered Spell',
    cost: 1,
    description: '1 ZP: Bis zu CHA-Mod Schadenswürfel einmal neu würfeln (niedrigsten Wert nehmen). Kombinierbar mit anderer Metamagie.',
  },
  {
    name: 'Verlängerter Zauber',
    nameEn: 'Extended Spell',
    cost: 1,
    description: '1 ZP: Zauberdauer von 1 Min. auf 10 Min., von 10 Min. auf 1 Std., von 1 Std. auf 8 Std. verdoppeln.',
  },
  {
    name: 'Erhöhter Zauber',
    nameEn: 'Heightened Spell',
    cost: 3,
    description: '3 ZP: Ein Ziel hat Nachteil auf seinen ersten Rettungswurf gegen diesen Zauber.',
  },
  {
    name: 'Beschleunigter Zauber',
    nameEn: 'Quickened Spell',
    cost: 2,
    description: '2 ZP: Wirkungszeit von Aktion auf Bonusaktion reduzieren.',
  },
  {
    name: 'Subtiler Zauber',
    nameEn: 'Subtle Spell',
    cost: 1,
    description: '1 ZP: Zauber ohne verbale und gestische Komponenten wirken.',
  },
  {
    name: 'Zwillingszauber',
    nameEn: 'Twinned Spell',
    cost: 'variabel',
    description: 'X ZP (X = Rang des Zaubers, Zaubertrick = 1): Einzelziel-Zauber auf ein zweites Ziel ausweiten.',
  },
];
