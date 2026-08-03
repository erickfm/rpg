// Item 177, second half — CAN YOU ACTUALLY GET AROUND THE BODEGA?
//
// The user: *"bodega is a bit crowded"*. The item is explicit that this half
// cannot be judged from a screenshot: *"a shop is crowded when you cannot get
// past the fixtures, so the test is whether you can walk every aisle, reach
// every [E] spot, and get to the counter from both approaches."*
//
// So this WALKS. Held keys, real collision, no teleporting through anything —
// `__ct.warp` is used only to place the player at the START of a route, which
// is the one thing walking cannot do for itself from outside the shop.
//
// It also prints the free-floor map the routes were derived FROM, because the
// aisle positions must not be arithmetic I did in my head against the source:
// three gondola x's that I computed by hand came out wrong (the door-line
// shift is data, not a constant), and a route walked down a lane that is not
// there passes or fails for reasons that have nothing to do with the room.
//
// Usage: SHOT_URL=http://localhost:4240/ node scripts/probes/w68-bodega-walk.mjs [outprefix]
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4240/');
const OUT = process.argv[2] ?? '/tmp/w68-bwalk';
const fails = [], notes = [];
const ok = (c, m) => { (c ? notes : fails).push(`${c ? 'PASS' : 'FAIL'}  ${m}`); return c; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await waitPainted(p);
await p.waitForTimeout(800);

const room = await p.evaluate(() => {
  const r = (window.__ct.roomDims?.() ?? []).find((q) => /bodega/i.test(q.id ?? ''));
  return r ? JSON.parse(JSON.stringify(r)) : null;
});
if (!room) { console.log('no bodega'); await b.close(); process.exit(3); }
const R = { x0: room.cx - room.w / 2, x1: room.cx + room.w / 2,
            z0: room.cz - room.d / 2, z1: room.cz + room.d / 2 };
console.log(`bodega ${room.w} x ${room.d} centred (${room.cx}, ${room.cz})`);

// ── the fixtures, as the world has them ───────────────────────────────────
const cols = await p.evaluate((R) => (window.__ct.colliders?.() ?? [])
  .filter((c) => (c.minX + c.maxX) / 2 > R.x0 && (c.minX + c.maxX) / 2 < R.x1
              && (c.minZ + c.maxZ) / 2 > R.z0 && (c.minZ + c.maxZ) / 2 < R.z1)
  .map((c) => ({ x0: +c.minX.toFixed(3), x1: +c.maxX.toFixed(3), z0: +c.minZ.toFixed(3), z1: +c.maxZ.toFixed(3) })), R);
// wall and chamfer stock is 0.18 thick; a fixture is anything thicker in both axes
const fx = cols.filter((c) => Math.min(c.x1 - c.x0, c.z1 - c.z0) > 0.2);
console.log(`\n${cols.length} colliders, of which ${fx.length} are fixtures (thicker than the 0.18 wall stock):`);
for (const c of fx) console.log(`   ${(c.x1 - c.x0).toFixed(2)} x ${(c.z1 - c.z0).toFixed(2)}  local (${((c.x0 + c.x1) / 2 - room.cx).toFixed(2)}, ${((c.z0 + c.z1) / 2 - room.cz).toFixed(2)})`);

// ── THE FREE-FLOOR MAP, which is what "crowded" means numerically ──────────
// The player capsule is 0.72 across, so a lane narrower than that is not a
// lane. Sampled on a 0.10 m grid, 0.36 m in from every wall face.
const RAD = 0.36;
const grid = await p.evaluate(([R, cols, RAD]) => {
  const step = 0.10, out = [];
  for (let x = R.x0 + RAD; x <= R.x1 - RAD; x += step) {
    for (let z = R.z0 + RAD; z <= R.z1 - RAD; z += step) {
      let free = true;
      for (const c of cols) {
        if (x > c.x0 - RAD && x < c.x1 + RAD && z > c.z0 - RAD && z < c.z1 + RAD) { free = false; break; }
      }
      if (free) out.push([+x.toFixed(2), +z.toFixed(2)]);
    }
  }
  return out;
}, [R, cols, RAD]);
// FLOOD-FILL FROM THE MIDDLE, and keep only what is connected to it.
//
// Two reasons, and the second is the one I did not see coming. The obvious one
// is that connectivity IS the crowding question: floor you cannot reach is not
// floor. The second is that this room has a CHAMFERED corner, and the cut is
// built as a staircase of 0.18 m boxes — so the triangle of floor OUTSIDE the
// cut sits inside the room's rectangular band, has no collider over it, and
// counted as standable. It put a phantom lane at local x 3.86 into the report
// and sent a walk route into the chamfer wall. The flood fill removes it for
// the right reason: it is on the other side of a wall.
const key = (g) => `${g[0].toFixed(2)},${g[1].toFixed(2)}`;
const all = new Map(grid.map((g) => [key(g), g]));
let seed = null, sd = 1e9;
for (const g of grid) { const d = Math.hypot(g[0] - room.cx, g[1] - room.cz); if (d < sd) { sd = d; seed = g; } }
const seen = new Set([key(seed)]);
const q = [seed];
while (q.length) {
  const [x, z] = q.pop();
  for (const [dx, dz] of [[0.1, 0], [-0.1, 0], [0, 0.1], [0, -0.1]]) {
    const k = `${(x + dx).toFixed(2)},${(z + dz).toFixed(2)}`;
    if (all.has(k) && !seen.has(k)) { seen.add(k); q.push(all.get(k)); }
  }
}
const reach = grid.filter((g) => seen.has(key(g)));
const cellArea = 0.01;
console.log(`\nSTANDABLE FLOOR: ${grid.length} samples = ${(grid.length * cellArea).toFixed(2)} m2`
  + ` of ${(room.w * room.d).toFixed(1)} m2 gross (${(100 * grid.length * cellArea / (room.w * room.d)).toFixed(1)} %)`);
console.log(`REACHABLE from the middle: ${reach.length} = ${(reach.length * cellArea).toFixed(2)} m2`
  + `  (${grid.length - reach.length} samples stranded / outside the chamfer)`);
ok(reach.length * cellArea > 30,
  `FLOOR: more than 30 m2 of the room is reachable (${(reach.length * cellArea).toFixed(2)} m2) — a tiny number here would make every route below meaningless`);

// ── WALK IT ───────────────────────────────────────────────────────────────
// A route is a start, a heading and a distance. It passes if the player covers
// at least `want` of it — collision is real, so a fixture in the lane stops you
// and the shortfall says by how much.
const walk = async (name, sx, sz, yaw, seconds, want) => {
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0), [sx, sz, yaw]);
  await p.waitForTimeout(350);
  const a = await p.evaluate(() => window.__ct.pos().slice(0, 3));
  await p.keyboard.down('w');
  await p.waitForTimeout(seconds * 1000);
  await p.keyboard.up('w');
  await p.waitForTimeout(250);
  const c = await p.evaluate(() => window.__ct.pos().slice(0, 3));
  const d = Math.hypot(c[0] - a[0], c[2] - a[2]);
  const inside = c[0] > R.x0 && c[0] < R.x1 && c[2] > R.z0 && c[2] < R.z1;
  console.log(`  ${name}: ${d.toFixed(2)} m (want >= ${want})  from (${a[0].toFixed(2)}, ${a[2].toFixed(2)}) to (${c[0].toFixed(2)}, ${c[2].toFixed(2)})${inside ? '' : '  [LEFT THE ROOM]'}`);
  return { d, from: a, to: c };
};

// ── the aisles, DERIVED FROM THE STANDABLE GRID ───────────────────────────
//
// NOT from the collider x-spans. My first cut did that — sort the fixtures by
// x, call each gap a lane — and reported **0 LANES**, then sailed on to print
// `BODEGA WALK OK` having walked nothing at all. The bug is instructive: the
// cooler is a 7.60 x 0.60 slab across the BACK WALL, so projected onto x alone
// it spans 516.2…523.8 and swallows the room. A fixture only blocks a lane at
// the z where it actually stands, and a 1-D projection cannot know that.
//
// The grid above already solves this properly in 2-D, so the lanes come out of
// it: take the row of standable samples at the gondolas' own mid-z and split it
// into contiguous runs. A run is a lane, and it is a lane because the player
// can stand in it, which is the only definition that matters.
// THE AISLES ARE THE GAPS BETWEEN THE GONDOLA RUNS, and nothing else is an
// aisle. A strip of standable floor is not a route — the floor in front of the
// deli case is 1.42 m wide and goes nowhere, and asserting on it reports the
// deli as an obstruction in a lane that was never a lane.
// The runs identify themselves: they are the only fixtures longer than 3 m in z.
const gond = fx.filter((c) => c.z1 - c.z0 > 3).sort((a, c) => a.x0 - c.x0);
const laneZ = gond.reduce((a, c) => a + (c.z0 + c.z1) / 2, 0) / Math.max(1, gond.length);
const lanes = [];
for (let i = 1; i < gond.length; i++) lanes.push([gond[i - 1].x1, gond[i].x0]);
console.log(`\nGONDOLA RUNS: ${gond.length}; AISLES BETWEEN THEM: ${lanes.length} (mid-line local z ${(laneZ - room.cz).toFixed(2)})`);
for (const [a, c] of lanes) console.log(`   ${(c - a).toFixed(2)} m clear at local x ${((a + c) / 2 - room.cx).toFixed(2)}`);
// POPULATION FLOOR, and it has already earned its keep twice: my first lane
// derivation produced ZERO lanes and still printed `BODEGA WALK OK`.
ok(gond.length >= 3, `FLOOR: three gondola runs are present (${gond.length})`);
ok(lanes.length >= 2, `FLOOR: at least 2 aisles between them (${lanes.length}) — 0 would make every walk below vacuous`);
for (const [a, c] of lanes) {
  ok(c - a >= 0.72, `aisle at local x ${((a + c) / 2 - room.cx).toFixed(2)} is wider than the 0.72 m player (${(c - a).toFixed(2)} m)`);
}

console.log('\nWALKING EACH AISLE FRONT TO BACK (held W, real collision):');
// LONG ENOUGH TO ARRIVE, and the assertion is on WHERE YOU END UP, not on how
// far you got. Distance-travelled is capped by the clock — two aisles walked
// 7.97 and 8.06 m against a target of 8.88 and read as failures when the truth
// was 3.36 m/s sustained for the whole 2.4 s with nothing in the way. `speed`
// is 3.3 m/s (`crosstown.ts:1218`), the room is 12.6 deep, so 5 s cannot be
// the binding constraint at any starting point.
const RUN = 5.0;
for (const [a, c] of lanes) {
  const cx = (a + c) / 2;
  // start at the FRONT of this aisle's own standable column, not at a typed z:
  // the door corner is chamfered, so the aisles do not start level with each
  // other. `reach` and not `grid` — the chamfer's outside is not a start point.
  const col = reach.filter((g) => Math.abs(g[0] - cx) < 0.06).map((g) => g[1]).sort((x, y) => y - x);
  if (!ok(col.length > 0, `aisle at local x ${(cx - room.cx).toFixed(2)} has a reachable column to start from`)) continue;
  const backEnd = col[col.length - 1];
  // YAW 0 IS -Z. Measured, not assumed (`scripts/probes/w68-yawcheck.mjs`):
  // yaw 0 -> d=(0.00, -2.36), yaw PI -> d=(0.00, +2.36). I had PI here and all
  // five routes walked the player into the FRONT WALL for 2.4 s and reported
  // the room impassable. The 0.05 m they each covered was the wall, not a
  // fixture (BUILDER-BRIEF §7 — half of all defects here are the instrument).
  const r = await walk(`aisle x=${(cx - room.cx).toFixed(2)}`, cx, col[0], 0, RUN, 0);
  // arrived = within 0.25 m of the far end of this aisle's own clear column
  const arrived = r.to[2] - backEnd < 0.25;
  ok(arrived, `a 0.72 player walks the ${(c - a).toFixed(2)} m aisle at local x ${(cx - room.cx).toFixed(2)}`
    + ` from the front (z ${col[0].toFixed(2)}) to the back (z ${backEnd.toFixed(2)}): stopped at z ${r.to[2].toFixed(2)}`);
}

// ── every [E] spot reachable ──────────────────────────────────────────────
const spots = await p.evaluate((R) => (window.__ct.spots?.() ?? [])
  .filter((s) => s.x > R.x0 && s.x < R.x1 && s.z > R.z0 && s.z < R.z1)
  .map((s) => ({ label: String(s.label), x: +s.x.toFixed(2), z: +s.z.toFixed(2), r: s.r })), R);
console.log(`\n[E] SPOTS IN THE ROOM: ${spots.length}`);
ok(spots.length > 0, `FLOOR: the room registers at least one [E] spot (${spots.length}) — zero would make every reach below vacuous`);
for (const s of spots) {
  // stand on the nearest STANDABLE sample to the spot and read the prompt back
  let best = null, bd = 1e9;
  for (const g of grid) { const d = Math.hypot(g[0] - s.x, g[1] - s.z); if (d < bd) { bd = d; best = g; } }
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), best);
  await p.waitForTimeout(300);
  const got = await p.evaluate(([x, z]) => {
    // face the spot, then let a frame run so the picker re-reads
    const yaw = Math.atan2(x - window.__ct.pos()[0], -(z - window.__ct.pos()[2]));
    window.__ct.warp(window.__ct.pos()[0], window.__ct.pos()[2], yaw, 0, 0);
    return null;
  }, [s.x, s.z]);
  await p.waitForTimeout(320);
  const prompt = await p.evaluate(() => document.querySelector('#ct-prompt')?.textContent ?? '');
  const reached = bd <= s.r;
  console.log(`  "${s.label}"  r=${s.r}  nearest standable floor ${bd.toFixed(2)} m  prompt: ${JSON.stringify(prompt)}`);
  ok(reached, `you can stand within r=${s.r} of "${s.label}" (nearest standable floor is ${bd.toFixed(2)} m)`);
}

// ── the counter, from both approaches ─────────────────────────────────────
await p.evaluate(([R]) => window.__ct.warp(R.cx, R.cz, 0, 0, 0), [{ cx: room.cx, cz: room.cz }]);
await p.waitForTimeout(300);
await p.screenshot({ path: `${OUT}-mid.png` });

console.log('');
for (const n of notes) console.log('  ', n);
for (const f of fails) console.log('  ', f);
console.log(`\nconsole errors: ${errs.length}`);
for (const e of errs.slice(0, 6)) console.log('   ', e);
console.log(fails.length === 0 ? `BODEGA WALK OK — ${notes.length} assertions` : `BODEGA WALK BAD — ${fails.length} failed`);
await b.close();
process.exit(fails.length === 0 ? 0 : 1);
