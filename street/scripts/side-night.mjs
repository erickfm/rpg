// Do MY side-street objects catch B's new lamps? The trees and parked cars out
// there were registered with props.lit before any lamp existed on that street, so
// this is the check that the prediction held.
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
console.error(`[measuring ${process.env.SHOT_URL}]`);   // say WHICH world — 24163f69
await p.goto(process.env.SHOT_URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await p.waitForTimeout(400);
const sample = async (h, m) => {
  await p.evaluate(([h, m]) => window.__ct.clock(h, m), [h, m]);
  await p.waitForTimeout(700);
  return p.evaluate(() => {
    // my side-street trees (3 m billboards) and parked cars (steer helper), east of the junction
    const out = { trees: [], cars: [] };
    window.__ct.scene().traverse((o) => {
      if (o.position.x < 8 || o.position.x > 60 || o.position.z > -95 || o.position.z < -112) return;
      const lumOf = (mm) => {
        const m = Array.isArray(mm) ? mm[0] : mm;
        return m?.color ? 0.299 * m.color.r + 0.587 * m.color.g + 0.114 * m.color.b : null;
      };
      // A CAR IS A GROUP, and a Group has no material — the first version of this
      // bailed on that and reported zero cars. Sample its body child instead.
      if (o.type === 'Group' && o.userData.steer !== undefined) {
        const vals = o.children.map((c) => lumOf(c.material)).filter((v) => v !== null);
        if (vals.length) out.cars.push(+(Math.max(...vals)).toFixed(3));
        return;
      }
      const lum = lumOf(o.material);
      if (lum === null) return;
      if (o.geometry?.parameters?.width === 3) out.trees.push(+lum.toFixed(3));
    });
    return out;
  });
};
const day = await sample(13, 0);
const night = await sample(1, 30);
const avg = (a) => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(3) : null;
console.log(`side-street trees  day ${avg(day.trees)}  night ${avg(night.trees)}  (${day.trees.length} found)`);
console.log(`side-street cars   day ${avg(day.cars)}  night ${avg(night.cars)}  (${day.cars.length} found)`);
// The point of the check: they must DIM after dark (dimWorld) and they must be
// able to take amber inside a lamp pool (props.lit). Dimming is what this proves;
// whether any individual one sits in a pool depends on where B's lamps ended up
// relative to where my trees are, which is a spacing question for the desk.
const dim = (d, n) => d !== null && n !== null && n < d * 0.5;
console.log(`\n  ${dim(avg(day.trees), avg(night.trees)) ? 'OK  ' : 'FAIL'} trees dim after dark`);
console.log(`  ${dim(avg(day.cars), avg(night.cars)) ? 'OK  ' : 'FAIL'} parked cars dim after dark`);
console.log(`  brightest single car at night: ${night.cars.length ? Math.max(...night.cars).toFixed(3) : 'n/a'} ` +
  '(well above the average means at least one IS standing in a pool)');
await p.evaluate(() => window.__ct.warp(20, -101, Math.PI / 2, 0, -0.05));
await p.waitForTimeout(500);
await p.screenshot({ path: 'shots/side-night.png' });
console.log('shot -> shots/side-night.png');
await b.close();
