// H: is the east end REACHABLE and sane from where people actually are?
//
// Traffic counts cannot answer this: the world runs 6 walkers, ~15% of trips
// are long-range and 2 of ~14 act-nodes are at the east end, so the expected
// number of east trips in 150 s is about 0.6. Observing zero is the dice, not
// a fault. Routing is deterministic and answers the question directly.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4187/');
const FROM = ['w-diner', 'n-bodega', 'e-bench'];
const TO = ['n-win1', 's-win2', 's-east', 'ne-corner', 'se-jail', 'ne-jail'];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.netRoute, null, { timeout: 60000 });
let bad = 0;
for (const f of FROM) {
  for (const t of TO) {
    const r = await p.evaluate(([a, c]) => window.__ct.netRoute(a, c), [f, t]);
    if (!r) { console.log(`  NO ROUTE  ${f} -> ${t}`); bad++; continue; }
    const road = r.edges.filter((e) => e.road);
    console.log(`  ${f.padEnd(10)} -> ${t.padEnd(10)} ${String(r.hops).padStart(2)} hops ${r.len.toFixed(1).padStart(6)} m` +
                `  road hops ${road.length}${road.length ? ' (' + road.map((e) => `${e.from}->${e.to}`).join(', ') + ')' : ''}`);
    // every road hop must be one of the two junction crossings
    for (const e of road) {
      const okPair = (e.from === 's-win1' && e.to === 'n-bodega') || (e.from === 'n-bodega' && e.to === 's-win1')
                  || (e.from === 'n-corner' && e.to === 'w-corner') || (e.from === 'w-corner' && e.to === 'n-corner');
      if (!okPair) { console.log(`     ^ UNEXPECTED road hop ${e.from}->${e.to}`); bad++; }
    }
  }
}
console.log(bad ? `\n  FAIL — ${bad} problem(s).`
                : '\n  every east-end node is reachable, and every road hop on the way is a junction crossing.');
await b.close();
process.exit(bad ? 1 : 0);
