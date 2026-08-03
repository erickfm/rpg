// Item 251 — is `__ct.party()` there on the BUILT BUNDLE, and is it read-only?
//
// The source-vs-hook probe runs on dev, because it has to import the TS to
// compare against. This one asks the question that actually matters for the
// item and can only be asked on the bundle: does the hook exist there, does it
// carry the one party wall, and can a harness mutate the world through it.
//
// Usage: SHOT_URL=http://localhost:4510/ node scripts/probes/w95-item251-party-on-bundle.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
await page.goto(process.env.SHOT_URL || 'http://localhost:4510/');
await page.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });

const r = await page.evaluate(() => {
  const sourceGone = (() => { try { return typeof window.__vite_plugin_react_preamble_installed__; } catch { return 'n/a'; } })();
  const first = window.__ct.party?.();
  if (!Array.isArray(first)) return { ok: false, why: 'party() is not a function or not an array', sourceGone };
  // mutate what we were handed, both shapes: grow the array, and write through
  // an element. A hook that returns the live array or live objects leaks either.
  first.push({ west: 'BOGUS', east: 'BOGUS', at: 0, w: 0, h: 0 });
  first[0].at = 999;
  first[0].w = 999;
  const second = window.__ct.party();
  return {
    ok: true, sourceGone,
    len: second.length, at: second[0].at, w: second[0].w,
    pair: `${second[0].west}/${second[0].east}`,
    isolated: second.length === 1 && second[0].at === -9 && second[0].w === 2.6,
  };
});

console.log('\n  __ct.party() on this world:', JSON.stringify(r));
if (!r.ok) { console.error('  FAIL', r.why); await browser.close(); process.exit(1); }
console.log(`  ${r.isolated ? 'OK  ' : 'FAIL'} after pushing a row and writing through element 0,`
  + ` party() still reports ${r.len} row, ${r.pair}, at ${r.at}, w ${r.w}`);

// and prove the TS source really is absent here — i.e. this IS the bundle, and
// the old harness genuinely could not have worked
const src = await page.evaluate(async () => {
  try { await import('/src/proto/ct/interior.ts'); return 'SERVED'; } catch { return '404'; }
});
console.log(`  /src/proto/ct/interior.ts here: ${src}`
  + `  <- the old harness imported this; ${src === '404' ? 'it would have died' : 'this is a dev server'}`);
await browser.close();
process.exit(r.isolated ? 0 : 1);
