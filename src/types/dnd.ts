export type HerkunftArt = 'SPECIES' | 'CLASS' | 'SUBCLASS' | 'FEAT' | 'BACKGROUND' | 'UNIVERSAL';
export type AktionsTyp = 'ACTION' | 'BONUS' | 'REACTION' | 'FREE' | 'NONE';
export type AufladungTyp = 'LONG_REST' | 'SHORT_REST' | 'AT_WILL';
export type AbilityKey = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

export interface DnDAttributwerte {
  STR: number; DEX: number; CON: number;
  INT: number; WIS: number; CHA: number;
}

export interface DnDMerkmal {
  id: string;
  name: string;
  beschreibung: string;
  herkunft: HerkunftArt;
}

export interface DnDZauber {
  id: string;
  name: string;
  nameEn?: string;
  stufe: number;
  schule: string;
  herkunft: HerkunftArt;
  aktion: AktionsTyp;
  konzentration: boolean;
  beschreibung: string;
  komponenten: string;
  reichweite: string;
  isHomebrew?: boolean;
  slug?: string;
}

export interface DnDRessource {
  id: string;
  name: string;
  max: number;
  aktuell: number;
  aufladung: AufladungTyp;
}

export interface DnDSlotStufe {
  max: number;
  aktuell: number;
}

export interface DnDCharakter {
  id: string;
  name: string;
  rasse: string;
  klasse: string;
  unterklasse: string;
  hintergrund: string;
  stufe: number;
  ruestungsklasse: number;
  geschwindigkeit: number;
  lebenspunkte: number;
  maxLebenspunkte: number;
  attribute: DnDAttributwerte;
  rettungswurf_profis: AbilityKey[];
  skill_profis: string[];
  skill_expertise: string[];
  merkmale: DnDMerkmal[];
  zauber: DnDZauber[];
  zauberschlitze: Record<number, DnDSlotStufe>;
  konzentration: string | null;
  ressourcen: DnDRessource[];
}
