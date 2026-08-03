// ITEM 253 — LOOK AT THE TRAILER'S WHEELS BEFORE MOVING ANYTHING.
//
// The user: *"[screenshot] fix the wheels on the trailer"*, and he has also said
// *"i love the car with the trailer thing btw keep that tysm."* So the rig stays;
// something about the wheels reads wrong.
//
// ninetyeight measured the two candidates and refused to guess between them
// (`notes/ninetyeight-item113-wheels-scoping.md` §3):
//   · the wheels do NOT float — gap 0.0000, they stand on a vertex
//   · they OVERHANG the deck: centres at ±0.95, half-thickness 0.07, so ±1.02
//     against `DECK_HW = 0.9`, while the code's own comment says "tucked under"
//   · they are the world's only 12-gon wheels: 0.14 m wide, plain black, NO hub,
//     where every car tyre is a 10-gon 0.24 m wide with a hubcap
//
// **His eye is the pass condition**, so this shoots the thing from where a player
// meets it — eye height, on the pavement, walking past — rather than from a
// diagram viewpoint. It also prints the wheel and deck extents read out of the
// live scene graph, so the picture and the numbers are the same object.
//
//   SHOT_URL=http://localhost:4482/ node scripts/probes/w114-item253-trailer-look.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted } from '../lib/painted.mjs';
import { mkdirSync } from 'node:fs';

const URL = aim('http://localhost:4482/');
mkdirSync('shots', { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await waitPainted(p);

// ── FIND THE TRAILER IN THE LIVE SCENE, not from the source ───────────────
// It is a Group added as a child of one parked sedan. Its wheels are the only
// CylinderGeometry in the world with radius 0.22 and 12 radial segments, which is
// how ninetyeight identified them and is a property of the built world rather
// than of the file I am about to read.
const found = await p.evaluate(() => {
  const out = { wheels: [], deck: null, axle: null, board: null, carZ: null, carX: null };
  const V = new (window.THREE?.Vector3 ?? Object)();
  window.__ct.scene?.().traverse?.(() => {});
  return out;
});

// `__ct.scene()` is not published on every build, so the robust route is the
// world's own vehicle list plus a manual walk of the car's children.
const info = await p.evaluate(() => {
  const THREE = window.__THREE ?? null;
  const scene = window.__ct.scene ? window.__ct.scene() : null;
  if (!scene) return { err: 'no __ct.scene()' };
  const wheels = [], decks = [];
  scene.traverse((o) => {
    const g = o.geometry;
    if (!g || !g.parameters) return;
    const q = g.parameters;
    if (g.type === 'CylinderGeometry' && Math.abs(q.radiusTop - 0.22) < 1e-6
      && q.radialSegments === 12) {
      const w = o.getWorldPosition(new o.position.constructor());
      o.updateWorldMatrix(true, false);
      g.computeBoundingBox();
      const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
      wheels.push({ x: +w.x.toFixed(4), y: +w.y.toFixed(4), z: +w.z.toFixed(4),
        minX: +bb.min.x.toFixed(4), maxX: +bb.max.x.toFixed(4),
        minY: +bb.min.y.toFixed(4), maxY: +bb.max.y.toFixed(4) });
    }
    if (g.type === 'BoxGeometry' && Math.abs(q.width - 1.8) < 1e-6
      && Math.abs(q.height - 0.06) < 1e-6 && Math.abs(q.depth - 1.5) < 1e-6) {
      o.updateWorldMatrix(true, false);
      g.computeBoundingBox();
      const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
      decks.push({ minX: +bb.min.x.toFixed(4), maxX: +bb.max.x.toFixed(4),
        minY: +bb.min.y.toFixed(4), maxY: +bb.max.y.toFixed(4),
        minZ: +bb.min.z.toFixed(4), maxZ: +bb.max.z.toFixed(4) });
    }
  });
  return { wheels, decks };
});
console.log(JSON.stringify(info, null, 1));
if (info.err || !info.wheels?.length) {
  console.error(`CANNOT ANSWER — the trailer wheels were not found in the scene (${info.err ?? 'no match'}).`);
  await b.close(); process.exit(3);
}

const w = info.wheels, d = info.decks?.[0];
const cx = (w[0].x + w[1].x) / 2, cz = (w[0].z + w[1].z) / 2;
console.log(`\ntrailer axle centre (${cx.toFixed(2)}, ${cz.toFixed(2)})`);
console.log(`wheel world span X: ${Math.min(...w.map((q) => q.minX)).toFixed(4)} .. ${Math.max(...w.map((q) => q.maxX)).toFixed(4)}`);
if (d) {
  console.log(`deck  world span X: ${d.minX.toFixed(4)} .. ${d.maxX.toFixed(4)}`);
  const over = Math.max(Math.max(...w.map((q) => q.maxX)) - d.maxX, d.minX - Math.min(...w.map((q) => q.minX)));
  console.log(`OVERHANG BEYOND THE DECK: ${over.toFixed(4)} m a side`);
}
const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [cx, cz]);
console.log(`ground under the axle: ${gy.toFixed(4)};  lowest wheel point: ${Math.min(...w.map((q) => q.minY)).toFixed(4)}`);
console.log(`GAP: ${(Math.min(...w.map((q) => q.minY)) - gy).toFixed(4)} m`);

// ── SHOOT IT FROM WHERE HE STANDS ─────────────────────────────────────────
// Eye height on the pavement, at the distances a player actually passes it, from
// the side and from the three-quarter rear — the two views a wheel's silhouette
// against the deck is legible from.
// YAW IS COMPUTED, NOT TYPED, and the camera PITCHES DOWN. My first cut typed
// four cardinal yaws and shot the library: the world's forward vector is
// `(sin yaw, -cos yaw)`, so a heading has to be solved for, not guessed. And at
// eye height the deck (top 0.50 m) hides the wheels (top 0.44 m) completely from
// 2 m — the first side shot was a picture of planks. The wheels only enter the
// frame from further back with the view tipped down, which is itself worth
// knowing: **a standing player beside this trailer cannot see its wheels at all.**
const look = (x, z, tx, tz) => Math.atan2(tx - x, -(tz - z));
const VIEWS = [];
// …AND FROM THE ROAD, WHICH IS THE −x SIDE. +x at 5 m is inside the used-car
// lot's chain-link and a street tree, so those frames were a picture of a fence.
// The player walks past this on the carriageway.
for (const d of [3.0, 5.0, 7.0]) {
  VIEWS.push([`road-${d}m`, cx - d, cz, -0.22]);
  VIEWS.push([`roadq-${d}m`, cx - d * 0.71, cz + d * 0.71, -0.22]);
}
for (const [name, x, z, pitch] of VIEWS) {
  const g = await p.evaluate(([a, c]) => window.__ct.groundAt(a, c), [x, z]);
  const yaw = look(x, z, cx, cz);
  await p.evaluate(([a, c, y, gg, pi]) => window.__ct.warp(a, c, y, gg, pi), [x, z, yaw, g, pitch]);
  await waitPainted(p);
  await p.waitForTimeout(500);
  await p.screenshot({ path: `shots/w114-trailer-${name}.png` });
  console.log(`  shot shots/w114-trailer-${name}.png  from (${x.toFixed(2)}, ${z.toFixed(2)}) yaw ${yaw.toFixed(2)} pitch ${pitch}`);
}
console.log(`\nconsole errors: ${errs.length}`);
await b.close();
