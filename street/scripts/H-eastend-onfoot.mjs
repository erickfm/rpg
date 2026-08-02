// H: is EVERY METRE of the closed-end route on pavement?
//
// "No road-flagged hop" only says nobody LABELLED it a crossing. This says the
// ground under it is actually a footway - which is the distinction the original
// fault turned on: the deleted edge was unflagged AND in the road.
//
// Pavement reads groundAt 0.14, carriageway 0.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4187/');
const PAVE = 0.10;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.netRoute, null, { timeout: 60000 });
const r = await p.evaluate(() => window.__ct.netRoute('s-east', 'ne-corner'));
if (!r) { console.log('NO ROUTE — the closed end is orphaned'); await b.close(); process.exit(1); }
const roadHops = r.edges.filter((e) => e.road);
console.log(`route s-east -> ne-corner: ${r.hops} hops, ${r.len.toFixed(1)} m, road-flagged hops ${roadHops.length}`);
console.log('  ' + r.edges.map((e) => `${e.from}->${e.to} (${e.len}m)`).join('  '));

// the polyline, derived the same way the net derives it: SIDE_X1 = 55, IN = 1
const P = { 's-east': [54, -109], 'se-jail': [56, -109], 'ne-jail': [56, -97], 'ne-corner': [54, -97] };
const seq = r.edges.map((e) => e.from).concat(r.edges[r.edges.length - 1].to);
if (!seq.every((id) => P[id])) {
  console.log(`  route visits a node this probe has no coordinate for: ${seq.filter((i) => !P[i])}`);
  console.log('  NOT MEASURED (GOTCHAS §32)'); await b.close(); process.exit(3);
}
let n = 0, bad = [];
for (let i = 0; i + 1 < seq.length; i++) {
  const [x0, z0] = P[seq[i]], [x1, z1] = P[seq[i + 1]];
  const len = Math.hypot(x1 - x0, z1 - z0), steps = Math.max(2, Math.round(len / 0.5));
  for (let k = 0; k <= steps; k++) {
    const t = k / steps, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    const g = await p.evaluate(([a, c]) => window.__ct.groundAt(a, c), [x, z]);
    n++;
    if (g < PAVE) bad.push([+x.toFixed(2), +z.toFixed(2), +g.toFixed(2)]);
  }
}
console.log(`\n  sampled ${n} points every 0.5 m along the route`);
console.log(`  points on CARRIAGEWAY (ground < ${PAVE}): ${bad.length}`);
for (const [x, z, g] of bad.slice(0, 8)) console.log(`     (${x}, ${z}) ground ${g}`);
const ok = bad.length === 0 && roadHops.length === 0;
console.log(ok ? '\n  the ring closes ON PAVEMENT the whole way, and no hop is a crossing.'
               : '\n  FAIL — part of the closed-end route is in the road.');
await b.close();
process.exit(ok ? 0 : 1);
