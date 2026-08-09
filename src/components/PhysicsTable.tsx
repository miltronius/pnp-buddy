/* ============================================================
   PhysicsTable — echte Starrkörpersimulation.
   Jeder Würfel ist ein konvexes Polyeder mit Masse, Trägheits-
   tensor und Drehimpuls. Kontakte an Ecken erzeugen Normal- und
   Reibungsimpulse am Berührpunkt; der Hebelarm zum Schwerpunkt
   liefert den Drehimpuls, der einen schief gelandeten Würfel von
   selbst auf eine Fläche kippt. Die Augenzahl entsteht aus der
   Fläche, die am Ende zur Kamera zeigt — nichts wird vorgegeben.

   1:1 aus dem Prototyp übernommen, nur typisiert.
   ============================================================ */

import { useEffect, useRef } from "react";
import {
  BAUM, DIE_A, FRICTION, GRAV, RESTITUTION, RESTV, SLOP,
  applyI, cross, dot3, faceLabel, flatness, iinvWorld,
  mRot, mRotT, mToCss, norm3, qAngle, qMul, qNorm, qToM, randQ, readFace, shapeFor,
  type Form, type Koerper, type Mat33, type Quat, type Vec3,
} from "../lib/physics";

/* ---------- Würfel-Optik (W6 als CSS-Würfel mit Augen) ---------- */

const PIP_LAYOUT: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

function Face({ value, transform }: { value: number; transform: string }) {
  const layout = PIP_LAYOUT[value] ?? [];
  return (
    <div className="die-face" style={{ transform }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className="pip" style={{ visibility: layout.includes(i) ? "visible" : "hidden" }} />
      ))}
    </div>
  );
}

// Die sechs Flächen des CSS-Würfels und ihre Richtung im Körpersystem.
// Die Augenzahl wird aus derselben Geometrie geholt, aus der die Physik
// später abliest — sonst zeigt der Würfel etwas anderes an, als gewertet wird.
const CUBE_DIRS: { d: Vec3; t: string }[] = [
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

interface Props {
  count: number;
  sides: number;
  onSettled: (werte: number[]) => void;
}

export function PhysicsTable({ count, sides, onSettled }: Props) {
  const areaRef = useRef<HTMLDivElement | null>(null);
  const elsRef = useRef<(HTMLDivElement | null)[]>([]);
  const shadowsRef = useRef<(HTMLDivElement | null)[]>([]);
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
    const reduced = typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---------- Körper erzeugen und werfen ---------- */
    const bodies: Koerper[] = Array.from({ length: count }, (_, i) => {
      const fromLeft = Math.random() < 0.5;
      const q = randQ();
      return {
        sides, sh: shape,
        p: [
          W * 0.5 + (Math.random() - 0.5) * W * 0.3 + (fromLeft ? -W * 0.16 : W * 0.16),
          H + 80 + Math.random() * 70,
          150 + Math.random() * 140,
        ] as Vec3,
        v: [
          (fromLeft ? 1 : -1) * (Math.random() * 300 - 60),
          -(700 + Math.random() * 420),
          120 + Math.random() * 140,
        ] as Vec3,
        q, m: qToM(q),
        w: [(Math.random() - 0.5) * 26, (Math.random() - 0.5) * 26, (Math.random() - 0.5) * 18] as Vec3,
        live: false, asleep: false, drag: false,
        sleepT: 0, qRef: q.slice() as Quat, bumps: 0,
        delay: i * 0.09 + Math.random() * 0.05,
        value: 1, el: null, shadowEl: null, ctx: null,
      };
    });

    const CAN = Math.ceil(shape.R * 2 + 26);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    bodies.forEach((b, i) => {
      b.el = elsRef.current[i] ?? null;
      b.shadowEl = shadowsRef.current[i] ?? null;
      if (!isCube && b.el) {
        const cv = b.el.firstChild as HTMLCanvasElement | null;
        if (cv && typeof cv.getContext === "function") {
          cv.width = CAN * dpr; cv.height = CAN * dpr;
          cv.style.width = CAN + "px"; cv.style.height = CAN + "px";
          b.ctx = cv.getContext("2d");
          b.ctx?.scale(dpr, dpr);
        }
      }
    });

    const invM = (b: Koerper) => ((b.asleep || b.drag) ? 0 : 1);

    /* ---------- Kontakt gegen eine unbewegliche Ebene ---------- */
    function planeContact(b: Koerper, r: Vec3, n: Vec3, Iw: Mat33) {
      const vc: Vec3 = [
        b.v[0] + b.w[1]*r[2] - b.w[2]*r[1],
        b.v[1] + b.w[2]*r[0] - b.w[0]*r[2],
        b.v[2] + b.w[0]*r[1] - b.w[1]*r[0],
      ];
      const vn = dot3(vc, n);
      if (vn > 0) return;
      const rn = cross(r, n);
      const denom = 1 + dot3(n, cross(applyI(Iw, rn), r));
      const e = Math.abs(vn) < RESTV ? 0 : RESTITUTION;
      const j = -(1 + e) * vn / denom;
      b.v[0] += j*n[0]; b.v[1] += j*n[1]; b.v[2] += j*n[2];
      let tq = applyI(Iw, cross(r, [j*n[0], j*n[1], j*n[2]]));
      b.w[0] += tq[0]; b.w[1] += tq[1]; b.w[2] += tq[2];

      const vc2: Vec3 = [
        b.v[0] + b.w[1]*r[2] - b.w[2]*r[1],
        b.v[1] + b.w[2]*r[0] - b.w[0]*r[2],
        b.v[2] + b.w[0]*r[1] - b.w[1]*r[0],
      ];
      const vn2 = dot3(vc2, n);
      const vt: Vec3 = [vc2[0]-vn2*n[0], vc2[1]-vn2*n[1], vc2[2]-vn2*n[2]];
      const vtl = Math.hypot(vt[0], vt[1], vt[2]);
      if (vtl < 1e-4) return;
      const t: Vec3 = [vt[0]/vtl, vt[1]/vtl, vt[2]/vtl];
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
    const ZERO3: Mat33 = [[0,0,0],[0,0,0],[0,0,0]];

    function pushImpulse(b: Koerper, r: Vec3, J: Vec3, minv: number, Iw: Mat33) {
      if (!minv) return;
      b.v[0] += J[0]; b.v[1] += J[1]; b.v[2] += J[2];
      const tq = applyI(Iw, cross(r, J));
      b.w[0] += tq[0]; b.w[1] += tq[1]; b.w[2] += tq[2];
    }

    function bodyContact(
      Ab: Koerper, Bb: Koerper, rA: Vec3, rB: Vec3, n: Vec3, pen: number, IA: Mat33, IB: Mat33,
    ) {
      const mA = invM(Ab), mB = invM(Bb);
      if (mA + mB === 0) return;
      const iA = mA ? IA : ZERO3, iB = mB ? IB : ZERO3;
      const vA: Vec3 = [
        Ab.v[0] + Ab.w[1]*rA[2] - Ab.w[2]*rA[1],
        Ab.v[1] + Ab.w[2]*rA[0] - Ab.w[0]*rA[2],
        Ab.v[2] + Ab.w[0]*rA[1] - Ab.w[1]*rA[0],
      ];
      const vB: Vec3 = [
        Bb.v[0] + Bb.w[1]*rB[2] - Bb.w[2]*rB[1],
        Bb.v[1] + Bb.w[2]*rB[0] - Bb.w[0]*rB[2],
        Bb.v[2] + Bb.w[0]*rB[1] - Bb.w[1]*rB[0],
      ];
      const vr: Vec3 = [vB[0]-vA[0], vB[1]-vA[1], vB[2]-vA[2]];
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
        const vt: Vec3 = [vr[0]-vn*n[0], vr[1]-vn*n[1], vr[2]-vn*n[2]];
        const vtl = Math.hypot(vt[0], vt[1], vt[2]);
        if (vtl > 1e-4) {
          const t: Vec3 = [vt[0]/vtl, vt[1]/vtl, vt[2]/vtl];
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

    // Ecken von S, die im Körper T stecken
    function cornerContacts(S: Koerper, T: Koerper, IS: Mat33, IT: Mat33) {
      for (const c of S.sh.V) {
        const rS = mRot(S.m, c);
        const wp: Vec3 = [S.p[0]+rS[0], S.p[1]+rS[1], S.p[2]+rS[2]];
        const rel: Vec3 = [wp[0]-T.p[0], wp[1]-T.p[1], wp[2]-T.p[2]];
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
    function physics(dt: number) {
      for (const b of bodies) {
        if (!b.live || b.asleep || b.drag) continue;
        b.v[2] -= GRAV * dt;
        b.p[0] += b.v[0]*dt; b.p[1] += b.v[1]*dt; b.p[2] += b.v[2]*dt;
        const dq = qMul([0, b.w[0], b.w[1], b.w[2]], b.q);
        b.q = qNorm([
          b.q[0]+0.5*dt*dq[0], b.q[1]+0.5*dt*dq[1],
          b.q[2]+0.5*dt*dq[2], b.q[3]+0.5*dt*dq[3],
        ]);
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
    let cachedEdges: number[][] | null = null;
    function edgesOf(sh: Form): number[][] {
      if (cachedEdges) return cachedEdges;
      const m = new Map<string, number[]>();
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
    function worldVerts(b: Koerper): Vec3[] {
      return b.sh.V.map(c => {
        const r = mRot(b.m, c);
        return [b.p[0] + r[0], b.p[1] + r[1], b.p[2] + r[2]] as Vec3;
      });
    }
    function spanOn(V: Vec3[], ax: Vec3): [number, number] {
      let lo = Infinity, hi = -Infinity;
      for (const q of V) {
        const d = q[0]*ax[0] + q[1]*ax[1] + q[2]*ax[2];
        if (d < lo) lo = d;
        if (d > hi) hi = d;
      }
      return [lo, hi];
    }
    function satMTV(A: Koerper, B: Koerper, withEdges: boolean): { pen: number; n: Vec3 } | null {
      const VA = worldVerts(A), VB = worldVerts(B);
      const axes: Vec3[] = [];
      for (const f of A.sh.F) axes.push(mRot(A.m, f.n));
      for (const f of B.sh.F) axes.push(mRot(B.m, f.n));
      if (withEdges) {
        const EA = edgesOf(A.sh), EB = edgesOf(B.sh);
        for (const [a1, a2] of EA) {
          const d1: Vec3 = [VA[a2][0]-VA[a1][0], VA[a2][1]-VA[a1][1], VA[a2][2]-VA[a1][2]];
          for (const [b1, b2] of EB) {
            const d2: Vec3 = [VB[b2][0]-VB[b1][0], VB[b2][1]-VB[b1][1], VB[b2][2]-VB[b1][2]];
            const x = cross(d1, d2), l = Math.hypot(x[0], x[1], x[2]);
            if (l > 1e-6) axes.push([x[0]/l, x[1]/l, x[2]/l]);
          }
        }
      }
      let best = Infinity;
      let bax: Vec3 | null = null;
      for (const ax of axes) {
        const [aL, aH] = spanOn(VA, ax), [bL, bH] = spanOn(VB, ax);
        const ov = Math.min(aH, bH) - Math.max(aL, bL);
        if (ov <= 0) return null;                 // trennende Achse gefunden
        if (ov < best) { best = ov; bax = ax; }
      }
      if (!bax) return null;
      const d: Vec3 = [B.p[0]-A.p[0], B.p[1]-A.p[1], B.p[2]-A.p[2]];
      if (bax[0]*d[0] + bax[1]*d[1] + bax[2]*d[2] < 0) bax = [-bax[0], -bax[1], -bax[2]];
      return { pen: best, n: bax };
    }
    function separateOverlaps(allowWake: boolean) {
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
            if (!A.drag) { A.asleep = false; A.sleepT = 0; A.qRef = A.q.slice() as Quat; }
            if (!B.drag) { B.asleep = false; B.sleepT = 0; B.qRef = B.q.slice() as Quat; }
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
    function project(p: Vec3): [number, number, number] {
      const s = FOCAL / Math.max(120, FOCAL - p[2]);
      return [OX + (p[0]-OX)*s, OY + (p[1]-OY)*s, s];
    }
    const LIGHT = norm3([-0.35, -0.5, 0.79]);

    function drawPoly(b: Koerper) {
      const ctx = b.ctx;
      if (!ctx || !b.el) return;
      ctx.clearRect(0, 0, CAN, CAN);
      const centre = project(b.p);
      const wv = b.sh.V.map(c => {
        const r = mRot(b.m, c);
        return project([b.p[0]+r[0], b.p[1]+r[1], b.p[2]+r[2]]);
      });
      const cam: Vec3 = [OX, OY, FOCAL];
      const vis: { i: number; f: typeof b.sh.F[number]; n: Vec3; cwp: Vec3; depth: number }[] = [];
      for (let i = 0; i < b.sh.F.length; i++) {
        const f = b.sh.F[i];
        const n = mRot(b.m, f.n);
        const cw = mRot(b.m, f.c);
        const cwp: Vec3 = [b.p[0]+cw[0], b.p[1]+cw[1], b.p[2]+cw[2]];
        const view: Vec3 = [cam[0]-cwp[0], cam[1]-cwp[1], cam[2]-cwp[2]];
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

    function paint(b: Koerper) {
      if (!b.el) return;
      if (isCube) {
        b.el.style.transform = `translate3d(${b.p[0]-DIE_A/2}px, ${b.p[1]-DIE_A/2}px, ${b.p[2]}px)`;
        const cube = b.el.firstChild as HTMLElement | null;
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
        b.shadowEl.style.opacity = String(Math.max(0.10, 0.5 - lift * 0.0016));
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

    function frame(now: number) {
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
          else { b.sleepT = 0; b.qRef = b.q.slice() as Quat; }
          if (b.sleepT > 0.30) {
            // Verkantet? Dann den Tisch anstoßen — ein echter Impuls.
            if (flatness(b) < 0.97 && b.bumps < 5 && simT < freezeAt - 2.5) {
              b.bumps++;
              b.v[2] = 130;
              b.w[0] += (Math.random() - 0.5) * 8;
              b.w[1] += (Math.random() - 0.5) * 8;
              b.sleepT = 0; b.qRef = b.q.slice() as Quat;
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
    const grabs = new Map<number, { b: Koerper; s: { x: number; y: number; t: number }[] }>();
    const local = (ev: PointerEvent) => {
      const r = area.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    };

    const onDown = (ev: PointerEvent) => {
      const pt = local(ev);
      let hit: Koerper | null = null;
      let best = Infinity;
      for (const b of bodies) {
        if (!b.live) continue;
        const d = Math.hypot(b.p[0] - pt.x, b.p[1] - pt.y);
        if (d < b.sh.R * 1.05 && d < best) { best = d; hit = b; }
      }
      if (!hit) return;
      ev.preventDefault();
      try { area.setPointerCapture(ev.pointerId); } catch { /* egal */ }
      hit.drag = true; hit.asleep = false; hit.sleepT = 0;
      hit.v = [0, 0, 0];
      hit.grab = [pt.x - hit.p[0], pt.y - hit.p[1]];
      hit.p[2] = hit.sh.R + 34;
      grabs.set(ev.pointerId, { b: hit, s: [{ x: pt.x, y: pt.y, t: performance.now() }] });
      area.classList.add("grabbing");
      ensureRunning();
    };
    const onMove = (ev: PointerEvent) => {
      const g = grabs.get(ev.pointerId);
      if (!g) return;
      ev.preventDefault();
      const pt = local(ev), b = g.b;
      const grab = b.grab ?? [0, 0];
      const nx = Math.min(bounds.xmax - b.sh.R, Math.max(bounds.xmin + b.sh.R, pt.x - grab[0]));
      const ny = Math.min(bounds.ymax - b.sh.R, Math.max(bounds.ymin + b.sh.R, pt.y - grab[1]));
      const now = performance.now();
      const prev = g.s[g.s.length - 1];
      const dt = Math.max(0.008, (now - prev.t) / 1000);
      b.v = [(nx - b.p[0]) / dt, (ny - b.p[1]) / dt, 0];
      b.p[0] = nx; b.p[1] = ny;
      g.s.push({ x: pt.x, y: pt.y, t: now });
      if (g.s.length > 6) g.s.shift();
      ensureRunning();
    };
    const onUp = (ev: PointerEvent) => {
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
      b.sleepT = 0; b.qRef = b.q.slice() as Quat; b.bumps = 0;
      freezeAt = simT + 8;
      ensureRunning();
    };

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
    // Der Tisch wird per key neu erzeugt — deshalb läuft dieser Effekt genau einmal.
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
