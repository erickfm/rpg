// A check written but never registered runs exactly never.
//
// This has now happened twice by ACCIDENT rather than omission. My mirror-walk
// entry vanished when scripts/checks.mjs was restructured under me mid-turn, and
// 18cd0f0d reports the same thing: "spot-coverage belongs in the default tier,
// and my edit had silently dropped it". Both were caught by someone re-reading
// the file. Neither would have been caught by anything else.
//
// It is the same failure scripts/check-wiring.mjs exists for, one level up: a
// module written and never constructed is invisible; a check written and never
// registered is invisible in exactly the same way, and for the same reason —
// nothing fails, because absence never does.
//
// So: every script offering --selftest must be registered in checks.mjs, or be
// EXEMPT below with a reason. Opting out is fine. Opting out silently is not.
//
// No browser, no build, ~20 ms. Safe to run anywhere.
import { readdirSync, readFileSync } from 'node:fs';

/** Scripts with a --selftest that deliberately do not belong in the suite. */
const EXEMPT = {
  'checks': 'is the runner itself',
  'canfail': 'is a mutation harness that RUNS the checks; registering it would recurse',
  'check-artifact': 'needs dist/artifact.html packed first — it is the second half of `npm run artifact`',
  // Exits 3 without PAIRED — it compares a NIGHT capture against a DAY one, so
  // a single invocation cannot answer its own question. Same shape as
  // check-artifact: the second half of a two-step command, not a check the
  // runner can call. Registering it would have added a permanent exit-3 row,
  // which reads as WRONG WORLD and would have taught everyone to ignore that
  // banner — the failure the banner exists to prevent.
  //   JSON_OUT=1 NIGHT_H=13 node scripts/floatlit.mjs > day.json
  //   PAIRED=day.json node scripts/floatlit.mjs
  'floatlit': 'needs a paired DAY capture first — one invocation cannot answer it; see its header',
};

const dir = 'scripts';
const files = readdirSync(dir).filter((f) => f.endsWith('.mjs'));
const registered = new Set(
  [...readFileSync(`${dir}/checks.mjs`, 'utf8').matchAll(/\[\s*'([a-zA-Z0-9._-]+)'/g)].map((m) => m[1]),
);

const orphans = [];
for (const f of files) {
  const name = f.replace(/\.mjs$/, '');
  // OFFERS a selftest, not merely mentions one. The first version matched the
  // bare string and flagged THIS FILE, which talks about --selftest at length
  // and does not take one. A detector that fires on its own documentation is
  // not a detector.
  if (!/argv\.includes\(\s*['"]--selftest['"]\s*\)/.test(readFileSync(`${dir}/${f}`, 'utf8'))) continue;
  if (registered.has(name) || EXEMPT[name]) continue;
  orphans.push(name);
}

for (const [name, why] of Object.entries(EXEMPT)) console.log(`  exempt  ${name} — ${why}`);
if (!orphans.length) {
  console.log(`checks-registered: every self-testing script is registered or exempt (${registered.size} registered)`);
  process.exit(0);
}
console.error('\nWRITTEN BUT NEVER REGISTERED — these run exactly never:\n');
for (const o of orphans) console.error(`  scripts/${o}.mjs  has a --selftest and is in no tier of npm run checks`);
console.error(`
Either add it to CHECKS in scripts/checks.mjs, or add it to EXEMPT in this file
WITH A REASON. This has happened twice already by accident — an edit to
checks.mjs dropped an entry and nothing noticed, because a check that is not run
cannot fail.`);
process.exit(1);
