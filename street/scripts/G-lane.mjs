// Builder G — lane sweep. GOTCHAS §9: the 2 m sidewalk lane is sacred and the
// user checks it constantly. A first pass walking south down the east walk
// stopped dead at z ≈ -22.4, well short of the pawn shop, so this walks every
// lane across the walk's width to find out whether the walk is blocked or just
// pinched — and how far the side-street walk actually carries.
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4186/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

const at = () => p.evaluate(() => window.__ct.pos());
const warp = (x, z, yaw, gy) => p.evaluate(([x, z, yaw, gy]) => window.__ct.warp(x, z, yaw, gy), [x, z, yaw, gy]);
const hold = async (key, ms) => {
  await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key);
  await p.waitForTimeout(100);
};
const f2 = (n) => n.toFixed(2);
const KERB = 0.14;

// walk `axis` in `dir` from `start` until progress stops, and report where
async function run(fixed, axis, start, dir, yaw, limit, steps = 30) {
  if (axis === 'z') await warp(fixed, start, yaw, KERB);
  else await warp(start, fixed, yaw, KERB);
  await p.waitForTimeout(200);
  let last = start;
  for (let i = 0; i < steps; i++) {
    await hold('w', 600);
    const q = await at();
    const cur = axis === 'z' ? q[2] : q[0];
    if (Math.abs(cur - last) < 0.12) return { end: cur, stuck: true };
    last = cur;
    if (dir < 0 ? cur <= limit : cur >= limit) return { end: cur, stuck: false };
  }
  return { end: last, stuck: false };
}

// The bishop-crook lamps stand at bx = ROAD_HALF + 0.55 = 5.55 with a
// ±0.2 collider (props.ts), and the building wall collider starts at
// FACE - 0.3 = 6.7. That leaves 6.7 - 5.75 = 0.95 m of clear walk past a lamp
// and the capsule is 0.72 m across — passable, but the centre has to be inside
// a 0.23 m band. Walking dead straight down any other lane stops at the lamp,
// which is what a first pass of this probe reported as "blocked".
console.log('EAST WALK, walking south (yaw 0 = -z), from z = -9.5 toward the pawn shop at -59');
console.log('the walk is x ∈ (5.0, 7.0); capsule radius 0.36; east lamps at z = -23, -51, -79');
for (const lane of [5.40, 5.90, 6.10, 6.22, 6.30]) {
  const r = await run(lane, 'z', -9.5, -1, 0, -62);
  console.log(`  x = ${f2(lane)}   reached z = ${f2(r.end).padStart(7)}   ${r.stuck ? 'STUCK' : 'clear'}`);
}

console.log('\nNORTH SIDE-STREET WALK, walking east (yaw π/2 = +x), from x = 14 to the east end');
console.log('the walk is z ∈ (-98, -96)');
for (const lane of [-96.8, -97.1, -97.4, -97.7]) {
  const r = await run(lane, 'x', 14, 1, Math.PI / 2, 56);
  console.log(`  z = ${f2(lane)}  reached x = ${f2(r.end).padStart(6)}   ${r.stuck ? 'STUCK' : 'clear'}`);
}

await b.close();
