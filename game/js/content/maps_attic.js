'use strict';
// ---------------------------------------------------------------------------
// THE ATTIC (dream) — Pim alone in the dark. Notes, a torn photo, the Coat.
// ---------------------------------------------------------------------------
const atticLegend = {
  W: { mat: 'wall', c1: '#4a3f47', c2: '#3f353d', trim: '#2a2229', base: '#231c22', style: 'planks' },
  d: { mat: 'wall', walk: true, c1: '#4a3f47', c2: '#3f353d', trim: '#2a2229', base: '#231c22', style: 'planks' },
  p: { mat: 'plank', c1: '#5d4d52', c2: '#4e4045' },
};
const atticFlicker = (scene) => {
  // the flashlight is almost out of batteries
  const base = scene.def.playerLight || 130;
  if (!scene._fl || scene.t % 7 === 0) scene._fl = Math.random() < 0.04 ? base * 0.35 : base * (0.92 + Math.random() * 0.1);
  scene.lightRadius = U.lerp(scene.lightRadius || base, scene._fl, 0.3);
};
function noteEvent(id, x, y, lines, o = {}) {
  return {
    id, x, y, solid: false,
    draw2(ctx, ev, t) {
      ctx.save(); ctx.rotate(o.rot || -0.15);
      ctx.fillStyle = o.color || '#f4efe0'; ctx.strokeStyle = Gfx.C.ink; ctx.lineWidth = 2;
      ctx.fillRect(-12, -22, 24, 18); ctx.strokeRect(-12, -22, 24, 18);
      ctx.strokeStyle = 'rgba(60,60,90,0.5)'; ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-8, -17 + i * 5); ctx.lineTo(8, -17 + i * 5); ctx.stroke(); }
      ctx.restore();
    },
    async run(E) { E.sfx('sfx_page'); for (const l of lines) await E.say(l[0], l[1], l[2]); if (o.after) await o.after(E); },
  };
}
function pieceEvent(id, x, y, o = {}) {
  return {
    id, x, y, solid: false, cond: () => !State.flag(id),
    draw2(ctx, ev, t) {
      const a = 0.6 + Math.sin(t * 0.1) * 0.3;
      ctx.globalAlpha = a; ctx.fillStyle = '#fff4c8';
      ctx.beginPath(); ctx.arc(0, -16, 14, 0, 7); ctx.fill();
      ctx.globalAlpha = 1; Gfx.icon(ctx, 'photo', 0, -16, 9);
    },
    async run(E) {
      State.setFlag(id);
      E.sfx('sfx_item');
      const n = E.addV('attic_pieces');
      await E.say(null, `Found a piece of a photo! (${n}/3)`);
      if (o.after) await o.after(E);
    },
  };
}

MAPS.attic_1 = {
  name: 'The Attic', area: 'The Attic',
  tiles: buildTiles(24, 16, '#', [
    ['rect', 1, 1, 22, 2, 'W'], ['rect', 1, 3, 22, 12, 'p'], ['set', 20, 2, 'd'],
  ]),
  legend: atticLegend,
  voidColor: '#0c0a10', dark: 0.94, playerLight: 135, darkColor: 'rgba(6,5,10,1)',
  bgm: 'bgm_attic', amb: () => 'amb_wind', ambVol: 0.6,
  update: atticFlicker,
  props: [
    // box maze
    ['box_stack', 5, 3], ['box_stack', 5, 4], ['box', 5, 5], ['box_stack', 5, 7], ['box', 5, 8], ['box_stack', 5, 9],
    ['sheet_furniture', 8, 11], ['box', 10, 11], ['box_stack', 11, 11], ['box_stack', 11, 12],
    ['box', 9, 5], ['box_stack', 10, 5], ['box_stack', 11, 5], ['box', 12, 5], ['box_stack', 13, 7], ['box', 13, 8],
    ['trunk', 16, 9], ['box_stack', 17, 5], ['box', 17, 4], ['box_stack', 17, 6], ['rocking_horse', 20, 12],
    ['mirror', 22, 4], ['sheet_furniture', 14, 13], ['box', 2, 9], ['box_stack', 1, 5],
    ['cobweb', 1, 3, { hgt: 150 }], ['cobweb', 22, 3, { hgt: 150, flip: true }], ['door', 20, 1],
  ],
  exits: [{ x: 20, y: 2, to: 'attic_2', tx: 9, ty: 11, tdir: 'up', dir: 'up', cond: () => State.flag('attic_door1') }],
  events: [
    noteEvent('note1', 3, 7, [[null, 'A crayon drawing. Three stick people under a rainbow. MY FAMILY, it says, in wobbly letters.'], ['pim', '{c:grey}(I drew this when I was five.){/c}', 'neutral']], { color: '#fff2c4' }),
    noteEvent('note2', 8, 3, [[null, 'A list, in Dad\'s handwriting:'], [null, '- call about apartment\n- pack winter stuff\n- {c:grey}talk to Pim{/c}'], [null, 'The last one is crossed out.']]),
    noteEvent('note3', 15, 11, [[null, 'A sticky note in Mom\'s handwriting: "Dr. Lee - Tuesday 3pm".'], [null, 'It\'s been crossed out. Rewritten. Crossed out again.']], { color: '#ffe0ea', rot: 0.2 }),
    pieceEvent('piece1', 19, 10, {
      async after(E) {
        await E.wait(20);
        E.sfx('sfx_creak');
        const c = E.spawn({ id: 'coat_ghost', x: 22, y: 7, sprite: 'npc_coat', dh: 150, solid: false, still: true, alpha: 0 });
        E.sfx('sfx_heartbeat');
        if (c) { await Game.tween(c, { alpha: 0.85 }, 20); }
        E.sfx('sfx_heartbeat');
        E.sfx('jingle_sting');
        E.shake(3, 16);
        await E.balloon('player', '!');
        await E.say('pim', '{c:grey}(...Somebody\'s there.){/c}', 'surprised');
        await E.wait(20);
        if (c) await Game.tween(c, { alpha: 0 }, 40);
        E.removeEvent('coat_ghost');
        await E.say('pim', '{c:grey}(It\'s just a coat. It\'s just an old coat on a hanger.){/c}', 'forced');
      },
    }),
    {
      id: 'sockbox', x: 12, y: 5, solid: false,
      async run(E) {
        if (E.flag('got_brass_key')) { await E.say(null, 'A box of old socks.'); return; }
        await E.say(null, 'A box of old socks. Dad\'s socks. They still have the little golf flags on them.');
        await E.say(null, 'Something clinks inside one of them...');
        E.setFlag('got_brass_key');
        await E.give('attic_key');
      },
    },
    {
      id: 'door1', x: 20, y: 2, solid: true, cond: () => !State.flag('attic_door1'),
      async run(E) {
        if (!E.has('attic_key')) { E.sfx('sfx_locked'); await E.say(null, 'A little door. It\'s locked. The keyhole is small and brass.'); return; }
        E.sfx('sfx_unlock');
        E.setFlag('attic_door1');
        E.take('attic_key');
        await E.say(null, 'The little brass key turns. The door creaks open.');
      },
    },
    { id: 'mirror1', x: 22, y: 4, solid: false, async run(E) { await E.say(null, 'A mirror. In the dark, Pim\'s reflection looks very small.'); } },
    { id: 'horse1', x: 20, y: 12, solid: false, async run(E) { await E.say(null, 'Mister Gallops, the rocking horse. He rocks a little on his own. Probably the wind.'); } },
  ],
  async onFirst(E) {
    await E.wait(60);
    await E.say('pim', '...', 'neutral');
    await E.say('pim', 'Biscuit? Waffles?', 'neutral');
    await E.say('pim', '...Momo?', 'hurt');
    await E.wait(40);
    await E.say(null, 'Nobody answers. Only the rain on the roof.');
    await E.say('pim', '{c:grey}(It\'s okay. I\'m not scared.){/c}', 'forced');
    await E.say('pim', '{c:grey}(Big girls don\'t get scared.){/c}', 'forced');
    await E.say(null, '{c:grey}Pim\'s flashlight flickers. The batteries are almost dead.{/c}');
  },
};

// ---- the portrait room: put the photo back together ----
MAPS.attic_2 = {
  name: 'The Portrait Room', area: 'The Attic',
  tiles: buildTiles(18, 13, '#', [['rect', 1, 1, 16, 2, 'W'], ['rect', 1, 3, 16, 9, 'p'], ['rect', 8, 12, 2, 1, 'p'], ['set', 15, 2, 'd']]),
  legend: atticLegend,
  voidColor: '#0c0a10', dark: 0.9, playerLight: 140, darkColor: 'rgba(6,5,10,1)',
  bgm: 'bgm_attic', amb: () => 'amb_wind', ambVol: 0.6,
  update: atticFlicker,
  props: [
    ['photo_big', 7, 2], ['photo_frames', 2, 2], ['photo_frames', 11, 2], ['door', 15, 1],
    ['mirror', 2, 4], ['music_box', 13, 8], ['sheet_furniture', 4, 9], ['box_stack', 16, 10], ['box', 1, 10],
    { id: 'lantern', x: 8, y: 7, light: 150 },
  ],
  exits: [
    { x: 8, y: 12, w: 2, to: 'attic_1', tx: 20, ty: 3, tdir: 'down', dir: 'down' },
    { x: 15, y: 2, to: 'attic_3', tx: 2, ty: 5, tdir: 'right', dir: 'up', cond: () => State.flag('photo_done') },
  ],
  events: [
    {
      id: 'big_frame', x: 7, y: 2, w: 2, solid: false,
      async run(E) {
        if (E.flag('photo_done')) { await E.say(null, 'The beach photo. Mom, Dad and Pim, squinting in the sun.'); return; }
        const n = E.v('attic_pieces');
        await E.say(null, `A big empty picture frame. The photo inside is torn into pieces. (${n}/3 pieces found)`);
        if (n < 3) return;
        await E.say(null, 'Pim fits the three pieces back into the frame. They fit perfectly.');
        E.setFlag('photo_done');
        E.sfx('sfx_mood_rainbow');
        const pic = await E.picture('cg_beach', { fade: 40, w: 720, h: 480, bg: 'rgba(0,0,0,0.6)' });
        await E.say(null, 'The beach. Pim is sitting on Dad\'s shoulders. Mom is holding the red umbrella over all three of them for shade.');
        await E.say(null, 'Everyone is laughing.');
        await E.say('pim', '{c:grey}(I forgot we were ever this happy.){/c}', 'neutral');
        await E.hidePicture(pic, 40);
        E.sfx('sfx_unlock');
        await E.say(null, 'Somewhere in the room, a door unlocks.');
        E.refresh();
      },
    },
    { id: 'door2', x: 15, y: 2, solid: true, cond: () => !State.flag('photo_done'), async run(E) { E.sfx('sfx_locked'); await E.say(null, 'This door won\'t open. There\'s a picture of a frame carved into it.'); } },
    pieceEvent('piece2', 3, 7),
    {
      id: 'musicbox', x: 13, y: 8, solid: false,
      async run(E) {
        if (E.flag('piece3')) { E.sfx('sfx_music_box'); await E.say(null, 'The music box plays a little tune. Mom used to hum it.'); return; }
        await E.say(null, 'A music box. There\'s a little crank on the side.');
        const i = await E.ask(null, 'Wind it up?', ['Wind it', 'Leave it']);
        if (i !== 0) return;
        E.sfx('sfx_music_box');
        await E.wait(40);
        await E.say(null, 'Plink... plink... plink-plonk... The lid pops open.');
        await E.say('pim', '{c:grey}(Mom used to hum this. When I couldn\'t sleep.){/c}', 'neutral');
        E.setFlag('piece3');
        E.sfx('sfx_item');
        const n = E.addV('attic_pieces');
        await E.say(null, `Inside, a folded piece of a photo! (${n}/3)`);
      },
    },
    { id: 'frames_l', x: 2, y: 2, w: 2, solid: false, async run(E) { await E.say(null, 'Photos of a baby in a yellow hat. Photos of a birthday cake with three candles.'); } },
    { id: 'frames_r', x: 11, y: 2, w: 2, solid: false, async run(E) { await E.say(null, 'A photo of Mom and Dad, young, in the rain. They\'re sharing one umbrella and laughing.'); } },
    { id: 'mirror2', x: 2, y: 4, solid: false, async run(E) { await E.say(null, 'Pim looks in the mirror. For a second, her reflection isn\'t smiling.'); await E.say(null, 'Then it is again.'); } },
  ],
};

// ---- the long hall: the coat chases ----
const HALL_START = [2, 5];
MAPS.attic_3 = {
  name: 'The Long Hall', area: 'The Attic', noMenu: true,
  tiles: buildTiles(42, 9, '#', [['rect', 1, 1, 40, 2, 'W'], ['rect', 1, 3, 40, 4, 'p'], ['set', 39, 2, 'd']]),
  legend: atticLegend,
  voidColor: '#0c0a10', dark: 0.9, playerLight: 150, darkColor: 'rgba(6,5,10,1)',
  bgm: 'bgm_attic', amb: () => 'amb_wind', ambVol: 0.7,
  props: [
    ['box_stack', 7, 3], ['box_stack', 7, 4], ['box', 11, 6], ['box_stack', 11, 5], ['sheet_furniture', 15, 3], ['box_stack', 19, 5], ['box', 19, 6],
    ['box_stack', 23, 3], ['box', 23, 4], ['trunk', 27, 5], ['box_stack', 31, 3], ['box_stack', 31, 4], ['box', 35, 6], ['box_stack', 35, 5],
    ['photo_frames', 5, 2], ['photo_frames', 13, 2], ['photo_frames', 21, 2], ['photo_frames', 29, 2], ['door', 39, 1],
  ],
  exits: [{ x: 39, y: 2, to: 'attic_4', tx: 7, ty: 8, tdir: 'up', dir: 'up' }],
  events: [],
  update(scene) {
    atticFlicker(scene);
    const c = scene.chaser;
    if (!c || scene.caught || Events.running || Game.overlays.length) return;
    if (c.stunT > 0) { c.stunT--; return; }
    if (!c.moving) {
      const p = scene.player;
      const dx = p.x - c.x, dy = p.y - c.y;
      const dirs = [];
      if (dx) dirs.push(dx > 0 ? 'right' : 'left');
      if (dy) dirs.push(dy > 0 ? 'down' : 'up');
      if (Math.abs(dy) > Math.abs(dx)) dirs.reverse();
      c.speed = (scene.catches || 0) >= 2 ? 1 / 13 : 1 / 10.5; // gentler after a couple of catches
      for (const d of dirs) { const [ddx, ddy] = U.dirVec[d]; if (scene.inBounds(c.x + ddx, c.y + ddy) && !scene.block[c.y + ddy][c.x + ddx]) { c.startMove(d, scene, true); break; } }
      if (!c.moving) {
        // stuck behind a box: slip around it
        for (const d of ['up', 'down']) { const [ddx, ddy] = U.dirVec[d]; if (scene.inBounds(c.x + ddx, c.y + ddy) && !scene.block[c.y + ddy][c.x + ddx]) { c.startMove(d, scene, true); break; } }
      }
    }
    if (Math.hypot(c.px - scene.player.px, c.py - scene.player.py) < TS * 0.75) {
      scene.caught = true;
      scene.catches = (scene.catches || 0) + 1;
      Events.run(async (E) => {
        E.sfx('jingle_sting');
        E.flash('#000000', 1, 60);
        await E.say('coat', '{c:grey}Be a big girl.{/c}');
        E.setPos('player', HALL_START[0], HALL_START[1], 'right');
        E.setPos(c, 1, 3, 'right');
        c.stunT = 90;
        scene.caught = false;
        await E.wait(40);
      });
    }
  },
  async onEnter(E) {
    const s = E.scene;
    await E.wait(30);
    await E.say(null, 'A long, long hallway. At the very end, a door.');
    await E.wait(20);
    E.sfx('sfx_creak');
    const c = E.spawn({ id: 'chaser', x: 1, y: 3, sprite: 'npc_coat', dh: 150, solid: false, still: true });
    s.chaser = c;
    // a heartbeat that speeds up while the coat is close
    s.heartT = 0;
    const prevUpdate = MAPS.attic_3.update;
    s.def = Object.assign(Object.create(s.def), {
      update(scene) {
        prevUpdate(scene);
        if (!scene.chaser || Events.running || Game.overlays.length) return;
        const d = Math.hypot(scene.chaser.px - scene.player.px, scene.chaser.py - scene.player.py) / TS;
        const period = d < 3 ? 26 : d < 6 ? 38 : 56;
        if (++scene.heartT >= period) { scene.heartT = 0; Sound.sfx('sfx_heartbeat', { volume: d < 3 ? 1 : 0.6 }); }
      },
    });
    await E.say('pim', '{c:grey}(Behind me...){/c}', 'surprised');
    E.sfx('jingle_sting');
    await E.say('coat', '{c:grey}Pim.{/c}');
    await E.say(null, '{c:grey}RUN! (Hold SHIFT to run.){/c}');
  },
};

// ---- the door: the memory ----
MAPS.attic_4 = {
  name: 'The Front Door', area: 'The Attic',
  tiles: buildTiles(16, 11, '#', [['rect', 1, 1, 14, 2, 'W'], ['rect', 1, 3, 14, 7, 'p'], ['rect', 7, 10, 2, 1, 'p']]),
  legend: Object.assign({}, atticLegend, { W: { mat: 'wall', c1: '#dfe8d6', c2: '#cfdcc3', trim: '#869c7a', base: '#6f8565', style: 'stripes' } }),
  voidColor: '#0c0a10', dark: 0.7, playerLight: 200,
  weather: 'rain',
  bgm: null, amb: () => 'amb_rain_heavy', ambVol: 0.7,
  props: [['front_door', 7, 1], ['coat_rack', 10, 3], ['side_plant', 3, 3], ['photo_frames', 4, 2]],
  events: [
    { id: 'memory_zone', x: 1, y: 5, w: 14, trigger: 'touch', solid: false, cond: () => !State.flag('attic_memory'), async run(E) { await Story.atticMemory(E); } },
  ],
};

Object.assign(Story, {
  async atticMemory(E) {
    E.setFlag('attic_memory');
    await E.say(null, 'The front door of Pim\'s house. It\'s open. Outside, it\'s pouring.');
    await E.wait(30);
    E.stopAmb(2);
    const pic = await E.picture('cg_dad', { fade: 80, bg: '#000' });
    await E.say('dad', 'Hey, kiddo. Come here a sec.');
    await E.say('dad', 'I have to go stay somewhere else for a while.');
    await E.say('pim', 'Where?', 'neutral');
    await E.say('dad', 'In an apartment. Across town. Mom and I... we just can\'t live together right now.');
    await E.say('dad', 'It\'s not your fault. Okay? It\'s not your fault.');
    await E.say('dad', 'Here. Take my umbrella.');
    await E.say('dad', 'You keep your mom dry for me, okay? Be a big girl.');
    await E.say('dad', 'Don\'t cry.');
    await E.wait(40);
    await E.say('pim', '...Okay.', 'forced');
    await E.hidePicture(pic, 80);
    E.amb('amb_rain_heavy', { volume: 0.7 });
    await E.wait(40);
    await E.say('pim', '{c:grey}(I didn\'t cry.){/c}', 'forced');
    await E.say('pim', '{c:grey}(I didn\'t cry at all. Not once. I\'ve been so good.){/c}', 'forced');
    await E.say('pim', '{c:grey}(So why won\'t the rain stop?){/c}', 'hurt');
    await E.wait(30);
    E.sfx('sfx_creak');
    const coat = E.char('coat_final') || E.spawn({ id: 'coat_final', x: 10, y: 3, sprite: 'npc_coat', dh: 150, solid: true, still: true });
    await E.balloon('player', '!');
    await E.say('coat', '{c:grey}Be a big girl.{/c}');
    await E.say('pim', 'I AM! I\'m not crying! I\'m NOT!', 'huffy');
    E.sfx('jingle_sting');
    const r = await E.battle('coat_fight');
    E.removeEvent('coat_final');
    // the rescue
    await E.wait(30);
    await E.say(null, 'The coat slumps to the floor. It\'s just a coat. It still smells a little like him.');
    await E.say('momo', 'Pim... you\'re shaking.', 'gloomy');
    await E.say('pim', 'I\'m fine! I\'m-', 'forced');
    await E.say(null, 'Waffles hugs her. Then Momo. Then, after a very long sigh, Biscuit too.');
    await E.say('biscuit', 'You\'re not fine, kid. And that\'s allowed, you know.', 'gloomy');
    await E.say('pim', 'It\'s not. Dad said.', 'hurt');
    await E.say('biscuit', 'Your dad said a lot of things. He was sad too. People say dumb stuff when they\'re sad.', 'neutral');
    await E.say('waffles', 'He didn\'t mean you can never, ever cry. Right? Right?!', 'gloomy');
    await E.say('pim', '...', 'hurt');
    await E.say(null, 'In the pocket of the old coat, there\'s something small and cold.');
    await E.give('raindrop_key');
    await E.say('momo', 'A key... shaped like a raindrop.', 'neutral');
    await E.say('pim', 'The door in the Pillow Fort! The one to...', 'surprised');
    await E.say('biscuit', 'Mom\'s room.', 'neutral');
    await E.say('momo', '...', 'gloomy');
    await E.wait(30);
    // wake up in the real attic, at night
    E.stopBgm(2);
    await E.fadeOut(60);
    E.stopAmb(1);
    State.d.world = 'real';
    State.healAll();
    await E.place('attic_real', 6, 6, 'up');
    await E.fadeIn(60);
  },
});
