// DO TRAFFIC AND CITIZEN BOXES EVER REACH A PLACE A PLAYER CAN STAND?
//
// `ct/traffic.ts` sets `maxY` nowhere, so every moving vehicle box is a wall at
// every height — the same class the parked cars were in before item 29. That is
// only a defect if a moving box can reach somewhere a player's feet can be off
// the ground, and there are exactly two such places in this world: the pickup's
// four tiers and the sedan's two.
//
// The danger is not "can I stand on a bus". It is the REVERSE: a full-height
// box sweeping through the footprint of a standable tier blocks a player who is
// standing there, and `unstick()` then shoves them off — which is w21's
// unreproduced STUCK on the cab roof, reported once under load.
//
// So the number that closes this is: the minimum horizontal gap, over a long
// sample, between any MOVING collider and each standable tier, measured
// against the RADIUS that decides whether it blocks you.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w29-traffic-reach.mjs
import { chromium } from 'playwright';

const RADIUS = 0.36;                       // fp.ts:41
const FRAMES = Number(process.env.FRAMES ?? 2400);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4188/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

// Stand out on the street so traffic actually runs, and let it get going.
await p.evaluate(() => window.__ct.warp(-1, -30, Math.PI, 0, 0));
await p.waitForTimeout(1500);

const out = await p.evaluate(async (args) => {
  const { FRAMES, RADIUS } = args;
  const cols = window.__ct.colliders();
  const tiers = cols.filter((c) => c.maxY !== undefined && c.tag);
  // A collider is MOVING if its box changes between frames. Derived rather than
  // guessed from a tag: traffic registers through ctx.vehicleBox and citizens
  // through citAvoid, and neither stamps a tag, so "it moved" is the only
  // honest test and it also catches anything new that starts moving later.
  const key = (c) => `${c.minX},${c.maxX},${c.minZ},${c.maxZ}`;
  const first = new Map(cols.map((c) => [c, key(c)]));
  const moved = new Set();
  const best = new Map(tiers.map((t) => [t.tag, Infinity]));
  let withMaxY = 0, sampled = 0;

  await new Promise((done) => {
    const tick = () => {
      sampled++;
      for (const c of cols) {
        if (key(c) !== first.get(c)) moved.add(c);
      }
      for (const c of moved) {
        if (c.maxY !== undefined) withMaxY++;
        for (const t of tiers) {
          // horizontal gap between the two boxes: 0 means they overlap
          const gx = Math.max(t.minX - c.maxX, c.minX - t.maxX, 0);
          const gz = Math.max(t.minZ - c.maxZ, c.minZ - t.maxZ, 0);
          const g = Math.hypot(gx, gz);
          if (g < best.get(t.tag)) best.set(t.tag, g);
        }
      }
      if (sampled >= FRAMES) return done();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  return {
    sampled, colliders: cols.length, tiers: tiers.map((t) => t.tag),
    movers: moved.size, moversWithMaxY: withMaxY,
    best: [...best.entries()].map(([tag, g]) => ({ tag, gap: +g.toFixed(3) })),
  };
}, { FRAMES, RADIUS });

console.log(`sampled ${out.sampled} frames, ${out.colliders} colliders, ` +
  `${out.movers} of them MOVED during the sample`);
console.log(`moving colliders that carry a maxY (i.e. are standable): ${out.moversWithMaxY}`);
console.log(`\nclosest a moving box ever came to each standable tier ` +
  `(0 = overlapped it; < ${RADIUS} = would block a player standing there):`);
let worst = Infinity;
for (const r of out.best.sort((a, c) => a.gap - c.gap)) {
  worst = Math.min(worst, r.gap);
  console.log(`  ${r.tag.padEnd(20)} ${r.gap === Infinity ? 'never' : r.gap.toFixed(3) + ' m'}` +
    `${r.gap < RADIUS ? '   <-- CAN BLOCK' : ''}`);
}
console.log(`\nVERDICT: closest approach over the whole sample is ${worst.toFixed(3)} m, ` +
  `against a RADIUS of ${RADIUS} m.`);
console.log(worst < RADIUS
  ? '  A moving box CAN reach a tier a player stands on — traffic needs a maxY.'
  : `  Nothing moving comes within RADIUS of anything standable. Traffic boxes\n` +
    `  having no maxY is INERT: there is no height at which a player can meet one.`);
await b.close();
