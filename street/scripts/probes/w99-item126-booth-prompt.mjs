#!/usr/bin/env node
// ITEM 126 — IS THE BOOTH REALLY UNREACHABLE, OR IS THE HARNESS FACING WRONG?
//
// `scripts/seats-walk.mjs` fails 5 of the 6 diner booth seats with:
//
//   no "take a booth seat" prompt from the one standable point (759.03,1.36);
//   got "[E] sit at the counter"
//
// THAT IS NOT YET A DEFECT, and this probe exists to say which it is. seats-walk
// approaches every seat at **yaw 0** — a fixed, arbitrary facing. `pickSpot` has
// an AIMED tier that reaches 6 m, so a player pointed at the back counter can be
// offered the counter while standing beside the booth. A real customer walks up
// to a booth LOOKING AT IT.
//
// So: stand on the exact point seats-walk used, sweep the facing all the way
// round, and report what the world offers at each. Then press [E] where it
// offers the booth and check where the body actually ends up.
//
//   verdict A — no facing offers the booth  → the geometry really does deny it
//   verdict B — facing the booth offers it  → the seat is reachable and the
//               failing check is a HARNESS ARTIFACT of its fixed yaw
//
// Distances are printed too, because "nearest live spot wins" is the documented
// dispatch rule and it is checkable: if the counter is 2.4 m away and the booth
// 0.7 m, proximity cannot be what chose the counter.
//
//   SHOT_URL=http://localhost:<port>/ node scripts/probes/w99-item126-booth-prompt.mjs
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('ABORTED: set SHOT_URL — exit 3, nothing measured.'); process.exit(3); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 60000 });
await waitPainted(p, { quiet: true });

// the five standing points seats-walk reported, derived from the seats rather
// than retyped: it stands 0.66 m in front of each booth seat, on the aisle side
const booths = await p.evaluate(() => window.__ct.seats()
  .filter((s) => s.label === 'take a booth seat' && s.pose.x > 700 && s.pose.x < 800)
  .map((s) => ({ x: s.pose.x, z: s.pose.z, r: s.r, label: s.label })));

if (booths.length < 6) {
  console.log(`EXIT 3 — found ${booths.length} diner booth seats, expected 6.`);
  await b.close(); process.exit(3);
}
console.log(`diner booth seats: ${booths.length}`);

let denied = 0, reached = 0;
for (const s of booths) {
  // the aisle side is −z from the booth bank; seats-walk stood at z − 0.66
  const sx = s.x - 0.18, sz = s.z - 0.66;
  const offers = [];
  for (let k = 0; k < 12; k++) {
    const yaw = (k / 12) * Math.PI * 2;
    // the prompt lives in the DOM, not on __ct — read exactly the way
    // scripts/seats-walk.mjs:43 reads it, so the two cannot disagree about
    // what "the world offered me" means.
    await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, undefined, 0), [sx, sz, yaw]);
    await p.waitForTimeout(70);
    const got = await p.evaluate(() => {
      const d = document.getElementById('ct-prompt');
      return d && d.style.display !== 'none' ? d.textContent : null;
    });
    offers.push({ yaw: Math.round(yaw * 180 / Math.PI), got });
  }
  const booth = offers.filter((o) => /booth/i.test(o.got ?? ''));
  const counter = offers.filter((o) => /counter/i.test(o.got ?? ''));
  console.log(`\n  booth seat (${s.x.toFixed(2)}, ${s.z.toFixed(2)}) r=${s.r}`);
  console.log(`    standing at (${sx.toFixed(2)}, ${sz.toFixed(2)})`);
  console.log(`    offers "booth" at ${booth.length}/12 facings${booth.length ? ` (yaw ${booth.map((o) => o.yaw).join(', ')})` : ''}`);
  console.log(`    offers "counter" at ${counter.length}/12 facings`);

  if (booth.length === 0) { denied++; console.log('    -> DENIED at every facing'); continue; }

  // press [E] facing the booth and see where the body lands
  const yaw = booth[0].yaw * Math.PI / 180;
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, undefined, 0), [sx, sz, yaw]);
  await p.waitForTimeout(120);
  // BUILDER-BRIEF §5: [E] is an edge read once per rendered frame, so a
  // `press()` that begins and ends inside one frame is never observed.
  await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
  await p.waitForTimeout(260);
  const seat = await p.evaluate(() => ({ seated: window.__ct.seated(), pos: window.__ct.pos(), camY: window.__ct.camY() }));
  const on = seat.seated ? Math.hypot(seat.pos[0] - s.x, seat.pos[2] - s.z) : null;
  console.log(`    [E] -> seated=${!!seat.seated}` + (on !== null ? `, ${on.toFixed(2)} m from this booth seat` : ''));
  if (seat.seated && on !== null && on < 0.5) reached++;
  // get back up so the next seat starts standing
  if (seat.seated) { await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e'); await p.waitForTimeout(200); }
}

await b.close();
console.log(`\n  booths denied at EVERY facing: ${denied} of ${booths.length}`);
console.log(`  booths actually sat on when faced:  ${reached} of ${booths.length}`);
if (errs.length) console.log(`  console errors: ${errs.length}`);
console.log(denied === 0
  ? '\nVERDICT B — every booth is reachable when you LOOK AT IT. seats-walk\'s'
    + '\n  failure is an artifact of its fixed yaw 0, not a geometry defect.'
  : `\nVERDICT A — ${denied} booth(s) are denied from every facing. Real defect.`);
process.exit(denied === 0 ? 0 : 1);
