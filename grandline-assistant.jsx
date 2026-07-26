import { useState, useEffect, useRef } from "react";

/* ============================================================
   GRAND LINE ASSISTANT — Pen & Paper Companion (Prototyp)
   Charakterbogen + Würfeltisch mit echter Würfel-Physik:
   Die Würfel werden auf den Tisch geworfen, purzeln, prallen
   ab, rollen aus — und die Augenzahl wird aus der Seite
   abgelesen, die am Ende OBEN liegt.
   ============================================================ */

const ATTRIBUTES = [
  "Nahkampf", "Fernkampf", "Blocken",
  "Geschicklichkeit", "Intelligenz", "Konstitution",
  "Charisma", "Navigation", "Heilkunde",
];

function ausgleich(level) {
  const l = Number(level) || 0;
  if (l <= 1) return -4;
  if (l <= 3) return -3;
  if (l <= 5) return -2;
  if (l <= 7) return -1;
  if (l <= 12) return 0;
  if (l <= 15) return 1;
  if (l <= 17) return 2;
  if (l <= 19) return 3;
  return 4;
}

// Zerlegt einen Schadensausdruck wie "2W6+3" oder "W8 + W6" in Würfelgruppen.
function parseDamage(str) {
  const parts = [];
  const clean = String(str || "").replace(/\s+/g, "").toLowerCase();
  const re = /([+-]?)(\d*)[wd](\d+)|([+-]?\d+)/g;
  let m;
  while ((m = re.exec(clean))) {
    if (m[4] !== undefined) {
      parts.push({ flat: parseInt(m[4], 10) });
    } else {
      const sign = m[1] === "-" ? -1 : 1;
      const n = m[2] ? parseInt(m[2], 10) : 1;
      const sides = parseInt(m[3], 10);
      if ([4, 6, 8, 10, 12, 20, 100].includes(sides)) parts.push({ n, sides, sign });
    }
  }
  return parts;
}

// Level-Bilanz der Teufelsfrucht: welche Ränge sind bezahlbar/freischaltbar?
function fruchtBilanz(stufe, raenge) {
  let ausgegeben = 0;
  const base = (raenge || []).map(r => {
    const kosten = Math.max(0, r.kostenLevel | 0);
    if (r.unlocked) ausgegeben += kosten;
    return { ...r, kosten };
  });
  const verfuegbar = (stufe | 0) - ausgegeben;
  const out = base.map((r, i) => {
    const prevOk = i === 0 || base[i - 1].unlocked;
    const nextLocked = i === base.length - 1 || !base[i + 1].unlocked;
    return {
      ...r,
      canUnlock: !r.unlocked && prevOk && verfuegbar >= r.kosten,
      canLock: !!r.unlocked && nextLocked,
    };
  });
  return { verfuegbar, ausgegeben, raenge: out };
}

function newChar() {
  return {
    id: "c" + Date.now(),
    name: "",
    stufe: 0,
    leben: 14,
    schaden: "W6 + W6",
    aussehen: "",
    ziel: "",
    spezial: "",
    eigenschaften: "",
    habUndGut: [{ id: 1, text: "", anzahl: 1 }],
    waffen: [],
    skills: [],
    teufelsfrucht: { name: "", typ: "", raenge: [] },
    kopfgeld: 0,
    portrait: null,
    epitheton: "",
    berries: 0,
    attribute: Object.fromEntries(ATTRIBUTES.map(a => [a, 8])),
  };
}

/* ============================================================
   Starrkörper-Mathematik für konvexe Polyeder
   Jeder Würfeltyp wird aus seiner Eckenliste aufgebaut: Flächen,
   Volumen und Trägheitstensor werden berechnet, nicht gesetzt.
   Die platonischen Körper haben einen isotropen Tensor, der W10
   (pentagonales Trapezoeder) nicht — deshalb wird die Trägheit
   allgemein behandelt und pro Schritt ins Weltsystem gedreht.
   ============================================================ */
const DIE_A = 72;                        // Bezugsgröße: Kante eines W6
const GRAV = 2600;                       // px/s²
const RESTITUTION = 0.20;                // Sprungkraft
const FRICTION = 0.40;                   // Coulomb-Reibung
const SLOP = 0.1, BAUM = 0.45, RESTV = 70;

function qMul(a, b) {
  return [
    a[0]*b[0] - a[1]*b[1] - a[2]*b[2] - a[3]*b[3],
    a[0]*b[1] + a[1]*b[0] + a[2]*b[3] - a[3]*b[2],
    a[0]*b[2] - a[1]*b[3] + a[2]*b[0] + a[3]*b[1],
    a[0]*b[3] + a[1]*b[2] - a[2]*b[1] + a[3]*b[0],
  ];
}
function qNorm(q) {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0]/l, q[1]/l, q[2]/l, q[3]/l];
}
function qToM(q) {
  const [w, x, y, z] = q;
  return [
    1-2*(y*y+z*z), 2*(x*y-w*z),   2*(x*z+w*y),
    2*(x*y+w*z),   1-2*(x*x+z*z), 2*(y*z-w*x),
    2*(x*z-w*y),   2*(y*z+w*x),   1-2*(x*x+y*y),
  ];
}
function mRot(m, v) {
  return [m[0]*v[0]+m[1]*v[1]+m[2]*v[2], m[3]*v[0]+m[4]*v[1]+m[5]*v[2], m[6]*v[0]+m[7]*v[1]+m[8]*v[2]];
}
function mRotT(m, v) {
  return [m[0]*v[0]+m[3]*v[1]+m[6]*v[2], m[1]*v[0]+m[4]*v[1]+m[7]*v[2], m[2]*v[0]+m[5]*v[1]+m[8]*v[2]];
}
function cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function dot3(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
function sub3(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function norm3(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; }
function randQ() {
  const u = Math.random(), v = Math.random(), w = Math.random();
  return qNorm([
    Math.sqrt(1-u)*Math.sin(2*Math.PI*v), Math.sqrt(1-u)*Math.cos(2*Math.PI*v),
    Math.sqrt(u)*Math.sin(2*Math.PI*w),   Math.sqrt(u)*Math.cos(2*Math.PI*w),
  ]);
}
function qAngle(a, b) {
  const d = Math.min(1, Math.abs(a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3]));
  return 2 * Math.acos(d);
}
function mToCss(m) {
  return `matrix3d(${m[0]},${m[3]},${m[6]},0,${m[1]},${m[4]},${m[7]},0,${m[2]},${m[5]},${m[8]},0,0,0,0,1)`;
}

/* --- Flächen aus einer Eckenliste bestimmen (konvexe Hülle) --- */
function facesFromVerts(V) {
  const n = V.length, faces = [];
  for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++) for (let k = j+1; k < n; k++) {
    let nrm = cross(sub3(V[j], V[i]), sub3(V[k], V[i]));
    const len = Math.hypot(nrm[0], nrm[1], nrm[2]);
    if (len < 1e-6) continue;
    nrm = [nrm[0]/len, nrm[1]/len, nrm[2]/len];
    let d = dot3(nrm, V[i]);
    let pos = 0, neg = 0;
    for (let m = 0; m < n; m++) {
      const s = dot3(nrm, V[m]) - d;
      if (s > 1e-6) pos++; else if (s < -1e-6) neg++;
    }
    if (pos && neg) continue;
    if (pos) { nrm = [-nrm[0], -nrm[1], -nrm[2]]; d = dot3(nrm, V[i]); }
    let dup = false;
    for (const f of faces) if (dot3(f.n, nrm) > 0.9995 && Math.abs(f.d - d) < 1e-4) { dup = true; break; }
    if (dup) continue;
    const idx = [];
    for (let m = 0; m < n; m++) if (Math.abs(dot3(nrm, V[m]) - d) < 1e-4) idx.push(m);
    if (idx.length < 3) continue;
    const c = [0, 0, 0];
    idx.forEach(m => { c[0] += V[m][0]; c[1] += V[m][1]; c[2] += V[m][2]; });
    c[0] /= idx.length; c[1] /= idx.length; c[2] /= idx.length;
    const u = norm3(sub3(V[idx[0]], c)), v = cross(nrm, u);
    idx.sort((a, b) =>
      Math.atan2(dot3(sub3(V[a], c), v), dot3(sub3(V[a], c), u)) -
      Math.atan2(dot3(sub3(V[b], c), v), dot3(sub3(V[b], c), u)));
    faces.push({ n: nrm, d, idx, c, u, v });
  }
  return faces;
}

/* --- Volumen, Schwerpunkt und Trägheitstensor (Dichte 1) --- */
function inertiaOf(V, faces) {
  const S = [[2,1,1],[1,2,1],[1,1,2]].map(r => r.map(x => x/120));
  let vol = 0;
  const C = [[0,0,0],[0,0,0],[0,0,0]], com = [0,0,0];
  for (const f of faces) {
    for (let t = 1; t < f.idx.length - 1; t++) {
      const a = V[f.idx[0]], b = V[f.idx[t]], c = V[f.idx[t+1]];
      const A = [[a[0],b[0],c[0]],[a[1],b[1],c[1]],[a[2],b[2],c[2]]];
      const det = A[0][0]*(A[1][1]*A[2][2]-A[1][2]*A[2][1])
                - A[0][1]*(A[1][0]*A[2][2]-A[1][2]*A[2][0])
                + A[0][2]*(A[1][0]*A[2][1]-A[1][1]*A[2][0]);
      vol += det/6;
      for (let i = 0; i < 3; i++) com[i] += (det/6)*(a[i]+b[i]+c[i])/4;
      const AS = [[0,0,0],[0,0,0],[0,0,0]];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        let s = 0; for (let k = 0; k < 3; k++) s += A[i][k]*S[k][j]; AS[i][j] = s;
      }
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        let s = 0; for (let k = 0; k < 3; k++) s += AS[i][k]*A[j][k]; C[i][j] += det*s;
      }
    }
  }
  for (let i = 0; i < 3; i++) com[i] /= vol;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] -= vol*com[i]*com[j];
  const tr = C[0][0] + C[1][1] + C[2][2];
  const I = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) I[i][j] = (i === j ? tr : 0) - C[i][j];
  return { vol, com, I };
}
function inv3(M) {
  const d = M[0][0]*(M[1][1]*M[2][2]-M[1][2]*M[2][1])
          - M[0][1]*(M[1][0]*M[2][2]-M[1][2]*M[2][0])
          + M[0][2]*(M[1][0]*M[2][1]-M[1][1]*M[2][0]);
  const cof = (a, b) => M[(a+1)%3][(b+1)%3]*M[(a+2)%3][(b+2)%3] - M[(a+1)%3][(b+2)%3]*M[(a+2)%3][(b+1)%3];
  const R = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R[i][j] = cof(j, i)/d;
  return R;
}
/* Trägheit im Weltsystem: I⁻¹ᵥᵥ = R · I⁻¹ᵦ · Rᵀ */
function iinvWorld(m, Ib) {
  const R = [[m[0],m[1],m[2]],[m[3],m[4],m[5]],[m[6],m[7],m[8]]];
  const T = [[0,0,0],[0,0,0],[0,0,0]], O = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    let s = 0; for (let k = 0; k < 3; k++) s += R[i][k]*Ib[k][j]; T[i][j] = s;
  }
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    let s = 0; for (let k = 0; k < 3; k++) s += T[i][k]*R[j][k]; O[i][j] = s;
  }
  return O;
}
function applyI(Iw, v) {
  return [Iw[0][0]*v[0]+Iw[0][1]*v[1]+Iw[0][2]*v[2],
          Iw[1][0]*v[0]+Iw[1][1]*v[1]+Iw[1][2]*v[2],
          Iw[2][0]*v[0]+Iw[2][1]*v[1]+Iw[2][2]*v[2]];
}

/* --- Eckenlisten der Würfelformen --- */
const PHI = (1 + Math.sqrt(5)) / 2;
function vertsFor(sides) {
  if (sides === 4) return [[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]];
  if (sides === 6) {
    const v = [];
    for (const a of [-1,1]) for (const b of [-1,1]) for (const c of [-1,1]) v.push([a,b,c]);
    return v;
  }
  if (sides === 8) return [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  if (sides === 12) {
    const v = [];
    for (const a of [-1,1]) for (const b of [-1,1]) for (const c of [-1,1]) v.push([a,b,c]);
    for (const s1 of [-1,1]) for (const s2 of [-1,1]) {
      v.push([0, s1/PHI, s2*PHI]); v.push([s1/PHI, s2*PHI, 0]); v.push([s1*PHI, 0, s2/PHI]);
    }
    return v;
  }
  if (sides === 20) {
    const v = [];
    for (const s1 of [-1,1]) for (const s2 of [-1,1]) {
      v.push([0, s1, s2*PHI]); v.push([s1, s2*PHI, 0]); v.push([s1*PHI, 0, s2]);
    }
    return v;
  }
  // W10/W100: pentagonales Trapezoeder als Polardual des Antiprismas
  const anti = [];
  for (let k = 0; k < 5; k++) {
    const a = (2*Math.PI*k)/5;
    anti.push([Math.cos(a), Math.sin(a), 0.5]);
  }
  for (let k = 0; k < 5; k++) {
    const a = (2*Math.PI*k)/5 + Math.PI/5;
    anti.push([Math.cos(a), Math.sin(a), -0.5]);
  }
  return facesFromVerts(anti).map(f => [f.n[0]/f.d, f.n[1]/f.d, f.n[2]/f.d]);
}

const SHAPES = {};
function shapeFor(sides) {
  if (SHAPES[sides]) return SHAPES[sides];
  const geoSides = sides === 100 ? 10 : sides;
  let V = vertsFor(geoSides);
  const R0 = Math.max(...V.map(p => Math.hypot(p[0], p[1], p[2])));
  const s = (DIE_A * Math.sqrt(3) / 2) / R0;      // gleicher Umkreis wie ein W6
  V = V.map(p => [p[0]*s, p[1]*s, p[2]*s]);
  let F = facesFromVerts(V);
  const { com } = inertiaOf(V, F);
  V = V.map(p => [p[0]-com[0], p[1]-com[1], p[2]-com[2]]);
  F = facesFromVerts(V);
  const { vol, I } = inertiaOf(V, F);
  const dens = 1 / vol;                            // Masse = 1
  const Im = I.map(r => r.map(x => x*dens));
  // Werte verteilen: gegenüberliegende Flächen ergänzen sich zu n+1
  const n = F.length, values = new Array(n).fill(0);
  let next = 1;
  for (let i = 0; i < n; i++) {
    if (values[i]) continue;
    let opp = -1;
    for (let j = 0; j < n; j++) if (j !== i && !values[j] && dot3(F[i].n, F[j].n) < -0.999) { opp = j; break; }
    values[i] = next;
    if (opp >= 0) values[opp] = n + 1 - next;
    while (values.includes(next)) next++;
  }
  for (let i = 0; i < n; i++) if (!values[i]) { let v = 1; while (values.includes(v)) v++; values[i] = v; }
  const sh = {
    V, F, values, Iinv: inv3(Im),
    R: Math.max(...V.map(p => Math.hypot(p[0], p[1], p[2]))),
    sides,
  };
  SHAPES[sides] = sh;
  return sh;
}
/* Beschriftung einer Fläche */
function faceLabel(sh, i) {
  const v = sh.values[i];
  if (sh.sides === 10) return String(v % 10);
  if (sh.sides === 100) return String((v % 10) * 10).padStart(2, "0");
  return String(v);
}
/* Welche Fläche zeigt zur Kamera? Beim W4 wird unten abgelesen. */
function readFace(b) {
  const sign = b.sides === 4 ? -1 : 1;
  let best = -Infinity, bi = 0;
  for (let i = 0; i < b.sh.F.length; i++) {
    const f = b.sh.F[i].n;
    const nz = sign * (b.m[6]*f[0] + b.m[7]*f[1] + b.m[8]*f[2]);
    if (nz > best) { best = nz; bi = i; }
  }
  const v = b.sh.values[bi];
  if (b.sides === 10) return v % 10;
  if (b.sides === 100) return (v % 10) * 10;
  return v;
}
/* 1.0 = eine Fläche liegt exakt flach auf dem Tisch */
function flatness(b) {
  let best = -1;
  for (const f of b.sh.F) {
    const nz = -(b.m[6]*f.n[0] + b.m[7]*f.n[1] + b.m[8]*f.n[2]);
    if (nz > best) best = nz;
  }
  return best;
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Pirata+One&family=IM+Fell+English:ital@0;1&display=swap');

:root {
  --parchment: #e7d3a8;
  --ink: #2b2014;
  --ink-soft: #5a4630;
  --red: #8b2e1f;
  --gold: #b8862b;
  --sea: #14222e;
}

* { box-sizing: border-box; }

.gla-root {
  min-height: 100vh;
  background: var(--sea);
  background-image: radial-gradient(ellipse at 50% -20%, #2a4257 0%, var(--sea) 60%);
  font-family: 'IM Fell English', Georgia, serif;
  color: var(--ink);
  padding-bottom: 90px;
}

.gla-header { text-align: center; padding: 22px 16px 10px; color: var(--parchment); }
.gla-header h1 {
  font-family: 'Pirata One', Georgia, serif;
  font-weight: 400;
  font-size: clamp(30px, 6vw, 44px);
  margin: 0; letter-spacing: 2px;
  text-shadow: 0 2px 0 #000;
}
.gla-header .sub { font-style: italic; opacity: .7; font-size: 14px; margin-top: 2px; }

.gla-tabs { display: flex; justify-content: center; gap: 10px; margin: 14px 0 18px; flex-wrap: wrap; }
.gla-tab {
  font-family: 'Pirata One', Georgia, serif;
  font-size: 18px; letter-spacing: 1px;
  padding: 8px 22px;
  background: transparent; color: var(--parchment);
  border: 1px solid rgba(231,211,168,.35);
  border-radius: 3px; cursor: pointer;
  transition: all .15s ease;
}
.gla-tab:hover { border-color: var(--gold); }
.gla-tab.active { background: var(--parchment); color: var(--ink); border-color: var(--parchment); box-shadow: 0 3px 0 rgba(0,0,0,.4); }
.gla-tab:focus-visible, .gla-btn:focus-visible, .att-circle input:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }

.sheet {
  max-width: 880px; margin: 0 auto;
  background: var(--parchment);
  background-image:
    radial-gradient(ellipse at 20% 10%, rgba(255,255,255,.25), transparent 50%),
    radial-gradient(ellipse at 85% 90%, rgba(106,72,28,.18), transparent 55%),
    radial-gradient(ellipse at 70% 20%, rgba(106,72,28,.10), transparent 40%);
  border-radius: 4px;
  box-shadow: 0 10px 40px rgba(0,0,0,.55), inset 0 0 60px rgba(106,72,28,.25);
  padding: 26px 22px 34px;
  position: relative;
}
.sheet::before { content: ""; position: absolute; inset: 8px; border: 1px solid rgba(43,32,20,.25); border-radius: 2px; pointer-events: none; }
.sheet-title { font-family: 'Pirata One', Georgia, serif; font-size: clamp(26px, 5vw, 38px); text-align: center; margin: 0 0 4px; letter-spacing: 1px; }
.rule { height: 3px; background: repeating-linear-gradient(90deg, var(--ink) 0 14px, transparent 14px 20px); opacity: .75; margin: 10px 0 18px; border-radius: 2px; }

.field-label { font-family: 'Pirata One', Georgia, serif; font-size: 17px; letter-spacing: .5px; margin-bottom: 3px; display: flex; align-items: baseline; gap: 8px; }
.gla-input, .gla-textarea {
  width: 100%; background: transparent; border: none;
  border-bottom: 1px solid rgba(43,32,20,.5);
  font-family: 'IM Fell English', Georgia, serif;
  font-size: 16px; color: var(--ink); padding: 4px 2px;
}
.gla-textarea { resize: vertical; min-height: 56px; line-height: 1.5; background-image: repeating-linear-gradient(transparent 0 26px, rgba(43,32,20,.35) 26px 27px); }
.gla-input:focus, .gla-textarea:focus { outline: none; border-bottom-color: var(--red); }

.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
@media (max-width: 640px) { .grid-2 { grid-template-columns: 1fr; } }

.tally { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-height: 34px; }
.tally-group { display: inline-flex; position: relative; height: 24px; }
.tally-stroke { width: 3px; height: 24px; background: var(--ink); margin-right: 5px; border-radius: 1px; transform: rotate(2deg); }
.tally-cross { position: absolute; left: -3px; top: 10px; width: 36px; height: 3px; background: var(--ink); transform: rotate(-22deg); border-radius: 1px; }
.tally-btns button {
  font-family: 'Pirata One', Georgia, serif; font-size: 16px;
  width: 30px; height: 30px;
  border: 1.5px solid var(--ink); background: transparent; color: var(--ink);
  border-radius: 50%; cursor: pointer; margin-left: 6px;
}
.tally-btns button:hover { background: var(--ink); color: var(--parchment); }

.vital-row { display: flex; gap: 26px; flex-wrap: wrap; margin: 14px 0; }
.vital { display: flex; align-items: center; gap: 10px; }
.vital .icon { font-size: 26px; line-height: 1; }
.vital input {
  width: 64px; text-align: center;
  font-family: 'Pirata One', Georgia, serif; font-size: 22px;
  background: transparent; border: none; border-bottom: 2px solid var(--ink); color: var(--ink);
}
.vital input:focus { outline: none; border-bottom-color: var(--red); }

.att-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px 14px; margin-top: 8px; }
@media (max-width: 560px) { .att-grid { grid-template-columns: repeat(2, 1fr); } }
.att-cell { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.att-circle {
  width: 84px; height: 84px;
  border: 2.5px solid var(--ink);
  border-radius: 50% 48% 52% 50% / 50% 52% 48% 52%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  position: relative; background: rgba(255,255,255,.12);
}
.att-circle::after { content: ""; position: absolute; left: 12px; right: 12px; top: 50%; height: 2px; background: var(--ink); transform: rotate(-14deg); }
.att-circle input {
  width: 44px; text-align: center;
  font-family: 'Pirata One', Georgia, serif; font-size: 20px;
  background: transparent; border: none; color: var(--ink);
  position: relative; z-index: 1; margin-bottom: 12px;
}
.att-circle input:focus { outline: none; }
.att-mod { font-family: 'Pirata One', Georgia, serif; font-size: 17px; margin-top: -8px; color: var(--red); }
.att-name { font-family: 'Pirata One', Georgia, serif; font-size: 15px; letter-spacing: .5px; text-align: center; }
.att-roll {
  font-size: 12px; font-family: 'IM Fell English', Georgia, serif; font-style: italic;
  background: transparent; border: 1px solid rgba(43,32,20,.45); color: var(--ink-soft);
  border-radius: 3px; padding: 2px 10px; cursor: pointer;
}
.att-roll:hover { background: var(--ink); color: var(--parchment); border-color: var(--ink); }

.inv-row { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
.inv-row .gla-input { flex: 1; }
.inv-row .qty { width: 56px; text-align: center; }
.inv-del { border: none; background: transparent; color: var(--red); font-size: 18px; cursor: pointer; line-height: 1; padding: 4px; }
.section-hint { font-style: italic; font-size: 12px; color: var(--ink-soft); margin: 0 0 8px; }
.section-empty { font-style: italic; opacity: .55; margin: 4px 0 8px; }

.weapon-row {
  display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap;
}
.weapon-row .w-name { flex: 2; min-width: 140px; }
.weapon-row .w-att, .skill-row .sk-att {
  font-family: 'IM Fell English', Georgia, serif; font-size: 14px;
  background: transparent; color: var(--ink);
  border: 1px solid rgba(43,32,20,.5); border-radius: 3px; padding: 4px 6px;
}
.weapon-row .w-dmg { flex: 1; min-width: 90px; }
.w-btn {
  font-family: 'Pirata One', Georgia, serif; font-size: 13px; letter-spacing: .5px;
  border: 1.5px solid var(--ink); background: transparent; color: var(--ink);
  border-radius: 3px; padding: 5px 10px; cursor: pointer; white-space: nowrap;
}
.w-btn.hit:hover { background: var(--ink); color: var(--parchment); }
.w-btn.dmg { border-color: var(--red); color: var(--red); }
.w-btn.dmg:hover { background: var(--red); color: #f3e6c8; }

.skill-row {
  border: 1px solid rgba(43,32,20,.3); border-radius: 4px;
  padding: 8px 10px; margin-bottom: 8px; background: rgba(255,255,255,.08);
}
.skill-head { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; flex-wrap: wrap; }
.skill-head .sk-name { flex: 2; min-width: 140px; }
.sk-desc { min-height: 42px; }

.frucht-head { display: flex; gap: 12px; align-items: flex-end; margin-bottom: 10px; flex-wrap: wrap; }
.frucht-typ, .rang-extras select, .rang-field select {
  font-family: 'IM Fell English', Georgia, serif; font-size: 14px;
  background: transparent; color: var(--ink);
  border: 1px solid rgba(43,32,20,.5); border-radius: 3px; padding: 4px 6px;
}
.frucht-budget {
  font-family: 'Pirata One', Georgia, serif; font-size: 15px; letter-spacing: .5px;
  padding: 6px 12px; border-radius: 4px; margin-bottom: 12px;
  background: rgba(184,134,43,.18); border: 1px solid var(--gold); color: var(--ink);
}
.frucht-budget.over { background: rgba(139,46,31,.16); border-color: var(--red); color: var(--red); }

.rang { border: 1px solid rgba(43,32,20,.3); border-radius: 5px; margin-bottom: 9px; overflow: hidden; }
.rang.off { opacity: .7; background: repeating-linear-gradient(135deg, transparent 0 8px, rgba(43,32,20,.05) 8px 16px); }
.rang.on { background: rgba(184,134,43,.10); border-color: var(--gold); }
.rang-head { display: flex; gap: 8px; align-items: center; padding: 7px 9px; flex-wrap: wrap; }
.rang-no {
  font-family: 'Pirata One', Georgia, serif; font-size: 15px;
  width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  border: 1.5px solid var(--ink); flex-shrink: 0;
}
.rang.on .rang-no { background: var(--gold); border-color: var(--gold); color: var(--sea); }
.rang-name { flex: 2; min-width: 130px; }
.rang-cost { font-family: 'Pirata One', Georgia, serif; font-size: 12px; display: flex; align-items: center; gap: 4px; }
.rang-cost input {
  width: 46px; text-align: center;
  font-family: 'Pirata One', Georgia, serif; font-size: 14px;
  background: transparent; border: 1px solid rgba(43,32,20,.5); border-radius: 3px; color: var(--ink);
}
.rang-lock {
  font-family: 'Pirata One', Georgia, serif; font-size: 13px; letter-spacing: .5px;
  border-radius: 3px; padding: 5px 12px; cursor: pointer; white-space: nowrap;
  border: 1.5px solid var(--ink); background: transparent; color: var(--ink);
}
.rang-lock.on { background: var(--gold); border-color: var(--gold); color: var(--sea); }
.rang-lock:disabled { opacity: .4; cursor: default; }
.rang-body { padding: 0 9px 9px; }
.rang-extras { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; margin-top: 6px; }
.rang-field { font-family: 'Pirata One', Georgia, serif; font-size: 12px; letter-spacing: .5px; display: flex; flex-direction: column; gap: 3px; }
.rang-field.grow { flex: 1; min-width: 140px; }

/* ============ Steckbriefe & Crew ============ */
.crew-panel { max-width: 1000px; margin: 0 auto; }
.crew-sheet {
  display: flex; gap: 18px; flex-wrap: wrap;
  background: var(--parchment); border-radius: 6px; padding: 16px;
  box-shadow: 0 4px 14px rgba(0,0,0,.4); margin-bottom: 16px;
}
.crew-flag { display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 160px; }
.jolly-img, .jolly-empty {
  width: 150px; height: 150px; border-radius: 8px; object-fit: cover;
  border: 3px solid var(--ink); background: #14222e;
}
.jolly-empty { display: flex; align-items: center; justify-content: center; font-size: 64px; color: var(--parchment); }
.crew-upload { display: inline-flex; align-items: center; cursor: pointer; }
.crew-info { flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 10px; }
.crew-field { display: flex; flex-direction: column; gap: 3px; }
.crew-name { font-family: 'Pirata One', Georgia, serif; font-size: 20px; }

.bounty-total {
  text-align: center; font-family: 'Pirata One', Georgia, serif; font-size: 20px;
  color: var(--parchment); margin-bottom: 16px; letter-spacing: 1px;
}
.bounty-sum { color: var(--gold); margin-left: 10px; font-size: 24px; }
.berry-sym { font-family: Georgia, serif; }

.wanted-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px;
}
.wanted {
  background: #e8d6a8;
  background-image:
    radial-gradient(ellipse at 15% 10%, rgba(255,255,255,.4), transparent 40%),
    radial-gradient(ellipse at 85% 88%, rgba(120,82,30,.28), transparent 55%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='40' height='40' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E");
  border: 2px solid #6a481c; border-radius: 3px;
  padding: 10px 10px 0; display: flex; flex-direction: column; align-items: center;
  box-shadow: 0 6px 18px rgba(0,0,0,.5);
  position: relative;
}
.wanted-head {
  font-family: 'Pirata One', Georgia, serif; font-size: 34px; letter-spacing: 3px;
  color: #3a2a16; line-height: 1; margin-top: 2px;
}
.wanted-sub {
  font-family: 'IM Fell English', serif; font-weight: 700; font-size: 11px;
  letter-spacing: 2px; color: #4a3720; margin: 2px 0 8px;
}
.wanted-photo {
  position: relative; width: 100%; aspect-ratio: 1; margin-bottom: 8px;
  border: 3px solid #3a2a16; background: #cbb583; overflow: hidden;
}
.wanted-photo img { width: 100%; height: 100%; object-fit: cover; filter: sepia(.35) contrast(1.05); }
.wanted-photo-empty {
  width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
  font-size: 72px; color: #9a835a;
}
.wanted-upload {
  position: absolute; bottom: 6px; right: 6px;
  width: 30px; height: 30px; border-radius: 50%;
  background: rgba(20,34,46,.82); color: #f3e6c8; cursor: pointer;
  display: flex; align-items: center; justify-content: center; font-size: 15px;
  border: 1px solid rgba(243,230,200,.4);
}
.wanted-name {
  font-family: 'Pirata One', Georgia, serif; font-size: 20px; text-align: center;
  background: transparent; border: none; color: #2b1e0e; width: 100%; letter-spacing: 1px;
}
.wanted-name:focus { outline: none; }
.wanted-epitheton {
  font-family: 'IM Fell English', serif; font-style: italic; font-size: 13px; text-align: center;
  background: transparent; border: none; color: #5a4324; width: 100%; margin-bottom: 4px;
}
.wanted-epitheton:focus { outline: none; }
.wanted-bounty {
  display: flex; align-items: center; justify-content: center; gap: 2px;
  border-top: 2px solid #3a2a16; padding-top: 6px; width: 100%;
  font-family: 'Pirata One', Georgia, serif; font-size: 22px; color: #2b1e0e;
}
.wanted-bounty .berry-sym { font-size: 20px; margin-right: 2px; }
.wanted-bounty-input { width: 130px; }
.wanted-bounty-input input, .wanted-bounty input {
  font-family: 'Pirata One', Georgia, serif !important; font-size: 20px !important;
  text-align: center; background: transparent; border: none; color: #2b1e0e; width: 130px;
}
.wanted-bounty-fmt {
  font-family: 'IM Fell English', serif; font-size: 12px; color: #5a4324; margin-top: 1px;
}
.wanted-marine {
  font-family: 'Pirata One', Georgia, serif; font-size: 12px; letter-spacing: 2px;
  color: #4a3720; background: rgba(58,42,22,.12);
  width: calc(100% + 20px); margin: 8px -10px 0; padding: 5px 0; text-align: center;
}

/* ============ Logbuch (Notizen & Quests) ============ */
.notes-panel { max-width: 1000px; margin: 0 auto; }
.notes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
@media (max-width: 760px) { .notes-grid { grid-template-columns: 1fr; } }
.notes-col {
  background: var(--parchment); border-radius: 6px; padding: 14px;
  box-shadow: 0 4px 14px rgba(0,0,0,.4);
}
.notes-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; flex-wrap: wrap; gap: 6px; }
.quest-count { font-style: italic; font-size: 12px; opacity: .65; }
.quest-add { display: flex; gap: 8px; margin-bottom: 12px; }
.quest-add .gla-input { flex: 1; }
.quest-list { display: flex; flex-direction: column; gap: 8px; }
.quest {
  display: flex; gap: 8px; align-items: flex-start;
  border: 1px solid rgba(43,32,20,.25); border-radius: 5px; padding: 8px 10px;
  background: rgba(255,255,255,.14);
}
.quest.done { opacity: .6; }
.quest-check {
  background: none; border: none; cursor: pointer; font-size: 22px; line-height: 1;
  color: var(--ink); padding: 0; margin-top: 2px;
}
.quest.done .quest-check { color: var(--gold); }
.quest-body { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.quest-title {
  font-family: 'Pirata One', Georgia, serif; font-size: 17px; letter-spacing: .3px;
  background: transparent; border: none; border-bottom: 1px solid transparent; color: var(--ink);
  padding: 1px 2px;
}
.quest-title:focus { outline: none; border-bottom-color: rgba(43,32,20,.4); }
.quest.done .quest-title { text-decoration: line-through; }
.quest-notiz {
  font-family: 'IM Fell English', Georgia, serif; font-size: 13px;
  background: transparent; border: 1px solid rgba(43,32,20,.2); border-radius: 4px;
  color: var(--ink); padding: 4px 6px; resize: vertical; min-height: 32px; width: 100%;
}
.quest-notiz:focus { outline: none; border-color: rgba(43,32,20,.5); }
.quest-del { background: none; border: none; color: var(--red); cursor: pointer; font-size: 16px; }
.notes-area {
  width: 100%; min-height: 420px; resize: vertical;
  font-family: 'IM Fell English', Georgia, serif; font-size: 15px; line-height: 1.5;
  background: rgba(255,255,255,.14); border: 1px solid rgba(43,32,20,.25);
  border-radius: 5px; color: var(--ink); padding: 10px 12px;
}
.notes-area:focus { outline: none; border-color: rgba(43,32,20,.5); }

/* ============ Detail-Editor (Schauplatz) ============ */
.det-panel { max-width: 1000px; margin: 0 auto; }
.det-tools { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.det-tbtn {
  font-family: 'Pirata One', Georgia, serif; font-size: 14px;
  padding: 6px 12px; border-radius: 4px; cursor: pointer;
  border: 1px solid rgba(231,211,168,.4); background: transparent; color: var(--parchment);
}
.det-tbtn.on { background: var(--gold); border-color: var(--gold); color: var(--sea); }
.det-bg-sel {
  font-family: 'IM Fell English', serif; font-size: 13px;
  background: transparent; color: var(--parchment);
  border: 1px solid rgba(231,211,168,.4); border-radius: 3px; padding: 4px 6px;
}
.det-bg-sel option { color: #2b2014; }
.det-stage {
  border: 6px solid #20120a; border-radius: 8px; overflow: hidden;
  box-shadow: 0 10px 36px rgba(0,0,0,.55); line-height: 0;
}
.det-svg { display: block; width: 100%; height: auto; aspect-ratio: 100 / 66; }
.det-label-text {
  font-family: 'Pirata One', Georgia, serif;
  font-size: 2.4px; fill: #2b2014;
  paint-order: stroke; stroke: #f3e6c8; stroke-width: 0.5px; stroke-linejoin: round;
}
.det-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 12px; }
.det-actions .gla-btn { border-color: var(--parchment); color: var(--parchment); }
.det-actions .gla-btn:hover { background: var(--parchment); color: var(--ink); }
.det-actions .gla-btn.primary { background: var(--red); border-color: var(--red); color: #f3e6c8; }
.det-actions .gla-btn.primary:hover { background: #6e2417; color: #fff; }

/* ============ Kartografie / Zeichentool ============ */
.draw-panel { max-width: 1000px; margin: 0 auto; }
.draw-tools { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.tool-group { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.tool-label { font-family: 'Pirata One', Georgia, serif; font-size: 14px; color: var(--parchment); min-width: 78px; }
.terr-btn {
  font-family: 'IM Fell English', serif; font-size: 13px;
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 10px; border-radius: 4px; cursor: pointer;
  border: 1px solid rgba(231,211,168,.4); background: transparent; color: var(--parchment);
}
.terr-btn .terr-swatch {
  width: 14px; height: 14px; border-radius: 3px;
  background: var(--terr); border: 1px solid rgba(0,0,0,.3);
}
.terr-btn.on { border-color: var(--gold); background: rgba(184,134,43,.2); }
.terr-btn.eraser { font-style: italic; }
.brush-btn, .bld-btn {
  font-family: 'Pirata One', serif; font-size: 15px;
  width: 34px; height: 34px; border-radius: 4px; cursor: pointer;
  border: 1px solid rgba(231,211,168,.4); background: transparent; color: var(--parchment);
}
.brush-btn.on { background: var(--gold); border-color: var(--gold); color: var(--sea); }
.bld-btn { font-size: 18px; }
.bld-btn.on { background: var(--gold); border-color: var(--gold); }

.draw-stage {
  position: relative; width: 100%;
  border: 6px solid #20120a; border-radius: 8px; overflow: hidden;
  box-shadow: 0 10px 36px rgba(0,0,0,.55);
  line-height: 0;
}
.draw-canvas {
  display: block; width: 100%; height: auto;
  image-rendering: pixelated;   /* scharfe Terrainkanten */
  touch-action: none; cursor: crosshair;
}
.bld-marker {
  position: absolute; transform: translate(-50%, -50%);
  font-size: 26px; line-height: 1; pointer-events: auto;
  filter: drop-shadow(0 2px 3px rgba(0,0,0,.6));
}
.bld-icon { pointer-events: none; }
.bld-del {
  position: absolute; top: -8px; right: -12px;
  width: 16px; height: 16px; border-radius: 50%; border: none;
  background: var(--red); color: #f3e6c8; font-size: 10px; cursor: pointer;
  display: none;
}
.bld-marker:hover .bld-del { display: block; }

.draw-actions {
  display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 12px;
}
.draw-mode-hint { font-style: italic; font-size: 13px; color: var(--parchment); opacity: .8; }
.draw-actions .gla-btn { border-color: var(--parchment); color: var(--parchment); }
.draw-actions .gla-btn:hover { background: var(--parchment); color: var(--ink); }
.draw-actions .gla-btn.primary { background: var(--red); border-color: var(--red); color: #f3e6c8; }
.draw-actions .gla-btn.primary:hover { background: #6e2417; color: #fff; }

/* ============ Karte ============ */
.map-panel { max-width: 1000px; margin: 0 auto; }
.map-toolbar {
  display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 12px;
}
.map-btn, .map-chip {
  font-family: 'Pirata One', Georgia, serif; font-size: 14px; letter-spacing: .5px;
  padding: 6px 12px; border-radius: 4px; cursor: pointer;
  border: 1px solid rgba(231,211,168,.5); background: transparent; color: var(--parchment);
}
.map-btn:hover { border-color: var(--gold); }
.map-btn.on { background: var(--gold); border-color: var(--gold); color: var(--sea); }
.map-btn.upload { display: inline-flex; align-items: center; }
.map-btn.save { border-color: var(--parchment); }
.map-btn.save:hover { background: var(--parchment); color: var(--ink); }
.map-sep { width: 1px; height: 22px; background: rgba(231,211,168,.3); margin: 0 2px; }
.map-chip { border-radius: 16px; font-size: 13px; }
.map-chip.crew { border-color: #4b95b8; color: #9fd0e6; }
.map-chip.gegner { border-color: var(--red); color: #e6a08f; }
.map-chip.insel { border-color: #3ea768; color: #9fe0b6; }
.map-chip.schiff { border-color: #b8942e; color: #e6cf8f; }
.map-chip.ziel { border-color: #b85fbf; color: #e6a8ea; }

.map-view {
  position: relative;
  width: 100%; aspect-ratio: 16 / 10;
  border-radius: 8px; overflow: hidden;
  border: 6px solid #20120a;
  box-shadow: 0 10px 36px rgba(0,0,0,.55), inset 0 0 80px rgba(0,0,0,.4);
  background-size: cover; background-position: center;
  touch-action: none; user-select: none;
}
.map-view.sea {
  background-color: #1d3a4d;
  background-image:
    radial-gradient(ellipse at 30% 20%, rgba(60,110,140,.5), transparent 55%),
    radial-gradient(ellipse at 75% 75%, rgba(20,45,62,.6), transparent 60%),
    repeating-linear-gradient(0deg, rgba(255,255,255,.03) 0 2px, transparent 2px 26px);
}
.map-view.grid::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background-image:
    linear-gradient(rgba(231,211,168,.18) 1px, transparent 1px),
    linear-gradient(90deg, rgba(231,211,168,.18) 1px, transparent 1px);
  background-size: 6.25% 10%;
}
.map-hint {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  text-align: center; color: rgba(231,211,168,.7); font-style: italic; font-size: 15px;
  padding: 20px; pointer-events: none;
}

.token {
  position: absolute; transform: translate(-50%, -50%);
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  cursor: grab; touch-action: none;
}
.token:active { cursor: grabbing; }
.token-dot {
  width: 26px; height: 26px; border-radius: 50%;
  background: var(--tok); border: 2.5px solid #f3e6c8;
  box-shadow: 0 3px 8px rgba(0,0,0,.6);
}
.token.insel .token-dot { border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; }
.token.schiff .token-dot { border-radius: 4px; transform: rotate(45deg); }
.token.ziel .token-dot { border-radius: 50%; box-shadow: 0 0 0 3px rgba(184,95,191,.4), 0 3px 8px rgba(0,0,0,.6); }
.token-label {
  font-family: 'Pirata One', Georgia, serif; font-size: 12px;
  color: #f3e6c8; background: rgba(20,34,46,.8);
  padding: 1px 6px; border-radius: 8px; white-space: nowrap;
  text-shadow: 0 1px 2px #000;
}
.token-x {
  position: absolute; top: -8px; right: -10px;
  width: 18px; height: 18px; border-radius: 50%;
  border: none; background: var(--red); color: #f3e6c8;
  font-size: 11px; line-height: 1; cursor: pointer;
  display: none; align-items: center; justify-content: center;
}
.token:hover .token-x { display: flex; }

.token-editor {
  margin-top: 14px; background: var(--parchment); border-radius: 6px; padding: 12px 14px;
  box-shadow: 0 4px 14px rgba(0,0,0,.4);
}
.token-editor-title { font-family: 'Pirata One', serif; font-weight: 400; margin: 0 0 8px; letter-spacing: 1px; }
.token-edit-row { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
.token-swatch { width: 18px; height: 18px; border-radius: 50%; border: 2px solid #f3e6c8; box-shadow: 0 1px 3px rgba(0,0,0,.4); flex-shrink: 0; }
.token-edit-row .gla-input { flex: 1; }
.token-kind { font-style: italic; opacity: .6; font-size: 12px; min-width: 54px; }

/* ============ Kampf-Tracker ============ */
.combat { max-width: 880px; margin: 0 auto; }
.combat-bar {
  display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap; gap: 10px; margin-bottom: 14px;
}
.combat-round {
  font-family: 'Pirata One', Georgia, serif; font-size: 26px;
  color: var(--parchment); letter-spacing: 1px;
}
.combat-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.combat-actions .gla-btn { border-color: var(--parchment); color: var(--parchment); }
.combat-actions .gla-btn:hover { background: var(--parchment); color: var(--ink); }
.gla-btn.primary { background: var(--red); border-color: var(--red); color: #f3e6c8; }
.gla-btn.primary:hover { background: #6e2417; color: #fff; }

.add-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 14px; }
.add-label { color: var(--parchment); font-style: italic; font-size: 14px; }
.add-chip {
  font-family: 'Pirata One', Georgia, serif; font-size: 14px;
  padding: 5px 12px; border-radius: 18px;
  border: 1px solid rgba(231,211,168,.5); background: transparent; color: var(--parchment);
  cursor: pointer;
}
.add-chip:hover { border-color: var(--gold); }
.add-chip.enemy { border-color: var(--red); color: #e6a08f; }

.fighter-list { display: flex; flex-direction: column; gap: 10px; }
.fighter {
  display: flex; gap: 12px; align-items: stretch;
  background: var(--parchment);
  border-radius: 6px; padding: 12px;
  box-shadow: 0 4px 14px rgba(0,0,0,.4);
  border-left: 6px solid var(--ink-soft);
  transition: box-shadow .15s, transform .1s;
}
.fighter.crew { border-left-color: #2f6d8a; }
.fighter.gegner { border-left-color: var(--red); }
.fighter.active-turn {
  box-shadow: 0 0 0 3px var(--gold), 0 6px 20px rgba(0,0,0,.5);
  transform: translateX(4px);
}
.fighter.tot { opacity: .55; filter: grayscale(.5); }

.fighter-ini {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px; min-width: 54px;
  border-right: 1px solid rgba(43,32,20,.25); padding-right: 10px;
}
.ini-val { font-family: 'Pirata One', Georgia, serif; font-size: 30px; color: var(--ink); line-height: 1; }
.ini-roll {
  background: transparent; border: 1px solid rgba(43,32,20,.4);
  border-radius: 4px; cursor: pointer; font-size: 15px; padding: 2px 8px;
}
.ini-roll:hover { background: var(--ink); }

.fighter-main { flex: 1; display: flex; flex-direction: column; gap: 7px; }
.fighter-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.fighter-name { font-family: 'Pirata One', Georgia, serif; font-size: 19px; }
.fighter-name-input {
  font-family: 'Pirata One', Georgia, serif; font-size: 18px;
  border-bottom: 1px solid rgba(43,32,20,.5); max-width: 220px;
}
.side-tag {
  font-family: 'IM Fell English', serif; font-style: italic; font-size: 11px;
  padding: 2px 8px; border-radius: 10px;
}
.side-tag.crew { background: rgba(47,109,138,.2); color: #235870; }
.side-tag.gegner { background: rgba(139,46,31,.18); color: var(--red); }
.dead-tag { font-family: 'Pirata One', serif; font-size: 13px; color: var(--red); }

.hp-row { display: flex; align-items: center; gap: 10px; }
.hp-bar {
  flex: 1; height: 16px; border-radius: 8px;
  background: rgba(43,32,20,.18); overflow: hidden;
  border: 1px solid rgba(43,32,20,.3);
}
.hp-fill { height: 100%; background: linear-gradient(90deg, #4caf6d, #6fd98c); transition: width .25s; }
.hp-fill.mid { background: linear-gradient(90deg, #cf9a2e, #e3b257); }
.hp-fill.low { background: linear-gradient(90deg, #b5311f, #e05a44); }
.hp-num { display: flex; align-items: center; gap: 2px; }
.hp-num input {
  width: 46px; text-align: center;
  font-family: 'Pirata One', Georgia, serif; font-size: 16px;
  background: transparent; border: none; border-bottom: 1.5px solid var(--ink); color: var(--ink);
}
.hp-num input:focus { outline: none; border-bottom-color: var(--red); }
.hp-sep { opacity: .6; }

.dmg-controls { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.dmg-controls > button {
  font-family: 'Pirata One', Georgia, serif; font-size: 14px;
  width: 38px; height: 30px;
  border: 1.5px solid var(--ink); background: transparent; color: var(--ink);
  border-radius: 4px; cursor: pointer;
}
.dmg-controls > button:hover { background: var(--ink); color: var(--parchment); }
.ini-mod-field, .ini-att-sel { font-family: 'Pirata One', serif; font-size: 12px; display: flex; align-items: center; gap: 4px; }
.ini-mod-field input {
  width: 44px; text-align: center;
  font-family: 'Pirata One', serif; font-size: 14px;
  background: transparent; border: 1px solid rgba(43,32,20,.5); border-radius: 3px; color: var(--ink);
}
.ini-att-sel {
  font-family: 'IM Fell English', serif; font-size: 13px;
  background: transparent; border: 1px solid rgba(43,32,20,.5); border-radius: 3px; padding: 3px 5px; color: var(--ink);
}
.atk-row {
  display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
  padding-top: 7px; margin-top: 3px; border-top: 1px dashed rgba(43,32,20,.25);
}
.atk-row.empty { font-style: italic; opacity: .55; font-size: 12px; border-top: none; }
.atk-weapon {
  display: inline-flex; align-items: center; gap: 4px;
  background: rgba(43,32,20,.06); border-radius: 14px; padding: 2px 4px 2px 10px;
}
.atk-wname { font-family: 'Pirata One', Georgia, serif; font-size: 13px; margin-right: 2px; }
.atk-btn {
  border: 1.5px solid var(--ink); background: transparent; color: var(--ink);
  border-radius: 4px; padding: 3px 8px; cursor: pointer; font-size: 13px;
  font-family: 'Pirata One', Georgia, serif; white-space: nowrap;
}
.atk-btn.hit:hover { background: var(--ink); color: var(--parchment); }
.atk-btn.dmg { border-color: var(--red); color: var(--red); }
.atk-btn.dmg:hover { background: var(--red); color: #f3e6c8; }
.atk-mini { display: inline-flex; align-items: center; font-family: 'Pirata One', serif; font-size: 13px; }
.atk-mini input {
  width: 38px; text-align: center;
  font-family: 'Pirata One', serif; font-size: 14px;
  background: transparent; border: 1px solid rgba(43,32,20,.5); border-radius: 3px; color: var(--ink);
}
.atk-dmg-input { width: 70px; }

.fighter-del {
  margin-left: auto; border: none; background: transparent; color: var(--red);
  font-size: 18px; cursor: pointer;
}

.table-sub { font-size: 15px; opacity: .7; font-style: italic; }
.dmg-total {
  font-family: 'Pirata One', Georgia, serif; font-size: clamp(28px, 7vw, 44px);
  color: #ef6a52; letter-spacing: 2px; margin: 6px 0 10px;
  text-shadow: 0 0 16px rgba(239,106,82,.5);
}

.berry-input { font-family: 'Pirata One', Georgia, serif; font-size: 20px; width: 130px; text-align: right; }

.gla-btn {
  font-family: 'Pirata One', Georgia, serif; font-size: 16px; letter-spacing: .5px;
  padding: 8px 18px;
  border: 1.5px solid var(--ink); background: transparent; color: var(--ink);
  border-radius: 3px; cursor: pointer; transition: all .12s;
}
.gla-btn:hover { background: var(--ink); color: var(--parchment); }

.char-switch { display: flex; gap: 8px; flex-wrap: wrap; max-width: 880px; margin: 0 auto 14px; padding: 0 4px; }
.char-chip {
  font-family: 'Pirata One', Georgia, serif; font-size: 15px;
  padding: 6px 14px; border-radius: 20px;
  border: 1px solid rgba(231,211,168,.4);
  background: transparent; color: var(--parchment); cursor: pointer;
}
.char-chip.active { background: var(--gold); border-color: var(--gold); color: var(--sea); }

.save-bar {
  max-width: 880px; margin: 14px auto 0;
  display: flex; gap: 10px; justify-content: flex-end; align-items: center;
  color: var(--parchment); font-style: italic; font-size: 13px; padding: 0 4px;
}
.save-bar .gla-btn { border-color: var(--parchment); color: var(--parchment); }
.save-bar .gla-btn:hover { background: var(--parchment); color: var(--ink); }

/* ============ Würfel-Tab (Steuerung) ============ */
.dice-panel {
  max-width: 880px; margin: 0 auto;
  background: linear-gradient(160deg, #4d2c16, #341c0d);
  border: 6px solid #20120a; border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0,0,0,.6), inset 0 0 80px rgba(0,0,0,.5);
  padding: 24px 18px 26px;
  color: var(--parchment);
}
.dice-controls { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; align-items: flex-end; }
.dc-group { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.dc-group label { font-family: 'Pirata One', Georgia, serif; font-size: 15px; letter-spacing: 1px; }
.dc-group select, .dc-group input {
  font-family: 'Pirata One', Georgia, serif; font-size: 18px;
  background: var(--parchment); color: var(--ink);
  border: 2px solid #20120a; border-radius: 4px;
  padding: 6px 10px; min-width: 86px; text-align: center;
}
.roll-btn {
  font-family: 'Pirata One', Georgia, serif; font-size: 22px; letter-spacing: 1.5px;
  padding: 10px 34px;
  background: var(--red); color: #f3e6c8;
  border: 2px solid #20120a; border-radius: 6px;
  cursor: pointer; box-shadow: 0 4px 0 #20120a;
  transition: transform .08s;
}
.roll-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 #20120a; }
.probe-hint { text-align: center; font-style: italic; font-size: 13px; opacity: .7; margin-top: 14px; }

.history { max-width: 880px; margin: 16px auto 0; color: var(--parchment); font-size: 14px; padding: 0 6px; }
.history h3 { font-family: 'Pirata One', Georgia, serif; font-weight: 400; letter-spacing: 1px; margin: 0 0 6px; }
.history li { opacity: .85; margin-bottom: 3px; list-style: none; }
.history ul { padding: 0; margin: 0; }

/* ============ Fullscreen-Würfeltisch ============ */
.table-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: radial-gradient(ellipse at 50% 38%, #1d6443 0%, #11402a 55%, #0a2719 100%);
  overflow: hidden;
  animation: tableIn .3s ease both;
}
@keyframes tableIn { from { opacity: 0; } to { opacity: 1; } }
.table-overlay::before {
  content: ""; position: absolute; inset: 0;
  border: 14px solid transparent;
  border-image: linear-gradient(160deg, #5a3318, #2c1809) 1;
  box-shadow: inset 0 0 120px rgba(0,0,0,.75);
  pointer-events: none; z-index: 3;
}
.table-overlay::after {
  content: ""; position: absolute; inset: 0;
  background: radial-gradient(ellipse at 50% 30%, rgba(255,244,200,.10), transparent 55%);
  pointer-events: none;
}
.table-close {
  position: absolute; top: 24px; right: 24px; z-index: 5;
  font-family: 'Pirata One', Georgia, serif;
  font-size: 17px; letter-spacing: 1px;
  background: rgba(0,0,0,.35); color: var(--parchment);
  border: 1px solid rgba(231,211,168,.5);
  border-radius: 4px; padding: 8px 18px; cursor: pointer;
}
.table-close:hover { background: rgba(0,0,0,.6); }
.table-label {
  position: absolute; top: 26px; left: 0; right: 0;
  text-align: center;
  font-family: 'Pirata One', Georgia, serif;
  font-size: clamp(20px, 4vw, 30px); letter-spacing: 2px;
  color: rgba(231,211,168,.85);
  text-shadow: 0 2px 6px rgba(0,0,0,.6);
  pointer-events: none; z-index: 4;
}

.dice-area {
  position: absolute; inset: 0;
  touch-action: none;
  cursor: grab;
  z-index: 2;
  /* eine gemeinsame Kamera über der Tischmitte */
  perspective: 1500px;
  perspective-origin: 50% 42%;
  transform-style: preserve-3d;
}
.dice-area.grabbing { cursor: grabbing; }

.phys-die {
  position: absolute; left: 0; top: 0;
  transform-style: preserve-3d;
  will-change: transform;
}
.phys-die > .die-cube { width: 72px; height: 72px; }
.table-hint {
  font-family: 'IM Fell English', Georgia, serif;
  font-size: 13px; font-style: italic; letter-spacing: 0;
  opacity: .55; margin-top: 2px;
}

.phys-shadow {
  position: absolute; left: 0; top: 0;
  width: 72px; height: 72px;
  transform-style: preserve-3d;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(0,0,0,.5), transparent 68%);
  will-change: transform, opacity;
  z-index: 1;
}
.die-cube {
  width: 100%; height: 100%; position: relative;
  transform-style: preserve-3d;
  will-change: transform;
}
.die-face {
  position: absolute; inset: 0;
  background: #f5ecd7;
  border: 2px solid #b9a87f;
  border-radius: 10px;
  display: grid; grid-template: repeat(3,1fr) / repeat(3,1fr);
  padding: 9px;
  box-shadow: inset 0 0 9px rgba(0,0,0,.18);
  backface-visibility: hidden;
}
.pip { width: 11px; height: 11px; border-radius: 50%; background: var(--ink); align-self: center; justify-self: center; }

.die-canvas {
  display: block;
  image-rendering: auto;
  filter: drop-shadow(0 3px 5px rgba(0,0,0,.45));
}

.result-panel {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 4;
  padding: 22px 16px calc(26px + env(safe-area-inset-bottom));
  text-align: center;
  background: linear-gradient(transparent, rgba(0,0,0,.55) 40%);
  animation: panelUp .4s ease both;
}
@keyframes panelUp { from { transform: translateY(30px); opacity: 0; } to { transform: none; opacity: 1; } }
.sum-line {
  font-family: 'Pirata One', Georgia, serif;
  font-size: clamp(20px, 4.5vw, 28px); letter-spacing: 1px;
  color: var(--parchment);
  text-shadow: 0 2px 4px rgba(0,0,0,.7);
}
.sum-line .mod { color: var(--gold); }
.stamp {
  display: inline-block; margin: 10px 0 14px;
  font-family: 'Pirata One', Georgia, serif;
  font-size: clamp(26px, 6vw, 40px); letter-spacing: 4px;
  padding: 6px 26px;
  border: 4px double currentColor; border-radius: 4px;
  transform: rotate(-3deg);
  animation: stampIn .35s cubic-bezier(.2,2.2,.4,1) both;
  text-shadow: 0 0 14px currentColor;
}
@keyframes stampIn { from { transform: rotate(-3deg) scale(2.4); opacity: 0; } to { transform: rotate(-3deg) scale(1); opacity: 1; } }
.stamp.ok { color: #5fd98c; }
.stamp.mid { color: #e3b257; }
.stamp.fail { color: #ef6a52; }
.panel-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.panel-btns .roll-btn { font-size: 19px; padding: 9px 26px; }
.panel-btns .ghost {
  font-family: 'Pirata One', Georgia, serif; font-size: 17px; letter-spacing: 1px;
  padding: 9px 22px;
  background: transparent; color: var(--parchment);
  border: 1.5px solid rgba(231,211,168,.6); border-radius: 6px; cursor: pointer;
}
.panel-btns .ghost:hover { background: rgba(231,211,168,.15); }

@media (prefers-reduced-motion: reduce) {
  .stamp, .result-panel, .table-overlay { animation: none !important; }
}

.toast {
  position: fixed; bottom: 18px; left: 50%;
  transform: translateX(-50%);
  background: var(--parchment); color: var(--ink);
  font-family: 'IM Fell English', Georgia, serif;
  padding: 10px 22px; border-radius: 4px;
  box-shadow: 0 6px 20px rgba(0,0,0,.5);
  font-size: 15px; z-index: 200;
}
`;

/* ---------- Würfel-Optik ---------- */
const PIP_LAYOUT = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};
function Face({ value, transform }) {
  return (
    <div className="die-face" style={{ transform }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className="pip" style={{ visibility: PIP_LAYOUT[value].includes(i) ? "visible" : "hidden" }} />
      ))}
    </div>
  );
}
// Flächen passend zu den Normalen in topFace():
// 1:+Z 6:−Z 2:+X 5:−X 4:+Y 3:−Y
// Die sechs Flächen des CSS-Würfels und ihre Richtung im Körpersystem.
// Die Augenzahl wird aus derselben Geometrie geholt, aus der die Physik
// später abliest — sonst zeigt der Würfel etwas anderes an, als gewertet wird.
const CUBE_DIRS = [
  { d: [0, 0, 1],  t: "translateZ(36px)" },
  { d: [0, 0, -1], t: "rotateY(180deg) translateZ(36px)" },
  { d: [1, 0, 0],  t: "rotateY(90deg) translateZ(36px)" },
  { d: [-1, 0, 0], t: "rotateY(-90deg) translateZ(36px)" },
  { d: [0, 1, 0],  t: "rotateX(-90deg) translateZ(36px)" },
  { d: [0, -1, 0], t: "rotateX(90deg) translateZ(36px)" },
];
function CubeFaces() {
  const sh = shapeFor(6);
  return (
    <>
      {CUBE_DIRS.map((cd, k) => {
        let bi = 0, best = -Infinity;
        for (let i = 0; i < sh.F.length; i++) {
          const s = dot3(sh.F[i].n, cd.d);
          if (s > best) { best = s; bi = i; }
        }
        return <Face key={k} value={sh.values[bi]} transform={cd.t} />;
      })}
    </>
  );
}

/* ============================================================
   PhysicsTable — echte Starrkörpersimulation.
   Jeder Würfel ist ein konvexes Polyeder mit Masse, Trägheits-
   tensor und Drehimpuls. Kontakte an Ecken erzeugen Normal- und
   Reibungsimpulse am Berührpunkt; der Hebelarm zum Schwerpunkt
   liefert den Drehimpuls, der einen schief gelandeten Würfel von
   selbst auf eine Fläche kippt. Die Augenzahl entsteht aus der
   Fläche, die am Ende zur Kamera zeigt — nichts wird vorgegeben.
   ============================================================ */
function PhysicsTable({ count, sides, onSettled }) {
  const areaRef = useRef(null);
  const bodiesRef = useRef([]);
  const elsRef = useRef([]);
  const shadowsRef = useRef([]);
  const settledOnceRef = useRef(false);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const W = Math.max(240, area.clientWidth || window.innerWidth);
    const H = Math.max(320, area.clientHeight || window.innerHeight);
    const bounds = { xmin: 34, xmax: W - 34, ymin: 96, ymax: H - 34 };
    const SUB = 6, ITER = 5;
    const isCube = sides === 6;
    const shape = shapeFor(sides);
    const FOCAL = 1500, OX = W * 0.5, OY = H * 0.42;   // Kamera über der Tischmitte
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---------- Körper erzeugen und werfen ---------- */
    const bodies = Array.from({ length: count }, (_, i) => {
      const fromLeft = Math.random() < 0.5;
      const q = randQ();
      return {
        sides, sh: shape,
        p: [W * 0.5 + (Math.random() - 0.5) * W * 0.3 + (fromLeft ? -W * 0.16 : W * 0.16),
            H + 80 + Math.random() * 70,
            150 + Math.random() * 140],
        v: [(fromLeft ? 1 : -1) * (Math.random() * 300 - 60),
            -(700 + Math.random() * 420),
            120 + Math.random() * 140],
        q, m: qToM(q),
        w: [(Math.random() - 0.5) * 26, (Math.random() - 0.5) * 26, (Math.random() - 0.5) * 18],
        live: false, asleep: false, drag: false,
        sleepT: 0, qRef: q.slice(), bumps: 0,
        delay: i * 0.09 + Math.random() * 0.05,
        value: 1, el: null, shadowEl: null, ctx: null,
      };
    });
    bodiesRef.current = bodies;

    const CAN = Math.ceil(shape.R * 2 + 26);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    bodies.forEach((b, i) => {
      b.el = elsRef.current[i] || null;
      b.shadowEl = shadowsRef.current[i] || null;
      if (!isCube && b.el) {
        const cv = b.el.firstChild;
        if (cv && cv.getContext) {
          cv.width = CAN * dpr; cv.height = CAN * dpr;
          cv.style.width = CAN + "px"; cv.style.height = CAN + "px";
          b.ctx = cv.getContext("2d");
          b.ctx.scale(dpr, dpr);
        }
      }
    });

    const invM = b => (b.asleep || b.drag) ? 0 : 1;

    /* ---------- Kontakt gegen eine unbewegliche Ebene ---------- */
    function planeContact(b, r, n, Iw) {
      const vc = [b.v[0] + b.w[1]*r[2] - b.w[2]*r[1],
                  b.v[1] + b.w[2]*r[0] - b.w[0]*r[2],
                  b.v[2] + b.w[0]*r[1] - b.w[1]*r[0]];
      const vn = dot3(vc, n);
      if (vn > 0) return;
      const rn = cross(r, n);
      const denom = 1 + dot3(n, cross(applyI(Iw, rn), r));
      const e = Math.abs(vn) < RESTV ? 0 : RESTITUTION;
      const j = -(1 + e) * vn / denom;
      b.v[0] += j*n[0]; b.v[1] += j*n[1]; b.v[2] += j*n[2];
      let tq = applyI(Iw, cross(r, [j*n[0], j*n[1], j*n[2]]));
      b.w[0] += tq[0]; b.w[1] += tq[1]; b.w[2] += tq[2];

      const vc2 = [b.v[0] + b.w[1]*r[2] - b.w[2]*r[1],
                   b.v[1] + b.w[2]*r[0] - b.w[0]*r[2],
                   b.v[2] + b.w[0]*r[1] - b.w[1]*r[0]];
      const vn2 = dot3(vc2, n);
      const vt = [vc2[0]-vn2*n[0], vc2[1]-vn2*n[1], vc2[2]-vn2*n[2]];
      const vtl = Math.hypot(vt[0], vt[1], vt[2]);
      if (vtl < 1e-4) return;
      const t = [vt[0]/vtl, vt[1]/vtl, vt[2]/vtl];
      const rt = cross(r, t);
      const dT = 1 + dot3(t, cross(applyI(Iw, rt), r));
      let jt = -vtl / dT;
      const lim = FRICTION * Math.abs(j);
      if (jt < -lim) jt = -lim;
      if (jt > lim) jt = lim;
      b.v[0] += jt*t[0]; b.v[1] += jt*t[1]; b.v[2] += jt*t[2];
      tq = applyI(Iw, cross(r, [jt*t[0], jt*t[1], jt*t[2]]));
      b.w[0] += tq[0]; b.w[1] += tq[1]; b.w[2] += tq[2];
    }

    /* ---------- Kontakt zwischen zwei Würfeln ---------- */
    const ZERO3 = [[0,0,0],[0,0,0],[0,0,0]];
    function bodyContact(Ab, Bb, rA, rB, n, pen, IA, IB) {
      const mA = invM(Ab), mB = invM(Bb);
      if (mA + mB === 0) return;
      const iA = mA ? IA : ZERO3, iB = mB ? IB : ZERO3;
      const vA = [Ab.v[0] + Ab.w[1]*rA[2] - Ab.w[2]*rA[1],
                  Ab.v[1] + Ab.w[2]*rA[0] - Ab.w[0]*rA[2],
                  Ab.v[2] + Ab.w[0]*rA[1] - Ab.w[1]*rA[0]];
      const vB = [Bb.v[0] + Bb.w[1]*rB[2] - Bb.w[2]*rB[1],
                  Bb.v[1] + Bb.w[2]*rB[0] - Bb.w[0]*rB[2],
                  Bb.v[2] + Bb.w[0]*rB[1] - Bb.w[1]*rB[0]];
      const vr = [vB[0]-vA[0], vB[1]-vA[1], vB[2]-vA[2]];
      const vn = dot3(vr, n);
      if (vn < 0) {
        const rnA = cross(rA, n), rnB = cross(rB, n);
        const denom = mA + mB
          + dot3(n, cross(applyI(iA, rnA), rA))
          + dot3(n, cross(applyI(iB, rnB), rB));
        const e = Math.abs(vn) < RESTV ? 0 : RESTITUTION;
        const j = -(1 + e) * vn / denom;
        pushImpulse(Ab, rA, [-j*n[0], -j*n[1], -j*n[2]], mA, iA);
        pushImpulse(Bb, rB, [ j*n[0],  j*n[1],  j*n[2]], mB, iB);
        const vt = [vr[0]-vn*n[0], vr[1]-vn*n[1], vr[2]-vn*n[2]];
        const vtl = Math.hypot(vt[0], vt[1], vt[2]);
        if (vtl > 1e-4) {
          const t = [vt[0]/vtl, vt[1]/vtl, vt[2]/vtl];
          const rtA = cross(rA, t), rtB = cross(rB, t);
          const dT = mA + mB
            + dot3(t, cross(applyI(iA, rtA), rA))
            + dot3(t, cross(applyI(iB, rtB), rB));
          let jt = -vtl / dT;
          const lim = FRICTION * Math.abs(j);
          if (jt < -lim) jt = -lim;
          if (jt > lim) jt = lim;
          pushImpulse(Ab, rA, [-jt*t[0], -jt*t[1], -jt*t[2]], mA, iA);
          pushImpulse(Bb, rB, [ jt*t[0],  jt*t[1],  jt*t[2]], mB, iB);
        }
      }
      if (pen > SLOP) {
        const corr = (pen - SLOP) * BAUM, tot = mA + mB;
        if (mA) { Ab.p[0] -= n[0]*corr*mA/tot; Ab.p[1] -= n[1]*corr*mA/tot; Ab.p[2] -= n[2]*corr*mA/tot; }
        if (mB) { Bb.p[0] += n[0]*corr*mB/tot; Bb.p[1] += n[1]*corr*mB/tot; Bb.p[2] += n[2]*corr*mB/tot; }
      }
    }
    function pushImpulse(b, r, J, minv, Iw) {
      if (!minv) return;
      b.v[0] += J[0]; b.v[1] += J[1]; b.v[2] += J[2];
      const tq = applyI(Iw, cross(r, J));
      b.w[0] += tq[0]; b.w[1] += tq[1]; b.w[2] += tq[2];
    }
    // Ecken von S, die im Körper T stecken
    function cornerContacts(S, T, IS, IT) {
      for (const c of S.sh.V) {
        const rS = mRot(S.m, c);
        const wp = [S.p[0]+rS[0], S.p[1]+rS[1], S.p[2]+rS[2]];
        const rel = [wp[0]-T.p[0], wp[1]-T.p[1], wp[2]-T.p[2]];
        const loc = mRotT(T.m, rel);
        let inside = true, best = Infinity, bi = -1;
        for (let f = 0; f < T.sh.F.length; f++) {
          const s = T.sh.F[f].d - dot3(T.sh.F[f].n, loc);
          if (s <= 0) { inside = false; break; }
          if (s < best) { best = s; bi = f; }
        }
        if (!inside || bi < 0) continue;
        bodyContact(T, S, rel, rS, mRot(T.m, T.sh.F[bi].n), best, IT, IS);
      }
    }

    /* ---------- ein Zeitschritt ---------- */
    function physics(dt) {
      for (const b of bodies) {
        if (!b.live || b.asleep || b.drag) continue;
        b.v[2] -= GRAV * dt;
        b.p[0] += b.v[0]*dt; b.p[1] += b.v[1]*dt; b.p[2] += b.v[2]*dt;
        const dq = qMul([0, b.w[0], b.w[1], b.w[2]], b.q);
        b.q = qNorm([b.q[0]+0.5*dt*dq[0], b.q[1]+0.5*dt*dq[1], b.q[2]+0.5*dt*dq[2], b.q[3]+0.5*dt*dq[3]]);
        b.m = qToM(b.q);
      }
      for (let it = 0; it < ITER; it++) {
        for (const b of bodies) {
          if (!b.live || b.asleep || b.drag) continue;
          const Iw = iinvWorld(b.m, b.sh.Iinv);
          let pz = 0, pxm = 0, pxp = 0, pym = 0, pyp = 0;
          for (const c of b.sh.V) {
            const r = mRot(b.m, c);
            const x = b.p[0]+r[0], y = b.p[1]+r[1], z = b.p[2]+r[2];
            if (z < 0)           { planeContact(b, r, [0,0,1], Iw);  if (-z > pz) pz = -z; }
            if (x < bounds.xmin) { planeContact(b, r, [1,0,0], Iw);  if (bounds.xmin-x > pxm) pxm = bounds.xmin-x; }
            if (x > bounds.xmax) { planeContact(b, r, [-1,0,0], Iw); if (x-bounds.xmax > pxp) pxp = x-bounds.xmax; }
            if (y < bounds.ymin) { planeContact(b, r, [0,1,0], Iw);  if (bounds.ymin-y > pym) pym = bounds.ymin-y; }
            if (y > bounds.ymax) { planeContact(b, r, [0,-1,0], Iw); if (y-bounds.ymax > pyp) pyp = y-bounds.ymax; }
          }
          if (pz  > SLOP) b.p[2] += (pz  - SLOP) * BAUM;
          if (pxm > SLOP) b.p[0] += (pxm - SLOP) * BAUM;
          if (pxp > SLOP) b.p[0] -= (pxp - SLOP) * BAUM;
          if (pym > SLOP) b.p[1] += (pym - SLOP) * BAUM;
          if (pyp > SLOP) b.p[1] -= (pyp - SLOP) * BAUM;
        }
        for (let a = 0; a < bodies.length; a++) {
          for (let bb = a + 1; bb < bodies.length; bb++) {
            const A = bodies[a], B = bodies[bb];
            if (!A.live || !B.live) continue;
            if (A.asleep && B.asleep) continue;
            const dx = B.p[0]-A.p[0], dy = B.p[1]-A.p[1], dz = B.p[2]-A.p[2];
            const rr = A.sh.R + B.sh.R;
            if (dx*dx + dy*dy + dz*dz > rr*rr) continue;
            const IA = iinvWorld(A.m, A.sh.Iinv), IB = iinvWorld(B.m, B.sh.Iinv);
            cornerContacts(A, B, IA, IB);
            cornerContacts(B, A, IB, IA);
          }
        }
      }
    }

    /* ---------- Trennungs-Audit ----------
       Die Eckenprüfung oben kann Kante-an-Kante-Durchdringung übersehen,
       und zwei schlafende Würfel würden sich nie wieder trennen. Deshalb
       einmal pro Bild ein exakter Test (Separating Axis Theorem):
       Stufe 1 nur mit Flächennormalen (billig) schließt die meisten Paare
       sofort aus, Stufe 2 mit Kantenachsen liefert bei Verdacht die genaue
       Eindringtiefe und Trennrichtung.                                   */
    let cachedEdges = null;
    function edgesOf(sh) {
      if (cachedEdges) return cachedEdges;
      const m = new Map();
      for (const f of sh.F) {
        for (let i = 0; i < f.idx.length; i++) {
          const a = f.idx[i], b = f.idx[(i + 1) % f.idx.length];
          const k = Math.min(a, b) + "-" + Math.max(a, b);
          if (!m.has(k)) m.set(k, [a, b]);
        }
      }
      cachedEdges = [...m.values()];
      return cachedEdges;
    }
    function worldVerts(b) {
      return b.sh.V.map(c => {
        const r = mRot(b.m, c);
        return [b.p[0] + r[0], b.p[1] + r[1], b.p[2] + r[2]];
      });
    }
    function spanOn(V, ax) {
      let lo = Infinity, hi = -Infinity;
      for (const q of V) {
        const d = q[0]*ax[0] + q[1]*ax[1] + q[2]*ax[2];
        if (d < lo) lo = d;
        if (d > hi) hi = d;
      }
      return [lo, hi];
    }
    function satMTV(A, B, withEdges) {
      const VA = worldVerts(A), VB = worldVerts(B);
      const axes = [];
      for (const f of A.sh.F) axes.push(mRot(A.m, f.n));
      for (const f of B.sh.F) axes.push(mRot(B.m, f.n));
      if (withEdges) {
        const EA = edgesOf(A.sh), EB = edgesOf(B.sh);
        for (const [a1, a2] of EA) {
          const d1 = [VA[a2][0]-VA[a1][0], VA[a2][1]-VA[a1][1], VA[a2][2]-VA[a1][2]];
          for (const [b1, b2] of EB) {
            const d2 = [VB[b2][0]-VB[b1][0], VB[b2][1]-VB[b1][1], VB[b2][2]-VB[b1][2]];
            const x = cross(d1, d2), l = Math.hypot(x[0], x[1], x[2]);
            if (l > 1e-6) axes.push([x[0]/l, x[1]/l, x[2]/l]);
          }
        }
      }
      let best = Infinity, bax = null;
      for (const ax of axes) {
        const [aL, aH] = spanOn(VA, ax), [bL, bH] = spanOn(VB, ax);
        const ov = Math.min(aH, bH) - Math.max(aL, bL);
        if (ov <= 0) return null;                 // trennende Achse gefunden
        if (ov < best) { best = ov; bax = ax; }
      }
      const d = [B.p[0]-A.p[0], B.p[1]-A.p[1], B.p[2]-A.p[2]];
      if (bax[0]*d[0] + bax[1]*d[1] + bax[2]*d[2] < 0) bax = [-bax[0], -bax[1], -bax[2]];
      return { pen: best, n: bax };
    }
    function separateOverlaps(allowWake) {
      for (let a = 0; a < bodies.length; a++) {
        for (let b = a + 1; b < bodies.length; b++) {
          const A = bodies[a], B = bodies[b];
          if (!A.live || !B.live) continue;
          const dx = B.p[0]-A.p[0], dy = B.p[1]-A.p[1], dz = B.p[2]-A.p[2];
          const rr = A.sh.R + B.sh.R;
          if (dx*dx + dy*dy + dz*dz > rr*rr) continue;
          if (!satMTV(A, B, false)) continue;      // Stufe 1
          const r = satMTV(A, B, true);            // Stufe 2
          if (!r || r.pen < 0.3) continue;
          if (allowWake) {
            if (!A.drag) { A.asleep = false; A.sleepT = 0; A.qRef = A.q.slice(); }
            if (!B.drag) { B.asleep = false; B.sleepT = 0; B.qRef = B.q.slice(); }
          }
          // Der festgehaltene Würfel bleibt am Finger, der andere weicht aus
          let wa = 0.55, wb = 0.55;
          if (A.drag && !B.drag) { wa = 0; wb = 1.05; }
          else if (B.drag && !A.drag) { wa = 1.05; wb = 0; }
          A.p[0] -= r.n[0]*r.pen*wa; A.p[1] -= r.n[1]*r.pen*wa; A.p[2] -= r.n[2]*r.pen*wa;
          B.p[0] += r.n[0]*r.pen*wb; B.p[1] += r.n[1]*r.pen*wb; B.p[2] += r.n[2]*r.pen*wb;
          for (const d2 of [A, B]) {
            let low = Infinity;
            for (const c of d2.sh.V) { const rr2 = mRot(d2.m, c); if (rr2[2] < low) low = rr2[2]; }
            if (d2.p[2] + low < 0) d2.p[2] = -low;
            d2.p[0] = Math.min(bounds.xmax, Math.max(bounds.xmin, d2.p[0]));
            d2.p[1] = Math.min(bounds.ymax, Math.max(bounds.ymin, d2.p[1]));
          }
        }
      }
    }

    /* ---------- Darstellung ---------- */
    // Perspektivische Projektion, gleiche Kamera wie beim CSS-Würfel
    function project(p) {
      const s = FOCAL / Math.max(120, FOCAL - p[2]);
      return [OX + (p[0]-OX)*s, OY + (p[1]-OY)*s, s];
    }
    const LIGHT = norm3([-0.35, -0.5, 0.79]);

    function drawPoly(b) {
      const ctx = b.ctx;
      if (!ctx) return;
      ctx.clearRect(0, 0, CAN, CAN);
      const centre = project(b.p);
      const wv = b.sh.V.map(c => {
        const r = mRot(b.m, c);
        return project([b.p[0]+r[0], b.p[1]+r[1], b.p[2]+r[2]]);
      });
      const cam = [OX, OY, FOCAL];
      const vis = [];
      for (let i = 0; i < b.sh.F.length; i++) {
        const f = b.sh.F[i];
        const n = mRot(b.m, f.n);
        const cw = mRot(b.m, f.c);
        const cwp = [b.p[0]+cw[0], b.p[1]+cw[1], b.p[2]+cw[2]];
        const view = [cam[0]-cwp[0], cam[1]-cwp[1], cam[2]-cwp[2]];
        if (dot3(n, view) <= 0) continue;
        vis.push({ i, f, n, cwp, depth: Math.hypot(view[0], view[1], view[2]) });
      }
      vis.sort((a, c) => c.depth - a.depth);          // hinten zuerst
      const ox = CAN/2 - centre[0], oy = CAN/2 - centre[1];
      for (const { i, f, n, cwp } of vis) {
        ctx.beginPath();
        f.idx.forEach((vi, k) => {
          const p = wv[vi];
          if (k === 0) ctx.moveTo(p[0]+ox, p[1]+oy); else ctx.lineTo(p[0]+ox, p[1]+oy);
        });
        ctx.closePath();
        const lum = 0.62 + 0.38 * Math.max(0, dot3(n, LIGHT));
        const R = Math.round(245*lum), G2 = Math.round(236*lum), B2 = Math.round(215*lum);
        ctx.fillStyle = `rgb(${R},${G2},${B2})`;
        ctx.fill();
        ctx.strokeStyle = "rgba(120,100,64,0.75)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        // Zahl in der Flächenebene
        const cp = project(cwp);
        const uw = mRot(b.m, f.u), vw = mRot(b.m, f.v);
        const k = b.sh.R * 0.28;
        const pu = project([cwp[0]+uw[0]*k, cwp[1]+uw[1]*k, cwp[2]+uw[2]*k]);
        const pv = project([cwp[0]+vw[0]*k, cwp[1]+vw[1]*k, cwp[2]+vw[2]*k]);
        const ax = (pu[0]-cp[0])/k, ay = (pu[1]-cp[1])/k;
        const bx = (pv[0]-cp[0])/k, by = (pv[1]-cp[1])/k;
        if (Math.abs(ax*by - ay*bx) < 0.06) continue;   // zu schräg zum Lesen
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.transform(ax, ay, bx, by, cp[0]+ox, cp[1]+oy);
        ctx.fillStyle = "#2b2014";
        const fs = b.sh.R * 0.42;
        ctx.font = `${fs}px "Pirata One", Georgia, serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const label = faceLabel(b.sh, i);
        ctx.fillText(label, 0, 0);
        if (label === "6" || label === "9") {          // Lesehilfe wie auf echten Würfeln
          ctx.fillRect(-fs*0.3, fs*0.42, fs*0.6, Math.max(1, fs*0.07));
        }
        ctx.restore();
      }
      b.el.style.transform = `translate3d(${centre[0]-CAN/2}px, ${centre[1]-CAN/2}px, 0)`;
    }

    function paint(b) {
      if (!b.el) return;
      if (isCube) {
        b.el.style.transform = `translate3d(${b.p[0]-DIE_A/2}px, ${b.p[1]-DIE_A/2}px, ${b.p[2]}px)`;
        const cube = b.el.firstChild;
        if (cube) cube.style.transform = mToCss(b.m);
      } else {
        drawPoly(b);
      }
      if (b.shadowEl) {
        let low = Infinity;
        for (const c of b.sh.V) { const r = mRot(b.m, c); if (r[2] < low) low = r[2]; }
        const lift = Math.max(0, b.p[2] + low);
        const sc = (b.sh.R * 1.55) / DIE_A * (1 + lift * 0.0022);
        b.shadowEl.style.transform =
          `translate3d(${b.p[0]-DIE_A/2}px, ${b.p[1]-DIE_A/2}px, 0px) scale(${sc})`;
        b.shadowEl.style.opacity = Math.max(0.10, 0.5 - lift * 0.0016);
      }
    }

    if (reduced) {
      bodies.forEach((b, i) => {
        b.p = [W * 0.25 + (count > 1 ? (W * 0.5 / (count - 1)) * i : W * 0.25), H * 0.45, b.sh.R];
        b.q = [1, 0, 0, 0]; b.m = qToM(b.q);
        b.v = [0, 0, 0]; b.w = [0, 0, 0];
        b.live = true; b.asleep = true;
        b.value = readFace(b);
        paint(b);
      });
      settledOnceRef.current = true;
      const tid = setTimeout(() => onSettledRef.current(bodies.map(b => b.value)), 60);
      return () => clearTimeout(tid);
    }

    /* ---------- Schleife mit festem Zeitschritt ---------- */
    const STEP = 1 / 60;
    let raf = 0, running = false, acc = 0, last = performance.now(), simT = 0;
    let freezeAt = 8;

    function ensureRunning() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    function frame(now) {
      acc += Math.min(0.1, (now - last) / 1000);
      last = now;
      let allRest = true;

      while (acc >= STEP) {
        acc -= STEP;
        simT += STEP;
        for (const b of bodies) if (!b.live && simT >= b.delay) b.live = true;
        for (let s = 0; s < SUB; s++) physics(STEP / SUB);
        if (count > 1) separateOverlaps(simT < freezeAt);

        for (const b of bodies) {
          if (!b.live || b.asleep || b.drag) continue;
          const sv = Math.hypot(b.v[0], b.v[1], b.v[2]);
          const sw = Math.hypot(b.w[0], b.w[1], b.w[2]);
          const moved = qAngle(b.q, b.qRef);
          if (sv < 7 && sw < 0.3 && moved < 0.02) b.sleepT += STEP;
          else { b.sleepT = 0; b.qRef = b.q.slice(); }
          if (b.sleepT > 0.30) {
            // Verkantet? Dann den Tisch anstoßen — ein echter Impuls.
            if (flatness(b) < 0.97 && b.bumps < 5 && simT < freezeAt - 2.5) {
              b.bumps++;
              b.v[2] = 130;
              b.w[0] += (Math.random() - 0.5) * 8;
              b.w[1] += (Math.random() - 0.5) * 8;
              b.sleepT = 0; b.qRef = b.q.slice();
            } else {
              b.asleep = true;
              b.v = [0, 0, 0]; b.w = [0, 0, 0];
              b.value = readFace(b);
            }
          }
        }
        if (simT > freezeAt) for (const b of bodies) {
          if (b.live && !b.asleep && !b.drag) {
            b.asleep = true; b.v = [0, 0, 0]; b.w = [0, 0, 0];
            b.value = readFace(b);
          }
        }
      }

      for (const b of bodies) {
        if (b.live) paint(b);
        if (!b.live || !b.asleep || b.drag) allRest = false;
      }

      if (!allRest) {
        raf = requestAnimationFrame(frame);
      } else {
        running = false;
        // Das Ergebnis eines Wurfs steht fest, sobald die Würfel liegen.
        // Späteres Anstupsen verschiebt sie nur noch — gewertet wird nicht neu.
        if (!settledOnceRef.current) {
          settledOnceRef.current = true;
          onSettledRef.current(bodies.map(b => b.value));
        }
      }
    }
    ensureRunning();

    /* ---------- Anstupsen mit Maus / Finger ---------- */
    const grabs = new Map();
    const local = ev => {
      const r = area.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    };

    function onDown(ev) {
      const pt = local(ev);
      let hit = null, best = Infinity;
      for (const b of bodies) {
        if (!b.live) continue;
        const d = Math.hypot(b.p[0] - pt.x, b.p[1] - pt.y);
        if (d < b.sh.R * 1.05 && d < best) { best = d; hit = b; }
      }
      if (!hit) return;
      ev.preventDefault();
      try { area.setPointerCapture(ev.pointerId); } catch (e) { /* egal */ }
      hit.drag = true; hit.asleep = false; hit.sleepT = 0;
      hit.v = [0, 0, 0];
      hit.grab = [pt.x - hit.p[0], pt.y - hit.p[1]];
      hit.p[2] = hit.sh.R + 34;
      grabs.set(ev.pointerId, { b: hit, s: [{ x: pt.x, y: pt.y, t: performance.now() }] });
      area.classList.add("grabbing");
      ensureRunning();
    }
    function onMove(ev) {
      const g = grabs.get(ev.pointerId);
      if (!g) return;
      ev.preventDefault();
      const pt = local(ev), b = g.b;
      const nx = Math.min(bounds.xmax - b.sh.R, Math.max(bounds.xmin + b.sh.R, pt.x - b.grab[0]));
      const ny = Math.min(bounds.ymax - b.sh.R, Math.max(bounds.ymin + b.sh.R, pt.y - b.grab[1]));
      const now = performance.now();
      const prev = g.s[g.s.length - 1];
      const dt = Math.max(0.008, (now - prev.t) / 1000);
      b.v = [(nx - b.p[0]) / dt, (ny - b.p[1]) / dt, 0];
      b.p[0] = nx; b.p[1] = ny;
      g.s.push({ x: pt.x, y: pt.y, t: now });
      if (g.s.length > 6) g.s.shift();
      ensureRunning();
    }
    function onUp(ev) {
      const g = grabs.get(ev.pointerId);
      if (!g) return;
      grabs.delete(ev.pointerId);
      area.classList.remove("grabbing");
      const b = g.b;
      b.drag = false;
      const s = g.s;
      let vx = 0, vy = 0;
      if (s.length >= 2) {
        const a = s[0], z = s[s.length - 1];
        const dt = Math.max(0.016, (z.t - a.t) / 1000);
        vx = (z.x - a.x) / dt; vy = (z.y - a.y) / dt;
        const mag = Math.hypot(vx, vy), cap = 2400;
        if (mag > cap) { vx = vx/mag*cap; vy = vy/mag*cap; }
      }
      b.v = [vx, vy, Math.min(200, Math.hypot(vx, vy) * 0.10)];
      b.w = [-vy * 0.02, vx * 0.02, (Math.random() - 0.5) * 6];
      b.sleepT = 0; b.qRef = b.q.slice(); b.bumps = 0;
      freezeAt = simT + 8;
      ensureRunning();
    }

    area.addEventListener("pointerdown", onDown, { passive: false });
    area.addEventListener("pointermove", onMove, { passive: false });
    area.addEventListener("pointerup", onUp);
    area.addEventListener("pointercancel", onUp);

    return () => {
      cancelAnimationFrame(raf);
      area.removeEventListener("pointerdown", onDown);
      area.removeEventListener("pointermove", onMove);
      area.removeEventListener("pointerup", onUp);
      area.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={areaRef} className="dice-area">
      {Array.from({ length: count }).map((_, i) => (
        <div key={"s" + i} className="phys-shadow" style={{ opacity: 0 }}
          ref={el => { shadowsRef.current[i] = el; }} />
      ))}
      {Array.from({ length: count }).map((_, i) => (
        <div key={"d" + i} className="phys-die" style={{ transform: "translate3d(-400px,-400px,0)" }}
          ref={el => { elsRef.current[i] = el; }}>
          {sides === 6
            ? <div className="die-cube"><CubeFaces /></div>
            : <canvas className="die-canvas" />}
        </div>
      ))}
    </div>
  );
}

/* ---------- Zahlenfeld ohne "hängende Null" ----------
   Hält während des Tippens den Rohtext, damit man das Feld leeren und
   frei eingeben kann. Der Wert wird erst beim Ändern gemeldet und beim
   Verlassen auf die Grenzen (min/max) normalisiert. */
function NumberInput({ value, onChange, min, max, placeholder, className, style, ariaLabel }) {
  const [text, setText] = useState(String(value ?? ""));
  const focused = useRef(false);
  // Externe Änderungen übernehmen, solange man nicht selbst tippt
  useEffect(() => {
    if (!focused.current) setText(String(value ?? ""));
  }, [value]);

  const clamp = (n) => {
    if (min != null && n < min) n = min;
    if (max != null && n > max) n = max;
    return n;
  };
  return (
    <input
      type="text"
      inputMode="numeric"
      className={className}
      style={style}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={text}
      onFocus={() => { focused.current = true; }}
      onChange={(e) => {
        let raw = e.target.value.replace(/[^0-9-]/g, "");
        // Minus nur führend erlauben
        raw = raw.replace(/(?!^)-/g, "");
        setText(raw);
        if (raw === "" || raw === "-") { onChange(min != null && min > 0 ? min : 0, true); return; }
        const n = parseInt(raw, 10);
        // Beim Tippen nur die Obergrenze wahren (damit man z. B. nicht 999 erzeugt);
        // die Untergrenze greift erst beim Verlassen, sonst "springt" das Feld.
        if (!Number.isNaN(n)) onChange(max != null && n > max ? max : n);
      }}
      onBlur={() => {
        focused.current = false;
        let n = parseInt(text, 10);
        if (Number.isNaN(n)) n = min != null ? min : 0;
        n = clamp(n);
        setText(String(n));
        onChange(n);
      }}
    />
  );
}

/* ---------- Tally für Stufe ---------- */
function Tally({ value }) {
  const groups = Math.floor(value / 5);
  const rest = value % 5;
  return (
    <>
      {Array.from({ length: groups }).map((_, g) => (
        <span key={g} className="tally-group">
          {[0, 1, 2, 3].map(i => <span key={i} className="tally-stroke" />)}
          <span className="tally-cross" />
        </span>
      ))}
      {rest > 0 && (
        <span className="tally-group">
          {Array.from({ length: rest }).map((_, i) => <span key={i} className="tally-stroke" />)}
        </span>
      )}
      {value === 0 && <span style={{ fontStyle: "italic", opacity: .6 }}>noch Landratte</span>}
    </>
  );
}

/* ============================================================ */
export default function App() {
  const [tab, setTab] = useState("bogen");
  const [chars, setChars] = useState([newChar()]);
  const [activeId, setActiveId] = useState(null);
  const [toast, setToast] = useState("");
  const [loaded, setLoaded] = useState(false);

  // Würfel-State
  const [count, setCount] = useState(2);
  const [sides, setSides] = useState(6);
  const [probeAtt, setProbeAtt] = useState("");
  const [throwSpec, setThrowSpec] = useState(null);   // { id, count, sides, att }
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const toastTimer = useRef(null);

  // Kampf-Tracker
  const [fighters, setFighters] = useState([]);
  const [turnIdx, setTurnIdx] = useState(0);
  const [round, setRound] = useState(1);
  const [combatActive, setCombatActive] = useState(false);
  const [iniRoll, setIniRoll] = useState(null);   // { fighterId } während des Ini-Wurfs

  // Karte: { bg: dataURL|null, gridOn, tokens: [{id, label, kind, color, x, y, ref}] }
  const [mapBg, setMapBg] = useState(null);
  const [gridOn, setGridOn] = useState(true);
  const [tokens, setTokens] = useState([]);
  const mapViewRef = useRef(null);
  const dragRef = useRef(null);

  // Karten-Zeichentool
  const [drawGrid, setDrawGrid] = useState(null);       // { cols, rows, cells:[] }
  const [drawTerrain, setDrawTerrain] = useState("gruen");
  const [drawBrush, setDrawBrush] = useState(1);
  const [drawBuildings, setDrawBuildings] = useState([]); // [{id, kind, x, y}]
  const [drawMode, setDrawMode] = useState("terrain");    // terrain | gebaeude | radierer
  const drawCanvasRef = useRef(null);
  const drawingRef = useRef(false);

  // Detail-Editor (Dungeon/Palast, Vektorformen auf Kampfraster)
  const [detObjects, setDetObjects] = useState([]);   // Formen, Wände, Labels
  const [detTool, setDetTool] = useState("rect");      // rect|circle|wall|door|label|select
  const [detFloor, setDetFloor] = useState("stein");
  const [detSnap, setDetSnap] = useState(true);
  const [detBg, setDetBg] = useState("stein");         // Grundboden
  const detSvgRef = useRef(null);
  const detDraftRef = useRef(null);                    // { während des Ziehens }
  const [detDraft, setDetDraft] = useState(null);
  const detDragRef = useRef(null);                     // { id, dx, dy } beim Verschieben

  // Notizen & Questlog
  const [notizen, setNotizen] = useState("");
  const [quests, setQuests] = useState([]);
  const [neueQuest, setNeueQuest] = useState("");

  // Crew & Schiff
  const [crew, setCrew] = useState({ name: "", jollyRoger: null, schiffName: "", schiffBeschreibung: "", flotte: "" });

  const active = chars.find(c => c.id === activeId) || chars[0];

  const TERRAIN_COLORS = {
    wasser: "#2b6d8f", strand: "#e3d29a", gruen: "#5a9e52",
    wald: "#2f6d3a", fels: "#7d766b", weg: "#c2ac7a",
  };
  const TERRAIN_LABELS = {
    wasser: "Wasser", strand: "Strand", gruen: "Wiese",
    wald: "Wald", fels: "Fels", weg: "Weg",
  };
  const BUILDINGS = {
    haus: { icon: "🏠", label: "Haus" }, turm: { icon: "🗼", label: "Turm" },
    taverne: { icon: "🍺", label: "Taverne" }, hafen: { icon: "⚓", label: "Hafen" },
    schatz: { icon: "💰", label: "Schatz" }, kreuz: { icon: "❌", label: "X-Markiert-die-Stelle" },
    baum: { icon: "🌴", label: "Palme" }, berg: { icon: "⛰", label: "Berg" },
  };
  const GRID_COLS = 60, GRID_ROWS = 40;

  // Detail-Editor
  const DET_FLOORS = {
    stein: "#8a857c", holz: "#a9793f", gras: "#5a9e52", wasser: "#2b6d8f", sand: "#e3d29a",
  };
  const DET_FLOOR_LABELS = { stein: "Stein", holz: "Holz", gras: "Gras", wasser: "Wasser", sand: "Sand" };
  const DET_GRID = 32;   // Kampfraster-Spalten


  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("gla:chars");
        if (r && r.value) {
          const data = JSON.parse(r.value);
          if (Array.isArray(data) && data.length) {
            setChars(data);
            setActiveId(data[0].id);
          }
        }
      } catch (e) { /* noch nichts gespeichert */ }
      try {
        const m = await window.storage.get("gla:map");
        if (m && m.value) {
          const map = JSON.parse(m.value);
          if (map.bg) setMapBg(map.bg);
          if (typeof map.gridOn === "boolean") setGridOn(map.gridOn);
          if (Array.isArray(map.tokens)) setTokens(map.tokens);
        }
      } catch (e) { /* noch keine Karte */ }
      try {
        const d = await window.storage.get("gla:drawing");
        if (d && d.value) {
          const dr = JSON.parse(d.value);
          if (dr.grid) setDrawGrid(dr.grid);
          if (Array.isArray(dr.buildings)) setDrawBuildings(dr.buildings);
        }
      } catch (e) { /* noch keine Zeichnung */ }
      try {
        const de = await window.storage.get("gla:detail");
        if (de && de.value) {
          const det = JSON.parse(de.value);
          if (Array.isArray(det.objects)) setDetObjects(det.objects);
          if (det.bg) setDetBg(det.bg);
        }
      } catch (e) { /* noch keine Detailkarte */ }
      try {
        const nq = await window.storage.get("gla:notes");
        if (nq && nq.value) {
          const data = JSON.parse(nq.value);
          if (typeof data.notizen === "string") setNotizen(data.notizen);
          if (Array.isArray(data.quests)) setQuests(data.quests);
        }
      } catch (e) { /* noch keine Notizen */ }
      try {
        const cr = await window.storage.get("gla:crew");
        if (cr && cr.value) {
          const data = JSON.parse(cr.value);
          setCrew(c => ({ ...c, ...data }));
        }
      } catch (e) { /* noch keine Crew */ }
      setLoaded(true);
    })();
    return () => clearTimeout(toastTimer.current);
  }, []);

  // Zeichen-Canvas rendern, sobald der Tab offen ist oder sich das Raster ändert
  useEffect(() => {
    if (tab !== "zeichnen") return;
    const cv = drawCanvasRef.current;
    if (!cv) return;
    if (cv.width !== 900) { cv.width = 900; cv.height = 600; }
    const g = drawGrid || { cols: GRID_COLS, rows: GRID_ROWS, cells: new Array(GRID_COLS * GRID_ROWS).fill("wasser") };
    const cellW = cv.width / g.cols, cellH = cv.height / g.rows;
    const ctx = cv.getContext("2d");
    for (let y = 0; y < g.rows; y++) {
      for (let x = 0; x < g.cols; x++) {
        ctx.fillStyle = TERRAIN_COLORS[g.cells[y * g.cols + x]] || "#2b6d8f";
        ctx.fillRect(Math.floor(x * cellW), Math.floor(y * cellH), Math.ceil(cellW) + 1, Math.ceil(cellH) + 1);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, drawGrid]);

  async function save() {
    try {
      await window.storage.set("gla:chars", JSON.stringify(chars));
      await saveMap();
      showToast("Crew gespeichert ⚓");
    } catch (e) {
      showToast("Speichern fehlgeschlagen – nochmal versuchen");
    }
  }
  async function saveMap() {
    try {
      await window.storage.set("gla:map", JSON.stringify({ bg: mapBg, gridOn, tokens }));
      return true;
    } catch (e) {
      showToast("Karte zu groß zum Speichern — kleineres Bild wählen");
      return false;
    }
  }

  function exportPdf() {
    const a = active;
    const esc = (t) => String(t == null ? "" : t)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const nl = (t) => esc(t).replace(/\n/g, "<br>");
    const mod = (name) => {
      const m = ausgleich(a.attribute[name]);
      return m >= 0 ? "+" + m : "" + m;
    };
    const attrRows = ATTRIBUTES.map(name =>
      `<div class="p-att"><span class="p-att-name">${esc(name)}</span>` +
      `<span class="p-att-val">${esc(a.attribute[name])}</span>` +
      `<span class="p-att-mod">${mod(name)}</span></div>`
    ).join("");
    const items = (a.habUndGut || []).filter(it => (it.text || "").trim());
    const invRows = items.length
      ? items.map(it => `<tr><td class="p-qty">${esc(it.anzahl)}×</td><td>${esc(it.text)}</td></tr>`).join("")
      : `<tr><td colspan="2" class="p-empty">—</td></tr>`;
    const weapons = (a.waffen || []).filter(w => (w.name || "").trim() || (w.schaden || "").trim());
    const weaponRows = weapons.length
      ? weapons.map(w => `<tr><td>${esc(w.name)}</td><td>${esc(w.att)}</td><td>${esc(w.schaden)}</td></tr>`).join("")
      : "";
    const skills = (a.skills || []).filter(sk => (sk.name || "").trim());
    const skillRows = skills.length
      ? skills.map(sk => `<div class="p-skill"><b>${esc(sk.name)}</b>${sk.att ? ` <span class="p-skill-att">(${esc(sk.att)})</span>` : ""}<div class="p-skill-desc">${nl(sk.beschreibung)}</div></div>`).join("")
      : "";
    const frucht = a.teufelsfrucht || { name: "", typ: "", raenge: [] };
    const fruchtRaenge = (frucht.raenge || []).filter(r => r.unlocked && ((r.name || "").trim() || (r.beschreibung || "").trim()));
    const fruchtBlock = (frucht.name || fruchtRaenge.length)
      ? `<h2>Teufelsfrucht</h2>
         <div class="p-frucht-name">${esc(frucht.name || "—")}${frucht.typ ? ` <span class="p-skill-att">(${esc(frucht.typ)})</span>` : ""}</div>
         ${fruchtRaenge.map((r, i) => `<div class="p-rang"><b>${i + 1}. ${esc(r.name)}</b>${r.kostenText ? ` <span class="p-skill-att">— ${esc(r.kostenText)}</span>` : ""}<div class="p-skill-desc">${nl(r.beschreibung)}${r.wurfTyp === "schaden" ? `  <i>Schaden: ${esc(r.wurfSchaden)}</i>` : r.wurfTyp === "probe" ? `  <i>Probe: ${esc(r.wurfAtt)}</i>` : ""}</div></div>`).join("")}`
      : "";
    const stufe = a.stufe > 0 ? `Stufe ${a.stufe}` : "Stufe 0 (Landratte)";
    const field = (label, val) =>
      `<div class="p-field"><div class="p-label">${esc(label)}</div><div class="p-value">${nl(val) || "&nbsp;"}</div></div>`;

    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<title>${esc(a.name || "Charakterbogen")} — Charakterbogen</title>
<link href="https://fonts.googleapis.com/css2?family=Pirata+One&family=IM+Fell+English:ital@0;1&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'IM Fell English', Georgia, serif; color: #2b2014; margin: 0;
    background: #e7d3a8;
    background-image:
      radial-gradient(ellipse at 18% 8%, rgba(255,255,255,.35), transparent 45%),
      radial-gradient(ellipse at 85% 92%, rgba(106,72,28,.18), transparent 55%);
  }
  .sheet { max-width: 190mm; margin: 0 auto; padding: 6mm; }
  h1 { font-family: 'Pirata One', Georgia, serif; font-weight: 400; text-align: center;
       font-size: 30pt; margin: 0 0 2mm; letter-spacing: 1px; }
  .sub { text-align: center; font-style: italic; margin-bottom: 4mm; opacity: .7; }
  .rule { height: 2px; background: repeating-linear-gradient(90deg,#2b2014 0 12px,transparent 12px 18px);
          opacity: .7; margin: 3mm 0; }
  .row { display: flex; gap: 5mm; }
  .col { flex: 1; }
  .p-field { margin-bottom: 3mm; }
  .p-label { font-family: 'Pirata One', Georgia, serif; font-size: 12pt; letter-spacing: .5px; }
  .p-value { border-bottom: 1px solid rgba(43,32,20,.5); min-height: 6mm; padding: 1mm 1mm 0; font-size: 11pt; }
  .p-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2mm; }
  .p-head .stufe { font-family: 'Pirata One', Georgia, serif; font-size: 14pt; }
  .vitals { display: flex; gap: 6mm; margin: 2mm 0 3mm; }
  .vital { font-family: 'Pirata One', Georgia, serif; font-size: 13pt; }
  .vital small { font-family: 'IM Fell English', serif; font-style: italic; font-size: 9pt; display: block; opacity: .7; }
  h2 { font-family: 'Pirata One', Georgia, serif; font-weight: 400; font-size: 16pt; margin: 4mm 0 2mm; }
  .att-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2mm 4mm; }
  .p-att { display: flex; align-items: center; gap: 2mm; border: 1.5px solid #2b2014;
           border-radius: 4px; padding: 1.5mm 3mm; }
  .p-att-name { font-family: 'Pirata One', serif; font-size: 10.5pt; flex: 1; }
  .p-att-val { font-family: 'Pirata One', serif; font-size: 14pt; }
  .p-att-mod { font-family: 'Pirata One', serif; font-size: 11pt; color: #8b2e1f; min-width: 8mm; text-align: right; }
  table { width: 100%; border-collapse: collapse; font-size: 11pt; }
  td { border-bottom: 1px dotted rgba(43,32,20,.4); padding: 1.2mm 1mm; }
  .p-qty { width: 12mm; font-family: 'Pirata One', serif; }
  .p-empty { text-align: center; opacity: .5; }
  .p-weapons th { text-align: left; font-family: 'Pirata One', serif; font-weight: 400; font-size: 10pt; border-bottom: 1.5px solid #2b2014; }
  .p-skill { margin-bottom: 2.5mm; }
  .p-skill-att { color: #8b2e1f; font-style: italic; }
  .p-skill-desc { font-size: 10pt; padding-left: 3mm; }
  .p-frucht-name { font-family: 'Pirata One', serif; font-size: 13pt; margin-bottom: 1.5mm; }
  .p-rang { margin-bottom: 2mm; }
  .berries { text-align: right; font-family: 'Pirata One', serif; font-size: 13pt; margin-top: 2mm; }
  .foot { text-align: center; font-style: italic; opacity: .55; font-size: 9pt; margin-top: 6mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body><div class="sheet">
  <h1>${esc(a.name || "Namenloser Pirat")}</h1>
  <div class="sub">☠ Grand Line Assistant — Charakterbogen ☠</div>
  <div class="rule"></div>
  <div class="p-head"><span class="stufe">${esc(stufe)}</span></div>
  <div class="vitals">
    <span class="vital">❤ ${esc(a.leben)}<small>Leben</small></span>
    <span class="vital">⚔ ${esc(a.schaden)}<small>Schaden</small></span>
    <span class="vital">☠ ${esc(a.berries)}<small>Berries</small></span>
  </div>
  <div class="row">
    <div class="col">${field("Aussehen", a.aussehen)}${field("Spezialeigenschaften", a.spezial)}</div>
    <div class="col">${field("Ziel im Leben", a.ziel)}${field("Eigenschaften", a.eigenschaften)}</div>
  </div>
  <h2>Attribute</h2>
  <div class="att-grid">${attrRows}</div>
  ${weaponRows ? `<h2>Waffen</h2><table class="p-weapons"><tr><th>Waffe</th><th>Trefferwurf</th><th>Schaden</th></tr>${weaponRows}</table>` : ""}
  ${skillRows ? `<h2>Skills</h2><div class="p-skills">${skillRows}</div>` : ""}
  ${fruchtBlock}
  <h2>Hab und Gut</h2>
  <table>${invRows}</table>
  <div class="foot">Ausgedruckt aus dem Grand Line Assistant</div>
</div>
<script>window.onload = () => { setTimeout(() => window.print(), 350); };</script>
</body></html>`;

    const w = window.open("", "_blank");
    if (!w) { showToast("Bitte Pop-ups erlauben, dann klappt der Druck ⚓"); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }

  function patch(p) {
    setChars(cs => cs.map(c => (c.id === active.id ? { ...c, ...p } : c)));
  }
  function patchAtt(name, val) {
    patch({ attribute: { ...active.attribute, [name]: val } });
  }
  function addChar() {
    const c = newChar();
    setChars(cs => [...cs, c]);
    setActiveId(c.id);
  }
  function removeChar() {
    if (chars.length <= 1) return;
    const rest = chars.filter(c => c.id !== active.id);
    setChars(rest);
    setActiveId(rest[0].id);
  }
  function patchItem(id, p) {
    patch({ habUndGut: active.habUndGut.map(it => (it.id === id ? { ...it, ...p } : it)) });
  }
  function addItem() {
    patch({ habUndGut: [...active.habUndGut, { id: Date.now(), text: "", anzahl: 1 }] });
  }
  function delItem(id) {
    patch({ habUndGut: active.habUndGut.filter(it => it.id !== id) });
  }

  // Waffen
  function patchWeapon(id, p) {
    patch({ waffen: (active.waffen || []).map(w => (w.id === id ? { ...w, ...p } : w)) });
  }
  function addWeapon() {
    patch({ waffen: [...(active.waffen || []), { id: Date.now(), name: "", att: "Nahkampf", schaden: "W6" }] });
  }
  function delWeapon(id) {
    patch({ waffen: (active.waffen || []).filter(w => w.id !== id) });
  }

  // Skills
  function patchSkill(id, p) {
    patch({ skills: (active.skills || []).map(sk => (sk.id === id ? { ...sk, ...p } : sk)) });
  }
  function addSkill() {
    patch({ skills: [...(active.skills || []), { id: Date.now(), name: "", att: "", beschreibung: "" }] });
  }
  function delSkill(id) {
    patch({ skills: (active.skills || []).filter(sk => sk.id !== id) });
  }

  // Teufelsfrucht
  function patchFrucht(p2) {
    const f = active.teufelsfrucht || { name: "", typ: "", raenge: [] };
    patch({ teufelsfrucht: { ...f, ...p2 } });
  }
  function patchRang(id, p2) {
    const f = active.teufelsfrucht || { name: "", typ: "", raenge: [] };
    patchFrucht({ raenge: (f.raenge || []).map(r => (r.id === id ? { ...r, ...p2 } : r)) });
  }
  function addRang() {
    const f = active.teufelsfrucht || { name: "", typ: "", raenge: [] };
    const next = (f.raenge || []).length + 1;
    patchFrucht({ raenge: [...(f.raenge || []), {
      id: Date.now(), name: "", beschreibung: "", kostenLevel: 1,
      wurfTyp: "", wurfAtt: "Nahkampf", wurfSchaden: "W6", kostenText: "", unlocked: false,
    }] });
  }
  function delRang(id) {
    const f = active.teufelsfrucht || { name: "", typ: "", raenge: [] };
    patchFrucht({ raenge: (f.raenge || []).filter(r => r.id !== id) });
  }
  function toggleRang(id, unlock) {
    patchRang(id, { unlocked: unlock });
  }
  function rollRang(r) {
    if (r.wurfTyp === "probe") {
      rollProbeFor(r.wurfAtt, `${active.teufelsfrucht?.name || "Frucht"} — ${r.name || "Kraft"}`);
    } else if (r.wurfTyp === "schaden") {
      rollDamage({ name: `${active.teufelsfrucht?.name || "Frucht"} — ${r.name || "Kraft"}`, schaden: r.wurfSchaden });
    }
  }

  /* ---- Werfen ---- */
  function roll(opts = {}) {
    const n = opts.count ?? count;
    const s = opts.sides ?? sides;
    const att = opts.att !== undefined ? opts.att : probeAtt;
    setResult(null);
    setThrowSpec({
      id: Date.now(),
      count: n, sides: s, att,
      label: opts.label || null,
      flat: opts.flat || 0,        // fester Bonus (z. B. Schadensmodifikator)
      kind: opts.kind || (att ? "probe" : "wurf"),
    });
  }
  function probe(attName) {
    setProbeAtt(attName);
    setCount(2);
    setSides(6);
    roll({ count: 2, sides: 6, att: attName });
  }
  // Wirft den Schaden einer Waffe: alle Würfelgruppen zusammen + fester Bonus
  function rollDamage(weapon, opts = {}) {
    const parts = parseDamage(weapon.schaden);
    const diceParts = parts.filter(x => x.sides);
    const flat = parts.filter(x => x.flat != null).reduce((a, x) => a + x.flat, 0);
    if (!diceParts.length && !flat) { showToast("Kein gültiger Schadenswurf hinterlegt"); return; }
    // Falls nur ein Würfeltyp: normal werfen. Sonst gemischt (z. B. W8+W6).
    const groups = diceParts.map(d => ({ n: d.n, sides: d.sides }));
    setResult(null);
    setThrowSpec({
      id: Date.now(),
      groups,
      flat,
      label: opts.label || `Schaden — ${weapon.name || "Waffe"}`,
      kind: "schaden",
      backTo: opts.backTo || null,
      // Rückwärtskompatibel: erste Gruppe füttert die alten Felder
      count: groups[0]?.n || 1, sides: groups[0]?.sides || 6, att: null,
    });
    setTab("wuerfel");
  }
  // Wirft eine Probe direkt aus einem Skill oder einer Waffe (Trefferwurf)
  function rollProbeFor(attName, label, opts = {}) {
    setResult(null);
    setThrowSpec({
      id: Date.now(),
      count: 2, sides: 6, att: attName,
      label, kind: "probe", flat: opts.flat || 0,
      backTo: opts.backTo || null,
    });
    setTab("wuerfel");
  }
  // Fester Wurf (z. B. Gegner-Angriff ohne Charakter): 2W6 + Bonus
  function rollFlat(label, flat, opts = {}) {
    setResult(null);
    setThrowSpec({
      id: Date.now(),
      count: 2, sides: 6, att: null,
      label, kind: "probe", flat: flat || 0,
      backTo: opts.backTo || null,
    });
    setTab("wuerfel");
  }
  function handleSettled(vals) {
    const spec = throwSpec;
    if (!spec) return;

    // Gemischter Schaden (z. B. W8 + W6): weitere Gruppen nacheinander werfen
    if (spec.groups && spec.groups.length > 1 && (spec.groupIndex || 0) < spec.groups.length - 1) {
      const gi = (spec.groupIndex || 0);
      const carried = [...(spec.carriedVals || []), ...vals];
      const next = spec.groups[gi + 1];
      setThrowSpec({
        ...spec,
        id: Date.now(),
        groupIndex: gi + 1,
        carriedVals: carried,
        count: next.n, sides: next.sides,
      });
      return;
    }

    const allVals = [...(spec.carriedVals || []), ...vals];
    const sum = allVals.reduce((a, b) => a + b, 0);
    const attMod = spec.att ? ausgleich(active.attribute[spec.att]) : 0;
    const flat = spec.flat || 0;
    const mod = attMod + flat;
    const total = sum + mod;
    let verdict = null;
    if (spec.kind === "probe" && spec.att) {
      verdict = total >= 10 ? "ok" : total >= 7 ? "mid" : "fail";
    }
    const res = {
      vals: allVals, sum, mod, total, att: spec.att, verdict,
      sides: spec.sides, label: spec.label, kind: spec.kind, flat,
      fighterId: spec.fighterId || null,
    };
    setResult(res);
    setHistory(h => [res, ...h].slice(0, 8));
    // Initiative-Wurf: Ergebnis dem Kämpfer zuweisen
    if (spec.kind === "initiative" && spec.fighterId) {
      setFighters(fs => fs.map(f => (f.id === spec.fighterId ? { ...f, ini: total } : f)));
    }
  }
  function rerollCurrent() {
    const ts = throwSpec;
    if (!ts) return;
    setResult(null);
    if (ts.kind === "schaden" && ts.groups) {
      const first = ts.groups[0];
      setThrowSpec({ ...ts, id: Date.now(), groupIndex: 0, carriedVals: [], count: first.n, sides: first.sides });
    } else {
      setThrowSpec({ ...ts, id: Date.now(), groupIndex: 0, carriedVals: [] });
    }
  }
  function closeTable() {
    const back = throwSpec && (throwSpec.backTo || (throwSpec.kind === "initiative" ? "kampf" : null));
    setThrowSpec(null);
    setResult(null);
    if (back) setTab(back);
  }

  /* ---- Kampf-Tracker ---- */
  function sortedFighters() {
    return [...fighters]
      .map((f, i) => ({ ...f, _idx: i }))
      .sort((a, b) => {
        const ai = a.ini == null ? -Infinity : a.ini;
        const bi = b.ini == null ? -Infinity : b.ini;
        if (bi !== ai) return bi - ai;
        return a._idx - b._idx;
      });
  }
  function addFighterFromChar(c) {
    if (fighters.some(f => f.charId === c.id)) { showToast("Schon im Kampf dabei"); return; }
    setFighters(fs => [...fs, {
      id: "f" + Date.now() + Math.random().toString(36).slice(2, 5),
      charId: c.id, name: c.name || "Namenlos", seite: "crew",
      iniAtt: "Geschicklichkeit", ini: null,
      hp: Number(c.leben) || 10, maxHp: Number(c.leben) || 10, tot: false,
    }]);
  }
  function addEnemy() {
    setFighters(fs => [...fs, {
      id: "f" + Date.now() + Math.random().toString(36).slice(2, 5),
      charId: null, name: "", seite: "gegner",
      iniAtt: "Geschicklichkeit", ini: null,
      hp: 10, maxHp: 10, tot: false, iniMod: 0,
      atkMod: 2, atkDmg: "W6",
    }]);
  }
  function patchFighter(id, p2) {
    setFighters(fs => fs.map(f => (f.id === id ? { ...f, ...p2 } : f)));
  }
  function delFighter(id) {
    setFighters(fs => fs.filter(f => f.id !== id));
  }
  function damageFighter(id, delta) {
    setFighters(fs => fs.map(f => {
      if (f.id !== id) return f;
      const hp = Math.max(0, Math.min(f.maxHp, f.hp + delta));
      return { ...f, hp, tot: hp <= 0 };
    }));
  }
  // Initiative für einen Kämpfer auf dem echten Würfeltisch werfen
  function rollInitiativeFor(f) {
    const char = f.charId ? chars.find(c => c.id === f.charId) : null;
    // Crew: 2W6 + Attribut-Ausgleich; Gegner: 2W6 + fester iniMod
    setResult(null);
    if (char) {
      setThrowSpec({
        id: Date.now(), count: 2, sides: 6, att: f.iniAtt,
        label: `Initiative — ${f.name}`, kind: "initiative", flat: 0,
        fighterId: f.id, iniChar: char.id,
      });
    } else {
      setThrowSpec({
        id: Date.now(), count: 2, sides: 6, att: null,
        label: `Initiative — ${f.name || "Gegner"}`, kind: "initiative",
        flat: Number(f.iniMod) || 0, fighterId: f.id,
      });
    }
    setTab("wuerfel");
  }

  // Angriff mit einer Waffe eines Crew-Kämpfers (Trefferwurf), Rücksprung zum Kampf
  function fighterAttack(f, weapon) {
    rollProbeFor(weapon.att, `${f.name} — ${weapon.name || "Angriff"}`, { backTo: "kampf" });
  }
  function fighterDamage(f, weapon) {
    rollDamage(weapon, { label: `${f.name} — ${weapon.name || "Schaden"}`, backTo: "kampf" });
  }
  // Gegner-Angriff: 2W6 + atkMod (Treffer) bzw. atkDmg (Schaden)
  function enemyAttack(f) {
    rollFlat(`${f.name || "Gegner"} — Angriff`, Number(f.atkMod) || 0, { backTo: "kampf" });
  }
  function enemyDamage(f) {
    rollDamage({ name: f.name || "Gegner", schaden: f.atkDmg || "W6" }, { label: `${f.name || "Gegner"} — Schaden`, backTo: "kampf" });
  }
  // Waffen eines Kämpfers aus dem verknüpften Charakter holen
  function fighterWeapons(f) {
    if (!f.charId) return [];
    const c = chars.find(x => x.id === f.charId);
    return (c && c.waffen) ? c.waffen.filter(w => (w.name || "").trim() || (w.schaden || "").trim()) : [];
  }
  // Alle auf einmal auswürfeln (still, ohne Tisch — für schnellen Start)
  function rollAllInitiative() {
    setFighters(fs => fs.map(f => {
      const roll = 2 + Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6);
      let mod = 0;
      if (f.charId) {
        const c = chars.find(x => x.id === f.charId);
        if (c) mod = ausgleich(c.attribute[f.iniAtt]);
      } else {
        mod = Number(f.iniMod) || 0;
      }
      return { ...f, ini: roll + mod };
    }));
    setCombatActive(true);
    setRound(1);
    setTurnIdx(0);
  }
  function startCombat() {
    if (fighters.length === 0) { showToast("Erst Kämpfer hinzufügen"); return; }
    setCombatActive(true);
    setRound(1);
    setTurnIdx(0);
  }
  function endCombat() {
    setCombatActive(false);
    setRound(1);
    setTurnIdx(0);
  }
  function nextTurn() {
    const order = sortedFighters();
    if (order.length === 0) return;
    let ti = turnIdx, r = round, guard = 0;
    do {
      ti++;
      if (ti >= order.length) { ti = 0; r++; }
      guard++;
    } while (order[ti] && order[ti].tot && guard <= order.length);
    if (guard > order.length && order.every(f => f.tot)) return;
    setTurnIdx(ti);
    setRound(r);
  }
  function resetInitiative() {
    setFighters(fs => fs.map(f => ({ ...f, ini: null })));
    setTurnIdx(0);
    setRound(1);
  }

  /* ---- Karte ---- */
  const TOKEN_COLORS = { crew: "#2f6d8a", gegner: "#8b2e1f", insel: "#2f7d4a", schiff: "#7a5a1e", ziel: "#8a3b8f" };

  function onMapUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) { showToast("Bitte ein Bild wählen"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxEdge = 1600;
        let w = img.width, h = img.height;
        if (w > maxEdge || h > maxEdge) {
          const sc = maxEdge / Math.max(w, h);
          w = Math.round(w * sc); h = Math.round(h * sc);
        }
        const cv = document.createElement("canvas");
        cv.width = w; cv.height = h;
        cv.getContext("2d").drawImage(img, 0, 0, w, h);
        // JPEG, Qualität notfalls senken bis unter ~4MB
        let q = 0.85, url = cv.toDataURL("image/jpeg", q);
        while (url.length > 4_000_000 && q > 0.4) { q -= 0.15; url = cv.toDataURL("image/jpeg", q); }
        setMapBg(url);
        showToast("Karte geladen ⚓");
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }
  function clearMapBg() { setMapBg(null); }

  function addMapToken(kind, opts = {}) {
    setTokens(ts => [...ts, {
      id: "t" + Date.now() + Math.random().toString(36).slice(2, 5),
      label: opts.label || "",
      kind,
      color: opts.color || TOKEN_COLORS[kind] || "#555",
      x: opts.x != null ? opts.x : 50,   // Prozent der Kartenbreite
      y: opts.y != null ? opts.y : 50,
      ref: opts.ref || null,
    }]);
  }
  function addCrewToken(c) {
    if (tokens.some(t => t.ref === "char:" + c.id)) { showToast("Schon auf der Karte"); return; }
    addMapToken("crew", { label: (c.name || "?").slice(0, 12), ref: "char:" + c.id, x: 25 + Math.random() * 10, y: 45 + Math.random() * 10 });
  }
  function addFightersToMap() {
    const enemies = fighters.filter(f => f.seite === "gegner" && !f.tot);
    if (!enemies.length) { showToast("Keine lebenden Gegner im Kampf"); return; }
    setTokens(ts => {
      const existing = new Set(ts.map(t => t.ref));
      const news = enemies
        .filter(f => !existing.has("fighter:" + f.id))
        .map((f, i) => ({
          id: "t" + Date.now() + i + Math.random().toString(36).slice(2, 4),
          label: (f.name || "Gegner").slice(0, 12), kind: "gegner",
          color: TOKEN_COLORS.gegner, ref: "fighter:" + f.id,
          x: 60 + Math.random() * 15, y: 40 + Math.random() * 20,
        }));
      return [...ts, ...news];
    });
  }
  function patchToken(id, p2) {
    setTokens(ts => ts.map(t => (t.id === id ? { ...t, ...p2 } : t)));
  }
  function delToken(id) {
    setTokens(ts => ts.filter(t => t.id !== id));
  }
  function clearTokens() {
    if (tokens.length) setTokens([]);
  }

  // Drag: Position in Prozent der Kartenfläche
  function tokenPointerDown(e, t) {
    e.preventDefault();
    e.stopPropagation();
    const view = mapViewRef.current;
    if (!view) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
    dragRef.current = { id: t.id, pointerId: e.pointerId, el: e.currentTarget };
  }
  function tokenPointerMove(e) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const view = mapViewRef.current;
    if (!view) return;
    const r = view.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100));
    patchToken(d.id, { x, y });
  }
  function tokenPointerUp(e) {
    const d = dragRef.current;
    if (d && d.pointerId === e.pointerId) dragRef.current = null;
  }

  /* ---- Karten-Zeichentool ---- */
  function ensureGrid() {
    if (drawGrid) return drawGrid;
    const g = { cols: GRID_COLS, rows: GRID_ROWS, cells: new Array(GRID_COLS * GRID_ROWS).fill("wasser") };
    setDrawGrid(g);
    return g;
  }
  // Raster aufs Canvas zeichnen
  function renderGrid(g, buildings) {
    const cv = drawCanvasRef.current;
    if (!cv || !g) return;
    const cw = cv.width, ch = cv.height;
    const cellW = cw / g.cols, cellH = ch / g.rows;
    const ctx = cv.getContext("2d");
    for (let y = 0; y < g.rows; y++) {
      for (let x = 0; x < g.cols; x++) {
        ctx.fillStyle = TERRAIN_COLORS[g.cells[y * g.cols + x]] || "#2b6d8f";
        ctx.fillRect(Math.floor(x * cellW), Math.floor(y * cellH), Math.ceil(cellW) + 1, Math.ceil(cellH) + 1);
      }
    }
  }
  // Pixelposition (relativ zum Canvas) -> Zelle
  function cellAt(g, px, py, rect) {
    const cx = Math.floor((px / rect.width) * g.cols);
    const cy = Math.floor((py / rect.height) * g.rows);
    return { cx: Math.max(0, Math.min(g.cols - 1, cx)), cy: Math.max(0, Math.min(g.rows - 1, cy)) };
  }
  function paintAt(clientX, clientY) {
    const cv = drawCanvasRef.current;
    if (!cv) return;
    const g = ensureGrid();
    const rect = cv.getBoundingClientRect();
    const { cx, cy } = cellAt(g, clientX - rect.left, clientY - rect.top, rect);
    const r = drawBrush - 1;
    const terr = drawMode === "radierer" ? "wasser" : drawTerrain;
    const ctx = cv.getContext("2d");
    const cellW = cv.width / g.cols, cellH = cv.height / g.rows;
    let changed = false;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= g.cols || y >= g.rows) continue;
        const i = y * g.cols + x;
        if (g.cells[i] !== terr) { g.cells[i] = terr; changed = true; }
        ctx.fillStyle = TERRAIN_COLORS[terr];
        ctx.fillRect(Math.floor(x * cellW), Math.floor(y * cellH), Math.ceil(cellW) + 1, Math.ceil(cellH) + 1);
      }
    }
    return changed;
  }
  function drawPointerDown(e) {
    if (drawMode === "gebaeude") {
      const cv = drawCanvasRef.current;
      const rect = cv.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setDrawBuildings(bs => [...bs, {
        id: "b" + Date.now() + Math.random().toString(36).slice(2, 4),
        kind: drawTerrain in BUILDINGS ? drawTerrain : "haus",
        x, y,
      }]);
      return;
    }
    e.preventDefault();
    drawingRef.current = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
    paintAt(e.clientX, e.clientY);
  }
  function drawPointerMove(e) {
    if (!drawingRef.current) return;
    paintAt(e.clientX, e.clientY);
  }
  function drawPointerUp() {
    if (drawingRef.current) {
      drawingRef.current = false;
      // State einmalig aktualisieren, damit gespeichert werden kann
      setDrawGrid(g => (g ? { ...g, cells: [...g.cells] } : g));
    }
  }
  function pickBuilding(kind) {
    setDrawMode("gebaeude");
    setDrawTerrain(kind);
  }
  function delBuilding(id) {
    setDrawBuildings(bs => bs.filter(b => b.id !== id));
  }
  function clearDrawing() {
    const g = { cols: GRID_COLS, rows: GRID_ROWS, cells: new Array(GRID_COLS * GRID_ROWS).fill("wasser") };
    setDrawGrid(g);
    setDrawBuildings([]);
    const cv = drawCanvasRef.current;
    if (cv) renderGrid(g, []);
  }
  // Zeichnung als Bild-Hintergrund in den Tracker übernehmen
  function useDrawingAsMap() {
    const cv = drawCanvasRef.current;
    if (!cv || !drawGrid) { showToast("Erst etwas zeichnen"); return; }
    // Gebäude aufs Bild brennen
    const out = document.createElement("canvas");
    out.width = cv.width; out.height = cv.height;
    const ctx = out.getContext("2d");
    ctx.drawImage(cv, 0, 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.round(out.width / 28)}px serif`;
    for (const b of drawBuildings) {
      const icon = (BUILDINGS[b.kind] || BUILDINGS.haus).icon;
      ctx.fillText(icon, (b.x / 100) * out.width, (b.y / 100) * out.height);
    }
    const url = out.toDataURL("image/jpeg", 0.85);
    setMapBg(url);
    setTab("karte");
    showToast("Zeichnung als Karte übernommen ⚓");
  }
  async function saveDrawing() {
    try {
      await window.storage.set("gla:drawing", JSON.stringify({ grid: drawGrid, buildings: drawBuildings }));
      showToast("Zeichnung gespeichert ⚓");
    } catch (e) {
      showToast("Zeichnung zu groß zum Speichern");
    }
  }

  /* ---- Detail-Editor ---- */
  // Mausposition -> Prozentkoordinaten im SVG (optional gerastert)
  function detPoint(e, snap) {
    const svg = detSvgRef.current;
    const r = svg.getBoundingClientRect();
    let x = ((e.clientX - r.left) / r.width) * 100;
    let y = ((e.clientY - r.top) / r.height) * 100;
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));
    if (snap && detSnap) {
      const cx = 100 / DET_GRID, cy = 100 / Math.round(DET_GRID * 0.66);
      x = Math.round(x / cx) * cx;
      y = Math.round(y / cy) * cy;
    }
    return { x, y };
  }
  function detObjAt(px, py) {
    // von oben nach unten (zuletzt gezeichnetes zuerst)
    for (let i = detObjects.length - 1; i >= 0; i--) {
      const o = detObjects[i];
      if (o.type === "rect" && px >= o.x && px <= o.x + o.w && py >= o.y && py <= o.y + o.h) return o;
      if (o.type === "circle") {
        const dx = (px - o.cx) / (o.rx || 0.001), dy = (py - o.cy) / (o.ry || 0.001);
        if (dx * dx + dy * dy <= 1) return o;
      }
      if (o.type === "label") {
        if (Math.abs(px - o.x) < 8 && Math.abs(py - o.y) < 4) return o;
      }
    }
    return null;
  }
  function detPointerDown(e) {
    const svg = detSvgRef.current;
    if (!svg) return;
    e.preventDefault();

    if (detTool === "label") {
      const p = detPoint(e, false);
      const text = window.prompt("Beschriftung:", "");
      if (text != null && text.trim()) {
        setDetObjects(os => [...os, { id: "o" + Date.now(), type: "label", x: p.x, y: p.y, text: text.trim().slice(0, 40) }]);
      }
      return;
    }
    if (detTool === "select") {
      const p = detPoint(e, false);
      const hit = detObjAt(p.x, p.y);
      if (hit) {
        try { svg.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
        const ref = hit.type === "circle" ? { x: hit.cx, y: hit.cy } : { x: hit.x, y: hit.y };
        detDragRef.current = { id: hit.id, pointerId: e.pointerId, offX: p.x - ref.x, offY: p.y - ref.y, kind: hit.type };
      }
      return;
    }
    // Zeichnen (rect/circle/wall/door): Startpunkt merken
    try { svg.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
    const p = detPoint(e, true);
    detDraftRef.current = { tool: detTool, x1: p.x, y1: p.y, x2: p.x, y2: p.y };
    setDetDraft({ ...detDraftRef.current });
  }
  function detPointerMove(e) {
    // Verschieben
    if (detDragRef.current && detDragRef.current.pointerId === e.pointerId) {
      const p = detPoint(e, false);
      const d = detDragRef.current;
      setDetObjects(os => os.map(o => {
        if (o.id !== d.id) return o;
        if (o.type === "circle") return { ...o, cx: p.x - d.offX, cy: p.y - d.offY };
        return { ...o, x: p.x - d.offX, y: p.y - d.offY };
      }));
      return;
    }
    // Zeichnen: Endpunkt aktualisieren
    const draft = detDraftRef.current;
    if (!draft) return;
    const p = detPoint(e, true);
    draft.x2 = p.x; draft.y2 = p.y;
    setDetDraft({ ...draft });
  }
  function detPointerUp(e) {
    if (detDragRef.current && detDragRef.current.pointerId === e.pointerId) {
      detDragRef.current = null;
      return;
    }
    const draft = detDraftRef.current;
    if (!draft) return;
    detDraftRef.current = null;
    setDetDraft(null);
    const { tool, x1, y1, x2, y2 } = draft;
    const id = "o" + Date.now();
    if (tool === "rect") {
      const x = Math.min(x1, x2), y = Math.min(y1, y2), w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
      if (w < 1 || h < 1) return;
      setDetObjects(os => [...os, { id, type: "rect", x, y, w, h, terr: detFloor }]);
    } else if (tool === "circle") {
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
      const rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
      if (rx < 0.5 || ry < 0.5) return;
      setDetObjects(os => [...os, { id, type: "circle", cx, cy, rx, ry, terr: detFloor }]);
    } else if (tool === "wall" || tool === "door") {
      if (Math.hypot(x2 - x1, y2 - y1) < 1) return;
      setDetObjects(os => [...os, { id, type: "wall", x1, y1, x2, y2, door: tool === "door" }]);
    }
  }
  function detDelete(id) {
    setDetObjects(os => os.filter(o => o.id !== id));
  }
  function detEditLabel(o) {
    const text = window.prompt("Beschriftung:", o.text);
    if (text != null) setDetObjects(os => os.map(x => (x.id === o.id ? { ...x, text: text.trim().slice(0, 40) } : x)));
  }
  function detClear() {
    if (detObjects.length) setDetObjects([]);
  }
  function detUndo() {
    setDetObjects(os => os.slice(0, -1));
  }
  async function detSave() {
    try {
      await window.storage.set("gla:detail", JSON.stringify({ objects: detObjects, bg: detBg }));
      showToast("Detailkarte gespeichert ⚓");
    } catch (e) {
      showToast("Zu groß zum Speichern");
    }
  }
  // Detailkarte als Bild in den Tracker übernehmen
  function detUseAsMap() {
    const svg = detSvgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true);
    // Draft-Vorschau entfernen
    clone.querySelectorAll(".det-draft").forEach(n => n.remove());
    const xml = new XMLSerializer().serializeToString(clone);
    const svgUrl = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = 1200; cv.height = 800;
      const ctx = cv.getContext("2d");
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      setMapBg(cv.toDataURL("image/jpeg", 0.88));
      setTab("karte");
      showToast("Detailkarte als Karte übernommen ⚓");
    };
    img.onerror = () => showToast("Übernahme fehlgeschlagen");
    img.src = svgUrl;
  }

  /* ---- Notizen & Questlog ---- */
  function sortedQuests() {
    return quests
      .map((q, i) => ({ ...q, _i: i }))
      .sort((a, b) => (a.erledigt !== b.erledigt ? (a.erledigt ? 1 : -1) : a._i - b._i));
  }
  function addQuest() {
    const t = neueQuest.trim();
    if (!t) return;
    setQuests(qs => [...qs, { id: "q" + Date.now(), titel: t.slice(0, 120), notiz: "", erledigt: false }]);
    setNeueQuest("");
  }
  function patchQuest(id, p2) {
    setQuests(qs => qs.map(q => (q.id === id ? { ...q, ...p2 } : q)));
  }
  function toggleQuest(id) {
    setQuests(qs => qs.map(q => (q.id === id ? { ...q, erledigt: !q.erledigt } : q)));
  }
  function delQuest(id) {
    setQuests(qs => qs.filter(q => q.id !== id));
  }
  async function saveNotes() {
    try {
      await window.storage.set("gla:notes", JSON.stringify({ notizen, quests }));
      showToast("Notizen gespeichert ⚓");
    } catch (e) {
      showToast("Speichern fehlgeschlagen — nochmal versuchen");
    }
  }

  /* ---- Kopfgeld & Crew ---- */
  function formatBerry(n) {
    const num = Math.max(0, Math.floor(Number(n) || 0));
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
  // Gemeinsame Bildverkleinerung (Porträt/Flagge): quadratisch beschnitten, klein gehalten
  function loadImageScaled(file, maxEdge, cb, square) {
    if (!file || !/^image\//.test(file.type)) { showToast("Bitte ein Bild wählen"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height, sx = 0, sy = 0, sw = w, sh = h;
        if (square) {
          const side = Math.min(w, h);
          sx = (w - side) / 2; sy = (h - side) / 2; sw = sh = side;
          w = h = side;
        }
        let dw = w, dh = h;
        if (dw > maxEdge || dh > maxEdge) {
          const sc = maxEdge / Math.max(dw, dh);
          dw = Math.round(dw * sc); dh = Math.round(dh * sc);
        }
        const cv = document.createElement("canvas");
        cv.width = dw; cv.height = dh;
        cv.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
        let q = 0.85, url = cv.toDataURL("image/jpeg", q);
        while (url.length > 900_000 && q > 0.4) { q -= 0.15; url = cv.toDataURL("image/jpeg", q); }
        cb(url);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
  function onPortraitUpload(e) {
    const file = e.target.files && e.target.files[0];
    loadImageScaled(file, 600, (url) => { patch({ portrait: url }); showToast("Porträt gesetzt ⚓"); }, true);
    e.target.value = "";
  }
  function onJollyUpload(e) {
    const file = e.target.files && e.target.files[0];
    loadImageScaled(file, 500, (url) => setCrew(c => ({ ...c, jollyRoger: url })), true);
    e.target.value = "";
  }
  function patchCrew(p2) { setCrew(c => ({ ...c, ...p2 })); }
  async function saveCrew() {
    try {
      await window.storage.set("gla:crew", JSON.stringify(crew));
      await window.storage.set("gla:chars", JSON.stringify(chars));  // Kopfgeld/Porträt hängen an den Chars
      showToast("Crew & Steckbriefe gespeichert ⚓");
    } catch (e) {
      showToast("Zu groß zum Speichern — kleinere Bilder wählen");
    }
  }

  const VERDICT_TEXT = { ok: "GESCHAFFT", mid: "TEILWEISE", fail: "FEHLSCHLAG" };

  return (
    <div className="gla-root">
      <style>{css}</style>

      <header className="gla-header">
        <h1>⚓ Grand Line Assistant</h1>
        <div className="sub">Logbuch eurer Kampagne — Bögen, Würfel &amp; Beute</div>
      </header>

      <nav className="gla-tabs">
        <button className={`gla-tab ${tab === "bogen" ? "active" : ""}`} onClick={() => setTab("bogen")}>Charakterbogen</button>
        <button className={`gla-tab ${tab === "wuerfel" ? "active" : ""}`} onClick={() => setTab("wuerfel")}>Würfeltisch</button>
        <button className={`gla-tab ${tab === "kampf" ? "active" : ""}`} onClick={() => setTab("kampf")}>Kampf ⚔</button>
        <button className={`gla-tab ${tab === "karte" ? "active" : ""}`} onClick={() => setTab("karte")}>Karte 🗺</button>
        <button className={`gla-tab ${tab === "zeichnen" ? "active" : ""}`} onClick={() => setTab("zeichnen")}>Kartografie ✎</button>
        <button className={`gla-tab ${tab === "detail" ? "active" : ""}`} onClick={() => setTab("detail")}>Schauplatz ⌗</button>
        <button className={`gla-tab ${tab === "notizen" ? "active" : ""}`} onClick={() => setTab("notizen")}>Logbuch ✒</button>
        <button className={`gla-tab ${tab === "crew" ? "active" : ""}`} onClick={() => setTab("crew")}>Steckbriefe ☠</button>
      </nav>

      {tab === "bogen" && loaded && (
        <div style={{ padding: "0 14px" }}>
          <div className="char-switch">
            {chars.map(c => (
              <button key={c.id} className={`char-chip ${c.id === active.id ? "active" : ""}`} onClick={() => setActiveId(c.id)}>
                {c.name || "Namenlos"}
              </button>
            ))}
            <button className="char-chip" onClick={addChar}>+ Neuer Charakter</button>
          </div>

          <div className="sheet">
            <h2 className="sheet-title">Charakterbogen ☠</h2>
            <div className="rule" />

            <div className="grid-2">
              <div>
                <div className="field-label">Name</div>
                <input className="gla-input" value={active.name} placeholder="z. B. Yoshijima D. Jorogumo „Jojo“"
                  onChange={e => patch({ name: e.target.value })} />
              </div>
              <div>
                <div className="field-label">
                  Stufe
                  <span className="tally-btns">
                    <button onClick={() => patch({ stufe: Math.max(0, active.stufe - 1) })} aria-label="Stufe verringern">−</button>
                    <button onClick={() => patch({ stufe: active.stufe + 1 })} aria-label="Stufe erhöhen">+</button>
                  </span>
                </div>
                <div className="tally"><Tally value={active.stufe} /></div>
              </div>
            </div>

            <div className="vital-row">
              <div className="vital">
                <span className="icon" aria-hidden>❤</span>
                <div>
                  <div className="field-label">Leben</div>
                  <NumberInput value={active.leben} min={0} onChange={(v) => patch({ leben: v })} />
                </div>
              </div>
              <div className="vital">
                <span className="icon" aria-hidden>⚔</span>
                <div>
                  <div className="field-label">Schaden</div>
                  <input style={{ width: 110 }} value={active.schaden} onChange={e => patch({ schaden: e.target.value })} />
                </div>
              </div>
              <div className="vital">
                <span className="icon" aria-hidden>💰</span>
                <div>
                  <div className="field-label">Berries</div>
                  <NumberInput className="berry-input" value={active.berries} min={0} onChange={(v) => patch({ berries: v })} />
                </div>
              </div>
            </div>

            <div className="grid-2">
              <div>
                <div className="field-label">Aussehen</div>
                <textarea className="gla-textarea" value={active.aussehen}
                  placeholder="Größe, Bart, Sonnenbrille, Narben …"
                  onChange={e => patch({ aussehen: e.target.value })} />
              </div>
              <div>
                <div className="field-label">Ziel im Leben</div>
                <textarea className="gla-textarea" value={active.ziel}
                  placeholder="z. B. die vermeintliche „Enkelin“ auf der Grand Line finden"
                  onChange={e => patch({ ziel: e.target.value })} />
              </div>
            </div>

            <div className="grid-2" style={{ marginTop: 14 }}>
              <div>
                <div className="field-label">Spezialeigenschaften</div>
                <textarea className="gla-textarea" value={active.spezial}
                  placeholder="Teufelsfrucht, selektives Hören …"
                  onChange={e => patch({ spezial: e.target.value })} />
              </div>
              <div>
                <div className="field-label">Eigenschaften</div>
                <textarea className="gla-textarea" value={active.eigenschaften}
                  placeholder="Überdramatisiert alles, ständige Ratschläge im Kampf …"
                  onChange={e => patch({ eigenschaften: e.target.value })} />
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div className="field-label">Hab und Gut</div>
              {active.habUndGut.map(it => (
                <div className="inv-row" key={it.id}>
                  <NumberInput className="gla-input qty" min={0} value={it.anzahl} onChange={(v) => patchItem(it.id, { anzahl: v })} ariaLabel="Anzahl" />
                  <input className="gla-input" value={it.text} placeholder="Gegenstand …"
                    onChange={e => patchItem(it.id, { text: e.target.value })} />
                  <button className="inv-del" onClick={() => delItem(it.id)} aria-label="Gegenstand entfernen">✕</button>
                </div>
              ))}
              <button className="gla-btn" style={{ marginTop: 6 }} onClick={addItem}>+ Gegenstand</button>
            </div>

            <div className="rule" style={{ marginTop: 24 }} />
            <h3 className="sheet-title" style={{ fontSize: 24, textAlign: "left" }}>Waffen</h3>
            <p className="section-hint">Trefferwurf würfelt 2W6 + Ausgleich des gewählten Attributs · Schaden akzeptiert z. B. „2W6+3" oder „W8 + W6".</p>
            {(active.waffen || []).length === 0 && (
              <p className="section-empty">Noch keine Waffen an Bord.</p>
            )}
            {(active.waffen || []).map(w => (
              <div className="weapon-row" key={w.id}>
                <input className="gla-input w-name" value={w.name} placeholder="z. B. Entersäbel „Shigure“"
                  onChange={e => patchWeapon(w.id, { name: e.target.value })} />
                <select className="w-att" value={w.att} onChange={e => patchWeapon(w.id, { att: e.target.value })} aria-label="Trefferattribut">
                  {ATTRIBUTES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <input className="gla-input w-dmg" value={w.schaden} placeholder="Schaden"
                  onChange={e => patchWeapon(w.id, { schaden: e.target.value })} aria-label="Schaden" />
                <button className="w-btn hit" onClick={() => rollProbeFor(w.att, `Angriff — ${w.name || "Waffe"}`)} title="Trefferwurf">⚔ Treffer</button>
                <button className="w-btn dmg" onClick={() => rollDamage(w)} title="Schadenswurf">🎲 Schaden</button>
                <button className="inv-del" onClick={() => delWeapon(w.id)} aria-label="Waffe entfernen">✕</button>
              </div>
            ))}
            <button className="gla-btn" style={{ marginTop: 6 }} onClick={addWeapon}>+ Waffe</button>

            <div className="rule" style={{ marginTop: 24 }} />
            <h3 className="sheet-title" style={{ fontSize: 24, textAlign: "left" }}>Skills</h3>
            <p className="section-hint">Optional ein Attribut zuordnen — dann lässt sich der Skill direkt als Probe würfeln.</p>
            {(active.skills || []).length === 0 && (
              <p className="section-empty">Noch keine Skills eingetragen.</p>
            )}
            {(active.skills || []).map(sk => (
              <div className="skill-row" key={sk.id}>
                <div className="skill-head">
                  <input className="gla-input sk-name" value={sk.name} placeholder="Name des Skills"
                    onChange={e => patchSkill(sk.id, { name: e.target.value })} />
                  <select className="sk-att" value={sk.att} onChange={e => patchSkill(sk.id, { att: e.target.value })} aria-label="Skill-Attribut">
                    <option value="">— Attribut —</option>
                    {ATTRIBUTES.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  {sk.att && (
                    <button className="w-btn hit" onClick={() => rollProbeFor(sk.att, `Skill — ${sk.name || "Probe"}`)} title="Probe würfeln">🎲 Probe</button>
                  )}
                  <button className="inv-del" onClick={() => delSkill(sk.id)} aria-label="Skill entfernen">✕</button>
                </div>
                <textarea className="gla-textarea sk-desc" value={sk.beschreibung} placeholder="Was bewirkt der Skill?"
                  onChange={e => patchSkill(sk.id, { beschreibung: e.target.value })} />
              </div>
            ))}
            <button className="gla-btn" style={{ marginTop: 6 }} onClick={addSkill}>+ Skill</button>

            <div className="rule" style={{ marginTop: 24 }} />
            <h3 className="sheet-title" style={{ fontSize: 24, textAlign: "left" }}>Teufelsfrucht ✦</h3>
            {(() => {
              const f = active.teufelsfrucht || { name: "", typ: "", raenge: [] };
              const bil = fruchtBilanz(active.stufe, f.raenge);
              return (
                <div className="frucht">
                  <div className="frucht-head">
                    <div style={{ flex: 2 }}>
                      <div className="field-label">Frucht</div>
                      <input className="gla-input" value={f.name} placeholder="z. B. Ito Ito no Mi"
                        onChange={e => patchFrucht({ name: e.target.value })} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="field-label">Typ</div>
                      <select className="frucht-typ" value={f.typ} onChange={e => patchFrucht({ typ: e.target.value })}>
                        <option value="">— Typ —</option>
                        <option value="Paramecia">Paramecia</option>
                        <option value="Zoan">Zoan</option>
                        <option value="Logia">Logia</option>
                      </select>
                    </div>
                  </div>

                  <div className={`frucht-budget ${bil.verfuegbar < 0 ? "over" : ""}`}>
                    {bil.verfuegbar < 0
                      ? `Überzogen um ${-bil.verfuegbar} Level — sperre einen Rang oder erhöhe die Stufe`
                      : `${bil.verfuegbar} von ${active.stufe} Leveln frei für neue Ränge`}
                  </div>

                  {(f.raenge || []).length === 0 && (
                    <p className="section-empty">Noch keine Kräfte freigeschaltet. Lege den ersten Rang an.</p>
                  )}

                  {bil.raenge.map((r, i) => (
                    <div className={`rang ${r.unlocked ? "on" : "off"}`} key={r.id}>
                      <div className="rang-head">
                        <span className="rang-no">{i + 1}</span>
                        <input className="gla-input rang-name" value={r.name} placeholder={`Rang ${i + 1} — Name der Kraft`}
                          onChange={e => patchRang(r.id, { name: e.target.value })} />
                        <label className="rang-cost">
                          Kosten
                          <NumberInput min={0} value={r.kostenLevel} onChange={(v) => patchRang(r.id, { kostenLevel: v })} />
                          Lvl
                        </label>
                        {r.unlocked ? (
                          <button className="rang-lock on" disabled={!r.canLock}
                            onClick={() => toggleRang(r.id, false)}
                            title={r.canLock ? "Wieder sperren" : "Erst höhere Ränge sperren"}>✓ Frei</button>
                        ) : (
                          <button className="rang-lock off" disabled={!r.canUnlock}
                            onClick={() => toggleRang(r.id, true)}
                            title={r.canUnlock ? "Freischalten" : "Vorherigen Rang freischalten oder Level fehlen"}>🔒 Sperre</button>
                        )}
                        <button className="inv-del" onClick={() => delRang(r.id)} aria-label="Rang entfernen">✕</button>
                      </div>

                      {r.unlocked && (
                        <div className="rang-body">
                          <textarea className="gla-textarea" value={r.beschreibung}
                            placeholder="Was gewährt dieser Rang?"
                            onChange={e => patchRang(r.id, { beschreibung: e.target.value })} />
                          <div className="rang-extras">
                            <label className="rang-field">
                              Wurf
                              <select value={r.wurfTyp} onChange={e => patchRang(r.id, { wurfTyp: e.target.value })}>
                                <option value="">— keiner —</option>
                                <option value="probe">Probe</option>
                                <option value="schaden">Schaden</option>
                              </select>
                            </label>
                            {r.wurfTyp === "probe" && (
                              <label className="rang-field">
                                Attribut
                                <select value={r.wurfAtt} onChange={e => patchRang(r.id, { wurfAtt: e.target.value })}>
                                  {ATTRIBUTES.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                              </label>
                            )}
                            {r.wurfTyp === "schaden" && (
                              <label className="rang-field">
                                Schaden
                                <input className="gla-input" style={{ width: 90 }} value={r.wurfSchaden}
                                  onChange={e => patchRang(r.id, { wurfSchaden: e.target.value })} />
                              </label>
                            )}
                            <label className="rang-field grow">
                              Kosten / Cooldown
                              <input className="gla-input" value={r.kostenText} placeholder="z. B. 2 Ausdauer, 1 Runde"
                                onChange={e => patchRang(r.id, { kostenText: e.target.value })} />
                            </label>
                            {r.wurfTyp && (
                              <button className="w-btn dmg" onClick={() => rollRang(r)}>🎲 Würfeln</button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  <button className="gla-btn" style={{ marginTop: 6 }} onClick={addRang}>+ Rang</button>
                </div>
              );
            })()}

            <div className="rule" style={{ marginTop: 24 }} />
            <h3 className="sheet-title" style={{ fontSize: 24, textAlign: "left" }}>Attribute</h3>
            <p style={{ fontStyle: "italic", fontSize: 13, marginTop: 0, color: "var(--ink-soft)" }}>
              Der Ausgleichs-Wert wird automatisch berechnet (1 → −4 … 20 → +4). „Probe“ wirft die Würfel auf den großen Tisch.
            </p>

            <div className="att-grid">
              {ATTRIBUTES.map(a => {
                const lvl = active.attribute[a];
                const mod = ausgleich(lvl);
                return (
                  <div className="att-cell" key={a}>
                    <div className="att-circle">
                      <NumberInput min={1} max={20} value={lvl} onChange={(v) => patchAtt(a, v)} ariaLabel={`${a} Level`} />
                      <span className="att-mod">{mod >= 0 ? `+${mod}` : mod}</span>
                    </div>
                    <span className="att-name">{a}</span>
                    <button className="att-roll" onClick={() => probe(a)}>Probe 🎲</button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="save-bar">
            {chars.length > 1 && <button className="gla-btn" onClick={removeChar}>Charakter löschen</button>}
            <button className="gla-btn" onClick={exportPdf}>Als PDF / drucken</button>
            <button className="gla-btn" onClick={save}>Speichern</button>
          </div>
        </div>
      )}

      {tab === "wuerfel" && (
        <div style={{ padding: "0 14px" }}>
          <div className="dice-panel">
            <div className="dice-controls">
              <div className="dc-group">
                <label htmlFor="dcount">Anzahl</label>
                <NumberInput min={1} max={12} value={count} onChange={(v) => setCount(v)} />
              </div>
              <div className="dc-group">
                <label htmlFor="dsides">Augen</label>
                <select id="dsides" value={sides} onChange={e => setSides(Number(e.target.value))}>
                  {[4, 6, 8, 10, 12, 20, 100].map(s => <option key={s} value={s}>W{s}</option>)}
                </select>
              </div>
              <div className="dc-group">
                <label htmlFor="dprobe">Probe auf</label>
                <select id="dprobe" value={probeAtt} onChange={e => setProbeAtt(e.target.value)}>
                  <option value="">— keine —</option>
                  {ATTRIBUTES.map(a => (
                    <option key={a} value={a}>
                      {a} ({ausgleich(active.attribute[a]) >= 0 ? "+" : ""}{ausgleich(active.attribute[a])})
                    </option>
                  ))}
                </select>
              </div>
              <button className="roll-btn" onClick={() => roll()}>Würfeln!</button>
            </div>
            <div className="probe-hint">Probe: 2W6 + Ausgleich · 2–6 Fehlschlag · 7–9 teilweise · 10+ geschafft</div>
          </div>

          {history.length > 0 && (
            <div className="history">
              <h3>Logbuch der letzten Würfe</h3>
              <ul>
                {history.map((h, i) => (
                  <li key={i}>
                    🎲 {h.vals.length}W{h.sides}: [{h.vals.join(", ")}] = {h.sum}
                    {h.att ? ` ${h.mod >= 0 ? "+" : ""}${h.mod} (${h.att}) → ${h.total}` : ""}
                    {h.verdict ? ` — ${VERDICT_TEXT[h.verdict]}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === "kampf" && (
        <div style={{ padding: "0 14px" }}>
          <div className="combat">
            <div className="combat-bar">
              <div className="combat-round">
                {combatActive ? `Runde ${round}` : "Kampf vorbereiten"}
              </div>
              <div className="combat-actions">
                {!combatActive ? (
                  <>
                    <button className="gla-btn" onClick={rollAllInitiative}>Alle Ini würfeln &amp; starten</button>
                    <button className="gla-btn" onClick={startCombat}>Kampf starten</button>
                  </>
                ) : (
                  <>
                    <button className="gla-btn primary" onClick={nextTurn}>Nächster ▸</button>
                    <button className="gla-btn" onClick={resetInitiative}>Ini zurücksetzen</button>
                    <button className="gla-btn" onClick={endCombat}>Kampf beenden</button>
                  </>
                )}
              </div>
            </div>

            <div className="add-row">
              <span className="add-label">Crew hinzufügen:</span>
              {chars.map(c => (
                <button key={c.id} className="add-chip" onClick={() => addFighterFromChar(c)}>
                  + {c.name || "Namenlos"}
                </button>
              ))}
              <button className="add-chip enemy" onClick={addEnemy}>+ Gegner</button>
            </div>

            {fighters.length === 0 && (
              <p className="section-empty" style={{ color: "var(--parchment)" }}>
                Noch niemand im Kampf. Füge Crew-Mitglieder oder Gegner hinzu.
              </p>
            )}

            <div className="fighter-list">
              {sortedFighters().map((f, i) => {
                const isTurn = combatActive && i === turnIdx;
                const hpPct = f.maxHp > 0 ? Math.round((f.hp / f.maxHp) * 100) : 0;
                return (
                  <div className={`fighter ${f.seite} ${f.tot ? "tot" : ""} ${isTurn ? "active-turn" : ""}`} key={f.id}>
                    <div className="fighter-ini">
                      <div className="ini-val">{f.ini == null ? "–" : f.ini}</div>
                      <button className="ini-roll" onClick={() => rollInitiativeFor(f)} title="Initiative würfeln">🎲</button>
                    </div>

                    <div className="fighter-main">
                      <div className="fighter-top">
                        {f.charId ? (
                          <span className="fighter-name">{f.name}</span>
                        ) : (
                          <input className="gla-input fighter-name-input" value={f.name} placeholder="Gegner benennen"
                            onChange={e => patchFighter(f.id, { name: e.target.value })} />
                        )}
                        <span className={`side-tag ${f.seite}`}>{f.seite === "crew" ? "Crew" : "Gegner"}</span>
                        {f.tot && <span className="dead-tag">☠ besiegt</span>}
                      </div>

                      <div className="hp-row">
                        <div className="hp-bar">
                          <div className={`hp-fill ${hpPct <= 25 ? "low" : hpPct <= 50 ? "mid" : ""}`} style={{ width: hpPct + "%" }} />
                        </div>
                        <div className="hp-num">
                          <NumberInput min={0} value={f.hp} onChange={(v) => patchFighter(f.id, { hp: v, tot: v <= 0 })} />
                          <span className="hp-sep">/</span>
                          <NumberInput min={1} value={f.maxHp} onChange={(v) => patchFighter(f.id, { maxHp: v })} />
                        </div>
                      </div>

                      <div className="dmg-controls">
                        <button onClick={() => damageFighter(f.id, -5)}>−5</button>
                        <button onClick={() => damageFighter(f.id, -1)}>−1</button>
                        <button onClick={() => damageFighter(f.id, +1)}>+1</button>
                        <button onClick={() => damageFighter(f.id, +5)}>+5</button>
                        {!f.charId && (
                          <label className="ini-mod-field">
                            Ini-Mod
                            <NumberInput value={f.iniMod || 0} onChange={(v) => patchFighter(f.id, { iniMod: v })} />
                          </label>
                        )}
                        {f.charId && (
                          <select className="ini-att-sel" value={f.iniAtt}
                            onChange={e => patchFighter(f.id, { iniAtt: e.target.value })} title="Initiative-Attribut">
                            {ATTRIBUTES.map(a => <option key={a} value={a}>{a}</option>)}
                          </select>
                        )}
                        <button className="fighter-del" onClick={() => delFighter(f.id)} aria-label="Entfernen">✕</button>
                      </div>

                      {f.charId ? (
                        (() => {
                          const ws = fighterWeapons(f);
                          if (!ws.length) return (
                            <div className="atk-row empty">Keine Waffen — auf dem Charakterbogen anlegen</div>
                          );
                          return (
                            <div className="atk-row">
                              {ws.map(w => (
                                <span className="atk-weapon" key={w.id}>
                                  <span className="atk-wname">{w.name || "Waffe"}</span>
                                  <button className="atk-btn hit" onClick={() => fighterAttack(f, w)} title={`Treffer (${w.att})`}>⚔</button>
                                  <button className="atk-btn dmg" onClick={() => fighterDamage(f, w)} title={`Schaden (${w.schaden})`}>🎲</button>
                                </span>
                              ))}
                            </div>
                          );
                        })()
                      ) : (
                        <div className="atk-row">
                          <span className="atk-weapon">
                            <button className="atk-btn hit" onClick={() => enemyAttack(f)} title="Angriff (2W6 + Bonus)">⚔ Angriff</button>
                            <label className="atk-mini">+<NumberInput value={f.atkMod || 0} onChange={(v) => patchFighter(f.id, { atkMod: v })} /></label>
                            <button className="atk-btn dmg" onClick={() => enemyDamage(f)} title="Schaden">🎲 Schaden</button>
                            <input className="gla-input atk-dmg-input" value={f.atkDmg || ""} placeholder="W6"
                              onChange={e => patchFighter(f.id, { atkDmg: e.target.value })} aria-label="Gegner-Schaden" />
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === "karte" && (
        <div style={{ padding: "0 14px" }}>
          <div className="map-panel">
            <div className="map-toolbar">
              <label className="map-btn upload">
                🖼 Bild laden
                <input type="file" accept="image/*" onChange={onMapUpload} style={{ display: "none" }} />
              </label>
              {mapBg && <button className="map-btn" onClick={clearMapBg}>Bild entfernen</button>}
              <button className={`map-btn ${gridOn ? "on" : ""}`} onClick={() => setGridOn(g => !g)}>
                {gridOn ? "▦ Raster an" : "▦ Raster aus"}
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
              {tokens.length > 0 && <button className="map-btn" onClick={clearTokens}>Marker leeren</button>}
              <button className="map-btn save" onClick={saveMap}>Karte speichern</button>
            </div>

            <div
              className={`map-view ${gridOn ? "grid" : ""} ${mapBg ? "has-bg" : "sea"}`}
              ref={mapViewRef}
              style={mapBg ? { backgroundImage: `url(${mapBg})` } : undefined}
              onPointerMove={tokenPointerMove}
              onPointerUp={tokenPointerUp}
              onPointerCancel={tokenPointerUp}
            >
              {!mapBg && tokens.length === 0 && (
                <div className="map-hint">Lade ein Kartenbild oder nutze das Seekarten-Raster.<br />Figuren oben hinzufügen und frei verschieben.</div>
              )}
              {tokens.map(t => (
                <div
                  key={t.id}
                  className={`token ${t.kind}`}
                  style={{ left: t.x + "%", top: t.y + "%", "--tok": t.color }}
                  onPointerDown={e => tokenPointerDown(e, t)}
                  onPointerMove={tokenPointerMove}
                  onPointerUp={tokenPointerUp}
                >
                  <span className="token-dot" />
                  <span className="token-label">{t.label || (t.kind === "crew" ? "Crew" : t.kind)}</span>
                  <button className="token-x" onPointerDown={e => e.stopPropagation()} onClick={() => delToken(t.id)} aria-label="Marker entfernen">✕</button>
                </div>
              ))}
            </div>

            {tokens.length > 0 && (
              <div className="token-editor">
                <h3 className="token-editor-title">Marker beschriften</h3>
                {tokens.map(t => (
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
      )}

      {tab === "zeichnen" && (
        <div style={{ padding: "0 14px" }}>
          <div className="draw-panel">
            <div className="draw-tools">
              <div className="tool-group">
                <span className="tool-label">Malen:</span>
                {["gruen", "wald", "strand", "wasser", "fels", "weg"].map(t => (
                  <button key={t}
                    className={`terr-btn ${drawMode !== "gebaeude" && drawMode !== "radierer" && drawTerrain === t ? "on" : ""}`}
                    style={{ "--terr": TERRAIN_COLORS[t] }}
                    onClick={() => { setDrawMode("terrain"); setDrawTerrain(t); }}>
                    <span className="terr-swatch" />{TERRAIN_LABELS[t]}
                  </button>
                ))}
                <button className={`terr-btn eraser ${drawMode === "radierer" ? "on" : ""}`}
                  onClick={() => setDrawMode("radierer")}>◌ Radierer</button>
              </div>

              <div className="tool-group">
                <span className="tool-label">Pinsel:</span>
                {[1, 2, 3, 5].map(b => (
                  <button key={b} className={`brush-btn ${drawBrush === b ? "on" : ""}`}
                    onClick={() => setDrawBrush(b)}>{b}</button>
                ))}
              </div>

              <div className="tool-group">
                <span className="tool-label">Bauwerke:</span>
                {Object.entries(BUILDINGS).map(([k, b]) => (
                  <button key={k}
                    className={`bld-btn ${drawMode === "gebaeude" && drawTerrain === k ? "on" : ""}`}
                    onClick={() => pickBuilding(k)} title={b.label}>{b.icon}</button>
                ))}
              </div>
            </div>

            <div className="draw-stage">
              <canvas
                ref={drawCanvasRef}
                className="draw-canvas"
                onPointerDown={drawPointerDown}
                onPointerMove={drawPointerMove}
                onPointerUp={drawPointerUp}
                onPointerLeave={drawPointerUp}
                onPointerCancel={drawPointerUp}
              />
              {drawBuildings.map(b => (
                <div key={b.id} className="bld-marker" style={{ left: b.x + "%", top: b.y + "%" }}>
                  <span className="bld-icon">{(BUILDINGS[b.kind] || BUILDINGS.haus).icon}</span>
                  <button className="bld-del" onClick={() => delBuilding(b.id)} aria-label="Bauwerk entfernen">✕</button>
                </div>
              ))}
            </div>

            <div className="draw-actions">
              <span className="draw-mode-hint">
                {drawMode === "gebaeude"
                  ? `Tippe auf die Karte, um „${(BUILDINGS[drawTerrain] || {}).label || "Bauwerk"}“ zu setzen`
                  : drawMode === "radierer"
                    ? "Übermalt alles wieder mit Wasser"
                    : `Zeichnet ${TERRAIN_LABELS[drawTerrain]} — ziehen zum Malen`}
              </span>
              <span style={{ flex: 1 }} />
              <button className="gla-btn" onClick={clearDrawing}>Leeren</button>
              <button className="gla-btn" onClick={saveDrawing}>Speichern</button>
              <button className="gla-btn primary" onClick={useDrawingAsMap}>Als Karte übernehmen →</button>
            </div>
          </div>
        </div>
      )}

      {tab === "detail" && (
        <div style={{ padding: "0 14px" }}>
          <div className="det-panel">
            <div className="det-tools">
              <div className="tool-group">
                <span className="tool-label">Werkzeug:</span>
                <button className={`det-tbtn ${detTool === "rect" ? "on" : ""}`} onClick={() => setDetTool("rect")} title="Rechteck-Raum">▭ Raum</button>
                <button className={`det-tbtn ${detTool === "circle" ? "on" : ""}`} onClick={() => setDetTool("circle")} title="Runder Raum">◯ Rund</button>
                <button className={`det-tbtn ${detTool === "wall" ? "on" : ""}`} onClick={() => setDetTool("wall")} title="Wand ziehen">▬ Wand</button>
                <button className={`det-tbtn ${detTool === "door" ? "on" : ""}`} onClick={() => setDetTool("door")} title="Tür ziehen">╫ Tür</button>
                <button className={`det-tbtn ${detTool === "label" ? "on" : ""}`} onClick={() => setDetTool("label")} title="Text setzen">T Text</button>
                <button className={`det-tbtn ${detTool === "select" ? "on" : ""}`} onClick={() => setDetTool("select")} title="Verschieben">✋ Wählen</button>
              </div>

              <div className="tool-group">
                <span className="tool-label">Boden:</span>
                {Object.keys(DET_FLOORS).map(f => (
                  <button key={f} className={`terr-btn ${detFloor === f ? "on" : ""}`}
                    style={{ "--terr": DET_FLOORS[f] }} onClick={() => setDetFloor(f)}>
                    <span className="terr-swatch" />{DET_FLOOR_LABELS[f]}
                  </button>
                ))}
                <span className="map-sep" />
                <span className="tool-label" style={{ minWidth: "auto" }}>Grund:</span>
                <select className="det-bg-sel" value={detBg} onChange={e => setDetBg(e.target.value)}>
                  {Object.keys(DET_FLOORS).map(f => <option key={f} value={f}>{DET_FLOOR_LABELS[f]}</option>)}
                </select>
                <button className={`det-tbtn ${detSnap ? "on" : ""}`} onClick={() => setDetSnap(v => !v)} title="Am Raster fangen">⊞ Raster-Fang</button>
              </div>
            </div>

            <div className="det-stage">
              <svg
                ref={detSvgRef}
                className="det-svg"
                viewBox="0 0 100 66"
                preserveAspectRatio="none"
                onPointerDown={detPointerDown}
                onPointerMove={detPointerMove}
                onPointerUp={detPointerUp}
                onPointerLeave={detPointerUp}
                onPointerCancel={detPointerUp}
                style={{ touchAction: "none", cursor: detTool === "select" ? "grab" : "crosshair" }}
              >
                {/* Grundboden */}
                <rect x="0" y="0" width="100" height="66" fill={DET_FLOORS[detBg]} />
                {/* Kampfraster */}
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

                {/* Objekte */}
                {detObjects.map(o => {
                  if (o.type === "rect") return (
                    <rect key={o.id} x={o.x} y={o.y} width={o.w} height={o.h}
                      fill={DET_FLOORS[o.terr]} stroke="rgba(0,0,0,.35)" strokeWidth="0.25"
                      onDoubleClick={() => detDelete(o.id)} style={{ cursor: detTool === "select" ? "grab" : "inherit" }} />
                  );
                  if (o.type === "circle") return (
                    <ellipse key={o.id} cx={o.cx} cy={o.cy} rx={o.rx} ry={o.ry}
                      fill={DET_FLOORS[o.terr]} stroke="rgba(0,0,0,.35)" strokeWidth="0.25"
                      onDoubleClick={() => detDelete(o.id)} style={{ cursor: detTool === "select" ? "grab" : "inherit" }} />
                  );
                  if (o.type === "wall") return (
                    <line key={o.id} x1={o.x1} y1={o.y1} x2={o.x2} y2={o.y2}
                      stroke={o.door ? "#b8862b" : "#2b2014"} strokeWidth={o.door ? 1.4 : 1.1}
                      strokeLinecap="round" strokeDasharray={o.door ? "2 1.4" : "none"}
                      onDoubleClick={() => detDelete(o.id)} />
                  );
                  if (o.type === "label") return (
                    <text key={o.id} x={o.x} y={o.y} className="det-label-text"
                      textAnchor="middle" dominantBaseline="middle"
                      onDoubleClick={() => detEditLabel(o)}
                      style={{ cursor: detTool === "select" ? "grab" : "pointer" }}>{o.text}</text>
                  );
                  return null;
                })}

                {/* Live-Vorschau beim Ziehen */}
                {detDraft && detDraft.tool === "rect" && (
                  <rect className="det-draft" x={Math.min(detDraft.x1, detDraft.x2)} y={Math.min(detDraft.y1, detDraft.y2)}
                    width={Math.abs(detDraft.x2 - detDraft.x1)} height={Math.abs(detDraft.y2 - detDraft.y1)}
                    fill={DET_FLOORS[detFloor]} opacity="0.6" stroke="#000" strokeWidth="0.3" strokeDasharray="1 1" />
                )}
                {detDraft && detDraft.tool === "circle" && (
                  <ellipse className="det-draft" cx={(detDraft.x1 + detDraft.x2) / 2} cy={(detDraft.y1 + detDraft.y2) / 2}
                    rx={Math.abs(detDraft.x2 - detDraft.x1) / 2} ry={Math.abs(detDraft.y2 - detDraft.y1) / 2}
                    fill={DET_FLOORS[detFloor]} opacity="0.6" stroke="#000" strokeWidth="0.3" strokeDasharray="1 1" />
                )}
                {detDraft && (detDraft.tool === "wall" || detDraft.tool === "door") && (
                  <line className="det-draft" x1={detDraft.x1} y1={detDraft.y1} x2={detDraft.x2} y2={detDraft.y2}
                    stroke={detDraft.tool === "door" ? "#b8862b" : "#2b2014"} strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
                )}
              </svg>
            </div>

            <div className="det-actions">
              <span className="draw-mode-hint">
                {detTool === "select" ? "Objekt greifen und verschieben · Doppelklick löscht"
                  : detTool === "label" ? "Auf die Karte tippen, um Text zu setzen"
                  : detTool === "wall" ? "Wand ziehen · Doppelklick auf eine Wand löscht sie"
                  : detTool === "door" ? "Tür ziehen (Lücke in der Wand)"
                  : `${detTool === "circle" ? "Runden" : "Rechteckigen"} Raum aufziehen (${DET_FLOOR_LABELS[detFloor]})`}
              </span>
              <span style={{ flex: 1 }} />
              <button className="gla-btn" onClick={detUndo}>↶ Rückgängig</button>
              <button className="gla-btn" onClick={detClear}>Leeren</button>
              <button className="gla-btn" onClick={detSave}>Speichern</button>
              <button className="gla-btn primary" onClick={detUseAsMap}>Als Karte übernehmen →</button>
            </div>
          </div>
        </div>
      )}

      {tab === "notizen" && (
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
                  {sortedQuests().map(q => (
                    <div className={`quest ${q.erledigt ? "done" : ""}`} key={q.id}>
                      <button className="quest-check" onClick={() => toggleQuest(q.id)}
                        aria-label={q.erledigt ? "Als offen markieren" : "Als erledigt markieren"}>
                        {q.erledigt ? "☑" : "☐"}
                      </button>
                      <div className="quest-body">
                        <input className="quest-title" value={q.titel}
                          onChange={e => patchQuest(q.id, { titel: e.target.value })} />
                        <textarea className="quest-notiz" value={q.notiz} placeholder="Details, Hinweise, Belohnung…"
                          onChange={e => patchQuest(q.id, { notiz: e.target.value })} />
                      </div>
                      <button className="quest-del" onClick={() => delQuest(q.id)} aria-label="Quest löschen">✕</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="notes-col">
                <h3 className="sheet-title" style={{ margin: "0 0 8px", textAlign: "left", fontSize: 22 }}>Notizen</h3>
                <textarea className="notes-area" value={notizen}
                  placeholder="Freie Notizen der Spielleitung: NPCs, Geheimnisse, lose Fäden, Weltgeschehen…"
                  onChange={e => setNotizen(e.target.value)} />
              </div>
            </div>

            <div className="save-bar" style={{ marginTop: 14 }}>
              <button className="gla-btn" onClick={saveNotes}>Logbuch speichern</button>
            </div>
          </div>
        </div>
      )}

      {tab === "crew" && (
        <div style={{ padding: "0 14px" }}>
          <div className="crew-panel">
            {/* Crew- & Schiffsbogen */}
            <div className="crew-sheet">
              <div className="crew-flag">
                {crew.jollyRoger ? (
                  <img src={crew.jollyRoger} alt="Jolly Roger" className="jolly-img" />
                ) : (
                  <div className="jolly-empty">☠</div>
                )}
                <label className="gla-btn crew-upload">
                  Flagge laden
                  <input type="file" accept="image/*" onChange={onJollyUpload} style={{ display: "none" }} />
                </label>
                {crew.jollyRoger && <button className="gla-btn" onClick={() => patchCrew({ jollyRoger: null })}>Entfernen</button>}
              </div>
              <div className="crew-info">
                <label className="crew-field">
                  <span className="field-label">Name der Bande</span>
                  <input className="gla-input crew-name" value={crew.name} placeholder="z. B. Strohhut-Piraten"
                    onChange={e => patchCrew({ name: e.target.value })} />
                </label>
                <label className="crew-field">
                  <span className="field-label">Schiff</span>
                  <input className="gla-input" value={crew.schiffName} placeholder="z. B. Thousand Sunny"
                    onChange={e => patchCrew({ schiffName: e.target.value })} />
                </label>
                <label className="crew-field">
                  <span className="field-label">Schiffsbeschreibung</span>
                  <textarea className="gla-textarea" value={crew.schiffBeschreibung}
                    placeholder="Bauart, Besonderheiten, Bewaffnung…"
                    onChange={e => patchCrew({ schiffBeschreibung: e.target.value })} />
                </label>
                <label className="crew-field">
                  <span className="field-label">Flotte / Zugehörigkeit</span>
                  <input className="gla-input" value={crew.flotte} placeholder="optional — z. B. Große Flotte"
                    onChange={e => patchCrew({ flotte: e.target.value })} />
                </label>
              </div>
            </div>

            {/* Gesamtkopfgeld */}
            <div className="bounty-total">
              Gesamtkopfgeld der Bande:
              <span className="bounty-sum">
                <span className="berry-sym">฿</span>{formatBerry(chars.reduce((a, c) => a + (Number(c.kopfgeld) || 0), 0))}
              </span>
            </div>

            {/* WANTED-Steckbriefe */}
            <div className="wanted-grid">
              {chars.map(c => (
                <div className="wanted" key={c.id}>
                  <div className="wanted-head">WANTED</div>
                  <div className="wanted-sub">DEAD OR ALIVE</div>
                  <div className="wanted-photo">
                    {c.portrait ? (
                      <img src={c.portrait} alt={c.name} />
                    ) : (
                      <div className="wanted-photo-empty">?</div>
                    )}
                    <label className="wanted-upload" title="Porträt laden">
                      📷
                      <input type="file" accept="image/*"
                        onChange={(e) => { if (activeId !== c.id) setActiveId(c.id); onPortraitUpload(e); }}
                        style={{ display: "none" }} />
                    </label>
                  </div>
                  <input className="wanted-name" value={c.name} placeholder="Name"
                    onChange={e => setChars(cs => cs.map(x => x.id === c.id ? { ...x, name: e.target.value } : x))} />
                  <input className="wanted-epitheton" value={c.epitheton || ""} placeholder="„Beiname“"
                    onChange={e => setChars(cs => cs.map(x => x.id === c.id ? { ...x, epitheton: e.target.value } : x))} />
                  <div className="wanted-bounty">
                    <span className="berry-sym">฿</span>
                    <NumberInput className="wanted-bounty-input" min={0} value={c.kopfgeld || 0}
                      onChange={(v) => setChars(cs => cs.map(x => x.id === c.id ? { ...x, kopfgeld: v } : x))} />
                  </div>
                  <div className="wanted-bounty-fmt">{formatBerry(c.kopfgeld)} Berry</div>
                  <div className="wanted-marine">☠ MARINE ☠</div>
                </div>
              ))}
            </div>

            <div className="save-bar" style={{ marginTop: 14 }}>
              <button className="gla-btn" onClick={saveCrew}>Steckbriefe & Crew speichern</button>
            </div>
          </div>
        </div>
      )}

      {/* ============ Fullscreen-Würfeltisch ============ */}
      {throwSpec && (
        <div className="table-overlay" role="dialog" aria-label="Würfeltisch">
          <div className="table-label">
            {throwSpec.label
              ? throwSpec.label
              : throwSpec.att ? `Probe auf ${throwSpec.att}` : `${throwSpec.count}W${throwSpec.sides}`}
            {throwSpec.groups && throwSpec.groups.length > 1 && (
              <span className="table-sub"> · Wurf {(throwSpec.groupIndex || 0) + 1}/{throwSpec.groups.length}</span>
            )}
            <div className="table-hint">Würfel lassen sich anstupsen — das Ergebnis bleibt bestehen</div>
          </div>
          <button className="table-close" onClick={closeTable}>✕ Schließen</button>

          <PhysicsTable
            key={throwSpec.id}
            count={throwSpec.count}
            sides={throwSpec.sides}
            onSettled={handleSettled}
          />

          {result && (
            <div className="result-panel">
              <div className="sum-line">
                {result.vals.join(" + ")} = {result.sum}
                {result.att && (
                  <span className="mod"> {ausgleich(active.attribute[result.att]) >= 0 ? "+" : "−"} {Math.abs(ausgleich(active.attribute[result.att]))} ({result.att})</span>
                )}
                {result.flat ? (
                  <span className="mod"> {result.flat >= 0 ? "+" : "−"} {Math.abs(result.flat)} Bonus</span>
                ) : null}
                {(result.att || result.flat) ? <span className="mod"> → {result.total}</span> : null}
              </div>
              {result.kind === "schaden" && (
                <div className="dmg-total">{result.total} Schaden</div>
              )}
              {result.verdict && (
                <div><div className={`stamp ${result.verdict}`}>{VERDICT_TEXT[result.verdict]}</div></div>
              )}
              <div className="panel-btns">
                <button className="roll-btn" onClick={rerollCurrent}>
                  Nochmal werfen
                </button>
                <button className="ghost" onClick={closeTable}>Fertig</button>
              </div>
            </div>
          )}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
