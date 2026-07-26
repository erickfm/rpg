// VERIFYING N's rent/mailbox row — I did not build it, so I may.
//
// N named the station and that is what this stands in:
//   *"come in the front door of No. 227 and look right. The [E] reads
//    'open your mailbox — 3 letters' before you have taken a step."*
//
// Read from the WORLD, never from N's constants: the whole value of a verifier
// is that it does not share the builder's assumptions. Everything below is
// found by asking `__ct` what is there.
//
//   SHOT_URL=http://localhost:PORT/ node scripts/O-verify-N-rent.mjs
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
await p.evaluate(() => window.__ct.clock(13, 0));
await afterFrames(p, 6);

let bad = 0, n = 0;
const ok = (c, m) => { n++; console.log(`${c ? 'OK  ' : 'NO  '} ${m}`); if (!c) bad++; };

// ── find the thing by ASKING, not by knowing where N put it ───────────────
const found = await p.evaluate(() => window.__ct.spots()
  .filter((s) => /mailbox|letter|post/i.test(s.label ?? ''))
  .map((s) => ({ x: +s.x.toFixed(2), z: +s.z.toFixed(2), r: s.r, label: s.label, ok: s.ok })));
console.log(`spots matching mailbox/letter/post: ${JSON.stringify(found)}`);
if (!found.length) {
  console.error('ABORT: no mailbox spot registered anywhere — nothing below would measure N\'s work');
  await b.close(); process.exit(3);
}

// ── 1. the station: standing where you come in, is it offered? ────────────
const box = found[0];
// stand at N's station rather than ON the spot: a trigger that only fires when
// you are teleported onto it is not something a player can use.
await p.evaluate(([x, z]) => window.__ct.warp(x, z + 1.1, 0, 0, 0), [box.x, box.z]);
await afterFrames(p, 6);
const here = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
const live = await p.evaluate(([bx, bz]) => {
  const q = window.__ct.pos();
  const s = window.__ct.spots().filter((s) => /mailbox|letter|post/i.test(s.label ?? ''))
    .map((s) => ({ label: s.label, ok: s.ok, d: +Math.hypot(s.x - q[0], s.z - q[2]).toFixed(2),
                   near: Math.hypot(s.x - q[0], s.z - q[2]) < s.r + 0.6 }));
  return s;
}, [box.x, box.z]);
console.log(`standing at (${here[0]}, ${here[2]}): ${JSON.stringify(live)}`);
ok(live.some((s) => s.near && s.ok), 'the mailbox [E] is live where a player stands');
ok(live.some((s) => /\d/.test(s.label)), `the label says HOW MANY — "${live[0]?.label}"`);
await p.screenshot({ path: 'shots/O-verify-N-mailbox.png' });

// ── 2. is there POST IN THE BOX, drawn, not just counted? ─────────────────
// N says the post sticks out of 301's box. A label that says "3 letters" over
// an empty wall is a counter, not a mailbox — so ask the scene.
const drawn = await p.evaluate(([bx, bz]) => {
  let n = 0;
  window.__ct.scene.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const x = o.position.x, y = o.position.y, z = o.position.z;
    if (Math.hypot(x - bx, z - bz) < 2.2 && y > 0.7 && y < 2.2) n++;
  });
  return n;
}, [box.x, box.z]).catch(() => null);
console.log(`meshes within 2.2 m of the boxes at letter height: ${drawn}`);

// ── 3. RENT: does the clock, not a counter, decide it? ────────────────────
//
// The row's own strongest claim, and the one worth an independent test:
// *"RENT IS DERIVED FROM ctx.clock, NEVER ACCUMULATED — sleeping through four
// days and walking through four days are the same code path."* An accumulator
// would drift, so advance the clock in ONE jump and in MANY and require the
// same answer.
const readRent = async () => p.evaluate(() => {
  const s = window.__ct.spots().filter((s) => /rent|landlord|owe|\$/i.test(s.label ?? ''));
  return s.map((x) => x.label);
});
const before = await readRent();
await p.evaluate(() => window.__ct.advanceClock(3 * 1440, 0));
await afterFrames(p, 8);
const afterJump = await readRent();
console.log(`rent-ish labels  before: ${JSON.stringify(before)}`);
console.log(`                 after +3 days in ONE jump: ${JSON.stringify(afterJump)}`);

// now the same elapsed time in many small steps, from a fresh load
const p2 = await b.newPage({ viewport: { width: 900, height: 560 } });
await p2.goto(URL, { waitUntil: 'networkidle' });
await p2.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await afterFrames(p2, 10); await p2.waitForTimeout(1000);
await p2.evaluate(() => window.__ct.clock(13, 0));
await afterFrames(p2, 6);
for (let i = 0; i < 12; i++) {
  await p2.evaluate(() => window.__ct.advanceClock(360, 0));
  await afterFrames(p2, 3);
}
const afterSteps = await p2.evaluate(() => window.__ct.spots()
  .filter((s) => /rent|landlord|owe|\$/i.test(s.label ?? '')).map((x) => x.label));
console.log(`                 after +3 days in TWELVE steps: ${JSON.stringify(afterSteps)}`);
ok(JSON.stringify(afterJump) === JSON.stringify(afterSteps),
  'one jump and twelve steps over the same 3 days agree — the clock decides it, not an accumulator');
await p2.close();

console.log(`\n${n} checks, ${bad} disagreed`);
await b.close();
process.exit(bad ? 1 : 0);
