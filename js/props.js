// The small things: everything you carry, pour, chop, hang or scrub. Built from lathes, tubes and
// cut-out shapes rather than boxes, so a glass looks like a glass and a shirt like a shirt.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { flatMat } from './assets.js';
import { talabatBag } from './delivery.js';
import { gasCylinder, vegBag } from './vendors.js';

export const mat = (color, o) => flatMat(color, o);
const two = (m) => { const c = m.clone(); c.side = THREE.DoubleSide; return c; };
export const MAT = {
  glass: new THREE.MeshStandardMaterial({ color: 0xe6f4ff, roughness: 0.04, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }),
  bottle: new THREE.MeshStandardMaterial({ color: 0x7fc4f5, roughness: 0.08, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false }),
  water: new THREE.MeshStandardMaterial({ color: 0x8fd2ff, roughness: 0.05, transparent: true, opacity: 0.6 }),
  tea: new THREE.MeshStandardMaterial({ color: 0xa8430f, roughness: 0.08, transparent: true, opacity: 0.86 }),
  coffee: new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.15 }),
  steel: mat(0xcdd0d4, { rough: 0.22, metal: 0.92 }), brass: mat(0xc9a24a, { rough: 0.28, metal: 0.92 }), dark: mat(0x1b1c1f, { rough: 0.45 }),
  white: mat(0xf7f6f2, { rough: 0.3 }), porcelain: mat(0xfbfbfb, { rough: 0.12 }), wood: mat(0xb98a52, { rough: 0.7 }), straw: mat(0xd2b25c, { rough: 0.95 }),
  foam: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0.92 }),
  basket: two(mat(0x3f7fd9, { rough: 0.55 })), bucket: two(mat(0xcf3a2b, { rough: 0.5 })), bag: mat(0x121214, { rough: 0.25 }),
};
const clothMats = new Map();
export function clothMat(color) {
  if (!clothMats.has(color)) clothMats.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.95, side: THREE.DoubleSide }));
  return clothMats.get(color);
}

export function mesh(geo, material, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; return m; }
export function lathe(pts, material, seg = 18) { return mesh(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg), material); }
export function tube(pts, r, material, seg = 14) { return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), seg, r, 7), material); }
export function rbox(w, h, d, r, material, x = 0, y = 0, z = 0) { return mesh(new RoundedBoxGeometry(w, h, d, 2, r), material, x, y, z); }
export function cyl(rt, rb, h, material, x = 0, y = 0, z = 0, seg = 16) { return mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material, x, y, z); }
export function ball(r, material, x = 0, y = 0, z = 0, sy = 1) { const m = mesh(new THREE.SphereGeometry(r, 14, 10), material, x, y, z); m.scale.y = sy; return m; }
export function group(...kids) { const g = new THREE.Group(); for (const k of kids) g.add(k); return g; }
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ---------- clothes ----------
const SHAPES = {
  shirt: [[-0.07, 0], [-0.21, 0], [-0.35, -0.09], [-0.29, -0.2], [-0.19, -0.14], [-0.2, -0.5], [0.2, -0.5], [0.19, -0.14], [0.29, -0.2], [0.35, -0.09], [0.21, 0], [0.07, 0], [0, -0.05]],
  pants: [[-0.17, 0], [0.17, 0], [0.19, -0.64], [0.04, -0.64], [0, -0.2], [-0.04, -0.64], [-0.19, -0.64]],
  towel: [[-0.2, 0], [0.2, 0], [0.2, -0.56], [-0.2, -0.56]],
  thobe: [[-0.06, 0], [-0.2, 0], [-0.34, -0.1], [-0.28, -0.22], [-0.18, -0.16], [-0.24, -0.86], [0.24, -0.86], [0.18, -0.16], [0.28, -0.22], [0.34, -0.1], [0.2, 0], [0.06, 0], [0, -0.06]],
  sock: [[-0.04, 0], [0.04, 0], [0.04, -0.17], [0.13, -0.2], [0.13, -0.26], [-0.04, -0.26]],
  scarf: [[-0.13, 0], [0.13, 0], [0.15, -0.44], [0, -0.52], [-0.15, -0.44]],
};
const geoCache = {};
export const CLOTH_COLORS = [0x1f55b0, 0xa82f2f, 0xe8e4da, 0x2f7a48, 0xd0669a, 0xd9a520, 0x4a3a78, 0x23262e, 0xd06f1f, 0x4f95c4];
export const CLOTH_KINDS = ['shirt', 'pants', 'towel', 'shirt', 'thobe', 'scarf', 'pants', 'sock'];
// A garment hanging from its top edge (origin at the top centre), flat in XY.
export function garment(kind = 'shirt', color = 0x2f6fd0) {
  if (!geoCache[kind]) {
    const s = new THREE.Shape(SHAPES[kind].map(([x, y]) => new THREE.Vector2(x, y)));
    // a little thickness and a soft edge, so it reads as cloth and not paper
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 4 });
    g.translate(0, 0, -0.006);
    geoCache[kind] = g;
  }
  const m = mesh(geoCache[kind], clothMat(color)); m.userData.kind = kind; return m;
}
export function randomGarment(i = Math.floor(Math.random() * 99)) { return garment(CLOTH_KINDS[i % CLOTH_KINDS.length], CLOTH_COLORS[(i * 7 + 3) % CLOTH_COLORS.length]); }
export function peg(color = 0xe2b23a) { return mesh(new THREE.BoxGeometry(0.014, 0.05, 0.02), mat(color, { rough: 0.6 })); }

// Laundry basket; userData.fill(0..1) shows more or fewer clothes inside.
export function basket(fill = 1, wet = false) {
  const g = group(lathe([[0, 0.005], [0.2, 0.005], [0.25, 0.3], [0.262, 0.3]], MAT.basket, 20));
  const rim = mesh(new THREE.TorusGeometry(0.256, 0.014, 6, 22), mat(0x356bbb, { rough: 0.5 }), 0, 0.3, 0); rim.rotation.x = Math.PI / 2; g.add(rim);
  for (let i = 0; i < 9; i++) g.add(mesh(new THREE.BoxGeometry(0.012, 0.2, 0.004), mat(0x2c5aa0), Math.cos(i / 9 * 6.283) * 0.227, 0.16, Math.sin(i / 9 * 6.283) * 0.227));
  const clothes = [];
  if (!geoCache.lump) {            // a crumpled piece: a ball with creases pressed into it
    const lg = new THREE.SphereGeometry(0.105, 12, 9), q = lg.attributes.position;
    for (let i = 0; i < q.count; i++) { const x = q.getX(i), y = q.getY(i), z = q.getZ(i), k = 1 + 0.2 * Math.sin(x * 55 + y * 31) * Math.cos(z * 47 + y * 23) + 0.1 * Math.sin(z * 90 + x * 40); q.setXYZ(i, x * k, y * k, z * k); }
    lg.computeVertexNormals(); geoCache.lump = lg;
  }
  for (let i = 0; i < 7; i++) {
    const col = new THREE.Color(CLOTH_COLORS[(i * 7 + 3 + (wet ? 4 : 0)) % CLOTH_COLORS.length]); if (wet) col.multiplyScalar(0.72);
    const c = i === 6 ? garment('shirt', col.getHex()) : mesh(geoCache.lump, clothMat(col.getHex())), a = i * 2.4, rr = i === 0 || i === 6 ? 0.02 : 0.105;
    if (i === 6) { c.scale.setScalar(0.5); c.rotation.set(-1.45, 0.6, 0); c.position.set(0.02, 0.335, 0.12); } else { c.scale.set(1, 0.62, 0.9); c.rotation.set(i * 0.7, i * 1.9, i * 0.4); c.position.set(Math.cos(a) * rr, 0.11 + i * 0.036, Math.sin(a) * rr); }
    g.add(c); clothes.push(c);
  }
  const heap = ball(0.17, clothMat(wet ? 0x7d8fb0 : 0xd9d6cf), 0, 0.14, 0, 0.6); g.add(heap);
  g.userData.fill = (f) => { clothes.forEach((c, i) => { c.visible = i < Math.round(f * clothes.length); }); heap.visible = f > 0.15; heap.scale.set(1, 0.6 * Math.max(0.2, f), 1); };
  g.userData.fill(fill);
  return g;
}

// ---------- kitchen ----------
export function teaGlass(level = 1) {
  const g = group(lathe([[0, 0], [0.022, 0], [0.024, 0.004], [0.018, 0.03], [0.026, 0.07], [0.0275, 0.074]], MAT.glass, 14),
    lathe([[0, 0], [0.04, 0], [0.047, 0.006]], MAT.porcelain, 16));
  const tea = lathe([[0, 0.005], [0.0205, 0.005], [0.0165, 0.03], [0.0235, 0.063], [0, 0.063]], MAT.tea, 14);
  g.add(tea); g.children[0].position.y = 0.006; tea.position.y = 0.006;
  g.userData.level = (v) => { tea.visible = v > 0.03; tea.scale.y = Math.max(0.05, v); };
  g.userData.level(level);
  return g;
}
// A shawarma roll from the order: the bread, its paper sleeve, the filling showing where it has been bitten. Origin at the
// bottom end, along +Y. userData.bite() takes a bite off the top.
export function shawarma() {
  const bread = mat(0xd9ae6e, { rough: 0.85 }), paper = mat(0xf1ede2, { rough: 0.95 }), meat = mat(0x8a4b22, { rough: 0.75 });
  const top = cyl(0.023, 0.025, 0.1, bread, 0, 0.13, 0, 14), sleeve = cyl(0.0285, 0.0265, 0.12, paper, 0, 0.06, 0, 14);
  const cap = group(cyl(0.021, 0.021, 0.006, meat, 0, 0, 0, 14), rbox(0.012, 0.006, 0.006, 0.002, mat(0x6f9a2e), 0.006, 0.003, 0.004), rbox(0.009, 0.006, 0.008, 0.002, mat(0xc8402b), -0.007, 0.003, -0.005), rbox(0.01, 0.005, 0.006, 0.002, mat(0xf3eedc), 0.0, 0.003, -0.01));
  cap.position.y = 0.18;
  const g = group(top, sleeve, cap);
  let left = 1;
  g.userData.axis = new THREE.Vector3(0, 1, 0); g.userData.hold = -0.055;
  g.userData.bite = () => { left = Math.max(0.2, left - 0.22); top.scale.y = left; top.position.y = 0.08 + 0.05 * left; cap.position.y = 0.08 + 0.1 * left; };
  return g;
}
export function waterGlass(level = 1) {
  const g = group(lathe([[0, 0], [0.028, 0], [0.034, 0.105], [0.032, 0.105], [0.0265, 0.005], [0, 0.005]], MAT.glass, 16));
  const w = cyl(0.03, 0.026, 0.085, MAT.water, 0, 0.048, 0, 14); g.add(w);
  g.userData.level = (v) => { w.visible = v > 0.03; w.scale.y = Math.max(0.05, v); w.position.y = 0.006 + 0.0425 * Math.max(0.05, v); };
  g.userData.level(level);
  return g;
}
export function tray(r = 0.21, m = MAT.steel) { return lathe([[0, 0], [r, 0], [r + 0.012, 0.014], [r + 0.006, 0.014], [r - 0.004, 0.005], [0, 0.005]], m, 28); }
export function kettle() {
  const g = group(
    lathe([[0, 0], [0.086, 0], [0.1, 0.02], [0.106, 0.07], [0.09, 0.13], [0.062, 0.162], [0.058, 0.166]], MAT.steel, 22),
    lathe([[0, 0.19], [0.022, 0.184], [0.058, 0.166]], MAT.steel, 22), ball(0.014, MAT.dark, 0, 0.198, 0),
    tube([[0.092, 0.05, 0], [0.14, 0.085, 0], [0.175, 0.135, 0], [0.19, 0.165, 0]], 0.013, MAT.steel),
    tube([[-0.09, 0.125, 0], [-0.155, 0.13, 0], [-0.17, 0.075, 0], [-0.105, 0.03, 0]], 0.011, MAT.dark));
  g.userData.spout = new THREE.Vector3(0.195, 0.168, 0); g.userData.handle = new THREE.Vector3(-0.16, 0.09, 0);
  return g;
}
export function dallah() {
  const g = group(
    lathe([[0, 0], [0.062, 0], [0.068, 0.012], [0.04, 0.075], [0.034, 0.105], [0.056, 0.155], [0.05, 0.172]], MAT.brass, 22),
    lathe([[0.05, 0.172], [0.03, 0.2], [0.008, 0.23], [0, 0.262]], MAT.brass, 18), ball(0.011, MAT.brass, 0, 0.265, 0),
    tube([[0.045, 0.15, 0], [0.085, 0.165, 0], [0.125, 0.19, 0]], 0.017, MAT.brass),
    tube([[-0.05, 0.16, 0], [-0.11, 0.15, 0], [-0.115, 0.07, 0], [-0.055, 0.03, 0]], 0.009, MAT.brass));
  g.userData.spout = new THREE.Vector3(0.13, 0.192, 0); g.userData.handle = new THREE.Vector3(-0.11, 0.1, 0);
  return g;
}
export function finjan(level = 0) {
  const g = group(lathe([[0, 0], [0.014, 0], [0.023, 0.036], [0.0215, 0.036], [0.012, 0.003], [0, 0.003]], MAT.porcelain, 12));
  const rim = mesh(new THREE.TorusGeometry(0.0225, 0.0016, 4, 14), MAT.brass, 0, 0.036, 0); rim.rotation.x = Math.PI / 2; g.add(rim);
  const c = cyl(0.019, 0.013, 0.02, MAT.coffee, 0, 0.018, 0, 10); g.add(c);
  g.userData.level = (v) => { c.visible = v > 0.05; }; g.userData.level(level);
  return g;
}
export function plate(dirty = false) {
  const g = group(lathe([[0, 0], [0.07, 0], [0.112, 0.016], [0.116, 0.018], [0.07, 0.006], [0, 0.006]], MAT.porcelain, 24));
  if (dirty) {
    const stains = group();
    for (let i = 0; i < 4; i++) stains.add(ball(0.014 + Math.random() * 0.012, mat([0x8a5a2b, 0xb5462f, 0xc9a23c, 0x6b7a2e][i], { rough: 0.9 }), Math.cos(i * 1.9) * 0.035, 0.009, Math.sin(i * 1.9) * 0.035, 0.3));
    g.add(stains); g.userData.stains = stains;
  }
  return g;
}
export function knife() {
  const blade = new THREE.Shape([[0, 0], [0.17, 0.004], [0.185, 0.02], [0, 0.036]].map(([x, y]) => new THREE.Vector2(x, y)));
  const b = mesh(new THREE.ExtrudeGeometry(blade, { depth: 0.002, bevelEnabled: false }), MAT.steel); b.position.set(0, -0.012, -0.001);
  return group(b, rbox(0.1, 0.026, 0.018, 0.006, MAT.dark, -0.05, 0.004, 0));       // origin where blade meets handle, blade along +X
}
export function board() { return group(rbox(0.38, 0.022, 0.27, 0.008, MAT.wood, 0, 0.011, 0)); }
export function veg(kind) {
  if (kind === 'tomato') return group(ball(0.042, mat(0xd3261a, { rough: 0.35 }), 0, 0.038, 0, 0.9), cyl(0.008, 0.012, 0.008, mat(0x3f7a3a), 0, 0.078, 0, 6));
  if (kind === 'cucumber') { const c = mesh(new THREE.CapsuleGeometry(0.02, 0.13, 4, 10), mat(0x2f7a35, { rough: 0.5 }), 0, 0.02, 0); c.rotation.z = Math.PI / 2; return group(c); }
  const o = group(ball(0.046, mat(0x8e3a6b, { rough: 0.4 }), 0, 0.04, 0, 0.88), mesh(new THREE.ConeGeometry(0.012, 0.03, 6), mat(0xc9a779), 0.046, 0.04, 0));
  o.children[1].rotation.z = -Math.PI / 2;
  return o;
}
export function slice(kind) {
  const c = { onion: [0x8e3a6b, 0xf4ecf2], tomato: [0xc9221a, 0xf08a6a], cucumber: [0x2f7a35, 0xd8f0c0] }[kind] || [0x8e3a6b, 0xf4ecf2];
  const r = kind === 'cucumber' ? 0.02 : 0.04;
  const g = group(cyl(r, r, 0.006, mat(c[0], { rough: 0.5 }), 0, 0, 0, 14), cyl(r * 0.86, r * 0.86, 0.0066, mat(c[1], { rough: 0.5 }), 0, 0, 0, 14));
  if (kind === 'onion') for (const k of [0.62, 0.34]) { const t = mesh(new THREE.TorusGeometry(r * k, 0.0012, 4, 14), mat(c[0]), 0, 0.0034, 0); t.rotation.x = Math.PI / 2; g.add(t); }
  return g;
}
export function sponge() { return group(rbox(0.1, 0.03, 0.065, 0.01, mat(0xf2cf3a, { rough: 0.95 }), 0, 0, 0), rbox(0.1, 0.012, 0.065, 0.005, mat(0x3f8f4a, { rough: 1 }), 0, 0.02, 0)); }
export function bucket() {
  const g = group(lathe([[0, 0.004], [0.12, 0.004], [0.165, 0.27], [0.172, 0.27]], MAT.bucket, 20));
  const h = mesh(new THREE.TorusGeometry(0.17, 0.006, 5, 18, Math.PI), MAT.steel, 0, 0.27, 0); h.rotation.set(0, 0, 0); h.userData.h = 1; g.add(h);
  const w = cyl(0.155, 0.125, 0.01, MAT.water, 0, 0.02, 0, 18); g.add(w);
  const foam = group(); for (let i = 0; i < 7; i++) foam.add(ball(0.04 + Math.random() * 0.03, MAT.foam, Math.cos(i) * 0.08, 0, Math.sin(i * 1.7) * 0.08, 0.6)); g.add(foam); foam.visible = false;
  g.userData.level = (v) => { w.visible = v > 0.02; const y = 0.02 + v * 0.2; w.position.y = y; const r = (0.125 + (0.158 - 0.125) * (y / 0.27)) / 0.14; w.scale.set(r, 1, r); foam.position.y = y + 0.02; };
  g.userData.foam = (on) => { foam.visible = on; };
  g.userData.level(0);
  return g;
}
export function wateringCan() {
  const g = group(cyl(0.085, 0.095, 0.18, mat(0x3f8f5a, { rough: 0.45 }), 0, 0.09, 0, 18),
    tube([[0.08, 0.04, 0], [0.19, 0.12, 0], [0.27, 0.2, 0]], 0.014, mat(0x3f8f5a, { rough: 0.45 })),
    tube([[-0.08, 0.15, 0], [-0.16, 0.13, 0], [-0.16, 0.05, 0], [-0.09, 0.03, 0]], 0.011, mat(0x2f6f45)),
    tube([[-0.05, 0.18, 0], [0, 0.25, 0], [0.05, 0.18, 0]], 0.009, mat(0x2f6f45)));
  const rose = mesh(new THREE.ConeGeometry(0.035, 0.04, 12), mat(0x2f6f45), 0.285, 0.213, 0); rose.rotation.z = -Math.PI / 2 - 0.6; g.add(rose);
  g.userData.spout = new THREE.Vector3(0.3, 0.225, 0);
  return g;
}
export function broom() {      // origin at the bristle tips, handle up +Y
  const g = group(cyl(0.012, 0.012, 1.25, MAT.wood, 0, 0.78, 0, 8), rbox(0.3, 0.05, 0.055, 0.012, mat(0xb5462f, { rough: 0.6 }), 0, 0.15, 0));
  for (let i = 0; i < 9; i++) { const b = mesh(new THREE.BoxGeometry(0.03, 0.14, 0.045), MAT.straw, -0.132 + i * 0.033, 0.065, 0); b.rotation.z = (i - 4) * 0.035; g.add(b); }
  return g;
}
export function dustpan() {      // origin at the lip, handle back along -X
  const m = mat(0x3f7fd9, { rough: 0.5 });
  return group(rbox(0.26, 0.008, 0.26, 0.003, m, -0.13, 0.004, 0), rbox(0.012, 0.07, 0.26, 0.004, m, -0.255, 0.035, 0), rbox(0.24, 0.05, 0.012, 0.004, m, -0.135, 0.025, 0.125), rbox(0.24, 0.05, 0.012, 0.004, m, -0.135, 0.025, -0.125), tube([[-0.26, 0.05, 0], [-0.36, 0.09, 0], [-0.46, 0.1, 0]], 0.014, m, 8));
}
export function leaf() {
  const m = mesh(new THREE.CircleGeometry(0.045, 7), clothMat([0x9a6b2a, 0xc98a2b, 0x7a8a2e, 0xb5562a, 0x6b4a22][Math.floor(Math.random() * 5)]));
  m.scale.set(1, 0.55, 1); m.rotation.x = -Math.PI / 2; m.castShadow = false; return m;
}
export function trashBag() { return group(lathe([[0, 0], [0.13, 0.03], [0.17, 0.16], [0.14, 0.29], [0.045, 0.36], [0.03, 0.39], [0.06, 0.44], [0.02, 0.45]], MAT.bag, 14)); }

// ---------- study / play ----------
export function book(open = true) {
  const page = canvasTex(256, 320, (g, w, h) => {
    g.fillStyle = '#fbf8ee'; g.fillRect(0, 0, w, h); g.fillStyle = '#4a4a4a';
    for (let i = 0; i < 13; i++) g.fillRect(22, 30 + i * 21, w - 44 - (i % 4 === 3 ? 90 : 0), 5);
    g.strokeStyle = '#2f6fd0'; g.lineWidth = 3; g.strokeRect(40, 232, 120, 66); g.beginPath(); g.moveTo(40, 298); g.lineTo(100, 240); g.lineTo(160, 298); g.stroke();
  });
  const pm = new THREE.MeshStandardMaterial({ map: page, roughness: 0.9 });
  const g = group(rbox(0.31, 0.012, 0.215, 0.003, mat(0x1f4b8f, { rough: 0.7 }), 0, 0.006, 0));
  for (const s of [-1, 1]) {
    const blk = rbox(0.145, 0.014, 0.2, 0.002, MAT.white, s * 0.075, 0.019, 0); blk.rotation.z = -s * 0.06; g.add(blk);
    const p = mesh(new THREE.PlaneGeometry(0.14, 0.195), pm, s * 0.075, 0.031, 0); p.rotation.x = -Math.PI / 2; p.castShadow = false; g.add(p);
  }
  // a page that turns
  const flip = new THREE.Group(); const fp = mesh(new THREE.PlaneGeometry(0.14, 0.195), new THREE.MeshStandardMaterial({ map: page, roughness: 0.9, side: THREE.DoubleSide }), 0.07, 0, 0); fp.rotation.x = -Math.PI / 2; fp.castShadow = false; flip.add(fp); flip.position.y = 0.033; g.add(flip);
  g.userData.flip = flip; flip.visible = false;
  return g;
}
export function notebook() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 320;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const draw = (u) => {
    const g = c.getContext('2d'); g.fillStyle = '#fffdf4'; g.fillRect(0, 0, 256, 320);
    g.strokeStyle = '#b9d0ee'; g.lineWidth = 1; for (let i = 0; i < 13; i++) { g.beginPath(); g.moveTo(0, 34 + i * 22); g.lineTo(256, 34 + i * 22); g.stroke(); }
    g.strokeStyle = '#e88'; g.beginPath(); g.moveTo(228, 0); g.lineTo(228, 320); g.stroke();
    g.strokeStyle = '#1d2a55'; g.lineWidth = 2.2; g.lineCap = 'round';
    const total = u * 12;
    for (let i = 0; i < 12 && i < total; i++) {
      const part = Math.min(1, total - i), y = 30 + i * 22;
      g.beginPath();
      for (let x = 0; x <= 196 * part; x += 4) { const px = 218 - x, py = y + Math.sin(x * 0.35 + i * 2) * 4 + Math.sin(x * 0.11 + i) * 3; if (x === 0) g.moveTo(px, py); else g.lineTo(px, py); }
      g.stroke();
    }
    tex.needsUpdate = true;
  };
  draw(0);
  const g = group(rbox(0.16, 0.008, 0.21, 0.003, mat(0xd24b3a, { rough: 0.8 }), 0, 0.004, 0));
  const p = mesh(new THREE.PlaneGeometry(0.152, 0.2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), 0, 0.0086, 0); p.rotation.x = -Math.PI / 2; p.castShadow = false; g.add(p);
  g.userData.write = draw;
  return g;
}
export function pencil() { const g = group(cyl(0.004, 0.004, 0.15, mat(0xf0c23a, { rough: 0.6 }), 0, 0.085, 0, 6), mesh(new THREE.ConeGeometry(0.004, 0.014, 6), mat(0x2a2a2a), 0, 0.003, 0), cyl(0.0045, 0.0045, 0.012, mat(0xd66a7a), 0, 0.166, 0, 6)); g.children[1].rotation.x = Math.PI; return g; }
export function controller() {
  const body = mat(0x1a1c22, { rough: 0.5 });
  const g = group(rbox(0.15, 0.03, 0.07, 0.014, body, 0, 0, 0), rbox(0.045, 0.035, 0.09, 0.016, body, -0.062, -0.008, 0.03), rbox(0.045, 0.035, 0.09, 0.016, body, 0.062, -0.008, 0.03));
  for (const [x, z, c] of [[0.05, -0.008, 0xdd3333], [0.062, -0.017, 0x33aa77], [0.038, -0.017, 0x3377dd], [0.05, -0.026, 0xddbb33]]) g.add(cyl(0.006, 0.006, 0.004, mat(c), x, 0.017, z, 8));
  g.add(cyl(0.011, 0.011, 0.008, mat(0x333842), -0.03, 0.018, 0.005, 10), cyl(0.011, 0.011, 0.008, mat(0x333842), 0.022, 0.018, 0.012, 10));
  const led = mesh(new THREE.BoxGeometry(0.04, 0.004, 0.004), new THREE.MeshStandardMaterial({ color: 0x113355, emissive: 0x3aa0ff, emissiveIntensity: 2 }), 0, 0.006, -0.036); g.add(led);
  return g;
}
export function phone() {
  const tex = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#0e1a14'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f7a55'; g.fillRect(0, 0, w, 30);
    [[8, 44, 70, '#22303a'], [50, 78, 70, '#1f7a55'], [8, 112, 86, '#22303a'], [38, 146, 82, '#1f7a55'], [8, 180, 60, '#22303a'], [56, 214, 64, '#1f7a55']].forEach(([x, y, ww, c]) => { g.fillStyle = c; g.beginPath(); g.roundRect(x, y, ww, 24, 8); g.fill(); });
  });
  const g = group(rbox(0.072, 0.009, 0.148, 0.004, MAT.dark, 0, 0, 0));
  const s = mesh(new THREE.PlaneGeometry(0.064, 0.136), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.95, roughness: 0.2 }), 0, 0.0052, 0); s.rotation.x = -Math.PI / 2; s.castShadow = false; g.add(s);
  return g;
}
export function schoolBag() {
  return group(rbox(0.3, 0.36, 0.15, 0.04, mat(0x27508f, { rough: 0.85 }), 0, 0.18, 0), rbox(0.24, 0.16, 0.05, 0.02, mat(0x1f3f72, { rough: 0.85 }), 0, 0.11, 0.09),
    rbox(0.3, 0.08, 0.16, 0.03, mat(0x1f3f72, { rough: 0.85 }), 0, 0.33, 0), tube([[-0.05, 0.36, 0], [0, 0.42, 0], [0.05, 0.36, 0]], 0.008, MAT.dark));
}
export function schoolBook(i = 0) { return rbox(0.17, 0.022, 0.23, 0.004, mat([0xc24b4b, 0x3f8f5a, 0xf0c23a, 0x5b4a8a][i % 4], { rough: 0.8 })); }

// ---------- food ----------
export function mansaf() {
  const g = group(lathe([[0, 0], [0.28, 0], [0.31, 0.03], [0.3, 0.032], [0.27, 0.012], [0, 0.012]], MAT.steel, 30), cyl(0.275, 0.275, 0.006, mat(0xd9c39a, { rough: 0.95 }), 0, 0.016, 0, 26));
  const rice = lathe([[0, 0.115], [0.09, 0.1], [0.18, 0.065], [0.25, 0.02], [0.262, 0.018]], mat(0xf3df9a, { rough: 0.95 }), 26); g.add(rice);
  const meat = group();
  for (let i = 0; i < 7; i++) { const m = mesh(new THREE.DodecahedronGeometry(0.038 + Math.random() * 0.014, 0), mat(i % 2 ? 0x6b3b22 : 0x7d4a2a, { rough: 0.8 }), Math.cos(i * 0.9) * 0.1, 0.105 - (i % 3) * 0.012, Math.sin(i * 0.9) * 0.1); m.scale.y = 0.7; m.rotation.set(i, i * 2, i); meat.add(m); }
  for (let i = 0; i < 26; i++) { const a = i * 2.4, r = 0.04 + (i % 9) * 0.022; meat.add(ball(0.007, mat(i % 3 ? 0xe8cf9a : 0x4f8a35, { rough: 0.7 }), Math.cos(a) * r, 0.118 - r * 0.38, Math.sin(a) * r, 0.6)); }
  g.add(meat);
  g.userData.eaten = (u) => { rice.scale.set(1, 1 - u * 0.5, 1); meat.children.forEach((m, i) => { m.visible = i >= Math.floor(u * 5) || i >= 7; }); meat.position.y = -u * 0.05; };
  return g;
}
export function laban() { return group(lathe([[0, 0], [0.05, 0], [0.095, 0.075], [0.1, 0.078], [0.09, 0.07], [0.05, 0.008], [0, 0.008]], MAT.porcelain, 20), cyl(0.088, 0.088, 0.004, mat(0xf7f3e6, { rough: 0.3 }), 0, 0.066, 0, 20), tube([[0.03, 0.06, 0], [0.09, 0.12, 0], [0.13, 0.17, 0]], 0.006, MAT.steel)); }
export function kunafa(missing = false) {
  const tex = canvasTex(256, 256, (g) => {
    g.fillStyle = '#d97b12'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) { g.fillStyle = ['#e8921f', '#c96a0c', '#f0a53a', '#b85c08'][i % 4]; g.fillRect(Math.random() * 256, Math.random() * 256, 3, 1.5); }
    g.strokeStyle = 'rgba(120,60,0,.55)'; g.lineWidth = 1.5; for (let i = -6; i < 12; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 + 256, 256); g.moveTo(i * 32 + 256, 0); g.lineTo(i * 32, 256); g.stroke(); }
    g.fillStyle = '#5c9c3a'; g.beginPath(); g.arc(128, 128, 30, 0, 7); g.fill(); for (let i = 0; i < 160; i++) { g.fillStyle = i % 2 ? '#7bbf4a' : '#4a8a2c'; g.fillRect(104 + Math.random() * 48, 104 + Math.random() * 48, 3, 3); }
    if (missing) { g.fillStyle = '#b9bcc0'; g.beginPath(); g.moveTo(128, 128); g.arc(128, 128, 140, -0.2, 0.55); g.fill(); g.fillStyle = '#7a3d06'; g.beginPath(); g.moveTo(128, 128); g.arc(128, 128, 140, -0.26, -0.2); g.arc(128, 128, 140, 0.55, 0.61); g.fill(); }
  });
  const top = mesh(new THREE.CircleGeometry(0.185, 30), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 }), 0, 0.034, 0); top.rotation.x = -Math.PI / 2; top.castShadow = false;
  return group(tray(0.2), cyl(0.186, 0.186, 0.024, mat(0xc96a0c, { rough: 0.5 }), 0, 0.021, 0, 30), top);
}
export function breakfast() {
  const g = group(plate(), lathe([[0, 0], [0.035, 0], [0.06, 0.03], [0.064, 0.031], [0.035, 0.006], [0, 0.006]], MAT.porcelain, 16));
  g.children[1].position.set(0.2, 0, -0.03); g.add(cyl(0.056, 0.056, 0.004, mat(0xe2c98f, { rough: 0.5 }), 0.2, 0.026, -0.03, 16), ball(0.012, mat(0x6b7a2e), 0.2, 0.03, -0.03, 0.4));
  const bites = [];
  for (let i = 0; i < 5; i++) { const f = ball(0.021, mat(0x7a4a1e, { rough: 0.95 }), Math.cos(i * 1.26) * 0.045, 0.026, Math.sin(i * 1.26) * 0.045, 0.75); g.add(f); bites.push(f); }
  const bread = cyl(0.085, 0.085, 0.008, mat(0xe6cfa0, { rough: 0.95 }), -0.2, 0.006, 0.02, 20); g.add(bread); bites.push(bread);
  for (let i = 0; i < 4; i++) { const o = ball(0.009, mat(i % 2 ? 0x2a2a1e : 0x5a6a2a), -0.06 + i * 0.022, 0.012, 0.12, 1.2); g.add(o); bites.push(o); }
  const tg = teaGlass(1); tg.position.set(0.1, 0, 0.13); g.add(tg);
  g.userData.eaten = (u) => { bites.forEach((b, i) => { b.visible = i >= Math.floor(u * bites.length + 0.001); }); tg.userData.level(1 - u * 0.8); };
  return g;
}

// ---------- everything you can carry ----------
const BUILD = {
  tea() { const g = group(tray(0.2)); for (const [x, z] of [[-0.075, -0.03], [0.075, -0.03], [0, 0.09]]) { const t = teaGlass(1); t.position.set(x, 0.006, z); g.add(t); } g.add(lathe([[0, 0], [0.03, 0], [0.036, 0.04], [0.034, 0.04]], MAT.porcelain, 12)); g.children[4].position.set(0, 0.006, -0.11); g.add(ball(0.01, mat(0x3f8f3a), 0.075, 0.075, -0.03)); return g; },
  coffee() { const g = group(tray(0.2, MAT.brass)); const d = dallah(); d.position.set(-0.07, 0.006, 0); g.add(d); for (const [x, z] of [[0.07, -0.07], [0.1, 0.03], [0.03, 0.11]]) { const f = finjan(0); f.position.set(x, 0.006, z); g.add(f); } return g; },
  cups() { const g = group(tray(0.2, MAT.brass)); for (let i = 0; i < 6; i++) { const f = finjan(0); f.position.set(Math.cos(i * 1.047) * 0.1, 0.006, Math.sin(i * 1.047) * 0.1); g.add(f); } return g; },
  kunafa: () => kunafa(false), mansaf, laban,
  water: () => waterGlass(1),
  laundry: () => basket(1, false), clothes: () => basket(1, false), wet: () => basket(1, true),
  trash: trashBag,
  talabat: talabatBag,
  gasEmpty: () => gasCylinder(false, 0x2f7f6a), gasFull: () => gasCylinder(true, 0x4f9e74), veg: vegBag,
  tomato() { const g = group(lathe([[0, 0], [0.05, 0], [0.085, 0.045], [0.09, 0.046], [0.05, 0.006], [0, 0.006]], MAT.porcelain, 16)); for (const [x, z, y] of [[-0.03, 0, 0.05], [0.035, 0.015, 0.05], [0, -0.035, 0.05], [0.005, 0.01, 0.1]]) g.add(ball(0.038, mat(0xd3261a, { rough: 0.35 }), x, y, z, 0.9)); return g; },
  chocolate() {
    const bar = rbox(0.07, 0.014, 0.15, 0.004, mat(0x4a2410, { rough: 0.5 }), 0, 0.008, 0);
    const g = group(bar, rbox(0.074, 0.016, 0.09, 0.004, mat(0xc4212b, { rough: 0.4 }), 0, 0.008, 0.032), rbox(0.05, 0.017, 0.03, 0.003, MAT.brass, 0, 0.008, 0.035));
    // eaten from the open end (-Z), held by the wrapper
    let left = 1;
    g.userData.axis = new THREE.Vector3(0, 0, -1); g.userData.hold = 0.035;
    g.userData.bite = () => { left = Math.max(0.35, left - 0.16); bar.scale.z = left; bar.position.z = 0.075 * (1 - left); };
    return g;
  },
  remote() { const g = group(rbox(0.046, 0.02, 0.17, 0.008, MAT.dark, 0, 0.01, 0), cyl(0.007, 0.007, 0.004, mat(0xd22b2b), 0.012, 0.021, -0.066, 8)); for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) g.add(rbox(0.008, 0.004, 0.008, 0.001, mat(r === 1 ? 0x8a8f99 : 0x555a63), -0.012 + c * 0.012, 0.021, -0.04 + r * 0.024)); return g; },
  glasses() { const g = group(); for (const x of [-0.03, 0.03]) { const r = mesh(new THREE.TorusGeometry(0.024, 0.003, 6, 18), MAT.dark, x, 0.024, 0); g.add(r); const l = mesh(new THREE.CircleGeometry(0.022, 16), MAT.glass, x, 0.024, 0); l.castShadow = false; g.add(l); g.add(tube([[x * 1.8, 0.03, 0], [x * 1.9, 0.03, -0.06], [x * 1.85, 0.018, -0.12]], 0.002, MAT.dark, 6)); } g.add(tube([[-0.008, 0.03, 0], [0, 0.036, 0], [0.008, 0.03, 0]], 0.0025, MAT.dark, 4)); return g; },
  charger() { return group(rbox(0.04, 0.03, 0.045, 0.006, MAT.white, 0, 0.015, 0), cyl(0.003, 0.003, 0.016, MAT.steel, -0.008, 0.015, -0.03, 6), cyl(0.003, 0.003, 0.016, MAT.steel, 0.008, 0.015, -0.03, 6), tube([[0, 0.012, 0.022], [0.03, 0.006, 0.06], [0.07, 0.006, 0.03], [0.06, 0.006, -0.03], [0.1, 0.006, -0.02]], 0.003, MAT.white, 16), rbox(0.012, 0.007, 0.022, 0.002, MAT.white, 0.108, 0.006, -0.018)); },
  paper() {
    const tex = canvasTex(256, 360, (g, w, h) => { g.fillStyle = '#e9e5d8'; g.fillRect(0, 0, w, h); g.fillStyle = '#161616'; g.font = 'bold 44px "Amiri","Segoe UI",serif'; g.textAlign = 'center'; g.direction = 'rtl'; g.fillText('أخبار الحارة', w / 2, 48); g.fillRect(14, 60, w - 28, 3); g.font = 'bold 22px "Segoe UI",sans-serif'; g.fillText('الكهربا غالية والأب معصّب', w / 2, 92); g.fillStyle = '#8f8f8f'; g.fillRect(14, 108, 110, 80); g.fillStyle = '#3c3c3c'; for (let i = 0; i < 14; i++) { g.fillRect(134, 110 + i * 9, 108, 3); g.fillRect(14, 200 + i * 10, w - 28, 3); } });
    const p = mesh(new THREE.PlaneGeometry(0.21, 0.3), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }), 0, 0.021, 0); p.rotation.x = -Math.PI / 2; p.castShadow = false;
    return group(rbox(0.215, 0.02, 0.305, 0.006, mat(0xdedacb, { rough: 0.95 }), 0, 0.01, 0), p);
  },
  slipper() {
    const sole = new THREE.Shape(); sole.absellipse(0, 0, 0.05, 0.135, 0, Math.PI * 2);
    const s = mesh(new THREE.ExtrudeGeometry(sole, { depth: 0.018, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1 }), mat(0x1f5fc4, { rough: 0.75 })); s.rotation.x = -Math.PI / 2;
    const strap = mesh(new THREE.TorusGeometry(0.047, 0.013, 6, 14, Math.PI), mat(0x174a9c, { rough: 0.7 }), 0, 0.02, -0.045);
    return group(s, strap);
  },
  socks() { const g = group(); for (const [x, r] of [[-0.05, 0.3], [0.05, -0.4]]) { const s = garment('sock', 0xf2f0ea); s.scale.setScalar(0.8); s.rotation.set(-Math.PI / 2, 0, r); s.position.set(x, 0.008, 0); g.add(s); } return g; },
  toys() { const g = group(ball(0.09, mat(0xe8a92c, { rough: 0.5 }), 0, 0.09, 0), rbox(0.2, 0.06, 0.09, 0.02, mat(0xc33a2c, { rough: 0.4 }), 0.16, 0.05, 0.02), rbox(0.11, 0.04, 0.08, 0.015, mat(0xbfe0f5, { rough: 0.2 }), 0.15, 0.09, 0.02), rbox(0.09, 0.09, 0.09, 0.012, mat(0x2f6fd0), -0.13, 0.045, 0.05), rbox(0.09, 0.09, 0.09, 0.012, mat(0x3f8f5a), -0.12, 0.135, 0.04)); for (const [x, z] of [[0.09, 0.07], [0.23, 0.07], [0.09, -0.03], [0.23, -0.03]]) { const w = cyl(0.025, 0.025, 0.02, MAT.dark, x, 0.025, z, 10); w.rotation.x = Math.PI / 2; g.add(w); } return g; },
  plate() { return plate(true); },
  vase() { const g = group(); for (let i = 0; i < 7; i++) { const m = mesh(new THREE.TetrahedronGeometry(0.04 + Math.random() * 0.045), mat(0x2c6b8f, { rough: 0.2 }), Math.cos(i) * 0.13, 0.03, Math.sin(i * 1.7) * 0.13); m.rotation.set(i, i * 2, i * 3); g.add(m); } return g; },
  juice: () => spill(0xe07b1a, true), teaspill: () => spill(0x7a3410, false),
  waterspill: () => spill(0xa9d8f5, false, 0.45), coffeespill: () => spill(0x2e1b0e, false), labanspill: () => spill(0xf6f4ee, false, 0.95),
  kunafaspill: () => splat(0xd98a2b, [0xe8a23a, 0xc7711f, 0x6a8f3a]), mansafspill: () => splat(0xf1ecdc, [0x6a3c1e, 0x7a4a26, 0xf7f3e6, 0xf7f3e6]),
};
// food on the floor: a smear with lumps of what it was
function splat(color, lumps) {
  const g = spill(color, false, 0.95);
  for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 0.05 + (i % 4) * 0.045; g.add(ball(0.025 + (i % 3) * 0.012, mat(lumps[i % lumps.length], { rough: 0.8 }), Math.cos(a) * r, 0.02, Math.sin(a) * r, 0.6)); }
  return g;
}
export function rag() { return mesh(new RoundedBoxGeometry(0.17, 0.018, 0.13, 1, 0.008), clothMat(0xe8c93a)); }
function spill(color, cup, opacity = 0.82) {
  const s = new THREE.Shape();
  for (let i = 0; i <= 18; i++) { const a = i / 18 * Math.PI * 2, r = 0.24 + Math.sin(i * 2.3) * 0.07 + Math.cos(i * 1.3) * 0.05; if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const m = mesh(new THREE.ShapeGeometry(s), new THREE.MeshStandardMaterial({ color, roughness: 0.08, transparent: true, opacity }), 0, 0.009, 0); m.rotation.x = -Math.PI / 2; m.castShadow = false;
  const g = group(m);
  if (cup) { const c = lathe([[0, 0], [0.028, 0], [0.034, 0.1], [0.032, 0.1]], MAT.glass, 12); c.rotation.z = 1.45; c.position.set(0.2, 0.03, 0.1); g.add(c); }
  return g;
}
export function makeItem(kind) { return (BUILD[kind] || (() => group(rbox(0.12, 0.12, 0.12, 0.02, MAT.white, 0, 0.06, 0))))(); }
