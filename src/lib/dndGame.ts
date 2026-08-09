import type { AbilityKey, DnDCharakter, HerkunftArt } from "../types/dnd";

export function attributMod(wert: number): number {
  return Math.floor((wert - 10) / 2);
}

export function proficiencyBonus(stufe: number): number {
  return Math.ceil(stufe / 4) + 1;
}

export function modDisplay(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function newId(): string {
  return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

export interface DnDSkillDef {
  id: string;
  name: string;
  attribut: AbilityKey;
}

export const DND_SKILLS: DnDSkillDef[] = [
  { id: 'athletics', name: 'Athletik', attribut: 'STR' },
  { id: 'acrobatics', name: 'Akrobatik', attribut: 'DEX' },
  { id: 'sleight_of_hand', name: 'Taschendiebstahl', attribut: 'DEX' },
  { id: 'stealth', name: 'Heimlichkeit', attribut: 'DEX' },
  { id: 'arcana', name: 'Arkane Kunde', attribut: 'INT' },
  { id: 'history', name: 'Geschichte', attribut: 'INT' },
  { id: 'investigation', name: 'Ermittlung', attribut: 'INT' },
  { id: 'nature', name: 'Naturkunde', attribut: 'INT' },
  { id: 'religion', name: 'Religion', attribut: 'INT' },
  { id: 'animal_handling', name: 'Tierführung', attribut: 'WIS' },
  { id: 'insight', name: 'Menschenkenntnis', attribut: 'WIS' },
  { id: 'medicine', name: 'Medizin', attribut: 'WIS' },
  { id: 'perception', name: 'Wahrnehmung', attribut: 'WIS' },
  { id: 'survival', name: 'Überleben', attribut: 'WIS' },
  { id: 'deception', name: 'Täuschung', attribut: 'CHA' },
  { id: 'intimidation', name: 'Einschüchterung', attribut: 'CHA' },
  { id: 'performance', name: 'Aufführung', attribut: 'CHA' },
  { id: 'persuasion', name: 'Überzeugung', attribut: 'CHA' },
];

export function skillMod(
  fId: string,
  char: Pick<DnDCharakter, 'attribute' | 'stufe' | 'skill_profis' | 'skill_expertise'>,
): number {
  const f = DND_SKILLS.find(x => x.id === fId);
  if (!f) return 0;
  const base = attributMod(char.attribute[f.attribut]);
  const pb = proficiencyBonus(char.stufe);
  if (char.skill_expertise.includes(fId)) return base + pb * 2;
  if (char.skill_profis.includes(fId)) return base + pb;
  return base;
}

export function savingThrowMod(
  ability: AbilityKey,
  char: Pick<DnDCharakter, 'attribute' | 'stufe' | 'rettungswurf_profis'>,
): number {
  const base = attributMod(char.attribute[ability]);
  const pb = proficiencyBonus(char.stufe);
  return char.rettungswurf_profis.includes(ability) ? base + pb : base;
}

export const SOURCE_LABEL: Record<HerkunftArt, string> = {
  SPECIES: 'Spezies',
  CLASS: 'Klasse',
  SUBCLASS: 'Unterklasse',
  FEAT: 'Talent',
  BACKGROUND: 'Hintergrund',
  UNIVERSAL: 'Universal',
};

export const SOURCE_COLOR: Record<HerkunftArt, string> = {
  SPECIES: '#3d8b5e',
  CLASS: '#3a6ea8',
  SUBCLASS: '#7a4a9e',
  FEAT: '#c47a20',
  BACKGROUND: '#a07020',
  UNIVERSAL: '#5a5a6a',
};

export const ABILITY_NAMES: Record<AbilityKey, string> = {
  STR: 'Stärke', DEX: 'Geschick', CON: 'Konstitution',
  INT: 'Intelligenz', WIS: 'Weisheit', CHA: 'Charisma',
};

export const ABILITY_SHORT: Record<AbilityKey, string> = {
  STR: 'STR', DEX: 'GES', CON: 'KON', INT: 'INT', WIS: 'WEI', CHA: 'CHA',
};

export const ACTION_LABEL: Record<string, string> = {
  ACTION: 'Aktion', BONUS: 'Bonusaktion', REACTION: 'Reaktion',
  FREE: 'Frei', NONE: '—',
};

export const ABILITIES: AbilityKey[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

export function emptyCharacter(): DnDCharakter {
  return {
    id: newId(),
    name: '',
    rasse: '',
    klasse: '',
    unterklasse: '',
    hintergrund: '',
    stufe: 1,
    ruestungsklasse: 10,
    geschwindigkeit: 30,
    lebenspunkte: 8,
    maxLebenspunkte: 8,
    attribute: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    rettungswurf_profis: [],
    skill_profis: [],
    skill_expertise: [],
    merkmale: [],
    zauber: [],
    zauberschlitze: {},
    konzentration: null,
    ressourcen: [],
  };
}
