// ITEM 285 — the row names SLOTS as one of the five diegetic tenants to check.
// `w114-item285-tenants.mjs` reported it MISSING: no registered spot's label
// matches /slot machine/i, though `ct/slots.ts:2356` writes exactly that string.
// So either the spot is registered under a different label, or it is not
// registered at all — and "not registered" is the eleventh instance of this
// project's most expensive bug (a finished feature the world never wires up).
// Ask the world which.
//   SHOT_URL=http://localhost:4482/ node scripts/probes/w114-item285-casino-labels.mjs
import { chromium } from 'playwright';
import { aim } from '../lib/aim.mjs';

const URL = aim('http://localhost:4482/');
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct !== undefined, { timeout: 30000 });
await p.waitForTimeout(1200);
const out = await p.evaluate(() => {
  const all = (window.__ct.spots?.() ?? []).map((s) => ({
    label: String(typeof s.label === 'function' ? s.label() : s.label),
    x: +s.x.toFixed(1), z: +s.z.toFixed(1),
  }));
  return {
    total: all.length,
    casino: all.filter((s) => /slot|casino|machine|spin|jack|roulette|craps|poker|felt|stool/i.test(s.label)),
  };
});
console.log(`spots registered: ${out.total}`);
console.log(`casino-ish labels: ${out.casino.length}`);
for (const s of out.casino) console.log(`   "${s.label}"  (${s.x}, ${s.z})`);
await b.close();
