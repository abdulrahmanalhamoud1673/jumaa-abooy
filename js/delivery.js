// طلبات: order on the phone, and a little later a captain on a scooter pulls up at the gate, takes your order out of
// the orange box on the back and hands it over the gate. If dad catches you with it: «بس توكل… طخ… وبتنام».
// Everything is copied from the real thing in Amman: the PCX-type scooter most of their captains ride (white body,
// black trims, 14" alloys, disc in front, twin shocks, a delivery rack), the classic talabat box (doodles of food all
// over the orange, the blue speech bubble on the back, the green tick on the sides), and their uniform: the orange tee
// with the lime ring and the white wordmark, dark trousers, the orange cap.
// The captain is the visiting uncle's model in that uniform (he only ever comes on Thursday evenings, and in a cap and
// dark glasses nobody would know him).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { sfx } from './audio.js';
import { Outfit, WARDROBE } from './outfit.js';

export const ORANGE = 0xff5a00;
const RING = '#e6f23a', TICK = '#b4ea36', BLUE = '#2a5ad6';
const PEARL = 0xeceeef, BLACK = 0x17181a;
const rnd = (a, b) => a + Math.random() * (b - a);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const sm = (t) => t * t * (3 - 2 * t);
const clamp = (t) => Math.max(0, Math.min(1, t));
WARDROBE.uncle = { ...(WARDROBE.uncle || {}), talabat: { top: ORANGE, bottom: 0x1a1c21, untucked: true } };

// ---------- their print: the rounded lowercase wordmark, the Arabic name, the food doodles, the tick ----------
const PAINT = [];
let fontsAsked = false;
function fonts() {
  if (fontsAsked || !document.fonts) return; fontsAsked = true;
  Promise.all(['900 64px Nunito', '900 64px Cairo'].map((f) => document.fonts.load(f))).then(() => { for (const p of PAINT) { p.run(); p.tex.needsUpdate = true; } }).catch(() => {});
}
function paint(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const run = () => { g.clearRect(0, 0, w, h); g.save(); draw(g, w, h); g.restore(); };
  run(); PAINT.push({ tex, run }); fonts();
  return tex;
}
const FONT = (px, ar) => ar ? `900 ${px}px Cairo, "Segoe UI", Tahoma, sans-serif` : `900 ${px}px Nunito, "Arial Rounded MT Bold", "Segoe UI", Arial, sans-serif`;
export function word(g, x, y, px, { ar = false, color = '#fff', text, max } = {}) {
  g.save(); g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = ar ? 'rtl' : 'ltr';
  g.font = FONT(px, ar); if (!ar && 'letterSpacing' in g) g.letterSpacing = `${(-px * 0.035).toFixed(2)}px`;
  const t = text || (ar ? 'طلبات' : 'talabat');
  if (max) g.fillText(t, x, y, max); else g.fillText(t, x, y);
  g.restore();
}
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function tick(g, x, y, s, color = TICK) { g.save(); g.strokeStyle = color; g.lineWidth = s * 0.42; g.lineCap = g.lineJoin = 'round'; g.beginPath(); g.moveTo(x - s * 0.8, y); g.lineTo(x - s * 0.2, y + s * 0.6); g.lineTo(x + s * 0.9, y - s * 0.6); g.stroke(); g.restore(); }
// food drawn in a faint line all over the orange (burger, pizza, cup, fries, shawarma, ice cream, doughnut, fork and knife)
const DOODLE = [
  (g) => { g.moveTo(-1, -0.1); g.quadraticCurveTo(-1, -0.9, 0, -0.9); g.quadraticCurveTo(1, -0.9, 1, -0.1); g.closePath(); g.moveTo(-1.05, 0.18); g.lineTo(1.05, 0.18); g.moveTo(-1, 0.45); g.quadraticCurveTo(-1, 0.8, -0.7, 0.8); g.lineTo(0.7, 0.8); g.quadraticCurveTo(1, 0.8, 1, 0.45); g.closePath(); },
  (g) => { g.moveTo(0, 1); g.lineTo(-0.85, -0.6); g.quadraticCurveTo(0, -1.05, 0.85, -0.6); g.closePath(); g.moveTo(-0.7, -0.38); g.quadraticCurveTo(0, -0.78, 0.7, -0.38); for (const [x, y] of [[-0.2, -0.15], [0.25, -0.05], [0, 0.4]]) { g.moveTo(x + 0.13, y); g.arc(x, y, 0.13, 0, 7); } },
  (g) => { g.moveTo(-0.6, -0.6); g.lineTo(-0.45, 1); g.lineTo(0.45, 1); g.lineTo(0.6, -0.6); g.closePath(); g.moveTo(-0.72, -0.6); g.lineTo(0.72, -0.6); g.moveTo(0.1, -0.6); g.lineTo(0.35, -1.1); g.lineTo(0.7, -1.1); },
  (g) => { g.moveTo(-0.7, -0.1); g.lineTo(-0.5, 1); g.lineTo(0.5, 1); g.lineTo(0.7, -0.1); g.quadraticCurveTo(0, 0.25, -0.7, -0.1); for (const x of [-0.45, -0.15, 0.15, 0.45]) { g.moveTo(x, 0.05); g.lineTo(x * 1.2, -0.95 + Math.abs(x) * 0.4); } },
  (g) => { g.moveTo(-0.5, -0.9); g.lineTo(0.5, -0.9); g.lineTo(0.18, 1); g.lineTo(-0.18, 1); g.closePath(); g.moveTo(-0.42, -0.45); g.lineTo(0.42, -0.45); g.moveTo(-0.32, 0.1); g.lineTo(0.32, 0.1); },
  (g) => { g.moveTo(0.62, -0.25); g.arc(0, -0.25, 0.62, 0, Math.PI, true); g.lineTo(0, 1); g.closePath(); },
  (g) => { g.moveTo(0.9, 0); g.arc(0, 0, 0.9, 0, 7); g.moveTo(0.32, 0); g.arc(0, 0, 0.32, 0, 7); },
  (g) => { g.moveTo(-0.4, -1); g.lineTo(-0.4, 1); g.moveTo(-0.6, -1); g.lineTo(-0.6, -0.4); g.quadraticCurveTo(-0.4, -0.2, -0.2, -0.4); g.lineTo(-0.2, -1); g.moveTo(0.45, 1); g.lineTo(0.45, -1); g.quadraticCurveTo(0.8, -0.5, 0.45, 0); },
];
function doodles(g, w, h, seed, alpha = 0.14) {
  let s = seed * 9301 + 49297; const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const step = w / 4.6, k = step * 0.24;
  g.save(); g.strokeStyle = `rgba(255,255,255,${alpha})`; g.lineCap = g.lineJoin = 'round';
  let row = 0;
  for (let y = step * 0.4; y < h + step * 0.5; y += step * 0.82, row++) for (let x = (row % 2) * step * 0.5 - step * 0.2; x < w + step * 0.5; x += step) {
    g.save(); g.translate(x + (R() - 0.5) * step * 0.28, y + (R() - 0.5) * step * 0.28); g.rotate((R() - 0.5) * 1.1); g.scale(k, k);
    g.lineWidth = w / 150 / k; g.beginPath(); DOODLE[(R() * DOODLE.length) | 0](g); g.stroke(); g.restore();
  }
  g.restore();
}
function boxFace(kind) {
  return paint(512, 512, (g, W) => {
    const gr = g.createLinearGradient(0, 0, 0, W); gr.addColorStop(0, '#ff6a14'); gr.addColorStop(1, '#f35300'); g.fillStyle = gr; g.fillRect(0, 0, W, W);
    doodles(g, W, W, kind.length * 7 + kind.charCodeAt(0));
    if (kind === 'back') {
      g.fillStyle = BLUE; rrect(g, 40, 58, 432, 214, 46); g.fill();
      g.beginPath(); g.moveTo(98, 262); g.lineTo(80, 334); g.lineTo(166, 266); g.closePath(); g.fill();
      word(g, 256, 128, 46, { text: 'Your favorite food,', max: 390 }); word(g, 256, 200, 58, { text: 'a tap away', max: 390 });
      word(g, 256, 412, 116, { max: 430 });
    } else if (kind === 'lid') word(g, 256, 256, 112, { max: 440 });
    else { word(g, 256, 136, 112, { max: 430 }); word(g, 256, 258, 96, { ar: true }); tick(g, 256, 392, 66); }
  });
}

let MT = null;
function mats() {
  if (MT) return MT;
  const m = (o) => new THREE.MeshStandardMaterial(o);
  const bagTex = paint(256, 256, (g, W) => { g.fillStyle = '#ff5a00'; g.fillRect(0, 0, W, W); doodles(g, W, W, 3, 0.1); word(g, W / 2, 108, 62, { max: 220 }); word(g, W / 2, 176, 50, { ar: true }); });
  const capLogo = paint(256, 80, (g, W, H) => word(g, W / 2, H / 2 + 2, 62, { max: 236 }));
  const plate = paint(256, 150, (g, W, H) => {
    g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, W, H); g.strokeStyle = '#111'; g.lineWidth = 7; g.strokeRect(5, 5, W - 10, H - 10);
    g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.direction = 'rtl'; g.font = 'bold 28px Cairo, "Segoe UI", sans-serif'; g.fillText('الأردن', 82, 36); g.direction = 'ltr'; g.font = 'bold 22px "Segoe UI", sans-serif'; g.fillText('JORDAN', 178, 38);
    g.font = 'bold 64px "Segoe UI", sans-serif'; g.fillText('56-41730', W / 2, 102, 226);
  });
  const lcd = paint(128, 64, (g, W, H) => { g.fillStyle = '#0d1418'; g.fillRect(0, 0, W, H); g.fillStyle = '#9fe3ff'; g.textAlign = 'right'; g.textBaseline = 'middle'; g.direction = 'ltr'; g.font = 'bold 34px "Segoe UI", sans-serif'; g.fillText('0', 76, 30); g.font = '12px "Segoe UI", sans-serif'; g.fillText('km/h', 112, 40); g.fillRect(14, 50, 52, 5); });
  const phone = paint(128, 256, (g, W, H) => {
    g.fillStyle = '#ece8df'; g.fillRect(0, 0, W, H); g.strokeStyle = '#fff'; g.lineWidth = 10;
    g.beginPath(); g.moveTo(-10, 70); g.lineTo(140, 120); g.moveTo(40, -10); g.lineTo(70, 270); g.moveTo(-10, 190); g.lineTo(140, 170); g.stroke();
    g.strokeStyle = '#ff5a00'; g.lineWidth = 6; g.beginPath(); g.moveTo(52, 230); g.lineTo(60, 160); g.lineTo(110, 128); g.stroke();
    g.fillStyle = '#ff5a00'; g.fillRect(0, 0, W, 34); word(g, W / 2, 18, 22);
  });
  MT = {
    orange: m({ color: ORANGE, roughness: 0.5 }), cap: m({ color: ORANGE, roughness: 0.82 }), capSide: m({ color: ORANGE, roughness: 0.82, side: THREE.DoubleSide }), seam: m({ color: 0xd84a00, roughness: 0.9 }),
    capLogo: m({ map: capLogo, transparent: true, alphaTest: 0.3, roughness: 0.8 }),
    bag: m({ color: ORANGE, roughness: 0.62 }), bagLogo: m({ map: bagTex, roughness: 0.62 }),
    boxSide: m({ map: boxFace('side'), roughness: 0.45 }), boxBack: m({ map: boxFace('back'), roughness: 0.45 }), boxFront: m({ map: boxFace('front'), roughness: 0.45 }), boxLid: m({ map: boxFace('lid'), roughness: 0.45 }),
    paint: new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.3, metalness: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.16 }),
    shell: new THREE.MeshPhysicalMaterial({ color: PEARL, roughness: 0.3, metalness: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.16, side: THREE.DoubleSide }),
    trim: m({ color: BLACK, roughness: 0.72 }), seat: m({ color: 0x101011, roughness: 0.58 }), grip: m({ color: 0x19191a, roughness: 0.88 }),
    alu: m({ color: 0xa9adb1, roughness: 0.33, metalness: 0.85 }), case: m({ color: 0x63676c, roughness: 0.42, metalness: 0.6 }),
    alloy: m({ color: 0x1c1d20, roughness: 0.34, metalness: 0.55 }), lip: m({ color: 0xd6d9dc, roughness: 0.16, metalness: 1 }),
    disc: m({ color: 0xb9bdc1, roughness: 0.28, metalness: 0.95, side: THREE.DoubleSide }), caliper: m({ color: 0x26272a, roughness: 0.4, metalness: 0.5 }),
    pipe: m({ color: 0x2d2c2b, roughness: 0.38, metalness: 0.7 }), muffler: m({ color: 0x1d1e21, roughness: 0.5, metalness: 0.45 }), spring: m({ color: 0x2c2e33, roughness: 0.3, metalness: 0.8 }),
    rack: m({ color: 0x151617, roughness: 0.5, metalness: 0.4 }), rubber: m({ color: 0x121214, roughness: 0.92 }),
    chrome: m({ color: 0xd3d7da, roughness: 0.14, metalness: 1 }), inner: m({ color: 0x3a3c40, roughness: 0.9 }), dark: m({ color: 0x18191c, roughness: 0.5, metalness: 0.2 }),
    lens: m({ color: 0xf0f3f5, roughness: 0.06, metalness: 0.6, emissive: 0xfff3cc, emissiveIntensity: 0 }), amberS: m({ color: 0xffa31a, roughness: 0.2, emissive: 0xff8a00, emissiveIntensity: 0.12, side: THREE.DoubleSide }), tail: m({ color: 0x9d0f18, roughness: 0.18, emissive: 0xff2020, emissiveIntensity: 0.25 }),
    amber: m({ color: 0xffa31a, roughness: 0.2, emissive: 0xff8a00, emissiveIntensity: 0.12 }),
    screen: new THREE.MeshStandardMaterial({ color: 0x1e252c, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }),
    glass: m({ color: 0x0b0d10, roughness: 0.05, metalness: 0.7 }), mirror: m({ color: 0xc9d2d8, roughness: 0.02, metalness: 1 }),
    plate: m({ map: plate, roughness: 0.4 }), lcd: new THREE.MeshBasicMaterial({ map: lcd }), phone: new THREE.MeshBasicMaterial({ map: phone }),
  };
  MT.lensS = MT.lens.clone(); MT.lensS.side = THREE.DoubleSide; MT.lensS.color.setHex(0xb9c4cc); MT.lensS.emissive.setHex(0xf4f8ff);
  return MT;
}
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; return o; };

// The order: an orange carrier bag with two handles, their name on both faces. Origin at its base (it hangs from a fist).
export function talabatBag() {
  const A = mats(), g = new THREE.Group();
  g.add(mesh(new RoundedBoxGeometry(0.26, 0.29, 0.15, 2, 0.018), [A.bag, A.bag, A.bag, A.bag, A.bagLogo, A.bagLogo], 0, 0.145, 0));
  g.add(mesh(new RoundedBoxGeometry(0.255, 0.03, 0.12, 1, 0.01), A.bag, 0, 0.3, 0));                       // the gathered top
  for (const z of [-0.055, 0.055]) { const h = mesh(new THREE.TorusGeometry(0.05, 0.006, 6, 16, Math.PI), A.bag, 0, 0.3, z); g.add(h); }
  return g;
}

// ---------- shapes ----------
// a curve through [[x, y], ...] that never overshoots its keys
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
// A smooth body swept along one axis. at(s) gives the section's centre (a, b), half sizes (ha, hb) and how square it is
// (n: 2 an ellipse … 6 almost a box; nb for the lower half). The ends close in a round dome of r0 / r1.
// Sections: along z they lie in (x, y), along y in (x, z), along x in (z, y). col(x, y, z, S) paints two-tone parts.
function loft(axis, s0, s1, at, { nu = 30, nv = 30, r0 = 0, r1 = 0, col } = {}) {
  const pos = [], cols = [], idx = [], L = Math.abs(s1 - s0), C = new THREE.Color();
  for (let j = 0; j <= nv; j++) {
    const t = 0.5 - 0.5 * Math.cos(Math.PI * j / nv), s = s0 + (s1 - s0) * t, d0 = t * L, d1 = (1 - t) * L;
    let k = 1;
    if (r0 > 0 && d0 < r0) k *= Math.sqrt(Math.max(0, 1 - (1 - d0 / r0) ** 2));
    if (r1 > 0 && d1 < r1) k *= Math.sqrt(Math.max(0, 1 - (1 - d1 / r1) ** 2));
    const S = at(s);
    for (let i = 0; i <= nu; i++) {
      const th = (i / nu) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th), p = sn < 0 && S.nb ? S.nb : S.n || 2.5;
      const a = S.a + S.ha * k * Math.sign(c) * Math.abs(c) ** (2 / p), b = S.b + S.hb * k * Math.sign(sn) * Math.abs(sn) ** (2 / p);
      const P = axis === 'z' ? [a, b, s] : axis === 'y' ? [a, s, b] : [s, b, a];
      pos.push(...P);
      if (col) { C.setHex(col(P[0], P[1], P[2], S)); cols.push(C.r, C.g, C.b); }
    }
  }
  const flip = (axis !== 'z') !== (s1 < s0);
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const p = j * (nu + 1) + i, r = p + nu + 1; if (flip) idx.push(p, r + 1, p + 1, p, r, r + 1); else idx.push(p, p + 1, r + 1, p, r + 1, r); }
  let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.setIndex(idx); g = mergeVertices(g, 1e-5); g.computeVertexNormals();
  return g;
}
function grid(nu, nv, fn) {
  const pos = [], idx = [];
  for (let b = 0; b <= nv; b++) for (let a = 0; a <= nu; a++) pos.push(...fn(a / nu, b / nv));
  for (let b = 0; b < nv; b++) for (let a = 0; a < nu; a++) { const p = b * (nu + 1) + a, r = p + nu + 1; idx.push(p, p + 1, r + 1, p, r + 1, r); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
class Helix extends THREE.Curve {
  constructor(r, len, turns) { super(); this.r = r; this.len = len; this.turns = turns; }
  getPoint(t, o = new THREE.Vector3()) { const a = t * this.turns * Math.PI * 2; return o.set(this.r * Math.cos(a), (t - 0.5) * this.len, this.r * Math.sin(a)); }
}
const tube = (pts, r, mat, seg = 24) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 8), mat);
// a rod from a to b
function rod(a, b, r0, r1, mat, seg = 10) {
  const d = b.clone().sub(a), o = mesh(new THREE.CylinderGeometry(r1, r0, d.length(), seg), mat);
  o.position.copy(a).add(b).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  return o;
}

// A 14" cast wheel: rounded motorcycle tyre, black five-twin-spoke alloy with a polished lip, the disc on its left.
function wheelParts(A, R, rim, w, disc) {
  const g = new THREE.Group(), sw = R - rim, lathe = (pts, seg = 40) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  g.add(mesh(lathe([[rim, -0.42 * w], [rim + 0.4 * sw, -0.5 * w], [R - 0.35 * sw, -0.47 * w], [R - 0.1 * sw, -0.3 * w], [R, 0], [R - 0.1 * sw, 0.3 * w], [R - 0.35 * sw, 0.47 * w], [rim + 0.4 * sw, 0.5 * w], [rim, 0.42 * w]]), A.rubber));
  g.add(mesh(lathe([[rim + 0.004, 0.44 * w], [rim - 0.007, 0.47 * w], [rim - 0.014, 0.4 * w], [rim - 0.014, -0.4 * w], [rim - 0.007, -0.47 * w], [rim + 0.004, -0.44 * w]]), A.lip));
  const parts = [new THREE.CylinderGeometry(0.052, 0.058, 0.62 * w, 20), new THREE.CylinderGeometry(0.03, 0.03, 0.9 * w, 12)];
  for (let k = 0; k < 5; k++) for (const o of [-0.12, 0.12]) {
    const a = k * Math.PI * 2 / 5, r0 = 0.05, r1 = rim - 0.012;
    const x0 = r0 * Math.sin(a), z0 = r0 * Math.cos(a), x1 = r1 * Math.sin(a + o), z1 = r1 * Math.cos(a + o), len = Math.hypot(x1 - x0, z1 - z0);
    const b = new THREE.BoxGeometry(0.016, 0.022, len); b.rotateY(Math.atan2(x1 - x0, z1 - z0)); b.translate((x0 + x1) / 2, 0, (z0 + z1) / 2); parts.push(b);
  }
  g.add(mesh(mergeGeometries(parts.map((p) => p.toNonIndexed()), false), A.alloy));
  if (disc) {
    const d = mesh(new THREE.RingGeometry(0.062, 0.112, 40).rotateX(-Math.PI / 2), A.disc, 0, 0.046, 0); g.add(d);
    for (let k = 0; k < 5; k++) { const b = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.01, 6), A.chrome, 0.07 * Math.sin(k * 1.2566), 0.049, 0.07 * Math.cos(k * 1.2566)); g.add(b); }
  } else g.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.035, 22), A.alloy, 0, -0.04, 0));      // the rear drum
  g.rotation.z = -Math.PI / 2;                       // axle along x
  return g;
}

// The scooter: +Z is its front, wheels on y = 0, the bike's left (side stand, engine) is +X.
function makeScooter() {
  const A = mats(), S = new THREE.Group(), add = (o) => { S.add(o); return o; };
  const R = 0.26, FA = V(0, R, 0.66), RA = V(0, R, -0.65), RAKE = 0.47, UPF = V(0, Math.cos(RAKE), -Math.sin(RAKE));
  const two = (top, bottom) => (x, y, z, Q) => (y < Q.cut ? bottom : top);
  // wheels
  const wheels = [[FA, 0.11, true], [RA, 0.125, false]].map(([at, w, front]) => { const wg = new THREE.Group(); wg.position.copy(at); S.add(wg); wg.add(wheelParts(A, R, 0.178, w, front)); return wg; });
  // front: fork, axle, calliper, mudguard
  for (const x of [-0.072, 0.072]) {
    const a = FA.clone().setX(x);
    add(rod(a, a.clone().addScaledVector(UPF, 0.27), 0.025, 0.022, A.alu, 14));
    add(rod(a.clone().addScaledVector(UPF, 0.26), a.clone().addScaledVector(UPF, 0.56), 0.017, 0.017, A.trim, 12));
  }
  add(rod(V(-0.09, R, FA.z), V(0.09, R, FA.z), 0.011, 0.011, A.chrome, 8));
  const cal = add(mesh(new RoundedBoxGeometry(0.032, 0.08, 0.05, 2, 0.008), A.caliper, 0.064, R + 0.068, FA.z - 0.072)); cal.rotation.x = 0.7;
  add(mesh(grid(10, 26, (u, v) => { const x = u * 2 - 1, a = -0.55 + v * 1.95, r = 0.292 - 0.024 * x * x; return [0.075 * x, R + r * Math.cos(a), FA.z + r * Math.sin(a)]; }), A.shell));
  // the front cowl: white nose over the wheel, black leg shield behind it
  const zf = spline([[0.34, 0.4], [0.46, 0.435], [0.52, 0.5], [0.57, 0.61], [0.62, 0.7], [0.7, 0.775], [0.79, 0.79], [0.9, 0.735], [0.97, 0.64], [1.02, 0.52]]);
  const zb = spline([[0.34, 0.3], [0.5, 0.33], [0.7, 0.355], [0.85, 0.345], [0.95, 0.31], [1.02, 0.29]]);
  const wf = spline([[0.34, 0.15], [0.5, 0.15], [0.62, 0.158], [0.75, 0.172], [0.88, 0.182], [0.97, 0.175], [1.02, 0.15]]), NOSE = 1.65;
  const surf = (x, y) => (zf(y) + zb(y)) / 2 + (zf(y) - zb(y)) / 2 * Math.max(0, 1 - Math.abs(x / wf(y)) ** NOSE) ** (1 / NOSE);
  add(mesh(loft('y', 0.34, 1.02, (y) => ({ a: 0, ha: wf(y), b: (zf(y) + zb(y)) / 2, hb: (zf(y) - zb(y)) / 2, n: NOSE, nb: 4.5 }),
    { nu: 40, nv: 32, r0: 0.02, r1: 0.05, col: (x, y, z, Q) => (z < Q.b - Q.hb * 0.25 || y < 0.575 ? BLACK : PEARL) }), A.paint));
  // the headlight (their V of LEDs under one lens), the indicators
  // (strips laid on the nose itself: from x0,y0 to x1,y1, w wide, raised off the paint by off)
  const onNose = (x0, y0, x1, y1, w, off, mat) => add(mesh(grid(12, 3, (u, v) => {
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), x = x0 + dx * u - dy / l * w * (v - 0.5), y = y0 + dy * u + dx / l * w * (v - 0.5);
    return [x, y, surf(x, y) + off];
  }), mat));
  for (const s of [-1, 1]) {
    onNose(s * 0.008, 0.705, s * 0.118, 0.8, 0.058, 0.004, A.trim);
    onNose(s * 0.014, 0.71, s * 0.112, 0.795, 0.03, 0.007, A.lensS);
    onNose(s * 0.124, 0.83, s * 0.15, 0.88, 0.028, 0.006, A.amberS);
  }
  // handlebar cover, meter, windscreen, the captain's phone in its holder
  add(mesh(loft('x', -0.24, 0.24, (x) => { const q = (x / 0.24) ** 2; return { a: 0.262 + 0.015 * q, ha: 0.12 - 0.045 * q, b: 1.0 + 0.012 * (1 - q), hb: 0.058 - 0.012 * q, n: 2.8 }; },
    { nu: 28, nv: 26, r0: 0.05, r1: 0.05, col: (x, y, z, Q) => (y < Q.b - Q.hb * 0.2 ? BLACK : PEARL) }), A.paint));
  const meter = add(mesh(new RoundedBoxGeometry(0.17, 0.014, 0.085, 2, 0.005), [A.trim, A.trim, A.lcd, A.trim, A.trim, A.trim], 0, 1.064, 0.2)); meter.rotation.x = -0.5;
  add(mesh(grid(8, 6, (u, v) => { const x = u * 2 - 1; return [x * (0.15 - 0.035 * v), 1.045 + v * 0.13, 0.37 - v * 0.075 + 0.03 * x * x]; }), A.screen));
  add(tube([V(-0.12, 1.06, 0.25), V(-0.125, 1.1, 0.24), V(-0.13, 1.13, 0.235)], 0.007, A.trim, 8));
  const ph = add(mesh(new RoundedBoxGeometry(0.075, 0.15, 0.01, 2, 0.004), [A.dark, A.dark, A.dark, A.dark, A.dark, A.phone], -0.13, 1.19, 0.235)); ph.rotation.x = 0.4;
  // bar ends: switch boxes, grips, levers, mirrors on their stalks
  for (const s of [-1, 1]) {
    add(mesh(new RoundedBoxGeometry(0.05, 0.052, 0.06, 2, 0.012), A.trim, s * 0.245, 1.0, 0.2));
    add(rod(V(s * 0.255, 1.0, 0.2), V(s * 0.365, 1.0, 0.2), 0.0185, 0.0185, A.grip, 14));
    add(rod(V(s * 0.365, 1.0, 0.2), V(s * 0.38, 1.0, 0.2), 0.016, 0.016, A.chrome, 12));
    add(tube([V(s * 0.26, 1.006, 0.235), V(s * 0.31, 1.0, 0.258), V(s * 0.37, 0.995, 0.252)], 0.0055, A.alu, 10));
    add(tube([V(s * 0.19, 1.05, 0.22), V(s * 0.22, 1.15, 0.2), V(s * 0.27, 1.25, 0.215)], 0.0062, A.trim, 12));
    const mh = add(mesh(new THREE.CylinderGeometry(1, 1, 1, 24), A.trim, s * 0.285, 1.275, 0.222)); mh.scale.set(0.066, 0.026, 0.04); mh.rotation.x = Math.PI / 2;
    const mg = add(mesh(new THREE.CircleGeometry(1, 24), A.mirror, s * 0.285, 1.275, 0.208)); mg.scale.set(0.06, 0.035, 1); mg.rotation.y = Math.PI;
  }
  // floor: black sides, rubber mats, the tunnel between the feet
  add(mesh(new RoundedBoxGeometry(0.38, 0.17, 0.45, 3, 0.035), A.trim, 0, 0.275, 0.115));
  for (const s of [-1, 1]) add(mesh(new RoundedBoxGeometry(0.12, 0.012, 0.37, 2, 0.005), A.rubber, s * 0.118, 0.362, 0.12));
  add(mesh(loft('z', 0.33, -0.12, () => ({ a: 0, ha: 0.068, b: 0.385, hb: 0.088, n: 3 }), { nu: 24, nv: 8 }), A.trim));
  // the body under the seat, white over black, closing into the tail
  const yc = spline([[-0.04, 0.5], [0.15, 0.53], [0.4, 0.57], [0.65, 0.65], [0.8, 0.705], [0.99, 0.75]]);
  const hh = spline([[-0.04, 0.15], [0.15, 0.17], [0.4, 0.15], [0.65, 0.115], [0.8, 0.085], [0.99, 0.05]]);
  const ww = spline([[-0.04, 0.15], [0.15, 0.185], [0.4, 0.19], [0.65, 0.155], [0.8, 0.12], [0.99, 0.07]]);
  add(mesh(loft('z', 0.04, -0.99, (z) => ({ a: 0, ha: ww(-z), b: yc(-z), hb: hh(-z), n: 3, nb: 4, cut: yc(-z) - hh(-z) * 0.3 }),
    { nu: 40, nv: 40, r1: 0.05, col: two(PEARL, BLACK) }), A.paint));
  // the seat, one step up for the passenger
  const yt = spline([[-0.04, 0.7], [0.04, 0.755], [0.15, 0.77], [0.3, 0.768], [0.4, 0.78], [0.47, 0.822], [0.6, 0.835], [0.75, 0.815]]);
  const yb = spline([[-0.04, 0.62], [0.3, 0.66], [0.6, 0.73], [0.75, 0.75]]);
  const ws = spline([[-0.04, 0.11], [0.1, 0.155], [0.35, 0.16], [0.5, 0.145], [0.75, 0.12]]);
  add(mesh(loft('z', 0.04, -0.75, (z) => { const t = yt(-z), b = yb(-z); return { a: 0, ha: ws(-z), b: (t + b) / 2, hb: (t - b) / 2, n: 2.6, nb: 8 }; }, { nu: 32, nv: 34, r0: 0.04, r1: 0.03 }), A.seat));
  // engine and the belt case down to the rear axle on the left, the engine block in the middle
  const ey = spline([[0.06, 0.33], [0.3, 0.31], [0.55, 0.28], [0.74, 0.26]]), eh = spline([[0.06, 0.085], [0.3, 0.105], [0.55, 0.09], [0.74, 0.06]]);
  add(mesh(loft('z', -0.06, -0.74, (z) => ({ a: 0.105, ha: 0.042, b: ey(-z), hb: eh(-z), n: 2.6 }), { r0: 0.05, r1: 0.06 }), A.case));
  add(mesh(new RoundedBoxGeometry(0.17, 0.15, 0.2, 2, 0.03), A.dark, 0.0, 0.25, -0.18));
  for (let k = 0; k < 4; k++) add(mesh(new THREE.BoxGeometry(0.16, 0.13, 0.006), A.case, 0, 0.25, -0.07 + k * 0.016));
  // exhaust on the right: header, black silencer, a chrome heat shield and tip
  add(tube([V(-0.02, 0.2, -0.02), V(-0.05, 0.15, -0.12), V(-0.11, 0.17, -0.25), V(-0.15, 0.25, -0.34)], 0.02, A.pipe, 28));
  const my = (z) => 0.27 + 0.08 * ((-z - 0.3) / 0.54);
  add(mesh(loft('z', -0.3, -0.84, (z) => ({ a: -0.16, ha: 0.055, b: my(z), hb: 0.068, n: 2.4 }), { r0: 0.04, r1: 0.025 }), A.muffler));
  add(mesh(loft('z', -0.38, -0.72, (z) => ({ a: -0.219, ha: 0.007, b: my(z) + 0.005, hb: 0.05, n: 3 }), { nu: 16, nv: 16, r0: 0.03, r1: 0.03 }), A.chrome));
  add(rod(V(-0.16, my(-0.82) + 0.01, -0.82), V(-0.16, my(-0.82) + 0.02, -0.875), 0.026, 0.024, A.chrome, 16));
  add(mesh(new RoundedBoxGeometry(0.03, 0.05, 0.38, 2, 0.01), A.dark, -0.085, 0.265, -0.47));
  // twin shocks
  for (const [a, b] of [[V(0.105, 0.33, -0.63), V(0.12, 0.62, -0.5)], [V(-0.1, 0.29, -0.62), V(-0.12, 0.6, -0.5)]]) {
    const sh = rod(a, b, 0.016, 0.013, A.alu, 10); add(sh);
    const sp = add(mesh(new THREE.TubeGeometry(new Helix(0.026, a.distanceTo(b) * 0.6, 8), 140, 0.0042, 5), A.spring)); sp.position.copy(a).lerp(b, 0.55); sp.quaternion.copy(sh.quaternion);
  }
  // tail light, indicators, hugger and the Jordanian plate
  add(mesh(new RoundedBoxGeometry(0.15, 0.05, 0.06, 2, 0.015), A.tail, 0, 0.748, -0.962));
  for (const s of [-1, 1]) add(mesh(new RoundedBoxGeometry(0.04, 0.024, 0.04, 2, 0.009), A.amber, s * 0.09, 0.715, -0.93));
  const hug = add(mesh(new RoundedBoxGeometry(0.11, 0.016, 0.13, 2, 0.005), A.trim, 0, 0.67, -0.955)); hug.rotation.x = -0.95;
  const pl = add(mesh(new THREE.PlaneGeometry(0.17, 0.1), A.plate, 0, 0.575, -1.0)); pl.rotation.set(-0.25, Math.PI, 0, 'YXZ');
  // the delivery rack over the passenger seat, and the box on it
  for (const s of [-1, 1]) add(tube([V(s * 0.13, 0.7, -0.37), V(s * 0.152, 0.8, -0.45), V(s * 0.155, 0.872, -0.53), V(s * 0.155, 0.876, -0.88), V(s * 0.13, 0.79, -0.93)], 0.011, A.rack, 40));
  add(mesh(new RoundedBoxGeometry(0.36, 0.014, 0.44, 1, 0.004), A.rack, 0, 0.885, -0.7));
  const box = new THREE.Group(); box.position.set(0, 0.893, -0.7); S.add(box);
  box.add(mesh(new RoundedBoxGeometry(0.44, 0.4, 0.42, 3, 0.028), [A.boxSide, A.boxSide, A.inner, A.inner, A.boxFront, A.boxBack], 0, 0.2, 0));
  box.add(mesh(new THREE.PlaneGeometry(0.4, 0.38).rotateX(-Math.PI / 2), A.inner, 0, 0.396, 0));            // the insulated inside, seen when it is open
  for (const s of [-1, 1]) box.add(mesh(new RoundedBoxGeometry(0.03, 0.04, 0.012, 1, 0.003), A.chrome, s * 0.13, 0.375, 0.214));
  const lid = new THREE.Group(); lid.position.set(0, 0.4, -0.21); box.add(lid);
  lid.add(mesh(new RoundedBoxGeometry(0.45, 0.055, 0.43, 2, 0.022), [A.orange, A.orange, A.boxLid, A.orange, A.orange, A.orange], 0, 0.028, 0.21));
  // side stand (down when it is parked: the bike leans on it to the left)
  const stand = new THREE.Group(); stand.position.set(0.1, 0.18, -0.08); S.add(stand);
  stand.add(mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.2, 8), A.trim, 0, -0.1, 0)); stand.add(mesh(new RoundedBoxGeometry(0.035, 0.01, 0.05, 1, 0.003), A.trim, 0, -0.2, 0));
  const DOWN = new THREE.Quaternion().setFromUnitVectors(V(0, -1, 0), V(0.55, -0.78, -0.3).normalize()), FOLD = new THREE.Quaternion().setFromUnitVectors(V(0, -1, 0), V(0.15, 0.12, -1).normalize());
  S.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const at = (p) => (S.updateMatrixWorld(true), S.localToWorld(p.clone()));
  const sc = {
    group: S, wheels, lid, box, lamp: A.lensS, tail: A.tail,
    sitAt: V(0, 0.36, -0.2), gripR: V(-0.31, 1.0, 0.2), gripL: V(0.31, 1.0, 0.2), boxFloor: V(0, 0.905, -0.7), boxTop: V(0, 1.29, -0.7),
    at, lidEdge(x = -0.15) { lid.updateMatrixWorld(true); return lid.localToWorld(V(x, 0.055, 0.43)); },
    setLid(k) { lid.rotation.x = -1.75 * k; },
    setStand(k) { stand.quaternion.slerpQuaternions(FOLD, DOWN, k); },
    roll(d) { for (const w of wheels) w.rotation.x += d / R; },
  };
  sc.setStand(0);
  return sc;
}

export class Delivery {
  constructor(game) { this.game = game; this.state = 'none'; this.t = 0; this.sc = null; this.bag = null; this.dressed = false; this.engine = null; }
  get busy() { return this.state !== 'none' && this.state !== 'gone'; }
  get ready() { return this.state === 'wait'; }
  get rider() { return this.game.guests.uncle; }

  reset() {
    if (this.engine) { this.engine.stop(0.1); this.engine = null; }
    if (this.sc) this.sc.group.visible = false;
    if (this.bag) this.bag.visible = false;
    if (this.hungBag) { this.hungBag.removeFromParent(); this.hungBag = null; }
    if (this.state !== 'none' && this.rider) this.unsuit();
    this.state = 'none'; this.t = 0;
  }
  // the order went in: the captain is on his way
  order() {
    if (this.state !== 'none' && this.state !== 'gone') return;
    this.state = 'coming'; this.t = 0; this.eta = rnd(14, 22); fonts();
    this.game.toast('🛵 انطلب! كابتن طلبات بالطريق…', 'good');
  }

  // the uniform: their orange tee (printed front and back), dark trousers, the orange cap, dark glasses
  suit() {
    const r = this.rider, c = r.char;
    r.key = 'rider'; r.pose = 'manual'; c.visible = true; c.look = null;
    if (!c.outfit) c.outfit = new Outfit(c);
    if (c.outfit.ok) {
      c.outfit.wear('talabat');
      if (!this.printed) { this.printTee(c); this.printed = true; if (document.fonts && !document.fonts.check('900 40px Nunito')) document.fonts.load('900 40px Nunito').then(() => this.printTee(c)).catch(() => {}); }
      else c.outfit.U.oPrintOn.value = 1;
    }
    if (!this.kit) this.makeKit(c);
    for (const o of this.kit) o.visible = true;
    c.model.traverse((o) => { if (o.isMesh && /_opacity$/.test(o.material.name)) o.visible = false; });       // hair under the cap
  }
  unsuit() {
    const r = this.rider, c = r.char;
    r.key = 'uncle'; r.pose = null; c.visible = false; c.straddle = 0; c.place(30, 30, 0); c.reachTo('R', null); c.reachTo('L', null);
    if (c.outfit && c.outfit.ok) { c.outfit.unprint(); c.outfit.wear('home'); }
    if (this.kit) for (const o of this.kit) o.visible = false;
    c.model.traverse((o) => { if (o.isMesh && /_opacity$/.test(o.material.name)) o.visible = true; });
  }
  // their tee, printed where a real one is: the lime ring over the right shoulder, the small wordmark on the heart, the big
  // one across the front; on the back the wordmark and the Arabic name. (millimetres from the middle of the chest, y down)
  printTee(c) {
    c.outfit.print({
      front: (g) => {
        g.save(); g.strokeStyle = RING; g.lineWidth = 26; g.beginPath(); g.arc(-175, -150, 105, 0, Math.PI * 2); g.stroke(); g.restore();
        word(g, 82, -95, 34, { max: 120 });
        word(g, 0, 150, 78, { max: 300 });
      },
      back: (g) => {
        word(g, 0, 0, 82, { max: 250 });
        word(g, 0, 105, 66, { ar: true, max: 210 });
        g.save(); g.strokeStyle = RING; g.lineWidth = 22; g.beginPath(); g.arc(170, 250, 95, Math.PI, Math.PI * 1.6); g.stroke(); g.restore();
      },
    });
  }
  makeKit(c) {
    // made once, in the standing pose facing +Z at the origin, then attached to the bones so they move with him
    const A = mats(), keep = { p: c.pos.clone(), h: c.heading };
    c.place(0, 0, 0); c.heading = 0; c.root.rotation.y = 0; c.play('m_idle_neutral_01', { fade: 0 }); c.update(0); c.root.updateMatrixWorld(true);
    const B = c.bones, eye = B.LEye.getWorldPosition(V(0, 0, 0)).add(B.REye.getWorldPosition(V(0, 0, 0))).multiplyScalar(0.5);
    const kit = [];
    const put = (bone, o) => { c.root.parent ? c.root.parent.add(o) : c.root.add(o); o.updateMatrixWorld(true); bone.attach(o); kit.push(o); };
    // the cap: six panels with their seams and the button, a curved peak, their wordmark on the front
    const cap = new THREE.Group(); cap.position.copy(eye).add(V(0, 0.07, -0.078));
    const crown = mesh(new THREE.SphereGeometry(0.1125, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), A.cap); crown.scale.set(1.0, 0.78, 1.13); cap.add(crown);
    for (let k = 0; k < 6; k++) { const s = mesh(new THREE.TorusGeometry(0.1128, 0.0012, 3, 20, Math.PI / 2), A.seam); s.rotation.set(0, k * Math.PI / 3 + Math.PI / 6, 0); crown.add(s); }
    crown.add(mesh(new THREE.SphereGeometry(0.008, 10, 6), A.cap, 0, 0.112, 0));
    const band = mesh(new THREE.CylinderGeometry(0.1128, 0.1128, 0.026, 28, 1, true), A.capSide); band.scale.set(1, 1, 1.13); band.position.y = -0.011; cap.add(band);
    cap.add(mesh(grid(18, 6, (u, v) => {
      const s = u * 2 - 1, phi = s * 1.25, bx = 0.1128 * Math.sin(phi), bz = 0.1128 * 1.13 * Math.cos(phi), L = (0.074 * Math.sqrt(Math.max(0, 1 - s * s * 0.93)) + 0.003) * v;
      return [bx * (1 + 0.05 * v), -0.022 - 0.018 * s * s * v - 0.014 * v, bz + L];
    }), A.capSide));
    const logo = mesh(new THREE.PlaneGeometry(0.085, 0.027), A.capLogo); logo.position.set(0, 0.03, 0.12); logo.rotation.x = -0.36; logo.castShadow = false; cap.add(logo);
    put(B.Head, cap);
    // dark glasses
    const shades = new THREE.Group(); shades.position.copy(eye).add(V(0, 0.002, 0.03));
    for (const x of [-1, 1]) { const l = mesh(new THREE.CircleGeometry(1, 16), A.glass); l.scale.set(0.024, 0.017, 1); l.position.set(x * 0.032, 0, 0); shades.add(l); const t = mesh(new THREE.BoxGeometry(0.004, 0.006, 0.1), A.dark); t.position.set(x * 0.062, 0.004, -0.045); shades.add(t); }
    shades.add(mesh(new THREE.BoxGeometry(0.024, 0.004, 0.004), A.dark, 0, 0.006, 0));
    put(B.Head, shades);
    c.place(keep.p.x, keep.p.z, keep.h);
    this.kit = kit;
  }

  // ---------- the visit ----------
  arrive() {
    const g = this.game, S = g.world.street;
    if (!this.sc) { this.sc = makeScooter(); g.scene.add(this.sc.group); }
    if (!this.bag) { this.bag = talabatBag(); g.scene.add(this.bag); }
    this.x = S.x - 0.72; this.z = -16; this.v = 0;
    this.sc.group.visible = true; this.sc.group.position.set(this.x, S.y, this.z); this.sc.group.rotation.set(0, 0, 0); this.sc.setLid(0); this.sc.setStand(0);
    this.bag.visible = false; this.suit();
    this.engine = sfx.engine({ x: this.x, y: 0.6, z: this.z }, 2.1);
    this.state = 'ride'; this.t = 0;
    const night = g.world.dark; this.sc.lamp.emissiveIntensity = night ? 2.4 : 1.3; this.sc.tail.emissiveIntensity = night ? 1.2 : 0.25;
  }
  // sitting on it: feet on the floor either side of the tunnel, hands on the grips
  seat() {
    const r = this.rider, c = r.char, sc = this.sc;
    c.play('m_sit_chair_idle_neutral_01', { fade: 0.25 }); c.heading = sc.group.rotation.y; c.root.rotation.y = c.heading; c.straddle = 0.35;
    c.pos.copy(sc.at(sc.sitAt));
    c.reachTo('R', sc.at(sc.gripR), 0.92); c.reachTo('L', sc.at(sc.gripL), 0.92);
  }
  stand(k) { this.sc.setStand(k); this.sc.group.rotation.z = -0.075 * k; }
  walk(x, z, dt, v = 1.25) {
    const c = this.rider.char, dx = x - c.pos.x, dz = z - c.pos.z, d = Math.hypot(dx, dz), s = v * dt;
    c.pos.y = c.pos.x > 22.85 ? this.game.world.street.y : 0;
    if (d <= s) { c.pos.x = x; c.pos.z = z; return true; }
    c.pos.x += dx / d * s; c.pos.z += dz / d * s; c.heading = Math.atan2(dx, dz);
    c.play('m_walk_neutral_01', { speed: Math.max(0.6, v / ((this.rider.clipSpeed && this.rider.clipSpeed('m_walk_neutral_01')) || 1.3)), fade: 0.2 });
    this.stepT = (this.stepT || 0) - dt * v * 1.45; if (this.stepT <= 0) { this.stepT = 1; sfx.step({ x: c.pos.x, y: 0.1, z: c.pos.z }, 0.6); }
    return false;
  }
  hold() { const c = this.rider.char; c.hold.R = 0.95; c.gripPos(this.bag.position, 0.06, 0.03, 0.42); this.bag.rotation.set(0, c.root.rotation.y, 0); }
  say(cat) { return this.game.say(this.rider, cat, { loud: true }); }

  // the player's hand over the gate (actions.js takeOrder)
  hand(on) { this.handing = on; if (!on) this.rider.char.reachTo('R', null); }
  handOver() { this.bagGone = true; }
  delivered() {
    this.handing = false; this.bag.visible = false; this.rider.char.reachTo('R', null);
    this.game.later(0.4, () => this.say('rider.give'));
    this.state = 'back'; this.t = 0;
  }
  takeHung() { if (this.hungBag) { this.hungBag.removeFromParent(); this.hungBag = null; } this.state = 'gone'; }
  get hung() { return !!this.hungBag; }

  update(dt) {
    const g = this.game, S = g.world.street;
    if (this.state === 'none' || this.state === 'gone') return;
    this.t += dt;
    const sc = this.sc, c = this.rider && this.rider.char, pos = sc && { x: this.x, y: 0.6, z: this.z };
    switch (this.state) {
      case 'coming':
        if (g.street.busy) this.eta += dt;                 // a car across the gate: he waits round the corner
        if (this.t > this.eta && !g.over) this.arrive();
        break;
      case 'ride': {
        const left = S.park - this.z, v = Math.min(7, Math.sqrt(Math.max(0, 2 * 3.2 * left)) + 0.2);
        this.z += v * dt; sc.group.position.z = this.z; sc.roll(v * dt); sc.group.rotation.z = Math.sin(this.t * 1.7) * 0.012;
        this.seat(); this.engine.set(pos, 0.25 + v / 7 * 0.7);
        if (!g.street.pipOn && this.z > -5) g.street.pip(true);
        if (left < 0.02) { this.z = S.park; sc.group.position.z = this.z; sc.group.rotation.z = 0; this.state = 'stop'; this.t = 0; sfx.brake(pos); }
        break;
      }
      case 'stop':           // engine off, the stand down with his left foot, he lets it lean on it
        this.stand(clamp((this.t - 0.4) / 0.45)); this.seat();
        if (this.t > 0.7 && this.engine) { this.engine.stop(0.4); this.engine = null; }
        if (this.t > 1.1) {
          this.state = 'dismount'; this.t = 0; c.straddle = 0; c.reachTo('R', null); c.reachTo('L', null); c.play('m_idle_neutral_01', { fade: 0.3 });
          const p = sc.at(V(-0.5, 0, -0.15)); c.pos.set(p.x, 0, p.z); c.heading = Math.PI / 2;
        }
        break;
      case 'dismount': {
        const b = sc.at(sc.boxFloor);
        if (this.t > 0.6 && this.walk(b.x - 0.5, b.z, dt)) { this.state = 'box'; this.t = 0; c.heading = Math.PI / 2; c.play('m_idle_neutral_01', { fade: 0.25 }); }
        break;
      }
      case 'box': {        // lifts the lid by its front edge, both hands in, the bag up and out, the lid shut
        const k = this.t, open = sm(clamp(k / 0.55)) * (1 - sm(clamp((k - 2.05) / 0.5))), floor = sc.at(sc.boxFloor), top = sc.at(sc.boxTop);
        sc.setLid(open);
        if (k < 0.6) { c.reachTo('R', sc.lidEdge(-0.14)); c.reachTo('L', null); }
        else if (k < 1.2) { c.reachTo('R', V(top.x - 0.06, top.y - 0.12, top.z + 0.06)); c.reachTo('L', V(top.x - 0.06, top.y - 0.12, top.z - 0.08)); }
        else {
          if (!this.bag.visible) { this.bag.visible = true; sfx.flap(); }
          const lift = sm(clamp((k - 1.2) / 0.65));
          this.bag.position.set(floor.x - lift * 0.34, floor.y + lift * 0.46, floor.z); this.bag.rotation.set(0, Math.PI / 2, 0);
          c.reachTo('R', V(this.bag.position.x, this.bag.position.y + 0.38, this.bag.position.z));
          c.reachTo('L', k > 1.85 && k < 2.6 ? sc.lidEdge(-0.12) : null);
        }
        if (k > 2.7) { this.state = 'toGate'; this.t = 0; c.reachTo('L', null); }
        break;
      }
      case 'toGate':
        c.reachTo('R', null); this.hold();
        if (this.walk(22.42, 6.0, dt)) { this.state = 'wait'; this.t = 0; this.waitT = 0; c.heading = -Math.PI / 2; c.play('m_idle_neutral_01', { fade: 0.3 }); sfx.bell(); this.say('rider.hi'); g.toast('🔔 كابتن طلبات عالباب! روح استلم طلبك', 'good'); this.pipT = 6; }
        break;
      case 'wait': {
        this.pipT -= dt; if (this.pipT < 0 && g.street.pipOn && g.street.state !== 'deed') g.street.pip(false);
        if (this.handing) {
          // arm out over the gate towards you, the bag hanging from it
          const p = g.player, mid = V(21.98, 0.95, (p.z + 6.0) / 2);
          c.reachTo('R', V(mid.x + 0.12, mid.y + 0.42, mid.z)); c.heading = -Math.PI / 2;
          if (!this.bagGone) this.bag.position.set(mid.x + 0.1, mid.y, mid.z); else p.char.gripPos(this.bag.position, 0.06, 0.03, 0.42);
        } else { this.hold(); c.reachTo('R', null); }
        this.waitT += dt;
        if (!this.handing && this.waitT > 18) { this.waitT = 0; this.calls = (this.calls || 0) + 1; if (this.calls < 4) { sfx.bell(); this.say('rider.wait'); } else this.leaveBag(); }
        break;
      }
      case 'back': {
        const p = sc.at(V(-0.5, 0, -0.15));
        if (this.walk(p.x, p.z, dt)) { this.state = 'mount'; this.t = 0; }
        break;
      }
      case 'mount':          // on, stand up, start
        this.stand(1 - clamp((this.t - 0.2) / 0.4)); this.seat();
        if (this.t > 0.6 && !this.engine) { sfx.starter(pos); this.engine = sfx.engine(pos, 2.1); g.street.pip(true); }
        if (this.t > 1.4) { this.state = 'leave'; this.t = 0; this.v = 0; this.stand(0); }
        break;
      case 'leave':
        this.v = Math.min(7, this.v + dt * 3); this.z += this.v * dt; sc.group.position.z = this.z; sc.roll(this.v * dt); this.seat(); this.engine.set(pos, 0.3 + this.v / 7 * 0.7);
        if (g.street.pipOn && this.z > S.park + 8 && !g.street.busy) g.street.pip(false);
        if (this.z > 34) { this.engine.stop(0.2); this.engine = null; sc.group.visible = false; this.unsuit(); this.state = 'gone'; }
        break;
    }
  }
  // nobody came: he hangs it on the gate and goes
  leaveBag() {
    const g = this.game;
    this.say('rider.leave');
    this.hungBag = this.bag.clone(); this.hungBag.position.set(22.05, 0.62, 6.25); this.hungBag.rotation.set(0, Math.PI / 2, 0.1); this.hungBag.visible = true; g.scene.add(this.hungBag);
    this.bag.visible = false; g.toast('الكابتن علّق الطلب عالبوابة ومشي', 'bad');
    this.state = 'back'; this.t = 0;
  }
}
