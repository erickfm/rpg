# w19 — "the felt table registers no seats" is four seats out of date

Queue item 31. Files: `notes/BLOCKED-L.md` (it lives at
`notes/archive/BLOCKED-L.md` now) and the `SEAT_LABEL` docstring in
`src/proto/ct/blackjack.ts`. Commit `992c8b7cf`. Port 4184.

## Root cause, one line

`ae4147cee` fixed the world and neither of the two documents that describe the
world was in its diff — the classic shape here, and both were written by an
agent that no longer exists to update them.

## The commit, cited as the item asked

**`ae4147cee` — "Blackjack is reachable: seat the felt table with its own
label."** Verified reachable from mainline (`git merge-base --is-ancestor
ae4147cee HEAD`), so the citation resolves for whoever reads it next — the thing
`hashes-resolve` exists to enforce.

It gave `int-casino.ts`'s `gameStool()` an optional `label` parameter (default
unchanged, so roulette, craps and poker keep the shared `'sit at the table'`) and
put four stools on the player side of the felt table at `TX = -2.6, TZ = -13.0`,
importing `SEAT_LABEL` from `blackjack.ts` rather than retyping it.

## Measured, not read back off the commit

`scripts/probes/w19-blackjack-seats.mjs` asks `__ct.seats()`. Against 4184:

    219 seats registered
       87  sit at the slot
       21  sit at the table          <- roulette 5 + craps 6 + poker 6 + 4 more
        4  sit at the blackjack table
       ...
    "sit at the blackjack table" seats: 4
      seat (676.85, -12.15) yaw 0   stand at (676.85, -11.35)
      seat (677.22, -12.15) yaw 0   stand at (677.22, -11.35)
      seat (677.58, -12.15) yaw 0   stand at (677.58, -11.35)
      seat (677.95, -12.15) yaw 0   stand at (677.95, -11.35)

**Every one has a distinct stand point 0.80 m behind the stool** — the `approach`
that BLOCKED-L's ask went out of its way to call NOT OPTIONAL, and that 69 of
this world's seats still do without. So the ask was honoured in full, not just in
outline.

## The mutation test, and the half that is worth reading

The probe exits 1 when nothing carries the label. **My first mutation failed to
fail**, and that is the more interesting result:

1. **Changed `SEAT_LABEL` in `blackjack.ts`. STILL GREEN** — four seats, wearing
   the mutated string. `int-casino.ts` *imports* the constant, so both sides of
   the bridge move together and can never disagree. That is a live proof the
   derivation is real (BUILDER-BRIEF §8) and a proof this mutation is inert.
2. **Dropped the label argument at the felt table's own `gameStool()` call** —
   the state before `ae4147cee`, verbatim. **RED**: 0 blackjack seats, and
   `'sit at the table'` goes 21 → 25 as the four fall back to the shared string.

Both files restored byte-for-byte; `git status` clean apart from the intended
edits.

## What I changed

- **`notes/archive/BLOCKED-L.md`** — a CLOSED banner citing `ae4147cee` with the
  live measurement, the one present-tense "it registers no seats at all"
  paragraph moved to past tense, and the section headings retensed. The body is
  kept as history, which is what the file is for. I did not invent the closure
  condition: L wrote it into the file himself — *"if you read this and the table
  has seats, it is closed."*
- **`src/proto/ct/blackjack.ts`** — the `SEAT_LABEL` docstring, which said "it is
  not wired yet" and "It registers no seats today". **Comments only**: the diff
  contains no non-comment line, checked rather than asserted.
- **`scripts/probes/w19-blackjack-seats.mjs`** — new, in `probes/` per §7a. It
  reads the label out of `blackjack.ts`'s own `export const` rather than
  retyping it, because a second hand-typed copy of that string is the exact
  coupling this whole item is about.

Also repointed four dead citations inside BLOCKED-L.md: all of its sibling
`L-for-*` notes moved to `notes/archive/` in the 2026-08-01 clean-up and the
file still pointed at `notes/`.

## Found and NOT fixed — all outside the item's named files

**1. Two MORE copies of the same stale statement.** The item named two; there are
four.

- `scripts/L-blackjack-inworld.mjs`, header lines 6-10 and again at 188-192,
  where it is **printed to stdout on every single run**:
  *"NOT TESTED HERE: sitting down. The felt table registers no seats"*. This is
  the loudest of the four — it tells every reader of every check run something
  that has been false since 30 July.
- `scripts/checks.mjs`, the `L-blackjack-inworld` registry comment: *"It CANNOT
  sit down — the felt table registers no seats (`notes/BLOCKED-L.md`)"*.

The item's own framing — *"which is why `L-blackjack-inworld` could be rewritten
to actually sit down"* — reads as though that rewrite had happened. **It has
not.** The script still drives the cabinet from `__blackjack.open()`.

**2. `notes/BLOCKED-L.md` no longer exists at that path.** Everything that cites
it — `scripts/L-blackjack-inworld.mjs` (×3), `scripts/checks.mjs:888`,
`notes/LEDGER.md`, `notes/archive/L-blackjack-reachable.md` — points at a path
the 2026-08-01 clean-up moved to `notes/archive/`. `citations-resolve` does not
catch this: it checks `file.ts:123` pointers, and a bare note path is a different
shape. **That looks like a real gap in the citation guards**, one archive move
wide, and it will keep happening every time notes are swept.

**3. `L-blackjack-inworld` is RED, and it is not my change.** 8 of 15 fail,
starting at *"the table opens as a panel on K's shared cabinet"*. Control: it was
already `✗ L-blackjack-inworld  FAILED (1)  (96s)` in the full `npm run checks`
run I made **before** touching `blackjack.ts` (`/tmp/w19-checks.log:1150`), and my
diff changes no code. Worth a queue item on its own — a check that cannot open
the panel it exists to test says nothing about the game.

## Verdict

No after-images to judge: comments and notes only, `npm run build` green, and the
probe returns the identical four seats before and after. `node
scripts/bugsweep.mjs` against 4184: zero STATION MISS, zero console errors.
