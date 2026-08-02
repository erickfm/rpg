// LOOK DOWN EACH ROW IN TURN, FROM WHERE A CUSTOMER STANDS.
//
// The queue's own test for "the left row faces backwards": *stand at the lot
// entrance and look down each row in turn: every car should present the same
// face.* Geometry already says both rows are nose-out (scripts/I-rows.mjs), so
// if the user is still seeing a backwards row the difference is in the LOOKING,
// and that is what this is for. Screenshots are for looking, never for proving.
//
// The convention, written down because it is the whole question: fp.ts has
// fwd = (sin yaw, -cos yaw) and right = (cos yaw, sin yaw). Facing +x (yaw
// pi/2), right is +z. So the LEFT row as you drive in is the SOUTH row, at low
// z, and that is the row the user is complaining about.
//
// Usage: SHOT_URL=http://localhost:4190/ node scripts/I-rowshots.mjs [--night]
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { flags } from '../lib/args.mjs';

const ARGS = flags(['--night']);
const URL = process.env.SHOT_URL ?? 'http://localhost:4190/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 750 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
await p.evaluate((n) => window.__ct.clock(n ? 21 : 13, 30), ARGS.night);
await p.waitForTimeout(900);

const TAG = ARGS.night ? 'n' : 'd';
const shots = [
  // at the gate, on the aisle centreline, looking straight down the lot
  ['gate-aisle',   8.6, 2.6, Math.PI / 2, 0.0,  'the aisle, office at the far end, a row each side'],
  // at the gate, turned to look ALONG each row — the queue's own test
  ['gate-left',    9.2, 2.6, Math.PI / 2 - 0.62, -0.02, 'the LEFT row end-on: every car the same face'],
  ['gate-right',   9.2, 2.6, Math.PI / 2 + 0.62, -0.02, 'the RIGHT row end-on: every car the same face'],
  // mid-aisle, broadside to each row — how you read the stock walking in.
  // fwd = (sin yaw, -cos yaw), so yaw 0 faces -z (SOUTH, the left row) and yaw
  // pi faces +z (NORTH, the right row). I had these two labels swapped on the
  // first run and very nearly read the north row as evidence about the south.
  ['mid-left',    16.0, 2.6, 0,            -0.05, 'the LEFT row broadside from the aisle'],
  ['mid-right',   16.0, 2.6, Math.PI,      -0.05, 'the RIGHT row broadside from the aisle'],
  // from the back, looking out the way a car drives off the lot
  ['back-out',    25.5, 2.6, -Math.PI / 2, -0.02, 'looking back out at the gate down the aisle'],
];

for (const [label, x, z, yaw, pitch, expect] of shots) {
  await p.evaluate(([x, z, yaw, pitch]) => window.__ct.warp(x, z, yaw, 0.14, pitch), [x, z, yaw, pitch]);
  await p.waitForTimeout(280);
  const land = await p.evaluate(() => window.__ct.pos());
  const ok = Math.abs(land[0] - x) < 0.06 && Math.abs(land[2] - z) < 0.06;
  await p.screenshot({ path: `shots/I-${TAG}-${label}.png` });
  console.log(`  ${ok ? 'shot ' : 'DRIFT'} I-${TAG}-${label}  from (${land[0].toFixed(2)}, ${land[2].toFixed(2)}) · ${expect}`);
}

await b.close();
