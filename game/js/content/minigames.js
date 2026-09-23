'use strict';
// ---------------------------------------------------------------------------
// Mini-game: POPCORN CATCH (Fluffton). Pim runs left and right catching
// popcorn for the dust bunnies. Burnt kernels make her dizzy for a moment.
// ---------------------------------------------------------------------------
const Popcorn = {
  play() {
    return new Promise((resolve) => {
      const W = Game.W, H = Game.H;
      const g = {
        t: 0, time: 30 * 60, x: W / 2, vx: 0, score: 0, combo: 0, stun: 0, items: [], pops: [], done: false, started: false,
        update(active) {
          if (!active) return;
          this.t++;
          if (!this.started) { if (this.t > 90) this.started = true; return; }
          if (this.done) {
            if (this.t - this.doneT > 60 && Input.isPressed('ok')) { Game.removeOverlay(g); resolve(this.score); }
            return;
          }
          this.time--;
          if (this.time <= 0) { this.done = true; this.doneT = this.t; Sound.sfx('sfx_bell'); return; }
          // movement
          const acc = this.stun > 0 ? 0 : 1.6;
          if (Input.isHeld('left')) this.vx -= acc;
          if (Input.isHeld('right')) this.vx += acc;
          this.vx *= 0.82;
          this.x = U.clamp(this.x + this.vx, 60, W - 60);
          if (this.stun > 0) this.stun--;
          // spawn
          const rate = 0.035 + (1 - this.time / (30 * 60)) * 0.05;
          if (Math.random() < rate) {
            const burnt = Math.random() < 0.18;
            this.items.push({ x: U.rand(60, W - 60), y: -20, vy: U.rand(2.2, 3.6) + (1 - this.time / 1800) * 2, rot: Math.random() * 6, vr: U.rand(-0.1, 0.1), burnt, gold: !burnt && Math.random() < 0.06 });
          }
          for (const it of this.items) {
            it.y += it.vy; it.rot += it.vr;
            if (!it.gone && it.y > H - 150 && it.y < H - 100 && Math.abs(it.x - this.x) < 52) {
              it.gone = true;
              if (it.burnt) { this.stun = 50; this.combo = 0; Sound.sfx('sfx_debuff'); this.pops.push({ x: it.x, y: it.y, text: 'burnt!', c: '#6b4131', t: 0 }); }
              else { const pts = it.gold ? 5 : 1; this.combo++; this.score += pts + (this.combo >= 10 ? 1 : 0); Sound.sfx('sfx_cursor', { pitch: 1.2 + Math.min(this.combo, 12) * 0.04, volume: 0.7 }); this.pops.push({ x: it.x, y: it.y, text: '+' + pts, c: it.gold ? '#c98a00' : '#3f9a4e', t: 0 }); }
            }
            if (!it.gone && it.y > H - 60) { it.gone = true; if (!it.burnt) this.combo = 0; }
          }
          this.items = this.items.filter((i) => !i.gone && i.y < H + 20);
          for (const p of this.pops) p.t++;
          this.pops = this.pops.filter((p) => p.t < 40);
        },
        draw(ctx) {
          const grd = ctx.createLinearGradient(0, 0, 0, H);
          grd.addColorStop(0, '#39335a'); grd.addColorStop(1, '#7c6a8e');
          ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
          // glowing TV at the top
          ctx.fillStyle = 'rgba(255,240,200,0.12)'; ctx.beginPath(); ctx.ellipse(W / 2, 0, 420, 160, 0, 0, Math.PI * 2); ctx.fill();
          // floor
          ctx.fillStyle = '#8fae8a'; ctx.fillRect(0, H - 90, W, 90);
          ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 60; i++) ctx.fillRect((i * 97) % W, H - 88 + (i * 13) % 80, 3, 2);
          // falling kernels
          for (const it of this.items) {
            ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot);
            ctx.fillStyle = it.burnt ? '#6b4131' : it.gold ? '#ffd166' : '#fffaf0';
            ctx.strokeStyle = Gfx.C.ink; ctx.lineWidth = 2;
            ctx.beginPath();
            for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; ctx.arc(Math.cos(a) * 7, Math.sin(a) * 7, 8, 0, Math.PI * 2); }
            ctx.fill(); ctx.stroke();
            ctx.restore();
          }
          // Pim with a bucket
          const px = this.x, py = H - 96;
          const wob = this.stun > 0 ? Math.sin(this.t * 0.5) * 0.2 : this.vx * 0.01;
          Sprites.draw(ctx, 'chr_pim', px, py + 30, 'down', { t: this.t, moving: Math.abs(this.vx) > 0.5, phase: this.t * 0.3, rot: wob, dh: 96 });
          ctx.save(); ctx.translate(px, py - 40);
          ctx.fillStyle = '#e0483e'; ctx.strokeStyle = Gfx.C.ink; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(-48, -34); ctx.lineTo(48, -34); ctx.lineTo(36, 8); ctx.lineTo(-36, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#fff'; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * 16, -14, 4, 0, 7); ctx.fill(); }
          ctx.restore();
          if (this.stun > 0) Gfx.icon(ctx, 'swirl', px, py - 110, 14);
          for (const p of this.pops) Gfx.text(ctx, p.text, p.x, p.y - p.t, { size: 26, font: Gfx.BOLD, align: 'center', color: p.c, outline: '#fff', outlineWidth: 5, alpha: 1 - p.t / 40 });
          // HUD
          Gfx.box(ctx, 20, 20, 250, 60, {});
          Gfx.text(ctx, 'POPCORN: ' + this.score, 40, 60, { size: 28, font: Gfx.BOLD });
          Gfx.box(ctx, W - 190, 20, 170, 60, {});
          Gfx.text(ctx, Math.ceil(Math.max(0, this.time) / 60) + 's', W - 105, 60, { size: 30, font: Gfx.BOLD, align: 'center' });
          if (this.combo >= 5) Gfx.text(ctx, 'combo ×' + this.combo, W / 2, 60, { size: 26, font: Gfx.BOLD, align: 'center', color: '#d8578a', outline: '#fff', outlineWidth: 5 });
          if (!this.started) {
            Gfx.box(ctx, W / 2 - 230, H / 2 - 80, 460, 140, {});
            Gfx.text(ctx, 'POPCORN CATCH', W / 2, H / 2 - 30, { size: 36, font: Gfx.BOLD, align: 'center' });
            Gfx.text(ctx, '◀ ▶ to move. Don\'t catch the burnt ones!', W / 2, H / 2 + 20, { size: 24, align: 'center', color: Gfx.C.inkSoft });
          }
          if (this.done) {
            Gfx.box(ctx, W / 2 - 200, H / 2 - 80, 400, 150, {});
            Gfx.text(ctx, 'TIME!', W / 2, H / 2 - 28, { size: 40, font: Gfx.BOLD, align: 'center' });
            Gfx.text(ctx, this.score + ' popcorn caught', W / 2, H / 2 + 20, { size: 28, align: 'center' });
            if (this.t - this.doneT > 60) Gfx.text(ctx, 'press Z', W / 2, H / 2 + 54, { size: 20, align: 'center', color: Gfx.C.inkSoft });
          }
        },
      };
      Game.pushOverlay(g);
    });
  },
};

// the popcorn bunny in Fluffton
MAPS.carpet_village.events.push({
  id: 'popcorn_bunny', x: 21, y: 13, sprite: 'npc_bunny', dir: 'left', dh: 46,
  async run(E) {
    const best = State.v('popcorn_best');
    await E.say('bunny', 'I miss popcorn SO much. When the family watched TV, it rained popcorn down here!');
    const i = await E.ask('bunny', best ? `Wanna catch popcorn again? Your best is ${best}!` : 'Could you catch some for us? Pleeeease?', ['Let\'s go!', 'Maybe later']);
    if (i !== 0) return;
    E.stopBgm(0.5);
    Sound.playBgm('bgm_shop', { restart: true });
    await E.fadeOut(15);
    const pr = Popcorn.play();
    await E.fadeIn(15);
    const score = await pr;
    Sound.playBgm(typeof MAPS.carpet_village.bgm === 'function' ? MAPS.carpet_village.bgm() : MAPS.carpet_village.bgm, { restart: true });
    if (score > best) State.setV('popcorn_best', score);
    await E.say('bunny', `${score} popcorn! ${score >= 40 ? 'That\'s a FEAST!' : score >= 20 ? 'Yummy!' : 'Every little bit helps!'}`);
    if (score >= 10) await E.marbles(Math.min(60, score));
    if (score >= 40 && !E.flag('popcorn_prize')) {
      E.setFlag('popcorn_prize');
      await E.say('bunny', 'You\'re the popcorn champion! Take this! I found it in the couch.');
      await E.give('st_glitter');
    }
  },
});
window.Popcorn = Popcorn;
