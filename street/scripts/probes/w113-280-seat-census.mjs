// ITEM 280 — census every seated citizen and DERIVE the furniture depth in
// front of each one, plus the item-93 seat-offer counts.
//
// Two questions this answers that the previous two scopings did not:
//
//  1. onehundredeleven's census found EIGHT seated figures and did not include
//     the diner's two, which onehundredeight photographed. Either the census
//     missed them or the diner has none. This one filters on NOTHING — no
//     `visible`, no region — because "is there a seated sprite here" is an
//     AUTHORING fact (GOTCHAS 79/79b).
//  2. Can ONE `SEAT_FWD` serve every room? For each sitter this walks the scene
//     for the box it is sitting on (a box whose top face is within 2 cm of the
//     sitter's y and whose footprint contains the sitter) and reports the
//     half-depth ALONG THAT SITTER'S FACING. That is the number the offset
//     wants to be, derived per seat rather than typed once.
//
// Usage: SHOT_URL=http://localhost:4690/ node scripts/probes/w113-280-seat-census.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted } from '../lib/painted.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4690/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await waitPainted(p, { quiet: true });
await reportWorld(p, URL);

const out = await p.evaluate(() => {
  const s = window.__ct.scene();
  s.updateMatrixWorld(true);
  const people = [];
  const boxes = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    const e = n.matrixWorld.elements;
    const wx = e[12], wy = e[13], wz = e[14];
    if (n.userData?.seated) {
      people.push({ x: +wx.toFixed(3), y: +wy.toFixed(3), z: +wz.toFixed(3),
        facing: n.userData.citizenFacing ?? null,
        citizen: !!n.userData.citizen });
      return;
    }
    if (n.geometry.type !== 'BoxGeometry') return;
    // world AABB — the box may be rotated, so use the geometry bounding box
    // pushed through the world matrix rather than its declared parameters.
    n.geometry.computeBoundingBox();
    const bb = n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld);
    boxes.push({ x: wx, y: wy, z: wz,
      minX: bb.min.x, maxX: bb.max.x, minY: bb.min.y, maxY: bb.max.y,
      minZ: bb.min.z, maxZ: bb.max.z });
  });

  // for each sitter, the box it is standing in whose TOP is at its hip y
  for (const q of people) {
    let best = null;
    for (const bx of boxes) {
      if (Math.abs(bx.maxY - q.y) > 0.03) continue;           // top face == seat height
      if (q.x < bx.minX - 0.05 || q.x > bx.maxX + 0.05) continue;
      if (q.z < bx.minZ - 0.05 || q.z > bx.maxZ + 0.05) continue;
      const area = (bx.maxX - bx.minX) * (bx.maxZ - bx.minZ);
      if (!best || area < best.area) best = { ...bx, area };
    }
    if (!best) { q.seat = null; continue; }
    // how far forward, along the sitter's facing, until we leave the box.
    // facing 0 = +z (see citizenSprite: fwd = (sin f, 0, cos f))
    const fx = Math.sin(q.facing ?? 0), fz = Math.cos(q.facing ?? 0);
    let t = Infinity;
    if (Math.abs(fx) > 1e-6) t = Math.min(t, ((fx > 0 ? best.maxX : best.minX) - q.x) / fx);
    if (Math.abs(fz) > 1e-6) t = Math.min(t, ((fz > 0 ? best.maxZ : best.minZ) - q.z) / fz);
    q.seat = {
      w: +(best.maxX - best.minX).toFixed(3),
      d: +(best.maxZ - best.minZ).toFixed(3),
      top: +best.maxY.toFixed(3),
      fwdToEdge: +t.toFixed(3),          // <-- the offset this seat wants
    };
  }

  // item 93: every seat spot, offered or suppressed. `ok` is false for ALL
  // seats while the player is seated, so this is only valid standing.
  const spots = window.__ct.spots();
  const seatSpots = spots.filter((sp) => /sit|pew|stool|bench|seat/i.test(sp.label ?? ''));
  return { people, seatSpots, seated: window.__ct.seated(), nBoxes: boxes.length };
});

if (out.seated) { console.error('MISS: player is seated; seat ok() is false for all'); process.exit(3); }

console.log(`\n${out.people.length} seated sprites (no visible filter), ${out.nBoxes} boxes in world\n`);
const byX = [...out.people].sort((a, c) => a.x - c.x);
for (const q of byX) {
  const s = q.seat;
  console.log(`  (${q.x}, ${q.y}, ${q.z}) facing ${q.facing?.toFixed(2) ?? '--'}  `
    + (s ? `seat ${s.w}x${s.d} top ${s.top}  FWD-TO-EDGE ${s.fwdToEdge}` : 'seat: NONE FOUND'));
}
const fwds = out.people.filter((q) => q.seat).map((q) => q.seat.fwdToEdge);
if (fwds.length) {
  console.log(`\nfwdToEdge: min ${Math.min(...fwds).toFixed(3)}  max ${Math.max(...fwds).toFixed(3)}`
    + `  n=${fwds.length}`);
}

const off = out.seatSpots.filter((sp) => sp.ok).length;
console.log(`\nitem 93 — seat spots: ${out.seatSpots.length} registered, `
  + `${off} offered, ${out.seatSpots.length - off} suppressed`);
// per-cluster, so church and casino can be read separately
const clusters = new Map();
for (const sp of out.seatSpots) {
  const k = Math.round(sp.x / 100) * 100;
  const c = clusters.get(k) ?? { n: 0, ok: 0 };
  c.n++; if (sp.ok) c.ok++; clusters.set(k, c);
}
for (const [k, c] of [...clusters].sort((a, z) => a[0] - z[0]))
  console.log(`   x~${k}: ${c.n} registered, ${c.ok} offered, ${c.n - c.ok} suppressed`);

// Written to a file rather than only printed, so the before/after comparison is
// a diff of two artefacts and not of two things I read off a terminal.
const dump = {
  people: out.people.map((q) => [q.x, q.y, q.z, q.facing]),
  seatSpots: out.seatSpots.map((sp) => [+sp.x.toFixed(3), +sp.z.toFixed(3), sp.ok]),
};
if (process.argv[2]) {
  const f = `shots/w113-280-census-${process.argv[2]}.json`;
  (await import('node:fs')).writeFileSync(f, JSON.stringify(dump, null, 1));
  console.log(`\nwrote ${f}`);
}
await b.close();
