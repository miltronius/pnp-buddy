import { useState } from "react";
import { useDnDCharacter } from "../hooks/useDnDCharacter";
import { DnDSheet } from "./dnd/DnDSheet";
import { DnDSkills } from "./dnd/DnDSkills";
import { DnDFeatures } from "./dnd/DnDFeatures";
import { DnDSpells } from "./dnd/DnDSpells";

type DnDTab = 'bogen' | 'faehigkeiten' | 'merkmale' | 'zauber';

const TABS: { id: DnDTab; titel: string }[] = [
  { id: 'bogen', titel: 'Charakterbogen' },
  { id: 'faehigkeiten', titel: 'Fähigkeiten' },
  { id: 'merkmale', titel: 'Merkmale ✦' },
  { id: 'zauber', titel: 'Zauber & Slots' },
];

export function DnDAssistant() {
  const [tab, setTab] = useState<DnDTab>('bogen');
  const {
    char, setFeld,
    slotNutzen, slotAuffuellen, slotMaxSetzen,
    langeRast, kurzeRast,
    setKonzentration,
    merkmalHinzu, merkmalAktuell, merkmalLoeschen,
    zauberHinzu, zauberAktuell, zauberLoeschen,
    ressourceNutzen, ressourceZurueck, ressourceHinzu, ressourceLoeschen,
  } = useDnDCharacter();

  const konzZauber = char.konzentration
    ? char.zauber.find(z => z.id === char.konzentration)
    : null;

  return (
    <div>
      <header className="gla-header">
        <h1>🐉 D&amp;D Abenteurer</h1>
        {char.name
          ? <div className="sub">{char.name}{char.klasse ? ` · ${char.klasse}${char.unterklasse ? ` (${char.unterklasse})` : ''} · Stufe ${char.stufe}` : ''}</div>
          : <div className="sub">D&amp;D 2024 · Spieler-Ansicht</div>
        }
      </header>

      {konzZauber && (
        <div className="dnd-konz-topbar">
          🧿 Konzentration: <strong>{konzZauber.name}</strong>
          <button className="dnd-icon-btn" style={{ marginLeft: 12 }}
            onClick={() => setKonzentration(null)}>✕</button>
        </div>
      )}

      <nav className="gla-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`gla-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}>
            {t.titel}
          </button>
        ))}
      </nav>

      {tab === 'bogen' && <DnDSheet char={char} setFeld={setFeld} />}
      {tab === 'faehigkeiten' && <DnDSkills char={char} setFeld={setFeld} />}
      {tab === 'merkmale' && (
        <DnDFeatures char={char}
          merkmalHinzu={merkmalHinzu}
          merkmalAktuell={merkmalAktuell}
          merkmalLoeschen={merkmalLoeschen} />
      )}
      {tab === 'zauber' && (
        <DnDSpells char={char}
          slotNutzen={slotNutzen} slotAuffuellen={slotAuffuellen} slotMaxSetzen={slotMaxSetzen}
          langeRast={langeRast} kurzeRast={kurzeRast}
          setKonzentration={setKonzentration}
          zauberHinzu={zauberHinzu} zauberAktuell={zauberAktuell} zauberLoeschen={zauberLoeschen}
          ressourceNutzen={ressourceNutzen} ressourceZurueck={ressourceZurueck}
          ressourceHinzu={ressourceHinzu} ressourceLoeschen={ressourceLoeschen} />
      )}
    </div>
  );
}
