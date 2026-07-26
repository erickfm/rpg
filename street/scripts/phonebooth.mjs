// THE PAYPHONE, MOVED TO THE ALLEY MOUTH: does it stand clear, and does it
// read as a box rather than as a printed panel?
//
// Three things a screenshot cannot tell you, so they are measured:
//   1. does its collider touch the 2 m walk? (x -7.00 … -5.06)
//   2. do the crowd's walkers ever come within reach of it?
//   3. is the header held bright after dark while the enamel grades down?
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto, settle } from './lib/reachable.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4279/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1034, height: 757 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const geo = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const parts = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.userData.payphone) return;
    n.geometry.computeBoundingBox();
    const w = n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld);
    const m = Array.isArray(n.material) ? n.material[0] : n.material;
    parts.push({ x: [+w.min.x.toFixed(2), +w.max.x.toFixed(2)],
                 y: [+w.min.y.toFixed(2), +w.max.y.toFixed(2)],
                 z: [+w.min.z.toFixed(2), +w.max.z.toFixed(2)],
                 selfLit: !!m?.userData?.selfLit, graded: !!m?.userData?.graded,
                 tint: +m.color.r.toFixed(4) });
  });
  const cols = (window.__ct.colliders ? window.__ct.colliders() : [])
    .filter((c) => c.maxX > -9 && c.minX < -6.5 && c.maxZ > -39 && c.minZ < -36);
  return { parts, cols: cols.map((c) => [+c.minX.toFixed(2), +c.maxX.toFixed(2), +c.minZ.toFixed(2), +c.maxZ.toFixed(2)]) };
});

console.log(`\n── the shelter: ${geo.parts.length} parts ──`);
let X0 = 9, X1 = -9, Y1 = -9, Z0 = 9, Z1 = -99;
for (const q of geo.parts) {
  X0 = Math.min(X0, q.x[0]); X1 = Math.max(X1, q.x[1]);
  Y1 = Math.max(Y1, q.y[1]); Z0 = Math.min(Z0, q.z[0]); Z1 = Math.max(Z1, q.z[1]);
  console.log(`  x[${q.x.join('..')}] y[${q.y.join('..')}] z[${q.z.join('..')}]`);
}
console.log(`  envelope  x ${X0}..${X1}  (${(X1 - X0).toFixed(2)} m)   z ${Z0}..${Z1}  (${(Z1 - Z0).toFixed(2)} m)   top ${Y1}`);
const WALK0 = -7.00;
console.log(`  nearest face to the walk (x = ${WALK0}): ${X1}  ->  ` +
  (X1 <= WALK0 ? `CLEAR by ${(WALK0 - X1).toFixed(2)} m` : `INTO THE LANE by ${(X1 - WALK0).toFixed(2)} m`));
console.log(`  colliders in the mouth: ${JSON.stringify(geo.cols)}`);

// ── 2. the walkers ────────────────────────────────────────────────────────
await p.evaluate(() => window.__ct.clock(17, 0));
await settle(p);
let closest = 9, who = null, samples = 0;
// A FULL MINUTE, because that is the bar the desk set: "a booth dropped into a
// walking lane will have people clipping through it within a minute." Twelve
// seconds is not that claim tested, it is that claim not yet contradicted.
for (let i = 0; i < 300; i++) {
  // walkers(), NOT people(). people() returns speeds and scales — no position
  // at all — so the first run of this probe compared NaN and reported "closest
  // approach 9.00 m at null", which is a pass it had not earned.
  const people = await p.evaluate(() => (window.__ct.walkers ? window.__ct.walkers() : [])
    .map((q) => [q.x, q.z]));
  for (const [x, z] of people) {
    samples++;
    const dx = Math.max(X0 - x, 0, x - X1), dz = Math.max(Z0 - z, 0, z - Z1);
    const d = Math.hypot(dx, dz);
    if (d < closest) { closest = d; who = [+x.toFixed(2), +z.toFixed(2)]; }
  }
  await p.waitForTimeout(200);
}
console.log(`\n── the crowd: ${samples} walker samples over 60 s ──`);
console.log(`  closest approach to the shelter: ${closest.toFixed(2)} m at ${JSON.stringify(who)}`);
console.log(`  ${closest < 0.36 ? '  <-- INSIDE THE RIG RADIUS: somebody is clipping it' : '  clear of the 0.36 m body radius'}`);

// ── 3. the night grade ────────────────────────────────────────────────────
for (const h of [13, 23]) {
  await p.evaluate(([hh]) => window.__ct.clock(hh, 0), [h]);
  await settle(p);
  const t = await p.evaluate(() => {
    const s = window.__ct.scene(); const out = [];
    s.traverse((n) => {
      if (!n.isMesh || !n.userData.payphone) return;
      const m = Array.isArray(n.material) ? n.material[0] : n.material;
      out.push({ lit: !!m.userData.selfLit, tint: +m.color.r.toFixed(4),
                 h: +(n.geometry.boundingBox.max.y - n.geometry.boundingBox.min.y).toFixed(2) });
    });
    return out;
  });
  const sign = t.filter((q) => q.lit), body = t.filter((q) => !q.lit);
  console.log(`\n  ${String(h).padStart(2)}:00  header ${sign.map((q) => q.tint).join(',') || '(none flagged)'}` +
    `   enamel ${body.map((q) => q.tint).join(',')}`);
}

// ── and look at it ────────────────────────────────────────────────────────
for (const [name, x, z, yaw, pitch] of [
  ['approach-s', -6.2, -44.0, Math.PI, -0.18],   // walking north up the west walk
  ['approach-n', -6.2, -32.0, 0, -0.18],         // walking south toward the mouth
  ['head-on',    -7.6, -40.4, Math.PI, -0.10],   // standing in the mouth, facing it
  ['from-walk',  -6.0, -38.6, Math.PI * 1.28, -0.14],
  // and the window it used to stand on, which should now be a window
  ['old-spot',   -5.8,  -3.0, Math.PI * 1.5, -0.06],
]) {
  for (const [when, h] of [['day', 13], ['night', 23]]) {
    await p.evaluate(([hh]) => window.__ct.clock(hh, 0), [h]);
    await p.evaluate(([X, Z, Y, P]) => window.__ct.warp(X, Z, Y, 0, P), [x, z, yaw, pitch]);
    const lum = await settle(p);
    const f = `shots/pb-${name}-${when}.png`;
    await p.screenshot({ path: f });
    console.log(`${f.padEnd(32)} mean ${lum.toFixed(4)}${lum < 0.02 ? '  <-- BLACK' : ''}`);
  }
}
await b.close();
