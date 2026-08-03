// ITEM 172, SECOND HALF — IS THE PARK'S SILHOUETTE A FLAT BAND?
//
// The item's claim: *"the trees are all roughly one canopy height, the lamps
// one height, the wall one height — so even once the ground moves, the
// silhouette stays a flat band."*
//
// That is a measurable statement and it should be measured before anything is
// changed, because `ct/park.ts:2062` already reads
//
//     const h = 6.6 + t2() * 2.8, spread = 4.4 + t2() * 2.0, trunk = 2.6 + t2() * 1.0;
//
// — i.e. the source already varies tree height over a 2.8 m band. Either the
// spread does not survive to the world (correlated seeds are the obvious way
// that happens: every tree in the boundary runs is seeded `0x400 + round(z*3)`,
// and an LCG's FIRST output off near-adjacent seeds is the least random number
// it will ever produce), or the item's claim is wrong. This tells them apart.
//
// It reports the canopy TOP — ground + trunk + canopy — and not the `h`
// parameter, because the top edge is what a silhouette is made of and because
// the ground under each tree is about to start moving.
//
//   SHOT_URL=http://localhost:4390/ node scripts/probes/w83-park-canopy.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL || 'http://localhost:4390/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct?.scene !== undefined, { timeout: 20000 });

const out = await page.evaluate(() => {
  const sites = window.__ct.sites();
  const p = sites.park;
  if (!p) return { abort: 'no park site' };
  const scene = window.__ct.scene();
  // A TREE IS A TRUNK PLUS THE CANOPY ABOVE IT, and it has to be identified
  // that way round.
  //
  // The first cut of this selected "a DoubleSide alphaTest plane" and reported
  // 51 trees whose canopies ran 0.31 m to 8.06 m — because the SHRUB layer
  // along the walls is built from alphaTest planes too, and a 0.31 m canopy is
  // a bush. It would have reported a 7.75 m spread of tree heights and been
  // measuring mostly shrubs. Filtering by size would have been circular: size
  // is the thing under test.
  //
  // So key on the STRUCTURE instead, which is independent of the sizes being
  // measured: `ct/park.ts:2064` gives every tree a 0.3 x 0.3 bark box, and
  // nothing else in the park is a 0.3 x 0.3 column with foliage over it.
  const trunks = [];
  const leaves = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    o.updateWorldMatrix(true, false);
    const w = o.matrixWorld.elements;
    const x = w[12], y = w[13], z = w[14];
    if (x < p.minX || x > p.maxX || z < p.minZ || z > p.maxZ) return;
    const g = o.geometry, par = g.parameters || {};
    if (g.type === 'BoxGeometry' && Math.abs(par.width - 0.3) < 1e-6 && Math.abs(par.depth - 0.3) < 1e-6) {
      trunks.push({ x, z, y, h: par.height });
    } else if (g.type === 'PlaneGeometry' && o.material && o.material.alphaTest === 0.5 && o.material.side === 2) {
      leaves.push({ x, z, y, h: par.height, w: par.width });
    }
  });
  const trees = [];
  for (const tk of trunks) {
    // canopy planes sit at the trunk's own x,z exactly (same `x`, `z` args)
    const mine = leaves.filter((l) => Math.abs(l.x - tk.x) < 0.02 && Math.abs(l.z - tk.z) < 0.02);
    if (!mine.length) continue;                 // a 0.3 m post with no foliage is not a tree
    trees.push({
      x: tk.x, z: tk.z, n: mine.length,
      // the trunk box is centred at gy + (trunk+0.6)/2, so its underside is the
      // ground the tree stands on — which is about to start moving
      ground: tk.y - tk.h / 2,
      top: Math.max(...mine.map((l) => l.y + l.h / 2)),
      canopy: Math.max(...mine.map((l) => l.h)),
      spread: Math.max(...mine.map((l) => l.w)),
    });
  }
  return { trees, site: p, trunks: trunks.length, leaves: leaves.length };
});

if (out.abort) { console.log('ABORT ' + out.abort); await browser.close(); process.exit(3); }

// POPULATION FLOOR. The park is planted with a back line, two flank lines, a
// field-framing line and two singletons — well over a dozen. Under 8 means the
// selector matched the wrong thing (or nothing), and every statistic below
// would be a confident claim about a handful of accidents.
const FLOOR = 8;
const t = out.trees;
console.log(`park trees found: ${t.length}  (0.3 m trunks ${out.trunks}, foliage planes ${out.leaves}, ` +
  `canopy planes on trees ${t.reduce((a, b) => a + b.n, 0)})`);
if (t.length < FLOOR) {
  console.log(`ABORT  only ${t.length} trees, floor is ${FLOOR} — the canopy selector matched the wrong meshes`);
  await browser.close();
  process.exit(3);
}
if (t.some((x) => x.n !== 3)) console.log(`NOTE  ${t.filter((x) => x.n !== 3).length} tree(s) do not have exactly 3 canopy planes`);

const stat = (name, vals, unit = 'm') => {
  const s = [...vals].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length);
  console.log(`${name.padEnd(14)} min ${s[0].toFixed(2)}  max ${s[s.length - 1].toFixed(2)}  ` +
    `spread ${(s[s.length - 1] - s[0]).toFixed(2)} ${unit}  sd ${sd.toFixed(3)}  ` +
    `distinct ${new Set(s.map((v) => v.toFixed(2))).size}/${s.length}`);
  return { min: s[0], max: s[s.length - 1], spread: s[s.length - 1] - s[0], sd };
};
stat('canopy top', t.map((x) => x.top));
stat('canopy height', t.map((x) => x.canopy));
stat('canopy spread', t.map((x) => x.spread));
stat('stands on', t.map((x) => x.ground));
await browser.close();
