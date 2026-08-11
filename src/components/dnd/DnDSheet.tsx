import { useState } from "react";
import type { AbilityKey, DnDCharacter } from "../../types/dnd";
import { ABILITIES, abilityMod as attributMod, modDisplay, proficiencyBonus, savingThrowMod } from "../../lib/dndGame";
import { allClassNames as alleKlassenNamen, classPreview as klasseVorschau, subclassesForClass as unterklassenFuerKlasse } from "../../lib/dndClasses";
import { allSpeciesNames as alleSpeziesNamen } from "../../lib/dndSpecies";
import { allBackgroundNames as alleHintergruende } from "../../lib/dndBackgrounds";
import { useT, useGameLabels, useLang } from "../../i18n";
import { Autocomplete } from "./Autocomplete";
import { DnDClassRoadmap } from "./DnDClassRoadmap";

interface Props {
  char: DnDCharacter;
  setField: <K extends keyof DnDCharacter>(k: K, v: DnDCharacter[K]) => void;
  applyClass: () => void;
  setMetamagic: (options: string[]) => void;
}

export function DnDSheet({ char, setField, applyClass, setMetamagic }: Props) {
  const t = useT();
  const { lang } = useLang();
  const { ABILITY_NAMES, ABILITY_SHORT } = useGameLabels();
  const pb = proficiencyBonus(char.stufe);
  const [bestaetigung, setBestaetigung] = useState(false);

  function setAttr(key: AbilityKey, val: string) {
    const n = Math.max(1, Math.min(30, parseInt(val) || 10));
    setField('attribute', { ...char.attribute, [key]: n });
  }

  function toggleRetProfi(key: AbilityKey) {
    const hat = char.rettungswurf_profis.includes(key);
    setField('rettungswurf_profis', hat
      ? char.rettungswurf_profis.filter(x => x !== key)
      : [...char.rettungswurf_profis, key]);
  }

  const vorschau = bestaetigung ? klasseVorschau(char.klasse, char.unterklasse, char.stufe, lang) : null;

  function bestaetigeAnwenden() {
    applyClass();
    setBestaetigung(false);
  }

  return (
    <div className="sheet" style={{ maxWidth: 880, margin: '0 auto' }}>
      {/* Grundinfos */}
      <div className="dnd-info-grid">
        <div>
          <div className="field-label">{t.name}</div>
          <input className="gla-input" value={char.name}
            onChange={e => setField('name', e.target.value)} />
        </div>
        <div>
          <div className="field-label">{t.dnd_species}</div>
          <Autocomplete
            className="gla-input"
            value={char.rasse}
            optionen={alleSpeziesNamen(lang)}
            onChange={v => setField('rasse', v)}
            dropdown
          />
        </div>
        <div>
          <div className="field-label">{t.dnd_class}</div>
          <Autocomplete
            className="gla-input"
            value={char.klasse}
            optionen={alleKlassenNamen(lang)}
            onChange={v => { setField('klasse', v); setField('unterklasse', ''); setBestaetigung(false); }}
            dropdown
          />
        </div>
        <div>
          <div className="field-label">{t.dnd_subclass}</div>
          <Autocomplete
            className="gla-input"
            value={char.unterklasse}
            optionen={unterklassenFuerKlasse(char.klasse, lang)}
            onChange={v => { setField('unterklasse', v); setBestaetigung(false); }}
            dropdown
          />
        </div>
        <div>
          <div className="field-label">{t.dnd_background}</div>
          <Autocomplete
            className="gla-input"
            value={char.hintergrund}
            optionen={alleHintergruende(lang)}
            onChange={v => setField('hintergrund', v)}
            dropdown
          />
        </div>
        <div>
          <div className="field-label">{t.level}</div>
          <input className="gla-input" type="number" min={1} max={20}
            value={char.stufe}
            onChange={e => { setField('stufe', Math.max(1, Math.min(20, parseInt(e.target.value) || 1))); setBestaetigung(false); }} />
        </div>
      </div>

      {/* Klasse anwenden */}
      {!bestaetigung ? (
        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="gla-btn"
            style={{ fontSize: 13, padding: '5px 14px' }}
            disabled={!char.klasse.trim()}
            onClick={() => setBestaetigung(true)}
            title={t.dnd_apply_class_title}
          >{t.dnd_apply_class}</button>
        </div>
      ) : vorschau && (
        <div className="dnd-klasse-bestaetigung">
          {vorschau.erkannt ? (
            <>
              <span>
                <strong>{vorschau.klasseName}</strong>
                {vorschau.unterklasseName && ` (${vorschau.unterklasseName}${!vorschau.unterklasseErkannt ? ' – ?' : ''})`}
                {` ${t.level} ${char.stufe}`}:
                {` ${vorschau.merkmaleAnzahl} ${t.dnd_apply_features}`}
                {vorschau.ressourcenAnzahl > 0 && `, ${vorschau.ressourcenAnzahl} ${t.dnd_apply_resources}`}
                {vorschau.hatSchlitze && `, ${t.dnd_apply_slots}`}.
                {' '}{t.dnd_apply_replace_note}
              </span>
              <button className="gla-btn primary" style={{ fontSize: 13, padding: '4px 12px' }} onClick={bestaetigeAnwenden}>{t.dnd_apply_confirm}</button>
            </>
          ) : (
            <span style={{ opacity: 0.7 }}>„{char.klasse}" — {t.dnd_apply_unknown}</span>
          )}
          <button className="gla-btn" style={{ fontSize: 13, padding: '4px 10px' }} onClick={() => setBestaetigung(false)}>✕</button>
        </div>
      )}

      <DnDClassRoadmap char={char} setMetamagic={setMetamagic} />

      <div className="rule" />

      {/* Kampfwerte */}
      <div className="dnd-kampf-row">
        <div className="dnd-kampf-box">
          <div className="dnd-kampf-label">{t.dnd_ac}</div>
          <input className="dnd-kampf-input" type="number" min={0} max={30}
            value={char.ruestungsklasse}
            onChange={e => setField('ruestungsklasse', parseInt(e.target.value) || 10)} />
        </div>
        <div className="dnd-kampf-box">
          <div className="dnd-kampf-label">{t.dnd_hp}</div>
          <div className="dnd-hp-row">
            <button className="dnd-hp-btn"
              onClick={() => setField('lebenspunkte', Math.max(0, char.lebenspunkte - 1))}>−</button>
            <input className="dnd-kampf-input" type="number" min={0} max={9999}
              value={char.lebenspunkte}
              onChange={e => setField('lebenspunkte', parseInt(e.target.value) || 0)} />
            <span className="dnd-hp-sep">/ <input className="dnd-kampf-input-small" type="number" min={1} max={9999}
              value={char.maxLebenspunkte}
              onChange={e => setField('maxLebenspunkte', parseInt(e.target.value) || 1)} /></span>
            <button className="dnd-hp-btn"
              onClick={() => setField('lebenspunkte', Math.min(char.maxLebenspunkte, char.lebenspunkte + 1))}>+</button>
          </div>
        </div>
        <div className="dnd-kampf-box">
          <div className="dnd-kampf-label">{t.dnd_speed}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <input className="dnd-kampf-input" type="number" min={0} max={200}
              value={char.geschwindigkeit}
              onChange={e => setField('geschwindigkeit', parseInt(e.target.value) || 30)} />
            <span style={{ fontSize: 12, opacity: 0.6 }}>{t.dnd_speed_unit}</span>
          </div>
        </div>
        <div className="dnd-kampf-box">
          <div className="dnd-kampf-label">{t.dnd_proficiency_bonus}</div>
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
      <div className="field-label" style={{ marginBottom: 8 }}>{t.dnd_saving_throws}</div>
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
