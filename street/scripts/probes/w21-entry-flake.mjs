// WHY DOES THE BED ENTRY SOMETIMES FAIL? Repeat item 1's own hop 8 times and
// print, for each miss, every collider within 3 m of the player — the truck
// stands IN THE ROAD, so the suspect is ct/traffic.ts's vehicle boxes driving
// through the spot you jump from, not the truck.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w21-entry-flake.mjs
import { chromium } from 'playwright';
const EYE = 1.62;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4188/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const cols = await p.evaluate(() => window.__ct.colliders());
const bed = cols.find((c) => c.tag === 'pickup-bed-floor');
const roof = cols.find((c) => c.tag === 'pickup-cab-roof');
const midX = (bed.minX + bed.maxX) / 2;
// The tail is the bed's far end FROM THE CAB — derived, because the truck's
// yaw comes out of a seeded draw and guessing it wrong just walks you up the
// street away from the truck, which is what the first draft of this probe did.
const tailZ = (bed.minZ + bed.maxZ) / 2 > (roof.minZ + roof.maxZ) / 2 ? bed.maxZ : bed.minZ;
const inward = tailZ === bed.minZ ? 1 : -1;  // world z step "towards the cab"
const yawFwd = inward > 0 ? Math.PI : 0;

let ok = 0;
for (let i = 0; i < 8; i++) {
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0), [midX, tailZ - inward * 1.6, yawFwd]);
  await p.waitForTimeout(300);
  await p.keyboard.down('w'); await p.waitForTimeout(700); await p.keyboard.up('w');
  await p.waitForTimeout(150);
  await p.keyboard.down(' '); await p.waitForTimeout(220); await p.keyboard.up(' ');
  await p.keyboard.down('w'); await p.waitForTimeout(900); await p.keyboard.up('w');
  await p.waitForTimeout(450);
  const P = await p.evaluate(() => window.__ct.pos());
  const y = (await p.evaluate(() => window.__ct.camY())) - EYE;
  const good = Math.abs(y - bed.maxY) < 0.06;
  if (good) ok++;
  console.log(`${i}: ${good ? 'in' : 'MISS'}  feet ${y.toFixed(3)} at ${P[0].toFixed(2)},${P[2].toFixed(2)}`);
  if (!good) {
    const near = await p.evaluate(([x, z]) => window.__ct.colliders().filter((c) =>
      x > c.minX - 3 && x < c.maxX + 3 && z > c.minZ - 3 && z < c.maxZ + 3), [P[0], P[2]]);
    for (const c of near) console.log('     near:', JSON.stringify(c));
    const tr = await p.evaluate(() => window.__ct.traffic());
    console.log('     traffic:', JSON.stringify(tr));
  }
}
console.log(`entered the bed ${ok}/8`);
await b.close();
