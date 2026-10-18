// The two trucks every street in Amman knows. The gas truck: a blue Porter with its cage of worn green cylinders,
// «Für Elise» coming out of the horn on its roof long before you see it; dad shouts for the empty cylinder, you take
// it out from beside the cooker, swap it at the gate for a full one (seven dinars), carry that back (it is heavy) and
// screw the regulator on again. The vegetable truck: crates of tomatoes, cucumbers, potatoes, aubergines, watermelons
// on the floor, cardboard prices, a hanging dial scale, an umbrella, and a man calling his wares through a loudspeaker;
// mom sends you for tomatoes and cucumbers, he weighs them, bags them, and they go in the fridge drawer.
// The man is the visiting uncle's model in his own clothes (he only comes on Thursdays, and never on those days).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loft, spline, grid, rod, tube, mesh, paint } from './delivery.js';
import { sfx } from './audio.js';
import { Outfit, WARDROBE } from './outfit.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const sm = (t) => t * t * (3 - 2 * t);
const clamp = (t) => Math.max(0, Math.min(1, t));
const BLUE = 0x2463ad, GLASS = 0x0e1b26;
WARDROBE.uncle = { ...(WARDROBE.uncle || {}), gasman: { top: 0x26334a, bottom: 0x3a3c40, untucked: true }, vegman: { top: 0x6b5843, bottom: 0x2d3137, untucked: true } };

// ---------- materials and their pictures ----------
let MT = null;
function mats() {
  if (MT) return MT;
  const m = (o) => new THREE.MeshStandardMaterial(o);
  const plate = paint(256, 150, (g, W, H) => {
    g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, W, H); g.strokeStyle = '#111'; g.lineWidth = 7; g.strokeRect(5, 5, W - 10, H - 10);
    g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.direction = 'rtl'; g.font = 'bold 28px Cairo, "Segoe UI", sans-serif'; g.fillText('الأردن', 82, 36); g.direction = 'ltr'; g.font = 'bold 22px "Segoe UI", sans-serif'; g.fillText('JORDAN', 178, 38);
    g.font = 'bold 60px "Segoe UI", sans-serif'; g.fillText('20-71644', W / 2, 102, 226);
  });
  const placard = paint(256, 170, (g, W, H) => {
    g.fillStyle = '#f2c618'; g.fillRect(0, 0, W, H); g.strokeStyle = '#1a1a1a'; g.lineWidth = 6; g.strokeRect(4, 4, W - 8, H - 8);
    g.fillStyle = '#1a1a1a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
    g.font = '900 70px Cairo, "Segoe UI", sans-serif'; g.fillText('غاز', W / 2, 62); g.font = 'bold 30px Cairo, "Segoe UI", sans-serif'; g.fillText('توزيع اسطوانات', W / 2, 128);
  });
  // a cylinder's paint after years of being dropped off trucks: the colour (tinted per cylinder), chips, scrapes, rust
  const worn = paint(256, 256, (g, W, H) => {
    g.fillStyle = '#e6e6e2'; g.fillRect(0, 0, W, H);
    let s = 7; const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(${90 + R() * 40},${60 + R() * 20},${40 + R() * 15},${0.25 + R() * 0.5})`; g.beginPath(); g.ellipse(R() * W, R() * H, 2 + R() * 10, 1 + R() * 5, R() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(200,200,195,${0.3 + R() * 0.4})`; g.lineWidth = 1 + R() * 2; g.beginPath(); const x = R() * W, y = R() * H; g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 50, y + (R() - 0.5) * 8); g.stroke(); }
    g.fillStyle = 'rgba(70,45,30,0.6)'; g.fillRect(0, H * 0.92, W, H * 0.08);      // rust round the foot
  });
  const crate = paint(128, 128, (g, W, H) => {
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(0,0,0,0.55)';
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) g.fillRect(8 + c * 19.5, 18 + r * 26, 12, 14);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, W, 8); g.fillRect(0, H - 6, W, 6);
  });
  const melon = paint(256, 128, (g, W, H) => {
    g.fillStyle = '#2f6b2a'; g.fillRect(0, 0, W, H); g.strokeStyle = '#9cc46b'; g.lineWidth = 7;
    for (let i = 0; i < 12; i++) { g.beginPath(); for (let y = 0; y <= H; y += 8) { const x = i * W / 12 + Math.sin(y * 0.15 + i) * 5; y ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  });
  const dial = paint(128, 128, (g, W) => {
    g.fillStyle = '#fbfaf4'; g.beginPath(); g.arc(W / 2, W / 2, 60, 0, 7); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 2;
    for (let i = 0; i < 40; i++) { const a = -Math.PI / 2 + i / 40 * Math.PI * 2, r1 = i % 5 ? 52 : 46; g.beginPath(); g.moveTo(W / 2 + Math.cos(a) * r1, W / 2 + Math.sin(a) * r1); g.lineTo(W / 2 + Math.cos(a) * 58, W / 2 + Math.sin(a) * 58); g.stroke(); }
    g.fillStyle = '#c62b23'; g.font = 'bold 14px sans-serif'; g.textAlign = 'center'; g.fillText('10 kg', W / 2, W / 2 + 26);
  });
  const sign = (a, b) => paint(256, 160, (g, W, H) => {
    g.fillStyle = '#c9a36b'; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(90,60,30,0.25)'; for (let i = 0; i < 9; i++) g.fillRect(0, i * 18, W, 2);
    g.fillStyle = '#1b1b1b'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
    g.font = '900 54px Cairo, "Segoe UI", sans-serif'; g.fillText(a, W / 2, 52, 236); g.font = '900 44px Cairo, "Segoe UI", sans-serif'; g.fillText(b, W / 2, 116, 236);
  });
  const brolly = paint(256, 64, (g, W, H) => { const c = ['#d6312b', '#f4f1e8', '#2a64b8', '#f4f1e8', '#e8b92c', '#f4f1e8', '#2f8a3c', '#f4f1e8']; for (let i = 0; i < 8; i++) { g.fillStyle = c[i]; g.fillRect(i * W / 8, 0, W / 8 + 1, H); } });
  MT = {
    cab: new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.32, metalness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
    blue: new THREE.MeshPhysicalMaterial({ color: BLUE, roughness: 0.42, metalness: 0.15, clearcoat: 0.4, clearcoatRoughness: 0.3 }),
    black: m({ color: 0x151618, roughness: 0.7 }), frame: m({ color: 0x1b1c1e, roughness: 0.6, metalness: 0.3 }), rubber: m({ color: 0x141416, roughness: 0.93 }),
    chrome: m({ color: 0xd5d9dc, roughness: 0.14, metalness: 1 }), rim: m({ color: 0xc9ccd0, roughness: 0.4, metalness: 0.5 }), steel: m({ color: 0x9da3a8, roughness: 0.55, metalness: 0.55 }),
    lens: m({ color: 0xe8eef2, roughness: 0.06, metalness: 0.6, emissive: 0xfff3cc, emissiveIntensity: 0 }), amber: m({ color: 0xffa31a, roughness: 0.2, emissive: 0xff8a00, emissiveIntensity: 0.1 }),
    tail: m({ color: 0x9d0f18, roughness: 0.2, emissive: 0xff2020, emissiveIntensity: 0.2 }), horn: m({ color: 0xb8bcbf, roughness: 0.45, metalness: 0.4, side: THREE.DoubleSide }),
    plate: m({ map: plate, roughness: 0.4 }), placard: m({ map: placard, roughness: 0.6 }),
    cyl: m({ map: worn, roughness: 0.6, metalness: 0.25 }), cylIn: m({ map: worn, roughness: 0.6, metalness: 0.25, side: THREE.DoubleSide }), brass: m({ color: 0xb8913f, roughness: 0.35, metalness: 0.9 }),
    crate: m({ map: crate, roughness: 0.6 }), melon: m({ map: melon, roughness: 0.45 }), dial: m({ map: dial, roughness: 0.3 }), needle: m({ color: 0xc62b23 }),
    sign1: m({ map: sign('بندورة', '٣ كيلو بدينار'), roughness: 0.9, side: THREE.DoubleSide }), sign2: m({ map: sign('خيار', 'الكيلو ٥٠ قرش'), roughness: 0.9, side: THREE.DoubleSide }), sign3: m({ map: sign('بطيخ', 'الكيلو ٣٥ قرش'), roughness: 0.9, side: THREE.DoubleSide }),
    bag: m({ color: 0x111113, roughness: 0.35, metalness: 0.1 }), brolly: m({ map: brolly, roughness: 0.8, side: THREE.DoubleSide }),
    hose: m({ color: 0xe0782e, roughness: 0.6 }), reg: m({ color: 0x23324c, roughness: 0.4, metalness: 0.3 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0a1218, roughness: 0.06, metalness: 0.35, envMapIntensity: 0.7, side: THREE.DoubleSide }),
  };
  return MT;
}
const merged = (parts) => mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; }), false);
const lathe = (pts, seg = 22) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

// ---------- a gas cylinder as they are in Jordan (12.5 kg of LPG): foot ring, round body, the collar you carry it by ----------
const CYL_BODY = () => merged([
  lathe([[0.128, 0], [0.136, 0.0], [0.136, 0.045], [0.13, 0.045]], 22),                                        // foot ring
  lathe([[0, 0.035], [0.12, 0.04], [0.148, 0.075], [0.152, 0.12], [0.152, 0.42], [0.14, 0.47], [0.1, 0.505], [0.045, 0.52], [0, 0.522]], 24),
  new THREE.CylinderGeometry(0.094, 0.098, 0.1, 22, 1, true).translate(0, 0.565, 0),                               // the collar
  new THREE.TorusGeometry(0.096, 0.007, 6, 22).rotateX(Math.PI / 2).translate(0, 0.615, 0),
]);
let CYLG = null;
export function gasCylinder(full = true, tint = 0x3a8f72) {
  const A = mats();
  if (!CYLG) CYLG = { body: CYL_BODY(), valve: merged([new THREE.CylinderGeometry(0.02, 0.024, 0.07, 10).translate(0, 0.55, 0), new THREE.CylinderGeometry(0.012, 0.012, 0.03, 8).rotateZ(Math.PI / 2).translate(0.025, 0.565, 0)]) };
  const mat = A.cylIn.clone(); mat.color.setHex(tint);
  const g = new THREE.Group(), b = new THREE.Mesh(CYLG.body, mat), v = new THREE.Mesh(CYLG.valve, A.brass);
  b.castShadow = v.castShadow = true; b.receiveShadow = true; g.add(b, v);
  g.userData.full = full; g.userData.top = 0.6;
  return g;
}
// the regulator («الساعة») that screws on to the valve, with its orange hose
export function regulator() {
  const A = mats(), g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.035, 18), A.reg, 0, 0.02, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 10), A.black, 0, 0.05, 0));
  const k = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 8), A.chrome, 0.045, 0.02, 0); k.rotation.z = Math.PI / 2; g.add(k);
  return g;
}

// ---------- the truck: a blue Porter-style light truck with a drop-side bed. +Z is its front, wheels on y = 0 ----------
function wheel(A, R = 0.32, w = 0.19, side = 1) {
  const g = new THREE.Group(), rim = 0.2;
  g.add(mesh(lathe([[rim, -0.42 * w], [R - 0.035, -0.5 * w], [R - 0.006, -0.42 * w], [R, -0.3 * w], [R, 0.3 * w], [R - 0.006, 0.42 * w], [R - 0.035, 0.5 * w], [rim, 0.42 * w]], 32), A.rubber));
  g.add(mesh(new THREE.CylinderGeometry(rim, rim, 0.8 * w, 26, 1, true), A.rim));
  const face = mesh(new THREE.CircleGeometry(rim, 26), A.rim, 0, 0.28 * w, 0); face.rotation.x = -Math.PI / 2; g.add(face);
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.04, 16), A.chrome, 0, 0.3 * w + 0.01, 0));
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3, h = mesh(new THREE.CircleGeometry(0.022, 10), A.black, Math.cos(a) * 0.125, 0.28 * w + 0.002, Math.sin(a) * 0.125); h.rotation.x = -Math.PI / 2; g.add(h); }
  const spin = new THREE.Group(); spin.add(g); g.rotation.z = -Math.PI / 2 * side;      // the face looks out on its side
  return spin;
}
export function makeTruck(kind) {
  const A = mats(), T = new THREE.Group(), add = (o) => { T.add(o); return o; };
  const R = 0.32, FZ = 1.55, RZ = -1.2;
  const wheels = [];
  for (const [x, z] of [[0.74, FZ], [-0.74, FZ], [0.68, RZ], [-0.68, RZ]]) { const w = wheel(A, R, 0.19, Math.sign(x)); w.position.set(x, R, z); add(w); wheels.push(w); }
  // the cab: a tall box with a steep windscreen and a short nose; glass, cab and roof are one skin
  const yt = spline([[0.9, 1.97], [1.75, 2.0], [1.98, 1.93], [2.1, 1.74], [2.24, 1.42], [2.36, 1.2], [2.44, 1.05], [2.48, 0.98]]);
  const ww = spline([[0.9, 0.85], [2.0, 0.865], [2.3, 0.855], [2.48, 0.82]]);
  const glass = (x, y, z, Q) => {
    const half = Q.ha;
    if (z > 2.03 && y > 1.42 && Math.abs(x) < half - 0.075) return true;                                       // windscreen (the top of the rings past the roof)
    if (Math.abs(x) > half * 0.93 && y > 1.3 && y < 1.9 && z > 1.2 && z < 2.02 - (y - 1.3) * 0.15) return true;   // door windows
    return z < 0.93 && y > 1.47 && y < 1.84 && Math.abs(x) < 0.56;                                               // the back window
  };
  add(mesh(loft('z', 0.9, 2.48, (z) => ({ a: 0, ha: ww(z), b: (yt(z) + 0.66) / 2, hb: (yt(z) - 0.66) / 2, n: 7, nb: 9 }), { nu: 52, nv: 44, r0: 0.03, r1: 0.05, col: (x, y, z, Q) => (glass(x, y, z, Q) ? GLASS : BLUE) }), A.cab));
  // the glass itself, laid on the skin: dark, tinted, catching a little of the sky
  const sec = (z) => { const t = yt(z); return { ha: ww(z), b: (t + 0.66) / 2, hb: (t - 0.66) / 2 }; };
  const topY = (x, z) => { const Q = sec(z); return Q.b + Q.hb * Math.max(0, 1 - Math.abs(x / Q.ha) ** 7) ** (1 / 7); };
  add(mesh(grid(16, 8, (u, v) => { const z = 2.045 + v * 0.18, x = (u * 2 - 1) * (sec(z).ha - 0.09); return [x, topY(x, z) + 0.006, z + 0.006]; }), A.glass));
  for (const s of [-1, 1]) {
    add(mesh(grid(10, 6, (u, v) => { const y = 1.33 + v * 0.55, z = 1.22 + u * (0.78 - (y - 1.3) * 0.15); return [s * (sec(z).ha + 0.005), y, z]; }), A.glass));
  }
  const rw = add(mesh(new THREE.PlaneGeometry(1.08, 0.35), A.glass, 0, 1.655, 0.893)); rw.rotation.y = Math.PI;
  // front: the lower panel, bumper, chrome grille, headlights and indicators, the plate
  add(mesh(new RoundedBoxGeometry(1.66, 0.3, 0.2, 2, 0.05), A.blue, 0, 0.62, 2.36));
  add(mesh(new RoundedBoxGeometry(1.78, 0.22, 0.2, 2, 0.06), A.black, 0, 0.47, 2.44));
  add(mesh(new RoundedBoxGeometry(0.86, 0.2, 0.04, 2, 0.015), A.chrome, 0, 0.86, 2.47));
  add(mesh(new RoundedBoxGeometry(0.8, 0.15, 0.04, 2, 0.01), A.black, 0, 0.86, 2.476));
  for (const y of [0.82, 0.87, 0.92]) add(mesh(new THREE.BoxGeometry(0.78, 0.012, 0.012), A.chrome, 0, y, 2.497));
  for (const s of [-1, 1]) {
    const hl = add(mesh(new RoundedBoxGeometry(0.34, 0.17, 0.06, 2, 0.03), A.lens, s * 0.6, 0.88, 2.45)); hl.rotation.y = -s * 0.18;
    const ind = add(mesh(new RoundedBoxGeometry(0.1, 0.07, 0.05, 2, 0.015), A.amber, s * 0.83, 0.88, 2.37)); ind.rotation.y = -s * 0.9;
    // mirrors on their arms, door seam and handle, the wheel arch over the front wheel, the wiper
    add(tube([V(s * 0.86, 1.62, 2.0), V(s * 0.97, 1.64, 2.05), V(s * 1.03, 1.62, 2.06)], 0.012, A.black, 8));
    add(mesh(new RoundedBoxGeometry(0.04, 0.3, 0.17, 2, 0.015), A.black, s * 1.06, 1.6, 2.06));
    add(mesh(new THREE.BoxGeometry(0.006, 1.22, 0.01), A.black, s * 0.869, 1.31, 1.19));
    add(mesh(new THREE.BoxGeometry(0.016, 0.035, 0.13), A.black, s * 0.872, 1.27, 1.33));
    const arch = add(mesh(new THREE.TorusGeometry(R + 0.06, 0.035, 6, 18, Math.PI), A.black, s * 0.86, R, FZ)); arch.rotation.y = Math.PI / 2;
    add(rod(V(s * 0.04, 1.43, 2.245), V(s * 0.6, 1.45, 2.23), 0.007, 0.007, A.black, 6));
    if (kind === 'gas') { const pc = add(mesh(new THREE.PlaneGeometry(0.3, 0.2), A.placard, s * 0.872, 1.08, 1.6)); pc.rotation.y = s * Math.PI / 2; }
  }
  const fp = add(mesh(new THREE.PlaneGeometry(0.42, 0.1), A.plate, 0, 0.47, 2.545));
  // under it all: frame rails, the back axle, fuel tank, exhaust
  for (const s of [-1, 1]) add(mesh(new THREE.BoxGeometry(0.07, 0.16, 3.9), A.frame, s * 0.42, 0.52, -0.75));
  add(rod(V(-0.62, R, RZ), V(0.62, R, RZ), 0.05, 0.05, A.frame, 10)); add(mesh(new THREE.SphereGeometry(0.13, 12, 8), A.frame, 0, R, RZ));
  add(mesh(new RoundedBoxGeometry(0.5, 0.28, 0.45, 2, 0.04), A.frame, 0.6, 0.52, 0.2));
  add(tube([V(-0.3, 0.42, 1.0), V(-0.55, 0.38, -0.2), V(-0.6, 0.38, -2.5), V(-0.62, 0.38, -2.75)], 0.03, A.steel, 20));
  // the bed: floor, drop sides with their ribs, corner posts, headboard with its guard, tail lights, plate, mud flaps
  add(mesh(new THREE.BoxGeometry(1.74, 0.05, 3.48), A.steel, 0, 0.835, -0.98));
  for (const s of [-1, 1]) {
    add(mesh(new THREE.BoxGeometry(0.035, 0.38, 3.48), A.blue, s * 0.865, 1.05, -0.98));
    for (const y of [0.97, 1.13]) add(mesh(new THREE.BoxGeometry(0.05, 0.03, 3.4), A.blue, s * 0.868, y, -0.98));
    for (const z of [0.76, -2.72]) add(mesh(new THREE.BoxGeometry(0.07, 0.42, 0.07), A.blue, s * 0.85, 1.05, z));
    add(mesh(new RoundedBoxGeometry(0.2, 0.09, 0.05, 2, 0.015), A.tail, s * 0.72, 0.72, -2.76));
    add(mesh(new RoundedBoxGeometry(0.07, 0.09, 0.05, 2, 0.015), A.amber, s * 0.56, 0.72, -2.76));
    add(mesh(new THREE.BoxGeometry(0.26, 0.3, 0.012), A.black, s * 0.68, 0.32, RZ - 0.42));
  }
  for (const z of [0.745, -2.72]) { add(mesh(new THREE.BoxGeometry(1.74, 0.38, 0.035), A.blue, 0, 1.05, z)); for (const y of [0.97, 1.13]) add(mesh(new THREE.BoxGeometry(1.7, 0.03, 0.05), A.blue, 0, y, z)); }
  for (const x of [-0.8, -0.4, 0, 0.4, 0.8]) add(rod(V(x, 1.24, 0.77), V(x, 1.95, 0.8), 0.016, 0.016, A.black, 8));
  add(rod(V(-0.84, 1.95, 0.8), V(0.84, 1.95, 0.8), 0.018, 0.018, A.black, 8));
  const rp = add(mesh(new THREE.PlaneGeometry(0.42, 0.1), A.plate, 0, 0.62, -2.765)); rp.rotation.y = Math.PI;
  // the loudspeaker on the cab roof (the veg man has two, back to back)
  add(mesh(new THREE.BoxGeometry(0.05, 0.1, 0.05), A.black, 0, 2.06, 1.45));
  for (const d of kind === 'veg' ? [1, -1] : [1]) {
    const hz = mesh(new THREE.CylinderGeometry(0.15, 0.04, 0.28, 18, 1, true), A.horn, 0, 2.16, 1.45 + d * 0.16); hz.rotation.x = d * Math.PI / 2; add(hz);
    add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 12), A.horn, 0, 2.16, 1.45 + d * 0.02)).rotation.x = Math.PI / 2;
  }
  const load = kind === 'gas' ? gasLoad(A, T) : vegLoad(A, T);
  T.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: T, wheels, kind, ...load, lamps: [A.lens], roll(d) { for (const w of wheels) w.rotation.x += d / R; } };
}

// the cage and its rows of cylinders, a few gaps at the back where today's have gone
function gasLoad(A, T) {
  for (const s of [-1, 1]) {
    for (const z of [0.72, -0.3, -1.3, -2.3, -2.68]) T.add(rod(V(s * 0.84, 1.22, z), V(s * 0.84, 1.74, z), 0.02, 0.02, A.frame, 6));
    for (const y of [1.48, 1.74]) T.add(rod(V(s * 0.84, y, 0.72), V(s * 0.84, y, -2.68), 0.018, 0.018, A.frame, 6));
  }
  for (const z of [0.72, -2.68]) T.add(rod(V(-0.84, 1.74, z), V(0.84, 1.74, z), 0.018, 0.018, A.frame, 6));
  if (!CYLG) gasCylinder();
  const slots = [];
  for (let r = 0; r < 10; r++) for (let c = 0; c < 5; c++) slots.push([-0.64 + c * 0.32, 0.56 - r * 0.33]);
  const empty = new Set([46, 47, 49, 41, 44]);          // where the ones already sold today stood
  const shown = slots.filter((_, i) => !empty.has(i));
  const body = new THREE.InstancedMesh(CYLG.body, A.cyl, shown.length), valve = new THREE.InstancedMesh(CYLG.valve, A.brass, shown.length);
  const tints = [0x3a8f72, 0x2f7f6a, 0x4f9e74, 0x2b7a7f, 0x5aa36e, 0x3f8a64, 0x8a9096, 0x6f9c86], M = new THREE.Matrix4(), Q = new THREE.Quaternion(), C = new THREE.Color();
  shown.forEach(([x, z], i) => {
    Q.setFromEuler(new THREE.Euler(rnd(-0.03, 0.03), rnd(0, 6.28), rnd(-0.03, 0.03))); M.compose(V(x + rnd(-0.01, 0.01), 0.86, z + rnd(-0.01, 0.01)), Q, V(1, 1, 1));
    body.setMatrixAt(i, M); valve.setMatrixAt(i, M); body.setColorAt(i, C.setHex(tints[Math.floor(Math.random() * tints.length)]));
  });
  body.castShadow = valve.castShadow = true; T.add(body, valve);
  return { slot: V(slots[47][0], 0.86, slots[47][1]) };   // a free place at the tailgate: the empty goes there, the full comes from beside it
}

// crates of everything, watermelons on the floor, prices on cardboard, a hanging dial scale, black bags, an umbrella
function vegLoad(A, T) {
  const crateG = new RoundedBoxGeometry(0.5, 0.27, 0.36, 2, 0.02), place = [];
  for (let r = 2; r < 8; r++) for (let c = 0; c < 3; c++) place.push([-0.56 + c * 0.56, 0.5 - r * 0.4]);
  const crates = new THREE.InstancedMesh(crateG, A.crate, place.length), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), C = new THREE.Color();
  const ccol = [0x2f8a3c, 0xc4322b, 0x2a64b8, 0x2f8a3c, 0x26292c, 0xc4322b];
  place.forEach(([x, z], i) => { M.compose(V(x, 0.86 + 0.135, z), Q.set(0, 0, 0, 1), V(1, 1, 1)); crates.setMatrixAt(i, M); crates.setColorAt(i, C.setHex(ccol[i % ccol.length])); });
  T.add(crates);
  // what is in them, by crate (the tomatoes and cucumbers at the back, where he weighs)
  const KINDS = {
    tomato: { geo: new THREE.SphereGeometry(0.042, 10, 8), mat: new THREE.MeshStandardMaterial({ color: 0xd8301f, roughness: 0.35 }), n: [5, 4], sc: [1, 0.85, 1] },
    cucumber: { geo: new THREE.CapsuleGeometry(0.02, 0.1, 4, 8).rotateZ(Math.PI / 2), mat: new THREE.MeshStandardMaterial({ color: 0x3f7d2a, roughness: 0.55 }), n: [3, 7], sc: [1, 1, 1] },
    potato: { geo: new THREE.IcosahedronGeometry(0.038, 1), mat: new THREE.MeshStandardMaterial({ color: 0xa47b4b, roughness: 0.9 }), n: [5, 4], sc: [1.2, 0.8, 1] },
    onion: { geo: new THREE.SphereGeometry(0.038, 10, 8), mat: new THREE.MeshStandardMaterial({ color: 0xb87b38, roughness: 0.6 }), n: [5, 4], sc: [1, 0.9, 1] },
    aubergine: { geo: new THREE.SphereGeometry(0.035, 10, 8), mat: new THREE.MeshStandardMaterial({ color: 0x35173d, roughness: 0.3 }), n: [5, 3], sc: [1, 1, 2.2] },
    zucchini: { geo: new THREE.CapsuleGeometry(0.022, 0.12, 4, 8).rotateZ(Math.PI / 2), mat: new THREE.MeshStandardMaterial({ color: 0x8fb05a, roughness: 0.6 }), n: [3, 6], sc: [1, 1, 1] },
    pepper: { geo: new THREE.SphereGeometry(0.032, 10, 8), mat: new THREE.MeshStandardMaterial({ color: 0x4c8a2c, roughness: 0.35 }), n: [5, 4], sc: [1, 1.3, 1] },
  };
  const order = ['aubergine', 'zucchini', 'pepper', 'onion', 'potato', 'potato', 'onion', 'pepper', 'zucchini', 'potato', 'aubergine', 'onion', 'cucumber', 'cucumber', 'tomato', 'tomato', 'cucumber', 'tomato'];
  const counts = {}; for (const k of order) counts[k] = (counts[k] || 0) + KINDS[k].n[0] * KINDS[k].n[1] + 6;
  const inst = {}; for (const k of Object.keys(counts)) { inst[k] = new THREE.InstancedMesh(KINDS[k].geo, KINDS[k].mat, counts[k]); inst[k].count = 0; inst[k].castShadow = true; T.add(inst[k]); }
  let tomatoAt = null, cucumberAt = null;
  order.forEach((k, i) => {
    const [cx, cz] = place[i], K = KINDS[k], [nx, nz] = K.n, I = inst[k];
    if (k === 'tomato' && cx < 0 && cz < -2) tomatoAt = V(cx, 1.16, cz);
    if (k === 'cucumber' && cx < 0 && cz < -1.6) cucumberAt = V(cx, 1.16, cz);
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
      const x = cx - 0.2 + (a + 0.5) * 0.4 / nx + rnd(-0.008, 0.008), z = cz - 0.14 + (b + 0.5) * 0.28 / nz + rnd(-0.008, 0.008), s = rnd(0.88, 1.12);
      Q.setFromEuler(new THREE.Euler(rnd(-0.3, 0.3), rnd(-0.3, 0.3) + (k === 'cucumber' || k === 'zucchini' ? Math.PI / 2 : 0), rnd(-0.3, 0.3)));
      M.compose(V(x, 1.11 + rnd(0, 0.025), z), Q, V(K.sc[0] * s, K.sc[1] * s, K.sc[2] * s)); I.setMatrixAt(I.count++, M);
    }
    for (let j = 0; j < 6; j++) { Q.setFromEuler(new THREE.Euler(rnd(-1, 1), rnd(0, 6), rnd(-1, 1))); M.compose(V(cx + rnd(-0.12, 0.12), 1.15 + rnd(0, 0.02), cz + rnd(-0.08, 0.08)), Q, V(K.sc[0], K.sc[1], K.sc[2])); I.setMatrixAt(I.count++, M); }    // heaped on top
  });
  // watermelons, two deep, at the front of the bed
  const melons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.14, 16, 12), A.melon, 16);
  for (let i = 0; i < 16; i++) { const lay = i < 11 ? 0 : 1, x = -0.66 + (i % 5) * 0.33 + (lay ? 0.16 : 0), z = (lay ? 0.38 : 0.55) - Math.floor((i % 11) / 5) * 0.3; Q.setFromEuler(new THREE.Euler(Math.PI / 2 + rnd(-0.3, 0.3), rnd(0, 6), 0)); M.compose(V(x, 0.99 + lay * 0.24, z), Q, V(1, 1.18, 0.95)); melons.setMatrixAt(i, M); }
  melons.castShadow = true; T.add(melons);
  // prices on cardboard, stuck in the crates, turned to the pavement
  for (const [m, z, x] of [[A.sign1, -2.3, -0.56], [A.sign2, -1.9, -0.56], [A.sign3, 0.2, -0.75]]) { const s = mesh(new THREE.PlaneGeometry(0.26, 0.16), m, x - 0.2, 1.3, z); s.rotation.y = -Math.PI / 2 + 0.25; T.add(s); }
  // the dial scale on its post at the back corner, the pan on three chains
  T.add(rod(V(-0.86, 0.86, -2.66), V(-0.86, 2.05, -2.66), 0.018, 0.018, A.steel, 8)); T.add(rod(V(-0.86, 2.02, -2.66), V(-0.86, 2.02, -2.98), 0.015, 0.015, A.steel, 8));
  const scale = new THREE.Group(); scale.position.set(-0.86, 1.98, -2.96); T.add(scale);
  const body = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 22), A.needle, 0, -0.14, 0); body.rotation.z = Math.PI / 2; scale.add(body);
  const face = mesh(new THREE.CircleGeometry(0.088, 22), A.dial, -0.026, -0.14, 0); face.rotation.y = -Math.PI / 2; scale.add(face);
  const needle = new THREE.Group(); needle.position.set(-0.03, -0.14, 0); scale.add(needle);
  const nd = mesh(new THREE.BoxGeometry(0.002, 0.07, 0.005), A.needle, 0, 0.03, 0); nd.material = new THREE.MeshStandardMaterial({ color: 0x111111 }); needle.add(nd);
  scale.add(rod(V(0, 0, 0), V(0, -0.08, 0), 0.006, 0.006, A.steel, 6));
  const pan = new THREE.Group(); pan.position.set(0, -0.62, 0); scale.add(pan);
  pan.add(mesh(lathe([[0, 0], [0.12, 0.005], [0.17, 0.04], [0.175, 0.045]], 22), A.steel));
  for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; pan.add(rod(V(Math.cos(a) * 0.16, 0.045, Math.sin(a) * 0.16), V(0, 0.42, 0), 0.0025, 0.0025, A.steel, 4)); }
  // black bags on the tailgate, the umbrella over the front
  for (let i = 0; i < 5; i++) T.add(mesh(new THREE.BoxGeometry(0.22, 0.01, 0.16), A.bag, -0.6, 1.25 + i * 0.011, -2.68));
  T.add(rod(V(-0.8, 0.86, 0.6), V(-0.8, 2.75, 0.6), 0.02, 0.02, A.steel, 8));
  const br = mesh(new THREE.ConeGeometry(1.15, 0.32, 16, 1, true), A.brolly, -0.8, 2.62, 0.6); br.rotation.z = 0.08; T.add(br);
  return { scale, needle, pan, tomatoAt, cucumberAt, produce: { tomato: KINDS.tomato, cucumber: KINDS.cucumber } };
}

// A black plastic bag with tomatoes and cucumbers showing at the top. Origin at its base.
export function vegBag() {
  const A = mats(), g = new THREE.Group();
  const b = mesh(lathe([[0, 0], [0.09, 0.005], [0.13, 0.06], [0.13, 0.17], [0.1, 0.24], [0.06, 0.26]], 18), A.bag); g.add(b);
  for (const [x, z] of [[-0.04, 0.02], [0.03, -0.03], [0.01, 0.04]]) g.add(mesh(new THREE.SphereGeometry(0.04, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd8301f, roughness: 0.35 }), x, 0.24, z));
  const cu = mesh(new THREE.CapsuleGeometry(0.02, 0.12, 4, 8), new THREE.MeshStandardMaterial({ color: 0x3f7d2a, roughness: 0.55 }), 0.04, 0.27, 0.01); cu.rotation.z = 0.5; g.add(cu);
  for (const s of [-1, 1]) g.add(mesh(new THREE.TorusGeometry(0.045, 0.006, 5, 12, Math.PI), A.bag, s * 0.035, 0.28, 0));
  return g;
}

// ---------- the visit ----------
export class Vendors {
  constructor(game) {
    this.game = game; this.state = 'none'; this.kind = null; this.t = 0; this.at = Infinity; this.trucks = {}; this.kit = {};
    // the cylinder beside the cooker: live, so it can come out and go back
    const w = game.world, A = mats();
    this.cyl = gasCylinder(true, 0x3a8f72); this.cyl.position.set(15.65, 0, 7.35); this.cyl.rotation.y = 0.6; game.scene.add(this.cyl);
    this.reg = regulator(); game.scene.add(this.reg);
    this.hose = new THREE.Mesh(new THREE.BufferGeometry(), A.hose); this.hose.castShadow = true; game.scene.add(this.hose);
    this.hooked = true; this.setHose();
    w.spots.gasCyl = { id: 'gasCyl', x: 15.12, z: 7.35, face: Math.PI / 2, room: 'kitchen', label: 'جرّة الغاز' };
  }
  get busy() { return this.state !== 'none' && this.state !== 'gone'; }
  get man() { return this.game.guests.uncle; }
  get gasReady() { return this.kind === 'gas' && this.state === 'ready'; }
  get vegReady() { return this.kind === 'veg' && this.state === 'ready'; }
  get waiting() { return this.state === 'wait'; }

  // the regulator on the valve (or lying on the cabinet floor), the hose from it to the back of the cooker
  setHose(at) {
    const top = this.cyl.position.clone().setY(this.cyl.position.y + 0.585);
    const p = at || top; this.reg.position.copy(p); this.reg.rotation.set(0, 0.6, at ? 1.2 : 0);
    const c = new THREE.CatmullRomCurve3([p.clone().add(V(0, 0.04, 0)), p.clone().add(V(0.06, 0.12, 0.12)), V(15.72, 0.62, 7.7), V(15.7, 0.55, 7.8), V(15.66, 0.72, 7.84)]);
    this.hose.geometry.dispose(); this.hose.geometry = new THREE.TubeGeometry(c, 30, 0.008, 6);
  }

  reset(seg) {
    this.clear();
    const q = new URLSearchParams(location.search), plan = seg.vendors || {};
    this.kind = q.has('gas') ? 'gas' : q.has('veg') ? 'veg' : plan.gas ? 'gas' : plan.veg ? 'veg' : null;
    const win = this.kind && (plan[this.kind] || [6, 8]);
    this.at = this.kind ? (q.has(this.kind) ? 6 : rnd(win[0], win[1])) : Infinity;
    this.state = 'none'; this.t = 0;
    // a new day: a full cylinder back in its place
    this.cyl.visible = true; this.hooked = true; this.setHose();
  }
  clear() {
    if (this.tune) { this.tune.stop(0.2); this.tune = null; }
    if (this.engine) { this.engine.stop(0.1); this.engine = null; }
    for (const k of Object.keys(this.trucks)) this.trucks[k].group.visible = false;
    if (this.held) { this.held.removeFromParent(); this.held = null; }
    if (this.atGate) { this.atGate.removeFromParent(); this.atGate = null; }
    if (this.suited) this.unsuit();
  }

  // ---------- the man ----------
  suit() {
    const r = this.man, c = r.char, k = this.kind;
    r.key = k === 'gas' ? 'gasman' : 'vegman'; r.pose = 'manual'; c.visible = false; c.look = null; this.suited = true;
    if (!c.outfit) c.outfit = new Outfit(c);
    if (c.outfit.ok) { c.outfit.unprint(); c.outfit.wear(k === 'gas' ? 'gasman' : 'vegman'); }
    if (!this.kit[k]) this.kit[k] = this.makeKit(c, k);
    for (const o of this.kit[k]) o.visible = true;
    c.model.traverse((o) => { if (o.isMesh && /_opacity$/.test(o.material.name)) o.visible = false; });       // hair under the hat
  }
  unsuit() {
    const r = this.man, c = r.char; this.suited = false;
    r.key = 'uncle'; r.pose = null; c.visible = false; c.place(30, 30, 0); c.reachTo('R', null); c.reachTo('L', null); c.hold.R = c.hold.L = 0;
    if (c.outfit && c.outfit.ok) c.outfit.wear('home');
    for (const list of Object.values(this.kit)) for (const o of list) o.visible = false;
    c.model.traverse((o) => { if (o.isMesh && /_opacity$/.test(o.material.name)) o.visible = true; });
  }
  // the gas man in a wool beanie, the vegetable man in a peaked cap; made once in the standing pose and tied to the head
  makeKit(c, k) {
    const keep = { p: c.pos.clone(), h: c.heading };
    c.place(0, 0, 0); c.heading = 0; c.root.rotation.y = 0; c.play('m_idle_neutral_01', { fade: 0 }); c.update(0); c.root.updateMatrixWorld(true);
    const B = c.bones, eye = B.LEye.getWorldPosition(V(0, 0, 0)).add(B.REye.getWorldPosition(V(0, 0, 0))).multiplyScalar(0.5), list = [];
    const hat = new THREE.Group(); hat.position.copy(eye).add(V(0, 0.07, -0.078));
    if (k === 'gas') {
      const wool = new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 1 });
      const dome = mesh(new THREE.SphereGeometry(0.115, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), wool); dome.scale.set(1, 0.85, 1.12); hat.add(dome);
      const cuff = mesh(new THREE.CylinderGeometry(0.119, 0.121, 0.05, 22, 1, true), wool, 0, -0.005, 0); cuff.scale.set(1, 1, 1.12); cuff.material = wool.clone(); cuff.material.side = THREE.DoubleSide; hat.add(cuff);
      for (let i = 0; i < 18; i++) { const r = mesh(new THREE.BoxGeometry(0.006, 0.07, 0.004), wool, 0, 0.02, 0); const a = i / 18 * Math.PI * 2; r.position.set(Math.sin(a) * 0.116, 0.0, Math.cos(a) * 0.116 * 1.12); r.rotation.y = a; dome.add(r); }
    } else {
      const cloth = new THREE.MeshStandardMaterial({ color: 0x3d5a3a, roughness: 0.85 }), side = cloth.clone(); side.side = THREE.DoubleSide;
      const crown = mesh(new THREE.SphereGeometry(0.1125, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), cloth); crown.scale.set(1, 0.74, 1.13); hat.add(crown);
      const band = mesh(new THREE.CylinderGeometry(0.1128, 0.1128, 0.026, 22, 1, true), side); band.scale.set(1, 1, 1.13); band.position.y = -0.011; hat.add(band);
      const brim = mesh(new THREE.CircleGeometry(0.1, 18, 0, Math.PI), side); brim.rotation.x = -Math.PI / 2 + 0.2; brim.position.set(0, -0.02, 0.12); hat.add(brim);
    }
    c.root.parent ? c.root.parent.add(hat) : c.root.add(hat); hat.updateMatrixWorld(true); B.Head.attach(hat); list.push(hat);
    c.place(keep.p.x, keep.p.z, keep.h);
    return list;
  }
  walk(x, z, dt, v = 1.2) {
    const c = this.man.char, dx = x - c.pos.x, dz = z - c.pos.z, d = Math.hypot(dx, dz), s = v * dt;
    c.pos.y = c.pos.x > 22.85 ? this.game.world.street.y : 0;
    if (d <= s) { c.pos.x = x; c.pos.z = z; return true; }
    c.pos.x += dx / d * s; c.pos.z += dz / d * s; c.heading = Math.atan2(dx, dz);
    c.play('m_walk_neutral_01', { speed: v / 1.3, fade: 0.2 });
    this.stepT = (this.stepT || 0) - dt * v * 1.45; if (this.stepT <= 0) { this.stepT = 1; sfx.step({ x: c.pos.x, y: 0.1, z: c.pos.z }, 0.6); }
    return false;
  }
  idle(face) { const c = this.man.char; c.play('m_idle_neutral_01', { fade: 0.25 }); if (face != null) c.heading = face; }
  say(cat, o = {}) { return this.game.say(this.man, cat, { loud: true, ...o }); }
  // a world point on the truck
  on(p) { const T = this.truck.group; T.updateMatrixWorld(true); return T.localToWorld(p.clone()); }

  // ---------- what the player does ----------
  // you handed him the empty: he takes it to the truck and brings a full one
  tookEmpty() {
    if (this.kind !== 'gas' || this.state !== 'wait') return;
    this.held = gasCylinder(false, 0x2f7f6a); this.game.scene.add(this.held); this.heldFull = false;
    this.say('gas.take'); this.state = 'swap'; this.t = 0; this.game.world.gate.target = 1; sfx.gate({ x: 22, y: 1, z: 6 });
  }
  // you asked for a kilo of each: he goes and weighs them
  vegOrder() {
    if (this.kind !== 'veg' || this.state !== 'wait') return;
    this.say('veg.talk', { index: 1 }); this.state = 'weigh'; this.t = 0;
  }
  // you took it (and paid)
  handed() {
    const g = this.game;
    if (this.kind === 'gas') { if (this.atGate) { this.atGate.removeFromParent(); this.atGate = null; } g.toast('دفعت ٧ دنانير للغاز (من أبوك)', 'good'); }
    else { if (this.held) { this.held.removeFromParent(); this.held = null; } g.toast('دفعت دينار: كيلو بندورة وكيلو خيار', 'good'); this.say('veg.talk', { index: 4 }); }
    this.man.char.reachTo('R', null); this.man.char.reachTo('L', null);
    g.later(1.2, () => { g.world.gate.target = 0; sfx.gate({ x: 22, y: 1, z: 6 }, true); });
    this.state = 'back'; this.t = 0;
  }

  // the job, as dad (gas) or mom (vegetables) gives it
  ask() {
    const g = this.game;
    if (this.kind === 'gas') {
      const t = g.makeTask({ id: 'gas', title: 'بدّل جرّة الغاز', kind: 'cmd', time: 170, steps: [
        { pick: 'gasEmpty', at: 'gasCyl', secs: 3.2, label: 'فكّ الجرّة الفاضية' },
        { give: 'gasEmpty', to: 'gasman', label: 'أعطي الفاضية لأبو علي' },
        { pick: 'gasFull', at: 'gate', secs: 1.4, label: 'خذ الجرّة المليانة' },
        { drop: 'gasFull', at: 'gasCyl', secs: 4.2, label: 'ركّب الجرّة' }] }, { cmd: 'gas' });
      g.tasks.push(t); g.stepBegin(t); sfx.alarm(); if (g.chat) g.chat.event('gas');
      if (!g.dad.away) g.dad.say('dad.gas.arrive', { loud: true, far: true });
    } else {
      const t = g.makeTask({ id: 'veg', title: 'جيب بندورة وخيار من سيارة الخضرة', kind: 'mom', time: 170, steps: [
        { use: 'gate', secs: 1.2, label: 'اطلب من أبو أحمد' },
        { pick: 'veg', at: 'gate', secs: 1.3, label: 'خذ الخضرة وادفع' },
        { drop: 'veg', at: 'fridge', secs: 2.6, label: 'حط الخضرة بدرج الثلاجة' }] });
      g.tasks.push(t); g.stepBegin(t); sfx.alarm(); if (g.chat) g.chat.event('veg');
      g.mom.say('mom.veg', { loud: true, far: true });
    }
  }
  // the job ran out (he left without you)
  missed() {
    const g = this.game, t = g.tasks.find((k) => k.id === this.kind && !k.done);
    if (!t) return;
    g.tasks = g.tasks.filter((k) => k !== t);
    if (this.kind === 'gas') { if (!g.dad.away) g.dad.say('dad.gas.miss', { loud: true, far: true }); g.addAnger(10, 'gas'); g.toast('راح الغاز… وأبوك سامع', 'bad'); }
    else { g.toast('راحت سيارة الخضرة… أمك زعلت', 'bad'); g.addAnger(3, 'veg'); }
  }

  // ---------- each frame ----------
  update(dt) {
    const g = this.game, S = g.world.street;
    if (this.state === 'gone' || !this.kind) return;
    this.t += dt;
    const tr = this.truck, c = this.suited && this.man.char;
    if (tr) this.man.hornX = tr.group.position.x, this.man.hornZ = tr.group.position.z + 1.45;
    switch (this.state) {
      case 'none':
        if (g.delivery && g.delivery.busy || g.street.busy || g.flags.guests) this.at += dt;
        else if (g.segT >= this.at && !g.over && !g.ended) this.arrive();
        break;
      case 'coming': {
        const left = this.park - this.z, v = Math.min(3.6, Math.sqrt(Math.max(0, 2 * 1.4 * left)) + 0.15);
        this.z += v * dt; tr.group.position.z = this.z; tr.roll(v * dt); this.sounds(0.25 + v / 3.6 * 0.4, dt);
        if (!g.street.pipOn && this.z > 0) g.street.pip(true);
        if (left < 0.02) { this.z = this.park; tr.group.position.z = this.z; this.state = 'parked'; this.t = 0; sfx.brake({ x: this.x, y: 0.6, z: this.z }); }
        break;
      }
      case 'parked':
        this.sounds(0.2, dt);
        if (this.t > 1.0 && !c.visible) { c.visible = true; c.pos.set(this.x + 1.05, S.y, this.z + 1.3); c.heading = Math.PI; sfx.carDoor({ x: this.x + 0.9, y: 1, z: this.z + 1.3 }); }
        if (this.t > 1.4 && this.walkPath(dt, [[this.x + 1.15, this.z - 2.9], [this.x - 1.15, this.z - 2.95], [22.48, 5.75]])) {
          this.state = 'wait'; this.t = 0; this.idle(-Math.PI / 2); this.say(this.kind === 'gas' ? 'gas.hi' : 'veg.talk', { index: this.kind === 'gas' ? undefined : 0 });
          this.ask(); this.calls = 0; this.pipT = 5;
        }
        break;
      case 'wait':
        this.sounds(0.2, dt);
        if ((this.pipT -= dt) < 0 && g.street.pipOn && g.street.state !== 'deed') g.street.pip(false);
        if (this.kind === 'gas') { c.reachTo('R', null); }
        if (this.t > 26) { this.t = 0; this.calls++; if (this.calls < 3) this.say(this.kind === 'gas' ? 'gas.wait' : 'veg.call', { horn: this.kind === 'veg' }); else { this.missed(); this.state = 'back'; this.t = 0; } }
        break;
      case 'swap': this.swap(dt); break;
      case 'weigh': this.weigh(dt); break;
      case 'ready':
        this.sounds(0.2, dt);
        if (this.kind === 'veg' && this.held) { this.holdBag(); }
        if (this.t > 40) { this.missed(); this.state = 'back'; this.t = 0; if (this.held) { this.held.removeFromParent(); this.held = null; } c.reachTo('R', null); }
        break;
      case 'back':
        this.sounds(0.2, dt);
        if (this.t > 0.8 && this.walkPath(dt, [[this.x - 1.15, this.z - 2.95], [this.x + 1.15, this.z - 2.9], [this.x + 1.05, this.z + 1.3]])) {
          c.visible = false; sfx.carDoor({ x: this.x + 0.9, y: 1, z: this.z + 1.3 }); this.say(this.kind === 'gas' ? 'gas.bye' : 'veg.talk', { index: this.kind === 'gas' ? undefined : 4 });
          this.state = 'leaving'; this.t = 0; this.v = 0; sfx.starter({ x: this.x, y: 0.6, z: this.z }); g.street.pip(true);
        }
        break;
      case 'leaving':
        this.v = Math.min(5, this.v + dt * 1.6); this.z += this.v * dt; tr.group.position.z = this.z; tr.roll(this.v * dt); this.sounds(0.3 + this.v / 5 * 0.5, dt);
        if (g.street.pipOn && this.z > this.park + 9 && !g.street.busy) g.street.pip(false);
        if (this.z > 40) { this.clear(); this.state = 'gone'; }
        break;
    }
  }
  walkPath(dt, pts) {
    if (this.pi == null || this.pts !== pts.join()) { this.pi = 0; this.pts = pts.join(); }
    while (this.pi < pts.length && this.walk(pts[this.pi][0], pts[this.pi][1], dt)) this.pi++;
    if (this.pi >= pts.length) { this.pi = null; return true; }
    return false;
  }
  // the engine, the tune and the calls, as loud as the truck is close
  sounds(rev, dt = 1 / 60) {
    const p = { x: this.x, y: 1.6, z: this.z };
    if (this.engine) this.engine.set(p, rev);
    if (this.kind === 'gas') { if (!this.tune) this.tune = sfx.tune(p); this.tune.set({ x: this.x, y: 2.2, z: this.z + 1.45 }, 1); }
    else if (this.state === 'coming' || this.state === 'parked' || this.state === 'leaving') {
      this.callT = (this.callT ?? 1) - dt;
      if (this.callT <= 0 && !this.man.talking) { this.callT = rnd(4.5, 7); this.say('veg.call', { horn: true }); }
    }
  }
  arrive() {
    const g = this.game, S = g.world.street;
    if (!this.trucks[this.kind]) { this.trucks[this.kind] = makeTruck(this.kind); g.scene.add(this.trucks[this.kind].group); }
    const tr = this.truck = this.trucks[this.kind];
    this.x = S.x - 0.05; this.park = 8.4; this.z = -22;
    tr.group.visible = true; tr.group.position.set(this.x, S.y, this.z); tr.group.rotation.set(0, 0, 0);
    for (const l of tr.lamps) l.emissiveIntensity = g.world.dark ? 2.2 : 0;
    this.suit();
    this.engine = sfx.engine({ x: this.x, y: 0.6, z: this.z }, 0.8);
    this.state = 'coming'; this.t = 0; this.callT = 0.5;
  }

  // gas: the empty to the tailgate, up on to the bed, a full one down, back to the gate, down on the ground inside it
  swap(dt) {
    const c = this.man.char, k = this.t, tail = this.on(V(-0.3, 0, -3.15)), slot = this.on(this.truck.slot), gate = V(22.48, 0, 5.75);
    this.sounds(0.2, dt);
    const carry = () => { c.reachTo('R', null); c.hold.R = 0.95; c.gripPos(this.held.position, 0.06, 0.03, 0.6); this.held.rotation.set(0, c.root.rotation.y, 0.08); };
    if (this.phase === undefined) this.phase = 0;
    if (this.phase === 0) { carry(); if (this.walk(tail.x, tail.z, dt, 1.0)) { this.phase = 1; this.t = 0; c.heading = 0; } }
    else if (this.phase === 1) {                     // lift it over the tailgate into its place
      const u = sm(clamp(k / 0.9)), from = c.gripPos(V(0, 0, 0), 0.06, 0.03, 0.6);
      this.held.position.lerpVectors(from, slot, u); this.held.position.y += Math.sin(u * Math.PI) * 0.35;
      c.reachTo('R', this.held.position.clone().setY(this.held.position.y + 0.62), 0.95); c.reachTo('L', this.held.position.clone().add(V(0.08, 0.3, 0)), 0.7);
      if (k > 0.9) { sfx.clang(slot, false); this.held.removeFromParent(); this.held = gasCylinder(true, 0x4f9e74); this.game.scene.add(this.held); this.held.position.copy(slot).add(V(0.33, 0, 0)); this.phase = 2; this.t = 0; }
    } else if (this.phase === 2) {                   // and a full one out, heavy
      const u = sm(clamp(k / 1.1)), to = c.gripPos(V(0, 0, 0), 0.06, 0.03, 0.6), from = this.on(this.truck.slot).add(V(0.33, 0, 0));
      this.held.position.lerpVectors(from, to, u); this.held.position.y += Math.sin(u * Math.PI) * 0.35;
      c.reachTo('R', this.held.position.clone().setY(this.held.position.y + 0.62), 0.95); c.reachTo('L', this.held.position.clone().add(V(0.08, 0.3, 0)), 0.7);
      if (k > 1.1) { c.reachTo('L', null); this.phase = 3; this.t = 0; }
    } else if (this.phase === 3) { carry(); if (this.walk(gate.x, gate.z, dt, 0.85)) { this.phase = 4; this.t = 0; c.heading = -Math.PI / 2; } }
    else if (this.phase === 4) {                     // down on the ground, just inside the gate
      const u = sm(clamp(k / 0.8)), to = V(21.78, 0, 5.6), from = c.gripPos(V(0, 0, 0), 0.06, 0.03, 0.6);
      this.held.position.lerpVectors(from, to, u); c.reachTo('R', this.held.position.clone().setY(this.held.position.y + 0.62), 0.95);
      if (k > 0.8) { sfx.clang(to); this.atGate = this.held; this.held = null; c.reachTo('R', null); this.idle(-Math.PI / 2); this.say('gas.give', { index: 1 }); this.phase = undefined; this.state = 'ready'; this.t = 0; }
    }
  }
  // vegetables: to the scale, a handful of tomatoes into the pan, the needle swings and settles, into a bag; the same with cucumbers
  weigh(dt) {
    const c = this.man.char, k = this.t, tr = this.truck, spot = this.on(V(-1.15, 0, -2.75));
    this.sounds(0.2, dt);
    if (this.phase === undefined) this.phase = 0;
    const panW = () => tr.pan.getWorldPosition(V(0, 0, 0));
    if (this.phase === 0) { if (this.walk(spot.x, spot.z, dt, 1.1)) { this.phase = 1; this.t = 0; c.heading = Math.PI / 2; } }
    else if (this.phase <= 2) {                       // tomatoes (1), then cucumbers (2)
      const from = this.on(this.phase === 1 ? tr.tomatoAt : tr.cucumberAt), pan = panW(), u = k / 2.4;
      c.reachTo('R', u < 0.35 ? from.clone().setY(from.y + 0.05) : pan.clone().setY(pan.y + 0.08), 0.75);
      c.reachTo('L', u > 0.4 && u < 0.9 ? V(pan.x, pan.y + 0.5, pan.z + 0.05) : null, 0.6);
      // the needle: a kilo and a bit, swinging before it settles
      const kg = u > 0.4 ? 1.05 * (1 - Math.exp(-(u - 0.4) * 9) * Math.cos((u - 0.4) * 30)) : 0;
      tr.needle.rotation.x = -kg / 10 * Math.PI * 2; tr.pan.position.y = -0.62 - kg * 0.012;
      if (u > 0.36 && !this.inPan) { this.inPan = true; sfx.flop(pan); }
      if (k > 2.4) { this.inPan = false; tr.needle.rotation.x = 0; tr.pan.position.y = -0.62; sfx.flap(); this.phase++; this.t = 0; if (this.phase === 2) this.say('veg.talk', { index: 2 }); }
    } else if (this.phase === 3) {                   // the bag, back to the gate
      if (!this.held) { this.held = vegBag(); this.game.scene.add(this.held); }
      this.holdBag();
      if (this.walk(22.48, 5.75, dt, 1.1)) { this.phase = undefined; this.state = 'ready'; this.t = 0; this.idle(-Math.PI / 2); this.say('veg.talk', { index: 3 }); this.game.world.gate.target = 1; sfx.gate({ x: 22, y: 1, z: 6 }); }
    }
  }
  holdBag() { const c = this.man.char; c.hold.R = 0.95; if (this.state === 'ready') c.reachTo('R', V(22.1, 1.05, 5.75), 0.95); c.gripPos(this.held.position, 0.06, 0.03, 0.32); this.held.rotation.set(0, c.root.rotation.y, 0); }
}
