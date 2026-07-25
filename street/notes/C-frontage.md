# The 2 m walk past the car lot — measured, and it is not mine

`scripts/lot-frontage.mjs`. Written because I have been asserting GOTCHAS §9
compliance from geometry — *"everything this module builds is at x ≥ 7.18 and
the walk ends at x = 7"* — which is an argument, not a measurement, and is
exactly the class of claim this project keeps disproving.

## Method, and the mistake in the first version

At each z along the lot's frontage, scan the walk from kerb to building line
and find the widest continuous band the rig can stand in, against the same
collider array the movement code tests.

That measures valid **centres**, not pavement width: a 0.36 m rig on a
perfectly clear 2.00 m walk can only put its centre in the middle 1.28 m,
because the kerb edge and the building line each cost it R. My first run
invented an absolute threshold of 2.00 m and duly failed 61 of 93 samples —
calling 1.30 m a defect when 1.30 m is roughly what clear looks like.

A **control** fixes it: the same metric over a stretch of the same east walk
with no lot on it. Whatever that reads is what this world calls unobstructed.

```
control  east walk z -40 … -20, no lot:   median band 1.54 m
lot      frontage z  -9.0 … 14.2:         1.30 m over most of it
```

## What the 0.24 m is, and whose

The script now names whatever overlaps the walk, so the finding routes itself:

| overlap | reaches in | whose |
|---|---|---|
| `x 6.64…7.00, z −8.70…−2.04` | **0.36 m** | `ct/street.ts` `openSite` — the low boundary wall |
| `x 6.64…7.00, z 7.24…13.90` | **0.36 m** | the same wall, other run |
| `x 5.17…5.53, z −6.18…−5.82` | 1.83 m | a hydrant, out by the kerb |
| `x 5.58…5.74, z −1.62…−1.38` | 1.42 m | a post, out by the kerb |
| `x 6.88…22.90, z −22…−9` | 0.12 m | the building south of the lot |
| `x −7…7, z 14.20…20.20` | — | the block north; the lot's edge abuts it |

**Not one of them is mine.** Everything `ct/lot.ts` builds is at x ≥ 7.18 —
now measured rather than argued.

## CLOSED — D fixed it, and the same measurement confirms it

`5be75c19` moved the boundary wall onto the site's own land. Re-measured with
the script that found it, no changes to the script:

| | before | after |
|---|---|---|
| samples narrower than control | **61 of 93** | **9 of 93** |
| the wall in the overlap list | twice, 0.36 m each | **gone** |

What is left at 9 samples is the hydrant (0.76 m) and the street tree
(0.54 m), both kerb-side furniture and both legitimate — see the section at
the end. 0.54 m of valid centre band is 1.26 m of actual clear pavement, which
walks fine.

The original routing follows, kept because the reasoning is what made it
fixable.

## For D, and it applies to E as well

`openSite` builds a 0.36 m low wall at `XB − side * 0.18` and registers it
solid, so **0.36 m of the 2.00 m walk is inside the site's boundary wall** for
the whole length of both runs. That leaves 1.64 m of pavement past the lot.

Whether that is acceptable is D's call — a boundary wall on the street line is
a real thing and the site should have an edge. But two things make it worth
raising rather than shrugging at:

1. **`GOTCHAS.md` §9 calls the 2 m lane sacred**, and this is 18% of it, taken
   the whole way along rather than at one prop.
2. **The park shares the helper.** `PARK = openSite(-1, …)` and
   `LOT = openSite(1, …)` — so the same 0.36 m is being taken off the west walk
   in front of E's park, and neither of us built it or would find it by
   looking at our own files.

The cheap fix, if it is wanted, is to hang the wall on the site side of the
line rather than straddling it: `XB + side * 0.18` and a collider from `XB` to
`XB + side * 0.36`. That keeps the edge and gives the walk its 2 m back.

I have not touched `ct/street.ts`.


---

## The 0.16 × 0.24 post nobody has taken is a STREET TREE

`667eec50` closed the lamp cluster with one constant and says the tightest
point in the world is now 0.90 m on the west walk at z −71.4, caused by *"the
0.16 × 0.24 m sign/meter post at x ±5.66, which Round 3 listed as its own row
and nobody has [taken]"*.

My frontage sweep found the same signature on the EAST walk, at
`x 5.58…5.74, z −1.62…−1.38` — same 0.16 × 0.24, same |x| 5.66. So I looked at
mine before anyone writes a ticket for it.

**It is a tree.** Searching by mesh origin found only two flat ground decals
and no post — which is the trap that hid the lobby door from me once already,
so I redid it by world bounding box. One mesh covers that collider: a
billboarded 3 × 4.5 m plane standing 0.14 → 4.64 m, at the kerb. A tree crown
on a trunk, and the trunk is the collider.

`shots/curbcut/06-along-walk-s.png` shows it plainly: a street tree in a square
pit, kerb side, with the walk running past it between the tree and the site
wall.

**So it is not a defect and should not be removed.** A street tree in a pit is
furniture doing its job, and it is on the KERB side — it takes its 0.16 m from
the gutter end of the walk, not from the building line. It is also, by some
distance, the thing that most makes this block feel like a street.

Two caveats, because this is exactly where I have been wrong before:

- **I verified the EAST instance, at z −1.5.** The auditor's is the west walk
  at z −71.4. Same collider signature and almost certainly the same prop, but
  that is an inference and they should confirm it on their own instance before
  closing the row.
- The genuine §9 question on this stretch is not the tree. It is the **0.36 m
  `openSite` boundary wall** above, which takes its share off the BUILDING line
  and runs the whole length of both sites rather than standing at one point.


---

# Floaters: the lot has none, and every hit is furniture that hangs

`a23915b6` found two price cards resting on nothing — an object placed at a y
somebody typed rather than at the top of what it sits on, right when written
and wrong the moment the shelf moved. `scripts/floaters-walk.mjs` was
interiors-only (`if (w.x < 400) return`).

That check is not interior-specific. An exterior prop sits on ground that OTHER
builders move — this lot's site has changed depth, changed boundary wall and
had its kerb broken since those props were placed — which is if anything the
likelier way a typed y goes stale. So the script now takes an optional box and
defaults to exactly what it did before:

```
node scripts/floaters-walk.mjs 6 32 -12 16      # the car lot
```

**Thirteen hits, and all thirteen are supposed to hang.** I identified every
class rather than eyeballing the list, because "they all look like signage" is
the reasoning that has been wrong twice this week:

| gap | what it is |
|---|---|
| 5.90, 5.81 | the floodlight head and its lens, 6 m up a pole |
| 1.47, 1.33 | balloons on car antennas — the rod, the sphere, the string |
| 1.26 × 8 | the barbed arms on the fence posts, at MESH_TOP + 0.18 |
| 1.20 | the office AC unit's bracket, through the wall |

Nothing in the lot is a prop that should be resting on something and is not.
Recorded rather than left unsaid, because "I ran it and it was fine" is worth
nothing without the list.

## And the walk-up, same check, same answer

```
node scripts/floaters-walk.mjs 195 210 -25 -5      # the walk-up
```

Eleven hits, all of them things that hang from something rather than rest on
it: the four hall ceiling lamps at z −16.5, the three landing lamps over the
turn at z −8.85, 301's ceiling lamp, its poster on the north wall, and 301's
door — the leaf at 6.45 and its upper hinge at 7.18, both carried on the jamb.

Both my modules are clean on this check, and it is worth having run precisely
because neither of them was the one that had the bug.
