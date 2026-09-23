'use strict';
// ---------------------------------------------------------------------------
// Story flow: new game, day/night transitions, task list HUD, scripted battles.
// Chapters: 0 evening/prologue, 1 night one (fort + crumb valley), 2 morning one,
// 3 night two (carpet hills), 4 morning two + attic (real), 5 night three (attic),
// 6 night four (cloud keep), 7 ending
// ---------------------------------------------------------------------------
const Story = {
  newGame() {
    const d = State.d;
    d.world = 'real';
    d.party = ['pim'];
    d.pets = ['biscuit', 'waffles'];
    d.chapter = 0;
    d.marbles = 0;
    State.addItem('cookie', 3);
    Events.run(async (E) => {
      Game.fadeA = 1;
      Cutscene.stage({ bg: '#0f0c14', rain: 2 });
      E.amb('amb_rain_light', { volume: 0.6 });
      await E.wait(40);
      await Cutscene.card('It has been raining for a while now.', null, { icon: 'rain', hold: 220, keepBg: true });
      await E.place('downstairs', 5, 8, 'up', { noBanner: true });
      await E.fadeIn(60);
      await Story.prologue(E);
    });
  },

  resume() {
    const d = State.d;
    Events.running = 0;
    Game.setScene(new MapScene(d.map, d.x, d.y, d.dir || 'down'));
    Game.fadeIn(30);
  },

  // store position before saving
  beforeSave() {
    const s = Game.scene;
    if (s instanceof MapScene) { State.d.map = s.mapId; State.d.x = s.player.x; State.d.y = s.player.y; State.d.dir = s.player.dir; }
  },

  // ------------------------------------------------------------ task list
  setTasks(list) { State.d.tasks = list.map(([id, text]) => ({ id, text, done: false })); },
  doneTask(id) {
    const t = (State.d.tasks || []).find((x) => x.id === id);
    if (t && !t.done) { t.done = true; Sound.sfx('sfx_page'); }
  },
  taskDone(id) { const t = (State.d.tasks || []).find((x) => x.id === id); return !!(t && t.done); },
  allTasksDone() { return (State.d.tasks || []).every((t) => t.done); },
  drawHud(ctx, scene) {
    const tasks = State.d && State.d.tasks;
    if (!tasks || !tasks.length || State.d.world !== 'real' || Game.overlays.length) return;
    const w = 250, h = 48 + tasks.length * 30, x = Game.W - w - 16, y = 16;
    ctx.save();
    ctx.globalAlpha = 0.92;
    Gfx.box(ctx, x, y, w, h, { fill: '#fffbe8', radius: 8 });
    Gfx.text(ctx, "PIM'S LIST", x + 18, y + 30, { size: 20, font: Gfx.BOLD, color: '#d8578a' });
    tasks.forEach((t, i) => {
      const yy = y + 58 + i * 30;
      ctx.lineWidth = 2; ctx.strokeStyle = Gfx.C.ink; ctx.strokeRect(x + 18, yy - 15, 16, 16);
      if (t.done) { ctx.strokeStyle = '#3f9a4e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 20, yy - 8); ctx.lineTo(x + 26, yy - 2); ctx.lineTo(x + 36, yy - 18); ctx.stroke(); }
      Gfx.text(ctx, t.text, x + 44, yy, { size: 20, color: t.done ? '#a89aa0' : Gfx.C.ink });
      if (t.done) { ctx.strokeStyle = 'rgba(58,42,48,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 44, yy - 6); ctx.lineTo(x + 44 + Gfx.measure(ctx, t.text, 20, Gfx.FONT), yy - 6); ctx.stroke(); }
    });
    ctx.restore();
  },

  // ------------------------------------------------------------ transitions
  async goToDream(E, title, sub, map, x, y, dir = 'down') {
    E.stopBgm(2);
    await E.fadeOut(60);
    E.stopAmb(1.5);
    State.d.world = 'dream';
    State.d.tasks = null;
    State.healAll();
    Cutscene.stage({ bg: '#0f0c14' });
    await E.wait(30);
    await Cutscene.card(title, sub, { icon: 'rain', keepBg: true });
    await E.place(map, x, y, dir);
    await E.fadeIn(50);
  },

  async wakeUp(E, sub, map = 'pim_room', x = 3, y = 5, dir = 'down') {
    E.stopBgm(2);
    await E.fadeOut(50, '#fff8ec');
    E.stopAmb(1);
    State.d.world = 'real';
    State.healAll();
    Cutscene.stage({ bg: '#fff8ec' });
    await E.wait(30);
    await Cutscene.card('MORNING', sub, { icon: 'sun', keepBg: true, bg: '#2a2230' });
    await E.place(map, x, y, dir);
    await E.fadeIn(50);
  },

  // ------------------------------------------------------------ prologue
  async prologue(E) {
    await E.wait(30);
    await E.say('pim', '{c:grey}(Dinner is cereal again.){/c}', 'neutral');
    await E.say('pim', '{c:grey}(That\'s okay. Cereal is good.){/c}', 'forced');
    await E.balloon('waffles', '!');
    await E.say('waffles', 'Wuff!');
    await E.say('pim', 'No, Waffles. Cereal isn\'t for dogs.', 'neutral');
    await E.say('biscuit', 'Mrrp.');
    await E.say('pim', 'Shh. Mom is sleeping. We have to be quiet, okay?', 'neutral');
    await E.say(null, '{c:grey}Arrow keys to walk. Z to look at things and talk. X opens the menu.{/c}');
    Story.setTasks([['upstairs', 'Go to bed']]);
  },
};

// ---------------------------------------------------------------------------
// Scripted battle content (the Coat, the Rain Queen)
// ---------------------------------------------------------------------------
ENEMIES.coat = {
  name: 'THE COAT', sprite: 'en_coat', hp: 999, atk: 20, def: 99, spd: 5, luck: 0, exp: 0, marbles: 0, h: 440, boss: true, noOverwhelm: true, noKO: true,
  desc: 'It still smells like him.',
  async script(B, me) { return BATTLE_STORY.coat_turn(B, me); },
  actions: [],
};
TROOPS.coat_fight = {
  enemies: ['coat'], bg: 'bg_attic', bgm: 'bgm_attic', boss: true, noRun: true, noLose: true, noRewards: true,
  intro: 'The coat stands up. It is much taller than Pim.',
  async afterAction(B, act) {
    if (act.type !== 'together' || !B.flags.rescued) return;
    const coat = B.enemies[0];
    await B.log('Everyone holds on to Pim. Tight.');
    await E.say('coat', '{c:grey}Be a big-{/c}');
    await B.log('THE COAT crumples to the floor. It\'s just an old coat.');
    coat.alive = false; coat.dying = true;
    Game.tween(coat, { alpha: 0, drop: 40 }, 60);
    await B.wait(60);
    B.forceResult = 'win';
  },
};

Object.assign(TROOPS.boss_queen, {
  intro: 'THE RAIN QUEEN weeps. The whole room is raining.',
  noRewards: true,
  async onTurnStart(B) {
    // nobody stays down in this fight
    for (const b of B.party) if (!b.alive) { await B.revive(b, 0.35, { quick: true }); await B.log(`${b.name} gets back up. They\'re not leaving.`); }
  },
});
Object.assign(TROOPS.tut_drizzlet, {
  intro: 'A DRIZZLET drifts out from under a pillow!',
  async onStart(B) {
    await E.say('biscuit', 'Ugh, a Drizzlet. Little rainclouds. They\'re all over the place since the Sun fell asleep.', 'neutral');
    await E.say('waffles', 'Feelings are like weather here! Things can get {c:yellow}CHEERY{/c}, {c:blue}GLOOMY{/c} or {c:red}HUFFY{/c}!', 'cheery');
    await E.say('biscuit', 'CHEERY things are fast but careless. GLOOMY things are slow and sturdy. HUFFY things hit hard and forget to defend.', 'neutral');
    await E.say('waffles', 'And if you MIX two feelings, you get a new one! And if you mix ALL THREE...', 'cheery');
    await E.say('biscuit', 'It\'s too much. They get {c:purple}OVERWHELMED{/c} and can\'t do anything for a turn.', 'neutral');
    await E.say('biscuit', 'My Hiss makes things HUFFY. Waffles\' Wag makes things CHEERY. Pim... your Twirl makes YOU cheery. Figure it out.', 'huffy');
    await E.say('waffles', 'And when we work together, our {c:pink}TOGETHER{/c} meter fills up! When it\'s full, we can do something special all at once!', 'cheery');
  },
});

const BATTLE_STORY = {
  // ---------------- the Coat (Pim alone in the attic) ----------------
  async coat_turn(B, me) {
    me.n = (me.n || 0) + 1;
    const pim = B.party[0];
    if (me.n === 1) {
      await B.log('THE COAT looms over PIM.');
      await E.say('coat', '{c:grey}Be a big girl.{/c}');
      await B.attack(me, pim, { power: 0.8 });
      return true;
    }
    if (me.n === 2) {
      await E.say('coat', '{c:grey}Don\'t cry.{/c}');
      await B.mood(pim, 'gloomy');
      await B.attack(me, pim, { power: 0.9 });
      return true;
    }
    if (me.n === 3) {
      await E.say('coat', '{c:grey}Keep your mom dry for me, okay?{/c}');
      await B.attack(me, pim, { power: 1.0 });
      await E.say('pim', 'I-I am! I\'m trying! I\'m trying so hard...', 'hurt');
      return true;
    }
    if (me.n === 4 && !B.flags.rescued) {
      B.flags.rescued = true;
      Sound.sfx('sfx_bark');
      Game.shake(6, 20);
      await B.log('Something is barking in the dark!');
      await E.say('waffles', 'PIM!!! I FOUND YOU! I smelled you all the way from the kitchen!', 'huffy');
      await E.say('biscuit', 'Get away from her, you moth-eaten old rag.', 'huffy');
      await E.say('momo', 'Pim! We\'re here. We\'re right here.', 'neutral');
      // the party joins the fight
      for (const id of ['biscuit', 'waffles', 'momo']) {
        if (!State.d.party.includes(id)) State.d.party.push(id);
      }
      const old = B.party;
      B.makeParty();
      B.party.forEach((b) => { const o = old.find((x) => x.id === b.id); if (o) Object.assign(b, { hp: o.hp, pep: o.pep, mood: o.mood, moodLv: o.moodLv, alive: o.alive }); });
      for (const b of B.party) { b.cardY = 220; Game.tween(b, { cardY: 0 }, 24, U.ease.outBack); }
      if (!State.d.together.includes('hug')) State.d.together.push('hug');
      B.gauge = GAUGE_MAX;
      await B.wait(20);
      await E.say('momo', 'Pim, we can do this together. Let\'s give her a {c:pink}hug{/c}.', 'cheery');
      await B.log('The TOGETHER meter is full! Use GROUP HUG!');
      return true;
    }
    if (B.flags.rescued) {
      await B.log('THE COAT sways... It doesn\'t seem so tall anymore.');
      return true;
    }
    return true;
  },

  // ---------------- the Rain Queen ----------------
  async queen_turn(B, me) {
    const F = B.flags;
    F.q = (F.q || 0) + 1;
    const pim = B.party.find((p) => p.id === 'pim');
    // the rain never stops
    if (me.hp < me.maxhp * 0.55 && !State.flag('umbrella_closed')) {
      await B.log('The rain doesn\'t stop. It never stops.');
      await B.heal(me, Math.round(me.maxhp * 0.3));
    }
    if (F.q === 2) {
      await E.say('queen', 'Please, sweetie. Go back to bed. You\'ll get soaked.', 'sad');
      await E.say('pim', 'Not until you wake up! Not until the sun comes out!', 'huffy');
    }
    if (F.q === 4 && B.party.some((p) => p.id === 'momo')) {
      const momo = B.party.find((p) => p.id === 'momo');
      await E.say('momo', 'Pim... fighting won\'t make the rain stop.', 'gloomy');
      await E.say('pim', 'It has to! I have to keep her dry! I promised!', 'huffy');
      await E.say('momo', 'You were never supposed to carry that by yourself.', 'neutral');
      await E.say('momo', 'I\'m going home now. She needs me.', 'cheery');
      Sound.sfx('sfx_mood_rainbow');
      momo.alive = false; momo.hp = 0;
      Game.tween(momo, { cardY: 260 }, 40, U.ease.inQuad);
      await B.log('MOMO floats up into the rain... and into THE RAIN QUEEN\'s arms.');
      B.party = B.party.filter((p) => p !== momo);
      State.removeParty('momo');
      me.hp = me.maxhp;
      await E.say('queen', '...Oh. Oh, I remember you.', 'soft');
      await B.wait(20);
      State.setFlag('show_close_umbrella');
      State.learnSkill('pim', 'close_umbrella');
      await B.log('PIM\'s umbrella feels so, so heavy...');
      await B.log('Maybe... it\'s time to close it. (Check PIM\'s SKILLS.)');
      return true;
    }
    if (F.q > 4 && !State.flag('umbrella_closed') && F.q % 2 === 0) {
      await B.log('PIM\'s arms are shaking. The umbrella is so heavy.');
    }
    return false; // normal attack
  },

  async close_umbrella(B, u) {
    State.setFlag('umbrella_closed');
    Sound.stopBgm(3);
    Sound.sfx('sfx_umbrella', { pitch: 0.8 });
    await B.log('PIM closes her umbrella.');
    await B.wait(40);
    await B.log('The rain falls on her.');
    await B.wait(30);
    Sound.sfx('sfx_mood_gloomy');
    B.setMood(u, 'gloomy', 1);
    await B.log('PIM feels GLOOMY.');
    await B.wait(30);
    await E.say('pim', '...', 'hurt');
    await E.say('biscuit', 'There you go, kid.', 'gloomy');
    await E.say('waffles', 'It\'s okay, Pim. We\'re right here. We\'re not going anywhere.', 'gloomy');
    State.setFlag('show_cry');
    State.learnSkill('pim', 'cry');
    await B.log('It\'s okay to cry. (A new skill: CRY.)');
  },

  async cry(B, u) {
    const pim = u;
    Sound.stopBgm(2);
    await B.log('PIM cries.');
    await E.say('pim', 'I\'m not fine.', 'cry');
    await E.say('pim', 'I\'m not fine, Mom. I miss Dad. And I miss you. I miss you even when you\'re right here.', 'cry');
    await E.say('pim', 'I tried so hard. I tried so hard to keep you dry. I made toast and I fed Biscuit and Waffles and I told everyone we were fine...', 'cry');
    await E.say('pim', '{shake}And it just kept raining!{/shake}', 'cry');
    Sound.playBgm('bgm_final2', { restart: true, fadeIn: 3 });
    await B.wait(60);
    await E.say('queen', 'Oh, Pim...', 'soft');
    await E.say('queen', 'Oh, my baby. You were holding that umbrella all by yourself?', 'sad');
    await E.say('queen', 'That was never your job. It was never, ever your job.', 'soft');
    await E.say('queen', 'I\'m so sorry. Come here.', 'soft');
    await B.log('THE RAIN QUEEN holds PIM. They cry together.');
    await B.wait(40);
    await B.log('The rain is still falling. But it\'s warm now.');
    await B.wait(40);
    B.enemies[0].alive = false; B.enemies[0].dying = true;
    Game.tween(B.enemies[0], { alpha: 0 }, 90);
    Game.flash('#fff8dc', 0.8, 90);
    await B.wait(100);
    B.forceResult = 'win';
  },
};

window.Story = Story; window.BATTLE_STORY = BATTLE_STORY;
