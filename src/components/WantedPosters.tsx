import type { ChangeEvent } from "react";
import { loadImageScaled } from "../lib/images";
import { formatBerry } from "../lib/game";
import { useCampaign } from "../state/CampaignContext";
import { useT } from "../i18n";
import { NumberInput } from "./NumberInput";

export function WantedPosters() {
  const { chars, setChars, crew, setCrew, storage, saveNow, showToast } = useCampaign();
  const t = useT();

  const jollyUrl = storage.imageUrl(crew.jollyRoger);

  async function onJollyUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const datenUrl = await loadImageScaled(file, 500, { square: true });
      const wert = await storage.saveImage(datenUrl);
      setCrew(c => ({ ...c, jollyRoger: wert }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.map_load_error);
    }
  }

  async function onPortraitUpload(e: ChangeEvent<HTMLInputElement>, charId: string) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const datenUrl = await loadImageScaled(file, 600, { square: true });
      const wert = await storage.saveImage(datenUrl);
      setChars(cs => cs.map(c => (c.id === charId ? { ...c, portrait: wert } : c)));
      showToast(t.poster_portrait_set);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.map_load_error);
    }
  }

  const totalBounty = chars.reduce((a, c) => a + (Number(c.bounty) || 0), 0);

  return (
    <div style={{ padding: "0 14px" }}>
      <div className="crew-panel">
        <div className="crew-sheet">
          <div className="crew-flag">
            {jollyUrl ? (
              <img src={jollyUrl} alt="Jolly Roger" className="jolly-img" />
            ) : (
              <div className="jolly-empty">☠</div>
            )}
            <label className="gla-btn crew-upload">
              {t.crew_flag_load}
              <input type="file" accept="image/*" onChange={onJollyUpload} style={{ display: "none" }} />
            </label>
            {crew.jollyRoger && (
              <button className="gla-btn" onClick={() => setCrew(c => ({ ...c, jollyRoger: null }))}>{t.crew_flag_remove}</button>
            )}
          </div>
          <div className="crew-info">
            <label className="crew-field">
              <span className="field-label">{t.crew_band_name}</span>
              <input className="gla-input crew-name" value={crew.name}
                onChange={e => setCrew(c => ({ ...c, name: e.target.value }))} />
            </label>
            <label className="crew-field">
              <span className="field-label">{t.crew_ship}</span>
              <input className="gla-input" value={crew.shipName}
                onChange={e => setCrew(c => ({ ...c, shipName: e.target.value }))} />
            </label>
            <label className="crew-field">
              <span className="field-label">{t.crew_ship_desc}</span>
              <textarea className="gla-textarea" value={crew.shipDescription}
                onChange={e => setCrew(c => ({ ...c, shipDescription: e.target.value }))} />
            </label>
            <label className="crew-field">
              <span className="field-label">{t.crew_fleet}</span>
              <input className="gla-input" value={crew.fleet}
                onChange={e => setCrew(c => ({ ...c, fleet: e.target.value }))} />
            </label>
          </div>
        </div>

        <div className="bounty-total">
          {t.crew_bounty_total}
          <span className="bounty-sum">
            <span className="berry-sym">฿</span>{formatBerry(totalBounty)}
          </span>
        </div>

        <div className="wanted-grid">
          {chars.map(c => {
            const portraitUrl = storage.imageUrl(c.portrait);
            return (
              <div className="wanted" key={c.id}>
                <div className="wanted-head">{t.poster_wanted}</div>
                <div className="wanted-sub">{t.poster_dead_or_alive}</div>
                <div className="wanted-photo">
                  {portraitUrl ? (
                    <img src={portraitUrl} alt={c.name} />
                  ) : (
                    <div className="wanted-photo-empty">?</div>
                  )}
                  <label className="wanted-upload" title={t.poster_load_portrait}>
                    📷
                    <input type="file" accept="image/*" style={{ display: "none" }}
                      onChange={e => onPortraitUpload(e, c.id)} />
                  </label>
                </div>
                <input className="wanted-name" value={c.name} placeholder={t.name} aria-label={t.name}
                  onChange={e => setChars(cs => cs.map(x => (x.id === c.id ? { ...x, name: e.target.value } : x)))} />
                <input className="wanted-epitheton" value={c.epithet || ""} aria-label={t.name}
                  onChange={e => setChars(cs => cs.map(x => (x.id === c.id ? { ...x, epithet: e.target.value } : x)))} />
                <div className="wanted-bounty">
                  <span className="berry-sym">฿</span>
                  <NumberInput className="wanted-bounty-input" min={0} value={c.bounty || 0} ariaLabel={t.char_berries}
                    onChange={v => setChars(cs => cs.map(x => (x.id === c.id ? { ...x, bounty: v } : x)))} />
                </div>
                <div className="wanted-bounty-fmt">{formatBerry(c.bounty)} Berry</div>
                <div className="wanted-marine">{t.poster_footer}</div>
              </div>
            );
          })}
        </div>

        <div className="save-bar" style={{ marginTop: 14 }}>
          <button className="gla-btn" onClick={async () => { await saveNow("crew"); await saveNow("chars"); }}>
            {t.crew_save}
          </button>
        </div>
      </div>
    </div>
  );
}
