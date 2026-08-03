// ITEM 136 — the rooftop board seen edge-on, from the USER'S OWN STATION.
//
//   SHOT_URL=http://localhost:4192/ TAG=before node scripts/probes/w58-board-edge.mjs
//
// DAY AND NIGHT, because the row says it is WORSE BY DAY and every prior round
// on this building was judged in a night frame. At noon none of the board's
// bulbs are lit, so the socket density three notes have argued about cannot be
// what a daylight viewer is looking at.
//
// The station is w46/w51's `hero` — x 53.6, z −103.2, yaw π, pitch 0.62 — cited
// rather than re-guessed, so these frames are comparable with `shots/w51/`.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4192/');
const TAG = process.env.TAG || 'now';
const OUT = 'shots/w58';
mkdirSync(OUT, { recursive: true });

const HERO = { x: 53.6, z: -103.2, yaw: Math.PI, pitch: 0.62 };
// noon and night. The board is at y 19.4–26, so both frames are sky-backed.
const HOURS = [['day', 12], ['night', 22]];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
// __ct IS PUBLISHED BEFORE THE WORLD IS DRAWN — a frame taken straight after it
// appears is solid black, which reads as a culled world. (w58, item 143.)
await p.waitForTimeout(2500);

for (const [name, hour] of HOURS) {
  await p.evaluate(([x, z, y, pi, h]) => {
    window.__ct.clock(h, 0);
    window.__ct.warp(x, z, y, undefined, pi);
  }, [HERO.x, HERO.z, HERO.yaw, HERO.pitch, hour]);
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/board-${name}-${TAG}.png` });
  console.log(`${OUT}/board-${name}-${TAG}.png`);
}
await b.close();
