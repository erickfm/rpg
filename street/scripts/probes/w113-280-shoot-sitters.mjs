// ITEM 280 — photograph EVERY seated citizen from a FIXED vantage.
//
// The camera list is computed once, from the BEFORE world, and cached in
// `shots/w113-280-cams.json`. Both runs read that file, so before and after are
// shot from byte-identical camera positions. This is the trap that confounded
// worker onehundredeleven: `w108-item272-diner-legs.mjs` derives its vantage
// from the SITTER, which is the thing this change moves.
//
// Usage:
//   SHOT_URL=http://localhost:4690/ node scripts/probes/w113-280-shoot-sitters.mjs before
//   ... change, rebuild ...
//   SHOT_URL=http://localhost:4690/ node scripts/probes/w113-280-shoot-sitters.mjs after
import fs from 'node:fs';
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted } from '../lib/painted.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const label = process.argv[2] ?? 'now';
const CAMS = 'shots/w113-280-cams.json';
const URL = aim('http://localhost:4690/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await waitPainted(p, { quiet: true });
await reportWorld(p, URL);

// ── the camera list ────────────────────────────────────────────────────────
let cams;
if (fs.existsSync(CAMS)) {
  cams = JSON.parse(fs.readFileSync(CAMS, 'utf8'));
  console.log(`re-using ${cams.length} cached cameras from ${CAMS}`);
} else {
  const people = await p.evaluate(() => {
    const s = window.__ct.scene(); s.updateMatrixWorld(true);
    const out = [];
    s.traverse((n) => {
      if (!n.isMesh || !n.userData?.seated) return;
      const e = n.matrixWorld.elements;
      out.push({ x: +e[12].toFixed(3), y: +e[13].toFixed(3), z: +e[14].toFixed(3),
        facing: n.userData.citizenFacing ?? 0 });
    });
    return out.sort((a, c) => a.x - c.x || a.z - c.z);
  });
  // Stand in FRONT of the sitter and a little to one side — the 3/4 view a
  // player walking the aisle actually gets, which is the view the user's own
  // screenshot was taken from.
  cams = people.map((q, i) => {
    const ang = q.facing + 0.55;
    const R = 1.8;
    const cx = q.x + Math.sin(ang) * R, cz = q.z + Math.cos(ang) * R;
    // LOOK BACK AT THE SITTER. The rig's forward is (sin y, 0, -cos y) -- NOT
    // (sin, 0, cos) -- so the yaw that points at a target is atan2(dx, -dz).
    // Getting this wrong turns the camera exactly 180 degrees and photographs
    // the far wall; my first run shot 14 frames of empty room that way, and it
    // is the same slip worker onehundredeight recorded in its own probe.
    return { i, sitter: q, x: +cx.toFixed(3), z: +cz.toFixed(3),
      yaw: +Math.atan2(q.x - cx, -(q.z - cz)).toFixed(4),
      pitch: -0.34 };
  });
  fs.writeFileSync(CAMS, JSON.stringify(cams, null, 1));
  console.log(`wrote ${cams.length} cameras to ${CAMS}`);
}

let landed = 0;
for (const c of cams) {
  let at = null;
  for (let k = 0; k < 8; k++) {
    await p.evaluate((v) => window.__ct.warp(v.x, v.z, v.yaw, 0, v.pitch), c);
    await waitPainted(p, { quiet: true });
    await p.waitForTimeout(260);
    at = await p.evaluate(() => window.__ct.pos());
    if (Math.hypot(at[0] - c.x, at[2] - c.z) < 0.7) break;
  }
  const d = Math.hypot(at[0] - c.x, at[2] - c.z);
  if (d < 0.7) landed++;
  await p.waitForTimeout(420);
  await waitPainted(p, { quiet: true });
  const f = `shots/w113-280-${label}-${String(c.i).padStart(2, '0')}`
    + `-x${Math.round(c.sitter.x)}.png`;
  await p.screenshot({ path: f });
  console.log(`  ${f}  sitter (${c.sitter.x}, ${c.sitter.z}) `
    + `cam asked (${c.x}, ${c.z}) stood (${at[0].toFixed(2)}, ${at[2].toFixed(2)}) `
    + `off ${d.toFixed(2)}${d < 0.7 ? '' : '  <-- DID NOT LAND'}`);
}
console.log(`\n${landed}/${cams.length} cameras landed within 0.7 m`);
await b.close();
