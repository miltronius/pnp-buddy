import { useState } from "react";
import type { Quest } from "../types";
import { newId } from "../lib/game";
import { useCampaign } from "../state/CampaignContext";

export function Logbook() {
  const { logbook, setLogbook, saveNow } = useCampaign();
  const [neueQuest, setNeueQuest] = useState("");

  const quests = logbook.quests;

  // Offene zuerst, sonst Eintragsreihenfolge
  const sortiert = quests
    .map((q, i) => ({ ...q, _i: i }))
    .sort((a, b) => (a.erledigt !== b.erledigt ? (a.erledigt ? 1 : -1) : a._i - b._i));

  const setQuests = (f: (qs: Quest[]) => Quest[]) =>
    setLogbook(l => ({ ...l, quests: f(l.quests) }));

  function addQuest() {
    const t = neueQuest.trim();
    if (!t) return;
    setQuests(qs => [...qs, { id: newId("q"), titel: t.slice(0, 120), notiz: "", erledigt: false }]);
    setNeueQuest("");
  }

  const patchQuest = (id: string, p: Partial<Quest>) =>
    setQuests(qs => qs.map(q => (q.id === id ? { ...q, ...p } : q)));

  return (
    <div style={{ padding: "0 14px" }}>
      <div className="notes-panel">
        <div className="notes-grid">
          <div className="notes-col">
            <div className="notes-head">
              <h3 className="sheet-title" style={{ margin: 0, textAlign: "left", fontSize: 22 }}>Questlog</h3>
              <span className="quest-count">
                {quests.filter(q => !q.erledigt).length} offen · {quests.filter(q => q.erledigt).length} erledigt
              </span>
            </div>

            <div className="quest-add">
              <input className="gla-input" value={neueQuest} placeholder="Neuen Auftrag eintragen…"
                onChange={e => setNeueQuest(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addQuest(); }} />
              <button className="gla-btn" onClick={addQuest}>+ Quest</button>
            </div>

            {quests.length === 0 && (
              <p className="section-empty">Noch keine Aufträge. Was treibt die Crew an?</p>
            )}

            <div className="quest-list">
              {sortiert.map(q => (
                <div className={`quest ${q.erledigt ? "done" : ""}`} key={q.id}>
                  <button className="quest-check"
                    onClick={() => patchQuest(q.id, { erledigt: !q.erledigt })}
                    aria-label={q.erledigt ? "Als offen markieren" : "Als erledigt markieren"}>
                    {q.erledigt ? "☑" : "☐"}
                  </button>
                  <div className="quest-body">
                    <input className="quest-title" value={q.titel} aria-label="Questtitel"
                      onChange={e => patchQuest(q.id, { titel: e.target.value })} />
                    <textarea className="quest-notiz" value={q.notiz} placeholder="Details, Hinweise, Belohnung…"
                      onChange={e => patchQuest(q.id, { notiz: e.target.value })} />
                  </div>
                  <button className="quest-del" aria-label="Quest löschen"
                    onClick={() => setQuests(qs => qs.filter(x => x.id !== q.id))}>✕</button>
                </div>
              ))}
            </div>
          </div>

          <div className="notes-col">
            <h3 className="sheet-title" style={{ margin: "0 0 8px", textAlign: "left", fontSize: 22 }}>Notizen</h3>
            <textarea className="notes-area" value={logbook.notizen}
              placeholder="Freie Notizen der Spielleitung: NPCs, Geheimnisse, lose Fäden, Weltgeschehen…"
              onChange={e => setLogbook(l => ({ ...l, notizen: e.target.value }))} />
          </div>
        </div>

        <div className="save-bar" style={{ marginTop: 14 }}>
          <button className="gla-btn" onClick={() => saveNow("logbook")}>Logbuch speichern</button>
        </div>
      </div>
    </div>
  );
}
