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
// where the people are: pull their meshes straight out of the scene, since
// __ct.people() reports build, not position.
// x < 50 excludes the hermit — the apartment interior is parked out at x>100
// and he is drawn to the same 0.95 x 1.9 convention as the street cast.
const walkers = () => page.evaluate(() => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    // a person: plane 0.95 x 1.9, feet-translated, double-sided, alphaTest
    const g = o.geometry?.parameters;
    if (g && g.width === 0.95 && g.height === 1.9 && o.material?.alphaTest === 0.5 && o.position.x < 50) {
      out.push({ x: +o.position.x.toFixed(3), z: +o.position.z.toFixed(3), y: +o.position.y.toFixed(3) });
    }
  });
  return out.sort((a, b) => a.x - b.x || a.z - b.z);
});

let fails = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${msg}`); if (!ok) fails++; };

console.log('crowd probe:');
// ── 1. they walk ──────────────────────────────────────────────────────────
const w0 = await walkers();
await page.waitForTimeout(1500);
const w1 = await walkers();
check(w0.length === 6, `six people in the scene (found ${w0.length})`);
const moved = w0.filter((p, i) => Math.abs(p.z - (w1[i]?.z ?? p.z)) > 0.2).length;
check(moved >= 4, `they are walking — ${moved}/6 moved >0.2 m in 1.5 s`);
check(new Set(w0.map((p) => p.y.toFixed(3))).size === 1 && w0[0].y === 0.14,
  `all feet planted on the kerb at y=${w0[0].y}`);

// ── 2 & 3. the encounter: they halt a step short, then give up and pass ───
//
// Stand still in the innermost lane and let a southbound walker come to you.
// Only lane |x| = 6.05 is used: the outer lanes sit 0.31 m off the facade,
// which is fine for a 0.25 m-half body but jams the 0.36 m player capsule in
// the wall (maxX = -FACE + 0.3 = -6.70). Not a bug — the player simply cannot
// stand where the walkers hug the wall.
const tgt = (await walkers()).find((p) => Math.abs(Math.abs(p.x) - 6.05) < 0.01 && p.x < 0);
await page.evaluate(([x, z]) => window.__ct.warp(x, z - 4, Math.PI, 0.14, 0), [tgt.x, tgt.z]);
await page.waitForTimeout(150);
const me = await pos();
const gaps = [];
for (let i = 0; i < 70; i++) {            // 7 s of the encounter, sampled
  const ws = await walkers();
  const p = ws.reduce((m, q) => (Math.abs(q.x - me[0]) < 0.4 && Math.abs(q.z - me[2]) < Math.abs(m.z - me[2]) ? q : m), { z: 1e9 });
  gaps.push(+(p.z - me[2]).toFixed(3));   // signed: + is north of me, - is past me
  await page.waitForTimeout(100);
}
const closest = Math.min(...gaps.map(Math.abs));
// a plateau: held roughly a step short of the player rather than walking on in
const halted = gaps.filter((g) => g > 0.8 && g < 1.25).length;
const passed = gaps.some((g) => g < -0.5);
check(closest < 1.3, `they walked up to you — closest approach ${closest.toFixed(2)} m`);
check(halted >= 5, `halted a step short instead of walking through — ${(halted / 10).toFixed(1)} s spent at 0.8–1.25 m`);
check(passed, 'gave up and squeezed past — never trapped you');

// ── 4. the sacred 2 m lane, walked end to end ─────────────────────────────
await page.evaluate(() => window.__ct.warp(-6.1, 6, 0, 0.14, 0));
await page.waitForTimeout(150);
const d = await pos();
await hold('w', 6000);
const e = await pos();
check(d[2] - e[2] > 14, `west walk still passable — ${(d[2] - e[2]).toFixed(1)} m south in 6 s (people, trees and all)`);

console.log(errs.length ? `\npage errors:\n${errs.slice(0, 3).join('\n')}` : '\nno page errors');
console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nall crowd checks pass');
await browser.close();
process.exitCode = fails ? 1 : 0;
