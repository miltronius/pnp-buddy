import { useEffect, useRef, useState } from "react";

export interface AcOption {
  label: string;
  sublabel?: string;
  icon?: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  optionen: AcOption[];
  placeholder?: string;
  className?: string;
  dropdown?: boolean;
}

export function Autocomplete({ value, onChange, optionen, placeholder, className, dropdown }: Props) {
  const [offen, setOffen] = useState(false);
  const [aktiv, setAktiv] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = value.toLowerCase().trim();
  const treffer = dropdown
    ? optionen
    : (q
        ? optionen.filter(o =>
            o.label.toLowerCase().includes(q) ||
            (o.sublabel?.toLowerCase().includes(q) ?? false)
          )
        : optionen);

  const selectedOption = dropdown ? optionen.find(o => o.label === value) : undefined;
  const displayValue = dropdown && selectedOption?.icon
    ? `${selectedOption.icon} ${selectedOption.label}`
    : value;

  useEffect(() => {
    setAktiv(-1);
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOffen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function waehlen(option: AcOption) {
    onChange(option.label);
    setOffen(false);
    setAktiv(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!offen || treffer.length === 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setOffen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAktiv(a => Math.min(a + 1, treffer.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAktiv(a => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && aktiv >= 0) {
      e.preventDefault();
      waehlen(treffer[aktiv]);
    } else if (e.key === 'Escape') {
      setOffen(false);
    }
  }

  const zeigeDropdown = offen && treffer.length > 0;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        className={`${className ?? ''} ac-input`}
        value={displayValue}
        placeholder={placeholder}
        readOnly={dropdown}
        onChange={dropdown ? () => {} : e => { onChange(e.target.value); setOffen(true); }}
        onFocus={dropdown ? undefined : () => setOffen(true)}
        onClick={dropdown ? () => setOffen(o => !o) : undefined}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        style={{ paddingRight: '1.75rem', cursor: dropdown ? 'pointer' : undefined }}
      />
      <span className="ac-chevron" aria-hidden>▾</span>
      {zeigeDropdown && (
        <ul className="ac-dropdown">
          {treffer.map((o, i) => (
            <li
              key={o.label}
              className={`ac-option ${i === aktiv ? 'aktiv' : ''}`}
              onMouseDown={() => waehlen(o)}
              onMouseEnter={() => setAktiv(i)}
            >
              {o.icon && <span style={{ marginRight: '0.4em' }}>{o.icon}</span>}
              {o.label}
              {o.sublabel && (
                <span className="ac-sublabel"> ({o.sublabel})</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
