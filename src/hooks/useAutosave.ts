import { useEffect, useRef } from "react";

export function useAutosave<T>(
  value: T,
  ready: boolean,
  save: (value: T) => void,
  delayMs = 800,
): void {
  const firstRun = useRef(true);
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (!ready) return;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const timer = setTimeout(() => saveRef.current(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, ready, delayMs]);
}
