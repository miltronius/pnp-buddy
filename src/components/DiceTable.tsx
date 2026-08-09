import { ATTRIBUTE, type AttributName, type Wuerfelseiten } from "../types";
import { VERDICT_TEXT, balanceValue, withSign } from "../lib/game";
import { useCampaign } from "../state/CampaignContext";
import { useSession } from "../state/SessionContext";
import { NumberInput } from "./NumberInput";

const SEITEN: Wuerfelseiten[] = [4, 6, 8, 10, 12, 20, 100];

/** Steuerung des Würfeltischs + Logbuch der letzten Würfe. */
export function DiceTable() {
  const { active } = useCampaign();
  const { count, setCount, sides, setSides, probeAtt, setProbeAtt, roll, history } = useSession();

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
                  {a} ({withSign(balanceValue(active.attribute[a]))})
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
                {h.att ? ` ${withSign(h.mod)} (${h.att}) → ${h.total}` : ""}
                {h.verdict ? ` — ${VERDICT_TEXT[h.verdict]}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
