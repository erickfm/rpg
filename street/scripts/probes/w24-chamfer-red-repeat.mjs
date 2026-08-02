// Is any red on the chamfer STEADY or TRANSIENT? crosstown spreads the moving
// vehicleBoxes into `colliders`, so a car crossing the junction forms and
// unforms corridors against everything near it, frame by frame. One sample
// cannot tell "the chamfer is badly built" from "a taxi was passing".
//
// Samples the chamfer's own two boxes 40 times over ~8 s and reports how often
// each reads red, and what against.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w24-chamfer-red-repeat.mjs
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(process.env.SHOT_URL ?? 'http://localhost:4215/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

let redTurned = 0, redPier = 0, redNorth = 0, n = 0;
const culprits = new Map();
for (let i = 0; i < 60; i++) {
  // Traffic is the reason a single sample proves nothing, so DRIVE it rather
  // than wait out the 18-42 s gap between natural passes. The north block is
  // sampled beside the two new boxes as the control: it is unchanged by this
  // item, so whatever a passing car does to it, it did before.
  if (i % 10 === 0) await p.evaluate(() => window.__ct.drive(i % 20 === 0 ? 'NE' : 'EN', 'car', 0, true)).catch(() => {});
  const r = await p.evaluate(async () => {
    const { trapAgainst, corridor, isTrap } = await import('/src/proto/ct/gap.ts');
    const cols = window.__ct.colliders();
    const turned = cols.find((c) => c.rot);
    const pier = cols.find((c) => !c.rot && c.minX === 9 && c.maxZ === -93);
    const north = cols.find((c) => !c.rot && Math.abs(c.minX - 6.7) < 1e-9 && Math.abs(c.minZ + 94) < 1e-9);
    const who = (box) => {
      if (!box) return null;
      const w = trapAgainst(box, cols);
      if (w === null) return null;
      // name the other box in the offending pair
      for (const o of cols) {
        if (o === box) continue;
        const g = corridor(box, o);
        if (g !== null && isTrap(g) && Math.abs(g - w) < 1e-9) {
          return `${o.minX.toFixed(2)}..${o.maxX.toFixed(2)} x ${o.minZ.toFixed(2)}..${o.maxZ.toFixed(2)} (gap ${w.toFixed(3)})`;
        }
      }
      return `gap ${w.toFixed(3)}, partner not identified`;
    };
    return { t: who(turned), pr: who(pier), nr: who(north) };
  });
  n++;
  if (r.t) { redTurned++; culprits.set('turned <- ' + r.t, (culprits.get('turned <- ' + r.t) ?? 0) + 1); }
  if (r.pr) { redPier++; culprits.set('pier   <- ' + r.pr, (culprits.get('pier   <- ' + r.pr) ?? 0) + 1); }
  if (r.nr) { redNorth++; culprits.set('north  <- ' + r.nr, (culprits.get('north  <- ' + r.nr) ?? 0) + 1); }
  await p.waitForTimeout(200);
}
console.log(`samples ${n}`);
console.log(`  turned chamfer box red in ${redTurned}/${n}`);
console.log(`  pier box red in           ${redPier}/${n}`);
 console.log(`  north block (CONTROL, unchanged by this item) red in ${redNorth}/${n}`);
for (const [k, v] of [...culprits].sort((a, c) => c[1] - a[1])) console.log(`   ${v}x  ${k}`);
await b.close();
