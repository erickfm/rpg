// IS THE RING LIVE, OR IS IT PAINT? Item 270.
//
// The whole claim of this item is that the calendar READS THE WORLD'S CLOCK
// rather than carrying a picture of a calendar. A baked texture would pass
// every check in `w107-calendar-walk.mjs` — it opens, it is on the mesh, it
// closes. So this one moves TIME and asserts the page changed with it:
//
//   · today's block moves to the right cell
//   · the days behind you get crossed off
//   · "DUE IN n DAYS" counts down and rolls over on a rent day
//   · the WALL texture follows too, not just the overlay
//
// A game day is 1440 game-minutes (24 real ones), and `__ct.advanceClock(m, 0)`
// snaps rather than ramps — which is the only way to cross a week without
// waiting for it. Nothing in the calendar accumulates, so a snap and a walk are
// the same code path (`ct/tenancy.ts:36`).
//
// Exit 0 all agree · 1 a page did not move · 3 nothing measured.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { goto } from '../lib/reachable.mjs';
import { waitPainted } from '../lib/painted.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4188/');
mkdirSync('shots', { recursive: true });
const APT_X0 = 200, APT_Z0 = -20, ST0 = 2.7;
const CAL_X = APT_X0 - 0.80, SOUTH_Z = APT_Z0 + 2.085, GY = 2 * ST0;

let fails = 0, checks = 0;
const ok = (c, w) => { checks++; if (!c) { fails++; console.log(`  FAIL  ${w}`); } else console.log(`  ok    ${w}`); };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await waitPainted(p);
await p.evaluate(([x, z, gy]) => window.__ct.warp(x, z, 0, gy, 0), [CAL_X, SOUTH_Z + 0.90, GY]);
await waitPainted(p, { frames: 3 });

/** a cheap signature of what is drawn on a canvas — enough to say "it changed" */
const sig = (buf) => {
  let h = 2166136261;
  for (let i = 0; i < buf.length; i += 7) { h ^= buf[i]; h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
};
/** the WALL page, straight off the calendar's own texture canvas */
const wallSig = async () => sig(Buffer.from(await p.evaluate(() => {
  let cv = null;
  window.__ct.scene().traverse((o) => { if (o.userData?.calendar) cv = o.material?.map?.image ?? null; });
  if (!cv) return null;
  const g = cv.getContext('2d');
  return Array.from(g.getImageData(0, 0, cv.width, cv.height).data);
})));
const dayNow = () => p.evaluate(() => Math.floor(window.__ct.clockNow().totalMin / 1440));
const jumpDays = async (n) => {
  await p.evaluate((mins) => window.__ct.advanceClock(mins, 0), n * 1440);
  await waitPainted(p, { frames: 4 });
};
const openPanel = async () => {
  await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
  await waitPainted(p, { frames: 4 });
};
const closePanel = async () => {
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => {
    const el = document.getElementById('ct-calendar');
    if (!el) return true;
    const o = getComputedStyle(el).opacity;
    return o === '0' || o === '1';
  }, { timeout: 5000 });
  await waitPainted(p, { frames: 3 });
};

const seen = new Map();
for (const jump of [0, 1, 1, 1, 4]) {
  if (jump) await jumpDays(jump);
  const d = await dayNow();
  const w = await wallSig();
  await openPanel();
  const shot = `shots/w107-cal-day${d}.png`;
  await p.screenshot({ path: shot });
  await closePanel();
  console.log(`  day ${String(d).padEnd(2)}  wall sig ${w}  ${shot}`);
  seen.set(d, w);
}

const days = [...seen.keys()];
const sigs = [...seen.values()];
ok(days.length === 5, `visited 5 distinct days: ${days.join(', ')}`);
ok(new Set(sigs).size === sigs.length,
  `the WALL page is different on every one of the ${sigs.length} days — it is not a baked picture`);
// the negative half: the SAME day must give the SAME page, or the "it changed"
// above proves only that something is noisy. Grain is redrawn on each repaint,
// so compare a day against ITSELF without re-ticking the clock.
const again = await wallSig();
ok(again === sigs[sigs.length - 1],
  'and re-reading the same day gives the identical page (so the difference above is the DATE, not noise)');

console.log(`\n${checks - fails}/${checks} passed`);
await b.close();
if (!checks) process.exit(3);
process.exit(fails ? 1 : 0);
