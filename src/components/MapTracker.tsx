import { useRef, type ChangeEvent, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { Charakter, MapToken, TokenArt } from "../types";
import { scaleMapImage } from "../lib/images";
import { newId } from "../lib/game";
import { useCampaign } from "../state/CampaignContext";
import { useSession } from "../state/SessionContext";

const TOKEN_COLORS: Record<TokenArt, string> = {
  crew: "#2f6d8a", gegner: "#8b2e1f", insel: "#2f7d4a", schiff: "#7a5a1e", ziel: "#8a3b8f",
};

export function MapTracker() {
  const { chars, map, setMap, storage, saveNow, showToast } = useCampaign();
  const { fighters } = useSession();

  const mapViewRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: string; pointerId: number } | null>(null);

  const bgUrl = storage.bildUrl(map.bg);

  async function onMapUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const datenUrl = await scaleMapImage(file);
      const wert = await storage.bildSpeichern(datenUrl);
      setMap(k => ({ ...k, bg: wert }));
      showToast("Karte geladen ⚓");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Bild konnte nicht geladen werden");
    }
  }

  function addMapToken(kind: TokenArt, opts: Partial<MapToken> = {}) {
    setMap(k => ({
      ...k,
      tokens: [...k.tokens, {
        id: newId("t"),
        label: opts.label ?? "",
        kind,
        color: opts.color ?? TOKEN_COLORS[kind] ?? "#555",
        x: opts.x ?? 50,       // Prozent der Kartenbreite
        y: opts.y ?? 50,
        ref: opts.ref ?? null,
      }],
    }));
  }

  function addCrewToken(c: Charakter) {
    if (map.tokens.some(t => t.ref === "char:" + c.id)) { showToast("Schon auf der Karte"); return; }
    addMapToken("crew", {
      label: (c.name || "?").slice(0, 12),
      ref: "char:" + c.id,
      x: 25 + Math.random() * 10,
      y: 45 + Math.random() * 10,
    });
  }

  function addFightersToMap() {
    const gegner = fighters.filter(f => f.seite === "gegner" && !f.tot);
    if (!gegner.length) { showToast("Keine lebenden Gegner im Kampf"); return; }
    setMap(k => {
      const vorhanden = new Set(k.tokens.map(t => t.ref));
      const neue: MapToken[] = gegner
        .filter(f => !vorhanden.has("fighter:" + f.id))
        .map(f => ({
          id: newId("t"),
          label: (f.name || "Gegner").slice(0, 12),
          kind: "gegner" as const,
          color: TOKEN_COLORS.gegner,
          ref: "fighter:" + f.id,
          x: 60 + Math.random() * 15,
          y: 40 + Math.random() * 20,
        }));
      return { ...k, tokens: [...k.tokens, ...neue] };
    });
  }

  const patchToken = (id: string, p: Partial<MapToken>) =>
    setMap(k => ({ ...k, tokens: k.tokens.map(t => (t.id === id ? { ...t, ...p } : t)) }));

  const delToken = (id: string) =>
    setMap(k => ({ ...k, tokens: k.tokens.filter(t => t.id !== id) }));

  /* ---- Ziehen: Position in Prozent der Kartenfläche ---- */
  function tokenPointerDown(e: ReactPointerEvent<HTMLDivElement>, t: MapToken) {
    e.preventDefault();
    e.stopPropagation();
    if (!mapViewRef.current) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* egal */ }
    dragRef.current = { id: t.id, pointerId: e.pointerId };
  }

  function tokenPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const view = mapViewRef.current;
    if (!view) return;
    const r = view.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100));
    patchToken(d.id, { x, y });
  }

  function tokenPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (d && d.pointerId === e.pointerId) dragRef.current = null;
  }

  return (
    <div style={{ padding: "0 14px" }}>
      <div className="map-panel">
        <div className="map-toolbar">
          <label className="map-btn upload">
            🖼 Bild laden
            <input type="file" accept="image/*" onChange={onMapUpload} style={{ display: "none" }} />
          </label>
          {map.bg && <button className="map-btn" onClick={() => setMap(k => ({ ...k, bg: null }))}>Bild entfernen</button>}
          <button className={`map-btn ${map.gridOn ? "on" : ""}`}
            onClick={() => setMap(k => ({ ...k, gridOn: !k.gridOn }))}>
            {map.gridOn ? "▦ Raster an" : "▦ Raster aus"}
          </button>
          <span className="map-sep" />
          {chars.map(c => (
            <button key={c.id} className="map-chip crew" onClick={() => addCrewToken(c)}>
              + {c.name || "Crew"}
            </button>
          ))}
          <button className="map-chip gegner" onClick={addFightersToMap}>+ Gegner aus Kampf</button>
          <button className="map-chip insel" onClick={() => addMapToken("insel", { label: "Insel" })}>+ Insel</button>
          <button className="map-chip schiff" onClick={() => addMapToken("schiff", { label: "Schiff" })}>+ Schiff</button>
          <button className="map-chip ziel" onClick={() => addMapToken("ziel", { label: "Ziel" })}>+ Ziel</button>
          <span className="map-sep" />
          {map.tokens.length > 0 && (
            <button className="map-btn" onClick={() => setMap(k => ({ ...k, tokens: [] }))}>Marker leeren</button>
          )}
          <button className="map-btn save" onClick={() => saveNow("map")}>Karte speichern</button>
        </div>

        <div
          className={`map-view ${map.gridOn ? "grid" : ""} ${bgUrl ? "has-bg" : "sea"}`}
          ref={mapViewRef}
          style={bgUrl ? { backgroundImage: `url(${bgUrl})` } : undefined}
          onPointerMove={tokenPointerMove}
          onPointerUp={tokenPointerUp}
          onPointerCancel={tokenPointerUp}
        >
          {!bgUrl && map.tokens.length === 0 && (
            <div className="map-hint">
              Lade ein Kartenbild oder nutze das Seekarten-Raster.<br />
              Figuren oben hinzufügen und frei verschieben.
            </div>
          )}
          {map.tokens.map(t => (
            <div
              key={t.id}
              className={`token ${t.kind}`}
              style={{ left: t.x + "%", top: t.y + "%", "--tok": t.color } as CSSProperties}
              onPointerDown={e => tokenPointerDown(e, t)}
              onPointerMove={tokenPointerMove}
              onPointerUp={tokenPointerUp}
            >
              <span className="token-dot" />
              <span className="token-label">{t.label || (t.kind === "crew" ? "Crew" : t.kind)}</span>
              <button className="token-x" onPointerDown={e => e.stopPropagation()}
                onClick={() => delToken(t.id)} aria-label="Marker entfernen">✕</button>
            </div>
          ))}
        </div>

        {map.tokens.length > 0 && (
          <div className="token-editor">
            <h3 className="token-editor-title">Marker beschriften</h3>
            {map.tokens.map(t => (
              <div className="token-edit-row" key={t.id}>
                <span className="token-swatch" style={{ background: t.color }} />
                <input className="gla-input" value={t.label} placeholder={t.kind}
                  onChange={e => patchToken(t.id, { label: e.target.value.slice(0, 18) })} />
                <span className="token-kind">{t.kind}</span>
                <button className="inv-del" onClick={() => delToken(t.id)} aria-label="Entfernen">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
