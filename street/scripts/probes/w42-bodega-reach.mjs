// Can a player actually WALK to the bodega's [E] spot?
//
// side-walk.mjs walks west along z=-97.0 at a hard-coded (8.70, -96.85) r=1.05
// and stops 3.5 m short. The world says the spot is "into the BODEGA" at
// (7.47, -95.53) r=1.80 — a different point with a radius nearly twice as big.
// So before anyone calls the walk blocked, walk at the REAL spot from every
// direction and report the closest approach, plus the free lane either side.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { installCollide } from '../lib/collide.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4193/');
const R = 0.36;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.colliders !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
await installCollide(p);
await p.waitForTimeout(400);

const SPOT = await p.evaluate(() => {
  const sp = window.__ct.spots().find((s) => /BODEGA/i.test(s.label));
  return sp ? { label: sp.label, x: sp.x, z: sp.z, r: sp.r } : null;
});
if (!SPOT) { console.log('no BODEGA spot in this world'); await b.close(); process.exit(1); }
console.log(`\nthe world's own spot: "${SPOT.label}" at (${SPOT.x.toFixed(2)}, ${SPOT.z.toFixed(2)}) r=${SPOT.r}`);

// ── is there anywhere standable inside the trigger at all? (geometry) ──────
const standable = await p.evaluate(([S, R]) => {
  const cols = window.__ct.staticColliders();
  const out = [];
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    for (const f of [0.95, 0.75, 0.5, 0.25, 0]) {
      const x = S.x + Math.cos(a) * S.r * f, z = S.z + Math.sin(a) * S.r * f;
      if (!window.__probeCollide.blockedAt(cols, x, z, R)) out.push([+x.toFixed(2), +z.toFixed(2)]);
    }
  }
  return out;
}, [SPOT, R]);
console.log(`${standable.length} standable sample points inside the trigger`
  + (standable.length ? `, e.g. ${standable.slice(0, 4).map((q) => `(${q[0]}, ${q[1]})`).join(' ')}` : ' — NONE'));

// ── now WALK at it, from 8 headings, 4 m out ──────────────────────────────
const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(80); };
let best = 99, bestFrom = null;
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2;
  const sx = SPOT.x + Math.cos(a) * 4.0, sz = SPOT.z + Math.sin(a) * 4.0;
  // forward is (sin yaw, -cos yaw); aim it back at the spot
  const yaw = Math.atan2(SPOT.x - sx, -(SPOT.z - sz));
  const startBlocked = await p.evaluate(([x, z, R]) =>
    window.__probeCollide.blockedAt(window.__ct.staticColliders(), x, z, R), [sx, sz, R]);
  if (startBlocked) { console.log(`  heading ${i}: start (${sx.toFixed(2)}, ${sz.toFixed(2)}) is inside geometry — skipped`); continue; }
  await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0.14, 0), [sx, sz, yaw]);
  await p.waitForTimeout(120);
  let near = 99;
  for (let k = 0; k < 8; k++) {
    await hold('w', 300);
    const q = await p.evaluate(() => window.__ct.pos());
    near = Math.min(near, Math.hypot(q[0] - SPOT.x, q[2] - SPOT.z));
  }
  const mark = near < SPOT.r ? 'IN ' : '   ';
  console.log(`  ${mark}heading ${i} from (${sx.toFixed(2)}, ${sz.toFixed(2)}): closest ${near.toFixed(2)} m (r=${SPOT.r})`);
  if (near < best) { best = near; bestFrom = i; }
}
console.log(`\nbest approach on foot: ${best.toFixed(2)} m from heading ${bestFrom} — trigger r=${SPOT.r} → `
  + (best < SPOT.r ? 'REACHABLE' : '** NOT REACHABLE **'));
await b.close();
