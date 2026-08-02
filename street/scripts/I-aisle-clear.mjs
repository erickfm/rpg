// IS ANYTHING STANDING IN THE AISLE, OR IN THE VIEW DOWN IT?
//
// The user: *"the aisle a customer walks down and the sight line into the lot
// from the entrance are the two things that must stay clear; a post can go
// almost anywhere else."* That came from a frame with one of MY festoon masts
// straight up the middle of it.
//
// ── why the checks I already had did not catch it ──
//
// `I-clip` asks whether anything OVERLAPS anything. The mast overlapped
// nothing — I had measured it at 0.88 m clear of the nearest car and been
// pleased with that. `lotwalk` asks whether a pedestrian can get in, and you
// could: you walked round it. `gaps` asks whether a parked car can trap you.
//
// **Standing in somebody's way is not a collision and standing in somebody's
// view is not either.** Every check I owned was about contact, so a post in the
// middle of the drive was invisible to all of them and visible to the user
// immediately. This is the check for the thing they actually complained about.
//
// Two clauses:
//   1. THE WALKING ROUTE — nothing solid inside the aisle band between the
//      gate and the office. Not "you can get past it"; not there at all.
//   2. THE SIGHT LINE — standing in the gate at eye height, looking down the
//      centreline at the office, nothing intercepts the ray. That is the shot
//      the lot sells itself with.
//
// Usage: SHOT_URL=http://127.0.0.1:4191/ node scripts/I-aisle-clear.mjs
//        --selftest   put a post back where mine was, require this to go red
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { flags } from './lib/args.mjs';

const ARGS = flags(['--selftest']);
const URL = aim('http://127.0.0.1:4191/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);

if (ARGS.selftest) {
  // exactly where mine stood: 0.2 m inside the aisle edge, in front of the office
  await p.evaluate(() => {
    window.__ct.colliders().push({ minX: 23.58, maxX: 23.82, minZ: 5.68, maxZ: 5.92 });
  });
  console.log('  SELFTEST: put a post back at (23.7, 5.8) — 0.2 m inside the aisle edge,');
  console.log('  which is where mine stood. This must go red.\n');
}

const world = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  // the lot's own extent and its aisle, asked rather than remembered
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, office = null;
  s.traverse((o) => {
    if (!o.isMesh) return;
    let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
    if (mod !== 'lot') return;
    const e = o.matrixWorld.elements;
    x0 = Math.min(x0, e[12]); x1 = Math.max(x1, e[12]);
    z0 = Math.min(z0, e[14]); z1 = Math.max(z1, e[14]);
    const g = o.geometry?.parameters;
    if (g && Math.abs(g.width - 3.0) < 0.01 && Math.abs(g.height - 2.7) < 0.01
          && Math.abs(g.depth - 4.6) < 0.01) office = [e[12], e[14]];
  });
  // WHERE THE STOCK IS. A parked car standing in its own bay is not an
  // obstruction, so the cars are found and their colliders excused by name --
  // rather than by narrowing the band, which is what I did first and which
  // made the check blind to the exact post it was written for.
  const roots = new Set(), cars = [];
  const inside = (o) => { for (let q = o.parent; q; q = q.parent) if (roots.has(q)) return true; return false; };
  s.traverse((o) => {
    if (!o.isGroup) return;
    let mod = null; for (let q = o; q; q = q.parent) if (q.userData?.mod) { mod = q.userData.mod; break; }
    if (mod !== 'lot' || inside(o)) return;
    let n = 0; o.traverse((c) => { if (c.isMesh) n++; });
    if (n < 8) return;
    roots.add(o);
    const e = o.matrixWorld.elements;
    cars.push([e[12], e[14]]);
  });
  const cols = window.__ct.colliders()
    .filter((c) => c && isFinite(c.minX) && Math.abs(c.minX) < 500)
    .map((c) => ({ minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ }))
    .filter((c) => {
      const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
      return !cars.some(([x, z]) => Math.hypot(cx - x, cz - z) < 1.0);   // it is a car
    });
  return { x0, x1, z0, z1, office, cols, nCars: cars.length };
});

const { x0, x1, office, cols, nCars } = world;
const zMid = office ? office[1] : 2.6;
// THE SOURCE'S OWN AISLE HALF-WIDTH. My first version used 3.0 instead of 3.4
// "to avoid catching the cars", and that 0.4 m of fudge is exactly the band the
// mast stood in — the selftest put a post back at z 5.8 and the check said
// nothing. Narrowing a band to dodge a false positive blinds it to the true
// ones at the edge; the cars are excused above by being cars instead.
const HW = 3.4;
// The drive ends where the corner bays beside the office begin, not at the
// office wall — those two cars are parked, not in the way.
const GATE = x0 + 1.2, BACK = office ? office[0] - 3.2 : x1 - 5.0;

const FAIL = [];
console.log(`\n  aisle: x ${GATE.toFixed(1)} … ${BACK.toFixed(1)}, z ${(zMid - HW).toFixed(1)} … ${(zMid + HW).toFixed(1)}`);

// ── 1. the walking route ────────────────────────────────────────────────────
const inAisle = cols.filter((c) =>
  c.maxX > GATE && c.minX < BACK && c.maxZ > zMid - HW && c.minZ < zMid + HW);
console.log(`  ${cols.length} non-car colliders (${nCars} cars excused), ${inAisle.length} inside that band\n`);
for (const c of inAisle) {
  console.log(`     SOLID IN THE AISLE at x ${c.minX.toFixed(2)}…${c.maxX.toFixed(2)}, `
    + `z ${c.minZ.toFixed(2)}…${c.maxZ.toFixed(2)}`);
  FAIL.push(`something solid stands in the aisle at (${((c.minX + c.maxX) / 2).toFixed(2)}, `
    + `${((c.minZ + c.maxZ) / 2).toFixed(2)}) — a customer has to walk round it`);
}

// ── 2. the sight line from the gate ─────────────────────────────────────────
// march the centreline from the gate to the office and report the first hit
const hit = await p.evaluate(([gx, bx, zm, cols]) => {
  for (let d = 0; gx + d <= bx; d += 0.1) {
    const px = gx + d;
    for (const c of cols)
      if (px > c.minX && px < c.maxX && zm > c.minZ && zm < c.maxZ)
        return { x: +px.toFixed(2), c };
  }
  return null;
}, [GATE, BACK, zMid, cols]);
if (hit) {
  console.log(`\n     SIGHT LINE BLOCKED at x ${hit.x} — you cannot see down your own lot`);
  FAIL.push(`the view from the gate down the centreline is blocked at x ${hit.x}`);
} else {
  console.log(`\n     sight line from the gate to the office: clear for ${(BACK - GATE).toFixed(1)} m`);
}

if (FAIL.length) { console.log('\nFAIL'); for (const f of FAIL.slice(0, 10)) console.log('  · ' + f); }
else console.log('\nnothing stands in the aisle, and the view down it is clear.');

await b.close();
process.exit(FAIL.length ? 1 : 0);
