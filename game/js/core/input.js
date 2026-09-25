'use strict';
// ---------------------------------------------------------------------------
// Keyboard + gamepad input with edge detection and menu key-repeat.
// Actions: up down left right ok cancel run menu
// ---------------------------------------------------------------------------
const Input = {
  // Keys that always work, so nobody can lock themselves out of the menus by rebinding.
  FIXED_KEYS: { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok', Escape: 'cancel' },
  // The rebindable keys (OPTIONS > Controls keeps its own copy in State.options.keys).
  // Up to two per action; a Shift / Ctrl / Alt entry stands for both the left and the right key.
  DEFAULT_KEYS: {
    up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    ok: ['KeyZ', 'NumpadEnter'],
    cancel: ['KeyX', 'ShiftLeft'],
    run: ['Space'],
    menu: ['KeyC', 'Tab'],
  },
  ACTIONS: ['up', 'down', 'left', 'right', 'ok', 'cancel', 'run', 'menu'],
  keyMap: {},
  bindings: null,
  down: {},        // raw held state from keyboard
  pad: {},         // held state from gamepad
  held: {},        // combined held (sampled once per frame)
  heldFrames: {},
  _pressedQueue: new Set(),
  pressed: {},
  anyKeyThisFrame: false,
  lastDir: null,
  listeners: [],
  enabled: true,

  // key code -> action, from the fixed keys and the player's bindings
  setBindings(keys) {
    const b = {};
    for (const a of this.ACTIONS) b[a] = (keys && Array.isArray(keys[a]) ? keys[a] : this.DEFAULT_KEYS[a]).filter((c) => typeof c === 'string' && !this.FIXED_KEYS[c]);
    this.bindings = b;
    this.keyMap = Object.assign({}, this.FIXED_KEYS);
    for (const a of this.ACTIONS) for (const c of b[a]) for (const k of this.keyGroup(c)) this.keyMap[k] = a;
    this.down = {};
  },
  // Shift, Ctrl and Alt are bound as a pair (left and right)
  keyGroup(code) {
    const m = /^(Shift|Control|Alt|Meta)(Left|Right)$/.exec(code);
    return m ? [m[1] + 'Left', m[1] + 'Right'] : [code];
  },
  // the one code a binding is stored as (ShiftRight -> ShiftLeft)
  keyId(code) { return this.keyGroup(code)[0]; },
  keyName(code) {
    const names = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space', Enter: 'Enter', NumpadEnter: 'Num Enter', Escape: 'Esc', Backspace: 'Backspace', Tab: 'Tab', CapsLock: 'Caps Lock', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/' };
    if (names[code]) return names[code];
    let m = /^(Shift|Control|Alt|Meta)(Left|Right)$/.exec(code);
    if (m) return { Shift: 'Shift', Control: 'Ctrl', Alt: 'Alt', Meta: 'Meta' }[m[1]];
    if ((m = /^Key([A-Z])$/.exec(code))) return m[1];
    if ((m = /^Digit(\d)$/.exec(code))) return m[1];
    if ((m = /^Numpad(.+)$/.exec(code))) return 'Num ' + m[1];
    return code;
  },
  // the keys of an action as shown to the player ("Z / Enter")
  keysText(a, max = 2) {
    const codes = [...this.bindings[a], ...Object.keys(this.FIXED_KEYS).filter((c) => this.FIXED_KEYS[c] === a)];
    const names = [...new Set(codes.map((c) => this.keyName(c)))];
    return names.slice(0, max).join(' / ') || '—';
  },

  init() {
    if (!this.bindings) this.setBindings(null);
    window.addEventListener('keydown', (e) => {
      if (this.capture) { this.capture(e); e.preventDefault(); return; }
      const a = this.keyMap[e.code];
      if (e.code === 'F4' || (e.code === 'Enter' && e.altKey)) { this.toggleFullscreen(); e.preventDefault(); return; }
      if (a) {
        if (!this.down[a]) this._pressedQueue.add(a);
        this.down[a] = true;
        e.preventDefault();
      }
      this._anyQueued = true;
      this._keyboardSeen = true;
      for (const l of this.listeners) l(e);
    });
    window.addEventListener('keyup', (e) => {
      const a = this.keyMap[e.code];
      if (a) { this.down[a] = false; e.preventDefault(); }
    });
    window.addEventListener('blur', () => { this.down = {}; this.releaseDir(true); });
    this.initTouch();
  },

  // -------------------------------------------------------------------------
  // Touch: swipe to move (swipe and hold keeps walking, swipe further to run),
  // one-finger tap = Z (ok), two-finger tap = X (cancel/menu).
  // -------------------------------------------------------------------------
  touch: {},
  touchDevice: false,
  usingTouch: false,
  ts: { id: null, dir: null, multi: false },
  TAP_SLOP: 14,      // px a tap may wobble
  DEAD: 22,          // px before a swipe counts as a direction
  MAXR: 70,          // the swipe anchor follows the finger beyond this radius
  RUN_DIST: 52,      // swipe this far from the anchor to run

  initTouch() {
    this.touchDevice = (navigator.maxTouchPoints || 0) > 0 || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
    const opts = { passive: false };
    window.addEventListener('touchstart', (e) => this.onTouchStart(e), opts);
    window.addEventListener('touchmove', (e) => this.onTouchMove(e), opts);
    window.addEventListener('touchend', (e) => this.onTouchEnd(e), opts);
    window.addEventListener('touchcancel', (e) => this.onTouchEnd(e, true), opts);
    window.addEventListener('contextmenu', (e) => { if (this.usingTouch) e.preventDefault(); });
    // once a keyboard is used, show keyboard hints again
    window.addEventListener('keydown', () => { this.usingTouch = false; });
  },

  onTouchStart(e) {
    e.preventDefault();
    this.usingTouch = true;
    const s = this.ts, now = performance.now();
    if (e.touches.length === 1 && !s.multi) {
      const t = e.changedTouches[0];
      Object.assign(s, { id: t.identifier, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, t0: now, moved: false, multi: false });
    } else {
      // a second finger turns this into a two-finger gesture (never a swipe)
      if (!s.multi) {
        s.multi = true;
        s.twoT0 = now;
        s.twoMoved = false;
        s.maxFingers = 0;
        s.starts = {};
        this.releaseDir(true);
      }
      for (const t of e.touches) if (!s.starts[t.identifier]) s.starts[t.identifier] = [t.clientX, t.clientY];
      s.maxFingers = Math.max(s.maxFingers, e.touches.length);
    }
  },

  onTouchMove(e) {
    e.preventDefault();
    const s = this.ts;
    if (s.multi) {
      for (const t of e.touches) {
        const p = s.starts[t.identifier];
        if (p && Math.hypot(t.clientX - p[0], t.clientY - p[1]) > this.TAP_SLOP * 1.6) s.twoMoved = true;
      }
      return;
    }
    const t = Array.from(e.touches).find((tt) => tt.identifier === s.id);
    if (!t) return;
    s.x = t.clientX; s.y = t.clientY;
    let dx = s.x - s.x0, dy = s.y - s.y0;
    let dist = Math.hypot(dx, dy);
    if (dist > this.TAP_SLOP) s.moved = true;
    if (dist > this.MAXR) {
      // drag the anchor along so turning around stays quick
      s.x0 = s.x - (dx / dist) * this.MAXR;
      s.y0 = s.y - (dy / dist) * this.MAXR;
      dx = s.x - s.x0; dy = s.y - s.y0; dist = this.MAXR;
    }
    if (dist >= this.DEAD) {
      const horiz = Math.abs(dx) > Math.abs(dy);
      const dir = horiz ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      // a little hysteresis near the diagonals so the direction doesn't flicker
      const clear = horiz ? Math.abs(dx) > Math.abs(dy) * 1.25 : Math.abs(dy) > Math.abs(dx) * 1.25;
      if (dir !== s.dir && (!s.dir || clear)) this.setDir(dir);
      s.dist = dist; // running is decided each frame in update() (only for deliberate holds)
    } else if (s.dir && dist < this.DEAD * 0.5) {
      this.releaseDir();
    }
  },

  onTouchEnd(e, cancelled) {
    e.preventDefault();
    const s = this.ts, now = performance.now();
    if (s.multi) {
      if (e.touches.length === 0) {
        if (!cancelled && s.maxFingers === 2 && !s.twoMoved && now - s.twoT0 < 450) this.tap('cancel');
        s.multi = false;
        s.id = null;
      }
      return;
    }
    const t = Array.from(e.changedTouches).find((tt) => tt.identifier === s.id);
    if (!t) return;
    if (!cancelled && !s.moved && now - s.t0 < 400) {
      this._tapPending = [t.clientX, t.clientY];   // menus can hit-test this position
      this.tap('ok');                                // everywhere else a tap is simply Z
    }
    this.releaseDir();
    s.id = null;
  },

  tap(a) {
    this._pressedQueue.add(a);
    this._anyQueued = true;
  },

  // tap position in game coordinates (960x720), or null
  toGame(cx, cy) {
    const c = window.Game && Game.canvas;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { x: ((cx - r.left) / r.width) * Game.W, y: ((cy - r.top) / r.height) * Game.H };
  },

  // A menu takes this frame's tap (if any); the tap then no longer counts as a plain Z press.
  takeTap() {
    const t = this.tapPos;
    if (t) { this.tapPos = null; delete this.pressed.ok; }
    return t;
  },

  // index of the option under point p (hits: [{ i, x, y, w, h }]; overlapping boxes go to the nearest centre), or -1
  hitIndex(hits, p) {
    if (!hits || !p) return -1;
    let best = -1, bd = Infinity;
    for (const h of hits) {
      if (p.x < h.x || p.x > h.x + h.w || p.y < h.y || p.y > h.y + h.h) continue;
      const d = Math.hypot(p.x - (h.x + h.w / 2), p.y - (h.y + h.h / 2));
      if (d < bd) { bd = d; best = h.i; }
    }
    return best;
  },

  // hit boxes for a column of n evenly spaced rows (the first row showing entry `first`)
  rowHits(n, x, y, w, pitch, first = 0) {
    const out = [];
    for (let j = 0; j < n; j++) out.push({ i: first + j, x, y: y + j * pitch, w, h: pitch });
    return out;
  },

  // Tap-to-select for menus: a tap on an option moves the cursor there and confirms it (as if Z was pressed).
  // With look = true (lists that describe the highlighted entry) the first tap only highlights it and
  // a tap on the highlighted entry confirms. Taps that miss every option do nothing.
  // Returns true when the tap is used up and the menu should skip the rest of its input this frame.
  tapSelect(o, hits, look, key = 'index') {
    const tap = this.takeTap();
    if (!tap) return false;
    const i = this.hitIndex(hits, tap);
    if (i < 0) return true;
    const moved = i !== o[key];
    o[key] = i;
    if (moved && look) { if (window.Sound) Sound.sfx('sfx_cursor', { volume: 0.5 }); return true; }
    this.pressed.ok = true;
    return false;
  },

  setDir(d) {
    for (const k of ['up', 'down', 'left', 'right']) this.touch[k] = false;
    this.touch[d] = true;
    this.ts.dir = d;
    this.ts.dirSince = performance.now();
    this._pressedQueue.add(d);
    this.lastDir = d;
    clearTimeout(this._releaseTimer);
  },

  // release the swiped direction; a quick flick is still held briefly so it counts as one step
  releaseDir(now) {
    const s = this.ts;
    const clear = () => { for (const k of ['up', 'down', 'left', 'right', 'run']) this.touch[k] = false; };
    s.dir = null;
    clearTimeout(this._releaseTimer);
    s.dist = 0;
    const held = performance.now() - (s.dirSince || 0);
    if (now || held >= 70) clear();
    else this._releaseTimer = setTimeout(clear, 70 - held);
  },

  // on-screen wording for the current control scheme
  isTouchUI() { return this.usingTouch || (this.touchDevice && !this._keyboardSeen); },
  hint(kind) {
    const T = {
      start: 'tap to start',
      line: 'swipe: walk (swipe further to run)  ·  tap: confirm / talk  ·  two-finger tap: back / menu',
      walk: 'Swipe to walk (swipe and hold to keep going). Tap to look at things and talk. Tap with two fingers to open the menu.',
      menu: 'Tap with two fingers to open the menu.',
      run: 'Swipe further to run.',
      sideways: 'Swipe and hold left or right.',
      again: 'tap',
    };
    const k = (a) => this.keysText(a, 1);
    const K = {
      start: 'press ' + this.keysText('ok'),
      line: `arrow keys: move  ·  ${k('ok')}: confirm  ·  ${k('cancel')}: cancel/menu  ·  ${k('run')}: run  ·  F4: fullscreen`,
      walk: `Arrow keys to walk. ${k('ok')} to look at things and talk. ${k('cancel')} opens the menu.`,
      menu: `Press ${k('cancel')} to open the menu.`,
      run: `Hold ${k('run').toUpperCase()} to run.`,
      sideways: '◀ ▶ to move.',
      again: 'press ' + k('ok'),
    };
    return (this.isTouchUI() ? T : K)[kind];
  },

  toggleFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement) { el.requestFullscreen && el.requestFullscreen().catch(() => {}); }
    else { document.exitFullscreen && document.exitFullscreen(); }
  },

  pollPad() {
    this.pad = {};
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const b = (i) => p.buttons[i] && p.buttons[i].pressed;
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (b(12) || ay < -0.5) this.pad.up = true;
      if (b(13) || ay > 0.5) this.pad.down = true;
      if (b(14) || ax < -0.5) this.pad.left = true;
      if (b(15) || ax > 0.5) this.pad.right = true;
      if (b(0)) this.pad.ok = true;
      if (b(1)) this.pad.cancel = true;
      if (b(2) || b(7)) this.pad.run = true;
      if (b(3) || b(9)) this.pad.menu = true;
    }
  },

  // called once at the start of every logic tick
  update() {
    this.pollPad();
    this.anyKeyThisFrame = !!this._anyQueued;
    this._anyQueued = false;
    this.tapPos = null;
    if (this._tapPending) { this.tapPos = this.toGame(this._tapPending[0], this._tapPending[1]); this._tapPending = null; }
    // touch: run only when a swipe is held far out for a moment (a quick flick is always one step)
    if (this.ts.dir) this.touch.run = (this.ts.dist || 0) >= this.RUN_DIST && performance.now() - this.ts.dirSince > 220;
    this.pressed = {};
    for (const a of this.ACTIONS) {
      const h = !!(this.down[a] || this.pad[a] || this.touch[a]);
      if (h && !this.held[a]) this.pressed[a] = true;
      if (this._pressedQueue.has(a)) this.pressed[a] = true;
      this.held[a] = h;
      this.heldFrames[a] = h ? (this.heldFrames[a] || 0) + 1 : 0;
    }
    this._pressedQueue.clear();
    if (!this.enabled) { this.pressed = {}; this.tapPos = null; }
  },

  isPressed(a) { return !!this.pressed[a]; },
  isHeld(a) { return this.enabled && !!this.held[a]; },
  // menu repeat: fires on press, then repeatedly while held
  repeat(a) {
    if (this.pressed[a]) return true;
    const f = this.heldFrames[a] || 0;
    return this.enabled && f > 18 && (f - 18) % 5 === 0;
  },
  consume(a) { delete this.pressed[a]; },
  clear() { this.pressed = {}; this._pressedQueue.clear(); this.tapPos = null; this._tapPending = null; },
  // forget every held key (after a browser dialog swallowed the key-up events)
  reset() { this.down = {}; this.pad = {}; this.releaseDir(true); this.clear(); },
  // direction currently held (last pressed wins, like RPG Maker 4-dir)
  dir4() {
    const order = ['up', 'down', 'left', 'right'];
    for (const d of order) if (this.pressed[d]) this.lastDir = d;
    if (this.lastDir && this.held[this.lastDir]) return this.enabled ? this.lastDir : null;
    for (const d of order) if (this.held[d]) { this.lastDir = d; return this.enabled ? d : null; }
    return null;
  },
};
window.Input = Input;
