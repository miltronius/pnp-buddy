/* ============================================================
   Sitzungs-Zustand: alles, was nur für die laufende Runde gilt
   und nicht gespeichert wird — offener Reiter, Kampf-Tracker und
   der Würfeltisch.
   Die Wurf-Logik ist 1:1 aus dem Prototyp übernommen.
   ============================================================ */

import {
  createContext, useCallback, useContext, useState,
  type Dispatch, type ReactNode, type SetStateAction,
} from "react";
import { ausgleich, neueId, parseDamage } from "../lib/spiel";
import { useKampagne } from "./KampagneContext";
import type {
  AttributName, Charakter, Kaempfer, TabName, Waffe, Wuerfelgruppe,
  Wuerfelseiten, WurfErgebnis, WurfSpezifikation,
} from "../types";

interface WurfOptionen {
  count?: number;
  sides?: Wuerfelseiten;
  att?: AttributName | null;
  label?: string | null;
  flat?: number;
  kind?: WurfSpezifikation["kind"];
  backTo?: TabName | null;
}

export interface SitzungWert {
  tab: TabName;
  setTab: (t: TabName) => void;

  /* Würfeltisch */
  count: number;
  setCount: (n: number) => void;
  sides: Wuerfelseiten;
  setSides: (s: Wuerfelseiten) => void;
  probeAtt: AttributName | "";
  setProbeAtt: (a: AttributName | "") => void;
  throwSpec: WurfSpezifikation | null;
  result: WurfErgebnis | null;
  history: WurfErgebnis[];

  roll: (opts?: WurfOptionen) => void;
  probe: (att: AttributName) => void;
  rollDamage: (waffe: Pick<Waffe, "name" | "schaden">, opts?: { label?: string; backTo?: TabName | null }) => void;
  rollProbeFor: (att: AttributName, label: string, opts?: { flat?: number; backTo?: TabName | null }) => void;
  rollFlat: (label: string, flat: number, opts?: { backTo?: TabName | null }) => void;
  rollInitiative: (f: Kaempfer, char: Charakter | null) => void;
  handleSettled: (vals: number[]) => void;
  rerollCurrent: () => void;
  closeTable: () => void;

  /* Kampf-Tracker */
  fighters: Kaempfer[];
  setFighters: Dispatch<SetStateAction<Kaempfer[]>>;
  turnIdx: number;
  setTurnIdx: (n: number) => void;
  round: number;
  setRound: (n: number) => void;
  combatActive: boolean;
  setCombatActive: (b: boolean) => void;
}

const Ctx = createContext<SitzungWert | null>(null);

export function useSitzung(): SitzungWert {
  const wert = useContext(Ctx);
  if (!wert) throw new Error("useSitzung braucht einen <SitzungProvider>");
  return wert;
}

export function SitzungProvider({ children }: { children: ReactNode }) {
  const { active, zeigeToast } = useKampagne();

  const [tab, setTab] = useState<TabName>("bogen");

  const [count, setCount] = useState(2);
  const [sides, setSides] = useState<Wuerfelseiten>(6);
  const [probeAtt, setProbeAtt] = useState<AttributName | "">("");
  const [throwSpec, setThrowSpec] = useState<WurfSpezifikation | null>(null);
  const [result, setResult] = useState<WurfErgebnis | null>(null);
  const [history, setHistory] = useState<WurfErgebnis[]>([]);

  const [fighters, setFighters] = useState<Kaempfer[]>([]);
  const [turnIdx, setTurnIdx] = useState(0);
  const [round, setRound] = useState(1);
  const [combatActive, setCombatActive] = useState(false);

  /* ---------- Werfen ---------- */

  const roll = useCallback((opts: WurfOptionen = {}) => {
    const n = opts.count ?? count;
    const s = opts.sides ?? sides;
    const att = opts.att !== undefined ? opts.att : (probeAtt || null);
    setResult(null);
    setThrowSpec({
      id: Date.now(),
      count: n,
      sides: s,
      att,
      label: opts.label ?? null,
      flat: opts.flat ?? 0,
      kind: opts.kind ?? (att ? "probe" : "wurf"),
      backTo: opts.backTo ?? null,
    });
  }, [count, sides, probeAtt]);

  const probe = useCallback((attName: AttributName) => {
    setProbeAtt(attName);
    setCount(2);
    setSides(6);
    roll({ count: 2, sides: 6, att: attName });
  }, [roll]);

  /** Schaden einer Waffe: alle Würfelgruppen zusammen + fester Bonus. */
  const rollDamage = useCallback((
    waffe: Pick<Waffe, "name" | "schaden">,
    opts: { label?: string; backTo?: TabName | null } = {},
  ) => {
    const parts = parseDamage(waffe.schaden);
    const diceParts = parts.filter(x => x.sides !== undefined);
    const flat = parts
      .filter(x => x.flat != null)
      .reduce((a, x) => a + (x.flat ?? 0), 0);
    if (!diceParts.length && !flat) {
      zeigeToast("Kein gültiger Schadenswurf hinterlegt");
      return;
    }
    const groups: Wuerfelgruppe[] = diceParts.map(d => ({ n: d.n as number, sides: d.sides as Wuerfelseiten }));
    setResult(null);
    setThrowSpec({
      id: Date.now(),
      groups,
      flat,
      label: opts.label ?? `Schaden — ${waffe.name || "Waffe"}`,
      kind: "schaden",
      backTo: opts.backTo ?? null,
      // Die erste Gruppe füttert die Felder, mit denen der Tisch startet.
      count: groups[0]?.n ?? 1,
      sides: groups[0]?.sides ?? 6,
      att: null,
    });
    setTab("wuerfel");
  }, [zeigeToast]);

  /** Probe direkt aus einem Skill, einer Waffe oder einer Fruchtkraft. */
  const rollProbeFor = useCallback((
    attName: AttributName,
    label: string,
    opts: { flat?: number; backTo?: TabName | null } = {},
  ) => {
    setResult(null);
    setThrowSpec({
      id: Date.now(),
      count: 2, sides: 6, att: attName,
      label, kind: "probe", flat: opts.flat ?? 0,
      backTo: opts.backTo ?? null,
    });
    setTab("wuerfel");
  }, []);

  /** Fester Wurf ohne Charakterbezug (z. B. Gegner-Angriff): 2W6 + Bonus. */
  const rollFlat = useCallback((
    label: string,
    flat: number,
    opts: { backTo?: TabName | null } = {},
  ) => {
    setResult(null);
    setThrowSpec({
      id: Date.now(),
      count: 2, sides: 6, att: null,
      label, kind: "probe", flat: flat || 0,
      backTo: opts.backTo ?? null,
    });
    setTab("wuerfel");
  }, []);

  /** Initiative eines Kämpfers auf dem echten Würfeltisch werfen. */
  const rollInitiative = useCallback((f: Kaempfer, char: Charakter | null) => {
    setResult(null);
    if (char) {
      // Crew: 2W6 + Ausgleich des gewählten Attributs
      setThrowSpec({
        id: Date.now(), count: 2, sides: 6, att: f.iniAtt,
        label: `Initiative — ${f.name}`, kind: "initiative", flat: 0,
        fighterId: f.id, backTo: "kampf",
      });
    } else {
      // Gegner: 2W6 + fester Ini-Modifikator
      setThrowSpec({
        id: Date.now(), count: 2, sides: 6, att: null,
        label: `Initiative — ${f.name || "Gegner"}`, kind: "initiative",
        flat: Number(f.iniMod) || 0, fighterId: f.id, backTo: "kampf",
      });
    }
    setTab("wuerfel");
  }, []);

  const handleSettled = useCallback((vals: number[]) => {
    const spec = throwSpec;
    if (!spec) return;

    // Gemischter Schaden (z. B. W8 + W6): weitere Gruppen nacheinander werfen
    if (spec.groups && spec.groups.length > 1 && (spec.groupIndex ?? 0) < spec.groups.length - 1) {
      const gi = spec.groupIndex ?? 0;
      const carried = [...(spec.carriedVals ?? []), ...vals];
      const next = spec.groups[gi + 1];
      setThrowSpec({
        ...spec,
        id: Date.now(),
        groupIndex: gi + 1,
        carriedVals: carried,
        count: next.n,
        sides: next.sides,
      });
      return;
    }

    const allVals = [...(spec.carriedVals ?? []), ...vals];
    const sum = allVals.reduce((a, b) => a + b, 0);
    const attMod = spec.att ? ausgleich(active?.attribute[spec.att]) : 0;
    const flat = spec.flat || 0;
    const mod = attMod + flat;
    const total = sum + mod;
    const verdict = spec.kind === "probe" && spec.att
      ? (total >= 10 ? "ok" : total >= 7 ? "mid" : "fail")
      : null;

    const res: WurfErgebnis = {
      vals: allVals, sum, mod, total, att: spec.att, verdict,
      sides: spec.sides, label: spec.label, kind: spec.kind, flat,
      fighterId: spec.fighterId ?? null,
    };
    setResult(res);
    setHistory(h => [res, ...h].slice(0, 8));

    // Initiative-Wurf: Ergebnis dem Kämpfer zuweisen
    if (spec.kind === "initiative" && spec.fighterId) {
      setFighters(fs => fs.map(f => (f.id === spec.fighterId ? { ...f, ini: total } : f)));
    }
  }, [throwSpec, active]);

  const rerollCurrent = useCallback(() => {
    const ts = throwSpec;
    if (!ts) return;
    setResult(null);
    if (ts.kind === "schaden" && ts.groups) {
      const first = ts.groups[0];
      setThrowSpec({ ...ts, id: Date.now(), groupIndex: 0, carriedVals: [], count: first.n, sides: first.sides });
    } else {
      setThrowSpec({ ...ts, id: Date.now(), groupIndex: 0, carriedVals: [] });
    }
  }, [throwSpec]);

  const closeTable = useCallback(() => {
    const back = throwSpec && (throwSpec.backTo || (throwSpec.kind === "initiative" ? "kampf" : null));
    setThrowSpec(null);
    setResult(null);
    if (back) setTab(back);
  }, [throwSpec]);

  const wert: SitzungWert = {
    tab, setTab,
    count, setCount, sides, setSides, probeAtt, setProbeAtt,
    throwSpec, result, history,
    roll, probe, rollDamage, rollProbeFor, rollFlat, rollInitiative,
    handleSettled, rerollCurrent, closeTable,
    fighters, setFighters, turnIdx, setTurnIdx,
    round, setRound, combatActive, setCombatActive,
  };

  return <Ctx.Provider value={wert}>{children}</Ctx.Provider>;
}

/* ---------- Hilfen für den Kampf-Tracker ---------- */

export function neuerKaempferId(): string {
  return neueId("f");
}
