import { useCallback, useRef, useState } from "react";
import { emptyCharacter, newId } from "../lib/dndGame";
import type { DnDCharakter, DnDMerkmal, DnDRessource, DnDSlotStufe, DnDZauber } from "../types/dnd";

const KEY = 'gla:dnd:char';

function laden(): DnDCharakter {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...emptyCharacter(), ...JSON.parse(raw) };
  } catch { /* ignorieren */ }
  return emptyCharacter();
}

export function useDnDCharacter() {
  const [char, setCharRaw] = useState<DnDCharakter>(laden);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setChar = useCallback((updater: (c: DnDCharakter) => DnDCharakter) => {
    setCharRaw(prev => {
      const next = updater(prev);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignorieren */ }
      }, 600);
      return next;
    });
  }, []);

  const setFeld = useCallback(<K extends keyof DnDCharakter>(k: K, v: DnDCharakter[K]) => {
    setChar(c => ({ ...c, [k]: v }));
  }, [setChar]);

  /* ---------- Zauberschlitze ---------- */

  const slotNutzen = useCallback((stufe: number) => {
    setChar(c => {
      const s = c.zauberschlitze[stufe];
      if (!s || s.aktuell <= 0) return c;
      return { ...c, zauberschlitze: { ...c.zauberschlitze, [stufe]: { ...s, aktuell: s.aktuell - 1 } } };
    });
  }, [setChar]);

  const slotAuffuellen = useCallback((stufe: number) => {
    setChar(c => {
      const s = c.zauberschlitze[stufe];
      if (!s || s.aktuell >= s.max) return c;
      return { ...c, zauberschlitze: { ...c.zauberschlitze, [stufe]: { ...s, aktuell: s.aktuell + 1 } } };
    });
  }, [setChar]);

  const slotMaxSetzen = useCallback((stufe: number, max: number) => {
    setChar(c => {
      if (max <= 0) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [stufe]: _, ...rest } = c.zauberschlitze;
        return { ...c, zauberschlitze: rest };
      }
      const prev = c.zauberschlitze[stufe];
      const slot: DnDSlotStufe = { max, aktuell: Math.min(prev?.aktuell ?? max, max) };
      return { ...c, zauberschlitze: { ...c.zauberschlitze, [stufe]: slot } };
    });
  }, [setChar]);

  const langeRast = useCallback(() => {
    setChar(c => ({
      ...c,
      zauberschlitze: Object.fromEntries(
        Object.entries(c.zauberschlitze).map(([k, v]) => [k, { ...v, aktuell: v.max }])
      ),
      ressourcen: c.ressourcen.map(r => ({ ...r, aktuell: r.max })),
    }));
  }, [setChar]);

  const kurzeRast = useCallback(() => {
    setChar(c => ({
      ...c,
      ressourcen: c.ressourcen.map(r =>
        r.aufladung === 'SHORT_REST' ? { ...r, aktuell: r.max } : r
      ),
    }));
  }, [setChar]);

  /* ---------- Konzentration ---------- */

  const setKonzentration = useCallback((id: string | null) => {
    setChar(c => ({ ...c, konzentration: id }));
  }, [setChar]);

  /* ---------- Merkmale ---------- */

  const merkmalHinzu = useCallback((m: Omit<DnDMerkmal, 'id'>) => {
    setChar(c => ({ ...c, merkmale: [...c.merkmale, { ...m, id: newId() }] }));
  }, [setChar]);

  const merkmalAktuell = useCallback((m: DnDMerkmal) => {
    setChar(c => ({ ...c, merkmale: c.merkmale.map(x => x.id === m.id ? m : x) }));
  }, [setChar]);

  const merkmalLoeschen = useCallback((id: string) => {
    setChar(c => ({ ...c, merkmale: c.merkmale.filter(x => x.id !== id) }));
  }, [setChar]);

  /* ---------- Zauber ---------- */

  const zauberHinzu = useCallback((z: Omit<DnDZauber, 'id'>) => {
    setChar(c => ({ ...c, zauber: [...c.zauber, { ...z, id: newId() }] }));
  }, [setChar]);

  const zauberAktuell = useCallback((z: DnDZauber) => {
    setChar(c => ({ ...c, zauber: c.zauber.map(x => x.id === z.id ? z : x) }));
  }, [setChar]);

  const zauberLoeschen = useCallback((id: string) => {
    setChar(c => ({
      ...c,
      zauber: c.zauber.filter(x => x.id !== id),
      konzentration: c.konzentration === id ? null : c.konzentration,
    }));
  }, [setChar]);

  /* ---------- Ressourcen ---------- */

  const ressourceNutzen = useCallback((id: string) => {
    setChar(c => ({
      ...c,
      ressourcen: c.ressourcen.map(r =>
        r.id === id && r.aktuell > 0 ? { ...r, aktuell: r.aktuell - 1 } : r
      ),
    }));
  }, [setChar]);

  const ressourceZurueck = useCallback((id: string) => {
    setChar(c => ({
      ...c,
      ressourcen: c.ressourcen.map(r =>
        r.id === id && r.aktuell < r.max ? { ...r, aktuell: r.aktuell + 1 } : r
      ),
    }));
  }, [setChar]);

  const ressourceHinzu = useCallback((r: Omit<DnDRessource, 'id'>) => {
    setChar(c => ({ ...c, ressourcen: [...c.ressourcen, { ...r, id: newId() }] }));
  }, [setChar]);

  const ressourceAktuell = useCallback((r: DnDRessource) => {
    setChar(c => ({ ...c, ressourcen: c.ressourcen.map(x => x.id === r.id ? r : x) }));
  }, [setChar]);

  const ressourceLoeschen = useCallback((id: string) => {
    setChar(c => ({ ...c, ressourcen: c.ressourcen.filter(x => x.id !== id) }));
  }, [setChar]);

  return {
    char,
    setFeld,
    slotNutzen, slotAuffuellen, slotMaxSetzen,
    langeRast, kurzeRast,
    setKonzentration,
    merkmalHinzu, merkmalAktuell, merkmalLoeschen,
    zauberHinzu, zauberAktuell, zauberLoeschen,
    ressourceNutzen, ressourceZurueck, ressourceHinzu, ressourceAktuell, ressourceLoeschen,
  };
}
