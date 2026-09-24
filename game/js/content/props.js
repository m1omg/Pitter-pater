'use strict';
// ---------------------------------------------------------------------------
// Prop definitions. img: image id; dh: display height; foot: [w,h] tiles;
// layer: ground (flat, under characters) | mid (y-sorted) | top (overhead); flip / flipY mirror the image.
// Some small decorations are drawn procedurally (draw2).
// ---------------------------------------------------------------------------
const P = (img, dh, foot, o = {}) => Object.assign({ img, dh, foot }, o);
const deco = (img, dh, foot, o = {}) => Object.assign({ img, dh, foot, layer: 'ground', solid: false, shadow: false }, o);

const PROPS = {
  // ----- real house -----
  bed_pim: P('p_bed_pim', 150, [2, 2], { oy: 4 }),
  desk: P('p_desk', 96, [2, 1]),
  chair: P('p_chair', 64, [1, 1]),
  bookshelf: P('p_bookshelf', 132, [2, 1]),
  toybox: P('p_toybox', 56, [1, 1]),
  dresser: P('p_dresser', 100, [2, 1]),
  window: deco('p_window', 78, [2, 1], { oy: -12 }),
  window_rain: deco('p_window', 78, [2, 1], { oy: -12, rainy: true }),
  drawings: deco('p_drawings', 56, [2, 1], { oy: -22 }),
  rug_round: deco('p_rug_round', 110, [3, 2], { oy: 6 }),
  rug_long: deco('p_rug_long', 100, [4, 2], { oy: 4 }),
  door: deco('p_door', 100, [1, 2], { oy: 2 }),
  door_mom: deco('p_door_mom', 100, [1, 2], { oy: 2 }),
  stairs_down: deco('p_stairs', 100, [2, 2], { flipY: true }),   // painted heading away from us: flipped so it leads down from the hallway
  stairs_up: deco('p_stairs_up', 100, [2, 2]),
  photo_frames: deco('p_photo_frames', 56, [2, 1], { oy: -24 }),
  photo_frames_folded: deco('p_photo_frames_folded', 56, [2, 1], { oy: -24 }),   // downstairs: Dad's side folded away
  side_plant: P('p_side_plant', 84, [1, 1]),
  attic_ladder: deco('p_attic_ladder', 120, [1, 2], { oy: 4 }),
  fridge: P('p_fridge', 126, [1, 1]),
  counter_sink: P('p_counter_sink', 92, [2, 1]),     // sink and toaster (the toast is drawn by the kitchen, see makeToast)
  counter_plain: P('p_counter_plain', 92, [2, 1]),   // the same counter with nothing on it
  stove: P('p_stove', 92, [1, 1]),
  washer: P('p_washer', 92, [1, 1]),
  kitchen_table: P('p_kitchen_table', 104, [2, 2]),
  couch: P('p_couch', 96, [3, 1]),
  tv: P('p_tv', 104, [2, 1]),
  coffee_table: P('p_coffee_table', 52, [2, 1]),
  floor_lamp: P('p_floor_lamp', 126, [1, 1], { light: 170 }),
  phone_table: P('p_phone_table', 78, [1, 1]),
  pet_bowls: deco('p_pet_bowls', 30, [1, 1]),
  plant: P('p_plant', 92, [1, 1]),
  front_door: deco('p_front_door', 100, [1, 2], { oy: 2 }),
  fence: P('p_fence', 64, [1, 1], { shadow: false }),
  fence_v: { layer: 'mid', solid: true, shadow: false, foot: [1, 1], dh: 1, draw2: drawFenceV },
  mailbox: P('p_mailbox', 86, [1, 1]),
  flowerbed: P('p_flowerbed', 54, [2, 1], { shadow: false }),
  tree: P('p_tree', 230, [2, 1], { solidFoot: [0, 0, 2, 1], anim: 'sway' }),
  bush: P('p_bush', 62, [1, 1]),
  house_front: P('p_house_front', 300, [8, 3]),
  box: P('p_box', 52, [1, 1]),
  box_stack: P('p_box_stack', 96, [1, 1]),
  sheet_furniture: P('p_sheet_furniture', 100, [2, 1]),
  mirror: P('p_mirror', 118, [1, 1]),
  rocking_horse: P('p_rocking_horse', 76, [1, 1]),
  dad_box: P('p_dad_box', 56, [1, 1]),
  trunk: P('p_trunk', 64, [2, 1]),
  mom_bed: P('p_mom_bed', 150, [3, 2]),
  nightstand: P('p_nightstand', 70, [1, 1]),
  curtains: deco('p_curtains', 90, [2, 1], { oy: -6 }),
  laundry_pile: P('p_laundry_pile', 56, [1, 1]),
  // ----- pillow fort -----
  blanket_tent: P('p_blanket_tent', 170, [3, 2]),
  pillow_pile: P('p_pillow_pile', 80, [2, 1]),
  pillow: P('p_pillow', 46, [1, 1]),
  toy_blocks: P('p_toy_blocks', 58, [1, 1]),
  moon_light: P('p_moon_light', 92, [1, 1], { light: 200, anim: 'breathe' }),
  cardboard_castle: P('p_cardboard_castle', 150, [2, 2]),
  book_stack: P('p_book_stack', 70, [1, 1]),
  plush_bear: P('p_plush_bear', 66, [1, 1]),
  blanket_tunnel: P('p_blanket_tunnel', 110, [2, 1], { solid: false }),
  laundry_block: P('p_laundry_block', 86, [2, 1]),
  raindrop_door: P('p_raindrop_door', 150, [2, 1]),
  attic_hatch: deco('p_attic_hatch', 70, [2, 1]),
  string_lights: { layer: 'top', solid: false, shadow: false, foot: [1, 1], dh: 1, draw2: drawStringLights },
  paper_star: { layer: 'top', solid: false, shadow: false, foot: [1, 1], dh: 1, draw2: drawPaperStar },
  // ----- crumb valley -----
  salt: P('p_salt', 116, [1, 1]),
  pepper: P('p_pepper', 126, [1, 1]),
  cereal_box: P('p_cereal_box', 180, [2, 1]),
  sugar_cube: P('p_sugar_cube', 54, [1, 1]),
  teacup_house: P('p_teacup_house', 140, [2, 2]),
  teacup_house2: P('p_teacup_house2', 140, [2, 2]),
  teapot_house: P('p_teapot_house', 210, [3, 2]),
  sugar_bowl: P('p_sugar_bowl', 96, [2, 1]),
  bread: P('p_bread', 96, [2, 1]),
  butter: P('p_butter', 56, [1, 1]),
  milk_carton: P('p_milk_carton', 180, [2, 1]),
  jam_jar: P('p_jam_jar', 86, [1, 1]),
  fork_fence: P('p_fork_fence', 76, [1, 1], { shadow: false }),
  spoon_bridge: deco('p_spoon_bridge', 150, [2, 3]),
  toaster_big: P('p_toaster_big', 240, [4, 2]),
  candle_light: P('p_candle_light', 88, [1, 1], { light: 190, anim: 'flicker' }),
  crumbs: { layer: 'ground', solid: false, shadow: false, foot: [1, 1], dh: 1, draw2: drawCrumbs },
  // ----- carpet hills -----
  cushion_hill: P('p_cushion_hill', 126, [3, 2]),
  lamp_tree: P('p_lamp_tree', 230, [1, 1], { light: 210 }),
  books_tower: P('p_books_tower', 160, [1, 1]),
  lint_tree: P('p_lint_tree', 140, [1, 1], { anim: 'sway' }),
  dust_hut: P('p_dust_hut', 118, [2, 2]),
  coin_big: P('p_coin_big', 66, [1, 1]),
  remote_tower: P('p_remote_tower', 176, [1, 1]),
  tv_giant: P('p_tv_giant', 240, [4, 2], { light: 260, lx: 0, ly: 140 }),
  antenna_tree: P('p_antenna_tree', 180, [1, 1], { anim: 'sway' }),
  tv_small: P('p_tv_small', 74, [1, 1], { light: 90 }),
  plant_pot: P('p_plant_pot', 150, [1, 1], { anim: 'sway' }),
  crayon: P('p_crayon', 60, [1, 1]),
  cable: { layer: 'ground', solid: false, shadow: false, foot: [1, 1], dh: 1, draw2: drawCable },
  // ----- attic -----
  coat_rack: P('p_coat_rack', 150, [1, 1]),
  photo_big: deco('p_photo_big', 70, [2, 1], { oy: -18 }),
  music_box: P('p_music_box', 52, [1, 1]),
  cobweb: { layer: 'top', solid: false, shadow: false, foot: [1, 1], dh: 1, draw2: drawCobweb },
  // ----- cloud keep -----
  cloud_pillar: P('p_cloud_pillar', 176, [1, 1]),
  cloud_bush: P('p_cloud_bush', 72, [2, 1]),
  puddle: { layer: 'ground', solid: false, shadow: false, foot: [2, 1], dh: 1, draw2: drawPuddle },
  umbrella_stand: P('p_umbrella_stand', 86, [1, 1]),
  tissue_box: P('p_tissue_box', 62, [1, 1]),
  rain_window: deco('p_rain_window', 110, [2, 2], { oy: -4 }),
  queen_throne: P('p_queen_throne', 260, [4, 2]),
  lantern: P('p_lantern', 96, [1, 1], { light: 190, anim: 'flicker' }),
  photo_stand: P('p_photo_stand', 62, [1, 1]),
};

// ---- procedural decorations ----
function drawStringLights(ctx, p, t) {
  const w = (p.len || 6) * TS;
  ctx.strokeStyle = '#5a4a50'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-TS / 2, -p.hgt || -60);
  const h0 = -(p.hgt || 60);
  ctx.beginPath(); ctx.moveTo(-TS / 2, h0);
  ctx.quadraticCurveTo(-TS / 2 + w / 2, h0 + 40, -TS / 2 + w, h0);
  ctx.stroke();
  const cols = ['#ffd166', '#ff8fa3', '#8fd3ff', '#b7f0a8'];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10, x = -TS / 2 + w * u, y = h0 + 40 * 2 * u * (1 - u) * 1.0 + 6;
    const on = 0.6 + 0.4 * Math.sin(t * 0.05 + i);
    ctx.globalAlpha = on;
    ctx.fillStyle = cols[i % 4];
    ctx.beginPath(); ctx.ellipse(x, y, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = on * 0.25;
    ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}
function drawPaperStar(ctx, p, t) {
  const y = -(p.hgt || 110) + Math.sin(t * 0.03) * 4;
  ctx.strokeStyle = '#5a4a50'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, y - 60); ctx.lineTo(0, y - 14); ctx.stroke();
  ctx.save(); ctx.translate(0, y); ctx.rotate(Math.sin(t * 0.02) * 0.2);
  ctx.fillStyle = p.color || '#ffe38a';
  Gfx.star(ctx, 0, 0, 16, 7); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = Gfx.C.ink; ctx.stroke();
  ctx.restore();
}
function drawCrumbs(ctx, p) {
  const r = U.rng(U.hash('crumb' + p.x + ',' + p.y));
  ctx.fillStyle = '#c98f5a';
  for (let i = 0; i < 7; i++) {
    const x = (r() - 0.5) * 40, y = -r() * 30 - 6, s = 2 + r() * 4;
    ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.7, r() * 3, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(90,50,30,0.6)'; ctx.stroke();
  }
}
function drawCable(ctx, p) {
  const w = (p.len || 3) * TS;
  ctx.strokeStyle = '#3d3a45'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-TS / 2, -20);
  ctx.bezierCurveTo(-TS / 2 + w * 0.3, -40, -TS / 2 + w * 0.6, 0, -TS / 2 + w, -22);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
}
function drawPuddle(ctx, p, t) {
  ctx.fillStyle = 'rgba(140,170,220,0.55)';
  ctx.beginPath(); ctx.ellipse(0, -18, 44, 16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(70,90,140,0.6)'; ctx.stroke();
  const r = (t * 0.6) % 40;
  ctx.globalAlpha = 1 - r / 40; ctx.strokeStyle = '#e8f0ff';
  ctx.beginPath(); ctx.ellipse(8, -18, r, r * 0.36, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
}
// a picket fence running north-south (one post + rails per tile)
function drawFenceV(ctx, p) {
  ctx.lineJoin = 'round'; ctx.lineWidth = 2.5; ctx.strokeStyle = Gfx.C.ink;
  // rails reach up to the post of the tile above
  ctx.fillStyle = '#efe6d6';
  for (const ry of [-40, -22]) {
    ctx.beginPath(); ctx.rect(-3, ry - TS, 6, TS); ctx.fill(); ctx.stroke();
  }
  // the post
  ctx.fillStyle = '#fbf6ec';
  ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(-6, -48); ctx.lineTo(0, -56); ctx.lineTo(6, -48); ctx.lineTo(6, -6); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(90,130,70,0.8)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-6, -14); ctx.quadraticCurveTo(-12, -24, -4, -30); ctx.stroke();
  ctx.fillStyle = 'rgba(40,20,40,0.15)'; ctx.beginPath(); ctx.ellipse(0, -3, 9, 3, 0, 0, 7); ctx.fill();
}
function drawCobweb(ctx, p) {
  const s = p.flip ? -1 : 1;
  ctx.strokeStyle = 'rgba(230,230,240,0.35)'; ctx.lineWidth = 1.2;
  const y0 = -(p.hgt || 140);
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-TS / 2 * s, y0); ctx.lineTo((-TS / 2 + i * 14) * s, y0 + 60 - i * 12); ctx.stroke(); }
  for (let r = 16; r < 70; r += 16) { ctx.beginPath(); ctx.arc(-TS / 2 * s, y0, r, 0, Math.PI / 2 * s, s < 0); ctx.stroke(); }
}
// Build tile rows from shape operations (keeps map layouts readable).
function buildTiles(w, h, base, ops) {
  const g = Array.from({ length: h }, () => Array(w).fill(base));
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c; };
  for (const op of ops) {
    const [type, ...a] = op;
    if (type === 'rect') { const [x, y, rw, rh, c] = a; for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) set(i, j, c); }
    else if (type === 'ellipse') {
      const [cx, cy, rx, ry, c] = a;
      for (let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j++) for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++) {
        const dx = (i - cx) / rx, dy = (j - cy) / ry;
        if (dx * dx + dy * dy <= 1) set(i, j, c);
      }
    } else if (type === 'set') { const [x, y, c] = a; set(x, y, c); }
    else if (type === 'path') {
      const [pts, wd, c] = a;
      for (let k = 0; k < pts.length - 1; k++) {
        const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
        const sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
        let x = x0, y = y0;
        for (let guard = 0; guard < 500; guard++) {
          for (let dy = 0; dy < wd; dy++) for (let dx = 0; dx < wd; dx++) set(x + dx, y + dy, c);
          if (x === x1 && y === y1) break;
          if (x !== x1) x += sx; else y += sy;
        }
      }
    } else if (type === 'rows') { const [x, y, rows] = a; rows.forEach((r, j) => [...r].forEach((c, i) => { if (c !== ' ') set(x + i, y + j, c); })); }
  }
  return g.map((r) => r.join(''));
}

// A little wooden signpost drawn procedurally.
function drawSign(ctx) {
  ctx.fillStyle = 'rgba(40,20,40,0.18)'; ctx.beginPath(); ctx.ellipse(0, -2, 16, 6, 0, 0, 7); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = Gfx.C.ink; ctx.lineJoin = 'round';
  ctx.fillStyle = '#b98556'; ctx.fillRect(-3, -40, 6, 38); ctx.strokeRect(-3, -40, 6, 38);
  ctx.fillStyle = '#e8c08e'; Gfx.roundRect(ctx, -22, -58, 44, 26, 4); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(90,60,40,0.6)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-15, -51 + i * 7); ctx.lineTo(15 - i * 6, -51 + i * 7); ctx.stroke(); }
}
function signEvent(id, x, y, lines) {
  return { id, x, y, solid: true, draw2: drawSign, dh: 60, async run(E) { for (const l of lines) await E.say(null, l); } };
}

window.PROPS = PROPS; window.buildTiles = buildTiles; window.signEvent = signEvent; window.drawSign = drawSign;
