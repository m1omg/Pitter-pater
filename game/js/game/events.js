'use strict';
// ---------------------------------------------------------------------------
// Event runner + the scripting API (E) used by maps and the story.
// ---------------------------------------------------------------------------
const Events = {
  running: 0,
  async run(fn) {
    this.running++;
    try { await fn(E); }
    catch (e) { console.error(e); Game.errors.push('Event error: ' + (e && e.message)); }
    finally { this.running = Math.max(0, this.running - 1); }
  },
  onMapEnter(scene, first) {
    const def = scene.def;
    const autos = scene.events.filter((e) => e.trigger === 'auto');
    if (!def.onEnter && !(first && def.onFirst) && !autos.length) return;
    this.run(async (E) => {
      if (first && def.onFirst) await def.onFirst(E);
      if (def.onEnter) await def.onEnter(E);
      for (const ev of autos) {
        if (Game.scene !== scene) break;
        if (ev.def.cond && !ev.def.cond()) continue;
        await ev.def.run(E, ev);
        if (ev.def.once) State.setFlag(ev.def.once);
      }
      if (Game.scene === scene) scene.refreshEvents();
    });
  },
};

const E = {
  get scene() { return Game.scene instanceof MapScene ? Game.scene : null; },

  // ----- dialogue -----
  say(speaker, text, face) {
    if (speaker && speaker.includes(':')) [speaker, face] = speaker.split(':');
    return Msg.show(speaker, text, { face });
  },
  async talk(lines) {
    for (const l of lines) await this.say(l[0], l[1], l[2]);
  },
  async ask(speaker, text, options, face, cancel) {
    if (speaker && speaker.includes(':')) [speaker, face] = speaker.split(':');
    await Msg.show(speaker, text, { face, autoResolve: true });
    const i = await choose(options, { cancel });
    Msg.release();
    return i;
  },
  choice(options, cancel) { return choose(options, { cancel }); },
  narrate(text) { return Msg.show(null, text, {}); },

  // ----- flow -----
  wait(n) { return Game.wait(n); },
  fadeOut(n = 20, color = '#000') { return Game.fadeOut(n, color); },
  fadeIn(n = 20) { return Game.fadeIn(n); },
  flag(n) { return State.flag(n); },
  setFlag(n, v = true) { State.setFlag(n, v); if (this.scene) this.scene.refreshEvents(); },
  v(n) { return State.v(n); },
  setV(n, x) { State.setV(n, x); },
  addV(n, x = 1) { return State.addV(n, x); },
  refresh() { if (this.scene) this.scene.refreshEvents(); },

  async transfer(map, x, y, dir, o = {}) {
    const s = this.scene;
    if (s) await s.transfer(map, x, y, dir, o);
    else {
      await Game.fadeOut(o.fade || 16);
      Game.setScene(new MapScene(map, x, y, dir, o));
      await Game.wait(4);
      await Game.fadeIn(o.fade || 16);
    }
    await Game.wait(2);
  },
  // switch map while the screen is already faded out (no fade in)
  place(map, x, y, dir, o = {}) {
    Game.setScene(new MapScene(map, x, y, dir, o));
    return Game.wait(3);
  },

  // ----- items -----
  async give(id, n = 1, o = {}) {
    State.addItem(id, n);
    if (o.silent) return;
    const it = ITEMS[id];
    if (it && it.type === 'key') Sound.jingle('jingle_item', { duck: 0.3 }); else Sound.sfx('sfx_item');
    await this.say(null, `Got ${n > 1 ? n + ' ' : ''}{c:orange}${it ? it.name : id}{/c}!`);
  },
  take(id, n = 1) { State.removeItem(id, n); },
  has(id) { return State.hasItem(id); },
  async marbles(n, o = {}) {
    State.d.marbles += n;
    if (o.silent) return;
    Sound.sfx('sfx_item');
    await this.say(null, `Found {c:blue}${n} marble${n === 1 ? '' : 's'}{/c}!`);
  },

  // ----- battle -----
  battle(troop, o = {}) {
    const s = this.scene;
    return Battle.start(troop, Object.assign({ map: s }, o));
  },

  // ----- characters -----
  char(id) {
    const s = this.scene;
    if (!s) return null;
    if (id === 'player' || id === State.d.party[0]) return s.player;
    return s.followers.find((f) => f.id === id) || s.events.find((e) => e.id === id) || null;
  },
  // path: "L3 U2 R" or "LLUU"; letters L R U D; 'W' = wait a few frames; '<' '>' '^' 'v' = turn
  move(id, path, o = {}) {
    const c = typeof id === 'string' ? this.char(id) : id;
    if (!c) return Promise.resolve();
    if (c.kind === 'follower') c.detached = true;
    const map = { L: 'left', R: 'right', U: 'up', D: 'down' };
    const turn = { '<': 'left', '>': 'right', '^': 'up', v: 'down' };
    const cmds = [];
    const toks = path.match(/[LRUDW<>^v]\d*/g) || [];
    for (const tk of toks) {
      const n = tk.length > 1 ? parseInt(tk.slice(1), 10) : 1;
      if (tk[0] === 'W') cmds.push({ wait: 10 * n });
      else if (turn[tk[0]]) cmds.push({ turn: turn[tk[0]] });
      else for (let i = 0; i < n; i++) cmds.push({ dir: map[tk[0]], force: o.through, speed: o.speed, tries: 0, skipBlocked: o.skipBlocked });
    }
    if (o.speed) c.speed = o.speed;
    const promises = cmds.map((cmd) => new Promise((r) => { cmd.resolve = r; }));
    c.queue.push(...cmds);
    const all = Promise.all(promises);
    return o.wait === false ? Promise.resolve() : all;
  },
  face(id, dir) {
    const c = typeof id === 'string' ? this.char(id) : id;
    if (!c) return;
    if (U.dirVec[dir]) c.dir = dir;
    else { const o = this.char(dir); if (o) c.dir = U.dirFromVec(o.x - c.x, o.y - c.y); }
  },
  async hop(id, h = 14, n = 16) {
    const c = typeof id === 'string' ? this.char(id) : id;
    if (!c) return;
    for (let i = 0; i <= n; i++) { c.hop = Math.sin((i / n) * Math.PI) * h; await Game.wait(1); }
    c.hop = 0;
  },
  balloon(id, type, n = 70) {
    const c = typeof id === 'string' ? this.char(id) : id;
    if (c) c.balloon = { type, t: 0, n };
    return Game.wait(Math.min(n, 40));
  },
  show(id, v = true) { const c = this.char(id); if (c) c.visible = v; },
  removeEvent(id) { const s = this.scene; if (s) s.removeEvent(id); },
  // spawn a temporary event/NPC on the current map
  spawn(o) {
    const s = this.scene;
    if (!s) return null;
    const ev = s.addEvent(Object.assign({ trigger: 'none' }, o));
    if (ev) ev.dynamic = true;
    return ev;
  },
  setPos(id, x, y, dir) {
    const c = typeof id === 'string' ? this.char(id) : id;
    if (!c) return;
    c.x = x; c.y = y; c.fx = x; c.fy = y; c.moving = false; c.queue = [];
    if (dir) c.dir = dir;
    const s = this.scene;
    if (s && c === s.player) { s.trail = []; for (const f of s.followers) if (!f.detached) { f.x = x; f.y = y; f.fx = x; f.fy = y; f.dir = dir || f.dir; } }
  },
  // put followers back into formation behind the player
  async regroup(animate = true) {
    const s = this.scene;
    if (!s) return;
    const p = s.player;
    if (animate) {
      const moves = [];
      for (const f of s.followers) {
        if (!f.detached) continue;
        const dx = p.x - f.x, dy = p.y - f.y;
        let path = '';
        if (dy) path += (dy > 0 ? 'D' : 'U') + Math.abs(dy);
        if (dx) path += (dx > 0 ? 'R' : 'L') + Math.abs(dx);
        if (path) moves.push(this.move(f, path, { through: true }));
      }
      await Promise.all(moves);
    }
    for (const f of s.followers) { f.detached = false; f.x = p.x; f.y = p.y; f.fx = p.x; f.fy = p.y; f.dir = p.dir; f.queue = []; }
    s.trail = [];
  },

  // ----- audio / screen -----
  sfx(id, o) { Sound.sfx(id, o); },
  bgm(id, o) { Sound.playBgm(id, o); },
  stopBgm(fade = 1) { Sound.stopBgm(fade); },
  amb(id, o) { Sound.playAmb(id, o); },
  stopAmb(fade = 1) { Sound.stopAmb(fade); },
  async jingle(id) { await Sound.jingle(id); },
  shake(p = 6, n = 20) { if (State.options.screenShake) Game.shake(p, n); },
  flash(c = '#fff', a = 0.8, n = 16) { Game.flash(c, a, n); },
  async tint(color, a, n = 30) {
    const s = this.scene;
    if (!s) return;
    s.tint.color = color;
    await Game.tween(s.tint, { a }, n);
  },
  async picture(id, o = {}) {
    const s = this.scene;
    const pic = Object.assign({ id, alpha: 0 }, o);
    const host = s || Game.scene;
    host.pictures = host.pictures || [];
    host.pictures.push(pic);
    Assets.load(id);
    await Game.tween(pic, { alpha: o.alphaTo != null ? o.alphaTo : 1 }, o.fade || 30);
    return pic;
  },
  async hidePicture(pic, n = 30) {
    const host = this.scene || Game.scene;
    if (!pic || !host || !host.pictures) return;
    await Game.tween(pic, { alpha: 0 }, n);
    host.pictures = host.pictures.filter((p) => p !== pic);
  },
  async cam(x, y, n = 40) {
    const s = this.scene;
    if (!s) return;
    s.camPan = true;
    const tx = s.clampCamX(x * TS + TS / 2 - Game.W / 2), ty = s.clampCamY(y * TS + TS / 2 - Game.H / 2);
    await Game.tween(s, { camX: tx, camY: ty }, n, U.ease.inOutSine);
  },
  async camBack(n = 40) {
    const s = this.scene;
    if (!s) return;
    const p = s.player;
    await Game.tween(s, { camX: s.clampCamX(p.px - Game.W / 2), camY: s.clampCamY(p.py - 36 - Game.H / 2) }, n, U.ease.inOutSine);
    s.camPan = false;
  },
  weather(w) { const s = this.scene; if (s) s.weather = w; },
  darkness(v) { const s = this.scene; if (s) s.darkness = v; },
  lightRadius(v) { const s = this.scene; if (s) s.lightRadius = v; },

  // ----- party / world -----
  addParty(id) { State.addParty(id); },
  removeParty(id) { State.removeParty(id); },
  world(w) { State.d.world = w; },
  healAll() { State.healAll(); },
  async rest() {
    State.healAll();
    Sound.sfx('sfx_heal');
    this.flash('#fff8dc', 0.5, 30);
    await this.wait(20);
  },
  save() { return SaveMenu.open('save'); },
  shop(stock, o) { return Shop.open(stock, o); },
  async card(title, sub, o = {}) { await Cutscene.card(title, sub, o); },

  // generic save point interaction
  async savePoint(label) {
    await this.rest();
    const i = await this.ask(null, label || 'A little light glows softly. Everyone feels rested.', ['Save', 'Not now'], null, 1);
    if (i === 0) await this.save();
  },
};

window.Events = Events; window.E = E;
