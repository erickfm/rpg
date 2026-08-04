// CAN YOU GET OUT OF THE SEAT YOU JUST SAT IN?
//
// The user: *"pressing e doesnt get me out of it — stuck in the TV seat"*.
// C, the auditor and J each reported the stuck state would not reproduce. It
// reproduces every time, and the reason all three missed it is a property of
// HOW THEY TESTED, not of how carefully they looked:
//
//   they warped ONTO the seat's pose and pressed E, so sitting moved the
//   player ~0 m. The fault only appears when sitting TELEPORTS you, which is
//   what happens to every player who walks up to a seat and never happens to a
//   probe that starts on top of it.
//
// Measured on the 301 bed, stepping back from its own `at` point:
//
//     teleported 0.82 m -> stands up      teleported 1.12 m -> STUCK
//     teleported 0.97 m -> stands up      teleported 1.27 m -> STUCK
//                                         teleported 1.42 m -> too far to sit
//
// So there is a band roughly 1.0-1.4 m wide, AT THE OUTER EDGE OF EVERY SEAT'S
// OWN TRIGGER, in which you can sit down and cannot get up. Stuck is total:
// W, A, S, D, space all move 0.00 m and seven E presses do nothing. Reloading
// is the only exit.
//
// IT IS NOT THE SPOT-SHADOWING the ledger row has been reasoning about. While
// stuck, `stand up` is ok=true at 0.00 m and is the unique minimum of the
// resolver's own key, every sit spot is correctly ok=false, and the HUD prints
// `[E] stand up`. The right verb is selected and E does not execute it, so the
// fault is downstream of spot selection.
//
// THIS CHECK IS RED TODAY. It is deliberately NOT registered in checks.mjs:
// registering a red check turns the board red for everyone and that call is the
// desk's, not mine. It is here so whoever fixes the kit has a predicate that
// goes green when the fix works, across every seat rather than the two I found
// by hand.
//
// Usage: SHOT_URL=http://127.0.0.1:4194/ node scripts/I-seat-exit.mjs [--n 30] [--all]
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = aim('http://127.0.0.1:4194/');
const argv = process.argv.slice(2);
const ALL = argv.includes('--all');
const N = ALL ? Infinity : Number(argv[argv.indexOf('--n') + 1]) || 30;

const b = await chromium.launch();
let p = await b.newPage({ viewport: { width: 800, height: 520 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
await p.waitForTimeout(1200);

const seats = await p.evaluate(() => window.__ct.seats().map((s) => ({
  label: s.label, r: s.r, pose: { x: s.pose.x, z: s.pose.z }, at: { x: s.at.x, z: s.at.z },
})));

// SAMPLE ACROSS LABELS, not the first N. The first N seats are all one bank of
// slot stools, and a rate measured on 30 copies of the same seat is a rate for
// that seat and not for the world.
const byLabel = new Map();
for (const s of seats) { if (!byLabel.has(s.label)) byLabel.set(s.label, []); byLabel.get(s.label).push(s); }
const pick = [];
for (let i = 0; pick.length < Math.min(N, seats.length); i++) {
  let added = false;
  for (const [, list] of byLabel) if (list[i]) { pick.push(list[i]); added = true; if (pick.length >= N) break; }
  if (!added) break;
}

const E = async () => { await p.keyboard.down('e'); await p.waitForTimeout(100); await p.keyboard.up('e'); await p.waitForTimeout(1100); };
const ESC = async () => { await p.keyboard.down('Escape'); await p.waitForTimeout(100); await p.keyboard.up('Escape'); await p.waitForTimeout(1100); };
const st = () => p.evaluate(() => ({ s: !!window.__ct.seated(), pos: window.__ct.pos().slice(0, 3) }));
const reload = async () => {                    // the ONLY way out of a stuck seat
  await p.close();
  p = await b.newPage({ viewport: { width: 800, height: 520 } });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
  await p.waitForTimeout(1200);
};

console.log(`\n  ${seats.length} seats in the world, testing ${pick.length} sampled across ${byLabel.size} distinct labels`);
console.log(`  each is approached from a pace behind its own published \`at\` point — how a player arrives\n`);

const stuck = [], fine = [], escOnly = [], nosit = [];
for (const s of pick) {
  // stand back from `at`, along the pose->at direction, into the trap band
  const dx = s.at.x - s.pose.x, dz = s.at.z - s.pose.z, L = Math.hypot(dx, dz) || 1;
  const x = s.at.x + (dx / L) * 0.35, z = s.at.z + (dz / L) * 0.35;

  if ((await st()).s) await reload();
  await p.evaluate(([x2, z2]) => window.__ct.warp(x2, z2, 0, 0, 0), [x, z]);
  await p.waitForTimeout(400);
  // AIM AT THE SEAT. The sit spot is aim-gated, and a probe looking the wrong
  // way records "did not sit" for a seat that is perfectly sittable.
  //
  // …AND THIS AIMED 180° AWAY FROM IT. `fp.ts` builds forward as
  // `(sin yaw, 0, -cos yaw)`, so facing a point needs the z term NEGATED;
  // `atan2(dx, dz)` — which is what stood here — points you at its mirror.
  // Measured on the open street rather than reasoned, 0.4 s of W at a target
  // 5 m ahead:
  //
  //     atan2(dx,  dz):  5.00 m -> 6.39 m   (further)
  //     atan2(dx, -dz):  5.00 m -> 4.01 m   (closer)
  //
  // It did not show up as a wall of "could not sit" because a STANDING pick has
  // an aim-free proximity pass (`crosstown.ts`, `pickSpot`'s `opts.seated`),
  // so most seats were reachable anyway — which is precisely why a silent
  // 180° error survived here. GOTCHAS 62's family.
  //
  // THE THIRD ARGUMENT IS THE YAW, NOT THE FOURTH. `warp(x, z, yaw?, gy?,
  // pitch?)` — the call below was passing the yaw as `gy`, which warped the
  // player to storey 0 and left him facing wherever he already was.
  await p.evaluate(([px, pz]) => {
    const q = window.__ct.pos();
    window.__ct.warp(q[0], q[2], Math.atan2(px - q[0], -(pz - q[2])));
  }, [s.pose.x, s.pose.z]);
  await p.waitForTimeout(350);

  const before = await st();
  await E();
  const sat = await st();
  if (!sat.s) { nosit.push(s); continue; }
  const tp = Math.hypot(sat.pos[0] - before.pos[0], sat.pos[2] - before.pos[2]);
  await E();
  const after = await st();
  if (!after.s) { fine.push({ ...s, tp }); continue; }
  // ESCAPE IS A SECOND EXIT NOW (f110b7f5a), and for a seat that opens a modal
  // it is the ONLY one — E is the panel's own key there. Reporting "stuck" for a
  // seat Escape releases would be a stale verdict, so the three outcomes are
  // kept apart: E freed it, only Escape freed it, or nothing did.
  //
  // ── AND ONE ESCAPE IS NOT THE WHOLE CONTRACT. A SEAT CAN BE TWO STATES ──
  //
  // This reported the bank's "sit in the client chair" as TRAPPED, NO KEY OUT
  // AT ALL, and that verdict was FALSE. The sequence above is E, E, ESC, and at
  // that chair the SECOND E does not attempt the exit at all: since item 188 a
  // seated `[E]` is spent on whatever you are aimed at, and there it opens the
  // loan panel (prompt: "[E] apply for a loan   ·   [ESC] stand up"). The ESC
  // that follows is then spent CLOSING that panel — and since item 206, closing
  // a screen you opened from your own chair deliberately leaves you in the
  // chair (`ct/hud.ts:1545` + `crosstown.ts`'s `FOCUS.leave()`), at the user's
  // request: *"you sit and its the loan process as an integrated overlay."*
  //
  // So the player is one press from his feet, with `[ESC] stand up` on screen,
  // and this called it a seat with no way out. Measured
  // (scripts/probes/w132-esc-vs-panel.mjs): ESCAPE from a seat with no panel up
  // freed 2 of 2; with a panel up, 0 of 3 on the first press and 3 of 3 within
  // two. Walked at the chair itself, 5/5 runs, ONE Escape when no panel was
  // opened first (scripts/probes/w132-walk-three-seats.mjs).
  //
  // THIS IS NOT A LOOSENING, AND THE BOUND IS WHAT KEEPS IT HONEST. "Trapped"
  // now means "still seated after the panel has been shut AND the seat asked to
  // release" — two presses, not "however many it takes". A seat needing three
  // still lands in `stuck`, and so does one that never releases at all. What is
  // no longer counted as a trap is the one case where the player can SEE the
  // way out and it works.
  await ESC();
  let esc = await st();
  let escPresses = 1;
  if (esc.s) { await ESC(); esc = await st(); escPresses = 2; }
  if (!esc.s) { escOnly.push({ ...s, tp, escPresses }); continue; }
  stuck.push({ ...s, tp }); await reload();
}

const f = (v) => v.toFixed(2);
console.log(`  E stood him up      : ${fine.length}`);
console.log(`  only ESCAPE freed   : ${escOnly.length}`);
console.log(`  ** TRAPPED, no key  : ${stuck.length}`);
console.log(`  could not sit  : ${nosit.length}  (aim or reach, not a verdict either way)\n`);

if (stuck.length) {
  const byL = new Map();
  for (const q of stuck) byL.set(q.label, (byL.get(q.label) ?? 0) + 1);
  console.log('  SEATS YOU CANNOT GET OUT OF:');
  for (const [k, v] of [...byL].sort((a, c) => c[1] - a[1])) console.log(`     ${String(v).padStart(3)}  ${JSON.stringify(k)}`);
  const tps = stuck.map((q) => q.tp).sort((a, c) => a - c);
  console.log(`\n     teleport distance on the stuck ones: min ${f(tps[0])} m, max ${f(tps[tps.length - 1])} m`);
}
if (fine.length) {
  const tps = fine.map((q) => q.tp).sort((a, c) => a - c);
  console.log(`     teleport distance on the ones that released: min ${f(tps[0])} m, max ${f(tps[tps.length - 1])} m`);
}
if (escOnly.length) {
  const byL = new Map();
  for (const q of escOnly) {
    const k = `${q.label}  (ESC x${q.escPresses})`;
    byL.set(k, (byL.get(k) ?? 0) + 1);
  }
  console.log('\n  SEATS E WILL NOT LEAVE — Escape is the only way out:');
  for (const [k, v] of [...byL].sort((a, c) => c[1] - a[1])) console.log(`     ${String(v).padStart(3)}  ${JSON.stringify(k)}`);
  const two = escOnly.filter((q) => q.escPresses === 2).length;
  console.log(`     (${escOnly.length - two} freed by one ESCAPE, ${two} needed two — `
    + 'a panel opened from the seat eats the first, item 206)');
}
// ── AND THE VERDICT HAS TO BE ABLE TO FAIL OVER AN EMPTY SAMPLE ─────────────
//
// This was `process.exit(stuck.length ? 1 : 0)` and nothing else, which is a
// pass over zero assertions. Measured, item 77: with `FPRig.sit()` refusing
// every seat in the world, this printed
//
//     could not sit  : 6  (aim or reach, not a verdict either way)
//     no seat traps the player: 0 released by E, 0 by Escape.      exit 0
//
// 219 seats published, six sampled, not one of them sittable, and the check
// that exists to guard seating reported green. `nosit` is correctly "not a
// verdict either way" for ONE seat — aim and reach really are ambiguous — but
// when it swallows the whole sample there is no verdict left to draw, and an
// absence is free over an empty set. Sixth member of the health.mjs family
// (items 61, 62, 64, and 73's two); `integration-doors` carries a guard against
// exactly this shape and this file did not.
//
// NOT a dead-port guard. On an unreachable world this still exits 1 from the
// throw above, which conflates "could not measure" with "measured and broken" —
// true of 20 of the suite's 23 walking/fast checks and filed as its own item by
// w36. Fixing it here alone would be misleading, so it is left named, not hidden.
const answered = fine.length + escOnly.length + stuck.length;
console.log(stuck.length
  ? `\nFAIL  ${stuck.length} of ${answered} seats trap the player with no key out at all.`
  : answered
    ? `\nno seat traps the player: ${fine.length} released by E, ${escOnly.length} by Escape.`
    : `\nFAIL  none of the ${pick.length} sampled seats could be sat on at all — `
      + `the seat kit is broken, and there is no verdict here to pass.`);
await b.close();
process.exit(stuck.length || !answered ? 1 : 0);
