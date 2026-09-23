"""Art generation jobs for PITTER-PATTER (GPT Image via Codex CLI).

Each job produces one raw image in art_raw/<name>.png. `refs` are earlier outputs
attached as reference images (for consistent character designs). `phase` orders
the work so references exist before they are needed. `prio` orders jobs inside a
phase (lower first) so the most important art is made first if the quota runs out.
"""

STYLE = (
    "Art style: soft hand-drawn 2D illustration for a cute, slightly melancholic indie RPG (in the spirit of "
    "hand-drawn RPG Maker games): clean dark charcoal-brown outlines with gently uneven hand-inked line weight, "
    "flat pastel colours with subtle coloured-pencil / crayon grain texture, very light simple shading, round "
    "simple shapes. Characters have chibi proportions (big round head, small body), simple black dot eyes with a "
    "tiny white highlight, small mouths and rosy blush on the cheeks. Charming and wholesome, a little bit sad. "
    "No text, no letters, no numbers, no watermark, no signature, no border."
)
TRANSPARENT = "Background: fully transparent (real alpha channel). No backdrop, no floor, no cast shadow, no frame."
SHEET = ("Layout: a clean sprite sheet. Every item is complete, fully visible and centred in its own cell of an "
         "invisible grid, with plenty of empty transparent space between items. Items must not touch or overlap. "
         "All items share one consistent style and scale.")
PROPVIEW = ("View: 3/4 top-down view like an RPG Maker map object (seen from the front and slightly above), "
            "standing upright, the base of each object at the bottom.")

PIM = ("Pim, a 10-year-old girl: short straight black bob haircut with blunt bangs, a small yellow star-shaped hair "
       "clip on one side, big dark dot eyes, rosy cheeks, pale skin; an oversized mint-green knit sweater with long "
       "sleeves, navy-blue shorts, white knee socks, red rubber rain boots; she holds a closed red umbrella with white "
       "polka dots (tip down).")
BISCUIT = ("Biscuit, a chubby orange tabby cat with darker orange stripes, white chest and white paws, half-lidded "
           "unimpressed eyes, standing upright on two legs like a little person, wearing a small teal neckerchief.")
WAFFLES = ("Waffles, a fluffy golden retriever puppy with big floppy ears and a happy open-mouth smile, standing "
           "upright on two legs like a little person, wearing a red bandana around his neck.")
MOMO = ("Momo, a small round sheep whose wool is a soft fluffy cloud (white with pale lavender-blue shading), a tiny "
        "dark grey face with big gentle shiny eyes and pink cheeks, four short stubby dark legs, one or two tiny blue "
        "raindrops floating near her.")
MOM = ("Pim's mom, a thin woman in her late thirties (taller, adult proportions but in the same cute style): kind "
       "tired face with faint dark circles, long dark hair in a messy low bun with loose strands, an oversized "
       "lavender cardigan over a grey t-shirt, striped pyjama trousers, fuzzy slippers.")
DAD = ("Pim's dad, a tall man in his late thirties (adult proportions, same cute style): short messy brown hair, "
       "light stubble, a gentle sad smile, a long dark-grey raincoat.")
QUEEN = ("The Rain Queen: a huge, gentle, sorrowful giant woman made of soft blue-grey rain clouds. Her long hair "
         "and flowing gown dissolve into clouds and falling rain. Pale blue face with closed, teary eyes, tears "
         "running down like rain; her hair is gathered in a messy low bun like a tired mother's. She sits on an "
         "enormous soft bed made of clouds. Majestic but tender and heartbreaking, not scary.")

JOBS = []


def job(name, prompt, aspect="landscape", transparent=True, refs=None, phase=1, prio=5):
    JOBS.append(dict(name=name, prompt=prompt, aspect=aspect, transparent=transparent, refs=refs or [], phase=phase, prio=prio))


# ---------------------------------------------------------------- phase 1: designs
job("pim_turn", f"Character turnaround sheet for an RPG overworld sprite. {PIM} Show the SAME girl three times in "
    "one row, full body, neutral standing pose, same height: (1) front view facing the viewer, (2) side view "
    "facing LEFT, (3) back view. " + SHEET + " " + TRANSPARENT + " " + STYLE, phase=1, prio=0)
job("party_turn", "Character turnaround sheet for RPG overworld sprites: three companion characters, each shown "
    "three times in its own row (row 1 Biscuit, row 2 Waffles, row 3 Momo): (1) front view facing the viewer, "
    "(2) side view facing LEFT, (3) back view; full body, standing, same height within each row. "
    f"Row 1: {BISCUIT} Row 2: {WAFFLES} Row 3: {MOMO} " + SHEET + " " + TRANSPARENT + " " + STYLE,
    aspect="square", phase=1, prio=1)
job("mom_turn", f"Character turnaround sheet for an RPG overworld sprite. {MOM} Show her three times in one row, "
    "full body, standing with slightly slumped tired posture: (1) front view, (2) side view facing LEFT, (3) back "
    "view. " + SHEET + " " + TRANSPARENT + " " + STYLE, phase=1, prio=6)
job("pets_real", "Two real pets as simple overworld RPG sprites, each shown three times in its own row, walking on "
    "all four legs like normal animals (NOT standing up, no clothes): row 1 a chubby orange tabby cat with white "
    "chest and paws; row 2 a fluffy golden retriever puppy with floppy ears and a red collar. Views: (1) front, "
    "(2) side view facing LEFT, (3) back view. " + SHEET + " " + TRANSPARENT + " " + STYLE, phase=1, prio=7)

# ---------------------------------------------------------------- phase 2: portraits (with references)
FACE = ("A character expression sheet for dialogue portraits: head-and-shoulders portraits of the SAME character "
        "(match the attached reference exactly: same design, colours and proportions), each portrait centred in its "
        "own square cell of an invisible grid, facing the viewer, same size and framing in every cell. ")
job("face_pim", FACE + "CLOSE-UP BUST PORTRAITS ONLY: show just her head, hair, neck and the top of her mint-green "
    "sweater (cropped at the chest); the head fills most of each cell. NO legs, NO boots, NO umbrella, NOT full body. "
    f"{PIM} Grid of 4 columns x 2 rows, expressions in reading order: (1) neutral calm, "
    "(2) cheerful big smile, (3) a forced smile: smiling mouth but sad, teary, tired eyes, (4) huffy angry pout with "
    "puffed cheeks, (5) hurt, wincing in pain, (6) surprised, wide eyes and open mouth, (7) crying openly, tears "
    "streaming, mouth wobbling, (8) exhausted and dizzy, eyes closed with little swirls. " + TRANSPARENT + " " + STYLE,
    refs=["pim_turn"], phase=2, prio=0)
for nm, desc, ref in [("biscuit", BISCUIT, "party_turn"), ("waffles", WAFFLES, "party_turn"), ("momo", MOMO, "party_turn")]:
    job(f"face_{nm}", FACE + f"{desc} Grid of 3 columns x 2 rows, expressions in reading order: (1) neutral, (2) happy "
        "and cheerful, (3) sad and gloomy with teary eyes, (4) angry and huffy, (5) hurt, wincing, (6) exhausted and "
        "dizzy, eyes closed with little swirls. " + TRANSPARENT + " " + STYLE, refs=[ref], phase=2, prio=1)
job("face_mom", FACE + f"{MOM} Grid of 3 columns x 2 rows, expressions in reading order: (1) tired and blank, "
    "(2) sad, eyes glistening, (3) a small weak smile, (4) crying, (5) a warm loving smile with tears in her eyes, "
    "(6) surprised. " + TRANSPARENT + " " + STYLE, refs=["mom_turn"], phase=2, prio=3)
job("face_misc", "Four dialogue portraits (head and shoulders) centred in the cells of an invisible 2 x 2 grid, "
    f"same size: (1) {QUEEN} Neutral, weeping gently. (2) The Rain Queen very sad, face in sorrow. (3) The Rain "
    f"Queen with a soft tender smile, tears still falling. (4) {DAD} Background: plain flat pure white everywhere, "
    "no pattern, no checkerboard, no texture behind the portraits. " + STYLE,
    aspect="square", transparent=False, refs=["mom_turn"], phase=2, prio=4)

# ---------------------------------------------------------------- phase 1: enemies
ENEMYSHEET = ("Battle sprites of cute monsters that are really feelings, for a turn-based RPG. Each monster is shown "
              "whole, facing the viewer, with personality. ")
job("en_sheet1", ENEMYSHEET + "Grid of 3 columns x 2 rows: (1) Drizzlet: a tiny grumpy raincloud creature with stubby "
    "legs and a pouty face, dripping raindrops. (2) Grumpy Toast: an angry burnt slice of toast with little arms and "
    "legs, charred black edges, furrowed brows. (3) Sour Lemon: a sulky yellow lemon with a puckered sour face, a "
    "little leaf on top, tiny arms crossed. (4) Sugar Mite: a hyperactive sugar cube bug with six tiny legs, huge wide "
    "eyes and sparkles. (5) Forkling: a small proud silver fork creature with a cute face, standing on its prongs. "
    "(6) Dust Bunny: a round fluffy grey dust bunny with long rabbit ears, made of dust and lint, grumpy squinting eyes. "
    + SHEET + " " + TRANSPARENT + " " + STYLE, phase=1, prio=2)
job("en_sheet2", ENEMYSHEET + "Grid of 3 columns x 2 rows: (1) Lost Sock: a lonely striped sock curled like a little "
    "snake, button eyes, very sad expression. (2) Lint Moth: a fuzzy moth made of grey sweater lint with fluffy "
    "antennae and tattered wings. (3) Couch Coin: a grumpy old copper coin creature with a face, a bit scratched and "
    "dusty. (4) Static Wisp: a small ghost made of flickering black-and-white TV static, glitchy outline, hollow "
    "eyes. (5) Remote Critter: a TV remote control creature with little legs, button eyes, an antenna and a "
    "mischievous grin. (6) Rain Wisp: a pale blue weeping raindrop spirit with a wispy tail and teary eyes. "
    + SHEET + " " + TRANSPARENT + " " + STYLE, phase=1, prio=3)
job("en_sheet3", ENEMYSHEET + "Grid of 2 columns x 2 rows: (1) Thunderhead: an angry dark-purple storm cloud creature "
    "with a lightning bolt, puffed cheeks and glowing yellow eyes. (2) Brolly Bat: a broken black umbrella turned "
    "inside out that looks like a bat, torn fabric wings, tiny red eyes. (3) Tissue Ghost: a crumpled used tissue "
    "ghost with sad droopy eyes and a runny nose. (4) Laundry Pile: a big lumpy heap of unwashed clothes (sweaters, "
    "socks, pyjamas) forming a sleepy monster with two tired eyes peeking out. " + SHEET + " " + TRANSPARENT + " " + STYLE,
    aspect="square", phase=1, prio=4)
job("en_grumbles", "Boss monster battle sprite: Grumbles, a big angry retro chrome toaster with a furious face, "
    "glowing red-hot coils visible in its bread slots, two slices of burnt toast popping out, puffs of dark smoke, "
    "little stubby legs. Single character, centred, facing the viewer. " + TRANSPARENT + " " + STYLE,
    aspect="square", phase=1, prio=5)
job("en_thestatic", "Boss monster battle sprite: The Static, a huge old-fashioned CRT television monster with a "
    "screen full of black-and-white static that forms a menacing face, rabbit-ear antennas, tangled cables like "
    "tentacles, on a little wooden TV stand. Single character, centred, facing the viewer. " + TRANSPARENT + " " + STYLE,
    aspect="square", phase=1, prio=5)
job("en_rainqueen", f"Final boss battle sprite. {QUEEN} Single character, centred, whole figure including the "
    "cloud bed, facing the viewer. " + TRANSPARENT + " " + STYLE, aspect="portrait", refs=["mom_turn"], phase=2, prio=2)
job("en_coat", "A tall, empty, dark grey man's raincoat with a hat, standing by itself like a faceless person (there "
    "is nobody inside, only darkness in the collar), rain water dripping from its hem, slightly menacing but sad. "
    "Single figure, full body, centred, facing the viewer. " + TRANSPARENT + " " + STYLE, aspect="portrait", phase=1, prio=6)

# ---------------------------------------------------------------- phase 1: NPCs
NPCSHEET = "Overworld NPC sprites for an RPG, each shown full body facing the viewer, same scale. "
job("npc_sheet1", NPCSHEET + "Grid of 3 columns x 3 rows, cute living kitchen objects: (1) Madame Teapot: a plump "
    "pink porcelain teapot lady with little painted roses, spout nose, kind grandmotherly eyes. (2) Salt: a white "
    "salt shaker person, prim and grumpy. (3) Pepper: a brown pepper shaker person, sneezy and cross. (4) Sergeant "
    "Ladle: a soup ladle soldier standing to attention with a tiny helmet and a moustache. (5) Egg: a sad egg with a "
    "crack down its side. (6) Muffin: a sleepy blueberry muffin in a paper cup, eyes half closed. (7) Gumball: a "
    "cheerful red gumball machine full of colourful gumballs, with a face. (8) Sprinkle Kid: a small donut child "
    "with pink icing and rainbow sprinkles. (9) Sugar Ant: a tiny friendly ant carrying a sugar grain. "
    + SHEET + " " + TRANSPARENT + " " + STYLE, aspect="square", phase=1, prio=8)
job("npc_sheet2", NPCSHEET + "Grid of 3 columns x 3 rows: (1) Elder Fluff: an old dust bunny with a long fluffy "
    "white beard and a walking stick. (2) a small cheerful dust bunny child. (3) Lint Hermit: a hunched lumpy "
    "creature made of grey-green lint with shiny bead eyes. (4) Old Lamp: a friendly old living table lamp with a "
    "fringed shade, glowing warmly. (5) Sock Puppet: a blue striped sock puppet with button eyes and a big grin. "
    "(6) Remote King: a TV remote control with a little golden crown. (7) Old Teddy: a worn, much-loved brown teddy "
    "bear with a patched ear, sitting. (8) Mrs. Okafor: a kind elderly neighbour lady with grey curly hair, glasses, "
    "a floral raincoat and gardening gloves. (9) a small soft white plush toy sheep, lying down (a stuffed toy). "
    + SHEET + " " + TRANSPARENT + " " + STYLE, aspect="square", phase=1, prio=9)
job("npc_sun", "The Sleepy Sun: a big round warm-yellow sun with a very sleepy, gentle face (eyes closed, a little "
    "drool, a tiny smile), short soft rays, wrapped halfway in a fluffy grey cloud like a blanket. Single character, "
    "centred. " + TRANSPARENT + " " + STYLE, aspect="square", phase=1, prio=10)

# ---------------------------------------------------------------- phase 1: props
PS = "Map objects for a cute RPG. " + PROPVIEW + " "
job("props_home1", PS + "Grid of 3 columns x 3 rows, items from a little girl's bedroom: (1) a single bed with a "
    "lilac blanket and a pillow, headboard at the top (seen from above at an angle), (2) a small wooden desk with a "
    "desk lamp and crayons, (3) a small wooden chair, (4) a wide bookshelf full of picture books, (5) a toy box with "
    "toys sticking out, (6) a white chest of drawers, (7) a window with rain on the glass and pale curtains, "
    "(8) a few children's crayon drawings of suns taped together, (9) a round fluffy pale pink rug seen from above. "
    + SHEET + " " + TRANSPARENT + " " + STYLE, aspect="square", phase=1, prio=11)
job("props_home2", PS + "Grid of 3 columns x 3 rows, house items: (1) a plain wooden interior door, closed, (2) a "
    "wooden bedroom door with a little heart-shaped sign, closed, (3) a wooden staircase going down (seen from "
    "above), (4) a wooden staircase going up, (5) three small family photo frames hanging together, (6) a small "
    "side table with a potted plant, (7) a folding attic ladder coming down from a ceiling hatch, (8) a tall white "
    "fridge with drawings held by magnets, (9) a kitchen counter with a sink and a toaster. "
    + SHEET + " " + TRANSPARENT + " " + STYLE, aspect="square", phase=1, prio=12)
job("props_home3", PS + "Grid of 3 columns x 3 rows: (1) a small white kitchen stove, (2) a front-loading washing "
    "machine with a laundry basket, (3) a small round kitchen table with a cereal bowl, (4) a long cosy sofa with a "
    "folded blanket, seen from behind at an angle, (5) an old boxy television on a low stand, (6) a small coffee "
    "table, (7) a tall floor lamp glowing warmly, (8) a small side table with an old landline phone, (9) two pet "
    "food bowls. " + SHEET + " " + TRANSPARENT + " " + STYLE, aspect="square", phase=1, prio=13)
job("props_home4", PS + "Grid of 3 columns x 3 rows, garden and house items: (1) a big potted house plant, (2) a "
    "front door with a small window and a doormat, (3) a short white picket fence segment, (4) a mailbox on a post, "
    "(5) a small flower bed with tulips and weeds, (6) a leafy green tree with a tiny birdhouse, (7) a round green "
    "bush, (8) a long rectangular rug with a simple pattern, seen from above, (9) a dusty old trunk. "
    + SHEET + " " + TRANSPARENT + " " + STYLE, aspect="square", phase=1, prio=14)
job("props_home5", PS + "Grid of 3 columns x 3 rows, attic and bedroom items: (1) a single cardboard box, (2) a tall "
    "stack of cardboard boxes, (3) furniture covered with a white dust sheet, (4) a tall standing mirror, (5) an old "
    "wooden rocking horse, (6) a cardboard box full of a man's things (scarf, mug, photos), (7) a big double bed with "
    "messy lavender-blue sheets, seen from above at an angle, (8) a small nightstand with a tissue box and a glass of "
    "water, (9) closed heavy curtains. " + SHEET + " " + TRANSPARENT + " " + STYLE, aspect="square", phase=1, prio=15)
job("props_misc", PS + "Grid of 3 columns x 3 rows: (1) a small pile of laundry, (2) a wooden coat rack, empty, "
    "(3) a large empty ornate picture frame, (4) a small wooden music box with the lid closed, (5) a glowing paper "
    "lantern on a little stand, (6) an umbrella stand with umbrellas, (7) a box of tissues, (8) a small framed photo "
    "on a stand, (9) a tall window with heavy rain running down it. " + SHEET + " " + TRANSPARENT + " " + STYLE,
    aspect="square", phase=1, prio=16)
job("house_front", "The front of a small cosy two-storey family house for an RPG town map, seen from the front and "
    "slightly above: pale yellow walls, a dark red roof, a front door in the middle of the ground floor with two steps "
    "and a little porch, windows (one upstairs window with closed curtains), a drainpipe, a small porch light. "
    + TRANSPARENT + " " + STYLE, phase=1, prio=17)
job("props_fort", PS + "Grid of 3 columns x 3 rows, things from a child's dream pillow fort: (1) a blanket tent made "
    "of a pink blanket draped over chairs, (2) a pile of big soft pillows, (3) one plump pillow, (4) a stack of "
    "wooden alphabet toy blocks (plain, no letters), (5) a crescent-moon shaped night-light glowing softly, (6) a "
    "cardboard box castle with paper flags, (7) a stack of picture books, (8) a huge mountain of laundry, (9) a tall "
    "soft door with a raindrop-shaped keyhole. " + SHEET + " " + TRANSPARENT + " " + STYLE, aspect="square", phase=1, prio=6)
job("props_crumb1", PS + "Grid of 3 columns x 3 rows, giant breakfast-table objects forming a whimsical dream "
    "landscape: (1) a tall glass salt shaker, (2) a tall wooden pepper mill, (3) a big cereal box (no text, just a "
    "sun picture), (4) a single sugar cube, (5) a teacup turned into a little house with a door and window, (6) a "
    "second teacup house in a different colour, (7) a big pink teapot turned into a cottage with a chimney, (8) a "
    "sugar bowl, (9) a loaf of bread. " + SHEET + " " + TRANSPARENT + " " + STYLE, aspect="square", phase=1, prio=7)
job("props_crumb2", PS + "Grid of 3 columns x 3 rows: (1) a block of butter, (2) a tall milk carton (no text), "
    "(3) a jar of strawberry jam, (4) a fence made of forks stuck in the ground, (5) a small candle in a holder "
    "glowing warmly, (6) a big soft sofa-cushion hill, (7) a floor lamp as tall as a tree, glowing, (8) a tall tower "
    "of stacked books, (9) a crayon standing upright. " + SHEET + " " + TRANSPARENT + " " + STYLE, aspect="square", phase=1, prio=8)
job("props_carpet", PS + "Grid of 3 columns x 3 rows, living-room dream objects: (1) a little tree made of grey "
    "lint and fluff, (2) a round hut made of dust and fluff with a small door, (3) a big copper coin standing on its "
    "edge, (4) a tall TV-antenna tree with wires, (5) a small old TV on a post showing static, (6) a big potted "
    "plant, (7) a remote control standing up like a tower, (8) a pile of popcorn, (9) a glass marble. "
    + SHEET + " " + TRANSPARENT + " " + STYLE, aspect="square", phase=1, prio=9)
job("props_keep", PS + "Grid of 3 columns x 3 rows, objects from a castle made of rain clouds: (1) a tall pillar "
    "made of fluffy cloud, (2) a low fluffy cloud bush, (3) a paper lantern glowing, (4) an umbrella stand made of "
    "clouds, (5) a huge soft bed-throne made of blue-grey clouds with pillows (seen from the front, slightly above), "
    "(6) a small photo in a frame, (7) a crumpled pile of tissues, (8) a rain-streaked window, (9) a puddle of water "
    "seen from above. " + SHEET + " " + TRANSPARENT + " " + STYLE, aspect="square", phase=1, prio=10)

# ---------------------------------------------------------------- phase 3: backgrounds & CGs (opaque)
BG = ("Battle background for a turn-based RPG (no characters, no monsters, nothing in the centre foreground, an open "
      "floor area in the lower middle where monsters will stand). Landscape. ")
job("bg_fort", BG + "Inside a magical dream pillow fort at night: pink and lavender blanket walls, fairy lights, paper "
    "stars, soft pillows at the edges, a little rain dripping through the blanket roof. " + STYLE, transparent=False, phase=3, prio=5)
job("bg_crumb", BG + "A dreamy giant breakfast table landscape: a gingham tablecloth plain, giant cereal boxes and "
    "salt shakers in the distance like buildings, a milk river, drizzly pastel sky. " + STYLE, transparent=False, phase=3, prio=5)
job("bg_carpet", BG + "A dreamy living room turned into rolling hills of soft green carpet, giant sofa cushions like "
    "mountains, a floor lamp like a glowing tree, dust bunnies' huts far away, rainy window light. " + STYLE, transparent=False, phase=3, prio=6)
job("bg_static", BG + "An eerie dark forest made of TV antennas and tangled cables, old televisions glowing with "
    "black-and-white static among them, grey fog. Unsettling but still cute. " + STYLE, transparent=False, phase=3, prio=6)
job("bg_keep", BG + "A castle in the sky made of blue-grey rain clouds, heavy rain falling, soft glowing lanterns, a "
    "huge sad empty bedroom feeling, pale moonlight. " + STYLE, transparent=False, phase=3, prio=6)
job("bg_attic", BG + "A dark dusty attic at night, cardboard boxes and furniture under white sheets, a round window "
    "with rain, a single beam of moonlight, an old coat hanging in the shadows. Creepy but gentle. " + STYLE, transparent=False, phase=3, prio=7)
job("cg_title", f"Title screen illustration, landscape. {PIM} She stands alone at night in the rain on the path in "
    "front of her small house, holding her open red polka-dot umbrella, looking up at the one dimly lit upstairs "
    "window. Her orange tabby cat and golden puppy sit beside her. Deep blue-purple night, soft rain, puddles "
    "reflecting the warm window. Leave the top third fairly empty (sky) for a title logo. " + STYLE,
    transparent=False, refs=["pim_turn"], phase=3, prio=0)
job("cg_dad", f"Emotional memory illustration, landscape, slightly faded like a memory. At the open front door of a "
    f"house on a rainy grey day, {DAD} He kneels with a suitcase beside him and hands a closed red umbrella with white "
    f"polka dots to a small girl. {PIM} (Here she is a bit younger, looking up at him, trying hard not to cry.) "
    "Rain outside, muted colours, a quiet heartbreaking moment. " + STYLE, transparent=False, refs=["pim_turn"], phase=3, prio=1)
job("cg_beach", f"A sunny family photo at the beach, landscape, drawn in the same style (like a warm happy memory): "
    f"{DAD} laughing, with {PIM} (younger, in a swimsuit, no boots) sitting on his shoulders; {MOM} (healthy, happy, "
    "hair down, summer dress) holding the red polka-dot umbrella over all three of them for shade. Bright blue sky, "
    "sea, sand, everyone laughing. " + STYLE, transparent=False, refs=["pim_turn", "mom_turn"], phase=3, prio=2)
job("cg_queen", f"Emotional climax illustration, landscape. {QUEEN} She holds the small girl Pim tightly in her arms "
    f"and they cry together. {PIM} Pim's red umbrella lies closed on the cloud floor. The rain has turned soft and "
    "warm, golden light beginning to break through the clouds behind them. Tender, cathartic. " + STYLE,
    transparent=False, refs=["pim_turn", "mom_turn"], phase=3, prio=3)
job("cg_hallway", f"Emotional illustration, landscape. Early morning in an upstairs hallway of a house: {MOM} sits on "
    f"the floor with her back against her bedroom door, hugging {PIM} tightly; both are crying, but it's a relieved, "
    "healing cry. Pim's closed red umbrella lies on the floor. Soft pale morning light through a window. " + STYLE,
    transparent=False, refs=["pim_turn", "mom_turn"], phase=3, prio=4)
job("cg_rainbow", f"Happy ending illustration, landscape. A sunny afternoon in a small front garden with a light "
    f"sun-shower and a big rainbow. {MOM} kneels planting tulips and smiles; {PIM} stands in the gentle rain without "
    "an umbrella, face up, smiling; her closed red umbrella leans against the fence; an orange tabby cat and a golden "
    "puppy play nearby; a kind old neighbour lady waves over the fence. Warm, hopeful. " + STYLE,
    transparent=False, refs=["pim_turn", "mom_turn"], phase=3, prio=4)
job("cg_gameover", f"Small illustration: {PIM} curled up on the ground under her open red polka-dot umbrella in the "
    "rain, hugging her knees, eyes closed, resting. Centred, lots of empty space around. Background: plain flat pure "
    "white everywhere, no pattern, no texture, no ground. " + STYLE,
    aspect="square", transparent=False, refs=["pim_turn"], phase=3, prio=8)
