'use strict';
// Home (real world, daytime, Mom asleep). Sparse felt piano quoting fragments of Pim's theme with long
// silences, soft low notes, a faint clock tick-tock. 66 BPM, F major (with Dm / Bbmaj7 colours).
const S = require('../lib/song');
const I = require('../lib/inst');
const D = require('../lib/drums');
const T = require('../lib/theory');
const K = require('../lib/comp');
const FX = require('../lib/fx');

module.exports = {
  id: 'bgm_home', type: 'bgm',
  build() {
    const song = new S.Song({ id: 'bgm_home', bpm: 66, loopBars: 20, tailSec: 7.5, seed: 202, master: { lp: 11000, sat: 1.05 } });
    const bar = (n) => song.bar(n);
    song.bus('room', { type: 'reverb', t60: 1.1, predelay: 0.012, hp: 150, lp: 6500, er: 0.45, erTime: 0.04 });
    song.bus('hall', { type: 'reverb', t60: 3.2, predelay: 0.035, hp: 200, lp: 6000, er: 0.15, seed: 9 });

    const H = [
      [['Fmaj7', 4]], [['Fmaj7', 4]], [['Dm7', 4]], [['Dm7', 4]], [['Bbmaj7', 4]], [['Bbmaj7', 4]], [['Gm7', 4]], [['C7sus4', 4]],
      [['Fmaj7', 4]], [['Am7', 4]], [['Dm7', 4]], [['Dm7/C', 4]], [['Bbmaj7', 4]], [['Bbmaj7', 4]], [['Gm7', 4]], [['C9sus4', 4]],
      [['Bbmaj7', 4]], [['Am7', 4]], [['Gm7', 4]], [['C7sus4', 4]],
    ];
    const harm = K.harmTimeline(H, 4, 0);

    const piano = song.part('piano', I.piano({ felt: 0.82, bright: 0.35, release: 0.45, noise: 1.3 }), { gain: 0, sends: { room: -10, hall: -12 }, humanize: { t: 14, v: 0.08 } });
    // right hand: motif fragments separated by silence
    piano.add(0, T.parse(
      'r/2 C5/8 C5/8 A4/8 A4/8 | Bb4/8 A4/8 G4/2. | r/2 A4/8 A4/8 F4/8 F4/8 | G4/8 F4/8 E4/2. | ' +
      'r/1 | F4/8 G4/8 A4/8 C5/8 D5/2 | C5/2. r/4 | r/1 | ' +
      'r/2 C5/8 C5/8 A4/8 A4/8 | C5/8 A4/8 G4/8 A4/8 E4/2 | r/2 D5/4 C5/4 | A4/2. r/4 | ' +
      'r/1 | Bb4/8 A4/8 G4/8 A4/8 Bb4/8 C5/8 D5/4 | C5/2. r/4 | G4/8 A4/8 F4/2. | ' +
      'r/1 | r/2 E5/4. C5/8 | D5/2 Bb4/2 | A4/2 G4/2 |', { vel: 0.5, legato: 1.0 }));
    // left hand: soft low bass on beat 1 (pedalled), a quiet mid chord later in the bar on alternate bars
    let prev = null;
    harm.forEach((h, i) => {
      const bn = T.bassNote(h.sym, 'C2');
      piano.note(h.b, bn, 4, 0.36, { leg: 1.0 });
      if (i % 2 === 1 || i >= 16) {
        const v = T.voiceLead(prev, h.sym, 'F3', 'D4', 3, { omitRoot: true });
        prev = v;
        v.forEach((m, k) => piano.note(h.b + 2 + k * 0.08, m, 2, 0.26, { leg: 1.0 }));
      }
    });

    // soft low warmth under the bass notes
    const low = song.part('low', I.pad({ attack: 1.6, release: 2.5, lp: 420, voices: 2, spread: 5, sub: 0.6, tri: 0.5 }), { gain: -18, sends: { hall: -14 } });
    harm.forEach((h) => low.note(h.b, T.bassNote(h.sym, 'C2'), 4, 0.45, { leg: 1.0 }));

    // clock: tick-tock on every beat, very soft
    const clock = song.part('clock', D.block({ decay: 0.028, click: 0.2, ratio: 2.4, second: 0.25 }), { gain: -15, pan: 0.35, sends: { room: -4 }, humanize: { t: 1.5, v: 0.05 } });
    for (let b = 0; b < bar(20); b++) clock.add(b, [{ b: 0, d: 0.2, m: b % 2 ? 83 : 88, v: b % 2 ? 0.55 : 0.7 }]);
    return song;
  },
};
