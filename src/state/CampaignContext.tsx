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
  Character, Crew, MapState, LogbookState,
  SceneState, DrawingState,
} from "../types";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface CampaignValue {
  storage: Storage;
  loading: boolean;
  loadError: string | null;

  chars: Character[];
  setChars: Dispatch<SetStateAction<Character[]>>;
  activeId: string | null;
  setActiveId: (id: string) => void;
  active: Character;

  crew: Crew;
  setCrew: Dispatch<SetStateAction<Crew>>;
  map: MapState;
  setMap: Dispatch<SetStateAction<MapState>>;
  drawing: DrawingState;
  setDrawing: Dispatch<SetStateAction<DrawingState>>;
  scene: SceneState;
  setScene: Dispatch<SetStateAction<SceneState>>;
  logbook: LogbookState;
  setLogbook: Dispatch<SetStateAction<LogbookState>>;

  patch: (p: Partial<Character>) => void;
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

  const [chars, setChars] = useState<Character[]>(() => [newCharacter()]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [crew, setCrew] = useState<Crew>(newCrew);
  const [map, setMap] = useState<MapState>(newMap);
  const [drawing, setDrawing] = useState<DrawingState>(newDrawing);
  const [scene, setScene] = useState<SceneState>(newScene);
  const [logbook, setLogbook] = useState<LogbookState>(newLogbook);

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
    storage.loadAll()
      .then(data => {
        if (!active) return;
        const loaded = data.chars.length ? data.chars : [newCharacter()];
        setChars(loaded);
        setActiveId(loaded[0].id);
        setCrew(data.crew);
        setMap(data.map);
        setDrawing(data.drawing);
        setScene(data.scene);
        setLogbook(data.logbook);
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

  useAutosave(chars, ready, w => silentSave(() => storage.saveCharacters(w)));
  useAutosave(crew, ready, w => silentSave(() => storage.saveCrew(w)));
  useAutosave(map, ready, w => silentSave(() => storage.saveMap(w)));
  useAutosave(drawing, ready, w => silentSave(() => storage.saveDrawing(w)));
  useAutosave(scene, ready, w => silentSave(() => storage.saveScene(w)));
  useAutosave(logbook, ready, w => silentSave(() => storage.saveLogbook(w)));

  const saveNow = useCallback(async (area: Area) => {
    const tasks: Record<Exclude<Area, "all">, () => Promise<void>> = {
      chars: () => storage.saveCharacters(chars),
      crew: () => storage.saveCrew(crew),
      map: () => storage.saveMap(map),
      drawing: () => storage.saveDrawing(drawing),
      scene: () => storage.saveScene(scene),
      logbook: () => storage.saveLogbook(logbook),
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

  const patch = useCallback((p: Partial<Character>) => {
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
    silentSave(() => storage.deleteCharacter(id));
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
