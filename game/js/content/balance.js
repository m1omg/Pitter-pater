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

// Harder than the first release: enemies have 12% more HEART and hit 13% harder (about 27% more damage
// taken per fight: +15%, then +10% on top). Skills and items got stronger (database.js), so they pay off.
const DIFFICULTY = { hp: 1.12, dmg: 1.13 };
for (const id in ENEMIES) if (ENEMIES[id].hp) ENEMIES[id].hp = Math.round(ENEMIES[id].hp * DIFFICULTY.hp);
