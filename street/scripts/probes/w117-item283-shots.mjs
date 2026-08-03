// LOOK AT IT. Three frames from the player's own eye in the bank's client
// chair: the chair on offer as you walk up, the prompt once you are sitting in
// it, and the loan application open across the desk.
//
// Screenshots are for LOOKING, never for PROVING (CLAUDE.md) — the proof is
// w117-item283-client-chair.mjs and w117-item283-walk-to-the-chair.mjs. This is
// so a human can see what the user will see.
//
//   SHOT_URL=http://localhost:4190/ node scripts/probes/w117-item283-shots.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { waitPainted, blackFraction } from '../lib/painted.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4190/');
mkdirSync('shots', { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await waitPainted(p);
await p.evaluate(() => window.__ct.clock(10, 0));

const chair = await p.evaluate(() => {
  const s = (window.__ct.seats() || []).find((q) => /client chair/i.test(q.label));
  return { x: s.pose.x, z: s.pose.z, yaw: s.pose.yaw, ax: s.at.x, az: s.at.z };
});
const dx = chair.ax - chair.x, dz = chair.az - chair.z, len = Math.hypot(dx, dz);
const tap = async (k) => { await p.keyboard.down(k); await p.waitForTimeout(120); await p.keyboard.up(k); await p.waitForTimeout(280); };
const shoot = async (name) => {
  await waitPainted(p, { frames: 6 });
  const path = `shots/${name}.png`;
  const buf = await p.screenshot({ path });
  const black = await blackFraction(p, buf);
  console.log(`  ${path}   black ${(black * 100).toFixed(1)}%`
    + (black > 0.98 ? '   <-- YOU PHOTOGRAPHED THE VOID' : ''));
};

// 1. walking up to it
await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0),
  [chair.ax + (dx / len) * 0.9, chair.az + (dz / len) * 0.9, Math.atan2(-dx / len, dz / len)]);
await shoot('w117-283-1-walking-up');

// 2. sitting in it, facing the way the seat faces
await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0), [chair.ax, chair.az, Math.atan2(-dx / len, dz / len)]);
await waitPainted(p, { frames: 4 });
await tap('e');
await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y), [chair.x, chair.z, chair.yaw]);
await shoot('w117-283-2-seated-facing-the-desk');

// 3. head turned to the application, and the application open
await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y), [chair.x, chair.z, chair.yaw - (44 * Math.PI) / 180]);
await shoot('w117-283-3-seated-the-loan-on-offer');
await tap('e');
await shoot('w117-283-4-the-loan-open-from-the-chair');
console.log(`  panel: ${JSON.stringify(await p.evaluate(() => window.__hud?.panel?.() ?? null))}`
  + `  seated: ${await p.evaluate(() => !!window.__ct.seated())}`);
await b.close();
