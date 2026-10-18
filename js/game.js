// The director: one day of the week at a time. Owns the rules (anger, jobs, errands, punishments)
// and referees between the player, dad and the rest of the family.
import * as THREE from 'three';
import { A, BASE, flatMat } from './assets.js';
import { input } from './input.js';
import { sfx, pickLine, playVoice, playBuffer, setTension, setTv, audio } from './audio.js';
import { Player, TRAITS } from './player.js';
import { Dad, Mom, Sibling, Guest } from './npc.js';
import { DAYS, ITEMS, TRAY, COMMANDS, PUNISH, MOM_TASKS } from './days.js';
import { ui } from './ui.js';
import { makeItem, teaGlass, waterGlass, finjan } from './props.js';
import { Stations, FX_SECS } from './stations.js';
import { Mishaps, RUN_RISK } from './mishap.js';
import { Street } from './street.js';
import { Tv } from './tv.js';
import { Outfit } from './outfit.js';
import { Cctv } from './cctv.js';
import { Delivery } from './delivery.js';
import { Vendors } from './vendors.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const NAMES = { gasman: 'أبو علي (الغاز)', vegman: 'أبو أحمد (الخضرة)', rider: 'كابتن طلبات', dad: 'أبوك', mom: 'أمك', big: 'سيف', kid: 'حمودة', sis: 'سلمى', uncle: 'عمك أبو فراس', aunt: 'مرت عمك' };
const SELF = {
  big: { bed: 'bed_big', bedSide: [12.05, 1.6], desk: 'desk_boys', wardrobe: 'wardrobe_boys', pile: [12.5, 3.5], room: 'boys' },
  kid: { bed: 'bed_kid', bedSide: [14.45, 1.6], desk: 'desk_boys', wardrobe: 'wardrobe_boys', pile: [13.9, 3.4], room: 'boys' },
  sis: { bed: 'bed_sis', bedSide: [8.5, 1.6], desk: 'desk_sis', wardrobe: 'wardrobe_sis', pile: [9.1, 3.4], room: 'sis' },
};
const ROLES = { big: { sis: 'snitch', kid: 'chaos' }, kid: { sis: 'snitch', big: 'chaos' }, sis: { big: 'snitch', kid: 'chaos' } };
const GV = new THREE.Vector3(), GH = new THREE.Vector3(), GX = new THREE.Vector3(), GR = new THREE.Vector3(), GB = new THREE.Vector3(), GS = new THREE.Vector3(), GE = new THREE.Vector3(), GL = new THREE.Vector3();
function vaseMesh(big) {
  const g = new THREE.Group(), s = big ? 1.7 : 1;
  const body = new THREE.Mesh(new THREE.LatheGeometry([[0.03, 0], [0.09, 0.03], [0.11, 0.14], [0.06, 0.26], [0.04, 0.3], [0.06, 0.33]].map(([x, y]) => new THREE.Vector2(x * s, y * s)), 14), flatMat(0x2c6b8f, { rough: 0.2 }));
  body.castShadow = true; g.add(body);
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.035 * s, 8, 6), flatMat(i % 2 ? 0xd24b6a : 0xf0c23a)); f.position.set(Math.cos(i * 1.6) * 0.05 * s, (0.4 + (i % 2) * 0.05) * s, Math.sin(i * 1.6) * 0.05 * s); g.add(f); }
  return g;
}

export class Game {
  constructor(app) {
    this.app = app; this.scene = app.scene; this.camera = app.camera; this.world = app.world; this.chars = app.chars;
    this.dad = new Dad(this, this.chars.dad);
    this.mom = new Mom(this, this.chars.mom);
    this.sibAll = { big: new Sibling(this, this.chars.big, 'big'), kid: new Sibling(this, this.chars.kid, 'kid'), sis: new Sibling(this, this.chars.sis, 'sis') };
    this.guests = {};
    for (const k of ['uncle', 'aunt']) if (this.chars[k]) this.guests[k] = new Guest(this, this.chars[k], k);
    this.dad.slipperMesh = makeItem('slipper'); this.dad.slipperMesh.visible = false; this.scene.add(this.dad.slipperMesh);
    this.markers = new THREE.Group(); this.scene.add(this.markers);
    this.props = new THREE.Group(); this.scene.add(this.props);
    this.markerPool = [];
    this.placed = {};
    this.stations = new Stations(this);
    this.mishaps = new Mishaps(this);
    this.street = new Street(this);
    this.tv = new Tv(this);
    this.cctv = new Cctv(this);
    this.delivery = new Delivery(this);
    this.vendors = new Vendors(this);
    for (const k of ['big', 'kid', 'sis']) if (this.chars[k]) this.chars[k].outfit = new Outfit(this.chars[k]);
    // doors are heard only from nearby: the whole family walks through them all day
    this.world.onDoor = (d, opening) => { const p = this.player; if (!p || Math.hypot(d.x - p.x, d.z - p.z) > 8) return; const pos = { x: d.x, y: 1, z: d.z }; if (opening) sfx.door(pos); else sfx.doorShut(pos); };
    this.active = false; this.paused = false; this.now = 0;
    this.timers = [];
    this.save = this.loadSave();
  }

  // ---------- save ----------
  loadSave() { try { return JSON.parse(localStorage.getItem('jumaa.v1')) || {}; } catch { return {}; } }
  progress(key) { return this.save[key] || (this.save[key] = { unlocked: 0, stars: [] }); }
  storeSave() { try { localStorage.setItem('jumaa.v1', JSON.stringify(this.save)); } catch { /* private mode */ } }

  later(sec, fn) { this.timers.push({ at: this.now + sec, fn }); }

  // ---------- day / segment set-up ----------
  start(dayIndex, playerKey) {
    this.dayIndex = dayIndex; this.day = DAYS[dayIndex]; this.playerKey = playerKey;
    this.segIndex = 0; this.anger = 8; this.peak = 8; this.debt = 0; this.tokens = 0; this.forgiven = false; this.over = false; this.result = null;
    this.stats = { caught: 0, spotted: 0, hits: 0, dodged: 0, lectures: 0, confiscations: 0, errands: 0, late: 0, wasted: 0, woke: 0, snitched: 0, framed: 0, escapes: 0, secrets: 0, secretsTotal: 0, chores: 0, choresTotal: 0, covered: 0, broke: 0, time: 0 };
    this.confiscated = null; this.consoleLocked = false; this.bribeUntil = 0; this.mellowUntil = 0; this.punishUsed = [];
    for (const k in this.sibAll) this.chars[k].visible = true;
    this.player = new Player(this, this.chars[playerKey], playerKey);
    this.sibs = Object.keys(ROLES[playerKey]).map((k) => this.sibAll[k]);
    this.now = 0; this.timers = [];
    this.world.car.setClean(0);
    this.wearing = this.day.segs[0].startAsleep ? 'pyjama' : 'home';      // the player's clothes; the dress job changes them
    this.startSeg(true);
  }

  startSeg(first) {
    const seg = this.seg = this.day.segs[this.segIndex], w = this.world, p = this.player, me = SELF[this.playerKey];
    this.timers = []; this.segT = 0; this.ended = false; this.active = true; this.paused = false;
    this.flags = { guests: !!seg.guests, meal: !!seg.meal };
    this.finishAdded = false; this.needRelease = false;
    this.interaction = null; this.stay = null; this.lecture = null; this.snitchWatch = 0; this.rageOn = false; this.heaterT = 0; this.finalDone = false;
    w.setTime(seg.tod);
    for (const d of Object.values(w.devices)) { d.set(false); d.by = null; d.ignoreUntil = 0; }
    for (const r of seg.lightsOn || []) w.devices['light_' + r].set(true);
    for (const d of w.doors) d.locked = false;
    // clear the floor
    this.clearProps();
    this.messes = []; this.pickups = []; this.projectiles = []; this.mishaps.reset(); this.street.reset(seg); this.delivery.reset(); this.vendors.reset(seg);
    this.vases = w.fragile.map((f) => { const m = vaseMesh(f.big); m.position.set(f.x, f.y, f.z); this.props.add(m); return { ...f, mesh: m, broken: false }; });
    if (p.carrying) { this.scene.remove(p.carrying.mesh); p.carrying = null; }
    p.state = 'free'; p.act = null; p.pose = null; p.phoneOut = false; p.sneaking = false; p.hide = null; p.camOverride = null; p.char.lying = 0; p.char.visible = true; p.char.pos.y = 0; p.char.overlay(null);
    if (first || seg.startAsleep) { const [x, z] = me.bedSide; p.char.place(x, z, 0); p.yaw = Math.PI; }
    p.camPos.set(p.x, 2, p.z + 2);
    // family
    this.dad.reset(seg.dad);
    if (seg.dad.mode === 'seated') { this.dad.sit(w.seats[seg.dad.seat]); this.dad.setState('seated'); } else if (seg.dad.mode === 'car') this.dad.char.place(w.spots.carhorn.x, w.spots.carhorn.z + 0.3, Math.PI);
    else if (first || this.segIndex > 0) { if (first) this.dad.char.place(9.4, 8.2, -Math.PI / 2); }
    this.mom.reset(); if (first) this.mom.char.place(14.6, 9.6, 0);
    const roles = ROLES[this.playerKey];
    this.sibs.forEach((s, i) => {
      s.reset(roles[s.key], seg.sibs && seg.sibs.chaos && roles[s.key] === 'chaos' ? { chaos: seg.sibs.chaos } : {});
      if (first) { const r = SELF[s.key]; s.char.place(r.bedSide[0], r.bedSide[1] + 1.2 + i * 0.4, 0); }
    });
    if (seg.bathBusy) {
      const s = this.sibAll[this.playerKey === 'sis' ? 'big' : 'sis'];
      s.char.place(5.75, 2.7, 0); s.locked = true; s.setPose('m_idle_look_around_01');
      const door = w.doors.find((d) => d.id === 'bath'); door.locked = true; this.bathSib = s;
      this.later(seg.bathBusy, () => { door.locked = false; s.locked = false; s.pose = null; s.t = 0; this.bathSib = null; this.toast('فضي الحمّام!', 'good'); });
    } else this.bathSib = null;
    if (seg.sibsAt === 'table') [[12.15, 7.72, 0], [12.9, 7.72, 0]].forEach(([x, z, h], i) => { const s = this.sibs[i]; if (s) { s.char.place(x, z, h); s.role = 'none'; s.t = 9999; s.setPose('m_work_mid'); } });
    for (const a of [this.dad, this.mom, ...Object.values(this.guests)]) if (a.gift) { this.scene.remove(a.gift.mesh); a.gift = null; a.char.reachTo('R', null); a.char.grip = 0; }
    for (const g of Object.values(this.guests)) { g.char.visible = false; g.seat = null; g.halt(); g.char.place(30, 30, 0); g.served = {}; }
    // jobs
    this.tasks = (seg.tasks || []).filter((t) => !t.only || t.only.includes(this.playerKey)).map((t) => this.makeTask(t));
    this.stats.choresTotal += this.tasks.filter((t) => t.kind === 'chore').length;
    this.stats.secretsTotal += this.tasks.filter((t) => t.kind === 'secret').length;
    this.events = (seg.events || []).map((e) => ({ ...e, done: false }));
    if (seg.angerFloor) this.anger = Math.max(this.anger, seg.angerFloor);
    this.floor = 0;
    for (const t of this.tasks) this.stepBegin(t);
    // clothes: you in whatever you have on; the other two already dressed for the day once there is a reason to be
    for (const k of ['big', 'kid', 'sis']) {
      const c = this.chars[k]; if (!c || !c.outfit || !c.outfit.ok) continue;
      if (k === this.playerKey) c.outfit.wear(this.wearing);
      else c.outfit.wear(this.day.id === 'sun' || ((this.day.id === 'thu' || this.day.id === 'fri') && this.segIndex > 0) ? this.dayWear() : 'home');
    }
    this.placed = {};
    this.stations.reset(this.tasks, this.playerKey, SELF[this.playerKey]);
    if (seg.startAsleep) { const t = this.tasks.find((k) => k.steps[0] && k.steps[0].act === 'sleep'); this.enterStay(t || null, t ? t.steps[0] : { stay: '@bed', lie: true, act: 'sleep', secs: 1e9 }); }
    ui.hud(true); ui.screen(null);
    this.hud(0, true);
    if (first) this.later(0.8, () => this.dad.say(this.day.intro, { loud: true, far: true }));
    else if (seg.dad.plan[0] && !seg.dad.plan[0].line) { /* quiet start */ }
  }

  // what today's dress job puts you in
  dayWear() { return { sun: 'school', thu: 'smart', fri: 'friday' }[this.day.id] || 'home'; }

  clearProps() { while (this.props.children.length) this.props.remove(this.props.children[0]); for (const m of this.markerPool) m.visible = false; }

  makeTask(def, extra = {}) {
    const t = { ...def, steps: def.steps.map((s) => ({ ...s })), i: 0, prog: 0, done: false, ...extra };
    if (t.time) t.left = t.time;
    return t;
  }

  // ---------- helpers ----------
  spot(id) {
    if (!id) return null;
    if (typeof id === 'object') return id;
    const me = SELF[this.playerKey], w = this.world;
    if (id === '@bed') return { x: me.bedSide[0], z: me.bedSide[1], face: this.playerKey === 'sis' || this.playerKey === 'kid' ? (this.playerKey === 'kid' ? Math.PI / 2 : -Math.PI / 2) : -Math.PI / 2, seat: w.seats[me.bed] };
    if (id === '@desk') return w.spots[me.desk];
    if (id === '@wardrobe') return w.spots[me.wardrobe];
    if (id === '@pile') return { x: me.pile[0], z: me.pile[1], face: 0 };
    return w.spots[id] || w.devices[id] || null;
  }
  actor(key) { return key === 'dad' ? this.dad : key === 'mom' ? this.mom : key === 'gasman' || key === 'vegman' ? (this.vendors.suited ? this.vendors.man : null) : this.guests[key] || this.sibAll[key]; }
  sibRole(role) { return this.sibs.find((s) => s.role === role); }
  anyoneIn(room) {
    const w = this.world, at = (a) => w.roomAt(a.x, a.z) === room;
    if (at(this.player) || (!this.dad.away && at(this.dad)) || at(this.mom)) return true;
    return this.sibs.some(at) || Object.values(this.guests).some((g) => g.char.visible && at(g));
  }
  inTvLine(p) { const L = this.world.tvLine; return p.x > L.x0 && p.x < L.x1 && p.z > L.z0 && p.z < L.z1; }
  wasteful(dev) {
    if (!dev.on) return false;
    const p = this.player;
    switch (dev.type) {
      case 'light':
        if (this.flags.guests && ['salon', 'hall', 'kitchen'].includes(dev.room)) return false;
        if (!this.world.dark) return true;
        return !this.anyoneIn(dev.room);
      case 'ac': return !(this.flags.guests && dev.room === 'salon');
      case 'tv': return !this.dad.watchingTv && p.act !== 'tvwatch';
      case 'fridge': return Math.hypot(p.x - dev.x, p.z - dev.z) > 1.5;
      case 'heater': return !!this.seg.dad.strict || this.heaterT > 45;
      case 'console': return p.act !== 'ps';
      default: return false;
    }
  }
  wasteCount() { let n = 0; for (const d of Object.values(this.world.devices)) if (this.wasteful(d)) n++; return n; }
  setDevice(id, on, by) {
    const d = this.world.devices[id]; if (!d || d.on === on) return;
    d.set(on); d.by = on ? by : null; d.ignoreUntil = 0;
    if (id === 'heater') this.heaterT = 0;
  }
  toast(text, kind) { ui.toast(text, kind); }
  noise(x, z, r, kind, by) { if (r > 0) this.dad.hear({ x, z, r, kind, by }); }

  addAnger(n, why, passive) {
    if (this.over) return;
    if (n > 0 && !passive) n *= this.player.t.angerMult;
    this.anger = clamp(this.anger + n, this.seg.angerFloor || 0, 100);
    this.peak = Math.max(this.peak, this.anger);
    this.dad.onAnger();
  }

  // Speak a line: recorded voice when there is one, a grunt otherwise, always with a subtitle if you're near enough.
  say(actor, cat, { index, loud, whisper, far, horn } = {}) {
    if (!A.lines.lines[cat]) { const m = /^(.*)\.(\d+)$/.exec(cat); if (m) { cat = m[1]; index = +m[2]; } }
    const entry = A.lines.lines[cat];
    if (!entry) return 0;
    let line;
    if (index != null) {
      const i = Math.min(index, entry.t.length - 1), id = `${cat}.${i}`, v = A.voice[id];
      line = { id, text: entry.t[i], has: !!v, dur: v ? v.d : Math.max(1.2, entry.t[i].length * 0.075) };
    } else line = pickLine(cat);
    if (actor.voice) actor.voice.stop();
    const pos = { x: actor.x, y: 1.5, z: actor.z };
    const d = Math.hypot(actor.x - this.player.x, actor.z - this.player.z);
    if (line.has) actor.voice = playVoice(line.id, horn ? { x: actor.hornX ?? actor.x, y: 2.2, z: actor.hornZ ?? actor.z } : far || d < 1.2 ? null : pos, { gain: whisper ? 0.7 : horn ? 1.6 : loud ? 1.3 : 1, ref: horn ? 9 : loud ? 5 : 2.8, horn });
    else if (line.id === 'dad.mutter.8') sfx.cough(pos);       // his famous throat-clearing has no recording
    else if (actor.key === 'dad') sfx.grunt(pos, 1); else sfx.grunt(pos, actor.key === 'kid' ? 2.6 : actor.key === 'big' ? 1.4 : 2.1);
    actor.talkUntil = this.now + line.dur;
    if (actor.key === 'dad' && line.text.includes('تفو')) { this.later(0.15, () => this.spit(actor)); if (line.text.lastIndexOf('تفو') > 4) this.later(line.dur * 0.72, () => this.spit(actor)); }
    const isDad = actor.key === 'dad';
    if (d < (loud || far ? 30 : 9) && (isDad || this.now > (this.capUntil || 0))) {
      ui.caption(NAMES[actor.key] || '', whisper ? `(بيهمس) ${line.text}` : line.text, line.dur + 0.5, isDad ? (loud ? 'dad loud' : 'dad') : '');
      if (isDad) this.capUntil = this.now + line.dur;
    }
    return line.dur;
  }

  // «تفو»: a dry little spit off to one side, the way dads do
  spit(a) {
    const c = a.char, h = c.root.rotation.y, m = c.headPos(new THREE.Vector3());
    const from = { x: m.x + Math.sin(h) * 0.13, y: m.y - 0.07, z: m.z + Math.cos(h) * 0.13 };
    const dir = { x: Math.sin(h) * 1.5 + Math.cos(h) * 0.7, y: 0.5, z: Math.cos(h) * 1.5 - Math.sin(h) * 0.7 };
    sfx.spit(from);
    for (let i = 0; i < 7; i++) this.stations.fx.emit('spit', from, dir, 0.5);
    c.leanTarget = 0.32; this.later(0.2, () => { c.leanTarget = 0; });          // the little jab of the head that goes with it
  }

  // ---------- things on the floor ----------
  spawnPickup(item, x, z, extra = {}) {
    const mesh = makeItem(item); mesh.position.set(x, extra.y || 0, z); mesh.rotation.y = Math.random() * 6;
    this.props.add(mesh);
    const p = { item, x, z, mesh, ...extra };
    this.pickups.push(p);
    return p;
  }
  removePickup(p) { this.props.remove(p.mesh); this.pickups = this.pickups.filter((k) => k !== p); }
  spawnMess(kind, x, z, by) {
    [x, z] = this.world.nearestFree(x, z);
    const portable = kind === 'plate' || kind === 'vase';
    const m = { kind, x, z, by, seen: false, portable, framedOn: null };
    if (portable) { m.pickup = this.spawnPickup(kind, x, z, { mess: m }); m.mesh = m.pickup.mesh; } else { m.mesh = makeItem({ tea: 'teaspill', water: 'waterspill', coffee: 'coffeespill', laban: 'labanspill', kunafa: 'kunafaspill', mansaf: 'mansafspill' }[kind] || kind); m.mesh.position.set(x, 0, z); m.mesh.rotation.y = Math.random() * 6; this.props.add(m.mesh); }
    this.messes.push(m);
    return m;
  }
  removeMess(m) { this.mishaps.clearExtra(m); if (m.pickup) this.removePickup(m.pickup); else this.props.remove(m.mesh); this.messes = this.messes.filter((k) => k !== m); this.tasks = this.tasks.filter((t) => t.mess !== m); }
  onMessSeen(m) {
    const dad = this.dad, pk = this.playerKey;
    if (this.flags.guests) { this.debt += 6; return; }
    const culprit = m.framedOn || (m.by !== 'player' && pk !== 'big' ? m.by : null);
    if (culprit && culprit !== pk && this.sibAll[culprit] && this.sibs.includes(this.sibAll[culprit])) {
      dad.blame(this.sibAll[culprit], 'dad.blame.' + culprit); this.addAnger(3, 'mess');
      if (m.framedOn) { this.stats.framed++; this.toast('لبّستها لغيرك 😈', 'good'); }
      this.later(18, () => this.removeMess(m));
      return;
    }
    dad.say(dad.messCat(m.kind), { loud: true }); this.addAnger(m.by === 'player' ? 10 : 7, 'mess'); dad.scold();
    if (m.by !== 'player' && pk === 'big') this.later(2.2, () => dad.say('dad.eldest', { loud: true }));
    if (!this.tasks.some((t) => t.mess === m)) this.tasks.push(this.makeTask({ id: 'clean' + this.now, title: 'نظّف اللي عالأرض!', kind: 'cmd', time: 26, steps: [{ clean: m }] }, { mess: m }));
  }

  carry(item, extra = {}) {
    const p = this.player;
    const mesh = makeItem(item); this.scene.add(mesh);
    p.carrying = { item, mesh, tray: TRAY.has(item), heavy: item === 'mansaf' || item === 'gasFull', slow: item === 'gasFull' ? 0.6 : item === 'gasEmpty' ? 0.88 : 0, ...extra };
    if (p.phoneOut) p.phone(false);
    this.stations.putDown(p, true);         // two hands on the tray: the bucket stays where you were
    sfx.pick();
  }
  uncarry() { const p = this.player; if (!p.carrying) return null; const c = p.carrying; this.scene.remove(c.mesh); p.carrying = null; p.holding = false; p.char.release(); return c; }
  // The thing you hand over ends up in their hand, and they use it.
  handOver(item, a) {
    const kind = item === 'tea' ? teaGlass(1) : item === 'coffee' ? finjan(1) : item === 'water' ? waterGlass(1) : ['remote', 'glasses', 'paper', 'charger', 'slipper'].includes(item) ? makeItem(item) : null;
    if (!kind || !a.char) return;
    if (a.gift) this.scene.remove(a.gift.mesh);
    const drink = ['tea', 'coffee', 'water'].includes(item);
    const paper = item === 'paper' && !!a.seat;
    this.scene.add(kind); a.gift = { mesh: kind, until: this.now + (drink ? 16 : 6), drink, sip: 1.4, paper, drop: item === 'water' ? 0.04 : item === 'tea' ? 0.015 : 0,
      tall: item === 'water' ? 0.105 : item === 'tea' ? 0.08 : 0.055, rim: item !== 'water' };       // (tea and coffee are hot: held by the rim)
    if (item === 'tea') kind.children[1].visible = false;       // the saucer stays on the tray
    if (paper) a.char.overlay('m_newspaper_arm_idle', { mask: 'arms' });
  }
  updateGifts(dt) {
    for (const a of [this.dad, this.mom, ...Object.values(this.guests)]) {
      const g = a.gift; if (!g) continue;
      const c = a.char, h = c.root.rotation.y, fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h), s = c.height / 1.72, head = c.headPos(GV);
      g.mesh.visible = c.visible;
      // held in front of the chest, wherever they sit or stand; a drink goes up to the mouth every few seconds
      let k = 0;
      if (g.drink) {
        g.sip -= dt;
        if (g.sip <= -1.7) { g.sip = 3 + Math.random() * 2.5; if (g.mesh.userData.level) { g.left = (g.left ?? 1) - 0.3; g.mesh.userData.level(Math.max(0.05, g.left)); } }
        if (g.sip < 0) { const q = Math.sin(Math.min(1, -g.sip / 1.7) * Math.PI); k = q * q * (3 - 2 * q); }
      }
      const f = 0.24 + (0.13 - 0.24) * k, r = 0.2 + (0.08 - 0.2) * k, d = 0.47 + (0.05 - 0.47) * k;
      if (g.paper || a.rage) { c.handPos('R', g.mesh.position); g.mesh.rotation.set(0, h, 0); } else if (g.drink) {
        // a sip: the rim comes to the lower lip and the glass tips up towards the face; the hand stays round it
        // (round its middle for water; a hot tea glass or a finjan by the rim, in the fingertips)
        c.grip = 1;
        const tilt = 1.05 * k, sa = Math.sin(tilt), ca = Math.cos(tilt), H = g.tall;
        const ax = GX.set(-fx * sa, ca, -fz * sa);
        // the lower lip: under the eyes and a touch in front of them
        const B = c.bones, eyes = B.LEye ? B.LEye.getWorldPosition(GE).add(B.REye.getWorldPosition(GL)).multiplyScalar(0.5) : GE.set(head.x + fx * 0.09, head.y + 0.03, head.z + fz * 0.09);
        const lip = GR.set(eyes.x + fx * 0.03 * s, eyes.y - 0.085 * s, eyes.z + fz * 0.03 * s);
        g.k = k;
        if (k > 0.15) c.look = (g.lookAt || (g.lookAt = new THREE.Vector3())).set(eyes.x + fx * 2, eyes.y + 1.1 * k, eyes.z + fz * 2);      // chin up to drink
        const base = GB.copy(lip).addScaledVector(ax, -H);
        const sipHand = GS.copy(base).addScaledVector(ax, H * (g.rim ? 0.8 : 0.45));
        sipHand.x += (rx * 0.06 + fx * 0.01) * s; sipHand.z += (rz * 0.06 + fz * 0.01) * s; sipHand.y -= 0.06 * s;
        c.reachTo('R', GH.set(head.x + (fx * 0.24 + rx * 0.2) * s, head.y - 0.47 * s, head.z + (fz * 0.24 + rz * 0.2) * s).lerp(sipHand, k));
        c.reach.R.pole = k > 0.05 ? [-0.2 - 0.4 * (1 - k), -1, 0.25 * k] : null;      // the elbow stays down and in front while he drinks
        c.gripPos(g.mesh.position, 0.085, 0.038, g.drop);
        if (k > 0) g.mesh.position.lerp(base, k);
        g.mesh.rotation.set(-tilt, h, 0, 'YXZ');
      } else {
        c.reachTo('R', GH.set(head.x + (fx * f + rx * r) * s, head.y - d * s, head.z + (fz * f + rz * r) * s), 0.72);      // the remote, the glasses, the charger: in his fingers
        { c.handPos('R', g.mesh.position); g.mesh.position.y += 0.02; g.mesh.position.x += fx * 0.08; g.mesh.position.z += fz * 0.08; g.mesh.rotation.set(0, h, 0); }
      }
      if (this.now > g.until || a.rage) { this.scene.remove(g.mesh); a.gift = null; c.reachTo('R', null); c.reach.R.pole = null; c.grip = 0; c.overlay(null); }
    }
  }
  // The tray you served from is set down on the nearest table, not into thin air.
  setDown(c, near) {
    const t = [{ x: 8.0, z: 9.75, y: 0.432 }, { x: 2.5, z: 9.3, y: 0.452 }, { x: 12.5, z: 8.5, y: 0.79 }].map((k) => ({ k, d: Math.hypot(k.x - near.x, k.z - near.z) })).sort((a, b) => a.d - b.d)[0];
    if (t.d > 4.5) return;
    const m = c.mesh, from = m.position.clone(), to = new THREE.Vector3(t.k.x + (from.x > t.k.x ? 0.24 : -0.24), t.k.y, t.k.z + 0.05);
    this.props.add(m); m.visible = true; m.rotation.set(0, 0, 0);
    this.stations.tween(0.55, (q) => { const e = q * q * (3 - 2 * q); m.position.lerpVectors(from, to, e); m.position.y += Math.sin(Math.PI * q) * 0.1; }, () => sfx.clink && sfx.clink(to));
    this.later(25, () => this.props.remove(m));
  }
  // where a thing is set down on the table in front of a spot (two things never land on the same place)
  dropPoint(item, s, at) {
    const side = item === 'laban' ? 0.42 : item === 'cups' ? -0.36 : 0, y = at === 'salontable' ? 0.46 : at === 'coffeetable' ? 0.43 : 0.79;
    return new THREE.Vector3(s.x + Math.sin(s.face) * 0.75 + Math.cos(s.face) * side, y, s.z + Math.cos(s.face) * 0.75 - Math.sin(s.face) * side);
  }
  placeProp(item, s, at) {
    const m = makeItem(item); m.position.copy(this.dropPoint(item, s, at));
    this.props.add(m); this.placed[item] = m; return m;
  }

  // ---------- jobs ----------
  locked(t) { return t.needs && t.needs.some((id) => { const n = this.tasks.find((k) => k.id === id); return n && !n.done; }); }
  step(t) { return t.done ? null : t.steps[t.i]; }
  stepBegin(t) {
    const s = this.step(t); if (!s) return;
    if (s.find && !s.spawned) {
      s.spawned = true;
      if (s.find === 'slipper') return;
      const sp = this.spot(pick(s.spots));
      // on the furniture the spot belongs to, a little in front of where you'd stand
      const x = sp.x - Math.sin(sp.face) * -0.55 + rnd(-0.1, 0.1), z = sp.z - Math.cos(sp.face) * -0.55 + rnd(-0.1, 0.1);
      this.spawnPickup(s.find, x, z, { y: 0.02, lost: true });
    }
    if (s.pick && !s.shown && ['toys', 'paper'].includes(s.pick)) { s.shown = true; const sp = this.spot(s.at); const y = s.pick === 'toys' ? 0.02 : 0.02; s.prop = makeItem(s.pick); s.prop.position.set(sp.x + (s.pick === 'toys' ? 0.7 : 0), y, sp.z + (s.pick === 'toys' ? 0.4 : 0)); this.props.add(s.prop); }
    if (s.near && this.guests[s.near]) this.later(1.5, () => this.guests[s.near].say('uncle.talk', { index: 2, loud: true }));
  }
  advance(t) {
    t.i++; t.prog = 0;
    if (t.i >= t.steps.length) this.complete(t); else this.stepBegin(t);
  }
  complete(t) {
    t.done = true; t.doneAt = this.now;
    if (t.kind === 'secret') { this.stats.secrets++; sfx.secret(); this.toast('هدف سرّي: تم 😎', 'good'); } else if (t.kind === 'cmd') this.commandDone(t);
    else if (t.kind === 'mom') { if (t.id !== 'veg') this.mom.say('mom.thanks'); /* (the vegetables get their own thanks) */ this.tokens = Math.min(2, this.tokens + 1); this.addAnger(-4); sfx.done(); this.toast('أمك راضية عليك: بتغطّي عليك مرة 💚', 'good'); } else if (t.kind === 'punish') { sfx.done(); this.addAnger(-5); this.toast('خلصت العقاب', 'good'); } else { this.stats.chores++; sfx.done(); if (this.dad.seen && this.dad.calm && Math.random() < 0.5 && !this.flags.guests) this.later(0.6, () => this.dad.say('dad.praise')); }
    if (t.id === 'door' && this.flags.guests) this.guestsArrive();
  }
  canCommand() {
    const max = this.seg.dad.maxCmds || 1;
    return this.tasks.filter((t) => t.kind === 'cmd' && !t.done).length < max && this.dad.state === 'routine' && this.player.state !== 'lecture' && !this.flags.guests && !this.dad.rage && !this.over;
  }
  issueCommand(type, force) {
    if (!force && !this.canCommand()) return;
    if (this.tasks.some((t) => t.cmd === type && !t.done)) return;
    if (type === 'light' && !this.wasteCount()) type = 'water';
    const def = COMMANDS[type];
    const t = this.makeTask({ id: 'cmd_' + type + Math.round(this.now), title: def.title, kind: 'cmd', time: def.time, steps: def.steps }, { cmd: type });
    this.tasks.push(t); this.stepBegin(t);
    if (type !== 'slipper') this.dad.say(def.line, { loud: true });
    sfx.alarm();
  }
  cancelCommand(type) { this.tasks = this.tasks.filter((t) => t.cmd !== type || t.done); }
  commandDone(t) {
    this.stats.errands++; sfx.done();
    if (t.cmd === 'tea') { this.mellowUntil = this.now + 24; this.addAnger(-11); this.dad.say(Math.random() < 0.5 ? 'dad.tea' : 'dad.cmd.ok'); } else if (t.cmd === 'slipper') { this.addAnger(-12); this.dad.ammo = Math.min(2, this.dad.ammo + 1); this.dad.barefoot = false; this.dad.say('dad.cmd.ok'); } else if (t.cmd === 'callmom') { this.addAnger(-5); this.mom.goTo(this.dad.x - 0.9, this.dad.z + 0.8, { speed: 1.4 }); this.mom.mode = 'tea'; this.later(7, () => { this.mom.mode = 'kitchen'; this.mom.t = 0; }); } else if (t.mess) { this.addAnger(-3); } else { this.addAnger(-8); this.dad.say('dad.cmd.ok'); }
    this.later(3, () => { this.tasks = this.tasks.filter((k) => k !== t); });
  }
  canMomAsk() { return !this.tasks.some((t) => t.kind === 'mom' && !t.done) && this.tokens < 2 && !this.flags.guests && !this.flags.meal && !this.player.carrying; }
  momAsk() {
    const i = Math.floor(Math.random() * MOM_TASKS.length), def = MOM_TASKS[i];
    this.mom.say('mom.ask', { index: i, loud: true });
    const t = this.makeTask({ id: 'mom' + Math.round(this.now), title: def.title, kind: 'mom', steps: def.steps });
    if (this.playerKey === 'sis') t.left = t.time = 50;       // for Salma it isn't a favour, it's an order
    this.tasks.push(t); this.stepBegin(t);
  }
  deskCheck() {
    const dad = this.dad, desk = this.world.spots[SELF[this.playerKey].desk];
    dad.say('dad.wed.check', { index: 0, loud: true, far: true });
    this.toast('أبوك جاي يتفقد مكتبك!', 'bad');
    dad.setState('fix');
    dad.goTo(desk.x + 0.9, desk.z + 0.9, { speed: 1.6, onArrive: () => {
      const ok = this.player.act === 'study';
      dad.face(desk.x, desk.z);
      if (ok) { dad.say('dad.wed.check', { index: 1 }); this.addAnger(-6); } else { dad.say('dad.wed.check', { index: 2, loud: true }); this.addAnger(14, 'desk'); }
      this.later(2.2, () => { if (dad.state === 'fix') { dad.setState('routine'); dad.phase = 'idle'; } });
    } });
  }
  guestsArrive() {
    const w = this.world, seats = { uncle: 'salonW_1', aunt: 'salonW_0' };
    let i = 0;
    for (const [k, g] of Object.entries(this.guests)) {
      g.char.visible = true; g.char.place(16.9 + i * 0.6, 5.5, -Math.PI / 2); g.pose = null;
      this.later(0.8 + i * 1.2, () => g.goSit(w.seats[seats[k]], { speed: 1.2 }));
      i++;
    }
    this.later(0.6, () => this.guests.uncle && this.guests.uncle.say('uncle.talk', { index: 0, loud: true }));
    this.later(4, () => this.dad.say('dad.thu.fake', { index: 1 }));
  }

  // ---------- punishments ----------
  punish(type) {
    const p = this.player, dad = this.dad;
    if (this.over || p.state === 'lecture') return;
    if (this.tokens > 0) {             // mom steps in
      this.tokens--; this.stats.covered++;
      this.mom.cover(); dad.halt(); dad.setState('routine'); dad.phase = 'idle'; dad.grace = this.now + 7; dad.face(this.mom.x, this.mom.z);
      this.anger = Math.max(30, this.anger - 18); this.toast('أمك غطّت عليك 💚', 'good');
      return;
    }
    if (this.playerKey === 'sis' && !this.forgiven) {
      this.forgiven = true; dad.halt(); dad.say('dad.soft.sis'); dad.setState('routine'); dad.phase = 'idle'; dad.grace = this.now + 6;
      this.anger = Math.max(25, this.anger - 14); this.toast('«حبيبة بابا»… سامحك هالمرة', 'good');
      return;
    }
    if (type === 'confiscate') this.confiscate(); else this.startLecture();
  }
  startLecture() {
    const p = this.player, dad = this.dad;
    this.stats.lectures++;
    if (this.stay) this.exitStay(true);
    if (p.hidden) this.unhide(true);
    p.state = 'lecture'; p.act = null; if (p.phoneOut) p.phone(false);
    dad.halt(); dad.setState('frozen');
    // stand them face to face
    const ang = Math.atan2(p.x - dad.x, p.z - dad.z);
    let [x, z] = this.world.nearestFree(p.x - Math.sin(ang) * 1.25, p.z - Math.cos(ang) * 1.25);
    dad.char.pos.set(x, 0, z); dad.face(p.x, p.z); p.char.heading = Math.atan2(dad.x - p.x, dad.z - p.z);
    dad.setPose('m_gestic_talk_angry_01_xyz'); p.setPose('m_gestic_listen_sad_01');
    const dur = this.say(dad, 'dad.lecture', { loud: true, far: true });
    const n = dur > 10 ? 4 : 3, prompts = [];
    for (let i = 0; i < n; i++) prompts.push({ at: 1.8 + (dur - 3.2) * (i / (n - 1)) + rnd(-0.3, 0.3), state: 0 });
    this.lecture = { t: 0, dur, prompts, hits: 0, ending: false };
    this.toast('محاضرة! هزّ راسك بالوقت الصح', 'bad');
  }
  updateLecture(dt) {
    const L = this.lecture, p = this.player, dad = this.dad;
    L.t += dt;
    // camera over the kid's shoulder, on dad's face
    const hx = (p.x + dad.x) / 2, hz = (p.z + dad.z) / 2, ang = Math.atan2(p.x - dad.x, p.z - dad.z);
    const cx = p.x + Math.sin(ang) * 0.9 + Math.cos(ang) * 0.55, cz = p.z + Math.cos(ang) * 0.9 - Math.sin(ang) * 0.55;
    p.camOverride = { pos: new THREE.Vector3(cx, p.eye + 0.25, cz), look: new THREE.Vector3(dad.x, dad.eye - 0.05, dad.z) };
    void hx; void hz;
    dad.char.update(dt); dad.char.talk = this.now < dad.talkUntil ? 1 : 0;
    let showing = null;
    for (const pr of L.prompts) {
      const u = L.t - pr.at;              // window opens 0.9 s before `at`
      if (pr.state === 0 && u > -0.9 && u <= 0.3) {
        showing = pr;
        if (input.pressed.has('nod')) { pr.state = Math.abs(u) < 0.32 ? 2 : 1; L.hits++; this.addAnger(pr.state === 2 ? -5 : -3); sfx.pick(); p.char.overlay('m_gestic_listen_accept_01', { mask: 'head' }); this.later(1.2, () => p.char.overlay(null)); ui.nod(true, 1, 'hit'); L.flashUntil = this.now + 0.35; }
      } else if (pr.state === 0 && u > 0.3) { pr.state = -1; this.addAnger(3, 'nod'); sfx.bad(); ui.nod(true, 1, 'miss'); L.flashUntil = this.now + 0.35; }
    }
    if (this.now > (L.flashUntil || 0)) { if (showing) ui.nod(true, 1 + Math.max(0, (showing.at - L.t)) / 0.9 * 1.4, ''); else ui.nod(false); }
    if (!L.ending && L.t > L.dur + 0.3) { L.ending = true; this.say(dad, 'dad.lecture.end', { loud: true, far: true }); }
    if (L.ending && L.t > L.dur + 2.4) {
      ui.nod(false);
      this.lecture = null; p.camOverride = null; p.state = 'free'; p.pose = null; dad.pose = null; dad.setState('routine'); dad.phase = 'idle'; dad.grace = this.now + 6;
      this.anger = Math.min(this.anger, 46 - L.hits * 3); dad.armed[50] = false;
    }
  }
  confiscate() {
    const p = this.player, dad = this.dad;
    this.stats.confiscations++;
    if (this.stay) this.exitStay(true);
    dad.halt(); dad.face(p.x, p.z); dad.setState('frozen'); dad.setPose('m_gestic_talk_angry_02_xyz');
    p.state = 'frozen'; p.setPose('m_gestic_listen_sad_01'); p.char.heading = Math.atan2(dad.x - p.x, dad.z - p.z);
    if (p.phoneOut) p.phone(false);
    const what = p.hasPhone ? 'phone' : 'console';
    if (what === 'phone') p.hasPhone = false; else this.consoleLocked = true;
    this.confiscated = what; this.setDevice('console', false, 'dad');
    const d1 = dad.say('dad.confiscate', { loud: true, far: true });
    this.toast(what === 'phone' ? 'صادر تلفونك! (بخزانة غرفته)' : 'صادر يد البلايستيشن! (بخزانة غرفته)', 'bad');
    const left = PUNISH.map((_, i) => i).filter((i) => !this.tasks.some((t) => t.id === PUNISH[i].id && !t.done));
    this.later(d1 + 0.3, () => {
      if (left.length) { const i = pick(left); dad.say('dad.punish', { index: i, loud: true, far: true }); const t = this.makeTask(PUNISH[i]); this.tasks.push(t); this.stepBegin(t); }
      this.later(2.2, () => { p.state = 'free'; p.pose = null; dad.pose = null; dad.setState('routine'); dad.phase = 'idle'; dad.grace = this.now + 7; this.anger = Math.min(this.anger, 60); });
    });
  }
  explode() {
    if (this.over) return;
    this.over = true; const dad = this.dad, p = this.player;
    dad.halt(); dad.face(p.x, p.z); dad.setPose('m_gestic_talk_angry_01_xyz'); dad.setState('frozen');
    this.say(dad, 'dad.explode', { loud: true, far: true });
    this.shake = 2.5; sfx.spotted();
    p.state = 'frozen'; p.setPose('m_idle_nervous_01');
    this.later(1.8, () => this.say(dad, 'dad.explode', { index: 1, loud: true, far: true }));
    this.later(5, () => this.endDay(false));
  }
  onRage(on) { this.rageOn = on; if (on) this.toast('الشبشب طالع! وطّي (تسلل) أو اختفي ورا حيط', 'bad'); }
  throwSlipper(dad) {
    const p = this.player, from = dad.char.handPos('R', new THREE.Vector3());
    const d = Math.hypot(p.x - from.x, p.z - from.z), speed = 13, t = d / speed;
    const tx = p.x + p.vx * t * 0.75, tz = p.z + p.vz * t * 0.75, ty = p.eye * 0.72;
    const v = new THREE.Vector3(tx - from.x, 0, tz - from.z).normalize().multiplyScalar(speed);
    v.y = (ty - from.y) / t + 0.5 * 4 * t;
    const mesh = makeItem('slipper'); mesh.position.copy(from); this.scene.add(mesh);
    this.projectiles.push({ mesh, v, alive: true, age: 0 });
    sfx.whoosh({ x: from.x, y: from.y, z: from.z });
  }
  updateProjectiles(dt) {
    const p = this.player, w = this.world;
    for (const s of this.projectiles) {
      if (!s.alive) continue;
      s.age += dt; s.v.y -= 4 * dt;
      const m = s.mesh, ox = m.position.x, oz = m.position.z;
      m.position.addScaledVector(s.v, dt); m.rotation.x += dt * 16; m.rotation.z += dt * 9;
      const dx = m.position.x - ox, dz = m.position.z - oz, len = Math.hypot(dx, dz);
      const top = p.crouched ? p.eye * 0.62 : p.eye + 0.22;
      // swept test: at 13 m/s the slipper covers more than a body width per frame
      let near = 9;
      if (len > 0) { const u = clamp(((p.x - ox) * dx + (p.z - oz) * dz) / (len * len), 0, 1); near = Math.hypot(ox + dx * u - p.x, oz + dz * u - p.z); }
      const hit = !p.char.down && !p.hidden && near < 0.4 && m.position.y > 0.2 && m.position.y < top;
      let stop = false;
      if (hit) {
        stop = true; this.stats.hits++; sfx.slap({ x: p.x, y: 1, z: p.z }); sfx.ouch(this.playerKey === 'kid' ? 1.5 : this.playerKey === 'sis' ? 1.35 : 1);
        ui.flash(); this.shake = 0.5;
        p.char.knockDown(1); p.limp = 4; if (this.stay) this.exitStay(true); if (p.carrying) this.dropCarried(true);
        this.addAnger(-14); this.later(0.5, () => this.dad.say('dad.slipper.hit', { loud: true })); this.dad.throwCd = 2.6;
      } else if (len > 0 && w.ray(ox, oz, dx / len, dz / len, len + 0.05, Math.max(0.3, m.position.y)) < len + 0.04) { stop = true; m.position.set(ox, m.position.y, oz); sfx.thud({ x: ox, y: 1, z: oz }); } else if (m.position.y < 0.04) stop = true;
      if (stop || s.age > 3) {
        s.alive = false; this.scene.remove(m);
        const [x, z] = w.nearestFree(m.position.x, m.position.z);
        this.spawnPickup('slipper', x, z);
        if (!hit) { this.stats.dodged++; this.addAnger(1.5, 'miss'); this.later(0.3, () => this.dad.say('dad.slipper.miss', { loud: true })); }
      }
    }
    this.projectiles = this.projectiles.filter((s) => s.alive);
  }
  onSpotted() { this.stats.spotted++; const p = this.player; if (p.act || p.running || p.sneaking) sfx.spotted(); }
  onSnitch(sib) {
    this.stats.snitched++; this.toast(`${NAMES[sib.key]} فسدت عليك!`.replace('سيف فسدت', 'سيف فسد').replace('حمودة فسدت', 'حمودة فسد'), 'bad');
    if (this.flags.guests) { this.debt += 6; return; }
    this.addAnger(3, 'snitch');
    this.dad.investigate(this.player.x, this.player.z, true);
  }

  // ---------- hiding / staying ----------
  hideIn(h) {
    const p = this.player;
    p.state = 'hidden'; p.hide = h; p.hideSeen = this.dad.seen; p.hideFrom = { x: p.x, z: p.z };
    p.char.pos.set(h.inside[0], 0, h.inside[1]);
    p.char.visible = h.kind === 'crouch' || h.kind === 'curtain'; p.sneaking = false;
    if (p.char.visible) p.setPose('m_crouch_idle');
    if (p.phoneOut) p.phone(false);
    sfx.door({ x: h.x, y: 1, z: h.z });
    if (p.hideSeen && this.dad.calm) { this.dad.cd.found = 0; this.later(0.6, () => { if (p.hidden) { this.dad.say(this.dad.foundCat(), { loud: true }); this.addAnger(RULE_FOUND, 'found'); this.unhide(true); } }); }
  }
  unhide() {
    const p = this.player; if (!p.hide) return;
    const h = p.hide; p.hide = null; p.state = 'free'; p.pose = null; p.char.visible = true;
    p.char.pos.set(h.x, 0, h.z); p.camPos.set(h.x, 1.8, h.z);
  }
  enterStay(task, step) {
    const p = this.player, s = this.spot(step.stay) || this.spot('@bed');
    this.stay = { task, step, spot: s, from: { x: p.x, z: p.z } };
    p.state = 'sit'; p.act = step.act === 'meal' ? null : step.act; p.sneaking = false; if (p.phoneOut) p.phone(false);
    // swing the camera round so you can see yourself (and the door behind you)
    if (step.lie) {
      // into bed: under the cover, head on the pillow; the camera sits on the open side by your head so you can watch the door
      const seat = s.seat, h = seat.heading, open = Math.sign((s.x - seat.x) * Math.cos(h) - (s.z - seat.z) * Math.sin(h)) || 1;
      p.char.coverColor = { big: 0x6f8fc4, kid: 0xb54a4a, sis: 0xe39bb8 }[this.playerKey]; p.char.lieOn(seat); p.setPose('m_idle_breathe_01'); p.yaw = h + Math.PI - open * 1.05; p.pitch = 0.62;
      this.stations.tuck(true);
    } else if (step.sit) {
      const seat = this.world.seats[step.stay === 'console' ? 'desk_boys' : SELF[this.playerKey].desk];
      p.char.pos.set(seat.x, 0, seat.z); p.char.heading = p.char.root.rotation.y = seat.heading; p.yaw = seat.heading + Math.PI + 0.5; p.pitch = 0.4;
      p.setPose(step.act === 'study' ? 'm_sit_table_idle_neutral_01' : 'm_sit_chair_idle_neutral_01');
      if (step.act === 'study') p.char.overlay('m_work_table', { mask: 'arms' }), p.overlayLock = true;
    } else { p.char.heading = s.face; p.setPose(step.act === 'eat' ? 'm_drink_drinking' : step.act === 'meal' ? 'm_work_mid' : 'm_idle_neutral_01'); }
    if (step.act === 'tvwatch') {            // back off to where the whole screen can be taken in, the camera over your shoulder: your programme, not his
      p.char.pos.set(7.3, 0, 8.2); p.char.heading = p.char.root.rotation.y = -Math.PI / 2; p.yaw = Math.PI / 2 + 0.36; p.pitch = 0.13; this.tv.watch('series');
    }
    if (step.device) this.setDevice(step.device, true, 'player');
    if (task) this.stations.stayBegin(step);
  }
  exitStay(forced, done) {
    const st = this.stay, p = this.player; if (!st) return;
    if (st.task) this.stations.stayEnd(st.step, !!done);
    this.stay = null; p.state = p.state === 'sit' ? 'free' : p.state; p.act = null; p.pose = null; if (p.char.lying) this.stations.tuck(false); p.char.lying = 0; p.char.pos.y = 0; p.overlayLock = false; p.char.overlay(null);
    p.char.pos.set(st.spot.x, 0, st.spot.z);
    if (st.step.device === 'console') {
      // bolting in a panic? then the thing stays on
      if (this.dad.awareness > 0.4 && !forced) this.toast('نسيت البلايستيشن شغّال!', 'bad'); else this.setDevice('console', false, 'player');
    }
  }
  dropCarried(spill) {
    const p = this.player, c = this.uncarry(); if (!c) return;
    const h = p.char.heading, [x, z] = this.world.nearestFree(p.x + Math.sin(h) * 0.5, p.z + Math.cos(h) * 0.5);
    if (c.mess) {
      const m = c.mess; m.x = x; m.z = z; m.seen = false; m.pickup = this.spawnPickup(m.kind, x, z, { mess: m }); m.mesh = m.pickup.mesh;
      const room = this.world.roomAt(x, z), pk = this.playerKey;
      m.framedOn = room === 'sis' && pk !== 'sis' ? 'sis' : room === 'boys' ? (pk === 'big' ? 'kid' : pk === 'kid' ? 'big' : 'big') : null;
      if (m.framedOn) this.toast(`حطّيتها بغرفة ${NAMES[m.framedOn]}…`, '');
      return;
    }
    // knocked or fumbled out of your hands: it falls for real (js/mishap.js). Put down on purpose: it is simply there.
    if (spill) { this.mishaps.fall(c, new THREE.Vector3(p.vx * 0.7 + Math.sin(h) * 0.7, 0, p.vz * 0.7 + Math.cos(h) * 0.7)); return; }
    this.spawnPickup(c.item, x, z);
    sfx.thud({ x, y: 0.2, z });
  }
  // lost the thing you were carrying: the job goes back to "fetch it"
  rewind(item) { for (const t of this.tasks) { const s = this.step(t); if (s && (s.give === item || s.drop === item)) { while (t.i > 0 && !(t.steps[t.i].pick === item || t.steps[t.i].find === item)) t.i--; t.prog = 0; } } }

  // ---------- what can I do right here? ----------
  findInteraction() {
    const p = this.player, w = this.world, out = [];
    const near = (o, r = 1.25) => (o ? Math.hypot(o.x - p.x, o.z - p.z) : 99) < r;
    const dist = (o) => Math.hypot(o.x - p.x, o.z - p.z);
    const add = (prio, d, o) => out.push({ prio, d, ...o });
    const kid = this.playerKey === 'kid';
    if (this.stay) return { key: 'stay', label: this.stay.step.lie ? 'قوم من التخت' : 'قوم', secs: 0, run: () => this.exitStay() };
    if (p.hidden) return { key: 'unhide', label: 'اطلع', secs: 0, run: () => this.unhide() };

    for (const t of this.tasks) {
      const s = this.step(t); if (!s || this.locked(t)) continue;
      const key = t.id + ':' + t.i;
      const fx = s.use || s.pick || s.drop ? this.stations.fxFor(t, s) : null, fxSecs = fx && FX_SECS[fx.name] || 0;
      if (s.use) { const sp = this.spot(s.use); if (near(sp, 1.3) && (t.id !== 'veg' || this.vendors.waiting)) add(1, dist(sp), { key, fx, label: s.label || t.title, secs: Math.max(s.secs, fxSecs), act: s.act, noise: s.noise || t.noise, face: sp, run: () => { this.afterUse(t, s); if (t.id === 'veg') this.vendors.vegOrder(); this.advance(t); } }); } else if (s.pick && !p.carrying) {
        const sp = this.spot(s.at);
        // (an order is only there to take once the captain is at the gate, or has hung it on it)
        const truckOk = s.pick === 'gasFull' ? this.vendors.gasReady : s.pick === 'veg' ? this.vendors.vegReady : true;      // (the gas man has put it down at the gate / the bag is ready)
        if (near(sp, 1.3) && truckOk && (s.pick !== 'talabat' || this.delivery.ready || this.delivery.hung)) add(1, dist(sp), { key, fx, label: s.pick === 'talabat' && this.delivery.hung ? 'خذ الطلب عن البوابة' : s.label || `خذ ${ITEMS[s.pick]}`, secs: Math.max(s.secs || 1, fxSecs) * (s.high && kid ? 1.6 : 1), act: s.act, face: sp, run: () => {
          if (s.at === 'fridge') this.setDevice('fridge', true, 'player');
          if (s.prop) { this.props.remove(s.prop); s.prop = null; }
          if (s.pick === 'talabat') { if (this.delivery.hung) this.delivery.takeHung(); else this.delivery.delivered(); }
          if (s.pick === 'gasFull' || s.pick === 'veg') this.vendors.handed();
          if (s.pick === 'kunafa') this.later(0.4, () => this.mom.say('mom.kunafa', { loud: true }));
          this.carry(s.pick); this.advance(t);
        } });
      } else if (s.drop && p.carrying && p.carrying.item === s.drop) {
        const sp = this.spot(s.at);
        if (near(sp, 1.35)) add(0, dist(sp), { key, fx, label: s.label || `حط ${ITEMS[s.drop]}`, secs: Math.max(s.secs || 1, fxSecs), face: sp, run: () => {
          this.uncarry(); if (['kunafa', 'cups', 'mansaf', 'laban', 'remote'].includes(s.drop)) this.placeProp(s.drop, sp, s.at);
          if (s.drop === 'gasFull') this.later(1.2, () => { if (!this.dad.away) this.dad.say('dad.gas.done', { loud: true, far: true }); });
          if (s.drop === 'veg') this.later(0.6, () => this.mom.say('mom.veg.thanks', { loud: true, far: true }));
          this.advance(t);
        } });
      } else if (s.give !== undefined && s.to) {
        const a = this.actor(s.to);
        if (a && a.char.visible && near(a, 1.9) && (s.give === null ? !p.carrying : p.carrying && p.carrying.item === s.give)) {
          add(0, dist(a), { key, label: s.label || `أعطي ${NAMES[s.to]}`, secs: 0.7, face: a, give: a, run: () => { if (s.give) this.handOver(s.give, a); if (s.to === 'gasman') this.vendors.tookEmpty(); if (!s.keep) { const c = this.uncarry(); if (c && c.tray && s.give) this.setDown(c, a); } this.advance(t); if (s.to !== 'dad' && this.guests[s.to]) this.later(0.3, () => this.guests[s.to].say(s.to === 'uncle' ? 'uncle.talk' : 'aunt.talk', { index: s.to === 'uncle' ? 3 : 0 })); } });
        }
      } else if (s.stay) {
        const sp = this.spot(s.stay);
        if (near(sp, 1.35) && !p.carrying && !(s.device === 'console' && this.consoleLocked) && !(s.act === 'tvwatch' && (!w.devices.tv.on || this.dad.watchingTv))) add(1, dist(sp), { key, label: s.label || t.title, secs: 0, run: () => this.enterStay(t, s) });
      } else if (s.sign) {
        if (near(this.dad, 1.9)) add(0, dist(this.dad), { key, label: 'أعطيه الشهادة يوقّعها', secs: 1.0, face: this.dad, run: () => this.signExam(t, 'dad') });
        if (near(this.mom, 1.9) && this.tokens > 0) add(0, dist(this.mom), { key: key + 'm', label: 'خلّي أمك تدبّر التوقيع 💚', secs: 1.0, face: this.mom, run: () => this.signExam(t, 'mom') });
      } else if (s.clean && !s.clean.portable && near(s.clean, 1.2)) add(0, dist(s.clean), { key, label: 'امسح الأرض', secs: 2.5, face: s.clean, fx: { name: 'wipe', mess: s.clean }, run: () => { this.removeMess(s.clean); t.steps = []; this.complete(t); } });
    }
    // wrong order with the coffee tray is still possible
    if (this.flags.guests && p.carrying && p.carrying.item === 'coffee') {
      const t = this.tasks.find((k) => k.id === 'coffee'), s = t && this.step(t);
      for (const k of ['uncle', 'aunt', 'dad']) { const a = this.actor(k); if (s && s.to !== k && a && near(a, 1.7) && !(this.guests[k] && this.guests[k].served.coffee) && !(k === 'dad' && false)) add(2, dist(a), { key: 'wrong' + k, label: `قدّم القهوة لـ${NAMES[k]}`, secs: 0.5, run: () => { this.debt += 10; this.dad.say('dad.thu', { index: 3, whisper: true }); this.toast('الكبير أول! أبوك سجّلها عليك', 'bad'); sfx.bad(); } }); }
    }
    // things lying around
    if (!p.carrying) for (const k of this.pickups) if (near(k, 1.15)) {
      const taskFor = this.tasks.find((t) => { const s = this.step(t); return s && s.find === k.item; });
      if (k.item === 'slipper' && !taskFor && !this.dad.rage) continue;
      add(taskFor ? 0 : 3, dist(k), { key: 'pk' + k.item + Math.round(k.x * 10), label: k.mess ? 'احمل ' + ITEMS[k.item] : `خذ ${ITEMS[k.item] || k.item}`, secs: 0.7, face: k, fx: { name: 'grab', at: k }, run: () => {
        this.removePickup(k);
        if (k.item === 'socks') { sfx.pick(); if (taskFor) this.advance(taskFor); return; }
        this.carry(k.item, k.mess ? { mess: k.mess } : {}); if (k.mess) { k.mess.pickup = null; k.mess.mesh = null; this.mishaps.clearExtra(k.mess); }
        if (taskFor) this.advance(taskFor);
      } });
    }
    // carrying a mess to a bin = cleaned
    if (p.carrying && p.carrying.mess) for (const id of ['bin', 'yardbin']) { const sp = w.spots[id]; if (near(sp, 1.3)) add(0, dist(sp), { key: 'bin', label: 'ارميها بالزبالة', secs: 0.6, run: () => { const c = this.uncarry(); this.messes = this.messes.filter((m) => m !== c.mess); const t = this.tasks.find((k) => k.mess === c.mess); if (t) { t.steps = []; this.complete(t); } else sfx.done(); } }); }
    // bribe the snitch
    const sn = this.sibRole('snitch');
    if (sn && p.carrying && p.carrying.item === 'chocolate' && near(sn, 1.7)) add(0, dist(sn), { key: 'bribe', label: `ارشي ${NAMES[sn.key]} بالشوكولاتة`, secs: 0.6, run: () => { this.uncarry(); this.bribeUntil = this.now + 110; sn.say(sn.key === 'sis' ? 'sis.bribe' : 'big.lazy', { loud: true }); this.toast('ساكتة عنك لدقيقتين 🤫', 'good'); const t = this.tasks.find((k) => k.id === 'choc' && !k.done); if (t) { t.steps = []; this.complete(t); } } });
    // locked bathroom
    if (this.bathSib && near({ x: 5.75, z: 4.9 }, 1.0)) add(2, 0.5, { key: 'knock', label: 'دق باب الحمّام', secs: 0.3, run: () => { sfx.thud({ x: 5.75, y: 1, z: 4.5 }); this.later(0.5, () => this.bathSib && this.bathSib.say(this.bathSib.key === 'sis' ? 'sis.bath' : 'big.lazy', { index: this.bathSib.key === 'sis' ? undefined : 2, loud: true })); } });
    // get your stuff back from dad's wardrobe
    if (this.confiscated && near(w.spots.wardrobe_parents, 1.3) && !p.carrying) add(1, 0.6, { key: 'retrieve', label: this.confiscated === 'phone' ? 'رجّع تلفونك من الخزانة' : 'رجّع يد البلايستيشن', secs: 4, act: 'snoop', noise: 2, face: w.spots.wardrobe_parents, fx: { name: 'rummage', id: 'wardrobe_parents' }, run: () => { if (this.confiscated === 'phone') p.hasPhone = true; else this.consoleLocked = false; this.confiscated = null; sfx.secret(); this.toast('رجّعتها… بهدوء 🤫', 'good'); } });
    // switches and appliances
    for (const d of Object.values(w.devices)) {
      if (d.type === 'console' && !d.on) continue;
      if (near(d, d.type === 'light' ? 1.4 : 1.05)) add(4, dist(d), { key: 'dev' + d.id, label: d.type === 'fridge' ? (d.on ? 'سكّر الثلاجة' : 'افتح الثلاجة') : `${d.on ? 'طفّي' : 'شغّل'} ${d.label}`, secs: 0, run: () => this.toggle(d) });
    }
    // hiding places
    if (!p.carrying) for (const h of w.hides) if (h.kind !== 'blanket' && (!h.kidOnly || kid) && near(h, 1.05)) add(5, dist(h), { key: h.id, label: h.label, secs: 0.25, run: () => this.hideIn(h) });
    if (!out.length) return p.carrying ? { key: 'drop', label: `نزّل ${ITEMS[p.carrying.item] || ''}`, secs: 1.0, weak: true, fx: { name: 'setDown', floor: true }, run: () => this.dropCarried() } : null;
    // What you are standing next to wins. Handing over or putting down what you carry always comes first; after that it is
    // distance, with a small head start for the day's jobs over switches and hiding places.
    const score = (o) => (o.prio <= 0 ? o.d - 10 : o.d + [0, -0.3, -0.2, 0, 0, 0.25][o.prio]);
    out.sort((a, b) => score(a) - score(b));
    return out[0];
  }
  afterUse(t, s) {
    const w = this.world;
    if (/^car\d/.test(s.use)) { w.car.setClean(Math.min(1, w.car.clean + 0.34)); sfx.splash({ x: w.car.x, y: 1, z: w.car.z }); }
    if (s.use === 'tap' || s.use === 'shower' || s.use === 'sink' || s.use === 'kitchensink') sfx.water(null);
  }
  toggle(d) {
    const dad = this.dad, on = !d.on;
    this.setDevice(d.id, on, 'player'); sfx.click(); this.noise(d.x, d.z, 1.5, 'use', 'player');
    if (d.face != null && !this.player.carrying) this.player.tap(GH.set(d.x + Math.sin(d.face) * 0.5, d.type === 'light' || d.type === 'heater' ? 1.32 : d.type === 'ac' ? 1.5 : 1.1, d.z + Math.cos(d.face) * 0.5));
    if (d.id === 'tv' && !on && dad.watchingTv) { dad.say('dad.tv', { index: 2, loud: true }); this.addAnger(12, 'tv'); this.later(0.8, () => this.setDevice('tv', true, 'dad')); }
    if (d.id === 'light_living' && !on && dad.watchingTv && this.world.dark) { dad.say('dad.tv', { index: 3, loud: true }); this.addAnger(6, 'light'); this.later(0.8, () => this.setDevice('light_living', true, 'dad')); }
  }
  signExam(t, who) {
    const dad = this.dad;
    if (who === 'mom') { this.tokens--; this.mom.say('mom.ambient', { index: 0 }); this.toast('أمك دبّرت التوقيع… وما حدا شاف إشي 💚', 'good'); this.advance(t); return; }
    const mellow = this.now < this.mellowUntil && dad.watchingTv;
    if (mellow) { dad.say('dad.wed.sign', { index: 1 }); this.toast('وقّع وهو مش منتبه! 😎', 'good'); this.stats.secrets += 0; this.advance(t); } else {
      dad.say('dad.wed', { index: 1, loud: true }); this.later(2.6, () => dad.say('dad.wed', { index: 2, loud: true }));
      this.toast('قرأها… 45 بالرياضيات', 'bad'); this.addAnger(30, 'exam'); this.advance(t);
    }
  }

  // ---------- frame ----------
  update(dt) {
    if (!this.active || this.paused) return;
    this.now += dt; this.segT += dt; this.stats.time += dt;
    for (const t of [...this.timers]) if (this.now >= t.at) { this.timers = this.timers.filter((k) => k !== t); t.fn(); }
    const p = this.player, dad = this.dad, w = this.world, seg = this.seg;

    if (this.lecture) this.updateLecture(dt);
    // phone
    if (input.pressed.has('phone') && p.state === 'free') { if (!p.hasPhone) this.toast('تلفونك مصادَر 📵', 'bad'); else p.phone(!p.phoneOut); }

    // interaction
    let it = p.state === 'free' && !p.char.down || this.stay || p.hidden ? this.findInteraction() : null;
    if (p.state === 'lecture' || p.state === 'frozen') it = null;
    const cur = this.interaction;
    if (!it || !cur || cur.key !== it.key) {
      if (cur && cur.started) { if (cur.fx) this.stations.end(cur.fx, false); p.pose = null; if (cur.act) p.act = null; }     // walked away mid-job
      this.interaction = it ? { ...it, t: 0 } : null;
    }
    const I = this.interaction;
    if (I) {
      if (I.secs <= 0.01) { ui.prompt(I.label, null); if (input.pressed.has('use')) { I.run(); this.interaction = null; } } else {
        // one press starts the job and it carries on by itself; walking away drops it
        if (input.pressed.has('use')) I.running = true;
        if (p.moving) I.running = false;
        const holding = !!I.running;
        if (holding) {
          I.t += dt;
          if (!I.started) {
            I.started = true;
            // a spot knows which way its furniture is; a person you just turn towards
            I.spot = I.face && I.face.face != null && !I.face.char ? I.face : null;
            if (I.spot) p.char.heading = I.spot.face; else if (I.face) p.char.heading = Math.atan2(I.face.x - p.x, I.face.z - p.z);
            if (I.fx) this.stations.begin(I.fx); else if (I.secs > 0.7) p.setPose('m_work_mid', { fade: 0.2 });
            if (I.act) p.act = I.act;
          }
          if (I.fx && I.spot && !(this.stations.cur && this.stations.cur.free)) { const k = Math.min(1, dt * 10); p.char.pos.x += (I.spot.x - p.x) * k; p.char.pos.z += (I.spot.z - p.z) * k; }     // step up to the job
          if (I.fx) this.stations.tick(I.fx, I.t / I.secs, dt);
          if (I.give && p.carrying) {            // arms out towards them
            const a = I.give, it = p.carrying, k = Math.sin(Math.min(1, I.t / I.secs) * Math.PI * 0.5);
            it.custom = true; it.grounded = (it.grounded || new THREE.Vector3()).set(p.x + (a.x - p.x) * 0.55 * k + Math.sin(p.char.heading) * 0.3 * (1 - k), (a.seat ? 0.85 : 1.05), p.z + (a.z - p.z) * 0.55 * k + Math.cos(p.char.heading) * 0.3 * (1 - k));
            p.char.reachTo('R', it.grounded); if (it.tray) p.char.reachTo('L', it.grounded);
          }
          if (I.noise) { I.nt = (I.nt || 0) - dt; if (I.nt <= 0) { I.nt = 0.6; this.noise(p.x, p.z, I.noise, 'use', 'player'); sfx.sweep(null); } }
          if (I.t >= I.secs) { if (I.fx) this.stations.end(I.fx, true); p.pose = null; if (I.act) p.act = null; if (p.carrying) { p.carrying.grounded = null; p.carrying.custom = false; } I.run(); this.interaction = null; }
        } else if (I.started) { I.started = false; if (p.carrying) { p.carrying.grounded = null; p.carrying.custom = false; } if (I.fx) this.stations.end(I.fx, false); I.t = Math.max(0, I.t - dt * 2); p.pose = null; if (I.act) p.act = null; }
        ui.prompt(I.label, I.t / I.secs);
      }
    } else ui.prompt(null);
    if (this.stay && (input.mx || input.my) && Math.hypot(input.mx, input.my) > 0.6 && this.segT > 0.5) this.exitStay();

    p.update(dt);
    // tea is not a thing you run with
    const risk = p.carrying && p.running ? RUN_RISK[p.carrying.item] : 0;
    if (risk) { const c = p.carrying; if (!c.warned) { c.warned = true; this.toast('شوي شوي! رح يوقع منك', 'bad'); } c.runT = (c.runT || 0) + dt; if (c.runT > 0.45 && Math.random() < dt * risk) this.dropCarried(true); }
    // jaws follow the recorded voices
    for (const a of [dad, this.mom, ...this.sibs, ...Object.values(this.guests)]) a.char.mouth = a.voice && this.now < a.talkUntil ? a.voice.mouth() : null;
    if (!dad.away) dad.update(dt);
    this.mom.update(dt);
    for (const s of this.sibs) s.update(dt);
    for (const g of Object.values(this.guests)) g.update(dt);
    const actors = [p, dad, this.mom, ...this.sibs, ...Object.values(this.guests).filter((g) => g.char.visible)];
    w.update(dt, actors, [p.x, p.z, this.camera.position.x, this.camera.position.z]);
    // locked doors are solid
    for (const d of w.doors) if (d.locked && Math.abs(p.x - d.x) < d.width / 2 + 0.2 && Math.abs(p.z - d.z) < 0.32) p.char.pos.z = d.z + Math.sign(p.z - d.z || 1) * 0.32;
    this.updateProjectiles(dt);
    this.updateGifts(dt);
    this.updateTasks(dt);
    this.updateWorldBits(dt);
    this.mishaps.update(dt);
    this.street.update(dt);
    this.delivery.update(dt);
    this.vendors.update(dt);
    if (this.stay && this.stay.task) { const st = this.stay; this.stations.stayTick(st.step, st.task.prog / (st.step.secs || 1), dt); }
    this.stations.update(dt, this.app.renderer.domElement.height, this.camera.fov);

    // timeline events
    for (const e of this.events) if (!e.done && this.segT >= e.t) {
      e.done = true;
      if (e.storm) { const cfg = { ...seg.dad, mode: 'patrol' }; dad.cfg = cfg; dad.mode = 'patrol'; dad.phase = 'idle'; dad.si = -1; dad.pose = null; this.toast('أبوك طالع يستعجلكم!', 'bad'); this.later(e.storm, () => { dad.cfg = seg.dad; dad.mode = 'car'; dad.phase = 'idle'; dad.halt(); }); }
    }
    // anger cools off slowly when he has nothing to be angry about
    if (dad.calm && !dad.seen && !this.over && seg.end !== 'car') this.anger = Math.max(seg.angerFloor || 0, this.anger - dt * (dad.watchingTv ? 0.55 : 0.3));
    if (w.devices.heater.on) this.heaterT += dt;
    this.snitchWatch = Math.max(0, this.snitchWatch - dt);

    // segment end
    if (!this.ended && !this.over) {
      const chores = this.tasks.filter((t) => t.kind === 'chore');
      const allDone = chores.length > 0 && chores.every((t) => t.done);
      if ((seg.end === 'tasks' || seg.end === 'car') && allDone) {
        // chores done: you choose when to call it a day, so there's still time for the secret goals
        const own = seg.end === 'car' || seg.finish === false || this.finishAdded || chores.some((t) => t.steps.some((s) => s.goto));
        if (own) this.finishSeg(); else {
          this.finishAdded = true; sfx.done();
          const f = seg.finish || { spot: '@bed', title: 'خلص شغلك! ارتاح على تختك وقت ما بدك', label: 'خلّص المرحلة' };
          const t = this.makeTask({ id: 'finish', title: f.title, kind: 'chore', steps: [{ use: f.spot, secs: 1.5, label: f.label }] });
          this.tasks.push(t); this.stats.choresTotal++; this.toast('خلص شغل البيت! كمّل أهدافك السرّية أو روح ارتاح', 'good');
        }
      }
      else if (this.segT >= seg.time) this.timeUp();
    }
    this.hud(dt);
  }

  updateTasks(dt) {
    const p = this.player, dad = this.dad, w = this.world;
    for (const t of this.tasks) {
      if (t.done) continue;
      if (t.left != null) {
        t.left -= dt;
        if (t.left <= 0) {
          t.done = true; t.failed = true; sfx.bad();
          if (t.kind === 'cmd') { this.stats.late++; if (t.mess) { this.addAnger(8, 'late'); } else { dad.say('dad.cmd.late', { loud: true }); this.addAnger(12, 'late'); } } else if (t.kind === 'mom') { this.addAnger(6, 'mom'); this.toast('أمك حكت لأبوك إنك ما ساعدتها', 'bad'); }
          this.later(2.5, () => { this.tasks = this.tasks.filter((k) => k !== t); });
          continue;
        }
      }
      if (this.locked(t)) continue;
      const s = this.step(t); if (!s) continue;
      if (s.check && !s.wait) { if (this.check(s.check)) this.advance(t); } else if (s.wait) { if (this.check(s.check)) { t.prog += dt; if (t.prog >= s.wait) this.advance(t); } else t.prog = Math.max(0, t.prog - dt); } else if (s.goto) { const sp = this.spot(s.goto); if (Math.hypot(sp.x - p.x, sp.z - p.z) < 1.3) this.advance(t); } else if (s.near) {
        const a = this.actor(s.near);
        if (a && a.char.visible && a.seat && Math.hypot(a.x - p.x, a.z - p.z) < 2.0 && !p.moving) { t.prog += dt; if (t.prog >= s.secs) this.advance(t); }
      } else if (s.phone) { if (p.phoneOut && !dad.seen) { t.prog += dt; if (Math.random() < dt * 5) sfx.type(null); if (t.prog >= s.phone) { p.phone(false); if (s.order) this.delivery.order(); this.advance(t); } } } else if (s.eat) {
        const food = s.item || 'chocolate';
        if (p.carrying && p.carrying.item === food && !p.moving && p.state === 'free') { p.act = 'eat'; t.prog += dt; if (t.prog >= s.eat) { p.act = null; this.uncarry(); this.advance(t); } } else if (p.act === 'eat' && p.state === 'free') p.act = null;
      } else if (s.stay && this.stay && this.stay.task === t) {
        const unseen = !dad.seen;
        const needUnseen = ['ps', 'tvwatch', 'sleep', 'eat'].includes(s.act);
        const devOk = !s.device || w.devices[s.device].on;
        if (devOk && (!needUnseen || unseen)) t.prog += dt;
        if (s.act === 'ps') { if (Math.random() < dt * 4) sfx.ps({ x: 13.4, y: 1, z: 0.5 }); this.psN = (this.psN || 0) - dt; if (this.psN <= 0) { this.psN = 1; this.noise(p.x, p.z, 4.5, 'ps', 'player'); } }
        if (s.act === 'tvwatch' && (!w.devices.tv.on || dad.watchingTv)) this.exitStay();
        if (s.act === 'ps' && !w.devices.console.on) { this.toast('انطفى البلايستيشن! ارجع شغّله وكمّل', 'bad'); this.exitStay(); continue; }
        if (t.prog >= s.secs) { this.exitStay(true, true); this.advance(t); }
      }
    }
  }
  check(name) {
    const h = this.world.devices.heater;
    return name === 'noWaste' ? this.wasteCount() === 0 : name === 'heaterOn' ? h.on : name === 'heaterOff' ? !h.on : false;
  }

  updateWorldBits(dt) {
    const p = this.player, w = this.world;
    // vases: run past one and it goes
    for (const v of this.vases) if (!v.broken && p.running && Math.hypot(v.x - p.x, v.z - p.z) < 0.75) {
      this.mishaps.vase(v);
    }
    this.tv.update(dt);
    this.cctv.update(dt);
    // floating markers over whatever your open jobs need next
    let n = 0;
    const mark = (x, y, z, color, size = 1) => {
      let m = this.markerPool[n];
      if (!m) { m = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthTest: false })); m.renderOrder = 10; this.markers.add(m); this.markerPool.push(m); }
      m.visible = true; m.material.color.setHex(color); m.scale.setScalar(size); m.position.set(x, y + Math.sin(this.now * 3 + n) * 0.06, z); m.rotation.y = this.now * 2; n++;
    };
    for (const t of this.tasks) {
      const s = this.step(t); if (!s || this.locked(t)) continue;
      const color = t.kind === 'secret' ? 0xb58cff : t.kind === 'cmd' ? 0xff5a5f : t.kind === 'mom' ? 0x5fd38a : 0xf2c14e;
      let o = null, y = 1.9;
      if (s.find) { const k = this.pickups.find((q) => q.item === s.find); if (k) { o = k; y = 0.6; } } else if (s.give !== undefined || s.near || s.sign) { const a = this.actor(s.to || s.near || 'dad'); if (a && a.char.visible && (s.give == null || (p.carrying && p.carrying.item === s.give))) { o = a; y = 2.1; } } else if (s.clean) { o = s.clean; y = 0.6; } else if (s.pick && p.carrying) o = null;
      else if (s.drop && !(p.carrying && p.carrying.item === s.drop)) o = null;
      else o = this.spot(s.use || s.at || s.stay || s.goto);
      if (s.check === 'heaterOn' || s.check === 'heaterOff') o = w.devices.heater;
      if (o) mark(o.x, y, o.z, color);
    }
    // whatever is left on and will cost you gets a marker on its switch: all of them while switching things off is a job, the near ones otherwise
    const offJob = this.tasks.some((t) => { const s = this.step(t); return s && s.check === 'noWaste' && !t.done && !this.locked(t); });
    for (const d of Object.values(w.devices)) if (this.wasteful(d) && (offJob || Math.hypot(d.x - p.x, d.z - p.z) < 5.5)) mark(d.sx ?? d.x, d.sy ?? 1.9, d.sz ?? d.z, 0xff9a2e, offJob ? 0.85 : 0.6);
    for (; n < this.markerPool.length; n++) this.markerPool[n].visible = false;
  }

  hud(dt, force) {
    const p = this.player, dad = this.dad, seg = this.seg;
    this.hudT = (this.hudT || 0) - dt;
    ui.tick();
    if (this.hudT > 0 && !force) return;
    this.hudT = 0.1;
    ui.anger(this.anger, this.flags.guests ? this.debt : 0);
    const left = seg.time - this.segT;
    ui.clock(this.day.name, seg.clock[0] + (seg.clock[1] - seg.clock[0]) * Math.min(1, this.segT / seg.time), left < 25);
    ui.eye(dad.seen ? 2 : dad.awareness > 0.15 || dad.onCams > 0 ? 1 : this.snitchWatch > 0.2 ? 1 : 0, dad.seen ? 'شايفك!' : dad.awareness > 0.15 ? 'منتبه…' : dad.onCams > 0 ? '📹 عالكاميرات' : this.snitchWatch > 0.2 ? 'في حدا مراقبك' : '');
    ui.stamina(p.stamina);
    ui.carry(p.carrying ? `معك: ${ITEMS[p.carrying.item] || ''}` : p.phoneOut ? 'عالتلفون 📱' : p.sneaking ? 'تسلل 🤫' : '');
    ui.tokens(this.tokens, p.hasPhone);
    let doing = null;
    for (const t of this.tasks) {
      const s = this.step(t); if (!s || t.done || this.locked(t)) continue;
      const total = s.secs || s.phone || s.wait || s.eat;
      const on = (s.stay && this.stay && this.stay.task === t) || (s.phone && p.phoneOut) || (s.wait && this.check(s.check)) || (s.eat && p.act === 'eat') || (s.near && t.prog > 0);
      if (!on || !total) continue;
      const unseenOnly = s.phone || ['ps', 'tvwatch', 'sleep', 'eat'].includes(s.act);
      const stopped = unseenOnly && dad.seen ? 'واقف! أبوك شايفك' : s.device && !this.world.devices[s.device].on ? 'واقف! الجهاز مطفي' : '';
      doing = { task: t, label: s.stay || s.phone ? t.title : s.label || t.title, left: Math.max(0, total - t.prog), frac: Math.min(1, t.prog / total), stopped };
      break;
    }
    if (!doing && this.doingT && this.doingT.done && !this.doingT.failed) ui.doing({ finished: true, label: this.doingT.title });
    else ui.doing(doing);
    this.doingT = doing ? doing.task : null;
    const order = { cmd: 0, punish: 1, chore: 2, mom: 3, secret: 4 };
    ui.tasks(this.tasks.filter((t) => !this.locked(t) && !(t.done && this.now - (t.doneAt || 0) > 6)).sort((a, b) => order[a.kind] - order[b.kind]).map((t) => {
      const s = this.step(t);
      let sub = t.sub || '', progress = null;
      if (s) {
        if (s.check === 'noWaste' && !s.wait) {          // say how many are left and where the first of them are
          const on = Object.values(this.world.devices).filter((d) => this.wasteful(d)), R = this.world.rooms || {};
          sub = on.length ? `باقي ${on.length}: ` + on.slice(0, 2).map((d) => `${d.type === 'light' ? 'ضو' : d.label} ${(R[d.room] || {}).name || ''}`.trim()).join('، ') + (on.length > 2 ? '…' : '') : s.label;
        } else if (s.check || s.wait) sub = s.label + (s.wait ? ` (${Math.ceil(s.wait - t.prog)})` : '');
        else if (t.steps.length > 1) sub = s.label || (s.pick ? `خذ ${ITEMS[s.pick]}` : s.drop ? `ودّي ${ITEMS[s.drop]}` : s.give ? `أعطي ${NAMES[s.to]}` : s.find ? `دوّر على ${ITEMS[s.find]}` : s.use ? (this.world.spots[s.use] || {}).label || '' : '');
        const total = s.secs || s.phone || s.wait || s.eat;
        if ((s.stay || s.phone || s.near || s.wait) && total) progress = t.prog / total;
      }
      return { title: t.title, kind: t.kind === 'punish' ? 'cmd' : t.kind, done: t.done, left: t.left, sub, progress, active: !!doing && doing.task === t };
    }));
    // mood: a low hum, red edges, a heartbeat. Only when there is something to fear: being near him is not, in itself.
    const d = Math.hypot(dad.x - p.x, dad.z - p.z);
    const hunt = dad.state === 'chase' || dad.state === 'throw';
    const guilty = p.phoneOut || p.hidden || ['ps', 'phone', 'sleep', 'eat', 'tvwatch', 'snoop'].includes(p.act);
    const close = d < 7 && !dad.seat ? 1 - d / 7 : 0;
    const tension = dad.away || dad.state === 'tire' ? 0 : clamp(hunt ? 1 : guilty ? Math.max(dad.awareness * 0.9, close * 0.8) : dad.state === 'investigate' ? 0.3 : 0, 0, 1);
    setTension(tension);
    ui.vignette(this.rageOn ? 0.85 : this.anger > 70 ? (this.anger - 70) / 45 : 0);
    this.heartT = (this.heartT || 0) - 0.1;
    if (tension > 0.55 && this.heartT <= 0) { this.heartT = 0.85 - tension * 0.35; sfx.heart(); }
    // where is he? (footprints at the screen edge when he's close and out of view)
    const cam = this.camera;
    if (!dad.away && d < 13 && (hunt || dad.awareness > 0.1 || d < 7) && !dad.seat) {
      const v = new THREE.Vector3(dad.x, 1.4, dad.z).project(cam);
      const behind = v.z > 1;
      if (behind || Math.abs(v.x) > 0.95 || Math.abs(v.y) > 0.95) {
        let x = behind ? -v.x : v.x, y = behind ? -v.y : v.y; const m = Math.max(Math.abs(x), Math.abs(y)) || 1; x = x / m * 0.9; y = y / m * 0.86;
        ui.edge((x * 0.5 + 0.5) * innerWidth, (-y * 0.5 + 0.5) * innerHeight);
      } else ui.edge(null);
    } else ui.edge(null);
  }

  // ---------- endings ----------
  timeUp() {
    const seg = this.seg, dad = this.dad;
    if (this.finalDone) return; this.finalDone = true;
    const undone = this.tasks.filter((t) => t.kind === 'chore' && !t.done).length;
    let add = 0;
    if (seg.end === 'car') { if (undone) add += 38; } else add += Math.min(32, undone * 12);
    if (seg.final === 'noWaste') { const n = this.wasteCount(); if (n) { add += Math.min(28, n * 9); dad.say('dad.light', { loud: true, far: true }); } }
    if (seg.final === 'exam' && this.tasks.some((t) => t.id === 'exam' && !t.done)) { add += 34; dad.say('dad.intro.wed', { loud: true, far: true }); }
    if (seg.guests) {
      this.flags.guests = false;
      if (this.guests.uncle) this.guests.uncle.say('uncle.talk', { index: 5, loud: true });
      for (const g of Object.values(this.guests)) this.later(2, () => { g.stand(); g.goTo(16.6, 5.5, { speed: 1.3, onArrive: () => { g.char.visible = false; } }); });
      this.ended = true;
      this.later(5, () => { dad.say('dad.thu.after', { loud: true, far: true }); this.toast(`راحوا الضيوف… أبوك فتح الدفتر (${this.debt + add})`, 'bad'); });
      this.later(8, () => { this.ended = false; dad.stand(); dad.setState('routine'); this.addAnger(this.debt + add, 'debt', true); this.debt = 0; if (!this.over) this.later(4.5, () => this.finishSeg()); });
      return;
    }
    if (add) { this.toast('خلص الوقت والشغل مش خالص!', 'bad'); this.addAnger(add, 'time', true); }
    if (!this.over) this.finishSeg();
  }
  finishSeg() {
    if (this.ended || this.over) return; this.ended = true;
    sfx.done();
    if (this.segIndex + 1 < this.day.segs.length) {
      this.later(1.6, () => {
        this.segIndex++;
        const seg = this.day.segs[this.segIndex];
        this.active = false; ui.prompt(null);
        if (document.pointerLockElement) document.exitPointerLock();
        ui.intro(this.day, seg, (seg.tasks || []).filter((t) => !t.only || t.only.includes(this.playerKey)), this.segIndex, () => { this.app.resume(); this.startSeg(false); });
      });
    } else if (this.seg.finale) this.finale(); else this.later(1.5, () => this.endDay(true));
  }
  finale() {
    const dad = this.dad, p = this.player, w = this.world;
    this.over = true; this.tasks = [];
    this.toast('خلصت الجمعة…', 'good');
    dad.rage = false; dad.setState('frozen'); dad.halt(); dad.pose = null; dad.state = 'routine'; dad.cfg = { mode: 'seated', plan: [] };
    dad.goSit(w.seats.dadTv, { onArrive: () => { dad.setState('seated'); } });
    let t = 3;
    for (let i = 0; i < 3; i++) { this.later(t, () => this.say(dad, 'dad.fri.end', { index: i, far: true })); t += (A.voice['dad.fri.end.' + i] ? A.voice['dad.fri.end.' + i].d : 4) + 1.2; }
    this.later(t + 1, () => this.endDay(true));
    void p;
  }

  endDay(win) {
    this.active = false; this.over = true; ui.hud(false); ui.prompt(null); ui.edge(null); ui.nod(false);
    setTension(0); setTv(false);
    if (document.pointerLockElement) document.exitPointerLock();
    const s = this.stats, pr = this.progress(this.playerKey);
    const clean = s.lectures + s.confiscations + s.hits === 0;
    const stars = win ? 1 + (s.secretsTotal > 0 && s.secrets >= s.secretsTotal ? 1 : 0) + (clean ? 1 : 0) : 0;
    if (win) { pr.stars[this.dayIndex] = Math.max(pr.stars[this.dayIndex] || 0, stars); pr.unlocked = Math.max(pr.unlocked, Math.min(DAYS.length - 1, this.dayIndex + 1)); this.storeSave(); }
    const last = this.dayIndex === DAYS.length - 1;
    const facts = this.facts(win);
    ui.end({
      win, stars, hasNext: !last,
      kicker: win ? (last ? 'خلّصت الأسبوع كله!' : `خلص يوم ${this.day.name}`) : `يوم ${this.day.name}`,
      title: win ? (last ? 'نجيت من جمعة أبوك 🏆' : stars === 3 ? 'يوم نظيف!' : 'عدّى اليوم') : 'انفجر أبوك 💥',
      rows: [['شغل البيت', `${s.chores}/${s.choresTotal}`], ['أهداف سرّية', `${s.secrets}/${s.secretsTotal}`], ['مرات انمسكت', s.caught], ['أعلى عصبية', Math.round(this.peak) + '%'],
        ['شباشب أكلتها', s.hits], ['شباشب تفاديتها', s.dodged], ['محاضرات', s.lectures], ['طلبات أبوك', `${s.errands} ✓ · ${s.late} ✗`]],
      dad: '…',
    }, { next: () => this.app.playDay(this.dayIndex + 1), again: () => this.app.playDay(this.dayIndex), week: () => this.app.showWeek() });
    this.report(win, stars, facts);
  }
  facts(win) {
    const s = this.stats, f = [];
    f.push(win ? 'عدّى اليوم بدون ما تنفجر' : 'خلّاك تنفجر من العصبية بآخر اليوم');
    if (s.choresTotal) f.push(s.chores >= s.choresTotal ? 'خلّص كل شغل البيت اللي عليه' : `خلّص ${s.chores} من ${s.choresTotal} من شغل البيت بس`);
    if (s.caught) f.push(`مسكته ${s.caught} مرات بيعمل إشي غلط`);
    if (s.wasted) f.push(`لقيت ${s.wasted} أضوية وأجهزة شغّالة عالفاضي`);
    if (s.hits) f.push(`أكل منك الشبشب ${s.hits} مرات`);
    if (s.dodged) f.push(`تفادى الشبشب ${s.dodged} مرات`);
    if (s.lectures) f.push(`أعطيته ${s.lectures} محاضرة`);
    if (s.confiscations) f.push('صادرت تلفونه');
    if (s.errands) f.push(`جابلك ${s.errands} طلبات بوقتها`);
    if (s.late) f.push(`تأخر عليك بـ ${s.late} طلبات`);
    if (s.woke) f.push('صحّاك من قيلولتك');
    if (s.broke) f.push('كسر المزهرية');
    if (s.framed) f.push('لبّس التهمة لأخوه');
    if (s.escapes) f.push(`هرب منك ${s.escapes} مرات`);
    if (s.covered) f.push('أمه غطّت عليه');
    if (s.secrets) f.push('وأنت حاسس إنه كان بيلعب من وراك');
    if (s.tires) f.push('وإنت (الأب) نفّست عجل سيارة واحد غريب صفّ على باب الدار، ومبسوط من حالك');
    return f;
  }
  async report(win, stars, facts) {
    const fallback = () => { const cat = !win ? 'dad.explode' : stars >= 3 ? 'dad.praise' : stars === 2 ? 'dad.cmd.ok' : 'dad.lecture.end'; const l = pickLine(cat); ui.endDad(l.text); if (l.has && audio.ready) playVoice(l.id, null); };
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 9000);
      const r = await fetch(BASE + 'api/report', { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: TRAITS[this.playerKey].name, day: this.day.name, big: 'سيف', facts }) });
      clearTimeout(to);
      const j = await r.json();
      if (!j.ok || !j.text) return fallback();
      ui.endDad(j.text);
      // the voice takes a while longer: ask for it separately and play it when it lands
      const day = this.dayIndex, seg = this.stats;
      fetch(BASE + 'api/voice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: j.text }) }).then((r2) => r2.json()).then((v) => {
        if (!v.audio || !audio.ready || this.active || this.dayIndex !== day || this.stats !== seg) return;
        const bin = atob(v.audio), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i); playBuffer(buf.buffer, null);
      }).catch(() => {});
    } catch { fallback(); }
  }
}
const RULE_FOUND = 8;
