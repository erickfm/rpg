# Item 191 — `shots/` ENOENT on a fresh worktree

Worker onehundredfive, 2026-08-03. Port **4611**, built bundle.

## The row's numbers were right and MINE were wrong

I had answered this same question two items earlier, as item 260 part 4, and
**got it wrong**: I reported *"11 at risk, none of them registered"*. The real
figures, from `w101-shots-enoent.mjs` — the purpose-built instrument the row
cites — are **55 at risk and FOUR registered**.

**The cause was my own regex.** I harvested candidate paths with

```js
/[`'"]([A-Za-z0-9_./-]*?)(?:\$\{[^}]*\})?[A-Za-z0-9_./-]*[`'"]/g
```

whose first group is **non-greedy** and happily matches the empty string, with
the trailing `*` swallowing the rest. So a plain `writeFileSync('shots/x.json')`
yielded `head = ''` and was silently dropped. The eleven I did find were files
that happened to contain some *other* literal beginning `shots/`.

**BUILDER-BRIEF §7 in my own handwriting: half of all defects here are the
instrument.** I wrote a scan when a scan already existed, and the new one was
worse. The correction is in the commit message and belongs in the ledger against
item 260 as well as here.

## What was broken

`shots/` is gitignored, so a fresh worktree has none. Four **registered** checks
did an `fs` write into it with no mkdir — and in every case the throw lands
**after the descriptive output and before the exit code**, so the builder sees a
correct-looking run whose last line is `Node.js v24.15.0`.

```
faces  masonry  seampairs  texdensity
```

**`page.screenshot({ path })` was never the problem** — Playwright creates parent
directories itself. Measured: with `shots/` deleted, `scripts/trash.mjs` (fifteen
screenshots into `shots/`) exits 0 with no ENOENT. That is why `ghosts.mjs` died
on its *final* `writeFileSync` and on none of the shots before it, and it is the
difference between a real population of 55 and a scare figure of 279.

## The fix

`scripts/lib/shots.mjs` exports `ensureShots()`. Called at each of the four write
sites, **and** at `checks.mjs` suite start. Both, deliberately: the per-check
call is the one that still works when somebody runs a check on its own, which is
how they are usually run.

**Create the directory, do not catch the error** — the row is right about that,
and a check that swallows a write failure is how a suite goes quietly blind.

**Proved both ways**, `shots/` deleted before each run
(`scripts/probes/w105-191-fresh-worktree.sh`):

| | faces | masonry | seampairs | texdensity |
|---|---|---|---|---|
| with the fix | exit 0, ENOENT 0 | exit 0, ENOENT 0 | exit 0, ENOENT 0 | exit 0, ENOENT 0 |
| fix stashed | exit 1, ENOENT 2 | exit 1, ENOENT 2 | exit 1, ENOENT 2 | exit 1, ENOENT 2 |

Second DONE-WHEN clause — *"no verdict is ever printed before the write that
backs it"* — was **already true** in all four: each writes before its verdict
line and before its exit-code logic. The ENOENT was killing the process between
the narration and the verdict, which is exactly why it read as ambiguous.

## And the class is guarded now, which is the part that lasts

`w101-shots-enoent.mjs` graduates from `probes/` to `scripts/` and is registered.
**Three things had to change before it was fit to register**, and each is the
kind of fault this project keeps finding in its own instruments:

1. **It recognised only the literal `mkdirSync('shots'…)` spelling**, so it went
   on reporting all four repaired checks as still broken and would have sat red
   for good. *A scan that knows one spelling of the fix reports the fix as the
   bug.* It now matches the helper **call** too — so a file that imports
   `ensureShots` and never calls it is still flagged, which is its own selftest
   case.
2. **It vetoed on all 51 at-risk scripts**, including one-shot probes nobody has
   run twice. That is a permanent red clearable only by editing fifty-one files
   nobody named, and a check that cries wolf gets ignored — which is how the four
   registered ones survived this long. It now votes on the **registered subset**;
   the other 51 are still printed, so the information is kept and only the veto
   is dropped. **This is not loosening**: the file's own headline question is
   "can `npm run checks` go red on a fresh worktree", and that is what the
   registered subset answers.
3. **It had no population floor.** `isCheck()` is a lookup into names parsed out
   of `checks.mjs`; a broken parse gives an **empty registry**, so every script
   looks unregistered, `riskyChecks` is 0, and it exits **green having decided
   that no check in this project is registered**. Now `exit 2` below 500 files /
   100 names — self-tested by renaming `const CHECKS`, which produced exit 2.

It arrives with a `--selftest` (6 cases, both signs), **and the selftest can
fail**: reverting the regex to the literal-only form turns exactly the
shared-helper case red, exit 2. Registered with `true` in the third column.

## Found and NOT fixed

1. **51 unregistered scripts still write into `shots/` without a guard.** They
   cost whoever runs them one minute, once, and only until anything creates the
   directory — which `npm run checks` now does on its first run. **Not patched:**
   fifty-one files nobody named is fifty-one chances at a cross-builder conflict,
   and `scripts/probes/w105-patch-shots.mjs` will do it in one command if the
   desk wants it. The list is in `w101-shots-enoent`'s own output.
2. **The item-260 ledger row needs the correction above** — its `done.sh` line
   claims 11/none and the truth is 55/four.
