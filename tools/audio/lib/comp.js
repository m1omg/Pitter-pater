'use strict';
// Composition helpers: the two leitmotifs and reusable accompaniment generators.
const T = require('./theory');
const C = require('./core');

// ---------------------------------------------------------------- PIM'S THEME (F major, 4/4)
// Exactly as specified in the brief; "pit-ter pat-ter" repeated eighths like raindrops.
const PIM_BARS = [
  'C5/8 C5/8 A4/8 A4/8 Bb4/8 A4/8 G4/4',
  'A4/8 A4/8 F4/8 F4/8 G4/8 F4/8 E4/4',
  'F4/8 G4/8 A4/8 C5/8 D5/4 C5/8 A4/8',
  'Bb4/4 A4/8 G4/8 F4/2',
  'C5/8 C5/8 A4/8 A4/8 Bb4/8 A4/8 G4/4',
  'A4/8 A4/8 F4/8 F4/8 D5/4 C5/4',
  'Bb4/8 A4/8 G4/8 A4/8 Bb4/8 C5/8 D5/4',
  'C5/4 G4/8 A4/8 F4/2',
];
// harmony per bar: each entry is a list of [chord, beats]
const PIM_HARM = [
  [['F', 4]], [['Dm', 4]], [['Bb', 4]], [['C7', 2], ['F', 2]],
  [['F', 4]], [['Dm', 4]], [['Gm7', 2], ['C', 2]], [['C7', 2], ['F', 2]],
];
// richer (jazzier) reharmonisation for lo-fi / Rhodes contexts
const PIM_HARM_JAZZ = [
  [['Fmaj9', 4]], [['Dm9', 4]], [['Bbmaj9', 4]], [['C9sus4', 2], ['Fmaj7', 2]],
  [['Fmaj9', 4]], [['Dm9', 4]], [['Gm9', 2], ['C9', 2]], [['C7b9', 2], ['Fmaj9', 2]],
];
function pimTheme(o = {}) {
  const bars = o.bars || [0, 1, 2, 3, 4, 5, 6, 7];
  const str = bars.map((i) => PIM_BARS[i]).join(' | ') + ' |';
  let ev = T.parse(str, { vel: o.vel === undefined ? 0.78 : o.vel, legato: o.legato });
  if (o.mode) ev = T.modalEv(ev, 'F', 'major', o.mode[0], o.mode[1], o.oct || 0);
  else if (o.transpose) ev = T.transposeEv(ev, o.transpose);
  return ev;
}
// 3/4 (waltz) adaptation: every 4/4 bar becomes two 3/4 bars
const PIM_WALTZ_BARS = [
  'C5/8 C5/8 A4/8 A4/8 Bb4/8 A4/8 | G4/2.',
  'A4/8 A4/8 F4/8 F4/8 G4/8 F4/8 | E4/2.',
  'F4/8 G4/8 A4/8 C5/8 D5/4 | C5/4 A4/2',
  'Bb4/2 A4/8 G4/8 | F4/2.',
  'C5/8 C5/8 A4/8 A4/8 Bb4/8 A4/8 | G4/2.',
  'A4/8 A4/8 F4/8 F4/8 D5/4 | C5/2.',
  'Bb4/8 A4/8 G4/8 A4/8 Bb4/8 C5/8 | D5/2.',
  'C5/2 G4/8 A4/8 | F4/2.',
];
function pimWaltz(o = {}) {
  const bars = o.bars || [0, 1, 2, 3, 4, 5, 6, 7];
  const str = bars.map((i) => PIM_WALTZ_BARS[i]).join(' | ') + ' |';
  let ev = T.parse(str, { bar: 3, vel: o.vel === undefined ? 0.78 : o.vel, legato: o.legato });
  if (o.mode) ev = T.modalEv(ev, 'F', 'major', o.mode[0], o.mode[1], o.oct || 0);
  else if (o.transpose) ev = T.transposeEv(ev, o.transpose);
  return ev;
}

// ---------------------------------------------------------------- RAIN QUEEN (Mom's sadness), D minor
// Slow descending chain of "sighs" (long-short, falling step) over a lament progression,
// then a hopeful but aching rise through the augmented second Bb -> C# back to D.
const RQ_BARS = [
  'F5/2. E5/4',      // Dm   : 3 -> 9 sigh
  'D5/2. C5/4',      // Bb   : 3 -> 9 sigh
  'Bb4/2 A4/4 G4/4', // Gm   : 3 -> 9 -> 1, sinking
  'Bb4/4 C#5/2.',    // A7b9 : augmented second, the ache
  'D5/1',            // Dm
];
const RQ_HARM = [[['Dm', 4]], [['Bb', 4]], [['Gm', 4]], [['A7b9', 4]], [['Dm', 4]]];
function rainQueen(o = {}) {
  const bars = o.bars || [0, 1, 2, 3, 4];
  const str = bars.map((i) => RQ_BARS[i]).join(' | ') + ' |';
  let ev = T.parse(str, { vel: o.vel === undefined ? 0.72 : o.vel, legato: o.legato === undefined ? 0.98 : o.legato });
  if (o.transpose) ev = T.transposeEv(ev, o.transpose);
  if (o.mode) ev = T.modalEv(ev, 'D', 'minor', o.mode[0], o.mode[1], o.oct || 0);
  return ev;
}
// waltz version: dotted half + quarter -> half + quarter per 3/4 bar
const RQ_WALTZ_BARS = ['F5/2 E5/4', 'D5/2 C5/4', 'Bb4/4 A4/4 G4/4', 'Bb4/4 C#5/2', 'D5/2.'];

// ---------------------------------------------------------------- generators
// expand harmony [[sym,beats],...] into [{b, d, sym}]
function harmTimeline(barHarms, beatsPerBar = 4, startBeat = 0) {
  const out = []; let b = startBeat;
  for (const bar of barHarms) {
    let bb = b;
    for (const [sym, d] of bar) { out.push({ b: bb, d, sym }); bb += d; }
    b += beatsPerBar;
  }
  return out;
}
// arpeggiate a voicing: pattern = indices, step = beats per note; pedal = hold notes until `hold` beats
function arp(part, beat, voicing, pattern, step, vel = 0.6, o = {}) {
  const hold = o.hold || 0;
  pattern.forEach((ix, k) => {
    if (ix === null || ix === undefined || ix === '.') return;
    const m = voicing[ix % voicing.length] + 12 * Math.floor(ix / voicing.length);
    const b = beat + k * step;
    const d = hold ? Math.max(step, hold - k * step) : step;
    const accent = o.accent && k % o.accent === 0 ? 1.12 : 1;
    part.note(b, m, d, vel * accent * (o.velFn ? o.velFn(k) : 1), { leg: hold ? 1.0 : o.leg || 0.9 });
  });
}
// random raindrop plinks from a pitch pool across a beat range
function plinks(part, from, to, rng, pool, perBeat = 0.5, vel = [0.3, 0.7], o = {}) {
  let b = from;
  while (b < to) {
    b += (o.grid || 0.25) * Math.max(1, Math.round(-Math.log(1 - rng.next()) / perBeat / (o.grid || 0.25)));
    if (b >= to) break;
    const m = T.nm(rng.pick(pool));
    part.note(b, m, 0.25, rng.uni(vel[0], vel[1]), { pan: rng.uni(-0.7, 0.7), noHuman: false });
  }
}
// sustained chords with voice leading across a harmony timeline
function padChords(part, harm, lo, hi, voices, vel = 0.5, o = {}) {
  let prev = o.prev || null;
  for (const h of harm) {
    const v = T.voiceLead(prev, h.sym, lo, hi, voices, o);
    prev = v;
    for (const m of v) part.note(h.b, m, h.d, vel, { leg: o.leg || 1.0 });
  }
  return prev;
}
function bassLine(part, harm, lo = 'E1', vel = 0.7, o = {}) {
  for (const h of harm) part.note(h.b, T.bassNote(h.sym, lo), h.d, vel, { leg: o.leg || 0.95 });
}
// wide "pianistic" broken-chord voicing: bass, 5th, root, 3rd, 7th|5th, 9th|3rd (ascending, no low 2nds,
// no semitone at the top)
function wideChord(sym, lo = 'F2') {
  const c = T.chord(sym);
  const has = (i) => c.iv.some((x) => x % 12 === i);
  const third = has(4) ? 4 : has(3) ? 3 : has(5) ? 5 : 2;
  const fifth = has(7) ? 7 : has(6) ? 6 : has(8) ? 8 : 7;
  const sev = has(10) ? 10 : has(11) ? 11 : has(9) ? 9 : fifth;
  const ninth = c.iv.includes(13) ? 1 : c.iv.includes(15) ? 3 : c.iv.includes(14) ? 2 : null;
  const bass = T.pcAtOrAbove(c.bass, T.nm(lo));
  const out = [bass];
  const next = (iv, minGap = 1) => { const pc = (c.root + iv) % 12; out.push(T.pcAtOrAbove(pc, out[out.length - 1] + minGap)); };
  if (c.bass !== c.root) { next(fifth, 5); next(0, 3); } else { next(fifth); next(0); }
  next(third); next(sev);
  if (ninth !== null) next(ninth, 2); else next(third, 3);
  return out;
}
// Walking bass: quarter notes; beat 1 = bass note, inner beats = chord tones / scale steps, last beat =
// chromatic or diatonic approach into the next chord. Pitches realised nearest to the previous note.
function walkingBass(part, harm, o = {}) {
  const lo = T.nm(o.lo || 'E1'), hi = T.nm(o.hi || 'C3');
  const rng = new C.RNG(o.seed || 7);
  const scale = o.scale || null; // array of pcs (optional)
  let prev = T.nm(o.start || 'G1');
  const realise = (pc) => {
    let best = null;
    for (let m = lo; m <= hi; m++) if (((m % 12) + 12) % 12 === pc && (best === null || Math.abs(m - prev) < Math.abs(best - prev))) best = m;
    return best === null ? T.pcAtOrAbove(pc, lo) : best;
  };
  harm.forEach((h, i) => {
    const c = T.chord(h.sym);
    const nx = T.chord(harm[(i + 1) % harm.length].sym);
    const has = (iv) => c.iv.some((x) => x % 12 === iv);
    const third = has(4) ? 4 : has(3) ? 3 : 5, fifth = has(7) ? 7 : has(6) ? 6 : 8;
    const pcs = [];
    const beats = Math.round(h.d);
    const approach = (avoid) => {
      const cands = [(nx.bass + 11) % 12, (nx.bass + 1) % 12, (nx.root + 7) % 12, (nx.bass + 2) % 12];
      const r = rng.next();
      let pick = r < 0.45 ? 0 : r < 0.7 ? 1 : 2;
      for (let k = 0; k < 4 && (cands[pick] === avoid || cands[pick] === nx.bass); k++) pick = (pick + 1) % 4;
      return cands[pick];
    };
    if (beats >= 4) {
      const opts = [[third, fifth], [fifth, third], [2, third], [third, fifth + (has(10) ? 3 : 2)], [fifth, 9]];
      const [x, y] = opts[Math.floor(rng.next() * opts.length)];
      pcs.push(c.bass, (c.root + x) % 12, (c.root + y) % 12);
      pcs.push(approach(pcs[2]));
    } else if (beats === 3) {
      pcs.push(c.bass, (c.root + fifth) % 12); pcs.push(approach(pcs[1]));
    } else if (beats === 2) {
      pcs.push(c.bass); pcs.push(approach(c.bass));
    } else pcs.push(c.bass);
    pcs.forEach((pc, k) => {
      const m = realise(pc);
      part.note(h.b + k, m, 1, (o.vel || 0.8) * (k === 0 ? 1 : 0.85 + 0.1 * rng.next()), { leg: o.leg || 0.88 });
      prev = m;
    });
  });
}
// euclidean-ish rhythm helper
function euclid(k, n) { const out = []; for (let i = 0; i < n; i++) out.push(Math.floor((i * k) / n) !== Math.floor(((i + 1) * k) / n) ? 1 : 0); return out; }

module.exports = {
  PIM_BARS, PIM_HARM, PIM_HARM_JAZZ, pimTheme, PIM_WALTZ_BARS, pimWaltz,
  RQ_BARS, RQ_HARM, RQ_WALTZ_BARS, rainQueen,
  harmTimeline, arp, plinks, padChords, bassLine, euclid, wideChord, walkingBass,
};
