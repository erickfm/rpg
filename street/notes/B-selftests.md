# Can my checks fail?

`d0fd37fb` closed this question for A's shelf and named the excuse I had been
living on: *"it fired for real once"* is exactly the evidence a stale camera
offers. Two of my scripts were silently lost to name collisions this week
(GOTCHAS 24) and the eight-check suite stayed green through both. A check I have
not watched fail is a check I have no reason to trust.

`scripts/canfail.mjs` breaks one guarded thing per check, rebuilds, runs the
check, and expects red. Re-runnable, so this is not a claim about one afternoon.

```
node scripts/canfail.mjs              every mutation
node scripts/canfail.mjs glow park    just these
```

| check | mutation | watched fail |
|---|---|---|
| `footprint` | kerb line moved to infinity — litter may straddle it | **yes** |
| `footprint-pits` | `PIT_X` 5.56 → 5.09, pits flush into the kerb | **yes** |
| `kerbcut` | `DRIVES` emptied — the car lot has no curb cut | **yes** |
| `wetness` | `PUDDLE_C` 0.444 → 1.6, puddles lighter than the road | **yes** |
| `glow` | halo moved 1.4 m off its lamp head | **yes** |
| `park` | `parkLantern` stamp removed — lanterns unfindable | **yes** |
| `bus bench` | leg tops raised into the slat plane (GOTCHAS 6) | **yes** |
| `basin` | `PROUD` 0.007 → −0.02, surround buried behind the kerb | **yes** |
| `rain` | `RAIN_N` 500 → 6 | **yes** |
| `trash` | every piece seated 5 cm under the pavement | **yes** |

`kerb.mjs` and `people.mjs` are measurements, not checks — they print what is
there and assert nothing, so there is no verdict to mutate. Same status as A's
`scenedump`.

---

## Two of these went red only after something changed. Both are worth keeping.

### `basin` was photographing the throat and proving nothing about it

`PROUD = -0.02` buries the frame behind the kerb face instead of standing it
proud, and **`basin.mjs` passed**. It took two close shots of the throat and
measured none of it — the house rule failing inside my own check: *screenshots
are for LOOKING, never for PROVING.*

Fixed by measuring the thing the pictures were of. The surround must reach
further out of the kerb than the opening it frames, which is what casts the
shadow line that makes a drain read as a drain:

```
throat proud   6.5 mm  (4 frame solids)
OK  the surround stands PROUD of the throat, and not so far it hides it
```

Bounded at both ends, because both ends are real failures — a lintel 22 mm proud
hid the whole 66 mm opening at the 20° people actually stand at, which is why
`PROUD` is 7 mm and not more.

The parts are found by `userData.basinPart`, not by their box dimensions.
`park.mjs` went blind once matching a lantern by an exact size I then changed;
a stamp cannot drift out from under a check that way.

### `footprint-pits` was a mutation that did not mutate

Aimed at `PIT_CLEAR` first, and `footprint.mjs` slept. **The check was right and
the mutation was inert**: `PIT_CLEAR` is derived from `PIT_X` for the record and
positions nothing, so zeroing it changes no geometry. A mutation that does not
mutate proves nothing about the check that ignores it — it is a green tick with
no experiment behind it, which is the failure this whole file exists to catch,
one level up.

Re-aimed at `PIT_X`, which actually moves the well, and it went red immediately.
`PIT_CLEAR` now says in the source that editing it does nothing.

A third, smaller version of the same mistake: the first `trash` mutation was
`PIT_CLEAR` against `trash.mjs`, which guards the litter set — count, burial,
repeated rotations — and has nothing to do with tree pits. Sound mutation,
wrong tool. Every "SLEPT" here was my aim before it was the check.

---

## The harness broke my own tree, and its guard is the only reason I know

A script that edits source and restores it is one crash away from committing a
mutation as if it were work. Mine did exactly that: the 2-minute harness timeout
**SIGTERMed a full run mid-mutation**, and node exited without firing the `exit`
handler, leaving `lens.userData.parkLantern = true` deleted in my working tree.

The next run **refused to start** — "src/ has uncommitted changes" — which is
the only reason it was caught rather than committed inside the next commit.

Signal handlers do not fix this, and I tried that first: the process spends most
of its life blocked inside a synchronous `npm run build`, where the event loop
cannot turn and no JS handler runs. `SIGKILL` would not run one regardless.
Watched the SIGTERM fix fail before believing it.

The mechanism that does work is on disk. The file about to be mutated is written
to `.canfail-mutated` **before** the edit, and any later run that finds a stale
record reverts that one file first:

```
$ kill -9 <mid-run>          → tree dirty, .canfail-mutated = src/proto/ct/props.ts
$ node scripts/canfail.mjs glow
recovered a mutation left in src/proto/ct/props.ts by a killed run
  OK   glow  CAUGHT  the glow floating 1.4 m off its lamp head
source tree restored clean
```

Survives SIGTERM, SIGKILL and a power cut, and only ever reverts the one path it
wrote down — so it can never eat unrelated work.

### …and the guard itself pushed me into the worse mistake

The first version also **refused to start on a dirty tree**, because it restored
with `git checkout --` and that would have destroyed uncommitted work. Safe, and
wrong: it made me commit to get clean, and on a branch that auto-merges every
15 seconds **four `wip` commits reached mainline** before I noticed — one of them
(`fabd6de2`) real source, the `basinPart` stamps and the throat assertion,
landed under the message "wip3".

A tool whose safety rule pushes you into a worse habit has only moved the
failure. So it no longer consults git at all: it keeps a **byte copy** of the
file it is about to edit and writes those exact bytes back. Uncommitted work
survives a run untouched, the dirty-tree refusal is gone, and there is no longer
any reason to commit before running it.

Proven with real uncommitted work in the tree, both paths:

```
edit props.ts, do not commit      md5 28e4090fe9
run canfail glow                  CAUGHT; md5 28e4090fe9, edit intact
kill -9 mid-mutation, run again   recovered; md5 28e4090fe9, edit intact
```

The old version would have thrown that edit away on the recovery path. The exit
check changed with it — no longer "is the tree clean", which is now allowed to
be false, but "does every mutated file hold its original text again".

### Then I ran two copies at once and it destroyed props.ts

The byte-copy rewrite was correct for one process and I never asked what two
would do. I left a full run going in the background and started a subset in the
foreground; both mutated source, and **both used the same single backup file**.
One wrote the other's original bytes over `ct/props.ts`, which came out of it
holding `ct/tex-ground.ts`'s contents — 2400 lines down to 919, `buildProps`
gone.

Nothing reached a commit. The damage was confined to my working tree, the real
content was in git, and `tsc` caught it within a minute. But the tool did that,
not a mistake in the mutation list, and "do not run two" is not a fix.

Two changes, and both were needed:

- **the backup is per-file** — `.canfail-backup-props.ts`, never one shared name
- **the state file carries the owning PID**, and a second run refuses outright:

```
REFUSING: canfail is already running as pid 2603705.
Two runs share the source tree and will overwrite each other.
```

Verified by overlapping two runs on purpose: the second refused, the first
finished 3/3 undisturbed, `tsc` clean, no stray state files. Per-file names
alone would not have been enough — two runs would still have fought over the
same file — which is why the PID check is there as well.

All ten re-verified under the new implementation, in batches.

---

*Written 2026-07-25. Harness: `scripts/canfail.mjs`.*
