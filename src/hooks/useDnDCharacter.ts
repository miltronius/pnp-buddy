import { useCallback, useRef, useState } from "react";
import { emptyCharacter, newId } from "../lib/dndGame";
import { applyClassToCharacter } from "../lib/dndClasses";
import { applySpeciesToCharacter } from "../lib/dndSpecies";
import type { DnDCharacter, DnDFeature, DnDResource, DnDSlotLevel, DnDSpell } from "../types/dnd";

const KEY = 'gla:dnd:char';

function load(): DnDCharacter {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...emptyCharacter(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return emptyCharacter();
}

export function useDnDCharacter() {
  const [char, setCharRaw] = useState<DnDCharacter>(load);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setChar = useCallback((updater: (c: DnDCharacter) => DnDCharacter) => {
    setCharRaw(prev => {
      const next = updater(prev);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      }, 600);
      return next;
    });
  }, []);

  const setField = useCallback(<K extends keyof DnDCharacter>(k: K, v: DnDCharacter[K]) => {
    setChar(c => ({ ...c, [k]: v }));
  }, [setChar]);

  /* ---------- Spell Slots ---------- */

  const useSlot = useCallback((stufe: number) => {
    setChar(c => {
      const s = c.zauberschlitze[stufe];
      if (!s || s.aktuell <= 0) return c;
      return { ...c, zauberschlitze: { ...c.zauberschlitze, [stufe]: { ...s, aktuell: s.aktuell - 1 } } };
    });
  }, [setChar]);

  const refillSlot = useCallback((stufe: number) => {
    setChar(c => {
      const s = c.zauberschlitze[stufe];
      if (!s || s.aktuell >= s.max) return c;
      return { ...c, zauberschlitze: { ...c.zauberschlitze, [stufe]: { ...s, aktuell: s.aktuell + 1 } } };
    });
  }, [setChar]);

  const setSlotMax = useCallback((stufe: number, max: number) => {
    setChar(c => {
      if (max <= 0) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [stufe]: _, ...rest } = c.zauberschlitze;
        return { ...c, zauberschlitze: rest };
      }
      const prev = c.zauberschlitze[stufe];
      const slot: DnDSlotLevel = { max, aktuell: Math.min(prev?.aktuell ?? max, max) };
      return { ...c, zauberschlitze: { ...c.zauberschlitze, [stufe]: slot } };
    });
  }, [setChar]);

  const longRest = useCallback(() => {
    setChar(c => ({
      ...c,
      zauberschlitze: Object.fromEntries(
        Object.entries(c.zauberschlitze).map(([k, v]) => [k, { ...v, aktuell: v.max }])
      ),
      ressourcen: c.ressourcen.map(r => ({ ...r, aktuell: r.max })),
    }));
  }, [setChar]);

  const shortRest = useCallback(() => {
    setChar(c => ({
      ...c,
      ressourcen: c.ressourcen.map(r =>
        r.aufladung === 'SHORT_REST' ? { ...r, aktuell: r.max } : r
      ),
    }));
  }, [setChar]);

  /* ---------- Concentration ---------- */

  const setConcentration = useCallback((id: string | null) => {
    setChar(c => ({ ...c, konzentration: id }));
  }, [setChar]);

  /* ---------- Features ---------- */

  const addFeature = useCallback((m: Omit<DnDFeature, 'id'>) => {
    setChar(c => ({ ...c, merkmale: [...c.merkmale, { ...m, id: newId() }] }));
  }, [setChar]);

  const updateFeature = useCallback((m: DnDFeature) => {
    setChar(c => ({ ...c, merkmale: c.merkmale.map(x => x.id === m.id ? m : x) }));
  }, [setChar]);

  const removeFeature = useCallback((id: string) => {
    setChar(c => ({ ...c, merkmale: c.merkmale.filter(x => x.id !== id) }));
  }, [setChar]);

  /* ---------- Spells ---------- */

  const addSpell = useCallback((z: Omit<DnDSpell, 'id'>) => {
    setChar(c => ({ ...c, zauber: [...c.zauber, { ...z, id: newId() }] }));
  }, [setChar]);

  const updateSpell = useCallback((z: DnDSpell) => {
    setChar(c => ({ ...c, zauber: c.zauber.map(x => x.id === z.id ? z : x) }));
  }, [setChar]);

  const removeSpell = useCallback((id: string) => {
    setChar(c => ({
      ...c,
      zauber: c.zauber.filter(x => x.id !== id),
      konzentration: c.konzentration === id ? null : c.konzentration,
    }));
  }, [setChar]);

  /* ---------- Resources ---------- */

  const useResource = useCallback((id: string) => {
    setChar(c => ({
      ...c,
      ressourcen: c.ressourcen.map(r =>
        r.id === id && r.aktuell > 0 ? { ...r, aktuell: r.aktuell - 1 } : r
      ),
    }));
  }, [setChar]);

  const refillResource = useCallback((id: string) => {
    setChar(c => ({
      ...c,
      ressourcen: c.ressourcen.map(r =>
        r.id === id && r.aktuell < r.max ? { ...r, aktuell: r.aktuell + 1 } : r
      ),
    }));
  }, [setChar]);

  const addResource = useCallback((r: Omit<DnDResource, 'id'>) => {
    setChar(c => ({ ...c, ressourcen: [...c.ressourcen, { ...r, id: newId() }] }));
  }, [setChar]);

  const updateResource = useCallback((r: DnDResource) => {
    setChar(c => ({ ...c, ressourcen: c.ressourcen.map(x => x.id === r.id ? r : x) }));
  }, [setChar]);

  const removeResource = useCallback((id: string) => {
    setChar(c => ({ ...c, ressourcen: c.ressourcen.filter(x => x.id !== id) }));
  }, [setChar]);

  const applyClass = useCallback(() => {
    setChar(c => applySpeciesToCharacter(applyClassToCharacter(c)));
  }, [setChar]);

  const setMetamagic = useCallback((options: string[]) => {
    setChar(c => ({ ...c, metamagic: options }));
  }, [setChar]);

  return {
    char,
    setField,
    applyClass,
    setMetamagic,
    useSlot, refillSlot, setSlotMax,
    longRest, shortRest,
    setConcentration,
    addFeature, updateFeature, removeFeature,
    addSpell, updateSpell, removeSpell,
    useResource, refillResource, addResource, updateResource, removeResource,
  };
}
