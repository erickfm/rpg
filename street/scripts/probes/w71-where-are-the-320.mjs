// Item 198 — WHERE IS THE REMAINING PLAYER-vs-CROWD GAP, and does any of it
// stand on ground a pedestrian can reach?
//
// The row says 359 of 508 static boxes are invisible to the crowd and treats
// that as the size of ONE line in ct/street.ts. Fixing that line moved 39. So
// the other 320 are somebody else's, and before anyone queues "adopt the rest"
// it is worth knowing whether they are even on the street: the interiors are
// parked far off the block (item 196 measures two of them 229 m apart) and no
// citizen has ever walked there.
//
// The crowd's own demonstrated territory is the yardstick, not a guessed
// bounding box — scripts/probes/w71-crowd-health.mjs measured it at
// x -6.5..55.6, z -108.6..1.1 over 300 s. Anything outside that is ground the
// sim does not visit, so a box there cannot be clipped by anybody.
//
// Usage: SHOT_URL=http://localhost:4270/ node scripts/probes/w71-where-are-the-320.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4270/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await waitPainted(p);
await p.waitForTimeout(600);

// The crowd's measured roam box, with a metre of slack so a box merely at the
// edge still counts as reachable.
const ROAM = { minX: -7.5, maxX: 56.6, minZ: -109.6, maxZ: 2.1 };

const r = await p.evaluate((roam) => {
  const key = (c) => [c.minX, c.maxX, c.minZ, c.maxZ].map((v) => v.toFixed(3)).join('|');
  const avoid = new Set(window.__ct.citAvoid().filter((c) => !c.actor).map(key));
  const stat = window.__ct.staticColliders();
  const missing = stat.filter((c) => !avoid.has(key(c)));
  const overlaps = (c) => c.maxX > roam.minX && c.minX < roam.maxX && c.maxZ > roam.minZ && c.minZ < roam.maxZ;
  const on = missing.filter(overlaps), off = missing.filter((c) => !overlaps(c));
  // for the ones that ARE on walkable ground, how far from the four walk lines
  // the crowd actually uses? The sim's own footprint radius is 0.28.
  return {
    statTotal: stat.length, avoidTotal: avoid.size, missing: missing.length,
    onStreet: on.length, offStreet: off.length,
    onSample: on.slice(0, 25).map((c) => ({
      w: +(c.maxX - c.minX).toFixed(2), d: +(c.maxZ - c.minZ).toFixed(2),
      x: +((c.minX + c.maxX) / 2).toFixed(2), z: +((c.minZ + c.maxZ) / 2).toFixed(2),
    })),
    offSpanX: off.length ? [Math.min(...off.map((c) => c.minX)), Math.max(...off.map((c) => c.maxX))] : null,
    offSpanZ: off.length ? [Math.min(...off.map((c) => c.minZ)), Math.max(...off.map((c) => c.maxZ))] : null,
  };
}, ROAM);

console.log(`static player colliders         : ${r.statTotal}`);
console.log(`in citAvoid                     : ${r.avoidTotal}`);
console.log(`STILL MISSING from citAvoid     : ${r.missing}`);
console.log(`  ...on ground the crowd walks  : ${r.onStreet}`);
console.log(`  ...off it (interiors etc.)    : ${r.offStreet}   x ${r.offSpanX?.map((v) => v.toFixed(0))}  z ${r.offSpanZ?.map((v) => v.toFixed(0))}`);
console.log('\non-street leftovers (first 25):');
for (const c of r.onSample) console.log(`   ${String(c.w).padStart(6)} x ${String(c.d).padStart(6)}  at (${c.x}, ${c.z})`);
await b.close();
