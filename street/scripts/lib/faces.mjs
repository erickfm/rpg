// WHERE A FACE IS, AND HOW BIG — once, for every tool that asks.
//
// This existed independently in four scripts and was WRONG IN TWO of them, both
// of which shipped a specific, reproducible, believed number into a triage
// table before anyone checked it:
//
//   masonry.mjs    42 "off-density" faces      — 3f3c3ddb
//   seampairs.mjs  135 "disagreeing" junctions — fe310665
//
// Both were the same mistake. A BoxGeometry's material order is
// [+x, -x, +y, -y, +z, -z], so material 0 is the +x face and its dimensions are
// DEPTH x height — not `parameters.width`, which is the +z face's width. Read
// material[0] and measure parameters.width and every box in the world reports a
// mismatch on the horizontal axis and none on the vertical, because height is
// height on both side faces. That signature is what finally gave it away.
//
// It is injected as SOURCE rather than imported, because every consumer needs it
// inside page.evaluate where a module import cannot reach.
export const FACE_LIB = `
window.__faceLib = {
  // the two in-plane dimensions of one face, in world units
  dims(o, mi) {
    const pr = o.geometry.parameters || {};
    const e = o.matrixWorld.elements;
    const len = (a,b,c) => Math.hypot(e[a], e[b], e[c]);
    const S = [len(0,1,2), len(4,5,6), len(8,9,10)];
    if (o.geometry.type === 'BoxGeometry') {
      if (mi === 0 || mi === 1) return { fw: (pr.depth??0)*S[2], fh: (pr.height??0)*S[1] };
      if (mi === 4 || mi === 5) return { fw: (pr.width??0)*S[0], fh: (pr.height??0)*S[1] };
      return { fw: (pr.width??0)*S[0], fh: (pr.depth??0)*S[2] };
    }
    return { fw: (pr.width??0)*S[0], fh: (pr.height??0)*S[1] };
  },
  // local centre offset and the two in-plane axes for that face
  frame(o, mi) {
    const pr = o.geometry.parameters || {};
    if (o.geometry.type !== 'BoxGeometry') return { ctr:[0,0,0], ax:[1,0,0], ay:[0,1,0] };
    const W=(pr.width??0)/2, H=(pr.height??0)/2, D=(pr.depth??0)/2;
    if (mi===0) return { ctr:[ W,0,0], ax:[0,0,1], ay:[0,1,0] };
    if (mi===1) return { ctr:[-W,0,0], ax:[0,0,1], ay:[0,1,0] };
    if (mi===4) return { ctr:[0,0, D], ax:[1,0,0], ay:[0,1,0] };
    if (mi===5) return { ctr:[0,0,-D], ax:[1,0,0], ay:[0,1,0] };
    return { ctr:[0, mi===2?H:-H, 0], ax:[1,0,0], ay:[0,0,1] };
  },
  // DO TWO FACES ACTUALLY MEET?
  //
  // Combines the two tests that were developed separately and are each right
  // about a different thing:
  //
  //   seampairs sampled the FACE RECTANGLE — correct about where a face is,
  //     which a mesh bounding box is not (a shopfront band's box spans a whole
  //     frontage), but it compared grid point to grid point, and the minimum
  //     between two coarse grids OVERESTIMATES the gap on a large face.
  //   pairclip measured POINT TO SLAB — continuous in the second object, so no
  //     overestimate, and it caught junctions the cheap version dropped, one of
  //     them a real 0.06 m gap that a plane test put 8 m away. But it sampled
  //     bounding boxes.
  //
  // Face rectangle samples, measured against the other face's own rectangle as
  // a box. Neither error survives.
  //
  // The opposed-normal drop is pairclip's and it is not an optimisation: the two
  // faces of one wall are 0.18 m apart and face away from each other, so nobody
  // can stand where both are visible and see them disagree.
  touches(a, c, tol) {
    const t = tol === undefined ? 0.35 : tol;
    if (a.nrm && c.nrm) {
      const dot = a.nrm[0]*c.nrm[0] + a.nrm[1]*c.nrm[1] + a.nrm[2]*c.nrm[2];
      if (dot < -0.5) return false;
    }
    const box = (f) => {
      let b = [1e9,1e9,1e9,-1e9,-1e9,-1e9];
      for (const p of f.pts) {
        for (let k = 0; k < 3; k++) { if (p[k] < b[k]) b[k] = p[k]; if (p[k] > b[k+3]) b[k+3] = p[k]; }
      }
      return b;
    };
    const ptToBox = (p, b) => Math.hypot(
      Math.max(b[0]-p[0], 0, p[0]-b[3]),
      Math.max(b[1]-p[1], 0, p[1]-b[4]),
      Math.max(b[2]-p[2], 0, p[2]-b[5]));
    const ba = box(a), bc = box(c);
    for (const p of a.pts) if (ptToBox(p, bc) <= t) return true;
    for (const p of c.pts) if (ptToBox(p, ba) <= t) return true;
    return false;
  },

  // what the painter said this surface is, and how dense — see ct/paint.ts
  stamp(m) {
    const u = m && m.map && m.map.userData;
    return { masonry: (u && u.masonry) || null, surface: (u && u.surface) || null };
  },
};
`;
