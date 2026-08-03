# w60 — item 108, the mug on the flat 301 windowsill

**Port used: 4184.** 4183 and 4186 were already serving other builders; 4184
answered `000`. Preview of the **built** bundle, sha-matched by `bugsweep.mjs`'s
own world guard, which caught me once serving a stale `dist/`.

## Root cause, one line

The handle's hole axis pointed along **+x** and the handle was **also offset
along +x**, so the loop's plane was perpendicular to the direction it stuck out
— a hoop parked beside the cup rather than a handle joined to it, not touching
it at all.

## What the item got right, and what it got wrong

The item was **half right, and the half it was wrong about was the half it told
me not to look at.**

| item's claim | measured | |
|---|---|---|
| body and handle share one material | same material uuid, both `#d8d2c4` | **true** |
| the ring is too coarse to read | `radialSegments 4`, `tubularSegments 8` | **true, but misnamed** |
| "it IS rotated correctly … do not chase that" | `\|hole axis · offset\| = 1.0000` | **false** |
| "sits proud of the sill edge rather than on it" | bottom at **0.0000 m** on the sill top, furthest point **0.047 m inside** the room edge | **false** |
| "a mug is about three texels wide, a handle modelled honestly will not read" | **20 × 25 px** from the room's own SPAWN | **false** |

Two notes on the ones that were true:

- The item calls `radialSegments: 4` "a square ring, not a curve". It is not the
  ring — in `TorusGeometry(radius, tube, radialSegments, tubularSegments)` the
  4 is the **tube's cross-section**, and the ring itself was the `8`, an
  octagon. Both were raised, but for the record: **in an unlit world segment
  count buys silhouette only.** Every face of a `MeshBasicMaterial` cylinder is
  the same colour, so there is no faceting to smooth. This is why the fix is
  tone and shape and not detail — the item's instinct was right for the wrong
  reason.
- The shared material was real and is fixed, but on its own it would not have
  been enough. A handle that is not attached to the cup does not become a
  handle by being repainted.

**The rotation is correct in isolation.** `rotation.y = Math.PI / 2` puts the
hole axis along x, facing the room, which is exactly where you want it — the
player comes at the window about 15° off the −x axis, so he looks *through* the
loop. What was wrong is that the **offset** agreed with it instead of being
perpendicular to it. One of the two had to move, and moving the offset to +z is
the better of the two changes because it keeps the hole facing the player *and*
hangs the loop across his sightline, silhouetted against the dark glass of the
light well. Turning the ring instead would have left the loop edge-on — a
vertical sliver with no hole at all.

## The change — `src/proto/ct/apartment.ts`, the sill block

- handle offset moved from +x to **+z**, and **derived** from the cup rather
  than typed: `HANDLE_OFF = MUG_R + (H_R - H_TUBE)`. The ring passes **14 mm
  through** the cup wall (attached), and the hole starts exactly where the wall
  ends, giving **30 mm of daylight** through it and 44 mm of ring proud of the
  cup.
- handle gets **its own material**, `0xa79f8f` — deliberately *between* the body
  (`0xd8d2c4`) and the dark glass behind it, so it separates from both. It is
  close to the sill's `0xa8a091`, which would matter if the handle were ever
  seen against the sill; it is not, because it hangs 27–84 mm above it with the
  window behind.
- **a dark disc 1 mm above the top cap.** The player looks *down* at this from
  22–40°, so the top face is a large share of what he sees, and a flat cap in
  the body colour is what made it read as a peg. It rides above the cap rather
  than at coffee level inside it because the cylinder's cap is solid and would
  simply hide it. What is left is a 6 mm ring of rim around a dark disc.
- segments raised (`8→12` body, `4,8→6,14` ring). Silhouette only, see above.

Footing was already correct and is **unchanged**: 0.0000 m on the sill top,
0.172 m clear of the nearer sill end, 0.072 m inside the room edge.

## My verdict on the after-frames

I looked at all six, full-frame and cropped to the mug's own projected box —
same pixels, cut out, not a closer camera.

- **Before, at the spawn:** a plain pale peg. No handle, no hole, no top. The
  user's word for it — "blob" — is accurate.
- **Before, at the sill:** the handle is visible as a *bump merging into the
  body's lower right*, no hole. This is the "undifferentiated lump".
- **After, at the spawn (1.78 m, 26 × 25 px):** reads as a mug. Pale cup, dark
  contents, and a loop off the left side with the window showing through it.
- **After, at the sill:** unambiguous. The hole is open and dark, the rim reads
  as a rim.

Shots: `shots/w60-mug-{before,after}-{spawn,mid,atsill}.png` and the `-crop`
pairs. (`shots/` is gitignored, so these are on my worktree's disk only.)

## Three instrument faults found on the way — none of them in the world

Worth recording, because all three would have produced a confident wrong answer:

1. **A 600 ms settle filed a completely black first frame.** The interior had
   not drawn yet; the two later stations, by then warmed up, looked fine. Mean
   pixel was `0.0/255` at 600 ms and `117.9/255` at 3.1 s
   (`scripts/probes/w60-spawn-black.mjs`). The probe now **waits for a frame**,
   not for a timeout. A black frame reads exactly like "the mug is not there".
2. **The sightline check reported the mug's own handle as an obstruction** at
   every station — the handle is 55 mm out, therefore nearer the eye than the
   cup. Excluding by distance-along-the-ray was not enough; it now excludes
   anything inside the mug.
3. **The screen-size measurement reported an 8 cm mug as 864 × 1565 px.** It
   matched same-sized geometry elsewhere in the city, including behind the
   camera, where projection diverges. Constrained to the mug's neighbourhood it
   reports 20 × 25 px — which is what disproves the item's "three texels".

And a **fourth, in my own first version of the geometry probe**: the attachment
test computed `offset − (R + tube)`, which silently assumes the ring extends
along the offset. For a ring turned 90° across it — the exact defect I was
measuring — that formula printed **"ATTACHED: yes"** over a 9 mm air gap. It now
samples the ring's real centreline in world space. *A check written against the
shape you expect cannot see the shape you have.*

## Found and NOT fixed

- **`bugsweep.mjs` prints 14 `warning:` lines on a clean run** — a `THREE.Clock`
  deprecation, ten `willReadFrequently` canvas notices, and WebGL teardown
  noise. They are pre-existing and unrelated, but they mean "no new console
  errors" currently has to be judged by eye against a 14-line baseline. Worth a
  queued allowlist so a genuinely new warning stands out.
- **The sill's own prop tones are close together.** `sillM` is `0xa8a091` and my
  handle is `0xa79f8f`; they do not collide from any angle a player uses, but a
  future prop laid *on* the sill in that range would disappear. Not a defect
  today.
- I did not touch the plant, the pot, or the sill itself.

## Verification

- `npm run typecheck` clean; built bundle, sha `6ef3ab247`.
- `node scripts/bugsweep.mjs` against 4184: **0 STATION MISS, 0 COVERAGE**, 96
  shots, 12/12 rooms registered.
- `scripts/probes/w60-mug-geometry.mjs` — the before/after table above.
- `fp`/`fpdiff` **deliberately not used**: this change adds a mesh, and GOTCHAS
  75 / BUILDER-BRIEF §10 say the texture hash cannot survive that.
