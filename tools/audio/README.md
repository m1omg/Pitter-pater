# PITTER-PATTER audio toolchain

Everything you hear in the game (17 BGM tracks, 4 jingles, 5 ambience loops, 67 SFX) is
synthesised offline by the code in this folder. It needs only **Node.js 20** and **ffmpeg built with
libvorbis**. There are no npm packages: oscillators, envelopes, filters, Karplus-Strong, FM, modal
synthesis, noise, convolution reverb, dynamics, loudness metering and the WAV writer are all written
here. Rendering is deterministic, because every random choice uses a seeded RNG. Rebuilding gives the
same files.

## Rebuild

```sh
node tools/audio/build.js                       # everything (~1 min with 8 jobs)
node tools/audio/build.js bgm_title             # one item (or several ids)
node tools/audio/build.js --type=sfx            # all items of a type: bgm | jingle | amb | sfx
node tools/audio/build.js --jobs=4 --clean-wav  # fewer parallel renders, delete WAVs afterwards
node tools/audio/verify.js                      # check everything that is packaged in game/audio
node tools/audio/verify.js bgm_title --spectro=bgm_title   # plus a spectrogram PNG in out/spectro/
```

`build.js` runs three steps:

1. **Render.** It runs `node render_item.js <id>` in parallel. Each run writes `out/<id>.wav` (32-bit
   float) and `out/<id>.json`, which holds the loop points, loudness, true peak, seam error and
   per-part loudness.
2. **Encode.** ffmpeg/libvorbis makes `out/<id>.ogg`: `-q:a 4` for BGM, `-q:a 3` for everything
   else, 44.1 kHz. Loops also get `LOOPSTART`/`LOOPLENGTH` comments. Files under 3 s use 20 ms Ogg
   pages so that the decoded length is sample-exact.
3. **Package.** It writes `game/audio/<id>.js`, `game/audio/sfx_pack.js` and
   `game/audio/manifest.js`. The SFX pack and the manifest are merged with what is already there,
   so rebuilding a single id is safe.

## Output format (consumed by the engine)

```js
// game/audio/<id>.js  (BGM, jingles, ambience)
AUDIO_DB.add("bgm_title", {data:"<base64 ogg>", loopStart:14.285714, loopEnd:82.857143, loop:true});
// game/audio/sfx_pack.js  (one line per effect)
AUDIO_DB.add("sfx_cursor", {data:"<base64 ogg>", loop:false});
// game/audio/manifest.js
var AUDIO_MANIFEST = { "bgm_title": {file:"bgm_title.js", type:"bgm", loop:true, loopStart:14.285714, loopEnd:82.857143, duration:82.857143}, ... };
```

**Loop points.** Set `source.loop = true`, `source.loopStart = loopStart` and
`source.loopEnd = loopEnd`. `loopEnd` is always the file's duration. Tracks without an intro have
`loopStart = 0`. Tracks with an intro have `loopStart > 0`, and those tracks only loop correctly
if the engine applies both values.

## How gapless loops are built (`lib/song.js`)

Music is written in beats on a timeline: `[intro][loop pass 1][first D bars of loop pass 2]`.

- Every loop event is scheduled in pass 1. Events that start within D are scheduled again in
  pass 2, so pass 2 carries the release and reverb tails of pass 1.
- Every effect runs linearly over the whole timeline. LFO rates are quantised to whole cycles per
  loop. Noise beds are generated as exactly periodic buffers: cyclic noise, IIR filters run twice
  around the buffer, and modulators have integer cycles per loop.
- The result is that pass 2 equals the steady state.

How the file is cut:

- **No intro:** the file is `pass2[0,D) + pass1[D,L)`, with loopStart 0 and loopEnd L. This is the
  "tail folded onto the start" loop.
- **Intro:** the file is `intro + pass1 + pass2[0,D)`, with loopStart I+D and loopEnd I+L+D. Both
  are bar lines. The first pass is natural (the intro's tails ring into it), and every repeat
  contains the loop's own tails.

The renderer checks that pass 1 and pass 2 are identical around the joint (`seamErrDb`; every
track is below −125 dB). `verify.js` then decodes the packaged Ogg files and checks the joint
again. It measures the high-frequency energy at the seam against the original WAV and against
300 random windows of the same file, which is a click detector.

## Loudness

Loudness is measured with ITU-R BS.1770-4 (`lib/loudness.js`), which agrees with ffmpeg `ebur128`
to 0.1 LU. It also computes a 4× oversampled true peak.

- Each song is gain-normalised on its loop region, with 2–3 iterations through a
  look-ahead limiter set to −2.3 dBFS sample peak.
- Targets: BGM −18 LUFS (Static Woods and Attic −18.8), ambience −26, jingles −16.
- SFX are peak-normalised per effect: UI and blips around −11 to −14 dBFS, big hits around
  −3 dBFS. They were balanced by short-term loudness.

## Layout

| path | contents |
|---|---|
| `lib/core.js` | RNG, WAV writer, biquad/SVF/one-pole filters, polyBLEP oscillators, damped-resonator bank, envelopes, FFT, FFT convolution |
| `lib/fx.js` | synthetic-IR convolution reverb, chorus, wow/flutter, auto-pan, ping-pong delay, compressor, look-ahead limiter, saturation, periodic-bed helpers, vinyl crackle |
| `lib/loudness.js` | BS.1770 integrated and momentary loudness, true peak |
| `lib/inst.js` | felt piano (additive, inharmonic, 2-string beating, hammer and damper noise); FM Rhodes; modal music box, celesta, glockenspiel, toy piano, xylophone, marimba, vibes, chimes, bell, kalimba; Karplus-Strong ukulele, nylon, guitar, harp, pizzicato, upright; string ensemble; pad; formant choir; drawbar organ; sine and synth bass; brass; flute, whistle and chip lead (legato phrase engine); accordion; synth pluck; water drop |
| `lib/drums.js` | kick, snare, brushes (tap and sweep), hats, shaker, wood block/rim, toms, clap, cymbals, reverse swell, timpani, heartbeat, triangle, gong |
| `lib/theory.js` | note and chord parsing, voicings, voice-leading, modal (scale-degree) mapping, melody string parser with bar-length checks, drum grids, swing |
| `lib/comp.js` | the two leitmotifs and the accompaniment generators (arpeggios, pads, walking bass, rain plinks) |
| `lib/song.js` | Song/Part/Bus model, renderer, loop construction, master chain, normalisation |
| `lib_amb/ambkit.js` | helpers for the ambience loops |
| `tracks/*.js` | one module per BGM and ambience item; `jingles.js` exports the four jingles |
| `sfx/*.js` | SFX grouped as `ui.js`, `blips.js`, `world.js`, `battle.js` (helpers in `_kit.js`) |
| `tools/ltas.js` | octave-band long-term spectrum of a WAV (mix-balance check) |
| `tools/clashcheck.js` | lists sustained minor-2nd/9th collisions between parts (harmony sanity check) |
| `out/` | intermediates: WAV, Ogg, JSON metadata, spectrograms. Safe to delete. |

## Motifs

Both motifs live in `lib/comp.js`.

- **Pim's theme** (F major, 4/4) is exactly the 8 bars from the brief, with a 3/4 waltz version and
  modal mapping to minor keys. It appears in:
  - title (music box)
  - home (fragments)
  - fort (glockenspiel, then Rhodes)
  - crumb (the "pit-ter pat-ter" cell in C)
  - carpet (the rising bar-3 figure in G)
  - static (slowed and detuned in D minor)
  - keep (strings, waltz)
  - battle (chip quote in E minor)
  - boss (brass quote in C minor)
  - final (D minor)
  - final2 (D major, then F major)
  - sad (D minor)
  - ending
  - shop (toy-piano winks)
  - town (glockenspiel, waltz in B♭)
  - the victory jingle
  - `sfx_music_box`
- **Rain Queen** (D minor) is a chain of descending "sighs": F–E, D–C, B♭–A–G, then an aching
  augmented second B♭–C♯ that resolves to D. It appears in:
  - keep (solo piano)
  - final (violins, and cellos augmented)
  - sad (cello countermelody)
  - the attic (a detuned toy-piano ghost)
  - ending (inverted into rising sighs: Mom healing)

## Adding things

- **New track:** create `tracks/<id>.js` exporting `{ id, type: 'bgm'|'amb'|'jingle', build() }`,
  where `build()` returns a `Song`. Copy an existing track as a template.
- **New SFX:** add `sfx_<name>: { fn: () => Float32Array | {L,R}, peak: -6 }` to any `sfx/*.js`
  file.
- Files starting with `_` are helpers and the registry skips them. A file that fails to load is
  skipped with a warning, so it cannot block other builds.
