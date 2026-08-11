import { balanceValue } from "../lib/game";
import { useCampaign } from "../state/CampaignContext";
import { useSession } from "../state/SessionContext";
import { useT } from "../i18n";
import { PhysicsTable } from "./PhysicsTable";

export function DiceOverlay() {
  const { active } = useCampaign();
  const { throwSpec, result, handleSettled, rerollCurrent, closeTable } = useSession();
  const t = useT();

  if (!throwSpec) return null;

  const verdictText = (v: string) =>
    v === "success" ? t.verdict_success : v === "partial" ? t.verdict_partial : t.verdict_fail;

  const attMod = result?.att ? balanceValue(active.attribute[result.att]) : 0;

  return (
    <div className="table-overlay" role="dialog" aria-label={t.dice_table_aria}>
      <div className="table-label">
        {throwSpec.label
          ? throwSpec.label
          : throwSpec.att ? `${t.dice_probe_on} ${throwSpec.att}` : `${throwSpec.count}W${throwSpec.sides}`}
        {throwSpec.groups && throwSpec.groups.length > 1 && (
          <span className="table-sub"> · Wurf {(throwSpec.groupIndex ?? 0) + 1}/{throwSpec.groups.length}</span>
        )}
        <div className="table-hint">{t.dice_hint}</div>
      </div>
      <button className="table-close" onClick={closeTable}>{t.dice_close}</button>

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
              <span className="mod"> {result.flat >= 0 ? "+" : "−"} {Math.abs(result.flat)} {t.dice_bonus}</span>
            ) : null}
            {(result.att || result.flat) ? <span className="mod"> → {result.total}</span> : null}
          </div>
          {result.kind === "schaden" && (
            <div className="dmg-total">{result.total} {t.dice_damage}</div>
          )}
          {result.verdict && (
            <div><div className={`stamp ${result.verdict}`}>{verdictText(result.verdict)}</div></div>
          )}
          <div className="panel-btns">
            <button className="roll-btn" onClick={rerollCurrent}>{t.dice_roll_again}</button>
            <button className="ghost" onClick={closeTable}>{t.dice_done}</button>
          </div>
        </div>
      )}
    </div>
  );
}
