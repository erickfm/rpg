// The clear lane along the north walk, x 8..20, and what narrows it.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { installCollide } from '../lib/collide.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4193/');
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.colliders !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
await installCollide(p);
await p.waitForTimeout(400);

const out = await p.evaluate(() => {
  const R = 0.36, S = 0.02;
  const cols = window.__ct.staticColliders();
  const free = (x, z) => !window.__probeCollide.blockedAt(cols, x, z, R);
  const rows = [];
  for (let x = 8; x <= 20; x += 0.25) {
    let best = 0, run = 0, bestEnd = null;
    for (let z = -99.5; z <= -95.5; z += S) {
      if (free(x, z)) { run += S; if (run > best) { best = run; bestEnd = z; } } else run = 0;
    }
    rows.push({ x: +x.toFixed(2), clear: +(best + 2 * R).toFixed(2),
      mid: bestEnd === null ? null : +(bestEnd - best / 2).toFixed(2) });
  }
  return rows;
});
console.log('\n  x      widest free lane (walkable width)   centre z');
for (const r of out) console.log(`  ${String(r.x).padStart(5)}   ${r.clear.toFixed(2)} m`.padEnd(40) + `${r.mid}`);
const worst = out.reduce((a, c) => (c.clear < a.clear ? c : a));
console.log(`\nnarrowest along x 8..20: ${worst.clear.toFixed(2)} m at x=${worst.x} (centre z ${worst.mid})`);
await b.close();
