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

---

*Written 2026-07-25. Harness: `scripts/canfail.mjs`.*
