// EVERY REGISTERED CHECK MUST DECLARE A WAY TO GO RED.
//
// The sibling guard `checks-registered.mjs` asks "is every self-testing script
// in the suite?". This asks the other half, which nothing asked: "does every
// check in the suite have a failing path at all?"
//
// Both halves are needed because they fail in opposite directions. A script
// with a selftest and no registry row runs never. A registry row with no
// selftest runs constantly and has never once been watched go red — and that is
// indistinguishable, from the summary, from a check that works.
//
// This project has paid for that three times, all found by hand and all the
// same shape: `health.mjs` printed WORLD BROKEN and exited 0 (item 61),
// `bugsweep.mjs` printed STATION MISS and exited 0 (item 62), and
// `w21-roof-climb.mjs` the same (item 64). A dead world scored green for
// months.
//
// AND THE DESK'S FIRST SWEEP FOR THEM FOUND ONLY ONE, because it grepped for
// whether `process.exit` appears anywhere in the file. All three call it — just
// never on the path that matters. THE TEST HAS TO BE BEHAVIOURAL: break the
// thing and read the status. That full sweep is item 70's remaining work; this
// guard is the part that stops the backlog growing while it happens.
//
// What it enforces: every row of CHECKS in scripts/checks.mjs either declares a
// failing path (`true` for a --selftest, or a named scripts/canfail.mjs case),
// or is named below with a reason. Opting out is fine. Opting out silently is
// not — the same rule, and the same wording, as checks-registered.mjs.
//
// No browser, no server, no build. Usage: node scripts/checks-can-fail.mjs
import { readFileSync } from 'node:fs';

// ── rows that legitimately have no mutation to run ──────────────────────────
//
// These are guards over the REPOSITORY rather than over the world: there is no
// world state to break, so `--selftest` has nothing to mean. Each still exits
// non-zero on its own failing path.
const EXEMPT = {
  'checks-registered': 'a guard over scripts/ itself — no world state to mutate',
  'checks-can-fail': 'this file — a guard over the registry, with no world state to mutate',
  'no-silent-pass': 'a guard over the other checks\' output — mutating the world proves nothing about it',
  'hashes-resolve': 'reads the repo, not the world — its failing path is a missing file',
};

// ── rows inventoried by item 70 as having NO failing-path proof yet ──────────
//
// THIS LIST IS A DEBT REGISTER, NOT A BLESSING. Every name here is a check that
// runs on every suite and that nothing has ever watched fail. It is written out
// in full, rather than waved through by a rule, so the count is visible and can
// only go down: taking one off means giving it a selftest or a canfail case.
//
// Produced by scripts/probes/w32-failpath-inventory.mjs against the registry,
// not typed from memory.
const NO_PROOF_YET = [
  'lot-frontage', 'mirror-walk', 'I-apron-grain', 'people-walk', 'floaters-walk',
  'jump-walk', 'w21-roof-climb', 'gaps', 'feet-check', 'side-night', 'I-seat-exit',
  'unstick-walk', 'corner-traffic', 'crowd-net', 'side-walk',
  // 'A-eye-height-holds' — CLEARED by w35, item 72: canfail case `eye-gate-flat`,
  // proven CAUGHT behaviourally rather than declared.
  // 'integration-doors' — CLEARED by w36, item 73: canfail case `door-standoff`.
  // 'jitter' — CLEARED by w36, item 73: canfail case `jitter-reversals`.
  // BOTH NEEDED A FIX BEFORE THEY COULD BE CLEARED: each printed its own failure
  // and exited 0, so no mutation could ever have shown up. Proved twice — the
  // mutation was run against the fixed script and against the pre-fix script
  // from git on the same broken world, and only the fixed one goes red.
  'K-seat-lets-you-up', 'O-jail-door-agree',
  'L-slots-inworld', 'L-every-stool-seats-you', 'L-blackjack-inworld',
];

const src = readFileSync('scripts/checks.mjs', 'utf8');
const body = src.slice(src.indexOf('const CHECKS = ['));

const rows = [];
for (const m of body.matchAll(/^\s*\['([a-zA-Z0-9._-]+)',\s*(.*)$/gm)) {
  const [, name, rest] = m;
  // drop the question string, then read the selftest column
  const after = rest.replace(/^(['"]).*?[^\\]\1\s*,\s*/, '');
  // THE COLUMN HAS THREE SHAPES, NOT TWO — and the third is a BARE STRING.
  //
  // scripts/checks.mjs reads it as: `false` skip, `true` pass --selftest,
  // anything else is canfail case names via
  // `Array.isArray(selftest) ? selftest : [selftest]` — so `'park-repro'` on
  // its own is a perfectly good declaration, and six rows use it that way
  // (park-repro, faces, crowd-walk, A-joinery-matches-fascia,
  // A-tree-canopy-opaque, A-diner-block-vs-sky).
  //
  // The first version of this parser accepted only `true` and `[`, and so
  // reported all six as having no way to go red — six working checks accused
  // by a guard that had only ever been tried against the two shapes I had in
  // mind. Caught by running it, not by reading it.
  const declares = /^true/.test(after) || /^\[/.test(after) || /^['"]/.test(after);
  rows.push({ name, declares });
}

if (!rows.length) {
  // A parser that matches nothing would pass this guard silently, which is the
  // exact shape the guard exists to catch. (GOTCHAS 34.)
  console.error('checks-can-fail: parsed ZERO rows out of scripts/checks.mjs.');
  console.error('That is a broken parser, not an empty registry — refusing to report a pass.');
  process.exit(2);
}

const known = new Set([...Object.keys(EXEMPT), ...NO_PROOF_YET]);
const undeclared = rows.filter((r) => !r.declares && !known.has(r.name)).map((r) => r.name);
// …and the debt register must not rot either: a name that has since been given a
// selftest, or removed from the suite, should come off the list.
const registry = new Set(rows.map((r) => r.name));
const stale = NO_PROOF_YET.filter((n) => !registry.has(n) || rows.find((r) => r.name === n)?.declares);

for (const [name, why] of Object.entries(EXEMPT)) console.log(`  exempt  ${name} — ${why}`);
console.log(`\n  ${rows.length} registered checks; ${rows.filter((r) => r.declares).length} declare a failing path`);
console.log(`  ${NO_PROOF_YET.length} on the item-70 debt register (no proof yet)`);

if (!undeclared.length && !stale.length) {
  console.log('\nchecks-can-fail: every registered check declares a failing path, is exempt, or is on the register');
  process.exit(0);
}
if (undeclared.length) {
  console.error('\nREGISTERED WITH NO WAY TO GO RED — these run every suite and have never been watched fail:\n');
  for (const n of undeclared) console.error(`  ${n}`);
  console.error(`
Give it a failing path, or say why it has none:
  · a --selftest in the script, and \`true\` in its CHECKS row, or
  · a named mutation in scripts/canfail.mjs, and \`['case']\` in the row, or
  · a line in EXEMPT in this file, WITH A REASON.
A check nothing has watched fail is indistinguishable from one that works.`);
}
if (stale.length) {
  console.error('\nTHE DEBT REGISTER IN THIS FILE HAS GONE STALE — these no longer belong on it:\n');
  for (const n of stale) console.error(`  ${n} — now declares a failing path, or is no longer registered`);
  console.error('\nRemove it from NO_PROOF_YET. A register that keeps names it has settled stops being read.');
}
process.exit(1);
