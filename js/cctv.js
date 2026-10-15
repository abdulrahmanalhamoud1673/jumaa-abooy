// The house cameras. Four of them, split four ways on a monitor in the living room beside the TV; one picture is
// refreshed every few frames (so they move in the jerky way real ones do), and only while somebody could be looking.
// Dad keeps half an eye on it from the sofa: if he glances over while you are on a camera doing what you should not,
// he has seen you, wherever he is sitting.
import * as THREE from 'three';

const FEEDS = [
  { id: 'gate', label: 'البوابة', pos: [22.2, 2.16, 9.7], look: [23.3, 0.35, 6.6], fov: 52, zone: (x, z) => x > 20.3 && z > 3.5 && z < 8.5 },
  { id: 'yard', label: 'الحوش', pos: [16.35, 2.6, 0.35], look: [19.5, 0.3, 6.8], fov: 64, zone: (x) => x > 16.2 },
  { id: 'hall', label: 'الممر', pos: [0.4, 2.55, 5.5], look: [8, 0.8, 5.5], fov: 60, zone: (x, z) => z > 4.5 && z < 6.5 && x < 16 },
  { id: 'kitchen', label: 'المطبخ', pos: [15.7, 2.6, 6.72], look: [12.6, 0.5, 10.6], fov: 72, zone: (x, z) => x > 11 && x < 16 && z > 6.5 },
];
export const MONITOR = { x: 5.115, y: 1.66, z: 6.95 };

export class Cctv {
  constructor(game) {
    this.game = game; this.i = 0; this.tick = 0;
    const low = game.world.low, W = low ? 384 : 512, H = W * 9 / 16;
    this.rt = new THREE.WebGLRenderTarget(W, H, { colorSpace: THREE.SRGBColorSpace });
    this.cams = FEEDS.map((f, i) => {
      const c = new THREE.PerspectiveCamera(f.fov, 16 / 9, 0.1, 60); c.position.set(...f.pos); c.lookAt(...f.look); c.updateMatrixWorld();
      return { ...f, cam: c, q: [(i % 2) * W / 2, (i < 2 ? 1 : 0) * H / 2, W / 2, H / 2] };
    });
    this.W = W; this.H = H;
    this.build();
  }
  build() {
    const w = this.game.world, g = new THREE.Group(), M = w.M;
    // a monitor on the wall, its recorder on a little shelf below, the cable down to it
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.42, 0.7), M.black); bezel.position.set(0.0, 0, 0); g.add(bezel);
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.375), new THREE.MeshBasicMaterial({ map: this.rt.texture })); this.screen.rotation.y = Math.PI / 2; this.screen.position.set(0.019, 0, 0); g.add(this.screen);
    const lc = document.createElement('canvas'); lc.width = 512; lc.height = 288; this.lc = lc; this.lt = new THREE.CanvasTexture(lc); this.lt.colorSpace = THREE.SRGBColorSpace;
    this.labels = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.375), new THREE.MeshBasicMaterial({ map: this.lt, transparent: true, depthWrite: false })); this.labels.rotation.y = Math.PI / 2; this.labels.position.set(0.021, 0, 0); g.add(this.labels);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.36), M.walnut); shelf.position.set(0.09, -0.36, 0); g.add(shelf);
    const dvr = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.045, 0.3), M.black); dvr.position.set(0.09, -0.325, 0); g.add(dvr);
    this.led = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.006, 0.012), new THREE.MeshStandardMaterial({ color: 0x113311, emissive: 0x35ff5a, emissiveIntensity: 1.6 })); this.led.position.set(0.177, -0.32, 0.11); g.add(this.led);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1.25, 6), M.dark); cable.position.set(0.012, -0.98, 0.16); g.add(cable);
    g.position.set(MONITOR.x, MONITOR.y, MONITOR.z); g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
    w.live(g); this.group = g;
    // and the cameras themselves, small white domes high on the walls
    for (const f of FEEDS) {
      const cam = new THREE.Group(), body = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.07, 4, 10), M.white); body.rotation.z = Math.PI / 2; cam.add(body);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.022, 14), M.black); lens.position.x = 0.072; lens.rotation.y = Math.PI / 2; cam.add(lens);
      const red = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 4), new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2020, emissiveIntensity: 2 })); red.position.set(0.06, 0.03, 0); cam.add(red);
      cam.position.set(...f.pos); cam.lookAt(...f.look); cam.rotateY(-Math.PI / 2); w.live(cam);
    }
    this.drawLabels(0);
  }
  drawLabels(sec) {
    const g = this.lc.getContext('2d'), W = 512, H = 288;
    g.clearRect(0, 0, W, H);
    g.strokeStyle = 'rgba(10,10,10,.95)'; g.lineWidth = 4; g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
    g.font = 'bold 15px Cairo, "Segoe UI", sans-serif'; g.textBaseline = 'top';
    this.cams.forEach((c, i) => {
      const x = (i % 2) * W / 2, y = (i < 2 ? 0 : 1) * H / 2;
      g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x + 6, y + 6, 92, 20);
      g.fillStyle = '#fff'; g.direction = 'ltr'; g.textAlign = 'left'; g.fillText(`CAM${i + 1}`, x + 10, y + 8);
      g.direction = 'rtl'; g.textAlign = 'right'; g.fillText(c.label, x + 94, y + 8);
      if (sec % 2) { g.fillStyle = '#ff3030'; g.beginPath(); g.arc(x + W / 2 - 16, y + 16, 5, 0, 7); g.fill(); }
    });
    const s = this.game.seg, now = s && s.clock ? s.clock[0] + (s.clock[1] - s.clock[0]) * Math.min(1, this.game.segT / s.time) : 0;
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(W - 92, H - 26, 86, 20); g.fillStyle = '#fff'; g.direction = 'ltr'; g.textAlign = 'left';
    g.fillText(`${String(Math.floor(now / 60) % 24).padStart(2, '0')}:${String(Math.floor(now % 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`, W - 86, H - 24);
    this.lt.needsUpdate = true;
  }
  // which camera (if any) the kid is on right now
  seen(p) { return this.cams.find((c) => c.zone(p.x, p.z)) || null; }

  update(dt) {
    const g = this.game, p = g.player, r = g.app.renderer;
    const sec = Math.floor(g.now);
    if (sec !== this.sec) { this.sec = sec; this.drawLabels(sec); this.led.material.emissiveIntensity = sec % 2 ? 1.8 : 0.6; }
    // nobody near enough to see the screen: the pictures can wait
    const near = Math.hypot(p.x - MONITOR.x, p.z - MONITOR.z) < 7.5 || g.world.roomAt(p.x, p.z) === 'living';
    if (!near) return;
    this.tick = (this.tick + 1) % (g.world.low ? 8 : 4);
    if (this.tick) return;
    const c = this.cams[this.i]; this.i = (this.i + 1) % this.cams.length;
    const keep = r.shadowMap.autoUpdate, was = r.getRenderTarget();
    r.shadowMap.autoUpdate = false; this.screen.visible = false;
    this.rt.viewport.set(...c.q); this.rt.scissor.set(...c.q); this.rt.scissorTest = true;
    r.setRenderTarget(this.rt); r.render(g.scene, c.cam); r.setRenderTarget(was);
    this.screen.visible = true; r.shadowMap.autoUpdate = keep;
  }
}
