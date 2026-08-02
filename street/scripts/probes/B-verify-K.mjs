// VERIFYING K: the screen fade, and the pockets panel.
//
// Both rows name a station I can actually run, which is why they are worth a
// verifier's time rather than a glance — a claim with a station is a claim that
// can come back false, and these ones make specific numeric promises:
//
//   FADE   "fade out 850 ms, `mid` runs WHILE BLACK, black held 750 ms, fade in
//           1000 ms. Nothing moves or interacts through it, INCLUDING A KEY
//           ALREADY HELD DOWN when it starts."
//   PANEL  "open/close, one-thing-at-a-time, the world frozen behind it, ESC
//           always working."
//
// The held-key promise is the one I most want to test, because it is the kind
// of thing that works when you press the key during the fade and fails when the
// key was already down — and nobody tests the second case by hand.
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { goto, settle } from '../lib/reachable.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4279/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 620 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const lum = async () => {
  const s = (await p.screenshot({ clip: { x: 0, y: 0, width: 900, height: 480 } })).toString('base64');
  return p.evaluate(async (b64) => {
    const img = new Image();
    await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = 'data:image/png;base64,' + b64; });
    const c = document.createElement('canvas'); c.width = 90; c.height = 48;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, 90, 48);
    const d = g.getImageData(0, 0, 90, 48).data;
    let a = 0;
    for (let i = 0; i < d.length; i += 4) a += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    return +(a / (d.length / 4) / 255).toFixed(4);
  }, s);
};

// ── does the affordance even exist? ──────────────────────────────────────
const api = await p.evaluate(() => ({
  fade: typeof window.__hud?.fade,
  atm: typeof window.__atm?.open,
  advanceClock: typeof window.__ct?.advanceClock,
  clockNow: typeof window.__ct?.clockNow,
}));
console.log('\n── the published affordances ──');
console.log('  ' + JSON.stringify(api));
if (api.fade !== 'function') {
  console.log('  __hud.fade is not a function — the row names it as the station, so this is the row failing.');
  await b.close(); process.exit(1);
}

// ── THE FADE, with a key already held down before it starts ──────────────
await p.evaluate(() => window.__ct.clock(22, 30));
await p.evaluate(() => window.__ct.warp(-6, -40, 0, 0.14, 0));
await settle(p);
const t0 = await p.evaluate(() => window.__ct.clockNow());
const p0 = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));

// hold W BEFORE the fade begins. This is the case the row claims and the one a
// hand test never covers.
await p.keyboard.down('w');
await p.waitForTimeout(250);
const pMoving = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
const movedBefore = Math.hypot(pMoving[0] - p0[0], pMoving[2] - p0[2]);

// FIRE IT, DO NOT AWAIT IT. `page.evaluate` awaits a returned promise, and
// `fade()` returns one that settles when the whole 2.6 s cut is over — so my
// first version measured 34 frames of the world AFTER the fade had finished
// and reported "it never went black". The fade was fine; the probe was
// watching the wrong three seconds.
await p.evaluate(() => { window.__hud.fade({ mid: () => window.__ct.advanceClock(480, 0) }); });
const trace = [];
const start = Date.now();
// read the overlay's own opacity as well as the frame, because a DOM sample is
// cheap and cannot be missed between two screenshots
for (let i = 0; i < 26; i++) {
  const op = await p.evaluate(() => {
    const d = document.getElementById('ct-fade');
    return d ? +(getComputedStyle(d).opacity) : null;
  });
  trace.push([Date.now() - start, await lum(), op]);
}
await p.keyboard.up('w');
const pAfter = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
const t1 = await p.evaluate(() => window.__ct.clockNow());

console.log('\n── the fade, sampled every ~90 ms (frame luminance) ──');
console.log('  frame:   ' + trace.map(([, l]) => l.toFixed(3)).join(' '));
console.log('  overlay: ' + trace.map(([, , o]) => (o === null ? '  -  ' : o.toFixed(2))).join('  '));
const dark = trace.filter(([, l, o]) => l < 0.01 || (o !== null && o > 0.98));
const lit = trace.filter(([, l, o]) => !(l < 0.01 || (o !== null && o > 0.98)));
console.log(`  ${trace.length} samples: ${dark.length} at or below 0.006 (black), ${lit.length} lit`);
if (dark.length) {
  console.log(`  black from ${dark[0][0]} ms to ${dark[dark.length - 1][0]} ms` +
    `  — held ~${dark[dark.length - 1][0] - dark[0][0]} ms`);
}
console.log(`  it went black and came back: ${dark.length > 0 && lit.length > 0 &&
  trace[trace.length - 1][1] > 0.006 ? 'YES' : 'NO'}`);

console.log('\n── the clock, which the row says advances WHILE BLACK ──');
console.log(`  before ${String(t0.hour).padStart(2, '0')}:${String(t0.minute).padStart(2, '0')}` +
  `   after ${String(t1.hour).padStart(2, '0')}:${String(t1.minute).padStart(2, '0')}` +
  `   delta ${t1.totalMin - t0.totalMin} min (asked for 480)`);

console.log('\n── A KEY HELD DOWN THROUGH IT: the claim nobody tests by hand ──');
console.log(`  W was already down and moving ${movedBefore.toFixed(2)} m in 250 ms before the fade`);
console.log(`  position at fade start ${JSON.stringify(pMoving)}   after ${JSON.stringify(pAfter)}`);
const movedThrough = Math.hypot(pAfter[0] - pMoving[0], pAfter[2] - pMoving[2]);
console.log(`  moved during the fade: ${movedThrough.toFixed(2)} m` +
  (movedThrough < 0.25 ? '   HOLDS — the held key did not drive the player' : '   <-- IT MOVED'));

// ── THE POCKETS PANEL ────────────────────────────────────────────────────
await p.waitForTimeout(400);
const before = await lum();
await p.keyboard.press('i');
await p.waitForTimeout(500);
const openLum = await lum();
const openState = await p.evaluate(() => ({
  ui: window.__hud?.uiOpen ? window.__hud.uiOpen() : null,
  pos: window.__ct.pos().map((v) => +v.toFixed(2)),
}));
await p.screenshot({ path: 'shots/B-verify-K/pockets.png' });
// world frozen behind it: hold W and see if the player moves
await p.keyboard.down('w'); await p.waitForTimeout(500); await p.keyboard.up('w');
const posInPanel = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
const drift = Math.hypot(posInPanel[0] - openState.pos[0], posInPanel[2] - openState.pos[2]);
await p.keyboard.press('Escape');
await p.waitForTimeout(500);
const closedLum = await lum();

console.log('\n── the pockets panel ──');
console.log(`  frame luminance  before ${before}  with the panel up ${openLum}  after ESC ${closedLum}`);
console.log(`  the panel changed the frame: ${Math.abs(openLum - before) > 0.02 ? 'YES' : 'no — it may not have opened'}`);
console.log(`  ESC returned it: ${Math.abs(closedLum - before) < 0.03 ? 'YES' : 'NO'}`);
console.log(`  world frozen — W held for 500 ms with the panel up moved the player ${drift.toFixed(2)} m` +
  (drift < 0.1 ? '   HOLDS' : '   <-- THE WORLD RAN ON'));
await b.close();
