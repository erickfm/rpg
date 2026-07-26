// VERIFYING M's bank interior — I did not build it, so I may.
//
// M measured the LOAN thoroughly and measured it well: the cash is read off
// A's ATM on the pavement rather than off M's own prompt, which is somebody
// else's code reading the same number. Repeating that would teach nobody
// anything.
//
// So this tests the one claim in M's row that ONLY WALKING CAN SETTLE, and
// which this project insists is never taken from a screenshot:
//
//   *"A VAULT YOU CAN WALK INTO … a sill you step over"*
//
// A strongroom you can see into and not enter is a very different object from
// one you can stand inside, and the difference is invisible in a still.
//
//   SHOT_URL=http://localhost:PORT/ node scripts/O-verify-M-vault.mjs
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
await afterFrames(p, 10); await p.waitForTimeout(1200);
await p.evaluate(() => window.__ct.clock(13, 0));
await afterFrames(p, 6);

let bad = 0, n = 0;
const ok = (c, m) => { n++; console.log(`${c ? 'OK  ' : 'NO  '} ${m}`); if (!c) bad++; };

// ── population first (GOTCHAS 34): is there a bank room at all? ───────────
const R = await p.evaluate(() => (window.__ct.roomDims() ?? []).find((r) => r.id === 'bank') ?? null);
if (!R) { console.error('ABORT: no room with id "bank" — nothing below measures M\'s work'); await b.close(); process.exit(3); }
console.log(`the bank: ${R.w} x ${R.d} centred (${R.cx}, ${R.cz})`);
const hw = R.w / 2, hd = R.d / 2;

/** hold a key until progress stops, rather than for a fixed time — a fixed
 *  hold is a bet on how busy the machine is (GOTCHAS 30), and it fails in the
 *  direction that reports a walkable room as a wall. */
const walk = async (key, maxSteps = 90) => {
  const start = await p.evaluate(() => window.__ct.pos());
  await p.keyboard.down(key);
  let last = null, still = 0;
  for (let i = 0; i < maxSteps && still < 6; i++) {
    await afterFrames(p, 3);
    const q = await p.evaluate(() => window.__ct.pos());
    if (last && Math.hypot(q[0] - last[0], q[2] - last[2]) < 0.01) still++; else still = 0;
    last = q;
  }
  await p.keyboard.up(key);
  const end = await p.evaluate(() => window.__ct.pos());
  return { start, end, moved: Math.hypot(end[0] - start[0], end[2] - start[2]) };
};

// ── find the vault by ASKING the world where it is ────────────────────────
//
// M says back-LEFT corner. "Left" is the term GOTCHAS 33 warns about, so it is
// not the thing to aim from: instead sweep the room's floor for the corner
// with the most solid around it and walk at each candidate. Two candidates,
// both walked, and the finding says which.
const CORNERS = [
  ['back-left  (−x, −z)', -hw + 1.6, -hd + 1.6],
  ['back-right (+x, −z)', hw - 1.6, -hd + 1.6],
];
const results = [];
for (const [name, lx, lz] of CORNERS) {
  // stand in the MIDDLE of the room and walk at the corner, so the walk is a
  // real approach and not a spawn already inside it
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [R.cx, R.cz]);
  await afterFrames(p, 5);
  const here = await p.evaluate(() => window.__ct.pos().map((v) => +v.toFixed(2)));
  if (Math.hypot(here[0] - R.cx, here[2] - R.cz) > 0.6) {
    console.log(`  SKIPPED ${name}: could not stand in the middle of the room`); continue;
  }
  // aim at the corner and walk
  const yaw = Math.atan2((R.cx + lx) - here[0], -((R.cz + lz) - here[2]));
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0), [here[0], here[2], yaw]);
  await afterFrames(p, 4);
  const w = await walk('w');
  const dToCorner = Math.hypot(w.end[0] - (R.cx + lx), w.end[2] - (R.cz + lz));
  results.push({ name, moved: +w.moved.toFixed(2), dToCorner: +dToCorner.toFixed(2),
                 end: w.end.map((v) => +v.toFixed(2)) });
  console.log(`  ${name}: walked ${w.moved.toFixed(2)} m, stopped ${dToCorner.toFixed(2)} m from the corner`);
  await p.screenshot({ path: `shots/O-verify-M-${name.split(' ')[0]}.png` });
}

const best = results.sort((a, z) => a.dToCorner - z.dToCorner)[0];
ok(!!best && best.dToCorner < 2.6,
  `one of the back corners is REACHABLE ON FOOT from the middle of the room — ` +
  `${best?.name} stopped ${best?.dToCorner} m from it after ${best?.moved} m of walking`);

// ── is it a ROOM INSIDE A ROOM, or just a corner? ─────────────────────────
//
// The claim that makes this different from every other interior is *"Every
// other interior here is one space; this one has a room inside it."* A corner
// dressed as a vault has no enclosure; a strongroom does. So from where the
// walk stopped, try to walk out in the two directions that lead back into the
// banking hall and see whether something stands between.
if (best) {
  await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [best.end[0], best.end[2]]);
  await afterFrames(p, 5);
  const walls = [];
  for (const [label, yaw] of [['toward +x', Math.PI / 2], ['toward -x', -Math.PI / 2],
                              ['toward +z', Math.PI], ['toward -z', 0]]) {
    await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0), [best.end[0], best.end[2], yaw]);
    await afterFrames(p, 4);
    const w = await walk('w', 40);
    walls.push({ label, moved: +w.moved.toFixed(2) });
    await p.evaluate(([x, z]) => window.__ct.warp(x, z, 0, 0, 0), [best.end[0], best.end[2]]);
    await afterFrames(p, 4);
  }
  console.log(`  from inside, travel in each direction: ${JSON.stringify(walls)}`);
  const blocked = walls.filter((w) => w.moved < 1.4).length;
  ok(blocked >= 2,
    `it is ENCLOSED — ${blocked} of 4 directions stop you inside 1.4 m, which is a ` +
    `room inside a room rather than a dressed corner`);
  ok(walls.some((w) => w.moved > 2.0),
    'and it is not a sealed box — at least one direction leads back out');
}

console.log(`\n${n} checks, ${bad} disagreed`);
await b.close();
process.exit(bad ? 1 : 0);
