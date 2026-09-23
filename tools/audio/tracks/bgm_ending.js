'use strict';
// Ending / credits - warm, hopeful full arrangement of Pim's theme. F major, 90 BPM, ~2.5 min.
// Intro (4 bars, piano). Loop (48 bars):
// A1 theme on piano | A2 theme on violins + glockenspiel, light drums & bass enter |
// B  "healing" theme: the Rain Queen's falling sighs turned into rising ones (cellos, then violins) |
// A3 full: violins + choir + glock, piano counter-line, fuller drums |
// D  bridge: the "pitter-patter" cell passed between piano and glockenspiel |
// A4 gentle final statement (piano + glock in octaves), drums fade, settles on F -> loop.
const S = require('../lib/song');
const I = require('../lib/inst');
const D = require('../lib/drums');
const T = require('../lib/theory');
const K = require('../lib/comp');

module.exports = {
  id: 'bgm_ending', type: 'bgm',
  build() {
    const song = new S.Song({ id: 'bgm_ending', bpm: 90, introBars: 4, loopBars: 48, tailSec: 6, seed: 1515 });
    const bar = (n) => song.bar(n);
    song.bus('hall', { type: 'reverb', t60: 2.6, predelay: 0.03, hp: 180, lp: 7500, er: 0.18 });
    song.bus('room', { type: 'reverb', t60: 1.0, predelay: 0.01, hp: 220, lp: 7000, er: 0.35, seed: 151 });

    const HI = [[['Fmaj7', 4]], [['Bbmaj7', 4]], [['Dm7', 4]], [['C9sus4', 4]]];
    const HA = [[['F', 4]], [['Dm7', 3], ['Am7', 1]], [['Bbadd9', 4]], [['C7', 2], ['F', 2]], [['F', 4]], [['Dm7', 4]], [['Gm7', 2], ['C9', 2]], [['C7', 2], ['F', 2]]];
    const HB = [[['F/A', 3], ['Gm7', 1]], [['Bbadd9', 4]], [['C', 4]], [['Dm7', 4]], [['Bbadd9', 4]], [['C', 4]], [['Am7', 2], ['Dm7', 2]], [['Gm7', 2], ['C7', 2]]];
    const HD = [[['Dm', 4]], [['Bb', 4]], [['F', 4]], [['C', 4]], [['Dm', 4]], [['Bb', 4]], [['Gm7', 4]], [['C7sus4', 2], ['C7', 2]]];
    const hI = K.harmTimeline(HI, 4, bar(-4));
    const secs = [['A1', HA, 0], ['A2', HA, 8], ['B', HB, 16], ['A3', HA, 24], ['D', HD, 32], ['A4', HA, 40]];
    const H = {}; for (const [n, hh, b] of secs) H[n] = K.harmTimeline(hh, 4, bar(b));
    const allLoop = secs.flatMap(([n]) => H[n]);

    // ---- piano: intro chords, A1 melody, arpeggios elsewhere
    const pn = song.part('piano', I.piano({ felt: 0.35, bright: 0.5, release: 0.35 }), { gain: -2, pan: -0.12, sends: { hall: -9 }, humanize: { t: 10, v: 0.07 } });
    const pnMel = song.part('pianoMel', I.piano({ felt: 0.3, bright: 0.55, release: 0.4 }), { gain: 1, pan: -0.05, sends: { hall: -8 }, humanize: { t: 10, v: 0.06 } });
    const arpSeg = (h, v, dense) => {
      const w = K.wideChord(h.sym, 'E2');
      const pat = h.d >= 4 ? (dense ? [0, 1, 2, 3, 4, 3, 2, 1] : [0, 1, 2, 3, null, 3, 2, null]) : [0, 1, 2, 3];
      K.arp(pn, h.b, w, pat, 0.5, v, { hold: h.d, velFn: (k) => (k === 0 ? 1.15 : 0.85) });
    };
    hI.forEach((h) => arpSeg(h, 0.45, true));
    H.A1.forEach((h) => arpSeg(h, 0.4, false));
    for (const n of ['A2', 'B', 'A3', 'D']) H[n].forEach((h) => arpSeg(h, n === 'A3' ? 0.45 : 0.4, true));
    H.A4.forEach((h) => arpSeg(h, 0.38, false));
    pnMel.add(0, K.pimTheme({ transpose: 12, vel: 0.62, legato: 1.0 }));
    // A3 counter-line (piano, middle register)
    pnMel.add(bar(24), T.parse('r/2 F4/4 A4/4 | C5/2 A4/4 E4/4 | D4/4 F4/4 C5/2 | G4/2 A4/4 C5/4 | r/2 F4/4 A4/4 | D5/2 A4/4 F4/4 | G4/4 Bb4/4 E4/4 G4/4 | E4/2 F4/4 r/4 |', { vel: 0.45, legato: 1.0 }));
    // D bridge: pitter-patter call and response with the glockenspiel
    pnMel.add(bar(32), T.parse('A4/8 A4/8 F4/8 F4/8 D4/2 | r/1 | C5/8 C5/8 A4/8 A4/8 F4/2 | r/1 | A4/8 A4/8 F4/8 F4/8 D4/2 | r/1 | Bb4/8 A4/8 G4/8 A4/8 Bb4/8 C5/8 D5/4 | C5/2 r/2 |', { vel: 0.55 }));
    // A4: theme again in octaves with the glockenspiel
    pnMel.add(bar(40), K.pimTheme({ transpose: 12, vel: 0.55, legato: 1.0 }));

    // ---- glockenspiel
    const glock = song.part('glock', I.modal('glock', { decay: 0.8 }), { gain: -10, pan: 0.3, sends: { hall: -6 }, humanize: { t: 5, v: 0.05 } });
    glock.add(bar(8), K.pimTheme({ transpose: 24, vel: 0.5 }));
    glock.add(bar(24), K.pimTheme({ transpose: 24, vel: 0.55 }));
    glock.add(bar(33), T.parse('C6/8 C6/8 A5/8 A5/8 F5/2 |', { vel: 0.55 }));
    glock.add(bar(35), T.parse('G5/8 G5/8 E5/8 E5/8 C5/2 |', { vel: 0.55 }));
    glock.add(bar(37), T.parse('D6/8 D6/8 Bb5/8 Bb5/8 F5/2 |', { vel: 0.55 }));
    glock.add(bar(40), K.pimTheme({ transpose: 24, vel: 0.5 }));

    // ---- strings
    const pad = song.part('strpad', I.strings({ attack: 0.9, release: 1.1, vib: 8, lp: 3200 }), { gain: -11, pan: 0.1, sends: { hall: -4 } });
    K.padChords(pad, [...H.A1.slice(4), ...H.A2, ...H.B, ...H.A3, ...H.D, ...H.A4], 'A3', 'E5', 3, 0.48);
    pad.automate([[bar(4), -10], [bar(6), 0], [bar(40), 0], [bar(46), -4], [bar(48), -8]]);
    const vln = song.part('violins', I.strings({ attack: 0.2, release: 0.6, vib: 13, voices: 7, spread: 8, lp: 4600 }), { gain: -2, pan: 0.15, sends: { hall: -5 }, humanize: { t: 8, v: 0.04 } });
    vln.add(bar(8), K.pimTheme({ transpose: 12, vel: 0.68, legato: 1.0 }));
    vln.add(bar(24), K.pimTheme({ transpose: 12, vel: 0.8, legato: 1.0 }));
    const healing = 'A4/2. Bb4/4 | C5/2. D5/4 | E5/2 F5/4 G5/4 | F5/4 A5/2. | Bb5/2. A5/4 | G5/2. E5/4 | C6/2 A5/4 F5/4 | G5/2 E5/2 |';
    vln.add(bar(20), T.sliceEv(T.parse(healing, { vel: 0.7, legato: 1.0 }), 16, 32));
    const vc = song.part('cellos', I.strings({ attack: 0.25, release: 0.6, vib: 10, voices: 4, spread: 6, body: 'cello', lp: 2300 }), { gain: -3, pan: -0.25, sends: { hall: -5 } });
    vc.add(bar(16), T.parse(healing, { vel: 0.75, legato: 1.0 }).map((e) => Object.assign(e, { m: e.m - 12 })));
    const choir = song.part('choir', I.choir({ vowel: 'oo', attack: 0.7, release: 1.2 }), { gain: -12, sends: { hall: -4 } });
    K.padChords(choir, H.A3, 'C4', 'A5', 4, 0.55);

    // ---- bass (soft upright) from A2 to A4
    const bass = song.part('bass', I.pluck('upright', { t60: 2.6 }), { gain: -6, pan: -0.05, sends: { room: -14 }, humanize: { t: 6, v: 0.05 } });
    for (const n of ['A2', 'B', 'A3', 'D', 'A4']) {
      H[n].forEach((h, i) => {
        const c = T.chord(h.sym); const r = T.pcAtOrAbove(c.bass, T.nm('A1'));
        bass.note(h.b, r, Math.min(1.8, h.d - 0.15), 0.8, { leg: 0.95 });
        if (h.d >= 4) bass.note(h.b + 2, T.pcAtOrAbove((c.root + 7) % 12, r + 1), 1.8, 0.7, { leg: 0.95 });
      });
    }
    bass.automate([[bar(44), 0], [bar(47), -8]]);

    // ---- light drums: A2 (shaker, soft kick, rim), A3 fuller, D lighter, A4 fades out
    const kick = song.part('kick', D.kick({ f0: 52, f1: 110, decay: 0.3, click: 0.12, drive: 1.2 }), { gain: -7, humanize: { t: 4, v: 0.05 } });
    const rim = song.part('rim', D.block({ f: 1700, ratio: 1.9, decay: 0.035, click: 0.5, second: 0.4 }), { gain: -3, pan: 0.1, sends: { room: -6 }, humanize: { t: 5, v: 0.06 } });
    const snare = song.part('snare', D.brush({ decay: 0.14 }), { gain: -3, pan: 0.05, sends: { room: -6 }, humanize: { t: 6, v: 0.06 } });
    const shk = song.part('shaker', D.shaker({ decay: 0.055 }), { gain: 0, pan: 0.35, sends: { room: -8 }, humanize: { t: 6, v: 0.1 } });
    const ride = song.part('ride', D.cymbal({ kind: 'ride', decay: 1.4, lp: 9000 }), { gain: -16, pan: -0.3, sends: { room: -8 } });
    const cym = song.part('cymbal', D.cymbal({ decay: 2.5 }), { gain: -16, pan: 0.3, sends: { hall: -6 } });
    for (let b = 8; b < 48; b++) {
      const inA3 = b >= 24 && b < 32, inD = b >= 32 && b < 40, fade = b >= 44;
      if (b === 8 || b === 24 || b === 40) cym.note(bar(b), 60, 2, 0.7);
      if (fade && b >= 46) continue;
      kick.add(bar(b), T.grid(inA3 ? 'X.....x.X.......' : 'X.......x.......', 0.25, { vmap: { X: 0.8, x: 0.55 } }));
      shk.add(bar(b), T.grid('x.o.x.o.x.o.x.o.', 0.25, { vmap: { x: inD ? 0.4 : 0.55, o: 0.3 } }));
      if (inA3) { snare.add(bar(b), T.grid('....X.......X...', 0.25, { vmap: { X: 0.75 } })); ride.add(bar(b), T.grid('x.x.x.x.', 0.5, { vmap: { x: 0.5 } })); }
      else rim.add(bar(b), T.grid('....x.......x...', 0.25, { vmap: { x: inD ? 0.45 : 0.6 } }));
    }
    for (const p of [kick, shk, rim]) p.automate([[bar(43), 0], [bar(46), -10]]);
    return song;
  },
};
