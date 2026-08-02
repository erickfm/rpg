// ITEM 57'S ACCEPTANCE TEST — the "0.45 m trap" on the east walk, WALKED.
//
// The item says a PROP at x 5.75…6.25 sits 0.45 m off a block face at x 6.70.
// w30-trap57-locate/-repro/-045 established there is no prop: the 0.5 x 0.5 box
// is a CITIZEN (ct/crowd.ts:167 gives lane +/- 0.25; :159 puts the east home
// lane at exactly 6.00), and 0.45 is that citizen against the ONE east face at
// minX 6.700, which spans z -94…-86. So the question a walk has to answer is
// not "is the prop moved" but "can a citizen standing there wall the player in".
//
// Two walks, because they fail differently:
//   A. TRAVERSAL — walk the corridor through the band, both directions. A
//      static obstruction stops every run at the same z.
//   B. THE WEDGE — drive the player INTO a citizen inside the band, from the
//      wall side and the kerb side, and then check he can still move. "Stuck"
//      means moving NOWHERE, not "blocked in the direction I was holding":
//      w22 lost an item to that distinction, so all four directions are tried.
//
// Only W is ever held. Holding W+D at yaw pi/4 sums to due east and would
// measure a stall the test caused itself (BUILDER-BRIEF §7).
//
// Usage: SHOT_URL=http://localhost:4193/ node scripts/probes/w30-trap57-walk.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4193/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const pos = () => p.evaluate(() => window.__ct.pos());
const warp = (x, z, yaw) => p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0, 0), [x, z, yaw]);
const walkers = () => p.evaluate(() => window.__ct.walkers().filter((k) => k.x > 0));

// fp.ts:477 — fwd = (sin yaw, -cos yaw). yaw 0 walks toward -z, yaw pi toward +z.
const SOUTH = 0, NORTH = Math.PI;
// The band the single 6.700 face spans, read off the live collider set rather
// than typed here, so a moved wall cannot leave this probe measuring nowhere.
const FACE = await p.evaluate(() => {
  const c = window.__ct.colliders().find((k) => Math.abs(k.minX - 6.70) < 1e-6
    && k.maxX - k.minX > 1 && k.minZ > -100 && k.maxZ < 0);
  return c ? { minZ: c.minZ, maxZ: c.maxZ, minX: c.minX } : null;
});
if (!FACE) { console.log('FAIL: no 6.70 face found — the world moved, retarget this probe'); await b.close(); process.exit(1); }
console.log(`the 6.700 face: z[${FACE.minZ}, ${FACE.maxZ}]  (this is the band item 57 is about)`);

let bad = 0;
const fail = (m) => { bad++; console.log(`FAIL  ${m}`); };
const pass = (m) => console.log(`ok    ${m}`);

const hold = async (key, ms) => {
  await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key);
};

// ── A. TRAVERSAL ───────────────────────────────────────────────────────────
console.log('\n── A. walk the east pavement through the band, both directions ──');
const LANE = 6.0;
const runs = [];
for (let i = 0; i < 4; i++) {
  for (const [name, from, to, yaw] of [
    ['southbound', FACE.maxZ + 6, FACE.minZ - 4, SOUTH],
    ['northbound', FACE.minZ - 6, FACE.maxZ + 4, NORTH],
  ]) {
    await warp(LANE, from, yaw);
    await p.waitForTimeout(150);
    const track = [];
    await p.keyboard.down('w');
    for (let t = 0; t < 30; t++) {           // 30 x 200 ms = 6 s, ~19 m at 3.2 m/s
      await p.waitForTimeout(200);
      const [x, , z] = await pos();
      track.push({ x, z });
    }
    await p.keyboard.up('w');
    const end = track[track.length - 1];
    const crossed = yaw === SOUTH ? end.z < FACE.minZ : end.z > FACE.maxZ;
    // where did it spend the longest without moving?
    let worst = 0, worstAt = null;
    for (let k = 1; k < track.length; k++) {
      const d = Math.hypot(track[k].x - track[k - 1].x, track[k].z - track[k - 1].z);
      if (d < 0.05) { worst++; worstAt = track[k]; } else worst = 0;
    }
    runs.push({ name, crossed, endZ: end.z, endX: end.x, stallFrames: worst, worstAt });
    console.log(`   run ${i}/${name}: from z ${from.toFixed(1)} -> ended `
      + `(${end.x.toFixed(2)}, ${end.z.toFixed(2)})  crossed=${crossed}`
      + (worst ? `  trailing stall ${worst} samples at z ${worstAt.z.toFixed(2)}` : ''));
  }
}
const failedRuns = runs.filter((r) => !r.crossed);
if (failedRuns.length === 0) pass(`all ${runs.length} traversals crossed the band`);
else fail(`${failedRuns.length}/${runs.length} traversals did NOT cross`
  + ` — ended at z ${failedRuns.map((r) => r.endZ.toFixed(2)).join(', ')}`);

// ── B. THE WEDGE ───────────────────────────────────────────────────────────
console.log('\n── B. drive the player INTO a citizen inside the band ──');
// "can he still move" — try all four keys from where he ends up, and call it
// stuck only if NONE of them moves him. A blocked direction is not a trap.
async function canMove() {
  const moved = [];
  for (const k of ['w', 'a', 's', 'd']) {
    const [x0, , z0] = await pos();
    await hold(k, 260);
    await p.waitForTimeout(90);
    const [x1, , z1] = await pos();
    moved.push({ k, d: Math.hypot(x1 - x0, z1 - z0) });
  }
  return moved;
}

let wedges = 0, trapped = 0;
for (let attempt = 0; attempt < 40 && wedges < 6; attempt++) {
  const ws = await walkers();
  const c = ws.find((k) => k.z >= FACE.minZ && k.z <= FACE.maxZ);
  if (!c) { await p.waitForTimeout(500); continue; }
  // stand 1.6 m up-street of him in the corridor and walk straight at him
  const yaw = c.z < -90 ? SOUTH : NORTH;
  const startZ = yaw === SOUTH ? c.z + 1.6 : c.z - 1.6;
  await warp(LANE, startZ, yaw);
  await p.waitForTimeout(150);
  const [, , z0] = await pos();
  await hold('w', 2600);                 // long enough to pass the 1.4 s ghost timer
  await p.waitForTimeout(120);
  const [x1, , z1] = await pos();
  const progress = Math.abs(z1 - z0);
  const moves = await canMove();
  const free = moves.filter((m) => m.d > 0.05);
  wedges++;
  const stuck = free.length === 0;
  if (stuck) trapped++;
  console.log(`   wedge ${wedges}: citizen at z ${c.z.toFixed(2)}  ghost=${c.ghost}`
    + `  player moved ${progress.toFixed(2)} m -> (${x1.toFixed(2)}, ${z1.toFixed(2)})`
    + `  free dirs ${free.length}/4 [${moves.map((m) => m.k + ':' + m.d.toFixed(2)).join(' ')}]`);
}
if (wedges === 0) fail('never caught a citizen inside the band — inconclusive, rerun');
else if (trapped === 0) pass(`${wedges} wedges against a citizen in the band, 0 left the player stuck`);
else fail(`${trapped}/${wedges} wedges left the player unable to move in ANY direction`);

console.log(`\nconsole errors: ${errs.length}${errs.length ? ' — ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(bad ? `\n${bad} FAIL` : '\nALL PASS');
await b.close();
process.exit(bad ? 1 : 0);
