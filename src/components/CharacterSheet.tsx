import { ATTRIBUTE, type AttrName, type FruitRank, type Item, type Skill, type Weapon } from "../types";
import { balanceValue, fruitBalance, withSign, newId } from "../lib/game";
import { useCampaign } from "../state/CampaignContext";
import { useSession } from "../state/SessionContext";
import { useT } from "../i18n";
import { exportPdf } from "../lib/pdf";
import { NumberInput } from "./NumberInput";
import { Tally } from "./Tally";

export function CharacterSheet() {
  const { chars, active, activeId, setActiveId, patch, addCharacter, removeCharacter, saveNow, showToast } = useCampaign();
  const { probe, rollProbeFor, rollDamage } = useSession();
  const t = useT();

  const patchAtt = (name: AttrName, val: number) =>
    patch({ attrs: { ...active.attrs, [name]: val } });

  const patchItem = (id: string, p: Partial<Item>) =>
    patch({ inventory: active.inventory.map(it => (it.id === id ? { ...it, ...p } : it)) });
  const addItem = () =>
    patch({ inventory: [...active.inventory, { id: newId("g"), text: "", count: 1 }] });
  const delItem = (id: string) =>
    patch({ inventory: active.inventory.filter(it => it.id !== id) });

  const patchWeapon = (id: string, p: Partial<Weapon>) =>
    patch({ weapons: (active.weapons || []).map(w => (w.id === id ? { ...w, ...p } : w)) });
  const addWeapon = () =>
    patch({ weapons: [...(active.weapons || []), { id: newId("w"), name: "", att: "Nahkampf", damage: "W6" }] });
  const delWeapon = (id: string) =>
    patch({ weapons: (active.weapons || []).filter(w => w.id !== id) });

  const patchSkill = (id: string, p: Partial<Skill>) =>
    patch({ skills: (active.skills || []).map(sk => (sk.id === id ? { ...sk, ...p } : sk)) });
  const addSkill = () =>
    patch({ skills: [...(active.skills || []), { id: newId("s"), name: "", att: "", description: "" }] });
  const delSkill = (id: string) =>
    patch({ skills: (active.skills || []).filter(sk => sk.id !== id) });

  const frucht = active.devilFruit || { name: "", type: "" as const, ranks: [] };
  const patchFrucht = (p: Partial<typeof frucht>) =>
    patch({ devilFruit: { ...frucht, ...p } });
  const patchRank = (id: string, p: Partial<FruitRank>) =>
    patchFrucht({ ranks: (frucht.ranks || []).map(r => (r.id === id ? { ...r, ...p } : r)) });
  const addRank = () =>
    patchFrucht({
      ranks: [...(frucht.ranks || []), {
        id: newId("r"), name: "", description: "", costLevel: 1,
        rollType: "" as const, rollAttr: "Nahkampf" as AttrName, rollDamage: "W6",
        costText: "", unlocked: false,
      }],
    });
  const delRank = (id: string) =>
    patchFrucht({ ranks: (frucht.ranks || []).filter(r => r.id !== id) });
  const rollRank = (r: FruitRank) => {
    if (r.rollType === "check") {
      rollProbeFor(r.rollAttr, `${frucht.name || t.fruit_fruit} — ${r.name || t.fruit_roll}`);
    } else if (r.rollType === "damage") {
      rollDamage({ name: `${frucht.name || t.fruit_fruit} — ${r.name || t.fruit_roll}`, damage: r.rollDamage });
    }
  };

  const bil = fruitBalance(active.level, frucht.ranks);

  const budgetText = bil.available < 0
    ? t.fruit_overcapped.replace('[n]', String(-bil.available))
    : t.fruit_available.replace('[n]', String(bil.available)).replace('[m]', String(active.level));

  return (
    <div style={{ padding: "0 14px" }}>
      <div className="char-switch">
        {chars.map(c => (
          <button
            key={c.id}
            className={`char-chip ${c.id === (activeId ?? active.id) ? "active" : ""}`}
            onClick={() => setActiveId(c.id)}
          >
            {c.name || t.char_nameless}
          </button>
        ))}
        <button className="char-chip" onClick={addCharacter}>{t.char_new}</button>
      </div>

      <div className="sheet">
        <h2 className="sheet-title">{t.char_title}</h2>
        <div className="rule" />

        <div className="grid-2">
          <div>
            <div className="field-label">{t.name}</div>
            <input className="gla-input" value={active.name}
              onChange={e => patch({ name: e.target.value })} />
          </div>
          <div>
            <div className="field-label">
              {t.char_level}
              <span className="tally-btns">
                <button onClick={() => patch({ level: Math.max(0, active.level - 1) })} aria-label="Stufe verringern">−</button>
                <button onClick={() => patch({ level: active.level + 1 })} aria-label="Stufe erhöhen">+</button>
              </span>
            </div>
            <div className="tally"><Tally value={active.level} /></div>
          </div>
        </div>

        <div className="vital-row">
          <div className="vital">
            <span className="icon" aria-hidden>❤</span>
            <div>
              <div className="field-label">{t.char_hp}</div>
              <NumberInput value={active.hp} min={0} onChange={v => patch({ hp: v })} ariaLabel={t.char_hp} />
            </div>
          </div>
          <div className="vital">
            <span className="icon" aria-hidden>⚔</span>
            <div>
              <div className="field-label">{t.char_damage}</div>
              <input style={{ width: 110 }} value={active.damage} aria-label={t.char_damage}
                onChange={e => patch({ damage: e.target.value })} />
            </div>
          </div>
          <div className="vital">
            <span className="icon" aria-hidden>💰</span>
            <div>
              <div className="field-label">{t.char_berries}</div>
              <NumberInput className="berry-input" value={active.berries} min={0}
                onChange={v => patch({ berries: v })} ariaLabel={t.char_berries} />
            </div>
          </div>
        </div>

        <div className="grid-2">
          <div>
            <div className="field-label">{t.char_appearance}</div>
            <textarea className="gla-textarea" value={active.appearance}
              onChange={e => patch({ appearance: e.target.value })} />
          </div>
          <div>
            <div className="field-label">{t.char_goal}</div>
            <textarea className="gla-textarea" value={active.goal}
              onChange={e => patch({ goal: e.target.value })} />
          </div>
        </div>

        <div className="grid-2" style={{ marginTop: 14 }}>
          <div>
            <div className="field-label">{t.char_special}</div>
            <textarea className="gla-textarea" value={active.special}
              onChange={e => patch({ special: e.target.value })} />
          </div>
          <div>
            <div className="field-label">{t.char_traits}</div>
            <textarea className="gla-textarea" value={active.traits}
              onChange={e => patch({ traits: e.target.value })} />
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div className="field-label">{t.char_goods}</div>
          {active.inventory.map(it => (
            <div className="inv-row" key={it.id}>
              <NumberInput className="gla-input qty" min={0} value={it.count}
                onChange={v => patchItem(it.id, { count: v })} ariaLabel="Anzahl" />
              <input className="gla-input" value={it.text} placeholder={t.char_item_placeholder}
                onChange={e => patchItem(it.id, { text: e.target.value })} />
              <button className="inv-del" onClick={() => delItem(it.id)} aria-label={t.remove}>✕</button>
            </div>
          ))}
          <button className="gla-btn" style={{ marginTop: 6 }} onClick={addItem}>{t.char_item_add}</button>
        </div>

        <div className="rule" style={{ marginTop: 24 }} />
        <h3 className="sheet-title" style={{ fontSize: 24, textAlign: "left" }}>{t.char_weapons}</h3>
        <p className="section-hint">{t.char_weapon_hint}</p>
        {(active.weapons || []).length === 0 && (
          <p className="section-empty">{t.char_no_weapons_short}</p>
        )}
        {(active.weapons || []).map(w => (
          <div className="weapon-row" key={w.id}>
            <input className="gla-input w-name" value={w.name}
              onChange={e => patchWeapon(w.id, { name: e.target.value })} />
            <select className="w-att" value={w.att} aria-label={t.weapon_hit_attr}
              onChange={e => patchWeapon(w.id, { att: e.target.value as AttrName })}>
              {ATTRIBUTE.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <input className="gla-input w-dmg" value={w.damage} aria-label={t.char_damage}
              onChange={e => patchWeapon(w.id, { damage: e.target.value })} />
            <button className="w-btn hit" title={t.weapon_hit_roll}
              onClick={() => rollProbeFor(w.att, `Angriff — ${w.name || t.char_weapons}`)}>{t.weapon_hit}</button>
            <button className="w-btn dmg" title={t.weapon_damage_roll}
              onClick={() => rollDamage(w)}>{t.weapon_damage}</button>
            <button className="inv-del" onClick={() => delWeapon(w.id)} aria-label={t.remove}>✕</button>
          </div>
        ))}
        <button className="gla-btn" style={{ marginTop: 6 }} onClick={addWeapon}>{t.char_weapon_add}</button>

        <div className="rule" style={{ marginTop: 24 }} />
        <h3 className="sheet-title" style={{ fontSize: 24, textAlign: "left" }}>{t.char_skills}</h3>
        <p className="section-hint">{t.char_skill_hint}</p>
        {(active.skills || []).length === 0 && (
          <p className="section-empty">{t.char_no_skills}</p>
        )}
        {(active.skills || []).map(sk => (
          <div className="skill-row" key={sk.id}>
            <div className="skill-head">
              <input className="gla-input sk-name" value={sk.name}
                onChange={e => patchSkill(sk.id, { name: e.target.value })} />
              <select className="sk-att" value={sk.att} aria-label={t.char_attributes}
                onChange={e => patchSkill(sk.id, { att: e.target.value as AttrName | "" })}>
                <option value="">{t.char_no_attr}</option>
                {ATTRIBUTE.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              {sk.att && (
                <button className="w-btn hit" title={t.fruit_probe}
                  onClick={() => rollProbeFor(sk.att as AttrName, `Skill — ${sk.name || t.fruit_probe}`)}>🎲 {t.fruit_probe}</button>
              )}
              <button className="inv-del" onClick={() => delSkill(sk.id)} aria-label={t.remove}>✕</button>
            </div>
            <textarea className="gla-textarea sk-desc" value={sk.description}
              onChange={e => patchSkill(sk.id, { description: e.target.value })} />
          </div>
        ))}
        <button className="gla-btn" style={{ marginTop: 6 }} onClick={addSkill}>{t.char_skill_add}</button>

        <div className="rule" style={{ marginTop: 24 }} />
        <h3 className="sheet-title" style={{ fontSize: 24, textAlign: "left" }}>{t.char_devil_fruit}</h3>
        <div className="frucht">
          <div className="frucht-head">
            <div style={{ flex: 2 }}>
              <div className="field-label">{t.fruit_fruit}</div>
              <input className="gla-input" value={frucht.name}
                onChange={e => patchFrucht({ name: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="field-label">{t.fruit_type}</div>
              <select className="frucht-typ" value={frucht.type} aria-label={t.fruit_type}
                onChange={e => patchFrucht({ type: e.target.value as typeof frucht.type })}>
                <option value="">{t.fruit_type_none}</option>
                <option value="Paramecia">{t.fruit_type_paramecia}</option>
                <option value="Zoan">{t.fruit_type_zoan}</option>
                <option value="Logia">{t.fruit_type_logia}</option>
              </select>
            </div>
          </div>

          <div className={`frucht-budget ${bil.available < 0 ? "over" : ""}`}>
            {budgetText}
          </div>

          {(frucht.ranks || []).length === 0 && (
            <p className="section-empty">{t.fruit_none}</p>
          )}

          {bil.ranks.map((r, i) => (
            <div className={`rang ${r.unlocked ? "on" : "off"}`} key={r.id}>
              <div className="rang-head">
                <span className="rang-no">{i + 1}</span>
                <input className="gla-input rang-name" value={r.name}
                  placeholder={t.fruit_rank_name.replace('[n]', String(i + 1))}
                  onChange={e => patchRank(r.id, { name: e.target.value })} />
                <label className="rang-cost">
                  {t.fruit_cost}
                  <NumberInput min={0} value={r.costLevel} ariaLabel={t.fruit_cost}
                    onChange={v => patchRank(r.id, { costLevel: v })} />
                  {t.fruit_lvl}
                </label>
                {r.unlocked ? (
                  <button className="rang-lock on" disabled={!r.canLock}
                    onClick={() => patchRank(r.id, { unlocked: false })}
                    title={r.canLock ? t.fruit_lock_again : t.fruit_lock_higher}>{t.fruit_free}</button>
                ) : (
                  <button className="rang-lock off" disabled={!r.canUnlock}
                    onClick={() => patchRank(r.id, { unlocked: true })}
                    title={r.canUnlock ? t.fruit_unlock : t.fruit_unlock_prev}>{t.fruit_lock}</button>
                )}
                <button className="inv-del" onClick={() => delRank(r.id)} aria-label={t.remove}>✕</button>
              </div>

              {r.unlocked && (
                <div className="rang-body">
                  <textarea className="gla-textarea" value={r.description}
                    placeholder={t.fruit_what_grants}
                    onChange={e => patchRank(r.id, { description: e.target.value })} />
                  <div className="rang-extras">
                    <label className="rang-field">
                      {t.fruit_roll}
                      <select value={r.rollType}
                        onChange={e => patchRank(r.id, { rollType: e.target.value as FruitRank["rollType"] })}>
                        <option value="">{t.none_option}</option>
                        <option value="check">{t.fruit_probe}</option>
                        <option value="damage">{t.char_damage}</option>
                      </select>
                    </label>
                    {r.rollType === "check" && (
                      <label className="rang-field">
                        {t.fruit_attr}
                        <select value={r.rollAttr}
                          onChange={e => patchRank(r.id, { rollAttr: e.target.value as AttrName })}>
                          {ATTRIBUTE.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </label>
                    )}
                    {r.rollType === "damage" && (
                      <label className="rang-field">
                        {t.char_damage}
                        <input className="gla-input" style={{ width: 90 }} value={r.rollDamage}
                          onChange={e => patchRank(r.id, { rollDamage: e.target.value })} />
                      </label>
                    )}
                    <label className="rang-field grow">
                      {t.fruit_cost_cooldown}
                      <input className="gla-input" value={r.costText}
                        onChange={e => patchRank(r.id, { costText: e.target.value })} />
                    </label>
                    {r.rollType && (
                      <button className="w-btn dmg" onClick={() => rollRank(r)}>{t.fruit_roll_btn}</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          <button className="gla-btn" style={{ marginTop: 6 }} onClick={addRank}>{t.fruit_rank_add}</button>
        </div>

        <div className="rule" style={{ marginTop: 24 }} />
        <h3 className="sheet-title" style={{ fontSize: 24, textAlign: "left" }}>{t.char_attributes}</h3>
        <p style={{ fontStyle: "italic", fontSize: 13, marginTop: 0, color: "var(--ink-soft)" }}>
          {t.char_attr_hint}
        </p>

        <div className="att-grid">
          {ATTRIBUTE.map(a => {
            const lvl = active.attrs[a];
            return (
              <div className="att-cell" key={a}>
                <div className="att-circle">
                  <NumberInput min={1} max={20} value={lvl} onChange={v => patchAtt(a, v)} ariaLabel={`${a} Level`} />
                  <span className="att-mod">{withSign(balanceValue(lvl))}</span>
                </div>
                <span className="att-name">{a}</span>
                <button className="att-roll" onClick={() => probe(a)}>{t.fruit_probe} 🎲</button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="save-bar">
        {chars.length > 1 && <button className="gla-btn" onClick={removeCharacter}>{t.char_delete}</button>}
        <button className="gla-btn" onClick={() => exportPdf(active, showToast)}>{t.char_pdf}</button>
        <button className="gla-btn" onClick={() => saveNow("chars")}>{t.save}</button>
      </div>
    </div>
  );
}
