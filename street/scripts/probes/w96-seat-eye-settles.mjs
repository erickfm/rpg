// IS THE SEATED EYE *ANIMATED*? — the real cause of seats-walk's 85 eye failures
//
// The harness fails 85 seats with "seated eye is N, expected N", and 83 of those
// are off by EXACTLY 0.350 m. A single constant across 83 different seats is
// never 83 broken seats. But a probe of my own, doing the same thing with a
// slightly different delay, measured the SAME seats at 0.17-0.20 — and a
// disagreement that moves when only the delay moves is a clock, not a world.
//
// So: sit, then sample `camY` every frame for a second and watch where it goes.
// If it EASES to the expected height, the harness is reading a camera mid-flight
// and every one of those 85 is GOTCHAS 30 — "a fixed sleep for anything the
// render loop drives fails only under load".
//
//   SHOT_URL=http://localhost:4520/ node scripts/probes/w96-seat-eye-settles.mjs
import { aim } from '../lib/aim.mjs';
import { chromium } from 'playwright';
import { reportWorld } from '../lib/which-world.mjs';

const URL = aim('http://localhost:4520/');
const SIT_EYE = 0.72, RADIUS = 0.36;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 });
await reportWorld(p, URL);

const seats = await p.evaluate(() => window.__ct.seats());
const standableNear = (at, r) => p.evaluate(([at, r, RAD]) => {
  const cols = window.__ct.colliders();
  const blocked = (x, z) => cols.some((c) =>
    x > c.minX - RAD && x < c.maxX + RAD && z > c.minZ - RAD && z < c.maxZ + RAD);
  for (let ring = 0.05; ring <= r; ring += 0.07) {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const x = at.x + Math.cos(a) * ring, z = at.z + Math.sin(a) * ring;
      if (!blocked(x, z)) return { x, z };
    }
  }
  return null;
}, [at, r, RADIUS]);

// three seats of different kinds, so this is not one odd chair
const picks = [];
for (const want of ['slot', 'sit down', 'table']) {
  const s = seats.find((q) => q.label.includes(want) && !picks.includes(q));
  if (s) picks.push(s);
}

for (const s of picks) {
  if (await p.evaluate(() => window.__ct.seated())) {
    await p.evaluate(() => window.__ct.stand && window.__ct.stand());
    await p.waitForTimeout(80);
  }
  const st = await standableNear(s.at, s.r);
  if (!st) continue;
  const yaw = Math.atan2(s.pose.x - st.x, s.pose.z - st.z);
  await p.evaluate(([x, z, y]) => window.__ct.warp(x, z, y, 0, 0), [st.x, st.z, yaw]);
  await p.waitForTimeout(140);
  await p.keyboard.down('e'); await p.waitForTimeout(90); await p.keyboard.up('e');
  const trace = await p.evaluate(() => new Promise((done) => {
    const out = [];
    const t0 = performance.now();
    const tick = () => {
      out.push([+(performance.now() - t0).toFixed(0), +window.__ct.camY().toFixed(3)]);
      if (performance.now() - t0 < 1200) requestAnimationFrame(tick); else done(out);
    };
    requestAnimationFrame(tick);
  }));
  const floor = (await p.evaluate(() => window.__ct.pos()))[3];
  const want = floor + s.pose.h + SIT_EYE;
  const first = trace[0][1], last = trace[trace.length - 1][1];
  const settleAt = trace.find((r) => Math.abs(r[1] - want) <= 0.04);
  console.log(`\n"${s.label}"  pan ${s.pose.h}  floor ${floor.toFixed(2)}  -> want camY ${want.toFixed(3)}`);
  console.log(`  first sample ${first.toFixed(3)} (err ${(want - first).toFixed(3)}), `
    + `after 1.2 s ${last.toFixed(3)} (err ${(want - last).toFixed(3)})`);
  console.log(`  settles within 0.04 at: ${settleAt ? `${settleAt[0]} ms` : 'NEVER in 1.2 s'}`);
  console.log('  trace: ' + trace.filter((_, i) => i % 4 === 0).slice(0, 12)
    .map(([t, y]) => `${t}ms:${y.toFixed(2)}`).join('  '));
  await p.evaluate(() => window.__ct.stand && window.__ct.stand());
  await p.waitForTimeout(80);
}
await b.close();
