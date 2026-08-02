// PICTURES of the side street's east end, from where a player stands.
// Investigation, not an assertion (GOTCHAS 24) — it is what the jail's site
// proposal is looking at. Aim it: SHOT_URL=http://localhost:4297/
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
await p.evaluate(() => window.__ct.clock(13, 0)); await afterFrames(p, 6);

for (const [n, x, z, tx, tz, pi] of [
  // the terminating vista: standing mid-street, looking east at the closed end
  ['vista-40m', 16.0, -103.0, 60.0, -103.0, -0.02],
  ['vista-20m', 36.0, -103.0, 60.0, -103.0, -0.02],
  // the end itself, from the casino pavement
  ['end-close', 52.0, -100.0, 60.0, -103.0, -0.06],
  // standing ON the strip that would be the jail's pavement, looking back west
  ['strip-west', 55.9, -103.0, 20.0, -103.0, -0.02],
  // the strip along its own length — is it a pavement or a leftover?
  ['strip-north', 55.9, -109.0, 55.9, -96.0, -0.10],
  // what the closed end actually IS today, looked at squarely
  ['endwall', 52.0, -103.0, 60.0, -103.0, 0.10],
]) {
  const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [x, z]);
  await p.evaluate(([x, z, y, g, pi]) => window.__ct.warp(x, z, y, g, pi),
    [x, z, Math.atan2(tx - x, -(tz - z)), gy, pi]);
  await afterFrames(p, 5);
  const g = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
  await p.screenshot({ path: `shots/O-end-${n}.png` });
  console.log(`  O-end-${n}.png at (${g[0]}, ${g[2]}) ground ${g[3]}`);
}
await b.close();
