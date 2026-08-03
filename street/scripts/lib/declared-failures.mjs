// Item 287 — DECLARED FAILURES, so a suite's exit code means something again.
//
// `scripts/interiors-walk.mjs` exited 1 for four known reasons for long enough
// that its own author misread its exit code (through a `tail`, so the code was
// `tail`'s — the "exit codes from the COMMAND, never after a pipe" trap, hit by
// someone whose orders contained the warning). A suite that is always red trains
// everyone to stop reading it, and then a REAL red arrives and nothing happens.
//
// The answer is not to delete the legs, and it is emphatically not to loosen
// them until they pass (BUILDER-BRIEF §7). It is to DECLARE the known-open ones
// with a reason, and to make the declaration itself something that can fail.
//
// FOUR OUTCOMES, AND THREE OF THEM ARE RED. This is the whole design:
//
//   fail + declared    -> `decl`   quiet. A known-open defect, with a reason.
//   fail + undeclared  -> `bad`    an ordinary red. Unchanged.
//   PASS + declared    -> `rotted` RED. Somebody fixed it and the declaration is
//                                  now covering a leg that works. A declaration
//                                  that cannot expire is permanent cover, which
//                                  is the failure this exists to prevent.
//   declared, no result-> `missing` RED. The leg was renamed or never ran, so the
//                                  declaration is aimed at nothing — GOTCHAS 34,
//                                  a check that passes because it found nothing.
//
// Keys are the exact `name` string a result carries. Exported pure so it can be
// self-tested in all four directions without booting a browser
// (`scripts/probes/w116-declared-selftest.mjs`).

/**
 * @param {Array<[boolean, string, string]>} results  [ok, name, detail]
 * @param {Array<[string, string]>} declared          [name, reason]
 */
export function classify(results, declared) {
  const reason = new Map(declared);
  const seen = new Set();
  const lines = [];
  let bad = 0, decl = 0, passed = 0;

  for (const [ok, name, detail] of results) {
    const isDeclared = reason.has(name);
    if (isDeclared) seen.add(name);
    if (ok && isDeclared) {
      bad++;
      lines.push([`ROT `, name, `DECLARATION IS STALE — this leg now PASSES. Remove it from DECLARED.\n        was declared: ${reason.get(name)}`]);
    } else if (ok) {
      passed++;
      lines.push([' ok ', name, detail]);
    } else if (isDeclared) {
      decl++;
      lines.push(['decl', name, `${detail}\n        DECLARED: ${reason.get(name)}`]);
    } else {
      bad++;
      lines.push(['FAIL', name, detail]);
    }
  }

  const missing = declared.map(([n]) => n).filter((n) => !seen.has(n));
  bad += missing.length;

  return { bad, decl, passed, missing, lines };
}
