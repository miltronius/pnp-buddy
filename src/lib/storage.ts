import { createCloudStorage } from "./db";
import {
  normalizeCharacter, normalizeCrew, normalizeMap,
  normalizeLogbook, normalizeScene, normalizeDrawing,
} from "./normalize";
import { newCrew, newMap, newCharacter, newScene, newLogbook, newDrawing } from "./game";
import type {
  Charakter, Crew, KampagnenDaten, KartenZustand,
  LogbuchZustand, SchauplatzZustand, ZeichnungZustand,
} from "../types";

export interface Storage {
  readonly modus: "cloud" | "lokal";
  ladeAlles(): Promise<KampagnenDaten>;
  speichereCharaktere(chars: Charakter[]): Promise<void>;
  loescheCharakter(id: string): Promise<void>;
  speichereCrew(crew: Crew): Promise<void>;
  speichereKarte(karte: KartenZustand): Promise<void>;
  speichereZeichnung(zeichnung: ZeichnungZustand): Promise<void>;
  speichereSchauplatz(schauplatz: SchauplatzZustand): Promise<void>;
  speichereLogbuch(logbuch: LogbuchZustand): Promise<void>;
  /** Nimmt eine Data-URL entgegen und liefert den zu speichernden Wert. */
  bildSpeichern(datenUrl: string): Promise<string>;
  /** Macht aus dem gespeicherten Wert eine anzeigbare URL. */
  bildUrl(wert: string | null): string | null;
}

export const STORAGE_KEYS = {
  chars: "gla:chars",
  crew: "gla:crew",
  karte: "gla:map",
  zeichnung: "gla:drawing",
  schauplatz: "gla:detail",
  logbuch: "gla:notes",
} as const;

function lies(schluessel: string): unknown {
  try {
    const roh = localStorage.getItem(schluessel);
    return roh ? JSON.parse(roh) : null;
  } catch {
    return null;
  }
}

function schreib(schluessel: string, wert: unknown): void {
  try {
    localStorage.setItem(schluessel, JSON.stringify(wert));
  } catch {
    // Quota überschritten — meist ein zu großes Bild
    throw new Error("Zu groß für den Browser-Speicher — kleineres Bild wählen");
  }
}

export function createLocalStorage(): Storage {
  return {
    modus: "lokal",

    async ladeAlles(): Promise<KampagnenDaten> {
      const rohChars = lies(STORAGE_KEYS.chars);
      const chars = Array.isArray(rohChars) && rohChars.length
        ? rohChars.map(normalizeCharacter)
        : [newCharacter()];
      return {
        chars,
        crew: lies(STORAGE_KEYS.crew) ? normalizeCrew(lies(STORAGE_KEYS.crew)) : newCrew(),
        karte: lies(STORAGE_KEYS.karte) ? normalizeMap(lies(STORAGE_KEYS.karte)) : newMap(),
        zeichnung: lies(STORAGE_KEYS.zeichnung) ? normalizeDrawing(lies(STORAGE_KEYS.zeichnung)) : newDrawing(),
        schauplatz: lies(STORAGE_KEYS.schauplatz) ? normalizeScene(lies(STORAGE_KEYS.schauplatz)) : newScene(),
        logbuch: lies(STORAGE_KEYS.logbuch) ? normalizeLogbook(lies(STORAGE_KEYS.logbuch)) : newLogbook(),
      };
    },

    async speichereCharaktere(chars) { schreib(STORAGE_KEYS.chars, chars); },
    async loescheCharakter() { /* im lokalen Modus wird das ganze Array geschrieben */ },
    async speichereCrew(crew) { schreib(STORAGE_KEYS.crew, crew); },
    async speichereKarte(karte) { schreib(STORAGE_KEYS.karte, karte); },
    async speichereZeichnung(zeichnung) { schreib(STORAGE_KEYS.zeichnung, zeichnung); },
    async speichereSchauplatz(schauplatz) { schreib(STORAGE_KEYS.schauplatz, schauplatz); },
    async speichereLogbuch(logbuch) { schreib(STORAGE_KEYS.logbuch, logbuch); },

    // Lokal bleiben Bilder Data-URLs — es gibt keinen Ort, wohin sonst.
    async bildSpeichern(datenUrl) { return datenUrl; },
    bildUrl(wert) { return wert; },
  };
}

export function createStorage(userId: string | null): Storage {
  return userId ? createCloudStorage(userId) : createLocalStorage();
}
