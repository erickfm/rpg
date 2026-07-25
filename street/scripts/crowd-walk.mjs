// Does the crowd still BEHAVE after the ct/crowd.ts split? The fingerprint
// proves nothing moved at build time; this drives the player at a person.
//
//   1. people actually walk
//   2. a person is SOLID — you cannot walk through them
//   3. a person eventually gives up and lets you past — never traps you
//   4. the 2 m sidewalk lane is still walkable end to end (GOTCHAS §9)
//
// Usage: SHOT_URL=http://localhost:4187/ node scripts/crowd-walk.mjs
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message)));
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(400);
await page.evaluate(() => window.__ct.clock(13, 0));

const pos = () => page.evaluate(() => window.__ct.pos());
const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(40); };
// THE CROWD, from the crowd — not from a scan of the scene for person-shaped
// planes. That scan was right when the cast was the only set of people in the
// world; it is not any more. citizenSprite() has been adopted (ct/interior.ts and
// ct/lot.ts both call it), so a seventh person standing in the car lot is other
// modules using the atlas as intended, which is the whole point of exporting it.
// Asserting "exactly six person-shaped planes" would make this probe fail every
// time somebody does the right thing.
//
// __ct.walkers() is authoritative for the cast. The scene is still read for the
// foot HEIGHT, matched back to those positions, because walkers() reports x/z.
const walkers = () => page.evaluate(() => {
  const cast = window.__ct.walkers();
  const yAt = new Map();
  window.__ct.scene().traverse((o) => {
    const g = o.geometry?.parameters;
    if (g && g.width === 0.95 && g.height === 1.9 && o.material?.alphaTest === 0.5) {
      yAt.set(`${o.position.x.toFixed(2)},${o.position.z.toFixed(2)}`, +o.position.y.toFixed(3));
    }
  });
  return cast.map((c) => ({
    x: +c.x.toFixed(3), z: +c.z.toFixed(3),
    y: yAt.get(`${c.x.toFixed(2)},${c.z.toFixed(2)}`) ?? null,
  })).sort((a, b) => a.x - b.x || a.z - b.z);
});

let fails = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${msg}`); if (!ok) fails++; };

console.log('crowd probe:');
// ── 1. they walk ──────────────────────────────────────────────────────────
const w0 = await walkers();
await page.waitForTimeout(1500);
const w1 = await walkers();
check(w0.length === 6, `the crowd is six (found ${w0.length}) — other modules' people are not counted`);
const moved = w0.filter((p, i) => Math.abs(p.z - (w1[i]?.z ?? p.z)) > 0.2).length;
check(moved >= 4, `they are walking — ${moved}/6 moved >0.2 m in 1.5 s`);
const ys = w0.map((p) => p.y).filter((y) => y !== null);
check(ys.length === w0.length && new Set(ys).size === 1 && ys[0] === 0.14,
  `all ${ys.length} feet planted on the kerb at y=${ys[0]}`);

// ── 2 & 3. the encounter: they halt a step short, then give up and pass ───
//
// Stand on the west walk and let whoever comes by come by. This used to pin a
// citizen in the exact lane |x| = 6.05 — but the crowd routes over a graph now
// and each trip takes its own lateral bias across the walk, so there is no
// fixed lane to stand in any more. Standing put and waiting is also the truer
// test: it is what a player does.
//
// x = -6.0 is the middle of the walk. The outer part is off limits to the
// player whatever the crowd does: the wall collider reaches -6.70, so with the
// 0.36 m capsule you cannot stand west of -6.34.
await page.evaluate(() => window.__ct.warp(-6.0, -30, 0, 0.14, 0));
await page.waitForTimeout(150);
const me = await pos();
const gaps = [];
for (let i = 0; i < 260; i++) {           // 26 s — long enough for a passer-by
  const ws = await walkers();
  // the nearest person on THIS walk, signed along z so a pass shows as a sign
  // change rather than just a small number
  let best = null;
  for (const q of ws) {
    if (Math.abs(q.x - me[0]) > 0.9) continue;
    if (!best || Math.abs(q.z - me[2]) < Math.abs(best.z - me[2])) best = q;
  }
  if (best) gaps.push(+(best.z - me[2]).toFixed(3));
  await page.waitForTimeout(100);
}
const closest = Math.min(...gaps.map(Math.abs));
// a plateau: held roughly a step short of the player rather than walking on in
const halted = gaps.filter((g) => Math.abs(g) > 0.75 && Math.abs(g) < 1.35).length;
const bothSides = gaps.some((g) => g > 0.6) && gaps.some((g) => g < -0.6);
check(closest < 1.3, `somebody walked up to you — closest approach ${closest.toFixed(2)} m`);
check(halted >= 4, `held a step short instead of walking through — ${(halted / 10).toFixed(1)} s spent at 0.75–1.35 m`);
check(bothSides || closest < 0.6,
  bothSides ? 'and got past you — never trapped, seen on both sides'
    : `and got past you — closed to ${closest.toFixed(2)} m, inside the body`);

// ── 4. the sacred 2 m lane, walked end to end ─────────────────────────────
await page.evaluate(() => window.__ct.warp(-6.1, 6, 0, 0.14, 0));
await page.waitForTimeout(150);
const d = await pos();
await hold('w', 6000);
const e = await pos();
// > 9 m, not > 14. The invariant is that the lane is PASSABLE and you are never
// trapped — not that you cover a particular distance. Citizens stop for errands
// now (a window, a doorway, the bench), and a stationary one is solid for the 1.4 s
// before it gives way, so the same walk legitimately takes longer than it did when
// they all ping-ponged without pausing. 9 m in 6 s is still a third of the block
// and far beyond being stuck; anything near zero is the failure this catches.
check(d[2] - e[2] > 9, `west walk still passable — ${(d[2] - e[2]).toFixed(1)} m south in 6 s ` +
  '(people stopping in the lane and all)');

console.log(errs.length ? `\npage errors:\n${errs.slice(0, 3).join('\n')}` : '\nno page errors');
console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nall crowd checks pass');
await browser.close();
process.exitCode = fails ? 1 : 0;
