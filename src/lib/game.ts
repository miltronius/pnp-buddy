import {
  ATTRIBUTE,
  type AttributName,
  type Attributwerte,
  type Charakter,
  type Crew,
  type FruchtRang,
  type KartenZustand,
  type LogbuchZustand,
  type SchauplatzZustand,
  type Wuerfelseiten,
  type ZeichnungZustand,
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

export type SchadensTeil =
  | { flat: number; n?: undefined; sides?: undefined; sign?: undefined }
  | { n: number; sides: Wuerfelseiten; sign: number; flat?: undefined };

const ERLAUBTE_SEITEN: Wuerfelseiten[] = [4, 6, 8, 10, 12, 20, 100];

export function parseDamage(str: string | null | undefined): SchadensTeil[] {
  const parts: SchadensTeil[] = [];
  const clean = String(str || "").replace(/\s+/g, "").toLowerCase();
  const re = /([+-]?)(\d*)[wd](\d+)|([+-]?\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    if (m[4] !== undefined) {
      parts.push({ flat: parseInt(m[4], 10) });
    } else {
      const sign = m[1] === "-" ? -1 : 1;
      const n = m[2] ? parseInt(m[2], 10) : 1;
      const sides = parseInt(m[3], 10) as Wuerfelseiten;
      if (ERLAUBTE_SEITEN.includes(sides)) parts.push({ n, sides, sign });
    }
  }
  return parts;
}

export interface RankBalance extends FruchtRang {
  kosten: number;
  canUnlock: boolean;
  canLock: boolean;
}

export interface FruitBalance {
  available: number;
  spent: number;
  raenge: RankBalance[];
}

export function fruitBalance(stufe: number, raenge: FruchtRang[] | undefined): FruitBalance {
  let ausgegeben = 0;
  const base = (raenge || []).map(r => {
    const kosten = Math.max(0, r.kostenLevel | 0);
    if (r.unlocked) ausgegeben += kosten;
    return { ...r, kosten };
  });
  const verfuegbar = (stufe | 0) - ausgegeben;
  const out: RankBalance[] = base.map((r, i) => {
    const prevOk = i === 0 || base[i - 1].unlocked;
    const nextLocked = i === base.length - 1 || !base[i + 1].unlocked;
    return {
      ...r,
      canUnlock: !r.unlocked && prevOk && verfuegbar >= r.kosten,
      canLock: !!r.unlocked && nextLocked,
    };
  });
  return { available: verfuegbar, spent: ausgegeben, raenge: out };
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

export function emptyAttributes(): Attributwerte {
  return Object.fromEntries(ATTRIBUTE.map(a => [a, 8])) as Attributwerte;
}

export function newCharacter(): Charakter {
  return {
    id: newUuid(),
    name: "",
    stufe: 0,
    leben: 14,
    schaden: "W6 + W6",
    aussehen: "",
    ziel: "",
    spezial: "",
    eigenschaften: "",
    habUndGut: [{ id: newId("g"), text: "", anzahl: 1 }],
    waffen: [],
    skills: [],
    teufelsfrucht: { name: "", typ: "", raenge: [] },
    kopfgeld: 0,
    portrait: null,
    epitheton: "",
    berries: 0,
    attribute: emptyAttributes(),
  };
}

export function newCrew(): Crew {
  return { name: "", jollyRoger: null, schiffName: "", schiffBeschreibung: "", flotte: "" };
}

export function newMap(): KartenZustand {
  return { bg: null, gridOn: true, tokens: [] };
}

export function newDrawing(): ZeichnungZustand {
  return { grid: null, buildings: [] };
}

export function newScene(): SchauplatzZustand {
  return { objects: [], bg: "stein" };
}

export function newLogbook(): LogbuchZustand {
  return { notizen: "", quests: [] };
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

export function characterBalance(c: Charakter | null | undefined, att: AttributName | null): number {
  if (!c || !att) return 0;
  return balanceValue(c.attribute?.[att]);
}
