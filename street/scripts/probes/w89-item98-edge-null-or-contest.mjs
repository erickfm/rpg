// Item 98, the follow-up question. `w89-item98-what-bounds-the-ring.mjs` found
// the aimed tier's lateral edge is a CONSTANT ~15 degrees from 1.5 m to 4 m —
// where `lookTolerance(1.05, 1.5)` would allow 35 — and only matches
// `lookTolerance` from 4 m out. Something caps the angle at close range and it
// is not the cone.
//
// TWO CAUSES LOOK IDENTICAL FROM THE PROMPT and have opposite fixes:
//   - it goes NULL          -> a predicate or `canSee` refused the spot
//   - it CHANGES LABEL      -> the spot was fine and lost a contest
// So print the label at every degree across the edge instead of a boolean.
import { chromium } from 'playwright';
const URL = process.env.SHOT_URL ?? 'http://localhost:4450/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.spots, null, { timeout: 30000 });
await p.evaluate(() => window.__ct.clock(12, 30));

const S = { x: 6.55, z: -44.0, r: 1.05, label: 'enter No. 227' };
const yaw0 = Math.atan2(-0, 1);          // approach unit (0, 1)

const read = async (px, pz, yaw) => {
  const gy = await p.evaluate(([x, z]) => window.__ct.groundAt(x, z), [px, pz]);
  await p.evaluate(([x, z, y, g]) => window.__ct.warp(x, z, y, g, 0), [px, pz, yaw, gy]);
  for (let i = 0; i < 8; i++) await p.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  return p.evaluate(() => {
    if (window.__ct.landing?.()) return '<<LANDING>>';
    const el = document.getElementById('ct-prompt');
    if (!el || getComputedStyle(el).display === 'none') return '<<NULL>>';
    return (el.textContent ?? '').trim() || '<<EMPTY>>';
  });
};

for (const d of [1.5, 2.5, 3.5]) {
  console.log(`\n── d = ${d} m, r = ${S.r}, lookTolerance = `
    + `${(Math.atan2(S.r, Math.max(0.35, d)) * 180 / Math.PI).toFixed(1)} deg ──`);
  for (const deg of [0, 10, 14, 15, 16, 17, 18, 20, 25, 30, 34, 35, 40]) {
    const t = await read(S.x, S.z + d, yaw0 + (deg * Math.PI) / 180);
    console.log(`  ${String(deg).padStart(3)} deg   ${t}`);
  }
}

// AND THE OTHER WAY ROUND — a negative case for the sweep itself. If the cap
// were an artifact of always turning the same way, turning the other way would
// not reproduce it.
console.log(`\n── d = 2.5 m, turning the OTHER way (negative case) ──`);
for (const deg of [0, 14, 16, 20, 30]) {
  const t = await read(S.x, S.z + 2.5, yaw0 - (deg * Math.PI) / 180);
  console.log(`  -${String(deg).padStart(2)} deg   ${t}`);
}
await b.close();
