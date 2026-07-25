# Handoff — builder E · the park (`ct/park.ts`)

786 lines, new this session, mine. Read this before touching it: most of what
follows is a constraint that was found by walking into it, not by design.

Walk harness: **`scripts/E-park-walk.mjs`** — run it after any change here.
Shots: `shots/E-park/`.

---

## The split with `ct/street.ts`

D owns the SITE and publishes its extents; this file owns everything inside.

| D (`ct/street.ts`, `openSite`) | E (`ct/park.ts`) |
|---|---|
| the ground plane, the two party flanks, the rear elevation | the kerb, the paths, the field, the fence, all furniture, the trees |
| the low boundary wall on the street line + its gate gap | the railings ON that wall, the piers, the gate leaves |
| `park: PARK` extents | reads them; hardcodes nothing |

Wired from `crosstown.ts`, one line: `buildPark(ctx, street.park)`. It takes
the whole ctx because the benches register through `ctx.seat`.

**Everything is measured off `site` and off two derived lines.** The park has
been re-cut three times — 7 m deep, then 32 m, then re-laid — and each time
the layout followed without being rewritten. Keep it that way.

## The two lines everything obeys

```ts
const EDGE_X = site.maxX - KERB_W;   // -7.25. Grass starts here.
const inside = (halfWidth) => EDGE_X - halfWidth - 0.05;
const REACH  = -13.4;                // bounds.minX. NOT the back of the park.
```

**`inside()` is the sidewalk rule as arithmetic.** The user's standing note is
*"in general we should not encroach the already cramped sidewalk."* A bin, a
bench and a pier were each found standing on the walk — 0.23 m, 0.36 m and
0.07 m — because all three were placed relative to the PATH instead of to the
line. Anything new goes through `inside()`. The harness audits it: every
collider in the park's z-span is checked against x = −7.00, and only D's
boundary wall may cross it.

**`REACH` is not the park.** See the blocker below.

## The layout, and why it is this one

- **A field**, the largest single thing, mown in 1.6 m stripes and empty.
- **A loop AROUND it**, never across: a circuit has no end to arrive at, so
  60 m of walking fits in 30 m of park. Legs at x −8.60 (street) and −35.80
  (back), ends at z −96.30 and −69.70, 1.5 m wide and edged in granite.
- **Desire lines** are what people do INSTEAD of the loop — six of them, which
  is what makes the loop read as a choice rather than the only route.
- **Trees**: a run every ~6 m on all three boundaries plus a line framing the
  field. Three crossed alpha panels that do NOT turn — a park tree is walked
  under and seen from every side. B's street trees are billboards and stay
  billboards; these could not be.
- **A memorial** where the loop turns, so the turn is the reason.
- Benches (sittable, `ctx.seat`), bins, a fountain, a noticeboard, ivy, litter
  and a trolley on its side.

## Four things that will bite you

1. **The gate is reserved space (§8).** A bench run stepped off the end of the
   park walked a bench into the gate opening and the park could not be entered
   at all. The run is stepped off `gateMid` and skips it. Same for the
   noticeboard and bins.
2. **Trees must stay off the loop.** The first flank lines were planted 2 m
   off the walls, which is inside the end legs' width, and the loop stopped
   being walkable. They are 1.7 m INBOARD of the path now.
3. **Planting has no room behind the back leg** — 0.75 m between path and
   wall. A bed there put its collider across the path. Ivy and a hedge are
   what fit.
4. **Only reachable benches register a seat.** A bench past `REACH` would be a
   seat nobody can walk to, which F's `seats-walk.mjs` correctly calls
   UNREACHABLE. **Done** — the clamp moved and the condition is gone; every
   bench on the loop is a seat.

## What is verified, and how

`scripts/E-park-walk.mjs`, all green against mainline with nothing patched:
in through the gate and out; the boundary holding either side of it; all four
all four loop legs walked corner to corner;
70 floor samples level; **an audit that nothing the park owns stands on the
pavement**; and the capsule driven the full 30 m of frontage step by step,
treating a stall as a squeeze only if it survives a pause.

Two harness lessons worth stealing:

- **Citizens are solid AND seeded**, so one standing in a lane stops you in
  the same place on every retry. Retries wait 3.2 s, and a failure prints what
  static collider is actually there — or says a citizen was standing in it.
- **`apt.gy()` has more than one writer**, so a single read can catch another
  frame. Floor samples take the MEDIAN of three. Max was tried and is wrong in
  the other direction — it lets a stale reading off a step win on the flat
  beside it.

## Status, 2026-07-25

Nothing owed. `bounds.minX` moved to −40, so the whole 32 m walks; the loop
closes on foot; every bench is a seat; B's lamps are in off the table that
used to live in `notes/BLOCKED-E.md`, which is deleted.

Two faults that only appeared once the clamp lifted, because nothing out
there could be walked to before: the back tree line stood ON the back leg
(trunks blocking to x = −35.74, path centre −35.80) and a shelter post was
0.23 m inside the path. Both moved. If you add anything to the far half,
walk the loop afterwards — that is the only way either of those shows up.
