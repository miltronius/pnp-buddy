import {
  createContext, useCallback, useContext, useState,
  type Dispatch, type ReactNode, type SetStateAction,
} from "react";
import { balanceValue, newId, parseDamage } from "../lib/game";
import { useCampaign } from "./CampaignContext";
import type {
  AttrName, Character, Fighter, TabName, Weapon, DiceGroup,
  DieSides, RollResult, RollSpec,
} from "../types";

interface RollOptions {
  count?: number;
  sides?: DieSides;
  att?: AttrName | null;
  label?: string | null;
  flat?: number;
  kind?: RollSpec["kind"];
  backTo?: TabName | null;
}

export interface SessionValue {
  tab: TabName;
  setTab: (t: TabName) => void;

  /* Dice table */
  count: number;
  setCount: (n: number) => void;
  sides: DieSides;
  setSides: (s: DieSides) => void;
  probeAtt: AttrName | "";
  setProbeAtt: (a: AttrName | "") => void;
  throwSpec: RollSpec | null;
  result: RollResult | null;
  history: RollResult[];

  roll: (opts?: RollOptions) => void;
  probe: (att: AttrName) => void;
  rollDamage: (weapon: Pick<Weapon, "name" | "damage">, opts?: { label?: string; backTo?: TabName | null }) => void;
  rollProbeFor: (att: AttrName, label: string, opts?: { flat?: number; backTo?: TabName | null }) => void;
  rollFlat: (label: string, flat: number, opts?: { backTo?: TabName | null }) => void;
  rollInitiative: (f: Fighter, char: Character | null) => void;
  handleSettled: (vals: number[]) => void;
  rerollCurrent: () => void;
  closeTable: () => void;

  /* Combat tracker */
  fighters: Fighter[];
  setFighters: Dispatch<SetStateAction<Fighter[]>>;
  turnIdx: number;
  setTurnIdx: (n: number) => void;
  round: number;
  setRound: (n: number) => void;
  combatActive: boolean;
  setCombatActive: (b: boolean) => void;
}

const Ctx = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(Ctx);
  if (!value) throw new Error("useSession requires a <SessionProvider>");
  return value;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const { active, showToast } = useCampaign();

  const [tab, setTab] = useState<TabName>("sheet");

  const [count, setCount] = useState(2);
  const [sides, setSides] = useState<DieSides>(6);
  const [probeAtt, setProbeAtt] = useState<AttrName | "">("");
  const [throwSpec, setThrowSpec] = useState<RollSpec | null>(null);
  const [result, setResult] = useState<RollResult | null>(null);
  const [history, setHistory] = useState<RollResult[]>([]);

  const [fighters, setFighters] = useState<Fighter[]>([]);
  const [turnIdx, setTurnIdx] = useState(0);
  const [round, setRound] = useState(1);
  const [combatActive, setCombatActive] = useState(false);

  const roll = useCallback((opts: RollOptions = {}) => {
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
      kind: opts.kind ?? (att ? "check" : "roll"),
      backTo: opts.backTo ?? null,
    });
  }, [count, sides, probeAtt]);

  const probe = useCallback((attName: AttrName) => {
    setProbeAtt(attName);
    setCount(2);
    setSides(6);
    roll({ count: 2, sides: 6, att: attName });
  }, [roll]);

  /** Rolls weapon damage: all dice groups combined + flat bonus. */
  const rollDamage = useCallback((
    weapon: Pick<Weapon, "name" | "damage">,
    opts: { label?: string; backTo?: TabName | null } = {},
  ) => {
    const parts = parseDamage(weapon.damage);
    const diceParts = parts.filter(x => x.sides !== undefined);
    const flat = parts
      .filter(x => x.flat != null)
      .reduce((a, x) => a + (x.flat ?? 0), 0);
    if (!diceParts.length && !flat) {
      showToast("Kein gültiger Schadenswurf hinterlegt");
      return;
    }
    const groups: DiceGroup[] = diceParts.map(d => ({ n: d.n as number, sides: d.sides as DieSides }));
    setResult(null);
    setThrowSpec({
      id: Date.now(),
      groups,
      flat,
      label: opts.label ?? `Schaden — ${weapon.name || "Waffe"}`,
      kind: "damage",
      backTo: opts.backTo ?? null,
      count: groups[0]?.n ?? 1,
      sides: groups[0]?.sides ?? 6,
      att: null,
    });
    setTab("dice");
  }, [showToast]);

  /** Rolls a check from a skill, weapon, or devil fruit power. */
  const rollProbeFor = useCallback((
    attName: AttrName,
    label: string,
    opts: { flat?: number; backTo?: TabName | null } = {},
  ) => {
    setResult(null);
    setThrowSpec({
      id: Date.now(),
      count: 2, sides: 6, att: attName,
      label, kind: "check", flat: opts.flat ?? 0,
      backTo: opts.backTo ?? null,
    });
    setTab("dice");
  }, []);

  /** Flat roll with no character reference (e.g. enemy attack): 2d6 + bonus. */
  const rollFlat = useCallback((
    label: string,
    flat: number,
    opts: { backTo?: TabName | null } = {},
  ) => {
    setResult(null);
    setThrowSpec({
      id: Date.now(),
      count: 2, sides: 6, att: null,
      label, kind: "check", flat: flat || 0,
      backTo: opts.backTo ?? null,
    });
    setTab("dice");
  }, []);

  /** Rolls initiative for a fighter on the real dice table. */
  const rollInitiative = useCallback((f: Fighter, char: Character | null) => {
    setResult(null);
    if (char) {
      setThrowSpec({
        id: Date.now(), count: 2, sides: 6, att: f.initAttr,
        label: `Initiative — ${f.name}`, kind: "initiative", flat: 0,
        fighterId: f.id, backTo: "combat",
      });
    } else {
      setThrowSpec({
        id: Date.now(), count: 2, sides: 6, att: null,
        label: `Initiative — ${f.name || "Gegner"}`, kind: "initiative",
        flat: Number(f.initMod) || 0, fighterId: f.id, backTo: "combat",
      });
    }
    setTab("dice");
  }, []);

  const handleSettled = useCallback((vals: number[]) => {
    const spec = throwSpec;
    if (!spec) return;

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
    const attMod = spec.att ? balanceValue(active?.attrs[spec.att]) : 0;
    const flat = spec.flat || 0;
    const mod = attMod + flat;
    const total = sum + mod;
    const verdict = spec.kind === "check" && spec.att
      ? (total >= 10 ? "ok" : total >= 7 ? "mid" : "fail")
      : null;

    const res: RollResult = {
      vals: allVals, sum, mod, total, att: spec.att, verdict,
      sides: spec.sides, label: spec.label, kind: spec.kind, flat,
      fighterId: spec.fighterId ?? null,
    };
    setResult(res);
    setHistory(h => [res, ...h].slice(0, 8));

    if (spec.kind === "initiative" && spec.fighterId) {
      setFighters(fs => fs.map(f => (f.id === spec.fighterId ? { ...f, initiative: total } : f)));
    }
  }, [throwSpec, active]);

  const rerollCurrent = useCallback(() => {
    const ts = throwSpec;
    if (!ts) return;
    setResult(null);
    if (ts.kind === "damage" && ts.groups) {
      const first = ts.groups[0];
      setThrowSpec({ ...ts, id: Date.now(), groupIndex: 0, carriedVals: [], count: first.n, sides: first.sides });
    } else {
      setThrowSpec({ ...ts, id: Date.now(), groupIndex: 0, carriedVals: [] });
    }
  }, [throwSpec]);

  const closeTable = useCallback(() => {
    const back = throwSpec && (throwSpec.backTo || (throwSpec.kind === "initiative" ? "combat" : null));
    setThrowSpec(null);
    setResult(null);
    if (back) setTab(back);
  }, [throwSpec]);

  const value: SessionValue = {
    tab, setTab,
    count, setCount, sides, setSides, probeAtt, setProbeAtt,
    throwSpec, result, history,
    roll, probe, rollDamage, rollProbeFor, rollFlat, rollInitiative,
    handleSettled, rerollCurrent, closeTable,
    fighters, setFighters, turnIdx, setTurnIdx,
    round, setRound, combatActive, setCombatActive,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function newFighterId(): string {
  return newId("f");
}
