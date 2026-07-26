/* ============================================================
   Persistenz-Fassade.
   Die Komponenten kennen nur dieses Interface. Dahinter steckt
   entweder Supabase (angemeldeter Benutzer) oder der Browser-
   Storage (kein Supabase-Projekt konfiguriert). Die Schlüssel
   des lokalen Modus sind bewusst die `gla:*` aus dem Prototyp —
   damit findet eine bestehende Runde ihre Daten wieder.
   ============================================================ */

import { erstelleCloudSpeicher } from "./db";
import {
  normalisiereCharakter, normalisiereCrew, normalisiereKarte,
  normalisiereLogbuch, normalisiereSchauplatz, normalisiereZeichnung,
} from "./normalisieren";
import { neueCrew, neueKarte, neuerCharakter, neuerSchauplatz, neuesLogbuch, neueZeichnung } from "./spiel";
import type {
  Charakter, Crew, KampagnenDaten, KartenZustand,
  LogbuchZustand, SchauplatzZustand, ZeichnungZustand,
} from "../types";

export interface Speicher {
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

export const SCHLUESSEL = {
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

export function erstelleLokalenSpeicher(): Speicher {
  return {
    modus: "lokal",

    async ladeAlles(): Promise<KampagnenDaten> {
      const rohChars = lies(SCHLUESSEL.chars);
      const chars = Array.isArray(rohChars) && rohChars.length
        ? rohChars.map(normalisiereCharakter)
        : [neuerCharakter()];
      return {
        chars,
        crew: lies(SCHLUESSEL.crew) ? normalisiereCrew(lies(SCHLUESSEL.crew)) : neueCrew(),
        karte: lies(SCHLUESSEL.karte) ? normalisiereKarte(lies(SCHLUESSEL.karte)) : neueKarte(),
        zeichnung: lies(SCHLUESSEL.zeichnung) ? normalisiereZeichnung(lies(SCHLUESSEL.zeichnung)) : neueZeichnung(),
        schauplatz: lies(SCHLUESSEL.schauplatz) ? normalisiereSchauplatz(lies(SCHLUESSEL.schauplatz)) : neuerSchauplatz(),
        logbuch: lies(SCHLUESSEL.logbuch) ? normalisiereLogbuch(lies(SCHLUESSEL.logbuch)) : neuesLogbuch(),
      };
    },

    async speichereCharaktere(chars) { schreib(SCHLUESSEL.chars, chars); },
    async loescheCharakter() { /* im lokalen Modus wird das ganze Array geschrieben */ },
    async speichereCrew(crew) { schreib(SCHLUESSEL.crew, crew); },
    async speichereKarte(karte) { schreib(SCHLUESSEL.karte, karte); },
    async speichereZeichnung(zeichnung) { schreib(SCHLUESSEL.zeichnung, zeichnung); },
    async speichereSchauplatz(schauplatz) { schreib(SCHLUESSEL.schauplatz, schauplatz); },
    async speichereLogbuch(logbuch) { schreib(SCHLUESSEL.logbuch, logbuch); },

    // Lokal bleiben Bilder Data-URLs — es gibt keinen Ort, wohin sonst.
    async bildSpeichern(datenUrl) { return datenUrl; },
    bildUrl(wert) { return wert; },
  };
}

/** Cloud-Speicher bei angemeldetem Benutzer, sonst lokaler Speicher. */
export function erstelleSpeicher(userId: string | null): Speicher {
  return userId ? erstelleCloudSpeicher(userId) : erstelleLokalenSpeicher();
}
