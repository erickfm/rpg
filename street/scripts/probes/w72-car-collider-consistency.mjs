// w72 / ITEM 202c / ITEM 294 — DOES EVERY VEHICLE OF ONE KIND CARRY THE SAME
// COLLIDER?
//
// The user, with the V collision view on: *"truck collision isnt accurate to
// the truck but the other truck is? it seems odd. seems like all trucks should
// be one object that are all the same no?"* and, earlier: *"not all car and
// object collidable boxes are consistent. some cars have full height others are
// aligned with the vehicle."*
//
// ── WHAT CHANGED IN THIS FILE, AND WHY (item 202c) ───────────────────────
//
// w72 wrote this to MEASURE the defect and it did that well: 10 car-shaped
// groups, 1 carrying a `maxY`, 4 carrying none, 5 distinct signatures. Three
// things made it unable to VERIFY the fix, and all three are fixed here:
//
//  1. IT ALWAYS EXITED 0. It printed "1 kind(s) have instances that do NOT
//     agree" and returned success — a check that cannot fail (BUILDER-BRIEF §7).
//     It now exits 1 on every assertion below.
//  2. IT IDENTIFIED VEHICLES BY GEOMETRY, because nothing tagged them. So a
//     car turned off the cardinal axes has a bounding box wider than the
//     `short < 2.5` filter and was DROPPED SILENTLY — the used-car lot's stock
//     sits at 0.55 rad and none of it was ever measured, and neither was the
//     main street's sedan, whose trailer pushes it past the length filter.
//     `makeCar` stamps `userData.carKind` now, so the census is the world's own
//     answer and anything skipped is COUNTED AND NAMED instead of vanishing.
//  3. IT COMPARED WORLD AABBs. Two identical cars parked at 90° to each other
//     have different world boxes and the SAME collider; the question is whether
//     the SHAPE agrees, so extents are compared as (long, short, maxY), which
//     is what a rotation cannot change.
//
// ── AND WHAT CHANGED FOR ITEM 294, WHICH IS MOST OF THE FILE ─────────────
//
// This check was RED ON MAINLINE and its census was counting the wrong cars.
// Two faults, and they were independent of each other.
//
// **(1) THE RULE WAS A TRIPWIRE FOR A CHANGE THAT HAS NOW LANDED.** Rule 4 used
// to say the lot's cars carry *"one box, all identical"* — one blanket
// `x ± 1.4, z ± 2.0` per car whatever kind it was. That was true when it was
// written and item 231 (`ct/lot.ts`, per-kind turned tiers with `AABB.rot`)
// deliberately replaced it. So the check went red for doing its job, and the
// rule it enforced is superseded by the sentence item 231 shipped and the user
// asked for in the first place:
//
//     EVERY KIND HAS ONE SHAPE ACROSS EVERY INSTANCE — street and lot alike.
//
// Rule 3 asks that of all 17 tagged vehicles now, instead of asking it of the
// street and letting the lot answer a weaker question of its own.
//
// **(2) THE CENSUS NAMED THE WRONG POPULATION, and the reason was not the one
// on the queue row.** The row blamed `!r.parts.some(q => q.tag !== '(untagged)')`
// — identifying a lot car as one whose parts are untagged, which item 231's tags
// falsified. True, but that filter selected the TRAFFIC POOL for a second
// reason that would have survived fixing it: **`ct/traffic.ts` parks an idle
// vehicle's collider as a degenerate POINT at (999, 999) — and `IDLE_XZ` moved
// the idle MESH there too (item 242).** So each of the 5 idle pool cars sat
// exactly inside all 20 point-boxes in the world, the `inside` clause handed
// every one of them all 20, and they entered the census as vehicles "on the
// block" carrying twenty untagged 0 x 0 colliders. That is what printed under
// "THE LOT'S 5 CARS".
//
// It also silently killed rule 1. `bare` — vehicles carrying no collider, the
// `ct/lot.ts` hood-up bug that shipped a car you could walk through — went to
// ZERO and could never fire again, because every idle car now "had" twenty.
//
// Measured on this tree before the rewrite: 22 tagged vehicles, 549 colliders,
// 20 degenerate ones at (999, 999), and only **6 of the 20 belong to vehicles at
// all** — `ct/tenancy.ts:1073` and `ct/apartment.ts:313` park their own caps on
// the same sentinel. So "count the vehicles with no collider and compare against
// the number of sentinel boxes" had fourteen boxes of slack in it. It is a
// two-sided statement about the VEHICLES now: idle ⟺ no collider.
//
// THE POPULATION, measured rather than assumed:
//   6 on the street (2 sedan, 2 pickup, 2 hatch) — cardinal
//   11 in the used-car lot (4 sedan, 2 pickup, 3 hatch, 2 van) — turned 24-33°,
//      carrying 23 colliders tagged `<kind>-<surface>@lot<bay>`
//   5 idle in the traffic pool at (999, 999), collider-less by construction
//
// Usage:  SHOT_URL=http://localhost:4181/ node scripts/probes/w72-car-collider-consistency.mjs
//         MUTATE=flatten|stretch|drop|lotshrink ...   the negative cases; each must FAIL
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4370/');
const MUTATE = process.env.MUTATE ?? '';
/** ct/cars.ts's `CAR_SKIN`, the uniform slack every vehicle box carries. Copied
 *  with a citation rather than imported, because this is a browser probe and
 *  that is a TypeScript module the page has already bundled (BUILDER-BRIEF §8's
 *  sanctioned fallback). The tolerance below is 2x it, because the skin is per
 *  SIDE and the comparison is of full extents. */
const CAR_SKIN = 0.15;                       // src/proto/ct/cars.ts, `CAR_SKIN`
/** ct/traffic.ts's `IDLE_XZ` (traffic.ts:221), where a pooled vehicle waits —
 *  MESH and box alike since item 242. Copied with a citation, same reason. */
const IDLE_XZ = 999;
const KINDS = ['sedan', 'hatch', 'pickup', 'van'];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(800);

// ── THE NEGATIVE CASES ───────────────────────────────────────────────────
//
// A green check proves nothing until it has been shown going red for the right
// reason. Each of these breaks ONE of the properties asserted below, in the LIVE
// collider array (GOTCHAS 74: `colliders()` is live by reference,
// `staticColliders()` is a copy and a mutation planted there is read by nobody).
//
// `lotshrink` is item 294's, and it is the runtime twin of the `lot-tier-shrunk`
// case in scripts/canfail.mjs — that one mutates ct/lot.ts in SOURCE and
// restores it byte-for-byte, which is the stronger claim; this one is here so
// the failure can be watched in one line without a source edit.
if (MUTATE) {
  const did = await p.evaluate((mode) => {
    const cols = window.__ct.colliders();
    if (mode === 'flatten') {                        // one truck goes full height again
      const t = cols.find((c) => c.tag === 'pickup-cab-roof@side');
      if (!t) return 'no pickup-cab-roof@side';
      delete t.maxY;
      return 'pickup-cab-roof@side is full height';
    }
    if (mode === 'stretch') {                        // one box outgrows its body
      const t = cols.find((c) => c.tag === 'hatch-body@side');
      if (!t) return 'no hatch-body@side';
      t.maxX += 0.5;
      return 'hatch-body@side is 0.5 m longer than its car';
    }
    if (mode === 'drop') {                           // one car loses its collider
      for (let i = cols.length - 1; i >= 0; i--) {
        if (String(cols[i].tag ?? '').startsWith('sedan-') && String(cols[i].tag).includes('@side')) cols.splice(i, 1);
      }
      return 'the side street sedan has no collider at all';
    }
    if (mode === 'lotshrink') {                      // ONE lot sedan is not its kind's shape
      const bay = cols.filter((c) => /^sedan-.*@lot\d+$/.test(String(c.tag ?? '')));
      if (!bay.length) return 'no sedan boxes in the lot';
      const which = String(bay[0].tag).split('@')[1];
      for (const c of bay.filter((q) => String(q.tag).endsWith(`@${which}`))) {
        const shrink = (c.maxX - c.minX) * 0.1;
        c.minX += shrink; c.maxX -= shrink;
      }
      return `the lot sedan in ${which} is 20% shorter than every other sedan`;
    }
    return `unknown MUTATE=${mode}`;
  }, MUTATE);
  console.log(`\n*** MUTATED: ${did} — this run MUST fail ***`);
}

const census = await p.evaluate(({ IDLE_XZ, KINDS }) => {
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  const cols = window.__ct.colliders();
  const V = scene.position.constructor;

  // ── WHAT COUNTS AS A BOX AT ALL ────────────────────────────────────────
  //
  // A DEGENERATE box is a parking space, not a collider: `ct/traffic.ts`,
  // `ct/tenancy.ts` and `ct/apartment.ts` all park an inactive box as a POINT
  // out at the sentinel. Attributing those to a vehicle is what made every idle
  // pool car look like it carried twenty colliders (item 294).
  const real = cols.filter((c) => c.maxX - c.minX > 0.001 || c.maxZ - c.minZ > 0.001);
  const sentinels = cols.length - real.length;

  const shapeOf = (c) => ({
    tag: String(c.tag ?? '(untagged)').split('@')[0],
    inst: String(c.tag ?? '').includes('@') ? String(c.tag).split('@')[1] : null,
    long: +Math.max(c.maxX - c.minX, c.maxZ - c.minZ).toFixed(3),
    short: +Math.min(c.maxX - c.minX, c.maxZ - c.minZ).toFixed(3),
    maxY: c.maxY === undefined ? null : +c.maxY.toFixed(3),
    cx: (c.minX + c.maxX) / 2, cz: (c.minZ + c.maxZ) / 2,
    minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ,
  });

  // ── THE LOT'S CARS ARE IDENTIFIED BY THE LOT'S OWN LABEL ───────────────
  //
  // `ct/lot.ts:2060` writes `${t.tag}@lot${b}` — the SHAPE is the kind's, the
  // NAME is per bay. So the world says which bay a box belongs to, and the
  // census reads it instead of inferring the lot from what its boxes are NOT.
  // (The old filter was "its parts are untagged", which item 231 falsified and
  // which selected the traffic pool.)
  const bays = new Map();
  for (const c of real) {
    const m = String(c.tag ?? '').match(/@lot(\d+)$/);
    if (m) (bays.get(m[1]) ?? bays.set(m[1], []).get(m[1])).push(shapeOf(c));
  }

  const vehicles = [];
  scene.traverse((o) => {
    const kind = o.userData && o.userData.carKind;
    if (!kind) return;
    // the DRAWN body, in world metres
    let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9, mxy = -1e9;
    o.traverse((m) => {
      if (!m.isMesh || !m.geometry) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox;
      if (!bb) return;
      for (const sx of [bb.min.x, bb.max.x]) {
        for (const sy of [bb.min.y, bb.max.y]) {
          for (const sz of [bb.min.z, bb.max.z]) {
            const w = new V(sx, sy, sz).applyMatrix4(m.matrixWorld);
            mnx = Math.min(mnx, w.x); mxx = Math.max(mxx, w.x);
            mnz = Math.min(mnz, w.z); mxz = Math.max(mxz, w.z);
            mxy = Math.max(mxy, w.y);
          }
        }
      }
    });
    const cx = (mnx + mxx) / 2, cz = (mnz + mxz) / 2;
    // the car's own +z axis in the world, straight off its world matrix — this
    // is how far off a cardinal it is parked, which decides whether the
    // axis-aligned comparison below means anything for it
    const e = o.matrixWorld.elements;
    const zx = e[8], zz = e[10];
    const len = Math.hypot(zx, zz) || 1;
    const offAxis = Math.min(Math.abs(zx / len), Math.abs(zz / len));   // 0 = cardinal
    vehicles.push({
      kind,
      x: +cx.toFixed(2), z: +cz.toFixed(2),
      idle: Math.hypot(cx - IDLE_XZ, cz - IDLE_XZ) < 5,
      bodyLong: +Math.max(mxx - mnx, mxz - mnz).toFixed(2),
      bodyShort: +Math.min(mxx - mnx, mxz - mnz).toFixed(2),
      bodyTop: +mxy.toFixed(2),
      offAxis: +offAxis.toFixed(3),
      bay: null, parts: [],
    });
  });

  // ── ATTRIBUTION, BAY FIRST ─────────────────────────────────────────────
  //
  // Each bay's boxes go to the ONE vehicle nearest their common centre, and the
  // distance is returned so the assertions can require it to be a fit rather
  // than a nearest-of-whatever-there-was. Everything else falls through to the
  // proximity rule the street has always used.
  const bayFit = [];
  for (const [n, boxes] of bays) {
    const bx = boxes.reduce((s, q) => s + q.cx, 0) / boxes.length;
    const bz = boxes.reduce((s, q) => s + q.cz, 0) / boxes.length;
    let best = null, bestD = 1e9;
    for (const v of vehicles) {
      const d = Math.hypot(v.x - bx, v.z - bz);
      if (d < bestD) { bestD = d; best = v; }
    }
    bayFit.push({ bay: n, d: +bestD.toFixed(3), kind: best?.kind ?? null,
      tagKind: boxes[0].tag.split('-')[0], already: best?.bay ?? null });
    if (best) { best.bay = n; best.parts = boxes; }
  }

  const claimed = new Set(bays.size ? [].concat(...[...bays.values()]).map((q) => `${q.tag}@${q.inst}`) : []);
  for (const v of vehicles) {
    if (v.bay) continue;
    // THIS VEHICLE'S OWN COLLIDERS: any box containing its centre, plus any box
    // whose tag names this kind and whose centre is within 4 m of it. The tag
    // clause is what reaches the tiers fore and aft of the centre — quoting only
    // the covering box makes a correctly-tiered vehicle look 2.8 m too SMALL,
    // which is a probe artefact w72 called out and would otherwise be read as a
    // finding. The 4 m radius separates two pickups on two different streets.
    v.parts = real.filter((c) => {
      if (/@lot\d+$/.test(String(c.tag ?? ''))) return false;      // already a bay's
      const inside = v.x > c.minX - 0.05 && v.x < c.maxX + 0.05 && v.z > c.minZ - 0.05 && v.z < c.maxZ + 0.05;
      const bx = (c.minX + c.maxX) / 2, bz = (c.minZ + c.maxZ) / 2;
      const near = String(c.tag ?? '').split('@')[0].startsWith(`${v.kind}-`)
        && Math.hypot(bx - v.x, bz - v.z) < 4;
      return inside || near;
    }).map(shapeOf);
  }

  for (const v of vehicles) {
    v.unionLong = v.parts.length ? +Math.max(
      Math.max(...v.parts.map((c) => c.maxX)) - Math.min(...v.parts.map((c) => c.minX)),
      Math.max(...v.parts.map((c) => c.maxZ)) - Math.min(...v.parts.map((c) => c.minZ))).toFixed(3) : null;
    v.unionShort = v.parts.length ? +Math.min(
      Math.max(...v.parts.map((c) => c.maxX)) - Math.min(...v.parts.map((c) => c.minX)),
      Math.max(...v.parts.map((c) => c.maxZ)) - Math.min(...v.parts.map((c) => c.minZ))).toFixed(3) : null;
    for (const q of v.parts) { delete q.cx; delete q.cz; delete q.minX; delete q.maxX; delete q.minZ; delete q.maxZ; }
  }

  const specs = {};
  for (const k of KINDS) {
    specs[k] = window.__ct.carSpec(k).map((t) => ({
      tag: t.tag,
      long: +Math.max(t.maxX - t.minX, t.maxZ - t.minZ).toFixed(3),
      short: +Math.min(t.maxX - t.minX, t.maxZ - t.minZ).toFixed(3),
      maxY: t.maxY === undefined ? null : +t.maxY.toFixed(3),
    }));
  }
  return { rows: vehicles, sentinels, total: cols.length, bayFit, specs,
    bayBoxes: claimed.size };
}, { IDLE_XZ, KINDS });

const { rows, sentinels, bayFit, specs } = census;
const fails = [];
const shape = (q) => `${q.tag} ${q.long}x${q.short}${q.maxY === null ? ' FULL-HEIGHT' : ` top ${q.maxY}`}`;

// ── 0. POPULATION FLOOR ──────────────────────────────────────────────────
//
// GOTCHAS 34 and this brief's own rule: a probe that found no cars has
// established nothing either way, and a probe that found ONE of a kind cannot
// answer a question about two of them. This world parks 6 cars on the streets,
// stocks 11 bays in the used-car lot and keeps 6 vehicles in the traffic pool,
// so anything under 20 means the census itself broke.
console.log(`\n${rows.length} vehicles carry a carKind tag; `
  + `${census.total} colliders in the world, ${sentinels} of them parked as degenerate`
  + ' points at a sentinel (traffic, tenancy and apartment share that idiom)');
if (rows.length < 20) fails.push(`POPULATION FLOOR: only ${rows.length} tagged vehicles found (expected 20+)`);

const lot = rows.filter((r) => r.bay !== null);
const street = rows.filter((r) => r.bay === null && r.parts.length > 0);
const bare = rows.filter((r) => r.bay === null && r.parts.length === 0);

// ── 1. A VEHICLE HAS A COLLIDER IF AND ONLY IF IT IS OUT OF THE POOL ─────
//
// Not "skip the ones with no collider" — that is how a car with NO COLLIDER AT
// ALL passes, which this world has actually shipped (ct/lot.ts's hood-up car,
// whose `continue` jumped the registration).
//
// BOTH DIRECTIONS, and that is item 294's repair. The old rule compared the
// number of collider-less vehicles against the number of sentinel BOXES, and
// only 6 of the 20 sentinel boxes in this world belong to vehicles at all — so
// it had fourteen boxes of slack, and a real uncollidered car could hide in it.
// A vehicle's own position answers the question exactly: `ct/traffic.ts` parks
// an idle vehicle's MESH at IDLE_XZ as well as its box (item 242).
console.log(`${street.length} on the street, ${lot.length} in the used-car lot,`
  + ` ${bare.length} idle in the pool with no collider`);
for (const r of bare) {
  if (!r.idle) fails.push(`${r.kind} PLACED at ${r.x},${r.z} carries no collider at all`);
}
for (const r of [...street, ...lot]) {
  if (r.idle) fails.push(`${r.kind} is parked at the pool sentinel and still carries ${r.parts.length} collider(s)`);
}
if (!bare.length) fails.push('NOTHING was found idle in the pool — rule 1 measured nothing in either direction');

const axis = (r) => (r.offAxis < 0.12 ? 'axis-aligned' : `turned ${(Math.asin(r.offAxis) * 180 / Math.PI).toFixed(0)}°`);
console.log('\nkind     at (x, z)          body L x S x H       boxes  full-h  union L x S   over    parked        regime');
for (const r of [...rows].sort((a, c) => a.kind.localeCompare(c.kind) || a.x - c.x)) {
  const full = r.parts.filter((q) => q.maxY === null).length;
  const over = r.unionLong === null ? '—' : `${(r.unionLong - r.bodyLong).toFixed(2)}`;
  console.log(`${r.kind.padEnd(8)} ${`${r.x}, ${r.z}`.padEnd(18)}`
    + ` ${`${r.bodyLong} x ${r.bodyShort} x ${r.bodyTop}`.padEnd(20)}`
    + ` ${String(r.parts.length).padStart(5)} ${String(full).padStart(7)}`
    + `  ${String(r.unionLong === null ? '—' : `${r.unionLong} x ${r.unionShort}`).padEnd(13)} ${over.padStart(6)}`
    + `  ${axis(r).padEnd(13)} ${r.bay !== null ? `lot bay ${r.bay}` : r.idle ? 'pool (idle)' : 'street'}`);
}

// ── 2. NO BOX IS MORE THAN THE DECLARED SKIN BIGGER THAN ITS BODY ────────
//
// The skin is 0.15 m per side, so a full extent may exceed the drawn body by
// 0.30 m and no more. Before item 202c the shipped boxes were 0.18-0.29 m
// longer with nothing tying them to the body at all; they are derived from
// `CAR_SPEC` now, so this is what proves the derivation is the right one.
//
// ONLY for vehicles parked on a cardinal. A car turned 31° has a world AABB
// wider than itself by trigonometry, not by anyone's mistake — the lot's stock
// carries TURNED boxes (`AABB.rot`, item 231) whose stored extents are the
// kind's own, so rule 3 judges those exactly and this one does not apply.
console.log('');
const placed = [...street, ...lot];
const cardinal = placed.filter((r) => r.offAxis < 0.12);
const turned = placed.filter((r) => r.offAxis >= 0.12);
for (const r of cardinal) {
  const overL = r.unionLong - r.bodyLong, overS = r.unionShort - r.bodyShort;
  if (overL > 2 * CAR_SKIN + 0.01 || overS > 2 * CAR_SKIN + 0.01) {
    fails.push(`${r.kind} at ${r.x},${r.z}: collider is ${overL.toFixed(2)} m longer and`
      + ` ${overS.toFixed(2)} m wider than its body — the skin allows ${(2 * CAR_SKIN).toFixed(2)}`);
  }
}
console.log(`  ${cardinal.length} vehicles parked on a cardinal axis were size-checked against`
  + ` the ${(2 * CAR_SKIN).toFixed(2)} m skin`);
if (turned.length) {
  console.log(`  ${turned.length} more are parked off-axis (the used-car lot) — a turned car's world`);
  console.log('  AABB is wider than the car by trigonometry, so the size rule does not apply to');
  console.log('  them. THEY ARE NOT SILENTLY SKIPPED: rule 3 holds them to their kind\'s spec');
  console.log('  exactly, which is the stronger statement of the two.');
}
if (cardinal.length < 5) fails.push(`POPULATION FLOOR: only ${cardinal.length} cardinal-parked vehicles to size-check`);

// ── 3. THE QUESTION THE ITEM ASKS: DO TWO OF A KIND AGREE? ───────────────
//
// AGAINST THE KIND'S DECLARED SPEC, NOT AGAINST ANOTHER INSTANCE. Comparing two
// instances goes green the moment both are wrong the same way, and it cannot
// tell a tier that belongs to the KIND from something hitched to one particular
// car — the main street's sedan tows a flatbed, which is a second vehicle and
// deliberately not part of `carColliderSpec('sedan')`. So the world publishes
// the spec (`__ct.carSpec`) and every instance is held to it; anything extra is
// reported as an ATTACHMENT rather than counted as a disagreement.
//
// ⚠ ITEM 294 PUT THE LOT IN THIS POPULATION. There used to be two regimes here
// and a separate, weaker rule for the second one, because `ct/lot.ts` registered
// one blanket box per car whatever kind it was. Item 231 gave every bay its
// kind's real tiers, so there is ONE rule now and it is the user's sentence:
// every kind has one shape across every instance.
console.log('\nDO ALL INSTANCES OF ONE KIND CARRY THE SAME COLLIDER?');
console.log(`(${street.length} on the street and ${lot.length} in the lot, one population,`
  + ' every one built from carColliderSpec)');
const byKind = {};
for (const r of placed) (byKind[r.kind] ??= []).push(r);
let compared = 0;
for (const [k, list] of Object.entries(byKind)) {
  const want = specs[k].map(shape).sort();
  console.log(`  ${k.padEnd(8)} ${String(list.length).padStart(2)} instance(s), against the declared spec:`);
  for (const w of want) console.log(`      spec  ${w}`);
  for (const r of list) {
    compared++;
    const names = new Set(specs[k].map((q) => q.tag));
    const got = r.parts.filter((q) => names.has(q.tag)).map(shape).sort();
    const extra = r.parts.filter((q) => !names.has(q.tag)).map(shape);
    const same = got.length === want.length && got.every((g, i) => g === want[i]);
    console.log(`      ${same ? 'ok  ' : 'MISS'} at ${r.x},${r.z}`.padEnd(28)
      + ` ${r.bay !== null ? `lot bay ${r.bay}` : 'street'}`
      + (same ? '' : `  ← ${got.join(' | ') || '(nothing matching the spec)'}`)
      + (extra.length ? `   + attachment: ${extra.join(' | ')}` : ''));
    if (!same) fails.push(`${k} at ${r.x},${r.z} (${r.bay !== null ? `lot bay ${r.bay}` : 'street'})`
      + ' does not carry its kind\'s declared collider');
  }
}
if (compared < 15) fails.push(`POPULATION FLOOR: only ${compared} placed vehicles compared (expected 15+)`);
if (Object.keys(byKind).length < 4) {
  fails.push(`POPULATION FLOOR: only ${Object.keys(byKind).length} kinds placed (expected all 4)`);
}
// and the shape signature is still printed, because "every kind has exactly one
// shape" is the sentence the user actually wrote
console.log('');
let footprints = 0;
for (const [k, list] of Object.entries(byKind)) {
  const names = new Set(specs[k].map((q) => q.tag));
  const sigs = [...new Set(list.map((r) => r.parts.filter((q) => names.has(q.tag)).map(shape).sort().join(' | ')))];
  footprints += specs[k].length;
  const where = { street: list.filter((r) => r.bay === null).length, lot: list.filter((r) => r.bay !== null).length };
  console.log(`  ${k.padEnd(8)} ${sigs.length} distinct collider shape(s) across ${list.length} instances`
    + ` (${where.street} street, ${where.lot} lot)`);
  if (sigs.length > 1) fails.push(`${k}: ${sigs.length} distinct collider shapes across its instances`);
}
console.log(`  ${footprints} distinct declared footprints across the ${Object.keys(byKind).length} kinds`);

// ── 4. THE LOT'S BAYS: ONE CAR EACH, AND EVERY BOX ON A CAR ──────────────
//
// Rule 3 above already says each lot car carries its kind's shape. This says the
// BOOKKEEPING holds: every `@lot<n>` label found a car, no two bays landed on
// one car, and the boxes sit ON the car rather than merely nearest to it.
// Without this, a bay whose boxes were registered at the wrong coordinates would
// be adopted by whichever car happened to be closest and rule 3 would pass.
console.log(`\nTHE USED-CAR LOT'S ${lot.length} CARS, ONE PER BAY:`);
const byBay = {};
for (const f of bayFit) (byBay[f.kind ?? '(nobody)'] ??= []).push(f);
for (const [k, list] of Object.entries(byBay)) {
  console.log(`  ${k.padEnd(8)} bays ${list.map((f) => f.bay).join(', ')}`
    + `  — worst box-to-car distance ${Math.max(...list.map((f) => f.d)).toFixed(3)} m`);
}
for (const f of bayFit) {
  if (f.kind === null) fails.push(`lot bay ${f.bay}'s boxes belong to no vehicle at all`);
  else if (f.d > 1.0) fails.push(`lot bay ${f.bay}'s boxes sit ${f.d} m from the nearest car — they are not ON it`);
  else if (f.tagKind !== f.kind) fails.push(`lot bay ${f.bay} is tagged ${f.tagKind}- but its car is a ${f.kind}`);
  if (f.already !== null) fails.push(`lot bays ${f.already} and ${f.bay} both landed on one car`);
}
if (bayFit.length !== lot.length) {
  fails.push(`${bayFit.length} lot bays carry boxes but ${lot.length} cars claim one — a bay lost its car`);
}
// FLOOR AND CEILING, both, because a one-sided count is what item 294 was
// warned about: eight would mean three bays lost their colliders, and more bays
// than cars means a box is registered where nothing is parked.
if (lot.length < 8) fails.push(`POPULATION FLOOR: only ${lot.length} cars in the lot (it stocks 11 bays)`);
console.log(`  ${census.bayBoxes} colliders carry a @lot<bay> label across ${bayFit.length} bays`);

console.log('');
if (fails.length) {
  for (const f of fails) console.log(`FAIL: ${f}`);
  console.log(`\n${fails.length} failure(s)`);
} else {
  console.log(`PASS: every kind carries ONE collider shape across all ${compared} placed vehicles`
    + ` — ${street.length} street, ${lot.length} lot — and the ${bare.length} idle pool vehicles`
    + ' carry none, which is what idle means');
}
await b.close();
process.exit(fails.length ? 1 : 0);
