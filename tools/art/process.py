#!/usr/bin/env python3
"""Turn raw generated images (art_raw/*.png) into game-ready assets (game/img/...)
and write game/img/manifest.js.

python3 tools/art/process.py [name ...]      (no names = process everything available)
A contact sheet of every sliced sheet is written to tools/art/preview/ for checking.
"""
import collections, json, os, sys
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
RAW = os.path.join(ROOT, 'art_raw')
IMG = os.path.join(ROOT, 'game', 'img')
PREVIEW = os.path.join(HERE, 'preview')
MANIFEST_EXTRA = os.path.join(HERE, 'manifest_extra.json')

# ---------------------------------------------------------------------------
# What each raw image becomes. kind:
#   strip: turnaround rows -> one dirs3 strip per row (ids per row)
#   cells: grid of separate items -> one file per cell (ids in reading order, None = skip)
#   single: whole image, trimmed
#   opaque: backgrounds / CGs (resized jpg)
# h = stored height in px (roughly 2x the on-screen size)
# ---------------------------------------------------------------------------
FACES8 = ['neutral', 'cheery', 'forced', 'huffy', 'hurt', 'surprised', 'cry', 'down']
FACES6 = ['neutral', 'cheery', 'gloomy', 'huffy', 'hurt', 'down']
SPEC = {
    'pim_turn': dict(kind='strip', grid=(3, 1), ids=['chr_pim'], h=200),
    'party_turn': dict(kind='strip', grid=(3, 3), ids=['chr_biscuit', 'chr_waffles', 'chr_momo'], h=200),
    'mom_turn': dict(kind='strip', grid=(3, 1), ids=['chr_mom'], h=240),
    'pets_real': dict(kind='strip', grid=(3, 2), ids=['chr_biscuit_real', 'chr_waffles_real'], h=130),
    'face_pim': dict(kind='cells', grid=(4, 2), slice='grid', ids=['face_pim_' + f for f in FACES8], face=True),
    'face_biscuit': dict(kind='cells', grid=(3, 2), slice='grid', ids=['face_biscuit_' + f for f in FACES6], face=True),
    'face_waffles': dict(kind='cells', grid=(3, 2), slice='grid', ids=['face_waffles_' + f for f in FACES6], face=True),
    'face_momo': dict(kind='cells', grid=(3, 2), slice='grid', ids=['face_momo_' + f for f in FACES6], face=True),
    'face_mom': dict(kind='cells', grid=(3, 2), slice='grid', ids=['face_mom_' + f for f in ['neutral', 'sad', 'smile', 'cry', 'warm', 'surprised']], face=True),
    'face_misc': dict(kind='cells', grid=(2, 2), slice='grid', ids=['face_queen_neutral', 'face_queen_sad', 'face_queen_soft', 'face_dad_neutral'], face=True),
    'en_sheet1': dict(kind='cells', grid=(3, 2), ids=['en_drizzlet', 'en_toast', 'en_lemon', 'en_sugarmite', 'en_forkling', 'en_dustbunny'], h=420),
    'en_sheet2': dict(kind='cells', grid=(3, 2), ids=['en_sock', 'en_lintmoth', 'en_coin', 'en_staticghost', 'en_remote', 'en_rainwisp'], h=420),
    'en_sheet3': dict(kind='cells', grid=(2, 2), ids=['en_thunderhead', 'en_umbrellabat', 'en_tissue', 'en_laundry'], h=460),
    'en_grumbles': dict(kind='single', ids=['en_grumbles'], h=760, alias={'p_toaster_big': 'en_grumbles'}),
    'en_thestatic': dict(kind='single', ids=['en_thestatic'], h=820, alias={'p_tv_giant': 'en_thestatic'}),
    'en_rainqueen': dict(kind='single', ids=['en_rainqueen'], h=1100),
    'en_coat': dict(kind='single', ids=['en_coat'], h=900, alias={'npc_coat': 'en_coat'}),
    'npc_sheet1': dict(kind='cells', grid=(3, 3), ids=['npc_teapot', 'npc_salt', 'npc_pepper', 'npc_ladle', 'npc_egg', 'npc_muffin', 'npc_gumball', 'npc_sprinkle', 'npc_ant'], h=220),
    'npc_sheet2': dict(kind='cells', grid=(3, 3), ids=['npc_elder', 'npc_bunny', 'npc_hermit', 'npc_lamp', 'npc_sockpuppet', 'npc_remoteking', 'p_plush_bear', 'npc_okafor', 'p_momo_plush'], h=240),
    'npc_sun': dict(kind='single', ids=['npc_sun'], h=420),
    'props_home1': dict(kind='cells', grid=(3, 3), ids=['p_bed_pim', 'p_desk', 'p_chair', 'p_bookshelf', 'p_toybox', 'p_dresser', 'p_window', 'p_drawings', 'p_rug_round'], h=300),
    'props_home2': dict(kind='cells', grid=(3, 3), ids=['p_door', 'p_door_mom', 'p_stairs', 'p_stairs_up', 'p_photo_frames', 'p_side_plant', 'p_attic_ladder', 'p_fridge', 'p_counter'], h=300),
    'props_home3': dict(kind='cells', grid=(3, 3), ids=['p_stove', 'p_washer', 'p_kitchen_table', 'p_couch', 'p_tv', 'p_coffee_table', 'p_floor_lamp', 'p_phone_table', 'p_pet_bowls'], h=300),
    'props_home4': dict(kind='cells', grid=(3, 3), ids=['p_plant', 'p_front_door', 'p_fence', 'p_mailbox', 'p_flowerbed', 'p_tree', 'p_bush', 'p_rug_long', 'p_trunk'], h=360),
    'props_home5': dict(kind='cells', grid=(3, 3), ids=['p_box', 'p_box_stack', 'p_sheet_furniture', 'p_mirror', 'p_rocking_horse', 'p_dad_box', 'p_mom_bed', 'p_nightstand', 'p_curtains'], h=300),
    'props_misc': dict(kind='cells', grid=(3, 3), ids=['p_laundry_pile', 'p_coat_rack', 'p_photo_big', 'p_music_box', 'p_lantern', 'p_umbrella_stand', 'p_tissue_box', 'p_photo_stand', 'p_rain_window'], h=300),
    'house_front': dict(kind='single', ids=['p_house_front'], h=620),
    'props_fort': dict(kind='cells', grid=(3, 3), ids=['p_blanket_tent', 'p_pillow_pile', 'p_pillow', 'p_toy_blocks', 'p_moon_light', 'p_cardboard_castle', 'p_book_stack', 'p_laundry_block', 'p_raindrop_door'], h=340),
    'props_crumb1': dict(kind='cells', grid=(3, 3), ids=['p_salt', 'p_pepper', 'p_cereal_box', 'p_sugar_cube', 'p_teacup_house', 'p_teacup_house2', 'p_teapot_house', 'p_sugar_bowl', 'p_bread'], h=400),
    'props_crumb2': dict(kind='cells', grid=(3, 3), ids=['p_butter', 'p_milk_carton', 'p_jam_jar', 'p_fork_fence', 'p_candle_light', 'p_cushion_hill', 'p_lamp_tree', 'p_books_tower', 'p_crayon'], h=440),
    'props_carpet': dict(kind='cells', grid=(3, 3), ids=['p_lint_tree', 'p_dust_hut', 'p_coin_big', 'p_antenna_tree', 'p_tv_small', 'p_plant_pot', 'p_remote_tower', None, 'p_marble'], h=380),
    'props_keep': dict(kind='cells', grid=(3, 3), ids=['p_cloud_pillar', 'p_cloud_bush', None, None, 'p_queen_throne', None, None, None, None], h=480),
    'bg_fort': dict(kind='opaque', ids=['bg_fort']), 'bg_crumb': dict(kind='opaque', ids=['bg_crumb'], alias={'bg_toaster': 'bg_crumb'}),
    'bg_carpet': dict(kind='opaque', ids=['bg_carpet']), 'bg_static': dict(kind='opaque', ids=['bg_static']),
    'bg_keep': dict(kind='opaque', ids=['bg_keep'], alias={'bg_queen': 'bg_keep'}), 'bg_attic': dict(kind='opaque', ids=['bg_attic']),
    'cg_title': dict(kind='opaque', ids=['cg_title']), 'cg_dad': dict(kind='opaque', ids=['cg_dad']), 'cg_beach': dict(kind='opaque', ids=['cg_beach']),
    'cg_queen': dict(kind='opaque', ids=['cg_queen']), 'cg_hallway': dict(kind='opaque', ids=['cg_hallway']),
    'cg_rainbow': dict(kind='opaque', ids=['cg_rainbow'], alias={'cg_ending': 'cg_rainbow'}),
    'cg_gameover': dict(kind='single', ids=['cg_gameover'], h=600),
}
FOLDER = lambda i: ('chars' if i.startswith('chr_') else 'faces' if i.startswith('face_') else 'enemies' if i.startswith('en_')
                    else 'npcs' if i.startswith('npc_') else 'props' if i.startswith('p_') else 'bg' if i.startswith('bg_') else 'cg')


# ---------------------------------------------------------------------------
def load_rgba(path):
    im = Image.open(path).convert('RGBA')
    return im


def has_real_alpha(im):
    a = np.asarray(im)[:, :, 3]
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    return (border < 16).mean() > 0.6


def flood_background(im, thr=38):
    """Make the background transparent: flood fill from the border over pixels close to
    the dominant border colour(s). Handles plain backgrounds and fake checkerboards."""
    arr = np.asarray(im).astype(np.int32)
    h, w = arr.shape[:2]
    rgb = arr[:, :, :3]
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    # dominant border colours (a painted checkerboard has two)
    keys = (border // 12)
    uniq, counts = np.unique(keys, axis=0, return_counts=True)
    order = np.argsort(-counts)
    bgs = [np.median(border[(keys == uniq[order[0]]).all(axis=1)], axis=0)]
    if len(order) > 1 and counts[order[1]] > 0.2 * len(border):
        bgs.append(np.median(border[(keys == uniq[order[1]]).all(axis=1)], axis=0))
    dist = np.min([np.sqrt(((rgb - b) ** 2).sum(axis=2)) for b in bgs], axis=0)
    cand = dist < thr
    seen = np.zeros((h, w), bool)
    dq = collections.deque()
    for x in range(w):
        for y in (0, h - 1):
            if cand[y, x] and not seen[y, x]:
                seen[y, x] = True; dq.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if cand[y, x] and not seen[y, x]:
                seen[y, x] = True; dq.append((y, x))
    while dq:
        y, x = dq.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and cand[ny, nx]:
                seen[ny, nx] = True; dq.append((ny, nx))
    alpha = np.where(seen, 0, 255).astype(np.uint8)
    # soften the edge a little: only pixels in a thin band next to the removed background
    band = seen.copy()
    for _ in range(2):
        b = band.copy()
        b[1:] |= band[:-1]; b[:-1] |= band[1:]; b[:, 1:] |= band[:, :-1]; b[:, :-1] |= band[:, 1:]
        band = b
    edge = band & (~seen) & (dist < thr * 1.6)
    alpha[edge] = np.clip((dist[edge] / (thr * 1.6)) * 255, 0, 255).astype(np.uint8)
    out = np.asarray(im).copy()
    out[:, :, 3] = np.minimum(out[:, :, 3], alpha)
    return Image.fromarray(out, 'RGBA')


def clean_alpha(im, core=200, band=2):
    """Remove soft glow/haze the generator sometimes adds around cut-outs:
    keep solid pixels (alpha > core) plus a thin anti-aliased edge band."""
    arr = np.asarray(im).copy()
    a = arr[:, :, 3]
    solid = a > core
    keep = solid.copy()
    for _ in range(band):
        k = keep.copy()
        k[1:] |= keep[:-1]; k[:-1] |= keep[1:]; k[:, 1:] |= keep[:, :-1]; k[:, :-1] |= keep[:, 1:]
        keep = k
    a2 = np.where(keep, a, 0)
    a2 = np.where(solid, 255, a2)          # make the body fully opaque
    arr[:, :, 3] = a2.astype(np.uint8)
    return Image.fromarray(arr, 'RGBA')


def components(alpha, scale=4, min_frac=0.0004):
    """Connected components of alpha>0 on a downscaled grid. Returns boxes in full-res coords."""
    h, w = alpha.shape
    sh, sw = h // scale, w // scale
    small = alpha[:sh * scale, :sw * scale].reshape(sh, scale, sw, scale).max(axis=(1, 3)) > 40
    lab = np.zeros((sh, sw), np.int32)
    boxes = []
    n = 0
    for y0 in range(sh):
        for x0 in range(sw):
            if small[y0, x0] and not lab[y0, x0]:
                n += 1
                lab[y0, x0] = n
                dq = collections.deque([(y0, x0)])
                minx = maxx = x0; miny = maxy = y0; cnt = 0
                while dq:
                    y, x = dq.popleft(); cnt += 1
                    minx = min(minx, x); maxx = max(maxx, x); miny = min(miny, y); maxy = max(maxy, y)
                    for ny in (y - 1, y, y + 1):
                        for nx in (x - 1, x, x + 1):
                            if 0 <= ny < sh and 0 <= nx < sw and small[ny, nx] and not lab[ny, nx]:
                                lab[ny, nx] = n; dq.append((ny, nx))
                boxes.append([minx * scale, miny * scale, (maxx + 1) * scale, (maxy + 1) * scale, cnt])
    total = sh * sw
    for i, b in enumerate(boxes):
        b.append(i + 1)          # label id (labels are 1-based in `lab`)
    components.last_labels = lab
    components.last_scale = scale
    return [b for b in boxes if b[4] / total >= min_frac]


def trim(im, pad=4):
    a = np.asarray(im)[:, :, 3]
    ys, xs = np.nonzero(a > 12)
    if not len(xs):
        return im
    x0, x1, y0, y1 = max(0, xs.min() - pad), min(im.width, xs.max() + pad + 1), max(0, ys.min() - pad), min(im.height, ys.max() + pad + 1)
    return im.crop((x0, y0, x1, y1))


def resize_h(im, h):
    if im.height <= h:
        return im
    w = max(1, round(im.width * h / im.height))
    return im.resize((w, h), Image.LANCZOS)


def grid_items(im, grid):
    """Split into equal cells (for dense sheets where neighbours touch)."""
    cols, rows = grid
    W, H = im.width, im.height
    out = []
    for r in range(rows):
        for c in range(cols):
            cell = im.crop((c * W // cols, r * H // rows, (c + 1) * W // cols, (r + 1) * H // rows))
            a = np.asarray(cell)[:, :, 3]
            out.append(trim(cell) if (a > 40).any() else None)
    return out


def cell_items(im, grid):
    """Split a transparent sheet into grid cells using connected components."""
    cols, rows = grid
    alpha = np.asarray(im)[:, :, 3]
    boxes = components(alpha)
    W, H = im.width, im.height
    cells = [[] for _ in range(cols * rows)]
    for b in boxes:
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        c = min(cols - 1, int(cx / (W / cols)))
        r = min(rows - 1, int(cy / (H / rows)))
        cells[r * cols + c].append(b)
    out = []
    for i, bs in enumerate(cells):
        if not bs:
            out.append(None)
            continue
        # keep the biggest component plus everything reasonably close/large in this cell
        big = max(bs, key=lambda b: b[4])
        keep = [b for b in bs if b[4] > big[4] * 0.03 or (abs((b[0] + b[2]) / 2 - (big[0] + big[2]) / 2) < W / cols * 0.45)]
        x0 = min(b[0] for b in keep); y0 = min(b[1] for b in keep); x1 = max(b[2] for b in keep); y1 = max(b[3] for b in keep)
        box = (max(0, x0 - 6), max(0, y0 - 6), min(W, x1 + 6), min(H, y1 + 6))
        crop = im.crop(box)
        # erase pixels that belong to other items that happen to fall inside this rectangle
        lab = components.last_labels; sc = components.last_scale
        ids = np.array([b[5] for b in keep])
        small = np.isin(lab, ids)
        # grow by one small cell so anti-aliased edges survive, then scale up to full resolution
        g = small.copy()
        g[1:] |= small[:-1]; g[:-1] |= small[1:]; g[:, 1:] |= small[:, :-1]; g[:, :-1] |= small[:, 1:]
        full = np.kron(g, np.ones((sc, sc), bool))
        pad_h, pad_w = H - full.shape[0], W - full.shape[1]
        if pad_h > 0 or pad_w > 0:
            full = np.pad(full, ((0, max(0, pad_h)), (0, max(0, pad_w))), mode='edge')
        m = full[box[1]:box[3], box[0]:box[2]]
        arr = np.asarray(crop).copy()
        arr[:, :, 3] = np.where(m[:arr.shape[0], :arr.shape[1]], arr[:, :, 3], 0)
        out.append(trim(Image.fromarray(arr, 'RGBA')))
    return out


def save(im, ident, fmt='png'):
    folder = os.path.join(IMG, FOLDER(ident))
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, ident + ('.jpg' if fmt == 'jpg' else '.png'))
    if fmt == 'jpg':
        im.convert('RGB').save(path, quality=88, optimize=True)
    else:
        im.save(path, optimize=True)
    return os.path.relpath(path, IMG)


def make_strip(frames, h):
    """dirs3 strip: equal cells, feet at the bottom, frames scaled consistently."""
    frames = [f for f in frames if f is not None]
    if len(frames) < 3:
        frames = frames + [frames[-1]] * (3 - len(frames))
    maxh = max(f.height for f in frames)
    s = h / maxh
    scaled = [f.resize((max(1, round(f.width * s)), max(1, round(f.height * s))), Image.LANCZOS) for f in frames]
    cw = max(f.width for f in scaled) + 8
    strip = Image.new('RGBA', (cw * 3, h + 4), (0, 0, 0, 0))
    for i, f in enumerate(scaled[:3]):
        strip.paste(f, (i * cw + (cw - f.width) // 2, h + 4 - f.height), f)
    return strip


def make_face(im, size=320):
    """Square portrait: fit the head+shoulders, bottom aligned."""
    w, h = im.size
    s = min(size / w, size / h) * 0.96
    f = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(f, ((size - f.width) // 2, size - f.height), f)
    return out


def contact(name, items):
    items = [(i, im) for i, im in items if im is not None]
    if not items:
        return
    th = 180
    tiles = []
    for ident, im in items:
        t = im.copy(); t.thumbnail((th, th))
        tile = Image.new('RGBA', (th + 10, th + 26), (200, 190, 200, 255))
        chk = Image.new('RGBA', (th, th), (235, 230, 240, 255))
        tile.paste(chk, (5, 5))
        tile.paste(t, (5 + (th - t.width) // 2, 5 + (th - t.height) // 2), t)
        ImageDraw.Draw(tile).text((6, th + 8), ident[:28], fill=(20, 20, 20, 255))
        tiles.append(tile)
    cols = min(5, len(tiles))
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * (th + 10), rows * (th + 26)), (160, 150, 165, 255))
    for k, t in enumerate(tiles):
        sheet.paste(t, ((k % cols) * (th + 10), (k // cols) * (th + 26)))
    os.makedirs(PREVIEW, exist_ok=True)
    sheet.save(os.path.join(PREVIEW, name + '.png'))


def process(name, manifest):
    spec = SPEC.get(name)
    src = os.path.join(RAW, name + '.png')
    if not spec or not os.path.exists(src):
        return False
    im = load_rgba(src)
    kind = spec['kind']
    if kind == 'opaque':
        im = im.convert('RGB')
        target_w = 1440
        if im.width > target_w:
            im = im.resize((target_w, round(im.height * target_w / im.width)), Image.LANCZOS)
        ident = spec['ids'][0]
        rel = save(im, ident, 'jpg')
        manifest[ident] = dict(file=rel)
        contact(name, [(ident, im.convert('RGBA'))])
    else:
        if not has_real_alpha(im):
            im = flood_background(im)
        else:
            im = clean_alpha(im)
        if kind == 'single':
            ident = spec['ids'][0]
            out = resize_h(trim(im), spec.get('h', 600))
            manifest[ident] = dict(file=save(out, ident))
            contact(name, [(ident, out)])
        elif kind == 'cells':
            items = grid_items(im, spec['grid']) if spec.get('slice') == 'grid' else cell_items(im, spec['grid'])
            report = []
            for ident, it in zip(spec['ids'], items):
                if ident is None:
                    continue
                if it is None:
                    print(f'  !! {name}: cell for {ident} is empty')
                    continue
                if spec.get('face') and it.height > it.width * 1.6:
                    # a full-body figure came back: keep only the head and shoulders
                    it = trim(it.crop((0, 0, it.width, int(it.height * 0.46))))
                out = make_face(it) if spec.get('face') else resize_h(it, spec.get('h', 300))
                manifest[ident] = dict(file=save(out, ident))
                report.append((ident, out))
            contact(name, report)
        elif kind == 'strip':
            cols, rows = spec['grid']
            items = cell_items(im, spec['grid'])
            report = []
            for r, ident in enumerate(spec['ids']):
                frames = items[r * cols:(r + 1) * cols]
                if not any(frames):
                    print(f'  !! {name}: row {r} empty')
                    continue
                # optional fixes after eyeballing the raw sheet
                for fi in spec.get('flip', {}).get(ident, []):
                    if frames[fi] is not None:
                        frames[fi] = frames[fi].transpose(Image.FLIP_LEFT_RIGHT)
                order = spec.get('order', {}).get(ident)
                if order:
                    frames = [frames[i] for i in order]
                strip = make_strip(frames, spec['h'])
                manifest[ident] = dict(file=save(strip, ident), layout='dirs3', dh=None)
                report.append((ident, strip))
            contact(name, report)
    for alias, target in spec.get('alias', {}).items():
        if target in manifest:
            manifest[alias] = dict(manifest[target])
    return True


def write_manifest(manifest):
    extra = {}
    if os.path.exists(MANIFEST_EXTRA):
        extra = json.load(open(MANIFEST_EXTRA))
    for k, v in extra.items():
        if k in manifest:
            manifest[k].update(v)
    # drop entries whose files vanished
    manifest = {k: v for k, v in manifest.items() if os.path.exists(os.path.join(IMG, v['file']))}
    for v in manifest.values():
        v.pop('dh', None) if v.get('dh') is None else None
    with open(os.path.join(IMG, 'manifest.js'), 'w') as f:
        f.write('// generated by tools/art/process.py\nvar IMG_MANIFEST = ' + json.dumps(manifest, indent=0, sort_keys=True) + ';\n')


def main():
    names = sys.argv[1:] or sorted(SPEC.keys())
    mpath = os.path.join(HERE, 'manifest_state.json')
    manifest = json.load(open(mpath)) if os.path.exists(mpath) else {}
    for n in names:
        if process(n, manifest):
            print('processed', n)
    json.dump(manifest, open(mpath, 'w'), indent=1, sort_keys=True)
    write_manifest(manifest)
    print(len(manifest), 'images in manifest')


if __name__ == '__main__':
    main()
