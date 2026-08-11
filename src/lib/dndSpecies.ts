import type { DnDCharacter, DnDFeature } from "../types/dnd";
import { newId } from "./dndGame";

// ── Type definitions ───────────────────────────────────────────────────────

export interface SpeziesMerkmalDef {
  stufe: number;
  name: string;
  nameEn: string;
  beschreibung: string;
  beschreibungEn: string;
}

export interface SpeziesDef {
  schluessel: string[];
  name: string;
  nameEn: string;
  merkmale: SpeziesMerkmalDef[];
}

// ── Species definitions (D&D 2024 PHB) ────────────────────────────────────

const SPEZIES: SpeziesDef[] = [

  // ── Dragonborn ────────────────────────────────────────────────────────────
  {
    schluessel: ['dragonborn', 'drachenvolk', 'drachenmensch', 'draconid'],
    name: 'Drachenvolk',
    nameEn: 'Dragonborn',
    merkmale: [
      {
        stufe: 1,
        name: 'Drachenahnherr',
        nameEn: 'Draconic Ancestry',
        beschreibung: 'Wähle einen Drachentyp (Farbe oder Metall) → legt Schadenstyp und Form der Atemwaffe fest (Kegel 4,5 m oder Linie 9×1,5 m). Drakonisch als Bonussprache.',
        beschreibungEn: 'Choose a dragon type (color or metal) → determines damage type and breath weapon shape (15 ft cone or 30×5 ft line). Draconic as a bonus language.',
      },
      {
        stufe: 1,
        name: 'Atemwaffe',
        nameEn: 'Breath Weapon',
        beschreibung: 'Bonus-Aktion: Atem ausstoßen. Schaden: 1W10 (Stufe 1–4) · 2W10 (5–10) · 3W10 (11–16) · 4W10 (17–20). GES-Rettungswurf SG 8+PB+KON-Mod, halber Schaden bei Erfolg. Nutzungen: PB/langer Rast (min. 1×).',
        beschreibungEn: 'Bonus action: exhale destructive energy. Damage: 1d10 (levels 1–4) · 2d10 (5–10) · 3d10 (11–16) · 4d10 (17–20). DEX save DC 8+PB+CON mod, half damage on success. Uses: PB/long rest (minimum 1).',
      },
      {
        stufe: 1,
        name: 'Drakonische Resistenz',
        nameEn: 'Draconic Resistance',
        beschreibung: 'Resistenz gegen den Schadenstyp deines Drachenahnherrn.',
        beschreibungEn: 'Resistance to the damage type of your Draconic Ancestry.',
      },
      {
        stufe: 1,
        name: 'Dunkelsicht',
        nameEn: 'Darkvision',
        beschreibung: 'Dunkelsicht 18 m (60 ft). In Dunkelheit: gedimmtes Licht. In gedimmtem Licht: normales Licht.',
        beschreibungEn: 'Darkvision 60 ft. In darkness: dim light. In dim light: normal light.',
      },
      {
        stufe: 5,
        name: 'Drakonischer Flug',
        nameEn: 'Draconic Flight',
        beschreibung: 'Bonus-Aktion: Spektralflügel sprießen. Fluggeschwindigkeit = Gehgeschwindigkeit, Schweben möglich. Hält an bis du sie als Bonus-Aktion einziehst oder kampfunfähig wirst. 1×/langer Rast.',
        beschreibungEn: 'Bonus action: spectral wings sprout from your back. Fly speed equals your walking speed, you can hover. Lasts until you retract them as a bonus action or become incapacitated. 1/long rest.',
      },
      {
        stufe: 13,
        name: 'Drakonische Apotheose',
        nameEn: 'Draconic Apotheosis',
        beschreibung: 'Wähle einen permanenten Bonus: (A) Unter Wasser atmen + Schwimmgeschwindigkeit 9 m · (B) Resistenz gegen einen zweiten Schadenstyp · (C) Dunkelsicht auf 36 m (120 ft) erhöhen.',
        beschreibungEn: 'Choose a permanent benefit: (A) Breathe underwater + swim speed 30 ft · (B) Resistance to a second damage type · (C) Increase darkvision to 120 ft.',
      },
    ],
  },

  // ── Aasimar ───────────────────────────────────────────────────────────────
  {
    schluessel: ['aasimar', 'gottgesegneter', 'celestial'],
    name: 'Aasimar',
    nameEn: 'Aasimar',
    merkmale: [
      {
        stufe: 1,
        name: 'Himmlische Resistenz',
        nameEn: 'Celestial Resistance',
        beschreibung: 'Resistenz gegen Strahlungs- und Nekroseschaden.',
        beschreibungEn: 'Resistance to radiant and necrotic damage.',
      },
      {
        stufe: 1,
        name: 'Dunkelsicht',
        nameEn: 'Darkvision',
        beschreibung: 'Dunkelsicht 18 m (60 ft).',
        beschreibungEn: 'Darkvision 60 ft.',
      },
      {
        stufe: 1,
        name: 'Heilende Hände',
        nameEn: 'Healing Hands',
        beschreibung: 'Bonus-Aktion: Lebewesen berühren → PB×W4 Trefferpunkte heilen. 1×/langer Rast.',
        beschreibungEn: 'Bonus action: touch a creature → heal PB×d4 hit points. 1/long rest.',
      },
      {
        stufe: 1,
        name: 'Lichtträger',
        nameEn: 'Light Bearer',
        beschreibung: 'Kennst den Zaubertrick Licht. Zaubermerkmal: CHA.',
        beschreibungEn: 'You know the Light cantrip. Spellcasting ability: CHA.',
      },
      {
        stufe: 3,
        name: 'Himmlische Offenbarung',
        nameEn: 'Celestial Revelation',
        beschreibung: 'Bonus-Aktion 1×/langer Rast (1 Min.): Wähle eine Erscheinungsform — (A) Himmelsschwingen: Fluggeschwindigkeit = Gehgeschwindigkeit · (B) Innerer Glanz: 3 m-Lichtaura, Strahlungsschaden +PB 1×/Zug · (C) Nekrotische Hülle: Feinde in 3 m KON-Rettung oder Angst, Nekroseschaden +PB 1×/Zug.',
        beschreibungEn: 'Bonus action 1/long rest (1 min): Choose a form — (A) Heavenly Wings: fly speed equals walking speed · (B) Inner Radiance: 10 ft light aura, radiant damage +PB 1/turn · (C) Necrotic Shroud: enemies within 10 ft CON save or frightened, necrotic damage +PB 1/turn.',
      },
    ],
  },

  // ── Zwerg (Dwarf) ─────────────────────────────────────────────────────────
  {
    schluessel: ['dwarf', 'zwerg', 'zwergin'],
    name: 'Zwerg',
    nameEn: 'Dwarf',
    merkmale: [
      {
        stufe: 1,
        name: 'Dunkelsicht',
        nameEn: 'Darkvision',
        beschreibung: 'Dunkelsicht 36 m (120 ft).',
        beschreibungEn: 'Darkvision 120 ft.',
      },
      {
        stufe: 1,
        name: 'Zwergenresistenz',
        nameEn: 'Dwarven Resilience',
        beschreibung: 'Vorteil auf Rettungswürfe gegen Gift und Resistenz gegen Giftschaden.',
        beschreibungEn: 'Advantage on saving throws against poison and resistance to poison damage.',
      },
      {
        stufe: 1,
        name: 'Zwergenausdauer',
        nameEn: 'Dwarven Toughness',
        beschreibung: '+1 Trefferpunkt pro Charakterstufe (retrospektiv angewandt).',
        beschreibungEn: '+1 hit point per character level (applied retroactively).',
      },
      {
        stufe: 1,
        name: 'Steinwahrnehmung',
        nameEn: 'Stonecunning',
        beschreibung: 'Bonus-Aktion: Erschütterungssinn 18 m (60 ft) für 10 Min. aktivieren. Nutzungen: PB/langer Rast.',
        beschreibungEn: 'Bonus action: gain tremorsense 60 ft for 10 minutes. Uses: PB/long rest.',
      },
    ],
  },

  // ── Elf ───────────────────────────────────────────────────────────────────
  {
    schluessel: ['elf', 'elfe', 'elfin', 'drow', 'hochelf', 'waldelf'],
    name: 'Elf',
    nameEn: 'Elf',
    merkmale: [
      {
        stufe: 1,
        name: 'Dunkelsicht',
        nameEn: 'Darkvision',
        beschreibung: 'Dunkelsicht 18 m (60 ft).',
        beschreibungEn: 'Darkvision 60 ft.',
      },
      {
        stufe: 1,
        name: 'Elfische Abstammung',
        nameEn: 'Elven Lineage',
        beschreibung: 'Wähle eine Linie: (A) Dunkelelf: Zaubertrick Tanzende Lichter, KON-Profizienz · (B) Hochelf: Zaubertrick der Wahl (INT) · (C) Waldelf: Zaubertrick Druidentrank, +1,5 m Geschwindigkeit.',
        beschreibungEn: 'Choose a lineage: (A) Drow: Dancing Lights cantrip, CON proficiency · (B) High Elf: cantrip of choice (INT) · (C) Wood Elf: Druidcraft cantrip, +5 ft speed.',
      },
      {
        stufe: 1,
        name: 'Feenwesen-Abstammung',
        nameEn: 'Fey Ancestry',
        beschreibung: 'Vorteil auf Rettungswürfe gegen den Bezaubert-Zustand. Magie kann dich nicht in Schlaf versetzen.',
        beschreibungEn: 'Advantage on saving throws against the charmed condition. Magic can\'t put you to sleep.',
      },
      {
        stufe: 1,
        name: 'Geschärfte Sinne',
        nameEn: 'Keen Senses',
        beschreibung: 'Profizienz in Wahrnehmung.',
        beschreibungEn: 'Proficiency in Perception.',
      },
      {
        stufe: 1,
        name: 'Trance',
        nameEn: 'Trance',
        beschreibung: 'Brauchst nur 4 Stunden meditativen Ruhezustand für einen langen Rast. Bleibst in der Trance voll bewusst.',
        beschreibungEn: 'You only need 4 hours of meditative rest for a long rest. You remain fully aware during your trance.',
      },
      {
        stufe: 3,
        name: 'Elfische Abstammung: Rang-1-Zauber',
        nameEn: 'Elven Lineage: 1st-Level Spell',
        beschreibung: 'Je nach Linie: Dunkelelf → Feenfeuer · Hochelf → Identify · Waldelf → Langstrider. 1×/langer Rast ohne Schlitz.',
        beschreibungEn: 'By lineage: Drow → Faerie Fire · High Elf → Identify · Wood Elf → Longstrider. 1/long rest without a spell slot.',
      },
      {
        stufe: 5,
        name: 'Elfische Abstammung: Rang-2-Zauber',
        nameEn: 'Elven Lineage: 2nd-Level Spell',
        beschreibung: 'Je nach Linie: Dunkelelf → Dunkelheit · Hochelf → Detect Thoughts · Waldelf → Pass Without Trace. 1×/langer Rast ohne Schlitz.',
        beschreibungEn: 'By lineage: Drow → Darkness · High Elf → Detect Thoughts · Wood Elf → Pass Without Trace. 1/long rest without a spell slot.',
      },
    ],
  },

  // ── Gnom (Gnome) ──────────────────────────────────────────────────────────
  {
    schluessel: ['gnome', 'gnom', 'gnöm'],
    name: 'Gnom',
    nameEn: 'Gnome',
    merkmale: [
      {
        stufe: 1,
        name: 'Dunkelsicht',
        nameEn: 'Darkvision',
        beschreibung: 'Dunkelsicht 18 m (60 ft).',
        beschreibungEn: 'Darkvision 60 ft.',
      },
      {
        stufe: 1,
        name: 'Gnomische Cleverness',
        nameEn: 'Gnomish Cunning',
        beschreibung: 'Vorteil auf INT-, WEI- und CHA-Rettungswürfe gegen Magie.',
        beschreibungEn: 'Advantage on INT, WIS, and CHA saving throws against magic.',
      },
      {
        stufe: 1,
        name: 'Gnomische Abstammung',
        nameEn: 'Gnomish Lineage',
        beschreibung: 'Wähle eine Linie: (A) Waldgnom: Zaubertrick Kleine Illusion, Sprich mit kleinen Tieren 1×/langer Rast · (B) Steingnom: Zaubertrick Reparatur, Profizienz Uhrmacherwerkzeug + Erschütterungssinn 36 m (passiv).',
        beschreibungEn: 'Choose a lineage: (A) Forest Gnome: Minor Illusion cantrip, Speak with Small animals 1/long rest · (B) Rock Gnome: Mending cantrip, Clockmaker\'s Tools proficiency + tremorsense 120 ft (passive).',
      },
      {
        stufe: 3,
        name: 'Gnomische Abstammung: Rang-1-Zauber',
        nameEn: 'Gnomish Lineage: 1st-Level Spell',
        beschreibung: 'Je nach Linie: Waldgnom → Speak with Animals · Steingnom → Alarm. 1×/langer Rast ohne Schlitz.',
        beschreibungEn: 'By lineage: Forest Gnome → Speak with Animals · Rock Gnome → Alarm. 1/long rest without a spell slot.',
      },
      {
        stufe: 5,
        name: 'Gnomische Abstammung: Rang-2-Zauber',
        nameEn: 'Gnomish Lineage: 2nd-Level Spell',
        beschreibung: 'Je nach Linie: Waldgnom → Invisibility · Steingnom → Blur. 1×/langer Rast ohne Schlitz.',
        beschreibungEn: 'By lineage: Forest Gnome → Invisibility · Rock Gnome → Blur. 1/long rest without a spell slot.',
      },
    ],
  },

  // ── Goliath ───────────────────────────────────────────────────────────────
  {
    schluessel: ['goliath', 'riese', 'steinriese'],
    name: 'Goliath',
    nameEn: 'Goliath',
    merkmale: [
      {
        stufe: 1,
        name: 'Riesenabstammung',
        nameEn: 'Giant Ancestry',
        beschreibung: 'Wähle einen Riesentyp → Kraft: (A) Feuerriese: Reaktion, Feuerschaden reduzieren (PB+KON-Mod) · (B) Frostgigant: Nahkampftreffer → Kälteschaden + verlangsamt · (C) Sturmriese: STR-Proben-Bonus; Donner-Nahkampftreffer · (D) Steinriese: Kritischer Treffer → Rückstoß · (E) Wolkenriese: Kleines Objekt levitieren 9 m · (F) Bergriese: Felswurf-Aktion.',
        beschreibungEn: 'Choose a giant type → power: (A) Fire Giant: reaction, reduce fire damage (PB+CON mod) · (B) Frost Giant: melee hit → cold damage + slowed · (C) Storm Giant: STR check bonus; thunder melee hit · (D) Stone Giant: critical hit → knockback · (E) Cloud Giant: levitate small object 30 ft · (F) Hill Giant: boulder toss action.',
      },
      {
        stufe: 1,
        name: 'Große Form',
        nameEn: 'Large Form',
        beschreibung: 'Kannst in Räume für Große Kreaturen eintreten und dort kämpfen.',
        beschreibungEn: 'You can enter and fight in spaces intended for Large creatures.',
      },
      {
        stufe: 1,
        name: 'Kraftvoller Bau',
        nameEn: 'Powerful Build',
        beschreibung: 'Tragekapazität berechnet sich als wärst du Groß (STR×15 statt STR×10 lbs).',
        beschreibungEn: 'Your carrying capacity is calculated as if you were Large (STR×15 instead of STR×10 lbs).',
      },
      {
        stufe: 1,
        name: 'Steinausdauer',
        nameEn: 'Stone\'s Endurance',
        beschreibung: 'Reaktion: W12+KON-Mod Schaden aus einem Treffer reduzieren. Nutzungen: PB/langer Rast.',
        beschreibungEn: 'Reaction: reduce damage from one hit by d12+CON mod. Uses: PB/long rest.',
      },
    ],
  },

  // ── Halbling (Halfling) ───────────────────────────────────────────────────
  {
    schluessel: ['halfling', 'halbling', 'halblingsdame'],
    name: 'Halbling',
    nameEn: 'Halfling',
    merkmale: [
      {
        stufe: 1,
        name: 'Tapfer',
        nameEn: 'Brave',
        beschreibung: 'Vorteil auf Rettungswürfe gegen den Angst-Zustand.',
        beschreibungEn: 'Advantage on saving throws against the frightened condition.',
      },
      {
        stufe: 1,
        name: 'Halblings-Gewandtheit',
        nameEn: 'Halfling Nimbleness',
        beschreibung: 'Kannst dich durch Felder von Kreaturen bewegen, die mindestens eine Größenklasse größer sind.',
        beschreibungEn: 'You can move through the space of any creature that is a size larger than yours.',
      },
      {
        stufe: 1,
        name: 'Glücklich',
        nameEn: 'Lucky',
        beschreibung: 'Wenn du eine 1 auf einem W20-Angriffswurf, einer Probe oder einem Rettungswurf würfelst: würfel erneut und nimm das neue Ergebnis.',
        beschreibungEn: 'When you roll a 1 on a d20 for an attack, ability check, or saving throw: reroll and use the new result.',
      },
      {
        stufe: 1,
        name: 'Natürlich Versteckt',
        nameEn: 'Naturally Stealthy',
        beschreibung: 'Kannst dich hinter Kreaturen verstecken, die mindestens Mittelgroß sind, als wärst du stark verdeckt.',
        beschreibungEn: 'You can attempt to hide even when only obscured by a creature that is at least Medium.',
      },
    ],
  },

  // ── Mensch (Human) ────────────────────────────────────────────────────────
  {
    schluessel: ['human', 'mensch', 'human being'],
    name: 'Mensch',
    nameEn: 'Human',
    merkmale: [
      {
        stufe: 1,
        name: 'Einfallsreich',
        nameEn: 'Resourceful',
        beschreibung: 'Zu Beginn jedes langen Rasts erhältst du Heroische Inspiration (sofern du sie noch nicht hast).',
        beschreibungEn: 'At the start of each long rest, you gain Heroic Inspiration if you don\'t already have it.',
      },
      {
        stufe: 1,
        name: 'Gewandt',
        nameEn: 'Skillful',
        beschreibung: 'Profizienz in einer Fertigkeit deiner Wahl.',
        beschreibungEn: 'Proficiency in one skill of your choice.',
      },
      {
        stufe: 1,
        name: 'Vielseitig',
        nameEn: 'Versatile',
        beschreibung: 'Du erhältst ein Ursprungs-Talent deiner Wahl.',
        beschreibungEn: 'You gain an Origin feat of your choice.',
      },
    ],
  },

  // ── Orc ───────────────────────────────────────────────────────────────────
  {
    schluessel: ['orc', 'ork', 'halborc', 'half-orc'],
    name: 'Orc',
    nameEn: 'Orc',
    merkmale: [
      {
        stufe: 1,
        name: 'Adrenalin-Ansturm',
        nameEn: 'Adrenaline Rush',
        beschreibung: 'Bonus-Aktion: Dash-Aktion ausführen und PB temporäre Trefferpunkte gewinnen. Nutzungen: PB/langer Rast.',
        beschreibungEn: 'Bonus action: take the Dash action and gain PB temporary hit points. Uses: PB/long rest.',
      },
      {
        stufe: 1,
        name: 'Dunkelsicht',
        nameEn: 'Darkvision',
        beschreibung: 'Dunkelsicht 36 m (120 ft).',
        beschreibungEn: 'Darkvision 120 ft.',
      },
      {
        stufe: 1,
        name: 'Unerbittliche Ausdauer',
        nameEn: 'Relentless Endurance',
        beschreibung: '1×/langer Rast: Wenn du auf 0 TP sinken würdest, bleibst du stattdessen bei 1 TP.',
        beschreibungEn: '1/long rest: When you would be reduced to 0 hit points, drop to 1 hit point instead.',
      },
    ],
  },

  // ── Teuflisch (Tiefling) ──────────────────────────────────────────────────
  {
    schluessel: ['tiefling', 'teuflisch', 'tiefblüter', 'halbdämon'],
    name: 'Teuflisch',
    nameEn: 'Tiefling',
    merkmale: [
      {
        stufe: 1,
        name: 'Dunkelsicht',
        nameEn: 'Darkvision',
        beschreibung: 'Dunkelsicht 18 m (60 ft).',
        beschreibungEn: 'Darkvision 60 ft.',
      },
      {
        stufe: 1,
        name: 'Teuflisches Erbe',
        nameEn: 'Fiendish Legacy',
        beschreibung: 'Wähle eine Abstammung: (A) Abyssal: Resistenz Säurescahden, Zaubertrick Gift-Spray · (B) Chthonisch: Resistenz Nekroseschaden, Zaubertrick Eisiger Griff · (C) Höllisch: Resistenz Feuerschaden, Zaubertrick Thaumaturgie. Zaubermerkmal: CHA.',
        beschreibungEn: 'Choose a legacy: (A) Abyssal: acid resistance, Poison Spray cantrip · (B) Chthonic: necrotic resistance, Chill Touch cantrip · (C) Infernal: fire resistance, Thaumaturgy cantrip. Spellcasting ability: CHA.',
      },
      {
        stufe: 1,
        name: 'Außerweltliche Präsenz',
        nameEn: 'Otherworldly Presence',
        beschreibung: 'Kennst den Zaubertrick Thaumaturgie. Zaubermerkmal: CHA.',
        beschreibungEn: 'You know the Thaumaturgy cantrip. Spellcasting ability: CHA.',
      },
      {
        stufe: 3,
        name: 'Teuflisches Erbe: Rang-1-Zauber',
        nameEn: 'Fiendish Legacy: 1st-Level Spell',
        beschreibung: 'Je nach Abstammung: Abyssal → Hellish Rebuke (Säure) · Chthonisch → False Life · Höllisch → Hellish Rebuke (Feuer). 1×/langer Rast ohne Schlitz.',
        beschreibungEn: 'By legacy: Abyssal → Hellish Rebuke (acid) · Chthonic → False Life · Infernal → Hellish Rebuke (fire). 1/long rest without a spell slot.',
      },
      {
        stufe: 5,
        name: 'Teuflisches Erbe: Rang-2-Zauber',
        nameEn: 'Fiendish Legacy: 2nd-Level Spell',
        beschreibung: 'Je nach Abstammung: Abyssal → Darkness · Chthonisch → Ray of Enfeeblement · Höllisch → Darkness. 1×/langer Rast ohne Schlitz.',
        beschreibungEn: 'By legacy: Abyssal → Darkness · Chthonic → Ray of Enfeeblement · Infernal → Darkness. 1/long rest without a spell slot.',
      },
    ],
  },
];

// ── Lookup helpers ─────────────────────────────────────────────────────────

function normalisiere(s: string): string {
  return s.toLowerCase().trim()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');
}

export function findSpecies(name: string): SpeziesDef | undefined {
  if (!name.trim()) return undefined;
  const q = normalisiere(name);
  return SPEZIES.find(sp =>
    sp.schluessel.some(s => {
      const n = normalisiere(s);
      return n === q || n.includes(q) || q.includes(n);
    }),
  );
}

export interface SpeciesOption {
  label: string;
  sublabel?: string;
  icon?: string;
}

const SPECIES_ICONS: Record<string, string> = {
  Aasimar: '😇',
  Drachenvolk: '🐉',
  Zwerg: '⛏️',
  Elf: '🌟',
  Gnom: '🔧',
  Goliath: '🏔️',
  Halbling: '🍀',
  Mensch: '👤',
  Ork: '💪',
  Tiefling: '😈',
};

export function allSpeciesNames(lang?: string): SpeciesOption[] {
  const opts = lang === 'en'
    ? SPEZIES.map(sp => ({ label: sp.nameEn, icon: SPECIES_ICONS[sp.name] }))
    : SPEZIES.map(sp => ({ label: sp.name, sublabel: sp.nameEn, icon: SPECIES_ICONS[sp.name] }));
  return opts.sort((a, b) => a.label.localeCompare(b.label, lang === 'en' ? 'en' : 'de'));
}

// ── Level progression for roadmap ─────────────────────────────────────────

export interface SpeciesLevelGroup {
  level: number;
  features: SpeziesMerkmalDef[];
}

export function speciesLevelProgression(spezies: string): SpeciesLevelGroup[] {
  const sp = findSpecies(spezies);
  if (!sp) return [];
  const groups: SpeciesLevelGroup[] = [];
  for (let lvl = 1; lvl <= 20; lvl++) {
    const features = sp.merkmale.filter(m => m.stufe === lvl);
    if (features.length > 0) groups.push({ level: lvl, features });
  }
  return groups;
}

// ── Apply species to character ─────────────────────────────────────────────

export function applySpeciesToCharacter(char: DnDCharacter): DnDCharacter {
  const sp = findSpecies(char.rasse);
  if (!sp) return char;

  const existing = char.merkmale.filter(m => m.herkunft !== 'SPECIES');
  const newFeatures: DnDFeature[] = sp.merkmale
    .filter(m => m.stufe <= char.stufe)
    .map(m => ({
      id: newId(),
      name: m.name,
      nameEn: m.nameEn,
      description: m.beschreibung,
      descriptionEn: m.beschreibungEn,
      herkunft: 'SPECIES' as const,
    }));

  return {
    ...char,
    merkmale: [...existing, ...newFeatures],
  };
}
