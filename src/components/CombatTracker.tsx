import { ATTRIBUTE, type AttributName, type Charakter, type Kaempfer, type Waffe } from "../types";
import { balanceValue, newId } from "../lib/game";
import { useCampaign } from "../state/CampaignContext";
import { useSession } from "../state/SessionContext";
import { NumberInput } from "./NumberInput";

export function CombatTracker() {
  const { chars, showToast } = useCampaign();
  const {
    fighters, setFighters, turnIdx, setTurnIdx, round, setRound,
    combatActive, setCombatActive,
    rollProbeFor, rollDamage, rollFlat, rollInitiative,
  } = useSession();

  /* ---- Reihenfolge: höchste Initiative zuerst, sonst Eintragsreihenfolge ---- */
  const sortiert = [...fighters]
    .map((f, i) => ({ ...f, _idx: i }))
    .sort((a, b) => {
      const ai = a.ini == null ? -Infinity : a.ini;
      const bi = b.ini == null ? -Infinity : b.ini;
      if (bi !== ai) return bi - ai;
      return a._idx - b._idx;
    });

  function addFighterFromChar(c: Charakter) {
    if (fighters.some(f => f.charId === c.id)) { showToast("Schon im Kampf dabei"); return; }
    setFighters(fs => [...fs, {
      id: newId("f"),
      charId: c.id, name: c.name || "Namenlos", seite: "crew",
      iniAtt: "Geschicklichkeit", ini: null,
      hp: Number(c.leben) || 10, maxHp: Number(c.leben) || 10, tot: false,
    }]);
  }

  function addEnemy() {
    setFighters(fs => [...fs, {
      id: newId("f"),
      charId: null, name: "", seite: "gegner",
      iniAtt: "Geschicklichkeit", ini: null,
      hp: 10, maxHp: 10, tot: false, iniMod: 0,
      atkMod: 2, atkDmg: "W6",
    }]);
  }

  const patchFighter = (id: string, p: Partial<Kaempfer>) =>
    setFighters(fs => fs.map(f => (f.id === id ? { ...f, ...p } : f)));

  const delFighter = (id: string) =>
    setFighters(fs => fs.filter(f => f.id !== id));

  const damageFighter = (id: string, delta: number) =>
    setFighters(fs => fs.map(f => {
      if (f.id !== id) return f;
      const hp = Math.max(0, Math.min(f.maxHp, f.hp + delta));
      return { ...f, hp, tot: hp <= 0 };
    }));

  /** Waffen eines Kämpfers aus dem verknüpften Charakter holen. */
  function fighterWeapons(f: Kaempfer): Waffe[] {
    if (!f.charId) return [];
    const c = chars.find(x => x.id === f.charId);
    return c?.waffen?.filter(w => (w.name || "").trim() || (w.schaden || "").trim()) ?? [];
  }

  /** Alle auf einmal auswürfeln — still, ohne Tisch, für den schnellen Start. */
  function rollAllInitiative() {
    setFighters(fs => fs.map(f => {
      const wurf = 2 + Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6);
      let mod = 0;
      if (f.charId) {
        const c = chars.find(x => x.id === f.charId);
        if (c) mod = balanceValue(c.attribute[f.iniAtt]);
      } else {
        mod = Number(f.iniMod) || 0;
      }
      return { ...f, ini: wurf + mod };
    }));
    setCombatActive(true);
    setRound(1);
    setTurnIdx(0);
  }

  function startCombat() {
    if (fighters.length === 0) { showToast("Erst Kämpfer hinzufügen"); return; }
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
    const order = sortiert;
    if (order.length === 0) return;
    let ti = turnIdx, r = round, guard = 0;
    do {
      ti++;
      if (ti >= order.length) { ti = 0; r++; }
      guard++;
    } while (order[ti] && order[ti].tot && guard <= order.length);
    if (guard > order.length && order.every(f => f.tot)) return;
    setTurnIdx(ti);
    setRound(r);
  }

  function resetInitiative() {
    setFighters(fs => fs.map(f => ({ ...f, ini: null })));
    setTurnIdx(0);
    setRound(1);
  }

  return (
    <div style={{ padding: "0 14px" }}>
      <div className="combat">
        <div className="combat-bar">
          <div className="combat-round">
            {combatActive ? `Runde ${round}` : "Kampf vorbereiten"}
          </div>
          <div className="combat-actions">
            {!combatActive ? (
              <>
                <button className="gla-btn" onClick={rollAllInitiative}>Alle Ini würfeln &amp; starten</button>
                <button className="gla-btn" onClick={startCombat}>Kampf starten</button>
              </>
            ) : (
              <>
                <button className="gla-btn primary" onClick={nextTurn}>Nächster ▸</button>
                <button className="gla-btn" onClick={resetInitiative}>Ini zurücksetzen</button>
                <button className="gla-btn" onClick={endCombat}>Kampf beenden</button>
              </>
            )}
          </div>
        </div>

        <div className="add-row">
          <span className="add-label">Crew hinzufügen:</span>
          {chars.map(c => (
            <button key={c.id} className="add-chip" onClick={() => addFighterFromChar(c)}>
              + {c.name || "Namenlos"}
            </button>
          ))}
          <button className="add-chip enemy" onClick={addEnemy}>+ Gegner</button>
        </div>

        {fighters.length === 0 && (
          <p className="section-empty" style={{ color: "var(--parchment)" }}>
            Noch niemand im Kampf. Füge Crew-Mitglieder oder Gegner hinzu.
          </p>
        )}

        <div className="fighter-list">
          {sortiert.map((f, i) => {
            const isTurn = combatActive && i === turnIdx;
            const hpPct = f.maxHp > 0 ? Math.round((f.hp / f.maxHp) * 100) : 0;
            const waffen = fighterWeapons(f);
            const char = f.charId ? chars.find(c => c.id === f.charId) ?? null : null;
            return (
              <div className={`fighter ${f.seite} ${f.tot ? "tot" : ""} ${isTurn ? "active-turn" : ""}`} key={f.id}>
                <div className="fighter-ini">
                  <div className="ini-val">{f.ini == null ? "–" : f.ini}</div>
                  <button className="ini-roll" title="Initiative würfeln"
                    onClick={() => rollInitiative(f, char)}>🎲</button>
                </div>

                <div className="fighter-main">
                  <div className="fighter-top">
                    {f.charId ? (
                      <span className="fighter-name">{f.name}</span>
                    ) : (
                      <input className="gla-input fighter-name-input" value={f.name} placeholder="Gegner benennen"
                        onChange={e => patchFighter(f.id, { name: e.target.value })} />
                    )}
                    <span className={`side-tag ${f.seite}`}>{f.seite === "crew" ? "Crew" : "Gegner"}</span>
                    {f.tot && <span className="dead-tag">☠ besiegt</span>}
                  </div>

                  <div className="hp-row">
                    <div className="hp-bar">
                      <div className={`hp-fill ${hpPct <= 25 ? "low" : hpPct <= 50 ? "mid" : ""}`}
                        style={{ width: hpPct + "%" }} />
                    </div>
                    <div className="hp-num">
                      <NumberInput min={0} value={f.hp} ariaLabel="Trefferpunkte"
                        onChange={v => patchFighter(f.id, { hp: v, tot: v <= 0 })} />
                      <span className="hp-sep">/</span>
                      <NumberInput min={1} value={f.maxHp} ariaLabel="Maximale Trefferpunkte"
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
                        Ini-Mod
                        <NumberInput value={f.iniMod || 0} ariaLabel="Initiative-Modifikator"
                          onChange={v => patchFighter(f.id, { iniMod: v })} />
                      </label>
                    )}
                    {f.charId && (
                      <select className="ini-att-sel" value={f.iniAtt} title="Initiative-Attribut"
                        onChange={e => patchFighter(f.id, { iniAtt: e.target.value as AttributName })}>
                        {ATTRIBUTE.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    )}
                    <button className="fighter-del" onClick={() => delFighter(f.id)} aria-label="Entfernen">✕</button>
                  </div>

                  {f.charId ? (
                    waffen.length === 0 ? (
                      <div className="atk-row empty">Keine Waffen — auf dem Charakterbogen anlegen</div>
                    ) : (
                      <div className="atk-row">
                        {waffen.map(w => (
                          <span className="atk-weapon" key={w.id}>
                            <span className="atk-wname">{w.name || "Waffe"}</span>
                            <button className="atk-btn hit" title={`Treffer (${w.att})`}
                              onClick={() => rollProbeFor(w.att, `${f.name} — ${w.name || "Angriff"}`, { backTo: "kampf" })}>⚔</button>
                            <button className="atk-btn dmg" title={`Schaden (${w.schaden})`}
                              onClick={() => rollDamage(w, { label: `${f.name} — ${w.name || "Schaden"}`, backTo: "kampf" })}>🎲</button>
                          </span>
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="atk-row">
                      <span className="atk-weapon">
                        <button className="atk-btn hit" title="Angriff (2W6 + Bonus)"
                          onClick={() => rollFlat(`${f.name || "Gegner"} — Angriff`, Number(f.atkMod) || 0, { backTo: "kampf" })}>⚔ Angriff</button>
                        <label className="atk-mini">
                          +<NumberInput value={f.atkMod || 0} ariaLabel="Angriffsbonus"
                            onChange={v => patchFighter(f.id, { atkMod: v })} />
                        </label>
                        <button className="atk-btn dmg" title="Schaden"
                          onClick={() => rollDamage(
                            { name: f.name || "Gegner", schaden: f.atkDmg || "W6" },
                            { label: `${f.name || "Gegner"} — Schaden`, backTo: "kampf" },
                          )}>🎲 Schaden</button>
                        <input className="gla-input atk-dmg-input" value={f.atkDmg || ""} placeholder="W6"
                          aria-label="Gegner-Schaden"
                          onChange={e => patchFighter(f.id, { atkDmg: e.target.value })} />
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
