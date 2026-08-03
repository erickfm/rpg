// Item 185 — CAN YOU ACTUALLY WORK THE LOAN FORM WITH THE MOUSE?
//
// The user's ask is *"you sit and its the loan process as an integrated
// overlay"*, and the ATM's and the slots' versions of that were both signed off
// on REAL PAGE CLICKS LANDING ON THE MESH — not on a hit-test function called
// directly. That distinction is the whole value of this probe: calling `click()`
// proves my rectangles; clicking a page coordinate proves the raycast, the
// camera, the uv mapping and my rectangles together, which is the chain that
// actually breaks.
//
// HOW A CANVAS PIXEL BECOMES A PAGE PIXEL. `PlaneGeometry` maps u 0→1 across
// local -w/2→+w/2 and v 0→1 across -h/2→+h/2, and a canvas texture samples v
// flipped. So canvas (cx, cy) is local ((cx/W - 0.5) * w, (0.5 - cy/H) * h, 0).
// Every number in that comes from the MESH's own geometry, not from a layout
// retyped here (BUILDER-BRIEF §8).
//
// `__ct` publishes `scene` and `camera` but not three itself, so the two 4×4
// multiplies are done by hand rather than by loading a second copy of the
// library into the page.
//
// ⚠ AND IT WAITS FOR THE CAMERA TO STOP MOVING. w55 lost an hour to exactly
// this: the projection is computed through the camera as it is, the click lands
// ~100 ms later through a camera that has eased on, and the press misses. Its
// earlier "passing" runs were passing by luck of timing (GOTCHAS 30).
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4220/');
const OUT = process.argv[2] ?? '/tmp/w66-mouse';
const SHEET_W = 300, SHEET_H = 400;          // the panel's own canvas, item 185
const AMOUNTS = [200, 500, 1000, 2500, 5000];
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`OK    ${m}`); } else { fail++; console.log(`FAIL  ${m}`); } };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await p.waitForTimeout(1500);

const spot = await p.evaluate(() => (window.__ct.spots() || [])
  .map((s) => ({ label: String(s.label), x: s.x, z: s.z }))
  .find((s) => /read the loan application/.test(s.label)));
if (!spot) { console.error('ABORT: no loan-application spot — nothing to measure'); await b.close(); process.exit(3); }

// the tick boxes, from the same three numbers `int-bank.ts` derives them from
const boxW = (SHEET_W - 20 - 4 * 4) / 5;
const boxCentre = (i) => ({ x: 10 + i * (boxW + 4) + boxW / 2, y: 88 + 15 });

const openIt = async () => {
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [spot.x, spot.z]);
  await p.waitForTimeout(500);
  await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
  await p.waitForFunction(() => {
    const c = window.__ct.camera?.(); if (!c) return false;
    const k = `${c.position.x.toFixed(4)},${c.position.y.toFixed(4)},${c.fov.toFixed(3)}`;
    const same = window.__w66 === k; window.__w66 = k; return same;
  }, { timeout: 8000, polling: 120 });
};

const pageAt = (cx, cy) => p.evaluate(([cx, cy, W, H]) => {
  const cam = window.__ct.camera();
  const s = window.__ct.scene(); s.updateMatrixWorld(true); cam.updateMatrixWorld(true);
  let mesh = null;
  s.traverse((o) => {
    if (mesh || !o.isMesh) return;
    const pr = o.geometry?.parameters;
    // `typeof`, NOT a bare subtraction. `Math.abs(undefined - 0.30) > 1e-6` is
    // `NaN > 1e-6`, which is FALSE — so every geometry without a `width` sailed
    // through the filter and the first one of them was adopted as the sheet.
    // The probe then reported "could not project" six times about a mesh it had
    // found and thrown away. Half an hour, and the world was never wrong.
    if (!pr || typeof pr.width !== 'number' || typeof pr.height !== 'number') return;
    if (Math.abs(pr.width - 0.30) > 1e-6 || Math.abs(pr.height - 0.40) > 1e-6) return;
    if (o.matrixWorld.elements[12] < 400) return;   // flat 301 has one too
    mesh = o;
  });
  if (!mesh) return null;
  const mul = (e, v) => [
    e[0] * v[0] + e[4] * v[1] + e[8] * v[2] + e[12] * v[3],
    e[1] * v[0] + e[5] * v[1] + e[9] * v[2] + e[13] * v[3],
    e[2] * v[0] + e[6] * v[1] + e[10] * v[2] + e[14] * v[3],
    e[3] * v[0] + e[7] * v[1] + e[11] * v[2] + e[15] * v[3],
  ];
  const pr = mesh.geometry.parameters;
  let v = [(cx / W - 0.5) * pr.width, (0.5 - cy / H) * pr.height, 0, 1];
  v = mul(mesh.matrixWorld.elements, v);
  v = mul(cam.matrixWorldInverse.elements, v);
  v = mul(cam.projectionMatrix.elements, v);
  if (!v[3]) return null;
  const gl = [...document.querySelectorAll('canvas')]
    .filter((c) => !c.closest('#ct-loan'))
    .sort((a, c) => c.clientWidth * c.clientHeight - a.clientWidth * a.clientHeight)[0];
  const r = gl ? gl.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
  return { x: r.left + ((v[0] / v[3]) * 0.5 + 0.5) * r.width,
           y: r.top + (-(v[1] / v[3]) * 0.5 + 0.5) * r.height };
}, [cx, cy, SHEET_W, SHEET_H]);

/** THE SHEET IS ITS OWN WITNESS. The panel's canvas is what gets hung on the
 *  mesh, so reading it back is reading exactly what the player is looking at —
 *  no second copy of the layout, and no new export in a desk-owned file. */
const pixel = (cx, cy) => p.evaluate(([cx, cy]) => {
  const c = document.querySelector('#ct-loan canvas');
  if (!c) return null;
  const d = c.getContext('2d', { willReadFrequently: true })
    .getImageData(Math.round(cx), Math.round(cy), 1, 1).data;
  return [d[0], d[1], d[2]];
}, [cx, cy]);
/** a ticked box is filled with the letterhead navy #1f3a5a; paper is near-white */
const isTicked = async (i) => {
  const c = boxCentre(i);
  const px = await pixel(c.x, c.y - 10);
  return !!px && px[0] < 60 && px[2] > 70;
};

await openIt();
await p.screenshot({ path: `${OUT}-1-open.png` });
ok(await p.evaluate(() => !!document.querySelector('#ct-loan')), 'the sheet is up');
ok(await p.evaluate(() => {
  const c = document.querySelector('#ct-loan canvas');
  return !!c && getComputedStyle(c).display === 'none';
}), 'it is DIEGETIC — its own canvas is hidden, so what you see is the mesh');
ok(await isTicked(0), 'it opens with $200 ticked');

for (const i of [2, 4, 0]) {
  const c = boxCentre(i);
  const pt = await pageAt(c.x, c.y);
  if (!pt) { ok(false, `could not project tick box ${i}`); continue; }
  await p.mouse.move(pt.x, pt.y);
  await p.waitForTimeout(80);
  await p.mouse.click(pt.x, pt.y);
  await p.waitForTimeout(180);
  ok(await isTicked(i), `a real page click on the MESH ticked $${AMOUNTS[i]}`);
  const others = await Promise.all([0, 1, 2, 3, 4].filter((j) => j !== i).map(isTicked));
  ok(others.every((t) => !t), '   …and it is the only one ticked');
}
await p.screenshot({ path: `${OUT}-2-ticked.png` });

// ── SIGN. Back at $200 the security is $10 against $14.50, so it is approved ──
const sign = await pageAt(SHEET_W / 2, 262 + 19);
ok(!!sign, 'the SIGN box projects onto the page');
if (sign) {
  await p.mouse.move(sign.x, sign.y);
  await p.waitForTimeout(80);
  await p.mouse.click(sign.x, sign.y);
  await p.waitForTimeout(220);
}
await p.screenshot({ path: `${OUT}-3-signed.png` });
// APPROVED is stamped GREEN (47,106,58); DECLINED is red. Sampling the box's
// own stroke rather than a glyph, so a letter falling between samples cannot
// read as no stamp at all.
const px = await pixel(SHEET_W / 2, 180 - 24);
ok(!!px && px[1] > px[0] + 8 && px[1] > px[2] + 8,
  `clicking SIGN stamped the sheet GREEN — approved (rgb ${px})`);
ok(await p.evaluate(() => !!document.querySelector('#ct-loan')),
  'and the sheet stays up, so you read the answer on the paper you signed');

// ── both ways out, which is the worst bug this project ships (BRIEF §11) ─────
await p.keyboard.press('Escape');
await p.waitForTimeout(400);
ok(!(await p.evaluate(() => !!window.__ct.seated())), 'ESCAPE stands you back up');
// A REAL HELD KEY, not a synthesised KeyboardEvent. The rig reads `isTrusted`
// input through the same gate `ct/hud.ts` installs, and a dispatched event is
// not the thing that gate is deciding about — so a synthetic press proves
// nothing about whether the player got their feet back.
//
// AND IT TRIES ALL FOUR, WHICH IS NOT BELT AND BRACES. You stand up from this
// panel FACING THE DESK — the pose was derived looking straight down at a form
// lying on it — so `W` alone walks into the desk's collider and reads 0.00 m on
// a player who is perfectly free to move. w55 hit the identical thing on the
// slot stools and its note is explicit that the believable-looking number is
// worse than the zero. The claim is "the player got their feet back", so the
// measurement is "can they move AT ALL".
const before = await p.evaluate(() => window.__ct.pos());
let moved = 0;
for (const k of ['w', 's', 'a', 'd']) {
  await p.keyboard.down(k); await p.waitForTimeout(450); await p.keyboard.up(k);
  const at = await p.evaluate(() => window.__ct.pos());
  moved = Math.max(moved, Math.hypot(at[0] - before[0], at[2] - before[2]));
  if (moved > 0.15) break;
}
ok(moved > 0.15, `and the FEET actually move afterwards (${moved.toFixed(2)} m)`);
await p.screenshot({ path: `${OUT}-4-after-escape.png` });

// …and `[E]` must close it too — item 143, and the hint says it does
await openIt();
await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
await p.waitForTimeout(400);
ok(!(await p.evaluate(() => !!window.__ct.seated())), '[E] also gets you out of it');

console.log(`\nconsole errors: ${errs.length}`);
for (const e of errs.slice(0, 6)) console.log('   ', e);
console.log(`\n${pass} passed, ${fail} failed   ·   shots at ${OUT}-*.png`);
await b.close();
process.exit(fail ? 1 : 0);
