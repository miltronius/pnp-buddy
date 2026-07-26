/* ============================================================
   Kampagnen-Zustand: alles, was gespeichert wird.
   Geladen wird einmal beim Start, geschrieben wird entprellt nach
   jeder Änderung. Die Speichern-Knöpfe aus dem Prototyp bleiben —
   sie erzwingen ein sofortiges Schreiben mit Rückmeldung.
   ============================================================ */

import {
  createContext, useCallback, useContext, useEffect,
  useMemo, useRef, useState,
  type Dispatch, type ReactNode, type SetStateAction,
} from "react";
import { useAutosave } from "../hooks/useAutosave";
import { erstelleSpeicher, type Speicher } from "../lib/speicher";
import {
  neueCrew, neueKarte, neuerCharakter, neuerSchauplatz,
  neuesLogbuch, neueZeichnung,
} from "../lib/spiel";
import type {
  Charakter, Crew, KartenZustand, LogbuchZustand,
  SchauplatzZustand, ZeichnungZustand,
} from "../types";

export type SpeicherStatus = "ruhig" | "speichert" | "gespeichert" | "fehler";

export interface KampagneWert {
  speicher: Speicher;
  laedt: boolean;
  ladefehler: string | null;

  chars: Charakter[];
  setChars: Dispatch<SetStateAction<Charakter[]>>;
  activeId: string | null;
  setActiveId: (id: string) => void;
  active: Charakter;

  crew: Crew;
  setCrew: Dispatch<SetStateAction<Crew>>;
  karte: KartenZustand;
  setKarte: Dispatch<SetStateAction<KartenZustand>>;
  zeichnung: ZeichnungZustand;
  setZeichnung: Dispatch<SetStateAction<ZeichnungZustand>>;
  schauplatz: SchauplatzZustand;
  setSchauplatz: Dispatch<SetStateAction<SchauplatzZustand>>;
  logbuch: LogbuchZustand;
  setLogbuch: Dispatch<SetStateAction<LogbuchZustand>>;

  /** Ändert Felder des gerade gewählten Charakters. */
  patch: (p: Partial<Charakter>) => void;
  charAnlegen: () => void;
  charLoeschen: () => void;

  speicherStatus: SpeicherStatus;
  speicherFehler: string | null;
  /** Erzwingt sofortiges Schreiben eines Bereichs (Speichern-Knopf). */
  jetztSpeichern: (bereich: Bereich) => Promise<void>;

  toast: string;
  zeigeToast: (text: string) => void;
}

export type Bereich = "chars" | "crew" | "karte" | "zeichnung" | "schauplatz" | "logbuch" | "alles";

const Ctx = createContext<KampagneWert | null>(null);

export function useKampagne(): KampagneWert {
  const wert = useContext(Ctx);
  if (!wert) throw new Error("useKampagne braucht einen <KampagneProvider>");
  return wert;
}

function fehlerText(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Unbekannter Fehler";
}

export function KampagneProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const speicher = useMemo(() => erstelleSpeicher(userId), [userId]);

  const [laedt, setLaedt] = useState(true);
  const [ladefehler, setLadefehler] = useState<string | null>(null);

  const [chars, setChars] = useState<Charakter[]>(() => [neuerCharakter()]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [crew, setCrew] = useState<Crew>(neueCrew);
  const [karte, setKarte] = useState<KartenZustand>(neueKarte);
  const [zeichnung, setZeichnung] = useState<ZeichnungZustand>(neueZeichnung);
  const [schauplatz, setSchauplatz] = useState<SchauplatzZustand>(neuerSchauplatz);
  const [logbuch, setLogbuch] = useState<LogbuchZustand>(neuesLogbuch);

  const [speicherStatus, setSpeicherStatus] = useState<SpeicherStatus>("ruhig");
  const [speicherFehler, setSpeicherFehler] = useState<string | null>(null);

  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const zeigeToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  /* ---------- Laden ---------- */
  useEffect(() => {
    let aktiv = true;
    setLaedt(true);
    setLadefehler(null);
    speicher.ladeAlles()
      .then(daten => {
        if (!aktiv) return;
        const geladene = daten.chars.length ? daten.chars : [neuerCharakter()];
        setChars(geladene);
        setActiveId(geladene[0].id);
        setCrew(daten.crew);
        setKarte(daten.karte);
        setZeichnung(daten.zeichnung);
        setSchauplatz(daten.schauplatz);
        setLogbuch(daten.logbuch);
        setLaedt(false);
      })
      .catch(e => {
        if (!aktiv) return;
        setLadefehler(fehlerText(e));
        setLaedt(false);
      });
    return () => { aktiv = false; };
  }, [speicher]);

  /* ---------- Schreiben ---------- */
  const laufende = useRef(0);
  const sichern = useCallback(async (arbeit: () => Promise<void>) => {
    laufende.current += 1;
    setSpeicherStatus("speichert");
    try {
      await arbeit();
      setSpeicherFehler(null);
      if (--laufende.current === 0) setSpeicherStatus("gespeichert");
    } catch (e) {
      laufende.current = Math.max(0, laufende.current - 1);
      setSpeicherFehler(fehlerText(e));
      setSpeicherStatus("fehler");
      throw e;
    }
  }, []);

  const bereit = !laedt && !ladefehler;

  const stumm = useCallback((arbeit: () => Promise<void>) => {
    sichern(arbeit).catch(() => { /* Fehler steckt bereits im Status */ });
  }, [sichern]);

  useAutosave(chars, bereit, w => stumm(() => speicher.speichereCharaktere(w)));
  useAutosave(crew, bereit, w => stumm(() => speicher.speichereCrew(w)));
  useAutosave(karte, bereit, w => stumm(() => speicher.speichereKarte(w)));
  useAutosave(zeichnung, bereit, w => stumm(() => speicher.speichereZeichnung(w)));
  useAutosave(schauplatz, bereit, w => stumm(() => speicher.speichereSchauplatz(w)));
  useAutosave(logbuch, bereit, w => stumm(() => speicher.speichereLogbuch(w)));

  const jetztSpeichern = useCallback(async (bereich: Bereich) => {
    const aufgaben: Record<Exclude<Bereich, "alles">, () => Promise<void>> = {
      chars: () => speicher.speichereCharaktere(chars),
      crew: () => speicher.speichereCrew(crew),
      karte: () => speicher.speichereKarte(karte),
      zeichnung: () => speicher.speichereZeichnung(zeichnung),
      schauplatz: () => speicher.speichereSchauplatz(schauplatz),
      logbuch: () => speicher.speichereLogbuch(logbuch),
    };
    try {
      if (bereich === "alles") {
        await sichern(async () => {
          for (const aufgabe of Object.values(aufgaben)) await aufgabe();
        });
      } else {
        await sichern(aufgaben[bereich]);
      }
      zeigeToast("Gespeichert ⚓");
    } catch (e) {
      zeigeToast(`Speichern fehlgeschlagen — ${fehlerText(e)}`);
    }
  }, [sichern, speicher, chars, crew, karte, zeichnung, schauplatz, logbuch, zeigeToast]);

  /* ---------- Charaktere ---------- */
  const active = useMemo(
    () => chars.find(c => c.id === activeId) ?? chars[0],
    [chars, activeId],
  );

  const patch = useCallback((p: Partial<Charakter>) => {
    setChars(cs => cs.map(c => (c.id === (activeId ?? cs[0]?.id) ? { ...c, ...p } : c)));
  }, [activeId]);

  const charAnlegen = useCallback(() => {
    const c = neuerCharakter();
    setChars(cs => [...cs, c]);
    setActiveId(c.id);
  }, []);

  const charLoeschen = useCallback(() => {
    if (chars.length <= 1) return;
    const id = activeId ?? chars[0].id;
    const rest = chars.filter(c => c.id !== id);
    setChars(rest);
    setActiveId(rest[0].id);
    stumm(() => speicher.loescheCharakter(id));
  }, [chars, activeId, speicher, stumm]);

  const wert: KampagneWert = {
    speicher, laedt, ladefehler,
    chars, setChars, activeId, setActiveId, active,
    crew, setCrew,
    karte, setKarte,
    zeichnung, setZeichnung,
    schauplatz, setSchauplatz,
    logbuch, setLogbuch,
    patch, charAnlegen, charLoeschen,
    speicherStatus, speicherFehler, jetztSpeichern,
    toast, zeigeToast,
  };

  return <Ctx.Provider value={wert}>{children}</Ctx.Provider>;
}
