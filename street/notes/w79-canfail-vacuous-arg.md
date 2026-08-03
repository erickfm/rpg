# Item 224 — `canfail` handed back a green certificate for the empty set

Queue worker **seventynine**, 2026-08-03. Port **4350**.

## The row was right, and I reproduced it verbatim before touching anything

```
$ SHOT_URL=http://localhost:4350/ node scripts/canfail.mjs crowd
can my checks fail?   (mutation must go red)

0/0 checks caught their mutation
every mutated file restored byte-for-byte
EXITCODE=0
```

Both sentences are true and both are about the empty set. **The second is worse
than the first** — it is a reassurance about files nobody opened.

`crowd` is not a case name. `crowd-lane`, `crowd-net-inroad` and `crowd-frozen`
are, and the matching here is **exact** (`only.includes(c[0])`), unlike
`checks.mjs`'s substring `--only`. So the most natural way to type it was also
the one way to get nothing, silently.

**Root cause in one line: the case filter had no population floor and no
unknown-name check, in the tool the project uses to certify that its other
checks can still fail.**

## The fix, copied rather than invented

`scripts/canfail.mjs:1227-1290`. `scripts/checks.mjs:1222-1231` already refuses
exactly this for `--only`; the shape is lifted from there so the two tools
behave the same way.

**Two exit codes, because they are two faults** (GOTCHAS 32):

| | |
|---|---|
| **2** | you named something that is not a case — a *usage* error, your typo. Same code `checks.mjs` uses |
| **3** | there was nothing to select from at all — *nothing was measured*, which by house convention is 3 |

The error names the near-misses and then lists all 61 cases three to a line.
The near-miss list is doing real work precisely *because* matching is exact:
`crowd` is a prefix of three real cases and is the typo that was reported.

## Measured, both signs, plus the negative case

| | expected | got |
|---|---|---|
| `canfail.mjs crowd` (the reported typo) | refuse | **exit 2**, suggests `crowd-net-inroad  crowd-lane  crowd-frozen`, lists all 61 |
| `canfail.mjs footprint` (a real case) | still runs, still catches | **`1/1 checks caught their mutation`, exit 0** |
| `CASES` emptied to `[]` | population floor fires | **exit 3**, `NO MUTATION CASES TO RUN` |

The third was run against a `sed`ed copy of the file in `scripts/`, then
deleted — the `!run.length` branch is otherwise unreachable while `CASES` has
rows, and a floor nobody has watched fire is exactly what this item is about.

`npm run typecheck` 0. The change touches no `src/`, so the built world is
byte-identical to the one swept clean under item 221 in this same session
(96 shots, 0 STATION MISS); `node scripts/health.mjs` re-run, `WORLD OK`.

## FOR THE DESK — found, not fixed

1. **`mutations-quote-real-source` is RED with 4 DEAD cases, and it is
   PRE-EXISTING — not mine.** Proved rather than assumed: I copied my version
   aside, `git checkout --`'d the file, re-ran, and got the identical four.

   ```
   DEAD  rulings-atm   src/proto/ct/bank.ts    matched 0x, not 1
   DEAD  grade-twice   src/proto/ct/props.ts   matched 0x, not 1
   DEAD  grade-nan     src/proto/ct/props.ts   matched 0x, not 1
   DEAD  glow-pool     src/proto/ct/props.ts   matched 0x, not 1
   ```

   Four of 61 mutation cases are **guarding air**: their quotations no longer
   match the source. Worth a row of its own — it is the same class as this item
   (a guard that cannot fire) and it is currently four instances, not one.

2. **Nothing in `checks.mjs` guards `canfail`'s own argument handling.** The row
   `mutations-quote-real-source` checks that the cases quote live source; it
   cannot see that a bad argument produces a green run. A `canfail-bad-arg` case
   would be self-referential in an awkward way, but a two-line row in
   `checks.mjs` spawning `canfail.mjs <nonsense>` and asserting a non-zero exit
   would be cheap and would have caught this. **I did not add it: `checks.mjs`
   is not named by item 224** (BUILDER-BRIEF §9).

3. `canfail` treats **every** non-port argument as a case name, so a flag —
   `--selftest`, `--help` — was previously taken as a case, matched nothing, and
   produced the same green empty run. It now exits 2 with the case list, which
   is the right answer but arrives as "NOT A MUTATION CASE: --help". Exactly the
   bug `claim.sh` had (it once claimed item 93 for an agent named `--help`), and
   a `case "$a" in -*)` style guard would say so more plainly.
