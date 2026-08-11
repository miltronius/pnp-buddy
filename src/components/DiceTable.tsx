import { ATTRIBUTE, type AttrName, type DieSides } from "../types";
import { balanceValue, withSign } from "../lib/game";
import { useCampaign } from "../state/CampaignContext";
import { useSession } from "../state/SessionContext";
import { useT } from "../i18n";
import { NumberInput } from "./NumberInput";

const SEITEN: DieSides[] = [4, 6, 8, 10, 12, 20, 100];

export function DiceTable() {
  const { active } = useCampaign();
  const { count, setCount, sides, setSides, probeAtt, setProbeAtt, roll, history } = useSession();
  const t = useT();

  const verdictText = (v: string) =>
    v === "success" ? t.verdict_success : v === "partial" ? t.verdict_partial : t.verdict_fail;

  return (
    <div style={{ padding: "0 14px" }}>
      <div className="dice-panel">
        <div className="dice-controls">
          <div className="dc-group">
            <label htmlFor="dcount">{t.dice_count}</label>
            <NumberInput min={1} max={12} value={count} onChange={setCount} ariaLabel={t.dice_count_aria} />
          </div>
          <div className="dc-group">
            <label htmlFor="dsides">{t.dice_sides}</label>
            <select id="dsides" value={sides} onChange={e => setSides(Number(e.target.value) as DieSides)}>
              {SEITEN.map(s => <option key={s} value={s}>W{s}</option>)}
            </select>
          </div>
          <div className="dc-group">
            <label htmlFor="dprobe">{t.dice_probe_on}</label>
            <select id="dprobe" value={probeAtt} onChange={e => setProbeAtt(e.target.value as AttrName | "")}>
              <option value="">{t.dice_none}</option>
              {ATTRIBUTE.map(a => (
                <option key={a} value={a}>
                  {a} ({withSign(balanceValue(active.attrs[a]))})
                </option>
              ))}
            </select>
          </div>
          <button className="roll-btn" onClick={() => roll()}>{t.dice_roll}</button>
        </div>
        <div className="probe-hint">{t.dice_probe_hint}</div>
      </div>

      {history.length > 0 && (
        <div className="history">
          <h3>{t.dice_history}</h3>
          <ul>
            {history.map((h, i) => (
              <li key={i}>
                🎲 {h.vals.length}W{h.sides}: [{h.vals.join(", ")}] = {h.sum}
                {h.att ? ` ${withSign(h.mod)} (${h.att}) → ${h.total}` : ""}
                {h.verdict ? ` — ${verdictText(h.verdict)}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
