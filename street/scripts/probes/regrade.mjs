// SPENT ONE-OFF — kept, not deleted, because scripts/grade-sane.mjs:5 names this
// file and grade-sane is a REGISTERED check I do not own. Deleting this would
// leave a live check citing a file that does not exist.
//
// Its subject is gone: the four verdicts it re-graded were published long ago and
// the park bounds bug it was written around is fixed. Do not run it for a
// verdict; the current grade is in notes/request-audit.md.
// RE-GRADE. Four verdicts landed since I wrote them, and one of them (the park
// as a yard) was measured while 25 m of the park were unreachable -- bounds.minX
// was -13.40 against a 32 m park, so every reading I took was of the first seven
// metres. This walks the FULL depth before re-grading anything.
//
// Reachability is a flood fill from where the player actually spawns, over the
// collider array the movement code itself tests. A warp can put you anywhere,
// including inside a building. Walking cannot.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 750 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4184/');   // GOTCHAS 26: prove it, do not just name it
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);

const R = await p.evaluate(() => {
  const RAD = 0.36, S = 0.5, X0 = -60, X1 = 70, Z0 = 16, Z1 = -150;
  const cols = window.__ct.colliders().filter(c => c && isFinite(c.minX) && Math.abs(c.minX) < 500);
  const free = (x, z) => !cols.some(c =>
    x > c.minX - RAD && x < c.maxX + RAD && z > c.minZ - RAD && z < c.maxZ + RAD);
  const nx = Math.round((X1 - X0) / S), nz = Math.round((Z0 - Z1) / S);
  const ix = x => Math.round((x - X0) / S), iz = z => Math.round((Z0 - z) / S);
  const ok = new Uint8Array(nx * nz);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++)
    if (free(X0 + i * S, Z0 - j * S)) ok[j * nx + i] = 1;
  const q0 = window.__ct.pos();
  const si = ix(q0[0]), sj = iz(q0[2]);
  if (si < 0 || sj < 0 || si >= nx || sj >= nz) return { err: `spawn (${q0[0]},${q0[2]}) is off the grid` };
  if (!ok[sj * nx + si]) return { err: `spawn (${q0[0]},${q0[2]}) is not free ground` };
  const seen = new Uint8Array(nx * nz);
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
  const at = (x, z) => { const i = ix(x), j = iz(z); return (i<0||j<0||i>=nx||j>=nz) ? null : !!seen[j*nx+i]; };
  const region = (x0, x1, z0, z1) => {
    const pts = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x = X0 + i*S, z = Z0 - j*S;
      if (x >= x0 && x <= x1 && z <= z0 && z >= z1 && seen[j*nx+i]) pts.push([x, z]);
    }
    if (!pts.length) return { n: 0 };
    const xs = pts.map(q=>q[0]), zs = pts.map(q=>q[1]);
    return { n: pts.length, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.max(...zs), z1: Math.min(...zs),
      areaM2: +(pts.length * S * S).toFixed(0) };
  };
  return { spawn: [q0[0], q0[2]], reachable: n, cells: nx*nz,
    park: region(-50, -7.2, -58, -104),          // whole park block, generously bounded
    east: region(7.2, 70, 0, -150),              // everything east of the shopfront line
    probes: {
      'park, 7 m in  (-12,-80)': at(-12, -80), 'park, 20 m in (-25,-80)': at(-25, -80),
      'park, 30 m in (-35,-80)': at(-35, -80),  'park far corner (-38,-98)': at(-38, -98),
      'library courtyard (-10.5,-13)': at(-10.5, -13),
      'church yard (2,-108)': at(2, -108), 'church door (2,-112)': at(2, -112),
      'car at (15.4,-99.1)': at(15.4, -99.1), 'car at (26.4,-106.8)': at(26.4, -106.8),
    } };
});
if (R.err) { console.log('FAILED: ' + R.err); await b.close(); process.exit(1); }
console.log(`spawn (${R.spawn.map(v=>v.toFixed(1))}) · ${R.reachable} of ${R.cells} cells reachable on foot\n`);
const show = (l, r) => console.log(r.n ? `${l}: ${r.areaM2} m² walkable · x ${r.x0} … ${r.x1} (${(r.x1-r.x0).toFixed(1)} m deep) · z ${r.z0} … ${r.z1}` : `${l}: NOTHING reachable`);
show('PARK ', R.park); show('EAST ', R.east);
console.log('\nprobes:');
for (const [k, v] of Object.entries(R.probes)) console.log(`   ${v === null ? 'off-grid' : v ? 'REACHABLE' : 'NOT reachable'}  ${k}`);
writeFileSync('shots/regrade.json', JSON.stringify(R, null, 2));
await b.close();
