'use strict';
// ---------------------------------------------------------------------------
// Procedural "hand-drawn" ground materials. Each map's tile legend maps a
// character to a material (+ optional colour overrides). The ground is painted
// once per map into an offscreen canvas: soft materials get blobby edges and
// an ink outline, hard ones straight edges. A paper-grain pass unifies it all.
// ---------------------------------------------------------------------------
const TS = 48; // tile size (logical px)

const Materials = {
  defs: {},
  def(id, d) { this.defs[id] = Object.assign({ walk: true, soft: false, z: 1, outline: null }, d); },

  patternCanvas(id, opt) {
    const d = this.defs[id];
    const size = d.tile || 96;
    const c = Gfx.makeCanvas(size, size);
    const g = c.getContext('2d');
    const rnd = U.rng(U.hash(id + JSON.stringify(opt || {})));
    d.pattern(g, size, Object.assign({}, d.colors || {}, opt || {}), rnd);
    return c;
  },

  // mask of tiles (array of [x,y]) into a canvas the size of the map
  mask(W, H, tiles, soft, seed) {
    const c = Gfx.makeCanvas(W * TS, H * TS), g = c.getContext('2d');
    g.fillStyle = '#000';
    const rnd = U.rng(seed || 7);
    for (const [x, y] of tiles) g.fillRect(x * TS, y * TS, TS, TS);
    if (soft) {
      for (const [x, y] of tiles) {
        const r = TS * (0.52 + rnd() * 0.12);
        g.beginPath(); g.arc(x * TS + TS / 2 + (rnd() - 0.5) * 6, y * TS + TS / 2 + (rnd() - 0.5) * 6, r, 0, Math.PI * 2); g.fill();
      }
      return this.smooth(c);
    }
    return c;
  },

  // Round off stair-stepped tile edges: blur the mask, then threshold it again.
  smooth(c) {
    const out = Gfx.makeCanvas(c.width, c.height), g = out.getContext('2d');
    if (!('filter' in g)) return c;
    g.filter = 'blur(10px)';
    g.drawImage(c, 0, 0);
    g.filter = 'none';
    try {
      const id = g.getImageData(0, 0, out.width, out.height), d = id.data;
      for (let i = 3; i < d.length; i += 4) {
        const a = d[i];
        d[i] = a < 100 ? 0 : a > 140 ? 255 : Math.round(((a - 100) / 40) * 255); // soft 1-2px anti-aliased edge
      }
      g.putImageData(id, 0, 0);
    } catch (e) { return c; }
    return out;
  },

  tinted(src, color) {
    const c = Gfx.makeCanvas(src.width, src.height), g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    return c;
  },

  // Paint a whole map ground. Returns a canvas.
  paintGround(map) {
    const W = map.w, H = map.h;
    const ground = Gfx.makeCanvas(W * TS, H * TS);
    const g = ground.getContext('2d');
    g.fillStyle = map.voidColor || '#241c2b';
    g.fillRect(0, 0, ground.width, ground.height);
    if (map.paintVoid) map.paintVoid(g, map);
    // group tiles by legend char
    const groups = {};
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ch = map.tiles[y][x];
      (groups[ch] = groups[ch] || []).push([x, y]);
    }
    const entries = Object.keys(groups).map((ch) => {
      const L = map.legendFull[ch];
      return { ch, L, d: this.defs[L.mat], tiles: groups[ch] };
    }).filter((e) => e.d && e.L.mat !== 'void');
    entries.sort((a, b) => (a.L.z != null ? a.L.z : a.d.z) - (b.L.z != null ? b.L.z : b.d.z));
    for (const e of entries) {
      const soft = e.L.soft != null ? e.L.soft : e.d.soft;
      const m = this.mask(W, H, e.tiles, soft, U.hash(map.id + e.ch));
      const outline = e.L.outline !== undefined ? e.L.outline : e.d.outline;
      if (outline) {
        const tint = this.tinted(m, outline);
        const r = e.L.outlineW || 3;
        for (let a = 0; a < 12; a++) {
          const ang = (a / 12) * Math.PI * 2;
          g.drawImage(tint, Math.cos(ang) * r, Math.sin(ang) * r);
        }
      }
      // fill with pattern, clipped to mask
      const layer = Gfx.makeCanvas(W * TS, H * TS), lg = layer.getContext('2d');
      if (e.d.paintRegion) e.d.paintRegion(lg, e.tiles, map, Object.assign({}, e.d.colors || {}, e.L));
      else {
        const pat = lg.createPattern(this.patternCanvas(e.L.mat, e.L), 'repeat');
        lg.fillStyle = pat; lg.fillRect(0, 0, layer.width, layer.height);
      }
      lg.globalCompositeOperation = 'destination-in';
      lg.drawImage(m, 0, 0);
      g.drawImage(layer, 0, 0);
      if (e.d.after) e.d.after(g, e.tiles, map, Object.assign({}, e.d.colors || {}, e.L));
    }
    if (map.paint) map.paint(g, map);
    // paper grain
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = map.grain != null ? map.grain : 0.45;
    g.fillStyle = g.createPattern(Gfx.grain(), 'repeat');
    g.fillRect(0, 0, ground.width, ground.height);
    g.restore();
    return ground;
  },
};

// ---- pattern helpers ----
function speckle(g, size, rnd, color, n, r = 1.2, alpha = 0.35) {
  g.fillStyle = color;
  g.globalAlpha = alpha;
  for (let i = 0; i < n; i++) { g.beginPath(); g.arc(rnd() * size, rnd() * size, r * (0.5 + rnd()), 0, 7); g.fill(); }
  g.globalAlpha = 1;
}
function strokes(g, size, rnd, color, n, len, alpha = 0.3, width = 1.2, angle = null) {
  g.strokeStyle = color; g.globalAlpha = alpha; g.lineWidth = width; g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = rnd() * size, y = rnd() * size, a = angle != null ? angle + (rnd() - 0.5) * 0.4 : rnd() * Math.PI, l = len * (0.5 + rnd());
    for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
      g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); g.stroke();
    }
  }
  g.globalAlpha = 1;
}

Materials.def('void', { walk: false, z: 0, pattern(g, s, o) { g.fillStyle = o.c1 || '#241c2b'; g.fillRect(0, 0, s, s); } });

Materials.def('wood', {
  z: 1, tile: 192, colors: { c1: '#e7c197', c2: '#d4a877', line: '#9c6d4c' },
  pattern(g, s, o, rnd) {
    g.fillStyle = o.c1; g.fillRect(0, 0, s, s);
    const ph = 24;
    for (let y = 0; y < s; y += ph) {
      let x = -rnd() * 80;
      while (x < s) {
        const len = 70 + rnd() * 90;
        g.fillStyle = U.mixHex(o.c1, o.c2, rnd() * 0.8);
        g.fillRect(x, y, len, ph);
        g.strokeStyle = o.line; g.globalAlpha = 0.55; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x, y + ph - 2); g.stroke();
        g.globalAlpha = 0.18;
        for (let k = 0; k < 3; k++) { const gy = y + 5 + rnd() * (ph - 10); g.beginPath(); g.moveTo(x + 6, gy); g.bezierCurveTo(x + len * 0.3, gy + (rnd() - 0.5) * 4, x + len * 0.6, gy + (rnd() - 0.5) * 4, x + len - 6, gy); g.stroke(); }
        g.globalAlpha = 1;
        x += len;
      }
      g.strokeStyle = o.line; g.globalAlpha = 0.6; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(s, y + 0.5); g.stroke(); g.globalAlpha = 1;
    }
  },
});

Materials.def('plank', { // dark attic planks
  z: 1, tile: 192, colors: { c1: '#5b4a4f', c2: '#4a3b41', line: '#2b2126' },
  pattern(g, s, o, rnd) { Materials.defs.wood.pattern(g, s, o, rnd); speckle(g, s, rnd, '#1b1418', 30, 1.2, 0.5); },
});

Materials.def('tile', {
  z: 1, tile: 96, colors: { c1: '#f4f1e8', c2: '#cfe3e6', line: '#9fb3b8' },
  pattern(g, s, o, rnd) {
    const n = 2, ts = s / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      g.fillStyle = (x + y) % 2 ? o.c2 : o.c1; g.fillRect(x * ts, y * ts, ts, ts);
    }
    g.strokeStyle = o.line; g.lineWidth = 2; g.globalAlpha = 0.7;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * ts, 0); g.lineTo(i * ts, s); g.stroke(); g.beginPath(); g.moveTo(0, i * ts); g.lineTo(s, i * ts); g.stroke(); }
    g.globalAlpha = 1;
    speckle(g, s, rnd, '#7d8c90', 14, 0.8, 0.25);
  },
});

Materials.def('gingham', {
  z: 1, tile: 96, colors: { c1: '#fffaf2', c2: '#f59aa5' },
  pattern(g, s, o, rnd) {
    g.fillStyle = o.c1; g.fillRect(0, 0, s, s);
    const st = s / 4;
    g.fillStyle = U.rgba(o.c2, 0.45);
    for (let i = 0; i < 4; i += 2) { g.fillRect(i * st, 0, st, s); g.fillRect(0, i * st, s, st); }
    strokes(g, s, rnd, o.c2, 40, 10, 0.18, 1, 0);
    strokes(g, s, rnd, o.c2, 40, 10, 0.18, 1, Math.PI / 2);
  },
});

Materials.def('carpet', {
  z: 1, tile: 128, colors: { c1: '#a7c7a0', c2: '#8fb58a' },
  pattern(g, s, o, rnd) {
    g.fillStyle = o.c1; g.fillRect(0, 0, s, s);
    g.strokeStyle = U.rgba(o.c2, 0.5); g.lineWidth = 2;
    for (let i = -1; i < 3; i++) {
      g.beginPath(); g.moveTo(i * s / 2, 0); g.lineTo(i * s / 2 + s / 2, s / 2); g.lineTo(i * s / 2, s); g.stroke();
    }
    speckle(g, s, rnd, o.c2, 260, 1, 0.45);
    speckle(g, s, rnd, '#ffffff', 90, 0.8, 0.25);
  },
});

Materials.def('rugpile', { // plush hills texture for Carpet Hills
  z: 2, soft: true, outline: '#4d5e46', tile: 128, colors: { c1: '#c9dfae', c2: '#a9c98f' },
  pattern(g, s, o, rnd) {
    g.fillStyle = o.c1; g.fillRect(0, 0, s, s);
    strokes(g, s, rnd, o.c2, 160, 6, 0.7, 2, -Math.PI / 2);
    speckle(g, s, rnd, '#ffffff', 50, 1, 0.35);
  },
});

Materials.def('grass', {
  z: 1, tile: 128, colors: { c1: '#b8dba0', c2: '#8fc27c', flower: '#ffffff' },
  pattern(g, s, o, rnd) {
    g.fillStyle = o.c1; g.fillRect(0, 0, s, s);
    speckle(g, s, rnd, o.c2, 120, 1.4, 0.4);
    g.strokeStyle = o.c2; g.lineWidth = 1.6; g.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const x = rnd() * s, y = rnd() * s;
      g.beginPath(); g.moveTo(x - 3, y - 5); g.lineTo(x, y); g.lineTo(x + 3, y - 6); g.stroke();
    }
    for (let i = 0; i < 3; i++) { g.fillStyle = o.flower; g.beginPath(); g.arc(rnd() * s, rnd() * s, 2, 0, 7); g.fill(); }
  },
});

Materials.def('dirt', {
  z: 2, soft: true, outline: '#8a6a50', tile: 96, colors: { c1: '#e8cfa6', c2: '#caa77e' },
  pattern(g, s, o, rnd) { g.fillStyle = o.c1; g.fillRect(0, 0, s, s); speckle(g, s, rnd, o.c2, 60, 2, 0.5); },
});

// a soft fleece throw with a wide, gentle plaid
Materials.def('blanket', {
  z: 1, tile: 192, colors: { c1: '#e9dcf3', c2: '#f5c9d9', c3: '#fff3d6', line: '#b99bb0' },
  pattern(g, s, o, rnd) {
    g.fillStyle = o.c1; g.fillRect(0, 0, s, s);
    const band = (pos, width, col, alpha, vertical) => {
      g.fillStyle = U.rgba(col, alpha);
      if (vertical) g.fillRect(pos, 0, width, s); else g.fillRect(0, pos, s, width);
    };
    band(20, 46, o.c2, 0.55, true); band(20, 46, o.c2, 0.55, false);
    band(120, 14, o.c3, 0.8, true); band(120, 14, o.c3, 0.8, false);
    band(150, 4, o.line, 0.35, true); band(150, 4, o.line, 0.35, false);
    // fuzzy fleece texture
    strokes(g, s, rnd, '#ffffff', 220, 5, 0.22, 1.2);
    strokes(g, s, rnd, o.line, 120, 4, 0.12, 1);
  },
});

Materials.def('milk', {
  walk: false, z: 3, soft: true, outline: '#7c93a8', tile: 128, colors: { c1: '#f7fbff', c2: '#dbe8f5' },
  pattern(g, s, o, rnd) {
    g.fillStyle = o.c1; g.fillRect(0, 0, s, s);
    g.strokeStyle = o.c2; g.lineWidth = 2.5; g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const x = rnd() * s, y = rnd() * s;
      g.beginPath(); g.moveTo(x - 10, y); g.quadraticCurveTo(x - 5, y - 4, x, y); g.quadraticCurveTo(x + 5, y + 4, x + 10, y); g.stroke();
    }
  },
});

Materials.def('water', {
  walk: false, z: 3, soft: true, outline: '#4b6f8f', tile: 128, colors: { c1: '#9cc9e8', c2: '#d6ecf8' },
  pattern(g, s, o, rnd) { Materials.defs.milk.pattern(g, s, o, rnd); },
});

Materials.def('cloud', {
  z: 1, soft: true, outline: '#8e8fb8', tile: 160, colors: { c1: '#f3f1ff', c2: '#dcd9f4' },
  pattern(g, s, o, rnd) {
    g.fillStyle = o.c1; g.fillRect(0, 0, s, s);
    g.strokeStyle = o.c2; g.lineWidth = 3;
    for (let i = 0; i < 10; i++) {
      const x = rnd() * s, y = rnd() * s, r = 8 + rnd() * 14;
      g.beginPath(); g.arc(x, y, r, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    }
    speckle(g, s, rnd, '#ffffff', 40, 2, 0.6);
  },
});

Materials.def('static', {
  z: 1, tile: 128, colors: { c1: '#8d8a94', c2: '#5e5a66' },
  pattern(g, s, o, rnd) {
    g.fillStyle = o.c1; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) { g.fillStyle = rnd() < 0.5 ? o.c2 : '#c9c6cf'; g.fillRect(Math.floor(rnd() * s), Math.floor(rnd() * s), 2, 2); }
  },
});

Materials.def('counter', {
  z: 1, tile: 128, colors: { c1: '#e6e9ee', c2: '#c3cad6' },
  pattern(g, s, o, rnd) { g.fillStyle = o.c1; g.fillRect(0, 0, s, s); strokes(g, s, rnd, o.c2, 20, 30, 0.5, 1.5); speckle(g, s, rnd, o.c2, 40, 1, 0.4); },
});

Materials.def('hole', { // edge of a table / nothingness, not walkable
  walk: false, z: 0, colors: { c1: '#3a2f45' },
  pattern(g, s, o) { g.fillStyle = o.c1; g.fillRect(0, 0, s, s); },
});

// Wall faces seen from the front (RPG Maker style interiors)
Materials.def('wall', {
  walk: false, z: 2, colors: { c1: '#f3d9c4', c2: '#e8c3a8', trim: '#a0735e', base: '#8b5e4b', style: 'stripes' },
  paintRegion(g, tiles, map, o) {
    const set = new Set(tiles.map(([x, y]) => x + ',' + y));
    const rnd = U.rng(U.hash(map.id + 'wall'));
    for (const [x, y] of tiles) {
      const px = x * TS, py = y * TS;
      g.fillStyle = o.c1; g.fillRect(px, py, TS, TS);
      if (o.style === 'stripes') {
        g.fillStyle = o.c2;
        for (let i = 0; i < TS; i += 16) g.fillRect(px + i, py, 7, TS);
      } else if (o.style === 'dots') {
        g.fillStyle = o.c2;
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.beginPath(); g.arc(px + 12 + i * 24 + (j % 2) * 12, py + 12 + j * 24, 3.5, 0, 7); g.fill(); }
      } else if (o.style === 'planks') {
        g.strokeStyle = o.c2; g.lineWidth = 2;
        for (let i = 0; i < TS; i += 16) { g.beginPath(); g.moveTo(px + i, py); g.lineTo(px + i, py + TS); g.stroke(); }
      } else if (o.style === 'flowers') {
        g.fillStyle = o.c2;
        const cx = px + 24 + (y % 2) * 12, cy = py + 24;
        for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; g.beginPath(); g.arc(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5, 3.5, 0, 7); g.fill(); }
      }
      speckle(g, TS, rnd, o.c2, 0);
      const above = set.has(x + ',' + (y - 1)), below = set.has(x + ',' + (y + 1));
      if (!above) { g.fillStyle = o.trim; g.fillRect(px, py, TS, 7); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(px, py + 7, TS, 2); }
      if (!below) {
        g.fillStyle = o.base; g.fillRect(px, py + TS - 10, TS, 10);
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(px, py + TS, TS, 6);
      }
    }
  },
  after(g, tiles, map, o) {
    // ink line along the bottom edge of walls
    const set = new Set(tiles.map(([x, y]) => x + ',' + y));
    g.strokeStyle = Gfx.C.ink; g.lineWidth = 2.5; g.lineCap = 'round';
    for (const [x, y] of tiles) {
      if (!set.has(x + ',' + (y + 1))) { g.beginPath(); g.moveTo(x * TS, (y + 1) * TS); g.lineTo((x + 1) * TS, (y + 1) * TS); g.stroke(); }
      if (!set.has(x + ',' + (y - 1))) { g.beginPath(); g.moveTo(x * TS, y * TS); g.lineTo((x + 1) * TS, y * TS); g.stroke(); }
    }
  },
});

// Tiny ink doodles scattered over walkable ground (drawn once into the ground canvas).
function drawDoodle(g, kind, x, y, r) {
  g.save();
  g.translate(x, y);
  const spin = r() * Math.PI * 2;
  if (kind !== 'drop' && kind !== 'grass') g.rotate(spin);
  g.lineWidth = 1.4; g.strokeStyle = 'rgba(58,42,48,0.55)'; g.lineJoin = 'round'; g.lineCap = 'round';
  const pastel = ['#ff9ec4', '#ffd166', '#9fd8ff', '#b8f0a8', '#d6b8ff'][Math.floor(r() * 5)];
  switch (kind) {
    case 'sprinkle': g.fillStyle = pastel; Gfx.roundRect(g, -5, -1.8, 10, 3.6, 1.8); g.fill(); break;
    case 'crumb': g.fillStyle = '#c98f5a'; g.beginPath(); g.ellipse(0, 0, 2.5 + r() * 2, 2 + r() * 1.5, 0, 0, 7); g.fill(); g.stroke(); break;
    case 'star': g.fillStyle = '#ffe38a'; Gfx.star(g, 0, 0, 5, 2.2); g.fill(); g.stroke(); break;
    case 'heart': g.fillStyle = '#ffb3c6'; Gfx.heartPath(g, 0, 0, 4); g.fill(); g.stroke(); break;
    case 'drop': g.fillStyle = 'rgba(160,190,240,0.8)'; Gfx.drop(g, 0, 0, 4); g.fill(); g.stroke(); break;
    case 'flower':
      g.fillStyle = pastel;
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * 3, Math.sin(a) * 3, 2.2, 0, 7); g.fill(); }
      g.fillStyle = '#ffe38a'; g.beginPath(); g.arc(0, 0, 1.6, 0, 7); g.fill();
      break;
    case 'lint': g.strokeStyle = 'rgba(120,120,130,0.6)'; g.beginPath(); g.moveTo(-5, 0); g.bezierCurveTo(-2, -4, 1, 4, 5, 0); g.stroke(); break;
    case 'crayon': g.fillStyle = pastel; g.fillRect(-7, -1.8, 12, 3.6); g.strokeRect(-7, -1.8, 12, 3.6); g.beginPath(); g.moveTo(5, -1.8); g.lineTo(8, 0); g.lineTo(5, 1.8); g.fill(); g.stroke(); break;
    case 'pebble': g.fillStyle = 'rgba(160,140,120,0.5)'; g.beginPath(); g.ellipse(0, 0, 3, 2, 0, 0, 7); g.fill(); break;
    case 'grass': g.strokeStyle = 'rgba(70,120,60,0.5)'; g.beginPath(); g.moveTo(-3, 2); g.lineTo(0, -3); g.lineTo(3, 2); g.stroke(); break;
  }
  g.restore();
}
Materials.scatter = function (g, map, kinds, n, seed = 1) {
  const r = U.rng(seed + U.hash(map.id));
  for (let i = 0; i < n; i++) {
    const tx = Math.floor(r() * map.w), ty = Math.floor(r() * map.h);
    const L = map.legendFull[map.tiles[ty][tx]];
    const md = L && Materials.defs[L.mat];
    const walk = L && (L.walk != null ? L.walk : md && md.walk);
    const k = kinds[Math.floor(r() * kinds.length)];
    const px = tx * TS + 6 + r() * (TS - 12), py = ty * TS + 6 + r() * (TS - 12);
    if (walk) drawDoodle(g, k, px, py, r);
  }
};

window.Materials = Materials; window.TS = TS;
