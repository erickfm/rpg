// WALK THE LOT THE WAY A CUSTOMER DOES, AND SHOOT EVERY STEP OF IT.
//
// The user's method, asked for by name: *"take screenshots yourself and grade
// it and make sure you are impressed with it. be skeptical."* And the brief the
// route comes from: *"make it make sense like how does one even enter, drive a
// car off the lot."*
//
// So the path is the sale, not a tour of features: you come along the pavement,
// you see it from outside the fence, you come in at the gate, you walk the
// aisle reading windshield prices, you reach the office, you sit down while
// they run your credit, and you leave the way a car leaves.
//
// Every frame verifies it landed where it meant to (`__ct.pos()` to 6 cm), so a
// shot taken from somewhere else is reported rather than filed as evidence —
// scripts/aim.mjs's rule, learned again the hard way when a frame of mine
// contained a flagpole instead of the pole sign it was captioned as.
//
// Usage: SHOT_URL=http://127.0.0.1:4191/ node scripts/I-walk.mjs [--night]
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { flags } from './lib/args.mjs';

const ARGS = flags(['--night']);
const URL = process.env.SHOT_URL ?? 'http://127.0.0.1:4191/';
const TAG = ARGS.night ? 'n' : 'd';
const HOUR = ARGS.night ? 21 : 13;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
await p.evaluate((h) => window.__ct.clock(h, 30), HOUR);
await p.waitForTimeout(900);

// yaw that faces (tx,tz) from (x,z): fp.ts has fwd = (sin yaw, -cos yaw)
const face = (x, z, tx, tz) => Math.atan2(tx - x, -(tz - z));

const STEPS = [
  // ── outside, on the pavement, before you have decided anything ──
  ['01-pavement-north',  -6.0, 18.0,  face(-6.0, 18.0, 8.0, 6.0),   -0.02, 'walking down, the lot appears on your left'],
  ['02-pavement-at',     -6.0,  6.0,  face(-6.0,  6.0, 9.0, 4.0),    0.02, 'square on the frontage from the far walk'],
  ['03-pavement-south',  -6.0, -8.0,  face(-6.0, -8.0, 9.0, 0.0),    0.02, 'from the south, the fence and the banners'],
  // ── the entrance: the thing the brief asks about ──
  ['04-kerb',             2.0,  2.6,  face(2.0,  2.6, 12.0, 2.6),   -0.05, 'standing in the road at the curb cut'],
  ['05-gate',             7.6,  2.6,  face(7.6,  2.6, 26.0, 2.6),   -0.02, 'in the gate mouth, the aisle opens up'],
  // ── the aisle: reading the stock, which is what a lot is for ──
  ['06-aisle-near',      11.0,  2.6,  face(11.0, 2.6, 27.0, 2.6),   -0.02, 'first bays either side, prices on the glass'],
  ['07-left-row',        14.0,  2.6,  face(14.0, 2.6, 14.0, -6.0),  -0.04, 'broadside to the left row'],
  ['08-right-row',       14.0,  2.6,  face(14.0, 2.6, 14.0, 11.0),  -0.04, 'broadside to the right row'],
  ['09-aisle-far',       20.0,  2.6,  face(20.0, 2.6, 27.0, 2.6),   -0.02, 'the office ahead, deep in the lot'],
  // ── the office, and waiting while they run your credit ──
  ['10-office',          24.0,  2.6,  face(24.0, 2.6, 26.1, 2.6),    0.04, 'at the office front'],
  ['11-chairs',          24.6,  5.4,  face(24.6, 5.4, 25.4, 3.9),   -0.12, 'the two chairs against the cabin'],
  // ── and out, the way a car leaves ──
  ['12-drive-out',       22.0,  2.6,  face(22.0, 2.6, 2.0, 2.6),    -0.02, 'turned round: the whole run out to the street'],
  ['13-gate-out',         9.0,  2.6,  face(9.0,  2.6, -6.0, 2.6),   -0.04, 'at the gate looking out over the apron'],
  // ── the back corners, which you only see once you are all the way in ──
  ['14-back-corner',     26.0,  8.0,  face(26.0, 8.0, 20.0, 10.0),  -0.03, 'the tyre stacks and the north back corner'],
];

let missed = 0;
for (const [label, x, z, yaw, pitch, expect] of STEPS) {
  await p.evaluate(([x, z, yaw, pitch]) => window.__ct.warp(x, z, yaw, 0.14, pitch), [x, z, yaw, pitch]);
  await p.waitForTimeout(300);
  const land = await p.evaluate(() => window.__ct.pos());
  const ok = Math.abs(land[0] - x) < 0.06 && Math.abs(land[2] - z) < 0.06;
  if (!ok) missed++;
  await p.screenshot({ path: `shots/I-w${TAG}-${label}.png` });
  console.log(`  ${ok ? 'shot ' : 'DRIFT'} I-w${TAG}-${label}  (${land[0].toFixed(2)}, ${land[2].toFixed(2)})  ${expect}`);
}
console.log(`\n  ${STEPS.length - missed}/${STEPS.length} frames landed where they were aimed.`);
await b.close();
process.exit(missed ? 1 : 0);
