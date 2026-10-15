// Cars: the family saloon in the yard and whoever parks across the gate.
// A body is one skin lofted from cross-sections along the car's length: the wheel arches are cut into the sections,
// and glass, lamps and black plastic are picked out of the same skin by where each quad sits. Wheels, mirrors,
// shut lines, handles, grille and plates are dressed on top.
// Local space: +Z is the front, Y is up, the tyres stand on y = 0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const lerp = (a, b, t) => a + (b - a) * t;
const sat = (t) => Math.max(0, Math.min(1, t));

// A smooth curve through [[x, y], ...] that never overshoots its keys.
function spline(keys) {
  const n = keys.length, xs = keys.map((k) => k[0]), ys = keys.map((k) => k[1]), d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// belt: the shoulder line from tail to nose · plan: half-width before the corners are rounded · zC cowl, zRF/zRR the
// roof's front and rear edge, zRB the foot of the rear window · zFg/zQ where the side glass starts and ends.
export const SPECS = {
  sedan: {
    L: 4.3, ride: 0.19, wheelR: 0.315, tireW: 0.205, rimR: 0.215, axF: 1.33, axR: -1.3, archR: 0.385,
    belt: [[-2.15, 0.955], [-1.5, 0.975], [-0.6, 0.945], [0.3, 0.92], [0.98, 0.895], [1.6, 0.86], [1.95, 0.815], [2.15, 0.78]],
    plan: [[-2.15, 0.855], [-1.3, 0.87], [-0.2, 0.875], [1.0, 0.87], [2.15, 0.85]],
    zC: 0.98, zRF: 0.3, zRR: -0.8, zRB: -1.5, roof: [[-0.8, 1.4], [-0.3, 1.44], [0.3, 1.405]], hwRoof: 0.655,
    noseR: 0.3, noseDrop: 0.06, noseRise: 0.07, tailR: 0.27, tailDrop: 0.07, tailRise: 0.13,
    zFg: 0.74, zQ: -1.0, pillars: [-0.13], doors: [0.9, -0.13, -0.9],
  },
  hatch: {
    L: 4.0, ride: 0.2, wheelR: 0.31, tireW: 0.2, rimR: 0.205, axF: 1.22, axR: -1.27, archR: 0.38,
    belt: [[-2.0, 0.975], [-1.3, 0.985], [-0.5, 0.955], [0.4, 0.925], [0.92, 0.905], [1.5, 0.87], [1.82, 0.825], [2.0, 0.79]],
    plan: [[-2.0, 0.85], [-1.2, 0.865], [0, 0.865], [1.0, 0.86], [2.0, 0.84]],
    zC: 0.92, zRF: 0.28, zRR: -1.52, zRB: -1.88, roof: [[-1.52, 1.44], [-0.6, 1.5], [0.28, 1.455]], hwRoof: 0.65,
    noseR: 0.28, noseDrop: 0.06, noseRise: 0.07, tailR: 0.22, tailDrop: 0.05, tailRise: 0.14,
    zFg: 0.68, zQ: -1.46, pillars: [-0.12, -0.98], doors: [0.82, -0.12, -0.88],
  },
};

// Half a cross-section, bottom centre -> top centre: floor, rocker roll, door skin, glass (or wing top), roof roll, roof.
const NB = 8, NC1 = 3, NS1 = 8, NS2 = 5, NC2 = 2, NT = 4;
const J_ROCK = NB + NC1, J_BELT = J_ROCK + NS1, J_RAIL = J_BELT + NS2, J_TOP = J_RAIL + NC2, NH = J_TOP + NT, NJ = NH * 2;
const F2 = [0, 0.05, 0.36, 0.67, 0.92, 1];
const RR = 0.045, CB = 0.07, CR = 0.036;

function shape(S) {
  const zf = S.L / 2, zr = -zf, beltK = spline(S.belt), planK = spline(S.plan), roofK = spline(S.roof);
  const baseF = beltK(S.zC) + CB, baseR = beltK(S.zRB) + CB;
  // Everything a section needs to know at z
  const at = (z) => {
    const nose = z > zf - S.noseR, tail = z < zr + S.tailR;
    const s = nose ? sat((z - (zf - S.noseR)) / S.noseR) : tail ? sat(((zr + S.tailR) - z) / S.tailR) : 0;     // 0..1 into the rounded end
    const drop = (nose ? S.noseDrop : S.tailDrop) * (1 - Math.sqrt(Math.max(0, 1 - s ** 6)));
    const rise = (nose ? S.noseRise : S.tailRise) * (1 - Math.sqrt(Math.max(0, 1 - s ** 4)));
    const hw = planK(z) - (nose ? S.noseR : S.tailR) * (1 - Math.sqrt(Math.max(0, 1 - s * s)));
    const base = S.ride + rise;
    let yb = base, arch = 0;
    for (const az of [S.axF, S.axR]) { const dz = Math.abs(z - az); if (dz < S.archR + 1e-6) { yb = Math.max(yb, S.wheelR + Math.sqrt(Math.max(0, S.archR * S.archR - dz * dz))); arch = 1; } }
    const k = 1 - 0.5 * s, belt = beltK(z) - drop;
    let zone = 'deck', top = belt + CB * k, rail = belt + (CB - CR) * k, hwT = hw - 0.15 * (1 - 0.45 * s);
    if (z < S.zC && z > S.zRB) {
      let t = 1;
      if (z > S.zRF) { zone = 'screen'; t = (S.zC - z) / (S.zC - S.zRF); top = lerp(baseF, roofK(S.zRF), t) + 0.018 * Math.sin(Math.PI * t); }
      else if (z < S.zRR) { zone = 'back'; t = (z - S.zRB) / (S.zRR - S.zRB); top = lerp(baseR, roofK(S.zRR), t) + 0.014 * Math.sin(Math.PI * t); }
      else { zone = 'roof'; top = roofK(z); }
      rail = top - lerp(CR, 0.05, t);
      hwT = lerp(Math.min(hw, planK(zone === 'back' ? S.zRB : S.zC)) - 0.15, S.hwRoof, Math.pow(t, 0.8));
    }
    return { z, s, nose, tail, hw, base, yb, arch, belt, top, rail, hwT, zone };
  };
  // The door skin: tucked under at the sill, fullest below the shoulder, with one soft crease.
  const sideX = (q, y) => {
    const y0 = q.base + RR, sy = sat((y - y0) / Math.max(0.05, q.belt - y0));
    return q.hw - 0.055 * Math.pow(1 - sy, 2.2) - 0.014 * sy * sy * sy + 0.006 * Math.exp(-(((sy - 0.74) / 0.05) ** 2));
  };
  const ring = (q) => {
    const pts = [], rr = q.arch ? 0.018 : RR, yR = q.yb + rr, xB = sideX(q, yR) - rr;
    for (let i = 0; i <= NB; i++) pts.push([xB * i / NB, q.yb]);
    for (let i = 1; i <= NC1; i++) { const a = i / NC1 * Math.PI / 2; pts.push([xB + rr * Math.sin(a), q.yb + rr - rr * Math.cos(a)]); }
    for (let i = 1; i <= NS1; i++) { const y = lerp(yR, q.belt, i / NS1); pts.push([sideX(q, y), y]); }
    const cab = q.zone !== 'deck', xs = pts[pts.length - 1][0];
    const dx = q.hwT - xs, dy = q.rail - q.belt, len = Math.hypot(dx, dy) || 1e-3, rc = Math.min(0.03, len * 0.3);
    const Q1 = [q.hwT - dx / len * rc, q.rail - dy / len * rc];
    const topY = (x) => q.top - (q.top - q.rail) * Math.pow(Math.abs(x) / q.hwT, 2.2);
    const Q2 = [q.hwT - rc, topY(q.hwT - rc)];
    const ledge = cab ? Math.min(0.012, len * 0.2) : 0;
    for (let i = 1; i <= NS2; i++) {
      const f = F2[i]; let x = lerp(xs, Q1[0], f), y = lerp(q.belt, Q1[1], f);
      if (i === 1 && ledge) { x = xs - ledge; y = q.belt + ledge * 0.9; }                                   // the belt moulding
      else if (cab) { const bow = 0.012 * Math.sin(Math.PI * f) * sat(len / 0.3); x += bow * dy / len; y -= bow * dx / len; }   // side glass is never flat
      pts.push([x, y]);
    }
    pts.push([0.25 * Q1[0] + 0.5 * q.hwT + 0.25 * Q2[0], 0.25 * Q1[1] + 0.5 * q.rail + 0.25 * Q2[1]], Q2);
    for (let i = 1; i <= NT; i++) { const x = Q2[0] * (1 - i / NT); pts.push([x, topY(x)]); }
    return pts;
  };
  const stations = () => {
    const key = [];
    for (const a of [0, 20, 40, 55, 68, 78, 85, 90]) { const sn = Math.sin(a * Math.PI / 180); key.push(zf - S.noseR * (1 - sn), zr + S.tailR * (1 - sn)); }
    for (const az of [S.axF, S.axR]) for (const e of [-1, 1]) { for (const a of [0, 12, 26, 42, 58, 74]) key.push(az + e * S.archR * Math.cos(a * Math.PI / 180)); key.push(az + e * (S.archR + 0.004)); }
    key.push(S.axF, S.axR, S.zC, S.zC - 0.045, S.zRF, S.zRR, S.zRB, S.zRB + 0.04, S.zFg, S.zQ, ...S.doors);
    for (const p of S.pillars) key.push(p - 0.045, p + 0.045);
    const out = [...key];
    for (let z = zr + S.tailR + 0.1; z < zf - S.noseR; z += 0.1) if (!key.some((k) => Math.abs(k - z) < 0.035)) out.push(z);
    out.sort((a, b) => a - b);
    return out.filter((z, i) => z >= zr - 1e-9 && z <= zf + 1e-9 && (i === 0 || z - out[i - 1] > 0.0012));
  };
  return { at, sideX, ring, stations, zf };
}

// Which material a quad of the skin belongs to: h counts round half the section, zm is the middle of its slice.
function kindOf(S, q, zm, h) {
  if (h < NB) return 'under';
  if (h < J_ROCK) return q.s > 0.3 ? 'black' : 'paint';
  if (h < J_BELT) {
    const r = h - J_ROCK;
    if (q.nose && q.s > 0.2 && r >= 6) return 'lamp';
    if (q.tail && q.s > 0.15 && r >= 6) return 'tail';
    return q.s > 0.3 && r < 1 ? 'black' : 'paint';
  }
  if (h < J_RAIL) {
    const k = h - J_BELT;
    if (q.zone === 'deck' || zm > S.zFg || zm < S.zQ) return 'paint';
    if (k === 0) return 'trim';
    if (k === NS2 - 1) return 'paint';
    return S.pillars.some((p) => Math.abs(zm - p) < 0.045) ? 'black' : 'glass';
  }
  if (h < J_TOP) return 'paint';
  if (q.zone === 'screen') return zm > S.zC - 0.045 ? 'black' : 'glass';
  if (q.zone === 'back') return zm < S.zRB + 0.04 ? 'black' : 'glass';
  return 'paint';
}

// want: the way the first triangle should face; the winding is flipped if it does not.
function finishGeo(pos, idx, want) {
  if (want) {
    const A = idx[0] * 3, B = idx[1] * 3, C = idx[2] * 3;
    const ux = pos[B] - pos[A], uy = pos[B + 1] - pos[A + 1], uz = pos[B + 2] - pos[A + 2], vx = pos[C] - pos[A], vy = pos[C + 1] - pos[A + 1], vz = pos[C + 2] - pos[A + 2];
    if ((uy * vz - uz * vy) * want[0] + (uz * vx - ux * vz) * want[1] + (ux * vy - uy * vx) * want[2] < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function gridGeo(nu, nv, fn, want) {
  const pos = [], idx = [];
  for (let b = 0; b <= nv; b++) for (let a = 0; a <= nu; a++) pos.push(...fn(a / nu, b / nv));
  for (let b = 0; b < nv; b++) for (let a = 0; a < nu; a++) { const p = b * (nu + 1) + a, r = p + nu + 1; idx.push(p, p + 1, r + 1, p, r + 1, r); }
  return finishGeo(pos, idx, want);
}
const bare = (g) => { const k = g.index ? g.toNonIndexed() : g; for (const name of Object.keys(k.attributes)) if (name !== 'position' && name !== 'normal') k.deleteAttribute(name); return k; };

function buildBody(S) {
  const F = shape(S), { at, sideX, ring, zf } = F, zs = F.stations(), n = zs.length;
  const Q = zs.map(at);
  const P = Q.map((q) => { const h = ring(q), row = new Array(NJ); for (let j = 0; j < NJ; j++) { const p = h[j <= NH ? j : NJ - j]; row[j] = [j <= NH ? p[0] : -p[0], p[1], q.z]; } return row; });
  const N = P.map((row, i) => row.map((p, j) => {
    const a = P[Math.min(n - 1, i + 1)][j], b = P[Math.max(0, i - 1)][j], c = row[(j + 1) % NJ], d = row[(j + NJ - 1) % NJ];
    const tz = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], tr = [c[0] - d[0], c[1] - d[1], c[2] - d[2]];
    const v = [tr[1] * tz[2] - tr[2] * tz[1], tr[2] * tz[0] - tr[0] * tz[2], tr[0] * tz[1] - tr[1] * tz[0]], l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }));
  const parts = {}, add = (kind, g) => { (parts[kind] || (parts[kind] = [])).push(g); };

  // ---- the skin ----
  const G = {}, grp = (k) => G[k] || (G[k] = { pos: [], idx: [], map: new Map() });
  const vtx = (g, i, j) => { const key = i * NJ + j; let v = g.map.get(key); if (v === undefined) { v = g.pos.length / 3; g.pos.push(P[i][j][0], P[i][j][1], P[i][j][2]); g.map.set(key, v); } return v; };
  for (let i = 0; i < n - 1; i++) {
    const zm = (zs[i] + zs[i + 1]) / 2, qm = at(zm);
    for (let j = 0; j < NJ; j++) {
      const g = grp(kindOf(S, qm, zm, j < NH ? j : NJ - 1 - j)), j1 = (j + 1) % NJ;
      const a = vtx(g, i, j), b = vtx(g, i, j1), c = vtx(g, i + 1, j1), d = vtx(g, i + 1, j);
      g.idx.push(a, b, c, a, c, d);
    }
  }
  // ---- nose and tail: a patch stretched over the last section, bowed out a little ----
  const face = {};
  for (const end of [1, -1]) {
    const q = Q[end > 0 ? n - 1 : 0], H = ring(q), bow = end > 0 ? 0.05 : 0.035;
    const bot = H.slice(0, J_ROCK + 1), side = H.slice(J_ROCK, J_BELT + 1), top = H.slice(J_BELT, NH + 1).reverse();
    const yAt = (line, x) => { for (let k = 1; k < line.length; k++) if (x <= line[k][0] + 1e-9) { const [x0, y0] = line[k - 1], [x1, y1] = line[k]; return x1 - x0 < 1e-9 ? y1 : lerp(y0, y1, sat((x - x0) / (x1 - x0))); } return line[line.length - 1][1]; };
    const xAt = (v) => { const f = v * (side.length - 1), k = Math.min(side.length - 2, Math.floor(f)); return lerp(side[k][0], side[k + 1][0], f - k); };
    const xb = bot[bot.length - 1][0], xt = top[top.length - 1][0], P00 = bot[0], P10 = bot[bot.length - 1], P01 = top[0], P11 = top[top.length - 1];
    const us = new Set(); for (let k = 0; k <= 12; k++) us.add(k / 12); for (const p of bot) us.add(p[0] / xb); for (const p of top) us.add(p[0] / xt);
    const U = [...us].sort((a, b) => a - b).filter((u, k, arr) => k === 0 || u - arr[k - 1] > 1e-4), NV = (side.length - 1) * 2;
    const pt = (u, v) => {
      const Bx = u * xb, By = yAt(bot, Bx), Tx = u * xt, Ty = yAt(top, Tx), Ly = lerp(P00[1], P01[1], v), Rx = xAt(v), Ry = lerp(P10[1], P11[1], v);
      return [(1 - v) * Bx + v * Tx + u * Rx - (u * (1 - v) * P10[0] + u * v * P11[0]),
        (1 - v) * By + v * Ty + (1 - u) * Ly + u * Ry - ((1 - u) * (1 - v) * P00[1] + u * (1 - v) * P10[1] + (1 - u) * v * P01[1] + u * v * P11[1]),
        q.z + end * bow * (1 - u * u) * (1 - Math.abs(2 * v - 1) ** 3)];
    };
    const cols = U.length, W = cols * 2 - 1, pos = [], idx = [];
    for (let v = 0; v <= NV; v++) for (let c = 0; c < W; c++) { const k = c - (cols - 1), p = pt(U[Math.abs(k)], v / NV); pos.push(k < 0 ? -p[0] : p[0], p[1], p[2]); }
    for (let v = 0; v < NV; v++) for (let c = 0; c < W - 1; c++) { const a = v * W + c, d = a + W; idx.push(a, a + 1, d + 1, a, d + 1, d); }
    add('paint', finishGeo(pos, idx, [0, 0, end]));
    // things stuck on the face follow the same bow, a few millimetres proud of it
    const x1 = Math.max(xb, xt), y0 = q.yb, y1 = q.top;
    const zAt = (x, y) => q.z + end * bow * Math.max(0, 1 - (x / x1) ** 2) * Math.max(0, 1 - Math.abs(2 * (y - y0) / (y1 - y0) - 1) ** 3);
    const patch = (kind, xa, xc, ya, yc, { eps = 0.006, nx = 8, ny = 2, taper = 0 } = {}) => add(kind, gridGeo(nx, ny, (a, b) => {
      const y = lerp(ya, yc, b), mid = (xa + xc) / 2, x = mid + (lerp(xa, xc, a) - mid) * (1 - taper * (1 - b));
      return [x, y, zAt(x, y) + end * eps];
    }, [0, 0, end]));
    face[end] = { q, x1, y0, y1, zAt, patch, lampY: side[6][1], beltY: side[side.length - 1][1] };
  }
  for (const [k, g] of Object.entries(G)) add(k, finishGeo(g.pos, g.idx));

  // ---- shut lines: thin dark ribbons laid on the skin ----
  const near = (z) => { let b = 0; for (let i = 1; i < n; i++) if (Math.abs(zs[i] - z) < Math.abs(zs[b] - z)) b = i; return b; };
  const lift = (i, j, e = 0.0025) => [P[i][j][0] + N[i][j][0] * e, P[i][j][1] + N[i][j][1] * e, P[i][j][2] + N[i][j][2] * e];
  const ribbon = (pts, w = 0.007) => add('under', gridGeo(pts.length - 1, 1, (a, b) => { const k = pts[Math.round(a * (pts.length - 1))]; return [k.p[0] + k.a[0] * w * (b - 0.5), k.p[1] + k.a[1] * w * (b - 0.5), k.p[2] + k.a[2] * w * (b - 0.5)]; }, pts[0].n));
  const acrossRing = (i, j) => { const c = P[i][(j + 1) % NJ], d = P[i][(j + NJ - 1) % NJ], v = [c[0] - d[0], c[1] - d[1], c[2] - d[2]], l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const both = (j) => [j, NJ - j];
  for (const zd of S.doors) { const i = near(zd); for (const side of [0, 1]) { const pts = []; for (let j = J_ROCK + 1; j <= J_BELT; j++) { const jj = both(j)[side]; pts.push({ p: lift(i, jj), n: N[i][jj], a: [0, 0, 1] }); } ribbon(pts); } }
  {                                 // the sill under the doors
    const i0 = near(S.doors[S.doors.length - 1]), i1 = near(S.doors[0]);
    for (const jj of both(J_ROCK + 1)) { const pts = []; for (let i = i0; i <= i1; i++) pts.push({ p: lift(i, jj), n: N[i][jj], a: acrossRing(i, jj) }); ribbon(pts); }
  }
  {                                 // the rubbing strip along the doors
    const i0 = near(S.axR + S.archR + 0.06), i1 = near(S.axF - S.archR - 0.06);
    for (const jj of both(J_ROCK + 3)) { const pts = []; for (let i = i0; i <= i1; i++) pts.push({ p: lift(i, jj, 0.005), n: N[i][jj], a: acrossRing(i, jj) }); add('black', gridGeo(pts.length - 1, 1, (a, b) => { const k = pts[Math.round(a * (pts.length - 1))]; return [k.p[0] + k.a[0] * 0.024 * (b - 0.5), k.p[1] + k.a[1] * 0.024 * (b - 0.5), k.p[2] + k.a[2] * 0.024 * (b - 0.5)]; }, pts[0].n)); }
  }
  const lid = (iA, iB, iAcross) => {     // bonnet or boot: two lines along the wings and one across the end
    const j = J_BELT + 3;
    for (const jj of both(j)) { const pts = []; for (let i = iA; i <= iB; i++) pts.push({ p: lift(i, jj), n: N[i][jj], a: acrossRing(i, jj) }); if (pts.length > 1) ribbon(pts); }
    const pts = []; for (let jj = j; jj <= NJ - j; jj++) pts.push({ p: lift(iAcross, jj), n: N[iAcross][jj], a: [0, 0, 1] }); ribbon(pts);
  };
  { const iN = near(zf - S.noseR * (1 - Math.sin(40 * Math.PI / 180))); lid(near(S.zC), iN, iN); }
  if (S.zRB > -zf + S.tailR + 0.2) { const iT = near(-zf + S.tailR * (1 - Math.sin(40 * Math.PI / 180))); lid(iT, near(S.zRB), iT); }

  // ---- inside the headlamps: two projectors and a strip of daylight LEDs; fog lamps low in the bumper ----
  const disc = (kind, i, j, r, e = 0.004) => {
    const p = P[i][j], nn = N[i][j], g = new THREE.CircleGeometry(r, 16);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(nn[0], nn[1], nn[2])));
    add(kind, g.translate(p[0] + nn[0] * e, p[1] + nn[1] * e, p[2] + nn[2] * e));
  };
  {
    const sta = (deg) => near(zf - S.noseR * (1 - Math.sin(deg * Math.PI / 180)));
    for (const jj of both(J_ROCK + 7)) { disc('black', sta(55), jj, 0.047, 0.003); disc('lens', sta(55), jj, 0.036, 0.006); disc('black', sta(78), jj, 0.04, 0.003); disc('lens', sta(78), jj, 0.03, 0.006); }
    for (const jj of both(J_ROCK + 2)) { disc('black', sta(62), jj, 0.05, 0.003); disc('lens', sta(62), jj, 0.034, 0.006); }
    for (const side of [0, 1]) {
      const pts = [];
      for (let i = sta(22); i < n; i++) { const a = both(J_ROCK + 6)[side], b = both(J_ROCK + 7)[side], p = lift(i, a, 0.004), q2 = lift(i, b, 0.004); pts.push({ p: [lerp(p[0], q2[0], 0.2), lerp(p[1], q2[1], 0.2), lerp(p[2], q2[2], 0.2)], n: N[i][a], a: acrossRing(i, a) }); }
      add('lens', gridGeo(pts.length - 1, 1, (a, b) => { const k = pts[Math.round(a * (pts.length - 1))]; return [k.p[0] + k.a[0] * 0.013 * (b - 0.5), k.p[1] + k.a[1] * 0.013 * (b - 0.5), k.p[2] + k.a[2] * 0.013 * (b - 0.5)]; }, pts[0].n));
    }
  }
  // ---- wheel-arch lips, floor, mirrors, handles, wipers, aerial, exhaust ----
  for (const az of [S.axF, S.axR]) for (const sx of [1, -1]) {
    const pts = []; for (let k = 0; k <= 14; k++) { const a = k / 14 * Math.PI, z = az + S.archR * Math.cos(a), y = S.wheelR + S.archR * Math.sin(a); pts.push(new THREE.Vector3(sx * (sideX(at(z), y + 0.02) + 0.002), y, z)); }
    add('paint', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.012, 5, false));
  }
  add('under', new THREE.BoxGeometry(1.12, 0.56, S.L - 0.62).translate(0, 0.44, 0));
  const beltAt = (z) => at(z).belt, skin = (z, y) => sideX(at(z), y);
  for (const sx of [1, -1]) {
    const mz = S.zFg + 0.07, my = beltAt(mz) + 0.085, mx = skin(mz, beltAt(mz));
    add('paint', new THREE.SphereGeometry(1, 12, 8).scale(0.09, 0.052, 0.036).translate(sx * (mx + 0.09), my, mz));
    add('black', new THREE.BoxGeometry(0.1, 0.022, 0.045).translate(sx * (mx + 0.02), my - 0.03, mz));
    add('trim', new THREE.CircleGeometry(1, 14).scale(0.072, 0.04, 1).rotateY(Math.PI).translate(sx * (mx + 0.09), my, mz - 0.033));
    S.doors.slice(1).forEach((zd) => { const hz = zd + 0.17, hy = beltAt(hz) - 0.09; add('trim', new RoundedBoxGeometry(0.022, 0.028, 0.15, 2, 0.009).translate(sx * (skin(hz, hy) + 0.004), hy, hz)); });
  }
  {
    const slope = Math.atan2(at(S.zRF).top - at(S.zC - 0.01).top, S.zC - S.zRF), zw = S.zC - 0.1, qw = at(zw);
    for (const [x, len, ry] of [[-0.2, 0.5, 0.1], [0.3, 0.44, 0.12]]) add('under', new THREE.BoxGeometry(len, 0.014, 0.022).rotateY(ry).rotateX(slope).translate(x, qw.top - (qw.top - qw.rail) * Math.pow(Math.abs(x) / qw.hwT, 2.2) + 0.016, zw));
    add('black', new THREE.SphereGeometry(1, 10, 6).scale(0.02, 0.04, 0.085).translate(0, at(S.zRR + 0.14).top + 0.008, S.zRR + 0.14));
    add('trim', new THREE.CylinderGeometry(0.028, 0.028, 0.12, 12).rotateX(Math.PI / 2).translate(0.42, S.ride + 0.065, -zf + 0.07));
  }
  // ---- the face: grille, intake, badge ----
  {
    const f = face[1], gy1 = f.y1 - 0.045, gy0 = gy1 - 0.15, gw = f.x1 * 0.72;
    f.patch('trim', -gw - 0.02, gw + 0.02, gy0 - 0.018, gy1 + 0.018, { eps: 0.004, taper: 0.24, nx: 10 });
    f.patch('black', -gw, gw, gy0, gy1, { eps: 0.008, taper: 0.24, nx: 10 });
    for (const k of [0.24, 0.5, 0.76]) f.patch('trim', -gw * 0.84, gw * 0.84, lerp(gy0, gy1, k) - 0.006, lerp(gy0, gy1, k) + 0.006, { eps: 0.012, nx: 10, ny: 1, taper: 0.1 });
    add('trim', new THREE.CircleGeometry(1, 16).scale(0.058, 0.036, 1).translate(0, (gy0 + gy1) / 2, f.zAt(0, (gy0 + gy1) / 2) + 0.017));
    f.patch('black', -f.x1 * 0.6, f.x1 * 0.6, f.y0 + 0.025, f.y0 + 0.085, { eps: 0.006, taper: -0.15, nx: 10 });
    f.plateY = (f.y0 + 0.085 + gy0 - 0.018) / 2;
    const t = face[-1], ly0 = t.lampY, ly1 = t.beltY - 0.012;
    for (const sx of [1, -1]) {
      t.patch('tail', sx * t.x1 * 0.56, sx * (t.x1 - 0.004), ly0, ly1, { eps: 0.005, nx: 4 });
      t.patch('lens', sx * t.x1 * 0.6, sx * t.x1 * 0.82, ly0 + 0.012, ly0 + 0.04, { eps: 0.009, nx: 3, ny: 1 });
      t.patch('tail', sx * t.x1 * 0.6, sx * t.x1 * 0.84, t.y0 + 0.125, t.y0 + 0.15, { eps: 0.005, nx: 2, ny: 1 });
    }
    t.patch('trim', -t.x1 * 0.54, t.x1 * 0.54, lerp(ly0, ly1, 0.45), lerp(ly0, ly1, 0.45) + 0.03, { eps: 0.006, nx: 10, ny: 1 });
    t.patch('black', -t.x1 * 0.78, t.x1 * 0.78, t.y0 + 0.012, t.y0 + 0.1, { eps: 0.006, taper: -0.1, nx: 10 });
    t.plateY = Math.min(ly0 - 0.02, t.y0 + 0.3);
  }
  const out = {};
  for (const [k, list] of Object.entries(parts)) { out[k] = mergeGeometries(list.map(bare), false); list.forEach((g) => g.dispose()); }
  return { parts: out, face, at, sideX, track: sideX(at(S.axF), 0.6) - 0.045 - S.tireW / 2 };
}

// A tyre and an alloy, modelled lying flat (axle up the Y axis, the outside face on +Y).
function buildWheel(S) {
  const R = S.wheelR, w = S.tireW, rim = S.rimR, sw = R - rim;
  const lathe = (pts, seg = 30) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  const tire = lathe([[rim, -0.44 * w], [rim + 0.35 * sw, -0.5 * w], [rim + 0.78 * sw, -0.49 * w], [R - 0.012, -0.41 * w], [R, -0.3 * w], [R, 0.3 * w], [R - 0.012, 0.41 * w], [rim + 0.78 * sw, 0.49 * w], [rim + 0.35 * sw, 0.5 * w], [rim, 0.44 * w]]);
  const tint = (g, c) => { const k = g.attributes.position.count, a = new Float32Array(k * 3); for (let i = 0; i < k; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const silver = [0.82, 0.83, 0.85], dark = [0.04, 0.04, 0.045], disc = [0.3, 0.31, 0.33], parts = [];
  parts.push(tint(lathe([[rim + 0.006, 0.42 * w], [rim - 0.004, 0.46 * w], [rim - 0.018, 0.44 * w], [rim - 0.026, 0.2 * w], [rim - 0.026, -0.3 * w]]), silver));
  parts.push(tint(new THREE.CircleGeometry(rim - 0.02, 24).rotateX(-Math.PI / 2).translate(0, -0.05 * w, 0), dark));
  parts.push(tint(new THREE.RingGeometry(0.075, rim - 0.055, 24).rotateX(-Math.PI / 2).translate(0, 0.12 * w, 0), disc));
  for (let k = 0; k < 5; k++) {
    const len = rim - 0.02 - 0.05, g = new THREE.BoxGeometry(0.052, 0.022, len), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = p.getZ(i) / len + 0.5; p.setX(i, p.getX(i) * lerp(0.7, 1.3, t)); p.setY(i, p.getY(i) + (1 - t) * 0.012); }
    g.computeVertexNormals(); parts.push(tint(g.translate(0, 0.33 * w, 0.05 + len / 2).rotateY(k * Math.PI * 2 / 5), silver));
  }
  parts.push(tint(new THREE.CylinderGeometry(0.1, 0.108, 0.022, 20).translate(0, 0.34 * w, 0), silver));
  parts.push(tint(new THREE.CylinderGeometry(0.046, 0.05, 0.016, 16).translate(0, 0.34 * w + 0.018, 0), dark));
  for (let k = 0; k < 5; k++) parts.push(tint(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 6).translate(0, 0.34 * w + 0.016, 0.076).rotateY((k + 0.5) * Math.PI * 2 / 5), dark));
  return { tire, hub: mergeGeometries(parts, false), sag: new THREE.SphereGeometry(1, 14, 8) };
}

function plateTex(text, green) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d'), ink = green ? '#f4f4f0' : '#111';
  g.fillStyle = green ? '#1f7a3d' : '#f4f4f0'; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = ink; g.lineWidth = 8; g.strokeRect(6, 6, 500, 116);
  g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.direction = 'ltr'; g.font = 'bold 84px "Segoe UI",sans-serif'; g.fillText(text, 204, 68);
  g.fillRect(398, 10, 4, 108); g.font = 'bold 30px "Segoe UI",sans-serif'; g.fillText('الأردن', 452, 46); g.font = 'bold 19px "Segoe UI",sans-serif'; g.fillText('JORDAN', 452, 90);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function signTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const g = c.getContext('2d'); g.fillStyle = '#f5c518'; g.fillRect(0, 0, 256, 96);
  g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 50px "Segoe UI",sans-serif'; g.fillText('تاكسي', 128, 34); g.font = 'bold 26px "Segoe UI",sans-serif'; g.fillText('TAXI', 128, 76);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let MATS = null;
const bodies = {}, wheelsOf = {}, fleet = new Set();
function mats() {
  return MATS || (MATS = {
    glass: new THREE.MeshStandardMaterial({ color: 0x1a2630, roughness: 0.04, metalness: 0.9, envMapIntensity: 3, emissive: 0x16283a, emissiveIntensity: 0.55 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0x1d2228, roughness: 0.05, metalness: 0.9, envMapIntensity: 3 }),
    black: new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.28, metalness: 0.3, envMapIntensity: 1.5 }),
    under: new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.92 }),
    trim: new THREE.MeshStandardMaterial({ color: 0xe2e6e9, roughness: 0.12, metalness: 1, envMapIntensity: 2.2 }),
    lens: new THREE.MeshStandardMaterial({ color: 0xe9eff3, roughness: 0.08, metalness: 0.75, envMapIntensity: 2.2, emissive: 0xfff2cc, emissiveIntensity: 0 }),
    tail: new THREE.MeshStandardMaterial({ color: 0xa30f15, roughness: 0.16, metalness: 0.25, envMapIntensity: 1.6, emissive: 0xff1a1a, emissiveIntensity: 0.12 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x131315, roughness: 0.93 }),
    alloy: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.8, envMapIntensity: 1.8 }),
  });
}

// makeCar('sedan' | 'hatch', { color, low, plate, taxi }) -> the car and the few things the game does to it
export function makeCar(kind = 'sedan', o = {}) {
  const S = SPECS[kind], B = bodies[kind] || (bodies[kind] = buildBody(S)), W = wheelsOf[kind] || (wheelsOf[kind] = buildWheel(S)), M = mats();
  const group = new THREE.Group(), body = new THREE.Group(); group.add(body);
  const color = o.color ?? 0xf4f4f2;
  const paint = o.low ? new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.3, envMapIntensity: 1.6 })
    : new THREE.MeshPhysicalMaterial({ color, metalness: 0.35, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.07, envMapIntensity: 1.6 });
  const own = { paint, lens: M.lens.clone(), tail: M.tail.clone() };
  for (const [k, g] of Object.entries(B.parts)) { const m = new THREE.Mesh(g, own[k] || M[k]); m.castShadow = k === 'paint' || k === 'glass' || k === 'under'; m.receiveShadow = k === 'paint' || k === 'glass'; body.add(m); }
  const plateM = new THREE.MeshStandardMaterial({ map: plateTex(o.plate || '12-34567', !!o.taxi), roughness: 0.5 });
  for (const e of [1, -1]) { const f = B.face[e], p = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.105), plateM); p.position.set(0, f.plateY, f.zAt(0, f.plateY) + e * 0.014); if (e < 0) p.rotation.y = Math.PI; body.add(p); }
  if (o.taxi) {
    const sign = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.12, 0.13, 2, 0.025), new THREE.MeshStandardMaterial({ map: signTex(), roughness: 0.4, emissive: 0xf5c518, emissiveIntensity: 0.25, emissiveMap: null }));
    sign.position.set(0, B.at(-0.1).top + 0.065, -0.1); sign.castShadow = true; body.add(sign);
  }
  const wheels = [];
  for (const [sx, az] of [[1, S.axF], [-1, S.axF], [1, S.axR], [-1, S.axR]]) {
    const g = new THREE.Group(), hold = new THREE.Group(), spin = new THREE.Group();
    const tire = new THREE.Mesh(W.tire, M.rubber), hub = new THREE.Mesh(W.hub, M.alloy);
    tire.rotation.z = hub.rotation.z = -sx * Math.PI / 2; tire.castShadow = true;
    // the rubber that spreads on the ground when the air is gone
    const sag = new THREE.Mesh(W.sag, M.rubber); sag.visible = false;
    hold.add(tire); spin.add(hub); g.add(hold, spin, sag); g.position.set(sx * B.track, S.wheelR, az); group.add(g);
    wheels.push({ g, hold, spin, sag, sx, az, flat: 0 });
  }
  const car = {
    kind, group, body, paint, lens: own.lens, tail: own.tail, wheels, spec: S, track: B.track, half: B.sideX(B.at(0), 0.7), L: S.L, clean: 1, dive: 0, lean: [0, 0, 0],
    // half-width of the body at a height and a place along it (for a sponge, a hand...)
    surf(y, zl) {
      const q = B.at(Math.max(-S.L / 2 + 0.03, Math.min(S.L / 2 - 0.03, zl)));
      if (y <= q.belt) return B.sideX(q, Math.max(y, q.yb + 0.04));
      return lerp(B.sideX(q, q.belt), q.hwT, sat((y - q.belt) / Math.max(0.01, q.rail - q.belt)));
    },
    // k: 0 road-worn .. 1 washed (the family car starts dusty)
    setClean(k, dirty = 0x9a8d78) {
      car.clean = k; paint.color.setHex(dirty).lerp(new THREE.Color(color), k); paint.roughness = 0.85 - 0.52 * k;
      if (paint.clearcoat !== undefined) paint.clearcoat = k; paint.envMapIntensity = 0.4 + 1.2 * k;
    },
    // let the air out of a tyre: the rim sinks, the rubber spreads, the body settles onto that corner
    setFlat(i, k) {
      const w = wheels[i], R = S.wheelR, d = k * (R - S.rimR) * 0.86;
      w.flat = k; w.g.position.y = R - d; w.hold.position.y = d / 2; w.hold.scale.set(1 + 0.1 * k, (2 * R - d) / (2 * R), 1 + 0.03 * k);
      w.sag.visible = k > 0.05; w.sag.position.set(w.sx * 0.012, -(R - d) + 0.03 * k, 0); w.sag.scale.set(S.tireW * (0.5 + 0.2 * k), 0.012 + 0.05 * k, R * (0.3 + 0.42 * k));
      car.lean = [0, 0, 0];
      for (const q of wheels) { car.lean[2] -= q.sx * q.flat * 0.042; car.lean[0] += Math.sign(q.az) * q.flat * 0.019; car.lean[1] -= q.flat * 0.018; }
      car.pose();
    },
    pose() { body.rotation.set(car.lean[0] + car.dive, 0, car.lean[2]); body.position.y = car.lean[1]; },
    roll(dist) { for (const w of wheels) w.spin.rotation.x += dist / S.wheelR; },
    lights(on) { own.lens.emissive.setHex(0xfff2cc); own.lens.emissiveIntensity = on ? 1.8 : 0; own.tail.emissiveIntensity = on ? 0.9 : 0.12; car.lit = on; },
    brake(on) { own.tail.emissiveIntensity = on ? 2.2 : car.lit ? 0.9 : 0.12; },
    blink(on) { own.lens.emissive.setHex(on ? 0xff8a14 : 0xfff2cc); own.lens.emissiveIntensity = on ? 2.4 : car.lit ? 1.8 : 0; own.tail.emissive.setHex(on ? 0xff8a14 : 0xff1a1a); own.tail.emissiveIntensity = on ? 2 : car.lit ? 0.9 : 0.12; },
    dispose() { fleet.delete(car); group.removeFromParent(); paint.dispose(); own.lens.dispose(); own.tail.dispose(); plateM.map.dispose(); plateM.dispose(); },
  };
  fleet.add(car);
  return car;
}

// Reflections are the sky by day; at night the bodywork should not glow.
export function carsTime(tod) {
  const k = tod === 'night' ? 0.25 : tod === 'evening' ? 0.75 : 1, M = mats();
  M.glass.envMapIntensity = 3 * k; M.glass.emissiveIntensity = 0.55 * k; M.lamp.envMapIntensity = 3 * k; M.trim.envMapIntensity = 2.2 * k; M.black.envMapIntensity = 1.5 * k; M.alloy.envMapIntensity = 1.8 * k;
  for (const c of fleet) { c.night = k; c.paint.envMapIntensity = (0.4 + 1.2 * c.clean) * k; c.lens.envMapIntensity = 2.2 * k; }
}
