// WHAT STOPS A WALKER 1.65 m INTO EVERY LANDING?
//
// Walking north up any of the four halls from AZI(1.0), the player stops dead
// at z = -17.35 — on floor 3 as well, which item 109 did not touch. Item 109
// adds no colliders at all (wall spandrels, casings, leaves and dim panels are
// all scene.add only), so this is either pre-existing or it is not a collider.
// Either way it gets named before anybody claims it.
//
// Usage: SHOT_URL=http://localhost:4192/ node scripts/probes/w61-hallblocker.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
import { installCollide } from '../lib/collide.mjs';

const URL = aim('http://localhost:4192/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ct, null, { timeout: 60000 });
await afterFrames(page, 3);

// the walker's own radius is what turns a box into a stopping distance, so
// ask the question the way the movement code does: which boxes does the
// player's disc at the stop point actually touch?
const R = 0.36;
const out = await page.evaluate(({ px, pz, r }) => {
  const cs = window.__ct.colliders();
  const hits = [];
  cs.forEach((c, i) => {
    if (c.minX > 999 || c.maxX < -999) return;              // parked caps
    const near = px > c.minX - r && px < c.maxX + r
              && pz > c.minZ - r && pz < c.maxZ + r;
    if (!near) return;
    hits.push({ i, minX: +c.minX.toFixed(3), maxX: +c.maxX.toFixed(3),
                minZ: +c.minZ.toFixed(3), maxZ: +c.maxZ.toFixed(3),
                rot: c.rot ?? 0 });
  });
  return { total: cs.length, hits };
}, { px: 201.9, pz: -17.353, r: R });
console.log('total colliders in the world:', out.total);
console.log(`boxes within the player radius (${R}) of the stop point (201.900, -17.353):`);
if (!out.hits.length) console.log('  (none — so the stop is NOT one of these boxes)');
for (const h of out.hits) console.log('  ' + JSON.stringify(h));

// A hand-rolled min/max test is wrong for a ROTATED box — that is the whole
// reason lib/collide.mjs exists. Ask the frame-aware predicate instead, and
// sweep north along the walker's line to find where it first says "blocked".
await installCollide(page);
const sweep = await page.evaluate(({ px, r }) => {
  const cs = window.__ct.colliders();
  const B = window.__probeCollide;
  const rows = [];
  for (let z = -19.0; z <= -16.0; z += 0.05) {
    rows.push({ z: +z.toFixed(2), blocked: B.blockedAt(cs, px, z, r) });
  }
  return rows;
}, { px: 201.9, r: R });
const firstBlocked = sweep.find((s) => s.blocked);
console.log('\nframe-aware sweep north along x=201.9:');
console.log('  first blocked z:', firstBlocked ? firstBlocked.z : '(never blocked)');

if (firstBlocked) {
  const who = await page.evaluate(({ px, pz, r }) => {
    const cs = window.__ct.colliders();
    const C = window.__probeCollide;
    const out = [];
    cs.forEach((c, i) => {
      if (!C.insideOne(c, px, pz, r)) return;
      out.push({ i, minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ, rot: c.rot ?? 0 });
    });
    return out;
  }, { px: 201.9, pz: firstBlocked.z, r: R });
  console.log('  the box(es) doing it:');
  for (const w of who) {
    console.log(`    #${w.i} x ${w.minX}..${w.maxX}  z ${w.minZ}..${w.maxZ}  `
      + `rot=${w.rot} (${(w.rot * 180 / Math.PI).toFixed(1)} deg)`);
  }
}

// If nothing blocks, the stop is the GROUND, not a wall. Ask what the floor
// picker offers along the same line.
const ground = await page.evaluate(({ px }) => {
  const rows = [];
  for (let z = -18.0; z <= -16.4; z += 0.1) {
    rows.push({ z: +z.toFixed(2), g: window.__ct.groundAt ? window.__ct.groundAt(px, z) : null });
  }
  return rows;
}, { px: 201.9 });
console.log('\nground height along the same line (floor 1, expect 0):');
for (const g of ground) console.log(`  z=${g.z}  ground=${g.g}`);
await browser.close();
