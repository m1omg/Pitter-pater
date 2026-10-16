'use strict';
// ---------------------------------------------------------------------------
// Character sprite drawing (overworld). Supports several sheet layouts and a
// procedural "paper doll" walk (bob + tilt + squash) so single-pose drawings
// still feel alive. Sprites with a walk rig (RIGS, content/rigs.js) take real
// steps instead: their legs are cut out of the drawing and lift and swing in
// turn while the body dips a little at each footfall.
// Missing art falls back to a cute placeholder doll.
// Manifest layouts:
//   layout:'dirs4'      -> 4 columns: down, left, right, up
//   layout:'dirs3'      -> 3 columns: down, side(left), up   (right = mirrored)
//   layout:'walk'       -> rows: down,left,right,up ; cols: frames (idle = col 0)
//   layout:'single'     -> one image for every direction (flip:true mirrors for right)
// ---------------------------------------------------------------------------
const RIGS = {};
const Sprites = {
  frameRect(meta, dir, frame) {
    const img = Assets.images[meta._id];
    const W = img.width, H = img.height;
    const lay = meta.layout || 'single';
    if (lay === 'dirs4') {
      const i = { down: 0, left: 1, right: 2, up: 3 }[dir] || 0;
      const cw = W / 4;
      return { sx: i * cw, sy: 0, sw: cw, sh: H, flip: false };
    }
    if (lay === 'dirs3') {
      const i = { down: 0, left: 1, right: 1, up: 2 }[dir] || 0;
      const cw = W / 3;
      return { sx: i * cw, sy: 0, sw: cw, sh: H, flip: dir === 'right', cell: i };
    }
    if (lay === 'walk') {
      const rows = meta.rows || 4, cols = meta.cols || 3;
      const r = { down: 0, left: 1, right: 2, up: 3 }[dir] || 0;
      const cw = W / cols, ch = H / rows;
      return { sx: (frame % cols) * cw, sy: r * ch, sw: cw, sh: ch, flip: false };
    }
    return { sx: 0, sy: 0, sw: W, sh: H, flip: !!meta.flip && dir === 'right' };
  },

  // x,y = feet position (map pixels). o: {walk (0..1, or moving), phase, run (0..1), t, alpha, scale, tint, dh}
  draw(ctx, spriteId, x, y, dir, o = {}) {
    const meta = Assets.meta(spriteId);
    const img = spriteId ? Assets.get(spriteId) : null;
    const t = o.t || 0;
    const walk = o.walk != null ? o.walk : o.moving ? 1 : 0;
    const rig = walk > 0 && img && meta && !o.flashA ? RIGS[spriteId] : null;
    let bob = 0, tilt = 0, sx = 1, sy = 1;
    if (walk > 0 && !rig) {
      const ph = o.phase || 0;
      bob = -Math.abs(Math.sin(ph)) * (o.bobAmp != null ? o.bobAmp : 5) * walk;
      tilt = Math.sin(ph) * 0.055 * walk;
      sy = 1 - 0.035 * Math.abs(Math.cos(ph)) * walk;
      sx = 1 + 0.02 * Math.abs(Math.cos(ph)) * walk;
    }
    if (walk < 1 && !o.still) {
      const b = Math.sin(t * 0.06 + (o.seed || 0)) * (1 - walk);
      sy *= 1 + b * 0.014;
      sx *= 1 - b * 0.008;
    }
    if (o.hop) bob -= o.hop;
    const scale = o.scale || 1;
    // shadow
    if (o.shadow !== false) {
      ctx.save();
      ctx.globalAlpha = 0.2 * (o.alpha != null ? o.alpha : 1);
      ctx.fillStyle = '#2a1a2a';
      const sw = (o.shadowW || 18) * scale * (1 + bob * 0.01);
      ctx.beginPath(); ctx.ellipse(x, y - 2, sw, sw * 0.36, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.translate(x, y + bob);
    ctx.rotate(tilt + (o.rot || 0));
    ctx.scale(sx * scale, sy * scale);
    if (img && meta) {
      meta._id = spriteId;
      const fr = this.frameRect(meta, dir, o.frame || 0);
      const dh = o.dh || meta.dh || 84;
      const dw = dh * (fr.sw / fr.sh);
      const ay = meta.ay != null ? meta.ay : 1;
      if (fr.flip) ctx.scale(-1, 1);
      const pose = rig && fr.cell != null && rig.poses[fr.cell];
      if (pose) {
        // work in sheet pixels of this direction's cell from here on
        ctx.translate(-dw / 2, -dh * ay);
        ctx.scale(dh / fr.sh, dh / fr.sh);
        this.drawRigged(ctx, spriteId, img, fr, rig, pose, walk, o);
      } else {
        ctx.drawImage(img, fr.sx, fr.sy, fr.sw, fr.sh, -dw / 2, -dh * ay, dw, dh);
        if (o.flashA) {
          // white/red flash using a cached silhouette
          const sil = this.silhouette(spriteId, img, fr, o.flashColor || '#fff');
          ctx.globalAlpha *= o.flashA;
          ctx.drawImage(sil, -dw / 2, -dh * ay, dw, dh);
        }
      }
    } else {
      this.placeholderDoll(ctx, spriteId, dir, o);
    }
    ctx.restore();
  },

  // One step of a rigged walk. Phase 0 and PI are footfalls (both feet down, body lowest); in between, one
  // leg swings through lifted while the other carries the body. Front and back views lift the legs in turn
  // and sway the body over the standing one; the side view swings them from the hip and leans into the walk.
  drawRigged(ctx, id, img, fr, rig, pose, walk, o) {
    const P = this.rigParts(id, img, fr, pose);
    const side = fr.cell === 1, deg = Math.PI / 180;
    const k = walk * (1 + (o.run || 0) * 0.3);   // running: bigger steps
    const ph = (o.phase || 0) + (o.seed || 0);
    const dip = (rig.bob || 0) * k * Math.cos(ph) ** 2;
    const sway = side ? 0 : (rig.sway || 0) * k * Math.sin(ph);
    const lean = side ? -(rig.lean || 0) * deg * k * (1 + (o.run || 0)) : 0;
    const [hx, hy] = pose.hip;
    const attach = (g) => {   // move with the body: dip, sway, and lean around the hip
      g.translate(sway, dip);
      if (lean) { g.translate(hx, hy); g.rotate(lean); g.translate(-hx, -hy); }
    };
    const leg = (L, c) => {
      const a = ph + (L.ph ? Math.PI : 0);
      const lift = (rig.lift || 0) * k * Math.max(0, Math.sin(a));
      const th = side ? -(rig.swing || 0) * deg * k * Math.cos(a) : 0;   // back at its footfall, forward by the next
      ctx.save();
      if (th) {
        // swing from the hip (positive = forward), lowered so the standing foot stays on the ground
        const [px, py] = L.pivot || pose.hip;
        ctx.translate(px, py + (c.foot - py) * (1 - Math.cos(th)));
        ctx.rotate(th);
        ctx.translate(-px, -py);
      }
      ctx.translate(0, -lift);
      ctx.drawImage(c.c, c.x, c.y);
      ctx.restore();
    };
    const part = (X, c) => {   // something carried (an umbrella): rides with the body, swings from its pivot
      ctx.save();
      attach(ctx);
      const [px, py] = X.pivot;
      ctx.translate(px, py - (rig.bob || 0) * k * (X.raise || 0));
      // side view: back and forth with the stride; front and back: side to side with the sway
      ctx.rotate((X.swing || 0) * deg * k * (side ? Math.cos(ph - (X.lag || 0)) : Math.sin(ph - (X.lag || 0))));
      ctx.translate(-px, -py);
      ctx.drawImage(c.c, c.x, c.y);
      ctx.restore();
    };
    pose.legs.forEach((L, i) => { if (L.far) leg({ ph: !L.ph, pivot: L.pivot }, P.far[i]); });
    pose.legs.forEach((L, i) => { if (L.back) leg(L, P.legs[i]); });
    pose.legs.forEach((L, i) => { if (!L.back) leg(L, P.legs[i]); });
    ctx.save();
    attach(ctx);
    ctx.drawImage(P.body, 0, 0);
    ctx.restore();
    (pose.parts || []).forEach((X, i) => part(X, P.parts[i]));
  },

  // The pieces of a rigged pose, cut once: the body with every leg and part taken out, and each leg and
  // part on its own. A leg's top row is stretched upward under the body, so a swinging leg never shows
  // a gap at the hip. A far leg (side view) is a darker copy of the near one, stepping out of turn.
  _rig: {},
  rigParts(id, img, fr, pose) {
    const key = id + '|' + fr.cell;
    if (this._rig[key]) return this._rig[key];
    const path = (g, poly) => { g.beginPath(); poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
    const piece = (poly, ext, shade) => {
      const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
      const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0;
      const c = Gfx.makeCanvas(w, h + ext), g = c.getContext('2d');
      g.save();
      g.translate(-x0, ext - y0);
      path(g, poly);
      g.clip();
      g.drawImage(img, fr.sx, fr.sy, fr.sw, fr.sh, 0, 0, fr.sw, fr.sh);
      g.restore();
      if (ext) {
        // the stretched rows stay inside the drawing's own outline, so they never stick out past the body
        g.imageSmoothingEnabled = false;
        g.drawImage(c, 0, ext + 1, w, 1, 0, 0, w, ext);
        g.save();
        g.beginPath(); g.rect(0, 0, w, ext); g.clip();
        g.globalCompositeOperation = 'destination-in';
        g.drawImage(img, fr.sx + x0, fr.sy + y0 - ext, w, ext, 0, 0, w, ext);
        g.restore();
      }
      if (shade) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(46,26,52,0.3)'; g.fillRect(0, 0, w, h + ext); }
      return { c, x: x0, y: y0 - ext, foot: y0 + h - 2 };
    };
    const body = Gfx.makeCanvas(fr.sw, fr.sh), g = body.getContext('2d');
    g.drawImage(img, fr.sx, fr.sy, fr.sw, fr.sh, 0, 0, fr.sw, fr.sh);
    g.globalCompositeOperation = 'destination-out';
    for (const X of [...pose.legs, ...(pose.parts || [])]) { path(g, X.poly); g.fill(); }
    return (this._rig[key] = {
      body,
      legs: pose.legs.map((L) => piece(L.poly, 12)),
      far: pose.legs.map((L) => (L.far ? piece(L.poly, 12, true) : null)),
      parts: (pose.parts || []).map((X) => piece(X.poly, 0)),
    });
  },

  _sil: {},
  silhouette(id, img, fr, color) {
    const key = id + '|' + fr.sx + '|' + fr.sy + '|' + color;
    if (this._sil[key]) return this._sil[key];
    const c = Gfx.makeCanvas(fr.sw, fr.sh), g = c.getContext('2d');
    if (fr.flip) { g.translate(fr.sw, 0); g.scale(-1, 1); }
    g.drawImage(img, fr.sx, fr.sy, fr.sw, fr.sh, 0, 0, fr.sw, fr.sh);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color; g.fillRect(0, 0, fr.sw, fr.sh);
    this._sil[key] = c;
    return c;
  },

  placeholderDoll(ctx, id, dir, o) {
    const ch = (window.CHARACTERS && CHARACTERS[(id || '').replace(/^chr_/, '')]) || null;
    const col = (ch && ch.color) || '#' + ((U.hash(id || 'x') & 0x7f7f7f) | 0x808080).toString(16).padStart(6, '0');
    const h = o.dh || 70;
    ctx.lineWidth = 2.5; ctx.strokeStyle = Gfx.C.ink; ctx.lineJoin = 'round';
    // body
    Gfx.roundRect(ctx, -13, -h * 0.55, 26, h * 0.5, 9);
    ctx.fillStyle = col; ctx.fill(); ctx.stroke();
    // head
    ctx.beginPath(); ctx.arc(0, -h * 0.7, h * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe9d9'; ctx.fill(); ctx.stroke();
    if (dir !== 'up') {
      const ex = dir === 'left' ? -5 : dir === 'right' ? 5 : 0;
      ctx.fillStyle = Gfx.C.ink;
      ctx.beginPath();
      ctx.arc(ex - 5, -h * 0.7, 2.2, 0, 7); ctx.arc(ex + 5, -h * 0.7, 2.2, 0, 7); ctx.fill();
    }
  },
};
window.Sprites = Sprites; window.RIGS = RIGS;
