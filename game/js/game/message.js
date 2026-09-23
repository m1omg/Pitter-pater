'use strict';
// ---------------------------------------------------------------------------
// Dialogue: rich text ({c:red}{/c} {shake} {wave} {big} {small} {p:20} {spd:2}),
// typewriter message window with portrait + name tag, and choice lists.
// ---------------------------------------------------------------------------
const TEXT_COLORS = {
  red: '#d94a4a', blue: '#3f7fd1', yellow: '#c98a00', green: '#3f9a4e', pink: '#d8578a',
  purple: '#7d59b5', grey: '#8a7f86', gray: '#8a7f86', orange: '#d9772b', white: '#ffffff', ink: '#3a2a30',
};

const RichText = {
  parse(str) {
    const out = [];
    const st = { color: null, fx: null, size: 1 };
    const stack = [];
    let i = 0;
    while (i < str.length) {
      const ch = str[i];
      if (ch === '{') {
        const j = str.indexOf('}', i);
        if (j > i) {
          const tag = str.slice(i + 1, j);
          i = j + 1;
          if (tag[0] === '/') {
            const name = tag.slice(1);
            if (name === 'c') st.color = null;
            else if (name === 'shake' || name === 'wave') st.fx = null;
            else if (name === 'big' || name === 'small') st.size = 1;
            continue;
          }
          const [name, arg] = tag.split(':');
          if (name === 'c') st.color = TEXT_COLORS[arg] || arg;
          else if (name === 'shake' || name === 'wave') st.fx = name;
          else if (name === 'big') st.size = 1.35;
          else if (name === 'small') st.size = 0.75;
          else if (name === 'p') out.push({ cmd: 'pause', n: arg ? +arg : 18 });
          else if (name === 'spd') out.push({ cmd: 'speed', v: +arg || 1 });
          continue;
        }
      }
      out.push({ ch, color: st.color, fx: st.fx, size: st.size });
      i++;
    }
    return out;
  },

  // Split parsed glyphs into pages of positioned glyphs.
  layout(ctx, items, maxW, baseSize, lineH, maxLines, font) {
    // group into words (keep commands attached to following glyph)
    const words = [];
    let cur = [];
    const flush = () => { if (cur.length) { words.push(cur); cur = []; } };
    for (const it of items) {
      if (it.cmd) { cur.push(it); continue; }
      if (it.ch === '\n') { flush(); words.push('\n'); continue; }
      cur.push(it);
      if (it.ch === ' ') flush();
    }
    flush();
    const measure = (g) => { Gfx.font(ctx, Math.round(baseSize * g.size), font); return ctx.measureText(g.ch).width; };
    const lines = [];
    let line = [], x = 0;
    for (const w of words) {
      if (w === '\n') { lines.push(line); line = []; x = 0; continue; }
      let ww = 0;
      for (const g of w) if (!g.cmd) ww += measure(g);
      const trailing = w.length && !w[w.length - 1].cmd && w[w.length - 1].ch === ' ' ? measure(w[w.length - 1]) : 0;
      if (x + ww - trailing > maxW && line.length) { lines.push(line); line = []; x = 0; }
      for (const g of w) {
        if (g.cmd) { line.push(g); continue; }
        const gw = measure(g);
        line.push(Object.assign({}, g, { x, w: gw }));
        x += gw;
      }
    }
    if (line.length) lines.push(line);
    const pages = [];
    for (let i = 0; i < lines.length; i += maxLines) {
      const page = [];
      lines.slice(i, i + maxLines).forEach((ln, li) => ln.forEach((g) => { if (!g.cmd) g.line = li; page.push(g); }));
      pages.push(page);
    }
    if (!pages.length) pages.push([]);
    return pages;
  },

  drawGlyph(ctx, g, x, y, t, baseSize, font, defColor, alpha = 1) {
    let dx = 0, dy = 0;
    if (g.fx === 'shake') { dx = (Math.random() - 0.5) * 2.4; dy = (Math.random() - 0.5) * 2.4; }
    else if (g.fx === 'wave') dy = Math.sin(t * 0.15 + g.x * 0.05) * 3;
    Gfx.font(ctx, Math.round(baseSize * g.size), font);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g.color || defColor;
    ctx.fillText(g.ch, x + g.x + dx, y + dy);
    ctx.globalAlpha = 1;
  },
};

// ---------------------------------------------------------------------------
const Msg = {
  isOpen: false,
  anim: 0,               // 0..1 open animation
  speaker: null,
  face: null,
  pages: [], page: 0, shown: 0, glyphCount: 0,
  speed: 1, pauseT: 0, acc: 0,
  resolve: null,
  closeTimer: 0,
  t: 0,
  box: { x: 36, y: 508, w: 888, h: 190 },
  blipCounter: 0,
  opts: {},

  // show a message; returns a promise resolved when the player dismisses it
  show(speaker, text, opts = {}) {
    return new Promise((resolve) => {
      if (!Game.hasOverlay(this)) { Game.pushOverlay(this); this.anim = 0; }
      else { // keep on top
        Game.removeOverlay(this); Game.overlays.push(this);
      }
      this.isOpen = true;
      this.hold = false;
      this.closeTimer = 0;
      this.speaker = speaker ? (CHARACTERS[speaker] || { name: speaker }) : null;
      this.speakerId = speaker;
      this.face = opts.face || 'neutral';
      this.opts = opts;
      const ctx = Game.ctx;
      const hasFace = this.portraitId() || (this.speaker && this.speaker.placeholderFace);
      const textX = hasFace ? 200 : 36;
      this.textX = textX;
      const maxW = this.box.w - textX - 34;
      this.pages = RichText.layout(ctx, RichText.parse(text), maxW, 30, 40, 3, Gfx.FONT);
      this.page = 0;
      this.startPage();
      this.resolve = resolve;
    });
  },

  release() { this.hold = false; this.closeTimer = 0; },

  portraitId() {
    if (!this.speaker || !this.speaker.faces) return null;
    return this.speaker.faces[this.face] || this.speaker.faces.neutral || null;
  },

  startPage() {
    this.shown = 0;
    this.acc = 0;
    this.pauseT = 0;
    this.cmdIndex = 0;
    this.speed = 1;
    this.items = this.pages[this.page];
    this.glyphCount = this.items.filter((g) => !g.cmd).length;
    this.pos = 0; // index into items incl. commands
  },

  pageDone() { return this.pos >= this.items.length; },

  update(active) {
    this.t++;
    if (!this.isOpen) {
      this.anim = Math.max(0, this.anim - 0.2);
      if (this.anim <= 0) Game.removeOverlay(this);
      return;
    }
    this.anim = Math.min(1, this.anim + 0.2);
    if (!this.resolve) {
      // waiting for another message; close if none arrives soon
      if (this.hold) return;
      if (++this.closeTimer > 2) this.isOpen = false;
      return;
    }
    if (!active) return;
    const txtSpd = (State.options && State.options.textSpeed) || 1;
    if (!this.pageDone()) {
      if (Input.isPressed('ok')) { this.pos = this.items.length; this.shown = this.glyphCount; Input.consume('ok'); return; }
      if (this.pauseT > 0) { this.pauseT--; if (!Input.isHeld('cancel')) return; }
      let budget = this.speed * txtSpd * (Input.isHeld('cancel') ? 4 : 1);
      if (txtSpd >= 9) budget = 999;
      this.acc += budget;
      while (this.acc >= 1 && !this.pageDone()) {
        const it = this.items[this.pos++];
        if (it.cmd === 'pause') { if (txtSpd < 9) { this.pauseT = it.n; this.acc = 0; break; } continue; }
        if (it.cmd === 'speed') { this.speed = it.v; continue; }
        this.shown++;
        this.acc -= 1;
        if (it.ch !== ' ' && this.blipCounter++ % 2 === 0) this.blip();
      }
      if (this.pageDone() && this.opts.autoResolve && this.page === this.pages.length - 1) {
        const r = this.resolve; this.resolve = null; this.hold = true; r();
      }
    } else if (this.opts.autoResolve && this.page === this.pages.length - 1) {
      const r = this.resolve; this.resolve = null; this.hold = true; r();
    } else if (Input.isPressed('ok')) {
      Input.consume('ok');
      if (this.page < this.pages.length - 1) { this.page++; this.startPage(); Sound.sfx('sfx_cursor', { volume: 0.4 }); }
      else {
        const r = this.resolve;
        this.resolve = null;
        this.closeTimer = 0;
        r();
      }
    }
  },

  blip() {
    const sp = this.speaker;
    const id = (sp && sp.voice) || 'sfx_blip';
    const pitch = (sp && sp.pitch) || 1;
    Sound.sfx(id, { volume: 0.45, pitch, vary: 0.06 });
  },

  draw(ctx) {
    if (this.anim <= 0) return;
    const b = this.box;
    const a = U.ease.outBack(this.anim);
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.anim * 1.5);
    ctx.translate(0, (1 - a) * 40);
    Gfx.box(ctx, b.x, b.y, b.w, b.h, {});
    // portrait
    const pid = this.portraitId();
    if (this.speaker && (pid || this.speaker.placeholderFace)) {
      const px = b.x + 20, py = b.y + 20, ps = 150;
      const bg = (this.speaker.faceBg && this.speaker.faceBg[this.face]) || this.speaker.color || '#f3e3d0';
      Gfx.roundRect(ctx, px, py, ps, ps, 14); ctx.fillStyle = bg; ctx.fill();
      const img = pid ? Assets.get(pid) : null;
      ctx.save();
      Gfx.roundRect(ctx, px, py, ps, ps, 14); ctx.clip();
      if (img) {
        const br = Math.sin(this.t * 0.05) * 0.012;
        ctx.drawImage(img, px + ps * br * 0.25, py - ps * br + 2, ps * (1 - br * 0.5), ps * (1 + br));
      }
      else Gfx.placeholder(ctx, px + 20, py + 20, ps - 40, ps - 40, this.speaker.name + ':' + this.face, this.speaker.color);
      ctx.restore();
      Gfx.roundRect(ctx, px, py, ps, ps, 14); ctx.lineWidth = 3; ctx.strokeStyle = Gfx.C.ink; ctx.stroke();
    }
    // name tag
    if (this.speaker && this.speaker.name && !this.opts.noName) {
      Gfx.tag(ctx, b.x + 16, b.y - 30, this.speaker.name, { fill: this.speaker.color || '#ffd9a8', size: 22 });
    }
    // text
    if (this.items) {
      const tx = b.x + this.textX, ty = b.y + 52;
      let n = 0;
      const col = this.opts.color || Gfx.C.ink;
      for (const g of this.items) {
        if (g.cmd) continue;
        if (n++ >= this.shown) break;
        RichText.drawGlyph(ctx, g, tx, ty + g.line * 40, this.t, 30, Gfx.FONT, col);
      }
      if (this.pageDone() && this.resolve) {
        const bob = Math.sin(this.t * 0.15) * 3;
        ctx.fillStyle = Gfx.C.ink;
        ctx.beginPath();
        const ax = b.x + b.w - 34, ay = b.y + b.h - 26 + bob;
        ctx.moveTo(ax - 9, ay - 6); ctx.lineTo(ax + 9, ay - 6); ctx.lineTo(ax, ay + 5); ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  },
};

// ---------------------------------------------------------------------------
// Choice list overlay. Resolves with the chosen index (or cancelIndex).
// ---------------------------------------------------------------------------
class ChoiceBox {
  constructor(options, o = {}) {
    this.options = options;
    this.index = o.index || 0;
    this.cancelIndex = o.cancel != null ? o.cancel : -1;
    this.t = 0;
    this.anim = 0;
    const ctx = Game.ctx;
    const w = Math.max(160, ...options.map((s) => Gfx.measure(ctx, s, 28, Gfx.FONT))) + 70;
    const h = options.length * 40 + 24;
    this.w = w; this.h = h;
    this.x = o.x != null ? o.x : Game.W - w - 40;
    this.y = o.y != null ? o.y : (Game.hasOverlay(Msg) && Msg.isOpen ? Msg.box.y - h - 18 : Game.H / 2 - h / 2);
    this.promise = new Promise((r) => (this.resolve = r));
  }
  update(active) {
    this.t++;
    this.anim = Math.min(1, this.anim + 0.2);
    if (!active) return;
    // taps right as the box appears were meant for the text before it
    if (this.t <= 14) Input.takeTap();
    else if (Input.tapSelect(this, Input.rowHits(this.options.length, this.x, this.y + 14, this.w, 40))) return;
    if (Input.repeat('up')) { this.index = (this.index + this.options.length - 1) % this.options.length; Sound.sfx('sfx_cursor', { volume: 0.5 }); }
    if (Input.repeat('down')) { this.index = (this.index + 1) % this.options.length; Sound.sfx('sfx_cursor', { volume: 0.5 }); }
    if (Input.isPressed('ok')) { Input.consume('ok'); Sound.sfx('sfx_confirm', { volume: 0.6 }); this.finish(this.index); }
    else if (Input.isPressed('cancel') && this.cancelIndex >= 0) { Input.consume('cancel'); Sound.sfx('sfx_cancel', { volume: 0.6 }); this.finish(this.cancelIndex); }
  }
  finish(i) { Game.removeOverlay(this); this.resolve(i); }
  draw(ctx) {
    const a = U.ease.outBack(this.anim);
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.anim * 1.4);
    ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
    ctx.scale(0.8 + 0.2 * a, 0.8 + 0.2 * a);
    ctx.translate(-this.x - this.w / 2, -this.y - this.h / 2);
    Gfx.box(ctx, this.x, this.y, this.w, this.h, {});
    this.options.forEach((s, i) => {
      const y = this.y + 16 + i * 40;
      if (i === this.index) {
        Gfx.roundRect(ctx, this.x + 12, y, this.w - 24, 36, 10);
        ctx.fillStyle = Gfx.C.select; ctx.fill();
        Gfx.cursor(ctx, this.x + 26, y + 18, this.t);
      }
      Gfx.text(ctx, s, this.x + 44, y + 27, { size: 28 });
    });
    ctx.restore();
  }
}
function choose(options, o) {
  const cb = new ChoiceBox(options, o);
  Game.pushOverlay(cb);
  return cb.promise;
}
window.Msg = Msg; window.RichText = RichText; window.ChoiceBox = ChoiceBox; window.choose = choose;
