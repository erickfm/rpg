// Is the world's server there — and if not, WHICH kind of not-there?
//
// Extracted from `scripts/checks.mjs` (queue item 182) so that a probe can
// exercise the real classifier instead of a retyped copy of it. BUILDER-BRIEF
// §8: a second hand-typed copy of a rule is the most expensive habit here.
//
// ── WHY THIS IS NOT A BOOLEAN ──────────────────────────────────────────────
//
// `checks.mjs` used to ask `response.ok` and latch `serverDied` on false. Worker
// sixtyone reported the consequence: run `npm run build` while a preview is
// serving and **every check afterwards prints `SERVER DIED (unmeasured)`**, so a
// builder sees a wall of dead checks and goes looking at their own change.
//
// **The reported CAUSE was wrong, and the wrong cause is the expensive one.**
// The build does not kill the preview. Measured on this tree 2026-08-02, polling
// a live `vite preview` flat out through one `npm run build`
// (`scripts/probes/w67-does-build-kill-preview.mjs`):
//
//     HTTP 200   5760 polls   0.03s .. 2.44s
//     HTTP 404   1175 polls   0.67s .. 0.89s
//     zero refused connections; still listening afterwards
//
// `vite build` EMPTIES `dist/` before writing it and `vite preview` serves
// `dist/` statically, so a perfectly healthy server has no page for ~220 ms.
// `r.ok` is false for that 404 exactly as it is false for ECONNREFUSED — one
// blink, and a twelve-minute run threw away everything after it.
//
// Three answers, because there are three accidents and they have three fixes:
//
//   'ok'     2xx. There is a world there.
//   'empty'  the socket answered, 4xx/5xx. The PROCESS IS ALIVE; dist/ is gone.
//            A build is running, or the last one failed after emptying it.
//            Fix: wait, or re-run `npm run build`. Do NOT start a second server.
//   'dead'   the fetch threw. Nothing is on the port. This is the real death the
//            auditor reproduced (LEDGER: 200 -> 000, 33 leaked chromiums), and
//            unlike 'empty' it does not heal on its own.

/** One request. 'ok' | 'empty' | 'dead' — never a boolean. */
export async function probeServer(url, timeoutMs = 3000) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return r.ok ? 'ok' : 'empty';
  } catch { return 'dead'; }
}

/**
 * Same, but an 'empty' is given time to heal — because by construction it can.
 *
 * Adds a fourth answer the single probe cannot give: **'recovered'** — it was
 * empty and now it is not. That is the signature of a build race, and it is the
 * one case where the right response is to shrug and carry on rather than write
 * off the rest of the run.
 *
 * The measured blind window is 220 ms. Six seconds is thirty times that, and it
 * costs a healthy run nothing, because callers only reach here once something
 * has already failed.
 */
export async function probeWithRecovery(url, { tries = 6, waitMs = 1000 } = {}) {
  let state = await probeServer(url);
  if (state !== 'empty') return state;
  for (let i = 0; i < tries && state === 'empty'; i++) {
    await new Promise((r) => setTimeout(r, waitMs));
    state = await probeServer(url);
  }
  return state === 'ok' ? 'recovered' : state;
}

// ── END OF RUN ─────────────────────────────────────────────────────────────
//
// Everything above answers "is the server there NOW", and every caller asked it
// on the way IN. Item 239 is about the other end of the run, and it is a
// different question with a different answer.
//
// **A CHECK LOADS THE PAGE ONCE AND THEN NEVER TOUCHES THE SERVER AGAIN.**
// Measured on this tree 2026-08-03: **99 of the 141 checks registered in
// `scripts/checks.mjs` call `.goto()` exactly once**, and everything after it is
// `page.evaluate` against a world that now lives in the browser's memory. Kill
// the server at that point and nothing notices — the JS world keeps running, the
// legs keep passing, and the check prints its verdict.
//
// Reproduced rather than asserted (`scripts/probes/w92-does-a-dead-server-show.mjs`):
//
//     door301, preview SIGKILLed 6s into a 12.9s run
//     -> exit 0, "the door holds: opens, shuts, blocks the doorway"
//        never mentions the server.  MORE THAN HALF the run measured a
//        world that had stopped existing.
//
// That is worker eightytwo's report from `notes/w82-item226-containment-classified.md`:
// its server was killed mid-run and `interiors-walk` "kept going against the page
// it had already loaded". It noticed only because of an unrelated notification.
//
// **A STARTUP POPULATION FLOOR CANNOT SEE THIS AND NO BIGGER ONE WILL.** The
// floor runs once, at the start, when the world was genuinely there. eightytwo's
// floor counted 359 floor meshes at room 0 and was right to; the server died at
// room 7.
//
// So the guard has to run at the END, and it is two questions, not one:
//
//   1. **is the server still serving?** — `probeWithRecovery`, above, so a build
//      race is told apart from a death rather than lumped in with it.
//   2. **did every leg that was registered actually run?** — because a run can
//      also lose its subject without losing its server, and the shape on the page
//      is identical: a short green report that reads like a whole one.
//
// Both are FAILURES, and the message has to name which, because the fixes differ.

/**
 * Ask, after the last leg, whether this run is worth believing.
 *
 * `ran` / `registered` are the leg accounting. Pass them when you know how many
 * legs you set out to run; omit them and only liveness is judged. They are the
 * caller's numbers deliberately — "leg" means a room here, an assertion there, a
 * registered check in `checks.mjs` — and a library that tried to guess would be
 * inventing a population, which is the very thing this file exists to stop.
 *
 * Returns `{ ok, state, ran, registered, lost, lines }`. It does not exit and it
 * does not print; `reportEndOfRun` below does both. Split so a probe can assert
 * on the verdict without scraping stdout.
 */
export async function endOfRun(url, { ran = null, registered = null, leg = 'leg' } = {}) {
  const state = await probeWithRecovery(url);
  const lost = ran !== null && registered !== null ? Math.max(0, registered - ran) : 0;
  const lines = [];
  const legs = (n) => `${n} ${leg}${n === 1 ? '' : 's'}`;

  // A DEATH AND AN EMPTY dist/ ARE NOT THE SAME NEWS — same argument as the
  // three-way classifier above, one stage later.
  if (state === 'dead') {
    lines.push(`THE SERVER AT ${url} WAS GONE BY THE END OF THIS RUN.`);
    lines.push('  Nothing is listening on that port — the connection was refused.');
    lines.push('  A check loads the page ONCE and then measures it in the browser\'s memory,');
    lines.push('  so the world kept answering after the server stopped existing. Every leg');
    lines.push('  above may have been measuring a corpse, and none of them could tell.');
    if (lost) lines.push(`  ${legs(lost)} of ${registered} never ran at all.`);
    lines.push('  THIS RUN IS UNMEASURED, not green and not red. Restart the server, re-run.');
  } else if (state === 'empty') {
    lines.push(`${url} IS STILL LISTENING, BUT dist/ IS GONE.`);
    lines.push('  It accepted the connection and answered — it has no page to serve. A');
    lines.push('  preview serves dist/, and `vite build` empties dist/ before writing it.');
    lines.push('  Six seconds of that is a build still running, or one that FAILED after');
    lines.push('  emptying dist/. The results above were taken from a page loaded before');
    lines.push('  that happened and cannot be told apart from a clean run.');
    if (lost) lines.push(`  ${legs(lost)} of ${registered} never ran at all.`);
    lines.push('  Re-run `npm run build`, then re-run this. Do NOT start a second server.');
  } else if (lost) {
    // The server is fine and the run is still short. That is the second half of
    // item 239 and it is the half a liveness probe alone would miss.
    lines.push(`THIS RUN LOST ${legs(lost)}.`);
    lines.push(`  ${ran} of ${registered} registered ${leg}s ran. The server is still serving, so`);
    lines.push('  this is not a death — the run stopped short of its own subject list, and a');
    lines.push('  short report reads exactly like a complete one once the count scrolls off.');
  }

  // 'recovered' is NOT a failure, and that is deliberate rather than lenient:
  // it means dist/ blinked and came back, which `vite build` does for ~220 ms of
  // every build against the same tree (w67's 1175 of 6935 polls). The world was
  // there the whole time. Say it happened, believe the run.
  if (state === 'recovered') {
    lines.push(`(${url} answered 404 briefly and recovered — a build ran against this tree.`);
    lines.push('  The server never went anywhere; these results stand.)');
  }

  const ok = state === 'ok' || state === 'recovered' ? !lost : false;
  return { ok, state, ran, registered, lost, lines };
}

/**
 * `endOfRun`, printed in the house voice, reduced to an exit code.
 *
 * Returns 0 if the run is worth believing and **3 if it is not** — deliberately
 * not 1. GOTCHAS 32: 1 means "measured, and it is WRONG", and a run whose server
 * died measured nothing at all. Handing back 1 would file a dead server as a
 * defect in the world, which is the whole family of confusion this is fixing.
 *
 * Callers keep their own verdict: `process.exit(bad ? 1 : await reportEndOfRun(...))`
 * reads correctly — a real red still wins, because a red is a finding and this
 * is the absence of one.
 */
export async function reportEndOfRun(url, opts = {}) {
  const v = await endOfRun(url, opts);
  if (v.lines.length) console.log('\n' + v.lines.join('\n'));
  return v.ok ? 0 : 3;
}
