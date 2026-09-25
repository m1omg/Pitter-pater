'use strict';
// ---------------------------------------------------------------------------
// Pause menu (items, skills, stickers, options), save/load slots and shop.
// ---------------------------------------------------------------------------
function listNav(o, n, cols = 1) {
  if (!n) return;
  if (cols === 1) {
    if (Input.repeat('up')) { o.index = (o.index + n - 1) % n; Sound.sfx('sfx_cursor', { volume: 0.5 }); }
    if (Input.repeat('down')) { o.index = (o.index + 1) % n; Sound.sfx('sfx_cursor', { volume: 0.5 }); }
  } else {
    if (Input.repeat('up') && o.index - cols >= 0) { o.index -= cols; Sound.sfx('sfx_cursor', { volume: 0.5 }); }
    if (Input.repeat('down') && o.index + cols < n) { o.index += cols; Sound.sfx('sfx_cursor', { volume: 0.5 }); }
    if (Input.repeat('left') && o.index % cols > 0) { o.index--; Sound.sfx('sfx_cursor', { volume: 0.5 }); }
    if (Input.repeat('right') && o.index % cols < cols - 1 && o.index + 1 < n) { o.index++; Sound.sfx('sfx_cursor', { volume: 0.5 }); }
  }
}

// first visible entry of a scrolling list; it only scrolls when the cursor leaves the window
// (so a tap on a visible row never shifts the rows under the finger)
function scrollTop(o, n, rows) {
  const t = U.clamp(o.top || 0, o.index - rows + 1, o.index);
  return (o.top = U.clamp(t, 0, Math.max(0, n - rows)));
}

function drawFace(ctx, id, face, x, y, s, bg) {
  const ch = CHARACTERS[id];
  Gfx.roundRect(ctx, x, y, s, s, 12);
  ctx.fillStyle = bg || (ch && ch.color) || '#eee'; ctx.fill();
  const fid = ch && ch.faces && (ch.faces[face] || ch.faces.neutral);
  const img = fid ? Assets.get(fid) : null;
  ctx.save();
  Gfx.roundRect(ctx, x, y, s, s, 12); ctx.clip();
  if (img) ctx.drawImage(img, x, y, s, s);
  else Gfx.placeholder(ctx, x + s * 0.15, y + s * 0.15, s * 0.7, s * 0.7, id, ch && ch.color);
  ctx.restore();
  Gfx.roundRect(ctx, x, y, s, s, 12); ctx.lineWidth = 2.5; ctx.strokeStyle = Gfx.C.ink; ctx.stroke();
}

const Menu = {
  open() {
    Sound.sfx('sfx_menu_open', { volume: 0.6 });
    const m = new PauseMenu();
    Game.pushOverlay(m);
  },
};

class PauseMenu {
  constructor() {
    this.t = 0; this.anim = 0;
    this.index = 0;
    this.mode = 'main';
    this.options = ['ITEMS', 'SKILLS', 'STICKERS', 'OPTIONS', 'QUIT'];
    this.sub = null;
  }
  close() { Game.removeOverlay(this); Sound.sfx('sfx_cancel', { volume: 0.5 }); }
  update(active) {
    this.t++;
    this.anim = Math.min(1, this.anim + 0.15);
    if (!active || (this.sub && this.sub.busy)) return;
    const hits = Input.rowHits(this.options.length, 24, 35, 200, 48);
    if (this.sub) {
      const i = Input.hitIndex(hits, Input.tapPos);
      if (i < 0) { this.sub.update(); return; }
      // tapping the left column while a panel is open switches straight to that entry
      Input.takeTap();
      if (i === this.index) return;
      this.sub = null; this.index = i;
      Input.pressed.ok = true;
    } else if (Input.tapSelect(this, hits)) return;
    listNav(this, this.options.length);
    if (Input.isPressed('cancel') || Input.isPressed('menu')) { this.close(); return; }
    if (Input.isPressed('ok')) {
      Sound.sfx('sfx_confirm', { volume: 0.6 });
      const o = this.options[this.index];
      if (o === 'ITEMS') this.sub = new ItemsPanel(this);
      if (o === 'SKILLS') this.sub = new SkillsPanel(this);
      if (o === 'STICKERS') this.sub = new StickerPanel(this);
      if (o === 'OPTIONS') this.sub = new OptionsPanel(this);
      if (o === 'QUIT') {
        choose(['Keep playing', 'Return to title'], { cancel: 0, x: Game.W / 2 - 140, y: 300 }).then((i) => {
          if (i === 1) { Game.removeOverlay(this); Title.open(); }
        });
      }
    }
  }
  draw(ctx) {
    const a = U.ease.outCubic(this.anim);
    ctx.save();
    ctx.globalAlpha = a * 0.55;
    ctx.fillStyle = '#1b1622'; ctx.fillRect(0, 0, Game.W, Game.H);
    ctx.globalAlpha = a;
    ctx.translate(0, (1 - a) * 30);
    // left column
    Gfx.box(ctx, 24, 24, 200, this.options.length * 48 + 28, {});
    this.options.forEach((o, i) => {
      const y = 38 + i * 48;
      if (i === this.index) { Gfx.roundRect(ctx, 36, y, 176, 42, 10); ctx.fillStyle = this.sub ? '#f3e6cf' : Gfx.C.select; ctx.fill(); if (!this.sub) Gfx.cursor(ctx, 52, y + 21, this.t); }
      Gfx.text(ctx, o, 70, y + 31, { size: 25, font: Gfx.BOLD });
    });
    // info box
    const iy = this.options.length * 48 + 68;
    Gfx.box(ctx, 24, iy, 200, 130, { fill: '#fff3dc' });
    Gfx.icon(ctx, 'marble', 48, iy + 32, 12);
    Gfx.text(ctx, String(State.d.marbles), 70, iy + 42, { size: 26, font: Gfx.BOLD });
    Gfx.text(ctx, State.d.location || '', 40, iy + 80, { size: 20, color: Gfx.C.inkSoft });
    Gfx.text(ctx, U.formatTime(Game.playTime), 40, iy + 110, { size: 20, color: Gfx.C.inkSoft });
    // party
    if (!this.sub || this.sub.showParty) this.drawParty(ctx, this.sub && this.sub.partySel);
    if (this.sub) this.sub.draw(ctx);
    ctx.restore();
  }
  drawParty(ctx, sel) {
    const ids = State.d.party;
    ids.forEach((id, i) => {
      const x = 244, y = 24 + i * 120, w = 692, h = 110;
      const a = State.actor(id), st = State.stats(id);
      Gfx.box(ctx, x, y, w, h, { fill: sel && sel.index === i && sel.active ? '#fff0c8' : '#fff8ec' });
      if (sel && sel.index === i && sel.active) Gfx.cursor(ctx, x - 4, y + h / 2, this.t);
      drawFace(ctx, id, a.hp <= 0 ? 'down' : 'neutral', x + 14, y + 12, 86);
      Gfx.text(ctx, ACTORS[id].name, x + 116, y + 38, { size: 28, font: Gfx.BOLD });
      Gfx.text(ctx, 'LV ' + a.level, x + 116, y + 70, { size: 22, font: Gfx.BOLD, color: Gfx.C.inkSoft });
      const next = DB.expForLevel(a.level + 1), prev = DB.expForLevel(a.level);
      Gfx.text(ctx, a.level >= DB.MAX_LEVEL ? 'MAX' : `next: ${next - a.exp}`, x + 116, y + 96, { size: 18, color: Gfx.C.inkSoft });
      Gfx.icon(ctx, 'heart', x + 290, y + 36, 10);
      Gfx.bar(ctx, x + 308, y + 28, 200, 16, a.hp / st.maxhp, Gfx.C.hp, Gfx.C.hpBack);
      Gfx.text(ctx, `${a.hp}/${st.maxhp}`, x + 516, y + 42, { size: 18, font: Gfx.BOLD });
      Gfx.icon(ctx, 'pep', x + 290, y + 66, 9);
      Gfx.bar(ctx, x + 308, y + 58, 200, 14, a.pep / st.maxpep, Gfx.C.pep, Gfx.C.pepBack);
      Gfx.text(ctx, `${a.pep}/${st.maxpep}`, x + 516, y + 71, { size: 18, font: Gfx.BOLD });
      Gfx.text(ctx, `ATK ${st.atk}  DEF ${st.def}  SPD ${st.spd}`, x + 290, y + 98, { size: 18, color: Gfx.C.inkSoft });
      if (a.sticker) { Gfx.icon(ctx, 'sticker', x + 610, y + 40, 12); Gfx.text(ctx, ITEMS[a.sticker].name, x + 610, y + 76, { size: 16, align: 'center', color: Gfx.C.inkSoft }); }
    });
  }
}

// pick a party member (shared by sub panels)
class PartyPicker {
  constructor() { this.index = 0; this.active = false; }
  update(onPick, onCancel) {
    if (Input.tapSelect(this, Input.rowHits(State.d.party.length, 244, 24, 692, 120))) return;
    listNav(this, State.d.party.length);
    if (Input.isPressed('ok')) { Sound.sfx('sfx_confirm', { volume: 0.6 }); onPick(State.d.party[this.index]); }
    else if (Input.isPressed('cancel')) { Sound.sfx('sfx_cancel', { volume: 0.5 }); onCancel(); }
  }
}

class ItemsPanel {
  constructor(menu) {
    this.menu = menu; this.tab = 0; this.index = 0; this.showParty = false;
    this.tabs = ['TREATS', 'TRINKETS', 'IMPORTANT'];
    this.picker = null;
  }
  list() {
    if (this.tab === 0) return State.itemList((it) => it.type === 'treat');
    if (this.tab === 1) return State.itemList((it) => it.type === 'trinket' || it.type === 'sticker');
    return Object.keys(State.d.keyItems).filter((k) => State.d.keyItems[k]);
  }
  update() {
    if (this.picker) {
      this.picker.update((id) => {
        const iid = this.list()[this.index];
        const it = ITEMS[iid];
        if (it.target === 'allies') {
          let any = false;
          for (const pid of State.d.party) any = it.field(pid) || any;
          if (any) { State.removeItem(iid); Sound.sfx('sfx_heal'); } else Sound.sfx('sfx_buzzer');
        } else if (it.field && it.field(id)) { State.removeItem(iid); Sound.sfx('sfx_heal'); }
        else Sound.sfx('sfx_buzzer');
        if (!State.itemCount(iid)) { this.picker = null; this.showParty = false; this.index = Math.max(0, Math.min(this.index, this.list().length - 1)); }
      }, () => { this.picker = null; this.showParty = false; });
      return;
    }
    const L = this.list();
    const tab = Input.hitIndex(this.tabs.map((t, i) => ({ i, x: 244 + 24 + i * 180, y: 36, w: 164, h: 48 })), Input.tapPos);
    if (tab >= 0) {
      Input.takeTap();
      if (tab !== this.tab) { this.tab = tab; this.index = 0; Sound.sfx('sfx_cursor', { volume: 0.5 }); }
      return;
    }
    const top = scrollTop(this, L.length, 11);
    if (Input.tapSelect(this, Input.rowHits(Math.min(11, L.length - top), 260, 96, 660, 44, top), true)) return;
    if (Input.repeat('left')) { this.tab = (this.tab + 2) % 3; this.index = 0; Sound.sfx('sfx_cursor', { volume: 0.5 }); }
    if (Input.repeat('right')) { this.tab = (this.tab + 1) % 3; this.index = 0; Sound.sfx('sfx_cursor', { volume: 0.5 }); }
    listNav(this, L.length);
    if (Input.isPressed('cancel')) { Sound.sfx('sfx_cancel', { volume: 0.5 }); this.menu.sub = null; return; }
    if (Input.isPressed('ok') && L.length && this.tab === 0) {
      const it = ITEMS[L[this.index]];
      if (it.field) { Sound.sfx('sfx_confirm', { volume: 0.6 }); this.picker = new PartyPicker(); this.picker.active = true; this.showParty = true; this.partySel = this.picker; }
    } else if (Input.isPressed('ok') && L.length) Sound.sfx('sfx_buzzer');   // not used from here (see the hint)
  }
  draw(ctx) {
    if (this.picker) {
      const iid = this.list()[this.index];
      Gfx.box(ctx, 244, 520, 692, 70, { fill: '#fff3dc' });
      Gfx.text(ctx, `Use ${ITEMS[iid].name} (×${State.itemCount(iid)}) on who?`, 268, 564, { size: 26 });
      return;
    }
    const x = 244, y = 24, w = 692, h = 672;
    Gfx.box(ctx, x, y, w, h, {});
    this.tabs.forEach((t, i) => {
      const tx = x + 24 + i * 180;
      Gfx.roundRect(ctx, tx, y + 16, 164, 40, 10);
      ctx.fillStyle = i === this.tab ? '#ffd9a8' : '#f3e6cf'; ctx.fill();
      Gfx.text(ctx, t, tx + 82, y + 45, { size: 22, font: Gfx.BOLD, align: 'center', color: i === this.tab ? Gfx.C.ink : Gfx.C.inkSoft });
    });
    Gfx.text(ctx, '◀ ▶', x + w - 40, y + 45, { size: 18, align: 'right', color: Gfx.C.inkSoft });
    const L = this.list();
    if (!L.length) Gfx.text(ctx, 'Nothing here yet.', x + 40, y + 110, { size: 26, color: Gfx.C.inkSoft });
    const first = scrollTop(this, L.length, 11);
    L.slice(first, first + 11).forEach((iid, j) => {
      const i = first + j, yy = y + 74 + j * 44;
      const it = ITEMS[iid];
      if (i === this.index) { Gfx.roundRect(ctx, x + 16, yy, w - 32, 40, 10); ctx.fillStyle = Gfx.C.select; ctx.fill(); Gfx.cursor(ctx, x + 32, yy + 20, this.menu.t); }
      Gfx.icon(ctx, it.icon || 'treat', x + 64, yy + 20, 11);
      Gfx.text(ctx, it.name, x + 86, yy + 30, { size: 26 });
      if (it.type !== 'key') Gfx.text(ctx, '×' + State.itemCount(iid), x + w - 40, yy + 30, { size: 22, font: Gfx.BOLD, align: 'right' });
    });
    if (L.length) {
      const it = ITEMS[L[this.index]];
      ctx.strokeStyle = 'rgba(58,42,48,0.25)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 20, y + h - 96); ctx.lineTo(x + w - 20, y + h - 96); ctx.stroke();
      const hint = it.type === 'trinket' ? ' Use it in battle: choose ITEMS.' : it.type === 'sticker' ? ' Put it on in STICKERS.' : '';
      const lines = Gfx.wrap(ctx, (it.desc || '') + hint, w - 60, 24, Gfx.FONT);
      lines.slice(0, 2).forEach((l, i) => Gfx.text(ctx, l, x + 28, y + h - 60 + i * 30, { size: 24, color: Gfx.C.inkSoft }));
    }
  }
}

class SkillsPanel {
  constructor(menu) { this.menu = menu; this.picker = new PartyPicker(); this.picker.active = true; this.partySel = this.picker; this.showParty = true; this.who = null; this.index = 0; }
  fieldSkills() { return { soft_rain: true, rainfall: true, best_friend: true }; }
  update() {
    if (!this.who) {
      this.picker.update((id) => { this.who = id; this.index = 0; this.showParty = false; }, () => { this.menu.sub = null; });
      return;
    }
    const L = State.actor(this.who).skills.filter((s) => SKILLS[s] && !SKILLS[s].hidden);
    if (this.target) {
      this.target.update((pid) => this.useField(L[this.index], pid), () => { this.target = null; this.showParty = false; });
      return;
    }
    if (Input.tapSelect(this, Input.rowHits(L.length, 260, 130, 660, 44), true)) return;
    listNav(this, L.length);
    if (Input.isPressed('cancel')) { Sound.sfx('sfx_cancel', { volume: 0.5 }); this.who = null; this.showParty = true; return; }
    if (Input.isPressed('ok') && this.fieldSkills()[L[this.index]]) {
      const sk = SKILLS[L[this.index]], a = State.actor(this.who);
      if (a.pep < sk.cost || a.hp <= 0) { Sound.sfx('sfx_buzzer'); return; }
      if (sk.target === 'allies') this.useField(L[this.index], null);
      else { this.target = new PartyPicker(); this.target.active = true; this.partySel = this.target; this.showParty = true; }
    }
  }
  useField(skill, pid) {
    const sk = SKILLS[skill], a = State.actor(this.who);
    if (a.pep < sk.cost) { Sound.sfx('sfx_buzzer'); return; }
    const targets = pid ? [pid] : State.d.party;
    let did = false;
    for (const id of targets) {
      const t = State.actor(id), st = State.stats(id);
      if (t.hp <= 0 || t.hp >= st.maxhp) continue;
      const amt = skill === 'rainfall' ? Math.round(st.maxhp * 0.3) + 8 : skill === 'best_friend' ? Math.round(st.maxhp * 0.6) : Math.round(st.maxhp * 0.4) + 10;
      t.hp = Math.min(st.maxhp, t.hp + amt); did = true;
    }
    if (did) { a.pep -= sk.cost; Sound.sfx('sfx_heal'); } else Sound.sfx('sfx_buzzer');
  }
  draw(ctx) {
    if (!this.who || this.target) {
      if (this.target) { Gfx.box(ctx, 244, 520, 692, 70, { fill: '#fff3dc' }); Gfx.text(ctx, 'Heal who?', 268, 564, { size: 26 }); }
      return;
    }
    const x = 244, y = 24, w = 692, h = 672;
    Gfx.box(ctx, x, y, w, h, {});
    drawFace(ctx, this.who, 'neutral', x + 20, y + 18, 70);
    Gfx.text(ctx, ACTORS[this.who].name + "'s skills", x + 106, y + 64, { size: 30, font: Gfx.BOLD });
    const a = State.actor(this.who);
    Gfx.text(ctx, `PEP ${a.pep}/${State.stats(this.who).maxpep}`, x + w - 30, y + 64, { size: 22, font: Gfx.BOLD, align: 'right', color: '#3f7fd1' });
    const L = a.skills.filter((s) => SKILLS[s] && !SKILLS[s].hidden);
    L.forEach((s, i) => {
      const yy = y + 108 + i * 44;
      if (i === this.index) { Gfx.roundRect(ctx, x + 16, yy, w - 32, 40, 10); ctx.fillStyle = Gfx.C.select; ctx.fill(); Gfx.cursor(ctx, x + 32, yy + 20, this.menu.t); }
      Gfx.text(ctx, SKILLS[s].name, x + 56, yy + 30, { size: 26 });
      Gfx.text(ctx, SKILLS[s].cost + ' PEP', x + w - 40, yy + 30, { size: 20, font: Gfx.BOLD, align: 'right', color: Gfx.C.inkSoft });
      if (this.fieldSkills()[s]) Gfx.icon(ctx, 'heart', x + w - 140, yy + 20, 8);
    });
    const s = L[this.index];
    if (s) {
      ctx.strokeStyle = 'rgba(58,42,48,0.25)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 20, y + h - 96); ctx.lineTo(x + w - 20, y + h - 96); ctx.stroke();
      const lines = Gfx.wrap(ctx, SKILLS[s].desc + (this.fieldSkills()[s] ? ' (Can be used here.)' : ''), w - 60, 24, Gfx.FONT);
      lines.slice(0, 2).forEach((l, i) => Gfx.text(ctx, l, x + 28, y + h - 60 + i * 30, { size: 24, color: Gfx.C.inkSoft }));
    }
  }
}

class StickerPanel {
  constructor(menu) { this.menu = menu; this.picker = new PartyPicker(); this.picker.active = true; this.partySel = this.picker; this.showParty = true; this.who = null; this.index = 0; }
  list() { return [null, ...State.stickers()]; }
  update() {
    if (!this.who) { this.picker.update((id) => { this.who = id; this.index = 0; this.showParty = false; }, () => { this.menu.sub = null; }); return; }
    const L = this.list();
    if (Input.tapSelect(this, Input.rowHits(L.length, 260, 140, 660, 44), true)) return;
    listNav(this, L.length);
    if (Input.isPressed('cancel')) { Sound.sfx('sfx_cancel', { volume: 0.5 }); this.who = null; this.showParty = true; return; }
    if (Input.isPressed('ok')) {
      const a = State.actor(this.who);
      const cur = a.sticker;
      const pick = L[this.index];
      if (cur) State.addItem(cur, 1);
      if (pick) State.removeItem(pick, 1);
      a.sticker = pick;
      const st = State.stats(this.who);
      a.hp = Math.min(a.hp, st.maxhp); a.pep = Math.min(a.pep, st.maxpep);
      Sound.sfx('sfx_equip');
      this.index = 0;
    }
  }
  draw(ctx) {
    if (!this.who) return;
    const x = 244, y = 24, w = 692, h = 672;
    Gfx.box(ctx, x, y, w, h, {});
    const a = State.actor(this.who);
    drawFace(ctx, this.who, 'neutral', x + 20, y + 18, 70);
    Gfx.text(ctx, ACTORS[this.who].name, x + 106, y + 52, { size: 30, font: Gfx.BOLD });
    Gfx.text(ctx, 'Wearing: ' + (a.sticker ? ITEMS[a.sticker].name : 'nothing'), x + 106, y + 84, { size: 22, color: Gfx.C.inkSoft });
    const L = this.list();
    const cur = State.stats(this.who);
    L.forEach((sid, i) => {
      const yy = y + 118 + i * 44;
      if (i === this.index) { Gfx.roundRect(ctx, x + 16, yy, w - 32, 40, 10); ctx.fillStyle = Gfx.C.select; ctx.fill(); Gfx.cursor(ctx, x + 32, yy + 20, this.menu.t); }
      if (sid) Gfx.icon(ctx, 'sticker', x + 64, yy + 20, 11);
      Gfx.text(ctx, sid ? ITEMS[sid].name + ' ×' + State.itemCount(sid) : '(take off)', x + 86, yy + 30, { size: 26 });
    });
    const sid = L[this.index];
    const after = DB.actorStats(this.who, a.level, sid);
    const keys = ['maxhp', 'maxpep', 'atk', 'def', 'spd', 'luck'];
    const labels = { maxhp: 'HEART', maxpep: 'PEP', atk: 'ATK', def: 'DEF', spd: 'SPD', luck: 'LUCK' };
    keys.forEach((k, i) => {
      const xx = x + 40 + (i % 3) * 210, yy = y + h - 120 + Math.floor(i / 3) * 34;
      const d = after[k] - cur[k];
      Gfx.text(ctx, `${labels[k]} ${cur[k]}`, xx, yy, { size: 22, font: Gfx.BOLD, color: Gfx.C.inkSoft });
      if (d) Gfx.text(ctx, (d > 0 ? '→ ' : '→ ') + after[k], xx + 110, yy, { size: 22, font: Gfx.BOLD, color: d > 0 ? '#3f9a4e' : '#d94a4a' });
    });
    if (sid) Gfx.text(ctx, ITEMS[sid].desc, x + 40, y + h - 40, { size: 22, color: Gfx.C.inkSoft });
  }
}

class OptionsPanel {
  constructor(menu, onClose) {
    this.menu = menu; this.index = 0; this.onClose = onClose;
    this.items = [
      { label: 'Text speed', get: () => ['Slow', 'Normal', 'Fast', 'Instant'][[0.5, 1, 2, 9].indexOf(State.options.textSpeed)] || 'Normal', change: (d) => { const v = [0.5, 1, 2, 9]; let i = v.indexOf(State.options.textSpeed); if (i < 0) i = 1; State.options.textSpeed = v[U.clamp(i + d, 0, 3)]; } },
      { label: 'Music volume', get: () => Math.round(State.options.bgm * 10) + '/10', change: (d) => { State.options.bgm = U.clamp(Math.round(State.options.bgm * 10 + d) / 10, 0, 1); } },
      { label: 'Sound volume', get: () => Math.round(State.options.sfx * 10) + '/10', change: (d) => { State.options.sfx = U.clamp(Math.round(State.options.sfx * 10 + d) / 10, 0, 1); Sound.applyVolumes(); Sound.sfx('sfx_cursor'); } },
      { label: 'Always run', get: () => (State.options.alwaysRun ? 'On' : 'Off'), change: () => { State.options.alwaysRun = !State.options.alwaysRun; } },
      { label: 'Screen shake', get: () => (State.options.screenShake ? 'On' : 'Off'), change: () => { State.options.screenShake = !State.options.screenShake; } },
      { label: Input.isTouchUI() ? 'Fullscreen' : 'Fullscreen (F4)', get: () => (document.fullscreenElement ? 'On' : 'Off'), change: () => Input.toggleFullscreen() },
    ];
    if (!Input.isTouchUI()) this.items.push({ label: 'Controls', action: () => ControlsPanel.open() });
    if (Input.touchDevice || Input.usingTouch) this.items.push({ label: 'Touch joystick', get: () => (State.options.touchStick ? 'On' : 'Off'), change: () => { State.options.touchStick = !State.options.touchStick; } });
    this.items.push(
      { label: 'Export saves', action: () => SaveTransfer.exportSaves() },
      { label: 'Import saves', action: () => SaveTransfer.importSaves() },
    );
  }
  rect() {
    const h = this.items.length * 54 + 100;
    return this.menu ? { x: 244, y: 24, w: 692, h } : { x: 180, y: Math.min(150, Math.floor((Game.H - h) / 2)), w: 600, h };
  }
  async run(it) {
    Sound.sfx('sfx_confirm', { volume: 0.6 });
    this.busy = true;
    try { await it.action(); } catch (e) { console.error(e); } finally { this.busy = false; Input.clear(); }
  }
  update() {
    if (this.busy) return;
    const tap = Input.takeTap();
    if (tap) {
      // tap a row to highlight it (again to change it), or tap the ◀ / ▶ side of its value
      const { x, y, w } = this.rect();
      const i = Input.hitIndex(Input.rowHits(this.items.length, x + 16, y + 72, w - 32, 54), tap);
      if (i < 0) return;
      const it = this.items[i];
      if (it.action) { this.index = i; this.run(it); return; }
      const d = tap.x >= x + w - 250 ? (tap.x < x + w - 105 ? -1 : 1) : i === this.index ? 1 : 0;
      this.index = i;
      if (d) { it.change(d); State.saveOptions(); }
      Sound.sfx('sfx_cursor', { volume: 0.5 });
      return;
    }
    listNav(this, this.items.length);
    const it = this.items[this.index];
    if (it.action) { if (Input.isPressed('ok')) this.run(it); }
    else {
      if (Input.repeat('left')) { it.change(-1); State.saveOptions(); Sound.sfx('sfx_cursor', { volume: 0.5 }); }
      if (Input.repeat('right') || Input.isPressed('ok')) { it.change(1); State.saveOptions(); Sound.sfx('sfx_cursor', { volume: 0.5 }); }
    }
    if (Input.isPressed('cancel')) { Sound.sfx('sfx_cancel', { volume: 0.5 }); State.saveOptions(); if (this.onClose) this.onClose(); else this.menu.sub = null; }
  }
  draw(ctx) {
    const { x, y, w, h } = this.rect();
    Gfx.box(ctx, x, y, w, h, {});
    Gfx.text(ctx, 'OPTIONS', x + 30, y + 50, { size: 32, font: Gfx.BOLD });
    this.items.forEach((it, i) => {
      const yy = y + 76 + i * 54;
      if (i === this.index) { Gfx.roundRect(ctx, x + 16, yy, w - 32, 46, 10); ctx.fillStyle = Gfx.C.select; ctx.fill(); Gfx.cursor(ctx, x + 32, yy + 23, (this.menu || Title).t || 0); }
      Gfx.text(ctx, it.label, x + 56, yy + 33, { size: 26 });
      if (!it.action) Gfx.text(ctx, '◀ ' + it.get() + ' ▶', x + w - 40, yy + 33, { size: 24, font: Gfx.BOLD, align: 'right' });
    });
  }
}

// ---------------------------------------------------------------------------
// OPTIONS > Controls: two rebindable keys per action. The arrow keys, Enter and Esc
// always work too, so the menus can never be locked out.
// ---------------------------------------------------------------------------
class ControlsPanel {
  static open() {
    return new Promise((resolve) => Game.pushOverlay(new ControlsPanel(resolve)));
  }
  constructor(done) {
    this.done = done; this.index = 0; this.col = 0; this.t = 0; this.waiting = null; this.note = null;
    this.labels = { up: 'Up', down: 'Down', left: 'Left', right: 'Right', ok: 'Confirm / talk', cancel: 'Back / menu', run: 'Run (hold)', menu: 'Menu' };
    this.rows = [...Input.ACTIONS, 'reset', 'done'];
  }
  keys() { return State.options.keys || Input.DEFAULT_KEYS; }
  rect() { return { x: 110, y: 40, w: 740, h: 640 }; }
  close() {
    Input.capture = null;
    Game.removeOverlay(this);
    Input.clear();
    this.done();
  }
  setKeys(keys) {
    State.options.keys = keys;
    State.saveOptions();
  }
  activate() {
    const r = this.rows[this.index];
    if (r === 'done') { Sound.sfx('sfx_cancel', { volume: 0.5 }); this.close(); return; }
    if (r === 'reset') { this.setKeys(null); Sound.sfx('sfx_confirm', { volume: 0.6 }); this.note = { text: 'Back to the default keys.', t: 0 }; return; }
    Sound.sfx('sfx_confirm', { volume: 0.6 });
    this.waiting = { action: r, col: this.col };
    Input.capture = (e) => this.onKey(e);
  }
  onKey(e) {
    const code = e.code;
    if (/^F\d+$/.test(code) || !code) return;   // F4 and friends keep their jobs
    const w = this.waiting;
    this.waiting = null;
    Input.capture = null;
    Input.clear();
    if (code === 'Escape') { Sound.sfx('sfx_cancel', { volume: 0.5 }); return; }
    const keys = {};
    for (const a of Input.ACTIONS) keys[a] = (this.keys()[a] || []).slice(0, 2);
    const cur = keys[w.action];
    if (code === 'Backspace') {
      cur.splice(w.col, 1);
      Sound.sfx('sfx_cancel', { volume: 0.5 });
      this.setKeys(keys);
      return;
    }
    if (Input.FIXED_KEYS[code]) {
      Sound.sfx('sfx_buzzer');
      this.note = { text: `${Input.keyName(code)} always means ${this.labels[Input.FIXED_KEYS[code]]}.`, t: 0 };
      return;
    }
    const id = Input.keyId(code);
    let moved = null;
    for (const a of Input.ACTIONS) {
      const i = keys[a].indexOf(id);
      if (i >= 0 && !(a === w.action && i === w.col)) { keys[a].splice(i, 1); if (a !== w.action) moved = a; }
    }
    if (w.col < cur.length) cur[w.col] = id; else cur.push(id);
    this.setKeys(keys);
    Sound.sfx('sfx_equip', { volume: 0.6 });
    if (moved) this.note = { text: `${Input.keyName(code)} was taken off ${this.labels[moved]}.`, t: 0 };
  }
  update(active) {
    this.t++;
    if (this.note && ++this.note.t > 150) this.note = null;
    if (!active || this.waiting) return;
    const { x, y, w } = this.rect();
    const tap = Input.takeTap();
    if (tap) {
      const i = Input.hitIndex(Input.rowHits(this.rows.length, x + 16, y + 74, w - 32, 50), tap);
      if (i >= 0) { this.index = i; this.col = tap.x > x + 530 ? 1 : 0; this.activate(); }
      return;
    }
    listNav(this, this.rows.length);
    if (Input.repeat('left') || Input.repeat('right')) { this.col = 1 - this.col; Sound.sfx('sfx_cursor', { volume: 0.5 }); }
    if (Input.isPressed('ok')) this.activate();
    else if (Input.isPressed('cancel')) { Sound.sfx('sfx_cancel', { volume: 0.5 }); this.close(); }
  }
  draw(ctx) {
    ctx.fillStyle = 'rgba(20,14,26,0.45)'; ctx.fillRect(0, 0, Game.W, Game.H);
    const { x, y, w, h } = this.rect();
    Gfx.box(ctx, x, y, w, h, {});
    Gfx.text(ctx, 'CONTROLS', x + 30, y + 50, { size: 32, font: Gfx.BOLD });
    Gfx.text(ctx, 'always', x + w - 40, y + 50, { size: 18, align: 'right', color: Gfx.C.inkSoft });
    const keys = this.keys();
    this.rows.forEach((r, i) => {
      const yy = y + 74 + i * 50;
      const sel = i === this.index;
      if (sel) { Gfx.roundRect(ctx, x + 16, yy, w - 32, 44, 10); ctx.fillStyle = Gfx.C.select; ctx.fill(); Gfx.cursor(ctx, x + 32, yy + 22, this.t); }
      if (r === 'reset' || r === 'done') { Gfx.text(ctx, r === 'reset' ? 'Reset to defaults' : 'Done', x + 56, yy + 31, { size: 25 }); return; }
      Gfx.text(ctx, this.labels[r], x + 56, yy + 31, { size: 25 });
      for (let c = 0; c < 2; c++) {
        const cx = x + 390 + c * 150;
        const waiting = this.waiting && this.waiting.action === r && this.waiting.col === c;
        const code = (keys[r] || [])[c];
        if (sel && c === this.col) { Gfx.roundRect(ctx, cx - 64, yy + 5, 128, 34, 8); ctx.fillStyle = waiting ? '#ffd0dc' : 'rgba(255,255,255,0.7)'; ctx.fill(); }
        const label = waiting ? (this.t % 40 < 26 ? '...' : '') : code ? Input.keyName(code) : '—';
        Gfx.text(ctx, label, cx, yy + 30, { size: 22, font: Gfx.BOLD, align: 'center', color: code || waiting ? Gfx.C.ink : Gfx.C.inkSoft });
      }
      const fixed = Object.keys(Input.FIXED_KEYS).filter((k) => Input.FIXED_KEYS[k] === r).map((k) => Input.keyName(k)).join(' ');
      if (fixed) Gfx.text(ctx, fixed, x + w - 40, yy + 30, { size: 20, align: 'right', color: Gfx.C.inkSoft });
    });
    const msg = this.waiting ? `Press a key for ${this.labels[this.waiting.action]}.  Esc: cancel  ·  Backspace: clear` : this.note ? this.note.text : 'Choose a key to change it. ◀ ▶ picks the first or second key.';
    Gfx.text(ctx, msg, x + w / 2, y + h - 22, { size: 20, align: 'center', color: this.waiting ? '#d8578a' : Gfx.C.inkSoft });
  }
}

// ---------------------------------------------------------------------------
// Moving save files to another browser or device: as a code to paste, or as a file.
// ---------------------------------------------------------------------------
const SaveTransfer = {
  async ask(text, options, cancel) {
    await Msg.show(null, text, { autoResolve: true });
    const i = await choose(options, { cancel });
    Msg.release();
    return i;
  },
  say(text) { return Msg.show(null, text); },
  list(names) { return names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]; },

  async exportSaves() {
    const code = State.exportSaves();
    if (!code) { Sound.sfx('sfx_buzzer'); await this.say('There are no save files to export yet.'); return; }
    const i = await this.ask('Export your save files as...', ['A code to paste', 'A file to download', 'Never mind'], 2);
    if (i === 0) {
      if (await copyText(code)) {
        Sound.sfx('sfx_confirm');
        await this.say('Save code copied! On the other device or browser, go to OPTIONS, choose Import saves and paste it.');
      } else {
        window.prompt('Copy this save code, then go to OPTIONS on the other device or browser and choose Import saves:', code);
        Input.reset();
      }
    } else if (i === 1) {
      downloadText(`pitter-patter-saves-${new Date().toISOString().slice(0, 10)}.txt`, code);
      Sound.sfx('sfx_confirm');
      await this.say('Downloaded! On the other device or browser, go to OPTIONS, choose Import saves and open that file.');
    }
  },

  async importSaves() {
    const i = await this.ask('Import save files from...', ['A code', 'A file', 'Never mind'], 2);
    if (i === 0) {
      const text = window.prompt('Paste your PITTER-PATTER save code:');
      Input.reset();
      if (text) await this.importText(text);
    } else if (i === 1) {
      // the menu doesn't wait for the file: the import carries on whenever one is picked
      pickTextFile((text) => this.importText(text));
    }
  },

  async importText(text) {
    const saves = State.readExport(text);
    if (!saves) { Sound.sfx('sfx_buzzer'); await this.say('Hmm, that isn\'t a PITTER-PATTER save code.'); return; }
    const slots = Object.keys(saves).sort();
    const found = slots.map((k) => { const d = JSON.parse(saves[k]); return `FILE ${k} (${d.location || 'somewhere'}, ${U.formatTime(d.playTime || 0)})`; });
    const here = slots.filter((k) => State.peek(k)).map((k) => 'FILE ' + k);
    const q = `Found ${this.list(found)}.` + (here.length ? ` ${this.list(here)} on this device will be replaced.` : '') + ' Import?';
    if ((await this.ask(q, ['Import', 'Never mind'], 1)) !== 0) return;
    if (!State.importSaves(saves)) { Sound.sfx('sfx_buzzer'); await this.say('The browser wouldn\'t let the game save here, so nothing was imported.'); return; }
    Sound.sfx('sfx_save');
    await this.say(Game.scene instanceof TitleScene ? 'Done! Choose CONTINUE to play it.' : 'Done! Load it with CONTINUE on the title screen.');
  },
};

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* try the older way */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (e) { return false; }
}

function downloadText(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// let the player pick a file, and hand its text to onText once they have
function pickTextFile(onText) {
  const old = document.getElementById('save-file-input');
  if (old) old.remove();
  const inp = document.createElement('input');
  inp.type = 'file'; inp.id = 'save-file-input'; inp.accept = '.txt,.json,text/plain,application/json';
  inp.style.display = 'none';
  inp.addEventListener('change', () => {
    const f = inp.files && inp.files[0];
    inp.remove();
    Input.reset();
    if (f) f.text().then(onText, () => {});
  });
  document.body.appendChild(inp);
  inp.click();
}

// ---------------------------------------------------------------------------
const SaveMenu = {
  open(mode) {
    return new Promise((resolve) => {
      const o = {
        t: 0, index: 0, mode, confirm: null,
        update(active) {
          this.t++;
          if (!active) return;
          if (this.saved > 0) { if (--this.saved === 0) { Game.removeOverlay(o); resolve(true); } return; }
          if (Input.tapSelect(this, Input.rowHits(3, 110, 125, 740, 170), mode === 'save')) return;
          listNav(this, 3);
          if (Input.isPressed('cancel')) { Sound.sfx('sfx_cancel', { volume: 0.5 }); Game.removeOverlay(o); resolve(false); return; }
          if (Input.isPressed('ok')) {
            const slot = this.index + 1;
            if (mode === 'save') {
              State.d.playTime = Game.playTime;
              if (State.save(slot)) { Sound.sfx('sfx_save'); this.saved = 60; }
              else Sound.sfx('sfx_buzzer');
            } else {
              if (!State.peek(slot)) { Sound.sfx('sfx_buzzer'); return; }
              Sound.sfx('sfx_confirm');
              Game.removeOverlay(o);
              resolve(slot);
            }
          }
        },
        draw(ctx) {
          ctx.fillStyle = 'rgba(27,22,34,0.6)'; ctx.fillRect(0, 0, Game.W, Game.H);
          Gfx.text(ctx, mode === 'save' ? 'Save your progress' : 'Continue from...', Game.W / 2, 90, { size: 36, font: Gfx.BOLD, align: 'center', color: '#fff8ec', outline: Gfx.C.ink, outlineWidth: 6 });
          for (let i = 0; i < 3; i++) {
            const d = State.peek(i + 1);
            const x = 120, y = 130 + i * 170, w = 720, h = 150;
            Gfx.box(ctx, x, y, w, h, { fill: i === this.index ? '#fff3cf' : '#fff8ec' });
            if (i === this.index) Gfx.cursor(ctx, x - 10, y + h / 2, this.t);
            Gfx.text(ctx, 'FILE ' + (i + 1), x + 28, y + 44, { size: 28, font: Gfx.BOLD });
            if (!d) { Gfx.text(ctx, '- empty -', x + w / 2, y + 90, { size: 28, align: 'center', color: Gfx.C.inkSoft }); continue; }
            (d.party || []).forEach((id, k) => drawFace(ctx, id, 'neutral', x + 28 + k * 76, y + 60, 68));
            Gfx.text(ctx, d.location || '', x + w - 30, y + 44, { size: 26, align: 'right' });
            const lv = d.actors && d.actors.pim ? d.actors.pim.level : 1;
            Gfx.text(ctx, `LV ${lv}   ·   ${U.formatTime(d.playTime || 0)}`, x + w - 30, y + 90, { size: 24, font: Gfx.BOLD, align: 'right', color: Gfx.C.inkSoft });
            if (d.savedAt) Gfx.text(ctx, new Date(d.savedAt).toLocaleString(), x + w - 30, y + 124, { size: 18, align: 'right', color: Gfx.C.inkSoft });
          }
          if (this.saved > 0) {
            Gfx.box(ctx, Game.W / 2 - 110, 640, 220, 54, { fill: '#e6ffe0' });
            Gfx.text(ctx, 'Saved!', Game.W / 2, 676, { size: 30, font: Gfx.BOLD, align: 'center', color: '#3f9a4e' });
          }
        },
      };
      Game.pushOverlay(o);
    });
  },
};

// ---------------------------------------------------------------------------
const Shop = {
  open(stock, opts = {}) {
    return new Promise((resolve) => {
      const prevBgm = Sound.bgm ? Sound.bgm.id : null;
      Sound.rememberBgm();
      if (opts.music !== false) Sound.playBgm('bgm_shop', { restart: true });
      const o = {
        t: 0, index: 0, qty: 0,
        update(active) {
          this.t++;
          if (!active) return;
          if (this.qty) {
            const it = ITEMS[stock[this.index]];
            const tap = Input.takeTap();
            if (tap) {
              // ◀ / ▶ change the amount, BUY buys
              const b = Input.hitIndex([{ i: 0, x: 640, y: 434, w: 62, h: 66 }, { i: 1, x: 730, y: 434, w: 56, h: 66 }, { i: 2, x: 640, y: 510, w: 260, h: 56 }], tap);
              if (b === 0 && this.qty > 1) { this.qty--; Sound.sfx('sfx_cursor', { volume: 0.5 }); }
              if (b === 1 && this.qty < 99) { this.qty++; Sound.sfx('sfx_cursor', { volume: 0.5 }); }
              if (b === 2) Input.pressed.ok = true;
            }
            if (Input.repeat('up') || Input.repeat('right')) { this.qty = Math.min(this.qty + 1, 99); Sound.sfx('sfx_cursor', { volume: 0.5 }); }
            if (Input.repeat('down') || Input.repeat('left')) { this.qty = Math.max(1, this.qty - 1); Sound.sfx('sfx_cursor', { volume: 0.5 }); }
            if (Input.isPressed('ok')) {
              const cost = it.price * this.qty;
              if (State.d.marbles >= cost) { State.d.marbles -= cost; State.addItem(stock[this.index], this.qty); Sound.sfx('sfx_item'); this.bought = 50; }
              else Sound.sfx('sfx_buzzer');
              this.qty = 0;
            } else if (Input.isPressed('cancel')) { this.qty = 0; Sound.sfx('sfx_cancel', { volume: 0.5 }); }
            return;
          }
          if (this.bought > 0) this.bought--;
          if (Input.tapSelect(this, Input.rowHits(stock.length, 76, 108, 528, 44), true)) return;
          listNav(this, stock.length);
          if (Input.isPressed('ok')) { Sound.sfx('sfx_confirm', { volume: 0.6 }); this.qty = 1; }
          if (Input.isPressed('cancel')) {
            Sound.sfx('sfx_cancel', { volume: 0.5 });
            Game.removeOverlay(o);
            if (opts.music !== false && prevBgm) Sound.restoreBgm(0.6);
            resolve();
          }
        },
        draw(ctx) {
          ctx.fillStyle = 'rgba(27,22,34,0.45)'; ctx.fillRect(0, 0, Game.W, Game.H);
          const x = 60, y = 40, w = 560, h = Math.max(300, 90 + stock.length * 44);
          Gfx.box(ctx, x, y, w, h, {});
          Gfx.text(ctx, opts.title || 'SHOP', x + 28, y + 48, { size: 32, font: Gfx.BOLD });
          stock.forEach((iid, i) => {
            const it = ITEMS[iid], yy = y + 70 + i * 44;
            if (i === this.index) { Gfx.roundRect(ctx, x + 16, yy, w - 32, 40, 10); ctx.fillStyle = Gfx.C.select; ctx.fill(); Gfx.cursor(ctx, x + 32, yy + 20, this.t); }
            Gfx.icon(ctx, it.icon || 'treat', x + 64, yy + 20, 11);
            Gfx.text(ctx, it.name, x + 86, yy + 30, { size: 26 });
            Gfx.text(ctx, String(it.price), x + w - 60, yy + 30, { size: 22, font: Gfx.BOLD, align: 'right' });
            Gfx.icon(ctx, 'marble', x + w - 40, yy + 20, 9);
          });
          // wallet + desc
          Gfx.box(ctx, 640, 40, 260, 110, { fill: '#fff3dc' });
          Gfx.text(ctx, 'Your marbles', 664, 80, { size: 22, color: Gfx.C.inkSoft });
          Gfx.icon(ctx, 'marble', 676, 116, 12);
          Gfx.text(ctx, String(State.d.marbles), 698, 126, { size: 30, font: Gfx.BOLD });
          const it = ITEMS[stock[this.index]];
          Gfx.box(ctx, 640, 170, 260, 200, { fill: '#fff8ec' });
          Gfx.wrap(ctx, it.desc, 220, 22, Gfx.FONT).slice(0, 6).forEach((l, i) => Gfx.text(ctx, l, 660, 206 + i * 28, { size: 22, color: Gfx.C.inkSoft }));
          Gfx.text(ctx, 'You have: ' + State.itemCount(stock[this.index]), 660, 356, { size: 20, font: Gfx.BOLD });
          if (this.qty) {
            Gfx.box(ctx, 640, 390, 260, 110, { fill: '#fff0c8' });
            Gfx.text(ctx, 'How many?', 664, 426, { size: 22, color: Gfx.C.inkSoft });
            Gfx.text(ctx, '◀', 674, 472, { size: 26, font: Gfx.BOLD, align: 'center' });
            Gfx.text(ctx, String(this.qty), 716, 472, { size: 28, font: Gfx.BOLD, align: 'center' });
            Gfx.text(ctx, '▶', 758, 472, { size: 26, font: Gfx.BOLD, align: 'center' });
            Gfx.text(ctx, '= ' + it.price * this.qty, 790, 472, { size: 26, font: Gfx.BOLD });
            if (Input.isTouchUI()) {
              Gfx.box(ctx, 640, 510, 260, 56, { fill: '#e6ffe0' });
              Gfx.text(ctx, 'BUY', 770, 548, { size: 28, font: Gfx.BOLD, align: 'center', color: '#3f9a4e' });
            }
          }
          if (this.bought > 0) { Gfx.box(ctx, 640, 390, 260, 60, { fill: '#e6ffe0' }); Gfx.text(ctx, 'Thank you!', 770, 428, { size: 26, font: Gfx.BOLD, align: 'center', color: '#3f9a4e' }); }
        },
      };
      Game.pushOverlay(o);
    });
  },
};

window.Menu = Menu; window.SaveMenu = SaveMenu; window.ControlsPanel = ControlsPanel; window.SaveTransfer = SaveTransfer; window.Shop = Shop; window.OptionsPanel = OptionsPanel; window.drawFace = drawFace; window.listNav = listNav;
