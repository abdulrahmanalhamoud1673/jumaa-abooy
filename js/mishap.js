// When something goes wrong it goes wrong properly: what you drop falls and tumbles, glass and china break,
// tea spreads across the tiles, the tray rings as it settles, and a wet floor takes your feet from under you.
import * as THREE from 'three';
import { Debris } from './phys.js';
import { sfx } from './audio.js';
import * as P from './props.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rnd = (a, b) => a + Math.random() * (b - a);
const GLASS = new THREE.MeshStandardMaterial({ color: 0xe6f6ff, roughness: 0.05, transparent: true, opacity: 0.6 });
const CHINA = P.MAT.porcelain, VASE = P.mat(0x2c6b8f, { rough: 0.2 });
const WET = new Set(['tea', 'juice', 'water', 'coffee', 'laban']);
// how likely each thing is to go when you run with it (per second), and what the game says when it does
export const RUN_RISK = { tea: 0.7, coffee: 0.6, cups: 0.5, water: 0.3, kunafa: 0.35, laban: 0.3 };
const SAY = { tea: 'انكبّ الشاي!', coffee: 'انكبّت القهوة… والدلّة عالأرض!', cups: 'الفناجين!! تكسّروا', water: 'انكسرت الكاسة!', kunafa: 'الكنافة عالأرض!!', laban: 'انكبّ اللبن!', mansaf: 'المنسف!!! يا ويلك' };
let shardGeo = null;

export class Mishaps {
  constructor(game) { this.g = game; this.debris = new Debris(game.scene, game.world); }
  reset() { this.debris.clear(); }
  update(dt) { this.debris.update(dt); this.slips(); }
  get fx() { return this.g.stations.fx; }

  // sharp little pieces flying out from where it broke; they lie there until somebody cleans up
  shards(at, n, material, size, bag) {
    if (!shardGeo) { shardGeo = new THREE.TetrahedronGeometry(0.03); shardGeo.scale(1, 0.22, 0.7); }
    for (let i = 0; i < n; i++) {
      const s = P.mesh(shardGeo, material); s.scale.setScalar(size / 0.03 * rnd(0.6, 1.5));
      s.position.set(at.x, Math.max(0.03, at.y), at.z);
      const a = Math.random() * 6.283, sp = rnd(0.5, 2.0);
      bag.push(this.debris.add(s, { vel: V(Math.cos(a) * sp, rnd(0.8, 2.1), Math.sin(a) * sp), spin: rnd(8, 20), r: 0.005, bounce: 0.3, flat: true }));
    }
  }
  // a puddle that spreads out from where the liquid landed
  mess(kind, x, z, bag) {
    const g = this.g, m = g.spawnMess(kind, x, z, 'player'); m.extra = bag;
    if (!m.portable && m.mesh) { m.mesh.scale.setScalar(0.06); g.stations.tween(0.9, (k) => { if (m.mesh) m.mesh.scale.setScalar(0.06 + 0.94 * k * (2 - k)); }); }
    return m;
  }
  clearExtra(m) { if (m && m.extra) { for (const it of m.extra) this.debris.remove(it); m.extra = null; } }

  // What you were carrying leaves your hands with whatever speed you had.
  fall(c, push) {
    const g = this.g, D = this.debris, m = c.mesh, item = c.item, bag = [];
    let mess = null, loud = false;
    const crash = (at, big) => { if (!loud) { loud = true; if (big) sfx.crash(at); else sfx.clink(at); g.noise(at.x, at.z, big ? 14 : 9, 'crash', 'player'); } else sfx.clink(at); };
    const pool = (kind, at) => { if (!mess && kind) mess = this.mess(kind, at.x, at.z, bag); };
    const toss = (spread = 0.6, up = [0.4, 1.2]) => V(push.x + rnd(-spread, spread), rnd(up[0], up[1]), push.z + rnd(-spread, spread));
    if (SAY[item]) g.toast(SAY[item], 'bad');

    if (c.tray && item !== 'mansaf' && item !== 'kunafa') {
      // a tray of glasses or cups: everything on it goes its own way, then the tray comes down ringing
      const liquid = item === 'tea' ? 'tea' : item === 'coffee' ? 'coffee' : null;
      m.updateMatrixWorld(true);
      [...m.children].slice(1).forEach((k, i) => {
        const wp = k.getWorldPosition(V(0, 0, 0)), wq = k.getWorldQuaternion(new THREE.Quaternion());
        m.remove(k); k.position.copy(wp); k.quaternion.copy(wq);
        const role = item === 'tea' ? (i < 3 ? 'glass' : i === 3 ? 'china' : 'soft') : item === 'coffee' && i === 0 ? 'metal' : 'china';
        bag.push(D.add(k, { vel: toss(), spin: rnd(5, 12), r: role === 'metal' ? 0.05 : 0.025, bounce: role === 'metal' ? 0.35 : 0.2, flat: role === 'metal' ? 'side' : false,
          onHit: (sp, it) => {
            const at = it.m.position.clone();
            if (role === 'metal') { sfx.clink(at); if (it.hits === 1) { crash(at, true); this.fx.burst('coffee', at, 10, 1.4, 0.4); pool(liquid, at); } return; }
            if (it.hits > 1 || role === 'soft') return;
            D.remove(it); crash(at, true);
            this.shards(at, role === 'glass' ? 6 : 4, role === 'glass' ? GLASS : CHINA, role === 'glass' ? 0.03 : 0.028, bag);
            if (role === 'glass' && liquid) { this.fx.burst(liquid, at, 9, 1.5, 0.4); pool(liquid, at); }
          } }));
      });
      bag.push(D.add(m, { vel: toss(0.3, [0.2, 0.7]), spin: rnd(5, 9), r: 0.012, bounce: 0.32, flat: true, onHit: (sp, it) => { sfx.clink(it.m.position); if (it.hits === 1) g.noise(it.m.position.x, it.m.position.z, 10, 'crash', 'player'); } }));
      if (!liquid) this.later(0.5, () => { if (!mess) { const at = m.position; mess = this.mess('plate', at.x, at.z, bag); } });
    } else if (item === 'water') {
      bag.push(D.add(m, { vel: toss(0.3), spin: rnd(6, 10), r: 0.03, bounce: 0.2, onHit: (sp, it) => {
        if (it.hits > 1) return; const at = it.m.position.clone(); D.remove(it); crash(at, true);
        this.shards(at, 8, GLASS, 0.035, bag); this.fx.burst('water', at, 14, 1.7, 0.45); pool('water', at);
      } }));
    } else if (['kunafa', 'laban', 'mansaf'].includes(item)) {
      // a dish of food: it turns over on the way down and what was on it stays on the floor
      bag.push(D.add(m, { vel: toss(0.2, [0.2, 0.6]), spin: rnd(3, 6), r: 0.015, bounce: 0.25, flat: true, onHit: (sp, it) => {
        sfx.clink(it.m.position); if (it.hits > 1) return;
        const at = it.m.position.clone(); crash(at, item === 'mansaf'); sfx.splash(at);
        it.m.children.slice(1).forEach((k) => { k.visible = false; }); if (it.m.userData.eaten) it.m.userData.eaten(1);
        this.fx.burst(item === 'laban' ? 'foam' : 'crumb', at, 14, 1.6, 0.5); pool(item, at);
      } }));
      if (item === 'mansaf') g.addAnger(18, 'mansaf');
    } else {
      // anything else just lands, rolls a bit and lies where it stopped, to be picked up again
      const basket = ['laundry', 'clothes', 'wet'].includes(item);
      if (basket) for (let i = 0; i < 5; i++) { const cl = P.randomGarment(i + 2); cl.scale.setScalar(0.6); cl.position.copy(m.position); cl.position.y += 0.25; cl.rotation.x = -Math.PI / 2; D.add(cl, { vel: toss(1.1, [0.6, 1.6]), spin: rnd(2, 5), r: 0.012, bounce: 0.05, flat: true, life: 14 }); }
      D.add(m, { vel: toss(0.25, [0.1, 0.5]), spin: basket ? 3 : rnd(3, 8), r: basket ? 0.02 : 0.03, bounce: 0.3, flat: true, onHit: (sp, it) => { if (it.hits === 1) { sfx.thud(it.m.position); g.noise(it.m.position.x, it.m.position.z, 6, 'crash', 'player'); } },
        onRest: (it) => { const [x, z] = g.world.nearestFree(it.m.position.x, it.m.position.z); D.remove(it); g.spawnPickup(item, x, z); } });
      return;
    }
    if (g.dad.seen && item === 'tea') g.dad.say('dad.cmd.spill', { loud: true });
    g.rewind(item);
  }
  later(s, fn) { this.g.later(s, fn); }

  // A vase goes over the way you were running, and breaks where it lands.
  vase(v) {
    const g = this.g, p = g.player, m = v.mesh, D = this.debris, bag = [];
    v.broken = true; g.stats.broke++;
    const dir = V(p.vx, 0, p.vz); if (dir.lengthSq() < 0.01) dir.set(Math.sin(p.char.heading), 0, Math.cos(p.char.heading)); dir.normalize();
    sfx.clink(m.position);
    D.add(m, { vel: V(dir.x * 1.5, 1.2, dir.z * 1.5), spin: 5, r: 0.02, bounce: 0.15, onHit: (sp, it) => {
      if (it.hits > 1) return;
      const at = it.m.position.clone(); D.remove(it);
      sfx.crash(at); g.noise(at.x, at.z, 15, 'crash', 'player');
      this.shards(at, v.big ? 12 : 8, VASE, v.big ? 0.06 : 0.045, bag);
      for (let i = 0; i < 4; i++) { const f = P.ball(0.03, P.mat(i % 2 ? 0xd24b6a : 0xf0c23a), at.x, 0.1, at.z); bag.push(D.add(f, { vel: V(rnd(-1, 1), rnd(0.6, 1.4), rnd(-1, 1)), spin: 6, r: 0.03, bounce: 0.2 })); }
      this.fx.burst('water', at, 12, 1.6, 0.4);
      const mess = g.spawnMess('vase', at.x, at.z, 'player'); mess.extra = bag;
      g.toast('كسرت المزهرية!! لمّها قبل ما يشوف… أو حطّها عند غيرك', 'bad');
    } });
  }

  // Run across something wet and you go down, with whatever you were holding.
  slips() {
    const g = this.g, p = g.player;
    if (!p.running || p.char.down || p.state !== 'free') return;
    for (const m of g.messes) {
      if (!WET.has(m.kind) || m.portable || (m.slipAt || -9) > g.now - 3 || Math.hypot(m.x - p.x, m.z - p.z) > 0.38) continue;
      m.slipAt = g.now;
      p.char.knockDown(1); p.limp = 2.5; g.shake = 0.3;
      sfx.thud({ x: p.x, y: 0.3, z: p.z }); sfx.ouch(g.playerKey === 'kid' ? 1.5 : g.playerKey === 'sis' ? 1.35 : 1);
      g.noise(p.x, p.z, 9, 'crash', 'player'); g.toast('تزحلقت! الأرض مبلولة', 'bad'); g.stats.slips = (g.stats.slips || 0) + 1;
      if (g.stay) g.exitStay(true);
      if (p.carrying) g.dropCarried(true);
      break;
    }
  }
}
