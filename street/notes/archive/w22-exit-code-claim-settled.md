# w22 — "prints 8 FAILED and exits 0": the observer, not the world

Queue item 39, a claim to settle. Port **4183**.

## Verdict

**The finding was the observer.** `scripts/L-blackjack-inworld.mjs` exits **1**
when it fails. The desk's hypothesis was right, and I reproduced the artifact
that produced the report.

**But the defect class is real and it is somewhere else:
`scripts/health.mjs` prints `WORLD BROKEN` and exits 0.** It is registered in
`checks.mjs`, so it is a permanently green row, and it is the check CLAUDE.md
tells every new agent to run. Named, not fixed — see below.

## How it was settled

I sabotaged the world rather than the check, so the failure would be genuine:
`ct/blackjack.ts:1228`, `CHIP = slots.CREDIT` → `slots.CREDIT * 1.2`, which makes
a chip and a slot credit different money. Reverted immediately after; the working
tree is clean and `git status` shows only my probe. (`live-integrate.sh` was not
running, so nothing leaked into the user's world at 5177. I checked before
touching anything.)

Same script, same failing world, same minute:

```
$ SHOT_URL=http://localhost:4183/ node scripts/L-blackjack-inworld.mjs > /tmp/out 2>&1
  UNPIPED EXIT = 1                      <- node's own status
  (/tmp/out ends: "all: 1 FAILED.")

$ SHOT_URL=http://localhost:4183/ node scripts/L-blackjack-inworld.mjs 2>&1 | tail -3
  all: 1 FAILED.
  PIPED-TO-TAIL EXIT = 0                <- tail's status, not node's
```

That is the report, exactly: **prints FAILED, "exits 0"**. `$?` after a pipeline
is the status of the LAST command in it, and `tail` succeeded at tailing. Nothing
in the world or the check is wrong.

Baseline, for contrast: unsabotaged, `0 FAILED`, unpiped exit **0**. So the check
discriminates — it is not stuck on one answer.

## No bypass path exists

The item asked me to find the path around line 259 if it really did exit 0. It
does not, and there is none to find. Every `process.exit` in the file:

| line | code | when |
|---|---|---|
| 43 | 2 | unknown mode word — usage |
| 49 | 3 | no `SHOT_URL` — nothing measured |
| 65 | 3 | the URL served no world |
| 83 | 1 | `ct/blackjack.ts` never registered |
| 121 | 3 | the seat never appeared |
| 259 | `bad === 0 ? 0 : 1` | the verdict |

`bad` and `check` are both module scope with one definition each, so there is no
second counter for a failure to hide in. Line 259 is the only path that can
return 0 and it is guarded on the count.

I did **not** touch a working exit path, as instructed.

Where "8" came from, most likely: before `e3672417c` this check called
`open()` past nobody being seated and the seat-close tick shut the panel a frame
later, "failing everything downstream" — its own header says so. That is the
shape of a run with many FAILs. It would still have exited 1.

## `checks.mjs` reads status correctly

`spawnSync('node', args, …)` and then `r.status` — no shell, no pipeline, so the
class of artifact above cannot reach it. `r.status !== 0` sets
`process.exitCode = 1` on both the normal and the `--selftest` path, and the
runner already discriminates the three states GOTCHAS §32 cares about: `3` or the
`MEASURING THE WRONG WORLD` banner → `WRONG WORLD`, a timeout or a non-zero with
a dead server → `SERVER DIED (unmeasured)`, otherwise `FAILED (n)`. Nothing to
fix here.

**That is exactly why the finding below matters.** The runner trusts the status
completely, so a check that returns 0 while printing a failure is invisible to
it — there is no string fallback for a check's own verdict, only for the
wrong-world banner.

## Found and NOT fixed — `scripts/health.mjs` is a permanently green row

`scripts/probes/can-a-check-print-fail-and-exit-0.mjs` reads all 122 names out of
the `CHECKS` registry and asks, per script, whether a failure-printing path can
reach the end of the file. **121 of 122 can go red on their own verdict.** The
one that cannot is `health`.

Static analysis is a hypothesis about source, so I read it and then measured it.
`scripts/health.mjs` in full is 20 lines and ends:

```js
console.log(ok ? 'WORLD OK — __ct initialised' : 'WORLD BROKEN — __ct never appeared');
if (errs.length) console.log('errors:\n' + errs.slice(0,3).join('\n'));
await b.close();
```

No `process.exit`, no `process.exitCode`. It falls off the end and node returns 0.

Measured, not inferred. I served a page with no `__ct` and no build stamp on
4214 — `reportWorld` only aborts on a stamp *mismatch*, and logs "cannot verify"
when there is none, so it runs straight through:

```
$ SHOT_URL=http://localhost:4214/ node scripts/health.mjs
  measuring http://localhost:4214/  (no build stamp found — cannot verify)
  WORLD BROKEN — __ct never appeared
  UNPIPED EXIT = 0
```

`checks.mjs` renders that as `health … ok`. **If the world stops initialising,
the suite says the world is fine** — and `node scripts/health.mjs` is the command
CLAUDE.md hands to every agent for "does the world actually initialise". It is
also the cheapest check in the suite, so it is the one most likely to be run
alone and believed.

My probe classified it `CANNOT GO RED AT ALL` rather than
`CAN PRINT FAIL AND EXIT 0` only because it prints `WORLD BROKEN` and not the
word `FAIL`. Same defect, and the wording is why it survived every previous
sweep for this — including, I assume, the one that produced item 39.

The fix is one line at the foot of **`scripts/health.mjs`**, which item 39 does
not name:

```js
 await b.close();
+// The suite reads status and nothing else, so a verdict that is only printed is
+// a verdict nobody acts on. Console errors are NOT part of it — this check
+// answers "did the world initialise", and `bugsweep.mjs` owns the errors.
+process.exit(ok ? 0 : 1);
```

DONE WHEN: `SHOT_URL=<a page with no __ct> node scripts/health.mjs; echo $?`
prints 1, and `$?` is still 0 against a real world. The null world is one file:
`printf '<!doctype html><title>x</title>' > /tmp/nw/index.html` served with
`python3 -m http.server`.

Two things whoever takes it should decide rather than assume:

1. **Should console errors be part of the verdict?** `health.mjs` prints up to
   three and ignores them. I would leave them out — folding them in makes the
   world's cheapest smoke test go red for a deprecation warning, and `bugsweep`
   already covers errors properly. But it is a judgement, not a fact.
2. **`SHOT_URL` still defaults to 4177.** Every other check in the suite now
   refuses to guess (GOTCHAS §26, §48); this one silently measures whoever is on
   4177. That is a second, independent way for it to report about the wrong
   world — and unlike the exit code, it will report `WORLD OK` about it.

## Also worth knowing

The nine checks my probe lists as "no FAIL text, but exits non-zero" —
`lot-frontage`, `checks-registered`, `people-walk`, `floaters-walk`,
`hashes-resolve`, `jitter`, `globorder`, `A-eye-height-holds`,
`O-jail-door-agree` — are fine for this question: they signal through the exit
code, which is the only channel `checks.mjs` reads. They are listed so nobody
re-derives that they were considered.

The probe is static and says so in its own header. It is a way of narrowing 122
scripts to one to read, not a verdict on any of them.
