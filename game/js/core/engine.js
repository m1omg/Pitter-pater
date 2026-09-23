'use strict';
// ---------------------------------------------------------------------------
// Main loop, scene + overlay stack, timing promises, tweens, screen effects.
// ---------------------------------------------------------------------------
const Game = {
  W: 960, H: 720,
  canvas: null, ctx: null, k: 1,
  scene: null,
  overlays: [],
  frame: 0,
  playTime: 0,           // seconds of actual play (counted by the map scene)
  waiters: [],
  tweens: [],
  fadeA: 0, fadeColor: '#000',
  _fadeAnim: null,
  shakeP: 0, shakeT: 0, shakeMax: 1,
  flashA: 0, flashColor: '#fff', flashDecay: 0.05,
  errors: [],
  showFps: false, _fps: 60, _fpsAcc: 0, _fpsFrames: 0,

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F3') this.showFps = !this.showFps;
      if (e.code === 'F2') { this.debugGrid = !this.debugGrid; e.preventDefault(); }
    });
    this._last = performance.now();
    this._acc = 0;
    requestAnimationFrame((t) => this.loop(t));
  },

  resize() {
    const ww = window.innerWidth, wh = window.innerHeight;
    const fit = Math.min(ww / this.W, wh / this.H);
    this.canvas.style.width = Math.floor(this.W * fit) + 'px';
    this.canvas.style.height = Math.floor(this.H * fit) + 'px';
    const dpr = window.devicePixelRatio || 1;
    const k = U.clamp(Math.round(fit * dpr * 4) / 4, 1, Input.touchDevice ? 1.5 : 2);
    if (k !== this.k || this.canvas.width !== Math.round(this.W * k)) {
      this.k = k;
      this.canvas.width = Math.round(this.W * k);
      this.canvas.height = Math.round(this.H * k);
      Gfx.k = k;
      Gfx.cache.clear();
      Gfx._grainPat = null;
    }
  },

  loop(t) {
    const dt = Math.min(250, t - this._last);
    this._last = t;
    this._acc += dt;
    this._fpsAcc += dt; this._fpsFrames++;
    if (this._fpsAcc > 500) { this._fps = (this._fpsFrames * 1000) / this._fpsAcc; this._fpsAcc = 0; this._fpsFrames = 0; }
    const step = 1000 / 60;
    let n = 0;
    while (this._acc >= step && n < 5) {
      this.safe(() => this.update());
      this._acc -= step;
      n++;
    }
    if (n === 5) this._acc = 0;
    this.safe(() => this.draw());
    requestAnimationFrame((tt) => this.loop(tt));
  },

  safe(fn) {
    try { fn(); }
    catch (e) {
      console.error(e);
      if (this.errors.length < 5) this.errors.push(String(e && e.stack || e).split('\n').slice(0, 3).join(' | '));
    }
  },

  update() {
    this.frame++;
    Input.update();
    // frame waiters
    if (this.waiters.length) {
      const ready = [];
      this.waiters = this.waiters.filter((w) => { w.n--; if (w.n <= 0) { ready.push(w.resolve); return false; } return true; });
      ready.forEach((r) => r());
    }
    // tweens
    if (this.tweens.length) {
      this.tweens = this.tweens.filter((tw) => {
        tw.t++;
        const p = Math.min(1, tw.t / tw.n), e = tw.ease(p);
        for (const k in tw.to) tw.obj[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * e;
        if (p >= 1) { tw.resolve(); return false; }
        return true;
      });
    }
    // fade
    if (this._fadeAnim) {
      const f = this._fadeAnim;
      f.t++;
      this.fadeA = U.lerp(f.from, f.to, Math.min(1, f.t / f.n));
      if (f.t >= f.n) { this._fadeAnim = null; f.resolve(); }
    }
    if (this.shakeT > 0) this.shakeT--;
    if (this.flashA > 0) this.flashA = Math.max(0, this.flashA - this.flashDecay);
    const top = this.overlays[this.overlays.length - 1];
    if (this.scene) this.scene.update();
    // overlays update after the scene so they get first claim on this frame's input
    for (let i = this.overlays.length - 1; i >= 0; i--) {
      const o = this.overlays[i];
      if (o.update) o.update(o === top);
    }
  },

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#16131a';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.save();
    if (this.shakeT > 0) {
      const p = this.shakeP * (this.shakeT / this.shakeMax);
      ctx.translate((Math.random() * 2 - 1) * p, (Math.random() * 2 - 1) * p);
    }
    if (this.scene) this.scene.draw(ctx);
    ctx.restore();
    for (const o of this.overlays) { ctx.save(); o.draw(ctx); ctx.restore(); }
    if (this.flashA > 0) {
      ctx.globalAlpha = this.flashA;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.globalAlpha = 1;
    }
    if (this.fadeA > 0) {
      ctx.globalAlpha = U.clamp(this.fadeA, 0, 1);
      ctx.fillStyle = this.fadeColor;
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.globalAlpha = 1;
    }
    const ts = Input.ts;
    if (State.options.touchStick && Input.usingTouch && ts.id != null && !ts.multi && ts.moved) this.drawTouchStick(ctx, ts);
    if (this.showFps) Gfx.text(ctx, Math.round(this._fps) + ' fps  k=' + this.k, 8, 20, { size: 16, color: '#fff', outline: '#000', outlineWidth: 3 });
    if (this.errors.length) {
      ctx.fillStyle = 'rgba(120,0,0,0.85)';
      ctx.fillRect(0, this.H - 22 * this.errors.length - 8, this.W, 22 * this.errors.length + 8);
      this.errors.forEach((e, i) => Gfx.text(ctx, e.slice(0, 150), 6, this.H - 22 * (this.errors.length - i) + 12, { size: 14, color: '#fff', font: 'monospace' }));
    }
  },

  // faint "virtual stick" under the thumb while swiping
  drawTouchStick(ctx, ts) {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width) return;
    const sx = this.W / r.width, sy = this.H / r.height;
    const ax = (ts.x0 - r.left) * sx, ay = (ts.y0 - r.top) * sy;
    const fx = (ts.x - r.left) * sx, fy = (ts.y - r.top) * sy;
    const R = Input.MAXR * sx;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff8ec';
    ctx.fillStyle = 'rgba(255,248,236,0.18)';
    ctx.beginPath(); ctx.arc(ax, ay, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = Input.touch.run ? '#ffb8c6' : '#fff8ec';
    ctx.beginPath(); ctx.arc(fx, fy, R * 0.38, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = Gfx.C.ink; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  },

  setScene(s) {
    if (this.scene && this.scene.exit) this.scene.exit();
    this.scene = s;
    if (s && s.enter) s.enter();
  },

  pushOverlay(o) { this.overlays.push(o); if (o.open) o.open(); return o; },
  removeOverlay(o) { const i = this.overlays.indexOf(o); if (i >= 0) this.overlays.splice(i, 1); },
  hasOverlay(o) { return this.overlays.includes(o); },
  topOverlay() { return this.overlays[this.overlays.length - 1] || null; },

  wait(n = 1) {
    n = Math.max(1, Math.round(n));
    return new Promise((resolve) => this.waiters.push({ n, resolve }));
  },
  waitSec(s) { return this.wait(s * 60); },

  tween(obj, to, frames, ease = U.ease.outQuad) {
    return new Promise((resolve) => {
      const from = {};
      for (const k in to) from[k] = obj[k];
      this.tweens.push({ obj, to, from, n: Math.max(1, frames), t: 0, ease, resolve });
    });
  },
  killTweens(obj) { this.tweens = this.tweens.filter((t) => t.obj !== obj); },

  fadeTo(alpha, frames = 20, color) {
    if (color) this.fadeColor = color;
    if (this._fadeAnim) { this._fadeAnim.resolve(); this._fadeAnim = null; }
    if (frames <= 0) { this.fadeA = alpha; return Promise.resolve(); }
    return new Promise((resolve) => { this._fadeAnim = { from: this.fadeA, to: alpha, n: frames, t: 0, resolve }; });
  },
  fadeOut(frames = 20, color = '#000') { return this.fadeTo(1, frames, color); },
  fadeIn(frames = 20) { return this.fadeTo(0, frames); },

  shake(power = 6, frames = 16) { this.shakeP = power; this.shakeT = frames; this.shakeMax = frames; },
  flash(color = '#fff', alpha = 0.8, frames = 16) { this.flashColor = color; this.flashA = alpha; this.flashDecay = alpha / Math.max(1, frames); },
};
window.Game = Game;
