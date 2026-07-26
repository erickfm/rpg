# Builder I — first session on the car lot

Split off C on 2026-07-25 (`29ca18602`) because C was carrying 17 live rows
across two areas that have nothing to do with each other. The lot is mine.

**Every item under `## Now` in `notes/queues/I-lot.md` is closed**, plus the
ground-painter request the user sent mid-session.

## The headline, and it is not a comfortable one

**Five of the six queued faults were already fixed in the world when I got
them.** The left row, the clipping, the chairs, the pole sign, the garlands —
all landed by C, none confirmed, all still OPEN in the ledger and all re-routed
to me as new work.

What was actually broken was the **evidence**: no check could tell any of them
from its own regression, one instrument was miscounting the thing it existed to
count, and two builders had published contradictory numbers that nobody had
reconciled. So this session's product is mostly guards, and I think that is the
right product — but the desk should know that the queue described a lot that had
already been repaired.

| queue item | verdict | what I added |
|---|---|---|
| left row backwards | already right | `I-rows` + the rake clause nothing else asserts |
| cars clipping | already right | `I-clip`, and both builders' numbers reproduced in one run |
| chairs backwards | already right | `I-facing` — every seat sat in, every sign marched |
| pole sign small/skewed/busy | already right | measured from the street, four angles |
| garlands disconnected | already right | `I-bunting`, two clauses |
| night: printed signage | **REAL, fixed** | 54 daylight-bright sheets → 12 |
| driveway apron | **REAL, not mine** | measured and routed to B |

## What actually changed in `ct/lot.ts`

Three things, all small, all measured inert or measured better:

1. **`printed()` on eight signage sites + the salesman.** 54 materials held full
   daylight brightness over a black yard; now 12, and all twelve are one object
   per car in H's `ct/cars.ts`. Closes *"make the unilluminated stuff darker."*
2. **`slabTex` on the office step tread** — the module's only flat-colour ground
   surface, 0.7 m².
3. **`notSignage` on the weed tufts**, so a checker can tell a weed from a price
   card by asking rather than by guessing at its size.

## Five checks, all registered and green, all with a selftest that fires

`I-rows`, `I-clip`, `I-facing`, `I-flatground`, `I-bunting`.

**Every one of them was wrong before it was right, and I want that on the
record**, because in three cases the wrong version was GREEN:

- `I-facing` **passed 59 of 59 while testing nothing** — I had excluded solids
  sharing the sheet's *parent*, and almost everything here is parented straight
  to the scene, so "same parent" meant "same scene". Only the selftest found it.
- `I-facing` also reported two seats correct **without ever sitting in them**
  (warping away from a chair does not stand you up, so the next press toggled
  the wrong way), and called the tyre stack a wall 0.25 m from the face of
  someone sitting on it.
- `I-flatground` first reported **142 m² of flat ground** that was almost
  entirely 9 cm paint stripes measured as slabs — the same axis-aligned-box
  error I had just spent an item taking apart in someone else's numbers.
- `I-flatground`'s selftest was a **silent no-op**: it sized candidates from a
  plane's local z, which is always 0, so it "passed its selftest" by never
  mutating anything.

The pattern is the one already in `C-STATUS.md`: *my sign-offs are reliable when
I measure and unreliable when I look.* A green check I have not watched fail is
worth nothing, and four times this session that was literally true.

## For the desk

- **Ledger:** six of my seven live rows are built and evidenced (notes
  `I-left-row`, `I-clipping`, `I-facing`, `I-printed`, `I-polesign`,
  `I-bunting`). I cannot mark them CONFIRMED and am not asking to — they need
  the desk or the auditor.
- **`notes/BLOCKED-I.md`** — the apron row needs B.
- **Port 4190 is unusable.** It is ManageSieve, on the WHATWG bad-ports list, so
  node's `fetch` refuses it and `npm run checks` reports NOTHING IS SERVING
  while curl gets 200 and Playwright works fine. **I moved to 4191**; my queue
  file still says 4190 and should be corrected before the next agent loses an
  afternoon to it.

## For other builders

- **H** — 12 materials, one per car, the body slab in `ct/cars.ts`, drop only
  5.3% at night where the rest of the lot drops 88–95%. **Filed as a measurement
  discrepancy, NOT as a visible defect** — the cars plainly read dark in
  `shots/I-n-gate-aisle.png`, so the likeliest reading is that `mods-dim`
  samples one face of a six-material box. Same `makeCar` builds the traffic
  fleet.
- **Whoever owns `lot-layout.mjs`** — it reports **18 cars on a lot of 11**,
  counting a car's inner group as a second car. Its nose-out verdict survives
  that; its count does not.
- **Whoever owns `checks-registered.mjs`** — it greps for the literal
  `argv.includes('--selftest')` and cannot see any check built on the shared
  `flags()` helper, which is the newer idiom. It called every script registered
  while five of mine were not.
- **Whoever owns `fpdiff`** — it cannot read the pair that `npm run fp <label>`
  writes; it expects a different filename convention.

## Left undone, deliberately

**`padT` at `ct/lot.ts:261` is defined and never used** — the lot's own patched,
oil-dripped asphalt, with a long comment about it, referenced by nothing. The
deck you walk on is the shared site slab. Dead code rather than a visible
defect, and whether the lot should have its own surface over the site's is not a
one-line call, so it is recorded rather than decided.

**All three "not parked" cars are on the left row** — hood up at bay 1, jacked at
bay 9, on blocks at the south back corner — plus the deliberate empty bay. So
the left row is every damaged car on the lot and the right row is clean stock.
Nobody asked for that; it is a composition note for the standing quality brief.
