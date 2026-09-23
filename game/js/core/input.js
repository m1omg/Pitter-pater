'use strict';
// ---------------------------------------------------------------------------
// Keyboard + gamepad input with edge detection and menu key-repeat.
// Actions: up down left right ok cancel run menu
// ---------------------------------------------------------------------------
const Input = {
  keyMap: {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    KeyZ: 'ok', Enter: 'ok', Space: 'ok', NumpadEnter: 'ok',
    KeyX: 'cancel', Escape: 'cancel', Backspace: 'cancel',
    ShiftLeft: 'run', ShiftRight: 'run',
    KeyC: 'menu', Tab: 'menu',
  },
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

  init() {
    window.addEventListener('keydown', (e) => {
      const a = this.keyMap[e.code];
      if (e.code === 'F4' || (e.code === 'Enter' && e.altKey)) { this.toggleFullscreen(); e.preventDefault(); return; }
      if (a) {
        if (!this.down[a]) this._pressedQueue.add(a);
        this.down[a] = true;
        e.preventDefault();
      }
      this._anyQueued = true;
      for (const l of this.listeners) l(e);
    });
    window.addEventListener('keyup', (e) => {
      const a = this.keyMap[e.code];
      if (a) { this.down[a] = false; e.preventDefault(); }
    });
    window.addEventListener('blur', () => { this.down = {}; });
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
    const actions = ['up', 'down', 'left', 'right', 'ok', 'cancel', 'run', 'menu'];
    this.pressed = {};
    for (const a of actions) {
      const h = !!(this.down[a] || this.pad[a]);
      if (h && !this.held[a]) this.pressed[a] = true;
      if (this._pressedQueue.has(a)) this.pressed[a] = true;
      this.held[a] = h;
      this.heldFrames[a] = h ? (this.heldFrames[a] || 0) + 1 : 0;
    }
    this._pressedQueue.clear();
    if (!this.enabled) { this.pressed = {}; }
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
  clear() { this.pressed = {}; this._pressedQueue.clear(); },
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
