// ITEM 128, ATTRIBUTION: what is actually eating the frame in flat 301?
//
// The first attempt at this measured raw rAF frame times and was USELESS: the
// same room sampled twice gave 78.6 ms and then 35.0 ms, because headless
// Chromium is still warming up (JIT, shader compiles, texture uploads) for the
// first several seconds. A/B comparisons against that drift measure the
// stopwatch, not the world — BUILDER-BRIEF §7.
//
// So this asks the engine directly instead: a V8 CPU sampling profile over a
// window, aggregated by SELF time per function. That names the cost with numbers
// rather than inferring it from a lead.
//
// Usage: SHOT_URL=http://localhost:<port>/ node scripts/probes/w50-profile-301.mjs [seconds]
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL ?? 'http://localhost:4187/';
const SECS = Number(process.argv[2] ?? 10);
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const q = await p.evaluate(() => window.__ct.pos());
console.log(`spawned at (${q[0].toFixed(2)}, ${q[2].toFixed(2)}) gy ${q[3].toFixed(2)} — flat 301`);
// what the TV is publishing, and where
// `__ct.scene` is a FUNCTION (crosstown.ts:1637), not a property — reading it as
// an object is why the first pass reported `tv: null` and looked like the TV was
// not publishing at all. It publishes fine.
const tvInfo = await p.evaluate(() => {
  const s = typeof window.__ct.scene === 'function' ? window.__ct.scene() : window.__ct.scene;
  return { sceneUserData: s?.userData ? Object.keys(s.userData) : null, tv: s?.userData?.tv ?? null };
});
console.log(`tv probe: ${JSON.stringify(tvInfo)}`);

// LET IT WARM UP FIRST. This is the whole reason the previous instrument lied.
console.log(`\nwarming up 10 s before profiling…`);
await p.waitForTimeout(10000);

const cdp = await p.context().newCDPSession(p);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 200 });   // microseconds
await cdp.send('Profiler.start');
console.log(`profiling ${SECS} s in 301…`);
await p.waitForTimeout(SECS * 1000);
const { profile } = await cdp.send('Profiler.stop');

// ── aggregate SELF time per node ──────────────────────────────────────────
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const self = new Map();
for (const n of profile.nodes) self.set(n.id, 0);
// timeDeltas[i] is the time BEFORE samples[i]
for (let i = 0; i < profile.samples.length; i++) {
  const id = profile.samples[i];
  const dt = profile.timeDeltas[i] ?? 0;
  self.set(id, (self.get(id) ?? 0) + Math.max(0, dt));
}
const total = [...self.values()].reduce((a, b) => a + b, 0) || 1;
const rows = [];
for (const [id, us] of self) {
  if (us <= 0) continue;
  const n = byId.get(id);
  const cf = n.callFrame;
  const where = cf.url ? `${cf.url.replace(/^https?:\/\/[^/]+/, '')}:${cf.lineNumber + 1}` : '';
  rows.push({ name: cf.functionName || '(anonymous)', where, us, pct: (100 * us) / total });
}
rows.sort((a, b) => b.us - a.us);

console.log(`\ntotal sampled: ${(total / 1000).toFixed(0)} ms over ${SECS} s\n`);
console.log('SELF time, top 22:');
for (const r of rows.slice(0, 22)) {
  console.log(`  ${r.pct.toFixed(1).padStart(5)}%  ${(r.us / 1000).toFixed(0).padStart(5)} ms  `
    + `${r.name.slice(0, 34).padEnd(34)} ${r.where}`);
}

// roll up by source line, so many small anonymous frames in one function group
const byLine = new Map();
for (const r of rows) {
  const k = r.where || '(native)';
  byLine.set(k, (byLine.get(k) ?? 0) + r.us);
}
console.log('\nSELF time rolled up by source location, top 14:');
for (const [k, us] of [...byLine.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)) {
  console.log(`  ${((100 * us) / total).toFixed(1).padStart(5)}%  ${(us / 1000).toFixed(0).padStart(5)} ms  ${k}`);
}
await browser.close();
