// WHERE is the library crowded, and where is it spacious? Item 115.
//
// The user: "library is crowded in some areas and spacious in others. try a
// different layout thanks." That is a claim about the DISTRIBUTION of free
// floor, not about any one object, so it needs a map rather than an inspection.
//
// Method: grid the room's floor, and for every cell measure the CLEARANCE --
// the distance from that point to the nearest collider. Cells inside a collider
// are furniture. Then look at how the free cells are spread.
//
//   crowded  = free floor whose clearance is under gap.ts's own PASSABLE (0.95 m
//              corridor => 0.475 m clearance from the centre line). Below that a
//              player can enter and not leave -- the project's trap threshold,
//              not a number I chose.
//   spacious = free floor more than 2 m from anything, i.e. floor doing nothing.
//
// TRAPS THIS PROBE WAS WRITTEN AROUND, all documented by worker eightyseven
// (notes/eightyseven-item158-library-stand.md):
//   * `roomDims()` returns an ARRAY of {id,w,d,cx,cz}. `dims.library` is
//     undefined and silently sweeps the whole world -- 3931 meshes instead of
//     481. So: look up BY id, and THROW if the library is not there.
//   * A walk that "passed" from 78 m away. Every collider is filtered to the
//     room's own footprint before anything is counted, and the count is printed.
// POPULATION FLOOR on both axes: no colliders in the room, or no free cells,
// is a FAILURE, not a clean sheet.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL || 'http://localhost:4177/';
const STEP = Number(process.env.STEP || 0.25);
const TIGHT = 0.475;   // half of gap.ts PASSABLE 0.95
const OPEN = 2.0;

const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct && window.__ct.roomDims, null, { timeout: 60000 });

const room = await p.evaluate(() => {
  const dims = window.__ct.roomDims();
  if (!Array.isArray(dims)) throw new Error('roomDims() is not an array - re-read the trap note');
  const r = dims.find((d) => /library/i.test(d.id));
  if (!r) throw new Error(`no library in roomDims(); ids: ${dims.map((d) => d.id).join(',')}`);
  return r;
});

const { cells, nCol, occ, room: rb } = await p.evaluate(({ room, STEP }) => {
  const { cx, cz, w, d } = room;
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  // Only colliders whose box overlaps this room's footprint. A collider 78 m
  // away must not be able to influence a clearance reading in here.
  const all = window.__ct.colliders();
  const inRoom = all.filter((c) => c.maxX > x0 && c.minX < x1 && c.maxZ > z0 && c.minZ < z1);
  const cells = [];
  let occ = 0;
  for (let x = x0 + STEP / 2; x < x1; x += STEP) {
    for (let z = z0 + STEP / 2; z < z1; z += STEP) {
      let inside = false, best = Infinity;
      for (const c of inRoom) {
        const dx = Math.max(c.minX - x, 0, x - c.maxX);
        const dz = Math.max(c.minZ - z, 0, z - c.maxZ);
        if (dx === 0 && dz === 0) { inside = true; break; }
        const dist = Math.hypot(dx, dz);
        if (dist < best) best = dist;
      }
      if (inside) { occ++; cells.push({ x, z, c: -1 }); }
      else cells.push({ x, z, c: best });
    }
  }
  return { cells, nCol: inRoom.length, occ, room: { x0, x1, z0, z1 } };
}, { room, STEP });

const free = cells.filter((c) => c.c >= 0);
const tight = free.filter((c) => c.c < TIGHT);
const open = free.filter((c) => c.c > OPEN);
const area = (n) => (n * STEP * STEP).toFixed(1);

console.log(`library  id=${room.id}  ${room.w.toFixed(2)} x ${room.d.toFixed(2)} m  centre (${room.cx.toFixed(1)}, ${room.cz.toFixed(1)})`);
console.log(`colliders inside the room footprint: ${nCol}`);
console.log(`grid ${STEP} m -> ${cells.length} cells, ${occ} furniture, ${free.length} free floor`);

// POPULATION FLOOR
if (nCol === 0) { console.log('FAIL: zero colliders in the room - measuring nothing'); process.exit(1); }
if (free.length === 0) { console.log('FAIL: zero free cells - measuring nothing'); process.exit(1); }

console.log(`\nfree floor ${area(free.length)} m2`);
console.log(`  CROWDED  clearance < ${TIGHT} m : ${tight.length} cells  ${area(tight.length)} m2  ${(100 * tight.length / free.length).toFixed(1)}%`);
console.log(`  SPACIOUS clearance > ${OPEN} m  : ${open.length} cells  ${area(open.length)} m2  ${(100 * open.length / free.length).toFixed(1)}%`);

const cl = free.map((c) => c.c).sort((a, x) => a - x);
const q = (f) => cl[Math.floor(f * (cl.length - 1))].toFixed(2);
console.log(`  clearance p10 ${q(0.1)}  median ${q(0.5)}  p90 ${q(0.9)}  max ${cl[cl.length - 1].toFixed(2)} m`);

// ── the map. z down the page, x across, so it reads like a plan ─────────────
console.log('\nplan  ("#" furniture  "x" crowded <0.475  "." normal  " " spacious >2m)');
const COLS = 78;
const cw = (rb.x1 - rb.x0) / COLS;
const ROWS = Math.max(1, Math.round((rb.z1 - rb.z0) / cw / 2));
const rh = (rb.z1 - rb.z0) / ROWS;
const grid = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => []));
for (const c of cells) {
  const ci = Math.min(COLS - 1, Math.floor((c.x - rb.x0) / cw));
  const ri = Math.min(ROWS - 1, Math.floor((c.z - rb.z0) / rh));
  grid[ri][ci].push(c.c);
}
const glyph = (v) => {
  if (!v.length) return '?';
  if (v.some((c) => c === -1)) return '#';
  const m = v.reduce((a, x) => a + x, 0) / v.length;
  if (m < TIGHT) return 'x';
  if (m > OPEN) return ' ';
  return '.';
};
console.log(`      x ${rb.x0.toFixed(1)} -> ${rb.x1.toFixed(1)}`);
for (let r = 0; r < ROWS; r++) {
  const z = (rb.z0 + (r + 0.5) * rh).toFixed(1).padStart(6);
  console.log(`${z} |${grid[r].map(glyph).join('')}|`);
}

// ── THE HONEST METRIC ────────────────────────────────────────────────────────
// The "crowded" percentage above OVERSTATES the case and I am not going to quote
// it as the finding. Any cell within 0.475 m of any object reads as crowded, so
// every piece of furniture in any room drags an apron of `x` around itself --
// a perfectly-spaced room would still score. It is useful for SHAPE (where the
// combs are) and worthless as a level.
//
// What the user actually described is a DISTRIBUTION: "crowded in some areas and
// spacious in others". So measure it directly -- split the room into zones and
// report what fraction of each is furniture. That has no apron artifact, and the
// SPREAD between zones is the number that matters, not any one zone's value.
const ZN = 4;
const zone = Array.from({ length: ZN }, () => Array.from({ length: ZN }, () => ({ n: 0, f: 0 })));
for (const c of cells) {
  const ci = Math.min(ZN - 1, Math.floor((c.x - rb.x0) / ((rb.x1 - rb.x0) / ZN)));
  const ri = Math.min(ZN - 1, Math.floor((c.z - rb.z0) / ((rb.z1 - rb.z0) / ZN)));
  zone[ri][ci].n++;
  if (c.c === -1) zone[ri][ci].f++;
}
console.log(`\nfurniture occupancy by zone (${ZN}x${ZN}, z down / x across) -- the spread IS the complaint`);
const pcts = [];
for (let r = 0; r < ZN; r++) {
  const row = zone[r].map((z) => {
    const pc = 100 * z.f / Math.max(1, z.n);
    pcts.push(pc);
    return `${pc.toFixed(0).padStart(3)}%`;
  });
  const z0 = (rb.z0 + r * (rb.z1 - rb.z0) / ZN).toFixed(1).padStart(6);
  console.log(`  z${z0} | ${row.join(' ')}`);
}
const lo = Math.min(...pcts), hi = Math.max(...pcts);
const mean = pcts.reduce((a, x) => a + x, 0) / pcts.length;
const sd = Math.sqrt(pcts.reduce((a, x) => a + (x - mean) ** 2, 0) / pcts.length);
console.log(`  emptiest zone ${lo.toFixed(0)}%   densest ${hi.toFixed(0)}%   spread ${(hi - lo).toFixed(0)} points   sd ${sd.toFixed(1)}`);

if (errs.length) console.log(`\npage errors: ${errs.length}\n${errs.slice(0, 3).join('\n')}`);
await b.close();
