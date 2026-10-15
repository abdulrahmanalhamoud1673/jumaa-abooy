// The house: a ground-floor Jordanian family home with a front yard.
// Everything static is batched per material; doors, lights and appliances stay live.
// Units are metres. X runs west->east, Z north->south, the house is 16 x 12, the yard is east of it.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { texMat, flatMat } from './assets.js';
import { garment } from './props.js';
import { makeCar, carsTime } from './cars.js';

export const H = 2.9;            // ceiling height
const WT = 0.16;                 // wall thickness
export const ROOMS = {
  parents: { x0: 0, z0: 0, x1: 4.5, z1: 4.5, name: 'غرفة الأهل', floor: 'tiles' },
  bath: { x0: 4.5, z0: 0, x1: 7, z1: 4.5, name: 'الحمّام', floor: 'bathfloor' },
  sis: { x0: 7, z0: 0, x1: 10.5, z1: 4.5, name: 'غرفة سلمى', floor: 'tiles' },
  boys: { x0: 10.5, z0: 0, x1: 16, z1: 4.5, name: 'غرفة الأولاد', floor: 'tiles' },
  hall: { x0: 0, z0: 4.5, x1: 16, z1: 6.5, name: 'الممر', floor: 'tiles' },
  salon: { x0: 0, z0: 6.5, x1: 5, z1: 12, name: 'الصالون', floor: 'marble' },
  living: { x0: 5, z0: 6.5, x1: 11, z1: 12, name: 'غرفة القعدة', floor: 'tiles' },
  kitchen: { x0: 11, z0: 6.5, x1: 16, z1: 12, name: 'المطبخ', floor: 'checker' },
  yard: { x0: 16, z0: 0, x1: 22, z1: 12, name: 'الحوش', floor: 'pavers', outdoor: true },
};
export const WORLD = { x0: 0, z0: 0, x1: 22, z1: 12 };
const CELL = 0.25;

function uvBox(w, h, d, size) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i;
    uv.setXY(k, uv.getX(k) * dims[f][0] / size, uv.getY(k) * dims[f][1] / size);
  }
  return g;
}

// A box with soft edges, textured in metres like uvBox.
function uvRound(w, h, d, r, size) {
  r = Math.max(0.001, Math.min(r, w / 2, h / 2, d / 2));
  const g = new RoundedBoxGeometry(w, h, d, r > 0.025 ? 2 : 1, r);
  const p = g.attributes.position, uv = g.attributes.uv, per = p.count / 6;
  for (let i = 0; i < p.count; i++) {
    const f = Math.floor(i / per) >> 1;          // 0: ±X faces, 1: ±Y, 2: ±Z
    uv.setXY(i, (f === 0 ? p.getZ(i) : p.getX(i)) / size, (f === 1 ? p.getZ(i) : p.getY(i)) / size);
  }
  return g;
}
const plain = (g) => (g.index ? g.toNonIndexed() : g);

function textTexture(draw, w = 512, h = 512) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function rugTexture(base, accent, w = 512, h = 768) {
  return textTexture((g) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const border = (inset, color, lw) => { g.strokeStyle = color; g.lineWidth = lw; g.strokeRect(inset, inset, w - inset * 2, h - inset * 2); };
    border(10, '#e8d9b0', 14); border(34, accent, 22); border(58, '#e8d9b0', 5);
    g.fillStyle = '#e8d9b0';
    for (let i = 0; i < 26; i++) {       // little diamonds round the border
      const t = i / 26;
      for (const [x, y] of [[40 + t * (w - 80), 34], [40 + t * (w - 80), h - 34], [34, 40 + t * (h - 80)], [w - 34, 40 + t * (h - 80)]]) {
        g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 5, y); g.lineTo(x, y + 6); g.lineTo(x - 5, y); g.fill();
      }
    }
    g.translate(w / 2, h / 2);
    for (let r = 5; r >= 1; r--) {        // central medallion
      g.fillStyle = r % 2 ? accent : '#e8d9b0';
      g.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2, rad = (i % 2 ? 0.78 : 1) * r * 34;
        g.lineTo(Math.cos(a) * rad * 0.8, Math.sin(a) * rad * 1.25);
      }
      g.fill();
    }
    g.fillStyle = base;
    for (const [x, y] of [[-150, -260], [150, -260], [-150, 260], [150, 260]]) {
      g.beginPath(); g.arc(x, y, 36, 0, 7); g.fill();
      g.strokeStyle = '#e8d9b0'; g.lineWidth = 4; g.stroke();
    }
  }, w, h);
}

function frameTexture(text, bg, fg, font = 'bold 120px "Amiri","Traditional Arabic","Segoe UI",serif') {
  return textTexture((g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 10; g.strokeRect(18, 18, w - 36, h - 36);
    g.lineWidth = 3; g.strokeRect(34, 34, w - 68, h - 68);
    g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
    const lines = text.split('\n');
    lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 130));
  }, 512, 384);
}

export class World {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.low = !!opts.low;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.batches = new Map();
    this.colliders = [];          // {x0,z0,x1,z1,h}
    this.doors = [];
    this.devices = {};
    this.spots = {};
    this.hides = [];
    this.seats = {};
    this.fragile = [];
    this.windows = [];
    this.rooms = ROOMS;
    this.wardrobes = {};
    this.points = [];             // every point light, for cullLights          // id -> { set(0..1), bay, inside, shelfY, railY }
    this.onDoor = null;           // (door) => sound
    this.M = this.materials();
    this.M.curtain.side = this.M.curtainGold.side = THREE.DoubleSide;
    this.build();
    this.finish();
    this.buildNav();
    this.setTime('day');
  }

  materials() {
    return {
      wall: this.paint(0xf1e9d9),
      // what Amman houses are painted: warm beiges for the hall and the sitting rooms, a colour of their own for the bedrooms
      paints: { hall: this.paint(0xdac39c), salon: this.paint(0xe2c9a4), living: this.paint(0xd6bd95), kitchen: this.paint(0xe6d8b8),
        boys: this.paint(0xa8bfcc), sis: this.paint(0xe6bfbf), parents: this.paint(0xd5c0a2), bath: this.paint(0xe2e8e8) },
      skirt: texMat('marble', { size: 0.7, rough: 0.35, color: 0xe8dcc8 }), skirtMarble: texMat('marble', { size: 0.8, rough: 0.35 }),
      cornice: flatMat(0xf6f3ec, { rough: 0.9 }),
      ceiling: flatMat(0xf4f1ea, { rough: 0.95 }),
      tiles: texMat('tiles', { size: 2.0, rough: 0.55 }),
      marble: texMat('marble', { size: 2.4, rough: 0.35 }),
      checker: texMat('checker', { size: 1.6, rough: 0.6 }),
      bathfloor: texMat('bathfloor', { size: 1.4, rough: 0.5 }),
      whitetile: texMat('whitetile', { size: 1.1, rough: 0.35 }),
      pavers: texMat('pavers', { size: 1.8 }),
      stone: texMat('stone', { size: 2.2 }),
      oak: texMat('oak', { size: 1.2, rough: 0.6 }),
      walnut: texMat('walnut', { size: 1.2, rough: 0.55 }),
      jacquard: texMat('jacquard', { size: 0.9 }),
      jacquardGold: texMat('jacquard', { size: 0.9, color: 0xd8b25a }),
      plaid: texMat('plaid', { size: 0.8, color: 0xc24b4b }),
      sheet: texMat('sheet', { size: 0.9, color: 0xdfe6ee }),
      sheetBlue: texMat('sheet', { size: 0.9, color: 0x7f9ecf }),
      sheetPink: texMat('sheet', { size: 0.9, color: 0xe7a8c2 }),
      leather: texMat('leather', { size: 1.0, rough: 0.55 }),
      velvet: texMat('jacquard', { size: 0.7, color: 0x8a6f4a }),
      white: flatMat(0xf2f2f0, { rough: 0.45 }),
      cream: flatMat(0xe9dfc8, { rough: 0.6 }),
      steel: flatMat(0xb9bcc0, { rough: 0.3, metal: 0.85 }),
      dark: flatMat(0x1c1d20, { rough: 0.45 }),
      black: flatMat(0x0c0c0d, { rough: 0.3, metal: 0.2 }),
      gold: flatMat(0xc9a24a, { rough: 0.3, metal: 0.9 }),
      plasticBlue: flatMat(0x2f6fd0, { rough: 0.5 }),
      plasticRed: flatMat(0xc33a2c, { rough: 0.5 }),
      green: flatMat(0x3f7a3a, { rough: 0.85 }),
      terracotta: flatMat(0xb5633c, { rough: 0.9 }),
      rubber: flatMat(0x18181a, { rough: 0.9 }),
      curtain: texMat('sheet', { size: 0.5, color: 0xc9b287 }),
      curtainGold: texMat('jacquard', { size: 0.7, color: 0xc7a55c }),
      asphalt: flatMat(0x4b4b4d, { rough: 0.95 }),
      metalGreen: flatMat(0x2f4a3a, { rough: 0.5, metal: 0.6 }),
      porcelain: flatMat(0xfafafa, { rough: 0.15 }),
      oakDoor: texMat('oak', { size: 0.9, rough: 0.5, color: 0xf3e6cf }),
      mirror: flatMat(0xd5e3ec, { rough: 0.04, metal: 0.65 }),
      pane: Object.assign(new THREE.MeshStandardMaterial({ color: 0xe4f3fb, roughness: 0.04, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }), { userData: { uvSize: 1 } }),
      glass: new THREE.MeshStandardMaterial({ color: 0xbfd8e8, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.25,
        emissive: 0xbfe0ff, emissiveIntensity: 0.6 }),
    };
  }

  // Painted plaster: flat colour with the plaster's bumps.
  paint(color) {
    const m = texMat('wall', { color, size: 2.2, normal: 0.5 }).clone();
    m.map = null; m.roughnessMap = null; m.roughness = 0.92; m.userData.uvSize = 2.2;
    return m;
  }

  // ---------- low-level builders ----------
  push(mat, geo) {
    if (!this.batches.has(mat)) this.batches.set(mat, []);
    this.batches.get(mat).push(geo);
  }
  box(mat, w, h, d, x, y, z, ry = 0) {
    const g = uvBox(w, h, d, mat.userData.uvSize || 1);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    this.push(mat, g);
  }
  cyl(mat, rt, rb, h, x, y, z, seg = 14, rx = 0, rz = 0) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg);
    if (rx) g.rotateX(rx);
    if (rz) g.rotateZ(rz);
    g.translate(x, y, z);
    this.push(mat, g);
  }
  sph(mat, r, x, y, z, sy = 1) {
    const g = new THREE.SphereGeometry(r, 14, 10);
    g.scale(1, sy, 1); g.translate(x, y, z);
    this.push(mat, g);
  }
  rbox(mat, w, h, d, r, x, y, z, ry = 0) {
    const g = uvRound(w, h, d, r, mat.userData.uvSize || 1);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    this.push(mat, g);
  }
  // A turned shape: the profile [[radius, height], ...] spun round the vertical. Drawn bottom-up it faces out, top-down it faces in.
  lathe(mat, pts, x, y, z, seg = 16, sx = 1, sz = 1, ry = 0) {
    const g = new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg);
    if (sx !== 1 || sz !== 1) g.scale(sx, 1, sz);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    this.push(mat, g);
  }
  tube(mat, pts, r, seg = 6) {
    const c = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    this.push(mat, new THREE.TubeGeometry(c, Math.max(8, pts.length * 5), r, seg, false));
  }
  solid(x0, z0, x1, z1, h = H) {
    this.colliders.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), h });
  }
  // A piece of furniture described in its own space (front faces local +Z), placed at (ox, oz) and turned by quarter turns.
  at(ox, oz, turns = 0) {
    const ry = turns * Math.PI / 2;
    const c = Math.round(Math.cos(ry)), s = Math.round(Math.sin(ry));
    const world = (lx, lz) => [ox + lx * c + lz * s, oz - lx * s + lz * c];
    const self = this;
    return {
      world, ry,
      box(mat, w, h, d, lx, ly, lz) { const [x, z] = world(lx, lz); self.box(mat, w, h, d, x, ly, z, ry); return this; },
      rbox(mat, w, h, d, r, lx, ly, lz) { const [x, z] = world(lx, lz); self.rbox(mat, w, h, d, r, x, ly, z, ry); return this; },
      cyl(mat, rt, rb, h, lx, ly, lz, seg = 14, rx = 0, rz = 0) {
        const [x, z] = world(lx, lz), g = new THREE.CylinderGeometry(rt, rb, h, seg);
        if (rx) g.rotateX(rx);
        if (rz) g.rotateZ(rz);
        if (ry) g.rotateY(ry);
        g.translate(x, ly, z); self.push(mat, g); return this;
      },
      geo(mat, g, lx, ly, lz) { const [x, z] = world(lx, lz); if (ry) g.rotateY(ry); g.translate(x, ly, z); self.push(mat, g); return this; },
      lathe(mat, pts, lx, ly, lz, seg, sx, sz) { const [x, z] = world(lx, lz); self.lathe(mat, pts, x, ly, z, seg, sx, sz, ry); return this; },
      tube(mat, pts, r, seg) { self.tube(mat, pts.map(([lx, y, lz]) => { const [x, z] = world(lx, lz); return [x, y, z]; }), r, seg); return this; },
      sph(mat, r, lx, ly, lz, sy) { const [x, z] = world(lx, lz); self.sph(mat, r, x, ly, z, sy); return this; },
      solid(lx0, lz0, lx1, lz1, h) { const a = world(lx0, lz0), b = world(lx1, lz1); self.solid(a[0], a[1], b[0], b[1], h); return this; },
      spot(id, lx, lz, room, extra = {}) {
        const [x, z] = world(lx, lz);
        self.spots[id] = { id, x, z, face: ry + Math.PI, room, ...extra };   // stand in front, look back at the furniture
        return this;
      },
    };
  }
  live(mesh) { this.group.add(mesh); return mesh; }

  // A wall from (ax,az) to (bx,bz), axis aligned, with door / window gaps: {a, b, kind:'door'|'arch'|'window'|'small'}
  wall(ax, az, bx, bz, gaps = [], { mat = this.M.wall, outer = false, h = H, t = WT } = {}) {
    const alongX = Math.abs(bx - ax) > Math.abs(bz - az);
    const from = alongX ? Math.min(ax, bx) : Math.min(az, bz), to = alongX ? Math.max(ax, bx) : Math.max(az, bz);
    const fixed = alongX ? az : ax;
    const house = mat === this.M.wall && h === H, M = this.M;
    // a slab of the wall: its centre line along (a..b), `off` from the wall's line, `th` thick
    const slab = (m, a, b, y0, y1, off, th) => {
      const len = b - a, mid = (a + b) / 2;
      if (alongX) this.box(m, len, y1 - y0, th, mid, (y0 + y1) / 2, fixed + off);
      else this.box(m, th, y1 - y0, len, fixed + off, (y0 + y1) / 2, mid);
    };
    const piece = (a, b, y0, y1, collide) => {
      if (b - a < 0.01 || y1 - y0 < 0.01) return;
      const len = b - a, mid = (a + b) / 2;
      if (!house) slab(mat, a, b, y0, y1, 0, t);
      else {
        // inside the house each face takes the paint of the room it faces (a long wall passes several rooms), with the
        // tiled skirting the floor is finished with and the plaster cornice under the ceiling
        const cuts = [a, ...new Set(Object.values(ROOMS).flatMap((r) => (alongX ? [r.x0, r.x1] : [r.z0, r.z1])).filter((v) => v > a + 0.01 && v < b - 0.01))].sort((p, q) => p - q);
        cuts.push(b);
        for (const s of [-1, 1]) for (let i = 0; i < cuts.length - 1; i++) {
          const c0 = cuts[i], c1 = cuts[i + 1], cm = (c0 + c1) / 2, o = s * (t / 2 + 0.12);
          const room = outer === s ? null : (alongX ? this.roomAt(cm, fixed + o) : this.roomAt(fixed + o, cm));
          slab(room && M.paints[room] || mat, c0, c1, y0, y1, s * t / 4, t / 2);
          if (!room || ROOMS[room].outdoor) continue;
          if (y0 === 0 && room !== 'bath') slab(ROOMS[room].floor === 'marble' ? M.skirtMarble : M.skirt, c0, c1, 0, 0.1, s * (t / 2 + 0.006), 0.012);
          if (y1 >= H - 0.001 && room !== 'bath') { slab(M.cornice, c0, c1, H - 0.075, H, s * (t / 2 + 0.014), 0.028); slab(M.cornice, c0, c1, H - 0.028, H, s * (t / 2 + 0.035), 0.07); }
        }
      }
      if (outer) {          // stone cladding outside
        const side = outer;
        if (alongX) this.box(this.M.stone, len, y1 - y0, 0.06, mid, (y0 + y1) / 2, fixed + side * (t / 2 + 0.03));
        else this.box(this.M.stone, 0.06, y1 - y0, len, fixed + side * (t / 2 + 0.03), (y0 + y1) / 2, mid);
      }
      if (collide) {
        if (alongX) this.solid(a, fixed - t / 2, b, fixed + t / 2, y1);
        else this.solid(fixed - t / 2, a, fixed + t / 2, b, y1);
      }
    };
    let cursor = from;
    for (const g of [...gaps].sort((p, q) => p.a - q.a)) {
      piece(cursor, g.a, 0, h, true);
      if (g.kind === 'door' || g.kind === 'arch') piece(g.a, g.b, g.kind === 'arch' ? 2.3 : 2.08, h, false);
      else {
        const sill = g.kind === 'small' ? 1.65 : 0.95, top = g.kind === 'small' ? 2.15 : 2.2;
        piece(g.a, g.b, 0, sill, false); piece(g.a, g.b, top, h, false);
        if (alongX) this.solid(g.a, fixed - t / 2, g.b, fixed + t / 2, H);
        else this.solid(fixed - t / 2, g.a, fixed + t / 2, g.b, H);
        this.window(alongX, fixed, g.a, g.b, sill, top, g);
      }
      cursor = g.b;
    }
    piece(cursor, to, 0, h, true);
  }

  window(alongX, fixed, a, b, y0, y1, g) {
    const len = b - a, mid = (a + b) / 2, hh = y1 - y0, my = (y0 + y1) / 2;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(len, hh), this.M.glass);
    pane.position.set(alongX ? mid : fixed, my, alongX ? fixed : mid);
    if (!alongX) pane.rotation.y = Math.PI / 2;
    this.live(pane);
    this.windows.push(pane);
    const f = 0.05, F = this.M.white;
    const bar = (w, hgt, u, y) => (alongX ? this.box(F, w, hgt, 0.07, u, y, fixed) : this.box(F, 0.07, hgt, w, fixed, y, u));
    bar(len, f, mid, y0 + f / 2); bar(len, f, mid, y1 - f / 2);
    bar(f, hh, a + f / 2, my); bar(f, hh, b - f / 2, my); bar(f, hh, mid, my);
    const inn = g.inside || 1;
    if (alongX) this.rbox(this.M.marble, len + 0.1, 0.03, 0.2, 0.012, mid, y0 - 0.005, fixed + inn * 0.06);
    else this.rbox(this.M.marble, 0.2, 0.03, len + 0.1, 0.012, fixed + inn * 0.06, y0 - 0.005, mid);
    if (g.curtain !== false && g.kind !== 'small') {
      const cm = g.gold ? this.M.curtainGold : this.M.curtain, cw = Math.min(0.62, len * 0.34), off = fixed + inn * 0.15, G = this.M.gold, rl = len + 0.6;
      for (const [u, dir] of [[a + cw / 2 - 0.12, 1], [b - cw / 2 + 0.12, -1]]) {
        this.drape(cm, alongX, u, off, cw, dir);
        const tu = u - dir * cw * 0.25;                 // the tie-back sits where the cloth is gathered
        if (alongX) this.rbox(G, cw * 0.52, 0.035, 0.09, 0.015, tu, 1.13, off); else this.rbox(G, 0.09, 0.035, cw * 0.52, 0.015, off, 1.13, tu);
      }
      if (alongX) { this.cyl(G, 0.016, 0.016, rl, mid, 2.5, off, 8, 0, Math.PI / 2); for (const e of [-1, 1]) this.sph(G, 0.038, mid + e * rl / 2, 2.5, off); }
      else { this.cyl(G, 0.016, 0.016, rl, off, 2.5, mid, 8, Math.PI / 2, 0); for (const e of [-1, 1]) this.sph(G, 0.038, off, 2.5, mid + e * rl / 2); }
    }
  }
  // One curtain panel: pleated, caught by a tie-back so it sweeps toward its outer edge.
  drape(mat, alongX, u, off, w, dir) {
    const h = 2.37, g = new THREE.PlaneGeometry(w, h, 24, 12), p = g.attributes.position, uv = g.attributes.uv, size = mat.userData.uvSize || 1;
    if (!alongX) dir = -dir;                                             // turning the panel swaps its ends
    for (let i = 0; i < p.count; i++) {
      const t = p.getX(i) / w + 0.5, y = p.getY(i) + h / 2, e = dir > 0 ? t : 1 - t;       // e: 0 at the outer edge
      const k = 1 - 0.5 * Math.exp(-(((y - 1.0) / 0.45) ** 2)) - 0.1 * Math.max(0, 1 - y);   // how far the cloth spreads at this height
      p.setXYZ(i, dir * (-w / 2 + e * w * k), y, Math.sin(e * 24) * (0.014 + 0.022 * (1 - y / h)) * (0.5 + 0.5 * k) + 0.012 * Math.sin(e * 7 + y * 3));
      uv.setXY(i, t * w / size, y / size);
    }
    g.computeVertexNormals();
    if (!alongX) g.rotateY(Math.PI / 2);
    g.translate(alongX ? u : off, 0.13, alongX ? off : u);
    this.push(mat, g);
  }

  door(id, x, z, alongX, width, { room, swing = 1, hinge = -1, mat = this.M.oak, auto = true } = {}) {
    const pivot = new THREE.Group(), lw = width - 0.04, cx = -hinge * (width / 2 - 0.02), hx = -hinge * (width - 0.11);
    // a leaf with two raised panels a side and a lever handle on its rose
    const wood = [uvBox(lw, 2.04, 0.04, 1.2).translate(cx, 1.02, 0)], metal = [];
    for (const f of [-1, 1]) {
      for (const [py, ph] of [[1.44, 0.96], [0.52, 0.66]]) wood.push(uvRound(lw - 0.24, ph, 0.016, 0.007, 1.2).translate(cx, py, f * 0.021));
      metal.push(new THREE.CylinderGeometry(0.027, 0.027, 0.012, 16).rotateX(Math.PI / 2).translate(hx, 1.02, f * 0.026),
        new THREE.CylinderGeometry(0.009, 0.009, 0.045, 8).rotateX(Math.PI / 2).translate(hx, 1.02, f * 0.045),
        new THREE.CapsuleGeometry(0.0095, 0.1, 4, 8).rotateZ(Math.PI / 2).translate(hx + hinge * 0.05, 1.02, f * 0.066),
        new THREE.CylinderGeometry(0.014, 0.014, 0.008, 12).rotateX(Math.PI / 2).translate(hx, 0.91, f * 0.024));
    }
    const leaf = new THREE.Mesh(mergeGeometries(wood.map(plain)), mat);
    leaf.castShadow = true; leaf.receiveShadow = true;
    const handles = new THREE.Mesh(mergeGeometries(metal.map(plain)), this.M.gold);
    pivot.add(leaf, handles);
    if (alongX) pivot.position.set(x + hinge * width / 2, 0, z);
    else { pivot.position.set(x, 0, z + hinge * width / 2); pivot.rotation.y = -Math.PI / 2; }
    this.live(pivot);
    // frame
    const F = this.M.walnut, t = WT + 0.04;
    if (alongX) {
      this.box(F, 0.06, 2.1, t, x - width / 2 - 0.03, 1.05, z); this.box(F, 0.06, 2.1, t, x + width / 2 + 0.03, 1.05, z);
      this.box(F, width + 0.12, 0.06, t, x, 2.11, z);
    } else {
      this.box(F, t, 2.1, 0.06, x, 1.05, z - width / 2 - 0.03); this.box(F, t, 2.1, 0.06, x, 1.05, z + width / 2 + 0.03);
      this.box(F, t, 0.06, width + 0.12, x, 2.11, z);
    }
    const d = { id, x, z, alongX, width, pivot, handleX: hx, base: pivot.rotation.y, open: 0, target: 0, hold: 0, swing: swing * hinge, room, auto, locked: false };
    this.doors.push(d);
    return d;
  }

  light(room, x, z, { fancy = false, power = 1 } = {}) {
    const lamp = new THREE.PointLight(0xffe2b8, 0, 9.5, 1.6);
    lamp.position.set(x, 2.45, z);
    this.group.add(lamp); this.points.push(lamp);
    const shadeMat = new THREE.MeshStandardMaterial({ color: 0xfff6e4, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.6 });
    let shade;
    if (fancy) {
      // the salon chandelier: a glowing globe and six candle arms
      const G = this.M.gold, bulbs = [new THREE.SphereGeometry(0.1, 16, 12).translate(0, -0.07, 0)];
      this.lathe(G, [[0, -0.05], [0.03, -0.05], [0.09, -0.012], [0.1, 0]], x, H, z, 18); this.cyl(G, 0.01, 0.01, 0.34, x, H - 0.2, z, 6);
      this.lathe(G, [[0, -0.2], [0.02, -0.19], [0.03, -0.14], [0.075, -0.06], [0.045, 0], [0.02, 0.05], [0.012, 0.1]], x, 2.45, z, 16);
      for (let i = 0; i < 6; i++) {
        const c = Math.cos(i / 6 * Math.PI * 2), sn = Math.sin(i / 6 * Math.PI * 2);
        this.tube(G, [[x + c * 0.04, 2.42, z + sn * 0.04], [x + c * 0.16, 2.33, z + sn * 0.16], [x + c * 0.29, 2.35, z + sn * 0.29], [x + c * 0.34, 2.43, z + sn * 0.34]], 0.009);
        this.lathe(G, [[0, 0], [0.018, 0.004], [0.04, 0.03], [0.042, 0.032]], x + c * 0.34, 2.43, z + sn * 0.34, 10);
        bulbs.push(new THREE.SphereGeometry(0.032, 10, 8).scale(1, 1.7, 1).translate(c * 0.34, 0.085, sn * 0.34));
      }
      shade = new THREE.Mesh(mergeGeometries(bulbs), shadeMat); shade.position.set(x, 2.42, z);
    } else {
      // a frosted bowl under a ceiling ring
      shade = new THREE.Mesh(new THREE.SphereGeometry(0.23, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1, 0.5, 1), shadeMat); shade.position.set(x, H - 0.03, z);
      this.cyl(this.M.white, 0.25, 0.25, 0.035, x, H - 0.018, z, 24);
    }
    this.live(shade);
    const dev = { id: 'light_' + room, type: 'light', room, on: false, lamp, shadeMat, power: 26 * power, label: 'الضو' };
    dev.set = (on) => { dev.on = on; lamp.intensity = on ? dev.power : 0; shadeMat.emissiveIntensity = on ? 2.2 : 0; };
    this.devices[dev.id] = dev;
    return dev;
  }
  lightSwitch(room, x, z, alongX, side) {
    // a proper plate on a dark surround so it stands out from the wall, with a pilot lamp that glows while the light is on
    const plate = this.M.white, rim = this.M.dark, off = WT / 2, put = (m, w, h, t, o, dy = 0) => (alongX ? this.rbox(m, w, h, t, 0.006, x, 1.3 + dy, z + side * (off + o)) : this.rbox(m, t, h, w, 0.006, x + side * (off + o), 1.3 + dy, z));
    put(rim, 0.135, 0.175, 0.01, 0.005); put(plate, 0.11, 0.15, 0.014, 0.01); put(this.M.cream, 0.055, 0.08, 0.012, 0.018, -0.012);
    const led = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 0.03 : 0.008, 0.016, alongX ? 0.008 : 0.03), new THREE.MeshStandardMaterial({ color: 0x3a1408, emissive: 0xff5a1e, emissiveIntensity: 0.1 }));
    led.position.set(alongX ? x : x + side * (off + 0.026), 1.356, alongX ? z + side * (off + 0.026) : z); this.live(led);
    const d = this.devices['light_' + room];
    const set0 = d.set; d.set = (on) => { set0(on); led.material.emissiveIntensity = on ? 3.5 : 0.1; };
    d.sx = alongX ? x : x + side * (off + 0.06); d.sy = 1.62; d.sz = alongX ? z + side * (off + 0.06) : z;
    d.x = alongX ? x : x + side * 0.45; d.z = alongX ? z + side * 0.45 : z;
    d.face = alongX ? (side > 0 ? Math.PI : 0) : (side > 0 ? -Math.PI / 2 : Math.PI / 2);
  }

  ac(id, room, x, z, alongX, side) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.86, 0.28, 0.2, 2, 0.06), this.M.white); body.castShadow = true;
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.006, 0.11), this.M.dark); intake.position.set(0, 0.139, -0.01);
    const outlet = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.03, 0.05), this.M.dark); outlet.position.set(0, -0.122, 0.058);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.01), new THREE.MeshStandardMaterial({ color: 0x113311, emissive: 0x35ff5a, emissiveIntensity: 0 }));
    led.position.set(0.33, -0.05, 0.1);
    const flap = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.012, 0.085, 1, 0.005), this.M.cream);
    flap.position.set(0, -0.137, 0.068);
    g.add(body, intake, outlet, led, flap);
    g.position.set(alongX ? x : x + side * 0.18, 2.35, alongX ? z + side * 0.18 : z);
    g.rotation.y = alongX ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
    this.live(g);
    const dev = { id, type: 'ac', room, on: false, label: 'المكيف', x: alongX ? x : x + side * 0.7, z: alongX ? z + side * 0.7 : z,
      face: alongX ? (side > 0 ? Math.PI : 0) : (side > 0 ? -Math.PI / 2 : Math.PI / 2) };
    dev.set = (on) => { dev.on = on; led.material.emissiveIntensity = on ? 3 : 0; flap.rotation.x = on ? 0.7 : 0; };
    this.devices[id] = dev;
    return dev;
  }

  // ---------- the house ----------
  build() {
    const M = this.M;
    // floors
    for (const [id, r] of Object.entries(ROOMS)) {
      const w = r.x1 - r.x0, d = r.z1 - r.z0;
      this.box(M[r.floor], w, 0.1, d, (r.x0 + r.x1) / 2, -0.05, (r.z0 + r.z1) / 2);
      r.id = id; r.cx = (r.x0 + r.x1) / 2; r.cz = (r.z0 + r.z1) / 2;
    }
    // ground outside + roof
    this.box(M.asphalt, 80, 0.1, 80, 11, -0.12, 6);
    this.box(M.ceiling, 16.2, 0.2, 12.2, 8, H + 0.1, 6);
    this.box(M.stone, 16.5, 0.5, 0.2, 8, H + 0.45, -0.1); this.box(M.stone, 16.5, 0.5, 0.2, 8, H + 0.45, 12.1);
    this.box(M.stone, 0.2, 0.5, 12.4, -0.1, H + 0.45, 6); this.box(M.stone, 0.2, 0.5, 12.4, 16.1, H + 0.45, 6);

    // outer walls
    this.wall(0, 0, 16, 0, [{ a: 1.4, b: 3.0, kind: 'window', inside: 1 }, { a: 5.4, b: 6.1, kind: 'small' },
      { a: 8.0, b: 9.5, kind: 'window', inside: 1 }, { a: 12.4, b: 14.4, kind: 'window', inside: 1 }], { outer: -1 });
    this.wall(0, 12, 16, 12, [{ a: 1.5, b: 3.5, kind: 'window', inside: -1, gold: true }, { a: 7, b: 9, kind: 'window', inside: -1 },
      { a: 12.6, b: 14.4, kind: 'window', inside: -1, curtain: false }], { outer: 1 });
    this.wall(0, 0, 0, 12, [{ a: 1.5, b: 3.0, kind: 'window', inside: 1 }, { a: 8.4, b: 10, kind: 'window', inside: 1, gold: true }], { outer: -1 });
    this.wall(16, 0, 16, 12, [{ a: 1.6, b: 3.0, kind: 'window', inside: -1 }, { a: 5.0, b: 6.0, kind: 'door' },
      { a: 8.3, b: 9.7, kind: 'window', inside: -1, curtain: false }], { outer: 1 });
    // inner walls
    this.wall(0, 4.5, 16, 4.5, [{ a: 2.8, b: 3.7, kind: 'door' }, { a: 5.3, b: 6.2, kind: 'door' }, { a: 8.3, b: 9.2, kind: 'door' }, { a: 11.4, b: 12.3, kind: 'door' }]);
    this.wall(0, 6.5, 16, 6.5, [{ a: 2.2, b: 3.4, kind: 'door' }, { a: 7, b: 9, kind: 'arch' }, { a: 13, b: 14, kind: 'arch' }]);
    this.wall(4.5, 0, 4.5, 4.5); this.wall(7, 0, 7, 4.5); this.wall(10.5, 0, 10.5, 4.5);
    this.wall(5, 6.5, 5, 12, [{ a: 10, b: 11, kind: 'door' }]);
    this.wall(11, 6.5, 11, 12, [{ a: 9.8, b: 10.8, kind: 'arch' }]);

    // doors (auto-opening leaves)
    this.door('parents', 3.25, 4.5, true, 0.9, { room: 'parents', swing: -1 });
    this.door('bath', 5.75, 4.5, true, 0.9, { room: 'bath', swing: -1 });
    this.door('sis', 8.75, 4.5, true, 0.9, { room: 'sis', swing: -1 });
    this.door('boys', 11.85, 4.5, true, 0.9, { room: 'boys', swing: -1 });
    this.door('salon', 2.8, 6.5, true, 1.2, { room: 'salon', swing: 1, mat: M.walnut });
    this.door('salon2', 5, 10.5, false, 1.0, { room: 'salon', swing: 1, mat: M.walnut });
    this.door('main', 16, 5.5, false, 1.0, { room: 'yard', swing: -1, mat: M.walnut });

    // lights + switches
    this.light('parents', 2.25, 2.25); this.lightSwitch('parents', 2.45, 4.5, true, -1);
    this.light('bath', 5.75, 2.4, { power: 0.8 }); this.lightSwitch('bath', 5.05, 4.5, true, 1);
    this.light('sis', 8.75, 2.25); this.lightSwitch('sis', 9.55, 4.5, true, -1);
    this.light('boys', 13.25, 2.25); this.lightSwitch('boys', 12.65, 4.5, true, -1);
    this.light('hall', 8, 5.5, { power: 1.1 }); this.lightSwitch('hall', 9.6, 4.5, true, 1);
    this.light('salon', 2.5, 9.3, { fancy: true, power: 1.3 }); this.lightSwitch('salon', 3.7, 6.5, true, 1);
    this.light('living', 8, 9.2, { power: 1.2 }); this.lightSwitch('living', 9.35, 6.5, true, 1);
    this.light('kitchen', 13.5, 9.2, { power: 1.2 }); this.lightSwitch('kitchen', 12.6, 6.5, true, 1);
    this.devices.light_hall.lamp.position.x = 8;
    const hall2 = new THREE.PointLight(0xffe2b8, 0, 8, 1.6); hall2.position.set(2.5, 2.45, 5.5); this.group.add(hall2);
    const hall3 = new THREE.PointLight(0xffe2b8, 0, 8, 1.6); hall3.position.set(13.5, 2.45, 5.5); this.group.add(hall3); this.points.push(hall2, hall3);
    const hallSet = this.devices.light_hall.set;
    this.devices.light_hall.set = (on) => { hallSet(on); hall2.intensity = hall3.intensity = on ? 14 : 0; };

    this.parents(); this.bathroom(); this.sisRoom(); this.boysRoom(); this.hallway(); this.salon(); this.living(); this.kitchen(); this.yard();
  }

  // ---------- furniture (rounded, upholstered, with the small things that make a room lived-in) ----------
  legs(P, mat, hw, hd, h, r = 0.022, y0 = 0) { for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.cyl(mat, r, r * 0.7, h, sx * hw, y0 + h / 2, sz * hd, 8); }

  bed(ox, oz, turns, { w = 1.0, l = 2.0, sheet, id, room }) {
    const M = this.M, P = this.at(ox, oz, turns);
    // local: head at -Z, foot at +Z
    this.legs(P, M.dark, w / 2 - 0.02, l / 2 - 0.06, 0.09, 0.035);
    P.rbox(M.walnut, w + 0.1, 0.24, l + 0.04, 0.03, 0, 0.2, 0)
      .rbox(M.walnut, w + 0.14, 0.92, 0.09, 0.04, 0, 0.56, -l / 2 - 0.04).rbox(M.velvet, w - 0.08, 0.5, 0.05, 0.03, 0, 0.72, -l / 2 + 0.005)
      .rbox(M.walnut, w + 0.12, 0.34, 0.06, 0.03, 0, 0.3, l / 2 + 0.03);
    P.rbox(M.white, w, 0.2, l - 0.06, 0.07, 0, 0.42, 0)                                              // mattress
      .rbox(sheet, w + 0.05, 0.07, l * 0.62, 0.035, 0, 0.55, l * 0.17)                              // duvet
      .rbox(M.white, w + 0.055, 0.04, 0.2, 0.02, 0, 0.575, l * 0.17 - l * 0.31 + 0.1);              // turned-down sheet
    const pillows = w > 1.4 ? [-w / 4, w / 4] : [0];
    for (const px of pillows) P.rbox(M.white, Math.min(0.6, w * 0.42), 0.13, 0.36, 0.06, px, 0.585, -l / 2 + 0.26);
    if (w > 1.4) P.rbox(M.velvet, 0.36, 0.14, 0.26, 0.06, 0, 0.62, -l / 2 + 0.5);
    P.solid(-w / 2 - 0.04, -l / 2 - 0.06, w / 2 + 0.04, l / 2, 0.58);
    this.seats[id] = { x: P.world(0, 0.1)[0], z: P.world(0, 0.1)[1], heading: P.ry, y: 0.52, lie: true, pillow: P.world(pillows[0], -l / 2 + 0.3) };
    return P;
  }
  wardrobe(ox, oz, turns, { w = 1.6, id, room, mat }) {
    const M = this.M, P = this.at(ox, oz, turns), wood = mat || M.walnut, size = wood.userData.uvSize || 1;
    const n = Math.round(w / 0.55), dw = w / n, live = Math.floor(n / 2), bayX = -w / 2 + (live + 0.5) * dw;
    // the carcass is panels, not a block: the bay behind the opening door is a real space
    P.box(wood, w, 2.04, 0.02, 0, 1.08, -0.27).box(wood, w, 0.03, 0.56, 0, 2.085, 0).box(wood, w, 0.03, 0.56, 0, 0.075, 0)
      .box(M.dark, w - 0.06, 0.07, 0.5, 0, 0.035, 0).rbox(wood, w + 0.07, 0.07, 0.62, 0.02, 0, 2.13, 0.01);
    for (let i = 0; i <= n; i++) P.box(wood, 0.02, 2.04, 0.56, -w / 2 + i * dw + (i === 0 ? 0.01 : i === n ? -0.01 : 0), 1.08, 0);
    // a door as [material, geometry] pieces about its own centre line; hs = which side the handle is on
    const door = (mirror, hs) => {
      const out = [[M.oak, uvRound(dw - 0.025, 1.92, 0.025, 0.008, M.oak.userData.uvSize || 1).translate(0, 1.07, 0)],
        [M.gold, new THREE.CylinderGeometry(0.008, 0.008, 0.26, 8).translate(hs * (dw / 2 - 0.05), 1.05, 0.032)]];
      if (mirror) out.push([M.mirror, new THREE.BoxGeometry(dw - 0.14, 1.5, 0.006).translate(0, 1.12, 0.015)]);
      else out.push([wood, uvRound(dw - 0.14, 0.95, 0.012, 0.004, size).translate(0, 1.48, 0.014)], [wood, uvRound(dw - 0.14, 0.62, 0.012, 0.004, size).translate(0, 0.56, 0.014)]);
      return out;
    };
    const leaf = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const lx = -w / 2 + (i + 0.5) * dw, mirror = n > 2 && i === 1;
      if (i !== live) { for (const [m, g] of door(mirror, i % 2 ? -1 : 1)) P.geo(m, g, lx, 0, 0.288); continue; }
      // this one swings: hinged on its far edge, handle towards the middle
      const byMat = new Map();
      for (const [m, g] of door(mirror, -1)) { g.translate(-dw / 2, 0, 0); if (!byMat.has(m)) byMat.set(m, []); byMat.get(m).push(plain(g)); }
      for (const [m, gs] of byMat) { const mesh = new THREE.Mesh(gs.length > 1 ? mergeGeometries(gs) : gs[0], m); mesh.castShadow = true; mesh.receiveShadow = true; leaf.add(mesh); }
      const [hx, hz] = P.world(lx + dw / 2, 0.288); leaf.position.set(hx, 0, hz); leaf.rotation.y = P.ry; this.live(leaf);
    }
    // inside that bay: folded piles on the shelves, a rail of hanging clothes above
    const C = [0x1f55b0, 0xa82f2f, 0xe8e4da, 0x2f7a48, 0xd9a520, 0x4a3a78, 0x23262e], cloth = (j) => flatMat(C[(j + n * 2) % C.length], { rough: 0.95 });
    for (const y of [0.45, 0.82]) P.box(wood, dw - 0.03, 0.02, 0.5, bayX, y, 0);
    P.cyl(M.steel, 0.012, 0.012, dw - 0.03, bayX, 1.74, 0.02, 8, 0, Math.PI / 2);
    ['shirt', 'thobe', 'shirt', 'pants'].forEach((kind, j) => {
      const g = garment(kind).geometry.clone(); g.scale(0.6, 0.85, 5); g.rotateY(Math.PI / 2 + (j % 2 ? 0.25 : -0.2));
      P.geo(cloth(j * 2), g, bayX - dw / 2 + 0.1 + j * (dw - 0.2) / 3, 1.71, 0.02);
    });
    for (let j = 0; j < 3; j++) P.rbox(cloth(j + 1), 0.3, 0.045, 0.26, 0.02, bayX - 0.06, 0.113 + j * 0.046, 0.02);
    for (let j = 0; j < 2; j++) P.rbox(cloth(j + 4), 0.28, 0.045, 0.26, 0.02, bayX + 0.06, 0.483 + j * 0.046, 0);
    const [bx, bz] = P.world(bayX, 0.3), [ix, iz] = P.world(bayX, 0.06);
    const W = { leaf, open: 0, bay: { x: bx, z: bz }, inside: { x: ix, z: iz }, shelfY: 0.855, railY: 1.66 };
    W.set = (k) => { W.open = k; leaf.rotation.y = P.ry + 1.8 * k; };
    this.wardrobes[id] = W;
    P.solid(-w / 2, -0.29, w / 2, 0.31, 2.1);
    P.spot(id, 0, 0.75, room, { label: 'الخزانة' });
    const s = this.spots[id];
    this.hides.push({ id: 'hide_' + id, x: s.x, z: s.z, face: s.face, kind: 'wardrobe', room, inside: P.world(0, 0), label: 'تخبّى بالخزانة' });
    return P;
  }
  // table lamp: turned base, pleated shade
  lamp(P, lx, y, lz) { P.lathe(this.M.gold, [[0, 0], [0.06, 0], [0.065, 0.015], [0.02, 0.04], [0.03, 0.12], [0.012, 0.2], [0.012, 0.26]], lx, y, lz, 14).lathe(this.M.cream, [[0.07, 0.24], [0.13, 0.24], [0.085, 0.42], [0, 0.42]], lx, y, lz, 18); }
  books(P, lx, y, lz, n = 6, lean = 0) { const C = [0xb53a3a, 0x2f6fd0, 0x3f8f5a, 0xe2b23a, 0x5b4a8a, 0xd9d2c0, 0x8a4a2a]; let x = lx; for (let i = 0; i < n; i++) { const t = 0.022 + (i * 7 % 5) * 0.006, h = 0.17 + (i * 3 % 4) * 0.018; P.rbox(flatMat(C[(i * 3 + n) % C.length], { rough: 0.8 }), t, h, 0.13, 0.003, x + t / 2, y + h / 2, lz); x += t + 0.002; } void lean; }

  parents() {
    const M = this.M;
    this.bed(1.35, 1.35, 0, { w: 1.8, sheet: M.jacquard, id: 'bed_parents', room: 'parents' });
    const N = this.at(2.55, 0.35, 0);
    N.rbox(M.walnut, 0.46, 0.44, 0.4, 0.015, 0, 0.28, 0).rbox(M.oak, 0.4, 0.17, 0.02, 0.005, 0, 0.385, 0.2).rbox(M.oak, 0.4, 0.17, 0.02, 0.005, 0, 0.175, 0.2).sph(M.gold, 0.014, 0, 0.385, 0.22).sph(M.gold, 0.014, 0, 0.175, 0.22).solid(-0.23, -0.2, 0.23, 0.2, 0.5);
    this.legs(N, M.dark, 0.19, 0.16, 0.06, 0.02);
    this.lamp(N, -0.1, 0.5, -0.05);
    this.spots.nightstand = { id: 'nightstand', x: 2.55, z: 0.95, face: Math.PI, room: 'parents' };
    this.wardrobe(4.13, 1.5, -1, { w: 2.2, id: 'wardrobe_parents', room: 'parents' });
    // dresser with drawers and an arched mirror on the west wall
    const D = this.at(0.32, 3.6, 1);
    D.rbox(M.walnut, 1.1, 0.74, 0.45, 0.015, 0, 0.43, 0).rbox(M.walnut, 1.14, 0.03, 0.48, 0.01, 0, 0.815, 0).solid(-0.55, -0.23, 0.55, 0.23, 0.8);
    this.legs(D, M.dark, 0.5, 0.18, 0.06, 0.022);
    for (let r = 0; r < 3; r++) for (const sx of [-1, 1]) D.rbox(M.oak, 0.5, 0.2, 0.02, 0.006, sx * 0.265, 0.2 + r * 0.23, 0.228).sph(M.gold, 0.014, sx * 0.265, 0.2 + r * 0.23, 0.245);
    D.rbox(M.gold, 0.74, 0.98, 0.03, 0.06, 0, 1.52, -0.2).box(M.mirror, 0.66, 0.9, 0.012, 0, 1.52, -0.182);
    D.lathe(M.pane, [[0, 0], [0.025, 0], [0.03, 0.07], [0.012, 0.09], [0.012, 0.11]], -0.35, 0.83, 0.02, 10).lathe(flatMat(0xc45a7a, { rough: 0.3 }), [[0, 0], [0.03, 0], [0.02, 0.05], [0.01, 0.08]], -0.22, 0.83, 0.08, 10).rbox(M.dark, 0.2, 0.025, 0.05, 0.01, 0.25, 0.845, 0.05);
    this.ac('ac_parents', 'parents', 3.7, 0, true, 1);
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.1), new THREE.MeshStandardMaterial({ map: rugTexture('#7a1f24', '#1e3a5f'), roughness: 0.95 }));
    rug.rotation.x = -Math.PI / 2; rug.rotation.z = Math.PI / 2; rug.position.set(2.9, 0.006, 3.2); rug.receiveShadow = true; this.live(rug);
    this.hides.push({ id: 'hide_bed_parents', x: 2.55, z: 1.6, face: -Math.PI / 2, kind: 'bed', room: 'parents', inside: [1.6, 1.5], kidOnly: true, label: 'تخبّى تحت التخت' });
    this.frame('ما شاء الله', 1.2, 4.5 - WT / 2 - 0.01, true, -1, 1.75, '#f4ead2', '#6b4a12', 0.7, 0.5);
  }

  bathroom() {
    const M = this.M;
    // tiled walls (thin panels on the inside)
    this.box(M.whitetile, 2.5 - WT, 1.62, 0.02, 5.75, 0.81, WT / 2 + 0.01); this.box(M.whitetile, 0.82, 0.58, 0.02, 4.99, 1.91, WT / 2 + 0.01); this.box(M.whitetile, 0.82, 0.58, 0.02, 6.51, 1.91, WT / 2 + 0.01); this.box(M.whitetile, 0.02, 2.2, 4.5 - WT, 4.5 + WT / 2 + 0.01, 1.1, 2.25);
    this.box(M.whitetile, 0.02, 2.2, 4.5 - WT, 7 - WT / 2 - 0.01, 1.1, 2.25);
    // bathtub at the north end: a real hollow tub with a rolled rim, a mixer on the wall and a shower on its riser
    this.lathe(M.porcelain, [[0, 0], [0.5, 0], [0.56, 0.05], [0.6, 0.5], [0.62, 0.56], [0.58, 0.58], [0.54, 0.56], [0.5, 0.14], [0.4, 0.1], [0, 0.1]], 5.75, 0, 0.8, 28, 1.84, 1.08);
    this.cyl(M.steel, 0.03, 0.03, 0.006, 5.75, 0.104, 0.8, 12);
    this.solid(4.6, 0.1, 6.9, 1.5, 0.5);
    this.cyl(M.steel, 0.024, 0.024, 0.24, 6.86, 0.9, 0.8, 10, Math.PI / 2);
    for (const [dz, c] of [[-0.14, 0xc9221a], [0.14, 0x2f6fd0]]) { this.sph(M.steel, 0.034, 6.86, 0.9, 0.8 + dz, 0.9); this.sph(flatMat(c, { rough: 0.3 }), 0.012, 6.827, 0.9, 0.8 + dz); }
    this.tube(M.steel, [[6.86, 0.9, 0.8], [6.76, 0.87, 0.8], [6.68, 0.79, 0.8]], 0.014);
    this.tube(M.steel, [[6.87, 0.9, 0.8], [6.875, 1.5, 0.8], [6.87, 2.05, 0.78], [6.82, 2.15, 0.68], [6.68, 2.14, 0.54], [6.57, 2.1, 0.46]], 0.011, 6);
    this.lathe(M.steel, [[0, -0.008], [0.08, -0.008], [0.085, 0], [0.02, 0.05], [0, 0.05]], 6.55, 2.07, 0.45, 16);
    // corner shelf with the shampoo and the soap
    this.rbox(M.white, 0.36, 0.02, 0.16, 0.006, 4.8, 1.15, 0.19);
    this.lathe(flatMat(0x3f8f6a, { rough: 0.3 }), [[0, 0], [0.035, 0], [0.035, 0.14], [0.015, 0.17], [0.015, 0.2], [0, 0.2]], 4.72, 1.16, 0.19, 12); this.lathe(flatMat(0xd9a441, { rough: 0.3 }), [[0, 0], [0.03, 0], [0.03, 0.11], [0.012, 0.14], [0.012, 0.17], [0, 0.17]], 4.82, 1.16, 0.19, 12);
    this.rbox(flatMat(0xf2e9c8, { rough: 0.5 }), 0.08, 0.025, 0.055, 0.01, 4.91, 1.173, 0.2);
    this.rbox(flatMat(0x7f9ecf, { rough: 1 }), 0.75, 0.015, 0.5, 0.006, 5.75, 0.008, 1.95);                                     // bath mat
    // vanity: cabinet with doors, a vessel basin on top, tall tap, mirror, glass shelf with the family's toothbrushes
    const S = this.at(4.85, 3.2, 1);
    S.rbox(M.white, 0.66, 0.78, 0.45, 0.02, 0, 0.42, 0).rbox(M.marble, 0.7, 0.03, 0.48, 0.01, 0, 0.825, 0).solid(-0.3, -0.23, 0.3, 0.23, 0.85);
    for (const sx of [-1, 1]) S.rbox(flatMat(0xe9ecee, { rough: 0.4 }), 0.3, 0.62, 0.02, 0.006, sx * 0.16, 0.42, 0.228).cyl(M.steel, 0.006, 0.006, 0.14, sx * 0.04, 0.5, 0.245, 6);
    S.lathe(M.porcelain, [[0, 0.03], [0.05, 0.03], [0.17, 0.09], [0.21, 0.13], [0.2, 0.135], [0.16, 0.1], [0.05, 0.045], [0, 0.045]], 0, 0.84, 0.03, 24)
      .rbox(M.white, 0.56, 0.72, 0.03, 0.04, 0, 1.55, -0.2).box(M.mirror, 0.5, 0.66, 0.012, 0, 1.55, -0.182)
      .box(M.pane, 0.5, 0.01, 0.1, 0, 1.12, -0.16).lathe(M.pane, [[0, 0], [0.03, 0], [0.034, 0.09], [0.031, 0.09]], -0.17, 1.125, -0.16, 12).rbox(flatMat(0xf2e9c8, { rough: 0.5 }), 0.08, 0.025, 0.05, 0.01, 0.15, 1.14, -0.16).spot('sink', 0, 0.6, 'bath', { label: 'المغسلة' });
    for (const [dx, c] of [[-0.01, 0xd33a2c], [0.008, 0x2f6fd0], [0.0, 0x3f8f5a]]) S.cyl(flatMat(c), 0.004, 0.004, 0.15, -0.17 + dx, 1.2, -0.16 + dx, 5);
    this.tube(M.steel, [[4.7, 0.84, 3.2], [4.7, 1.02, 3.2], [4.74, 1.05, 3.2], [4.79, 1.0, 3.2]], 0.011); this.sph(M.steel, 0.016, 4.7, 0.9, 3.27);
    // toilet: pedestal bowl with the lid down, cistern and its button; brush and paper within reach
    const T = this.at(6.62, 3.7, -1);
    T.lathe(M.porcelain, [[0.08, 0], [0.14, 0], [0.15, 0.04], [0.11, 0.16], [0.17, 0.33], [0.19, 0.39], [0.15, 0.39], [0.13, 0.36]], 0, 0, 0.07, 20, 1, 1.25)
      .lathe(M.white, [[0.19, 0.392], [0.2, 0.4], [0.195, 0.42], [0.15, 0.435], [0, 0.44]], 0, 0, 0.07, 20, 1, 1.25)
      .rbox(M.porcelain, 0.42, 0.38, 0.17, 0.04, 0, 0.59, -0.2).rbox(M.porcelain, 0.44, 0.03, 0.19, 0.012, 0, 0.795, -0.2).cyl(M.steel, 0.022, 0.022, 0.012, 0, 0.815, -0.2, 12)
      .rbox(M.porcelain, 0.2, 0.3, 0.14, 0.04, 0, 0.3, -0.14)
      .solid(-0.2, -0.3, 0.2, 0.3, 0.6);
    this.lathe(M.white, [[0, 0], [0.05, 0], [0.04, 0.1], [0.012, 0.11], [0.012, 0.4], [0, 0.4]], 6.75, 0, 4.2, 10);
    this.cyl(M.white, 0.055, 0.055, 0.1, 6.8, 0.75, 3.22, 14, Math.PI / 2); this.cyl(M.steel, 0.006, 0.006, 0.1, 6.85, 0.75, 3.22, 6, 0, Math.PI / 2);
    this.at(6.62, 2.4, -1).solid(-0.3, -0.3, 0.3, 0.3, 0.85).spot('washer', 0, 0.65, 'bath', { label: 'الغسّالة' });
    // water heater on the wall
    const tank = new THREE.CapsuleGeometry(0.22, 0.42, 6, 18); tank.translate(4.85, 2.3, 1.9); this.push(M.white, tank);
    this.cyl(M.steel, 0.012, 0.012, 0.5, 4.78, 1.75, 1.9, 6); this.cyl(M.steel, 0.012, 0.012, 0.5, 4.92, 1.75, 1.9, 6); this.sph(flatMat(0xd33a2c), 0.012, 4.85, 2.1, 2.12);
    this.spots.shower = { id: 'shower', x: 5.75, z: 1.9, face: Math.PI, room: 'bath', label: 'الدوش' };
    // the heater switch sits in the hall, by the bathroom door
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.012), new THREE.MeshStandardMaterial({ color: 0x331111, emissive: 0xff3322, emissiveIntensity: 0 }));
    led.position.set(6.62, 1.42, 4.5 + WT / 2 + 0.012); this.live(led);
    this.rbox(M.white, 0.1, 0.14, 0.02, 0.006, 6.62, 1.38, 4.5 + WT / 2 + 0.008);
    const heater = { id: 'heater', type: 'heater', room: 'hall', on: false, x: 6.62, z: 4.95, face: Math.PI, label: 'السخّان' };
    heater.set = (on) => { heater.on = on; led.material.emissiveIntensity = on ? 4 : 0; };
    this.devices.heater = heater;
  }

  // open shelves with books and whatever lives on a kid's shelf
  shelf(ox, oz, turns, wood, toy) {
    const P = this.at(ox, oz, turns);
    P.rbox(wood, 0.04, 1.3, 0.28, 0.008, -0.27, 0.65, 0).rbox(wood, 0.04, 1.3, 0.28, 0.008, 0.27, 0.65, 0).box(wood, 0.5, 1.3, 0.015, 0, 0.65, -0.132).solid(-0.29, -0.15, 0.29, 0.15, 1.3);
    for (const y of [0.04, 0.45, 0.86, 1.28]) P.rbox(wood, 0.54, 0.03, 0.28, 0.006, 0, y, 0);
    this.books(P, -0.24, 0.47, -0.02, 7); this.books(P, -0.24, 0.06, -0.02, 5); P.rbox(this.M.cream, 0.2, 0.12, 0.16, 0.02, 0.13, 0.12, 0);
    if (toy === 'bear') { const b = flatMat(0xb98a5a, { rough: 1 }); P.sph(b, 0.085, 0.08, 0.96, 0, 1.05).sph(b, 0.062, 0.08, 1.09, 0).sph(b, 0.024, 0.03, 1.14, 0).sph(b, 0.024, 0.13, 1.14, 0).sph(flatMat(0xe9d6b8), 0.026, 0.08, 1.08, 0.05).sph(b, 0.035, 0.0, 0.93, 0.04).sph(b, 0.035, 0.16, 0.93, 0.04); this.books(P, -0.24, 0.875, -0.02, 3); } else { P.lathe(this.M.gold, [[0, 0], [0.04, 0], [0.045, 0.012], [0.012, 0.03], [0.012, 0.09], [0.05, 0.13], [0.055, 0.2], [0.04, 0.2], [0.035, 0.14], [0, 0.13]], -0.12, 0.875, 0, 12); this.books(P, 0.0, 0.875, -0.02, 4); }
    return P;
  }

  sisRoom() {
    const M = this.M;
    this.bed(7.68, 1.4, 0, { sheet: M.sheetPink, id: 'bed_sis', room: 'sis' });
    this.desk(10.12, 1.5, -1, 'desk_sis', 'sis', M.oak);
    this.wardrobe(10.13, 3.55, -1, { w: 1.2, id: 'wardrobe_sis', room: 'sis', mat: M.oak });
    const rug = new THREE.Mesh(new THREE.CircleGeometry(0.8, 28), new THREE.MeshStandardMaterial({ color: 0xe9a9c4, roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(8.9, 0.006, 2.6); rug.receiveShadow = true; this.live(rug);
    this.shelf(7.24, 3.85, 1, M.oak, 'bear');
    this.hides.push({ id: 'hide_bed_sis', x: 8.5, z: 1.6, face: -Math.PI / 2, kind: 'bed', room: 'sis', inside: [7.7, 1.5], kidOnly: true, label: 'تخبّى تحت التخت' });
  }

  chair(cx, cz, turns, { wood, seat, slats = true }) {
    const c = this.at(cx, cz, turns);
    c.rbox(seat || wood, 0.42, 0.05, 0.42, 0.02, 0, 0.455, 0);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c.cyl(wood, 0.02, 0.014, sz < 0 ? 0.95 : 0.44, sx * 0.18, sz < 0 ? 0.475 : 0.22, sz * 0.18, 8);
    c.rbox(wood, 0.4, 0.07, 0.03, 0.012, 0, 0.92, -0.18);
    if (slats) for (const sx of [-0.1, 0, 0.1]) c.rbox(wood, 0.035, 0.4, 0.018, 0.006, sx, 0.7, -0.18); else c.rbox(seat || wood, 0.36, 0.34, 0.03, 0.02, 0, 0.72, -0.175);
    return c;
  }
  desk(ox, oz, turns, id, room, wood, lamp = true) {
    const M = this.M, P = this.at(ox, oz, turns);
    P.rbox(wood, 1.32, 0.04, 0.62, 0.012, 0, 0.74, 0).rbox(wood, 0.04, 0.72, 0.56, 0.008, -0.62, 0.36, 0).rbox(wood, 0.42, 0.7, 0.54, 0.008, 0.42, 0.36, 0).box(wood, 0.8, 0.3, 0.02, -0.2, 0.55, -0.26);
    for (let r = 0; r < 3; r++) P.rbox(M.oak, 0.38, 0.2, 0.02, 0.006, 0.42, 0.14 + r * 0.225, 0.275).cyl(M.steel, 0.006, 0.006, 0.12, 0.42, 0.14 + r * 0.225, 0.292, 6, 0, Math.PI / 2);
    P.solid(-0.65, -0.3, 0.65, 0.3, 0.76);
    // pen pot; an angle-poise lamp and a few books unless something else lives on the desk
    P.lathe(M.plasticRed, [[0, 0], [0.035, 0], [0.04, 0.09], [0.036, 0.09], [0.032, 0.008], [0, 0.008]], 0.5, 0.76, -0.2, 10);
    for (const [dx, c] of [[-0.012, 0xf0c23a], [0.01, 0x2f6fd0], [0, 0x2a2a2a]]) P.cyl(flatMat(c), 0.004, 0.004, 0.13, 0.5 + dx, 0.84, -0.2 + dx, 5);
    if (lamp) {
      P.lathe(M.dark, [[0, 0], [0.07, 0], [0.075, 0.012], [0.012, 0.025], [0, 0.03]], -0.5, 0.76, -0.18, 12).tube(M.dark, [[-0.5, 0.78, -0.18], [-0.52, 1.0, -0.2], [-0.47, 1.1, -0.17], [-0.4, 1.085, -0.12]], 0.008)
        .lathe(M.dark, [[0.012, 0.29], [0.08, 0.235], [0.085, 0.24], [0.02, 0.3], [0, 0.3]], -0.38, 0.78, -0.1, 12).sph(flatMat(0xfff3c4, { emissive: 0xffe2a0, emissiveIntensity: 0.6 }), 0.028, -0.38, 1.035, -0.1);
      this.books(P, 0.28, 0.76, -0.2, 4);
    }
    this.chair(...P.world(0, 0.62), turns + 2, { wood: M.dark, seat: flatMat(0x2c3340, { rough: 0.9 }), slats: false });
    const [sx, sz] = P.world(0, 0.62);
    this.spots[id] = { id, x: sx, z: sz, face: P.ry + Math.PI, room, label: 'المكتب', sit: true };
    this.seats[id] = { x: sx, z: sz, heading: P.ry + Math.PI, y: 0 };
    return P;
  }

  boysRoom() {
    const M = this.M;
    this.bed(11.2, 1.4, 0, { sheet: M.sheetBlue, id: 'bed_big', room: 'boys' });
    this.bed(15.3, 1.4, 0, { sheet: M.plaid, id: 'bed_kid', room: 'boys' });
    const P = this.desk(13.35, 0.42, 0, 'desk_boys', 'boys', M.walnut, false);
    // the PlayStation and its little TV
    P.rbox(M.black, 0.76, 0.46, 0.035, 0.012, 0.05, 1.02, -0.2).lathe(M.black, [[0, 0], [0.11, 0], [0.1, 0.012], [0.02, 0.02], [0.02, 0.06]], 0.05, 0.76, -0.2, 14, 1, 0.6)
      .rbox(M.white, 0.26, 0.055, 0.22, 0.02, -0.42, 0.79, -0.12).box(M.black, 0.262, 0.012, 0.222, -0.42, 0.79, -0.12).box(flatMat(0x2e7dff, { emissive: 0x2e7dff, emissiveIntensity: 1 }), 0.03, 0.004, 0.004, -0.42, 0.8, -0.008);
    const screenMat = new THREE.MeshStandardMaterial({ color: 0x050608, emissive: 0x2e7dff, emissiveIntensity: 0, roughness: 0.2 });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.4), screenMat);
    screen.position.set(13.4, 1.02, 0.245); this.live(screen);
    const glow = new THREE.PointLight(0x4a8cff, 0, 3.5, 1.8); glow.position.set(13.4, 1.1, 0.8); this.group.add(glow); this.points.push(glow);
    const con = { id: 'console', type: 'console', room: 'boys', on: false, x: 13.35, z: 1.04, face: Math.PI, label: 'البلايستيشن', screenMat, glow };
    con.set = (on) => { con.on = on; screenMat.emissiveIntensity = on ? 1.6 : 0; glow.intensity = on ? 3 : 0; };
    this.devices.console = con;
    this.wardrobe(14.5, 4.13, 2, { w: 1.7, id: 'wardrobe_boys', room: 'boys' });
    this.ac('ac_boys', 'boys', 15.1, 0, true, 1);
    // football, trophy shelf, poster
    this.sph(M.white, 0.11, 10.85, 0.11, 2.75);
    for (const [a, e] of [[0, 1.57], [0, 0.46], [1.26, 0.46], [2.51, 0.46], [3.77, 0.46], [5.03, 0.46], [0.63, -0.46], [1.88, -0.46], [3.14, -0.46], [4.4, -0.46], [5.65, -0.46]]) this.sph(M.dark, 0.05, 10.85 + Math.cos(a) * Math.cos(e) * 0.065, 0.11 + Math.sin(e) * 0.065, 2.75 + Math.sin(a) * Math.cos(e) * 0.065);
    this.shelf(10.75, 3.3, 1, M.walnut, 'cup');
    this.frame('⚽', 16 - WT / 2 - 0.01, 3.7, false, -1, 1.6, '#12355b', '#ffffff', 0.6, 0.8, 'bold 220px "Segoe UI Emoji","Segoe UI"');
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.3), new THREE.MeshStandardMaterial({ map: rugTexture('#1f3d63', '#8a2b2b'), roughness: 0.95 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(13.3, 0.006, 2.7); rug.receiveShadow = true; this.live(rug);
    this.hides.push({ id: 'hide_bed_big', x: 12.0, z: 1.6, face: Math.PI / 2, kind: 'bed', room: 'boys', inside: [11.2, 1.5], kidOnly: true, label: 'تخبّى تحت التخت' });
    this.hides.push({ id: 'hide_blanket', x: 14.55, z: 1.5, face: -Math.PI / 2, kind: 'blanket', room: 'boys', inside: [15.3, 1.5], label: 'اعمل حالك نايم' });
  }

  frame(text, x, z, alongX, side, y, bg, fg, w = 0.7, h = 0.5, font) {
    const mat = new THREE.MeshStandardMaterial({ map: frameTexture(text, bg, fg, font), roughness: 0.6 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(alongX ? x : x + side * 0.021, y, alongX ? z + side * 0.021 : z);
    m.rotation.y = alongX ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
    this.live(m);
    if (alongX) this.rbox(this.M.gold, w + 0.07, h + 0.07, 0.03, 0.012, x, y, z + side * 0.004);
    else this.rbox(this.M.gold, 0.03, h + 0.07, w + 0.07, 0.012, x + side * 0.004, y, z);
  }

  // a pair of shoes
  shoes(P, lx, y, lz, mat) { for (const dx of [-0.055, 0.055]) { P.rbox(mat, 0.085, 0.05, 0.24, 0.022, lx + dx, y + 0.025, lz).rbox(mat, 0.08, 0.07, 0.1, 0.03, lx + dx, y + 0.06, lz - 0.065).rbox(this.M.white, 0.088, 0.014, 0.245, 0.006, lx + dx, y + 0.007, lz); } }

  hallway() {
    const M = this.M;
    // shoe rack by the front door, coat hooks above it
    const R = this.at(15.3, 4.78, 0);
    R.rbox(M.oak, 0.03, 0.62, 0.3, 0.006, -0.5, 0.31, 0).rbox(M.oak, 0.03, 0.62, 0.3, 0.006, 0.5, 0.31, 0).solid(-0.5, -0.15, 0.5, 0.15, 0.5);
    for (const y of [0.06, 0.32, 0.6]) R.rbox(M.oak, 1.03, 0.025, 0.3, 0.006, 0, y, 0);
    this.shoes(R, -0.3, 0.075, 0.0, M.dark); this.shoes(R, 0.02, 0.075, 0.0, flatMat(0x7a4a2a, { rough: 0.6 })); this.shoes(R, 0.33, 0.075, 0, M.plasticBlue);
    this.shoes(R, -0.2, 0.335, 0.0, M.white); this.shoes(R, 0.22, 0.335, 0, flatMat(0xc24b7a, { rough: 0.7 }));
    R.rbox(M.walnut, 0.9, 0.08, 0.02, 0.01, 0, 1.6, -0.14);
    for (const dx of [-0.3, 0, 0.3]) R.tube(M.gold, [[dx, 1.6, -0.13], [dx, 1.58, -0.07], [dx, 1.62, -0.05]], 0.008);
    for (const [kind, color, dx, sc] of [['shirt', 0x3a3f4a, -0.3, 1.25], ['scarf', 0x8a2b2b, 0.3, 1.1], ['thobe', 0xe9e4d6, 0, 1.0]]) { const c = garment(kind, color); c.scale.setScalar(sc); c.position.set(15.3 + dx, 1.585, 4.69 + (dx ? 0 : 0.012)); c.rotation.x = 0.04; c.receiveShadow = true; this.live(c); }
    this.spots.shoes = { id: 'shoes', x: 15.3, z: 5.4, face: Math.PI, room: 'hall', label: 'الجزّامة' };
    // console table with the vase everybody knocks over
    const C = this.at(5.9, 6.5 - WT / 2 - 0.17, 2);
    C.rbox(M.walnut, 1.12, 0.035, 0.32, 0.012, 0, 0.8, 0).rbox(M.walnut, 1.0, 0.12, 0.26, 0.008, 0, 0.72, 0).sph(M.gold, 0.014, 0, 0.72, 0.135).solid(-0.55, -0.15, 0.55, 0.15, 0.82);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) C.cyl(M.walnut, 0.024, 0.014, 0.68, sx * 0.5, 0.34, sz * 0.11, 8);
    C.lathe(M.gold, [[0, 0], [0.06, 0], [0.065, 0.008], [0.065, 0.02], [0, 0.02]], -0.38, 0.818, 0, 14).rbox(M.dark, 0.05, 0.11, 0.012, 0.004, -0.38, 0.9, 0);       // phone on its charger
    this.fragile.push({ id: 'vase_hall', x: 5.9, z: 6.2, y: 0.82, room: 'hall' });
    this.spots.halltable = { id: 'halltable', x: 5.5, z: 5.75, face: 0, room: 'hall', label: 'طاولة الممر' };
    this.frame('هذا من\nفضل ربي', 4.35, 4.5 + WT / 2 + 0.01, true, 1, 1.75, '#0f2f25', '#e7c66a', 0.8, 0.6, 'bold 100px "Amiri","Traditional Arabic","Segoe UI",serif');
    this.frame('البيت\nالسعيد', 10.4, 6.5 - WT / 2 - 0.01, true, -1, 1.75, '#f1e6cf', '#7a2b20', 0.6, 0.45, 'bold 96px "Amiri","Traditional Arabic","Segoe UI",serif');
    // fuse box with its row of breakers
    this.rbox(M.cream, 0.4, 0.5, 0.07, 0.015, 10.1, 1.75, 4.5 + WT / 2 + 0.035); this.rbox(flatMat(0x8a8f96, { rough: 0.5 }), 0.32, 0.2, 0.01, 0.004, 10.1, 1.8, 4.5 + WT / 2 + 0.072);
    for (let i = 0; i < 6; i++) this.box(i === 0 ? M.plasticRed : M.dark, 0.022, 0.06, 0.02, 9.98 + i * 0.048, 1.8, 4.5 + WT / 2 + 0.082);
    this.spots.fusebox = { id: 'fusebox', x: 10.1, z: 5.0, face: Math.PI, room: 'hall', label: 'طبلون الكهربا' };
    // wall clock with a proper face
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.165, 30), new THREE.MeshStandardMaterial({ roughness: 0.5, map: textTexture((g, w, h) => {
      g.fillStyle = '#fbf8ee'; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, 7); g.fill(); g.fillStyle = '#1a1a1a'; g.font = 'bold 54px "Segoe UI",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      ['١٢', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '١٠', '١١'].forEach((n, i) => g.fillText(n, w / 2 + Math.sin(i / 12 * 6.283) * w * 0.38, h / 2 - Math.cos(i / 12 * 6.283) * h * 0.38));
      g.strokeStyle = '#1a1a1a'; g.lineCap = 'round'; g.lineWidth = 12; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + 70, h / 2 - 60); g.stroke(); g.lineWidth = 7; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 - 30, h / 2 - 150); g.stroke();
      g.fillStyle = '#b3161a'; g.beginPath(); g.arc(w / 2, h / 2, 12, 0, 7); g.fill();
    }) }));
    face.position.set(12.9, 2.1, 6.5 - WT / 2 - 0.039); face.rotation.y = Math.PI; this.live(face);
    this.cyl(M.walnut, 0.19, 0.19, 0.035, 12.9, 2.1, 6.5 - WT / 2 - 0.018, 28, Math.PI / 2);
    const runner = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 7), new THREE.MeshStandardMaterial({ map: rugTexture('#6d1d22', '#2a2f55', 256, 1024), roughness: 0.95 }));
    runner.rotation.x = -Math.PI / 2; runner.rotation.z = Math.PI / 2; runner.position.set(8.5, 0.006, 5.5); runner.receiveShadow = true; this.live(runner);
    this.spots.maindoor = { id: 'maindoor', x: 15.4, z: 5.5, face: Math.PI / 2, room: 'hall', label: 'باب الدار' };
  }

  sofa(ox, oz, turns, { seats = 3, mat, id, trim, pillow }) {
    const P = this.at(ox, oz, turns), w = seats * 0.72 + 0.36, M = this.M;
    this.legs(P, trim || M.dark, w / 2 - 0.08, 0.36, 0.09, 0.03);
    P.rbox(mat, w, 0.2, 0.9, 0.05, 0, 0.19, 0)                                    // base
      .rbox(mat, w - 0.06, 0.62, 0.2, 0.08, 0, 0.6, -0.35)                         // back
      .rbox(mat, 0.2, 0.46, 0.92, 0.09, -w / 2 + 0.1, 0.42, 0).rbox(mat, 0.2, 0.46, 0.92, 0.09, w / 2 - 0.1, 0.42, 0);   // rolled arms
    if (trim) P.rbox(trim, w + 0.01, 0.035, 0.92, 0.012, 0, 0.1, 0).rbox(trim, w - 0.04, 0.035, 0.05, 0.012, 0, 0.92, -0.35).cyl(trim, 0.05, 0.05, 0.03, -w / 2 + 0.1, 0.43, 0.465, 14, Math.PI / 2).cyl(trim, 0.05, 0.05, 0.03, w / 2 - 0.1, 0.43, 0.465, 14, Math.PI / 2);
    for (let i = 0; i < seats; i++) {
      const lx = -((seats - 1) / 2) * 0.72 + i * 0.72;
      P.rbox(mat, 0.7, 0.17, 0.64, 0.07, lx, 0.385, 0.09).rbox(mat, 0.68, 0.44, 0.17, 0.08, lx, 0.67, -0.2);
      const [x, z] = P.world(lx, 0.14);
      this.seats[`${id}_${i}`] = { x, z, heading: P.ry, y: 0.0 };
    }
    if (pillow && seats > 1) for (const sx of [-1, 1]) P.rbox(pillow, 0.34, 0.34, 0.13, 0.06, sx * (w / 2 - 0.36), 0.63, -0.02);
    P.solid(-w / 2, -0.45, w / 2, 0.45, 0.88);
    return P;
  }
  // low table: rounded top, shelf, turned legs
  lowTable(P, wood, w, d, h, inlay) {
    P.rbox(wood, w, 0.045, d, 0.02, 0, h - 0.022, 0).rbox(wood, w - 0.14, 0.03, d - 0.14, 0.012, 0, 0.14, 0);
    if (inlay) P.rbox(inlay, w - 0.12, 0.008, d - 0.12, 0.003, 0, h + 0.002, 0);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.cyl(wood, 0.03, 0.02, h - 0.04, sx * (w / 2 - 0.07), (h - 0.04) / 2, sz * (d / 2 - 0.07), 10);
  }

  salon() {
    const M = this.M, cream = flatMat(0xe9dcc0, { rough: 0.9 });
    this.sofa(0.62, 8.35, 1, { seats: 3, mat: M.leather, id: 'salonW', trim: M.gold, pillow: M.jacquardGold });
    this.sofa(2.5, 11.38, 2, { seats: 3, mat: M.leather, id: 'salonS', trim: M.gold, pillow: M.jacquardGold });
    this.sofa(4.4, 7.55, -1, { seats: 1, mat: M.leather, id: 'salonE1', trim: M.gold });
    this.sofa(4.4, 8.75, -1, { seats: 1, mat: M.leather, id: 'salonE2', trim: M.gold });
    // coffee table with the gold tissue box and the sweets dish
    const T = this.at(2.5, 9.3, 0);
    this.lowTable(T, M.walnut, 1.25, 0.7, 0.445, M.gold);
    T.rbox(M.gold, 0.26, 0.09, 0.14, 0.02, -0.35, 0.495, 0).rbox(M.white, 0.1, 0.05, 0.02, 0.008, -0.35, 0.555, 0)
      .lathe(M.pane, [[0, 0], [0.05, 0], [0.11, 0.04], [0.115, 0.045], [0.05, 0.008], [0, 0.008]], 0.38, 0.45, 0.12, 16).solid(-0.63, -0.35, 0.63, 0.35, 0.45);
    for (let i = 0; i < 6; i++) T.sph(flatMat([0xc9221a, 0xe2b23a, 0x3f8f5a][i % 3], { rough: 0.3 }), 0.016, 0.38 + Math.cos(i) * 0.05, 0.475, 0.12 + Math.sin(i) * 0.05);
    this.spots.salontable = { id: 'salontable', x: 2.5, z: 10.05, face: Math.PI, room: 'salon', label: 'طاولة الصالون' };
    // display cabinet: glass doors over cupboards, the good cups inside
    const B = this.at(1.0, 6.5 + WT / 2 + 0.22, 0);
    B.rbox(M.walnut, 1.7, 0.8, 0.42, 0.012, 0, 0.4, 0).rbox(M.walnut, 1.74, 0.035, 0.46, 0.012, 0, 0.815, 0).box(M.walnut, 1.7, 1.15, 0.03, 0, 1.42, -0.195).rbox(M.walnut, 0.04, 1.15, 0.4, 0.008, -0.83, 1.42, 0).rbox(M.walnut, 0.04, 1.15, 0.4, 0.008, 0.83, 1.42, 0)
      .rbox(M.walnut, 1.78, 0.07, 0.46, 0.02, 0, 2.03, 0).rbox(M.gold, 1.6, 0.025, 0.02, 0.006, 0, 2.03, 0.235)
      .box(M.pane, 1.6, 0.01, 0.34, 0, 1.2, 0).box(M.pane, 1.6, 0.01, 0.34, 0, 1.6, 0).box(M.pane, 0.8, 1.1, 0.008, -0.41, 1.42, 0.2).box(M.pane, 0.8, 1.1, 0.008, 0.41, 1.42, 0.2).box(M.walnut, 0.03, 1.15, 0.03, 0, 1.42, 0.2)
      .solid(-0.85, -0.21, 0.85, 0.22, 2.0).spot('cups', 0, 0.7, 'salon', { label: 'فناجين الضيوف' });
    for (const sx of [-1, 1]) B.rbox(M.oak, 0.8, 0.68, 0.02, 0.008, sx * 0.42, 0.4, 0.213).sph(M.gold, 0.016, sx * 0.08, 0.45, 0.232);
    for (let i = 0; i < 6; i++) B.lathe(M.porcelain, [[0, 0], [0.014, 0], [0.023, 0.036], [0.0215, 0.036], [0.012, 0.003], [0, 0.003]], -0.62 + i * 0.25, 0.835 + (i % 2 ? 0.37 : 0), 0.05, 10);
    for (let i = 0; i < 3; i++) B.lathe(M.porcelain, [[0, 0], [0.05, 0], [0.1, 0.016], [0.103, 0.018], [0.05, 0.006], [0, 0.006]], -0.5 + i * 0.5, 1.607, 0.0, 16).lathe(M.gold, [[0, 0], [0.04, 0], [0.045, 0.01], [0.028, 0.06], [0.024, 0.085], [0.038, 0.12], [0.03, 0.115], [0, 0.1]], -0.7 + i * 0.55, 1.205, -0.05, 12);
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.6), new THREE.MeshStandardMaterial({ map: rugTexture('#7b1e22', '#172f4f'), roughness: 0.95 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(2.5, 0.006, 9.3); rug.receiveShadow = true; this.live(rug);
    this.ac('ac_salon', 'salon', 5, 8.2, false, -1);
    this.fragile.push({ id: 'vase_salon', x: 4.55, z: 11.5, y: 0, room: 'salon', big: true });
    this.frame('أهلاً\nوسهلاً', 0 + WT / 2 + 0.01, 7.4, false, 1, 1.8, '#1b1b1b', '#d9b65c', 0.7, 0.55, 'bold 110px "Amiri","Traditional Arabic","Segoe UI",serif');
    this.hides.push({ id: 'hide_curtain_salon', x: 2.5, z: 11.0, face: 0, kind: 'curtain', room: 'salon', inside: [2.5, 11.75], label: 'تخبّى ورا البرداية' });
    void cream;
  }

  living() {
    const M = this.M;
    // TV wall (west), dad's sofa facing it (east), family sofa (south)
    const U = this.at(5 + WT / 2 + 0.24, 8.2, 1);
    this.legs(U, M.dark, 0.88, 0.17, 0.1, 0.022);
    U.rbox(M.walnut, 1.9, 0.38, 0.45, 0.02, 0, 0.31, 0).solid(-0.95, -0.23, 0.95, 0.23, 0.5);
    for (const sx of [-1, 0, 1]) U.rbox(M.oak, 0.6, 0.3, 0.02, 0.008, sx * 0.62, 0.31, 0.228).cyl(M.steel, 0.006, 0.006, 0.16, sx * 0.62, 0.4, 0.245, 6, 0, Math.PI / 2);
    U.rbox(M.black, 1.46, 0.83, 0.04, 0.012, 0, 1.2, -0.1).lathe(M.black, [[0, 0], [0.2, 0], [0.19, 0.012], [0.03, 0.025], [0.03, 0.32]], 0, 0.5, -0.1, 16, 1, 0.5)
      .rbox(M.dark, 0.3, 0.045, 0.2, 0.01, -0.65, 0.525, 0.02).box(flatMat(0x35ff5a, { emissive: 0x35ff5a, emissiveIntensity: 1.5 }), 0.012, 0.006, 0.004, -0.55, 0.525, 0.122)       // receiver
      .rbox(M.white, 0.16, 0.03, 0.11, 0.008, 0.7, 0.515, 0.0).cyl(M.white, 0.004, 0.004, 0.14, 0.64, 0.6, -0.04, 5).cyl(M.white, 0.004, 0.004, 0.14, 0.76, 0.6, -0.04, 5);          // router
    const tvCanvas = document.createElement('canvas'); tvCanvas.width = 512; tvCanvas.height = 288;
    const tvTex = new THREE.CanvasTexture(tvCanvas); tvTex.colorSpace = THREE.SRGBColorSpace;
    const tvMat = new THREE.MeshStandardMaterial({ color: 0x050505, emissive: 0xffffff, emissiveMap: tvTex, emissiveIntensity: 0, roughness: 0.25 });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.38, 0.76), tvMat);
    screen.position.set(5 + WT / 2 + 0.165, 1.2, 8.2); screen.rotation.y = Math.PI / 2; this.live(screen);
    const glow = new THREE.PointLight(0x9db8ff, 0, 5, 1.6); glow.position.set(6.4, 2.25, 8.2); this.group.add(glow); this.points.push(glow);
    const tv = { id: 'tv', type: 'tv', room: 'living', on: false, x: 6.0, z: 8.2, face: -Math.PI / 2, label: 'التلفزيون', canvas: tvCanvas, tex: tvTex, glow, mat: tvMat, channel: 'news' };
    tv.set = (on) => { tv.on = on; tvMat.emissiveIntensity = on ? 1.3 : 0; glow.intensity = on ? 5 : 0; };
    this.devices.tv = tv;
    this.sofa(10.38, 8.2, -1, { seats: 3, mat: M.jacquard, id: 'livingE', pillow: M.jacquardGold });
    this.sofa(8.0, 11.38, 2, { seats: 3, mat: M.jacquard, id: 'livingS', pillow: M.jacquardGold });
    const T = this.at(8.0, 9.75, 0);
    this.lowTable(T, M.oak, 1.1, 0.6, 0.425);
    T.rbox(M.gold, 0.24, 0.085, 0.13, 0.02, 0.32, 0.47, -0.1).rbox(M.white, 0.09, 0.05, 0.02, 0.008, 0.32, 0.53, -0.1).lathe(M.pane, [[0, 0], [0.07, 0], [0.09, 0.03], [0.07, 0.006], [0, 0.006]], -0.3, 0.428, 0.1, 14).solid(-0.55, -0.3, 0.55, 0.3, 0.43);
    this.spots.coffeetable = { id: 'coffeetable', x: 8.0, z: 10.45, face: Math.PI, room: 'living', label: 'طاولة القعدة' };
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.4), new THREE.MeshStandardMaterial({ map: rugTexture('#274064', '#8c2f2a'), roughness: 0.95 }));
    rug.rotation.x = -Math.PI / 2; rug.rotation.z = Math.PI / 2; rug.position.set(8.0, 0.006, 9.6); rug.receiveShadow = true; this.live(rug);
    this.ac('ac_living', 'living', 9.6, 12, true, -1);
    // the kerosene heater every Jordanian living room has: drum, wire guard, carry handle
    this.lathe(M.cream, [[0, 0.03], [0.2, 0.03], [0.22, 0.06], [0.2, 0.44], [0.17, 0.5], [0.17, 0.56], [0.2, 0.58], [0, 0.58]], 5.6, 0, 11.4, 22); this.cyl(M.dark, 0.235, 0.235, 0.03, 5.6, 0.018, 11.4, 22); this.cyl(M.steel, 0.12, 0.12, 0.02, 5.6, 0.59, 11.4, 18);
    for (const y of [0.2, 0.3, 0.4]) { const t = new THREE.TorusGeometry(0.215, 0.004, 5, 24); t.rotateX(Math.PI / 2); t.translate(5.6, y, 11.4); this.push(M.steel, t); }
    this.tube(M.steel, [[5.42, 0.58, 11.4], [5.44, 0.72, 11.4], [5.6, 0.78, 11.4], [5.76, 0.72, 11.4], [5.78, 0.58, 11.4]], 0.006);
    this.solid(5.38, 11.18, 5.82, 11.62, 0.6);
    this.frame('الله', 5.95, 12 - WT / 2 - 0.01, true, -1, 1.85, '#111111', '#e3c36a', 0.5, 0.36, 'bold 190px "Amiri","Traditional Arabic","Segoe UI",serif');
    this.seats.dadTv = this.seats.livingE_1;
    this.tvLine = { x0: 5.7, x1: 9.85, z0: 7.75, z1: 8.65 };
    this.spots.dadside = { id: 'dadside', x: 9.55, z: 9.15, face: Math.PI * 0.75, room: 'living', label: '' };
    this.hides.push({ id: 'hide_sofa_living', x: 6.9, z: 10.7, face: 0, kind: 'crouch', room: 'living', inside: [6.25, 11.35], label: 'تخبّى ورا الكنباية' });
  }

  // a run of base units: carcass, plinth, doors with bar handles, a drawer line, stone top with a soft edge
  baseUnits(x0, x1, z0, z1, alongX, front) {
    const M = this.M, len = alongX ? x1 - x0 : z1 - z0, n = Math.max(1, Math.round(len / 0.45)), dw = len / n, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    this.box(M.oak, x1 - x0 - (alongX ? 0 : 0.02), 0.78, z1 - z0 - (alongX ? 0.02 : 0), cx + (alongX ? 0 : -front * 0.01), 0.49, cz + (alongX ? -front * 0.01 : 0));
    this.box(M.dark, (x1 - x0) - (alongX ? 0 : 0.08), 0.1, (z1 - z0) - (alongX ? 0.08 : 0), cx - (alongX ? 0 : front * 0.04), 0.05, cz - (alongX ? front * 0.04 : 0));
    this.rbox(M.marble, (x1 - x0) + (alongX ? 0.02 : 0.05), 0.04, (z1 - z0) + (alongX ? 0.05 : 0.02), 0.015, cx + (alongX ? 0 : front * 0.015), 0.88, cz + (alongX ? front * 0.015 : 0));
    const f = alongX ? (front > 0 ? z1 : z0) : (front > 0 ? x1 : x0);
    for (let i = 0; i < n; i++) {
      const u = (alongX ? x0 : z0) + (i + 0.5) * dw, face = f + front * 0.012, hx = f + front * 0.035;
      const put = (h, y, hw) => { if (alongX) { this.rbox(M.oakDoor, dw - 0.016, h, 0.02, 0.006, u, y, face); this.cyl(M.steel, 0.006, 0.006, hw, u, y + h / 2 - 0.045, hx, 6, 0, Math.PI / 2); } else { this.rbox(M.oakDoor, 0.02, h, dw - 0.016, 0.006, face, y, u); this.cyl(M.steel, 0.006, 0.006, hw, hx, y + h / 2 - 0.045, u, 6, Math.PI / 2); } };
      put(0.14, 0.78, dw * 0.5); put(0.58, 0.4, dw * 0.5);
    }
  }
  wallUnits(cx, cy, cz, w, d, alongX, front, skip = -1) {
    const M = this.M, len = alongX ? w : d, n = Math.max(1, Math.round(len / 0.45)), dw = len / n;
    if (skip === 0 && alongX) {        // the first bay is left hollow: a top, a bottom, a back and an end panel round an open front
      this.rbox(M.oak, w - dw, 0.6, d, 0.008, cx + dw / 2, cy, cz);
      const bx = cx - w / 2 + dw / 2;
      this.box(M.oak, dw, 0.02, d, bx, cy + 0.29, cz); this.box(M.oak, dw, 0.02, d, bx, cy - 0.29, cz);
      this.box(M.oak, dw, 0.6, 0.02, bx, cy, cz - front * (d / 2 - 0.01)); this.box(M.oak, 0.02, 0.6, d, cx - w / 2 + 0.01, cy, cz);
    } else this.rbox(M.oak, w, 0.6, d, 0.008, cx, cy, cz);
    for (let i = 0; i < n; i++) {
      const u = (alongX ? cx - w / 2 : cz - d / 2) + (i + 0.5) * dw;
      if (i === skip) continue;
      if (alongX) { this.rbox(M.oakDoor, dw - 0.014, 0.57, 0.018, 0.006, u, cy, cz + front * (d / 2 + 0.008)); this.cyl(M.steel, 0.006, 0.006, 0.12, u + (i % 2 ? -1 : 1) * (dw / 2 - 0.04), cy - 0.2, cz + front * (d / 2 + 0.03), 6); } else { this.rbox(M.oakDoor, 0.018, 0.57, dw - 0.014, 0.006, cx + front * (w / 2 + 0.008), cy, u); this.cyl(M.steel, 0.006, 0.006, 0.12, cx + front * (w / 2 + 0.03), cy - 0.2, u + (i % 2 ? -1 : 1) * (dw / 2 - 0.04), 6); }
    }
  }

  kitchen() {
    const M = this.M;
    // counters: south wall + east wall, wall units, cooker with its hood, fridge
    this.baseUnits(11.6, 15.9, 11.34, 11.92, true, -1); this.solid(11.6, 11.3, 15.92, 11.92, 0.9);
    this.baseUnits(15.34, 15.92, 8.42, 11.3, false, -1); this.solid(15.3, 7.7, 15.92, 11.3, 0.9);
    this.wallUnits(11.9, 1.85, 11.76, 1.0, 0.33, true, -1, 0);      // the left door is the chocolate cupboard: stations.js hangs it
    this.wallUnits(15.2, 1.85, 11.76, 1.2, 0.33, true, -1); this.wallUnits(15.76, 1.85, 10.6, 0.33, 1.2, false, -1);
    this.box(M.whitetile, 1.0, 0.55, 0.02, 12.1, 1.2, 12 - WT / 2 - 0.01); this.box(M.whitetile, 1.5, 0.55, 0.02, 15.15, 1.2, 12 - WT / 2 - 0.01);
    this.box(M.whitetile, 0.02, 0.55, 0.6, 16 - WT / 2 - 0.01, 1.2, 8.0); this.box(M.whitetile, 0.02, 0.55, 1.6, 16 - WT / 2 - 0.01, 1.2, 10.5);
    this.spots.kitchensink = { id: 'kitchensink', x: 13.5, z: 11.04, face: 0, room: 'kitchen', label: 'المجلى' };
    // cooker: oven door with a window, knobs, pan supports; hood over it
    this.rbox(M.white, 0.62, 0.92, 0.6, 0.012, 15.61, 0.46, 8.1); this.rbox(M.dark, 0.54, 0.02, 0.52, 0.006, 15.62, 0.93, 8.1);
    this.rbox(M.black, 0.02, 0.4, 0.44, 0.006, 15.295, 0.42, 8.1); this.cyl(M.steel, 0.01, 0.01, 0.42, 15.27, 0.68, 8.1, 8, Math.PI / 2);
    for (let i = 0; i < 4; i++) this.cyl(M.dark, 0.02, 0.022, 0.02, 15.292, 0.82, 7.92 + i * 0.12, 10, 0, Math.PI / 2);
    for (const [dx, dz] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) {
      this.cyl(M.steel, 0.05, 0.055, 0.012, 15.62 + dx, 0.945, 8.1 + dz, 14);
      const t = new THREE.TorusGeometry(0.075, 0.006, 5, 16); t.rotateX(Math.PI / 2); t.translate(15.62 + dx, 0.955, 8.1 + dz); this.push(M.black, t);
      this.box(M.black, 0.17, 0.008, 0.012, 15.62 + dx, 0.958, 8.1 + dz); this.box(M.black, 0.012, 0.008, 0.17, 15.62 + dx, 0.958, 8.1 + dz);
    }
    this.rbox(M.steel, 0.5, 0.08, 0.62, 0.012, 15.66, 1.72, 8.1); this.rbox(M.steel, 0.3, 0.5, 0.3, 0.012, 15.76, 2.0, 8.1);
    this.spots.kettle = { id: 'kettle', x: 15.02, z: 8.38, face: Math.PI / 2, room: 'kitchen', label: 'الغاز' };
    // gas cylinder with its collar and valve
    this.lathe(M.plasticBlue, [[0, 0.02], [0.14, 0.02], [0.16, 0.06], [0.16, 0.42], [0.12, 0.52], [0.05, 0.56], [0, 0.56]], 15.65, 0, 7.35, 18); this.cyl(M.dark, 0.13, 0.13, 0.03, 15.65, 0.015, 7.35, 16);
    { const t = new THREE.TorusGeometry(0.09, 0.008, 5, 16, Math.PI * 1.5); t.rotateX(Math.PI / 2); t.translate(15.65, 0.63, 7.35); this.push(M.plasticBlue, t); } this.cyl(M.gold, 0.02, 0.025, 0.07, 15.65, 0.6, 7.35, 8);
    this.tube(flatMat(0xe98a3a, { rough: 0.6 }), [[15.65, 0.63, 7.35], [15.7, 0.7, 7.5], [15.7, 0.6, 7.7], [15.66, 0.75, 7.82]], 0.008);
    this.solid(15.45, 7.15, 15.9, 7.6, 0.7);
    // on the worktops: utensil pot, knife block, spice jars, washing-up liquid, bread bin, microwave
    this.lathe(M.porcelain, [[0, 0], [0.045, 0], [0.05, 0.13], [0.046, 0.13], [0.04, 0.008], [0, 0.008]], 15.76, 0.9, 9.05, 12);
    for (const [dx, dz, c] of [[-0.015, 0, 0x8a5a2b], [0.012, 0.01, 0xcdd0d4], [0, -0.015, 0x8a5a2b]]) { this.cyl(flatMat(c, { rough: 0.6 }), 0.005, 0.005, 0.2, 15.76 + dx, 1.05, 9.05 + dz, 5); this.sph(flatMat(c, { rough: 0.6 }), 0.018, 15.76 + dx, 1.15, 9.05 + dz, 0.6); }
    this.rbox(M.walnut, 0.1, 0.2, 0.16, 0.02, 15.76, 1.0, 11.14);
    for (let i = 0; i < 3; i++) this.cyl(M.dark, 0.008, 0.008, 0.08, 15.74, 1.11, 11.1 + i * 0.04, 5, 0, 0.3);
    for (let i = 0; i < 4; i++) { this.cyl(M.pane, 0.025, 0.025, 0.08, 12.7 + i * 0.07, 0.94, 11.82, 10); this.cyl(flatMat([0xb5462f, 0xd9a520, 0x4a7a35, 0x8a5a2b][i], { rough: 0.8 }), 0.022, 0.022, 0.05, 12.7 + i * 0.07, 0.93, 11.82, 10); this.cyl(M.dark, 0.026, 0.026, 0.012, 12.7 + i * 0.07, 0.986, 11.82, 10); }
    this.lathe(flatMat(0x4aa3d9, { rough: 0.3 }), [[0, 0], [0.03, 0], [0.032, 0.12], [0.012, 0.16], [0.012, 0.19]], 13.08, 0.9, 11.84, 10);
    this.rbox(flatMat(0xe9dcc0, { rough: 0.7 }), 0.36, 0.2, 0.24, 0.07, 12.25, 1.0, 11.72);
    this.rbox(M.white, 0.34, 0.28, 0.48, 0.02, 15.72, 1.04, 10.7); this.rbox(M.black, 0.012, 0.2, 0.3, 0.004, 15.546, 1.04, 10.64); this.rbox(M.steel, 0.02, 0.2, 0.012, 0.004, 15.542, 1.04, 10.87);
    // fridge (door is live so it can be left open; the cabinet with its shelves is built in stations.js)
    this.solid(14.4, 6.58, 15.1, 7.22, 1.8);
    const fd = new THREE.Group();
    const fdoor = new THREE.Mesh(new RoundedBoxGeometry(0.68, 1.74, 0.05, 2, 0.012), M.white); fdoor.position.set(0.34, 0.9, 0.025); fdoor.castShadow = true;
    const fh = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.5, 4, 8), M.steel); fh.position.set(0.6, 1.1, 0.075);
    const fline = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.006, 0.052), M.steel); fline.position.set(0.34, 1.27, 0.025);
    fd.add(fdoor, fh, fline); fd.position.set(14.41, 0, 7.22); this.live(fd);
    for (const [x, z, c] of [[0.2, 0.3, 0xd33a2c], [0.42, 0.9, 0xf0c23a], [0.3, 1.5, 0x2f6fd0]]) { const mg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 12), flatMat(c)); mg.rotation.x = Math.PI / 2; mg.position.set(x, z, 0.054); fd.add(mg); }
    const fl = new THREE.PointLight(0xeaf4ff, 0, 2.5, 2); fl.position.set(14.75, 1.2, 7.5); this.group.add(fl); this.points.push(fl);
    const fridge = { id: 'fridge', type: 'fridge', room: 'kitchen', on: false, x: 14.75, z: 7.85, face: Math.PI, label: 'الثلاجة' };
    fridge.set = (on) => { fridge.on = on; fd.rotation.y = on ? -1.9 : 0; fl.intensity = on ? 3 : 0; };
    this.devices.fridge = fridge; fridge.door = fd;
    // table + chairs, fruit bowl
    const T = this.at(12.5, 8.5, 0);
    T.rbox(M.oak, 1.27, 0.05, 0.87, 0.02, 0, 0.75, 0).rbox(M.plaid, 1.0, 0.012, 0.6, 0.004, 0, 0.782, 0).rbox(M.oak, 1.1, 0.08, 0.7, 0.01, 0, 0.69, 0).solid(-0.63, -0.43, 0.63, 0.43, 0.78);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) T.cyl(M.oak, 0.035, 0.022, 0.72, sx * 0.55, 0.36, sz * 0.36, 10);
    T.lathe(M.porcelain, [[0, 0], [0.06, 0], [0.13, 0.05], [0.135, 0.052], [0.06, 0.008], [0, 0.008]], -0.46, 0.788, -0.27, 18);
    for (const [dx, dz, c, r] of [[-0.05, 0, 0xe98a1f, 0.04], [0.04, 0.03, 0xc9221a, 0.038], [0, -0.05, 0x8ab52f, 0.037], [0.0, 0.01, 0xe2c21f, 0.035]]) T.sph(flatMat(c, { rough: 0.45 }), r, -0.46 + dx, 0.84 + (r === 0.035 ? 0.045 : 0), -0.27 + dz);
    this.spots.kitchentable = { id: 'kitchentable', x: 12.5, z: 9.35, face: Math.PI, room: 'kitchen', label: 'طاولة المطبخ' };
    for (const [cx, cz, t] of [[12.2, 7.75, 0], [12.85, 7.75, 0], [11.55, 8.5, 1]]) this.chair(cx, cz, t, { wood: M.oak });
    // water cooler, bin, chocolate cupboard
    this.at(11.35, 7.0, 0).solid(-0.17, -0.17, 0.17, 0.17, 1.4);
    this.spots.cooler = { id: 'cooler', x: 11.85, z: 7.15, face: -Math.PI / 2, room: 'kitchen', label: 'الكولر' };
    this.solid(11.2, 11.35, 11.6, 11.75, 0.5);
    this.spots.bin = { id: 'bin', x: 11.62, z: 11.04, face: Math.atan2(11.4 - 11.62, 11.55 - 11.04), room: 'kitchen', label: 'الزبالة' };
    this.spots.cupboard = { id: 'cupboard', x: 11.76, z: 11.0, face: 0, room: 'kitchen', label: 'الخزانة', high: true };
    this.spots.stove = { id: 'stove', x: 14.9, z: 8.75, face: Math.PI / 2, room: 'kitchen' };
    // where mom works: clear of the places the kids get sent to
    this.spots.mom1 = { id: 'mom1', x: 15.04, z: 9.35, face: Math.PI / 2, room: 'kitchen' };
    this.spots.mom2 = { id: 'mom2', x: 15.04, z: 10.1, face: Math.PI / 2, room: 'kitchen' };
    this.spots.mom3 = { id: 'mom3', x: 12.55, z: 11.04, face: 0, room: 'kitchen' };
    this.spots.counter = { id: 'counter', x: 14.6, z: 11.04, face: 0, room: 'kitchen', label: 'المجلى' };
    this.hides.push({ id: 'hide_table_kitchen', x: 12.5, z: 9.3, face: Math.PI, kind: 'table', room: 'kitchen', inside: [12.5, 8.5], kidOnly: true, label: 'تخبّى تحت الطاولة' });
  }

  yard() {
    const M = this.M;
    // boundary wall + gate
    this.box(M.stone, 6.2, 1.9, 0.22, 19.05, 0.95, -0.03); this.solid(16, -0.14, 22.1, 0.08, 1.9);
    this.box(M.stone, 6.2, 1.9, 0.22, 19.05, 0.95, 12.03); this.solid(16, 11.92, 22.1, 12.14, 1.9);
    this.box(M.stone, 0.22, 1.9, 5.0, 22.03, 0.95, 2.5); this.box(M.stone, 0.22, 1.9, 5.0, 22.03, 0.95, 9.5); this.solid(21.92, 0, 22.14, 12, 1.9);
    // copings, gate piers with their lanterns, and a two-leaf iron gate
    const lantern = flatMat(0xfff1c8, { emissive: 0xffd58a, emissiveIntensity: 0.9, rough: 0.4 });
    this.rbox(M.cream, 6.3, 0.07, 0.32, 0.02, 19.05, 1.93, -0.03); this.rbox(M.cream, 6.3, 0.07, 0.32, 0.02, 19.05, 1.93, 12.03);
    this.rbox(M.cream, 0.32, 0.07, 4.8, 0.02, 22.03, 1.93, 2.45); this.rbox(M.cream, 0.32, 0.07, 4.8, 0.02, 22.03, 1.93, 9.55);
    for (const pz of [4.86, 7.14]) { this.box(M.stone, 0.36, 2.15, 0.36, 22.03, 1.075, pz); this.rbox(M.cream, 0.46, 0.08, 0.46, 0.025, 22.03, 2.19, pz); this.sph(lantern, 0.1, 22.03, 2.33, pz); }
    // the two leaves hang on their piers and swing into the yard
    this.gate = { leaves: [], k: 0, target: 0 };
    for (const [hz, dir] of [[5.04, 1], [6.96, -1]]) {
      const leaf = new THREE.Group(), parts = new Map(), lz = dir * 0.48;
      const put = (m, g) => { if (!parts.has(m)) parts.set(m, []); parts.get(m).push(plain(g)); };
      for (const y of [0.14, 0.92, 1.72]) put(M.metalGreen, uvRound(0.05, 0.05, 0.94, 0.012, 1).translate(0, y, lz));
      for (const e of [-1, 1]) put(M.metalGreen, uvRound(0.05, 1.63, 0.05, 0.012, 1).translate(0, 0.93, lz + e * 0.445));
      put(M.metalGreen, new THREE.BoxGeometry(0.016, 0.74, 0.86).translate(0, 0.53, lz));
      for (let i = 0; i < 6; i++) { const bz = lz - 0.33 + i * 0.132; put(M.dark, new THREE.CylinderGeometry(0.009, 0.009, 0.95, 6).translate(0, 1.36, bz)); put(M.gold, new THREE.CylinderGeometry(0.001, 0.02, 0.08, 6).translate(0, 1.875, bz)); }
      put(M.dark, new THREE.TorusGeometry(0.16, 0.009, 5, 20).rotateY(Math.PI / 2).translate(0, 1.32, lz));
      if (dir > 0) put(M.gold, uvRound(0.07, 0.16, 0.1, 0.012, 1).translate(-0.03, 1.0, 0.93));
      for (const [m, gs] of parts) { const mesh = new THREE.Mesh(mergeGeometries(gs, false), m); mesh.castShadow = true; leaf.add(mesh); }
      leaf.position.set(22.03, 0, hz); this.live(leaf); this.gate.leaves.push({ g: leaf, dir });
    }
    // the lane outside: a strip of pavement along the wall and a kerb in the colours that mean «ممنوع الوقوف»
    this.box(M.pavers, 0.64, 0.1, 34, 22.46, -0.05, 6);
    const kerbY = flatMat(0xe0b416, { rough: 0.8 });
    for (let i = 0; i < 56; i++) this.box(i % 2 ? M.dark : kerbY, 0.14, 0.13, 0.6, 22.85, -0.055, -10.7 + i * 0.6);
    this.street = { x: 23.92, y: -0.07, park: 6.0, walk: 22.66, gate: [21.35, 6.0] };
    // a neighbour's car further up the lane
    const nb = makeCar('hatch', { color: 0x2c4a3a, low: this.low, plate: '24-61309' });
    nb.group.position.set(25.9, -0.07, -6.5); nb.group.rotation.y = Math.PI; this.live(nb.group);
    this.spots.gate = { id: 'gate', x: 21.3, z: 6.0, face: Math.PI / 2, room: 'yard', label: 'بوابة الدار' };
    // front step
    this.rbox(M.marble, 0.6, 0.06, 1.4, 0.015, 16.35, 0.03, 5.5); this.rbox(flatMat(0x6b3a22, { rough: 1 }), 0.4, 0.012, 0.7, 0.005, 16.36, 0.066, 5.5);
    this.rbox(M.dark, 0.09, 0.2, 0.09, 0.02, 16.16, 2.05, 4.7); this.sph(lantern, 0.06, 16.18, 2.0, 4.7);
    // the family car (live: it gets washed)
    const fam = makeCar('sedan', { color: 0xf4f4f2, low: this.low, plate: '12-34567' });
    fam.group.position.set(19.3, 0, 2.9); fam.setClean(0); this.live(fam.group);
    this.car = Object.assign(fam, { x: 19.3, z: 2.9 });
    this.solid(18.42, 0.75, 20.18, 5.05, 1.4);
    this.spots.car1 = { id: 'car1', x: 17.95, z: 2.25, face: Math.PI / 2, room: 'yard', label: 'السيارة' };
    this.spots.car2 = { id: 'car2', x: 17.95, z: 3.55, face: Math.PI / 2, room: 'yard', label: 'السيارة' };
    this.spots.car3 = { id: 'car3', x: 20.7, z: 2.9, face: -Math.PI / 2, room: 'yard', label: 'السيارة' };
    this.spots.carhorn = { id: 'carhorn', x: 19.3, z: 5.5, face: Math.PI, room: 'yard' };
    // tap + bucket on the house wall
    this.spots.tap = { id: 'tap', x: 16.75, z: 8.0, face: -Math.PI / 2, room: 'yard', label: 'الحنفية' };
    // clothesline
    for (const px of [17.3, 21.2]) { this.cyl(M.steel, 0.028, 0.028, 2.0, px, 1.0, 10.6, 10); this.cyl(M.cream, 0.13, 0.15, 0.07, px, 0.035, 10.6, 14); this.sph(M.dark, 0.034, px, 2.0, 10.6); }
    // the peg bag on its post
    this.lathe(flatMat(0xd8c7a0, { rough: 1 }), [[0, 0], [0.07, 0.02], [0.085, 0.1], [0.06, 0.17], [0.05, 0.18]], 17.37, 1.45, 10.52, 12); this.cyl(M.white, 0.003, 0.003, 0.3, 17.345, 1.77, 10.55, 4, 0.2, 0.2);
    this.cyl(M.white, 0.006, 0.006, 3.9, 19.25, 1.92, 10.6, 6, 0, Math.PI / 2);
    this.spots.clothesline = { id: 'clothesline', x: 19.25, z: 9.95, face: 0, room: 'yard', label: 'حبل الغسيل' };
    // plants, lemon tree, outside bin
    [[17.4, 11.55], [18.9, 11.55], [20.4, 11.55]].forEach(([x, z], i) => {
      this.solid(x - 0.2, z - 0.2, x + 0.2, z + 0.2, 0.8);
      this.spots['plant' + (i + 1)] = { id: 'plant' + (i + 1), x, z: z - 0.65, face: 0, room: 'yard', label: 'الزريعة' };
    });
    // the lemon tree in its bed: a bent trunk, boughs, leafy clumps, fruit
    const bark = flatMat(0x5b4028, { rough: 1 }), leaves = [flatMat(0x2f6a2e, { rough: 0.9 }), flatMat(0x4c8c38, { rough: 0.9 })], tx = 21.2, tz = 0.95;
    { const t = new THREE.TorusGeometry(0.42, 0.06, 6, 22); t.rotateX(Math.PI / 2); t.translate(tx, 0.04, tz); this.push(M.stone, t); }
    this.cyl(flatMat(0x4a3423, { rough: 1 }), 0.4, 0.4, 0.05, tx, 0.03, tz, 20);
    this.tube(bark, [[tx, 0, tz], [tx + 0.04, 0.5, tz + 0.02], [tx - 0.05, 1.0, tz - 0.02], [tx - 0.02, 1.55, tz + 0.03]], 0.085, 8);
    for (const [bx, by, bz] of [[-0.55, 2.0, 0.3], [0.5, 2.1, 0.35], [0.1, 2.25, -0.45], [-0.25, 2.4, 0.0]]) this.tube(bark, [[tx - 0.03, 1.35, tz], [tx + bx * 0.5, (1.4 + by) / 2 + 0.05, tz + bz * 0.5], [tx + bx, by, tz + bz]], 0.035, 6);
    const clump = (mat, r, x, y, z, seed) => {
      const g = new THREE.IcosahedronGeometry(r, 2), q = g.attributes.position, n = g.attributes.normal;
      for (let i = 0; i < q.count; i++) {
        const vx = q.getX(i), vy = q.getY(i), vz = q.getZ(i), k = 1 + 0.16 * Math.sin(vx * 9 / r * 0.5 + seed) * Math.cos(vy * 8 / r * 0.5 + seed * 2) + 0.1 * Math.sin(vz * 13 / r * 0.5 + seed * 3);
        q.setXYZ(i, vx * k, vy * k * 0.85, vz * k); n.setXYZ(i, vx / r, vy / r, vz / r);
      }
      g.translate(x, y, z); this.push(mat, g);
    };
    [[0, 2.25, 0, 0.62], [-0.55, 2.05, 0.3, 0.5], [0.5, 2.1, 0.35, 0.5], [0.1, 2.3, -0.5, 0.48], [-0.3, 2.55, -0.1, 0.45], [0.35, 2.6, 0.1, 0.42], [-0.1, 1.9, 0.55, 0.4], [0.55, 1.85, -0.3, 0.38], [-0.6, 2.3, -0.4, 0.4]]
      .forEach(([dx, dy, dz, r], i) => clump(leaves[i % 2], r, tx + dx, dy, tz + dz, i * 1.7));
    this.solid(21.05, 0.8, 21.35, 1.1, 2);
    for (const [dx, dy, dz] of [[-0.5, 1.68, 0.5], [0.3, 1.6, 0.72], [-0.1, 1.52, 0.8], [0.68, 1.62, -0.2], [0.8, 1.8, 0.5], [-0.82, 1.82, 0.05], [0.1, 1.72, -0.75]]) this.sph(flatMat(0xf2d21f, { rough: 0.6 }), 0.055, tx + dx, dy, tz + dz, 1.25);
    this.solid(21.2, 7.75, 21.7, 8.25, 0.8);
    this.spots.yardbin = { id: 'yardbin', x: 20.85, z: 8.0, face: Math.PI / 2, room: 'yard', label: 'حاوية الزبالة' };
    this.sweep = [[17.2, 6.9], [19.4, 7.6], [20.6, 9.2], [18.2, 9.0]];
    this.sweep.forEach(([x, z], i) => { this.spots['sweep' + (i + 1)] = { id: 'sweep' + (i + 1), x, z, face: 0, room: 'yard', label: 'كنس الحوش' }; });
    // the neighbourhood: a few stone blocks with water tanks beyond the wall
    for (const [x, z, w, h, d] of [[31, 2, 9, 9, 10], [30, 15, 8, 6.5, 7], [-9, 4, 9, 7.5, 12], [6, -9, 12, 8.5, 8], [20, -10, 9, 6, 8], [8, 21, 14, 7, 8], [24, 22, 8, 9.5, 8], [-8, 18, 8, 6, 8]]) {
      this.box(M.stone, w, h, d, x, h / 2, z); this.box(M.stone, w + 0.3, 0.4, d + 0.3, x, h + 0.05, z);
      const glass = flatMat(0x1d2b38, { rough: 0.15 });
      for (let fl = 0; fl < Math.floor(h / 3); fl++) {
        for (let k = 0; k < Math.floor(w / 2.6); k++) { const wx = x - w / 2 + 1.3 + k * 2.6; for (const e of [-1, 1]) this.box(glass, 1.1, 1.2, 0.06, wx, 1.7 + fl * 3, z + e * (d / 2 + 0.01)); }
        for (let k = 0; k < Math.floor(d / 2.6); k++) { const wz = z - d / 2 + 1.3 + k * 2.6; for (const e of [-1, 1]) this.box(glass, 0.06, 1.2, 1.1, x + e * (w / 2 + 0.01), 1.7 + fl * 3, wz); }
      }
      this.lathe(M.white, [[0, 0], [0.6, 0], [0.62, 0.1], [0.62, 0.95], [0.5, 1.1], [0.15, 1.18], [0, 1.18]], x - w / 4, h + 0.45, z, 14); this.box(M.steel, 1.3, 0.2, 1.3, x - w / 4, h + 0.35, z);
    }
    // our own roof tank + dish
    this.lathe(M.white, [[0, 0], [0.7, 0], [0.72, 0.1], [0.72, 1.1], [0.58, 1.28], [0.18, 1.36], [0, 1.36]], 3, H + 0.85, 3, 16); this.box(M.steel, 1.5, 0.08, 1.5, 3, H + 0.81, 3);
    for (const [ex, ez] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.cyl(M.steel, 0.03, 0.03, 0.6, 3 + ex * 0.68, H + 0.5, 3 + ez * 0.68, 6);
    { const g = new THREE.LatheGeometry([[0, 0], [0.25, 0.03], [0.45, 0.11], [0.5, 0.15], [0.49, 0.16], [0.44, 0.125], [0.25, 0.045], [0, 0.015]].map(([r, y]) => new THREE.Vector2(r, y)), 20); g.rotateX(0.9); g.translate(12, H + 1.05, 9); this.push(M.white, g); }
    this.cyl(M.steel, 0.03, 0.03, 0.8, 12, H + 0.6, 9, 6);
  }

  finish() {
    for (const [mat, geos] of this.batches) {
      const flat = geos.map(plain), merged = mergeGeometries(flat, false);
      flat.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      geos.forEach((g) => g.dispose());
    }
    this.batches.clear();
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xd9cdb9, 1);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 3);
    this.sun.castShadow = !this.low;
    this.sun.shadow.mapSize.set(2048, 2048);
    const c = this.sun.shadow.camera;
    c.left = -15; c.right = 15; c.top = 12; c.bottom = -12; c.near = 1; c.far = 70;
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.03;
    this.sun.target.position.set(11, 0, 6);
    this.scene.add(this.hemi, this.sun, this.sun.target);
  }

  // ---------- time of day ----------
  setTime(tod) {
    this.tod = tod;
    const T = {
      morning: { sun: [30, 14, 2], sunC: 0xffd9a8, sunI: 3.4, hemi: 1.15, sky: 0xbcd9f2, glass: 0.9, exp: 1.0 },
      day: { sun: [19, 24, 16], sunC: 0xfff4de, sunI: 3.8, hemi: 1.45, sky: 0x9fcdf5, glass: 1.0, exp: 1.0 },
      evening: { sun: [-10, 9, 14], sunC: 0xff9d5c, sunI: 2.8, hemi: 0.7, sky: 0xf0a86a, glass: 0.7, exp: 1.0 },
      night: { sun: [8, 20, -6], sunC: 0x7f95c8, sunI: 0.25, hemi: 0.16, sky: 0x0b1020, glass: 0.03, exp: 1.05 },
    }[tod];
    this.sun.position.set(11 + T.sun[0], T.sun[1], 6 + T.sun[2]);
    this.sun.color.setHex(T.sunC); this.sun.intensity = T.sunI;
    this.hemi.intensity = T.hemi;
    this.hemi.color.setHex(tod === 'night' ? 0x4a5a86 : 0xffffff);
    this.scene.background = new THREE.Color(T.sky);
    this.M.glass.emissiveIntensity = T.glass;
    this.M.glass.emissive.setHex(tod === 'evening' ? 0xffc38a : 0xbfe0ff);
    this.exposure = T.exp;
    carsTime(tod);
    this.dark = tod === 'night';
  }

  // ---------- queries ----------
  roomAt(x, z) {
    for (const r of Object.values(ROOMS)) if (x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1) return r.id;
    return null;
  }
  lit(room) {
    if (!room) return true;
    if (!this.dark) return true;
    if (room === 'yard') return false;
    const d = this.devices['light_' + room];
    return !!(d && d.on);
  }

  // Push a circle out of the furniture and walls. Returns true if it touched something.
  collide(p, r = 0.26) {
    let hit = false;
    for (let pass = 0; pass < 2; pass++) for (const c of this.colliders) {
      const nx = Math.max(c.x0, Math.min(p.x, c.x1)), nz = Math.max(c.z0, Math.min(p.z, c.z1));
      let dx = p.x - nx, dz = p.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x = nx + dx / d * r; p.z = nz + dz / d * r; } else {
        // centre is inside: leave by the nearest side
        const l = p.x - c.x0, rr = c.x1 - p.x, t = p.z - c.z0, b = c.z1 - p.z, m = Math.min(l, rr, t, b);
        if (m === l) p.x = c.x0 - r; else if (m === rr) p.x = c.x1 + r; else if (m === t) p.z = c.z0 - r; else p.z = c.z1 + r;
      }
    }
    p.x = Math.max(WORLD.x0 + 0.3, Math.min(WORLD.x1 - 0.3, p.x)); p.z = Math.max(WORLD.z0 + 0.3, Math.min(WORLD.z1 - 0.3, p.z));
    return hit;
  }

  // Distance along a ray (2D) to the first collider at least minH tall, or `max`.
  ray(ox, oz, dx, dz, max, minH = 1.2) {
    let best = max;
    const test = (c) => {
      let t0 = 0, t1 = best;
      for (const [o, d, lo, hi] of [[ox, dx, c.x0, c.x1], [oz, dz, c.z0, c.z1]]) {
        if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return; } else {
          let a = (lo - o) / d, b = (hi - o) / d;
          if (a > b) [a, b] = [b, a];
          t0 = Math.max(t0, a); t1 = Math.min(t1, b);
          if (t0 > t1) return;
        }
      }
      if (t0 < best) best = t0;
    };
    for (const c of this.colliders) if (c.h >= minH) test(c);
    for (const d of this.doors) if (d.open < 0.35) {
      test(d.alongX ? { x0: d.x - d.width / 2, x1: d.x + d.width / 2, z0: d.z - 0.04, z1: d.z + 0.04 } : { x0: d.x - 0.04, x1: d.x + 0.04, z0: d.z - d.width / 2, z1: d.z + d.width / 2 });
    }
    return best;
  }
  // Can a point at eye height `h` be seen from (ax,az)?
  sight(ax, az, bx, bz, h = 1.2) {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
    if (len < 0.01) return true;
    return this.ray(ax, az, dx / len, dz / len, len, h) >= len - 0.02;
  }

  // ---------- navigation grid ----------
  buildNav() {
    const cols = this.cols = Math.ceil((WORLD.x1 - WORLD.x0) / CELL), rows = this.rows = Math.ceil((WORLD.z1 - WORLD.z0) / CELL);
    const blocked = this.blocked = new Uint8Array(cols * rows);
    const R = 0.27;
    for (const c of this.colliders) {
      const i0 = Math.max(0, Math.floor((c.x0 - R) / CELL)), i1 = Math.min(cols - 1, Math.floor((c.x1 + R) / CELL));
      const j0 = Math.max(0, Math.floor((c.z0 - R) / CELL)), j1 = Math.min(rows - 1, Math.floor((c.z1 + R) / CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = (i + 0.5) * CELL, z = (j + 0.5) * CELL;
        if (x > c.x0 - R && x < c.x1 + R && z > c.z0 - R && z < c.z1 + R) blocked[j * cols + i] = 1;
      }
    }
    // doorways are only one or two cells wide once the walls are fattened: carve them open
    const carve = (x, z, alongX, w) => {
      for (let t = -0.55; t <= 0.55; t += CELL / 2) for (let s = -(w / 2 - 0.3); s <= w / 2 - 0.3 + 1e-6; s += CELL / 2) {
        const px = alongX ? x + s : x + t, pz = alongX ? z + t : z + s;
        const i = Math.floor(px / CELL), j = Math.floor(pz / CELL);
        if (i >= 0 && j >= 0 && i < cols && j < rows) blocked[j * cols + i] = 0;
      }
    };
    for (const d of this.doors) carve(d.x, d.z, d.alongX, d.width);
    carve(8, 6.5, true, 2); carve(13.5, 6.5, true, 1); carve(11, 10.3, false, 1);
    for (let i = 0; i < cols; i++) { blocked[i] = 1; blocked[(rows - 1) * cols + i] = 1; }
    for (let j = 0; j < rows; j++) { blocked[j * cols] = 1; blocked[j * cols + cols - 1] = 1; }
  }
  cellFree(x, z) {
    const i = Math.floor(x / CELL), j = Math.floor(z / CELL);
    return i >= 0 && j >= 0 && i < this.cols && j < this.rows && !this.blocked[j * this.cols + i];
  }
  nearestFree(x, z) {
    if (this.cellFree(x, z)) return [x, z];
    for (let r = 1; r < 14; r++) for (let a = 0; a < 16; a++) {
      const px = x + Math.cos(a / 16 * Math.PI * 2) * r * CELL, pz = z + Math.sin(a / 16 * Math.PI * 2) * r * CELL;
      if (this.cellFree(px, pz)) return [px, pz];
    }
    return [x, z];
  }
  walkable(ax, az, bx, bz) {
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / (CELL * 0.45));
    for (let k = 0; k <= n; k++) { const t = n ? k / n : 0; if (!this.cellFree(ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
    return true;
  }
  // A* on the grid -> [[x,z], ...] (without the start), or null
  path(ax, az, bx, bz) {
    [ax, az] = this.nearestFree(ax, az); [bx, bz] = this.nearestFree(bx, bz);
    if (this.walkable(ax, az, bx, bz)) return [[bx, bz]];
    const cols = this.cols, rows = this.rows, N = cols * rows;
    const start = Math.floor(az / CELL) * cols + Math.floor(ax / CELL), goal = Math.floor(bz / CELL) * cols + Math.floor(bx / CELL);
    const g = this._g || (this._g = new Float32Array(N)), from = this._from || (this._from = new Int32Array(N)), state = this._state || (this._state = new Uint8Array(N));
    g.fill(Infinity); state.fill(0);
    const gi = goal % cols, gj = Math.floor(goal / cols);
    const hfn = (n) => { const dx = Math.abs(n % cols - gi), dz = Math.abs(Math.floor(n / cols) - gj); return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz); };
    const heap = [], f = [];
    const pushH = (n, v) => { heap.push(n); f[n] = v; let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (f[heap[p]] <= f[heap[i]]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const popH = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l; if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } }
      return top;
    };
    g[start] = 0; from[start] = -1; pushH(start, hfn(start));
    let found = false;
    while (heap.length) {
      const n = popH();
      if (state[n] === 2) continue;
      state[n] = 2;
      if (n === goal) { found = true; break; }
      const i = n % cols, j = Math.floor(n / cols);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
        const m = nj * cols + ni;
        if (this.blocked[m] || state[m] === 2) continue;
        if (di && dj && (this.blocked[j * cols + ni] || this.blocked[nj * cols + i])) continue;
        const cost = g[n] + (di && dj ? Math.SQRT2 : 1);
        if (cost < g[m]) { g[m] = cost; from[m] = n; pushH(m, cost + hfn(m)); }
      }
    }
    if (!found) return null;
    const pts = [];
    for (let n = goal; n !== -1; n = from[n]) pts.push([(n % cols + 0.5) * CELL, (Math.floor(n / cols) + 0.5) * CELL]);
    pts.reverse(); pts[pts.length - 1] = [bx, bz];
    // string-pull
    const out = []; let cx = ax, cz = az, k = 0;
    while (k < pts.length) {
      let far = k;
      for (let t = Math.min(pts.length - 1, k + 40); t > k; t--) if (this.walkable(cx, cz, pts[t][0], pts[t][1])) { far = t; break; }
      out.push(pts[far]); [cx, cz] = pts[far]; k = far + 1;
    }
    return out;
  }

  // Phones: only the few lamps nearest you are lit in the shader. Always the same number, so nothing recompiles
  // as you walk about; lamps that are switched off give way to ones that are on.
  cullLights(x, z, n = 4) {
    for (const l of this.points) l.userData.d = Math.hypot(l.position.x - x, l.position.z - z) + (l.intensity > 0 ? 0 : 7);
    [...this.points].sort((a, b) => a.userData.d - b.userData.d).forEach((l, i) => { l.visible = i < n; });
  }
  setLow(v) { this.low = v; this.sun.castShadow = !v; this.cullT = 0; if (v) this.cullLights(8, 9); else for (const l of this.points) l.visible = true; }

  // ---------- per-frame ----------
  // view: [x, z, camX, camZ], the line from the player to the camera: a door it passes through is kept open
  update(dt, actors, view) {
    if (this.low && actors[0]) { this.cullT = (this.cullT || 0) - dt; if (this.cullT <= 0) { this.cullT = 0.3; this.cullLights(actors[0].x, actors[0].z); } }
    const G = this.gate;
    if (G) { G.k += (G.target - G.k) * Math.min(1, dt * 3.2); for (const l of G.leaves) l.g.rotation.y = -l.dir * 1.42 * G.k; }
    for (const d of this.doors) {
      let near = false;
      if (d.auto && !d.locked) {
        // someone close (a little further once it is already open, so it does not flap), or the camera looking through it
        const r = d.target ? 2.1 : 1.25;
        for (const a of actors) { const dx = a.x - d.x, dz = a.z - d.z; if (dx * dx + dz * dz < r * r) { near = true; break; } }
        if (!near && view) {
          const [ax, az, bx, bz] = view, pa = d.alongX ? az - d.z : ax - d.x, pb = d.alongX ? bz - d.z : bx - d.x;
          if (pa * pb < 0) { const t = pa / (pa - pb), along = d.alongX ? ax + (bx - ax) * t - d.x : az + (bz - az) * t - d.z; near = Math.abs(along) < d.width / 2 + 0.25; }
        }
      }
      if (near) { d.hold = 2.4; if (d.target === 0 && this.onDoor) this.onDoor(d, true); d.target = 1; } else if (d.hold > 0) d.hold -= dt; else { if (d.target === 1 && this.onDoor) this.onDoor(d, false); d.target = 0; }
      // a leaf with weight: it gathers speed, swings, and comes to rest without a jolt (no overshoot, no shiver at the ends)
      const acc = (d.target - d.open) * 38 - (d.vel || 0) * 11.5;
      d.vel = (d.vel || 0) + acc * Math.min(dt, 0.05);
      d.open = Math.max(0, Math.min(1, d.open + d.vel * Math.min(dt, 0.05)));
      if ((d.open === 0 && d.vel < 0) || (d.open === 1 && d.vel > 0)) d.vel = 0;
      d.pivot.rotation.y = d.base + d.open * 1.65 * d.swing;
    }
  }
}
