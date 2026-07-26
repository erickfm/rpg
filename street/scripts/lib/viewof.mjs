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
//   4. keep the survivor that makes the target BIGGEST in frame
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
      // CLOSEST clear position wins: the target is biggest in frame, which is
      // the whole point - a sightline you cannot read is not a sightline.
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
