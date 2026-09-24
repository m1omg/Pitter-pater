'use strict';
// ---------------------------------------------------------------------------
// Game database: formulas, moods, actors, skills, items, stickers, enemies, troops.
// Skill/item effects are async functions using the battle API (see battle.js).
// ---------------------------------------------------------------------------
const DB = {
  MAX_LEVEL: 20,
  expForLevel(L) { return L <= 1 ? 0 : Math.round(12 * Math.pow(L - 1, 2.1)); },
  actorStats(id, level, sticker) {
    const A = ACTORS[id];
    const s = {};
    for (const k of ['maxhp', 'maxpep', 'atk', 'def', 'spd', 'luck']) {
      s[k] = Math.round(A.base[k] + A.grow[k] * (level - 1));
    }
    const st = sticker && ITEMS[sticker];
    if (st && st.bonus) for (const k in st.bonus) s[k] = (s[k] || 0) + st.bonus[k];
    return s;
  },
  skillsForLevel(id, level) {
    return ACTORS[id].learn.filter(([lv]) => lv <= level).map(([, sk]) => sk);
  },
};

// ---------------------------------------------------------------------------
// Moods. Primary moods have two intensities. Mixing two primaries makes a blend,
// adding the third primary to a blend makes the target OVERWHELMED.
// ---------------------------------------------------------------------------
const MOODS = {
  neutral: { name: 'CALM', color: '#fff8ec', desc: 'Nothing special.' },
  cheery: {
    name: 'CHEERY', color: '#ffd166', icon: 'cheery', primary: true,
    lv: [{ spd: 1.25, crit: 0.08, miss: 0.1 }, { spd: 1.5, crit: 0.16, miss: 0.18 }],
    lvName: ['CHEERY', 'GIDDY'],
    desc: 'Faster and luckier, but a bit careless.',
  },
  gloomy: {
    name: 'GLOOMY', color: '#7fb2ec', icon: 'gloomy', primary: true,
    lv: [{ def: 1.35, spd: 0.8, pepRegen: 0.08 }, { def: 1.7, spd: 0.65, pepRegen: 0.15 }],
    lvName: ['GLOOMY', 'DOWNCAST'],
    desc: 'Sturdier and slower. Slowly regains PEP.',
  },
  huffy: {
    name: 'HUFFY', color: '#ef6f5e', icon: 'huffy', primary: true,
    lv: [{ atk: 1.3, def: 0.75 }, { atk: 1.6, def: 0.55 }],
    lvName: ['HUFFY', 'FUMING'],
    desc: 'Hits harder, guards worse.',
  },
  rainbow: { name: 'RAINBOW', color: '#b7e4a6', icon: 'rainbow', blend: ['cheery', 'gloomy'], atk: 0.85, regen: 0.08, desc: 'Bittersweet. Heals a little every turn.' },
  stormy: { name: 'STORMY', color: '#9b8ec4', icon: 'stormy', blend: ['gloomy', 'huffy'], atk: 1.2, def: 1.2, skip: 0.35, desc: 'Tough but sulky. Might refuse to act.' },
  heatwave: { name: 'HEATWAVE', color: '#ff9e57', icon: 'heatwave', blend: ['cheery', 'huffy'], atk: 1.35, spd: 1.35, burn: 0.06, desc: 'Fast and fierce, but burning out.' },
  overwhelmed: { name: 'OVERWHELMED', color: '#b9aeb5', icon: 'overwhelmed', takeMult: 1.5, desc: 'Too many feelings! Loses a turn and takes extra damage.' },
};
function blendOf(a, b) {
  for (const k of ['rainbow', 'stormy', 'heatwave']) {
    const bl = MOODS[k].blend;
    if ((bl[0] === a && bl[1] === b) || (bl[0] === b && bl[1] === a)) return k;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Party
// ---------------------------------------------------------------------------
const ACTORS = {
  pim: {
    name: 'PIM', color: '#ffb8c6',
    base: { maxhp: 62, maxpep: 30, atk: 10, def: 8, spd: 10, luck: 8 },
    grow: { maxhp: 9, maxpep: 4, atk: 2.1, def: 1.6, spd: 1.5, luck: 1 },
    attackText: '{u} bonks {t} with her umbrella!', attackSfx: 'sfx_bonk',
    learn: [[1, 'twirl'], [1, 'shelter'], [3, 'puddle_jump'], [5, 'its_fine'], [7, 'pep_talk'], [9, 'brolly_bash'], [12, 'sunny_side']],
  },
  biscuit: {
    name: 'BISCUIT', color: '#ffc38a',
    base: { maxhp: 50, maxpep: 28, atk: 13, def: 6, spd: 13, luck: 10 },
    grow: { maxhp: 7, maxpep: 3.6, atk: 2.7, def: 1.1, spd: 2, luck: 1.2 },
    attackText: '{u} scratches {t}!', attackSfx: 'sfx_scratch',
    learn: [[1, 'hiss'], [1, 'pounce'], [4, 'knock_off'], [6, 'cat_nap'], [8, 'zoomies'], [10, 'nine_lives'], [12, 'puff_up']],
  },
  waffles: {
    name: 'WAFFLES', color: '#ffe08a',
    base: { maxhp: 82, maxpep: 24, atk: 9, def: 11, spd: 7, luck: 6 },
    grow: { maxhp: 12, maxpep: 3, atk: 1.9, def: 2, spd: 1.1, luck: 0.8 },
    attackText: '{u} headbutts {t}!', attackSfx: 'sfx_headbutt',
    learn: [[1, 'wag'], [1, 'good_boy'], [4, 'fetch'], [6, 'big_bark'], [8, 'belly_flop'], [10, 'howl'], [12, 'best_friend']],
  },
  momo: {
    name: 'MOMO', color: '#c9dcff', startLevel: 3,
    base: { maxhp: 55, maxpep: 44, atk: 7, def: 9, spd: 9, luck: 9 },
    grow: { maxhp: 8, maxpep: 6, atk: 1.3, def: 1.6, spd: 1.4, luck: 1 },
    attackText: '{u} bumps into {t} softly.', attackSfx: 'sfx_hit',
    learn: [[1, 'drizzle'], [1, 'soft_rain'], [3, 'fluff_up'], [5, 'lullaby'], [7, 'rainfall'], [9, 'silver_lining'], [11, 'downpour']],
  },
};

// ---------------------------------------------------------------------------
// Skills. target: foe | foes | ally | allies | allyDown | self | any
// ---------------------------------------------------------------------------
const SKILLS = {
  // ----- PIM -----
  twirl: {
    name: 'Twirl', cost: 4, target: 'foe', desc: 'Spin the umbrella into a foe. PIM becomes CHEERY.',
    async run(B, u, t) {
      await B.log(`${u.name} twirls her umbrella!`);
      await B.attack(u, t, { power: 1.0, sfx: 'sfx_bonk', fx: 'spin' });
      await B.mood(u, 'cheery');
    },
  },
  shelter: {
    name: 'Shelter', cost: 6, target: 'ally', priority: true, desc: 'Hold the umbrella over a friend. PIM takes their hits this turn.',
    async run(B, u, t) {
      Sound.sfx('sfx_umbrella');
      if (t === u) { await B.log(`${u.name} hides under her umbrella.`); u.guard = true; return; }
      await B.log(`${u.name} holds her umbrella over ${t.name}!`);
      t.shelteredBy = u; u.guard = true;
      B.fx(t, 'shield');
    },
  },
  puddle_jump: {
    name: 'Puddle Jump', cost: 10, target: 'foes', desc: 'SPLASH! Hits all foes and makes them GLOOMY.',
    async run(B, u, ts) {
      await B.log(`${u.name} jumps into a puddle! SPLASH!`);
      Sound.sfx('sfx_splash');
      for (const t of ts) { if (t.alive) { await B.attack(u, t, { power: 0.6, fx: 'splash', quick: true }); if (t.alive) await B.mood(t, 'gloomy', { quick: true }); } }
    },
  },
  its_fine: {
    name: "It's Fine!", cost: 8, target: 'self', desc: 'Everything is fine! Heals PIM and makes her CHEERY.',
    async run(B, u) {
      if (State.flag('umbrella_closed')) {
        await B.log(`${u.name} tries to say it's fine...`);
        await B.log(`...but it isn't. Not really.`);
        return;
      }
      await B.log(`${u.name} smiles. "It's fine! I'm fine!"`);
      await B.heal(u, Math.round(u.maxhp * 0.35));
      await B.mood(u, 'cheery');
    },
  },
  pep_talk: {
    name: 'Pep Talk', cost: 10, target: 'ally', desc: 'Cheer a friend on. Restores PEP and makes them CHEERY.',
    async run(B, u, t) {
      await B.log(`${u.name} gives ${t === u ? 'herself' : t.name} a pep talk!`);
      await B.restorePep(t, Math.round(t.maxpep * 0.3));
      await B.mood(t, 'cheery');
    },
  },
  brolly_bash: {
    name: 'Brolly Bash', cost: 16, target: 'foe', desc: 'A mighty umbrella whack. Extra strong on OVERWHELMED or STORMY foes.',
    async run(B, u, t) {
      await B.log(`${u.name} swings her umbrella with all her might!`);
      const bonus = t.mood === 'overwhelmed' || t.mood === 'stormy' ? 1.5 : 1;
      await B.attack(u, t, { power: 2.2 * bonus, sfx: 'sfx_hit_heavy', fx: 'big' });
    },
  },
  sunny_side: {
    name: 'Sunny Side Up', cost: 20, target: 'allies', desc: 'Everyone becomes CHEERY and faster.',
    async run(B, u, ts) {
      await B.log(`${u.name} opens her umbrella like a little sun!`);
      for (const t of ts) { await B.mood(t, 'cheery', { quick: true }); B.buff(t, 'spd', 1, 3); }
      await B.wait(20);
    },
  },
  close_umbrella: {
    name: 'Close Umbrella', cost: 0, target: 'self', hidden: true, desc: 'Let it rain.',
    async run(B, u) { await B.story('close_umbrella', u); },
  },
  cry: {
    name: 'Cry', cost: 0, target: 'self', hidden: true, desc: "It's okay to cry.",
    async run(B, u) { await B.story('cry', u); },
  },
  // ----- BISCUIT -----
  hiss: {
    name: 'Hiss', cost: 4, target: 'foe', desc: 'Makes a foe HUFFY and lowers its DEF.',
    async run(B, u, t) {
      await B.log(`${u.name} arches his back and HISSES at ${t.name}!`);
      Sound.sfx('sfx_meow', { pitch: 0.8 });
      await B.mood(t, 'huffy');
      B.buff(t, 'def', -1, 3);
    },
  },
  pounce: {
    name: 'Pounce', cost: 8, target: 'foe', desc: 'A big jump attack. Hits twice if BISCUIT is HUFFY.',
    async run(B, u, t) {
      await B.log(`${u.name} wiggles... and POUNCES!`);
      const huff = ['huffy', 'stormy', 'heatwave'].includes(u.mood);
      await B.attack(u, t, { power: 1.6, sfx: 'sfx_scratch', fx: 'claw' });
      if (huff && t.alive) { await B.log(`${u.name} pounces again!`); await B.attack(u, t, { power: 1.0, sfx: 'sfx_scratch', fx: 'claw' }); }
    },
  },
  knock_off: {
    name: 'Knock Off', cost: 12, target: 'foes', desc: 'Knocks things off a table onto every foe.',
    async run(B, u, ts) {
      await B.log(`${u.name} stares at you... and knocks everything off the table!`);
      Sound.sfx('sfx_fall');
      for (const t of ts) if (t.alive) await B.attack(u, t, { power: 0.8, quick: true, fx: 'crash' });
    },
  },
  cat_nap: {
    name: 'Cat Nap', cost: 8, target: 'self', desc: 'A quick nap. Heals BISCUIT and clears bad statuses.',
    async run(B, u) {
      await B.log(`${u.name} curls up for a tiny nap. Zzz...`);
      Sound.sfx('sfx_sleep');
      await B.heal(u, Math.round(u.maxhp * 0.4));
      B.clearStatuses(u);
    },
  },
  zoomies: {
    name: 'Zoomies', cost: 14, target: 'foes', desc: 'Runs around wildly, hitting random foes 3-5 times. Makes BISCUIT CHEERY.',
    async run(B, u) {
      await B.log(`${u.name} gets the ZOOMIES!`);
      const n = U.randInt(3, 5);
      for (let i = 0; i < n; i++) {
        const t = B.randomAlive(B.foesOf(u));
        if (!t) break;
        await B.attack(u, t, { power: 0.7, quick: true, fx: 'claw', sfx: 'sfx_scratch' });
      }
      await B.mood(u, 'cheery');
    },
  },
  nine_lives: {
    name: 'Nine Lives', cost: 18, target: 'self', desc: 'For 3 turns, BISCUIT survives a knockout with 1 HEART.',
    async run(B, u) {
      await B.log(`${u.name} counts his lives. Yep, still got a few.`);
      B.setStatus(u, 'ninelives', 3);
      B.fx(u, 'sparkle');
      await B.wait(20);
    },
  },
  puff_up: {
    name: 'Puff Up', cost: 10, target: 'foes', desc: 'Puffs up to twice his size. All foes lose ATK.',
    async run(B, u, ts) {
      await B.log(`${u.name} puffs up into a big scary floof!`);
      Sound.sfx('sfx_meow', { pitch: 0.7 });
      for (const t of ts) if (t.alive) B.buff(t, 'atk', -1, 3);
      await B.wait(24);
    },
  },
  // ----- WAFFLES -----
  wag: {
    name: 'Wag', cost: 4, target: 'any', desc: 'A happy tail wag. Makes anyone CHEERY.',
    async run(B, u, t) {
      await B.log(`${u.name} wags his tail at ${t === u ? 'nobody in particular' : t.name}!`);
      await B.mood(t, 'cheery');
    },
  },
  good_boy: {
    name: 'Good Boy', cost: 6, target: 'allies', priority: true, desc: 'Stands in front of everyone. Friends take less damage this turn.',
    async run(B, u, ts) {
      await B.log(`${u.name} stands tall in front of his friends. Good boy!`);
      Sound.sfx('sfx_bark');
      for (const t of ts) if (t !== u) t.protectedBy = u;
      u.guard = true;
      B.fx(u, 'shield');
      await B.wait(10);
    },
  },
  fetch: {
    name: 'Fetch!', cost: 8, target: 'self', desc: 'Runs off and brings back a treat for the friend who needs it most.',
    async run(B, u) {
      await B.log(`${u.name} runs off somewhere...`);
      await B.wait(20);
      const treat = U.pick(['cookie', 'cookie', 'toast', 'warm_milk', 'lemonade']);
      const t = B.lowestHp(B.alliesOf(u));
      await B.log(`...and comes back with a ${ITEMS[treat].name} for ${t.name}!`);
      await ITEMS[treat].run(B, u, t, { free: true });
    },
  },
  big_bark: {
    name: 'Big Bark', cost: 10, target: 'foes', desc: 'WOOF! All foes lose ATK and might get SPOOKED.',
    async run(B, u, ts) {
      await B.log(`${u.name} lets out a BIG BARK!`);
      Sound.sfx('sfx_bark', { pitch: 0.85 });
      Game.shake(5, 12);
      for (const t of ts) {
        if (!t.alive) continue;
        B.buff(t, 'atk', -1, 3);
        if (U.chance(0.3) && !t.boss) B.setStatus(t, 'spooked', 2);
      }
      await B.wait(24);
    },
  },
  belly_flop: {
    name: 'Belly Flop', cost: 14, target: 'foe', desc: 'A heavy flop. Raises WAFFLES\' DEF.',
    async run(B, u, t) {
      await B.log(`${u.name} jumps up high and BELLY FLOPS!`);
      await B.attack(u, t, { power: 2.0, sfx: 'sfx_hit_heavy', fx: 'big' });
      B.buff(u, 'def', 1, 3);
    },
  },
  howl: {
    name: 'Howl', cost: 12, target: 'allies', desc: 'A brave howl. Raises everyone\'s ATK.',
    async run(B, u, ts) {
      await B.log(`${u.name} howls at the rainy sky! Awooo!`);
      Sound.sfx('sfx_bark', { pitch: 1.2 });
      for (const t of ts) B.buff(t, 'atk', 1, 3);
      await B.wait(24);
    },
  },
  best_friend: {
    name: 'Best Friend', cost: 18, target: 'ally', desc: 'Big warm cuddles. Heals a lot and makes them CHEERY.',
    async run(B, u, t) {
      await B.log(`${u.name} gives ${t.name} the biggest, fluffiest cuddle.`);
      await B.heal(t, Math.round(t.maxhp * 0.6));
      await B.mood(t, 'cheery');
    },
  },
  // ----- MOMO -----
  drizzle: {
    name: 'Drizzle', cost: 4, target: 'any', desc: 'A little rain. Makes anyone GLOOMY.',
    async run(B, u, t) {
      await B.log(`${u.name} rains softly on ${t === u ? 'herself' : t.name}.`);
      await B.mood(t, 'gloomy');
    },
  },
  soft_rain: {
    name: 'Soft Rain', cost: 6, target: 'ally', desc: 'Heals a friend\'s HEART.',
    async run(B, u, t) {
      await B.log(`${u.name} sprinkles a soft, warm rain on ${t === u ? 'herself' : t.name}.`);
      await B.heal(t, Math.round(t.maxhp * 0.4) + 10);
    },
  },
  fluff_up: {
    name: 'Fluff Up', cost: 8, target: 'ally', desc: 'Wraps a friend in fluffy cloud. Greatly raises DEF.',
    async run(B, u, t) {
      await B.log(`${u.name} wraps ${t === u ? 'herself' : t.name} in fluffy cloud.`);
      B.buff(t, 'def', 2, 3);
      B.fx(t, 'shield');
      await B.wait(18);
    },
  },
  lullaby: {
    name: 'Lullaby', cost: 12, target: 'foes', desc: 'A sleepy song. Foes may fall asleep.',
    async run(B, u, ts) {
      await B.log(`${u.name} hums a sleepy little lullaby...`);
      Sound.sfx('sfx_sleep');
      for (const t of ts) {
        if (!t.alive) continue;
        if (U.chance(t.boss ? 0.25 : 0.65)) B.setStatus(t, 'sleepy', 3);
        else B.popText(t, 'awake!', '#8a7f86');
      }
      await B.wait(30);
    },
  },
  rainfall: {
    name: 'Rainfall', cost: 16, target: 'allies', desc: 'Gentle rain for everyone. Heals all friends.',
    async run(B, u, ts) {
      await B.log(`${u.name} lets a gentle rain fall over everyone.`);
      for (const t of ts) if (t.alive) B.heal(t, Math.round(t.maxhp * 0.3) + 8, { quick: true });
      await B.wait(40);
    },
  },
  silver_lining: {
    name: 'Silver Lining', cost: 20, target: 'allyDown', desc: 'Brings a downed friend back with half their HEART.',
    async run(B, u, t) {
      await B.log(`${u.name} finds the silver lining around ${t.name}.`);
      await B.revive(t, 0.5);
    },
  },
  downpour: {
    name: 'Downpour', cost: 14, target: 'foes', desc: 'A heavy shower. Hits all foes and makes them GLOOMY.',
    async run(B, u, ts) {
      await B.log(`${u.name} rumbles... and it POURS!`);
      Sound.sfx('sfx_thunder');
      for (const t of ts) { if (t.alive) { await B.attack(u, t, { power: 0.9, fx: 'splash', quick: true }); if (t.alive) await B.mood(t, 'gloomy', { quick: true }); } }
    },
  },
};

// TOGETHER moves (team gauge)
const TOGETHER = {
  pile: {
    name: 'Pile On!', target: 'foe', desc: 'Everyone jumps on one foe at once!',
    async run(B, u, t) {
      await B.log('Everyone piles on together!');
      Sound.sfx('sfx_together');
      let total = 0;
      for (const m of B.party.filter((p) => p.alive)) total += Math.max(1, B.stat(m, 'atk') * 1.3 * 2 - B.stat(t, 'def'));
      await B.attack(u, t, { fixed: Math.round(total), sfx: 'sfx_hit_heavy', fx: 'big', noCrit: true });
    },
  },
  hug: {
    name: 'Group Hug', target: 'allies', desc: 'A big warm group hug. Heals everyone and calms bad feelings.',
    async run(B, u, ts) {
      await B.log('Everyone comes together for a big group hug.');
      Sound.sfx('sfx_together');
      for (const t of B.party) {
        if (!t.alive) await B.revive(t, 0.3, { quick: true });
        else B.heal(t, Math.round(t.maxhp * 0.5), { quick: true });
        B.restorePep(t, Math.round(t.maxpep * 0.25), { quick: true });
        B.clearStatuses(t);
        if (t.mood === 'overwhelmed' || t.mood === 'stormy' || t.mood === 'heatwave') B.setMood(t, 'neutral', 0);
      }
      await B.wait(40);
    },
  },
  fort: {
    name: 'Pillow Fort', target: 'allies', desc: 'Build a pillow fort! Everyone guards and gets tougher for 3 turns.',
    async run(B, u, ts) {
      await B.log('Everyone builds a pillow fort! Nothing can get you in here!');
      Sound.sfx('sfx_together');
      for (const t of B.party) { if (t.alive) { t.guard = true; B.buff(t, 'def', 2, 3); B.fx(t, 'shield'); } }
      await B.wait(40);
    },
  },
};

// ---------------------------------------------------------------------------
// Items: treat (heal), trinket (battle toy), sticker (equip), key
// ---------------------------------------------------------------------------
const healItem = (name, price, hp, pep, desc, order, extra = {}) => Object.assign({
  name, type: 'treat', price, target: extra.target || 'ally', desc, order, icon: 'treat',
  async run(B, u, t, o = {}) {
    const targets = Array.isArray(t) ? t : [t];
    if (!o.free) await B.log(`${u.name} shares a ${name}${targets.length > 1 ? ' with everyone' : targets[0] === u ? '' : ' with ' + targets[0].name}.`);
    for (const x of targets) {
      if (extra.revive && !x.alive) { await B.revive(x, extra.revive, { quick: true }); continue; }
      if (!x.alive) continue;
      if (hp) B.heal(x, hp === 'full' ? x.maxhp : hp, { quick: true });
      if (pep) B.restorePep(x, pep === 'full' ? x.maxpep : pep, { quick: true });
    }
    await B.wait(34);
  },
  field(actorId) {
    const a = State.actor(actorId), st = State.stats(actorId);
    if (extra.revive && a.hp <= 0) { a.hp = Math.round(st.maxhp * extra.revive); return true; }
    if (a.hp <= 0) return false;
    if (hp && a.hp >= st.maxhp && (!pep || a.pep >= st.maxpep)) return false;
    if (!hp && pep && a.pep >= st.maxpep) return false;
    if (hp) a.hp = Math.min(st.maxhp, a.hp + (hp === 'full' ? st.maxhp : hp));
    if (pep) a.pep = Math.min(st.maxpep, a.pep + (pep === 'full' ? st.maxpep : pep));
    return true;
  },
}, extra);

const moodToy = (name, price, mood, desc, order) => ({
  name, type: 'trinket', price, target: 'any', desc, order, icon: 'trinket',
  async run(B, u, t) {
    await B.log(`${u.name} uses the ${name} on ${t.name}!`);
    Sound.sfx('sfx_throw');
    if (mood === 'gloomy' && t.side === 'enemy') await B.attack(u, t, { fixed: 12, quick: true, fx: 'splash', sfx: 'sfx_splash' });
    if (t.alive) await B.mood(t, mood);
  },
});

const ITEMS = {
  // treats
  cookie: healItem('Crumb Cookie', 10, 40, 0, 'A crunchy cookie. Heals 40 HEART.', 1),
  toast: healItem('Buttered Toast', 28, 90, 0, 'Warm and buttery. Heals 90 HEART.', 2),
  pancakes: healItem('Pancake Stack', 65, 180, 0, 'Fluffy stack with syrup. Heals 180 HEART.', 3),
  jelly: healItem('Jelly Jar', 55, 60, 0, 'Wobbly! Heals 60 HEART for everyone.', 4, { target: 'allies' }),
  gummy: healItem('Gummy Worm', 8, 0, 12, 'Chewy. Restores 12 PEP.', 5),
  warm_milk: healItem('Warm Milk', 20, 0, 28, 'Cozy. Restores 28 PEP.', 6),
  cocoa: healItem('Cocoa', 48, 0, 60, 'With tiny marshmallows. Restores 60 PEP.', 7),
  lemonade: healItem('Lemonade', 24, 40, 15, 'Sweet and sour. Heals 40 HEART and 15 PEP.', 8),
  soup: healItem('Chicken Soup', 45, 0, 0, 'Makes anyone feel better. Revives a downed friend with half HEART.', 9, { target: 'allyDown', revive: 0.5 }),
  cake: healItem('Birthday Cake', 0, 'full', 'full', 'A whole cake! Fully heals and revives everyone.', 10, { target: 'allies', revive: 1 }),
  // trinkets
  bubbles: moodToy('Bubble Wand', 14, 'cheery', 'Blow bubbles at anyone. Makes them CHEERY.', 20),
  balloon: moodToy('Water Balloon', 14, 'gloomy', 'Splash! Makes anyone GLOOMY (and a bit wet).', 21),
  cushion: moodToy('Whoopee Cushion', 14, 'huffy', 'Pffffbt. Makes anyone HUFFY.', 22),
  duck: {
    name: 'Rubber Duck', type: 'trinket', price: 20, target: 'foe', desc: 'Throw it! Deals 45 damage. Squeak.', order: 23, icon: 'trinket',
    async run(B, u, t) { await B.log(`${u.name} throws a rubber duck at ${t.name}!`); Sound.sfx('sfx_squeak'); await B.attack(u, t, { fixed: 45, fx: 'crash' }); },
  },
  popper: {
    name: 'Party Popper', type: 'trinket', price: 34, target: 'foes', desc: 'POP! Deals 30 damage to all foes.', order: 24, icon: 'trinket',
    async run(B, u, ts) { await B.log(`${u.name} pulls a party popper! POP!`); Sound.sfx('sfx_boom'); for (const t of ts) if (t.alive) await B.attack(u, t, { fixed: 30, quick: true, fx: 'confetti' }); },
  },
  snowglobe: {
    name: 'Snow Globe', type: 'trinket', price: 30, target: 'foe', desc: 'So pretty... Puts a foe to sleep.', order: 25, icon: 'trinket',
    async run(B, u, t) { await B.log(`${u.name} shows ${t.name} a snow globe. So pretty...`); Sound.sfx('sfx_sleep'); if (!t.boss || U.chance(0.35)) B.setStatus(t, 'sleepy', 3); else B.popText(t, 'resisted!', '#8a7f86'); await B.wait(24); },
  },
  kazoo: {
    name: 'Kazoo', type: 'trinket', price: 18, target: 'foes', desc: 'Bzzzrt! Gives every foe a random mood.', order: 26, icon: 'trinket',
    async run(B, u, ts) { await B.log(`${u.name} plays the kazoo. BZZZZRT!`); for (const t of ts) if (t.alive) await B.mood(t, U.pick(['cheery', 'gloomy', 'huffy']), { quick: true }); await B.wait(12); },
  },
  tea: {
    name: 'Calming Tea', type: 'trinket', price: 22, target: 'any', desc: 'Calms anyone down (clears their mood) and heals a little.', order: 27, icon: 'trinket',
    async run(B, u, t) { await B.log(`${u.name} offers ${t.name} a cup of calming tea.`); B.setMood(t, 'neutral', 0); B.popText(t, 'calm', '#8a7f86'); if (t.side === 'party') await B.heal(t, Math.round(t.maxhp * 0.15)); else await B.wait(20); },
  },
  // stickers (equipment)
  st_star: { name: 'Gold Star', type: 'sticker', price: 60, bonus: { atk: 3, luck: 4 }, desc: 'You did great! +3 ATK, +4 LUCK.', order: 40, icon: 'sticker' },
  st_heart: { name: 'Heart Sticker', type: 'sticker', price: 60, bonus: { maxhp: 25 }, desc: '+25 max HEART.', order: 41, icon: 'sticker' },
  st_cloud: { name: 'Rain Cloud', type: 'sticker', price: 0, bonus: { def: 4 }, startMood: 'gloomy', desc: '+4 DEF. Starts battles GLOOMY.', order: 42, icon: 'sticker' },
  st_sun: { name: 'Sunflower', type: 'sticker', price: 0, bonus: { spd: 3 }, startMood: 'cheery', desc: '+3 SPD. Starts battles CHEERY.', order: 43, icon: 'sticker' },
  st_bolt: { name: 'Lightning', type: 'sticker', price: 0, bonus: { atk: 4 }, startMood: 'huffy', desc: '+4 ATK. Starts battles HUFFY.', order: 44, icon: 'sticker' },
  st_smile: { name: 'Smiley Face', type: 'sticker', price: 70, bonus: { maxpep: 12 }, pepRegen: 3, desc: '+12 max PEP. Regains 3 PEP each turn.', order: 45, icon: 'sticker' },
  st_bandaid: { name: 'Band-Aid', type: 'sticker', price: 45, bonus: { maxhp: 15, def: 2 }, desc: '+15 max HEART, +2 DEF.', order: 46, icon: 'sticker' },
  st_paw: { name: 'Paw Print', type: 'sticker', price: 55, bonus: { spd: 5 }, desc: '+5 SPD.', order: 47, icon: 'sticker' },
  st_moon: { name: 'Moon Sticker', type: 'sticker', price: 0, bonus: { maxpep: 8, def: 2 }, regen: 0.04, desc: '+8 PEP, +2 DEF. Heals a little each turn.', order: 48, icon: 'sticker' },
  st_glitter: { name: 'Glitter Star', type: 'sticker', price: 0, bonus: { maxhp: 20, atk: 3, def: 3, spd: 3, luck: 3 }, desc: 'Sparkly! +20 HEART and +3 to everything.', order: 49, icon: 'sticker' },
  // key items
  sun_toast: { name: 'Sunny Toast', type: 'key', desc: 'Golden and warm. It smells like Saturday mornings.', icon: 'star' },
  laugh_track: { name: 'Laugh Track', type: 'key', desc: 'A little tape of everybody laughing at the TV together.', icon: 'star' },
  fort_key: { name: 'Blanket Key', type: 'key', desc: 'A key made of a folded blanket corner. Soft.', icon: 'key' },
  pet_food: { name: 'Pet Food', type: 'key', desc: 'The big bag of kibble. Fish shapes for Biscuit, bone shapes for Waffles.', icon: 'treat' },
  flashlight: { name: 'Flashlight', type: 'key', desc: 'Dad\'s old flashlight. The batteries are almost dead.', icon: 'key' },
  attic_key: { name: 'Little Brass Key', type: 'key', desc: 'Found in a sock. Opens something small.', icon: 'key' },
  music_box: { name: 'Music Box', type: 'key', desc: 'It plays a tune Mom used to hum.', icon: 'star' },
  photo_scrap: { name: 'Photo Scraps', type: 'key', desc: 'Pieces of a torn photo.', icon: 'photo' },
  remote: { name: 'TV Remote', type: 'key', desc: 'The batteries are missing.', icon: 'key' },
  batteries: { name: 'Batteries', type: 'key', desc: 'Two AA batteries. Still a little tingly.', icon: 'key' },
  sugar: { name: 'Sugar Cube', type: 'key', desc: 'A perfectly square sugar cube.', icon: 'star' },
  tea_leaves: { name: 'Tea Leaves', type: 'key', desc: 'Smells like Madame Teapot.', icon: 'star' },
  lemon: { name: 'Lemon Slice', type: 'key', desc: 'A slice of lemon, surprisingly friendly.', icon: 'star' },
};

// ---------------------------------------------------------------------------
// Enemies. actions: [{w, name, cond?(B,me), run(B,me)}]
// ---------------------------------------------------------------------------
const hitOne = (text, power = 1, o = {}) => async (B, me) => {
  const t = B.enemyTarget(me);
  if (!t) return;
  await B.log(text.replace('{u}', me.name).replace('{t}', t.name));
  await B.attack(me, t, Object.assign({ power }, o));
  if (o.mood && t.alive) await B.mood(t, o.mood);
};
const hitAll = (text, power = 0.6, o = {}) => async (B, me) => {
  await B.log(text.replace('{u}', me.name));
  for (const t of B.alive(B.party)) await B.attack(me, t, Object.assign({ power, quick: true }, o));
};
const moodSelf = (text, mood) => async (B, me) => { await B.log(text.replace('{u}', me.name)); await B.mood(me, mood); };
const moodFoe = (text, mood) => async (B, me) => {
  const t = B.enemyTarget(me);
  if (!t) return;
  await B.log(text.replace('{u}', me.name).replace('{t}', t.name));
  await B.mood(t, mood);
};
const idle = (text) => async (B, me) => { await B.log(text.replace('{u}', me.name)); await B.wait(10); };

const ENEMIES = {
  // ----- everywhere / tutorial -----
  drizzlet: {
    name: 'DRIZZLET', sprite: 'en_drizzlet', hp: 30, atk: 7, def: 3, spd: 6, luck: 3, exp: 6, marbles: 4, h: 150,
    drops: [['cookie', 0.25]],
    desc: 'A tiny raincloud with a tiny temper.',
    actions: [
      { w: 5, run: hitOne('{u} drips on {t}.', 1, { sfx: 'sfx_splash', fx: 'splash' }) },
      { w: 2, run: moodSelf('{u} sulks in a little puddle.', 'gloomy') },
      { w: 2, run: moodFoe('{u} pitter-patters on {t}\'s head.', 'gloomy') },
    ],
  },
  // ----- Crumb Valley -----
  toast: {
    name: 'GRUMPY TOAST', sprite: 'en_toast', hp: 42, atk: 9, def: 5, spd: 5, luck: 4, exp: 10, marbles: 6, h: 170,
    drops: [['toast', 0.15], ['cookie', 0.2]],
    desc: 'Somebody burnt it and it has never forgiven them.',
    actions: [
      { w: 5, run: hitOne('{u} throws crumbs at {t}!', 1) },
      { w: 2, cond: (B, me) => me.mood !== 'huffy', run: moodSelf('{u} grumbles and gets even crustier.', 'huffy') },
      { w: 2, run: hitAll('{u} sprays burnt crumbs everywhere!', 0.55) },
    ],
  },
  lemon: {
    name: 'SOUR LEMON', sprite: 'en_lemon', hp: 36, atk: 8, def: 4, spd: 9, luck: 6, exp: 9, marbles: 6, h: 150,
    drops: [['lemonade', 0.25]],
    desc: 'Puckered up about something. Won\'t say what.',
    actions: [
      { w: 4, run: hitOne('{u} squirts juice in {t}\'s eye!', 1, { mood: 'huffy' }) },
      { w: 3, run: hitOne('{u} rolls into {t}.', 1.1) },
      { w: 2, run: async (B, me) => { const t = B.enemyTarget(me); await B.log(`${me.name} makes a sour face at ${t.name}.`); B.buff(t, 'atk', -1, 3); await B.wait(20); } },
    ],
  },
  sugarmite: {
    name: 'SUGAR MITE', sprite: 'en_sugarmite', hp: 28, atk: 7, def: 6, spd: 15, luck: 8, exp: 9, marbles: 5, h: 130,
    drops: [['gummy', 0.3]],
    desc: 'A sugar cube that had too much sugar.',
    actions: [
      { w: 4, run: hitOne('{u} nibbles {t}!', 1) },
      { w: 3, run: async (B, me) => { await B.log(`${me.name} has a SUGAR RUSH!`); await B.mood(me, 'cheery'); const t = B.enemyTarget(me); if (t) await B.attack(me, t, { power: 0.8 }); } },
      { w: 1, run: idle('{u} vibrates in place.') },
    ],
  },
  forkling: {
    name: 'FORKLING', sprite: 'en_forkling', hp: 38, atk: 10, def: 4, spd: 8, luck: 5, exp: 11, marbles: 7, h: 170,
    drops: [['cookie', 0.25]],
    desc: 'Pokey. Proud of it.',
    actions: [
      { w: 5, run: hitOne('{u} pokes {t}! Pokey pokey!', 1.05) },
      { w: 2, run: async (B, me) => { await B.log(`${me.name} polishes its prongs.`); B.buff(me, 'atk', 1, 3); await B.wait(20); } },
      { w: 2, run: moodFoe('{u} scrapes a plate. SKREEEE. {t} gets HUFFY!', 'huffy') },
    ],
  },
  grumbles: {
    name: 'GRUMBLES', sprite: 'en_grumbles', hp: 520, atk: 13, def: 7, spd: 6, luck: 5, exp: 70, marbles: 60, h: 360, boss: true,
    drops: [['toast', 1]],
    desc: 'The toaster at the top of Crumb Valley. Everything it touches gets burnt.',
    moodMax: 3,
    async script(B, me) {
      // every third turn it heats up; next turn it blasts everyone unless it has been cooled (GLOOMY)
      me.heat = (me.heat || 0) + 1;
      if (me.heat === 3) {
        await B.log('GRUMBLES is glowing red... It\'s heating up!');
        await B.say(null, 'GRUMBLES is getting really hot! Maybe something could {c:blue}cool it down{/c}...');
        me.charging = true;
        return true;
      }
      if (me.charging) {
        me.charging = false; me.heat = 0;
        if (['gloomy', 'rainbow', 'stormy'].includes(me.mood)) {
          await B.log('GRUMBLES tries to blast everyone... but it\'s all soggy and cold!');
          await B.log('Pfft. Only a sad little puff of smoke comes out.');
          B.setMood(me, 'neutral', 0);
          return true;
        }
        await B.log('GRUMBLES shoots out BURNT TOAST at everyone!');
        Sound.sfx('sfx_toaster');
        for (const t of B.alive(B.party)) await B.attack(me, t, { power: 1.25, quick: true, fx: 'crash' });
        return true;
      }
      return false;
    },
    actions: [
      { w: 5, run: hitOne('GRUMBLES pops out a slice of toast at {t}!', 1.1, { sfx: 'sfx_toaster' }) },
      { w: 2, run: moodSelf('GRUMBLES rattles angrily. Its coils glow!', 'huffy') },
      { w: 2, run: hitAll('GRUMBLES shakes crumbs all over everyone!', 0.6) },
      { w: 1, cond: (B) => B.alive(B.enemies).length < 3, run: async (B, me) => { await B.log('GRUMBLES pops out a GRUMPY TOAST!'); Sound.sfx('sfx_toaster'); B.summon('toast'); await B.wait(20); } },
    ],
  },
  // ----- Carpet Hills -----
  dustbunny: {
    name: 'DUST BUNNY', sprite: 'en_dustbunny', hp: 58, atk: 12, def: 8, spd: 11, luck: 6, exp: 18, marbles: 10, h: 150,
    drops: [['cookie', 0.3], ['warm_milk', 0.1]],
    desc: 'Lives under the couch. Has never seen a vacuum and never wants to.',
    actions: [
      { w: 4, run: hitOne('{u} hops onto {t}!', 1) },
      { w: 2, run: hitAll('{u} sneezes! ACHOO! Dust everywhere!', 0.55) },
      { w: 2, run: async (B, me) => { await B.log(`${me.name} fluffs itself up.`); B.buff(me, 'def', 1, 3); await B.wait(20); } },
    ],
  },
  sock: {
    name: 'LOST SOCK', sprite: 'en_sock', hp: 64, atk: 14, def: 7, spd: 9, luck: 5, exp: 20, marbles: 11, h: 180,
    drops: [['lemonade', 0.2]],
    desc: 'It lost its partner in the laundry. It is very, very sad about it.',
    actions: [
      { w: 4, run: async (B, me) => { const t = B.enemyTarget(me); await B.log(`${me.name} wraps around ${t.name}!`); await B.attack(me, t, { power: 1 }); if (t.alive) B.buff(t, 'spd', -1, 3); } },
      { w: 3, run: moodFoe('{u} tells {t} about its lost partner. So sad...', 'gloomy') },
      { w: 1, run: moodSelf('{u} misses its partner.', 'gloomy') },
    ],
  },
  lintmoth: {
    name: 'LINT MOTH', sprite: 'en_lintmoth', hp: 46, atk: 13, def: 6, spd: 16, luck: 9, exp: 17, marbles: 9, h: 150,
    drops: [['gummy', 0.3]],
    desc: 'Attracted to the glow of the TV. And to sweaters.',
    actions: [
      { w: 4, run: hitOne('{u} flutters into {t}\'s face!', 1) },
      { w: 3, run: hitAll('{u} shakes lint over everyone!', 0.5) },
      { w: 2, run: moodFoe('{u} flutters in circles around {t}. So annoying!', 'huffy') },
    ],
  },
  coin: {
    name: 'COUCH COIN', sprite: 'en_coin', hp: 50, atk: 11, def: 15, spd: 8, luck: 10, exp: 22, marbles: 26, h: 150,
    drops: [['st_bandaid', 0.05]],
    desc: 'Fell between the cushions years ago. Grumpy about the lint.',
    actions: [
      { w: 4, run: hitOne('{u} rolls over {t}!', 1) },
      { w: 3, run: async (B, me) => {
        await B.log(`${me.name} flips itself... ${U.chance(0.5) ? 'HEADS!' : 'TAILS!'}`);
        if (U.chance(0.5)) { await B.mood(me, 'cheery'); } else { const t = B.enemyTarget(me); await B.attack(me, t, { power: 1.3 }); }
      } },
    ],
  },
  staticghost: {
    name: 'STATIC WISP', sprite: 'en_staticghost', hp: 62, atk: 15, def: 8, spd: 12, luck: 7, exp: 26, marbles: 12, h: 180,
    drops: [['warm_milk', 0.3]],
    desc: 'A bit of TV static that got lonely and wandered off.',
    actions: [
      { w: 4, run: async (B, me) => { const t = B.enemyTarget(me); await B.log(`${me.name} goes FZZZT at ${t.name}!`); Sound.sfx('sfx_static'); await B.attack(me, t, { power: 1 }); if (t.alive) await B.mood(t, U.pick(['cheery', 'gloomy', 'huffy'])); } },
      { w: 2, run: async (B, me) => { await B.log(`${me.name} flips through channels...`); Sound.sfx('sfx_static'); await B.mood(me, U.pick(['cheery', 'gloomy', 'huffy'])); } },
    ],
  },
  remote: {
    name: 'REMOTE CRITTER', sprite: 'en_remote', hp: 58, atk: 14, def: 9, spd: 10, luck: 6, exp: 24, marbles: 12, h: 170,
    drops: [['cocoa', 0.1]],
    desc: 'Nobody can ever find it. That\'s on purpose.',
    actions: [
      { w: 4, run: hitOne('{u} jabs {t} with its antenna!', 1) },
      { w: 2, run: async (B, me) => { const t = B.enemyTarget(me); await B.log(`${me.name} presses MUTE on ${t.name}!`); B.setStatus(t, 'spooked', 2); await B.wait(20); } },
      { w: 2, run: async (B, me) => { await B.log(`${me.name} turns its VOLUME UP!`); B.buff(me, 'atk', 1, 3); await B.wait(20); } },
    ],
  },
  thestatic: {
    name: 'THE STATIC', sprite: 'en_thestatic', hp: 1150, atk: 18, def: 10, spd: 10, luck: 6, exp: 190, marbles: 150, h: 400, boss: true,
    drops: [['cocoa', 1]],
    desc: 'The TV nobody turns off anymore. It watches back.',
    moodMax: 3,
    async script(B, me) {
      me.turnN = (me.turnN || 0) + 1;
      if (me.turnN % 3 === 1) {
        const ch = ['cartoon', 'soap', 'news'][Math.floor(me.turnN / 3) % 3];
        me.channel = ch;
        Sound.sfx('sfx_tv_on');
        Game.flash('#ffffff', 0.5, 12);
        if (ch === 'cartoon') { await B.log('THE STATIC changes the channel... It\'s a CARTOON! Boing boing!'); B.setMood(me, 'cheery', 1); }
        if (ch === 'soap') { await B.log('THE STATIC changes the channel... It\'s a SOAP OPERA. Everyone is crying.'); B.setMood(me, 'gloomy', 1); }
        if (ch === 'news') { await B.log('THE STATIC changes the channel... It\'s the NEWS. Everything is terrible.'); B.setMood(me, 'huffy', 1); }
        return true;
      }
      return false;
    },
    actions: [
      { w: 4, run: hitOne('THE STATIC zaps {t} with a crackle of snow!', 1.1, { sfx: 'sfx_static' }) },
      { w: 3, cond: (B, me) => me.channel === 'cartoon', run: hitAll('THE STATIC plays a silly cartoon! Everyone gets bonked by an anvil!', 0.7, { sfx: 'sfx_bonk' }) },
      { w: 3, cond: (B, me) => me.channel === 'soap', run: async (B, me) => { await B.log('THE STATIC plays a sad love song. Everyone\'s PEP drains away...'); for (const t of B.alive(B.party)) { B.drainPep(t, 8); } await B.wait(30); await B.mood(B.enemyTarget(me), 'gloomy'); } },
      { w: 3, cond: (B, me) => me.channel === 'news', run: hitOne('THE STATIC reads the BAD NEWS at {t}!', 1.5, { sfx: 'sfx_hit_heavy', fx: 'big' }) },
      { w: 2, run: async (B, me) => { await B.log('THE STATIC plays a LAUGH TRACK. Ha ha ha ha ha.'); await B.heal(me, 60); } },
      { w: 1, cond: (B) => B.alive(B.enemies).length < 3, run: async (B) => { await B.log('A STATIC WISP flickers out of the screen!'); B.summon('staticghost'); await B.wait(20); } },
    ],
  },
  // ----- Cloud Keep -----
  rainwisp: {
    name: 'RAIN WISP', sprite: 'en_rainwisp', hp: 92, atk: 18, def: 12, spd: 14, luck: 8, exp: 40, marbles: 18, h: 180,
    drops: [['cocoa', 0.15], ['toast', 0.2]],
    desc: 'A little bit of sadness that drifted up here.',
    actions: [
      { w: 4, run: hitOne('{u} rains on {t}.', 1, { fx: 'splash', sfx: 'sfx_splash' }) },
      { w: 3, run: moodFoe('{u} weeps on {t}.', 'gloomy') },
      { w: 2, run: hitAll('{u} pours down on everyone!', 0.6, { fx: 'splash' }) },
    ],
  },
  thunderhead: {
    name: 'THUNDERHEAD', sprite: 'en_thunderhead', hp: 112, atk: 22, def: 10, spd: 11, luck: 6, exp: 48, marbles: 22, h: 200,
    drops: [['pancakes', 0.1]],
    desc: 'Rumbling. Grumbling. About to burst.',
    actions: [
      { w: 4, run: hitOne('{u} ZAPS {t}!', 1.15, { sfx: 'sfx_thunder', fx: 'big' }) },
      { w: 2, run: moodSelf('{u} rumbles louder and louder...', 'huffy') },
      { w: 2, run: moodFoe('{u} growls thunder at {t}!', 'huffy') },
    ],
  },
  umbrellabat: {
    name: 'BROLLY BAT', sprite: 'en_umbrellabat', hp: 82, atk: 20, def: 11, spd: 18, luck: 10, exp: 42, marbles: 20, h: 170,
    drops: [['lemonade', 0.3]],
    desc: 'An umbrella that got turned inside-out by the wind and never got over it.',
    actions: [
      { w: 4, run: hitOne('{u} swoops at {t}!', 1) },
      { w: 3, run: async (B, me) => { const t = B.enemyTarget(me); await B.log(`${me.name} flaps wildly around ${t.name}!`); B.buff(t, 'spd', -1, 3); await B.attack(me, t, { power: 0.6, quick: true }); } },
      { w: 1, run: moodSelf('{u} flaps inside-out... and outside-in... it\'s having fun!', 'cheery') },
    ],
  },
  tissue: {
    name: 'TISSUE GHOST', sprite: 'en_tissue', hp: 76, atk: 16, def: 9, spd: 12, luck: 7, exp: 38, marbles: 16, h: 180,
    drops: [['soup', 0.1]],
    desc: 'There is a whole box of them next to the bed.',
    actions: [
      { w: 4, run: hitOne('{u} flops onto {t}.', 1) },
      { w: 3, run: moodFoe('{u} sniffles at {t}. {t} feels like crying too.', 'gloomy') },
      { w: 1, run: async (B, me) => { await B.log(`${me.name} blows its nose. HONK.`); await B.heal(me, 20); } },
    ],
  },
  laundry: {
    name: 'LAUNDRY PILE', sprite: 'en_laundry', hp: 135, atk: 20, def: 15, spd: 6, luck: 4, exp: 55, marbles: 26, h: 220,
    drops: [['pancakes', 0.15], ['cocoa', 0.1]],
    desc: 'It has been growing for weeks. Nobody has the energy.',
    actions: [
      { w: 4, run: async (B, me) => { const t = B.enemyTarget(me); await B.log(`${me.name} smothers ${t.name} in old sweaters!`); await B.attack(me, t, { power: 1 }); if (t.alive && U.chance(0.35)) B.setStatus(t, 'sleepy', 2); } },
      { w: 2, run: async (B, me) => { await B.log(`${me.name} piles up higher.`); B.buff(me, 'def', 1, 3); await B.wait(20); } },
      { w: 2, run: moodSelf('{u} sighs a big, heavy sigh.', 'gloomy') },
    ],
  },
  rainqueen: {
    name: 'THE RAIN QUEEN', sprite: 'en_rainqueen', hp: 2400, atk: 24, def: 14, spd: 12, luck: 8, exp: 0, marbles: 0, h: 520, boss: true, noOverwhelm: true, noKO: true,
    desc: 'She has been crying for a very long time.',
    moodMax: 3,
    async script(B, me) { return B.story('queen_turn', me); },
    actions: [
      { w: 4, run: hitOne('THE RAIN QUEEN weeps. The rain falls hard on {t}.', 1.0, { fx: 'splash', sfx: 'sfx_splash' }) },
      { w: 3, run: hitAll('Thunder rolls. The rain falls on everyone.', 0.6, { fx: 'splash', sfx: 'sfx_thunder' }) },
      { w: 2, run: moodFoe('THE RAIN QUEEN looks at {t} with tired eyes.', 'gloomy') },
    ],
  },
};

// ---------------------------------------------------------------------------
// Troops: enemies + positions (x = 0..1 across the stage), background, music.
// ---------------------------------------------------------------------------
const TROOPS = {
  tut_drizzlet: { enemies: ['drizzlet'], bg: 'bg_fort', bgm: 'bgm_battle', tutorial: true },
  fort_drizzlets: { enemies: ['drizzlet', 'drizzlet'], bg: 'bg_fort', bgm: 'bgm_battle' },
  crumb_1: { enemies: ['toast'], bg: 'bg_crumb', bgm: 'bgm_battle' },
  crumb_2: { enemies: ['lemon', 'drizzlet'], bg: 'bg_crumb', bgm: 'bgm_battle' },
  crumb_3: { enemies: ['sugarmite', 'sugarmite'], bg: 'bg_crumb', bgm: 'bgm_battle' },
  crumb_4: { enemies: ['forkling', 'toast'], bg: 'bg_crumb', bgm: 'bgm_battle' },
  crumb_5: { enemies: ['lemon', 'sugarmite', 'forkling'], bg: 'bg_crumb', bgm: 'bgm_battle' },
  crumb_6: { enemies: ['toast', 'toast'], bg: 'bg_crumb', bgm: 'bgm_battle' },
  boss_grumbles: { enemies: ['grumbles'], bg: 'bg_toaster', bgm: 'bgm_boss', boss: true, noRun: true },
  carpet_1: { enemies: ['dustbunny', 'dustbunny'], bg: 'bg_carpet', bgm: 'bgm_battle' },
  carpet_2: { enemies: ['sock', 'lintmoth'], bg: 'bg_carpet', bgm: 'bgm_battle' },
  carpet_3: { enemies: ['coin', 'dustbunny'], bg: 'bg_carpet', bgm: 'bgm_battle' },
  carpet_4: { enemies: ['lintmoth', 'lintmoth', 'sock'], bg: 'bg_carpet', bgm: 'bgm_battle' },
  static_1: { enemies: ['staticghost', 'remote'], bg: 'bg_static', bgm: 'bgm_battle' },
  static_2: { enemies: ['staticghost', 'staticghost'], bg: 'bg_static', bgm: 'bgm_battle' },
  static_3: { enemies: ['remote', 'lintmoth', 'staticghost'], bg: 'bg_static', bgm: 'bgm_battle' },
  boss_static: { enemies: ['thestatic'], bg: 'bg_static', bgm: 'bgm_boss', boss: true, noRun: true },
  keep_1: { enemies: ['rainwisp', 'tissue'], bg: 'bg_keep', bgm: 'bgm_battle' },
  keep_2: { enemies: ['thunderhead', 'umbrellabat'], bg: 'bg_keep', bgm: 'bgm_battle' },
  keep_3: { enemies: ['laundry', 'tissue'], bg: 'bg_keep', bgm: 'bgm_battle' },
  keep_4: { enemies: ['umbrellabat', 'rainwisp', 'thunderhead'], bg: 'bg_keep', bgm: 'bgm_battle' },
  boss_queen: { enemies: ['rainqueen'], bg: 'bg_queen', bgm: 'bgm_final', boss: true, noRun: true, noLose: true },
};

window.DB = DB; window.MOODS = MOODS; window.ACTORS = ACTORS; window.SKILLS = SKILLS; window.TOGETHER = TOGETHER;
window.ITEMS = ITEMS; window.ENEMIES = ENEMIES; window.TROOPS = TROOPS; window.blendOf = blendOf;
