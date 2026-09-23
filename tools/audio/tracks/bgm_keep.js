'use strict';
// "Cloud Keep" - Mom's room as a castle in the clouds. Melancholic waltz (3/4, 90 BPM).
// A (16 bars, D minor): the Rain Queen motif on solo piano over a soft waltz, choir "ooh" and pad.
// B (16 bars, F major): Pim's theme (waltz adaptation) sung by strings, harp arpeggios, fuller choir.
// Bittersweet, grand but soft. Intro: 2 bars of harp + choir.
const S = require('../lib/song');
const I = require('../lib/inst');
const D = require('../lib/drums');
const T = require('../lib/theory');
const K = require('../lib/comp');

module.exports = {
  id: 'bgm_keep', type: 'bgm',
  build() {
    const song = new S.Song({ id: 'bgm_keep', bpm: 90, meter: 3, introBars: 2, loopBars: 32, tailSec: 9.5, seed: 808 });
    const bar = (n) => song.bar(n);
    song.bus('hall', { type: 'reverb', t60: 3.0, predelay: 0.035, hp: 180, lp: 7000, er: 0.2 });
    song.bus('cloud', { type: 'reverb', t60: 4.8, predelay: 0.06, hp: 300, lp: 8000, er: 0.05, seed: 81 });

    const HI = [[['Dm', 3]], [['Dm', 3]]];
    const HA = [
      [['Dm', 3]], [['Bb', 3]], [['Gm', 3]], [['A7', 3]], [['Dm', 3]], [['Gm', 3]], [['Dm/A', 3]], [['A', 3]],
      [['Dm', 3]], [['Bb', 3]], [['Gm', 3]], [['A7', 3]], [['Dm', 3]], [['Bbmaj7', 3]], [['Gm7', 3]], [['C7', 3]],
    ];
    const HB = [
      [['F', 3]], [['F', 3]], [['Dm', 3]], [['Am7', 3]], [['Bb', 3]], [['Bbadd9', 3]], [['C7', 3]], [['F', 3]],
      [['F', 3]], [['F/A', 3]], [['Dm', 3]], [['Dm7', 3]], [['Gm7', 3]], [['C9', 3]], [['C7', 3]], [['F', 3]],
    ];
    const hI = K.harmTimeline(HI, 3, bar(-2)), hA = K.harmTimeline(HA, 3, 0), hB = K.harmTimeline(HB, 3, bar(16));

    // ---- solo piano melody (A): Rain Queen motif, extended to two 8-bar phrases
    const piano = song.part('pianoMel', I.piano({ felt: 0.45, bright: 0.5, release: 0.4 }), { gain: 4, pan: -0.1, sends: { hall: -8 }, humanize: { t: 12, v: 0.07 } });
    const lh = song.part('pianoLH', I.piano({ felt: 0.6, bright: 0.4, release: 0.4 }), { gain: -3, pan: -0.15, sends: { hall: -9 }, humanize: { t: 10, v: 0.06 } });
    piano.add(0, T.parse(
      'F5/2 E5/4 | D5/2 C5/4 | Bb4/4 A4/4 G4/4 | Bb4/4 C#5/2 | D5/2 A4/4 | Bb4/4 D5/4 G5/4 | F5/2 E5/4 | E5/2. | ' +
      'F5/2 E5/4 | D5/2 C5/4 | Bb4/4 A4/4 G4/4 | Bb4/4 C#5/2 | D5/2. | D5/4 F5/4 A5/4 | G5/2 F5/4 | E5/2. |', { bar: 3, vel: 0.6, legato: 1.0 }));
    // waltz left hand (both sections): bass on 1, soft chord on 2 and 3
    const all = [...hI, ...hA, ...hB];
    let prev = null;
    all.forEach((h, i) => {
      const inB = h.b >= bar(16);
      lh.note(h.b, T.bassNote(h.sym, 'D2'), 1.0, inB ? 0.5 : 0.46, { leg: 1.6 });
      const v = T.voiceLead(prev, h.sym, 'F3', 'D4', 3); prev = v;
      for (const k of [1, 2]) v.forEach((m) => lh.note(h.b + k, m, 0.9, inB ? 0.3 : 0.27, { leg: 0.9 }));
    });

    // ---- strings: soft pad in A, singing melody (Pim's theme, waltz) in B
    const pad = song.part('strpad', I.strings({ attack: 0.8, release: 1.0, vib: 7, lp: 3000 }), { gain: -12, pan: 0.15, sends: { hall: -5 } });
    K.padChords(pad, [...hI, ...hA], 'F3', 'E4', 3, 0.42);
    K.padChords(pad, hB, 'F3', 'C5', 4, 0.5);
    pad.automate([[bar(-2), -8], [bar(0), -2], [bar(15), 0], [bar(16), 2], [bar(31), 2], [bar(32), -2]]);
    const vln = song.part('violins', I.strings({ attack: 0.18, release: 0.5, vib: 13, vibDelay: 0.25, voices: 6, spread: 8, lp: 4200 }), { gain: -2, pan: 0.05, sends: { hall: -6, cloud: -12 }, humanize: { t: 8, v: 0.05 } });
    vln.add(bar(16), K.pimWaltz({ transpose: 12, vel: 0.68, legato: 1.0 }));
    const cel = song.part('cellos', I.strings({ attack: 0.3, release: 0.6, vib: 10, voices: 4, spread: 6, body: 'cello', lp: 2200 }), { gain: -6, pan: -0.3, sends: { hall: -6 } });
    for (const h of hB) cel.note(h.b, T.bassNote(h.sym, 'C2') + 12, h.d, 0.55, { leg: 1.0 });

    // ---- choir "ooh"
    const choir = song.part('choir', I.choir({ vowel: 'oo', attack: 0.8, release: 1.4 }), { gain: -9, pan: -0.05, sends: { cloud: -6 } });
    K.padChords(choir, [...hI, ...hA], 'A3', 'F4', 3, 0.45);
    K.padChords(choir, hB, 'A3', 'C5', 4, 0.55);
    choir.automate([[bar(-2), -6], [bar(0), -4], [bar(12), -2], [bar(16), 1], [bar(31), 1], [bar(32), -4]]);

    // ---- harp arpeggios: intro, sparse in A, flowing in B
    const harp = song.part('harp', I.pluck('harp'), { gain: -6, pan: 0.35, sends: { hall: -5, cloud: -10 }, humanize: { t: 6, v: 0.08 } });
    const harpBar = (h, dense, v) => {
      const w = K.wideChord(h.sym, 'D3');
      const pat = dense ? [0, 1, 2, 3, 4, 5] : [0, null, 2, null, 4, null];
      K.arp(harp, h.b, w, pat, 0.5, v, { velFn: (k) => 0.85 + 0.15 * Math.sin(Math.PI * k / 6) });
    };
    hI.forEach((h) => harpBar(h, true, 0.55));
    hA.forEach((h, i) => { if (i % 2 === 1 || i >= 12) harpBar(h, false, 0.45); });
    hB.forEach((h) => harpBar(h, true, 0.5));

    // ---- soft timpani + cymbal swell into B, triangle-like glints
    const timp = song.part('timp', D.timpani({ decay: 2.4 }), { gain: -9, sends: { hall: -6 } });
    timp.note(bar(16), 'F2', 1, 0.5); timp.note(bar(24), 'F2', 1, 0.4); timp.note(bar(0), 'D2', 1, 0.45);
    const sw = song.part('swell', D.swell({ fc0: 800, fc1: 7000 }), { gain: -17, sends: { cloud: -4 } });
    sw.note(bar(14), 60, 6, 0.6, { leg: 1, noHuman: true });
    return song;
  },
};
