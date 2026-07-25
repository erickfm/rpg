// feat/wet — the street remembers the weather.
//
// Everything here is TIMING, so none of it can be shown in a still. The probe
// drives the clock from a rainy hour to a dry one and samples what happens
// after the last drop lands.
//
// Usage: SHOT_URL=http://localhost:4279/ node scripts/wet.mjs [probe|shots|all]
import { chromium } from 'playwright';

const mode = process.argv[2] ?? 'probe';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(500);

// same predicate ct/props.ts uses, so we pick hours the world agrees are wet
const rainy = (h) => ((Math.imul(h, 2246822519) >>> 0) % 100) < 22;
let wetH = -1, dryH = -1;
for (let h = 0; h < 48; h++) { if (wetH < 0 && rainy(h)) wetH = h; if (dryH < 0 && !rainy(h)) dryH = h; }

const read = () => page.evaluate(() => {
  const sc = window.__ct.scene();
  const out = { pud: [], strip: null, broad: null, rainOpacity: 0 };
  sc.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const m = o.material;
    if (m.map?.image?.width === 48 && m.map?.image?.height === 32 && m.transparent) {
      out.pud.push(+m.opacity.toFixed(4));
      return;
    }
    if (!m.map?.image || m.transparent) return;
    const img = m.map.image;
    // the wet registry: long thin strips are kerb/gutter, broad sheets are
    // road and walk
    if (img.height < 32 && img.width > 200 && !out.strip) out.strip = m.color.getHexString();
    if (img.width === 64 && img.height === 64 && !out.broad) out.broad = m.color.getHexString();
  });
  const pts = sc.children.find((c) => c.isPoints);
  out.rainOpacity = pts ? +pts.material.opacity.toFixed(3) : 0;
  out.raining = pts ? pts.visible : false;
  return out;
});

if (mode === 'probe' || mode === 'all') {
  console.log(`\nrainy hour ${wetH}, dry hour ${dryH}`);
  await page.evaluate((h) => window.__ct.clock(h, 0), wetH);
  await page.waitForTimeout(5000);                       // let it come down
  const wet = await read();
  const rainingNow = wet.rainOpacity;
  console.log(`  during the storm: rain opacity ${rainingNow}, ` +
    `puddles ${wet.pud.filter((o) => o > 0.02).length}/${wet.pud.length} showing`);

  await page.evaluate((h) => window.__ct.clock(h, 0), dryH);
  const samples = [];
  for (let i = 0; i < 7; i++) {
    await page.waitForTimeout(2000);
    const r = await read();
    samples.push(r);
    const maxP = Math.max(...r.pud);
    console.log(`  +${((i + 1) * 2).toString().padStart(2)}s after the rain stops: ` +
      `rain ${r.rainOpacity.toFixed(3)}  strongest puddle ${maxP.toFixed(3)}  ` +
      `road ${r.broad}  gutter ${r.strip}`);
  }

  // the drop volume fades over ~6 s and its opacity asymptotes rather than
  // hitting zero, so ask whether it is still being DRAWN, at the end
  const rainStopped = !samples[samples.length - 1].raining;
  const maxAt = samples.map((s) => Math.max(...s.pud));
  // puddles must still be FILLING after the rain has gone
  const stillFilling = maxAt[3] > maxAt[0];
  // and the street must not be bone dry the moment it stops
  const streetStillWet = samples[samples.length - 1].broad !== wet.broad ||
                         samples[samples.length - 1].strip !== wet.strip;
  const stillDark = maxAt[maxAt.length - 1] > 0.05;
  // individual fill: they must not move in lockstep
  const spread = new Set(samples[3].pud.filter((o) => o > 0.02).map((o) => o.toFixed(3)));
  const individual = spread.size >= 3;
  // the gutter holds water longer than the road crown
  const gutterHolds = samples[3].strip !== samples[3].broad;

  console.log(`\n  ${rainStopped ? 'OK  ' : 'FAIL'} the rain actually stopped`);
  console.log(`  ${stillFilling ? 'OK  ' : 'FAIL'} puddles are STILL filling after it stops — they crest late`);
  console.log(`  ${stillDark ? 'OK  ' : 'FAIL'} standing water outlasts the storm`);
  console.log(`  ${streetStillWet ? 'OK  ' : 'FAIL'} the street is still wet, not bone dry on the last drop`);
  console.log(`  ${individual ? 'OK  ' : 'FAIL'} puddles fill individually (${spread.size} distinct depths), not in lockstep`);
  console.log(`  ${gutterHolds ? 'OK  ' : 'FAIL'} the gutter and the road crown dry at different rates`);
  if (!rainStopped || !stillFilling || !stillDark || !streetStillWet || !individual || !gutterHolds) process.exit(1);
}

if (mode === 'shots' || mode === 'all') {
  const shot = async (n, x, z, tx, tz, gy = 0, p = 0) => {
    await page.evaluate(([x, z, tx, tz, gy, p]) =>
      window.__ct.warp(x, z, Math.atan2(tx - x, -(tz - z)), gy, p), [x, z, tx, tz, gy, p]);
    await page.waitForTimeout(320);
    await page.screenshot({ path: `shots/wt-${n}.png` });
  };
  await page.evaluate((h) => window.__ct.clock(h, 0), wetH);
  await page.waitForTimeout(6000);
  await shot('storm-road', -1.0, -14, -1.0, -44, 0, -0.10);
  await shot('storm-gutter', 3.6, -30, 4.8, -40, 0, -0.30);
  await page.evaluate((h) => window.__ct.clock(h, 0), dryH);
  await page.waitForTimeout(9000);
  await shot('after-road', -1.0, -14, -1.0, -44, 0, -0.10);
  await shot('after-gutter', 3.6, -30, 4.8, -40, 0, -0.30);
  await shot('after-basin', 3.4, -88, 4.7, -93, 0, -0.28);
  console.log('shots -> shots/wt-*.png');
}

await browser.close();
if (errors.length) { console.error('\nPAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('\nno page errors');
