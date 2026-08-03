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
    const isHandle = t === 'TorusGeometry' && Math.abs(gp.radius - 0.026) < 1e-3;
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
const handle = out.find((o) => o.kind === 'handle');
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
// and does it actually touch the cup?
const bodyR = body.params.radiusTop;
const handleNear = offLen - (handle.params.radius + handle.params.tube);
const handleFar = offLen + handle.params.radius + handle.params.tube;
console.log(`  body radius ${f(bodyR)};  handle spans ${f(handleNear)}…${f(handleFar)} m from the axis`);
console.log(`  ATTACHED: ${handleNear <= bodyR ? 'yes, it overlaps the wall' : `NO — a ${f(handleNear - bodyR)} m AIR GAP between cup wall and handle`}`);

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
  console.log(`  handle lowest y ${f(handle.bb.y0)}  (${f(handle.bb.y0 - sill.bb.y1)} above sill top)`);
}
console.log('');
await b.close();
