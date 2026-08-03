// Item 145 — "church could be darker." HOW dark is it, and how dark are its peers?
//
// The world is UNLIT: `light:` in a RoomSpec builds a fixture and an additive
// halo decal, nothing more (ct/interior.ts:1425 — "the room is lit by its flat
// materials"). So interior brightness IS the palette, and the only honest way to
// compare rooms is to stand in them and read pixels.
//
// TWO NUMBERS, because the item sets two conditions at once: *"church could be
// darker"* and *"do not let it go so dark the geometry stops reading."*
//
//   lum   mean luminance over the crop — how dark the room IS.
//   sd    standard deviation of luminance over the same pixels — whether there
//         is still STRUCTURE in it. A room dimmed by pulling every surface
//         toward the same dark value loses sd; a room dimmed with its contrast
//         intact keeps it. Darkening that costs sd is the failure mode the item
//         names, and mean alone cannot see it.
//
// The crop excludes the bottom of the frame: the player's WRISTWATCH is a
// bright, constant HUD patch there and it is not the room. Same reasoning as
// scripts/glow.mjs's crop, which found the same thing by looking at frames.
//
// Usage: SHOT_URL=http://localhost:4510/ node scripts/probes/w95-interior-tone.mjs [id ...]
import { chromium } from 'playwright';
import { waitPainted } from '../lib/painted.mjs';

const WANT = process.argv.slice(2).length ? process.argv.slice(2)
  : ['church', 'pawn', 'casino', 'hotel', 'library', 'diner', 'bank', 'thrift'];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 880, height: 750 } });
await page.goto(process.env.SHOT_URL || 'http://localhost:4510/');
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await page.waitForTimeout(600);

const DIMS = await page.evaluate(() => window.__ct.roomDims());

// Read the crop's mean and standard deviation in ONE pass over the pixels, so
// both numbers describe exactly the same sample.
const readFrame = async (tag) => {
  const buf = await page.screenshot(tag ? { path: `shots/tone-${tag}.png` } : {});
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const x0 = Math.floor(c.width * 0.05), y0 = 0;
    const w = Math.floor(c.width * 0.90), h = Math.floor(c.height * 0.60);
    const d = g.getImageData(x0, y0, w, h).data;
    let s = 0, s2 = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const L = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      s += L; s2 += L * L; n++;
    }
    const mean = s / n;
    return { lum: mean, sd: Math.sqrt(Math.max(0, s2 / n - mean * mean)) };
  }, buf.toString('base64'));
};

// STAND IN FOUR PLACES AND LOOK FOUR WAYS, and average. One frame is one wall:
// a single station facing the altar reports the altar, not the room. The
// stations are fractions of the room's own w/d so they mean the same thing in a
// 13x24 church and a 7 m diner.
const STATIONS = [[0, -0.25], [0, 0.25], [-0.28, 0], [0.28, 0]];
const YAWS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

console.log('\n  room        lum      sd     (mean of 16 frames: 4 stations x 4 yaws)');
const rows = [];
for (const id of WANT) {
  const R = DIMS.find((r) => r.id === id);
  if (!R) { console.log(`  ${id.padEnd(10)} — no such room in __ct.roomDims()`); continue; }
  let lum = 0, sd = 0, n = 0;
  for (const [fx, fz] of STATIONS)
    for (const yaw of YAWS) {
      const x = R.cx + fx * R.w, z = R.cz + fz * R.d;
      await page.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, undefined, 0), [x, z, yaw]);
      // GOTCHAS 78/80, AND THIS PROBE WAS CAUGHT BY IT. It used
      // waitForTimeout(220), which is not a painted frame — a sibling probe on
      // the same warp wrote a SOLID WHITE nave. An unpainted frame reads
      // luminance ~1.0, so every one that slipped through pulled these means
      // UP, i.e. it made rooms look BRIGHTER than they are. The whole point of
      // this probe is a brightness comparison, so that is fatal, not cosmetic.
      await waitPainted(page, { quiet: true });
      const keep = (n === 0 && WANT.length <= 2) ? `${id}-0` : null;
      const r = await readFrame(keep);
      // A frame that is essentially pure white is the void, not a room. Refuse
      // it loudly rather than averaging it in — measuring nothing is not a
      // measurement, and a silent skip would leave the mean quietly wrong.
      if (r.lum > 0.97 && r.sd < 0.02)
        throw new Error(`${id}: unpainted/void frame at station ${n} (lum ${r.lum.toFixed(4)},`
          + ` sd ${r.sd.toFixed(4)}) — waitPainted returned but nothing was drawn`);
      lum += r.lum; sd += r.sd; n++;
    }
  rows.push({ id, lum: lum / n, sd: sd / n });
  console.log(`  ${id.padEnd(10)} ${(lum / n).toFixed(4)}  ${(sd / n).toFixed(4)}`);
}

rows.sort((a, b) => a.lum - b.lum);
console.log('\n  darkest -> brightest: ' + rows.map((r) => `${r.id} ${r.lum.toFixed(3)}`).join(' | '));
await browser.close();
