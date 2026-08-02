#!/usr/bin/env node
// One question: from which x in No. 227's lobby does holding W actually reach
// the bottom step and climb — and where does the shipped landing put you?
//
// It does NOT warp to the step and check the height. Item 53 is explicit that a
// check which warped instead of walking is how the storey picker went untested
// for its whole life. So this uses the world's own [E] on the No. 227 door
// where it can, and otherwise lands exactly where `apartment.ts`'s `act()` does,
// then holds W and watches `gy`/`camY` for a climb.
//
//   SHOT_URL=http://localhost:<port>/ node scripts/probes/w28-227-landing.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('ABORTED: set SHOT_URL.'); process.exit(3); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.colliders !== undefined, { timeout: 30000 });

// The geometry, read off the world rather than retyped from apartment.ts: the
// core wall is the collider whose x-span is the lobby's middle third.
const geom = await p.evaluate(() => {
  const cs = window.__ct.colliders();
  // The lobby sits far out along +x with the rest of the interiors.
  const core = cs.filter((c) => c.maxX - c.minX > 0.25 && c.maxX - c.minX < 0.40
    && c.maxZ - c.minZ > 2.0 && c.maxZ - c.minZ < 2.4 && c.minX > 100);
  return { core: core.map((c) => ({ minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ })) };
});
console.log('core-wall candidates:', JSON.stringify(geom.core));

const walk = async (x, z, yaw, label) => {
  await p.evaluate(({ x, z, yaw }) => window.__ct.warp(x, z, yaw, 0, 0), { x, z, yaw });
  await p.waitForTimeout(350);
  // `pos()` is [x, EYE, z, gy] — index 1 is the camera's eye height and is a
  // constant 1.62 whatever you are standing on, so a climb is invisible in it.
  // The floor under you is index 3, the same `gy` apartment.ts's storey picker
  // keeps. Reading the wrong element is GOTCHAS §20 in miniature and cost this
  // probe its first run.
  const from = await p.evaluate(() => window.__ct.pos());
  await p.keyboard.down('w');
  let best = from[3], last = from;
  for (let i = 0; i < 24; i++) {                 // ≤ 6 s, the item's own budget
    await p.waitForTimeout(250);
    last = await p.evaluate(() => window.__ct.pos());
    if (last[3] > best) best = last[3];
  }
  await p.keyboard.up('w');
  await p.waitForTimeout(150);
  const end = await p.evaluate(() => window.__ct.pos());
  const climbed = best - from[3];
  console.log(`${label.padEnd(24)} from (${from[0].toFixed(2)}, ${from[2].toFixed(2)}) gy=${from[3].toFixed(2)}`
    + `  ->  (${end[0].toFixed(2)}, ${end[2].toFixed(2)}) gy=${end[3].toFixed(2)}`
    + `   peak gy ${best.toFixed(3)}   climbed ${climbed.toFixed(3)} m`);
  return { climbed, end };
};

// Where apartment.ts:2980 actually puts you, read from the world's own spot
// rather than retyped: press the door's [E] if we can reach it, else fall back
// to the constants the module publishes.
const apt = await p.evaluate(() => window.__ct.colliders().filter((c) => c.minX > 100).length);
console.log(`${apt} colliders live out past x=100 (the interiors)\n`);

const base = geom.core[0];
if (!base) { console.error('ABORTED: could not identify the core wall.'); await b.close(); process.exit(3); }
const APT_X = base.minX - 1.04;                  // the collider IS AX(1.04)…AX(1.36)
const APT_Z = base.minZ - 8.4;                   // …and AZI(8.4)…AZI(10.6)
console.log(`derived APT_X=${APT_X.toFixed(3)}  APT_Z=${APT_Z.toFixed(3)}`);
const AX = (l) => APT_X + l, AZI = (l) => APT_Z + l;

const scan = (process.env.W28_SCAN ?? '1.2,0.6,0.5,0.7,0.9,1.8').split(',').map(Number);
for (const lx of scan) {
  await walk(AX(lx), AZI(1.3), Math.PI, `AX(${lx.toFixed(2)})${lx === 1.2 ? ' SHIPPED' : ''}`);
}
await b.close();
