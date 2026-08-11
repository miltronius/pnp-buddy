export type OriginType = 'SPECIES' | 'CLASS' | 'SUBCLASS' | 'FEAT' | 'BACKGROUND' | 'UNIVERSAL';
export type ActionType = 'ACTION' | 'BONUS' | 'REACTION' | 'FREE' | 'NONE';
export type RechargeType = 'LONG_REST' | 'SHORT_REST' | 'AT_WILL';
export type AbilityKey = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

export interface DnDAttributes {
  STR: number; DEX: number; CON: number;
  INT: number; WIS: number; CHA: number;
}

export interface DnDFeature {
  id: string;
  name: string;
  nameEn?: string;
  description: string;
  descriptionEn?: string;
  origin: OriginType;
}

export interface DnDSpell {
  id: string;
  name: string;
  nameEn?: string;
  level: number;
  school: string;
  origin: OriginType;
  action: ActionType;
  concentration: boolean;
  description: string;
  components: string;
  range: string;
  isHomebrew?: boolean;
  slug?: string;
}

export interface DnDResource {
  id: string;
  name: string;
  max: number;
  current: number;
  recharge: RechargeType;
}

export interface DnDSlotLevel {
  max: number;
  current: number;
}

export interface DnDCharacter {
  id: string;
  name: string;
  species: string;
  charClass: string;
  subclass: string;
  background: string;
  level: number;
  armorClass: number;
  speed: number;
  hp: number;
  maxHp: number;
  attrs: DnDAttributes;
  saveProficiencies: AbilityKey[];
  skillProficiencies: string[];
  skillExpertise: string[];
  features: DnDFeature[];
  spells: DnDSpell[];
  spellSlots: Record<number, DnDSlotLevel>;
  concentration: string | null;
  resources: DnDResource[];
  metamagic: string[];
  draconicAncestry?: string;
}
