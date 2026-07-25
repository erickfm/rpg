# B: every item in my queue is landed — evidence for the desk to tick

`notes/queues/B-ground.md` has been byte-identical (md5 `b5f65064`, mtime
2026-07-24 23:30) for more than eighty rounds. Its **Now** and **Next** sections
are still all `- [ ]`. I re-read the file rather than the checksum this round,
and every one of those items is delivered. The boxes are unticked; the work is
not undone.

The desk writes that file and I do not edit it, so this is the evidence, one
line per item, for whoever ticks them.

| Queue item | Evidence |
|---|---|
| Bench pass four — bezel eating the ad, legs | `bus bench`: "the ad is FRAMED by a four-sided bezel, not clipped by it"; "leg tops are BURIED in the slat — coplanar with nothing". Mutation `bus-bench` |
| Bench pass three — lower slats, bezel | superseded by pass four, same check |
| **Side street has no lamps — H is blocked on you** | `glow probe`: "side street: under a lamp 1.0000 vs mid-block 0.0791 — 12.6x (9/58 samples)". 21 lamps paired of 21 stamped. **H's blocker is clear** |
| Puddles: stop and simplify (fourth attempt) | `wetness probe` green on all eight verdicts, 11 pools |
| Milk crate clipping into the shopfront | `footprint`: "no litter is inside a building or a prop (0)" |
| TONY'S PIZZA onto the bench BACK, recline it | `props.ts:1799` `adPlate.userData.benchAd`, on `backGrp`; `props.ts:1804` `backGrp.rotation.z = -RECLINE` |
| Night: wider beams, darker darks, and STARS | star dome at `props.ts:2434`, clear nights only; beams measured at 13.7x main street, 12.6x side street |
| Tree pits need clearance; puddles belong IN the gutter | 0.218 m of walk between kerb chamfer and pit edge, same at all 7 pits; 9 sheets each 0.22 m in from the kerb line, inside the 0.45 m pan. Four mutations |
| Litter clips into the kerb | `footprint`: "nothing straddles the kerb line (0)" |
| Ship the approved trash set, take the rig down | `trash probe`: all five approved types present, "nothing unapproved has crept in", "the rejected banded rectangle is still gone (0)" |
| The catch basin looks bad | `basin probe`: both basins, casting is geometry not a decal, grate sunk, surround proud. Mutations `basin`, `basin-west` |
| Bus bench backwards and nowhere near the stop | `bus bench` + `bus walk`, the walk located from the bench's own stamp rather than a constant |
| Finish the puddle fix — contrast inversion | `wetness`: "standing water is darker than the road it sits on, wet AND dry", 21.1 levels darker |
| Move `[E]` spots out of `crosstown.ts` | marked VOID in the queue itself, line 88 |

## So my queue is empty

Not blocked — empty. Everything still open on my side needs somebody else:

- **`lamplight.mjs` and `parking.mjs`** can exit 0 having asserted nothing. Two
  lines each, exact fix in `BLOCKED-B.md`, verified against their real mode
  lists. `no-silent-pass` is red until they land, correctly.
- **Road centre lines stay dry in rain** — unstamped mesh, 8x32 texture, not
  mine.
- **Five scripts hold the stale rain constant** — `check`, `bugsweep`
  (`npm run sweep`), `verify3`, `rain-check`, `v5`.
- **A `'light'` kind for `SurfaceKind`** — A's call, `ct/paint.ts`.

## What I did with the rounds where the queue did not move

Taken from my own findings and the user's inbox rather than invented. The last
stretch was one class of defect, found by mistyping my own script name:

**A check can pass because it found nothing to check** (now GOTCHAS 34). Five of
my scripts exited 0 on an unrecognised mode word, running no branch at all.
Four more — `footprint`, `glow`, `grade-sane`, `wetness` — passed over an empty
or collapsed population, because an absence is free when there is nothing to be
absent from. `footprint` reported every tree-pit clearance verdict green with
**zero pits found** and the pits still standing in the street.

All ten of my checks are now watched against an empty population rather than
argued about, with four blinding mutations (`footprint-blind`, `glow-blind`,
`wet-blind`, and `grade-twice` for the ceiling) that break the CHECK'S VIEW
while leaving the world intact — a shape `canfail` could not previously express,
because every existing case breaks the world and asks whether the check notices.

Three things I got wrong in that stretch and corrected in place: a confirmation
I published that compared tints across two different textures; `truck.mjs`
routed as an offender when it is a photo tool with no verdicts to lose; and the
claim in GOTCHAS 34 that positive verdicts are immune, which held for `bus` and
not for `wetness`.
