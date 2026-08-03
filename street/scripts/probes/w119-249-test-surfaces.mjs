// Item 249 (2) — WHAT IS ACTUALLY ON EACH TEST SURFACE?
//
// The row: *"`window.__hud` VERSUS `window.__ct` IS UNDOCUMENTED and cost ninety
// three probe detours … a builder reaching for the wrong one gets `undefined`
// rather than an error."* Before writing that down, enumerate it from the
// RUNNING WORLD rather than from the source — the source has several publish
// sites and a doc built by grepping one of them would be wrong the first time
// anybody added to another.
//
//   SHOT_URL=http://localhost:4750/ node scripts/probes/w119-249-test-surfaces.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';
import { waitPainted } from '../lib/painted.mjs';

const URL = aim('http://localhost:4750/');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 20000 });
await waitPainted(p);
await p.waitForTimeout(600);

const out = await p.evaluate(() => {
  const surfaces = Object.keys(window).filter((k) => /^__/.test(k));
  const dump = {};
  for (const s of surfaces) {
    const v = window[s];
    dump[s] = v && typeof v === 'object' ? Object.keys(v).sort() : typeof v;
  }
  return dump;
});

let total = 0;
for (const [k, v] of Object.entries(out)) {
  if (Array.isArray(v)) {
    total += v.length;
    console.log(`\nwindow.${k}  — ${v.length} member(s)\n  ${v.join(', ')}`);
  } else {
    console.log(`\nwindow.${k}  — ${v}`);
  }
}
console.log(`\n${Object.keys(out).length} test surfaces, ${total} members in all`);
await b.close();
