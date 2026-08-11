import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { BauwerkArt, TerrainArt, Zeichenraster } from "../types";
import { newId } from "../lib/game";
import { useCampaign } from "../state/CampaignContext";
import { useSession } from "../state/SessionContext";
import { useT } from "../i18n";

export const TERRAIN_COLORS: Record<TerrainArt, string> = {
  wasser: "#2b6d8f", strand: "#e3d29a", gruen: "#5a9e52",
  wald: "#2f6d3a", fels: "#7d766b", weg: "#c2ac7a",
};

const BUILDING_ICONS: Record<BauwerkArt, string> = {
  haus: "🏠", turm: "🗼", taverne: "🍺", hafen: "⚓",
  schatz: "💰", kreuz: "❌", baum: "🌴", berg: "⛰",
};

const GRID_COLS = 60, GRID_ROWS = 40;
const MALBAR: TerrainArt[] = ["gruen", "wald", "strand", "wasser", "fels", "weg"];
const ALL_BUILDINGS = Object.keys(BUILDING_ICONS) as BauwerkArt[];

const leeresRaster = (): Zeichenraster => ({
  cols: GRID_COLS, rows: GRID_ROWS,
  cells: new Array<TerrainArt>(GRID_COLS * GRID_ROWS).fill("wasser"),
});

type Malmodus = "terrain" | "gebaeude" | "radierer";

export function Cartography() {
  const { drawing, setDrawing, setMap, storage, saveNow, showToast } = useCampaign();
  const { setTab } = useSession();
  const t = useT();

  const terrainLabels: Record<TerrainArt, string> = {
    wasser: t.carto_terrain_water, strand: t.carto_terrain_beach, gruen: t.carto_terrain_meadow,
    wald: t.carto_terrain_forest, fels: t.carto_terrain_rock, weg: t.carto_terrain_path,
  };
  const buildingLabels: Record<BauwerkArt, string> = {
    haus: t.carto_building_house, turm: t.carto_building_tower, taverne: t.carto_building_tavern,
    hafen: t.carto_building_harbor, schatz: t.carto_building_treasure, kreuz: t.carto_building_x,
    baum: t.carto_building_palm, berg: t.carto_building_mountain,
  };

  const [terrain, setTerrain] = useState<TerrainArt>("gruen");
  const [bauwerk, setBauwerk] = useState<BauwerkArt>("haus");
  const [brush, setBrush] = useState(1);
  const [modus, setModus] = useState<Malmodus>("terrain");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridRef = useRef<Zeichenraster>(drawing.grid ?? leeresRaster());
  const malend = useRef(false);

  function render(g: Zeichenraster) {
    const cv = canvasRef.current;
    if (!cv) return;
    if (cv.width !== 900) { cv.width = 900; cv.height = 600; }
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const cellW = cv.width / g.cols, cellH = cv.height / g.rows;
    for (let y = 0; y < g.rows; y++) {
      for (let x = 0; x < g.cols; x++) {
        ctx.fillStyle = TERRAIN_COLORS[g.cells[y * g.cols + x]] || "#2b6d8f";
        ctx.fillRect(Math.floor(x * cellW), Math.floor(y * cellH), Math.ceil(cellW) + 1, Math.ceil(cellH) + 1);
      }
    }
  }

  useEffect(() => {
    if (drawing.grid && drawing.grid !== gridRef.current) gridRef.current = drawing.grid;
    render(gridRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing.grid]);

  function commit() {
    const g = gridRef.current;
    setDrawing(z => ({ ...z, grid: { ...g, cells: [...g.cells] } }));
  }

  function paintAt(clientX: number, clientY: number) {
    const cv = canvasRef.current;
    if (!cv) return;
    const g = gridRef.current;
    const rect = cv.getBoundingClientRect();
    const cx = Math.max(0, Math.min(g.cols - 1, Math.floor(((clientX - rect.left) / rect.width) * g.cols)));
    const cy = Math.max(0, Math.min(g.rows - 1, Math.floor(((clientY - rect.top) / rect.height) * g.rows)));
    const r = brush - 1;
    const terr: TerrainArt = modus === "radierer" ? "wasser" : terrain;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const cellW = cv.width / g.cols, cellH = cv.height / g.rows;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= g.cols || y >= g.rows) continue;
        g.cells[y * g.cols + x] = terr;
        ctx.fillStyle = TERRAIN_COLORS[terr];
        ctx.fillRect(Math.floor(x * cellW), Math.floor(y * cellH), Math.ceil(cellW) + 1, Math.ceil(cellH) + 1);
      }
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (modus === "gebaeude") {
      const cv = canvasRef.current;
      if (!cv) return;
      const rect = cv.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setDrawing(z => ({ ...z, buildings: [...z.buildings, { id: newId("b"), kind: bauwerk, x, y }] }));
      return;
    }
    e.preventDefault();
    malend.current = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* egal */ }
    paintAt(e.clientX, e.clientY);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!malend.current) return;
    paintAt(e.clientX, e.clientY);
  }

  function onPointerUp() {
    if (!malend.current) return;
    malend.current = false;
    commit();
  }

  function leeren() {
    const g = leeresRaster();
    gridRef.current = g;
    render(g);
    setDrawing({ grid: { ...g, cells: [...g.cells] }, buildings: [] });
  }

  async function alsKarteUebernehmen() {
    const cv = canvasRef.current;
    if (!cv || !drawing.grid) { showToast(t.carto_draw_first); return; }
    const out = document.createElement("canvas");
    out.width = cv.width; out.height = cv.height;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(cv, 0, 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.round(out.width / 28)}px serif`;
    for (const b of drawing.buildings) {
      const icon = BUILDING_ICONS[b.kind] ?? BUILDING_ICONS.haus;
      ctx.fillText(icon, (b.x / 100) * out.width, (b.y / 100) * out.height);
    }
    try {
      const wert = await storage.bildSpeichern(out.toDataURL("image/jpeg", 0.85));
      setMap(k => ({ ...k, bg: wert }));
      setTab("karte");
      showToast(t.carto_taken);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.carto_failed);
    }
  }

  const modeHint = modus === "gebaeude"
    ? t.carto_hint_place.replace('[0]', buildingLabels[bauwerk])
    : modus === "radierer"
      ? t.carto_hint_erase
      : t.carto_hint_paint.replace('[0]', terrainLabels[terrain]);

  return (
    <div style={{ padding: "0 14px" }}>
      <div className="draw-panel">
        <div className="draw-tools">
          <div className="tool-group">
            <span className="tool-label">{t.carto_paint}</span>
            {MALBAR.map(tr => (
              <button key={tr}
                className={`terr-btn ${modus === "terrain" && terrain === tr ? "on" : ""}`}
                style={{ "--terr": TERRAIN_COLORS[tr] } as CSSProperties}
                onClick={() => { setModus("terrain"); setTerrain(tr); }}>
                <span className="terr-swatch" />{terrainLabels[tr]}
              </button>
            ))}
            <button className={`terr-btn eraser ${modus === "radierer" ? "on" : ""}`}
              onClick={() => setModus("radierer")}>◌ {t.carto_eraser}</button>
          </div>

          <div className="tool-group">
            <span className="tool-label">{t.carto_brush}</span>
            {[1, 2, 3, 5].map(b => (
              <button key={b} className={`brush-btn ${brush === b ? "on" : ""}`}
                onClick={() => setBrush(b)}>{b}</button>
            ))}
          </div>

          <div className="tool-group">
            <span className="tool-label">{t.carto_buildings}</span>
            {ALL_BUILDINGS.map(k => (
              <button key={k}
                className={`bld-btn ${modus === "gebaeude" && bauwerk === k ? "on" : ""}`}
                onClick={() => { setModus("gebaeude"); setBauwerk(k); }} title={buildingLabels[k]}>
                {BUILDING_ICONS[k]}
              </button>
            ))}
          </div>
        </div>

        <div className="draw-stage">
          <canvas
            ref={canvasRef}
            className="draw-canvas"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onPointerCancel={onPointerUp}
          />
          {drawing.buildings.map(b => (
            <div key={b.id} className="bld-marker" style={{ left: b.x + "%", top: b.y + "%" }}>
              <span className="bld-icon">{BUILDING_ICONS[b.kind] ?? BUILDING_ICONS.haus}</span>
              <button className="bld-del" aria-label={t.remove}
                onClick={() => setDrawing(z => ({ ...z, buildings: z.buildings.filter(x => x.id !== b.id) }))}>✕</button>
            </div>
          ))}
        </div>

        <div className="draw-actions">
          <span className="draw-mode-hint">{modeHint}</span>
          <span style={{ flex: 1 }} />
          <button className="gla-btn" onClick={leeren}>{t.carto_clear}</button>
          <button className="gla-btn" onClick={() => saveNow("drawing")}>{t.carto_save}</button>
          <button className="gla-btn primary" onClick={alsKarteUebernehmen}>{t.carto_take_as_map}</button>
        </div>
      </div>
    </div>
  );
}
