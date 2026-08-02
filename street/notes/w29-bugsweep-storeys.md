# w29 — item 62: bugsweep photographs interiors now, and its guards can fail again

**Root cause, one line:** the three room stations warped with a literal `gy 0`
— the right floor for the twelve belt rooms and three storeys below flat 301 —
and `verifyLanded` compared **x and z only**, so a camera at street level under
the flat scored a pass and the sweep filed the building's exterior under
`bug-apt301-*.png`.

Port: **4188** (proved free with `curl` first, shut down at the end).

## The item's premise was right on every count — measured before changing it

`scripts/probes/w29-roomdims.mjs`:

```
roomDims(): 13 rooms      rooms(): 12 ids
fields: id, w, d, cx, cz, y, door
rooms with no y: 0
rooms NOT on the ground floor: 1 -> apt301 @ y=5.4
```

So `RoomDims.y` is published and populated (w22's half is done), the count has
indeed moved to 13, and apt301 is the one room off the ground.

## What changed — `scripts/bugsweep.mjs` only

1. **`gy: r.y` at the three room stations** (`-entry`, `-far`, `-wide`) instead
   of `0`. The sites loop already passed `st.y` and was untouched.
2. **`verifyLanded` now checks the storey.** `__ct.pos()` returns
   `[x, y, z, gy]`, so `p[3]` is the floor the picker settled on; a station
   passing an expected `y` fails if it lands more than 0.6 m off it. 0.6 m is
   `ct/apartment.ts`'s own "no stepping up half a storey" limit, so the
   tolerance is the world's number, not a taste. **This is the durable fix** —
   without it, `gy: r.y` is correct today and nothing notices when it rots.
3. **The `roomDims.length < 12` guard is derived.** Writing `ct/int-<name>.ts`
   is what puts a belt room in the world (`ct/interior.ts`: *"there is no line
   to add in crosstown.ts and therefore no line to forget"*), so the **files on
   disk are the roster** — an independent source of truth a Node harness can
   read. Confirmed the twelve stems are exactly the twelve ids `rooms()`
   publishes. It now reports three distinct failures: a file with no registered
   room (*failed to build*), a registered room with no file (*roster rotted*),
   and a registered room that answers no dims (*nothing to photograph*).
   Rooms in `roomDims()` but not `rooms()` are DECLARED extras — apt301 comes
   from `ct/apartment.ts`, not an `int-*.ts` — and are photographed like any
   other without being part of the belt roster.
4. **The sweep sets an exit code on its own findings.** It printed
   `STATION MISS` and exited 0, so a sweep that had just photographed the wrong
   place scored green for anything reading `$?`. It gates on `STATION MISS` /
   `COVERAGE` only, **not** on `errors.length` — that array also collects every
   browser `warning` (line 9) and the world emits three benign ones on every
   load (THREE's Clock deprecation, Canvas2D's getImageData hint, the WebGL
   ReadPixels stall), so failing on those would make it red always, which is as
   useless as never.

## Verified

- **Clean run: 96 shots, 0 STATION MISS, 0 COVERAGE, exit 0**, and it now
  prints its roster arithmetic: `12 int-*.ts on disk, 12 registered, 13 with
  dimensions (1 declared elsewhere)`.
- **Spot-checked the apartment shot by eye, as the item asked.**
  `shots/bug-apt301-entry.png` is now unmistakably the INSIDE of flat 301 — the
  1997 calendar on the wall, the bed with its `[E] sit on the bed and watch TV`
  prompt, the radiator under the window, the dresser, and the brick wall of the
  building opposite seen through the glass. Previously this was a street-level
  view of the outside of the walk-up.
- **Mutation-tested twice, both confirmed to change bytes** (`cksum`), with the
  exit status captured on its own line rather than after a pipe:
  1. entry station back to `gy 0` → `STATION MISS: apt301-entry aimed at floor
     y=5.40 but the player settled on y=0.00 — right x/z, WRONG STOREY`,
     **exit 1** (18786 → 18783 bytes).
  2. a room dropped from the registry with its file left in place →
     `COVERAGE: ct/int-diner.ts exists on disk but that room never registered —
     a room failed to build`, **exit 1** (20050 → 20081 bytes).
  Both reverted; `cksum` back to 595322928 20050 and the tree clean.

## Found and NOT fixed

1. **My own `sed` clobbered a correct line and I nearly shipped it.** A
   `sed -i 's|a.gy, 0), 500,|0, 0), 500,|'` aimed at the entry station also
   matched the SITES loop's `-overview` station, which had been correct all
   along. Caught by reading `git diff` rather than trusting the substitution
   count. **Mutate with an anchored edit, not a pattern**, and diff before
   running. Restored and verified in the diff.
2. **`git stash` is shared across worktrees** — see
   `notes/w29-sedan-climb.md` §5. It cost me a scare on item 54 and it will
   cost someone else more. `git checkout <ref> -- <path>` is the safe form.
   Worth a GOTCHAS entry.
3. **Nothing checks that a room's shots are DISTINCT.** All three stations
   could collapse onto one spot (or the storey picker could settle them all on
   the same floor) and the sweep would still report three files. A cheap guard
   would be to assert the three positions differ by more than a metre.
4. **`errors[]` conflating console warnings with the sweep's own findings** is
   still there; I worked around it rather than splitting the array, because
   every other consumer of that output expects the current shape. Splitting it
   into `findings` and `console` properly is a small follow-up.
5. **`rooms()` and `roomDims()` disagreeing by design (12 vs 13) is
   undocumented at the `__ct` surface.** I inferred it from `interiorRoomIds()`
   = `SLABS` vs `interiorRooms()` = `SLABS + DECLARED`. A one-line doc comment
   on each accessor would save the next reader the trip.

## Derived or copied?

**Derived.** The room roster comes from `readdirSync` over `ct/int-*.ts`; the
floor heights come from `RoomDims.y`; the storey tolerance is `ct/apartment.ts`'s
own 0.6 m limit. No coordinate, height or count is typed in this file.
