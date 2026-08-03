// WHERE IS w40-bed-vs-door's "both offers must actually fire" STATION, really?
//
// That assertion went red on item 140's tier reorder while the END TWO BAND
// assertion right above it stayed green — and those two are supposed to be
// about the same pose. Before believing either, find out where the check is
// actually standing when it fires. It prints its distance to the BED and not
// to the DOOR, and the door is the whole question.
//
// This replicates the check's own navigation exactly (warp to the door, walk in
// facing the bed, band-walk out facing the door, band-walk back in facing the
// bed, then walkUntil > 0.55 m from the bed) and prints the full pose.
//
//   SHOT_URL=http://localhost:4185/ node scripts/probes/w54-firing-station.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4185/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(2000);
await reportWorld(p, URL);

const prompt = () => p.evaluate(() => {
  const el = document.getElementById('ct-prompt');
  const t = (el?.textContent ?? '').trim();
  return t ? t.replace(/^\s*\[E\]\s*/, '') : null;
});
const pos = () => p.evaluate(() => { const q = window.__ct.pos(); return { x: q[0], z: q[2] }; });
const yaw = () => p.evaluate(() => window.__ct.yaw());
const frames = (n = 2) => p.evaluate((k) => new Promise((r) => {
  let i = 0; const tick = () => (++i >= k ? r() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
}), n);
const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const bearing = (from, to) => Math.atan2(to.x - from.x, -(to.z - from.z));

async function turnTo(want) {
  for (let i = 0; i < 120; i++) {
    const err = norm(want - (await yaw()));
    if (Math.abs(err) < 0.04) return true;
    const key = err > 0 ? 'ArrowRight' : 'ArrowLeft';
    await p.keyboard.down(key);
    await p.waitForTimeout(Math.min(260, Math.max(30, (Math.abs(err) / 1.7) * 1000)));
    await p.keyboard.up(key);
    await frames(2);
  }
  return false;
}
async function walkUntil(done) {
  for (let i = 0; i < 90; i++) {
    const at = await pos();
    if (done(at)) return at;
    await p.keyboard.down('w'); await p.waitForTimeout(30); await p.keyboard.up('w');
    await frames(2);
  }
  return await pos();
}

// READ OFF `__ct`, NOT IMPORTED (item 232). `await import('/src/proto/fp.ts')`
// 404s on `vite preview` — the bundle serves `dist/` and that path is not in
// it — so this returned nothing on the build that ships. Both are published:
// `touchMargin()` at `crosstown.ts:1629`, `playerRadius()` at `:1643`.
const K = await p.evaluate(() => ({
  TOUCH_MARGIN: window.__ct.touchMargin(), RADIUS: window.__ct.playerRadius(),
}));
if (![K.TOUCH_MARGIN, K.RADIUS].every((v) => typeof v === 'number' && isFinite(v))) {
  console.error(`ABORT: constants did not resolve off __ct — ${JSON.stringify(K)}`);
  await b.close(); process.exit(3);
}
const gy = await p.evaluate(() => window.__ct.groundAt(199.36, -15.545));
await p.evaluate(([gy]) => window.__ct.warp(199.36, -15.545, 0, gy, 0), [gy]);
await p.waitForTimeout(700);
const spots = await p.evaluate(() =>
  window.__ct.spots().filter((s) => s.ok && s.x > 190 && s.x < 210 && s.z > -22 && s.z < -10));
const bed = spots.find((s) => /sit on the bed/i.test(s.label));
const door = spots.find((s) => /close the door/i.test(s.label));
const sleep = spots.find((s) => /sleep until/i.test(s.label));
console.log(`\nbed  (${bed.x.toFixed(2)}, ${bed.z.toFixed(2)}) r${bed.r}`);
console.log(`door (${door.x.toFixed(2)}, ${door.z.toFixed(2)}) r${door.r}`);
console.log(`bed<->door separation ${Math.hypot(bed.x - door.x, bed.z - door.z).toFixed(2)} m`);

// ── the check's own navigation ────────────────────────────────────────────
await p.evaluate(([x, z, y, gy]) => window.__ct.warp(x, z, y, gy, 0),
  [door.x, door.z, bearing(door, bed), gy]);
await p.waitForTimeout(400);
await walkUntil((q) => Math.hypot(q.x - bed.x, q.z - bed.z) < 0.30);

const REACH = bed.r + K.TOUCH_MARGIN;
async function bandWalk(face, until) {
  for (let i = 0; i < 60; i++) {
    const at = await pos();
    await turnTo(bearing(at, face));
    if (until(at, Math.hypot(at.x - bed.x, at.z - bed.z))) break;
    await p.keyboard.down('w'); await p.waitForTimeout(30); await p.keyboard.up('w');
    await frames(2);
  }
}
await bandWalk(door, (_, dBed) => dBed > REACH + 0.15);
await bandWalk(bed, (_, dBed) => dBed < K.RADIUS + 0.05);
console.log(`\nafter the inward band walk, at ${JSON.stringify(await pos())}, facing the BED`);
const fireAt = await walkUntil((q) => Math.hypot(q.x - bed.x, q.z - bed.z) > 0.55);

const dBed = Math.hypot(fireAt.x - bed.x, fireAt.z - bed.z);
const dDoor = Math.hypot(fireAt.x - door.x, fireAt.z - door.z);
const dSleep = Math.hypot(fireAt.x - sleep.x, fireAt.z - sleep.z);
console.log(`\nFIRING STATION  (${fireAt.x.toFixed(2)}, ${fireAt.z.toFixed(2)})`);
console.log(`  to bed    ${dBed.toFixed(2)} m   touch<${(bed.r + K.TOUCH_MARGIN).toFixed(2)}  ${dBed < bed.r + K.TOUCH_MARGIN ? 'TOUCHING' : 'not touching'}`);
console.log(`  to door   ${dDoor.toFixed(2)} m   touch<${(door.r + K.TOUCH_MARGIN).toFixed(2)}  ${dDoor < door.r + K.TOUCH_MARGIN ? 'TOUCHING' : 'not touching'}`);
console.log(`  to sleep  ${dSleep.toFixed(2)} m`);

// WHICH SIDE OF THE BED IS IT ON? Project onto the bed->door axis: positive
// means "between the bed and the door" (the user's walk-out pose), negative
// means "the bed is between the player and the door" — a different pose
// entirely, and not the one END TWO is quoted about.
const ax = door.x - bed.x, az = door.z - bed.z;
const L = Math.hypot(ax, az);
const proj = ((fireAt.x - bed.x) * ax + (fireAt.z - bed.z) * az) / L;
console.log(`  projection on the bed->door axis: ${proj.toFixed(2)} m of ${L.toFixed(2)}`);
console.log(`  => the player is ${proj > 0 ? 'BETWEEN the bed and the door (the quoted pose)'
  : 'on the FAR SIDE of the bed, with the bed between him and the door'}`);

await turnTo(bearing(fireAt, door));
console.log(`\n  facing the door -> [E] ${await prompt()}`);
await b.close();
