// PROP ON PROP, measured box against box across the whole park.
//
// The user has found three of these by eye now — the bench through the
// fountain, the bin inside the noticeboard, and a tree standing inside the
// shelter — and asked for a sweep rather than a third one-off fix. Colliders
// are the wrong set to test (a hoop has none, a sign has one bigger than it
// looks), so this uses real world bounding boxes, and it only reports pairs
// that overlap in ALL THREE axes: two things at the same x/z but different
// heights are a bin under a sign, which is fine.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
const URL = aim('http://localhost:4182/');
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
    // WHICH PROP IS THIS PART OF. A bench is a Group of a seat, a back, two
    // cast ends; a noticeboard is a panel on two posts; a shrub run is three
    // blocks that are MEANT to interpenetrate, because that is what makes a
    // run read as massed rather than as fence posts. Every one of those is a
    // prop overlapping ITSELF, and the first version of this counted all of
    // them — it reported twelve hits of which twelve were correct-by-design,
    // which is worth exactly as much as reporting none. So each mesh carries
    // the highest ancestor below the scene, and pairs sharing one are skipped.
    let root = o;
    while (root.parent && root.parent.parent) root = root.parent;
    items.push({ bb, c, s, root, massed: !!o.userData?.massed,
      mod: o.userData?.mod ?? '?' });
  });
  const out = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], q = items[j];
      if (a.root === q.root) continue;             // one prop against itself
      if (a.massed && q.massed) continue;          // shrub blocks massing, by design
      // CONCENTRIC AND FROM ONE MODULE IS ONE ASSEMBLY. B's lamps put a collar
      // on a column at the same x/z; that is a lamp, not a collision, and it
      // is not in a Group I can see from here because it is not my file. Two
      // genuinely separate props are never concentric to 6 cm — the faults the
      // user found were all OFFSET, a bin beside a board, a bench through a
      // fountain. Without this the sweep exits red on ten of another builder's
      // lamps for ever, and a red I cannot act on is one I learn to ignore.
      if (a.mod !== '?' && a.mod === q.mod &&
          Math.hypot(a.c.x - q.c.x, a.c.z - q.c.z) < 0.06) continue;
      const ox =Math.min(a.bb.max.x, q.bb.max.x) - Math.max(a.bb.min.x, q.bb.min.x);
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
  out.sort((x, y) => y.by - x.by);
  // Report the TOTAL, not the length of the list I print. `slice(0, 12)` with
  // a "12 shown" line is how a sweep says "I found twelve" when it found two
  // hundred, and I would have read my own output as all-clear at eleven.
  return { total: out.length, scanned: items.length, worst: out.slice(0, 12) };
});
const { total, scanned, worst } = hits;
console.log(total
  ? `prop-on-prop overlaps: ${total} across ${scanned} park meshes` +
    (total > worst.length ? ` (worst ${worst.length} shown)` : '')
  : `no prop-on-prop overlap in the park — ${scanned} meshes scanned`);
for (const h of worst) console.log('  ', JSON.stringify(h));
await b.close();
process.exit(total ? 1 : 0);
