// Item 204 — the trash crate in front of THRIFT. MEASURE BEFORE DEMOLISHING.
//
// Four questions the row's DONE WHEN asks and w74's scoping left open:
//   1. where is every `userData.litter` group, and which is at the thrift door
//   2. does it carry a COLLIDER (item 198 feeds static boxes to crowd avoidance)
//   3. does any `[E]` spot, or the cat, sit on it
//   4. is the 2 m lane clear across the frontage
//
// Anchored on `__ct.spots()` for the door and on `userData.litter` for the
// pieces, so no coordinate here is retyped from source (BUILDER-BRIEF §8).
// The lane maths and the pavement band are lifted from scripts/builtlane.mjs
// (RAD 0.36, walk x -7.0..-5.0, centre-span -> body width) with that file cited
// rather than re-derived.
//
//   SHOT_URL=http://localhost:4330/ node scripts/probes/w77-thrift-crate.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4330/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots !== undefined, { timeout: 30000 });
await p.waitForTimeout(600);

let fails = 0;
const bad = (m) => { fails++; console.log(`  FAIL ${m}`); };
const ok = (m) => console.log(`  OK   ${m}`);

// ── the door, from the world's own registry ──────────────────────────────
const spots = await p.evaluate(() => window.__ct.spots()
  .map((s) => ({ x: s.x, z: s.z, r: s.r, label: s.label })));
if (spots.length < 20) bad(`only ${spots.length} [E] spots — the probe is not measuring the world`);
const door = spots.filter((s) => /thrift/i.test(s.label));
if (!door.length) { console.log('REFUSING TO REPORT: no THRIFT spot in __ct.spots()'); await b.close(); process.exit(3); }
const D = door[0];
console.log(`THRIFT door spot: (${D.x.toFixed(2)}, ${D.z.toFixed(2)}) r ${D.r}  "${D.label}"`);

// ── 1. every litter group in the world ───────────────────────────────────
const pieces = await p.evaluate(() => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (!o.userData?.litter) return;
    out.push({ kind: o.userData.litter, x: o.position.x, y: o.position.y, z: o.position.z,
      yaw: +o.rotation.y.toFixed(3), halfX: o.userData.halfX ?? null });
  });
  return out;
});
// POPULATION FLOOR — "measured nothing" must FAIL.
if (pieces.length < 8) bad(`only ${pieces.length} litter groups found — not measuring the street`);
else ok(`${pieces.length} litter groups carry userData.litter`);

const withD = pieces.map((q) => ({ ...q, d: Math.hypot(q.x - D.x, q.z - D.z) }))
  .sort((a, c) => a.d - c.d);
console.log('\nlitter groups, nearest the THRIFT door first:');
for (const q of withD) console.log(`  ${q.d.toFixed(2).padStart(6)} m  ${q.kind.padEnd(20)} (${q.x.toFixed(2)}, ${q.y.toFixed(3)}, ${q.z.toFixed(2)})  yaw ${q.yaw}`);

const NEAR = 3.0;                       // "in front of the store" — the doorway approach
const atDoor = withD.filter((q) => q.d <= NEAR);
console.log(`\nwithin ${NEAR} m of the door spot: ${atDoor.length}` +
  `${atDoor.length ? ' — ' + atDoor.map((q) => `${q.kind} @ ${q.d.toFixed(2)} m`).join(', ') : ''}`);

// ── 2. does anything at the door carry a COLLIDER? ───────────────────────
const cols = await p.evaluate(() => window.__ct.staticColliders()
  .filter((c) => c && isFinite(c.minX))
  .map((c) => [+c.minX.toFixed(3), +c.maxX.toFixed(3), +c.minZ.toFixed(3), +c.maxZ.toFixed(3)]));
if (cols.length < 50) bad(`only ${cols.length} static colliders — not measuring the world`);
else ok(`${cols.length} static colliders read`);
for (const q of atDoor) {
  const hit = cols.filter((c) => q.x > c[0] - 0.25 && q.x < c[1] + 0.25 &&
                                 q.z > c[2] - 0.25 && q.z < c[3] + 0.25);
  console.log(`  ${q.kind} at (${q.x.toFixed(2)}, ${q.z.toFixed(2)}): ${hit.length} static collider(s) over its centre` +
    `${hit.length ? ' ' + JSON.stringify(hit) : ''}`);
}
// and the crowd's own obstacle list, which is a DIFFERENT array (crosstown.ts:1784)
const avoid = await p.evaluate(() => window.__ct.citAvoid()
  .filter((c) => !c.actor)
  .map((c) => [+c.minX.toFixed(3), +c.maxX.toFixed(3), +c.minZ.toFixed(3), +c.maxZ.toFixed(3)]));
for (const q of atDoor) {
  const hit = avoid.filter((c) => q.x > c[0] - 0.25 && q.x < c[1] + 0.25 &&
                                  q.z > c[2] - 0.25 && q.z < c[3] + 0.25);
  console.log(`  ${q.kind}: ${hit.length} entr(y/ies) in citAvoid (crowd steering) over its centre`);
}

// ── 3. is anything ANCHORED to it? [E] spots, and the cat ────────────────
const spotsNear = spots.filter((s) => atDoor.some((q) => Math.hypot(s.x - q.x, s.z - q.z) < 1.0));
console.log(`\n[E] spots within 1.0 m of a piece at the door: ${spotsNear.length}` +
  `${spotsNear.length ? ' — ' + spotsNear.map((s) => `"${s.label}" (${s.x.toFixed(2)}, ${s.z.toFixed(2)})`).join(' | ') : ''}`);
const cats = await p.evaluate(() => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (/^cat/i.test(o.name || '') || o.userData?.cat) out.push({ n: o.name || '(userData.cat)', x: o.position.x, z: o.position.z });
  });
  return out;
});
console.log(`cat objects found: ${cats.length}` +
  `${cats.length ? ' — ' + cats.map((c) => `${c.n} (${c.x.toFixed(2)}, ${c.z.toFixed(2)})`).join(' | ') : ''}`);
for (const c of cats) {
  const near = withD.map((q) => ({ k: q.kind, d: Math.hypot(c.x - q.x, c.z - q.z) })).sort((a, z) => a.d - z.d)[0];
  console.log(`  ${c.n}: nearest litter is ${near.k} at ${near.d.toFixed(2)} m`);
}

// ── 4. the 2 m lane across the THRIFT frontage ───────────────────────────
// builtlane.mjs's units: `free(x,z)` asks whether a RAD=0.36 capsule CENTRE may
// sit there, so a run of free centres is a CENTRE-SPAN and the body width a
// person passes through is span + 2*RAD. The band is THE PAVEMENT, x -7.0..-5.0
// (ct/rng.ts ROAD_HALF 5.0, WALK 2.0), NOT a wider one — builtlane records that
// a 2.8 m band counted road and building as pavement and failed reassuringly.
const lane = await p.evaluate(([boxes, z0, z1]) => {
  const RAD = 0.36, S = 0.05;
  const free = (x, z) => !boxes.some((c) =>
    x > c[0] - RAD && x < c[1] + RAD && z > c[2] - RAD && z < c[3] + RAD);
  const rows = [];
  for (let z = z0; z >= z1; z -= 0.5) {
    let best = 0, run = 0;
    for (let x = -7.0; x <= -5.0 + 1e-9; x += S) { run = free(x, z) ? run + S : 0; if (run > best) best = run; }
    rows.push({ z: +z.toFixed(1), width: +(best + 2 * RAD).toFixed(2) });
  }
  return rows;
}, [cols, D.z + 7, D.z - 7]);

// THE THRESHOLD IS 0.95, NOT 2.0, AND THAT CORRECTION IS THE POINT.
// "The 2 m sidewalk lane is sacred" is the width of the BAND — ct/rng.ts lays
// the walk at x 5.0..7.0 — not a floor every cross-section must clear. What the
// project actually asserts is ct/gap.ts's PASSABLE = 0.95 m, quoted by
// scripts/builtlane.mjs:68-71 as "0.72 m of capsule plus room to turn", and
// builtlane passes this street at a narrowest 1.12 m. My first version of this
// check demanded 2.00 and went red on a 1.32 m section that the registered
// check calls fine — a probe inventing a stricter rule than the world's own and
// then reporting the world broken. The number is still PRINTED, because a
// narrowing at a shop door is worth seeing; it is just not a failure.
const PASSABLE = 0.95;                  // ct/gap.ts, via scripts/builtlane.mjs:71
if (lane.length < 10) bad(`lane sweep produced ${lane.length} rows — measured nothing`);
else {
  const worst = lane.reduce((a, c) => (c.width < a.width ? c : a));
  console.log(`\nwest-walk body width across the THRIFT frontage (${lane.length} sections, x -7.0..-5.0):`);
  console.log('  ' + lane.map((r) => `z${r.z}:${r.width.toFixed(2)}`).join('  '));
  if (worst.width < PASSABLE) bad(`narrowest body width ${worst.width.toFixed(2)} m at z ${worst.z} — under PASSABLE ${PASSABLE} m`);
  else ok(`narrowest body width ${worst.width.toFixed(2)} m at z ${worst.z} — at or above PASSABLE ${PASSABLE} m`);
  const tight = lane.filter((r) => r.width < 2.0);
  console.log(`  FYI ${tight.length} section(s) under the 2.00 m band width` +
    `${tight.length ? ': ' + tight.map((r) => `${r.width.toFixed(2)} m at z ${r.z}`).join(', ') : ''}`);
}

// ── NEGATIVE CASE: this detector must be able to go red ──────────────────
// If the crate is deleted and the "nothing at the door" verdict were vacuous,
// it would prove nothing. Plant a group tagged like litter at the door and
// require the same traversal to find it.
const canary = await p.evaluate(([dx, dz]) => {
  const sc = window.__ct.scene();
  const g = new sc.constructor();          // a bare Object3D of the same class family
  g.position.set(dx, 0.2, dz + 0.4);
  g.userData.litter = '__canary__';
  sc.add(g);
  let n = 0, atDoor = 0;
  sc.traverse((o) => {
    if (!o.userData?.litter) return;
    n++;
    if (Math.hypot(o.position.x - dx, o.position.z - dz) <= 3.0) atDoor++;
  });
  sc.remove(g);
  return { n, atDoor };
}, [D.x, D.z]);
if (canary.n !== pieces.length + 1 || canary.atDoor < 1)
  bad(`NEGATIVE CASE: planted a canary at the door; traversal saw ${canary.n} pieces (want ${pieces.length + 1}) and ${canary.atDoor} at the door (want >= 1)`);
else ok(`negative case: a piece planted at the door IS seen (${canary.atDoor} at door, ${canary.n} total) — the verdict can go red`);

// ── THE VERDICT the row asks for ────────────────────────────────────────
const crateAtDoor = atDoor.filter((q) => q.kind === 'milk crate');
console.log(`\n  ${crateAtDoor.length ? 'CRATE PRESENT' : 'OK  '} milk crates within ${NEAR} m of the THRIFT door: ${crateAtDoor.length}`);

console.log(`\n${fails ? `FAIL — ${fails} problem(s)` : 'PASS'}   crates at the door: ${crateAtDoor.length}`);
await b.close();
process.exit(fails ? 1 : 0);
