// WALK PAST IT. The lane is sacred, and a collider box that measures clear on
// paper is not the same as a walk that does not snag — GOTCHAS says anything
// touching movement or floors gets walked, not screenshotted.
//
// Two walks: south to north along the west pavement past the alley mouth, and
// then a turn into the mouth to reach the phone. The first must not slow down;
// the second must arrive.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto, settle } from './lib/reachable.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4279/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 620 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 0));

const at = () => p.evaluate(() => window.__ct.pos().slice(0, 3).map((v) => +v.toFixed(2)));
// WALK UNTIL YOU ARRIVE, do not walk for a fixed time (GOTCHAS 30): a fixed
// duration overshot a bench by 3.4 m once and I filed the overshoot as a fault.
const walkTo = async (key, stop, limit = 200) => {
  await p.keyboard.down(key);
  let last = await at(), stuckFor = 0, worst = 0, worstAt = null;
  for (let i = 0; i < limit; i++) {
    await p.waitForTimeout(100);
    const now = await at();
    const moved = Math.hypot(now[0] - last[0], now[2] - last[2]);
    // the first three ticks are the rig accelerating from rest, not a snag
    if (moved < 0.02 && i > 2) {
      stuckFor++;
      if (stuckFor > worst) {
        worst = stuckFor;
        // WHO or WHAT stopped me. A stall that repeats at the same z looks
        // static and is not necessarily: the crowd is seeded, so the same
        // citizen is in the same place at the same elapsed time every run.
        const near = await p.evaluate(([X, Z]) => (window.__ct.walkers ? window.__ct.walkers() : [])
          .filter((q) => Math.hypot(q.x - X, q.z - Z) < 1.4)
          .map((q) => [+q.x.toFixed(2), +q.z.toFixed(2), q.doing]), [now[0], now[2]]);
        worstAt = [now, near];
      }
    } else stuckFor = 0;
    last = now;
    if (stop(now)) break;
  }
  await p.keyboard.up(key);
  await p.waitForTimeout(150);
  return { at: last, worst, worstAt };
};

// ── 1. the pavement lane, hugging the building side where the mouth is ────
await p.evaluate(() => window.__ct.warp(-6.35, -48, Math.PI, 0.14, 0));
await settle(p);
const a = await walkTo('w', (q) => q[2] > -28);
console.log(`\n── walking north up the west pavement at x -6.35 ──`);
console.log(`  ended at ${JSON.stringify(a.at)}   longest stall ${(a.worst * 0.1).toFixed(1)} s`);
console.log(`  lateral drift off the lane: ${(a.at[0] + 6.35).toFixed(2)} m` +
  (a.at[2] > -28 ? '   ARRIVED' : '   <-- DID NOT GET PAST THE MOUTH'));
if (a.worst >= 4) console.log(`  <-- STALLED ${(a.worst * 0.1).toFixed(1)} s at ${JSON.stringify(a.worstAt?.[0])}\n       citizens within 1.4 m: ${JSON.stringify(a.worstAt?.[1])}`);
else console.log('  no stall: the lane is clear the whole way past the mouth');

// ── 2. into the mouth, to the phone ───────────────────────────────────────
await p.evaluate(() => window.__ct.warp(-6.4, -40.2, Math.PI * 1.5, 0.14, 0));
await settle(p);
const c = await walkTo('w', (q) => q[0] < -7.6, 90);
console.log(`\n── turning into the alley mouth toward the phone ──`);
console.log(`  ended at ${JSON.stringify(c.at)}` + (c.at[0] < -7.6 ? '   REACHED IT' : '   <-- BLOCKED SHORT'));
const d = Math.hypot(c.at[0] + 7.62, c.at[2] + 37.35);
console.log(`  distance to the shelter's centre: ${d.toFixed(2)} m`);
await p.screenshot({ path: 'shots/pb-walked.png' });
console.log('  shots/pb-walked.png');
await b.close();
