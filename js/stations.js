// The chores, properly: every job has real props that change while you work
// (a glass that fills, an onion that becomes slices, clothes that go up on the line one by one)
// and hands that actually go where the work is.
import * as THREE from 'three';
import { Particles } from './fx.js';
import { sfx } from './audio.js';
import * as P from './props.js';
import { texMat } from './assets.js';
import { ACT, FX_SECS } from './actions.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (t) => t * t * (3 - 2 * t);
const seg = (u, a, b) => clamp((u - a) / (b - a));
const TOP = 0.9;                       // kitchen counter height
const T1 = V(0, 0, 0), T2 = V(0, 0, 0), HX = V(0, 0, 0), HY = V(0, 0, 0), HZ = V(0, 0, 0), HM = new THREE.Matrix4();

export { FX_SECS };

export class Stations {
  constructor(game) {
    this.g = game; this.scene = game.scene; this.w = game.world;
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.fx = new Particles(this.scene);
    this.tweens = []; this.t = 0; this.cur = null; this.stay = null;
    this.cooler(); this.stove(); this.chopBoard(); this.kitchenSink(); this.bath(); this.washer(); this.clothesLine(); this.bins(); this.yardTap();
    this.carKit(); this.sweeping(); this.plants(); this.desks(); this.fridge(); this.table(); this.bedMess(); this.misc();
    this.root.updateMatrixWorld(true);
  }
  add(o, x = 0, y = 0, z = 0, ry = 0) { o.position.set(x, y, z); o.rotation.y = ry; this.root.add(o); return o; }
  wp(o, local) { this.root.updateMatrixWorld(true); return local ? o.localToWorld(local.clone()) : o.getWorldPosition(V(0, 0, 0)); }
  tween(dur, fn, done) { this.tweens.push({ t: 0, dur, fn, done }); }
  fly(m, from, to, dur = 0.35, h = 0.3, done) {
    m.position.copy(from); m.visible = true; const a = from.clone(), b = to.clone();
    this.tween(dur, (k) => { m.position.lerpVectors(a, b, sm(k)); m.position.y += Math.sin(Math.PI * k) * h; m.rotation.x = k * 5; m.rotation.z = k * 3; }, done);
  }
  // a throw-away garment that flies from a to b and disappears
  toss(i, a, b, done, wet) { const c = P.randomGarment(i); if (wet) c.material = P.clothMat(new THREE.Color(c.material.color).multiplyScalar(0.72).getHex()); c.scale.setScalar(0.6); this.root.add(c); this.fly(c, a, b, 0.36, 0.35, () => { this.root.remove(c); done && done(); }); }

  // ================= building =================
  cooler() {
    const g = this.add(new THREE.Group(), 11.35, 0, 7.0, Math.PI / 2), grey = P.mat(0x8f949b, { rough: 0.5 });
    g.add(P.rbox(0.33, 0.96, 0.33, 0.03, P.MAT.white, 0, 0.48, 0), P.rbox(0.25, 0.3, 0.03, 0.01, P.mat(0x2b2f36, { rough: 0.6 }), 0, 0.73, 0.158),
      P.rbox(0.23, 0.02, 0.11, 0.005, grey, 0, 0.6, 0.2), P.cyl(0.115, 0.15, 0.055, P.mat(0xe9edf2, { rough: 0.4 }), 0, 0.985, 0, 22));
    for (const [x, c] of [[-0.06, 0x2f6fd0], [0.06, 0xd33a2c]]) {
      const tap = P.cyl(0.012, 0.012, 0.05, P.MAT.white, x, 0.75, 0.19, 8); tap.rotation.x = Math.PI / 2;
      const lever = P.rbox(0.03, 0.012, 0.045, 0.004, P.mat(c, { rough: 0.5 }), x, 0.772, 0.2); if (x < 0) this.coolLever = lever;
      g.add(tap, lever, P.cyl(0.006, 0.008, 0.025, P.MAT.white, x, 0.732, 0.208, 8));
    }
    for (let i = 0; i < 5; i++) g.add(P.mesh(new THREE.BoxGeometry(0.2, 0.004, 0.006), P.mat(0x5a5f66), 0, 0.612, 0.16 + i * 0.02));
    // the upside-down bottle and the water in it
    g.add(P.lathe([[0.03, 1.0], [0.032, 1.05], [0.12, 1.11], [0.135, 1.14], [0.135, 1.43], [0.12, 1.46], [0, 1.465]], P.MAT.bottle, 22));
    const water = P.cyl(0.128, 0.128, 0.3, P.MAT.water, 0, 1.26, 0, 20); g.add(water);
    const glass = P.waterGlass(0); glass.position.set(-0.06, 0.612, 0.2); glass.visible = false; g.add(glass);
    const pour = P.cyl(0.004, 0.004, 0.1, P.MAT.water, -0.06, 0.67, 0.208, 6); pour.visible = false; g.add(pour);
    this.C = { g, glass, pour, water, lever: this.coolLever, level: 0.85, tap: V(-0.06, 0.72, 0.208), cup: V(-0.06, 0.66, 0.2), bottle: V(0, 1.15, 0) };
    // a couple of clean glasses on top, the way every house keeps them
    for (const [x, z] of [[-0.1, 0.13], [0.1, 0.13]]) { const gl = P.waterGlass(0); gl.rotation.x = Math.PI; gl.position.set(x, 1.068, z); g.add(gl); }
    this.setBottle(0.85);
  }
  setBottle(v) { const c = this.C; c.level = v; c.water.scale.y = Math.max(0.05, v); c.water.position.y = 1.11 + 0.15 * Math.max(0.05, v); }

  stove() {
    const flame = this.add(new THREE.Group(), 15.5, 0.948, 8.22);
    const fm = new THREE.MeshStandardMaterial({ color: 0x1a3cff, emissive: 0x3a7dff, emissiveIntensity: 3, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 10; i++) flame.add(P.mesh(new THREE.ConeGeometry(0.011, 0.04, 5), fm, Math.cos(i / 10 * 6.283) * 0.055, 0.02, Math.sin(i / 10 * 6.283) * 0.055));
    flame.children.forEach((c) => { c.castShadow = false; }); flame.visible = false;
    const kettle = this.add(P.kettle(), 15.5, 0.957, 8.22, -Math.PI / 2), dallah = this.add(P.dallah(), 15.5, 0.957, 8.22, -Math.PI / 2);
    dallah.visible = false;
    const tray = this.add(new THREE.Group(), 15.52, TOP + 0.004, 8.68); tray.visible = false;
    this.K = { flame, kettle, dallah, tray, home: V(15.5, 0.957, 8.22), glasses: [] };
    // mansaf waits by the stove on Fridays
    this.mansaf = this.add(P.mansaf(), 15.58, TOP + 0.004, 9.5); this.mansaf.visible = false;
  }
  setTray(kind) {
    const K = this.K; while (K.tray.children.length) K.tray.remove(K.tray.children[0]);
    K.tray.add(P.tray(0.2, kind === 'coffee' ? P.MAT.brass : P.MAT.steel)); K.glasses = [];
    for (const [x, z] of [[-0.075, -0.03], [0.075, -0.03], [0, 0.09]]) { const c = kind === 'coffee' ? P.finjan(0) : P.teaGlass(0); c.position.set(x, 0.006, z); K.tray.add(c); K.glasses.push(c); }
    K.kettle.visible = kind !== 'coffee'; K.dallah.visible = kind === 'coffee'; K.pot = kind === 'coffee' ? K.dallah : K.kettle;
  }

  chopBoard() {
    const g = this.add(new THREE.Group(), 14.6, TOP + 0.002, 11.5);
    g.add(P.board());
    const knife = P.knife(); g.add(knife);
    const bowl = P.lathe([[0, 0], [0.05, 0], [0.1, 0.06], [0.106, 0.062], [0.05, 0.008], [0, 0.008]], P.mat(0xe9d9b8, { rough: 0.5 }), 20); bowl.position.set(-0.3, 0, 0.02); g.add(bowl);
    this.B = { g, knife, bowl, veg: null, slices: [], kind: '' };
    this.setVeg('onion'); this.restKnife();
  }
  setVeg(kind) {
    const B = this.B; if (B.veg) B.g.remove(B.veg); for (const s of B.slices) B.g.remove(s);
    B.kind = kind; B.veg = P.veg(kind); B.veg.position.set(0.07, 0.022, 0); B.g.add(B.veg); B.slices = []; B.done = 0;
  }
  restKnife() { const k = this.B.knife; k.position.set(-0.13, 0.03, 0.09); k.rotation.set(Math.PI / 2, 0.3, 0); }

  kitchenSink() {
    const x = 13.5, z = 11.57;
    this.add(P.rbox(0.6, 0.014, 0.42, 0.01, P.MAT.steel, 0, 0, 0), x, TOP + 0.006, z);
    this.add(P.rbox(0.52, 0.006, 0.34, 0.03, P.mat(0x7f838a, { rough: 0.35, metal: 0.8 }), 0, 0, 0), x, TOP + 0.015, z);
    this.add(P.cyl(0.022, 0.022, 0.004, P.MAT.dark, 0, 0, 0, 12), x, TOP + 0.02, z);
    this.add(P.tube([[x, TOP, 11.85], [x, 1.16, 11.85], [x, 1.2, 11.78], [x, 1.14, 11.68], [x, 1.1, 11.66]], 0.013, P.MAT.steel, 20));
    for (const s of [-1, 1]) this.add(P.cyl(0.014, 0.018, 0.035, P.MAT.steel, 0, 0, 0, 8), x + s * 0.08, TOP + 0.03, 11.85);
    const pool = this.add(P.mesh(new THREE.CircleGeometry(0.15, 20), P.MAT.water), x, TOP + 0.021, z); pool.rotation.x = -Math.PI / 2; pool.castShadow = false; pool.visible = false;
    // drying rack
    const rack = this.add(new THREE.Group(), 13.93, TOP + 0.004, 11.6);
    rack.add(P.rbox(0.34, 0.012, 0.3, 0.004, P.mat(0xd9dde2, { rough: 0.4 }), 0, 0.006, 0));
    for (let i = 0; i < 7; i++) { rack.add(P.cyl(0.003, 0.003, 0.11, P.MAT.steel, -0.13 + i * 0.043, 0.066, -0.11, 5), P.cyl(0.003, 0.003, 0.11, P.MAT.steel, -0.13 + i * 0.043, 0.066, 0.11, 5)); }
    const plates = []; for (let i = 0; i < 5; i++) { const p = P.plate(true); this.root.add(p); plates.push(p); }
    const sponge = this.add(P.sponge(), 13.72, TOP + 0.03, 11.78);
    this.D = { plates, sponge, pool, stack: V(13.14, TOP + 0.006, 11.6), basin: V(x, TOP + 0.07, z), spout: V(x, 1.09, 11.66), rack: V(13.8, TOP + 0.12, 11.6) };
    this.resetDishes(true);
  }
  resetDishes(dirty) {
    const D = this.D;
    D.plates.forEach((p, i) => {
      if (p.userData.stains) p.userData.stains.visible = dirty;
      if (dirty) { p.position.set(D.stack.x, D.stack.y + i * 0.013, D.stack.z); p.rotation.set(0, i, 0); } else this.rackPlate(p, i);
    });
    D.sponge.position.set(13.72, TOP + 0.03, 11.78); D.sponge.rotation.set(0, 0.4, 0);
  }
  rackPlate(p, i) { p.position.set(this.D.rack.x + i * 0.05, this.D.rack.y, this.D.rack.z); p.rotation.set(0, 0, Math.PI / 2 - 0.22); }

  bath() {
    // shower curtain on a rail: bunched to the left, pulled across while you shower
    this.add(P.cyl(0.008, 0.008, 2.3, P.MAT.steel, 0, 0, 0, 6), 5.75, 2.18, 1.5).rotation.z = Math.PI / 2;
    const cur = P.mesh(new THREE.PlaneGeometry(2.3, 1.75, 16, 1), P.clothMat(0x7f9ecf));
    const pos = cur.geometry.attributes.position; for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 22) * 0.03); cur.geometry.computeVertexNormals();
    this.add(cur, 5.75, 1.3, 1.5); this.curtain = cur; this.setCurtain(0);
    this.showerHead = V(6.55, 2.05, 0.45);
    this.add(P.cyl(0.008, 0.008, 0.5, P.MAT.steel, 0, 0, 0, 6), 4.63, 1.32, 2.5).rotation.x = Math.PI / 2;
    this.towel = this.add(P.garment('towel', 0xf2efe6), 4.64, 1.32, 2.5, Math.PI / 2); this.towel.scale.setScalar(0.8);
    this.bathSpout = V(4.79, 0.99, 3.2);
    // washer (front faces -X)
    // perfume on dad's nightstand
    this.perfume = this.add(P.group(P.rbox(0.045, 0.07, 0.03, 0.008, P.MAT.glass, 0, 0.035, 0), P.rbox(0.036, 0.05, 0.022, 0.006, P.mat(0xd9a441, { rough: 0.2, opacity: 0.8 }), 0, 0.03, 0), P.cyl(0.011, 0.011, 0.022, P.MAT.brass, 0, 0.08, 0, 10)), 2.62, 0.5, 0.3);
  }
  setCurtain(k) { const c = this.curtain; const s = lerp(0.3, 1, k); c.scale.x = s; c.position.x = 4.6 + 2.3 * s / 2; }

  washer() {
    const g = this.add(new THREE.Group(), 6.62, 0, 2.4, -Math.PI / 2);
    g.add(P.rbox(0.6, 0.85, 0.56, 0.025, P.MAT.white, 0, 0.425, 0), P.rbox(0.56, 0.1, 0.02, 0.005, P.mat(0xe4e7ea, { rough: 0.4 }), 0, 0.78, 0.282),
      P.cyl(0.03, 0.03, 0.025, P.MAT.steel, 0.17, 0.78, 0.3, 14), P.rbox(0.16, 0.05, 0.02, 0.004, P.mat(0xd2d6da), -0.17, 0.78, 0.292),
      P.rbox(0.14, 0.2, 0.09, 0.01, P.mat(0xe9772a, { rough: 0.7 }), -0.17, 0.95, -0.1));
    g.children[2].rotation.x = Math.PI / 2;
    const led = P.mesh(new THREE.BoxGeometry(0.02, 0.012, 0.01), new THREE.MeshStandardMaterial({ color: 0x113311, emissive: 0x35ff5a, emissiveIntensity: 0 }), 0.06, 0.78, 0.294); g.add(led);
    const drum = P.mesh(new THREE.CircleGeometry(0.168, 26), P.mat(0x16181c, { rough: 0.6 }), 0, 0.44, 0.283); drum.castShadow = false; g.add(drum);
    const swirlTex = P.canvasTex(128, 128, (c) => { c.fillStyle = '#20242b'; c.fillRect(0, 0, 128, 128); for (let i = 0; i < 9; i++) { c.fillStyle = ['#2f6fd0', '#c24b4b', '#f2f0ea', '#3f8f5a', '#e7a8c2', '#f0c23a'][i % 6]; c.beginPath(); c.ellipse(64 + Math.cos(i * 0.7) * 30, 64 + Math.sin(i * 0.7) * 30, 26, 12, i, 0, 7); c.fill(); } });
    const swirl = P.mesh(new THREE.CircleGeometry(0.15, 22), new THREE.MeshStandardMaterial({ map: swirlTex, roughness: 0.8 }), 0, 0.44, 0.285); swirl.castShadow = false; swirl.visible = false; g.add(swirl);
    const door = new THREE.Group(); door.position.set(-0.2, 0.44, 0.288);
    const ring = P.mesh(new THREE.TorusGeometry(0.185, 0.027, 8, 26), P.MAT.steel, 0.2, 0, 0.01), pane = P.mesh(new THREE.CircleGeometry(0.165, 24), P.MAT.glass, 0.2, 0, 0.012); pane.castShadow = false;
    door.add(ring, pane); g.add(door);
    this.W = { g, door, swirl, led, on: 0, open: 0, mouth: V(6.3, 0.44, 2.4) };
  }

  clothesLine() {
    this.L = { slots: [], y: 1.905, z: 10.6 };
    for (let i = 0; i < 8; i++) this.L.slots.push({ x: 17.72 + i * 0.445, m: null, pegs: [] });
  }
  hangAt(i, m) {
    const s = this.L.slots[i]; this.unhangAt(i);
    m.scale.setScalar(0.92); m.position.set(s.x, this.L.y, this.L.z); m.rotation.set(0, 0, 0); this.root.add(m); s.m = m;
    const w = m.userData.kind === 'sock' ? 0.03 : m.userData.kind === 'pants' ? 0.13 : 0.16;
    for (const dx of [-w, w]) { const p = P.peg([0xe2b23a, 0xd24b4b, 0x3f8fd9, 0x4aa86a][(i + (dx > 0 ? 1 : 0)) % 4]); p.position.set(s.x + dx, this.L.y + 0.005, this.L.z); this.root.add(p); s.pegs.push(p); }
  }
  unhangAt(i) { const s = this.L.slots[i]; if (s.m) this.root.remove(s.m); for (const p of s.pegs) this.root.remove(p); s.m = null; s.pegs = []; }

  bins() {
    const k = this.add(new THREE.Group(), 11.4, 0, 11.55);
    k.add(P.cyl(0.16, 0.15, 0.42, P.MAT.steel, 0, 0.21, 0, 20), P.cyl(0.165, 0.165, 0.02, P.MAT.dark, 0, 0.01, 0, 20));
    const rim = P.mesh(new THREE.TorusGeometry(0.155, 0.012, 6, 20), P.MAT.bag, 0, 0.42, 0); rim.rotation.x = Math.PI / 2; k.add(rim);
    const lid = new THREE.Group(); lid.position.set(0, 0.43, -0.15); lid.add(P.lathe([[0, 0.035], [0.1, 0.028], [0.165, 0]], P.MAT.steel, 20)); lid.children[0].position.z = 0.15; k.add(lid);
    const bag = P.trashBag(); bag.scale.setScalar(0.85); bag.position.set(0, 0.1, 0); bag.visible = false; k.add(bag);
    const y = this.add(new THREE.Group(), 21.45, 0, 8.0), green = P.mat(0x2f6b3f, { rough: 0.6 });
    y.add(P.rbox(0.48, 0.78, 0.48, 0.03, green, 0, 0.47, 0), P.cyl(0.07, 0.07, 0.05, P.MAT.dark, 0.2, 0.07, 0.2, 12), P.cyl(0.07, 0.07, 0.05, P.MAT.dark, 0.2, 0.07, -0.2, 12));
    y.children[1].rotation.x = y.children[2].rotation.x = Math.PI / 2;
    const ylid = new THREE.Group(); ylid.position.set(0.24, 0.87, 0); ylid.add(P.rbox(0.54, 0.05, 0.54, 0.02, P.mat(0x285a35, { rough: 0.6 }), -0.25, 0, 0)); y.add(ylid);
    this.N = { k, lid, bag, y, ylid, mouth: V(21.4, 0.95, 8.0) };
  }

  yardTap() {
    this.add(P.cyl(0.011, 0.011, 0.72, P.MAT.steel, 0, 0, 0, 6), 16.165, 0.36, 8.0);
    this.add(P.tube([[16.15, 0.72, 8.0], [16.25, 0.72, 8.0], [16.29, 0.7, 8.0], [16.3, 0.66, 8.0]], 0.014, P.MAT.brass, 12));
    const h = this.add(P.group(P.cyl(0.005, 0.005, 0.07, P.MAT.brass, 0, 0.03, 0, 6), P.rbox(0.07, 0.012, 0.012, 0.004, P.mat(0xcf3a2b), 0, 0.066, 0), P.rbox(0.012, 0.012, 0.07, 0.004, P.mat(0xcf3a2b), 0, 0.066, 0)), 16.22, 0.73, 8.0);
    this.tapHandle = h;
    this.bucket = this.add(P.bucket(), 16.42, 0, 8.45);
    this.can = this.add(P.wateringCan(), 16.42, 0, 7.55, 0.6);
    this.Y = { spout: V(16.3, 0.65, 8.0), under: V(16.3, 0, 8.0), bucketHome: V(16.42, 0, 8.45), canHome: V(16.42, 0, 7.55) };
  }

  carKit() {
    this.sponge = this.add(P.sponge(), 0, -1, 0); this.sponge.visible = false;
    this.foam = []; for (let i = 0; i < 26; i++) { const f = P.ball(0.07, P.MAT.foam, 0, -1, 0, 0.35); f.castShadow = false; f.visible = false; this.root.add(f); this.foam.push(f); }
    this.foamN = 0;
  }

  sweeping() {
    this.broom = this.add(P.broom(), 0, -2, 0); this.broom.visible = false;
    this.pan = this.add(P.dustpan(), 0, -2, 0); this.pan.visible = false;
    this.piles = this.w.sweep.map(([x, z]) => {
      const g = this.add(new THREE.Group(), x, 0.01, z + 0.8), leaves = [];
      for (let i = 0; i < 11; i++) { const l = P.leaf(); const a = i * 2.4, r = 0.1 + (i % 5) * 0.09; l.position.set(Math.cos(a) * r, 0.002 + i * 0.0015, Math.sin(a) * r); l.rotation.z = a; l.userData.home = l.position.clone(); g.add(l); leaves.push(l); }
      const dust = P.mesh(new THREE.CircleGeometry(0.5, 18), new THREE.MeshStandardMaterial({ color: 0x8a7a66, roughness: 1, transparent: true, opacity: 0.5 })); dust.rotation.x = -Math.PI / 2; dust.castShadow = false; g.add(dust);
      return { g, leaves, dust, x, z: z + 0.8 };
    });
  }

  plants() {
    this.PL = [[17.4, 11.55], [18.9, 11.55], [20.4, 11.55]].map(([x, z], i) => {
      const g = this.add(new THREE.Group(), x, 0, z);
      g.add(P.lathe([[0, 0], [0.14, 0], [0.2, 0.3], [0.215, 0.3], [0.215, 0.33], [0.19, 0.33]], P.mat(0xb5633c, { rough: 0.9 }), 18));
      const soil = P.cyl(0.19, 0.19, 0.02, new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 }), 0, 0.3, 0, 16); g.add(soil);
      const top = new THREE.Group(); top.position.y = 0.31; g.add(top);
      top.add(P.cyl(0.012, 0.016, 0.3, P.mat(0x4a7a35), 0, 0.15, 0, 6));
      for (let k = 0; k < 9; k++) { const l = P.ball(0.09, P.mat(k % 2 ? 0x3f8a3a : 0x4f9a45, { rough: 0.8 }), 0, 0, 0); l.scale.set(0.5, 0.16, 1.2); const a = k * 0.7 + i; l.position.set(Math.cos(a) * 0.1, 0.12 + (k % 4) * 0.07, Math.sin(a) * 0.1); l.rotation.set(-0.5, -a + Math.PI / 2, 0); top.add(l); }
      const flowers = new THREE.Group();
      for (let k = 0; k < 4; k++) { const f = P.group(P.ball(0.028, P.mat([0xe84a6a, 0xf0c23a, 0xffffff][i], { rough: 0.6 }), 0, 0, 0, 0.6), P.ball(0.012, P.mat(0xf0a020), 0, 0.012, 0)); f.position.set(Math.cos(k * 1.7) * 0.12, 0.3 + (k % 2) * 0.08, Math.sin(k * 1.7) * 0.12); flowers.add(f); }
      top.add(flowers);
      return { g, top, soil, flowers, x, z };
    });
  }
  setPlant(pl, v) { pl.top.scale.set(0.82 + 0.25 * v, 0.72 + 0.4 * v, 0.82 + 0.25 * v); pl.top.rotation.z = (1 - v) * 0.16; pl.flowers.scale.setScalar(Math.max(0.001, v)); pl.soil.material.color.setHex(v > 0.5 ? 0x4a3423 : 0x8a6a4a); pl.v = v; }

  desks() {
    const g = this.add(new THREE.Group(), 0, -5, 0);
    const book = P.book(); book.position.set(-0.19, 0, -0.1); book.rotation.y = 0.12;
    const note = P.notebook(); note.position.set(0.11, 0, -0.07); note.rotation.y = -0.1;
    const pencil = P.pencil(); pencil.position.set(0.22, 0.002, -0.06); pencil.rotation.set(0, 0, Math.PI / 2);
    g.add(book, note, pencil);
    this.S = { g, book, note, pencil };
    this.pad = this.add(P.controller(), 0, -5, 0);
    this.bag = this.add(P.schoolBag(), 0, -5, 0);
    // the game on the little TV
    const c = document.createElement('canvas'); c.width = 256; c.height = 144;
    this.gameTex = new THREE.CanvasTexture(c); this.gameTex.colorSpace = THREE.SRGBColorSpace; this.gameCanvas = c;
    const con = this.w.devices.console; con.screenMat.emissiveMap = this.gameTex; con.screenMat.emissive.setHex(0xffffff); con.screenMat.needsUpdate = true;
    this.ball = { x: 128, y: 72, vx: 60, vy: 35 }; this.score = [0, 0];
  }
  drawGame(dt) {
    const g = this.gameCanvas.getContext('2d'), b = this.ball;
    b.x += b.vx * dt; b.y += b.vy * dt; if (b.y < 16 || b.y > 128) b.vy *= -1;
    if (b.x < 12 || b.x > 244) { if (b.y > 52 && b.y < 92) { this.score[b.x < 128 ? 1 : 0]++; b.x = 128; b.y = 72; } b.vx *= -1; }
    g.fillStyle = '#1f7a35'; g.fillRect(0, 0, 256, 144);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#238a3c' : '#1f7a35'; g.fillRect(i * 32, 0, 32, 144); }
    g.strokeStyle = '#e8f5e8'; g.lineWidth = 2; g.strokeRect(8, 8, 240, 128); g.beginPath(); g.moveTo(128, 8); g.lineTo(128, 136); g.stroke(); g.beginPath(); g.arc(128, 72, 20, 0, 7); g.stroke(); g.strokeRect(8, 48, 22, 48); g.strokeRect(226, 48, 22, 48);
    for (let i = 0; i < 10; i++) { const t = this.t * 0.8 + i * 1.7, team = i < 5; g.fillStyle = team ? '#d33' : '#36c'; g.beginPath(); g.arc((team ? 70 : 186) + Math.cos(t) * 46 + (b.x - 128) * 0.25, 72 + Math.sin(t * 1.3 + i) * 46, 4.5, 0, 7); g.fill(); }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(b.x, b.y, 3, 0, 7); g.fill();
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(98, 0, 60, 16); g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.fillText(`${this.score[0]} - ${this.score[1]}`, 128, 12);
    this.gameTex.needsUpdate = true;
  }

  fridge() {
    const white = P.mat(0xf4f5f6, { rough: 0.4 }), x0 = 14.4, z0 = 6.6, g = this.add(new THREE.Group(), 14.75, 0, 6.91);
    g.add(P.rbox(0.7, 1.8, 0.03, 0.008, white, 0, 0.9, -0.295), P.rbox(0.03, 1.8, 0.62, 0.008, white, -0.335, 0.9, 0), P.rbox(0.03, 1.8, 0.62, 0.008, white, 0.335, 0.9, 0),
      P.rbox(0.7, 0.03, 0.62, 0.008, white, 0, 1.785, 0), P.rbox(0.7, 0.05, 0.62, 0.008, white, 0, 0.025, 0), P.rbox(0.64, 0.5, 0.03, 0.006, P.mat(0xe9ecef, { rough: 0.5 }), 0, 1.52, 0.28), P.rbox(0.64, 0.03, 0.56, 0.004, white, 0, 1.25, 0));
    for (const y of [0.4, 0.68, 0.96]) g.add(P.rbox(0.64, 0.012, 0.44, 0.003, P.mat(0xdfe9ee, { rough: 0.2, opacity: 0.75 }), 0, y, -0.05));
    g.add(P.rbox(0.62, 0.24, 0.4, 0.01, P.mat(0xcfe3ea, { rough: 0.2, opacity: 0.45 }), 0, 0.18, -0.05));
    // ---- what a Jordanian fridge holds on any day of the week ----
    const tag = (text, bg, fg, w = 160, h = 64, px = 30) => new THREE.MeshStandardMaterial({ roughness: 0.55, map: P.canvasTex(w, h, (c, W, H) => { c.fillStyle = bg; c.fillRect(0, 0, W, H); c.fillStyle = fg; c.font = `bold ${px}px Cairo, "Segoe UI", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.direction = 'rtl'; c.fillText(text, W / 2, H / 2 + 2); }) });
    const band = (r, h, m) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20, 1, true), m); b.castShadow = false; return b; };
    const glassJar = P.mat(0xe4f2f6, { rough: 0.05, opacity: 0.32 });
    // a glass jar with something in it and a lid: labneh under its oil, olives, pickles in brine
    const jar = (fill, lid, h = 0.13, r = 0.045, bits) => {
      const j = P.group(P.lathe([[0, 0], [r, 0], [r + 0.004, 0.01], [r + 0.004, h - 0.02], [r - 0.008, h - 0.004], [r - 0.008, h]], glassJar, 16), P.cyl(r - 0.002, r - 0.002, h * 0.78, fill, 0, h * 0.4, 0, 16), P.cyl(r - 0.004, r - 0.004, 0.022, P.mat(lid, { rough: 0.35, metal: 0.4 }), 0, h + 0.008, 0, 16));
      if (bits) for (let i = 0; i < 9; i++) { const a = i * 2.4, rr = (i % 3) * 0.013; j.add(P.ball(bits[1], P.mat(bits[0], { rough: 0.35 }), Math.cos(a) * rr, h * 0.79 - (i % 2) * 0.01, Math.sin(a) * rr, bits[2] || 1)); }
      return j;
    };
    const items = {};
    // bottom shelf: the kunafa tray, half a watermelon cut face out, a bowl of hummus under cling film
    items.kunafa = P.kunafa(); items.kunafa.position.set(0.1, 0.412, -0.06); items.kunafa.scale.setScalar(0.9);
    items.melon = P.group(
      P.mesh(new THREE.SphereGeometry(0.115, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), P.mat(0x2f6b2d, { rough: 0.55 })),
      P.mesh(new THREE.CircleGeometry(0.113, 24).rotateX(-Math.PI / 2), P.mat(0xd8343e, { rough: 0.65 }), 0, 0.001, 0),
      P.mesh(new THREE.RingGeometry(0.098, 0.113, 24).rotateX(-Math.PI / 2), P.mat(0xe8efc8, { rough: 0.6 }), 0, 0.002, 0));
    for (let i = 0; i < 14; i++) { const a = i * 2.39, rr = 0.025 + (i % 4) * 0.017; items.melon.add(P.ball(0.0045, P.mat(0x1a1210), Math.cos(a) * rr, 0.003, Math.sin(a) * rr, 0.35)); }
    items.melon.rotation.x = -Math.PI / 2 + 0.25; items.melon.position.set(-0.19, 0.52, -0.1);
    const hummus = P.group(P.lathe([[0, 0], [0.07, 0], [0.085, 0.035], [0.088, 0.036], [0.075, 0.03], [0, 0.03]], P.MAT.porcelain, 18), P.cyl(0.074, 0.074, 0.006, P.mat(0xd9bf8c, { rough: 0.85 }), 0, 0.031, 0, 18), P.cyl(0.026, 0.026, 0.002, P.mat(0xb79a2a, { rough: 0.1 }), 0, 0.035, 0, 14), P.mesh(new THREE.SphereGeometry(0.09, 16, 6, 0, Math.PI * 2, 0, 0.5), P.MAT.glass, 0, -0.04, 0));
    for (let i = 0; i < 6; i++) hummus.add(P.ball(0.004, P.mat(0xb8321e), Math.cos(i) * 0.04, 0.036, Math.sin(i * 1.7) * 0.03, 0.4));
    hummus.position.set(-0.03, 0.406, 0.1);
    // middle shelf: the tomatoes for the salad, eggs in their tray, white cheese in brine, labneh
    items.tomato = P.makeItem('tomato'); items.tomato.position.set(-0.17, 0.692, -0.02);
    const eggs = P.group(P.rbox(0.2, 0.03, 0.1, 0.006, P.mat(0xb9a98a, { rough: 0.9 }), 0, 0.015, 0)); for (let i = 0; i < 8; i++) eggs.add(P.ball(0.019, P.mat(0xf2e2c8, { rough: 0.5 }), -0.07 + (i % 4) * 0.047, 0.04, i < 4 ? -0.023 : 0.023, 1.25)); eggs.position.set(0.13, 0.686, -0.12);
    const cheese = P.group(P.rbox(0.12, 0.07, 0.09, 0.012, P.mat(0xeef5f7, { rough: 0.15, opacity: 0.55 }), 0, 0.035, 0), P.rbox(0.1, 0.04, 0.07, 0.006, P.mat(0xfbf8ee, { rough: 0.6 }), 0, 0.028, 0), P.rbox(0.122, 0.012, 0.092, 0.006, P.mat(0x2f6fd0, { rough: 0.4 }), 0, 0.074, 0));
    cheese.add(P.mesh(new THREE.PlaneGeometry(0.1, 0.03), tag('جبنة بيضا', '#2f6fd0', '#fff', 160, 48, 26), 0, 0.04, 0.0461)); cheese.position.set(0.12, 0.686, 0.08);
    const labneh = jar(P.mat(0xf6f2e6, { rough: 0.7 }), 0xc8a23a, 0.12, 0.05); labneh.add(P.cyl(0.046, 0.046, 0.014, P.mat(0xc9a83a, { rough: 0.05, opacity: 0.8 }), 0, 0.1, 0, 16)); labneh.position.set(-0.03, 0.686, 0.1);
    // top shelf: the laban for lunch, last night's pot, olives and pickles
    items.laban = P.group(P.lathe([[0, 0], [0.055, 0], [0.062, 0.12], [0.064, 0.122], [0, 0.122]], P.MAT.white, 20), P.cyl(0.066, 0.066, 0.016, P.mat(0x1f8a4a, { rough: 0.4 }), 0, 0.128, 0, 20));
    const lb = band(0.0605, 0.05, tag('لبن', '#1f8a4a', '#fff', 256, 64, 34)); lb.position.y = 0.06; items.laban.add(lb); items.laban.position.set(0.16, 0.966, -0.04);
    const pot = P.group(P.lathe([[0, 0], [0.1, 0], [0.104, 0.005], [0.104, 0.1], [0.108, 0.104]], P.MAT.steel, 22), P.lathe([[0, 0.135], [0.03, 0.13], [0.1, 0.106], [0.112, 0.104]], P.MAT.steel, 22), P.cyl(0.016, 0.012, 0.02, P.MAT.dark, 0, 0.143, 0, 10));
    for (const sx of [-1, 1]) pot.add(P.rbox(0.03, 0.012, 0.02, 0.005, P.MAT.dark, sx * 0.118, 0.085, 0));
    pot.position.set(-0.17, 0.966, -0.08);
    const olives = jar(P.mat(0x5c6a2a, { rough: 0.3, opacity: 0.85 }), 0xd9d6cf, 0.13, 0.045, [0x3b4a1c, 0.013, 1.25]); olives.position.set(0.0, 0.966, -0.16);
    const pickles = jar(P.mat(0xd8d27a, { rough: 0.1, opacity: 0.6 }), 0xc33a2c, 0.15, 0.048, [0x6f8f2a, 0.012, 2.2]); pickles.position.set(0.02, 0.966, 0.09);
    // above: juice and a covered plate; the crisper below: cucumbers, tomatoes, lemons, a bunch of parsley
    const juice = P.group(P.rbox(0.07, 0.19, 0.07, 0.006, tag('عصير', '#f08a1f', '#fff', 96, 160, 28), 0, 0.095, 0), P.mesh(new THREE.ConeGeometry(0.05, 0.04, 4).rotateY(Math.PI / 4), P.mat(0xf6f0e4), 0, 0.21, 0), P.cyl(0.012, 0.012, 0.014, P.mat(0x2f6fd0), 0.015, 0.232, 0, 10)); juice.position.set(0.2, 1.265, -0.12);
    const plate = P.group(P.lathe([[0, 0], [0.09, 0], [0.11, 0.02], [0.112, 0.022], [0, 0.006]], P.MAT.porcelain, 22), P.mesh(new THREE.SphereGeometry(0.1, 18, 6, 0, Math.PI * 2, 0, 0.55), P.mat(0xcfd6da, { rough: 0.15, metal: 0.85 }), 0, -0.03, 0)); plate.position.set(-0.12, 1.265, -0.06);
    const crisp = P.group();
    for (let i = 0; i < 4; i++) { const c = P.mesh(new THREE.CapsuleGeometry(0.018, 0.13, 4, 10).rotateZ(Math.PI / 2), P.mat(0x2f6a2c, { rough: 0.55 }), -0.18 + i * 0.012, 0.03 + (i % 2) * 0.02, -0.12 + i * 0.045); c.rotation.y = 0.3 * i; crisp.add(c); }
    for (const [x, z] of [[0.02, -0.1], [0.08, -0.04], [0.03, 0.04]]) crisp.add(P.ball(0.038, P.mat(0xcf2a1c, { rough: 0.35 }), x, 0.04, z, 0.9));
    for (const [x, z] of [[0.18, -0.12], [0.2, -0.04]]) crisp.add(P.ball(0.03, P.mat(0xf2d22a, { rough: 0.5 }), x, 0.032, z, 1.25));
    for (let i = 0; i < 9; i++) crisp.add(P.ball(0.022, P.mat(i % 2 ? 0x3f8a2c : 0x2f7a24, { rough: 0.9 }), 0.17 + Math.cos(i) * 0.03, 0.05 + (i % 3) * 0.012, 0.06 + Math.sin(i * 1.3) * 0.03));
    crisp.position.set(0, 0.07, 0);
    g.add(items.tomato, items.laban, items.kunafa, items.melon, eggs, cheese, labneh, pot, olives, pickles, hummus, juice, plate, crisp);
    this.F = { g, items, front: V(14.75, 0.8, 7.1) };
    // the door: water bottles, a milk carton, ketchup, a jar of jam, butter
    const door = this.w.devices.fridge.door;
    for (const y of [0.45, 0.85, 1.2]) door.add(P.rbox(0.56, 0.06, 0.07, 0.006, white, 0.34, y, -0.045));
    const bottle = (x) => { const b = P.group(P.lathe([[0, 0], [0.035, 0], [0.037, 0.02], [0.036, 0.2], [0.03, 0.25], [0.014, 0.28], [0.014, 0.3]], P.MAT.bottle, 14), P.cyl(0.033, 0.033, 0.13, P.MAT.water, 0, 0.09, 0, 14), P.cyl(0.016, 0.016, 0.02, P.mat(0x2f6fd0, { rough: 0.4 }), 0, 0.31, 0, 10)); const l = band(0.0375, 0.06, tag('مي', '#2f8fd0', '#fff', 128, 48, 26)); l.position.y = 0.14; b.add(l); b.position.set(x, 0.48, -0.05); return b; };
    door.add(bottle(0.12), bottle(0.22));
    const milk = P.group(P.rbox(0.07, 0.19, 0.07, 0.006, tag('حليب', '#f4f4f0', '#2f6fd0', 96, 160, 26), 0, 0.095, 0), P.mesh(new THREE.ConeGeometry(0.05, 0.04, 4).rotateY(Math.PI / 4), P.mat(0x2f6fd0), 0, 0.21, 0)); milk.position.set(0.4, 0.48, -0.05); door.add(milk);
    const ketchup = P.group(P.lathe([[0, 0], [0.028, 0], [0.032, 0.1], [0.022, 0.14], [0.012, 0.15]], P.mat(0xc0201a, { rough: 0.25 }), 12), P.cyl(0.014, 0.018, 0.03, P.MAT.white, 0, 0.16, 0, 10)); ketchup.position.set(0.16, 0.88, -0.05); door.add(ketchup);
    const jam = jar(P.mat(0x8f1530, { rough: 0.15, opacity: 0.9 }), 0xc9a24a, 0.09, 0.034); jam.position.set(0.3, 0.88, -0.05); door.add(jam);
    const mayo = jar(P.mat(0xf6f1df, { rough: 0.5 }), 0x2f6fd0, 0.1, 0.034); mayo.position.set(0.42, 0.88, -0.05); door.add(mayo);
    const butter = P.rbox(0.12, 0.04, 0.05, 0.006, tag('زبدة', '#f2d24a', '#7a4a10', 128, 48, 26), 0.3, 1.25, -0.05); door.add(butter);
    void x0; void z0;
  }

  table() {
    this.breakfast = this.add(P.breakfast(), 12.5, 0.786, 8.8); this.breakfast.visible = false;
    // step stool for Hammoudeh at the high cupboard, and what's inside it
    this.stool = this.add(P.group(P.rbox(0.32, 0.04, 0.26, 0.01, P.mat(0xe9772a, { rough: 0.6 }), 0, 0.26, 0), P.rbox(0.28, 0.24, 0.03, 0.008, P.mat(0xd2681f), 0, 0.12, -0.1), P.rbox(0.28, 0.24, 0.03, 0.008, P.mat(0xd2681f), 0, 0.12, 0.1)), 11.76, 0, 11.0); this.stool.visible = false;
    // the chocolate cupboard: that bay of the wall units is hollow (world.js); this is its door and what is behind it.
    // local +x runs west along the front, +z comes out into the room
    const cup = this.add(new THREE.Group(), 11.9, 1.56, 11.595, Math.PI), oakDoor = texMat('oak', { size: 0.9, rough: 0.5, color: 0xf3e6cf });
    cup.add(P.rbox(0.46, 0.012, 0.27, 0.003, texMat('oak', { size: 1.2, rough: 0.6 }), 0.25, 0.3, -0.16),
      P.group(P.cyl(0.042, 0.042, 0.1, P.MAT.glass, 0, 0.05, 0, 14), P.cyl(0.038, 0.038, 0.06, P.mat(0xd9a520, { rough: 0.8 }), 0, 0.034, 0, 14), P.cyl(0.044, 0.044, 0.014, P.mat(0xb53a3a), 0, 0.105, 0, 14)),
      P.rbox(0.15, 0.07, 0.1, 0.01, P.mat(0x2f6fd0, { rough: 0.6 }), 0.14, 0.345, -0.16));
    cup.children[1].position.set(0.37, 0.306, -0.16);
    const bars = P.group(); for (let i = 0; i < 3; i++) { const b = P.makeItem('chocolate'); b.rotation.set(-Math.PI / 2 + 0.25, 0, 0); b.position.set(0.14 + i * 0.1, 0.1, -0.06); bars.add(b); } cup.add(bars);
    const door = new THREE.Group(); door.position.set(0.493, 0, 0);
    door.add(P.rbox(0.486, 0.57, 0.018, 0.006, oakDoor, -0.243, 0.29, 0.009), P.cyl(0.006, 0.006, 0.12, P.MAT.steel, -0.45, 0.09, 0.03, 6)); cup.add(door);
    this.CB = { door, bars };
  }

  bedMess() {
    const geo = new THREE.PlaneGeometry(1.04, 1.34, 12, 14); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, bump = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) bump[i] = (Math.sin(pos.getX(i) * 9 + 1) * Math.cos(pos.getZ(i) * 7) + Math.sin(pos.getX(i) * 17 + pos.getZ(i) * 13) * 0.5) * 0.07 + 0.08;
    const blanket = P.mesh(geo, P.clothMat(0x7f9ecf));
    const pillow = P.rbox(0.5, 0.12, 0.34, 0.05, P.MAT.white);
    this.M = { blanket, pillow, bump, bed: null, v: 1 };
    this.root.add(blanket, pillow); blanket.visible = pillow.visible = false;
  }
  setBed(v, wave = 0, ph = 0) {          // 1 = a mess, 0 = made; wave = the ripple from a flick of the edge
    const M = this.M; if (!M.bed) return; M.v = v;
    const pos = M.blanket.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, M.bump[i] * v + (wave ? Math.max(0, Math.sin(pos.getX(i) * 5 - ph + 2.5)) * wave : 0));
    pos.needsUpdate = true; M.blanket.geometry.computeVertexNormals();
    M.blanket.position.set(M.bed.x + 0.13 * v, 0.6, M.bed.z + 0.34 + 0.12 * v); M.blanket.rotation.y = 0.32 * v;
    if (!M.held) { M.pillow.position.set(M.bed.x - 0.2 * v, 0.66 + 0.02 * v, M.bed.z - 0.72 + 0.75 * v); M.pillow.rotation.set(0.25 * v, 0.9 * v, 0); }
  }

  misc() {
    this.phoneMesh = P.phone(); this.root.add(this.phoneMesh); this.phoneMesh.visible = false;
    this.pile = { g: this.add(new THREE.Group(), 0, -5, 0), clothes: [], basket: P.basket(0) };
    this.pile.g.add(this.pile.basket);
  }

  // ================= per segment =================
  reset(tasks, key, self) {
    this.tweens = []; this.cur = null; this.stay = null; this.key = key; this.self = self;
    const steps = tasks.flatMap((t) => t.steps), has = (f) => steps.some(f);
    const C = this.C; C.glass.visible = false; C.pour.visible = false;
    this.K.flame.visible = false; this.K.tray.visible = false; this.setTray('tea'); this.K.kettle.position.copy(this.K.home); this.K.kettle.rotation.set(0, -Math.PI / 2, 0);
    this.mansaf.visible = has((s) => s.pick === 'mansaf'); this.mansaf.userData.eaten(0);
    this.setVeg('onion'); this.restKnife();
    this.resetDishes(true);
    this.setCurtain(0);
    this.W.on = 0; this.W.open = 0;
    // the line: two things always out to dry; more if today's job is to bring them in
    for (let i = 0; i < 8; i++) this.unhangAt(i);
    this.hangAt(0, P.garment('towel', 0xf2f0ea)); this.hangAt(7, P.garment('thobe', 0xf7f6f2));
    if (has((s) => s.pick === 'clothes')) for (let i = 1; i < 7; i++) this.hangAt(i, P.randomGarment(i + 2));
    this.N.bag.visible = false; this.N.lid.rotation.x = 0; this.N.ylid.rotation.z = 0;
    this.bucket.position.copy(this.Y.bucketHome); this.bucket.rotation.set(0, 0, 0); this.bucket.userData.level(0); this.bucket.userData.foam(false);
    this.can.position.copy(this.Y.canHome); this.can.rotation.set(0, 0.6, 0);
    this.held = null; this.g.player.handProp = null;
    this.sponge.visible = false; this.broom.visible = false; this.pan.visible = false; this.bucketLevel = 0; this.foam.forEach((f) => { f.visible = false; }); this.foamN = 0;
    this.piles.forEach((p, i) => { const on = has((s) => s.use === 'sweep' + (i + 1)); p.g.visible = on; p.done = !on; p.dust.material.opacity = 0.5; p.leaves.forEach((l) => { l.visible = true; l.position.copy(l.userData.home); }); });
    const thirsty = has((s) => /^plant/.test(s.use || ''));
    this.PL.forEach((pl) => this.setPlant(pl, thirsty ? 0 : 1));
    // study things on your own desk
    const seat = this.w.seats[self.desk], S = this.S;
    S.g.visible = has((s) => s.act === 'study');
    S.g.position.set(seat.x + Math.sin(seat.heading) * 0.36, 0.762, seat.z + Math.cos(seat.heading) * 0.36); S.g.rotation.y = seat.heading - Math.PI; S.note.userData.write(0);
    this.pad.visible = false; this.bag.visible = false;
    for (const k of Object.keys(this.F.items)) this.F.items[k].visible = true;
    this.F.items.kunafa.visible = has((s) => s.pick === 'kunafa'); this.F.items.melon.visible = !this.F.items.kunafa.visible;
    this.breakfast.visible = false; this.breakfast.userData.eaten(0); this.stool.visible = false; this.CB.door.rotation.y = 0;
    // your bed, unmade, if making it is on today's list
    const M = this.M, bed = this.w.seats[self.bed];
    M.bed = has((s) => s.use === '@bed') ? { x: bed.x, z: bed.z - 0.1 } : null;
    M.blanket.visible = M.pillow.visible = !!M.bed; M.blanket.material = P.clothMat({ big: 0x3f66ad, kid: 0xa83232, sis: 0xd0669a }[key]);
    M.held = false; M.pillow.scale.set(1, 1, 1);
    if (M.bed) this.setBed(1);
    // dirty clothes on your floor
    const pl = this.pile; for (const c of pl.clothes) pl.g.remove(c); pl.clothes = [];
    const pile = steps.find((s) => s.pick === 'laundry' && s.at === '@pile');
    pl.g.visible = !!pile;
    if (pile) {
      pl.g.position.set(self.pile[0], 0, self.pile[1]); pl.basket.position.set(0.45, 0, 0.1); pl.basket.userData.fill(0); pl.basket.visible = true;
      for (let i = 0; i < 6; i++) { const c = P.randomGarment(i + 1); c.scale.setScalar(0.7); c.rotation.set(-Math.PI / 2, 0, i * 1.1); c.position.set(Math.cos(i * 1.4) * 0.3 - 0.15, 0.012 + i * 0.004, Math.sin(i * 1.4) * 0.3); c.userData.home = c.position.clone(); pl.g.add(c); pl.clothes.push(c); }
    }
  }

  // ================= frame =================
  update(dt, viewH, fov) {
    this.t += dt;
    for (const tw of [...this.tweens]) { tw.t += dt; const k = Math.min(1, tw.t / tw.dur); tw.fn(k); if (k >= 1) { this.tweens = this.tweens.filter((q) => q !== tw); tw.done && tw.done(); } }
    this.fx.update(dt, viewH, fov);
    // laundry sways
    for (const s of this.L.slots) if (s.m) { s.m.rotation.x = Math.sin(this.t * 1.3 + s.x * 2) * 0.09; s.m.rotation.z = Math.sin(this.t * 0.9 + s.x) * 0.03; }
    const K = this.K;
    if (K.flame.visible) K.flame.children.forEach((c, i) => { c.scale.y = 0.8 + Math.sin(this.t * 30 + i * 2) * 0.3; });
    // washer
    const W = this.W; W.door.rotation.y += ((W.open ? -1.9 : 0) - W.door.rotation.y) * Math.min(1, dt * 8);
    W.swirl.visible = W.on > 0; W.led.material.emissiveIntensity = W.on > 0 ? 3 : 0;
    if (W.on > 0) { W.on -= dt; W.swirl.rotation.z -= dt * 9; W.hum = (W.hum || 0) - dt; if (W.hum <= 0) { W.hum = 1.0; sfx.hum({ x: 6.4, y: 0.5, z: 2.4 }); } }
    if (this.w.devices.console.on) { this.gt = (this.gt || 0) - dt; if (this.gt <= 0) { this.gt = 0.07; this.drawGame(0.07); } }
    // phone in the hand
    const p = this.g.player;
    if (p) {
      this.phoneMesh.visible = !!p.phoneOut && p.char.visible;
      if (p.phoneOut) {
        // in the palm, along the hand, the back of it on the palm and the screen towards the face; fingers round its edges
        const c = p.char, ha = c.bones.R_Hand, m = this.phoneMesh, k = c.height / 1.72, h = c.root.rotation.y;
        // up in front of the chest, the palm (and so the screen) turned to the eyes
        c.reachTo('R', T1.set(c.pos.x + Math.sin(h) * 0.3 * k - Math.cos(h) * 0.1 * k, c.pos.y + 1.2 * k, c.pos.z + Math.cos(h) * 0.3 * k + Math.sin(h) * 0.1 * k), 0.42);
        const B = c.bones; c.palmTo = (this._palm || (this._palm = V(0, 0, 0))); B.LEye.getWorldPosition(c.palmTo).add(B.REye.getWorldPosition(T2)).multiplyScalar(0.5);
        ha.updateWorldMatrix(true, false); const e = ha.matrixWorld.elements;
        HX.set(e[0], e[1], e[2]).normalize(); HY.set(e[4], e[5], e[6]).normalize(); HZ.crossVectors(HY, HX).normalize();
        ha.getWorldPosition(m.position).addScaledVector(HX, 0.07).addScaledVector(HY, 0.024);
        m.quaternion.setFromRotationMatrix(HM.makeBasis(HZ, HY, HX));
        c.look = (this._phoneLook || (this._phoneLook = V(0, 0, 0))).copy(m.position);
      } else if (this._phoneWas) { p.char.look = null; p.char.palmTo = null; p.char.reachTo('R', null); }
      this._phoneWas = p.phoneOut;
    }
  }

  // ================= actions =================
  // Which action (if any) dresses up this step.
  fxFor(task, s) {
    const id = s.use || s.at || '', own = typeof id === 'string' && id[0] === '@';
    if (s.use) {
      if (id === '@bed') return { name: 'makeBed' };
      if (id === 'counter') return { name: 'chop', veg: s.veg || 'onion' };
      if (id === 'kitchensink') return { name: 'dishes' };
      if (id === 'sink') return { name: 'washFace' };
      if (id === 'shower') return { name: 'shower' };
      if (id === 'tap') return { name: 'fillBucket', can: task.steps.some((q) => /^plant/.test(q.use || '')) };
      if (/^car\d/.test(id)) return { name: 'washCar', spot: id };
      if (/^sweep/.test(id)) return { name: 'sweep', i: +id.slice(5) - 1 };
      if (/^plant/.test(id)) return { name: 'waterPlant', i: +id.slice(5) - 1 };
      if (id === 'kitchentable') return { name: 'breakfast' };
      if (id === '@desk') return { name: 'packBag' };
      if (id === '@wardrobe') return { name: 'dress' };
      if (id === 'nightstand') return { name: 'perfume' };
      if (id === 'maindoor') return { name: 'openDoor' };
      return null;
    }
    if (s.pick) {
      if (s.pick === 'water') return { name: 'fillGlass' };
      if (s.pick === 'tea') return { name: 'makeTea' };
      if (s.pick === 'coffee') return { name: 'makeCoffee' };
      if (s.pick === 'laundry' && own) return { name: 'gatherLaundry' };
      if (s.pick === 'wet') return { name: 'unloadWasher' };
      if (s.pick === 'clothes') return { name: 'unhang' };
      if (s.pick === 'trash') return { name: 'tieTrash' };
      if (id === 'fridge') return { name: 'fridgeTake', item: s.pick };
      if (s.pick === 'talabat') return this.g.delivery.hung ? null : { name: 'takeOrder' };
      if (id === 'cupboard') return { name: 'cupboard' };
      if (/^wardrobe_/.test(id)) return { name: 'rummage', id };
      if (id === 'cups') return { name: 'pickUp', y: 1.24, f: 0.56, spot: 'cups' };
      if (s.prop) return { name: 'pickUp', step: s };
      if (s.pick === 'mansaf') return { name: 'liftTray' };
      return null;
    }
    if (s.drop) {
      if (id === 'washer') return { name: 'loadWasher' };
      if (id === 'clothesline') return { name: 'hang' };
      if (id === 'yardbin') return { name: 'dumpTrash' };
      if (own) return { name: 'putAway' };
      if (['salontable', 'coffeetable', 'kitchentable'].includes(id) && ['kunafa', 'cups', 'mansaf', 'laban', 'remote'].includes(s.drop)) return { name: 'setDown', at: id, item: s.drop };
    }
    return null;
  }

  ctx() { const p = this.g.player; return { p, c: p.char, d: {} }; }
  focus(p, pos, side = 0) {
    // from behind and to one side: whichever angle has the most room (side -1 / +1 keeps it to your left / right)
    const h = p.char.heading; let best = h + Math.PI, far = -1;
    for (const s of side ? [0.9 * side, 1.35 * side, 0.45 * side] : [0.9, -0.9, 1.35, -1.35, 0.45, -0.45]) { const yaw = h + Math.PI + s, d = this.w.ray(p.x, p.z, Math.sin(yaw), Math.cos(yaw), 2.4, 1.5); if (d > far + 0.15) { far = d; best = yaw; } }
    p.focus = { pos: pos.clone(), yaw: best };
    this.look({ c: p.char }, pos);
  }
  // eyes on the job
  look(x, pos) { x.c.look = (this._look || (this._look = V(0, 0, 0))).copy(pos); }
  begin(fx) {
    const a = ACT[fx.name]; if (!a) return;
    const x = this.ctx(); x.fx = fx; x.free = !!a.free; this.cur = x;
    x.p.setPose('m_idle_neutral_01', { fade: 0.2 });
    if (fx.name !== 'waterPlant') this.putDown(x.p);
    a.begin && a.begin(this, x, fx);
  }
  tick(fx, u, dt) { const a = ACT[fx.name], x = this.cur; if (!a || !x) return; x.t = (x.t || 0) + dt; a.tick && a.tick(this, x, clamp(u), dt, fx); }
  end(fx, done) {
    const a = ACT[fx.name], x = this.cur; if (!a || !x) return;
    a.end && a.end(this, x, done, fx);
    this.cur = null; this.calm(x.p);
    if (fx.name !== 'fillBucket') this.pickUp(x.p);
  }
  putDown(p, drop) {
    if (!this.held) return; const m = this.held === 'can' ? this.can : this.bucket, h = p.char.heading;
    p.handProp = null; m.position.set(p.x + Math.cos(h) * 0.5 - Math.sin(h) * 0.15, 0, p.z - Math.sin(h) * 0.5 - Math.cos(h) * 0.15); m.rotation.set(0, h, 0);
    if (drop) this.held = null;
  }
  pickUp(p) { if (this.held && !p.carrying) p.handProp = this.held === 'can' ? { mesh: this.can, side: 'R', dy: -0.2 } : { mesh: this.bucket, side: 'L', dy: -0.3 }; }
  calm(p) { const c = p.char; c.release(); c.look = null; c.talk = 0; p.workLean = null; p.focus = null; p.pose = null; p.invisible = false; c.pos.y = 0; if (p.carrying) { p.carrying.grounded = null; p.carrying.custom = false; p.carrying.hide = false; } }
  // (kr, kl: how far each hand closes round what it is on, see Char.reachTo)
  hands(x, R, L, kr = 0.6, kl = 0.6) { x.c.reachTo('R', R || null, kr); x.c.reachTo('L', L || null, kl); }
  // every `period` seconds (while an action runs)
  every(x, key, period) { x.d[key] = (x.d[key] || 0) + (x.dt || 0); if (x.d[key] >= period) { x.d[key] = 0; return true; } return false; }
  // put the basket you're carrying on the ground beside you while both hands are busy
  ground(x, at) { const c = x.p.carrying; if (!c) return at; c.grounded = (c.grounded || V(0, 0, 0)).copy(at); return c.grounded; }

  // ----- things you sit down for -----
  // in bed the rumpled blanket of an unmade bed gives way to the one you are under
  tuck(on) { const M = this.M; if (M.bed) { M.blanket.visible = !on; M.pillow.visible = !on; } }
  stayBegin(step) {
    const p = this.g.player, c = p.char; this.stay = { step, d: {} };
    if (step.act === 'ps') { this.pad.visible = true; p.workLean = 0.12; }
    if (step.act === 'study') p.workLean = 0.2;
    if (step.act === 'study') { this.S.g.visible = true; this.focus(p, this.wp(this.S.note)); }
    if (step.act === 'meal' || step.act === 'eat') { /* food is already on the table */ }
    void c;
  }
  stayTick(step, u, dt) {
    const st = this.stay; if (!st) return; const p = this.g.player, c = p.char, h = c.heading;
    st.t = (st.t || 0) + dt;
    if (step.act === 'ps') {
      const base = V(c.pos.x + Math.sin(h) * 0.34, 0.86 * (c.height / 1.7), c.pos.z + Math.cos(h) * 0.34);
      this.pad.position.copy(base); this.pad.position.y += Math.sin(st.t * 9) * 0.004; this.pad.rotation.set(0.5, h + Math.PI, Math.sin(st.t * 5) * 0.12, 'YXZ');
      c.reachTo('R', T1.copy(base).add(V(-Math.cos(h) * 0.07, -0.01, Math.sin(h) * 0.07))); c.reachTo('L', T2.copy(base).add(V(Math.cos(h) * 0.07, -0.01, -Math.sin(h) * 0.07)));
    } else if (step.act === 'study') {
      const S = this.S; S.note.userData.write(u);
      const line = (u * 12) % 1, row = Math.floor(u * 12);
      const tip = this.wp(S.note, V(0.07 - line * 0.14, 0.012, -0.085 + row * 0.014));
      S.pencil.position.copy(S.g.worldToLocal(tip.clone())); S.pencil.position.y += 0.002; S.pencil.rotation.set(0.5, 0, -0.45 + Math.sin(st.t * 22) * 0.06);
      c.reachTo('R', T1.copy(tip).setY(tip.y + 0.07)); c.reachTo('L', this.wp(S.book, V(0.02, 0.05, 0.05)));
      st.w = (st.w || 0) + dt; if (st.w > 0.28) { st.w = 0; sfx.pencil(); }
      st.pg = (st.pg || 0) + dt;
      if (st.pg > 7) { st.pg = 0; const f = S.book.userData.flip; f.visible = true; sfx.page(); this.tween(0.5, (k) => { f.rotation.z = Math.PI * k; }, () => { f.visible = false; f.rotation.z = 0; }); }
    } else if (step.act === 'meal') {
      const m = this.g.placed.mansaf; if (m) { m.userData.eaten(u); const pos = this.wp(m); const k = (st.t * 0.9) % 1; c.reachTo('R', k < 0.5 ? T1.copy(pos).setY(pos.y + 0.14) : c.headPos(T1).add(V(Math.sin(h) * 0.12, -0.1, Math.cos(h) * 0.12))); c.talk = k > 0.5 ? 0.6 : 0; if (k < 0.05 && !st.m) { st.m = 1; sfx.munch(); } if (k > 0.5) st.m = 0; }
    } else if (step.act === 'eat') {
      const k = (st.t * 1.4) % 1; c.reachTo('R', c.headPos(T1).add(V(Math.sin(h) * 0.12, -0.08 - (k < 0.5 ? 0.25 : 0), Math.cos(h) * 0.12))); c.talk = k > 0.5 ? 0.6 : 0; if (k < 0.06 && !st.m) { st.m = 1; sfx.munch(); } if (k > 0.5) st.m = 0;
    }
  }
  stayEnd(step, done) {
    const p = this.g.player; this.stay = null;
    if (step.act === 'ps') this.pad.visible = false;
    if (step.act === 'study' && done) this.S.note.userData.write(1);
    if (step.act === 'eat' && done && this.g.placed.kunafa && step.stay === 'salontable') { const old = this.g.placed.kunafa, k = P.kunafa(true); k.position.copy(old.position); old.parent.add(k); old.parent.remove(old); this.g.placed.kunafa = k; }
    p.char.release(); p.char.look = null; p.char.talk = 0; p.workLean = null; p.focus = null;
  }
}
