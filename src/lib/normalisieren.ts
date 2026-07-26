/* ============================================================
   Fremde Daten begradigen.
   Alles, was aus localStorage, aus der Datenbank oder aus einem
   alten Prototyp-Export kommt, läuft hier durch: fehlende Felder
   werden ergänzt, Typen erzwungen. So kann der Rest der App mit
   sauberen Objekten rechnen.
   ============================================================ */

import {
  ATTRIBUTE,
  type AttributName,
  type Attributwerte,
  type BodenArt,
  type Charakter,
  type Crew,
  type DetailObjekt,
  type FruchtRang,
  type Gegenstand,
  type KartenZustand,
  type LogbuchZustand,
  type MapToken,
  type Quest,
  type SchauplatzZustand,
  type Skill,
  type Waffe,
  type ZeichnungZustand,
} from "../types";
import {
  leereAttribute, neueCrew, neueId, neueKarte, neueUuid,
  neuerSchauplatz, neuesLogbuch, neueZeichnung,
} from "./spiel";

const istObjekt = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const text = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback;

const zahl = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const jaNein = (v: unknown, fallback = false): boolean =>
  typeof v === "boolean" ? v : fallback;

const liste = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function attributName(v: unknown, fallback: AttributName = "Nahkampf"): AttributName {
  return ATTRIBUTE.includes(v as AttributName) ? (v as AttributName) : fallback;
}

function attribute(v: unknown): Attributwerte {
  const roh = istObjekt(v) ? v : {};
  const out = leereAttribute();
  for (const a of ATTRIBUTE) {
    if (roh[a] !== undefined) out[a] = Math.max(1, Math.round(zahl(roh[a], 8)));
  }
  return out;
}

function gegenstand(v: unknown): Gegenstand {
  const o = istObjekt(v) ? v : {};
  return {
    id: text(o.id, "") || neueId("g"),
    text: text(o.text),
    anzahl: Math.max(0, Math.round(zahl(o.anzahl, 1))),
  };
}

function waffe(v: unknown): Waffe {
  const o = istObjekt(v) ? v : {};
  return {
    id: text(o.id, "") || neueId("w"),
    name: text(o.name),
    att: attributName(o.att),
    schaden: text(o.schaden, "W6"),
  };
}

function skill(v: unknown): Skill {
  const o = istObjekt(v) ? v : {};
  const att = text(o.att);
  return {
    id: text(o.id, "") || neueId("s"),
    name: text(o.name),
    att: ATTRIBUTE.includes(att as AttributName) ? (att as AttributName) : "",
    beschreibung: text(o.beschreibung),
  };
}

function rang(v: unknown): FruchtRang {
  const o = istObjekt(v) ? v : {};
  const wurfTyp = text(o.wurfTyp);
  return {
    id: text(o.id, "") || neueId("r"),
    name: text(o.name),
    beschreibung: text(o.beschreibung),
    kostenLevel: Math.max(0, Math.round(zahl(o.kostenLevel, 1))),
    wurfTyp: wurfTyp === "probe" || wurfTyp === "schaden" ? wurfTyp : "",
    wurfAtt: attributName(o.wurfAtt),
    wurfSchaden: text(o.wurfSchaden, "W6"),
    kostenText: text(o.kostenText),
    unlocked: jaNein(o.unlocked),
  };
}

export function normalisiereCharakter(v: unknown): Charakter {
  const o = istObjekt(v) ? v : {};
  const frucht = istObjekt(o.teufelsfrucht) ? o.teufelsfrucht : {};
  const fruchtTyp = text(frucht.typ);
  const habUndGut = liste(o.habUndGut).map(gegenstand);
  return {
    // Der Prototyp erzeugte IDs wie "c1699…". In der Cloud braucht es eine
    // uuid — ist die vorhandene ID keine, bekommt der Charakter eine neue.
    id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text(o.id))
      ? text(o.id)
      : neueUuid(),
    name: text(o.name),
    stufe: Math.max(0, Math.round(zahl(o.stufe, 0))),
    leben: Math.max(0, Math.round(zahl(o.leben, 14))),
    schaden: text(o.schaden, "W6 + W6"),
    aussehen: text(o.aussehen),
    ziel: text(o.ziel),
    spezial: text(o.spezial),
    eigenschaften: text(o.eigenschaften),
    habUndGut: habUndGut.length ? habUndGut : [{ id: neueId("g"), text: "", anzahl: 1 }],
    waffen: liste(o.waffen).map(waffe),
    skills: liste(o.skills).map(skill),
    teufelsfrucht: {
      name: text(frucht.name),
      typ: fruchtTyp === "Paramecia" || fruchtTyp === "Zoan" || fruchtTyp === "Logia" ? fruchtTyp : "",
      raenge: liste(frucht.raenge).map(rang),
    },
    kopfgeld: Math.max(0, Math.round(zahl(o.kopfgeld, 0))),
    portrait: typeof o.portrait === "string" && o.portrait ? o.portrait : null,
    epitheton: text(o.epitheton),
    berries: Math.max(0, Math.round(zahl(o.berries, 0))),
    attribute: attribute(o.attribute),
  };
}

export function normalisiereCrew(v: unknown): Crew {
  const o = istObjekt(v) ? v : {};
  const leer = neueCrew();
  return {
    name: text(o.name, leer.name),
    jollyRoger: typeof o.jollyRoger === "string" && o.jollyRoger ? o.jollyRoger : null,
    schiffName: text(o.schiffName, leer.schiffName),
    schiffBeschreibung: text(o.schiffBeschreibung, leer.schiffBeschreibung),
    flotte: text(o.flotte, leer.flotte),
  };
}

const TOKEN_ARTEN = ["crew", "gegner", "insel", "schiff", "ziel"] as const;

function mapToken(v: unknown): MapToken {
  const o = istObjekt(v) ? v : {};
  const kind = text(o.kind, "crew");
  return {
    id: text(o.id, "") || neueId("t"),
    label: text(o.label),
    kind: (TOKEN_ARTEN as readonly string[]).includes(kind) ? (kind as MapToken["kind"]) : "crew",
    color: text(o.color, "#555"),
    x: Math.min(100, Math.max(0, zahl(o.x, 50))),
    y: Math.min(100, Math.max(0, zahl(o.y, 50))),
    ref: typeof o.ref === "string" ? o.ref : null,
  };
}

export function normalisiereKarte(v: unknown): KartenZustand {
  const o = istObjekt(v) ? v : {};
  const leer = neueKarte();
  return {
    bg: typeof o.bg === "string" && o.bg ? o.bg : null,
    gridOn: jaNein(o.gridOn, leer.gridOn),
    tokens: liste(o.tokens).map(mapToken),
  };
}

const TERRAINS = ["wasser", "strand", "gruen", "wald", "fels", "weg"] as const;
const BAUWERKE = ["haus", "turm", "taverne", "hafen", "schatz", "kreuz", "baum", "berg"] as const;

export function normalisiereZeichnung(v: unknown): ZeichnungZustand {
  const o = istObjekt(v) ? v : {};
  const leer = neueZeichnung();
  let grid = leer.grid;
  if (istObjekt(o.grid)) {
    const cols = Math.max(1, Math.round(zahl(o.grid.cols, 60)));
    const rows = Math.max(1, Math.round(zahl(o.grid.rows, 40)));
    const roh = liste(o.grid.cells);
    const cells = Array.from({ length: cols * rows }, (_, i) => {
      const c = roh[i];
      return (TERRAINS as readonly string[]).includes(c as string)
        ? (c as (typeof TERRAINS)[number])
        : "wasser";
    });
    grid = { cols, rows, cells };
  }
  const buildings = liste(o.buildings).map(b => {
    const bo = istObjekt(b) ? b : {};
    const kind = text(bo.kind, "haus");
    return {
      id: text(bo.id, "") || neueId("b"),
      kind: (BAUWERKE as readonly string[]).includes(kind) ? (kind as (typeof BAUWERKE)[number]) : "haus",
      x: Math.min(100, Math.max(0, zahl(bo.x, 50))),
      y: Math.min(100, Math.max(0, zahl(bo.y, 50))),
    };
  });
  return { grid, buildings };
}

const BOEDEN = ["stein", "holz", "gras", "wasser", "sand"] as const;
const bodenArt = (v: unknown, fallback: BodenArt = "stein"): BodenArt =>
  (BOEDEN as readonly string[]).includes(v as string) ? (v as BodenArt) : fallback;

function detailObjekt(v: unknown): DetailObjekt | null {
  const o = istObjekt(v) ? v : {};
  const id = text(o.id, "") || neueId("o");
  switch (o.type) {
    case "rect":
      return { id, type: "rect", x: zahl(o.x), y: zahl(o.y), w: zahl(o.w), h: zahl(o.h), terr: bodenArt(o.terr) };
    case "circle":
      return { id, type: "circle", cx: zahl(o.cx), cy: zahl(o.cy), rx: zahl(o.rx), ry: zahl(o.ry), terr: bodenArt(o.terr) };
    case "wall":
      return { id, type: "wall", x1: zahl(o.x1), y1: zahl(o.y1), x2: zahl(o.x2), y2: zahl(o.y2), door: jaNein(o.door) };
    case "label":
      return { id, type: "label", x: zahl(o.x), y: zahl(o.y), text: text(o.text) };
    default:
      return null;
  }
}

export function normalisiereSchauplatz(v: unknown): SchauplatzZustand {
  const o = istObjekt(v) ? v : {};
  const leer = neuerSchauplatz();
  return {
    objects: liste(o.objects).map(detailObjekt).filter((x): x is DetailObjekt => x !== null),
    bg: bodenArt(o.bg, leer.bg),
  };
}

function quest(v: unknown): Quest {
  const o = istObjekt(v) ? v : {};
  return {
    id: text(o.id, "") || neueId("q"),
    titel: text(o.titel),
    notiz: text(o.notiz),
    erledigt: jaNein(o.erledigt),
  };
}

export function normalisiereLogbuch(v: unknown): LogbuchZustand {
  const o = istObjekt(v) ? v : {};
  const leer = neuesLogbuch();
  return {
    notizen: text(o.notizen, leer.notizen),
    quests: liste(o.quests).map(quest),
  };
}
