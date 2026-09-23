'use strict';
// ---------------------------------------------------------------------------
// Audio: Web Audio playback of base64-embedded Ogg files (works from file://).
// Audio files are JS scripts calling AUDIO_DB.add(id, {data, loopStart, loopEnd, loop}).
// ---------------------------------------------------------------------------
window.AUDIO_DB = {
  entries: {},
  add(id, entry) { this.entries[id] = entry; },
};

const Sound = {
  ctx: null,
  master: null, bgmBus: null, ambBus: null, sfxBus: null, bgmFilter: null,
  buffers: {},
  loading: {},
  scripts: {},
  volumes: { master: 0.8, bgm: 0.7, sfx: 0.8 },
  bgm: null,          // {id, src, gain, startedAt, offset, buffer, volume}
  amb: null,
  memory: null,       // remembered bgm for resume after battles
  unlocked: false,

  init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      try { this.ctx = new AC({ sampleRate: 44100 }); } catch (e) { this.ctx = new AC(); }
    } catch (e) { this.ctx = null; return; }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.connect(c.destination);
    this.bgmFilter = c.createBiquadFilter();
    this.bgmFilter.type = 'lowpass';
    this.bgmFilter.frequency.value = 20000;
    this.bgmFilter.Q.value = 0.5;
    this.bgmBus = c.createGain();
    this.bgmBus.connect(this.bgmFilter);
    this.bgmFilter.connect(this.master);
    this.ambBus = c.createGain();
    this.ambBus.connect(this.master);
    this.sfxBus = c.createGain();
    this.sfxBus.connect(this.master);
    this.applyVolumes();
    const unlock = () => {
      if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
      this.unlocked = true;
    };
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('touchend', unlock);   // iOS only unlocks audio on touchend/click
    window.addEventListener('click', unlock);
    window.addEventListener('gamepadconnected', unlock);
    // the game loop stops in hidden tabs, so pause the music with it
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend().catch(() => {});
      else if (this.unlocked) this.ctx.resume().catch(() => {});
    });
  },

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.volumes.master;
    this.bgmBus.gain.value = this.volumes.bgm;
    this.ambBus.gain.value = this.volumes.bgm;
    this.sfxBus.gain.value = this.volumes.sfx;
  },

  has(id) { return !!(window.AUDIO_MANIFEST && window.AUDIO_MANIFEST[id]); },

  loadScript(file) {
    if (this.scripts[file]) return this.scripts[file];
    this.scripts[file] = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'audio/' + file;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
    return this.scripts[file];
  },

  _decode(id) {
    const e = AUDIO_DB.entries[id];
    if (!e || !e.data || !this.ctx) return Promise.resolve(null);
    const bin = atob(e.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    // keep the (small, compressed) base64 so evicted music can be decoded again
    return new Promise((resolve) => {
      try {
        const p = this.ctx.decodeAudioData(bytes.buffer, (buf) => resolve(buf), () => resolve(null));
        if (p && p.catch) p.catch(() => resolve(null));
      } catch (err) { resolve(null); }
    });
  },

  load(id) {
    if (!this.ctx || !id) return Promise.resolve(null);
    if (this.buffers[id]) { this._touch(id); return Promise.resolve(this.buffers[id]); }
    if (this.loading[id]) return this.loading[id];
    const meta = window.AUDIO_MANIFEST && window.AUDIO_MANIFEST[id];
    if (!meta) return Promise.resolve(null);
    this.loading[id] = this.loadScript(meta.file).then(async (ok) => {
      if (!ok) return null;
      // a pack may contain many ids; decode just this one
      const buf = await this._decode(id);
      delete this.loading[id];
      if (buf) { this.buffers[id] = buf; this._touch(id); }
      return buf;
    });
    return this.loading[id];
  },

  // Decoded music is big (~25 MB per minute of stereo float). Keep only a few.
  lru: [],
  pinned: { bgm_battle: true },
  _touch(id) {
    const m = this.meta(id);
    if (m.type !== 'bgm' && m.type !== 'amb') return;
    this.lru = this.lru.filter((x) => x !== id);
    this.lru.push(id);
    let excess = this.lru.length - 6;
    for (let i = 0; i < this.lru.length && excess > 0; i++) {
      const old = this.lru[i];
      const inUse = (this.bgm && this.bgm.id === old) || (this.amb && this.amb.id === old) || (this.memory && this.memory.id === old) || this.pinned[old] || old === id;
      if (inUse) continue;
      delete this.buffers[old];
      this.lru.splice(i, 1); i--; excess--;
    }
  },

  // Preload every sfx contained in the sfx pack.
  async preloadSfx() {
    if (!this.ctx || !window.AUDIO_MANIFEST) return;
    const ids = Object.keys(AUDIO_MANIFEST).filter((k) => AUDIO_MANIFEST[k].type === 'sfx' || AUDIO_MANIFEST[k].type === 'jingle');
    await Promise.all(ids.map((id) => this.load(id)));
  },

  meta(id) { return (window.AUDIO_MANIFEST && AUDIO_MANIFEST[id]) || {}; },

  _startLoop(id, buffer, bus, volume, offset, fadeIn) {
    const c = this.ctx;
    const meta = Object.assign({}, this.meta(id), AUDIO_DB.entries[id] ? { loopStart: AUDIO_DB.entries[id].loopStart, loopEnd: AUDIO_DB.entries[id].loopEnd, loop: AUDIO_DB.entries[id].loop } : {});
    const src = c.createBufferSource();
    src.buffer = buffer;
    const loop = meta.loop !== false;
    src.loop = loop;
    let ls = +meta.loopStart || 0, le = +meta.loopEnd || 0;
    if (loop && le > ls && le <= buffer.duration + 0.001) {
      src.loopStart = ls; src.loopEnd = Math.min(le, buffer.duration);
    } else { ls = 0; le = buffer.duration; }
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(g); g.connect(bus);
    const now = c.currentTime;
    if (fadeIn > 0) { g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(volume, now + fadeIn); }
    else g.gain.value = volume;
    offset = offset || 0;
    if (offset >= buffer.duration) offset = ls;
    src.start(now, offset);
    return { id, src, gain: g, startedAt: now, offset, buffer, volume, ls, le, loop };
  },

  _position(ch) {
    if (!ch || !this.ctx) return 0;
    let t = ch.offset + (this.ctx.currentTime - ch.startedAt);
    if (ch.loop && t > ch.le) {
      const len = ch.le - ch.ls;
      if (len > 0) t = ch.ls + ((t - ch.ls) % len);
    }
    return t;
  },

  _stopChannel(ch, fade) {
    if (!ch || !this.ctx) return;
    const now = this.ctx.currentTime;
    try {
      ch.gain.gain.cancelScheduledValues(now);
      ch.gain.gain.setValueAtTime(ch.gain.gain.value, now);
      ch.gain.gain.linearRampToValueAtTime(0, now + Math.max(0.01, fade));
      ch.src.stop(now + Math.max(0.02, fade) + 0.05);
    } catch (e) { /* already stopped */ }
  },

  async playBgm(id, opts = {}) {
    if (!this.ctx) return;
    const volume = opts.volume != null ? opts.volume : 1;
    if (this.bgm && this.bgm.id === id && !opts.restart) {
      // same track: just adjust volume
      const now = this.ctx.currentTime;
      this.bgm.gain.gain.cancelScheduledValues(now);
      this.bgm.gain.gain.setValueAtTime(this.bgm.gain.gain.value, now);
      this.bgm.gain.gain.linearRampToValueAtTime(volume, now + 0.5);
      this.bgm.volume = volume;
      return;
    }
    this._wantedBgm = id;
    const fade = opts.fade != null ? opts.fade : 0.6;
    if (this.bgm) { this._stopChannel(this.bgm, fade); this.bgm = null; }
    if (!id) return;
    const buf = await this.load(id);
    if (!buf || this._wantedBgm !== id) return;
    if (this.bgm) { this._stopChannel(this.bgm, 0.2); }
    this.bgm = this._startLoop(id, buf, this.bgmBus, volume, opts.offset || 0, opts.fadeIn != null ? opts.fadeIn : 0.4);
  },

  stopBgm(fade = 0.8) {
    this._wantedBgm = null;
    if (this.bgm) { this._stopChannel(this.bgm, fade); this.bgm = null; }
  },

  // remember current bgm (for battle → map)
  rememberBgm() {
    if (this.bgm) this.memory = { id: this.bgm.id, offset: this._position(this.bgm), volume: this.bgm.volume };
    else this.memory = null;
  },
  restoreBgm(fadeIn = 1.0) {
    if (!this.memory) return;
    const m = this.memory;
    this.memory = null;
    this.playBgm(m.id, { offset: m.offset, volume: m.volume, fadeIn, restart: true });
  },

  async playAmb(id, opts = {}) {
    if (!this.ctx) return;
    const volume = opts.volume != null ? opts.volume : 1;
    if (this.amb && this.amb.id === id) {
      const now = this.ctx.currentTime;
      this.amb.gain.gain.cancelScheduledValues(now);
      this.amb.gain.gain.setValueAtTime(this.amb.gain.gain.value, now);
      this.amb.gain.gain.linearRampToValueAtTime(volume, now + 0.8);
      this.amb.volume = volume;
      return;
    }
    this._wantedAmb = id;
    if (this.amb) { this._stopChannel(this.amb, 1.0); this.amb = null; }
    if (!id) return;
    const buf = await this.load(id);
    if (!buf || this._wantedAmb !== id) return;
    this.amb = this._startLoop(id, buf, this.ambBus, volume, Math.random() * buf.duration * 0.8, 1.2);
  },
  stopAmb(fade = 1.0) {
    this._wantedAmb = null;
    if (this.amb) { this._stopChannel(this.amb, fade); this.amb = null; }
  },

  sfx(id, opts = {}) {
    if (!this.ctx || !id) return;
    const buf = this.buffers[id];
    if (!buf) { this.load(id); return; }
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = buf;
    let pitch = opts.pitch || 1;
    if (opts.vary) pitch *= 1 + (Math.random() * 2 - 1) * opts.vary;
    src.playbackRate.value = pitch;
    const g = c.createGain();
    g.gain.value = opts.volume != null ? opts.volume : 1;
    src.connect(g);
    if (opts.pan && c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = U.clamp(opts.pan, -1, 1);
      g.connect(p); p.connect(this.sfxBus);
    } else g.connect(this.sfxBus);
    src.start(c.currentTime + (opts.delay || 0));
    return src;
  },

  // play a jingle while ducking the bgm; resolves when finished
  jingle(id, opts = {}) {
    return new Promise(async (resolve) => {
      if (!this.ctx) return resolve();
      const buf = await this.load(id);
      if (!buf) return resolve();
      const duck = opts.duck != null ? opts.duck : 0.15;
      const now = this.ctx.currentTime;
      if (this.bgm && opts.duck !== false) {
        const g = this.bgm.gain.gain;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(this.bgm.volume * duck, now + 0.15);
        g.setValueAtTime(this.bgm.volume * duck, now + buf.duration);
        g.linearRampToValueAtTime(this.bgm.volume, now + buf.duration + 1.2);
      }
      const src = this.sfx(id, { volume: opts.volume != null ? opts.volume : 1 });
      setTimeout(resolve, buf.duration * 1000);
    });
  },

  muffle(on, time = 0.4) {
    if (!this.ctx) return;
    const f = this.bgmFilter.frequency, now = this.ctx.currentTime;
    f.cancelScheduledValues(now);
    f.setValueAtTime(f.value, now);
    f.exponentialRampToValueAtTime(on ? 700 : 20000, now + time);
  },

  setBgmVolume(v, time = 0.5) {
    if (!this.ctx || !this.bgm) return;
    const now = this.ctx.currentTime, g = this.bgm.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(v, now + time);
    this.bgm.volume = v;
  },
};
window.Sound = Sound;
