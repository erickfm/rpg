// ONE QUESTION: can you actually WALK up flight A of the walk-up, and does the
// storey picker follow you? Sample gy every few frames while holding W.
//
//   SHOT_URL=http://localhost:4184/ node scripts/probes/w19-climb-flightA.mjs
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4184/';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await reportWorld(p, URL);

const spawn = await p.evaluate(() => window.__ct.scene().userData.spawn);
console.log('published spawn:', JSON.stringify(spawn));

// Walk-up frame, derived from the published spawn rather than retyped:
// apartment.ts:114-119 defines SPAWN as { x: APT_X0 - 1.4, z: APT_Z0 + 3.7,
// gy: 2 * ST0 }.
const APT_X = spawn.x + 1.4, APT_Z = spawn.z - 3.7, ST = spawn.gy / 2;
console.log(`derived APT_X ${APT_X}  APT_Z ${APT_Z}  ST ${ST}`);

const AX = (lx) => APT_X + lx, AZ = (lz) => APT_Z + lz;

// start in the lobby, on storey 0, facing +z up the shaft (facing is
// (sin yaw, -cos yaw), so yaw PI walks +z)
await p.evaluate(([x, z]) => window.__ct.warp(x, z, Math.PI, 0, 0), [AX(0.6), AZ(6.0)]);
await p.waitForTimeout(500);
console.log('start:', JSON.stringify(await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)))));

await p.keyboard.down('w');
for (let i = 0; i < 26; i++) {
  await p.waitForTimeout(160);
  const q = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
  console.log(`  t${String(i).padStart(2)}  x ${q[0]}  z ${q[2]}  gy ${q[3]}`);
}
await p.keyboard.up('w');
await b.close();
