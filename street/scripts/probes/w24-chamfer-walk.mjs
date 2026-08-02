// ITEM 36's ACCEPTANCE TEST — the bodega's 45-degree chamfer as ONE collider.
//
// *"whats going on with the collision geometry here? we should fix this so its
//  not just a bunch of separate rectangles and its just made properly."*
//
// Four measurements, none of them a screenshot:
//
//   1. HOW MANY BOXES the corner is made of.
//   2. THE FACE PROFILE — walk straight INTO the cut face at stations along it
//      and record where you stop. This traces the collision surface the player
//      actually feels. One flat wall gives a CONSTANT stop distance; a
//      staircase of axis-aligned bands gives a saw, because each band's padded
//      west face sits at its own distance from the true 45-degree cut.
//   3. RED IN THE V OVERLAY — `ct/gap.ts`'s own `trapAgainst`, the same
//      function `ct/debug-collision.ts` colours boxes with, run over the same
//      live collider array. Not a re-implementation of the rule.
//   4. WALKING THE DIAGONAL — cut the corner south-east past the bay, and hug
//      the face aimed into it, and report any frame that made no progress.
//
// Everything geometric comes from ct/bodega-corner.ts's own published `BAY`,
// pulled out of the live dev module graph rather than hand-typed — BUILDER-
// BRIEF §8, and `BAY`'s own comment exists because that copy has been made
// wrong before.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w24-chamfer-walk.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4210/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const bay = await p.evaluate(async () => {
  try { return (await import('/src/proto/ct/bodega-corner.ts')).BAY; } catch { return null; }
});
if (!bay) { console.log('FAIL: could not read BAY from the live module graph'); await b.close(); process.exit(1); }
const A = bay.a, B = bay.b, CUT = A.x + A.z, FW = bay.faceWidth;
console.log(`BAY  a (${A.x}, ${A.z})  b (${B.x}, ${B.z})  cut x+z = ${CUT}  faceWidth ${FW.toFixed(3)}`);

const S2 = Math.SQRT2;
// The void the corner is cut into is x + z <= CUT, so a player on the pavement
// in front of the bay reads POSITIVE `perp`. `along` runs a -> b.
const perp = (x, z) => (CUT - x - z) / S2;
const along = (x, z) => ((x - A.x) - (z - A.z)) / S2;
const at = (a, s) => ({                       // a point on the face's frame
  x: A.x + a / S2 - s / S2,
  z: A.z - a / S2 - s / S2,
});
const pos = () => p.evaluate(() => window.__ct.pos());
const warp = (x, z, yaw) => p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0, 0), [x, z, yaw]);

let bad = 0;
const fail = (m) => { bad++; console.log(`FAIL  ${m}`); };
const pass = (m) => console.log(`ok    ${m}`);

// ── 1. how many boxes is the corner made of ───────────────────────────────
const near = await p.evaluate(([ax, az, bx, bz]) => {
  const lo = { x: Math.min(ax, bx) - 0.6, z: Math.min(az, bz) - 0.6 };
  const hi = { x: Math.max(ax, bx) + 0.6, z: Math.max(az, bz) + 0.6 };
  // a rotated box's own min/max are in ITS frame, so compare on its centre
  return window.__ct.colliders().filter((c) => {
    const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
    const rx = (c.maxX - c.minX) / 2 + (c.maxZ - c.minZ) / 2;
    return cx + rx > lo.x && cx - rx < hi.x && cz + rx > lo.z && cz - rx < hi.z;
  });
}, [A.x, A.z, B.x, B.z]);
console.log(`\n── 1. boxes overlapping the corner: ${near.length} ──`);
for (const c of near) {
  console.log('   ', ['minX', 'maxX', 'minZ', 'maxZ'].map((k) => `${k} ${c[k].toFixed(3)}`).join('  '),
    c.rot !== undefined ? `ROT ${c.rot.toFixed(4)}` : '');
}
const rotated = near.filter((c) => c.rot !== undefined && Math.abs(c.rot) > 1e-9);
if (rotated.length === 1) pass(`the chamfer is ONE rotated collider (rot ${rotated[0].rot.toFixed(4)})`);
else fail(`expected exactly 1 rotated collider at the corner, found ${rotated.length}`);

// ── 2. the face profile ────────────────────────────────────────────────────
// Stand 1.2 m out from the face at each station, aim along the INWARD normal,
// and walk until stopped. `fwd = (sin yaw, 0, -cos yaw)`; the inward normal is
// (+1, +1)/sqrt2, so sin yaw = +1/sqrt2 and cos yaw = -1/sqrt2 -> yaw = 3PI/4.
console.log('\n── 2. face profile: where you stop, walking into the cut ──');
const IN_YAW = (3 * Math.PI) / 4;
const stops = [];
for (let a = 0.25; a <= FW - 0.2; a += 0.15) {
  const from = at(a, 1.25);
  await warp(from.x, from.z, IN_YAW);
  await p.waitForTimeout(120);
  await p.keyboard.down('w');
  await p.waitForTimeout(700);          // 3.2 m/s x 0.7 s = 2.2 m, ample for 1.25 m
  await p.keyboard.up('w');
  await p.waitForTimeout(120);
  const [x, , z] = await pos();
  stops.push({ a, s: perp(x, z), x, z });
}
for (const r of stops) console.log(`   along ${r.a.toFixed(2)}   stopped at perp ${r.s.toFixed(3)}`);
const sv = stops.map((r) => r.s);
const smin = Math.min(...sv), smax = Math.max(...sv), saw = smax - smin;
console.log(`   stop distance  min ${smin.toFixed(3)}  max ${smax.toFixed(3)}  SAW ${saw.toFixed(3)} m`);
// One flat wall padded by the player's own RADIUS stops you at a constant
// distance. 40 mm of slack absorbs the sampling (one 16 ms frame at 3.2 m/s is
// 51 mm of travel, of which 36 mm is perpendicular) without admitting a step:
// the staircase's own step is BAND/sqrt2 = 177 mm, four times larger.
if (saw < 0.04) pass(`the face is FLAT to within ${(saw * 1000).toFixed(0)} mm`);
else fail(`the face still steps: ${(saw * 1000).toFixed(0)} mm between the nearest and furthest stop`);

// ── 3. red in the V overlay ────────────────────────────────────────────────
console.log('\n── 3. trapAgainst (what the V overlay paints red) ──');
const red = await p.evaluate(async ([ax, az, bx, bz]) => {
  const { trapAgainst } = await import('/src/proto/ct/gap.ts');
  const cols = window.__ct.colliders();
  const lo = { x: Math.min(ax, bx) - 0.6, z: Math.min(az, bz) - 0.6 };
  const hi = { x: Math.max(ax, bx) + 0.6, z: Math.max(az, bz) + 0.6 };
  const out = [];
  for (const c of cols) {
    const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
    const rx = (c.maxX - c.minX) / 2 + (c.maxZ - c.minZ) / 2;
    if (!(cx + rx > lo.x && cx - rx < hi.x && cz + rx > lo.z && cz - rx < hi.z)) continue;
    const w = trapAgainst(c, cols);
    if (w !== null) out.push({ c, w });
  }
  return { atCorner: out, worldRed: cols.filter((c) => trapAgainst(c, cols) !== null).length, total: cols.length };
}, [A.x, A.z, B.x, B.z]);
console.log(`   red at the corner: ${red.atCorner.length}   red world-wide: ${red.worldRed} of ${red.total}`);
for (const r of red.atCorner) console.log(`      ${JSON.stringify(r.c)}  gap ${r.w.toFixed(3)}`);
if (red.atCorner.length === 0) pass('no red along the chamfer');
else fail(`${red.atCorner.length} red box(es) along the chamfer`);

/** Hold `keys`, sampling the track. */
async function walk(keys, ms, step = 65) {
  for (const k of keys) await p.keyboard.down(k);
  const out = [];
  for (let t = 0; t < ms; t += step) {
    await p.waitForTimeout(step);
    const [x, , z] = await pos();
    out.push({ t, x, z, s: perp(x, z), a: along(x, z) });
  }
  for (const k of keys) await p.keyboard.up(k);
  return out;
}
const stalls = (tr) => {
  let n = 0;
  for (let i = 1; i < tr.length; i++) if (Math.hypot(tr[i].x - tr[i - 1].x, tr[i].z - tr[i - 1].z) < 0.01) n++;
  return n;
};

// ── 4a. cut the corner ─────────────────────────────────────────────────────
console.log('\n── 4a. walk the diagonal: cut the corner south-east past the bay ──');
const YAW = Math.PI / 4;    // fwd = (+1, -1)/sqrt2, the a -> b tangent
await warp(A.x - 1.1, A.z + 1.3, YAW);
await p.waitForTimeout(300);
const leg1 = await walk(['w'], 2600);
const e1 = leg1[leg1.length - 1];
console.log(`   ended x ${e1.x.toFixed(2)} z ${e1.z.toFixed(2)}, along ${e1.a.toFixed(2)} of ${FW.toFixed(2)} m`);
console.log(`   frames that moved under 10 mm: ${stalls(leg1)} of ${leg1.length - 1}`);
if (e1.a > FW && stalls(leg1) === 0) pass('cleared the corner without catching');
else fail(`did not clear cleanly (along ${e1.a.toFixed(2)}, ${stalls(leg1)} stalled frames)`);

// ── 4b. hug the face ───────────────────────────────────────────────────────
// Aimed 20 degrees INTO the wall: a flat wall converts that into a steady slide
// at a constant offset, a staircase cannot. NOT W+D — at this yaw `fwd` and
// `right` sum to due EAST, so W+D is a push into the wall, not a hug, and the
// first draft of this probe measured a stall that was entirely its own doing.
console.log('\n── 4b. walk the diagonal: hug the face, aimed 20 degrees into it ──');
await warp(A.x - 0.75, A.z - 0.75, YAW + 0.35);
await p.waitForTimeout(300);
const leg2 = await walk(['w'], 2600);
const on = leg2.filter((r) => r.a > 0.2 && r.a < FW - 0.2 && r.s < 0.75);
console.log(`   ${on.length} samples in contact alongside the face`);
for (const r of on) console.log(`      along ${r.a.toFixed(3)}  perp ${r.s.toFixed(3)}`);
console.log(`   frames that moved under 10 mm: ${stalls(leg2)} of ${leg2.length - 1}`);
if (on.length >= 3) {
  const hs = on.map((r) => r.s);
  const hsaw = Math.max(...hs) - Math.min(...hs);
  console.log(`   perpendicular offset while hugging  min ${Math.min(...hs).toFixed(3)}  max ${Math.max(...hs).toFixed(3)}  SAW ${hsaw.toFixed(3)} m`);
  if (hsaw < 0.06) pass(`slides along the face at a steady offset (${(hsaw * 1000).toFixed(0)} mm of wobble)`);
  else fail(`the slide is a ratchet: ${(hsaw * 1000).toFixed(0)} mm of in-and-out along the face`);
}
if (stalls(leg2) === 0) pass('no stalled frames while hugging'); else fail(`${stalls(leg2)} stalled frames while hugging`);

console.log('\nconsole errors:', errs.length ? errs : 'none');
console.log(bad === 0 ? '\nALL CHECKS PASS' : `\n${bad} CHECK(S) FAILED`);
await b.close();
process.exit(bad === 0 ? 0 : 1);
