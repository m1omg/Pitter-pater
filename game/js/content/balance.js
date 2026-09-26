'use strict';
// ---------------------------------------------------------------------------
// Balance pass (tuned with headless auto-battles: plain attacks should win
// normal fights with some damage taken; bosses need moods, skills and snacks).
// ---------------------------------------------------------------------------
const TUNE = {
  drizzlet: { hp: 36, atk: 9 },
  toast: { hp: 56, atk: 12, exp: 11 },
  lemon: { hp: 48, atk: 11, exp: 10 },
  sugarmite: { hp: 38, atk: 10, exp: 10 },
  forkling: { hp: 50, atk: 13, exp: 12 },
  grumbles: { hp: 720, atk: 17, def: 8, exp: 80 },
  dustbunny: { hp: 80, atk: 17, exp: 20 },
  sock: { hp: 88, atk: 19, exp: 22 },
  lintmoth: { hp: 64, atk: 18, exp: 19 },
  coin: { hp: 70, atk: 16, exp: 24 },
  staticghost: { hp: 86, atk: 21, exp: 28 },
  remote: { hp: 80, atk: 19, exp: 26 },
  thestatic: { hp: 1650, atk: 27, def: 12, exp: 220 },
  rainwisp: { hp: 130, atk: 26, exp: 44 },
  thunderhead: { hp: 155, atk: 30, exp: 52 },
  umbrellabat: { hp: 115, atk: 27, exp: 46 },
  tissue: { hp: 106, atk: 23, exp: 42 },
  laundry: { hp: 185, atk: 27, exp: 60 },
  rainqueen: { atk: 26 },
};
for (const id in TUNE) Object.assign(ENEMIES[id], TUNE[id]);
// the painted battle backgrounds are busy: show regular enemies a little bigger
for (const id in ENEMIES) if (!ENEMIES[id].boss) ENEMIES[id].h = Math.round(ENEMIES[id].h * 1.15);

// Difficulty (OPTIONS > Difficulty, kept with the settings, not the saves). Enemy HEART (hp) and hit
// strength (dmg); regular fights (not bosses, nor the helpers a boss calls in) get regularHp / regularDmg
// on top, and one more enemy (EXTRA_ENEMY). Gentle is the first release's numbers.
const DIFFICULTIES = {
  gentle: { name: 'Gentle', hp: 1, dmg: 1, regularHp: 1, regularDmg: 1, extraEnemy: false },
  normal: { name: 'Normal', hp: 1.16, dmg: 1.17, regularHp: 1.3, regularDmg: 1.15, extraEnemy: true },
  hard: { name: 'Hard', hp: 1.3, dmg: 1.3, regularHp: 1.35, regularDmg: 1.2, extraEnemy: true },
  veryhard: { name: 'Very hard', hp: 1.5, dmg: 1.45, regularHp: 1.4, regularDmg: 1.25, extraEnemy: true },
};
const DIFFICULTY_ORDER = ['gentle', 'normal', 'hard', 'veryhard'];
function difficulty() { return DIFFICULTIES[State.options.difficulty] || DIFFICULTIES.normal; }

// The one more enemy of each regular fight, from the same part of Puddleton. The very first ones
// (the tutorial Drizzlet and the first Grumpy Toast) always come alone, to ease you in.
const EXTRA_ENEMY = {
  crumb_2: 'sugarmite', crumb_3: 'lemon', crumb_4: 'lemon', crumb_5: 'drizzlet', crumb_6: 'toast',
  carpet_1: 'lintmoth', carpet_2: 'dustbunny', carpet_3: 'sock', carpet_4: 'dustbunny',
  static_1: 'staticghost', static_2: 'remote', static_3: 'staticghost',
  keep_1: 'umbrellabat', keep_2: 'rainwisp', keep_3: 'rainwisp', keep_4: 'tissue',
};
