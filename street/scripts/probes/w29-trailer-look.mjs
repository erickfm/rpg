// LOOK at the sedan and its trailer from the street, and again with the `V`
// collision overlay on, so the tiers can be seen sitting on the panels they
// describe. Screenshots are for LOOKING, never for proving (CLAUDE.md) — this
// answers "does it read as a car with a trailer hitched to it", which is a
// judgement no assertion makes for you.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w29-trailer-look.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1100, height: 700 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4188/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

// Broad daylight, or the first frame is a black street and the look is
// worthless — the world spawns you at whatever hour the clock is on.
await p.evaluate(() => window.__ct.clock(12));
await p.waitForTimeout(600);

const cols = await p.evaluate(() => window.__ct.colliders());
const byTag = Object.fromEntries(cols.filter((c) => c.tag).map((c) => [c.tag, c]));
const deck = byTag['sedan-trailer-deck'], body = byTag['sedan-body'];
const midX = (deck.minX + deck.maxX) / 2;
const midZ = ((deck.minZ + deck.maxZ) / 2 + (body.minZ + body.maxZ) / 2) / 2;

// Stand in the ROAD, on the far side of the car from the kerb, looking across
// at the whole rig. Standing on the pavement side instead puts the camera
// inside the building behind it — the sedan parks hard against the kerb, so
// there is no room out there to stand back in.
const side = midX > 0 ? 1 : -1;
for (const [name, overlay] of [['w29-trailer', false], ['w29-trailer-boxes', true]]) {
  await p.evaluate((on) => window.__ct.debugCollision(on), overlay);
  // forward is (sin yaw, -cos yaw), so yaw = +PI/2 looks towards +x
  await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0, -0.05),
    [midX - side * 5.5, midZ, side > 0 ? Math.PI / 2 : -Math.PI / 2]);
  await p.waitForTimeout(700);
  await p.screenshot({ path: `shots/${name}.png` });
  console.log(`shots/${name}.png`);
}
await p.evaluate(() => window.__ct.debugCollision(false));
await browser.close();
