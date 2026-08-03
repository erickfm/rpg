// prop-landing.mjs reports the alley cardboard authored at (-9.40, -42.40) as
// having been shoved 0.068 m with nothing there to explain it. Before believing
// a check over the world (BUILDER-BRIEF §7: half of all "defects" here are the
// instrument), find out what is ACTUALLY at that coordinate — every mesh whose
// box comes near it, with the gate it passes or fails printed beside it.
//
//   SHOT_URL=http://localhost:4360/ node scripts/probes/w80-what-moved-the-cardboard.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4360/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1024, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await p.waitForTimeout(400);

const out = await p.evaluate(() => {
  const boxOf = (m) => {
    m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox;
    if (!bb) return null;
    m.updateMatrixWorld(true);
    const e = m.matrixWorld.elements;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const cx of [bb.min.x, bb.max.x]) for (const cy of [bb.min.y, bb.max.y]) for (const cz of [bb.min.z, bb.max.z]) {
      const v = [e[0] * cx + e[4] * cy + e[8] * cz + e[12],
                 e[1] * cx + e[5] * cy + e[9] * cz + e[13],
                 e[2] * cx + e[6] * cy + e[10] * cz + e[14]];
      for (let i = 0; i < 3; i++) { if (v[i] < lo[i]) lo[i] = v[i]; if (v[i] > hi[i]) hi[i] = v[i]; }
    }
    return { lo, hi };
  };
  const union = (a, c) => a == null ? c : {
    lo: [Math.min(a.lo[0], c.lo[0]), Math.min(a.lo[1], c.lo[1]), Math.min(a.lo[2], c.lo[2])],
    hi: [Math.max(a.hi[0], c.hi[0]), Math.max(a.hi[1], c.hi[1]), Math.max(a.hi[2], c.hi[2])],
  };
  const isLitter = (o) => { for (let u = o; u; u = u.parent) if (u.userData?.litter) return true; return false; };
  const path = (o) => { const s = []; for (let u = o; u; u = u.parent) s.unshift(u.name || u.type); return s.slice(-4).join('/'); };

  const scene = window.__ct.scene();
  let target = null;
  scene.traverse((o) => {
    if (o.userData?.litter !== 'flattened cardboard') return;
    if (Math.abs((o.userData.placedX ?? 1e9) - (-9.40)) > 1e-6) return;
    let box = null;
    o.traverse((m) => { if (m.isMesh && m.geometry) box = union(box, boxOf(m)); });
    const w = o.getWorldPosition(new o.position.constructor());
    target = { box, landedX: w.x, landedZ: w.z, placedX: o.userData.placedX, placedZ: o.userData.placedZ };
  });
  if (!target) return { target: null };

  const dx = target.landedX - target.placedX, dz = target.landedZ - target.placedZ;
  const back = { lo: [target.box.lo[0] - dx, target.box.lo[1], target.box.lo[2] - dz],
                 hi: [target.box.hi[0] - dx, target.box.hi[1], target.box.hi[2] - dz] };

  // everything within 1 m of the put-back box, whatever gate it passes
  const near = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (isLitter(o)) return;
    const bx = boxOf(o);
    if (!bx || !Number.isFinite(bx.lo[0])) return;
    const gapX = Math.max(back.lo[0] - bx.hi[0], bx.lo[0] - back.hi[0]);
    const gapZ = Math.max(back.lo[2] - bx.hi[2], bx.lo[2] - back.hi[2]);
    const gapY = Math.max(back.lo[1] - bx.hi[1], bx.lo[1] - back.hi[1]);
    if (gapX > 1 || gapZ > 1) return;
    const h = bx.hi[1] - bx.lo[1];
    near.push({
      what: path(o), h: +h.toFixed(3), x: [+bx.lo[0].toFixed(3), +bx.hi[0].toFixed(3)], z: [+bx.lo[2].toFixed(3), +bx.hi[2].toFixed(3)],
      y: [+bx.lo[1].toFixed(3), +bx.hi[1].toFixed(3)],
      gapX: +gapX.toFixed(3), gapY: +gapY.toFixed(3), gapZ: +gapZ.toFixed(3),
      spanX: +(bx.hi[0] - bx.lo[0]).toFixed(2), spanZ: +(bx.hi[2] - bx.lo[2]).toFixed(2),
      gateH: h >= 0.25, gateHigh: bx.lo[1] <= 1.6, gateBig: !(bx.hi[0] - bx.lo[0] > 40 || bx.hi[2] - bx.lo[2] > 60),
      overlaps3D: gapX < 0 && gapY < 0 && gapZ < 0,
    });
  });
  near.sort((a, c) => (a.gapX + a.gapZ) - (c.gapX + c.gapZ));
  return { target: { ...target, dx, dz, back }, near: near.slice(0, 25), total: near.length };
});

if (!out.target) { console.error('target cardboard not found'); process.exit(3); }
const t = out.target;
console.log(`\ncardboard placed (${t.placedX}, ${t.placedZ}) landed (${t.landedX.toFixed(3)}, ${t.landedZ.toFixed(3)})`
  + `  delta (${t.dx.toFixed(3)}, ${t.dz.toFixed(3)})`);
console.log(`put-back box  x ${t.back.lo[0].toFixed(3)}…${t.back.hi[0].toFixed(3)}`
  + `  y ${t.back.lo[1].toFixed(3)}…${t.back.hi[1].toFixed(3)}`
  + `  z ${t.back.lo[2].toFixed(3)}…${t.back.hi[2].toFixed(3)}`);
console.log(`\n${out.total} non-litter meshes within 1 m in plan; nearest 25:\n`);
console.log('what                                     h      y-range        gapX   gapY   gapZ  H high big 3D');
for (const n of out.near) {
  console.log(`  x ${String(n.x[0]).padStart(8)}…${String(n.x[1]).padStart(8)}  z ${String(n.z[0]).padStart(8)}…${String(n.z[1]).padStart(8)}`);
  console.log(`${n.what.slice(0, 38).padEnd(40)} ${String(n.h).padStart(5)}  `
    + `${String(n.y[0]).padStart(6)}…${String(n.y[1]).padStart(6)} `
    + `${String(n.gapX).padStart(6)} ${String(n.gapY).padStart(6)} ${String(n.gapZ).padStart(6)}  `
    + `${n.gateH ? 'Y' : '.'}  ${n.gateHigh ? 'Y' : '.'}   ${n.gateBig ? 'Y' : '.'}  ${n.overlaps3D ? 'YES' : '.'}`);
}
await b.close();
