# The crossing pile-up: people now walk round things

The user: *"pedestrians pile up and get stuck at the crossing… the walk logic
should allow people to walk around things."* That is the fix, and it went in
where they said it should — in the giving-way rule, not in the crossing.

Watched, not screenshotted, as instructed: four separate 60-second runs with the
player stood at the junction, sampling every walker ten times a second.

## What was actually happening

The desk's three checks, each answered with a measurement.

**(1) One crossing node they all target — yes, and worse than that.** There are
exactly two crossings (`ct/crowd-net.ts:139-150`), each a single edge between a
single pair of nodes. But the pinch is not the crossing's middle, it is its
ENDS: **the crossings begin and end on nodes where people deliberately stand
still.** `n-bodega` is a `door` — hesitate 4–8 s — and is also the side-street
crossing's endpoint. `n-corner` and `w-corner` are the main crossing's two ends
and are `corner` acts — pause 1.5–4 s at the kerb. Measured over one minute:
walkers were parked ON a crossing endpoint for 110 samples, 74 of them on
`n-bodega`. So the way onto the crossing is through somebody's errand.

**(2) Does a blocked walker have any behaviour but stopping — no.** Two
compounding faults in `ct/crowd.ts`:

- A *parked* walker read as a head-on meeting. The old test was
  `headOn || theirs <= 1e-4`, and somebody standing at a window has
  `theirs = 0`, so the giving-way rule fired against furniture. One of the pair
  stood for as long as the other's errand lasted, and whoever came up behind
  THEM stood too. That is the pile-up, and six citizens and two errands is all
  it takes to build one.
- **The escape hatch was in a branch the stuck walker never reached.** There
  was already a "blocked too long, re-plan" at the old line 418 — inside
  `if (!placed)`. A held walker sets `step = 0`, so its very first candidate
  offset (its own current position) is clear, `placed` goes true, and the
  re-plan never ran. Its jam timer counted up the whole time.

  The number: **one walker spent 29.8 s of a 60 s minute stuck, and another
  12.1 s** — with `placed` true on every one of those frames.

- And re-planning would not have helped anyway. It cleared the route and ran
  Dijkstra over an unchanged graph, which returns the same path through the same
  blockage. A walker that gives up and re-plans walks back into what stopped it.

**(3) Does the depenetration apply here — yes, already.** `unstick(c, dt)` is
called unconditionally, outside the `moving` branch, so it runs at the crossing
like everywhere else. Nothing needed doing; I checked rather than assumed.

## What changed

`ct/crowd.ts`

- **A parked walker is an obstacle, not a negotiating partner.** If
  `ahead.wait > 0` we neither hold nor follow, and fall through to the lateral
  offset search — which was always the "go round it" manoeuvre, it just was
  never reached.
- **Jam measures progress, not circumstance.** It used to count any frame with
  somebody ahead, which counted a perfectly good follow at matched pace as a
  jam. It now counts frames that actually got nowhere, and so it is reachable
  from the held branch.
- **An escalation, not one rule:** give way for 1.0 s → stop giving way and try
  to step round → at 2.0 s take a different path. The last two used to be the
  same threshold, which would reroute a walker on the very frame it first tried
  the cheap fix.
- **`reroute()`** strikes the unreachable node out of the graph *for that
  walker* and re-routes the SAME destination round it. Where there is no way
  round, it drops the errand and picks another — motion beats waiting.

`ct/crowd-net.ts`

- `route(from, to, avoid?)` — nodes in `avoid` are unavailable, except the two
  ends, since refusing to route to where you are going is not an alternative
  route.
- **The crossings have width.** `halfOf(a, b)` gives a crossing 1.3 m either
  side against a walk's 0.55, so the offset search spreads people into lanes
  across it — three abreast at the 0.9 m a walker occupies. It is a lateral
  allowance rather than extra nodes on purpose: the ramp in the kerb is at ONE
  place (`ct/tex-ground.ts` flags KRAMP on the bodega corner return only), so
  the ends must stay put even though the middle spreads.

## Measured after

| | before | after |
|---|---|---|
| worst jam, per walker over 60 s | **29.8 s**, 12.1 s | **0.0 s — all six** |
| walkers reaching the junction at once | 1 | 2 |
| metres walked by the crowd per minute | 334 | 361 |
| samples off the walk (roadway, away from the crossing) | — | **0 of 3090** |

## What I did NOT prove, and it matters

**I never reproduced a visible pile-up.** Across four minutes of watching, the
most walkers at the junction at once was two, and **street transits were 0 both
before and after** — with six citizens, 85% of trips inside a 26 m radius and
5–25 s errands, nobody crossed the street in any minute I watched. So the
throughput numbers above are not evidence about the crossing, and I am not
claiming them as such.

What IS evidence: the 29.8 s stall is real, measured, and its mechanism runs
exactly through the crossing endpoints (74 parked samples on `n-bodega`). I
believe that is what the user saw. If the pile-up is still there, the thing to
tell me is roughly how many people and where they were facing — that would say
whether it is this mechanism at a bigger crowd size or a second one.

Two honest limits on the checks:

- The reroute helps a minority of trips by construction. Striking out the next
  node leaves an alternative for **223 of 600** node pairs; **325 are genuine
  dead ends** because the walkable graph is one cycle (the junction block) plus
  two long spurs running north into the fog — `w-fog` and `e-fog` are degree 1.
  That is the real street, not a bug: on a spur there is no way round, which is
  why the LATERAL go-round is doing most of the work here and the reroute is
  the backstop. Checked with a scratch vitest run, deleted after — no harness
  committed.
- My first off-the-walk check reported 2589 violations. **The check was wrong,
  not the world:** I had assumed `ROAD_HALF = 7` and it is 5.0, so the walk
  centre lines at x = ±6.0 counted as roadway. Re-run against the world's own
  constant it is 0 — and the wrong run is a fair positive control that the
  detector fires when the predicate is met (GOTCHAS 34).

## Per-side, since it is now the house rule

Not applicable in the mirroring sense — there is no mirrored construction here.
But the crossing has two ends and I checked them separately rather than
checking one: `n-bodega`, `n-corner` and `w-corner` all showed parked walkers
(74, 18, 18 samples); `s-win1` showed none in that minute. All four are
endpoints of the same two edges, and the fix is at the walker, not the node, so
it covers the one that happened not to be occupied while I watched.
