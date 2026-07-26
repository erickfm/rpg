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
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://127.0.0.1:4194/';
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

const stuck = [], fine = [], nosit = [];
for (const s of pick) {
  // stand back from `at`, along the pose->at direction, into the trap band
  const dx = s.at.x - s.pose.x, dz = s.at.z - s.pose.z, L = Math.hypot(dx, dz) || 1;
  const x = s.at.x + (dx / L) * 0.35, z = s.at.z + (dz / L) * 0.35;

  if ((await st()).s) await reload();
  await p.evaluate(([x2, z2]) => window.__ct.warp(x2, z2, 0, 0, 0), [x, z]);
  await p.waitForTimeout(400);
  // AIM AT THE SEAT. The sit spot is aim-gated, and a probe looking the wrong
  // way records "did not sit" for a seat that is perfectly sittable.
  await p.evaluate(([px, pz]) => {
    const q = window.__ct.pos();
    window.__ct.warp(q[0], q[2], 0, Math.atan2(px - q[0], pz - q[2]), 0);
  }, [s.pose.x, s.pose.z]);
  await p.waitForTimeout(350);

  const before = await st();
  await E();
  const sat = await st();
  if (!sat.s) { nosit.push(s); continue; }
  const tp = Math.hypot(sat.pos[0] - before.pos[0], sat.pos[2] - before.pos[2]);
  await E();
  const after = await st();
  if (after.s) { stuck.push({ ...s, tp }); await reload(); }
  else fine.push({ ...s, tp });
}

const f = (v) => v.toFixed(2);
console.log(`  stood up again : ${fine.length}`);
console.log(`  ** STUCK       : ${stuck.length}`);
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
console.log(stuck.length
  ? `\nFAIL  ${stuck.length} of ${fine.length + stuck.length} seats trap the player. Reloading is the only exit.`
  : `\nevery seat tested let the player stand up again.`);
await b.close();
process.exit(stuck.length ? 1 : 0);
