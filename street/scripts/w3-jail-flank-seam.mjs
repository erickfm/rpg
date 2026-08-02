import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { setClock } from './lib/clock.mjs';

const URL = aim('http://localhost:4177/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await setClock(p, 13, 0);

const yawTo = (sx, sz, tx, tz) => Math.atan2(tx - sx, -(tz - sz));
// stand well back, south of the jail, looking north along its east flank
const s = { x: 85, z: -103, look: [61, -103] };
const yaw = yawTo(s.x, s.z, s.look[0], s.look[1]);
await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0, 0), [s.x, s.z, yaw]);
await p.waitForTimeout(400);
await p.screenshot({ path: 'shots/w3-seam-flank-wide.png' });

// closer, mid-height, straight at (61, 6.1, -103)
const s2 = { x: 68, z: -103, look: [61, -103] };
const yaw2 = yawTo(s2.x, s2.z, s2.look[0], s2.look[1]);
await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 3, 0), [s2.x, s2.z, yaw2]);
await p.waitForTimeout(400);
await p.screenshot({ path: 'shots/w3-seam-flank-mid.png' });

console.log('saved w3-seam-flank-wide.png, w3-seam-flank-mid.png');
await b.close();
