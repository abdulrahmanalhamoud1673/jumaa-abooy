// The television. It is on most of the day, so it had better be alive: the news with a newsreader, a ticker and
// the weather; a village drama with two people who mean every word; a derby with a crowd. Drawn on a canvas about
// ten times a second (only while somebody could see it) and voiced by the synth in audio.js.
import { setTv, tvTick, tvSting } from './audio.js';

const W = 512, H = 288, FONT = 'Cairo, "Segoe UI", Tahoma, sans-serif';
const HEADLINES = ['ارتفاع أسعار البندورة للمرة الثالثة هذا الأسبوع', 'الأرصاد: الجو حار نهاراً… والمكيّف ممنوع', 'خبير: هذا الجيل لا يطفئ الأضواء',
  'دراسة: الأب الأردني يمشي ٧ كيلو باليوم وهو يطفّي أضوية', 'فاتورة الكهرباء تسجّل رقماً قياسياً جديداً', 'وزارة التربية: الواجب البيتي واجب',
  'نقص حاد في الشباشب بالأسواق المحلية', 'الحكومة تدرس ضريبة على فتح الثلاجة بدون سبب'];
const CITIES = [['إربد', 0.44, 0.13, 24], ['عمّان', 0.43, 0.34, 27], ['الزرقا', 0.55, 0.3, 29], ['الكرك', 0.4, 0.52, 26], ['معان', 0.47, 0.72, 31], ['العقبة', 0.3, 0.92, 37]];
// who speaks, what the subtitle says
const SCRIPT = [['a', 'الأرض ما بنبيعها… ولو على قطع راسي!'], ['b', 'يا أبو صالح، الدَّين كسر ظهرنا.'], ['a', 'قلت كلمتي! وأبو صالح ما بيرجع بكلمته.'],
  ['b', 'وابنك؟ مين بيجوّزه إذا راحت الأرض؟'], ['a', 'مين اللي فتّن عليّ عند المختار؟!'], ['b', 'والله ما حدا… والله العظيم.'], ['a', 'اطلعي من وجهي… بدي أفكّر.'], ['b', 'الله يهديك يا ابن عمّي.']];
const CAST = {
  a: { skin: '#c99a72', cloth: '#3b3f48', hat: 'kef', hair: '#6d6a66', stache: 1, name: 'أبو صالح' },
  b: { skin: '#dcb08c', cloth: '#5b2c3c', hat: 'scarf', hair: '#2a1b14', scarf: '#2f3550', name: 'أم صالح' },
  anchor: { skin: '#d6a57f', cloth: '#1f2a44', hat: 'hair', hair: '#1c1512', tie: '#b1272d' },
};
const TEAMS = [{ name: 'الفيصلي', c: '#2b6fd6', d: '#ffffff' }, { name: 'الوحدات', c: '#1f9a48', d: '#c8262d' }];
const shade = (hex, d) => { const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, v + d)); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
const rnd = (a, b) => a + Math.random() * (b - a);

// A head and shoulders. o.mouth 0..1, o.blink, o.anger 0..1, o.look -1..1
function bust(g, x, y, s, o) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = o.cloth; g.beginPath(); g.moveTo(-104, 170); g.quadraticCurveTo(-98, 76, -34, 62); g.lineTo(34, 62); g.quadraticCurveTo(98, 76, 104, 170); g.closePath(); g.fill();
  if (o.tie) { g.fillStyle = '#f1f1ee'; g.beginPath(); g.moveTo(-24, 62); g.lineTo(0, 96); g.lineTo(24, 62); g.closePath(); g.fill(); g.fillStyle = o.tie; g.beginPath(); g.moveTo(-6, 72); g.lineTo(6, 72); g.lineTo(9, 150); g.lineTo(0, 162); g.lineTo(-9, 150); g.closePath(); g.fill(); }
  if (o.hat === 'kef') { g.fillStyle = '#efece4'; g.beginPath(); g.moveTo(-46, -30); g.quadraticCurveTo(-70, 40, -66, 112); g.lineTo(-30, 96); g.lineTo(-34, 20); g.closePath(); g.fill(); g.beginPath(); g.moveTo(46, -30); g.quadraticCurveTo(70, 40, 66, 112); g.lineTo(30, 96); g.lineTo(34, 20); g.closePath(); g.fill(); }
  if (o.hat === 'scarf') { g.fillStyle = o.scarf; g.beginPath(); g.ellipse(0, 2, 52, 64, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(-50, 20); g.quadraticCurveTo(-58, 80, -30, 100); g.lineTo(30, 100); g.quadraticCurveTo(58, 80, 50, 20); g.closePath(); g.fill(); }
  g.fillStyle = shade(o.skin, -26); g.fillRect(-15, 36, 30, 34);
  g.fillStyle = o.skin; g.beginPath(); g.ellipse(0, 0, 39, 51, 0, 0, 7); g.fill();
  if (o.hat === 'hair') { g.fillStyle = o.hair; g.beginPath(); g.ellipse(0, -30, 41, 28, 0, Math.PI, 0); g.fill(); g.fillRect(-41, -32, 8, 22); g.fillRect(33, -32, 8, 22); }
  if (o.hat === 'kef') { g.fillStyle = '#efece4'; g.beginPath(); g.ellipse(0, -30, 46, 30, 0, Math.PI, 0); g.fill(); g.fillStyle = '#17171a'; g.fillRect(-44, -36, 88, 7); g.fillRect(-42, -27, 84, 5); }
  if (o.hat === 'scarf') { g.fillStyle = o.scarf; g.beginPath(); g.ellipse(0, -30, 44, 26, 0, Math.PI, 0); g.fill(); g.beginPath(); g.moveTo(-40, -30); g.quadraticCurveTo(-46, 10, -30, 44); g.lineTo(-36, 0); g.closePath(); g.fill(); g.beginPath(); g.moveTo(40, -30); g.quadraticCurveTo(46, 10, 30, 44); g.lineTo(36, 0); g.closePath(); g.fill(); }
  const an = o.anger || 0;
  for (const sx of [-1, 1]) {
    g.fillStyle = '#f6f3ee'; g.beginPath(); g.ellipse(sx * 15, -7, 8, o.blink ? 0.9 : 5 - an * 1.2, 0, 0, 7); g.fill();
    if (!o.blink) { g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(sx * 15 + (o.look || 0) * 3, -7, 3.5, 0, 7); g.fill(); }
    g.strokeStyle = o.hair; g.lineWidth = 4.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(sx * 6, -19 + an * 5); g.lineTo(sx * 26, -21 - an * 3); g.stroke();
  }
  g.strokeStyle = shade(o.skin, -42); g.lineWidth = 2.4; g.beginPath(); g.moveTo(-2, -3); g.quadraticCurveTo(-8, 13, 4, 14); g.stroke();
  const m = o.mouth || 0;
  g.fillStyle = '#4e1a18'; g.beginPath(); g.ellipse(0, 28, 11 - m * 2, 1.6 + m * 8, 0, 0, 7); g.fill();
  if (o.stache) { g.fillStyle = o.hair; g.beginPath(); g.moveTo(-19, 23); g.quadraticCurveTo(0, 10, 19, 23); g.quadraticCurveTo(0, 21, -19, 23); g.closePath(); g.fill(); g.lineWidth = 5; g.strokeStyle = o.hair; g.beginPath(); g.moveTo(-17, 22); g.quadraticCurveTo(0, 15, 17, 22); g.stroke(); }
  g.restore();
}
// white text with a dark edge, right-to-left
function caption(g, text, x, y, px, align = 'center', color = '#fff') {
  g.font = `bold ${px}px ${FONT}`; g.textAlign = align; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.lineWidth = px / 5; g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineJoin = 'round'; g.strokeText(text, x, y); g.fillStyle = color; g.fillText(text, x, y);
}

export class Tv {
  constructor(game) {
    this.game = game; this.dev = game.world.devices.tv; this.g = this.dev.canvas.getContext('2d');
    this.prog = 'news'; this.t = 0; this.pt = 0; this.acc = 0; this.flip = 0; this.sent = ''; this.wasOn = false; this.excite = 0;
    this.blinkAt = 2; this.talk = 0;
    this.pitch = null;
  }
  // what dad puts on: the derby on Thursday night and Friday, the news the rest of the week
  dadProg() { const id = this.game.day ? this.game.day.id : ''; return id === 'fri' || id === 'thu' ? 'match' : 'news'; }
  watch(prog) { if (prog !== this.prog) { this.prog = prog; this.pt = 0; this.flip = 0.4; this.line = -1; tvSting('flip'); } }

  update(dt) {
    const dev = this.dev, key = (dev.on ? '1' : '0') + this.prog;
    if (key !== this.sent) { this.sent = key; setTv(dev.on, this.prog); if (dev.on && !this.wasOn) this.flip = 0.3; this.wasOn = dev.on; }
    if (!dev.on) return;
    this.t += dt; this.pt += dt; this.flip -= dt;
    if (this.prog === 'match') this.play(dt); else this.excite = 0;
    tvTick(dt, this.excite);
    // nobody near enough to see the picture: keep the sound, skip the drawing
    const p = this.game.player, far = Math.hypot(p.x - 6, p.z - 8.2) > 11;
    this.acc -= dt;
    if (this.acc > 0 || far) return;
    this.acc = this.game.world.low ? 0.15 : 0.09;
    const g = this.g;
    g.save(); g.direction = 'rtl';
    if (this.flip > 0) this.snow(g); else this[this.prog](g);
    g.restore();
    dev.tex.needsUpdate = true;
    dev.glow.color.setHex(this.prog === 'series' ? 0xffc890 : this.prog === 'match' ? 0xb9f5c4 : 0x9db8ff);
    dev.glow.intensity = 4.2 + Math.sin(this.t * 7) * 0.5 + (this.flip > 0 ? 2 : 0);
  }

  snow(g) {
    for (let i = 0; i < 90; i++) { const v = Math.floor(rnd(30, 220)); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(rnd(0, W), rnd(0, H), rnd(20, 120), rnd(2, 9)); }
  }
  // a blink now and then
  blinking() { const left = this.blinkAt - this.t; if (left <= 0) this.blinkAt = this.t + rnd(2.2, 5); return left < 0.13; }

  // ---------- the news ----------
  news(g) {
    const t = this.pt, cyc = t % 26;
    if (t < 0.3 && !this.jingle) { this.jingle = true; tvSting('news'); } else if (t > 1) this.jingle = false;
    if (cyc > 17) { this.weather(g, cyc - 17); return; }
    const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, '#0c2552'); grad.addColorStop(1, '#16438a'); g.fillStyle = grad; g.fillRect(0, 0, W, H);
    // the world behind, turning slowly
    g.fillStyle = 'rgba(120,170,255,.16)';
    for (let i = 0; i < 70; i++) { const a = i * 2.399, r = 20 + (i * 37 % 90); g.beginPath(); g.arc(((150 + Math.cos(a) * r * 1.7 + t * 6) % 560) - 20, 96 + Math.sin(a) * r * 0.75, 4 + (i % 3) * 2, 0, 7); g.fill(); }
    // the picture beside the newsreader: a chart that keeps climbing
    g.fillStyle = 'rgba(8,16,40,.75)'; g.fillRect(292, 34, 196, 132); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.strokeRect(292, 34, 196, 132);
    g.strokeStyle = '#ff5a52'; g.lineWidth = 3; g.beginPath();
    for (let i = 0; i <= 12; i++) { const y = 150 - i * 7 - Math.sin(i * 1.7 + Math.floor(t / 2)) * 9 - (i === 12 ? Math.sin(t * 5) * 4 : 0); if (i) g.lineTo(304 + i * 14.5, y); else g.moveTo(304, y); }
    g.stroke(); caption(g, 'الأسعار', 478, 50, 15, 'right', '#ffd9d4');
    bust(g, 150, 124, 0.92 + Math.sin(t * 0.7) * 0.004, { ...CAST.anchor, mouth: this.mouthNow(true), blink: this.blinking(), look: Math.sin(t * 0.5) * 0.4 });
    // desk, lower third, ticker
    g.fillStyle = '#0a1a3c'; g.fillRect(0, 238, W, 50); g.fillStyle = '#b1121a'; g.fillRect(0, 226, W, 40);
    g.fillStyle = '#fff'; g.fillRect(412, 226, 100, 40); g.fillStyle = Math.floor(t * 2) % 2 ? '#b1121a' : '#7d0c12'; g.font = `bold 26px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('عاجل', 462, 247);
    g.save(); g.beginPath(); g.rect(0, 226, 408, 40); g.clip();
    const i = Math.floor(t / 9) % HEADLINES.length, slide = (t % 9) / 9;
    g.fillStyle = '#fff'; g.font = `bold 22px ${FONT}`; g.textAlign = 'right'; g.fillText(HEADLINES[i], 400 - (1 - Math.min(1, slide * 6)) * 380 + Math.max(0, slide - 0.88) * 3400, 247);
    g.restore();
    g.fillStyle = 'rgba(255,255,255,.9)'; g.font = `bold 15px ${FONT}`; g.textAlign = 'right'; g.fillText('أخبار المساء', 500, 20);
    const sg = this.game.seg, now = sg && sg.clock ? sg.clock[0] + (sg.clock[1] - sg.clock[0]) * Math.min(1, this.game.segT / sg.time) : 20 * 60; g.textAlign = 'left'; g.direction = 'ltr'; g.fillText(`${String(Math.floor(now / 60) % 24).padStart(2, '0')}:${String(Math.floor(now % 60)).padStart(2, '0')}`, 12, 20);
  }
  weather(g, t) {
    const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, '#5fb0e6'); grad.addColorStop(1, '#bfe3f6'); g.fillStyle = grad; g.fillRect(0, 0, W, H);
    // the kingdom, roughly
    g.fillStyle = '#e9d9a6'; g.strokeStyle = '#a58a4c'; g.lineWidth = 2; g.beginPath();
    for (const [i, [x, y]] of [[0.36, 0.02], [0.52, 0.06], [0.95, 0.22], [0.86, 0.36], [0.6, 0.44], [0.78, 0.62], [0.52, 0.86], [0.3, 0.98], [0.26, 0.9], [0.34, 0.5], [0.33, 0.2]].entries()) { const px = 130 + x * 250, py = 14 + y * 250; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
    g.closePath(); g.fill(); g.stroke();
    CITIES.forEach(([name, x, y, deg], i) => {
      const px = 130 + x * 250, py = 14 + y * 250, show = t > 0.4 + i * 0.5;
      if (!show) return;
      g.fillStyle = '#ffb52b'; g.beginPath(); g.arc(px, py, 8 + Math.sin(this.t * 3 + i) * 1.2, 0, 7); g.fill();
      g.strokeStyle = '#ffb52b'; g.lineWidth = 2; for (let k = 0; k < 8; k++) { const a = k * 0.785 + this.t * 0.6; g.beginPath(); g.moveTo(px + Math.cos(a) * 11, py + Math.sin(a) * 11); g.lineTo(px + Math.cos(a) * 15, py + Math.sin(a) * 15); g.stroke(); }
      caption(g, `${name} ${deg}°`, px + 22, py, 15, 'left');
    });
    g.fillStyle = 'rgba(10,30,70,.85)'; g.fillRect(0, 0, 118, H); caption(g, 'حالة', 60, 40, 24); caption(g, 'الطقس', 60, 72, 24);
    bust(g, 60, 205, 0.5, { ...CAST.anchor, cloth: '#7a2740', tie: null, mouth: this.mouthNow(true), blink: this.blinking() });
    caption(g, 'غداً: حار… وكل واحد يطفّي مكيّفه', 320, 268, 17);
  }
  mouthNow(on) { this.talk += ((on ? 0.2 + 0.8 * Math.abs(Math.sin(this.t * 11) * Math.sin(this.t * 4.3 + 1)) : 0) - this.talk) * 0.7; return this.talk; }

  // ---------- the drama ----------
  series(g) {
    // each line gets a close-up as long as it takes to say; every fourth shot is the two of them in the courtyard
    const t = this.pt;
    if (this.line == null || this.line < 0 || t > this.cutAt) {
      this.line = ((this.line ?? -1) + 1) % (SCRIPT.length + 2); this.cutT = t;
      const text = SCRIPT[this.line] ? SCRIPT[this.line][1] : '';
      this.cutAt = t + (SCRIPT[this.line] ? 1.5 + text.length * 0.075 : 3.4);
      if (this.line === SCRIPT.length) tvSting('drama');
    }
    const k = t - this.cutT, L = SCRIPT[this.line];
    const yard = (zoom, ox) => {
      g.save(); g.translate(W / 2, H / 2); g.scale(zoom, zoom); g.translate(-W / 2 + ox, -H / 2);
      const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#e9b97a'); sky.addColorStop(1, '#c98a55'); g.fillStyle = sky; g.fillRect(-60, -40, W + 120, H + 80);
      g.fillStyle = '#b08a5e'; g.fillRect(-60, 60, W + 120, 190);                               // the old stone wall
      g.fillStyle = 'rgba(70,45,25,.25)'; for (let y = 70; y < 240; y += 26) for (let x = -50 + (y % 52 ? 0 : 30); x < W + 60; x += 60) g.fillRect(x, y, 56, 2);
      for (const ax of [96, 400]) { g.fillStyle = '#3a2a22'; g.beginPath(); g.moveTo(ax - 46, 250); g.lineTo(ax - 46, 150); g.quadraticCurveTo(ax, 84, ax + 46, 150); g.lineTo(ax + 46, 250); g.closePath(); g.fill(); g.fillStyle = '#6d4a2c'; g.fillRect(ax - 38, 158, 76, 92); g.fillStyle = '#4a3220'; g.fillRect(ax - 2, 158, 4, 92); }
      g.fillStyle = '#ffd36b'; g.beginPath(); g.arc(250, 96, 9 + Math.sin(this.t * 9) * 0.8, 0, 7); g.fill(); g.strokeStyle = '#2a2018'; g.lineWidth = 2; g.beginPath(); g.moveTo(250, 60); g.lineTo(250, 86); g.stroke();
      g.fillStyle = '#8a6a48'; g.fillRect(-60, 244, W + 120, 90);                                // the paved yard
      g.fillStyle = '#3f6a35'; for (const [px, s] of [[30, 1], [470, 1.2]]) { g.beginPath(); g.ellipse(px, 236, 26 * s, 34 * s, 0, 0, 7); g.fill(); g.fillStyle = '#7a4a2c'; g.fillRect(px - 14, 250, 28, 22); g.fillStyle = '#3f6a35'; }
      g.restore();
    };
    if (!L) {                      // the end of the episode
      const who = this.line === SCRIPT.length ? 'a' : null;
      if (who) { yard(1.5 + k * 0.12, -40); bust(g, 256, 150, 1.5 + k * 0.14, { ...CAST.a, anger: 1, blink: false, mouth: 0, look: 0 }); g.fillStyle = `rgba(0,0,0,${Math.min(0.75, k * 0.28)})`; g.fillRect(0, 0, W, H); if (k > 1.6) caption(g, 'يُتبَع…', 256, 150, 44); }
      else { g.fillStyle = '#120c08'; g.fillRect(0, 0, W, H); caption(g, 'حارة أبو صالح', 256, 118, 46, 'center', '#f0cf8a'); caption(g, 'الحلقة السابعة والأربعون', 256, 176, 22); }
    } else if (this.line % 4 === 3 && k < 1.3) {
      yard(1.02 + k * 0.01, 0); bust(g, 176, 196, 0.5, { ...CAST.a, anger: 0.7, look: 1 }); bust(g, 336, 200, 0.47, { ...CAST.b, look: -1 });
    } else {
      const who = L[0], c = CAST[who];
      yard(1.7 + k * 0.03, who === 'a' ? 70 : -70);
      bust(g, who === 'a' ? 236 : 276, 150, 1.28 + k * 0.012, { ...c, mouth: this.mouthNow(k > 0.25 && k < this.cutAt - this.cutT - 0.3), blink: this.blinking(), anger: who === 'a' ? 0.85 : 0.1, look: who === 'a' ? 0.7 : -0.7 });
      caption(g, L[1], 256, 258, 21);
    }
    // film grain of an old series, and the channel's mark
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, W, 10); g.fillRect(0, H - 10, W, 10);
    g.fillStyle = 'rgba(255,255,255,.75)'; g.font = `bold 13px ${FONT}`; g.textAlign = 'left'; g.direction = 'ltr'; g.fillText('دراما ٢', 14, 26);
  }

  // ---------- the derby ----------
  play(dt) {
    const M = this.pitch || (this.pitch = this.kickoff({ score: [1, 1], clock: 63 * 60 + 12, goalT: 0, shotT: 0 }));
    M.clock += dt; M.goalT -= dt;
    const goalX = M.team ? 30 : 970;
    if (M.goalT > 0) { this.excite = 1; return; }
    if (M.goalT > -1.2 && M.celebrated) { this.kickoff(M); M.celebrated = false; }
    // the ball runs to whoever it was meant for
    const dx = M.tx - M.bx, dy = M.ty - M.by, d = Math.hypot(dx, dy), sp = (M.shot ? 520 : 300) * dt;
    if (d > sp) { M.bx += dx / d * sp; M.by += dy / d * sp; } else {
      M.bx = M.tx; M.by = M.ty; M.hold -= dt;
      if (M.shot) {
        M.shot = false;
        if (Math.random() < 0.38) { M.score[M.team]++; M.goalT = 4.2; M.celebrated = true; tvSting('whistle'); } else { M.team = 1 - M.team; this.pass(M, true); }
      } else if (M.hold <= 0) {
        if (Math.random() < 0.22) M.team = 1 - M.team;                 // cut out
        if (Math.abs(M.bx - (M.team ? 30 : 970)) < 230 && Math.random() < 0.6) { M.shot = true; M.tx = M.team ? 30 : 970; M.ty = 150 + rnd(-30, 30); } else this.pass(M);
      }
    }
    for (const q of M.players) {
      const push = (M.bx - 500) * 0.38, hx = q.hx + push * (q.gk ? 0.05 : 1), hy = q.hy + (M.by - q.hy) * (q.gk ? 0.2 : 0.14);
      q.x += (hx - q.x) * Math.min(1, dt * 1.6) + Math.sin(this.t * 2 + q.i) * dt * 6; q.y += (hy - q.y) * Math.min(1, dt * 1.6);
    }
    this.excite = Math.max(0, Math.min(1, 1 - Math.abs(M.bx - goalX) / 420)) * (M.shot ? 1 : 0.75);
  }
  kickoff(M) {
    M.bx = M.tx = 500; M.by = M.ty = 150; M.team = Math.random() < 0.5 ? 0 : 1; M.hold = 0.6; M.shot = false;
    M.players = [];
    for (const team of [0, 1]) [[55, 150, 1], [230, 50], [215, 115], [215, 185], [230, 250], [430, 70], [410, 150], [430, 230], [620, 60], [650, 150], [620, 240]].forEach(([x, y, gk], i) => {
      const hx = team ? 1000 - x : x; M.players.push({ team, hx, hy: y, x: hx, y, gk: !!gk, i: i + team * 11 });
    });
    return M;
  }
  pass(M, clear) {
    const mates = M.players.filter((q) => q.team === M.team && !q.gk), dir = M.team ? -1 : 1;
    const ahead = mates.filter((q) => (q.x - M.bx) * dir > (clear ? 120 : -40) && Math.abs(q.x - M.bx) < 330);
    const to = (ahead.length ? ahead : mates)[Math.floor(Math.random() * (ahead.length || mates.length))];
    M.tx = to.x + dir * 22; M.ty = to.y + rnd(-10, 10); M.hold = rnd(0.5, 1.3);
  }
  match(g) {
    const M = this.pitch; if (!M) return;
    const cam = Math.max(0, Math.min(1000 - W, M.bx - W / 2)), X = (x) => x - cam, Y = (y) => 46 + y * 0.78;
    // the stand, the pitch in mown stripes, the lines
    g.fillStyle = '#2b2f3a'; g.fillRect(0, 0, W, 50);
    for (let i = 0; i < 150; i++) { const x = (i * 53 - cam * 0.6) % (W + 40), hop = this.excite > 0.8 ? Math.abs(Math.sin(this.t * 9 + i)) * 4 : 0; g.fillStyle = ['#2b6fd6', '#1f9a48', '#e8e8e8', '#c8262d', '#e2b23a'][i % 5]; g.fillRect((x + W + 40) % (W + 40) - 20, 6 + (i * 17 % 34) - hop, 5, 6); }
    for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#2f8f3d' : '#35a046'; g.fillRect(X(i * 84), 46, 84, H - 46); }
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2.5;
    g.strokeRect(X(20), Y(6), 960, 288 * 0.78 - 4); g.beginPath(); g.moveTo(X(500), Y(6)); g.lineTo(X(500), Y(300)); g.stroke(); g.beginPath(); g.ellipse(X(500), Y(150), 62, 48, 0, 0, 7); g.stroke();
    for (const gx of [20, 980]) { const s = gx < 500 ? 1 : -1; g.strokeRect(X(gx), Y(74), s * 130, 152 * 0.78); g.strokeRect(X(gx), Y(116), s * 46, 68 * 0.78); g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(X(gx) - (s > 0 ? 10 : 0), Y(128), 10, 44 * 0.78); }
    // the players (far ones first), and the ball with its shadow
    for (const q of [...M.players].sort((a, b) => a.y - b.y)) {
      const T = TEAMS[q.team], px = X(q.x), py = Y(q.y), run = Math.sin(this.t * 10 + q.i) * 2.5;
      if (px < -20 || px > W + 20) continue;
      g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(px, py + 9, 8, 3, 0, 0, 7); g.fill();
      g.strokeStyle = '#1d1d1d'; g.lineWidth = 3; g.beginPath(); g.moveTo(px - 2, py + 2); g.lineTo(px - 3 - run, py + 9); g.moveTo(px + 2, py + 2); g.lineTo(px + 3 + run, py + 9); g.stroke();
      g.fillStyle = q.gk ? '#e2b23a' : T.c; g.fillRect(px - 5, py - 9, 10, 12); g.fillStyle = T.d; g.fillRect(px - 5, py - 3, 10, 2);
      g.fillStyle = '#d9a87e'; g.beginPath(); g.arc(px, py - 13, 4, 0, 7); g.fill();
    }
    const hop = M.shot ? 9 : Math.abs(Math.sin(this.t * 7)) * 3;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(X(M.bx), Y(M.by) + 8, 5, 2, 0, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(X(M.bx), Y(M.by) + 4 - hop, 4, 0, 7); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 1; g.stroke();
    // the score in the corner
    g.fillStyle = 'rgba(8,12,24,.86)'; g.fillRect(10, 8, 250, 26);
    g.fillStyle = TEAMS[0].c; g.fillRect(10, 8, 6, 26); g.fillStyle = TEAMS[1].c; g.fillRect(254, 8, 6, 26);
    g.fillStyle = '#fff'; g.font = `bold 15px ${FONT}`; g.textBaseline = 'middle'; g.direction = 'rtl'; g.textAlign = 'center';
    g.fillText(TEAMS[0].name, 56, 22); g.fillText(TEAMS[1].name, 214, 22); g.direction = 'ltr'; g.fillStyle = '#ffd24a'; g.fillText(`${M.score[0]} - ${M.score[1]}`, 135, 22);
    g.fillStyle = 'rgba(8,12,24,.86)'; g.fillRect(266, 8, 58, 26); g.fillStyle = '#fff'; g.fillText(`${Math.floor(M.clock / 60)}:${String(Math.floor(M.clock % 60)).padStart(2, '0')}`, 295, 22);
    if (M.goalT > 0) { const k = 4.2 - M.goalT; g.fillStyle = `rgba(0,0,0,${Math.min(0.45, k)})`; g.fillRect(0, 96, W, 96); caption(g, 'هدددددف!', 256 + Math.sin(k * 30) * 3, 132, 54, 'center', '#ffd24a'); caption(g, TEAMS[M.team].name, 256, 176, 22); }
  }
}
