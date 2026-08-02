// CAN YOU GET OFF THE ROOF AGAIN? The roof is the first place in this world a
// player can climb to that is not a floor, and BUILDER-BRIEF §11's rule about
// a panel you cannot close applies to a surface you cannot leave just as
// hard. So: climb up, then try to walk off in all four directions in turn,
// and confirm every one of them puts you back on a lower surface.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w21-roof-exit.mjs
import { chromium } from 'playwright';
const EYE = 1.62;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4188/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const cols = await p.evaluate(() => window.__ct.colliders());
const g = (t) => cols.find((c) => c.tag === t);
const bed = g('pickup-bed-floor'), roof = g('pickup-cab-roof');
const rail = g('pickup-rail-right').minX > (bed.minX + bed.maxX) / 2 ? g('pickup-rail-right') : g('pickup-rail-left');
const midX = (bed.minX + bed.maxX) / 2;
const tailIsPlusZ = (bed.minZ + bed.maxZ) / 2 > (roof.minZ + roof.maxZ) / 2;
const fwd = tailIsPlusZ ? -1 : 1, tailZ = tailIsPlusZ ? bed.maxZ : bed.minZ;
const yawFwd = fwd < 0 ? 0 : Math.PI;
const strafe = ((rail.minX + rail.maxX) / 2 > midX) === (yawFwd === 0) ? 'd' : 'a';

const pos = () => p.evaluate(() => window.__ct.pos());
const feet = async () => (await p.evaluate(() => window.__ct.camY())) - EYE;
const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); };
const aim = async (k, riseMs, box, ax) => {
  // space stays DOWN through the hop — BUILDER-BRIEF §5; a loaded machine can
  // produce a frame longer than the press and swallow it whole. jumpHeld
  // (fp.ts:453) means holding it cannot double-jump.
  await p.keyboard.down(' '); await p.waitForTimeout(riseMs);
  await p.keyboard.down(k);
  const lo = ax === 'x' ? box.minX : box.minZ, hi = ax === 'x' ? box.maxX : box.maxZ;
  await p.evaluate(([lo, hi, ax]) => new Promise((d) => {
    const t0 = performance.now();
    const tick = () => {
      const P = window.__ct.pos(); const v = ax === 'x' ? P[0] : P[2];
      if ((v > lo && v < hi) || performance.now() - t0 > 800) return d(v);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), [lo, hi, ax]);
  await p.keyboard.up(k);
  await p.keyboard.up(' ');
  await p.waitForTimeout(450);
};

const climb = async () => {
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0), [midX, tailZ - fwd * 1.6, yawFwd]);
  await p.waitForTimeout(400);
  await hold('w', 700); await p.waitForTimeout(150);
  await p.keyboard.down(' '); await p.waitForTimeout(220);
  await hold('w', 900); await p.keyboard.up(' '); await p.waitForTimeout(450);
  if (Math.abs(await feet() - bed.maxY) > 0.06) return false;
  await hold(strafe, 400); await p.waitForTimeout(150);
  await aim(strafe, 200, rail, 'x');
  if (Math.abs(await feet() - rail.maxY) > 0.06) return false;
  await hold('w', 500); await p.waitForTimeout(150);
  await aim('w', 200, roof, 'z');
  return Math.abs(await feet() - roof.maxY) < 0.06;
};

let bad = 0;
for (const [name, key] of [['forward (over the bonnet)', 'w'], ['back (over the bed)', 's'],
  ['left', 'a'], ['right', 'd']]) {
  let ok = false;
  for (let t = 0; t < 4 && !ok; t++) ok = await climb();
  if (!ok) { console.log(`could not climb up to test "${name}" in 4 tries — skipped`); continue; }
  const y0 = await feet();
  await hold(key, 1800);
  await p.waitForTimeout(500);
  const y1 = await feet(); const P = await pos();
  const off = y1 < y0 - 0.4;               // got down off the roof somehow
  if (!off) bad++;
  console.log(`${off ? 'ok  ' : 'STUCK'} ${name.padEnd(26)} ${y0.toFixed(2)} -> ${y1.toFixed(2)} at ${P[0].toFixed(2)},${P[2].toFixed(2)}`);
  if (!off) {
    // WHAT actually stopped you? A tier of the truck would be a real bug; a
    // box with no maxY at all is something else standing in the road — every
    // collider in the world except this truck's four is still a wall at every
    // height, and ct/traffic.ts drives its vehicle boxes down this very lane.
    const near = await p.evaluate(([x, z]) => window.__ct.colliders()
      .filter((c) => x > c.minX - 2 && x < c.maxX + 2 && z > c.minZ - 2 && z < c.maxZ + 2)
      .map((c) => ({ tag: c.tag ?? null, minX: +c.minX.toFixed(2), maxX: +c.maxX.toFixed(2),
        minZ: +c.minZ.toFixed(2), maxZ: +c.maxZ.toFixed(2), maxY: c.maxY ?? null })), [P[0], P[2]]);
    for (const c of near) console.log('       near:', JSON.stringify(c));
    console.log('       traffic:', JSON.stringify(await p.evaluate(() => window.__ct.traffic())));
  }
}
if (errs.length) console.log('page errors:', errs.slice(0, 4).join(' | '));
console.log(bad === 0 ? 'every way off the roof works' : `${bad} direction(s) leave you stranded`);
await b.close();
process.exit(bad === 0 && errs.length === 0 ? 0 : 1);
