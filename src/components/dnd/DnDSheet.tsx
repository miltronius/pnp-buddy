import type { AbilityKey, DnDCharakter } from "../../types/dnd";
import {
  ABILITIES, ABILITY_SHORT, ABILITY_NAMES,
  attributMod, modDisplay, proficiencyBonus, savingThrowMod,
} from "../../lib/dndGame";

interface Props {
  char: DnDCharakter;
  setFeld: <K extends keyof DnDCharakter>(k: K, v: DnDCharakter[K]) => void;
}

export function DnDSheet({ char, setFeld }: Props) {
  const pb = proficiencyBonus(char.stufe);

  function setAttr(key: AbilityKey, val: string) {
    const n = Math.max(1, Math.min(30, parseInt(val) || 10));
    setFeld('attribute', { ...char.attribute, [key]: n });
  }

  function toggleRetProfi(key: AbilityKey) {
    const hat = char.rettungswurf_profis.includes(key);
    setFeld('rettungswurf_profis', hat
      ? char.rettungswurf_profis.filter(x => x !== key)
      : [...char.rettungswurf_profis, key]);
  }

  return (
    <div className="sheet" style={{ maxWidth: 880, margin: '0 auto' }}>
      {/* Grundinfos */}
      <div className="dnd-info-grid">
        <div>
          <div className="field-label">Name</div>
          <input className="gla-input" value={char.name}
            onChange={e => setFeld('name', e.target.value)} />
        </div>
        <div>
          <div className="field-label">Spezies</div>
          <input className="gla-input" value={char.rasse}
            onChange={e => setFeld('rasse', e.target.value)} />
        </div>
        <div>
          <div className="field-label">Klasse</div>
          <input className="gla-input" value={char.klasse}
            onChange={e => setFeld('klasse', e.target.value)} />
        </div>
        <div>
          <div className="field-label">Unterklasse</div>
          <input className="gla-input" value={char.unterklasse}
            onChange={e => setFeld('unterklasse', e.target.value)} />
        </div>
        <div>
          <div className="field-label">Hintergrund</div>
          <input className="gla-input" value={char.hintergrund}
            onChange={e => setFeld('hintergrund', e.target.value)} />
        </div>
        <div>
          <div className="field-label">Stufe</div>
          <input className="gla-input" type="number" min={1} max={20}
            value={char.stufe}
            onChange={e => setFeld('stufe', Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))} />
        </div>
      </div>

      <div className="rule" />

      {/* Kampfwerte */}
      <div className="dnd-kampf-row">
        <div className="dnd-kampf-box">
          <div className="dnd-kampf-label">RK</div>
          <input className="dnd-kampf-input" type="number" min={0} max={30}
            value={char.ruestungsklasse}
            onChange={e => setFeld('ruestungsklasse', parseInt(e.target.value) || 10)} />
        </div>
        <div className="dnd-kampf-box">
          <div className="dnd-kampf-label">LP</div>
          <div className="dnd-hp-row">
            <button className="dnd-hp-btn"
              onClick={() => setFeld('lebenspunkte', Math.max(0, char.lebenspunkte - 1))}>−</button>
            <input className="dnd-kampf-input" type="number" min={0} max={9999}
              value={char.lebenspunkte}
              onChange={e => setFeld('lebenspunkte', parseInt(e.target.value) || 0)} />
            <span className="dnd-hp-sep">/ <input className="dnd-kampf-input-small" type="number" min={1} max={9999}
              value={char.maxLebenspunkte}
              onChange={e => setFeld('maxLebenspunkte', parseInt(e.target.value) || 1)} /></span>
            <button className="dnd-hp-btn"
              onClick={() => setFeld('lebenspunkte', Math.min(char.maxLebenspunkte, char.lebenspunkte + 1))}>+</button>
          </div>
        </div>
        <div className="dnd-kampf-box">
          <div className="dnd-kampf-label">Bewegung</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <input className="dnd-kampf-input" type="number" min={0} max={200}
              value={char.geschwindigkeit}
              onChange={e => setFeld('geschwindigkeit', parseInt(e.target.value) || 30)} />
            <span style={{ fontSize: 12, opacity: 0.6 }}>ft</span>
          </div>
        </div>
        <div className="dnd-kampf-box">
          <div className="dnd-kampf-label">Profizienz</div>
          <div className="dnd-kampf-wert">+{pb}</div>
        </div>
      </div>

      <div className="rule" />

      {/* Attribute */}
      <div className="dnd-attr-grid">
        {ABILITIES.map(key => {
          const val = char.attribute[key];
          const mod = attributMod(val);
          return (
            <div key={key} className="dnd-attr-box">
              <div className="dnd-attr-name">{ABILITY_SHORT[key]}</div>
              <input className="dnd-attr-input" type="number" min={1} max={30}
                value={val} onChange={e => setAttr(key, e.target.value)} />
              <div className="dnd-attr-mod">{modDisplay(mod)}</div>
            </div>
          );
        })}
      </div>

      <div className="rule" />

      {/* Rettungswürfe */}
      <div className="field-label" style={{ marginBottom: 8 }}>Rettungswürfe</div>
      <div className="dnd-saves-grid">
        {ABILITIES.map(key => {
          const mod = savingThrowMod(key, char);
          const profi = char.rettungswurf_profis.includes(key);
          return (
            <label key={key} className="dnd-save-row" onClick={() => toggleRetProfi(key)}>
              <span className={`dnd-profi-dot ${profi ? 'active' : ''}`} />
              <span className="dnd-save-name">{ABILITY_NAMES[key]}</span>
              <span className="dnd-save-mod">{modDisplay(mod)}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
