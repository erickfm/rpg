#!/usr/bin/env node
// ITEM 206 — THE EXIT PATHS THAT ARE **NOT** A CHAIR, driven rather than reasoned.
//
// The chair case is `scripts/probes/w107-seat-keeps-you.mjs` (13/13). This is
// the other half of the desk's instruction — *"drive every exit path, because
// they differ"* — and it is the NEGATIVE side of the same change: a panel the
// player opened **standing up** must still release them exactly as it always
// did, and the ATM must still close itself on its farewell timer and hand the
// world back.
//
// Why it matters here: `ct/hud.ts`'s structural stand-up is now skipped when
// `FOCUS.leave()` reports it restored a chair. If that report were ever wrong in
// the other direction — `true` when the player had no chair — a standing player
// would be left frozen in a lock nothing releases, which is BUILDER-BRIEF §11
// territory. So the assertion is not "it still works", it is **"the player ends
// up STANDING, MOBILE, and with no panel up"**, checked several painted frames
// later so a late `forceUp` cannot hide inside the gap.
//
// ⚠ GOTCHAS 79b — warp first. ⚠ BUILDER-BRIEF §5 — [E] is held, not pressed.
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('ABORTED: set SHOT_URL — exit 3, nothing measured.'); process.exit(3); }
let checks = 0, fails = 0;
const ok = (c, w) => { checks++; if (!c) { fails++; console.log(`  FAIL  ${w}`); } else console.log(`  ok    ${w}`); };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct?.spots !== undefined || window.__ct?.seats !== undefined, { timeout: 60000 });
await waitPainted(p, { quiet: true });

const panelUp = () => p.evaluate(() => {
  const d = document.getElementById('ct-panelback');
  if (!d) return false;
  const st = getComputedStyle(d);
  return st.display !== 'none' && Number(st.opacity) > 0.05;
});
const seated = () => p.evaluate(() => !!window.__ct.seated());
const frames = async (n = 30) => { for (let i = 0; i < n; i++) await p.evaluate(() => new Promise((r) => requestAnimationFrame(r))); };

// ── find a STANDING diegetic panel: the ATM ────────────────────────────────
// Discovered from the world's own spot registry, never typed. `label` on a SPOT
// is a thunk (`crosstown.ts:399` — SEATS carry a plain string, SPOTS a
// function), which is a shape worker onehundredseven got wrong first.
const spot = await p.evaluate(() => {
  const all = window.__ct.spots ? window.__ct.spots() : [];
  const lab = (s) => (typeof s.label === 'function' ? s.label() : s.label) || '';
  // `ct/bank.ts:658` — the ATM's spot says "FIRST FEDERAL — use the machine";
  // the word "ATM" is nowhere in it, which is why the first run of this probe
  // reported "no ATM spot" over a world that has one.
  const hit = all.find((s) => /use the machine/i.test(lab(s)));
  return hit ? { x: hit.at ? hit.at.x : hit.x, z: hit.at ? hit.at.z : hit.z, label: lab(hit) } : null;
});
if (!spot) {
  const labels = await p.evaluate(() => (window.__ct.spots ? window.__ct.spots() : [])
    .map((s) => (typeof s.label === 'function' ? s.label() : s.label)).filter(Boolean).slice(0, 60));
  console.log('EXIT 3 — no ATM spot in __ct.spots(); this measured nothing. Labels seen:');
  for (const l of [...new Set(labels)]) console.log(`   ${l}`);
  await b.close(); process.exit(3);
}
console.log(`standing panel: "${spot.label}" at (${spot.x.toFixed(2)}, ${spot.z.toFixed(2)})`);

// walk-adjacent: warp beside it, then face it by sweeping yaw until it is offered
let opened = false;
for (let k = 0; k < 16 && !opened; k++) {
  const a = (k / 16) * Math.PI * 2;
  await p.evaluate(([x, z, y]) => window.__ct.warp(x + Math.sin(y) * 0.8, z - Math.cos(y) * 0.8, y + Math.PI, 0, 0),
    [spot.x, spot.z, a]);
  await frames(3);
  const t = await p.evaluate(() => (document.getElementById('ct-prompt')?.textContent || '').trim());
  if (k === 0 || t) console.log(`    approach ${k}: prompt=${JSON.stringify(t)}`);
  if (!/use the machine/i.test(t)) continue;
  await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
  await p.waitForTimeout(500);
  await p.waitForTimeout(1200);
  opened = await panelUp();
  if (!opened) console.log(`    approach ${k}: [E] pressed, ct-panelback still down`);
}
if (!opened) {
  console.log('EXIT 3 — could not open the ATM from any of 16 approaches; the scenario never ran.');
  await b.close(); process.exit(3);
}
ok(!(await seated()), 'the ATM opened while STANDING — nobody was seated');

// ── ESC out of a standing panel ────────────────────────────────────────────
await p.keyboard.down('Escape'); await p.waitForTimeout(120); await p.keyboard.up('Escape');
await p.waitForTimeout(400); await frames(30);
ok(!(await panelUp()), 'Escape closed the standing panel');
ok(!(await seated()), 'and left the player STANDING, 30 frames later — no phantom seat');

// ── and he can still walk ──────────────────────────────────────────────────
const before = await p.evaluate(() => ({ x: window.__ct.pos().x, z: window.__ct.pos().z }));
await p.keyboard.down('w'); await p.waitForTimeout(500); await p.keyboard.up('w');
await frames(10);
const after = await p.evaluate(() => ({ x: window.__ct.pos().x, z: window.__ct.pos().z }));
const moved = Math.hypot(after.x - before.x, after.z - before.z);
ok(moved > 0.15, `and he can WALK again — moved ${moved.toFixed(2)} m holding W (a frozen player is the §11 bug)`);

await b.close();
console.log(`\nconsole errors: ${errs.length}`);
if (errs.length) for (const e of errs.slice(0, 3)) console.log(`   ${e}`);
console.log(`\n${fails === 0 ? 'PASS' : 'FAIL'} — ${checks - fails}/${checks}`);
process.exit(fails === 0 ? 0 : 1);
