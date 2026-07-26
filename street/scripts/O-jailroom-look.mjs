// PICTURES of the jail's interior, from where a player stands — arriving,
// waiting, at the counter, down the corridor, into a cell. An investigation
// (GOTCHAS 24); `O-jail-walk.mjs` is what asserts.
//
//   SHOT_URL=http://localhost:4297/ node scripts/O-jailroom-look.mjs
import { chromium } from 'playwright';
import { afterFrames } from './lib/frames.mjs';
import { reportWorld } from './lib/which-world.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('aim it: SHOT_URL=http://localhost:PORT/'); process.exit(2); }
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await reportWorld(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await afterFrames(p, 10); await p.waitForTimeout(1000);

// Find the room from the WORLD rather than typing its slab address — a room
// that moves slab between builds is a room whose hand-typed probe is wrong and
// does not say so (GOTCHAS 20).
const R = await p.evaluate(() => (window.__ct.roomDims() ?? []).find((r) => r.id === 'jail') ?? null);
if (!R) { console.error('ABORT: no room with id "jail" — nothing to photograph'); await b.close(); process.exit(3); }
console.log(`jail room: ${R.w} x ${R.d} centred (${R.cx}, ${R.cz})`);
const wx = (lx) => R.cx + lx, wz = (lz) => R.cz + lz;
const hd = R.d / 2, hw = R.w / 2;

for (const [n, lx, lz, tlx, tlz, pi] of [
  ['arrive', 0, hd - 1.2, 0, -hd, 0.0],            // the frame the kit puts you in
  ['lobby', 0, hd - 4.5, -hw, hd - 3.0, 0.0],       // the bench and whoever is on it
  ['bench', 2.0, hd - 3.0, -hw, hd - 3.0, 0.0],     // straight at the sitter
  ['board', hw - 2.4, hd - 2.2, hw, hd - 2.2, 0.05],
  ['counter', 0, hd - 8.0, 0, -hd, 0.02],           // walking up to the counter
  ['atglass', 0, hd - 6.6, 0, -hd, 0.05],           // where you are spoken to
  ['gate', 0, hd - 10.0, 0, -hd, 0.0],
  ['corridor', 0, 0, 0, -hd, 0.0],
  ['cell', 1.4, -4.0, hw, -4.0, 0.0],               // into a cell through the bars
  ['back', 0, -hd + 1.5, 0, hd, 0.0],               // turn round: GOTCHAS 41
  ['ceiling', 0, hd - 5.0, 0, -hd, 0.55],           // the troffers and the dead ones
]) {
  const x = wx(lx), z = wz(lz);
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0),
    [x, z, Math.atan2(wx(tlx) - x, -(wz(tlz) - z))]);
  await afterFrames(p, 5);
  const q = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
  if (Math.hypot(q[0] - x, q[2] - z) > 0.4) { console.log(`  SKIPPED ${n}: wanted (${x},${z}) stood (${q[0]},${q[2]})`); continue; }
  await p.evaluate(([pi]) => window.__ct.warp(window.__ct.pos()[0], window.__ct.pos()[2], undefined, undefined, pi), [pi]);
  await afterFrames(p, 3);
  await p.screenshot({ path: `shots/O-room-${n}.png` });
  console.log(`  O-room-${n}.png at local (${lx}, ${lz})`);
}
await b.close();
