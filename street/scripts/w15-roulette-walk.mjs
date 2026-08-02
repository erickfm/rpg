// SIT IN ALL FIVE ROULETTE PLACES, for real.
//
// Item 26's DONE WHEN is "the seat has a legal standing approach". A clear
// approach POINT is arithmetic; this is the walk. For each place: warp to the
// registered approach, walk in with a held W, press and HOLD E (a tap can begin
// and end inside one frame and never be seen — BUILDER-BRIEF §5), confirm the
// player is seated at that stool, then press E again and confirm they are back
// on their feet. A seat you cannot leave is the worst bug this project ships.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4194/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 620 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

// the ring, fitted from the live registry — never a typed coordinate
const ring = await p.evaluate(() => {
  const seats = window.__ct.seats().filter((s) => s.label === 'sit at the table');
  for (const s of seats) {
    const near = seats.filter((q) => Math.hypot(q.pose.x - s.pose.x, q.pose.z - s.pose.z) < 3.2);
    if (near.length !== 5) continue;
    const c = near.map((q) => ({ x: q.pose.x + Math.sin(q.pose.yaw) * 1.55,
                                 z: q.pose.z - Math.cos(q.pose.yaw) * 1.55 }));
    const cx = c.reduce((a, q) => a + q.x, 0) / 5, cz = c.reduce((a, q) => a + q.z, 0) / 5;
    if (c.every((q) => Math.hypot(q.x - cx, q.z - cz) < 0.05))
      return near.map((q) => ({ x: q.pose.x, z: q.pose.z, yaw: q.pose.yaw, ax: q.at.x, az: q.at.z }))
        .sort((a, c2) => a.z - c2.z);
  }
  return null;
});
if (!ring) { console.error('could not fit the roulette ring'); await b.close(); process.exit(2); }

const pos = () => p.evaluate(() => window.__ct.pos());
const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); };
let fails = 0;
const report = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };
const f = (n) => n.toFixed(2);

console.log(`\nfive roulette places, walked:\n`);
for (const [i, s] of ring.entries()) {
  // WALK IN FROM THE AVENUE, which is the way a player actually arrives — down
  // the centre lane and across to the table. Two earlier versions of this
  // approached RADIALLY, from directly behind the seat, and both were measuring
  // themselves rather than the room: the first held W for ~1.8 m and overshot
  // onto the next stool round, and the second warped its start point INSIDE the
  // poker table for the place nearest it, where unstick() shoved the player
  // 0.78 m sideways before the walk began. An approach point 0.19 m from a
  // solid is legal to STAND on and impossible to back into; a player comes at
  // it from the open floor, not from inside the furniture.
  const sx0 = 680.0, sz0 = s.az;                       // the avenue, level with the seat
  const dist = Math.hypot(s.ax - sx0, s.az - sz0);
  const yaw = Math.atan2(s.ax - sx0, -(s.az - sz0));
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0.0, 0), [sx0, sz0, yaw]);
  await p.waitForTimeout(220);
  const start = await pos();
  await hold('w', Math.min(1400, Math.round((dist / 2.6) * 1000)));
  await p.waitForTimeout(120);
  const arrived = await pos();
  const walked = Math.hypot(arrived[0] - start[0], arrived[2] - start[2]);
  const dToApp = Math.hypot(arrived[0] - s.ax, arrived[2] - s.az);
  report(`place ${i + 1} — walk in from the avenue`, walked > 0.4 && dToApp < 0.9,
    `moved ${f(walked)} m across the floor, stopped ${f(dToApp)} m from the approach`);

  await hold('e', 120);
  await p.waitForTimeout(320);
  const seated = await p.evaluate(() => window.__ct.pos());
  const onStool = Math.hypot(seated[0] - s.x, seated[2] - s.z) < 0.30;
  report(`place ${i + 1} — [E] seats you`, onStool,
    `player at (${f(seated[0])}, ${f(seated[2])}), stool at (${f(s.x)}, ${f(s.z)})`);

  await hold('e', 120);
  await p.waitForTimeout(320);
  const up = await p.evaluate(() => window.__ct.pos());
  const gotUp = Math.hypot(up[0] - s.x, up[2] - s.z) > 0.30;
  // NOT `gotUp || !onStool` — that let the clause pass for free on any place
  // where the sit had already failed, which is exactly the sleeping-guard
  // family. If you never sat down, this says so instead of passing.
  report(`place ${i + 1} — [E] stands you back up`, onStool && gotUp,
    !onStool ? 'never sat down, so standing up was not tested'
             : gotUp ? `player at (${f(up[0])}, ${f(up[2])})` : 'STILL ON THE STOOL');
}
report('no console errors', errs.length === 0, `${errs.length} page error(s)`);
console.log(fails ? `\n${fails} FAILED` : '\nall five places can be walked to, sat in, and left');
await b.close();
process.exit(fails ? 1 : 0);
