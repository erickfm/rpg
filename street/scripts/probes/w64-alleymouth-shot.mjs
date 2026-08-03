#!/usr/bin/env node
// ITEM 186: the user's own frame — the alley mouth by the payphone and the
// dumpster — plus the NUMBERS that describe it, so "it reads as a shadow" is a
// measurement and not an adjective.
//
// Reports the rendered luminance of the sidewalk and of the alley floor in the
// same frame. His screenshot measures sidewalk 49.6, alley 14.8 (a 3.3x step
// with a hard straight edge between them), which is what a painted shadow is.
//
//   SHOT_URL=http://localhost:4201/ W64_TAG=before node scripts/probes/w64-alleymouth-shot.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const URL = process.env.SHOT_URL;
if (!URL) { console.error('set SHOT_URL to YOUR OWN server'); process.exit(3); }
const TAG = process.env.W64_TAG || 'before';
const DIR = process.env.W64_SHOTS || '/tmp/w64-alley';
const RAIN = process.env.W64_RAIN === '0' ? false : true;
mkdirSync(DIR, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1071, height: 830 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

// HIS VIEWPOINT, DERIVED FROM THE PAYPHONE rather than remembered: props.ts
// tags the booth `userData.payphone`, so stand a little north of it on the walk
// and look south-west into the alley mouth — which is his framing.
const where = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let ph = null;
  s.traverse((o) => { if (o.userData?.payphone) ph = o; });
  if (!ph) return null;
  const v = new (ph.position.constructor)();
  v.setFromMatrixPosition(ph.matrixWorld);
  return { x: v.x, z: v.z };
});
if (!where) { console.error('no payphone in this world'); await b.close(); process.exit(3); }
// Stand on the walk a little north-east of the booth and AIM AT THE ALLEY
// FLOOR'S OWN CENTRE — derived, so the frame follows the alley if it ever
// moves. `ct/alley.ts:230` tags the floor `userData.alley = 'floor'`.
const aim = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let f = null;
  s.traverse((o) => { if (o.userData?.alley === 'floor') f = o; });
  if (!f) return null;
  const g = f.geometry; if (!g.boundingBox) g.computeBoundingBox();
  const lo = g.boundingBox.min.clone().applyMatrix4(f.matrixWorld);
  const hi = g.boundingBox.max.clone().applyMatrix4(f.matrixWorld);
  return { x: (lo.x + hi.x) / 2, z: (lo.z + hi.z) / 2 };
});
if (!aim) { console.error('no alley floor in this world'); await b.close(); process.exit(3); }
// STAND ON THE WALK AT THE ALLEY'S OWN CENTRE LINE and look straight in, so the
// sidewalk paving and the alley floor are in the SAME frame with the arris at
// x = -7 between them. That boundary is the whole complaint.
const CX = where.x + 2.35, CZ = aim.z;
// rig convention, fp.ts:477 — fwd = (sin yaw, 0, -cos yaw)
const yaw = Math.atan2(aim.x - CX, -(aim.z - CZ));
await p.evaluate(({ CX, CZ, yaw }) => window.__ct.warp(CX, CZ, yaw, 0, -0.52), { CX, CZ, yaw });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(1400);
const shot = `${DIR}/${TAG}.png`;
await p.screenshot({ path: shot });
console.log(`camera (${CX.toFixed(2)}, ${CZ.toFixed(2)}) looking into the alley mouth -> ${shot}`);

// ── the two numbers ────────────────────────────────────────────────────────
// Read off the LIVE textures rather than off the frame, so the measurement does
// not depend on where a sample square happened to land: mean luminance and the
// standard deviation of the sidewalk's paving against the alley's.
const lum = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const read = (m) => {
    if (!m || !m.map || !m.map.image) return null;
    const im = m.map.image;
    const cv = document.createElement('canvas');
    cv.width = im.width; cv.height = im.height;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, im.width, im.height).data;
    let sum = 0, sum2 = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      sum += l; sum2 += l * l; n++;
    }
    const mean = sum / n;
    return { w: im.width, h: im.height, mean: +mean.toFixed(1),
      sd: +Math.sqrt(Math.max(0, sum2 / n - mean * mean)).toFixed(2),
      tint: '#' + m.color.getHexString() };
  };
  let alley = null, walk = null;
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (o.userData?.alley === 'floor') alley = read(Array.isArray(o.material) ? o.material[0] : o.material);
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox; if (!bb) return;
    const lo = bb.min.clone().applyMatrix4(o.matrixWorld), hi = bb.max.clone().applyMatrix4(o.matrixWorld);
    const w = Math.abs(hi.x - lo.x), d = Math.abs(hi.z - lo.z);
    // THE WEST SIDEWALK SLAB: a ~1.9 x 126 m box on the building line. Found by
    // shape, and its top face is material index 2 (the box-top trap).
    if (o.geometry.type === 'BoxGeometry' && w > 1.5 && w < 2.4 && d > 100
        && (lo.x + hi.x) / 2 < 0 && !walk) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      walk = read(mats.length >= 3 ? mats[2] : mats[0]);
    }
  });
  return { alley, walk };
});
const a = lum.alley, w = lum.walk;
console.log(`  sidewalk paving  ${w.w}x${w.h}  mean ${w.mean}  sd ${w.sd}  tint ${w.tint}`);
console.log(`  alley floor      ${a.w}x${a.h}  mean ${a.mean}  sd ${a.sd}  tint ${a.tint}`);
console.log(`  alley / sidewalk = ${(a.mean / w.mean).toFixed(3)}`
  + `   (his frame renders 14.8 against 49.6 = 0.298)`);
console.log(`  relative grain: alley ${(a.sd / a.mean * 100).toFixed(1)}%  sidewalk ${(w.sd / w.mean * 100).toFixed(1)}%`);
await b.close();
void RAIN; void execFileSync;
