import { ATTRIBUTE, type AttributName, type FruchtRang, type Gegenstand, type Skill, type Waffe } from "../types";
import { ausgleich, fruchtBilanz, mitVorzeichen, neueId } from "../lib/spiel";
import { useKampagne } from "../state/KampagneContext";
import { useSitzung } from "../state/SitzungContext";
import { exportPdf } from "../lib/pdf";
import { NumberInput } from "./NumberInput";
import { Tally } from "./Tally";

export function Charakterbogen() {
  const { chars, active, activeId, setActiveId, patch, charAnlegen, charLoeschen, jetztSpeichern, zeigeToast } = useKampagne();
  const { probe, rollProbeFor, rollDamage } = useSitzung();

  const patchAtt = (name: AttributName, val: number) =>
    patch({ attribute: { ...active.attribute, [name]: val } });

  /* ---- Hab und Gut ---- */
  const patchItem = (id: string, p: Partial<Gegenstand>) =>
    patch({ habUndGut: active.habUndGut.map(it => (it.id === id ? { ...it, ...p } : it)) });
  const addItem = () =>
    patch({ habUndGut: [...active.habUndGut, { id: neueId("g"), text: "", anzahl: 1 }] });
  const delItem = (id: string) =>
    patch({ habUndGut: active.habUndGut.filter(it => it.id !== id) });

  /* ---- Waffen ---- */
  const patchWeapon = (id: string, p: Partial<Waffe>) =>
    patch({ waffen: (active.waffen || []).map(w => (w.id === id ? { ...w, ...p } : w)) });
  const addWeapon = () =>
    patch({ waffen: [...(active.waffen || []), { id: neueId("w"), name: "", att: "Nahkampf", schaden: "W6" }] });
  const delWeapon = (id: string) =>
    patch({ waffen: (active.waffen || []).filter(w => w.id !== id) });

  /* ---- Skills ---- */
  const patchSkill = (id: string, p: Partial<Skill>) =>
    patch({ skills: (active.skills || []).map(sk => (sk.id === id ? { ...sk, ...p } : sk)) });
  const addSkill = () =>
    patch({ skills: [...(active.skills || []), { id: neueId("s"), name: "", att: "", beschreibung: "" }] });
  const delSkill = (id: string) =>
    patch({ skills: (active.skills || []).filter(sk => sk.id !== id) });

  /* ---- Teufelsfrucht ---- */
  const frucht = active.teufelsfrucht || { name: "", typ: "" as const, raenge: [] };
  const patchFrucht = (p: Partial<typeof frucht>) =>
    patch({ teufelsfrucht: { ...frucht, ...p } });
  const patchRang = (id: string, p: Partial<FruchtRang>) =>
    patchFrucht({ raenge: (frucht.raenge || []).map(r => (r.id === id ? { ...r, ...p } : r)) });
  const addRang = () =>
    patchFrucht({
      raenge: [...(frucht.raenge || []), {
        id: neueId("r"), name: "", beschreibung: "", kostenLevel: 1,
        wurfTyp: "" as const, wurfAtt: "Nahkampf" as AttributName, wurfSchaden: "W6",
        kostenText: "", unlocked: false,
      }],
    });
  const delRang = (id: string) =>
    patchFrucht({ raenge: (frucht.raenge || []).filter(r => r.id !== id) });
  const rollRang = (r: FruchtRang) => {
    if (r.wurfTyp === "probe") {
      rollProbeFor(r.wurfAtt, `${frucht.name || "Frucht"} — ${r.name || "Kraft"}`);
    } else if (r.wurfTyp === "schaden") {
      rollDamage({ name: `${frucht.name || "Frucht"} — ${r.name || "Kraft"}`, schaden: r.wurfSchaden });
    }
  };

  const bil = fruchtBilanz(active.stufe, frucht.raenge);

  return (
    <div style={{ padding: "0 14px" }}>
      <div className="char-switch">
        {chars.map(c => (
          <button
            key={c.id}
            className={`char-chip ${c.id === (activeId ?? active.id) ? "active" : ""}`}
            onClick={() => setActiveId(c.id)}
          >
            {c.name || "Namenlos"}
          </button>
        ))}
        <button className="char-chip" onClick={charAnlegen}>+ Neuer Charakter</button>
      </div>

      <div className="sheet">
        <h2 className="sheet-title">Charakterbogen ☠</h2>
        <div className="rule" />

        <div className="grid-2">
          <div>
            <div className="field-label">Name</div>
            <input className="gla-input" value={active.name} placeholder="z. B. Yoshijima D. Jorogumo „Jojo“"
              onChange={e => patch({ name: e.target.value })} />
          </div>
          <div>
            <div className="field-label">
              Stufe
              <span className="tally-btns">
                <button onClick={() => patch({ stufe: Math.max(0, active.stufe - 1) })} aria-label="Stufe verringern">−</button>
                <button onClick={() => patch({ stufe: active.stufe + 1 })} aria-label="Stufe erhöhen">+</button>
              </span>
            </div>
            <div className="tally"><Tally value={active.stufe} /></div>
          </div>
        </div>

        <div className="vital-row">
          <div className="vital">
            <span className="icon" aria-hidden>❤</span>
            <div>
              <div className="field-label">Leben</div>
              <NumberInput value={active.leben} min={0} onChange={v => patch({ leben: v })} ariaLabel="Leben" />
            </div>
          </div>
          <div className="vital">
            <span className="icon" aria-hidden>⚔</span>
            <div>
              <div className="field-label">Schaden</div>
              <input style={{ width: 110 }} value={active.schaden} aria-label="Schaden"
                onChange={e => patch({ schaden: e.target.value })} />
            </div>
          </div>
          <div className="vital">
            <span className="icon" aria-hidden>💰</span>
            <div>
              <div className="field-label">Berries</div>
              <NumberInput className="berry-input" value={active.berries} min={0}
                onChange={v => patch({ berries: v })} ariaLabel="Berries" />
            </div>
          </div>
        </div>

        <div className="grid-2">
          <div>
            <div className="field-label">Aussehen</div>
            <textarea className="gla-textarea" value={active.aussehen}
              placeholder="Größe, Bart, Sonnenbrille, Narben …"
              onChange={e => patch({ aussehen: e.target.value })} />
          </div>
          <div>
            <div className="field-label">Ziel im Leben</div>
            <textarea className="gla-textarea" value={active.ziel}
              placeholder="z. B. die vermeintliche „Enkelin“ auf der Grand Line finden"
              onChange={e => patch({ ziel: e.target.value })} />
          </div>
        </div>

        <div className="grid-2" style={{ marginTop: 14 }}>
          <div>
            <div className="field-label">Spezialeigenschaften</div>
            <textarea className="gla-textarea" value={active.spezial}
              placeholder="Teufelsfrucht, selektives Hören …"
              onChange={e => patch({ spezial: e.target.value })} />
          </div>
          <div>
            <div className="field-label">Eigenschaften</div>
            <textarea className="gla-textarea" value={active.eigenschaften}
              placeholder="Überdramatisiert alles, ständige Ratschläge im Kampf …"
              onChange={e => patch({ eigenschaften: e.target.value })} />
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div className="field-label">Hab und Gut</div>
          {active.habUndGut.map(it => (
            <div className="inv-row" key={it.id}>
              <NumberInput className="gla-input qty" min={0} value={it.anzahl}
                onChange={v => patchItem(it.id, { anzahl: v })} ariaLabel="Anzahl" />
              <input className="gla-input" value={it.text} placeholder="Gegenstand …"
                onChange={e => patchItem(it.id, { text: e.target.value })} />
              <button className="inv-del" onClick={() => delItem(it.id)} aria-label="Gegenstand entfernen">✕</button>
            </div>
          ))}
          <button className="gla-btn" style={{ marginTop: 6 }} onClick={addItem}>+ Gegenstand</button>
        </div>

        <div className="rule" style={{ marginTop: 24 }} />
        <h3 className="sheet-title" style={{ fontSize: 24, textAlign: "left" }}>Waffen</h3>
        <p className="section-hint">
          Trefferwurf würfelt 2W6 + Ausgleich des gewählten Attributs · Schaden akzeptiert z. B. „2W6+3“ oder „W8 + W6“.
        </p>
        {(active.waffen || []).length === 0 && (
          <p className="section-empty">Noch keine Waffen an Bord.</p>
        )}
        {(active.waffen || []).map(w => (
          <div className="weapon-row" key={w.id}>
            <input className="gla-input w-name" value={w.name} placeholder="z. B. Entersäbel „Shigure“"
              onChange={e => patchWeapon(w.id, { name: e.target.value })} />
            <select className="w-att" value={w.att} aria-label="Trefferattribut"
              onChange={e => patchWeapon(w.id, { att: e.target.value as AttributName })}>
              {ATTRIBUTE.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <input className="gla-input w-dmg" value={w.schaden} placeholder="Schaden" aria-label="Schaden"
              onChange={e => patchWeapon(w.id, { schaden: e.target.value })} />
            <button className="w-btn hit" title="Trefferwurf"
              onClick={() => rollProbeFor(w.att, `Angriff — ${w.name || "Waffe"}`)}>⚔ Treffer</button>
            <button className="w-btn dmg" title="Schadenswurf"
              onClick={() => rollDamage(w)}>🎲 Schaden</button>
            <button className="inv-del" onClick={() => delWeapon(w.id)} aria-label="Waffe entfernen">✕</button>
          </div>
        ))}
        <button className="gla-btn" style={{ marginTop: 6 }} onClick={addWeapon}>+ Waffe</button>

        <div className="rule" style={{ marginTop: 24 }} />
        <h3 className="sheet-title" style={{ fontSize: 24, textAlign: "left" }}>Skills</h3>
        <p className="section-hint">Optional ein Attribut zuordnen — dann lässt sich der Skill direkt als Probe würfeln.</p>
        {(active.skills || []).length === 0 && (
          <p className="section-empty">Noch keine Skills eingetragen.</p>
        )}
        {(active.skills || []).map(sk => (
          <div className="skill-row" key={sk.id}>
            <div className="skill-head">
              <input className="gla-input sk-name" value={sk.name} placeholder="Name des Skills"
                onChange={e => patchSkill(sk.id, { name: e.target.value })} />
              <select className="sk-att" value={sk.att} aria-label="Skill-Attribut"
                onChange={e => patchSkill(sk.id, { att: e.target.value as AttributName | "" })}>
                <option value="">— Attribut —</option>
                {ATTRIBUTE.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              {sk.att && (
                <button className="w-btn hit" title="Probe würfeln"
                  onClick={() => rollProbeFor(sk.att as AttributName, `Skill — ${sk.name || "Probe"}`)}>🎲 Probe</button>
              )}
              <button className="inv-del" onClick={() => delSkill(sk.id)} aria-label="Skill entfernen">✕</button>
            </div>
            <textarea className="gla-textarea sk-desc" value={sk.beschreibung} placeholder="Was bewirkt der Skill?"
              onChange={e => patchSkill(sk.id, { beschreibung: e.target.value })} />
          </div>
        ))}
        <button className="gla-btn" style={{ marginTop: 6 }} onClick={addSkill}>+ Skill</button>

        <div className="rule" style={{ marginTop: 24 }} />
        <h3 className="sheet-title" style={{ fontSize: 24, textAlign: "left" }}>Teufelsfrucht ✦</h3>
        <div className="frucht">
          <div className="frucht-head">
            <div style={{ flex: 2 }}>
              <div className="field-label">Frucht</div>
              <input className="gla-input" value={frucht.name} placeholder="z. B. Ito Ito no Mi"
                onChange={e => patchFrucht({ name: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="field-label">Typ</div>
              <select className="frucht-typ" value={frucht.typ} aria-label="Fruchttyp"
                onChange={e => patchFrucht({ typ: e.target.value as typeof frucht.typ })}>
                <option value="">— Typ —</option>
                <option value="Paramecia">Paramecia</option>
                <option value="Zoan">Zoan</option>
                <option value="Logia">Logia</option>
              </select>
            </div>
          </div>

          <div className={`frucht-budget ${bil.verfuegbar < 0 ? "over" : ""}`}>
            {bil.verfuegbar < 0
              ? `Überzogen um ${-bil.verfuegbar} Level — sperre einen Rang oder erhöhe die Stufe`
              : `${bil.verfuegbar} von ${active.stufe} Leveln frei für neue Ränge`}
          </div>

          {(frucht.raenge || []).length === 0 && (
            <p className="section-empty">Noch keine Kräfte freigeschaltet. Lege den ersten Rang an.</p>
          )}

          {bil.raenge.map((r, i) => (
            <div className={`rang ${r.unlocked ? "on" : "off"}`} key={r.id}>
              <div className="rang-head">
                <span className="rang-no">{i + 1}</span>
                <input className="gla-input rang-name" value={r.name} placeholder={`Rang ${i + 1} — Name der Kraft`}
                  onChange={e => patchRang(r.id, { name: e.target.value })} />
                <label className="rang-cost">
                  Kosten
                  <NumberInput min={0} value={r.kostenLevel} ariaLabel="Kosten in Leveln"
                    onChange={v => patchRang(r.id, { kostenLevel: v })} />
                  Lvl
                </label>
                {r.unlocked ? (
                  <button className="rang-lock on" disabled={!r.canLock}
                    onClick={() => patchRang(r.id, { unlocked: false })}
                    title={r.canLock ? "Wieder sperren" : "Erst höhere Ränge sperren"}>✓ Frei</button>
                ) : (
                  <button className="rang-lock off" disabled={!r.canUnlock}
                    onClick={() => patchRang(r.id, { unlocked: true })}
                    title={r.canUnlock ? "Freischalten" : "Vorherigen Rang freischalten oder Level fehlen"}>🔒 Sperre</button>
                )}
                <button className="inv-del" onClick={() => delRang(r.id)} aria-label="Rang entfernen">✕</button>
              </div>

              {r.unlocked && (
                <div className="rang-body">
                  <textarea className="gla-textarea" value={r.beschreibung}
                    placeholder="Was gewährt dieser Rang?"
                    onChange={e => patchRang(r.id, { beschreibung: e.target.value })} />
                  <div className="rang-extras">
                    <label className="rang-field">
                      Wurf
                      <select value={r.wurfTyp}
                        onChange={e => patchRang(r.id, { wurfTyp: e.target.value as FruchtRang["wurfTyp"] })}>
                        <option value="">— keiner —</option>
                        <option value="probe">Probe</option>
                        <option value="schaden">Schaden</option>
                      </select>
                    </label>
                    {r.wurfTyp === "probe" && (
                      <label className="rang-field">
                        Attribut
                        <select value={r.wurfAtt}
                          onChange={e => patchRang(r.id, { wurfAtt: e.target.value as AttributName })}>
                          {ATTRIBUTE.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </label>
                    )}
                    {r.wurfTyp === "schaden" && (
                      <label className="rang-field">
                        Schaden
                        <input className="gla-input" style={{ width: 90 }} value={r.wurfSchaden}
                          onChange={e => patchRang(r.id, { wurfSchaden: e.target.value })} />
                      </label>
                    )}
                    <label className="rang-field grow">
                      Kosten / Cooldown
                      <input className="gla-input" value={r.kostenText} placeholder="z. B. 2 Ausdauer, 1 Runde"
                        onChange={e => patchRang(r.id, { kostenText: e.target.value })} />
                    </label>
                    {r.wurfTyp && (
                      <button className="w-btn dmg" onClick={() => rollRang(r)}>🎲 Würfeln</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          <button className="gla-btn" style={{ marginTop: 6 }} onClick={addRang}>+ Rang</button>
        </div>

        <div className="rule" style={{ marginTop: 24 }} />
        <h3 className="sheet-title" style={{ fontSize: 24, textAlign: "left" }}>Attribute</h3>
        <p style={{ fontStyle: "italic", fontSize: 13, marginTop: 0, color: "var(--ink-soft)" }}>
          Der Ausgleichs-Wert wird automatisch berechnet (1 → −4 … 20 → +4). „Probe“ wirft die Würfel auf den großen Tisch.
        </p>

        <div className="att-grid">
          {ATTRIBUTE.map(a => {
            const lvl = active.attribute[a];
            return (
              <div className="att-cell" key={a}>
                <div className="att-circle">
                  <NumberInput min={1} max={20} value={lvl} onChange={v => patchAtt(a, v)} ariaLabel={`${a} Level`} />
                  <span className="att-mod">{mitVorzeichen(ausgleich(lvl))}</span>
                </div>
                <span className="att-name">{a}</span>
                <button className="att-roll" onClick={() => probe(a)}>Probe 🎲</button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="save-bar">
        {chars.length > 1 && <button className="gla-btn" onClick={charLoeschen}>Charakter löschen</button>}
        <button className="gla-btn" onClick={() => exportPdf(active, zeigeToast)}>Als PDF / drucken</button>
        <button className="gla-btn" onClick={() => jetztSpeichern("chars")}>Speichern</button>
      </div>
    </div>
  );
}
