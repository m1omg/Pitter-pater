'use strict';
// ---------------------------------------------------------------------------
// Cutscene helpers: chapter cards, a blank "stage" scene for CG sequences,
// and the end credits.
// ---------------------------------------------------------------------------
class StageScene {
  constructor(o = {}) { this.bg = o.bg || '#16131a'; this.pictures = []; this.t = 0; this.drawExtra = o.draw || null; this.rain = o.rain || 0; this.drops = []; }
  update() {
    this.t++;
    if (this.rain) {
      for (let i = 0; i < this.rain; i++) this.drops.push({ x: Math.random() * (Game.W + 200) - 100, y: -20, vy: 9 + Math.random() * 5, len: 10 + Math.random() * 12 });
      for (const d of this.drops) { d.y += d.vy; d.x -= 1.2; }
      this.drops = this.drops.filter((d) => d.y < Game.H + 30);
    }
  }
  draw(ctx) {
    ctx.fillStyle = this.bg; ctx.fillRect(0, 0, Game.W, Game.H);
    if (this.drawExtra) this.drawExtra(ctx, this);
    for (const p of this.pictures) drawPicture(ctx, p);
    if (this.drops.length) {
      ctx.save(); ctx.strokeStyle = 'rgba(210,225,255,0.5)'; ctx.lineWidth = 1.5;
      for (const d of this.drops) { ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 1.8, d.y - d.len); ctx.stroke(); }
      ctx.restore();
    }
  }
}

const Cutscene = {
  // full-screen title card: "NIGHT 1" + subtitle
  card(title, sub, o = {}) {
    return new Promise((resolve) => {
      const ov = {
        t: 0,
        hold: o.hold || 200,
        update(active) {
          this.t++;
          if (active && this.t > 50 && Input.isPressed('ok')) this.t = Math.max(this.t, this.hold);
          if (this.t >= this.hold + 40) { Game.removeOverlay(ov); resolve(); }
        },
        draw(ctx) {
          const fin = Math.min(1, this.t / 30), fout = this.t > this.hold ? 1 - (this.t - this.hold) / 40 : 1;
          ctx.fillStyle = o.bg || '#16131a'; ctx.globalAlpha = o.keepBg ? 1 : Math.min(1, fout * 1.2 + (o.solid ? 1 : 0));
          ctx.fillRect(0, 0, Game.W, Game.H);
          ctx.globalAlpha = fin * fout;
          if (o.icon !== false) Gfx.icon(ctx, o.icon || 'rain', Game.W / 2, Game.H / 2 - 90, 18);
          Gfx.text(ctx, title, Game.W / 2, Game.H / 2 - 10, { size: 58, font: Gfx.BOLD, align: 'center', color: o.color || '#f4ead8' });
          if (sub) Gfx.text(ctx, sub, Game.W / 2, Game.H / 2 + 44, { size: 30, align: 'center', color: '#b9aec4' });
          ctx.globalAlpha = 1;
        },
      };
      Game.pushOverlay(ov);
    });
  },

  // show a blank stage (for CG sequences). Returns the stage scene.
  stage(o) { const s = new StageScene(o); Game.setScene(s); return s; },

  credits() {
    return new Promise((resolve) => {
      const lines = [
        ['title', 'PITTER-PATTER'],
        ['sub', 'a little story about rain'],
        ['gap'],
        ['head', 'story, code, design & music'],
        ['name', 'Claude (Anthropic)'],
        ['gap'],
        ['head', 'illustrations'],
        ['name', 'generated with GPT Image, via Codex'],
        ['gap'],
        ['head', 'fonts'],
        ['name', 'Patrick Hand — Patrick Wagesreiter (SIL OFL)'],
        ['name', 'Sniglet — Haley Fiege (SIL OFL)'],
        ['gap'],
        ['head', 'with love and thanks to the games that inspired it'],
        ['name', 'OMORI · UNDERTALE · END ROLL · Ib · Re:Kinder'],
        ['gap'],
        ['head', 'starring'],
        ['name', 'PIM'], ['name', 'BISCUIT'], ['name', 'WAFFLES'], ['name', 'MOMO'], ['name', 'and Mom'],
        ['gap'],
        ['small', "If things feel heavy for you, or for someone you love,"],
        ['small', "it's okay to say so. It's okay to ask for help."],
        ['small', 'Rain is allowed.'],
        ['gap'], ['gap'],
        ['title', 'Thank you for playing.'],
      ];
      const ov = {
        t: 0, y: Game.H + 40,
        update() {
          this.t++;
          this.y -= Input.isHeld('ok') ? 3 : 0.75;
          if (this.y < -this.total - 60 || (this.t > 60 && Input.isPressed('cancel'))) { Game.removeOverlay(ov); resolve(); }
        },
        draw(ctx) {
          ctx.fillStyle = '#1b1622'; ctx.fillRect(0, 0, Game.W, Game.H);
          const img = Assets.get('cg_ending');
          if (img) {
            ctx.globalAlpha = 0.35;
            const s = Math.max(Game.W / img.width, Game.H / img.height);
            ctx.drawImage(img, (Game.W - img.width * s) / 2, (Game.H - img.height * s) / 2, img.width * s, img.height * s);
            ctx.globalAlpha = 1;
          }
          let y = this.y;
          for (const [k, txt] of lines) {
            if (k === 'gap') { y += 50; continue; }
            const size = { title: 54, sub: 28, head: 22, name: 32, small: 24 }[k];
            const col = { title: '#fff4e0', sub: '#c9bfd8', head: '#e9a8b8', name: '#f4ead8', small: '#c9bfd8' }[k];
            if (y > -60 && y < Game.H + 60) Gfx.text(ctx, txt, Game.W / 2, y, { size, font: k === 'title' || k === 'name' ? Gfx.BOLD : Gfx.FONT, align: 'center', color: col });
            y += size + 18;
          }
          this.total = y - this.y;
        },
      };
      Game.pushOverlay(ov);
    });
  },
};
window.Cutscene = Cutscene; window.StageScene = StageScene;
