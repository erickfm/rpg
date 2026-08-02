// LOOK AT THE KERB AND THE FLAGS, BY DAY AND BY NIGHT.
//
// The user's shot (shots/user-kerb-discontinuous.png) is at night and dark, and
// the desk asked for daylight as well: "a joint pattern that reads at noon can
// vanish under the night grade". So every station is shot twice at the same
// pose, and the frame's mean luminance is printed with it — a black frame is a
// dead server or a camera in a wall, not a finding (GOTCHAS 32).
//
// Steep pitch on purpose. The complaint is about the ground at the player's
// feet, which is the one thing an eye-level shot never shows.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
import { goto } from './lib/reachable.mjs';

const URL = process.env.SHOT_URL ?? 'http://localhost:4279/';
const TAG = process.env.TAG ?? 'kl';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1034, height: 757 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

// yaw so that forward is (sin yaw, -cos yaw): PI = north (+z), 0 = south (-z)
const N = Math.PI, S = 0;
const stations = [
  // name,           x,     z,    yaw, pitch
  // THE COMPLAINT SHOT'S OWN POSE. The traffic cones sit at (8.33, -1.15) and
  // (8.33, 6.35), flanking the lot driveway, and one is on the RIGHT of the
  // user's frame with the road top-left — so the camera is on the EAST walk
  // facing SOUTH, a couple of metres north of the drive.
  ['drive-north',   6.0,    6.0,  S,  -0.85],
  ['drive-on',      6.0,    2.6,  S,  -0.85],
  ['east-drive',    6.0,   -2.0,  S,  -0.85],
  ['east-mid',      6.0,  -40.0,  N,  -0.85],
  ['west-mid',     -6.0,  -40.0,  S,  -0.85],
  ['west-shallow', -6.0,  -40.0,  S,  -0.45],   // the angle the complaint shot is nearer to
  ['east-corner',   6.0,  -90.0,  S,  -0.85],   // approaching the bodega return
];

for (const [name, x, z, yaw, pitch] of stations) {
  for (const [when, h] of [['day', 13], ['night', 22]]) {
    await p.evaluate(([hh]) => window.__ct.clock(hh, 0), [h]);
    await p.evaluate(([X, Z, Y, P]) => window.__ct.warp(X, Z, Y, 0.14, P), [x, z, yaw, pitch]);
    await p.waitForTimeout(400);
    const at = await p.evaluate(() => window.__ct.pos && window.__ct.pos());
    const lum = await p.evaluate(async () => {
      const c = document.querySelector('canvas');
      const t = document.createElement('canvas');
      t.width = 120; t.height = 90;
      t.getContext('2d').drawImage(c, 0, 0, 120, 90);
      const d = t.getContext('2d').getImageData(0, 0, 120, 90).data;
      let s = 0;
      for (let i = 0; i < d.length; i += 4) s += (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      return +(s / (d.length / 4) / 255).toFixed(4);
    });
    const file = `shots/${TAG}-${name}-${when}.png`;
    await p.screenshot({ path: file });
    console.log(`${file.padEnd(40)} at ${JSON.stringify(at)}  mean luminance ${lum}` +
      (lum < 0.02 ? '   <-- BLACK, this frame proves nothing' : ''));
  }
}
await b.close();
