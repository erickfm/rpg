// THE BODEGA CHAMFER, WALKED — the acceptance test for "one rotated collider"
// written BEFORE the rotation exists, so it can be seen to fail first.
//
// The cut face runs A(7,-94) to B(9,-96): a 45 deg line, x + z = CUT. An AABB
// cannot be diagonal, so ct/bodega-corner.ts approximates it with a staircase
// of CHF/BAND = 2.0/0.25 = EIGHT thin bands, each starting at the most
// permissive x in its band.
//
// What that costs a player is not a trap, it is a SAWTOOTH. Press into the cut
// face and walk along it: against a true diagonal your distance to the line
// would be constant (the capsule radius). Against a staircase it oscillates by
// up to one band, because each band lets you in further at its far end than at
// its near end. That oscillation is the thing the user is looking at when he
// says *"its just a bunch of separate rectangles"*.
//
// So this measures the ONE number that distinguishes the two: the spread of the
// player's perpendicular distance to the cut line while hugging it.
//
//   staircase  -> spread ~= BAND (0.25 m), sawtooth, 8 teeth
//   rotated    -> spread ~= 0, flat
//
// PASS/FAIL is deliberately set at half a band. That is not a tuned number: it
// is the midpoint between the two outcomes above, so it cannot be satisfied by
// a staircase with more, smaller boxes either — halving BAND halves the spread
// but also doubles the teeth, and the item says more small boxes fixes nothing.
// Re-run after the chamfer becomes one rotated collider; it must go green.
//
// Usage: SHOT_URL=http://localhost:4193/ node scripts/probes/w18-chamfer-diagonal-walk.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4193/';
const OUT = 'shots/w18-chamfer';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

const fails = [];
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'}  ${m}`); if (!c) fails.push(m); };

// DERIVE THE CUT FROM THE WORLD, never retype it. The staircase bands are the
// only colliders whose minX varies with z in this corner, so the cut line is
// read straight off them: each band contributes (minX + minZ) = CUT.
//
// `maxX - minX > 5` is what separates the wall bands (they all run east to
// 18.4) from the two 0.62 m bollards that stand in front of the corner. Without
// it the bollards join the average and the cut line comes out at -86.78 instead
// of -87.00, which quietly moves every distance below by 0.16 m.
const bands = await page.evaluate(() => window.__ct.colliders()
  .filter((c) => c.minX > 4 && c.minX < 12 && c.minZ > -97 && c.maxZ < -93.5
               && (c.maxX - c.minX) > 5)
  .map((c) => ({ minX: +c.minX.toFixed(3), maxX: +c.maxX.toFixed(3),
                 minZ: +c.minZ.toFixed(3), maxZ: +c.maxZ.toFixed(3) })));
console.log(`colliders in the chamfer corner: ${bands.length}`);
for (const b of bands) console.log(`   x ${b.minX}…${b.maxX}   z ${b.minZ}…${b.maxZ}   (minX+minZ = ${(b.minX + b.minZ).toFixed(2)})`);

const cuts = bands.map((b) => b.minX + b.minZ);
const CUT = cuts.length ? cuts.reduce((a, c) => a + c, 0) / cuts.length : -87;
console.log(`\ncut line: x + z = ${CUT.toFixed(2)}   (from ${bands.length} bands)`);

// THE HEADLINE, and the reason this file exists: how many boxes is the cut?
ok(bands.length === 1, `the chamfer is ONE collider, not a staircase (it is ${bands.length})`);

// ── now walk it ────────────────────────────────────────────────────────────
// Perpendicular distance from (x,z) to the line x + z = CUT.
const perp = (x, z) => (CUT - (x + z)) / Math.SQRT2;

const pos = () => page.evaluate(() => window.__ct.pos());
const warp = (x, z, yaw) => page.evaluate(([X, Z, Y]) => window.__ct.warp(X, Z, Y), [x, z, yaw]);

// Start on the walk outside the cut, at the A (north) end, and travel toward
// B — along the cut is (+1,-1)/sqrt2.
//
// AIM INTO THE WALL, DO NOT STRAFE INTO IT. The first version of this held W
// and D together, which looks like hugging and is not: with yaw at PI/4, W is
// (+0.707,-0.707) and strafe-right is (+0.707,+0.707), so the two cancel in z
// exactly and the player presses into one spot without traversing at all. The
// profile came out perfectly flat and would have read as a PASS on a staircase.
//
// So: one key, and a heading that is mostly along the face with a third of a
// unit into it. The wall cancels the inward part every frame and what is left
// is travel — which is what hugging actually is.
const alongV = [Math.SQRT1_2, -Math.SQRT1_2];
const intoV = [Math.SQRT1_2, Math.SQRT1_2];
const dir = [alongV[0] + 0.35 * intoV[0], alongV[1] + 0.35 * intoV[1]];
const YAW = Math.atan2(dir[0], -dir[1]);   // yaw 0 is -z, +yaw turns toward +x
await warp(6.5, -93.9, YAW);
await page.waitForTimeout(400);
const p0 = await pos();
const startGy = p0[3];
ok(Math.abs(startGy) < 2, `standing on the street outside the bodega (gy ${startGy})`);

const samples = [];
await page.keyboard.down('w');
for (let i = 0; i < 45; i++) {
  await page.waitForTimeout(70);
  const p = await pos();
  samples.push({ x: +p[0].toFixed(3), z: +p[2].toFixed(3), d: +perp(p[0], p[2]).toFixed(3) });
}
await page.keyboard.up('w');
const pEnd = await pos();
// the traverse has to have HAPPENED, or a flat profile means nothing
const travelled = Math.abs(pEnd[2] - p0[2]);
ok(travelled > 1.2, `actually traversed the cut face (moved ${travelled.toFixed(2)} m in z, not pressed into one spot)`);
await page.screenshot({ path: `${OUT}/hugging-the-cut.png` });

// KEEP the traverse shot for looking at, then measure the face PROPERLY.
//
// WHY NOT JUST READ THE HUG PROFILE: because sampling a moving player on a
// wall clock aliases against the bands. Two runs of this same walk gave
// "0.56 0.47 0.55 0.46 0.54 0.45 ..." (a clean 6-tooth sawtooth) and
// "0.57 0.57 0.56 0.56 0.56 0.55 0.65 ..." (one spike), because the player's
// speed and the sample interval are not locked to the 0.25 m band pitch. A
// check that reports a different shape each run cannot be an acceptance test,
// however good its first run looked.
//
// So probe each point INDEPENDENTLY and let the wall, not the sampler, decide:
// stand off the face on its perpendicular, walk straight in until you stop,
// and record how far short of the cut line you stopped. Every point is its own
// little walk, so there is nothing to alias — and it is still walking, which
// is what the row demands.
//
//   one rotated collider -> the same stop distance at every point
//   a staircase          -> it sawtooths, by up to BAND/sqrt2 = 0.177 m
const stops = [];
const IN = [Math.SQRT1_2, Math.SQRT1_2];             // unit vector into the wall
const YAW_IN = Math.atan2(IN[0], -IN[1]);            // = PI/4
// STEP FINELY, AND NOT ON THE BAND PITCH. At a 0.1875 m step this read
// "0.375 0.458 0.375 0.458 …" — a perfect two-phase alias of a 0.25 m band —
// giving a spread of 0.083 and PASSING a wall that is visibly a staircase. The
// sampler was landing on the same two points of every tooth. 0.06 m is a
// quarter of the pitch and shares no factor with it, so the whole tooth gets
// visited and the measured spread is the real one.
for (let t = 0.15; t <= 1.85; t += 0.06) {
  // a point on the cut line, t metres from the A end toward B
  const cx = 7 + t, cz = -94 - t;
  // stand 1.2 m out from it, on the perpendicular, facing in
  await warp(cx - 1.2 * IN[0], cz - 1.2 * IN[1], YAW_IN);
  await page.waitForTimeout(220);
  await page.keyboard.down('w');
  await page.waitForTimeout(900);                    // long enough to close 1.2 m and jam
  await page.keyboard.up('w');
  await page.waitForTimeout(120);
  const q = await pos();
  stops.push({ t: +t.toFixed(2), d: +perp(q[0], q[2]).toFixed(3) });
}
console.log(`\nwalked into the face at ${stops.length} points along it:`);
console.log(`   ${stops.map((s) => s.d.toFixed(3)).join('  ')}`);
const sd = stops.map((s) => s.d);
const spread = Math.max(...sd) - Math.min(...sd);
console.log(`stop distance: min ${Math.min(...sd).toFixed(3)}  max ${Math.max(...sd).toFixed(3)}  SPREAD ${spread.toFixed(3)} m`);
// THE THRESHOLD COMES FROM THE MEASURED SIGNATURE, not from theory.
//
// I first set this at 0.09, reasoning from a staircase's worst case of
// BAND/sqrt2 = 0.177 m. Measured, the staircase does not spread that far: the
// stop distance takes exactly TWO values, 0.375 and 0.458, at all 29 points.
// It is not aliasing — stepping at 0.1875 m and at 0.06 m give the identical
// pair — it is that walking in diagonally always wedges the capsule into a
// step's corner, and there are only two kinds of corner. So the real defect
// signature is 0.083 m, and a 0.09 threshold PASSED the very wall this file
// exists to fail.
//
// A single flat face can only give one stop distance, so its spread is float
// noise, under a centimetre. 0.04 sits between the two with better than 2x
// margin on both sides and is the honest place for the line.
ok(spread < 0.04, `the cut face stops you at the SAME distance everywhere — spread ${spread.toFixed(3)} m (the staircase's signature is 0.083; a flat face gives ~0)`);

if (errors.length) { console.log('page errors:'); for (const e of errors) console.log('  ' + e); }
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED — expected until the chamfer is one rotated collider` : '\nall good');
process.exit(fails.length ? 1 : 0);
