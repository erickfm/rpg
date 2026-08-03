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

  // ── CORRECTED 2026-08-03, item 246 (worker ninetythree) ──────────────────
  //
  // THIS BLOCK USED TO PRINT A FALSE CONCLUSION AND IT IS WORTH SAYING WHY,
  // because the shape of the mistake is commoner than the mistake.
  //
  //     const clear = reach.holeLo >= bodyR;
  //     ... : 'PARTLY BEHIND THE CUP — the hole will not read'
  //
  // `holeLo`/`holeHi` are the hole's RADIAL SPAN — the nearest and farthest the
  // daylight gets from the cup's axis, one number each. `holeLo >= bodyR`
  // therefore asks "is EVERY LAST MILLIMETRE of the hole clear of the cup", and
  // any hole overlapping the cup silhouette by a hair failed it. The verdict it
  // printed was not "some of the hole is behind the cup" — it was **"the hole
  // will not read"**, a claim about what a player SEES, drawn from a 1-D span
  // test that cannot see anything. On this world it fires at **76.2% of the
  // span open** and, by area, **81.7% of the hole open**. That verdict is what
  // the next builder reads before touching a mug that has already cost three
  // user reports, and it would have sent them to re-cut a handle that is fine.
  //
  // (I first derived 81.7% by hand, against a straight 0.038 m cylinder. The
  // sampler says 85.9%, and the sampler is right: the cup TAPERS — 0.034 m at
  // the foot, 0.038 m at the rim — so the lower half of the hole clears more
  // than a constant-radius sum credits it with. `rAt(y)` interpolates it.)
  //
  // The honest measurement is an AREA, and it is taken in the world rather than
  // argued: sample the hole's disc, and for each sample cast along the hole
  // axis — the direction you must look to see through a ring — and ask whether
  // that sightline is blocked by the cup's own cylinder. A number, not a verdict.
  const HOLE_READS = 0.35;         // declared, and self-tested below in both signs
  const occ = await p.evaluate((want) => {
    const s = window.__ct.scene(); s.updateMatrixWorld(true);
    let out = null;
    s.traverse((n) => {
      if (!n.isMesh || n.geometry?.type !== 'TorusGeometry') return;
      const e = n.matrixWorld.elements;
      if (Math.hypot(e[12] - want.x, e[13] - want.y, e[14] - want.z) > 0.02) return;
      const R = n.geometry.parameters.radius, tube = n.geometry.parameters.tube;
      const rHole = R - tube;                        // the daylight disc's radius
      if (rHole <= 0) { out = { rHole }; return; }
      const V = window.__ct.camera().position.constructor;
      // local +z is the hole axis; in world it is the third basis column
      const hl = Math.hypot(e[8], e[9], e[10]) || 1;
      const ax = e[8] / hl, az = e[10] / hl;         // horizontal part of the axis
      // The cup is a vertical cylinder: radius interpolates radiusBottom→
      // radiusTop over its height, so a sample near the rim is tested against
      // the rim's radius and not against a single number typed once.
      const rAt = (y) => {
        const t = Math.min(1, Math.max(0, (y - want.y0) / (want.y1 - want.y0)));
        return want.rBot + (want.rTop - want.rBot) * t;
      };
      // AREA-FAIR SAMPLING. A polar grid stepping uniformly in radius
      // over-weights the middle of the disc, which is exactly the part the cup
      // hides — so it would flatter or damn the answer depending on which side
      // the cup is on. r = rHole*sqrt(u) is uniform by area.
      const N = 20000;
      let open = 0, seen = 0;
      for (let i = 0; i < N; i++) {
        // deterministic low-discrepancy pair, so two runs agree exactly
        const u = (i + 0.5) / N;
        const r = rHole * Math.sqrt(u);
        const th = i * 2.399963229728653;            // golden angle
        const pt = new V(r * Math.cos(th), r * Math.sin(th), 0).applyMatrix4(n.matrixWorld);
        seen++;
        if (pt.y < want.y0 || pt.y > want.y1) { open++; continue; }   // above/below the cup entirely
        // perpendicular distance, in the horizontal plane, from the cup's axis
        // to the sightline through `pt` along the hole axis
        const dx = pt.x - want.bx, dz = pt.z - want.bz;
        const cross = Math.abs(dx * az - dz * ax);   // |(P−C) × A|, A unit-ish in plane
        const alen = Math.hypot(ax, az);
        const perp = alen > 1e-6 ? cross / alen : Math.hypot(dx, dz);
        if (perp > rAt(pt.y)) open++;
      }
      out = { rHole, open, seen, frac: open / seen, scale: want.scale };
    });
    return out;
  }, { x: handle.pos.x, y: handle.pos.y, z: handle.pos.z, bx: body.pos.x, bz: body.pos.z,
       y0: body.bb.y0, y1: body.bb.y1, rTop: bodyR, rBot: bodyRLo, scale: 1 });

  const spanOpen = (reach.holeHi - Math.max(reach.holeLo, bodyR)) / (reach.holeHi - reach.holeLo);
  console.log(`  the HOLE spans ${f(reach.holeLo)}…${f(reach.holeHi)} m from the cup axis`);
  console.log(`    of that RADIAL SPAN, ${(spanOpen * 100).toFixed(1)}% clears the ${f(bodyR)} m cup wall`);
  if (!occ || occ.seen === undefined) console.log('    could not sample the hole disc');
  else {
    console.log(`    of the hole's AREA, ${(occ.frac * 100).toFixed(1)}% has a clear sightline `
      + `through it (${occ.open}/${occ.seen} samples along the hole axis)`);
    console.log(`  DOES THE HOLE READ: ${occ.frac >= HOLE_READS
      ? `YES — ${(occ.frac * 100).toFixed(1)}% open, against a ${(HOLE_READS * 100).toFixed(0)}% bar`
      : `NO — only ${(occ.frac * 100).toFixed(1)}% open, under the ${(HOLE_READS * 100).toFixed(0)}% bar`}`);
    // POPULATION FLOOR. An area fraction over an empty sample set is 0/0, and
    // "the hole does not read" is exactly the wrong thing to say about a hole
    // nobody looked at. (GOTCHAS 34.)
    if (occ.seen < 1000) {
      console.error(`  SAMPLE FLOOR: only ${occ.seen} points on the hole disc — nothing was measured`);
      await b.close(); process.exit(3);
    }
  }

  // ── SELF-TEST, BOTH SIGNS ────────────────────────────────────────────────
  // §27/§34: a check nobody has watched fail is a check you will argue with,
  // and an occlusion test is the kind that passes for free when it is looking
  // at nothing. Re-run the same sampler against a cup swollen to 20x and
  // against a cup of zero radius. If the fraction does not go to ~0 and ~1,
  // this probe is not measuring occlusion and its number above means nothing.
  const trial = async (rTop, rBot) => (await p.evaluate((want) => {
    const s = window.__ct.scene(); s.updateMatrixWorld(true);
    let frac = null;
    s.traverse((n) => {
      if (!n.isMesh || n.geometry?.type !== 'TorusGeometry') return;
      const e = n.matrixWorld.elements;
      if (Math.hypot(e[12] - want.x, e[13] - want.y, e[14] - want.z) > 0.02) return;
      const R = n.geometry.parameters.radius, tube = n.geometry.parameters.tube;
      const rHole = R - tube; if (rHole <= 0) return;
      const V = window.__ct.camera().position.constructor;
      const hl = Math.hypot(e[8], e[9], e[10]) || 1;
      const ax = e[8] / hl, az = e[10] / hl;
      const rAt = (y) => { const t = Math.min(1, Math.max(0, (y - want.y0) / (want.y1 - want.y0)));
        return want.rBot + (want.rTop - want.rBot) * t; };
      const N = 20000; let open = 0;
      for (let i = 0; i < N; i++) {
        const r = rHole * Math.sqrt((i + 0.5) / N), th = i * 2.399963229728653;
        const pt = new V(r * Math.cos(th), r * Math.sin(th), 0).applyMatrix4(n.matrixWorld);
        // the swollen cup is tested over the same y band, extended so a 20x
        // radius cannot be dodged by stepping above the rim
        if (pt.y < want.y0 - 1 || pt.y > want.y1 + 1) { open++; continue; }
        const dx = pt.x - want.bx, dz = pt.z - want.bz;
        const alen = Math.hypot(ax, az);
        const perp = alen > 1e-6 ? Math.abs(dx * az - dz * ax) / alen : Math.hypot(dx, dz);
        if (perp > rAt(pt.y)) open++;
      }
      frac = open / N;
    });
    return frac;
  }, { x: handle.pos.x, y: handle.pos.y, z: handle.pos.z, bx: body.pos.x, bz: body.pos.z,
       y0: body.bb.y0, y1: body.bb.y1, rTop, rBot }));
  const fat = await trial(bodyR * 20, bodyRLo * 20);
  const thin = await trial(0, 0);
  const ok = fat !== null && thin !== null && fat < 0.02 && thin > 0.98;
  console.log(`  self-test  cup x20 -> ${fat === null ? 'n/a' : (fat * 100).toFixed(1) + '% open'} (want ~0)`
    + `   cup x0 -> ${thin === null ? 'n/a' : (thin * 100).toFixed(1) + '% open'} (want ~100)`
    + `   ${ok ? 'PASS' : '*** FAIL — the occlusion number above is not trustworthy ***'}`);
  if (!ok) { await b.close(); process.exit(2); }
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
