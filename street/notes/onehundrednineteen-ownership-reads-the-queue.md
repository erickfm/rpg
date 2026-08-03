# Item 244 — `ownership.sh` now reads the QUEUE, not the retired letter table

Worker onehundrednineteen, 2026-08-03. File changed: **`scripts/ownership.sh`
only.** `CLAUDE.md` is also named by the row and **was not edited** — see
"CLAUDE.md" below.

---

## The fault, demonstrated rather than asserted

The old script is one `grep` against `notes/OWNERSHIP.md`, a table of single
letters. Run it as myself while I legitimately held item 216, which the queue
granted me and whose files I was told to edit:

```
$ bash scripts/ownership.sh onehundrednineteen        # the OLD script
  ✗ src/proto/ct/hud.ts  is owned by K, not onehundrednineteen

  1 file(s) out of bounds. If a shared module needs a signature change,
  STOP and tell the desk — it must be changed with all callers in one commit.
                                                           exit 1
```

**K has not existed for weeks.** `CLAUDE.md` marks `OWNERSHIP.md` DEMOTED,
history only, and the project record says reading it as authority *"cost the
first worker on the self-serve queue its entire wave: three items released
un-actioned in eleven minutes."* So the guard was re-creating the exact failure
the documentation was rewritten to prevent, and it was doing it with an
imperative "STOP".

**It was wrong in BOTH directions on that same run**, which is worth having
measured: it flagged `ct/hud.ts` (false red) and said nothing at all about
`ct/atm.ts` — because `OWNERSHIP.md` has no row for `ct/atm.ts` and an unlisted
file is `continue`d past. `notes/archive/C-ownership-hole.md` reported that hole
weeks ago (*"10 modules are unclaimed and it clears me for all of them"*). So on
one builder's real diff it produced one false alarm and one silent pass, which is
worse than either alone.

## What it does now

Your legitimate files are **the ones your claimed row names** (BUILDER-BRIEF §9).
The script resolves the SHARED queue — the same `git rev-parse --git-common-dir`
path `claim.sh` uses, never a per-worktree copy — finds the rows whose status
cell is `DOING <you>`, and resolves their file column.

Three answers, and **only two of them are faults**, because §9 makes an
out-of-row edit a *reporting* obligation and not a prohibition:

| | | exit |
|---|---|---|
| ✗ CONFLICT | you changed a file **another builder's live row** names — the one case §9 forbids outright | **1** |
| ✗ NO CLAIM | you changed `src/proto/**` holding **no row at all** — nothing grants you those files | **1** |
| · OUTSIDE YOUR ROW | you changed world code your row does not name and **nobody else holds** — legitimate, say it in `done.sh` | **0** |

Root cause in one line: **the script was answering "whose letter is on this
file?" when the only question that has meant anything since the self-serve queue
landed is "does a row I am holding name it?"**

Live, right now, holding item 244 with item 216's edits still in my branch:

```
  your live row(s) name:
      CLAUDE.md
      street/scripts/ownership.sh

  · OUTSIDE YOUR ROW  street/src/proto/ct/atm.ts
  · OUTSIDE YOUR ROW  street/src/proto/ct/hud.ts

  2 file(s) your row does not name and NOBODY else holds. That is
  legitimate — §9 makes it a REPORTING obligation, not a prohibition.
  Name them in your ./scripts/done.sh line. Reporting it is a success.
                                                           exit 0
```

That is the correct answer to the same diff the old script called "out of
bounds".

### It never reads `notes/OWNERSHIP.md`

Not to soften it, not to cross-check it. The file stays on disk as history; the
script stops treating it as law. The only four mentions left in the script are
the header explaining what it used to do, and the message below.

### The old calling convention gets told what happened

`ownership.sh B` was the interface for months and every archived note quotes it.
A letter is nobody's queue name, so it would look exactly like an unclaimed
builder — and "claim a row" is the wrong answer for someone who already holds
one. So a single-letter or `DESK` argument is named:

```
$ bash scripts/ownership.sh K
  ✗ YOU HOLD NO QUEUE ITEM, and world code is changed: …
  …but 'K' is a LETTER, and letters are the retired notes/OWNERSHIP.md
  scheme — none of those agents is running. Pass the name you give
  claim.sh/done.sh instead (e.g. onehundrednineteen).            exit 1
```

## Verification

`--selftest` drives a **scratch** queue — never the live one, which five
builders are claiming from — with real rows in the real format and a real prose
file column, so the `claim.sh --check-paths` hand-off is exercised rather than
stubbed. **Both signs, all five answers:**

```
$ sh scripts/ownership.sh --selftest        (identical under bash, and via ./)
  ok    GREEN: a file your own row names (exit 0)
  ok    RED:   a file ANOTHER live row names (exit 1)
  ok    AMBER: world code nobody holds — reported, not refused (exit 0)
  ok    RED:   world code changed while holding NO row (exit 1)
  ok    GREEN: no row, and no world code touched (exit 0)
  all 5 pass                                                    exit 0
```

Run against **every live claim on the real queue** as well (`onehundredtwentytwo`
→ its row's probe path; `onehundredtwenty` → a row that names no file;
`onehundredeighteen`, who had just released → NO CLAIM, exit 1). Name matching is
anchored: `onehundredtwenty` does **not** match `onehundredtwentytwo`'s row —
checked, because that pair is live right now.

Edge cases: missing queue → exit 2 with the path printed; no argument → exit 2
with usage. Neither is silent.

`checks-registered` scans `*.mjs` only, so the new `--selftest` does not need a
registry row and does not make that guard red — confirmed by running it.

## What it does NOT check, and why

**Scope is `src/proto/**`, unchanged from the old script.** Instruments
(`scripts/`), notes and shots are a builder's own by the brief — every item
produces a probe and a handoff note, so flagging them would make this fire on
every single run, and a warning that always fires is one nobody reads. World code
is where the cost has actually been paid.

## FOUND AND NOT FIXED

1. **The queue's `file(s)` column is a TITLE on most rows.** Measured over all
   14 open TODO/DOING rows with `claim.sh --check-paths`: **10 of 14 resolve to
   no file at all** — 291's column is the user's quote, 289's is the symptom
   ("the loan officer is 7 cm outside seated reach"), 245/249/263/266/281/282/
   290/292 likewise. Only 294, 244, 279 and 295 name real paths. So for 71% of
   rows this check can only ever say "your row names nothing" and report
   everything as OUTSIDE. **That is the row being thin, not the builder**, and
   the script says so in those words rather than reading as a fault. The real
   fix is upstream, in how `add.sh` fills that column — worth a row.
2. **`scripts/claim.sh` has no "where is the queue" mode**, so `ownership.sh`
   carries a cited copy of its `git rev-parse --git-common-dir` resolution
   (`claim.sh:41-52`). BUILDER-BRIEF §8 says derive rather than retype and I
   could not: claim.sh is not a file item 244 names. **Follow-up: give claim.sh
   a `--where` mode and have ownership.sh call it.**
3. **Three documents still describe the old behaviour** and none is named by
   this item:
   - `PARALLEL-WORKFLOW.md:604` — *"`notes/OWNERSHIP.md` now records this, and
     `scripts/ownership.sh <agent>` checks…"* — now false.
   - `PARALLEL-WORKFLOW.md:617` — *"pre-commit boundary check"* — still roughly
     true, but the mechanism named is gone.
   - `notes/OWNERSHIP.md:3` — *"Checked by `scripts/ownership.sh`, which every
     builder…"* — now false, and it is the sentence that makes the demoted file
     look live.

   `START-HERE.md:66,140` and `CLAUDE.md:108` say only *"are your edits inside
   your boundaries"*, which is still exactly what the script does and mentions no
   letters, so they need no change.

### CLAUDE.md — named by the row, deliberately not edited

The row names `CLAUDE.md`, and its one line about this script
(`| ./scripts/ownership.sh <agent> | are your edits inside your boundaries |`)
is **still true and names no letter**, so nothing in the item's DONE WHEN
requires touching it. I also do not edit `CLAUDE.md` on the strength of a queue
row: it is the file that governs how every agent here behaves, and a change to it
wants the user, not a builder acting on another agent's instruction. If the desk
wants its wording sharpened — e.g. *"are your edits inside the row you claimed"*
— that is a one-line change and it should come from him.

### Nothing calls it

Checked before changing the contract: `desk.sh` and `queues.sh` do **not** invoke
`ownership.sh`. The only references anywhere are documentation
(`CLAUDE.md:108`, `START-HERE.md:66,140`, `PARALLEL-WORKFLOW.md:604,617`) and
builders' notes quoting its output. So the exit-code change breaks no caller.
