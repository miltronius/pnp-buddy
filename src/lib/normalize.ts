import {
  ATTRIBUTE,
  type AttrName,
  type AttrValues,
  type FloorType,
  type Character,
  type Crew,
  type DetailObject,
  type FruitRank,
  type Item,
  type MapState,
  type LogbookState,
  type MapToken,
  type Quest,
  type SceneState,
  type Skill,
  type Weapon,
  type DrawingState,
} from "../types";
import {
  emptyAttributes, newCrew, newId, newMap, newUuid,
  newScene, newLogbook, newDrawing,
} from "./game";

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const text = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback;

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const bool = (v: unknown, fallback = false): boolean =>
  typeof v === "boolean" ? v : fallback;

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function attrName(v: unknown, fallback: AttrName = "Nahkampf"): AttrName {
  return ATTRIBUTE.includes(v as AttrName) ? (v as AttrName) : fallback;
}

function attrs(v: unknown): AttrValues {
  const raw = isObject(v) ? v : {};
  const out = emptyAttributes();
  for (const a of ATTRIBUTE) {
    if (raw[a] !== undefined) out[a] = Math.max(1, Math.round(num(raw[a], 8)));
  }
  return out;
}

function item(v: unknown): Item {
  const o = isObject(v) ? v : {};
  return {
    id: text(o.id, "") || newId("g"),
    text: text(o.text),
    count: Math.max(0, Math.round(num(o.count ?? o.anzahl, 1))),
  };
}

function weapon(v: unknown): Weapon {
  const o = isObject(v) ? v : {};
  return {
    id: text(o.id, "") || newId("w"),
    name: text(o.name),
    att: attrName(o.att),
    damage: text(o.damage ?? o.schaden, "W6"),
  };
}

function skill(v: unknown): Skill {
  const o = isObject(v) ? v : {};
  const att = text(o.att);
  return {
    id: text(o.id, "") || newId("s"),
    name: text(o.name),
    att: ATTRIBUTE.includes(att as AttrName) ? (att as AttrName) : "",
    description: text(o.description ?? o.beschreibung),
  };
}

function rank(v: unknown): FruitRank {
  const o = isObject(v) ? v : {};
  const rollType = text(o.rollType ?? o.wurfTyp);
  return {
    id: text(o.id, "") || newId("r"),
    name: text(o.name),
    description: text(o.description ?? o.beschreibung),
    costLevel: Math.max(0, Math.round(num(o.costLevel ?? o.kostenLevel, 1))),
    rollType: rollType === "check" || rollType === "damage"
      ? rollType
      : rollType === "probe" ? "check"
      : rollType === "schaden" ? "damage"
      : "",
    rollAttr: attrName(o.rollAttr ?? o.wurfAtt),
    rollDamage: text(o.rollDamage ?? o.wurfSchaden, "W6"),
    costText: text(o.costText ?? o.kostenText),
    unlocked: bool(o.unlocked),
  };
}

export function normalizeCharacter(v: unknown): Character {
  const o = isObject(v) ? v : {};
  const fruit = isObject(o.devilFruit ?? o.teufelsfrucht) ? (o.devilFruit ?? o.teufelsfrucht) as Record<string, unknown> : {};
  const fruitType = text(fruit.type ?? fruit.typ);
  const inventory = list(o.inventory ?? o.habUndGut).map(item);
  return {
    id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text(o.id))
      ? text(o.id)
      : newUuid(),
    name: text(o.name),
    level: Math.max(0, Math.round(num(o.level ?? o.stufe, 0))),
    hp: Math.max(0, Math.round(num(o.hp ?? o.leben, 14))),
    damage: text(o.damage ?? o.schaden, "W6 + W6"),
    appearance: text(o.appearance ?? o.aussehen),
    goal: text(o.goal ?? o.ziel),
    special: text(o.special ?? o.spezial),
    traits: text(o.traits ?? o.eigenschaften),
    inventory: inventory.length ? inventory : [{ id: newId("g"), text: "", count: 1 }],
    weapons: list(o.weapons ?? o.waffen).map(weapon),
    skills: list(o.skills).map(skill),
    devilFruit: {
      name: text(fruit.name),
      type: fruitType === "Paramecia" || fruitType === "Zoan" || fruitType === "Logia" ? fruitType : "",
      ranks: list(fruit.ranks ?? fruit.raenge).map(rank),
    },
    bounty: Math.max(0, Math.round(num(o.bounty ?? o.kopfgeld, 0))),
    portrait: typeof o.portrait === "string" && o.portrait ? o.portrait : null,
    epithet: text(o.epithet ?? o.epitheton),
    berries: Math.max(0, Math.round(num(o.berries, 0))),
    attrs: attrs(o.attrs ?? o.attribute),
  };
}

export function normalizeCrew(v: unknown): Crew {
  const o = isObject(v) ? v : {};
  const empty = newCrew();
  return {
    name: text(o.name, empty.name),
    jollyRoger: typeof o.jollyRoger === "string" && o.jollyRoger ? o.jollyRoger : null,
    shipName: text(o.shipName ?? o.schiffName, empty.shipName),
    shipDescription: text(o.shipDescription ?? o.schiffBeschreibung, empty.shipDescription),
    fleet: text(o.fleet ?? o.flotte, empty.fleet),
  };
}

const TOKEN_KINDS = ["crew", "enemy", "island", "ship", "target"] as const;

function mapToken(v: unknown): MapToken {
  const o = isObject(v) ? v : {};
  const kind = text(o.kind, "crew");
  // Normalize legacy German values
  const normalizedKind = kind === "gegner" ? "enemy"
    : kind === "insel" ? "island"
    : kind === "schiff" ? "ship"
    : kind === "ziel" ? "target"
    : kind;
  return {
    id: text(o.id, "") || newId("t"),
    label: text(o.label),
    kind: (TOKEN_KINDS as readonly string[]).includes(normalizedKind) ? (normalizedKind as MapToken["kind"]) : "crew",
    color: text(o.color, "#555"),
    x: Math.min(100, Math.max(0, num(o.x, 50))),
    y: Math.min(100, Math.max(0, num(o.y, 50))),
    ref: typeof o.ref === "string" ? o.ref : null,
  };
}

export function normalizeMap(v: unknown): MapState {
  const o = isObject(v) ? v : {};
  const empty = newMap();
  return {
    bg: typeof o.bg === "string" && o.bg ? o.bg : null,
    gridOn: bool(o.gridOn, empty.gridOn),
    tokens: list(o.tokens).map(mapToken),
  };
}

const TERRAINS = ["water", "beach", "grass", "forest", "rock", "path"] as const;
const BUILDINGS = ["house", "tower", "tavern", "harbor", "treasure", "cross", "tree", "mountain"] as const;

// Legacy German terrain value mapping
function normalizeTerrainValue(s: string): string {
  const map: Record<string, string> = {
    wasser: "water", strand: "beach", gruen: "grass",
    wald: "forest", fels: "rock", weg: "path",
  };
  return map[s] ?? s;
}

// Legacy German building value mapping
function normalizeBuildingValue(s: string): string {
  const map: Record<string, string> = {
    haus: "house", turm: "tower", taverne: "tavern",
    hafen: "harbor", schatz: "treasure", kreuz: "cross",
    baum: "tree", berg: "mountain",
  };
  return map[s] ?? s;
}

export function normalizeDrawing(v: unknown): DrawingState {
  const o = isObject(v) ? v : {};
  const empty = newDrawing();
  let grid = empty.grid;
  if (isObject(o.grid)) {
    const cols = Math.max(1, Math.round(num(o.grid.cols, 60)));
    const rows = Math.max(1, Math.round(num(o.grid.rows, 40)));
    const raw = list(o.grid.cells);
    const cells = Array.from({ length: cols * rows }, (_, i) => {
      const c = raw[i];
      const normalized = normalizeTerrainValue(c as string);
      return (TERRAINS as readonly string[]).includes(normalized)
        ? (normalized as (typeof TERRAINS)[number])
        : "water";
    });
    grid = { cols, rows, cells };
  }
  const buildings = list(o.buildings).map(b => {
    const bo = isObject(b) ? b : {};
    const kind = normalizeBuildingValue(text(bo.kind, "house"));
    return {
      id: text(bo.id, "") || newId("b"),
      kind: (BUILDINGS as readonly string[]).includes(kind) ? (kind as (typeof BUILDINGS)[number]) : "house",
      x: Math.min(100, Math.max(0, num(bo.x, 50))),
      y: Math.min(100, Math.max(0, num(bo.y, 50))),
    };
  });
  return { grid, buildings };
}

const FLOORS = ["stone", "wood", "grass", "water", "sand"] as const;

function floorType(v: unknown, fallback: FloorType = "stone"): FloorType {
  const raw = v as string;
  // Normalize legacy German values
  const normalized = raw === "stein" ? "stone"
    : raw === "holz" ? "wood"
    : raw === "gras" ? "grass"
    : raw;
  return (FLOORS as readonly string[]).includes(normalized) ? (normalized as FloorType) : fallback;
}

function detailObject(v: unknown): DetailObject | null {
  const o = isObject(v) ? v : {};
  const id = text(o.id, "") || newId("o");
  switch (o.type) {
    case "rect":
      return { id, type: "rect", x: num(o.x), y: num(o.y), w: num(o.w), h: num(o.h), terr: floorType(o.terr) };
    case "circle":
      return { id, type: "circle", cx: num(o.cx), cy: num(o.cy), rx: num(o.rx), ry: num(o.ry), terr: floorType(o.terr) };
    case "wall":
      return { id, type: "wall", x1: num(o.x1), y1: num(o.y1), x2: num(o.x2), y2: num(o.y2), door: bool(o.door) };
    case "label":
      return { id, type: "label", x: num(o.x), y: num(o.y), text: text(o.text) };
    default:
      return null;
  }
}

export function normalizeScene(v: unknown): SceneState {
  const o = isObject(v) ? v : {};
  const empty = newScene();
  return {
    objects: list(o.objects).map(detailObject).filter((x): x is DetailObject => x !== null),
    bg: floorType(o.bg, empty.bg),
  };
}

function quest(v: unknown): Quest {
  const o = isObject(v) ? v : {};
  return {
    id: text(o.id, "") || newId("q"),
    title: text(o.title ?? o.titel),
    note: text(o.note ?? o.notiz),
    done: bool(o.done ?? o.erledigt),
  };
}

export function normalizeLogbook(v: unknown): LogbookState {
  const o = isObject(v) ? v : {};
  const empty = newLogbook();
  return {
    notes: text(o.notes ?? o.notizen, empty.notes),
    quests: list(o.quests).map(quest),
  };
}
