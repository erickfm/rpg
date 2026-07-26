# The cars are not clipping — and why two builders got opposite answers

Builder I, 2026-07-25. Second item on my queue: *"make sure none of the cars in
the lot are clipping into each other"*, reported twice.

Two published measurements contradicted each other, both in the ledger:

| | | |
|---|---|---|
| **C** | *"closest pair 0.422 m — no car overlaps another"* | oriented boxes, SAT |
| **H** | *"every neighbour overlaps by 1.23–1.70 m"* | extent along world x |

A contradiction in the record is worse than either answer alone, because the
next person quotes whichever they read first. So `scripts/I-clip.mjs` computes
**both numbers for the same pairs in one run**, and neither builder has to be
taken on trust.

## Part 1 — they were measuring different boxes. Both numbers reproduce.

```
     pair                          AABB overlap      oriented-box gap
     (10.3,8.6) - (12.9,8.6)       overlap 1.08 m      clear 0.42 m
     (12.9,8.6) - (15.7,8.6)       overlap 1.10 m      clear 0.42 m
     (15.7,8.6) - (18.3,8.6)       overlap 1.10 m      clear 0.42 m
     (17.0,-3.4) - (19.7,-3.4)     overlap 1.37 m      clear 0.42 m
     (19.7,-3.4) - (22.4,-3.4)     overlap 1.38 m      clear 0.42 m
     ...
  7 neighbouring pairs overlap as AXIS-ALIGNED boxes
  Closest pair as ORIENTED boxes: 0.422 m
```

H's figure is **real and correctly computed** — it is the width of an
axis-aligned box drawn round a raked car (`len·|sin θ| + wid·|cos θ|`) against
the 2.7 m row pitch. My run gets 1.07–1.38 m where H got 1.23–1.70 m, the same
phenomenon at the same magnitude.

**It is also not what the user asked about.** Two cars parked in echelon overlap
in their axis-aligned boxes while being nowhere near touching — that is what
angled parking *is*. The oriented box is the car; every pair is clear by
0.422 m, which is inside the user's own stated "30 to 60 cm is authentic".

So: **C's answer is the right one, H's number is not wrong, and the disagreement
was never about the world.** Neither builder made a mistake worth correcting;
what was missing was one instrument that printed both columns.

## Part 2 — the gap neither of them tested

`lot-clearance.mjs` is a good check with two structural blind spots, both in its
own source:

- it only ever compares objects whose `mod` is `'lot'`;
- it drops any fixture whose base is above **1.4 m** (`if (bb.min.y > 1.4) return`).

So two whole classes of clip cannot reach it:

1. **A car against another module's geometry.** Not hypothetical — `ce8837e12`
   records a bay coming within **1 cm** of the frontage furniture after a merge
   widened the fleet. That was found by hand, and nothing has guarded it since.
2. **The tall dressing.** A balloon rides at ~1.85 m, above the cut, so a balloon
   through a banner or through the bunting is never looked at.

`I-clip.mjs` part 2 takes each car as a full **3D oriented box, dressing
included**, and tests it against **every solid mesh in the world** — every
module, every height, 5174 of them:

```
  car against the rest of the world (every module, every height):
     closest approach 0.290 m, to a 'lot' mesh, car at (10.3, 8.6)
  no car overlaps another car, or anything else in the world.
```

Clear. The frontage risk that bit once is now measured rather than remembered.

## Seen, not only computed

`shots/I-d-mid-right.png` — mid-aisle, broadside to the north row, which holds
the tightest pair in the lot. There is visible daylight between every pair of
cars; you can read the deck between them.

## Both checks can fail — proved

`I-clip --selftest` drives the street-most car 3 m into the frontage and the
check goes red on it, exit 1, naming the fence meshes it entered and by how much
(0.208–1.607 m). `I-rows --selftest` turns the south row 180°.

Both are now registered in `scripts/checks.mjs` and green in the full suite.
`lot-clearance` stays exactly as it is — this is additive, not a replacement.

## Two defects in the harness, filed rather than fixed

**1. `checks-registered.mjs` cannot see a check that uses the shared `flags()`
helper.** It greps for the literal `argv.includes('--selftest')`, so any script
using `lib/args.mjs` — which is the newer, better-behaved way, and what
`lot-clearance` itself uses — is invisible to it. It reported "every
self-testing script is registered" while both of mine were unregistered. I
registered them by hand; the guard did not ask me to. Not my file.

**2. Port 4190, the one the desk assigned me, cannot run `npm run checks`.**
4190 is ManageSieve and sits on the WHATWG **bad-ports list**, so node's `fetch`
refuses it outright:

```
  4189 ok-for-fetch
  4190 BAD PORT (fetch refuses)      <- mine
  4191 ok-for-fetch
```

`checks.mjs` pre-flights the URL with `fetch` and reports `NOTHING IS SERVING
http://localhost:4190/ (TypeError)` — the "dead server" path — while `curl`
returns 200 and every individual check runs fine, because Playwright is not
affected. It looks exactly like a dead server and is not one.

**I have moved my worktree to 4191** and everything above was run there.
**Desk: 4190 should be reassigned in `notes/queues/I-lot.md`**, or the next agent
handed this port loses an afternoon to it.

## What I did not touch

`ct/lot.ts` is unchanged by this item too. The world was already right; the
commit is the proof and the guard.
