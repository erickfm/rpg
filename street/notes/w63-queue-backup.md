# w63 — the queue now has a backup, and it cannot be forgotten

Item 160. Port used: **4190** (dev), proved `000` before binding; 4191 was also
free, 4192 was already serving somebody else's world.

> The desk, 2026-08-02, the hour `notes/QUEUE.md` was destroyed by an aborted
> merge: *"THE QUEUE HAS NO BACKUP AND IS UNTRACKED, WHICH IS THE WORST OF BOTH
> WORLDS."* ~45 open rows of desk-written detail went with it.

## Root cause, one line

The queue was untracked **for a good reason** — `0d1e61de5` untracked it because
ordinary git merges were silently reverting builders' DONE rows — and nothing
was ever put in place of the protection that removed. It had no second copy of
any kind.

## What changed

`scripts/queue-backup.sh` is new. `claim.sh`, `done.sh` and `add.sh` each gained
**one line**: the `trap` that already gives the lock back now takes a snapshot
first.

```sh
trap 'sh "$QB" snapshot "$Q" >/dev/null 2>&1; rm -rf "$LOCK"' EXIT INT TERM
```

`claim.sh:213`, `done.sh:50`, `add.sh:46`.

**Hanging it off the trap rather than off a call site is the whole design.**
Each of those scripts has a dozen ways out — success, usage error, `exit 3` on a
row it cannot find, Ctrl-C, a `set -u` blow-up — and the trap is the only thing
all of them go through. The item's own instruction was *"do NOT make the
snapshot depend on a builder remembering to call it"*, and there is now no
fourth caller that could.

Snapshots land at `notes/.queue-history/QUEUE-<epoch>-<padded pid>.md`, next to
the shared queue, outside every worktree.

- **Deduped** against the newest. `claim.sh --stale` is read-only and so is every
  usage error; without this, 200 slots of history fill with 200 identical copies
  of one minute and the oldest real state falls off the end.
- **200 kept**, pruned by name. Epoch is fixed-width until 2286 and the pid is
  zero-padded, so a plain `sort` is chronological — two callers can release
  inside the same second.
- **`snapshot` always exits 0.** It runs inside a trap, after the work the
  builder cares about. A backup that can take a claim down with it is worse than
  no backup. The modes a human runs exit non-zero properly.
- **`--latest` / `--list` / `--restore`.** `--restore` takes the lock (a restore
  runs while the fleet may be mid-claim) and **files the broken queue before
  overwriting it** — restoring must not be the operation that destroys the
  evidence of what went wrong.
- `notes/.queue-history/` is in `street/.gitignore:12`. **QUEUE.md is still
  untracked** — re-tracking it would reintroduce the documented reverting bug.

`done.sh` and `add.sh` now honour **`CLAIM_QUEUE`**, the test hook `claim.sh`
already had, and the lock moves with the queue exactly as it does there. That is
what lets the selftest drive all three real scripts without touching the live
queue five builders are claiming from.

## How it was proved

`sh scripts/queue-backup.sh --selftest` — 6 of 6:

| | |
|---|---|
| claim.sh wrote a snapshot | 0 → 1 |
| done.sh wrote a snapshot | 1 → 2 |
| add.sh wrote a snapshot | 2 → 3 |
| an unchanged release adds nothing | 3 (the dedupe) |
| **destroyed and restored — ZERO operations lost** | the incident, reproduced |
| restoring OVER a broken queue files the broken one first | |

**Watched failing, per GOTCHAS §27.** Reverting `done.sh`'s trap to the old
`trap 'rm -rf "$LOCK"'` turns it red on exactly that line — `FAIL done.sh wrote
NO snapshot (1 -> 1)`, `EXIT=1` — and leaves the other five green. The
destroy-and-restore case *stayed* green under that mutation, correctly: `add.sh`
ran after `done.sh` and its snapshot carried the post-`done` state. That is the
"at most one operation" property doing its job rather than a hole.

**One check was wrong and failing is how I found out.** The "restore keeps what
it overwrote" assertion was first written against the *delete* case, where there
is nothing to keep, and it failed. The subject was wrong, not the tolerance — it
now corrupts the queue rather than deleting it, which is the likelier shape of
the next incident anyway.

All four scripts pass `sh -n`. The live queue is already protected: a snapshot
landed at 20:30 (`QUEUE-1785727818-3490007.md`, 33 rows), alongside the desk's
own hand-made `QUEUE-1785727463-rebuild.md`.

## Found and NOT fixed — for the desk to queue

1. **Nothing RUNS the selftest.** `scripts/queue-check.sh` is its natural home —
   it is the queue's own guard and it already exits non-zero — or a `package.json`
   entry beside `checks`. Neither file is named by item 160 and I did not touch
   either (BUILDER-BRIEF §9). One line in `queue-check.sh` closes it.
2. **The live `notes/.queue-history/` is not ignored until this lands.** The
   `.gitignore` change is in my worktree; in the main tree the directory is
   currently untracked-and-visible, so a `git add -A` there before the merge
   would commit snapshots. Self-resolving on merge, but worth knowing during it.
3. **The desk's hand-made `QUEUE-…-rebuild.md` is picked up by `--latest`**,
   deliberately: it matches `QUEUE-<digits>` and it *is* a real earlier state.
   Anything dropped in that directory that is not a queue would be too.

## What I did NOT do, and why it is in the queue's way

I was mid-item on **157** (the library PC's diegetic screen) when the queue was
rebuilt and my claim on it vanished. That work is committed on this branch at
`adcff1296` — the canvas re-cut from 320×220 to 320×256 to match the CRT's real
1.25 aspect, the control tables, and the mesh finder — and it typechecks, but it
is **not yet wired to `PanelSpec.surface`**. Whoever claims 157 should start from
that commit rather than from mainline.
