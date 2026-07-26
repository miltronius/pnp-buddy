import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { BauwerkArt, TerrainArt, Zeichenraster } from "../types";
import { neueId } from "../lib/spiel";
import { useKampagne } from "../state/KampagneContext";
import { useSitzung } from "../state/SitzungContext";

export const TERRAIN_COLORS: Record<TerrainArt, string> = {
  wasser: "#2b6d8f", strand: "#e3d29a", gruen: "#5a9e52",
  wald: "#2f6d3a", fels: "#7d766b", weg: "#c2ac7a",
};
const TERRAIN_LABELS: Record<TerrainArt, string> = {
  wasser: "Wasser", strand: "Strand", gruen: "Wiese",
  wald: "Wald", fels: "Fels", weg: "Weg",
};
const BUILDINGS: Record<BauwerkArt, { icon: string; label: string }> = {
  haus: { icon: "🏠", label: "Haus" }, turm: { icon: "🗼", label: "Turm" },
  taverne: { icon: "🍺", label: "Taverne" }, hafen: { icon: "⚓", label: "Hafen" },
  schatz: { icon: "💰", label: "Schatz" }, kreuz: { icon: "❌", label: "X-Markiert-die-Stelle" },
  baum: { icon: "🌴", label: "Palme" }, berg: { icon: "⛰", label: "Berg" },
};

const GRID_COLS = 60, GRID_ROWS = 40;
const MALBAR: TerrainArt[] = ["gruen", "wald", "strand", "wasser", "fels", "weg"];

const leeresRaster = (): Zeichenraster => ({
  cols: GRID_COLS, rows: GRID_ROWS,
  cells: new Array<TerrainArt>(GRID_COLS * GRID_ROWS).fill("wasser"),
});

type Malmodus = "terrain" | "gebaeude" | "radierer";

export function Kartografie() {
  const { zeichnung, setZeichnung, setKarte, speicher, jetztSpeichern, zeigeToast } = useKampagne();
  const { setTab } = useSitzung();

  const [terrain, setTerrain] = useState<TerrainArt>("gruen");
  const [bauwerk, setBauwerk] = useState<BauwerkArt>("haus");
  const [brush, setBrush] = useState(1);
  const [modus, setModus] = useState<Malmodus>("terrain");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridRef = useRef<Zeichenraster>(zeichnung.grid ?? leeresRaster());
  const malend = useRef(false);

  /* ---- Raster aufs Canvas zeichnen ---- */
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

  // Nach dem Laden (oder nach einem Commit) das Raster übernehmen und neu zeichnen.
  useEffect(() => {
    if (zeichnung.grid && zeichnung.grid !== gridRef.current) gridRef.current = zeichnung.grid;
    render(gridRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zeichnung.grid]);

  /** Gemalte Zellen in den Kampagnen-Zustand übernehmen (löst das Speichern aus). */
  function commit() {
    const g = gridRef.current;
    setZeichnung(z => ({ ...z, grid: { ...g, cells: [...g.cells] } }));
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
      setZeichnung(z => ({ ...z, buildings: [...z.buildings, { id: neueId("b"), kind: bauwerk, x, y }] }));
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
    setZeichnung({ grid: { ...g, cells: [...g.cells] }, buildings: [] });
  }

  /** Zeichnung als Bild-Hintergrund in den Figuren-Tracker übernehmen. */
  async function alsKarteUebernehmen() {
    const cv = canvasRef.current;
    if (!cv || !zeichnung.grid) { zeigeToast("Erst etwas zeichnen"); return; }
    // Gebäude aufs Bild brennen
    const out = document.createElement("canvas");
    out.width = cv.width; out.height = cv.height;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(cv, 0, 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.round(out.width / 28)}px serif`;
    for (const b of zeichnung.buildings) {
      const icon = (BUILDINGS[b.kind] ?? BUILDINGS.haus).icon;
      ctx.fillText(icon, (b.x / 100) * out.width, (b.y / 100) * out.height);
    }
    try {
      const wert = await speicher.bildSpeichern(out.toDataURL("image/jpeg", 0.85));
      setKarte(k => ({ ...k, bg: wert }));
      setTab("karte");
      zeigeToast("Zeichnung als Karte übernommen ⚓");
    } catch (err) {
      zeigeToast(err instanceof Error ? err.message : "Übernahme fehlgeschlagen");
    }
  }

  return (
    <div style={{ padding: "0 14px" }}>
      <div className="draw-panel">
        <div className="draw-tools">
          <div className="tool-group">
            <span className="tool-label">Malen:</span>
            {MALBAR.map(t => (
              <button key={t}
                className={`terr-btn ${modus === "terrain" && terrain === t ? "on" : ""}`}
                style={{ "--terr": TERRAIN_COLORS[t] } as CSSProperties}
                onClick={() => { setModus("terrain"); setTerrain(t); }}>
                <span className="terr-swatch" />{TERRAIN_LABELS[t]}
              </button>
            ))}
            <button className={`terr-btn eraser ${modus === "radierer" ? "on" : ""}`}
              onClick={() => setModus("radierer")}>◌ Radierer</button>
          </div>

          <div className="tool-group">
            <span className="tool-label">Pinsel:</span>
            {[1, 2, 3, 5].map(b => (
              <button key={b} className={`brush-btn ${brush === b ? "on" : ""}`}
                onClick={() => setBrush(b)}>{b}</button>
            ))}
          </div>

          <div className="tool-group">
            <span className="tool-label">Bauwerke:</span>
            {(Object.entries(BUILDINGS) as [BauwerkArt, { icon: string; label: string }][]).map(([k, b]) => (
              <button key={k}
                className={`bld-btn ${modus === "gebaeude" && bauwerk === k ? "on" : ""}`}
                onClick={() => { setModus("gebaeude"); setBauwerk(k); }} title={b.label}>{b.icon}</button>
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
          {zeichnung.buildings.map(b => (
            <div key={b.id} className="bld-marker" style={{ left: b.x + "%", top: b.y + "%" }}>
              <span className="bld-icon">{(BUILDINGS[b.kind] ?? BUILDINGS.haus).icon}</span>
              <button className="bld-del" aria-label="Bauwerk entfernen"
                onClick={() => setZeichnung(z => ({ ...z, buildings: z.buildings.filter(x => x.id !== b.id) }))}>✕</button>
            </div>
          ))}
        </div>

        <div className="draw-actions">
          <span className="draw-mode-hint">
            {modus === "gebaeude"
              ? `Tippe auf die Karte, um „${BUILDINGS[bauwerk].label}“ zu setzen`
              : modus === "radierer"
                ? "Übermalt alles wieder mit Wasser"
                : `Zeichnet ${TERRAIN_LABELS[terrain]} — ziehen zum Malen`}
          </span>
          <span style={{ flex: 1 }} />
          <button className="gla-btn" onClick={leeren}>Leeren</button>
          <button className="gla-btn" onClick={() => jetztSpeichern("zeichnung")}>Speichern</button>
          <button className="gla-btn primary" onClick={alsKarteUebernehmen}>Als Karte übernehmen →</button>
        </div>
      </div>
    </div>
  );
}
