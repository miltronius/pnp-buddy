import { useRef, type ChangeEvent, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { Character, MapToken, TokenType } from "../types";
import { scaleMapImage } from "../lib/images";
import { newId } from "../lib/game";
import { useCampaign } from "../state/CampaignContext";
import { useSession } from "../state/SessionContext";
import { useT } from "../i18n";

const TOKEN_COLORS: Record<TokenType, string> = {
  crew: "#2f6d8a", enemy: "#8b2e1f", island: "#2f7d4a", ship: "#7a5a1e", target: "#8a3b8f",
};

export function MapTracker() {
  const { chars, map, setMap, storage, saveNow, showToast } = useCampaign();
  const { fighters } = useSession();
  const t = useT();

  const mapViewRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: string; pointerId: number } | null>(null);

  const bgUrl = storage.imageUrl(map.bg);

  const tokenLabels: Record<TokenType, string> = {
    crew: t.map_token_crew,
    enemy: t.map_token_enemy,
    island: t.map_token_island,
    ship: t.map_token_ship,
    target: t.map_token_target,
  };

  async function onMapUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await scaleMapImage(file);
      const value = await storage.saveImage(dataUrl);
      setMap(k => ({ ...k, bg: value }));
      showToast(t.map_loaded);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.map_load_error);
    }
  }

  function addMapToken(kind: TokenType, opts: Partial<MapToken> = {}) {
    setMap(k => ({
      ...k,
      tokens: [...k.tokens, {
        id: newId("t"),
        label: opts.label ?? "",
        kind,
        color: opts.color ?? TOKEN_COLORS[kind] ?? "#555",
        x: opts.x ?? 50,
        y: opts.y ?? 50,
        ref: opts.ref ?? null,
      }],
    }));
  }

  function addCrewToken(c: Character) {
    if (map.tokens.some(tok => tok.ref === "char:" + c.id)) { showToast(t.map_already_on); return; }
    addMapToken("crew", {
      label: (c.name || "?").slice(0, 12),
      ref: "char:" + c.id,
      x: 25 + Math.random() * 10,
      y: 45 + Math.random() * 10,
    });
  }

  function addFightersToMap() {
    const enemies = fighters.filter(f => f.side === "enemy" && !f.dead);
    if (!enemies.length) { showToast(t.map_no_enemies); return; }
    setMap(k => {
      const existing = new Set(k.tokens.map(tok => tok.ref));
      const newTokens: MapToken[] = enemies
        .filter(f => !existing.has("fighter:" + f.id))
        .map(f => ({
          id: newId("t"),
          label: (f.name || t.map_token_enemy).slice(0, 12),
          kind: "enemy" as const,
          color: TOKEN_COLORS.enemy,
          ref: "fighter:" + f.id,
          x: 60 + Math.random() * 15,
          y: 40 + Math.random() * 20,
        }));
      return { ...k, tokens: [...k.tokens, ...newTokens] };
    });
  }

  const patchToken = (id: string, p: Partial<MapToken>) =>
    setMap(k => ({ ...k, tokens: k.tokens.map(tok => (tok.id === id ? { ...tok, ...p } : tok)) }));

  const delToken = (id: string) =>
    setMap(k => ({ ...k, tokens: k.tokens.filter(tok => tok.id !== id) }));

  function tokenPointerDown(e: ReactPointerEvent<HTMLDivElement>, tok: MapToken) {
    e.preventDefault();
    e.stopPropagation();
    if (!mapViewRef.current) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    dragRef.current = { id: tok.id, pointerId: e.pointerId };
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
            {t.map_load}
            <input type="file" accept="image/*" onChange={onMapUpload} style={{ display: "none" }} />
          </label>
          {map.bg && <button className="map-btn" onClick={() => setMap(k => ({ ...k, bg: null }))}>{t.map_remove_image}</button>}
          <button className={`map-btn ${map.gridOn ? "on" : ""}`}
            onClick={() => setMap(k => ({ ...k, gridOn: !k.gridOn }))}>
            {map.gridOn ? t.map_grid_on : t.map_grid_off}
          </button>
          <span className="map-sep" />
          {chars.map(c => (
            <button key={c.id} className="map-chip crew" onClick={() => addCrewToken(c)}>
              + {c.name || t.map_token_crew}
            </button>
          ))}
          <button className="map-chip enemy" onClick={addFightersToMap}>{t.map_add_enemies}</button>
          <button className="map-chip island" onClick={() => addMapToken("island", { label: t.map_token_island })}>{t.map_add_island}</button>
          <button className="map-chip ship" onClick={() => addMapToken("ship", { label: t.map_token_ship })}>{t.map_add_ship}</button>
          <button className="map-chip target" onClick={() => addMapToken("target", { label: t.map_token_target })}>{t.map_add_target}</button>
          <span className="map-sep" />
          {map.tokens.length > 0 && (
            <button className="map-btn" onClick={() => setMap(k => ({ ...k, tokens: [] }))}>{t.map_clear}</button>
          )}
          <button className="map-btn save" onClick={() => saveNow("map")}>{t.map_save}</button>
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
            <div className="map-hint">{t.map_hint}</div>
          )}
          {map.tokens.map(tok => (
            <div
              key={tok.id}
              className={`token ${tok.kind}`}
              style={{ left: tok.x + "%", top: tok.y + "%", "--tok": tok.color } as CSSProperties}
              onPointerDown={e => tokenPointerDown(e, tok)}
              onPointerMove={tokenPointerMove}
              onPointerUp={tokenPointerUp}
            >
              <span className="token-dot" />
              <span className="token-label">{tok.label || tokenLabels[tok.kind] || tok.kind}</span>
              <button className="token-x" onPointerDown={e => e.stopPropagation()}
                onClick={() => delToken(tok.id)} aria-label={t.map_token_remove}>✕</button>
            </div>
          ))}
        </div>

        {map.tokens.length > 0 && (
          <div className="token-editor">
            <h3 className="token-editor-title">{t.map_token_label}</h3>
            {map.tokens.map(tok => (
              <div className="token-edit-row" key={tok.id}>
                <span className="token-swatch" style={{ background: tok.color }} />
                <input className="gla-input" value={tok.label} placeholder={tokenLabels[tok.kind] ?? tok.kind}
                  onChange={e => patchToken(tok.id, { label: e.target.value.slice(0, 18) })} />
                <span className="token-kind">{tokenLabels[tok.kind] ?? tok.kind}</span>
                <button className="inv-del" onClick={() => delToken(tok.id)} aria-label={t.remove}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
