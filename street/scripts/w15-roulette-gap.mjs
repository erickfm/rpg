// HOW MUCH STANDING ROOM IS THERE BEHIND EACH ROULETTE PLACE?
//
// Item 26. w17 reports the place directly north of the wheel (casino local
// (-3.1, 1.75) = world (676.90, 1.75)) sits in an 0.08 m sliver between the
// felt and the last slot bank, with no legal approach in any direction.
//
// The ring is picked out of the live registry, not typed: the five seats
// labelled 'sit at the table' that lie on a common circle of radius 1.55.
import { chromium } from 'playwright';
import { reportWorld } from './lib/which-world.mjs';
const URL = process.env.SHOT_URL ?? 'http://localhost:4194/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 620 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const R = await p.evaluate(() => {
  const seats = window.__ct.seats().filter((s) => s.label === 'sit at the table');
  const cols = window.__ct.colliders();
  // THE RING, FITTED. Five stools sit at 1.55 m from the wheel; the wheel's
  // centre is the point every one of them is equidistant from. Find it by
  // taking each seat's ring-mates and testing for a common centre, so moving
  // the table moves this check with it.
  let ring = null;
  for (const s of seats) {
    const near = seats.filter((q) => Math.hypot(q.pose.x - s.pose.x, q.pose.z - s.pose.z) < 3.2);
    if (near.length !== 5) continue;
    // the centre is one stride in FRONT of each seat along its own yaw
    const c = near.map((q) => ({ x: q.pose.x + Math.sin(q.pose.yaw) * 1.55,
                                 z: q.pose.z - Math.cos(q.pose.yaw) * 1.55 }));
    const cx = c.reduce((a, q) => a + q.x, 0) / 5, cz = c.reduce((a, q) => a + q.z, 0) / 5;
    if (c.every((q) => Math.hypot(q.x - cx, q.z - cz) < 0.05)) { ring = { seats: near, cx, cz }; break; }
  }
  if (!ring) return { err: 'could not fit the roulette ring' };

  const CAP = 0.36;                        // the player capsule (GOTCHAS 29)
  const solidAt = (x, z) => cols.find((c) =>
    x > c.minX - CAP / 2 && x < c.maxX + CAP / 2 && z > c.minZ - CAP / 2 && z < c.maxZ + CAP / 2);
  // The clear gap along +z behind the seat: walk outward until something solid.
  const gapBehind = (s) => {
    const ux = -Math.sin(s.pose.yaw), uz = Math.cos(s.pose.yaw);   // straight back
    let d = 0;
    for (; d < 4; d += 0.01) if (solidAt(s.pose.x + ux * d, s.pose.z + uz * d)) break;
    return d;
  };
  // Largest clear arc a capsule could stand in, at the 0.8 m approach radius.
  const arc = (s) => {
    let best = 0, run = 0;
    for (let k = 0; k < 360; k++) {
      const a = (k / 360) * Math.PI * 2;
      if (solidAt(s.pose.x + Math.sin(a) * 0.8, s.pose.z + Math.cos(a) * 0.8)) run = 0;
      else { run++; best = Math.max(best, run); }
    }
    return best;
  };
  return {
    cx: +ring.cx.toFixed(2), cz: +ring.cz.toFixed(2),
    rows: ring.seats.map((s) => ({
      x: +s.pose.x.toFixed(2), z: +s.pose.z.toFixed(2), yaw: +s.pose.yaw.toFixed(2),
      ax: +s.at.x.toFixed(2), az: +s.at.z.toFixed(2),
      approachBlocked: !!solidAt(s.at.x, s.at.z),
      gap: +gapBehind(s).toFixed(2), arcDeg: arc(s),
    })).sort((a, c) => a.x - c.x),
  };
});
if (R.err) { console.error(R.err); await b.close(); process.exit(2); }
console.log(`\n  roulette wheel fitted at (${R.cx}, ${R.cz}); five places on its open side\n`);
console.log('  seat                 approach          clear behind   widest standing arc');
let bad = 0;
for (const r of R.rows) {
  const ok = !r.approachBlocked && r.arcDeg >= 30;
  if (!ok) bad++;
  console.log(`  (${String(r.x).padStart(7)},${String(r.z).padStart(6)}) yaw ${String(r.yaw).padStart(5)}  ` +
    `(${String(r.ax).padStart(7)},${String(r.az).padStart(6)}) ${r.approachBlocked ? 'BLOCKED' : 'clear  '}  ` +
    `${String(r.gap.toFixed(2)).padStart(5)} m      ${String(r.arcDeg).padStart(3)} deg  ${ok ? '' : '<-- UNREACHABLE'}`);
}
console.log(bad ? `\nFAIL: ${bad} of 5 roulette places have no legal approach`
                : '\nPASS: all 5 roulette places have a clear approach and standing room');
await b.close();
process.exit(bad ? 1 : 0);
