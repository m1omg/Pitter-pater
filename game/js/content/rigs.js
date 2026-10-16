'use strict';
// ---------------------------------------------------------------------------
// Walk rigs (see Sprites.drawRigged): where the legs are in each drawing, so the
// overworld walk can take real steps. Coordinates are sheet pixels inside one
// direction's cell; poses are [down, side (facing left), up]. Every outline is
// made of straight horizontal and vertical runs on whole pixels, so the cut
// leaves no seam.
//   bob: how far the body dips at each footfall   lift: how high a stepping foot rises
//   swing: how far legs swing from the hip (degrees, side view)   lean: forward lean (degrees, side view)
//   sway: sideways shift over the standing leg (front and back views)
//   pose.hip: where the body leans from; legs: [{ poly, ph (0/1: which half of the stride it steps in),
//     pivot (hip joint, side view), far (also draw a shaded copy behind, stepping out of turn),
//     back (drawn behind the other legs) }]
//   parts: carried things cut loose from the body, drawn over it: { poly, pivot, swing (degrees), lag,
//     raise (lifted by that share of the dip, so it clears the ground) }
// ---------------------------------------------------------------------------
Object.assign(RIGS, {
  chr_pim: {
    bob: 5, lift: 9, swing: 24, lean: 3, sway: 2,
    poses: [
      {
        hip: [47, 140],
        legs: [
          { poly: [[27, 148], [43, 148], [43, 176], [45, 176], [45, 203], [27, 203]] },
          { poly: [[55, 148], [67, 148], [67, 203], [51, 203], [51, 176], [52, 176], [52, 166], [53, 166], [53, 156], [55, 156]], ph: 1 },
        ],
        parts: [
          // the umbrella below her hands, between her boots
          { poly: [[43, 148], [55, 148], [55, 156], [53, 156], [53, 166], [52, 166], [52, 176], [51, 176], [51, 203], [45, 203], [45, 176], [43, 176]], pivot: [49, 128], swing: 3, lag: 0.6, raise: 1 },
        ],
      },
      {
        hip: [43, 141],
        legs: [
          { poly: [[30, 149], [57, 149], [57, 203], [24, 203], [24, 189], [30, 189]], pivot: [43, 141], far: true },
        ],
        parts: [
          // the umbrella, hanging from her hand
          { poly: [[9, 121], [19, 121], [19, 137], [27, 137], [27, 189], [24, 189], [24, 203], [9, 203]], pivot: [17, 121], swing: 8, lag: 0.6, raise: 0.6 },
        ],
      },
      {
        hip: [47, 140],
        legs: [
          { poly: [[27, 148], [45, 148], [45, 203], [27, 203]] },
          { poly: [[51, 148], [68, 148], [68, 203], [50, 203], [50, 176], [51, 176]], ph: 1 },
        ],
      },
    ],
  },
  // the dream pets walk upright on short legs. Their side views show both feet, one half behind the
  // other, so those only lift in turn: swinging them apart would show the part nobody drew
  chr_waffles: {
    bob: 4, lift: 8, lean: 2, sway: 2,
    poses: [
      {
        hip: [80, 160],
        legs: [
          { poly: [[40, 176], [80, 176], [80, 203], [40, 203]] },
          { poly: [[80, 176], [118, 176], [118, 203], [80, 203]], ph: 1 },
        ],
      },
      {
        hip: [78, 160],
        legs: [
          { poly: [[48, 176], [71, 176], [71, 179], [74, 179], [74, 187], [68, 187], [68, 190], [67, 190], [67, 203], [48, 203]], back: true },
          { poly: [[71, 176], [109, 176], [109, 203], [67, 203], [67, 190], [68, 190], [68, 187], [74, 187], [74, 179], [71, 179]], ph: 1 },
        ],
      },
      {
        hip: [85, 165],
        legs: [
          { poly: [[48, 183], [84, 183], [84, 203], [48, 203]] },
          { poly: [[84, 183], [122, 183], [122, 203], [84, 203]], ph: 1 },
        ],
      },
    ],
  },
  chr_biscuit: {
    bob: 4, lift: 8, lean: 2, sway: 2,
    poses: [
      {
        hip: [72, 165],
        legs: [
          { poly: [[36, 178], [73, 178], [73, 203], [36, 203]] },
          { poly: [[73, 178], [109, 178], [109, 203], [73, 203]], ph: 1 },
        ],
      },
      {
        hip: [66, 165],
        legs: [
          { poly: [[40, 178], [58, 178], [58, 189], [55, 189], [55, 192], [54, 192], [54, 203], [40, 203]], back: true },
          { poly: [[58, 178], [94, 178], [94, 203], [54, 203], [54, 192], [55, 192], [55, 189], [58, 189]], ph: 1 },
        ],
      },
      {
        hip: [75, 168],
        legs: [
          { poly: [[36, 180], [76, 180], [76, 203], [36, 203]] },
          // the right foot runs under the tail: follow its lower edge
          { poly: [[76, 180], [84, 180], [84, 184], [89, 184], [89, 186], [92, 186], [92, 188], [97, 188], [97, 190], [107, 190], [107, 192], [111, 192], [111, 203], [76, 203]], ph: 1 },
        ],
      },
    ],
  },
  // Momo's legs step in pairs from the side: the front two, then the back two
  chr_momo: {
    bob: 4, lift: 8, swing: 12, sway: 3,
    poses: [
      {
        hip: [103, 170],
        legs: [
          { poly: [[60, 181], [95, 181], [95, 203], [60, 203]] },
          { poly: [[112, 181], [149, 181], [149, 203], [112, 203]], ph: 1 },
        ],
      },
      {
        hip: [105, 170],
        legs: [
          { poly: [[54, 178], [93, 178], [93, 203], [54, 203]], pivot: [73, 168] },
          { poly: [[118, 182], [160, 182], [160, 203], [118, 203]], pivot: [138, 172], ph: 1 },
        ],
      },
      {
        hip: [103, 172],
        legs: [
          { poly: [[58, 179], [92, 179], [92, 203], [58, 203]] },
          { poly: [[115, 183], [150, 183], [150, 203], [115, 203]], ph: 1 },
        ],
      },
    ],
  },
  // the real pets at home walk on all fours; from the side, the front legs and the hind legs take turns
  chr_waffles_real: {
    bob: 2, lift: 5, swing: 10, sway: 1,
    poses: [
      {
        hip: [88, 100],
        legs: [
          { poly: [[62, 113], [89, 113], [89, 133], [62, 133]] },
          { poly: [[89, 113], [118, 113], [118, 133], [89, 133]], ph: 1 },
        ],
      },
      {
        hip: [88, 100],
        legs: [
          { poly: [[18, 113], [89, 113], [89, 133], [18, 133]], pivot: [52, 100] },
          { poly: [[89, 113], [158, 113], [158, 133], [89, 133]], pivot: [125, 100], ph: 1 },
        ],
      },
      {
        hip: [86, 104],
        legs: [
          { poly: [[48, 117], [86, 117], [86, 133], [48, 133]] },
          { poly: [[94, 117], [123, 117], [123, 133], [94, 133]], ph: 1 },
        ],
      },
    ],
  },
  chr_biscuit_real: {
    bob: 2, lift: 5, swing: 10, sway: 1,
    poses: [
      {
        hip: [80, 104],
        legs: [
          { poly: [[56, 116], [81, 116], [81, 133], [56, 133]] },
          { poly: [[81, 116], [105, 116], [105, 133], [81, 133]], ph: 1 },
        ],
      },
      {
        hip: [88, 104],
        legs: [
          { poly: [[30, 117], [86, 117], [86, 133], [30, 133]], pivot: [55, 104] },
          { poly: [[86, 117], [152, 117], [152, 133], [86, 133]], pivot: [120, 104], ph: 1 },
        ],
      },
      {
        hip: [80, 106],
        legs: [
          { poly: [[48, 117], [78, 117], [78, 133], [48, 133]] },
          { poly: [[80, 117], [112, 117], [112, 133], [80, 133]], ph: 1 },
        ],
      },
    ],
  },
});
