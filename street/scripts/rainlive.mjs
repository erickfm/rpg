// DOES rainLevel ACTUALLY RISE AT AN HOUR rainAt() CALLS RAINING?
//
// An inbox item routed to B says rainLevel and wetness stay 0 even at an hour
// rainAt() reports as raining. It has NO LEDGER ROW — live.sh has never listed
// it, so nobody would ever have built it. This is the measurement it needs
// before anyone decides whether there is a fault at all.
//
// TWO TRAPS I HAVE ALREADY FALLEN INTO ON THIS EXACT SIGNAL, both guarded here:
//   · the spawn is INDOORS at x 198.6, and updateRain cuts rain above x 100 —
//     "it never rains indoors". Measuring from spawn reads 0 forever and looks
//     exactly like the reported bug. Warp OUTSIDE first.
//   · rainLevel LERPS toward its target at dt*0.6, so one frame after the clock
//     moves it is still ~0. Wait for it to settle, do not sample once.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto, settle } from './lib/reachable.mjs';

const URL = aim('http://localhost:4279/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 620 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await settle(p);

// which hours does the world itself call raining? Ask it, do not re-derive the
// formula — two scripts once carried hand-copies of rainAt() and drifted.
const hours = await p.evaluate(() => {
  const f = window.__ct.scene().userData.rainAt;
  if (typeof f !== 'function') return null;
  const out = [];
  for (let h = 0; h < 48; h++) if (f(h)) out.push(h);
  return out;
});
if (!hours) { console.log('scene.userData.rainAt is not published — cannot ask the world'); await b.close(); process.exit(2); }
console.log(`\n  rainAt() says these absolute hours rain: ${hours.join(', ') || '(none in 48)'}`);
if (!hours.length) { console.log('  nothing to test'); await b.close(); process.exit(0); }

const read = () => p.evaluate(() => {
  const u = window.__ct.scene().userData;
  return { rain: u.rainLevel, wet: u.wetness, pos: window.__ct.pos()[0] };
});

for (const label of ['INDOORS (the spawn, x ~198) — expected 0 by design', 'OUTDOORS on the pavement']) {
  const outdoors = label.startsWith('OUTDOORS');
  if (outdoors) await p.evaluate(() => window.__ct.warp(-6, -40, 0, 0.14, 0));
  const h = hours[0];
  // ABSOLUTE, never `h % 24`. `crosstown.ts:805` sets `totalMin = h * 60 + m`
  // and `hourAbs` is `Math.floor(totalMin / 60)`, so `clock(h)` sets the
  // absolute hour to exactly `h` — and `rainAt` hashes that absolute hour
  // through murmur3's finalizer, which is NOT periodic in 24. `h % 24` asks the
  // world a different question than the `rainAt(h)` above answered, and lands
  // on a dry hour: w16 read `rainLevel 0.0000` for sixteen straight seconds
  // that way. It happens to be harmless TODAY only because `hours[0]` is 0 —
  // the search starts at 0 and 30% of hours rain, so the first hit is
  // essentially always under 24 and `h % 24 === h`. That is luck, not
  // correctness, and it stops being true the moment anyone narrows the search
  // to daylight (`hours.find(x => x % 24 >= 11)`) — which is exactly what
  // `rain-check.mjs` now does, and it would then test a dry hour silently.
  await p.evaluate(([hh]) => window.__ct.clock(hh, 30), [h]);
  // let the lerp settle rather than sampling once
  let last = null, r = null;
  for (let i = 0; i < 30; i++) {
    await p.waitForTimeout(300);
    r = await read();
    if (last !== null && Math.abs(r.rain - last) < 0.002 && r.rain > 0.01) break;
    last = r.rain;
  }
  console.log(`\n  ${label}`);
  console.log(`    at absolute hour ${h} (${h % 24}:30), x ${r.pos.toFixed(1)}   rainLevel ${r.rain?.toFixed(4)}   wetness ${r.wet?.toFixed(4)}`);
}

// and let the ground catch up: wetness rises fast and falls slowly
let w = null;
for (let i = 0; i < 40; i++) { await p.waitForTimeout(400); w = await read(); if (w.wet > 0.5) break; }
console.log(`\n  after settling outdoors: rainLevel ${w.rain?.toFixed(4)}  wetness ${w.wet?.toFixed(4)}`);
console.log(`  -> ${w.rain > 0.05 ? 'IT RAINS. The reported fault does not reproduce outdoors.'
                                  : 'rainLevel STAYS 0 OUTDOORS — the report holds.'}`);
await b.close();
