// The rest of the family: Dad (the whole point), Mom, the siblings and the Thursday guests.
import * as THREE from 'three';
import { A } from './assets.js';
import { sfx } from './audio.js';
import { ROOMS } from './world.js';
import { MONITOR } from './cctv.js';
const MON = new THREE.Vector3(MONITOR.x, MONITOR.y, MONITOR.z);

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
// a group of lines that has at least one recording
const voiced = (cat) => { const e = A.lines.lines && A.lines.lines[cat]; return !!e && e.t.some((_, i) => A.voice[`${cat}.${i}`]); };
const V = new THREE.Vector3();

export class Actor {
  constructor(game, char, key, anims) {
    this.game = game; this.char = char; this.key = key; this.anims = anims;
    this.path = null; this.pi = 0; this.moveSpeed = 1.3; this.onArrive = null;
    this.pose = null; this.seat = null; this.stuck = 0; this.stepT = 0;
    this.talkUntil = 0; this.heavy = false; this.eye = 1.5;
    this.busy = false;
  }
  get x() { return this.char.pos.x; }
  get z() { return this.char.pos.z; }
  get room() { return this.game.world.roomAt(this.x, this.z); }
  get moving() { return !!this.path; }
  dist(o) { return Math.hypot(o.x - this.x, o.z - this.z); }
  clipSpeed(name) { return (A.clips.get(name, this.char.pelvis).speed || 1) * this.char.scale; }

  goTo(x, z, { speed = 1.3, onArrive = null } = {}) {
    if (this.seat) this.stand();
    const p = this.game.world.path(this.x, this.z, x, z);
    this.moveSpeed = speed; this.onArrive = onArrive; this.stuck = 0;
    if (!p) { this.path = null; if (onArrive) { this.onArrive = null; onArrive(false); } return false; }
    this.path = p; this.pi = 0; this.pose = null;
    return true;
  }
  halt() { this.path = null; this.onArrive = null; }
  face(x, z) { this.char.heading = Math.atan2(x - this.x, z - this.z); }
  setPose(anim, opts) { this.pose = anim; if (anim) this.char.play(anim, opts); }

  sit(seat, anim = 'm_sit_chair_idle_neutral_01') {
    this.halt(); this.seat = seat;
    if (seat.lie) this.char.lieOn(seat); else { this.char.pos.set(seat.x, seat.y || 0, seat.z); this.char.heading = seat.heading; this.char.root.rotation.y = seat.heading; this.char.lying = 0; }
    this.setPose(seat.lie ? 'm_idle_breathe_01' : anim, { fade: 0.4 });
  }
  stand() {
    if (!this.seat) return;
    const s = this.seat; this.seat = null; this.char.lying = 0; this.pose = null;
    const f = s.lie ? 1.25 : 0.62, side = s.lie ? Math.PI / 2 : 0;
    const [x, z] = this.game.world.nearestFree(s.x + Math.sin(s.heading + side) * f, s.z + Math.cos(s.heading + side) * f);
    this.char.pos.set(x, 0, z);
  }
  // walk to the front of a seat, then sit
  goSit(seat, opts = {}) {
    const f = seat.lie ? 1.25 : 0.62, side = seat.lie ? Math.PI / 2 : 0;
    return this.goTo(seat.x + Math.sin(seat.heading + side) * f, seat.z + Math.cos(seat.heading + side) * f,
      { speed: opts.speed || 1.3, onArrive: () => { this.sit(seat, opts.anim); opts.onArrive && opts.onArrive(); } });
  }

  // target: {x, z, eyeNow, hidden}
  canSee(t, range = 10, cosFov = 0.5) {
    if (t.hidden) return false;
    const dx = t.x - this.x, dz = t.z - this.z, d = Math.hypot(dx, dz);
    const w = this.game.world;
    let r = range;
    if (!w.lit(w.roomAt(t.x, t.z))) r *= 0.38;
    if (d > r) return false;
    if (d > 1.3) {
      const h = this.char.root.rotation.y + this.char.lookYaw * 0.7;
      if ((dx * Math.sin(h) + dz * Math.cos(h)) / d < cosFov) return false;
    }
    return w.sight(this.x, this.z, t.x, t.z, Math.min(this.eye, t.eyeNow ?? 1.4) * 0.8);
  }

  say(cat, opts) { return this.game.say(this, cat, opts); }
  get talking() { return this.game.now < this.talkUntil; }

  moveUpdate(dt) {
    const c = this.char;
    if (this.path) {
      const [tx, tz] = this.path[this.pi];
      const dx = tx - c.pos.x, dz = tz - c.pos.z, d = Math.hypot(dx, dz);
      const step = this.moveSpeed * dt;
      if (d <= Math.max(0.12, step)) {
        this.pi++;
        if (this.pi >= this.path.length) { this.path = null; const cb = this.onArrive; this.onArrive = null; cb && cb(true); }
      } else {
        const px = c.pos.x, pz = c.pos.z;
        c.pos.x += dx / d * step; c.pos.z += dz / d * step;
        c.heading = Math.atan2(dx, dz);
        this.game.world.collide(c.pos, 0.2);
        const moved = Math.hypot(c.pos.x - px, c.pos.z - pz);
        this.stuck = moved < step * 0.3 ? this.stuck + dt : 0;
        if (this.stuck > 0.8) {          // wedged on a corner: jump to the waypoint and carry on
          c.pos.x = tx; c.pos.z = tz; this.stuck = 0;
        }
        this.stepT -= dt * this.moveSpeed * 1.45;
        if (this.stepT <= 0) { this.stepT = 1; sfx.step({ x: c.pos.x, y: 0.1, z: c.pos.z }, this.heavy ? 1 : 0.5, this.heavy); }
      }
    }
    if (!this.pose) {
      if (this.path) {
        const name = this.moveSpeed > 2.6 ? this.anims.run : this.moveSpeed > 1.7 && this.anims.fast ? this.anims.fast : this.anims.walk;
        c.play(name, { speed: Math.max(0.6, this.moveSpeed / this.clipSpeed(name)), fade: 0.2 });
      } else c.play(this.idleAnim ? this.idleAnim() : this.anims.idle, { fade: 0.3 });
    }
    c.talk = this.talking ? 1 : 0;
  }
}

// =====================================================================================================
const RULES = {
  found: { anger: 10, cat: 'dad.found', cd: 6 },
  ps: { anger: 14, cat: 'dad.ps', cd: 9 },
  phone: { anger: 12, cat: 'dad.phone', cd: 9 },
  sleep: { anger: 12, cat: 'dad.fri.wake', cd: 9 },
  eat: { anger: 12, cat: 'dad.mess', cd: 10, index: 3 },
  tvwatch: { anger: 9, cat: 'dad.tvon', cd: 9 },
  tv: { anger: 8, cat: 'dad.tv', cd: 7 },
  fridge: { anger: 6, cat: 'dad.fridge', cd: 10 },
  run: { anger: 3, cat: 'dad.run', cd: 22 },
  sneak: { anger: 4, cat: 'dad.sneak', cd: 20 },
  idle: { anger: 5, cat: 'dad.idle', cd: 16 },
  wardrobe: { anger: 20, cat: 'dad.found', cd: 8 },
  talabat: { anger: 12, cat: 'dad.talabat', cd: 14 },
};
// the sins that can end on «تفو… هاي خلفة؟»
const KHILFE = ['ps', 'phone', 'sleep', 'tvwatch', 'eat', 'wardrobe', 'found', 'talabat'];

export class Dad extends Actor {
  constructor(game, char) {
    super(game, char, 'dad', { idle: 'm_idle_neutral_01', walk: 'm_walk_neutral_01', fast: 'm_walk_fast_01', run: 'm_run_neutral_01' });
    this.heavy = true; this.eye = 1.62;
    this.slipperMesh = null;
    this.reset({ mode: 'patrol', plan: [] });
  }
  idleAnim() { return this.game.anger > 55 ? 'm_idle_angry_01' : 'm_idle_neutral_01'; }

  reset(cfg) {
    this.cfg = cfg; this.mode = cfg.mode;
    this.state = 'routine'; this.stateT = 0; this.awareness = 0; this.seen = false; this.lastSeen = null; this.lastSeenT = -99;
    this.cd = {}; this.scoldCd = 0; this.hearCd = 0; this.checkT = 0; this.mutterT = rnd(8, 16);
    this.si = -1; this.phase = 'idle'; this.doT = 0; this.watchingTv = false;
    this.cmdT = cfg.cmdEvery ? rnd(cfg.cmdEvery[0] * 0.5, cfg.cmdEvery[1] * 0.7) : Infinity;
    this.armed = { 50: true, 70: true, 85: true };
    this.pending = null; this.ammo = 2; this.rage = false; this.rageT = 0; this.throwCd = 0; this.windup = -1;
    this.scanFrom = (this.game.now || 0) + 12;      // let the kid look around before the first complaint
    this.onCams = 0; this.camT = rnd(8, 14);
    this.times = {}; this.teaseT = rnd(18, 30); this.teaseCd = 0; this.lastScold = -99;
    this.away = false; this.honkT = 6; this.resumeState = null; this.grace = 0; this.checkDeskT = cfg.deskCheck ? rnd(28, 40) : Infinity;
    if (this.tire) { this.char.reachTo('R', null); this.tire = null; if (this.x > 21.8) this.char.pos.set(21.3, 0, 6.0); }      // caught out in the lane: back inside the gate
    this.halt(); this.pose = null; if (this.seat) { this.seat = null; this.char.lying = 0; }
    this.char.visible = true; this.char.pos.y = 0;
    this.char.overlay(null);
  }

  setState(s) { this.state = s; this.stateT = 0; }
  get calm() { return this.state === 'routine' || this.state === 'seated' || this.state === 'nap'; }

  // ---------- senses ----------
  perceive(dt) {
    const p = this.game.player;
    if (this.away || this.state === 'nap') { this.awareness = 0; this.seen = false; return; }
    const sees = this.canSee(p, 11.5, 0.5);
    if (sees) {
      const d = this.dist(p);
      let rate = d < 3 ? 3.6 : d < 7 ? 1.9 : 1.0;
      if (p.sneaking && d > 2.5) rate *= 0.55;
      if (p.moving === false && d > 6) rate *= 0.8;
      this.awareness = Math.min(1, this.awareness + rate * dt);
    } else this.awareness = Math.max(0, this.awareness - 0.7 * dt);
    const was = this.seen;
    this.seen = sees && this.awareness >= 1;
    if (this.seen) { this.lastSeen = { x: p.x, z: p.z }; this.lastSeenT = this.game.now; }
    if (this.seen && !was) {
      const g = this.game; g.onSpotted();
      // he has seen you, he is already in a mood, and you have not even done anything yet
      // (never when he finds you at your books or in the middle of a job: that would be picking a fight for nothing)
      const useful = p.act || g.stay || p.carrying || (g.interaction && g.interaction.running);
      if (!useful && this.state === 'routine' && !this.talking && g.anger >= 28 && g.now > (this.khilfeCd || 0) && !g.flags.guests && this.dist(p) < 8 && Math.random() < 0.55) { this.khilfeCd = g.now + 45; this.say('dad.khilfe', { loud: true }); }
    }
    if (!(this.gift && this.gift.k > 0.15)) this.char.look = this.awareness > 0.25 && sees ? p.char.headPos(this._lk || (this._lk = new THREE.Vector3())) : null;      // (not in the middle of a sip)
  }

  hear(ev) {
    if (this.away) return;
    const g = this.game;
    const mult = this.state === 'nap' ? 1.35 : this.watchingTv && !this.cfg.quiet ? 0.55 : 1;
    const d = Math.hypot(ev.x - this.x, ev.z - this.z);
    if (d > ev.r * mult) return;
    if (this.state === 'nap') { this.wake(ev); return; }
    if (g.now < this.hearCd || !this.calm || g.flags.guests) return;
    if (ev.by !== 'player' && ev.kind !== 'crash') return;
    if (ev.kind === 'walk' && !this.cfg.quiet) return;            // ordinary footsteps are nothing to shout about
    // running: one remark now and then, not one for every dash across a room
    if (ev.kind === 'run' && !this.cfg.quiet) {
      if (this.seen || g.now < (this.runCd || 0)) return;
      this.runCd = g.now + 24; this.cd.run = g.now + 20; this.hearCd = g.now + 6;       // (seeing it right after does not earn a second remark)
      this.say('dad.run', { index: 2 }); g.addAnger(1, 'run'); if (Math.random() < 0.3) this.investigate(ev.x, ev.z, false);
      return;
    }
    this.hearCd = g.now + 11;
    if (ev.kind === 'crash') { if (voiced('dad.noise.crash')) this.say('dad.noise.crash', { loud: true }); else this.say('dad.noise', { index: 4, loud: true }); this.investigate(ev.x, ev.z, true); g.addAnger(4, 'noise'); return; }
    if (this.cfg.quiet) { g.addAnger(4, 'noise'); if (voiced('dad.noise.quiet')) this.say('dad.noise.quiet', { loud: true }); else this.say('dad.noise', { index: 5, loud: true }); return; }
    if (ev.kind === 'ps' || ev.kind === 'use' || ev.kind === 'tv') { this.say('dad.noise'); this.investigate(ev.x, ev.z, false); }
  }

  wake(ev) {
    const g = this.game;
    g.stats.woke++;
    this.stand(); this.setState('routine'); this.phase = 'idle';
    this.say('dad.fri.woken', { loud: true });
    g.addAnger(16, 'woke'); g.toast('صحّيت أبوك!', 'bad');
    this.napAgain = g.now + 14;
    this.investigate(ev.x, ev.z, true);
  }

  // What is the kid doing, as far as dad can tell?
  judge() {
    const g = this.game, p = g.player;
    if (!this.seen || g.now < this.scoldCd || g.now < this.grace) return;
    if (['frozen', 'throw', 'blame'].includes(this.state)) return;
    // found doing the right thing: a father's praise, such as it is, and it takes the edge off him
    const I = g.interaction, job = I && I.running && g.tasks.find((t) => I.key === t.id + ':' + t.i);
    if (p.act === 'study' || (job && job.kind !== 'secret')) {
      if (g.now > (this.praiseCd || 0) && !this.talking && this.state === 'routine' && g.anger < 75 && this.dist(p) < 7) { this.praiseCd = g.now + 45; this.say(p.act === 'study' ? 'dad.study' : voiced('dad.praise.sarcastic') && Math.random() < 0.35 ? 'dad.praise.sarcastic' : 'dad.praise'); g.addAnger(-3, 'praise'); }
      return;
    }
    let rule = null;
    const chores = g.tasks.some((t) => !t.done && (t.kind === 'chore' || t.kind === 'cmd'));
    // ready-made food: at the gate, in your hand, in your mouth
    if (p.act === 'talabat' || (p.carrying && p.carrying.item === 'talabat')) rule = 'talabat';
    else if (p.act === 'ps') rule = 'ps';
    else if (p.act === 'phone') rule = 'phone';
    else if (p.act === 'sleep') rule = 'sleep';
    else if (p.act === 'eat') rule = 'eat';
    else if (p.act === 'tvwatch') rule = 'tvwatch';
    else if (p.act === 'snoop') rule = 'wardrobe';
    else if (this.watchingTv && g.inTvLine(p) && !p.sneaking) rule = 'tv';
    else if (p.running && p.runT > 1.2 && this.dist(p) < 6.5) rule = 'run';
    else if (p.sneaking && p.moving && this.dist(p) < 7 && !(this.watchingTv && g.inTvLine(p))) rule = 'sneak';
    else if (p.idleTime > 6 && chores && p.state === 'free' && !p.carrying) rule = 'idle';
    if (!rule || g.now < (this.cd[rule] || 0)) return;
    this.react(rule);
  }

  react(rule, extra = 0) {
    const g = this.game, R = RULES[rule];
    this.cd[rule] = g.now + R.cd; this.scoldCd = g.now + 5;
    if (rule === 'run') this.runCd = g.now + 24;
    g.stats.caught++;
    if (g.flags.guests) {             // can't shout in front of the guests: he stores it for later
      g.debt += Math.round((R.anger + extra) * 0.8);
      this.say('dad.thu', { whisper: true });
      g.toast('أبوك سجّلها عليك… لبعد ما يروحوا الضيوف', 'bad');
      return;
    }
    // standing about gets the office speech half the time; the worse sins end, now and then, on «الخلفة»
    const base = rule === 'idle' && Math.random() < 0.5 ? 'dad.company' : R.cat, cat = this.ctxCat(rule, base);
    const dur = this.say(cat, { index: cat === R.cat ? R.index : undefined, loud: true });
    this.lastScold = g.now;
    if (KHILFE.includes(rule) && g.now > (this.khilfeCd || 0) && Math.random() < 0.45) {
      this.khilfeCd = g.now + 35;
      g.later(dur + 0.25, () => { if (this.seen && !g.flags.guests && !g.over && (this.state === 'scold' || this.state === 'routine')) this.say('dad.khilfe', { loud: true }); });
    }
    g.addAnger(R.anger + extra, rule);
    if (this.state === 'routine' || this.state === 'investigate' || this.state === 'fix') this.scold();
    if (rule === 'ps') g.setDevice('console', false, 'dad');
  }

  // The same sin said the same way every time stops being funny. Where you are, who you are, the hour and whether he
  // has caught you at it already today pick the line (when that group has been recorded); the general one still comes now and then.
  ctxCat(rule, base) {
    const g = this.game, p = g.player, room = g.world.roomAt(p.x, p.z), night = g.seg && g.seg.tod === 'night', d = this.dist(p);
    const n = this.times[rule] = (this.times[rule] || 0) + 1, kid = g.playerKey === 'kid', sis = g.playerKey === 'sis';
    const chores = g.tasks.some((t) => !t.done && (t.kind === 'chore' || t.kind === 'cmd'));
    const want = [];
    if (rule === 'phone') {
      if (n >= 3) want.push('dad.phone.again');
      if (room === 'bath') want.push('dad.phone.bath');
      if (p.char.lying) want.push('dad.phone.bed');
      if (kid) want.push('dad.phone.kid');
      if (sis) want.push('dad.phone.sis');
      if (chores) want.push('dad.phone.chore');
    } else if (rule === 'ps') { if (n >= 2) want.push('dad.ps.again'); if (night) want.push('dad.ps.night'); }
    else if (rule === 'eat') want.push(kid ? 'dad.eat.kid' : 'dad.eat', 'dad.eat');
    else if (rule === 'idle') { if (d < 1.9) want.push('dad.idle.near'); if (room === 'kitchen') want.push('dad.idle.kitchen'); if (room === 'yard') want.push('dad.idle.yard'); }
    else if (rule === 'run') { if (kid) want.push('dad.run.kid'); }
    else if (rule === 'sneak') { if (d < 2.6) want.push('dad.sneak.near'); }
    else if (rule === 'tv') { if (g.tv && g.tv.prog === 'match') want.push('dad.tv.match'); }
    const ok = want.filter(voiced);
    if (!ok.length) return base;
    if (ok[0].endsWith('.again')) return ok[0];            // caught at it again: that comes first
    return Math.random() < 0.75 ? pick(ok) : base;
  }
  // found hiding: behind the curtain, under the bed, in the wardrobe, under the table each get their own
  foundCat() {
    const h = this.game.player.hide, k = h && { curtain: 'dad.found.curtain', bed: 'dad.found.bed', crouch: 'dad.found.bed', wardrobe: 'dad.found.wardrobe', table: 'dad.found.table' }[h.kind];
    return k && voiced(k) && Math.random() < 0.8 ? k : 'dad.found';
  }
  // what he finds on the floor
  messCat(kind) {
    const k = { water: 'dad.mess.water', tea: 'dad.mess.tea', coffee: 'dad.mess.tea', plate: 'dad.mess.glass', vase: 'dad.mess.glass' }[kind];
    return k && voiced(k) && Math.random() < 0.8 ? k : 'dad.mess';
  }
  // Nothing wrong at all, and he still finds something to say: your hair, your pyjamas at noon, the neighbours' son,
  // the electricity bill. Only when he is calm, can see you close by and you are not busy.
  tease() {
    const g = this.game, p = g.player;
    if (!this.seen || this.talking || g.flags.guests || g.over || this.state !== 'routine' || p.hidden || p.act || g.stay) return;
    if (g.now < this.scoldCd + 10 || g.now < this.teaseCd || this.dist(p) > 6 || g.segT < 20) return;
    if (g.interaction && g.interaction.running) return;
    const seg = g.seg, mins = seg.clock[0] + (seg.clock[1] - seg.clock[0]) * Math.min(1, g.segT / seg.time);
    const now = [];
    if (g.wearing === 'pyjama' && mins > 10 * 60 + 30) now.push('dad.tease.pyjama');
    if (g.now - this.lastScold > 18 && g.now - this.lastScold < 75) now.push('dad.tease.after');
    if (seg.tod === 'morning') now.push('dad.tease.morning');
    if (g.day.id === 'fri') now.push('dad.tease.friday');
    const fits = now.filter(voiced), any = ['dad.tease.' + g.playerKey, 'dad.tease.neighbor', 'dad.tease.bill'].filter(voiced);
    if (!fits.length && !any.length) return;
    this.teaseCd = g.now + rnd(55, 95);
    this.say(fits.length && (Math.random() < 0.65 || !any.length) ? pick(fits) : pick(any));
  }

  scold() {
    this.setState('scold');
    const p = this.game.player;
    if (this.seat) this.char.overlay('m_gestic_talk_angry_01_xyz', { mask: 'upper' });
    else { this.halt(); this.face(p.x, p.z); this.setPose(Math.random() < 0.5 ? 'm_gestic_talk_angry_01_xyz' : 'm_gestic_talk_angry_02_xyz', { fade: 0.2 }); }
  }

  // Lights, AC, fridge, messes... anything that costs money or looks bad.
  scan() {
    const g = this.game, w = g.world;
    if (!this.calm || this.state !== 'routine' || g.flags.guests || this.seat && this.seat.lie || g.now < this.scanFrom) return;
    for (const dev of Object.values(w.devices)) {
      if (!dev.on || !g.wasteful(dev) || g.now < (dev.ignoreUntil || 0)) continue;
      const lx = dev.type === 'light' ? dev.lamp.position.x : dev.x, lz = dev.type === 'light' ? dev.lamp.position.z : dev.z;
      const same = this.room === dev.room;
      if (!same && !(Math.hypot(lx - this.x, lz - this.z) < 8.5 && w.sight(this.x, this.z, lx, lz, 1.9))) continue;
      this.fix(dev); return;
    }
    for (const m of g.messes) {
      if (m.seen || Math.hypot(m.x - this.x, m.z - this.z) > 7 || !w.sight(this.x, this.z, m.x, m.z, 1.0)) continue;
      m.seen = true; g.onMessSeen(m); return;
    }
  }

  fix(dev) {
    const g = this.game;
    let cat = { light: 'dad.light', ac: 'dad.ac', tv: 'dad.tvon', fridge: 'dad.fridge', heater: 'dad.mon', console: 'dad.ps' }[dev.type];
    let index = dev.type === 'heater' ? 0 : dev.type === 'console' ? 1 : undefined;
    // which light, and when: the bathroom's, the kitchen's, one burning in broad daylight; the fridge in the middle of the night
    const alt = dev.type === 'light' ? (dev.room === 'bath' ? 'dad.light.bath' : dev.room === 'kitchen' ? 'dad.light.kitchen' : !g.world.dark ? 'dad.light.day' : null)
      : dev.type === 'fridge' ? (g.seg && g.seg.tod === 'night' ? 'dad.fridge.night' : 'dad.fridge.long') : null;
    if (alt && voiced(alt) && Math.random() < 0.7) { cat = alt; index = undefined; }
    this.say(cat, { index, loud: true });
    dev.ignoreUntil = g.now + 12;
    g.stats.wasted++;
    const who = dev.by || 'player';
    let amount = (dev.type === 'light' ? 5 : 7) * (this.cfg.strict || 1);
    if (who !== 'player') amount *= g.player.key === 'big' ? 0.8 : 0.4;      // the eldest answers for everyone
    g.addAnger(amount, dev.type);
    if (who !== 'player' && g.player.key === 'big' && this.seen) g.later(1.8, () => this.say('dad.eldest'));
    const wasSeat = this.seat;
    this.setState('fix');
    this.goTo(dev.x, dev.z, { speed: 1.7, onArrive: () => {
      g.setDevice(dev.id, false, 'dad'); sfx.click();
      g.later(0.5, () => { if (this.state === 'fix') { this.setState('routine'); this.phase = 'idle'; if (wasSeat) this.si = Math.max(-1, this.si - 1); } });
    } });
  }

  blame(sib, cat) {
    this.setState('blame'); this.target = sib;
    this.say(cat, { loud: true });
    sib.getBlamed(this);
    this.goTo(sib.x, sib.z, { speed: 2.0 });
  }

  investigate(x, z, hot) {
    if (!this.calm && this.state !== 'investigate') return;
    this.watchingTv = false;
    this.setState('investigate'); this.invDone = false;
    this.goTo(x, z, { speed: hot ? 2.5 : 1.5, onArrive: () => { this.invDone = true; this.stateT = 0; this.setPose('m_idle_look_around_01'); if (!this.seen) this.say('dad.search'); } });
  }

  startChase(pending) {
    if (this.state === 'frozen' || this.state === 'throw') return;
    this.pending = pending; this.setState('chase'); this.repath = 0; this.watchingTv = false; this.pose = null;
    // a father always has a fair idea where his kid is: he starts from where you are right now
    const p = this.game.player;
    if (!p.hidden) { this.lastSeen = { x: p.x, z: p.z }; this.lastSeenT = this.game.now + 1.5; }
    this.wentLast = false; this.searching = false;
    // (he finishes what he was shouting first)
    const g = this.game; if (this.talking) g.later(this.talkUntil - g.now + 0.25, () => { if (this.state === 'chase') this.say('dad.come', { loud: true }); }); else this.say('dad.come', { loud: true });
    this.game.toast(pending === 'lecture' ? 'أبوك جاي يعطيك محاضرة… اهرب أو استسلم' : 'أبوك جاي يصادر!', 'bad');
  }

  startRage() {
    if (this.rage) return;
    this.rage = true; this.rageT = 0; this.ammo = 2; this.throwCd = 1.2; this.windup = -1; this.watchingTv = false;
    this.setState('throw'); this.pose = null; this.repath = 0;
    this.say('dad.slipper.windup', { index: 1, loud: true });
    this.game.onRage(true);
  }
  endRage(line) {
    this.rage = false; this.setState('routine'); this.phase = 'idle'; this.grace = this.game.now + 5;
    if (line) this.say(line);
    this.game.onRage(false);
  }

  onAnger() {
    const g = this.game, a = g.anger;
    for (const k of [50, 70, 85]) if (a < k - 14) this.armed[k] = true;
    if (this.away || g.flags.guests || this.state === 'frozen' || this.state === 'tire' || g.over) return;
    if (a >= 100) { g.explode(); return; }
    if (a >= 85 && this.armed[85] && !this.rage && g.seg.slipper !== false) { this.armed[85] = this.armed[70] = this.armed[50] = false; this.startRage(); return; }
    if (this.rage) return;
    if (a >= 70 && this.armed[70]) { this.armed[70] = this.armed[50] = false; this.startChase('confiscate'); return; }
    if (a >= 50 && this.armed[50]) { this.armed[50] = false; this.startChase('lecture'); }
  }

  // ---------- routine ----------
  routine(dt) {
    const g = this.game, cfg = this.cfg, w = g.world;
    if (cfg.mode === 'seated') return;
    if (cfg.mode === 'car') { this.carMode(dt); return; }
    if (this.phase === 'idle') {
      if (!cfg.plan.length) return;
      if (cfg.mode === 'nap' && g.now < (this.napAgain || 0)) return;
      this.si = (this.si + 1) % cfg.plan.length;
      const st = this.station = cfg.plan[this.si];
      this.phase = 'going';
      const arrive = () => { this.phase = 'doing'; this.doT = rnd(st.dur[0], st.dur[1]); this.begin(st); };
      if (st.seat) this.goSit(w.seats[st.seat], { speed: 1.25, onArrive: arrive });
      else this.goTo(st.at[0], st.at[1], { speed: cfg.pace || 1.25, onArrive: arrive });
    } else if (this.phase === 'doing') {
      this.doT -= dt;
      const st = this.station;
      if (st.act === 'tv') {
        // and every so often a look across at the camera monitor beside the TV
        this.camT -= dt;
        if (this.camT <= 0) { this.camT = rnd(14, 24); this.onCams = 3.4; if (!g.camsTold) { g.camsTold = true; g.toast('أبوك بيطلّ عالكاميرات 📹 الممر والمطبخ والحوش مكشوفين', 'bad'); } }
        this.mutterT -= dt;
        if (this.mutterT <= 0) {
          this.mutterT = rnd(14, 26);
          // he talks back to whatever is on: the news, the match, the series
          const w = 'dad.watch.' + (g.tv ? g.tv.prog : 'news');
          if (!this.talking) this.say(voiced(w) && Math.random() < 0.6 ? w : Math.random() < 0.6 ? 'dad.news' : 'dad.mutter');
        }
      } else if (st.act === 'nap') {
        this.mutterT -= dt; if (this.mutterT <= 0) { this.mutterT = 3.4; sfx.snore({ x: this.x, y: 0.7, z: this.z }); }
      } else if (st.act === 'look') {
        this.mutterT -= dt; if (this.mutterT <= 0) { this.mutterT = rnd(16, 28); if (!this.talking && Math.random() < 0.6) this.say('dad.mutter'); }
      }
      if (this.doT <= 0) { this.finish(st); this.phase = 'idle'; }
    }
    // errands
    if (cfg.cmds && g.canCommand()) {
      this.cmdT -= dt;
      if (this.cmdT <= 0) { this.cmdT = rnd(cfg.cmdEvery[0], cfg.cmdEvery[1]); g.issueCommand(pick(cfg.cmds)); }
    }
    // a remark about nothing in particular, now and then
    if (this.state === 'routine') { this.teaseT -= dt; if (this.teaseT <= 0) { this.teaseT = rnd(8, 14); this.tease(); } }
    // Wednesday: surprise visits to the desk
    if (cfg.deskCheck && this.state === 'routine') {
      this.checkDeskT -= dt;
      if (this.checkDeskT <= 0) { this.checkDeskT = rnd(38, 55); g.deskCheck(); }
    }
  }
  begin(st) {
    const g = this.game;
    if (st.act === 'tv') { g.setDevice('tv', true, 'dad'); g.tv.watch(g.tv.dadProg()); if (g.world.dark) g.setDevice('light_living', true, 'dad'); this.watchingTv = true; this.char.overlay(st.paper ? 'm_newspaper_arm_idle' : null, { mask: 'arms' }); } else if (st.act === 'look') this.setPose('m_idle_look_around_01');
    else if (st.act === 'nap') { this.setState('nap'); this.phase = 'doing'; this.doT = 9999; } else if (st.act === 'wait') this.setPose('m_idle_waiting_01');
    if (st.line) this.say(st.line, { loud: true });
    if (st.face) this.face(st.face[0], st.face[1]);
  }
  finish(st) {
    if (st.act === 'tv') { this.watchingTv = false; this.game.setDevice('tv', false, 'dad'); this.char.overlay(null); }
    this.pose = null;
  }
  carMode(dt) {
    const g = this.game, s = g.world.spots.carhorn;
    if (this.phase === 'idle') { this.phase = 'going'; this.goTo(s.x, s.z + 0.3, { speed: 1.6, onArrive: () => { this.phase = 'doing'; this.face(15, 5.5); this.setPose('m_idle_waiting_01'); } }); }
    this.honkT -= dt;
    if (this.honkT <= 0) {
      this.honkT = rnd(9, 13); sfx.horn({ x: 19.3, y: 1, z: 2.9 }); g.noise(19.3, 2.9, 3, 'horn', 'dad');
      // not a shout with every horn; and the shouting gets more desperate as the bell gets nearer
      const u = g.segT / (g.seg.time || 150), cat = u < 0.35 ? 'dad.sun.early' : u < 0.75 ? 'dad.sun.mid' : 'dad.sun.late';
      if (Math.random() < 0.65) g.later(1.3, () => this.say(voiced(cat) && Math.random() < 0.8 ? cat : 'dad.sun', { loud: true }));
    }
    g.addAnger(dt * 0.3, 'late', true);      // every second he waits in the car costs you
  }

  // ---------- the cameras: caught on one while he was looking ----------
  camCheck() {
    const g = this.game, p = g.player, f = g.cctv.seen(p);
    if (!f || p.hidden || g.now < (this.camCd || 0) || g.flags.guests || this.seen) return;
    const guilty = p.phoneOut || ['phone', 'eat', 'snoop', 'ps', 'tvwatch'].includes(p.act) || (p.running && p.runT > 1.2);
    if (!guilty) return;
    this.camCd = g.now + 30; this.onCams = 0; g.stats.caught++;
    this.say('dad.cam', { loud: true, far: true }); g.toast(`أبوك شافك على كاميرا ${f.label}! 📹`, 'bad'); g.addAnger(8, 'cam');
    if (this.state === 'routine') { if (this.seat) this.stand(); this.investigate(p.x, p.z, true); }
  }

  // ---------- somebody parked across the gate ----------
  canTire() { const g = this.game; return this.state === 'routine' && this.cfg.mode === 'patrol' && !this.rage && !g.lecture && !g.flags.guests && !g.over && g.player.state !== 'lecture'; }
  startTire(street) {
    const g = this.game;
    if (this.watchingTv) { this.watchingTv = false; g.setDevice('tv', false, 'dad'); this.char.overlay(null); }
    if (this.seat) this.stand();
    this.halt(); this.setState('tire'); this.tire = { step: 'notice', t: 0, street }; this.grace = g.now + 1e6;
    this.face(22, 6); this.setPose('m_idle_angry_01', { fade: 0.2 });
    this.say('dad.car.spot', { loud: true, far: true });
  }
  tireUpdate(dt) {
    const g = this.game, w = g.world, S = w.street, T = this.tire, c = this.char, st = T.street;
    T.t += dt;
    const go = (s) => { T.step = s; T.t = 0; };
    const walk = (x, z, v = 1.45) => {          // the lane is off the nav grid: straight lines, by hand
      const dx = x - c.pos.x, dz = z - c.pos.z, d = Math.hypot(dx, dz), s = v * dt;
      this.pose = 'walk'; c.play('m_walk_neutral_01', { speed: Math.max(0.6, v / this.clipSpeed('m_walk_neutral_01')), fade: 0.2 });
      if (d <= s) { c.pos.x = x; c.pos.z = z; return true; }
      c.pos.x += dx / d * s; c.pos.z += dz / d * s; c.heading = Math.atan2(dx, dz);
      this.stepT -= dt * v * 1.45; if (this.stepT <= 0) { this.stepT = 1; sfx.step({ x: c.pos.x, y: 0.1, z: c.pos.z }, 1, true); }
      return false;
    };
    switch (T.step) {
      case 'notice':
        if (T.t > 2.4 && !this.talking) { go('toGate'); this.pose = null; this.goTo(S.gate[0], S.gate[1], { speed: 2.1, onArrive: (ok) => { if (this.tire === T) go(ok ? 'open' : 'abort'); } }); }
        break;
      case 'toGate': if (T.t > 30) go('abort'); break;
      case 'open':
        if (!T.opened) { T.opened = true; w.gate.target = 1; sfx.gate({ x: 22, y: 1, z: 6 }); st.pip(true); this.face(23, 6); this.setPose('m_idle_look_around_01', { fade: 0.2 }); }
        if (T.t > 1.0) go('out');
        break;
      case 'out': if (walk(S.walk, S.gate[1])) go('along'); break;
      case 'along': if (walk(S.walk, st.wheel.z + 0.02)) { go('look'); this.setPose('m_idle_look_around_01', { fade: 0.25 }); this.say('dad.car.sneak'); } break;
      case 'look': if (T.t > 2.2 && !this.talking) { go('crouch'); c.heading = Math.PI / 2; this.setPose('m_crouch_idle', { fade: 0.3 }); const v = st.wheel; T.hand = new THREE.Vector3(v.x, v.y, v.z); } break;
      case 'crouch':
        c.reachTo('R', T.hand);
        if (T.t > 0.8) { go('deflate'); sfx.hiss(st.wheel, 5.4); this.say('dad.car.do'); g.stats.tires = (g.stats.tires || 0) + 1; }
        break;
      case 'deflate': {
        const k = Math.min(1, T.t / 5.4);
        st.flatten(k * k * (3 - 2 * k)); c.reachTo('R', T.hand);
        T.puff = (T.puff || 0) - dt;
        if (T.puff <= 0 && k < 0.95) { T.puff = 0.05; g.stations.fx.emit('mist', T.hand, { x: -1.7 * (1 - k * 0.6), y: 0.5, z: -0.5 }, 0.5, 0.8); }
        if (k >= 1) { c.reachTo('R', null); go('up'); this.setPose('m_idle_look_around_01', { fade: 0.35 }); this.say('dad.car.done'); }
        break;
      }
      case 'up': if (T.t > 1.6 && !this.talking) go('back'); break;
      case 'back': if (walk(S.walk, S.gate[1])) go('in'); break;
      case 'in': if (walk(S.gate[0], S.gate[1])) { sfx.gate({ x: 22, y: 1, z: 6 }, true); this.endTire(true); } break;
      case 'abort': this.endTire(false); break;
    }
  }
  endTire(done) {
    const g = this.game, T = this.tire, p = g.player;
    this.tire = null; this.char.reachTo('R', null); g.world.gate.target = 0; T.street.pip(false);
    this.pose = null; this.setState('routine'); this.phase = 'idle'; this.grace = g.now + 5;
    if (!done) { T.street.aborted(); return; }
    T.street.done();
    g.addAnger(-12, 'tire'); g.toast('أبوك نفّس عجل السيارة… ورجع رايق 😌', 'good');
    // and if you were standing there watching him come back in
    if (!p.hidden && this.dist(p) < 7 && g.world.sight(this.x, this.z, p.x, p.z, 1.2)) { this.face(p.x, p.z); g.later(0.6, () => { if (this.state === 'routine') this.say('dad.car.hush', { loud: true }); }); }
  }

  // ---------- main update ----------
  update(dt) {
    const g = this.game, p = g.player, c = this.char;
    this.stateT += dt;
    if (!this.away) {
      this.perceive(dt);
      this.checkT -= dt;
      if (this.checkT <= 0) { this.checkT = 0.4; this.judge(); this.scan(); if (this.onCams > 0) this.camCheck(); }
    }
    if (this.onCams > 0) { if (this.state !== 'routine' || !this.watchingTv) this.onCams = 0; else { this.onCams -= dt; c.look = MON; } }
    switch (this.state) {
      case 'routine': this.routine(dt); break;
      case 'seated': break;
      case 'nap': this.mutterT -= dt; if (this.mutterT <= 0) { this.mutterT = 3.4; sfx.snore({ x: this.x, y: 0.7, z: this.z }); } break;
      case 'scold':
        if (this.stateT > 2.3 && !this.talking) {
          this.setState('routine');
          if (this.seat) { c.overlay(this.station && this.station.paper ? 'm_newspaper_arm_idle' : null, { mask: 'arms' }); this.phase = 'doing'; } else {
            // he was on his way somewhere: head for the same station again
            this.pose = null; this.phase = 'idle'; this.si = Math.max(-1, this.si - 1);
          }
        }
        break;
      case 'investigate':
        if (this.seen && this.dist(p) < 6) { this.halt(); this.setState('routine'); this.phase = 'idle'; this.pose = null; } else if (this.invDone && this.stateT > 3.2) { this.pose = null; this.setState('routine'); this.phase = 'idle'; } else if (!this.invDone && this.stateT > 14) { this.setState('routine'); this.phase = 'idle'; }
        break;
      case 'fix': if (this.stateT > 12) { this.setState('routine'); this.phase = 'idle'; } break;
      case 'blame': {
        const s = this.target;
        if (this.dist(s) < 1.5 || this.stateT > 9) { this.halt(); this.face(s.x, s.z); if (!this.pose) this.setPose('m_gestic_talk_angry_02_xyz'); }
        if (this.stateT > (this.pose ? 9 : 14)) { this.pose = null; this.setState('routine'); this.phase = 'idle'; s.blamed = false; }
        break;
      }
      case 'tire': this.tireUpdate(dt); break;
      case 'chase': this.chase(dt); break;
      case 'throw': this.throwing(dt); break;
      case 'frozen': break;
    }
    if (this.state !== 'frozen') this.moveUpdate(dt);
    c.anger += (Math.min(1, g.anger / 90) - c.anger) * Math.min(1, dt * 3);
    if (this.slipperMesh) {
      const show = this.rage && this.ammo > 0 && this.windup < 0.62;
      this.slipperMesh.visible = show;
      if (show) { c.handPos('R', this.slipperMesh.position); this.slipperMesh.rotation.set(0.4, c.root.rotation.y, 0); }
    }
    c.update(dt);
  }

  chase(dt) {
    const g = this.game, p = g.player;
    this.repath -= dt;
    const d = this.dist(p);
    if (this.seen || (!p.hidden && g.now - this.lastSeenT < 2.5)) {
      this.wentLast = false;
      if (d < 1.3 && g.world.sight(this.x, this.z, p.x, p.z, 0.5)) { this.halt(); g.punish(this.pending); return; }
      if (this.repath <= 0) { this.repath = 0.35; this.goTo(p.x, p.z, { speed: g.anger > 70 ? 3.0 : 2.6 }); }
    } else if (!this.searching && (!this.moving || !this.wentLast)) {
      // lost him: walk to where he was last seen, then look around
      const far = this.lastSeen && Math.hypot(this.lastSeen.x - this.x, this.lastSeen.z - this.z) > 1.5;
      if (far && !this.wentLast) { this.wentLast = true; this.goTo(this.lastSeen.x, this.lastSeen.z, { speed: 2.4, onArrive: () => this.searchHide() }); } else if (!this.moving) this.searchHide();
    }
    if (this.stateT > 26) { this.say('dad.slipper.miss', { index: 4 }); g.addAnger(4, 'escaped'); this.setState('routine'); this.phase = 'idle'; this.grace = g.now + 4; g.stats.escapes++; g.toast('هربت منه… هالمرة', 'good'); }
  }
  // He lost you: look around, and maybe check the nearest hiding place.
  searchHide() {
    const g = this.game, p = g.player;
    if (this.searching) return;
    this.searching = true; this.halt(); this.setPose('m_idle_look_around_01'); this.say('dad.search');
    g.later(2.6, () => {
      this.searching = false; this.pose = null;
      if (this.state !== 'chase') return;
      const sawEnter = p.hidden && (p.hideSeen || (this.dist(p.hide) < 3.4 && Math.random() < 0.6));
      if (sawEnter) {
        this.goTo(p.hide.x, p.hide.z, { speed: 2.2, onArrive: () => {
          if (this.state !== 'chase') return;
          if (p.hidden) { this.say(this.foundCat(), { loud: true }); g.unhide(true); g.addAnger(8, 'found'); g.later(0.9, () => g.punish(this.pending)); } else { this.setState('routine'); this.phase = 'idle'; }
        } });
      } else { g.addAnger(-4, 'lost'); g.stats.escapes++; g.toast('ما لقاك!', 'good'); this.setState('routine'); this.phase = 'idle'; this.grace = g.now + 3; }
    });
  }

  throwing(dt) {
    const g = this.game, p = g.player, c = this.char;
    this.rageT += dt; this.throwCd -= dt; this.repath -= dt;
    if (this.windup >= 0) {
      this.windup += dt / 0.95;
      this.face(p.x, p.z);
      if (this.windup >= 0.6 && !this.released) { this.released = true; g.throwSlipper(this); this.ammo--; }
      if (this.windup >= 1) { this.windup = -1; this.throwCd = 1.5; }
      return;
    }
    if (this.ammo <= 0) {
      if (!this.barefoot) { this.barefoot = true; this.halt(); this.say('dad.barefoot'); g.issueCommand('slipper', true); this.waitT = 0; }
      this.waitT += dt;
      // nobody brought them back: fetch one himself
      if (this.waitT > 11 && !this.moving) {
        const s = g.pickups.find((k) => k.item === 'slipper');
        if (s) this.goTo(s.x, s.z, { speed: 1.9, onArrive: () => { g.removePickup(s); this.ammo++; this.barefoot = false; g.cancelCommand('slipper'); } }); else { this.ammo = 1; this.barefoot = false; }
      }
      if (g.anger < 68 || this.rageT > 55) this.endRage('dad.slipper.miss.3');
      return;
    }
    if (g.anger < 66 || this.rageT > 55) { this.endRage(g.anger < 66 ? 'dad.slipper.hit.2' : 'dad.slipper.miss.3'); return; }
    const d = this.dist(p), los = this.canSee(p, 13, -0.2);
    if (los && d > 2.2 && d < 10 && this.throwCd <= 0 && !p.char.down) {
      this.halt(); this.face(p.x, p.z); this.windup = 0; this.released = false; c.startThrow();
      this.say('dad.slipper.windup', { loud: true });
    } else if (this.repath <= 0 && (!los || d > 7 || d < 2)) {
      this.repath = 0.4;
      if (d < 2) { const ax = this.x + (this.x - p.x), az = this.z + (this.z - p.z); this.goTo(ax, az, { speed: 2.4 }); } else this.goTo(p.x, p.z, { speed: 3.1 });
    } else if (los && d <= 7 && this.moving && this.throwCd < 0.4) this.halt();
  }
}

// =====================================================================================================
export class Mom extends Actor {
  constructor(game, char) {
    super(game, char, 'mom', { idle: 'f_idle_neutral_01', walk: 'f_walk_neutral_01', run: 'f_run_neutral_01' });
    this.eye = 1.5; this.reset();
  }
  reset() { this.t = rnd(3, 6); this.askT = rnd(14, 22); this.calmT = 30; this.spot = null; this.mode = 'kitchen'; this.halt(); this.pose = null; this.char.visible = true; this.ambT = rnd(12, 20); }
  update(dt) {
    const g = this.game, p = g.player, w = g.world;
    if (this.mode === 'kitchen') {
      this.t -= dt;
      if (this.t <= 0 && !this.moving) {
        this.t = rnd(14, 24);
        const s = w.spots[pick(['mom1', 'mom2', 'mom3'])];
        this.goTo(s.x, s.z, { speed: 1.1, onArrive: () => { this.char.heading = s.face; this.setPose('f_work_mid'); } });
      }
      const near = this.dist(p) < 2.6 && p.state === 'free' && p.room === 'kitchen';
      // asking for a hand
      this.askT -= dt;
      if (near && this.askT <= 0 && g.canMomAsk()) { this.askT = rnd(45, 70); g.momAsk(); }
      this.ambT -= dt;
      if (this.ambT <= 0) { this.ambT = rnd(18, 30); if (near && !this.talking && !g.dad.talking) this.say(g.anger > 45 ? 'mom.ambient' : 'mom.ambient', { index: g.anger > 45 ? pick([3, 4]) : pick([0, 1, 2]) }); }
      // a glass of tea to cool him down
      this.calmT -= dt;
      if (this.calmT <= 0 && g.anger >= 45 && g.dad.state === 'routine' && g.dad.seat && !g.flags.guests) { this.calmT = 55; this.mode = 'tea'; this.pose = null;
        this.goTo(g.dad.x - 0.8, g.dad.z + 0.9, { speed: 1.3, onArrive: () => { this.face(g.dad.x, g.dad.z); this.say('mom.calm'); g.addAnger(-10, 'tea'); g.later(2.6, () => { this.mode = 'kitchen'; this.t = 0; }); } }); }
      else if (this.calmT <= 0) this.calmT = 8;
    }
    this.char.look = this.dist(p) < 3.5 ? p.char.headPos(V) : null;
    this.moveUpdate(dt);
    this.char.update(dt);
  }
  // Called when dad is about to punish: mom steps in if she owes you one.
  cover() { this.pose = null; this.face(this.game.dad.x, this.game.dad.z); this.setPose('f_gestic_talk_angry_01'); this.say('mom.cover', { loud: true }); this.game.later(3, () => { this.pose = null; this.t = 0; }); }
}

// =====================================================================================================
const SIB_ROOM = { big: 'boys', kid: 'boys', sis: 'sis' };
const WANDER = { snitch: ['hall', 'living', 'kitchen', 'own', 'hall', 'own'], chaos: ['hall', 'living', 'kitchen', 'own', 'boys', 'hall'] };

export class Sibling extends Actor {
  constructor(game, char, key) {
    const f = key === 'sis';
    super(game, char, key, f ? { idle: 'f_idle_neutral_01', walk: 'f_walk_neutral_01', run: 'f_run_neutral_01' } : { idle: 'm_idle_neutral_01', walk: 'm_walk_neutral_01', fast: 'm_walk_fast_01', run: 'm_run_neutral_01' });
    this.eye = key === 'kid' ? 1.15 : 1.45;
    this.reset('none', {});
  }
  reset(role, cfg) {
    this.role = role; this.cfg = cfg; this.t = rnd(4, 9); this.meter = 0; this.snitchCd = 0; this.chaosT = cfg.chaos ? rnd(cfg.chaos[0] * 0.5, cfg.chaos[1] * 0.8) : Infinity;
    this.blamed = false; this.halt(); this.pose = null; if (this.seat) { this.seat = null; this.char.lying = 0; } this.char.visible = true; this.locked = null; this.teaseT = rnd(20, 40);
  }
  lines(kind) {
    const k = this.key;
    if (kind === 'snitch') return k === 'sis' ? 'sis.snitch' : k === 'kid' ? 'kid.snitch' : 'big.snitch';
    if (kind === 'blamed') return k === 'sis' ? 'sis.blamed' : k === 'kid' ? 'kid.blamed' : 'big.blamed';
    if (kind === 'chaos') return k === 'kid' ? 'kid.chaos' : k === 'big' ? 'big.lazy' : 'sis.tease';
    return 'sis.tease';
  }
  getBlamed(dad) {
    this.blamed = true; this.halt(); this.face(dad.x, dad.z); this.setPose('m_gestic_listen_sad_01');
    this.game.later(2.2, () => this.say(this.lines('blamed')));
    this.game.later(11, () => { this.blamed = false; this.pose = null; });
  }
  roomPoint(name) {
    const w = this.game.world, R = ROOMS[name === 'own' ? SIB_ROOM[this.key] : name];
    for (let i = 0; i < 12; i++) { const x = rnd(R.x0 + 0.6, R.x1 - 0.6), z = rnd(R.z0 + 0.6, R.z1 - 0.6); if (w.cellFree(x, z)) return [x, z]; }
    return [R.cx, R.cz];
  }
  update(dt) {
    const g = this.game, p = g.player, w = g.world;
    if (this.locked) { this.char.update(dt); return; }       // e.g. in the bathroom with the door locked
    if (!this.blamed) {
      // wander
      this.t -= dt;
      if (this.t <= 0 && !this.moving && !this.acting) {
        this.t = rnd(7, 15); this.pose = null;
        const [x, z] = this.roomPoint(pick(WANDER[this.role] || WANDER.snitch));
        this.goTo(x, z, { speed: this.role === 'chaos' ? 2.0 : 1.2, onArrive: () => { if (Math.random() < 0.5) this.setPose(pick(['m_idle_look_around_01', 'm_cell_phone_textmessage', 'm_idle_scratch_head_01'])); } });
      }
      if (this.role === 'snitch') this.snitch(dt);
      if (this.role === 'chaos') this.chaos(dt);
    }
    this.char.look = this.dist(p) < 4 ? p.char.headPos(V) : null;
    this.moveUpdate(dt);
    this.char.update(dt);
  }
  snitch(dt) {
    const g = this.game, p = g.player;
    const bad = p.act === 'phone' || p.act === 'ps' || p.act === 'eat' || p.act === 'tvwatch' || p.act === 'snoop' || p.act === 'sleep';
    const bribed = g.now < g.bribeUntil;
    if (bad && !bribed && g.now > this.snitchCd && this.canSee(p, 8, 0.2)) {
      this.meter += dt / 1.3;
      g.snitchWatch = Math.max(g.snitchWatch, this.meter);
      if (this.meter >= 1) {
        this.meter = 0; this.snitchCd = g.now + 26;
        this.halt(); this.face(p.x, p.z); this.setPose('m_take_picture'); g.later(2.2, () => { this.pose = null; });
        this.say(this.lines('snitch'), { loud: true });
        g.onSnitch(this);
      }
    } else this.meter = Math.max(0, this.meter - dt * 0.6);
    this.teaseT -= dt;
    if (this.teaseT <= 0) { this.teaseT = rnd(30, 50); if (this.dist(p) < 4 && !this.talking && g.anger > 40 && this.key === 'sis') this.say('sis.tease'); }
  }
  chaos(dt) {
    const g = this.game, w = g.world;
    this.chaosT -= dt;
    if (this.chaosT > 0 || this.acting || g.flags.guests && false) return;
    this.chaosT = rnd(this.cfg.chaos[0], this.cfg.chaos[1]);
    const options = [];
    const dadRoom = g.dad.room;
    for (const d of Object.values(w.devices)) {
      if (d.on || d.room === dadRoom || d.type === 'heater' && !g.seg.dad.strict) continue;
      if (d.type === 'light' && (d.room === g.player.room)) continue;
      if (d.type === 'tv' && g.dad.watchingTv) continue;
      if (d.type === 'console' && this.key === 'kid' && g.player.key === 'big') continue;
      options.push({ dev: d });
    }
    if (Math.random() < 0.3 && g.messes.length < 3) options.push({ mess: true });
    if (!options.length) return;
    const o = pick(options);
    this.acting = true; this.pose = null;
    const done = () => { this.acting = false; this.t = 0.5; };
    if (o.mess) {
      const [x, z] = this.roomPoint(pick(['hall', 'living', 'kitchen']));
      this.goTo(x, z, { speed: 2.2, onArrive: (ok) => { if (ok) { g.spawnMess(this.key === 'kid' ? 'juice' : 'plate', this.x + 0.3, this.z, this.key); this.say(this.lines('chaos')); } done(); } });
    } else {
      const d = o.dev;
      this.goTo(d.x, d.z, { speed: 2.2, onArrive: (ok) => {
        if (ok) { g.setDevice(d.id, true, this.key); sfx.click(); if (Math.random() < 0.7) this.say(this.lines('chaos'));
          // dad right there? then it's on the little devil himself
          if (g.dad.canSee({ x: this.x, z: this.z, eyeNow: 1 }, 9, 0.4) && g.dad.state === 'routine' && !g.flags.guests) { g.setDevice(d.id, false, 'dad'); g.dad.blame(this, 'dad.blame.' + this.key); g.addAnger(2, 'sib'); }
        }
        done();
      } });
    }
    g.later(14, () => { if (this.acting) done(); });
  }
}

// Thursday's guests: they sit, they talk, they judge.
export class Guest extends Actor {
  constructor(game, char, key) {
    super(game, char, key, key === 'aunt' ? { idle: 'f_idle_neutral_01', walk: 'f_walk_neutral_01', run: 'f_run_neutral_01' } : { idle: 'm_idle_neutral_01', walk: 'm_walk_neutral_01', run: 'm_run_neutral_01' });
    this.talkT = rnd(5, 9); this.served = {};
  }
  update(dt) {
    const g = this.game, p = g.player;
    if (!this.char.visible) return;
    this.talkT -= dt;
    if (this.talkT <= 0 && this.seat) {
      this.talkT = rnd(11, 19);
      if (!g.dad.talking) { this.say(this.key === 'aunt' ? 'aunt.talk' : 'uncle.talk', { index: this.key === 'uncle' ? pick([1, 2, 3, 4]) : undefined }); this.char.overlay('m_gestic_talk_neutral_01', { mask: 'upper' }); g.later(3, () => this.char.overlay(null)); }
    }
    this.char.look = this.dist(p) < 4 ? p.char.headPos(V) : null;
    this.moveUpdate(dt);
    this.char.update(dt);
  }
}
