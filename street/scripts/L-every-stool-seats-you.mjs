#!/usr/bin/env node
// THE CLAIM: every one of the 96 slot stools actually seats you and opens the
// machine — not most of them.
//
// This exists because builder N recorded, and deliberately did not chase, a
// finding in `notes/N-verify-K-slot-modal-trap.md`:
//
//   "3 of the 8 stools never seated me at all. E did nothing from the published
//    `at` and I stayed standing. That is much more likely my harness than the
//    world... If somebody does, it is `sit at the slot` stools 19, 47 and 79 by
//    index."
//
// That was the right call for a verifier with a different row to finish, and it
// is the wrong place to leave it, because 3 in 8 is 37% of the entry point to my
// feature. A player who sits at a machine and gets nothing does not conclude
// "my warp landed outside the trigger" — he concludes the game is broken.
//
// So this settles it over the WHOLE POPULATION rather than a sample. Either the
// world is fine and N's harness explains it, or some stools genuinely cannot be
// used, in which case the failures cluster somewhere and the cluster is the bug.
//
//   SHOT_URL=http://localhost:<yours>/ node scripts/L-every-stool-seats-you.mjs
//   … twice     sit, leave, sit again — the whole defect in two warps (default)
//   … all       every stool (96 warps, ~4 min) — the evidence, not the daily check
//   … named     just the three N named
//
// WHAT IT FOUND, and it is not what N suspected. The failures are not three bad
// stools: they are every SECOND sit. 48 of 96 in a sweep, alternating, and the
// three N happened to name were simply the ones that fell on an even count in an
// eight-stool sample. Isolated, any of them seats you perfectly.
//
//   sit at a slot -> ESCAPE -> the next E press ANYWHERE is swallowed
//
// Narrowed to the ESCAPE PATH and away from everything else, each by a control:
//
//   bench then bench          8/8 sit      no panel involved — fine
//   pockets panel then bench  sits         a panel alone does not do it
//   slot then BENCH           swallowed    it is not about the stool
//   closed by closePanels()   sits         identical end state, different key
//   closed by ESCAPE          swallowed
//   and walking 1.5 s first   swallowed    so it is not a stale trigger volume
//
// Written up in `notes/L-for-C-escape-eats-the-next-E.md`. It is not in a file
// of mine; the slots are only the vehicle, because this is the one panel in the
// world you enter by SITTING, so it is the only place Escape both closes a panel
// and leaves a seat.
//
// Exit codes are the house convention (GOTCHAS §32): 0 fine, 1 wrong, 2 usage,
// 3 aborted — nothing measured.

import { chromium } from 'playwright';

const MODES = ['twice', 'all', 'named'];
// THERE IS NO --selftest HERE, AND THIS FILE USED TO CLAIM THERE WAS.
//
// The line was `process.argv.includes('--selftest') ? '--selftest' : …`, which
// set `mode` to a string that is not in MODES — so the very next statement
// exited 2 with a usage message. The flag was never implemented; all its
// detection ever did was make the script refuse to run. Measured:
// `node scripts/L-every-stool-seats-you.mjs --selftest` → exit 2, "usage: …".
//
// It was registered `false` in scripts/checks.mjs, so the suite never passed
// the flag and nobody saw it. Had anyone "fixed" the registry row to `true` on
// the strength of the flag appearing in the source — which is exactly the
// textual test item 70 exists to replace — the row would have rendered
// `FAILED (2)` forever, the same shape as item 68.
//
// So the dead detection goes rather than being papered over. Making the flag
// merely tolerated would be worse: the script would then run its ORDINARY pass
// under `--selftest`, exit 0, and the runner would score that as a selftest
// that caught its mutation. That is a check reporting a proof it never ran
// (GOTCHAS 34). This check's real failing path is sound — `process.exit(bad ===
// 0 ? 0 : 1)` at the foot of the file — it simply has no mutation behind it
// yet, and the registry's `false` now tells the truth about that.
const mode = process.argv[2] ?? 'twice';
if (!MODES.includes(mode)) {
  console.error(`usage: SHOT_URL=… node scripts/L-every-stool-seats-you.mjs [${MODES.join('|')}]`);
  process.exit(2);
}
const URL = process.env.SHOT_URL;
if (!URL) {
  console.error('ABORTED: set SHOT_URL to YOUR OWN preview. There is no default —'
    + ' a default port is a live server belonging to somebody else (GOTCHAS §26, §48).');
  process.exit(3);
}

let bad = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'}  ${msg}`); if (!ok) bad++; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
try {
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 25000 });
} catch (e) {
  console.error(`ABORTED: ${URL} did not serve a world — ${String(e.message).split('\n')[0]}`);
  console.error('  Nothing was measured. This is not a red.');
  await b.close(); process.exit(3);
}

const stools = await p.evaluate(() =>
  window.__ct.seats().filter((s) => s.label === 'sit at the slot'));
console.log(`\n${stools.length} stools publish themselves as 'sit at the slot'\n`);
// GOTCHAS §34: assert the population before anything that is free over an empty
// one. Nought stools would make every verdict below pass for nothing.
if (stools.length < 48) {
  console.error(`ABORTED: only ${stools.length} slot stools in this world. Either the`
    + ' casino did not build or the label changed; nothing below was measured.');
  await b.close(); process.exit(3);
}

const idx = mode === 'named' ? [19, 47, 79]
  : mode === 'twice' ? [30, 30]              // the same stool twice: sit, leave, sit
    : stools.map((_, i) => i);
const prompt = () => p.evaluate(() => {
  const d = document.getElementById('ct-prompt');
  return d && d.style.display !== 'none' ? (d.textContent ?? '').trim() : null;
});
const press = async (k) => {
  await p.keyboard.down(k); await p.waitForTimeout(70); await p.keyboard.up(k);
  await p.waitForTimeout(170);
};

const rows = [];
for (const i of idx) {
  const s = stools[i];
  if (!s) continue;
  // Land on the seat's OWN published approach point — the thing a player walks
  // to and the thing the seat says to stand on. Nothing here is hand-typed
  // (GOTCHAS §20).
  await p.evaluate((q) => window.__ct.warp(q.at.x, q.at.z, 0, window.__ct.pos()[1] ?? 0, 0), s);
  // WAIT FOR THE PROMPT TO CATCH UP WITH THE WARP, not merely for a prompt to
  // exist. This is the whole reason the finding looked like a defect.
  //
  // `hud.prompt()` is written once per frame, so for at least one frame after a
  // warp the element still carries the PREVIOUS position's offer. The world
  // spawns the player at x 198.6 — a metre from the bed in room 301 — so the
  // very first read at every stool returned `[E] sit on the bed and watch TV`,
  // a seat 480 m away, and E fired against a stale frame.
  //
  // A poll for "is there any prompt" is satisfied instantly by the stale one,
  // which is GOTCHAS §30's fixed-sleep fault wearing the shape of a poll: it
  // waits for a condition that was already true. Wait for the RIGHT prompt.
  let offered = null;
  for (let t = 0; t < 60; t++) {
    offered = await prompt();
    if (offered && /sit at the slot/.test(offered)) break;
    await p.waitForTimeout(50);
  }
  await press('e');
  // WAIT FOR THE SEAT, do not sleep for it. `press` allows 170 ms after keyup,
  // which is plenty on an idle machine and a bet on a busy one — and this loop
  // makes the machine busy by construction, 96 warps and 96 page evaluations
  // deep. One stool failed exactly here on a run where the prompt had already
  // said `sit at the slot`, which is the signature: the world offered the seat,
  // the key landed, and the probe looked before the frame that took it.
  // GOTCHAS §30, for the third time in this file's short life.
  let seated = false;
  for (let t = 0; t < 40 && !seated; t++) {
    seated = await p.evaluate(() => !!window.__ct.seated());
    if (!seated) await p.waitForTimeout(50);
  }
  const panel = await p.evaluate(() => window.__hud?.panel?.() ?? null);
  rows.push({ i, offered, seated, panel, x: s.pose.x, z: s.pose.z, at: s.at });
  // RESET WITH ESCAPE ONLY, AND WAIT FOR IT — never with E.
  //
  // This is where the finding actually lived. The reset used to press Escape,
  // sleep 200 ms, and then press E "belt and braces" if still seated. E IS
  // AMBIGUOUS: it stands you up when seated and SITS YOU DOWN when standing. So
  // whenever Escape had already landed inside that 200 ms, the follow-up E put
  // the player back on the stool — and the NEXT stool then began from a seated
  // state, where E stands rather than sits (C's unconditional seat exit), and
  // got recorded as "never seated".
  //
  // That is the whole of stool #47: visited alone from a clean page it seats
  // perfectly, `seated: true, panel: ct-slots`. It only failed when it followed
  // another stool. A probe that cannot clear its own state manufactures a
  // cluster and hands it to the wrong owner — GOTCHAS §20's shared-state walk,
  // where the "car lot" test stood where the "church" test had finished.
  //
  // Escape is unambiguous and idempotent here, so the reset uses only that, and
  // WAITS for the state rather than sleeping at it.
  for (let t = 0; t < 30; t++) {
    const st = await p.evaluate(() => ({
      s: !!window.__ct.seated(), p: window.__hud?.panel?.() ?? null,
    }));
    if (!st.s && !st.p) break;
    await p.keyboard.press('Escape');
    await p.waitForTimeout(90);
  }
}

const failed = rows.filter((r) => !r.seated);
const noPanel = rows.filter((r) => r.seated && r.panel !== 'ct-slots');
console.log(`  warped to ${rows.length} stools, pressed E at each\n`);
console.log(`    seated and the machine opened   ${rows.length - failed.length - noPanel.length}`);
console.log(`    seated but no machine           ${noPanel.length}`);
console.log(`    never seated                    ${failed.length}\n`);

if (failed.length) {
  console.log('    the ones that did not seat:');
  for (const r of failed.slice(0, 12)) {
    console.log(`      #${String(r.i).padStart(2)} seat (${r.x.toFixed(2)}, ${r.z.toFixed(2)})`
      + ` approach (${r.at.x.toFixed(2)}, ${r.at.z.toFixed(2)})  offered: ${r.offered ?? 'nothing'}`);
  }
  if (failed.length > 12) console.log(`      …and ${failed.length - 12} more`);
  console.log('');
}

check(rows.length >= (mode === 'all' ? 90 : mode === 'named' ? 3 : 2),
  `${rows.length} stools actually visited — free at zero (GOTCHAS §34)`);
check(failed.length === 0,
  `EVERY stool seats you (${rows.length - failed.length} of ${rows.length}) —`
  + ' a machine you sit at and nothing happens reads as a broken game, not as a'
  + ' probe that landed badly');
check(noPanel.length === 0,
  `and every one of them opens the machine (${rows.length - noPanel.length} of ${rows.length})`
  + ' — sitting down IS the trigger, so a seat that takes you and shows nothing'
  + ' is the same failure wearing a different hat');
check(errs.length === 0, `no console errors (${errs.length})${errs.length ? `: ${errs[0]}` : ''}`);

await b.close();
console.log(bad === 0 ? `\n  ${mode}: all checks pass.\n` : `\n  ${mode}: ${bad} FAILED.\n`);
process.exit(bad === 0 ? 0 : 1);
