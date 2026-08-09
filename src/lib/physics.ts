/* ============================================================
   Starrkörper-Mathematik für konvexe Polyeder.
   Jeder Würfeltyp wird aus seiner Eckenliste aufgebaut: Flächen,
   Volumen und Trägheitstensor werden berechnet, nicht gesetzt.
   Die platonischen Körper haben einen isotropen Tensor, der W10
   (pentagonales Trapezoeder) nicht — deshalb wird die Trägheit
   allgemein behandelt und pro Schritt ins Weltsystem gedreht.

   1:1 aus dem Prototyp übernommen, nur typisiert.
   ============================================================ */

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
/** Rotationsmatrix, zeilenweise mit 9 Einträgen. */
export type Mat3 = number[];
/** 3×3-Matrix als Zeilen-Array (für Trägheitstensoren). */
export type Mat33 = number[][];

export const DIE_A = 72;            // Bezugsgröße: Kante eines W6
export const GRAV = 2600;           // px/s²
export const RESTITUTION = 0.2;     // Sprungkraft
export const FRICTION = 0.4;        // Coulomb-Reibung
export const SLOP = 0.1;
export const BAUM = 0.45;
export const RESTV = 70;

/* ---------- Quaternionen & Vektoren ---------- */

export function qMul(a: Quat, b: Quat): Quat {
  return [
    a[0]*b[0] - a[1]*b[1] - a[2]*b[2] - a[3]*b[3],
    a[0]*b[1] + a[1]*b[0] + a[2]*b[3] - a[3]*b[2],
    a[0]*b[2] - a[1]*b[3] + a[2]*b[0] + a[3]*b[1],
    a[0]*b[3] + a[1]*b[2] - a[2]*b[1] + a[3]*b[0],
  ];
}

export function qNorm(q: Quat): Quat {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0]/l, q[1]/l, q[2]/l, q[3]/l];
}

export function qToM(q: Quat): Mat3 {
  const [w, x, y, z] = q;
  return [
    1-2*(y*y+z*z), 2*(x*y-w*z),   2*(x*z+w*y),
    2*(x*y+w*z),   1-2*(x*x+z*z), 2*(y*z-w*x),
    2*(x*z-w*y),   2*(y*z+w*x),   1-2*(x*x+y*y),
  ];
}

export function mRot(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0]*v[0]+m[1]*v[1]+m[2]*v[2],
    m[3]*v[0]+m[4]*v[1]+m[5]*v[2],
    m[6]*v[0]+m[7]*v[1]+m[8]*v[2],
  ];
}

export function mRotT(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0]*v[0]+m[3]*v[1]+m[6]*v[2],
    m[1]*v[0]+m[4]*v[1]+m[7]*v[2],
    m[2]*v[0]+m[5]*v[1]+m[8]*v[2],
  ];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}

export function dot3(a: Vec3, b: Vec3): number {
  return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
}

export function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
}

export function norm3(a: Vec3): Vec3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0]/l, a[1]/l, a[2]/l];
}

/** Gleichverteilte zufällige Orientierung. */
export function randQ(): Quat {
  const u = Math.random(), v = Math.random(), w = Math.random();
  return qNorm([
    Math.sqrt(1-u)*Math.sin(2*Math.PI*v), Math.sqrt(1-u)*Math.cos(2*Math.PI*v),
    Math.sqrt(u)*Math.sin(2*Math.PI*w),   Math.sqrt(u)*Math.cos(2*Math.PI*w),
  ]);
}

export function qAngle(a: Quat, b: Quat): number {
  const d = Math.min(1, Math.abs(a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3]));
  return 2 * Math.acos(d);
}

export function mToCss(m: Mat3): string {
  return `matrix3d(${m[0]},${m[3]},${m[6]},0,${m[1]},${m[4]},${m[7]},0,${m[2]},${m[5]},${m[8]},0,0,0,0,1)`;
}

/* ---------- Flächen aus einer Eckenliste (konvexe Hülle) ---------- */

export interface Flaeche {
  n: Vec3;
  d: number;
  idx: number[];
  c: Vec3;
  u: Vec3;
  v: Vec3;
}

export function facesFromVerts(V: Vec3[]): Flaeche[] {
  const n = V.length;
  const faces: Flaeche[] = [];
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
    const idx: number[] = [];
    for (let m = 0; m < n; m++) if (Math.abs(dot3(nrm, V[m]) - d) < 1e-4) idx.push(m);
    if (idx.length < 3) continue;
    const c: Vec3 = [0, 0, 0];
    idx.forEach(m => { c[0] += V[m][0]; c[1] += V[m][1]; c[2] += V[m][2]; });
    c[0] /= idx.length; c[1] /= idx.length; c[2] /= idx.length;
    const u = norm3(sub3(V[idx[0]], c));
    const v = cross(nrm, u);
    idx.sort((a, b) =>
      Math.atan2(dot3(sub3(V[a], c), v), dot3(sub3(V[a], c), u)) -
      Math.atan2(dot3(sub3(V[b], c), v), dot3(sub3(V[b], c), u)));
    faces.push({ n: nrm, d, idx, c, u, v });
  }
  return faces;
}

/* ---------- Volumen, Schwerpunkt und Trägheitstensor (Dichte 1) ---------- */

export function inertiaOf(V: Vec3[], faces: Flaeche[]): { vol: number; com: Vec3; I: Mat33 } {
  const S = [[2,1,1],[1,2,1],[1,1,2]].map(r => r.map(x => x/120));
  let vol = 0;
  const C: Mat33 = [[0,0,0],[0,0,0],[0,0,0]];
  const com: Vec3 = [0, 0, 0];
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
  const I: Mat33 = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) I[i][j] = (i === j ? tr : 0) - C[i][j];
  return { vol, com, I };
}

export function inv3(M: Mat33): Mat33 {
  const d = M[0][0]*(M[1][1]*M[2][2]-M[1][2]*M[2][1])
          - M[0][1]*(M[1][0]*M[2][2]-M[1][2]*M[2][0])
          + M[0][2]*(M[1][0]*M[2][1]-M[1][1]*M[2][0]);
  const cof = (a: number, b: number) =>
    M[(a+1)%3][(b+1)%3]*M[(a+2)%3][(b+2)%3] - M[(a+1)%3][(b+2)%3]*M[(a+2)%3][(b+1)%3];
  const R: Mat33 = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R[i][j] = cof(j, i)/d;
  return R;
}

/** Trägheit im Weltsystem: I⁻¹ᵥᵥ = R · I⁻¹ᵦ · Rᵀ */
export function iinvWorld(m: Mat3, Ib: Mat33): Mat33 {
  const R = [[m[0],m[1],m[2]],[m[3],m[4],m[5]],[m[6],m[7],m[8]]];
  const T: Mat33 = [[0,0,0],[0,0,0],[0,0,0]];
  const O: Mat33 = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    let s = 0; for (let k = 0; k < 3; k++) s += R[i][k]*Ib[k][j]; T[i][j] = s;
  }
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    let s = 0; for (let k = 0; k < 3; k++) s += T[i][k]*R[j][k]; O[i][j] = s;
  }
  return O;
}

export function applyI(Iw: Mat33, v: Vec3): Vec3 {
  return [
    Iw[0][0]*v[0]+Iw[0][1]*v[1]+Iw[0][2]*v[2],
    Iw[1][0]*v[0]+Iw[1][1]*v[1]+Iw[1][2]*v[2],
    Iw[2][0]*v[0]+Iw[2][1]*v[1]+Iw[2][2]*v[2],
  ];
}

/* ---------- Eckenlisten der Würfelformen ---------- */

const PHI = (1 + Math.sqrt(5)) / 2;

export function vertsFor(sides: number): Vec3[] {
  if (sides === 4) return [[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]];
  if (sides === 6) {
    const v: Vec3[] = [];
    for (const a of [-1,1]) for (const b of [-1,1]) for (const c of [-1,1]) v.push([a,b,c]);
    return v;
  }
  if (sides === 8) return [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  if (sides === 12) {
    const v: Vec3[] = [];
    for (const a of [-1,1]) for (const b of [-1,1]) for (const c of [-1,1]) v.push([a,b,c]);
    for (const s1 of [-1,1]) for (const s2 of [-1,1]) {
      v.push([0, s1/PHI, s2*PHI]); v.push([s1/PHI, s2*PHI, 0]); v.push([s1*PHI, 0, s2/PHI]);
    }
    return v;
  }
  if (sides === 20) {
    const v: Vec3[] = [];
    for (const s1 of [-1,1]) for (const s2 of [-1,1]) {
      v.push([0, s1, s2*PHI]); v.push([s1, s2*PHI, 0]); v.push([s1*PHI, 0, s2]);
    }
    return v;
  }
  // W10/W100: pentagonales Trapezoeder als Polardual des Antiprismas
  const anti: Vec3[] = [];
  for (let k = 0; k < 5; k++) {
    const a = (2*Math.PI*k)/5;
    anti.push([Math.cos(a), Math.sin(a), 0.5]);
  }
  for (let k = 0; k < 5; k++) {
    const a = (2*Math.PI*k)/5 + Math.PI/5;
    anti.push([Math.cos(a), Math.sin(a), -0.5]);
  }
  return facesFromVerts(anti).map(f => [f.n[0]/f.d, f.n[1]/f.d, f.n[2]/f.d] as Vec3);
}

/* ---------- Fertige Würfelform inkl. Werteverteilung ---------- */

export interface Form {
  V: Vec3[];
  F: Flaeche[];
  values: number[];
  Iinv: Mat33;
  R: number;
  sides: number;
}

const FORMEN: Record<number, Form> = {};

export function shapeFor(sides: number): Form {
  const vorhanden = FORMEN[sides];
  if (vorhanden) return vorhanden;
  const geoSides = sides === 100 ? 10 : sides;
  let V = vertsFor(geoSides);
  const R0 = Math.max(...V.map(p => Math.hypot(p[0], p[1], p[2])));
  const s = (DIE_A * Math.sqrt(3) / 2) / R0;      // gleicher Umkreis wie ein W6
  V = V.map(p => [p[0]*s, p[1]*s, p[2]*s] as Vec3);
  let F = facesFromVerts(V);
  const { com } = inertiaOf(V, F);
  V = V.map(p => [p[0]-com[0], p[1]-com[1], p[2]-com[2]] as Vec3);
  F = facesFromVerts(V);
  const { vol, I } = inertiaOf(V, F);
  const dens = 1 / vol;                           // Masse = 1
  const Im = I.map(r => r.map(x => x*dens));
  // Werte verteilen: gegenüberliegende Flächen ergänzen sich zu n+1
  const n = F.length;
  const values = new Array<number>(n).fill(0);
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
  const sh: Form = {
    V, F, values, Iinv: inv3(Im),
    R: Math.max(...V.map(p => Math.hypot(p[0], p[1], p[2]))),
    sides,
  };
  FORMEN[sides] = sh;
  return sh;
}

/** Beschriftung einer Fläche. */
export function faceLabel(sh: Form, i: number): string {
  const v = sh.values[i];
  if (sh.sides === 10) return String(v % 10);
  if (sh.sides === 100) return String((v % 10) * 10).padStart(2, "0");
  return String(v);
}

/* ---------- Ein Würfel in der Simulation ---------- */

export interface Koerper {
  sides: number;
  sh: Form;
  p: Vec3;
  v: Vec3;
  q: Quat;
  m: Mat3;
  w: Vec3;
  live: boolean;
  asleep: boolean;
  drag: boolean;
  sleepT: number;
  qRef: Quat;
  bumps: number;
  delay: number;
  value: number;
  grab?: [number, number];
  el: HTMLDivElement | null;
  shadowEl: HTMLDivElement | null;
  ctx: CanvasRenderingContext2D | null;
}

/** Welche Fläche zeigt zur Kamera? Beim W4 wird unten abgelesen. */
export function readFace(b: Koerper): number {
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

/** 1.0 = eine Fläche liegt exakt flach auf dem Tisch. */
export function flatness(b: Koerper): number {
  let best = -1;
  for (const f of b.sh.F) {
    const nz = -(b.m[6]*f.n[0] + b.m[7]*f.n[1] + b.m[8]*f.n[2]);
    if (nz > best) best = nz;
  }
  return best;
}
