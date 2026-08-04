// CAN YOU GET OFF EVERY SEAT IN THE WORLD — using the key the SCREEN names?
//
// Item 307. `I-seat-exit.mjs` presses `E`, `E`, `Escape` and calls anything
// still seated "trapped with no key out at all". Two landed, user-requested
// changes have moved the contract out from under that sequence:
//
//   · item 188 — a seated `[E]` is spent on whatever you are AIMED AT, and the
//     exit is named beside it under `[ESC]` (crosstown.ts, the `exit` prompt).
//     So the second `E` does not attempt the exit at all; at the bank's client
//     chair it OPENS THE LOAN PANEL.
//   · item 206 — closing a panel you opened from your own chair leaves you IN
//     the chair (`ct/hud.ts:1545`, `keptTheirChair`), because the user asked
//     for the loan to be "an integrated overlay" rather than something that
//     ejects you when you shut it.
//
// Under those two, "sit, open a panel, press Escape once" ends with the player
// seated and NOT trapped: the panel closed, and the prompt is back to
// `[E] … · [ESC] stand up`. The next Escape stands them up.
//
// So this asks the question the user actually cares about — IS THERE A SEAT
// YOU CANNOT LEAVE — of the whole population rather than a sample of 30, and
// reports NUMBERS rather than an absence:
//
//   · how many seats Escape frees, and after how many presses
//   · how many are still seated after three, which is the trap count
//   · whether the seated prompt NAMED a way out (a trap the screen hides is
//     the thing that makes this worse than a stuck panel)
//   · how far the player can walk once up, so "free" is not merely a flag
//
// Seating goes through the seat's own pose object by index (GOTCHAS 87):
// `rig.sit` is matched BY IDENTITY by the machine modules, so a fresh literal
// sits on a pose no seat owns and every seat-triggered behaviour silently
// no-ops.
//
// Usage: SHOT_URL=http://127.0.0.1:4190/ node scripts/probes/w132-all-seats-exit.mjs [--n 229]
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://127.0.0.1:4190/');
const argv = process.argv.slice(2);
const N = Number(argv[argv.indexOf('--n') + 1]) || Infinity;
const MAX_ESC = 3;

const b = await chromium.launch();
let p;
const fresh = async () => {
  if (p) await p.close();
  p = await b.newPage({ viewport: { width: 800, height: 520 } });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
  await p.waitForTimeout(1000);
};
await fresh();

const seats = await p.evaluate(() => window.__ct.seats().map((s, i) => ({
  i, label: s.label, pose: { x: s.pose.x, z: s.pose.z }, at: { x: s.at.x, z: s.at.z },
})));

// Sample ACROSS LABELS, the way I-seat-exit does — 87 of these are slot stools
// and a rate measured on 87 copies of one seat is a rate for that seat.
const byLabel = new Map();
for (const s of seats) { if (!byLabel.has(s.label)) byLabel.set(s.label, []); byLabel.get(s.label).push(s); }
const pick = [];
for (let i = 0; pick.length < Math.min(N, seats.length); i++) {
  let added = false;
  for (const [, list] of byLabel) if (list[i]) { pick.push(list[i]); added = true; if (pick.length >= N) break; }
  if (!added) break;
}
console.log(`\n  ${seats.length} seats published, ${byLabel.size} distinct labels; testing ${pick.length}`);
console.log(`  protocol: sit on the seat's own pose, then press ESCAPE up to ${MAX_ESC} times\n`);

const seated = () => p.evaluate(() => window.__ct.seated() !== null);
const prompt = () => p.evaluate(() => document.getElementById('ct-prompt')?.textContent ?? '');
const esc = async () => { await p.keyboard.down('Escape'); await p.waitForTimeout(110); await p.keyboard.up('Escape'); await p.waitForTimeout(650); };

const freed = [];          // { label, presses, walked, prompt }
const trapped = [];        // still seated after MAX_ESC
const nosit = [];
const noExitNamed = [];    // seated, but the prompt named no way out

for (let k = 0; k < pick.length; k++) {
  const s = pick[k];
  if (k % 12 === 0) await fresh();           // keep the page young
  if (await seated()) await fresh();

  const dx = s.at.x - s.pose.x, dz = s.at.z - s.pose.z, L = Math.hypot(dx, dz) || 1;
  await p.evaluate(([a, c]) => window.__ct.warp(a, c, 0, 0, 0), [s.at.x + (dx / L) * 0.35, s.at.z + (dz / L) * 0.35]);
  await p.waitForTimeout(220);
  await p.evaluate(([px, pz]) => {
    const q = window.__ct.pos();
    window.__ct.warp(q[0], q[2], 0, Math.atan2(px - q[0], pz - q[2]), 0);
  }, [s.pose.x, s.pose.z]);
  await p.waitForTimeout(220);

  await p.evaluate((i) => window.__ct.sit(window.__ct.seats()[i].pose), s.i);
  await p.waitForTimeout(700);
  if (!(await seated())) { nosit.push(s); continue; }

  const seatedPrompt = await prompt();
  // Does the screen name a way out at all? `[ESC] …` is the exit half of the
  // joined prompt; a bare `[E] <exit>` is the unjoined form. Either names one.
  const named = /\[ESC\]/.test(seatedPrompt) || /^\[E\]/.test(seatedPrompt);

  let presses = 0, out = false;
  for (let i = 1; i <= MAX_ESC && !out; i++) { await esc(); presses = i; out = !(await seated()); }

  if (!out) { trapped.push({ ...s, seatedPrompt }); await fresh(); continue; }
  if (!named) noExitNamed.push({ ...s, seatedPrompt });

  const q0 = await p.evaluate(() => window.__ct.pos());
  await p.keyboard.down('w'); await p.waitForTimeout(450); await p.keyboard.up('w');
  const q1 = await p.evaluate(() => window.__ct.pos());
  freed.push({ ...s, presses, walked: Math.hypot(q1[0] - q0[0], q1[2] - q0[2]), seatedPrompt });
}

const byPress = new Map();
for (const f of freed) byPress.set(f.presses, (byPress.get(f.presses) ?? 0) + 1);
const walks = freed.map((f) => f.walked).sort((a, c) => a - c);
const stuckWalk = freed.filter((f) => f.walked <= 0.15);

console.log(`  sat on                        : ${freed.length + trapped.length} of ${pick.length}`);
console.log(`  could not sit                 : ${nosit.length}  (aim or reach, no verdict either way)`);
for (const k of [...byPress.keys()].sort()) {
  console.log(`  freed by ESCAPE x${k}            : ${byPress.get(k)}`);
}
console.log(`  ** STILL SEATED after ESC x${MAX_ESC}  : ${trapped.length}`);
console.log(`  seated with NO exit on screen  : ${noExitNamed.length}`);
if (walks.length) {
  console.log(`  walked after standing         : min ${walks[0].toFixed(2)} m, `
    + `median ${walks[Math.floor(walks.length / 2)].toFixed(2)} m, max ${walks[walks.length - 1].toFixed(2)} m`);
}
console.log(`  ** stood up but could NOT walk : ${stuckWalk.length}`);

if (trapped.length) {
  console.log('\n  SEATS ESCAPE WILL NOT LEAVE:');
  for (const t of trapped) console.log(`     ${JSON.stringify(t.label)}   prompt ${JSON.stringify(t.seatedPrompt)}`);
}
if (noExitNamed.length) {
  console.log('\n  SEATS WHOSE PROMPT NAMES NO WAY OUT (leavable, but the screen does not say so):');
  for (const t of noExitNamed) console.log(`     ${JSON.stringify(t.label)}   prompt ${JSON.stringify(t.seatedPrompt)}`);
}
if (stuckWalk.length) {
  console.log('\n  STOOD UP BUT FROZEN:');
  for (const t of stuckWalk) console.log(`     ${JSON.stringify(t.label)}  walked ${t.walked.toFixed(2)} m`);
}

// A verdict must be able to fail over an empty sample — an absence is free over
// nothing (I-seat-exit's own item-77 lesson, and the health.mjs family).
const answered = freed.length + trapped.length;
const bad = trapped.length + stuckWalk.length + noExitNamed.length;
console.log(answered
  ? (bad
    ? `\nFAIL  ${trapped.length} trapped, ${stuckWalk.length} frozen after standing, `
      + `${noExitNamed.length} with no exit named, of ${answered} seats sat on.`
    : `\nPASS  ${answered} seats sat on; every one released within ${MAX_ESC} presses of ESCAPE, `
      + `every one named its exit on screen, and every one walked afterwards `
      + `(min ${walks[0].toFixed(2)} m).`)
  : `\nFAIL  none of the ${pick.length} sampled seats could be sat on at all — the seat kit is broken.`);
console.log('');
await b.close();
process.exit(bad || !answered ? 1 : 0);
