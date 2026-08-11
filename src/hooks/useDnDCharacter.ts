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
      const s = c.spellSlots[stufe];
      if (!s || s.current <= 0) return c;
      return { ...c, spellSlots: { ...c.spellSlots, [stufe]: { ...s, current: s.current - 1 } } };
    });
  }, [setChar]);

  const refillSlot = useCallback((stufe: number) => {
    setChar(c => {
      const s = c.spellSlots[stufe];
      if (!s || s.current >= s.max) return c;
      return { ...c, spellSlots: { ...c.spellSlots, [stufe]: { ...s, current: s.current + 1 } } };
    });
  }, [setChar]);

  const setSlotMax = useCallback((stufe: number, max: number) => {
    setChar(c => {
      if (max <= 0) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [stufe]: _, ...rest } = c.spellSlots;
        return { ...c, spellSlots: rest };
      }
      const prev = c.spellSlots[stufe];
      const slot: DnDSlotLevel = { max, current: Math.min(prev?.current ?? max, max) };
      return { ...c, spellSlots: { ...c.spellSlots, [stufe]: slot } };
    });
  }, [setChar]);

  const longRest = useCallback(() => {
    setChar(c => ({
      ...c,
      spellSlots: Object.fromEntries(
        Object.entries(c.spellSlots).map(([k, v]) => [k, { ...v, current: v.max }])
      ),
      resources: c.resources.map(r => ({ ...r, current: r.max })),
    }));
  }, [setChar]);

  const shortRest = useCallback(() => {
    setChar(c => ({
      ...c,
      resources: c.resources.map(r =>
        r.recharge === 'SHORT_REST' ? { ...r, current: r.max } : r
      ),
    }));
  }, [setChar]);

  /* ---------- Concentration ---------- */

  const setConcentration = useCallback((id: string | null) => {
    setChar(c => ({ ...c, concentration: id }));
  }, [setChar]);

  /* ---------- Features ---------- */

  const addFeature = useCallback((m: Omit<DnDFeature, 'id'>) => {
    setChar(c => ({ ...c, features: [...c.features, { ...m, id: newId() }] }));
  }, [setChar]);

  const updateFeature = useCallback((m: DnDFeature) => {
    setChar(c => ({ ...c, features: c.features.map(x => x.id === m.id ? m : x) }));
  }, [setChar]);

  const removeFeature = useCallback((id: string) => {
    setChar(c => ({ ...c, features: c.features.filter(x => x.id !== id) }));
  }, [setChar]);

  /* ---------- Spells ---------- */

  const addSpell = useCallback((z: Omit<DnDSpell, 'id'>) => {
    setChar(c => ({ ...c, spells: [...c.spells, { ...z, id: newId() }] }));
  }, [setChar]);

  const updateSpell = useCallback((z: DnDSpell) => {
    setChar(c => ({ ...c, spells: c.spells.map(x => x.id === z.id ? z : x) }));
  }, [setChar]);

  const removeSpell = useCallback((id: string) => {
    setChar(c => ({
      ...c,
      spells: c.spells.filter(x => x.id !== id),
      concentration: c.concentration === id ? null : c.concentration,
    }));
  }, [setChar]);

  /* ---------- Resources ---------- */

  const useResource = useCallback((id: string) => {
    setChar(c => ({
      ...c,
      resources: c.resources.map(r =>
        r.id === id && r.current > 0 ? { ...r, current: r.current - 1 } : r
      ),
    }));
  }, [setChar]);

  const refillResource = useCallback((id: string) => {
    setChar(c => ({
      ...c,
      resources: c.resources.map(r =>
        r.id === id && r.current < r.max ? { ...r, current: r.current + 1 } : r
      ),
    }));
  }, [setChar]);

  const addResource = useCallback((r: Omit<DnDResource, 'id'>) => {
    setChar(c => ({ ...c, resources: [...c.resources, { ...r, id: newId() }] }));
  }, [setChar]);

  const updateResource = useCallback((r: DnDResource) => {
    setChar(c => ({ ...c, resources: c.resources.map(x => x.id === r.id ? r : x) }));
  }, [setChar]);

  const removeResource = useCallback((id: string) => {
    setChar(c => ({ ...c, resources: c.resources.filter(x => x.id !== id) }));
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
