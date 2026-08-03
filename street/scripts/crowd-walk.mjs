// Does the crowd still BEHAVE after the ct/crowd.ts split? The fingerprint
// proves nothing moved at build time; this drives the player at a person.
//
//   1. people actually walk
//   2. a person is SOLID — you cannot walk through them
//   3. a person eventually gives up and lets you past — never traps you
//   4. the 2 m sidewalk lane is still walkable end to end (GOTCHAS §9)
//
// Usage: SHOT_URL=http://localhost:4187/ node scripts/crowd-walk.mjs
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { afterFrames } from './lib/frames.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
// THE INTEGRATION WORLD DROPS ITS HMR SOCKET, and that is not a defect in the
// world. `live-integrate.sh` rebuilds every 15 s, so Vite's client reports
// "WebSocket closed without opened" — reportWorld's own banner says to expect
// exactly one. Counting it as a page error made every probe of mine exit 1
// against :5177 with all assertions green, which defeats the opt-in
// (SHOT_WORLD=integration) that was added so this could be asked at all.
// Dropped ONLY that message, ONLY in that mode: a real error still fails.
const HMR_NOISE = /WebSocket closed without opened/;
const noise = (m) => process.env.SHOT_WORLD === 'integration' && HMR_NOISE.test(m);
page.on('pageerror', (e) => { const m = String(e.message); if (!noise(m)) errs.push(m); });
await page.goto(aim('http://localhost:4177/'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, aim('http://localhost:4177/'));   // GOTCHAS 26: prove it, do not just name it
await page.waitForTimeout(400);
await page.evaluate(() => window.__ct.clock(13, 0));

const pos = () => page.evaluate(() => window.__ct.pos());
// THE CROWD, from the crowd — not from a scan of the scene for person-shaped
// planes. That scan was right when the cast was the only set of people in the
// world; it is not any more. citizenSprite() has been adopted (ct/interior.ts and
// ct/lot.ts both call it), so a seventh person standing in the car lot is other
// modules using the atlas as intended, which is the whole point of exporting it.
// Asserting "exactly six person-shaped planes" would make this probe fail every
// time somebody does the right thing.
//
// __ct.walkers() is authoritative for the cast. The scene is still read for the
// foot HEIGHT, matched back to those positions, because walkers() reports x/z.
const walkers = () => page.evaluate(() => {
  const cast = window.__ct.walkers();
  const yAt = new Map();
  window.__ct.scene().traverse((o) => {
    const g = o.geometry?.parameters;
    if (g && g.width === 0.95 && g.height === 1.9 && o.material?.alphaTest === 0.5) {
      yAt.set(`${o.position.x.toFixed(2)},${o.position.z.toFixed(2)}`, +o.position.y.toFixed(3));
    }
  });
  return cast.map((c, k) => ({
    // IDENTITY, CARRIED BEFORE THE SORT — the whole point of item 218.
    // `ct/crowd.ts:751` maps the `citizens` array, and `citizens` is only ever
    // pushed to, once, inside the build-time `CAST.forEach` at :246–:272 — never
    // spliced, never sorted. So position k in what walkers() hands back is the
    // same person on every call, for the life of the world. The `.sort()` at the
    // bottom of this function then throws that away, so k has to be captured
    // here, above it.
    k,
    x: +c.x.toFixed(3), z: +c.z.toFixed(3),
    y: yAt.get(`${c.x.toFixed(2)},${c.z.toFixed(2)}`) ?? null,
    // ASK THE WORLD WHERE ITS FLOOR IS. crosstown.ts publishes groundAt(x, z);
    // this used to assert y === 0.14, a remembered number, AND that all six
    // shared one height. Both hold today only because the crowd happens to walk
    // one flat pavement — the park has a mound and a dish now, and the first
    // time anybody routes over a surface at another level this check fails on a
    // world that is fine. cc2d8bb56 hit exactly this hunting for the lowest
    // plane instead of asking.
    ground: +window.__ct.groundAt(c.x, c.z).toFixed(3),
  }))
  // THE SORT IS FOR READING, NOT FOR ARITHMETIC. It orders the output
  // west-to-east so a human eyeballing it sees the block; `x` is `c.lane`, which
  // `ct/crowd.ts:382` and `:392` move as the crowd routes over the graph. It is
  // a presentation order, and NOTHING may be paired across it. Pair on `k`.
    .sort((a, b) => a.x - b.x || a.z - b.z);
});

let fails = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${msg}`); if (!ok) fails++; };

console.log('crowd probe:');
// ── 1. they walk ──────────────────────────────────────────────────────────
const w0 = await walkers();
await page.waitForTimeout(1500);
const w1 = await walkers();
check(w0.length === 6, `the crowd is six (found ${w0.length}) — other modules' people are not counted`);
// PAIR BY IDENTITY, NEVER BY ARRAY POSITION (item 218). This line used to read
//
//   const moved = w0.filter((p, i) => Math.abs(p.z - (w1[i]?.z ?? p.z)) > 0.2).length;
//
// — two samples of a MOVING subject, 1500 ms apart, paired by their position in
// an array this file has just sorted by a coordinate that moves. Index N is not
// the same person twice, and the error only ever runs one way: the assertion is
// `moved >= 4`, so a mispair can only ADD to the count. A frozen crowd could
// certify as walking.
//
// Measured on the built bundle, `scripts/probes/w72-crowdwalk-sort.mjs 90`:
// **18 of 90 trials reordered** inside this same 1500 ms gap, and the worst
// disagreement seen was truth 4/6 counted 6/6. w72 recorded a demonstrated false
// VERDICT — truth 2/6 and 3/6 counted as 4/6 against this bar.
//
// ⚠ BUT IT HAS NEVER FIRED IN THE WINDOW THIS CHECK ACTUALLY RUNS IN, and
// whoever edits this leg next needs to know why, because the protection is
// accidental. Those trials sample one page continuously; the reorders start
// after the crowd leaves its six fixed home lanes (`ct/crowd.ts:262`), roughly a
// minute in. This leg runs ~2.4 s after load. Over **40 independent page loads**
// (`scripts/probes/w78-crowdwalk-firstwindow.mjs 40`) the sorted order came out
// `4,2,0,5,3,1` on every single one — 0/40 reorders, 0/40 disagreements, honest
// 6/6 every time, smallest individual step 0.936 m against this 0.2 m bar.
//
// So the fix below changes no verdict today. It stops the leg being one moved
// line away from lying: put this sample later in the file, or lengthen the gap,
// and the ~20% reorder rate arrives with it.
//
// ONE AUTHORING OF THE JUDGEMENT, called twice — for real just below, and again
// by the negative case under it. The point of the second call is the population
// floor: a floor nobody has watched reject anything is the same empty promise as
// a check nobody has watched fail (GOTCHAS 27), and a floor is exactly the kind
// of clause that gets written, never exercised, and quietly stops holding.
const verdict = (a, b) => {
  const then = new Map(b.map((q) => [q.k, q]));
  const judged = a.filter((p) => then.has(p.k));
  const moved = judged.filter((p) => Math.abs(p.z - then.get(p.k).z) > 0.2).length;
  // POPULATION FLOOR, so "measured nothing" FAILS instead of passing quietly.
  // The old `?? p.z` fallback is what made that possible: a person missing from
  // the second sample was silently scored as "did not move", so a leg judging
  // two people read exactly like a leg judging six. Derived from what was
  // actually sampled rather than typed (BUILDER-BRIEF §8), with a hard 4 under
  // it because `moved >= 4` is meaningless over a smaller set than that.
  const floor = Math.max(4, Math.ceil(a.length * 0.5));
  return { ok: judged.length >= floor && moved >= 4, moved, judged: judged.length, floor, n: a.length };
};
const v = verdict(w0, w1);
check(v.ok, `they are walking — ${v.moved}/${v.judged} moved >0.2 m in 1.5 s, paired by cast identity`
  + ` (${v.judged} of ${v.n} present in both samples, floor ${v.floor})`);
// THE NEGATIVE CASE, run every time rather than behind a flag, because it costs
// nothing and a negative case you have to remember to ask for is one that rots.
//
// IT HAS TO ISOLATE THE FLOOR, which took two goes to get right. Feed the
// judgement a second sample holding one person and it goes red — but so would
// `moved >= 4` on its own, since `moved` can never exceed `judged`. That case
// proves nothing about the floor. So: a cast of TWELVE (the six real ones plus
// six fresh identities), of which only FIVE come back, and all five have moved
// 99 m. `moved >= 4` is satisfied outright. The floor — 6, derived from the
// twelve — is then the ONLY clause that can reject it, and it must.
const doubled = [...w0, ...w0.map((p) => ({ ...p, k: p.k + 1000 }))];
const thin = verdict(doubled, w0.slice(0, 5).map((p) => ({ ...p, z: p.z + 99 })));
check(!thin.ok, `and the population floor rejects a thin sample — ${thin.moved} of ${thin.judged} `
  + `moved 99 m, so the movement bar of 4 is satisfied, and it is STILL red because only `
  + `${thin.judged} of ${thin.n} came back against a floor of ${thin.floor} `
  + '(a leg that judged almost nobody must never read as green)');
const planted = w0.filter((p) => p.y !== null && Math.abs(p.y - p.ground) < 0.011);
const worstLift = w0.reduce((m, p) => (p.y === null ? m : Math.max(m, Math.abs(p.y - p.ground))), 0);
check(planted.length === w0.length,
  `all ${planted.length}/${w0.length} feet planted on the floor beneath them — worst gap `
  + `${worstLift.toFixed(3)} m (asked of __ct.groundAt, not assumed to be 0.14)`);

// ── 2 & 3. the encounter: they halt a step short, then give up and pass ───
//
// Stand on the west walk and let whoever comes by come by. This used to pin a
// citizen in the exact lane |x| = 6.05 — but the crowd routes over a graph now
// and each trip takes its own lateral bias across the walk, so there is no
// fixed lane to stand in any more. Standing put and waiting is also the truer
// test: it is what a player does.
//
// x = -6.0 is the middle of the walk. The outer part is off limits to the
// player whatever the crowd does: the wall collider reaches -6.70, so with the
// 0.36 m capsule you cannot stand west of -6.34.
await page.evaluate(() => window.__ct.warp(-6.0, -30, 0, 0.14, 0));
await afterFrames(page);   // GOTCHAS 30: the warp lands on a FRAME, not after 150 ms
const me = await pos();
const gaps = [];
for (let i = 0; i < 260; i++) {           // 26 s — long enough for a passer-by
  const ws = await walkers();
  // the nearest person on THIS walk, signed along z so a pass shows as a sign
  // change rather than just a small number
  let best = null;
  for (const q of ws) {
    if (Math.abs(q.x - me[0]) > 0.9) continue;
    if (!best || Math.abs(q.z - me[2]) < Math.abs(best.z - me[2])) best = q;
  }
  if (best) gaps.push(+(best.z - me[2]).toFixed(3));
  await page.waitForTimeout(100);
}
const closest = Math.min(...gaps.map(Math.abs));
// a plateau: held roughly a step short of the player rather than walking on in
const halted = gaps.filter((g) => Math.abs(g) > 0.75 && Math.abs(g) < 1.35).length;
const bothSides = gaps.some((g) => g > 0.6) && gaps.some((g) => g < -0.6);
check(closest < 1.3, `somebody walked up to you — closest approach ${closest.toFixed(2)} m`);
check(halted >= 4, `held a step short instead of walking through — ${(halted / 10).toFixed(1)} s spent at 0.75–1.35 m`);
check(bothSides || closest < 0.6,
  bothSides ? 'and got past you — never trapped, seen on both sides'
    : `and got past you — closed to ${closest.toFixed(2)} m, inside the body`);

// ── 4. the sacred 2 m lane, walked end to end ─────────────────────────────
await page.evaluate(() => window.__ct.warp(-6.1, 6, 0, 0.14, 0));
await afterFrames(page);   // GOTCHAS 30: the warp lands on a FRAME, not after 150 ms
// STOP MEASURING THIS WITH A STOPWATCH. It was `> 14`, then `> 9`, and it failed
// at 8.6 m on a sound world — a third of the block covered, nowhere near stuck,
// while the check's own note said "anything near zero is the failure this
// catches". How far you get in six seconds depends on how many people you meet:
// a stopped citizen is solid for 1.4 s before it gives way, and three encounters
// legitimately eat most of the window. That is the same fault I have now fixed
// three times in corner-traffic, in my own file this time.
//
// The invariant is NOT TRAPPED, so measure that: sample while the key is held
// and look at the longest STALL. Being held 1.4 s is the give-way working;
// being held for four seconds is being stuck, whatever the total distance.
const d = await pos();
await page.keyboard.down('w');
const track = [d];
for (let i = 0; i < 12; i++) { await page.waitForTimeout(500); track.push(await pos()); }
await page.keyboard.up('w');
await page.waitForTimeout(40);
const e = track[track.length - 1];
let stall = 0, worstStall = 0;
for (let i = 1; i < track.length; i++) {
  const step = Math.hypot(track[i][0] - track[i - 1][0], track[i][2] - track[i - 1][2]);
  if (step < 0.15) { stall += 0.5; if (stall > worstStall) worstStall = stall; } else stall = 0;
}
check(worstStall <= 2.5, `never stuck walking the west lane — longest stall ${worstStall.toFixed(1)} s `
  + `(a stopped citizen gives way in 1.4 s), ${(d[2] - e[2]).toFixed(1)} m covered in 6 s of input`);
check(d[2] - e[2] > 4, `and the lane goes somewhere — ${(d[2] - e[2]).toFixed(1)} m south `
  + '(unobstructed is ~18 m; three give-ways at 1.4 s each leave ~5 m, so 4 m is the floor that means "moving")');

// ── a citizen who STOPS must not seal the lane (GOTCHAS §9) ───────────────
//
// 710e1454 caught bus.mjs failing intermittently on an unchanged world, and the
// mechanism was one of mine: "one citizen standing kerb-side blocks every
// inboard position while the outermost squeezes past". Citizens stop for
// errands, and a stopped one is solid to the player. So the invariant is not
// about walking distance — it is that whatever a stopped body does to the lane,
// a gap the player fits through always remains.
//
// MEASURE A GAP AGAINST A DIAMETER, NOT A CENTRE-SPAN AGAINST A DIAMETER. My
// first attempt at this scanned the free CENTRE positions across the walk and
// failed anything under 0.72 m, and reported 93 of 1305 samples sealed. That is
// a units error: a free centre-span of 0.50 m already means a 1.22 m gap, which
// the player walks through with 0.5 m to spare. Corrected, nothing was sealed
// at all — so this check exists to hold that, not to report a defect.
// ⚠ THIS LOOP USED TO RUN FOR 25 SECONDS OF WALL CLOCK, AND THAT IS WHY ITS
// SAMPLE COUNT CAME BACK 0 / 62 / 317 / 0 / 0 ACROSS FIVE IDENTICAL RUNS.
//
// Worker onehundredsix, item 262. The flakiness was NOT the identity/index bug
// the house cure predicts: `ct/crowd.ts:269` builds `citizens` once and `:400`
// only ever pushes, so `walkers()[i]` is the same person every frame — measured,
// the array length never changed once in three runs. What varies is **how many
// frames fit in a fixed wall-clock window**: 240 / 214 / 203 frames gave
// 131 / 103 / 92 samples, in proportion. That is GOTCHAS 30 — anything the
// render loop drives, timed with a stopwatch, measures the machine's load.
//
// So budget FRAMES, not milliseconds, with a wall-clock cap left only as a
// safety net against a stalled rAF. The verdict was stable all along (0 sealed,
// 1.08 m tightest, every run); it is the POPULATION that moved, and the
// population is what the floor below is about.
const lane = await page.evaluate(async () => {
  const RAD = 0.36, STEP = 0.02, WANT_FRAMES = 260;
  let samples = 0, sealed = 0, tight = 99, where = null, last = null, frames = 0;
  const t0 = performance.now();
  while (frames < WANT_FRAMES && performance.now() - t0 < 40000) {
    await new Promise((r) => requestAnimationFrame(r));
    frames++;
    const w = window.__ct.walkers(), cols = window.__ct.colliders();
    if (last && w.length === last.length) {
      for (let i = 0; i < w.length; i++) {
        if (Math.hypot(w[i].x - last[i].x, w[i].z - last[i].z) > 0.004) continue;   // still walking
        const z = w[i].z;
        if (Math.abs(w[i].x) < 4) continue;            // on the carriageway: crowd-net's business
        samples++;
        let best = 0, run = 0;
        for (let x = Math.sign(w[i].x) * 4.2, n = 0; n < 190; n++, x += Math.sign(w[i].x) * STEP) {
          const blocked = cols.some((c) => x > c.minX - RAD && x < c.maxX + RAD
            && z > c.minZ - RAD && z < c.maxZ + RAD);
          if (blocked) run = 0; else { run += STEP; if (run > best) best = run; }
        }
        const gap = best > 0 ? best + 2 * RAD : 0;      // centre freedom plus the capsule
        if (best <= 0) sealed++;
        if (gap < tight) { tight = gap; where = [+w[i].x.toFixed(2), +z.toFixed(2)]; }
      }
    }
    last = w.map((q) => ({ x: q.x, z: q.z }));
  }
  return { samples, sealed, frames, tight: +tight.toFixed(2), where };
});
// THE POPULATION FLOOR IS A CHECK, NOT A COMMENT. This used to print `??` and
// carry on, so a run that sampled NOTHING scored as "not a failure" — the exact
// shape of GOTCHAS 34 ("a check can pass because it found nothing to check") and
// GOTCHAS 65 ("a guard that reports failure in PROSE exits 0"). Two of the five
// runs behind this row's headline number were that branch, and a reader counting
// green runs could not tell them from a world that had been measured and was
// sound.
//
// The floor is DERIVED, not predicted: 260 frames yields ~90-130 stopped-citizen
// samples on this tree (measured, three runs), so 40 is comfortably under the
// observed minimum while still being far above zero. If it trips, the crowd did
// not pause where the check could see it — that is a fault in the RUN, and the
// run must say so rather than shrug.
check(lane.samples >= 40, `the lane was actually tested — ${lane.samples} stopped-citizen samples`
  + ` in ${lane.frames} frames (floor 40; under it, nothing below was measured)`);
check(lane.sealed === 0, `no stopped citizen ever sealed the walk — ${lane.samples} samples, ${lane.sealed} sealed`);
check(lane.tight >= 0.95, `the tightest gap past a stopped citizen was ${lane.tight} m at (${lane.where})`
  + ` — the player is 0.72 m and 0.95 is ct/gap.ts's comfortably-passable line`);

console.log(errs.length ? `\npage errors:\n${errs.slice(0, 3).join('\n')}` : '\nno page errors');
console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nall crowd checks pass');
await browser.close();
process.exitCode = fails ? 1 : 0;
