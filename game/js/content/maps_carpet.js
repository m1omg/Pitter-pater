'use strict';
// ---------------------------------------------------------------------------
// CARPET HILLS — the living room: plush hills, a dust bunny village under
// the couch, and the Static Woods around the TV nobody turns off.
// ---------------------------------------------------------------------------
CHARACTERS.thestatic = { name: 'THE STATIC', color: '#c9c6cf', voice: 'sfx_blip_low', pitch: 0.75 };
CHARACTERS.remoteking = { name: 'REMOTE KING', color: '#d0d8e8', voice: 'sfx_blip_high', pitch: 0.9 };

const carpetVoid = (g, map) => {
  g.fillStyle = '#2b2a36'; g.fillRect(0, 0, map.w * TS, map.h * TS);
  const r = U.rng(U.hash(map.id));
  g.fillStyle = 'rgba(255,255,255,0.04)';
  for (let i = 0; i < 60; i++) { g.beginPath(); g.arc(r() * map.w * TS, r() * map.h * TS, 10 + r() * 30, 0, 7); g.fill(); }
};

MAPS.carpet_1 = {
  name: 'Carpet Hills', area: 'Carpet Hills',
  tiles: buildTiles(32, 22, '#', [
    ['ellipse', 16, 11, 15.5, 10.5, 'c'], ['rect', 3, 3, 26, 16, 'c'],
    ['ellipse', 10, 8, 5, 3, 'r'], ['ellipse', 22, 14, 6, 3.5, 'r'],
    ['rect', 29, 10, 3, 2, 'c'], ['rect', 14, 0, 2, 3, 'c'], ['rect', 0, 14, 3, 2, 'c'],
  ]),
  legend: { c: { mat: 'carpet', c1: '#a3c49c', c2: '#88ae82' }, r: { mat: 'rugpile', c1: '#f0d7a8', c2: '#d9b67f', outline: '#9a7550' } },
  voidColor: '#2b2a36', paintVoid: carpetVoid,
  weather: 'drizzle',
  bgm: 'bgm_carpet', amb: () => 'amb_rain_light', ambVol: 0.3,
  props: [
    ['cushion_hill', 5, 4], ['cushion_hill', 24, 4], ['cushion_hill', 6, 15], ['lamp_tree', 12, 4], ['lamp_tree', 26, 16],
    ['books_tower', 19, 6], ['books_tower', 3, 10], ['lint_tree', 9, 12], ['lint_tree', 21, 9], ['lint_tree', 17, 15],
    ['coin_big', 17, 18], ['crayon', 27, 8], ['crayon', 13, 16], ['plant_pot', 28, 4],
  ],
  exits: [
    { x: 31, y: 10, h: 2, to: 'fort', tx: 1, ty: 9, tdir: 'right', dir: 'right' },
    { x: 14, y: 0, w: 2, to: 'carpet_village', tx: 12, ty: 16, tdir: 'up', dir: 'up' },
    { x: 0, y: 14, h: 2, to: 'static_woods', tx: 28, ty: 11, tdir: 'left', dir: 'left' },
  ],
  events: [
    signEvent('sign_c1', 16, 3, ['{c:green}FLUFFTON{/c} - north, under the Great Couch.', '{c:grey}STATIC WOODS{/c} - west. Do not go there.', 'Seriously.']),
    presentEvent('gift_ca', 29, 6, 'pancakes', 1),   // on the carpet, next to the potted plant (30,5 was off the edge)
    presentEvent('gift_cb', 4, 7, 'popper', 2, { color: '#ffe38a' }),
    presentEvent('gift_cc', 22, 19, 'marbles', 30, { color: '#b8f0a8' }),
    scrapEvent('scrap_carpet', 4, 18),
    {
      id: 'cushion_dig', x: 24, y: 4, w: 3, h: 2, solid: false,
      async run(E) {
        if (E.flag('found_remote')) { await E.say(null, 'Between the cushions: crumbs, one sock, and a feeling of having lost something.'); return; }
        if (!E.flag('elder_quest')) { await E.say(null, 'A giant couch cushion. It\'s very soft.'); await E.say('biscuit', 'Things fall between these all the time. Coins. Snacks. Dignity.', 'neutral'); return; }
        await E.say(null, 'Pim digs between the cushions...');
        E.sfx('sfx_page');
        await E.wait(20);
        await E.say(null, '...crumbs... a hair tie... a very old french fry...');
        E.setFlag('found_remote');
        await E.give('remote');
        await E.say('waffles', 'The REMOTE! It was in the couch the whole time! It\'s ALWAYS in the couch!', 'cheery');
      },
    },
  ],
  enemies: [
    { troop: 'carpet_1', sprite: 'en_dustbunny', x: 12, y: 9, dh: 56, chase: 5 },
    { troop: 'carpet_2', sprite: 'en_sock', x: 22, y: 12, dh: 64, chase: 4 },
    { troop: 'carpet_3', sprite: 'en_coin', x: 8, y: 17, dh: 50, chase: 3 },
    { troop: 'carpet_4', sprite: 'en_lintmoth', x: 25, y: 7, dh: 56, chase: 6, chaseSpeed: 1 / 9 },
  ],
  async onFirst(E) {
    await E.wait(20);
    await E.say('waffles', 'The LIVING ROOM! This is where we watch cartoons! Well... where we used to.', 'cheery');
    await E.say('biscuit', 'The couch is a mountain now. I approve.', 'cheery');
    await E.say('momo', 'It\'s so quiet. Isn\'t a living room supposed to be noisy?', 'neutral');
  },
};

MAPS.carpet_village = {
  name: 'Fluffton', area: 'Fluffton',
  tiles: buildTiles(26, 18, '#', [
    ['ellipse', 13, 9, 12.5, 8.5, 'c'], ['rect', 2, 3, 22, 12, 'c'], ['rect', 12, 16, 2, 2, 'c'],
    ['ellipse', 13, 9, 4, 2.5, 'r'],
  ]),
  legend: { c: { mat: 'carpet', c1: '#8fae8a', c2: '#789a73' }, r: { mat: 'rugpile', c1: '#e6cda0', c2: '#cfae78', outline: '#8f6f4c' } },
  voidColor: '#232230', paintVoid: carpetVoid,
  dark: 0.35, playerLight: 220,
  bgm: 'bgm_town', amb: () => 'amb_rain_light', ambVol: 0.2,
  props: [
    ['dust_hut', 4, 4], ['dust_hut', 9, 3], ['dust_hut', 18, 4], ['dust_hut', 4, 11], ['dust_hut', 19, 11],
    ['lamp_tree', 23, 7], ['books_tower', 2, 8], ['coin_big', 15, 3], ['crayon', 22, 14], ['lint_tree', 8, 14], ['lint_tree', 16, 14],
    ['string_lights', 5, 7, { len: 5, hgt: 170 }], ['string_lights', 15, 7, { len: 6, hgt: 170 }],
  ],
  exits: [{ x: 12, y: 17, w: 2, to: 'carpet_1', tx: 14, ty: 1, tdir: 'down', dir: 'down' }],
  events: [
    { id: 'lamp', x: 12, y: 4, sprite: 'npc_lamp', dh: 110, still: true, light: 240,
      async run(E) {
        Story.beforeSave();
        await E.say('lamp', 'Oh, hello. I used to sit on the side table, you know. Next to the big chair.');
        await E.say('lamp', 'The mother and the little one would read under my light until very late. The father always fell asleep on the couch by eight. Ha!');
        await E.savePoint('The old lamp glows warmly. Everyone feels rested.');
      },
    },
    {
      id: 'elder', x: 13, y: 7, sprite: 'npc_elder', dir: 'down', dh: 74,
      async run(E) {
        if (E.flag('static_down')) { await E.say('elder', 'Listen! Listen to them all laughing! Oh, thank you, children.'); return; }
        if (!E.flag('elder_quest')) {
          E.setFlag('elder_quest');
          await E.say('elder', 'Welcome, travelers, to Fluffton, the village beneath the Great Couch.');
          await E.say('elder', 'Once, laughter rained down on us from the Glowing Box every evening. The family on the couch laughed and laughed...');
          await E.say('elder', '...and we dust bunnies grew round and happy on the crumbs of their popcorn.');
          await E.say('elder', 'But the Glowing Box turned grey. Now only STATIC comes out of it. It fills the woods to the west. Nobody laughs anymore.');
          await E.say('pim', 'We\'ll bring the laughing back! And then maybe the Sun will wake up!', 'cheery');
          await E.say('elder', 'The Laugh Track is trapped at the heart of the Static Woods. But the path is a tangle of channels. You will need the REMOTE.');
          await E.say('elder', 'The Remote King... well. He lost it. Again. It\'s probably in the couch cushions. It\'s always in the couch cushions.');
          await E.say('elder', 'And it will need BATTERIES. The old Lint Hermit collects shiny things. Perhaps he has some.');
          return;
        }
        await E.say('elder', 'The Remote is surely in the couch cushions, south of here. The Lint Hermit lives in the hut to the east.');
      },
    },
    {
      id: 'hermit', x: 21, y: 9, sprite: 'npc_hermit', dir: 'left', dh: 70,
      async run(E) {
        if (E.flag('got_batteries')) { await E.say('hermit', 'Mm. Go on, then. Make the box laugh.'); return; }
        await E.say('hermit', 'Hrrm. Visitors. What do you want. I\'m very busy being covered in fluff.');
        if (!E.flag('elder_quest')) return;
        await E.say('pim', 'Do you have batteries? For the remote?', 'neutral');
        await E.say('hermit', 'Batteries. Hrrm. I might. Answer my riddle and they\'re yours.');
        const i = await E.ask('hermit', 'What gets wetter and wetter, the more it dries?', ['A towel', 'An umbrella', 'A cloud']);
        if (i === 0) {
          await E.say('hermit', 'Hrrm! Correct. A towel. Nobody ever gets it. Here.');
          E.setFlag('got_batteries');
          await E.give('batteries');
        } else if (i === 1) {
          await E.say('hermit', 'HA! No. An umbrella gets wet and then it just drips on everybody. Try again later.');
        } else {
          await E.say('momo', 'Clouds don\'t dry... they just rain until they\'re empty.', 'gloomy');
          await E.say('hermit', '...Hrrm. Sad, but no. Try again later.');
        }
      },
    },
    {
      id: 'sockshop', x: 6, y: 15, sprite: 'npc_sockpuppet', dir: 'down', dh: 74,
      async run(E) {
        if (!E.flag('met_sock')) {
          E.setFlag('met_sock');
          await E.say('sockpuppet', 'Welcome to SOCK\'S SNACKS! I\'m a sock AND a puppet. Double the identity crisis!');
          await E.say('sockpuppet', 'My other half got lost in the laundry. So now I sell things. It helps.');
        }
        await E.shop(['toast', 'pancakes', 'jelly', 'cocoa', 'soup', 'cake', 'popper', 'snowglobe', 'kazoo', 'tea', 'st_paw', 'st_smile', 'st_star'], { title: "SOCK'S SNACKS" });
      },
    },
    {
      id: 'bunnykid', x: 9, y: 9, sprite: 'npc_bunny', dir: 'down', dh: 46, move: 'wander', radius: 2,
      async run(E) {
        if (E.flag('static_down')) { await E.say('bunny', 'Hee hee! Hee hee hee! I remembered how!'); return; }
        await E.say('bunny', 'Do you know any jokes? We forgot how to laugh.');
        const i = await E.ask('pim', 'Um...', ['Why did the cookie go to the doctor?', 'Knock knock!'], 'neutral');
        if (i === 0) { await E.say('pim', 'Because it felt crummy!', 'cheery'); await E.say('bunny', '...'); await E.say('bunny', 'I don\'t get it.'); await E.say('biscuit', 'Nobody gets it, Pim.', 'neutral'); }
        else { await E.say('bunny', 'Who\'s there?'); await E.say('pim', 'Interrupting cow!', 'cheery'); await E.say('bunny', 'Interrupting c-'); await E.say('pim', 'MOO!', 'cheery'); await E.say('bunny', '...'); await E.say('bunny', 'That was scary.'); }
      },
    },
    { id: 'bunny2', x: 16, y: 12, sprite: 'npc_bunny', dir: 'left', dh: 46, async run(E) { await E.say('bunny', 'The big family used to drop SO much popcorn. Those were the days.'); await E.say('bunny', 'Now the little one eats cereal on the couch alone. Only soggy bits fall down.'); await E.say('pim', '...', 'forced'); } },
    { id: 'king', x: 17, y: 7, sprite: 'npc_remoteking', dir: 'down', dh: 70,
      async run(E) {
        if (E.flag('found_remote')) { await E.say('remoteking', 'My scepter! You found my scepter! ...You can borrow it. Just don\'t press the red button. Nobody knows what it does.'); return; }
        await E.say('remoteking', 'I am the REMOTE KING, ruler of all channels! I have misplaced my scepter. Temporarily. Permanently. One of those.');
      },
    },
    scrapEvent('scrap_village', 23, 12),
  ],
  async onFirst(E) {
    await E.wait(20);
    await E.say('waffles', 'It\'s under the couch! It\'s so COZY down here!', 'cheery');
    await E.say('biscuit', 'I\'ve lost so many toys under here.', 'gloomy');
  },
};

// ---- static woods: the channel puzzle ----
const CHANNELS = ['cartoon', 'soap', 'news'];
const CH_ICON = { cartoon: 'cheery', soap: 'gloomy', news: 'huffy' };
function tvPost(id, x, y, idx) {
  return {
    id, x, y, solid: true,
    draw2(ctx, ev, t) {
      const img = Assets.get('p_tv_small');
      if (img) { const dh = 74, dw = dh * img.width / img.height; ctx.drawImage(img, -dw / 2, -dh, dw, dh); }
      else {
        ctx.lineWidth = 2.5; ctx.strokeStyle = Gfx.C.ink;
        ctx.fillStyle = '#b7a6c9'; Gfx.roundRect(ctx, -24, -62, 48, 40, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#7d6d8f'; ctx.fillRect(-4, -22, 8, 18); ctx.strokeRect(-4, -22, 8, 18);
      }
      const v = State.v('tv_' + idx);
      ctx.save();
      ctx.beginPath(); ctx.rect(-17, -57, 34, 28); ctx.clip();
      if (!v) { for (let i = 0; i < 30; i++) { ctx.fillStyle = Math.random() < 0.5 ? '#fff' : '#555'; ctx.fillRect(-17 + Math.random() * 34, -57 + Math.random() * 28, 3, 2); } }
      else { ctx.fillStyle = MOODS[CH_ICON[CHANNELS[v - 1]]].color; ctx.fillRect(-17, -57, 34, 28); Gfx.icon(ctx, CH_ICON[CHANNELS[v - 1]], 0, -43, 9); }
      ctx.restore();
    },
    async run(E) {
      if (State.flag('channels_solved')) { await E.say(null, 'The little TV hums happily.'); return; }
      if (!E.has('remote')) { await E.say(null, 'A little TV on a post. It only shows static.'); await E.say('biscuit', 'We need that remote.', 'neutral'); return; }
      if (!E.has('batteries')) { await E.say(null, 'Pim points the remote at the TV and presses the button. Nothing happens.'); await E.say('momo', 'Maybe it needs batteries?', 'neutral'); return; }
      E.sfx('sfx_tv_on');
      const v = (State.v('tv_' + idx) % 3) + 1;
      State.setV('tv_' + idx, v);
      await E.say(null, `Click! The TV switches to the ${['', '{c:yellow}CARTOON{/c}', '{c:blue}SOAP OPERA{/c}', '{c:red}NEWS{/c}'][v]} channel.`);
      const want = [1, 2, 3];
      if ([0, 1, 2].every((i) => State.v('tv_' + i) === want[i])) {
        State.setFlag('channels_solved');
        E.sfx('sfx_static');
        E.flash('#ffffff', 0.7, 30);
        E.shake(4, 20);
        await E.say(null, 'All three TVs flicker in sync... and the wall of static to the north fizzles away!');
        E.refresh();
      }
    },
  };
}

MAPS.static_woods = {
  name: 'Static Woods', area: 'Static Woods',
  tiles: buildTiles(30, 22, '#', [
    ['rect', 25, 10, 5, 3, 's'],
    ['path', [[26, 11], [20, 11], [20, 5], [10, 5], [10, 15], [4, 15], [4, 9]], 3, 's'],
    ['ellipse', 15, 10, 4, 3, 's'], ['ellipse', 4, 6, 3.5, 3, 's'], ['rect', 3, 0, 3, 4, 's'],
  ]),
  legend: { s: { mat: 'static', soft: true, outline: '#1e1c24', c1: '#8f8b96', c2: '#5f5b68' } },
  voidColor: '#121016',
  paintVoid: (g, map) => { const r = U.rng(9); for (let i = 0; i < 900; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.3)'; g.fillRect(r() * map.w * TS, r() * map.h * TS, 3, 2); } },
  dark: 0.6, playerLight: 180, weather: 'static',
  bgm: 'bgm_static', amb: () => 'amb_static', ambVol: 0.5,
  props: [
    ['antenna_tree', 24, 7], ['antenna_tree', 17, 4], ['antenna_tree', 13, 13], ['antenna_tree', 7, 12], ['antenna_tree', 1, 5],
    ['cable', 22, 13, { len: 4 }], ['cable', 12, 8, { len: 3 }], ['cable', 5, 17, { len: 5 }],
    ['tv_small', 18, 12], ['tv_small', 23, 9],
  ],
  exits: [
    { x: 29, y: 10, h: 3, to: 'carpet_1', tx: 1, ty: 14, tdir: 'right', dir: 'right' },
    { x: 3, y: 0, w: 3, to: 'static_heart', tx: 9, ty: 13, tdir: 'up', dir: 'up' },
  ],
  events: [
    tvPost('tv0', 6, 15, 0), tvPost('tv1', 8, 15, 1), tvPost('tv2', 10, 17, 2),
    signEvent('sign_s', 12, 16, ['A note, in a little kid\'s handwriting:', '"TV NIGHT RULES: first CARTOONS with Dad. then Mom\'s SAD SHOW (tissues!!). then the GRUMPY NEWS and Dad yells at the weather man."']),
    {
      id: 'static_gate', x: 4, y: 9, w: 3, solid: true, cond: () => !State.flag('channels_solved'),
      draw2(ctx, ev, t) {
        for (let i = 0; i < 90; i++) { ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.8)' : 'rgba(30,30,40,0.8)'; ctx.fillRect(-TS / 2 + Math.random() * TS * 3, -TS * 1.6 + Math.random() * TS * 1.6, 4, 3); }
      },
      async run(E) { await E.say(null, 'A thick wall of TV static. It hisses at you.'); await E.say('momo', 'Those little TVs back there... maybe they control it?', 'neutral'); },
    },
    {
      id: 'memory_tv', x: 15, y: 9, sprite: 'p_tv_small', dh: 74, still: true, light: 110,
      async run(E) {
        if (!E.flag('seen_tv_memory')) {
          E.setFlag('seen_tv_memory');
          E.sfx('sfx_tv_on');
          await E.say(null, 'The screen flickers. For a moment, there\'s a picture:');
          await E.say(null, 'A family on a couch. A dad laughing so hard that he snorts. A mom laughing at the dad for snorting.');
          await E.say(null, 'And a little girl in the middle, laughing because they\'re laughing.');
          await E.say('pim', '...', 'forced');
          await E.say('biscuit', 'That was a good night.', 'gloomy');
          await E.say('waffles', 'There was SO much popcorn.', 'gloomy');
          return;
        }
        await E.say(null, 'Static.');
      },
    },
    scrapEvent('scrap_static', 18, 8),
    presentEvent('gift_st', 22, 5, 'cocoa', 1, { color: '#c9c6cf' }),
  ],
  enemies: [
    { troop: 'static_1', sprite: 'en_staticghost', x: 21, y: 8, dh: 64, chase: 5 },
    { troop: 'static_2', sprite: 'en_staticghost', x: 12, y: 11, dh: 64, chase: 4 },
    { troop: 'static_3', sprite: 'en_remote', x: 5, y: 12, dh: 60, chase: 4 },
  ],
  async onFirst(E) {
    await E.wait(20);
    await E.say('waffles', 'I don\'t like it here. It\'s too quiet. Why is it so quiet?', 'gloomy');
    await E.say('biscuit', 'It\'s not quiet. Listen. That hiss. It\'s the TV nobody turned off.', 'neutral');
  },
};

MAPS.static_heart = {
  name: 'The Glowing Box', area: 'Static Woods',
  tiles: buildTiles(20, 16, '#', [['ellipse', 10, 7, 8.5, 6, 's'], ['rect', 8, 12, 4, 4, 's']]),
  legend: { s: { mat: 'static', soft: true, outline: '#1e1c24', c1: '#8f8b96', c2: '#5f5b68' } },
  voidColor: '#121016', dark: 0.5, playerLight: 190, weather: 'static',
  bgm: () => (State.flag('static_down') ? 'bgm_carpet' : 'bgm_static'), amb: () => 'amb_static', ambVol: 0.6,
  props: [['tv_giant', 8, 2], ['antenna_tree', 4, 5], ['antenna_tree', 15, 5], ['cable', 6, 9, { len: 3 }], ['cable', 12, 10, { len: 3 }]],
  exits: [{ x: 8, y: 15, w: 4, to: 'static_woods', tx: 4, ty: 1, tdir: 'down', dir: 'down' }],
  events: [
    saveEvent('save_sh', 5, 11, 'A little TV shows a warm, crackling fireplace. Everyone feels rested.'),
    { id: 'boss_zone', x: 2, y: 6, w: 17, trigger: 'touch', solid: false, cond: () => !State.flag('static_down'), async run(E) { await Story.staticFight(E); } },   // the whole width
    { id: 'static_tv', x: 8, y: 3, w: 4, solid: false, cond: () => !State.flag('static_down'), async run(E) { await Story.staticFight(E); } },
  ],
};

Object.assign(Story, {
  async staticFight(E) {
    E.sfx('sfx_tv_on');
    E.flash('#ffffff', 0.6, 20);
    await E.say(null, 'The enormous TV flickers to life. Its screen is a storm of static.');
    await E.say('thestatic', 'ssshhhh... sssssshhhh...');
    await E.say('thestatic', 'NO ONE IS WATCHING. NO ONE WATCHES ANYMORE.');
    await E.say('pim', 'We\'re watching! We\'re right here!', 'huffy');
    await E.say('thestatic', 'NO. YOU\'RE NOT. YOU\'RE ALL TOO BUSY PRETENDING EVERYTHING IS FINE.');
    await E.say('thestatic', 'THE HAPPY FAMILY SHOW HAS BEEN CANCELLED.');
    await E.say('pim', 'It was NOT cancelled! It\'s just... on a break!', 'huffy');
    const r = await E.battle('boss_static');
    if (r !== 'win') return;
    State.setFlag('static_down');
    E.stopBgm(2);
    await E.wait(30);
    E.sfx('sfx_tv_on');
    await E.say(null, 'The static clears. On the giant screen: a family on a couch, laughing and laughing.');
    await E.say(null, 'A little cassette tape clatters out of the TV.');
    await E.give('laugh_track');
    await E.say(null, 'Far away, under the Great Couch, the dust bunnies start to giggle.');
    await E.wait(30);
    const sun = E.spawn({ id: 'sun', x: 9, y: 0, sprite: 'npc_sun', dh: 170, solid: false, still: true, alpha: 0 });
    if (sun) { sun.fy = -1; Game.tween(sun, { alpha: 1, fy: 0.4 }, 90); }
    await E.wait(80);
    await E.say('sun', 'Heh... heh heh...');
    await E.say('sun', 'That show... Dad always snorted...');
    await E.say('sun', '...but it\'s so cold out there... five more minutes...');
    await E.say('pim', 'No! Come on! I brought laughing! Please!', 'huffy');
    if (sun) await Game.tween(sun, { alpha: 0, fy: -1 }, 80, U.ease.inQuad);
    await E.wait(30);
    await E.say('biscuit', 'Pim. Maybe the Sun doesn\'t want to be woken up.', 'gloomy');
    await E.say('pim', 'It HAS to! If it doesn\'t, then...', 'huffy');
    await E.say('momo', 'Then what, Pim?', 'neutral');
    await E.wait(40);
    await E.say('pim', '...Then it\'s my fault.', 'forced');
    await E.say('waffles', 'Pim...', 'gloomy');
    await E.say(null, 'Somewhere far away, a dog is barking. A real one.');
    State.d.chapter = 4;
    await Story.wakeUp(E, 'Saturday');
  },
});
