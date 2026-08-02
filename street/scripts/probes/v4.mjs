import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('PAGEERR', e.message));
await page.goto(aim('http://localhost:4177/'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, aim('http://localhost:4177/'));   // GOTCHAS 26: prove it, do not just name it
await page.waitForTimeout(500);
const pos = () => page.evaluate(() => window.__ct.pos());
const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(50); };
const shot = async (name, fn, wait=380) => { await page.evaluate(fn); await page.waitForTimeout(wait); await page.screenshot({ path: `shots/v4-${name}.png` }); };
await page.evaluate(() => window.__ct.clock(13,0));
// tree: stand on building side up-street, look down the walk (yaw 0 = south)
await shot('tree-lane', () => window.__ct.warp(6.6, -22, 0, 0.14, -0.15));
// tree from the road looking at kerb-side bed + clear building lane
await shot('tree-side', () => window.__ct.warp(3.5, -30, Math.atan2(3,0), 0.14, -0.1));
// lamp clean crook — day close
await shot('lamp-day', () => window.__ct.warp(3.5, -23, Math.atan2(2,0), 0.14, 0.15));
// lamp night
await shot('lamp-night', () => { window.__ct.clock(23,0); window.__ct.warp(-1,-30, Math.PI, 0.14, 0.06); });

// WALKABILITY: building-side lane past an east tree (tree at x5.5,z-30)
await page.evaluate(() => { window.__ct.clock(13,0); window.__ct.warp(6.5, -25, 0, 0.14, 0); });
await page.waitForTimeout(120);
let before = await pos();
await hold('w', 900); // walk south down the building-side lane past the tree
let after = await pos();
console.log('tree lane walk: from z', before[2].toFixed(1), 'to z', after[2].toFixed(1), '=> moved', (before[2]-after[2]).toFixed(2), 'm south');

await browser.close();
console.log('v4 done');
