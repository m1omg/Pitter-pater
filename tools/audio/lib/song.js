'use strict';
// Song model + offline renderer with gapless-loop construction.
//
// Timeline = [prePad][intro][loop pass 1][first D seconds of loop pass 2].
// Events in the loop body are scheduled in pass 1 AND (if they start within D) in pass 2, so the
// second pass contains the release/reverb tails of the first pass - exactly what a "folded" loop
// needs. Effects run linearly over the whole timeline; every LFO is quantised to the loop period
// and every noise bed is generated as an exactly periodic buffer, so pass 2 == steady state.
//  - no intro : file = pass2[0,D) ++ pass1[D,L)   -> loopStart 0, loopEnd L (tail folded onto start)
//  - intro    : file = intro ++ pass1 ++ pass2[0,D) -> loopStart I+D, loopEnd I+L+D (bar lines)
const C = require('./core');
const FX = require('./fx');
const LU = require('./loudness');
const T = require('./theory');
const { SR, zeros, RNG, seedOf, clamp, dbToGain } = C;

class Part {
  constructor(song, name, inst, o = {}) {
    this.song = song; this.name = name; this.inst = inst;
    this.o = Object.assign({ gain: 0, pan: 0, sends: {}, fx: [], choke: null, chokeFade: 0.02, humanize: { t: 6, v: 0.06 }, swing: 0, swingUnit: 0.5, width: 1, mute: false, phraseGap: 0.04 }, o);
    this.events = [];
    this.auto = null;
  }
  // add parsed events (from T.parse / T.grid) at beat position
  add(beat, evs, extra = {}) {
    for (const e of evs) {
      const ev = Object.assign({}, e, extra);
      ev.b = beat + e.b;
      if (ev.d === undefined) ev.d = 0.25;
      this.events.push(ev);
    }
    return this;
  }
  note(beat, m, d, v = 0.8, extra = {}) { this.events.push(Object.assign({ b: beat, m: T.nm(m), d, v, leg: 0.95 }, extra)); return this; }
  // chord with optional strum (seconds between notes)
  chord(beat, ms, d, v = 0.7, o = {}) {
    const list = ms.map(T.nm).sort((a, b) => a - b);
    if (o.dir === 'up') list.reverse();
    const strum = o.strum || 0;
    list.forEach((m, i) => this.events.push(Object.assign({ b: beat, m, d, v: v * (o.velSlope ? 1 - o.velSlope * i / list.length : 1), leg: o.leg || 0.95, dt: strum * i + (o.dt || 0) }, o.extra || {})));
    return this;
  }
  // gain automation breakpoints [[beat, dB], ...] (linear in dB); applied periodically in the loop
  automate(points) { this.auto = points.slice().sort((a, b) => a[0] - b[0]); return this; }
}

class Song {
  constructor(o = {}) {
    this.o = Object.assign({
      id: 'song', bpm: 100, meter: 4, introBars: 0, loopBars: 8, loop: true, tailSec: 6.5, seed: 1,
      target: -18, ceiling: -2.3, hp: 28, master: {}, tempo: null, type: 'bgm', oneShotTail: 3, prePad: 0.5,
    }, o);
    this.parts = []; this.buses = []; this.beds = [];
    this.meter = this.o.meter;
  }
  bar(n) { return n * this.o.meter; }
  part(name, inst, o) { const p = new Part(this, name, inst, o); this.parts.push(p); return p; }
  bus(name, o) { this.buses.push(Object.assign({ name, type: 'reverb', ret: 0, sends: {} }, o)); return this; }
  // periodic bed: gen(nSamples, rng) -> {L,R} of exactly one loop period
  bed(name, gen, o = {}) { this.beds.push(Object.assign({ name, gen, gain: 0, sends: {}, fx: [] }, o)); return this; }
}

// ---------------------------------------------------------------- timing
function makeClock(song) {
  const o = song.o;
  const introBeats = o.introBars * o.meter, loopBeats = o.loopBars * o.meter;
  if (!o.tempo) {
    const spb = 60 / o.bpm;
    return { introBeats, loopBeats, t: (b) => b * spb, spb };
  }
  // tempo map: integrate 60/bpm(b) with fine steps, from -introBeats
  const step = 1 / 96;
  const b0 = -introBeats, nSteps = Math.ceil((loopBeats * 2 - b0) / step) + 2;
  const tab = new Float64Array(nSteps + 1);
  for (let i = 1; i <= nSteps; i++) { const b = b0 + (i - 0.5) * step; const bl = b >= loopBeats ? b - loopBeats : b; tab[i] = tab[i - 1] + step * 60 / o.tempo(bl); }
  const zeroIdx = Math.round(-b0 / step);
  const t = (b) => { const x = (b - b0) / step; const i = Math.floor(x); const f = x - i; const a = tab[Math.max(0, Math.min(nSteps, i))], c = tab[Math.max(0, Math.min(nSteps, i + 1))]; return a + (c - a) * f - tab[zeroIdx]; };
  return { introBeats, loopBeats, t, spb: 60 / o.bpm };
}

function applyFx(L, R, fxList, ctx) {
  for (const f of fxList || []) {
    switch (f.type) {
      case 'eq': C.eqBuf(L, f.specs); C.eqBuf(R, f.specs); break;
      case 'lp': new C.Biquad('lp', f.f, f.q || 0.7071).run(L); new C.Biquad('lp', f.f, f.q || 0.7071).run(R); break;
      case 'hp': new C.Biquad('hp', f.f, f.q || 0.7071).run(L); new C.Biquad('hp', f.f, f.q || 0.7071).run(R); break;
      case 'chorus': FX.chorus(L, R, Object.assign({ t0: ctx.t0, period: ctx.period }, f)); break;
      case 'wow': FX.wow(L, R, Object.assign({ t0: ctx.t0, period: ctx.period }, f)); break;
      case 'autopan': FX.autopan(L, R, Object.assign({ t0: ctx.t0, period: ctx.period }, f)); break;
      case 'sat': FX.saturate(L, f.drive || 1.5, f.mix === undefined ? 1 : f.mix, f.asym || 0); FX.saturate(R, f.drive || 1.5, f.mix === undefined ? 1 : f.mix, f.asym || 0); break;
      case 'comp': FX.compress(L, R, f); break;
      case 'width': { const w = f.w; for (let i = 0; i < L.length; i++) { const m = (L[i] + R[i]) * 0.5, s = (L[i] - R[i]) * 0.5 * w; L[i] = m + s; R[i] = m - s; } break; }
      case 'delay': { const d = FX.delay(L, R, f); const mix = f.mix === undefined ? 0.25 : f.mix; for (let i = 0; i < L.length; i++) { L[i] += d.L[i] * mix; R[i] += d.R[i] * mix; } break; }
      case 'crush': { // gentle bit/sample-rate reduction for chip flavour
        const hold = f.hold || 2, bits = f.bits || 10; const q = Math.pow(2, bits - 1);
        for (const B of [L, R]) { let v = 0; for (let i = 0; i < B.length; i++) { if (i % hold === 0) v = Math.round(B[i] * q) / q; B[i] = B[i] * (1 - (f.mix || 0.5)) + v * (f.mix || 0.5); } }
        break;
      }
      case 'gate': break;
      default: throw new Error('unknown fx ' + f.type);
    }
  }
}

// ---------------------------------------------------------------- render
function render(song, opts = {}) {
  const o = song.o;
  const clk = makeClock(song);
  const loop = o.loop;
  const prePadS = Math.round(o.prePad * SR);
  const introSec = -clk.t(-clk.introBeats);
  const introS = Math.round(introSec * SR);
  const loopSec = clk.t(clk.loopBeats);
  const Ls = Math.round(loopSec * SR);
  const loopStartS = prePadS + introS; // timeline sample of loop beat 0
  const barSec = clk.t(o.meter) - clk.t(0);
  const tailBars = loop ? Math.max(1, Math.ceil(o.tailSec / barSec)) : 0;
  const Dbeats = tailBars * o.meter;
  const Ds = loop ? Math.round((clk.t(Dbeats)) * SR) : 0;
  if (loop && Ds >= Ls) throw new Error('loop too short for tail');
  const total = loop ? loopStartS + Ls + Ds + Math.round(0.3 * SR) : loopStartS + Ls + Math.round(o.oneShotTail * SR);
  const period = loop ? Ls / SR : 0;
  const t0 = loopStartS / SR;
  const ctx = { t0, period };
  const mL = zeros(total), mR = zeros(total);
  const busIn = {}; for (const b of song.buses) busIn[b.name] = { L: zeros(total), R: zeros(total) };
  const rootRng = new RNG(o.seed);
  const log = [];
  let maxEnd = 0;
  const partLU = [];

  // sample position of a beat for a given pass
  const posOf = (b, pass) => loopStartS + Math.round(clk.t(b) * SR) + pass * Ls;

  for (const part of song.parts) {
    if (part.o.mute) continue;
    const pL = zeros(total), pR = zeros(total);
    const po = part.o;
    // build schedule
    const sched = [];
    part.events.forEach((ev, idx) => {
      const hr = new RNG(seedOf(o.seed, part.name, idx));
      let b = ev.b;
      if (po.swing) b = T.swingBeat(b, po.swing, po.swingUnit);
      const ht = (ev.noHuman ? 0 : hr.gauss(0, (po.humanize.t || 0) / 1000));
      const hv = ev.noHuman ? 1 : 1 + hr.gauss(0, po.humanize.v || 0);
      const vel = clamp(ev.v * hv, 0.03, 1);
      const legBeats = ev.d * (ev.leg === undefined ? 0.95 : ev.leg);
      const gate = Math.max(0.01, clk.t(b + legBeats) - clk.t(b) + (ev.gateAdd || 0));
      const seed = seedOf(o.seed, part.name, idx, 'n');
      const ms = Array.isArray(ev.m) ? ev.m : [ev.m];
      const passes = [];
      if (ev.b < 0) passes.push(0);
      else { passes.push(0); if (loop && clk.t(ev.b) < clk.t(Dbeats) + 0.25) passes.push(1); }
      if (!loop && ev.b >= clk.loopBeats + 1e-9) {} // one-shots: allow events beyond "loop" region too
      ms.forEach((m, k) => {
        for (const pass of passes) {
          const s = posOf(b, pass) + Math.round((ht + (ev.dt || 0)) * SR);
          sched.push({ s, m, f: ev.f, dur: gate, vel, seed: seedOf(seed, k), p: ev.p, pan: ev.pan, key: idx + ':' + k, slur: ev.leg > 1.0, gain: ev.g, p1: pass === 0 && ev.b >= 0 });
        }
      });
    });
    sched.sort((a, b) => a.s - b.s);
    if (part.inst.phrase) {
      // group into mono phrases
      let cur = [];
      const flush = () => {
        if (!cur.length) return;
        const s0 = cur[0].s;
        const notes = cur.map((x, i) => ({ t: (x.s - s0) / SR, dur: x.dur, f: x.f || C.mtof(x.m), vel: x.vel, seed: x.seed, slur: i > 0 && (cur[i - 1].slur || (x.s - (cur[i - 1].s + cur[i - 1].dur * SR)) < 0.005 * SR) }));
        const buf = part.inst.renderPhrase(notes);
        const pan = po.pan;
        const [gl, gr] = C.panGains(pan);
        C.addInto(pL, buf, s0, gl * Math.SQRT2); C.addInto(pR, buf, s0, gr * Math.SQRT2);
        if (cur[cur.length - 1].p1) maxEnd = Math.max(maxEnd, s0 + buf.length);
        cur = [];
      };
      for (const x of sched) {
        if (cur.length) {
          const prev = cur[cur.length - 1];
          const gap = x.s - (prev.s + prev.dur * SR);
          if (gap > po.phraseGap * SR && !prev.slur) flush();
        }
        cur.push(x);
      }
      flush();
    } else {
      const cache = new Map();
      for (let i = 0; i < sched.length; i++) {
        const x = sched[i];
        let buf = cache.get(x.key);
        if (!buf) { buf = part.inst.render({ m: x.m, f: x.f, dur: x.dur, vel: x.vel, seed: x.seed, p: x.p }); cache.set(x.key, buf); }
        let L = buf.L || buf, R = buf.R || null;
        // choke (monophonic per pitch or fully mono)
        if (po.choke) {
          let nextS = -1;
          for (let j = i + 1; j < sched.length; j++) {
            if (sched[j].s <= x.s) continue;
            if (po.choke === 'mono' || sched[j].m === x.m) { nextS = sched[j].s; break; }
          }
          if (nextS > 0 && nextS - x.s < L.length) {
            const cut = nextS - x.s, fade = Math.round(po.chokeFade * SR);
            const cutBuf = (b) => { const o2 = b.slice(0, Math.min(b.length, cut + fade)); for (let k = 0; k < fade && cut + k < o2.length; k++) o2[cut + k] *= 1 - k / fade; return o2; };
            L = cutBuf(L); if (R) R = cutBuf(R);
          }
        }
        const pan = clamp(po.pan + (x.pan || 0), -1, 1);
        const g = x.gain === undefined ? 1 : x.gain;
        if (R) {
          // stereo source: balance pan
          const gl = pan > 0 ? 1 - pan : 1, gr = pan < 0 ? 1 + pan : 1;
          C.addInto(pL, L, x.s, gl * g); C.addInto(pR, R, x.s, gr * g);
        } else {
          const [gl, gr] = C.panGains(pan);
          C.addInto(pL, L, x.s, gl * Math.SQRT2 * g); C.addInto(pR, L, x.s, gr * Math.SQRT2 * g);
        }
        if (x.p1) maxEnd = Math.max(maxEnd, x.s + L.length);
      }
    }
    // automation (periodic in loop)
    if (part.auto) applyAuto(pL, pR, part.auto, clk, loopStartS, Ls, loop, total);
    applyFx(pL, pR, po.fx, ctx);
    const g = dbToGain(po.gain);
    for (let i = 0; i < total; i++) { mL[i] += pL[i] * g; mR[i] += pR[i] * g; }
    if (o.partStats !== false) {
      const a = loop ? loopStartS : prePadS, e = loop ? loopStartS + Ls : total;
      const lu = LU.integrated([pL, pR], a, e) + 20 * Math.log10(g);
      partLU.push([part.name, lu]);
    }
    for (const [bn, db] of Object.entries(po.sends)) {
      if (!busIn[bn]) throw new Error('no bus ' + bn);
      const sg = g * dbToGain(db); const B = busIn[bn];
      for (let i = 0; i < total; i++) { B.L[i] += pL[i] * sg; B.R[i] += pR[i] * sg; }
    }
    log.push(part.name);
  }
  // beds
  for (const bed of song.beds) {
    const n = loop ? Ls : total;
    const buf = bed.gen(n, new RNG(seedOf(o.seed, 'bed', bed.name)), { period: n / SR });
    const pL = zeros(total), pR = zeros(total);
    for (let i = 0; i < total; i++) {
      const k = loop ? (((i - loopStartS) % Ls) + Ls) % Ls : i;
      if (k < buf.L.length) { pL[i] = buf.L[k]; pR[i] = buf.R[k]; }
    }
    if (bed.auto) applyAuto(pL, pR, bed.auto, clk, loopStartS, Ls, loop, total);
    applyFx(pL, pR, bed.fx, ctx);
    const g = dbToGain(bed.gain);
    for (let i = 0; i < total; i++) { mL[i] += pL[i] * g; mR[i] += pR[i] * g; }
    for (const [bn, db] of Object.entries(bed.sends || {})) { const sg = g * dbToGain(db); const B = busIn[bn]; for (let i = 0; i < total; i++) { B.L[i] += pL[i] * sg; B.R[i] += pR[i] * sg; } }
  }
  // buses in dependency order (a bus that sends into another bus is processed first)
  const order = [], seen = new Set();
  const visit = (b, stack = new Set()) => {
    if (seen.has(b.name)) return;
    if (stack.has(b.name)) throw new Error('bus cycle at ' + b.name);
    stack.add(b.name);
    // every bus that sends into b must come first
    for (const o2 of song.buses) if (o2.sends && o2.sends[b.name] !== undefined) visit(o2, stack);
    seen.add(b.name); order.push(b);
  };
  for (const b of song.buses) visit(b);
  for (const bus of order) {
    const inp = busIn[bus.name];
    let wet;
    if (bus.type === 'reverb') wet = FX.reverb(inp.L, inp.R, bus, total);
    else if (bus.type === 'delay') wet = FX.delay(inp.L, inp.R, bus);
    else throw new Error('bus type ' + bus.type);
    if (bus.fx) applyFx(wet.L, wet.R, bus.fx, ctx);
    const g = dbToGain(bus.ret || 0);
    for (let i = 0; i < total; i++) { mL[i] += wet.L[i] * g; mR[i] += wet.R[i] * g; }
    for (const [bn, db] of Object.entries(bus.sends || {})) { const sg = g * dbToGain(db); const B = busIn[bn]; for (let i = 0; i < total; i++) { B.L[i] += wet.L[i] * sg; B.R[i] += wet.R[i] * sg; } }
    busIn[bus.name] = null;
  }
  // master chain
  const mo = o.master || {};
  if (o.hp) { for (const B of [mL, mR]) { new C.Biquad('hp', o.hp, 0.7071).run(B); } }
  if (mo.eq) { C.eqBuf(mL, mo.eq); C.eqBuf(mR, mo.eq); }
  if (mo.wow) FX.wow(mL, mR, Object.assign({ t0, period }, mo.wow));
  if (mo.lp) { new C.Biquad('lp', mo.lp, 0.7071).run(mL); new C.Biquad('lp', mo.lp, 0.7071).run(mR); }
  if (mo.sat) { FX.saturate(mL, mo.sat, 1); FX.saturate(mR, mo.sat, 1); }
  if (mo.comp) FX.compress(mL, mR, mo.comp);
  if (mo.width !== undefined) applyFx(mL, mR, [{ type: 'width', w: mo.width }], ctx);

  // window extraction helper
  let startS, loopStartOut, loopEndOut;
  const extract = (L, R) => {
    if (!loop) {
      // one-shot: from musical 0 (or earlier if content) to tail end
      let s0 = prePadS; for (let i = 0; i < prePadS; i++) if (Math.abs(L[i]) > 1e-5 || Math.abs(R[i]) > 1e-5) { s0 = i; break; }
      let e = total; const thr = 5e-4 * Math.max(C.peakOf(L), C.peakOf(R));
      while (e > s0 + 1 && Math.abs(L[e - 1]) < thr && Math.abs(R[e - 1]) < thr) e--;
      e = Math.min(total, e + Math.round(0.02 * SR));
      let fo = 0.03;
      if (o.maxDur && e - s0 > o.maxDur * SR) { e = s0 + Math.round(o.maxDur * SR); fo = o.fadeOut || 0.5; }
      const oL = L.slice(s0, e), oR = R.slice(s0, e);
      C.fadeOut(oL, Math.min(Math.round(fo * SR), oL.length)); C.fadeOut(oR, Math.min(Math.round(fo * SR), oR.length));
      startS = s0; return { L: oL, R: oR, ls: 0, le: 0 };
    }
    if (clk.introBeats > 0) {
      const s0 = prePadS, e = loopStartS + Ls + Ds;
      return { L: L.slice(s0, e), R: R.slice(s0, e), ls: loopStartS + Ds - s0, le: loopStartS + Ds + Ls - s0 };
    }
    const oL = zeros(Ls), oR = zeros(Ls);
    oL.set(L.subarray(loopStartS + Ls, loopStartS + Ls + Ds), 0); oR.set(R.subarray(loopStartS + Ls, loopStartS + Ls + Ds), 0);
    oL.set(L.subarray(loopStartS + Ds, loopStartS + Ls), Ds); oR.set(R.subarray(loopStartS + Ds, loopStartS + Ls), Ds);
    return { L: oL, R: oR, ls: 0, le: Ls };
  };
  // loudness normalisation with limiter iterations
  let w = extract(mL, mR);
  const measure = (x) => (loop ? LU.integrated([x.L, x.R], x.ls, x.le) : LU.integrated([x.L, x.R]));
  let lufs = measure(w);
  const partRel = partLU.map(([n, l]) => n + ':' + (l - lufs).toFixed(1));
  let gain = dbToGain(o.target - lufs);
  let outL, outR, gr = 0;
  for (let it = 0; it < 3; it++) {
    outL = Float32Array.from(mL, (v) => v * gain); outR = Float32Array.from(mR, (v) => v * gain);
    gr = FX.limiter(outL, outR, { ceiling: o.ceiling, lookahead: 0.004, release: o.limRelease || 0.09 });
    w = extract(outL, outR);
    const l2 = measure(w);
    const err = o.target - l2;
    if (Math.abs(err) < 0.15) break;
    gain *= dbToGain(err);
  }
  const final = w;
  // definitive seam test: the steady state must be identical in pass 1 and pass 2 at offset D
  let seamErrDb = null;
  if (loop) {
    let dmax = 0, pk = 1e-9;
    for (let k = -3000; k < 3000; k++) {
      const a = loopStartS + Ds + k, b = a + Ls;
      if (a < 0 || b >= total) continue;
      dmax = Math.max(dmax, Math.abs(outL[a] - outL[b]), Math.abs(outR[a] - outR[b]));
      pk = Math.max(pk, Math.abs(outL[a]), Math.abs(outR[a]));
    }
    seamErrDb = 20 * Math.log10(dmax / pk + 1e-12);
  }
  const stats = {
    seamErrDb, lufs: measure(final), tp: LU.truePeak([final.L, final.R]), peak: LU.samplePeakDb([final.L, final.R]), limiterGR: gr,
  };
  // DC
  let dcL = 0, dcR = 0; for (let i = 0; i < final.L.length; i++) { dcL += final.L[i]; dcR += final.R[i]; }
  stats.dc = Math.max(Math.abs(dcL), Math.abs(dcR)) / final.L.length;
  if (loop) {
    const guard = maxEnd - (loopStartS + Ls);
    let irMax = 0; for (const b of song.buses) if (b.type === 'reverb') irMax = Math.max(irMax, b.len || Math.min(8, (b.t60 || 2.2) * 1.25 + (b.predelay || 0.02) + 0.1));
    stats.tailOver = guard / SR; stats.irMax = irMax; stats.D = Ds / SR;
    if (guard / SR + irMax * 0.8 > Ds / SR) log.push('WARNING: note tail ' + (guard / SR).toFixed(2) + 's + reverb ' + irMax.toFixed(2) + 's may exceed D=' + (Ds / SR).toFixed(2));
  }
  return {
    L: final.L, R: final.R, loop, loopStart: final.ls / SR, loopEnd: final.le / SR, duration: final.L.length / SR,
    loopStartS: final.ls, loopEndS: final.le, stats, log, partRel,
  };
}

function applyAuto(L, R, pts, clk, loopStartS, Ls, loop, total) {
  // precompute gain per sample using beat mapping (periodic in the loop)
  const introStartS = loopStartS - Math.round(-clk.t(-clk.introBeats) * SR);
  // build time->dB table from beats
  const tp = pts.map(([b, db]) => [clk.t(b), db]);
  const dbAt = (tsec) => {
    if (tsec <= tp[0][0]) return tp[0][1];
    for (let k = 0; k < tp.length - 1; k++) if (tsec < tp[k + 1][0]) { const f = (tsec - tp[k][0]) / (tp[k + 1][0] - tp[k][0]); return tp[k][1] + (tp[k + 1][1] - tp[k][1]) * f; }
    return tp[tp.length - 1][1];
  };
  let lastK = -2, gA = 1, gB = 1;
  for (let i = 0; i < total; i++) {
    let rel = i - loopStartS;
    if (loop && rel >= Ls) rel -= Ls;
    const k = Math.floor(rel / 64);
    if (k !== lastK) { lastK = k; gA = dbToGain(dbAt(k * 64 / SR)); gB = dbToGain(dbAt((k + 1) * 64 / SR)); }
    const f = (rel - k * 64) / 64;
    const g = gA + (gB - gA) * f;
    L[i] *= g; R[i] *= g;
  }
  void introStartS;
}

module.exports = { Song, Part, render, makeClock };
