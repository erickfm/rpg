# Blocked — builder H

Work I have hit that I cannot do from the files I own. Nothing here is blocking
my queue: I flagged each one and moved on to the next item. Both are in builder
B's modules.

---

## 1. The side street has no lamps, and is unlit after dark

**Wanted by:** the side-street item (*"the lamps … east along it until the fog
takes them"*). Everything else in that item landed — trees in dirt pits and
parked cars, thinning eastward.

**Why I stopped:** the bishop-crook lamp is built inline in `ct/props.ts`, and
more to the point the lamplight registry it feeds — `lampHeads` — is **private to
that module**. `props.lit(obj)` only registers a thing as *lit by* existing
lamps; there is no way to add a lamp HEAD from outside. A lamp built in
`ct/sidestreet.ts` would be a dark post that lights nothing, which reads worse
than no lamp at all.

**What would unblock it:** `ct/props.ts` exposing a lamp factory on its `Props`
interface — something like `lamp(x, z, yaw)` that builds the pole and registers
its head — and then I place them down the side street with the same falloff the
trees and cars use. That is a desk operation on B's file, not a drive-by.

**Visible consequence today:** walk east down the side street after dark and it
is black, while the main street glows. The trees and parked cars I added out
there do go dark correctly (they are registered with `props.lit` and swept into
`dimWorld`), so the moment lamps exist they will pool light on them for free.

## 2. No catch basins down the side street

**Wanted by:** the same item (*"the catch basins … east along it"*).

**Why I stopped:** `ct/tex-ground.ts` places exactly two, at the junction low
points where the gutter pan actually drains to (`basin(ROAD_HALF, -92.5, 1)` and
`basin(-ROAD_HALF, -105, -1)`). Adding more means deciding where the side
street's pan falls, which is that module's business — the grate has to sit at a
low point or it is decoration in the wrong place. The kerb, gutter pan and
sidewalk already run the full length of the side street, so this is the only part
of "carry the ground detail east" that is outstanding.

**What would unblock it:** builder B deciding the side street's drainage and
adding the basins, or telling me the low points and exporting `basin()`.

---

## Not blocked, for the record

- **Lamp-lit trees and cars on the side street** — done, they just have nothing
  to be lit by yet.
- **Traffic density** — `maxActive = 1` in `ct/traffic.ts` is a deliberate
  earlier decision, not a blocker. The junction is safe for two; it is one
  number when the user wants a busier street. See the U-turn caveat in
  `notes/feat-traffic.md`.
