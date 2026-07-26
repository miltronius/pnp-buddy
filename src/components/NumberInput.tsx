import { useEffect, useRef, useState, type CSSProperties } from "react";

/* ---------- Zahlenfeld ohne "hängende Null" ----------
   Hält während des Tippens den Rohtext, damit man das Feld leeren und
   frei eingeben kann. Der Wert wird erst beim Ändern gemeldet und beim
   Verlassen auf die Grenzen (min/max) normalisiert. */

interface Props {
  value: number;
  onChange: (wert: number) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

export function NumberInput({ value, onChange, min, max, placeholder, className, style, ariaLabel }: Props) {
  const [text, setText] = useState(String(value ?? ""));
  const focused = useRef(false);

  // Externe Änderungen übernehmen, solange man nicht selbst tippt
  useEffect(() => {
    if (!focused.current) setText(String(value ?? ""));
  }, [value]);

  const clamp = (n: number) => {
    if (min != null && n < min) n = min;
    if (max != null && n > max) n = max;
    return n;
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      className={className}
      style={style}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={text}
      onFocus={() => { focused.current = true; }}
      onChange={(e) => {
        let raw = e.target.value.replace(/[^0-9-]/g, "");
        // Minus nur führend erlauben
        raw = raw.replace(/(?!^)-/g, "");
        setText(raw);
        if (raw === "" || raw === "-") {
          onChange(min != null && min > 0 ? min : 0);
          return;
        }
        const n = parseInt(raw, 10);
        // Beim Tippen nur die Obergrenze wahren (damit man z. B. nicht 999 erzeugt);
        // die Untergrenze greift erst beim Verlassen, sonst "springt" das Feld.
        if (!Number.isNaN(n)) onChange(max != null && n > max ? max : n);
      }}
      onBlur={() => {
        focused.current = false;
        let n = parseInt(text, 10);
        if (Number.isNaN(n)) n = min != null ? min : 0;
        n = clamp(n);
        setText(String(n));
        onChange(n);
      }}
    />
  );
}
