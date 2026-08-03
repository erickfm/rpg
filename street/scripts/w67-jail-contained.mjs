// CAN THE PLAYER WALK OUT OF THE WORLD AT THE JAIL? Item 175.
//
// The user, twice: *"side of the jail are still bugged and allow for out of
// bounds."*
//
//   SHOT_URL=http://localhost:4230/ node scripts/w67-jail-contained.mjs
//
// ── WHY THIS IS A FLOOD FILL AND NOT ANOTHER ROUTE ────────────────────────
//
// Two checks were already aimed at this building — `O-jail-walk.mjs` and
// `w15-jail-walk.mjs` — and both were GREEN over this hole, twice. The reason
// is not subtle and it is the whole lesson of the item: **every leg of both
// checks walks a route a person thought of.** `w15-jail-walk` walks the
// approach, the forecourt, the yard, the fence and the two YARD screen walls,
// and every one of its legs is aimed along the site's centre line `CZ` or at a
// wall someone knew about. Nothing walked the FORECOURT FLANKS, because nobody
// had thought of them — which is exactly why the gap was there.
//
// That is GOTCHAS 79 in a different costume: a check that examines only what
// its author enumerated reports green about everything they did not.
//
// So this asserts a PROPERTY instead of a route: **starting from the side
// street, no sequence of walks may put the player outside the jail's own
// site.** It never teleports to the far side of a wall — that would prove
// nothing about reachability and would fail on a perfectly sealed building —
// it only ever walks on from somewhere it has already legitimately reached.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { probeServer } from './lib/server-state.mjs';

const URL = aim('http://localhost:4230/');
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(13, 0));

let fails = 0;
const report = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };
const f = (n) => n.toFixed(2);

const site = await page.evaluate(() => window.__ct.sites().jail);
if (!site) { console.log('NO JAIL SITE — nothing measured'); await b.close(); process.exit(3); }

const pos = () => page.evaluate(() => window.__ct.pos());
const warp = (x, z, yaw) => page.evaluate(([x, z, yaw]) =>
  window.__ct.warp(x, z, yaw, window.__ct.groundAt(x, z) ?? 0.14, 0), [x, z, yaw]);

// THE ENVELOPE, DERIVED. East of the jail's frontage the only ground the player
// is entitled to stand on is the jail's own site — the side street's flanking
// buildings have ended by then, so anything outside `site.minZ…site.maxZ` out
// there is ground with no building on either side of it and sky above.
// TOL is one player radius: `fp.ts` stops the body centre short of a collider,
// so a legitimately-blocked player standing against the inside of the boundary
// wall reads a few centimetres proud of the line the wall is drawn on.
const TOL = 0.60;
const outside = (p) => p[0] > site.minX + 0.5
  && (p[2] > site.maxZ + TOL || p[2] < site.minZ - TOL);

console.log(`jail site x ${site.minX}…${site.maxX}  z ${site.minZ}…${site.maxZ}`);
console.log(`escape = standing east of x ${f(site.minX + 0.5)} with z outside `
  + `${f(site.minZ - TOL)}…${f(site.maxZ + TOL)}\n`);

// ── the flood fill ────────────────────────────────────────────────────────
// Seeded in the MIDDLE OF THE SIDE STREET, west of the frontage: somewhere the
// player unambiguously reaches by walking from the rest of the world.
const CZ = (site.minZ + site.maxZ) / 2;
const seeds = [[site.minX - 6, CZ]];
const seen = new Set();
// 3 m CELLS, arrived at by measurement over three attempts, all recorded
// because the next person to touch this will be tempted to make it finer:
//
//   0.5 m  did not converge at all — 220 walks left 198 places queued. Sixteen
//          walks from one place land in sixteen distinct half-metre cells, so
//          the frontier grows faster than the budget spends it.
//   2.0 m  converged only sometimes. Walk outcomes vary a little between runs,
//          and two runs at the same budget ended 0 and 26 places short. A check
//          that is complete on Tuesday is not a check.
//   3.0 m  saturates at 35 places / 280 walks with room to spare.
//
// COARSER THAN THE 1.68 m SLOT, deliberately, and it does not weaken the
// assertion: the fill does not have to SAMPLE the hole, it has to stand
// somewhere it can walk INTO the hole from, and it walks 2.97 m in eight
// directions from every cell. Whether 3 m is still sensitive enough is not
// argued here — the `jail-forecourt-open` mutation is what settles it.
const GRID = 3.0;
const key = (x, z) => `${Math.round(x / GRID)},${Math.round(z / GRID)}`;
// SCOPED TO THE JAIL, and stated rather than implied. Walks that leave this box
// are still CHECKED for escape — that is the assertion — they are simply not
// pushed back as new frontier, because the rest of the street is not this
// check's subject and following it would never terminate.
const inScope = (x, z) => x > site.minX - 12 && x < site.maxX + 4
  && z > site.minZ - 8 && z < site.maxZ + 8;
const escapes = [];
let frontier = seeds;
// BUDGETED, because an unbounded fill is not a check anybody runs, and
// BUILDER-BRIEF §3 is explicit that a slow run is made SMALLER rather than
// asynchronous. **A BUDGET THAT RUNS OUT IS REPORTED, NOT SWALLOWED** — a sweep
// that stopped early and still said "contained" would be precisely the sleeping
// guard this file exists to replace. It caught its own author twice.
//
// 700 against an observed cost of 280: the headroom is for the world growing,
// and if it is ever spent the run says so and goes red rather than shrinking
// what it covers.
//
// MS IS 900, AND IT IS VALIDATED BY THE MUTATION RATHER THAN BY ARGUMENT.
// Shortening a leg to make a slow check finish is the exact shape of "loosen it
// until it passes" that BUILDER-BRIEF §7 forbids, so the setting is defensible
// only because the check still goes red on the real bug at it — the
// `jail-forecourt-open` case in canfail.mjs is what says so, not this comment.
// 900 ms at the player's 3.3 m/s is 2.97 m, and the fill crosses the 3.9 m
// forecourt in stages rather than needing one leg to clear it.
const DIRS = 8, MS = 900, ROUNDS = 6, BUDGET = 700;
let walks = 0;
let exhausted = false;

for (let round = 0; round < ROUNDS && frontier.length && !exhausted; round++) {
  const next = [];
  const queued = new Set();
  for (const [sx, sz] of frontier) {
    if (walks >= BUDGET) { exhausted = true; break; }
    if (seen.has(key(sx, sz))) continue;
    seen.add(key(sx, sz));
    for (let d = 0; d < DIRS && walks < BUDGET; d++) {
      const yaw = (d / DIRS) * Math.PI * 2;
      await warp(sx, sz, yaw);
      await page.waitForTimeout(90);
      await page.keyboard.down('w');
      await page.waitForTimeout(MS);
      await page.keyboard.up('w');
      await page.waitForTimeout(70);
      walks++;
      const p = await pos();
      if (outside(p)) escapes.push({ from: [+sx.toFixed(1), +sz.toFixed(1)], yaw: +yaw.toFixed(2), to: [+p[0].toFixed(2), +p[2].toFixed(2)] });
      // Deduped AS IT IS BUILT, against both the visited set and the rest of
      // this round. Pushing unconditionally is what made the first version
      // diverge — the frontier counted sixteen entries per place that were all
      // the same cell.
      const k = key(p[0], p[2]);
      if (!seen.has(k) && !queued.has(k) && inScope(p[0], p[2])) { queued.add(k); next.push([p[0], p[2]]); }
    }
  }
  frontier = next;
  console.log(`  round ${round + 1}: ${walks} walks so far, ${seen.size} places stood, ${escapes.length} escape(s)`);
}

// ── DID THE WORLD SURVIVE THE SWEEP? ──────────────────────────────────────
//
// This is a ten-minute walk, and it reports "contained" by finding NOTHING —
// which is exactly the verdict a dead server also produces, because a page that
// has stopped answering returns the same position for every walk and none of
// them is outside anything.
//
// **It happened to me while building this file.** The preview was reaped
// mid-sweep and the run carried on happily to round 3, printing `0 escape(s)`
// about a world that was no longer there. A containment check that goes green
// when the world disappears is the worst kind of sleeping guard, because the
// thing it guards is the worst kind of bug.
//
// Asked with `probeServer` from `scripts/lib/server-state.mjs` — the classifier
// written for item 182 — so this distinguishes a killed preview from one whose
// `dist/` a build has momentarily emptied, rather than calling both "dead".
const endState = await probeServer(URL);
report('the world was still serving when the sweep finished', endState === 'ok',
  endState === 'ok' ? 'the preview answered at the end as well as the start'
    : `the server went '${endState}' during the run — EVERY result above is unmeasured, not green`);

// A run that ran out of budget has not covered the site, and must not be read
// as a clean bill of health. Reported as its own line rather than folded into
// the verdict, so "we did not finish" can never be mistaken for "it is sealed".
// "SPENT THE BUDGET" AND "STOPPED WITH WORK LEFT" ARE NOT THE SAME THING, and
// conflating them made this line red on a run that had in fact saturated: the
// fill emptied its frontier on the very walk that reached the ceiling. What
// makes a run incomplete is unexplored places remaining, not the counter.
const incomplete = exhausted && frontier.length > 0;
report('the sweep covered the site rather than running out of budget', !incomplete,
  incomplete
    ? `stopped at the ${BUDGET}-walk budget with ${frontier.length} place(s) still unexplored — RAISE IT, this run proves nothing`
    : `the fill saturated: ${seen.size} places, ${walks} of ${BUDGET} walks, nothing left queued`);

report('the player cannot walk out of the world at the jail', escapes.length === 0,
  escapes.length
    ? `${escapes.length} of ${walks} walks ended outside the site — worst z `
      + `${f(Math.min(...escapes.map((e) => e.to[1])))} … ${f(Math.max(...escapes.map((e) => e.to[1])))}`
      + `\n      e.g. ${JSON.stringify(escapes.slice(0, 4))}`
    : `${walks} walks from ${seen.size} reachable places, every one finished inside the site`);

// THE FORECOURT IS STILL WALKABLE. Sealing a hole by walling off the thing the
// player is meant to reach would pass the test above and ruin the building, so
// the fix has to be shown not to have done that. 2 m lane, BRIEF §10.
const lane = await page.evaluate(([s]) => {
  const gaps = [];
  for (let z = s.minZ; z <= s.maxZ; z += 0.25) {
    let free = 0;
    for (const c of window.__ct.colliders() ?? []) {
      if (c.minX <= s.minX + 2 && c.maxX >= s.minX + 2 && c.minZ <= z && c.maxZ >= z) { free = 1; break; }
    }
    if (!free) gaps.push(+z.toFixed(2));
  }
  return { open: gaps.length ? Math.max(...gaps) - Math.min(...gaps) : 0 };
}, [site]);
report('the forecourt is still at least 2 m of open walking', lane.open >= 2.0,
  `${f(lane.open)} m of unobstructed z at x = site.minX + 2`);

report('no console errors during the sweep', errs.length === 0, `${errs.length} page error(s)`);
console.log(fails ? `\n${fails} FAILED` : '\nall contained');
await b.close();
process.exit(fails ? 1 : 0);
