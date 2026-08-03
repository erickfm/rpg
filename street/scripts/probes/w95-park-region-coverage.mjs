// Item 248 — WHICH stamped lamps fall in NO glow region, and where is the park?
//
// The item claims "TEN of 21 stamped lamps fall in NO glow region". A queue item
// is a hypothesis, not a finding (BUILDER-BRIEF §6), so this measures it before
// anything is changed: it reads the SAME stamp glow.mjs reads, applies the SAME
// two region predicates glow.mjs holds, and prints every lamp with the region it
// lands in — or NONE.
//
// It also dumps the park site bounds, because the park region has to be DERIVED
// from the site rather than typed (BUILDER-BRIEF §8) — ct/props.ts:2135 already
// places the lanterns from `site('park')` for exactly this reason.
//
// Usage: SHOT_URL=http://localhost:4510/ node scripts/probes/w95-park-region-coverage.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { goto } from '../lib/reachable.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 880, height: 750 } });
await goto(page, aim('http://localhost:4177/'));
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 10000 });
await reportWorld(page, aim('http://localhost:4177/'));

// the stamp glow.mjs:193 reads, verbatim
const lampXZ = await page.evaluate(() => {
  const S = window.__ct.scene(); S.updateMatrixWorld(true);
  const out = [];
  S.traverse((o) => {
    if (o.isMesh && (o.userData.lampPart === 'lens' || o.userData.parkLantern)) {
      const e = o.matrixWorld.elements;
      out.push([+e[12].toFixed(2), +e[14].toFixed(2), !!o.userData.parkLantern]);
    }
  });
  return out;
});

const site = await page.evaluate(() => {
  const s = window.__ct.sites ? window.__ct.sites() : null;
  if (!s) return null;
  const p = Array.isArray(s) ? s.find((q) => q.name === 'park') : s.park;
  return p ? { minX: p.minX, maxX: p.maxX, minZ: p.minZ, maxZ: p.maxZ, y: p.y } : null;
});

// glow.mjs:201-204, verbatim
const REGION = {
  main: ([x, z]) => Math.abs(x) <= 9 && z <= 2 && z >= -96,
  side: ([x, z]) => x > 9 && z < -94,
};

console.log('\npark site:', JSON.stringify(site));
console.log(`\n${lampXZ.length} stamped lamps:\n`);
const tally = {};
for (const [x, z, isPark] of lampXZ) {
  const hits = Object.entries(REGION).filter(([, f]) => f([x, z])).map(([n]) => n);
  const label = hits.length ? hits.join('+') : 'NONE';
  tally[label] = (tally[label] || 0) + 1;
  console.log(`  (${String(x).padStart(7)}, ${String(z).padStart(8)})  ${isPark ? 'parkLantern' : 'street     '}  -> ${label}`);
}
console.log('\ntally:', JSON.stringify(tally));

// Do the park lanterns form a region the two existing predicates would collide
// with? If a park lamp already matches main/side, adding a park region needs to
// be exclusive or a lamp gets counted twice.
const parkOnly = lampXZ.filter((L) => L[2]);
if (parkOnly.length) {
  const xs = parkOnly.map((L) => L[0]), zs = parkOnly.map((L) => L[1]);
  console.log(`park lantern bbox: x ${Math.min(...xs)}..${Math.max(...xs)}  z ${Math.min(...zs)}..${Math.max(...zs)}`);
}
await browser.close();
