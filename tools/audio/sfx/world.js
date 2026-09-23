'use strict';
// World / field sound effects.
const K = require('./_kit');
const { N, SR, mtof } = K;

function norm(buf, p = 1) { const m = K.C.peakOf(buf) || 1; return K.gain(buf, p / m); }
// stick-slip friction creak: jittered impulse train (rate curve, Hz) through wooden resonances
function creak(len, o) {
  const n = N(len); const r = new K.RNG(o.seed || 1);
  const rate = K.fcurve(n, o.rate);
  const src = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    ph += rate[i] * (1 + (o.jit || 0.3) * r.bi()) / SR;
    if (ph >= 1) { ph -= 1; src[i] = 0.55 + 0.45 * r.next(); }
  }
  K.lp(src, o.exLP || 2200); K.lp(src, o.exLP || 2200);
  const res = K.resonate(src, (o.modes || [[330, 14, 1], [690, 12, 0.8], [1180, 10, 0.55], [1950, 9, 0.35], [3100, 7, 0.2]]).map(([f, q, g]) => [f, q * (o.qMul || 1.6), g]));
  K.mul(res, K.ecurve(n, o.env || [[0, 0], [len * 0.15, 1], [len * 0.7, 0.8], [len, 0]]));
  K.hp(res, 150);
  return norm(res);
}
// music-box style note list with same-pitch choke: notes [[t, midi, vel, pan]]
function playChoked(inst, notes, len) {
  const n = N(len); const L = new Float32Array(n), R = new Float32Array(n);
  notes.forEach(([t, m, vel, p = 0], k) => {
    let buf = inst.render({ m, dur: 0.3, vel, seed: 500 + k * 17 });
    buf = buf.L ? buf.L : buf;
    const next = notes.find(([t2, m2], j) => j > k && m2 === m && t2 > t);
    if (next) {
      const cut = N(next[0] - t), fade = N(0.015);
      buf = buf.slice(0, Math.min(buf.length, cut + fade));
      for (let i = 0; i < fade && cut + i < buf.length; i++) buf[cut + i] *= 1 - i / fade;
    }
    const s = K.pan(buf, p);
    K.C.addInto(L, s.L, Math.round(t * SR)); K.C.addInto(R, s.R, Math.round(t * SR));
  });
  return { L, R };
}

module.exports = {
  // door: latch click, short hinge creak, soft wooden close thud + latch
  sfx_door: {
    peak: -5,
    fn() {
      const latch = K.knock(0.06, [[2900, 0.5, 0.025], [4300, 0.35, 0.018], [6100, 0.2, 0.012], [1250, 0.25, 0.03]], { trans: 0.6, tLP: 8000, seed: 3 });
      const cr = creak(0.3, { rate: [[0, 110], [0.12, 170], [0.3, 125]], seed: 5, modes: [[520, 14, 1], [980, 12, 0.7], [1650, 10, 0.45], [2600, 8, 0.25]] });
      const thud = K.knock(0.35, [[92, 1, 0.2], [176, 0.6, 0.14], [305, 0.45, 0.09], [610, 0.22, 0.05], [1150, 0.1, 0.03]], { trans: 0.7, tLP: 1500, tLen: 0.015, seed: 4 });
      const latch2 = K.knock(0.05, [[2700, 0.4, 0.02], [4100, 0.25, 0.014]], { trans: 0.4, tLP: 7000, seed: 6 });
      const dry = K.mixSt(0.95, [[latch, 0, 0.55, 0.2], [cr, 0.05, 0.22, 0.1], [thud, 0.4, 1, 0], [latch2, 0.415, 0.35, 0.1]]);
      return K.verb(dry, { t60: 0.6, wet: 0.2, tail: 0.5 });
    },
  },
  // map transfer: soft airy whoosh sweeping left -> right with a faint breathy tone
  sfx_transfer: {
    peak: -11,
    fn() {
      const len = 0.75, n = N(len);
      const w = K.whoosh(len, [[0, 350], [0.35, 2200], [len, 700]], [[0, 0], [0.3, 1], [len, 0]], 1.1, 23, 'pink');
      const w2 = K.whoosh(len, [[0, 700], [0.4, 3800], [len, 1300]], [[0, 0], [0.35, 0.6], [len, 0]], 2.5, 24, 'white');
      const tone = K.harm(n, K.fcurve(n, [[0, 262], [0.35, 392], [len, 330]]), [[1, 1], [2, 0.25]]);
      K.mul(tone, K.ecurve(n, [[0, 0], [0.3, 1], [len, 0]]));
      const m = K.mix(len, [[norm(w), 0, 1], [norm(w2), 0, 0.3], [tone, 0, 0.06]]);
      K.hp(m, 150);
      return K.verb(K.pan(m, K.curve(n, [[0, -0.6], [len, 0.6]])), { t60: 1.0, wet: 0.25, tail: 0.6 });
    },
  },
  // locked door: handle rattling against the latch
  sfx_locked: {
    peak: -3,
    fn() {
      const times = [0, 0.068, 0.132, 0.21, 0.262], amps = [1, 0.7, 0.9, 0.6, 0.42];
      const r = new K.RNG(31);
      const layers = times.map((t, k) => {
        const j = 1 + r.uni(-0.04, 0.04), j2 = 1 + r.uni(-0.05, 0.05);
        const c = K.knock(0.09, [[1700 * j, 0.5, 0.06], [2900 * j, 0.4, 0.045], [4400 * j, 0.25, 0.03], [260 * j2, 0.9, 0.07], [520 * j2, 0.35, 0.045]], { trans: 0.8, tLP: 6000, seed: 40 + k });
        return [c, t, amps[k], r.uni(-0.25, 0.25)];
      });
      return K.verb(K.mixSt(0.4, layers), { t60: 0.5, wet: 0.16, tail: 0.4 });
    },
  },
  // unlock: key scrape, click, bolt clunk, tiny chime
  sfx_unlock: {
    peak: -4,
    fn() {
      const sn = N(0.13);
      const scr = K.noise(sn, 50); K.bp(scr, 3000, 2);
      const grain = K.noise(sn, 51); K.lp(grain, 60);
      for (let i = 0; i < sn; i++) scr[i] *= 0.4 + 3 * Math.abs(grain[i]);
      K.mul(scr, K.ecurve(sn, [[0, 0], [0.03, 1], [0.13, 0.3]]));
      const click = K.knock(0.08, [[3200, 0.6, 0.05], [5100, 0.35, 0.03], [410, 0.5, 0.04]], { trans: 0.8, tLP: 9000, seed: 52 });
      const clunk = K.knock(0.12, [[1250, 0.5, 0.06], [2300, 0.3, 0.04], [180, 0.9, 0.08]], { trans: 0.6, tLP: 4000, seed: 53 });
      const c1 = K.bell(0.8, mtof(95), K.BELL_GLOCK, 0.45), c2 = K.bell(0.8, mtof(100), K.BELL_GLOCK, 0.5);
      const dry = K.mixSt(1.2, [[norm(scr), 0, 0.22, -0.1], [click, 0.12, 0.9, 0], [clunk, 0.2, 0.9, 0.05], [c1, 0.3, 0.18, -0.2], [c2, 0.37, 0.16, 0.2]]);
      return K.verb(dry, { t60: 0.6, wet: 0.16, tail: 0.5 });
    },
  },
  // push: heavy block grinding across the floor
  sfx_push: {
    peak: -9,
    fn() {
      const len = 0.85, n = N(len);
      const g = K.noise(n, 60, 'brown'); K.lp(g, 900); K.hp(g, 70); K.hp(g, 70);
      const r = new K.RNG(61); const jud = new Float32Array(n);
      let v = 1, next = 0;
      for (let i = 0; i < n; i++) { if (i >= next) { v = 0.5 + 0.5 * r.next(); next = i + N(r.uni(0.012, 0.03)); } jud[i] = v; }
      K.lp(jud, 60);
      K.mul(g, jud); K.pk(g, 180, 1, 6);
      const cr = K.noise(n, 62);
      let on = 0; for (let i = 0; i < n; i++) { if (r.next() < 0.004) on = N(r.uni(0.002, 0.008)); cr[i] *= on > 0 ? 1 : 0.08; on--; }
      K.bp(cr, 2100, 1.4);
      const env = K.ecurve(n, [[0, 0], [0.06, 1], [0.7, 0.85], [len, 0]]);
      const m = new Float32Array(n);
      norm(g); norm(cr);
      const scr = K.noise(n, 63); K.bp(scr, 700, 0.8); K.mul(scr, jud); norm(scr);
      for (let i = 0; i < n; i++) m[i] = (g[i] + cr[i] * 0.22 + scr[i] * 0.25) * env[i];
      const th = K.thump(0.3, 110, 55, 0.03, 0.2);
      K.addAt(m, th, 0, 0.6);
      K.sat(m, 1.6);
      return K.verb(m, { t60: 0.5, wet: 0.12, tail: 0.4, hp: 150 });
    },
  },
  // light switch click: press + release
  sfx_switch: {
    peak: -6,
    fn() {
      const press = K.knock(0.04, [[2200, 0.5, 0.015], [3600, 0.35, 0.01], [5200, 0.2, 0.006]], { trans: 0.9, tLP: 10000, tLen: 0.002, seed: 70 });
      const rel = K.knock(0.04, [[1650, 0.4, 0.012], [2900, 0.25, 0.008]], { trans: 0.5, tLP: 8000, tLen: 0.002, seed: 71 });
      return K.mix(0.08, [[press, 0, 1], [rel, 0.028, 0.45]]);
    },
  },
  // knock-knock on a wooden door
  sfx_knock: {
    peak: -4,
    fn() {
      const hit = (seed, j) => K.knock(0.3, [[185 * j, 1, 0.1], [410 * j, 0.6, 0.08], [760 * j, 0.4, 0.05], [1380, 0.2, 0.03], [2600, 0.08, 0.015]], { trans: 0.6, tLP: 2500, tLen: 0.005, seed });
      const dry = K.mixSt(0.5, [[hit(80, 1), 0, 1, 0], [hit(81, 1.02), 0.18, 0.85, 0]]);
      return K.verb(dry, { t60: 0.5, wet: 0.2, tail: 0.4 });
    },
  },
  // old telephone: two "brrring" rings from a clapper striking two small gongs
  sfx_phone: {
    peak: -8,
    fn() {
      const parts = [[1, 1, 1], [2.08, 0.5, 0.6], [2.76, 0.35, 0.45], [3.94, 0.2, 0.3], [5.3, 0.08, 0.2]];
      const A = K.bell(0.9, 1245, parts, 0.55, { attack: 0.0004 }), B = K.bell(0.9, 1480, parts, 0.5, { attack: 0.0004 });
      const len = 3.3, n = N(len); const out = new Float32Array(n);
      const r = new K.RNG(90);
      const ring = (start, dur) => {
        let t = start, k = 0;
        while (t < start + dur) {
          const e = Math.min(1, (t - start) / 0.03) * Math.min(1, (start + dur - t) / 0.05);
          K.addAt(out, k % 2 ? B : A, t, (0.6 + 0.4 * r.next()) * e);
          t += 1 / (21 + r.bi()); k++;
        }
      };
      ring(0, 0.95); ring(1.7, 0.95);
      K.pk(out, 1500, 0.8, 3); K.lp(out, 7000);
      return K.verb(out, { t60: 0.45, wet: 0.15, tail: 0.4 });
    },
  },
  // heartbeat: lub-dub, saturated for audibility on small speakers
  sfx_heartbeat: {
    peak: -5, hp: 30,
    fn() {
      const lub = K.thump(0.35, 100, 62, 0.03, 0.2, { a: 0.006 });
      const dub = K.thump(0.35, 110, 70, 0.03, 0.17, { a: 0.006 });
      const m = K.mix(0.6, [[lub, 0, 1], [dub, 0.17, 0.75]]);
      K.sat(m, 3.2);
      K.pk(m, 140, 1, 4); K.lp(m, 700); K.hp(m, 40);
      const tick = K.noise(0.02, 101); K.lp(tick, 350); K.mul(tick, K.ad(tick.length, 0.001, 0.015));
      K.addAt(m, tick, 0, 0.15);
      return m;
    },
  },
  // attic floorboard creak
  sfx_creak: {
    peak: -6.5,
    fn() {
      const c1 = creak(0.95, { rate: [[0, 38], [0.3, 72], [0.6, 96], [0.95, 58]], seed: 9, jit: 0.35, modes: [[260, 12, 1], [540, 11, 0.8], [930, 10, 0.55], [1600, 9, 0.35], [2600, 7, 0.2]] });
      const c2 = creak(0.35, { rate: [[0, 120], [0.35, 90]], seed: 10, jit: 0.2, modes: [[610, 14, 1], [1210, 12, 0.6], [2250, 9, 0.3]] });
      const dry = K.mixSt(1.1, [[c1, 0, 1, -0.15], [c2, 0.62, 0.35, 0.2]]);
      return K.verb(dry, { t60: 0.9, wet: 0.25, tail: 0.7 });
    },
  },
  // TV static burst with tearing, crackle and mains hum
  sfx_static: {
    peak: -10,
    fn() {
      const len = 0.65, n = N(len);
      const r = new K.RNG(110);
      const tear = new Float32Array(n); let v = 1, next = 0;
      for (let i = 0; i < n; i++) { if (i >= next) { v = 0.45 + 0.55 * r.next(); next = i + N(r.uni(0.006, 0.025)); } tear[i] = v; }
      K.lp(tear, 400);
      const env = K.ecurve(n, [[0, 0], [0.012, 1], [0.55, 0.9], [len, 0]]);
      const hum = K.osc('saw', n, 60); K.lp(hum, 400);
      const mk = (seed) => {
        const x = K.noise(n, seed); K.lp(x, 9000); K.hp(x, 250);
        const c = K.crackle(len, 600, seed + 1, 3); K.bp(c, 3000, 0.8);
        for (let i = 0; i < n; i++) x[i] = (x[i] * tear[i] + c[i] + hum[i] * 0.07) * env[i];
        return x;
      };
      return { L: mk(111), R: mk(113) };
    },
  },
  // thunder: crack, ripping, long rolling rumble
  sfx_thunder: {
    peak: -3, hp: 20,
    fn() {
      const len = 4.2, n = N(len);
      const crack = K.noise(0.1, 120); K.hp(crack, 900); K.mul(crack, K.ad(crack.length, 0.001, 0.07));
      const rip = K.noise(0.4, 121);
      const gate = K.crackle(0.4, 900, 122, 4); K.lp(gate, 300);
      for (let i = 0; i < rip.length; i++) rip[i] *= 0.3 + Math.abs(gate[i]) * 3;
      const ripF = K.svf(rip, K.fcurve(rip.length, [[0, 3200], [0.4, 600]]), 0.9, 'bandn');
      K.mul(ripF, K.ecurve(rip.length, [[0, 1], [0.4, 0]]));
      const swell = (t) => { const e = [[0.25, 1], [0.85, 0.8], [1.55, 0.65], [2.35, 0.45]]; let v = 0; for (const [c, a] of e) v += a * Math.exp(-Math.pow((t - c) / 0.33, 2)); return v * Math.exp(-t / 2.2) + 0.25 * Math.exp(-t / 1.2); };
      const env = new Float32Array(n); for (let i = 0; i < n; i++) env[i] = swell(i / SR);
      K.ramp(env, 0.02, 0.3);
      const rum = (seed) => {
        const b = K.noise(n, seed, 'brown'); K.lp(b, 220); K.lp(b, 220);
        const m = K.noise(n, seed + 1, 'pink'); K.bp(m, 380, 0.7);
        norm(b); norm(m);
        for (let i = 0; i < n; i++) b[i] = (b[i] + m[i] * 0.35) * env[i];
        return b;
      };
      const L = rum(130), R = rum(140);
      const dry = K.mixSt(len, [[{ L, R }, 0, 1], [crack, 0, 0.8, 0.1], [norm(ripF), 0.02, 0.5, -0.1]]);
      return K.verb(dry, { t60: 2.5, wet: 0.45, tail: 1.5, hp: 60, lp: 5000 });
    },
  },
  // splash: impact, spray, scattered droplets and a bubble bloop
  sfx_splash: {
    peak: -4,
    fn() {
      const len = 0.95;
      const imp = K.noise(0.22, 150, 'pink'); K.bp(imp, 1100, 0.7); K.mul(imp, K.ad(imp.length, 0.002, 0.14));
      const spray = K.noise(0.55, 151); K.hp(spray, 2500);
      const sg = K.noise(spray.length, 152); K.lp(sg, 90);
      for (let i = 0; i < spray.length; i++) spray[i] *= 0.3 + 4 * Math.abs(sg[i]);
      K.mul(spray, K.ad(spray.length, 0.005, 0.35));
      const layers = [[norm(imp), 0, 1, 0], [norm(spray), 0.005, 0.35, 0]];
      const r = new K.RNG(153);
      for (let k = 0; k < 28; k++) {
        const t = 0.03 + 0.55 * Math.pow(r.next(), 1.6);
        const f0 = r.uni(1200, 3800); const dl = r.uni(0.03, 0.07);
        const dn = N(dl + 0.02);
        const d = K.osc('sine', dn, K.fcurve(dn, [[0, f0], [0.012, f0 * r.uni(1.25, 1.6)], [dl + 0.02, f0 * 1.6]]));
        K.mul(d, K.ad(dn, 0.001, dl));
        layers.push([d, t, 0.25 * r.uni(0.3, 1) * (1 - t), r.uni(-0.7, 0.7)]);
      }
      const bn = N(0.1);
      const bloop = K.osc('sine', bn, K.fcurve(bn, [[0, 260], [0.06, 520]])); K.mul(bloop, K.ad(bn, 0.002, 0.08));
      layers.push([bloop, 0.01, 0.5, 0]);
      return K.verb(K.mixSt(len, layers), { t60: 0.7, wet: 0.18, tail: 0.5 });
    },
  },
  // small hand bell "ding"
  sfx_bell: {
    peak: -10,
    fn() {
      const f = 1318.5;
      const a = K.bell(2.6, f, K.BELL_HAND, 2.0, { click: 0.25, clickF: 5000 });
      const b = K.bell(2.6, f * 1.0009, K.BELL_HAND.slice(0, 3), 1.7);
      const dry = K.mixSt(2.6, [[a, 0, 1, -0.05], [b, 0, 0.3, 0.1]]);
      return K.verb(dry, { t60: 1.6, wet: 0.25, tail: 1.2 });
    },
  },
  // music box: first phrase of Pim's theme resolving to F, slight wind-down ritardando
  sfx_music_box: {
    peak: -10.5,
    fn() {
      const box = K.I.modal('musicbox');
      const e = 0.3; // eighth at 100 BPM
      const ts = [0, e, 2 * e, 3 * e, 4 * e, 5 * e + 0.01, 6 * e + 0.03, 8 * e + 0.12];
      const ms = [84, 84, 81, 81, 82, 81, 79, 77];
      const vs = [0.78, 0.66, 0.74, 0.64, 0.72, 0.66, 0.74, 0.8];
      const notes = ts.map((t, k) => [t, ms[k], vs[k], k % 2 ? 0.15 : -0.1]);
      const dry = playChoked(box, notes, 4.2);
      const out = K.verb(dry, { t60: 1.3, wet: 0.25, tail: 0.8 });
      const n = K.N(3.95); const fd = K.ecurve(n, [[0, 1], [3.0, 1], [3.95, 0]]);
      return { L: K.mul(out.L.slice(0, n), fd), R: K.mul(out.R.slice(0, n), fd) };
    },
  },
  // toaster: lever release clunk + spring boing + toast whoosh, then the "ding"
  sfx_toaster: {
    peak: -9.5,
    fn() {
      const lever = K.knock(0.12, [[880, 0.6, 0.06], [1730, 0.45, 0.04], [2650, 0.3, 0.03], [125, 0.7, 0.07]], { trans: 0.8, tLP: 5000, seed: 160 });
      const sn = N(0.35);
      const sf = new Float32Array(sn); for (let i = 0; i < sn; i++) { const t = i / SR; sf[i] = 360 * (1 + 0.15 * Math.exp(-t / 0.08) * Math.sin(2 * Math.PI * 24 * t)); }
      const spring = K.harm(sn, sf, [[1, 1], [2, 0.3], [3, 0.12]]); K.mul(spring, K.ad(sn, 0.001, 0.3));
      const wh = K.whoosh(0.18, [[0, 800], [0.18, 2500]], [[0, 0], [0.04, 1], [0.18, 0]], 1.2, 161);
      const ding = K.bell(1.7, 1760, K.BELL_HAND, 1.2, { click: 0.2, clickF: 6000 });
      const dry = K.mixSt(2.0, [[lever, 0, 0.9, -0.1], [spring, 0.01, 0.22, 0], [norm(wh), 0.02, 0.2, 0.1], [ding, 0.3, 0.75, 0.05]]);
      return K.verb(dry, { t60: 0.7, wet: 0.2, tail: 0.6 });
    },
  },
  // old CRT TV switching on: click, degauss "thoom", static fizz, electronic zing
  sfx_tv_on: {
    peak: -6,
    fn() {
      const click = K.knock(0.04, [[2500, 0.5, 0.015], [4100, 0.3, 0.01]], { trans: 0.9, tLP: 9000, seed: 170 });
      const tn = N(0.6);
      const f = K.fcurve(tn, [[0, 62], [0.6, 55]]);
      const buzz = K.osc('saw', tn, f); const s2 = K.osc('sine', tn, f.map((x) => x * 2));
      for (let i = 0; i < tn; i++) buzz[i] = buzz[i] * 0.6 + s2[i] * 0.5;
      K.lp(buzz, 900); K.hp(buzz, 45); K.sat(buzz, 1.8); K.mul(buzz, K.ad(tn, 0.012, 0.5));
      const st = K.noise(0.6, 171); K.hp(st, 1200); K.lp(st, 7000); K.lp(st, 9000); K.mul(st, K.ecurve(st.length, [[0, 0], [0.08, 1], [0.35, 0.5], [0.6, 0]]));
      const zn = N(0.1); const zing = K.osc('sine', zn, K.fcurve(zn, [[0, 5200], [0.09, 900]])); K.mul(zing, K.ad(zn, 0.001, 0.09));
      const dry = K.mixSt(0.9, [[click, 0, 0.6, 0], [buzz, 0.02, 0.9, 0], [norm(st), 0.05, 0.2, 0], [zing, 0.03, 0.25, 0]]);
      return K.verb(dry, { t60: 0.5, wet: 0.12, tail: 0.4 });
    },
  },
  // cartoon fall: descending slide whistle, then a soft landing thump
  sfx_fall: {
    peak: -6,
    fn() {
      const len = 1.3, wn = N(0.92);
      const base = K.fcurve(wn, [[0, 1350], [0.85, 240]]);
      const vib = new Float32Array(wn); for (let i = 0; i < wn; i++) { const t = i / SR; vib[i] = base[i] * Math.pow(2, (25 * Math.min(1, t / 0.2) * Math.sin(2 * Math.PI * 6 * t)) / 1200); }
      const wh = K.harm(wn, vib, [[1, 1], [2, 0.08], [3, 0.03]]);
      const br = K.svf(K.noise(wn, 180), vib, 6, 'bandn');
      for (let i = 0; i < wn; i++) wh[i] += br[i] * 0.4;
      K.mul(wh, K.ecurve(wn, [[0, 0], [0.03, 1], [0.8, 0.8], [0.92, 0]]));
      const th = K.thump(0.3, 150, 60, 0.03, 0.18);
      const puff = K.noise(0.12, 181, 'pink'); K.lp(puff, 800); K.mul(puff, K.ad(puff.length, 0.002, 0.09));
      const kn = K.knock(0.2, [[140, 0.8, 0.1], [300, 0.4, 0.06]], { trans: 0.4, tLP: 1200, seed: 182 });
      return K.mix(len, [[wh, 0, 0.5], [th, 0.92, 1], [norm(puff), 0.92, 0.35], [kn, 0.92, 0.5]]);
    },
  },
  // umbrella: latch click, fast whoosh, fabric "fwump" snap as the canopy opens
  sfx_umbrella: {
    peak: -3,
    fn() {
      const latch = K.knock(0.03, [[3300, 0.4, 0.012], [5200, 0.2, 0.008]], { trans: 0.6, tLP: 9000, seed: 190 });
      const wh = K.whoosh(0.2, [[0, 250], [0.16, 2600]], [[0, 0], [0.12, 1], [0.2, 0]], 1.0, 191);
      const fw = K.knock(0.22, [[140, 1, 0.09], [260, 0.6, 0.07], [410, 0.35, 0.05]], { trans: 0.9, tLP: 1400, tLen: 0.02, seed: 192 });
      const puff = K.noise(0.1, 193, 'pink'); K.lp(puff, 1200); K.mul(puff, K.ad(puff.length, 0.002, 0.06));
      const pop = K.knock(0.03, [[900, 0.5, 0.015], [1800, 0.2, 0.01]], { trans: 0.3, tLP: 4000, seed: 194 });
      const dry = K.mixSt(0.5, [[latch, 0, 0.35, 0], [norm(wh), 0.01, 0.55, -0.2], [fw, 0.15, 1, 0], [norm(puff), 0.15, 0.4, 0.1], [pop, 0.152, 0.3, 0]]);
      return K.verb(dry, { t60: 0.5, wet: 0.12, tail: 0.35 });
    },
  },
  // rubber toy squeak
  sfx_squeak: {
    peak: -15,
    fn() {
      const len = 0.26, n = N(len);
      const base = K.fcurve(n, [[0, 1450], [0.07, 2150], [0.16, 2000], [len, 1600]]);
      const f = new Float32Array(n); for (let i = 0; i < n; i++) f[i] = base[i] * Math.pow(2, 30 * Math.sin(2 * Math.PI * 31 * i / SR) / 1200);
      const src = K.osc('pulse', n, f, { pw: 0.3 });
      const o = K.formants(src, [{ f: 2400, bw: 500, g: 1 }, { f: 4700, bw: 700, g: 0.3 }]);
      const air = K.noise(n, 200); K.bp(air, 3000, 1.2);
      for (let i = 0; i < n; i++) o[i] = o[i] * 2 + src[i] * 0.15 + air[i] * 0.08;
      K.lp(o, 7000); K.hp(o, 500);
      return K.mul(o, K.ecurve(n, [[0, 0], [0.02, 1], [0.2, 0.8], [len, 0]]));
    },
  },
};
