// Item 222 — WHERE ARE THE CASINO AND HOTEL WALLS, AND WHERE SHOULD THEY BE?
//
// Worker seventysix: *"the rooms grew; the walls didnt follow"* — casino 8
// escapes in 24 containment runs, hotel 9, the other ten rooms 0 each.
//
// This does not walk. It asks the world for each room's DECLARED extents
// (`__ct.roomDims()`) and then for the static colliders standing in that room,
// and reports the gap between the two: for each of the four sides, is there a
// collider run covering the whole span, or is there a hole and how wide?
//
// Comparing the declaration against the geometry is the point — "the rooms grew
// and the walls did not follow" is precisely a disagreement between those two,
// and a walk can only tell you that you got out, not which side is wrong.
//
// Usage: SHOT_URL=http://localhost:4270/ node scripts/probes/w71-vice-walls.mjs [room…]
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4270/');
const ASK = process.argv.slice(2);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await p.waitForTimeout(700);

const rooms = await p.evaluate(() => window.__ct.roomDims());
const want = ASK.length ? rooms.filter((r) => ASK.includes(r.id)) : rooms;

for (const r of want) {
  const q = await p.evaluate((rm) => {
    const hw = rm.w / 2, hd = rm.d / 2;
    const x0 = rm.cx - hw, x1 = rm.cx + hw, z0 = rm.cz - hd, z1 = rm.cz + hd;
    // every static collider that touches this room's footprint, generously
    // padded so a wall standing just outside the declared box still counts
    const PAD = 3;
    const near = window.__ct.staticColliders().filter((c) =>
      c.maxX > x0 - PAD && c.minX < x1 + PAD && c.maxZ > z0 - PAD && c.minZ < z1 + PAD);
    // COVERAGE OF EACH SIDE. For the two x-walls, project every collider that
    // straddles the wall line onto z and merge the runs; a gap in the merged
    // run is a hole you can walk through.
    const cover = (fixed, axis) => {
      const runs = [];
      for (const c of near) {
        if (axis === 'x') {
          if (c.minX > fixed || c.maxX < fixed) continue;      // does not straddle the wall line
          runs.push([Math.max(c.minZ, z0), Math.min(c.maxZ, z1)]);
        } else {
          if (c.minZ > fixed || c.maxZ < fixed) continue;
          runs.push([Math.max(c.minX, x0), Math.min(c.maxX, x1)]);
        }
      }
      runs.sort((a, c) => a[0] - c[0]);
      const merged = [];
      for (const s of runs) {
        if (s[1] <= s[0]) continue;
        const last = merged[merged.length - 1];
        if (last && s[0] <= last[1] + 1e-6) last[1] = Math.max(last[1], s[1]);
        else merged.push([...s]);
      }
      const lo = axis === 'x' ? z0 : x0, hi = axis === 'x' ? z1 : x1;
      const gaps = [];
      let at = lo;
      for (const m of merged) { if (m[0] > at + 1e-6) gaps.push([at, m[0]]); at = Math.max(at, m[1]); }
      if (at < hi - 1e-6) gaps.push([at, hi]);
      const covered = merged.reduce((a, m) => a + (m[1] - m[0]), 0);
      return { covered: +covered.toFixed(2), span: +(hi - lo).toFixed(2),
        gaps: gaps.map((g) => [+g[0].toFixed(2), +g[1].toFixed(2), +(g[1] - g[0]).toFixed(2)]) };
    };
    return { x0: +x0.toFixed(2), x1: +x1.toFixed(2), z0: +z0.toFixed(2), z1: +z1.toFixed(2),
      near: near.length,
      west: cover(x0, 'x'), east: cover(x1, 'x'), south: cover(z0, 'z'), north: cover(z1, 'z') };
  }, r);

  const bad = [q.west, q.east, q.south, q.north].some((s) => s.covered < s.span - 1.2);
  console.log(`\n=== ${r.id}  w ${r.w} x d ${r.d}  centre (${r.cx}, ${r.cz})  ${bad ? '<-- LEAKS' : ''}`);
  console.log(`    footprint x ${q.x0}..${q.x1}   z ${q.z0}..${q.z1}   (${q.near} colliders near)`);
  for (const [name, s] of [['west  x=' + q.x0, q.west], ['east  x=' + q.x1, q.east],
    ['south z=' + q.z0, q.south], ['north z=' + q.z1, q.north]]) {
    const pc = (100 * s.covered / Math.max(s.span, 1e-6)).toFixed(0);
    console.log(`    ${name.padEnd(16)} covered ${String(s.covered).padStart(7)} of ${String(s.span).padStart(7)} m  (${pc}%)`
      + (s.gaps.length ? `   GAPS ${JSON.stringify(s.gaps)}` : ''));
  }
}
await b.close();
