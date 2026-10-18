// Sound: recorded voice lines (assets/voice) + everything else synthesised with WebAudio.
import { A, BASE } from './assets.js';

let ctx = null, master = null, sfxBus = null, voiceBus = null, ambBus = null;
const wave8 = new Uint8Array(128);
const buffers = new Map();
const lastUsed = {};
export const audio = { volume: 0.8, ready: false };

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = audio.volume; master.connect(ctx.destination);
  // Three roads to the speakers. Effects share a compressor; voices have a gentler one of their own; the room's
  // quiet sounds (its tone, the television, the hum of trouble) have none. A shout must never squeeze everything
  // else down and let it surge back up, as a hiss, the moment it ends.
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(comp);
  const vcomp = ctx.createDynamicsCompressor(); vcomp.threshold.value = -9; vcomp.knee.value = 8; vcomp.ratio.value = 3; vcomp.attack.value = 0.004; vcomp.release.value = 0.12; vcomp.connect(master);
  voiceBus = ctx.createGain(); voiceBus.gain.value = 1.05; voiceBus.connect(vcomp);
  ambBus = ctx.createGain(); ambBus.gain.value = 1; ambBus.connect(master);
  audio.ready = true;
  startAmbience();
}
export function setVolume(v) { audio.volume = v; if (master) master.gain.value = v; }
export function suspend(on) { if (ctx) (on ? ctx.suspend() : ctx.resume()); }

export function setListener(pos, fx, fz) {
  if (!ctx) return;
  const l = ctx.listener;
  if (l.positionX) {
    l.positionX.value = pos.x; l.positionY.value = pos.y; l.positionZ.value = pos.z;
    l.forwardX.value = fx; l.forwardY.value = 0; l.forwardZ.value = fz; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
  } else { l.setPosition(pos.x, pos.y, pos.z); l.setOrientation(fx, 0, fz, 0, 1, 0); }
}

function panner(pos, ref = 2.2, rolloff = 1.1) {
  const p = ctx.createPanner();
  p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = rolloff; p.maxDistance = 40;
  p.positionX.value = pos.x; p.positionY.value = pos.y ?? 1.5; p.positionZ.value = pos.z;
  return p;
}

// A cheap horn loudspeaker on a truck roof: no bass, a honk in the middle, a little crackle, and the street throwing it back.
function megaphone() {
  const hp = ctx.createBiquadFilter(), pk = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), sh = ctx.createWaveShaper(), out = ctx.createGain(), dl = ctx.createDelay(1), fb = ctx.createGain();
  hp.type = 'highpass'; hp.frequency.value = 520; hp.Q.value = 0.8; pk.type = 'peaking'; pk.frequency.value = 1900; pk.gain.value = 7; pk.Q.value = 1.1;
  lp.type = 'lowpass'; lp.frequency.value = 3600; lp.Q.value = 0.9;
  const n = 1024, curve = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; curve[i] = Math.tanh(x * 3.2) / Math.tanh(3.2); }
  sh.curve = curve; out.gain.value = 0.75; dl.delayTime.value = 0.23; fb.gain.value = 0.24;
  hp.connect(pk); pk.connect(sh); sh.connect(lp); lp.connect(out); lp.connect(dl); dl.connect(fb); fb.connect(out); fb.connect(dl);
  return { input: hp, output: out };
}

async function load(id) {
  if (buffers.has(id)) return buffers.get(id);
  const p = fetch(`${BASE}assets/voice/${id}.mp3`).then((r) => { if (!r.ok) throw new Error('missing'); return r.arrayBuffer(); })
    .then((b) => ctx.decodeAudioData(b)).catch(() => null);
  buffers.set(id, p);
  return p;
}
// Warm the cache for a speaker so the first shout isn't late.
export function preload(prefix) {
  if (!ctx) return;
  const ids = Object.keys(A.voice).filter((k) => k.startsWith(prefix));
  let i = 0;
  const next = () => { if (i < ids.length) load(ids[i++]).then(() => setTimeout(next, 15)); };
  next(); next();
}

// Pick a variant of a line category that wasn't just used. -> { id, text, has (audio exists), dur }
// Every line of a group is said once before any of them comes round again, and that is remembered between games
// (so the first thing he shouts today is not the first thing he shouted yesterday).
let decks = {};
try { decks = JSON.parse(localStorage.getItem('jumaa.said') || '{}') || {}; } catch { decks = {}; }
export function pickLine(cat) {
  const entry = A.lines.lines[cat];
  if (!entry) return null;
  const n = entry.t.length, all = [...Array(n).keys()], voiced = all.filter((j) => A.voice[`${cat}.${j}`]), pool = voiced.length ? voiced : all;
  let said = Array.isArray(decks[cat]) ? decks[cat].filter((j) => j < n) : [];
  let left = pool.filter((j) => !said.includes(j));
  if (!left.length) { const last = lastUsed[cat] ?? said[said.length - 1]; said = last != null && pool.length > 1 ? [last] : []; left = pool.filter((j) => !said.includes(j)); }
  const i = left[Math.floor(Math.random() * left.length)];
  said.push(i); decks[cat] = said; lastUsed[cat] = i;
  try { localStorage.setItem('jumaa.said', JSON.stringify(decks)); } catch { /* private window: forget */ }
  const id = `${cat}.${i}`, v = A.voice[id];
  return { id, text: entry.t[i], who: entry.who, style: entry.style, has: !!v, dur: v ? v.d : Math.max(1.2, entry.t[i].length * 0.075) };
}

// Play a recorded line at a position (or flat when pos is null). Returns a handle with stop().
export function playVoice(id, pos, { gain = 1, rate = 1, ref = 2.6, horn = false } = {}) {
  const handle = { stop() { this.src && this.src.stop(); }, src: null, mouth: () => 0 };
  if (!ctx || !A.voice[id]) return handle;
  load(id).then((buf) => {
    if (!buf || handle.cancelled) return;
    // play only the line itself (tools/trim_voice.py found where it starts and ends), eased in and out
    const v = A.voice[id], s = Math.min(v.s || 0, buf.duration - 0.05), e = Math.min(v.e || buf.duration, buf.duration), len = Math.max(0.05, e - s) / rate, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = ctx.createGain(), an = ctx.createAnalyser(); an.fftSize = 256;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.012); g.gain.setValueAtTime(gain, t + Math.max(0.02, len - 0.045)); g.gain.linearRampToValueAtTime(0.0001, t + len);
    src.connect(g);
    if (horn) { const m = megaphone(); g.connect(m.input); m.output.connect(an); } else g.connect(an);      // (the vegetable man's loudspeaker)
    if (pos) { const p = panner(pos, ref, 0.9); an.connect(p); p.connect(voiceBus); handle.panner = p; } else an.connect(voiceBus);
    src.start(t, s, len * rate + 0.02); handle.src = src;
    // how loud the voice is right now, 0..1: the speaker's jaw follows it
    handle.mouth = () => {
      if (ctx.currentTime > t + len) return 0;
      an.getByteTimeDomainData(wave8); let sum = 0; for (let i = 0; i < 128; i++) { const k = (wave8[i] - 128) / 128; sum += k * k; }
      return Math.min(1, Math.sqrt(sum / 128) * 4.5 / Math.max(0.5, gain));
    };
  });
  const stop = handle.stop.bind(handle);
  handle.stop = () => { handle.cancelled = true; try { stop(); } catch { /* not started */ } };
  return handle;
}
export function playBuffer(arrayBuffer, pos, onEnd) {
  if (!ctx) return;
  ctx.decodeAudioData(arrayBuffer).then((buf) => {
    const src = ctx.createBufferSource(); src.buffer = buf;
    if (pos) { const p = panner(pos, 3, 0.8); src.connect(p); p.connect(voiceBus); } else src.connect(voiceBus);
    src.onended = onEnd || null; src.start();
  }).catch(() => onEnd && onEnd());
}

// ---------- synth ----------
let noiseBuf = null;
function noise() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.loopStart = Math.random();
  return s;
}
function out(pos, ref) { if (!pos) return sfxBus; const p = panner(pos, ref || 1.6, 1.3); p.connect(sfxBus); return p; }
function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
// rise, hold (sinking to `tail` of the peak), fall: for sounds that last
function swell(g, t, a, peak, secs, tail = 0.35) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.linearRampToValueAtTime(peak * tail, t + Math.max(a + 0.01, secs - 0.25)); g.gain.linearRampToValueAtTime(0.0001, t + secs); }
function tone(freq, { type = 'sine', a = 0.005, d = 0.2, peak = 0.3, slide = 0, pos = null, delay = 0, ref } = {}) {
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + a + d);
  env(g, t, a, peak, d); o.connect(g); g.connect(out(pos, ref)); o.start(t); o.stop(t + a + d + 0.05);
}
function burst({ freq = 1000, q = 1, type = 'bandpass', a = 0.003, d = 0.1, peak = 0.4, pos = null, delay = 0, slide = 0, ref } = {}) {
  const t = ctx.currentTime + delay, s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + a + d);
  env(g, t, a, peak, d); s.connect(f); f.connect(g); g.connect(out(pos, ref)); s.start(t); s.stop(t + a + d + 0.05);
}

export const sfx = {
  step(pos, loud = 1, heavy = false) {
    if (!ctx) return;
    burst({ freq: heavy ? 180 : 320, q: 1.2, type: 'lowpass', d: heavy ? 0.11 : 0.07, peak: 0.16 * loud * (heavy ? 1.7 : 1), pos, ref: heavy ? 2.4 : 1.4 });
    if (heavy) burst({ freq: 1800, q: 2, d: 0.03, peak: 0.05 * loud, pos, delay: 0.02 });   // sandal slap
  },
  // a handle pressed and a latch let go, the leaf turning on its hinges; and shut: the leaf meeting the frame, the latch dropping in
  door(pos) { if (!ctx) return; burst({ freq: 2100, q: 5, d: 0.018, peak: 0.1, pos }); burst({ freq: 850, q: 3, d: 0.03, peak: 0.09, pos, delay: 0.04 }); tone(160, { type: 'triangle', a: 0.07, d: 0.22, peak: 0.014, slide: -30, pos, delay: 0.06 }); },
  doorShut(pos) { if (!ctx) return; burst({ freq: 120, type: 'lowpass', d: 0.1, peak: 0.26, pos }); burst({ freq: 1700, q: 5, d: 0.02, peak: 0.08, pos, delay: 0.035 }); },
  click() { if (!ctx) return; burst({ freq: 2600, q: 3, d: 0.025, peak: 0.25 }); },
  pick() { if (!ctx) return; tone(520, { d: 0.08, peak: 0.16 }); tone(780, { d: 0.1, peak: 0.14, delay: 0.06 }); },
  done() { if (!ctx) return; [523, 659, 784, 1046].forEach((f, i) => tone(f, { type: 'triangle', d: 0.22, peak: 0.16, delay: i * 0.08 })); },
  secret() { if (!ctx) return; [392, 494, 587, 740, 988].forEach((f, i) => tone(f, { type: 'triangle', d: 0.26, peak: 0.14, delay: i * 0.07 })); },
  bad() { if (!ctx) return; tone(196, { type: 'sawtooth', d: 0.3, peak: 0.14, slide: -80 }); tone(147, { type: 'sawtooth', d: 0.42, peak: 0.14, slide: -60, delay: 0.16 }); },
  alarm() { if (!ctx) return; tone(880, { type: 'square', d: 0.1, peak: 0.1 }); tone(660, { type: 'square', d: 0.14, peak: 0.1, delay: 0.12 }); },
  spotted() { if (!ctx) return; tone(110, { type: 'sawtooth', d: 0.7, peak: 0.2, slide: 190 }); burst({ freq: 300, type: 'lowpass', d: 0.5, peak: 0.25 }); },
  whoosh(pos) { if (!ctx) return; burst({ freq: 500, q: 0.8, a: 0.05, d: 0.28, peak: 0.4, slide: 2400, pos, ref: 3 }); },
  slap(pos) { if (!ctx) return; burst({ freq: 2400, q: 0.7, d: 0.07, peak: 0.9, pos, ref: 4 }); burst({ freq: 240, type: 'lowpass', d: 0.16, peak: 0.7, pos, ref: 4 }); tone(900, { type: 'square', d: 0.05, peak: 0.12, slide: -600, pos }); },
  thud(pos) { if (!ctx) return; burst({ freq: 110, type: 'lowpass', d: 0.25, peak: 0.8, pos, ref: 3 }); },
  crash(pos) {
    if (!ctx) return;
    for (let i = 0; i < 9; i++) tone(1800 + Math.random() * 4200, { type: 'triangle', d: 0.1 + Math.random() * 0.4, peak: 0.1, delay: Math.random() * 0.22, pos, ref: 5 });
    burst({ freq: 5000, q: 0.5, type: 'highpass', d: 0.5, peak: 0.5, pos, ref: 5 });
  },
  splash(pos) { if (!ctx) return; burst({ freq: 1400, q: 0.6, a: 0.02, d: 0.4, peak: 0.3, slide: -900, pos }); },
  water(pos) { if (!ctx) return; burst({ freq: 3000, q: 0.4, type: 'highpass', a: 0.1, d: 1.0, peak: 0.08, pos }); },
  bell() { if (!ctx) return; tone(1320, { d: 0.5, peak: 0.2 }); tone(1056, { d: 0.8, peak: 0.2, delay: 0.32 }); },
  horn(pos) { if (!ctx) return; for (const f of [392, 494]) { tone(f, { type: 'sawtooth', a: 0.02, d: 0.42, peak: 0.16, pos, ref: 8 }); tone(f, { type: 'sawtooth', a: 0.02, d: 0.6, peak: 0.16, pos, delay: 0.55, ref: 8 }); } },
  snore(pos) { if (!ctx) return; burst({ freq: 150, q: 5, a: 0.5, d: 0.6, peak: 0.5, pos, ref: 2.5, slide: 60 }); burst({ freq: 500, q: 2, a: 0.25, d: 0.7, peak: 0.1, pos, delay: 1.25, ref: 2.5, slide: -250 }); },
  heart() { if (!ctx) return; burst({ freq: 70, type: 'lowpass', d: 0.11, peak: 0.55 }); burst({ freq: 60, type: 'lowpass', d: 0.13, peak: 0.4, delay: 0.17 }); },
  ps(pos) { if (!ctx) return; tone(660 + Math.random() * 400, { type: 'square', d: 0.05, peak: 0.04, pos }); },
  type(pos) { if (!ctx) return; burst({ freq: 3200, q: 4, d: 0.015, peak: 0.07, pos }); },
  grunt(pos, pitch = 1) { if (!ctx) return; tone(120 * pitch, { type: 'sawtooth', a: 0.03, d: 0.3, peak: 0.25, slide: -30 * pitch, pos, ref: 3 }); burst({ freq: 600 * pitch, q: 3, a: 0.03, d: 0.3, peak: 0.12, pos, ref: 3 }); },
  ouch(pitch = 1) { if (!ctx) return; tone(520 * pitch, { type: 'triangle', a: 0.02, d: 0.28, peak: 0.25, slide: -260 * pitch }); },
  cough(pos) { if (!ctx) return; for (const dl of [0, 0.26]) burst({ freq: 700, q: 1.5, a: 0.01, d: 0.13, peak: 0.5, pos, delay: dl, ref: 3.5, slide: -300 }); },
  sizzle(pos) { if (!ctx) return; burst({ freq: 5200, q: 0.5, type: 'highpass', a: 0.2, d: 1.6, peak: 0.05, pos }); },
  sweep(pos) { if (!ctx) return; burst({ freq: 2600, q: 0.6, a: 0.12, d: 0.3, peak: 0.12, pos, slide: 1200 }); },
  chop() { if (!ctx) return; burst({ freq: 900, q: 2.5, d: 0.035, peak: 0.42 }); tone(180, { type: 'triangle', d: 0.05, peak: 0.22, slide: -60 }); },
  scrub() { if (!ctx) return; burst({ freq: 3400, q: 1.2, a: 0.03, d: 0.16, peak: 0.09, slide: -1200 }); },
  pour() { if (!ctx) return; burst({ freq: 700, q: 3, a: 0.05, d: 0.5, peak: 0.12, slide: 900 }); burst({ freq: 3600, q: 0.8, type: 'highpass', a: 0.05, d: 0.45, peak: 0.03 }); },
  glug() { if (!ctx) return; tone(160, { d: 0.11, peak: 0.25, slide: 120 }); tone(120, { d: 0.14, peak: 0.22, slide: 90, delay: 0.16 }); },
  peg() { if (!ctx) return; burst({ freq: 4200, q: 5, d: 0.02, peak: 0.3 }); },
  flap() { if (!ctx) return; burst({ freq: 500, q: 0.7, a: 0.02, d: 0.14, peak: 0.13, slide: 500 }); },
  hum(pos) { if (!ctx) return; tone(58, { type: 'sawtooth', a: 0.2, d: 1.0, peak: 0.05, pos, ref: 1.5 }); burst({ freq: 300, q: 1, type: 'lowpass', a: 0.3, d: 0.8, peak: 0.06, pos, ref: 1.5 }); },
  munch() { if (!ctx) return; burst({ freq: 420, q: 1.5, type: 'lowpass', d: 0.07, peak: 0.25 }); burst({ freq: 380, q: 1.5, type: 'lowpass', d: 0.07, peak: 0.2, delay: 0.16 }); },
  page() { if (!ctx) return; burst({ freq: 2500, q: 0.8, a: 0.04, d: 0.18, peak: 0.08, slide: 1500 }); },
  spray() { if (!ctx) return; burst({ freq: 6000, q: 0.6, type: 'highpass', a: 0.02, d: 0.25, peak: 0.1 }); },
  clink() { if (!ctx) return; tone(2400, { type: 'triangle', d: 0.12, peak: 0.1 }); tone(3300, { type: 'triangle', d: 0.09, peak: 0.07, delay: 0.02 }); },
  boil(pos) { if (!ctx) return; burst({ freq: 240, q: 2, type: 'lowpass', a: 0.1, d: 0.5, peak: 0.12, pos }); },
  whistle(pos) { if (!ctx) return; tone(1900, { type: 'sine', a: 0.25, d: 0.5, peak: 0.05, slide: 500, pos }); },
  pencil() { if (!ctx) return; burst({ freq: 3000, q: 2, a: 0.01, d: 0.07, peak: 0.035, slide: -800 }); },
  bubbles() { if (!ctx) return; for (let i = 0; i < 3; i++) tone(500 + Math.random() * 900, { d: 0.04, peak: 0.04, slide: 300, delay: i * 0.05 }); },
  // ---------- the lane outside ----------
  spit(pos) { if (!ctx) return; burst({ freq: 900, q: 2, d: 0.035, peak: 0.35, pos, ref: 3 }); burst({ freq: 5200, q: 0.8, type: 'highpass', a: 0.01, d: 0.09, peak: 0.3, pos, delay: 0.03, ref: 3 }); },
  hiss(pos, secs = 5) {          // a tyre giving up its air: bright at first, lower and weaker as it empties
    if (!ctx) return;
    const t = ctx.currentTime, s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.Q.value = 0.9; f.frequency.setValueAtTime(7200, t); f.frequency.exponentialRampToValueAtTime(1700, t + secs);
    swell(g, t, 0.05, 0.32, secs, 0.25); s.connect(f); f.connect(g); g.connect(out(pos, 3.5)); s.start(t); s.stop(t + secs + 0.1);
  },
  honk(pos, secs = 1.2) {
    if (!ctx) return;
    const t = ctx.currentTime, dst = out(pos, 9);
    for (const hz of [392, 494]) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = hz; swell(g, t, 0.02, 0.15, secs, 0.9); o.connect(g); g.connect(dst); o.start(t); o.stop(t + secs + 0.05); }
  },
  // A running engine that can be moved about and revved: -> { set(pos, rev 0..1), stop(fade) }
  engine(pos, pitch = 1) {          // (pitch 2: a scooter)
    if (!ctx) return { set() {}, stop() {} };
    const t = ctx.currentTime, p = panner(pos, 5, 1.1), g = ctx.createGain(), f = ctx.createBiquadFilter(), o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), n = noise(), nf = ctx.createBiquadFilter(), ng = ctx.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; o1.frequency.value = 58 * pitch; o2.frequency.value = 29 * pitch; f.type = 'lowpass'; f.frequency.value = 380; f.Q.value = 1.2;
    nf.type = 'bandpass'; nf.frequency.value = 900; nf.Q.value = 0.6; ng.gain.value = 0.3;
    o1.connect(f); o2.connect(f); n.connect(nf); nf.connect(ng); ng.connect(f); f.connect(g); g.connect(p); p.connect(sfxBus);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.14, t + 0.5);
    o1.start(); o2.start(); n.start();
    return {
      set(at, rev) { const now = ctx.currentTime; p.positionX.setTargetAtTime(at.x, now, 0.05); p.positionZ.setTargetAtTime(at.z, now, 0.05); o1.frequency.setTargetAtTime((52 + rev * 80) * pitch, now, 0.12); o2.frequency.setTargetAtTime((26 + rev * 40) * pitch, now, 0.12); f.frequency.setTargetAtTime((300 + rev * 700) * Math.sqrt(pitch), now, 0.12); },
      stop(fade = 0.5) { const now = ctx.currentTime; g.gain.cancelScheduledValues(now); g.gain.setTargetAtTime(0.0001, now, fade / 3); for (const s of [o1, o2, n]) s.stop(now + fade + 0.4); },
    };
  },
  starter(pos) { if (!ctx) return; for (let i = 0; i < 6; i++) { burst({ freq: 420, q: 3, d: 0.07, peak: 0.25, pos, delay: i * 0.11, ref: 4 }); tone(95, { type: 'sawtooth', d: 0.07, peak: 0.1, pos, delay: i * 0.11, ref: 4 }); } },
  brake(pos) { if (!ctx) return; tone(1500, { type: 'triangle', a: 0.03, d: 0.28, peak: 0.06, slide: -350, pos, ref: 5 }); },
  carDoor(pos) { if (!ctx) return; burst({ freq: 130, type: 'lowpass', d: 0.13, peak: 0.6, pos, ref: 4 }); burst({ freq: 2200, q: 3, d: 0.02, peak: 0.12, pos, delay: 0.01, ref: 4 }); },
  lock(pos) { if (!ctx) return; for (const dl of [0, 0.4]) tone(2350, { type: 'square', d: 0.07, peak: 0.07, pos, delay: dl, ref: 6 }); },
  flop(pos) { if (!ctx) return; burst({ freq: 150, type: 'lowpass', d: 0.13, peak: 0.6, pos, ref: 5 }); burst({ freq: 1100, q: 1.5, d: 0.05, peak: 0.16, pos, delay: 0.02, ref: 5 }); },
  // «Für Elise», the way every gas truck in Jordan plays it: a thin electronic tune out of a horn speaker, over and over.
  tune(pos) {
    if (!ctx) return { set() {}, stop() {} };
    const p = panner(pos, 7, 0.9), g = ctx.createGain(), m = megaphone(), f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 2600; g.gain.value = 0.0001; g.gain.setTargetAtTime(0.32, ctx.currentTime, 0.4);
    f.connect(m.input); m.output.connect(g); g.connect(p); p.connect(sfxBus);
    const N = [[76, 1], [75, 1], [76, 1], [75, 1], [76, 1], [71, 1], [74, 1], [72, 1], [69, 3], [60, 1], [64, 1], [69, 1], [71, 3], [64, 1], [68, 1], [71, 1], [72, 3], [64, 1],
      [76, 1], [75, 1], [76, 1], [75, 1], [76, 1], [71, 1], [74, 1], [72, 1], [69, 3], [60, 1], [64, 1], [69, 1], [71, 3], [64, 1], [72, 1], [71, 1], [69, 6], [0, 5]];
    const S16 = 0.155; let i = 0, at = ctx.currentTime + 0.1, live = true;
    const note = (midi, t, len) => {
      const fr = 440 * 2 ** ((midi - 69) / 12), o = ctx.createOscillator(), o2 = ctx.createOscillator(), e = ctx.createGain();
      o.type = 'square'; o.frequency.value = fr; o2.type = 'triangle'; o2.frequency.value = fr * 2; o2.detune.value = 6;
      e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.16, t + 0.006); e.gain.exponentialRampToValueAtTime(0.07, t + 0.09); e.gain.setValueAtTime(0.07, t + len - 0.03); e.gain.linearRampToValueAtTime(0.0001, t + len);
      o.connect(e); o2.connect(e); e.connect(f); o.start(t); o2.start(t); o.stop(t + len + 0.02); o2.stop(t + len + 0.02);
    };
    const pump = () => { if (!live) return; while (at < ctx.currentTime + 0.4) { const [n, d] = N[i]; if (n) note(n, at, d * S16 * 0.92); at += d * S16; i = (i + 1) % N.length; } };
    const timer = setInterval(pump, 90); pump();
    return {
      set(a, loud = 1) { const now = ctx.currentTime; p.positionX.setTargetAtTime(a.x, now, 0.05); p.positionZ.setTargetAtTime(a.z, now, 0.05); g.gain.setTargetAtTime(0.32 * loud, now, 0.3); },
      stop(fade = 1) { live = false; clearInterval(timer); const now = ctx.currentTime; g.gain.cancelScheduledValues(now); g.gain.setTargetAtTime(0.0001, now, fade / 3); },
    };
  },
  // a gas cylinder knocked against something: a hollow steel bong
  clang(pos, full = true) { if (!ctx) return; for (const [fr, pk, d] of [[full ? 210 : 330, 0.5, 0.9], [full ? 530 : 760, 0.25, 0.6], [1240, 0.12, 0.35]]) tone(fr, { type: 'sine', d, peak: pk, pos, ref: 6 }); burst({ freq: 2600, q: 2, d: 0.04, peak: 0.3, pos, ref: 6 }); },
  gate(pos, shut) { if (!ctx) return; tone(shut ? 420 : 300, { type: 'sawtooth', a: 0.05, d: 0.5, peak: 0.03, slide: shut ? -140 : 180, pos, ref: 4 }); burst({ freq: 1500, q: 8, a: 0.05, d: 0.45, peak: 0.06, slide: 700, pos, ref: 4 }); if (shut) burst({ freq: 700, q: 2, d: 0.08, peak: 0.35, pos, delay: 0.5, ref: 4 }); },
};

// ---------- ambience: room tone, the hum of trouble, the television ----------
let drone = null, tv = null;
function startAmbience() {
  // room tone: hardly there
  const room = noise(), rf = ctx.createBiquadFilter(), rg = ctx.createGain();
  rf.type = 'lowpass'; rf.frequency.value = 160; rg.gain.value = 0.012; room.connect(rf); rf.connect(rg); rg.connect(ambBus); room.start();
  // tension: a low soft hum, silent unless there is something to be tense about (Game.hud decides)
  const g = ctx.createGain(), lp = ctx.createBiquadFilter(); g.gain.value = 0; lp.type = 'lowpass'; lp.frequency.value = 420;
  for (const [hz, type, lvl] of [[110, 'sine', 1], [110.7, 'sine', 0.8], [164.8, 'triangle', 0.3]]) { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = hz; og.gain.value = lvl; o.connect(og); og.connect(g); o.start(); }
  g.connect(lp); lp.connect(ambBus);
  drone = { g };
  // the television: a voice you cannot quite make out (a buzz through two moving formants), a crowd, a few held notes
  const p = panner({ x: 5.4, y: 1.2, z: 8.2 }, 2.4, 1.3), out = ctx.createGain(); out.gain.value = 0; out.connect(p); p.connect(ambBus);
  const src = ctx.createOscillator(), f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), vg = ctx.createGain();
  src.type = 'sawtooth'; src.frequency.value = 120; f1.type = f2.type = 'bandpass'; f1.Q.value = 5; f2.Q.value = 8; f1.frequency.value = 600; f2.frequency.value = 1400; vg.gain.value = 0;
  src.connect(f1); src.connect(f2); f1.connect(vg); f2.connect(vg); vg.connect(out); src.start();
  const cn = noise(), cf = ctx.createBiquadFilter(), cg = ctx.createGain(); cf.type = 'bandpass'; cf.frequency.value = 520; cf.Q.value = 0.5; cg.gain.value = 0; cn.connect(cf); cf.connect(cg); cg.connect(out); cn.start();
  const notes = [0, 1, 2].map(() => { const o = ctx.createOscillator(), ng = ctx.createGain(); o.type = 'triangle'; ng.gain.value = 0; o.connect(ng); ng.connect(out); o.start(); return { o, g: ng }; });
  tv = { out, src, f1, f2, vg, cg, notes, on: false, prog: '', next: 0, hush: 0, who: 0 };
}
export function setTension(v) {
  if (!drone) return;
  drone.g.gain.setTargetAtTime(v < 0.05 ? 0 : 0.01 + v * 0.045, ctx.currentTime, 0.7);
}
const VOWELS = [[730, 1090], [280, 2250], [310, 870], [530, 1840], [570, 900], [440, 1020]];
const CHORDS = { series: [220, 261.6, 329.6] };
// on/off and what is on: 'news' (one steady voice), 'series' (two people and a sad chord), 'match' (a crowd and an excited voice)
// (the player asked for the television to be silent: the picture tells the story)
const TV_SOUND = false;
export function setTv(on, prog = 'news') {
  if (!tv) return;
  if (!TV_SOUND) on = false;
  const t = ctx.currentTime;
  tv.on = on; tv.out.gain.setTargetAtTime(on ? 0.4 : 0, t, 0.08);
  if (prog !== tv.prog) {
    tv.prog = prog;
    const ch = CHORDS[prog] || [0, 0, 0];
    tv.notes.forEach((n, i) => { if (ch[i]) n.o.frequency.setTargetAtTime(ch[i], t, 0.05); n.g.gain.setTargetAtTime(ch[i] ? 0.02 : 0, t, 0.6); });
    tv.cg.gain.setTargetAtTime(prog === 'match' ? 0.07 : 0, t, 0.3);
  }
}
// call every frame while it is on: says the next syllable, breathes between sentences. excite 0..1 (the match).
export function tvTick(dt, excite = 0) {
  if (!tv || !tv.on || !TV_SOUND) return;
  const t = ctx.currentTime;
  if (tv.prog === 'match') tv.cg.gain.setTargetAtTime(0.06 + excite * 0.2, t, 0.25);
  tv.next -= dt;
  if (tv.next > 0) return;
  if (tv.hush) { tv.hush = 0; tv.who = 1 - tv.who; }             // a pause is over: in the drama the other one answers
  if (Math.random() < (tv.prog === 'series' ? 0.13 : 0.08) && excite < 0.5) {       // the end of a sentence
    tv.vg.gain.setTargetAtTime(0, t, 0.04); tv.next = 0.35 + Math.random() * (tv.prog === 'series' ? 1.3 : 0.5); tv.hush = 1;
    return;
  }
  const v = VOWELS[Math.floor(Math.random() * VOWELS.length)];
  const base = tv.prog === 'series' ? (tv.who ? 205 : 112) : tv.prog === 'match' ? 150 + excite * 90 : 118;
  tv.src.frequency.setTargetAtTime(base * (0.9 + Math.random() * 0.25), t, 0.04);
  tv.f1.frequency.setTargetAtTime(v[0], t, 0.03); tv.f2.frequency.setTargetAtTime(v[1], t, 0.03);
  tv.vg.gain.setTargetAtTime(0, t, 0.012); tv.vg.gain.setTargetAtTime(0.5 + Math.random() * 0.4 + excite * 0.5, t + 0.035, 0.03);      // a consonant's dip, then the vowel
  tv.next = (0.12 + Math.random() * 0.13) / (tv.prog === 'match' ? 1.35 + excite * 0.5 : 1);
}
// a sting when the scene changes or the ball goes in
export function tvSting(kind) {
  if (!tv || !tv.on || !TV_SOUND) return;
  const t = ctx.currentTime, mk = (hz, at, d, peak, type = 'triangle') => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = hz; env(g, t + at, 0.02, peak, d); o.connect(g); g.connect(tv.out); o.start(t + at); o.stop(t + at + d + 0.1); };
  if (kind === 'news') [523, 659, 784, 1046].forEach((hz, i) => mk(hz, i * 0.11, 0.35, 0.12));
  else if (kind === 'drama') { mk(110, 0, 1.4, 0.3, 'sawtooth'); mk(116.5, 0.02, 1.4, 0.2, 'sawtooth'); }
  else if (kind === 'whistle') mk(2850, 0, 0.5, 0.1, 'sine');
  else if (kind === 'flip') mk(880, 0, 0.06, 0.08, 'square');
}
