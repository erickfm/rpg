// CAN THE PLAYER WALK OUT OF THE WORLD AT AN OPEN SITE? Item 215.
//
// THIS IS ITEM 175's JAIL SWEEP MADE A CLASS. It was `w67-jail-contained.mjs`,
// and its author's own handoff (`notes/w67-jail-out-of-bounds.md`, last section)
// asked for exactly this: *"This is a class, not an instance. The same shape — a
// site whose z span is wider than the corridor that feeds it — is possible at
// every other published site."*
//
//   SHOT_URL=http://localhost:4310/ node scripts/w75-site-contained.mjs
//   SHOT_URL=http://localhost:4310/ node scripts/w75-site-contained.mjs park
//   SHOT_URL=http://localhost:4310/ node scripts/w75-site-contained.mjs park lot jail
//
// With no site named it runs EVERY site `__ct.sites()` publishes — so a site
// added tomorrow is swept without anyone remembering to add it here. That is
// deliberate: the whole failure this file exists to stop is a check that only
// examines what its author enumerated.
//
// ── WHY THIS IS A FLOOD FILL AND NOT ANOTHER ROUTE ────────────────────────
//
// Two checks were already aimed at the jail — `O-jail-walk.mjs` and
// `w15-jail-walk.mjs` — and both were GREEN over a hole 69 of 112 scripted
// walks fell through, twice. The reason is not subtle and it is the whole
// lesson: **every leg of both checks walks a route a person thought of.**
// Nothing walked the jail's forecourt flanks, because nobody had thought of
// them — which is exactly why the gap was there. That is GOTCHAS 79 in a
// different costume: a check that examines only what its author enumerated
// reports green about everything they did not.
//
// So this asserts a PROPERTY instead of a route: **starting from the street
// outside a site's frontage, no sequence of walks may put the player outside
// that site.** It never teleports to the far side of a wall — that would prove
// nothing about reachability and would fail on a perfectly sealed building — it
// only ever walks on from somewhere it has already legitimately reached.
//
// ── THE SHAPE OF THE BUG, so you know what is being hunted ────────────────
//
// The jail's root cause: the flank screens closed `BX → FENCE_X`, the YARD
// half, and **nothing ever closed `site.minX → FX`, the forecourt half.** A
// site sealed on one axis-half and open on the other looks complete in the
// source and in a screenshot. Every open site in this world can wear that.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { probeServer } from './lib/server-state.mjs';
import { installRayFloorQuery, selfTestRayQuery } from './lib/floors.mjs';

const URL = aim('http://localhost:4310/');
const ASK = process.argv.slice(2).filter((a) => !a.startsWith('-'));

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

const all = await page.evaluate(() => window.__ct.sites());
const names = ASK.length ? ASK : Object.keys(all);

// ── POPULATION FLOOR ON THE SUBJECT ITSELF ────────────────────────────────
//
// "0 escapes over 0 sites" is the same sentence as "0 escapes over 3 sites" if
// nobody counts, and a world that fails to publish its sites produces exactly
// that. `__ct.sites()` returning `{}` is a real state — the jail spent a commit
// in it, because `publishSite` is optional in `street.ts`'s params and the
// entry point did not pass it (street.ts:995). So: no sites, no verdict.
if (!names.length) {
  console.log('NO SITES PUBLISHED — nothing measured');
  await b.close(); process.exit(3);
}
const missing = names.filter((n) => !all[n]);
if (missing.length) {
  console.log(`NO SUCH SITE: ${missing.join(', ')} — published: ${Object.keys(all).join(', ') || '(none)'}`);
  await b.close(); process.exit(3);
}

const pos = () => page.evaluate(() => window.__ct.pos());
const warp = (x, z, yaw) => page.evaluate(([x, z, yaw]) =>
  window.__ct.warp(x, z, yaw, window.__ct.groundAt(x, z) ?? 0.14, 0), [x, z, yaw]);

// ── WHICH FACE IS THE FRONTAGE? DERIVED, NOT TYPED ────────────────────────
//
// Every open site in this world is a piece of street frontage given up, and
// `street.ts:655` writes the street edge as `XB = side * FACE` with the depth
// running away from it: `XF = XB + side * depth`. So **the frontage is whichever
// X face is nearer the street centreline x = 0**, for both runs, with no special
// case — which is the same sentence `openSite` is built out of.
//
//   park  x -39…-7   frontage maxX = -7   (side -1, XB = -FACE)
//   lot   x  7…30.2  frontage minX =  7   (side +1, XB = +FACE)
//   jail  x 57…75    frontage minX = 57   ("the frontage: the shell's old west
//                                           face", street.ts:981)
//
// **AND IT IS GUARDED RATHER THAN TRUSTED.** Guess the frontage wrong and the
// fill seeds against a sealed back wall, never gets in, walks a handful of legs
// on the pavement and finds no escapes — a textbook vacuous pass. The
// `entered the site` assertion below is what stops that: the fill has to stand
// in the site itself, repeatedly, or the run is not a measurement.
const frontOf = (s) => (Math.abs(s.minX) <= Math.abs(s.maxX)
  ? { at: s.minX, dir: +1 }        // enter walking east
  : { at: s.maxX, dir: -1 });      // enter walking west

// ── WHAT "OUT OF BOUNDS" MEANS, AND WHY IT IS NOT THE SITE RECTANGLE ──────
//
// Item 175's jail sweep called an escape "past the frontage plane and off the
// site's z span". **That is true of the jail and FALSE of the lot, and I found
// it out by running it.** At the jail the site's z span really is the corridor:
// the side street's flanking buildings stop at the frontage, so a metre outside
// it is sky. At the car lot the street CARRIES ON north past `maxZ` 14.20, so
// that predicate reported 21 escapes of which the first several were the player
// standing on the street.
//
// ⚠ THE JUSTIFICATION THAT USED TO SIT HERE WAS PARTLY FALSE, AND ITS
// EVIDENCE NEVER EXISTED. It read: *"there is real pavement out to z 16.75 — I
// walked out there and photographed it (`shots/w75-escape-z17.png`)"*. **That
// PNG is in no tree and no commit** — checked across all branches for item 238,
// as worker eightyfive first reported for item 230. And the claim is wrong:
// the drawn floor at those x stops at **z 14.0**, which eightyfive photographed
// as a hard edge with sky beyond (`shots/w85-north-z16-down.png`). The 16.75
// figure came from a bounding box covering ground that is not drawn — which is
// the very error this file used to make, quoted as the reason for making it.
// The conclusion above survives (a site rectangle is not the world's edge); the
// number and the photograph do not.
//
// A site rectangle is a claim about who OWNS ground, not about where the world
// ENDS. So the assertion here is the thing the user actually said —
// *"allow for out of bounds"* — asked of the scene:
//
//   **THE PLAYER MUST NEVER STAND WHERE THERE IS NO FLOOR.**
//
// `groundAt()` cannot answer that. `groundPick` (crosstown.ts:1263) falls all
// the way through to `return put(... ? KERB_H : 0)`: it never returns null, so
// it names a height for every point in R², void included. That is exactly why
// item 175 could say, correctly, "this was never a floor hole" — the picker is
// continuous over the emptiness as well as over the city.
//
// ── ITEM 238: THIS IS A RAYCAST NOW, AND THE BOUNDING BOXES WERE WRONG ────
//
// It used to take the floors from every mesh's axis-aligned BOUNDING BOX. Run
// against the exact triangle raycast over one shared point set of 731,322 cells
// (`scripts/probes/w91-floor-predicate-reconcile.mjs`) the two disagreed on
// **19,237 cells, and in BOTH directions**:
//
//   11,948 cells  boxes say FLOOR, raycast says VOID  — a box always covers
//                 more than the mesh inside it, so it claims ground that is
//                 not drawn. This is the one that makes a containment check
//                 GREEN OVER A HOLE, and it is why the z 16.75 claim above was
//                 wrong.
//    7,289 cells  boxes say VOID, raycast says FLOOR  — and this one was a
//                 surprise. The AABB pass DROPS any mesh more than 0.6 m thick
//                 in Y. Item 172 gave the park real topography on 2026-08-03,
//                 and its ground plane's world box is now **0.653 m** tall —
//                 53 mm over the threshold. So the park's entire 32 x 30 m
//                 floor, AND its 17.75 x 16.5 m field, became invisible to this
//                 predicate the day that landed, and this check's own park leg
//                 was about to report a park with no floor in it.
//                 (`scripts/probes/w91-park-ground-thickness.mjs`.)
//
// A predicate that is wrong in both directions is not the authority. The
// raycast projects each triangle onto the XZ plane, so vertical faces fall out
// for free (you cannot stand on a wall) and nothing has to be classified by
// size or by name — which is precisely the failure above. It is EXACT at
// arbitrary points rather than snapped to a grid, because a walk does not land
// on cells and a 0.36 m doorway gap can fall between two 0.5 m samples.
const ray = await installRayFloorQuery(page);
const hasFloor = (x, z, gy) => ray.query(x, z, gy);
const groundAt = (x, z) => page.evaluate(([x, z]) => window.__ct.groundAt(x, z), [x, z]);
// TOL / IN are kept for the INFORMATIONAL "left its own site" count below —
// useful to print, never asserted on, for the reason above.
const TOL = 0.60;
const IN = 0.5;

// ── THE PREDICATE IS SELF-TESTED IN-RUN, ON BOTH SIGNS ────────────────────
//
// A "no floor found" predicate that finds no floors anywhere goes red on a
// sealed world; one that finds a floor everywhere goes green on a hole. Both
// are silent, and this repo has shipped both shapes. So before a single leg is
// walked, the predicate is asked about a place that must be solid and a place
// that must be empty, and the run refuses to produce a verdict if it gets
// either wrong.
//
// The negative control is 60 m south of the world's south clamp (-110.6,
// crosstown.ts:1216) — a point the player provably cannot reach and that
// provably has nothing on it. The positive control is NOT (0, 0): the world
// origin has the road centre-line plane and five pooled traffic meshes sitting
// on it, so it reads floored with every ground plane in the world deleted.
// (world-contained.mjs:69-80.)
{
  const bad = await selfTestRayQuery(page, ray.query, ray.tris);
  if (bad.length) {
    console.log(`FLOOR PREDICATE FAILED ITS OWN CONTROLS — nothing measured:\n  ${bad.join('\n  ')}`);
    await b.close(); process.exit(3);
  }
  console.log(`floor predicate ok (raycast): ${ray.tris} triangles from ${ray.meshes} meshes `
    + `in ${ray.buckets} buckets, road solid, off-world void`);
}

// 3 m CELLS, inherited from item 175 with its measurements, which are kept
// because the next person here will be tempted to make them finer:
//
//   0.5 m  did not converge at all — 220 walks left 198 places queued.
//   2.0 m  converged only sometimes: two runs at one budget ended 0 and 26
//          places short. A check that is complete on Tuesday is not a check.
//   3.0 m  saturates. On the jail: 35 places / 280 walks.
//
// COARSER THAN THE 1.68 m SLOT it originally caught, deliberately, and it does
// not weaken the assertion: the fill does not have to SAMPLE a hole, it has to
// stand somewhere it can walk INTO the hole from, and it walks 2.97 m in eight
// directions from every cell.
const GRID = 3.0;
const DIRS = 8, MS = 900, ROUNDS = 8;
const key = (x, z) => `${Math.round(x / GRID)},${Math.round(z / GRID)}`;

const summary = [];

for (const name of names) {
  const site = all[name];
  const front = frontOf(site);
  const CZ = (site.minZ + site.maxZ) / 2;
  // INFORMATIONAL ONLY — see the note on the predicate above. This is item
  // 175's assertion, kept as a printed count because at the jail it is the same
  // number as the real one and it is worth seeing them agree (or not).
  const offSite = (p) => (front.dir > 0 ? p[0] > front.at + IN : p[0] < front.at - IN)
    && (p[2] > site.maxZ + TOL || p[2] < site.minZ - TOL);
  const inSite = (p) => p[0] > site.minX && p[0] < site.maxX && p[2] > site.minZ && p[2] < site.maxZ;

  // SCOPED, and stated rather than implied. Walks that leave this box are still
  // CHECKED for escape — that is the assertion — they are simply not pushed back
  // as new frontier, because the rest of the street is not this check's subject
  // and following it would never terminate.
  //
  // OUT is 4 m, not item 175's 12: the fill needs enough pavement to hold its
  // seeds and re-enter from, and no more. At 12 m the park's box swallows the
  // whole carriageway — 64 extra cells of road, 512 extra walks, ~18 minutes of
  // measuring a road nobody asked about. Narrowing it is not narrowing the
  // ASSERTION: an escape is still an escape wherever it lands.
  const OUT = 4, BACK = 4, SIDE = 8;
  const boxMinX = front.dir > 0 ? front.at - OUT : site.minX - BACK;
  const boxMaxX = front.dir > 0 ? site.maxX + BACK : front.at + OUT;
  const inScope = (x, z) => x > boxMinX && x < boxMaxX
    && z > site.minZ - SIDE && z < site.maxZ + SIDE;

  // BUDGET DERIVED FROM THE SITE, not typed. A saturating fill can cost at most
  // "every cell in the scope box, walked in every direction"; anything past that
  // is not a slow site, it is a fill that is not converging. Item 175's constant
  // 700 was right for an 18x14 site and would have silently truncated the park,
  // which is 2.5x the ground.
  const cells = Math.ceil((boxMaxX - boxMinX) / GRID) * Math.ceil((site.maxZ - site.minZ + 2 * SIDE) / GRID);
  const BUDGET = cells * DIRS;

  // Seeded on the STREET outside the frontage — somewhere the player
  // unambiguously reaches by walking from the rest of the world. Three seeds
  // across the frontage rather than one: a single centre seed is itself a route
  // someone thought of, and on a site whose middle is blocked (the lot's fence
  // line, the jail's forecourt obstacle) it can fail to get in at all.
  const sx = front.at - front.dir * 3;
  const seeds = [[sx, CZ], [sx, CZ - (site.maxZ - site.minZ) / 4], [sx, CZ + (site.maxZ - site.minZ) / 4]];

  console.log(`\n── ${name} ─────────────────────────────────────────────`);
  console.log(`site  x ${f(site.minX)}…${f(site.maxX)}  z ${f(site.minZ)}…${f(site.maxZ)}`);
  console.log(`frontage  x ${f(front.at)}, entered walking ${front.dir > 0 ? 'east' : 'west'}`);
  console.log('escape = finishing a walk with NO FLOOR MESH under you');
  console.log(`scope x ${f(boxMinX)}…${f(boxMaxX)}  budget ${BUDGET} walks (${cells} cells x ${DIRS})`);

  const seen = new Set();
  const escapes = [];
  let frontier = seeds, walks = 0, stoodInside = 0, leftSite = 0, exhausted = false;

  for (let round = 0; round < ROUNDS && frontier.length && !exhausted; round++) {
    const next = [];
    const queued = new Set();
    for (const [px, pz] of frontier) {
      if (walks >= BUDGET) { exhausted = true; break; }
      if (seen.has(key(px, pz))) continue;
      seen.add(key(px, pz));
      if (inSite([px, 0, pz])) stoodInside++;
      for (let d = 0; d < DIRS && walks < BUDGET; d++) {
        const yaw = (d / DIRS) * Math.PI * 2;
        await warp(px, pz, yaw);
        await page.waitForTimeout(90);
        await page.keyboard.down('w');
        await page.waitForTimeout(MS);
        await page.keyboard.up('w');
        await page.waitForTimeout(70);
        walks++;
        const p = await pos();
        if (offSite(p)) leftSite++;
        // `await`, AND IT IS LOAD-BEARING. The raycast query is a round trip to
        // the page, so `hasFloor` returns a Promise — and `!somePromise` is
        // always `false`, so dropping this `await` makes the escape branch
        // unreachable and the file becomes a check that CANNOT FAIL. That is
        // the exact defect class this file's own two-sign selftest exists to
        // stop, and the selftest would NOT have caught this one: it calls
        // `ray.query` directly and correctly, not through this line.
        if (!await hasFloor(p[0], p[2], await groundAt(p[0], p[2]))) {
          escapes.push({ from: [+px.toFixed(1), +pz.toFixed(1)], yaw: +yaw.toFixed(2), to: [+p[0].toFixed(2), +p[2].toFixed(2)] });
        }
        // Deduped AS IT IS BUILT, against both the visited set and the rest of
        // this round. Pushing unconditionally is what made item 175's first
        // version diverge — the frontier counted sixteen entries per place that
        // were all the same cell.
        const k = key(p[0], p[2]);
        if (!seen.has(k) && !queued.has(k) && inScope(p[0], p[2])) { queued.add(k); next.push([p[0], p[2]]); }
      }
    }
    frontier = next;
    console.log(`  round ${round + 1}: ${walks} walks, ${seen.size} places stood (${stoodInside} in-site), `
      + `${escapes.length} on NO FLOOR, ${leftSite} merely off the site rect`);
  }

  // THE SITE IS STILL WALKABLE. Sealing a hole by walling off the thing the
  // player is meant to reach would pass the escape assertion and ruin the
  // building, so the fix has to be shown not to have done that. 2 m lane,
  // BUILDER-BRIEF §10. Measured at 2 m INSIDE the frontage, on the cross axis.
  const lane = await page.evaluate(([s, xAt]) => {
    const gaps = [];
    for (let z = s.minZ; z <= s.maxZ; z += 0.25) {
      let blocked = 0;
      for (const c of window.__ct.colliders() ?? []) {
        if (c.minX <= xAt && c.maxX >= xAt && c.minZ <= z && c.maxZ >= z) { blocked = 1; break; }
      }
      if (!blocked) gaps.push(+z.toFixed(2));
    }
    return { open: gaps.length ? Math.max(...gaps) - Math.min(...gaps) : 0 };
  }, [site, front.at + front.dir * 2]);

  summary.push({ name, walks, places: seen.size, stoodInside, leftSite, escapes, exhausted, frontier: frontier.length, lane: lane.open, BUDGET });
}

// ── DID THE WORLD SURVIVE THE SWEEP? ──────────────────────────────────────
//
// This is a long walk and it reports "contained" by finding NOTHING — which is
// exactly the verdict a dead server also produces, because a page that has
// stopped answering returns the same position for every walk and none of them
// is outside anything.
//
// **It happened to item 175's author while writing this file's ancestor.** The
// preview was reaped mid-sweep and the run carried on happily to round 3,
// printing `0 escape(s)` about a world that was no longer there. A containment
// check that goes green when the world disappears is the worst kind of sleeping
// guard, because the thing it guards is the worst kind of bug. (The reaper that
// did it has since been taught to spare the worktree it is invoked from —
// `scripts/reap-servers.sh`, item 215 — but the guard stays: a server can die
// for reasons no script owns.)
const endState = await probeServer(URL);
report('the world was still serving when the sweep finished', endState === 'ok',
  endState === 'ok' ? 'the preview answered at the end as well as the start'
    : `the server went '${endState}' during the run — EVERY result above is unmeasured, not green`);

// ── POPULATION FLOOR. "I MEASURED NOTHING" MUST FAIL ──────────────────────
//
// Three separate ways this sweep can find no escapes without having looked:
// the fill walks nothing at all, it walks only the pavement because the
// frontage was derived wrong, or a site is swept with no legs in it. All three
// are the same verdict on the escape line — 0 — and all three are asserted
// against here rather than trusted.
const noLegs = summary.filter((s) => s.walks === 0).map((s) => s.name);
report('every site swept actually walked', noLegs.length === 0,
  noLegs.length ? `${noLegs.join(', ')} walked ZERO legs — nothing was measured there`
    : summary.map((s) => `${s.name} ${s.walks}`).join(', ') + ' walks');

// FOUR is the floor, not one: one in-site place is what a fill gets by
// overshooting the frontage on a single lucky leg, and a run that only ever
// stood on the doorstep has not swept the site. The jail's saturating fill
// stands in 20+.
const shallow = summary.filter((s) => s.stoodInside < 4);
report('every site was entered and stood in, not just approached', shallow.length === 0,
  shallow.length
    ? shallow.map((s) => `${s.name} stood in only ${s.stoodInside} place(s) INSIDE the site — `
      + 'the fill never got in, so 0 escapes means nothing. Check the derived frontage.').join('; ')
    : summary.map((s) => `${s.name} ${s.stoodInside} in-site place(s)`).join(', '));

// A run that ran out of budget has not covered the site, and must not be read as
// a clean bill of health. "SPENT THE BUDGET" AND "STOPPED WITH WORK LEFT" ARE
// NOT THE SAME THING — conflating them made item 175's line red on a run that
// had in fact saturated, because the fill emptied its frontier on the very walk
// that reached the ceiling. What makes a run incomplete is unexplored places
// remaining, not the counter.
const incomplete = summary.filter((s) => s.exhausted && s.frontier > 0);
report('every sweep covered its site rather than running out of budget', incomplete.length === 0,
  incomplete.length
    ? incomplete.map((s) => `${s.name} stopped at ${s.BUDGET} walks with ${s.frontier} place(s) unexplored — this run proves nothing`).join('; ')
    : summary.map((s) => `${s.name} ${s.walks}/${s.BUDGET}`).join(', ') + ', nothing left queued');

// ── THE ASSERTION, PER SITE ───────────────────────────────────────────────
for (const s of summary) {
  report(`the player cannot walk out of the world at the ${s.name}`, s.escapes.length === 0,
    s.escapes.length
      ? `${s.escapes.length} of ${s.walks} walks ended ON NO FLOOR — x `
        + `${f(Math.min(...s.escapes.map((e) => e.to[0])))}…${f(Math.max(...s.escapes.map((e) => e.to[0])))} `
        + `z ${f(Math.min(...s.escapes.map((e) => e.to[1])))}…${f(Math.max(...s.escapes.map((e) => e.to[1])))}`
        + `\n      e.g. ${JSON.stringify(s.escapes.slice(0, 4))}`
      : `${s.walks} walks from ${s.places} reachable places, every one finished on real ground`
        + ` (${s.leftSite} of them outside the site's own rectangle, which is not the same thing)`);
}

for (const s of summary) {
  report(`the ${s.name} is still at least 2 m of open walking`, s.lane >= 2.0,
    `${f(s.lane)} m of unobstructed z, 2 m inside the frontage`);
}

report('no console errors during the sweep', errs.length === 0, `${errs.length} page error(s)`);
console.log('\n' + summary.map((s) => `${s.name}: ${s.escapes.length} escape(s) / ${s.walks} walks`).join('  ·  '));
console.log('(an escape is a walk that finished with no floor mesh under the player)');
console.log(fails ? `\n${fails} FAILED` : '\nall contained');
await b.close();
process.exit(fails ? 1 : 0);
