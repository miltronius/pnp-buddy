import { createCloudStorage } from "./db";
import {
  normalizeCharacter, normalizeCrew, normalizeMap,
  normalizeLogbook, normalizeScene, normalizeDrawing,
} from "./normalize";
import { newCrew, newMap, newCharacter, newScene, newLogbook, newDrawing } from "./game";
import type {
  Character, Crew, CampaignData, MapState,
  LogbookState, SceneState, DrawingState,
} from "../types";

export interface Storage {
  readonly mode: "cloud" | "local";
  loadAll(): Promise<CampaignData>;
  saveCharacters(chars: Character[]): Promise<void>;
  deleteCharacter(id: string): Promise<void>;
  saveCrew(crew: Crew): Promise<void>;
  saveMap(map: MapState): Promise<void>;
  saveDrawing(drawing: DrawingState): Promise<void>;
  saveScene(scene: SceneState): Promise<void>;
  saveLogbook(logbook: LogbookState): Promise<void>;
  /** Accepts a data URL and returns the value to store. */
  saveImage(dataUrl: string): Promise<string>;
  /** Turns the stored value into a displayable URL. */
  imageUrl(value: string | null): string | null;
}

export const STORAGE_KEYS = {
  chars: "gla:chars",
  crew: "gla:crew",
  map: "gla:map",
  drawing: "gla:drawing",
  scene: "gla:detail",
  logbook: "gla:notes",
} as const;

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded — usually caused by an image that is too large
    throw new Error("Too large for browser storage — choose a smaller image");
  }
}

export function createLocalStorage(): Storage {
  return {
    mode: "local",

    async loadAll(): Promise<CampaignData> {
      const rawChars = read(STORAGE_KEYS.chars);
      const chars = Array.isArray(rawChars) && rawChars.length
        ? rawChars.map(normalizeCharacter)
        : [newCharacter()];
      return {
        chars,
        crew: read(STORAGE_KEYS.crew) ? normalizeCrew(read(STORAGE_KEYS.crew)) : newCrew(),
        map: read(STORAGE_KEYS.map) ? normalizeMap(read(STORAGE_KEYS.map)) : newMap(),
        drawing: read(STORAGE_KEYS.drawing) ? normalizeDrawing(read(STORAGE_KEYS.drawing)) : newDrawing(),
        scene: read(STORAGE_KEYS.scene) ? normalizeScene(read(STORAGE_KEYS.scene)) : newScene(),
        logbook: read(STORAGE_KEYS.logbook) ? normalizeLogbook(read(STORAGE_KEYS.logbook)) : newLogbook(),
      };
    },

    async saveCharacters(chars) { write(STORAGE_KEYS.chars, chars); },
    async deleteCharacter() { /* in local mode the whole array is written */ },
    async saveCrew(crew) { write(STORAGE_KEYS.crew, crew); },
    async saveMap(map) { write(STORAGE_KEYS.map, map); },
    async saveDrawing(drawing) { write(STORAGE_KEYS.drawing, drawing); },
    async saveScene(scene) { write(STORAGE_KEYS.scene, scene); },
    async saveLogbook(logbook) { write(STORAGE_KEYS.logbook, logbook); },

    // Locally, images stay as data URLs — there is nowhere else to put them.
    async saveImage(dataUrl) { return dataUrl; },
    imageUrl(value) { return value; },
  };
}

export function createStorage(userId: string | null): Storage {
  return userId ? createCloudStorage(userId) : createLocalStorage();
}
