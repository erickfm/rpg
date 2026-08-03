// Item 204 — WHAT does the crate's authored spot overlap, and is the spot it
// LANDED on clear?
//
// props.ts's dimWorld pass (:1264-1318) shoves any litter group whose world box
// intersects a solid mesh box, so the coordinate in the source is a REQUEST and
// the world is the answer. The crate was authored at (-9.30, -37.45) and landed
// at (-8.88, -37.54). This reproduces that pass's own overlap test — same
// filters, quoted from the source — against both boxes, so the push is
// explained rather than accepted.
//
//   SHOT_URL=http://localhost:4330/ node scripts/probes/w77-what-pushed-it.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4330/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.scene !== undefined, { timeout: 30000 });
await p.waitForTimeout(600);

const r = await p.evaluate(() => {
  const sc = window.__ct.scene();
  // find the crate the item is about: the one nearest the alley's north wall
  let crate = null;
  sc.traverse((o) => {
    if (o.userData?.litter !== 'milk crate') return;
    if (crate === null || o.position.z > crate.position.z) crate = o;
  });
  if (!crate) return { err: 'no milk crate found' };
  crate.updateMatrixWorld(true);
  const THREE = { Box3: crate.constructor === undefined ? null : null };
  // use the group's own bounding box via three, reached through an existing object
  const bb = new (Object.getPrototypeOf(sc).constructor.prototype.constructor === undefined ? Object : Object)();
  return { ok: true, x: crate.position.x, y: crate.position.y, z: crate.position.z,
    halfX: crate.userData.halfX };
});
if (r.err) { console.log('REFUSING TO REPORT:', r.err); await b.close(); process.exit(3); }
console.log(`the north-most milk crate: (${r.x.toFixed(2)}, ${r.y.toFixed(3)}, ${r.z.toFixed(2)})  halfX ${r.halfX.toFixed(3)}`);

// dimWorld's own solid set, filters quoted from ct/props.ts:1264-1274:
//   not a mesh / no geometry / userData.litter   -> skipped
//   height < 0.25, or min.y > 1.6                -> skipped
//   wider than 40 in x or 60 in z                -> skipped (whole-block sheets)
const probe = await p.evaluate(([cx, cz, half]) => {
  const sc = window.__ct.scene();
  const THREE_Box3 = sc.children.find((c) => c.geometry) ? null : null;
  // Build boxes by hand from world matrices + geometry bounding boxes, so the
  // probe does not need THREE on the page.
  const solids = [];
  // ct/props.ts:1268 writes this as `o.userData?.litter`, which only ever
  // matches the GROUP — a litter group's child panels carry no tag, so they
  // land in the solid set and the group is then pushed out of its own panels.
  // That is the finding this probe exists to state, so the probe itself has to
  // test the ANCESTRY (the way scripts/footprint.mjs:113 already does) or it
  // reports the same false clip on the crate's new home.
  const isLitter = (o) => { let q = o; while (q) { if (q.userData?.litter) return true; q = q.parent; } return false; };
  sc.traverse((o) => {
    if (!o.isMesh || !o.geometry || isLitter(o)) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const g = o.geometry.boundingBox; if (!g) return;
    o.updateWorldMatrix(true, false);
    // transform the 8 corners
    let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
    const e = o.matrixWorld.elements;
    for (const X of [g.min.x, g.max.x]) for (const Y of [g.min.y, g.max.y]) for (const Z of [g.min.z, g.max.z]) {
      const wx = e[0] * X + e[4] * Y + e[8] * Z + e[12];
      const wy = e[1] * X + e[5] * Y + e[9] * Z + e[13];
      const wz = e[2] * X + e[6] * Y + e[10] * Z + e[14];
      if (wx < mnx) mnx = wx; if (wx > mxx) mxx = wx;
      if (wy < mny) mny = wy; if (wy > mxy) mxy = wy;
      if (wz < mnz) mnz = wz; if (wz > mxz) mxz = wz;
    }
    if (!isFinite(mnx)) return;
    const h = mxy - mny;
    if (h < 0.25 || mny > 1.6) return;
    if (mxx - mnx > 40 || mxz - mnz > 60) return;
    solids.push({ mnx, mxx, mny, mxy, mnz, mxz, g: o.geometry.type,
      sz: [+(g.max.x - g.min.x).toFixed(2), +(g.max.y - g.min.y).toFixed(2), +(g.max.z - g.min.z).toFixed(2)] });
  });
  // the crate's box at a hypothetical (x, z), using the measured half-extent
  const at = (x, z) => ({ mnx: x - half, mxx: x + half, mnz: z - half, mxz: z + half, mny: 0.006, mxy: 0.30 });
  const hits = (bx) => solids.filter((s) =>
    !(bx.mxx <= s.mnx || bx.mnx >= s.mxx) && !(bx.mxz <= s.mnz || bx.mnz >= s.mxz) &&
    !(bx.mxy <= s.mny || bx.mny >= s.mxy));
  return { nsolids: solids.length,
    authored: hits(at(-9.30, -37.45)).map((s) => ({ g: s.g, sz: s.sz, x: [+s.mnx.toFixed(2), +s.mxx.toFixed(2)], z: [+s.mnz.toFixed(2), +s.mxz.toFixed(2)], y: [+s.mny.toFixed(2), +s.mxy.toFixed(2)] })),
    landed: hits(at(cx, cz)).map((s) => ({ g: s.g, sz: s.sz, x: [+s.mnx.toFixed(2), +s.mxx.toFixed(2)], z: [+s.mnz.toFixed(2), +s.mxz.toFixed(2)], y: [+s.mny.toFixed(2), +s.mxy.toFixed(2)] })) };
}, [r.x, r.z, r.halfX]);

let fails = 0;
console.log(`\ndimWorld-eligible solid meshes in the world: ${probe.nsolids}`);
if (probe.nsolids < 200) { fails++; console.log('  FAIL that is too few — the probe is not seeing the world'); }
console.log(`\nAUTHORED spot (-9.30, -37.45) overlaps ${probe.authored.length} solid(s):`);
for (const s of probe.authored) console.log(`  ${s.g} ${JSON.stringify(s.sz)}  x ${JSON.stringify(s.x)}  y ${JSON.stringify(s.y)}  z ${JSON.stringify(s.z)}`);
console.log(`\nLANDED spot (${r.x.toFixed(2)}, ${r.z.toFixed(2)}) overlaps ${probe.landed.length} solid(s):`);
for (const s of probe.landed) console.log(`  ${s.g} ${JSON.stringify(s.sz)}  x ${JSON.stringify(s.x)}  y ${JSON.stringify(s.y)}  z ${JSON.stringify(s.z)}`);

// NEGATIVE CASE: the overlap test must be able to find something. The dumpster
// is a 2.4 x 1.1 x 1.05 box and a crate placed in its middle must register.
const neg = await p.evaluate(() => {
  const sc = window.__ct.scene();
  let dump = null;
  sc.traverse((o) => {
    if (!o.isMesh || !o.geometry?.parameters) return;
    const q = o.geometry.parameters;
    if (Math.abs(q.width - 2.4) < 0.01 && Math.abs(q.height - 1.1) < 0.01) dump = o;
  });
  return dump ? { x: dump.position.x, z: dump.position.z } : null;
});
if (!neg) { fails++; console.log('\n  FAIL negative case: could not find the dumpster to plant a crate inside'); }
else {
  const inside = await p.evaluate(([dx, dz, half]) => {
    const sc = window.__ct.scene();
    let n = 0;
    const isLitter = (q0) => { let q = q0; while (q) { if (q.userData?.litter) return true; q = q.parent; } return false; };
    sc.traverse((o) => {
      if (!o.isMesh || !o.geometry || isLitter(o)) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const g = o.geometry.boundingBox; if (!g) return;
      o.updateWorldMatrix(true, false);
      const e = o.matrixWorld.elements;
      let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
      for (const X of [g.min.x, g.max.x]) for (const Y of [g.min.y, g.max.y]) for (const Z of [g.min.z, g.max.z]) {
        const wx = e[0] * X + e[4] * Y + e[8] * Z + e[12];
        const wy = e[1] * X + e[5] * Y + e[9] * Z + e[13];
        const wz = e[2] * X + e[6] * Y + e[10] * Z + e[14];
        if (wx < mnx) mnx = wx; if (wx > mxx) mxx = wx;
        if (wy < mny) mny = wy; if (wy > mxy) mxy = wy;
        if (wz < mnz) mnz = wz; if (wz > mxz) mxz = wz;
      }
      const h = mxy - mny;
      if (h < 0.25 || mny > 1.6) return;
      if (mxx - mnx > 40 || mxz - mnz > 60) return;
      if (!(dx + half <= mnx || dx - half >= mxx) && !(dz + half <= mnz || dz - half >= mxz) && !(0.30 <= mny || 0.006 >= mxy)) n++;
    });
    return n;
  }, [neg.x, neg.z, r.halfX]);
  if (inside < 1) { fails++; console.log(`\n  FAIL negative case: a crate planted inside the dumpster registered ${inside} overlaps`); }
  else console.log(`\n  OK   negative case: a crate planted inside the dumpster registers ${inside} overlap(s) — the test can go red`);
}

if (probe.landed.length) { fails++; console.log('  FAIL the crate is clipping something where it landed'); }
else console.log('  OK   the crate clips nothing where it landed');
console.log(`\n${fails ? `FAIL — ${fails}` : 'PASS'}`);
await b.close();
process.exit(fails ? 1 : 0);
