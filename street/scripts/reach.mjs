// CAN YOU ACTUALLY WALK THERE? A flood fill over standable ground, starting
// from where the player spawns, using the collider array the movement code
// itself tests. This answers "can you walk into the car lot" the way a player
// answers it -- by walking -- rather than by warping in and photographing.
//
// A warp can put you anywhere, including inside a building; reachability cannot.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 750 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4184/');   // GOTCHAS 26: prove it, do not just name it
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);

const R = await p.evaluate(() => {
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
  // start where the player actually is
  const q0 = window.__ct.pos();
  const seen = new Uint8Array(nx * nz);
  const si = ix(q0[0]), sj = iz(q0[2]);
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
  // where does the reachable set extend to, east of the shopfront line?
  const east = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++)
    if (seen[j*nx+i] && X0 + i*S > 7.2) east.push([+(X0+i*S).toFixed(1), +(Z0-j*S).toFixed(1)]);
  const exs = east.map(q=>q[0]), ezs = east.map(q=>q[1]);
  return { spawn: [q0[0], q0[2]], reachable: n, total: nx*nz,
    east: { n: east.length, x0: east.length?Math.min(...exs):null, x1: east.length?Math.max(...exs):null,
            z0: east.length?Math.min(...ezs):null, z1: east.length?Math.max(...ezs):null },
    probes: {
      'car at (15.37,-99.12)': at(15.4, -99.1), 'car at (26.37,-106.8)': at(26.4, -106.8),
      'park interior (-14,-80)': at(-14, -80), 'library courtyard (-10.5,-13)': at(-10.5, -13),
      'east walk (6,-40)': at(6, -40), 'west walk (-6,-40)': at(-6, -40),
      'side st north (30,-97)': at(30, -97), 'far east (40,-100)': at(40, -100),
    } };
});
console.log(`spawn (${R.spawn.map(v=>v.toFixed(1))}) · ${R.reachable} of ${R.total} grid cells reachable on foot`);
console.log(`\nreachable ground EAST of the shopfront line (x > 7.2): ${R.east.n} cells`);
if (R.east.n) console.log(`   x ${R.east.x0} … ${R.east.x1}   z ${R.east.z0} … ${R.east.z1}`);
console.log('\nprobes:');
for (const [k, v] of Object.entries(R.probes)) console.log(`   ${v === null ? 'off-grid' : v ? 'REACHABLE' : 'not reachable'}  ${k}`);
writeFileSync('shots/reach.json', JSON.stringify(R, null, 2));
await b.close();
