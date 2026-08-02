# w14 — item 5: the check suite pre-flight, the "kills its own preview server" claim, and the current 14

## Two different bugs were living under one row — fixed one, could not reproduce the other

**Bug A — real, verified, FIXED.** `checks.mjs`'s pre-flight (before Bug A: lines
56-84) compared `dist/`'s baked build SHA against `git HEAD` **unconditionally**,
regardless of whether `SHOT_URL` served that `dist/` at all. BUILDER-BRIEF tells
every builder to point `SHOT_URL` at their own **dev server**, whose entry is
`/src/main.ts` served live off disk with no relationship to `dist/`. So any
builder who had a `dist/` on disk from an earlier commit (the common case — you
do not rebuild before every `checks.mjs` run) got `dist/ ON THIS DISK IS NOT
THIS COMMIT` and `process.exit(2)` **before a single check ran**, on a
comparison that had nothing to do with what was actually being measured.

A separate killed agent had already found and diagnosed this (rescued by the
desk as commit `55574fe48` on `worktree-agent-afedb4cb4a8630b12`, patch at
`notes/rescued-checks-preflight.patch`). I did not accept it on report — I
**reproduced both states myself**, back to back, on this worktree:

1. Built `dist/` from HEAD (`1ac58131e`), then corrupted its embedded SHA
   marker to `aaaaaaaaa` (simulating a stale/mismatched `dist/`) without
   touching `HEAD`.
2. Started a **dev server** on a genuinely free port (4197 — most of
   4180-4199 was already occupied by other builders; `ss -tlnp` before
   picking one).
3. `git stash` (reverting to the unfixed file) + `SHOT_URL=http://localhost:4197/
   node scripts/checks.mjs`: **exits 2 immediately** —
   `dist/ ON THIS DISK IS NOT THIS COMMIT`, `dist/ was built from aaaaaaaaa`,
   `this checkout is at 1ac58131e`. Confirmed the bug.
4. `git stash pop` (my fix applied) + same command: **no early exit** — it
   proceeds into the actual checks (killed by a deliberate 8s timeout after
   confirming it had started `check-wiring`, `health`, `check-seethrough`;
   zero occurrences of "dist/ ON THIS DISK" in the output).

Adopted the rescued patch's fix essentially unchanged: read the response body
from the initial liveness probe, detect whether the served entry is a
content-hashed bundle asset (`HASHED`/`servingBundle`, same DEV/bundle line
`canfail.mjs` already draws) or raw dev source, and only run the `dist`-vs-
`HEAD` probe when it is actually a bundle being served. Restored `dist/` to
its correct, uncorrupted state afterward (`rm -rf dist && mv
/tmp/dist-backup dist`) — verified the embedded SHA reads `1ac58131e` again.

**Bug B — the row's headline claim ("kills the preview server… 33 chromium
processes… curl 200 -> 000") — could not reproduce, twice, matching a third
party's own finding.** Built `dist/` from HEAD, ran `npx vite preview --port
4193`, then the **full default suite** (no `--slow`) against it:

- Run 1: `curl` before **200**, after **200**. 88 pass, 14 fail (all real
  check verdicts — see below). **Zero** leftover `chromium`/`headless_shell`
  processes afterward (checked by PID; the check's own `spawnSync` had
  already exited).
- Run 2: same shape, run after the fixes below landed, to confirm they did
  not regress a healthy run.

**One more environmental data point, gathered while re-running the suite a
second time (to confirm my fix doesn't regress a healthy run): this machine
runs many concurrent builder agents, and `uptime` read load average 25-29
partway through that run** (18 `headless_shell` processes visible at once,
none of them mine — other worktrees' `interiors-walk`, `D-walk`, `bugsweep`,
etc. running at the same moment). Individual checks that take ~1-2 s idle
were taking much longer under that contention, though the run kept
progressing and the server stayed at `200` throughout. This is exactly the
shape of thing that could intermittently starve or tip over a process on a
shared host without `checks.mjs` doing anything different — more support for
"environment question, not a project one."

This matches `notes/archive/K-check-artefacts.md` exactly: K ran the suite
eight consecutive times against one preview and it survived all eight; the
deaths K *did* see (4 of them) were silent, left no `dmesg` OOM trace, and
**happened with no check running at all** — once right after `npm run build`,
before any check started. K's conclusion: *"the checks are not killing it…
the pattern that fits is a process being reaped between shell invocations
rather than anything the suite does — an environment question, not a project
one."* My own evidence agrees: `checks.mjs` runs every check **sequentially**
via `spawnSync` (no concurrent browser load), and a clean run leaves nothing
behind.

**I am not claiming Bug B never happens** — the auditor reproduced it twice
with specific numbers (33 processes, 50/52 tally) and that is real evidence
from a real session, not invented. I am saying: it did not reproduce for me,
it did not reproduce for K, and the mechanism (sequential execution, no
leaked processes on a clean run) does not point at anything inside
`checks.mjs` that a code fix here could target with confidence. Per the
brief's §7 ("never fix a failing check by loosening it until it passes" — the
inverse applies too: don't invent a fix for a mechanism you cannot locate).

## What I fixed anyway, in case Bug B is real and intermittent

The auditor's own suggested fix, and verifier C's supplied discriminator
(non-zero exit + zero FAIL lines = casualty; non-zero + an actual FAIL line =
real), together describe a **classification fix that is correct regardless of
Bug B's root cause**, and is fully scoped to `scripts/checks.mjs`:

- After every check (and specifically after a timeout, which is the shape a
  dead-server casualty takes), poll the server with one more `fetch`.
- If it is gone, **stop attributing results to individual checks.** Mark
  that check and every remaining one `SERVER DIED (unmeasured)`, print one
  explanatory banner once, and move on — no retry loop, no restart (the item
  explicitly warns a restart-between-checks would hide the check that
  triggers a death, if there is one).

This does not "fix the cause" of Bug B, because I could not find a
reproducible cause inside this file to fix. It fixes the **reporting**, which
is the half of the row's own text that is unconditionally true regardless of
Bug B's mechanism: *"a reader of the summary cannot tell which"* (real vs
casualty). Verified it does not misfire on a healthy run (run 2 above, same
88/14 split, no spurious SERVER DIED rows).

## The current 14 failures (clean run, no server death), classified

Ranked by how confident I am, from a light pass — not a full investigation,
since none of these files are named by this item:

**Real, and worth the desk's attention first — headline features that look broken now:**
- **`K-tv-off-unless-seated`**: sitting on the bed no longer turns the TV on
  (`window.__ct.scene().userData.tv.on` stays `false` up to a 6s
  `waitForFunction`, GOTCHAS §30-compliant, not a timing artefact).
  Reproduced standalone, twice. This is the feature the ledger's headline
  table calls `CONFIRMED (C, K)`.
- **`L-blackjack-inworld`** (8 sub-failures): the table does not open even
  through its own documented API. I independently probed
  `window.__blackjack.open()` from the console (not via the check) —
  `typeof window.__blackjack.open === 'function'`, calling it, then
  `window.__hud.panel()` **stays `null`**. This directly contradicts
  `notes/LEDGER.md`'s "DESK CONFIRMED 2026-07-31, build c90d5b8e6" row for
  blackjack. Either a regression landed since that confirmation, or the
  confirmation itself did not hold (GOTCHAS 49: CONFIRMED can be untrue).
  **Not fixed here** — `ct/blackjack.ts`/`ct/hud.ts`, not this item's file.

**Real, already known and tracked elsewhere — no new row needed:**
- `seampairs` (227 real disagreements) — established REAL by a prior worker,
  queue item 6 already exists for it.
- `D-outline-debug-only` — ledger row 312 already says explicitly "fails on
  stale stations, not a regression, do not send anyone after it."
- `hashes-resolve` (187 unreachable citations) — the ongoing GOTCHAS §36
  rebase-citation-rot class, ledger row 313 already tracks it.

**Real, not previously tracked (as far as I found) — worth a row:**
- `density` (39 declared-vs-mapped mismatches, clustered at the jail's
  exterior, x≈63/z≈-103…-107) — same location class as `seampairs`, possibly
  the same underlying jail-masonry cause.
- `jump-walk`: **"the pavement: apex 5.260 m is outside the intended 0.6 m
  hop"** — a jump on the pavement launches ~9x higher than every other
  surface tested (kerb, road, stoop, three interior floors all land at
  0.48-0.62 m). Worth flagging loudly — `fp.ts`, which is desk-owned/highest
  risk and explicitly not mine to touch (item 1's own note).
- `gotchas-numbers`: `notes/GOTCHAS.md` has §51 and §52 each used twice, and
  §51 appears after §52 — a real numbering defect in a file other builders
  cite by number.
- `checks-registered`: 3 scripts (`F-diag-owalk.mjs`, `H-flare-silhouette.mjs`,
  `ledger-intact.mjs`) exist with a `--selftest` but are wired into neither
  `CHECKS` nor `EXEMPT`. This one **is** about `scripts/checks.mjs`, but I
  did not add them myself — registering an unfamiliar check into the suite
  everyone else relies on without vetting its runtime and stability first
  seemed like the wrong kind of fast. Flagging precisely instead.
- `N-post-waiting` (3 of ~40 assertions): picking up the rent slip doesn't
  unfold it/leave the floor; standing in your own doorway offers the slip
  instead of a specific neighbour-package label it expected.
- `L-every-stool-seats-you`: 1 of 2 sampled slot stools seats the player but
  does not open the machine.
- `floaters-walk`: 59 furniture-height (<1.4 m) props reported with air under
  them, spread across bank/casino/church/tax/hotel/jail — a large finding,
  genuinely out of scope for a one-item pass.

**Ambiguous — the check itself says don't route yet:**
- `mirror-walk` flags PAWN and THRIFT as not mirroring, but prints its own
  caveat: `notes/A-mirror-verified.md` walked these same rooms by hand and
  found them mirroring correctly, and the check's left/right convention has
  not been checked against that manual walk. One of the two is wrong; I did
  not have time to resolve which.

**Not real — instrument gap, self-declared:**
- `spot-coverage`: 11 door spots have no dedicated walking check exercising
  them. The check's own text: "this is a gap in the HARNESS, not proof the
  spot is broken."

**One non-reproducible flake, noted for completeness:**
- In the very first run, `seampairs.mjs` crashed with `ENOENT` writing
  `shots/seampairs.json` (the directory existed; the file simply wasn't
  created in time). Reproduced twice more, both directly and via a minimal
  density-then-seampairs `spawnSync` harness mimicking `checks.mjs` — **could
  not reproduce the crash again.** Not investigated further; if it recurs
  reliably for someone else, it is a `seampairs.mjs` filesystem race, not a
  `checks.mjs` one.

## Not fixed, and why

Everything under "real, not previously tracked" above lives outside
`notes/LEDGER.md` (which this item does not grant either) and outside
`scripts/checks.mjs` (`fp.ts`, `ct/blackjack.ts`, `ct/apartment.ts`,
`ct/tenancy.ts`, `GOTCHAS.md`, `ct/lot.ts`/jail masonry). Reporting them
precisely here, per the brief's §9, rather than editing files this item does
not name.

## Derived vs copied

`roomDims()`/coordinate numbers above are read live from the running world.
The two replacement build SHAs and the "8 consecutive runs" / "33 chromium
processes" figures are quoted from `notes/LEDGER.md` and
`notes/archive/K-check-artefacts.md` respectively, cited rather than
re-measured where re-measuring wasn't possible (K's own dead sessions are
gone) — my own two clean runs are new, independent measurements of the same
question.
