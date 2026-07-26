import { ATTRIBUTE, type AttributName, type Wuerfelseiten } from "../types";
import { VERDIKT_TEXT, ausgleich, mitVorzeichen } from "../lib/spiel";
import { useKampagne } from "../state/KampagneContext";
import { useSitzung } from "../state/SitzungContext";
import { NumberInput } from "./NumberInput";

const SEITEN: Wuerfelseiten[] = [4, 6, 8, 10, 12, 20, 100];

/** Steuerung des Würfeltischs + Logbuch der letzten Würfe. */
export function Wuerfeltisch() {
  const { active } = useKampagne();
  const { count, setCount, sides, setSides, probeAtt, setProbeAtt, roll, history } = useSitzung();

  return (
    <div style={{ padding: "0 14px" }}>
      <div className="dice-panel">
        <div className="dice-controls">
          <div className="dc-group">
            <label htmlFor="dcount">Anzahl</label>
            <NumberInput min={1} max={12} value={count} onChange={setCount} ariaLabel="Anzahl Würfel" />
          </div>
          <div className="dc-group">
            <label htmlFor="dsides">Augen</label>
            <select id="dsides" value={sides} onChange={e => setSides(Number(e.target.value) as Wuerfelseiten)}>
              {SEITEN.map(s => <option key={s} value={s}>W{s}</option>)}
            </select>
          </div>
          <div className="dc-group">
            <label htmlFor="dprobe">Probe auf</label>
            <select id="dprobe" value={probeAtt} onChange={e => setProbeAtt(e.target.value as AttributName | "")}>
              <option value="">— keine —</option>
              {ATTRIBUTE.map(a => (
                <option key={a} value={a}>
                  {a} ({mitVorzeichen(ausgleich(active.attribute[a]))})
                </option>
              ))}
            </select>
          </div>
          <button className="roll-btn" onClick={() => roll()}>Würfeln!</button>
        </div>
        <div className="probe-hint">Probe: 2W6 + Ausgleich · 2–6 Fehlschlag · 7–9 teilweise · 10+ geschafft</div>
      </div>

      {history.length > 0 && (
        <div className="history">
          <h3>Logbuch der letzten Würfe</h3>
          <ul>
            {history.map((h, i) => (
              <li key={i}>
                🎲 {h.vals.length}W{h.sides}: [{h.vals.join(", ")}] = {h.sum}
                {h.att ? ` ${mitVorzeichen(h.mod)} (${h.att}) → ${h.total}` : ""}
                {h.verdict ? ` — ${VERDIKT_TEXT[h.verdict]}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
