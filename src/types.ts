/* ============================================================
   Datenmodell des Grand Line Assistant.
   Die Namen entsprechen dem Prototyp — der Migrationsvertrag aus
   CLAUDE.md bleibt damit unverändert erhalten.
   ============================================================ */

export const ATTRIBUTE = [
  "Nahkampf", "Fernkampf", "Blocken",
  "Geschicklichkeit", "Intelligenz", "Konstitution",
  "Charisma", "Navigation", "Heilkunde",
] as const;

export type AttributName = (typeof ATTRIBUTE)[number];
export type Attributwerte = Record<AttributName, number>;

/* ---------- Charakter ---------- */

export interface Gegenstand {
  id: string;
  text: string;
  anzahl: number;
}

export interface Waffe {
  id: string;
  name: string;
  att: AttributName;
  schaden: string;
}

export interface Skill {
  id: string;
  name: string;
  att: AttributName | "";
  beschreibung: string;
}

export type WurfTyp = "" | "probe" | "schaden";
export type FruchtTyp = "" | "Paramecia" | "Zoan" | "Logia";

export interface FruchtRang {
  id: string;
  name: string;
  beschreibung: string;
  kostenLevel: number;
  wurfTyp: WurfTyp;
  wurfAtt: AttributName;
  wurfSchaden: string;
  kostenText: string;
  unlocked: boolean;
}

export interface Teufelsfrucht {
  name: string;
  typ: FruchtTyp;
  raenge: FruchtRang[];
}

export interface Charakter {
  id: string;
  name: string;
  stufe: number;
  leben: number;
  schaden: string;
  aussehen: string;
  ziel: string;
  spezial: string;
  eigenschaften: string;
  habUndGut: Gegenstand[];
  waffen: Waffe[];
  skills: Skill[];
  teufelsfrucht: Teufelsfrucht;
  kopfgeld: number;
  /** Data-URL (lokaler Modus) oder Storage-Pfad (Cloud-Modus). */
  portrait: string | null;
  epitheton: string;
  berries: number;
  attribute: Attributwerte;
}

/* ---------- Crew & Schiff ---------- */

export interface Crew {
  name: string;
  jollyRoger: string | null;
  schiffName: string;
  schiffBeschreibung: string;
  flotte: string;
}

/* ---------- Karte (Figuren-Tracker) ---------- */

export type TokenArt = "crew" | "gegner" | "insel" | "schiff" | "ziel";

export interface MapToken {
  id: string;
  label: string;
  kind: TokenArt;
  color: string;
  /** Prozent der Kartenbreite/-höhe, damit die Lage skaliert. */
  x: number;
  y: number;
  ref: string | null;
}

export interface KartenZustand {
  bg: string | null;
  gridOn: boolean;
  tokens: MapToken[];
}

/* ---------- Kartografie (Insel-Zeichentool) ---------- */

export type TerrainArt = "wasser" | "strand" | "gruen" | "wald" | "fels" | "weg";
export type BauwerkArt =
  | "haus" | "turm" | "taverne" | "hafen"
  | "schatz" | "kreuz" | "baum" | "berg";

export interface Zeichenraster {
  cols: number;
  rows: number;
  cells: TerrainArt[];
}

export interface Bauwerk {
  id: string;
  kind: BauwerkArt;
  x: number;
  y: number;
}

export interface ZeichnungZustand {
  grid: Zeichenraster | null;
  buildings: Bauwerk[];
}

/* ---------- Schauplatz (Detail-Editor) ---------- */

export type BodenArt = "stein" | "holz" | "gras" | "wasser" | "sand";

export interface DetailRect {
  id: string;
  type: "rect";
  x: number; y: number; w: number; h: number;
  terr: BodenArt;
}
export interface DetailCircle {
  id: string;
  type: "circle";
  cx: number; cy: number; rx: number; ry: number;
  terr: BodenArt;
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
export type DetailObjekt = DetailRect | DetailCircle | DetailWall | DetailLabel;

export interface SchauplatzZustand {
  objects: DetailObjekt[];
  bg: BodenArt;
}

/* ---------- Logbuch ---------- */

export interface Quest {
  id: string;
  titel: string;
  notiz: string;
  erledigt: boolean;
}

export interface LogbuchZustand {
  notizen: string;
  quests: Quest[];
}

/* ---------- Kampf-Tracker (nur zur Laufzeit, wird nicht gespeichert) ---------- */

export type Seite = "crew" | "gegner";

export interface Kaempfer {
  id: string;
  charId: string | null;
  name: string;
  seite: Seite;
  iniAtt: AttributName;
  ini: number | null;
  hp: number;
  maxHp: number;
  tot: boolean;
  iniMod?: number;
  atkMod?: number;
  atkDmg?: string;
}

/* ---------- Würfeltisch ---------- */

export type WurfArt = "wurf" | "probe" | "schaden" | "initiative";
export type Verdikt = "ok" | "mid" | "fail";
export type Wuerfelseiten = 4 | 6 | 8 | 10 | 12 | 20 | 100;

export interface Wuerfelgruppe {
  n: number;
  sides: Wuerfelseiten;
}

/** Ein angestoßener Wurf — steuert den Vollbild-Würfeltisch. */
export interface WurfSpezifikation {
  id: number;
  count: number;
  sides: Wuerfelseiten;
  att: AttributName | null;
  label: string | null;
  flat: number;
  kind: WurfArt;
  /** Gemischter Schaden (z. B. W8 + W6) wird gruppenweise nacheinander geworfen. */
  groups?: Wuerfelgruppe[];
  groupIndex?: number;
  carriedVals?: number[];
  backTo?: TabName | null;
  fighterId?: string | null;
}

export interface WurfErgebnis {
  vals: number[];
  sum: number;
  mod: number;
  total: number;
  att: AttributName | null;
  verdict: Verdikt | null;
  sides: Wuerfelseiten;
  label: string | null;
  kind: WurfArt;
  flat: number;
  fighterId: string | null;
}

/* ---------- Navigation ---------- */

export type TabName =
  | "bogen" | "wuerfel" | "kampf" | "karte"
  | "zeichnen" | "detail" | "notizen" | "crew";

export type SystemName = "pnp" | "dnd";

/* ---------- Gesamtzustand einer Kampagne ---------- */

export interface KampagnenDaten {
  chars: Charakter[];
  crew: Crew;
  karte: KartenZustand;
  zeichnung: ZeichnungZustand;
  schauplatz: SchauplatzZustand;
  logbuch: LogbuchZustand;
}
