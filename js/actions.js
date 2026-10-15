// How each chore is actually done, step by step, the way a person does it:
// the prop moves the way the job needs it to, and the hands (two-bone IK), the back and the head follow.
// S = the stations (props, particles, helpers), x = { p: player, c: character, d: scratch, t: seconds so far }.
import * as THREE from 'three';
import { sfx } from './audio.js';
import * as P from './props.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (t) => t * t * (3 - 2 * t);
const seg = (u, a, b) => clamp((u - a) / (b - a));
const TOP = 0.9;
const fwd = (c) => V(Math.sin(c.heading), 0, Math.cos(c.heading));
const rgt = (c) => V(-Math.cos(c.heading), 0, Math.sin(c.heading));
// from a to b along a little arc
const arc = (a, b, k, h = 0) => V(lerp(a.x, b.x, sm(k)), lerp(a.y, b.y, sm(k)) + Math.sin(Math.PI * clamp(k)) * h, lerp(a.z, b.z, sm(k)));
const once = (x, key) => { if (x.d[key]) return false; x.d[key] = 1; return true; };
const every = (x, key, dt, period) => { x.d[key] = (x.d[key] || 0) + dt; if (x.d[key] >= period) { x.d[key] = 0; return true; } return false; };
// which item, and how far into it, when a job is n of the same thing in a row
const split = (u, n, a = 0, b = 1) => { const v = seg(u, a, b) * n, i = Math.min(n - 1, Math.floor(v)); return [i, v - i]; };
const squat = (x) => x.p.setPose('m_crouch_idle', { fade: 0.25 });
const basketBeside = (x, side = 0.48, front = 0.22) => { const c = x.c, r = rgt(c), f = fwd(c); return V(c.pos.x + r.x * side + f.x * front, 0, c.pos.z + r.z * side + f.z * front); };

export const ACT = {
  // ---------- water cooler: glass under the cold tap, other hand on the lever ----------
  fillGlass: {
    secs: 2.3,
    begin(S, x) { const C = S.C; C.glass.visible = true; C.glass.userData.level(0); S.focus(x.p, S.wp(C.g, C.cup)); x.p.workLean = 0.14; },
    tick(S, x, u, dt) {
      const C = S.C, tap = S.wp(C.g, C.tap), cup = S.wp(C.g, C.cup), on = u > 0.16 && u < 0.9;
      // bring the glass in, hold it, take it away full
      const out = fwd(x.c).multiplyScalar(-0.16), k = u < 0.16 ? 1 - sm(u / 0.16) : u > 0.9 ? sm((u - 0.9) / 0.1) : 0;
      const g = S.wp(C.g, C.cup).addScaledVector(out, k).setY(cup.y - 0.05 + k * 0.12);
      C.glass.position.copy(C.g.worldToLocal(g.clone())); C.glass.rotation.z = on ? 0.12 * (1 - seg(u, 0.5, 0.9)) : 0;
      C.pour.visible = on; C.lever.rotation.x = on ? 0.5 : 0;
      if (on) {
        if (once(x, 'p')) sfx.pour();
        S.fx.stream('water', tap, T1.copy(g).setY(g.y + 0.04), 1, 0.1); C.glass.userData.level(sm(seg(u, 0.16, 0.9))); S.setBottle(C.level - dt * 0.012);
        if (every(x, 'g', dt, 0.55)) { sfx.glug(); const b = S.wp(C.g, C.bottle); for (let i = 0; i < 6; i++) S.fx.emit('bubble', { x: b.x + (Math.random() - 0.5) * 0.14, y: b.y - 0.06, z: b.z + (Math.random() - 0.5) * 0.14 }, { x: 0, y: 0.5, z: 0 }, 0.1); }
      }
      S.hands(x, T1.copy(g).setY(g.y + 0.055), on || u < 0.16 ? S.wp(C.lever, V(0, 0.01, 0.03)) : null);
    },
    end(S, x, done) { const C = S.C; C.pour.visible = false; C.glass.visible = false; C.lever.rotation.x = 0; C.glass.position.copy(C.cup); if (!done) C.glass.userData.level(0); },
  },

  // ---------- tea: light the ring, wait for the boil, pour glass by glass ----------
  makeTea: {
    secs: 4.2,
    begin(S, x, fx) { const K = S.K; S.setTray(fx.name === 'makeCoffee' ? 'coffee' : 'tea'); K.tray.visible = true; K.pot.position.copy(K.home); S.focus(x.p, V(15.5, 1.0, 8.45)); x.p.workLean = 0.14; x.d.cur = -1; },
    tick(S, x, u, dt, fx) {
      const K = S.K, pot = K.pot, kind = fx.name === 'makeCoffee' ? 'coffee' : 'tea';
      const spout = () => S.wp(pot, pot.userData.spout), handle = () => S.wp(pot, pot.userData.handle);
      if (u < 0.08) { S.hands(x, null, V(15.36, 0.86, 8.05)); if (u > 0.04 && once(x, 'lit')) { K.flame.visible = true; sfx.click(); } return; }       // the knob
      K.flame.visible = u < 0.42;
      if (u < 0.42) {
        pot.position.copy(K.home); pot.rotation.set(0, -Math.PI / 2, 0);
        if (every(x, 's', dt, 0.13 - u * 0.2)) S.fx.emit('steam', spout(), { x: 0, y: 0.5, z: 0.15 }, 0.15, 0.6 + u * 2.4);
        if (u > 0.16 && once(x, 'b')) sfx.boil({ x: 15.5, y: 1, z: 8.2 });
        if (u > 0.32 && kind === 'tea' && once(x, 'w')) sfx.whistle({ x: 15.5, y: 1, z: 8.2 });
        S.hands(x, u > 0.34 ? handle() : null, null);
        return;
      }
      if (u < 0.94) {
        const [i, f] = split(u, K.glasses.length, 0.42, 0.94), gw = S.wp(K.glasses[i]);
        const tilt = sm(seg(f, 0.12, 0.32)) * (1 - sm(seg(f, 0.8, 1)));
        // spout over the glass, pot lifted high for the long pour
        pot.position.set(gw.x, gw.y + 0.08 + 0.07 * tilt, gw.z - 0.2 + 0.03 * tilt); pot.rotation.set(0, -Math.PI / 2, -0.8 * tilt);
        if (x.d.cur !== i) { x.d.cur = i; sfx.pour(); }
        if (tilt > 0.6) { S.fx.stream(kind, spout(), T1.copy(gw).setY(gw.y + 0.03), 1, 0.11); K.glasses[i].userData.level(seg(f, 0.25, 0.78)); if (Math.random() < 0.3) S.fx.emit('steam', gw, { x: 0, y: 0.3, z: 0 }, 0.08, 0.5); }
        if (f > 0.8) K.glasses[i].userData.level(1);
      } else { pot.position.lerp(K.home, 0.25); pot.rotation.z *= 0.7; }
      S.hands(x, handle(), S.wp(K.tray, V(-0.21, 0.02, 0.02)));
    },
    end(S) { const K = S.K; K.flame.visible = false; K.pot.position.copy(K.home); K.pot.rotation.set(0, -Math.PI / 2, 0); K.tray.visible = false; },
  },

  // ---------- chopping: claw hand walks back along the onion, knife rocks, slices go in the bowl ----------
  chop: {
    begin(S, x, fx) { if (S.B.kind !== fx.veg || S.B.done) S.setVeg(fx.veg); S.focus(x.p, S.wp(S.B.g)); x.d.ph = 0; x.p.workLean = 0.2; },
    tick(S, x, u, dt, fx) {
      const B = S.B, n = 13, cutU = seg(u, 0.04, 0.84), want = Math.floor(cutU * n);
      const len = 1 - 0.88 * cutU; B.veg.scale.x = len; B.veg.position.x = 0.07 + 0.046 * (1 - len); B.veg.visible = len > 0.14;
      const cutX = B.veg.position.x - 0.046 * len - 0.004;
      while (B.slices.length < want) {
        const i = B.slices.length, s = P.slice(fx.veg === 'salad' ? (i % 2 ? 'tomato' : 'cucumber') : fx.veg);
        s.position.set(-0.03 - i * 0.012, 0.03 + (i % 2) * 0.002, (i % 3 - 1) * 0.006); s.rotation.set(0, 0, 1.15 + (i % 2) * 0.1); s.userData.home = s.position.clone(); B.g.add(s); B.slices.push(s);
        S.fx.burst(fx.veg === 'onion' ? 'bit' : 'crumb', S.wp(B.g, V(cutX, 0.04, 0)), 3, 0.5, 0.5);
      }
      const k = B.knife;
      if (u < 0.84) {
        x.d.ph += dt * 15; const up = Math.abs(Math.sin(x.d.ph));
        if (Math.sin(x.d.ph) * Math.sin(x.d.ph - dt * 15) < 0) sfx.chop();
        // tip stays near the board, heel does the work
        k.position.set(cutX - 0.004, 0.034 + up * 0.07, -0.1); k.rotation.set(0, -Math.PI / 2, -up * 0.36);
        S.hands(x, S.wp(B.g, V(cutX - 0.01, 0.065 + up * 0.07, -0.165)), S.wp(B.g, V(B.veg.position.x + 0.012, 0.105, 0.005)));
      } else {            // blade flat, sweep the lot into the bowl
        const f = seg(u, 0.84, 1), bx = lerp(0.03, -0.2, sm(f));
        k.position.set(bx, 0.04, -0.07); k.rotation.set(Math.PI / 2 - 0.3, -Math.PI / 2, 0);
        B.slices.forEach((s, i) => { const kk = seg(f, 0.15 + i * 0.03, 0.6 + i * 0.03); s.position.lerpVectors(s.userData.home, T1.set(-0.3 + (i % 3 - 1) * 0.025, 0.04 + (i % 4) * 0.008, 0.02 + (i % 2) * 0.02), sm(kk)); s.position.y += Math.sin(Math.PI * kk) * 0.03; s.rotation.z = lerp(1.15, 0.2 + i, kk); });
        if (once(x, 'scr')) sfx.scrub();
        S.hands(x, S.wp(B.g, V(bx, 0.07, -0.14)), S.wp(B.bowl, V(0.06, 0.06, 0)));
      }
      if (fx.veg === 'onion' && u > 0.5 && once(x, 'cry')) S.g.toast('دمّعت عيونك من البصل 😢', '');
    },
    end(S, x, done) { S.restKnife(); if (done) { S.B.done = 1; S.B.veg.visible = false; } },
  },

  // ---------- dishes: plate in the left hand, sponge in the right; scrub, rinse, shake, rack ----------
  dishes: {
    begin(S, x) { S.resetDishes(true); S.D.pool.visible = true; S.focus(x.p, S.D.basin); x.p.workLean = 0.24; sfx.water(null); x.d.i = -1; },
    tick(S, x, u, dt) {
      const D = S.D, n = D.plates.length, [i, f] = split(u, n), pl = D.plates[n - 1 - i];
      for (let k = 0; k < i; k++) S.rackPlate(D.plates[n - 1 - k], k);
      const top = V(D.stack.x, D.stack.y + (n - 1 - i) * 0.013, D.stack.z), rinse = V(D.spout.x, TOP + 0.1, D.spout.z + 0.0), slot = V(D.rack.x + i * 0.05, D.rack.y, D.rack.z);
      S.fx.stream('water', D.spout, T1.set(D.spout.x, TOP + 0.03, D.spout.z), 1, 0.14);
      let spg = null;
      if (f < 0.18) { pl.position.copy(arc(top, D.basin, f / 0.18, 0.08)); pl.rotation.set(0.55 * sm(f / 0.18), 0, 0); } else if (f < 0.58) {            // scrub in circles
        pl.position.copy(D.basin); pl.rotation.set(0.55, Math.sin(x.t * 5) * 0.25, 0);
        const a = x.t * 15; spg = V(D.basin.x + Math.cos(a) * 0.055, D.basin.y + 0.035, D.basin.z + Math.sin(a) * 0.045 + 0.02);
        if (pl.userData.stains) pl.userData.stains.visible = f < 0.4;
        if (Math.random() < 0.55) S.fx.emit('foam', spg, { x: 0, y: 0.15, z: 0 }, 0.25);
        if (every(x, 's', dt, 0.2)) sfx.scrub();
      } else if (f < 0.76) {       // under the tap, turning it
        const k = (f - 0.58) / 0.18; pl.position.copy(arc(D.basin, rinse, Math.min(1, k * 2.5), 0.02)); pl.rotation.set(0.9, k * 5, 0);
        if (Math.random() < 0.7) S.fx.emit('splash', pl.position, { x: (Math.random() - 0.5) * 0.8, y: 0.5, z: -0.3 }, 0.6);
      } else if (f < 0.84) { pl.position.copy(rinse); pl.position.y += Math.sin((f - 0.76) / 0.08 * Math.PI * 3) * 0.035; pl.rotation.set(1.2, 0, 0); if (Math.random() < 0.5) S.fx.emit('splash', pl.position, { x: 0, y: -0.2, z: 0 }, 0.9); }      // shake it off
      else { const k = (f - 0.84) / 0.16; pl.position.copy(arc(rinse, slot, k, 0.08)); pl.rotation.set(1.2 * (1 - k), 0, (Math.PI / 2 - 0.22) * sm(k)); if (k > 0.9 && x.d.i !== i) { x.d.i = i; sfx.clink(); } }
      if (spg) D.sponge.position.copy(spg); else D.sponge.position.lerp(T1.set(D.basin.x - 0.16, TOP + 0.05, D.basin.z + 0.12), 0.2);
      S.hands(x, spg ? V(spg.x, spg.y + 0.04, spg.z - 0.02) : V(pl.position.x - 0.08, pl.position.y + 0.03, pl.position.z - 0.05), V(pl.position.x + 0.09, pl.position.y + 0.02, pl.position.z - 0.04));
    },
    end(S, x, done) { S.D.pool.visible = false; if (done) { S.D.plates.forEach((p, i) => S.rackPlate(p, S.D.plates.length - 1 - i)); S.fx.burst('spark', S.D.rack, 8, 0.5, 0.3); } else S.resetDishes(true); },
  },

  // ---------- face: cupped hands under the tap, up to the face, then the towel ----------
  washFace: {
    secs: 3.2,
    begin(S, x) { S.focus(x.p, V(4.9, 1.2, 3.2)); sfx.water({ x: 4.8, y: 1, z: 3.2 }); x.d.home = S.towel.position.clone(); },
    tick(S, x, u) {
      const c = x.c, f = fwd(c), r = rgt(c), sp = S.bathSpout, head = c.headPos(V(0, 0, 0));
      const face = V(head.x + f.x * 0.13, head.y - 0.03, head.z + f.z * 0.13), low = V(sp.x + 0.1, 0.93, sp.z);
      if (u < 0.74) {
        S.fx.stream('water', sp, { x: sp.x + 0.08, y: 0.88, z: sp.z }, 1, 0.12);
        const k = (u / 0.74 * 3) % 1, upk = sm(seg(k, 0.35, 0.6)) * (1 - sm(seg(k, 0.85, 1)));
        x.p.workLean = lerp(0.5, 0.2, upk);                                   // down to the basin, up with the water
        const t = arc(low, face, upk, 0);
        S.hands(x, V(t.x + r.x * 0.045, t.y, t.z + r.z * 0.045), V(t.x - r.x * 0.045, t.y, t.z - r.z * 0.045));
        if (upk > 0.95 && !x.d.m) { x.d.m = 1; S.fx.burst('splash', face, 9, 1.2, 0.2); sfx.splash(null); } if (upk < 0.3) x.d.m = 0;
      } else {
        x.p.workLean = 0.1; const k = seg(u, 0.74, 1), rub = Math.sin(x.t * 14) * 0.03;
        const t = k < 0.2 ? arc(x.d.home, face, k / 0.2, 0.1) : k > 0.85 ? arc(face, x.d.home, (k - 0.85) / 0.15, 0.1) : V(face.x + r.x * rub, face.y + 0.12 + rub, face.z + r.z * rub);
        S.towel.position.copy(t); if (once(x, 'tw')) sfx.flap();
        S.hands(x, V(t.x + r.x * 0.08, t.y - 0.12, t.z + r.z * 0.08), V(t.x - r.x * 0.08, t.y - 0.12, t.z - r.z * 0.08));
      }
    },
    end(S, x) { S.towel.position.copy(x.d.home); },
  },

  shower: {
    begin(S, x) { S.tween(0.35, (k) => S.setCurtain(k)); x.p.invisible = true; x.c.visible = false; S.focus(x.p, V(5.75, 1.3, 1.0)); sfx.water({ x: 6, y: 1.5, z: 0.8 }); },
    tick(S, x, u, dt) {
      const sh = S.showerHead;
      for (let i = 0; i < 4; i++) S.fx.emit('water', sh, { x: -1.6 - Math.random() * 1.2, y: -0.5, z: 0.4 + Math.random() * 0.6 }, 0.6);
      if (Math.random() < 0.5) S.fx.emit('steam', { x: 5.0 + Math.random() * 1.6, y: 1.9, z: 1.2 + Math.random() * 0.3 }, { x: 0, y: 0.35, z: 0.25 }, 0.2, 2.2);
      if (every(x, 's', dt, 1.4)) sfx.water({ x: 6, y: 1.5, z: 0.8 });
    },
    end(S, x) { S.tween(0.35, (k) => S.setCurtain(1 - k)); x.c.visible = true; for (let i = 0; i < 16; i++) S.fx.emit('steam', { x: 5.2 + Math.random() * 1.2, y: 1.2 + Math.random() * 0.8, z: 1.6 }, { x: 0, y: 0.4, z: 0.4 }, 0.3, 2.5); },
  },

  // ---------- bed: snap the blanket straight, smooth it with the palm, plump the pillow and set it ----------
  makeBed: {
    secs: 4.2,
    begin(S, x) { if (!S.M.bed) return; S.focus(x.p, V(S.M.bed.x, 0.7, S.M.bed.z + 0.3)); S.M.held = false; },
    tick(S, x, u, dt) {
      const M = S.M; if (!M.bed) return;
      const side = Math.sign(x.p.x - M.bed.x) || 1, edge = M.bed.x + side * 0.42;
      if (u < 0.42) {            // both hands on the near edge: lift, flick, let the wave run to the far side
        const f = u / 0.42, flick = Math.sin(Math.min(1, f * 1.4) * Math.PI);
        S.setBed(1 - sm(f) * 0.72, flick * 0.14, f * 9);
        x.p.workLean = 0.42 - flick * 0.12;
        const y = 0.66 + flick * 0.22;
        S.hands(x, V(edge, y, M.bed.z + 0.75), V(edge, y, M.bed.z + 0.05));
        if (once(x, 'f1')) sfx.flap(); if (f > 0.55 && once(x, 'f2')) { sfx.flap(); S.fx.burst('dust', V(M.bed.x, 0.75, M.bed.z + 0.4), 4, 0.6, 0.25, 0.6); }
      } else if (u < 0.76) {     // long strokes with the flat of the hand, foot to head
        const f = (u - 0.42) / 0.34, st = (f * 3) % 1;
        S.setBed(0.28 * (1 - sm(f)), 0, 0);
        x.p.workLean = 0.52;
        const z = M.bed.z + lerp(0.95, -0.2, sm(st)), xx = M.bed.x + side * lerp(0.3, -0.05, Math.floor(f * 3) / 2);
        S.hands(x, V(xx, 0.635, z), V(xx + side * 0.05, 0.64, z + 0.24));
        if (st < 0.1 && every(x, 'sw', dt, 0.3)) sfx.sweep(null);
      } else {                   // the pillow: pick it up, two pats, put it at the head
        const f = (u - 0.76) / 0.24; S.setBed(0, 0, 0); M.held = true;
        const from = x.d.pf || (x.d.pf = M.pillow.position.clone()), home = V(M.bed.x, 0.66, M.bed.z - 0.72), mid = V(M.bed.x + side * 0.25, 1.0, M.bed.z - 0.2);
        const pat = f > 0.35 && f < 0.7 ? Math.abs(Math.sin((f - 0.35) / 0.35 * Math.PI * 2)) : 0;
        const pos = f < 0.35 ? arc(from, mid, f / 0.35, 0.05) : f < 0.7 ? mid : arc(mid, home, (f - 0.7) / 0.3, 0.08);
        M.pillow.position.copy(pos); M.pillow.rotation.set(0, lerp(M.pillow.rotation.y, 0, 0.15), 0); M.pillow.scale.set(1 - pat * 0.12, 1 + pat * 0.25, 1);
        x.p.workLean = f > 0.7 ? 0.45 : 0.15;
        S.hands(x, V(pos.x, pos.y + 0.02, pos.z + 0.17 - pat * 0.05), V(pos.x, pos.y + 0.02, pos.z - 0.17 + pat * 0.05));
        if (pat > 0.9 && every(x, 'pt', dt, 0.15)) sfx.thud({ x: pos.x, y: 1, z: pos.z });
      }
    },
    end(S, x, done) { const M = S.M; if (!M.bed) return; M.held = false; M.pillow.scale.set(1, 1, 1); if (done) { S.setBed(0); M.blanket.visible = M.pillow.visible = false; S.fx.burst('spark', V(M.bed.x, 0.75, M.bed.z + 0.3), 10, 1.2, 0.4); M.bed = null; } else S.setBed(Math.max(0.35, M.v)); },
  },

  // ---------- laundry off the floor: squat, one piece at a time into the basket ----------
  gatherLaundry: {
    secs: 3.2,
    begin(S, x) { S.focus(x.p, S.wp(S.pile.g)); squat(x); x.d.n = -1; },
    tick(S, x, u) {
      const pl = S.pile, n = pl.clothes.length, [i, f] = split(u, n, 0.06, 0.98), c = pl.clothes[i];
      for (let k = 0; k < i; k++) pl.clothes[k].visible = false;
      pl.basket.userData.fill(i / n);
      const at = pl.g.localToWorld(c.userData.home.clone()).setY(0.06), bk = S.wp(pl.basket).setY(0.34);
      // reach, pinch, carry over, drop
      const hand = f < 0.45 ? arc(bk, at, f / 0.45, 0.12) : arc(at, bk, (f - 0.45) / 0.55, 0.22);
      if (f >= 0.45) { c.position.copy(pl.g.worldToLocal(hand.clone())); c.position.y -= 0.06; c.rotation.set(-0.4, f * 6, 0.5); c.scale.setScalar(lerp(0.7, 0.5, f)); if (x.d.n !== i) { x.d.n = i; sfx.flap(); } }
      S.hands(x, hand, f > 0.6 ? V(bk.x, 0.34, bk.z + 0.2) : null);
      S.look(x, hand);
    },
    end(S, x, done) { const pl = S.pile; if (done) pl.g.visible = false; else { pl.basket.userData.fill(0); pl.clothes.forEach((c) => { c.visible = true; c.position.copy(c.userData.home); c.rotation.set(-Math.PI / 2, 0, 1); c.scale.setScalar(0.7); }); } },
  },

  // ---------- washer: squat at the door, feed it by hand, shut it, press start ----------
  loadWasher: {
    secs: 3.4,
    begin(S, x) { S.W.on = 0; x.d.g = S.ground(x, basketBeside(x)); S.focus(x.p, S.W.mouth); squat(x); x.d.n = 0; },
    tick(S, x, u) {
      const W = S.W, n = 5, from = V(x.d.g.x, 0.36, x.d.g.z), mouth = W.mouth;
      if (u < 0.1) { W.open = 1; if (once(x, 'o')) sfx.door({ x: 6.3, y: 0.5, z: 2.4 }); S.hands(x, null, S.wp(W.door, V(0.36, 0, 0.05))); return; }
      if (u < 0.8) {
        const [i, f] = split(u, n, 0.1, 0.8);
        if (!x.d.gm || x.d.gi !== i) { if (x.d.gm) S.root.remove(x.d.gm); x.d.gm = P.randomGarment(i + 1); x.d.gm.scale.setScalar(0.5); S.root.add(x.d.gm); x.d.gi = i; sfx.flap(); if (x.p.carrying) x.p.carrying.mesh.userData.fill(1 - (i + 1) / n); }
        const hand = f < 0.6 ? arc(from, mouth, f / 0.6, 0.18) : arc(mouth, from, (f - 0.6) / 0.4, 0.1);
        x.d.gm.visible = f < 0.6; x.d.gm.position.copy(hand); x.d.gm.position.y -= 0.08; x.d.gm.rotation.set(f * 4, f * 3, 0.4);
        S.hands(x, hand, null); S.look(x, hand);
        return;
      }
      if (x.d.gm) { S.root.remove(x.d.gm); x.d.gm = null; }
      if (u < 0.9) { W.open = 0; if (once(x, 'c')) sfx.doorShut({ x: 6.3, y: 0.5, z: 2.4 }); S.hands(x, null, V(mouth.x - 0.02, 0.5, mouth.z + 0.1)); return; }
      S.hands(x, S.wp(W.g, V(0.17, 0.78, 0.33)), null); if (once(x, 'k')) { sfx.click(); W.on = 22; }                 // the dial
    },
    end(S, x, done) { if (x.d.gm) S.root.remove(x.d.gm); S.W.open = 0; if (!done) { S.W.on = 0; if (x.p.carrying) x.p.carrying.mesh.userData.fill(1); } },
  },
  unloadWasher: {
    secs: 3.0,
    begin(S, x) { const W = S.W; W.on = 0; W.open = 1; sfx.door({ x: 6.3, y: 0.5, z: 2.4 }); S.focus(x.p, W.mouth); squat(x); const b = P.basket(0, true); b.position.copy(basketBeside(x)); S.root.add(b); x.d.b = b; },
    tick(S, x, u) {
      const n = 5, [i, f] = split(u, n, 0.08, 0.94), to = V(x.d.b.position.x, 0.36, x.d.b.position.z), mouth = S.W.mouth;
      if (!x.d.gm || x.d.gi !== i) { if (x.d.gm) S.root.remove(x.d.gm); x.d.gm = P.randomGarment(i + 3); x.d.gm.material = P.clothMat(new THREE.Color(x.d.gm.material.color).multiplyScalar(0.7).getHex()); x.d.gm.scale.setScalar(0.5); S.root.add(x.d.gm); x.d.gi = i; x.d.b.userData.fill(i / n); }
      const hand = f < 0.4 ? arc(to, mouth, f / 0.4, 0.1) : arc(mouth, to, (f - 0.4) / 0.6, 0.2);
      x.d.gm.visible = f >= 0.4; x.d.gm.position.copy(hand); x.d.gm.position.y -= 0.08; x.d.gm.rotation.set(f * 4, f * 3, 0.4);
      if (f >= 0.4 && x.d.fl !== i) { x.d.fl = i; sfx.flap(); S.fx.burst('splash', mouth, 3, 0.5, 0.2); }
      S.hands(x, hand, null); S.look(x, hand);
    },
    end(S, x) { if (x.d.gm) S.root.remove(x.d.gm); S.W.open = 0; S.root.remove(x.d.b); x.d.b = null; sfx.doorShut({ x: 6.3, y: 0.5, z: 2.4 }); },
  },

  // ---------- the line: bend for a piece, shake it out, up on the line, one peg, two pegs, step along ----------
  hang: {
    secs: 7.2, free: true,
    begin(S, x) { x.d.n = 6; x.d.i = -1; x.c.heading = 0; },
    tick(S, x, u, dt) {
      const L = S.L, n = x.d.n, c = x.c, p = x.p, [i, f] = split(u, n), slot = i + 1, sx = L.slots[slot].x;
      if (x.d.i !== i) {              // previous piece is up for good; next one comes out of the basket
        x.d.i = i; x.d.gm = P.randomGarment(i + 4); S.root.add(x.d.gm); x.d.peg = 0;
        if (p.carrying) p.carrying.mesh.userData.fill(1 - (i + 1) / n);
      }
      // side-step along the line, basket shuffled along by the foot
      c.pos.x += (sx - 0.05 - c.pos.x) * Math.min(1, dt * 3.5); c.pos.z += (L.z - 0.62 - c.pos.z) * Math.min(1, dt * 5);
      const g = S.ground(x, V(c.pos.x - 0.42, 0, c.pos.z + 0.12)), bk = V(g.x, 0.4, g.z), chest = V(c.pos.x, c.height * 0.72, c.pos.z + 0.3), line = V(sx, L.y, L.z);
      const gm = x.d.gm; let R, Lh;
      if (f < 0.2) {                  // down to the basket
        const k = f / 0.2; p.workLean = 0.62 * Math.sin(k * Math.PI * 0.5 + (k > 0.5 ? 0 : 0)); p.workLean = 0.62 * sm(Math.min(1, k * 1.6));
        const h = arc(chest, bk, Math.min(1, k * 1.4), 0); gm.position.copy(h); gm.scale.setScalar(0.3); gm.rotation.set(1.2, k * 3, 0.5); gm.visible = k > 0.7;
        R = V(h.x - 0.08, h.y, h.z); Lh = V(h.x + 0.08, h.y, h.z);
      } else if (f < 0.42) {          // stand, hold it by the shoulders and snap it out
        const k = (f - 0.2) / 0.22; p.workLean = 0.62 * (1 - sm(Math.min(1, k * 2)));
        const flap = Math.sin(k * Math.PI * 3) * (1 - k) * 0.5, h = arc(bk, chest, Math.min(1, k * 1.8), 0.1);
        gm.visible = true; gm.position.set(h.x, h.y + 0.12 + Math.abs(flap) * 0.12, h.z + 0.05); gm.scale.setScalar(lerp(0.3, 0.92, sm(k))); gm.rotation.set(flap, 0, 0);
        R = V(gm.position.x - 0.17, gm.position.y, gm.position.z - 0.02); Lh = V(gm.position.x + 0.17, gm.position.y, gm.position.z - 0.02);
        if (k > 0.3 && x.d.fl !== i) { x.d.fl = i; sfx.flap(); S.fx.burst('mist', gm.position, 5, 0.6, 0.1); }
      } else if (f < 0.6) {           // up onto the line
        const k = (f - 0.42) / 0.18, from = V(chest.x, chest.y + 0.12, chest.z + 0.05), h = arc(from, line, k, 0.05);
        gm.position.copy(h); gm.scale.setScalar(0.92); gm.rotation.set(0, 0, 0); p.workLean = -0.06 * k;
        R = V(h.x - 0.17, h.y - 0.02, h.z - 0.04); Lh = V(h.x + 0.17, h.y - 0.02, h.z - 0.04);
      } else {                        // left hand keeps it there, right hand does the pegs
        gm.position.copy(line); p.workLean = -0.06;
        if (x.d.peg === 0) { S.hangAt(slot, gm); L.slots[slot].pegs.forEach((q) => { q.visible = false; }); x.d.peg = 1; }
        const pegs = L.slots[slot].pegs, k = (f - 0.6) / 0.4, which = k < 0.5 ? 0 : 1, kk = (k * 2) % 1, target = pegs[which].position;
        const pocket = V(c.pos.x - 0.2, c.height * 0.55, c.pos.z + 0.12);
        R = arc(pocket, V(target.x, target.y + 0.02, target.z - 0.04), Math.min(1, kk * 1.7), 0.05);
        if (kk > 0.6 && !pegs[which].visible) { pegs[which].visible = true; sfx.peg(); }
        Lh = V(pegs[1].position.x + (which ? -0.12 : 0), L.y - 0.03, L.z - 0.04);
      }
      S.hands(x, R, Lh); S.look(x, gm.visible ? gm.position : bk);
      if (p.focus) p.focus.pos.set(sx, 1.5, L.z);
    },
    end(S, x, done) {
      const L = S.L;
      if (done) { L.slots.forEach((s) => s.pegs.forEach((q) => { q.visible = true; })); return; }
      for (let i = 1; i <= x.d.n; i++) S.unhangAt(i);
      if (x.d.gm && x.d.gm.parent) S.root.remove(x.d.gm);
      if (x.p.carrying) x.p.carrying.mesh.userData.fill(1);
    },
  },
  // ---------- taking it in: pegs off, fold it over the arm, into the basket ----------
  unhang: {
    secs: 5.4, free: true,
    begin(S, x) { const b = P.basket(0); b.position.set(x.c.pos.x - 0.42, 0, x.c.pos.z + 0.12); S.root.add(b); x.d.b = b; x.d.i = -1; x.d.took = []; x.c.heading = 0; },
    tick(S, x, u, dt) {
      const L = S.L, n = 6, c = x.c, p = x.p, [i, f] = split(u, n), slot = i + 1, s = L.slots[slot], sx = s.x;
      c.pos.x += (sx - 0.05 - c.pos.x) * Math.min(1, dt * 3.5); c.pos.z += (L.z - 0.62 - c.pos.z) * Math.min(1, dt * 5);
      x.d.b.position.set(c.pos.x - 0.42, 0, c.pos.z + 0.12);
      const bk = V(x.d.b.position.x, 0.38, x.d.b.position.z), line = V(sx, L.y, L.z), chest = V(c.pos.x, c.height * 0.7, c.pos.z + 0.28);
      if (x.d.i !== i) { x.d.i = i; x.d.gm = s.m; x.d.pegs = s.pegs.slice(); if (s.m) { x.d.took.push([slot, s.m.userData.kind, s.m.material.color.getHex()]); s.m = null; s.pegs = []; } x.d.b.userData.fill(i / n); }
      const gm = x.d.gm; if (!gm) return;
      let R, Lh;
      if (f < 0.34) {                 // pegs off, one then the other
        const which = f < 0.17 ? 0 : 1, pg = x.d.pegs[which]; p.workLean = -0.06;
        R = V((pg ? pg.position.x : sx), L.y + 0.02, L.z - 0.04); Lh = V(sx + 0.12, L.y - 0.03, L.z - 0.04);
        const kk = (f / 0.17) % 1; if (pg && pg.parent && kk > 0.55) { S.root.remove(pg); sfx.peg(); }
      } else if (f < 0.66) {          // down off the line and folded in half
        const k = (f - 0.34) / 0.32, h = arc(line, chest, k, 0.04);
        gm.position.copy(h); gm.position.y += 0.1; gm.scale.set(0.92 * (1 - 0.45 * sm(k)), 0.92 * (1 - 0.35 * sm(k)), 0.92); gm.rotation.set(-0.5 * sm(k), 0, 0); p.workLean = 0;
        R = V(h.x - 0.15 * (1 - 0.5 * k), h.y + 0.08, h.z - 0.03); Lh = V(h.x + 0.15 * (1 - 0.5 * k), h.y + 0.08, h.z - 0.03);
        if (k > 0.4 && x.d.fl !== i) { x.d.fl = i; sfx.flap(); }
      } else {                        // and into the basket
        const k = (f - 0.66) / 0.34, h = arc(chest, bk, k, 0.05); p.workLean = 0.6 * sm(Math.min(1, k * 1.5));
        gm.position.copy(h); gm.scale.setScalar(0.92 * lerp(0.6, 0.4, k)); gm.rotation.set(-0.5 - k, k * 2, 0);
        R = V(h.x - 0.07, h.y, h.z); Lh = V(h.x + 0.07, h.y, h.z);
        if (k > 0.92 && gm.parent) { S.root.remove(gm); x.d.b.userData.fill((i + 1) / n); }
      }
      S.hands(x, R, Lh); S.look(x, gm.parent ? gm.position : bk);
      if (p.focus) p.focus.pos.set(sx, 1.5, L.z);
    },
    end(S, x, done) { if (x.d.gm && x.d.gm.parent) S.root.remove(x.d.gm); for (const q of x.d.pegs || []) if (q.parent) S.root.remove(q); S.root.remove(x.d.b); x.d.b = null; if (!done) for (const [i, kind, color] of x.d.took) S.hangAt(i, P.garment(kind, color)); },
  },
  // clean clothes (or toys) from the basket onto the wardrobe shelves, a piece per hand trip
  // door open, basket down beside you; one piece at a time: out of the basket, folded against the chest, onto the shelf
  putAway: {
    secs: 4.0,
    begin(S, x) {
      const W = S.w.wardrobes[S.self.wardrobe], it = x.p.carrying; x.d.W = W; x.d.toys = !!it && it.item === 'toys';
      x.d.g = x.d.toys ? it.mesh.getWorldPosition(V(0, 0, 0)) : S.ground(x, basketBeside(x, -0.5, 0.2));
      S.tween(0.35, (k) => W.set(sm(k))); sfx.door(W.bay); S.focus(x.p, V(W.bay.x, 0.9, W.bay.z), -1); x.d.pile = []; x.d.i = -1;
    },
    tick(S, x, u) {
      const W = x.d.W, c = x.c, f = fwd(c), r = rgt(c), chest = V(c.pos.x + f.x * 0.3, c.height * 0.62, c.pos.z + f.z * 0.3);
      const slot = (y) => V(lerp(W.inside.x, W.bay.x, 0.25), y, lerp(W.inside.z, W.bay.z, 0.25));
      if (u > 0.92) W.set(1 - sm(seg(u, 0.92, 1)));
      if (x.d.toys) {                  // the whole armful goes on the lower shelf
        const it = x.p.carrying, to = slot(0.47), pos = u < 0.25 ? x.d.g : arc(x.d.g, to, seg(u, 0.25, 0.75), 0.1);
        it.grounded = pos.clone(); it.custom = true; it.hide = u > 0.9; x.p.workLean = 0.4 * sm(seg(u, 0.3, 0.7)) * (1 - seg(u, 0.8, 0.95));
        S.hands(x, u < 0.85 ? V(pos.x + r.x * 0.1, pos.y + 0.06, pos.z + r.z * 0.1) : null, u < 0.85 ? V(pos.x - r.x * 0.1, pos.y + 0.06, pos.z - r.z * 0.1) : null); S.look(x, pos); return;
      }
      const n = 4, [i, k] = split(u, n, 0.08, 0.92), from = V(x.d.g.x, 0.42, x.d.g.z), to = slot(W.shelfY + i * 0.047);
      if (x.d.i !== i) {
        x.d.i = i; const col = P.CLOTH_COLORS[(i * 3 + 2) % P.CLOTH_COLORS.length];
        x.d.gm = P.garment(['shirt', 'pants', 'towel', 'shirt'][i], col); x.d.gm.scale.setScalar(0.6); S.root.add(x.d.gm);
        x.d.fold = P.rbox(0.27, 0.045, 0.23, 0.02, P.clothMat(col)); x.d.fold.rotation.y = c.heading; S.root.add(x.d.fold); x.d.pile.push(x.d.gm, x.d.fold);
        if (x.p.carrying && x.p.carrying.mesh.userData.fill) x.p.carrying.mesh.userData.fill(1 - (i + 1) / n);
      }
      const gm = x.d.gm, fold = x.d.fold;
      let h, wide = 0.06;
      if (k < 0.22) { h = arc(to, from, k / 0.22, 0.1); x.p.workLean = 0.6 * sm(k / 0.22); gm.visible = fold.visible = false; }                 // down to the basket
      else if (k < 0.48) { const q = (k - 0.22) / 0.26; h = arc(from, chest, q, 0.06); x.p.workLean = 0.6 * (1 - sm(q)); gm.visible = true; fold.visible = false; gm.position.set(h.x, h.y + 0.12, h.z); gm.rotation.set(0, c.heading, 0); wide = 0.16; if (once(x, 'f' + i)) sfx.flap(); }   // held up by the shoulders
      else if (k < 0.66) { const q = (k - 0.48) / 0.18; h = chest; x.p.workLean = 0; gm.visible = q < 0.6; fold.visible = !gm.visible; gm.scale.set(0.6 * (1 - 0.5 * sm(q)), 0.6 * (1 - 0.6 * sm(q)), 0.6); gm.position.set(h.x, h.y + 0.12 - 0.08 * q, h.z); fold.position.copy(h); wide = lerp(0.16, 0.1, q); }   // folded in
      else { const q = (k - 0.66) / 0.34; h = arc(chest, to, q, 0.05); gm.visible = false; fold.visible = true; fold.position.copy(h); wide = 0.1; x.p.workLean = 0.15 * Math.sin(q * Math.PI); }   // and onto the pile
      S.hands(x, V(h.x + r.x * wide, h.y + 0.02, h.z + r.z * wide), V(h.x - r.x * wide, h.y + 0.02, h.z - r.z * wide)); S.look(x, h);
    },
    end(S, x) { for (const m of x.d.pile || []) S.root.remove(m); x.d.W.set(0); },
  },

  // ---------- rubbish: gather the neck of the bag, twist, knot, lift it out ----------
  tieTrash: {
    secs: 2.6,
    begin(S, x) { const N = S.N; N.bag.visible = true; N.bag.position.set(0, 0.06, 0); N.bag.rotation.set(0, 0, 0); S.focus(x.p, S.wp(N.k).setY(0.5)); squat(x); x.p.workLean = 0.25; },
    tick(S, x, u) {
      const N = S.N, c = x.c, lid = sm(seg(u, 0, 0.12));
      N.lid.rotation.x = -1.35 * lid;
      const neck = () => S.wp(N.bag, V(0, 0.42, 0));
      S.look(x, neck());
      if (u < 0.12) { S.hands(x, null, S.wp(N.lid, V(0, 0.03, 0.3))); return; }                                                    // lid up
      if (u < 0.42) { const k = (u - 0.12) / 0.3; N.bag.position.y = 0.06 + 0.08 * k; const w = neck(), r = 0.13 * (1 - sm(k)); S.hands(x, V(w.x - r, w.y, w.z), V(w.x + r, w.y, w.z)); if (once(x, 'r')) sfx.flap(); return; }       // gather the rim in
      if (u < 0.7) { const k = (u - 0.42) / 0.28, a = k * Math.PI * 4, w = neck(); N.bag.rotation.y = a; S.hands(x, V(w.x + Math.cos(a) * 0.05, w.y + 0.03, w.z + Math.sin(a) * 0.05), V(w.x - Math.cos(a) * 0.05, w.y - 0.02, w.z - Math.sin(a) * 0.05)); if (k > 0.5 && once(x, 'k')) sfx.flap(); return; }  // twist + knot
      // stand up, lifting it clear of the bin and round to your side
      if (once(x, 'up')) x.p.setPose('m_idle_neutral_01', { fade: 0.3 });
      const k = (u - 0.7) / 0.3, r = rgt(c), f = fwd(c), s = c.height / 1.72; x.p.workLean = 0.25 * (1 - sm(k));
      const home = S.wp(N.k).setY(0.14), top = S.wp(N.k).setY(0.5), side = V(c.pos.x + (f.x * 0.04 + r.x * 0.3) * s, 0.36 * s, c.pos.z + (f.z * 0.04 + r.z * 0.3) * s);
      N.bag.position.copy(N.k.worldToLocal(k < 0.45 ? arc(home, top, k / 0.45, 0) : arc(top, side, (k - 0.45) / 0.55, 0.08)));
      S.hands(x, neck(), null);
    },
    end(S) { const N = S.N; N.bag.visible = false; N.bag.position.set(0, 0.06, 0); N.lid.rotation.x = 0; },
  },
  // lid up with one hand, heave the bag up in front of you and over the rim with the other, let the lid drop
  dumpTrash: {
    secs: 2.4,
    begin(S, x) { S.focus(x.p, S.N.mouth); x.d.from = null; },
    tick(S, x, u) {
      const N = S.N, c = x.c, f = fwd(c), it = x.p.carrying, lidK = sm(seg(u, 0, 0.22)) * (1 - sm(seg(u, 0.8, 0.95)));
      N.ylid.rotation.z = 1.3 * lidK;
      const lidHand = S.wp(N.ylid, V(-0.5, 0.03, 0));
      if (once(x, 'cr')) sfx.door({ x: 21.4, y: 1, z: 8 });
      let R = null;
      if (it) {
        if (!x.d.from) x.d.from = it.mesh.getWorldPosition(V(0, 0, 0));
        const m = N.mouth, chest = V(c.pos.x + f.x * 0.3, Math.max(0.5, m.y - 0.3), c.pos.z + f.z * 0.3), over = V(m.x - f.x * 0.06, m.y + 0.2, m.z - f.z * 0.06), inside = V(m.x, m.y - 0.35, m.z);
        // up to the chest, over the rim, and let go
        const pos = u < 0.3 ? arc(x.d.from, chest, u / 0.3, 0) : u < 0.62 ? arc(chest, over, (u - 0.3) / 0.32, 0.1) : arc(over, inside, seg(u, 0.62, 0.76), 0);
        it.grounded = pos; it.custom = true; it.mesh.rotation.set(0, c.heading, 0); R = u < 0.66 ? V(pos.x, pos.y + 0.38, pos.z) : null;
        x.p.workLean = 0.3 * sm(seg(u, 0.25, 0.55)) * (1 - sm(seg(u, 0.7, 0.9)));
        if (u > 0.76 && once(x, 'th')) { sfx.thud({ x: 21.4, y: 0.5, z: 8 }); it.mesh.visible = false; }
      }
      if (u > 0.93 && once(x, 'sl')) sfx.doorShut({ x: 21.4, y: 1, z: 8 });
      S.hands(x, R, u > 0.04 && u < 0.9 ? lidHand : null);
    },
    end(S, x) { S.N.ylid.rotation.z = 0; if (x.p.carrying) { x.p.carrying.custom = false; x.p.carrying.mesh.visible = true; } },
  },

  // ---------- bucket: squat by the tap, turn it on, watch it fill, turn it off ----------
  fillBucket: {
    secs: 2.6,
    begin(S, x, fx) {
      const m = fx.can ? S.can : S.bucket; x.d.m = m; x.p.handProp = null; S.held = null;
      m.position.copy(S.Y.under); m.rotation.set(0, fx.can ? Math.PI : 0, 0); if (!fx.can) { m.userData.level(0); m.userData.foam(false); }
      S.focus(x.p, V(S.Y.under.x, 0.4, S.Y.under.z)); squat(x);
    },
    tick(S, x, u, dt, fx) {
      const on = u > 0.14 && u < 0.86, h = S.wp(S.tapHandle, V(0, 0.07, 0));
      S.tapHandle.rotation.y = sm(seg(u, 0.02, 0.14)) * 3 - sm(seg(u, 0.86, 0.98)) * 3;
      if (on) {
        if (once(x, 'p')) sfx.water({ x: 16.3, y: 0.5, z: 8 });
        S.fx.stream('water', S.Y.spout, V(S.Y.under.x, 0.1 + 0.2 * u, S.Y.under.z), 2, 0.2);
        if (!fx.can) x.d.m.userData.level(sm(seg(u, 0.14, 0.86)) * 0.85);
        if (Math.random() < 0.5) S.fx.emit('splash', V(S.Y.under.x, 0.18 + 0.15 * u, S.Y.under.z), { x: 0, y: 0.9, z: 0 }, 0.9);
        if (every(x, 's', dt, 0.8)) sfx.pour();
      }
      // one hand on the tap while it's being turned, the other steadies the bucket; then both to the handle
      S.hands(x, u < 0.2 || u > 0.8 ? h : null, u < 0.9 ? V(S.Y.under.x + 0.02, 0.3, S.Y.under.z - 0.17) : V(S.Y.under.x, 0.42, S.Y.under.z));
    },
    end(S, x, done, fx) {
      const m = x.d.m; S.tapHandle.rotation.y = 0;
      if (!done) { m.position.copy(fx.can ? S.Y.canHome : S.Y.bucketHome); return; }
      if (!fx.can) { m.userData.foam(true); S.bucketLevel = 0.85; }
      S.held = fx.can ? 'can' : 'bucket'; x.p.handProp = { mesh: m, side: fx.can ? 'R' : 'L', dy: fx.can ? -0.2 : -0.3 };
    },
  },

  // ---------- car: dip the sponge, scrub in overlapping circles low then high, then the bucket over it ----------
  washCar: {
    secs: 4.4,
    begin(S, x, fx) {
      const sp = S.w.spots[fx.spot], car = S.w.car, side = sp.x < car.x ? -1 : 1;
      x.d.side = side; x.d.surf = V(car.x + side * car.surf(0.8, sp.z - car.z), 0.8, sp.z); S.sponge.visible = true; S.focus(x.p, x.d.surf);
      const r = rgt(x.c); S.bucket.position.set(x.p.x + r.x * 0.5, 0, x.p.z + r.z * 0.5 + 0.1); S.bucket.rotation.set(0, 0, 0); x.d.bk = S.bucket.position.clone();
    },
    tick(S, x, u, dt) {
      const q = x.d.surf, side = x.d.side, bk = V(x.d.bk.x, 0.3, x.d.bk.z), p = x.p, car = S.w.car;
      const skin = (y, z) => car.x + side * (car.surf(y, z - car.z) + 0.012);       // the bodywork is not a flat wall
      const stand = () => { if (x.d.low !== 0) { x.d.low = 0; p.setPose('m_idle_neutral_01', { fade: 0.3 }); } }, crouch = () => { if (x.d.low !== 1) { x.d.low = 1; squat(x); } };
      const scrubAt = (k, y0, y1, w) => { const a = x.t * 8, r = 0.13, y = lerp(y0, y1, (Math.sin(k * Math.PI * 4) + 1) / 2) + Math.sin(a) * r * 0.6, z = q.z + lerp(-w, w, k) + Math.cos(a) * r; return V(skin(y, z), y, z); };
      const soap = (pos) => { if (every(x, 'f', dt, 0.07)) { const f = S.foam[S.foamN++ % S.foam.length]; f.visible = true; const fy = pos.y + (Math.random() - 0.5) * 0.1, fz = pos.z + (Math.random() - 0.5) * 0.14; f.position.set(skin(fy, fz), fy, fz); f.rotation.z = Math.PI / 2; f.scale.set(0.6 + Math.random() * 0.9, 0.3, 0.6 + Math.random() * 0.9); f.userData.z = q.z; } if (every(x, 's', dt, 0.24)) { sfx.scrub(); S.fx.emit('foam', pos, { x: side * 0.3, y: 0.2, z: 0 }, 0.4); } };
      const dip = (k) => { const pos = arc(S.sponge.position.clone(), bk, Math.sin(k * Math.PI), 0.05); if (k > 0.4 && k < 0.6 && Math.random() < 0.5) S.fx.emit('foam', bk, { x: 0, y: 0.4, z: 0 }, 0.4); return pos; };
      let pos, both = null; p.workLean = 0;
      // down on your haunches for the bucket and the doors, up on your feet for the glass and the roof line
      if (u < 0.1) { crouch(); pos = arc(V(p.x, 0.7, p.z), bk, Math.sin(u / 0.1 * Math.PI * 0.5), 0); if (once(x, 'd1')) sfx.splash(null); }
      else if (u < 0.42) { crouch(); p.workLean = 0.15; pos = scrubAt((u - 0.1) / 0.32, 0.42, 0.78, 0.38); soap(pos); }
      else if (u < 0.5) { crouch(); pos = dip((u - 0.42) / 0.08); if (once(x, 'd2')) sfx.splash(null); }
      else if (u < 0.78) { stand(); p.workLean = 0.08; pos = scrubAt((u - 0.5) / 0.28, 0.95, 1.3, 0.5); soap(pos); }
      else {                    // rinse: down for the bucket, both hands on the rim, up, swing, throw
        const k = (u - 0.78) / 0.22, grab = sm(seg(k, 0, 0.22)), sw = sm(seg(k, 0.22, 0.55)), th = sm(seg(k, 0.55, 0.75)), back = 1 - sm(seg(k, 0.8, 1));
        if (k < 0.24) crouch(); else stand();
        const lift = V(lerp(x.d.bk.x, p.x - side * 0.25, sw), lerp(0, 0.75, sw) + th * 0.35 * back, lerp(x.d.bk.z, p.z, sw));
        S.bucket.position.copy(lift).lerp(x.d.bk, 1 - back); S.bucket.rotation.set(0, 0, side * 1.5 * th * back);
        p.workLean = 0.15 * th; void grab;
        if (th > 0.3 && th < 1 && back === 1) { for (let i = 0; i < 6; i++) S.fx.emit('splash', V(lift.x + side * 0.2, lift.y + 0.25, lift.z + (Math.random() - 0.5) * 0.5), { x: side * (2.2 + Math.random()), y: 1.2 + Math.random(), z: (Math.random() - 0.5) * 2.5 }, 0.6, 1.6); if (once(x, 'thr')) { sfx.splash({ x: q.x, y: 1, z: q.z }); sfx.pour(); S.bucketLevel = Math.max(0.1, (S.bucketLevel || 0.85) - 0.25); S.bucket.userData.level(S.bucketLevel); } }
        if (th > 0.5) for (const f of S.foam) if (f.visible && Math.abs(f.userData.z - q.z) < 1.0) { f.scale.multiplyScalar(1 - dt * 6); f.position.y -= dt * 0.9; if (f.scale.x < 0.12) f.visible = false; }
        const rim = S.bucket.position;
        both = [V(rim.x, rim.y + 0.26, rim.z - 0.16), V(rim.x, rim.y + 0.26, rim.z + 0.16)];
        pos = S.sponge.position.clone().lerp(V(x.d.bk.x, 0.3, x.d.bk.z), 0.2);
      }
      S.sponge.position.copy(pos); S.sponge.rotation.set(0, 0, side * Math.PI / 2);
      if (both) S.hands(x, both[0], both[1]); else S.hands(x, V(pos.x - side * 0.05, pos.y, pos.z), null);
      S.look(x, both ? S.bucket.position : pos);
    },
    end(S, x, done) {
      S.sponge.visible = false; S.bucket.position.copy(x.d.bk); S.bucket.rotation.set(0, 0, 0);
      if (done) { for (const f of S.foam) if (f.visible && Math.abs(f.userData.z - x.d.surf.z) < 1.0) f.visible = false; S.fx.burst('spark', x.d.surf, 14, 1.4, 0.4); }
    },
  },

  // ---------- sweeping: short pulling strokes that really push the leaves into a heap, then the dustpan ----------
  sweep: {
    secs: 3.4,
    begin(S, x, fx) { const pile = S.piles[fx.i]; S.broom.visible = true; S.focus(x.p, V(pile.x, 0.2, pile.z)); x.d.h0 = x.c.heading; x.p.workLean = 0.2; for (const l of pile.leaves) l.userData.v = V(0, 0, 0); },
    tick(S, x, u, dt, fx) {
      const pile = S.piles[fx.i], p = x.p, c = x.c, f = fwd({ heading: x.d.h0 }), r = rgt({ heading: x.d.h0 });
      const heap = V(pile.x + r.x * 0.3 - f.x * 0.3, 0, pile.z + r.z * 0.3 - f.z * 0.3);            // near the right foot
      const world = (l) => pile.g.localToWorld(l.position.clone()), local = (w) => pile.g.worldToLocal(w.clone());
      let tip, lift = 0;
      if (u < 0.74) {
        const n = 6, [i, k] = split(u, n, 0, 0.74), a = (i / (n - 1) - 0.5) * 2.0;                   // fan of strokes, left to right
        const far = V(pile.x + Math.sin(a) * 0.55 * r.x + f.x * 0.35 * Math.cos(a), 0, pile.z + Math.sin(a) * 0.55 * r.z + f.z * 0.35 * Math.cos(a));
        const pull = k < 0.62; lift = pull ? 0 : Math.sin((k - 0.62) / 0.38 * Math.PI) * 0.09;
        tip = pull ? far.clone().lerp(heap, sm(k / 0.62)) : heap.clone().lerp(far, sm((k - 0.62) / 0.38));
        c.heading = x.d.h0 + Math.sin(u * n / 0.74 * Math.PI * 2) * 0.16;                              // the shoulders go with it
        if (pull && x.d.st !== i && k > 0.1) { x.d.st = i; sfx.sweep(null); }
        if (pull) {
          const vel = heap.clone().sub(far).multiplyScalar(1 / (0.62 * 0.74 * 3.4 / n));
          for (const l of pile.leaves) { const w = world(l); if (Math.hypot(w.x - tip.x, w.z - tip.z) < 0.24) { l.userData.v.set(vel.x * 0.85 + (Math.random() - 0.5) * 0.3, 0, vel.z * 0.85 + (Math.random() - 0.5) * 0.3); if (Math.random() < 0.08) S.fx.emit('dust', w, { x: 0, y: 0.3, z: 0 }, 0.5, 0.5); } }
        }
        pile.dust.material.opacity = 0.5 * (1 - u / 0.74);
        S.pan.visible = false;
      } else {                       // dustpan down by the heap, flick it in, lift
        const k = (u - 0.74) / 0.26, panAt = V(heap.x + r.x * 0.2, 0.012, heap.z + r.z * 0.2);
        if (k < 0.78) { if (once(x, 'sq')) squat(x); } else if (once(x, 'up')) p.setPose('m_idle_neutral_01', { fade: 0.3 });
        S.pan.visible = true; S.pan.position.copy(panAt); S.pan.position.y = 0.012 + sm(seg(k, 0.75, 1)) * 0.5; S.pan.rotation.set(0, x.d.h0 + Math.PI / 2, -0.25 * sm(seg(k, 0.75, 1)));
        const st = (k * 4) % 1; tip = V(heap.x - r.x * 0.25, 0, heap.z - r.z * 0.25).lerp(panAt, sm(Math.min(1, st * 1.6))); lift = st > 0.62 ? 0.06 : 0;
        if (st < 0.1 && every(x, 'sp', dt, 0.12)) sfx.sweep(null);
        p.workLean = 0.15;
        for (const l of pile.leaves) { const w = world(l), d = Math.hypot(w.x - panAt.x, w.z - panAt.z); if (d > 0.1 && k < 0.75) l.userData.v.set((panAt.x - w.x) * 4, 0, (panAt.z - w.z) * 4); if (k > 0.75) { l.position.copy(local(V(panAt.x + (Math.random() - 0.5) * 0.02, S.pan.position.y + 0.02, panAt.z))); l.userData.v.set(0, 0, 0); } }
      }
      // leaves slide and stop
      for (const l of pile.leaves) { const v = l.userData.v; if (v.lengthSq() > 1e-4) { l.position.x += v.x * dt; l.position.z += v.z * dt; l.rotation.z += dt * v.length() * 5; v.multiplyScalar(Math.max(0, 1 - dt * 7)); } }
      // broom from tip to top hand; lower hand does the pulling
      const low = u < 0.74 ? 0 : sm(seg(u, 0.74, 0.8)) * (1 - sm(seg(u, 0.94, 1)));          // on your haunches the broom is held short
      const top = V(p.x + f.x * 0.12 - r.x * 0.14, (1.18 - 0.42 * low) * (c.height / 1.72), p.z + f.z * 0.12 - r.z * 0.14);
      tip.y = 0.02 + lift;
      S.broom.position.copy(tip); S.broom.quaternion.setFromUnitVectors(V(0, 1, 0), top.clone().sub(tip).normalize());
      if (u < 0.74) S.hands(x, tip.clone().lerp(top, 0.55), tip.clone().lerp(top, 0.93)); else S.hands(x, tip.clone().lerp(top, 0.6), S.wp(S.pan, V(-0.3, 0.06, 0)));
      S.look(x, tip);
    },
    end(S, x, done, fx) {
      S.broom.visible = false; S.pan.visible = false; x.c.heading = x.d.h0; const pile = S.piles[fx.i];
      if (done) { pile.g.visible = false; pile.done = true; S.fx.burst('dust', V(pile.x, 0.3, pile.z), 6, 0.8, 0.3); } else { pile.leaves.forEach((l) => { l.visible = true; l.position.copy(l.userData.home); }); pile.dust.material.opacity = 0.5; }
    },
  },

  // ---------- watering: two hands on the can, tip it, soil darkens, leaves lift ----------
  waterPlant: {
    secs: 2.2,
    begin(S, x, fx) { const pl = S.PL[fx.i]; x.p.handProp = null; S.focus(x.p, V(pl.x, 0.5, pl.z)); x.d.v0 = pl.v || 0; },
    tick(S, x, u, dt, fx) {
      const pl = S.PL[fx.i], p = x.p, h = x.c.heading, can = S.can, tilt = sm(seg(u, 0.05, 0.25)) * (1 - sm(seg(u, 0.85, 1)));
      can.position.set(p.x + Math.sin(h) * 0.34, 0.74 + 0.06 * tilt, p.z + Math.cos(h) * 0.34); can.rotation.set(0, h - Math.PI / 2, -0.6 * tilt, 'YXZ');
      p.workLean = 0.12 + 0.12 * tilt;
      const sp = S.wp(can, can.userData.spout);
      if (tilt > 0.5) { for (let i = 0; i < 3; i++) S.fx.stream('water', sp, V(pl.x + (Math.random() - 0.5) * 0.2, 0.36, pl.z + (Math.random() - 0.5) * 0.2), 1, 0.28); if (every(x, 's', dt, 0.7)) sfx.pour(); S.setPlant(pl, Math.max(x.d.v0, sm(seg(u, 0.2, 0.9)))); }
      S.hands(x, S.wp(can, V(-0.16, 0.1, 0)), S.wp(can, V(0, 0.25, 0))); S.look(x, V(pl.x, 0.5, pl.z));
    },
    end(S, x, done, fx) { const pl = S.PL[fx.i]; if (done) { S.setPlant(pl, 1); S.fx.burst('spark', V(pl.x, 0.8, pl.z), 8, 0.8, 0.5); } },
  },

  // ---------- breakfast: tear the bread, scoop, eat, chew ----------
  breakfast: {
    begin(S, x) { S.breakfast.visible = true; S.breakfast.userData.eaten(0); S.focus(x.p, S.wp(S.breakfast)); },
    tick(S, x, u) {
      S.breakfast.userData.eaten(u);
      const c = x.c, f = fwd(c), r = rgt(c), k = (x.t * 1.25) % 1, plate = S.wp(S.breakfast), bread = V(plate.x - r.x * 0.2, plate.y + 0.05, plate.z - r.z * 0.2), dip = V(plate.x + r.x * 0.2, plate.y + 0.07, plate.z + r.z * 0.2);
      const mouth = c.headPos(V(0, 0, 0)).add(V(f.x * 0.11, -0.09, f.z * 0.11));
      const R = k < 0.25 ? arc(mouth, bread, k / 0.25, 0) : k < 0.5 ? arc(bread, dip, (k - 0.25) / 0.25, 0.06) : k < 0.72 ? arc(dip, mouth, (k - 0.5) / 0.22, 0.05) : mouth;
      x.p.workLean = k < 0.5 ? 0.22 : 0.1; c.talk = k > 0.72 ? 0.6 : 0;
      S.hands(x, R, V(bread.x, bread.y, bread.z + 0.04));
      if (k > 0.72 && !x.d.m) { x.d.m = 1; sfx.munch(); S.fx.burst('crumb', mouth, 2, 0.4, 0.1); } if (k < 0.5) x.d.m = 0;
    },
    end(S, x, done) { x.c.talk = 0; if (done) S.tween(1.5, () => {}, () => { S.breakfast.visible = false; }); },
  },

  // ---------- fridge: door held with one hand, lean in, take it off the shelf ----------
  fridgeTake: {
    secs: 1.6,
    begin(S, x, fx) { S.g.setDevice('fridge', true, 'player'); const it = S.F.items[fx.item]; x.d.it = it; x.d.home = it ? it.position.clone() : null; S.focus(x.p, S.F.front); },
    tick(S, x, u) {
      const it = x.d.it, c = x.c, f = fwd(c);
      if (!it) { S.hands(x, S.F.front, null); return; }
      const at = S.F.g.localToWorld(x.d.home.clone()), out = V(c.pos.x + f.x * 0.3, c.height * 0.62, c.pos.z + f.z * 0.3);
      x.p.workLean = (at.y < 0.6 ? 0.6 : 0.2) * Math.sin(Math.min(1, u * 1.3) * Math.PI);
      const hand = u < 0.5 ? arc(out, at, u / 0.5, 0.03) : arc(at, out, (u - 0.5) / 0.5, 0.06);
      if (u >= 0.5) { it.position.copy(S.F.g.worldToLocal(hand.clone())); if (once(x, 'tk')) sfx.pick(); }
      S.hands(x, V(hand.x, hand.y + 0.05, hand.z), u > 0.55 ? V(hand.x + 0.1, hand.y + 0.03, hand.z) : S.wp(S.w.devices.fridge.door, V(0.62, 1.0, 0.02))); S.look(x, hand);
    },
    end(S, x, done) { const it = x.d.it; if (!it) return; it.position.copy(x.d.home); if (done) it.visible = false; },
  },
  // the high cupboard: door swung open, a reach up on to the shelf (off the step stool, if you are small), and out with it
  cupboard: {
    secs: 2.2,
    begin(S, x) { sfx.door({ x: 11.65, y: 1.8, z: 11.6 }); if (x.p.key === 'kid') { S.stool.visible = true; x.c.pos.set(S.stool.position.x, 0.28, S.stool.position.z); } S.focus(x.p, V(11.65, 1.75, 11.6)); },
    tick(S, x, u) {
      const open = sm(seg(u, 0.05, 0.32)) * (1 - sm(seg(u, 0.86, 1))); S.CB.door.rotation.y = 1.75 * open;
      if (x.p.key === 'kid') x.c.pos.y = 0.28;
      const c = x.c, f = fwd(c), handle = S.wp(S.CB.door, V(-0.45, 0.09, 0.04)), bar = S.wp(S.CB.bars.children[0]), chest = V(c.pos.x + f.x * 0.25, c.pos.y + c.height * 0.62, c.pos.z + f.z * 0.25);
      x.p.workLean = 0.42 * sm(seg(u, 0.28, 0.55)) * (1 - sm(seg(u, 0.66, 0.86)));          // up on your toes and in over the worktop
      // left hand opens it and holds it; right hand goes in for the bar and comes back with it
      const k = sm(seg(u, 0.32, 0.58)) * (1 - sm(seg(u, 0.66, 0.86))), R = V(lerp(chest.x, bar.x, k), lerp(chest.y, bar.y + 0.02, k), lerp(chest.z, bar.z, k));
      if (u > 0.58 && x.d.took !== 1) { x.d.took = 1; sfx.pick(); }
      const b = S.CB.bars.children[0]; if (u > 0.58) { b.visible = u < 0.84; S.CB.bars.worldToLocal(b.position.copy(R)); b.position.y -= 0.02; }
      S.hands(x, u > 0.3 ? R : null, u > 0.04 && u < 0.92 ? handle : null); S.look(x, u < 0.6 ? bar : R);
    },
    end(S, x, done) { S.CB.door.rotation.y = 0; S.stool.visible = false; x.c.pos.y = 0; const b = S.CB.bars.children[0]; b.position.set(0.14, 0.1, -0.06); b.visible = !done; },
  },
  // a heavy tray: knees first, both hands under the rim, then up
  liftTray: {
    secs: 1.6,
    begin(S, x) { S.focus(x.p, S.wp(S.mansaf)); x.d.y = S.mansaf.position.y; },
    tick(S, x, u) { const w = S.wp(S.mansaf), up = sm(seg(u, 0.55, 1)); x.p.workLean = 0.3 * (1 - up); S.mansaf.position.y = x.d.y + up * 0.1; S.hands(x, V(w.x - 0.05, w.y + 0.02, w.z - 0.3), V(w.x - 0.05, w.y + 0.02, w.z + 0.3)); },
    end(S, x, done) { S.mansaf.position.y = x.d.y; if (done) S.mansaf.visible = false; },
  },

  // sat at the desk: the bag stands open on one side, the books go in one at a time off the pile
  packBag: {
    secs: 3.0,
    begin(S, x) {
      const seat = S.w.seats[S.self.desk], h = seat.heading, f = V(Math.sin(h), 0, Math.cos(h)), r = V(-Math.cos(h), 0, Math.sin(h));
      x.p.setPose('m_sit_table_idle_neutral_01', { fade: 0.25 });
      S.bag.visible = true; S.bag.position.set(seat.x + f.x * 0.44 - r.x * 0.3, 0.762, seat.z + f.z * 0.44 - r.z * 0.3); S.bag.rotation.y = h + Math.PI;
      const pile = V(seat.x + f.x * 0.4 + r.x * 0.24, 0.772, seat.z + f.z * 0.4 + r.z * 0.24);
      x.d.books = [0, 1, 2, 3].map((i) => { const b = P.schoolBook(i); b.position.set(pile.x, pile.y + i * 0.026, pile.z); b.rotation.set(0, h + (i - 1.5) * 0.14, 0); b.userData.home = b.position.clone(); b.userData.ry = b.rotation.y; S.root.add(b); return b; });
      S.focus(x.p, S.bag.position); x.d.i = -1;
    },
    tick(S, x, u) {
      const n = 4, [j, f] = split(u, n, 0.06, 0.98), i = n - 1 - j, b = x.d.books[i], top = S.bag.position.clone().setY(S.bag.position.y + 0.36), r = rgt(x.c);
      for (let k = i + 1; k < n; k++) x.d.books[k].visible = false;
      const h = f < 0.25 ? arc(top, b.userData.home, f / 0.25, 0.08) : arc(b.userData.home, top, (f - 0.25) / 0.6, 0.16);
      if (f >= 0.25) { b.position.copy(h); b.rotation.set(f > 0.6 ? (f - 0.6) * 3.5 : 0, b.userData.ry, 0); }
      b.visible = f < 0.9;
      if (f > 0.85 && x.d.s !== i) { x.d.s = i; sfx.page(); }
      S.hands(x, V(h.x, h.y + 0.03, h.z), V(top.x - r.x * 0.14, top.y, top.z - r.z * 0.14)); S.look(x, h);
    },
    end(S, x, done) { for (const b of x.d.books || []) S.root.remove(b); if (done) S.tween(1.2, () => {}, () => { S.bag.visible = false; }); else S.bag.visible = false; },
  },
  // door open, a shirt off the rail, held up for a look, over the head and pulled down
  // ---------- getting changed, for real: the old top off over the head (the vest underneath), the new one on, then the
  // trousers: down on your haunches, feet in, pulled up. Each half of the body changes as its garment passes over it.
  dress: {
    secs: 7,
    begin(S, x) {
      const W = S.w.wardrobes[S.self.wardrobe], g = S.g, c = x.c, of = c.outfit && c.outfit.ok ? c.outfit : null;
      x.d.W = W; x.d.of = of; x.d.from = g.wearing || 'home'; x.d.to = g.dayWear(); x.d.stage = 0; x.d.low = 0;
      S.tween(0.35, (k) => W.set(sm(k))); sfx.door(W.bay); S.focus(x.p, V(W.bay.x, 1.3, W.bay.z), -1);
      const col = (part, name) => (of ? of.color(part, name) : P.CLOTH_COLORS[(g.dayIndex * 3 + 1) % P.CLOTH_COLORS.length]);
      const dressy = c.key === 'sis';
      x.d.one = dressy || !of || !(of.has('bottom', x.d.to) || of.has('bottom', x.d.from));       // a dress: nothing to pull up after
      x.d.oldTop = P.garment(dressy ? 'thobe' : 'shirt', col('top', x.d.from)); x.d.newTop = P.garment(dressy ? 'thobe' : 'shirt', col('top', x.d.to)); x.d.newBot = P.garment('pants', col('bottom', x.d.to));
      for (const m of [x.d.oldTop, x.d.newTop, x.d.newBot]) { m.visible = false; S.root.add(m); }
    },
    tick(S, x, u) {
      const W = x.d.W, c = x.c, p = x.p, of = x.d.of, f = fwd(c), r = rgt(c), s = c.height / 1.72, H = c.height, head = c.headPos(V(0, 0, 0));
      const at = (k, y) => V(c.pos.x + f.x * k, y, c.pos.z + f.z * k), side = (q, w, dy = 0) => [V(q.x + r.x * w, q.y + dy, q.z + r.z * w), V(q.x - r.x * w, q.y + dy, q.z - r.z * w)];
      const rail = V(W.inside.x, Math.min(W.railY, H * 1.05), W.inside.z), shelf = V(W.inside.x, W.shelfY + 0.06, W.inside.z), heap = V(W.inside.x, 0.2, W.inside.z);
      const front = at(0.36, H * 0.86), over = V(head.x + f.x * 0.1, head.y + 0.2, head.z + f.z * 0.1), worn = at(0.02, H * 0.84);
      const wear = (stage, top, bottom) => { if (x.d.stage < stage) { x.d.stage = stage; if (of) of.wear(top, bottom); sfx.flap(); } };
      const crouch = (on) => { if (x.d.low !== (on ? 1 : 2)) { x.d.low = on ? 1 : 2; if (on) squat(x); else p.setPose('m_idle_neutral_01', { fade: 0.3 }); } };
      const shirt = (gm, q, tilt, w = 0.17) => { gm.visible = true; gm.scale.setScalar(0.95 * s); gm.position.copy(q); gm.rotation.set(tilt, c.heading, 0, 'YXZ'); const [R, L] = side(q, w * s, -0.02); S.hands(x, R, L); };
      const one = x.d.one, B1 = 0.07, B2 = one ? 0.4 : 0.3, C2 = one ? 0.88 : 0.6;
      if (u < B1) { crouch(false); S.hands(x, null, null); S.look(x, rail); return; }
      if (u < B2) {                          // the old top: hands crossed to the hem, up over the head, into the bottom of the wardrobe
        const k = seg(u, B1, B2), gm = x.d.oldTop;
        if (k < 0.25) { const hem = at(0.12, H * 0.52), [R, L] = side(hem, -0.1 * s); S.hands(x, R, L); S.look(x, hem); return; }
        if (k < 0.62) { const q = seg(k, 0.25, 0.62); shirt(gm, arc(worn, over, q, 0.03), -1.1 * sm(q)); if (q > 0.3) wear(1, 'vest', x.d.from); S.look(x, front); return; }
        const q = seg(k, 0.62, 1), pos = arc(over, heap, q, 0.12); gm.visible = q < 0.97; gm.position.copy(pos); gm.rotation.set(-1.1 * (1 - q) - 0.6 * q, c.heading, 0.4 * q, 'YXZ');
        S.hands(x, V(pos.x, pos.y + 0.03, pos.z), null); S.look(x, heap); return;
      }
      x.d.oldTop.visible = false;
      if (u < C2) {                          // the new one: off the rail, held up by the shoulders, over the head, pulled down
        const k = seg(u, B2, C2), gm = x.d.newTop;
        if (k < 0.2) { S.hands(x, arc(front, rail, k / 0.2, 0.04), null); S.look(x, rail); return; }
        if (k < 0.42) { shirt(gm, arc(rail, front, (k - 0.2) / 0.22, 0.06), 0); S.look(x, gm.position); return; }
        if (k < 0.7) { const q = seg(k, 0.42, 0.7); shirt(gm, arc(front, over, q, 0.08), -1.1 * sm(q)); S.look(x, front); return; }
        const q = seg(k, 0.7, 1); shirt(gm, arc(over, worn, q, 0), -1.1 * (1 - sm(q)), lerp(0.17, 0.2, q)); if (q > 0.45) wear(2, x.d.to, one ? x.d.to : x.d.from); if (q > 0.96) gm.visible = false;
        S.look(x, front); return;
      }
      x.d.newTop.visible = false;
      if (!one && u < 0.9) {                 // the trousers: off the shelf, down on your haunches, feet in, up to the waist
        const k = seg(u, C2, 0.9), gm = x.d.newBot, low = at(0.2, 0.68 * s), held = at(0.3, H * 0.66);
        gm.scale.setScalar(s); gm.rotation.set(0, c.heading, 0, 'YXZ');
        if (k < 0.18) { gm.visible = false; S.hands(x, arc(front, shelf, k / 0.18, 0.03), null); S.look(x, shelf); return; }
        if (k < 0.34) { gm.visible = true; gm.position.copy(arc(shelf, held, (k - 0.18) / 0.16, 0.04)); S.hands(x, gm.position.clone(), null); S.look(x, gm.position); return; }
        if (k < 0.55) { crouch(true); const q = seg(k, 0.34, 0.55); gm.position.copy(arc(held, low, q, 0)); const [R, L] = side(gm.position, 0.13 * s); S.hands(x, R, L); S.look(x, low); return; }
        const q = seg(k, 0.55, 0.9), up = at(0.06, lerp(0.68 * s, H * 0.55, sm(q)));
        if (q > 0.35) crouch(false);
        gm.visible = q < 0.9; gm.position.copy(up); const [R, L] = side(up, 0.15 * s); S.hands(x, R, L);
        if (q > 0.55) wear(3, x.d.to, x.d.to); S.look(x, front); return;
      }
      x.d.newBot.visible = false; crouch(false);
      W.set(1 - sm(seg(u, 0.9, 1)));
      if (u < 0.96) { const [R, L] = side(at(0.1, H * 0.82), 0.07 * s); S.hands(x, R, L); S.look(x, null || front); } else S.hands(x, null, null);       // a tug at the collar
    },
    end(S, x, done) {
      for (const m of [x.d.oldTop, x.d.newTop, x.d.newBot]) S.root.remove(m);
      x.d.W.set(0); S.hands(x, null, null);
      if (done) S.g.wearing = x.d.to;
      if (x.d.of) x.d.of.wear(S.g.wearing || 'home');            // walked off half dressed? then you never started
      if (done) S.fx.burst('spark', x.c.headPos(V(0, 0, 0)).setY(x.c.height * 0.65), 12, 1.6, 0.6);
    },
  },
  // ---------- talabat: the gate open, a hand out for the bag the captain holds over it, and it is yours ----------
  takeOrder: {
    secs: 2.2,
    begin(S, x) { const D = S.g.delivery; S.w.gate.target = 1; sfx.gate({ x: 22, y: 1, z: 6 }); D.hand(true); S.focus(x.p, V(22.0, 1.0, 6.0)); },
    tick(S, x, u) {
      const D = S.g.delivery, p = x.p, mid = V(21.98, 0.95, (p.z + 6.0) / 2), home = V(p.x + Math.sin(p.char.heading) * 0.28, 0.95, p.z + Math.cos(p.char.heading) * 0.28);
      if (u < 0.45) S.hands(x, arc(home, V(mid.x - 0.06, mid.y + 0.4, mid.z), u / 0.45, 0.05), null);
      else { if (once(x, 'take')) { D.handOver(); sfx.flap(); } S.hands(x, arc(V(mid.x - 0.06, mid.y + 0.4, mid.z), V(home.x, 1.0, home.z), seg(u, 0.45, 0.9), 0), null); }
      S.look(x, V(22.3, 1.55, 6.0));
    },
    end(S, x, done) { S.hands(x, null, null); S.w.gate.target = 0; if (!done) { S.g.delivery.hand(false); S.g.delivery.bagGone = false; } },
  },
  // onto a table: both hands under it, down with the knees (a low table) or the back, and let go
  setDown: {
    secs: 1.3,
    begin(S, x, fx) {
      const it = x.p.carrying, h = x.c.heading;
      if (fx.floor) { const [fx0, fz0] = S.w.nearestFree(x.c.pos.x + Math.sin(h) * 0.5, x.c.pos.z + Math.cos(h) * 0.5); x.d.to = V(fx0, 0.01, fz0); } else x.d.to = S.g.dropPoint(fx.item, S.g.spot(fx.at), fx.at);
      x.d.from = it ? it.mesh.position.clone() : x.d.to.clone(); x.d.lowT = x.d.to.y < 0.6; if (!fx.floor) S.focus(x.p, x.d.to);
    },
    tick(S, x, u) {
      const it = x.p.carrying; if (!it) return;
      const c = x.c, r = rgt(c), pos = arc(x.d.from, x.d.to, sm(seg(u, 0.08, 0.72)), 0.04), w = it.tray ? 0.2 : 0.07, lift = sm(seg(u, 0.8, 1)) * 0.12;
      if (x.d.lowT) { if (u > 0.3 && u < 0.78 && once(x, 'dn')) squat(x); if (u >= 0.78 && once(x, 'up')) x.p.setPose('m_idle_neutral_01', { fade: 0.25 }); x.p.workLean = 0.2 * sm(seg(u, 0.1, 0.6)) * (1 - sm(seg(u, 0.8, 1))); }
      else x.p.workLean = 0.5 * sm(seg(u, 0.1, 0.7)) * (1 - sm(seg(u, 0.85, 1)));
      it.grounded = pos; it.custom = true; it.mesh.rotation.set(0, c.heading, 0);
      S.hands(x, V(pos.x + r.x * w, pos.y + lift, pos.z + r.z * w), V(pos.x - r.x * w, pos.y + lift, pos.z - r.z * w)); S.look(x, pos);
      if (u > 0.72 && once(x, 'c')) sfx.clink();
    },
  },
  // a wet floor: down on your haunches with the cloth, round and round from the edge in, until it is gone
  wipe: {
    secs: 2.5, free: true,
    begin(S, x, fx) {
      const m = fx.mess, c = x.c, dx = m.x - c.pos.x, dz = m.z - c.pos.z, d = Math.hypot(dx, dz) || 1; x.d.m = m; x.d.at = V(m.x, 0.03, m.z);
      x.d.stand = V(m.x - dx / d * 0.42, 0, m.z - dz / d * 0.42); c.heading = Math.atan2(dx, dz); x.d.near = V(m.x - dx / d * 0.1, 0.03, m.z - dz / d * 0.1);
      squat(x); x.d.rag = P.rag(); S.root.add(x.d.rag); S.focus(x.p, x.d.at); x.d.s0 = m.mesh ? m.mesh.scale.x : 1;
    },
    tick(S, x, u, dt) {
      const c = x.c, at = x.d.at, q = Math.min(1, dt * 6); c.pos.x += (x.d.stand.x - c.pos.x) * q; c.pos.z += (x.d.stand.z - c.pos.z) * q;
      const a = x.t * 7, r = 0.15 * (1 - 0.5 * u), o = x.d.near, h = V(o.x + Math.cos(a) * r, 0.03, o.z + Math.sin(a) * r);
      x.d.rag.position.copy(h); x.d.rag.rotation.y = a;
      if (x.d.m.mesh) x.d.m.mesh.scale.setScalar(Math.max(0.02, x.d.s0 * (1 - 0.95 * sm(u))));
      x.p.workLean = 0.5; S.hands(x, V(h.x, 0.06, h.z), null); S.look(x, h);
      if (every(x, 's', dt, 0.35)) sfx.scrub();
    },
    end(S, x, done) { S.root.remove(x.d.rag); if (!done && x.d.m.mesh) x.d.m.mesh.scale.setScalar(x.d.s0); },
  },
  // something on a shelf or on the floor: down to it if it's low, both hands, in to the chest
  pickUp: {
    secs: 1.3, free: true,
    begin(S, x, fx) {
      const c = x.c, pr = fx.step && fx.step.prop, sp = fx.spot ? S.g.spot(fx.spot) : null; x.d.pr = pr || null;
      if (pr) {                  // walk the last step up to it and face it
        const dx = pr.position.x - c.pos.x, dz = pr.position.z - c.pos.z, d = Math.hypot(dx, dz) || 1;
        c.heading = Math.atan2(dx, dz); x.d.stand = V(pr.position.x - dx / d * 0.4, 0, pr.position.z - dz / d * 0.4); x.d.at = pr.position.clone();
      } else {
        if (sp) { c.heading = sp.face; x.d.stand = V(sp.x, 0, sp.z); } else x.d.stand = c.pos.clone();
        const f = fwd(c); x.d.at = V(x.d.stand.x + f.x * (fx.f || 0.5), fx.y || 1, x.d.stand.z + f.z * (fx.f || 0.5));
      }
      x.d.low = x.d.at.y < 0.5; S.focus(x.p, x.d.at);
    },
    tick(S, x, u, dt) {
      const c = x.c, f = fwd(c), r = rgt(c), at = x.d.at, q = Math.min(1, dt * 7);
      c.pos.x += (x.d.stand.x - c.pos.x) * q; c.pos.z += (x.d.stand.z - c.pos.z) * q;
      if (x.d.low && u > 0.12 && u < 0.7 && once(x, 'dn')) squat(x);
      if (x.d.low && u >= 0.7 && once(x, 'up')) x.p.setPose('m_idle_neutral_01', { fade: 0.3 });
      const chest = V(c.pos.x + f.x * 0.3, c.height * (x.d.low && u > 0.15 && u < 0.7 ? 0.36 : 0.6), c.pos.z + f.z * 0.3);
      const k = u < 0.48 ? sm(seg(u, 0.12, 0.48)) : 1 - sm((u - 0.48) / 0.52), h = V(lerp(chest.x, at.x, k), lerp(chest.y, at.y + 0.05, k), lerp(chest.z, at.z, k));
      if (u > 0.48 && x.d.pr) x.d.pr.position.set(h.x, h.y - 0.05, h.z);
      S.hands(x, V(h.x + r.x * 0.1, h.y, h.z + r.z * 0.1), V(h.x - r.x * 0.1, h.y, h.z - r.z * 0.1)); S.look(x, u < 0.48 ? at : h);
    },
    end(S, x, done) { if (!done && x.d.pr) x.d.pr.position.copy(x.d.at); },
  },
  // a small thing off the floor: drop to a crouch, one hand, up
  grab: {
    secs: 0.7,
    begin(S, x, fx) { const k = fx.at; x.d.at = V(k.x, (k.y || 0) + 0.05, k.z); x.d.m = k.mesh || null; x.d.home = x.d.m ? x.d.m.position.clone() : null; if (x.d.at.y < 0.5) squat(x); S.look(x, x.d.at); },
    tick(S, x, u) {
      const at = x.d.at, c = x.c, k = sm(seg(u, 0, 0.6)), up = sm(seg(u, 0.6, 1)), h = V(lerp(c.pos.x, at.x, k), lerp(0.5, at.y, k) + up * 0.3, lerp(c.pos.z, at.z, k));
      if (x.d.m && u > 0.6) x.d.m.position.set(h.x, h.y - 0.03, h.z);
      S.hands(x, h, null);
    },
    end(S, x, done) { if (!done && x.d.m && x.d.home) x.d.m.position.copy(x.d.home); },
  },
  // the front door: a hand on the lever, press it down, draw the door open
  openDoor: {
    secs: 1.2,
    begin(S, x) { x.d.d = S.w.doors.find((k) => k.id === 'main'); S.focus(x.p, V(16, 1.1, 5.5)); },
    tick(S, x, u) {
      const d = x.d.d, c = x.c, f = fwd(c), near = d.pivot.position.x > c.pos.x ? 1 : -1;
      const handle = d.pivot.localToWorld(V(d.handleX - Math.sign(d.handleX) * 0.05, 1.02 - 0.03 * sm(seg(u, 0.3, 0.45)), near * 0.07));
      const rest = V(c.pos.x + f.x * 0.25, c.height * 0.58, c.pos.z + f.z * 0.25), k = sm(seg(u, 0, 0.3)) * (1 - sm(seg(u, 0.85, 1)));
      S.hands(x, V(lerp(rest.x, handle.x, k), lerp(rest.y, handle.y, k), lerp(rest.z, handle.z, k)), null); S.look(x, handle);
      x.p.workLean = 0.12 * sm(seg(u, 0.05, 0.3)) - 0.16 * sm(seg(u, 0.4, 0.8));
      if (u > 0.3 && once(x, 'cl')) sfx.click();
    },
  },
  // quietly: door eased open, both hands feeling along the shelves
  rummage: {
    secs: 2.4,
    begin(S, x, fx) { const W = S.w.wardrobes[fx.id]; x.d.W = W; S.tween(0.6, (k) => W.set(sm(k))); S.focus(x.p, V(W.bay.x, 1.0, W.bay.z), -1); x.p.workLean = 0.2; },
    tick(S, x, u) {
      const W = x.d.W, a = x.t * 4.5, at = (y, ph) => V(W.inside.x + Math.sin(a + ph) * 0.09, y + Math.cos(a * 0.7 + ph) * 0.07, W.inside.z + Math.cos(a + ph) * 0.05);
      S.hands(x, at(0.98, 0), at(0.62, 2)); S.look(x, at(0.9, 0)); if (u > 0.85) W.set(1 - sm(seg(u, 0.85, 1)));
    },
    end(S, x) { x.d.W.set(0); },
  },
  perfume: {
    begin(S, x) { S.focus(x.p, S.perfume.position); x.d.home = S.perfume.position.clone(); },
    tick(S, x, u, dt) {
      const f = fwd(x.c), neck = x.c.headPos(V(0, 0, 0)).add(V(f.x * 0.25, -0.12, f.z * 0.25));
      S.perfume.position.lerp(u < 0.15 ? x.d.home : neck, 0.2);
      if (u > 0.25 && every(x, 's', dt, 0.5)) { sfx.spray(); for (let i = 0; i < 8; i++) S.fx.emit('mist', S.perfume.position, { x: -f.x * 1.2, y: 0.1, z: -f.z * 1.2 }, 0.6); }
      S.hands(x, V(S.perfume.position.x, S.perfume.position.y - 0.03, S.perfume.position.z), null);
    },
    end(S, x) { S.perfume.position.copy(x.d.home); },
  },
};
ACT.makeCoffee = ACT.makeTea;
const T1 = V(0, 0, 0);

// How long each job takes at the very least (a step may ask for longer).
export const FX_SECS = {};
for (const [k, a] of Object.entries(ACT)) if (a.secs) FX_SECS[k] = a.secs;
FX_SECS.makeCoffee = ACT.makeTea.secs;
