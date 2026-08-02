import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto(aim('http://localhost:4186/'), { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await p.waitForTimeout(400);

const pos = () => p.evaluate(() => window.__ct.pos());
const warp = (x, z, yaw, gy) => p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy, 0), [x, z, yaw, gy]);
const hold = async (key, ms) => { await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key); };

const KERB_H = 0.14;

console.log('--- yaw PI/2 (+x, "out to the road" per default east=false) ---');
await warp(60.12, -100.8, Math.PI / 2, KERB_H);
await p.waitForTimeout(150);
let a0 = await pos();
await hold('w', 2000);
let a1 = await pos();
console.log('start', a0, 'end', a1, 'moved', Math.hypot(a1[0] - a0[0], a1[2] - a0[2]));

console.log('--- yaw -PI/2 (-x, actual road direction per JAIL_DOOR.nx=-1) ---');
await warp(60.12, -100.8, -Math.PI / 2, KERB_H);
await p.waitForTimeout(150);
a0 = await pos();
await hold('w', 2000);
a1 = await pos();
console.log('start', a0, 'end', a1, 'moved', Math.hypot(a1[0] - a0[0], a1[2] - a0[2]));

const colliders = await p.evaluate(() => window.__ct.colliders());
const near = colliders.filter(c => c.maxZ >= -108 && c.minZ <= -98 && c.minX < 66 && c.maxX > 54);
console.log('--- colliders near forecourt/building (x 54-66, z -108..-98) ---');
for (const c of near) console.log(JSON.stringify(c));

await b.close();
