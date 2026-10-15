// Things that fall. A handful of loose bodies with gravity, a floor to bounce off and furniture to stop against:
// no stacking and no joints, just enough that what leaves your hands lands, tumbles and comes to rest.
import * as THREE from 'three';

const Q = new THREE.Quaternion(), E = new THREE.Euler();

export class Debris {
  constructor(parent, world) { this.root = new THREE.Group(); parent.add(this.root); this.w = world; this.items = []; }

  // o.vel: Vector3 (m/s) · o.spin: rad/s · o.r: how high its origin rests off the floor · o.bounce: 0..1
  // o.flat: true = ends up lying flat, 'side' = ends up on its side · o.life: seconds before it is cleared away
  // o.onHit(speed, item): every time it meets the floor · o.onRest(item): once, when it has stopped
  add(mesh, o = {}) {
    this.root.add(mesh);
    const it = { m: mesh, v: o.vel ? o.vel.clone() : new THREE.Vector3(), ax: new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.4, Math.random() - 0.5).normalize(),
      spin: o.spin ?? 6, r: o.r ?? 0.03, bounce: o.bounce ?? 0.3, flat: o.flat || false, life: o.life || 0, onHit: o.onHit, onRest: o.onRest, hits: 0, rest: false, t: 0, qt: null };
    this.items.push(it);
    return it;
  }
  remove(it) { if (!it) return; this.root.remove(it.m); const i = this.items.indexOf(it); if (i >= 0) this.items.splice(i, 1); it.gone = true; }
  clear() { for (const it of this.items) { this.root.remove(it.m); it.gone = true; } this.items = []; }

  update(dt) {
    for (const it of [...this.items]) {
      if (it.gone) continue;
      it.t += dt;
      const m = it.m;
      if (it.life && it.t > it.life) { m.scale.multiplyScalar(Math.max(0, 1 - dt * 5)); if (it.t > it.life + 0.5) { this.remove(it); continue; } }
      if (it.rest) { if (it.qt) { m.quaternion.slerp(it.qt, Math.min(1, dt * 12)); if (m.quaternion.angleTo(it.qt) < 0.01) it.qt = null; } continue; }
      const v = it.v;
      v.y -= 9.8 * dt;
      const px = m.position.x, pz = m.position.z;
      m.position.addScaledVector(v, dt);
      if (it.spin) m.quaternion.premultiply(Q.setFromAxisAngle(it.ax, it.spin * dt));
      // furniture and walls: near the floor a loose thing stops against them
      if (this.w && m.position.y < 0.45) {
        const bx = m.position.x, bz = m.position.z; this.w.collide(m.position, 0.05);
        if (Math.abs(m.position.x - bx) + Math.abs(m.position.z - bz) > 1e-4) { m.position.x = px; m.position.z = pz; v.x *= -0.25; v.z *= -0.25; }
      }
      if (m.position.y <= it.r) {
        m.position.y = it.r;
        if (v.y < -0.9) {
          const sp = -v.y; v.y = sp * it.bounce; v.x *= 0.7; v.z *= 0.7; it.spin *= 0.55; it.hits++;
          if (it.onHit) it.onHit(sp, it);
        } else {
          v.y = 0; const k = Math.max(0, 1 - dt * 5); v.x *= k; v.z *= k; it.spin *= Math.max(0, 1 - dt * 7);
          if (v.x * v.x + v.z * v.z < 0.005) {
            it.rest = true; it.spin = 0;
            if (it.flat) { E.setFromQuaternion(m.quaternion, 'YXZ'); it.qt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, E.y, it.flat === 'side' ? Math.PI / 2 : 0, 'YXZ')); }
            if (it.onRest) it.onRest(it);
          }
        }
      }
    }
  }
}
