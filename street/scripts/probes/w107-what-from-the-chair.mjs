// WHAT IS OFFERED FROM THE BANK'S CLIENT CHAIR, and at what hour. A diagnostic
// for item 206: the seated [E] must reach the loan application, and if it does
// not then the chair is the wrong stage for that item's check.
// Prints. Does not assert.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { goto } from '../lib/reachable.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4188/');
const b = await chromium.launch();
const p = await b.newPage();
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await waitPainted(p);

const seats = await p.evaluate(() => (window.__ct.seats() || [])
  .map((s) => ({ label: s.label, x: +s.pose.x.toFixed(2), z: +s.pose.z.toFixed(2),
    yaw: +s.pose.yaw.toFixed(2), ax: +s.at.x.toFixed(2), az: +s.at.z.toFixed(2), r: s.r })));
console.log(`${seats.length} seats. Ones whose label mentions a chair/desk:`);
for (const s of seats.filter((q) => /chair|desk|apply|loan/i.test(q.label))) console.log(`  ${JSON.stringify(s)}`);

const chair = seats.find((q) => /client chair/i.test(q.label));
if (!chair) { console.log('no client chair'); await b.close(); process.exit(3); }

for (const h of [10, 13, 16]) {
  await p.evaluate((hh) => window.__ct.clock(hh, 0), h);
  await p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0, 0),
    [chair.ax, chair.az, Math.atan2(chair.x - chair.ax, -(chair.z - chair.az))]);
  await waitPainted(p, { frames: 8 });
  const standing = await p.evaluate(() => document.querySelector('#ct-prompt')?.textContent ?? '');
  // sit
  await p.keyboard.down('e'); await p.waitForTimeout(120); await p.keyboard.up('e');
  await waitPainted(p, { frames: 8 });
  const info = await p.evaluate(() => ({
    seated: !!window.__ct.seated(),
    prompt: document.querySelector('#ct-prompt')?.textContent ?? '',
    near: (window.__ct.spots() || [])
      .filter((q) => q.ok && Math.hypot(q.x - window.__ct.pos()[0], q.z - window.__ct.pos()[2]) < 3)
      .map((q) => {
        const px = window.__ct.pos()[0], pz = window.__ct.pos()[2];
        const dx = q.x - px, dz = q.z - pz, d = Math.hypot(dx, dz);
        const yaw = window.__ct.yaw();
        const fx = Math.sin(yaw), fz = -Math.cos(yaw);
        const off = Math.abs(Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz)) * 180 / Math.PI;
        return `${q.label} @${d.toFixed(2)}m r${q.r} offAxis ${off.toFixed(0)}deg`;
      }),
  }));
  console.log(`\nhour ${h}:`);
  console.log(`  standing prompt: "${standing.trim()}"`);
  console.log(`  seated:  ${info.seated}   prompt: "${info.prompt.trim()}"`);
  console.log(`  ok spots within 3 m while seated: ${info.near.length ? info.near.join(' | ') : '(none)'}`);
  // get back up for the next round
  await p.keyboard.press('Escape');
  await waitPainted(p, { frames: 8 });
}
await b.close();
