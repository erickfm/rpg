# Sidewalk lane audit — the whole block

> *"in general we should not encroach the already cramped sidewalk"*

Player capsule **0.72 m** across (RADIUS 0.36). GOTCHAS §9: the 2 m lane is
sacred. Measured, not eyeballed: at every 0.25 m along each lane, take the
nominal walk band, subtract every collider crossing it, keep the **largest
continuous free run**. 1380 samples per population.

**Two populations, reported separately.** 406 colliders, of which **13 are people**
(`crowd.ts:153`, boxes deliberately ±0.25 so the player can pass, and they
move — a pinch there is transient). The user's rule is about **fixtures**,
which never move, so a pinch there is permanent.

## FIXTURES ONLY — the user's rule

| band | samples | % |
|---|---|---|
| IMPASSABLE  <0.72 | 8 | 0.6% |
| URGENT  0.72–0.80 | 0 | 0.0% |
| PROBLEM 0.80–1.00 | 0 | 0.0% |
| tight   1.00–1.40 | 26 | 1.9% |
| clear ≥1.40 | 1346 | 97.5% |

Stretches under 1.40 m: **17**

- **0.25 m** — east walk, z 14.3…15.0 (1.0 m long), between `(untagged)` [street] and kerb / lane edge
  - left  `x -7…7  z 14.2…20.2`
- **0.25 m** — west walk, z 14.3…15.0 (1.0 m long), between kerb / lane edge and `(untagged)` [street]
  - right `x -7…7  z 14.2…20.2`
- **1.06 m** — side st north, x 10.5…11.8 (1.5 m long), between kerb / lane edge and `(untagged)` [street]
  - right `x 10.44…11.06  z -96.7…-96.1`
- **1.15 m** — east walk, z -35.8…-34.3 (1.8 m long), between `(untagged)` [props] and `facing` [street]
  - left  `x 5.07…5.73  z -35.9…-34.1`
  - right `x 6.88…26.7  z -53…-35`
- **1.15 m** — east walk, z -93.0…-93.0 (0.3 m long), between `(untagged)` [props] and `unmatched`
  - left  `x 5.15…5.55  z -93.2…-92.8`
  - right `x 6.7…18.4  z -94…-86`
- **1.15 m** — side st north, x 45.0…45.0 (0.3 m long), between `(untagged)` [props] and `(untagged)` [vice]
  - left  `x 44.8…45.2  z -97.9…-97.5`
  - right `x 33.45…45.45  z -96.3…-82`
- **1.20 m** — side st north, x 20.0…20.0 (0.3 m long), between `(untagged)` [props] and kerb / lane edge
  - left  `x 19.8…20.2  z -97.9…-97.5`
- **1.27 m** — side st north, x 13.5…13.5 (0.3 m long), between `(untagged)` and kerb / lane edge
  - left  `x 13.38…13.62  z -97.7…-97.5`
- **1.27 m** — side st north, x 31.5…31.5 (0.3 m long), between `(untagged)` and kerb / lane edge
  - left  `x 31.38…31.62  z -97.7…-97.5`
- **1.33 m** — east walk, z -51.0…-51.0 (0.3 m long), between `(untagged)` [props] and `facing` [street]
  - left  `x 5.15…5.55  z -51.2…-50.8`
  - right `x 6.88…26.7  z -53…-35`
- **1.33 m** — east walk, z -23.0…-23.0 (0.3 m long), between `(untagged)` [props] and `facing` [street]
  - left  `x 5.15…5.55  z -23.2…-22.8`
  - right `x 6.88…30.5  z -35…-22`
- **1.33 m** — side st south, x 34.0…34.0 (0.3 m long), between `facing` [street] and `(untagged)` [props]
  - left  `x 23…35  z -131.6…-109.9`
  - right `x 33.8…34.2  z -108.5…-108.1`
- **1.33 m** — west walk, z -65.0…-65.0 (0.3 m long), between `facing` [street] and `(untagged)` [props]
  - left  `x -24.8…-6.88  z -68…-55.5`
  - right `x -5.55…-5.15  z -65.2…-64.8`
- **1.33 m** — west walk, z -37.0…-37.0 (0.3 m long), between `facing` [street] and `(untagged)` [props]
  - left  `x -28.6…-6.88  z -37…-21`
  - right `x -5.55…-5.15  z -37.2…-36.8`
- **1.34 m** — east walk, z -57.5…-57.5 (0.3 m long), between `unmatched` and `facing` [street]
  - left  `x 5.38…5.54  z -57.6…-57.4`
  - right `x 6.88…28.6  z -68…-53`
- **1.34 m** — east walk, z -29.5…-29.5 (0.3 m long), between `unmatched` and `facing` [street]
  - left  `x 5.38…5.54  z -29.6…-29.4`
  - right `x 6.88…30.5  z -35…-22`
- **1.34 m** — west walk, z -43.5…-43.5 (0.3 m long), between `facing` [street] and `unmatched`
  - left  `x -30.5…-6.88  z -55.5…-43.5`
  - right `x -5.54…-5.38  z -43.6…-43.4`

## WITH PEOPLE — what a player meets

| band | samples | % |
|---|---|---|
| IMPASSABLE  <0.72 | 18 | 1.3% |
| URGENT  0.72–0.80 | 2 | 0.1% |
| PROBLEM 0.80–1.00 | 0 | 0.0% |
| tight   1.00–1.40 | 26 | 1.9% |
| clear ≥1.40 | 1334 | 96.7% |

Stretches under 1.40 m: **23**

- **0.25 m** — east walk, z 14.3…15.0 (1.0 m long), between `(untagged)` [street] and kerb / lane edge
  - left  `x -7…7  z 14.2…20.2`
- **0.25 m** — west walk, z 14.3…15.0 (1.0 m long), between kerb / lane edge and `(untagged)` [street]
  - right `x -7…7  z 14.2…20.2`
- **0.50 m** — west walk, z 2.8…3.0 (0.5 m long), between `(untagged)` and kerb / lane edge
  - left  `x -6.25…-5.75  z 2.7…3.2`
- **0.63 m** — east walk, z -44.8…-44.5 (0.5 m long), between `(untagged)` and `facing` [street]
  - left  `x 5.75…6.25  z -44.8…-44.3`
  - right `x 6.88…26.7  z -53…-35`
- **0.63 m** — east walk, z -13.3…-13.0 (0.5 m long), between `(untagged)` and `facing` [street]
  - left  `x 5.75…6.25  z -13.4…-12.9`
  - right `x 6.88…22.9  z -22…-9`
- **0.63 m** — west walk, z -61.0…-60.8 (0.5 m long), between `facing` [street] and `(untagged)`
  - left  `x -24.8…-6.88  z -68…-55.5`
  - right `x -6.25…-5.75  z -61.2…-60.7`
- **0.63 m** — west walk, z -28.5…-28.3 (0.5 m long), between `facing` [street] and `(untagged)`
  - left  `x -28.6…-6.88  z -37…-21`
  - right `x -6.25…-5.75  z -28.7…-28.2`
- **0.75 m** — east walk, z -77.0…-76.8 (0.5 m long), between `(untagged)` and `(untagged)` [civic]
  - left  `x 5.75…6.25  z -77…-76.5`
  - right `x 7…7.3  z -78…-68`
- **1.06 m** — side st north, x 10.5…11.8 (1.5 m long), between kerb / lane edge and `(untagged)` [street]
  - right `x 10.44…11.06  z -96.7…-96.1`
- **1.15 m** — east walk, z -35.8…-34.3 (1.8 m long), between `(untagged)` [props] and `facing` [street]
  - left  `x 5.07…5.73  z -35.9…-34.1`
  - right `x 6.88…26.7  z -53…-35`
- **1.15 m** — east walk, z -93.0…-93.0 (0.3 m long), between `(untagged)` [props] and `unmatched`
  - left  `x 5.15…5.55  z -93.2…-92.8`
  - right `x 6.7…18.4  z -94…-86`
- **1.15 m** — side st north, x 45.0…45.0 (0.3 m long), between `(untagged)` [props] and `(untagged)` [vice]
  - left  `x 44.8…45.2  z -97.9…-97.5`
  - right `x 33.45…45.45  z -96.3…-82`
- **1.20 m** — side st north, x 20.0…20.0 (0.3 m long), between `(untagged)` [props] and kerb / lane edge
  - left  `x 19.8…20.2  z -97.9…-97.5`
- **1.27 m** — side st north, x 13.5…13.5 (0.3 m long), between `(untagged)` and kerb / lane edge
  - left  `x 13.38…13.62  z -97.7…-97.5`
- **1.27 m** — side st north, x 31.5…31.5 (0.3 m long), between `(untagged)` and kerb / lane edge
  - left  `x 31.38…31.62  z -97.7…-97.5`
- **1.33 m** — east walk, z -51.0…-51.0 (0.3 m long), between `(untagged)` [props] and `facing` [street]
  - left  `x 5.15…5.55  z -51.2…-50.8`
  - right `x 6.88…26.7  z -53…-35`
- **1.33 m** — east walk, z -23.0…-23.0 (0.3 m long), between `(untagged)` [props] and `facing` [street]
  - left  `x 5.15…5.55  z -23.2…-22.8`
  - right `x 6.88…30.5  z -35…-22`
- **1.33 m** — side st south, x 34.0…34.0 (0.3 m long), between `facing` [street] and `(untagged)` [props]
  - left  `x 23…35  z -131.6…-109.9`
  - right `x 33.8…34.2  z -108.5…-108.1`

