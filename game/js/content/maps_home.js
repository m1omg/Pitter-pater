'use strict';
// ---------------------------------------------------------------------------
// The real house.
// ---------------------------------------------------------------------------
const ch = () => State.d.chapter;
const think = (t) => `{c:grey}(${t}){/c}`;
const homeBgm = () => (ch() === 0 ? null : ch() === 7 ? 'bgm_ending' : 'bgm_home');
const homeAmb = () => (ch() === 0 || ch() === 5 ? 'amb_night' : 'amb_rain_light');

// shared real-world sleep: move on to the next night
async function goToSleep(E) {
  const c = ch();
  if (c === 0) {
    await E.say('pim', think('Goodnight, Momo.'), 'neutral');
    State.d.chapter = 1;
    State.setParty(['pim']);
    await Story.goToDream(E, 'NIGHT ONE', 'Pillow Fort', 'fort', 12, 9, 'down');
    return;
  }
  if (c === 2) {
    State.d.chapter = 3;
    State.setParty(['pim', 'biscuit', 'waffles', 'momo']);
    await Story.goToDream(E, 'NIGHT TWO', 'Carpet Hills', 'fort', 12, 9, 'down');
  }
}

MAPS.pim_room = {
  name: "Pim's Room", area: "Pim's Room",
  tiles: [
    '############',
    '#WWWWWWWWWW#',
    '#WWWWWWWWWW#',
    '#..........#',
    '#..........#',
    '#..........#',
    '#..........#',
    '#..........#',
    '#..........#',
    '#####..#####',
  ],
  legend: { W: { mat: 'wall', c1: '#e6dcf2', c2: '#d6c8ea', trim: '#9d86b8', base: '#8a7299', style: 'dots' }, '.': { mat: 'wood', c1: '#e3c29c', c2: '#d2ab80' } },
  bgm: homeBgm, amb: homeAmb,
  props: [
    ['bed_pim', 1, 3], ['window_rain', 4, 2], ['drawings', 8, 2], ['desk', 8, 3], ['chair', 9, 4],
    ['bookshelf', 6, 3], ['toybox', 10, 7], ['rug_round', 4, 5],
  ],
  exits: [{ x: 5, y: 9, w: 2, to: 'hallway', tx: 3, ty: 3, tdir: 'down', dir: 'down' }],
  events: [
    { id: 'plush', x: 2, y: 3, trigger: 'none', solid: false, sprite: 'p_momo_plush', dh: 40, sortOff: 60, still: true, shadowW: 0 },
    {
      id: 'bed', x: 1, y: 3, w: 2, h: 2, solid: false,
      async run(E) {
        const c = ch();
        if (c === 0) {
          if (!E.flag('said_goodnight')) { await E.say('pim', think('I should say goodnight to Mom first.'), 'neutral'); return; }
          const i = await E.ask(null, 'Pim\'s bed. Momo the plush sheep is waiting on the pillow. Go to sleep?', ['Sleep', 'Not yet'], null, 1);
          if (i === 0) await goToSleep(E);
          return;
        }
        if (c === 2) {
          if (!Story.allTasksDone()) {
            const i = await E.ask(null, 'Pim\'s bed. It\'s not bedtime yet. There\'s still stuff to do.', ['Save', 'Leave it'], null, 1);
            if (i === 0) { Story.beforeSave(); await E.save(); }
            return;
          }
          await E.say(null, 'The day went by like the rain. Slowly, and then all at once.');
          const i = await E.ask(null, 'Go to sleep?', ['Sleep', 'Not yet'], null, 1);
          if (i === 0) await goToSleep(E);
          return;
        }
        const i = await E.ask(null, 'Pim\'s bed.', ['Save', 'Leave it'], null, 1);
        if (i === 0) { Story.beforeSave(); await E.save(); }
      },
    },
    {
      id: 'desk', x: 8, y: 3, w: 2, solid: false,
      async run(E) {
        if (ch() >= 4) { await E.say(null, 'Pim\'s drawing for the art show. A rainbow and a little pink heart. The sun never got drawn in.'); await E.say('pim', think('The art show was yesterday.'), 'forced'); return; }
        await E.say(null, 'Pim\'s drawing for the art show. A rainbow and a little pink heart.');
        await E.say('pim', think('It\'s not finished. It needs a big yellow sun, but I can\'t decide if the sun should have a face.'), 'neutral');
      },
    },
    { id: 'window', x: 4, y: 2, w: 2, solid: false, async run(E) { await E.say(null, 'Rain on the window. The street outside is grey and empty.'); } },
    { id: 'books', x: 6, y: 3, w: 2, solid: false, async run(E) { await E.say(null, 'Picture books. {c:red}The Very Brave Umbrella{/c} has a broken spine from being read so many times.'); await E.say('pim', think('Dad did all the voices.'), 'neutral'); } },
    { id: 'toys', x: 10, y: 7, solid: false, async run(E) { await E.say(null, 'A box of old toys. Pim is too old for most of them.'); await E.say(null, 'She keeps them anyway.'); } },
    { id: 'drawings', x: 8, y: 2, w: 2, solid: false, async run(E) { await E.say(null, 'Drawings of the sun. Lots and lots of suns.'); } },
    {
      id: 'calendar', x: 10, y: 2, solid: false,
      draw2(ctx) {
        ctx.save(); ctx.translate(0, -58);
        ctx.fillStyle = '#fffdf6'; ctx.strokeStyle = Gfx.C.ink; ctx.lineWidth = 2;
        ctx.fillRect(-16, -20, 32, 36); ctx.strokeRect(-16, -20, 32, 36);
        ctx.fillStyle = '#ef6f7c'; ctx.fillRect(-16, -20, 32, 8); ctx.strokeRect(-16, -20, 32, 8);
        ctx.fillStyle = '#ffd166';
        for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.arc(-11 + (i % 4) * 7.3, -6 + Math.floor(i / 4) * 7, 2.3, 0, 7); ctx.fill(); }
        ctx.restore();
      },
      async run(E) {
        await E.say(null, 'A calendar. Every day this month has a little sun drawn on it in yellow crayon.');
        await E.say(null, 'Even the rainy ones.');
      },
    },
  ],
  async onEnter(E) {
    if (ch() === 4 && !E.flag('m2_intro')) {
      E.setFlag('m2_intro');
      await E.wait(30);
      await E.say('pim', think('Saturday. No school.'), 'neutral');
      await E.say('pim', think('The Sun almost woke up again last night. It laughed.'), 'cheery');
      await E.say('pim', think('...And then it went back to sleep.'), 'forced');
      Story.setTasks([['morning', 'Go downstairs']]);
    }
    if (ch() === 2 && !E.flag('m1_intro')) {
      E.setFlag('m1_intro');
      await E.wait(30);
      await E.say('pim', think('...It was a dream.'), 'neutral');
      await E.say('pim', think('Biscuit could talk. And Waffles. And there was a toaster.'), 'surprised');
      await E.say('pim', think('The Sun almost woke up.'), 'cheery');
      await E.say('pim', think('Okay. Morning stuff.'), 'neutral');
      Story.setTasks([['feed', 'Feed the pets'], ['toast', 'Toast for Mom'], ['laundry', 'Do the laundry'], ['mail', 'Get the mail']]);
    }
  },
};

MAPS.hallway = {
  name: 'Upstairs', area: 'Upstairs',
  tiles: [
    '####################',
    '#WWDWWWWWWDWWWWWDWW#',
    '#WWdWWWWWWDWWWWWDWW#',
    '#..................#',
    '#..................#',
    '#..#################',
  ],
  legend: {
    W: { mat: 'wall', c1: '#efe2cc', c2: '#e3d1b4', trim: '#a88d6c', base: '#8f7458', style: 'stripes' },
    D: { mat: 'wall', c1: '#efe2cc', c2: '#e3d1b4', trim: '#a88d6c', base: '#8f7458', style: 'stripes' },
    d: { mat: 'wall', walk: true, c1: '#efe2cc', c2: '#e3d1b4', trim: '#a88d6c', base: '#8f7458', style: 'stripes' },
    '.': { mat: 'wood', c1: '#d9b58e', c2: '#c69f76' },
  },
  bgm: homeBgm, amb: homeAmb,
  props: [
    ['door', 3, 1], ['door', 10, 1], ['door_mom', 16, 1], ['photo_frames', 5, 2], ['photo_frames', 12, 2],
    ['side_plant', 18, 3], ['stairs_down', 1, 4, { layer: 'ground', solid: false }],
    { id: 'attic_ladder', x: 7, y: 1, cond: () => ch() === 4 && E.flag('ladder_down') },
  ],
  exits: [
    { x: 3, y: 2, to: 'pim_room', tx: 5, ty: 8, tdir: 'up', dir: 'up', sfx: 'sfx_door' },
    { x: 1, y: 5, w: 2, to: 'downstairs', tx: 20, ty: 3, tdir: 'down', dir: 'down' },
  ],
  events: [
    {
      id: 'photos_left', x: 5, y: 2, w: 2, solid: false,
      async run(E) {
        await E.say(null, 'Family photos. Pim, Mom and Dad, squished together and smiling. Biscuit as a tiny kitten. A painted flower.');
        await E.say('pim', think('Dad\'s still in this one.'), 'neutral');
      },
    },
    {
      id: 'photos_right', x: 12, y: 2, w: 2, solid: false,
      async run(E) { await E.say(null, 'The same photos again: Pim, Mom and Dad, kitten Biscuit and the flower. Mom liked them so much she hung them twice.'); },
    },
    {
      id: 'bathroom', x: 10, y: 2, solid: false,
      async run(E) { await E.say(null, 'The bathroom. The towels haven\'t been washed in a while.'); },
    },
    {
      id: 'mom_door', x: 16, y: 2, solid: false,
      async run(E) {
        const c = ch();
        if (c === 0) {
          E.sfx('sfx_knock');
          await E.wait(30);
          await E.say('pim', 'Mom? ...Goodnight.', 'neutral');
          await E.wait(50);
          await E.say('mom', '{c:grey}...Night, sweetie.{/c}', 'neutral');
          await E.say('mom', '{c:grey}I\'m sorry. I\'m just... really tired.{/c}', 'sad');
          await E.say('pim', 'It\'s fine! Sleep lots!', 'forced');
          E.setFlag('said_goodnight');
          Story.doneTask('upstairs');
          Story.setTasks([['bed', 'Go to bed']]);
          return;
        }
        if (c === 2) {
          if (E.flag('has_toast') && !Story.taskDone('toast')) {
            E.sfx('sfx_knock');
            await E.wait(20);
            await E.say('pim', 'Mom? I made you toast! It\'s not burnt at all!', 'cheery');
            await E.wait(40);
            await E.say('mom', '{c:grey}...Thank you, Pim. Just leave it there, okay?{/c}', 'sad');
            await E.say('pim', 'Okay!', 'cheery');
            await E.say(null, 'Pim leaves the plate by the door.');
            E.setFlag('has_toast', false);
            E.setFlag('toast_delivered');
            Story.doneTask('toast');
            return;
          }
          if (E.flag('toast_delivered') && Story.allTasksDone()) {
            await E.say(null, 'The plate of toast is still by the door. It\'s cold now.');
            await E.say('pim', think('She didn\'t eat it.'), 'forced');
            await E.say('pim', think('...It\'s fine. She\'ll eat tomorrow.'), 'forced');
            return;
          }
          await E.say(null, 'Mom\'s door. It\'s quiet inside.');
          return;
        }
        if (c === 4) { await E.say(null, 'Mom\'s door. Pim can hear her breathing. Slow. Asleep.'); return; }
        if (c === 5) return E.flag('sat_by_door') ? null : Story.nightCry(E);
        await E.say(null, 'Mom\'s door.');
      },
    },
    {
      id: 'ladder', x: 7, y: 2, solid: false, cond: () => ch() === 4 && E.flag('ladder_down'),
      trigger: 'action',
      async run(E) {
        if (!E.has('flashlight')) { await E.say('pim', think('It\'s so dark up there. I need a flashlight. Dad kept one in the kitchen drawer.'), 'neutral'); return; }
        await E.say(null, 'Pim climbs the ladder into the attic.');
        await E.transfer('attic_real', 6, 8, 'up', { sfx: 'sfx_creak' });
      },
    },
    {
      id: 'hook', x: 7, y: 2, solid: false, cond: () => ch() === 4 && E.flag('want_album') && !E.flag('ladder_down'),
      async run(E) {
        await E.say(null, 'There\'s a little string hanging from the attic hatch in the ceiling.');
        await E.say(null, 'Pim jumps... and jumps... and grabs it!');
        E.sfx('sfx_creak');
        E.shake(3, 12);
        E.setFlag('ladder_down');
        await E.say(null, 'The attic ladder unfolds with a groan.');
      },
    },
  ],
  async onEnter(E) {
    if (ch() === 5 && !E.flag('sat_by_door') && !E.flag('heard_cry')) {
      E.setFlag('heard_cry');
      await E.wait(30);
      await E.say(null, 'The house is dark and quiet. Except...');
      await E.say('pim', think('...Is that coming from Mom\'s room?'), 'neutral');
    }
    if (ch() === 7) await Story.endingHallway(E);
  },
};

// ---- the toaster on the kitchen counter (counter_sink at 5,3) ----
// Where its slot is: pixels of the p_counter_sink picture (325x287, shown 92 px tall) -> map pixels.
function toasterSlot() {
  const k = 92 / 287, left = 6 * TS - (325 * k) / 2, top = 4 * TS - 92;
  return { x0: left + 233 * k, x1: left + 280 * k, rim: top + 28 * k, lip: top + 38 * k };
}
const mixRGB = (a, b, t, f = 1) => `rgb(${a.map((v, i) => Math.round((v + (b[i] - v) * t) * f)).join(',')})`;

// two slices of bread (lift: how far their tops stand above the slot's front lip; done: 0 bread .. 1 toast)
function drawToast(ctx, ev) {
  const s = toasterSlot();
  const x0 = s.x0 - ev.px, x1 = s.x1 - ev.px, rim = s.rim - ev.py, lip = s.lip - ev.py, w = x1 - x0;
  if (ev.glow > 0) {
    // the wires glow inside the slot, and the air above it wobbles
    ctx.fillStyle = `rgba(255,120,40,${0.8 * ev.glow})`;
    ctx.fillRect(x0 + 1, rim + 1, w - 2, lip - rim - 1);
    ctx.strokeStyle = `rgba(255,236,210,${0.55 * ev.glow})`; ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const p = ((ev.animT + i * 22) % 66) / 66, x = x0 + w * (0.25 + i * 0.25), y = rim - 3 - p * 16;
      ctx.globalAlpha = 1 - p;
      ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.quadraticCurveTo(x + 2.5 * Math.sin(ev.animT * 0.2 + i), y + 3, x, y); ctx.stroke();
    }
    ctx.globalAlpha = ev.alpha;
  }
  ctx.save();
  ctx.beginPath(); ctx.rect(x0 - 8, lip - 60, w + 16, 60); ctx.clip();   // below the lip the toaster hides the bread
  for (const [dx, dy, f] of [[1.6, -1.2, 0.86], [0, 0, 1]]) {
    const bx = x0 + 1.5 + dx, bw = w - 4, by = lip - ev.lift + dy, bh = 24;   // taller than it looks: its foot stays in the slot
    ctx.beginPath();
    ctx.moveTo(bx, by + bh); ctx.lineTo(bx, by + 3.5);
    ctx.quadraticCurveTo(bx - 1, by - 0.5, bx + bw / 2, by - 0.5);
    ctx.quadraticCurveTo(bx + bw + 1, by - 0.5, bx + bw, by + 3.5);
    ctx.lineTo(bx + bw, by + bh); ctx.closePath();
    ctx.fillStyle = mixRGB([214, 164, 98], [146, 80, 34], ev.done, f); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = Gfx.C.ink; ctx.stroke();
    ctx.fillStyle = mixRGB([250, 236, 202], [230, 168, 92], ev.done, f);
    Gfx.roundRect(ctx, bx + 1.6, by + 2, bw - 3.2, bh - 3, 2); ctx.fill();
  }
  ctx.restore();
  if (ev.popAt != null) {
    // a few puffs of steam after the pop
    const age = ev.animT - ev.popAt;
    if (age < 60) {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 3; i++) {
        const a = Math.max(0, age - i * 8) / 52;
        if (a <= 0 || a >= 1) continue;
        ctx.globalAlpha = ev.alpha * 0.6 * (1 - a);
        ctx.beginPath(); ctx.arc(x0 + w * (0.3 + i * 0.2) + Math.sin(a * 6 + i) * 2, lip - ev.lift - 4 - a * 22, 2 + a * 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = ev.alpha;
    }
  }
}

// Pim makes toast: bread in, lever down, it glows, POP.
async function makeToast(E) {
  const fx = E.spawn({ id: 'toast_fx', x: 6, y: 3, solid: false, sortOff: 10, draw2: drawToast });
  Object.assign(fx, { lift: 20, done: 0, glow: 0, alpha: 0, popAt: null });
  const bread = (async () => {
    await Game.tween(fx, { alpha: 1 }, 8);
    await Game.tween(fx, { lift: 9 }, 16, U.ease.inOutSine);
    await E.wait(6);
    E.sfx('sfx_switch');
    await Game.tween(fx, { lift: -1 }, 8, U.ease.inQuad);
  })();
  await E.say(null, 'Pim puts two slices of bread in the toaster and pushes the lever down.');
  await bread;
  Game.tween(fx, { glow: 1 }, 30);
  await Game.tween(fx, { done: 1 }, 150, U.ease.linear);
  await Game.tween(fx, { glow: 0 }, 12);
  E.sfx('sfx_toaster');
  fx.popAt = fx.animT;
  await Game.tween(fx, { lift: 19 }, 9, U.ease.outQuad);
  await Game.tween(fx, { lift: 10 }, 12, U.ease.inQuad);
  await E.wait(30);
  await E.say(null, 'Golden! Not burnt at all! Pim butters them edge to edge.');
  await Game.tween(fx, { alpha: 0 }, 10);
  E.removeEvent('toast_fx');
}

MAPS.downstairs = {
  name: 'Downstairs', area: 'Downstairs',
  tiles: [
    '########################',
    '#WWWWWWWWWWWWWWWWWWWSSW#',
    '#WWWWWWWWWWWWWWWWWWWSSW#',
    '#tttttttttt............#',
    '#tttttttttt............#',
    '#tttttttttt............#',
    '#tttttttttt............#',
    '#tttttttttt............#',
    '#tttttttttt............#',
    '#tttttttttt............#',
    '###########..###########',
  ],
  legend: {
    W: { mat: 'wall', c1: '#dfe8d6', c2: '#cfdcc3', trim: '#869c7a', base: '#6f8565', style: 'stripes' },
    S: { mat: 'wood', c1: '#c79c73', c2: '#b88c64' },
    t: { mat: 'tile', c1: '#f3efe6', c2: '#dbe7e4' },
    '.': { mat: 'wood', c1: '#dcb88f', c2: '#c9a37a' },
  },
  bgm: homeBgm, amb: homeAmb,
  props: [
    ['stairs_up', 20, 1, { layer: 'ground', solid: false }],
    ['fridge', 1, 3], ['counter_plain', 2, 3], ['stove', 4, 3], ['counter_sink', 5, 3], ['washer', 8, 3], ['window', 5, 2],
    ['kitchen_table', 4, 6], ['chair', 3, 7], ['chair', 6, 6], ['pet_bowls', 8, 9],
    ['tv', 14, 3], ['bookshelf', 17, 3], ['plant', 22, 3], ['photo_frames_folded', 11, 2], ['window', 18, 2],
    ['rug_long', 13, 5], ['coffee_table', 14, 6], ['couch', 13, 8], ['floor_lamp', 17, 8], ['phone_table', 21, 8],
  ],
  exits: [
    { x: 20, y: 2, w: 2, to: 'hallway', tx: 1, ty: 4, tdir: 'up', dir: 'up' },
    { x: 11, y: 10, w: 2, to: 'yard', tx: 10, ty: 4, tdir: 'down', dir: 'down', cond: () => ch() !== 0 && ch() !== 5, sfx: 'sfx_door' },
  ],
  events: [
    {
      id: 'frontdoor_block', x: 11, y: 10, w: 2, trigger: 'touch', solid: false, cond: () => ch() === 0,
      async run(E) { await E.say('pim', think('It\'s dark outside. I\'m not supposed to go out at night.'), 'neutral'); await E.move('player', 'U'); },
    },
    { id: 'cereal', x: 5, y: 6, solid: false, cond: () => ch() === 0, async run(E) { await E.say(null, 'Pim\'s cereal bowl. Only the soggy bits are left.'); } },
    {
      id: 'fridge', x: 1, y: 3, solid: false,
      async run(E) {
        await E.say(null, 'Drawings held up by magnets. A grocery list in Mom\'s handwriting, from weeks ago.');
        await E.say(null, 'And a note from school: {c:pink}"ART SHOW - FRIDAY 4PM. Families welcome!"{/c}');
        if (ch() >= 4) await E.say('pim', think('That was yesterday.'), 'forced');
      },
    },
    {
      id: 'toaster', x: 5, y: 3, w: 2, solid: false,
      async run(E) {
        if (ch() === 2 && !Story.taskDone('toast') && !E.flag('has_toast')) {
          await makeToast(E);
          E.setFlag('has_toast');
          await E.say('pim', think('I\'ll bring it up to Mom.'), 'cheery');
          return;
        }
        await E.say(null, 'The sink. Pim washed the dishes she could reach.');
      },
    },
    { id: 'stove', x: 4, y: 3, solid: false, async run(E) { await E.say(null, 'The stove. Pim isn\'t allowed to use it. She\'s allowed to use the toaster.'); } },
    {
      id: 'drawer', x: 2, y: 3, w: 2, solid: false,
      async run(E) {
        if (ch() === 2 && !Story.taskDone('feed') && !E.has('pet_food')) {
          await E.say(null, 'The cupboard under the counter. The big bag of pet food lives here.');
          await E.say(null, 'Pim hugs it out. It\'s almost as big as Waffles.');
          await E.give('pet_food');
          return;
        }
        if (ch() === 4 && E.flag('want_album') && !E.has('flashlight')) {
          await E.say(null, 'The junk drawer. Rubber bands, dead batteries, takeout menus...');
          await E.say(null, '...and Dad\'s old flashlight.');
          await E.give('flashlight');
          return;
        }
        await E.say(null, 'The junk drawer. Rubber bands, dead batteries, takeout menus.');
      },
    },
    {
      id: 'washer', x: 8, y: 3, solid: false,
      async run(E) {
        if (ch() === 2 && !Story.taskDone('laundry')) {
          await E.say(null, 'The laundry basket is overflowing. Pim stuffs everything into the washing machine.');
          await E.say(null, 'She drags a chair over to reach the soap. One scoop... two scoops... okay, three scoops.');
          E.sfx('sfx_switch');
          await E.say(null, 'Beep! It\'s working!');
          Story.doneTask('laundry');
          return;
        }
        await E.say(null, 'The washing machine hums quietly.');
      },
    },
    {
      id: 'bowls', x: 8, y: 9, solid: false,
      async run(E) {
        if (ch() === 2 && !Story.taskDone('feed')) {
          if (!E.has('pet_food')) {
            await E.say(null, 'Two empty pet bowls. Biscuit and Waffles are staring at them very hard.');
            await E.say('pim', think('The pet food is in the cupboard, under the counter by the fridge.'), 'neutral');
            return;
          }
          await E.say(null, 'Pim pours kibble into the two bowls. Crunchy fish shapes for Biscuit, crunchy bone shapes for Waffles.');
          E.take('pet_food');
          E.sfx('sfx_bark');
          await E.say('waffles', 'Wuff! Wuff!');
          E.sfx('sfx_meow');
          await E.say('biscuit', 'Mrrrow.');
          await E.say('pim', 'You\'re welcome!', 'cheery');
          Story.doneTask('feed');
          return;
        }
        await E.say(null, 'Two pet bowls. One says BISCUIT, one says WAFFLES. Dad painted the letters.');
      },
    },
    { id: 'tv', x: 14, y: 3, w: 2, solid: false, async run(E) { if (ch() >= 4) { await E.say(null, 'The TV is off. Pim remembers the three of them on the couch, laughing so hard Dad snorted.'); return; } await E.say(null, 'The TV is off. Nobody has watched it in a while.'); } },
    { id: 'shelf', x: 17, y: 3, w: 2, solid: false, async run(E) { await E.say(null, 'Cookbooks. A sticky note in one says "Sunday pancakes!!" with a little smiley face.'); } },
    { id: 'couch', x: 13, y: 8, w: 3, solid: false, async run(E) { await E.say(null, 'Mom\'s blanket is folded on the couch. She used to fall asleep here during movies.'); } },
    { id: 'photos', x: 11, y: 2, w: 2, solid: false, async run(E) { await E.say(null, 'Family photos. In one of them, the right side has been folded back behind the frame.'); await E.say('pim', think('That\'s where Dad was.'), 'neutral'); } },
    {
      id: 'phone', x: 21, y: 8, solid: false,
      async run(E) {
        if (ch() === 0) { await E.say(null, 'The phone. A little red light is blinking. {c:red}1 new message.{/c}'); await E.say(null, 'Pim doesn\'t press play.'); return; }
        await E.say(null, 'The phone.');
      },
    },
    {
      id: 'mom_kitchen', x: 5, y: 5, sprite: 'chr_mom', dir: 'down', cond: () => ch() === 4 && !E.flag('m2_talk_done'),
      async run(E) { await Story.morning2Talk(E); },
    },
  ],
  async onEnter(E) {
    if (ch() === 2 && E.flag('toast_delivered') && Story.taskDone('feed') && !E.flag('phone_call')) {
      await Story.phoneCall(E);
    }
    if (ch() === 4 && !E.flag('m2_talk_done') && !E.flag('m2_seen')) {
      E.setFlag('m2_seen');
      await E.wait(20);
      await E.balloon('player', '!');
      await E.say('pim', think('Mom is downstairs!'), 'surprised');
    }
  },
};

MAPS.yard = {
  name: 'Front Yard', area: 'Front Yard',
  tiles: [
    '######################',
    '#gggggggggggggggggggg#',
    '#gggggggggggggggggggg#',
    '#gggggggggggggggggggg#',
    '#gggggggggppggggggggg#',
    '#gggggggggppggggggggg#',
    '#gggggggggppggggggggg#',
    '#gggggggggppggggggggg#',
    '#gggggggggppggggggggg#',
    '#gggggggggppggggggggg#',
    '#gggggggggppggggggggg#',
    '#gggggggggppggggggggg#',
    '#gggggggggppggggggggg#',
    '#gggggggggppggggggggg#',
    '##########pp##########',
  ],
  legend: { g: { mat: 'grass', c1: '#a9cf95', c2: '#86b673' }, p: { mat: 'dirt', c1: '#dcc49b', c2: '#c3a57b' } },
  voidColor: '#6d7d6a',
  weather: 'rain',
  bgm: homeBgm, amb: () => 'amb_rain_light',
  props: [
    ['house_front', 7, 1], ['tree', 2, 5], ['flowerbed', 3, 9], ['flowerbed', 5, 11], ['bush', 1, 12], ['bush', 7, 6],
    ['mailbox', 13, 12], ['bush', 15, 4],
    ...[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((y) => ['bush', 17, y, { dh: 70, oy: 6 }]),
    ['flowerbed', 18, 5], ['flowerbed', 18, 10], ['bush', 20, 2],
  ],
  open: [[10, 3], [11, 3]],
  walls: [[17, 7]],
  exits: [
    { x: 10, y: 3, w: 2, to: 'downstairs', tx: 11, ty: 9, tdir: 'up', dir: 'up', sfx: 'sfx_door' },
  ],
  events: [
    { id: 'gate', x: 10, y: 14, w: 2, trigger: 'touch', solid: false, async run(E) { await E.say('pim', think('I\'m not allowed past the gate by myself.'), 'neutral'); await E.move('player', 'U'); } },
    {
      id: 'mailbox_ev', x: 13, y: 12, solid: false,
      async run(E) {
        if (ch() === 2 && !Story.taskDone('mail')) {
          E.sfx('sfx_page');
          await E.say(null, 'Pim opens the mailbox. Bills. More bills. One says {c:red}FINAL NOTICE{/c} in big red letters.');
          await E.say('pim', think('I don\'t know what that means. I\'ll put them on the table.'), 'neutral');
          Story.doneTask('mail');
          return;
        }
        await E.say(null, 'The mailbox. Empty.');
      },
    },
    { id: 'tree_ev', x: 2, y: 5, w: 2, solid: false, async run(E) { await E.say(null, 'Pim\'s climbing tree. Dad built a tiny birdhouse on the lowest branch.'); } },
    { id: 'flowers_ev', x: 3, y: 9, w: 2, solid: false, async run(E) { await E.say(null, 'Mom\'s flower bed. The weeds are winning.'); } },
    {
      id: 'okafor', x: 18, y: 7, sprite: 'npc_okafor', dir: 'left', counter: true, cond: () => ch() === 2 || ch() === 4,
      async run(E) {
        if (ch() === 2 && !E.flag('okafor_talk')) {
          E.setFlag('okafor_talk');
          await E.say('okafor', 'Good morning, Pim! Out in this rain without a coat?');
          await E.say('okafor', 'How is your mother doing, dear? I haven\'t seen her in the garden for weeks.');
          await E.say('pim', 'She\'s fine! She\'s just really busy!', 'forced');
          await E.say('okafor', '...I see.');
          await E.say('okafor', 'Well. If you ever need anything - anything at all - you knock on my door. Alright? Day or night.');
          await E.say('pim', 'Okay! Thanks, Mrs. Okafor!', 'cheery');
          await E.say('pim', think('We don\'t need anything. We\'re fine.'), 'forced');
          return;
        }
        if (ch() === 4) { await E.say('okafor', 'Pim, dear. You look tired. Are you eating properly?'); await E.say('pim', 'Yep! Toast!', 'forced'); await E.say('okafor', '...My door is always open, you know.'); return; }
        await E.say('okafor', 'Stay dry, little one.');
      },
    },
  ],
};

MAPS.attic_real = {
  name: 'Attic', area: 'The Attic',
  tiles: [
    '##############',
    '#WWWWWWWWWWWW#',
    '#WWWWWWWWWWWW#',
    '#............#',
    '#............#',
    '#............#',
    '#............#',
    '#............#',
    '#............#',
    '######..######',
  ],
  legend: { W: { mat: 'wall', c1: '#6b5a58', c2: '#5d4d4c', trim: '#3f3333', base: '#3a2e2e', style: 'planks' }, '.': { mat: 'plank', c1: '#7a6660', c2: '#6a5752' } },
  dark: 0.82, playerLight: 150, darkColor: 'rgba(10,8,16,1)',
  bgm: null, amb: () => 'amb_wind',
  props: [
    ['box_stack', 1, 3], ['box', 2, 3], ['sheet_furniture', 4, 3], ['mirror', 8, 3], ['rocking_horse', 11, 4],
    ['trunk', 1, 7], ['box', 10, 8], ['box_stack', 12, 7], ['cobweb', 1, 3, { hgt: 150 }], ['cobweb', 12, 3, { hgt: 150, flip: true }],
    { id: 'window', x: 6, y: 2, light: 120 },
  ],
  exits: [{ x: 6, y: 9, w: 2, to: 'hallway', tx: 7, ty: 3, tdir: 'down', dir: 'down', cond: () => E.flag('attic_done') }],
  events: [
    {
      id: 'dadbox', x: 6, y: 5, sprite: 'p_dad_box', dh: 56, still: true,
      async run(E) {
        if (E.flag('attic_done')) { await E.say(null, 'Dad\'s box. Pim put everything back inside.'); return; }
        await E.say('pim', think('The photo album isn\'t here...'), 'neutral');
        await E.say(null, 'But there\'s a box with DAD written on it in marker.');
        await E.say(null, 'Inside: an old scarf. A mug that says WORLD\'S OKAYEST DAD. A stack of photos.');
        await E.say(null, 'On top, a photo of the three of them at the beach. It\'s been torn in half.');
        await E.say('pim', think('Mom\'s half and my half are here. Where\'s Dad\'s half?'), 'neutral');
        await E.say(null, 'The rain drums on the roof. It sounds like a heartbeat.');
        await E.say('pim', think('I\'m just going to sit for a minute.'), 'forced');
        await E.say('pim', think('...Just one minute...'), 'neutral');
        State.d.chapter = 5;
        State.setParty(['pim']);
        await Story.goToDream(E, 'NIGHT THREE', 'The Attic', 'attic_1', 3, 12, 'up');
      },
    },
    { id: 'mirror_ev', x: 8, y: 3, solid: false, async run(E) { await E.say(null, 'A dusty mirror. Pim\'s reflection smiles back. She didn\'t know she was smiling.'); } },
    { id: 'horse', x: 11, y: 4, solid: false, async run(E) { await E.say(null, 'Pim\'s old rocking horse. Its name was Mister Gallops.'); } },
  ],
  async onEnter(E) {
    if (ch() === 5 && !E.flag('attic_woke')) {
      E.setFlag('attic_woke');
      E.setFlag('attic_done');
      await E.wait(30);
      await E.say('pim', think('...I fell asleep up here.'), 'neutral');
      await E.say('pim', think('It\'s the middle of the night.'), 'neutral');
      await E.say(null, 'Pim is still holding the torn photo.');
    }
  },
};

MAPS.mom_room = {
  name: "Mom's Room", area: "Mom's Room",
  tiles: [
    '##############',
    '#WWWWWWWWWWWW#',
    '#WWWWWWWWWWWW#',
    '#............#',
    '#............#',
    '#............#',
    '#............#',
    '#............#',
    '######..######',
  ],
  legend: { W: { mat: 'wall', c1: '#cdd6e6', c2: '#bcc7db', trim: '#7d89a3', base: '#667189', style: 'flowers' }, '.': { mat: 'wood', c1: '#cfae8c', c2: '#bd9a78' } },
  bgm: () => 'bgm_ending', amb: () => 'amb_rain_light',
  props: [['mom_bed', 5, 3], ['nightstand', 4, 3], ['nightstand', 8, 3], ['curtains', 1, 2], ['curtains', 10, 2], ['dresser', 11, 3], ['laundry_pile', 2, 6], ['laundry_pile', 10, 7]],
  exits: [{ x: 6, y: 8, w: 2, to: 'hallway', tx: 16, ty: 3, tdir: 'down', dir: 'down' }],
  events: [],
};

// ---------------------------------------------------------------------------
// Real-world story scenes
// ---------------------------------------------------------------------------
Object.assign(Story, {
  async phoneCall(E) {
    E.setFlag('phone_call');
    await E.wait(20);
    E.sfx('sfx_phone');
    await E.wait(40);
    await E.balloon('player', '!');
    await E.say('pim', think('The phone!'), 'surprised');
    const p = E.char('player');
    // walk to the phone
    await E.move('player', `R${Math.max(0, 20 - p.x)}`, { skipBlocked: true });
    await E.move('player', `D${Math.max(0, 8 - p.y)}`, { skipBlocked: true });
    E.face('player', 'right');
    E.sfx('sfx_switch');
    await E.say('pim', 'Hello?', 'neutral');
    await E.say('phone', 'Hey, kiddo! It\'s Dad.');
    await E.say('pim', 'Hi Dad!', 'cheery');
    await E.say('phone', 'How are you doing? How\'s... how\'s your mom?');
    await E.say('pim', 'Good! She\'s good! We\'re all really good!', 'forced');
    await E.say('phone', '...Yeah? Is she there? Can I talk to her?');
    await E.say('pim', 'She\'s sleeping!', 'forced');
    await E.say('phone', '...At ten in the morning?');
    await E.say('pim', 'She\'s really tired from... from work.', 'forced');
    await E.say('phone', 'Pim...');
    await E.wait(30);
    await E.say('phone', 'Okay. Tell her I called, alright? And, kiddo... you\'re being really brave. Keep being brave for me, okay?');
    await E.say('pim', 'I will!', 'forced');
    E.sfx('sfx_switch');
    await E.wait(40);
    await E.say(null, 'Pim holds the phone for a while after he hangs up.');
    await E.say('pim', think('Keep being brave.'), 'neutral');
  },

  async morning2Talk(E) {
    E.setFlag('m2_talk_done');
    Story.doneTask('morning');
    await E.say('mom', '...Morning, Pim.', 'neutral');
    await E.say('pim', 'Mom! You\'re up!', 'surprised');
    await E.say('mom', 'Mm. I couldn\'t sleep anymore.', 'neutral');
    await E.say('pim', 'Do you want breakfast? I can make toast! I\'m really good at toast now!', 'cheery');
    await E.say('mom', 'You shouldn\'t have to make me toast, sweetie. I\'m the mom.', 'sad');
    await E.say('pim', 'It\'s fine! I like making toast!', 'forced');
    await E.say('mom', '...', 'sad');
    await E.wait(40);
    E.bgm('bgm_sad', { fade: 2 });
    await E.say('mom', 'Pim... I found the note on the fridge. The art show.', 'neutral');
    await E.say('mom', 'Friday was yesterday.', 'sad');
    await E.say('pim', '...', 'neutral');
    await E.say('pim', 'Oh. Yeah. It\'s fine! It wasn\'t a big deal. I just drew a picture.', 'forced');
    await E.say('mom', 'What did you draw?', 'neutral');
    await E.say('pim', 'Just our house. And the sun.', 'forced');
    await E.wait(40);
    await E.say('mom', 'I\'m sorry, Pim. I\'m so, so sorry.', 'cry');
    await E.say('pim', 'No, no, it\'s fine! Don\'t be sad! {shake}Please don\'t be sad!{/shake} It\'s fine!', 'forced');
    await E.say('mom', 'I... I need to lie down for a bit.', 'cry');
    await E.fadeOut(30);
    E.removeEvent('mom_kitchen');
    await E.wait(30);
    await E.fadeIn(30);
    await E.wait(30);
    await E.say('pim', think('I made it worse.'), 'forced');
    await E.say('pim', think('I shouldn\'t have said anything.'), 'forced');
    await E.say('pim', think('It\'s fine. It\'s fine. It\'s fine.'), 'forced');
    await E.wait(30);
    await E.say('pim', think('...I know! Mom used to love looking at the old photo album. It\'s in the attic!'), 'cheery');
    await E.say('pim', think('If I find it, maybe she\'ll smile.'), 'cheery');
    E.setFlag('want_album');
    Story.setTasks([['album', 'Find the photo album']]);
  },

  async nightCry(E) {
    E.setFlag('sat_by_door');
    E.bgm('bgm_sad', { fade: 2 });
    await E.say(null, 'From behind the door, very quietly, someone is crying.');
    await E.say('pim', think('Mom\'s crying.'), 'neutral');
    const i = await E.ask('pim', think('...'), ['Knock', 'Don\'t'], 'neutral');
    if (i === 0) {
      await E.say(null, 'Pim raises her hand to knock.');
      await E.wait(40);
      await E.say('pim', think('If I knock, she\'ll know I heard. Then she\'ll be sad that I\'m sad.'), 'forced');
      await E.say(null, 'Pim lowers her hand.');
    }
    await E.say(null, 'Pim sits down in the hallway, leaning against Mom\'s door, holding the red umbrella.');
    await E.say('pim', '{small}I\'m right here, Mom.{/small}', 'neutral');
    await E.wait(40);
    State.d.chapter = 6;
    State.setParty(['pim', 'biscuit', 'waffles', 'momo']);
    await Story.goToDream(E, 'NIGHT FOUR', 'The Cloud Keep', 'fort', 13, 6, 'up');
  },

  async endingHallway(E) {
    if (E.flag('ending_done')) return;
    E.setFlag('ending_done');
    State.d.tasks = null;
    await E.wait(60);
    await E.say(null, 'Pim wakes up on the hallway floor, curled against Mom\'s door.');
    await E.say(null, 'The door opens.');
    E.sfx('sfx_door');
    const pic = await E.picture('cg_hallway', { fade: 60 });
    await E.say('mom', 'Pim? Were you out here all night?', 'surprised');
    await E.say('pim', '...', 'neutral');
    await E.say(null, 'Mom sits down on the floor next to her.');
    await E.say('pim', 'Mom...', 'neutral');
    await E.say('pim', 'I\'m not fine.', 'cry');
    await E.say('pim', 'I\'m not fine at all.', 'cry');
    await E.say(null, 'And Pim cries. Really cries. The kind of crying she has been saving up for a very long time.');
    await E.say('mom', 'I know. I know, baby.', 'cry');
    await E.say('mom', 'Me neither.', 'cry');
    await E.say('mom', 'And that is not your job to fix. Okay? None of this is your job.', 'warm');
    await E.say('mom', 'I\'m going to get help. Real help. I\'m calling Dr. Lee today, and I\'m going to keep calling until I\'m better.', 'warm');
    await E.say('mom', 'And I\'m going to call your dad, and we\'re going to talk about how to take better care of you. Both of us.', 'warm');
    await E.say('pim', '...Can we still have toast?', 'cry');
    await E.say('mom', '...We can still have toast. I\'ll make it this time.', 'smile');
    await E.hidePicture(pic, 90);
    await Story.epilogue(E);
  },

  async epilogue(E) {
    E.stopBgm(3);
    await E.fadeOut(90, '#fff8ec');
    Cutscene.stage({ bg: '#fff8ec' });
    await E.wait(40);
    await Cutscene.card('A FEW WEEKS LATER', null, { icon: 'sun', keepBg: true, bg: '#2a2230' });
    await E.place('yard_after', 10, 8, 'down');
    E.bgm('bgm_ending');
    await E.fadeIn(80);
  },
});

// the yard, weeks later
MAPS.yard_after = Object.assign({}, MAPS.yard, {
  weather: null, bgm: () => 'bgm_ending', amb: () => null, area: 'Front Yard',
  noMenu: true,
  props: MAPS.yard.props.concat([['flowerbed', 12, 6]]),
  events: [
    { id: 'mom_garden', x: 4, y: 11, sprite: 'chr_mom', dir: 'right', async run(E) { await E.say('mom', 'Look! The tulips came back. They always come back.', 'smile'); } },
    { id: 'okafor2', x: 18, y: 7, sprite: 'npc_okafor', dir: 'left', counter: true, async run(E) { await E.say('okafor', 'Your mother is looking better, dear.'); await E.say('pim', 'She has good days and bad days. It\'s okay to have bad days.', 'neutral'); await E.say('okafor', 'That\'s very wise.'); await E.say('pim', 'My cat told me.', 'cheery'); } },
    { id: 'end_trigger', x: 10, y: 12, w: 2, h: 2, trigger: 'touch', solid: false, async run(E) { await Story.finale(E); } },   // two rows: the path can't be joined below it
  ],
  async onEnter(E) {
    if (E.flag('epi_intro')) return;
    E.setFlag('epi_intro');
    await E.wait(40);
    await E.say('mom', 'Pim! Come help me plant these!', 'smile');
    await E.say('pim', 'Coming!', 'cheery');
    await E.say(null, '{c:grey}(Talk to everyone, then walk down the path when you\'re ready.){/c}');
  },
});

Object.assign(Story, {
  async finale(E) {
    E.setFlag('finale');
    await E.say(null, 'A few drops of rain fall, even though the sun is shining.');
    E.weather('drizzle');
    await E.say('pim', 'Oh! It\'s raining.', 'surprised');
    await E.say('mom', 'Do you want the umbrella, sweetie?', 'smile');
    await E.wait(30);
    await E.say('pim', 'No. It\'s okay.', 'neutral');
    await E.say('pim', 'I like the rain.', 'cheery');
    const pic = await E.picture('cg_rainbow', { fade: 90 });
    await E.wait(200);
    await E.fadeOut(90);
    await E.hidePicture(pic, 1);
    Cutscene.stage({ bg: '#1b1622' });
    await E.fadeIn(10);
    await Cutscene.credits();
    if (State.v('scraps') >= SCRAPS_TOTAL) await Story.secretEnding(E);
    await E.wait(30);
    await Cutscene.card('THE END', 'thank you for playing', { icon: 'heart', keepBg: true, hold: 300 });
    State.d.cleared = true;
    const i = await E.ask(null, 'Save your finished file?', ['Save', 'No thanks'], null, 1);
    if (i === 0) { Story.beforeSave(); await E.save(); }
    Title.open();
  },

  async secretEnding(E) {
    Cutscene.stage({ bg: '#2a2230' });
    await E.wait(40);
    const pic = await E.picture('cg_beach', {
      fade: 60, w: 660, h: 440, frame: true,
      overlay(ctx, x, y, w, h) {
        // torn edges taped back together
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x + w * 0.52, y);
        for (let i = 1; i <= 12; i++) ctx.lineTo(x + w * 0.52 + (i % 2 ? 9 : -7), y + (h * i) / 12);
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y + h * 0.62);
        for (let i = 1; i <= 10; i++) ctx.lineTo(x + (w * i) / 10, y + h * 0.62 + (i % 2 ? 7 : -6));
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,248,220,0.55)'; ctx.strokeStyle = 'rgba(200,190,160,0.6)'; ctx.lineWidth = 1;
        for (const [tx, ty, rot] of [[0.52, 0.2, 0.3], [0.5, 0.75, -0.4], [0.2, 0.62, 0.1], [0.8, 0.6, -0.2]]) {
          ctx.save(); ctx.translate(x + w * tx, y + h * ty); ctx.rotate(rot);
          ctx.fillRect(-40, -12, 80, 24); ctx.strokeRect(-40, -12, 80, 24); ctx.restore();
        }
        // a few little missing pieces
        ctx.fillStyle = '#2a2230';
        ctx.beginPath(); ctx.moveTo(x + w - 60, y + h); ctx.lineTo(x + w, y + h - 40); ctx.lineTo(x + w, y + h); ctx.fill();
        ctx.restore();
      },
    });
    await E.say(null, 'The beach photo, taped back together. Some little pieces are still missing.');
    await E.say(null, 'But you can still see everyone smiling.');
    E.sfx('sfx_phone');
    await E.wait(60);
    await E.say('phone', 'Hey, kiddo. Mom told me... about everything.');
    await E.say('phone', 'I\'m sorry I said that thing. About not crying. That was a really dumb thing to say.');
    await E.say('phone', 'You can cry whenever you want, okay? I cry too. More than you\'d think.');
    await E.say('pim', '...Okay, Dad.', 'cheery');
    await E.say('phone', 'Can I come see you on Saturday? I\'ll bring pancakes.');
    await E.say('pim', 'Okay!', 'cheery');
    await E.hidePicture(pic, 60);
  },
});
