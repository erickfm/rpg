// VERIFYING E's church-pillar row — I did not build it, so I may.
//
// E measured the clearance where the windows actually are and got 0.31 m each
// side of a 1.30 m lancet, with the piers stepping 0.92 -> 0.76 -> 0.60 so the
// base is gone long before the lancet height. That is careful and I am not
// re-deriving it.
//
// But the user's complaint was VISUAL — *"they block the windows i think"* —
// and the answer to a visual complaint is a picture from where a player stands.
// E gives one station. **A player is not on a station**, so this shoots E's and
// then walks the pavement past the church taking the same frame every few
// metres, because a clearance of 0.31 m closes up at a shallow enough angle
// and that is exactly what "seem not fully thought out" would look like.
//
//   SHOT_URL=http://localhost:PORT/ node scripts/O-verify-E-lancets.mjs
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('aim it: SHOT_URL=http://localhost:PORT/'); process.exit(2); }
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await reportWorld(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await afterFrames(p, 10); await p.waitForTimeout(1200);
await p.evaluate(() => window.__ct.clock(13, 0));
await afterFrames(p, 8);

// The church's own geometry, asked of the world rather than copied from E's
// row — if E ever moves it, this follows.
const piers = await p.evaluate(() => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const x = o.position.x, z = o.position.z;
    if (x > 4 && x < 12 && z > -90 && z < -70 && o.position.y > 1 && o.position.y < 8) out.push(+z.toFixed(1));
  });
  return [...new Set(out)].sort((a, c) => a - c);
});
console.log(`meshes on the church frontage band, by z: ${JSON.stringify(piers.slice(0, 14))}`);

// ── E's station, then a walk past it ──────────────────────────────────────
//
// E: "the FAR pavement at (-5.4, -79.5) looking east, pitched up".
const STATIONS = [
  ['E-station', -5.4, -79.5, 0.42],
  ['walk-n8', -5.4, -71.5, 0.42],
  ['walk-n4', -5.4, -75.5, 0.42],
  ['walk-s4', -5.4, -83.5, 0.42],
  ['walk-s8', -5.4, -87.5, 0.42],
  // and the shallowest angle a player can actually take, from up the street
  ['oblique-n', -5.4, -62.0, 0.34],
  ['oblique-s', -5.4, -97.0, 0.34],
];
for (const [tag, x, z, pitch] of STATIONS) {
  const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [x, z]);
  await p.evaluate(([x, z, g, pi]) => window.__ct.warp(x, z, Math.PI / 2, g, pi), [x, z, gy, pitch]);
  await afterFrames(p, 5);
  const q = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
  if (Math.hypot(q[0] - x, q[2] - z) > 0.5) { console.log(`  SKIPPED ${tag}: stood at (${q[0]}, ${q[2]})`); continue; }
  await p.screenshot({ path: `shots/O-verify-E-lancet-${tag}.png` });
  console.log(`  O-verify-E-lancet-${tag}.png at (${q[0]}, ${q[2]}) pitch ${pitch}`);
}

console.log('\nGRADED BY LOOKING, because the complaint was visual and a clearance');
console.log('measured in metres does not answer "they block the windows i think".');
await b.close();
