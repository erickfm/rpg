// THE SECOND ROOM THE NEW WARNING NAMES. `ct/int-hotel.ts` declares a 2.2 m
// double door with a 2.6 m head and builds its own stone case at exactly that
// size — but its `buildRoom` spec omits `building`, so the KIT never sees the
// declaration and cuts its fallback hole instead. Two numbers over one doorway.
//
// This reports both and shoots the result, so the desk can queue it against a
// picture rather than against my arithmetic. I did not fix it: `ct/int-hotel.ts`
// is item 96's file and item 147 does not name it.
//
//   SHOT_URL=http://localhost:4185/ node scripts/probes/w57-hotel-door.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
page.on('pageerror', (e) => console.log('pageerror: ' + e.message));
await page.goto(aim('http://localhost:4185/'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await page.evaluate(() => window.__ct.clock(13, 0));

const d = await page.evaluate(() => {
  const dd = window.__ct.doors().find((q) => q.building === 'HOTEL ORPHEUS');
  const rd = window.__ct.roomDims().find((r) => r.id === 'hotel');
  return { declaredWidthM: dd?.widthM ?? null, room: rd };
});
console.log('HOTEL ORPHEUS declares (via __ct.doors):', JSON.stringify(d.declaredWidthM));
console.log('room:', JSON.stringify(d.room));

mkdirSync('shots/w57', { recursive: true });
const wx = d.room.cx + d.room.door.x, wz = d.room.cz + d.room.d / 2 - 3.6;
await page.evaluate(([x, z]) => window.__ct.warp(x, z, Math.PI, window.__ct.groundAt(x, z), 0), [wx, wz]);
await page.waitForTimeout(700);
await page.screenshot({ path: 'shots/w57/hotel-inside.png' });
console.log(`hotel inside: stood (${wx.toFixed(2)}, ${wz.toFixed(2)}) facing its own door -> shots/w57/hotel-inside.png`);
await browser.close();
