// A family member: skinned model + animation layers + the small procedural touches
// (head tracking, talking jaw, sneaking lean, throwing arm, falling over).
import * as THREE from 'three';
import { A } from './assets.js';

const UP = new THREE.Vector3(0, 1, 0), AXY = new THREE.Vector3(0, 1, 0), AXZ = new THREE.Vector3(0, 0, 1);
const GM = new THREE.Matrix4(), GQ = new THREE.Quaternion(), GP = new THREE.Quaternion();
// how far each joint of the right hand closes round a glass (radians, on top of the animation)
const CURL = [['R_Finger0', AXY, -0.42], ['R_Finger01', AXZ, 0.25], ...[1, 2, 3, 4].flatMap((f) => [[`R_Finger${f}`, AXZ, 0.34], [`R_Finger${f}1`, AXZ, 0.55], [`R_Finger${f}2`, AXZ, 0.4]])];
// a hand closing round a handle, per side: [bone, axis, radians at a full fist] (the left hand's joints are mirrored)
const FIST = (s, m) => [[`${s}_Finger0`, AXY, -0.5 * m], [`${s}_Finger01`, AXZ, 0.55 * m], [`${s}_Finger02`, AXZ, 0.45 * m],
  ...[1, 2, 3, 4].flatMap((f) => [[`${s}_Finger${f}`, AXZ, (0.95 + f * 0.06) * m], [`${s}_Finger${f}1`, AXZ, 1.3 * m], [`${s}_Finger${f}2`, AXZ, 0.85 * m]])];
const PQ = new THREE.Quaternion(), DQ = new THREE.Quaternion(), TQ = new THREE.Quaternion();
const V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3();
const IK1 = new THREE.Vector3(), IK2 = new THREE.Vector3(), IK3 = new THREE.Vector3(), IK4 = new THREE.Vector3(), IK5 = new THREE.Vector3(), IK6 = new THREE.Vector3();

const ARM = (s) => [`Bip01_${s}_Clavicle`, `Bip01_${s}_UpperArm`, `Bip01_${s}_Forearm`, `Bip01_${s}_Hand`];
const MASKS = {
  upper: ['Bip01_Spine1', 'Bip01_Spine2', 'Bip01_Neck', 'Bip01_Head', ...ARM('L'), ...ARM('R')],
  arms: [...ARM('L'), ...ARM('R')],
  rarm: ARM('R'),
  head: ['Bip01_Neck', 'Bip01_Head'],
};

// three's mixer skips writing a property whose animated value didn't change since its own last write.
// Here two mixers and the procedural tweaks all touch the same bones, so every frame must really write.
function forceWrite(mixer) {
  const list = mixer._bindings, n = mixer._nActiveBindings;
  for (let i = 0; i < n; i++) { const buf = list[i].buffer, s = list[i].valueSize; for (let k = s; k < s * 3; k++) buf[k] = NaN; }
}

export function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// A blanket drawn up over somebody lying down: a ridge down the middle where the body is, a bump for the feet.
let coverGeo = null, zTex = null;
function cover(color) {
  if (!coverGeo) {
    coverGeo = new THREE.PlaneGeometry(0.92, 1.5, 12, 24); coverGeo.rotateX(-Math.PI / 2);
    const p = coverGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i) / 1.5 + 0.5;                 // z: 0 at the chest edge, 1 past the feet
      // flat over the body and the arms beside it, falling away to the mattress at the edges
      const ax = Math.abs(x), e = ax < 0.2 ? 1 : ax > 0.43 ? 0 : 1 - ((ax - 0.2) / 0.23) ** 2 * (3 - 2 * (ax - 0.2) / 0.23);
      // chest high, a little lower over the legs, up again over the toes, then down past the feet
      const along = z < 0.07 ? 0.27 * (z / 0.07) : z < 0.3 ? 0.27 : z < 0.72 ? 0.27 - 0.07 * (z - 0.3) / 0.42 : z < 0.9 ? 0.2 + 0.13 * Math.sin((z - 0.72) / 0.18 * Math.PI) : 0.2 * Math.max(0, 1 - (z - 0.9) / 0.08);
      const mid = ax < 0.09 ? 1 : 1 - 0.12 * Math.min(1, (ax - 0.09) / 0.12);          // a shade lower over the arms than over the chest
      p.setY(i, 0.068 + along * e * mid + 0.006 * Math.sin(x * 40 + z * 23));
    }
    coverGeo.computeVertexNormals();
  }
  const m = new THREE.Mesh(coverGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.95, side: THREE.DoubleSide }));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function zzz() {
  if (!zTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    g.font = 'bold 54px "Segoe UI", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 7; g.strokeStyle = 'rgba(20,30,60,.85)'; g.strokeText('Z', 32, 34); g.fillStyle = '#fff'; g.fillText('Z', 32, 34);
    zTex = new THREE.CanvasTexture(c); zTex.colorSpace = THREE.SRGBColorSpace;
  }
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false, opacity: 0 }));
}
let blobTex = null;
function blob() {
  if (!blobTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    blobTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.renderOrder = 2;
  return m;
}

export class Character {
  constructor(key, { scale = 1 } = {}) {
    this.key = key;
    this.scale = scale;
    this.pelvis = A.avatars[key].pelvis;
    this.height = A.avatars[key].height / 100 * scale;
    this.root = new THREE.Group();
    this.tilt = new THREE.Group();
    this.model = A.models[key];
    this.tilt.scale.setScalar(scale);
    this.tilt.add(this.model);
    this.root.add(this.tilt);
    this.shadow = blob();
    this.shadow.scale.setScalar(scale);
    this.root.add(this.shadow);
    this.bones = {};
    this.meshes = [];
    this.model.traverse((o) => {
      if (o.isBone) this.bones[o.name.replace(/^Bip01_?/, '') || 'Root'] = o;
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; this.meshes.push(o);
        // hair cards and lashes: front faces only (lit from behind, the backs of the strands show as pale stripes across the head)
        for (const m of [].concat(o.material)) if (m.alphaTest > 0) { m.alphaTest = 0.35; m.side = THREE.FrontSide; }
      }
    });
    this.mixer = new THREE.AnimationMixer(this.model);
    this.over = new THREE.AnimationMixer(this.model);
    this.cur = ''; this.action = null; this.info = null;
    this.ovName = ''; this.ovAction = null; this.ovW = 0; this.ovTarget = 0; this.ovFade = 0.2; this.ovBones = [];
    this.ovSaved = [];
    this.heading = 0;                 // radians, 0 = facing +Z
    this.turnSpeed = 10;
    this.look = null;                 // world Vector3 the head follows
    this.lookYaw = 0; this.lookPitch = 0;
    this.lean = 0; this.leanTarget = 0;
    this.talk = 0;                    // 0..1 mouth activity
    this.anger = 0;                   // 0..1 frown
    this.setupFace();
    this.throwT = -1;                 // 0..1 while the arm throws
    this.reach = { R: { pos: new THREE.Vector3(), on: false, w: 0 }, L: { pos: new THREE.Vector3(), on: false, w: 0 } };
    this.grip = 0; this.gripW = 0;      // right hand closed round something upright (0..1)   // hand targets (world)
    this.hold = { R: 0, L: 0 }; this.holdW = { R: 0, L: 0 };      // how far each hand's fingers close round what it holds (0 open, 1 a fist)
    this.fallT = -1; this.fallDir = 1; this.lying = 0;
    this.time = Math.random() * 10;
    this.visible = true;
  }

  get pos() { return this.root.position; }

  // The rig's face bones have arbitrary local axes: work out, in each bone's own space, which way
  // "open the jaw" and "lower the brows" are.
  setupFace() {
    const B = this.bones;
    this.root.updateMatrixWorld(true);
    this.jawRest = null;
    if (B.MJaw) {
      this.jawRest = B.MJaw.quaternion.clone();
      const inv = B.MJaw.getWorldQuaternion(new THREE.Quaternion()).invert();
      this.jawAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(inv).normalize();
      const probe = B.MBottomLip || B.MTongue || B.MJaw.children[0];
      if (probe) {
        const y0 = probe.getWorldPosition(new THREE.Vector3()).y;
        B.MJaw.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(this.jawAxis, 0.3));
        B.MJaw.updateMatrixWorld(true);
        const y1 = probe.getWorldPosition(new THREE.Vector3()).y;
        if (y1 > y0) this.jawAxis.negate();
        B.MJaw.quaternion.copy(this.jawRest);
        B.MJaw.updateMatrixWorld(true);
      }
    }
    this.brows = ['LInnerEyebrow', 'RInnerEyebrow', 'MMiddleEyebrow', 'LOuterEyebrow', 'ROuterEyebrow'].filter((n) => B[n]).map((n) => {
      const inv = B[n].parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      const inner = /Inner|Middle/.test(n);
      // inner brows drop and pinch together, outer ones lift a little: a proper scowl
      const dir = new THREE.Vector3(/^L/.test(n) && inner ? -0.25 : /^R/.test(n) && inner ? 0.25 : 0, inner ? -1 : 0.35, 0).applyQuaternion(inv);
      return { bone: B[n], rest: B[n].position.clone(), dir };
    });
    // eyelids: the lid bones slide down the face (and the lower ones up a touch) to close the eye
    this.lids = []; this.blinkT = 1 + Math.random() * 4; this.blink = 0; this.sleepK = 0;
    const span = 0.0118 * this.height / 1.75, m3 = new THREE.Matrix3(), m4 = new THREE.Matrix4();
    for (const [n, k] of [['LEyeBlinkTop', -1], ['REyeBlinkTop', -1], ['LEyeBlinkBottom', 0.2], ['REyeBlinkBottom', 0.2]]) {
      const b = B[n]; if (!b) continue;
      const up = new THREE.Vector3(0, 1, 0).applyMatrix3(m3.setFromMatrix4(m4.copy(b.parent.matrixWorld).invert()));      // a metre up the face, in the bone's own parent space
      this.lids.push({ bone: b, rest: b.position.clone(), dir: up.multiplyScalar(span * k) });
    }
  }

  place(x, z, heading) {
    this.root.position.set(x, 0, z);
    if (heading !== undefined) { this.heading = heading; this.root.rotation.y = heading; }
  }

  play(name, { fade = 0.25, speed = 1, once = false, force = false } = {}) {
    if (this.cur === name && !force) { this.action.timeScale = speed; return this.action; }
    const info = A.clips.get(name, this.pelvis);
    const a = this.mixer.clipAction(info.clip);
    a.reset();
    a.setLoop(once || !info.loop ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = true;
    a.timeScale = speed;
    a.setEffectiveWeight(1);
    if (this.action && this.action !== a) { a.fadeIn(fade); this.action.fadeOut(fade); }
    a.play();
    this.action = a; this.cur = name; this.info = info;
    return a;
  }

  // Seconds left in a once-only clip (0 when looping or finished).
  remaining() {
    if (!this.action || this.action.loop !== THREE.LoopOnce) return 0;
    return Math.max(0, (this.info.duration - this.action.time) / Math.max(0.01, this.action.timeScale));
  }

  // Play a clip on part of the body over whatever the legs are doing. null clears it.
  overlay(name, { mask = 'upper', fade = 0.2, speed = 1, once = false } = {}) {
    this.ovFade = fade;
    if (!name) { this.ovTarget = 0; this.ovName = ''; return; }
    if (this.ovName === name + mask) { this.ovTarget = 1; return; }
    const key = `${name}|${mask}`;
    this._ovClips = this._ovClips || {};
    if (!this._ovClips[key]) {
      const src = A.clips.get(name, this.pelvis).clip;
      const want = new Set(MASKS[mask]);
      const tracks = src.tracks.filter((t) => {
        const bone = t.name.split('.')[0];
        return want.has(bone) || (mask !== 'head' && /Finger/.test(bone) && (mask !== 'rarm' || /_R_/.test(bone)));
      });
      this._ovClips[key] = new THREE.AnimationClip(key, src.duration, tracks);
    }
    if (this.ovAction) this.ovAction.stop();
    const a = this.over.clipAction(this._ovClips[key]);
    a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = true; a.timeScale = speed;
    a.play();
    this.ovAction = a; this.ovName = name + mask; this.ovTarget = 1;
    this.ovBones = this._ovClips[key].tracks.map((t) => this.model.getObjectByName(t.name.split('.')[0])).filter(Boolean);
    this.ovSaved = this.ovBones.map(() => new THREE.Quaternion());
  }

  rotateWorld(bone, q) {
    bone.parent.getWorldQuaternion(PQ);
    bone.quaternion.premultiply(PQ).premultiply(q).premultiply(PQ.invert());
  }

  // Swing `bone` so that the bone->child direction points along `dir` (world), blended by w.
  aim(bone, child, dir, w) {
    bone.getWorldPosition(V1); child.getWorldPosition(V2);
    V2.sub(V1).normalize();
    DQ.setFromUnitVectors(V2, dir);
    TQ.identity().slerp(DQ, w);
    this.rotateWorld(bone, TQ);
  }

  local(x, y, z, out = new THREE.Vector3()) {
    return out.set(x, y, z).applyAxisAngle(UP, this.root.rotation.y).normalize();
  }

  handPos(side = 'R', out = new THREE.Vector3()) { return this.bones[`${side}_Hand`].getWorldPosition(out); }
  headPos(out = new THREE.Vector3()) { return this.bones.Head.getWorldPosition(out); }

  // Put a hand on something: a world point the arm bends to reach (null lets go).
  // (k: how the fingers take it: about 0.6 for most things, ~0.9 a handle or a bag's straps, ~0.2 a flat hand on a surface)
  reachTo(side, p, k = 0.6) { const r = this.reach[side]; if (p) { r.pos.copy(p); r.on = true; this.hold[side] = k; } else { r.on = false; this.hold[side] = 0; } }
  release() { this.reach.R.on = this.reach.L.on = false; this.grip = 0; this.hold.R = this.hold.L = 0; }
  // Lie down on a bed: on your back, head on the pillow, feet towards the foot of it (the pivot of a lying body is its soles).
  lieOn(seat) {
    const h = seat.heading, len = this.height * 0.93;
    const hx = seat.pillow ? seat.pillow[0] : seat.x - Math.sin(h) * 0.75, hz = seat.pillow ? seat.pillow[1] : seat.z - Math.cos(h) * 0.75;
    this.pos.set(hx + Math.sin(h) * len, seat.y || 0, hz + Math.cos(h) * len);
    this.heading = h; this.root.rotation.y = h; this.lying = 1;
  }
  // Where a thing held in the gripping right hand sits: in the curl of the fingers, a little below the knuckles.
  gripPos(out, along = 0.085, palm = 0.038, drop = 0.055) {
    const ha = this.bones.R_Hand; ha.getWorldPosition(out); const e = ha.matrixWorld.elements;
    out.addScaledVector(V1.set(e[0], e[1], e[2]).normalize(), along).addScaledVector(V2.set(e[4], e[5], e[6]).normalize(), palm);
    out.y -= drop; return out;
  }
  // Two-bone IK: shoulder -> elbow -> hand, elbow kept low and a little out.
  solveArm(side, target, w) {
    const B = this.bones, up = B[side + '_UpperArm'], fo = B[side + '_Forearm'], ha = B[side + '_Hand'];
    const S = up.getWorldPosition(IK1), E = fo.getWorldPosition(IK2), H = ha.getWorldPosition(IK3);
    const a = S.distanceTo(E), b = E.distanceTo(H);
    const D = IK4.copy(target).sub(S); let d = D.length();
    d = Math.max(Math.abs(a - b) + 0.01, Math.min((a + b) * 0.995, d)); D.normalize();
    const x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
    const P = this.reach[side].pole, pole = P ? this.local(side === 'R' ? P[0] : -P[0], P[1], P[2], IK5) : this.local(side === 'R' ? -0.6 : 0.6, -0.7, -0.4, IK5);
    pole.addScaledVector(D, -pole.dot(D)).normalize();
    const elbow = IK2.copy(S).addScaledVector(D, x).addScaledVector(pole, h);
    this.aim(up, fo, IK6.copy(elbow).sub(S).normalize(), w);
    const hand = IK3.copy(S).addScaledVector(D, d);
    fo.getWorldPosition(IK1);
    this.aim(fo, ha, IK6.copy(hand).sub(IK1).normalize(), w);
  }

  startThrow() { this.throwT = 0; }
  knockDown(dir = 1) { this.fallT = 0; this.fallDir = dir; }
  get down() { return this.fallT >= 0; }

  update(dt) {
    this.time += dt;
    this.root.rotation.y = lerpAngle(this.root.rotation.y, this.heading, Math.min(1, dt * this.turnSpeed));
    this.root.visible = this.visible;
    if (!this.visible) return;
    forceWrite(this.mixer);
    this.mixer.update(dt);

    // overlay layer
    this.ovW += Math.sign(this.ovTarget - this.ovW) * Math.min(Math.abs(this.ovTarget - this.ovW), dt / Math.max(0.01, this.ovFade));
    if (this.ovW > 0.001 && this.ovAction) {
      for (let i = 0; i < this.ovBones.length; i++) this.ovSaved[i].copy(this.ovBones[i].quaternion);
      forceWrite(this.over);
      this.over.update(dt);
      if (this.ovW < 0.999) for (let i = 0; i < this.ovBones.length; i++) {
        const b = this.ovBones[i]; TQ.copy(b.quaternion); b.quaternion.copy(this.ovSaved[i]).slerp(TQ, this.ovW);
      }
    } else if (this.ovAction && this.ovTarget === 0) { this.ovAction.stop(); this.ovAction = null; }

    const B = this.bones;
    // sneaking lean
    this.lean += (this.leanTarget - this.lean) * Math.min(1, dt * 8);
    if (Math.abs(this.lean) > 0.005) {
      const right = this.local(1, 0, 0, V3);
      // (in this rig the thighs hang off Spine, so bend from Spine1 up)
      DQ.setFromAxisAngle(right, this.lean * 0.6); this.rotateWorld(B.Spine1, DQ);
      DQ.setFromAxisAngle(right, this.lean * 0.4); this.rotateWorld(B.Spine2, DQ);
      DQ.setFromAxisAngle(right, -this.lean * 0.7); this.rotateWorld(B.Neck, DQ);
    }
    // astride something (a motorbike): the thighs part round its tank
    if (this.straddle) {
      DQ.setFromAxisAngle(UP, 0.32 * this.straddle); this.rotateWorld(B.L_Thigh, DQ);
      DQ.setFromAxisAngle(UP, -0.32 * this.straddle); this.rotateWorld(B.R_Thigh, DQ);
    }
    // both hands out in front, holding a tray
    this.carryW = (this.carryW || 0) + ((this.carry ? 1 : 0) - (this.carryW || 0)) * Math.min(1, dt * 8);
    if (this.carryW > 0.02 && this.fallT < 0) {
      for (const [s, x] of [['R', -1], ['L', 1]]) {
        this.aim(B[s + '_UpperArm'], B[s + '_Forearm'], this.local(x * 0.22, -0.82, 0.42, new THREE.Vector3()), this.carryW);
        this.aim(B[s + '_Forearm'], B[s + '_Hand'], this.local(-x * 0.1, 0.06, 1, new THREE.Vector3()), this.carryW);
      }
    }
    // hands on a tool or a prop
    for (const side of ['R', 'L']) {
      const r = this.reach[side];
      r.w += ((r.on ? 1 : 0) - r.w) * Math.min(1, dt * 9);
      if (r.w > 0.02 && this.fallT < 0) this.solveArm(side, r.pos, r.w);
    }
    // the right hand closed round a glass: palm turned in, thumb up, fingers curled (X = along the hand, Y = out of the palm, Z = thumb side)
    this.gripW += (this.grip - this.gripW) * Math.min(1, dt * 9);
    if (this.gripW > 0.02 && this.fallT < 0 && this.throwT < 0) {
      const ha = B.R_Hand, k = this.gripW;
      B.R_Forearm.getWorldPosition(IK1); ha.getWorldPosition(IK2);
      const X = IK3.copy(IK2).sub(IK1); X.y *= 0.3; X.normalize();
      const Y = IK5.crossVectors(UP, X).normalize(), Z = IK4.crossVectors(X, Y).normalize();
      GQ.setFromRotationMatrix(GM.makeBasis(X, Y, Z));
      ha.parent.getWorldQuaternion(GP); ha.quaternion.slerp(GP.invert().multiply(GQ), k);
      for (const [name, axis, angle] of CURL) { const b = B[name]; if (b) b.quaternion.multiply(DQ.setFromAxisAngle(axis, angle * k)); }
    }
    // a palm turned towards a point (the right hand's: a phone's screen towards the eyes)
    if (this.palmTo && this.fallT < 0) {
      const ha = B.R_Hand; ha.updateWorldMatrix(true, false); const e = ha.matrixWorld.elements;
      IK1.set(e[4], e[5], e[6]).normalize(); ha.getWorldPosition(IK2); IK3.copy(this.palmTo).sub(IK2).normalize();
      GQ.setFromUnitVectors(IK1, IK3); ha.getWorldQuaternion(GP); GQ.multiply(GP); ha.parent.getWorldQuaternion(GP); ha.quaternion.copy(GP.invert().multiply(GQ));
    }
    // fingers round whatever each hand holds (the glass grip above already curled the right one)
    if (!this.fists) this.fists = { R: FIST('R', 1), L: FIST('L', this.mirrorL || 1) };
    for (const s of ['R', 'L']) {
      this.holdW[s] += (this.hold[s] - this.holdW[s]) * Math.min(1, dt * 10);
      const k = this.holdW[s] - (s === 'R' ? this.gripW * 0.7 : 0);
      if (k > 0.02 && this.fallT < 0) for (const [name, axis, angle] of this.fists[s]) { const b = B[name]; if (b) b.quaternion.multiply(DQ.setFromAxisAngle(axis, angle * k)); }
    }
    // throwing arm (dad + slipper)
    if (this.throwT >= 0) {
      this.throwT += dt / 0.95;
      const t = this.throwT;
      const w = t < 0.12 ? t / 0.12 : t > 0.85 ? Math.max(0, (1 - t) / 0.15) : 1;
      const k = t < 0.55 ? 0 : Math.min(1, (t - 0.55) / 0.16);       // 0 = wound up, 1 = released
      const upper = this.local(-0.35 + 0.15 * k, 0.75 - 1.25 * k, -0.55 + 1.4 * k, new THREE.Vector3());
      const fore = this.local(-0.1, 0.9 - 1.3 * k, -0.4 + 1.5 * k, new THREE.Vector3());
      this.aim(B.R_UpperArm, B.R_Forearm, upper, w);
      this.aim(B.R_Forearm, B.R_Hand, fore, w);
      if (t >= 1) this.throwT = -1;
    }
    // head follows a target
    let yaw = 0, pitch = 0;
    if (this.look && this.fallT < 0 && !this.lying) {
      B.Head.getWorldPosition(V1);
      V2.copy(this.look).sub(V1);
      const want = Math.atan2(V2.x, V2.z);
      yaw = lerpAngle(0, want - this.root.rotation.y, 1);
      yaw = Math.max(-1.2, Math.min(1.2, yaw));
      pitch = Math.max(-0.5, Math.min(0.5, -Math.atan2(V2.y, Math.hypot(V2.x, V2.z))));
    }
    this.lookYaw += (yaw - this.lookYaw) * Math.min(1, dt * 6);
    this.lookPitch += (pitch - this.lookPitch) * Math.min(1, dt * 6);
    if (Math.abs(this.lookYaw) > 0.01 || Math.abs(this.lookPitch) > 0.01) {
      for (const [bone, share] of [[B.Neck, 0.4], [B.Head, 0.6]]) {
        DQ.setFromAxisAngle(UP, this.lookYaw * share); this.rotateWorld(bone, DQ);
        DQ.setFromAxisAngle(this.local(1, 0, 0, V3), this.lookPitch * share); this.rotateWorld(bone, DQ);
      }
    }
    // mouth + brows
    if (B.MJaw) {
      // with a recorded voice the jaw follows how loud it is this instant; without one it just chatters
      const open = this.talk > 0.01 ? this.talk * (this.mouth != null ? Math.min(1, 0.08 + this.mouth * 1.6) : 0.35 + 0.65 * Math.abs(Math.sin(this.time * 13) * Math.sin(this.time * 5.3 + 1))) : 0;
      this._jaw = (this._jaw || 0) + (open - (this._jaw || 0)) * Math.min(1, dt * 25);
      B.MJaw.quaternion.copy(this.jawRest);
      if (this._jaw > 0.002) { DQ.setFromAxisAngle(this.jawAxis, this._jaw * 0.3); B.MJaw.quaternion.multiply(DQ); }
    }
    for (const b of this.brows) b.bone.position.copy(b.rest).addScaledVector(b.dir, this.anger * 0.75);
    // eyes: a blink every few seconds, and shut while asleep
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blinkT = 2.2 + Math.random() * 4.2; this.blink = 0.15; }
    if (this.blink > 0) this.blink -= dt;
    this.sleepK += ((this.lying || this.eyesShut ? 1 : 0) - this.sleepK) * Math.min(1, dt * 5);
    const lid = Math.max(this.sleepK, this.blink > 0 ? Math.sin((1 - this.blink / 0.15) * Math.PI) : 0);
    for (const l of this.lids) l.bone.position.copy(l.rest).addScaledVector(l.dir, lid);

    // falling over (hit by the slipper) and lying down (asleep)
    let pitchTilt = 0, lift = 0;
    if (this.fallT >= 0) {
      this.fallT += dt;
      const t = this.fallT;
      const k = t < 0.3 ? (t / 0.3) ** 2 : t < 1.3 ? 1 : Math.max(0, 1 - (t - 1.3) / 0.45);
      pitchTilt = this.fallDir * k * 1.45;
      lift = k * 0.1;
      if (t > 1.75) this.fallT = -1;
    } else if (this.lying) { pitchTilt = -Math.PI / 2 * this.lying; lift = 0.12 * this.lying; }
    this.tilt.rotation.x = pitchTilt;
    this.tilt.position.y = lift;
    // asleep: the blanket over you rises and falls, and the Zs drift up from the pillow
    if (this.lying) {
      const H = this.height;
      if (!this.cover) { this.cover = cover(this.coverColor || 0x7f9ecf); this.cover.scale.z = 0.578 * H; this.cover.position.z = -0.2865 * H; this.root.add(this.cover); this.zz = [zzz(), zzz(), zzz()]; this.root.add(...this.zz); }
      this.cover.visible = true; this.cover.scale.y = 1 + Math.sin(this.time * 1.5) * 0.04;
      this.zz.forEach((s, i) => { const t = (this.time * 0.4 + i / 3) % 1; s.visible = true; s.position.set(0.08 + t * 0.2 + Math.sin(t * 7 + i) * 0.025, 0.32 + t * 0.5, -H * 0.93 - 0.04); s.scale.setScalar(0.035 + t * 0.06); s.material.opacity = Math.sin(t * Math.PI) * 0.95; });
    } else if (this.cover && this.cover.visible) { this.cover.visible = false; for (const s of this.zz) s.visible = false; }
    this.shadow.visible = this.fallT < 0 && !this.lying;
  }
}
