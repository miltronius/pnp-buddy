import type { DnDCharacter } from "../../types/dnd";
import { useT } from "../../i18n";

const SLOT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

interface Props {
  char: DnDCharacter;
  onUseSlot: (level: number) => void;
  onRefillSlot: (level: number) => void;
  onUseResource: (id: string) => void;
  onRefillResource: (id: string) => void;
  onLongRest: () => void;
  onShortRest: () => void;
}

export function DnDResourceHUD({
  char, onUseSlot, onRefillSlot, onUseResource, onRefillResource, onLongRest, onShortRest,
}: Props) {
  const t = useT();

  const activeSlots = SLOT_LEVELS.filter(s => char.spellSlots[s]?.max > 0);
  const hasContent = activeSlots.length > 0 || char.resources.length > 0;

  if (!hasContent) return null;

  return (
    <div className="dnd-hud">
      <div className="dnd-hud-inner">
        <div className="dnd-hud-pools">
          {activeSlots.map(level => {
            const slot = char.spellSlots[level];
            return (
              <div key={level} className="dnd-hud-row">
                <span className="dnd-hud-label">{t.spell_slots_rank} {level}</span>
                <div className="dnd-hud-pips">
                  {Array.from({ length: slot.max }).map((_, i) => {
                    const filled = i < slot.current;
                    return (
                      <button key={i}
                        className={`dnd-hud-pip ${filled ? 'filled' : 'empty'}`}
                        onClick={() => filled ? onUseSlot(level) : onRefillSlot(level)}
                        title={filled ? t.spell_slots_use : t.spell_slots_refill}
                      />
                    );
                  })}
                </div>
                <span className="dnd-hud-count">{slot.current}/{slot.max}</span>
              </div>
            );
          })}

          {char.resources.map(resource => (
            <div key={resource.id} className="dnd-hud-row">
              <span className="dnd-hud-label">{resource.name}</span>
              <div className="dnd-hud-pips">
                {Array.from({ length: resource.max }).map((_, i) => {
                  const filled = i < resource.current;
                  return (
                    <button key={i}
                      className={`dnd-hud-pip resource ${filled ? 'filled' : 'empty'}`}
                      onClick={() => filled ? onUseResource(resource.id) : onRefillResource(resource.id)}
                      title={filled ? t.spell_slots_use : t.spell_slots_refill}
                    />
                  );
                })}
              </div>
              <span className="dnd-hud-count">{resource.current}/{resource.max}</span>
            </div>
          ))}
        </div>

        <div className="dnd-hud-rast">
          <button className="dnd-hud-rast-btn long" onClick={onLongRest}
            title={t.spell_slots_long_rest}>⛺</button>
          <button className="dnd-hud-rast-btn short" onClick={onShortRest}
            title={t.spell_slots_short_rest}>🌙</button>
        </div>
      </div>
    </div>
  );
}
