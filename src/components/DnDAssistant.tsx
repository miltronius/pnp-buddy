import { useState } from "react";
import { useDnDCharacter } from "../hooks/useDnDCharacter";
import { useT } from "../i18n";
import { DnDSheet } from "./dnd/DnDSheet";
import { DnDSkills } from "./dnd/DnDSkills";
import { DnDFeatures } from "./dnd/DnDFeatures";
import { DnDSpells } from "./dnd/DnDSpells";
import { DnDResourceHUD } from "./dnd/DnDResourceHUD";
import { DnDCombatRound } from "./dnd/DnDCombatRound";

type DnDTab = 'sheet' | 'skills' | 'features' | 'spells' | 'combat';

export function DnDAssistant() {
  const [tab, setTab] = useState<DnDTab>('sheet');
  const t = useT();
  const {
    char, setField, applyClass, setMetamagic,
    useSlot, refillSlot, setSlotMax,
    longRest, shortRest,
    setConcentration,
    addFeature, updateFeature, removeFeature,
    addSpell, updateSpell, removeSpell,
    useResource, refillResource, addResource, removeResource,
  } = useDnDCharacter();

  const TABS: { id: DnDTab; label: string }[] = [
    { id: 'sheet',    label: t.tab_sheet },
    { id: 'skills',   label: t.tab_skills },
    { id: 'features', label: t.tab_features },
    { id: 'spells',   label: t.tab_spells },
    { id: 'combat',   label: t.tab_round },
  ];

  const activeSpell = char.concentration
    ? char.spells.find(s => s.id === char.concentration)
    : null;

  return (
    <div>
      <header className="gla-header">
        <h1>{t.dnd_header}</h1>
        {char.name
          ? <div className="sub">{char.name}{char.charClass ? ` · ${char.charClass}${char.subclass ? ` (${char.subclass})` : ''} · ${t.level} ${char.level}` : ''}</div>
          : <div className="sub">{t.dnd_subtitle}</div>
        }
      </header>

      {activeSpell && (
        <div className="dnd-konz-topbar">
          {t.dnd_concentration}: <strong>{activeSpell.name}</strong>
          <button className="dnd-icon-btn" style={{ marginLeft: 12 }}
            onClick={() => setConcentration(null)}>{t.dnd_concentration_drop}</button>
        </div>
      )}

      <DnDResourceHUD
        char={char}
        onUseSlot={useSlot}
        onRefillSlot={refillSlot}
        onUseResource={useResource}
        onRefillResource={refillResource}
        onLongRest={longRest}
        onShortRest={shortRest}
      />

      <nav className="gla-tabs">
        {TABS.map(tab_ => (
          <button key={tab_.id} className={`gla-tab ${tab === tab_.id ? 'active' : ''}`}
            onClick={() => setTab(tab_.id)}>
            {tab_.label}
          </button>
        ))}
      </nav>

      {tab === 'sheet'    && <DnDSheet char={char} setField={setField} applyClass={applyClass} setMetamagic={setMetamagic} />}
      {tab === 'skills'   && <DnDSkills char={char} setField={setField} />}
      {tab === 'features' && (
        <DnDFeatures char={char}
          addFeature={addFeature}
          updateFeature={updateFeature}
          removeFeature={removeFeature} />
      )}
      {tab === 'spells' && (
        <DnDSpells char={char}
          useSlot={useSlot} refillSlot={refillSlot} setSlotMax={setSlotMax}
          longRest={longRest} shortRest={shortRest}
          setConcentration={setConcentration}
          addSpell={addSpell} updateSpell={updateSpell} removeSpell={removeSpell}
          useResource={useResource} refillResource={refillResource}
          addResource={addResource} removeResource={removeResource} />
      )}
      {tab === 'combat' && <DnDCombatRound char={char} />}
    </div>
  );
}
