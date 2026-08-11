import { ATTRIBUTE, type AttrName, type Character, type Fighter, type Weapon } from "../types";
import { balanceValue, newId } from "../lib/game";
import { useCampaign } from "../state/CampaignContext";
import { useSession } from "../state/SessionContext";
import { useT } from "../i18n";
import { NumberInput } from "./NumberInput";

export function CombatTracker() {
  const { chars, showToast } = useCampaign();
  const {
    fighters, setFighters, turnIdx, setTurnIdx, round, setRound,
    combatActive, setCombatActive,
    rollProbeFor, rollDamage, rollFlat, rollInitiative,
  } = useSession();
  const t = useT();

  const sorted = [...fighters]
    .map((f, i) => ({ ...f, _idx: i }))
    .sort((a, b) => {
      const ai = a.initiative == null ? -Infinity : a.initiative;
      const bi = b.initiative == null ? -Infinity : b.initiative;
      if (bi !== ai) return bi - ai;
      return a._idx - b._idx;
    });

  function addFighterFromChar(c: Character) {
    if (fighters.some(f => f.charId === c.id)) { showToast(t.combat_already_in); return; }
    setFighters(fs => [...fs, {
      id: newId("f"),
      charId: c.id, name: c.name || t.char_nameless, side: "crew",
      initAttr: "Geschicklichkeit", initiative: null,
      hp: Number(c.hp) || 10, maxHp: Number(c.hp) || 10, dead: false,
    }]);
  }

  function addEnemy() {
    setFighters(fs => [...fs, {
      id: newId("f"),
      charId: null, name: "", side: "enemy",
      initAttr: "Geschicklichkeit", initiative: null,
      hp: 10, maxHp: 10, dead: false, initMod: 0,
      attackMod: 2, attackDamage: "W6",
    }]);
  }

  const patchFighter = (id: string, p: Partial<Fighter>) =>
    setFighters(fs => fs.map(f => (f.id === id ? { ...f, ...p } : f)));

  const delFighter = (id: string) =>
    setFighters(fs => fs.filter(f => f.id !== id));

  const damageFighter = (id: string, delta: number) =>
    setFighters(fs => fs.map(f => {
      if (f.id !== id) return f;
      const hp = Math.max(0, Math.min(f.maxHp, f.hp + delta));
      return { ...f, hp, dead: hp <= 0 };
    }));

  function fighterWeapons(f: Fighter): Weapon[] {
    if (!f.charId) return [];
    const c = chars.find(x => x.id === f.charId);
    return c?.weapons?.filter(w => (w.name || "").trim() || (w.damage || "").trim()) ?? [];
  }

  function rollAllInitiative() {
    setFighters(fs => fs.map(f => {
      const roll = 2 + Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6);
      let mod = 0;
      if (f.charId) {
        const c = chars.find(x => x.id === f.charId);
        if (c) mod = balanceValue(c.attrs[f.initAttr]);
      } else {
        mod = Number(f.initMod) || 0;
      }
      return { ...f, initiative: roll + mod };
    }));
    setCombatActive(true);
    setRound(1);
    setTurnIdx(0);
  }

  function startCombat() {
    if (fighters.length === 0) { showToast(t.combat_add_first); return; }
    setCombatActive(true);
    setRound(1);
    setTurnIdx(0);
  }

  function endCombat() {
    setCombatActive(false);
    setRound(1);
    setTurnIdx(0);
  }

  function nextTurn() {
    const order = sorted;
    if (order.length === 0) return;
    let ti = turnIdx, r = round, guard = 0;
    do {
      ti++;
      if (ti >= order.length) { ti = 0; r++; }
      guard++;
    } while (order[ti] && order[ti].dead && guard <= order.length);
    if (guard > order.length && order.every(f => f.dead)) return;
    setTurnIdx(ti);
    setRound(r);
  }

  function resetInitiative() {
    setFighters(fs => fs.map(f => ({ ...f, initiative: null })));
    setTurnIdx(0);
    setRound(1);
  }

  return (
    <div style={{ padding: "0 14px" }}>
      <div className="combat">
        <div className="combat-bar">
          <div className="combat-round">
            {combatActive ? `${t.combat_round} ${round}` : t.combat_prepare}
          </div>
          <div className="combat-actions">
            {!combatActive ? (
              <>
                <button className="gla-btn" onClick={rollAllInitiative}>{t.combat_roll_all}</button>
                <button className="gla-btn" onClick={startCombat}>{t.combat_start}</button>
              </>
            ) : (
              <>
                <button className="gla-btn primary" onClick={nextTurn}>{t.combat_next}</button>
                <button className="gla-btn" onClick={resetInitiative}>{t.combat_reset_ini}</button>
                <button className="gla-btn" onClick={endCombat}>{t.combat_end}</button>
              </>
            )}
          </div>
        </div>

        <div className="add-row">
          <span className="add-label">{t.combat_add_crew}</span>
          {chars.map(c => (
            <button key={c.id} className="add-chip" onClick={() => addFighterFromChar(c)}>
              + {c.name || t.char_nameless}
            </button>
          ))}
          <button className="add-chip enemy" onClick={addEnemy}>{t.combat_add_enemy}</button>
        </div>

        {fighters.length === 0 && (
          <p className="section-empty" style={{ color: "var(--parchment)" }}>
            {t.combat_none}
          </p>
        )}

        <div className="fighter-list">
          {sorted.map((f, i) => {
            const isTurn = combatActive && i === turnIdx;
            const hpPct = f.maxHp > 0 ? Math.round((f.hp / f.maxHp) * 100) : 0;
            const weapons = fighterWeapons(f);
            const char = f.charId ? chars.find(c => c.id === f.charId) ?? null : null;
            return (
              <div className={`fighter ${f.side} ${f.dead ? "dead" : ""} ${isTurn ? "active-turn" : ""}`} key={f.id}>
                <div className="fighter-ini">
                  <div className="ini-val">{f.initiative == null ? "–" : f.initiative}</div>
                  <button className="ini-roll" title={t.combat_ini_roll}
                    onClick={() => rollInitiative(f, char)}>🎲</button>
                </div>

                <div className="fighter-main">
                  <div className="fighter-top">
                    {f.charId ? (
                      <span className="fighter-name">{f.name}</span>
                    ) : (
                      <input className="gla-input fighter-name-input" value={f.name} placeholder={t.combat_name_enemy}
                        onChange={e => patchFighter(f.id, { name: e.target.value })} />
                    )}
                    <span className={`side-tag ${f.side}`}>{f.side === "crew" ? t.combat_crew_side : t.combat_enemy_side}</span>
                    {f.dead && <span className="dead-tag">{t.combat_defeated}</span>}
                  </div>

                  <div className="hp-row">
                    <div className="hp-bar">
                      <div className={`hp-fill ${hpPct <= 25 ? "low" : hpPct <= 50 ? "mid" : ""}`}
                        style={{ width: hpPct + "%" }} />
                    </div>
                    <div className="hp-num">
                      <NumberInput min={0} value={f.hp} ariaLabel={t.combat_hp}
                        onChange={v => patchFighter(f.id, { hp: v, dead: v <= 0 })} />
                      <span className="hp-sep">/</span>
                      <NumberInput min={1} value={f.maxHp} ariaLabel={t.combat_hp_max}
                        onChange={v => patchFighter(f.id, { maxHp: v })} />
                    </div>
                  </div>

                  <div className="dmg-controls">
                    <button onClick={() => damageFighter(f.id, -5)}>−5</button>
                    <button onClick={() => damageFighter(f.id, -1)}>−1</button>
                    <button onClick={() => damageFighter(f.id, +1)}>+1</button>
                    <button onClick={() => damageFighter(f.id, +5)}>+5</button>
                    {!f.charId && (
                      <label className="ini-mod-field">
                        {t.combat_ini_mod}
                        <NumberInput value={f.initMod || 0} ariaLabel={t.combat_ini_mod}
                          onChange={v => patchFighter(f.id, { initMod: v })} />
                      </label>
                    )}
                    {f.charId && (
                      <select className="ini-att-sel" value={f.initAttr} title={t.combat_ini_attr}
                        onChange={e => patchFighter(f.id, { initAttr: e.target.value as AttrName })}>
                        {ATTRIBUTE.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    )}
                    <button className="fighter-del" onClick={() => delFighter(f.id)} aria-label={t.remove}>✕</button>
                  </div>

                  {f.charId ? (
                    weapons.length === 0 ? (
                      <div className="atk-row empty">{t.combat_no_weapons}</div>
                    ) : (
                      <div className="atk-row">
                        {weapons.map(w => (
                          <span className="atk-weapon" key={w.id}>
                            <span className="atk-wname">{w.name || t.combat_enemy_side}</span>
                            <button className="atk-btn hit" title={`${t.weapon_hit} (${w.att})`}
                              onClick={() => rollProbeFor(w.att, `${f.name} — ${w.name || t.combat_attack_bonus}`, { backTo: "combat" })}>⚔</button>
                            <button className="atk-btn dmg" title={`${t.weapon_damage} (${w.damage})`}
                              onClick={() => rollDamage(w, { label: `${f.name} — ${w.name || t.dice_damage}`, backTo: "combat" })}>🎲</button>
                          </span>
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="atk-row">
                      <span className="atk-weapon">
                        <button className="atk-btn hit"
                          onClick={() => rollFlat(`${f.name || t.combat_enemy_side} — ${t.combat_attack_bonus}`, Number(f.attackMod) || 0, { backTo: "combat" })}>{t.weapon_hit}</button>
                        <label className="atk-mini">
                          +<NumberInput value={f.attackMod || 0} ariaLabel={t.combat_attack_bonus}
                            onChange={v => patchFighter(f.id, { attackMod: v })} />
                        </label>
                        <button className="atk-btn dmg"
                          onClick={() => rollDamage(
                            { name: f.name || t.combat_enemy_side, damage: f.attackDamage || "W6" },
                            { label: `${f.name || t.combat_enemy_side} — ${t.dice_damage}`, backTo: "combat" },
                          )}>{t.weapon_damage}</button>
                        <input className="gla-input atk-dmg-input" value={f.attackDamage || ""} placeholder="W6"
                          aria-label={t.combat_enemy_damage}
                          onChange={e => patchFighter(f.id, { attackDamage: e.target.value })} />
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
