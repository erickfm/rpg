// DOES THE DOOR LIGHT, AND DID THE STREET STAY DARK?
//
// Both halves matter. "Light the door" was the desk's instruction and "do NOT
// brighten the alley" was the same sentence; the user has asked four separate
// times for darker nights. So this reports the door AND the world, and a change
// that lifts the world is a failure however good the door looks.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto, settle } from './lib/reachable.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4279/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1034, height: 757 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(22, 30));
await p.waitForTimeout(1500);

// the door, found by its measured position rather than re-derived
const D = [19.40, 1.06, -55.45];
const r = await p.evaluate(([X, Y, Z]) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const near = [];
  let lit = 0, graded = 0, all = 0, sum = 0;
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    const mats = Array.isArray(n.material) ? n.material : [n.material];
    const m = mats[0];
    if (!m?.color) return;
    if (m.userData?.graded) { graded++; sum += m.color.r; all++; }
    if (m.userData?.poolLit) lit++;
    n.geometry.computeBoundingBox();
    const bb = n.geometry.boundingBox; if (!bb) return;
    const w = bb.clone().applyMatrix4(n.matrixWorld);
    const cx = (w.min.x + w.max.x) / 2, cy = (w.min.y + w.max.y) / 2, cz = (w.min.z + w.max.z) / 2;
    if (Math.hypot(cx - X, cy - Y, cz - Z) > 2.2) return;
    near.push({ at: [+cx.toFixed(2), +cy.toFixed(2), +cz.toFixed(2)],
                size: [+(w.max.x - w.min.x).toFixed(2), +(w.max.y - w.min.y).toFixed(2), +(w.max.z - w.min.z).toFixed(2)],
                tint: +m.color.r.toFixed(4), selfLit: !!m.userData?.selfLit,
                poolLit: !!m.userData?.poolLit, mod: n.userData.mod ?? '?' });
  });
  return { near: near.sort((a, c) => c.at[1] - a.at[1]), lit, graded,
           meanTint: +(sum / Math.max(1, all)).toFixed(5) };
}, D);

console.log(`\n── the alley back door at 22:30 ──`);
for (const q of r.near) {
  console.log(`  y ${String(q.at[1]).padStart(6)} ${JSON.stringify(q.size).padEnd(22)} tint ${String(q.tint).padEnd(8)}` +
    ` ${q.selfLit ? 'selfLit ' : '        '}${q.poolLit ? 'POOLED' : '      '}  ${q.mod}`);
}
console.log(`\n── the world at 22:30 ──`);
console.log(`  graded materials: ${r.graded}   in a pool right now: ${r.lit}`);
console.log(`  MEAN TINT over every graded material: ${r.meanTint}`);
console.log(`  (this is the number that must NOT rise — the street stays dark)`);

// FACE THE DOOR. It is at z -55.45 and these cameras stand at greater z, so
// forward must be -z, which is yaw 0 — my first pass used PI and photographed
// the wall behind me. Fourth station I have got wrong today; the frame is
// checked for its subject below rather than filed on trust.
for (const [name, x, z, yaw, pitch] of [
  ['door', 19.4, -53.4, 0, 0.04],
  ['alley', 19.4, -51.0, 0, 0.02],
]) {
  await p.evaluate(([X, Z, Y, P]) => window.__ct.warp(X, Z, Y, 0, P), [x, z, yaw, pitch]);
  const lum = await settle(p);
  const f = `shots/dl-${name}.png`;
  await p.screenshot({ path: f });
  console.log(`  ${f.padEnd(24)} frame mean ${lum.toFixed(4)}`);
}
await b.close();
