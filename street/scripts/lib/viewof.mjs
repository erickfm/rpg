// WHERE DO I STAND TO *SEE* THIS?
//
// `__ct.spots()` publishes where you stand to USE a thing. Nothing publishes
// where you stand to SEE one, and five rows in one session were unverifiable
// for exactly that reason: B's alley, A's ATM, B's phone box, C's car-lot
// office, and G's blade signs. Anything you look UP at, or look at from ACROSS
// a street, has no coordinate anywhere in the running world.
//
// Guessing does not work. I guessed three cameras for the blades and got a
// brick wall, the side of a building, and the side of a building again. This
// computes one instead:
//
//   1. walk a ring of candidate positions around the target
//   2. step along the ray from eye height to the target
//   3. reject the position if that ray passes through any tall mesh's box
//   4. of those, keep the closest — biggest in frame
//   5. and if the target has a FRONT, only consider positions in front of it
//
// KNOWN LIMITATION, found the first time I used it and left in deliberately:
// "closest clear position" can put you BEHIND the thing. Aimed at a blade sign
// it chose 4 m almost directly underneath, which fills the frame beautifully
// and may be showing you the back of the sign — the lettering looked reversed
// and I could not tell whether that was the sign or my angle. For anything
// with a FRONT (signage, posters, facades), pass `facing: {nx, nz}` once that
// is supported, or sanity-check the frame before trusting what you read in it.
// Distance is not the same as a good look.
//
// Usage, inside a page.evaluate:
//
//     const cam = viewOf({ x, y, z }, { minR: 4, maxR: 24 });
//     window.__ct.warp(cam.x, cam.z, cam.yaw, 0.14, cam.pitch);
//
// It needs no new data from anybody. Every builder's work is already in the
// scene graph; this just asks it the question a verifier actually has.
export const VIEWOF_SRC = `
(function viewOf(t, o) {
  o = o || {};
  var minR = o.minR || 6, maxR = o.maxR || 24, eye = o.eye || 1.6;
  var sc = window.__ct.scene(); sc.updateMatrixWorld(true);
  var boxes = [];
  sc.traverse(function (m) {
    if (!m.isMesh || !m.geometry) return;
    var g = m.geometry; if (!g.boundingBox) g.computeBoundingBox();
    if (!g.boundingBox) return;
    var bb = g.boundingBox.clone().applyMatrix4(m.matrixWorld);
    if (bb.max.y - bb.min.y < 3) return;      // only things that can occlude
    boxes.push(bb);
  });
  function clear(ox, oz) {
    var dx = t.x - ox, dy = t.y - eye, dz = t.z - oz;
    for (var s = 0.12; s < 0.94; s += 0.025) {
      var px = ox + dx * s, py = eye + dy * s, pz = oz + dz * s;
      for (var i = 0; i < boxes.length; i++) {
        var bb = boxes[i];
        if (px > bb.min.x && px < bb.max.x && py > bb.min.y &&
            py < bb.max.y && pz > bb.min.z && pz < bb.max.z) return false;
      }
    }
    return true;
  }
  var best = null;
  for (var a = 0; a < 360; a += 4) {
    for (var r = minR; r <= maxR; r += 2) {
      var ox = t.x + Math.cos(a * Math.PI / 180) * r;
      var oz = t.z + Math.sin(a * Math.PI / 180) * r;
      if (!clear(ox, oz)) continue;
      // IF THE TARGET HAS A FRONT, STAND IN FRONT OF IT. Without this the
      // helper happily picks the closest clear spot, which for a sign can be
      // directly behind it - you get a beautiful large frame of the back of
      // the thing and cannot tell reversed lettering from your own angle.
      if (o.facing) {
        var vx = ox - t.x, vz = oz - t.z;
        if (vx * o.facing.nx + vz * o.facing.nz <= 0) continue;
      }
      // NOT the closest. A clear RAY is not a good FRAME: at 4 m from
      // something 13.5 m up you are craning at 71 degrees with the building
      // filling the view, and the ray to the target is perfectly clear the
      // whole time. Reject anything you would have to stand underneath, then
      // take the closest of what is left.
      var pitch = Math.atan2(t.y - eye, r);
      if (pitch > (o.maxPitch || 0.7)) continue;      // ~40 degrees
      if (!best || r < best.r) best = { r: r, x: ox, z: oz };
    }
  }
  if (!best) return null;
  var d = Math.hypot(t.x - best.x, t.z - best.z);
  return {
    x: +best.x.toFixed(2), z: +best.z.toFixed(2), dist: +d.toFixed(1),
    yaw: Math.atan2(t.x - best.x, -(t.z - best.z)),
    pitch: Math.atan2(t.y - eye, d),
  };
})
`;


/**
 * WHICH WAY DO I FACE TO WALK AT THIS DOOR?
 *
 * Exported because I got it wrong twice in one session, the second time hours
 * after diagnosing and fixing it, by retyping it from memory into a throwaway
 * script. It walked me 200 m off the map.
 *
 * The world's convention: yaw 0 looks along -z, so a heading `y` points along
 * `(sin y, -cos y)`. A door publishes its INWARD normal `n`. Walking AT the
 * door from outside means travelling along `-n`, so
 *
 *     sin y = -nx      and      cos y = nz      =>   y = atan2(-nx, nz)
 *
 * THE TRAP: for every flat-wall door `nx === 0`, and `atan2(-0, nz)` and
 * `atan2(0, nz)` give the same direction. So the wrong form is correct for
 * nine rooms out of ten and points you along the street for the tenth — the
 * bodega's 45-degree cut face, where `nx === nz === -0.707`. It cannot be
 * caught by testing the easy cases, which is exactly how it survived.
 *
 *     import { approachHeading, exitHeading } from './lib/viewof.mjs';
 *     const d = doors.find(q => q.building === 'BODEGA').point;
 *     warp(d.x - d.nx * 4, d.z - d.nz * 4, approachHeading(d));
 */
export function approachHeading(door) {
  return Math.atan2(-door.nx, door.nz);
}

/** …and standing inside, facing back out through it: the opposite. */
export function exitHeading(door) {
  return Math.atan2(door.nx, -door.nz);
}
