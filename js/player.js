// The kid you play: movement, third-person camera, stamina, and what you are visibly doing.
import * as THREE from 'three';
import { A } from './assets.js';
import { input } from './input.js';
import { sfx } from './audio.js';
import { lerpAngle } from './char.js';
import { H } from './world.js';

const HOLD = { tea: 'tray', coffee: 'tray', cups: 'tray', kunafa: 'tray', mansaf: 'tray', laundry: 'basket', clothes: 'basket', wet: 'basket', water: 'cup', trash: 'bag', talabat: 'bag', slipper: 'side' };

export const TRAITS = {
  big: { name: 'سيف', role: 'الأخ الكبير · 16 سنة', walk: 2.1, run: 4.4, drain: 0.15, angerMult: 1.25, noise: 1, small: false,
    good: ['أسرع واحد بالبيت', 'نَفَسه طويل بالركض'], bad: ['أبوك حاطط عينه عليه', 'بيتحاسب عن خراب أخوه الصغير'] },
  kid: { name: 'حمودة', role: 'الصغير · 8 سنين', walk: 1.75, run: 3.5, drain: 0.24, angerMult: 0.85, noise: 0.6, small: true,
    good: ['بيتخبّى تحت التخت والطاولة', 'خطواته خفيفة', 'أبوك بيسامحه أكثر'], bad: ['بطيء', 'ما بيطول الرفوف العالية'] },
  sis: { name: 'سلمى', role: 'البنت · 12 سنة', walk: 2.0, run: 3.9, drain: 0.19, angerMult: 0.7, noise: 0.85, small: false,
    good: ['حبيبة بابا: أول غلطة مسامَحة', 'أبوها بيعصّب عليها أقل'], bad: ['أمها بتطلب منها شغل زيادة', 'أخوها الكبير بيفسد عليها'] },
};

const V = new THREE.Vector3(), V2 = new THREE.Vector3();

export class Player {
  constructor(game, char, key) {
    this.game = game; this.char = char; this.key = key; this.t = TRAITS[key];
    this.female = key === 'sis';
    this.state = 'free';            // free | busy | hidden | lecture | sit | frozen
    this.act = null;                // phone | ps | sleep | eat | study | tvwatch : what anyone looking at you sees
    this.yaw = Math.PI; this.pitch = 0.22; this.dist = 2.7;
    this.camPos = new THREE.Vector3(); this.camOverride = null;
    this.stamina = 1; this.winded = false;
    this.sneaking = false; this.running = false; this.moving = false; this.idleTime = 0; this.speed = 0;
    this.stepT = 0; this.noiseT = 0;
    this.carrying = null;           // { item, mesh, tray }
    this.hasPhone = true; this.phoneOut = false;
    this.hide = null;
    this.vx = 0; this.vz = 0; this.yawVel = 0;
    this.eye = key === 'kid' ? 1.15 : 1.45;
    this.anims = this.female
      ? { idle: 'f_idle_neutral_01', walk: 'f_walk_neutral_01', run: 'f_run_neutral_01', sneak: 'm_walk_slow_01' }
      : { idle: 'm_idle_neutral_01', walk: 'm_walk_fast_01', run: 'm_run_neutral_01', sneak: 'm_walk_slow_01' };
    this.pose = null;
  }
  get x() { return this.char.pos.x; }
  get z() { return this.char.pos.z; }
  get room() { return this.game.world.roomAt(this.x, this.z); }
  get crouched() { return this.sneaking || (this.hide && this.hide.kind === 'crouch'); }
  get eyeNow() { return this.crouched ? this.eye * 0.6 : this.eye; }
  get hidden() { return this.state === 'hidden'; }

  clipSpeed(name) { return A.clips.get(name, this.char.pelvis).speed * this.char.scale || 1; }

  setPose(anim, opts) { this.pose = anim; if (anim) this.char.play(anim, opts); }

  update(dt) {
    const g = this.game, c = this.char, w = g.world;
    // camera look
    const sens = input.touch ? 0.0042 : 0.0026;
    this.yaw -= input.lookX * sens;
    this.pitch = Math.max(-0.35, Math.min(1.1, this.pitch + input.lookY * sens));

    let mx = 0, my = 0;
    const canMove = this.state === 'free' && !c.down;
    if (canMove) { mx = input.mx; my = input.my; }
    if (input.pressed.has('sneak') && this.state === 'free') this.sneaking = !this.sneaking;
    if (input._sneakEl && input._sneakEl.classList.contains('on') !== this.sneaking) input._sneakEl.classList.toggle('on', this.sneaking);
    const mag = Math.hypot(mx, my);
    this.moving = mag > 0.15;
    const wantRun = input.run && this.moving && !this.sneaking && !this.winded && !(this.carrying && this.carrying.heavy);
    this.running = wantRun;
    this.runT = wantRun ? (this.runT || 0) + dt : Math.max(0, (this.runT || 0) - dt * 2);
    if (this.running) { this.stamina -= dt * this.t.drain; if (this.stamina <= 0) { this.stamina = 0; this.winded = true; } } else {
      this.stamina = Math.min(1, this.stamina + dt * (this.moving ? 0.11 : 0.2));
      if (this.winded && this.stamina > 0.35) this.winded = false;
    }
    let speed = 0;
    if (this.moving) {
      speed = (this.sneaking ? 1.0 : this.running ? this.t.run : this.t.walk) * Math.min(1, mag * 1.15);
      if (this.limp > 0) speed *= 0.6;
      // stick is camera-relative: forward = away from the camera
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      const dx = fx * my - fz * mx, dz = fz * my + fx * mx;
      const dl = Math.hypot(dx, dz) || 1, ease = Math.min(1, dt * 11);
      // ease into the new speed and direction instead of snapping to them
      this.vx += (dx / dl * speed - this.vx) * ease; this.vz += (dz / dl * speed - this.vz) * ease;
      c.pos.x += this.vx * dt; c.pos.z += this.vz * dt;
      if (Math.hypot(this.vx, this.vz) > 0.2) c.heading = Math.atan2(this.vx, this.vz);
      w.collide(c.pos, 0.25);
      this.idleTime = 0;
      if (this.phoneOut) this.phone(false);
    } else {
      // a step to come to rest
      const v = Math.hypot(this.vx, this.vz);
      if (v > 0.05 && canMove) { const k = Math.max(0, 1 - dt * 12); this.vx *= k; this.vz *= k; c.pos.x += this.vx * dt; c.pos.z += this.vz * dt; w.collide(c.pos, 0.25); } else this.vx = this.vz = 0;
      if (this.state === 'free' && !this.act) this.idleTime += dt; else this.idleTime = 0;
    }
    // on a phone the camera swings round behind you by itself as you walk; a drag still takes over
    if (input.touch && this.moving && canMove && !this.focus && this.lookIdle > 0.7 && my > -0.35) {
      const want = c.heading + Math.PI, d = Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw));
      const rate = Math.max(-1.0, Math.min(1.0, d * 1.5)) * Math.min(1, mag * 1.3);
      this.yawVel += (rate - this.yawVel) * Math.min(1, dt * 5);
      this.pitch += (0.27 - this.pitch) * Math.min(1, dt * 0.7);
    } else this.yawVel *= Math.max(0, 1 - dt * 8);
    this.yaw += this.yawVel * dt;
    this.speed = speed;
    if (this.limp > 0) this.limp -= dt;

    // animation
    c.leanTarget = this.workLean != null ? this.workLean : this.sneaking && this.state === 'free' ? 0.42 : 0;
    this.lookIdle = input.lookX || input.lookY ? 0 : (this.lookIdle || 0) + dt;
    if (!this.pose && !c.down) {
      if (this.moving) {
        const name = this.sneaking ? this.anims.sneak : this.running ? this.anims.run : this.limp > 0 ? 'm_walk_bruised' : this.anims.walk;
        c.play(name, { speed: Math.max(0.5, speed / this.clipSpeed(name)), fade: 0.18 });
      } else c.play(this.sneaking ? 'm_crouch_idle' : this.anims.idle, { fade: 0.25 });
    }
    c.carry = false;
    if (this.phoneOut) c.overlay('m_cell_phone_textmessage', { mask: 'upper' });
    else if (!this.overlayLock) c.overlay(null);

    // footsteps + noise
    if (this.moving && !c.down) {
      this.stepT -= dt * (this.running ? 3.4 : this.sneaking ? 1.2 : 2.1);
      if (this.stepT <= 0) { this.stepT = 1; if (!this.sneaking) sfx.step(null, this.running ? 1.5 : 0.7); }
      this.noiseT -= dt;
      if (this.noiseT <= 0) {
        this.noiseT = 0.35;
        // a short dash is only footsteps: it takes a proper run before the house hears it
        const loud = this.running && this.runT > 0.9;
        const r = (loud ? 6 : this.running ? 3 : this.sneaking ? 0 : 2.4) * this.t.noise;
        if (r > 0) g.noise(this.x, this.z, r, loud ? 'run' : 'walk', 'player');
      }
    }
    if (this.tapT > 0) { this.tapT -= dt; c.reachTo('R', this.tapPos); if (this.tapT <= 0) c.reachTo('R', null); }      // a finger on the switch
    if (this.carrying) this.hold(dt); else if (this.holding) { this.holding = false; c.release(); }
    // a bucket or a watering can swinging from one hand
    if (this.handProp) { const m = this.handProp.mesh; c.handPos(this.handProp.side, m.position); m.position.y = Math.max(0, m.position.y + this.handProp.dy); m.rotation.set(0, c.root.rotation.y, 0); }
    c.update(dt);
    // a gripped glass goes where the fist ended up this frame
    const it = this.carrying; if (it && it.inFist && !c.down && (it.custom || (!it.grounded && !this.pose))) c.gripPos(it.mesh.position);
  }

  // What you carry decides how you carry it. The thing is placed against the body where a person would
  // hold it, it bobs with the walk, and the hands are put on it.
  hold(dt) {
    const c = this.char, it = this.carrying, m = it.mesh, k = c.height / 1.72;
    m.visible = !it.hide && (c.visible || !!it.grounded);
    if (it.grounded) { m.position.copy(it.grounded); if (!it.custom) m.rotation.set(0, 0, 0); return; }
    if (this.pose || c.down) return;                 // a job is animating it
    const h = c.root.rotation.y, fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
    this.bobT = (this.bobT || 0) + dt * (this.moving ? this.speed * 3.1 : 0);
    const bob = this.moving ? Math.sin(this.bobT * 2) * 0.012 : Math.sin(c.time * 1.5) * 0.004, sway = this.moving ? Math.sin(this.bobT) : 0;
    const at = (f, r, u) => m.position.set(c.pos.x + (fx * f + rx * r) * k, u * k + bob, c.pos.z + (fz * f + rz * r) * k);
    const grip = (side, r, u, f = 0) => c.reachTo(side, V.set(m.position.x + rx * r + fx * f, m.position.y + u, m.position.z + rz * r + fz * f));
    const style = HOLD[it.item] || 'hand';
    this.holding = true; if (style !== 'cup') c.grip = 0;
    if (style === 'tray') {            // level, at the navel, elbows in, a hand under each side of the rim
      const wide = it.item === 'mansaf' ? 0.3 : 0.2;
      at(it.item === 'mansaf' ? 0.42 : 0.36, 0, it.item === 'mansaf' ? 0.95 : 1.02); m.rotation.set(0, h, sway * 0.012);
      grip('R', wide, -0.005, -0.03); grip('L', -wide, -0.005, -0.03);
    } else if (style === 'basket') {   // against the belly, hands on the rim, leaning back a touch
      at(0.3, 0, 0.8); m.rotation.set(-0.07, h, 0, 'YXZ'); grip('R', 0.25, 0.29); grip('L', -0.25, 0.29);
    } else if (style === 'cup') {      // upright in front of the chest, elbow bent, the other arm free
      at(0.24, 0.17, 1.14); m.position.y -= bob * 0.5; c.reachTo('R', V.copy(m.position)); c.reachTo('L', null); c.grip = 1; m.rotation.set(0, h, 0); it.inFist = true;
    } else if (style === 'bag') {      // hanging from the fist at the side, swinging
      at(0.04 + sway * 0.05, 0.3, 0.36); m.rotation.set(sway * 0.09, h, 0.05, 'YXZ'); grip('R', 0, 0.4); c.reachTo('L', null);
    } else if (style === 'side') {     // in the hand, arm down
      at(0.05, 0.27, 0.8); m.rotation.set(0, h, 0); grip('R', 0, 0.02); c.reachTo('L', null);
    } else {                            // small things: in the hand, forearm level
      at(0.27, 0.14, 0.98); m.rotation.set(0, h, 0); grip('R', 0.02, -0.01, -0.03); c.reachTo('L', null);
    }
  }

  tap(pos) { this.tapT = 0.32; (this.tapPos || (this.tapPos = new THREE.Vector3())).copy(pos); }

  phone(on) {
    if (on && (!this.hasPhone || this.state !== 'free' || this.carrying)) return false;
    this.phoneOut = on;
    this.act = on ? 'phone' : (this.act === 'phone' ? null : this.act);
    return true;
  }

  // ---------- camera ----------
  camera(cam, dt) {
    const c = this.char, w = this.game.world;
    if (this.camOverride) {
      cam.position.lerp(this.camOverride.pos, Math.min(1, dt * 5));
      V.copy(this.camOverride.look); cam.lookAt(V);
      return;
    }
    // while you work, the camera drifts round to the side so you can see your hands
    const f = this.focus;
    if (f && this.lookIdle > 0.5) { this.yaw = lerpAngle(this.yaw, f.yaw, Math.min(1, dt * 2.6)); this.pitch += (0.52 - this.pitch) * Math.min(1, dt * 2.6); }
    const headY = c.lying ? c.pos.y + 0.35 : (this.crouched ? this.eye * 0.72 : this.eye) + 0.12;
    let tx = c.pos.x, tz = c.pos.z;
    if (c.lying) { tx -= Math.sin(c.heading) * c.height * 0.68; tz -= Math.cos(c.heading) * c.height * 0.68; }      // a sleeper's middle, not their feet
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    let dx = Math.sin(this.yaw) * cp, dz = Math.cos(this.yaw) * cp;       // from the head back to the camera
    // shoulder offset so the kid isn't dead centre
    const sx = Math.cos(this.yaw) * 0.32, sz = -Math.sin(this.yaw) * 0.32;
    const ox = tx + sx * 0.6, oz = tz + sz * 0.6;
    const flat = Math.hypot(dx, dz) || 1e-6;
    const maxFlat = (f ? 2.05 : this.dist) * flat;
    const outdoors = tx > 16.1;
    let d = f ? 2.05 : this.dist;
    const free = w.ray(ox, oz, dx / flat, dz / flat, maxFlat + 0.3, 1.5);
    if (free < maxFlat + 0.3) d = Math.max(0.35, (free - 0.22) / flat);
    let y = headY + sp * d;
    if (!outdoors && y > H - 0.18) { d = Math.max(0.35, (H - 0.18 - headY) / Math.max(0.05, sp)); y = headY + sp * d; }
    V.set(ox + dx * d, Math.max(0.25, y), oz + dz * d);
    this.camPos.lerp(V, Math.min(1, dt * 14));
    if (this.camPos.distanceToSquared(V) > 9) this.camPos.copy(V);
    cam.position.copy(this.camPos);
    V2.set(tx + sx, headY - 0.02, tz + sz);
    if (f) V2.lerp(f.pos, 0.6);
    if (!this.lookPos) this.lookPos = V2.clone();
    this.lookPos.lerp(V2, Math.min(1, dt * 7));
    if (this.lookPos.distanceToSquared(V2) > 4) this.lookPos.copy(V2);
    cam.lookAt(this.lookPos);
    // don't look through the back of your own head
    const near = d < (f ? 0.5 : 0.8);
    if (c.visible !== !near && !this.hidden && !this.invisible) c.visible = !near;
  }
}
