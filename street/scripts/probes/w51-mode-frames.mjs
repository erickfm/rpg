// ITEM 132 — one frame per mode of the bulb program, from the user's own
// station.
//
// ── why this freezes the clock instead of waiting for a mode ───────────
//
// The first version polled the live world and screenshotted the moment the
// wanted mode appeared. It produced two frames with the labels SWAPPED, and the
// reason is worth keeping: `waitForFunction` returns synchronously on the frame
// the condition holds, but `page.screenshot()` lands 50–200 ms later, and a
// `flash` half-beat is 200 ms. The trigger was state-based; the CAPTURE was
// not, so the sign had already flipped by the time the shutter opened. Same
// family as the fixed wall-clock wait, wearing a different hat.
//
// The program is a pure function of `performance.now()`, so stubbing that to a
// constant freezes the sign at a CHOSEN phase and the shutter can take as long
// as it likes. Each frame then re-reads the socket pattern AFTER the shot and
// asserts it still matches — with time frozen it must, and if it does not the
// frame is not filed.
//
// Usage: SHOT_URL=http://localhost:4183/ node scripts/probes/w51-mode-frames.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4183/';
mkdirSync('shots/w51', { recursive: true });
const ST = { x: 53.6, z: -103.2, yaw: Math.PI, pitch: 0.62 };

// PROGRAM in ct/vice.ts: chase 3.6 | alt 1.6 | chase 2.4 | flash 1.6 | back 3.2 | on 0.8
// Copied, not derived — the table is a module-local const with no export, and
// BUILDER-BRIEF §8 says say so. If the program is retuned these move.
// (ct/vice.ts, the `PROGRAM` const in `placeSigns`.)
const AT = [
  ['comet', 1.5, 'a two-socket comet part-way along the run'],
  ['alt', 4.0, 'odd and even sockets traded'],
  ['flash-on', 7.7, 'every socket in the world lit together'],
  ['flash-off', 7.9, 'and the same instant of the blink, dark'],
  ['back', 10.5, 'the comet running the other way'],
  ['hold-on', 12.8, 'the held all-lit beat that ends the loop'],
];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1160, height: 819 } });
p.on('console', (m) => { if (m.type() === 'error') console.log('  console error:', m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.evaluate((h) => window.__ct.clock(h, 10), 23);
await p.waitForTimeout(1500);
await p.evaluate((q) => window.__ct.warp(q.x, q.z, q.yaw, undefined, q.pitch), ST);
await p.waitForTimeout(700);
const [gx, , gz] = await p.evaluate(() => window.__ct.pos());
if (Math.hypot(gx - ST.x, gz - ST.z) > 0.05) {
  console.log('warp landed off station — refusing to file'); await b.close(); process.exit(1);
}

// pin the longest physical run of sockets, and a reader for its lit pattern
await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const bulbs = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry || o.geometry.type !== 'SphereGeometry') return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || m.fog !== false) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (bb.max.x - bb.min.x > 0.4) return;
    bulbs.push({ x: (bb.min.x + bb.max.x) / 2, y: (bb.min.y + bb.max.y) / 2,
      z: (bb.min.z + bb.max.z) / 2, m });
  });
  const runs = new Map();
  for (const bl of bulbs) {
    const k = `${Math.round(bl.y * 20)}|${Math.round(bl.z * 20)}`;
    if (!runs.has(k)) runs.set(k, []);
    runs.get(k).push(bl);
  }
  const run = [...runs.values()].sort((a, c) => c.length - a.length)[0].sort((a, c) => a.x - c.x);
  window.__w51pat = () => run.map((bl) => (bl.m.color.getHexString() === 'fff2c0' ? '#' : '.')).join('');
  // freeze the program's clock. It is a pure function of performance.now(), so
  // a constant here holds the whole installation on one beat.
  const real = performance.now.bind(performance);
  window.__w51freeze = (sec) => { performance.now = () => sec * 1000; };
  window.__w51thaw = () => { performance.now = real; };
});

for (const [name, t, why] of AT) {
  await p.evaluate((sec) => window.__w51freeze(sec), t);
  await p.waitForTimeout(250);                       // let a few frames render the frozen beat
  const before = await p.evaluate(() => window.__w51pat());
  await p.screenshot({ path: `shots/w51/mode-${name}.png` });
  const after = await p.evaluate(() => window.__w51pat());
  if (before !== after) {
    console.log(`  ** ${name}: pattern moved during the shot (${before} -> ${after}) — NOT filing`);
    continue;
  }
  console.log(`shots/w51/mode-${name}.png   t=${t}s  ${before}`);
  console.log(`      ${why}`);
}
await p.evaluate(() => window.__w51thaw());
await b.close();
