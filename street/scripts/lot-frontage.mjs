// GOTCHAS §9: the 2 m sidewalk lane past the car lot is sacred. Is it?
//
// I have been asserting it from geometry — "everything this module builds is at
// x >= 7.18, and the walk ends at x = 7" — which is an argument, not a
// measurement. It is also exactly the class of claim this project keeps
// disproving: a collider is not where you think, a wall is a box whose origin
// is somewhere else, an [E] spot sits inside a solid.
//
// So measure it. At each z along the lot's frontage, scan the walk from the
// kerb to the building line and find the WIDEST CONTINUOUS band the rig can
// stand in, against the same collider array the movement code tests. The rig
// is 0.36 m in radius, so a band is only walkable where a 0.36 m disc fits.
//
// Usage: SHOT_URL=http://localhost:4190/ node scripts/lot-frontage.mjs
import { chromium } from 'playwright';
const ROAD_HALF = 5.0, FACE = 7.0, R = 0.36;
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4190/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

// The lot's own frontage, asked for rather than remembered: its stamped meshes.
const span = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let z0 = 1e9, z1 = -1e9;
  s.traverse((o) => {
    if (!o.isMesh || o.userData?.mod !== 'lot') return;
    const e = o.matrixWorld.elements;
    z0 = Math.min(z0, e[14]); z1 = Math.max(z1, e[14]);
  });
  return [z0, z1];
});

const cols = await p.evaluate(() => window.__ct.colliders()
  .map((c) => [c.minX, c.maxX, c.minZ, c.maxZ]).filter((c) => c[0] < 500));
await b.close();

const free = (x, z) => !cols.some(([a, b2, c, d]) =>
  x > a - R && x < b2 + R && z > c - R && z < d + R);

// This measures the band of valid CENTRES, not the width of the pavement: a
// 0.36 m rig on a perfectly clear 2.00 m walk can only ever put its centre in
// the middle 1.28 m, because the kerb edge and the building line each cost it
// R. So an absolute threshold is meaningless and my first run invented one —
// it called 1.30 m a failure when 1.30 m is what CLEAR looks like.
//
// A CONTROL settles it instead: the same metric over a stretch of the same
// east walk with no lot on it. Whatever that reads is what this world calls
// unobstructed, and the lot has to match it.
const measure = (z0, z1) => {
  const out = [];
  for (let z = z0; z <= z1; z += 0.25) {
    let best = 0, run = 0;
    for (let x = ROAD_HALF; x <= FACE; x += 0.02) {
      if (free(x, z)) { run += 0.02; best = Math.max(best, run); } else run = 0;
    }
    out.push([+z.toFixed(2), +best.toFixed(2)]);
  }
  return out;
};
const ctrl = measure(-40, -20);           // east walk, well clear of the lot
const mine = measure(span[0], span[1]);
const med = (a) => { const v = a.map((r) => r[1]).sort((x, y) => x - y); return v[v.length >> 1]; };
const CLEAR = med(ctrl);

console.log(`control  east walk z -40 … -20, no lot: median band ${CLEAR.toFixed(2)} m`);
console.log(`         (that is what unobstructed reads as — the walk is`);
console.log(`          ${ROAD_HALF} … ${FACE} and the rig radius is ${R})`);
console.log(`lot      frontage z ${span[0].toFixed(1)} … ${span[1].toFixed(1)}, ${mine.length} samples every 0.25 m`);
// Name what is doing it, so the result routes itself. Anything overlapping the
// walk is listed with how far it reaches in from the building line — the
// question "is this mine" should not need a second script.
// Overlap the frontage for a real length, not merely touch its ends: the
// buildings north and south of the lot ABUT it, so a tolerance let both in and
// the verdict fired on two neighbours' facades. A shared edge is not an
// encroachment.
const over = (c) => Math.min(c[3], span[1]) - Math.max(c[2], span[0]);
const intruders = cols
  .filter((c) => c[1] > ROAD_HALF && c[0] < FACE && over(c) > 0.05)
  .sort((a, b2) => a[2] - b2[2]);

// WHAT THIS FAILS ON, and it took watching it fail to get right.
//
// It used to exit 1 on any sample narrower than the control, which meant it
// went red on the street tree and the fire hydrant — both correct, both
// somebody else's, and both there to be walked around. A verdict that fires on
// furniture doing its job is the thing GOTCHAS §23 is about: real is not the
// same as wrong.
//
// The question this script exists to answer is narrower: is THE SITE eating
// the pavement? The site can only encroach from the building line — everything
// ct/lot.ts builds is east of x = FACE — while street furniture stands out by
// the kerb. So the verdict is intruders attached to the building line, and
// everything else is reported and walked past.
const SITE_EDGE = FACE - 1.0;
const fromSite = intruders.filter((c) => c[1] >= SITE_EDGE);
const bad = mine.filter((r) => r[1] < CLEAR - 0.05);
const worst = mine.reduce((a, r) => (r[1] < a[1] ? r : a), mine[0]);
console.log(`         narrowest ${worst[1].toFixed(2)} m at z ${worst[0]}`);
if (fromSite.length) {
  console.log(`\n${bad.length} of ${mine.length} samples narrower than the control:`);
  for (const [z, w] of bad.slice(0, 6)) console.log(`   z ${z}  ->  ${w} m   (control ${CLEAR.toFixed(2)})`);
  console.log(`\nATTACHED TO THE BUILDING LINE — the site is taking pavement:`);
  for (const c of fromSite) {
    console.log(`   x ${c[0].toFixed(2)}..${c[1].toFixed(2)}  z ${c[2].toFixed(2)}..${c[3].toFixed(2)}`
      + `   reaches ${(FACE - c[0]).toFixed(2)} m in`);
  }
  process.exit(1);
}
console.log(`\nnothing attached to the building line takes pavement — the site`);
console.log(`does not narrow the walk. Measured against a control, not argued.`);
const kerbside = intruders.filter((c) => c[1] < SITE_EDGE);
if (kerbside.length) {
  console.log(`\nreported, not failed on — kerb-side furniture, which is there to be`);
  console.log(`walked around and is not this module's:`);
  for (const c of kerbside) {
    console.log(`   x ${c[0].toFixed(2)}..${c[1].toFixed(2)}  z ${c[2].toFixed(2)}..${c[3].toFixed(2)}`);
  }
}
if (bad.length) console.log(`\n(${bad.length} of ${mine.length} samples run under the control past those.)`);
