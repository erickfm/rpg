// ITEM 206 — WHAT DOES EACH PANEL-BEARING SEAT ACTUALLY OFFER A SEATED PLAYER?
//
// The scenario probe pressed [E] from the library chair and got STOOD UP with
// no panel, so before anything is fixed: sit on every seat in the world, sweep
// the pitch, and print what the prompt says. Item 188's exit contract is
// `[E] read the loan application · [ESC] stand up`, so the prompt is the world
// telling you whether the scenario is even reachable from that seat.
//
// ⚠ GOTCHAS 87 — the pose object comes from `__ct.seats()`, never a literal.
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('ABORTED: set SHOT_URL — exit 3.'); process.exit(3); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 60000 });
await waitPainted(p, { quiet: true });

const seats = await p.evaluate(() => window.__ct.seats().map((s, i) => ({ i, label: s.label, x: s.pose.x, z: s.pose.z })));
console.log(`seats in the world: ${seats.length}`);
if (seats.length < 100) { console.log('EXIT 3 — expected the world to register well over 100 seats.'); await b.close(); process.exit(3); }

const PITCHES = [-0.5, -0.25, 0, 0.15, 0.3];
const offers = new Map();
for (const s of seats) {
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [s.x, s.z]);
  await p.evaluate(([i]) => { const q = window.__ct.seats()[i]; window.__ct.sit(q.pose); }, [s.i]);
  const seen = new Set();
  for (const pitch of PITCHES) {
    await p.evaluate(([x, z, pi]) => window.__ct.warp(x, z, undefined, undefined, pi), [s.x, s.z, pitch]);
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const t = await p.evaluate(() => (document.getElementById('ct-prompt')?.textContent || '').trim());
    if (t) seen.add(t);
  }
  await p.evaluate(() => window.__ct.stand());
  for (const t of seen) {
    if (!offers.has(t)) offers.set(t, []);
    offers.get(t).push(s.label);
  }
}

console.log('\nwhat a SEATED player is offered, by prompt text:');
for (const [t, who] of [...offers.entries()].sort((a, z) => z[1].length - a[1].length)) {
  const uniq = [...new Set(who)];
  console.log(`  ${String(who.length).padStart(4)}x  ${JSON.stringify(t)}`);
  console.log(`         from seats: ${uniq.slice(0, 6).join(' | ')}${uniq.length > 6 ? ` … ${uniq.length} kinds` : ''}`);
}
await b.close();
