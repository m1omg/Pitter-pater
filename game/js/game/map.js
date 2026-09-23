'use strict';
// ---------------------------------------------------------------------------
// Overworld: tile maps with procedural ground, prop sprites, characters,
// followers, NPC/event objects, visible enemies, weather and lighting.
// ---------------------------------------------------------------------------
const MAPS = {};
const WALK_SPEED = 1 / 12;   // tiles per frame (5 tiles/s)
const RUN_SPEED = 1 / 7.5;   // 8 tiles/s

// ---------------------------------------------------------------------------
class Char {
  constructor(o) {
    Object.assign(this, {
      id: null, kind: 'npc', x: 0, y: 0, dir: 'down', sprite: null, dh: null,
      solid: true, visible: true, through: false, speed: WALK_SPEED,
      moving: false, t: 0, phase: 0, animT: Math.random() * 1000, alpha: 1, hop: 0,
      queue: [], detached: false, stun: 0, noBob: false, scale: 1, rot: 0, seed: Math.random() * 10,
    }, o);
    this.fx = this.x; this.fy = this.y;   // fractional tile position (for drawing)
    this.balloon = null;
  }
  get px() { return this.fx * TS + TS / 2; }
  get py() { return this.fy * TS + TS - 6; }

  startMove(dir, scene, force) {
    const [dx, dy] = U.dirVec[dir];
    this.dir = dir;
    const nx = this.x + dx, ny = this.y + dy;
    if (!force && !this.through && !scene.passable(nx, ny, this)) return false;
    this.fromX = this.x; this.fromY = this.y;
    this.x = nx; this.y = ny;
    this.moving = true; this.t = 0;
    if (this.kind === 'player' && scene && scene.trail) {
      scene.trail.unshift([this.fromX, this.fromY]);
      if (scene.trail.length > scene.followers.length + 1) scene.trail.length = scene.followers.length + 1;
    }
    return true;
  }

  update(scene) {
    this.animT++;
    if (this.moving) {
      this.t += this.speed;
      const p = Math.min(1, this.t);
      this.fx = U.lerp(this.fromX, this.x, p);
      this.fy = U.lerp(this.fromY, this.y, p);
      this.phase += this.speed * Math.PI;
      if (p >= 1) {
        this.moving = false;
        this.fx = this.x; this.fy = this.y;
        if (this.onArrive) { const f = this.onArrive; this.onArrive = null; f(); }
      }
    } else {
      this.phase = 0;
    }
    if (!this.moving && this.queue.length) {
      const cmd = this.queue[0];
      if (cmd.turn) { this.dir = cmd.turn; this.queue.shift(); cmd.resolve && cmd.resolve(); }
      else if (cmd.wait) { if (--cmd.wait <= 0) { this.queue.shift(); cmd.resolve && cmd.resolve(); } }
      else if (this.startMove(cmd.dir, scene, cmd.force)) {
        if (cmd.speed) this.speed = cmd.speed;
        this.queue.shift();
        const r = cmd.resolve;
        if (r) this.onArrive = r;
      } else if (cmd.skipBlocked || ++cmd.tries > 90) { this.queue.shift(); cmd.resolve && cmd.resolve(); }
    }
    if (this.balloon) { this.balloon.t++; if (this.balloon.t > this.balloon.n) this.balloon = null; }
  }

  draw(ctx, t) {
    if (!this.visible || this.alpha <= 0) return;
    if (!this.sprite && !this.draw2 && this.kind === 'event') return; // invisible examine spots
    if (this.draw2) {
      ctx.save(); ctx.globalAlpha *= this.alpha; ctx.translate(this.px, this.py - this.hop);
      this.draw2(ctx, this, this.animT);
      ctx.restore();
      if (this.balloon) drawBalloon(ctx, this.px, this.py - (this.dh || 60) - 14, this.balloon);
      return;
    }
    Sprites.draw(ctx, this.sprite, this.px, this.py, this.dir, {
      moving: this.moving && !this.noBob, phase: this.phase, t: this.animT, alpha: this.alpha, dh: this.dh,
      hop: this.hop, scale: this.scale, rot: this.rot, seed: this.seed, still: this.still,
      shadowW: this.shadowW, frame: this.frame, flashA: this.flashA, bobAmp: this.bobAmp,
    });
    if (this.balloon) drawBalloon(ctx, this.px, this.py - (this.dh || 84) - 14, this.balloon);
  }
}

function drawBalloon(ctx, x, y, b) {
  const p = Math.min(1, b.t / 8);
  const s = U.ease.outBack(p);
  const fade = b.t > b.n - 8 ? (b.n - b.t) / 8 : 1;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.ellipse(0, -16, 22, 18, 0, 0, Math.PI * 2);
  ctx.moveTo(-6, -1); ctx.lineTo(0, 8); ctx.lineTo(6, -1);
  ctx.fillStyle = '#fffdf6'; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = Gfx.C.ink; ctx.stroke();
  const map = { '!': ['!', '#d94a4a'], '?': ['?', '#3f7fd1'], '...': ['...', '#6b5559'], heart: ['♥', '#e0567b'], note: ['♪', '#7d59b5'], zzz: ['z', '#7d73c8'], anger: ['#', '#d94a4a'], sweat: ['💧', '#3f7fd1'] };
  const [txt, col] = map[b.type] || [b.type, Gfx.C.ink];
  if (b.type === 'anger') {
    ctx.strokeStyle = col; ctx.lineWidth = 3;
    for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.beginPath(); ctx.arc(a * 6, -16 + c * 6, 5, 0, Math.PI * 0.8); ctx.stroke();
    }
  } else if (b.type === 'sweat') {
    ctx.fillStyle = '#7fb2ec'; Gfx.drop(ctx, 0, -18, 9); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = Gfx.C.ink; ctx.stroke();
  } else Gfx.text(ctx, txt, 0, -6, { size: 26, font: Gfx.BOLD, align: 'center', color: col });
  ctx.restore();
}

// ---------------------------------------------------------------------------
class Prop {
  constructor(o) {
    const def = PROPS[o.id] || {};
    Object.assign(this, { layer: 'mid', foot: [1, 1], ox: 0, oy: 0, solid: true, shadow: true, dh: 60 }, def, o);
    this.fw = this.foot[0]; this.fh = this.foot[1];
    this.animT = Math.random() * 1000;
    this.visible = this.visible !== false;
  }
  get baseY() { return (this.y + this.fh) * TS + (this.sortOff || 0); }
  draw(ctx, t) {
    if (!this.visible) return;
    const cx = (this.x + this.fw / 2) * TS + this.ox;
    const by = (this.y + this.fh) * TS + this.oy;
    const img = Assets.get(this.img);
    ctx.save();
    if (this.alpha != null) ctx.globalAlpha = this.alpha;
    if (this.shadow && this.layer === 'mid') {
      ctx.save();
      ctx.globalAlpha *= 0.16; ctx.fillStyle = '#2a1a2a';
      ctx.beginPath(); ctx.ellipse(cx, by - 4, this.fw * TS * 0.45, Math.min(14, this.fh * TS * 0.3), 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    let sx = 1, sy = 1, rot = 0, dy = 0;
    const tt = t + this.animT;
    if (this.anim === 'sway') rot = Math.sin(tt * 0.025) * 0.025;
    if (this.anim === 'bob') dy = Math.sin(tt * 0.05) * 3;
    if (this.anim === 'breathe') { sy = 1 + Math.sin(tt * 0.04) * 0.015; sx = 2 - sy; }
    if (this.anim === 'flicker') ctx.globalAlpha *= 0.85 + Math.sin(tt * 0.3) * 0.08 + Math.random() * 0.07;
    ctx.translate(cx, by + dy);
    ctx.rotate(rot);
    ctx.scale(sx * (this.flip ? -1 : 1), sy);
    if (img) {
      const dh = this.dh, dw = this.dw || dh * (img.width / img.height);
      ctx.drawImage(img, -dw / 2, -dh, dw, dh);
    } else if (this.draw2) {
      this.draw2(ctx, this, tt);
    } else {
      const w = this.dw || this.fw * TS * 0.9;
      Gfx.placeholder(ctx, -w / 2, -this.dh, w, this.dh, this.id);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
class MapScene {
  constructor(mapId, x, y, dir, opts = {}) {
    this.mapId = mapId;
    this.startX = x; this.startY = y; this.startDir = dir || 'down';
    this.opts = opts;
    this.t = 0;
    this.particles = [];
    this.fxParticles = [];
    this.bannerT = 0;
    this.pictures = [];
    this.tint = { color: '#000', a: 0 };
  }

  enter() {
    if (!this.loaded) this.load();
  }

  load() {
    const def = MAPS[this.mapId];
    if (!def) throw new Error('Unknown map ' + this.mapId);
    this.def = def;
    def.id = this.mapId;
    this.w = def.tiles[0].length; this.h = def.tiles.length;
    def.w = this.w; def.h = this.h;
    // legend (defaults + map specific)
    const legend = Object.assign({ '#': 'void', ' ': 'void' }, def.legend || {});
    def.legendFull = {};
    for (const k in legend) def.legendFull[k] = typeof legend[k] === 'string' ? { mat: legend[k] } : legend[k];
    // collision from materials
    this.block = [];
    for (let y = 0; y < this.h; y++) {
      this.block.push([]);
      for (let x = 0; x < this.w; x++) {
        const L = def.legendFull[def.tiles[y][x]] || { mat: 'void' };
        const md = Materials.defs[L.mat] || Materials.defs.void;
        const walk = L.walk != null ? L.walk : md.walk;
        this.block[y].push(!walk);
      }
    }
    this.ground = Materials.paintGround(def);
    // props
    this.props = (def.props || []).filter((p) => !p.cond || p.cond()).map((p) => new Prop(Array.isArray(p) ? Object.assign({ id: p[0], x: p[1], y: p[2] }, p[3] || {}) : p));
    for (const p of this.props) {
      if (p.solid && p.layer === 'mid') {
        const fx = p.solidFoot || [0, 0, p.fw, p.fh];
        for (let yy = 0; yy < fx[3]; yy++) for (let xx = 0; xx < fx[2]; xx++) this.setBlock(p.x + fx[0] + xx, p.y + fx[1] + yy, true);
      }
    }
    for (const [x, y] of def.walls || []) this.setBlock(x, y, true);
    for (const [x, y] of def.open || []) this.setBlock(x, y, false);
    // player & followers
    const world = State.d.world;
    this.player = new Char({ id: 'player', kind: 'player', x: this.startX, y: this.startY, dir: this.startDir, sprite: charSprite(State.d.party[0], world), solid: true });
    this.followers = [];
    if (!def.noFollowers) {
      if (world === 'real') {
        if (!def.noPets) for (const id of State.d.pets || []) this.followers.push(new Char({ id, kind: 'follower', x: this.startX, y: this.startY, dir: this.startDir, sprite: charSprite(id, 'real'), solid: false, dh: id === 'waffles' ? 58 : 48, shadowW: 16 }));
      } else {
        for (const id of State.d.party.slice(1)) {
          this.followers.push(new Char({ id, kind: 'follower', x: this.startX, y: this.startY, dir: this.startDir, sprite: charSprite(id, world), solid: false }));
        }
      }
    }
    this.trail = [];
    // events / npcs
    this.events = [];
    for (const e of def.events || []) this.addEvent(e);
    // enemies
    this.enemies = [];
    for (const en of def.enemies || []) {
      if (en.cond && !en.cond()) continue;
      if (en.flag && State.flag(en.flag)) continue;
      const c = new Char(Object.assign({ kind: 'enemy', solid: false, speed: 1 / 16 }, en, { id: 'enemy_' + this.enemies.length }));
      c.home = [en.x, en.y];
      c.wanderT = U.randInt(30, 120);
      this.enemies.push(c);
    }
    this.snapCamera();
    this.loaded = true;
    // weather
    this.weather = def.weather || null;
    // record
    State.d.map = this.mapId;
    State.d.location = def.area || def.name || '';
    const firstVisit = !State.d.seenMaps[this.mapId];
    State.d.seenMaps[this.mapId] = true;
    // banner when entering a new area name
    if (def.area && MapScene.lastArea !== def.area && !this.opts.noBanner) { this.bannerT = 1; this.bannerText = def.area; }
    MapScene.lastArea = def.area;
    // audio
    const bgm = typeof def.bgm === 'function' ? def.bgm() : def.bgm;
    if (bgm !== undefined && !this.opts.keepMusic) { if (bgm) Sound.playBgm(bgm, { volume: def.bgmVol || 1 }); else Sound.stopBgm(1); }
    const amb = typeof def.amb === 'function' ? def.amb() : def.amb;
    if (amb) Sound.playAmb(amb, { volume: def.ambVol || 0.8 }); else Sound.stopAmb(1.2);
    // warm up the music of neighbouring maps (decoded in the background)
    setTimeout(() => {
      for (const ex of (def.exits || []).slice(0, 3)) {
        const t = MAPS[ex.to];
        const id = t && (typeof t.bgm === 'function' ? t.bgm() : t.bgm);
        if (id && id !== bgm) Sound.load(id);
      }
    }, 1500);
    // preload art
    Assets.loadMany([this.player.sprite, ...this.followers.map((f) => f.sprite), ...this.events.map((e) => e.sprite), ...this.enemies.map((e) => e.sprite), ...this.props.map((p) => p.img)]);
    // scripts
    this.pendingEnter = { first: firstVisit };
  }

  addEvent(e) {
    if (e.cond && !e.cond()) return null;
    const ev = new Char(Object.assign({ kind: 'event', solid: !!e.sprite, trigger: 'action' }, e));
    ev.def = e;
    this.events.push(ev);
    return ev;
  }
  removeEvent(id) { this.events = this.events.filter((e) => e.id !== id); }
  event(id) { return this.events.find((e) => e.id === id) || null; }
  refreshEvents() {
    // re-evaluate conditions (after flags change)
    const keep = {};
    for (const e of this.events) keep[e.id] = e;
    const dynamic = this.events.filter((e) => e.dynamic);
    this.events = [];
    for (const e of this.def.events || []) {
      if (e.cond && !e.cond()) continue;
      if (keep[e.id]) this.events.push(keep[e.id]); else this.addEvent(e);
    }
    for (const d of dynamic) if (!this.events.includes(d)) this.events.push(d);
    for (const p of this.props) if (p.cond) p.visible = p.cond();
  }

  setBlock(x, y, v) { if (y >= 0 && y < this.h && x >= 0 && x < this.w) this.block[y][x] = v; }

  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  passable(x, y, who) {
    if (!this.inBounds(x, y)) return false;
    if (this.block[y][x]) return false;
    for (const e of this.events) {
      if (e === who || !e.solid || !e.visible) continue;
      if (e.x === x && e.y === y) return false;
      if (e.w && x >= e.x && x < e.x + e.w && y >= e.y && y < e.y + (e.h || 1)) return false;
    }
    if (who && who.kind !== 'player' && this.player && this.player.x === x && this.player.y === y) return false;
    if (who && who.kind === 'enemy') {
      for (const en of this.enemies) if (en !== who && en.x === x && en.y === y) return false;
    }
    return true;
  }

  eventsAt(x, y) {
    return this.events.filter((e) => e.visible !== false && (e.w ? x >= e.x && x < e.x + e.w && y >= e.y && y < e.y + (e.h || 1) : e.x === x && e.y === y));
  }

  // ---------------------------------------------------------------------
  get controlsEnabled() {
    return !Events.running && Game.overlays.length === 0 && !this.transferring && !this.inBattle;
  }

  update() {
    this.t++;
    if (this.pendingEnter) {
      const pe = this.pendingEnter;
      this.pendingEnter = null;
      Events.onMapEnter(this, pe.first);
    }
    if (this.controlsEnabled) Game.playTime += 1 / 60;
    if (State.d) State.d.playTime = Game.playTime;
    const p = this.player;
    // player control
    if (this.controlsEnabled) {
      const run = State.options.alwaysRun ? !Input.isHeld('run') : Input.isHeld('run');
      if (!p.moving) {
        p.speed = run ? RUN_SPEED : WALK_SPEED;
        const d = Input.dir4();
        if (d) this.tryPlayerMove(d);
        if (!p.moving) {
          if (Input.isPressed('ok')) { Input.consume('ok'); this.checkAction(); }
          else if (Input.isPressed('cancel') || Input.isPressed('menu')) { Input.consume('cancel'); Input.consume('menu'); if (!this.def.noMenu) Menu.open(); }
        }
      }
    }
    p.update(this);
    for (const f of this.followers) {
      if (!f.detached && !f.moving && !f.queue.length) {
        const i = this.followers.indexOf(f);
        const target = this.trail[i];
        if (target && (target[0] !== f.x || target[1] !== f.y)) {
          const dx = target[0] - f.x, dy = target[1] - f.y;
          if (Math.abs(dx) + Math.abs(dy) === 1) {
            f.speed = p.speed;
            f.startMove(U.dirFromVec(dx, dy), this, true);
          } else { f.x = target[0]; f.y = target[1]; f.fx = f.x; f.fy = f.y; }
        }
      }
      f.update(this);
    }
    for (const e of this.events) {
      this.updateNpc(e);
      e.update(this);
    }
    for (const en of this.enemies) this.updateEnemy(en);
    if (this.camPan) { /* scripted camera */ }
    else this.updateCamera();
    this.updateWeather();
    if (this.fxParticles.length) { for (const f of this.fxParticles) f.t++; this.fxParticles = this.fxParticles.filter((f) => f.t < f.life); }
    if (this.bannerT > 0) { this.bannerT++; if (this.bannerT > 260) this.bannerT = 0; }
    if (this.def.update) this.def.update(this);
  }

  tryPlayerMove(d) {
    const p = this.player;
    const [dx, dy] = U.dirVec[d];
    const nx = p.x + dx, ny = p.y + dy;
    p.dir = d;
    if (this.passable(nx, ny, p)) {
      p.startMove(d, this, true);
      p.onArrive = () => this.onPlayerStep();
    } else {
      const push = this.eventsAt(nx, ny).find((e) => e.pushable && !e.moving);
      if (push) { this.tryPush(push, d); return; }
      // bump into something: touch-triggered solid events / exits beyond the edge
      const evs = this.eventsAt(nx, ny).filter((e) => e.trigger === 'touch' || e.trigger === 'bump');
      if (evs.length) this.runEvent(evs[0]);
      else this.checkExit(nx, ny, d);
    }
  }

  tryPush(ev, d) {
    const [dx, dy] = U.dirVec[d];
    const tx = ev.x + dx, ty = ev.y + dy;
    if (!this.inBounds(tx, ty)) return;
    const intoHole = ev.def.sinkInto && ev.def.sinkInto(this, tx, ty);
    if (!intoHole && !this.passable(tx, ty, ev)) { if (!ev._bumpT || this.t - ev._bumpT > 30) { Sound.sfx('sfx_buzzer', { volume: 0.3 }); ev._bumpT = this.t; } return; }
    Sound.sfx('sfx_push', { volume: 0.7 });
    ev.speed = 1 / 14;
    ev.startMove(d, this, true);
    ev.onArrive = () => { if (ev.def.onPushed) Events.run(async (E) => ev.def.onPushed(E, ev, this)); };
  }

  onPlayerStep() {
    State.d.steps++;
    const p = this.player;
    if (this.weather === 'rain' || this.weather === 'storm' || this.weather === 'drizzle') {
      const x = p.px, y = p.py - 2;
      this.fxParticles.push({
        t: 0, life: 18,
        draw(ctx) {
          const k = this.t / this.life;
          ctx.save();
          ctx.globalAlpha = 0.55 * (1 - k);
          ctx.strokeStyle = '#e8f0ff'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.ellipse(x, y, 6 + k * 16, 2 + k * 5, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        },
      });
    }
    const evs = this.eventsAt(p.x, p.y).filter((e) => e.trigger === 'touch' && !e.solid);
    if (evs.length) { this.runEvent(evs[0]); return; }
    this.checkExit(p.x, p.y, p.dir);
  }

  checkExit(x, y, dir) {
    for (const ex of this.def.exits || []) {
      if (ex.cond && !ex.cond()) continue;
      const w = ex.w || 1, h = ex.h || 1;
      if (x >= ex.x && x < ex.x + w && y >= ex.y && y < ex.y + h) {
        if (ex.dir && ex.dir !== dir) continue;
        const tx = ex.tx + (ex.keepX ? x - ex.x : 0), ty = ex.ty + (ex.keepY ? y - ex.y : 0);
        if (ex.run) { Events.run(async (E) => ex.run(E)); return true; }
        this.transfer(ex.to, tx, ty, ex.tdir || dir, { sfx: ex.sfx });
        return true;
      }
    }
    return false;
  }

  checkAction() {
    const p = this.player;
    const [dx, dy] = U.dirVec[p.dir];
    let evs = this.eventsAt(p.x + dx, p.y + dy).filter((e) => e.trigger === 'action');
    if (!evs.length) {
      // counters: look two tiles ahead if the tile in front is blocked and the event has counter:true
      const ev2 = this.eventsAt(p.x + dx * 2, p.y + dy * 2).filter((e) => e.trigger === 'action' && e.counter);
      if (ev2.length && this.block[p.y + dy] && this.block[p.y + dy][p.x + dx]) evs = ev2;
    }
    if (!evs.length) evs = this.eventsAt(p.x, p.y).filter((e) => e.trigger === 'action' && !e.solid);
    if (evs.length) this.runEvent(evs[0], true);
  }

  runEvent(ev, faceP) {
    if (!ev.def || !ev.def.run) return;
    Events.run(async (E) => {
      const face = ev.def.face !== false && faceP && ev.sprite && ev.kind === 'event';
      const oldDir = ev.dir;
      if (face) ev.dir = U.opposite[this.player.dir];
      await ev.def.run(E, ev);
      if (face && ev.def.faceBack !== false && ev.def.move !== 'wander') ev.dir = ev.def.dir || oldDir;
      if (ev.def.once) State.setFlag(ev.def.once);
      this.refreshEvents();
    });
  }

  updateNpc(e) {
    if (!e.def || e.moving || e.queue.length || Events.running) return;
    if (e.def.move === 'wander') {
      if (--e.wanderT > 0) return;
      e.wanderT = U.randInt(60, 200);
      const d = U.pick(['up', 'down', 'left', 'right']);
      const [dx, dy] = U.dirVec[d];
      const hx = e.def.x, hy = e.def.y, r = e.def.radius || 2;
      if (Math.abs(e.x + dx - hx) <= r && Math.abs(e.y + dy - hy) <= r) { e.speed = 1 / 22; e.startMove(d, this); }
    } else if (e.def.move === 'look') {
      if (--e.wanderT > 0) return;
      e.wanderT = U.randInt(90, 240);
      e.dir = U.pick(['up', 'down', 'left', 'right']);
    }
    if (e.wanderT == null) e.wanderT = U.randInt(30, 120);
  }

  updateEnemy(en) {
    en.update(this);
    if (en.dead) return;
    if (en.stun > 0) { en.stun--; en.alpha = en.stun % 10 < 5 ? 0.4 : 0.9; return; }
    en.alpha = 1;
    const p = this.player;
    // contact
    const d = Math.hypot(en.px - p.px, en.py - p.py);
    if (d < TS * 0.7 && this.controlsEnabled && !this.invuln) { this.encounter(en); return; }
    if (this.invuln > 0) this.invuln--;
    if (en.moving || !this.controlsEnabled) return;
    const dx = p.x - en.x, dy = p.y - en.y;
    const dist = Math.abs(dx) + Math.abs(dy);
    const chase = en.chase != null ? en.chase : 4;
    if (dist <= chase && chase > 0) {
      if (!en.noticed) { en.noticed = true; en.balloon = { type: '!', t: 0, n: 40 }; en.pause = 24; }
      if (en.pause > 0) { en.pause--; return; }
      en.speed = en.chaseSpeed || 1 / 11;
      const dirs = [];
      if (dx) dirs.push(dx > 0 ? 'right' : 'left');
      if (dy) dirs.push(dy > 0 ? 'down' : 'up');
      if (Math.abs(dy) > Math.abs(dx)) dirs.reverse();
      for (const dd of dirs) if (this.passableEnemy(en, dd)) { en.startMove(dd, this, true); return; }
    } else {
      en.noticed = false;
      if (--en.wanderT > 0) return;
      en.wanderT = U.randInt(50, 140);
      const dd = U.pick(['up', 'down', 'left', 'right']);
      const [ddx, ddy] = U.dirVec[dd];
      const r = en.radius || 2;
      if (Math.abs(en.x + ddx - en.home[0]) <= r && Math.abs(en.y + ddy - en.home[1]) <= r && this.passableEnemy(en, dd)) {
        en.speed = 1 / 18; en.startMove(dd, this, true);
      }
    }
  }
  passableEnemy(en, dir) {
    const [dx, dy] = U.dirVec[dir];
    const nx = en.x + dx, ny = en.y + dy;
    if (!this.inBounds(nx, ny) || this.block[ny][nx]) return false;
    for (const e of this.events) if (e.solid && e.x === nx && e.y === ny) return false;
    for (const o of this.enemies) if (o !== en && !o.dead && o.x === nx && o.y === ny) return false;
    // don't walk onto exits
    for (const ex of this.def.exits || []) if (nx >= ex.x && nx < ex.x + (ex.w || 1) && ny >= ex.y && ny < ex.y + (ex.h || 1)) return false;
    return true;
  }

  async encounter(en) {
    if (this.inBattle) return;
    this.inBattle = true;
    Events.running++;
    try {
      const res = await Battle.start(en.troop, { map: this, enemyChar: en });
      if (res === 'win') { en.dead = true; this.enemies = this.enemies.filter((e) => e !== en); if (en.flag) State.setFlag(en.flag); }
      else if (res === 'escape') { en.stun = 150; this.invuln = 90; }
      else if (res === 'lose') { /* handled by battle (game over) */ }
    } finally {
      Events.running--;
      this.inBattle = false;
    }
  }

  async transfer(mapId, x, y, dir, o = {}) {
    if (this.transferring) return;
    this.transferring = true;
    Events.running++;
    try {
      if (o.sfx !== false) Sound.sfx(o.sfx || 'sfx_transfer', { volume: 0.5 });
      await Game.fadeOut(o.fade != null ? o.fade : 16, o.color || '#000');
      const scene = new MapScene(mapId, x, y, dir, o);
      Game.setScene(scene);
      await Game.wait(4);
      await Game.fadeIn(o.fade != null ? o.fade : 16);
    } finally {
      Events.running--;
      this.transferring = false;
    }
  }

  // ---------------------------------------------------------------------
  snapCamera() {
    const p = this.player;
    this.camX = this.clampCamX(p.px - Game.W / 2);
    this.camY = this.clampCamY(p.py - 36 - Game.H / 2);
  }
  clampCamX(x) { const mw = this.w * TS; return mw <= Game.W ? (mw - Game.W) / 2 : U.clamp(x, 0, mw - Game.W); }
  clampCamY(y) { const mh = this.h * TS; return mh <= Game.H ? (mh - Game.H) / 2 : U.clamp(y, 0, mh - Game.H); }
  updateCamera() {
    const p = this.camFollow || this.player;
    const tx = this.clampCamX(p.px - Game.W / 2), ty = this.clampCamY(p.py - 36 - Game.H / 2);
    this.camX += (tx - this.camX) * 0.25;
    this.camY += (ty - this.camY) * 0.25;
    if (Math.abs(tx - this.camX) < 0.3) this.camX = tx;
    if (Math.abs(ty - this.camY) < 0.3) this.camY = ty;
  }

  // ---------------------------------------------------------------------
  updateWeather() {
    const w = this.weather;
    if (!w) { this.particles.length = 0; return; }
    const density = { drizzle: 1, rain: 3, storm: 6, motes: 0.3, snow: 1, static: 2 }[w] || 0;
    const n = Math.floor(density) + (Math.random() < density % 1 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      if (w === 'motes') this.particles.push({ x: Math.random() * Game.W, y: Math.random() * Game.H, vx: (Math.random() - 0.5) * 0.3, vy: -0.1 - Math.random() * 0.2, life: 240, max: 240, r: 1 + Math.random() * 2 });
      else if (w === 'static') this.particles.push({ x: Math.random() * Game.W, y: Math.random() * Game.H, vx: 0, vy: 0, life: 6, max: 6, r: 1 + Math.random() * 3 });
      else if (w === 'snow') this.particles.push({ x: Math.random() * (Game.W + 100) - 50, y: -10, vx: -0.3 + Math.random() * 0.6, vy: 1 + Math.random(), life: 900, max: 900, r: 1.5 + Math.random() * 2 });
      else this.particles.push({ x: Math.random() * (Game.W + 200) - 100, y: -20, vx: -1.8, vy: 11 + Math.random() * 4, life: 90, max: 90, len: 12 + Math.random() * 10, ground: 60 + Math.random() * (Game.H - 40) });
    }
    for (const p of this.particles) {
      p.x += p.vx; p.y += p.vy; p.life--;
      if (p.ground && p.y > p.ground && !p.splash) {
        if (this.rainLands(p.x, p.y)) { p.splash = 1; p.vx = 0; p.vy = 0; p.life = Math.min(p.life, 10); }
        else p.life = 0;   // it hit a wall, a roof or something tall: no ripple hanging in mid-air
      }
      if (p.splash) p.splash++;
    }
    this.particles = this.particles.filter((p) => p.life > 0 && p.y < Game.H + 30);
  }

  // Can a raindrop landing at this screen point leave a ripple? Only on open floor or water:
  // not on walls or the void, and not on furniture, trees or people standing there.
  rainLands(sx, sy) {
    const wx = sx + this.camX, wy = sy + this.camY;
    const tx = Math.floor(wx / TS), ty = Math.floor(wy / TS);
    if (!this.inBounds(tx, ty)) return false;
    const L = this.def.legendFull[this.def.tiles[ty][tx]];
    const mat = L ? L.mat : 'void';
    if (mat === 'void' || mat === 'wall' || mat === 'hole') return false;
    for (const p of this.props) {
      if (!p.visible || p.layer === 'ground') continue;
      const img = Assets.get(p.img);
      const dw = p.dw || (img ? p.dh * (img.width / img.height) : p.fw * TS * 0.9);
      const cx = (p.x + p.fw / 2) * TS + p.ox, by = (p.y + p.fh) * TS + p.oy;
      if (wx > cx - dw / 2 && wx < cx + dw / 2 && wy > by - p.dh && wy < by) return false;
    }
    for (const c of [this.player, ...this.followers, ...this.events, ...this.enemies]) {
      if (c.visible && c.sprite && Math.abs(wx - c.px) < 22 && wy < c.py && wy > c.py - (c.dh || 84)) return false;
    }
    return true;
  }

  drawWeather(ctx) {
    const w = this.weather;
    if (!w) return;
    ctx.save();
    if (w === 'motes') {
      ctx.fillStyle = '#fff6d8';
      for (const p of this.particles) { ctx.globalAlpha = 0.5 * Math.sin((p.life / p.max) * Math.PI); ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
    } else if (w === 'static') {
      for (const p of this.particles) { ctx.globalAlpha = 0.35; ctx.fillStyle = Math.random() < 0.5 ? '#fff' : '#222'; ctx.fillRect(p.x, p.y, p.r * 3, p.r); }
    } else if (w === 'snow') {
      ctx.fillStyle = '#fff';
      for (const p of this.particles) { ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
    } else {
      ctx.strokeStyle = this.def.rainColor || 'rgba(190,210,255,0.55)';
      ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      for (const p of this.particles) {
        if (p.splash) {
          ctx.globalAlpha = 0.5 * (1 - p.splash / 12);
          ctx.beginPath(); ctx.ellipse(p.x, p.y, p.splash * 1.1, p.splash * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
        } else {
          ctx.globalAlpha = 0.7;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 1.2, p.y - p.len); ctx.stroke();
        }
      }
      if (w === 'storm' && Math.random() < 0.003) Game.flash('#ffffff', 0.35, 20);
    }
    ctx.restore();
  }

  // darkness with light holes
  drawLighting(ctx) {
    const dark = this.darkness != null ? this.darkness : this.def.dark;
    if (!dark) return;
    const k = 0.5;
    if (!this._lightC) { this._lightC = Gfx.makeCanvas(Game.W * k, Game.H * k); }
    const c = this._lightC, g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = this.def.darkColor || 'rgba(8,6,14,1)';
    g.globalAlpha = dark;
    g.fillRect(0, 0, c.width, c.height);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'destination-out';
    const lights = [];
    const pr = this.lightRadius != null ? this.lightRadius : (this.def.playerLight != null ? this.def.playerLight : 150);
    if (pr > 0) lights.push({ x: this.player.px, y: this.player.py - 30, r: pr * (0.97 + Math.sin(this.t * 0.07) * 0.02 + Math.random() * 0.02) });
    for (const pp of this.props) if (pp.light && pp.visible) lights.push({ x: (pp.x + pp.fw / 2) * TS + (pp.lx || 0), y: (pp.y + pp.fh) * TS - (pp.ly || pp.dh * 0.6), r: pp.light * (0.96 + Math.random() * 0.05) });
    for (const e of this.events) if (e.light && e.visible) lights.push({ x: e.px, y: e.py - 30, r: e.light });
    for (const L of lights) {
      const x = (L.x - this.camX) * k, y = (L.y - this.camY) * k, r = L.r * k;
      const grd = g.createRadialGradient(x, y, r * 0.15, x, y, r);
      grd.addColorStop(0, 'rgba(0,0,0,1)');
      grd.addColorStop(0.6, 'rgba(0,0,0,0.7)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    ctx.drawImage(c, 0, 0, Game.W, Game.H);
  }

  draw(ctx) {
    const cx = Math.round(this.camX * Game.k) / Game.k, cy = Math.round(this.camY * Game.k) / Game.k;
    ctx.save();
    ctx.translate(-cx, -cy);
    ctx.drawImage(this.ground, 0, 0);
    if (this.def.drawGround) this.def.drawGround(ctx, this);
    for (const p of this.props) if (p.layer === 'ground') p.draw(ctx, this.t);
    // y-sorted objects
    const objs = [];
    for (const p of this.props) if (p.layer === 'mid' && p.visible) objs.push({ y: p.baseY, o: p });
    const chars = [...this.events, ...this.enemies, ...this.followers.slice().reverse(), this.player];
    for (const c of chars) if (c.visible) objs.push({ y: c.py + (c.kind === 'player' ? 0.5 : 0) + (c.sortOff || 0), o: c });
    objs.sort((a, b) => a.y - b.y);
    for (const it of objs) it.o.draw(ctx, this.t);
    for (const p of this.props) if (p.layer === 'top' && p.visible) p.draw(ctx, this.t);
    for (const f of this.fxParticles) f.draw(ctx);
    if (this.def.drawOver) this.def.drawOver(ctx, this);
    if (Game.debugGrid) this.drawDebug(ctx);
    ctx.restore();
    this.drawWeather(ctx);
    this.drawLighting(ctx);
    if (this.def.tint) { ctx.fillStyle = this.def.tint; ctx.fillRect(0, 0, Game.W, Game.H); }
    if (this.tint.a > 0) { ctx.globalAlpha = this.tint.a; ctx.fillStyle = this.tint.color; ctx.fillRect(0, 0, Game.W, Game.H); ctx.globalAlpha = 1; }
    for (const pic of this.pictures) drawPicture(ctx, pic);
    if (this.def.vignette !== 0) Gfx.vignette(ctx, this.def.vignette || 0.3);
    if (window.Story && Story.drawHud) Story.drawHud(ctx, this);
    if (this.bannerT > 0) this.drawBanner(ctx);
  }

  drawDebug(ctx) {
    ctx.save();
    ctx.lineWidth = 1;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.strokeRect(x * TS, y * TS, TS, TS);
      if (this.block[y][x]) { ctx.fillStyle = 'rgba(255,0,0,0.22)'; ctx.fillRect(x * TS, y * TS, TS, TS); }
    }
    for (const e of this.events) { ctx.fillStyle = e.trigger === 'touch' ? 'rgba(255,160,0,0.35)' : 'rgba(0,90,255,0.3)'; ctx.fillRect(e.x * TS, e.y * TS, (e.w || 1) * TS, (e.h || 1) * TS); Gfx.text(ctx, e.id || '?', e.x * TS + 2, e.y * TS + 12, { size: 11, font: 'monospace', color: '#003' }); }
    for (const ex of this.def.exits || []) { ctx.fillStyle = 'rgba(0,200,0,0.35)'; ctx.fillRect(ex.x * TS, ex.y * TS, (ex.w || 1) * TS, (ex.h || 1) * TS); }
    const p = this.player;
    Gfx.text(ctx, `${p.x},${p.y}`, p.px, p.py - 90, { size: 16, font: 'monospace', align: 'center', color: '#fff', outline: '#000', outlineWidth: 3 });
    ctx.restore();
  }

  drawBanner(ctx) {
    const t = this.bannerT;
    const a = t < 30 ? U.ease.outBack(t / 30) : t > 220 ? 1 - U.ease.inQuad((t - 220) / 40) : 1;
    const text = this.bannerText;
    const w = Gfx.measure(ctx, text, 30, Gfx.BOLD) + 70;
    const x = 24 - (1 - a) * (w + 40), y = 24;
    Gfx.box(ctx, x, y, w, 56, { fill: '#fff3dc', radius: 18 });
    Gfx.icon(ctx, 'rain', x + 28, y + 28, 11);
    Gfx.text(ctx, text, x + 48, y + 39, { size: 30, font: Gfx.BOLD });
  }
}
MapScene.lastArea = null;

function drawPicture(ctx, pic) {
  const img = Assets.get(pic.id);
  ctx.save();
  ctx.globalAlpha = pic.alpha != null ? pic.alpha : 1;
  const w = pic.w || Game.W, h = pic.h || Game.H;
  const x = pic.x != null ? pic.x : (Game.W - w) / 2, y = pic.y != null ? pic.y : (Game.H - h) / 2;
  if (pic.bg) { ctx.fillStyle = pic.bg; ctx.fillRect(0, 0, Game.W, Game.H); }
  if (img) {
    // cover-fit
    const s = Math.max(w / img.width, h / img.height) * (pic.zoom || 1);
    const dw = img.width * s, dh = img.height * s;
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.drawImage(img, x + (w - dw) / 2 + (pic.panX || 0), y + (h - dh) / 2 + (pic.panY || 0), dw, dh);
  } else if (pic.draw) pic.draw(ctx, x, y, w, h);
  else Gfx.placeholder(ctx, x + 40, y + 40, w - 80, h - 80, pic.id);
  if (pic.overlay) pic.overlay(ctx, x, y, w, h);
  if (pic.frame) { ctx.lineWidth = 4; ctx.strokeStyle = Gfx.C.ink; ctx.strokeRect(x, y, w, h); }
  ctx.restore();
}

// sprite id for a party member in a world
function charSprite(id, world) {
  const ch = window.CHARACTERS && CHARACTERS[id];
  if (!ch) return 'chr_' + id;
  if (world === 'real' && ch.realSprite) return ch.realSprite;
  return ch.sprite || 'chr_' + id;
}

window.MAPS = MAPS; window.MapScene = MapScene; window.Char = Char; window.Prop = Prop; window.charSprite = charSprite; window.drawPicture = drawPicture; window.drawBalloon = drawBalloon;
