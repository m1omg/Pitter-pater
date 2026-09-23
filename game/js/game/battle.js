'use strict';
// ---------------------------------------------------------------------------
// Turn-based battles with moods (CHEERY / GLOOMY / HUFFY, blends, OVERWHELMED),
// a shared TOGETHER gauge, party cards at the bottom and enemies centre stage.
// ---------------------------------------------------------------------------
const GAUGE_MAX = 100;
const BUFF_MULT = { '-2': 0.65, '-1': 0.8, '0': 1, '1': 1.25, '2': 1.5 };

const Battle = {
  current: null,
  start(troopId, opts = {}) {
    const b = new BattleScene(troopId, opts);
    this.current = b;
    return b.begin().finally(() => { if (this.current === b) this.current = null; });
  },
};

class BattleScene {
  constructor(troopId, opts) {
    this.troopId = troopId;
    this.troop = TROOPS[troopId];
    if (!this.troop) throw new Error('Unknown troop ' + troopId);
    this.opts = opts;
    this.t = 0;
    this.pops = [];
    this.parts = [];
    this.logText = ''; this.logShown = 0; this.logWait = 0;
    this.ui = null;
    this.gauge = opts.gauge || 0;
    this.turn = 0;
    this.reserved = {};
    this.introT = 0;
    this.pictures = [];
    this.flags = {};
  }

  // ------------------------------------------------------------------ setup
  makeParty() {
    this.party = State.d.party.map((id, i) => {
      const a = State.actor(id), st = State.stats(id);
      const b = {
        side: 'party', id, name: ACTORS[id].name, idx: i,
        hp: Math.min(a.hp, st.maxhp), maxhp: st.maxhp, pep: Math.min(a.pep, st.maxpep), maxpep: st.maxpep,
        atk: st.atk, def: st.def, spd: st.spd, luck: st.luck,
        mood: 'neutral', moodLv: 0, statuses: {}, buffs: {}, actor: a, sticker: a.sticker ? ITEMS[a.sticker] : null,
        cardY: 0, shakeT: 0, hitT: 0, flashT: 0, ghostHp: 1, ghostPep: 1,
      };
      b.alive = b.hp > 0;
      return b;
    });
  }

  makeEnemy(id) {
    const d = ENEMIES[id];
    const e = {
      side: 'enemy', id, name: d.name, def_: d, hp: d.hp, maxhp: d.hp, pep: 0, maxpep: 0,
      atk: d.atk, def: d.def, spd: d.spd, luck: d.luck || 5, mood: 'neutral', moodLv: 0,
      statuses: {}, buffs: {}, alive: true, boss: !!d.boss, sprite: d.sprite, h: d.h || 180,
      x: Game.W / 2, y: 470, drawX: Game.W / 2, drop: 0, alpha: 1, shakeT: 0, flashT: 0, lunge: 0, ghostHp: 1, seed: Math.random() * 10,
      scale: 1,
    };
    if (d.startMood) { e.mood = d.startMood; e.moodLv = 1; }
    return e;
  }

  layoutEnemies(animate) {
    const list = this.enemies.filter((e) => e.alive || e.dying);
    const n = list.length;
    const spacing = Math.min(300, 800 / Math.max(1, n));
    list.forEach((e, i) => {
      e.x = Game.W / 2 + (i - (n - 1) / 2) * spacing;
      if (!animate) e.drawX = e.x;
    });
  }

  async begin() {
    this.prevScene = Game.scene;
    this.snapshot = State.snapshot();
    this.makeParty();
    this.enemies = this.troop.enemies.map((id) => this.makeEnemy(id));
    this.layoutEnemies(false);
    for (const e of this.enemies) e.drop = -600;
    // transition
    Sound.rememberBgm();
    Sound.sfx('sfx_encounter');
    if (!this.opts.noTransition) await this.transitionIn();
    Game.setScene(this);
    Sound.playBgm(this.opts.bgm || this.troop.bgm || 'bgm_battle', { fadeIn: 0.05, restart: true });
    Assets.loadMany([this.troop.bg, ...this.enemies.map((e) => e.sprite)]);
    await Game.fadeIn(14);
    return this.runAndResolve();
  }

  // runs the battle; handles defeat (retry / title) transparently for the caller
  async runAndResolve() {
    const result = await this.run();
    if (result === 'lose') {
      const choice = await this.defeat();
      if (choice === 'retry') {
        State.restore(this.snapshot);
        const again = new BattleScene(this.troopId, Object.assign({}, this.opts, { noTransition: true }));
        again.prevScene = this.prevScene;
        Battle.current = again;
        return again.beginRetry();
      }
      Title.open();
      return new Promise(() => {}); // the old game is abandoned
    }
    await this.end(result);
    return result;
  }

  async transitionIn() {
    const prev = this.prevScene;
    this.transT = 0;
    // swirl the map away
    const overlay = {
      t: 0,
      update() { this.t++; },
      draw: (ctx) => {
        const p = Math.min(1, overlay.t / 26);
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = p;
        const n = 12;
        for (let i = 0; i < n; i++) {
          const a0 = (i / n) * Math.PI * 2 + p * 2;
          ctx.beginPath();
          ctx.moveTo(Game.W / 2, Game.H / 2);
          ctx.arc(Game.W / 2, Game.H / 2, 900, a0, a0 + (Math.PI * 2 / n) * p);
          ctx.closePath();
          ctx.fillStyle = i % 2 ? '#fff6e0' : '#ffd6de';
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      },
    };
    Game.pushOverlay(overlay);
    Game.flash('#ffffff', 0.7, 10);
    await Game.wait(26);
    await Game.fadeOut(8, '#fff6e0');
    Game.removeOverlay(overlay);
  }

  async end(result) {
    await Game.fadeOut(24);
    this.pictures = [];
    // write back party state
    for (const b of this.party) {
      const a = State.actor(b.id);
      // tuckered-out members come back with 1 heart after battle, like a nap
      a.hp = b.alive ? Math.max(1, b.hp) : 1;
      a.pep = Math.max(0, b.pep);
    }
    if (result === 'lose') return;
    Game.setScene(this.prevScene);
    if (this.opts.keepMusic) Sound.memory = null; else Sound.restoreBgm(1.2);
    await Game.wait(2);
    Game.fadeIn(20);
  }

  // ------------------------------------------------------------------ main loop
  async run() {
    // intro
    Sound.sfx('sfx_menu_open', { volume: 0.5 });
    for (const e of this.enemies) Game.tween(e, { drop: 0 }, 30, U.ease.outBack);
    await Game.wait(30);
    // stickers that give starting moods
    for (const b of this.party) if (b.alive && b.sticker && b.sticker.startMood) this.setMood(b, b.sticker.startMood, 1);
    const names = [...new Set(this.enemies.map((e) => e.name))];
    await this.log(this.troop.intro || (this.enemies.length === 1 ? `${names[0]} blocks the way!` : `${names.join(' and ')} appear!`));
    if (this.troop.onStart) await this.troop.onStart(this);
    while (true) {
      this.turn++;
      if (this.troop.onTurnStart) await this.troop.onTurnStart(this, this.turn);
      const r = this.checkEnd();
      if (r) return this.finish(r);
      // command phase
      const cmd = await this.partyCommand();
      let actions = [];
      if (cmd === 'run') {
        const ok = await this.tryRun();
        if (ok) return 'escape';
      } else {
        actions = await this.collectActions();
        if (actions === 'run') { const ok = await this.tryRun(); if (ok) return 'escape'; actions = []; }
      }
      // enemies
      for (const e of this.enemies) if (e.alive) actions.push({ type: 'enemy', user: e });
      const speed = (b) => this.stat(b, 'spd') * U.rand(0.9, 1.1);
      for (const a of actions) a._spd = (a.priority ? 10000 : 0) + speed(a.user);
      actions.sort((a, b) => b._spd - a._spd);
      for (const act of actions) {
        await this.execute(act);
        const res = this.checkEnd();
        if (res) return this.finish(res);
      }
      await this.endOfTurn();
      const res = this.checkEnd();
      if (res) return this.finish(res);
      this.reserved = {};
    }
  }

  checkEnd() {
    if (this.forceResult) return this.forceResult;
    if (!this.enemies.some((e) => e.alive)) return 'win';
    if (!this.party.some((b) => b.alive)) return this.troop.noLose ? null : 'lose';
    return null;
  }

  async finish(r) {
    this.ui = null;
    if (r === 'win') await this.victory();
    if (r === 'lose') await this.log('Everyone is all tuckered out...', { hold: 60 });
    return r;
  }

  // ------------------------------------------------------------------ commands
  menu(ui) {
    return new Promise((resolve) => { ui.resolve = resolve; ui.index = ui.index || 0; ui.t = 0; this.ui = ui; });
  }
  closeMenu(val) {
    const ui = this.ui;
    this.ui = null;
    if (ui && ui.resolve) ui.resolve(val);
  }

  async partyCommand() {
    const canRun = !this.troop.noRun;
    const r = await this.menu({ type: 'party', options: ['FIGHT', 'RUN'], disabled: canRun ? [] : [1] });
    return r === 1 ? 'run' : 'fight';
  }

  actorCanChoose(b) {
    return b.alive && !b.statuses.sleepy && b.mood !== 'overwhelmed';
  }

  async collectActions() {
    const acts = [];
    const chooser = this.party.filter((b) => b.alive);
    let i = 0;
    while (i < chooser.length) {
      const b = chooser[i];
      if (!this.actorCanChoose(b)) { acts[i] = { type: 'skip', user: b }; i++; continue; }
      const a = await this.chooseAction(b);
      if (a === 'back') {
        // undo previous actor's choice
        let j = i - 1;
        while (j >= 0 && acts[j] && acts[j].type === 'skip') j--;
        if (j < 0) { const cmd = await this.partyCommand(); if (cmd === 'run') return 'run'; i = 0; acts.length = 0; this.reserved = {}; continue; }
        const prev = acts[j];
        if (prev && prev.item) this.reserved[prev.item] = (this.reserved[prev.item] || 1) - 1;
        if (prev && prev.type === 'together') this.gaugeReserved = false;
        acts.length = j;
        i = j;
        continue;
      }
      acts[i] = a;
      i++;
    }
    return acts.filter(Boolean);
  }

  commandOptions(b) {
    const opts = [];
    if (this.gauge >= GAUGE_MAX && !this.gaugeReserved && State.d.together.length) opts.push({ id: 'together', label: 'TOGETHER!' });
    opts.push({ id: 'attack', label: 'ATTACK' });
    opts.push({ id: 'skill', label: 'SKILLS', disabled: !!b.statuses.spooked });
    opts.push({ id: 'item', label: 'ITEMS' });
    opts.push({ id: 'guard', label: 'GUARD' });
    return opts;
  }

  async chooseAction(b) {
    while (true) {
      const opts = this.commandOptions(b);
      const r = await this.menu({ type: 'actor', actor: b, options: opts });
      if (r === 'back') return 'back';
      const id = opts[r].id;
      if (id === 'attack') {
        const t = await this.pickTarget(b, 'foe');
        if (t === 'back') continue;
        return { type: 'attack', user: b, target: t };
      }
      if (id === 'guard') return { type: 'guard', user: b, priority: true };
      if (id === 'skill') {
        const list = b.actor.skills.filter((s) => SKILLS[s] && (!SKILLS[s].hidden || State.flag('show_' + s)));
        const k = await this.menu({ type: 'list', mode: 'skill', actor: b, list, index: b.lastSkill || 0 });
        if (k === 'back') continue;
        const sk = list[k];
        b.lastSkill = k;
        const t = await this.pickTarget(b, SKILLS[sk].target);
        if (t === 'back') continue;
        return { type: 'skill', skill: sk, user: b, target: t, priority: !!SKILLS[sk].priority };
      }
      if (id === 'item') {
        const list = State.itemList((it) => it.type === 'treat' || it.type === 'trinket').filter((iid) => State.itemCount(iid) - (this.reserved[iid] || 0) > 0);
        if (!list.length) { Sound.sfx('sfx_buzzer'); this.flashNote('No items!'); continue; }
        const k = await this.menu({ type: 'list', mode: 'item', actor: b, list, index: 0 });
        if (k === 'back') continue;
        const iid = list[k];
        const t = await this.pickTarget(b, ITEMS[iid].target);
        if (t === 'back') continue;
        this.reserved[iid] = (this.reserved[iid] || 0) + 1;
        return { type: 'item', item: iid, user: b, target: t };
      }
      if (id === 'together') {
        const list = State.d.together;
        const k = await this.menu({ type: 'list', mode: 'together', actor: b, list, index: 0 });
        if (k === 'back') continue;
        const tg = list[k];
        const t = await this.pickTarget(b, TOGETHER[tg].target);
        if (t === 'back') continue;
        this.gaugeReserved = true;
        return { type: 'together', together: tg, user: b, target: t, priority: true };
      }
    }
  }

  async pickTarget(b, type) {
    const foes = this.enemies.filter((e) => e.alive);
    const allies = this.party.filter((p) => p.alive);
    if (type === 'self') return b;
    if (type === 'foes') return 'foes';
    if (type === 'allies') return 'allies';
    let cands;
    if (type === 'foe') cands = foes;
    else if (type === 'ally') cands = allies;
    else if (type === 'allyDown') cands = this.party.filter((p) => !p.alive);
    else cands = [...foes, ...allies];
    if (!cands.length) { Sound.sfx('sfx_buzzer'); this.flashNote('No one to choose!'); return 'back'; }
    let index = type === 'ally' ? Math.max(0, cands.indexOf(b)) : 0;
    const r = await this.menu({ type: 'target', actor: b, cands, index, ttype: type });
    if (r === 'back') return 'back';
    return cands[r];
  }

  flashNote(text) { this.note = { text, t: 0 }; }

  async tryRun() {
    const ps = this.party.filter((b) => b.alive), es = this.enemies.filter((e) => e.alive);
    const pa = ps.reduce((s, b) => s + this.stat(b, 'spd'), 0) / Math.max(1, ps.length);
    const ea = es.reduce((s, b) => s + this.stat(b, 'spd'), 0) / Math.max(1, es.length);
    const p = U.clamp(0.55 + (pa - ea) * 0.03 + (this.runTries || 0) * 0.15, 0.3, 0.95);
    this.runTries = (this.runTries || 0) + 1;
    await this.log('Everyone tries to run away...');
    if (Math.random() < p) {
      Sound.sfx('sfx_run');
      for (const b of this.party) Game.tween(b, { cardY: 200 }, 20, U.ease.inQuad);
      await this.log('Got away safely!');
      return true;
    }
    await this.log("...but they couldn't get away!");
    return false;
  }

  // ------------------------------------------------------------------ execution
  async execute(act) {
    const u = act.user;
    if (!u.alive) return;
    if (u.statuses.sleepy) {
      await this.log(`${u.name} is fast asleep... Zzz...`);
      return;
    }
    if (u.mood === 'overwhelmed') {
      await this.log(`${u.name} is too OVERWHELMED to do anything!`);
      this.setMood(u, 'neutral', 0);
      return;
    }
    if (u.mood === 'stormy' && Math.random() < MOODS.stormy.skip) {
      await this.log(`${u.name} is sulking and won't do anything.`);
      return;
    }
    if (act.type === 'skip') return;
    if (u.side === 'party') {
      u.acting = true;
      Game.tween(u, { cardY: -14 }, 8);
    }
    try {
      if (u.side === 'enemy') await this.enemyAct(u);
      else await this.partyAct(act);
    } finally {
      if (u.side === 'party') { u.acting = false; Game.tween(u, { cardY: 0 }, 10); }
    }
  }

  retarget(t, u) {
    if (t && t.alive) return t;
    if (t && t.side === 'enemy') return this.randomAlive(this.enemies);
    if (t && t.side === 'party') return this.randomAlive(this.party);
    return null;
  }

  async partyAct(act) {
    const u = act.user;
    if (act.type === 'guard') {
      u.guard = true;
      await this.log(`${u.name} is being careful.`);
      this.addGauge(4);
      return;
    }
    if (act.type === 'attack') {
      const t = this.retarget(act.target, u);
      if (!t) return;
      const A = ACTORS[u.id];
      await this.log(A.attackText.replace('{u}', u.name).replace('{t}', t.name));
      await this.attack(u, t, { power: 1, sfx: A.attackSfx, fx: u.id === 'biscuit' ? 'claw' : 'hit' });
      this.addGauge(8);
      return;
    }
    if (act.type === 'skill') {
      const sk = SKILLS[act.skill];
      if (u.pep < sk.cost) { await this.log(`${u.name} doesn't have enough PEP...`); return; }
      if (u.statuses.spooked) { await this.log(`${u.name} is too SPOOKED to try anything fancy!`); return; }
      const t = this.resolveTarget(act.target, sk.target, u);
      if (t === null) { await this.log(`${u.name} was going to use ${sk.name}, but there's no need anymore.`); return; }
      u.pep -= sk.cost;
      await sk.run(this, u, t);
      this.addGauge(8);
      return;
    }
    if (act.type === 'item') {
      const it = ITEMS[act.item];
      if (State.itemCount(act.item) <= 0) { await this.log(`There's no ${it.name} left...`); return; }
      const t = this.resolveTarget(act.target, it.target, u);
      if (t === null) { await this.log(`${u.name} puts the ${it.name} away. Nobody needs it right now.`); return; }
      State.removeItem(act.item, 1);
      await it.run(this, u, t);
      this.addGauge(6);
      return;
    }
    if (act.type === 'together') {
      this.gauge = 0; this.gaugeReserved = false;
      const tg = TOGETHER[act.together];
      const t = this.resolveTarget(act.target, tg.target, u);
      if (t === null) return;
      for (const b of this.party) if (b.alive) Game.tween(b, { cardY: -24 }, 10);
      await tg.run(this, u, t);
      for (const b of this.party) Game.tween(b, { cardY: 0 }, 12);
    }
    if (this.troop.afterAction) await this.troop.afterAction(this, act);
  }

  resolveTarget(t, type, u) {
    if (t === 'foes') return this.enemies.filter((e) => e.alive);
    if (t === 'allies') return this.party.filter((p) => type === 'allies' ? true : p.alive);
    if (type === 'allyDown') return t && !t.alive ? t : null;
    if (t && !t.alive) return this.retarget(t, u);
    return t;
  }

  async enemyAct(e) {
    const d = e.def_;
    e.lungeT = 1;
    Game.tween(e, { lunge: 1 }, 8).then(() => Game.tween(e, { lunge: 0 }, 12));
    if (d.script) {
      const handled = await d.script(this, e);
      if (handled) return;
    }
    const acts = d.actions.filter((a) => !a.cond || a.cond(this, e));
    const a = U.weighted(acts, (x) => x.w);
    if (a) await a.run(this, e);
  }

  enemyTarget(me) {
    const alive = this.party.filter((b) => b.alive);
    if (!alive.length) return null;
    return U.pick(alive);
  }

  // ------------------------------------------------------------------ effects API
  stat(b, k) {
    let v = b[k];
    const m = MOODS[b.mood];
    if (m) {
      const lv = m.lv ? m.lv[Math.max(0, (b.moodLv || 1) - 1)] || m.lv[m.lv.length - 1] : m;
      if (lv[k]) v *= lv[k];
    }
    const bf = b.buffs[k];
    if (bf) v *= BUFF_MULT[String(bf.stage)] || 1;
    return v;
  }
  moodVal(b, key) {
    const m = MOODS[b.mood];
    if (!m) return 0;
    const lv = m.lv ? m.lv[Math.max(0, (b.moodLv || 1) - 1)] || m.lv[m.lv.length - 1] : m;
    return lv[key] || 0;
  }

  alive(list) { return list.filter((b) => b.alive); }
  foesOf(u) { return u.side === 'party' ? this.enemies : this.party; }
  alliesOf(u) { return u.side === 'party' ? this.party.filter((b) => b.alive) : this.enemies.filter((e) => e.alive); }
  randomAlive(list) { const a = list.filter((b) => b.alive); return a.length ? U.pick(a) : null; }
  lowestHp(list) { return list.filter((b) => b.alive).sort((a, b) => a.hp / a.maxhp - b.hp / b.maxhp)[0]; }

  addGauge(n) { this.gauge = Math.min(GAUGE_MAX, this.gauge + n); }

  async attack(u, t, o = {}) {
    if (!t || !t.alive) { t = this.retarget(t, u); if (!t) return 0; }
    // shelter redirect
    if (t.side === 'party' && t.shelteredBy && t.shelteredBy.alive && t.shelteredBy !== t && u.side === 'enemy') {
      const s = t.shelteredBy;
      this.popText(t, 'sheltered!', '#3f7fd1');
      t = s;
    }
    const miss = 0.04 + this.moodVal(u, 'miss');
    if (!o.fixed && !o.noMiss && Math.random() < miss) {
      Sound.sfx('sfx_miss');
      this.popText(t, 'miss!', '#8a7f86');
      await this.wait(o.quick ? 12 : 24);
      return 0;
    }
    let dmg, crit = false;
    if (o.fixed) dmg = o.fixed;
    else {
      const atk = this.stat(u, 'atk') * (o.power || 1);
      const def = this.stat(t, 'def');
      dmg = Math.max(1, atk * 2 - def) * U.rand(0.88, 1.12);
      const cc = o.noCrit ? 0 : 0.03 + this.stat(u, 'luck') * 0.004 + this.moodVal(u, 'crit');
      if (Math.random() < cc) { crit = true; dmg *= 1.5; }
    }
    if (t.mood === 'overwhelmed') dmg *= MOODS.overwhelmed.takeMult;
    if (t.guard) dmg *= t.shelterGuard ? 0.7 : 0.5;
    if (t.protectedBy && t.protectedBy.alive && t.protectedBy !== t) dmg *= 0.65;
    if (t.statuses.sleepy) { dmg *= 1.2; delete t.statuses.sleepy; this.popText(t, 'woke up!', '#7d73c8', 26); }
    dmg = Math.max(1, Math.round(dmg));
    // visuals
    Sound.sfx(crit ? 'sfx_crit' : (o.sfx || 'sfx_hit'), { vary: 0.05 });
    this.fx(t, o.fx || 'hit');
    t.shakeT = 16; t.flashT = 10; t.hitT = 40;
    if (crit) { Game.shake(7, 14); this.popText(t, 'CRITICAL!', '#d94a4a', -34); }
    else if (t.side === 'party' || o.fx === 'big') Game.shake(4, 10);
    const before = t.hp;
    t.hp = Math.max(0, t.hp - dmg);
    this.popNumber(t, dmg, t.side === 'party' ? '#d94a4a' : '#3a2a30', crit);
    if (t.side === 'party') this.addGauge(5);
    if (t.hp <= 0) await this.knockOut(t, u);
    await this.wait(o.quick ? 16 : 30);
    return before - t.hp;
  }

  async knockOut(t) {
    if (t.statuses.ninelives) {
      t.hp = 1;
      delete t.statuses.ninelives;
      this.popText(t, 'nine lives!', '#d9772b', -30);
      await this.log(`${t.name} hangs on by a whisker!`);
      return;
    }
    if (t.side === 'enemy' && t.def_.noKO) { t.hp = 1; return; }
    t.alive = false;
    t.mood = 'neutral'; t.moodLv = 0; t.statuses = {}; t.buffs = {};
    if (t.side === 'enemy') {
      Sound.sfx('sfx_enemy_calm');
      t.dying = true;
      this.fx(t, 'calm');
      Game.tween(t, { alpha: 0, drop: -60, scale: 0.7 }, 40, U.ease.inQuad).then(() => { t.dying = false; });
      await this.log(t.def_.calmText || `${t.name} calmed down.`);
      if (this.troop.onEnemyDown) await this.troop.onEnemyDown(this, t);
    } else {
      Sound.sfx('sfx_party_down');
      await this.log(`${t.name} is all tuckered out...`);
    }
  }

  async heal(t, amount, o = {}) {
    if (!t.alive) return;
    const before = t.hp;
    t.hp = Math.min(t.maxhp, t.hp + Math.round(amount));
    Sound.sfx('sfx_heal', { volume: 0.7 });
    this.fx(t, 'heal');
    this.popNumber(t, t.hp - before, '#3f9a4e', false, '+');
    if (!o.quick) await this.wait(26);
  }
  async restorePep(t, amount, o = {}) {
    if (!t.alive || !t.maxpep) return;
    const before = t.pep;
    t.pep = Math.min(t.maxpep, t.pep + Math.round(amount));
    Sound.sfx('sfx_heal', { volume: 0.5, pitch: 1.3 });
    this.fx(t, 'pep');
    this.popNumber(t, t.pep - before, '#3f7fd1', false, '+', 18);
    if (!o.quick) await this.wait(26);
  }
  drainPep(t, amount) {
    if (!t.alive || !t.maxpep) return;
    const before = t.pep;
    t.pep = Math.max(0, t.pep - amount);
    this.popNumber(t, before - t.pep, '#3f7fd1', false, '-', 18);
  }
  async revive(t, frac, o = {}) {
    if (t.alive) return;
    t.alive = true;
    t.hp = Math.max(1, Math.round(t.maxhp * frac));
    Sound.sfx('sfx_heal');
    this.fx(t, 'heal');
    this.popText(t, 'back up!', '#3f9a4e');
    if (!o.quick) await this.log(`${t.name} is back on their feet!`);
  }

  // apply a mood with blending rules
  async mood(t, m, o = {}) {
    if (!t || !t.alive) return;
    let msg = null;
    if (t.side === 'party' && t.id === 'pim' && m === 'gloomy' && !State.flag('umbrella_closed')) {
      msg = `${t.name} smiles it away.`;
      m = 'cheery';
      t.forcedSmile = 90;
    }
    const cur = t.mood;
    const max = (t.def_ && t.def_.moodMax) || 2;
    let next = cur, lv = t.moodLv;
    if (m === 'neutral') { next = 'neutral'; lv = 0; }
    else if (cur === 'neutral') { next = m; lv = 1; }
    else if (cur === m) {
      if (lv >= max) { this.popText(t, 'can\'t get any ' + MOODS[m].name.toLowerCase() + '!', '#8a7f86'); if (!o.quick) await this.wait(20); return; }
      lv++;
    } else if (MOODS[cur].primary) { next = blendOf(cur, m); lv = 1; }
    else if (MOODS[cur].blend) {
      if (MOODS[cur].blend.includes(m)) { this.popText(t, MOODS[cur].name.toLowerCase(), '#8a7f86'); if (!o.quick) await this.wait(16); return; }
      if (t.def_ && t.def_.noOverwhelm) { this.popText(t, 'unshaken', '#8a7f86'); if (!o.quick) await this.wait(16); return; }
      next = 'overwhelmed'; lv = 1;
    } else if (cur === 'overwhelmed') { if (!o.quick) await this.wait(10); return; }
    this.setMood(t, next, lv);
    const name = MOODS[next].lvName ? MOODS[next].lvName[lv - 1] : MOODS[next].name;
    const text = `${t.name} ${next === 'overwhelmed' ? 'is' : 'feels'} ${name}!`;
    if (next === 'overwhelmed') { this.addGauge(12); Game.shake(5, 18); }
    if (msg) await this.log(msg, { quick: true });
    if (o.quick) { this.popText(t, name.toLowerCase() + '!', MOODS[next].color === '#fff8ec' ? '#8a7f86' : U.mixHex(MOODS[next].color, '#3a2a30', 0.35)); await this.wait(14); }
    else await this.log(text);
  }

  setMood(t, m, lv) {
    t.mood = m; t.moodLv = m === 'neutral' ? 0 : (lv || 1);
    t.moodT = 0;
    const sfx = { cheery: 'sfx_mood_cheery', gloomy: 'sfx_mood_gloomy', huffy: 'sfx_mood_huffy', rainbow: 'sfx_mood_rainbow', stormy: 'sfx_mood_stormy', heatwave: 'sfx_mood_heatwave', overwhelmed: 'sfx_overwhelm' }[m];
    if (sfx) Sound.sfx(sfx, { volume: 0.8 });
    if (m !== 'neutral') this.fx(t, 'mood', MOODS[m].color);
  }

  buff(t, stat, stages, turns = 3) {
    if (!t.alive) return;
    const cur = t.buffs[stat] ? t.buffs[stat].stage : 0;
    const ns = U.clamp(cur + stages, -2, 2);
    if (ns === cur) { this.popText(t, stat.toUpperCase() + (stages > 0 ? ' maxed' : ' can\'t go lower'), '#8a7f86'); return; }
    t.buffs[stat] = { stage: ns, turns: turns + 1 };
    if (ns === 0) delete t.buffs[stat];
    Sound.sfx(stages > 0 ? 'sfx_buff' : 'sfx_debuff', { volume: 0.7 });
    this.popText(t, `${stat.toUpperCase()} ${stages > 0 ? 'up!' : 'down!'}`, stages > 0 ? '#3f9a4e' : '#d9772b', 14);
    this.fx(t, stages > 0 ? 'up' : 'down');
  }

  setStatus(t, s, turns) {
    if (!t.alive) return;
    t.statuses[s] = turns + 1;
    const col = { sleepy: '#7d73c8', spooked: '#6b5559', ninelives: '#d9772b' }[s] || '#3a2a30';
    this.popText(t, s + '!', col, 20);
    if (s === 'sleepy') Sound.sfx('sfx_sleep', { volume: 0.7 });
  }
  clearStatuses(t) {
    for (const k of ['sleepy', 'spooked']) delete t.statuses[k];
    for (const k in t.buffs) if (t.buffs[k].stage < 0) delete t.buffs[k];
  }

  summon(id) {
    const e = this.makeEnemy(id);
    e.drop = -500;
    this.enemies.push(e);
    this.layoutEnemies(true);
    for (const x of this.enemies) Game.tween(x, { drawX: x.x }, 24, U.ease.outQuad);
    e.drawX = e.x;
    Game.tween(e, { drop: 0 }, 26, U.ease.outBack);
    Assets.load(e.sprite);
    return e;
  }

  // message line in the log box
  log(text, o = {}) {
    this.logText = text;
    this.logParsed = RichText.parse(text);
    this.logCount = this.logParsed.filter((g) => !g.cmd).length;
    this.logShown = 0;
    this.logHold = o.hold != null ? o.hold : 34;
    this.logDone = null;
    return new Promise((r) => { this.logDone = r; });
  }

  wait(n) { return Game.wait(n); }
  say(sp, text, face) { return E.say(sp, text, face); }
  async story(key, who) { const f = window.BATTLE_STORY && BATTLE_STORY[key]; if (f) return f(this, who); return false; }

  // ------------------------------------------------------------------ turn end
  async endOfTurn() {
    for (const b of [...this.party, ...this.enemies]) {
      b.guard = false; b.shelteredBy = null; b.protectedBy = null;
      if (!b.alive) continue;
      const m = MOODS[b.mood];
      if (b.mood === 'rainbow') { const h = Math.round(b.maxhp * m.regen); if (b.hp < b.maxhp) { b.hp = Math.min(b.maxhp, b.hp + h); this.popNumber(b, h, '#3f9a4e', false, '+'); } }
      if (b.mood === 'heatwave') { const h = Math.max(1, Math.round(b.maxhp * m.burn)); b.hp = Math.max(1, b.hp - h); this.popNumber(b, h, '#d9772b'); }
      const pr = this.moodVal(b, 'pepRegen');
      if (pr && b.maxpep) { const p = Math.round(b.maxpep * pr); if (b.pep < b.maxpep) { b.pep = Math.min(b.maxpep, b.pep + p); this.popNumber(b, p, '#3f7fd1', false, '+', 18); } }
      if (b.sticker && b.sticker.regen) b.hp = Math.min(b.maxhp, b.hp + Math.round(b.maxhp * b.sticker.regen));
      if (b.sticker && b.sticker.pepRegen) b.pep = Math.min(b.maxpep, b.pep + b.sticker.pepRegen);
      for (const s of Object.keys(b.statuses)) {
        b.statuses[s]--;
        if (b.statuses[s] <= 0) {
          delete b.statuses[s];
          if (s === 'sleepy') this.popText(b, 'woke up!', '#7d73c8');
        }
      }
      for (const k of Object.keys(b.buffs)) { b.buffs[k].turns--; if (b.buffs[k].turns <= 0) delete b.buffs[k]; }
    }
    if (this.troop.onTurnEnd) await this.troop.onTurnEnd(this, this.turn);
    await this.wait(10);
  }

  // ------------------------------------------------------------------ results
  async victory() {
    this.ui = null;
    if (this.troop.noRewards) { await this.wait(30); return; }
    Sound.stopBgm(0.3);
    Sound.jingle('jingle_victory', { duck: false });
    this.victoryT = 0;
    await this.wait(20);
    const defeated = this.enemies;
    const exp = defeated.reduce((s, e) => s + (e.def_.exp || 0), 0);
    const marbles = defeated.reduce((s, e) => s + (e.def_.marbles || 0), 0);
    if (this.troop.noRewards) return;
    await this.log('All the big feelings calmed down!', { hold: 60 });
    if (exp > 0) {
      // write current battle HP/PEP back first so level-up gains stack on top of them
      for (const b of this.party) { const a = State.actor(b.id); a.hp = b.alive ? b.hp : 0; a.pep = b.pep; }
      const ups = State.gainExp(exp);
      await this.log(`Everyone gained ${exp} EXP!`, { hold: 40 });
      for (const u of ups) {
        Sound.jingle('jingle_levelup', { duck: false });
        const b = this.party.find((p) => p.id === u.id);
        const st = State.stats(u.id), a = State.actor(u.id);
        if (b) {
          Object.assign(b, { maxhp: st.maxhp, maxpep: st.maxpep, atk: st.atk, def: st.def, spd: st.spd, luck: st.luck, hp: a.hp, pep: a.pep });
          this.fx(b, 'up');
        }
        await this.log(`${ACTORS[u.id].name} grew to level ${u.level}!`, { hold: 50 });
        for (const s of u.newSkills) await this.log(`${ACTORS[u.id].name} learned ${SKILLS[s].name}!`, { hold: 50 });
      }
    }
    if (marbles > 0) { State.d.marbles += marbles; await this.log(`Found ${marbles} marbles!`, { hold: 30 }); }
    for (const e of defeated) {
      for (const [iid, ch] of e.def_.drops || []) {
        if (Math.random() < ch) { State.addItem(iid, 1); Sound.sfx('sfx_item'); await this.log(`${e.name} left behind a ${ITEMS[iid].name}!`, { hold: 40 }); }
      }
    }
    State.d.battles++;
    await this.wait(20);
  }

  async defeat() {
    Sound.stopBgm(1.5);
    await Game.fadeOut(60, '#1b1622');
    return GameOver.show();
  }

  async beginRetry() {
    this.snapshot = State.snapshot();
    this.makeParty();
    this.enemies = this.troop.enemies.map((id) => this.makeEnemy(id));
    this.layoutEnemies(false);
    for (const e of this.enemies) e.drop = -600;
    Game.setScene(this);
    Sound.playBgm(this.opts.bgm || this.troop.bgm || 'bgm_battle', { restart: true, fadeIn: 0.1 });
    await Game.fadeIn(20);
    return this.runAndResolve();
  }

  // ------------------------------------------------------------------ fx
  fx(t, type, color) {
    const [x, y] = this.posOf(t);
    const add = (p) => this.parts.push(Object.assign({ t: 0, life: 40 }, p));
    const n = { hit: 8, claw: 3, big: 14, spin: 10, splash: 12, crash: 10, calm: 16, heal: 12, pep: 8, mood: 14, up: 6, down: 6, shield: 1, sparkle: 10, confetti: 18 }[type] || 6;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = U.rand(2, 6);
      if (type === 'heal' || type === 'pep') add({ kind: 'plus', x: x + U.rand(-40, 40), y: y + U.rand(-10, 30), vx: 0, vy: -U.rand(1, 2.5), color: type === 'heal' ? '#7ccf7a' : '#7fb2ec', life: 50 });
      else if (type === 'splash') add({ kind: 'drop', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3, g: 0.3, color: '#7fb2ec' });
      else if (type === 'calm') add({ kind: 'star', x: x + U.rand(-30, 30), y: y + U.rand(-40, 20), vx: U.rand(-1, 1), vy: -U.rand(0.5, 2), color: '#fff3b0', life: 60 });
      else if (type === 'mood') add({ kind: 'ring', x, y, r: 10, vr: U.rand(3, 5), color: color || '#fff', life: 26, delay: i * 1.5 });
      else if (type === 'up' || type === 'down') add({ kind: 'arrow', x: x + U.rand(-30, 30), y: y + U.rand(-10, 20), vx: 0, vy: type === 'up' ? -1.5 : 1.5, color: type === 'up' ? '#7ccf7a' : '#f0a060', life: 40, dir: type });
      else if (type === 'shield') add({ kind: 'shield', x, y, life: 50 });
      else if (type === 'confetti') add({ kind: 'confetti', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, g: 0.25, color: U.pick(['#ff8fa3', '#ffd166', '#7fb2ec', '#8fd18a']), life: 60, rot: Math.random() * 6 });
      else if (type === 'sparkle') add({ kind: 'star', x: x + U.rand(-40, 40), y: y + U.rand(-50, 20), vx: 0, vy: -0.5, color: '#ffd166', life: 40 });
      else add({ kind: type === 'claw' ? 'claw' : 'burst', x: x + U.rand(-10, 10), y: y + U.rand(-10, 10), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, color: type === 'big' ? '#ffd166' : '#ffffff', life: type === 'claw' ? 18 : 24, a, i });
    }
  }

  posOf(t) {
    if (t.side === 'enemy') return [t.drawX, t.y + t.drop - t.h * 0.45];
    const c = this.cardRect(t);
    return [c.x + c.w / 2, c.y + 50];
  }

  popNumber(t, n, color, crit, prefix = '', dy = 0) {
    const [x, y] = this.posOf(t);
    this.pops.push({ text: prefix + n, x: x + U.rand(-12, 12), y: y - 10 + dy, color, t: 0, big: crit, life: 60 });
  }
  popText(t, text, color, dy = 0) {
    const [x, y] = this.posOf(t);
    this.pops.push({ text, x, y: y - 40 + dy, color, t: 0, small: true, life: 60 });
  }

  // ------------------------------------------------------------------ update
  update() {
    this.t++;
    // log typing
    if (this.logDone) {
      const spd = (Input.isHeld('cancel') || Input.isHeld('ok')) ? 6 : 2 * ((State.options.textSpeed || 1));
      if (this.logShown < this.logCount) this.logShown = Math.min(this.logCount, this.logShown + spd);
      else {
        this.logHold -= (Input.isHeld('ok') || Input.isHeld('cancel')) ? 3 : 1;
        if (Input.isPressed('ok')) this.logHold = 0;
        if (this.logHold <= 0) { const r = this.logDone; this.logDone = null; r(); }
      }
    }
    for (const p of this.pops) p.t++;
    this.pops = this.pops.filter((p) => p.t < p.life);
    for (const p of this.parts) {
      if (p.delay > 0) { p.delay--; continue; }
      p.t++;
      if (p.vx != null) { p.x += p.vx; p.y += p.vy; if (p.g) p.vy += p.g; p.vx *= 0.94; if (!p.g) p.vy *= 0.94; }
      if (p.vr) p.r += p.vr;
    }
    this.parts = this.parts.filter((p) => p.t < p.life);
    for (const b of [...this.party, ...this.enemies]) {
      if (b.shakeT > 0) b.shakeT--;
      if (b.flashT > 0) b.flashT--;
      if (b.hitT > 0) b.hitT--;
      if (b.forcedSmile > 0) b.forcedSmile--;
      b.ghostHp += ((b.hp / b.maxhp) - b.ghostHp) * 0.06;
      if (b.maxpep) b.ghostPep += ((b.pep / b.maxpep) - b.ghostPep) * 0.08;
      if (b.side === 'enemy' && b.drawX !== b.x && !Game.tweens.some((tw) => tw.obj === b && 'drawX' in tw.to)) b.drawX += (b.x - b.drawX) * 0.2;
    }
    if (this.note) { this.note.t++; if (this.note.t > 70) this.note = null; }
    if (this.ui && Game.overlays.length === 0) this.updateUI();
    if (this.troop.update) this.troop.update(this);
  }

  updateUI() {
    const ui = this.ui;
    ui.t++;
    const n = ui.type === 'target' ? ui.cands.length : ui.type === 'list' ? ui.list.length : ui.options.length;
    const cursor = (d) => { ui.index = (ui.index + d + n) % n; Sound.sfx('sfx_cursor', { volume: 0.5 }); };
    // taps: commands and targets act on one tap, skill/item lists highlight first (to show the description).
    // Taps right as a menu opens were meant for the text before it.
    if (ui.t <= 10) Input.takeTap();
    else if (Input.tapSelect(ui, this.menuHits(ui), ui.type === 'list')) return;
    if (ui.type === 'party' || ui.type === 'actor') {
      if (Input.repeat('up') || (ui.type === 'party' && Input.repeat('left'))) cursor(-1);
      if (Input.repeat('down') || (ui.type === 'party' && Input.repeat('right'))) cursor(1);
      if (Input.isPressed('ok')) {
        const dis = ui.type === 'party' ? (ui.disabled || []).includes(ui.index) : ui.options[ui.index].disabled;
        if (dis) { Sound.sfx('sfx_buzzer'); return; }
        Sound.sfx('sfx_confirm', { volume: 0.6 });
        this.closeMenu(ui.index);
      } else if (Input.isPressed('cancel') && ui.type === 'actor') { Sound.sfx('sfx_cancel', { volume: 0.6 }); this.closeMenu('back'); }
    } else if (ui.type === 'list') {
      const cols = 2;
      if (Input.repeat('up')) { if (ui.index - cols >= 0) { ui.index -= cols; Sound.sfx('sfx_cursor', { volume: 0.5 }); } }
      if (Input.repeat('down')) { if (ui.index + cols < n) { ui.index += cols; Sound.sfx('sfx_cursor', { volume: 0.5 }); } }
      if (Input.repeat('left')) { if (ui.index % cols > 0) { ui.index--; Sound.sfx('sfx_cursor', { volume: 0.5 }); } }
      if (Input.repeat('right')) { if (ui.index % cols < cols - 1 && ui.index + 1 < n) { ui.index++; Sound.sfx('sfx_cursor', { volume: 0.5 }); } }
      if (Input.isPressed('ok')) {
        if (ui.mode === 'skill') {
          const sk = SKILLS[ui.list[ui.index]];
          if (ui.actor.pep < sk.cost) { Sound.sfx('sfx_buzzer'); this.flashNote('Not enough PEP!'); return; }
          if (sk.target === 'allyDown' && !this.party.some((p) => !p.alive)) { Sound.sfx('sfx_buzzer'); this.flashNote('Nobody needs that right now.'); return; }
        }
        if (ui.mode === 'item') {
          const it = ITEMS[ui.list[ui.index]];
          if (it.target === 'allyDown' && !this.party.some((p) => !p.alive)) { Sound.sfx('sfx_buzzer'); this.flashNote('Nobody needs that right now.'); return; }
        }
        Sound.sfx('sfx_confirm', { volume: 0.6 });
        this.closeMenu(ui.index);
      } else if (Input.isPressed('cancel')) { Sound.sfx('sfx_cancel', { volume: 0.6 }); this.closeMenu('back'); }
    } else if (ui.type === 'target') {
      if (Input.repeat('left') || Input.repeat('up')) cursor(-1);
      if (Input.repeat('right') || Input.repeat('down')) cursor(1);
      if (Input.isPressed('ok')) { Sound.sfx('sfx_confirm', { volume: 0.6 }); this.closeMenu(ui.index); }
      else if (Input.isPressed('cancel')) { Sound.sfx('sfx_cancel', { volume: 0.6 }); this.closeMenu('back'); }
    }
  }

  // where each command menu sits (shared by drawing and tap hit-testing)
  menuBox(ui) {
    if (ui.type === 'party') {
      const first = this.party[0] ? this.cardRect(this.party[0]) : { x: 16, y: 532, w: 226 };
      const w = 300, h = 58;
      return { x: U.clamp(first.x, 10, Game.W - w - 10), y: first.y - h - 20, w, h };
    }
    if (ui.type === 'actor') {
      const r = this.cardRect(ui.actor);
      const w = 196, h = ui.options.length * 40 + 22;
      return { x: U.clamp(r.x + r.w / 2 - w / 2, 10, Game.W - w - 10), y: r.y - h - 24, w, h };
    }
    const rows = Math.ceil(ui.list.length / 2);
    return { x: 40, y: 190, w: Game.W - 80, h: Math.max(1, Math.min(rows, 6)) * 44 + 86 };
  }

  // first entry shown by a two-column list (6 rows); it only scrolls when the cursor leaves the window
  listFirst(ui) {
    const row = Math.floor(ui.index / 2), rows = Math.ceil(ui.list.length / 2);
    ui.top = U.clamp(U.clamp(ui.top || 0, row - 5, row), 0, Math.max(0, rows - 6));
    return ui.top * 2;
  }

  menuHits(ui) {
    if (ui.type === 'target') {
      return ui.cands.map((t, i) => {
        if (t.side !== 'enemy') return { i, ...this.cardRect(t) };
        const img = Assets.get(t.sprite), h = t.h * t.scale;
        const w = Math.max(130, img ? h * img.width / img.height : h * 0.8);
        return { i, x: t.drawX - w / 2, y: t.y + t.drop - h - 30, w, h: h + 60 };
      });
    }
    const b = this.menuBox(ui);
    if (ui.type === 'party') {
      const bw = (b.w - 24) / 2;
      return ui.options.map((o, i) => ({ i, x: b.x + 12 + i * bw, y: b.y, w: bw, h: b.h }));
    }
    if (ui.type === 'actor') return Input.rowHits(ui.options.length, b.x, b.y + 10, b.w, 40);
    const first = this.listFirst(ui), out = [];
    for (let i = first; i < Math.min(ui.list.length, first + 12); i++) {
      out.push({ i, x: b.x + 10 + (i % 2) * (b.w / 2 - 10), y: b.y + 12 + ((i - first) >> 1) * 44, w: b.w / 2 - 18, h: 44 });
    }
    return out;
  }

  // ------------------------------------------------------------------ drawing
  cardRect(b) {
    const n = this.party.length;
    const w = 226, gap = 8, h = 176;
    const total = n * w + (n - 1) * gap;
    const x0 = (Game.W - total) / 2;
    const i = this.party.indexOf(b);
    return { x: x0 + i * (w + gap), y: 532 + (b.cardY || 0), w, h };
  }

  draw(ctx) {
    // background
    const bg = Assets.get(this.troop.bg);
    if (bg) {
      const s = Math.max(Game.W / bg.width, Game.H / bg.height);
      ctx.drawImage(bg, (Game.W - bg.width * s) / 2, (Game.H - bg.height * s) / 2, bg.width * s, bg.height * s);
    } else this.drawFallbackBg(ctx);
    if (this.troop.drawBg) this.troop.drawBg(ctx, this);
    // enemies
    const tgt = this.ui && this.ui.type === 'target' ? this.ui.cands[this.ui.index] : null;
    const tgtAll = this.ui && this.ui.type === 'target' ? null : null;
    for (const e of this.enemies) if (e.alive || e.dying) this.drawEnemy(ctx, e, e === tgt);
    // particles behind UI
    this.drawParts(ctx);
    // party cards
    for (const b of this.party) this.drawCard(ctx, b, tgt === b);
    // pops
    for (const p of this.pops) {
      const a = p.t < 40 ? 1 : 1 - (p.t - 40) / 20;
      const s = p.t < 8 ? U.ease.outBack(p.t / 8) : 1;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(p.x, p.y - Math.min(p.t, 30) * 0.8);
      ctx.scale(s, s);
      Gfx.text(ctx, p.text, 0, 0, { size: p.small ? 22 : p.big ? 44 : 34, font: Gfx.BOLD, align: 'center', color: p.color, outline: '#fffaf0', outlineWidth: 6 });
      ctx.restore();
    }
    this.drawLog(ctx);
    this.drawGauge(ctx);
    this.drawMenus(ctx);
    for (const pic of this.pictures) drawPicture(ctx, pic);
    if (this.note) {
      const a = this.note.t > 55 ? (70 - this.note.t) / 15 : 1;
      ctx.globalAlpha = a;
      const w = Gfx.measure(ctx, this.note.text, 26, Gfx.FONT) + 40;
      Gfx.box(ctx, Game.W / 2 - w / 2, 300, w, 50, { fill: '#fff0f0' });
      Gfx.text(ctx, this.note.text, Game.W / 2, 334, { size: 26, align: 'center' });
      ctx.globalAlpha = 1;
    }
  }

  drawFallbackBg(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, Game.H);
    g.addColorStop(0, '#cbbfe6'); g.addColorStop(1, '#f6d6e0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, Game.W, Game.H);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 12; i++) {
      const x = (i * 97 + this.t * 0.2) % (Game.W + 100) - 50, y = 60 + (i * 53) % 320;
      Gfx.cloud(ctx, x, y, 40 + (i % 3) * 14); ctx.fill();
    }
    ctx.fillStyle = 'rgba(80,60,90,0.12)';
    ctx.beginPath(); ctx.ellipse(Game.W / 2, 480, 420, 60, 0, 0, Math.PI * 2); ctx.fill();
  }

  drawEnemy(ctx, e, targeted) {
    const img = Assets.get(e.sprite);
    const breathe = Math.sin(this.t * 0.05 + e.seed) * 0.02;
    const shake = e.shakeT > 0 ? Math.sin(e.shakeT * 1.7) * e.shakeT * 0.6 : 0;
    const x = e.drawX + shake, y = e.y + e.drop + e.lunge * 18;
    const h = e.h * e.scale * (1 + e.lunge * 0.06);
    ctx.save();
    ctx.globalAlpha = e.alpha;
    // mood aura
    if (e.mood !== 'neutral') {
      const col = MOODS[e.mood].color;
      const grd = ctx.createRadialGradient(x, y - h * 0.45, h * 0.1, x, y - h * 0.45, h * 0.62);
      grd.addColorStop(0, U.rgba(col, 0.55)); grd.addColorStop(1, U.rgba(col, 0));
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(x, y - h * 0.45, h * 0.62, 0, Math.PI * 2); ctx.fill();
    }
    // shadow
    ctx.fillStyle = 'rgba(40,20,40,0.2)';
    ctx.beginPath(); ctx.ellipse(e.drawX, e.y + 4, h * 0.3, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(x, y);
    ctx.scale(1 - breathe * 0.5, 1 + breathe);
    if (e.statuses.sleepy) ctx.rotate(Math.sin(this.t * 0.03) * 0.05);
    if (e.mood === 'overwhelmed') ctx.rotate(Math.sin(this.t * 0.25) * 0.06);
    if (img) {
      const w = h * (img.width / img.height);
      ctx.drawImage(img, -w / 2, -h, w, h);
      if (e.flashT > 0) {
        const sil = Sprites.silhouette(e.sprite + '_b', img, { sx: 0, sy: 0, sw: img.width, sh: img.height, flip: false }, '#ffffff');
        ctx.globalAlpha = e.alpha * (e.flashT / 10) * 0.8;
        ctx.drawImage(sil, -w / 2, -h, w, h);
      }
    } else Gfx.placeholder(ctx, -h * 0.4, -h, h * 0.8, h, e.name);
    ctx.restore();
    if (!e.alive) return;
    // hp bar + mood icon
    const bw = Math.min(170, Math.max(110, h * 0.6)), bx = e.drawX - bw / 2, by = e.y + e.drop + 16;
    ctx.save();
    if (targeted) Gfx.cursor(ctx, e.drawX, y - h - 22, this.t, 'down', { size: 16 });
    Gfx.bar(ctx, bx, by, bw, 12, e.hp / e.maxhp, '#ef6f7c', '#f7d4d4', { ghost: e.ghostHp });
    if (e.mood !== 'neutral') Gfx.icon(ctx, MOODS[e.mood].icon, bx - 16, by + 6, 12);
    let sx = bx + bw + 16;
    for (const s of Object.keys(e.statuses)) { Gfx.icon(ctx, s === 'sleepy' ? 'sleepy' : s === 'spooked' ? 'spooked' : 'star', sx, by + 6, 11); sx += 24; }
    ctx.restore();
  }

  faceFor(b) {
    if (!b.alive) return 'down';
    if (b.hitT > 22) return 'hurt';
    if (b.id === 'pim' && b.forcedSmile > 0) return 'forced';
    const m = b.mood;
    if (b.id === 'pim' && m === 'gloomy') return 'cry';
    if (m === 'cheery' || m === 'gloomy' || m === 'huffy') return m;
    if (m === 'rainbow') return 'rainbow';
    if (m === 'stormy' || m === 'heatwave') return 'huffy';
    if (m === 'overwhelmed') return 'hurt';
    return 'neutral';
  }

  drawCard(ctx, b, targeted) {
    const r = this.cardRect(b);
    const shake = b.shakeT > 0 ? Math.sin(b.shakeT * 1.9) * b.shakeT * 0.5 : 0;
    const x = r.x + shake, y = r.y;
    const moodCol = b.alive ? MOODS[b.mood].color : '#cfc8cc';
    const isActive = this.ui && this.ui.actor === b;
    Gfx.box(ctx, x, y, r.w, r.h, { fill: '#fff8ec' });
    // portrait panel
    const px = x + 12, py = y + 12, pw = r.w - 24, ph = 104;
    ctx.save();
    Gfx.roundRect(ctx, px, py, pw, ph, 12);
    ctx.fillStyle = moodCol; ctx.fill();
    ctx.clip();
    // mood background doodles
    this.drawMoodBg(ctx, b.mood, px, py, pw, ph, b.alive);
    const ch = CHARACTERS[b.id];
    const face = this.faceFor(b);
    const fid = ch && ch.faces && (ch.faces[face] || ch.faces[face === 'forced' ? 'cheery' : face === 'rainbow' ? 'cheery' : 'neutral'] || ch.faces.neutral);
    const img = fid ? Assets.get(fid) : null;
    if (img) {
      const breathe = b.alive ? Math.sin(this.t * 0.05 + b.idx * 1.7) * 0.012 : 0;
      const s = ph / img.height * 1.18;
      const iw = img.width * s * (1 - breathe * 0.5), ih = img.height * s * (1 + breathe);
      const jolt = b.hitT > 30 ? (Math.random() - 0.5) * 6 : 0;
      if (!b.alive) ctx.globalAlpha = 0.55;
      ctx.drawImage(img, px + pw / 2 - iw / 2 + jolt, py + ph - ih + 8, iw, ih);
      ctx.globalAlpha = 1;
    } else Gfx.placeholder(ctx, px + pw / 2 - 40, py + 12, 80, 86, b.name + ':' + face, ch && ch.color);
    if (b.flashT > 0) { ctx.fillStyle = `rgba(239,90,90,${b.flashT / 14})`; ctx.fillRect(px, py, pw, ph); }
    ctx.restore();
    Gfx.roundRect(ctx, px, py, pw, ph, 12); ctx.lineWidth = 2.5; ctx.strokeStyle = Gfx.C.ink; ctx.stroke();
    // name + mood
    Gfx.tag(ctx, x - 6, y - 16, b.name, { fill: CHARACTERS[b.id] ? CHARACTERS[b.id].color : '#ffd9a8', size: 18 });
    if (b.mood !== 'neutral' && b.alive) {
      Gfx.icon(ctx, MOODS[b.mood].icon, x + r.w - 26, y + 30, 14);
      const nm = MOODS[b.mood].lvName ? MOODS[b.mood].lvName[b.moodLv - 1] : MOODS[b.mood].name;
      Gfx.text(ctx, nm, x + r.w - 20, y + ph + 4, { size: 16, font: Gfx.BOLD, align: 'right', color: '#fff', outline: Gfx.C.ink, outlineWidth: 4 });
    }
    // statuses
    let sx = x + 26;
    for (const s of Object.keys(b.statuses)) { Gfx.icon(ctx, s === 'sleepy' ? 'sleepy' : s === 'spooked' ? 'spooked' : 'star', sx, y + 34, 11); sx += 24; }
    for (const k of Object.keys(b.buffs)) {
      const st = b.buffs[k].stage;
      Gfx.text(ctx, k.toUpperCase() + (st > 0 ? '▲' : '▼'), sx - 10, y + 40, { size: 14, font: Gfx.BOLD, color: st > 0 ? '#3f9a4e' : '#d9772b', outline: '#fff', outlineWidth: 3 });
      sx += 44;
    }
    // bars
    const bx = x + 40, bw = r.w - 58;
    Gfx.icon(ctx, 'heart', x + 24, y + 132, 10);
    Gfx.bar(ctx, bx, y + 124, bw, 16, b.hp / b.maxhp, Gfx.C.hp, Gfx.C.hpBack, { ghost: b.ghostHp });
    Gfx.text(ctx, `${b.hp}/${b.maxhp}`, bx + bw - 4, y + 137, { size: 15, font: Gfx.BOLD, align: 'right', color: Gfx.C.ink, outline: '#fff', outlineWidth: 3 });
    Gfx.icon(ctx, 'pep', x + 24, y + 156, 9);
    Gfx.bar(ctx, bx, y + 148, bw, 14, b.maxpep ? b.pep / b.maxpep : 0, Gfx.C.pep, Gfx.C.pepBack, { ghost: b.ghostPep });
    Gfx.text(ctx, `${b.pep}/${b.maxpep}`, bx + bw - 4, y + 160, { size: 14, font: Gfx.BOLD, align: 'right', color: Gfx.C.ink, outline: '#fff', outlineWidth: 3 });
    if (!b.alive) Gfx.text(ctx, 'tuckered out', x + r.w / 2, y + 64, { size: 22, font: Gfx.BOLD, align: 'center', color: '#fff', outline: Gfx.C.ink, outlineWidth: 5 });
    if (targeted) Gfx.cursor(ctx, x + r.w / 2, y - 26, this.t, 'down', { size: 14 });
    if (isActive) {
      ctx.save();
      ctx.strokeStyle = '#ff8fa3'; ctx.lineWidth = 4; ctx.globalAlpha = 0.6 + Math.sin(this.t * 0.15) * 0.3;
      Gfx.roundRect(ctx, x - 4, y - 4, r.w + 8, r.h + 8, 18); ctx.stroke();
      ctx.restore();
    }
  }

  drawMoodBg(ctx, mood, x, y, w, h, alive) {
    if (!alive) return;
    const t = this.t;
    ctx.save();
    ctx.globalAlpha = 0.35;
    if (mood === 'cheery' || mood === 'heatwave') {
      ctx.translate(x + w / 2, y + h / 2); ctx.rotate(t * 0.004);
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(200, -18); ctx.lineTo(200, 18); ctx.closePath(); if (i % 2) ctx.fill(); }
    } else if (mood === 'gloomy' || mood === 'stormy') {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) { const xx = x + ((i * 37 + t * 0.6) % w), yy = y + ((i * 53 + t * 2.2) % h); ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx - 3, yy + 12); ctx.stroke(); }
    } else if (mood === 'huffy') {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 6; i++) { const xx = x + ((i * 61) % w), yy = y + h - ((t * 1.2 + i * 40) % (h + 20)); ctx.beginPath(); ctx.arc(xx, yy, 6 + (i % 3) * 3, 0, 7); ctx.fill(); }
    } else if (mood === 'rainbow') {
      const cols = ['#ef6f5e', '#ffd166', '#8fd18a', '#7fb2ec', '#b39ddb'];
      ctx.globalAlpha = 0.4;
      cols.forEach((c, i) => { ctx.strokeStyle = c; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(x + w / 2, y + h + 30, 110 - i * 10, Math.PI, 0); ctx.stroke(); });
    } else if (mood === 'overwhelmed') {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.translate(x + w / 2, y + h / 2); ctx.rotate(t * 0.05);
      ctx.beginPath(); for (let i = 0; i < 80; i++) { const a = i * 0.25, rr = i * 1.4; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.stroke();
    }
    ctx.restore();
  }

  drawParts(ctx) {
    for (const p of this.parts) {
      if (p.delay > 0) continue;
      const a = 1 - p.t / p.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      if (p.kind === 'burst') {
        ctx.strokeStyle = p.color; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3); ctx.stroke();
        ctx.strokeStyle = Gfx.C.ink; ctx.lineWidth = 1.2; ctx.stroke();
      } else if (p.kind === 'claw') {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        const off = (p.i || 0) * 14 - 14;
        ctx.beginPath(); ctx.moveTo(p.x - 30 + off, p.y - 34); ctx.lineTo(p.x + 22 + off, p.y + 30); ctx.stroke();
        ctx.strokeStyle = '#d94a4a'; ctx.lineWidth = 2; ctx.stroke();
      } else if (p.kind === 'drop') { ctx.fillStyle = p.color; Gfx.drop(ctx, p.x, p.y, 6); ctx.fill(); }
      else if (p.kind === 'star') { ctx.fillStyle = p.color; Gfx.star(ctx, p.x, p.y, 7, 3); ctx.fill(); ctx.strokeStyle = Gfx.C.ink; ctx.lineWidth = 1; ctx.stroke(); }
      else if (p.kind === 'plus') { Gfx.text(ctx, '+', p.x, p.y, { size: 24, font: Gfx.BOLD, color: p.color, align: 'center', outline: '#fff', outlineWidth: 3 }); }
      else if (p.kind === 'ring') { ctx.strokeStyle = p.color; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = 'rgba(58,42,48,0.4)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      else if (p.kind === 'arrow') { Gfx.text(ctx, p.dir === 'up' ? '▲' : '▼', p.x, p.y, { size: 20, color: p.color, align: 'center', outline: '#fff', outlineWidth: 3 }); }
      else if (p.kind === 'shield') {
        ctx.globalAlpha = Math.sin((p.t / p.life) * Math.PI) * 0.8;
        ctx.fillStyle = 'rgba(239,90,94,0.25)'; ctx.strokeStyle = '#d94a4a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y + 30, 90, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (p.kind === 'confetti') { ctx.fillStyle = p.color; ctx.translate(p.x, p.y); ctx.rotate(p.rot + p.t * 0.2); ctx.fillRect(-4, -2, 8, 4); }
      ctx.restore();
    }
  }

  drawLog(ctx) {
    const x = 16, y = 14, w = 744, h = 62;
    Gfx.box(ctx, x, y, w, h, { fill: '#fff8ec' });
    if (!this.logParsed) return;
    let n = 0;
    let cx = 0;
    const size = this.logCount > 58 ? 22 : 26;
    Gfx.font(ctx, size, Gfx.FONT);
    const totalW = ctx.measureText(this.logParsed.filter((g) => !g.cmd).map((g) => g.ch).join('')).width;
    const scale = totalW > w - 40 ? (w - 40) / totalW : 1;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.translate(x + 20, y + h / 2 + size * 0.34);
    ctx.scale(scale, 1);
    for (const g of this.logParsed) {
      if (g.cmd) continue;
      if (n++ >= this.logShown) break;
      Gfx.font(ctx, size, Gfx.FONT);
      ctx.fillStyle = g.color || Gfx.C.ink;
      ctx.fillText(g.ch, cx, 0);
      cx += ctx.measureText(g.ch).width;
    }
    ctx.restore();
  }

  drawGauge(ctx) {
    const x = 776, y = 14, w = 168, h = 62;
    const full = this.gauge >= GAUGE_MAX;
    Gfx.box(ctx, x, y, w, h, { fill: full ? '#ffe3ec' : '#fff8ec' });
    Gfx.text(ctx, 'TOGETHER', x + w / 2, y + 24, { size: 17, font: Gfx.BOLD, align: 'center', color: full ? '#d8578a' : Gfx.C.inkSoft });
    const bx = x + 16, bw = w - 32;
    const col = full ? (Math.floor(this.t / 8) % 2 ? '#ff8fa3' : '#ffb3c6') : '#ff8fa3';
    Gfx.bar(ctx, bx, y + 34, bw, 16, this.gauge / GAUGE_MAX, col, '#f7e1e6');
    for (let i = 0; i < 4; i++) Gfx.icon(ctx, 'heart', bx + 12 + i * (bw - 24) / 3, y + 42, 6, { alpha: this.gauge >= (i + 1) * 25 ? 1 : 0.3 });
  }

  drawMenus(ctx) {
    const ui = this.ui;
    if (!ui) return;
    if (ui.type === 'party') {
      const { x, y, w, h } = this.menuBox(ui);
      Gfx.box(ctx, x, y, w, h, {});
      ui.options.forEach((o, i) => {
        const xx = x + 12 + i * (w - 24) / 2, bw = (w - 24) / 2;
        const dis = (ui.disabled || []).includes(i);
        if (i === ui.index) { Gfx.roundRect(ctx, xx, y + 9, bw, 40, 10); ctx.fillStyle = Gfx.C.select; ctx.fill(); Gfx.cursor(ctx, xx + 18, y + 29, this.t); }
        Gfx.text(ctx, o, xx + 36, y + 40, { size: 28, font: Gfx.BOLD, color: dis ? '#b8aab0' : Gfx.C.ink });
      });
      return;
    }
    if (ui.type === 'actor') {
      const { x, y, w, h } = this.menuBox(ui);
      Gfx.box(ctx, x, y, w, h, {});
      ui.options.forEach((o, i) => {
        const yy = y + 12 + i * 40;
        if (i === ui.index) { Gfx.roundRect(ctx, x + 10, yy, w - 20, 36, 10); ctx.fillStyle = o.id === 'together' ? '#ffd0dc' : Gfx.C.select; ctx.fill(); Gfx.cursor(ctx, x + 26, yy + 18, this.t); }
        Gfx.text(ctx, o.label, x + 46, yy + 28, { size: 26, font: Gfx.BOLD, color: o.disabled ? '#b8aab0' : o.id === 'together' ? '#d8578a' : Gfx.C.ink });
      });
      return;
    }
    if (ui.type === 'list') {
      const { x, y, w, h } = this.menuBox(ui);
      Gfx.box(ctx, x, y, w, h, {});
      const first = this.listFirst(ui);
      ui.list.slice(first, first + 12).forEach((id, j) => {
        const i = first + j;
        const col = i % 2, row = Math.floor(j / 2);
        const xx = x + 18 + col * (w / 2 - 10), yy = y + 14 + row * 44;
        let label = '', right = '', dis = false;
        if (ui.mode === 'skill') { const s = SKILLS[id]; label = s.name; right = s.cost + ' PEP'; dis = ui.actor.pep < s.cost; }
        else if (ui.mode === 'item') { const it = ITEMS[id]; label = it.name; right = '×' + (State.itemCount(id) - (this.reserved[id] || 0)); }
        else if (ui.mode === 'together') { const tg = TOGETHER[id]; label = tg.name; right = '♥'; }
        if (i === ui.index) { Gfx.roundRect(ctx, xx - 6, yy, w / 2 - 22, 40, 10); ctx.fillStyle = Gfx.C.select; ctx.fill(); Gfx.cursor(ctx, xx + 10, yy + 20, this.t); }
        if (ui.mode === 'item') Gfx.icon(ctx, ITEMS[id].icon || 'treat', xx + 34, yy + 20, 11);
        Gfx.text(ctx, label, xx + (ui.mode === 'item' ? 54 : 32), yy + 30, { size: 26, color: dis ? '#b8aab0' : Gfx.C.ink });
        Gfx.text(ctx, right, xx + w / 2 - 36, yy + 30, { size: 20, font: Gfx.BOLD, align: 'right', color: dis ? '#d0a0a8' : Gfx.C.inkSoft });
      });
      // description
      const id = ui.list[ui.index];
      const desc = ui.mode === 'skill' ? SKILLS[id].desc : ui.mode === 'item' ? ITEMS[id].desc : TOGETHER[id].desc;
      ctx.strokeStyle = 'rgba(58,42,48,0.25)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 20, y + h - 60); ctx.lineTo(x + w - 20, y + h - 60); ctx.stroke();
      Gfx.text(ctx, desc, x + 24, y + h - 24, { size: 24, color: Gfx.C.inkSoft });
      return;
    }
    if (ui.type === 'target') {
      const t = ui.cands[ui.index];
      const label = t.side === 'enemy' ? `${t.name}  ${t.hp}/${t.maxhp}` : t.name;
      const extra = t.mood !== 'neutral' ? '  · ' + (MOODS[t.mood].lvName ? MOODS[t.mood].lvName[t.moodLv - 1] : MOODS[t.mood].name) : '';
      const w = Gfx.measure(ctx, label + extra, 24, Gfx.FONT) + 50;
      Gfx.box(ctx, Game.W / 2 - w / 2, 88, w, 44, { fill: '#fff3dc' });
      Gfx.text(ctx, label + extra, Game.W / 2, 118, { size: 24, align: 'center' });
    }
  }
}

// ---------------------------------------------------------------------------
// Game over screen
// ---------------------------------------------------------------------------
const GameOver = {
  show() {
    return new Promise((resolve) => {
      Sound.playBgm('bgm_gameover', { restart: true });
      const o = {
        t: 0, index: 0,
        update(active) {
          this.t++;
          if (!active || this.t < 60) return;
          if (Input.tapSelect(this, Input.rowHits(2, Game.W / 2 - 140, 505, 280, 50))) return;
          if (Input.repeat('up') || Input.repeat('down')) { this.index = 1 - this.index; Sound.sfx('sfx_cursor', { volume: 0.5 }); }
          if (Input.isPressed('ok')) {
            Sound.sfx('sfx_confirm');
            Game.removeOverlay(o);
            Sound.stopBgm(0.8);
            resolve(this.index === 0 ? 'retry' : 'title');
          }
        },
        draw(ctx) {
          ctx.fillStyle = '#1b1622'; ctx.fillRect(0, 0, Game.W, Game.H);
          const a = Math.min(1, this.t / 60);
          ctx.globalAlpha = a;
          // gentle falling rain
          ctx.strokeStyle = 'rgba(160,180,230,0.35)'; ctx.lineWidth = 1.5;
          for (let i = 0; i < 60; i++) { const x = (i * 73) % Game.W, y = ((i * 131) + this.t * 6) % Game.H; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 14); ctx.stroke(); }
          const img = Assets.get('cg_gameover');
          if (img) { const s = 300 / img.height; ctx.drawImage(img, Game.W / 2 - img.width * s / 2, 110, img.width * s, 300); }
          else { ctx.fillStyle = '#e0483e'; ctx.beginPath(); ctx.arc(Game.W / 2, 290, 70, Math.PI, 0); ctx.closePath(); ctx.fill(); }
          Gfx.text(ctx, "It's okay. You can rest for a bit.", Game.W / 2, 470, { size: 30, align: 'center', color: '#e8e0f0' });
          ['Try again', 'Back to title'].forEach((s, i) => {
            const y = 540 + i * 50;
            if (i === this.index) Gfx.cursor(ctx, Game.W / 2 - 110, y - 10, this.t);
            Gfx.text(ctx, s, Game.W / 2 - 84, y, { size: 30, font: Gfx.BOLD, color: i === this.index ? '#ffd6de' : '#9d93a8' });
          });
          ctx.globalAlpha = 1;
        },
      };
      Game.pushOverlay(o);
      Game.fadeIn(30);
    });
  },
};

window.Battle = Battle; window.BattleScene = BattleScene; window.GameOver = GameOver;
