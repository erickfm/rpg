// feat/basin — the catch basin, from where a player stands.
//
// The old one was two flat planes and the user's read was "what is this it
// looks bad". Everything that makes a casting read — the frame flange, the
// rebate the grate drops into, the slots being holes rather than paint, the
// throat under the kerb — is an EDGE, so this looks at it from the angles that
// show edges: standing over it, walking past it, and down the gutter line.
//
// Usage: SHOT_URL=http://localhost:4279/ node scripts/basin.mjs [shots|probe|wet|all]
import { chromium } from 'playwright';

const mode = process.argv[2] ?? 'all';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4177/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await page.waitForTimeout(500);
await page.evaluate(() => window.__ct.clock(13, 0));
await page.waitForTimeout(600);

const shot = async (n, x, z, tx, tz, gy, p) => {
  await page.evaluate(([x, z, tx, tz, gy, p]) =>
    window.__ct.warp(x, z, Math.atan2(tx - x, -(tz - z)), gy, p), [x, z, tx, tz, gy, p]);
  await page.waitForTimeout(340);
  await page.screenshot({ path: `shots/bs-${n}.png` });
};

if (mode === 'probe' || mode === 'all') {
  const r = await page.evaluate(() => {
    const sc = window.__ct.scene();
    const near = [];
    sc.traverse((o) => {
      if (!o.isMesh) return;
      if (Math.hypot(o.position.x - 4.7, o.position.z + 92.5) > 1.2) return;
      const g = o.geometry?.parameters ?? {};
      near.push({ y: +o.position.y.toFixed(4), h: g.height,
        top: g.height ? +(o.position.y + g.height / 2).toFixed(4) : null,
        kind: o.geometry?.type });
    });
    return near;
  });
  const boxes = r.filter((m) => m.kind === 'BoxGeometry');
  const tops = boxes.map((b) => b.top).filter((t) => t !== null);
  const frameTop = Math.max(...tops.filter((t) => t < 0.06));
  // the bars must sit BELOW the frame — that step is the whole read
  const barTops = tops.filter((t) => t < frameTop - 0.0005 && t > 0.01);
  console.log(`\n  meshes at the east basin: ${r.length} (${boxes.length} solid)`);
  console.log(`  frame top      ${frameTop.toFixed(4)} m`);
  console.log(`  grate bar top  ${barTops.length ? Math.max(...barTops).toFixed(4) : 'none'} m`);
  const rebate = barTops.length ? frameTop - Math.max(...barTops) : 0;
  console.log(`  rebate         ${(rebate * 1000).toFixed(1)} mm`);
  console.log(`\n  ${boxes.length >= 15 ? 'OK  ' : 'FAIL'} the casting is geometry, not a decal (${boxes.length} solids)`);
  console.log(`  ${rebate > 0.005 ? 'OK  ' : 'FAIL'} the grate is SUNK into the frame, not flush with it`);
  if (boxes.length < 15 || rebate <= 0.005) process.exit(1);
}

// NOTE on the 4th argument: warp's `gy` is the GROUND height under the
// camera, not the eye height — the eye rides about 1.6 m above it. So a shot
// on the walk passes 0.14 (the kerb reveal) and a shot in the road passes 0.
// Getting this wrong puts the camera three metres up and quietly turns every
// judgement into a top-down one, which is the exact mistake the trash rig
// failed on.
const WALK = 0.14, ROAD = 0;

if (mode === 'shots' || mode === 'all') {
  // standing over it on the walk, looking down — the angle the user shot from
  await shot('over', 5.9, -91.4, 4.7, -92.6, WALK, -0.62);
  // walking past on the walk, the angle you actually pass it at
  await shot('walkby', 5.7, -89.4, 5.2, -93.4, WALK, -0.34);
  // down the gutter line, so the throat under the kerb is side-on
  await shot('gutter', 4.5, -88.2, 4.8, -93.2, ROAD, -0.30);
  // from the road, square to the kerb face — the throat's own view, and close,
  // because a 7 cm opening in a 13 cm kerb is a real detail at a real size
  await shot('throat', 3.4, -92.5, 5.0, -92.5, ROAD, -0.40);
  await shot('throat-near', 4.15, -92.2, 5.0, -92.5, ROAD, -0.52);
}

if (mode === 'wet' || mode === 'all') {
  // The world's rain predicate, duplicated here because scripts cannot import
  // from the TS module. It has an EXCEPTION now — 14:00 always rains, to put
  // the first storm 40 s from spawn — so a script that picks "the first dry
  // hour" must know about it or it will pick a wet one. Keep in step with
  // rainAt() in ct/props.ts.
  const rainy = (h) => (((h % 24) + 24) % 24) === 14 ||
    ((Math.imul(h, 2246822519) >>> 0) % 100) < 30;
  let wetH = 0; for (let h = 0; h < 48; h++) if (rainy(h)) { wetH = h; break; }
  await page.evaluate((h) => window.__ct.clock(h, 0), wetH);
  await page.waitForTimeout(7000);
  await shot('wet-over', 5.9, -91.4, 4.7, -92.6, 1.62, -0.62);
  await shot('wet-gutter', 4.4, -87.6, 4.7, -93.2, 1.20, -0.26);
  console.log('shots -> shots/bs-*.png');
}

await browser.close();
if (errors.length) { console.error('\nPAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('\nno page errors');
