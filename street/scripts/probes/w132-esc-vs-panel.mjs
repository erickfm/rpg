// IS IT ONE BUG OR THREE? The measurement item 307 turns on.
//
// `w132-seat-triage.mjs` showed the three named seats fail their checks for
// three different reasons on the surface. This asks the ONE question underneath
// all three, of each seat, in two conditions:
//
//     A.  sit, press ESCAPE, nothing else            → are you on your feet?
//     B.  sit, open the seat's panel, press ESCAPE   → are you on your feet?
//                                          ESCAPE ×2 → are you on your feet?
//
// If A is yes everywhere and B is no everywhere, the seat exit is NOT broken:
// exactly one thing is, and it is that an open panel eats the Escape that would
// otherwise stand you up.
//
// Usage: SHOT_URL=http://127.0.0.1:4190/ node scripts/probes/w132-esc-vs-panel.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://127.0.0.1:4190/');
const b = await chromium.launch();
const WANT = [/sit in the client chair/i, /sit at the slot/i, /sit on the bed/i];

const fresh = async () => {
  const q = await b.newPage({ viewport: { width: 800, height: 520 } });
  await q.goto(URL, { waitUntil: 'networkidle' });
  await q.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
  await q.waitForTimeout(1200);
  return q;
};
let p = await fresh();
const seats = await p.evaluate(() => window.__ct.seats().map((s, i) => ({
  i, label: s.label, pose: { x: s.pose.x, z: s.pose.z }, at: { x: s.at.x, z: s.at.z },
})));

const seated = () => p.evaluate(() => window.__ct.seated() !== null);
const panel = () => p.evaluate(() => window.__hud?.panel?.() ?? null);
const prompt = () => p.evaluate(() => document.getElementById('ct-prompt')?.textContent ?? null);
const pos = () => p.evaluate(() => window.__ct.pos());
const key = async (k) => { await p.keyboard.down(k); await p.waitForTimeout(120); await p.keyboard.up(k); await p.waitForTimeout(900); };

// Put the player on a named seat, through the seat's REAL pose object
// (GOTCHAS 87), having first stood where a player arriving at it would stand.
const seatUp = async (s) => {
  const dx = s.at.x - s.pose.x, dz = s.at.z - s.pose.z, L = Math.hypot(dx, dz) || 1;
  await p.evaluate(([a, c]) => window.__ct.warp(a, c, 0, 0, 0), [s.at.x + (dx / L) * 0.35, s.at.z + (dz / L) * 0.35]);
  await p.waitForTimeout(350);
  await p.evaluate(([px, pz]) => {
    const q = window.__ct.pos();
    window.__ct.warp(q[0], q[2], 0, Math.atan2(px - q[0], pz - q[2]), 0);
  }, [s.pose.x, s.pose.z]);
  await p.waitForTimeout(350);
  await p.evaluate((i) => window.__ct.sit(window.__ct.seats()[i].pose), s.i);
  await p.waitForTimeout(900);
};

const out = [];
for (const re of WANT) {
  const s = seats.find((q) => re.test(q.label));
  const row = { label: s.label };

  // ── A. sit, then ESCAPE, nothing else ───────────────────────────────────
  await p.close(); p = await fresh();
  await seatUp(s);
  row.satA = await seated();
  row.panelOnSit = await panel();          // the slot opens its own on sitting
  row.promptA = await prompt();
  await key('Escape');
  row.aFreed = !(await seated());
  if (row.aFreed) {
    const q0 = await pos();
    await p.keyboard.down('w'); await p.waitForTimeout(500); await p.keyboard.up('w');
    const q1 = await pos();
    row.walkedA = Math.hypot(q1[0] - q0[0], q1[2] - q0[2]);
  }

  // ── B. sit, get a panel up, then ESCAPE ─────────────────────────────────
  await p.close(); p = await fresh();
  await seatUp(s);
  if (!(await panel())) await key('e');    // E opens whatever this seat aims at
  row.panelB = await panel();
  await key('Escape');
  row.bFreed1 = !(await seated());
  row.panelAfterEsc1 = await panel();
  if (!row.bFreed1) { await key('Escape'); row.bFreed2 = !(await seated()); }
  if (row.bFreed1 || row.bFreed2) {
    const q0 = await pos();
    await p.keyboard.down('w'); await p.waitForTimeout(500); await p.keyboard.up('w');
    const q1 = await pos();
    row.walkedB = Math.hypot(q1[0] - q0[0], q1[2] - q0[2]);
  }
  out.push(row);
}

const f = (v) => (v === undefined || v === null ? ' -- ' : v ? ' yes' : ' NO ');
const n = (v) => (v === undefined ? '  -- ' : v.toFixed(2).padStart(5));
console.log('\n  A: sit -> ESC              B: sit -> panel up -> ESC\n');
console.log('  seat                          A:free  A:walk   B:panel      B:ESC free  B:ESC*2 free  B:walk');
console.log('  ' + '-'.repeat(112));
for (const r of out) {
  console.log(`  ${r.label.slice(0, 28).padEnd(28)}  ${f(r.aFreed)}   ${n(r.walkedA)}   `
    + `${String(r.panelB ?? '(none)').padEnd(12)} ${f(r.bFreed1)}      ${f(r.bFreed2)}       ${n(r.walkedB)}`);
}
console.log('');
for (const r of out) {
  console.log(`  ${r.label}`);
  console.log(`     panel present the moment you sat : ${JSON.stringify(r.panelOnSit)}`);
  console.log(`     seated prompt                    : ${JSON.stringify(r.promptA)}`);
  console.log(`     panel still up after one ESC     : ${JSON.stringify(r.panelAfterEsc1)}`);
}

// ── the verdict, as NUMBERS ────────────────────────────────────────────────
const aFree = out.filter((r) => r.aFreed).length;
const bFree1 = out.filter((r) => r.bFreed1).length;
const bFree2 = out.filter((r) => r.bFreed1 || r.bFreed2).length;
console.log(`\n  ESC from a seat with NO panel up   : ${aFree}/${out.length} stood up`);
console.log(`  ESC from a seat WITH a panel up    : ${bFree1}/${out.length} stood up on the first press,`
  + ` ${bFree2}/${out.length} within two`);
console.log('');
await b.close();
