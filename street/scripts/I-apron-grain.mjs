// DOES THE APRON READ AS A MATERIAL FROM WHERE YOU STAND?
//
// B's diagnosis, and the metric that goes with it: *"a flat colour is not a
// material. an untextured quad has no grain for the eye to attach to and no
// joints to give it scale"* — measured as EDGE DENSITY, which A's
// `A-slabtex-proof.mjs` puts at zero for a flat quad and 9–17% for a real one.
//
// A-slabtex-proof measures the TEXTURE CANVAS. That answers "is this painter
// producing grain", which is the right question for a painter and the wrong one
// here: the user's complaint is about *"a large flat untextured grey plane"*
// seen from inside the lot, and a surface can carry 32 texels per metre and
// still present no grain at all if you are looking along it at a grazing angle.
// Texture density and apparent grain are different quantities and this is the
// one the complaint is about.
//
// So this measures the RENDERED FRAME, from the viewpoint the fault was filed
// from, and compares three bands in the SAME image so exposure and grade cancel:
//
//   the lot deck    known good — 32 tex/m both ways, and it reads
//   the apron band  the thing under dispute
//   the roadway     known good, and lit the same way
//
// The frame is screenshotted by Playwright and handed BACK into the page as a
// data URL to be decoded on a 2D canvas — reading the WebGL canvas directly
// needs preserveDrawingBuffer and would measure whatever happened to be in the
// buffer rather than the frame that was saved.
//
// Usage: SHOT_URL=http://127.0.0.1:4191/ node scripts/I-apron-grain.mjs
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto } from './lib/reachable.mjs';

const URL = aim('http://127.0.0.1:4191/');
const W = 1200, H = 800;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: W, height: H } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);

// TWO VIEWPOINTS, because they do not agree and only one of them is the
// complaint. Looking OUT of the lot the apron is a 26-row strip seen almost
// edge-on; driving IN off the road the same ground fills half the frame, and
// that is the frame the user was describing.
const VIEWS = [
  { label: 'A · from the road, driving IN   (11.0 m of ground fills the lower frame)',
    pose: [4.0, 2.6, Math.PI / 2, -0.42],
    bands: [
      ['roadway        (known good)', 200, 1000, 560, 780],
      ['KERB/WALK BAND (in dispute)', 200, 1000, 430, 520],
      ['lot deck       (known good)', 200, 1000, 330, 400],
    ] },
  { label: 'B · from inside, looking OUT    (the apron edge-on, 26 rows)',
    pose: [11.0, 2.6, -Math.PI / 2, -0.45],
    bands: [
      ['lot deck       (known good)', 200, 1000, 470, 700],
      // 324..350, NOT 306..352. My first band straddled the ROAD, the KERB LINE
      // and the walk and scored 13.5% -- the HIGHEST of the three -- which I
      // nearly published as "the apron reads as a material". It was measuring a
      // kerb edge. Cropping the band and LOOKING at it is what caught that; the
      // number on its own was confident and wrong.
      ['APRON BAND     (in dispute)', 200, 1000, 324, 350],
      ['roadway        (known good)', 200, 1000, 250, 296],
    ] },
];

const results = [];
for (const v of VIEWS) {
  await p.evaluate(([x, z, yaw, pitch]) => window.__ct.warp(x, z, yaw, 0.14, pitch), v.pose);
  await p.waitForTimeout(350);
  const b64 = (await p.screenshot()).toString('base64');
  const res = await p.evaluate(async ([b64, bands]) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext('2d');
    cx.drawImage(img, 0, 0);
    const out = [];
    for (const [name, x0, x1, y0, y1] of bands) {
      const d = cx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
      const w = x1 - x0, h = y1 - y0;
      let edges = 0, fine = 0, cells = 0, sr = 0, sg = 0, sb = 0, n = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; n++;
          // the SAME threshold A uses (24 summed over rgb), so the numbers here
          // are comparable with A-slabtex-proof's
          for (const [dx, dy] of [[1, 0], [0, 1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx >= w || ny >= h) continue;
            const j = (ny * w + nx) * 4;
            cells++;
            const dv = Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]);
            // TWO BANDS, because "no grain" and "no joints" are B's own two
            // halves and a single threshold blends them. A hard JOINT clears 24
            // easily; the fine speckle a surface needs to read as a material
            // lives between 8 and 24 and is invisible to the coarse count. After
            // B's second pass the joints landed and the blended number still
            // said "flat" -- which was true and useless, because it could not
            // say WHICH half was missing.
            if (dv > 24) edges++;
            else if (dv > 8) fine++;
          }
        }
      }
      out.push({ name, edgePct: +(100 * edges / cells).toFixed(2),
        grainPct: +(100 * fine / cells).toFixed(2),
        mean: [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)] });
    }
    return out;
  }, [b64, v.bands]);
  results.push({ label: v.label, res });
}

console.log('\n  edge density in the RENDERED frame — a flat quad is 0%, a real');
console.log('  material 9–17% (A-slabtex-proof). Bands are read from the SAME image,');
console.log('  so exposure and grade cancel.\n');
let FAIL = null;
for (const { label, res } of results) {
  console.log(`  ${label}`);
  for (const r of res)
    console.log(`     ${r.name}   joints ${String(r.edgePct).padStart(6)}%   grain ${String(r.grainPct).padStart(6)}%   mean rgb ${r.mean.join(',')}`);
  // JOINTS + GRAIN, not joints alone. B's diagnosis names two things -- "no
  // grain for the eye to attach to and no joints to give it scale" -- and my
  // first criterion keyed on the >24 count, which sees only the joints. After
  // B's second pass that read 2.32% against the road's 5.92% and I was about to
  // publish "still flat", when the same run showed the band's GRAIN at 5.14%
  // against the road's 2.76%: more fine texture than the road, less hard
  // jointing. A concrete walk legitimately has fewer hard edges than a road
  // with lane paint or a deck with tyre marks. Judging it on the half that
  // suited my earlier finding would have sent B back for a fault that had been
  // fixed.
  const disputed = res.find((r) => r.name.includes('in dispute'));
  const tot = (r) => r.edgePct + r.grainPct;
  const good = res.filter((r) => r.name.includes('known good')).map(tot);
  const ref = Math.min(...good);
  if (tot(disputed) < ref * 0.5) {
    FAIL = FAIL ?? `${tot(disputed).toFixed(2)}% against ${ref.toFixed(2)}% for the worst known-good band in the same frame`;
    console.log(`     -> FLAT: ${tot(disputed).toFixed(2)}% total against ${ref.toFixed(2)}% worst known-good\n`);
  } else {
    console.log(`     -> reads as a material: ${tot(disputed).toFixed(2)}% total against ${ref.toFixed(2)}% worst known-good\n`);
  }
}
if (FAIL) {
  console.log(`FAIL  ${FAIL}.`);
  console.log(`      The ground at the lot mouth still reads as a flat plane from the road.`);
  console.log(`      NOT this module's surface — ct/tex-ground.ts. See notes/BLOCKED-I.md.`);
} else {
  console.log('the ground at the lot mouth reads as a material from both viewpoints.');
}
await b.close();
process.exit(FAIL ? 1 : 0);
