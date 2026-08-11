import { useState } from "react";
import type { DnDCharacter } from "../../types/dnd";
import { classLevelProgression, METAMAGIC_OPTIONS, type FeatureDef } from "../../lib/dndClasses";
import { speciesLevelProgression } from "../../lib/dndSpecies";
import { useT } from "../../i18n";

interface Props {
  char: DnDCharacter;
  setMetamagic: (options: string[]) => void;
}

interface MergedFeature {
  name: string;
  description: string;
  badge: 'CLASS' | 'SUBCLASS' | 'SPECIES';
}

interface MergedLevelGroup {
  level: number;
  features: MergedFeature[];
}

function mergeProgression(char: DnDCharacter): MergedLevelGroup[] {
  const classPlan = classLevelProgression(char.charClass, char.subclass);
  const speciesPlan = speciesLevelProgression(char.species);

  const byLevel = new Map<number, MergedFeature[]>();

  for (const g of classPlan) {
    byLevel.set(g.level, (byLevel.get(g.level) ?? []).concat(
      g.features.map((f: FeatureDef) => ({ name: f.name, description: f.description, badge: f.herkunft as 'CLASS' | 'SUBCLASS' }))
    ));
  }
  for (const g of speciesPlan) {
    byLevel.set(g.level, (byLevel.get(g.level) ?? []).concat(
      g.features.map(f => ({ name: f.name, description: f.beschreibung, badge: 'SPECIES' as const }))
    ));
  }

  return Array.from(byLevel.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([level, features]) => ({ level, features }));
}

export function DnDClassRoadmap({ char, setMetamagic }: Props) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  const plan = mergeProgression(char);
  if (plan.length === 0) return null;

  const chosen: string[] = char.metamagic ?? [];

  // Each "Metamagie*" feature unlocked adds to the allowed count; base level gives 2, each extra +1
  const unlockedMetamagicCount = plan
    .filter(g => g.level <= char.level)
    .flatMap(g => g.features)
    .filter(f => f.name.startsWith('Metamagie')).length;
  const allowed = unlockedMetamagicCount === 0 ? 0 : unlockedMetamagicCount + 1;

  // Level at which the base Metamagic feature first appears (show picker there)
  const firstMetamagicLevel = plan.find(g => g.features.some(f => f.name === 'Metamagie'))?.level ?? null;

  function toggle(nameEn: string) {
    if (chosen.includes(nameEn)) {
      setMetamagic(chosen.filter(x => x !== nameEn));
    } else if (chosen.length < allowed) {
      setMetamagic([...chosen, nameEn]);
    }
  }

  return (
    <div className="dnd-roadmap">
      <button className="dnd-roadmap-toggle-header" onClick={() => setIsOpen(v => !v)}>
        <span>{t.roadmap_title}</span>
        <span style={{ opacity: 0.5 }}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="dnd-roadmap-body">
          {plan.map(group => {
            const active = group.level <= char.level;
            const isFirstMetamagicRow = group.level === firstMetamagicLevel;

            return (
              <div key={group.level} className={`dnd-roadmap-row${active ? ' active' : ' future'}`}>
                <div className="dnd-roadmap-level">
                  <span className="dnd-roadmap-check">{active ? '✓' : '·'}</span>
                  <span className="dnd-roadmap-level-num">{t.level} {group.level}</span>
                </div>

                <div className="dnd-roadmap-features">
                  {group.features.map((feature, i) => (
                    <div key={i} className="dnd-roadmap-feature">
                      <div className="dnd-roadmap-feature-header">
                        <span className="dnd-herkunft-badge" style={{ fontSize: 10, padding: '1px 5px' }}>
                          {feature.badge === 'SUBCLASS' ? t.source_subclass_abbr
                            : feature.badge === 'SPECIES' ? t.source_species_abbr
                            : t.source_class_abbr}
                        </span>
                        <strong className="dnd-roadmap-feature-name">{feature.name}</strong>
                      </div>
                      {active && feature.description && (
                        <div className="dnd-roadmap-feature-desc">{feature.description}</div>
                      )}
                    </div>
                  ))}

                  {/* Metamagic picker — rendered once at the base Metamagie level */}
                  {isFirstMetamagicRow && allowed > 0 && (
                    <div className="dnd-metamagic-picker">
                      <button
                        className="dnd-metamagic-toggle"
                        onClick={() => setPickerOpen(v => !v)}
                      >
                        {t.roadmap_metamagic_pick
                          .replace('{n}', String(chosen.length))
                          .replace('{max}', String(allowed))}
                        <span style={{ opacity: 0.5, marginLeft: 6 }}>{pickerOpen ? '▲' : '▼'}</span>
                      </button>

                      {pickerOpen && (
                        <div className="dnd-metamagic-options">
                          {METAMAGIC_OPTIONS.map(opt => {
                            const selected = chosen.includes(opt.nameEn);
                            const disabled = !selected && chosen.length >= allowed;
                            return (
                              <button
                                key={opt.nameEn}
                                className={`dnd-metamagic-option${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}`}
                                onClick={() => toggle(opt.nameEn)}
                                disabled={disabled}
                                title={opt.description}
                              >
                                <span className="dnd-metamagic-option-name">{opt.name}</span>
                                <span className="dnd-metamagic-cost">
                                  {typeof opt.cost === 'number'
                                    ? `${opt.cost} ${t.roadmap_cost}`
                                    : opt.cost}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
