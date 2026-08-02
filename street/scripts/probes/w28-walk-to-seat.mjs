#!/usr/bin/env node
// One question, asked before rewriting the artifact check: how far behind a
// game seat's own approach point can a probe stand WITHOUT being shoved by
// collision, and does holding W then carry the player all the way onto the
// approach point — for the slot stool AND the blackjack table?
//
// w25's probe warps straight onto the approach point; the item asks for "walks
// to", and a walk also proves the seat is REACHABLE rather than merely
// triggerable by a teleport. But a walk that ends the moment the prompt appears
// is not a walk — the trigger radius is over a metre, so the first frame
// already offers the seat. This measures the two numbers that decide it: how
// much of the requested set-back survives collision, and how far W then gets.
//
//   SHOT_URL=http://localhost:<port>/artifact.html node scripts/probes/w28-walk-to-seat.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('ABORTED: set SHOT_URL.'); process.exit(3); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 });
await p.waitForFunction(() => typeof window.__slots?.open === 'function', { timeout: 20000 })
  .catch(() => {});

console.log('label                          back  asked        settled      shove  walked-to    d(approach) offered');
for (const label of ['sit at the slot', 'sit at the blackjack table']) {
  for (const back of [0.6, 0.8, 1.0, 1.2, 1.5, 2.0]) {
    const seats = await p.evaluate((l) => window.__ct.seats().filter((s) => s.label === l), label);
    const seat = seats[Math.floor(seats.length / 2)];
    // `int-casino.ts:1203`: approach = seat − facing·0.8, and facing = (sin yaw,
    // −cos yaw). So facing = normalize(pose − at), and standing `back` further
    // along (at − pose) puts you behind the approach point looking at the seat.
    const asked = await p.evaluate(({ s, back }) => {
      const dx = s.at.x - s.pose.x, dz = s.at.z - s.pose.z;
      const len = Math.hypot(dx, dz) || 1;
      const x = s.at.x + (dx / len) * back, z = s.at.z + (dz / len) * back;
      window.__ct.warp(x, z, Math.atan2(-dx / len, dz / len), undefined, 0);
      return { x, z };
    }, { s: seat, back });
    await p.waitForTimeout(300);
    const settled = await p.evaluate(() => window.__ct.pos());
    await p.keyboard.down('w');
    await p.waitForTimeout(1200);
    await p.keyboard.up('w');
    await p.waitForTimeout(150);
    const st = await p.evaluate((l) => {
      const d = document.getElementById('ct-prompt');
      const txt = d && d.style.display !== 'none' ? (d.textContent ?? '') : '';
      return { offered: txt.includes(l), pos: window.__ct.pos() };
    }, label);
    const shove = Math.hypot(settled[0] - asked.x, settled[2] - asked.z);
    const dApp = Math.hypot(st.pos[0] - seat.at.x, st.pos[2] - seat.at.z);
    console.log(`${label.padEnd(30)} ${back.toFixed(1)}  `
      + `(${asked.x.toFixed(2)},${asked.z.toFixed(2)})  `
      + `(${settled[0].toFixed(2)},${settled[2].toFixed(2)})  ${shove.toFixed(2)}   `
      + `(${st.pos[0].toFixed(2)},${st.pos[2].toFixed(2)})  ${dApp.toFixed(2)}        ${st.offered}`);
  }
}
await b.close();
