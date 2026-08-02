// w35 — ITEM 72: which of the 23 checks with NO declared failing path are in the
// FAST TIER? That is the subset this item covers; the walking suites are a
// separate, hours-long item that a builder correctly refused to fake.
//
// Read out of the registry rather than typed from memory. A CHECKS row is
// [name, description, selftest, args, slow] — the 5th element is the tier.
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../checks.mjs', import.meta.url), 'utf8');
const body = src.slice(src.indexOf('const CHECKS = ['));

// pull the debt register out of checks-can-fail.mjs, so the two cannot drift
const guard = readFileSync(new URL('../checks-can-fail.mjs', import.meta.url), 'utf8');
const noProof = guard
  .slice(guard.indexOf('const NO_PROOF_YET = ['), guard.indexOf('];', guard.indexOf('const NO_PROOF_YET = [')))
  .match(/'([^']+)'/g).map((s) => s.slice(1, -1));

const rows = [];
for (const m of body.matchAll(/^\s*\['([^']+)',([^\n]*)$/gm)) {
  const name = m[1], rest = m[2];
  // slow is the 5th element: after description, selftest, args
  const slow = /,\s*\[[^\]]*\]\s*,\s*true\s*\]/.test(rest) || /,\s*true\s*\]\s*,?\s*$/.test(rest.replace(/^[^,]*,/, ''));
  rows.push({ name, slow: /\[\s*\]\s*,\s*true\s*\]/.test(rest), raw: rest.trim() });
}

console.log(`registry rows parsed: ${rows.length}`);
console.log(`debt register (NO_PROOF_YET): ${noProof.length}\n`);
const byName = new Map(rows.map((r) => [r.name, r]));
const fast = [], slow = [], missing = [];
for (const n of noProof) {
  const r = byName.get(n);
  if (!r) { missing.push(n); continue; }
  (r.slow ? slow : fast).push(n);
}
console.log(`FAST TIER, no declared failing path (${fast.length}) — THIS ITEM:`);
for (const n of fast) console.log(`   ${n}`);
console.log(`\nSLOW/WALKING tier (${slow.length}) — the other half, not this item:`);
for (const n of slow) console.log(`   ${n}`);
if (missing.length) console.log(`\nnot found in the registry (${missing.length}): ${missing.join(', ')}`);
