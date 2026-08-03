// LOOK AT THE 301 SOUTH WALL from a standing position, and at the calendar
// close up. Item 270's before/after frames.
//
// Standing position, not a warp to the calendar's own face: the user reads this
// room from where he wakes up, and "make it bigger" is a judgement about what
// it looks like from there.
//
// Waits for a PAINTED frame (`__ct.painted()` via waitPainted, GOTCHAS 80), not
// for rAF and not for `__ct` existing.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';
import { goto } from '../lib/reachable.mjs';
import { waitPainted, blackFraction } from '../lib/painted.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4188/');
const TAG = process.argv[2] || 'before';
mkdirSync('shots', { recursive: true });

// ct/apartment.ts:124 — APT_X0 = 200, APT_Z0 = -20, ST0 = 2.7. Cited, not
// retyped from memory; the probe cannot import a .ts file at runtime.
const APT_X0 = 200, APT_Z0 = -20, ST0 = 2.7;
const SPAWN = { x: APT_X0 - 1.4, z: APT_Z0 + 3.7, gy: 2 * ST0 };

const VIEWS = [
  // where you wake up, turned to the south wall (yaw 0 = -z)
  { id: 'stand', x: SPAWN.x, z: SPAWN.z, yaw: 0, pitch: 0 },
  // a pace nearer, the distance you would actually read it from
  { id: 'near', x: APT_X0 - 1.05, z: APT_Z0 + 3.0, yaw: 0, pitch: 0.16 },
];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await goto(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await reportWorld(p, URL);
await waitPainted(p);

for (const v of VIEWS) {
  await p.evaluate(([v, gy]) => window.__ct.warp(v.x, v.z, v.yaw, gy, v.pitch), [v, SPAWN.gy]);
  await waitPainted(p, { frames: 4 });
  const path = `shots/w107-cal-${TAG}-${v.id}.png`;
  const buf = await p.screenshot({ path });
  const black = await blackFraction(p, buf);
  console.log(`${path}  black ${(black * 100).toFixed(1)}%`);
}

// and what the world says about the calendar mesh itself
const info = await p.evaluate(() => {
  const out = [];
  window.__ct.scene().traverse((o) => {
    if (o.userData?.calendar) {
      o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      out.push({ tag: o.userData.calendar,
        w: +(bb.max.x - bb.min.x).toFixed(3), h: +(bb.max.y - bb.min.y).toFixed(3),
        x: +o.position.x.toFixed(3), y: +o.position.y.toFixed(3), z: +o.position.z.toFixed(3),
        rotY: +o.rotation.y.toFixed(3), visible: o.visible,
        mapW: o.material?.map?.image?.width ?? null, mapH: o.material?.map?.image?.height ?? null });
    }
  });
  return out;
});
console.log('tagged calendar meshes:', JSON.stringify(info));
await b.close();
