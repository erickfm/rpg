// IS THERE A FLOOR MESH UNDER A GIVEN (x, z)? Item 215.
//
// `groundAt()` cannot answer this: `groundPick` (crosstown.ts:1263) falls all
// the way through to `return put(... ? KERB_H : 0)` — it never returns null, so
// it reports a height for every point in R^2, including points with no world
// under them. That is why item 175 could say, correctly, "this was never a floor
// hole": the floor picker is continuous over the void as well as over the city.
//
// So ask the SCENE. Walk every Mesh, take its geometry bounding box through its
// world matrix, keep the ones that are floor-shaped at the walkable level, and
// test the point against their XZ footprints.
//
// VALIDATED ON KNOWN POSITIVES AND KNOWN NEGATIVES BELOW — an instrument that
// only ever says "yes" is the thing this project keeps finding in its own
// checks.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
const URL = aim('http://localhost:4310/');
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 600 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await page.waitForTimeout(1200);

const floorsOf = () => page.evaluate(() => {
  const out = [];
  window.__ct.scene().updateMatrixWorld(true);
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    if (!bb) return;
    // eight corners through the world matrix — a floor is a PlaneGeometry
    // rotated -90 about X, so its LOCAL box is flat in Z and its world box is
    // flat in Y. Doing the corners rather than the local box is what makes the
    // rotation irrelevant.
    let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
    for (let i = 0; i < 8; i++) {
      const v = {
        x: i & 1 ? bb.max.x : bb.min.x,
        y: i & 2 ? bb.max.y : bb.min.y,
        z: i & 4 ? bb.max.z : bb.min.z,
      };
      const e = o.matrixWorld.elements;
      const X = e[0] * v.x + e[4] * v.y + e[8] * v.z + e[12];
      const Y = e[1] * v.x + e[5] * v.y + e[9] * v.z + e[13];
      const Z = e[2] * v.x + e[6] * v.y + e[10] * v.z + e[14];
      mnx = Math.min(mnx, X); mxx = Math.max(mxx, X);
      mny = Math.min(mny, Y); mxy = Math.max(mxy, Y);
      mnz = Math.min(mnz, Z); mxz = Math.max(mxz, Z);
    }
    // FLOOR-SHAPED: thin in Y, and at least a metre across in both ground axes.
    if (mxy - mny > 0.6) return;
    if (mxx - mnx < 1 || mxz - mnz < 1) return;
    out.push({ minX: mnx, maxX: mxx, minZ: mnz, maxZ: mxz, y: mxy, n: o.name || '' });
  });
  return out;
});

const floors = await floorsOf();
console.log(`${floors.length} floor-shaped meshes`);

const under = (x, z, gy) => floors.filter((fl) => x >= fl.minX && x <= fl.maxX && z >= fl.minZ && z <= fl.maxZ
  && fl.y >= gy - 0.9 && fl.y <= gy + 1.2);

const at = async (x, z) => {
  const gy = await page.evaluate(([x, z]) => window.__ct.groundAt(x, z), [x, z]);
  const hits = under(x, z, gy);
  return { gy, n: hits.length, top: hits.length ? Math.max(...hits.map((h) => h.y)).toFixed(2) : '—' };
};

const CASES = [
  ['lot centre           (expect FLOOR)', 12, 5],
  ['road centre          (expect FLOOR)', 0, 0],
  ['park centre          (expect FLOOR)', -20, -83],
  ['jail forecourt       (expect FLOOR)', 60, -103],
  ['side street          (expect FLOOR)', 50, -103],
  ['jail hole, past site (expect VOID) ', 60, -112],
  ['far south void       (expect VOID) ', 60, -125],
  ['north of lot z15                   ', 12, 15],
  ['north of lot z16                   ', 12, 16],
  ['north of lot z17                   ', 12, 17],
  ['north of lot z18                   ', 12, 18],
  ['north of lot z19                   ', 12, 19],
  ['north of road z17                  ', 0, 17],
  ['north of road z19                  ', 0, 19],
  ['west of park x-42                  ', -42, -83],
  ['north of park z-66                 ', -20, -66],
  ['north of park z-62                 ', -20, -62],
];
for (const [nm, x, z] of CASES) {
  const r = await at(x, z);
  console.log(`${nm}  (${String(x).padStart(5)}, ${String(z).padStart(5)})  groundAt ${r.gy.toFixed(2)}  floors ${r.n}  top ${r.top}`);
}

// where does the ground end going north on the east pavement?
console.log('\nnorth edge scan, x = 12:');
for (let z = 13; z <= 22; z += 0.5) {
  const r = await at(12, z);
  console.log(`  z ${z.toFixed(1).padStart(5)}  floors ${r.n}`);
}
await b.close();
