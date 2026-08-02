# w29 — item 54: you can climb onto the parked sedan now

**Root cause, one line:** no car but the pickup could be climbed not because the
tyre step was *tight*, but because `blocked()` pads every collider by `RADIUS`
while `standTop()` pads by nothing — so a step must sit `RADIUS` clear of
everything still walling it, and the tyre sits under a body collider 0.39 m
wider than itself.

**Route shipped, walked end to end on the built bundle:**

```
road 0.00 -> trailer deck 0.50 -> boot lid 0.93 -> (and back down)
```

Ports: **dev 4188, built preview 4189** (both proved free with `curl` first;
both shut down at the end).

---

## The item's premise was right about the tyre and wrong about why

The queue said: *do NOT build the tyre route (0.66 m first step, 28 mm over the
kerb, second hop 31 mm — both tighter than the pickup's 21 mm)*. The decision
was correct. **The reason was not, and it matters, because "too tight" invites
someone to retune the jump and try again — and that would not work either.**

`fp.ts` is a MISMATCHED PAIR:

```
blocked()  : x > c.minX - RADIUS && x < c.maxX + RADIUS && ...   (fp.ts:236)
standTop() : x < c.minX || x > c.maxX  -> skip                   (fp.ts:255)
```

`standTop` says so on purpose — *"a roof does not extend past its own edges"*.
So to stand on a tier your centre must be **inside its own footprint** and
**`RADIUS` = 0.36 m clear of the face of every tier still a wall at that
height**. The tyre spans |x| 0.78..1.02 under a body collider of ±1.05 that is
solid to 0.94, so a standing centre would have to be at |x| ≥ 1.41 — **0.39 m
outside the tyre it is standing on.** No height tuning reaches that.

`scripts/probes/w29-ledge-band.mjs` derives this from the world's own `RADIUS`
and **reproduces all five of the pickup's existing tiers as a control** (bed
2.10×1.69, rails 0.31×1.54, roof 2.10×1.47 — matching w21's own description).

The same rule is why "just give the sedan a chunkier bumper" does not work: a
ledge abutting the nose loses 0.36 m of itself to the hood tier above it, so it
would have to jut two-thirds of a metre into the road before anything was left
to stand on. **The step has to be somewhere the body is not**, and behind the
tail is the only such place that is neither the road nor the sacred 2 m
sidewalk lane. Hence a hitched flatbed trailer.

## THE 21 mm MARGIN IS NOT A MARGIN — AND THE PICKUP'S ROOF IS ON THE SAME EDGE

This is the finding the desk most needs.

I built the boot-lid → cab-roof hop first. It has **exactly** the 21 mm the item
asked for (both it and the pickup's rail → roof are a 0.53 m rise). It failed
three times out of three. Rather than retry, I sampled the hop per animation
frame (`scripts/probes/w29-roof-hop.mjs`):

```
  feet 1.405  z -10.267        <- high enough, hasn't moved yet
  feet 1.395  z -10.432        <- moved 0.165
  feet 1.350  z -10.597        <- moved 0.165, now BELOW threshold
  feet 1.270  z -10.447        <- unstick shoves you back out
```

**Height is only half of a hop.** You must also cross `RADIUS` horizontally
*while* above `maxY - TOP_EPS`. At `main.ts:107`'s dt clamp every frame is
0.05 s and a walk covers 0.165 m, so what decides a hop is how many frames clear
the threshold:

| rise | frames above | travel | crosses 0.36 m? |
|---|---|---|---|
| ≤ 0.52 | 3 | 0.495 m | yes |
| **0.53** | **2** | **0.330 m** | **no** |

0.53 sits exactly on the boundary — the fourth frame's apex is 0.450 and the
threshold it must beat is 0.450 — **so which side it falls on is decided by
floating-point rounding, not by design.**

**The pickup's roof hop is the same 0.53 and wins that tie by luck.** Its
heights are exact doubles (`PICKUP_CAB.roofY` 1.5, `PICKUP_BED.railY` 0.97) and
`0.97 + 0.45 === 1.42` exactly. The sedan's come off the mesh's Float32
bounding box (1.46 stored as 1.4600000381), which moves the threshold **38
nanometres** the wrong way and costs the whole frame.

So I did **not** ship the roof, and did not nudge a number until it passed
(BUILDER-BRIEF §7). The greenhouse stays a plain wall: nobody stands on sloping
glass, and a standable roof reachable only on a coin flip is a collider nobody
meets. The two hops I did ship clear by **4 and 5 frames**.

## What changed — `src/proto/crosstown.ts` only

The parked sedan's single full-height box becomes three, and gains a trailer:

- **`sedan-body`** — nose to the boot lid's front edge, **no `maxY`**, i.e. still
  a wall at every height, exactly like every other car in the world
- **`sedan-boot-lid`** — `maxY` 0.93, seamed at the lid's own front edge
- **`sedan-trailer-deck`** — `maxY` 0.50, starting at the car's own tail

**`ct/cars.ts` was NOT touched** — it is held by another builder (queue item 46)
and the item named only `crosstown.ts`. The sedan's cabin numbers are locals
inside `makeCar`'s sedan branch (`ct/cars.ts:849-857`) and are not exported the
way `PICKUP_CAB` is, so copying them with a citation was the sanctioned fallback
(§8). **I did not take it**: the tier heights and seams are read off the drawn
mesh's own bounding boxes, which is strictly better — it is the panel itself,
not a second description of it, so it cannot drift if the loft is retuned.
`scripts/probes/w29-sedan-panels.mjs` proves the classification ("a lid on the
belt") is unambiguous on all four kinds: sedan 2, hatch 1, van 1, pickup 5.

The trailer is a **child of the car group**, so it inherits placement and yaw and
is built in the same local frame every number above is in. Its deck collider
starts at the car's own tail rather than at the plank, so car and trailer present
one continuous solid — a gap there would have been 0.65 m of exactly the
0.40–0.95 m band `ct/gap.ts` calls a trap, manufactured on purpose.
`DECK_Y` is imported from `PICKUP_BED.floorY`, not retyped.

## Verified

- **`scripts/w29-sedan-climb.mjs` — PASS on dev:4188 and on the BUILT bundle at
  preview:4189**, first attempt on both, including "the flank is still a wall on
  foot" and getting off the lid in all three open directions (forward is the
  glass and is *expected* to hold you).
- **Mutation-tested three times, every one confirmed to change bytes**
  (`cksum` before/after, and the real exit status captured without a pipeline —
  `$?` after `| tail` is `tail`'s status, which reported a green 0 over a red run
  the first time I looked):
  1. deck flattened to 0.14 → `MISS 2. boot lid`, exit 1 (96994 → 96992 bytes)
  2. greenhouse given `maxY` 1.46 → `FAIL: sedan-body carries maxY`, exit 1 (→ 97074)
  3. boot lid flattened to 0.50 → **PASSED. The check had been asleep.**
- **The sleeping check is the second finding worth keeping.** It asserted
  `feet === boot.maxY`, reading its expectation out of the very collider under
  test — a tautology, so flattening the tier left the world wrong and the check
  green. It now pins heights against a **freshly built sedan** measured off its
  own panels (`__ct.carVariant`, which touches no collider code), and pins each
  hop against the engine's 0.52 m budget. Mutation 3 then failed correctly.
  **`scripts/w21-roof-climb.mjs` has the same tautological shape** and would
  sleep through the same mutation — see "not fixed" below.
- **No new traps, measured properly.** `w21-trap-count.mjs` against a real
  mainline build (`git checkout ec8fbde04 -- src/proto/crosstown.ts`, rebuilt)
  vs mine: **524 → 526 colliders (exactly my two tiers) and 175 → 175 flagged.**
  The `V` overlay shows the three boxes stepping down the car, all green.
- `node scripts/bugsweep.mjs` on the built bundle — **0 STATION MISS, 0 console
  errors, 96 shots**, measuring build `16b53c0c4` (its own header confirms it was
  my tree, not another builder's server).
- `npx tsc --noEmit` and `npm run build` clean throughout.
- The world loads with **no `[parking]` and no `[sedan-climb]` warnings**
  (`scripts/probes/w29-console.mjs`, which filters only the three pre-existing
  engine warnings by name rather than widening its pass condition).

## My verdict on the after-images

`shots/w29-trailer.png` — the maroon sedan parked outside A-1 TAX SERVICE with a
low plank-decked trailer behind it. It reads as a car with a trailer hitched to
it. The deck is plainly a thing you could step onto, which is the point.
`shots/w29-trailer-boxes.png` with the `V` overlay shows the three boxes
stepping down the vehicle in the right places — the tall wall over body and
greenhouse, the low box on the boot lid, the lower one over the deck — and
every one green. `shots/w29-on-the-sedan-boot.png` is the view standing on the
boot lid with the rear glass in front of you.

**Honest wart:** the trailer is sparse — a deck, an A-frame, an axle, two wheels
and a lamp board. At street scale it reads, but it would repay a proper chassis
rail. The tail board carries **no collider**, deliberately, for the pickup
tailgate's reason: a 0.12 m lip you cannot see and can only trip on is worse
than one you walk through.

## Found and NOT fixed

1. **`scripts/w21-roof-climb.mjs` is tautological in exactly the way mine was.**
   It asserts feet against `bed.maxY` / `roof.maxY` read from the collider under
   test, so flattening a pickup tier would leave it green. It is the guard on
   the pickup's whole route. Worth a one-line queue item; the fix is the
   `carVariant` cross-check I added.
2. **The pickup's cab roof is a 0.53 m rise and therefore a coin flip at the dt
   clamp** — it passes today only because its heights are exact doubles. Any
   change to `TOP_EPS`, gravity, `v0` or the pickup's heights can silently flip
   it, and its own guard (see 1) will not notice. The durable fix is either an
   intermediate rung or lifting the rise to ≤ 0.52; both are `ct/cars.ts` work.
3. **`SEDAN_CAB` was never hoisted.** `PICKUP_CAB`/`PICKUP_BED` are exported;
   the sedan's, hatch's and van's equivalents are still locals in `makeCar`. I
   worked around it by reading the mesh, which is fine, but anything that needs
   the *roof plate's* edges (as opposed to a bounding box) still cannot get
   them. `ct/cars.ts`, one hoist, same shape as item 29's.
4. **The hatch and van still cannot be climbed, and a trailer will not fix
   them.** The hatch's tail is sloping glass all the way down, so there is no
   flat panel behind the cabin to be the second rung; the van's roof is 0.84 m
   above its bonnet. Measured in `scripts/probes/w21-fleet-tops.mjs`.
5. **`git stash` is shared across worktrees and I nearly lost another agent's
   work with it.** `git stash push <path>` with no changes in that path creates
   no entry, and my follow-up `git stash pop` then popped **stash@{0} belonging
   to another builder** (base `39649f49b`) into my tree, conflicting on a
   `notes/QUEUE.md` that mainline has since deleted. Their stash survived (a
   conflicted pop does not drop the entry) and I restored my tree without
   touching it, but this is a live foot-gun for every builder here: **do not use
   `git stash` in a worktree — use `git checkout <ref> -- <path>` instead**,
   which is what produced the trap baseline above. Worth a GOTCHAS entry.

## Derived or copied?

**Derived.** Tier heights and seams come off the drawn mesh's bounding boxes;
the box half-width is read back off `sedan.cb`; `DECK_Y` is imported from
`PICKUP_BED.floorY`; `RADIUS`, `corridor`, `ENTERABLE` and `PASSABLE` are
imported from the modules that own them.

The one thing **cited** rather than imported is the jump physics inside the
probes (`v0 = 4.0`, `g = 14`, `TOP_EPS = 0.08` at fp.ts:52/452/488, the dt clamp
at main.ts:107). They are not exported and `fp.ts` is not mine here — the same
citation w21 had to make. The acceptance test does not trust the citation
alone: it pins the *rise budget* (0.52 m) rather than the physics, so it fails
correctly if any of those numbers is retuned. A `JUMP = { v0, g, topEps }`
export from `fp.ts` would remove the last copy.
