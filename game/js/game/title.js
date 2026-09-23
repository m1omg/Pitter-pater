'use strict';
// ---------------------------------------------------------------------------
// Title screen
// ---------------------------------------------------------------------------
class TitleScene {
  constructor() {
    this.t = 0;
    this.index = 0;
    this.started = false;
    this.drops = [];
    this.opts = null;
    this.busy = false;
  }
  enter() {
    Title.t = 0;
    this.index = State.anySave() ? 1 : 0;
  }
  items() { return ['NEW GAME', 'CONTINUE', 'OPTIONS']; }
  update() {
    this.t++; Title.t = this.t;
    // rain
    for (let i = 0; i < 3; i++) this.drops.push({ x: Math.random() * (Game.W + 200) - 100, y: -20, vy: 9 + Math.random() * 5, len: 10 + Math.random() * 12, ground: 300 + Math.random() * 420 });
    for (const d of this.drops) { if (d.splash) d.splash++; else { d.y += d.vy; d.x -= 1.2; if (d.y > d.ground) d.splash = 1; } }
    this.drops = this.drops.filter((d) => !d.splash || d.splash < 12);
    if (this.busy || Game.overlays.length) return;
    if (!this.started) {
      if (Input.isPressed('ok') || Input.isPressed('cancel') || Input.anyKeyThisFrame) {
        Input.anyKeyThisFrame = false;
        this.started = true;
        this.startT = this.t;
        Sound.sfx('sfx_confirm');
        Sound.playBgm('bgm_title');
        Sound.playAmb('amb_rain_light', { volume: 0.5 });
      }
      return;
    }
    if (this.opts) { this.opts.update(); return; }
    const n = this.items().length;
    if (Input.tapSelect(this, Input.rowHits(n, Game.W / 2 - 140, 483, 280, 50))) return;
    if (Input.repeat('up')) { this.index = (this.index + n - 1) % n; Sound.sfx('sfx_cursor', { volume: 0.5 }); }
    if (Input.repeat('down')) { this.index = (this.index + 1) % n; Sound.sfx('sfx_cursor', { volume: 0.5 }); }
    if (Input.isPressed('ok')) this.select();
  }
  async select() {
    const it = this.items()[this.index];
    if (it === 'NEW GAME') {
      if (State.anySave()) {
        const i = await choose(['Start a new story', 'Never mind'], { cancel: 1, x: Game.W / 2 - 150, y: 470 });
        if (i !== 0) return;
      }
      Sound.sfx('sfx_confirm');
      this.busy = true;
      Sound.stopBgm(2); Sound.stopAmb(2);
      await Game.fadeOut(60);
      State.newGame();
      Game.playTime = 0;
      Story.newGame();
    } else if (it === 'CONTINUE') {
      if (!State.anySave()) { Sound.sfx('sfx_buzzer'); return; }
      Sound.sfx('sfx_confirm');
      const slot = await SaveMenu.open('load');
      if (!slot) return;
      this.busy = true;
      Sound.stopBgm(1.5); Sound.stopAmb(1.5);
      await Game.fadeOut(40);
      State.load(slot);
      Game.playTime = State.d.playTime || 0;
      Story.resume();
    } else if (it === 'OPTIONS') {
      Sound.sfx('sfx_confirm');
      this.opts = new OptionsPanel(null, () => { this.opts = null; });
    }
  }
  draw(ctx) {
    const img = Assets.get('cg_title');
    if (img) {
      const s = Math.max(Game.W / img.width, Game.H / img.height);
      const pan = Math.sin(this.t * 0.002) * 10;
      ctx.drawImage(img, (Game.W - img.width * s) / 2 + pan, (Game.H - img.height * s) / 2, img.width * s, img.height * s);
      ctx.fillStyle = 'rgba(30,24,50,0.18)'; ctx.fillRect(0, 0, Game.W, Game.H);
    } else this.drawFallback(ctx);
    // rain
    ctx.save();
    ctx.strokeStyle = 'rgba(210,225,255,0.6)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    for (const d of this.drops) {
      if (d.splash) { ctx.globalAlpha = 1 - d.splash / 12; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.splash, d.splash * 0.35, 0, 0, Math.PI * 2); ctx.stroke(); }
      else { ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 1.8, d.y - d.len); ctx.stroke(); }
    }
    ctx.restore();
    Gfx.vignette(ctx, 0.45);
    // logo
    const logo = Assets.get('title_logo');
    const bob = Math.sin(this.t * 0.03) * 4;
    if (logo) {
      const w = 560, h = w * logo.height / logo.width;
      ctx.drawImage(logo, Game.W / 2 - w / 2, 40 + bob, w, h);
    } else {
      Gfx.text(ctx, 'PITTER-PATTER', Game.W / 2, 150 + bob, { size: 84, font: Gfx.BOLD, align: 'center', color: '#fff4e0', outline: '#3a2a40', outlineWidth: 12 });
      Gfx.text(ctx, 'a little story about rain', Game.W / 2, 196 + bob, { size: 28, align: 'center', color: '#fff4e0', outline: '#3a2a40', outlineWidth: 6 });
    }
    if (!this.started) {
      const a = 0.5 + Math.sin(this.t * 0.06) * 0.5;
      Gfx.text(ctx, Input.hint('start'), Game.W / 2, 610, { size: 30, align: 'center', color: '#fff8ec', alpha: a, outline: '#3a2a40', outlineWidth: 6 });
      Gfx.text(ctx, Input.hint('line'), Game.W / 2, 700, { size: 18, align: 'center', color: '#d9d2e6', alpha: 0.8 });
      return;
    }
    const a = Math.min(1, (this.t - this.startT) / 30);
    ctx.globalAlpha = a;
    const items = this.items();
    const w = 280, h = items.length * 50 + 30, x = Game.W / 2 - w / 2, y = 470;
    Gfx.box(ctx, x, y, w, h, { fill: '#fff8ecee' });
    items.forEach((s, i) => {
      const yy = y + 16 + i * 50;
      const dis = s === 'CONTINUE' && !State.anySave();
      if (i === this.index) { Gfx.roundRect(ctx, x + 14, yy, w - 28, 44, 12); ctx.fillStyle = Gfx.C.select; ctx.fill(); Gfx.cursor(ctx, x + 34, yy + 22, this.t); }
      Gfx.text(ctx, s, x + w / 2 + 10, yy + 33, { size: 30, font: Gfx.BOLD, align: 'center', color: dis ? '#b8aab0' : Gfx.C.ink });
    });
    ctx.globalAlpha = 1;
    if (this.opts) this.opts.draw(ctx);
  }
  drawFallback(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, Game.H);
    g.addColorStop(0, '#39335a'); g.addColorStop(1, '#8a7fa8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, Game.W, Game.H);
    // house silhouette with one lit window
    ctx.fillStyle = '#2a2440';
    ctx.beginPath(); ctx.moveTo(560, 470); ctx.lineTo(700, 360); ctx.lineTo(840, 470); ctx.lineTo(840, 720); ctx.lineTo(560, 720); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd98a'; ctx.fillRect(660, 500, 50, 50);
    // the umbrella girl
    ctx.fillStyle = '#e0483e'; ctx.strokeStyle = '#1d1726'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(330, 470, 110, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff';
    for (const [dx, dy] of [[-60, -40], [-10, -70], [45, -45], [80, -12], [-85, -10]]) { ctx.beginPath(); ctx.arc(330 + dx, 470 + dy, 8, 0, 7); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(330, 470); ctx.lineTo(330, 580); ctx.stroke();
    ctx.fillStyle = '#9fd8c4'; Gfx.roundRect(ctx, 300, 540, 60, 80, 18); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1d1726'; ctx.beginPath(); ctx.arc(330, 520, 30, 0, Math.PI * 2); ctx.fill();
  }
}

const Title = {
  t: 0,
  open() {
    Events.running = 0;
    Game.overlays.length = 0;
    Input.clear();
    Sound.stopAmb(1);
    Game.fadeA = 0;
    MapScene.lastArea = null;
    Game.setScene(new TitleScene());
  },
};
window.Title = Title; window.TitleScene = TitleScene;
