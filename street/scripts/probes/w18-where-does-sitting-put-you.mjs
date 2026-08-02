// ONE QUESTION: when you sit on the bed, where does the player actually stand,
// and how far is that from the square the TV's own frame-loop watches?
//
// The TV is lit by a POSITION TEST in apartment.ts (`TV_SEAT_X/TV_SEAT_Z`,
// +-0.20 m) rather than by any seated query, so the only thing that matters is
// the distance between where `ctx.seat` puts you and where that test looks.
//
// Usage: SHOT_URL=http://localhost:4193/ node scripts/probes/w18-where-does-sitting-put-you.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4193/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

const seat = await page.evaluate(() => window.__ct.spots().find((s) => /sit on the bed/i.test(s.label)) ?? null);
console.log('seat spot as the world publishes it:', seat);

// walk the squares around the bed until one offers the seat, same as the check
const at = (x, z, yaw = 0) => page.evaluate(([X, Z, Y]) => window.__ct.warp(X, Z, Y), [x, z, yaw]);
const prompt = () => page.evaluate(() => {
  const e = document.getElementById('ct-prompt');
  return e && e.style.display !== 'none' ? e.textContent : null;
});
let stand = null;
for (let dx = -1.4; dx <= 1.4 && !stand; dx += 0.35) {
  for (let dz = -1.4; dz <= 1.4 && !stand; dz += 0.35) {
    await at(seat.x + dx, seat.z + dz, Math.atan2(-dx, dz));
    await page.waitForTimeout(140);
    const p = await prompt();
    if (p && /sit on the bed/i.test(p)) stand = [seat.x + dx, seat.z + dz];
  }
}
console.log('offered from:', stand && stand.map((n) => +n.toFixed(2)));

await page.keyboard.down('e');
await page.waitForFunction(() => !!window.__ct.seated(), null, { timeout: 6000 }).catch(() => {});
await page.keyboard.up('e');
await page.waitForTimeout(600);
const p = await page.evaluate(() => window.__ct.pos().map((n) => +n.toFixed(3)));
console.log('SEATED at x/z:', p[0], p[2], ' gy', p[3]);
console.log('tv.on:', await page.evaluate(() => window.__ct.scene().userData?.tv?.on));

// the square the frame loop watches, recomputed from the room's own origin
const APT = await page.evaluate(() => {
  const s = window.__ct.spots().find((q) => /sleep until morning/i.test(q.label));
  return s ? { x: s.x, z: s.z } : null;
});
console.log('sleep spot (the other bed spot), for scale:', APT);

await browser.close();
