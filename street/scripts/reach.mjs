// CAN YOU ACTUALLY WALK THERE? A flood fill over standable ground, starting
// from where the player spawns, using the collider array the movement code
// itself tests. This answers "can you walk into the car lot" the way a player
// answers it -- by walking -- rather than by warping in and photographing.
//
// A warp can put you anywhere, including inside a building; reachability cannot.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 750 } });
await p.goto(aim('http://localhost:4184/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, aim('http://localhost:4184/'));   // GOTCHAS 26: prove it, do not just name it
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);

const R = await p.evaluate((seedMode) => {
  const RAD = 0.36, S = 0.5;
  const cols = window.__ct.colliders().filter(c => c && isFinite(c.minX) && Math.abs(c.minX) < 500);
  const free = (x, z) => !cols.some(c =>
    x > c.minX - RAD && x < c.maxX + RAD && z > c.minZ - RAD && z < c.maxZ + RAD);
  const X0 = -46, X1 = 62, Z0 = 6, Z1 = -140;
  const nx = Math.round((X1 - X0) / S), nz = Math.round((Z0 - Z1) / S);
  const ix = x => Math.round((x - X0) / S), iz = z => Math.round((Z0 - z) / S);
  const ok = new Uint8Array(nx * nz);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++)
    if (free(X0 + i * S, Z0 - j * S)) ok[j * nx + i] = 1;
  // Seed from the STREET, not from wherever the player happens to be.
  // The spawn moved to room 301 (x 198.6) and fell off this grid, so the flood
  // started on an out-of-range cell, reached nothing, and still exited 0.
  // Candidates are walkable street points; the first free one wins, and if none
  // is free we say so rather than flooding from nowhere.
  const q0 = window.__ct.pos();
  // REACH_SEED=pos reproduces the original fault (seed from the player, who is
  // now in room 301, off this grid) so the RED below can be shown to fire.
  const CAND = seedMode === 'pos' ? [[q0[0], q0[2]]]
             : [[-6.2, -40], [6.2, -40], [-6.2, -20], [6.2, -70], [0, -50], [30, -97]];
  let si = -1, sj = -1, seedAt = null;
  for (const [cx, cz] of CAND) {
    const i = ix(cx), j = iz(cz);
    if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
    if (!ok[j * nx + i]) continue;
    si = i; sj = j; seedAt = [cx, cz]; break;
  }
  let freeCells = 0; for (let k = 0; k < ok.length; k++) if (ok[k]) freeCells++;
  const seen = new Uint8Array(nx * nz);
  if (si < 0) return { seedFailed: true, spawn: [q0[0], q0[2]], freeCells, total: nx * nz };
  const stack = [[si, sj]]; seen[sj * nx + si] = 1;
  let n = 0;
  while (stack.length) {
    const [i, j] = stack.pop(); n++;
    for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const a = i + di, c = j + dj;
      if (a < 0 || c < 0 || a >= nx || c >= nz) continue;
      const k = c * nx + a;
      if (ok[k] && !seen[k]) { seen[k] = 1; stack.push([a, c]); }
    }
  }
  // A probe inside a collider SHOULD be unreachable - that is not a fault.
  // The fault is free ground you cannot get to, or a probe that fell off the grid.
  const at = (x, z) => { const i = ix(x), j = iz(z);
    if (i<0||j<0||i>=nx||j>=nz) return null;               // off-grid: cannot answer
    const k = j*nx+i;
    if (!ok[k]) return 'blocked';                          // solid: correctly unreachable
    return !!seen[k]; };
  // where does the reachable set extend to, east of the shopfront line?
  const east = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++)
    if (seen[j*nx+i] && X0 + i*S > 7.2) east.push([+(X0+i*S).toFixed(1), +(Z0-j*S).toFixed(1)]);
  const exs = east.map(q=>q[0]), ezs = east.map(q=>q[1]);
  return { spawn: [q0[0], q0[2]], seedAt, freeCells, reachable: n, total: nx*nz,
    east: { n: east.length, x0: east.length?Math.min(...exs):null, x1: east.length?Math.max(...exs):null,
            z0: east.length?Math.min(...ezs):null, z1: east.length?Math.max(...ezs):null },
    probes: {
      'car at (15.37,-99.12)': at(15.4, -99.1), 'car at (26.37,-106.8)': at(26.4, -106.8),
      'park interior (-14,-80)': at(-14, -80), 'library courtyard (-10.5,-13)': at(-10.5, -13),
      'east walk (6,-40)': at(6, -40), 'west walk (-6,-40)': at(-6, -40),
      'side st north (30,-97)': at(30, -97), 'far east (40,-100)': at(40, -100),
    } };
}, process.env.REACH_SEED || 'street');
// If we could not seed, nothing below is meaningful - say so before printing
// numbers that would look like results.
if (R.seedFailed) {
  console.error(`CANNOT ANSWER — no street seed point was walkable.`);
  console.error(`  player is at (${R.spawn.map(v=>v.toFixed(1)).join(', ')}), which is off this grid;`);
  console.error(`  ${R.freeCells} of ${R.total} cells are free, so the world is not empty — the SEED is the problem.`);
  console.error(`  This is the shape the check used to fail with, at exit 0.`);
  await b.close();
  process.exit(3);
}
console.log(`spawn (${R.spawn.map(v=>v.toFixed(1))}) · ${R.reachable} of ${R.total} grid cells reachable on foot`);
console.log(`\nreachable ground EAST of the shopfront line (x > 7.2): ${R.east.n} cells`);
if (R.east.n) console.log(`   x ${R.east.x0} … ${R.east.x1}   z ${R.east.z0} … ${R.east.z1}`);
console.log('\nprobes:');
for (const [k, v] of Object.entries(R.probes)) console.log(
  `   ${v === null ? 'off-grid' : v === 'blocked' ? 'inside a collider' : v ? 'REACHABLE' : 'NOT REACHABLE'}  ${k}`);
writeFileSync('shots/reach.json', JSON.stringify(R, null, 2));
await b.close();

// ── the verdict, which this check did not have ─────────────────────────────
// It reported "1 of 63072 cells reachable" and exited 0. A check that can
// describe a catastrophe and still pass guards nothing.
const frac = R.reachable / Math.max(1, R.freeCells);
console.log(`\nseeded at (${R.seedAt.join(', ')}) — ${R.reachable} of ${R.freeCells} FREE cells reachable (${(100*frac).toFixed(1)}%)`);
// Near-zero reachability is the RED this check was missing.
if (frac < 0.25) {
  console.error(`\n** FAIL: only ${(100*frac).toFixed(1)}% of walkable ground is reachable from the street.`);
  console.error(`   That is a broken world or a broken seed, and either way it is not a pass.`);
  process.exit(1);
}
// A probe sitting inside a collider is CORRECTLY unreachable and is not a fault.
// Free ground you cannot walk to is, and so is a probe that fell off the grid.
const offGrid = Object.entries(R.probes).filter(([, v]) => v === null);
const stranded = Object.entries(R.probes).filter(([, v]) => v === false);
const blocked = Object.entries(R.probes).filter(([, v]) => v === 'blocked');
if (blocked.length) {
  console.log(`\n${blocked.length} probe(s) sit inside a collider — correctly unreachable, not a fault:`);
  for (const [k] of blocked) console.log(`   ${k}`);
}
if (offGrid.length || stranded.length) {
  console.error(`\n** FAIL:`);
  for (const [k] of offGrid)  console.error(`   OFF-GRID, cannot be answered  ${k}`);
  for (const [k] of stranded) console.error(`   FREE GROUND but unreachable   ${k}`);
  process.exit(1);
}
console.log(`every landmark on free ground is reachable on foot`);
