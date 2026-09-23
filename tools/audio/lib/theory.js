'use strict';
// Music theory helpers: note names, chord symbols, voicings, voice-leading, melody parsing,
// scale-degree (modal) mapping and drum-grid parsing.

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function pcOf(name) {
  const m = /^([A-Ga-g])([#b]*)$/.exec(name);
  if (!m) throw new Error('bad pitch class ' + name);
  let p = PC[m[1].toUpperCase()];
  for (const ch of m[2]) p += ch === '#' ? 1 : -1;
  return ((p % 12) + 12) % 12;
}
// "C4" -> 60, "Bb3" -> 58, also accepts numbers
function nm(name) {
  if (typeof name === 'number') return name;
  const m = /^([A-Ga-g])([#b]*)(-?\d+)$/.exec(name.trim());
  if (!m) throw new Error('bad note ' + name);
  let p = PC[m[1].toUpperCase()];
  for (const ch of m[2]) p += ch === '#' ? 1 : -1;
  return 12 * (parseInt(m[3], 10) + 1) + p;
}
const noteName = (m, flat = true) => (flat ? NAMES_FLAT : NAMES_SHARP)[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

// ---------------------------------------------------------------- chords
const QUAL = {
  '': [0, 4, 7], 'maj': [0, 4, 7], 'M': [0, 4, 7], 'm': [0, 3, 7], 'min': [0, 3, 7], 'dim': [0, 3, 6], 'aug': [0, 4, 8], '+': [0, 4, 8],
  'sus2': [0, 2, 7], 'sus4': [0, 5, 7], 'sus': [0, 5, 7], '5': [0, 7],
  '6': [0, 4, 7, 9], 'm6': [0, 3, 7, 9], '69': [0, 4, 7, 9, 14], 'm69': [0, 3, 7, 9, 14],
  '7': [0, 4, 7, 10], 'maj7': [0, 4, 7, 11], 'M7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10], 'mMaj7': [0, 3, 7, 11],
  'dim7': [0, 3, 6, 9], 'm7b5': [0, 3, 6, 10], 'ø': [0, 3, 6, 10], '7sus4': [0, 5, 7, 10], '7sus2': [0, 2, 7, 10],
  'add9': [0, 4, 7, 14], 'madd9': [0, 3, 7, 14], '9': [0, 4, 7, 10, 14], 'maj9': [0, 4, 7, 11, 14], 'm9': [0, 3, 7, 10, 14],
  '9sus4': [0, 5, 7, 10, 14], '11': [0, 7, 10, 14, 17], 'm11': [0, 3, 7, 10, 14, 17], '13': [0, 4, 7, 10, 14, 21],
  'maj13': [0, 4, 7, 11, 14, 21], 'm13': [0, 3, 7, 10, 14, 21], '7b9': [0, 4, 7, 10, 13], '7#9': [0, 4, 7, 10, 15],
  '7#11': [0, 4, 7, 10, 18], 'maj7#11': [0, 4, 7, 11, 18], '7b13': [0, 4, 7, 10, 20], '7#5': [0, 4, 8, 10], 'aug7': [0, 4, 8, 10],
  'm7b9': [0, 3, 7, 10, 13], '13b9': [0, 4, 10, 13, 21], 'maj6': [0, 4, 7, 9], 'mb6': [0, 3, 7, 8],
};
// parse "Fmaj7", "Dm9", "C7/E", "Bb/C"
function chord(sym) {
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(sym.trim());
  if (!m) throw new Error('bad chord ' + sym);
  const root = pcOf(m[1]);
  const q = m[2];
  if (!(q in QUAL)) throw new Error('unknown chord quality "' + q + '" in ' + sym);
  const iv = QUAL[q];
  const bass = m[3] !== undefined ? pcOf(m[3]) : root;
  return { sym, root, iv, bass, pcs: iv.map((i) => (root + i) % 12) };
}
// lowest midi >= lo with given pitch class
function pcAtOrAbove(pc, lo) { let m = lo; while (((m % 12) + 12) % 12 !== pc) m++; return m; }
function pcNear(pc, target) { const b = pcAtOrAbove(pc, target - 6); return b; }
// stacked close voicing starting on/above `lo`, from chord tones in order given by `iv`
function closeVoicing(sym, lo, opts = {}) {
  const c = typeof sym === 'string' ? chord(sym) : sym;
  const tones = opts.omitRoot ? c.iv.filter((x) => x % 12 !== 0) : c.iv.slice();
  const inv = opts.inversion || 0;
  let pcs = tones.map((i) => (c.root + i) % 12);
  for (let k = 0; k < inv; k++) pcs.push(pcs.shift());
  const out = []; let cur = nm(lo) - 1;
  for (const pc of pcs) { cur = pcAtOrAbove(pc, cur + 1); out.push(cur); }
  return out;
}
// candidate voicings of n voices within [lo,hi] using chord pcs; choose min movement from prev
function voiceLead(prev, sym, lo, hi, n, opts = {}) {
  const c = typeof sym === 'string' ? chord(sym) : sym;
  lo = nm(lo); hi = nm(hi);
  let pcs = c.pcs.slice();
  if (opts.omit5 && pcs.length > 3) pcs = pcs.filter((p) => p !== (c.root + 7) % 12);
  if (opts.omitRoot && pcs.length > 3) pcs = pcs.filter((p) => p !== c.root);
  // all notes in range with those pcs
  const pool = [];
  for (let m = lo; m <= hi; m++) if (pcs.includes(((m % 12) + 12) % 12)) pool.push(m);
  let best = null, bestCost = Infinity;
  const need = Math.min(n, pool.length);
  const choose = (start, acc) => {
    if (acc.length === need) {
      // must cover the essential tones (3rd & 7th when present) and avoid seconds at bottom
      const set = new Set(acc.map((m) => m % 12));
      const ess = [c.iv.includes(3) ? (c.root + 3) % 12 : c.iv.includes(4) ? (c.root + 4) % 12 : null,
        c.iv.includes(10) ? (c.root + 10) % 12 : c.iv.includes(11) ? (c.root + 11) % 12 : null].filter((x) => x !== null);
      for (const e of ess) if (!set.has(e)) return;
      if (set.size < Math.min(need, pcs.length)) return;
      if (acc.length >= 2 && acc[1] - acc[0] < 3 && acc[0] < 57) return; // muddy low 2nds
      let cost = 0;
      if (prev && prev.length) {
        const a = acc.slice().sort((x, y) => x - y), b = prev.slice().sort((x, y) => x - y);
        const k = Math.min(a.length, b.length);
        for (let i = 0; i < k; i++) cost += Math.abs(a[i] - b[i]);
        cost += Math.abs(a.length - b.length) * 3;
      } else {
        const mid = (lo + hi) / 2; for (const m of acc) cost += Math.abs(m - mid) * 0.3;
      }
      // avoid semitone rubs between adjacent voices and minor 9ths anywhere (unless the chord is a b9 chord)
      const b9chord = c.iv.includes(13) || c.iv.includes(1);
      for (let i = 1; i < acc.length; i++) if (acc[i] - acc[i - 1] === 1) cost += b9chord ? 3 : 30;
      if (!b9chord) for (let i = 0; i < acc.length; i++) for (let j = i + 1; j < acc.length; j++) if (acc[j] - acc[i] === 13) cost += 8;
      if (opts.top !== undefined) cost += Math.abs(acc[acc.length - 1] - nm(opts.top)) * 0.8;
      if (cost < bestCost) { bestCost = cost; best = acc.slice(); }
      return;
    }
    for (let i = start; i < pool.length; i++) {
      if (acc.length && pool[i] - acc[acc.length - 1] > 12) break;
      acc.push(pool[i]); choose(i + 1, acc); acc.pop();
    }
  };
  choose(0, []);
  if (!best) best = closeVoicing(c, lo).slice(0, n);
  return best;
}
function bassNote(sym, lo = 'E1') { const c = typeof sym === 'string' ? chord(sym) : sym; return pcAtOrAbove(c.bass, nm(lo)); }

// ---------------------------------------------------------------- scales & modal mapping
const MODES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10], melodic: [0, 2, 3, 5, 7, 9, 11],
  pentaMajor: [0, 2, 4, 7, 9], pentaMinor: [0, 3, 5, 7, 10],
};
function scalePcs(tonic, mode) { const t = typeof tonic === 'string' ? pcOf(tonic) : tonic; return MODES[mode].map((i) => (t + i) % 12); }
// map a midi note from (tonicA, modeA) to (tonicB, modeB) by scale degree; chromatic notes keep their
// alteration. The whole line moves by the tonic displacement (chosen in -6..+5 semitones) so contour is kept.
function mapDegree(m, fromT, fromMode, toT, toMode, octShift = 0) {
  const ft = typeof fromT === 'string' ? pcOf(fromT) : fromT, tt = typeof toT === 'string' ? pcOf(toT) : toT;
  const fs = MODES[fromMode], ts = MODES[toMode];
  const r = (((m - ft) % 12) + 12) % 12;
  let deg = fs.indexOf(r);
  if (deg < 0) { deg = fs.indexOf((r + 11) % 12); if (deg < 0) deg = fs.indexOf((r + 1) % 12); }
  let shift = (((tt - ft) % 12) + 12) % 12; if (shift > 6) shift -= 12;
  return m + shift + (ts[deg] - fs[deg]) + 12 * octShift;
}
function snapToScale(m, tonic, mode) { const s = scalePcs(tonic, mode); let k = 0; while (k < 12) { if (s.includes(((m + k) % 12 + 12) % 12)) return m + k; if (s.includes(((m - k) % 12 + 12) % 12)) return m - k; k++; } return m; }

// ---------------------------------------------------------------- melody string parser
// tokens: "C5/8" "Bb4/4." "r/2" "F4+A4+C5/2" "E4/8t" "C5/g" "D5/4!" "A4/8?" "G4/4'" "C5/2~" "C5/2+8" "A4/8@0.6" "|"
function durBeats(s) {
  let total = 0;
  for (const part of s.split('+')) {
    const m = /^(\d+)(\.{0,2})(t?)$/.exec(part);
    if (!m) { const b = /^([\d.]+)b$/.exec(part); if (b) { total += parseFloat(b[1]); continue; } throw new Error('bad duration ' + s); }
    let d = 4 / parseInt(m[1], 10);
    if (m[2] === '.') d *= 1.5; else if (m[2] === '..') d *= 1.75;
    if (m[3]) d *= 2 / 3;
    total += d;
  }
  return total;
}
function parse(str, opts = {}) {
  const bar = opts.bar || 4; // beats per bar for | checks
  const trans = opts.transpose || 0;
  const out = [];
  let b = 0, barStart = 0, pendingGrace = [];
  const toks = str.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
  for (const tk of toks) {
    if (tk === '|') {
      const len = b - barStart;
      if (Math.abs(len - bar) > 1e-6 && !opts.noCheck) throw new Error(`bar length ${len} != ${bar} before "|" at beat ${b} in: ${str.slice(0, 80)}`);
      barStart = b; continue;
    }
    if (tk === '||') { barStart = b; continue; } // no check
    const m = /^([^/]+)\/([^!?'_~@>]+)([!?'_~>]*)(?:@([\d.]+))?([!?'_~>]*)$/.exec(tk);
    if (!m) throw new Error('bad token ' + tk);
    const pitch = m[1], dur = m[2], mods = m[3] + (m[5] || '');
    let vel = opts.vel === undefined ? 0.8 : opts.vel;
    if (mods.includes('!')) vel = Math.min(1, vel + 0.17);
    if (mods.includes('?')) vel = Math.max(0.2, vel - 0.25);
    if (m[4]) vel = parseFloat(m[4]);
    let leg = opts.legato === undefined ? 0.92 : opts.legato;
    if (mods.includes("'")) leg = 0.45;
    if (mods.includes('_')) leg = 1.0;
    if (mods.includes('~')) leg = 1.08;
    if (dur === 'g') { // grace note: attached to next note
      if (pitch !== 'r') pendingGrace.push({ m: pitch.split('+').map((p) => nm(p) + trans), v: vel * 0.8 });
      continue;
    }
    const d = durBeats(dur);
    if (pitch !== 'r') {
      const ms = pitch.split('+').map((p) => nm(p) + trans);
      if (pendingGrace.length) {
        const gd = opts.graceBeats || 0.09; let k = pendingGrace.length;
        for (const g of pendingGrace) { out.push({ b: b - gd * k, d: gd * 1.1, m: g.m.length === 1 ? g.m[0] : g.m, v: g.v, leg: 1, grace: true }); k--; }
        pendingGrace = [];
      }
      out.push({ b, d, m: ms.length === 1 ? ms[0] : ms, v: vel, leg, slide: mods.includes('>') });
    }
    b += d;
  }
  out.len = b;
  return out;
}
// shift/transform helpers for parsed event lists
function shiftEv(evs, db) { const o = evs.map((e) => Object.assign({}, e, { b: e.b + db })); o.len = evs.len; return o; }
function mapEv(evs, fn) { const o = evs.map((e) => { const c = Object.assign({}, e); const r = fn(c); return r || c; }).filter(Boolean); o.len = evs.len; return o; }
function transposeEv(evs, semis) { return mapEv(evs, (e) => { e.m = Array.isArray(e.m) ? e.m.map((x) => x + semis) : e.m + semis; }); }
function modalEv(evs, fromT, fromMode, toT, toMode, oct = 0) {
  return mapEv(evs, (e) => { const f = (x) => mapDegree(x, fromT, fromMode, toT, toMode, oct); e.m = Array.isArray(e.m) ? e.m.map(f) : f(e.m); });
}
function augment(evs, k) { const o = evs.map((e) => Object.assign({}, e, { b: e.b * k, d: e.d * k })); o.len = (evs.len || 0) * k; return o; }
function sliceEv(evs, b0, b1) { const o = evs.filter((e) => e.b >= b0 - 1e-9 && e.b < b1 - 1e-9).map((e) => Object.assign({}, e, { b: e.b - b0 })); o.len = b1 - b0; return o; }
function velEv(evs, k) { return mapEv(evs, (e) => { e.v = Math.min(1, e.v * k); }); }

// ---------------------------------------------------------------- drum grid
// "x..x ..x. X.o." -> hits; step in beats. x=0.8, X=1.0, o=0.45 ghost, g=0.3, '.'/'-' rest
function grid(pat, step = 0.25, opts = {}) {
  const out = []; let i = 0;
  const vmap = Object.assign({ x: 0.8, X: 1.0, o: 0.45, g: 0.3, O: 0.6 }, opts.vmap || {});
  for (const ch of pat.replace(/[\s|]/g, '')) {
    if (vmap[ch] !== undefined) out.push({ b: i * step, v: vmap[ch], ch });
    i++;
  }
  out.len = i * step;
  return out;
}
// swing: delay offbeat positions of `unit` grid (0.5 = 8ths, 0.25 = 16ths); amt 0..1 (1 = full triplet)
function swingBeat(b, amt, unit = 0.5) {
  const pos = b / unit; const k = Math.round(pos);
  if (Math.abs(pos - k) > 1e-6) return b;
  if (k % 2 === 1) return b + amt * unit / 3;
  return b;
}

module.exports = {
  pcOf, nm, noteName, chord, closeVoicing, voiceLead, bassNote, pcAtOrAbove, pcNear, QUAL,
  MODES, scalePcs, mapDegree, snapToScale,
  durBeats, parse, shiftEv, mapEv, transposeEv, modalEv, augment, sliceEv, velEv, grid, swingBeat,
};
