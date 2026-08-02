// WALK to the bed on WASD from wherever the game drops you, sit, and watch the
// television — no warp anywhere in this file.
//
// The check that owns this row (`scripts/K-tv-off-unless-seated.mjs`) warps to
// find the seat, which is right for a check: it has to sweep the squares around
// the bed to find which ones offer the prompt at all. But a warp puts the
// player on an exact coordinate, and the bug this row is about was a
// coordinate being 0.54 m off — so a warp is the one instrument that could
// have been made to pass by a fix that a walking player still could not use.
// This walks.
//
// Usage: SHOT_URL=http://localhost:4193/ node scripts/probes/w18-walk-to-the-tv.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4193/';
const OUT = 'shots/w18-walk';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

const fails = [];
const ok = (c, m) => { console.log(`${c ? 'OK  ' : 'FAIL'}  ${m}`); if (!c) fails.push(m); };

const pos = () => page.evaluate(() => window.__ct.pos());
const tvOn = () => page.evaluate(() => window.__ct.scene().userData?.tv?.on ?? null);
const prompt = () => page.evaluate(() => {
  const e = document.getElementById('ct-prompt');
  return e && e.style.display !== 'none' ? e.textContent : null;
});
const yawOf = () => page.evaluate(() => window.__ct.yaw());

// the square the world says you stand on to be offered the seat
const spot = await page.evaluate(() =>
  window.__ct.spots().find((s) => /sit on the bed/i.test(s.label)) ?? null);
if (!spot) { console.log('no seat spot'); await browser.close(); process.exit(3); }
console.log('walking to the seat prompt at', spot.x.toFixed(2), spot.z.toFixed(2));

const start = await pos();
console.log('spawned at', start[0].toFixed(2), start[2].toFixed(2), 'gy', start[3]);

// GET OFF THE SPOT FIRST — see the steer helper below, which this uses.
//
// 301 spawns you 0.24 m from the seat's own square, so "walk to the bed" from
// spawn is a no-op that passes before it has tested anything. Walk over to
// 301's door first, confirm the prompt is gone and the set is dark, and only
// then walk back in — which is the trip a player actually makes. Holding `s`
// was not enough: there is a wall 0.58 m behind the spawn.
const DOOR = { x: 200.64, z: -17.455 };   // 301's own "close the door" spot, 2.14 m away

// STEER, don't teleport: face the target with the arrow keys and hold W. Yaw 0
// is -z and +yaw turns toward +x, which is the rig's own convention (fp.ts
// look vector: sin(yaw), -cos(yaw)).
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const steerTo = async (tx, tz, tol) => {
  for (let step = 0; step < 240; step++) {
    const p = await pos();
    if (Math.hypot(tx - p[0], tz - p[2]) < tol) return true;
    const err = wrap(Math.atan2(tx - p[0], -(tz - p[2])) - (await yawOf()));
    if (Math.abs(err) > 0.09) {
      const k = err > 0 ? 'ArrowRight' : 'ArrowLeft';
      await page.keyboard.down(k);
      await page.waitForTimeout(Math.min(220, (Math.abs(err) / 1.7) * 1000));
      await page.keyboard.up(k);
    } else {
      await page.keyboard.down('w');
      await page.waitForTimeout(160);
      await page.keyboard.up('w');
    }
  }
  return false;
};

await steerTo(DOOR.x, DOOR.z, 0.3);
const away = await pos();
const backedOff = Math.hypot(away[0] - spot.x, away[2] - spot.z);
// the bar is the SPOT'S OWN RADIUS plus a margin, not a magic number: "far
// enough that the trigger is genuinely behind me" is the thing being claimed,
// and the trigger declares how big it is.
ok(backedOff > spot.r + 0.4, `walked away from the bed first (${backedOff.toFixed(2)} m off a spot of radius ${spot.r})`);
ok(!/sit on the bed/i.test((await prompt()) ?? ''), 'from across the room the seat is not offered');
ok((await tvOn()) === false, 'from across the room the set is off');

const arrived = await steerTo(spot.x, spot.z, 0.45);
const here = await pos();
ok(arrived, `walked to the bed on WASD (ended ${here[0].toFixed(2)}, ${here[2].toFixed(2)})`);
await page.screenshot({ path: `${OUT}/1-arrived.png` });

const pr = await prompt();
ok(!!pr && /sit on the bed/i.test(pr), `the seat is offered where a walking player ends up: ${JSON.stringify(pr)}`);
ok((await tvOn()) === false, 'standing beside the bed the set is still off');

// sit
await page.keyboard.down('e');
await page.waitForFunction(() => !!window.__ct.seated(), null, { timeout: 6000 }).catch(() => {});
await page.keyboard.up('e');
ok(!!(await page.evaluate(() => window.__ct.seated())), 'E sits you down');
await page.waitForFunction(() => window.__ct.scene().userData?.tv?.on === true, null, { timeout: 6000 }).catch(() => {});
ok((await tvOn()) === true, 'SAT DOWN: the television comes on');
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/2-seated-tv-on.png` });

// and back up
await page.keyboard.down('e');
await page.waitForFunction(() => !window.__ct.seated(), null, { timeout: 6000 }).catch(() => {});
await page.keyboard.up('e');
ok(!(await page.evaluate(() => !!window.__ct.seated())), 'E stands you back up');
await page.waitForFunction(() => window.__ct.scene().userData?.tv?.on === false, null, { timeout: 6000 }).catch(() => {});
ok((await tvOn()) === false, 'STOOD UP: the television goes off');

// and you are not wedged: you can still walk after standing
const before = await pos();
await page.keyboard.down('w'); await page.waitForTimeout(400); await page.keyboard.up('w');
const after = await pos();
ok(Math.hypot(after[0] - before[0], after[2] - before[2]) > 0.15,
   `you can walk away after standing (moved ${Math.hypot(after[0] - before[0], after[2] - before[2]).toFixed(2)} m)`);
await page.screenshot({ path: `${OUT}/3-stood-up.png` });

if (errors.length) { console.log('page errors:'); for (const e of errors) console.log('  ' + e); }
ok(errors.length === 0, 'no page errors');

await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall good');
process.exit(fails.length ? 1 : 0);
