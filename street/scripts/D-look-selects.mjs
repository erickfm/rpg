// DOES LOOKING AT A THING SELECT IT, AT RANGE, WITH NOTHING ELSE NEARBY?
//
// The user: *"in general i want to be able to interact with things a lot easier
// … the door for instance to my apt should be easy to open and close when
// looking at or by the door frame or the door itself."* Two selectors, then:
// NEAR it, or LOOKING at it.
//
// H verified the NEAR half at `enter No. 227` — at 0.9 m the prompt holds both
// facing the door and turned 90° away, so proximity selects regardless of gaze.
// Then it stopped, correctly:
//
//   "The LOOKING half I could not isolate. At 3 m looking directly at the door,
//    a different spot took the prompt. From outside I cannot tell whether that
//    is correct proximity behaviour by a nearer competitor or the gaze
//    tolerance failing, and calling it either way would be a guess.
//    **What would settle it:** the same test at a spot with NO other spot
//    within ~8 m, so the only thing that can select it is the gaze cone. Then
//    walk out to 3, 5 and 8 m and watch the prompt appear and drop."
//
// This is that test, built to H's specification.
//
// ISOLATION IS THE WHOLE DESIGN. A spot with a competitor inside 8 m cannot
// settle anything, because "a different spot won" and "the gaze cone failed"
// produce the same reading. So candidates are spots with no other spot within
// 8 m, and the run FAILS rather than passes if it cannot find any.
//
// FOUR READINGS PER SPOT, and each one rules out a different explanation:
//
//   3 m, FACING       must be offered. `r + REACH_MARGIN` is asserted to be
//                     under 3 m first, so proximity CANNOT explain it — this is
//                     the looking half or nothing.
//   3 m, TURNED 90°   must NOT be offered. Same place, same distance, gaze the
//                     only difference. Without this, reading 1 is equally well
//                     explained by a reach that is simply enormous.
//   5 m, FACING       must be offered. The tolerance is atan(r/d) clamped
//                     11.5°–35.5°, so it should hold well past the radius.
//   8 m, FACING       must NOT be offered. `pickSpot` is called with reach 6,
//                     so there is a real edge out there and this finds it.
//
// Every station is occlusion-checked with the shared oracle at the moment the
// prompt is read (lib/D-see.mjs). Without that, "not offered at 8 m" is equally
// well explained by a wall, and the reach cap would be credited for a hedge.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { installSee } from './lib/D-see.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4181/';
const ISOLATION = 8.0;       // no other spot this close, per H
const REACH_MARGIN = 0.6;    // fp.ts — the flat proximity bonus
const WANT = 3;              // fewer than this and the run has settled nothing

const b = await chromium.launch();
const page = await b.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(page, URL);
await installSee(page);

const prompt = () => page.evaluate(() => {
  const m = (document.body.innerText || '').match(/\[E\][^\n]*/); return m ? m[0] : '';
});

// ── isolated spots, and a bearing that is standable and clear at 3, 5 and 8 m ─
const cands = await page.evaluate(([ISOLATION, REACH_MARGIN]) => {
  const all = window.__ct.spots(), groundAt = window.__ct.groundAt, cols = window.__ct.colliders();
  const standable = (x, z, gy) => {
    if (Math.abs(groundAt(x, z) - gy) > 0.30) return false;
    for (const c of cols) {
      if (x > c.minX - 0.36 && x < c.maxX + 0.36 && z > c.minZ - 0.36 && z < c.maxZ + 0.36) return false;
    }
    return true;
  };
  const out = [];
  for (const sp of all) {
    // isolation, measured against EVERY spot and not just the live ones — a
    // spot that becomes live when you walk up to it is still a competitor.
    let lonely = true;
    for (const o of all) {
      if (o === sp) continue;
      if (Math.hypot(o.x - sp.x, o.z - sp.z) < ISOLATION) { lonely = false; break; }
    }
    if (!lonely) continue;
    // proximity must not be able to explain a hit at 3 m, or reading 1 proves
    // nothing about looking
    if (sp.r + REACH_MARGIN >= 3.0) continue;
    const gy = groundAt(sp.x, sp.z);
    const aim = [sp.x, gy + 1.1, sp.z];
    for (let i = 0; i < 72; i++) {
      const th = (i / 72) * Math.PI * 2;
      const st = [3, 5, 8].map((d) => ({ d, x: sp.x + Math.sin(th) * d, z: sp.z + Math.cos(th) * d }));
      if (!st.every((s) => standable(s.x, s.z, gy))) continue;
      if (!st.every((s) => window.__dSee([s.x, gy + 1.6, s.z], aim).t < 0)) continue;
      out.push({ label: sp.label, x: sp.x, z: sp.z, r: sp.r, gy: +gy.toFixed(3),
                 stations: st.map((s) => ({ d: s.d, x: +s.x.toFixed(3), z: +s.z.toFixed(3) })) });
      break;
    }
  }
  return out;
}, [ISOLATION, REACH_MARGIN]);

console.log(`\n  ${cands.length} isolated spots with a clear standable line at 3, 5 and 8 m`);
console.log(`  (isolated = no other spot within ${ISOLATION} m, so only the gaze cone can select)\n`);

let pass = 0, fail = 0, skipped = 0;
const say = (ok, what, detail) => {
  console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${what}: ${detail}`);
  ok ? pass++ : fail++;
};
// SAMPLED, NOT SNAPPED — because people walk through the shot.
//
// A single reading of this was flaky: the same station passed on one run and
// reported "(nothing) at 3 m facing" on the next. The cause is not the pick, it
// is that CITIZENS CROSS THE SIGHTLINE. The game's `canSee` correctly refuses a
// spot with a pedestrian in front of it, and whether one is there at the
// instant of the read is luck. Occlusion is already re-checked at read time,
// but a citizen can still arrive between the oracle call and the prompt call.
//
// So each station is sampled four times over about a second and the assertions
// are made ASYMMETRIC, which is the honest shape for this:
//
//   "looking CAN select it"    — an EXISTENCE claim. One clear sample offering
//                                it is proof; the samples where somebody walked
//                                past are not counter-evidence.
//   "looking does NOT select"  — a UNIVERSAL claim. No sample may offer it, and
//                                at least one must have been clear, or the
//                                negative is satisfied by an obstruction rather
//                                than by the rule under test.
const at = async (st, sp, turn) => {
  const yaw = Math.atan2(sp.x - st.x, -(sp.z - st.z)) + turn;
  await page.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0), [st.x, st.z, yaw, sp.gy]);
  await page.waitForTimeout(260);
  const out = [];
  for (let i = 0; i < 4; i++) {
    // the player's LIVE storey. `groundAt` is storey-dependent (GOTCHAS §7), so
    // a gy captured at discovery — while the player stood somewhere else — is
    // not the gy the game uses here. `pos()[3]` IS `apt.gy()`, which is what
    // crosstown.ts's eye reads.
    const clear = await page.evaluate(([sx, sz]) => {
      const p = window.__ct.pos();
      return window.__dSee([p[0], p[3] + 1.6, p[2]], [sx, window.__ct.groundAt(sx, sz) + 1.1, sz]).t < 0;
    }, [sp.x, sp.z]);
    out.push({ see: await prompt(), clear });
    if (i < 3) await page.waitForTimeout(200);
  }
  return out;
};
// A READING WITH NO CLEAR SAMPLE IS INCONCLUSIVE, NOT A FAILURE — and getting
// that wrong is what made this red twice on a sound world. Discovery picks a
// bearing whose line is clear at 3, 5 and 8 m, but the world does not hold
// still: at `enter No. 227` the 5 m and 8 m lines were blocked by the time the
// prompt was read, on two runs out of three. Scored as failures that reads as
// "the gaze cone stops working past 3 m", which is not what happened and not
// true. A spot only counts toward the total when ALL FOUR of its readings had
// a clear line to be read on.
/** an existence claim: one clear sample offering it is proof */
const everOffers = (rs, want) => rs.some((r) => r.clear && r.see === want);
/** a universal claim: none may offer it, and at least one must have been clear */
const neverOffers = (rs, want) => !rs.some((r) => r.see === want);
/** could this reading decide anything at all? */
const conclusive = (rs) => rs.some((r) => r.clear);
const shown = (rs) => rs.map((r) => r.see || '(nothing)').find((v) => v !== '(nothing)') || '(nothing)';

let settled = 0;
for (const sp of cands) {
  if (settled >= WANT) break;
  const want = `[E] ${sp.label}`;
  const s3 = sp.stations.find((s) => s.d === 3), s5 = sp.stations.find((s) => s.d === 5), s8 = sp.stations.find((s) => s.d === 8);

  const r3 = await at(s3, sp, 0);
  const live = await page.evaluate((l) => (window.__ct.spots().find((s) => s.label === l) || {}).ok === true, sp.label);
  if (!live || !r3.some((r) => r.clear)) {
    skipped++;
    console.log(`  skip  "${sp.label}" — ${!live ? 'ok() false at 3 m' : 'line never clear in 4 samples'}; settles nothing`);
    continue;
  }
  const r3t = await at(s3, sp, Math.PI / 2);
  const r5 = await at(s5, sp, 0);
  const r8 = await at(s8, sp, 0);
  const blind = [['3 m facing', r3], ['3 m turned', r3t], ['5 m facing', r5], ['8 m facing', r8]]
    .filter(([, rs]) => !conclusive(rs)).map(([n]) => n);
  if (blind.length) {
    skipped++;
    console.log(`  skip  "${sp.label}" — no clear sample at ${blind.join(', ')}; settles nothing`);
    continue;
  }
  settled++;
  console.log(`  "${sp.label}"  r ${sp.r}, so reach ends at ${(sp.r + REACH_MARGIN).toFixed(2)} m`);
  say(everOffers(r3, want), '3 m FACING — offered, and proximity cannot explain it', `"${shown(r3)}"`);
  say(neverOffers(r3t, want), '3 m TURNED 90° — not offered, so it was the gaze', `"${shown(r3t)}"`);
  say(everOffers(r5, want), '5 m FACING — still offered, well past the radius', `"${shown(r5)}"`);
  say(neverOffers(r8, want), '8 m FACING — dropped, beyond the reach of 6 m', `"${shown(r8)}"`);
}
await b.close();

console.log(`\n  ${pass} pass, ${fail} fail, ${skipped} skipped — ${settled} spots settled`);
if (settled < WANT) {
  console.log(`\n  FAIL: only ${settled} isolated spots settled, wanted ${WANT}. A run that`);
  console.log('  finds nothing to test must not report success (GOTCHAS §34).');
  process.exit(1);
}
if (fail) { console.log('\n  FAIL: the LOOKING half of the selector does not behave as the row claims.'); process.exit(1); }
console.log('\n  looking selects at range, gaze is what does it, and it drops past the reach');
