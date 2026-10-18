// The family group on the phone: «عيلة أبو سيف». Dad's good-morning roses and his forwarded «عاجل» news, his
// two-minute voice notes, mom asking who took her charger, grandma's love, the uncle's Friday blessing, the brothers
// and sister bickering, and dad writing «شايفك أونلاين! 👀» while you sit on your bed. What happens in the house
// shows up in it too (the gas truck, the tanks, the talabat order, the car across the gate). You answer with a tap;
// he answers back. Opening it is being on your phone, and dad hates you on your phone.
import { A } from './assets.js';
import { playVoice, sfx } from './audio.js';
import { ui } from './ui.js';

const $ = (id) => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const WHO = {
  dad: { name: 'بابا', color: '#e5484d' }, mom: { name: 'ماما', color: '#1f9e8f' }, teta: { name: 'ستّي ❤️', color: '#9b6bff' },
  uncle: { name: 'عمو أبو فراس', color: '#e8922b' }, aunt: { name: 'مرت عمي', color: '#e05e95' },
  big: { name: 'سيف', color: '#3d7ff5' }, sis: { name: 'سلمى', color: '#f25aa0' }, kid: { name: 'حمودة', color: '#3fa35b' },
};

// ---------- pictures people send ----------
const PICS = {};
function pic(kind) {
  if (PICS[kind]) return PICS[kind];
  const c = document.createElement('canvas'); c.width = 360; c.height = 240; const g = c.getContext('2d');
  const rose = (x, y, r, col) => { for (let k = 0; k < 7; k++) { g.fillStyle = col; g.globalAlpha = 0.55 + k * 0.06; g.beginPath(); g.arc(x + Math.cos(k * 2.3) * r * 0.35, y + Math.sin(k * 2.3) * r * 0.35, r * (1 - k * 0.1), 0, 7); g.fill(); } g.globalAlpha = 1; g.fillStyle = '#3f7d2f'; g.beginPath(); g.ellipse(x + r * 0.9, y + r * 0.8, r * 0.55, r * 0.22, 0.6, 0, 7); g.fill(); };
  const title = (t, sub, col, y = 108) => { g.textAlign = 'center'; g.direction = 'rtl'; g.fillStyle = 'rgba(0,0,0,.25)'; g.font = '62px Lalezar, Cairo, sans-serif'; g.fillText(t, 182, y + 3); g.fillStyle = col; g.fillText(t, 180, y); if (sub) { g.font = 'bold 22px Cairo, sans-serif'; g.fillStyle = '#fff'; g.fillText(sub, 180, y + 48); } };
  if (kind === 'sabah' || kind === 'masa') {
    const gr = g.createLinearGradient(0, 0, 360, 240); gr.addColorStop(0, kind === 'sabah' ? '#ffb6c9' : '#5b3a8e'); gr.addColorStop(1, kind === 'sabah' ? '#ffd68a' : '#e76f9a'); g.fillStyle = gr; g.fillRect(0, 0, 360, 240);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.6})`; g.beginPath(); g.arc(Math.random() * 360, Math.random() * 240, Math.random() * 2.2, 0, 7); g.fill(); }
    rose(48, 190, 34, '#d81e3a'); rose(98, 214, 26, '#ff4d6d'); rose(318, 196, 32, '#d81e3a'); rose(272, 220, 22, '#ff8fa3');
    title(kind === 'sabah' ? 'صباح الخير' : 'مسا الخير', kind === 'sabah' ? 'صباح الورد والياسمين 🌹' : 'مساكم سعادة وهنا ✨', '#fff4b8');
  } else if (kind === 'jumaa') {
    const gr = g.createLinearGradient(0, 0, 0, 240); gr.addColorStop(0, '#0f5132'); gr.addColorStop(1, '#2e8b57'); g.fillStyle = gr; g.fillRect(0, 0, 360, 240);
    g.fillStyle = '#e9c46a'; g.beginPath(); g.arc(180, 196, 44, Math.PI, 0); g.fill(); g.fillRect(136, 196, 88, 44); g.fillRect(70, 120, 14, 120); g.beginPath(); g.moveTo(66, 124); g.lineTo(77, 96); g.lineTo(88, 124); g.fill(); g.fillRect(276, 120, 14, 120); g.beginPath(); g.moveTo(272, 124); g.lineTo(283, 96); g.lineTo(294, 124); g.fill();
    g.beginPath(); g.arc(300, 40, 16, 0, 7); g.fill(); g.fillStyle = '#0f5132'; g.beginPath(); g.arc(308, 36, 14, 0, 7); g.fill();
    title('جمعة مباركة', null, '#ffe8a3', 80);
  } else if (kind === 'news') {
    g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, 360, 240); g.fillStyle = '#c1121f'; g.fillRect(0, 0, 360, 52); g.fillStyle = '#fff'; g.font = '900 30px Cairo, sans-serif'; g.textAlign = 'center'; g.direction = 'rtl'; g.fillText('عاجل ‼️', 180, 37);
    g.fillStyle = '#222'; g.font = 'bold 21px Cairo, sans-serif'; g.fillText('مصادر: رفع أسعار الكهرباء', 180, 96); g.fillText('من أول الشهر الجاي!!', 180, 128);
    g.fillStyle = '#999'; for (let i = 0; i < 4; i++) g.fillRect(40, 152 + i * 18, 280 - i * 40, 8); g.fillStyle = '#c1121f'; g.font = 'bold 16px Cairo'; g.fillText('انشرها ولك الأجر 🙏', 180, 230);
  } else if (kind === 'food') {
    g.fillStyle = '#6b4a2b'; g.fillRect(0, 0, 360, 240); g.fillStyle = '#f2f0ea'; g.beginPath(); g.ellipse(180, 128, 150, 92, 0, 0, 7); g.fill();
    g.fillStyle = '#e8c67c'; g.beginPath(); g.ellipse(180, 124, 118, 66, 0, 0, 7); g.fill();
    for (let i = 0; i < 60; i++) { g.fillStyle = i % 3 ? '#8a4b23' : '#3f7d2f'; g.beginPath(); g.arc(180 + (Math.random() - 0.5) * 190, 124 + (Math.random() - 0.5) * 90, 3 + Math.random() * 5, 0, 7); g.fill(); }
    g.fillStyle = '#f4d35e'; for (let i = 0; i < 18; i++) { g.beginPath(); g.ellipse(180 + (Math.random() - 0.5) * 150, 120 + (Math.random() - 0.5) * 60, 9, 4, Math.random() * 3, 0, 7); g.fill(); }
  }
  return (PICS[kind] = c.toDataURL('image/jpeg', 0.82));
}

// ---------- what gets said ----------
// replies: [label, tag]; the tag decides who answers and how
const R = {
  dad: [['حاضر يابا 🙏', 'respect'], ['تمام', 'ok'], ['😂', 'laugh']],
  news: [['يابا هاي إشاعة 😂', 'rumour'], ['الله يستر 😟', 'worry'], ['👍', 'ok']],
  mom: [['ماشي ماما ❤️', 'mom'], ['مش أنا 😇', 'notme'], ['حاضر', 'mom']],
  teta: [['وإنتِ يا ستّي ❤️', 'teta'], ['😘😘', 'teta'], ['منيحة؟', 'teta']],
  any: [['😂😂', 'laugh2'], ['❤️', 'heart'], ['👍', 'ok']],
};
const POOL = [
  { from: 'dad', fwd: true, img: 'news', text: '↪ عاجل!! رفع أسعار الكهربا من أول الشهر… انشروها', r: 'news' },
  { from: 'dad', fwd: true, text: '↪ انتبهوا يا جماعة: في رسالة احتيال بتطلب رقم البطاقة، لا تفتحوا أي رابط 🙏🙏', r: 'news' },
  { from: 'dad', fwd: true, text: '↪ فوائد الزنجبيل مع الليمون الصبح عالريق: بيقوّي المناعة وبينزّل الضغط 🍋💪', r: 'news' },
  { from: 'dad', text: 'مين ترك ضو الحمّام مولّع؟؟؟', r: 'dad' },
  { from: 'dad', text: 'الفاتورة إجت 96 دينار 😤 بدي اجتماع عائلي الليلة', r: 'dad' },
  { from: 'dad', voice: 'dad.lecture', r: 'dad' },
  { from: 'dad', text: 'وين الريموت؟؟ كل يوم نفس القصة', r: 'dad' },
  { from: 'mom', text: 'حدا يجيب خبز وهو راجع 🍞', r: 'mom' },
  { from: 'mom', text: 'مين أخذ شاحني؟؟ 🔌 رجّعوه هسّا', r: 'mom' },
  { from: 'mom', img: 'food', text: 'الغدا جاهز ❤️ مقلوبة', r: 'mom' },
  { from: 'mom', voice: 'mom.ask', r: 'mom' },
  { from: 'teta', text: 'يا حبايب ستّكم اشتقتلكم 😘😘 متى بتيجوا؟', r: 'teta' },
  { from: 'teta', text: 'الله يرضى عليكم ويحميكم من كل شر 🤲', r: 'teta' },
  { from: 'uncle', text: 'سؤال للعيلة: مين بيعرف ميكانيكي منيح؟ السيارة بتطقطق 😅', r: 'any' },
  { from: 'aunt', text: 'طبخة اليوم: محشي كوسا 😋 وصفتي بالضبط: الكوسا، الرز، اللحمة، وكتير نفَس', r: 'any' },
  { from: 'sis', text: 'بابا شو بدك من السوق؟ أنا رايحة مع ماما', r: 'any', not: 'sis' },
  { from: 'kid', text: '😂😂😂😂', r: 'any', not: 'kid' },
  { from: 'big', text: 'حدا شاف السمّاعات تبعتي؟؟', r: 'any', not: 'big' },
  { from: 'kid', text: 'سيف ضربني 😭', r: 'any', not: 'kid' },
];
// someone answers you
const ANSWERS = {
  respect: [['dad', 'الله يرضى عليك ❤️'], ['dad', 'هيك بدي إياك 👌']], ok: [['dad', '👍']], laugh: [['dad', 'شو بتضحك؟ 😠'], ['dad', 'الضحك بلا سبب… 😒']],
  rumour: [['dad', 'إنت بتعرف أكثر من الأخبار؟ 😒'], ['dad', 'صاحبي بالشركة حكالي… مش إشاعة']], worry: [['dad', 'الله يستر يابا 🤲']],
  mom: [['mom', 'يسلموا حبيبي ❤️']], notme: [['mom', 'طيب طيب… 😏'], ['sis', 'أكيد مش إنت 😂']], teta: [['teta', 'الله يخليلي إياكم يا قلبي ❤️❤️']],
  laugh2: [['kid', '😂😂😂']], heart: [['teta', '❤️❤️❤️']],
};

export class Chat {
  constructor(game) {
    this.game = game; this.msgs = []; this.unread = 0; this.open = false; this.replies = null; this.day = -1;
    const hud = $('hud'), el = this.el = document.createElement('div'); el.id = 'chat';
    el.innerHTML = `<div class="ch-head"><span class="ch-back">‹</span><span class="ch-av">👨‍👩‍👧‍👦</span><div class="ch-t"><b>عيلة أبو سيف 🏠</b><small id="chSub">بابا، ماما، ستّي، عمو أبو فراس، مرت عمي…</small></div><span class="ch-ic">📞</span></div>
      <div class="ch-list" id="chList"></div><div class="ch-reps" id="chReps"></div>
      <div class="ch-in"><span class="ch-box">اكتب رسالة</span><span class="ch-mic">🎤</span></div>`;
    hud.appendChild(el);
    const note = this.note = document.createElement('div'); note.id = 'chatNote'; hud.appendChild(note);
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    $('chReps').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) this.reply(+b.dataset.i); });
    $('chList').addEventListener('click', (e) => { const v = e.target.closest('.ch-voice'); if (v) this.play(v); });
    addEventListener('keydown', (e) => { if (!this.open) return; const k = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code]; if (k != null) this.reply(k); });
  }
  get me() { return this.game.playerKey; }
  clock() { const s = this.game.seg; if (!s) return ''; const m = s.clock[0] + (s.clock[1] - s.clock[0]) * Math.min(1, this.game.segT / s.time), h = Math.floor(m / 60), mm = Math.floor(m % 60); return `${h > 12 ? h - 12 : h}:${String(mm).padStart(2, '0')} ${h >= 12 ? 'م' : 'ص'}`; }

  // a new day: yesterday's chat stays where it was, today starts with dad's picture
  reset(seg) {
    const g = this.game;
    if (this.day !== g.dayIndex) {
      this.day = g.dayIndex; this.msgs = []; this.unread = 0; this.used = new Set(); $('chList').innerHTML = '<div class="ch-date">اليوم</div>';
      const fri = g.day.id === 'fri', morning = seg.tod === 'morning' || seg.tod === 'day';
      this.queue = [{ at: 3, m: { from: 'dad', img: fri ? 'jumaa' : morning ? 'sabah' : 'masa', text: fri ? 'جمعة مباركة على الجميع 🌹🕌' : morning ? 'صباح الخير يا عيلة 🌹' : 'مسا الخير 🌹', r: 'dad' } },
        { at: 9, m: { from: 'teta', text: fri ? 'جمعة مباركة يا حبايبي 🤲' : morning ? 'صباح النور يا ضنايا ❤️' : 'مسا النور يا حبايبي ❤️', r: 'teta' } },
        { at: 16, m: { from: 'uncle', text: '🌹🌹🌹' } }];
    } else this.queue = (this.queue || []).filter((q) => !q.done).map((q, i) => ({ ...q, at: 3 + i * 5 }));      // (what had not been said yet still comes)
    this.nextT = rnd(28, 45); this.seenNag = 0; this.renderReplies();
  }

  // something happened in the house and somebody writes about it
  event(kind) {
    const T = {
      gas: [{ from: 'dad', text: 'الغاز برا!! حدا ينزل بالجرّة 🔥' }],
      veg: [{ from: 'mom', text: 'سيارة الخضرة عالباب! جيبوا بندورة وخيار 🍅🥒', r: 'mom' }],
      tank: [{ from: 'dad', text: 'طالع عالسطح أشوف الخزانات… المي إجت ولا لأ؟ 💧', r: 'dad' }],
      tankEmpty: [{ from: 'dad', text: 'الخزان فاضي 😡 خلص الحمّام لليوم! محدا يتحمّم', r: 'dad' }],
      talabat: [{ from: 'dad', text: 'مين طالب طلبات؟؟ 🛵😡 الأكل مش عاجبكم؟', r: 'dad' }, { from: 'mom', text: 'خلّيهم يا زلمة 😅' }],
      tire: [{ from: 'dad', text: 'واحد صافف سيارته عالباب 😤 هسّا بورجيه 🔧' }, { from: 'kid', text: '😂😂😂' }],
      lecture: [{ from: 'sis', text: 'الله يعينك 😬', not: 'sis' }],
    }[kind];
    if (!T) return;
    T.forEach((m, i) => { if (m.not === this.me) return; this.game.later(0.6 + i * 2.4, () => this.post(m)); });
  }

  post(m) {
    if (m.not && m.not === this.me) return;
    const from = m.from === this.me ? 'me' : m.from;
    this.msgs.push({ ...m, from, at: this.clock() });
    this.draw(this.msgs[this.msgs.length - 1]);
    if (from !== 'me') {
      if (m.r) this.replies = m.r;
      this.renderReplies();
      if (!this.open) { this.unread++; this.notify(m); }
      else sfx.ping && sfx.ping(true);
    }
  }
  notify(m) {
    const w = WHO[m.from] || { name: '' };
    this.note.innerHTML = `<span class="ch-av">👨‍👩‍👧‍👦</span><div><b>عيلة أبو سيف</b><small>${w.name}: ${m.voice ? '🎤 رسالة صوتية' : m.img && !m.text ? '📷 صورة' : (m.text || '').slice(0, 46)}</small></div>`;
    this.note.classList.remove('show'); void this.note.offsetWidth; this.note.classList.add('show');
    clearTimeout(this.noteT); this.noteT = setTimeout(() => this.note.classList.remove('show'), 3800);
    if (sfx.ping) sfx.ping(false);
    const b = $('bPhone'); if (b) b.dataset.n = this.unread || '';
  }
  draw(m) {
    const list = $('chList'), w = WHO[m.from] || {}, d = document.createElement('div');
    d.className = 'ch-msg ' + (m.from === 'me' ? 'me' : 'them');
    let body = '';
    if (m.from !== 'me') body += `<b class="ch-name" style="color:${w.color}">${w.name}</b>`;
    if (m.fwd) body += '<i class="ch-fwd">↪ معاد توجيهها</i>';
    if (m.img) body += `<img src="${pic(m.img)}" alt="">`;
    if (m.voice) {
      const ids = Object.keys(A.voice).filter((k) => k.startsWith(m.voice + '.')), id = ids.length ? pick(ids) : null, dur = id ? A.voice[id].d : 6;
      body += `<span class="ch-voice" data-id="${id || ''}"><span class="pl">▶</span><span class="wv">${'<i></i>'.repeat(26)}</span><small>${Math.floor(dur / 60)}:${String(Math.round(dur % 60)).padStart(2, '0')}</small></span>`;
    }
    if (m.text) body += `<span class="ch-txt">${m.text.replace(/^↪ /, '')}</span>`;
    body += `<span class="ch-time">${m.at}${m.from === 'me' ? ' <em>✓✓</em>' : ''}</span>`;
    d.innerHTML = body; list.appendChild(d);
    while (list.children.length > 60) list.removeChild(list.children[1]);
    list.scrollTop = list.scrollHeight;
    d.querySelectorAll('.wv i').forEach((i) => { i.style.height = (4 + Math.random() * 16) + 'px'; });
  }
  play(v) {
    const id = v.dataset.id; if (!id) return;
    if (this.voice) this.voice.stop();
    this.voice = playVoice(id, null, { gain: 0.9 });
    v.classList.add('on'); setTimeout(() => v.classList.remove('on'), (A.voice[id] ? A.voice[id].d : 3) * 1000);
    const e = A.lines.lines[id.replace(/\.\d+$/, '')], i = +id.split('.').pop();
    if (e) ui.caption((WHO[e.who] || {}).name || '', e.t[i], A.voice[id] ? A.voice[id].d : 3);
  }
  renderReplies() {
    const box = $('chReps'); if (!box) return;
    const set = this.replies ? R[this.replies] : null;
    box.innerHTML = set ? set.map(([t], i) => `<button data-i="${i}"><kbd>${i + 1}</kbd>${t}</button>`).join('') : '';
  }
  reply(i) {
    const set = this.replies && R[this.replies]; if (!set || !set[i]) return;
    const [text, tag] = set[i]; this.replies = null; this.renderReplies();
    this.post({ from: this.me, text });
    const ans = ANSWERS[tag];
    if (ans) { const [who, t] = pick(ans); if (who !== this.me) this.game.later(rnd(2.2, 4), () => this.post({ from: who, text: t })); }
    if (tag === 'respect') this.game.addAnger(-2, 'respect');
    if (tag === 'laugh') this.game.addAnger(1, 'cheek');
  }

  update(dt) {
    const g = this.game, p = g.player;
    // shown while the phone is out (and the mouse let go, so you can tap the answers)
    const want = !!(p && p.phoneOut && g.active && !g.paused);
    if (want !== this.open) {
      this.open = want; this.el.classList.toggle('show', want); document.body.classList.toggle('chatting', want);      // (your eyes are on the phone: the job list steps aside)
      if (want) { this.unread = 0; const b = $('bPhone'); if (b) b.dataset.n = ''; this.note.classList.remove('show'); if (document.pointerLockElement) document.exitPointerLock(); $('chList').scrollTop = 1e6; }
    }
    if (!g.active || g.over) return;
    for (const q of this.queue) if (!q.done && g.segT >= q.at) { q.done = true; this.post(q.m); }
    this.nextT -= dt;
    if (this.nextT <= 0) {
      this.nextT = rnd(40, 75);
      const left = POOL.filter((m, i) => !this.used.has(i) && m.not !== this.me && (m.from !== this.me));
      if (left.length) { const m = pick(left); this.used.add(POOL.indexOf(m)); this.post(m); }
    }
    // on your phone with dad awake somewhere else in the house: he sees you «online»
    if (this.open && !g.dad.away && g.dad.state !== 'nap' && !g.dad.seen) {
      this.seenNag += dt;
      if (this.seenNag > 9 && !this.nagged) { this.nagged = true; this.post({ from: 'dad', text: pick(['شايفك أونلاين! 👀 شو بتعمل؟', 'نزّل التلفون وتعال لهون 😠', 'إنت أونلاين من ساعة!! 📵']), r: 'dad' }); }
    }
  }
}
