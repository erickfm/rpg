// Item 266 (2) — STAND IN THE VAULT AND LOOK AT THE CONCRETE.
//
// The row is explicit that this half *"needs a LOOK, not just a measurement, and
// a before/after from a standing position inside the bank"* — because the
// concrete carries form-board bands and a repeat change can shift where they
// land. So: three stations inside the strongroom, at eye height, on the built
// bundle.
//
// Stations are DERIVED from the safe-deposit nests themselves — the only three
// 1.95 m-tall boxes 0.16 m thick in the world — so the camera follows the vault
// if anyone moves it (BUILDER-BRIEF §8).
//
//   SHOT_URL=http://localhost:4750/ TAG=before node scripts/probes/w119-266-vault-shot.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4750/');
const TAG = process.env.TAG ?? 'now';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await waitPainted(p);
await p.waitForTimeout(600);

const nests = await p.evaluate(() => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    const g = o.geometry && o.geometry.parameters;
    // A BOX, 1.95 m tall, 0.16 m thick — and `depth` must EXIST, because a
    // PlaneGeometry reports `height` too and the first cut of this probe walked
    // the camera to a 7.68 m plane in the casino and a 1.10 m one in the
    // apartment. It also has to be in the bank: interiors are laid out along +x
    // and the bank's is the block past 400.
    if (!g || g.height === undefined || g.depth === undefined || g.depth === null) return;
    if (Math.abs(g.height - 1.95) > 1e-4) return;
    if (Math.abs(g.width - 0.16) > 1e-4 && Math.abs(g.depth - 0.16) > 1e-4) return;
    if (!(o.position.x > 400) && !(o.parent && o.parent.position.x > 400)) {
      o.updateWorldMatrix(true, false);
      const w = new o.position.constructor().setFromMatrixPosition(o.matrixWorld);
      if (w.x < 400) return;
    }
    o.updateWorldMatrix(true, false);
    const v = new o.position.constructor().setFromMatrixPosition(o.matrixWorld);
    out.push({ x: +v.x.toFixed(2), y: +v.y.toFixed(2), z: +v.z.toFixed(2),
               dims: [g.width, g.height, g.depth] });
  });
  return out;
});
console.log('safe-deposit nests:', JSON.stringify(nests));
if (!nests.length) { console.error('no nest found — is the bank interior built?'); await b.close(); process.exit(3); }

const cx = nests.reduce((a, n) => a + n.x, 0) / nests.length;
const cz = nests.reduce((a, n) => a + n.z, 0) / nests.length;
const floor = +(nests[0].y - 1.95 / 2 - 0.02).toFixed(2);   // the nests stand ON the floor
console.log(`vault centre ~(${cx.toFixed(2)}, ${cz.toFixed(2)}), floor y ${floor}`);

// STAND IN THE MIDDLE AND TURN, rather than walking up to each nest. The first
// cut stood 1.1 m off a nest and the bronze doors filled the whole frame — and
// the bronze doors are the ONE face of that box item 266 does not touch. What
// has to be visible is the concrete: the nest's top edge, its ends, and the
// vault wall behind, all in the same picture as a wall for scale.
let i = 0;
for (const [name, yaw, pitch] of [
  ['nests-w', Math.atan2(nests[0].x - cx, -(nests[0].z - cz)), -0.10],
  ['nests-n', Math.atan2(nests[1].x - cx, -(nests[1].z - cz)), -0.10],
  ['nests-e', Math.atan2(nests[2].x - cx, -(nests[2].z - cz)), -0.10],
  ['tops', Math.atan2(nests[1].x - cx, -(nests[1].z - cz)), 0.34],
  ['wall', Math.atan2(nests[1].x - cx, -(nests[1].z - cz)) + Math.PI, 0.02],
]) {
  i++;
  await p.evaluate(([sx, sz, yaw, gy, pitch]) => {
    // yaw convention measured in probes/w119-249-aim.mjs: dir = (sin yaw, -cos yaw)
    window.__ct.warp(sx, sz, yaw, gy, pitch);
  }, [cx, cz, yaw, floor, pitch]);
  await p.waitForTimeout(1800);           // GOTCHAS 51: a storey change takes ~1.5 s
  const path = `shots/w119-266-vault-${TAG}-${i}-${name}.png`;
  await p.screenshot({ path });
  console.log(`-> ${path}   from the vault centre, yaw ${yaw.toFixed(2)} pitch ${pitch}`);
}
console.log(`console errors: ${errs.length}`);
await b.close();
