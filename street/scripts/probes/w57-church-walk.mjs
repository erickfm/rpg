// WALK THE CHURCH DOOR. The opening went from 1.4 x 2.15 m to 2.75 x 3.75 m
// and two real leaves now hang in it, so the thing that has to be proved is not
// how it looks — it is that a player can still get in, get out, and cannot be
// wedged on a leaf. A screenshot cannot prove you are not stuck.
//
// Exits non-zero on failure.
//
//   SHOT_URL=http://localhost:4185/ node scripts/probes/w57-church-walk.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
const errs = [];
const kitWarns = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errs.push('console.error: ' + m.text());
  if (/\[interior:church\]/.test(m.text())) kitWarns.push(m.text());
});
await page.goto(aim('http://localhost:4185/'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const fails = [];
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'}  ${m}`); if (!c) fails.push(m); };
// `__ct.pos()` is [x, y, z, groundY] — crosstown.ts:1683
const at = () => page.evaluate(() => {
  const p = window.__ct.pos();
  return { x: +p[0].toFixed(2), y: +p[1].toFixed(2), z: +p[2].toFixed(2) };
});
/** hold a key for `ms` and report how far the feet actually moved */
const hold = async (key, ms) => {
  const a = await at();
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(120);
  const b = await at();
  return { a, b, d: Math.hypot(b.x - a.x, b.z - a.z) };
};

ok(kitWarns.length === 0, `no [interior:church] kit warnings: ${JSON.stringify(kitWarns)}`);

// ── 1. get in, on foot, through the [E] on the flight ─────────────────────
const spot = await page.evaluate(() => window.__ct.spots()
  .filter((q) => /ST BRIGID/i.test(q.label) && /into/i.test(q.label))
  .map((q) => ({ x: q.x, z: q.z, label: q.label }))[0]);
ok(!!spot, `the way in is offered: ${spot?.label}`);
await page.evaluate(([x, z]) => window.__ct.warp(x, z, -Math.PI / 2, window.__ct.groundAt(x, z), 0), [spot.x, spot.z]);
await page.waitForTimeout(400);
await page.keyboard.down('e');
await page.waitForTimeout(140);
await page.keyboard.up('e');
await page.waitForTimeout(900);
const inside = await at();
ok(inside.x > 400, `[E] put me inside — the room belt is out along +x (x=${inside.x})`);

// ── 2. THE OPENING IS WALKABLE, and wider than it was ─────────────────────
//
// Stand back from the door on its own centre line and sweep across it: at every
// offset inside the clear width the player must be able to walk INTO the
// doorway, and outside it the wall must stop them. That is the collision fact
// the wider opening changes, and it is why this walks rather than measures.
const dims = await page.evaluate(() => window.__ct.roomDims().find((d) => d.id === 'church'));
const doorX = dims.cx + dims.door.x, frontZ = dims.cz + dims.d / 2;
console.log(`church front wall z=${frontZ.toFixed(2)}, door x=${doorX.toFixed(2)}`);

// YAW pi, NOT 0. `fp.ts:477` — fwd = (sin yaw, 0, -cos yaw) — so yaw 0 walks
// toward -z, DOWN the nave. The first cut of this faced 0, walked away from the
// wall it was testing, and called the doorway blocked. Instrument, not world.
const CLEAR_HW = 2.75 / 2;                            // the declared clear half-width
const reach = async (off) => {
  await page.evaluate(([x, z]) => window.__ct.warp(x, z, Math.PI, window.__ct.groundAt(x, z), 0),
    [doorX + off, frontZ - 3.0]);
  await page.waitForTimeout(220);
  const r = await hold('w', 900);
  return frontZ - r.b.z;                              // metres short of the wall plane
};
const inGap = Math.max(await reach(0), await reach(0.9), await reach(-0.9));
const onJamb = Math.min(await reach(CLEAR_HW + 0.8), await reach(-(CLEAR_HW + 0.8)));
console.log(`closest approach: through the opening ${inGap.toFixed(2)} m short of the wall, `
  + `against the jamb ${onJamb.toFixed(2)} m short`);
ok(inGap < 0.35, `the opening is walkable — I get to within ${inGap.toFixed(2)} m of the wall plane in it`);
ok(onJamb > inGap + 0.25,
   `and the wall beside it still stops me ${(onJamb - inGap).toFixed(2)} m further out — `
   + 'the opening is an opening, not a hole in the collider');

// ── 3. NOT WEDGED. From the middle of the doorway, every direction moves. ──
await page.evaluate(([x, z]) => window.__ct.warp(x, z, 0, window.__ct.groundAt(x, z), 0),
  [doorX, frontZ - 0.9]);
await page.waitForTimeout(250);
for (const [key, name] of [['s', 'back into the nave'], ['a', 'left along the wall'], ['d', 'right along the wall']]) {
  const r = await hold(key, 600);
  ok(r.d > 0.5, `standing in the doorway I can still move ${name} (${r.d.toFixed(2)} m)`);
  await page.evaluate(([x, z]) => window.__ct.warp(x, z, 0, window.__ct.groundAt(x, z), 0),
    [doorX, frontZ - 0.9]);
  await page.waitForTimeout(200);
}

// ── 4. and OUT, through the way-out spot, onto the flight ─────────────────
const outSpot = await page.evaluate(() => window.__ct.spots()
  .filter((q) => /out to the street/i.test(q.label))
  .map((q) => ({ x: q.x, z: q.z }))
  .sort((a, b) => Math.abs(a.x - 760) - Math.abs(b.x - 760))[0]);
await page.evaluate(([x, z]) => window.__ct.warp(x, z, 0, window.__ct.groundAt(x, z), 0), [outSpot.x, outSpot.z]);
await page.waitForTimeout(400);
await page.keyboard.down('e');
await page.waitForTimeout(140);
await page.keyboard.up('e');
await page.waitForTimeout(900);
const out = await at();
ok(out.x < 100, `[E] put me back on the street (x=${out.x}, z=${out.z})`);
const walkOut = await hold('w', 700);
ok(walkOut.d > 0.4, `and I can walk away from the door (${walkOut.d.toFixed(2)} m)`);

ok(errs.length === 0, `no console or page errors: ${errs.slice(0, 3).join(' | ')}`);
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
