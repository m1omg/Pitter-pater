'use strict';
// ---------------------------------------------------------------------------
// Debug-only map: every prop at its configured size, for art tuning.
// Open with index.html?map=gallery&x=2&y=2  (page through with &page=N)
// ---------------------------------------------------------------------------
(function () {
  const q = new URLSearchParams(location.search);
  const page = +(q.get('page') || 0);
  const ids = Object.keys(PROPS).filter((k) => PROPS[k].img);
  const per = 24;
  const list = ids.slice(page * per, page * per + per);
  const cols = 6;
  const props = [];
  const events = [];
  list.forEach((id, i) => {
    const cx = 2 + (i % cols) * 6, cy = 4 + Math.floor(i / cols) * 5;
    props.push({ id, x: cx, y: cy, solid: false });
    events.push({ id: 'lbl' + i, x: cx, y: cy + 2, solid: false, trigger: 'none', draw2(ctx) { Gfx.text(ctx, id, 0, 0, { size: 14, align: 'center', color: '#3a2a30', outline: '#fff', outlineWidth: 3 }); } });
  });
  // a Pim for scale next to the first item of every row
  for (let r = 0; r < 4; r++) events.push({ id: 'pimref' + r, x: 1, y: 5 + r * 5, sprite: 'chr_pim', trigger: 'none', solid: false });
  MAPS.gallery = {
    name: 'Gallery', noMenu: true, vignette: 0,
    tiles: buildTiles(38, 24, '.', []),
    legend: { '.': { mat: 'blanket' } },
    props, events,
  };
})();
