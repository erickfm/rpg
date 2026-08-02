// VERIFYING C's ad-diversity row — I did not build it, so I may.
//
// C proved the formats EXIST: `shots/tv/fmt-*.png` is one frame of each of the
// ten. That is the right evidence for "I built ten formats" and it is not the
// same claim as the user's, which was about what a SITTING feels like —
// *"theyre all basically the same"*. A pool of ten that a player never sees
// more than two of is the same complaint again with more code behind it.
//
// So this samples the published predicate `scene.userData.tv.fmt` through one
// continuous sitting and asks what actually came past. Different measurement,
// same row — which is the only kind worth a verifier's time.
//
// GOTCHAS 43: headless sim time runs at about 0.66x wall, so a 60 s watch is
// nearer 40 s of programme. The frame rate is reported alongside the counts
// rather than left for somebody to be surprised by.
//
//   SHOT_URL=http://localhost:PORT/ node scripts/O-verify-C-adspread.mjs [seconds]
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
import { reportWorld } from '../lib/which-world.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('aim it: SHOT_URL=http://localhost:PORT/'); process.exit(2); }
const SECS = Number(process.argv[2] ?? 75);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await reportWorld(p, URL);
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await afterFrames(p, 10); await p.waitForTimeout(1200);

let bad = 0, n = 0;
const ok = (c, m) => { n++; console.log(`${c ? 'OK  ' : 'NO  '} ${m}`); if (!c) bad++; };

// population first (GOTCHAS 34): is the predicate even published?
const t0 = await p.evaluate(() => window.__ct.scene()?.userData?.tv ?? null);
if (!t0 || !('fmt' in t0)) {
  console.error('ABORT: scene.userData.tv publishes no `fmt` — the row\'s own predicate is');
  console.error('       absent, so nothing below would measure variety or its absence.');
  await b.close(); process.exit(3);
}
console.log(`predicate on load: ${JSON.stringify(t0)}`);

// sit down — 301 is up the walk-up, so find the floor by asking
const seat = await p.evaluate(() => window.__ct.spots()
  .filter((s) => /watch tv/i.test(s.label ?? '')).map((s) => ({ x: s.x, z: s.z }))[0] ?? null);
if (!seat) { console.error('ABORT: no watch-TV seat'); await b.close(); process.exit(3); }
const FLOOR = await p.evaluate(async ([sx, sz]) => {
  const wait = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  for (let gy = 0; gy <= 14; gy += 0.1) {
    window.__ct.warp(sx, sz, 0, gy, 0); await wait();
    if (window.__ct.spots().filter((s) => /watch tv/i.test(s.label ?? ''))[0]?.ok) {
      return +window.__ct.pos()[3].toFixed(2);
    }
  }
  return null;
}, [seat.x, seat.z]);
if (FLOOR === null) { console.error('ABORT: the seat never arms'); await b.close(); process.exit(3); }
await p.evaluate(([x, z, g]) => window.__ct.warp(x, z, 0, g, 0), [seat.x, seat.z, FLOOR]);
await afterFrames(p, 6);
await p.keyboard.press('e');
const on = await p.evaluate(() => new Promise((res) => {
  const t = performance.now();
  const tick = () => {
    if (window.__ct.scene()?.userData?.tv?.on) return res(true);
    if (performance.now() - t > 8000) return res(false);
    requestAnimationFrame(tick);
  };
  tick();
}));
if (!on) { console.error('ABORT: the set never came on, so there was nothing to watch'); await b.close(); process.exit(3); }
console.log(`sitting and watching for ${SECS}s of wall time…\n`);

// ── ONE CONTINUOUS SITTING. Sample the predicate, never re-sit. ───────────
const log = await p.evaluate((ms) => new Promise((res) => {
  const t0 = performance.now();
  const seq = []; let frames = 0; let last = null;
  const tick = () => {
    frames++;
    const tv = window.__ct.scene()?.userData?.tv;
    const key = tv ? `${tv.fmt ?? '?'}|${tv.seg ?? '?'}` : null;
    if (key && key !== last) { seq.push({ fmt: tv.fmt ?? null, seg: tv.seg ?? null, t: +((performance.now() - t0) / 1000).toFixed(1) }); last = key; }
    if (performance.now() - t0 < ms) requestAnimationFrame(tick);
    else res({ seq, frames, secs: (performance.now() - t0) / 1000 });
  };
  tick();
}), SECS * 1000);

const fps = log.frames / log.secs;
const fmts = [...new Set(log.seq.map((s) => s.fmt).filter((f) => f != null))];
const segs = [...new Set(log.seq.map((s) => s.seg).filter((s) => s != null))];
console.log(`${log.seq.length} changes over ${log.secs.toFixed(0)}s wall at ${fps.toFixed(1)} fps`);
console.log(`  (GOTCHAS 43: sim time runs ~0.66x wall headless, so that is ~${(log.secs * 0.66).toFixed(0)}s of programme)`);
console.log(`\ndistinct FORMATS seen: ${fmts.length} — ${JSON.stringify(fmts)}`);
console.log(`distinct SPOTS seen:   ${segs.length}`);
console.log(`\nthe running order:`);
for (const s of log.seq.slice(0, 22)) console.log(`  ${String(s.t).padStart(5)}s  ${String(s.fmt).padEnd(14)} ${s.seg}`);
if (log.seq.length > 22) console.log(`  … and ${log.seq.length - 22} more`);

// ── the claims, stated as a player would feel them ────────────────────────
ok(log.seq.length >= 4,
  `the programme MOVES during one sitting — ${log.seq.length} changes, not a single ad on a loop`);
ok(fmts.length >= 3,
  `and it changes SHAPE, not just words — ${fmts.length} distinct formats in one sitting, ` +
  `which is the user's actual complaint ("theyre all basically the same")`);
// the fault the row says was structural: many ads, one renderer
const worst = fmts.length ? Math.max(...fmts.map((f) => log.seq.filter((s) => s.fmt === f).length)) : 0;
ok(fmts.length < 2 || worst / log.seq.length < 0.75,
  `no single format dominates — the commonest is ${worst} of ${log.seq.length} ` +
  `(${((worst / log.seq.length) * 100).toFixed(0)}%)`);

console.log(`\n${n} checks, ${bad} disagreed`);
await b.close();
process.exit(bad ? 1 : 0);
