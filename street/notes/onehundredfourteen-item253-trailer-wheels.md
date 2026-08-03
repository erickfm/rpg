# Item 253 — the trailer wheels: half fixed inside my boundary, half reported

Queue worker **onehundredfourteen**, 2026-08-03. Built bundle, port **4482**.
Changed **`src/proto/crosstown.ts` only** — the one file this item names.

ninetyeight scoped this and refused to guess between two candidates
(`notes/ninetyeight-item113-wheels-scoping.md` §3). **I looked, and it is both of
them — but only one is inside this row's boundary.**

---

## What the defect actually is, with a measurement and a picture

**It is NOT a float.** Ground gap **0.0000 m**, before and after. These 12-gons
are phased onto a vertex, so they are the one pair of wheels in the world seated
exactly right, and item 252's decagon-on-its-apothem defect does not apply.
ninetyeight was right.

**Shot from the carriageway at 3 m — where a player passes it — the near wheel
read as a black disc silhouetted against the ROAD, with no bodywork behind it.**
That is the *"dark blob detached from the vehicle"* the request describes, and
the sedan's own rear wheel one metre to the left does **not** read that way. Two
things make the difference and I could only fix one.

### (a) FIXED — it stood 0.113 m proud of the deck, on each side

The line's own comment said *"two wheels tucked under the deck"*. It was false.
Centres at ±0.95, half-thickness 0.07 → sidewalls at ±1.02 against
`DECK_HW = 0.9`. Measured off the **live scene graph**, not the source
(`scripts/probes/w114-item253-trailer-look.mjs`):

| | wheel span X | deck span X | overhang |
|---|---|---|---|
| before | 2.7244 … 4.7701 | 2.8375 … 4.6571 | **+0.1131 m a side** |
| after | 2.8444 … 4.6501 | 2.8375 … 4.6571 | **−0.0069 m** (inside) |

The residual 7 mm is `parkYaw()`'s few degrees of jitter rotating the trailer, not
a placement error.

**Derived, not typed:** `WHEEL_X = DECK_HW − WHEEL_T / 2`, so the outer sidewall
is flush with the deck edge by construction and the comment cannot go false
again. The axle now spans hub to hub off the same constant instead of being a
second typed `1.9` that could drift away from the wheels.

**`ct/cars.ts:1458` warns that moving a CAR's wheel inboard "buried it, which was
worse". That does not transfer, and the reason is structural:** a car's flank is
an opaque slab from rocker to beltline, so an inboard wheel disappears behind it.
This deck is **0.06 m of plank at 0.44–0.50 m** and hides nothing. Tucking these
in changes which side of the silhouette the wheel sits on; it does not hide it.
Confirmed by looking: the wheel is still fully visible, it now just belongs to the
trailer.

### (b) NOT FIXED, AND I THINK IT IS THE BIGGER HALF — the wheel has no hub

The trailer wheel is a bare `MeshBasicMaterial(0x101114)` cylinder. **It is the
only wheel in the world without a hubcap**, and at 3 m that is what makes it read
as a blob rather than as a wheel — in my own after-shot it is *still* a
featureless black shape beside a car wheel that reads instantly because of its
grey cap.

**I could not fix it inside this item.** The fleet's treatment is
`hubcapTex()` (`ct/cars.ts:807`) applied through `tyreGeo(r, t, n)` as
`[tireM, capM, capM]` (`ct/cars.ts:1458-1476`), and **neither is exported.**
Rebuilding a hubcap inside `crosstown.ts` would be a second hand-made copy of a
texture the fleet already owns, which is BUILDER-BRIEF §8's whole complaint and
the reason `bedcavity.mjs` measured a truck that no longer existed.

**QUEUE THIS, naming both files:** export `hubcapTex` and `tyreGeo` from
`ct/cars.ts` and build the trailer wheel as
`new THREE.Mesh(tyreGeo(0.22, 0.14, 12), [tyreM, capM, capM])`. It is two export
keywords and one constructor. It also closes the second half of ninetyeight's
observation — these are 0.14 m wide against the fleet's 0.24 m, so they will
still be thinner than a car's even with a cap, which may be correct for a trailer
and should be looked at rather than assumed.

## What I did not break

- **The hitch.** The trailer is still a child of `p.car`; parenting untouched.
- **The climb**, which is what the deck is *for*. `scripts/w29-sedan-climb.mjs`
  **PASS**: road → trailer deck 0.500 → boot lid 0.930 → street, and off it three
  ways. The wheels carry no collider, so nothing I moved is standable geometry.
- **The rig he asked us to keep** — *"i love the car with the trailer thing btw
  keep that tysm."* Nothing was restyled, resized or removed; two mesh positions
  moved inboard by 0.12 m.

## Instrument note

My first two attempts at the after-picture were worthless and both are worth
recording, because either could have been reported as "looked at it":

1. **Four typed cardinal yaws photographed the library.** The world's forward
   vector is `(sin yaw, −cos yaw)`; a heading has to be solved for. The probe now
   computes yaw toward the axle centre.
2. **The +x side at 5 m is inside the used-car lot's chain-link and a street
   tree.** The player meets this from the carriageway, which is −x. Shooting from
   the wrong side of a fence produces a picture of a fence.

Also: at eye height the deck (top 0.50 m) hides the wheels completely from 2 m,
so the camera has to be back and pitched down. **A standing player right beside
this trailer cannot see its wheels at all** — the complaint is made from a few
metres away, which is where I shot it.

## Inherited state

`npx tsc --noEmit` clean. Shots: `shots/w114-trailer-road-3m.png`,
`-roadq-3m.png`, `-road-5m.png` and siblings. Console errors 0.
