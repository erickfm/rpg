// PROP ON PROP, measured box against box across the whole park.
//
// The user has found three of these by eye now — the bench through the
// fountain, the bin inside the noticeboard, and a tree standing inside the
// shelter — and asked for a sweep rather than a third one-off fix. Colliders
// are the wrong set to test (a hoop has none, a sign has one bigger than it
// looks), so this uses real world bounding boxes, and it only reports pairs
// that overlap in ALL THREE axes: two things at the same x/z but different
// heights are a bin under a sign, which is fine.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4194/';
const b = await chromium.launch();
const page = await b.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
const hits = await page.evaluate(() => {
  const V3 = Object.getPrototypeOf(window.__ct.scene().position).constructor;
  const items = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    o.updateWorldMatrix(true, false);
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const c = bb.getCenter(new V3()), s = bb.getSize(new V3());
    if (c.x < -39 || c.x > -7 || c.z < -99 || c.z > -67) return;
    if (s.y < 0.35) return;                       // ground sheets and decals
    if (s.x > 12 || s.z > 12) return;             // whole-park planes
    // SOLID PROPS ONLY. A tree is three crossed leaf CARDS at one position, so
    // every tree overlaps itself twice by construction and the first run of
    // this reported nothing else. Crossed planes are the technique, not a
    // fault; what the user is finding is solid things inside other solid
    // things.
    if (o.geometry.type === 'PlaneGeometry') return;
    items.push({ bb, c, s, mod: o.userData?.mod ?? '?' });
  });
  const out = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], q = items[j];
      const ox = Math.min(a.bb.max.x, q.bb.max.x) - Math.max(a.bb.min.x, q.bb.min.x);
      const oy = Math.min(a.bb.max.y, q.bb.max.y) - Math.max(a.bb.min.y, q.bb.min.y);
      const oz = Math.min(a.bb.max.z, q.bb.max.z) - Math.max(a.bb.min.z, q.bb.min.z);
      if (ox <= 0.02 || oy <= 0.02 || oz <= 0.02) continue;
      // the smaller of the two must be substantially inside the other
      const vol = Math.min(a.s.x * a.s.y * a.s.z, q.s.x * q.s.y * q.s.z);
      if (ox * oy * oz < vol * 0.12) continue;
      out.push({ at: `${a.c.x.toFixed(1)},${a.c.z.toFixed(1)}`,
        a: `${a.s.x.toFixed(2)}x${a.s.y.toFixed(2)}x${a.s.z.toFixed(2)} [${a.mod}]`,
        b: `${q.s.x.toFixed(2)}x${q.s.y.toFixed(2)}x${q.s.z.toFixed(2)} [${q.mod}]`,
        by: +(ox * oy * oz).toFixed(3) });
    }
  }
  return out.sort((x, y) => y.by - x.by).slice(0, 12);
});
console.log(hits.length ? `prop-on-prop overlaps: ${hits.length} shown` : 'no prop-on-prop overlap in the park');
for (const h of hits) console.log('  ', JSON.stringify(h));
await b.close();
process.exit(hits.length ? 1 : 0);
