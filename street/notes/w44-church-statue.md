# w44 — item 91, the floating thing in the church

**Root cause, one line:** the bracket was drawn, correctly sized and in front of
the wall — it was simply **attached to nothing**, hanging 0.78 m clear of the
west wall's inner face, so the whole statue-and-bracket assembly floated.

Port **4192** (dev) and **4194** (`vite preview`, the built bundle). Both shut
down at the end of the session.

---

## The item's premise was wrong, in both of the ways it offered

Item 91 asked me to settle *"whether the bracket is drawn but too small or too
flush to read at player height and distance, or whether it is drawn behind the
wall plane and simply not visible."*

Neither. Measured before touching anything (`scripts/probes/w44-statue.mjs`,
walked in through the street door, `__ct` AABBs off `matrixWorld`):

```
bracket   x -5.72..-5.38   y 1.37..1.47   z 7.61..7.87
statue    x -5.68..-5.42   y 1.47..1.99
west wall inner face at local x = -6.5
statue foot vs bracket top: 0.000 m  (rests on it)
```

So the bracket was **in front of** the wall, not behind it; it was **0.34 ×
0.10 × 0.26 m**, which is a perfectly legible size at this scale, and you can
see it plainly in the user's own screenshot; and the statue rested on it exactly.
What was wrong is that its back edge stood **0.78 m clear of the only wall
anywhere near it**. A bracket is a thing that grows out of a wall. This one was
a shelf hanging in mid-air over the candle rack.

**Which wall matters, and it is not the obvious one.** The flat plaster field the
statue appears to sit against in the frame is the **west wall** (local x = -6.5),
which you face nearly head-on from the aisle; the coursed masonry raking away to
the left of the frame is the narthex wall at z = 9.27. The eye pairs the figure
with the west wall and nothing joins them. `scripts/probes/w44-behind.mjs` lists
every large mesh within 3 m and settles it: west wall 0.95 m away, narthex wall
1.53 m.

## The half that mattered more

The user did not say "the bracket is wrong", he said **"what is this floating
thing"** — he did not recognise it as a statue. It was a tapered cylinder and a
sphere in `#c8c2b2` / `#d8d2c4` with a `#8a8274` shelf, against `#a8a294`
plaster: four tones inside one narrow band of warm grey. Unlit, at 8 px/m, with
nothing casting a shadow, that is a chess pawn. The block's own comment has
claimed *"a small painted statue"* since it was written and **nothing about it
was painted**.

Fixed as silhouette and palette, which is the whole toolkit here:

- shrine rebuilt off the **wall plane** — every depth measured out from
  `WALL = -hw`, never from the rack's centre, so moving the room's width keeps
  the shrine on its wall
- corbel is **three stages**, not one slab: shelf, wedge, foot dying into the
  plaster. The underside is the entire tell — nothing here casts a shadow to
  supply one, and a lone slab is exactly what read as floating
- cream robe under a **blue mantle**, a face, joined hands, and a halo

## The halo is sized by parallax, not by taste

Worth keeping because it will bite the next person. First cut was r 0.12 stood
0.095 m behind the veil. You never see this shrine square on — you come at it up
the aisle, 20–30° off its axis — and that offset throws the disc ~0.04 m
sideways, which was **more than the 0.038 m of ring showing past the veil**. The
halo bunched into a gold crescent on one side and read as a smudge. The ring has
to be wider than the throw: **r 0.14 past an 0.082 veil leaves 0.058** and reads
as a disc from anywhere you can actually stand.

## My own verdict on the after-frames

`shots/w44-statue-{before,after}.png` are from the same standing position
(x 755.50, z 7.28), reached by walking in through the street door and up the
aisle — not warped.

Before: a featureless pale bollard on a grey slab, floating on blank plaster. I
would have asked the same question the user did.

After: it reads as a robed figure with a face and a halo standing on a bracket
that visibly steps down into the wall. The blue is doing nearly all the work —
it is the only saturated thing on that wall, and it separates instantly.

`shots/w44-statue-far-after.png` is the one I would actually defend, and I added
it because the close-up is not the test: it is from 5.5 m down the nave, which
is how you first see the shrine. The figure is small there but unmistakable, and
the candle rack now sits directly beneath it so the whole thing groups as one
object instead of two unrelated ones.

---

## THE TEXTURE FINGERPRINT CANNOT MATCH ACROSS THIS KIND OF CHANGE

Worth a GOTCHAS entry; I have not added one because GOTCHAS is not mine.

`npm run fp` / `fpdiff` reported **294 of 1461 textures differing**, which looks
like catastrophe and is an artifact. Cause, confirmed in
`node_modules/three/build/three.core.js:2295` — `generateUUID()` draws **four
`Math.random()` values per object, geometry and material**, and `scenedump.mjs`
seeds `Math.random` globally so that `dither()` is reproducible. So **adding any
mesh shifts the seeded stream and repaints every dithered texture built after
it.** The `textures` hash is only a valid "the art did not move" check for a
refactor that adds and removes nothing.

I checked this rather than assuming: two back-to-back dumps of identical code
matched exactly (`53a7aa37`), and the before-hash reproduced exactly across a
stash/pop (`d9eac1eb` twice). The instrument is stable; it is just answering a
different question than CLAUDE.md thinks it is.

`fpdiff`'s counts are also positional — it compares the sorted lists entry by
entry, so inserting six meshes misaligns the tail and inflates every count.
`scripts/probes/w44-placediff.mjs` compares `places` as a **multiset** instead
and names what actually appeared and vanished:

```
objects 8324 -> 8330  (6)
only in before: 3 shrine meshes + 3 elsewhere
only in after:  9 shrine meshes + 3 elsewhere
```

The three "elsewhere" pairs are the same x,z with **y differing by 0.02** —
drifting props, the documented noise floor. Nothing else in the world moved.

## Verified

- walked in through the street door and up the aisle, before and after
- **built bundle** (`npm run build` + `vite preview`), not only dev —
  `shots/w44-statue-built.png` matches the dev frame
- `node scripts/bugsweep.mjs` → **0 STATION MISS, 0 COVERAGE**, no new console
  errors
- `npx tsc --noEmit` clean

## Found and did NOT fix

- **`scripts/probes/w44-statue.mjs` originally imported `/src/proto/ct/doors.ts`
  directly**, which works on the dev server and dies on the built bundle. Fixed
  in mine (it asks `__ct.spots()` now), but **other instruments do the same
  thing** — `scripts/interiors-walk.mjs:302` imports `doors.ts` to get its
  stand points, so it cannot run against a build. Worth a sweep.
- **The wall around the shrine is very empty.** That is item 92's subject (more
  detail on the east wall) and I left it alone deliberately, but the same
  judgement applies to this west wall.
- **The votive rack runs perpendicular to the wall it now shrines against**, so
  the statue presides at the rack's end rather than over its middle. It composes
  fine — see the far shot — and turning the rack to run along the wall would
  move a collider and a footprint the file records as hard-won, so I did not.
- **`claim.sh` cannot claim a named item.** It only takes the top of the queue,
  so when the desk routes a specific item to a specific builder there is no
  supported way to take it. I released 88 with `--release` and marked 91 by hand
  under the queue lock. A `claim.sh <name> <item>` would remove the need.
