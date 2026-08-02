// ITEM 128: *"i get awful performance drops in my room not sure why."* Flat 301.
//
// MEASURE BEFORE OPTIMISING. The item names a strong lead — the TV repaints its
// whole canvas ~9x a second (`ct/apartment.ts:2683`, tvRedraw = 0.11) and
// re-uploads the texture each time — but half of what the last builder measured
// on the lighting item was the instrument, so this file establishes the drop
// exists and how big it is BEFORE anything is changed.
//
// The player SPAWNS in 301, so "his room" is simply the load state.
//
// Frame times are sampled in-page from requestAnimationFrame. What matters for
// "drops" is the TAIL, not the mean, so the worst frame and p95/p99 are reported
// alongside it — a mean can look fine while every twelfth frame is a stall.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w50-perf-301.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e.message)));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

/** Sample rAF frame durations for `ms`, and report the tail. */
const sample = async (label, ms = 6000) => {
  const d = await p.evaluate((ms) => new Promise((done) => {
    const out = [];
    let prev = performance.now();
    const t0 = prev;
    const tick = () => {
      const now = performance.now();
      out.push(now - prev);
      prev = now;
      if (now - t0 > ms) return done(out);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), ms);
  // drop the first few frames: they include the sampler warming up
  const f = d.slice(3).sort((a, b) => a - b);
  const at = (q) => f[Math.min(f.length - 1, Math.floor(q * f.length))];
  const mean = f.reduce((a, b) => a + b, 0) / f.length;
  const r = {
    label, n: f.length, mean, med: at(0.5), p95: at(0.95), p99: at(0.99),
    worst: f[f.length - 1], over33: f.filter((x) => x > 33.4).length,
  };
  console.log(`  ${label.padEnd(34)} mean ${mean.toFixed(1)}ms (${(1000 / mean).toFixed(0)} fps)`
    + `  med ${r.med.toFixed(1)}  p95 ${r.p95.toFixed(1)}  p99 ${r.p99.toFixed(1)}`
    + `  worst ${r.worst.toFixed(1)}  frames>33ms ${r.over33}/${f.length}`);
  return r;
};

const pos = () => p.evaluate(() => window.__ct.pos());
const tv = () => p.evaluate(() => window.__ct.scene?.userData?.tv ?? null);

const q = await pos();
console.log(`spawned at (${q[0].toFixed(2)}, ${q[2].toFixed(2)}) gy ${q[3].toFixed(2)} — flat 301`);
console.log(`tv: ${JSON.stringify(await tv())}\n`);

console.log('frame times:');
const inRoom = await sample('301, as the player finds it');

// ── the same rig, outdoors, for a baseline ────────────────────────────────
// warp to the street outside the walk-up, gy 0
await p.evaluate(() => window.__ct.warp(-6.0, -20.0, 0, 0, 0));
await p.waitForTimeout(1200);
const outside = await sample('the street outside (gy 0)');

// ── back inside, to prove the difference is the ROOM and not warm-up ──────
await p.evaluate(() => window.__ct.warp(198.9, -16.5, Math.PI / 2, 5.4, 0));
await p.waitForTimeout(1200);
const back = await sample('back in 301 (rules out warm-up)');

console.log(`\nroom vs street: mean ${(inRoom.mean - outside.mean).toFixed(1)}ms worse,`
  + ` worst frame ${(inRoom.worst - outside.worst).toFixed(1)}ms worse`);
console.log(`re-entry agrees with first visit: mean ${back.mean.toFixed(1)} vs ${inRoom.mean.toFixed(1)}`);
console.log(`\nconsole errors: ${errs.length}`);
if (errs.length) console.log(errs.slice(0, 4).join('\n'));
await browser.close();
