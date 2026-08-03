// Item 230 — HOW COARSE IS TOO COARSE? The reachability fill in
// `scripts/world-contained.mjs` said there was no route across the park; the
// greedy walker had already crossed it twice. One of them is wrong, and which
// one decides whether the sweep can miss an escape.
//
// A discrete fill can only be wrong in two ways, and they have opposite costs:
//   UNDER-reach (the grid cannot represent a gap the player fits through) ->
//     reachable void goes unswept -> a SLEEPING GUARD, the expensive one.
//   OVER-reach (the fill cuts a corner the player cannot) -> a false escape,
//     which the walk then refuses to reproduce. Cheap and self-correcting.
// So this measures the park crossing at several resolutions and connectivities.
import { aim } from './../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './../lib/which-world.mjs';

const URL = aim('http://localhost:4410/');
const b = await chromium.launch();
const page = await b.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);

const r = await page.evaluate(() => {
  const RADIUS = 0.36;
  const B = window.__ct.bounds();
  const cols = window.__ct.staticColliders();
  const inFrame = (c, X, Z) => {
    if (!c.rot) return { x: X, z: Z };
    const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2, s = Math.sin(c.rot), k = Math.cos(c.rot);
    const dx = X - cx, dz = Z - cz;
    return { x: cx + dx * k - dz * s, z: cz + dx * s + dz * k };
  };
  const free = (x, z) => x >= B.minX && x <= B.maxX && z >= B.minZ && z <= B.maxZ
    && !cols.some((c) => {
      const q = inFrame(c, x, z);
      return q.x > c.minX - RADIUS && q.x < c.maxX + RADIUS && q.z > c.minZ - RADIUS && q.z < c.maxZ + RADIUS;
    });
  const out = { runs: [] };
  for (const [G, diag] of [[0.5, false], [0.5, true], [0.25, false], [0.25, true]]) {
    const key = (i, j) => i + ',' + j;
    const si = Math.round(-8 / G), sj = Math.round(-83 / G);
    const seen = new Set([key(si, sj)]); const q = [[si, sj]]; let h = 0;
    const dirs = diag ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
      : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (h < q.length && seen.size < 900000) {
      const [i, j] = q[h++];
      for (const [di, dj] of dirs) {
        const a = i + di, c = j + dj, k = key(a, c);
        if (seen.has(k)) continue;
        if (!free(a * G, c * G)) continue;
        seen.add(k); q.push([a, c]);
      }
    }
    let hit = null;
    for (let r = 0; r <= 10 && !hit; r++) {
      for (let di = -r; di <= r && !hit; di++) for (let dj = -r; dj <= r && !hit; dj++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = Math.round(-36 / G) + di, j = Math.round(-83 / G) + dj;
        if (seen.has(key(i, j))) hit = [+(i * G).toFixed(2), +(j * G).toFixed(2)];
      }
    }
    out.runs.push({ G, diag, cells: seen.size, reachedParkFarEnd: hit });
  }
  // Where does the park actually open? Continuous scan of the free z-span at
  // each x across the frontage, at 0.1 m — far finer than any fill.
  const spans = [];
  for (let x = -10; x <= -4; x += 0.5) {
    let n = 0, runMax = 0, run = 0;
    for (let z = -100; z <= -66; z += 0.05) {
      if (free(x, z)) { n++; run++; runMax = Math.max(runMax, run); } else run = 0;
    }
    spans.push(`x${x.toFixed(1)} open ${(n * 0.05).toFixed(1)}m widest-run ${(runMax * 0.05).toFixed(2)}m`);
  }
  out.frontage = spans;
  return out;
});
for (const x of r.runs) {
  console.log(`G=${x.G}${x.diag ? ' 8-connected' : ' 4-connected'}  ${String(x.cells).padStart(7)} cells  `
    + `park far end: ${x.reachedParkFarEnd ? 'REACHED at ' + JSON.stringify(x.reachedParkFarEnd) : 'NOT REACHED'}`);
}
console.log('\npark frontage, continuous 0.05 m scan of the free z-span:');
console.log(r.frontage.map((s) => '  ' + s).join('\n'));
await b.close();
