// LOOK at the tax office waiting row, from a fixed spot, before/after the fix.
// For LOOKING only (per BUILDER-BRIEF §10) — not a diff, not proof by itself.
import { aim } from './lib/aim.mjs';
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';

const URL = aim('http://localhost:4188/');
const label = process.argv[2] ?? 'w9-tax';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 680 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });

const info = await p.evaluate(() => {
  const seats = window.__ct.seats();
  const prep = seats.find((s) => s.label === 'sit down with the preparer');
  const wait = seats.filter((s) => s.label === 'sit and wait' &&
    Math.hypot(s.pose.x - prep.pose.x, s.pose.z - prep.pose.z) < 15);
  return { prep: prep.pose, wait: wait.map((s) => s.pose) };
});
const midX = info.wait.reduce((a, s) => a + s.x, 0) / info.wait.length;
const wz = info.wait[0].z;
// stand a few metres out, into the room (lower z, toward the desks), looking
// back at the row -- this is roughly where a player walking in would see it
const ex = midX, ez = wz - 3.0;
const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [ex, ez]);
const yaw = Math.atan2(midX - ex, -(wz - ez));
await p.evaluate(([x, z, y, g]) => window.__ct.warp(x, z, y, g, 0.05), [ex, ez, yaw, gy]);
await afterFrames(p, 5);
await p.screenshot({ path: `shots/${label}-row.png` });
console.log(`shots/${label}-row.png  from (${ex.toFixed(2)},${ez.toFixed(2)}) looking at row (${midX.toFixed(2)},${wz.toFixed(2)})`);

// close-up on one chair, side-on, so the backrest position is unambiguous
const cx = info.wait[0].x;
const sex = cx, sez = wz + 0.9; // stand on the wall side, look across toward the room
const sgy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [sex, sez]);
const syaw = Math.atan2(cx - sex, -(wz - sez));
await p.evaluate(([x, z, y, g]) => window.__ct.warp(x, z, y, g, 0.1), [sex, sez, syaw + 0.9, sgy]);
await afterFrames(p, 5);
await p.screenshot({ path: `shots/${label}-chair-side.png` });
console.log(`shots/${label}-chair-side.png  side profile of one chair`);

await b.close();
