// Unknown flags are a typo, not a no-op.
//
// `7369c0c69` found scripts silently ignoring unrecognised flags, **including
// `--selftest`**, and that is the worst one to ignore. Measured on three of
// mine before fixing them:
//
//   node scripts/lot-clearance.mjs --slftest   ->  exit 0, nothing mutated
//   node scripts/lot-kerb-seam.mjs  --slftest   ->  exit 0, nothing mutated
//   node scripts/door301.mjs        --slftest   ->  exit 0, nothing mutated
//
// A selftest that ran and CAUGHT its mutation also exits 0. So by exit code
// alone — which is how `canfail`, `checks.mjs` and every batch loop read a
// script — a mistyped selftest is indistinguishable from a selftest that
// worked. You get told the guard is proven when nothing was proven at all.
//
// The same shape as GOTCHAS 34: the check did nothing and reported success.
// Here the empty set is the set of flags that were understood.
//
//   import { flags } from './lib/args.mjs';
//   const { selftest, rest } = flags(['--selftest']);
//
// Anything starting with `-` that is not in `known` exits 2 — the usage code —
// naming the flag and listing what is accepted. Positional arguments come back
// in `rest`, so `[outdir]` and numeric boxes keep working.

/**
 * Parse argv against a whitelist, refusing anything unrecognised.
 *
 * @param known  the flags this script accepts, e.g. ['--selftest']
 * @param argv   defaults to process.argv.slice(2)
 * @returns  { rest: string[], <flag-without-dashes>: boolean }
 */
export function flags(known, argv = process.argv.slice(2)) {
  const out = { rest: [] };
  for (const k of known) out[k.replace(/^-+/, '')] = false;
  const bad = [];
  for (const a of argv) {
    if (!a.startsWith('-')) { out.rest.push(a); continue; }
    if (known.includes(a)) { out[a.replace(/^-+/, '')] = true; continue; }
    bad.push(a);
  }
  if (bad.length) {
    console.error(`\nUNRECOGNISED ${bad.length > 1 ? 'FLAGS' : 'FLAG'}: ${bad.join(', ')}`);
    console.error(`  This script accepts: ${known.join(', ') || '(no flags)'}`);
    console.error(`  Ignoring it would run the ordinary check and exit 0, which is`);
    console.error(`  what a selftest that CAUGHT its mutation also does — so a typo`);
    console.error(`  would read as a proven guard. Exiting 2 instead.\n`);
    process.exit(2);
  }
  return out;
}
