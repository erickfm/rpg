// LOOK at the church forecourt treads — the faces that were drawing 5.87 x 175.
//
// For LOOKING, never for proving (BUILDER-BRIEF). The proof is texdensity's
// numbers and steps-walk; this is so a human being has actually seen the
// paving before it is called fixed.
//
// GOTCHAS 78/80: wait for a PAINTED frame, not a timeout.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { waitPainted, blackFraction } from '../lib/painted.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4183/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);
await waitPainted(p);

// The church flight: treads at world (8.84..9.18, 0.14..0.28, -79.5), climbing
// west→east toward the doors. Stand back on the walk and look at the paving.
const SHOTS = [
  { name: 'church-treads-close', at: [6.6, -79.5], look: [9.2, -79.5] },
  { name: 'church-treads-down', at: [7.4, -79.5], look: [9.2, -79.6] },
  { name: 'library-treads', at: [-7.6, -13.0], look: [-10.9, -13.0] },
];

for (const s of SHOTS) {
  // yaw convention copied from scripts/bus.mjs:38 and basin.mjs:30, not
  // invented here: yaw = atan2(tx - x, -(tz - z)). Pitch down to put the
  // paving in frame, which is the whole subject of these shots.
  await p.evaluate(([x, z, lx, lz]) => {
    const gy = window.__ct.groundAt(x, z) ?? 0.14;
    window.__ct.warp(x, z, Math.atan2(lx - x, -(lz - z)), gy, -0.38);
  }, [s.at[0], s.at[1], s.look[0], s.look[1]]);
  await waitPainted(p);
  const buf = await p.screenshot({ path: `shots/${s.name}.png` });
  const black = await blackFraction(p, buf);
  console.log(`${s.name}.png  black ${(black * 100).toFixed(1)}%`
    + (black > 0.6 ? '   <-- SUSPICIOUS, do not read this shot' : ''));
}
await b.close();
