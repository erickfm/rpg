// Walk onto the ONE standable collider in the world today — the parked
// pickup's open bed (item 1, stage 3; notes/w13-collider-volume.md) — and
// prove the floor picker actually holds you at its real height, not just
// that nothing threw. Finds the collider from window.__ct.colliders() rather
// than a hand-typed coordinate, so it cannot drift from wherever the truck's
// settleParking() nudge actually left it.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/w13-bed-check.mjs
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e.message)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4198/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 15000 });

const colliders = await p.evaluate(() => window.__ct.colliders());
// `find(c => c.maxY !== undefined)` was unambiguous while the bed floor was
// the ONLY standable collider in the world. Item 29 gave the same truck a
// hood, a cab roof and two bed rails, and this predicate then picked the hood
// and failed a bed that was working perfectly — an instrument fault, not a
// world fault. Ask for the surface BY NAME; the fallback keeps the old
// behaviour on any world built before those tags existed.
const bed = colliders.find((c) => c.tag === 'pickup-bed-floor')
  ?? colliders.find((c) => c.maxY !== undefined);
console.log('bed collider:', JSON.stringify(bed));
if (!bed) { console.log('FAIL: no standable collider found'); process.exit(1); }

const bedCenterX = (bed.minX + bed.maxX) / 2;
const bedCenterZ = (bed.minZ + bed.maxZ) / 2;
// approach from just outside the bed's footprint, along z, facing it
const approachZ = bed.maxZ + 1.5 > bed.minZ - 1.5 ? bed.minZ - 1.5 : bed.maxZ + 1.5;
console.log('bed center', bedCenterX, bedCenterZ, 'floor', bed.maxY);

const warp = (x, z, yaw) => p.evaluate(([x, z, yaw]) => window.__ct.warp(x, z, yaw, 0, 0), [x, z, yaw]);
const camY = () => p.evaluate(() => window.__ct.camY());
const pos = () => p.evaluate(() => window.__ct.pos());

// face the bed: fwd = (sin(yaw), 0, -cos(yaw)), so yaw = atan2(dx, -dz)
const dz = bedCenterZ - approachZ;
const yawToBed = Math.atan2(0, -dz);
// Walk right up to it first (flush against the wall it still is at ground
// level, exactly like walking into any other car), THEN jump in place and
// only add forward once already rising — walking AND jumping from 1.5 m back
// reaches the padded boundary well after the jump's own apex has passed
// (apex is a fixed ~0.28 s after leaving the ground; covering 1.5 m at
// 3.3 m/s takes ~0.45 s), so the two events never coincide. This is the
// realistic order a player follows: bump into it, then hop up and over.
await warp(bedCenterX, approachZ, yawToBed);
await p.waitForTimeout(300);
console.log('start pos', await pos(), 'camY', await camY());
await p.keyboard.down('w');
await p.waitForTimeout(700);   // walk until blocked flush against it
await p.keyboard.up('w');
await p.waitForTimeout(200);
console.log('flush pos', await pos(), 'camY', await camY());

await p.keyboard.down(' ');
await p.waitForTimeout(220);   // rise most of the way to apex, stationary
await p.keyboard.up(' ');
await p.keyboard.down('w');    // NOW step forward, while still elevated
const samples = [];
for (let t = 0; t < 1200; t += 50) {
  await p.waitForTimeout(50);
  const y = await camY();
  const P = await pos();
  samples.push([t, y.toFixed(3), P[0].toFixed(2), P[2].toFixed(2)]);
}
await p.keyboard.up('w');
await p.waitForTimeout(300);
const finalPos = await pos();
const finalY = await camY();
console.log('samples (t,camY,x,z):');
for (const s of samples) console.log('  ', ...s);
console.log('final pos', finalPos, 'camY', finalY, 'feet', (finalY - 1.62).toFixed(3));
console.log('expected bed floor', bed.maxY);
const onBed = Math.abs((finalY - 1.62) - bed.maxY) < 0.06 &&
  finalPos[0] > bed.minX && finalPos[0] < bed.maxX && finalPos[2] > bed.minZ && finalPos[2] < bed.maxZ;
console.log(onBed ? 'PASS: standing on the bed floor' : 'FAIL: not standing on the bed floor');

if (onBed) {
  // now walk off the edge and confirm we drop back to street level
  await p.keyboard.down('s');
  await p.waitForTimeout(1500);
  await p.keyboard.up('s');
  await p.waitForTimeout(300);
  const offPos = await pos();
  const offY = await camY();
  console.log('after walking off:', offPos, 'camY', offY, 'feet', (offY - 1.62).toFixed(3));
}

if (errs.length) console.log('page errors:', errs.slice(0, 5).join(' | '));
await b.close();
process.exit(onBed && errs.length === 0 ? 0 : 1);
