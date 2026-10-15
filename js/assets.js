// Loads everything the game needs: materials, the family's models, the animation library and the voice script.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const A = { tex: {}, models: {}, clips: null, lines: null, voice: {}, avatars: {} };

const TEXTURES = ['tiles', 'marble', 'checker', 'bathfloor', 'whitetile', 'wall', 'oak', 'walnut', 'jacquard', 'plaid',
  'sheet', 'leather', 'pavers', 'stone'];
export const FAMILY = ['dad', 'mom', 'big', 'kid', 'sis'];
export const GUESTS = ['uncle', 'aunt'];
export const BASE = new URL('../', import.meta.url).href;   // project root, wherever the page lives

const texLoader = new THREE.TextureLoader();
function loadTex(url, srgb) {
  return new Promise((resolve) => {
    texLoader.load(url, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = 8;
      resolve(t);
    }, undefined, () => resolve(null));
  });
}

// The animation library is two flat binary files (see tools/convert.html):
// quat.bin = int16 quaternions per frame per body bone (+ one finger pose per clip), pos.bin = float32 root positions.
class ClipLibrary {
  constructor(index, quat, pos) {
    this.index = index; this.quat = quat; this.pos = pos; this.cache = new Map();
  }
  has(name) { return !!this.index.clips[name]; }
  info(name) { return this.index.clips[name]; }
  // pelvis: the avatar's hip height in cm; the root track is scaled so short characters keep their feet on the floor
  get(name, pelvis = 89.5) {
    const key = name + '|' + pelvis;
    if (this.cache.has(key)) return this.cache.get(key);
    const c = this.index.clips[name];
    if (!c) throw new Error('no clip ' + name);
    const { fps, body, fingers } = this.index;
    const times = new Float32Array(c.frames);
    for (let i = 0; i < c.frames; i++) times[i] = i / fps;
    const tracks = [];
    const nb = body.length;
    body.forEach((bone, b) => {
      const v = new Float32Array(c.frames * 4);
      for (let f = 0; f < c.frames; f++) for (let k = 0; k < 4; k++) v[f * 4 + k] = this.quat[c.q + (f * nb + b) * 4 + k] / 32767;
      tracks.push(new THREE.QuaternionKeyframeTrack(bone + '.quaternion', times, v));
    });
    fingers.forEach((bone, b) => {
      const v = new Float32Array(4);
      for (let k = 0; k < 4; k++) v[k] = this.quat[c.f + b * 4 + k] / 32767;
      tracks.push(new THREE.QuaternionKeyframeTrack(bone + '.quaternion', [0], v));
    });
    const scale = pelvis / 89.5;
    const p = new Float32Array(c.frames * 3);
    for (let i = 0; i < p.length; i++) p[i] = this.pos[c.p + i] * scale;
    tracks.push(new THREE.VectorKeyframeTrack('Bip01.position', times, p));
    const clip = new THREE.AnimationClip(name, (c.frames - 1) / fps, tracks);
    const out = { clip, loop: c.loop, speed: c.speed * scale, duration: clip.duration };
    this.cache.set(key, out);
    return out;
  }
}

export async function loadAll(onProgress) {
  let done = 0;
  const jobs = [];
  const step = (p) => { jobs.push(p.then((v) => { done++; onProgress && onProgress(done / jobs.length); return v; })); };

  for (const name of TEXTURES) {
    A.tex[name] = {};
    step(loadTex(`${BASE}assets/tex/${name}_d.jpg`, true).then((t) => { A.tex[name].d = t; }));
    step(loadTex(`${BASE}assets/tex/${name}_n.jpg`, false).then((t) => { A.tex[name].n = t; }));
    step(loadTex(`${BASE}assets/tex/${name}_r.jpg`, false).then((t) => { A.tex[name].r = t; }));
  }
  const gltf = new GLTFLoader();
  for (const name of FAMILY) {
    step(gltf.loadAsync(`${BASE}assets/models/${name}.glb`).then((g) => { A.models[name] = g.scene; }));
  }
  for (const name of GUESTS) {      // Thursday's visitors are optional: the game runs without them
    step(gltf.loadAsync(`${BASE}assets/models/${name}.glb`).then((g) => { A.models[name] = g.scene; }).catch(() => {}));
  }
  step((async () => {
    const [index, quat, pos] = await Promise.all([
      fetch(BASE + 'assets/anims/index.json').then((r) => r.json()),
      fetch(BASE + 'assets/anims/quat.bin').then((r) => r.arrayBuffer()),
      fetch(BASE + 'assets/anims/pos.bin').then((r) => r.arrayBuffer()),
    ]);
    A.clips = new ClipLibrary(index, new Int16Array(quat), new Float32Array(pos));
    A.avatars = index.avatars;
  })());
  step(fetch(BASE + 'assets/voice/lines.json').then((r) => r.json()).then((j) => { A.lines = j; }));
  step(fetch(BASE + 'assets/voice/manifest.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((j) => { A.voice = j; }));
  await Promise.all(jobs);
}

const matCache = new Map();
// A tiling PBR material from assets/tex. Geometry UVs are in metres (see world.js), `size` = metres per repeat.
export function texMat(name, { color = 0xffffff, rough = 1, size = 1, normal = 1, metal = 0 } = {}) {
  const key = [name, color, rough, size, normal, metal].join('|');
  if (matCache.has(key)) return matCache.get(key);
  const t = A.tex[name] || {};
  const m = new THREE.MeshStandardMaterial({
    color, map: t.d || null, normalMap: t.n || null, roughnessMap: t.r || null, roughness: rough, metalness: metal,
  });
  if (t.n) m.normalScale.set(normal, normal);
  m.userData.uvSize = size;
  matCache.set(key, m);
  return m;
}
export function flatMat(color, { rough = 0.7, metal = 0, emissive = 0x000000, emissiveIntensity = 1, opacity = 1 } = {}) {
  const key = ['flat', color, rough, metal, emissive, emissiveIntensity, opacity].join('|');
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive, emissiveIntensity,
    transparent: opacity < 1, opacity });
  m.userData.uvSize = 1;
  matCache.set(key, m);
  return m;
}
