import { VERDICT_TEXT, balanceValue } from "../lib/game";
import { useCampaign } from "../state/CampaignContext";
import { useSession } from "../state/SessionContext";
import { PhysicsTable } from "./PhysicsTable";

/** Vollbild-Würfeltisch: erscheint, sobald ein Wurf angestoßen wurde. */
export function DiceOverlay() {
  const { active } = useCampaign();
  const { throwSpec, result, handleSettled, rerollCurrent, closeTable } = useSession();

  if (!throwSpec) return null;

  const attMod = result?.att ? balanceValue(active.attribute[result.att]) : 0;

  return (
    <div className="table-overlay" role="dialog" aria-label="Würfeltisch">
      <div className="table-label">
        {throwSpec.label
          ? throwSpec.label
          : throwSpec.att ? `Probe auf ${throwSpec.att}` : `${throwSpec.count}W${throwSpec.sides}`}
        {throwSpec.groups && throwSpec.groups.length > 1 && (
          <span className="table-sub"> · Wurf {(throwSpec.groupIndex ?? 0) + 1}/{throwSpec.groups.length}</span>
        )}
        <div className="table-hint">Würfel lassen sich anstupsen — das Ergebnis bleibt bestehen</div>
      </div>
      <button className="table-close" onClick={closeTable}>✕ Schließen</button>

      <PhysicsTable
        key={throwSpec.id}
        count={throwSpec.count}
        sides={throwSpec.sides}
        onSettled={handleSettled}
      />

      {result && (
        <div className="result-panel">
          <div className="sum-line">
            {result.vals.join(" + ")} = {result.sum}
            {result.att && (
              <span className="mod"> {attMod >= 0 ? "+" : "−"} {Math.abs(attMod)} ({result.att})</span>
            )}
            {result.flat ? (
              <span className="mod"> {result.flat >= 0 ? "+" : "−"} {Math.abs(result.flat)} Bonus</span>
            ) : null}
            {(result.att || result.flat) ? <span className="mod"> → {result.total}</span> : null}
          </div>
          {result.kind === "schaden" && (
            <div className="dmg-total">{result.total} Schaden</div>
          )}
          {result.verdict && (
            <div><div className={`stamp ${result.verdict}`}>{VERDICT_TEXT[result.verdict]}</div></div>
          )}
          <div className="panel-btns">
            <button className="roll-btn" onClick={rerollCurrent}>Nochmal werfen</button>
            <button className="ghost" onClick={closeTable}>Fertig</button>
          </div>
        </div>
      )}
    </div>
  );
}
