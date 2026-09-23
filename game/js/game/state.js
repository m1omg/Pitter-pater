'use strict';
// ---------------------------------------------------------------------------
// Persistent game state: party, stats, inventory, flags, save/load.
// ---------------------------------------------------------------------------
const SAVE_PREFIX = 'pitterpatter_save_';
const OPTIONS_KEY = 'pitterpatter_options';

const State = {
  options: { textSpeed: 1, bgm: 0.7, sfx: 0.8, master: 0.9, alwaysRun: false, screenShake: true, touchStick: false },
  data: null,

  loadOptions() {
    try {
      const o = JSON.parse(localStorage.getItem(OPTIONS_KEY) || 'null');
      if (o) Object.assign(this.options, o);
    } catch (e) { /* ignore */ }
    this.applyOptions();
  },
  saveOptions() {
    try { localStorage.setItem(OPTIONS_KEY, JSON.stringify(this.options)); } catch (e) { /* ignore */ }
    this.applyOptions();
  },
  applyOptions() {
    Sound.volumes.master = this.options.master;
    Sound.volumes.bgm = this.options.bgm;
    Sound.volumes.sfx = this.options.sfx;
    Sound.applyVolumes();
  },

  newGame() {
    const d = {
      version: 1,
      party: ['pim'],
      actors: {},
      items: {},
      keyItems: {},
      marbles: 0,
      flags: {},
      vars: {},
      map: null, x: 0, y: 0, dir: 'down',
      world: 'dream',
      chapter: 0,
      playTime: 0,
      together: ['pile'],
      seenMaps: {},
      steps: 0,
      battles: 0,
      location: '',
    };
    for (const id of Object.keys(ACTORS)) d.actors[id] = this.makeActor(id, ACTORS[id].startLevel || 1);
    this.data = d;
    return d;
  },

  makeActor(id, level) {
    const a = { id, level, exp: DB.expForLevel(level), sticker: null, skills: [], mood: 'neutral', moodLv: 0 };
    const st = DB.actorStats(id, level, null);
    a.hp = st.maxhp; a.pep = st.maxpep;
    a.skills = DB.skillsForLevel(id, level);
    return a;
  },

  get d() { return this.data; },
  actor(id) { return this.data.actors[id]; },
  partyActors() { return this.data.party.map((id) => this.data.actors[id]); },
  stats(id) { const a = this.actor(id); return DB.actorStats(id, a.level, a.sticker); },

  flag(name) { return !!(this.data && this.data.flags[name]); },
  setFlag(name, v = true) { this.data.flags[name] = v; },
  v(name) { return (this.data && this.data.vars[name]) || 0; },
  setV(name, val) { this.data.vars[name] = val; },
  addV(name, n = 1) { this.data.vars[name] = this.v(name) + n; return this.data.vars[name]; },

  addParty(id) {
    if (!this.data.party.includes(id)) this.data.party.push(id);
    const a = this.actor(id);
    // catch up level with the party so new members are useful
    const lv = Math.max(...this.data.party.map((p) => this.actor(p).level));
    if (a.level < lv - 1) this.setLevel(id, lv - 1);
    const st = this.stats(id); a.hp = st.maxhp; a.pep = st.maxpep;
  },
  removeParty(id) { this.data.party = this.data.party.filter((p) => p !== id); },
  setParty(list) { this.data.party = list.slice(); },

  setLevel(id, lv) {
    const a = this.actor(id);
    a.level = lv; a.exp = Math.max(a.exp, DB.expForLevel(lv));
    for (const s of DB.skillsForLevel(id, lv)) if (!a.skills.includes(s)) a.skills.push(s);
  },

  // returns list of {id, level, newSkills}
  gainExp(amount) {
    const ups = [];
    for (const id of this.data.party) {
      const a = this.actor(id);
      if (a.hp <= 0) continue; // downed members get nothing (like classic RPGs)
      a.exp += amount;
      let leveled = false;
      const before = a.skills.slice();
      while (a.level < DB.MAX_LEVEL && a.exp >= DB.expForLevel(a.level + 1)) {
        const old = this.stats(id);
        a.level++;
        leveled = true;
        const nw = this.stats(id);
        a.hp += nw.maxhp - old.maxhp;
        a.pep += nw.maxpep - old.maxpep;
      }
      if (leveled) {
        for (const s of DB.skillsForLevel(id, a.level)) if (!a.skills.includes(s)) a.skills.push(s);
        const newSkills = a.skills.filter((s) => !before.includes(s));
        ups.push({ id, level: a.level, newSkills });
      }
    }
    return ups;
  },

  learnSkill(id, skill) {
    const a = this.actor(id);
    if (!a.skills.includes(skill)) a.skills.push(skill);
  },

  // ----- inventory -----
  itemCount(id) { return this.data.items[id] || 0; },
  addItem(id, n = 1) {
    const it = ITEMS[id];
    if (it && it.type === 'key') { this.data.keyItems[id] = true; return; }
    this.data.items[id] = Math.min(99, (this.data.items[id] || 0) + n);
    if (this.data.items[id] <= 0) delete this.data.items[id];
  },
  removeItem(id, n = 1) {
    if (this.data.keyItems[id]) { delete this.data.keyItems[id]; return; }
    this.data.items[id] = (this.data.items[id] || 0) - n;
    if (this.data.items[id] <= 0) delete this.data.items[id];
  },
  hasItem(id) { return !!(this.data.keyItems[id] || this.data.items[id]); },
  itemList(filterFn) {
    return Object.keys(this.data.items).filter((id) => ITEMS[id] && (!filterFn || filterFn(ITEMS[id]))).sort((a, b) => (ITEMS[a].order || 0) - (ITEMS[b].order || 0));
  },
  stickers() { return Object.keys(this.data.items).filter((id) => ITEMS[id] && ITEMS[id].type === 'sticker'); },

  healAll() {
    for (const id of Object.keys(this.data.actors)) {
      const a = this.actor(id), st = this.stats(id);
      a.hp = st.maxhp; a.pep = st.maxpep; a.mood = 'neutral'; a.moodLv = 0;
    }
  },

  // ----- save / load -----
  slotKey(i) { return SAVE_PREFIX + i; },
  save(slot) {
    const d = this.data;
    d.savedAt = Date.now();
    try {
      localStorage.setItem(this.slotKey(slot), JSON.stringify(d));
      return true;
    } catch (e) { return false; }
  },
  peek(slot) {
    try { return JSON.parse(localStorage.getItem(this.slotKey(slot)) || 'null'); } catch (e) { return null; }
  },
  load(slot) {
    const d = this.peek(slot);
    if (!d) return false;
    // make sure newer actors exist
    for (const id of Object.keys(ACTORS)) if (!d.actors[id]) d.actors[id] = this.makeActor(id, ACTORS[id].startLevel || 1);
    d.keyItems = d.keyItems || {};
    this.data = d;
    return true;
  },
  anySave() { for (let i = 1; i <= 3; i++) if (this.peek(i)) return true; return false; },
  // snapshot used for "try again" after losing a battle
  snapshot() { return JSON.stringify(this.data); },
  restore(snap) { this.data = JSON.parse(snap); },
};
window.State = State;
