// ONE BUG OR THREE? Item 307's triage probe.
//
// The desk's row asserts that I-seat-exit, L-slots-inworld and
// K-tv-off-unless-seated "all say the same thing: leaving a seat is broken".
// This measures the three named seats THE SAME WAY, side by side, so the answer
// is a table rather than a pattern-match. It reports, per seat:
//
//   sat?  · the seated HUD prompt (which tells you which verb `[E]` is spent on)
//   E     · does `[E]` stand you up
//   ESC   · does `[ESC]` stand you up
//   W     · how far held-W moves you AFTER you are back on your feet
//
// It asserts NUMBERS, never "no traps" — an absence is what measuring nothing
// produces (GOTCHAS, the 21-entry category).
//
// SEATING GOES THROUGH THE REAL POSE OBJECT, BY INDEX INTO `__ct.seats()`
// (GOTCHAS 87): `sit: (pose) => rig.sit(pose)` hands the caller's own object to
// the rig, and the machine modules match their seat BY IDENTITY, so a freshly
// built `{x,z,yaw,h}` literal sits on a pose no seat owns and every
// seat-triggered behaviour silently fails to fire. A first cut of this probe
// walked up and pressed `[E]` instead, and sat on the WRONG SEAT twice out of
// three — the prompt at the slot stool's own approach point reads `[E] sit
// down`, a different seat entirely — so the walk-up is kept only as the
// approach that sets a realistic `standFrom`.
//
// Usage: SHOT_URL=http://127.0.0.1:4190/ node scripts/probes/w132-seat-triage.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://127.0.0.1:4190/');
const b = await chromium.launch();

// The three seats the row names, by the label they publish.
const WANT = [
  /sit in the client chair/i,
  /sit at the slot/i,
  /sit on the bed/i,
];

const fresh = async () => {
  const p = await b.newPage({ viewport: { width: 800, height: 520 } });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
  await p.waitForTimeout(1200);
  return p;
};

let p = await fresh();
const seats = await p.evaluate(() => window.__ct.seats().map((s, i) => ({
  i, label: s.label, pose: { x: s.pose.x, z: s.pose.z }, at: { x: s.at.x, z: s.at.z },
})));
console.log(`\n  ${seats.length} seats published\n`);

const prompt = () => p.evaluate(() => document.getElementById('ct-prompt')?.textContent ?? null);
const panel = () => p.evaluate(() => window.__hud?.panel?.() ?? null);
const seated = () => p.evaluate(() => window.__ct.seated() !== null);
const pos = () => p.evaluate(() => window.__ct.pos());
const key = async (k) => { await p.keyboard.down(k); await p.waitForTimeout(120); await p.keyboard.up(k); await p.waitForTimeout(900); };

const rows = [];
for (const re of WANT) {
  const s = seats.find((q) => re.test(q.label));
  if (!s) { rows.push({ label: String(re), err: 'NO SUCH SEAT' }); continue; }

  await p.close(); p = await fresh();

  // Stand a pace behind the seat's own `at` point, looking at the seat — so
  // `standFrom` is the spot a player would really have arrived from — and then
  // seat through the REAL pose object.
  const dx = s.at.x - s.pose.x, dz = s.at.z - s.pose.z, L = Math.hypot(dx, dz) || 1;
  const x = s.at.x + (dx / L) * 0.35, z = s.at.z + (dz / L) * 0.35;
  await p.evaluate(([a, c]) => window.__ct.warp(a, c, 0, 0, 0), [x, z]);
  await p.waitForTimeout(400);
  await p.evaluate(([px, pz]) => {
    const q = window.__ct.pos();
    window.__ct.warp(q[0], q[2], 0, Math.atan2(px - q[0], pz - q[2]), 0);
  }, [s.pose.x, s.pose.z]);
  await p.waitForTimeout(400);

  const promptBefore = await prompt();
  await p.evaluate((i) => window.__ct.sit(window.__ct.seats()[i].pose), s.i);
  await p.waitForTimeout(900);
  const sat = await seated();
  const r = { label: s.label, promptBefore, sat, seatedPrompt: null, panelSeated: null,
    eFreed: null, promptAfterE: null, panelAfterE: null,
    escFreed: null, panelAfterEsc: null, esc2Freed: null, walked: null };
  if (sat) {
    r.seatedPrompt = await prompt();
    r.panelSeated = await panel();
    await key('e');
    r.eFreed = !(await seated());
    r.promptAfterE = await prompt();
    r.panelAfterE = await panel();
    if (!r.eFreed) {
      await key('Escape');
      r.escFreed = !(await seated());
      r.panelAfterEsc = await panel();
      // A SECOND Escape, deliberately: if the first one is spent closing a
      // panel and the second one frees the seat, "trapped" is the wrong word
      // and the number of keys is the finding.
      if (!r.escFreed) { await key('Escape'); r.esc2Freed = !(await seated()); }
    }
  }
  // Can you walk once you are (if you are) out?
  if (r.eFreed || r.escFreed || r.esc2Freed) {
    const a = await pos();
    await p.keyboard.down('w'); await p.waitForTimeout(500); await p.keyboard.up('w');
    const c = await pos();
    r.walked = Math.hypot(c[0] - a[0], c[2] - a[2]);
  }
  rows.push(r);
}

console.log('  seat                          sat   [E] out  [ESC] out  [ESC]x2  walked   seated prompt');
console.log('  ' + '-'.repeat(118));
for (const r of rows) {
  if (r.err) { console.log(`  ${r.label.padEnd(28)}  ${r.err}`); continue; }
  const f = (v) => (v === null ? ' -- ' : v ? ' yes' : ' NO ');
  console.log(`  ${r.label.slice(0, 28).padEnd(28)}  ${f(r.sat)}   ${f(r.eFreed)}    ${f(r.escFreed)}    ${f(r.esc2Freed)}   `
    + `${r.walked === null ? '  --' : r.walked.toFixed(2).padStart(4)}   ${JSON.stringify(r.seatedPrompt)}`);
}
console.log('');
for (const r of rows) {
  if (r.err) continue;
  console.log(`  ${r.label}`);
  console.log(`     prompt before sitting : ${JSON.stringify(r.promptBefore)}`);
  console.log(`     panel while seated    : ${JSON.stringify(r.panelSeated)}`);
  console.log(`     prompt after [E]      : ${JSON.stringify(r.promptAfterE)}`);
  console.log(`     panel  after [E]      : ${JSON.stringify(r.panelAfterE)}`);
  console.log(`     panel  after [ESC]    : ${JSON.stringify(r.panelAfterEsc)}`);
}
console.log('');
await b.close();
