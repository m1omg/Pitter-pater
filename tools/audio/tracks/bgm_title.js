'use strict';
// Title theme - Pim's theme on music box over felt-piano broken chords; soft pad, vinyl crackle,
// raindrop plinks. 84 BPM, F major. Intro 2 bars, loop = A (theme) / B (new lyrical piano melody) /
// A' (theme with celesta, strings and low strings).
const S = require('../lib/song');
const I = require('../lib/inst');
const T = require('../lib/theory');
const K = require('../lib/comp');
const FX = require('../lib/fx');
const C = require('../lib/core');

module.exports = {
  id: 'bgm_title', type: 'bgm',
  build() {
    const song = new S.Song({
      id: 'bgm_title', bpm: 84, introBars: 2, loopBars: 24, tailSec: 7, seed: 101,
      master: { wow: { wowDepth: 0.0015, flutDepth: 0.0003 }, lp: 12500, sat: 1.1 },
    });
    const bar = (n) => song.bar(n);
    song.bus('hall', { type: 'reverb', t60: 2.6, predelay: 0.03, hp: 180, lp: 7500, er: 0.25 });
    song.bus('air', { type: 'reverb', t60: 4.2, predelay: 0.07, hp: 500, lp: 9000, er: 0.08, seed: 77 });

    const HI = [[['Bbmaj7', 4]], [['C7sus4', 2], ['C7', 2]]];
    const HA = [[['F', 4]], [['Dm7', 4]], [['Bbmaj7', 4]], [['C7', 2], ['F', 2]], [['F', 4]], [['Dm7', 4]], [['Gm7', 2], ['C9', 2]], [['C7', 2], ['F', 2]]];
    const HB = [[['Bbmaj7', 4]], [['Am7', 4]], [['Dm7', 4]], [['Dm7/C', 4]], [['Gm7', 4]], [['Am7', 4]], [['Bbmaj7', 4]], [['C7sus4', 2], ['C7', 2]]];
    const hI = K.harmTimeline(HI, 4, bar(-2));
    const hA = K.harmTimeline(HA, 4, bar(0));
    const hB = K.harmTimeline(HB, 4, bar(8));
    const hA2 = K.harmTimeline(HA, 4, bar(16));

    // ---- felt piano: pedalled broken chords
    const piano = song.part('piano', I.piano({ felt: 0.7, bright: 0.45, release: 0.35 }), { gain: 1, pan: -0.05, sends: { hall: -9 }, humanize: { t: 9, v: 0.07 } });
    const arpSeg = (h, lowOnly, velBase) => {
      const v = K.wideChord(h.sym, 'F2');
      const voic = lowOnly ? v.slice(0, 4) : v;
      const pat = h.d >= 4 ? [0, 1, 2, 3, 4, 3, 2, 1] : [0, 1, 2, 3];
      const vf = (k) => (k === 0 ? 1.15 : 0.82 + 0.1 * Math.sin(Math.PI * k / pat.length));
      K.arp(piano, h.b, voic, pat.map((x) => Math.min(x, voic.length - 1)), 0.5, velBase, { hold: h.d, velFn: vf });
    };
    for (const h of hI) arpSeg(h, false, 0.46);
    for (const h of hA) arpSeg(h, false, 0.44);
    for (const h of hB) arpSeg(h, true, 0.4);
    for (const h of hA2) arpSeg(h, false, 0.5);
    // B section: lyrical right-hand melody on the piano
    piano.add(bar(8), T.parse(
      'D5/4. C5/8 D5/4 F5/4 | E5/2. C5/4 | D5/4. C5/8 A4/4 F4/4 | G4/2 r/2 | ' +
      'Bb4/4. A4/8 Bb4/4 D5/4 | C5/4. D5/8 E5/2 | F5/4. E5/8 D5/4 C5/4 | D5/2 r/2 |', { vel: 0.62, legato: 1.0 }));

    // ---- music box: the theme (an octave up), answers in B
    const mbox = song.part('musicbox', I.modal('musicbox'), { gain: -5, pan: 0.18, sends: { hall: -7, air: -14 }, choke: 'pitch', humanize: { t: 5, v: 0.05 } });
    mbox.add(bar(0), K.pimTheme({ transpose: 12, vel: 0.74 }));
    mbox.add(bar(11) + 2, T.parse('C6/8 C6/8 A5/8 A5/8', { vel: 0.6 }));
    mbox.add(bar(15) + 2, T.parse('G5/8 G5/8 E5/8 E5/8', { vel: 0.6 }));
    mbox.add(bar(16), K.pimTheme({ transpose: 12, vel: 0.78 }));

    // ---- celesta doubling in A'
    const cel = song.part('celesta', I.modal('celesta'), { gain: -10, pan: -0.2, sends: { hall: -6 }, choke: 'pitch', humanize: { t: 7, v: 0.05 } });
    cel.add(bar(16), K.pimTheme({ transpose: 12, vel: 0.6 }));

    // ---- warm pad (B) and strings (A')
    const pad = song.part('pad', I.pad({ attack: 1.2, release: 2, lp: 1100 }), { gain: -11, sends: { hall: -6 }, fx: [{ type: 'chorus', rate: 0.4, depth: 0.003, mix: 0.4 }] });
    K.padChords(pad, hB, 'C4', 'F5', 3, 0.5);
    pad.automate([[bar(8), -8], [bar(9), 0], [bar(15), 0], [bar(16), -6]]);
    const str = song.part('strings', I.strings({ attack: 0.9, release: 1.1, vib: 8 }), { gain: -10, pan: 0.1, sends: { hall: -4 } });
    K.padChords(str, hA2, 'G3', 'D5', 3, 0.45);
    str.automate([[bar(16), -10], [bar(18), 0], [bar(23), 0], [bar(24), -4]]);
    const low = song.part('lowstr', I.strings({ attack: 0.6, release: 0.9, voices: 4, spread: 6, body: 'cello', vib: 6 }), { gain: -12, pan: -0.15, sends: { hall: -6 } });
    for (const h of hA2) low.note(h.b, T.bassNote(h.sym, 'C2') + 12, h.d, 0.5, { leg: 1.0 });

    // ---- raindrop plinks (F major pentatonic, high)
    const drops = song.part('drops', I.drop({ decay: 0.08 }), { gain: -9, sends: { air: -3, hall: -10 }, humanize: { t: 0, v: 0 } });
    const rng = new C.RNG(4242);
    K.plinks(drops, bar(-2), bar(24), rng, ['C6', 'D6', 'F6', 'G6', 'A6', 'C7', 'D7'], 0.32, [0.25, 0.6]);

    // ---- vinyl crackle bed
    song.bed('vinyl', (n, r) => FX.vinylCrackle(n, r, { pops: 1.2, crackles: 45, hiss: 0.0035 }), { gain: -16 });
    return song;
  },
};
