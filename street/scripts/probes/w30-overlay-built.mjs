// Item 65 on the BUILT BUNDLE. The other probe re-computes trapAgainst from
// ct/gap.ts by source path, which does not exist in a built bundle — so this one
// verifies the thing that actually ships: press V and read the COLOUR of every
// wireframe the overlay drew.
//
//   green  0x39ff6a  static geometry, fine
//   red    0xff3b3b  a static corridor under 0.95 m
//   amber  0xffb020  a moving actor — never scored
//
// Reading the rendered material is a stronger check than re-deriving the rule:
// it cannot pass while the overlay draws something else, which is exactly how a
// re-implementation would fail.
//
// Usage: SHOT_URL=http://localhost:4191/ node scripts/probes/w30-overlay-built.mjs
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4191/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

let bad = 0;
const fail = (m) => { bad++; console.log(`FAIL  ${m}`); };
const pass = (m) => console.log(`ok    ${m}`);

// FOCUS THE CANVAS FIRST. Without this the first V is swallowed and the second
// one turns the overlay ON — which reads as "V drew nothing" followed by "V left
// 519 wireframes behind", i.e. the probe reporting a broken overlay that works
// perfectly. Cost one run to find, and it is the same shape as every other
// instrument fault in this project: the tool, not the world.
await p.mouse.click(450, 300);
await p.waitForTimeout(400);

const before = await p.evaluate(() => {
  let n = 0;
  window.__ct.scene().traverse((o) => { if (o.isLineSegments) n++; });
  return n;
});

// V is the overlay. A HELD keypress: the toggle is an edge read once per
// rendered frame, so a tap that begins and ends inside one frame is never seen.
await p.keyboard.down('v'); await p.waitForTimeout(90); await p.keyboard.up('v');
await p.waitForTimeout(600);

const seen = await p.evaluate(() => {
  const tally = {};
  let n = 0;
  window.__ct.scene().traverse((o) => {
    if (!o.isLineSegments || !o.material || !o.material.color) return;
    n++;
    const hex = '0x' + o.material.color.getHexString();
    tally[hex] = (tally[hex] ?? 0) + 1;
  });
  return { tally, n, actors: window.__ct.actorColliders().length,
    colliders: window.__ct.colliders().length };
});

console.log(`line segments before V: ${before}, after V: ${seen.n}`);
console.log(`colliders ${seen.colliders}, actor colliders ${seen.actors}`);
console.log('wireframe colours drawn:', JSON.stringify(seen.tally));

if (seen.n > before) pass(`V drew the overlay (${seen.n - before} new wireframes)`);
else fail('V drew nothing — the overlay did not come up on the built bundle');

const amber = seen.tally['0xffb020'] ?? 0;
const red = seen.tally['0xff3b3b'] ?? 0;
const green = seen.tally['0x39ff6a'] ?? 0;

// Every actor must be drawn, and drawn amber — not hidden, not red.
if (amber === seen.actors) pass(`all ${seen.actors} moving actors drawn amber, none scored as a trap`);
else fail(`${amber} amber wireframes for ${seen.actors} actor colliders — they must match`);
if (red > 0) pass(`red still exists for static geometry (${red} boxes) — the fix did not silence it`);
else fail('NO red at all — the fix silenced real traps too, which is worse than the bug');
console.log(`  (green ${green}, red ${red}, amber ${amber})`);

// close it again — a panel/overlay you cannot turn off is its own bug
await p.keyboard.down('v'); await p.waitForTimeout(90); await p.keyboard.up('v');
await p.waitForTimeout(400);
const after = await p.evaluate(() => {
  let n = 0;
  window.__ct.scene().traverse((o) => { if (o.isLineSegments) n++; });
  return n;
});
if (after === before) pass('V turns the overlay fully off again');
else fail(`V left ${after - before} wireframes behind after being switched off`);

console.log(`console errors: ${errs.length}${errs.length ? ' — ' + errs.slice(0, 3).join(' | ') : ''}`);
if (errs.length) fail('console errors on the built bundle');
console.log(bad ? `\n${bad} FAIL` : '\nALL PASS');
await b.close();
process.exit(bad ? 1 : 0);
