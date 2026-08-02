// H: the east-end closure, tested the way it matters — can a walker still get
// from the south walk's east end to the north walk's east end, and does the
// route now go the LONG way round instead of straight up the carriageway?
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4187/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
p.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.netRoute, null, { timeout: 60000 });
const out = await p.evaluate(() => {
  const nr = window.__ct.netRoute;
  const r = nr('s-east', 'ne-corner');
  if (!r) return { err: 'no route — the two ends are now in different components' };
  return {
    hops: r.hops, len: +r.len.toFixed(1),
    roadHops: r.edges.filter((e) => e.road).map((e) => `${e.from}->${e.to} (${e.len} m)`),
    path: r.edges.map((e) => e.from).concat(r.edges.length ? r.edges[r.edges.length - 1].to : []),
  };
});
console.log(JSON.stringify(out, null, 1));
if (out.err) { console.log('\n  ORPHANED — closing the ring stranded the east end.'); }
else {
  const straight = out.roadHops.filter((h) => /s-east|ne-corner/.test(h));
  console.log(`\n  route s-east -> ne-corner: ${out.hops} hops, ${out.len} m`);
  console.log(`  road-flagged hops on it: ${out.roadHops.length}  ${JSON.stringify(out.roadHops)}`);
  console.log(straight.length
    ? '  STILL CROSSING AT THE EAST END — the edge is back.'
    : `  the east end is not crossed: ${out.hops} hops, ${out.len} m, 0 road hops.`);
}
await b.close();
