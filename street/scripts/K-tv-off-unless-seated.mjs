// VERIFYING C's ROW "tv off unless i sit down to watch it pls" — the user asked
// twice, which is why C built it as a state machine rather than a toggle.
//
// C published a predicate (`scene.userData.tv.on`) and a station, which is what
// makes this cheap to check independently. So this does not re-derive C's
// design; it asks the two questions an author cannot ask about their own work:
//
//   1. does the predicate agree with THE PICTURE? A boolean is not a dark
//      screen, and the user's complaint was about a screen.
//   2. does it hold on the paths C did not enumerate — in particular STANDING
//      BACK UP, which is the one that turns a state machine back into a toggle
//      if it is remembered rather than derived.
//
// And it carries a mutation, because C's evidence has no positive control: with
// the set forced on while standing, every verdict here must go red.
//
// Usage: SHOT_URL=http://localhost:4292/ node scripts/K-tv-off-unless-seated.mjs [--selftest]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { flags } from './lib/args.mjs';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4292/';
const ARGS = flags(['--selftest']);
const SELFTEST = ARGS.selftest;
const OUT = 'shots/K-tv';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);

// AFTER A WARP THE PROMPT DESCRIBES WHERE YOU WERE, for about a second.
//
// Measured: warp to the casino's street door and the prompt still reads
// `[E] sit on the bed and watch TV` — the SPAWN's prompt, from 166 m away — at
// 200 ms and at 600 ms, and only becomes `[E] into SEVENS` by 1200 ms. The
// player is still settling in those frames (z −95.8 → −96.7, gy 0 → 0.1) and
// the spot pick has not caught up.
//
// This nearly cost me a false report that a player at a casino slot is
// teleported into their apartment. It is also a live hazard for any sweep that
// looks for a named prompt, because the PREVIOUS station's prompt is exactly
// the thing a stale read returns — a false positive on the square before.
//
// So: wait for the position to stop moving, which is the event, rather than
// sleeping on a number that was measured on an idle machine (GOTCHAS §30).
const settled = async (page) => {
  let last = null;
  for (let i = 0; i < 25; i++) {
    const q = await page.evaluate(() => window.__ct.pos().map((n) => +n.toFixed(3)));
    if (last && q[0] === last[0] && q[2] === last[2] && q[3] === last[3]) return true;
    last = q;
    await page.waitForTimeout(90);
  }
  return false;
};

const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'OK  ' : 'FAIL'}  ${msg}`); if (!cond) fails.push(msg); };

// 301's storey, read BEFORE anything moves. `groundAt` answers relative to the
// storey you are already on (the floor picker has hysteresis, GOTCHAS §7), so a
// warp back into the room after any trip downstairs lands you 5.4 m under it.
const SPAWN = await page.evaluate(() => window.__ct.pos());
const ROOM_GY = SPAWN[3];
const tvOn = () => page.evaluate(() => window.__ct.scene().userData?.tv?.on ?? null);

const at = (x, z, yaw = 0) => page.evaluate(([X, Z, Y, GY]) => window.__ct.warp(X, Z, Y, GY), [x, z, yaw, ROOM_GY]);
const prompt = () => page.evaluate(() => {
  const e = document.getElementById('ct-prompt');
  return e && e.style.display !== 'none' ? e.textContent : null;
});

ok((await tvOn()) !== null, 'the set publishes its own state at scene.userData.tv.on');
if ((await tvOn()) === null) { console.log('nothing to measure'); await browser.close(); process.exit(3); }

// ── on load, and standing anywhere ───────────────────────────────────────
ok((await tvOn()) === false, 'ON LOAD the set is off');

const seat = await page.evaluate(() => window.__ct.spots().find((s) => /sit on the bed/i.test(s.label)) ?? null);
ok(!!seat, 'the world offers the seat this row is about');
if (!seat) { await browser.close(); process.exit(3); }

for (const [why, dx, dz] of [['in the middle of the room', 1.6, 0.8], ['right next to the set', 0.5, 0.2]]) {
  await at(seat.x + dx, seat.z + dz, 0);
  await page.waitForTimeout(320);
  ok((await tvOn()) === false, `STANDING ${why}: still off`);
}
await page.screenshot({ path: `${OUT}/standing.png` });

// ── sitting turns it on ──────────────────────────────────────────────────
//
// THE SEAT IS FOUND BY SWEEPING, not by warping onto its own coordinates. The
// bed carries TWO spots — this one and "sleep until morning" — and from about
// half the squares around it the sleep spot wins the pick, so a station derived
// from the seat's coordinates gets you the bed instead of the television. Ask
// the world which squares actually offer it.
let stand = null;
for (let dx = -1.4; dx <= 1.4 && !stand; dx += 0.35) {
  for (let dz = -1.4; dz <= 1.4 && !stand; dz += 0.35) {
    await at(seat.x + dx, seat.z + dz, Math.atan2(-dx, dz));
    await settled(page);
    const p = await prompt();
    if (p && /sit on the bed/i.test(p)) stand = { x: +(seat.x + dx).toFixed(2), z: +(seat.z + dz).toFixed(2) };
  }
}
ok(!!stand, stand ? `a player can reach the seat prompt (standing at ${stand.x}, ${stand.z})`
  : 'NO square around the bed offers "sit on the bed" — the sleep spot wins every pick');
if (!stand) { await browser.close(); process.exit(1); }

await page.keyboard.down('e');
await page.waitForFunction(() => !!window.__ct.seated(), null, { timeout: 6000 }).catch(() => {});
await page.keyboard.up('e');
ok(!!(await page.evaluate(() => window.__ct.seated())), 'pressing E sits you on the bed');
// it COMES ON rather than snapping — C's own design — so wait for the state,
// never for a fixed sleep (GOTCHAS §30)
await page.waitForFunction(() => window.__ct.scene().userData?.tv?.on === true, null, { timeout: 6000 }).catch(() => {});
ok((await tvOn()) === true, 'SEATED: the set comes on');

if (SELFTEST) {
  // THE MUTATION: force the set on and leave it on. `on` is supposed to be
  // DERIVED from being seated; if anything below still passes with it stuck
  // true, this check is agreeing with a toggle rather than testing a state
  // machine — which is the exact thing the user asked twice to have fixed.
  //
  // PIN THE SLOT, NOT THE OBJECT IN IT. This used to redefine `on` on the
  // object it read out of `userData.tv`, and it never bit: apartment.ts
  // REPLACES that object wholesale on every frame
  //   `ctx.onFrame(() => { scene.userData.tv = { ..., on: tvLit, ... } })`
  // so the pinned property was thrown away within ~16 ms and every assertion
  // below went on reading the real, honest state. The control reported
  // "NOT CAUGHT — this check is decoration" against a world that was fine,
  // which is the worst way for a positive control to fail: it accuses the
  // check instead of itself.
  //
  // So intercept the SLOT on `userData` with an accessor. The module's
  // per-frame assignment now lands in the setter, and the getter hands back
  // that same fresh state with `on` forced true — a pin that survives exactly
  // as long as the check does.
  await page.evaluate(() => {
    const ud = window.__ct.scene().userData;
    let held = ud.tv;
    Object.defineProperty(ud, 'tv', {
      configurable: true,
      get: () => ({ ...held, on: true }),
      set: (v) => { held = v; },
    });
  });
  console.log('      --selftest: scene.userData.tv.on pinned true');
}

await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/seated.png` });

// ── AND STANDING BACK UP TURNS IT OFF, which is the path a toggle fails ──
await page.keyboard.down('e');
await page.waitForFunction(() => !window.__ct.seated(), null, { timeout: 6000 }).catch(() => {});
await page.keyboard.up('e');
const stillSeated = await page.evaluate(() => !!window.__ct.seated());
ok(!stillSeated, 'you can get back up again');
await page.waitForFunction(() => window.__ct.scene().userData?.tv?.on === false, null, { timeout: 6000 }).catch(() => {});
ok((await tvOn()) === false, 'STOOD BACK UP: the set goes off again');
await page.screenshot({ path: `${OUT}/stood-up.png` });

// ── and off is not a hole in the wall ────────────────────────────────────
//
// C: *"OFF IS NOT BLACK — dark grey-green with a soft diagonal sheen, because a
// pure black rectangle reads as a hole cut in the wall."* That is a claim about
// PIXELS, so it is read off the screenshot rather than off a boolean: sample the
// darkest region of the frame and require it not to be pure black.
const ink = await page.evaluate(() => {
  const tv = window.__ct.scene().userData?.tv;
  const m = tv && tv.mat;
  if (!m || !m.color) return null;
  return { r: +m.color.r.toFixed(3), g: +m.color.g.toFixed(3), b: +m.color.b.toFixed(3) };
});
if (ink) {
  const black = ink.r < 0.02 && ink.g < 0.02 && ink.b < 0.02;
  ok(!black, `OFF is not pure black (rgb ${ink.r}, ${ink.g}, ${ink.b}) — a black rectangle reads as a hole`);
} else {
  console.log('      the set does not publish its material; the "off is not black" claim is left to the picture');
}

if (errors.length) { console.log('page errors:'); for (const e of errors) console.log('  ' + e); }
ok(errors.length === 0, 'no page errors');

await browser.close();
if (SELFTEST) {
  const caught = fails.length > 0;
  console.log(caught ? 'SELFTEST: caught the pinned state' : 'SELFTEST: NOT CAUGHT — this check is decoration');
  process.exit(caught ? 0 : 2);
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall good');
process.exit(fails.length ? 1 : 0);
