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
