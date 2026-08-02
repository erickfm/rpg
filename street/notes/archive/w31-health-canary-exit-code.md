# w31 — item 61: the canary can die now

**Port used: 4192** (proved free with `curl` → `000` before starting; `ss -ltn`
showed 4180, 4181, 4187, 4188, 4193, 4194 already taken by other builders).
`SHOT_URL` passed explicitly to every instrument. Servers shut down at the end.

**Root cause, one line:** `scripts/health.mjs` contained no `process.exit` and no
`process.exitCode` at all, so its verdict only ever reached stdout and node
returned 0 — and the suite reads status, not prose.

---

## What changed

| file | change |
|---|---|
| `scripts/health.mjs` | the verdict reaches the exit code; a third status for "nothing measured" |
| `scripts/checks.mjs` | the `health` row: `false` → `['health-dead']` |
| `scripts/canfail.mjs` | new `health-dead` mutation case |
| `scripts/probes/does-the-health-row-route-to-canfail.mjs` | replays the runner's branch logic on the registry row |
| `scripts/probes/does-health-survive-a-pipe.sh` | the verdict survives a pipe, and so does the status |

**No world source was touched.** `git diff e4d079f3b..HEAD -- src/` is **empty**
— 0 lines. The two builds differ only in the build stamp (`Qp`), the build
timestamp (`$p`), and the stamp's dirty flag; byte-compared and confirmed. There
was nothing to fingerprint, because nothing in the world moved.

## Three statuses, not two — and the third is load-bearing

```
0   __ct appeared. The world initialised.
1   the page loaded and __ct never appeared. MEASURED, and it is broken.
3   nothing was measured — no server, or the wrong build.
```

Adding `exit 1` **alone would have been a bug**. `p.goto` against a dead port
threw an unhandled rejection, and node forces exit 1 on that — so the moment
"the world is broken" also became 1, a builder who simply forgot to start a
preview would have been sent to look at their own code. That is the same
confusion as the LEDGER's *"~half its 52 failures are artefacts"* row, and
`reportWorld` already spends thirty lines on the distinction. `checks.mjs` reads
`r.status === 3` as WRONG WORLD / unmeasured, so 3 lands in the right bucket.

Measured, all three, against real servers:

```
SHOT_URL=http://localhost:4192/ node scripts/health.mjs   WORLD OK      EXIT=0
SHOT_URL=http://localhost:4196/ node scripts/health.mjs   WORLD BROKEN  EXIT=1   (blank page, no __ct)
SHOT_URL=http://localhost:4197/ node scripts/health.mjs   NOTHING MEASURED EXIT=3 (dead port)
```

## `process.exitCode`, not `process.exit(…)`

`process.exit` can truncate a pending stdout write when stdout is a pipe, which
would lose the verdict in exactly the `| tail` case a reader is most likely to
use. Nothing holds the loop open once the browser is closed, so setting the
status and returning is safe. Proved, not assumed —
`scripts/probes/does-health-survive-a-pipe.sh`: verdict present through a pipe
and through a redirect, status 1 both times. (The probe also sidesteps the `$?`
-after-a-pipeline trap the brief warns about, by taking the status from a
redirected run rather than a pipeline.)

## Console errors: REPORTED, NOT JUDGED

w22 left this open as a judgement call; this is the decision, and it agrees with
w22's recommendation. This check answers one question and `bugsweep.mjs` owns
page errors properly across 12 rooms. Folding them in would make the world's
cheapest smoke test go red for a deprecation warning — and the sweep I ran today
emits exactly that (`THREE.Clock deprecated`, Canvas2D `willReadFrequently`).
**It costs nothing:** any error that actually stops initialisation also stops
`__ct` appearing, so it is already caught by the verdict. The printed line now
says so, rather than sitting under the verdict looking like part of it.

## The defaulted port was ALREADY handled — I changed nothing for it

The item's third clause ("refuses or announces a defaulted port") was **already
satisfied before I touched anything**, twice over, and it is worth recording so
nobody spends an item on it:

```
$ node scripts/health.mjs                       # no SHOT_URL
  ⚠  NOT AIMED — no SHOT_URL, so scripts/health.mjs fell back to PORT 4177.
  …
MEASURING THE WRONG WORLD.
  http://localhost:4177/ is serving build dbf0e6532+
  this checkout is at      e4d079f3b
EXIT=3
```

`lib/aim.mjs` announces the guess on stderr, and `reportWorld` then **refuses**
outright with exit 3 because 4177 was another builder's tree. w22's note flagged
this as an open second defect ("silently measures whoever is on 4177"); `aim`
landed since and it is no longer silent.

## The mutation, and why the case is the real guard

`canfail.mjs` `health-dead` withholds `(window as any).__ct` in
`src/proto/crosstown.ts`. That assignment is the **last** thing the entry point
does, so every real initialisation failure arrives at the browser as exactly
this observable state: the page serves and `__ct` is never there. It is a world
mutation, not a blinded stamp — `__ct` really is gone from `window`, and
`library-pc.ts`, `slots.ts`, `blackjack.ts` and `hud.ts` all genuinely find
nothing.

**Honest limit:** it withholds the handle at the end of a world that otherwise
built correctly, so it proves health notices the *state* every init failure
produces, not that it notices an early throw. Every early throw is a superset —
it also prevents line 997 — so a health that catches this catches those. The
converse is not established by this case and nothing claims it is.

**I did not trust canfail's own CAUGHT.** GOTCHAS 32: canfail scores CAUGHT on
*any* non-zero exit, so a wrong-world abort (exit 3) certifies falsely; and its
INERT guard only runs on a case that goes **green**, so a red case is never
byte-checked. So the catch was proved by hand:

- **the mutation was not inert** — bundle hash moved `index-C3fVMCGQ.js` →
  `index-ts6ov6Tk.js`, and 4192 was confirmed serving the mutated entry;
- **it was not a wrong-world false green** — health printed
  `measuring … build d1dd0d609+ (uncommitted changes, as expected)`, so
  `reportWorld` did **not** abort;
- **the counterfactual**, same world, same instant: the pre-fix `health.mjs`
  (`git show e4d079f3b:street/scripts/health.mjs`) printed the identical
  `WORLD BROKEN — __ct never appeared` and **exited 0**, where the fixed one
  exits 1.

Full cycle: fix in place → CAUGHT (0) · fix removed → **SLEPT (1)** · fix
restored → CAUGHT (0). `crosstown.ts` md5 back to `7b97abef…`, tree clean.

## FINDING — w22's probe can no longer detect this regression, and I caused that

`scripts/probes/can-a-check-print-fail-and-exit-0.mjs` is the static probe that
**found** this defect. It now reports **124 of 124 can go red**, with `health`
listed among them. But when I deliberately deleted health's
`process.exitCode = ok ? 0 : 1;` line, **it still reported 124/124 and still
listed health as "exits non-zero"** — because health now legitimately contains
`process.exit(3)` for the nothing-measured path, and the probe asks only whether
*a* non-zero exit exists in the file, not whether the **verdict** reaches the
status.

So my own exit-3 addition blinded the instrument that found the bug. The
`health-dead` canfail case caught that same regression correctly (SLEPT, exit 1)
— which is precisely why the item asked for a mutation and not a static claim.
Recorded rather than fixed: the probe is not mine and its verdict is still true
for the other 123. **Suggested follow-up for the desk:** the probe's question
wants to be "does the FAILING branch reach a non-zero status", not "does the file
contain one".

## Also found, NOT fixed — three stale docs (outside my item's files)

Item 61 lands the fix; these still tell agents the opposite. All three are
one-line desk edits:

1. **`CLAUDE.md` line 103** (repo root, and the same table in the worktree copy)
   — *"**READ ITS OUTPUT, DO NOT TRUST ITS EXIT CODE.** It prints `WORLD BROKEN`
   and still exits 0 (it contains no `process.exit` at all) … Queued as item 61;
   **until that lands**, look at the line it prints. It also defaults `SHOT_URL`
   to 4177"*. Every clause of this is now false. Its own wording says to remove
   it when item 61 lands.
2. **`notes/GOTCHAS.md` §65** — accurate as a lesson and worth keeping, but
   written in the present tense (*"prints … contains no `process.exit` at all"*).
   Wants a "FIXED by item 61 (w31)" line, and its *"of 122 registered checks"*
   is now 124.
3. **`street/START-HERE.md` line 143** — neutral, no change needed; noted only so
   the desk does not have to go looking.

I did not edit them: none is named by item 61, `CLAUDE.md` and `GOTCHAS.md` are
read by every agent, and §9 of the brief says to report rather than reach.

## Verification run

- `npm run build` (`tsc --noEmit && vite build`) — clean.
- `node scripts/mutations-quote-real-source.mjs` — **46 needles, all quote source
  that exists** (45 before mine).
- `node scripts/probes/does-the-health-row-route-to-canfail.mjs` — 3 ok, exit 0;
  **mutation-tested**: reverting the registry row to `false` makes it print
  3 FAIL and exit 1, and the revert changed bytes.
- `node scripts/bugsweep.mjs` — exit 0, **0 STATION MISS**, 96 shots. Console
  output is the pre-existing warning set only (THREE.Clock deprecation, Canvas2D
  `willReadFrequently`, WebGL driver stalls); no errors.
- Verified on the **built bundle** via `npx vite preview` on 4192, not only dev.

## One instrument error of my own, recorded

I compared the two 1.1 MB minified bundles with Python's `difflib`, which is
O(n²) and blew a 300 s timeout. A direct first-differing-byte scan plus a
targeted substitution answered the same question in under a second. Half of all
apparent defects here are the instrument — including, twice today, mine.
