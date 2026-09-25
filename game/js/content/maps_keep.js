'use strict';
// ---------------------------------------------------------------------------
// THE CLOUD KEEP — Mom's room as a castle in the rain.
// ---------------------------------------------------------------------------
CHARACTERS.wisp = { name: 'RAIN WISP', color: '#c6d4f0', voice: 'sfx_blip_momo', pitch: 1.2 };

const stormVoid = (g, map) => {
  const grd = g.createLinearGradient(0, 0, 0, map.h * TS);
  grd.addColorStop(0, '#2b2d4a'); grd.addColorStop(1, '#4b4f76');
  g.fillStyle = grd; g.fillRect(0, 0, map.w * TS, map.h * TS);
  const r = U.rng(U.hash(map.id + 'sky'));
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 40; i++) { Gfx.cloud(g, r() * map.w * TS, r() * map.h * TS, 40 + r() * 70); g.fill(); }
};
const cloudLegend = {
  k: { mat: 'cloud', c1: '#dcdcf2', c2: '#c5c3e6', outline: '#6f70a0' },
  W: { mat: 'wall', c1: '#cdd6e6', c2: '#bcc7db', trim: '#7d89a3', base: '#667189', style: 'flowers' },
  d: { mat: 'wall', walk: true, c1: '#cdd6e6', c2: '#bcc7db', trim: '#7d89a3', base: '#667189', style: 'flowers' },
};

function wispNpc(id, x, y, lines) {
  return {
    id, x, y, sprite: 'en_rainwisp', dh: 60, dir: 'down', move: 'look',
    async run(E) { for (const l of lines) await E.say('wisp', l); },
  };
}

MAPS.keep_1 = {
  name: 'Cloud Stairs', area: 'The Cloud Keep',
  tiles: buildTiles(22, 26, '#', [
    ['path', [[10, 24], [10, 20], [4, 20], [4, 15], [16, 15], [16, 10], [6, 10], [6, 5], [10, 5], [10, 1]], 3, 'k'],
    ['ellipse', 11, 22, 4, 2.5, 'k'], ['ellipse', 5, 12.5, 3, 3, 'k'], ['ellipse', 17, 7, 3.5, 3, 'k'], ['rect', 10, 0, 3, 2, 'k'],
  ]),
  legend: cloudLegend,
  voidColor: '#2b2d4a', paintVoid: stormVoid,
  weather: 'rain', tint: 'rgba(50,60,120,0.08)',
  bgm: 'bgm_keep', amb: () => 'amb_rain_heavy', ambVol: 0.5,
  props: [
    ['cloud_pillar', 7, 21], ['cloud_pillar', 14, 21], ['cloud_bush', 2, 17], ['cloud_bush', 18, 12], ['lantern', 13, 20],
    ['puddle', 8, 16], ['puddle', 12, 11], ['umbrella_stand', 19, 7], ['cloud_pillar', 3, 11], ['cloud_bush', 7, 3], ['lantern', 9, 6],
  ],
  exits: [
    { x: 10, y: 25, w: 3, to: 'fort', tx: 12, ty: 3, tdir: 'down', dir: 'down' },
    { x: 10, y: 0, w: 3, to: 'keep_2', tx: 13, ty: 16, tdir: 'up', dir: 'up' },
  ],
  events: [
    saveEvent('save_k1', 12, 20, 'A paper lantern glows in the rain. Everyone feels rested.'),
    wispNpc('wisp1', 5, 19, ['Shh. Shhh. She\'s sleeping.', 'She\'s been sleeping for so, so long.']),
    wispNpc('wisp2', 18, 8, ['She thinks she\'s letting everybody down.', 'Isn\'t that silly? She thinks it all the time.']),
    presentEvent('gift_k1', 3, 13, 'cocoa', 2, { color: '#c9dcff' }),
    presentEvent('gift_k2', 19, 5, 'st_moon', 1, { color: '#d8c8f0' }),
  ],
  enemies: [
    { troop: 'keep_1', sprite: 'en_rainwisp', x: 6, y: 15, dh: 64, chase: 4 },
    { troop: 'keep_2', sprite: 'en_thunderhead', x: 15, y: 11, dh: 70, chase: 5 },
    { troop: 'keep_4', sprite: 'en_umbrellabat', x: 7, y: 6, dh: 60, chase: 6, chaseSpeed: 1 / 9 },
  ],
  async onFirst(E) {
    await E.wait(20);
    await E.say('waffles', 'It\'s raining so hard up here.', 'gloomy');
    await E.say('biscuit', 'Of course it is. This is where all the rain comes from.', 'neutral');
    await E.say('momo', '...', 'gloomy');
  },
};

MAPS.keep_2 = {
  name: 'The Quiet Hall', area: 'The Cloud Keep',
  tiles: buildTiles(28, 18, '#', [['rect', 1, 1, 26, 2, 'W'], ['rect', 1, 3, 26, 12, 'k'], ['rect', 12, 15, 3, 3, 'k'], ['set', 13, 2, 'd'], ['set', 14, 2, 'd']]),
  legend: cloudLegend,
  voidColor: '#2b2d4a', paintVoid: stormVoid,
  weather: 'drizzle', tint: 'rgba(50,60,120,0.10)',
  bgm: 'bgm_keep', amb: () => 'amb_rain_heavy', ambVol: 0.4,
  props: [
    ['rain_window', 9, 1], ['rain_window', 17, 1], ['drawings', 3, 2], ['drawings', 6, 2], ['drawings', 21, 2], ['drawings', 24, 2],
    ['cloud_pillar', 4, 5], ['cloud_pillar', 4, 11], ['cloud_pillar', 23, 5], ['cloud_pillar', 23, 11],
    ['laundry_pile', 8, 7], ['laundry_pile', 19, 12], ['tissue_box', 16, 6], ['umbrella_stand', 21, 8], ['photo_stand', 15, 12],
    ['lantern', 7, 9], ['lantern', 20, 9], ['puddle', 11, 11], ['door_mom', 13, 1, { foot: [2, 2], dh: 100 }],
  ],
  exits: [
    { x: 12, y: 17, w: 3, to: 'keep_1', tx: 11, ty: 1, tdir: 'down', dir: 'down' },
    { x: 13, y: 2, w: 2, to: 'keep_3', tx: 9, ty: 13, tdir: 'up', dir: 'up', cond: () => State.flag('momo_reveal') },
  ],
  events: [
    saveEvent('save_k2', 7, 10, 'A paper lantern glows softly. Everyone feels rested.'),
    { id: 'draw1', x: 3, y: 2, w: 2, solid: false, async run(E) { await E.say(null, 'A crayon drawing: {c:orange}GET WELL SOON MOM{/c}, and a big yellow sun with a smiley face.'); await E.say('pim', '{c:grey}(I decided the sun should have a face.){/c}', 'neutral'); } },
    { id: 'draw2', x: 6, y: 2, w: 2, solid: false, async run(E) { await E.say(null, 'A drawing of Mom in bed, and Pim bringing toast. Pim drew herself smiling very, very big.'); } },
    { id: 'draw3', x: 21, y: 2, w: 2, solid: false, async run(E) { await E.say(null, 'A drawing of Dad. It\'s been scribbled out. Then un-scribbled. There are lots of eraser marks.'); } },
    { id: 'draw4', x: 24, y: 2, w: 2, solid: false, async run(E) { await E.say(null, 'A drawing of Biscuit and Waffles. Biscuit looks annoyed. It\'s very accurate.'); await E.say('biscuit', 'I look majestic.', 'neutral'); } },
    { id: 'tissues', x: 16, y: 6, solid: false, async run(E) { await E.say(null, 'A box of tissues. Nearly empty.'); } },
    { id: 'photostand', x: 15, y: 12, solid: false, async run(E) { await E.say(null, 'A photo of Pim on her first day of school, holding a lunchbox bigger than her head.'); await E.say(null, 'Someone has kissed the glass. There\'s a little lipstick mark.'); } },
    wispNpc('wisp3', 11, 8, ['She loves you, you know.', 'She\'s just very, very tired. It\'s the kind of tired sleep doesn\'t fix.']),
    wispNpc('wisp4', 18, 4, ['She tried to get up this morning. She really did.', 'Sometimes trying is all you can do.']),
    scrapEvent('scrap_keep', 25, 13),
    // everywhere in front of the door (both rows), so the door can't be reached without it
    { id: 'reveal_zone', x: 11, y: 3, w: 6, h: 2, trigger: 'touch', solid: false, cond: () => !State.flag('momo_reveal'), async run(E) { await Story.momoReveal(E); } },
    { id: 'hall_door', x: 13, y: 2, w: 2, solid: true, cond: () => !State.flag('momo_reveal'), async run(E) { await E.say(null, 'A big soft door. Rain is seeping out from under it.'); await Story.momoReveal(E); } },
  ],
  enemies: [
    { troop: 'keep_3', sprite: 'en_laundry', x: 9, y: 12, dh: 70, chase: 3 },
    { troop: 'keep_1', sprite: 'en_tissue', x: 19, y: 6, dh: 64, chase: 5 },
  ],
};

MAPS.keep_3 = {
  name: 'The Rain Queen', area: 'The Cloud Keep',
  tiles: buildTiles(20, 16, '#', [['ellipse', 10, 7, 9, 6.5, 'k'], ['rect', 8, 13, 3, 3, 'k']]),
  legend: cloudLegend,
  voidColor: '#1e2038', paintVoid: stormVoid,
  weather: 'storm', tint: 'rgba(40,45,100,0.14)',
  bgm: () => (State.flag('queen_done') ? 'bgm_final2' : null), amb: () => 'amb_rain_heavy', ambVol: 0.8,
  props: [['queen_throne', 8, 2], ['lantern', 3, 7], ['lantern', 16, 7], ['puddle', 5, 10], ['puddle', 13, 11], ['tissue_box', 14, 4]],
  exits: [{ x: 8, y: 15, w: 3, to: 'keep_2', tx: 13, ty: 3, tdir: 'down', dir: 'down', cond: () => !State.flag('queen_done') }],
  events: [
    { id: 'queen', x: 9, y: 3, w: 2, sprite: 'en_rainqueen', dh: 300, still: true, solid: true, face: false, cond: () => !State.flag('queen_done'), sortOff: 20, async run(E) { await Story.queenFight(E); } },
    { id: 'boss_zone', x: 2, y: 8, w: 17, trigger: 'touch', solid: false, cond: () => !State.flag('queen_done'), async run(E) { await Story.queenFight(E); } },   // the whole width
  ],
};

Object.assign(Story, {
  async momoReveal(E) {
    E.setFlag('momo_reveal');
    const m = E.char('momo');
    await E.wait(20);
    await E.say('momo', 'Pim... wait.', 'gloomy');
    E.face('player', 'down');
    await E.say('momo', 'I remember now. Where I came from.', 'neutral');
    await E.say('pim', 'Really?', 'surprised');
    await E.say('momo', 'I came from her. From the Queen, behind that door.', 'neutral');
    await E.say('momo', 'I\'m the part of her that wanted to hold you.', 'gloomy');
    await E.say('momo', 'When she couldn\'t get out of bed anymore... I floated out. To find you. So you wouldn\'t be alone.', 'gloomy');
    await E.say('pim', '...You\'re Mom?', 'surprised');
    await E.say('momo', 'A little piece of her. The piece that loves you.', 'cheery');
    await E.say('momo', 'That piece never went anywhere, Pim. It was just lost in the rain for a while.', 'cheery');
    await E.say('waffles', '*sniff* I\'m not crying. Dogs don\'t cry. It\'s rain. On my face.', 'gloomy');
    await E.say('biscuit', 'Sure it is.', 'gloomy');
    E.sfx('sfx_unlock');
    E.refresh();
    await E.say(null, 'The big soft door opens by itself.');
  },

  async queenFight(E) {
    E.stopBgm(2);
    await E.wait(20);
    await E.say(null, 'On a huge bed made of clouds, a Queen made of rain is crying. The whole room is raining with her.');
    await E.say('pim', 'Mom?', 'neutral');
    await E.say('queen', '...Pim? Oh, sweetie. You shouldn\'t be up here. It\'s so wet. You\'ll catch a cold.', 'sad');
    await E.say('pim', 'I came to wake up the Sun! I brought warm things! Toast! And laughing!', 'cheery');
    await E.say('queen', 'Oh, Pim...', 'sad');
    await E.say('queen', 'The Sun can\'t come out today. I\'m so tired. I\'m so tired of being tired.', 'sad');
    await E.say('pim', 'Then I\'ll make you better! I\'ll stop the rain! I have an umbrella!', 'huffy');
    await E.say('queen', 'Please don\'t fight the rain, sweetie. You\'ll only get tired too.', 'sad');
    await E.say('pim', 'I don\'t care! I promised!', 'huffy');
    const r = await E.battle('boss_queen', { keepMusic: true });
    State.setFlag('queen_done');
    E.refresh();
    await Story.afterQueen(E);
  },

  async afterQueen(E) {
    await E.wait(30);
    const pic = await E.picture('cg_queen', { fade: 90 });
    await E.say(null, 'The rain is still falling. But it\'s soft now, and warm, like a bath.');
    await E.say('queen', 'I\'m sorry you had to hold that umbrella all by yourself.', 'soft');
    await E.say('queen', 'I should have been the one holding it over you.', 'soft');
    await E.say('pim', 'Will you be okay?', 'cry');
    await E.say('queen', 'Not today. Maybe not tomorrow.', 'soft');
    await E.say('queen', 'But I\'m going to ask for help. Grown-up help. And I\'m going to keep asking until I\'m better.', 'soft');
    await E.say('queen', 'That\'s my job. Not yours.', 'soft');
    await E.hidePicture(pic, 60);
    // the sun
    const sun = E.spawn({ id: 'sun2', x: 9, y: 0, sprite: 'npc_sun', dh: 190, solid: false, still: true, alpha: 0 });
    if (sun) { sun.fy = -2; Game.tween(sun, { alpha: 1, fy: 0.3 }, 150, U.ease.outQuad); }
    E.weather('drizzle');
    E.flash('#fff6c8', 0.5, 120);
    await E.wait(150);
    await E.say('sun', '...Good morning.');
    await E.say('pim', 'You\'re awake! You\'re finally awake!', 'surprised');
    await E.say('sun', 'I was never really asleep, little one. I was just behind the clouds.');
    await E.say('sun', 'I\'m always here, even on the rainiest days. Sometimes you just can\'t see me for a while.');
    await E.say('sun', 'And the rain isn\'t the enemy, you know. Nothing grows without it.');
    await E.wait(30);
    await E.say('biscuit', 'Time to wake up, kid.', 'cheery');
    await E.say('waffles', 'We\'ll be right there when you do! We just won\'t talk. Probably. I\'ll try!', 'cheery');
    await E.say('pim', 'Momo...?', 'neutral');
    await E.say('queen', 'She\'s right here with me, Pim. She always was.', 'soft');
    await E.say('pim', '...Okay.', 'cheery');
    E.stopBgm(4);
    await E.fadeOut(120, '#fff8ec');
    State.d.chapter = 7;
    State.d.world = 'real';
    State.setParty(['pim']);
    State.healAll();
    Cutscene.stage({ bg: '#fff8ec' });
    await E.wait(60);
    await Cutscene.card('MORNING', null, { icon: 'sun', keepBg: true, bg: '#2a2230' });
    await E.place('hallway', 15, 3, 'right', { noBanner: true });
    await E.fadeIn(80);
  },
});
