// SECOND VERIFIER (A) for D's ledger row "shouldnt be able to select things
// through objects ever".
//
// THE HARD PART OF THIS ROW IS FINDING A STATION WHERE ANYTHING IS ACTUALLY IN
// THE WAY. Two of my attempts measured nothing and passed:
//
//   - standing at the ten shop door stand points. Those points ARE the door
//     spots, so the distance is 0 and the door wins on proximity alone.
//   - a ring around the bus shelter seat. The shelter is four posts and a roof
//     starting at y 2.47; at the 1.1 m ray height it is open on every bearing,
//     so "all eight see the seat" was correct and proved nothing.
//
// GOTCHAS 34 both times — a check passes because it found nothing to check.
//
// So the stations here are DERIVED FROM THE COLLIDER REGISTRY rather than
// chosen by me: for every live spot, walk the reach ring and keep the bearings
// where a collider AABB lies across the segment from station to spot. That is
// deliberately a different data structure from the scene geometry the gate
// raycasts, so this is a second opinion rather than a re-run of D's own test.
//
// Stations inside a collider are dropped — D flagged that limit on their own
// number ("some of those bearings are inside buildings where a player cannot
// stand, so the reachable number is lower and I am not claiming 87"), and a
// station a player cannot occupy is not evidence about a player's experience.
//
// Then the two halves, because an over-tight fix passes one and fails the other:
//
//   A. BLOCKED STATIONS ARE SILENT   a wall between you and it means no prompt
//   B. KEEPERS STILL WORK           the ones D named still offer themselves
//
//   node scripts/A-verify-select-through.mjs [port]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const ARG = process.argv[2];
const URL = process.env.SHOT_URL
  ?? (ARG && /^\d+$/.test(ARG) ? `http://localhost:${ARG}/` : ARG)
  ?? 'http://localhost:4188/';

// THIS IS A COPY, AND IT IS THE ONLY REAL ONE IN THE "DEEP/REACH" ROW.
//
// It duplicates `src/proto/fp.ts:486  export const REACH_MARGIN = 0.6`, which
// is exported and is the world's own value. It cannot be imported from here:
// this is plain-node .mjs and that is TypeScript, and `crosstown.ts:27` imports
// REACH_MARGIN but does not republish it on `__ct`, so there is no runtime path
// to it either.
//
// So it is cited rather than silently retyped, which is what BUILDER-BRIEF §8
// asks for when an import is impossible. THE FIX IS ONE LINE in crosstown.ts's
// `__ct` surface — `reachMargin: () => REACH_MARGIN` — beside `camY` and `yaw`;
// then this reads it off the world like every other derived number and the copy
// goes away. That file is outside this row, so it is queued, not taken.
//
// NOTE the name collision that made this row look bigger than it is: the
// `REACH = 0.80` in scripts/seat-facing.mjs is a DIFFERENT quantity (how close
// furniture must be to count as furniture you are sitting at), not a copy of
// this one.
const REACH = 0.6;                 // = fp.ts:486 REACH_MARGIN — spot reach, over the spot radius
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.waitForTimeout(2500);
await reportWorld(p, URL);
// 13:00. A shut shop reports ok=false and would read as "does not leak" for the
// wrong reason, which is the same fault as the two attempts above.
await p.evaluate(() => window.__ct.clock(13));
await p.waitForTimeout(700);

const recon = await p.evaluate((REACH) => {
  const cols = window.__ct.colliders();
  const box = (c) => ({
    x0: Math.min(c.minX ?? c.x0 ?? c.min?.x, c.maxX ?? c.x1 ?? c.max?.x),
    x1: Math.max(c.minX ?? c.x0 ?? c.min?.x, c.maxX ?? c.x1 ?? c.max?.x),
    z0: Math.min(c.minZ ?? c.z0 ?? c.min?.z, c.maxZ ?? c.z1 ?? c.max?.z),
    z1: Math.max(c.minZ ?? c.z0 ?? c.min?.z, c.maxZ ?? c.z1 ?? c.max?.z),
  });
  // BUILDINGS ONLY, and this filter is the whole correctness of the check.
  // Colliders carry a footprint and no height, so they cannot tell a wall from
  // a pew — and a pew is a collider you cannot walk through but CAN see over.
  // My first run called 41 pews "walls" and filed 41 false leaks against a row
  // that was behaving exactly as written: the ray is aimed 1.1 m up precisely
  // so low furniture does not gate a seat behind it. Area separates them
  // cleanly — a church pew is 5.2 x 0.2 m, a building is 16 x 19 m.
  const boxes = cols.map(box)
    .filter((b) => Number.isFinite(b.x0) && Number.isFinite(b.z0));
  const inside = (b, x, z) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1;
  // A HEIGHT GRID, because the collider registry cannot answer this question.
  // Colliders are footprints with no height, and they were wrong for me in both
  // directions: a church pew is a collider you can see over (41 false leaks),
  // and the used-car lot's building box covers open forecourt the building does
  // not occupy (1 more, with shots/A-leak-sit-on-the-tyres.png showing clear
  // air). So "is something solid in the way" is answered from the scene's own
  // meshes, binned at 0.5 m: a cell is opaque if it holds geometry spanning the
  // 1.1-1.6 m band the sightline actually travels through.
  const G = 0.5, grid = new Set();
  const key = (x, z) => `${Math.round(x / G)},${Math.round(z / G)}`;
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    o.updateWorldMatrix(true, false);
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox, e = o.matrixWorld.elements;
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (const X of [bb.min.x, bb.max.x]) for (const Y of [bb.min.y, bb.max.y]) for (const Z of [bb.min.z, bb.max.z]) {
      const wx = e[0]*X + e[4]*Y + e[8]*Z + e[12];
      const wy = e[1]*X + e[5]*Y + e[9]*Z + e[13];
      const wz = e[2]*X + e[6]*Y + e[10]*Z + e[14];
      lo = [Math.min(lo[0],wx), Math.min(lo[1],wy), Math.min(lo[2],wz)];
      hi = [Math.max(hi[0],wx), Math.max(hi[1],wy), Math.max(hi[2],wz)];
    }
    if (hi[1] < 1.6 || lo[1] > 1.1) return;          // does not cross the sightline band
    if ((hi[0]-lo[0]) > 60 || (hi[2]-lo[2]) > 60) return;   // ground planes and skyboxes
    for (let x = lo[0]; x <= hi[0] + G; x += G)
      for (let z = lo[2]; z <= hi[2] + G; z += G) grid.add(key(x, z));
  });
  const opaqueBetween = (ax, az, bx, bz) => {
    const n = Math.ceil(Math.hypot(bx-ax, bz-az) / (G * 0.5));
    let run = 0;
    for (let i = 1; i < n; i++) {
      const t = i / n, x = ax + (bx-ax)*t, z = az + (bz-az)*t;
      if (Math.hypot(x-bx, z-bz) < 0.5) break;        // the thing itself is not a blocker
      if (grid.has(key(x, z))) { if (++run >= 2) return true; } else run = 0;
    }
    return false;
  };
  // slab method: does segment (ax,az)->(bx,bz) cross the AABB in plan
  const crosses = (b, ax, az, bx, bz) => {
    const dx = bx - ax, dz = bz - az;
    let t0 = 0, t1 = 1;
    for (const [p0, d, lo, hi] of [[ax, dx, b.x0, b.x1], [az, dz, b.z0, b.z1]]) {
      if (Math.abs(d) < 1e-9) { if (p0 < lo || p0 > hi) return false; continue; }
      let a = (lo - p0) / d, c = (hi - p0) / d;
      if (a > c) { const t = a; a = c; c = t; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, c);
      if (t0 > t1) return false;
    }
    // PENETRATION, not touching. A segment that clips a building corner by a few
    // centimetres in plan has no wall in front of it, and counting one as
    // "blocked" produced a false leak against this row: at the used-car lot the
    // station stood 0.15 m outside a corner across an open forecourt, and
    // shots/A-leak-sit-on-the-tyres.png shows clear air the whole way. Require
    // the segment to spend real length inside the box.
    return (t1 - t0) * Math.hypot(dx, dz) > 0.4;
  };
  // RANGE IS 6 m, NOT r + 0.6, and getting that wrong made my first ring find
  // nothing. fp.ts qualifies a candidate on `near || looked`: `near` is
  // d < r + REACH_MARGIN, but `looked` is d < 6 while facing it. So the surface
  // where a wall can intervene is the whole 6 m look range, which is exactly
  // where the bugs D names lived — "the thrift offered itself through its own
  // shopfront and the bed through the bed". A ring at the reach limit tests the
  // one distance at which nothing can fit between.
  const out = [];
  for (const s of window.__ct.spots()) {
    if (!s.ok) continue;
    let found = null;
    for (const d of [5.5, 4.5, 3.5, 2.5]) {
      for (let deg = 0; deg < 360 && !found; deg += 15) {
        const a = (deg * Math.PI) / 180;
        const x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d;
        if (boxes.some((bx) => inside(bx, x, z))) continue;        // not standable
          if (!opaqueBetween(x, z, s.x, s.z)) continue;
        found = { label: s.label, sx: +s.x.toFixed(2), sz: +s.z.toFixed(2), r: s.r,
                  x: +x.toFixed(2), z: +z.toFixed(2), deg, d };
      }
      if (found) break;
    }
    if (found) out.push(found);
  }
  return { out, nWalls: grid.size, nCols: boxes.length };
}, REACH);

const stations = recon.out;
console.log(`\ncolliders ${recon.nCols}, opaque 0.5 m cells in the 1.1-1.6 m sightline band: ${recon.nWalls}`);

const read = async () => {
  await p.waitForTimeout(280);
  return p.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find(
      (e) => e.children.length === 0 && /\[E\]/.test(e.textContent ?? ''));
    return el ? el.textContent.trim().replace(/^\s*\[E\]\s*/, '') : null;
  });
};
const goto = async (x, z, tx, tz) => {
  await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0, 0),
    [x, z, Math.atan2(tx - x, -(tz - z))]);
  return read();
};

console.log(`\nA. A WALL BETWEEN YOU AND IT — ${stations.length} standable blocked stations\n`);
const leaks = [];
for (const s of stations) {
  const got = await goto(s.x, s.z, s.sx, s.sz);
  const leak = got === s.label;
  if (leak) leaks.push({ ...s, got });
  console.log(`  ${leak ? 'LEAK ' : '  ok '} ${String(s.label).slice(0, 26).padEnd(28)}` +
    ` from (${String(s.x).padStart(7)},${String(s.z).padStart(8)}) ${String(s.deg).padStart(3)}deg` +
    `  ${s.d} m  ->  ${got ?? 'silent'}`);
}
if (leaks.length) {
  for (const l of leaks.slice(0, 4)) {
    await goto(l.x, l.z, l.sx, l.sz);
    await p.screenshot({ path: `shots/A-leak-${l.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png` });
  }
}

console.log(`\nB. KEEPERS STILL WORK — approached from outside their own radius\n`);
const KEEPERS = [
  ['the ATM',         -7,     7.29,  -5.6,   7.29],
  ['the bus bench',    6.15, -35.45,  4.8,  -35.45],
  ['the bodega door',  7.47, -95.53,  8.6,  -94.4],
  ['a park bench',    -8.65, -19.43, -7.4,  -19.43],
  ['the shelter',    -34.85, -83,   -33.6, -83],
];
const dead = [];
for (const [name, sx, sz, px, pz] of KEEPERS) {
  const got = await goto(px, pz, sx, sz);
  if (!got) dead.push(name);
  console.log(`  ${name.padEnd(16)} from (${px},${pz})  ${got ? `"${got}"` : 'NOTHING — keeper is dead'}`);
}

console.log(`\n${'='.repeat(70)}`);
console.log(`blocked stations tested: ${stations.length}`);
console.log(`leaked through a wall:   ${leaks.length}`);
console.log(`keepers dead:            ${dead.length} of ${KEEPERS.length}${dead.length ? ' — ' + dead.join(', ') : ''}`);
await b.close();
if (!stations.length) {
  console.error(`\nCANNOT ANSWER — no standable station has a collider between it and a live spot, so nothing was tested.`);
  process.exit(3);
}
if (leaks.length || dead.length) {
  console.error(`\nMEASURED WRONG — ${leaks.length} leak(s) through a wall, ${dead.length} dead keeper(s).`);
  process.exit(1);
}
console.log(`\nMEASURED FINE — every wall stopped the selection, and every keeper still answered.`);
