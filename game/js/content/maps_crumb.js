'use strict';
// ---------------------------------------------------------------------------
// CRUMB VALLEY — the kitchen table, blown up into a candy-bright valley.
// ---------------------------------------------------------------------------
CHARACTERS.grumbles = { name: 'GRUMBLES', color: '#f0a07a', voice: 'sfx_blip_low', pitch: 0.9 };
CHARACTERS.ant = { name: 'SUGAR ANT', color: '#f4e6c8', voice: 'sfx_blip_high', pitch: 1.5 };

const crumbVoid = (g, map) => {
  // far below the table: a dim kitchen floor with tiles
  g.fillStyle = '#3b2f49'; g.fillRect(0, 0, map.w * TS, map.h * TS);
  g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 2;
  for (let x = 0; x < map.w * TS; x += 96) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, map.h * TS); g.stroke(); }
  for (let y = 0; y < map.h * TS; y += 96) { g.beginPath(); g.moveTo(0, y); g.lineTo(map.w * TS, y); g.stroke(); }
};
const ginghamLegend = { g: { mat: 'gingham', outline: '#b5707c', soft: true, c1: '#fffaf2', c2: '#f59aa5' }, p: { mat: 'dirt', c1: '#f3b9c2', c2: '#e28f9d', outline: '#b5707c' } };

MAPS.crumb_1 = {
  name: 'Tablecloth Plains', area: 'Crumb Valley',
  tiles: buildTiles(30, 20, '#', [
    ['ellipse', 9, 10, 8.5, 7.5, 'g'], ['ellipse', 20, 9, 9.5, 7, 'g'], ['rect', 4, 4, 22, 12, 'g'],
    ['rect', 0, 9, 3, 2, 'g'], ['rect', 26, 9, 4, 2, 'g'],
    ['ellipse', 15, 3.5, 2.2, 1.4, '#'], ['ellipse', 14.5, 16.5, 2, 1.2, '#'],
  ]),
  legend: ginghamLegend,
  voidColor: '#3b2f49', paintVoid: crumbVoid,
  weather: 'drizzle',
  bgm: 'bgm_crumb', amb: () => 'amb_rain_light', ambVol: 0.35,
  props: [
    ['cereal_box', 5, 5], ['milk_carton', 22, 5], ['salt', 12, 12], ['pepper', 13, 12], ['bread', 18, 13], ['butter', 20, 13],
    ['jam_jar', 8, 14], ['sugar_cube', 16, 6], ['sugar_cube', 17, 7], ['fork_fence', 3, 6], ['fork_fence', 3, 7],
    ['crumbs', 7, 9], ['crumbs', 14, 9], ['crumbs', 24, 12], ['crumbs', 19, 6], ['crumbs', 10, 15],
  ],
  exits: [
    { x: 0, y: 9, h: 2, to: 'fort', tx: 24, ty: 9, tdir: 'left', dir: 'left' },
    { x: 29, y: 9, h: 2, to: 'crumb_town', tx: 1, ty: 10, tdir: 'right', dir: 'right' },
  ],
  events: [
    signEvent('sign1', 3, 11, ['{c:orange}TEACUP TOWN{/c} - east.', '{c:orange}TOASTER PEAK{/c} - far, far north.', 'Beware of crumbs.']),
    presentEvent('gift_c1a', 4, 12, 'cookie', 2),
    presentEvent('gift_c1b', 25, 6, 'balloon', 2, { color: '#9fd8ff' }),
    presentEvent('gift_c1c', 16, 15, 'marbles', 12, { color: '#b8f0a8' }),
    scrapEvent('scrap_c1', 6, 4),
  ],
  enemies: [
    { troop: 'crumb_1', sprite: 'en_toast', x: 11, y: 10, dh: 64, chase: 4 },
    { troop: 'crumb_2', sprite: 'en_lemon', x: 19, y: 7, dh: 56, chase: 4 },
    { troop: 'crumb_3', sprite: 'en_sugarmite', x: 23, y: 11, dh: 48, chase: 5, chaseSpeed: 1 / 9 },
  ],
  async onFirst(E) {
    await E.wait(20);
    await E.say('waffles', 'It\'s the KITCHEN! But GIANT! Look, a cereal box as big as a house!', 'cheery');
    await E.say('biscuit', 'I\'ve knocked that off the counter a hundred times. It\'s much less satisfying at this size.', 'neutral');
    await E.say('pim', 'Look over there! Something\'s moving!', 'surprised');
    await E.say('biscuit', 'Feelings. Walk into them and we\'ll fight. Or sneak around them. Your choice, boss.', 'neutral');
  },
};

MAPS.crumb_town = {
  name: 'Teacup Town', area: 'Teacup Town',
  tiles: buildTiles(28, 20, '#', [
    ['ellipse', 14, 10, 13.5, 9, 'g'], ['rect', 2, 3, 24, 14, 'g'], ['rect', 0, 9, 3, 2, 'g'], ['rect', 13, 0, 2, 4, 'g'],
    ['path', [[1, 9], [13, 9], [13, 1]], 2, 'p'], ['path', [[13, 10], [22, 10]], 2, 'p'],
  ]),
  legend: Object.assign({}, ginghamLegend, { g: { mat: 'gingham', outline: '#7f93b8', soft: true, c1: '#fffaf2', c2: '#9dc3f0' } }),
  voidColor: '#3b2f49', paintVoid: crumbVoid,
  weather: 'drizzle',
  bgm: 'bgm_town', amb: () => 'amb_rain_light', ambVol: 0.3,
  props: [
    ['teacup_house', 4, 4], ['teacup_house2', 8, 3], ['teapot_house', 17, 3], ['teacup_house', 22, 5], ['teacup_house2', 4, 13],
    ['sugar_bowl', 21, 14], ['candle_light', 11, 7], ['jam_jar', 25, 9], ['butter', 7, 12], ['crumbs', 16, 13], ['crumbs', 9, 6],
    { id: 'fork_fence', x: 14, y: 2, cond: () => !State.flag('ladle_moved') },
    ['string_lights', 3, 11, { len: 6, hgt: 150 }], ['string_lights', 17, 9, { len: 6, hgt: 160 }],
  ],
  exits: [
    { x: 0, y: 9, h: 2, to: 'crumb_1', tx: 28, ty: 9, tdir: 'left', dir: 'left' },
    { x: 13, y: 0, w: 2, to: 'crumb_river', tx: 12, ty: 20, tdir: 'up', dir: 'up' },
  ],
  events: [
    saveEvent('save', 11, 8, 'A little candle flickers warmly. Everyone feels rested.'),
    presentEvent('gift_town', 25, 12, 'toast', 1),
    {
      id: 'teapot', x: 18, y: 6, sprite: 'npc_teapot', dir: 'down', dh: 86,
      async run(E) {
        if (!E.flag('met_teapot')) {
          E.setFlag('met_teapot');
          await E.say('teapot', 'Oh, my stars! Visitors! Hoo-hoo! And a little girl with an umbrella!');
          await E.say('teapot', 'Come in, come in, out of the rain! ...Well, you can\'t come IN, I\'m a teapot. But come close, dear.');
          await E.say('pim', 'Hi! I\'m Pim. We\'re going to wake up the Sun!', 'cheery');
          await E.say('teapot', 'The Sun! Oh, my. The Sun used to rise every morning from Toaster Peak, golden and warm, like the perfect slice of toast.');
          await E.say('teapot', 'But the toaster up there, Grumbles, got so very cross. Now he only makes burnt toast, and the Sun just rolls over and goes back to sleep.');
          await E.say('teapot', 'Toaster Peak is north, across the Milk River. Sergeant Ladle guards the road. He\'s all bark and no bite. Like a ladle.');
          await E.say('biscuit', 'Ladles don\'t bark.', 'neutral');
          await E.say('teapot', 'Exactly, dear. Hoo-hoo!');
          return;
        }
        if (State.d.chapter >= 3 && !E.flag('teapot_later')) {
          E.setFlag('teapot_later');
          await E.say('teapot', 'Oh, my dears, you came back! The whole valley still smells like toast.');
          await E.say('teapot', 'Grumbles bakes every single morning now. He says it\'s "for the table". Hoo-hoo!');
        }
        if (E.flag('momo_joined') && !E.flag('teapot_momo')) {
          E.setFlag('teapot_momo');
          await E.say('teapot', 'Oh, is that a little cloud? How precious. You look like you\'ve been crying, sweetheart.');
          await E.say('momo', 'I... I\'m always a little bit rainy. I\'m sorry.', 'gloomy');
          await E.say('teapot', 'Don\'t be sorry. So am I, when I\'m full to the brim. It\'s nothing to apologise for.');
        }
        const i = await E.ask('teapot', 'Would you like a cup of tea, dears? I haven\'t had anyone to pour for in ever so long.', ['Yes, please!', 'No thanks']);
        if (i === 0) {
          E.sfx('sfx_heal');
          State.healAll();
          await E.say(null, 'Everyone has a cup of tea. It\'s warm all the way down. (Everyone\'s HEART and PEP are restored!)');
          await E.say('teapot', 'Hoo-hoo! Come back any time.');
        }
      },
    },
    {
      id: 'salt', x: 7, y: 7, sprite: 'npc_salt', dir: 'right', dh: 70,
      async run(E) {
        const n = E.addV('saltpepper') % 3;
        if (n === 1) { await E.say('salt', 'Hmph. Pepper is in a mood again.'); await E.say('pepper', 'I am NOT in a mood.'); await E.say('salt', 'You\'re being a little bit peppery.'); await E.say('pepper', 'I\'m PEPPER.'); }
        else if (n === 2) { await E.say('pepper', 'Achoo!'); await E.say('salt', 'Every. Single. Time.'); }
        else { await E.say('salt', 'We\'ve been arguing for eleven years.'); await E.say('pepper', 'Twelve.'); await E.say('salt', 'SEE?!'); }
      },
    },
    { id: 'pepper', x: 8, y: 7, sprite: 'npc_pepper', dir: 'left', dh: 74, async run(E) { await E.say('pepper', 'Don\'t listen to Salt. Salt is always salty.'); await E.say('salt', 'I heard that.'); } },
    {
      id: 'ladle', x: 13, y: 2, sprite: 'npc_ladle', dir: 'down', dh: 82,
      async run(E, ev) {
        if (!E.flag('momo_joined')) {
          await E.say('ladle', 'HALT! Who goes there?!');
          await E.say('pim', 'Pim! And Biscuit and Waffles!', 'cheery');
          await E.say('ladle', 'The road to Toaster Peak is CLOSED! The Milk River has swallowed the bridge!');
          await E.say('ladle', 'And regulations state that a party must have at least FOUR members to attempt a crossing!');
          await E.say('biscuit', 'That is not a real rule.', 'huffy');
          await E.say('ladle', 'It IS a real rule! I made it up myself! This morning!');
          await E.say('waffles', 'We need another friend! Let\'s find a friend!', 'cheery');
          return;
        }
        if (!E.flag('ladle_moved')) {
          await E.say('ladle', 'One, two, three... FOUR! Regulations satisfied!');
          await E.say('ladle', 'I\'d recommend pushing sugar cubes into the river. Sugar cubes float. Or sink. One of the two.');
          await E.move(ev, 'L', { through: true });
          E.face(ev, 'right');
          E.setFlag('ladle_moved');
          E.scene.refreshEvents();
          E.scene.props.forEach((p) => { if (p.id === 'fork_fence' && p.x === 14 && p.y === 2) { p.visible = false; E.scene.setBlock(14, 2, false); } });
          await E.say('ladle', 'Carry on! Chin up! Handle out!');
          return;
        }
        if (State.d.chapter >= 3) { await E.say('ladle', 'I have abolished the four-member rule! It has been replaced with a five-member rule.'); await E.say('ladle', '...You may pass anyway. You have a sheep. Sheep count double.'); return; }
        await E.say('ladle', 'The road is open! Mind the milk!');
      },
    },
    {
      id: 'egg', x: 6, y: 16, sprite: 'npc_egg', dir: 'down', dh: 58,
      async run(E) {
        if (E.flag('egg_helped')) { await E.say('egg', 'The crack is still there. But it doesn\'t hurt so much with the band-aid. Thanks, Pim.'); return; }
        await E.say('egg', 'I fell off the counter. Now I\'ve got a crack right down my side.');
        await E.say('pim', 'You look fine to me!', 'cheery');
        await E.say('egg', '...That\'s what everyone says. "You look fine." "You\'re fine."');
        await E.say('egg', 'I don\'t FEEL fine. I feel cracked.');
        await E.say('pim', '...', 'forced');
        if (State.itemCount('st_bandaid') > 0 || Object.values(State.d.actors).some((a) => a.sticker === 'st_bandaid')) {
          const i = await E.ask('pim', '{c:grey}(Give the Band-Aid sticker to Egg?){/c}', ['Give it', 'Keep it'], 'neutral');
          if (i === 0) {
            if (State.itemCount('st_bandaid') > 0) State.removeItem('st_bandaid');
            else for (const a of Object.values(State.d.actors)) if (a.sticker === 'st_bandaid') { a.sticker = null; break; }
            E.setFlag('egg_helped');
            await E.say(null, 'Pim puts the band-aid over Egg\'s crack. Very gently.');
            await E.say('egg', '...Oh.');
            await E.say('egg', 'You didn\'t say I was fine. You helped me with the crack instead.');
            await E.say('egg', 'That\'s different. That\'s much better. Here - I found this rolling around. I want you to have it.');
            await E.give('st_heart');
          }
        }
      },
    },
    { id: 'muffin', x: 10, y: 15, sprite: 'npc_muffin', dir: 'down', dh: 56, async run(E) {
      if (State.d.chapter >= 3) { await E.say(null, 'Muffin is still asleep. Some things never change.'); await E.say('muffin', '...zzz... toast... zzz...'); return; }
      await E.say('muffin', 'Mmmh... is it morning yet...?'); await E.say('muffin', '...five more minutes...'); await E.say('biscuit', 'Relatable.', 'neutral');
    } },
    {
      id: 'kid1', x: 20, y: 8, sprite: 'npc_sprinkle', dir: 'down', dh: 52, move: 'wander', radius: 2,
      async run(E) { await E.say('sprinkle', 'Tag! You\'re it!'); await E.say('sprinkle', '...Wait, you\'re too slow. You\'re not it anymore.'); },
    },
    {
      id: 'kid2', x: 16, y: 15, sprite: 'npc_sprinkle', dir: 'down', dh: 52, move: 'look',
      async run(E) {
        await E.say('sprinkle', 'My mom says big kids don\'t cry.');
        await E.say('pim', '...Yeah. That\'s right.', 'forced');
        await E.say('biscuit', '{small}Says who.{/small}', 'huffy');
      },
    },
    {
      id: 'gumball', x: 19, y: 11, sprite: 'npc_gumball', dir: 'down', dh: 84,
      async run(E) {
        if (!E.flag('met_gumball')) {
          E.setFlag('met_gumball');
          await E.say('gumball', 'WELCOME TO GUMBALL\'S! Everything costs marbles!');
          await E.say('gumball', 'Don\'t ask me why. I\'m a gumball machine. I don\'t make the rules. I just dispense.');
        }
        await E.shop(['cookie', 'toast', 'gummy', 'warm_milk', 'lemonade', 'bubbles', 'balloon', 'cushion', 'duck', 'st_bandaid'], { title: "GUMBALL'S" });
      },
    },
    {
      id: 'momo_npc', x: 23, y: 15, sprite: 'chr_momo', dir: 'left', cond: () => !State.flag('momo_joined'),
      async run(E, ev) { await Story.meetMomo(E, ev); },
    },
  ],
  async onFirst(E) {
    await E.wait(20);
    await E.say('waffles', 'A TOWN! With teacups! Can we live here?', 'cheery');
    await E.say('pim', 'Maybe someone here knows how to wake the Sun.', 'neutral');
  },
};

Object.assign(Story, {
  async meetMomo(E, ev) {
    await E.say(null, 'Behind the sugar bowl, a small fluffy cloud is crying little raindrops.');
    await E.say('momo', '*sniff*... Oh! I\'m sorry. I\'m sorry, I\'ll stop. I don\'t want to get you wet.', 'gloomy');
    await E.say('pim', 'It\'s okay! I have an umbrella!', 'cheery');
    await E.say('pim', '...Why are you crying?', 'neutral');
    await E.say('momo', 'I don\'t know. I don\'t remember anything. I just woke up here, and I felt so heavy. Like a cloud that\'s too full.', 'gloomy');
    await E.say('waffles', 'Aww! Let\'s be friends! I\'m Waffles! Do you like belly rubs?', 'cheery');
    await E.say('biscuit', 'She\'s a cloud. With legs. And she\'s damp.', 'neutral');
    await E.say('momo', 'S-sorry...', 'gloomy');
    await E.say('pim', 'We\'re going to wake up the Sun! Do you want to come?', 'cheery');
    await E.say('momo', '...The Sun?', 'neutral');
    await E.say('momo', 'That sounds nice. I think... I think I\'d like to see it again.', 'cheery');
    await E.say('pim', 'What\'s your name?', 'neutral');
    await E.say('momo', 'My name...? Momo. I think it\'s Momo. Someone used to call me that. A long time ago.', 'neutral');
    await E.say('pim', '{c:grey}(Momo? That\'s the name of my plush sheep. The one Mom gave me when I was little.){/c}', 'surprised');
    E.setFlag('momo_joined');
    await E.fadeOut(12);
    E.removeEvent('momo_npc');
    State.addParty('momo');
    const s = E.scene;
    s.followers.push(new Char({ id: 'momo', kind: 'follower', x: s.player.x, y: s.player.y, dir: s.player.dir, sprite: charSprite('momo', 'dream'), solid: false }));
    await E.fadeIn(12);
    E.sfx('sfx_baa');
    await E.say('momo', 'Baa!', 'cheery');
    E.sfx('sfx_mood_rainbow');
    await E.say(null, '{c:blue}MOMO{/c} joined the party! She can heal with {c:blue}Soft Rain{/c} and make things GLOOMY with {c:blue}Drizzle{/c}.');
  },
});

// ---- milk river with the sugar cube puzzle ----
const CUBE_START = { cube1: [12, 14], cube2: [9, 16], cube3: [15, 16], cube4: [13, 18] };
function sugarFilled(x, y) { return !!State.v('sug_' + x + '_' + y); }
function cubeEvent(id) {
  const [x, y] = CUBE_START[id];
  return {
    id, x, y, sprite: 'p_sugar_cube', dh: 54, pushable: true, solid: true, still: true, shadowW: 20, cond: () => !State.flag(id + '_sunk'),
    sinkInto(scene, tx, ty) { return scene.def.tiles[ty] && scene.def.tiles[ty][tx] === 'm' && !sugarFilled(tx, ty); },
    async onPushed(E, ev, scene) {
      const t = scene.def.tiles[ev.y][ev.x];
      if (t === 'm' && !sugarFilled(ev.x, ev.y)) {
        State.setV('sug_' + ev.x + '_' + ev.y, 1);
        State.setFlag(id + '_sunk');
        E.sfx('sfx_splash');
        scene.setBlock(ev.x, ev.y, false);
        scene.removeEvent(id);
        const left = ['cube1', 'cube2', 'cube3', 'cube4'].filter((c) => !State.flag(c + '_sunk')).length;
        if (!State.flag('river_hint')) { State.setFlag('river_hint'); await E.say('waffles', 'It\'s a stepping stone! A sweet one!', 'cheery'); }
        if (left === 0 && !MAPS.crumb_river.crossable()) await E.say('biscuit', 'We\'re out of sugar. Maybe ask that ant.', 'neutral');
      }
    },
  };
}
MAPS.crumb_river = {
  name: 'Milk River', area: 'Milk River',
  tiles: buildTiles(26, 22, '#', [
    ['rect', 2, 1, 22, 8, 'g'], ['rect', 2, 12, 22, 9, 'g'], ['rect', 0, 9, 26, 3, 'm'],
    ['rect', 12, 0, 2, 1, 'g'], ['rect', 12, 21, 2, 1, 'g'],
    ['ellipse', 3, 3.5, 2, 2, '#'], ['ellipse', 22, 18, 2, 2, '#'],
  ]),
  legend: Object.assign({}, ginghamLegend, { m: { mat: 'milk' } }),
  voidColor: '#3b2f49', paintVoid: crumbVoid,
  weather: 'drizzle',
  bgm: 'bgm_crumb', amb: () => 'amb_rain_light', ambVol: 0.35,
  crossable() {
    for (let x = 0; x < 26; x++) if ([9, 10, 11].every((y) => sugarFilled(x, y))) return true;
    return false;
  },
  drawGround(ctx, scene) {
    // sunk sugar cubes
    for (let y = 9; y <= 11; y++) for (let x = 0; x < 26; x++) {
      if (!sugarFilled(x, y)) continue;
      const px = x * TS, py = y * TS;
      ctx.fillStyle = '#fbfbff'; ctx.strokeStyle = '#8a93b0'; ctx.lineWidth = 2.5;
      Gfx.roundRect(ctx, px + 3, py + 3, TS - 6, TS - 6, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(180,190,220,0.5)'; ctx.fillRect(px + 8, py + 8, 6, 6); ctx.fillRect(px + 28, py + 26, 5, 5);
    }
    // floating cereal rings
    const t = scene.t;
    for (let i = 0; i < 7; i++) {
      const x = ((i * 173 + t * 0.35) % (26 * TS + 80)) - 40, y = 9 * TS + 20 + (i * 37) % 100 + Math.sin(t * 0.03 + i) * 4;
      ctx.strokeStyle = '#e9b86a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(x, y, 11, 6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(120,80,40,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  },
  props: [['bread', 4, 14], ['jam_jar', 20, 13], ['salt', 21, 4], ['crumbs', 8, 3], ['crumbs', 16, 15], ['sugar_bowl', 17, 18]],
  exits: [
    { x: 12, y: 21, w: 2, to: 'crumb_town', tx: 13, ty: 1, tdir: 'down', dir: 'down' },
    { x: 12, y: 0, w: 2, to: 'crumb_peak', tx: 9, ty: 17, tdir: 'up', dir: 'up' },
  ],
  events: [
    cubeEvent('cube1'), cubeEvent('cube2'), cubeEvent('cube3'), cubeEvent('cube4'),
    signEvent('sign_r', 15, 19, ['{c:blue}MILK RIVER{/c}', 'No swimming.', '(It\'s milk.)']),
    presentEvent('gift_r1', 4, 19, 'st_bandaid', 1, { color: '#ffd6a8' }),
    presentEvent('gift_r2', 21, 2, 'st_sun', 1, { color: '#ffe38a' }),
    presentEvent('gift_r3', 6, 6, 'warm_milk', 2, { color: '#dfe8ff' }),
    scrapEvent('scrap_river', 3, 7),
    {
      id: 'ant', x: 19, y: 15, sprite: 'npc_ant', dir: 'left', dh: 40,
      async run(E) {
        await E.say('ant', 'Oh! Hello! I\'m in charge of the sugar cubes around here. It\'s a big job for a small ant.');
        const i = await E.ask('ant', 'Want me to put the cubes that haven\'t sunk back where they started?', ['Yes please', 'No thanks']);
        if (i === 0) {
          const s = E.scene;
          for (const id of Object.keys(CUBE_START)) {
            if (State.flag(id + '_sunk')) continue;
            const ev = s.event(id);
            if (ev) E.setPos(ev, CUBE_START[id][0], CUBE_START[id][1]);
          }
          // if every cube sank and still no crossing, bring them all back
          if (Object.keys(CUBE_START).every((id) => State.flag(id + '_sunk')) && !MAPS.crumb_river.crossable()) {
            for (const id of Object.keys(CUBE_START)) State.setFlag(id + '_sunk', false);
            for (let y = 9; y <= 11; y++) for (let x = 0; x < 26; x++) if (sugarFilled(x, y)) { State.setV('sug_' + x + '_' + y, 0); s.setBlock(x, y, true); }
            s.refreshEvents();
          }
          E.sfx('sfx_push');
          await E.say('ant', 'Hup! Hup! There you go!');
        }
      },
    },
  ],
  enemies: [
    { troop: 'crumb_5', sprite: 'en_lemon', x: 6, y: 15, dh: 56, chase: 4 },
    { troop: 'crumb_4', sprite: 'en_forkling', x: 18, y: 4, dh: 64, chase: 4 },
    { troop: 'crumb_6', sprite: 'en_toast', x: 8, y: 3, dh: 64, chase: 4 },
  ],
  async onEnter(E) {
    const s = E.scene;
    for (let y = 9; y <= 11; y++) for (let x = 0; x < 26; x++) if (sugarFilled(x, y)) s.setBlock(x, y, false);
  },
  async onFirst(E) {
    await E.wait(20);
    await E.say('waffles', 'A river of MILK! Can I drink it?', 'cheery');
    await E.say('biscuit', 'Don\'t.', 'huffy');
    await E.say('momo', 'Those sugar cubes... maybe we could push them into the milk?', 'neutral');
  },
};

MAPS.crumb_peak = {
  name: 'Toaster Peak', area: 'Toaster Peak',
  tiles: buildTiles(20, 19, '#', [
    ['ellipse', 10, 4.5, 7.5, 3.5, 'c'],
    ['path', [[9, 17], [9, 14], [4, 14], [4, 10], [14, 10], [14, 7], [10, 7]], 2, 'c'],
    ['rect', 9, 17, 2, 2, 'c'], ['rect', 6, 12, 2, 2, 'c'],
  ]),
  legend: { c: { mat: 'dirt', soft: true, c1: '#f2d3a0', c2: '#d9ae72', outline: '#9a6a3c' } },
  voidColor: '#2e2640', paintVoid: starryVoid,
  weather: 'rain',
  bgm: () => (State.flag('grumbles_down') ? 'bgm_crumb' : 'bgm_crumb'), amb: () => 'amb_rain_heavy', ambVol: 0.35,
  props: [['toaster_big', 8, 2], ['candle_light', 7, 12], ['bread', 3, 4], ['butter', 16, 5], ['crumbs', 12, 10], ['crumbs', 5, 14]],
  exits: [{ x: 9, y: 18, w: 2, to: 'crumb_river', tx: 12, ty: 1, tdir: 'down', dir: 'down' }],
  events: [
    saveEvent('save', 6, 12, 'A little candle flickers on the mountainside. Everyone feels rested.'),
    {
      id: 'boss_zone', x: 6, y: 6, w: 8, trigger: 'touch', solid: false, cond: () => !State.flag('grumbles_down'),
      async run(E) { await Story.grumblesFight(E); },
    },
    {
      id: 'toaster_talk', x: 8, y: 3, w: 4, solid: false, cond: () => State.flag('grumbles_down'),
      async run(E) { await E.say('grumbles', 'Hrmph. Come back for breakfast sometime. I\'ll make it golden.'); },
    },
  ],
  enemies: [{ troop: 'crumb_6', sprite: 'en_toast', x: 12, y: 10, dh: 64, chase: 4, flag: 'peak_toast' }],
};

Object.assign(Story, {
  async grumblesFight(E) {
    await E.say(null, 'The huge toaster at the top of the mountain rattles. Smoke pours out of its slots.');
    E.shake(5, 20);
    await E.say('grumbles', 'WHO\'S THERE?! Nobody comes up here! NOBODY EVER COMES UP HERE!');
    await E.say('pim', 'We\'re here to wake up the Sun!', 'huffy');
    await E.say('grumbles', 'The SUN? HAH! You want TOAST? Here\'s your TOAST!');
    const r = await E.battle('boss_grumbles');
    if (r !== 'win') return;
    State.setFlag('grumbles_down');
    await E.wait(30);
    await E.say('grumbles', '...Hrmph.');
    await E.say('grumbles', 'Everybody used to sit at the big table, you know. Every morning. Toast, and eggs, and the radio on.');
    await E.say('grumbles', 'Then one chair was empty. Then two. Now nobody sits at the table at all.');
    await E.say('grumbles', 'What\'s the point of good toast if nobody eats it together?');
    await E.say('pim', '...I\'ll sit at the table with you.', 'neutral');
    await E.say('grumbles', '...You will?');
    E.sfx('sfx_toaster');
    E.flash('#fff3b0', 0.7, 40);
    await E.say(null, 'POP! A slice of toast flies out of Grumbles. It\'s perfectly, perfectly golden.');
    await E.give('sun_toast');
    await E.say('grumbles', 'That\'s the good stuff. Smells like Saturday.');
    // the sun stirs
    E.stopBgm(2);
    await E.wait(30);
    const sun = E.spawn({ id: 'sun', x: 9, y: 0, sprite: 'npc_sun', dh: 170, solid: false, still: true, alpha: 0 });
    if (sun) { sun.fy = -1; Game.tween(sun, { alpha: 1, fy: 0.6 }, 90, U.ease.outQuad); }
    E.flash('#fff6c8', 0.5, 60);
    await E.wait(80);
    await E.say('sun', 'Mmmmh... toast...?');
    await E.say('sun', 'Smells like... Saturday...');
    await E.say('pim', 'SUN! You\'re awake! Please get up! It\'s been raining forever!', 'surprised');
    await E.say('sun', '...five... more... minutes...');
    if (sun) await Game.tween(sun, { alpha: 0, fy: -1 }, 80, U.ease.inQuad);
    await E.say('waffles', 'Awww!', 'gloomy');
    await E.say('biscuit', 'Well. It moved. That\'s something.', 'neutral');
    await E.say('momo', 'It smiled a little. I saw it.', 'cheery');
    await E.say('pim', 'Then we just need MORE warm things! We\'ll find all of them, and then it\'ll HAVE to get up!', 'cheery');
    await E.say('momo', '...', 'gloomy');
    await E.wait(20);
    await E.say(null, 'Somewhere very far away, an alarm clock is ringing.');
    State.d.chapter = 2;
    await Story.wakeUp(E, 'The toast smelled like Saturday.');
  },
});
