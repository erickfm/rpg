// WHAT DOES EVERY SEAT LOOK AT?
//
// GOTCHAS 33 claims a class: "anything with a FRONT will end up
// backwards", off d5d15797's mirrored car row and d1268485's lot chairs facing
// the wall. A class claim is worth testing rather than accepting, and seats are
// the part of it the world publishes enough data to test.
//
// CONVENTION, verified rather than assumed: park.ts:373 comments facing as
// (sin yaw, -cos yaw), and civic.ts:830 places the stand spot 0.95 m along it.
// Checked against a real seat — sit (-7.43, -92.3) yaw -pi/2, stand (-8.38,
// -92.3): facing (-1, 0), stand = sit + 0.95 * facing. Exact.
//
// So: march from each seat along its facing direction and report the first
// static thing in the way. A seat you sit in to stare at brick from a metre is
// player-visible in a way a yaw number is not.
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';

const URL = aim('http://localhost:4184/');
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });
await reportWorld(p, URL);
await p.waitForTimeout(800);

const out = await p.evaluate(async () => {
  const key = (c) => `${c.minX.toFixed(2)},${c.minZ.toFixed(2)}`;
  const snap = () => window.__ct.colliders()
    .filter((c) => c && isFinite(c.minX) && Math.abs(c.minX) < 500)
    .map((c) => ({ minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ }));
  const a = snap();
  await new Promise((r) => setTimeout(r, 1500));
  const seen = new Set(snap().map(key));
  const cols = a.filter((c) => seen.has(key(c)));   // movers dropped

  const hit = (x, z) => cols.find((c) => x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ);
  const LIMIT = 6.0, S = 0.05;
  return window.__ct.seats().map((s) => {
    const { x, z, yaw } = s.pose;
    const fx = Math.sin(yaw), fz = -Math.cos(yaw);
    // EXCLUDE THE THING YOU ARE SITTING ON. A 0.72-wide tyre stack centred on
    // the seat still contains a point 0.35 m in front of it, so a naive march
    // reports the seat's own furniture as the view. Found by asking why the one
    // sub-1.5 m hit was exactly 0.35 m.
    const own = hit(x, z);
    const same = (c) => own && c.minX === own.minX && c.minZ === own.minZ;
    let d = 0, blocker = null;
    for (d = 0; d < LIMIT; d += S) {
      const c = hit(x + fx * d, z + fz * d);
      if (c && !same(c) && d > 0.3) { blocker = { w: +(c.maxX - c.minX).toFixed(2), h: +(c.maxZ - c.minZ).toFixed(2) }; break; }
    }
    return { label: s.label, x: +x.toFixed(2), z: +z.toFixed(2),
             clear: blocker ? +d.toFixed(2) : LIMIT, blocker };
  });
});
await b.close();

const near = out.filter((s) => s.clear < 6.0).sort((a, c) => a.clear - c.clear);
console.log(`${out.length} seats · ${out.filter((s) => s.clear >= 6).length} look at open ground for 6 m or more\n`);
console.log(`the ${near.length} that face something within 6 m, nearest first:`);
for (const s of near.slice(0, 18))
  console.log(`   ${s.clear.toFixed(2)} m  ${s.label.padEnd(26)} at (${s.x}, ${s.z})` +
    (s.blocker ? `  → ${s.blocker.w}×${s.blocker.h}` : ''));
const tight = out.filter((s) => s.clear < 1.5);
console.log(`\nseats facing something closer than 1.5 m: ${tight.length}`);
