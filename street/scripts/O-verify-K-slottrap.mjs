// IS THE SLOT-STOOL SEAT TRAP STILL LIVE? — verifying K's row, evidenced by I.
//
// This is the severest open thing on the board: *"A player who sits at a slot
// machine cannot leave by any key, and reloading is the only exit"*, on **96 of
// the world's 225 seats**. I sat at one of those stools earlier tonight while
// verifying L's slots and never tried to get up, which is exactly the gap a
// second verifier is for.
//
// I's station and predicate, used unchanged rather than reinvented:
//   *"warp to its published `at`, press E to sit, then press E, then press
//    Escape. PREDICATE: `seated()` stays true through both, and
//    `#ct-panelback` is in the document."*
//
// The one thing I add is that I try MORE THAN THE TWO KEYS. "Cannot leave by
// any key" is the claim; two keys is two keys. If some other binding gets you
// out, the trap is a wording problem and not a trap, and the desk should know
// which it has.
//
//   SHOT_URL=http://localhost:PORT/ node scripts/O-verify-K-slottrap.mjs
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('aim it: SHOT_URL=http://localhost:PORT/'); process.exit(2); }
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await reportWorld(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await afterFrames(p, 10); await p.waitForTimeout(1200);

let bad = 0, n = 0;
const ok = (c, m) => { n++; console.log(`${c ? 'OK  ' : 'NO  '} ${m}`); if (!c) bad++; };

// ── the blast radius, re-counted rather than quoted ───────────────────────
const census = await p.evaluate(() => {
  const seats = window.__ct.seats?.() ?? [];
  const by = {};
  for (const s of seats) by[s.label ?? '?'] = (by[s.label ?? '?'] ?? 0) + 1;
  return { total: seats.length, by };
});
const slotCount = census.by['sit at the slot'] ?? 0;
console.log(`seats in the world: ${census.total}; labelled "sit at the slot": ${slotCount}`);
if (!slotCount) { console.error('ABORT: no slot stools — nothing below measures this row'); await b.close(); process.exit(3); }
console.log(`that is ${((slotCount / census.total) * 100).toFixed(0)}% of every seat in the game\n`);

const stool = await p.evaluate(() => (window.__ct.seats?.() ?? [])
  .filter((s) => /sit at the slot/i.test(s.label ?? ''))
  .map((s) => ({ x: s.at?.x ?? s.x, z: s.at?.z ?? s.z }))[0]);

const seated = () => p.evaluate(() => !!window.__ct.seated?.());
const panel = () => p.evaluate(() => !!document.querySelector('#ct-panelback, .ct-panelback'));

// sit, waiting for the SEAT to arm rather than for N frames
await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [stool.x, stool.z]);
await afterFrames(p, 6);
await p.keyboard.press('e');
const sat = await p.evaluate(() => new Promise((res) => {
  const t = performance.now();
  const tick = () => {
    if (window.__ct.seated?.()) return res(true);
    if (performance.now() - t > 8000) return res(false);
    requestAnimationFrame(tick);
  };
  tick();
}));
if (!sat) { console.error('ABORT: could not sit at a slot stool, so there is no trap to test'); await b.close(); process.exit(3); }
console.log(`sat down: seated ${await seated()}, panel up ${await panel()}`);
await p.screenshot({ path: 'shots/O-verify-K-slottrap.png' });

// ── try to leave. I's two keys first, then everything else plausible ──────
const KEYS = ['e', 'Escape', 'q', 'Tab', 'Space', 'x', 'Enter', 'Backspace'];
const tried = [];
let escaped = false;
for (const k of KEYS) {
  if (escaped) break;
  await p.keyboard.press(k);
  await afterFrames(p, 12);
  const still = await seated();
  tried.push({ key: k, seated: still });
  console.log(`  pressed ${k.padEnd(9)} -> seated ${still}`);
  if (!still) escaped = true;
}

const panelUp = await panel();
console.log(`\nafter ${tried.length} keys: seated ${await seated()}, #ct-panelback present ${panelUp}`);

ok(escaped,
  escaped
    ? `you CAN leave — ${tried[tried.length - 1].key} got you out, so the trap is closed`
    : `THE TRAP IS STILL LIVE — none of ${KEYS.join(', ')} leaves the stool, on ` +
      `${slotCount} of ${census.total} seats (${((slotCount / census.total) * 100).toFixed(0)}%)`);

if (!escaped) {
  console.log('\nREPRODUCED at I\'s station with a WIDER key set than the row tested.');
  console.log('"cannot leave by any key" now has eight keys behind it, not two.');
  console.log('ct/hud.ts is K\'s and crosstown.ts is the desk\'s — this is a report, not a patch.');
}

console.log(`\n${n} checks, ${bad} disagreed`);
await b.close();
process.exit(bad ? 1 : 0);
