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
  // what the painter said this surface is, and how dense — see ct/paint.ts
  stamp(m) {
    const u = m && m.map && m.map.userData;
    return { masonry: (u && u.masonry) || null, surface: (u && u.surface) || null };
  },
};
`;
