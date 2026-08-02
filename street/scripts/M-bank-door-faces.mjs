// BOTH FACES OF THE BANK DOOR, SIDE BY SIDE — the actual test for
// "door of the bank doesnt match the inner door of the bank": stand outside,
// screenshot it; walk through; turn round; screenshot it again.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { setClock } from './lib/clock.mjs';

const URL = aim('http://localhost:4195/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await setClock(p, 14, 20);

const yawTo = (sx, sz, tx, tz) => Math.atan2(tx - sx, -(tz - sz));

// Outside: FACE = -7, west facade, door centred at world z = 4.6 (FR_CZ).
// x = FACE + 2.2 is OUTSIDE, on the pavement — same station A-bank-look.mjs
// uses for "day-close". FACE itself is inside the wall, not on the street.
const OX = -7 + 2.2, OZ = 4.6;
await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0),
  [OX, OZ, yawTo(OX, OZ, -7, OZ)]);
await p.waitForTimeout(500);
await p.screenshot({ path: 'shots/M-bankdoor-outside.png' });
console.log('  M-bankdoor-outside.png');

// Inside: from the room's own published dims, close on the door from inside.
const R = await p.evaluate(() => (window.__ct.roomDims() || []).find((r) => r.id === 'bank'));
if (!R) { console.error('no room with id "bank"'); process.exit(3); }
const wx = (lx) => R.cx + lx, wz = (lz) => R.cz + lz;
const hd = R.d / 2;
const sx = 0, sz = -2.2, tx = 0, tz = hd;
await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0.02),
  [wx(sx), wz(sz), yawTo(sx, sz, tx, tz)]);
await p.waitForTimeout(500);
await p.screenshot({ path: 'shots/M-bankdoor-inside.png' });
console.log('  M-bankdoor-inside.png');

const cx = 0, cz = hd - 1.3;
await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0.02),
  [wx(cx), wz(cz), yawTo(cx, cz, tx, tz)]);
await p.waitForTimeout(500);
await p.screenshot({ path: 'shots/M-bankdoor-inside-close.png' });
console.log('  M-bankdoor-inside-close.png');

await b.close();
