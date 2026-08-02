// ITEM 128, ATTRIBUTION #2: HOW MANY mesh raycast tests happen per frame, and where?
//
// w50 profiled 301 and found raycasting is ~a fifth of all JS time while the
// player merely stands there (notes/w50-perf-301.md). It did NOT name what casts
// them. This does, with a count rather than a timing — because BUILDER-BRIEF's
// warning stands: no frame-time from headless software GL transfers to the
// user's machine, but a COUNT of work done per frame is the same number on every
// machine.
//
// Method: `crosstown.ts:1829` calls `seeRay.intersectObject(scene, true)`, which
// walks the whole scene graph and calls `raycast()` on every Mesh in it. So
// wrapping `Mesh.prototype.raycast` counts exactly the work that line causes.
// The prototype is reached from a real mesh in the published scene — nothing is
// imported and no constant is retyped.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w52-raycast-count.mjs [seconds]
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const SECS = Number(process.argv[2] ?? 5);
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

// ── install the counter ───────────────────────────────────────────────────
const installed = await p.evaluate(() => {
  const scene = window.__ct.scene();
  let proto = null;
  scene.traverse((o) => { if (!proto && o.isMesh) proto = Object.getPrototypeOf(o); });
  if (!proto) return { ok: false };
  // scene census, for the "per frame" number to mean something
  let meshes = 0, objs = 0;
  scene.traverse((o) => { objs++; if (o.isMesh) meshes++; });
  const orig = proto.raycast;
  window.__rc = { calls: 0, frames: 0 };
  proto.raycast = function (...a) { window.__rc.calls++; return orig.apply(this, a); };
  const tick = () => { window.__rc.frames++; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  return { ok: true, meshes, objs };
});
if (!installed.ok) { console.log('could not find a Mesh in the scene'); await browser.close(); process.exit(3); }
console.log(`scene census: ${installed.objs} Object3D, ${installed.meshes} Mesh\n`);

// ── stations. The spawn is flat 301, which is the room the user is reporting ──
const spawn = await p.evaluate(() => window.__ct.pos());
console.log(`spawn (301): (${spawn[0].toFixed(2)}, ${spawn[2].toFixed(2)}) gy ${spawn[3].toFixed(2)}\n`);

const STATIONS = [
  { name: 'flat 301 (spawn)', warp: null },
  { name: '301 landing/hall', warp: [spawn[0], spawn[2] + 3.0, 0, spawn[3]] },
  { name: 'street (outside)', warp: [0, 0, 0, 0] },
];

console.log('warming up 10 s before counting…\n');
await p.waitForTimeout(10000);

const rows = [];
for (const st of STATIONS) {
  if (st.warp) await p.evaluate((w) => window.__ct.warp(w[0], w[1], w[2], w[3]), st.warp);
  await p.waitForTimeout(1200);                      // settle, and clear the `landing` latch
  await p.evaluate(() => { window.__rc.calls = 0; window.__rc.frames = 0; });
  await p.waitForTimeout(SECS * 1000);
  const r = await p.evaluate(() => ({ ...window.__rc }));
  const here = await p.evaluate(() => window.__ct.pos());
  const perFrame = r.frames ? r.calls / r.frames : 0;
  rows.push({ name: st.name, ...r, perFrame, at: here });
  console.log(`${st.name.padEnd(20)} at (${here[0].toFixed(1)}, ${here[2].toFixed(1)}) gy ${here[3].toFixed(1)}`);
  console.log(`  ${r.calls} mesh raycast tests over ${r.frames} frames `
    + `= ${perFrame.toFixed(0)} per frame  (${(100 * perFrame / installed.meshes).toFixed(0)}% of the scene, per frame)\n`);
}

// ── how many spots pass the cheap filter here, i.e. how many rays are cast ──
const spots = await p.evaluate(() => window.__ct.spots().filter((s) => s.ok));
console.log(`live spots in the world: ${spots.length}`);
for (const r of rows) {
  const near = spots.filter((s) => Math.hypot(s.x - r.at[0], s.z - r.at[2]) < 6.5).length;
  console.log(`  within 6.5 m of ${r.name.padEnd(20)}: ${near}`
    + `   -> ~${(r.perFrame / Math.max(1, installed.meshes)).toFixed(2)} full-scene sweeps/frame`);
}
if (errs.length) console.log(`\nconsole errors: ${errs.length}\n  ${errs.slice(0, 3).join('\n  ')}`);
await browser.close();
