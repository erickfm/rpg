// w64: find the user's viewpoint for item 156 by looking, not by guessing.
// Warps to a spot at night, spins through 8 yaws with the camera pitched up,
// and files the frames. POS/PITCH/HOUR from the environment.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const URL = process.env.SHOT_URL || 'http://localhost:4187/';
const X = +(process.env.X ?? -6), Z = +(process.env.Z ?? -30);
const PITCH = +(process.env.PITCH ?? 0.45), H = +(process.env.H ?? 22);
const TAG = process.env.TAG || `x${X}z${Z}`;
mkdirSync('/tmp/w64', { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1064, height: 796 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await p.evaluate((H) => window.__ct.clock(H, 30), H);
for (let i = 0; i < 8; i++) {
  const yaw = (i * Math.PI) / 4;
  await p.evaluate(([X, Z, yaw, PITCH]) => window.__ct.warp(X, Z, yaw, 0, PITCH), [X, Z, yaw, PITCH]);
  await p.waitForTimeout(700);
  await p.screenshot({ path: `/tmp/w64/${TAG}-y${i}.png` });
}
console.log(`filed 8 frames /tmp/w64/${TAG}-y*.png at (${X}, ${Z}) pitch ${PITCH} hour ${H}`);
await b.close();
