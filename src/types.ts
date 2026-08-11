/* ============================================================
   Data model for Grand Line Assistant.
   All identifiers are in English; persistence keys remain unchanged.
   ============================================================ */

export const ATTRIBUTE = [
  "Nahkampf", "Fernkampf", "Blocken",
  "Geschicklichkeit", "Intelligenz", "Konstitution",
  "Charisma", "Navigation", "Heilkunde",
] as const;

export type AttrName = (typeof ATTRIBUTE)[number];
export type AttrValues = Record<AttrName, number>;

/* ---------- Character ---------- */

export interface Item {
  id: string;
  text: string;
  count: number;
}

export interface Weapon {
  id: string;
  name: string;
  att: AttrName;
  damage: string;
}

export interface Skill {
  id: string;
  name: string;
  att: AttrName | "";
  description: string;
}

export type RollType = "" | "check" | "damage";
export type FruitType = "" | "Paramecia" | "Zoan" | "Logia";

export interface FruitRank {
  id: string;
  name: string;
  description: string;
  costLevel: number;
  rollType: RollType;
  rollAttr: AttrName;
  rollDamage: string;
  costText: string;
  unlocked: boolean;
}

export interface DevilFruit {
  name: string;
  type: FruitType;
  ranks: FruitRank[];
}

export interface Character {
  id: string;
  name: string;
  level: number;
  hp: number;
  damage: string;
  appearance: string;
  goal: string;
  special: string;
  traits: string;
  inventory: Item[];
  weapons: Weapon[];
  skills: Skill[];
  devilFruit: DevilFruit;
  bounty: number;
  /** Data URL (local mode) or storage path (cloud mode). */
  portrait: string | null;
  epithet: string;
  berries: number;
  attrs: AttrValues;
}

/* ---------- Crew & Ship ---------- */

export interface Crew {
  name: string;
  jollyRoger: string | null;
  shipName: string;
  shipDescription: string;
  fleet: string;
}

/* ---------- Map (token tracker) ---------- */

export type TokenType = "crew" | "enemy" | "island" | "ship" | "target";

export interface MapToken {
  id: string;
  label: string;
  kind: TokenType;
  color: string;
  /** Percent of map width/height so position scales. */
  x: number;
  y: number;
  ref: string | null;
}

export interface MapState {
  bg: string | null;
  gridOn: boolean;
  tokens: MapToken[];
}

/* ---------- Cartography (island drawing tool) ---------- */

export type TerrainType = "water" | "beach" | "grass" | "forest" | "rock" | "path";
export type BuildingType =
  | "house" | "tower" | "tavern" | "harbor"
  | "treasure" | "cross" | "tree" | "mountain";

export interface DrawingGrid {
  cols: number;
  rows: number;
  cells: TerrainType[];
}

export interface Building {
  id: string;
  kind: BuildingType;
  x: number;
  y: number;
}

export interface DrawingState {
  grid: DrawingGrid | null;
  buildings: Building[];
}

/* ---------- Scene (detail editor) ---------- */

export type FloorType = "stone" | "wood" | "grass" | "water" | "sand";

export interface DetailRect {
  id: string;
  type: "rect";
  x: number; y: number; w: number; h: number;
  terr: FloorType;
}
export interface DetailCircle {
  id: string;
  type: "circle";
  cx: number; cy: number; rx: number; ry: number;
  terr: FloorType;
}
export interface DetailWall {
  id: string;
  type: "wall";
  x1: number; y1: number; x2: number; y2: number;
  door: boolean;
}
export interface DetailLabel {
  id: string;
  type: "label";
  x: number; y: number;
  text: string;
}
export type DetailObject = DetailRect | DetailCircle | DetailWall | DetailLabel;

export interface SceneState {
  objects: DetailObject[];
  bg: FloorType;
}

/* ---------- Logbook ---------- */

export interface Quest {
  id: string;
  title: string;
  note: string;
  done: boolean;
}

export interface LogbookState {
  notes: string;
  quests: Quest[];
}

/* ---------- Combat tracker (runtime only, not persisted) ---------- */

export type Side = "crew" | "enemy";

export interface Fighter {
  id: string;
  charId: string | null;
  name: string;
  side: Side;
  initAttr: AttrName;
  initiative: number | null;
  hp: number;
  maxHp: number;
  dead: boolean;
  initMod?: number;
  attackMod?: number;
  attackDamage?: string;
}

/* ---------- Dice table ---------- */

export type RollKind = "roll" | "check" | "damage" | "initiative";
export type Verdict = "ok" | "mid" | "fail";
export type DieSides = 4 | 6 | 8 | 10 | 12 | 20 | 100;

export interface DiceGroup {
  n: number;
  sides: DieSides;
}

/** A triggered roll — controls the fullscreen dice table. */
export interface RollSpec {
  id: number;
  count: number;
  sides: DieSides;
  att: AttrName | null;
  label: string | null;
  flat: number;
  kind: RollKind;
  /** Mixed damage (e.g. d8 + d6) is rolled group by group in sequence. */
  groups?: DiceGroup[];
  groupIndex?: number;
  carriedVals?: number[];
  backTo?: TabName | null;
  fighterId?: string | null;
}

export interface RollResult {
  vals: number[];
  sum: number;
  mod: number;
  total: number;
  att: AttrName | null;
  verdict: Verdict | null;
  sides: DieSides;
  label: string | null;
  kind: RollKind;
  flat: number;
  fighterId: string | null;
}

/* ---------- Navigation ---------- */

export type TabName =
  | "sheet" | "dice" | "combat" | "map"
  | "cartography" | "scene" | "logbook" | "crew";

export type SystemName = "pnp" | "dnd";

/* ---------- Campaign data ---------- */

export interface CampaignData {
  chars: Character[];
  crew: Crew;
  map: MapState;
  drawing: DrawingState;
  scene: SceneState;
  logbook: LogbookState;
}
