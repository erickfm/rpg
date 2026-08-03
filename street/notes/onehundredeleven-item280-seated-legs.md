# Item 280 — SCOPED FURTHER, NOT SHIPPED. The obvious fix breaks item 93, and I can prove the margin

Worker **onehundredeleven**, 2026-08-03. Port **4672**, built bundle.
**Nothing in `src/` was changed.** I wrote the fix, photographed one variant of
it, found it wrong, wrote the better one, and **reverted it unverified** — see
§4. Everything below is measured.

The user: *"people sitting still looks bad because they have no legs??"*

I start from `notes/onehundredeight-item272-scoping.md` and do not re-litigate
it: the flag is set, the sitter is not too high, **the bench eats the legs**, and
**no redraw can fix a billboard that stands inside the box**. All confirmed.

---

## 1. THE FINDING THAT CHANGES THE DESIGN — the fix's natural size is 2.5 cm from breaking item 93

The item, and onehundredeight, both describe the fix as *"stand a seated sprite
at the front of its seat, offset along its facing"* — i.e. **move
`mesh.position`**. **That is a trap, and here is the arithmetic.**

**Two callers claim the occupied seat by reading the mesh back after placing it:**

```
ct/interior.ts:2005   if (o.seated) TAKEN.push({ x: s.mesh.position.x, z: s.mesh.position.z });
ct/int-casino.ts      sitter() -> claimSeat(...) the same way
```

**And the tolerance that matches against it is 0.30 m** (`ct/interior.ts:910`),
deliberately small, and its own docstring says why:

> *"Seats in this world are as close as 0.65 m apart (the casino's lounge bench
> places four at 0.65 m pitch), so a generous radius here would blank a whole
> bench because one person sat on the end of it."*

**The offset wants to be half a seat depth. The diner bench is
`BoxGeometry(0.55, 0.45, 1.5)` — half-depth 0.275 m.**

```
natural offset   0.275 m
seatTaken tol    0.300 m
margin           0.025 m
```

**So moving `mesh.position` by the natural amount leaves 2.5 cm of a tolerance
that item 93 depends on — and any seat deeper than the diner's pushes it out
entirely.** When it goes, the player is offered a stool a man is already sitting
on and lands inside him: *"you sit where he sits and that just breaks
immersion."* That is the exact defect item 93 fixed, and it would come back
silently, in the rooms nobody re-walked.

**This is what the row means by "an offset that fixes the diner and floats the
church is a regression" — but the mechanism is not floating, it is the seat
registry, and it is quantified above.**

## 2. A variant I tried, photographed, and rejected

**`citizenPlane` geometry translate along local +Z.** Attractive because it never
touches `mesh.position`, so item 93 and item 150b are safe by construction.

**Wrong, and the frame says so.** +Z is the plane's normal, and `update()` points
it at the camera every frame — so it moves the sitter 0.30 m **towards the
player**, not out of the seat. In the diner that direction is *across the table*.

`shots/w111-280-TOWARD-CAMERA-across.png`: the sitter is pulled clear of the
bench and straight into the table, which eats him instead. Compare
`shots/w111-280-BEFORE-across.png`, which is the user's own complaint — a torso
cut off dead level with the red vinyl.

**A seat offset is a fact about the sitter's facing, not about where the observer
is standing.** A billboard cannot borrow the viewer's direction for this.

## 3. The design that IS right, written and typechecked, and why it is safe

Apply the offset **in `citizenSprite.update()`, along `facing`**, from a `base`
captured on the first update:

```ts
export const SEAT_FWD = 0.30;          // > the 0.275 m half-depth of the deepest seat
const seatFwd = (look.seated ?? false) ? SEAT_FWD : 0;
let base: THREE.Vector3 | null = null;
// in update(), before the billboard maths:
if (seatFwd) {
  if (!base) base = mesh.position.clone();
  mesh.position.set(base.x + Math.sin(facing) * seatFwd, base.y,
                    base.z + Math.cos(facing) * seatFwd);
}
```

**THE ORDERING IS THE SAFETY ARGUMENT, and it is why this beats a build-time
offset.** Both seat claims happen at **build** time, immediately after `place()`.
`update()` does not run until the **first frame**, which is strictly later. So
**TAKEN records the un-offset seat exactly as it does today**, and §1's 2.5 cm
margin is never spent. Item 150b's sprite-width clearance is likewise computed at
build time and is untouched.

**It cannot accumulate**: every frame writes `base + offset`, never
`position += offset`. `base` is read once.

`npx tsc --noEmit` is clean on it.

## 4. Why I reverted it rather than shipping it

**I could not verify it, and an unverified change to this primitive is the
expensive kind.** The row's DONE WHEN is *"a seated citizen reads as seated with
legs from a normal standing view, **every room calling the primitive is checked
and reported**"*. There are **six rooms placing seated sprites** — I measured
them, and the count is smaller than the row's "eleven", which is the count of
`citizenSprite` callers:

```
int-diner  int-church  int-casino  int-jail  int-bank  int-library
```

Live census of every `userData.seated` figure, from the world:

```
(878.68, 0.675, 2.08) f 0.00   (870.60, 0.675, 11.68) f 0.00   (872.52, 0.675, 6.72) f 3.14
(994.32, 0.460, 10.0) f 1.57   (995.05, 0.595, -1.30) f 1.57
(1074.4, 0.475, -0.05) f 0.00  (1077.6, 0.475, 1.25) f 3.14   (1082.9, 0.475, 2.95) f 1.57
```

**Eight seated figures across five rooms, at four different seat heights
(0.46, 0.475, 0.595, 0.675).** A single `SEAT_FWD` has to look right on all of
them, and the only way to know is to look at all of them. **I ran out of room to
do that**, and this is a change that lands in the world the user is playtesting
on 5177 — a wrong seated offset would be visible to him in six rooms at once.

**Shipping it unlooked-at would have been the failure this project keeps
recording: a primitive changed, the diner fixed, five rooms unphotographed.**

## 5. What the next worker should do — this is now a short job

1. Apply §3 verbatim (it is written and typechecks).
2. **Use a camera anchored to the FURNITURE, not to the sitter.**
   `scripts/probes/w108-item272-diner-legs.mjs` derives its vantage from the
   sitter, **which is the thing this change moves** — so its before/after pair
   is shot from two different places and cannot be compared. That confounded my
   first comparison. `scripts/probes/w111-280-fixed-camera.mjs` anchors to the
   bench box instead; **its diner warp does not land yet** (asked (761.21, 2.55),
   stood (760.00, 0.00)) and that is the one thing left to fix in it.
3. Shoot all eight figures above, before and after.
4. Assert item 93 directly: `takenSeats()` must be **byte-identical** before and
   after. If it is not, §3's ordering argument is wrong and the change must come
   out.
5. Church 18/17/1 and casino 87/83/4 (item 93's registered/offered/suppressed)
   must still hold.

**Do not tune `SEAT_FWD` per room.** If one value cannot serve four seat depths,
the offset belongs on the seat, not on the sprite, and that is a different item.

## 6. Instrument note

`roomDims()` is **indexed 0..12, not keyed by room id** — the ids come from
`rooms()` in the same order. Matching `/diner/` against `roomDims()`'s own keys
finds nothing, and my probe exited 3 with *"no diner in roomDims()"* on a
perfectly healthy world. Pair the two arrays.
