import type { AbilityKey, DnDCharacter, OriginType } from "../types/dnd";

export function abilityMod(wert: number): number {
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
  ability: AbilityKey;
}

export const DND_SKILLS: DnDSkillDef[] = [
  { id: 'athletics', name: 'Athletik', ability: 'STR' },
  { id: 'acrobatics', name: 'Akrobatik', ability: 'DEX' },
  { id: 'sleight_of_hand', name: 'Taschendiebstahl', ability: 'DEX' },
  { id: 'stealth', name: 'Heimlichkeit', ability: 'DEX' },
  { id: 'arcana', name: 'Arkane Kunde', ability: 'INT' },
  { id: 'history', name: 'Geschichte', ability: 'INT' },
  { id: 'investigation', name: 'Ermittlung', ability: 'INT' },
  { id: 'nature', name: 'Naturkunde', ability: 'INT' },
  { id: 'religion', name: 'Religion', ability: 'INT' },
  { id: 'animal_handling', name: 'Tierführung', ability: 'WIS' },
  { id: 'insight', name: 'Menschenkenntnis', ability: 'WIS' },
  { id: 'medicine', name: 'Medizin', ability: 'WIS' },
  { id: 'perception', name: 'Wahrnehmung', ability: 'WIS' },
  { id: 'survival', name: 'Überleben', ability: 'WIS' },
  { id: 'deception', name: 'Täuschung', ability: 'CHA' },
  { id: 'intimidation', name: 'Einschüchterung', ability: 'CHA' },
  { id: 'performance', name: 'Aufführung', ability: 'CHA' },
  { id: 'persuasion', name: 'Überzeugung', ability: 'CHA' },
];

export function skillMod(
  fId: string,
  char: Pick<DnDCharacter, 'attrs' | 'level' | 'skillProficiencies' | 'skillExpertise'>,
): number {
  const f = DND_SKILLS.find(x => x.id === fId);
  if (!f) return 0;
  const base = abilityMod(char.attrs[f.ability]);
  const pb = proficiencyBonus(char.level);
  if (char.skillExpertise.includes(fId)) return base + pb * 2;
  if (char.skillProficiencies.includes(fId)) return base + pb;
  return base;
}

export function savingThrowMod(
  ability: AbilityKey,
  char: Pick<DnDCharacter, 'attrs' | 'level' | 'saveProficiencies'>,
): number {
  const base = abilityMod(char.attrs[ability]);
  const pb = proficiencyBonus(char.level);
  return char.saveProficiencies.includes(ability) ? base + pb : base;
}

export const SOURCE_LABEL: Record<OriginType, string> = {
  SPECIES: 'Spezies',
  CLASS: 'Klasse',
  SUBCLASS: 'Unterklasse',
  FEAT: 'Talent',
  BACKGROUND: 'Hintergrund',
  UNIVERSAL: 'Universal',
};

export const SOURCE_COLOR: Record<OriginType, string> = {
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

export function emptyCharacter(): DnDCharacter {
  return {
    id: newId(),
    name: '',
    species: '',
    charClass: '',
    subclass: '',
    background: '',
    level: 1,
    armorClass: 10,
    speed: 30,
    hp: 8,
    maxHp: 8,
    attrs: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    saveProficiencies: [],
    skillProficiencies: [],
    skillExpertise: [],
    features: [],
    spells: [],
    spellSlots: {},
    concentration: null,
    resources: [],
    metamagic: [],
  };
}
