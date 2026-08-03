// LOOK AT THE JAIL THRESHOLD EDGE — item 162, worker onehundredsix.
//
// The 2.4 x 0.05 m strip at the sally port was the worst face in the world
// (184.8x, 8.33 x 1540 px/m). The call site's own comment called it "a sliver
// nobody sees edge-on"; this stands where a player walks up to the door and
// photographs it, because that claim is the thing under test.
//
//   SHOT_URL=http://localhost:4620/ node scripts/probes/w106-jail-threshold-look.mjs [tag]
//
// GOTCHAS 79b: the player spawns INSIDE apartment 301 at x = 198, past the cull
// boundary, so a probe that does not warp sees no exterior at all. The jail site
// is outdoors at x ~ 61, z ~ -103 — warp first, always.
// GOTCHAS 78/80: waitPainted, not afterFrames and not a sleep.
// GOTCHAS 90: groundAt is ASYNC.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted, blackFraction } from '../lib/painted.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4620/');
const TAG = process.argv[2] ?? 'after';
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.warp !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await p.evaluate(() => window.__ct.clock(13, 0));

// The threshold is at roughly (61.3, 0.2, -103): stand off it on the pavement
// and look east at the portal, then step in close and look down at the strip.
const shots = [
  ['approach', 58.0, -103.0, Math.PI / 2, -0.22],
  ['down',     60.2, -103.0, Math.PI / 2, -0.62],
];
let bad = 0;
for (const [tag, x, z, yaw, pitch] of shots) {
  await p.evaluate(async ([x2, z2, y2, gy0]) => {
    const gy = await window.__ct.groundAt(x2, z2);        // ASYNC — GOTCHAS 90
    window.__ct.warp(x2, z2, y2, gy, gy0);
  }, [x, z, yaw, pitch]);
  const painted = await waitPainted(p, { frames: 3 });
  const path = `shots/w106-jail-${tag}-${TAG}.png`;
  const buf = await p.screenshot({ path });
  const black = await blackFraction(p, buf);
  console.log(`${tag}: black=${(black * 100).toFixed(1)}%  frames=${painted.frames}`
    + ` tris=${painted.triangles} -> ${path}`);
  if (black > 0.98) { console.log(`  ${tag}: PHOTOGRAPHED THE VOID`); bad++; }
}
await b.close();
process.exit(bad ? 1 : 0);
