'use strict';
// "Pillow Fort" - cozy dream hub. Lo-fi hip-hop: Rhodes maj7/9 comping, swung boom-bap, round sine bass,
// glockenspiel quoting Pim's theme, vinyl crackle and soft rain outside. 78 BPM, F major.
// A: theme on glock | B: new Rhodes melody, glock answers | C: breakdown -> Rhodes plays the theme.
const S = require('../lib/song');
const I = require('../lib/inst');
const D = require('../lib/drums');
const T = require('../lib/theory');
const K = require('../lib/comp');
const FX = require('../lib/fx');
const C = require('../lib/core');

function comp(part, harm, vel, lo = 'E3', hi = 'D5') {
  let prev = null;
  for (const h of harm) {
    const v = T.voiceLead(prev, h.sym, lo, hi, 4, { omitRoot: true, omit5: true });
    prev = v;
    const pat = h.d >= 4 ? [[0, 1.45, 1.0], [2.75, 1.0, 0.78]] : [[0, 1.45, 1.0]];
    for (const [o, d, vm] of pat) v.forEach((m, k) => part.note(h.b + o, m, d, vel * vm * (1 - 0.05 * k), { leg: 1.0, dt: 0.006 * k }));
  }
}
function lofiBass(part, harm, vel) {
  harm.forEach((h, i) => {
    const r = T.bassNote(h.sym, 'A1');
    const next = harm[(i + 1) % harm.length];
    const nr = T.bassNote(next.sym, 'A1');
    if (h.d >= 4) {
      part.note(h.b, r, 1.25, vel, { leg: 0.95 });
      part.note(h.b + 1.5, r, 0.5, vel * 0.7, { leg: 0.8 });
      part.note(h.b + 2.5, r + 7 > 52 ? r - 5 : r + 7, 0.75, vel * 0.8, { leg: 0.9 });
      part.note(h.b + 3.5, nr - 1 === r ? nr + 2 : nr - 1, 0.5, vel * 0.65, { leg: 0.85 });
    } else {
      part.note(h.b, r, 1.25, vel, { leg: 0.95 });
      part.note(h.b + 1.5, nr === r ? r + 7 : nr - 1, 0.5, vel * 0.65, { leg: 0.85 });
    }
  });
}

module.exports = {
  id: 'bgm_fort', type: 'bgm',
  build() {
    const song = new S.Song({ id: 'bgm_fort', bpm: 78, loopBars: 24, tailSec: 5.5, seed: 303,
      master: { wow: { wowDepth: 0.0022, flutDepth: 0.0004 }, lp: 10500, sat: 1.25 } });
    const bar = (n) => song.bar(n);
    song.bus('room', { type: 'reverb', t60: 1.4, predelay: 0.015, hp: 200, lp: 6000, er: 0.35 });
    song.bus('hall', { type: 'reverb', t60: 2.8, predelay: 0.03, hp: 250, lp: 7000, er: 0.1, seed: 5 });
    song.bus('echo', { type: 'delay', time: 60 / 78 * 0.75, fb: 0.38, lp: 3800, hp: 400, pingpong: true, ret: -4, sends: { hall: -6 } });

    const HA = [[['Fmaj9', 4]], [['Dm9', 4]], [['Bbmaj9', 4]], [['C9sus4', 2], ['F6', 2]], [['Fmaj9', 4]], [['Dm9', 4]], [['Gm9', 2], ['C9', 2]], [['C7b9', 2], ['F69', 2]]];
    const HB = [[['Bbmaj9', 4]], [['Am7', 4]], [['Gm7', 4]], [['Fmaj7', 4]], [['Bbmaj9', 4]], [['Am7', 4]], [['Gm7', 4]], [['C7sus4', 2], ['C7', 2]]];
    const hA = K.harmTimeline(HA, 4, 0), hB = K.harmTimeline(HB, 4, bar(8)), hC = K.harmTimeline(HA, 4, bar(16));
    const all = [...hA, ...hB, ...hC];

    // ---- Rhodes comping (+ melody in B, theme in C)
    const rh = song.part('rhodes', I.rhodes({ bark: 0.45, bell: 0.5, release: 0.2 }), {
      gain: -1, pan: -0.1, sends: { room: -9, hall: -14 }, swing: 0.45, swingUnit: 0.25, humanize: { t: 9, v: 0.07 },
      fx: [{ type: 'autopan', rate: 4.6, depth: 0.28 }, { type: 'chorus', rate: 0.35, depth: 0.002, mix: 0.25 }, { type: 'sat', drive: 1.3 }],
    });
    comp(rh, hA, 0.5); comp(rh, hB, 0.44, 'E3', 'C5'); comp(rh, hC, 0.42, 'D3', 'C5');
    const rhLead = song.part('rhodesLead', I.rhodes({ bark: 0.55, bell: 0.7, release: 0.25 }), {
      gain: -2, pan: 0.12, sends: { room: -8, echo: -14, hall: -12 }, swing: 0.45, swingUnit: 0.25, humanize: { t: 10, v: 0.08 },
      fx: [{ type: 'autopan', rate: 4.6, depth: 0.2 }, { type: 'sat', drive: 1.3 }],
    });
    rhLead.add(bar(8), T.parse(
      'r/4 F5/8 G5/8 A5/4 G5/8 F5/8 | E5/2 r/8 C5/8 D5/8 E5/8 | F5/4. D5/8 Bb4/4 r/4 | A4/2. r/4 | ' +
      'r/4 D5/8 F5/8 A5/4 C6/8 A5/8 | G5/4. E5/8 C5/4 r/4 | D5/8 F5/8 Bb4/8 D5/8 F5/4 E5/8 D5/8 | C5/2 r/2 |', { vel: 0.62 }));
    rhLead.add(bar(16), K.pimTheme({ vel: 0.6, transpose: 12 }));

    // ---- glockenspiel: theme in A, answers in B, sparkle arpeggios in C
    const glock = song.part('glock', I.modal('glock', { decay: 0.8 }), { gain: -7, pan: 0.25, sends: { hall: -6, echo: -8 }, choke: 'pitch', swing: 0.45, swingUnit: 0.25, humanize: { t: 6, v: 0.06 } });
    glock.add(0, K.pimTheme({ transpose: 12, vel: 0.62 }));
    glock.add(bar(9) + 2.5, T.parse('E6/8 C6/8 D6/8', { vel: 0.5 }));
    glock.add(bar(11) + 2, T.parse('C6/8 C6/8 A5/8 A5/8', { vel: 0.55 }));
    glock.add(bar(13) + 3, T.parse('E6/8 C6/8', { vel: 0.5 }));
    glock.add(bar(15) + 2, T.parse('Bb5/8 Bb5/8 G5/8 G5/8', { vel: 0.55 }));
    const rng = new C.RNG(3030);
    for (const h of hC) {
      const tones = T.chord(h.sym).pcs;
      for (let k = 0; k < h.d; k += 1) if (rng.chance(0.55)) glock.note(h.b + k + 0.5, T.pcAtOrAbove(rng.pick(tones), T.nm('A5')), 0.5, rng.uni(0.3, 0.45));
    }

    // ---- round sine bass
    const bass = song.part('bass', I.sineBass({ h2: 0.25, drive: 1.6, release: 0.08 }), { gain: -6, swing: 0.45, swingUnit: 0.25, humanize: { t: 5, v: 0.05 } });
    lofiBass(bass, all, 0.85);

    // ---- drums (boom-bap, swung 16ths)
    const dr = { swing: 0.5, swingUnit: 0.25 };
    const kick = song.part('kick', D.kick({ f0: 50, f1: 120, decay: 0.38, click: 0.2, drive: 1.8, lp: 5000 }), Object.assign({ gain: -1, sends: { room: -20 }, humanize: { t: 4, v: 0.05 } }, dr));
    const snare = song.part('snare', D.snare({ f: 190, decay: 0.2, hp: 900, lp: 6500, body: 0.7, ring: 0.05 }), Object.assign({ gain: 1, pan: 0.05, sends: { room: -8 }, humanize: { t: 6, v: 0.06 } }, dr));
    const hat = song.part('hat', D.hat({ decay: 0.04, lp: 9000 }), Object.assign({ gain: 3, pan: 0.2, sends: { room: -16 }, humanize: { t: 5, v: 0.1 } }, dr));
    const ohat = song.part('ohat', D.hat({ open: true, decay: 0.3, lp: 8000 }), Object.assign({ gain: -1, pan: 0.2, sends: { room: -12 } }, dr));
    const shk = song.part('shaker', D.shaker({ decay: 0.06 }), Object.assign({ gain: -2, pan: -0.3, sends: { room: -12 }, humanize: { t: 6, v: 0.12 } }, dr));
    const K1 = 'X......x..X.....', K2 = 'X......x..X..x..', KF = 'X.....x...X...x.';
    const SN = '....X.......X...', SNg = '....X..o....X.o.';
    const HT = 'x.o.x.o.x.o.x.oo', HT2 = 'x.o.x.o.x.o.x.o.';
    for (let b = 0; b < 24; b++) {
      const breakdown = b >= 16 && b < 20;
      const last = b % 8 === 7;
      if (!breakdown) kick.add(bar(b), T.grid(last ? KF : b % 2 ? K2 : K1, 0.25));
      else if (b === 16 || b === 18) kick.add(bar(b), T.grid('X...............', 0.25, { vmap: { X: 0.6 } }));
      if (!breakdown) snare.add(bar(b), T.grid(b % 4 === 3 ? SNg : SN, 0.25));
      else if (b === 19) snare.add(bar(b), T.grid('............x.o.', 0.25));
      hat.add(bar(b), T.grid(b % 2 ? HT : HT2, 0.25, { vmap: { x: 0.7, o: 0.35 } }));
      if (last) ohat.add(bar(b) + 3.5, [{ b: 0, d: 0.5, v: 0.6 }]);
      if (b >= 8) shk.add(bar(b), T.grid('..x...x...x...x.', 0.25, { vmap: { x: 0.5 } }));
    }

    // ---- beds: vinyl + soft rain on the window
    song.bed('vinyl', (n, r) => FX.vinylCrackle(n, r, { pops: 1.6, crackles: 70, hiss: 0.004 }), { gain: -14 });
    song.bed('rain', (n, r) => {
      const L = FX.circular(C.noisePink(n, r), () => { const a = new C.Biquad('lp', 2600, 0.6), b2 = new C.Biquad('hp', 350, 0.6); return (x) => a.process(b2.process(x)); });
      const R = FX.circular(C.noisePink(n, r), () => { const a = new C.Biquad('lp', 2600, 0.6), b2 = new C.Biquad('hp', 350, 0.6); return (x) => a.process(b2.process(x)); });
      const lfo = FX.periodicLFO(n, r, 1, 4, 3);
      for (let i = 0; i < n; i++) { const g = 0.8 + 0.2 * lfo[i]; L[i] *= g; R[i] *= g; }
      return { L, R };
    }, { gain: -30 });
    return song;
  },
};
