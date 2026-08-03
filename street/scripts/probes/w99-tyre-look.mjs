#!/usr/bin/env node
// LOOK AT THE TYRE MEETING THE ROAD. Item 252.
//
// The measurement (w99-tyre-seating.mjs) says 16.6 mm. This says what 16.6 mm
// looks like, because the user reported this by eye from a screenshot and the
// only honest after-image is one taken from where a person stands.
//
// SAME HOUR EVERY RUN (13:00). Shooting a before at noon and an after at dusk
// photographs the night wash instead of the thing that changed.
//
// Shots are for LOOKING, never for PROVING — BUILDER-BRIEF §10. The proof is
// w99-tyre-seating.mjs; this is so a human can agree with it.
//
//   SHOT_URL=http://localhost:<port>/ node scripts/probes/w99-tyre-look.mjs before
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.SHOT_URL;
const label = process.argv[2] ?? 'now';
if (!URL) { console.error('ABORTED: set SHOT_URL — exit 3, nothing measured.'); process.exit(3); }
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 750 } });
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 60000 });
await p.evaluate(() => window.__ct.clock(13, 0));
await p.waitForTimeout(900);

// Find a parked car tyre by its geometry — never a remembered coordinate; the
// lot is laid out by a seeded draw and a typed spot is wrong the first time it
// moves. Pick the one nearest the lot frontage so the camera has room to stand.
const tyres = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  const out = [];
  s.traverse((o) => {
    if (!o.isMesh || !o.geometry || o.geometry.type !== 'CylinderGeometry') return;
    const q = o.geometry.parameters || {};
    if (Math.abs(q.radiusTop - 0.34) > 1e-6 || q.radialSegments !== 10) return;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
    // OUTBOARD, not radially-out-from-the-world-origin. The first cut of this
    // put the camera on the line from (0,0) through the wheel and photographed
    // the car's flank with the contact patch hidden behind the sill. The
    // direction that always clears the body is the one from the car's own
    // centre to this wheel.
    const car = o.parent;
    const cp = new (Object.getPrototypeOf(o.position).constructor)();
    car.getWorldPosition(cp);
    out.push({
      cx: +cx.toFixed(3), cz: +cz.toFixed(3),
      ox: +(cx - cp.x).toFixed(3), oz: +(cz - cp.z).toFixed(3),
      low: +bb.min.y.toFixed(4), top: +bb.max.y.toFixed(4),
      ground: +(window.__ct.groundAt(cx, cz) ?? 0).toFixed(4),
    });
  });
  return out.sort((a, z) => (a.cx ** 2 + a.cz ** 2) - (z.cx ** 2 + z.cz ** 2));
});
if (tyres.length < 60) { console.log(`EXIT 3 — only ${tyres.length} car tyres found; population floor is 60.`); await b.close(); process.exit(3); }

// three tyres spread across the world, so one odd car cannot carry the verdict
const picks = [tyres[0], tyres[Math.floor(tyres.length / 2)], tyres[tyres.length - 1]];
let i = 0;
for (const t of picks) {
  i++;
  console.log(`tyre ${i} at (${t.cx}, ${t.cz})  low ${t.low}  ground ${t.ground}  gap ${(t.low - t.ground).toFixed(4)}  top ${t.top}`);
  // stand 2.1 m out on the same ground the wheel is on, eye 1.6 up, look at the
  // CONTACT PATCH — that is the thing in question, not the car.
  // ⚠ `__ct.warp` HAS NO EYE-HEIGHT ARGUMENT. It takes (x, z, yaw, groundY,
  // pitch) and fp.ts puts the camera at groundY + EYE. The first cut of this
  // passed a made-up eye height into the pitch formula only, so every "close"
  // frame was aimed as if the camera were crouched when it was standing — the
  // contact patch fell out of frame and three shots showed a bonnet. EYE is
  // 1.62, the same figure w21-roof-climb.mjs and w29-sedan-climb.mjs use.
  const EYE = 1.62;
  for (const [tag, dist] of [['stand', 2.4], ['close', 1.5], ['patch', 0.9]]) {
    await p.evaluate(([tx, tz, ox, oz, gy, dist, eye]) => {
      const len = Math.hypot(ox, oz) || 1;
      const camX = tx + (ox / len) * dist, camZ = tz + (oz / len) * dist;
      // aim at the CONTACT PATCH — (tx, ground, tz) — because that is the thing
      // in question. Pitch is measured to it, not to the car's mid-height.
      const pitch = Math.atan2(-eye, dist);
      window.__ct.warp(camX, camZ, Math.atan2(tx - camX, -(tz - camZ)), gy, pitch);
    }, [t.cx, t.cz, t.ox, t.oz, t.ground, dist, EYE]);
    await p.waitForTimeout(700);
    const f = `shots/tyre-${label}-${i}-${tag}.png`;
    await p.screenshot({ path: f });
    console.log(`   ${f}`);
  }
}
await b.close();
