import type { ChangeEvent } from "react";
import { loadImageScaled } from "../lib/images";
import { formatBerry } from "../lib/game";
import { useCampaign } from "../state/CampaignContext";
import { NumberInput } from "./NumberInput";

export function WantedPosters() {
  const { chars, setChars, crew, setCrew, storage, saveNow, showToast } = useCampaign();

  const jollyUrl = storage.bildUrl(crew.jollyRoger);

  async function onJollyUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const datenUrl = await loadImageScaled(file, 500, { square: true });
      const wert = await storage.bildSpeichern(datenUrl);
      setCrew(c => ({ ...c, jollyRoger: wert }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Bild konnte nicht geladen werden");
    }
  }

  async function onPortraitUpload(e: ChangeEvent<HTMLInputElement>, charId: string) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const datenUrl = await loadImageScaled(file, 600, { square: true });
      const wert = await storage.bildSpeichern(datenUrl);
      setChars(cs => cs.map(c => (c.id === charId ? { ...c, portrait: wert } : c)));
      showToast("Porträt gesetzt ⚓");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Bild konnte nicht geladen werden");
    }
  }

  const gesamtKopfgeld = chars.reduce((a, c) => a + (Number(c.kopfgeld) || 0), 0);

  return (
    <div style={{ padding: "0 14px" }}>
      <div className="crew-panel">
        {/* Crew- & Schiffsbogen */}
        <div className="crew-sheet">
          <div className="crew-flag">
            {jollyUrl ? (
              <img src={jollyUrl} alt="Jolly Roger" className="jolly-img" />
            ) : (
              <div className="jolly-empty">☠</div>
            )}
            <label className="gla-btn crew-upload">
              Flagge laden
              <input type="file" accept="image/*" onChange={onJollyUpload} style={{ display: "none" }} />
            </label>
            {crew.jollyRoger && (
              <button className="gla-btn" onClick={() => setCrew(c => ({ ...c, jollyRoger: null }))}>Entfernen</button>
            )}
          </div>
          <div className="crew-info">
            <label className="crew-field">
              <span className="field-label">Name der Bande</span>
              <input className="gla-input crew-name" value={crew.name} placeholder="z. B. Strohhut-Piraten"
                onChange={e => setCrew(c => ({ ...c, name: e.target.value }))} />
            </label>
            <label className="crew-field">
              <span className="field-label">Schiff</span>
              <input className="gla-input" value={crew.schiffName} placeholder="z. B. Thousand Sunny"
                onChange={e => setCrew(c => ({ ...c, schiffName: e.target.value }))} />
            </label>
            <label className="crew-field">
              <span className="field-label">Schiffsbeschreibung</span>
              <textarea className="gla-textarea" value={crew.schiffBeschreibung}
                placeholder="Bauart, Besonderheiten, Bewaffnung…"
                onChange={e => setCrew(c => ({ ...c, schiffBeschreibung: e.target.value }))} />
            </label>
            <label className="crew-field">
              <span className="field-label">Flotte / Zugehörigkeit</span>
              <input className="gla-input" value={crew.flotte} placeholder="optional — z. B. Große Flotte"
                onChange={e => setCrew(c => ({ ...c, flotte: e.target.value }))} />
            </label>
          </div>
        </div>

        {/* Gesamtkopfgeld */}
        <div className="bounty-total">
          Gesamtkopfgeld der Bande:
          <span className="bounty-sum">
            <span className="berry-sym">฿</span>{formatBerry(gesamtKopfgeld)}
          </span>
        </div>

        {/* WANTED-Steckbriefe */}
        <div className="wanted-grid">
          {chars.map(c => {
            const portraitUrl = storage.bildUrl(c.portrait);
            return (
              <div className="wanted" key={c.id}>
                <div className="wanted-head">WANTED</div>
                <div className="wanted-sub">DEAD OR ALIVE</div>
                <div className="wanted-photo">
                  {portraitUrl ? (
                    <img src={portraitUrl} alt={c.name} />
                  ) : (
                    <div className="wanted-photo-empty">?</div>
                  )}
                  <label className="wanted-upload" title="Porträt laden">
                    📷
                    <input type="file" accept="image/*" style={{ display: "none" }}
                      onChange={e => onPortraitUpload(e, c.id)} />
                  </label>
                </div>
                <input className="wanted-name" value={c.name} placeholder="Name" aria-label="Name"
                  onChange={e => setChars(cs => cs.map(x => (x.id === c.id ? { ...x, name: e.target.value } : x)))} />
                <input className="wanted-epitheton" value={c.epitheton || ""} placeholder="„Beiname“" aria-label="Beiname"
                  onChange={e => setChars(cs => cs.map(x => (x.id === c.id ? { ...x, epitheton: e.target.value } : x)))} />
                <div className="wanted-bounty">
                  <span className="berry-sym">฿</span>
                  <NumberInput className="wanted-bounty-input" min={0} value={c.kopfgeld || 0} ariaLabel="Kopfgeld"
                    onChange={v => setChars(cs => cs.map(x => (x.id === c.id ? { ...x, kopfgeld: v } : x)))} />
                </div>
                <div className="wanted-bounty-fmt">{formatBerry(c.kopfgeld)} Berry</div>
                <div className="wanted-marine">☠ MARINE ☠</div>
              </div>
            );
          })}
        </div>

        <div className="save-bar" style={{ marginTop: 14 }}>
          <button className="gla-btn" onClick={async () => { await saveNow("crew"); await saveNow("chars"); }}>
            Steckbriefe &amp; Crew speichern
          </button>
        </div>
      </div>
    </div>
  );
}
