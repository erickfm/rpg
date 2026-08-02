// Verifies the collision-debug overlay (ct/debug-collision.ts):
//   1. the V key toggles window.__ct.debugCollisionOn()
//   2. scene object count is IDENTICAL with the overlay off, before vs after
//      having turned it on and off again (the "truly off" contract)
//   3. screenshots with it ON at: the jail site, a parked-car stretch, and
//      standing inside an apartment room
import { chromium } from 'playwright';
import fs from 'fs';

const URL = process.env.SHOT_URL || 'http://localhost:4194/';
fs.mkdirSync('shots/debug-collision', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page_errors: {
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
}
await p.goto(URL);
await p.waitForTimeout(1200);

const sceneCount = () => p.evaluate(() => {
  let n = 0;
  window.__ct.scene().traverse(() => { n++; });
  return n;
});

// ── 1: baseline, overlay off ────────────────────────────────────────────
const before = await sceneCount();
const onBefore = await p.evaluate(() => window.__ct.debugCollisionOn());
console.log(`baseline: debugCollisionOn=${onBefore}, scene objects=${before}`);
if (onBefore !== false) errors.push('debug collision defaulted ON');

// ── 2: press V, confirm it toggles + scene grows ────────────────────────
await p.keyboard.down('v');
await p.waitForTimeout(80);
await p.keyboard.up('v');
await p.waitForTimeout(300);
const onAfterPress = await p.evaluate(() => window.__ct.debugCollisionOn());
const afterOn = await sceneCount();
console.log(`after V: debugCollisionOn=${onAfterPress}, scene objects=${afterOn} (+${afterOn - before})`);
if (!onAfterPress) errors.push('V did not turn debugCollision on');
if (afterOn <= before) errors.push('turning debugCollision on added nothing to the scene');

// screenshot: wherever spawn put us, overlay on
await p.screenshot({ path: 'shots/debug-collision/on-spawn.png' });

// ── 3: jail site, exterior — the motivating case ────────────────────────
// standing in the side street looking straight down the door axis; the jail
// building's own footprint reads as a green box dead ahead against its
// neighbours (LOANS to the left, the casino to the right).
const sites = await p.evaluate(() => window.__ct.sites());
if (sites.jail) {
  await p.evaluate(() => window.__ct.warp(45, -103, Math.PI / 2, 0, 0));
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'shots/debug-collision/on-jail-exterior.png' });
  console.log('jail exterior shot: ok', sites.jail);
} else {
  errors.push('no jail site published — cannot shoot the motivating case');
}

// ── 4: parked cars + street furniture, near the side-street corner ──────
await p.evaluate(() => window.__ct.warp(40, -103, -Math.PI / 2, 0, 0.05));
await p.waitForTimeout(400);
await p.screenshot({ path: 'shots/debug-collision/on-street-cars.png' });

// ── 5: inside a room — the jail's own cell block ─────────────────────────
const rooms = await p.evaluate(() => window.__ct.rooms());
console.log('rooms:', rooms);
const dims = await p.evaluate(() => window.__ct.roomDims());
const jailRoom = dims.find((r) => r.id === 'jail');
if (jailRoom) {
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [jailRoom.cx, jailRoom.cz - 5]);
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'shots/debug-collision/on-jail-interior.png' });
} else {
  errors.push('no jail room in roomDims() — cannot shoot the interior case');
}

// ── 6: turn OFF, confirm scene returns to baseline count exactly ───────
await p.keyboard.down('v');
await p.waitForTimeout(80);
await p.keyboard.up('v');
await p.waitForTimeout(300);
const onAfterOff = await p.evaluate(() => window.__ct.debugCollisionOn());
const afterOff = await sceneCount();
console.log(`after 2nd V: debugCollisionOn=${onAfterOff}, scene objects=${afterOff}`);
if (onAfterOff) errors.push('second V did not turn debugCollision back off');
if (afterOff !== before) errors.push(`scene count did not return to baseline: ${before} -> ${afterOff}`);

// off contrast: same jail-interior vantage as step 5, overlay now off
await p.screenshot({ path: 'shots/debug-collision/off-jail-interior.png' });

if (errors.length) {
  console.log('FAILURES:');
  for (const e of errors) console.log(' -', e);
  await b.close();
  process.exit(1);
}
console.log('ALL OK');
await b.close();
