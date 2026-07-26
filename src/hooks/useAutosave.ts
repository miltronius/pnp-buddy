import { useEffect, useRef } from "react";

/**
 * Entprelltes Speichern: nach jeder Änderung läuft ein Timer; erst wenn
 * er durchläuft, wird geschrieben. Der erste Durchlauf nach dem Laden
 * wird übersprungen — sonst würde die App die eben gelesenen Daten
 * sofort wieder zurückschreiben.
 */
export function useAutosave<T>(
  wert: T,
  bereit: boolean,
  speichern: (wert: T) => void,
  verzoegerungMs = 800,
): void {
  const ersterLauf = useRef(true);
  const speichernRef = useRef(speichern);
  speichernRef.current = speichern;

  useEffect(() => {
    if (!bereit) return;
    if (ersterLauf.current) {
      ersterLauf.current = false;
      return;
    }
    const timer = setTimeout(() => speichernRef.current(wert), verzoegerungMs);
    return () => clearTimeout(timer);
  }, [wert, bereit, verzoegerungMs]);
}
