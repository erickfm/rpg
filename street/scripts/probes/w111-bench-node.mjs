// ITEM 276, the second half: the "wait for the 42" errand never fires.
//
// Over 480 s of watching (two runs of w111-npc-stranded) the crowd produced 58
// stationary episodes and NOT ONE of them was the `bench` errand -- the one
// activity authored specifically for the bus stop, and the longest of the five
// (`ct/crowd.ts:637`, `bench: [12, 25]  // wait for the 42`).
//
// That matters for item 276 directly: if citizens DID wait at the bus stop, two
// of them standing motionless beside it would be the feature working. They do
// not, so whatever the user photographed, it was not that.
//
// This asks the route net itself rather than waiting for the dice:
//   * is `e-bench` reachable at all (netRoute to it)?
//   * where does the net think the bench is, against where props.ts stands it?
//   * does the east walk's ring edge pass through item 269's 1.15 m pinch?
//
// READ-ONLY. Item 276 says measure and stop.
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted } from '../lib/painted.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4672/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await waitPainted(p, { quiet: true });

// out of the flat, per GOTCHAS 79b
for (let i = 0; i < 6; i++) {
  await p.evaluate(() => window.__ct.warp(6.3, -44, 0, 0, 0));
  await waitPainted(p, { quiet: true }); await p.waitForTimeout(250);
  const q = await p.evaluate(() => window.__ct.pos());
  if (Math.hypot(q[0] - 6.3, q[2] + 44) < 2) break;
}
const cull = await p.evaluate(() => window.__ct.cullInfo());
if (cull.hiding) { console.error('ABORT: exterior culled (GOTCHAS 79b)'); process.exit(3); }

// ── the bench, as the WORLD stands it ────────────────────────────────────────
const bench = await p.evaluate(() => {
  const cs = window.__ct.staticColliders();
  for (const c of cs) {
    const w = c.maxX - c.minX, d = c.maxZ - c.minZ;
    if (w > 0.5 && w < 0.9 && d > 1.6 && d < 2.1 && c.minX > 4.5 && c.maxX < 6.5
      && c.minZ > -37 && c.maxZ < -33) return c;
  }
  return null;
});
const R = await p.evaluate(() => window.__ct.playerRadius());
console.log(`bench collider   x ${bench.minX.toFixed(3)}..${bench.maxX.toFixed(3)}`
  + `  z ${bench.minZ.toFixed(3)}..${bench.maxZ.toFixed(3)}   centre z ${((bench.minZ + bench.maxZ) / 2).toFixed(3)}`);
console.log(`player radius    ${R.toFixed(3)}   ->  envelope edge x ${(bench.maxX + R).toFixed(3)}`);

// ── the net's own idea of where things are ───────────────────────────────────
for (const [a, c] of [['e-pawn', 'e-bench'], ['e-bench', 'e-tax'], ['e-pawn', 'e-tax']]) {
  const r = await p.evaluate(([x, y]) => {
    try { return window.__ct.netRoute(x, y); } catch (e) { return { error: String(e) }; }
  }, [a, c]);
  if (!r || r.error) { console.log(`route ${a} -> ${c}: ${r ? r.error : 'null'}`); continue; }
  const pts = r.points || r.nodes || r;
  console.log(`route ${a} -> ${c}: ${JSON.stringify(pts).slice(0, 400)}`);
}

// ── does the east ring edge cross the pinch? ─────────────────────────────────
// The pinch is z -35.8..-34.3 at x ~6. Any east-walk route between a node north
// of it and one south of it must pass through it.
console.log('\nthe crowd\'s east lane, and the pinch:');
const lane = await p.evaluate(() => {
  const w = window.__ct.walkers();
  return w.map((k) => k.x);
});
console.log(`  walkers' x right now: ${lane.map((v) => v.toFixed(2)).join(', ')}`);
console.log(`  item 269's pinch: east walk z -35.8..-34.3, 1.15 m wide`);
console.log(`  bench envelope edge ${(bench.maxX + R).toFixed(3)}  vs  east lane x 6.00`
  + `  -> the lane is ${((bench.maxX + R) - 6.0).toFixed(3)} m INSIDE the envelope`);

await b.close();
