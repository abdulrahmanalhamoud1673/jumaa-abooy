// HUD and menus: thin wrappers over the DOM in index.html.
const $ = (id) => document.getElementById(id);
const SCREENS = ['loading', 'title', 'pick', 'week', 'intro', 'pause', 'end'];
const MOODS = [[0, 'أبوك رايق'], [25, 'أبوك متضايق'], [50, 'أبوك معصّب'], [70, 'أبوك مولّع'], [85, 'الشبشب طالع!'], [97, 'رح ينفجر!!']];
let captionT = 0, toastT = 0, lastTasks = '', tasksOpen = false, doneT = 0;
const touchUI = () => document.body.classList.contains('touch');

export const ui = {
  screen(name) { for (const s of SCREENS) $(s).classList.toggle('show', s === name); },
  hud(on) { $('hud').hidden = !on; },
  loading(p, text) { $('loadBar').style.width = Math.round(p * 100) + '%'; if (text) $('loadText').textContent = text; },

  anger(v, debt) {
    $('angerBar').firstElementChild.style.width = Math.min(100, v) + '%';
    let label = MOODS[0][1];
    for (const [t, l] of MOODS) if (v >= t) label = l;
    $('angerLabel').textContent = debt ? `${label} · مسجّل عليك ${debt}` : label;
    $('anger').classList.toggle('hot', v >= 85);
  },
  dadFace(url) { $('dadFace').style.backgroundImage = `url(${url})`; },
  clock(day, minutes, late) {
    $('dayName').textContent = day;
    const h = Math.floor(minutes / 60), m = Math.floor(minutes % 60);
    $('time').textContent = `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}`;
    $('clock').classList.toggle('late', !!late);
  },
  eye(state, text) { const e = $('eye'); if (e.dataset.s !== String(state)) e.dataset.s = state; e.lastElementChild.textContent = text || ''; },
  stamina(v) { $('stamina').firstElementChild.style.width = Math.round(v * 100) + '%'; $('stamina').style.opacity = v > 0.98 ? 0.25 : 1; },
  carry(text) { $('carry').textContent = text || ''; },
  tokens(n, phone) { $('tokens').textContent = '💚'.repeat(n) + (phone ? '' : ' 📵'); },
  vignette(v) { $('vignette').style.opacity = v; },
  flash() { const f = $('flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); },
  edge(x, y) { const e = $('edge'); if (x === null) { e.style.display = 'none'; return; } e.style.display = 'flex'; e.style.left = x + 'px'; e.style.top = y + 'px'; },

  // On a phone the list shows the three jobs that matter most right now; a tap opens the rest.
  bindTouch() { $('tasks').addEventListener('click', () => { tasksOpen = !tasksOpen; $('tasks').classList.toggle('open', tasksOpen); lastTasks = ''; }); $('nodKey').textContent = '✋'; },
  tasks(list) {
    let more = 0;
    if (touchUI() && !tasksOpen) {
      const rank = (t) => (t.active ? -1 : t.kind === 'cmd' ? 0 : t.kind === 'mom' ? 1 : t.kind === 'secret' ? 3 : 2), open = list.filter((t) => !t.done).sort((a, b) => rank(a) - rank(b));
      more = Math.max(0, open.length - 3); list = open.slice(0, 3);
    }
    const html = list.map((t) => {
      const cls = ['task', t.kind === 'secret' ? 'secret' : t.kind === 'cmd' ? 'cmd' : t.kind === 'mom' ? 'mom' : '', t.done ? 'done' : ''].join(' ');
      const tm = t.left != null && !t.done ? `<span class="tm">${Math.ceil(t.left)}</span>` : '';
      const bar = t.progress != null && !t.done ? `<div class="bar"><i style="width:${Math.round(t.progress * 100)}%"></i></div>` : '';
      return `<div class="${cls}">${tm}<b>${t.title}</b>${t.sub && !t.done ? `<small>${t.sub}</small>` : ''}${bar}</div>`;
    }).join('') + (more ? `<div class="task more">+${more} كمان ▾</div>` : touchUI() && tasksOpen ? '<div class="task more">▴</div>' : '');
    if (html !== lastTasks) { $('tasks').innerHTML = html; lastTasks = html; }
  },
  // What you are in the middle of: its name, the seconds left, a bar, and the reason if it has stopped counting.
  doing(d) {
    const e = $('doing'), now = performance.now();
    if (d && d.finished) { if (!doneT) { doneT = now + 1800; $('doingText').textContent = '✓ خلصت: ' + d.label; $('doingLeft').textContent = ''; $('doingWhy').textContent = ''; e.className = 'show done'; e.querySelector('i').style.width = '100%'; } return; }
    if (!d) { if (doneT && now < doneT) return; doneT = 0; e.className = ''; return; }
    doneT = 0;
    $('doingText').textContent = d.label; $('doingLeft').textContent = Math.ceil(d.left) + ' ث';
    $('doingWhy').textContent = d.stopped || ''; e.className = 'show' + (d.stopped ? ' stopped' : '');
    e.querySelector('i').style.width = (d.frac * 100).toFixed(1) + '%';
  },
  prompt(text, progress) {
    const p = $('prompt');
    $('bUse').classList.toggle('ready', !!text || !$('nod').hidden);
    if (!text) { p.classList.remove('show'); return; }
    p.classList.add('show');
    $('promptText').textContent = text;
    p.classList.toggle('busy', progress != null && progress > 0);
    if (progress != null) $('promptRing').style.strokeDashoffset = String(94.25 * (1 - progress));
  },
  caption(who, text, dur, cls = '') {
    const c = $('caption');
    c.className = 'show ' + cls;
    c.innerHTML = `<span class="who">${who}</span>${text}`;
    captionT = performance.now() + dur * 1000;
  },
  toast(text, kind = '') {
    const t = $('toast'); t.textContent = text; t.className = 'show ' + kind; toastT = performance.now() + 2600;
  },
  pip(on) { $('pip').classList.toggle('show', !!on); },
  nod(show, scale = 2.2, state = '') {
    const n = $('nod'); n.hidden = !show;
    const r = $('nodRing'); r.style.setProperty('--s', scale); r.style.setProperty('--o', show && scale > 1 ? 1 : 0); r.className = state;
  },
  tick() {
    const now = performance.now();
    if (captionT && now > captionT) { $('caption').classList.remove('show'); captionT = 0; }
    if (toastT && now > toastT) { $('toast').classList.remove('show'); toastT = 0; }
  },

  pickCards(traits, portraits, onPick) {
    $('cards').innerHTML = '';
    for (const [key, t] of Object.entries(traits)) {
      const el = document.createElement('div'); el.className = 'pcard';
      el.innerHTML = `<img src="${portraits[key] || ''}" alt=""><h3>${t.name}</h3><div class="role">${t.role}</div><ul>${t.good.map((g) => `<li class="good">${g}</li>`).join('')}${t.bad.map((g) => `<li class="bad">${g}</li>`).join('')}</ul>`;
      el.onclick = () => onPick(key);
      $('cards').appendChild(el);
    }
  },
  week(days, progress, who, onDay) {
    $('weekWho').textContent = who;
    $('days').innerHTML = '';
    days.forEach((d, i) => {
      const stars = progress.stars[i] || 0, open = i <= progress.unlocked;
      const el = document.createElement('div'); el.className = 'day' + (open ? '' : ' locked') + (d.boss ? ' boss' : '');
      el.innerHTML = `<div class="n">${d.name}</div><div class="t">${open ? d.title : '🔒'}</div><div class="s">${'★'.repeat(stars)}${'☆'.repeat(open ? 3 - stars : 0)}</div>`;
      if (open) el.onclick = () => onDay(i);
      $('days').appendChild(el);
    });
  },
  intro(day, seg, tasks, segIndex, onGo) {
    $('introKicker').textContent = segIndex ? `${day.name} · المرحلة ${segIndex + 1} من ${day.segs.length}` : `يوم ${day.name}`;
    $('introTitle').textContent = segIndex ? seg.title : day.title;
    $('introText').textContent = segIndex ? '' : day.blurb;
    $('introTasks').innerHTML = tasks.map((t) => `<div class="${t.kind === 'secret' ? 'secret' : ''}">${t.kind === 'secret' ? 'سرّي: ' : ''}${t.title}</div>`).join('');
    $('btnGo').onclick = onGo;
    this.screen('intro');
  },
  end(d, on) {
    $('endKicker').textContent = d.kicker; $('endTitle').textContent = d.title;
    $('stars').innerHTML = d.win ? '★'.repeat(d.stars) + `<span class="off">${'★'.repeat(3 - d.stars)}</span>` : '<span class="off">★★★</span>';
    $('endStats').innerHTML = d.rows.map(([k, v]) => `<div>${k}<b>${v}</b></div>`).join('');
    $('endDadText').textContent = d.dad || '…';
    $('btnNext').style.display = d.win && d.hasNext ? '' : 'none';
    $('btnNext').onclick = on.next; $('btnAgain').onclick = on.again; $('btnWeek').onclick = on.week;
    this.screen('end');
  },
  endDad(text) { $('endDadText').textContent = text; },
};
