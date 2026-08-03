// IS THERE ANYWHERE THE PLAYER CAN REACH THAT HAS NO FLOOR UNDER IT? Item 230.
//
// `w75-site-contained.mjs` asks this per SITE and answers it well. This asks it
// of the WHOLE WORLD, and it exists because of the one thing a per-site sweep
// structurally cannot do:
//
//   **it is seeded from a site's frontage, so ground belonging to no site is
//   never swept at all.**
//
// That is GOTCHAS 79 in its purest form — a check that examines only what its
// author enumerated reports green about everything they did not — except here
// the enumeration is not even a list of routes, it is a list of SITES, and the
// street's own north end belongs to none of them.
//
//   SHOT_URL=http://localhost:4410/ node scripts/world-contained.mjs
//   SHOT_URL=http://localhost:4410/ node scripts/world-contained.mjs --selftest
//   SHOT_URL=http://localhost:4410/ node scripts/world-contained.mjs --map
//
// ── WHY A RAYCAST AND NOT A HEIGHT READING ────────────────────────────────
//
// Worker eightyone sampled `groundAt` at 297 points across the world's
// north-west quadrant and got **exactly 0.00 at every one of them** — the
// suspected hole and the middle of the road, identical. `groundPick`
// (crosstown.ts) falls through to `return put(... ? KERB_H : 0)`: it never
// returns null, so it names a height for every point in R², void included.
//
// **So a containment probe that decides floor-versus-hole from a height reading
// is measuring nothing**, and will report whichever answer its threshold
// happened to pick. `groundAt` is still used here — but only to centre the
// walkable BAND (which storey are we asking about), never to decide whether
// there is a floor. The decision is coverage, and coverage is a raycast.
//
// ── WHY THE RAYCAST IS HAND-ROLLED ────────────────────────────────────────
//
// `__ct.scene()` publishes the scene but the page has no `THREE` on it, so
// there is no `Raycaster` to borrow. That turns out to be a feature: a
// **downward** ray at a fixed (x, z) projects to a point-in-triangle test on
// the XZ plane, which is a dozen lines and has a property worth having —
// **vertical surfaces drop out for free.** A wall's triangles project to a
// zero-area line, so they can never be mistaken for something to stand on,
// without anyone writing a rule about what a wall looks like.
//
// It is triangle-major rather than point-major: each triangle is rasterised
// onto the cells its own XZ bounding box covers. That makes the cost O(scene)
// rather than O(scene x cells), which is the difference between 20 seconds and
// not finishing.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { probeServer } from './lib/server-state.mjs';
import { sweepFloorsRay } from './lib/floors.mjs';

const URL = aim('http://localhost:4410/');
const ARGV = process.argv.slice(2);
const SELFTEST = ARGV.includes('--selftest');
const MAP = ARGV.includes('--map');

// 0.5 m, AND THE CHOICE IS LOAD-BEARING RATHER THAN TASTEFUL.
//
// The fill is 4-connected and steps GRID metres. `fp.ts` pads every collider by
// RADIUS = 0.36 on each side before testing it, so the smallest obstacle the
// player can actually be stopped by is 0.72 m thick in its own frame. Any
// interval of length GRID contains a multiple of GRID, so while GRID <= 0.72
// the fill CANNOT step over a padded obstacle without landing in it. At 0.8 it
// could, and the leak would be silent and would read as an escape.
//
// It is also the right scale for the floor question: the player is 0.72 m wide,
// so a hole narrower than half a metre is not somewhere anyone falls.
const GRID = 0.5;
// THE ROAD SENTINEL IS NOT (0, 0), AND THAT IS NOT FUSSINESS.
//
// The world origin is the worst point in the world to ask about. Sitting on it,
// found while making the mutation below actually bite:
//   - the road CENTRE-LINE plane (0.5 x 124.9 m at y 0.03), and
//   - FIVE car-body boxes (1.8 x 4.5 m, y 0.34…0.84) whose world bbox is
//     centred on x 0, z 0 — pooled traffic meshes parked at the origin.
// So (0, 0) reports "floored" off a lane marking and a car that is not on the
// road, and it would keep reporting it with every ground plane in the world
// deleted. A sentinel that cannot go void is not a sentinel.
// Plain carriageway, 30 m south, clear of both.
const ROAD = [3.2, -30.3];
// The band a floor may sit in relative to the height the picker names, before
// it is a different storey. Same numbers as w75-site-contained, deliberately —
// the two checks must not disagree because they drew their bands differently.
const FLOOR_LO = 0.9, FLOOR_HI = 1.2;

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(13, 0));

let fails = 0;
const report = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };
const f = (n) => n.toFixed(2);

// ── THE ONE IN-PAGE PASS ──────────────────────────────────────────────────
//
// THE SWEEP ITSELF NOW LIVES IN `lib/floors.mjs` (item 238). It was inline here
// until three separate answers to "is there a floor" had accumulated across the
// repo and nobody had checked they agreed. They do not — the AABB predicate
// over-claims — so the raycast below was made authoritative and hoisted so the
// other callers can share this exact code rather than a re-typed cousin of it
// (BUILDER-BRIEF §8). Nothing about the algorithm changed in the move; the
// hoist was verified by re-running this file and matching its output cell for
// cell against the pre-hoist baseline.
//
// `drop` is the mutation hook for --selftest: a raycaster that cannot be made
// to report VOID is one that reports FLOOR unconditionally, and that is a check
// that can never fail.
const sweep = await sweepFloorsRay(page, { GRID, FLOOR_LO, FLOOR_HI, drop: SELFTEST });

const { x0, z0, NX, NZ, B } = sweep;
const at = (i, j) => i * NZ + j;
const cxOf = (i) => x0 + i * GRID, czOf = (j) => z0 + j * GRID;
const iOf = (x) => Math.round((x - x0) / GRID), jOf = (z) => Math.round((z - z0) / GRID);
const floorAt = (x, z) => {
  const i = iOf(x), j = jOf(z);
  return i >= 0 && i < NX && j >= 0 && j < NZ ? sweep.floor[at(i, j)] === 1 : false;
};

console.log(`bounds  x ${f(B.minX)}…${f(B.maxX)}  z ${f(B.minZ)}…${f(B.maxZ)}`);
console.log(`grid    ${NX} x ${NZ} = ${NX * NZ} cells at ${GRID} m`);
console.log(`scene   ${sweep.meshes} meshes, ${sweep.tris} triangles, ${sweep.hits} cell-hits`
  + (sweep.dropped ? `, ${sweep.dropped} meshes DROPPED (selftest)` : ''));

// ── THE RAYCASTER IS SELF-TESTED ON BOTH SIGNS BEFORE ANYTHING IS ASSERTED ─
//
// A predicate that finds a floor everywhere goes green over a hole; one that
// finds none goes red on a sealed world. Both are silent, and this repo has
// shipped both shapes. So it is asked about a place that must be solid and a
// place that must be empty, and the run refuses to produce a verdict if it gets
// either wrong. The negative control is 60 m south of the world's own south
// clamp — provably unreachable, provably bare.
{
  const bad = [];
  if (sweep.tris < 10000) bad.push(`only ${sweep.tris} triangles in the whole scene — nothing was read`);
  if (!SELFTEST && !floorAt(ROAD[0], ROAD[1])) bad.push(`the road at (${ROAD}) reads as VOID — the raycaster finds no floors`);
  if (floorAt(0, -170)) bad.push('a point 60 m past the world clamp reads as FLOORED — the raycaster cannot say no');
  if (bad.length) {
    console.log(`RAYCASTER FAILED ITS OWN CONTROLS — nothing measured:\n  ${bad.join('\n  ')}`);
    await b.close(); process.exit(3);
  }
  console.log(`raycaster ok: road at (${ROAD}) solid, 60 m off-world void`);
}

// --selftest: the mutation. With the ground meshes dropped, the road MUST read
// void. If it still reads floor, this file cannot fail and is worthless.
if (SELFTEST) {
  // POPULATION FLOOR ON THE MUTATION ITSELF. "The road went void" means nothing
  // if the mutation removed nothing, and it means nothing either if it removed
  // the whole world.
  report('the mutation actually removed ground planes', sweep.dropped >= 5,
    `${sweep.dropped} big flat street-level meshes dropped`);
  const roadVoid = !floorAt(ROAD[0], ROAD[1]);
  report('dropping the ground meshes makes the road read VOID', roadVoid,
    roadVoid ? 'the raycaster reports what it is shown, not what it expects'
      : 'THE ROAD STILL READS FLOORED WITH ITS OWN GROUND REMOVED — this check cannot fail');
  console.log(fails ? `\n${fails} FAILED` : '\nselftest passed');
  await b.close(); process.exit(fails ? 1 : 0);
}

// ── WHERE CAN THE PLAYER ACTUALLY GET? ────────────────────────────────────
//
// A fill over the same grid, through `fp.ts`'s own passability rule. STATIC
// colliders only (GOTCHAS 73): a citizen is not masonry, and a pedestrian
// standing in a doorway must not be allowed to seal a hole out of the report —
// the escape would still be there tomorrow when he walks on.
//
// ── AND IT IS SEEDED FROM NOWHERE, WHICH IS THE POINT ─────────────────────
//
// The first version of this seeded at the spawn and filled **99 cells**. That
// is not a bug, it is the world: the player spawns in flat 301, three storeys
// up, and every way out of it is an `[E]` DOOR, not a walk. **The walkable
// world is not one connected region** — it is the street, twelve interiors and
// a flat, joined by teleports — so ANY fill from ANY single seed measures one
// room and reports the rest of the world contained by never looking at it.
//
// The obvious repair is a list of seeds: one per site, one per room. That is
// precisely the habit this file exists to break — a list of places somebody
// thought of, which is how the jail's forecourt went unswept through two
// dedicated checks (see w75-site-contained's own header).
//
// So there are no seeds. Every open cell is assigned to a CONNECTED COMPONENT,
// and a component counts as somewhere the player can be if it holds real
// standing room. An escape is then a cell with nothing under it **in the same
// component as somewhere he can stand** — which needs no seed, no site list and
// no route, and covers ground that belongs to nothing at all.
const reach = await page.evaluate(([x0, z0, NX, NZ, GRID, floorArr, LIVE]) => {
  const ct = window.__ct;
  const B = ct.bounds();
  const cols = ct.staticColliders();
  const RADIUS = 0.36;   // fp.ts:87. Copied WITH a citation because fp.ts is not
                         // importable from a page context; asserted against the
                         // real rig below rather than trusted.
  const inFrame = (c, x, z) => {
    if (!c.rot) return { x, z };
    const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
    const s = Math.sin(c.rot), k = Math.cos(c.rot);
    const dx = x - cx, dz = z - cz;
    return { x: cx + dx * k - dz * s, z: cz + dx * s + dz * k };
  };
  // No `atY`, which is `fp.ts`'s own safe default: every collider is a wall at
  // every height. That UNDER-states where the player can get (he really can
  // stand on a car roof), and under-stating reachability is the direction that
  // cannot invent an escape.
  const blocked = (x, z) => {
    for (const c of cols) {
      const q = inFrame(c, x, z);
      if (q.x > c.minX - RADIUS && q.x < c.maxX + RADIUS && q.z > c.minZ - RADIUS && q.z < c.maxZ + RADIUS) return true;
    }
    return false;
  };
  const at = (i, j) => i * NZ + j;
  const cx = (i) => x0 + i * GRID, cz = (j) => z0 + j * GRID;
  const open = new Uint8Array(NX * NZ);
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
    const x = cx(i), z = cz(j);
    open[at(i, j)] = (x >= B.minX && x <= B.maxX && z >= B.minZ && z <= B.maxZ && !blocked(x, z)) ? 1 : 0;
  }
  // 4-connected: `fp.ts` clamps x and z SEPARATELY (fp.ts:523-525), so a
  // diagonal move is exactly two axis moves and 8-connectivity would let the
  // fill cut a corner the player cannot cut.
  const comp = new Int32Array(NX * NZ).fill(-1);
  const comps = [];
  const q = new Int32Array(NX * NZ);
  for (let s = 0; s < NX * NZ; s++) {
    if (!open[s] || comp[s] >= 0) continue;
    const id = comps.length;
    let head = 0, tail = 0;
    q[tail++] = s; comp[s] = id;
    let cells = 0, floors = 0, voids = 0;
    let mnx = Infinity, mxx = -Infinity, mnz = Infinity, mxz = -Infinity;
    while (head < tail) {
      const k = q[head++]; const i = Math.floor(k / NZ), j = k % NZ;
      cells++;
      if (floorArr[k]) floors++; else voids++;
      const x = cx(i), z = cz(j);
      if (x < mnx) mnx = x; if (x > mxx) mxx = x;
      if (z < mnz) mnz = z; if (z > mxz) mxz = z;
      if (i > 0) { const kk = at(i - 1, j); if (open[kk] && comp[kk] < 0) { comp[kk] = id; q[tail++] = kk; } }
      if (i < NX - 1) { const kk = at(i + 1, j); if (open[kk] && comp[kk] < 0) { comp[kk] = id; q[tail++] = kk; } }
      if (j > 0) { const kk = at(i, j - 1); if (open[kk] && comp[kk] < 0) { comp[kk] = id; q[tail++] = kk; } }
      if (j < NZ - 1) { const kk = at(i, j + 1); if (open[kk] && comp[kk] < 0) { comp[kk] = id; q[tail++] = kk; } }
    }
    comps.push({ id, cells, floors, voids, minX: mnx, maxX: mxx, minZ: mnz, maxZ: mxz });
  }
  // LIVE = holds real standing room. A component of pure void is the emptiness
  // outside the world and nobody is in it; one with a handful of floor cells is
  // a ledge or a rooftop the fill clipped. LIVE is in CELLS of floor.
  const live = comps.filter((c) => c.floors >= LIVE).map((c) => c.id);
  const liveSet = new Set(live);
  const seen = new Uint8Array(NX * NZ);
  for (let k = 0; k < NX * NZ; k++) if (comp[k] >= 0 && liveSet.has(comp[k])) seen[k] = 1;
  return { reach: Array.from(seen), seedFound: live.length > 0, spawn: ct.pos(), cols: cols.length,
    comps: comps.sort((a, c) => c.cells - a.cells).slice(0, 12), nComps: comps.length, nLive: live.length };
}, [x0, z0, NX, NZ, GRID, sweep.floor, Math.round(5 / (GRID * GRID))]);

console.log(`fill    ${reach.nComps} open component(s), ${reach.nLive} with real standing room, ${reach.cols} static colliders`);
console.log('largest components:');
for (const c of reach.comps.slice(0, 8)) {
  console.log(`  ${String(c.cells).padStart(7)} cells  ${String(c.floors).padStart(7)} floored  ${String(c.voids).padStart(7)} void`
    + `   x ${f(c.minX)}…${f(c.maxX)}  z ${f(c.minZ)}…${f(c.maxZ)}`);
}
report('the fill found somewhere the player can stand', reach.seedFound,
  reach.seedFound ? `${reach.nLive} component(s) hold 5 m^2 or more of floor`
    : 'not one open component holds real standing room — nothing was filled');
if (!reach.seedFound) { await b.close(); process.exit(3); }

let nReach = 0, nVoid = 0;
const voids = [];
for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
  const k = at(i, j);
  if (!reach.reach[k]) continue;
  nReach++;
  if (!sweep.floor[k]) { nVoid++; voids.push([cxOf(i), czOf(j)]); }
}

// ── POPULATION FLOOR. "I CLASSIFIED NOTHING" MUST FAIL ────────────────────
//
// The whole failure mode this file was written against is a sweep that reports
// 0 escapes because it looked at 0 places. 2000 cells is 500 m^2 of reachable
// ground, which is less than the road alone.
report('the sweep classified a real population of reachable ground', nReach >= 2000,
  `${nReach} reachable cells (${f(nReach * GRID * GRID)} m^2) of ${NX * NZ} swept`);

// ── GROUND OWNED BY NO SITE IS COVERED, and it is COUNTED rather than claimed ─
const sites = await page.evaluate(() => window.__ct.sites());
const inAnySite = (x, z) => Object.values(sites).some((s) =>
  x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ);
let orphan = 0;
for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
  if (reach.reach[at(i, j)] && !inAnySite(cxOf(i), czOf(j))) orphan++;
}
report('reachable ground belonging to NO published site is swept too', orphan > 0,
  `${orphan} of ${nReach} reachable cells (${(100 * orphan / nReach).toFixed(1)}%) are outside every site `
  + `rectangle — a per-site fill never seeds there at all`);

if (MAP) {
  for (let j = NZ - 1; j >= 0; j--) {
    let row = '';
    for (let i = 0; i < NX; i++) {
      const k = at(i, j);
      row += !reach.reach[k] ? ' ' : (sweep.floor[k] ? '.' : '#');
    }
    if (row.trim()) console.log(`z${czOf(j).toFixed(1).padStart(7)} |${row}|`);
  }
}

// ── THE ASSERTION ─────────────────────────────────────────────────────────
//
// Clustered before printing: a hole is a REGION, and forty cells of one hole
// listed individually reads as forty defects.
const clusters = [];
{
  const used = new Set();
  for (const v of voids) {
    const key = `${v[0]},${v[1]}`;
    if (used.has(key)) continue;
    const q = [v]; used.add(key);
    let mnx = v[0], mxx = v[0], mnz = v[1], mxz = v[1], n = 0;
    while (q.length) {
      const [x, z] = q.pop(); n++;
      mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mnz = Math.min(mnz, z); mxz = Math.max(mxz, z);
      for (const [dx, dz] of [[GRID, 0], [-GRID, 0], [0, GRID], [0, -GRID]]) {
        const nx = +(x + dx).toFixed(2), nz = +(z + dz).toFixed(2);
        const kk = `${nx},${nz}`;
        if (used.has(kk)) continue;
        if (!voids.some((w) => Math.abs(w[0] - nx) < 1e-6 && Math.abs(w[1] - nz) < 1e-6)) continue;
        used.add(kk); q.push([nx, nz]);
      }
    }
    clusters.push({ n, minX: mnx, maxX: mxx, minZ: mnz, maxZ: mxz });
  }
  clusters.sort((a, c) => c.n - a.n);
}

report('no reachable point in the world has empty space under it', nVoid === 0,
  nVoid === 0
    ? `all ${nReach} reachable cells have a floor mesh under them`
    : `${nVoid} of ${nReach} reachable cells are OVER NOTHING, in ${clusters.length} region(s):\n`
      + clusters.slice(0, 8).map((c) => `      ${String(c.n).padStart(5)} cells  x ${f(c.minX)}…${f(c.maxX)}  z ${f(c.minZ)}…${f(c.maxZ)}`).join('\n'));

const endState = await probeServer(URL);
report('the world was still serving when the sweep finished', endState === 'ok',
  endState === 'ok' ? 'the preview answered at the end as well as the start'
    : `the server went '${endState}' during the run — EVERY result above is unmeasured, not green`);
report('no console errors during the sweep', errs.length === 0, `${errs.length} page error(s)`);

console.log(`\n${nReach} reachable cells · ${nVoid} over nothing · ${clusters.length} region(s)`);
console.log(fails ? `\n${fails} FAILED` : '\nthe world is contained');
await b.close();
process.exit(fails ? 1 : 0);
