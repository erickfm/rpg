// THE OTHER HALF OF THE COMPLAINT: "this curb is discontinuous".
//
// The apron the user was standing on is 8.60 m long, and across all of it the
// kerb reveal drops from 0.14 m to DRIVE_H — so the kerb line thins to a lip
// for a third of the block's north end and comes back. Whether that reads as a
// curb cut or as the kerb giving up is a thing to LOOK at, from where a player
// stands, and to MEASURE along the run.
//
// Prints the reveal profile down the kerb path and shoots the cut from the
// pavement and from the road, day and night.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto, settle } from './lib/reachable.mjs';

const URL = aim('http://localhost:4279/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1034, height: 757 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

// ── the reveal profile, read off the built geometry rather than the source ──
const prof = await p.evaluate(() => {
  const s = window.__ct.scene(); s.updateMatrixWorld(true);
  let best = null;
  s.traverse((n) => {
    if (!n.isMesh || n.geometry?.type !== 'BufferGeometry') return;
    const m = Array.isArray(n.material) ? n.material[0] : n.material;
    const im = m?.map?.image;
    if (!im || im.width !== 768 || im.height !== 10) return;   // the kerb face sheet
    best = n;
  });
  if (!best) return null;
  const pos = best.geometry.attributes.position;
  // the kerb face is a quad strip: bottom at KBOT, top at the reveal. Collect
  // the top vertices on the EAST kerb (x ~ +5) and sort along z.
  const out = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (Math.abs(x - 5) > 0.2) continue;
    if (y < -0.03) continue;                 // skip the below-grade edge
    if (z < -6 || z > 12) continue;
    out.push([+z.toFixed(2), +y.toFixed(4)]);
  }
  out.sort((a, c) => a[0] - c[0]);
  const seen = new Map();
  for (const [z, y] of out) if (!seen.has(z)) seen.set(z, y);
  return [...seen.entries()];
});

console.log('\n── kerb top height along the east kerb through the cut ──');
console.log('  (full reveal is 0.14 m; DRIVE_H is 0.035 m across the opening)');
let run = null;
for (const [z, y] of prof ?? []) {
  const bar = '#'.repeat(Math.round(y * 140));
  console.log(`  z ${String(z).padStart(7)}   ${y.toFixed(4)}  ${bar}`);
  if (y < 0.05) run = run === null ? [z, z] : [run[0], z];
}
if (run) console.log(`\n  the kerb is at its lip from z ${run[0]} to ${run[1]} — ${(run[1] - run[0]).toFixed(2)} m`);

// ── and look at it ────────────────────────────────────────────────────────
const N = Math.PI, S = 0;
const shots = [
  ['walk-north',  6.0,  9.5, S, -0.45],    // walking south onto the cut
  ['walk-on',     6.0,  2.6, S, -0.55],    // standing on it
  ['road-across', 0.0,  2.6, Math.PI / 2, -0.20],   // from the road, kerb face on
  ['road-along', -1.0, 14.0, S, -0.14],    // down the kerb line from the north
  ['lip-close',  3.2,  2.6, Math.PI / 2, -0.30],   // 1.8 m off the lip, eye on it
  ['lip-shoulder', 3.2, 6.2, Math.PI / 2.6, -0.30], // the flare shoulder itself
];
for (const [name, x, z, yaw, pitch] of shots) {
  for (const [when, h] of [['day', 13], ['night', 22]]) {
    await p.evaluate(([hh]) => window.__ct.clock(hh, 30), [h]);
    await p.evaluate(([X, Z, Y, P]) => window.__ct.warp(X, Z, Y, 0.14, P), [x, z, yaw, pitch]);
    const lum = await settle(p);
    const f = `shots/cut-${name}-${when}.png`;
    await p.screenshot({ path: f });
    console.log(`${f.padEnd(36)} mean ${lum.toFixed(4)}` +
      (lum < 0.02 ? '   <-- BLACK, this frame proves nothing' : ''));
  }
}
await b.close();
