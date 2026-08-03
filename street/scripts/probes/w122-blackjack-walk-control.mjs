// CONTROL for item 293: is the blackjack-stool walk that fails in the packed
// artifact ALSO failing in the ordinary code-split build served over HTTP?
//
// L-games-in-artifact.mjs reports "held W carried the player 0.00 m" at the
// blackjack table and plays the slots perfectly in the same run. If the same
// walk fails against dist/index.html — the split build, nothing packed — then it
// is not the packer.
//
//   SHOT_URL=http://localhost:4181/ node scripts/probes/w122-blackjack-walk-control.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4181/';
const LABEL = 'sit at the blackjack table';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(1500);

const seats = await p.evaluate((L) => (window.__ct.seats?.() ?? [])
  .filter((s) => (s.label ?? '') === L)
  .map((s) => ({ x: s.at.x, z: s.at.z, yaw: s.yaw })), LABEL);
console.log(`seats carrying '${LABEL}': ${seats.length}`);
if (!seats.length) { await b.close(); console.log('no seats — nothing to walk to'); process.exit(3); }

const s = seats[0];
// `__ct.pos()` is [x, y, z, groundY] (crosstown.ts:1746), not a vector.
const before = await p.evaluate(({ x, z, yaw }) => {
  window.__ct.warp(x - Math.sin(yaw ?? 0) * 1.8, z - Math.cos(yaw ?? 0) * 1.8, yaw ?? 0);
  return window.__ct.pos();
}, s);
await p.waitForTimeout(400);
await p.keyboard.down('w');
await p.waitForTimeout(1400);
await p.keyboard.up('w');
await p.waitForTimeout(300);
const after = await p.evaluate(() => window.__ct.pos());
const moved = Math.hypot(after[0] - before[0], after[2] - before[2]);
console.log(`held W for 1.4 s: moved ${moved.toFixed(2)} m  (${before[0].toFixed(2)},${before[2].toFixed(2)} -> ${after[0].toFixed(2)},${after[2].toFixed(2)})`);
console.log(`distance to the stool now: ${Math.hypot(after[0] - s.x, after[2] - s.z).toFixed(2)} m`);
if (errs.length) console.log('page errors: ' + errs.slice(0, 3).join(' | '));
await b.close();
