// w35 — ITEM 66, row L195: "whats up with this kids face? its multi color?"
//
// `scripts/faces.mjs` is NOT evidence here and the row says so itself: it samples
// the cheek row of the FRONT view and passed all six BEFORE and after the fault.
// The fault was hair drawn OUTSIDE the head it grows out of, so this looks at
// the head.
//
// AND IT NAMES p1, which the auditor recorded it could not do. Its reason was
// that all six walker MESHES share a 1.9 m geometry height — true, but the
// per-person scale is published on `people()` as `hs`, and the row's "kid" is
// the hs 0.91 walker. So the citizen photographed here is the one the row is
// about, not merely one that has the knot feature.
//
//   SHOT_URL=http://localhost:4191/ node scripts/probes/w35-kid-face.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const b = await chromium.launch();
// the recipe the world's own bugsweep uses. A 900x600 page shot immediately
// after warping produced a BLACK frame twice — the capture, not the world.
const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await p.goto(aim('http://localhost:4191/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(700);
mkdirSync('shots/w35', { recursive: true });

const kid = await p.evaluate(() => {
  const info = window.__ct.people(), walk = window.__ct.walkers();
  let bi = -1, bh = 9;
  info.forEach((q, i) => { if (q.hs < bh) { bh = q.hs; bi = i; } });
  return { i: bi, hs: bh, all: info.map((q) => q.hs), at: walk[bi] ? [walk[bi].x, walk[bi].z] : null };
});
console.log('people hs:', JSON.stringify(kid.all));
console.log(`the "kid" is index ${kid.i}, hs ${kid.hs}, at ${JSON.stringify(kid.at)}`);

// stand close and look at the head from each side, so a knot that floats beside
// the skull on ONE view cannot hide behind a lucky angle
const views = [['front', 0], ['left', -0.9], ['right', 0.9], ['behind', Math.PI]];
for (const [name, off] of views) {
  await p.evaluate(([i, off]) => {
    const w = window.__ct.walkers()[i];
    window.__ct.clock(13, 0);
    const d = 0.85, a = off;
    window.__ct.warp(w.x + Math.sin(a + Math.PI / 2) * d, w.z + Math.cos(a + Math.PI / 2) * d, a - Math.PI / 2, 0, 0.25);
  }, [kid.i, off]);
  await p.waitForTimeout(500);
  await p.screenshot({ path: `shots/w35/kid-${name}.png` });
  console.log(`  shots/w35/kid-${name}.png`);
}
await b.close();
