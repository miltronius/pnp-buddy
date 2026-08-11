import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { BuildingType, TerrainType, DrawingGrid } from "../types";
import { newId } from "../lib/game";
import { useCampaign } from "../state/CampaignContext";
import { useSession } from "../state/SessionContext";
import { useT } from "../i18n";

export const TERRAIN_COLORS: Record<TerrainType, string> = {
  water: "#2b6d8f", beach: "#e3d29a", grass: "#5a9e52",
  forest: "#2f6d3a", rock: "#7d766b", path: "#c2ac7a",
};

const BUILDING_ICONS: Record<BuildingType, string> = {
  house: "🏠", tower: "🗼", tavern: "🍺", harbor: "⚓",
  treasure: "💰", cross: "❌", tree: "🌴", mountain: "⛰",
};

const GRID_COLS = 60, GRID_ROWS = 40;
const PAINTABLE: TerrainType[] = ["grass", "forest", "beach", "water", "rock", "path"];
const ALL_BUILDINGS = Object.keys(BUILDING_ICONS) as BuildingType[];

const emptyGrid = (): DrawingGrid => ({
  cols: GRID_COLS, rows: GRID_ROWS,
  cells: new Array<TerrainType>(GRID_COLS * GRID_ROWS).fill("water"),
});

type PaintMode = "terrain" | "building" | "eraser";

export function Cartography() {
  const { drawing, setDrawing, setMap, storage, saveNow, showToast } = useCampaign();
  const { setTab } = useSession();
  const t = useT();

  const terrainLabels: Record<TerrainType, string> = {
    water: t.carto_terrain_water, beach: t.carto_terrain_beach, grass: t.carto_terrain_meadow,
    forest: t.carto_terrain_forest, rock: t.carto_terrain_rock, path: t.carto_terrain_path,
  };
  const buildingLabels: Record<BuildingType, string> = {
    house: t.carto_building_house, tower: t.carto_building_tower, tavern: t.carto_building_tavern,
    harbor: t.carto_building_harbor, treasure: t.carto_building_treasure, cross: t.carto_building_x,
    tree: t.carto_building_palm, mountain: t.carto_building_mountain,
  };

  const [terrain, setTerrain] = useState<TerrainType>("grass");
  const [building, setBuilding] = useState<BuildingType>("house");
  const [brush, setBrush] = useState(1);
  const [mode, setMode] = useState<PaintMode>("terrain");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridRef = useRef<DrawingGrid>(drawing.grid ?? emptyGrid());
  const painting = useRef(false);

  function render(g: DrawingGrid) {
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
    const terr: TerrainType = mode === "eraser" ? "water" : terrain;
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
    if (mode === "building") {
      const cv = canvasRef.current;
      if (!cv) return;
      const rect = cv.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setDrawing(z => ({ ...z, buildings: [...z.buildings, { id: newId("b"), kind: building, x, y }] }));
      return;
    }
    e.preventDefault();
    painting.current = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* egal */ }
    paintAt(e.clientX, e.clientY);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!painting.current) return;
    paintAt(e.clientX, e.clientY);
  }

  function onPointerUp() {
    if (!painting.current) return;
    painting.current = false;
    commit();
  }

  function clearGrid() {
    const g = emptyGrid();
    gridRef.current = g;
    render(g);
    setDrawing({ grid: { ...g, cells: [...g.cells] }, buildings: [] });
  }

  async function takeAsMap() {
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
      const icon = BUILDING_ICONS[b.kind] ?? BUILDING_ICONS.house;
      ctx.fillText(icon, (b.x / 100) * out.width, (b.y / 100) * out.height);
    }
    try {
      const value = await storage.saveImage(out.toDataURL("image/jpeg", 0.85));
      setMap(k => ({ ...k, bg: value }));
      setTab("map");
      showToast(t.carto_taken);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.carto_failed);
    }
  }

  const modeHint = mode === "building"
    ? t.carto_hint_place.replace('[0]', buildingLabels[building])
    : mode === "eraser"
      ? t.carto_hint_erase
      : t.carto_hint_paint.replace('[0]', terrainLabels[terrain]);

  return (
    <div style={{ padding: "0 14px" }}>
      <div className="draw-panel">
        <div className="draw-tools">
          <div className="tool-group">
            <span className="tool-label">{t.carto_paint}</span>
            {PAINTABLE.map(tr => (
              <button key={tr}
                className={`terr-btn ${mode === "terrain" && terrain === tr ? "on" : ""}`}
                style={{ "--terr": TERRAIN_COLORS[tr] } as CSSProperties}
                onClick={() => { setMode("terrain"); setTerrain(tr); }}>
                <span className="terr-swatch" />{terrainLabels[tr]}
              </button>
            ))}
            <button className={`terr-btn eraser ${mode === "eraser" ? "on" : ""}`}
              onClick={() => setMode("eraser")}>◌ {t.carto_eraser}</button>
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
                className={`bld-btn ${mode === "building" && building === k ? "on" : ""}`}
                onClick={() => { setMode("building"); setBuilding(k); }} title={buildingLabels[k]}>
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
              <span className="bld-icon">{BUILDING_ICONS[b.kind] ?? BUILDING_ICONS.house}</span>
              <button className="bld-del" aria-label={t.remove}
                onClick={() => setDrawing(z => ({ ...z, buildings: z.buildings.filter(x => x.id !== b.id) }))}>✕</button>
            </div>
          ))}
        </div>

        <div className="draw-actions">
          <span className="draw-mode-hint">{modeHint}</span>
          <span style={{ flex: 1 }} />
          <button className="gla-btn" onClick={clearGrid}>{t.carto_clear}</button>
          <button className="gla-btn" onClick={() => saveNow("drawing")}>{t.carto_save}</button>
          <button className="gla-btn primary" onClick={takeAsMap}>{t.carto_take_as_map}</button>
        </div>
      </div>
    </div>
  );
}
