// A CLOSE LOOK AT ONE UMBRELLA, from in front and from behind.
//
// The pass/fail in w96-umbrellas.mjs only knows whether the canopy is UP. It
// cannot see that the first cut sat on the wearer's head like a mushroom cap —
// that took a picture, and so does the shaft, which runs through the same space
// as the torso and is the part most likely to read wrong.
//
// Two angles because the sprite MIRRORS for the far half of the sheet
// (GOTCHAS 41: verify both sides of anything mirrored).
//
//   SHOT_URL=http://localhost:4520/ node scripts/probes/w96-umbrella-closeup.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4520/');
mkdirSync('shots', { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 720, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.walkers !== undefined, { timeout: 30000 });
await p.waitForTimeout(700);

// OUT OF THE FLAT FIRST. `updateRain` gates on `px < 100` (ct/props.ts:2376) and
// the player SPAWNS inside apartment 301, which is parked far out along +x with
// the other interiors — so while you are indoors it never rains at any hour and
// this probe reported "never found a wet hour" against a working world.
await p.evaluate(() => window.__ct.warp(6.3, -60, Math.PI));
await p.waitForTimeout(1800);

// a wet hour: step the clock until the umbrellas are actually up
let hour = -1;
for (let h = 6; h < 40; h++) {
  await p.evaluate((hh) => window.__ct.clock(hh, 0), h);
  await p.waitForTimeout(2600);
  const up = await p.evaluate(() => window.__ct.walkers().filter((q) => q.umb > 0.9).length);
  if (up > 0) { hour = h; break; }
}
if (hour < 0) { console.log('REFUSING TO REPORT: never found a wet hour'); await b.close(); process.exit(3); }

// STAND STILL AND LET THEM COME TO YOU. Warping to wherever a walker is and
// shooting is a chase, and it loses: they move at up to 1.55 m/s and re-plan
// their route, so two attempts photographed an empty pavement 2.6 m from where
// somebody had just been. Holding a fixed spot on the walk and waiting until an
// umbrella is close and IN FRONT of the camera cannot miss in the same way.
const CAM = { x: 6.3, z: -60 };
for (const [tag, yaw] of [['front', Math.PI], ['behind', 0]]) {
  await p.evaluate(([c, y]) => window.__ct.warp(c.x, c.z, y), [CAM, yaw]);
  await p.waitForTimeout(900);
  let got = null;
  for (let n = 0; n < 400 && !got; n++) {
    got = await p.evaluate(([c, y]) => {
      const dir = { x: Math.sin(y), z: Math.cos(y) };
      for (const q of window.__ct.walkers()) {
        if (q.umb < 0.9) continue;
        const dx = q.x - c.x, dz = q.z - c.z;
        const d = Math.hypot(dx, dz);
        // close, but not so close they go `ghost` (1.4 m), and ahead of us
        if (d > 1.9 && d < 4.2 && (dx * dir.x + dz * dir.z) / d > 0.85) {
          return { x: +q.x.toFixed(2), z: +q.z.toFixed(2), d: +d.toFixed(2), umb: q.umb };
        }
      }
      return null;
    }, [CAM, yaw]);
    if (!got) await p.waitForTimeout(120);
  }
  if (!got) { console.log(`${tag}: nobody with an umbrella came within reach — no shot`); continue; }
  await p.screenshot({ path: `shots/w96-umbrella-${tag}.png` });
  console.log(`${tag}: walker at (${got.x}, ${got.z}), ${got.d} m away, umb ${got.umb}`);
}
console.log(`wet hour ${hour}; shots/w96-umbrella-front.png, shots/w96-umbrella-behind.png`);
await b.close();
