// ITEM 156 — FIND THE LIGHTING EDGE BY DIVIDING TEXTURE OUT.
//
// The user: *"whats going on here with the light reflecting against the
// invisible wall?"* — a wedge of lamplight with a HARD EDGE where it stops.
//
// EYEBALLING NIGHT FRAMES CANNOT SETTLE THIS, and I proved it on myself: the
// church's west face has a crisp vertical boundary at night that turned out to
// be a BUTTRESS, and it was my prime suspect until I brightened it. A night
// frame is texture x lighting, and every masonry course, sign edge and window
// reveal is an edge. The eye cannot tell which edges are the light.
//
// SO DIVIDE. The pool is a MULTIPLY on the graded base colour (POOL_FRAG:
// `diffuseColor.rgb *= ...`), so for one fixed camera:
//
//     night_px / day_px  =  the lighting factor at that pixel, texture cancelled
//
// A texture edge is in BOTH frames and divides out. A LIGHTING edge survives.
// That is the whole instrument, and it is the only way to separate the two
// without re-implementing the shader in the harness — which brief §8 forbids and
// which would agree with the source while disagreeing with the world.
//
// Both frames come from ONE page load at ONE camera, changing only `clock()`.
// Two loads would re-roll the seeded dither (GOTCHAS 2/75) and every texel would
// differ; a moved camera would misregister the division outright.
//
// PIXELS ARE READ IN THE PAGE, off the live canvas, because this repo has no PNG
// decoder and adding one to read back what the GPU just drew would be the long
// way round.
//
// WHAT COUNTS AS THE DEFECT. Not "a bright pixel" — the factor is legitimately
// high under a lamp and low mid-block. The defect is a *spatial discontinuity*:
// two ADJACENT columns whose lighting factor jumps. A real pool falls off
// smoothly over metres, so a jump is a material boundary, not a light.
//
// SELF-TEST (`--selftest`): day/day must divide flat, jump ~0, everywhere. If
// that leg reports edges the division is misregistering and nothing else it says
// is worth reading.
//
//   SHOT_URL=http://localhost:4430/ node scripts/probes/w87-item156-lightedge.mjs
//   SHOT_URL=http://localhost:4430/ node scripts/probes/w87-item156-lightedge.mjs --selftest
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { waitPainted } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL || 'http://localhost:4430/';
const SELFTEST = process.argv.includes('--selftest');
mkdirSync('shots', { recursive: true });
const W = 1000, H = 640;
// Only the upper frame is facade; the lower third is roadway and pavement where
// a pool SHOULD have a soft edge and where cars and people legitimately occlude.
const FACADE_H = 430;
const JUMP = 0.28;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: W, height: H } });
const errors = [];
p.on('pageerror', (e) => errors.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await waitPainted(p);

/** Column-mean luminance over the facade band, read off the live canvas. */
const columns = () => p.evaluate(([w, h, fh]) => {
  const c = document.querySelector('canvas');
  const g = document.createElement('canvas'); g.width = w; g.height = h;
  const cx = g.getContext('2d', { willReadFrequently: true });
  cx.drawImage(c, 0, 0, w, h);
  const d = cx.getImageData(0, 0, w, fh).data;
  const out = new Array(w).fill(0);
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = 0; y < fh; y++) {
      const i = ((y * w) + x) << 2;
      s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    }
    out[x] = s / fh;
  }
  return out;
}, [W, H, FACADE_H]);

const STATIONS = [];
for (const z of [4, -8, -20, -30, -40, -50, -60, -72]) {
  STATIONS.push([`z${String(z).replace('-', 'm')}-w`, 2.0, z, -Math.PI / 2]);
  STATIONS.push([`z${String(z).replace('-', 'm')}-e`, -2.0, z, Math.PI / 2]);
}

/** biggest adjacent-column jump of b/a, and where */
const edge = (a, bb) => {
  const r = a.map((d, i) => (d < 14 ? NaN : bb[i] / d));
  let mx = 0, at = -1;
  for (let i = 1; i < W; i++) {
    if (!Number.isFinite(r[i]) || !Number.isFinite(r[i - 1])) continue;
    const j = Math.abs(r[i] - r[i - 1]);
    if (j > mx) { mx = j; at = i; }
  }
  const fin = r.filter(Number.isFinite);
  return { mx, at, mean: fin.reduce((s, c) => s + c, 0) / (fin.length || 1) };
};

// EVERY STATION CARRIES ITS OWN CONTROL. The first self-test refused this
// instrument outright: day/day was not flat, jumping up to 0.121, because the
// world is LIVE — citizens walk, cars roll and pigeons cross between two
// captures 400 ms apart, and every one of them changes a column. The mean
// factor was exactly 1.000, so the division itself registers; what was missing
// was a noise floor. So each station now shoots DAY, NIGHT, DAY AGAIN: the
// second day frame against the first is that station's own noise, measured at
// the same camera, seconds apart, with the same traffic. A night edge is only
// believable when it stands clear of it.
const worst = [];
for (const [tag, x, z, yaw] of STATIONS) {
  await p.evaluate(([X, Z, Y]) => window.__ct.warp(X, Z, Y, 0, 0.08), [x, z, yaw]);
  await p.waitForTimeout(200);
  await p.evaluate(() => window.__ct.clock(13, 0));
  await p.waitForTimeout(400); await waitPainted(p);
  const day = await columns();
  await p.evaluate((st) => window.__ct.clock(st ? 13 : 23, 0), SELFTEST);
  await p.waitForTimeout(400); await waitPainted(p);
  const night = await columns();
  await p.evaluate(() => window.__ct.clock(13, 0));
  await p.waitForTimeout(400); await waitPainted(p);
  const day2 = await columns();

  const sig = edge(day, night), noise = edge(day, day2);
  const ratio = sig.mx / Math.max(noise.mx, 1e-3);
  const hard = sig.mx > JUMP && ratio > 2.5;
  console.log(`  ${tag.padEnd(9)} factor ${sig.mean.toFixed(3)}  edge ${sig.mx.toFixed(3)} at x=${String(sig.at).padStart(3)}`
    + `  | noise ${noise.mx.toFixed(3)}  S/N ${ratio.toFixed(1)}${hard ? '   <== HARD EDGE' : ''}`);
  worst.push({ tag, mx: sig.mx, mxAt: sig.at, noise: noise.mx, ratio, x, z, yaw, hard });
}

worst.sort((a, c) => c.mx - a.mx);
console.log('');
if (SELFTEST) {
  // THE NULL CASE: with SELFTEST the "night" leg is shot at 13:00 too, so the
  // signal is day/day and must be indistinguishable from the noise leg. If any
  // station reports S/N above 2.5 on identical lighting, the instrument is
  // inventing edges and every number it prints about the night is worthless.
  const bad = worst.filter((w) => w.hard);
  const mxSN = Math.max(...worst.map((w) => w.ratio));
  console.log(bad.length === 0
    ? `SELFTEST GREEN — with lighting held identical, no station clears the bar (worst S/N ${mxSN.toFixed(1)}, max edge ${Math.max(...worst.map((w) => w.mx)).toFixed(3)})`
    : `SELFTEST FAILED — identical lighting produced ${bad.length} "HARD EDGE"; the instrument invents them`);
  console.log(`console errors: ${errors.length}`);
  await b.close(); process.exit(bad.length === 0 ? 0 : 1);
}
console.log('worst three by lighting discontinuity:');
for (const w of worst.slice(0, 3)) {
  console.log(`  ${w.tag}  jump ${w.mx.toFixed(3)} at column ${w.mxAt}   (stand x ${w.x} z ${w.z} yaw ${w.yaw.toFixed(3)})`);
}
console.log(`console errors: ${errors.length}`);
await b.close();
