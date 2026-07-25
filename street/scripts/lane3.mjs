// LANE AUDIT, final. Measured against `__ct.colliders()` — the array `fp.ts`
// actually tests — so a gap under 0.72 m means the player is physically stopped.
//
// Two corrections over the first attempts, both found by checking:
//
//  1. WALK-BASED PROBING DOES NOT WORK HERE. Warping the player to the building
//     face puts them inside the wall collider (the wall stops you at ±6.70, not
//     ±7.00), so every face-outward measurement is meaningless.
//  2. THE COLLIDER LIST CONTAINS MOVING BODIES. Citizens carry a ±0.25 m box
//     that follows them, and they walk the lane. Sampled once, a pedestrian
//     standing near the kerb reads as a 0.75 m pinch that is not there a second
//     later. So the list is sampled TWICE, a second apart, and anything whose
//     bounds moved is dropped — what is left is furniture.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { writeFileSync } from 'node:fs';

const R = 0.36, BODY = 2 * R, FACE = 7, ROAD_HALF = 5;
const WALKS = [
  { id: 'west walk',     cross: 'x', lo: -FACE,      hi: -ROAD_HALF, run: 'z', from: 14, to: -108 },
  { id: 'east walk',     cross: 'x', lo:  ROAD_HALF, hi:  FACE,      run: 'z', from: 14, to: -96  },
  { id: 'side st north', cross: 'z', lo: -98,        hi: -96,        run: 'x', from: 8,  to: 56   },
  { id: 'side st south', cross: 'z', lo: -110,       hi: -108,       run: 'x', from: -6, to: 56   },
];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
// Port: 4184 is ANOTHER WORKTREE (/home/erick/projects/rpg-audit). Left as the
// default so this keeps behaving as before, but SHOT_URL now wins, because a
// lane number measured in a checkout that is not yours is not about your work.
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4184/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, process.env.SHOT_URL ?? 'http://localhost:4184/');   // GOTCHAS 26: prove it, do not just name it
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);
const snap = async () => p.evaluate(() => window.__ct.colliders()
  .filter(c => c && isFinite(c.minX) && Math.abs(c.minX) < 500)
  .map(c => [+c.minX.toFixed(3), +c.maxX.toFixed(3), +c.minZ.toFixed(3), +c.maxZ.toFixed(3)]));
const a1 = await snap();
await p.waitForTimeout(1500);
const a2 = await snap();
const key = c => c.join('|');
const s2 = new Set(a2.map(key));
const stat = a1.filter(c => s2.has(key(c)));
console.log(`${a1.length} colliders, ${stat.length} static (${a1.length - stat.length} moving — citizens and traffic, dropped)\n`);

const out = [];
for (const W of WALKS) {
  const dir = W.to < W.from ? -1 : 1;
  const rows = [];
  for (let a = W.from; dir < 0 ? a >= W.to : a <= W.to; a += dir * 0.10) {
    const here = stat.filter(c => W.run === 'z' ? (a >= c[2] && a <= c[3]) : (a >= c[0] && a <= c[1]));
    const ivs = here.map(c => W.cross === 'x' ? [c[0], c[1]] : [c[2], c[3]])
      .map(([m, M]) => [Math.max(m, W.lo), Math.min(M, W.hi)])
      .filter(([m, M]) => M > m).sort((u, v) => u[0] - v[0]);
    const merged = [];
    for (const iv of ivs) {
      const last = merged[merged.length - 1];
      if (last && iv[0] <= last[1] + 1e-6) last[1] = Math.max(last[1], iv[1]); else merged.push([...iv]);
    }
    const edges = [W.lo, ...merged.flat(), W.hi];
    let widest = -Infinity, wb = null;
    for (let i = 0; i + 1 < edges.length; i += 2) {
      const g = edges[i + 1] - edges[i];
      if (g > widest) { widest = g; wb = [edges[i], edges[i + 1]]; }
    }
    rows.push({ at: +a.toFixed(2), widest: +widest.toFixed(3), gap: wb && wb.map(v => +v.toFixed(2)) });
  }
  out.push({ walk: W.id, rows });
}
const report = [];
for (const w of out) {
  let cur = null;
  for (const r of w.rows) {
    if (r.widest < 1.20) {
      if (cur && r.at - cur.last <= 0.25 + 1e-6) { cur.last = r.at;
        if (r.widest < cur.min) { cur.min = r.widest; cur.gap = r.gap; cur.atMin = r.at; } }
      else { cur = { walk: w.walk, from: r.at, last: r.at, min: r.widest, gap: r.gap, atMin: r.at }; report.push(cur); }
    } else cur = null;
  }
}
report.sort((x, y) => x.min - y.min);
writeFileSync('shots/lane-report.json', JSON.stringify({ static: stat.length, report }, null, 2));
const tag = c => c < 0.72 ? 'IMPASSABLE' : c < 0.80 ? 'URGENT' : c < 1.00 ? 'problem' : 'tight';
console.log('min gap  verdict     walk            tightest at   free span        length');
for (const r of report)
  console.log(`${r.min.toFixed(2).padStart(7)}  ${tag(r.min).padEnd(11)} ${r.walk.padEnd(15)} ` +
    `${String(r.atMin).padStart(11)}   ${(r.gap ? r.gap.join(' … ') : '-').padEnd(16)} ` +
    `${Math.abs(r.last - r.from).toFixed(1)} m`);
console.log(`\n${report.length} stretches under 1.20 m; clear lane elsewhere = kerb line to wall`);
await b.close();
