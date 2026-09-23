'use strict';
// ---------------------------------------------------------------------------
// PILLOW FORT — the dream hub (Pim's room, blown up into a blanket kingdom).
// ---------------------------------------------------------------------------
ITEMS.raindrop_key = { name: 'Raindrop Key', type: 'key', desc: 'A little glass key shaped like a raindrop. It was in the pocket of the coat.', icon: 'key' };

function starryVoid(g, map) {
  const r = U.rng(U.hash(map.id + 'stars'));
  for (let i = 0; i < map.w * map.h * 0.6; i++) {
    const x = r() * map.w * TS, y = r() * map.h * TS, s = r();
    g.fillStyle = s > 0.9 ? '#ffe9a8' : 'rgba(220,220,255,0.7)';
    g.beginPath(); g.arc(x, y, s > 0.9 ? 2.2 : 1.1, 0, 7); g.fill();
  }
}

// photo scraps: 8 hidden around the dream
function scrapEvent(id, x, y) {
  return {
    id, x, y, solid: false, cond: () => !State.flag(id),
    draw2(ctx, ev, t) {
      const a = 0.55 + Math.sin(t * 0.08) * 0.35;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fff6c8';
      Gfx.star(ctx, 0, -18 + Math.sin(t * 0.05) * 3, 9, 3.5, 4); ctx.fill();
      ctx.globalAlpha = a * 0.4;
      ctx.beginPath(); ctx.arc(0, -18, 16, 0, 7); ctx.fill();
    },
    async run(E) {
      State.setFlag(id);
      const n = State.addV('scraps');
      State.addItem('photo_scrap');
      E.sfx('sfx_item');
      await E.say(null, `Found a {c:orange}Photo Scrap{/c}! (${n}/8)`);
      if (n === 1) await E.say('pim', '{c:grey}(A little torn piece of a photo. There\'s a bit of blue sky on it.){/c}', 'neutral');
      if (n === 8) await E.say('pim', '{c:grey}(That\'s all of them. Maybe I can fix the photo... someday.){/c}', 'cheery');
    },
  };
}

// gift boxes (treasure)
function presentEvent(id, x, y, item, n = 1, o = {}) {
  return {
    id, x, y, solid: true, cond: o.cond,
    draw2(ctx, ev, t) {
      const open = State.flag(id);
      const col = o.color || '#ff9ec4';
      ctx.fillStyle = 'rgba(40,20,40,0.18)'; ctx.beginPath(); ctx.ellipse(0, -2, 20, 7, 0, 0, 7); ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = Gfx.C.ink; ctx.lineJoin = 'round';
      ctx.fillStyle = col; Gfx.roundRect(ctx, -18, -34, 36, 32, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffe38a'; ctx.fillRect(-4, -34, 8, 32); ctx.strokeRect(-4, -34, 8, 32);
      if (!open) {
        ctx.fillStyle = U.mixHex(col, '#ffffff', 0.25); Gfx.roundRect(ctx, -21, -42, 42, 11, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffe38a';
        ctx.beginPath(); ctx.ellipse(-8, -46, 8, 5, -0.5, 0, 7); ctx.ellipse(8, -46, 8, 5, 0.5, 0, 7); ctx.fill(); ctx.stroke();
      } else {
        ctx.fillStyle = U.mixHex(col, '#ffffff', 0.25);
        ctx.save(); ctx.translate(14, -44); ctx.rotate(0.6); Gfx.roundRect(ctx, -21, -6, 42, 11, 4); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    },
    async run(E) {
      if (State.flag(id)) { await E.say(null, 'An empty gift box.'); return; }
      State.setFlag(id);
      E.sfx('sfx_chest');
      await E.wait(10);
      if (item === 'marbles') await E.marbles(n);
      else await E.give(item, n);
    },
  };
}

// save light
function saveEvent(id, x, y, label) {
  return { id, x, y, solid: false, async run(E) { Story.beforeSave(); await E.savePoint(label); } };
}

MAPS.fort = {
  name: 'Pillow Fort', area: 'Pillow Fort',
  tiles: [
    '##########################',
    '#WWWWWWWWWWWDDWWWWWWWWWWW#',
    '#WWWWWWWWWWWddWWWWWWWWWWW#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '..........................',
    '..........................',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........................#',
    '##########################',
  ],
  legend: {
    W: { mat: 'wall', c1: '#f4d3df', c2: '#ebbfd0', trim: '#c890a6', base: '#b27892', style: 'dots' },
    D: { mat: 'wall', c1: '#f4d3df', c2: '#ebbfd0', trim: '#c890a6', base: '#b27892', style: 'dots' },
    d: { mat: 'wall', walk: true, c1: '#f4d3df', c2: '#ebbfd0', trim: '#c890a6', base: '#b27892', style: 'dots' },
    '.': 'blanket',
  },
  voidColor: '#1d1a33', paintVoid: starryVoid,
  weather: 'drizzle', rainColor: 'rgba(170,190,255,0.5)',
  bgm: () => (State.d.chapter === 6 ? 'bgm_keep' : 'bgm_fort'), amb: () => 'amb_rain_light', ambVol: 0.5,
  props: [
    ['raindrop_door', 12, 1, { layer: 'ground', solid: false, foot: [2, 2], dh: 100, oy: 0 }],
    ['moon_light', 12, 5],
    ['blanket_tent', 2, 3], ['blanket_tent', 20, 3],
    ['pillow_pile', 6, 12], ['pillow_pile', 17, 13], ['pillow', 9, 4], ['pillow', 16, 11], ['pillow', 22, 14],
    ['toy_blocks', 4, 11], ['toy_blocks', 21, 10], ['cardboard_castle', 20, 12], ['book_stack', 8, 14], ['book_stack', 15, 4],
    ['string_lights', 2, 6, { len: 7, hgt: 130 }], ['string_lights', 16, 6, { len: 7, hgt: 130 }],
    ['paper_star', 7, 6, { hgt: 120 }], ['paper_star', 18, 9, { hgt: 140, color: '#ffc6d9' }], ['paper_star', 10, 12, { hgt: 120, color: '#c6e4ff' }],
    { id: 'laundry_block', x: 1, y: 8, foot: [2, 2], dh: 110, cond: () => State.d.chapter < 3 },
  ],
  exits: [
    { x: 25, y: 8, h: 2, to: 'crumb_1', tx: 1, ty: 10, tdir: 'right', dir: 'right' },
    { x: 0, y: 8, h: 2, to: 'carpet_1', tx: 30, ty: 11, tdir: 'left', dir: 'left', cond: () => State.d.chapter >= 3 },
    { x: 12, y: 2, w: 2, to: 'keep_1', tx: 10, ty: 22, tdir: 'up', dir: 'up', cond: () => State.flag('keep_open') },
  ],
  events: [
    saveEvent('save', 12, 5, 'A little moon nightlight hums softly. Everyone feels rested.'),
    scrapEvent('scrap_fort', 23, 15),
    presentEvent('gift_fort1', 3, 14, 'cookie', 2),
    presentEvent('gift_fort2', 23, 4, 'bubbles', 2, { color: '#9fd8ff' }),
    {
      id: 'teddy', x: 5, y: 6, sprite: 'p_plush_bear', dh: 66, dir: 'down', still: true,
      async run(E) {
        const c = State.d.chapter;
        if (c <= 1) {
          await E.say('voice', 'Oh, Pim. Look how big you got.');
          await E.say('pim', 'Old Teddy? You can talk too?', 'surprised');
          await E.say('voice', 'You used to cry into my fur every single night, you know. I was always so soggy.');
          await E.say('voice', 'You don\'t cry anymore. I miss being useful.');
          await E.say('pim', 'I don\'t need to cry! I\'m a big girl now.', 'forced');
          await E.say('voice', '...Yes. I suppose you are.');
          return;
        }
        if (c === 3) { await E.say('voice', 'The living room is to the west. Mind the dust bunnies. They bite. Softly.'); return; }
        if (c === 6) { await E.say('voice', 'Go on, Pim. If you need to be soggy later, I\'ll be right here.'); return; }
        await E.say('voice', 'Soggy or not, I\'m proud of you.');
      },
    },
    {
      id: 'laundry_ev', x: 1, y: 8, w: 2, h: 2, solid: false, cond: () => State.d.chapter < 3,
      async run(E) { await E.say(null, 'A mountain of laundry blocks the way west. It smells like... last week.'); await E.say('biscuit', 'Somebody should really do something about that.', 'neutral'); },
    },
    {
      id: 'north_door', x: 12, y: 2, w: 2, solid: true, cond: () => !State.flag('keep_open'),
      async run(E) {
        await E.say(null, 'A tall door with a keyhole shaped like a raindrop. It\'s locked.');
        if (State.d.chapter <= 1) await E.say('waffles', 'That\'s Mom\'s door! ...I think? It smells like Mom\'s door.', 'neutral');
      },
    },
    { id: 'biscuit_npc', x: 10, y: 9, sprite: 'chr_biscuit', dir: 'right', cond: () => State.d.chapter === 1 && !State.flag('fort_intro_done'), trigger: 'none' },
    { id: 'waffles_npc', x: 15, y: 10, sprite: 'chr_waffles', dir: 'left', cond: () => State.d.chapter === 1 && !State.flag('fort_intro_done'), trigger: 'none' },
  ],
  async onEnter(E) {
    const c = State.d.chapter;
    if (c === 1 && !E.flag('fort_intro_done')) await Story.fortIntro(E);
    else if (c === 3 && !E.flag('night2_intro')) {
      E.setFlag('night2_intro');
      await E.wait(30);
      await E.say('waffles', 'PIM! You\'re back! Look look look! The laundry mountain is GONE!', 'cheery');
      await E.say('biscuit', 'Somebody did the laundry.', 'neutral');
      await E.say('pim', 'I did! This morning!', 'cheery');
      await E.say('momo', 'That means the way west is open. The living room.', 'neutral');
      await E.say('biscuit', 'Carpet Hills. Home of the couch. My favorite scratching mountain.', 'cheery');
      await E.say('waffles', 'Oh! Oh! And while you were awake, we practised a NEW TOGETHER MOVE!', 'cheery');
      await E.say('momo', 'We build a pillow fort around everyone. Nothing can get us in there.', 'cheery');
      if (!State.d.together.includes('fort')) State.d.together.push('fort');
      E.sfx('sfx_together');
      await E.say(null, 'Learned the TOGETHER move {c:pink}PILLOW FORT{/c}!');
    } else if (c === 6 && !E.flag('night4_intro')) {
      E.setFlag('night4_intro');
      await E.wait(30);
      await E.say('pim', 'Everyone!', 'cheery');
      await E.say('waffles', 'Pim! Are you okay? Last night was so scary.', 'gloomy');
      await E.say('pim', 'I\'m fine!', 'forced');
      await E.say('biscuit', '...', 'gloomy');
      await E.say('pim', 'I have the key. The raindrop key.', 'neutral');
      await E.say('momo', 'That door... I know that door.', 'gloomy');
      await E.move('player', 'U3', { skipBlocked: true });
      E.face('player', 'up');
      E.sfx('sfx_unlock');
      await E.wait(20);
      E.setFlag('keep_open');
      E.take('raindrop_key');
      E.flash('#dfe8ff', 0.6, 30);
      await E.say(null, 'The raindrop door swings open. Stairs made of cloud lead up into the rain.');
      await E.say('biscuit', 'Mom\'s room.', 'neutral');
      await E.say('pim', 'The Cloud Keep. If the Sun is anywhere, it\'s up there.', 'neutral');
      await E.regroup(false);
    }
  },
};

Object.assign(Story, {
  async fortIntro(E) {
    await E.wait(40);
    await E.say(null, 'Drip. Drip.');
    await E.say('pim', '...Huh?', 'neutral');
    await E.say('pim', 'It\'s raining. {c:grey}Inside?{/c}', 'surprised');
    await E.say('voice', 'Finally. You sleep like a rock, you know that?');
    const b = E.char('biscuit_npc'), w = E.char('waffles_npc');
    E.face('player', 'left');
    await E.balloon('player', '!');
    await E.say('pim', 'Biscuit?! You\'re... standing up. And TALKING.', 'surprised');
    await E.say('biscuit', 'I\'ve always talked. You just never listen.', 'neutral');
    await E.move(w, 'L2');
    E.face('player', 'right');
    await E.hop(w, 18);
    await E.say('waffles', 'PIM!!! PIM PIM PIM! You\'re here! We\'re in the DREAM! Isn\'t it the BEST?', 'cheery');
    await E.say('pim', 'The dream...?', 'neutral');
    await E.say('waffles', 'Puddleton! It\'s your house, but BIG! And rainy. Super rainy. It\'s been raining foreverrrr.', 'cheery');
    await E.say('biscuit', 'Ever since the Sun fell asleep. Nobody can wake it up.', 'gloomy');
    await E.say('pim', '{c:grey}(The Sun is asleep...){/c}', 'neutral');
    await E.say('pim', '{c:grey}(...like Mom.){/c}', 'forced');
    await E.say('pim', 'Then we\'ll wake it up! If the Sun wakes up, the rain will stop. And then everything will be fine!', 'cheery');
    await E.say('biscuit', '...Sure. That\'s how it works. Probably.', 'neutral');
    await E.say('waffles', 'ADVENTURE! Adventure adventure! Oh! You\'ll need your umbrella, Pim!', 'cheery');
    await E.say(null, 'Pim looks down. She\'s holding a red umbrella with white polka dots.');
    await E.say('pim', 'Dad\'s umbrella...', 'neutral');
    await E.wait(30);
    await E.say('pim', 'Okay! Let\'s go wake up the Sun!', 'cheery');
    E.shake(3, 10);
    await E.say(null, 'Something wobbles out from under a pillow...');
    State.d.party = ['pim', 'biscuit', 'waffles'];
    await E.battle('tut_drizzlet');
    await E.wait(20);
    await E.say('waffles', 'We did it! Teamwork!', 'cheery');
    await E.say('biscuit', 'There\'s a lot more where that came from. The whole kingdom is crawling with feelings.', 'neutral');
    await E.say('biscuit', 'If you\'re tired, that nightlight over there helps. It\'s nice and warm. You can rest and {c:blue}save{/c} there.', 'neutral');
    await E.say('waffles', 'The kitchen is that way! EAST! Crumb Valley! That\'s where breakfast lives!', 'cheery');
    E.setFlag('fort_intro_done');
    State.d.party = ['pim', 'biscuit', 'waffles'];
    await E.fadeOut(12);
    const s = E.scene;
    E.removeEvent('biscuit_npc'); E.removeEvent('waffles_npc');
    s.followers = ['biscuit', 'waffles'].map((id) => new Char({ id, kind: 'follower', x: s.player.x, y: s.player.y, dir: s.player.dir, sprite: charSprite(id, 'dream'), solid: false }));
    s.trail = [];
    await E.fadeIn(12);
    await E.say(null, `{c:grey}BISCUIT and WAFFLES joined the party! ${Input.hint('menu')}{/c}`);
  },
});
