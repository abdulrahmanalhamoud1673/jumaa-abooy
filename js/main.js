// Boot: load, build the house and the family, run the menus and the frame loop.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { A, loadAll } from './assets.js';
import { World } from './world.js';
import { Character } from './char.js';
import { Game } from './game.js';
import { initInput, pollInput, endFrame, input } from './input.js';
import { initAudio, setListener, setVolume, preload, suspend } from './audio.js';
import { ui } from './ui.js';
import { TRAITS } from './player.js';
import { DAYS } from './days.js';

const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const canvas = $('c');
const touchDevice = matchMedia('(pointer: coarse)').matches;
let low = q.has('low') || touchDevice || localStorage.getItem('jumaa.low') === '1';
if (touchDevice) document.body.classList.add('touch');
// Phones start a little under native sharpness and then follow the frame rate (see tune)
const prMax = Math.min(devicePixelRatio || 1, 2);
let pr = low ? Math.min(prMax, 1.5) : prMax, ftAvg = 25, prHold = 3000;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.3;
const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.08, 160);

// A quarter step down when frames run long, a small step back up when there is room to spare.
function tune(ms) {
  if (!low || ms > 250 || app.mode !== 'play') return;
  ftAvg += (ms - ftAvg) * 0.06; prHold -= ms;
  if (prHold > 0) return;
  // (a phone capped at 30 frames a second sits between the two limits and is left alone)
  if (ftAvg > 38 && pr > 1) { pr = Math.max(1, pr - 0.25); prHold = 2500; ftAvg = 25; } else if (ftAvg < 18.5 && pr < prMax) { pr = Math.min(prMax, pr + 0.15); prHold = 6000; ftAvg = 25; }
}
function fit() {
  const w = innerWidth || 1280, h = innerHeight || 720;
  if (canvas.width !== Math.floor(w * pr) || canvas.height !== Math.floor(h * pr)) {
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = w < h ? 78 : 62; camera.updateProjectionMatrix();
  }
}

const app = {
  scene, camera, renderer, world: null, chars: {}, game: null, who: null, mode: 'menu',
  resume() { this.mode = 'play'; initAudio(); suspend(false); },
  playDay(i) {
    const day = DAYS[i], seg = day.segs[0];
    this.mode = 'menu'; ui.hud(false);
    menuScene(false);
    ui.intro(day, seg, seg.tasks.filter((t) => !t.only || t.only.includes(this.who)), 0, () => { initAudio(); preload('dad.'); this.mode = 'play'; this.game.start(i, this.who); });
  },
  showWeek() {
    this.mode = 'menu'; if (this.game) this.game.active = false; ui.hud(false);
    menuScene(true);
    ui.week(DAYS, this.game.progress(this.who), TRAITS[this.who].name, (i) => this.playDay(i));
    ui.screen('week');
  },
  setLow(v, remember = true) {
    low = v; if (remember) localStorage.setItem('jumaa.low', v ? '1' : '0'); pr = v ? Math.min(prMax, 1.5) : prMax; this.world.setLow(v);
    renderer.shadowMap.needsUpdate = true; fit();
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  },
};
window.app = app;

// The family lined up in the living room behind the menus: dad in the middle, nobody comfortable.
function menuScene(on) {
  const c = app.chars; if (!c.dad) return;
  app.menuOn = on;
  if (!on) return;
  app.world.setTime('evening');
  for (const d of Object.values(app.world.devices)) d.set(d.id === 'light_hall' || d.id === 'light_living');
  c.dad.visible = true; c.dad.lying = 0; c.dad.place(8.0, 8.6, 0); c.dad.play('m_idle_angry_01'); c.dad.anger = 1; c.dad.overlay(null);
  [['big', 6.95, 8.35, 0.12], ['kid', 8.95, 8.85, -0.12], ['sis', 9.55, 8.3, -0.22], ['mom', 6.1, 8.75, 0.25]].forEach(([k, x, z, h]) => { c[k].visible = true; c[k].lying = 0; c[k].tilt.rotation.x = 0; c[k].place(x, z, h); c[k].release(); c[k].play(k === 'mom' ? 'f_idle_neutral_01' : 'm_idle_nervous_01'); c[k].overlay(null); c[k].look = null; if (c[k].outfit) c[k].outfit.wear('home'); });
  for (const k of ['uncle', 'aunt']) if (c[k]) c[k].visible = false;
}

function portrait(key) {
  const c = app.chars[key], w = 300, h = 330;
  const rt = new THREE.WebGLRenderTarget(w, h, { colorSpace: THREE.SRGBColorSpace });
  const s = new THREE.Scene(); s.background = new THREE.Color(0x2c2218); s.environment = scene.environment; s.environmentIntensity = 0.5;
  s.add(new THREE.HemisphereLight(0xffffff, 0x6b5a45, 1.2));
  const l = new THREE.DirectionalLight(0xffe6c4, 3); l.position.set(1.5, 2.5, 3); s.add(l);
  const parent = c.root.parent;
  c.place(0, 0, 0.25); c.root.rotation.y = 0.25; c.play('m_idle_neutral_01'); c.update(0.4);
  s.add(c.root);
  const cam = new THREE.PerspectiveCamera(24, w / h, 0.1, 20), top = c.height;
  cam.position.set(0.25, top - 0.22, 2.25); cam.lookAt(0, top - 0.28, 0);
  renderer.setRenderTarget(rt); renderer.render(s, cam);
  const px = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
  renderer.setRenderTarget(null); rt.dispose();
  if (parent) parent.add(c.root); else scene.add(c.root);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'), img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  g.putImageData(img, 0, 0);
  return cv.toDataURL('image/jpeg', 0.85);
}

async function boot() {
  fit();
  await loadAll((p) => ui.loading(p * 0.9));
  ui.loading(0.93, 'عم نفرش الصالون…');
  await new Promise((r) => setTimeout(r, 30));
  app.world = new World(scene, { low });
  for (const key of Object.keys(A.models)) {
    const c = new Character(key, { scale: key === 'big' ? 0.93 : 1 });
    scene.add(c.root); app.chars[key] = c;
  }
  app.game = new Game(app);
  ui.loading(0.97, 'أبوك لبس الشبشب…');
  const portraits = {};
  for (const k of Object.keys(TRAITS)) portraits[k] = portrait(k);
  ui.dadFace(portrait('dad'));
  if (low) app.setLow(true, false);       // a phone starts light without that becoming the saved choice for this address
  $('optLow').checked = low;
  if (touchDevice) { input.touch = true; ui.bindTouch(); }
  initInput(canvas);
  menuScene(true);

  ui.pickCards(TRAITS, portraits, (key) => { app.who = key; app.showWeek(); });
  $('btnStart').onclick = () => {
    initAudio(); ui.screen('pick');
    // on a phone: full screen and on its side, where the browser allows it
    if (touchDevice) { try { const el = document.documentElement, f = el.requestFullscreen || el.webkitRequestFullscreen; const pm = f && f.call(el); if (pm && pm.then) pm.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {}); } catch { /* not allowed here: the rotate hint covers it */ } }
  };
  if ($('btnAnyway')) $('btnAnyway').onclick = () => document.body.classList.add('anyway');
  $('btnHow').onclick = () => { $('how').hidden = !$('how').hidden; };
  for (const b of document.querySelectorAll('[data-back]')) b.onclick = () => ui.screen(b.dataset.back);
  $('btnResume').onclick = () => pause(false);
  $('btnRestart').onclick = () => { pause(false); app.playDay(app.game.dayIndex); };
  $('btnQuit').onclick = () => { pause(false); app.showWeek(); };
  $('optLow').onchange = (e) => app.setLow(e.target.checked);
  $('optVol').oninput = (e) => setVolume(e.target.value / 100);
  document.addEventListener('visibilitychange', () => { if (document.hidden && app.mode === 'play' && app.game.active) pause(true); });
  ui.loading(1);
  ui.screen('title');
  // dev: /?who=big&day=0 jumps straight into a day
  if (q.has('day')) { app.who = q.get('who') || 'big'; app.mode = 'play'; app.game.start(+q.get('day'), app.who); if (q.has('seg') && DAYS[+q.get('day')].segs[+q.get('seg')]) { app.game.segIndex = +q.get('seg'); app.game.startSeg(false); } }
  window.shot = async (name = 'game') => {
    frame(0);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.86));
    return (await fetch('/__shot?name=' + name, { method: 'POST', body: blob })).json();
  };
  last = performance.now();
  requestAnimationFrame(loop);
}

function pause(on) {
  const g = app.game; if (!g || !g.active && on) return;
  g.paused = on; suspend(on);
  if (on && document.pointerLockElement) document.exitPointerLock();
  ui.screen(on ? 'pause' : null);
}

const V = new THREE.Vector3();
let last = 0, menuT = 0;
function frame(dt) {
  fit();
  const g = app.game, w = app.world;
  pollInput();
  if (app.mode === 'play' && g.active) {
    if (input.pressed.has('pause')) pause(!g.paused);
    g.update(dt);
    if (!g.paused) g.player.camera(camera, dt);
    if (g.shake > 0) { g.shake -= dt; camera.position.x += (Math.random() - 0.5) * 0.09; camera.position.y += (Math.random() - 0.5) * 0.09; }
  } else if (app.mode === 'play' && g.over) {
    // the day is over but the scene keeps breathing behind the report card
    for (const c of Object.values(app.chars)) c.update(dt);
  } else if (app.menuOn) {
    menuT += dt;
    for (const c of Object.values(app.chars)) c.update(dt);
    camera.position.set(8.0 + Math.sin(menuT * 0.18) * 0.6, 1.5, 11.0); camera.lookAt(8.0, 1.22, 8.5);
    app.chars.dad.look = camera.position;
  }
  renderer.toneMappingExposure = w.exposure || 1;
  camera.getWorldDirection(V);
  setListener(camera.position, V.x, V.z);
  renderer.render(scene, camera);
  // the gate camera: the same scene again, small, inside its frame in the corner
  const st = g && g.street;
  if (st && st.pipOn && app.mode === 'play' && g.active) {
    const r = $('pipView').getBoundingClientRect(), H = innerHeight || 720, keep = renderer.shadowMap.autoUpdate;
    if (r.width > 8) {
      st.cam.aspect = r.width / r.height; st.cam.updateProjectionMatrix();
      renderer.shadowMap.autoUpdate = false;
      renderer.setScissorTest(true); renderer.setScissor(r.left, H - r.bottom, r.width, r.height); renderer.setViewport(r.left, H - r.bottom, r.width, r.height);
      renderer.render(scene, st.cam);
      renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth || 1280, H);
      renderer.shadowMap.autoUpdate = keep;
    }
  }
  endFrame();
}
function loop(now) {
  requestAnimationFrame(loop);
  tune(now - last);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (dt > 0) frame(dt);
}
window.step = (dt = 0.033, n = 1) => { for (let i = 0; i < n; i++) frame(dt); };

boot().catch((e) => { console.error(e); ui.loading(0, 'صار خطأ بالتحميل: ' + e.message); });
