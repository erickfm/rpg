// PICTURES of the jail, from where a player stands. An investigation, not an
// assertion suite (GOTCHAS 24) — the claims it is used to grade are in
// notes/O-jail-exterior.md and the checks that assert them are separate.
//
//   SHOT_URL=http://localhost:4297/ node scripts/O-jail-look.mjs [day|night|all]
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
import { reportWorld } from '../lib/which-world.mjs';
import { modes } from '../lib/modes.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('aim it: SHOT_URL=http://localhost:PORT/ (GOTCHAS 48)'); process.exit(2); }
const mode = modes('O-jail-look', ['day', 'night', 'all']);

// x, z, look-at x, look-at z, pitch — every one a station a player can occupy
const STATIONS = [
  ['vista-60', -4.0, -103.0, 60.0, -103.0, 0.00],   // the whole length of the street
  ['vista-40', 16.0, -103.0, 60.0, -103.0, 0.01],
  ['vista-20', 36.0, -103.0, 60.0, -103.0, 0.02],
  ['approach', 48.0, -103.0, 60.0, -103.0, 0.06],   // close enough to read it
  ['atdoor', 55.6, -103.0, 60.0, -103.0, 0.10],     // standing at the door
  ['plate', 54.4, -103.0, 60.0, -103.0, 0.30],      // looking up at the plate
  ['bars-n', 55.9, -100.2, 57.6, -100.2, 0.42],     // a first-floor grille, close
  ['portal-o', 55.6, -100.4, 57.4, -103.0, 0.06],   // the portal from an angle
  ['walk-n', 55.9, -109.0, 55.9, -96.0, -0.02],     // along the pavement, north
  ['walk-s', 55.9, -97.0, 55.9, -110.0, -0.02],     // and back south — GOTCHAS 41
  ['from-casino', 50.0, -97.5, 58.0, -102.0, 0.06], // from the casino's doorway
];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await reportWorld(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await afterFrames(p, 10); await p.waitForTimeout(1200);

for (const [tag, h, m] of [['day', 13, 0], ['night', 22, 30]]) {
  if (mode !== 'all' && mode !== tag) continue;
  await p.evaluate(([h, m]) => window.__ct.clock(h, m), [h, m]);
  await afterFrames(p, 8);
  for (const [n, x, z, tx, tz, pi] of STATIONS) {
    const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [x, z]);
    await p.evaluate(([x, z, y, g, pi]) => window.__ct.warp(x, z, y, g, pi),
      [x, z, Math.atan2(tx - x, -(tz - z)), gy, pi]);
    await afterFrames(p, 5);
    // A check must verify it is WHERE IT THINKS IT IS before it fires
    // (GOTCHAS 20) — a previous station's walk has moved a probe before.
    const g = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
    if (Math.hypot(g[0] - x, g[2] - z) > 0.35) {
      console.log(`  SKIPPED ${n}: asked for (${x}, ${z}), stood at (${g[0]}, ${g[2]})`);
      continue;
    }
    await p.screenshot({ path: `shots/O-jail-${tag}-${n}.png` });
    console.log(`  O-jail-${tag}-${n}.png at (${g[0]}, ${g[2]}) ground ${g[3]}`);
  }
}
await b.close();
