'use strict';
// Emotional scene theme. Solo felt piano, Pim's theme in D minor, ~60 BPM with a rubato tempo map
// (gentle push in the middle of each phrase, ritardando into each phrase end) and phrase-shaped dynamics.
// A: theme high, sparse broken chords, cello pad on roots. B: theme an octave lower (with small
// ornaments) while the cello sings the Rain Queen's sighs as a countermelody.
const S = require('../lib/song');
const I = require('../lib/inst');
const T = require('../lib/theory');
const K = require('../lib/comp');

module.exports = {
  id: 'bgm_sad', type: 'bgm',
  build() {
    const tempo = (b) => {
      const x = ((b % 16) + 16) % 16; // position within a 4-bar phrase
      let t = 60 * (1 + 0.045 * Math.sin(Math.PI * x / 16));
      if (x > 13.5) { const r = Math.min(1, (x - 13.5) / 2.5); t *= 1 - 0.2 * r * r * (3 - 2 * r); }
      return t;
    };
    const song = new S.Song({ id: 'bgm_sad', bpm: 60, loopBars: 16, tailSec: 8, seed: 1313, tempo, master: { lp: 12000 } });
    const bar = (n) => song.bar(n);
    song.bus('hall', { type: 'reverb', t60: 2.9, predelay: 0.03, hp: 160, lp: 6500, er: 0.2 });

    const H = [[['Dm', 4]], [['Bb', 4]], [['Gm', 4]], [['A7', 2], ['Dm', 2]], [['Dm', 4]], [['Bb', 4]], [['Em7b5', 2], ['A7b9', 2]], [['A7', 2], ['Dm', 2]]];
    const H2 = [[['Dm', 4]], [['Bbmaj7', 4]], [['Gm6', 4]], [['A7b9', 2], ['Dm', 2]], [['Dm/C', 4]], [['Bb6', 4]], [['Em7b5', 2], ['A7b9', 2]], [['A7', 2], ['Dm', 2]]];
    const hA = K.harmTimeline(H, 4, 0), hB = K.harmTimeline(H2, 4, bar(8));
    const shape = (b) => 0.86 + 0.22 * Math.sin(Math.PI * (((b % 16) + 16) % 16) / 16);

    const mel = song.part('melody', I.piano({ felt: 0.62, bright: 0.45, release: 0.5, noise: 1.2 }), { gain: 1, pan: 0.02, sends: { hall: -7 }, humanize: { t: 16, v: 0.06 } });
    const themeHi = K.pimTheme({ mode: ['D', 'minor'], transpose: 0, oct: 1, vel: 0.6, legato: 1.0 });
    mel.add(0, themeHi.map((e) => Object.assign(e, { v: e.v * shape(e.b), dt: 0.012 })));
    // B: an octave lower, with a couple of grace-note ornaments
    const themeLo = T.parse(
      'A4/8 A4/8 F4/8 F4/8 G4/8 F4/8 E4/4 | F4/8 F4/8 D4/8 D4/8 E4/8 D4/8 C4/4 | D4/8 E4/8 F4/8 A4/8 Bb4/4 A4/8 F4/8 | G4/4 F4/8 E4/8 D4/2 | ' +
      'A4/8 A4/8 F4/8 F4/8 G#4/g A4/8 F4/8 E4/4 | F4/8 F4/8 D4/8 D4/8 Bb4/4 A4/4 | G4/8 F4/8 E4/8 F4/8 G4/8 A4/8 C#5/g Bb4/4 | A4/4 E4/8 F4/8 D4/2 |', { vel: 0.52, legato: 1.0 });
    mel.add(bar(8), themeLo.map((e) => Object.assign(e, { v: e.v * shape(e.b), dt: 0.012 })));

    // left hand: pedalled broken chords, low and soft
    const lh = song.part('lh', I.piano({ felt: 0.72, bright: 0.35, release: 0.55 }), { gain: -3, pan: -0.08, sends: { hall: -8 }, humanize: { t: 12, v: 0.07 } });
    for (const h of [...hA, ...hB]) {
      const w = K.wideChord(h.sym, 'D2').slice(0, h.b >= bar(8) ? 3 : 4);
      const pat = h.d >= 4 ? [0, 1, 2, 3, 2, 1, 2, 1] : [0, 1, 2, 1];
      K.arp(lh, h.b, w, pat, 0.5, 0.36 * shape(h.b), { hold: h.d, velFn: (k) => (k === 0 ? 1.2 : 0.8) });
    }

    // cello-like pad: roots in A, Rain Queen countermelody in B
    const vc = song.part('cello', I.strings({ attack: 0.5, release: 0.9, vib: 12, vibDelay: 0.35, voices: 3, spread: 5, body: 'cello', lp: 1800, bow: 0.03 }), { gain: -9, pan: -0.25, sends: { hall: -5 } });
    for (const h of hA) vc.note(h.b, T.bassNote(h.sym, 'D2') + (h.d >= 4 ? 0 : 0), h.d, 0.4, { leg: 1 });
    vc.add(bar(8), T.parse('F3/2. E3/4 | D3/2. C3/4 | Bb2/2 A2/4 G2/4 | Bb2/4 C#3/4 D3/2 | A3/2. G3/4 | F3/2. D3/4 | D3/2 C#3/2 | E3/2 D3/2 |', { vel: 0.62, legato: 1.0 }));
    vc.automate([[0, -6], [bar(7), -6], [bar(8), 0], [bar(15), 0], [bar(16), -6]]);
    return song;
  },
};
