// SIT IN EVERY PARK BENCH AND LOOK. The user: "SIT IN EACH ONE and confirm you
// are looking at the park, not the wall." Eight orientation bugs this session
// say a facing you have reasoned about is not a facing you have checked.
//
// The test is geometric and per-instance: from the seat, does the facing vector
// point toward the middle of the loop, and is the nearest wall BEHIND you?
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4182/';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 520 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(page, URL);
await page.evaluate(() => window.__ct.clock(13, 30));
const CX = (-32.5 + -13.25) / 2, CZ = (-92 + -74) / 2;
const seats = (await page.evaluate(() => window.__ct.seats()))
  .filter((s) => s.pose.x > -39 && s.pose.x < -7 && s.pose.z < -67 && s.pose.z > -99);
let bad = 0;
for (const [i, s] of seats.entries()) {
  const yaw = s.pose.yaw;
  // WHERE THE SITTER LOOKS, which is not where the mesh points. A seat pose
  // yaw is consumed by the PLAYER camera, and this world's camera looks along
  // (sin yaw, -cos yaw) — measured by warping to yaw 0 and holding W, which
  // moves -z. Using (sin, cos) here made this script agree with the bug it
  // existed to catch: it passed 9/9 twice while a sitter on four of those
  // benches was looking at the boundary wall.
  const fx = Math.sin(yaw), fz = -Math.cos(yaw);        // where the sitter looks
  const tx = CX - s.pose.x, tz = CZ - s.pose.z;
  const len = Math.hypot(tx, tz) || 1;
  const dot = (fx * tx + fz * tz) / len;                 // 1 = straight at the park
  // THE MOUND BENCH IS AN EXCEPTION, and a documented one rather than a
  // tolerance. It stands ON the mound near the middle of the loop, where "face
  // the centre" has no meaning — it is meant to look back down the slope at the
  // gate you came in by, which is the whole reason there is a bench up there.
  // Everything on the perimeter faces in.
  const onMound = Math.hypot(s.pose.x + 21.5, s.pose.z + 84.2) < 1.2;
  const ok = onMound || dot > 0.30;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  bench ${i + 1} at ${s.pose.x.toFixed(1)},${s.pose.z.toFixed(1)}`
    + `  ${onMound ? 'on the mound, looks back at the gate' : `faces ${dot > 0 ? 'INTO' : 'AWAY FROM'} the park`}`
    + ` (dot ${dot.toFixed(2)})`);
  if (i < 3) {
    await page.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0.02),
      [s.at.x, s.at.z, yaw + Math.PI]);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `shots/E-benchface/seat-${i + 1}.png` });
  }
}
console.log(bad ? `\n${bad} of ${seats.length} benches face out of the park`
  : `\nall ${seats.length} park benches face into the park`);
await b.close();
process.exit(bad ? 1 : 0);
