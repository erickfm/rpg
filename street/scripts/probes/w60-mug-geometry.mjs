// ITEM 108 — is the desk's diagnosis of the flat-301 mug true?
//
// The item asserts four things. This measures all four out of the running
// world rather than out of the source, because the source is what I am about
// to change and a claim about a shared material is a claim about the built
// scene graph:
//
//   1. body and handle SHARE ONE MATERIAL          → same material .uuid?
//   2. the handle ring is too coarse to read round → tubularSegments
//   3. it IS rotated correctly, do not chase it    → is the ring's plane the
//      one that contains the mug's axis AND the direction the handle sticks
//      out? That is the only orientation a real handle can have.
//   4. it sits proud of the sill edge              → footing, in world y/x/z
//
// Subjects are found by geometry signature, never by a coordinate I typed.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4184/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 740 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const out = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const grab = [];
  s.traverse((n) => {
    if (!n.isMesh || !n.geometry) return;
    const t = n.geometry.type, gp = n.geometry.parameters || {};
    const isBody = t === 'CylinderGeometry'
      && Math.abs(gp.radiusTop - 0.038) < 1e-4 && Math.abs(gp.height - 0.095) < 1e-4;
    // ANY small torus up on the third floor near the window — pinning this to
    // the exact 0.026 it happened to have would make the probe stop finding
    // the handle the moment the handle changed, which is the one moment it is
    // needed. Narrowed to the mug's own neighbourhood below.
    const isHandle = t === 'TorusGeometry' && gp.radius < 0.05;
    // the sill: a 0.22 x 0.045 x 1.52 box up on the third floor
    const isSill = t === 'BoxGeometry'
      && Math.abs(gp.width - 0.22) < 1e-4 && Math.abs(gp.height - 0.045) < 1e-4;
    if (!isBody && !isHandle && !isSill) return;
    const g = n.geometry; g.computeBoundingBox();
    const bb = g.boundingBox.clone().applyMatrix4(n.matrixWorld);
    const m = Array.isArray(n.material) ? n.material[0] : n.material;
    const e = n.matrixWorld.elements;
    const pos = { x: e[12], y: e[13], z: e[14] };
    // the ring's own plane: for a TorusGeometry the hole axis is LOCAL +z, so
    // the plane the ring lies in is the one perpendicular to world(local +z).
    // Local +z in world is the third basis column of matrixWorld, normalised.
    const hl = Math.hypot(e[8], e[9], e[10]) || 1;
    const holeAxis = { x: e[8] / hl, y: e[9] / hl, z: e[10] / hl };
    grab.push({
      kind: isBody ? 'body' : isHandle ? 'handle' : 'sill',
      type: t, params: gp,
      matUuid: m ? m.uuid : null,
      color: m && m.color ? '#' + m.color.getHexString() : null,
      pos, holeAxis,
      bb: { x0: bb.min.x, x1: bb.max.x, y0: bb.min.y, y1: bb.max.y, z0: bb.min.z, z1: bb.max.z },
    });
  });
  return grab;
});

const f = (n) => n.toFixed(4);
const body = out.find((o) => o.kind === 'body');
const near = (o) => Math.hypot(o.pos.x - body.pos.x, o.pos.y - body.pos.y, o.pos.z - body.pos.z);
const handle = body && out.filter((o) => o.kind === 'handle' && near(o) < 0.2)
  .sort((a, c) => near(a) - near(c))[0];
// the sill under the mug is the one whose span contains the mug in x and z
const sill = out.filter((o) => o.kind === 'sill')
  .find((o) => body && o.bb.x0 - 0.2 < body.pos.x && o.bb.x1 + 0.2 > body.pos.x
    && o.bb.z0 < body.pos.z && o.bb.z1 > body.pos.z);

if (!body || !handle) { console.error('MISS: body or handle not found'); process.exit(3); }

console.log('\n── 1. shared material ─────────────────────────────────────');
console.log(`  body   mat ${body.matUuid}  ${body.color}`);
console.log(`  handle mat ${handle.matUuid}  ${handle.color}`);
console.log(`  SHARE ONE MATERIAL: ${body.matUuid === handle.matUuid ? 'YES — as the item says' : 'no'}`);

console.log('\n── 2. ring coarseness ─────────────────────────────────────');
console.log(`  torus radialSegments (tube cross-section) = ${handle.params.radialSegments}`);
console.log(`  torus tubularSegments (the ring itself)   = ${handle.params.tubularSegments}`);
console.log(`  body radial segments                      = ${body.params.radialSegments}`);

console.log('\n── 3. orientation: can this handle be attached at all? ────');
const off = { x: handle.pos.x - body.pos.x, y: handle.pos.y - body.pos.y, z: handle.pos.z - body.pos.z };
const offLen = Math.hypot(off.x, off.z);
console.log(`  handle centre is offset from the body axis by (${f(off.x)}, ${f(off.z)}) = ${f(offLen)} m`);
// a real handle's ring plane CONTAINS the offset direction; the hole axis is
// therefore PERPENDICULAR to it. dot ~ 0 = correct, dot ~ 1 = ring turned 90°.
const dot = Math.abs((off.x * handle.holeAxis.x + off.z * handle.holeAxis.z) / (offLen || 1));
console.log(`  hole axis in world = (${f(handle.holeAxis.x)}, ${f(handle.holeAxis.y)}, ${f(handle.holeAxis.z)})`);
console.log(`  |hole axis · offset dir| = ${f(dot)}   (0 = ring plane holds the offset: a real handle)`);
console.log(`                                          (1 = ring turned across the offset: a hoop stuck on the side)`);
// DOES IT ACTUALLY TOUCH THE CUP? The first version of this line computed
// `offset - (R + tube)` — which silently assumes the ring extends along the
// offset direction. When the ring is turned 90° across it, as this one was, it
// extends nowhere near that far and the formula printed "ATTACHED: yes" over a
// 9 mm gap. So sample the ring's real centreline in the real world instead.
const reach = await p.evaluate((want) => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let hit = null;
  s.traverse((n) => {
    if (!n.isMesh || n.geometry?.type !== 'TorusGeometry') return;
    const e = n.matrixWorld.elements;
    if (Math.hypot(e[12] - want.x, e[13] - want.y, e[14] - want.z) > 0.02) return;
    const R = n.geometry.parameters.radius, tube = n.geometry.parameters.tube;
    const V = window.__ct.camera().position.constructor;
    let lo = Infinity, hi = -Infinity, loY = Infinity, hiY = -Infinity;
    for (let i = 0; i < 128; i++) {
      const th = (i / 128) * Math.PI * 2;
      // TorusGeometry's centreline is (R cos t, R sin t, 0) in local space
      const pt = new V(R * Math.cos(th), R * Math.sin(th), 0).applyMatrix4(n.matrixWorld);
      const d = Math.hypot(pt.x - want.bx, pt.z - want.bz);   // horizontal, from the cup axis
      lo = Math.min(lo, d); hi = Math.max(hi, d);
      loY = Math.min(loY, pt.y); hiY = Math.max(hiY, pt.y);
    }
    hit = { lo: lo - tube, hi: hi + tube, loY: loY - tube, hiY: hiY + tube,
      holeLo: lo + tube, holeHi: hi - tube };
  });
  return hit;
}, { x: handle.pos.x, y: handle.pos.y, z: handle.pos.z, bx: body.pos.x, bz: body.pos.z });

const bodyR = body.params.radiusTop, bodyRLo = body.params.radiusBottom;
console.log(`  cup wall stands at ${f(bodyRLo)}…${f(bodyR)} m from its own axis`);
if (!reach) console.log('  could not sample the ring');
else {
  console.log(`  the ring reaches ${f(reach.lo)}…${f(reach.hi)} m from that axis`);
  console.log(`  ATTACHED: ${reach.lo <= bodyR
    ? `yes — the ring passes ${f(bodyR - reach.lo)} m THROUGH the cup wall`
    : `NO — a ${f(reach.lo - bodyR)} m AIR GAP between cup wall and handle`}`);
  console.log(`  it stands ${f(reach.hi - bodyR)} m proud of the cup — that is the silhouette`);
  const clear = reach.holeLo >= bodyR;
  console.log(`  the HOLE spans ${f(reach.holeLo)}…${f(reach.holeHi)} from the axis: `
    + `${clear ? `clear of the cup wall, ${f(reach.holeHi - reach.holeLo)} m of daylight`
      : 'PARTLY BEHIND THE CUP — the hole will not read'}`);
}

console.log('\n── 4. footing on the sill ─────────────────────────────────');
if (!sill) console.log('  sill not found under the mug');
else {
  console.log(`  sill top y      ${f(sill.bb.y1)}`);
  console.log(`  mug bottom y    ${f(body.bb.y0)}   (${f(body.bb.y0 - sill.bb.y1)} m above the sill top)`);
  console.log(`  sill x span     ${f(sill.bb.x0)} … ${f(sill.bb.x1)}`);
  const grp = { x0: Math.min(body.bb.x0, handle.bb.x0), x1: Math.max(body.bb.x1, handle.bb.x1) };
  console.log(`  mug+handle x    ${f(grp.x0)} … ${f(grp.x1)}`);
  const over = grp.x1 - sill.bb.x1;
  console.log(`  OVERHANG past the sill's room edge: ${f(over)} m ${over > 0 ? '— PROUD, as the item says' : '— none, it is on the sill'}`);
  // the handle now hangs along the sill rather than into the room, so the z
  // ends are the edge it could fall off
  const gz = { z0: Math.min(body.bb.z0, handle.bb.z0), z1: Math.max(body.bb.z1, handle.bb.z1) };
  console.log(`  sill z span     ${f(sill.bb.z0)} … ${f(sill.bb.z1)}`);
  console.log(`  mug+handle z    ${f(gz.z0)} … ${f(gz.z1)}`);
  const zOver = Math.max(sill.bb.z0 - gz.z0, gz.z1 - sill.bb.z1);
  console.log(`  clearance to the nearer sill END: ${f(-zOver)} m `
    + `${zOver > 0 ? '*** OVERHANGS THE END ***' : '— fully on the sill'}`);
  console.log(`  handle lowest y ${f(handle.bb.y0)}  (${f(handle.bb.y0 - sill.bb.y1)} above sill top)`);
}
console.log('');
await b.close();
