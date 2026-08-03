// DOES A CLICK ON A KEY THE PLAYER CAN SEE ACTUALLY PRESS IT?
//
// Drives the REAL pointer — `page.mouse.move` / `page.mouse.click` at a page
// point projected from the physical key's own place on the keypad mesh — so
// everything between the glass and the machine is under test: the raycast
// delegation in `ct/atm-face.ts`, `crosstown.ts`'s pick, `ct/hud.ts`'s gate,
// the canvas-pixel mapping, the hand cursor and the dispatch.
//
// IT EXITS NON-ZERO ON FAILURE. Six checks in this repo printed a failure and
// exited 0.
//
//   SHOT_URL=http://localhost:4185/ node scripts/probes/w57-pad-walk.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4185/');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'}  ${msg}`); if (!cond) fails.push(msg); };

const spot = await page.evaluate(() => window.__ct.spots()
  .filter((q) => /FIRST FEDERAL/i.test(q.label) && !/into /i.test(q.label))
  .map((q) => ({ x: q.x, z: q.z }))[0]);
await page.evaluate(([x, z]) => window.__ct.warp(
  x + 1.2, z, Math.atan2(-1.2, 0), window.__ct.groundAt(x + 1.2, z), 0), [spot.x, spot.z]);
await page.waitForTimeout(400);

// A HELD keypress — the [E] edge is read once per rendered frame (§5).
await page.keyboard.down('e');
await page.waitForFunction(() => window.__hud.panel() === 'ct-atm', null, { timeout: 8000 });
await page.keyboard.up('e');
await page.waitForTimeout(800);

/** the page point over a named PHYSICAL key, projected from the keypad mesh */
const pointOf = (key) => page.evaluate((key) => {
  const p = window.__atm.padPoint(key);
  if (!p) return null;
  const scene = window.__ct.scene(), cam = window.__ct.camera();
  // the keypad mesh nearest the camera — the pair share a tag
  let m = null, bd = Infinity;
  scene.traverse((o) => {
    if (o.userData?.atmPart !== 'keys') return;
    o.updateWorldMatrix(true, false);
    const v = new (o.position.constructor)().setFromMatrixPosition(o.matrixWorld);
    const d = (v.x - cam.position.x) ** 2 + (v.z - cam.position.z) ** 2;
    if (d < bd) { bd = d; m = o; }
  });
  if (!m) return null;
  const pos = m.geometry.getAttribute('position'), uv = m.geometry.getAttribute('uv');
  const corner = (tu, tv) => {
    for (let i = 0; i < uv.count; i++) {
      if (Math.abs(uv.getX(i) - tu) < 1e-6 && Math.abs(uv.getY(i) - tv) < 1e-6) {
        return new (m.position.constructor)(pos.getX(i), pos.getY(i), pos.getZ(i));
      }
    }
    return null;
  };
  const a = corner(0, 0).clone().lerp(corner(1, 0), p.u);
  const b = corner(0, 1).clone().lerp(corner(1, 1), p.u);
  const world = a.lerp(b, p.v).applyMatrix4(m.matrixWorld);
  const ndc = world.clone().project(cam);
  const r = document.querySelector('canvas').getBoundingClientRect();
  return {
    x: r.left + (ndc.x * 0.5 + 0.5) * r.width,
    y: r.top + (-ndc.y * 0.5 + 0.5) * r.height,
    canvas: { x: p.x, y: p.y },
  };
}, key);

// BOTH cursors are `url(data:image/png;base64,…) x y, <keyword>` — hand ends in
// `pointer`, arrow in `default`. Match the KEYWORD, not the whole string: the
// base64 payload is 2 kB of the alphabet that spells both words, so a substring
// test on the whole thing is a check that can pass by accident.
const cursorKind = async () => {
  const c = await page.evaluate(() => document.body.style.cursor);
  return (c.split(',').pop() ?? '').trim() || '(none)';
};

const snap = () => page.evaluate(() => ({
  screen: window.__atm.screen(), pin: window.__atm.pin(),
  panel: window.__hud.panel(), cursor: document.body.style.cursor.slice(0, 4),
  seated: !!window.__ct.seated(),
}));

// ── 1. the machine agrees with itself about where its keys are ────────────
const roundTrip = await page.evaluate(() => window.__atm.padKeys()
  .map((k) => { const p = window.__atm.padPoint(k); return [k, window.__atm.padAt(p.x, p.y)]; }));
ok(roundTrip.every(([k, got]) => k === got),
   `all 12 keys hit-test to themselves: ${JSON.stringify(roundTrip.filter(([k, g]) => k !== g))}`);

// nothing on the TUBE is a pad key — the drawn pad is gone
const tubeClean = await page.evaluate(() => {
  for (let y = 0; y < 205; y += 5) for (let x = 0; x < 300; x += 5) {
    if (window.__atm.padAt(x, y)) return { x, y };
  }
  return null;
});
ok(tubeClean === null, `no pad key anywhere on the tube (drawn pad retired): ${JSON.stringify(tubeClean)}`);

// ── 2. INSERT CARD, then type the PIN on the REAL keys with a REAL mouse ──
await page.keyboard.press('1');
await page.waitForTimeout(250);
ok((await snap()).screen === 'pin', 'INSERT CARD reaches the PIN screen');

for (const [n, key] of [[1, '4'], [2, '9'], [3, '1'], [4, '7']]) {
  const p = await pointOf(key);
  if (!p) { ok(false, `could not project key ${key}`); break; }
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(70);
  const cur = await cursorKind();
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(140);
  const s = await snap();
  ok(cur === 'pointer', `hand cursor over the real key ${key} (got ${cur})`);
  ok(s.pin === n, `clicking the real ${key} put digit ${n} in (pin=${s.pin}) at page ${p.x.toFixed(0)},${p.y.toFixed(0)} canvas ${p.canvas.x.toFixed(0)},${p.canvas.y.toFixed(0)}`);
}

// CLR takes one back off, and putting it back leaves four
const clr = await pointOf('CLR');
await page.mouse.click(clr.x, clr.y);
await page.waitForTimeout(140);
ok((await snap()).pin === 3, 'the real CLR key deletes a digit');
const k5 = await pointOf('5');
await page.mouse.click(k5.x, k5.y);
await page.waitForTimeout(140);
ok((await snap()).pin === 4, 'and the fourth digit goes back in');

// ── 3. ENT on the real pad opens the menu ─────────────────────────────────
const ent = await pointOf('ENT');
await page.mouse.click(ent.x, ent.y);
await page.waitForTimeout(250);
ok((await snap()).screen === 'menu', 'the real ENT key accepts the PIN');

// ── 4. the pad drives the MENU too, as a numeric pad on a real machine does
const k1 = await pointOf('1');
await page.mouse.click(k1.x, k1.y);
await page.waitForTimeout(250);
ok((await snap()).screen === 'balance', 'the real 1 key picks the first soft-key row (BALANCE)');
await page.screenshot({ path: '/tmp/w57-pad-walk-balance.png' });

// a key that does NOTHING on this screen must not offer a hand
const dead = await pointOf('0');
await page.mouse.move(dead.x, dead.y);
await page.waitForTimeout(70);
const deadCur = await cursorKind();
ok(deadCur === 'default', `no hand over a dead key on the BALANCE screen (cursor=${deadCur})`);

// ── 5. ESCAPE STILL RELEASES, and the feet come back ──────────────────────
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const out = await snap();
ok(out.panel === null || out.panel === undefined || out.panel === '', `Escape closed the panel (panel=${out.panel})`);
ok(out.seated === false, 'Escape gave the feet back');

// ── 6. AND THE WORLD STOPS SEEING THE PHANTOM. With the panel shut, the CRT
//      must not answer for the shelf, or every scene-wide raycast — spot
//      selection, `canSee` — gets a hit 20 cm from where it really landed.
ok((await page.evaluate(() => window.__atm.padLive())) === false,
   'the CRT stops answering for the keypad once the panel is shut');
// past `hud.ts`'s 500 ms DISMISS_LOCKOUT, or `open()` declines and the flag
// would be measuring a panel that never came up
await page.waitForTimeout(700);
await page.evaluate(() => window.__atm.open());
await page.waitForTimeout(300);
ok((await page.evaluate(() => window.__atm.padLive())) === true,
   'and answers for it again while the machine is open');
await page.keyboard.press('Escape');
await page.waitForTimeout(250);
ok((await page.evaluate(() => window.__atm.padLive())) === false,
   'and drops it again on the second close');

// A DECLINED OPEN MUST NOT RAISE IT. `hud.ts` refuses to reopen inside a 500 ms
// lockout, so a caller that flips the flag before asking leaves it up with no
// close coming — which is exactly what this walk caught on the first pass.
await page.evaluate(() => window.__atm.open());
await page.waitForTimeout(120);
ok((await page.evaluate(() => window.__hud.panel())) !== 'ct-atm', 'the lockout really did decline the open');
ok((await page.evaluate(() => window.__atm.padLive())) === false,
   'an open the framework DECLINED leaves the keypad unpickable');

console.log(errs.length ? `\nconsole/page errors:\n  ${errs.join('\n  ')}` : '\nno console or page errors');
ok(errs.length === 0, 'no console or page errors');

await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
