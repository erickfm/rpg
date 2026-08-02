#!/usr/bin/env node
// One question: which seat labels exist in a given build, how many of each, and
// what fields does a seat row publish? Written to find out what the artifact
// check can legitimately aim at before rewriting it.
//
//   SHOT_URL=http://localhost:<port>/artifact.html node scripts/probes/w28-seat-census.mjs
import { chromium } from 'playwright';

const URL = process.env.SHOT_URL;
if (!URL) { console.error('ABORTED: set SHOT_URL.'); process.exit(3); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__ct?.seats !== undefined, { timeout: 30000 });
const out = await p.evaluate(() => {
  const m = {};
  for (const s of window.__ct.seats()) m[s.label] = (m[s.label] ?? 0) + 1;
  const pick = (label) => window.__ct.seats().filter((s) => s.label === label)
    .map((s) => ({ keys: Object.keys(s), pose: s.pose, at: s.at }));
  return { m, bj: pick('sit at the blackjack table'), slot: pick('sit at the slot').slice(0, 2) };
});
console.log(JSON.stringify(out.m, null, 1));
console.log('BLACKJACK:', JSON.stringify(out.bj, null, 1));
console.log('SLOT (2):', JSON.stringify(out.slot, null, 1));
await b.close();
