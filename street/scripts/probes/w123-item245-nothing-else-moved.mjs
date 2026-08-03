// Item 245 — what this change did NOT do.
//
// `fp`/`fpdiff` cannot be used here: it is a pure-refactor tool and any change
// to the geometry stream repaints every dithered texture after it
// (BUILDER-BRIEF §10). So the claim is stated structurally instead: the seat
// registrations add NO colliders and NO meshes, and exactly ONE mesh moved —
// the waiting woman, along her own bench.
//
// Run it against the world you built and against a checkout of the parent
// commit, and diff the two lines it prints.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4194/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots, null, { timeout: 30000 });
await p.evaluate(() => window.__ct.clock(12, 30));

const n = await p.evaluate(() => {
  let meshes = 0;
  window.__ct.scene().traverse((o) => { if (o.isMesh) meshes++; });
  return { meshes, colliders: window.__ct.colliders().length,
    spots: window.__ct.spots().length, seats: window.__ct.seats().length };
});
console.log(`meshes ${n.meshes}  colliders ${n.colliders}  spots ${n.spots}  seats ${n.seats}`);
// the jail's own colliders, so a change there cannot hide in a world-wide total
const jail = await p.evaluate(() => window.__ct.colliders()
  .filter((c) => c.minX > 980 && c.maxX < 1020).length);
console.log(`jail-slab colliders (980 < x < 1020): ${jail}`);
await b.close();
