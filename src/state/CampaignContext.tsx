import {
  createContext, useCallback, useContext, useEffect,
  useMemo, useRef, useState,
  type Dispatch, type ReactNode, type SetStateAction,
} from "react";
import { useAutosave } from "../hooks/useAutosave";
import { createStorage, type Storage } from "../lib/storage";
import {
  newCrew, newMap, newCharacter, newScene,
  newLogbook, newDrawing,
} from "../lib/game";
import type {
  Charakter, Crew, KartenZustand, LogbuchZustand,
  SchauplatzZustand, ZeichnungZustand,
} from "../types";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface CampaignValue {
  storage: Storage;
  loading: boolean;
  loadError: string | null;

  chars: Charakter[];
  setChars: Dispatch<SetStateAction<Charakter[]>>;
  activeId: string | null;
  setActiveId: (id: string) => void;
  active: Charakter;

  crew: Crew;
  setCrew: Dispatch<SetStateAction<Crew>>;
  map: KartenZustand;
  setMap: Dispatch<SetStateAction<KartenZustand>>;
  drawing: ZeichnungZustand;
  setDrawing: Dispatch<SetStateAction<ZeichnungZustand>>;
  scene: SchauplatzZustand;
  setScene: Dispatch<SetStateAction<SchauplatzZustand>>;
  logbook: LogbuchZustand;
  setLogbook: Dispatch<SetStateAction<LogbuchZustand>>;

  patch: (p: Partial<Charakter>) => void;
  addCharacter: () => void;
  removeCharacter: () => void;

  saveStatus: SaveStatus;
  saveError: string | null;
  saveNow: (area: Area) => Promise<void>;

  toast: string;
  showToast: (text: string) => void;
}

export type Area = "chars" | "crew" | "map" | "drawing" | "scene" | "logbook" | "all";

const Ctx = createContext<CampaignValue | null>(null);

export function useCampaign(): CampaignValue {
  const value = useContext(Ctx);
  if (!value) throw new Error("useCampaign requires a <CampaignProvider>");
  return value;
}

function errorText(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Unbekannter Fehler";
}

export function CampaignProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const storage = useMemo(() => createStorage(userId), [userId]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [chars, setChars] = useState<Charakter[]>(() => [newCharacter()]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [crew, setCrew] = useState<Crew>(newCrew);
  const [map, setMap] = useState<KartenZustand>(newMap);
  const [drawing, setDrawing] = useState<ZeichnungZustand>(newDrawing);
  const [scene, setScene] = useState<SchauplatzZustand>(newScene);
  const [logbook, setLogbook] = useState<LogbuchZustand>(newLogbook);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    storage.ladeAlles()
      .then(data => {
        if (!active) return;
        const loaded = data.chars.length ? data.chars : [newCharacter()];
        setChars(loaded);
        setActiveId(loaded[0].id);
        setCrew(data.crew);
        setMap(data.karte);
        setDrawing(data.zeichnung);
        setScene(data.schauplatz);
        setLogbook(data.logbuch);
        setLoading(false);
      })
      .catch(e => {
        if (!active) return;
        setLoadError(errorText(e));
        setLoading(false);
      });
    return () => { active = false; };
  }, [storage]);

  const pending = useRef(0);
  const doSave = useCallback(async (work: () => Promise<void>) => {
    pending.current += 1;
    setSaveStatus("saving");
    try {
      await work();
      setSaveError(null);
      if (--pending.current === 0) setSaveStatus("saved");
    } catch (e) {
      pending.current = Math.max(0, pending.current - 1);
      setSaveError(errorText(e));
      setSaveStatus("error");
      throw e;
    }
  }, []);

  const ready = !loading && !loadError;

  const silentSave = useCallback((work: () => Promise<void>) => {
    doSave(work).catch(() => {});
  }, [doSave]);

  useAutosave(chars, ready, w => silentSave(() => storage.speichereCharaktere(w)));
  useAutosave(crew, ready, w => silentSave(() => storage.speichereCrew(w)));
  useAutosave(map, ready, w => silentSave(() => storage.speichereKarte(w)));
  useAutosave(drawing, ready, w => silentSave(() => storage.speichereZeichnung(w)));
  useAutosave(scene, ready, w => silentSave(() => storage.speichereSchauplatz(w)));
  useAutosave(logbook, ready, w => silentSave(() => storage.speichereLogbuch(w)));

  const saveNow = useCallback(async (area: Area) => {
    const tasks: Record<Exclude<Area, "all">, () => Promise<void>> = {
      chars: () => storage.speichereCharaktere(chars),
      crew: () => storage.speichereCrew(crew),
      map: () => storage.speichereKarte(map),
      drawing: () => storage.speichereZeichnung(drawing),
      scene: () => storage.speichereSchauplatz(scene),
      logbook: () => storage.speichereLogbuch(logbook),
    };
    try {
      if (area === "all") {
        await doSave(async () => {
          for (const task of Object.values(tasks)) await task();
        });
      } else {
        await doSave(tasks[area]);
      }
      showToast("Gespeichert ⚓");
    } catch (e) {
      showToast(`Speichern fehlgeschlagen — ${errorText(e)}`);
    }
  }, [doSave, storage, chars, crew, map, drawing, scene, logbook, showToast]);

  const active = useMemo(
    () => chars.find(c => c.id === activeId) ?? chars[0],
    [chars, activeId],
  );

  const patch = useCallback((p: Partial<Charakter>) => {
    setChars(cs => cs.map(c => (c.id === (activeId ?? cs[0]?.id) ? { ...c, ...p } : c)));
  }, [activeId]);

  const addCharacter = useCallback(() => {
    const c = newCharacter();
    setChars(cs => [...cs, c]);
    setActiveId(c.id);
  }, []);

  const removeCharacter = useCallback(() => {
    if (chars.length <= 1) return;
    const id = activeId ?? chars[0].id;
    const rest = chars.filter(c => c.id !== id);
    setChars(rest);
    setActiveId(rest[0].id);
    silentSave(() => storage.loescheCharakter(id));
  }, [chars, activeId, storage, silentSave]);

  const value: CampaignValue = {
    storage, loading, loadError,
    chars, setChars, activeId, setActiveId, active,
    crew, setCrew,
    map, setMap,
    drawing, setDrawing,
    scene, setScene,
    logbook, setLogbook,
    patch, addCharacter, removeCharacter,
    saveStatus, saveError, saveNow,
    toast, showToast,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
