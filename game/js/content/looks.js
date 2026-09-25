'use strict';
// ---------------------------------------------------------------------------
// What examining things says (see Prop.lookLines in map.js for the format).
// ---------------------------------------------------------------------------
// A value is a narration line, a list of lines, or a function returning either. A line is text or
// [speaker, text, face]; 'think' is Pim thinking. Keys: a prop id (every copy on the map) or 'propId@x,y'.

// ---- the real house ----
Object.assign(LOOKS, {
  pim_room: {
    chair: ['Pim\'s desk chair. One leg is a little short, so a folded-up drawing lives under it.', ['think', 'It\'s one of the suns. It has a very important job.', 'cheery']],
    rug_round: 'A round pink rug, fluffy as a cloud. Biscuit naps in the exact middle and glares at anyone who steps on it.',
  },
  hallway: {
    side_plant: ['A trailing plant on a little side table. Mom always said nothing could kill it.', ['think', 'I water it with my toothbrush cup anyway. Just to be sure.', 'neutral']],
  },
  downstairs: {
    'window@5,2': 'Raindrops race down the kitchen window. Pim always bets on the one on the left. It never wins.',
    'window@18,2': 'Curtains with tiny flowers, tied back to let the light in. There isn\'t much light to let in.',
    'chair@3,7': ['Dad\'s chair. Nobody sits in it anymore.', 'Except Biscuit. Biscuit sits wherever Biscuit wants.'],
    plant: ['A big plant with holes in its leaves. Pim used to think a caterpillar was eating it.', ['think', 'It makes the holes on purpose. Plants are weird.', 'neutral']],
    rug_long: () => (State.d.chapter >= 4
      ? ['The green rug with the pink flower. One end of the fringe is chewed. Waffles looks very innocent.', ['think', 'In the dream, this rug went on for miles.', 'neutral']]
      : 'The green rug with the pink flower. One end of the fringe is chewed. Waffles looks very innocent.'),
    coffee_table: 'Mom\'s paw-print mug is still on the coffee table. Whatever was in it is a science project now.',
    floor_lamp: ['A lamp with a little pull chain. It\'s on. Pim leaves it on all the time now.', ['think', 'So the house looks like somebody\'s awake.', 'neutral']],
  },
  yard: {
    house_front: ['Pim\'s house. Yellow walls, a red roof, and flowers in the window boxes.', ['think', 'From out here it looks totally fine.', 'forced']],
    'flowerbed@5,11': ['Pink, red and white tulips. Nobody has watered them in weeks.', ['think', 'The rain did it for us. So the rain is good for something.', 'neutral']],
    bush: 'A round bush with little white flowers. Waffles has sniffed every single one. Twice.',
    'bush@1,12': 'Pim\'s old hide-and-seek bush. Dad always pretended he couldn\'t find her, even with her shoes sticking out.',
  },
  yard_after: {
    house_front: ['The house looks like it\'s soaking up the sun, the same as everybody else.', ['think', 'Not everything is fine yet. But it\'s getting there.', 'cheery']],
    tree: 'Pim\'s climbing tree. Somebody finally moved into Dad\'s birdhouse. They sing about it all morning.',
    'flowerbed@3,9': 'No more weeds. Well, one. Mom let a single dandelion stay because she says it earned it.',
    'flowerbed@5,11': 'The bed Mom is working on. She has mud on her knees and doesn\'t mind one bit.',
    'flowerbed@12,6': 'A brand-new flower bed. Pim helped dig it. Mostly she helped the worms find new homes.',
    mailbox: 'No scary red letters in the mailbox today. Just a seed catalog with Mom\'s name on it.',
    bush: 'The bushes are dry for once. Their little white flowers smell like spring.',
  },
  attic_real: {
    'box_stack@1,3': ['Pim peeks into the top box. Baby clothes, and a tiny yellow hat.', ['think', 'No album. Was my head ever that small?', 'surprised']],
    'box@2,3': 'Christmas lights, tangled into one enormous knot. Someone gave up on them a long time ago.',
    sheet_furniture: ['Something big under a white sheet. In the flashlight it looks like a ghost sitting down for a rest.', ['think', 'It\'s an armchair. It\'s definitely just an armchair.', 'forced']],
    trunk: ['A big old trunk with brass corners and faded patches from faraway places.', 'It\'s locked. Pim knocks on the lid, just in case. The trunk keeps its secrets.'],
    'box@10,8': 'A box of Pim\'s old drawings and spelling tests. Mom kept every single one.',
    'box_stack@12,7': 'More boxes. One of them rattles when Pim pokes it. She decides not to find out why.',
    window: ['A tiny window with flowery curtains. Mom hung them up here so the boxes would have a view.', 'Right now the view is just rain.'],
  },
});

// ---- the Pillow Fort and Crumb Valley ----
Object.assign(LOOKS, {
  fort: {
    blanket_tent: ['A pink blanket covered in stars, stretched over two wooden chairs. Soft cushions wait inside.', ['waffles', 'SECRET BASE! The password is... WAFFLES. Oh no. I said it out loud.', 'cheery']],
    pillow_pile: ['A heap of pastel pillows, spotty and stripy. A yellow star-shaped one peeks out at the side.', ['biscuit', 'Drizzlets love hiding under there. So do I. We don\'t talk about it.', 'neutral']],
    pillow: ['One big cream pillow, plumped up and perfectly dry.', ['think', 'Dry pillows are good. Dry means everything\'s fine.', 'forced']],
    toy_blocks: ['Wooden blocks stacked into a careful pyramid. Pull out the bottom one and the whole thing comes down.', ['biscuit', 'The urge to knock it over is... considerable.', 'neutral']],
    cardboard_castle: ['A cardboard castle flying pink and blue flags. Every squished corner has been patched with tape.', ['think', 'If you keep taping it, it stays up. That\'s how it works.', 'forced']],
    book_stack: ['Three picture books: one with a moon, one with a bunny, and one with a little house on the cover.', ['think', 'The house one is my favourite. Everybody in it is home by the end.', 'neutral']],
  },
  crumb_1: {
    cereal_box: ['A towering cereal box. On the front, a yellow sun rises over green hills, wide awake and shining.', ['think', 'Cereal for dinner is fine. The box has a sun on it and everything.', 'forced'], ['biscuit', 'At least somebody\'s sun is up.', 'neutral']],
    milk_carton: ['A milk carton as big as a lighthouse, with blue spots like a very confused cow.', ['think', 'I should check the date. ...Wait. It\'s a dream. Dreams don\'t go sour.', 'neutral']],
    salt: 'A glass salt shaker as tall as a tree. Rain taps on its metal cap. Plink. Plink.',
    pepper: ['A wooden pepper mill with a brass knob, right beside the salt. Those two always go together.', ['waffles', 'Ah... AH... AAAH... ...nope. False alarm.', 'neutral']],
    bread: ['A loaf of bread as long as a sofa, dusted with flour.', ['think', 'That\'s a whole week of toast. Maybe two.', 'neutral']],
    butter: ['A block of butter in a flowery dish, soft enough to spread.', ['think', 'All the way to the corners. Otherwise it doesn\'t count.', 'neutral']],
    jam_jar: ['A big jar of strawberry jam with a checked cloth tied over the lid.', ['think', 'I can never get these open by myself.', 'down']],
    sugar_cube: ['A sugar cube the size of a footstool. Pim gives it a shove, but it\'s stuck fast to the tablecloth.', ['waffles', 'I am being SO polite right now. I am NOT licking it. Look at me not licking it!', 'cheery']],
    fork_fence: ['Forks stuck prongs-up in the tablecloth, tangled with vines and tiny flowers. A very pointy garden.', ['biscuit', 'Whoever set this table was having a day.', 'neutral']],
  },
  crumb_town: {
    teacup_house: ['A cream teacup with blue flowers, turned into a house. A warm light glows in its little window.', ['think', 'Somebody\'s home in there. You can just tell.', 'neutral']],
    teacup_house2: ['A pink teacup house with rosebuds by the door. The handle would make a very good slide.', ['waffles', 'I could live in a teacup! If I curled up REALLY small! And left my tail outside!', 'cheery']],
    teapot_house: ['The grandest house in town: a pink teapot wrapped in ivy, puffing smoke from a little brick chimney.', ['biscuit', 'A teapot, standing outside a house that is also a teapot. Nobody here finds that odd.', 'neutral']],
    sugar_bowl: () => (State.flag('momo_joined')
      ? ['The big blue-flowered sugar bowl. There\'s still a damp little patch on the ground behind it.', ['momo', 'I hid back there for ages. It smelled sweet, at least. ...Sorry, that\'s a strange thing to say.', 'down']]
      : 'A big sugar bowl with blue flowers and a gold knob on the lid. Something behind it is sniffling.'),
    candle_light: ['A stubby candle in a brass holder, its wax dripping down the sides like icing.', ['waffles', 'It smells like BIRTHDAYS!', 'cheery']],
    fork_fence: ['Forks jammed into the road north and tied together with vines. A very official-looking roadblock.', ['biscuit', 'Let me guess. Regulations.', 'neutral']],
  },
  crumb_river: {
    bread: ['A loaf of bread left too close to the river. Its bottom crust has soaked up the milk.', ['think', 'Nobody ever wants the soggy bits.', 'down']],
    jam_jar: ['A jar of strawberry jam, very conveniently close to the ant\'s post.', ['biscuit', 'In charge of the sugar cubes. And, apparently, the jam.', 'neutral']],
    salt: ['A salt shaker standing all alone by the milk. There\'s no pepper anywhere.', ['think', 'It looks lonely without the other one.', 'neutral']],
    sugar_bowl: ['A big blue-flowered sugar bowl, where the sugar cubes must come from. The lid is far too heavy to lift.', ['waffles', 'Is there MORE sugar in there? For the river, I mean. ...Mostly for the river.', 'cheery']],
  },
  crumb_peak: {
    candle_light: ['A candle burns in a brass holder on the mountainside. The rain hisses whenever it gets too close.', ['momo', 'It\'s so warm. I\'ll stand back a little, so I don\'t drip on it. Sorry.', 'down']],
    bread: () => (State.flag('grumbles_down')
      ? 'A big loaf of bread, waiting its turn for the toaster. It looks much less nervous now.'
      : ['A big loaf of bread, waiting its turn for the toaster at the top.', ['biscuit', 'Poor thing. It knows exactly what\'s coming.', 'neutral']]),
    butter: 'A butter dish set out at the top of the mountain, as if somebody still expects everyone for breakfast.',
  },
});

// ---- Carpet Hills, the Static Woods, the dream Attic and the Cloud Keep ----
Object.assign(LOOKS, {
  carpet_1: {
    cushion_hill: () => (State.flag('elder_quest') && !State.flag('found_remote')
      ? ['Pim pokes between these cushions. A button, some fluff, a lot of nothing. No remote here.',
        ['biscuit', 'Not these ones. Try the big cushions to the east. That\'s where I\'d hide something.', 'neutral']]
      : ['A hill of couch cushions under a plaid blanket. Somebody left a little ladder for climbers.',
        ['waffles', 'I napped up there every single day! I was NOT allowed. I did it anyway!', 'cheery']]),
    lamp_tree: ['A floor lamp that grew roots. Ivy winds up its trunk, and a pull-chain dangles from the fringed shade.',
      ['biscuit', 'That chain is swinging. I am not looking at it. I am a very serious cat.', 'huffy']],
    books_tower: ['A wobbly tower of old books, taller than a house. The ivy is doing most of the work holding it up.',
      ['waffles', 'I chewed the corner of one of those once. It tasted like homework.', 'cheery']],
    lint_tree: ['A little tree with a puffy crown of lint and dust. It sways and sheds a few grey fluffs.',
      ['biscuit', 'None of that is my fur. I want that on the record.', 'huffy']],
    coin_big: ['A penny as big as a wagon wheel, standing on its edge. It must have rolled under here years ago.',
      ['waffles', 'If we roll it home, are we RICH? Pim, are we rich now?', 'cheery'],
      ['biscuit', 'It\'s one penny, Waffles.', 'neutral']],
    crayon: ['A red crayon as big as a fence post, still in its paper wrapper.',
      ['think', 'So THAT\'s where my red one went!', 'surprised']],
    plant_pot: ['A houseplant in a clay pot, as big as a tree down here. Its vines hang over the edge, a little droopy.',
      ['momo', 'All this rain, and it still looks thirsty. I think it misses the sun.', 'gloomy']],
  },
  carpet_village: {
    dust_hut: () => (State.flag('static_down')
      ? ['A round fluff hut. Little giggles keep leaking out of its round window.',
        ['waffles', 'They remembered how to laugh! Pim, we did that!', 'cheery']]
      : ['A round hut of grey fluff with a wooden door. Threads and paper scraps are stuck in its walls.',
        ['momo', 'It\'s so quiet in there. Someone\'s home, I think. They\'re just not laughing.', 'gloomy']]),
    lamp_tree: ['A lamp tree lights up the edge of Fluffton like a streetlight.',
      ['waffles', 'It\'s like a campfire! But a lamp! But a TREE!', 'cheery']],
    books_tower: ['A tower of old books leans over the village. From the top you could probably see the whole couch.',
      ['biscuit', 'I could climb it. I won\'t. But I could.', 'neutral']],
    coin_big: 'A giant copper coin, standing on its edge in the middle of Fluffton. Down here, it\'s probably the bank.',
    crayon: ['A giant red crayon that rolled all the way under the couch. Crayons always end up down here.',
      ['waffles', 'Everything ends up under the couch! Like me, during thunderstorms!', 'cheery']],
    lint_tree: ['A lint tree, fluffy and grey, just like everybody in Fluffton.',
      ['waffles', 'Hey Biscuit, is it a FAMILY tree? Because the bunnies are made of dust? Get it?', 'cheery'],
      ['biscuit', 'I get it. I wish I didn\'t.', 'neutral']],
  },
  static_woods: {
    antenna_tree: ['A tree made of old TV antennas. A little bird perches on top, trying to get better reception.',
      ['biscuit', 'A bird. Up high. Just out of reach. The story of my life.', 'neutral']],
    tv_small: ['A little TV nailed to a post, crackling away to nobody. This one doesn\'t seem to want to change channels.',
      ['waffles', 'Hello? Anybody in there? ...It just went KSSSH at me.', 'gloomy']],
  },
  static_heart: {
    tv_giant: () => (State.flag('static_down')
      ? ['The giant TV is calm now. Every so often, a little snort of laughter crackles out of its speaker.',
        ['biscuit', 'It still makes that face, though. I respect the face.', 'neutral']]
      : ['An enormous old TV, standing on a tangle of cable legs. Deep in the static, something is grinning.',
        ['waffles', 'Pim? I don\'t think that\'s a nice TV.', 'gloomy']]),
    antenna_tree: 'An antenna tree leaning toward the giant TV. The little bird on top hasn\'t taken its eyes off the screen.',
  },
  attic_1: {
    box: 'A cardboard box, taped shut. Then taped again. And again. Somebody really wanted it to stay closed.',
    box_stack: ['Boxes stacked on boxes. In the flashlight, their shadows lean over Pim like they\'re curious.',
      ['think', 'I\'m not scared of shadows. I\'m ten.', 'forced']],
    sheet_furniture: ['Something under a white sheet. Its wooden legs poke out at the bottom, as if it forgot to hide them.',
      ['think', 'It\'s a chair. Chairs don\'t move. Chairs definitely don\'t move.', 'forced']],
    'sheet_furniture@14,13': 'Another sheet-covered chair. Pim is almost sure it was a little farther away a minute ago.',
    trunk: ['A big old travel trunk with brass corners and faded patches. The latch is rusted shut.',
      ['think', 'Somebody was always packing to go somewhere.', 'neutral']],
  },
  attic_2: {
    sheet_furniture: ['A white sheet over something low and lumpy. When the flashlight flickers, the sheet seems to breathe.',
      ['think', 'It didn\'t. It\'s just the dark playing tricks.', 'forced']],
    lantern: ['A round paper lantern with leaves painted on it, glowing all by itself. It\'s the only warm thing up here.',
      ['think', 'Maybe I\'ll stay next to it for a little bit.', 'neutral']],
  },
  attic_3: {
    photo_frames: 'The same photos again. The same three smiling faces.',
    'photo_frames@5,2': ['Photos on the wall: Mom, Dad and Pim, smiling. A cat. A little flower.',
      ['think', 'Don\'t stop. Keep going.', 'forced']],
    'photo_frames@21,2': 'The same photos. Again. Nobody in them has moved at all.',
    'photo_frames@29,2': 'The same photos, one last time. The door is close now.',
    sheet_furniture: 'A chair under a sheet, turned to face the hall. As if it\'s been waiting for someone to come home.',
    trunk: 'The same old travel trunk. Or one just like it. Its latch rattles all by itself.',
  },
  keep_1: {
    cloud_pillar: ['A pillar of soft cloud, holding up the sky. Or maybe the sky is holding it up.',
      ['biscuit', 'Everything up here is either a cloud or wet. Usually both.', 'neutral']],
    cloud_bush: ['A bush made of cloud. Raindrops hang off it like little berries.',
      ['waffles', 'Rain berries! Can I eat one? ...Biscuit is giving me a look. Okay. Okay.', 'neutral']],
    'lantern@9,6': 'A paper lantern on a little wooden stand. However hard it rains, it just keeps glowing.',
    'lantern@13,20': 'A paper lantern glowing beside the path. The spot next to it looks like a good place to rest.',
    umbrella_stand: ['An umbrella stand out on the cloud stairs, slowly filling up with rain.',
      ['waffles', 'Should we take one? Oh, wait. Pim already has one. Pim ALWAYS has one.', 'neutral']],
  },
  keep_2: {
    rain_window: ['A tall arched window. The rain runs down the glass in long, slow lines, like it forgot how to stop.',
      ['waffles', 'Do you think it\'s sunny somewhere? Anywhere? Even just a little?', 'gloomy']],
    'rain_window@17,1': 'Rain on the glass, and more rain behind it. Far off, one cloud looks a tiny bit brighter. Maybe.',
    cloud_pillar: 'A cloud pillar, cool and damp to the touch, like a pillow after a long cry.',
    laundry_pile: ['A heap of laundry: sweaters, socks, a plaid shirt. Nobody has folded anything in a long time.',
      ['think', 'I can fold them. I watched Mom do it lots of times.', 'forced']],
    'laundry_pile@19,12': ['Another laundry heap. A pink sock pokes out all alone, looking for its other half.',
      ['biscuit', 'Tell it to check Fluffton. Its other half sells snacks now.', 'neutral']],
    umbrella_stand: ['A stand painted with blue flowers, holding a dark umbrella and a pink one. Both are bone dry.',
      ['think', 'Umbrellas are for going outside. Mom doesn\'t go outside anymore.', 'down']],
    'lantern@7,9': 'A paper lantern, glowing softly. The spot just in front of it looks like a good place to rest.',
    'lantern@20,9': 'A paper lantern with painted leaves. Its glow turns the drizzle into little falling sparks.',
  },
  keep_3: {
    queen_throne: ['A bed made of clouds, heaped with blue blankets and pillows. So soft it would be very hard to get up.',
      ['momo', 'She\'s been lying there for so long. She\'s so tired.', 'gloomy']],
    tissue_box: 'A flowery tissue box beside the bed. One last tissue sticks up out of it, just in case.',
    lantern: 'A paper lantern glows at the edge of the room, like a nightlight left on for someone.',
  },
});
