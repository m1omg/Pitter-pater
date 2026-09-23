'use strict';
// Game over - "it's okay, try again". Short gentle loop: music box lullaby over a warm pad, ending on an
// open C7sus4 that leans back into the F major start. 70 BPM, 8 bars (~27 s).
const S = require('../lib/song');
const I = require('../lib/inst');
const T = require('../lib/theory');
const K = require('../lib/comp');

module.exports = {
  id: 'bgm_gameover', type: 'bgm',
  build() {
    const song = new S.Song({ id: 'bgm_gameover', bpm: 70, loopBars: 8, tailSec: 7, seed: 1414, master: { lp: 12000 } });
    song.bus('hall', { type: 'reverb', t60: 3.2, predelay: 0.04, hp: 200, lp: 7000, er: 0.15 });
    const H = [[['Fadd9', 4]], [['Am7', 4]], [['Bbmaj7', 4]], [['C7sus4', 2], ['C7', 2]], [['Fadd9', 4]], [['Dm7', 4]], [['Gm7', 4]], [['C7sus4', 4]]];
    const h = K.harmTimeline(H, 4, 0);
    const mb = song.part('musicbox', I.modal('musicbox', { decay: 1.2 }), { gain: -2, pan: 0.12, sends: { hall: -6 }, choke: 'pitch', humanize: { t: 8, v: 0.06 } });
    mb.add(0, T.parse('C6/4. A5/8 F5/4 A5/4 | G5/4. E5/8 C5/2 | D5/4 F5/4 A5/4 C6/4 | Bb5/2 G5/4 E5/4 | F5/4. G5/8 A5/4 C6/4 | D6/2 C6/4 A5/4 | Bb5/4. A5/8 G5/4 F5/4 | G5/2. r/4 |', { vel: 0.66 }));
    // a few soft answering notes an octave down on the long notes
    mb.add(0, T.parse('r/1 | r/2 E5/8 G5/8 r/4 | r/1 | r/1 | r/1 | r/2 F5/8 A5/8 r/4 | r/1 | r/2 C5/8 E5/8 F5/8 r/8 |', { vel: 0.42 }));
    const pad = song.part('pad', I.pad({ attack: 1.5, release: 2.2, lp: 1000, sub: 0.3 }), { gain: -8, sends: { hall: -6 }, fx: [{ type: 'chorus', rate: 0.3, depth: 0.003, mix: 0.45 }] });
    K.padChords(pad, h, 'F3', 'C5', 4, 0.55);
    const low = song.part('low', I.piano({ felt: 0.85, bright: 0.3, release: 0.8 }), { gain: 0, pan: -0.1, sends: { hall: -8 } });
    for (const x of h) if (x.d >= 4 || x.b % 4 === 0) low.note(x.b, T.bassNote(x.sym, 'D2'), x.d, 0.4, { leg: 1 });
    return song;
  },
};
