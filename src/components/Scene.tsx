import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { BodenArt, DetailObjekt } from "../types";
import { newId } from "../lib/game";
import { useCampaign } from "../state/CampaignContext";
import { useSession } from "../state/SessionContext";
import { useT } from "../i18n";

const DET_FLOORS: Record<BodenArt, string> = {
  stein: "#8a857c", holz: "#a9793f", gras: "#5a9e52", wasser: "#2b6d8f", sand: "#e3d29a",
};
const DET_GRID = 32;
const BOEDEN = Object.keys(DET_FLOORS) as BodenArt[];

type Werkzeug = "rect" | "circle" | "wall" | "door" | "label" | "select";
interface Entwurf { tool: Werkzeug; x1: number; y1: number; x2: number; y2: number }

export function Scene() {
  const { scene, setScene, setMap, storage, saveNow, showToast } = useCampaign();
  const { setTab } = useSession();
  const t = useT();

  const floorLabels: Record<BodenArt, string> = {
    stein: t.scene_floor_stone, holz: t.scene_floor_wood,
    gras: t.scene_floor_grass, wasser: t.scene_floor_water, sand: t.scene_floor_sand,
  };

  const [tool, setTool] = useState<Werkzeug>("rect");
  const [floor, setFloor] = useState<BodenArt>("stein");
  const [snap, setSnap] = useState(true);
  const [draft, setDraft] = useState<Entwurf | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const draftRef = useRef<Entwurf | null>(null);
  const dragRef = useRef<{ id: string; pointerId: number; offX: number; offY: number } | null>(null);

  const objects = scene.objects;
  const setObjects = (f: (os: DetailObjekt[]) => DetailObjekt[]) =>
    setScene(s => ({ ...s, objects: f(s.objects) }));

  function punkt(e: ReactPointerEvent<SVGSVGElement>, rastern: boolean) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    let x = ((e.clientX - r.left) / r.width) * 100;
    let y = ((e.clientY - r.top) / r.height) * 100;
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));
    if (rastern && snap) {
      const cx = 100 / DET_GRID, cy = 100 / Math.round(DET_GRID * 0.66);
      x = Math.round(x / cx) * cx;
      y = Math.round(y / cy) * cy;
    }
    return { x, y };
  }

  function objektBei(px: number, py: number): DetailObjekt | null {
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i];
      if (o.type === "rect" && px >= o.x && px <= o.x + o.w && py >= o.y && py <= o.y + o.h) return o;
      if (o.type === "circle") {
        const dx = (px - o.cx) / (o.rx || 0.001), dy = (py - o.cy) / (o.ry || 0.001);
        if (dx * dx + dy * dy <= 1) return o;
      }
      if (o.type === "label" && Math.abs(px - o.x) < 8 && Math.abs(py - o.y) < 4) return o;
    }
    return null;
  }

  function onPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    e.preventDefault();

    if (tool === "label") {
      const p = punkt(e, false);
      const text = window.prompt("Beschriftung:", "");
      if (text != null && text.trim()) {
        setObjects(os => [...os, { id: newId("o"), type: "label", x: p.x, y: p.y, text: text.trim().slice(0, 40) }]);
      }
      return;
    }
    if (tool === "select") {
      const p = punkt(e, false);
      const treffer = objektBei(p.x, p.y);
      if (treffer && treffer.type !== "wall") {
        try { svg.setPointerCapture(e.pointerId); } catch { /* egal */ }
        const ref = treffer.type === "circle" ? { x: treffer.cx, y: treffer.cy } : { x: treffer.x, y: treffer.y };
        dragRef.current = { id: treffer.id, pointerId: e.pointerId, offX: p.x - ref.x, offY: p.y - ref.y };
      }
      return;
    }
    try { svg.setPointerCapture(e.pointerId); } catch { /* egal */ }
    const p = punkt(e, true);
    draftRef.current = { tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y };
    setDraft({ ...draftRef.current });
  }

  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    const d = dragRef.current;
    if (d && d.pointerId === e.pointerId) {
      const p = punkt(e, false);
      setObjects(os => os.map(o => {
        if (o.id !== d.id) return o;
        if (o.type === "circle") return { ...o, cx: p.x - d.offX, cy: p.y - d.offY };
        if (o.type === "wall") return o;
        return { ...o, x: p.x - d.offX, y: p.y - d.offY };
      }));
      return;
    }
    const entwurf = draftRef.current;
    if (!entwurf) return;
    const p = punkt(e, true);
    entwurf.x2 = p.x;
    entwurf.y2 = p.y;
    setDraft({ ...entwurf });
  }

  function onPointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    if (dragRef.current && dragRef.current.pointerId === e.pointerId) {
      dragRef.current = null;
      return;
    }
    const entwurf = draftRef.current;
    if (!entwurf) return;
    draftRef.current = null;
    setDraft(null);
    const { tool: tl, x1, y1, x2, y2 } = entwurf;
    const id = newId("o");
    if (tl === "rect") {
      const x = Math.min(x1, x2), y = Math.min(y1, y2);
      const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
      if (w < 1 || h < 1) return;
      setObjects(os => [...os, { id, type: "rect", x, y, w, h, terr: floor }]);
    } else if (tl === "circle") {
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
      const rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
      if (rx < 0.5 || ry < 0.5) return;
      setObjects(os => [...os, { id, type: "circle", cx, cy, rx, ry, terr: floor }]);
    } else if (tl === "wall" || tl === "door") {
      if (Math.hypot(x2 - x1, y2 - y1) < 1) return;
      setObjects(os => [...os, { id, type: "wall", x1, y1, x2, y2, door: tl === "door" }]);
    }
  }

  const loeschen = (id: string) => setObjects(os => os.filter(o => o.id !== id));

  function labelBearbeiten(o: Extract<DetailObjekt, { type: "label" }>) {
    const text = window.prompt("Beschriftung:", o.text);
    if (text != null) {
      setObjects(os => os.map(x => (x.id === o.id && x.type === "label" ? { ...x, text: text.trim().slice(0, 40) } : x)));
    }
  }

  function alsKarteUebernehmen() {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll(".det-draft").forEach(n => n.remove());
    clone.setAttribute("width", "1200");
    clone.setAttribute("height", "800");
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent =
      ".det-label-text{font-family:'Pirata One',Georgia,serif;font-size:2.4px;fill:#2b2014;" +
      "paint-order:stroke;stroke:#f3e6c8;stroke-width:0.5px;stroke-linejoin:round}";
    clone.insertBefore(style, clone.firstChild);

    const xml = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    img.onload = async () => {
      const cv = document.createElement("canvas");
      cv.width = 1200; cv.height = 800;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      try {
        const wert = await storage.bildSpeichern(cv.toDataURL("image/jpeg", 0.88));
        setMap(k => ({ ...k, bg: wert }));
        setTab("karte");
        showToast(t.scene_taken);
      } catch (err) {
        showToast(err instanceof Error ? err.message : t.scene_failed);
      }
    };
    img.onerror = () => showToast(t.scene_failed);
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  }

  const modeHint =
    tool === "select" ? t.scene_hint_select
    : tool === "label" ? t.scene_hint_label
    : tool === "wall" ? t.scene_hint_wall
    : tool === "door" ? t.scene_hint_door
    : tool === "circle"
      ? t.scene_hint_round.replace('[0]', floorLabels[floor])
      : t.scene_hint_rect.replace('[0]', floorLabels[floor]);

  return (
    <div style={{ padding: "0 14px" }}>
      <div className="det-panel">
        <div className="det-tools">
          <div className="tool-group">
            <span className="tool-label">{t.scene_tool}</span>
            <button className={`det-tbtn ${tool === "rect" ? "on" : ""}`} onClick={() => setTool("rect")} title="Rechteck-Raum">▭ Raum</button>
            <button className={`det-tbtn ${tool === "circle" ? "on" : ""}`} onClick={() => setTool("circle")} title="Runder Raum">◯ Rund</button>
            <button className={`det-tbtn ${tool === "wall" ? "on" : ""}`} onClick={() => setTool("wall")} title="Wand ziehen">▬ Wand</button>
            <button className={`det-tbtn ${tool === "door" ? "on" : ""}`} onClick={() => setTool("door")} title="Tür ziehen">╫ Tür</button>
            <button className={`det-tbtn ${tool === "label" ? "on" : ""}`} onClick={() => setTool("label")} title="Text setzen">T Text</button>
            <button className={`det-tbtn ${tool === "select" ? "on" : ""}`} onClick={() => setTool("select")} title="Verschieben">✋ Wählen</button>
          </div>

          <div className="tool-group">
            <span className="tool-label">{t.scene_floor}</span>
            {BOEDEN.map(f => (
              <button key={f} className={`terr-btn ${floor === f ? "on" : ""}`}
                style={{ "--terr": DET_FLOORS[f] } as CSSProperties} onClick={() => setFloor(f)}>
                <span className="terr-swatch" />{floorLabels[f]}
              </button>
            ))}
            <span className="map-sep" />
            <span className="tool-label" style={{ minWidth: "auto" }}>{t.scene_bg}</span>
            <select className="det-bg-sel" value={scene.bg} aria-label={t.scene_bg}
              onChange={e => setScene(s => ({ ...s, bg: e.target.value as BodenArt }))}>
              {BOEDEN.map(f => <option key={f} value={f}>{floorLabels[f]}</option>)}
            </select>
            <button className={`det-tbtn ${snap ? "on" : ""}`} onClick={() => setSnap(v => !v)} title={t.scene_grid_snap}>{t.scene_grid_snap}</button>
          </div>
        </div>

        <div className="det-stage">
          <svg
            ref={svgRef}
            className="det-svg"
            viewBox="0 0 100 66"
            preserveAspectRatio="none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{ touchAction: "none", cursor: tool === "select" ? "grab" : "crosshair" }}
          >
            <rect x="0" y="0" width="100" height="66" fill={DET_FLOORS[scene.bg]} />
            <g className="det-grid-lines">
              {Array.from({ length: DET_GRID + 1 }).map((_, i) => (
                <line key={"v" + i} x1={(i * 100) / DET_GRID} y1="0" x2={(i * 100) / DET_GRID} y2="66"
                  stroke="rgba(0,0,0,0.13)" strokeWidth="0.15" />
              ))}
              {Array.from({ length: Math.round(DET_GRID * 0.66) + 1 }).map((_, i) => (
                <line key={"h" + i} x1="0" y1={(i * 100) / DET_GRID} x2="100" y2={(i * 100) / DET_GRID}
                  stroke="rgba(0,0,0,0.13)" strokeWidth="0.15" />
              ))}
            </g>

            {objects.map(o => {
              if (o.type === "rect") return (
                <rect key={o.id} x={o.x} y={o.y} width={o.w} height={o.h}
                  fill={DET_FLOORS[o.terr]} stroke="rgba(0,0,0,.35)" strokeWidth="0.25"
                  onDoubleClick={() => loeschen(o.id)}
                  style={{ cursor: tool === "select" ? "grab" : "inherit" }} />
              );
              if (o.type === "circle") return (
                <ellipse key={o.id} cx={o.cx} cy={o.cy} rx={o.rx} ry={o.ry}
                  fill={DET_FLOORS[o.terr]} stroke="rgba(0,0,0,.35)" strokeWidth="0.25"
                  onDoubleClick={() => loeschen(o.id)}
                  style={{ cursor: tool === "select" ? "grab" : "inherit" }} />
              );
              if (o.type === "wall") return (
                <line key={o.id} x1={o.x1} y1={o.y1} x2={o.x2} y2={o.y2}
                  stroke={o.door ? "#b8862b" : "#2b2014"} strokeWidth={o.door ? 1.4 : 1.1}
                  strokeLinecap="round" strokeDasharray={o.door ? "2 1.4" : "none"}
                  onDoubleClick={() => loeschen(o.id)} />
              );
              return (
                <text key={o.id} x={o.x} y={o.y} className="det-label-text"
                  textAnchor="middle" dominantBaseline="middle"
                  onDoubleClick={() => labelBearbeiten(o)}
                  style={{ cursor: tool === "select" ? "grab" : "pointer" }}>{o.text}</text>
              );
            })}

            {draft && draft.tool === "rect" && (
              <rect className="det-draft" x={Math.min(draft.x1, draft.x2)} y={Math.min(draft.y1, draft.y2)}
                width={Math.abs(draft.x2 - draft.x1)} height={Math.abs(draft.y2 - draft.y1)}
                fill={DET_FLOORS[floor]} opacity="0.6" stroke="#000" strokeWidth="0.3" strokeDasharray="1 1" />
            )}
            {draft && draft.tool === "circle" && (
              <ellipse className="det-draft" cx={(draft.x1 + draft.x2) / 2} cy={(draft.y1 + draft.y2) / 2}
                rx={Math.abs(draft.x2 - draft.x1) / 2} ry={Math.abs(draft.y2 - draft.y1) / 2}
                fill={DET_FLOORS[floor]} opacity="0.6" stroke="#000" strokeWidth="0.3" strokeDasharray="1 1" />
            )}
            {draft && (draft.tool === "wall" || draft.tool === "door") && (
              <line className="det-draft" x1={draft.x1} y1={draft.y1} x2={draft.x2} y2={draft.y2}
                stroke={draft.tool === "door" ? "#b8862b" : "#2b2014"} strokeWidth="1.2"
                strokeLinecap="round" opacity="0.7" />
            )}
          </svg>
        </div>

        <div className="det-actions">
          <span className="draw-mode-hint">{modeHint}</span>
          <span style={{ flex: 1 }} />
          <button className="gla-btn" onClick={() => setObjects(os => os.slice(0, -1))}>{t.scene_undo}</button>
          <button className="gla-btn" onClick={() => setObjects(() => [])}>{t.scene_clear}</button>
          <button className="gla-btn" onClick={() => saveNow("scene")}>{t.scene_save}</button>
          <button className="gla-btn primary" onClick={alsKarteUebernehmen}>{t.scene_take_as_map}</button>
        </div>
      </div>
    </div>
  );
}
