'use strict';
// ---------------------------------------------------------------------------
// Character sprite drawing (overworld). Supports several sheet layouts and a
// procedural "paper doll" walk (bob + tilt + squash) so single-pose drawings
// still feel alive. Missing art falls back to a cute placeholder doll.
// Manifest layouts:
//   layout:'dirs4'      -> 4 columns: down, left, right, up
//   layout:'dirs3'      -> 3 columns: down, side(left), up   (right = mirrored)
//   layout:'walk'       -> rows: down,left,right,up ; cols: frames (idle = col 0)
//   layout:'single'     -> one image for every direction (flip:true mirrors for right)
// ---------------------------------------------------------------------------
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
      return { sx: i * cw, sy: 0, sw: cw, sh: H, flip: dir === 'right' };
    }
    if (lay === 'walk') {
      const rows = meta.rows || 4, cols = meta.cols || 3;
      const r = { down: 0, left: 1, right: 2, up: 3 }[dir] || 0;
      const cw = W / cols, ch = H / rows;
      return { sx: (frame % cols) * cw, sy: r * ch, sw: cw, sh: ch, flip: false };
    }
    return { sx: 0, sy: 0, sw: W, sh: H, flip: !!meta.flip && dir === 'right' };
  },

  // x,y = feet position (map pixels). o: {moving, phase, t, alpha, scale, tint, dh}
  draw(ctx, spriteId, x, y, dir, o = {}) {
    const meta = Assets.meta(spriteId);
    const img = spriteId ? Assets.get(spriteId) : null;
    const t = o.t || 0;
    let bob = 0, tilt = 0, sx = 1, sy = 1;
    if (o.moving) {
      const ph = o.phase || 0;
      bob = -Math.abs(Math.sin(ph)) * (o.bobAmp != null ? o.bobAmp : 5);
      tilt = Math.sin(ph) * 0.055;
      sy = 1 - 0.035 * Math.abs(Math.cos(ph));
      sx = 1 + 0.02 * Math.abs(Math.cos(ph));
    } else if (!o.still) {
      sy = 1 + Math.sin(t * 0.06 + (o.seed || 0)) * 0.014;
      sx = 1 - Math.sin(t * 0.06 + (o.seed || 0)) * 0.008;
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
      ctx.drawImage(img, fr.sx, fr.sy, fr.sw, fr.sh, -dw / 2, -dh * ay, dw, dh);
      if (o.flashA) {
        // white/red flash using a cached silhouette
        const sil = this.silhouette(spriteId, img, fr, o.flashColor || '#fff');
        ctx.globalAlpha *= o.flashA;
        ctx.drawImage(sil, -dw / 2, -dh * ay, dw, dh);
      }
    } else {
      this.placeholderDoll(ctx, spriteId, dir, o);
    }
    ctx.restore();
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
window.Sprites = Sprites;
