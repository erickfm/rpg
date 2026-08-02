// WHAT DOES A DRY STREET ACTUALLY LOOK LIKE, AND HOW WET IS IT AFTER THE RAIN?
//
// `scripts/wetness.mjs`'s verdict was `last.broad !== wet.broad`, i.e. "the
// surface differs from what it was mid-storm" — which is what DRYING does, so
// it passed on a bone-dry street. To ask "is it wet" instead I need a DRY
// reference, and it has to be taken at the SAME HOUR: props tints the surface
// as `base * ambient` when dry and multiplies toward WET_WALL when wet
// (ct/props.ts:1022-1030), so ambient light alone changes the colour between
// hours and would swamp the signal.
//
// `wetness` starts at 0 on load (ct/props.ts:185) and the spawn is indoors
// where rainLevel is forced to 0, so a reference taken straight after load at
// the dry hour is genuinely dry. This probe proves that and prints the numbers
// the new predicate should be built from.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w29-wetref.mjs
import { chromium } from 'playwright';

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(process.env.SHOT_URL ?? 'http://localhost:4188/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const SCHEDULE = await page.evaluate(() => {
  const f = window.__ct.scene().userData.rainAt;
  return Array.from({ length: 240 }, (_, h) => !!f(h));
});
let wetH = -1, dryH = -1;
for (let h = 0; h < 48; h++) { if (wetH < 0 && SCHEDULE[h]) wetH = h; if (dryH < 0 && !SCHEDULE[h]) dryH = h; }
console.log(`rainy hour ${wetH}, dry hour ${dryH}`);

const read = () => page.evaluate(() => {
  const sc = window.__ct.scene();
  const out = { strip: null, broad: null, wetness: sc.userData.wetness, rainLevel: sc.userData.rainLevel };
  sc.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const m = o.material;
    if (!m.map?.image || m.transparent) return;
    const img = m.map.image;
    if (img.height < 32 && img.width > 200 && !out.strip) out.strip = m.color.getHexString();
    if (img.width === 64 && img.height === 64 && !out.broad) out.broad = m.color.getHexString();
  });
  return out;
});
const lum = (hex) => {
  const n = parseInt(hex, 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};

// ── the DRY reference, taken before any storm, at the dry hour ────────────
await page.evaluate(() => window.__ct.warp(6.2, -50, 0, 0.14, 0));
await page.waitForTimeout(300);
await page.evaluate((h) => window.__ct.clock(h, 0), dryH);
await page.waitForTimeout(1500);
const dry = await read();
console.log(`\nDRY reference @ hour ${dryH}: broad ${dry.broad} (lum ${lum(dry.broad).toFixed(4)})  ` +
  `strip ${dry.strip} (lum ${lum(dry.strip).toFixed(4)})  wetness ${dry.wetness}`);

// ── the storm ─────────────────────────────────────────────────────────────
await page.evaluate((h) => window.__ct.clock(h, 0), wetH);
await page.waitForTimeout(5000);
const wet = await read();
console.log(`STORM   @ hour ${wetH}: broad ${wet.broad} (lum ${lum(wet.broad).toFixed(4)})  ` +
  `strip ${wet.strip} (lum ${lum(wet.strip).toFixed(4)})  wetness ${wet.wetness?.toFixed(4)}`);

// ── and the drying, back at the dry hour ──────────────────────────────────
await page.evaluate((h) => window.__ct.clock(h, 0), dryH);
console.log('\n  t     broad      lum      vs dry      strip      lum      vs dry     wetness');
for (let i = 0; i < 7; i++) {
  await page.waitForTimeout(2000);
  const r = await read();
  const db = lum(dry.broad) - lum(r.broad), ds = lum(dry.strip) - lum(r.strip);
  console.log(`  +${((i + 1) * 2).toString().padStart(2)}s  ${r.broad}  ${lum(r.broad).toFixed(4)}  ` +
    `${(db >= 0 ? '+' : '') + db.toFixed(4)} darker   ${r.strip}  ${lum(r.strip).toFixed(4)}  ` +
    `${(ds >= 0 ? '+' : '') + ds.toFixed(4)}   ${r.wetness?.toFixed(4)}`);
}
console.log('\n"darker than dry" > 0 means the street is still visibly wet.');

// ── THE SLEEP, DEMONSTRATED ON REAL READINGS ─────────────────────────────
//
// The failing scenario is not "it never rained" — both predicates catch that,
// because the storm sample is then dry too. It is "it rained and then dried
// COMPLETELY", which is what w22 observed. Simulating that live would mean
// waiting out `48 * (1 + soak * 1.5)` seconds of drying, so instead both
// predicates are applied to readings that were all MEASURED above: the storm
// sample, and the genuine bone-dry sample taken before it.
//
// Nothing here is invented — `dry` is a real reading of a real dry street and
// `wet` is a real reading of a real storm. The only thing being supposed is
// that the street reached `dry` again, which is exactly what drying does.
const oldVerdict = dry.broad !== wet.broad || dry.strip !== wet.strip;
const newVerdict = dry.wetness > 0.004 &&
  (lum(dry.broad) - lum(dry.broad)) > 0.02 && (lum(dry.strip) - lum(dry.strip)) > 0.02;
console.log('\nif the street dried COMPLETELY and each predicate were asked "is it still wet":');
console.log(`  OLD  last.broad !== wet.broad          -> ${oldVerdict ? 'PASS  <-- SLEPT' : 'FAIL'}` +
  `   (${dry.broad} !== ${wet.broad} is ${dry.broad !== wet.broad})`);
console.log(`  NEW  darker than dry, on both surfaces -> ${newVerdict ? 'PASS' : 'FAIL  <-- correctly red'}` +
  `   (0.0000 darker, wetness ${dry.wetness})`);
if (!oldVerdict || newVerdict) {
  console.error('\n  UNEXPECTED: the old predicate did not sleep, or the new one does. Re-measure.');
  process.exit(1);
}
console.log('\nso the old verdict was satisfied BY drying, which is the thing it was meant to detect.');
await b.close();
