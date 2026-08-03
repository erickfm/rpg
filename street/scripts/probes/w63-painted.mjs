#!/usr/bin/env node
// ITEM 181: DOES THE OLD RECIPE REALLY SHOOT BLACK, AND DOES THE NEW ONE NOT?
//
// Worker sixtyone reported 8 solid black frames off the built bundle after the
// wait GOTCHAS 78 prescribes. This runs BOTH recipes against the same page, in
// order, and measures the black fraction of each:
//
//   A  waitForFunction(() => window.__ct) + afterFrames(2)   <- GOTCHAS 78's advice
//   B  waitPainted(page)                                     <- item 181's
//
// It is a comparison, not an assertion that A is always black: A's outcome
// depends on how loaded the machine is, which is exactly what makes it unsafe.
// The assertion is on B — **that one must never be the void** — and on the
// mechanism existing at all.
//
// A FRESH PAGE PER RECIPE, because the first thing A does is wait for a world
// that is already built if B ran first, and a comparison where one side gets a
// warm page is not a comparison. (This is the same trap as GOTCHAS 20's walk
// tests sharing player state.)
//
//   SHOT_URL=http://localhost:4191/ node scripts/probes/w63-painted.mjs
import { chromium } from 'playwright';
import { afterFrames } from '../lib/frames.mjs';
import { waitPainted, blackFraction } from '../lib/painted.mjs';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('set SHOT_URL to YOUR OWN server'); process.exit(3); }

const browser = await chromium.launch();
const contexts = [];
let fails = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? 'OK  ' : 'FAIL'}  ${msg}`); if (!cond) fails++; };

// A FRESH CONTEXT, NOT A FRESH PAGE, AND THAT DISTINCTION IS THE WHOLE
// MEASUREMENT. `browser.newPage()` shares the browser's HTTP cache, so the
// second recipe in a run loads a bundle the first one already fetched and
// parsed — every timing after the first is a WARM one, and the fault being
// investigated is a COLD-start race. Sixtyone's own note says so in as many
// words: *"on a cold `vite preview` the first painted frame arrived at 1136
// ms."* Measuring three recipes against one warm cache would have reported the
// race as absent, confidently, which is the instrument fault BUILDER-BRIEF §7
// puts at half of all findings here.
const fresh = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 640 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('pageerror: ' + e.message));
  await p.goto(URL, { waitUntil: 'domcontentloaded' });
  contexts.push(ctx);
  return p;
};

console.log(`\n  item 181 — ${URL}\n`);

// ── is the affordance even there? ────────────────────────────────────────
{
  const p = await fresh();
  await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
  const shape = await p.evaluate(() => {
    const q = window.__ct.painted?.();
    return { has: typeof window.__ct.painted === 'function', v: q };
  });
  ok(shape.has, '__ct.painted() is published');
  ok(shape.v === null || (typeof shape.v?.frames === 'number' && typeof shape.v?.triangles === 'number'),
    `it reports frames/triangles/calls, or null before configure() (${JSON.stringify(shape.v)})`);
  await p.close();
}

// ── recipe A0: shoot the instant `__ct` exists, which is what GOTCHAS 78 was
// written to stop and is the sharpest form of the fault ──────────────────
let a0;
{
  const p = await fresh();
  const t0 = Date.now();
  await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
  const tCt = Date.now() - t0;
  const shot = await p.screenshot({ path: '/tmp/w63-painted-A0-ctonly.png' });
  const drawn = await p.evaluate(() => window.__ct.painted?.());
  // …and then how long until there is genuinely a picture
  const w = await waitPainted(p, { quiet: true }).catch(() => null);
  a0 = { black: await blackFraction(p, shot), tCt, drawn, paintedMs: w ? Date.now() - t0 : null };
  console.log(`\n  A0 __ct only               black ${(a0.black * 100).toFixed(1)}%   `
    + `__ct at ${a0.tCt} ms   drawn ${JSON.stringify(a0.drawn)}`);
  console.log(`     …a genuinely painted frame was available at ${a0.paintedMs} ms`);
  await p.close();
}

// ── recipe A: what GOTCHAS 78 currently tells you to do ──────────────────
let a;
{
  const p = await fresh();
  const t0 = Date.now();
  await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
  await afterFrames(p, 2);
  const shot = await p.screenshot({ path: '/tmp/w63-painted-A-rafonly.png' });
  const drawn = await p.evaluate(() => window.__ct.painted?.());
  a = { black: await blackFraction(p, shot), ms: Date.now() - t0, drawn };
  console.log(`\n  A  __ct + afterFrames(2)   black ${(a.black * 100).toFixed(1)}%   `
    + `after ${a.ms} ms   drawn ${JSON.stringify(a.drawn)}`);
  await p.close();
}

// ── recipe B: wait for a frame the renderer drew ─────────────────────────
let b;
{
  const p = await fresh();
  const t0 = Date.now();
  await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
  await waitPainted(p);
  const shot = await p.screenshot({ path: '/tmp/w63-painted-B-painted.png' });
  const drawn = await p.evaluate(() => window.__ct.painted?.());
  b = { black: await blackFraction(p, shot), ms: Date.now() - t0, drawn };
  console.log(`  B  waitPainted()           black ${(b.black * 100).toFixed(1)}%   `
    + `after ${b.ms} ms   drawn ${JSON.stringify(b.drawn)}\n`);
  await p.close();
}

ok(b.black < 0.9, `B is a picture, not the void (${(b.black * 100).toFixed(1)}% black)`);
ok(b.drawn && b.drawn.frames > 0 && b.drawn.triangles > 0,
  `B waited until real geometry went through (${b.drawn?.triangles} triangles)`);
if (a0.black >= 0.9) {
  console.log(`  NOTE  shooting on \`__ct\` alone IS the void here (${(a0.black * 100).toFixed(1)}% black) — `
    + 'GOTCHAS 78 is right about that much.');
}
if (a.black >= 0.9) {
  console.log(`  NOTE  recipe A DID shoot the void here (${(a.black * 100).toFixed(1)}% black) — `
    + 'sixtyone\'s report reproduces on this machine.');
} else {
  console.log('  NOTE  recipe A happened to catch a painted frame on this run. That is the '
    + 'whole problem with it:\n        it is a race, and it is won or lost by machine load.');
}

// ── AND IT HAS TO BE ABLE TO FAIL ────────────────────────────────────────
//
// GOTCHAS §27. A wait that silently degrades to "no wait at all" is worse than
// the sleep it replaced, and that is exactly the failure `afterFrames` has when
// rAF does not deliver — it warns and returns. So `waitPainted` THROWS, and
// this watches it throw: with `__ct.painted` removed (which is every build
// before item 181), it must refuse rather than shoot anyway.
{
  const p = await fresh();
  await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
  await p.evaluate(() => { delete window.__ct.painted; });
  let threw = null;
  try { await waitPainted(p, { capMs: 1500, quiet: true }); } catch (e) { threw = e.message; }
  ok(!!threw, 'waitPainted THROWS on a build with no __ct.painted (never shoots anyway)');
  if (threw) console.log(`        ${threw.split('\n')[0]}`);
  await p.close();
}

console.log('');
for (const c of contexts) await c.close().catch(() => {});
if (fails) { console.log(`  ${fails} FAILED\n`); await browser.close(); process.exit(1); }
console.log('  all good\n');
await browser.close();
