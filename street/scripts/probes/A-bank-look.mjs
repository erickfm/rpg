// THE BANK FACADE, from the pavement opposite — where the user shot it.
// Day and night, because a facade that only works in one light is half done.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { setClock } from './lib/clock.mjs';

const URL = aim('http://localhost:4188/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 760 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

// find the bank by its [E] spot, so the camera is aimed from the world rather
// than from a coordinate I typed
const at = await p.evaluate(() => {
  const s = (window.__ct.spots() || []).find((q) => /FIRST FEDERAL/i.test(q.label || ''));
  return s ? { x: s.x, z: s.z } : null;
});
if (!at) { console.error('no FIRST FEDERAL spot found'); process.exit(3); }
console.log(`bank ATM spot at x ${at.x.toFixed(2)}  z ${at.z.toFixed(2)}`);

const FACE = -7, OUT = 1;
const yawTo = (sx, sz, tx, tz) => Math.atan2(tx - sx, -(tz - sz));
const shots = [
  ['day-square',  13, 30, FACE + OUT * 7.5, at.z,        0.10],
  ['day-close',   13, 30, FACE + OUT * 2.2, at.z,        0.02],
  ['day-atm',     13, 30, FACE + OUT * 1.3, at.z,       -0.04],
  ['day-wide',    13, 30, FACE + OUT * 9.0, at.z + 4.0,  0.12],
  ['night-square',22, 15, FACE + OUT * 7.5, at.z,        0.10],
  ['night-close', 22, 15, FACE + OUT * 2.2, at.z,        0.02],
];
for (const [tag, hh, mm, sx, sz, pitch] of shots) {
  await setClock(p, hh, mm);
  const yaw = yawTo(sx, sz, FACE, at.z);
  await p.evaluate(([x, z, y, pi]) => window.__ct.warp(x, z, y, 0.14, pi), [sx, sz, yaw, pitch]);
  await p.waitForTimeout(420);
  await p.screenshot({ path: `shots/A-bank-${tag}.png` });
  console.log(`  A-bank-${tag}  from (${sx.toFixed(1)}, ${sz.toFixed(1)}) at ${hh}:${String(mm).padStart(2,'0')}`);
}
await b.close();
