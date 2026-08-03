// Item 227: is the side-street parked-car census STABLE, or did it just happen
// to find three once?
//
// The row's complaint was `side-walk.mjs` reporting "3 parked cars, 0 found".
// That was fixed at 210891b5f (the `&& o.visible` term, GOTCHAS 79b — the
// player spawns in apartment 301 at x=198.4, past regionCull's x>=100, so the
// whole outdoors reads visible===false at census time). This probe answers the
// separate question the fix does not: does it find three EVERY time?
//
// A FRESH PAGE PER RUN IS THE POINT, not laziness. side-walk.mjs takes its
// census "BEFORE any traffic is spawned", because parked and moving cars are
// the same models with the same userData. Re-running inside one page would
// measure a world that has had traffic in it, which is a different question.
//
// It also carries the count of how many were region-culled at the moment of
// measurement — that is the population the old `.visible` term was silently
// deleting, and printing it is what tells a future reader WHICH of the two
// populations moved if this ever disagrees again.
//
// Usage: SHOT_URL=http://localhost:4740/ node scripts/probes/w118-item227-census-spread.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('  NOT AIMED — pass SHOT_URL=http://localhost:<your port>/'); process.exit(2); }

const RUNS = 5;
const EXPECT = 3;

// The same box and the same predicate side-walk.mjs:84,119 uses. Copied rather
// than imported because that census lives inside a page.evaluate in a check
// script with no export (BUILDER-BRIEF §8: copied, and cited, not silently
// duplicated). If side-walk.mjs's box moves, this probe is measuring something
// else and this comment is how the next reader finds that out.
const census = () => {
  const out = { cars: [], hidden: 0 };
  window.__ct.scene().traverse((o) => {
    if (o.position.x < 8 || o.position.x > 60 || o.position.z > -95 || o.position.z < -112) return;
    if (o.type === 'Group' && o.userData.steer !== undefined) {
      out.cars.push(+o.position.y.toFixed(3));
      if (!o.visible) out.hidden++;
    }
  });
  return out;
};

const browser = await chromium.launch();
const rows = [];
for (let i = 0; i < RUNS; i++) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
  await page.waitForTimeout(400);
  rows.push(await page.evaluate(census));
  await page.close();
}
await browser.close();

const counts = rows.map((r) => r.cars.length);
const ys = [...new Set(rows.flatMap((r) => r.cars))];
const hidden = rows.map((r) => r.hidden);
for (let i = 0; i < rows.length; i++) {
  console.log(`  run ${i + 1}: ${counts[i]} cars at y=${[...new Set(rows[i].cars)].join(',') || '-'}, ${hidden[i]} region-culled`);
}
const lo = Math.min(...counts), hi = Math.max(...counts);
console.log(`\n  spread over ${RUNS} runs: ${lo}..${hi} cars (expected ${EXPECT}), y values seen: ${ys.join(',')}`);
console.log(`  region-culled at census time: ${Math.min(...hidden)}..${Math.max(...hidden)} of ${lo === hi ? lo : `${lo}..${hi}`}`);

// POPULATION FLOOR, and it is the whole reason this probe exists: a run that
// finds nothing must be a FAILURE, never a line of output (item 227's house
// rule). Asserted as a RANGE rather than a floor — "at least 3" would pass
// silently if some future change doubled the fleet, and the street is authored
// with exactly three parked cars (ct/sidestreet.ts:129-133).
const ok = counts.every((c) => c === EXPECT) && ys.length === 1 && ys[0] === 0;
console.log(ok
  ? `\n  STABLE — ${EXPECT} cars every run, all at y=0`
  : `\n  UNSTABLE — counts ${counts.join(',')}, y values ${ys.join(',')}`);
process.exitCode = ok ? 0 : 1;
