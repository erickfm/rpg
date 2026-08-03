// Item 98 — IS MY OWN INSTRUMENT DETERMINISTIC? Ask before believing anything
// it said. The edge sweep read `+0 deg` and `-0 deg` — THE SAME POSE, since
// `yaw0 + 0` and `yaw0 - 0` are the same number — as "[E] enter No. 227" and
// "<<NULL>>" respectively. One of those is wrong and until it is known which,
// no measurement from that probe can be used to change fp.ts.
//
// Warp to one fixed pose N times and print what comes back each time, varying
// only the number of settle frames.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4450/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots, null, { timeout: 30000 });
await p.evaluate(() => window.__ct.clock(12, 30));

const POSE = { x: 6.55, z: -41.5, yaw: 0 };          // d = 2.5 m, aimed dead on

const read = async (frames, jitter) => {
  // optionally step away first, so the warp is a real move rather than a no-op
  if (jitter) {
    await p.evaluate(() => window.__ct.warp(6.55, -36.0, 0, 0, 0));
    for (let i = 0; i < 6; i++) await p.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  }
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0), [POSE.x, POSE.z, POSE.yaw]);
  for (let i = 0; i < frames; i++) await p.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  return p.evaluate(() => {
    if (window.__ct.landing?.()) return '<<LANDING>>';
    const el = document.getElementById('ct-prompt');
    if (!el || getComputedStyle(el).display === 'none') return '<<NULL>>';
    return (el.textContent ?? '').trim() || '<<EMPTY>>';
  });
};

for (const frames of [2, 4, 8, 16, 30]) {
  const outs = [];
  for (let i = 0; i < 6; i++) outs.push(await read(frames, i % 2 === 1));
  const uniq = [...new Set(outs)];
  console.log(`${String(frames).padStart(2)} settle frames -> ${uniq.length === 1 ? 'STABLE' : '*** FLIPS ***'}  ${JSON.stringify(outs)}`);
}
await b.close();
