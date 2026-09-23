'use strict';
// ---------------------------------------------------------------------------
// Boot + developer helpers (URL: ?map=crumb_1&x=3&y=5&ch=1&party=pim,biscuit&lv=4
// or ?battle=crumb_2 to jump straight in; F2 shows collisions, F3 shows fps).
// ---------------------------------------------------------------------------
function validateContent() {
  const problems = [];
  for (const id of Object.keys(MAPS)) {
    const m = MAPS[id];
    const w = m.tiles[0].length;
    m.tiles.forEach((r, i) => { if (r.length !== w) problems.push(`${id}: row ${i} has length ${r.length}, expected ${w}`); });
    const legend = Object.assign({ '#': 'void', ' ': 'void' }, m.legend || {});
    const walk = (x, y) => {
      if (y < 0 || y >= m.tiles.length || x < 0 || x >= w) return false;
      const L = legend[m.tiles[y][x]];
      if (!L) { problems.push(`${id}: no legend for '${m.tiles[y][x]}'`); return false; }
      const mat = typeof L === 'string' ? L : L.mat;
      const md = Materials.defs[mat];
      if (!md) { problems.push(`${id}: unknown material ${mat}`); return false; }
      return (typeof L === 'object' && L.walk != null) ? L.walk : md.walk;
    };
    for (const ex of m.exits || []) {
      if (!MAPS[ex.to]) problems.push(`${id}: exit to unknown map ${ex.to}`);
      else {
        const t = MAPS[ex.to];
        const tl = Object.assign({ '#': 'void', ' ': 'void' }, t.legend || {});
        const row = t.tiles[ex.ty];
        if (!row || row[ex.tx] === undefined) problems.push(`${id}: exit target ${ex.to} ${ex.tx},${ex.ty} out of bounds`);
        else {
          const L = tl[row[ex.tx]];
          const mat = typeof L === 'string' ? L : L && L.mat;
          const ok = L && ((typeof L === 'object' && L.walk != null) ? L.walk : Materials.defs[mat] && Materials.defs[mat].walk);
          if (!ok) problems.push(`${id}: exit target ${ex.to} ${ex.tx},${ex.ty} is not walkable ('${row[ex.tx]}')`);
        }
      }
      for (let dy = 0; dy < (ex.h || 1); dy++) for (let dx = 0; dx < (ex.w || 1); dx++) if (!walk(ex.x + dx, ex.y + dy) && !(m.open || []).some(([ox, oy]) => ox === ex.x + dx && oy === ex.y + dy)) problems.push(`${id}: exit tile ${ex.x + dx},${ex.y + dy} not walkable`);
    }
    for (const p of m.props || []) {
      const o = Array.isArray(p) ? { id: p[0], x: p[1], y: p[2] } : p;
      if (!PROPS[o.id]) problems.push(`${id}: unknown prop ${o.id}`);
      if (o.x < 0 || o.y < 0 || o.x >= w || o.y >= m.tiles.length) problems.push(`${id}: prop ${o.id} out of bounds`);
    }
    for (const e of m.events || []) {
      if (e.x < 0 || e.y < 0 || e.x >= w || e.y >= m.tiles.length) problems.push(`${id}: event ${e.id} out of bounds`);
    }
    for (const en of m.enemies || []) {
      if (!TROOPS[en.troop]) problems.push(`${id}: unknown troop ${en.troop}`);
      if (!walk(en.x, en.y)) problems.push(`${id}: enemy ${en.troop} on unwalkable tile ${en.x},${en.y}`);
    }
  }
  for (const t of Object.keys(TROOPS)) for (const e of TROOPS[t].enemies) if (!ENEMIES[e]) problems.push(`troop ${t}: unknown enemy ${e}`);
  for (const a of Object.keys(ACTORS)) for (const [, s] of ACTORS[a].learn) if (!SKILLS[s]) problems.push(`actor ${a}: unknown skill ${s}`);
  return problems;
}
window.validateContent = validateContent;

function debugStart() {
  const q = new URLSearchParams(location.search);
  if (!q.has('map') && !q.has('battle')) return false;
  State.newGame();
  const d = State.d;
  d.chapter = +(q.get('ch') || 1);
  d.world = q.get('world') || (['pim_room', 'hallway', 'downstairs', 'yard', 'attic_real', 'mom_room', 'yard_after'].includes(q.get('map')) ? 'real' : 'dream');
  d.party = (q.get('party') || 'pim,biscuit,waffles,momo').split(',');
  d.pets = ['biscuit', 'waffles'];
  const lv = +(q.get('lv') || 1);
  if (lv > 1) for (const id of Object.keys(ACTORS)) State.setLevel(id, lv);
  State.healAll();
  for (const f of (q.get('flags') || '').split(',').filter(Boolean)) d.flags[f] = true;
  for (const it of ['cookie', 'toast', 'bubbles', 'balloon', 'cushion', 'warm_milk']) State.addItem(it, 3);
  d.marbles = 200;
  if (q.has('battle')) {
    Game.setScene(new MapScene(q.get('map') || 'fort', +(q.get('x') || 12), +(q.get('y') || 9), 'down'));
    setTimeout(() => Battle.start(q.get('battle'), {}), 300);
  } else {
    Game.setScene(new MapScene(q.get('map'), +(q.get('x') || 5), +(q.get('y') || 5), q.get('dir') || 'down'));
  }
  return true;
}

(async function boot() {
  Input.init();
  Sound.init();
  State.loadOptions();
  await Gfx.loadFonts();
  Game.init();
  const bootEl = document.getElementById('boot');
  if (bootEl) bootEl.remove();
  document.getElementById('game').focus();
  Assets.preloadCore();
  Sound.preloadSfx();
  // decode the first music early so it starts the moment a key is pressed
  Sound.load('bgm_title');
  Sound.load('amb_rain_light');
  setTimeout(() => Sound.load('bgm_battle'), 4000);
  if (debugStart()) return;
  Title.open();
})();
