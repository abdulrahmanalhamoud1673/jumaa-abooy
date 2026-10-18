// The roof (السطح), as every roof in Amman is: the water tanks on their plinth (one black, one beige, ribbed plastic,
// a brick on each lid so the wind does not take it), the pipes and their red-handled valves, the solar water heater
// facing south, two satellite dishes on stands weighed down with blocks, an old aerial, the rebar left sticking out of
// the columns for the floor that will be built one day (with a plastic bottle on one bar), drain spouts through the
// parapet with their stains, a couple of plastic chairs, and a bare bulb by the stairs. The stairs: concrete, along
// the yard's south wall, with an iron railing; under them the things nobody throws away.
// buildRoof(world) is called while the house is built (static geometry and the roof's own colliders);
// class Roof drives what moves: climbing up and down (you, and dad going up to check the tanks), the lids, the torch.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { flatMat } from './assets.js';
import { sfx } from './audio.js';

export const ROOF_Y = 3.1;                 // the top of the slab
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rnd = (a, b) => a + Math.random() * (b - a);
const sm = (t) => t * t * (3 - 2 * t);
const clamp = (t) => Math.max(0, Math.min(1, t));
// the stairs: bottom step at x 20.95, top at 16.4, centred on z 0.52, 0.8 wide; 17 risers
export const STAIR = { x0: 20.95, x1: 16.38, z: 0.52, w: 0.8, n: 17 };
const stairY = (x) => clamp((STAIR.x0 - x) / (STAIR.x0 - STAIR.x1)) * ROOF_Y;
// where the tanks are (over the bathroom), their lids, and where you stand to look in
export const TANKS = [{ x: 5.25, z: 1.45, r: 0.62, h: 1.5, color: 0x1d1e20, label: 'الخزان الأسود' }, { x: 6.75, z: 1.45, r: 0.6, h: 1.42, color: 0xd8ccb2, label: 'الخزان البيج' }];
const PLINTH = 0.32;

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const lathe = (pts, seg = 24) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

export function buildRoof(w) {
  const M = w.M, Y = ROOF_Y, parts = new Map(), cols = [];
  const put = (mat, g) => { if (!parts.has(mat)) parts.set(mat, []); parts.get(mat).push(g.index ? g.toNonIndexed() : g); };
  const box = (mat, sx, sy, sz, x, y, z, ry = 0) => { const g = new THREE.BoxGeometry(sx, sy, sz); if (ry) g.rotateY(ry); g.translate(x, y, z); put(mat, g); };
  const cyl = (mat, rt, rb, h, x, y, z, seg = 12, rx = 0, rz = 0, ry = 0) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry); g.translate(x, y, z); put(mat, g); };
  const rod = (mat, a, b, r, seg = 6) => { const d = b.clone().sub(a), g = new THREE.CylinderGeometry(r, r, d.length(), seg); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize())); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); put(mat, g); };
  const pipe = (mat, pts, r) => put(mat, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => V(x, y, z)), false, 'catmullrom', 0.05), Math.max(8, pts.length * 6), r, 6));
  const solid = (x0, z0, x1, z1, h = 1.5) => cols.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), h });

  // materials: a concrete roof with its waterproofing patches and stains, plastic, galvanised steel, rust
  const concrete = new THREE.MeshStandardMaterial({ roughness: 0.95, map: canvasTex(512, 512, (g, W, H) => {
    g.fillStyle = '#a7a39b'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) { const v = 130 + Math.random() * 60; g.fillStyle = `rgba(${v},${v - 4},${v - 10},0.25)`; g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 4, 2 + Math.random() * 4); }
    for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(60,58,55,${0.08 + Math.random() * 0.12})`; g.beginPath(); g.ellipse(Math.random() * W, Math.random() * H, 30 + Math.random() * 90, 20 + Math.random() * 60, Math.random() * 3, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(70,66,60,0.35)'; g.lineWidth = 1.2; for (let i = 0; i < 7; i++) { g.beginPath(); let x = Math.random() * W, y = Math.random() * H; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
  }, [4, 3]) });
  const bitumen = flatMat(0x77746e, { rough: 0.9 }), plasticW = flatMat(0xe9e7e1, { rough: 0.55 }), galv = flatMat(0xa9adb0, { rough: 0.45, metal: 0.65 });
  const pvc = flatMat(0xd9dadc, { rough: 0.5 }), pvcGrey = flatMat(0x8d9296, { rough: 0.55 }), rust = flatMat(0x7a4528, { rough: 0.9, metal: 0.3 }), red = flatMat(0xc22a22, { rough: 0.5 });
  const brick = flatMat(0x9a4f32, { rough: 0.95 }), block = flatMat(0x9c9890, { rough: 0.95 }), cream = M.cream, dark = M.dark, black = flatMat(0x161618, { rough: 0.7 });
  const glassBlue = new THREE.MeshStandardMaterial({ color: 0x1b3157, roughness: 0.1, metalness: 0.5, map: canvasTex(128, 256, (g, W, H) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); g.strokeStyle = '#8aa2c8'; g.lineWidth = 2; for (let x = 8; x < W; x += 12) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    g.fillStyle = '#c9ced6'; g.fillRect(0, 0, W, 6); g.fillRect(0, H - 6, W, 6);
  }) });
  // ---- the slab's surface (over the white ceiling box), the waterproofing patches, the coping on the parapet
  { const g = new THREE.PlaneGeometry(15.8, 11.8).rotateX(-Math.PI / 2); g.translate(8, Y + 0.004, 6); put(concrete, g); }
  for (const [x, z, sx, sz] of [[3.2, 7.8, 2.6, 1.8], [10.8, 4.2, 1.6, 2.4], [13.6, 10.2, 2.0, 1.2], [7.6, 9.6, 1.2, 1.0]]) box(bitumen, sx, 0.006, sz, x, Y + 0.008, z);
  for (const [x, z, sx, sz] of [[8, -0.1, 16.5, 0.24], [8, 12.1, 16.5, 0.24], [-0.1, 6, 0.24, 12.4]]) box(cream, sx, 0.05, sz, x, Y + 0.525, z);
  box(cream, 0.24, 0.05, 0.22, 16.1, Y + 0.525, -0.0); box(cream, 0.24, 0.05, 11.36, 16.1, Y + 0.525, 6.62);     // (the east one stops for the stairs)
  // the parapet keeps you on the roof; the stair opening at the south-east corner
  solid(-0.3, -0.3, 16.3, 0.12); solid(-0.3, 11.88, 16.3, 12.3); solid(-0.3, -0.3, 0.12, 12.3); solid(15.88, 0.95, 16.3, 12.3);
  // ---- drain spouts through the parapet, each with its stain down the stone outside
  const stain = new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, roughness: 1, map: canvasTex(32, 128, (g, W, H) => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(40,38,34,0.55)'); gr.addColorStop(1, 'rgba(40,38,34,0)'); g.fillStyle = gr; g.fillRect(W * 0.25, 0, W * 0.5, H); }) });
  for (const [x, z, s] of [[4.0, -0.2, -1], [12.0, -0.2, -1], [4.0, 12.2, 1], [12.0, 12.2, 1]]) {
    cyl(pvcGrey, 0.045, 0.045, 0.32, x, Y + 0.06, z + s * 0.02, 10, Math.PI / 2);
    const g = new THREE.PlaneGeometry(0.22, 1.6); if (s < 0) g.rotateY(Math.PI); g.translate(x, Y - 0.85, z + s * 0.11); put(stain, g);
  }
  // ---- the water tanks: on a concrete plinth with a steel frame, ribbed plastic, a domed top, a screw lid and a brick on it
  box(block, 3.3, PLINTH, 1.6, 6.0, Y + PLINTH / 2, 1.45); box(galv, 3.2, 0.06, 0.08, 6.0, Y + PLINTH + 0.03, 0.85); box(galv, 3.2, 0.06, 0.08, 6.0, Y + PLINTH + 0.03, 2.05);
  solid(4.35, 0.65, 7.65, 2.25, 2.2);
  for (const T of TANKS) {
    const tm = flatMat(T.color, { rough: 0.6 }), y0 = Y + PLINTH + 0.06, pts = [[0, 0], [T.r * 0.9, 0], [T.r, 0.05]];
    for (let k = 0; k < 9; k++) { const y = 0.08 + k * (T.h - 0.3) / 9; pts.push([T.r, y], [T.r - 0.02, y + 0.04], [T.r, y + 0.08]); }
    pts.push([T.r, T.h - 0.2], [T.r * 0.85, T.h - 0.08], [T.r * 0.45, T.h], [0.22, T.h + 0.01], [0, T.h + 0.01]);
    const g = lathe(pts, 28); g.translate(T.x, y0, T.z); put(tm, g);
    // a label with its size, the overflow, the inlet over the top with its float valve inside
    T.top = Y + PLINTH + 0.06 + T.h; T.y0 = y0;
    pipe(pvc, [[T.x + 0.15, T.top - 0.05, T.z - 0.12], [T.x + 0.3, T.top + 0.12, T.z - 0.25], [T.x + 0.5, T.top + 0.12, T.z - 0.6], [T.x + 0.55, Y + 0.2, T.z - 0.95]], 0.016);
    cyl(pvcGrey, 0.022, 0.022, 0.25, T.x - T.r - 0.08, y0 + T.h - 0.25, T.z, 8, 0, Math.PI / 2);
    // outlet at the foot into the manifold, each with its red-handled ball valve
    cyl(galv, 0.02, 0.02, 0.32, T.x, y0 + 0.08, T.z + T.r + 0.12, 8, Math.PI / 2);
    box(red, 0.12, 0.018, 0.03, T.x + 0.04, y0 + 0.12, T.z + T.r + 0.2);
  }
  pipe(galv, [[5.25, 3.5, 2.4], [6.0, 3.5, 2.42], [6.75, 3.5, 2.4]], 0.022);
  pipe(galv, [[6.0, 3.5, 2.42], [6.05, Y + 0.15, 2.6], [6.05, Y + 0.02, 2.7]], 0.022); cyl(dark, 0.05, 0.05, 0.03, 6.05, Y + 0.012, 2.7, 10);
  // the main up from the street, along the parapet
  pipe(pvc, [[15.7, Y + 0.12, 0.3], [9.0, Y + 0.12, 0.28], [6.4, Y + 0.12, 0.28], [5.8, Y + 0.6, 0.45]], 0.018);
  // ---- the solar water heater: an angle-iron frame, two blue collector panels to the south, the white tank on top
  { const hx = 9.6, hz = 2.6, tilt = 0.7;
    for (const dx of [-0.95, 0.95]) {
      rod(galv, V(hx + dx, Y, hz + 0.7), V(hx + dx, Y + 0.25, hz + 0.7), 0.025); rod(galv, V(hx + dx, Y, hz - 0.6), V(hx + dx, Y + 1.35, hz - 0.6), 0.025);
      rod(galv, V(hx + dx, Y + 0.25, hz + 0.7), V(hx + dx, Y + 1.35, hz - 0.6), 0.025);
    }
    for (const dx of [-0.48, 0.48]) {
      const g = new THREE.BoxGeometry(0.92, 0.06, 1.7); g.rotateX(tilt); g.translate(hx + dx, Y + 0.82, hz + 0.05); put(galv, g);
      const s = new THREE.PlaneGeometry(0.86, 1.62).rotateX(-Math.PI / 2 + tilt); s.translate(hx + dx, Y + 0.855, hz + 0.075); put(glassBlue, s);
    }
    cyl(plasticW, 0.28, 0.28, 1.9, hx, Y + 1.62, hz - 0.62, 20, 0, Math.PI / 2); cyl(galv, 0.29, 0.29, 0.04, hx - 0.95, Y + 1.62, hz - 0.62, 20, 0, Math.PI / 2); cyl(galv, 0.29, 0.29, 0.04, hx + 0.95, Y + 1.62, hz - 0.62, 20, 0, Math.PI / 2);
    pipe(pvcGrey, [[hx + 0.7, Y + 1.4, hz - 0.62], [hx + 0.9, Y + 0.6, hz - 0.65], [hx + 1.0, Y + 0.05, hz - 0.7], [hx + 1.05, Y + 0.02, hz - 1.1]], 0.016);
    solid(hx - 1.05, hz - 0.85, hx + 1.05, hz + 0.85, 1.7);
  }
  // ---- two dishes on tripod stands with breeze blocks on their feet (to the south-west), cables to the edge; an old aerial
  for (const [x, z, r, az] of [[12.2, 8.8, 0.45, 0.6], [13.6, 7.6, 0.38, 0.1]]) {
    for (const a of [0, 2.1, 4.2]) { rod(galv, V(x, Y + 0.9, z), V(x + Math.cos(a) * 0.4, Y, z + Math.sin(a) * 0.4), 0.014); box(block, 0.4, 0.2, 0.2, x + Math.cos(a) * 0.42, Y + 0.1, z + Math.sin(a) * 0.42, a); }
    rod(galv, V(x, Y, z), V(x, Y + 1.0, z), 0.024);
    const dish = lathe([[0, 0], [r * 0.5, r * 0.06], [r * 0.9, r * 0.22], [r, r * 0.3], [r * 0.98, r * 0.31], [r * 0.88, r * 0.24], [r * 0.48, r * 0.08], [0, 0.015]], 22);
    dish.rotateX(-0.85); dish.rotateY(az); dish.translate(x, Y + 1.05, z); put(plasticW, dish);
    const arm0 = V(x, Y + 0.9, z), arm1 = V(x + Math.sin(az) * 0.55, Y + 1.3, z + Math.cos(az) * 0.55); rod(dark, arm0, arm1, 0.01);
    box(dark, 0.06, 0.08, 0.1, arm1.x, arm1.y, arm1.z, az);
    pipe(black, [[x, Y + 0.85, z], [x, Y + 0.02, z + 0.1], [x + 1.4, Y + 0.02, z + 0.6], [15.75, Y + 0.02, z + 0.8], [15.85, Y + 0.4, z + 0.8]], 0.006);
    solid(x - 0.5, z - 0.5, x + 0.5, z + 0.5, 1.4);
  }
  rod(rust, V(1.6, Y, 10.4), V(1.6, Y + 3.2, 10.4), 0.022);
  for (const [y, l] of [[2.4, 1.4], [2.8, 1.1], [3.1, 0.8]]) rod(rust, V(1.6 - l / 2, Y + y, 10.4), V(1.6 + l / 2, Y + y, 10.4), 0.01);
  for (const a of [0, 2.1, 4.2]) rod(dark, V(1.6, Y + 2.0, 10.4), V(1.6 + Math.cos(a) * 1.2, Y + 0.02, 10.4 + Math.sin(a) * 1.2), 0.003);
  solid(1.4, 10.2, 1.8, 10.6, 3);
  // ---- the rebar for the floor that is still to come, at the column heads; a plastic bottle on one bar
  for (const [x, z] of [[0.3, 0.3], [8, 0.3], [15.7, 0.3], [0.3, 6], [15.7, 6.2], [0.3, 11.7], [8, 11.7], [15.7, 11.7]]) {
    for (const [dx, dz] of [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]]) { const h = rnd(0.55, 0.9), b = V(x + dx, Y, z + dz), t = V(x + dx + rnd(-0.05, 0.05), Y + h, z + dz + rnd(-0.05, 0.05)); rod(rust, b, t, 0.008, 5); }
    solid(x - 0.15, z - 0.15, x + 0.15, z + 0.15, 1.0);
  }
  { const g = lathe([[0, 0], [0.04, 0], [0.042, 0.2], [0.02, 0.25], [0.014, 0.28], [0, 0.28]], 12); g.rotateX(Math.PI); g.translate(8.08, Y + 1.05, 0.38); put(new THREE.MeshStandardMaterial({ color: 0x9fd0e6, roughness: 0.15, transparent: true, opacity: 0.6 }), g); }
  // ---- two white plastic chairs (one turned to the view), a cracked one on its side; potted geraniums in old tins
  const chair = (x, z, ry, tip = 0) => {
    const g = new THREE.Group(), add = (geo) => g.add(new THREE.Mesh(geo, plasticW));
    add(new THREE.BoxGeometry(0.46, 0.04, 0.44).translate(0, 0.44, 0)); add(new THREE.BoxGeometry(0.46, 0.42, 0.04).rotateX(-0.12).translate(0, 0.68, -0.22));
    for (const [lx, lz] of [[-0.21, -0.19], [0.21, -0.19], [-0.21, 0.19], [0.21, 0.19]]) add(new THREE.CylinderGeometry(0.016, 0.02, 0.44, 6).translate(lx, 0.22, lz));
    g.rotation.set(0, ry, tip); g.position.set(x, Y, z); g.updateMatrixWorld(true);
    g.children.forEach((m) => { const k = m.geometry.clone(); k.applyMatrix4(g.matrixWorld); put(plasticW, k); });
  };
  chair(11.2, 5.6, 2.6); chair(12.0, 5.9, 3.4); chair(2.6, 1.2, 0.8, 1.5);
  solid(10.9, 5.3, 12.3, 6.2, 0.9);
  for (const [x, z] of [[14.9, 11.4], [15.3, 11.4], [3.8, 11.45]]) { cyl(galv, 0.12, 0.11, 0.24, x, Y + 0.12, z, 12); for (let k = 0; k < 5; k++) put(flatMat(k % 2 ? 0x3d7a33 : 0x4f8f3d), new THREE.IcosahedronGeometry(0.09, 0).translate(x + rnd(-0.08, 0.08), Y + 0.32 + rnd(0, 0.1), z + rnd(-0.08, 0.08))); put(flatMat(0xd2343e), new THREE.IcosahedronGeometry(0.05, 0).translate(x, Y + 0.45, z)); }
  // ---- the bare bulb on its bracket by the stair head (lit after dark)
  rod(dark, V(15.95, Y + 0.6, 1.2), V(15.75, Y + 0.6, 1.2), 0.01); w.roofBulb = { at: V(15.72, Y + 0.55, 1.2) };
  // ---- the stairs: steps and their underside, the railing; their footprint in the yard
  const S = STAIR, run = (S.x0 - S.x1) / S.n, rise = Y / S.n, tread = M.marble, stairC = flatMat(0xb9b2a6, { rough: 0.9 });
  for (let i = 0; i < S.n; i++) {
    const x = S.x0 - (i + 0.5) * run, top = (i + 1) * rise;
    box(stairC, run + 0.01, rise, S.w, x, top - rise / 2, S.z); box(tread, run + 0.03, 0.02, S.w + 0.02, x + 0.01, top + 0.01, S.z);
  }
  { // the slab under the steps (a sloping concrete beam), and the landing joining the roof
    const len = Math.hypot(S.x0 - S.x1, Y), g = new THREE.BoxGeometry(len, 0.16, S.w); g.rotateZ(-Math.atan2(Y, S.x0 - S.x1)); g.translate((S.x0 + S.x1) / 2 + 0.06, Y / 2 - 0.1, S.z); put(stairC, g);
    box(stairC, 0.42, 0.18, S.w, 16.18, Y - 0.09, S.z); box(tread, 0.44, 0.02, S.w + 0.02, 16.18, Y + 0.01, S.z);
  }
  for (const side of [1, -1]) {
    const zz = S.z + side * (S.w / 2 - 0.03), rail = (x) => V(x, stairY(x) + 0.92, zz);
    const xs = []; for (let x = S.x0 - 0.15; x > S.x1 - 0.1; x -= 0.9) xs.push(x); xs.push(S.x1 - 0.02);
    for (const x of xs) { if (side < 0 && stairY(x) < 1.0) continue; rod(M.metalGreen, V(x, stairY(x) + rise, zz), rail(x), 0.016); }
    const x0 = side < 0 ? S.x0 - (1.0 / Y) * (S.x0 - S.x1) : S.x0 - 0.15;
    rod(M.metalGreen, rail(x0), rail(S.x1 - 0.02), 0.022); rod(M.metalGreen, rail(x0).add(V(0, -0.45, 0)), rail(S.x1 - 0.02).add(V(0, -0.45, 0)), 0.012);
  }
  w.solid(16.15, 0.1, 21.0, 0.95, 1.4);
  // under them: paint buckets, a stack of bricks, a spare tyre leaning on the wall, a broken chair
  for (const [x, z, h] of [[17.0, 0.4, 0.3], [17.3, 0.62, 0.3], [17.1, 0.75, 0.24]]) { cyl(plasticW, 0.14, 0.12, h, x, h / 2, z, 14); cyl(flatMat(0x2d6fb8), 0.141, 0.141, 0.06, x, h * 0.6, z, 14); }
  for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) box(brick, 0.24, 0.1, 0.12, 18.0 + k * 0.25, 0.05 + i * 0.1, 0.4 + (i % 2) * 0.13);
  { const t = new THREE.TorusGeometry(0.28, 0.1, 10, 22); t.rotateY(Math.PI / 2); t.rotateZ(0.25); t.translate(19.2, 0.32, 0.25); put(flatMat(0x18181a, { rough: 0.95 }), t); }
  // merged per material, and the roof's own colliders
  for (const [mat, list] of parts) { const g = mergeGeometries(list, false); const mesh = new THREE.Mesh(g, mat); mesh.castShadow = true; mesh.receiveShadow = true; w.group.add(mesh); }
  w.roofColliders = cols;
  w.spots.stairsUp = { id: 'stairsUp', x: 21.35, z: S.z, face: -Math.PI / 2, room: 'yard', label: 'اطلع عالسطح' };
  w.spots.stairsDown = { id: 'stairsDown', x: 15.55, z: S.z + 0.05, y: Y, face: Math.PI / 2, room: 'roof', label: 'انزل لتحت' };
  w.spots.tankLook = { id: 'tankLook', x: 5.25, z: 2.55, y: Y, face: Math.PI, room: 'roof', label: 'الخزانات' };
  w.spots.roofView = { id: 'roofView', x: 11.6, z: 6.4, y: Y, face: Math.PI, room: 'roof', label: 'المنظر' };
}

// ---------- what moves on the roof ----------
export class Roof {
  constructor(game) {
    this.game = game; const w = game.world;
    // the screw lids (they come off) with the brick on each
    this.lids = TANKS.map((T) => {
      const g = new THREE.Group(), lid = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.22, 0.06, 20), flatMat(T.color === 0x1d1e20 ? 0x2a2b2e : 0xcfc2a6, { rough: 0.6 }));
      lid.castShadow = true; g.add(lid);
      for (let k = 0; k < 12; k++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.02), lid.material); const a = k / 12 * Math.PI * 2; r.position.set(Math.cos(a) * 0.215, 0, Math.sin(a) * 0.215); r.rotation.y = -a; g.add(r); }
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.12), flatMat(0xb8562e, { rough: 0.95 })); b.position.y = 0.08; b.rotation.y = 0.4; b.castShadow = true; g.add(b);
      g.position.set(T.x, T.top + 0.03, T.z); game.scene.add(g);
      // the water inside, seen when the lid is off
      const water = new THREE.Mesh(new THREE.CircleGeometry(T.r - 0.04, 24), new THREE.MeshStandardMaterial({ color: 0x1f3b4a, roughness: 0.1, metalness: 0.3 })); water.rotation.x = -Math.PI / 2; game.scene.add(water);
      return { g, home: g.position.clone(), T, water, level: 0.5 };
    });
    // the bulb by the stairs
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff6dd, emissive: 0xffd88a, emissiveIntensity: 0 }));
    bulb.position.copy(w.roofBulb.at); game.scene.add(bulb); this.bulb = bulb;
    this.light = new THREE.PointLight(0xffd9a0, 0, 7, 2); this.light.position.copy(w.roofBulb.at).add(V(-0.1, -0.05, 0)); game.scene.add(this.light); w.points.push(this.light);
    // the torch (the dad's, or yours when you hold it for him): a little cone of light
    this.torch = new THREE.SpotLight(0xfff2d0, 0, 6, 0.4, 0.5, 1.5); game.scene.add(this.torch); game.scene.add(this.torch.target);
    this.climb = null; this.dadTrip = null;
  }
  reset(seg) {
    const g = this.game, night = g.world.dark;
    this.bulb.material.emissiveIntensity = night ? 2.4 : 0; this.light.intensity = night ? 2.2 : 0;
    for (const L of this.lids) { L.g.position.copy(L.home); L.g.rotation.set(0, 0, 0); L.level = rnd(0.25, 0.85); this.setWater(L); }
    this.torch.intensity = 0;
    if (this.climb) { const p = g.player; this.climb = null; p.state = 'free'; }
    this.trip = seg.roof && !g.flags.guests ? { at: rnd(seg.roof[0], seg.roof[1]), state: 'none' } : null;
    const q = new URLSearchParams(location.search); if (q.has('tank')) this.trip = { at: 5, state: 'none' };
  }
  setWater(L) { const T = L.T; L.water.position.set(T.x, T.y0 + 0.06 + (T.h - 0.25) * L.level, T.z); }
  onRoof(o) { return (o.char ? o.char.pos.y : o.y || 0) > 2.5; }

  // ---------- going up and down: along the steps, a hand on the rail ----------
  // path for a body going up (reversed going down): from the bottom step to the landing to the roof
  path(up) {
    const S = STAIR, pts = [[21.35, S.z, 0], [S.x0 + 0.1, S.z, 0]];
    for (let i = 1; i <= 8; i++) { const x = S.x0 - (S.x0 - S.x1) * i / 8; pts.push([x, S.z, stairY(x)]); }
    pts.push([16.18, S.z, ROOF_Y], [15.55, S.z + 0.05, ROOF_Y]);
    return up ? pts : pts.reverse();
  }
  // move a character along a path at v m/s; returns true when there
  stepAlong(c, st, dt, v = 0.85) {
    const pts = st.pts; let left = v * dt;
    while (left > 0 && st.i < pts.length - 1) {
      const [ax, az, ay] = [c.pos.x, c.pos.z, c.pos.y], [bx, bz, by] = pts[st.i + 1], d = Math.hypot(bx - ax, bz - az, (by - ay) * 0.4);
      if (d <= left) { c.pos.set(bx, by, bz); left -= d; st.i++; } else { const k = left / d; c.pos.set(ax + (bx - ax) * k, ay + (by - ay) * k, az + (bz - az) * k); left = 0; }
      const [nx, nz] = pts[Math.min(st.i + 1, pts.length - 1)]; if (Math.hypot(nx - c.pos.x, nz - c.pos.z) > 0.02) c.heading = Math.atan2(nx - c.pos.x, nz - c.pos.z);
    }
    // the hand that is on the railing side, sliding along it
    const railZ = STAIR.z + STAIR.w / 2 - 0.03, onStair = c.pos.x < STAIR.x0 + 0.05 && c.pos.x > STAIR.x1 - 0.1;
    c.reachTo(st.up ? 'L' : 'R', onStair ? V(c.pos.x - (st.up ? 0.18 : -0.18), stairY(c.pos.x - (st.up ? 0.18 : -0.18)) + 0.92, railZ) : null, 0.85);
    st.stepT = (st.stepT || 0) - dt * v * 2.2; if (st.stepT <= 0) { st.stepT = 1; sfx.step({ x: c.pos.x, y: c.pos.y + 0.1, z: c.pos.z }, 0.7, st.heavy); }
    return st.i >= pts.length - 1;
  }
  startClimb(up) {
    const p = this.game.player, c = p.char;
    if (p.phoneOut) p.phone(false);
    this.climb = { up, pts: this.path(up), i: 0 }; p.state = 'climb'; p.pose = 'climb'; p.sneaking = false;
    c.pos.set(this.climb.pts[0][0], this.climb.pts[0][2], this.climb.pts[0][1]);
    if (!up) this.game.toast('نازل عالدرج… على مهلك', ''); else if (!this.game.save.roofSeen) { this.game.save.roofSeen = true; this.game.storeSave(); this.game.toast('طالع عالسطح… مسّك بالدرابزين', ''); }
  }

  // ---------- what you can do up there ----------
  offer(add, near, dist) {
    const g = this.game, p = g.player, w = g.world, up = this.onRoof(p);
    if (this.climb || p.carrying && p.carrying.heavy) return;
    const su = w.spots.stairsUp, sd = w.spots.stairsDown;
    if (!up && near(su, 1.2)) add(1, dist(su), { key: 'roofUp', label: 'اطلع عالسطح', secs: 0.2, face: su, run: () => this.startClimb(true) });
    if (up && near(sd, 1.1)) add(1, dist(sd), { key: 'roofDown', label: 'انزل لتحت', secs: 0.2, face: sd, run: () => this.startClimb(false) });
    if (!up) return;
    // knock on a tank to hear how full it is (hollow high up, dull below the water)
    for (const L of this.lids) {
      const T = L.T, at = { x: T.x, z: T.z + T.r + 0.35, y: ROOF_Y };
      if (near(at, 0.9)) add(2, dist(at), { key: 'knock' + T.x, label: 'دقّ عالخزان', secs: 0.9, face: { x: T.x, z: T.z }, run: () => { this.knock(L, p.char); } });
    }
    // dad up here at his tanks: hold the torch for him
    const T = this.dadTrip;
    if (T && T.state === 'look' && !T.helped && near(g.dad, 1.9)) add(0, dist(g.dad), { key: 'helpDad', label: 'امسك الكشاف لأبوك', secs: 0.2, face: g.dad, run: () => { T.helped = true; T.helping = 0; p.state = 'help'; } });
    const vw = w.spots.roofView;
    if (near(vw, 1.0)) add(3, dist(vw), { key: 'view', label: 'اتطلّع عالمنظر', secs: 0.2, face: vw, run: () => { this.game.toast(g.world.dark ? 'أضوية عمّان… والجبال سود' : 'سطوح عمّان: خزانات وصحون لآخر الدنيا', ''); } });
  }
  knock(L, c) {
    const T = L.T, hitY = T.y0 + 0.3 + Math.random() * (T.h - 0.6), full = (hitY - T.y0) / T.h < L.level;
    c.reachTo('R', V(T.x, hitY, T.z + T.r), 0.95); this.game.later(0.5, () => c.reachTo('R', null));
    for (let i = 0; i < 3; i++) this.game.later(0.12 + i * 0.16, () => sfx.knockTank({ x: T.x, y: hitY, z: T.z }, full));
    this.game.toast(L.level > 0.7 ? 'مليان… والحمد لله' : L.level > 0.4 ? 'نصّه… يعني' : 'صوته فاضي! المي قربت تخلص', L.level > 0.4 ? '' : 'bad');
  }

  // ---------- each frame ----------
  update(dt) {
    const g = this.game, p = g.player, c = p.char;
    if (this.climb) {
      const st = this.climb; st.up = st.up ?? true;
      c.play('m_walk_neutral_01', { speed: 0.7, fade: 0.2 });
      if (this.stepAlong(c, st, dt, 0.8)) {
        c.reachTo('L', null); c.reachTo('R', null); this.climb = null; p.state = 'free'; p.pose = null; c.play('m_idle_neutral_01', { fade: 0.3 });
        if (!st.up) c.pos.y = 0; else c.pos.y = ROOF_Y;
      }
    }
    if (p.state === 'help') this.helpTick(dt);
    this.tripTick(dt);
  }

  // ---------- dad's trip to the tanks ----------
  // «إجت المي؟» he goes out to the yard, up the stairs, knocks on the tanks, takes a lid off and looks in with his torch,
  // grumbles about who is using all the water, puts the lid back with its brick and comes down again.
  tripTick(dt) {
    const g = this.game, d = g.dad, c = d.char, tr = this.trip;
    if (!tr) return;
    if (tr.state === 'none') {
      if (g.segT >= tr.at && d.state === 'routine' && !d.seat && !d.away && !g.over && !g.flags.guests && !(g.vendors && g.vendors.busy)) {
        tr.state = 'toStairs'; d.say('dad.tank.go', { loud: true }); d.watchingTv = false; if (g.chat) g.chat.event('tank');
        d.setState('roof'); d.pose = null;
        d.goTo(21.35, STAIR.z, { speed: 1.35, onArrive: () => { tr.state = 'climbUp'; d.away = true; tr.st = { up: true, pts: this.path(true), i: 0, heavy: true }; g.toast('أبوك طالع عالسطح يشوف الخزانات 🪣 فرصتك!', 'good'); } });
      }
      return;
    }
    if (tr.state === 'toStairs') { if (d.state !== 'roof') { this.trip = null; } return; }       // something else came up on the way
    // from here dad is away from the house: we move him
    this.dadTrip = tr; tr.t = (tr.t || 0) + dt;
    const tank = this.lids[tr.which ?? (tr.which = Math.floor(Math.random() * 2))], T = tank.T, stand = V(T.x, ROOF_Y, T.z + T.r + 0.3);
    const night = g.world.dark;
    switch (tr.state) {
      case 'climbUp':
        c.play('m_walk_neutral_01', { speed: 0.65, fade: 0.2 });
        if (this.stepAlong(c, tr.st, dt, 0.7)) { tr.state = 'toTank'; tr.walk = { pts: [[15.0, 0.9, ROOF_Y], [12.0, 4.2, ROOF_Y], [8.0, 4.0, ROOF_Y], [stand.x, stand.z, ROOF_Y]], i: 0, up: true, heavy: true }; c.pos.set(15.55, ROOF_Y, 0.57); c.reachTo('L', null); c.reachTo('R', null); }
        break;
      case 'toTank':
        c.play('m_walk_neutral_01', { speed: 0.8, fade: 0.2 });
        if (this.walkRoof(c, tr.walk, dt)) { tr.state = 'knock'; tr.t = 0; c.heading = Math.PI; c.play('m_idle_neutral_01', { fade: 0.3 }); }
        break;
      case 'knock':
        if (tr.t > 0.4 && !tr.knocked) { tr.knocked = true; this.knock(tank, c); }
        if (tr.t > 2.0) { tr.state = 'lid'; tr.t = 0; }
        break;
      case 'lid': {                      // the brick off, the lid unscrewed and lifted aside
        const k = sm(clamp(tr.t / 1.6)), top = tank.home;
        c.reachTo('R', V(top.x - 0.05, top.y + 0.06, top.z), 0.9); c.reachTo('L', V(top.x + 0.12, top.y + 0.05, top.z + 0.05), 0.9);
        tank.g.rotation.y = -k * 6; tank.g.position.copy(top).add(V(0.3 * sm(clamp((tr.t - 1.1) / 0.5)), 0.12 * sm(clamp((tr.t - 1.1) / 0.5)), 0.45 * sm(clamp((tr.t - 1.1) / 0.5))));
        if (tr.t > 0.3 && !tr.unscrew) { tr.unscrew = true; sfx.click(); }
        if (tr.t > 1.7) { tr.state = 'look'; tr.t = 0; tank.g.position.set(T.x + 0.38, ROOF_Y + PLINTH + 0.09, T.z + T.r + 0.06); c.reachTo('L', null); }
        break;
      }
      case 'look': {                     // bent over the opening, the torch in, a remark
        c.reachTo('R', V(T.x, T.top + 0.25, T.z + 0.15), 0.8); c.leanTarget = 0.35;
        const lit = night || tr.helping != null;
        this.torch.intensity = lit ? 5 : 0; this.torch.position.set(T.x + 0.05, T.top + 0.3, T.z + 0.25); this.torch.target.position.set(T.x, T.y0 + 0.4, T.z);
        if (!tr.said && tr.t > 0.6 && tank.level < 0.4 && g.chat) g.later(6, () => g.chat.event('tankEmpty'));
        if (!tr.said && tr.t > 0.6) { tr.said = true; d.say(tank.level < 0.4 ? 'dad.tank.empty' : tank.level > 0.75 ? 'dad.tank.full' : 'dad.tank.half', { loud: true }); }
        // you came up: he wants a hand
        if (!tr.asked && this.onRoof(g.player) && Math.hypot(g.player.x - c.pos.x, g.player.z - c.pos.z) < 7) { tr.asked = true; g.later(1.4, () => d.say('dad.tank.help', { loud: true })); }
        const wait = tr.helping != null ? 99 : tr.asked ? 9 : 5.5;
        if (tr.t > wait || (tr.helping != null && tr.helping > 5)) { tr.state = 'close'; tr.t = 0; this.torch.intensity = 0; c.leanTarget = 0; }
        break;
      }
      case 'close': {
        const k = sm(clamp(tr.t / 1.4)), top = tank.home;
        tank.g.position.lerpVectors(V(T.x + 0.38, ROOF_Y + PLINTH + 0.09, T.z + T.r + 0.06), top, k); tank.g.position.y += Math.sin(k * Math.PI) * 0.25; tank.g.rotation.y = -6 * (1 - k);
        c.reachTo('R', tank.g.position.clone().add(V(0, 0.05, 0)), 0.9);
        if (tr.t > 1.5) {
          if (tr.helped) { d.say('dad.tank.thanks', { loud: true }); g.addAnger(-12, 'help'); g.toast('ساعدت أبوك… «الله يرضى عليك» 💚', 'good'); }
          tr.state = 'toStairs2'; tr.walk = { pts: [[8.0, 4.0, ROOF_Y], [12.0, 4.2, ROOF_Y], [15.0, 0.9, ROOF_Y], [15.55, STAIR.z + 0.05, ROOF_Y]], i: 0, heavy: true }; c.reachTo('R', null);
        }
        break;
      }
      case 'toStairs2':
        c.play('m_walk_neutral_01', { speed: 0.8, fade: 0.2 });
        if (this.walkRoof(c, tr.walk, dt)) { tr.state = 'climbDown'; tr.st = { up: false, pts: this.path(false), i: 0, heavy: true }; }
        break;
      case 'climbDown':
        c.play('m_walk_neutral_01', { speed: 0.6, fade: 0.2 });
        if (this.stepAlong(c, tr.st, dt, 0.65)) {
          c.pos.y = 0; c.reachTo('L', null); c.reachTo('R', null); d.away = false; d.setState('routine'); d.phase = 'idle'; d.si = Math.max(-1, d.si - 1);
          this.trip = null; this.dadTrip = null; g.toast('أبوك نزل من السطح', 'bad');
        }
        break;
    }
    c.update(dt);
  }
  // straight lines across the roof (it is open; the tanks and the heater are walked round by the waypoints)
  walkRoof(c, st, dt, v = 1.0) {
    const [bx, bz] = st.pts[st.i], dx = bx - c.pos.x, dz = bz - c.pos.z, dd = Math.hypot(dx, dz), s = v * dt;
    c.pos.y = ROOF_Y;
    if (dd <= s) { c.pos.x = bx; c.pos.z = bz; st.i++; } else { c.pos.x += dx / dd * s; c.pos.z += dz / dd * s; c.heading = Math.atan2(dx, dz); }
    st.stepT = (st.stepT || 0) - dt * v * 2; if (st.stepT <= 0) { st.stepT = 1; sfx.step({ x: c.pos.x, y: c.pos.y + 0.1, z: c.pos.z }, 0.8, st.heavy); }
    return st.i >= st.pts.length;
  }
  // you holding the torch for him: the beam on the opening, five seconds of help
  helpTick(dt) {
    const g = this.game, p = g.player, c = p.char, tr = this.dadTrip;
    if (!tr || tr.state !== 'look') { p.state = 'free'; c.reachTo('R', null); c.look = null; return; }
    tr.helping += dt;
    const T = this.lids[tr.which].T, d = g.dad.char;
    c.heading = Math.atan2(T.x - c.pos.x, T.z - c.pos.z);
    c.reachTo('R', V(T.x + (c.pos.x - T.x) * 0.45, T.top + 0.35, T.z + (c.pos.z - T.z) * 0.45), 0.9); c.look = V(T.x, T.top, T.z);
    if (tr.helping > 5.2) { p.state = 'free'; c.reachTo('R', null); c.look = null; }
  }
}
