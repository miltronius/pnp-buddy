import type { DnDCharakter } from "../../types/dnd";
import { ABILITY_SHORT, DND_SKILLS, modDisplay, skillMod } from "../../lib/dndGame";

interface Props {
  char: DnDCharakter;
  setFeld: <K extends keyof DnDCharakter>(k: K, v: DnDCharakter[K]) => void;
}

export function DnDSkills({ char, setFeld }: Props) {
  function toggleProfi(id: string) {
    const hat = char.skill_profis.includes(id);
    if (hat) {
      setFeld('skill_profis', char.skill_profis.filter(x => x !== id));
      setFeld('skill_expertise', char.skill_expertise.filter(x => x !== id));
    } else {
      setFeld('skill_profis', [...char.skill_profis, id]);
    }
  }

  function toggleExpertise(id: string) {
    if (!char.skill_profis.includes(id)) return;
    const hat = char.skill_expertise.includes(id);
    setFeld('skill_expertise', hat
      ? char.skill_expertise.filter(x => x !== id)
      : [...char.skill_expertise, id]);
  }

  return (
    <div className="sheet" style={{ maxWidth: 620, margin: '0 auto' }}>
      <h2 className="sheet-title">Fähigkeiten</h2>
      <div className="rule" />
      <div className="dnd-skill-legende">
        <span>◆ Profizienz</span>
        <span>◈ Expertise</span>
      </div>
      <div className="dnd-skill-list">
        {DND_SKILLS.map(f => {
          const mod = skillMod(f.id, char);
          const profi = char.skill_profis.includes(f.id);
          const exp = char.skill_expertise.includes(f.id);
          return (
            <div key={f.id} className="dnd-skill-row">
              <button
                className={`dnd-profi-btn ${profi ? 'active' : ''}`}
                onClick={() => toggleProfi(f.id)}
                title="Profizienz umschalten"
              >◆</button>
              <button
                className={`dnd-exp-btn ${exp ? 'active' : ''} ${!profi ? 'gesperrt' : ''}`}
                onClick={() => toggleExpertise(f.id)}
                title="Expertise umschalten (nur mit Profizienz)"
              >◈</button>
              <span className="dnd-skill-name">{f.name}</span>
              <span className="dnd-skill-attr">({ABILITY_SHORT[f.attribut]})</span>
              <span className="dnd-skill-mod">{modDisplay(mod)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
