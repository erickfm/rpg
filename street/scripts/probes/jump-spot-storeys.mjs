// Are jump-walk.mjs's three "indoor" spots actually on the storeys they name?
// The file's header says its whole purpose is the stacked-storey floor picker,
// so a spot list that never leaves storey 0 would be testing nothing.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4182/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

// what camY does the world open on, before anything warps?
const spawnCam = await p.evaluate(() => window.__ct.camY());
console.log(`camY at spawn, untouched: ${spawnCam.toFixed(3)}`);

const probe = [
  ['jump-walk "inside, ground floor"', 104, -16.0],
  ['jump-walk "the apartment stairs"', 112, -16.0],
  ['jump-walk "upstairs"', 120, -16.0],
  ['the walk-up itself (APT_X0,APT_Z0)', 200, -20.0],
  ['the documented SPAWN', 198.6, -16.3],
];
for (const [what, x, z] of probe) {
  const g = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [x, z]);
  console.log(`${what.padEnd(36)} groundAt(${x}, ${z}) = ${g.toFixed(3)}`);
}
await b.close();
