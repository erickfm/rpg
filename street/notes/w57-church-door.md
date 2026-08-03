# w57 — item 147: a room can no longer lose its door declaration in silence

Ports **4185** (dev) and **4191** (`vite preview`, the built bundle). Both were
`000` before I took them; both shut down at the end.

**Root cause, one line:** `buildRoom` can only reach a `DoorDecl` through a
building NAME, it has exactly two sources for one — `spec.building` and the
frontage — and **a room on a cut face publishes no frontage**, so a chamfer room
that omits `building` resolves `null`, looks up nothing, and every reader in the
kit quietly takes its `??` branch.

The item's premise was **right**, which is worth saying given how often it is
not. w56 had already found it and written the three-step repair; I measured it
before building on it and it held up in every particular.

## What changed

### 1. The mechanism — `ct/interior.ts`

`buildRoom` now says so, on the kit's own channel, when no building name
resolves:

```
[interior:church] NO BUILDING NAME, so no DoorDecl was consulted and this room
is getting the kit's generic timber leaf. …
```

**`bad()`'s `[interior:<id>]` prefix was already wired to two registered
checks** — `scripts/interiors-walk.mjs:284` and `scripts/G-rooms-walk.mjs:210`
both collect it and fail on it — so this is not a message hoping to be read. A
room that loses its door now **fails a check**. I did not invent a channel; I
used the one the kit already screams down, which is also what `ct/doors.ts`
does for its own two silent-loss faults (an undefined namespace in the glob, and
two rooms claiming one building).

**I did not make it throw.** A room that genuinely has no declaration is a legal
thing to be, and killing the world for it would be a check that cannot be wrong
rather than one that cannot fail.

### 2. The church — `ct/int-church.ts`

- `building: 'ST BRIGID'` on the spec, which is the line that makes the
  declaration reachable at all.
- a real `leaf` on `DOOR`.
- **`width: 1.4` REMOVED from the spec's `door`**, and that removal is
  load-bearing: `spec.door.width` beats the declaration by design (six rooms
  predate `DoorLeaf`), so leaving it would have kept the domestic opening even
  with `building` set and the fix would have looked like it did nothing.
- the jail's recipe: hide the kit's single 32×64 leaf, hang the room's own pair
  through `leafPair`. A `DoorLeaf` carries colour and glazing and **cannot carry
  a leaf count** — `ct/interior.ts:1327` records that closing that inside the kit
  gave three other rooms two stacked doors — and a church door is two leaves or
  it is a garage.

### The leaf's size is MEASURED, not re-derived

`ct/civic.ts:1179` paints the west front's leaves inline, cut to the innermost
order by `archHW` after two roundings. **I ran that arithmetic by hand first and
got the width right and the height 0.1 m wrong.**
`scripts/probes/w57-church-leaf.mjs` reads the block of leaf timber straight off
that canvas and converts with the density `masonry()` stamped on the texture
(`userData.masonry.ppm`), so nothing about the conversion is assumed either:

```
104x136px  13 x 17 m at 8 px/m
  leaf block x 41..62 y 101..130
  => 2.750 m across BOTH leaves, 3.750 m tall; sill 0.625 m, head 4.250 m
```

That probe was wrong twice before it was right, both times as an instrument
rather than as a finding, and both are written into it: it filtered canvases at
`>200 px` when a whole 13 m church front is 104 px wide (found nothing), and
then matched the leaf colour anywhere and found it on six other facades'
drainpipes. It asks `userData.masonry` now instead of guessing from pixel size.

**Copied, and declared as copied (§8):** `0x4a3524`, `#8a7a4a` and `#c9a45e` are
`ct/civic.ts:1181-1186`'s own leaf timber, straps and ring, cited by line because
they are drawn inline into a facade canvas and there is nothing to import.
**Follow-up:** that painter should read `doorLeafFor('ST BRIGID')` rather than
carry its own literals — the way `ct/jail.ts` hoisted `jailLeafTex()` and
`ct/int-jail.ts` hangs the *same* `THREE.Texture`. That edits `ct/civic.ts`,
which this item does not name.

**Density (§7b):** one leaf is 1.345 × 3.69 m; a 28 × 76 canvas is 20.8 px/m
across and 20.6 up — square within 1%, and the same order as the jail's shared
leaf (20.0 / 20.9), so the two entrances in this world with real leaves are
drawn at one scale. The board pitch is derived from the leaf width, so a wider
leaf gets more boards rather than fatter ones.

## Proof

- **`doormatch12.mjs`: 5 of 12 red → 4 of 12**, church moves to `its own door`
  (`2x28x76`), and **the other four rows are byte-identical** — `burger`,
  `diner`, `tax`, `thrift` are still named, exactly as w56 intended. Nothing was
  loosened; the check is the one w56 rewrote and I did not touch it.
- **`scripts/probes/w57-church-walk.mjs`** — the opening went from 1.4 × 2.15 m
  to 2.75 × 3.75 m with two meshes hanging in it, so it is **walked**, not
  photographed. In the opening I reach within **0.20 m** of the wall plane;
  against the jamb the wall stops me **2.91 m further out**; standing in the
  doorway I can still move in all three directions; `[E]` in and `[E]` out both
  work on foot. Green on dev **and on the built bundle**, exits non-zero.
- **The mechanism can fail.** Deleting the one `building:` line makes the new
  warning fire and takes the walk red. Worth noting what that mutation does
  *not* break: `doormatch12` still passes church, because the room hangs its own
  leaves from its own `DOOR` regardless — the leaves stay 2.75 m wide while the
  kit's hole silently shrinks back to 1.4. **The new warning is the only thing
  in the project that catches that**, and it is precisely the state the hotel is
  in today.
- The probe caught its own bug first: yaw 0 is `fwd = (0,0,-1)` (`fp.ts:477`),
  so the first cut walked *away* from the wall it was testing and reported the
  doorway blocked. Instrument, not world — written into the file.
- `bugsweep` **0 STATION MISS, 0 COVERAGE** on the built bundle. `health` OK.
  `spots-walk` **35 failures, the same 35 as mainline** (measured by rebuilding
  the parent and re-running).
- **`fp`/`fpdiff` NOT used, deliberately** — this adds two meshes, and
  GOTCHAS §75 / BUILDER-BRIEF §10 say that tool reports a catastrophe that is not
  there. Same call w56 made for the same reason.

**Frames, which I have looked at:** `shots/w56/church-inside.png` against
`shots/w56/church-outside.png`, both from the player's own standing position via
w56's own derived-stand-point probe. **My verdict:** they now read as the same
door — two tall boarded timber leaves, the same timber, two brass straps at the
same relative heights, brass ring handles at the free edges. The exterior's head
is a point and the interior's is square; the user's own ruling covers that
(*"no one is going to take a ruler"*), and the kit cannot cut a pointed opening.

## Found and NOT fixed

1. **THE HOTEL IS THE SAME BUG, STILL OPEN, AND IT IS WHY `G-rooms-walk` NOW
   READS 113/114.** `ct/int-hotel.ts` declares `clearW: 2.2, h: 2.6, leaves: 2`
   and **builds its own stone case at exactly those numbers** (`DW =
   LEAF_H.clearW`) — while its `buildRoom` spec omits `building`, so the kit
   cuts its **1.15 m × 2.15 m** fallback hole behind it. One room, two numbers,
   one doorway. `shots/w57/hotel-inside.png` shows it: 2.2 m of door and case
   over a 1.15 m opening, the pale strip of outside far too narrow for the
   doorcase around it. **The fix is the same one line**, `building: 'HOTEL
   ORPHEUS'`, and the window at local x [1.5, 5.1] still clears a centred 2.2 m
   door at [-1.1, 1.1] by 0.4 m so the kit's overlap check stays quiet. **I did
   not take it: `ct/int-hotel.ts` is item 96's file and item 147 does not name
   it.** The red is the item working, not a regression — before today nothing
   could see this at all.
2. **`ct/civic.ts`'s church painter should read the declaration.** It carries its
   own `#4a3524` / `#8a7a4a` / `#c9a45e` and its own `DOOR_W`, so the two faces
   agree today by citation rather than by construction. Hoisting a
   `churchLeafTex()` the way `ct/jail.ts` did closes it for good.
3. **`doorWidthFor()` in `ct/doors.ts` has no callers in `src/`.** `DoorDecl.width`
   is documented as deprecated in favour of `leaf.clearW`; the church's is gone
   now, five rooms still carry one. A dead accessor plus a deprecated field that
   OUTRANKS the live one (`spec.door.width` wins over `LEAF.clearW`) is the next
   version of this same trap.
4. **`scripts/spots-walk.mjs` fails 35 on mainline**, unchanged by this work,
   including two ATM rows — its premise (every `[E]` sits on the door it names)
   does not fit a machine in a wall or an apartment package.

## For whoever comes next

- The item's two `⚠` warnings were both worth obeying and both came out clean:
  `ct/int-church.ts` is named by item **145**, which was **TODO and unclaimed**
  when I checked with `./scripts/claim.sh --stale`, so nothing collided. 145 is a
  lighting change and does not touch the door.
- `./scripts/ownership.sh` will call these files somebody else's. `CLAUDE.md`
  demotes `OWNERSHIP.md` to history in as many words; the claim grants the file.
