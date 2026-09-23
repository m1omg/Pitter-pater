'use strict';
// ---------------------------------------------------------------------------
// Image loading. IMG_MANIFEST (img/manifest.js) maps ids to files + metadata:
//   { id: {file:'chars/pim.png', w, h, cols, rows, ...} }
// Missing images resolve to null and callers draw placeholders instead.
// ---------------------------------------------------------------------------
const Assets = {
  images: {},
  failed: {},
  pending: {},

  meta(id) { return (window.IMG_MANIFEST && IMG_MANIFEST[id]) || null; },

  load(id) {
    if (this.images[id]) return Promise.resolve(this.images[id]);
    if (this.failed[id]) return Promise.resolve(null);
    if (this.pending[id]) return this.pending[id];
    const m = this.meta(id);
    if (!m) { this.failed[id] = true; return Promise.resolve(null); }
    this.pending[id] = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { this.images[id] = img; delete this.pending[id]; resolve(img); };
      img.onerror = () => { this.failed[id] = true; delete this.pending[id]; resolve(null); };
      img.src = 'img/' + m.file;
    });
    return this.pending[id];
  },

  loadMany(ids) { return Promise.all(ids.filter(Boolean).map((id) => this.load(id))); },

  // synchronous getter; kicks off loading if needed
  get(id) {
    if (!id) return null;
    const img = this.images[id];
    if (img) return img;
    if (!this.failed[id] && !this.pending[id]) this.load(id);
    return null;
  },

  // Load everything listed with preload:true (UI bits, party portraits…)
  preloadCore() {
    if (!window.IMG_MANIFEST) return Promise.resolve();
    const ids = Object.keys(IMG_MANIFEST).filter((k) => IMG_MANIFEST[k].preload);
    return this.loadMany(ids);
  },
};
window.Assets = Assets;
if (!window.IMG_MANIFEST) window.IMG_MANIFEST = {};
