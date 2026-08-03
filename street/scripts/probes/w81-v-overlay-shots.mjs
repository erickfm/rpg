// LOOK AT THE TWO TRUCKS THROUGH THE V COLLISION OVERLAY — the exact view the
// user filed item 202c from: *"truck collision isnt accurate to the truck but
// the other truck is?"*
//
// A screenshot proves nothing (two runs of identical code differ ~20% of
// pixels, and the walk in w81-side-truck-climb.mjs is what proves the collision
// works). This is for LOOKING: it is the only way to answer "do the boxes read
// as hugging the truck", which is the judgement the user made by eye.
//
// Usage: SHOT_URL=http://localhost:4370/ node scripts/probes/w81-v-overlay-shots.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1100, height: 700 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4370/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForFunction(() => window.__ct.painted && window.__ct.painted(), { timeout: 20000 })
  .catch(() => console.log('(no __ct.painted on this build — falling back to frames)'));

const cols = await p.evaluate(() => window.__ct.colliders());
/** The WHOLE vehicle's footprint, as the union of every tier carrying this
 *  instance's tags — not one tier. The pickup's bed tier is 2.10 x 2.05, near
 *  enough square that "which way is the truck pointing" came out of it as a
 *  coin flip, and the first run of this file stood the camera inside the Burger
 *  Barn and shot a black frame. GOTCHAS 80's lesson from the other end: look at
 *  every image you take, because a check that only writes files cannot tell. */
const unionFor = (kind, site) => {
  const own = cols.filter((c) => {
    const t = String(c.tag ?? '');
    if (!t.startsWith(`${kind}-`)) return false;
    return site === '' ? !t.includes('@') : t.endsWith(site);
  });
  if (!own.length) return null;
  return {
    minX: Math.min(...own.map((c) => c.minX)), maxX: Math.max(...own.map((c) => c.maxX)),
    minZ: Math.min(...own.map((c) => c.minZ)), maxZ: Math.max(...own.map((c) => c.maxZ)),
  };
};
const shots = [
  ['w81-main-truck-V', unionFor('pickup', ''), 6.0],
  ['w81-side-truck-V', unionFor('pickup', '@side'), 6.0],
  ['w81-side-sedan-V', unionFor('sedan', '@side'), 6.5],
];
// the overlay is a HELD keypress like everything else here (BUILDER-BRIEF §5):
// the key set is read once per rendered frame
await p.keyboard.down('v'); await p.waitForTimeout(120); await p.keyboard.up('v');
await p.waitForTimeout(300);

for (const [name, box, back] of shots) {
  if (!box) { console.log(`no collider for ${name} — skipped`); continue; }
  const cx = (box.minX + box.maxX) / 2, cz = (box.minZ + box.maxZ) / 2;
  // Stand off the vehicle's NOSE or TAIL — along its length, so the whole
  // silhouette is in frame — and take whichever end is standing on the ROAD and
  // is not inside anything. Derived, not typed: the main street's truck is on
  // the west kerb, so the obvious "step to one side" spot is inside a shopfront.
  const long = (box.maxX - box.minX) >= (box.maxZ - box.minZ) ? 'x' : 'z';
  const half = long === 'x' ? (box.maxX - box.minX) / 2 : (box.maxZ - box.minZ) / 2;
  const cand = [];
  for (const s of [1, -1]) {
    for (const off of [0, 1.2, -1.2]) {
      cand.push(long === 'x'
        ? [cx + s * (half + back), cz + off]
        : [cx + off, cz + s * (half + back)]);
    }
  }
  const spot = await p.evaluate(([cand]) => {
    const cols = window.__ct.colliders();
    for (const [x, z] of cand) {
      const inside = cols.some((c) => x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ
        && (c.maxY === undefined || c.maxY > 1.0));
      if (!inside && window.__ct.groundAt(x, z) < 0.2) return [x, z];
    }
    return null;
  }, [cand]);
  if (!spot) { console.log(`${name}: no clear standing spot found — skipped`); continue; }
  const [ex, ez] = spot;
  const yaw = Math.atan2(cx - ex, -(cz - ez));
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, -0.18), [ex, ez, yaw]);
  // WAIT FOR THE FLOOR TO SETTLE BEFORE SHOOTING. You spawn in room 301, three
  // storeys up, and ct/apartment.ts's storey picker walks down to the street
  // over several frames rather than snapping. `warp` writes x and z but not
  // your height, so the first frame after it is still taken from inside a dark
  // interior — which is exactly the all-black first shot this file produced
  // twice before the settle was added. (w21-roof-climb.mjs carries the same
  // loop for the same reason.)
  await p.evaluate(() => new Promise((done) => {
    let last = NaN, still = 0, frames = 0;
    const tick = () => {
      const y = window.__ct.camY();
      still = Math.abs(y - last) < 1e-4 ? still + 1 : 0;
      last = y;
      if (still >= 8 || ++frames > 300) return done(y);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  await p.waitForTimeout(250);
  await p.screenshot({ path: `shots/${name}.png` });
  console.log(`shots/${name}.png — standing at ${ex.toFixed(2)},${ez.toFixed(2)} looking at ${cx.toFixed(2)},${cz.toFixed(2)}`);
}
await browser.close();
