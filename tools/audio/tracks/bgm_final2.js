'use strict';
// "After the Rain" - final battle phase 2, when Pim finally cries. Slow emotional build, 72 BPM.
// Intro (2 bars): solo piano, the last raindrops. Loop (26 bars):
// A (D major): Pim's theme on solo piano, soft strings enter halfway; the last chord pivots (A7 -> C9)
// B (F major): violins + cellos sing the theme, choir "ooh", harp
// C (F major): full glory - choir "aah", horns, glockenspiel, timpani and cymbal swells
// Coda (2 bars): Bbmaj7 -> A7sus4 -> A7, back to D major.
const S = require('../lib/song');
const I = require('../lib/inst');
const D = require('../lib/drums');
const T = require('../lib/theory');
const K = require('../lib/comp');
const C = require('../lib/core');

module.exports = {
  id: 'bgm_final2', type: 'bgm',
  build() {
    const song = new S.Song({ id: 'bgm_final2', bpm: 72, introBars: 2, loopBars: 26, tailSec: 7, seed: 1212 });
    const bar = (n) => song.bar(n);
    song.bus('hall', { type: 'reverb', t60: 3.2, predelay: 0.035, hp: 170, lp: 7500, er: 0.18 });
    song.bus('air', { type: 'reverb', t60: 5, predelay: 0.07, hp: 400, lp: 9000, er: 0.05, seed: 121 });

    const HI = [[['Gmaj7', 4]], [['Asus4', 2], ['A7', 2]]];
    const HA = [[['D', 4]], [['Bm7', 4]], [['Gmaj7', 4]], [['A7', 2], ['D', 2]], [['D', 4]], [['Bm7', 4]], [['Em7', 2], ['A9', 2]], [['A7', 2], ['C9', 2]]];
    const HB = [[['F', 4]], [['Dm7', 3], ['Am7', 1]], [['Bbadd9', 4]], [['C7', 2], ['F', 2]], [['F', 4]], [['Dm7', 4]], [['Gm7', 2], ['C9', 2]], [['C7', 2], ['F', 2]]];
    const HC = [[['F', 4]], [['Dm7', 3], ['Am7', 1]], [['Bbadd9', 4]], [['C7', 2], ['F/A', 2]], [['Bb', 4]], [['Am7', 2], ['Dm7', 2]], [['Gm7', 2], ['C9', 2]], [['C7sus4', 2], ['F', 2]]];
    const HD = [[['Bbmaj7', 4]], [['A7sus4', 2], ['A7', 2]]];
    const hI = K.harmTimeline(HI, 4, bar(-2)), hA = K.harmTimeline(HA, 4, 0), hB = K.harmTimeline(HB, 4, bar(8)), hC = K.harmTimeline(HC, 4, bar(16)), hD = K.harmTimeline(HD, 4, bar(24));

    // ---- piano: theme in D major (A), then flowing arpeggios under B / C
    const pn = song.part('piano', I.piano({ felt: 0.35, bright: 0.5, release: 0.4 }), { gain: 0, pan: -0.1, sends: { hall: -8 }, humanize: { t: 12, v: 0.07 } });
    const pnMel = song.part('pianoMel', I.piano({ felt: 0.3, bright: 0.55, release: 0.45 }), { gain: 2, pan: -0.05, sends: { hall: -7, air: -16 }, humanize: { t: 14, v: 0.07 } });
    pnMel.add(0, K.pimTheme({ transpose: 9, vel: 0.62, legato: 1.0 }));
    const arpSeg = (h, v, dense) => {
      const w = K.wideChord(h.sym, 'D2');
      const pat = h.d >= 4 ? (dense ? [0, 1, 2, 3, 4, 3, 2, 1] : [0, 1, 2, 3, 4, null, 2, null]) : (dense ? [0, 1, 2, 3] : [0, 1, 2, null]);
      K.arp(pn, h.b, w, pat, 0.5, v, { hold: h.d, velFn: (k) => (k === 0 ? 1.15 : 0.85) });
    };
    hI.forEach((h) => arpSeg(h, 0.42, false));
    hA.forEach((h) => arpSeg(h, 0.38, false));
    hB.forEach((h) => arpSeg(h, 0.42, true));
    hC.forEach((h) => arpSeg(h, 0.5, true));
    hD.forEach((h) => arpSeg(h, 0.4, false));

    // ---- strings: pad from A bar 5, melody in B/C (violins +12, cellos at pitch)
    const pad = song.part('strpad', I.strings({ attack: 1.0, release: 1.2, vib: 8, lp: 3200 }), { gain: -10, pan: 0.1, sends: { hall: -4 } });
    K.padChords(pad, [...hA.slice(5), ...hB, ...hC, ...hD], 'A3', 'E5', 3, 0.5);
    pad.automate([[bar(4), -12], [bar(6), -3], [bar(8), 0], [bar(16), 2], [bar(24), 0], [bar(26), -6]]);
    const vln = song.part('violins', I.strings({ attack: 0.25, release: 0.7, vib: 14, voices: 7, spread: 8, lp: 4800 }), { gain: -1, pan: 0.12, sends: { hall: -5, air: -12 }, humanize: { t: 8, v: 0.04 } });
    vln.add(bar(8), K.pimTheme({ transpose: 12, vel: 0.7, legato: 1.0 }));
    vln.add(bar(16), K.pimTheme({ transpose: 12, vel: 0.85, legato: 1.0, bars: [0, 1, 2, 3, 4, 5, 6] }));
    vln.add(bar(23), T.parse('C6/4 G5/8 A5/8 F5/2 |', { vel: 0.85, legato: 1.0 }));
    const vc = song.part('cellos', I.strings({ attack: 0.3, release: 0.7, vib: 10, voices: 4, spread: 6, body: 'cello', lp: 2400 }), { gain: -5, pan: -0.3, sends: { hall: -5 } });
    vc.add(bar(8), K.pimTheme({ vel: 0.65, legato: 1.0 }));
    for (const h of [...hC, ...hD]) vc.note(h.b, T.bassNote(h.sym, 'C2'), h.d, 0.7, { leg: 1 });

    // ---- choir: "ooh" in B, "aah" (singing the theme) in C
    const choirO = song.part('choirOoh', I.choir({ vowel: 'oo', attack: 0.9, release: 1.5 }), { gain: -8, sends: { air: -6 } });
    K.padChords(choirO, hB, 'C4', 'A5', 4, 0.5);
    choirO.automate([[bar(8), -8], [bar(10), 0]]);
    const choirA = song.part('choirAah', I.choir({ vowel: 'ah', attack: 0.3, release: 1.2, vib: 17, voices: 6 }), { gain: 4, pan: -0.05, sends: { hall: -4, air: -8 } });
    choirA.add(bar(16), K.pimTheme({ vel: 0.75, legato: 1.0, bars: [0, 1, 2, 3, 4, 5, 6] }));
    choirA.add(bar(23), T.parse('C5/4 G4/8 A4/8 F4/2 |', { vel: 0.75, legato: 1.0 }));
    const choirPad = song.part('choirPad', I.choir({ vowel: 'ah', attack: 0.6, release: 1.4 }), { gain: -7, sends: { air: -6 } });
    K.padChords(choirPad, hC, 'A3', 'D5', 3, 0.6);

    // ---- horns (soft brass) in C, harp in B/C, glockenspiel sparkle in C
    const horn = song.part('horns', I.brass({ voices: 3, spread: 5, attack: 0.12, decay: 0.5, sustain: 0.9, release: 0.4, fm: 0.1, bright: 0.45, lpBase: 250, lpEnv: 1200 }), { gain: -12, pan: -0.2, sends: { hall: -4 } });
    K.padChords(horn, hC, 'F3', 'C5', 3, 0.7);
    const harp = song.part('harp', I.pluck('harp'), { gain: -5, pan: 0.35, sends: { hall: -5 }, humanize: { t: 6, v: 0.08 } });
    for (const h of [...hB, ...hC]) { const w = K.wideChord(h.sym, 'F3'); const n = h.d * 2; for (let k = 0; k < n; k++) harp.note(h.b + k * 0.5 + 0.25, w[(k + 1) % w.length] + 12, 0.5, 0.45); }
    const glock = song.part('glock', I.modal('glock', { decay: 0.9 }), { gain: -14, pan: 0.3, sends: { air: -4 } });
    glock.add(bar(16), T.transposeEv(K.pimTheme({ vel: 0.5, bars: [0, 1, 2, 3, 4, 5, 6] }), 24));

    // ---- basses: contrabass-ish low strings under B/C
    const cb = song.part('bass', I.strings({ attack: 0.2, release: 0.6, vib: 5, voices: 3, spread: 5, body: 'cello', lp: 900, sub: 0.3 }), { gain: -7, sends: { hall: -8 } });
    for (const h of [...hB, ...hC]) cb.note(h.b, T.bassNote(h.sym, 'E1') + 12, h.d, 0.7, { leg: 1 });

    // ---- percussion: timpani, cymbal swells, soft cymbal on the climax downbeat
    const timp = song.part('timp', D.timpani({ decay: 2.6 }), { gain: -6, sends: { hall: -5 } });
    timp.note(bar(16), 'F2', 1, 0.75); timp.note(bar(20), 'Bb1', 1, 0.6); timp.note(bar(8), 'F2', 1, 0.45);
    timp.add(bar(15) + 2, T.grid('x.x.xxxxXXXX....', 0.125, { vmap: { x: 0.3, X: 0.55 } }).map((e) => Object.assign(e, { m: 41 })));
    const sw = song.part('swell', D.swell({ fc0: 600, fc1: 7500 }), { gain: -13, sends: { air: -4 } });
    sw.note(bar(14), 60, 8, 0.7, { leg: 1, noHuman: true }); sw.note(bar(6), 60, 6, 0.45, { leg: 1, noHuman: true });
    const cym = song.part('cymbal', D.cymbal({ decay: 3 }), { gain: -16, pan: 0.2, sends: { air: -6 } });
    cym.note(bar(16), 60, 2, 0.7);
    // last raindrops in the intro and A (fading away)
    const drops = song.part('drops', I.drop({ decay: 0.08 }), { gain: -12, sends: { air: -3 }, humanize: { t: 0, v: 0 } });
    K.plinks(drops, bar(-2), bar(4), new C.RNG(1212), ['A5', 'B5', 'D6', 'E6', 'F#6', 'A6'], 0.3, [0.2, 0.5]);
    drops.automate([[bar(-2), 0], [bar(2), -4], [bar(4), -18]]);
    return song;
  },
};
