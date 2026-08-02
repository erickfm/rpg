// w4 — item 5c, "used car sign is completely flat".
//
// Asserts the pole sign now has a solid CABINET between its two artwork
// faces, not just two zero-thickness planes with air between them. Finds the
// cabinet by NAME ('lot-pole-sign-cabinet', set at ct/lot.ts) rather than by
// guessing at a bounding box — GOTCHAS 20, "aim from the source, not from
// memory". Structural check first (does the mesh exist with real depth,
// positioned strictly between the two faces so nothing is coplanar / z-
// fighting per GOTCHAS 6), then screenshots for LOOKING (never for proving —
// GOTCHAS 1) from edge-on and from below, the two angles the item said read
// as paper.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';

const URL = aim('http://localhost:4184/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await afterFrames(p, 10); await p.waitForTimeout(1000);

const info = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const byName = (n) => { let f = null; s.traverse((o) => { if (o.name === n) f = o; }); return f; };
  const cab = byName('lot-pole-sign-cabinet');
  const streetFace = byName('lot-pole-sign-street');
  const lotFace = byName('lot-pole-sign-lot');
  if (!cab || !streetFace || !lotFace) return { found: false, cab: !!cab, streetFace: !!streetFace, lotFace: !!lotFace };
  const bbOf = (o) => {
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    return o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
  };
  const cb = bbOf(cab), sf = bbOf(streetFace), lf = bbOf(lotFace);
  return {
    found: true,
    cabinet: { minX: +cb.min.x.toFixed(3), maxX: +cb.max.x.toFixed(3), depth: +(cb.max.x - cb.min.x).toFixed(3),
      minY: +cb.min.y.toFixed(2), maxY: +cb.max.y.toFixed(2), minZ: +cb.min.z.toFixed(2), maxZ: +cb.max.z.toFixed(2) },
    streetFaceX: +((sf.min.x + sf.max.x) / 2).toFixed(3),
    lotFaceX: +((lf.min.x + lf.max.x) / 2).toFixed(3),
    lotSign: s.userData.lotSign ? { centre: s.userData.lotSign.centre, size: s.userData.lotSign.size } : null,
  };
});

if (!info.found) {
  console.error(`CANNOT ANSWER — cabinet=${info.cab} streetFace=${info.streetFace} lotFace=${info.lotFace}`);
  process.exit(3);
}

console.log('cabinet bbox:', info.cabinet);
console.log('street face x:', info.streetFaceX, ' lot face x:', info.lotFaceX);

let fail = false;
// 1. the cabinet must have real depth, not be a degenerate/zero-thickness box
if (info.cabinet.depth < 0.2) { console.log(`FAIL  cabinet depth ${info.cabinet.depth} m — still reads as paper`); fail = true; }
else console.log(`OK    cabinet has ${info.cabinet.depth} m of depth`);

// 2. the cabinet must sit STRICTLY BETWEEN the two faces (no coplanar / no
//    poking through either face — GOTCHAS 6, overlapping coplanar surfaces
//    z-fight, and a cabinet longer than the face gap would show through the
//    artwork from the side)
const lo = Math.min(info.streetFaceX, info.lotFaceX), hi = Math.max(info.streetFaceX, info.lotFaceX);
if (info.cabinet.minX <= lo || info.cabinet.maxX >= hi) {
  console.log(`FAIL  cabinet [${info.cabinet.minX}, ${info.cabinet.maxX}] does not sit strictly inside the faces [${lo}, ${hi}]`);
  fail = true;
} else {
  console.log(`OK    cabinet [${info.cabinet.minX}, ${info.cabinet.maxX}] sits inside the faces [${lo}, ${hi}], insets ${(info.cabinet.minX - lo).toFixed(3)} / ${(hi - info.cabinet.maxX).toFixed(3)} m`);
}

// 3. the cabinet's footprint should match the published sign size (so it
//    isn't some unrelated box that happens to share the name)
if (info.lotSign) {
  const h = info.cabinet.maxY - info.cabinet.minY, w = info.cabinet.maxZ - info.cabinet.minZ;
  const dh = Math.abs(h - info.lotSign.size.h), dw = Math.abs(w - info.lotSign.size.w);
  if (dh > 0.05 || dw > 0.05) { console.log(`FAIL  cabinet footprint ${w.toFixed(2)}x${h.toFixed(2)} does not match published sign size ${info.lotSign.size.w}x${info.lotSign.size.h}`); fail = true; }
  else console.log(`OK    cabinet footprint ${w.toFixed(2)}x${h.toFixed(2)} matches published sign size`);
} else {
  console.log('note: scene.userData.lotSign not present — skipped the footprint cross-check');
}

// ── LOOKING, not proving: edge-on and from-below shots ─────────────────────
// pitch convention (confirmed against crosstown.ts's own station math, and
// against ct/lot.ts's `station`): POSITIVE pitch looks UP.
const cx = (info.cabinet.minX + info.cabinet.maxX) / 2;
const cz = (info.cabinet.minZ + info.cabinet.maxZ) / 2;
const cy = (info.cabinet.minY + info.cabinet.maxY) / 2;
const EYE = 1.62;
await p.evaluate((h) => window.__ct.clock(h, 0), 13); await afterFrames(p, 8);

// camera forward is (sin yaw, -cos yaw) — GOTCHAS 33 — so the yaw that looks
// FROM (ex,ez) AT (tx,tz) is atan2(tx-ex, -(tz-ez)), the same formula the
// site's own published `station`/`readStation` use.
const yawAt = (ex, ez, tx, tz) => Math.atan2(tx - ex, -(tz - ez));

// A pure "stand due south and look straight up" view looks straight down the
// cabinet's own WIDTH axis (Z), which foreshortens exactly the dimension a
// depth check needs — confirmed by projecting the cabinet's centre to NDC
// (0,0) from that spot and sampling the centre pixel: it IS the cabinet's own
// colour, just squeezed to a hairline. A genuine 3/4 angle — offset in X
// (across the faces, so the two artwork planes stop overlapping in screen
// space) AND in Z — is what actually shows the return as a visible strip,
// which is what a player would see walking up to it anyway.
{
  const dx = -3.2, dz = -3.4; // a few metres off both axes: a walkable 3/4 approach
  const ex = cx + dx, ez = cz + dz;
  const dist = Math.hypot(dx, dz);
  const yaw = yawAt(ex, ez, cx, cz);
  const pitch = Math.atan2(cy - EYE, dist);
  await p.evaluate(([x, z, y, ya, pi]) => window.__ct.warp(x, z, ya, window.__ct.groundAt(x, z), pi), [ex, ez, EYE, yaw, pitch]);
  await afterFrames(p, 5);
  const pos = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
  console.log('3/4 oblique stood at', pos);
  await p.screenshot({ path: 'shots/w4-polesign-oblique.png' });
}

// from (nearly) below: offset a little in X as well as Z, for the same
// reason — purely axial gives a hairline, not a read of the underside.
{
  const dx = -1.0, dz = -1.0;
  const ex = cx + dx, ez = cz + dz;
  const dist = Math.hypot(dx, dz);
  const yaw = yawAt(ex, ez, cx, cz);
  const pitch = Math.atan2(cy - EYE, dist);
  await p.evaluate(([x, z, y, ya, pi]) => window.__ct.warp(x, z, ya, window.__ct.groundAt(x, z), pi), [ex, ez, EYE, yaw, pitch]);
  await afterFrames(p, 5);
  const pos = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
  console.log('below (offset) stood at', pos);
  await p.screenshot({ path: 'shots/w4-polesign-below.png' });
}

console.log(fail ? 'RESULT: FAIL' : 'RESULT: PASS');
await b.close();
process.exit(fail ? 1 : 0);
