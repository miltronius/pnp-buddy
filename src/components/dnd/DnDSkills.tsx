import type { DnDCharacter } from "../../types/dnd";
import { DND_SKILLS, modDisplay, skillMod } from "../../lib/dndGame";
import { useT, useGameLabels } from "../../i18n";

interface Props {
  char: DnDCharacter;
  setField: <K extends keyof DnDCharacter>(k: K, v: DnDCharacter[K]) => void;
}

export function DnDSkills({ char, setField }: Props) {
  const t = useT();
  const { ABILITY_SHORT, SKILL_NAMES } = useGameLabels();

  function toggleProfi(id: string) {
    const hat = char.skillProficiencies.includes(id);
    if (hat) {
      setField('skillProficiencies', char.skillProficiencies.filter(x => x !== id));
      setField('skillExpertise', char.skillExpertise.filter(x => x !== id));
    } else {
      setField('skillProficiencies', [...char.skillProficiencies, id]);
    }
  }

  function toggleExpertise(id: string) {
    if (!char.skillProficiencies.includes(id)) return;
    const hat = char.skillExpertise.includes(id);
    setField('skillExpertise', hat
      ? char.skillExpertise.filter(x => x !== id)
      : [...char.skillExpertise, id]);
  }

  return (
    <div className="sheet" style={{ maxWidth: 620, margin: '0 auto' }}>
      <h2 className="sheet-title">{t.skills_title}</h2>
      <div className="rule" />
      <div className="dnd-skill-legende">
        <span>{t.skills_proficiency}</span>
        <span>{t.skills_expertise}</span>
      </div>
      <div className="dnd-skill-list">
        {DND_SKILLS.map(f => {
          const mod = skillMod(f.id, char);
          const profi = char.skillProficiencies.includes(f.id);
          const exp = char.skillExpertise.includes(f.id);
          return (
            <div key={f.id} className="dnd-skill-row">
              <button
                className={`dnd-profi-btn ${profi ? 'active' : ''}`}
                onClick={() => toggleProfi(f.id)}
                title={t.skills_toggle_profi}
              >◆</button>
              <button
                className={`dnd-exp-btn ${exp ? 'active' : ''} ${!profi ? 'gesperrt' : ''}`}
                onClick={() => toggleExpertise(f.id)}
                title={t.skills_toggle_exp}
              >◈</button>
              <span className="dnd-skill-name">{SKILL_NAMES[f.id] ?? f.name}</span>
              <span className="dnd-skill-attr">({ABILITY_SHORT[f.ability]})</span>
              <span className="dnd-skill-mod">{modDisplay(mod)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
