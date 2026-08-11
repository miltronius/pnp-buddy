import {
  ATTRIBUTE,
  type AttrName,
  type AttrValues,
  type Character,
  type Crew,
  type FruitRank,
  type MapState,
  type LogbookState,
  type SceneState,
  type DieSides,
  type DrawingState,
} from "../types";

/** Balance modifier per attribute level (game rule lookup table). */
export function balanceValue(level: number | undefined | null): number {
  const l = Number(level) || 0;
  if (l <= 1) return -4;
  if (l <= 3) return -3;
  if (l <= 5) return -2;
  if (l <= 7) return -1;
  if (l <= 12) return 0;
  if (l <= 15) return 1;
  if (l <= 17) return 2;
  if (l <= 19) return 3;
  return 4;
}

export function withSign(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

export type DamagePart =
  | { flat: number; n?: undefined; sides?: undefined; sign?: undefined }
  | { n: number; sides: DieSides; sign: number; flat?: undefined };

const ALLOWED_SIDES: DieSides[] = [4, 6, 8, 10, 12, 20, 100];

export function parseDamage(str: string | null | undefined): DamagePart[] {
  const parts: DamagePart[] = [];
  const clean = String(str || "").replace(/\s+/g, "").toLowerCase();
  const re = /([+-]?)(\d*)[wd](\d+)|([+-]?\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    if (m[4] !== undefined) {
      parts.push({ flat: parseInt(m[4], 10) });
    } else {
      const sign = m[1] === "-" ? -1 : 1;
      const n = m[2] ? parseInt(m[2], 10) : 1;
      const sides = parseInt(m[3], 10) as DieSides;
      if (ALLOWED_SIDES.includes(sides)) parts.push({ n, sides, sign });
    }
  }
  return parts;
}

export interface RankBalance extends FruitRank {
  cost: number;
  canUnlock: boolean;
  canLock: boolean;
}

export interface FruitBalance {
  available: number;
  spent: number;
  ranks: RankBalance[];
}

export function fruitBalance(level: number, ranks: FruitRank[] | undefined): FruitBalance {
  let spent = 0;
  const base = (ranks || []).map(r => {
    const cost = Math.max(0, r.costLevel | 0);
    if (r.unlocked) spent += cost;
    return { ...r, cost };
  });
  const available = (level | 0) - spent;
  const out: RankBalance[] = base.map((r, i) => {
    const prevOk = i === 0 || base[i - 1].unlocked;
    const nextLocked = i === base.length - 1 || !base[i + 1].unlocked;
    return {
      ...r,
      canUnlock: !r.unlocked && prevOk && available >= r.cost,
      canLock: !!r.unlocked && nextLocked,
    };
  });
  return { available, spent, ranks: out };
}

export function newUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function newId(prefix = "i"): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function emptyAttributes(): AttrValues {
  return Object.fromEntries(ATTRIBUTE.map(a => [a, 8])) as AttrValues;
}

export function newCharacter(): Character {
  return {
    id: newUuid(),
    name: "",
    level: 0,
    hp: 14,
    damage: "W6 + W6",
    appearance: "",
    goal: "",
    special: "",
    traits: "",
    inventory: [{ id: newId("g"), text: "", count: 1 }],
    weapons: [],
    skills: [],
    devilFruit: { name: "", type: "", ranks: [] },
    bounty: 0,
    portrait: null,
    epithet: "",
    berries: 0,
    attrs: emptyAttributes(),
  };
}

export function newCrew(): Crew {
  return { name: "", jollyRoger: null, shipName: "", shipDescription: "", fleet: "" };
}

export function newMap(): MapState {
  return { bg: null, gridOn: true, tokens: [] };
}

export function newDrawing(): DrawingState {
  return { grid: null, buildings: [] };
}

export function newScene(): SceneState {
  return { objects: [], bg: "stone" };
}

export function newLogbook(): LogbookState {
  return { notes: "", quests: [] };
}

export function formatBerry(n: number | string | null | undefined): string {
  const num = Math.max(0, Math.floor(Number(n) || 0));
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export const VERDICT_TEXT = {
  ok: "GESCHAFFT",
  mid: "TEILWEISE",
  fail: "FEHLSCHLAG",
} as const;

export function characterBalance(c: Character | null | undefined, att: AttrName | null): number {
  if (!c || !att) return 0;
  return balanceValue(c.attrs?.[att]);
}
