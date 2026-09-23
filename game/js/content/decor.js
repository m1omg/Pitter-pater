'use strict';
// ---------------------------------------------------------------------------
// Little ground doodles per map (painted once into each map's ground canvas).
// ---------------------------------------------------------------------------
const DECOR = {
  fort: [['star', 'crayon', 'heart', 'star'], 70],
  crumb_1: [['sprinkle', 'crumb', 'sprinkle'], 130],
  crumb_town: [['sprinkle', 'crumb', 'flower'], 120],
  crumb_river: [['sprinkle', 'crumb'], 90],
  crumb_peak: [['crumb', 'crumb', 'pebble'], 80],
  carpet_1: [['lint', 'pebble', 'crayon', 'lint'], 110],
  carpet_village: [['lint', 'crumb', 'lint'], 80],
  keep_1: [['drop', 'star', 'drop'], 60],
  keep_2: [['drop', 'heart'], 50],
  keep_3: [['drop'], 36],
  yard: [['flower', 'grass', 'grass', 'pebble'], 150],
  yard_after: [['flower', 'flower', 'grass', 'pebble'], 190],
  attic_1: [['pebble', 'lint'], 40], attic_2: [['pebble', 'lint'], 30], attic_3: [['pebble', 'lint'], 50],
  pim_room: [['crayon', 'star'], 6],
};
for (const id in DECOR) {
  if (!MAPS[id]) continue;
  const [kinds, n] = DECOR[id];
  const prev = MAPS[id].paint;
  MAPS[id].paint = (g, m) => { if (prev) prev(g, m); Materials.scatter(g, m, kinds, n, 3); };
}
