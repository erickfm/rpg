# w61 — item 109: the flat doors were flush on every floor but 301's

**Root cause, one line:** the walk-up's two walls were pierced only between
`2*ST` and `2*ST + 2.1`, so 301 and 302 got a real hole with a reveal and the
other six doors got a leaf laid flat on uncut plaster.

Port used: **4192** (dev) and **4193** (`vite preview`, the built bundle). Both
bound with `--strictPort`, which is the only honest free-port test — my first
choice, 4183, answered `000` to curl and then refused to bind, because another
builder took it in the seconds between. `ss -ltn` is the check that works.

---

## What the user said, and what was actually true

> *"doors in apt are flush with wall on every floor except my floor."*

He is exactly right, and the desk's framing of *why* was right too — this one
was a good dispatch. Measured before changing anything
(`scripts/probes/w61-doorflush.mjs`, which reads leaf x against the wall's own
hall face):

```
floor 1  WEST(01)  x=200.085  hallFace=200.075  proud=+10 mm  FLUSH/APPLIED
floor 2  WEST(01)  ...                          proud=+10 mm  FLUSH/APPLIED
floor 4  WEST(01)  ...                          proud=+10 mm  FLUSH/APPLIED
floor 1  EAST(02)  ...                          proud=+10 mm  FLUSH/APPLIED
floor 2  EAST(02)  ...                          proud=+10 mm  FLUSH/APPLIED
floor 4  EAST(02)  ...                          proud=+10 mm  FLUSH/APPLIED
```

Not merely flush — **10 mm PROUD**, applied to the wall like a picture.

**One correction to the item's wording.** It says *"the other seven flats get a
leaf hung on an uncut wall"*. It is **six**, not seven: 302 already had a real
cut opening and a 1.2 m dim recess behind it. The item counted 302 among the
un-fixed because it is not 301. Six doors were flat: 101, 102, 201, 202, 401,
402.

## What changed

`src/proto/ct/apartment.ts`, three edits and a stale comment.

1. **The door column is cut once per floor.** It was two hand-typed slabs per
   wall — ground to `2*ST`, and `2*ST+2.1` to the roof. It is now a loop over
   the four storeys leaving only the **spandrel over each head**, derived from
   `ST` and `DOOR_HEAD`. Add a storey and it cuts itself. The architrave loop
   runs beside it, so all eight openings get identical trim; the six used to
   carry their own copy, 0.19 m wider than 301's, offset 5 mm off the wall
   centreline.

2. **The leaf hangs on the room-side face**, the way 301 already did. Derived:
   `lx = wallN - face * (WALL_T/2 + 0.02)`.

   **This lands on `AX(-0.09)` — the exact x 301's pivot was tuned to by hand.**
   Two independent routes to one number, so it is written as the rule rather
   than copied seven times (BUILDER-BRIEF §8), and 301 now reads it too.

3. **`LEAF_W`/`LEAF_H` hoisted** out of 301's private block as
   `FLAT_LEAF_W`/`FLAT_LEAF_H`. They had to be renamed: a **different** `LEAF_W`
   already exists at `apartment.ts:3078` for the street doors, in the same
   scope. That collision is worth knowing about.

After:

```
all six  proud = -165 mm  RECESSED     (301/302 unchanged)
```

## The thing that was not in the brief: I opened a hole to the outdoors

Recessing the leaf exposes its **0.03 m undercut at the boards**, and behind
these six doors there is no modelled flat at all. A dim back panel was not
enough: an eye at hall distance looking *down* through a 3 cm slot crosses the
panel's plane at **y = -0.19**, and the panel stopped at -0.05.

It showed as a pale line under all six doors. I sampled it rather than guessing:
**`#8a97a2` — daylight, through a shut front door.** The recess now has a
**floor**, seated just under the hall carpet. Re-measured: **0 daylight pixels**
in the floor-4 frame; the 44 remaining in the floor-1 frame are the lobby's
street-door glass at the top of frame, which belongs there.

*A slot you can see through is not closed by making the thing behind it darker.*

## Proof

- `scripts/door301.mjs` — **green, exit 0**, every assertion ok. (DONE WHEN.)
- `scripts/probes/w61-walk-landings.mjs` — **walks**, not screenshots. All eight
  doors on all four floors: held. 301 opens through, as it must. Each hall
  walked **7.0 m end to end past both doorways**, no fall. Flight A climbs.
  Same result on dev **and on the built bundle**.
- `node scripts/bugsweep.mjs` on the built bundle — **0 STATION MISS, 0
  COVERAGE**, no new console errors.
- My own verdict on the after-frames, which I have looked at: 201 and 302 now
  read identically — same dark architrave, same light reveal down the strike
  jamb, same set-back leaf. The wallpaper runs continuously across the new
  lintels (the spandrels pass `vOff`; the old top piece passed 0 from a base of
  7.5 and was misaligned by 0.78 of a tile — nobody had noticed, because there
  was only ever one of them).

## Two traps I hit, recorded so the next agent does not

**GOTCHAS 78 is sharper than it reads.** All eight of my built-bundle frames
came back **solid black** while the *same bundle's* scene graph and walk tests
read perfectly. `afterFrames` was not enough: **rAF fires whether or not the
renderer has drawn.** On a cold `vite preview` the first painted frame arrived
at **1136 ms**. The probe now waits for a painted frame and prints the delay.
The renderer is not published on `__ct` (`crosstown.ts:1339` keeps it local), so
a probe cannot ask it for a frame count without editing a file item 109 does not
name — **worth a queue item: publish `renderer.info.render.frame` on `__ct`.**

**A hand-rolled collider test lied to me.** My walk reported all four landings
"wedged" 1.65 m in. It was **not my change** — pre-change `apartment.ts` stops
at z = -17.380 against my -17.353, which I proved by checking the old file out
and re-running rather than by reasoning. The cause was my probe's own walking
line, `x = AX(1.9)`, which passes **0.36 m from the corner of collider #204**,
the 0.15 m block standing off the east wall across 302's doorway. My
axis-aligned min/max query said *"nothing there"*; `lib/collide.mjs`'s
frame-aware predicate named the box immediately. That library's rationale is
correct and I am the next data point for it.

## `npm run checks`: 8 red, and I checked every one of them

None are mine. Recorded so nobody re-derives it:

| check | why it is not mine |
|---|---|
| `aimed` | lists only w13/w15/w21/w29/w50/w51/w52 probes. No `w61` — all five of mine route through `aim()`. |
| `mutations-quote-real-source` | 3 dead cases, all quoting `src/proto/ct/props.ts`. |
| `N-post-waiting` | 301's doorway offers "sit on the bed and watch TV" instead of the slip. **Reproduced identically with `apartment.ts` reverted to `3185632ae`** — pre-existing. |
| `floaters-walk` | every floater is at x 674–1243. The walk-up is at x 200. |
| `hashes-resolve` | citations in `G-vice-walk`, `alleycheck`, `shells`, `alleydish`, `canfail`, `alley.ts`, `checks.mjs`. |
| `K-pocket-loop`, `K-tyre-has-arch`, `L-every-stool-seats-you` | newspaper, tyres, casino stools — different areas, none touch `apartment.ts`. |

Also worth the desk knowing: **`npm run checks` correctly refused to run at all
against a stale `dist/`**, printing *"dist/ ON THIS DISK IS NOT THIS COMMIT"*
and naming both hashes. That is GOTCHAS 77 caught by a guard rather than by a
builder, and it is the behaviour you want. Separately, a `npm run build` while a
`vite preview` is serving **kills the preview** — every check then reports
`SERVER DIED (unmeasured)`, which is not red but reads like it. Build first,
then start the preview.

## Found and NOT fixed

- **`scripts/masonry.mjs` cannot see any of this.** None of these surfaces are
  tagged `userData.masonry`, so no check defends the new spandrels', reveals' or
  leaves' texture density (BUILDER-BRIEF §7b). I derived every repeat I touched
  via `wallMesh`'s existing `w/2.7, h/2.7` and passed `vOff`, but nothing would
  catch me if I had not.
- **Collider #204 blocks 302's doorway on all four floors**, though 302 only
  exists as a flat on floor 3. It is currently doing useful work — it is what
  stops you walking into 102/202/402's newly-cut openings — but it is
  load-bearing by accident, not by declaration. If anyone ever gates it to
  floor 3 the way `aptDoorCap` is gated, three doorways become walk-through
  holes into void.
- **The six flats behind these doors are still not modelled.** The doors now
  read as real doors, which may invite the user to try to open them.
- `A-verify-select-through` is red on mainline at 35/44 — pre-existing, not
  mine, not touched.

## Files

- `src/proto/ct/apartment.ts` — the only source file changed. Inside item 109's
  named boundary; I did not need any file the item does not name.
- `scripts/probes/w61-doorflush.mjs` — the depth measurement, before and after
- `scripts/probes/w61-doorfoot.mjs` — named the daylight leak by sampling it
- `scripts/probes/w61-walk-landings.mjs` — the walk
- `scripts/probes/w61-hallblocker.mjs`, `w61-halltrace.mjs` — the false "wedged"
