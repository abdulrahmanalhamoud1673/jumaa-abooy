// Small particle system for the chores: running water, steam, soap, dust, crumbs.
// One THREE.Points for everything; particles are simulated on the CPU (a few hundred at most).
import * as THREE from 'three';

const KINDS = {
  //        r     g     b     a    size0  size1  life  gravity drag
  water: [0.78, 0.9, 1.0, 0.75, 0.035, 0.02, 0.55, -9.0, 0.0],
  splash: [0.85, 0.94, 1.0, 0.7, 0.03, 0.012, 0.45, -7.0, 0.5],
  tea: [0.72, 0.3, 0.07, 0.85, 0.03, 0.02, 0.5, -9.0, 0.0],
  coffee: [0.3, 0.17, 0.08, 0.9, 0.028, 0.02, 0.5, -9.0, 0.0],
  steam: [1.0, 1.0, 1.0, 0.2, 0.05, 0.26, 1.5, 0.45, 1.2],
  foam: [1.0, 1.0, 1.0, 0.85, 0.035, 0.06, 0.9, 0.12, 2.0],
  bubble: [0.9, 0.97, 1.0, 0.6, 0.02, 0.035, 0.7, 0.6, 1.0],
  dust: [0.72, 0.62, 0.48, 0.32, 0.09, 0.34, 1.0, 0.12, 1.5],
  spark: [1.0, 0.96, 0.62, 1.0, 0.06, 0.0, 0.55, 0.0, 2.0],
  bit: [0.97, 0.95, 0.9, 1.0, 0.022, 0.016, 0.45, -6.0, 0.4],
  crumb: [0.75, 0.55, 0.3, 1.0, 0.02, 0.012, 0.5, -6.0, 0.4],
  mist: [0.9, 0.95, 1.0, 0.35, 0.03, 0.14, 0.6, -0.4, 2.0],
  spit: [0.6, 0.76, 0.9, 0.95, 0.04, 0.024, 0.5, -6.5, 0.3],
};

export class Particles {
  constructor(scene, max = 900) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.age = new Float32Array(max); this.life = new Float32Array(max);
    this.kind = new Array(max);
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { scale: { value: 600 } },
      vertexShader: 'attribute float size; attribute vec4 color; varying vec4 vColor; uniform float scale;\nvoid main(){ vColor = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec4 vColor;\nvoid main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.18, d); if (a < 0.01) discard; gl_FragColor = vec4(vColor.rgb, vColor.a * a); }',
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false; this.points.renderOrder = 5;
    scene.add(this.points);
  }

  // One particle. pos/vel are plain {x,y,z} or Vector3; jitter spreads the velocity.
  emit(kind, p, v, jitter = 0, scale = 1) {
    let i = this.n;
    if (i >= this.max) i = Math.floor(Math.random() * this.max); else this.n++;
    const K = KINDS[kind];
    this.kind[i] = K;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = (v ? v.x : 0) + (Math.random() - 0.5) * jitter;
    this.vel[i * 3 + 1] = (v ? v.y : 0) + (Math.random() - 0.5) * jitter;
    this.vel[i * 3 + 2] = (v ? v.z : 0) + (Math.random() - 0.5) * jitter;
    this.age[i] = 0; this.life[i] = K[6] * (0.75 + Math.random() * 0.5);
    this.size[i] = K[4] * scale; this._s = scale;
    this.col[i * 4] = K[0]; this.col[i * 4 + 1] = K[1]; this.col[i * 4 + 2] = K[2]; this.col[i * 4 + 3] = K[3];
  }
  burst(kind, p, n, jitter = 1, up = 0.6, scale = 1) { for (let i = 0; i < n; i++) this.emit(kind, p, { x: 0, y: up, z: 0 }, jitter, scale); }
  // A pour: drops leave `from` and arrive at `to` about `time` seconds later.
  stream(kind, from, to, n = 2, time = 0.22) {
    const v = { x: (to.x - from.x) / time, y: (to.y - from.y) / time - 0.5 * KINDS[kind][7] * time, z: (to.z - from.z) / time };
    for (let i = 0; i < n; i++) this.emit(kind, from, v, 0.12);
  }

  update(dt, viewportH, fovDeg) {
    this.mat.uniforms.scale.value = viewportH / (2 * Math.tan(fovDeg * Math.PI / 360));
    let i = 0;
    while (i < this.n) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {         // dead: move the last one into its place
        const j = --this.n;
        if (i !== j) {
          for (let k = 0; k < 3; k++) { this.pos[i * 3 + k] = this.pos[j * 3 + k]; this.vel[i * 3 + k] = this.vel[j * 3 + k]; }
          for (let k = 0; k < 4; k++) this.col[i * 4 + k] = this.col[j * 4 + k];
          this.size[i] = this.size[j]; this.age[i] = this.age[j]; this.life[i] = this.life[j]; this.kind[i] = this.kind[j];
        }
        continue;
      }
      const K = this.kind[i], u = this.age[i] / this.life[i], drag = Math.max(0, 1 - K[8] * dt);
      this.vel[i * 3] *= drag; this.vel[i * 3 + 2] *= drag; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * drag + K[7] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.005 && K[7] < 0) { this.age[i] = this.life[i]; continue; }
      this.size[i] = K[4] + (K[5] - K[4]) * u;
      this.col[i * 4 + 3] = K[3] * (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85);
      i++;
    }
    this.geo.setDrawRange(0, this.n);
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true; this.geo.attributes.size.needsUpdate = true;
  }
}
