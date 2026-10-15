// Clothes that really change. An avatar keeps its own body texture; a mask made once per character says which
// texels are the top, which the bottoms, and which bare skin a longer sleeve or trouser leg would cover, and the
// body material re-dyes those texels in its shader (the folds and shading of the cloth stay). An outfit is then
// a handful of numbers and changing is instant, half at a time if need be: top off, top on, bottoms on.
import * as THREE from 'three';

const S = 512;
// What each of the kids owns. 'home' is what the model came wearing. sleeves/legs: long ones, over what was bare skin.
export const WARDROBE = {
  big: { pyjama: { top: 0x8ea4bd, bottom: 0x3b4a6b, stripes: 30 }, school: { top: 0xa9cdee, bottom: 0x1e2a48, legs: 1 }, smart: { top: 0x2c3e63, bottom: 0xc9b891, sleeves: 1, legs: 1 }, friday: { top: 0xf3f1ea, bottom: 0xe9e6dc, sleeves: 1, legs: 1 }, vest: { top: 0xf4f4f1 } },
  kid: { pyjama: { top: 0xe8c95a, bottom: 0x4e7fb8, stripes: 26 }, school: { top: 0xa9cdee, bottom: 0x1e2a48 }, smart: { top: 0xf1efe8, bottom: 0x2b3144 }, friday: { top: 0xf3f1ea, bottom: 0xe9e6dc }, vest: { top: 0xf4f4f1 } },
  sis: { pyjama: { top: 0xe9a7c1 }, school: { top: 0x2f5f9e }, smart: { top: 0x6b3f8f }, friday: { top: 0x6b3f8f }, vest: { top: 0xf1ead8 } },
};
const HAND = /Hand|Finger/, ARM = /Fore/, WAIST = /Pelvis|Spine$/, TOPB = /Spine|Neck|Clavicle|UpperArm|UpArm/, CALF = /Calf/, THIGH = /Thigh/, FOOT = /Foot|Toe/;
const GLSL = `
  {
    vec4 om = texture2D( outfitMap, vMapUv );
    float det = om.b * 2.0;
    float tm = smoothstep( -0.08, 0.08, om.r - mix( 0.75, 0.25, oMix.z ) ) * oMix.x;
    float bm = smoothstep( -0.08, 0.08, om.g - mix( 0.75, 0.25, oMix.w ) ) * oMix.y;
    bm *= 1.0 - step( 0.9, om.r ) * step( 0.9, om.g ) * ( 1.0 - oTuck );
    vec3 tc = oTop * det;
    if ( oPat > 0.5 ) tc *= 1.0 - 0.17 * step( 0.5, fract( vMapUv.y * oPat ) );
    diffuseColor.rgb = mix( diffuseColor.rgb, tc, tm );
    diffuseColor.rgb = mix( diffuseColor.rgb, oBot * det, bm );
    if ( oPrintOn > 0.5 ) { vec4 pr = texture2D( oPrint, vMapUv ); diffuseColor.rgb = mix( diffuseColor.rgb, pr.rgb * mix( 1.0, det, 0.6 ), pr.a * tm ); }
  }`;

// fill one triangle of the class map (a little generously, so the seams between islands are covered); bits remembers
// every kind of limb that ever covered a texel
function tri(buf, x0, y0, x1, y1, x2, y2, v, bits, bit) {
  const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2) - 1)), maxX = Math.min(S - 1, Math.ceil(Math.max(x0, x1, x2) + 1));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2) - 1)), maxY = Math.min(S - 1, Math.ceil(Math.max(y0, y1, y2) + 1));
  const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  if (Math.abs(d) < 1e-9) return;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const px = x + 0.5, py = y + 0.5, a = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / d, b = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / d;
    if (a >= -0.1 && b >= -0.1 && 1 - a - b >= -0.1) { buf[y * S + x] = v; bits[y * S + x] |= bit; }
  }
}

export class Outfit {
  constructor(char) {
    this.char = char; this.key = char.key; this.book = WARDROBE[char.key] || {};
    this.U = { outfitMap: { value: null }, oTop: { value: new THREE.Color() }, oBot: { value: new THREE.Color() }, oMix: { value: new THREE.Vector4(0, 0, 0, 0) }, oPat: { value: 0 }, oPrint: { value: null }, oPrintOn: { value: 0 }, oTuck: { value: 1 } };
    this.own = { top: 0x888888, bottom: 0x555555 };       // the colours they came in, for a garment held in the hand
    this.ok = this.build();
  }
  build() {
    let mat = null; const meshes = [];
    this.char.model.traverse((o) => { if (o.isSkinnedMesh && /_body$/.test(o.material.name)) { mat = o.material; meshes.push(o); } });
    if (!mat || !mat.map || !mat.map.image) return false;
    const onepiece = this.key === 'sis';
    // 1. which part of the body owns each texel (bits: 1 = under a top limb at some point, 2 = under a leg)
    const cls = new Uint8Array(S * S), bits = new Uint8Array(S * S);
    for (const m of meshes) {
      const g = m.geometry, ix = g.index, uv = g.attributes.uv, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = m.skeleton.bones, seen = new Uint8Array(uv.count);
      const of = (i) => {
        if (seen[i]) return seen[i];
        let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
        const n = bones[best].name;
        return (seen[i] = HAND.test(n) ? 1 : ARM.test(n) ? 3 : WAIST.test(n) ? 4 : TOPB.test(n) ? 2 : CALF.test(n) ? 6 : THIGH.test(n) ? 5 : FOOT.test(n) ? 7 : 8);
      };
      for (let t = 0; t < ix.count; t += 3) {
        const a = ix.getX(t), b = ix.getX(t + 1), d = ix.getX(t + 2), ca = of(a), cb = of(b), cd = of(d), k = ca === cb || ca === cd ? ca : cb === cd ? cb : ca;
        tri(cls, uv.getX(a) * S, uv.getY(a) * S, uv.getX(b) * S, uv.getY(b) * S, uv.getX(d) * S, uv.getY(d) * S, k, bits, k <= 3 ? 1 : k === 5 || k === 6 ? 2 : 0);
      }
    }
    // 2. cloth or skin, by colour
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(mat.map.image, 0, 0, S, S);
    const px = cx.getImageData(0, 0, S, S).data, N = S * S, kind = new Uint8Array(N), tuck = new Uint8Array(N), lum = new Float32Array(N);
    const skin = (r, g, b) => r > 95 && r - g > 22 && g >= b && r - g > 0.95 * (g - b) && r - b < 160;
    // A texel of cloth is the garment of the island of cloth it lies in: the limbs under an island vote (a shirt's hem may
    // hang over the thighs, its sides sit on the waist bones), so a whole piece is one garment.
    const cloth = new Uint8Array(N), vote = new Int8Array(N);
    for (let i = 0; i < N; i++) {
      const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], c = cls[i];
      lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      if (skin(r, g, b)) kind[i] = c === 2 || c === 3 ? 3 : c === 5 || c === 6 ? 4 : 0;            // bare skin a long sleeve or leg would cover
      else if (c && c !== 7) { cloth[i] = 1; vote[i] = c <= 3 ? 1 : c === 5 || c === 6 ? -1 : 0; }   // (not the shoes)
    }
    const island = new Int32Array(N).fill(-1), tally = [], stack = [];
    for (let i = 0; i < N; i++) if (cloth[i] && island[i] < 0) {
      const id = tally.length, t = [0, 0]; tally.push(t); island[i] = id; stack.push(i);
      while (stack.length) {
        const j = stack.pop(); if (vote[j] > 0) t[0]++; else if (vote[j] < 0) t[1]++;
        const x = j % S;
        for (const n of [x > 0 ? j - 1 : -1, x < S - 1 ? j + 1 : -1, j - S, j + S]) if (n >= 0 && n < N && cloth[n] && island[n] < 0 && vote[n] * vote[j] >= 0) { island[n] = id; stack.push(n); }   // (a sleeve touching a trouser leg stays apart)
      }
    }
    // islands with no say from any limb (bits of the waist) go with whichever garment they look like
    const col = tally.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < N; i++) if (cloth[i]) { const q = col[island[i]]; q[0] += px[i * 4]; q[1] += px[i * 4 + 1]; q[2] += px[i * 4 + 2]; q[3]++; }
    const side = tally.map((t) => (onepiece ? 1 : t[0] > t[1] ? 1 : t[1] > t[0] ? 2 : 0));
    const avg = [1, 2].map((k) => { const m = [0, 0, 0, 0]; side.forEach((sd, id) => { if (sd === k) for (let j = 0; j < 4; j++) m[j] += col[id][j]; }); return m[3] ? [m[0] / m[3], m[1] / m[3], m[2] / m[3]] : null; });
    side.forEach((sd, id) => {
      if (sd) return;
      const q = col[id], c = [q[0] / q[3], q[1] / q[3], q[2] / q[3]], d = avg.map((m) => (m ? (c[0] - m[0]) ** 2 + (c[1] - m[1]) ** 2 + (c[2] - m[2]) ** 2 : Infinity));
      side[id] = d[1] < d[0] ? 2 : 1;
    });
    const acc = [[0, 0, 0, 0], [0, 0, 0, 0]];
    for (let i = 0; i < N; i++) if (cloth[i]) {
      // a texel the trousers' waist also wears (the shirt's hem is painted over the hips) goes to the trousers: the shirt looks tucked in
      const k = side[island[i]] === 1 && !onepiece && bits[i] & 2 ? 2 : side[island[i]];
      kind[i] = k; if (k !== side[island[i]]) tuck[i] = 1; const a = acc[k - 1]; a[0] += px[i * 4]; a[1] += px[i * 4 + 1]; a[2] += px[i * 4 + 2]; a[3]++;
    }
    const mean = acc.map((a) => (a[3] ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]] : [128, 128, 128]));
    this.own = { top: (Math.round(mean[0][0]) << 16) | (Math.round(mean[0][1]) << 8) | Math.round(mean[0][2]), bottom: (Math.round(mean[1][0]) << 16) | (Math.round(mean[1][1]) << 8) | Math.round(mean[1][2]) };
    // 3. the cloth's own light and shade, with its print and stripes blurred away (two passes of a running mean)
    //    (only texels that are clothing or coverable skin take part, so the black between the islands never bleeds in)
    const tmp = new Float32Array(N), wgt = new Float32Array(N), R = 4;
    const blur = (arr) => {
      for (const [src, dst, step] of [[arr, tmp, 1], [tmp, arr, S]]) for (let l = 0; l < S; l++) {
        const base = step === 1 ? l * S : l; let sum = 0;
        for (let k = -R; k <= R; k++) sum += src[base + Math.max(0, Math.min(S - 1, k)) * step];
        for (let k = 0; k < S; k++) { dst[base + k * step] = sum / (R * 2 + 1); sum += src[base + Math.min(S - 1, k + R + 1) * step] - src[base + Math.max(0, k - R) * step]; }
      }
    };
    for (let i = 0; i < N; i++) { wgt[i] = kind[i] ? 1 : 0; lum[i] *= wgt[i]; }
    blur(lum); blur(wgt);
    for (let i = 0; i < N; i++) lum[i] = wgt[i] > 0.02 ? lum[i] / wgt[i] : 0;
    const lm = [0, 0, 0], ln = [0, 0, 0];
    for (let i = 0; i < N; i++) { const k = kind[i]; if (k) { const j = k === 1 ? 0 : k === 2 ? 1 : 2; lm[j] += lum[i]; ln[j]++; } }
    for (let j = 0; j < 3; j++) lm[j] = ln[j] ? lm[j] / ln[j] : 128;
    const data = new Uint8Array(N * 4);
    for (let i = 0; i < N; i++) {
      const k = kind[i], o = i * 4;
      // (a tucked-in hem is marked as both: top and trousers)
      data[o] = k === 1 || tuck[i] ? 255 : k === 3 ? 128 : 0; data[o + 1] = k === 2 ? 255 : k === 4 ? 128 : 0; data[o + 3] = 255;
      data[o + 2] = k ? Math.round(Math.max(0.36, Math.min(1.7, lum[i] / lm[k === 1 ? 0 : k === 2 ? 1 : 2])) * 127.5) : 128;
    }
    this.meshes = meshes; this.mat = mat;
    const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
    tex.flipY = false; tex.wrapS = mat.map.wrapS; tex.wrapT = mat.map.wrapT; tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;
    this.U.outfitMap.value = tex;
    // 4. the body material dyes by that mask
    const U = this.U;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\nuniform sampler2D outfitMap; uniform vec3 oTop; uniform vec3 oBot; uniform vec4 oMix; uniform float oPat; uniform sampler2D oPrint; uniform float oPrintOn; uniform float oTuck;')
        .replace('#include <map_fragment>', '#include <map_fragment>\n' + GLSL);
    };
    mat.customProgramCacheKey = () => 'outfit';
    mat.needsUpdate = true;
    return true;
  }
  has(part, name) { const o = this.book[name]; return !!o && o[part] != null; }
  // Print artwork on the top, the way a real t-shirt is printed: art.front / art.back draw in millimetres around the middle of
  // the chest (x to the viewer's right, y down). Where the chest and the back lie on the texture is found from the body itself:
  // the triangles that face forward (or back) on the torso, and the straight map from their place on the body to their place
  // on the texture.
  print(art) {
    const c = this.char, keep = { p: c.pos.clone(), h: c.heading };
    if (!this.U.oPrint.value) { this.U.oPrint.value = new THREE.Texture(); this.U.oPrint.value.image = null; }
    c.place(0, 0, 0); c.heading = 0; c.root.rotation.y = 0; c.lying = 0; c.play('m_idle_neutral_01', { fade: 0 }); c.update(0); c.root.updateMatrixWorld(true);
    const spine = c.bones.Spine2 || c.bones.Spine1, o = spine.getWorldPosition(new THREE.Vector3()), Wd = 1024;
    const cv = document.createElement('canvas'); cv.width = cv.height = Wd; const g = cv.getContext('2d');
    const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    const stats = {};
    for (const side of ['front', 'back']) {
      if (!art[side]) continue;
      // the torso's triangles that face this way, grouped by the piece of the texture they lie on (a shirt's front is
      // often two pieces, mirrored): each piece gets its own straight map from the body to the texture
      const tris = [], sgn = side === 'front' ? 1 : -1, up = new Map();
      const find = (k) => { let r = k; while (up.has(r) && up.get(r) !== r) r = up.get(r); up.set(k, r); return r; };
      const join = (x, y) => { const a = find(x), b = find(y); if (a !== b) up.set(a, b); };
      for (const m of this.meshes) {
        const ix = m.geometry.index, uv = m.geometry.attributes.uv, si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight, bones = m.skeleton.bones;
        const torso = (i) => { let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } } return (side === 'back' ? /Spine|Neck|Pelvis|Clavicle/ : /Spine|Neck|Pelvis/).test(bones[best].name); };
        for (let t = 0; t < ix.count; t += 3) {
          const a = ix.getX(t), b = ix.getX(t + 1), d = ix.getX(t + 2);
          if (!torso(a) || !torso(b) || !torso(d)) continue;
          m.getVertexPosition(a, A).applyMatrix4(m.matrixWorld); m.getVertexPosition(b, B).applyMatrix4(m.matrixWorld); m.getVertexPosition(d, C).applyMatrix4(m.matrixWorld);
          const n = e1.subVectors(B, A).cross(e2.subVectors(C, A)).normalize();
          if (n.z * sgn < 0.3 || Math.abs(n.x) > 0.8) continue;
          const at = (i) => Math.round(uv.getX(i) * 4096) + ',' + Math.round(uv.getY(i) * 4096), key = at(a); join(key, at(b)); join(key, at(d));    // (corners shared on the texture)
          tris.push({ key, rows: [[A.x - o.x, A.y - o.y, uv.getX(a), uv.getY(a)], [B.x - o.x, B.y - o.y, uv.getX(b), uv.getY(b)], [C.x - o.x, C.y - o.y, uv.getX(d), uv.getY(d)]] });
        }
      }
      const pieces = new Map();
      for (const t of tris) { const r = find(t.key); if (!pieces.has(r)) pieces.set(r, []); pieces.get(r).push(t); }
      let hue = 0; stats[side] = { tris: tris.length, pieces: pieces.size, used: 0 };
      for (const list of pieces.values()) {
        if (list.length < 4) continue;
        // least squares: u = a0 x + a1 y + a2, v = b0 x + b1 y + b2
        const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], ru = [0, 0, 0], rv = [0, 0, 0];
        for (const t of list) for (const [x, y, u, v] of t.rows) { const q = [x, y, 1]; for (let i = 0; i < 3; i++) { ru[i] += q[i] * u; rv[i] += q[i] * v; for (let j = 0; j < 3; j++) M[i][j] += q[i] * q[j]; } }
        const solve = (r) => {
          const m = M.map((row, i) => [...row, r[i]]);
          for (let i = 0; i < 3; i++) { let p = i; for (let k = i + 1; k < 3; k++) if (Math.abs(m[k][i]) > Math.abs(m[p][i])) p = k; [m[i], m[p]] = [m[p], m[i]]; for (let k = 0; k < 3; k++) if (k !== i) { const f = m[k][i] / m[i][i]; for (let j = i; j < 4; j++) m[k][j] -= f * m[i][j]; } }
          return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
        };
        const [a0, a1, a2] = solve(ru), [b0, b1, b2] = solve(rv);
        if (!isFinite(a0 + a1 + a2 + b0 + b1 + b2) || Math.abs(a0 * b1 - a1 * b0) < 1e-6) continue;
        stats[side].used++;
        g.save();
        g.beginPath(); for (const t of list) { const [p0, p1, p2] = t.rows; g.moveTo(p0[2] * Wd, p0[3] * Wd); g.lineTo(p1[2] * Wd, p1[3] * Wd); g.lineTo(p2[2] * Wd, p2[3] * Wd); g.closePath(); }
        g.clip();
        if (art.debug) { g.fillStyle = `hsla(${(hue += 67) % 360},90%,50%,.55)`; g.fillRect(0, 0, Wd, Wd); }
        g.setTransform(a0 * Wd, b0 * Wd, a1 * Wd, b1 * Wd, a2 * Wd, b2 * Wd);
        g.scale(sgn * 0.001, -0.001);                    // millimetres, y down, read from where you stand to look at it
        art[side](g);
        g.restore();
      }
    }
    const tex = new THREE.CanvasTexture(cv); tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    this.U.oPrint.value = tex; this.U.oPrintOn.value = 1;
    c.place(keep.p.x, keep.p.z, keep.h);
    return stats;
  }
  unprint() { this.U.oPrintOn.value = 0; }
  // the colour of a garment as it would look in the hand
  color(part, name) { const o = this.book[name]; return o && o[part] != null ? o[part] : this.own[part]; }
  // wear(top, bottom): each the name of an outfit, or 'home' for what they came in. The two halves can differ mid-change.
  wear(top = 'home', bottom = top) {
    this.top = top; this.bottom = bottom;
    const t = this.book[top], b = this.book[bottom], m = this.U.oMix.value;
    const tOn = !!t && t.top != null, bOn = !!b && b.bottom != null;
    if (tOn) this.U.oTop.value.setHex(t.top);
    if (bOn) this.U.oBot.value.setHex(b.bottom);
    m.set(tOn ? 1 : 0, bOn ? 1 : 0, tOn && t.sleeves ? 1 : 0, bOn && b.legs ? 1 : 0);
    this.U.oPat.value = tOn && t.stripes ? t.stripes : 0;
    this.U.oTuck.value = tOn && t.untucked ? 0 : 1;           // a jacket hangs over the trousers
  }
}
