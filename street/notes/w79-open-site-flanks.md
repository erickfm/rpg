# Item 221 — the hole north of the car lot, and what it actually was

Queue worker **seventynine**, 2026-08-03. Port **4350** (`ss -ltn` clean before
binding; `--strictPort`). Worktree `agent-a03f52240b3fcaae0`, reset to
`add-stick-and-city98` at `78eaf0c35` (it arrived on the initial commit —
GOTCHAS 54, thirteen for thirteen).

---

## The row was right that there is a hole, and wrong about where the seam is

The item says *"Ground ends at z ≈ 16.6 north of the car lot, and nothing stops
you walking to z 19.00 … Seal it the way the jail forecourt was sealed."*

The escape is real and the shape is exactly the jail's. But the row reads as
though the pavement's north end at z 16.6 were the thing to close. **It is not
the seam the player crosses.** The player never touches that pavement: the
street's north cap already seals it.

**What is actually missing is a collider on a wall that is already drawn.**

`openSite` (`src/proto/ct/street.ts:717`) gives every open site two flank
**party walls** — 13 m of brick, full site depth, painted with the stepped roof
scar and blocked-up windows of the building that went. The lot's north one is
`shots/w79-lot-north-from-inside-before.png`: a brick wall filling the frame
with the lot's own **TRADE-INS WELCOME** banner hanging on it.

**Neither flank has ever had a collider.** Not the lot's, not the park's, not
in any revision of the function.

## Why it only bit in one place, and why that place looked sealed in the source

Whether a missing flank collider *matters* depends on whether a neighbouring
shell happens to stand behind that flank — a different answer per flank, which
is why nobody noticed. Three of the four were covered by the adjoining
building's own footprint. Two were not:

| flank | behind it | before |
|---|---|---|
| lot, north (z 14.20) | **nothing — the block ends here** | walk through into void |
| park, south (z −98) | nothing at x < −7 | walk through into void |
| lot, south (z −9) | the next east shell | covered by accident |
| park, north (z −68) | the next west shell | covered by accident |

The lot's north flank is the **north end of the block**, and the thing that is
supposed to close the north end is the cap building at `street.ts:1051`:

```ts
const CAP_W = 2 * FACE;                            // exactly the street, no more
…
solid({ minX: -FACE, maxX: FACE, minZ: NZ, maxZ: NZ + CAP_D });
```

`-7 … 7`. The lot runs `7 … 30.2`. **The cap seals the street half and nothing
ever sealed the lot half** — which is item 175's sentence about the jail
verbatim, one site along: *"the flank screens closed one axis-half and nothing
ever closed the other, so it looked complete in the source and in a
screenshot."* And that comment, `"exactly the street, no more"`, is a
deliberate narrowing that was correct when it was written — it was stopping the
cap barging across the building line — so the source reads as though somebody
had thought about the width.

## The fix: the wall you can SEE is the wall you HIT

`src/proto/ct/street.ts:716-767` — each flank plane now registers its own
`solid()`.

- **The body goes BEHIND the plane**, not in front. Same rule the frontage rail
  three lines down was moved for (*"a boundary belongs on its own land"*): a
  party wall's thickness belongs to the building that is gone, so the site keeps
  every metre of its own ground. **Measured: the lot's 2 m-lane assertion reads
  22.75 m before and 22.75 m after — the fix costs zero walkable ground.**
- **The x span is derived, not typed** — `XF + side * 8` is lifted from the back
  wall's own `solid()` three lines below, so flank and back meet at the corner
  instead of leaving a notch to squeeze through. (BUILDER-BRIEF §8.)
- **0.5 m thick.** A running player covers 0.113 m per frame at `run: 6.8`, so
  this cannot be tunnelled; the number is derived from that, not picked.
- Written off `ry` rather than a second pair of z literals, so the collider and
  the loop that places the plane cannot drift apart.

This is the class, not the instance. The next open site somebody opens gets it
for free, which is the whole reason the fix went in `openSite` and not into a
patch over the lot's north end.

---

## Measured

**The walk** (`scripts/probes/w79-walk-north.mjs`), 9 x-positions across the
lot's north flank, 1.8 s legs, `w` held:

| | before | after |
|---|---|---|
| lot north flank, 9 walks | **7 walked through to z 17.44–17.49 on NO FLOOR** | **9 of 9 stop at z ≈ 13.81, ON FLOOR** |
| park south flank, x −32 | walked to (−32, **−101.52**) on NO FLOOR | stops at (−32, −97.58), ON FLOOR |
| lot south flank, 5 walks | all on floor | all on floor |
| park north flank, 6 walks | all on floor | all on floor |

**The registered check**, `scripts/w75-site-contained.mjs`, on the built bundle
at build `290782006`:

| site | before (item 215) | after | lane before → after |
|---|---|---|---|
| lot | **10 escapes / 368 walks**, 21 off the site rect | **0 / 392**, 0 off the rect | 22.75 → **22.75 m** |
| jail | 0 / 136 | **0 / 136** | 13.50 → **13.50 m** |
| park | 0 / 624 | **0 / 592** | 26.75 → **26.75 m** |

All three saturated (nothing left queued: 392/1232, 136/720, 592/1792), every
site entered and stood in (34 / 6 / 43 in-site places), 0 page errors.
**Not one metre of walkable ground was lost at any site.**

`node scripts/canfail.mjs jail-forecourt-open` — **CAUGHT**, 1/1, every mutated
file restored byte-for-byte. The retargeted mutation still finds a deliberate
hole after this change.

### The change moves no geometry, and that is measured, not asserted

`solid()` pushes an AABB; it adds no mesh. Three independent readings agree:
the floor-mesh census is **359 before and 359 after**; the flank-plane list is
identical; and `waitPainted` reports **11048 triangles / 82 draw calls** at the
same pose in both runs. `shots/w79-lot-north-{from-inside,wide}-{before,after}.png`
are the same scene — which is what a collider-only change should look like, and
is why `fp` was not the instrument here (GOTCHAS 75 does not bite, but the
triangle count is the more direct answer).

**My verdict on the after-images, which I looked at:** the lot's north end is
the same brick party wall with the same TRADE-INS WELCOME banner, the same
SOLD-tagged cars in front of it. Nothing was walled off, nothing was added; the
only difference is that you now stop at it.

### Gates

`npm run typecheck` 0 · `npm run build` 0 · `node scripts/health.mjs` 0
`WORLD OK` · `npm run sweep` **96 shots, 0 STATION MISS, 0 COVERAGE**, no new
console errors (`[interior:hotel] NO BUILDING NAME` is the known standing one).

### Two probes that lied, and were caught by their own controls

Worth recording, because both are the failure modes the brief warns about and
both fired on the first run:

1. **`w79-walk-north.mjs` asserted yaw 0 = +z. It is −z.** The walker's
   self-test failed immediately and the run aborted with exit 3 rather than
   printing a page of confident numbers about walks in the wrong direction.
   Both signs are now controls: yaw 0 must go −z *and* yaw π must go +z.
2. **The first `w79-flank-look.mjs` shot was 100 % black** — `__ct.painted()`
   called and its result thrown away is not a wait (GOTCHAS 80). Replaced with
   `waitPainted` + `blackFraction`, which now prints the black fraction of every
   image it writes. Had I not looked at the image (GOTCHAS 20) I would have
   filed a black rectangle as evidence of a brick wall.

---

## FOR THE DESK — found, not fixed

1. **A THIRD hole, and this one is not at any site: the deep west, north of the
   block.** From (−30, 12) — behind the west building line, past the deepest
   shell's back — walking north crosses z 14.2 unobstructed and ends at
   (−30, **18.00**) on no floor. **I could not demonstrate it is reachable on
   foot** (I warped in), and after this fix the park no longer leaks north, so
   it may be sealed in practice. **It is not sealed in principle**, and nothing
   measures it: `w75-site-contained` is seeded per *site* and there is no site
   out there. This is exactly follow-up 2 in `notes/w75-containment-is-a-class.md`
   — *"the same question has never been asked of the ROAD or the pavements"* —
   and it is still the highest-value instrument left.

2. **The player's bound is a rectangle over mostly-void, so containment rests
   entirely on colliders.** `crosstown.ts:1235`:

   ```ts
   bounds: { minX: westBound(), maxX: interiorMaxX(), minZ: -110.6,
             maxZ: Math.max(13, interiorMaxZ()) }
   ```

   `maxZ` is **19.00**, and it is 19 because the deepest room in the interior
   belt out at x ≥ 400 reaches z 18 (`interiorMaxZ()`, `ct/interior.ts:191`).
   That is why every escape in item 215 stopped at exactly z 19.00. **A room
   200 m east decides how far north the player may walk on the street** — the
   street's own north end is the `13` in that `Math.max`, and it is never the
   winner. Same shape on x: `maxX` is `interiorMaxX()`, ≈ 1006.
   Not a defect I can see a player hitting today, but it is the reason a single
   missing collider becomes an off-world walk instead of a bump.

3. **`checks.mjs` still prints three identical `w75-site-contained` rows** with
   no way to tell which site each is — flagged by item 215's author, still true,
   still a one-line fix inside a shared loop nobody owns.

## Files

| | |
|---|---|
| `src/proto/ct/street.ts:716-767` | the fix — `openSite`'s flanks register colliders |
| `scripts/probes/w79-walk-north.mjs` | the walk, both flanks of both sites, self-testing on both yaw signs |
| `scripts/probes/w79-north-edge.mjs` | what floors and colliders exist north of z 12 |
| `scripts/probes/w79-flank-look.mjs` | the flank planes, and the before/after images |
| `shots/w79-lot-north-from-inside-before.png` | the wall you walked through |
