// Keyboard + mouse + touch, flattened into one state object the game reads each frame.
export const input = {
  mx: 0, my: 0,            // move stick: x = right, y = forward (-1..1)
  run: false, sneak: false,
  use: false,              // interact held
  lookX: 0, lookY: 0,      // camera deltas accumulated since last frame (pixels)
  pressed: new Set(),      // one-shot actions this frame: 'use', 'phone', 'nod', 'pause', 'sneak'
  touch: false,
  locked: false,
};

const keys = new Set();
const MOVE = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
let stick = null;          // touch joystick vector
let stickRun = false;

export function initInput(canvas) {
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'KeyE' || e.code === 'Enter') input.pressed.add('use');
    if (e.code === 'KeyF') input.pressed.add('phone');
    if (e.code === 'Space') { input.pressed.add('nod'); e.preventDefault(); }
    if (e.code === 'KeyC' || e.code === 'ControlLeft') input.pressed.add('sneak');
    if (e.code === 'Escape' || e.code === 'KeyP') input.pressed.add('pause');
    if (e.code.startsWith('Arrow')) e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  // mouse look: pointer lock when the browser gives it, drag otherwise
  let dragging = false;
  canvas.addEventListener('mousedown', () => {
    dragging = true;
    if (!input.touch && canvas.requestPointerLock && !document.pointerLockElement) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* fine: drag still works */ } }
  });
  addEventListener('mouseup', () => { dragging = false; });
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas || dragging) { input.lookX += e.movementX; input.lookY += e.movementY; }
  });
  document.addEventListener('pointerlockchange', () => { input.locked = document.pointerLockElement === canvas; });

  // touch: the left of the screen is the walking thumb (the stick appears under it); the rest of the picture looks around
  const stickEl = document.getElementById('stick'), knob = stickEl.firstElementChild, R = 46, DEAD = 0.14;
  let stickId = null, lookId = null, lx = 0, ly = 0, ox = 0, oy = 0;
  const rest = () => { stickEl.style.left = '92px'; stickEl.style.top = Math.round(innerHeight * 0.7) + 'px'; };
  // inside the ring you walk (further out = faster); push well past it and you run; past that the base trails the thumb
  const FAR = 1.75;
  const setStick = (t) => {
    let x = (t.clientX - ox) / R, y = (t.clientY - oy) / R, m = Math.hypot(x, y);
    if (m > FAR) { ox += (x - x / m * FAR) * R; oy += (y - y / m * FAR) * R; x *= FAR / m; y *= FAR / m; m = FAR; stickEl.style.left = ox + 'px'; stickEl.style.top = oy + 'px'; }
    const mm = Math.min(1, m), k = mm <= DEAD ? 0 : (mm - DEAD) / (1 - DEAD) / (m || 1);
    stick = [x * k, -y * k];
    stickRun = m > (stickRun ? 1.2 : 1.42);
    stickEl.classList.toggle('run', stickRun);
    knob.style.transform = `translate(${x * R * 0.8}px, ${y * R * 0.8}px)`;
  };
  addEventListener('touchstart', (e) => {
    if (!input.touch) { input.touch = true; document.body.classList.add('touch'); rest(); }
    for (const t of e.changedTouches) {
      if (t.target !== canvas) continue;
      if (stickId === null && t.clientX < innerWidth * 0.46) {
        stickId = t.identifier; ox = Math.max(64, t.clientX); oy = Math.min(innerHeight - 60, Math.max(84, t.clientY));
        stickEl.style.left = ox + 'px'; stickEl.style.top = oy + 'px'; stickEl.classList.add('on'); setStick(t);
      } else if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
    }
  }, { passive: true });
  addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) setStick(t);
      else if (t.identifier === lookId) { input.lookX += (t.clientX - lx) * 1.5; input.lookY += (t.clientY - ly) * 1.2; lx = t.clientX; ly = t.clientY; }
    }
  }, { passive: true });
  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) { stickId = null; stick = null; stickRun = false; knob.style.transform = ''; stickEl.classList.remove('on', 'run'); rest(); }
      if (t.identifier === lookId) lookId = null;
    }
  };
  addEventListener('touchend', end); addEventListener('touchcancel', end);
  addEventListener('resize', () => { if (stickId === null) rest(); });
  if (input.touch) rest();

  const hold = (id, on, off) => {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', (e) => { on(el); e.preventDefault(); e.stopPropagation(); }, { passive: false });
    el.addEventListener('touchend', (e) => { off && off(el); e.preventDefault(); }, { passive: false });
    el.addEventListener('mousedown', () => on(el)); el.addEventListener('mouseup', () => off && off(el));
  };
  let useHeld = false;
  hold('bUse', () => { useHeld = true; input.pressed.add('use'); input.pressed.add('nod'); }, () => { useHeld = false; });
  hold('bSneak', () => input.pressed.add('sneak'));
  input._sneakEl = document.getElementById('bSneak');
  hold('bPhone', () => input.pressed.add('phone'));
  hold('bPause', () => input.pressed.add('pause'));
  input._useHeld = () => useHeld;
}

export function pollInput() {
  let x = 0, y = 0;
  for (const k of keys) if (MOVE[k]) { x += MOVE[k][0]; y += MOVE[k][1]; }
  if (stick) { x = stick[0]; y = stick[1]; }
  const m = Math.hypot(x, y);
  if (m > 1) { x /= m; y /= m; }
  input.mx = x; input.my = y;
  input.run = keys.has('ShiftLeft') || keys.has('ShiftRight') || stickRun;
  input.use = keys.has('KeyE') || keys.has('Enter') || (input._useHeld ? input._useHeld() : false);
}

export function endFrame() { input.pressed.clear(); input.lookX = 0; input.lookY = 0; }
