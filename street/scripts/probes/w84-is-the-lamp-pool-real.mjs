// IS THE LAMP POOL ACTUALLY ON THE GROUND, OR HAS IT STOPPED WORKING?
//
// One-shot, item 229. `scripts/glow.mjs` is RED on this tree with no mutation
// applied — "main street: under a lamp 0.0450 vs mid-block 0.0450 — 1.0x",
// identical across five runs. That red is either a broken feature the user
// would see, or a check reading the wrong surface. The two want opposite rows.
//
// glow.mjs samples `material.color` from JS. `544053b20` moved the pool's warm
// term and gain into POOL_FRAG, so `material.color` is now `base * amb` and
// `amb` is per-FLOOR, not per-lamp — near and far on one floor are equal BY
// CONSTRUCTION, and 1.0x is the only answer that sampling can give.
//
// So ask the renderer instead: read the PIXELS under a lamp and mid-block, at
// the same hour, from the same height. That is where a fragment shader's work
// shows up and where the player's eye is.
//
//   SHOT_URL=http://localhost:4400/ node scripts/probes/w84-is-the-lamp-pool-real.mjs
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const URL = process.env.SHOT_URL || 'http://localhost:4400/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 640, height: 480 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

// WHERE THE LAMPS ACTUALLY ARE — asked, never typed. glow.mjs pairs 21 heads;
// this reads the same stamps so the two cannot drift apart.
const lamps = await p.evaluate(() => {
  const S = window.__ct.scene(); S.updateMatrixWorld(true);
  const out = [];
  S.traverse((o) => {
    if (o.isMesh && (o.userData.lampPart === 'lens' || o.userData.parkLantern)) {
      const e = o.matrixWorld.elements; out.push([+e[12].toFixed(2), +e[14].toFixed(2)]);
    }
  });
  return out;
});
// main street only, matching glow.mjs's own window
const main = lamps.filter(([x, z]) => Math.abs(x) <= 9 && z <= 2 && z >= -96);
console.log(`\n${lamps.length} lamps stamped, ${main.length} on the main street`);
if (main.length < 4) { console.error('FAIL too few main-street lamps to ask'); await b.close(); process.exit(3); }

/** Stand at (x,z) looking straight DOWN at the pavement and average the frame.
 *  Pitch is the point: a horizon shot is mostly sky and facades, and the
 *  question is about the GROUND. */
async function groundAt(x, z, label) {
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, undefined, -1.35), [x, z]);
  // AFTERFRAMES IS NOT PAINTED (GOTCHAS 80) — wait on the renderer, and WAIT on
  // it rather than calling and discarding, which is how a probe yesterday shot
  // a 100% black frame and believed it.
  await p.evaluate(() => window.__ct.painted && window.__ct.painted());
  await p.waitForTimeout(500);
  const buf = await p.screenshot();
  // LOOK AT IT. A luminance number with no picture behind it is how a probe
  // reports confidently on a black frame.
  writeFileSync(`shots/w84-pool-${label.replace(/[^a-z]+/gi, '-')}-${HOUR}.png`, buf);
  // mean luminance of the frame, decoded from the PNG by the browser itself
  const lum = await p.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    return s / (d.length / 4) / 255;
  }, buf.toString('base64'));
  console.log(`  ${label.padEnd(22)} (${String(x).padStart(6)},${String(z).padStart(7)})  mean luminance ${lum.toFixed(4)}`);
  return lum;
}

let HOUR = 0;
for (const hour of [13, 23]) {
  HOUR = hour;
  await p.evaluate((h) => window.__ct.clock(h, 0), hour);
  await p.waitForTimeout(700);
  console.log(`\n── ${String(hour).padStart(2, '0')}:00 ─────────────────────────────`);
  // UNDER a lamp, and the SAME z 6 m along the pavement — same slab, same
  // materials, same facing. The only variable is distance to the lamp.
  const [lx, lz] = main[Math.floor(main.length / 2)];
  const under = await groundAt(lx, lz, 'under a lamp');
  const away = await groundAt(lx, lz + 6.0, 'mid-block, 6 m along');
  const ratio = away > 1e-6 ? under / away : Infinity;
  console.log(`  ratio under/mid-block: ${ratio.toFixed(2)}x`);
  // At 13:00 there is no night term at all, so the pool MUST be absent — that
  // is the negative control, and without it a bright patch under a lamp could
  // be anything (a decal, a lighter paving slab, the lamp base itself).
  console.log(`  ${hour === 13 ? 'control (day): expect ~1.0x' : 'night: a working pool is > 1.0x'}`);
}

await b.close();
