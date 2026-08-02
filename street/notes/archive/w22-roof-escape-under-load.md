# w22 — item 46: 27 throttled roof exits, and what w21 actually saw

Port **4186** (dev). The first thing this item needed was a `git merge` — see
the last section.

## Verdict

**The trap did not reproduce.** 27 roof exits under CPU throttle, all four
directions, at 2x, 3x and 4x — every one escaped and every one could still walk
afterwards. Taking the item's second branch: clean runs, diagnostic stays in.

**And w21's hypothesis is structurally real but is not a trap**, which I think is
the more useful half. Explained below.

## What "stuck" has to mean

w21's probe reported `STUCK left 1.50 -> 1.50 at -3.02,-30.52` — the player did
not leave the roof *in that one direction* inside its window. That is a blocked
EDGE, not a trapped player: the roof is 2.10 x 1.47 m with four open sides, and
a player who can leave by any of them is not stuck.

So `scripts/probes/w22-roof-escape.mjs` splits the two questions and only calls
the second one stuck:

1. climb pavement → bed → rail → roof **by the real route** (a warp onto the
   roof cannot reproduce a bug in how you arrive), then walk off in one named
   direction;
2. **then try to move again, all four ways, from wherever you landed.** Free if
   any of them displaces you more than 0.35 m.

Step 2 is the one that matters and it is not in w21's script. Coming off the two
flanks is a 1.5 m drop into the gap between a vehicle collider and a raised
kerb, which is the shape of every trap this project has shipped — "off the roof"
is not the same as "free".

## The runs

| throttle | exits measured | escaped |
|---|---|---|
| 4x | 3 + 3 + 1 | 7/7 |
| 3x | 12 | 12/12 |
| 2x | 7 | 7/7 |
| **total** | **27** | **27/27** |

Every direction ≥ 5 runs. Displacement after landing was 0.99–1.81 m, never
marginal. Strafe `d` consistently lands at feet 0.14 and `a` at 0.00 — the kerb
and the road respectively, so both flanks really were covered and not the same
side twice. (The probe now names the directions by key and world axis. My first
draft called them "left" and "right", which are relative to a yaw the probe
computes, and were the wrong way round.)

## The climb is what is flaky under load, not the roof

Of 36 climb attempts that failed, the breakdown by rung:

```
onto the bed 52    onto the rail 1    onto the roof 39
```

Never once did a surface hold the player at the wrong height — the failures are
missed hops, the input arriving on the wrong side of a long frame. That is w21's
own measurement of the first hop (7/8 with **no** throttle) getting worse as the
frames get longer, and BUILDER-BRIEF §5's keydown problem in its movement form.

**This is a real playability observation, not just an instrument one:** at 4x a
player needs several attempts to get onto the truck bed. It is not a trap and it
is not item 46, so I have not touched it — but "the truck is hard to climb on a
loaded machine" is a thing the user would notice.

## w21's hypothesis, tested

> *"every collider in the world except this truck's four is still a wall at
> every height, and `ct/traffic.ts` drives vehicle boxes down exactly that lane,
> so my best hypothesis is a passing vehicle blocking at roof height. I did not
> prove it."*

**The first half is true.** `grep maxY src/proto/ct/traffic.ts` returns nothing,
and `fp.ts:12` is explicit: *"a collider with `maxY` undefined is still a wall"*.
So any moving box that reaches the roof's footprint blocks a player standing on
it, 1.5 m up, with nothing drawn at his eye level to explain it.

**The second half I could not observe.** Reproducing it through the keyboard
needs a vehicle in the right place during an 1800 ms window, which is why it took
four loaded climbs to see once. The colliders answer the same question every
frame, so `scripts/probes/w22-traffic-at-roof-height.mjs` asks them directly:
the smallest gap between any *moving, uncapped* box and the roof footprint grown
by the 0.36 m capsule.

```
2347 frames watched, 7 boxes had moved by the end
closest a moving wall came to the roof's standing area: 0.418 m
  nearest box: x -6.25..-5.75  z -28.76..-28.26
frames where one REACHED it: 0
```

Two things worth having from that. Nothing reached it in 2347 frames — and the
closest thing to the roof is not a car in the lane at all. It is a **0.5 x 0.5 m
box on the pavement**, person-sized, 0.42 m from blocking. If this ever recurs,
a citizen walking past is a likelier culprit than traffic, and 0.42 m is not much
margin.

But even confirmed it would block **one edge while the thing is alongside**. The
other three stay open, which is why 27 exits found no trap and why w21 saw a
one-direction miss rather than a player who could not get down.

---

## Found and NOT fixed

### 1. `scripts/w21-roof-climb.mjs` is not a guard — nothing runs it

The item says the diagnostic should "stay in as a guard". It stays in, but it
guards nothing: it is **not registered in `scripts/checks.mjs`**, and nothing
else calls it either — the only references anywhere are its own usage line, two
notes, and my probes. It runs when somebody remembers, which for a trap bug is
the same as not running.

That is the class `checks.mjs` documents against itself twice ("ASSERTED WITHOUT
AN EXIT CODE until now"; "Asserted since it was written and registered nowhere").
It exits 0/1 properly, so it only needs the row. `checks.mjs` is not this item's
file, so:

```js
['w21-roof-climb', 'can you climb onto the truck and get back down?', false, [], true],
```

SLOW tier (`true` at the end) — it walks the whole route up to three times.
DONE WHEN: `node scripts/checks.mjs --slow` lists it, and it goes red if
`pickup-cab-roof`'s `maxY` is edited.

### 2. It only ever leaves the roof forwards

`w21-roof-climb.mjs` step 4 is `hold('w', 620)` onto the hood and then off the
nose. Three of the four ways off the roof are unguarded by the thing that is
meant to be the acceptance test. The assertion to fold in is
`scripts/probes/w22-roof-escape.mjs`'s — walk off, then prove you can still move
— and its `canMove()` is written to be lifted as-is.

### 3. Traffic and citizen colliders are walls at every height

Not a trap today (measured above), but the reason w21's report was plausible and
the reason it may recur. A player standing on the only non-floor surface in the
world can be stopped in mid-air by a car or a pedestrian whose box has no top.
The fix is the same opt-in `maxY` the truck's four surfaces already use, applied
to vehicle and citizen boxes — `ct/traffic.ts`, `ct/crowd.ts`, and the parked
fleet in `crosstown.ts`. Whoever takes it should check `w22-traffic-at-roof-height.mjs`
still reports 0 reaching frames afterwards, and that `spots-walk`/`gaps` do not
change: capping a car's height changes what blocks a player on the STREET too,
which is a much bigger blast radius than this item.

### 4. Climbing the bed is unreliable under load

52 failed first hops across this session. Reported in case it is worth tuning
the bed rail or the tailgate step; it is a feel issue, not a trap.

---

## The thing that nearly cost this item

**My worktree could not see the subject at all.** `scripts/w21-roof-climb.mjs`
did not exist in it and neither did the cab roof, because the worktree was cut
before that work landed and does not move on its own. `notes/BLOCKED-w19.md`
records another builder hitting exactly this and releasing two items — correctly
proving it by standing on six cars, and still wrong about the world.

`git merge --no-edit add-stick-and-city98` between items, which the BUILDER-BRIEF
now requires, brought in the roof, the diagnostic, and 727 files besides. The
merge conflicted in `scripts/canfail.mjs`, where mainline and I had independently
fixed the same false `RESTORE FAILED` — resolved by keeping mainline's account of
the cost and my stronger assertion (a byte digest of each file taken before the
run, rather than re-reading the needles), plus mainline's naming of which case
last held the pen. Verified after resolving: `./scripts/guards.sh footprint`
still CAUGHT and still restored byte-for-byte.
