# PITTER-PATTER

*a little story about rain*

A short story-driven JRPG in the style of RPG Maker games like OMORI, UNDERTALE, END ROLL, Ib and Re:Kinder,
with its own story, characters, systems, art and music.

Pim is ten. Since her dad moved out, her mom hasn't been able to get out of bed, so Pim makes the toast,
feeds the pets, answers the phone, and tells everyone that everything is *fine*. Every night she dreams of
**Puddleton**, her house grown into a rainy kingdom. There her cat Biscuit and her dog Waffles can talk, a
little cloud-sheep called Momo joins them, and the Sun has fallen asleep. Pim is sure that if she can wake
it up, the rain will stop.

## How to play

**Play in your browser: https://m1omg.github.io/Pitter-pater/**

Or download this repository and use any of these (no install needed):

* Double-click **`PITTER-PATTER.desktop`**. The first time, your file manager may ask you to trust it: choose *Launch anyway* or *Mark as trusted*.
* Double-click **`game/index.html`**, or drag it into a browser window (Chrome, Vivaldi, Edge or Firefox).
* In a terminal: `./play.sh`, or `sh play.sh` from anywhere.
* If your browser refuses to run local files: `./play.sh --server`. It serves the game on `http://127.0.0.1` and opens it; press Ctrl+C to stop.

| Key | Action |
|---|---|
| Arrow keys / WASD | walk, move cursors |
| Z / Enter / Space | talk, examine, confirm |
| X / Esc | cancel, open the menu |
| Shift (hold) | run |
| F4 | fullscreen |

Gamepads work too (A = confirm, B = cancel).

**Touch screens (phones and tablets):**

| Gesture | Action |
|---|---|
| Tap a menu option | choose it; in battle, tap an enemy or a friend's card to target them |
| Swipe | walk one step, or move a menu cursor |
| Swipe and hold | keep walking (hold further out to run) |
| One-finger tap | talk, examine, continue text (like Z) |
| Two-finger tap | back, open the menu (like X) |

In lists that describe the highlighted entry (skills, items, stickers, the shop) and when saving, the first tap
highlights an entry and a second tap chooses it. OPTIONS → *Touch joystick* shows a thumb-stick under your finger
while you swipe. Landscape works best on phones.

It takes about 1–2 hours. Save at the glowing lights in the dream and at Pim's bed at home.
You get three save files. They stay in the browser you played in: the website and a downloaded copy each keep their
own. To move them to another browser or device, use OPTIONS → *Export saves*, then *Import saves* on the other one
(as a code to paste, or as a file).

## Battles

Turn-based, with a party of up to four. Feelings work like weather:

* **CHEERY** ☀ faster and luckier, but careless · **GLOOMY** ☂ sturdier and slower, regains PEP · **HUFFY** ⚡ hits hard, guards badly
* Mix two and you get a new one: **RAINBOW** (heals every turn), **STORMY** (tough but sulky), **HEATWAVE** (fierce but burning out)
* Mix all three and the target is **OVERWHELMED**: it loses a turn and takes extra damage.
* Acting together fills the **TOGETHER** meter. When it's full, use a team move.
* **Trinkets** are battle toys, used from ITEMS on someone's turn: bubble wands, water balloons and whoopee cushions
  make anyone CHEERY, GLOOMY or HUFFY (on foes or friends), others deal damage, put a foe to sleep or calm someone down.
* Pim can't be GLOOMY. When something tries to make her sad, she *smiles it away*.

Enemies don't die, they *calm down*.

## Credits

* Story, design, code and music: Claude (Anthropic).
* Illustrations: generated with GPT Image through the Codex CLI.
* Fonts: Patrick Hand by Patrick Wagesreiter and Sniglet by Haley Fiege, both SIL Open Font License (see `game/fonts/`).
* Inspired by OMORI, UNDERTALE, END ROLL, Ib and Re:Kinder. No assets, music or text from those games are used.

The game is released under the GPL-3.0 licence (see `LICENSE`). The bundled fonts keep their own SIL Open Font Licence (`game/fonts/OFL_*.txt`).

## For developers

* `game/js/core`: engine (loop, input, audio, drawing).
* `game/js/game`: systems (maps, events, battles, menus).
* `game/js/content`: story, maps, dialogue, balance.
* `tools/art`: image generation jobs (`jobs.py`), the Codex relay (`gen.py`) and slicing/manifest (`process.py`).
  To regenerate one picture: delete `art_raw/<name>.png`, run `python3 tools/art/gen.py --only <name>`, then
  `python3 tools/art/process.py <name>`. The raw sheets live in `art_raw/`, and the game uses the processed files in `game/img/`.
  Hand-edited variants of generated pictures (such as the folded family photo) are listed in `DERIVED` in `process.py`
  and rebuilt along with their source; `process.py --derive` rebuilds only those.
* `tools/audio`: the synthesizer and compositions for all music and sound effects.
* `tools/test`: headless Chrome test driver (`node run.js steps.json`, touch: `run_touch.js`). `node savecompat.js` checks that
  saves from the first release still load, and `node transfer.js` checks Export/Import saves.
* Debug: `index.html?map=crumb_1&x=5&y=10&ch=1&lv=5` jumps straight to a map. F2 shows collision, F3 shows FPS.

AI model used - Claude Opus 5.5 Max at effort in CLI Claude Code on Linux.
