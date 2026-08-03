# Item 173 — what I settled, and why I handed it back

Worker sixtynine. **RELEASED UNFINISHED, deliberately.** Everything below is
measured; the behaviour change is not written. Read this before you start —
it removes both of the item's leads and it changes what the repro has to do.

---

## LEAD 1 IS WRONG. Moving vehicles ARE in `citAvoid`.

The item says:

> `ct/crowd.ts:21–26` documents `citAvoid` as *"solid props people steer AROUND
> — trees, lamps, **parked cars**"*. **The car in his screenshot is a TAXI IN
> THE ROADWAY, and the word in the code is *parked*.**

**It is a stale comment, not a stale list.** `crosstown.ts:615`:

```ts
vehicleBox: (b) => { vehicleBoxes.push(b); citAvoid.push(b); actorBoxes.add(b); return b; },
```

`ct/traffic.ts:236` takes one `vehicleBox` per car in the fleet and
`ct/traffic.ts:308` rewrites its extents from `v.obj.position` every frame. So
every moving vehicle is in `citAvoid` and tracks itself. The crowd can see the
taxi. **Do not spend an hour re-plumbing this.**

(The comment at `crowd.ts:21` does say *"and the moving cruiser's box, which
follows it"* two lines later, so it contradicts itself rather than lying.)

## LEAD 2 IS REAL BUT IT IS NOT THE WHOLE STORY

`crowd.ts:297-307` and `unstick` do exist and they handle **being INSIDE a
box**: `escapeFrom` returns `null` for a point outside the AABB
(`crowd.ts:333`), so a citizen standing *beside* a car pushes nowhere, `px` and
`pz` stay 0, and `unstick` records the position as **legal** and resets
`stuckT`. Nothing recovers a walker that is merely walled in.

## THE MECHANISM, AND IT IS ONE LINE

**Nothing in this file can ever move a citizen backwards.** The whole placement
loop is `crowd.ts:611-624`, and every candidate it tries is

```ts
const nt = t + step;          // crowd.ts:614
```

with `step = held ? 0 : min(c.sp, follow || c.sp) * dt`, which is never
negative. The seven candidates vary the LATERAL offset only. So when a car
covers the edge ahead and the walk is too narrow to go round, a citizen has
exactly two outcomes available to it: stand (`placed` false, `vx = vz = 0`), or
after `JAM_GIVE_UP = 2.0 s`, `reroute` — which picks a different path but starts
it **from where the citizen is standing**, so if the car still covers that spot
the new route's first step is blocked too.

**That is why the user's word is *"back up"* and why nothing does it.** The
deliverable is a negative `nt`, gated and hysteretic, not a better `unstick`.

## THE PIN DOES NOT REPRODUCE IN ORDINARY TRAFFIC — measured

`scripts/probes/w69-car-pins-citizen.mjs`, 100 s of the shipped world on the
built bundle, sampling all six walkers and every actor box every 200 ms:

```
470 samples, a vehicle was on the block in 194 of them (41%)

walker  maxJam   maxJam-beside-a-car   frames beside a car   metres walked
   0    0.03s          0.00s                   0                118.1 m
   1    0.02s          0.00s                   2                124.1 m
   2    0.00s          0.00s                   0                 60.2 m
   3    0.02s          0.00s                   3                 79.3 m
   4    0.02s          0.00s                   9                 98.5 m
   5    0.00s          0.00s                   3                 83.8 m
```

**Nobody jammed for more than 0.03 s, and the maximum time any walker spent
within 2.2 m of a vehicle at all was 9 samples — 1.8 s.** A car doing 8.5 m/s
crosses a walker's neighbourhood far faster than the walker needs to react, so
the *passing* case is not the bug.

**So the repro the item asks for has to make the car STOP.** `ct/traffic.ts`'s
`Vehicle` carries `dwell` and `served` — the taxi halts at the kerb to pick up.
A halted vehicle box beside a walker is the user's screenshot, and it is rare by
coincidence, which is exactly why he has reported it twice and why it will be
reported a third time if it is fixed by eye. **Drive the dwell deterministically
rather than waiting for it.**

Note for whoever writes that: **you cannot plant a box.** `__ct.citAvoid()`
returns a mapped copy (`crosstown.ts:1765`) so a pushed AABB lands in an array
nobody reads — GOTCHAS 74's exact shape, which has already disarmed a check's
selftest in this repo. Reach the real vehicle through `ct/traffic.ts` instead.

## What the recovery rule has to satisfy, from what is already in the file

- **It may not push anyone into the roadway.** `escapeFrom`'s `line`-weighted
  scoring (`crowd.ts:311-359`) exists because the plain minimum translation out
  of a kerbside car is roadward about half the time. A backward step needs the
  same "stay near the walk line" cost, not a raw `-step`.
- **It may not oscillate.** `c.pick` is sticky (`crowd.ts:598-603`) precisely
  because re-deriving the choice every frame is what made walkers step
  back and forth. Backing up must latch the same way — and it must not
  alternate with the forward step the moment the car's box clears by a
  centimetre.
- **The 2 m sidewalk lane is sacred**, and a citizen shoved out of the way must
  not end up standing in it.
- `unstick`'s `PATIENCE = 1.2 s` and the placement loop's `JAM_GIVE_UP = 2.0 s`
  are two different timers on the same symptom. Whatever you add is a third
  unless you fold it into one of them.

## Why I stopped here

The diagnosis is settled and the repro is not, and `ct/crowd.ts` steering is the
wrong file to leave half-changed — the two comment blocks at `:545-562` and
`:625-644` are both records of a symmetric or under-gated rule making the
problem worse rather than better. A backward step written without a repro that
can fail would be the third one.
