// DOES A PASSING CAR BECOME A WALL BESIDE THE CAB ROOF?
//
// w21 saw `STUCK left 1.50 -> 1.50 at -3.02,-30.52` once — the player stopped
// 0.14 m short of the roof edge — could not reproduce it in three further runs,
// and reported the hypothesis rather than burying it: *"every collider in the
// world except this truck's four is still a wall at every height, and
// ct/traffic.ts drives vehicle boxes down exactly that lane, so my best
// hypothesis is a passing vehicle blocking at roof height."*
//
// It is checkable without a player, and that is the point of doing it this way:
// reproducing it through the keyboard needs a car to be in the right place
// during an 1800 ms window, which is why it took four loaded climbs to see once.
// The COLLIDERS answer the same question directly and every frame.
//
// `ct/traffic.ts` sets no `maxY` anywhere (fp.ts:12 — "a collider with maxY
// undefined is still a wall"), so any traffic box that reaches the roof's
// footprint blocks a player standing on it, 1.5 m up, with nothing visible at
// eye level to explain it.
//
// Samples the live collider list and reports, per frame, the smallest gap
// between a MOVING box and the roof's footprint grown by the player capsule.
// A gap of 0 is a blocked edge.
//
//   SHOT_URL=http://localhost:4186/ node scripts/probes/w22-traffic-at-roof-height.mjs [seconds]
import { chromium } from 'playwright';

const R = 0.36;                     // player capsule radius, fp.ts
const SECS = Number(process.argv[2] ?? 60);
const URL = process.env.SHOT_URL;
if (!URL) { console.error('ABORTED: set SHOT_URL to your own port'); process.exit(3); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });

const roof = await p.evaluate(() =>
  window.__ct.colliders().find((c) => c.tag === 'pickup-cab-roof') ?? null);
if (!roof) { console.log('ABORTED: no pickup-cab-roof collider'); process.exit(3); }
console.log(`cab roof: x ${roof.minX.toFixed(2)}..${roof.maxX.toFixed(2)}  `
  + `z ${roof.minZ.toFixed(2)}..${roof.maxZ.toFixed(2)}  top y ${roof.maxY}`);
console.log(`watching ${SECS}s for boxes that MOVE and have no maxY\n`);

const out = await p.evaluate(async ({ roof, R, SECS }) => {
  const key = (c) => `${c.minX.toFixed(3)},${c.minZ.toFixed(3)},${c.maxX.toFixed(3)}`;
  // A box's identity is not stable frame to frame, so "moving" is decided on
  // the POPULATION: anything whose key was not in the first frame's set has
  // moved since. The parked fleet and the buildings never change key.
  const first = new Set(window.__ct.colliders().map(key));
  // the roof footprint grown by the capsule: a player on the roof is blocked
  // wherever a wall reaches into this
  const gx0 = roof.minX - R, gx1 = roof.maxX + R;
  const gz0 = roof.minZ - R, gz1 = roof.maxZ + R;
  let worst = Infinity, hits = 0, frames = 0, sample = null;
  const t0 = performance.now();
  await new Promise((done) => {
    const tick = () => {
      frames++;
      for (const c of window.__ct.colliders()) {
        if (c.maxY !== undefined) continue;             // height-capped: not a wall up there
        if (first.has(key(c))) continue;                // never moved: scenery
        if (!isFinite(c.minX) || Math.abs(c.minX) > 500) continue;
        // gap between two AABBs, 0 when they overlap
        const dx = Math.max(gx0 - c.maxX, c.minX - gx1, 0);
        const dz = Math.max(gz0 - c.maxZ, c.minZ - gz1, 0);
        const g = Math.hypot(dx, dz);
        if (g < worst) {
          worst = g;
          sample = { minX: +c.minX.toFixed(2), maxX: +c.maxX.toFixed(2),
                     minZ: +c.minZ.toFixed(2), maxZ: +c.maxZ.toFixed(2), gap: +g.toFixed(3) };
        }
        if (g === 0) hits++;
      }
      if (performance.now() - t0 > SECS * 1000) return done();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  return { worst, hits, frames, sample, moving: window.__ct.colliders().filter((c) => !first.has(key(c))).length };
}, { roof, R, SECS });
await b.close();

console.log(`${out.frames} frames watched, ${out.moving} boxes had moved by the end`);
console.log(`closest a moving wall came to the roof's standing area: ${out.worst === Infinity ? 'never came near' : out.worst.toFixed(3) + ' m'}`);
if (out.sample) console.log(`  nearest box: x ${out.sample.minX}..${out.sample.maxX}  z ${out.sample.minZ}..${out.sample.maxZ}`);
console.log(`frames where one REACHED it (a blocked edge at roof height): ${out.hits}`);
console.log(out.hits
  ? '\nCONFIRMED: a moving collider with no maxY reaches the roof. A player standing\n'
    + 'there is blocked by something that is not drawn at his height.'
  : '\nNot seen in this window. The gap above is how close it got.');
process.exit(0);
