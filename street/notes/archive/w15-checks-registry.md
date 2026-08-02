# Item 9 was a duplicate of item 5 — what I added before the desk released it

`claim.sh` handed me item 9 (`scripts/checks.mjs`, "the suite kills its own
preview server"). **w14 already held it as item 5 and had already done it**
(`notes/w14-checks-preflight-and-server-death.md`, landed as `615e804ff`); the
desk released item 9 as a duplicate in `d4f511e1b` while I was in it. Nothing
below re-does w14's work — I read their note and it stands.

What I found is a **separate and newer** breakage that post-dates their run.

## Root cause, one line

Today's `scripts/` reorganisation moved **55 of `checks.mjs`'s 121 registered
checks** into `scripts/probes/`, so the runner spawned `node
scripts/<name>.mjs` on 55 files that were not there and printed `FAILED (1)` —
the same row a real defect prints.

w14's run scored 88 pass / 14 fail, i.e. all 122 rows ran. The reorg landed
after that. **45% of the suite then stopped running while the summary claimed
55 faults**, which is worse than a red suite: it sends people hunting for
defects that do not exist. That is the same complaint item 5/9 was raised
about, arriving a second time by a different route.

Two ways broken, not one: 46 of the 55 also `import … from './lib/…'`, which
does not resolve one directory down.

## What I changed

1. **Moved the 55 registered checks back to `scripts/`** (`5e9a745d9`). A
   registered check is the opposite of a one-off probe; the registry already
   asserts they live there, and moving them back fixes the `./lib/` imports for
   free rather than rewriting 46 import paths.
2. **`checks.mjs` can no longer hide this** (`39649f49b`). A registered check
   that is not on disk now stops the run and names the file *and where it
   actually is*. Same argument the file already makes twice for a dead port and
   a stale `dist/`: "could not measure" and "measured, and it is wrong" are
   different sentences.
3. **A blocked port now says so.** `fetch` and Chrome both implement the WHATWG
   bad-ports list, so a preview on 4045/4190/6000/6665-6669 answers `curl` with
   200 and the pre-flight with "fetch failed" — and the run aborted claiming
   nothing was serving while the server was plainly up. **Cost me twenty minutes
   on 4190 before I worked out what it was.** The cause extraction had to be
   fixed too: a blocked port sets no `cause.code`, so the old chain reported the
   useless string `TypeError`.

**Mutation-tested:** hiding one registered check (`git mv scripts/density.mjs
scripts/probes/`) makes the run exit 2 naming `scripts/density.mjs — but
scripts/probes/density.mjs exists`, and the dead-port message still fires for a
genuinely dead port. Both branches watched failing and passing.

## Item 6's fix closed one of w14's rows

w14 listed `density` as **"real, not previously tracked — 39 declared-vs-mapped
mismatches, clustered at the jail's exterior, x≈63/z≈−103…−107, possibly the
same underlying jail-masonry cause"** as `seampairs`.

**They were the same cause, and it is fixed.** Those are the exact faces item 6
corrected. `node scripts/density.mjs` now exits 0: *"305 faces carry a
masonry() stamp … every one is mapped to the face it was painted for (within
2%)"*. `seampairs` is green too. Two of w14's fourteen can come off the list.

## The current suite, and why a clean classification is not obtainable right now

Full run, no `--slow`, against my own preview at a matching build: **122 rows —
so all 55 restored checks ran, none MODULE_NOT_FOUND.** 21 pass, 20 skipped
(slow tier + no-selftest), 81 red.

**76 of those 81 are `WRONG WORLD`, not defects.** The runner's own footer
diagnosed it correctly:

> THE TREE MOVED UNDER THIS RUN: bb2689654 -> a85ff9746

The merge train lands on this shared worktree every few minutes, so `dist/`
went stale mid-run and every browser check after that point measured nothing.
**Re-running would hit the same wall.** A trustworthy full-suite classification
needs a worktree the train is not landing into — that is a desk decision, not
something `checks.mjs` can fix, and `checks.mjs` already reports it honestly.

## The 5 that are real — world-independent, so the stale build cannot explain them

These start no browser, so they are unaffected by the above. All re-run
standalone:

| check | finding |
|---|---|
| `mutations-quote-real-source` | **`canfail.mjs`'s `rain` case matches its quoted source 0 times.** Its mutation patches nothing, so the `rain` selftest is vacuous — a check that cannot fail, which is the family GOTCHAS 56 is about. **The most valuable of the five.** |
| `gotchas-numbers` | `GOTCHAS.md` uses §51 twice and §52 twice, and §51 appears after §52. Other builders cite these by number. |
| `checks-registered` | `H-flare-silhouette.mjs` and `ledger-intact.mjs` have a `--selftest` and are in no tier. (w14 counted 3; `F-diag-owalk.mjs` is now in `probes/`, correctly, so it is 2.) |
| `hashes-resolve` | 187 unreachable citations — the known GOTCHAS §36 rot, ledger row 313. Not new. |
| `L-every-stool-seats-you` | already red on purpose, `notes/BLOCKED-L.md`. Not new. |

## Not fixed, and why

- **The 3 unregistered checks and the numbering in `GOTCHAS.md`.** `GOTCHAS.md`
  is not named by this item, and w14's reasoning on registering an unvetted
  check into everybody's suite is right — I am not overriding it.
- **`canfail.mjs`'s dead `rain` quotation.** Not named by this item and it is
  the mutation harness; queue it as its own row.
- **The suite's server-death question.** w14 and K both failed to reproduce it
  across ten runs; w14's classifier now reports it honestly if it happens. I saw
  no death in my run either. Nothing to add.

## One process finding the desk should have

**`done.sh`'s write to `QUEUE.md` can be silently reverted.** I marked item 6
DONE at 23:58; the desk's own `d4f511e1b` committed a copy of `QUEUE.md` that
predated it and the row went back to `DOING w15`. I only noticed by chance,
grepping for something else. Any item finished while an uncommitted `QUEUE.md`
is in flight can be lost the same way, and the builder will not know. I
re-recorded item 6 and **committed** it (`bb2689654`) so it cannot revert again;
`done.sh` committing its own write would close this for everyone.

Related, already logged by the desk as GOTCHAS 59: my first commit swept in
another agent's staged reorganisation, because `git commit` commits the whole
index and this worktree is shared.
