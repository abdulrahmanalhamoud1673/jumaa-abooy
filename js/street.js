// The lane outside the gate. Now and then somebody leaves a car right across it, and dad deals with it the way
// dads do: out he goes, down goes the tyre, back he comes in a better mood. The gate camera shows it in a corner.
import * as THREE from 'three';
import { makeCar } from './cars.js';
import { sfx } from './audio.js';
import { ui } from './ui.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const VISITORS = [
  { kind: 'sedan', taxi: true, color: 0xf2b90c, plate: '50-1234' },
  { kind: 'hatch', color: 0xa3161c, plate: '22-98765' },
  { kind: 'sedan', color: 0x8c9198, plate: '17-44210' },
  { kind: 'hatch', color: 0x1f3f6e, plate: '31-70552' },
  { kind: 'sedan', color: 0x17191c, plate: '10-88801' },
];

export class Street {
  constructor(game) {
    this.game = game; this.car = null; this.engine = null; this.state = 'none'; this.t = 0; this.at = Infinity; this.last = -1;
    this.pipOn = false; this.q = null; this.qi = 0;
    this.cam = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 120);       // on a bracket off the gate pier, looking down the kerb
    this.cam.position.set(22.6, 2.25, 10.0); this.cam.lookAt(23.45, 0.4, 7.0);
  }
  pip(on) { this.pipOn = on; ui.pip(on); }
  get busy() { return ['arriving', 'parked', 'deed', 'flat', 'owner', 'leaving'].includes(this.state); }
  cues(list) { this.q = list; this.qi = 0; }
  clear() {
    if (this.engine) { this.engine.stop(0.1); this.engine = null; }
    if (this.car) { this.car.dispose(); this.car = null; }
    this.q = null;
  }
  // seg.visitor: [earliest, latest] second of the segment. The first time is certain; after that it is a maybe.
  reset(seg) {
    const g = this.game, w = g.world;
    this.clear(); this.state = 'none'; this.t = 0; this.called = false; this.pip(false);
    w.gate.target = 0; w.gate.k = 0;
    const force = new URLSearchParams(location.search).has('car');
    this.at = seg.visitor && (force || !g.save.sawTire || Math.random() < 0.6) ? (force ? 5 : rnd(seg.visitor[0], seg.visitor[1])) : Infinity;
  }
  // the valve of the tyre against the kerb: where dad's hand goes
  get wheel() { const c = this.car, w = c.wheels[1], S = c.spec; return { x: c.x + w.sx * (c.track + S.tireW / 2 + 0.02), y: c.y + S.wheelR - 0.17, z: c.z + w.az - 0.1 }; }
  flatten(k) { this.car.setFlat(1, k); }
  aborted() { if (this.state === 'deed') { this.state = 'parked'; this.t = 20; } }
  done() {
    const g = this.game;
    this.state = 'flat'; this.t = 0; this.ownerAt = rnd(18, 28);
    if (!g.save.sawTire) { g.save.sawTire = true; g.storeSave(); }
  }

  arrive() {
    const g = this.game, S = g.world.street;
    let i; do { i = Math.floor(Math.random() * VISITORS.length); } while (i === this.last);
    this.last = i;
    const car = this.car = makeCar(VISITORS[i].kind, { ...VISITORS[i], low: g.world.low });
    car.x = S.x; car.y = S.y; car.z = -15; car.v = 0;
    car.group.position.set(car.x, car.y, car.z); g.scene.add(car.group);
    if (g.world.dark) car.lights(true);
    this.engine = sfx.engine({ x: car.x, y: 0.6, z: car.z });
    this.state = 'arriving'; this.t = 0;
  }
  owner(flat) {
    const g = this.game, car = this.car, pos = () => ({ x: car.x, y: 0.7, z: car.z });
    this.state = 'owner'; this.t = 0; this.flat = flat;
    const list = [[0, () => { this.pip(true); sfx.carDoor(pos()); }], [1.0, () => sfx.starter(pos())], [1.7, () => { this.engine = sfx.engine(pos()); if (g.world.dark) car.lights(true); }]];
    if (flat) list.push(
      [2.9, () => sfx.honk(pos(), 1.1)],
      [4.3, () => { sfx.honk(pos(), 1.7); g.toast('صاحب السيارة رجع… ولقى العجل منفّس! 😂', 'good'); }],
      [5.6, () => { const d = g.dad; if (d.calm && !g.flags.guests && !d.talking) d.say('dad.car.deny', { loud: true, far: true }); }]);
    list.push([flat ? 7.6 : 2.6, () => { this.state = 'leaving'; this.t = 0; this.flapD = 0; }]);
    this.cues(list);
  }

  update(dt) {
    const g = this.game, S = g.world.street, dad = g.dad, car = this.car;
    this.t += dt;
    const pos = car && { x: car.x, y: 0.7, z: car.z };
    const drive = (v) => { car.z += v * dt; car.group.position.z = car.z; car.roll(v * dt); car.v = v; };
    while (this.q && this.qi < this.q.length && this.t >= this.q[this.qi][0]) this.q[this.qi++][1]();
    switch (this.state) {
      case 'none': if ((g.delivery && g.delivery.busy) || (g.vendors && g.vendors.busy)) this.at += dt; else if (g.segT >= this.at && !g.over && !g.ended) this.arrive(); break;
      case 'arriving': {
        // brakes so as to stop on the mark, nose dipping as it does
        const left = S.park - car.z, v = Math.min(5.4, Math.sqrt(Math.max(0, 2 * 2.6 * left)) + 0.15);
        drive(v);
        car.dive += ((left < 6 ? 0.018 * Math.min(1, v / 3) : 0) - car.dive) * Math.min(1, dt * 5); car.brake(left < 6); car.pose();
        this.engine.set(pos, 0.15 + v / 5.4 * 0.6);
        if (!this.pipOn && car.z > -5) this.pip(true);
        if (left < 0.02) {
          car.z = S.park; car.group.position.z = car.z; car.dive = 0; car.pose();
          this.state = 'parked'; this.t = 0; sfx.brake(pos);
          g.toast('🚗 حدا صفّ سيارته على باب الدار!', 'bad');
          this.cues([[0.8, () => { this.engine.stop(0.5); this.engine = null; car.brake(false); }], [1.9, () => sfx.carDoor(pos)], [2.7, () => sfx.carDoor(pos)],
            [3.6, () => { sfx.lock(pos); car.blink(true); }], [3.8, () => car.blink(false)], [4.0, () => car.blink(true)], [4.2, () => { car.blink(false); car.lights(false); }], [5.2, () => this.pip(false)]]);
        }
        break;
      }
      case 'parked':
        if (!this.called && this.t > 6 && dad.canTire()) { this.called = true; this.state = 'deed'; dad.startTire(this); } else if (this.t > 85) this.owner(false);
        break;
      case 'deed': break;                     // dad is at it (npc.js)
      case 'flat': if (this.t > this.ownerAt) this.owner(true); break;
      case 'owner': break;
      case 'leaving': {
        const want = this.flat ? 1.5 : 4.6;
        drive(car.v + (want - car.v) * Math.min(1, dt * 1.4));
        if (this.flat) {                      // limping off on the rim: flop, flop, flop
          this.flapD += car.v * dt;
          if (this.flapD > 2 * Math.PI * car.spec.wheelR) { this.flapD = 0; sfx.flop({ x: car.x - 0.8, y: 0.2, z: car.z + 1.3 }); car.dive = 0.012; }
          car.dive *= Math.max(0, 1 - dt * 6); car.pose();
        }
        this.engine.set(pos, this.flat ? 0.3 : 0.2 + car.v / 6);
        if (this.pipOn && car.z > S.park + 9.5) this.pip(false);
        if (car.z > 36) { this.clear(); this.state = 'gone'; }
        break;
      }
    }
  }
}
