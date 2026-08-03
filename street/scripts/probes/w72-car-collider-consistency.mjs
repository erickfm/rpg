// w72 / ITEM 202c — DOES EVERY VEHICLE OF ONE KIND CARRY THE SAME COLLIDER?
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
// AND THE POOL IS NOT SILENTLY SKIPPED. `ct/traffic.ts` keeps six vehicles in a
// pool and parks each one's collider at x = 999 while it is not on the block.
// Filtering those out by `visible` would be GOTCHAS 79 exactly — so instead
// every vehicle with no collider on it is counted, and that count must EQUAL
// the number of boxes sitting at the sentinel. A street car that lost its
// collider therefore fails this file rather than passing as "idle".
//
// Usage:  SHOT_URL=http://localhost:4370/ node scripts/probes/w72-car-collider-consistency.mjs
//         MUTATE=flatten|stretch|drop ...   the three negative cases; each must FAIL
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
const SENTINEL = 900;                        // ct/traffic.ts parks idle boxes at x 999

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(800);

// ── THE NEGATIVE CASES ───────────────────────────────────────────────────
//
// A green check proves nothing until it has been shown going red for the right
// reason. Each of these breaks ONE of the three properties asserted below, in
// the LIVE collider array (GOTCHAS 74: `colliders()` is live by reference,
// `staticColliders()` is a copy and a mutation planted there is read by nobody).
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
    return `unknown MUTATE=${mode}`;
  }, MUTATE);
  console.log(`\n*** MUTATED: ${did} — this run MUST fail ***`);
}

const census = await p.evaluate((SENTINEL) => {
  const scene = window.__ct.scene();
  scene.updateMatrixWorld(true);
  const cols = window.__ct.colliders();
  const V = scene.position.constructor;
  const out = [];
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
    // THIS VEHICLE'S OWN COLLIDERS: any box containing its centre, plus any box
    // whose tag names this kind and whose centre is within 4 m of it. The tag
    // clause is what reaches the tiers fore and aft of the centre — quoting only
    // the covering box makes a correctly-tiered vehicle look 2.8 m too SMALL,
    // which is a probe artefact w72 called out and would otherwise be read as a
    // finding. The 4 m radius separates two pickups on two different streets.
    const own = cols.filter((c) => {
      const inside = cx > c.minX - 0.05 && cx < c.maxX + 0.05 && cz > c.minZ - 0.05 && cz < c.maxZ + 0.05;
      const bx = (c.minX + c.maxX) / 2, bz = (c.minZ + c.maxZ) / 2;
      const near = String(c.tag ?? '').split('@')[0].startsWith(`${kind}-`)
        && Math.hypot(bx - cx, bz - cz) < 4;
      return inside || near;
    });
    out.push({
      kind,
      x: +cx.toFixed(2), z: +cz.toFixed(2),
      bodyLong: +Math.max(mxx - mnx, mxz - mnz).toFixed(2),
      bodyShort: +Math.min(mxx - mnx, mxz - mnz).toFixed(2),
      bodyTop: +mxy.toFixed(2),
      offAxis: +offAxis.toFixed(3),
      // the SHAPE of each of its boxes, as a rotation cannot change it
      parts: own.map((c) => ({
        tag: String(c.tag ?? '(untagged)').split('@')[0],
        long: +Math.max(c.maxX - c.minX, c.maxZ - c.minZ).toFixed(3),
        short: +Math.min(c.maxX - c.minX, c.maxZ - c.minZ).toFixed(3),
        maxY: c.maxY === undefined ? null : +c.maxY.toFixed(3),
      })),
      // and the union of them, which is the vehicle's real footprint
      unionLong: own.length ? +Math.max(
        Math.max(...own.map((c) => c.maxX)) - Math.min(...own.map((c) => c.minX)),
        Math.max(...own.map((c) => c.maxZ)) - Math.min(...own.map((c) => c.minZ))).toFixed(3) : null,
      unionShort: own.length ? +Math.min(
        Math.max(...own.map((c) => c.maxX)) - Math.min(...own.map((c) => c.minX)),
        Math.max(...own.map((c) => c.maxZ)) - Math.min(...own.map((c) => c.minZ))).toFixed(3) : null,
    });
  });
  // THE POOL'S SENTINEL IS A DEGENERATE BOX AT x 999, not merely a far-east
  // one: the interiors belt sits out past x 600 and 142 real colliders are east
  // of 900, so a plain `minX >= 900` counts rooms as idle vehicles. What the
  // pool parks is a POINT — minX === maxX === 999 — and that is what to count.
  const idle = cols.filter((c) => c.minX >= SENTINEL && c.maxX - c.minX < 0.001
    && c.maxZ - c.minZ < 0.001);
  return { rows: out, sentinels: idle.length, total: cols.length };
}, SENTINEL);

const { rows, sentinels } = census;
const fails = [];

// ── 0. POPULATION FLOOR ──────────────────────────────────────────────────
//
// GOTCHAS 34 and this brief's own rule: a probe that found no cars has
// established nothing either way, and a probe that found ONE of a kind cannot
// answer a question about two of them. This world parks 3 cars on the main
// street, 3 on the side street, keeps 6 in the traffic pool and stocks 13 in
// the lot, so anything under 20 means the census itself broke.
console.log(`\n${rows.length} vehicles carry a carKind tag; `
  + `${census.total} colliders in the world, ${sentinels} of them parked at the pool sentinel`);
if (rows.length < 20) fails.push(`POPULATION FLOOR: only ${rows.length} tagged vehicles found (expected 20+)`);

const onBlock = rows.filter((r) => r.parts.length > 0);
const bare = rows.filter((r) => r.parts.length === 0);
// ── 1. EVERY VEHICLE WITHOUT A COLLIDER IS ONE OF THE POOL'S IDLE ONES ───
//
// Not "skip the ones with no collider" — that is how a car with NO COLLIDER AT
// ALL passes, which this world has actually shipped (ct/lot.ts's hood-up car,
// whose `continue` jumped the registration). The pool parks exactly one box per
// idle vehicle at x 999, so the two counts must match.
console.log(`${onBlock.length} are on the block with colliders; ${bare.length} carry none`);
// The pool builds its six vehicles and never moves them until one is put on a
// route, so an idle one is still at the scene origin — an AUTHORING fact, not
// `visible`, which is GOTCHAS 79's trap. A car that has been PLACED and has no
// collider is the real bug this catches (ct/lot.ts once shipped exactly that:
// its hood-up car's early `continue` jumped the registration and a player could
// walk straight through it).
const placedBare = bare.filter((r) => Math.hypot(r.x, r.z) > 0.5);
if (placedBare.length) {
  for (const r of placedBare) {
    fails.push(`${r.kind} PLACED at ${r.x},${r.z} carries no collider at all`);
  }
}
if (bare.length > sentinels) {
  fails.push(`${bare.length} vehicles have no collider but only ${sentinels} boxes sit at the pool`
    + ' sentinel — more uncollidered vehicles than the pool can account for');
}

const axis = (r) => (r.offAxis < 0.12 ? 'axis-aligned' : `turned ${(Math.asin(r.offAxis) * 180 / Math.PI).toFixed(0)}°`);
console.log('\nkind     at (x, z)          body L x S x H       boxes  full-h  union L x S   over    parked');
for (const r of [...rows].sort((a, c) => a.kind.localeCompare(c.kind) || a.x - c.x)) {
  const full = r.parts.filter((q) => q.maxY === null).length;
  const over = r.unionLong === null ? '—' : `${(r.unionLong - r.bodyLong).toFixed(2)}`;
  console.log(`${r.kind.padEnd(8)} ${`${r.x}, ${r.z}`.padEnd(18)}`
    + ` ${`${r.bodyLong} x ${r.bodyShort} x ${r.bodyTop}`.padEnd(20)}`
    + ` ${String(r.parts.length).padStart(5)} ${String(full).padStart(7)}`
    + `  ${String(r.unionLong === null ? '—' : `${r.unionLong} x ${r.unionShort}`).padEnd(13)} ${over.padStart(6)}`
    + `  ${axis(r)}`);
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
// is reported below rather than judged by a rule that does not apply to it.
console.log('');
const cardinal = onBlock.filter((r) => r.offAxis < 0.12);
const turned = onBlock.filter((r) => r.offAxis >= 0.12);
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
  console.log('  them. THEY ARE NOT SILENTLY SKIPPED: they are counted, and rule 3 still holds.');
}
if (cardinal.length < 5) fails.push(`POPULATION FLOOR: only ${cardinal.length} cardinal-parked vehicles to size-check`);

// ── 3. THE QUESTION THE ITEM ASKS: DO TWO OF A KIND AGREE? ───────────────
//
// Compared as SHAPE — the sorted list of (surface name, long, short, maxY) —
// because that is what a rotation cannot change and what "all trucks should be
// one object that are all the same" actually means. The `@side` instance label
// is stripped off the tag first: two physical surfaces must not answer to one
// name (the acceptance walks look them up by it), but the surfaces they name
// are the same surface of the same kind of car.
const sig = (r) => r.parts
  .map((q) => `${q.tag} ${q.long}x${q.short}${q.maxY === null ? ' FULL-HEIGHT' : ` top ${q.maxY}`}`)
  .sort().join(' | ');
//
// ── AND THERE ARE TWO COLLIDER REGIMES IN THIS WORLD, NOT ONE ────────────
//
// Split by MECHANISM, not by convenience: a vehicle whose boxes carry its
// kind's tags was built by `carColliderSpec` in ct/cars.ts, which is what item
// 202c is about. A vehicle carrying one untagged box was built by
// `ct/lot.ts:1986`, which registers `x ± 1.4, z ± 2.0` for every car in the
// used-car lot whatever kind it is and whatever angle it sits at.
//
// THAT SECOND REGIME IS A REAL, UNFIXED FINDING AND IT IS NOT BEING SKIPPED
// HERE. It is measured, named, counted, and held to its own rule below. It was
// left alone deliberately, with the numbers, in notes/w81-item202c-car-
// colliders.md: the lot's box is SMALLER than the car it wraps on purpose — the
// source says so at ct/lot.ts:1980, *"deliberately tighter than the true
// footprint: you can brush a wing, and in exchange the 6.8 m you can see down
// stays 6.8 m you can walk down"* — so adopting the street's spec there trades
// collider accuracy for aisle width, which is a decision with a playtest in it
// and not a refactor.
const street = onBlock.filter((r) => r.parts.some((q) => q.tag !== '(untagged)'));
const lot = onBlock.filter((r) => !r.parts.some((q) => q.tag !== '(untagged)'));

console.log('\nDO TWO INSTANCES OF ONE KIND CARRY THE SAME COLLIDER?');
console.log(`(street regime: ${street.length} vehicles built by carColliderSpec.`
  + `  lot regime: ${lot.length} built by ct/lot.ts's own box — held to rule 4.)`);
//
// AGAINST THE KIND'S DECLARED SPEC, NOT AGAINST ANOTHER INSTANCE. Comparing two
// instances goes green the moment both are wrong the same way, and it cannot
// tell a tier that belongs to the KIND from something hitched to one particular
// car — the main street's sedan tows a flatbed, which is a second vehicle and
// deliberately not part of `carColliderSpec('sedan')`. So the world publishes
// the spec (`__ct.carSpec`) and every instance is held to it; anything extra is
// reported as an ATTACHMENT rather than counted as a disagreement.
const specs = await p.evaluate(() => {
  const out = {};
  for (const k of ['sedan', 'hatch', 'pickup', 'van']) {
    out[k] = window.__ct.carSpec(k).map((t) => ({
      tag: t.tag,
      long: +Math.max(t.maxX - t.minX, t.maxZ - t.minZ).toFixed(3),
      short: +Math.min(t.maxX - t.minX, t.maxZ - t.minZ).toFixed(3),
      maxY: t.maxY === undefined ? null : +t.maxY.toFixed(3),
    }));
  }
  return out;
});
const shape = (q) => `${q.tag} ${q.long}x${q.short}${q.maxY === null ? ' FULL-HEIGHT' : ` top ${q.maxY}`}`;
const byKind = {};
for (const r of street) (byKind[r.kind] ??= []).push(r);
let compared = 0;
for (const [k, list] of Object.entries(byKind)) {
  const want = specs[k].map(shape).sort();
  console.log(`  ${k.padEnd(8)} ${String(list.length).padStart(2)} on a street, against the declared spec:`);
  for (const w of want) console.log(`      spec  ${w}`);
  for (const r of list) {
    compared++;
    const names = new Set(specs[k].map((q) => q.tag));
    const got = r.parts.filter((q) => names.has(q.tag)).map(shape).sort();
    const extra = r.parts.filter((q) => !names.has(q.tag)).map(shape);
    const same = got.length === want.length && got.every((g, i) => g === want[i]);
    console.log(`      ${same ? 'ok  ' : 'MISS'} at ${r.x},${r.z}`
      + (same ? '' : `  ← ${got.join(' | ') || '(nothing matching the spec)'}`)
      + (extra.length ? `   + attachment: ${extra.join(' | ')}` : ''));
    if (!same) fails.push(`${k} at ${r.x},${r.z} does not carry its kind's declared collider`);
  }
}
if (compared < 5) fails.push(`POPULATION FLOOR: only ${compared} street vehicles compared`);
if (Object.keys(byKind).length < 3) {
  fails.push(`POPULATION FLOOR: only ${Object.keys(byKind).length} kinds on a street (expected 3+)`);
}
// and the shape signature is still printed, because "every kind has exactly one
// shape on the street" is the sentence the user actually wrote
for (const [k, list] of Object.entries(byKind)) {
  const names = new Set(specs[k].map((q) => q.tag));
  const sigs = [...new Set(list.map((r) => r.parts.filter((q) => names.has(q.tag)).map(shape).sort().join(' | ')))];
  console.log(`  ${k.padEnd(8)} ${sigs.length} distinct collider shape(s) across ${list.length} instances`);
  if (sigs.length > 1) fails.push(`${k}: ${sigs.length} distinct collider shapes on the street`);
}

// ── 4. AND THE LOT'S OWN REGIME MUST BE INTERNALLY CONSISTENT ────────────
//
// One box per car, and every one of them the same box. That is what ct/lot.ts
// intends today; stating it here means the lot drifting — a bay that forgets
// its collider, or one car given a different size — fails this file rather than
// hiding inside "the lot is different anyway".
console.log(`\nAND THE LOT'S ${lot.length} CARS, BY THEIR OWN RULE (one box, all identical):`);
const lotSigs = [...new Set(lot.map(sig))];
for (const s of lotSigs) console.log(`  ${s}   × ${lot.filter((r) => sig(r) === s).length}`);
if (lot.length && lotSigs.length > 1) {
  fails.push(`the lot's cars carry ${lotSigs.length} different boxes — its own rule is one`);
}
if (lot.some((r) => r.parts.length !== 1)) {
  fails.push('a lot car carries more or fewer than the one box ct/lot.ts registers');
}
console.log('  ⚠ every one of them is FULL HEIGHT and the same size whatever kind of car it is,');
console.log('    which is the other half of the user\'s sentence and is NOT fixed. See');
console.log('    notes/w81-item202c-car-colliders.md — measured, scoped, and handed back.');

console.log('');
if (fails.length) {
  for (const f of fails) console.log(`FAIL: ${f}`);
  console.log(`\n${fails.length} failure(s)`);
} else {
  console.log(`PASS: every kind carries ONE collider shape across all ${compared} vehicles on the`
    + ` block; ${bare.length} idle pool vehicles accounted for against ${sentinels} sentinel boxes`);
}
await b.close();
process.exit(fails.length ? 1 : 0);
