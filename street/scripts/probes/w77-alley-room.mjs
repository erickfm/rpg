// Item 204 — WHERE IN THE ALLEY IS THERE ROOM FOR THE CRATE?
//
// props.ts's own rule, written two placements above the one the user is
// complaining about: *"the alley, round the dumpster — crates live here, not on
// a sidewalk"*. So the crate is going to the alley. This asks the world where
// it FITS: the alley's static colliders, its existing litter, and the two cat
// spots — whose composition took seven iterations and the user's own
// screenshots (ct/cat.ts:239-300) and must not be disturbed.
//
//   SHOT_URL=http://localhost:4330/ node scripts/probes/w77-alley-room.mjs [x z]
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';

const URL = aim('http://localhost:4330/');
const CAND = process.argv[2] !== undefined
  ? [parseFloat(process.argv[2]), parseFloat(process.argv[3])] : null;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.scene !== undefined, { timeout: 30000 });
await p.waitForTimeout(600);

// The alley box, generous, taken from where the alley litter already sits.
const BOX = { x0: -13.5, x1: -7.0, z0: -44.5, z1: -36.5 };

const dump = await p.evaluate((B) => {
  const inBox = (x, z) => x >= B.x0 && x <= B.x1 && z >= B.z0 && z <= B.z1;
  const cols = window.__ct.staticColliders()
    .filter((c) => c && isFinite(c.minX))
    .filter((c) => c.maxX >= B.x0 && c.minX <= B.x1 && c.maxZ >= B.z0 && c.minZ <= B.z1)
    .map((c) => [+c.minX.toFixed(2), +c.maxX.toFixed(2), +c.minZ.toFixed(2), +c.maxZ.toFixed(2)]);
  const litter = [];
  const shadows = [];
  const props = [];
  window.__ct.scene().traverse((o) => {
    if (o.userData?.litter) {
      if (inBox(o.position.x, o.position.z))
        litter.push({ kind: o.userData.litter, x: +o.position.x.toFixed(2), z: +o.position.z.toFixed(2),
          y: +o.position.y.toFixed(3), halfX: o.userData.halfX ?? null });
      return;
    }
    if (o.userData?.catShadow && inBox(o.position.x, o.position.z))
      shadows.push({ x: +o.position.x.toFixed(2), z: +o.position.z.toFixed(2) });
    // anything else sitting low in the alley that a crate could clip
    if (o.isMesh && o.position.y < 1.4 && inBox(o.position.x, o.position.z)) {
      if (!o.geometry?.boundingBox) o.geometry?.computeBoundingBox?.();
      const bb = o.geometry?.boundingBox;
      props.push({ x: +o.position.x.toFixed(2), y: +o.position.y.toFixed(2), z: +o.position.z.toFixed(2),
        g: o.geometry?.type ?? '?',
        sz: bb ? [+(bb.max.x - bb.min.x).toFixed(2), +(bb.max.y - bb.min.y).toFixed(2), +(bb.max.z - bb.min.z).toFixed(2)] : null });
    }
  });
  return { cols, litter, shadows, props };
}, BOX);

console.log(`alley static colliders (${dump.cols.length}):`);
for (const c of dump.cols) console.log(`  x ${c[0]} … ${c[1]}   z ${c[2]} … ${c[3]}`);
console.log(`\nalley litter (${dump.litter.length}):`);
for (const q of dump.litter) console.log(`  ${q.kind.padEnd(20)} (${q.x}, ${q.y}, ${q.z})  halfX ${q.halfX}`);
console.log(`\ncat shadows (userData.catShadow — ct/cat.ts:312 says so on purpose) (${dump.shadows.length}):`);
for (const c of dump.shadows) console.log(`  (${c.x}, ${c.z})`);
console.log(`\nother low meshes in the alley box (${dump.props.length}):`);
for (const q of dump.props.slice(0, 60)) console.log(`  (${q.x}, ${q.y}, ${q.z})  ${q.g} ${JSON.stringify(q.sz)}`);
if (dump.props.length > 60) console.log(`  … ${dump.props.length - 60} more`);

if (dump.shadows.length < 1) console.log('\n  WARNING: no cat shadow found — cannot judge the cat composition from here');

if (CAND) {
  const [cx, cz] = CAND;
  console.log(`\n── candidate (${cx}, ${cz}) ──`);
  const HALF = 0.30;                     // a milk crate's own half-extent, generous
  const inCol = dump.cols.filter((c) => cx > c[0] - HALF && cx < c[1] + HALF && cz > c[2] - HALF && cz < c[3] + HALF);
  console.log(`  inside a static collider (inflated ${HALF} m): ${inCol.length}${inCol.length ? ' ' + JSON.stringify(inCol) : ''}`);
  for (const q of dump.litter) console.log(`  ${q.kind.padEnd(20)} ${Math.hypot(cx - q.x, cz - q.z).toFixed(2)} m away`);
  for (const c of dump.shadows) console.log(`  cat                  ${Math.hypot(cx - c.x, cz - c.z).toFixed(2)} m away`);
}
await b.close();
