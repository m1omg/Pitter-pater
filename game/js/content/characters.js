'use strict';
// ---------------------------------------------------------------------------
// Speakers: name tag colour, text-blip voice, portraits and overworld sprites.
// ---------------------------------------------------------------------------
function faceSet(id, list) {
  const o = {};
  for (const f of list) o[f] = `face_${id}_${f}`;
  return o;
}

const CHARACTERS = {
  pim: {
    name: 'PIM', color: '#ffb8c6', voice: 'sfx_blip_pim', pitch: 1,
    sprite: 'chr_pim', realSprite: 'chr_pim',
    faces: faceSet('pim', ['neutral', 'cheery', 'forced', 'huffy', 'hurt', 'surprised', 'cry', 'down']),
  },
  biscuit: {
    name: 'BISCUIT', color: '#ffc38a', voice: 'sfx_blip_biscuit', pitch: 1,
    sprite: 'chr_biscuit', realSprite: 'chr_biscuit_real',
    faces: faceSet('biscuit', ['neutral', 'cheery', 'gloomy', 'huffy', 'hurt', 'down']),
  },
  waffles: {
    name: 'WAFFLES', color: '#ffe08a', voice: 'sfx_blip_waffles', pitch: 1,
    sprite: 'chr_waffles', realSprite: 'chr_waffles_real',
    faces: faceSet('waffles', ['neutral', 'cheery', 'gloomy', 'huffy', 'hurt', 'down']),
  },
  momo: {
    name: 'MOMO', color: '#c9dcff', voice: 'sfx_blip_momo', pitch: 1,
    sprite: 'chr_momo',
    faces: faceSet('momo', ['neutral', 'cheery', 'gloomy', 'huffy', 'hurt', 'down']),
  },
  mom: {
    name: 'MOM', color: '#d8c8f0', voice: 'sfx_blip_mom', pitch: 1,
    sprite: 'chr_mom',
    faces: faceSet('mom', ['neutral', 'sad', 'smile', 'cry', 'warm', 'surprised']),
  },
  queen: {
    name: 'THE RAIN QUEEN', color: '#b9c4e8', voice: 'sfx_blip_mom', pitch: 0.8,
    faces: faceSet('queen', ['neutral', 'sad', 'soft']),
  },
  dad: { name: 'DAD', color: '#b8d4c0', voice: 'sfx_blip_low', pitch: 1.1, faces: faceSet('dad', ['neutral']) },
  phone: { name: 'DAD (phone)', color: '#b8d4c0', voice: 'sfx_blip_low', pitch: 1.15 },
  okafor: { name: 'MRS. OKAFOR', color: '#f3c7a0', voice: 'sfx_blip_mom', pitch: 1.12, sprite: 'npc_okafor' },
  // dream folk
  sun: { name: 'THE SLEEPY SUN', color: '#ffe38a', voice: 'sfx_blip_low', pitch: 1.3, sprite: 'npc_sun' },
  teapot: { name: 'MADAME TEAPOT', color: '#f7c6d9', voice: 'sfx_blip_mom', pitch: 1.25, sprite: 'npc_teapot' },
  salt: { name: 'SALT', color: '#f4f4f4', voice: 'sfx_blip_high', pitch: 1.1, sprite: 'npc_salt' },
  pepper: { name: 'PEPPER', color: '#c9b9a8', voice: 'sfx_blip_high', pitch: 0.9, sprite: 'npc_pepper' },
  ladle: { name: 'SERGEANT LADLE', color: '#cfd8e2', voice: 'sfx_blip_low', pitch: 1.2, sprite: 'npc_ladle' },
  egg: { name: 'EGG', color: '#fff3d0', voice: 'sfx_blip_high', pitch: 0.95, sprite: 'npc_egg' },
  muffin: { name: 'MUFFIN', color: '#f0c8a0', voice: 'sfx_blip_high', pitch: 1.2, sprite: 'npc_muffin' },
  gumball: { name: 'GUMBALL', color: '#ffb3c6', voice: 'sfx_blip_high', pitch: 1.3, sprite: 'npc_gumball' },
  sprinkle: { name: 'SPRINKLE KID', color: '#ffd1f0', voice: 'sfx_blip_high', pitch: 1.4, sprite: 'npc_sprinkle' },
  elder: { name: 'ELDER FLUFF', color: '#d9d4d0', voice: 'sfx_blip_low', pitch: 1.4, sprite: 'npc_elder' },
  bunny: { name: 'DUST BUNNY', color: '#e0dbd6', voice: 'sfx_blip_high', pitch: 1.3, sprite: 'npc_bunny' },
  hermit: { name: 'LINT HERMIT', color: '#c7d0c0', voice: 'sfx_blip_low', pitch: 1.1, sprite: 'npc_hermit' },
  lamp: { name: 'OLD LAMP', color: '#ffe9b0', voice: 'sfx_blip_mom', pitch: 0.9, sprite: 'npc_lamp' },
  sockpuppet: { name: 'SOCK PUPPET', color: '#c9e0f5', voice: 'sfx_blip_high', pitch: 1.0, sprite: 'npc_sockpuppet' },
  coat: { name: '???', color: '#8a8290', voice: 'sfx_blip_low', pitch: 0.7, sprite: 'npc_coat' },
  voice: { name: '???', color: '#cfc6d6', voice: 'sfx_blip_low', pitch: 0.85 },
};
window.CHARACTERS = CHARACTERS;
