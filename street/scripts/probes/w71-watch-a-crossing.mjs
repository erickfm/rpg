// Item 201 — WATCH several citizens actually cross, and photograph them ON the
// stripes. The row: *"VERIFY BY WATCHING, over time, not from one frame — stand
// where he stood, watch several citizens approach the kerb, and confirm they
// walk to the paint and cross on it."*
//
// The percentage in `w71-where-do-they-cross.mjs` is the measurement; this is
// the looking. It stands the player on the junction, waits for a walker to be
// inside the painted rectangle, and shoots — up to N times, so it is several
// crossings and not one lucky frame.
//
// Usage: SHOT_URL=http://localhost:4270/ node scripts/probes/w71-watch-a-crossing.mjs <tag> [shots]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { aim } from '../lib/aim.mjs';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4270/');
const TAG = process.argv[2] || 'now';
const WANT = Number(process.argv[3] || 4);
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await waitPainted(p);
await p.waitForTimeout(700);

// The main-street crossing, found in the scene — same rule as the measuring
// probe, so the two cannot disagree about where the paint is.
const zebra = await p.evaluate(() => {
  let best = null;
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.geometry || o.geometry.type !== 'PlaneGeometry') return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || !m.transparent || o.userData.mod !== 'tex-ground') return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone(); bb.applyMatrix4(o.matrixWorld);
    if (bb.max.y > 0.25 || bb.max.z > -80) return;
    if (bb.max.x - bb.min.x < 8) return;          // the MAIN street one spans the carriageway
    best = { x: [bb.min.x, bb.max.x], z: [bb.min.z, bb.max.z] };
  });
  return best;
});
if (!zebra) { console.error('no main-street crossing paint found'); await b.close(); process.exit(3); }
console.log(`main crossing paint: x ${zebra.x.map((v) => v.toFixed(2))}  z ${zebra.z.map((v) => v.toFixed(2))}`);

// Stand back up the east pavement and LOOK AT THE CROSSING. The heading is
// DERIVED from the two points, not typed: the rig's convention is
// fwd = (sin yaw, -cos yaw), so yaw = atan2(dx, -dz). Guessing it is how worker
// sixtyeight walked five routes into a wall, and my own first cut of this probe
// faced 180 degrees away and photographed a doorway.
const EYE = { x: 6.5, z: -80 };
const aimAt = { x: (zebra.x[0] + zebra.x[1]) / 2, z: (zebra.z[0] + zebra.z[1]) / 2 };
const yaw = Math.atan2(aimAt.x - EYE.x, -(aimAt.z - EYE.z));
console.log(`standing at (${EYE.x}, ${EYE.z}) looking at (${aimAt.x.toFixed(2)}, ${aimAt.z.toFixed(2)}), yaw ${yaw.toFixed(3)}`);
const gy = await p.evaluate((e) => window.__ct.groundAt(e.x, e.z), EYE);
await p.evaluate(([x, z, y, g]) => window.__ct.warp(x, z, y, g, 0), [EYE.x, EYE.z, yaw, gy]);
await p.waitForTimeout(600);

const walkersOnPaint = () => p.evaluate((zz) => {
  const cits = window.__ct.actorColliders().filter((c) =>
    Math.abs((c.maxX - c.minX) - 0.5) < 1e-6 && Math.abs((c.maxZ - c.minZ) - 0.5) < 1e-6);
  return cits.filter((c) => {
    const x = (c.minX + c.maxX) / 2, z = (c.minZ + c.maxZ) / 2;
    return x > zz.x[0] && x < zz.x[1] && z > zz.z[0] && z < zz.z[1];
  }).map((c) => [+((c.minX + c.maxX) / 2).toFixed(2), +((c.minZ + c.maxZ) / 2).toFixed(2)]);
}, zebra);

let got = 0, waited = 0;
while (got < WANT && waited < 300) {
  const on = await walkersOnPaint();
  if (on.length) {
    got++;
    const f = `shots/w71-crossing-${TAG}-${got}.png`;
    await p.screenshot({ path: f });
    console.log(`shot ${got}: ${on.length} walker(s) on the stripes at ${JSON.stringify(on)} -> ${f}`);
    await p.waitForTimeout(4000);           // let them clear before counting the next
    waited += 4;
  } else { await p.waitForTimeout(1000); waited += 1; }
}
console.log(got >= WANT
  ? `WATCHED ${got} separate crossings land on the paint`
  : `only ${got} of ${WANT} in ${waited} s — not enough to conclude from`);
await b.close();
process.exit(got >= WANT ? 0 : 1);
