'use strict';
// ---------------------------------------------------------------------------
// Drawing helpers: hand-drawn paper boxes, wobbly lines, bars, icons, text.
// ---------------------------------------------------------------------------
const Gfx = {
  W: 960, H: 720,
  k: 1,                       // backing-store scale (set by engine)
  FONT: 'PatrickHand',
  UI: 'Sniglet',
  BOLD: 'SnigletBold',
  C: {
    ink: '#3a2a30',
    inkSoft: '#6b5559',
    paper: '#fff8ec',
    paper2: '#f6ead3',
    shadow: 'rgba(30,15,25,0.28)',
    hp: '#ef6f7c', hpBack: '#f7d4d4',
    pep: '#6cb7e6', pepBack: '#d4e9f6',
    gold: '#f2c14e',
    select: '#ffe39a',
    dim: 'rgba(20,12,24,0.55)',
    cheery: '#ffd166', gloomy: '#7fb2ec', huffy: '#ef6f5e',
    rainbow: '#b7e4a6', stormy: '#9b8ec4', heatwave: '#ff9e57', overwhelmed: '#b9aeb5', neutral: '#fff8ec',
    spooked: '#a9a3b8', sleepy: '#c8c2f0',
  },
  cache: new Map(),

  makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  },

  async loadFonts() {
    if (!window.FONT_DATA || !window.FontFace) return;
    const list = [];
    for (const fam of Object.keys(FONT_DATA)) {
      try {
        const ff = new FontFace(fam, `url(data:font/ttf;base64,${FONT_DATA[fam]})`);
        list.push(ff.load().then((f) => document.fonts.add(f)).catch(() => {}));
      } catch (e) { /* ignore */ }
    }
    await Promise.all(list);
    window.FONT_DATA = null;
  },

  font(ctx, size, fam) {
    ctx.font = `${size}px "${fam || this.FONT}", "Comic Sans MS", sans-serif`;
  },

  text(ctx, str, x, y, o = {}) {
    str = String(str);
    this.font(ctx, o.size || 26, o.font);
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.baseline || 'alphabetic';
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    if (o.shadow) {
      ctx.fillStyle = o.shadow === true ? 'rgba(0,0,0,0.3)' : o.shadow;
      ctx.fillText(str, x + 2, y + 2);
    }
    if (o.outline) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = o.outlineWidth || 5;
      ctx.strokeStyle = o.outline;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = o.color || this.C.ink;
    ctx.fillText(str, x, y);
    if (o.alpha != null) ctx.globalAlpha /= o.alpha;
  },

  measure(ctx, str, size, fam) {
    this.font(ctx, size, fam);
    return ctx.measureText(String(str)).width;
  },

  wrap(ctx, str, maxW, size, fam) {
    this.font(ctx, size, fam);
    const out = [];
    for (const para of String(str).split('\n')) {
      const words = para.split(' ');
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; }
        else line = test;
      }
      out.push(line);
    }
    return out;
  },

  roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  // points along a rounded rectangle perimeter, jittered with smooth noise
  wobblyRectPoints(x, y, w, h, r, amp, seed) {
    const pts = [];
    const step = 10;
    r = Math.min(r, w / 2, h / 2);
    const push = (px, py, i) => {
      const n1 = U.noise1(i * 0.35, seed) - 0.5, n2 = U.noise1(i * 0.35 + 99, seed) - 0.5;
      pts.push([px + n1 * amp * 2, py + n2 * amp * 2]);
    };
    let i = 0;
    const edge = (x1, y1, x2, y2) => {
      const len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.round(len / step));
      for (let s = 0; s < n; s++) push(x1 + ((x2 - x1) * s) / n, y1 + ((y2 - y1) * s) / n, i++);
    };
    const corner = (cx, cy, a0) => {
      const n = Math.max(2, Math.round((r * Math.PI) / 2 / step));
      for (let s = 0; s < n; s++) {
        const a = a0 + (s / n) * (Math.PI / 2);
        push(cx + Math.cos(a) * r, cy + Math.sin(a) * r, i++);
      }
    };
    edge(x + r, y, x + w - r, y); corner(x + w - r, y + r, -Math.PI / 2);
    edge(x + w, y + r, x + w, y + h - r); corner(x + w - r, y + h - r, 0);
    edge(x + w - r, y + h, x + r, y + h); corner(x + r, y + h - r, Math.PI / 2);
    edge(x, y + h - r, x, y + r); corner(x + r, y + r, Math.PI);
    return pts;
  },

  pathPoints(ctx, pts, closed = true) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      if (i < pts.length - 1 || closed) ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
      else ctx.lineTo(p[0], p[1]);
    }
    if (closed) ctx.closePath();
  },

  _grain: null,
  grain() {
    if (this._grain) return this._grain;
    const c = this.makeCanvas(160, 160), g = c.getContext('2d');
    const rnd = U.rng(1234);
    const img = g.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 200 + rnd() * 55;
      img.data[i] = v; img.data[i + 1] = v * 0.98; img.data[i + 2] = v * 0.94; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    g.globalAlpha = 0.18;
    g.strokeStyle = '#7a6a60';
    g.lineWidth = 0.7;
    for (let i = 0; i < 90; i++) {
      const x = rnd() * 160, y = rnd() * 160, a = rnd() * Math.PI, l = 4 + rnd() * 10;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    this._grain = c;
    return c;
  },
  grainPattern(ctx) {
    if (!this._grainPat || this._grainCtx !== ctx) { this._grainPat = ctx.createPattern(this.grain(), 'repeat'); this._grainCtx = ctx; }
    return this._grainPat;
  },

  // Paper panel with a sketchy outline. Cached per size/style/scale.
  box(ctx, x, y, w, h, o = {}) {
    const k = this.k;
    const style = o.style || 'paper';
    const key = `box|${w | 0}|${h | 0}|${style}|${o.fill || ''}|${o.border || ''}|${o.radius || ''}|${k}`;
    let c = this.cache.get(key);
    if (!c) {
      const pad = 12;
      c = this.makeCanvas((w + pad * 2) * k, (h + pad * 2) * k);
      const g = c.getContext('2d');
      g.scale(k, k);
      g.translate(pad, pad);
      const seed = (U.hash(key) % 1000) / 10;
      const r = o.radius != null ? o.radius : 14;
      const pts = this.wobblyRectPoints(0, 0, w, h, r, 1.1, seed);
      // shadow
      if (o.shadow !== false) {
        g.save(); g.translate(4, 5);
        this.pathPoints(g, pts); g.fillStyle = this.C.shadow; g.fill();
        g.restore();
      }
      // fill
      this.pathPoints(g, pts);
      let fill = o.fill || this.C.paper;
      if (style === 'dark') fill = o.fill || '#2e2433';
      g.fillStyle = fill; g.fill();
      g.save();
      g.clip();
      g.globalCompositeOperation = 'multiply';
      g.globalAlpha = style === 'dark' ? 0.25 : 0.55;
      g.fillStyle = this.grainPattern(g);
      g.fillRect(-4, -4, w + 8, h + 8);
      g.restore();
      // inner highlight
      g.save();
      g.globalAlpha = 0.5;
      g.strokeStyle = style === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)';
      g.lineWidth = 2;
      const inner = this.wobblyRectPoints(4, 4, w - 8, h - 8, Math.max(2, r - 4), 0.6, seed + 3);
      this.pathPoints(g, inner); g.stroke();
      g.restore();
      // outline (two passes for a pencil feel)
      g.lineJoin = 'round'; g.lineCap = 'round';
      g.strokeStyle = o.border || (style === 'dark' ? '#f4e9d8' : this.C.ink);
      g.lineWidth = o.lineWidth || 3;
      this.pathPoints(g, pts); g.stroke();
      g.globalAlpha = 0.35; g.lineWidth = 1.5;
      const pts2 = this.wobblyRectPoints(0.8, -0.6, w, h, r, 1.3, seed + 7);
      this.pathPoints(g, pts2); g.stroke();
      c._pad = pad;
      this.cache.set(key, c);
      if (this.cache.size > 400) this.cache.delete(this.cache.keys().next().value);
    }
    ctx.drawImage(c, x - c._pad, y - c._pad, c.width / k, c.height / k);
  },

  // simple label tag (for name boxes)
  tag(ctx, x, y, text, o = {}) {
    const size = o.size || 24;
    const w = Math.ceil(this.measure(ctx, text, size, o.font || this.BOLD)) + 28;
    const h = size + 16;
    this.box(ctx, x, y, w, h, { fill: o.fill || '#ffd9a8', radius: 10 });
    this.text(ctx, text, x + w / 2, y + h / 2 + size * 0.36, { size, font: o.font || this.BOLD, align: 'center', color: o.color || this.C.ink });
    return w;
  },

  bar(ctx, x, y, w, h, frac, fg, bg, o = {}) {
    frac = U.clamp(frac, 0, 1);
    this.roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = bg; ctx.fill();
    if (frac > 0) {
      ctx.save();
      this.roundRect(ctx, x, y, w, h, h / 2); ctx.clip();
      ctx.fillStyle = fg;
      ctx.fillRect(x, y, w * frac, h);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x, y + 1, w * frac, h * 0.35);
      if (o.ghost != null && o.ghost > frac) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(x + w * frac, y, w * (o.ghost - frac), h);
      }
      ctx.restore();
    }
    this.roundRect(ctx, x, y, w, h, h / 2);
    ctx.lineWidth = 2; ctx.strokeStyle = this.C.ink; ctx.stroke();
  },

  // bouncing pointer arrow
  cursor(ctx, x, y, t, dir = 'right', o = {}) {
    const bob = Math.sin(t * 0.18) * 3;
    ctx.save();
    ctx.translate(x + (dir === 'right' ? bob : dir === 'left' ? -bob : 0), y + (dir === 'down' ? bob : dir === 'up' ? -bob : 0));
    const rot = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[dir];
    ctx.rotate(rot);
    const s = o.size || 12;
    ctx.beginPath();
    ctx.moveTo(s, 0); ctx.lineTo(-s * 0.7, -s * 0.85); ctx.quadraticCurveTo(-s * 0.3, 0, -s * 0.7, s * 0.85); ctx.closePath();
    ctx.fillStyle = o.color || '#ff8fa3'; ctx.fill();
    ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.strokeStyle = this.C.ink; ctx.stroke();
    ctx.restore();
  },

  star(ctx, x, y, r1, r2, n = 5, rot = -Math.PI / 2) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? r2 : r1, a = rot + (i * Math.PI) / n;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  },

  drop(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.bezierCurveTo(x + s * 0.2, y - s * 0.5, x + s * 0.75, y - s * 0.05, x + s * 0.72, y + s * 0.35);
    ctx.arc(x, y + s * 0.35, s * 0.72, 0, Math.PI, false);
    ctx.bezierCurveTo(x - s * 0.75, y - s * 0.05, x - s * 0.2, y - s * 0.5, x, y - s);
    ctx.closePath();
  },

  cloud(ctx, x, y, s) {
    ctx.beginPath();
    ctx.arc(x - s * 0.55, y + s * 0.1, s * 0.42, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(x - s * 0.15, y - s * 0.25, s * 0.48, Math.PI, Math.PI * 1.9);
    ctx.arc(x + s * 0.4, y - s * 0.05, s * 0.45, Math.PI * 1.3, Math.PI * 0.5);
    ctx.closePath();
  },

  heartPath(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.8);
    ctx.bezierCurveTo(x - s * 1.2, y - s * 0.1, x - s * 0.6, y - s * 1.0, x, y - s * 0.35);
    ctx.bezierCurveTo(x + s * 0.6, y - s * 1.0, x + s * 1.2, y - s * 0.1, x, y + s * 0.8);
    ctx.closePath();
  },

  _ink(ctx, w = 2.2) { ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = this.C.ink; },

  // Procedural icons. (x, y) is the centre, s the radius-ish size.
  icon(ctx, name, x, y, s = 12, o = {}) {
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    const C = this.C;
    const ink = () => this._ink(ctx, Math.max(1.5, s * 0.16));
    switch (name) {
      case 'cheery':
      case 'sun': {
        ctx.fillStyle = '#ffd166';
        ink();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * s * 0.72, y + Math.sin(a) * s * 0.72);
          ctx.lineTo(x + Math.cos(a) * s * 1.05, y + Math.sin(a) * s * 1.05);
          ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(x, y, s * 0.55, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      }
      case 'gloomy':
      case 'rain': {
        ctx.fillStyle = '#7fb2ec'; ink();
        this.drop(ctx, x, y - s * 0.1, s * 0.85); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath(); ctx.ellipse(x - s * 0.25, y + s * 0.15, s * 0.12, s * 0.22, -0.4, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'huffy':
      case 'bolt': {
        ctx.fillStyle = '#ef6f5e'; ink();
        ctx.beginPath();
        ctx.moveTo(x + s * 0.25, y - s); ctx.lineTo(x - s * 0.55, y + s * 0.15); ctx.lineTo(x - s * 0.02, y + s * 0.15);
        ctx.lineTo(x - s * 0.3, y + s); ctx.lineTo(x + s * 0.6, y - s * 0.2); ctx.lineTo(x + s * 0.05, y - s * 0.2); ctx.closePath();
        ctx.fill(); ctx.stroke();
        break;
      }
      case 'rainbow': {
        const cols = ['#ef6f5e', '#ffd166', '#8fd18a', '#7fb2ec'];
        ctx.lineCap = 'butt';
        cols.forEach((c, i) => {
          ctx.strokeStyle = c; ctx.lineWidth = s * 0.2;
          ctx.beginPath(); ctx.arc(x, y + s * 0.45, s * (0.95 - i * 0.2), Math.PI, 0); ctx.stroke();
        });
        this._ink(ctx, Math.max(1.2, s * 0.1));
        ctx.beginPath(); ctx.arc(x, y + s * 0.45, s * 1.05, Math.PI, 0); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y + s * 0.45, s * 0.28, Math.PI, 0); ctx.stroke();
        break;
      }
      case 'stormy': {
        ctx.fillStyle = '#9b8ec4'; ink();
        this.cloud(ctx, x, y - s * 0.15, s * 0.95); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffd166';
        ctx.beginPath(); ctx.moveTo(x + s * 0.05, y + s * 0.2); ctx.lineTo(x - s * 0.25, y + s * 0.7); ctx.lineTo(x, y + s * 0.65);
        ctx.lineTo(x - s * 0.12, y + s * 1.05); ctx.lineTo(x + s * 0.3, y + s * 0.5); ctx.lineTo(x + s * 0.05, y + s * 0.52); ctx.closePath();
        ctx.fill(); this._ink(ctx, Math.max(1.2, s * 0.1)); ctx.stroke();
        break;
      }
      case 'heatwave': {
        ctx.fillStyle = '#ff9e57'; ink();
        ctx.beginPath();
        ctx.moveTo(x, y - s);
        ctx.bezierCurveTo(x + s * 0.5, y - s * 0.4, x + s * 0.9, y + s * 0.1, x + s * 0.55, y + s * 0.7);
        ctx.quadraticCurveTo(x, y + s * 1.05, x - s * 0.55, y + s * 0.7);
        ctx.bezierCurveTo(x - s * 0.9, y + s * 0.1, x - s * 0.3, y - s * 0.2, x, y - s);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffd166';
        ctx.beginPath(); ctx.ellipse(x, y + s * 0.45, s * 0.28, s * 0.38, 0, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'overwhelmed':
      case 'swirl': {
        ink(); ctx.strokeStyle = '#6b5a70';
        ctx.lineWidth = Math.max(1.8, s * 0.2);
        ctx.beginPath();
        for (let i = 0; i < 60; i++) {
          const a = i * 0.28, r = (i / 60) * s;
          const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
        break;
      }
      case 'spooked': {
        ctx.fillStyle = '#e9e4f2'; ink();
        ctx.beginPath();
        ctx.moveTo(x - s * 0.7, y + s * 0.9);
        ctx.lineTo(x - s * 0.7, y - s * 0.1);
        ctx.arc(x, y - s * 0.1, s * 0.7, Math.PI, 0);
        ctx.lineTo(x + s * 0.7, y + s * 0.9);
        ctx.lineTo(x + s * 0.35, y + s * 0.65); ctx.lineTo(x, y + s * 0.9); ctx.lineTo(x - s * 0.35, y + s * 0.65);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.ink;
        ctx.beginPath(); ctx.arc(x - s * 0.25, y - s * 0.1, s * 0.1, 0, 7); ctx.arc(x + s * 0.25, y - s * 0.1, s * 0.1, 0, 7); ctx.fill();
        break;
      }
      case 'sleepy': {
        this.text(ctx, 'z', x - s * 0.4, y + s * 0.5, { size: s * 1.3, font: this.BOLD, color: '#8b82d8', outline: '#fff', outlineWidth: 3 });
        this.text(ctx, 'z', x + s * 0.35, y - s * 0.1, { size: s * 0.9, font: this.BOLD, color: '#8b82d8', outline: '#fff', outlineWidth: 3 });
        break;
      }
      case 'heart': {
        ctx.fillStyle = '#ef6f7c'; ink();
        this.heartPath(ctx, x, y, s * 0.85); ctx.fill(); ctx.stroke();
        break;
      }
      case 'pep': {
        ctx.fillStyle = '#6cb7e6'; ink();
        this.star(ctx, x, y, s, s * 0.45, 4); ctx.fill(); ctx.stroke();
        break;
      }
      case 'marble': {
        const g = ctx.createRadialGradient(x - s * 0.3, y - s * 0.3, s * 0.1, x, y, s);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#9ad7e8'); g.addColorStop(1, '#4f8fb5');
        ctx.fillStyle = g; ink();
        ctx.beginPath(); ctx.arc(x, y, s * 0.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = s * 0.14;
        ctx.beginPath(); ctx.arc(x, y, s * 0.4, 0.5, 2.6); ctx.stroke();
        break;
      }
      case 'star': {
        ctx.fillStyle = o.color || '#ffd166'; ink();
        this.star(ctx, x, y, s, s * 0.45, 5); ctx.fill(); ctx.stroke();
        break;
      }
      case 'treat': {
        ctx.fillStyle = '#e8b27a'; ink();
        ctx.beginPath(); ctx.arc(x, y, s * 0.85, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#6b4131';
        for (const [dx, dy] of [[-0.35, -0.2], [0.25, -0.35], [0.1, 0.3], [-0.2, 0.35], [0.45, 0.15]]) {
          ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, s * 0.11, 0, 7); ctx.fill();
        }
        break;
      }
      case 'trinket': {
        ctx.fillStyle = '#ff9ec4'; ink();
        this.roundRect(ctx, x - s * 0.8, y - s * 0.55, s * 1.6, s * 1.35, s * 0.2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(x - s * 0.12, y - s * 0.55, s * 0.24, s * 1.35);
        ctx.beginPath(); ctx.ellipse(x - s * 0.3, y - s * 0.72, s * 0.3, s * 0.18, -0.4, 0, 7); ctx.ellipse(x + s * 0.3, y - s * 0.72, s * 0.3, s * 0.18, 0.4, 0, 7);
        ctx.fill(); ctx.stroke();
        break;
      }
      case 'key': {
        ctx.fillStyle = '#f2c14e'; ink();
        ctx.beginPath(); ctx.arc(x - s * 0.45, y, s * 0.42, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillRect(x - s * 0.05, y - s * 0.12, s * 1.0, s * 0.24); ctx.strokeRect(x - s * 0.05, y - s * 0.12, s * 1.0, s * 0.24);
        ctx.fillRect(x + s * 0.6, y, s * 0.2, s * 0.4); ctx.strokeRect(x + s * 0.6, y, s * 0.2, s * 0.4);
        break;
      }
      case 'sticker': {
        ctx.fillStyle = '#b8e0a8'; ink();
        this.star(ctx, x, y, s, s * 0.62, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, s * 0.35, 0, 7); ctx.fill();
        break;
      }
      case 'photo': {
        ctx.fillStyle = '#fffdf5'; ink();
        ctx.save(); ctx.translate(x, y); ctx.rotate(-0.12);
        ctx.fillRect(-s * 0.8, -s * 0.9, s * 1.6, s * 1.8); ctx.strokeRect(-s * 0.8, -s * 0.9, s * 1.6, s * 1.8);
        ctx.fillStyle = '#9fc9e6'; ctx.fillRect(-s * 0.6, -s * 0.7, s * 1.2, s * 1.1);
        ctx.restore();
        break;
      }
      default: {
        ctx.fillStyle = '#ddd'; ink();
        ctx.beginPath(); ctx.arc(x, y, s * 0.8, 0, 7); ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
  },

  moodColor(m) { return this.C[m] || this.C.neutral; },

  vignette(ctx, strength = 0.35, color = '0,0,0') {
    const key = 'vig|' + strength + '|' + color + '|' + this.k;
    let c = this.cache.get(key);
    if (!c) {
      c = this.makeCanvas(this.W * this.k / 2, this.H * this.k / 2);
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.35, c.width / 2, c.height / 2, c.width * 0.62);
      grd.addColorStop(0, `rgba(${color},0)`);
      grd.addColorStop(1, `rgba(${color},${strength})`);
      g.fillStyle = grd; g.fillRect(0, 0, c.width, c.height);
      this.cache.set(key, c);
    }
    ctx.drawImage(c, 0, 0, this.W, this.H);
  },

  // Placeholder art for missing images: a cute blob with a label.
  placeholder(ctx, x, y, w, h, label, color) {
    ctx.save();
    const col = color || '#' + ((U.hash(label) & 0x7f7f7f) | 0x808080).toString(16).padStart(6, '0');
    this.roundRect(ctx, x, y, w, h, Math.min(w, h) * 0.35);
    ctx.fillStyle = col; ctx.fill();
    this._ink(ctx, 2); ctx.stroke();
    ctx.fillStyle = this.C.ink;
    const ey = y + h * 0.4;
    ctx.beginPath(); ctx.arc(x + w * 0.36, ey, Math.max(1.5, w * 0.05), 0, 7); ctx.arc(x + w * 0.64, ey, Math.max(1.5, w * 0.05), 0, 7); ctx.fill();
    if (w > 60) this.text(ctx, label, x + w / 2, y + h - 8, { size: 14, align: 'center', color: this.C.ink });
    ctx.restore();
  },
};
window.Gfx = Gfx;
