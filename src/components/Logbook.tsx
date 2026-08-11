import { useState } from "react";
import type { Quest } from "../types";
import { newId } from "../lib/game";
import { useCampaign } from "../state/CampaignContext";
import { useT } from "../i18n";

export function Logbook() {
  const { logbook, setLogbook, saveNow } = useCampaign();
  const t = useT();
  const [neueQuest, setNeueQuest] = useState("");

  const quests = logbook.quests;

  const sortiert = quests
    .map((q, i) => ({ ...q, _i: i }))
    .sort((a, b) => (a.done !== b.done ? (a.done ? 1 : -1) : a._i - b._i));

  const setQuests = (f: (qs: Quest[]) => Quest[]) =>
    setLogbook(l => ({ ...l, quests: f(l.quests) }));

  function addQuest() {
    const text = neueQuest.trim();
    if (!text) return;
    setQuests(qs => [...qs, { id: newId("q"), title: text.slice(0, 120), note: "", done: false }]);
    setNeueQuest("");
  }

  const patchQuest = (id: string, p: Partial<Quest>) =>
    setQuests(qs => qs.map(q => (q.id === id ? { ...q, ...p } : q)));

  const openCount = quests.filter(q => !q.done).length;
  const doneCount = quests.filter(q => q.done).length;

  return (
    <div style={{ padding: "0 14px" }}>
      <div className="notes-panel">
        <div className="notes-grid">
          <div className="notes-col">
            <div className="notes-head">
              <h3 className="sheet-title" style={{ margin: 0, textAlign: "left", fontSize: 22 }}>{t.log_quests}</h3>
              <span className="quest-count">
                {openCount} {t.log_open} · {doneCount} {t.log_done}
              </span>
            </div>

            <div className="quest-add">
              <input className="gla-input" value={neueQuest} placeholder={t.log_quest_placeholder}
                onChange={e => setNeueQuest(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addQuest(); }} />
              <button className="gla-btn" onClick={addQuest}>{t.log_add_quest}</button>
            </div>

            {quests.length === 0 && (
              <p className="section-empty">{t.log_no_quests}</p>
            )}

            <div className="quest-list">
              {sortiert.map(q => (
                <div className={`quest ${q.done ? "done" : ""}`} key={q.id}>
                  <button className="quest-check"
                    onClick={() => patchQuest(q.id, { done: !q.done })}
                    aria-label={q.done ? t.log_mark_open : t.log_mark_done}>
                    {q.done ? "☑" : "☐"}
                  </button>
                  <div className="quest-body">
                    <input className="quest-title" value={q.title}
                      onChange={e => patchQuest(q.id, { title: e.target.value })} />
                    <textarea className="quest-notiz" value={q.note}
                      onChange={e => patchQuest(q.id, { note: e.target.value })} />
                  </div>
                  <button className="quest-del" aria-label={t.log_delete}
                    onClick={() => setQuests(qs => qs.filter(x => x.id !== q.id))}>✕</button>
                </div>
              ))}
            </div>
          </div>

          <div className="notes-col">
            <h3 className="sheet-title" style={{ margin: "0 0 8px", textAlign: "left", fontSize: 22 }}>{t.log_notes}</h3>
            <textarea className="notes-area" value={logbook.notes}
              placeholder={t.log_notes_placeholder}
              onChange={e => setLogbook(l => ({ ...l, notizen: e.target.value }))} />
          </div>
        </div>

        <div className="save-bar" style={{ marginTop: 14 }}>
          <button className="gla-btn" onClick={() => saveNow("logbook")}>{t.log_save}</button>
        </div>
      </div>
    </div>
  );
}
