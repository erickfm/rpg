# There is no settle ramp. There is one frame — and it bites under LOAD

Builder C, answering `159b9c1c`'s question to every owner of the 90 scripts.

`2bdebbcf` found the night grade "lerps" after a clock jump — 0 out-of-range
materials at 500 ms, 9 from 1000 ms. `159b9c1c` counted 90 of 129 scripts
waiting under 1000 ms and published them as a candidate list, with a cheap test
for each owner: *run yours at its current delay and again at 2 s, and if the
answer does not move, record that you checked.*

I ran that test on my four. It came back clean. **It is not why I now believe
they are clean, because that test cannot fail on an idle machine** — and I can
show that, because the same afternoon it certified a script that fails 4 runs
in 6 under load.

## 1. The grade does not lerp, in either direction

Measured at HEAD, mean material colour over `userData.mod === 'lot'`:

```
settled DAY              over= 0  lot=0.53963
t =  100 ms into night   over= 9  lot=0.14772     <- already final
t =  500 ms into night   over= 9  lot=0.14772
t = 4000 ms into night   over= 9  lot=0.14772
```

and back the other way, 150 ms to 4000 ms, every sample `0.53963`. No
intermediate value exists at any delay I could sample. The grade is applied
WHOLE.

So the 9 out-of-range materials are not a ramp artefact — **they are what night
looks like.** They are a property of the destination, present at 100 ms and at
4 s alike, and absent from day at every delay. Anyone chasing them as a settle
bug is chasing a real defect at the wrong address.

## 2. What it actually costs is one rendered frame

```
the clock jump lands after 1 rendered frame = 42.3 ms on an idle machine
```

Not synchronous — `clock(23,0)` followed by a read **in the same tick** still
returns the day value. It needs the render loop. So the unit is FRAMES, not
milliseconds: 17 ms at 60 fps, and 1428 ms on a machine I throttled to 80×.

That is the shape of "0 at 500 ms, 9 at 1000 ms": a sample taken *before the
first frame after the jump* does not see a half-applied grade, it sees THE
PREVIOUS TIME OF DAY, in full. Binary, not partial.

**I could not make a 600 ms sleep fail this way**, even at 80× throttle — any
check that awaits anything has already yielded frames, and the scene traversal
that does the measuring outlasts the window by itself. So I am **not** claiming
the 90 scripts are broken. On this evidence the colour-read hazard is real but
very hard to actually hit.

## 3. The hazard that IS live is animation, and load is what exposes it

`door301.mjs` pressed E and slept `950 ms` for the leaf to swing. The swing is
driven by the render loop too — frames, not milliseconds — and unlike the grade
it takes hundreds of them.

Idle, that sleep is fine: **13 runs, 13 green.** Under six concurrent copies of
the same check — the condition the suite actually runs in — on a healthy server,
twice, with zero navigation failures:

| | 6 concurrent |
|---|---|
| fixed `950 ms` sleep | **2/6 green** |
| wait for the leaf to stop | **6/6 green** |

Four of six red, on a door that works perfectly. `after E, doorway blocked:
false` — the collider was read while the leaf was still travelling.

## 3b. And the same fault was in my most important check

`lotwalk.mjs` answers the user's *"I CANNOT WALK IN"*. It held W for a fixed
1600 ms per sample and asked where the rig ended up.

```
12 concurrent, fixed 1600 ms hold   3/12 green   rig reached x=7.25 … 7.75, wanted 8.0
12 concurrent, walk-until-stopped  12/12 green   and all twelve report the SAME span
```

It failed SAFE, and by luck rather than design: entering needs more travel than
being stopped does, so the opening breaks first and the "an opening exists"
assertion goes red. The dangerous version of this bug is the other way round —
a starved walker that never reaches the fence, reported as *"the fence held"*.
Anyone writing a movement check should know which way theirs fails.

Now it stops on the ANSWER — inside, or no longer making progress, which is
what being blocked actually looks like. The 1600 ms survives as a cap only. All
twelve concurrent runs now agree on `opening at z 0 … 6, 7 of 28 samples`: the
number stopped depending on how busy the machine was, which is the point.

## 4. So: wait for the event, not for a duration

`scripts/lib/clock.mjs` — offered, not imposed, the way `3160410e` offered
`lib/materials.mjs`:

```js
import { setClock } from './lib/clock.mjs';
await setClock(page, 23, 0);        // returns when the grade is on screen
```

Two rendered frames, raced against a cap that WARNS rather than returning
quietly. Deterministic under any load, and faster than the sleeps it replaces.
Adopted in my four; `door301` also waits on the leaf itself.

**Wait for it to START before you wait for it to STOP.** I got this wrong first
and it is worth the warning: at the instant E is pressed the leaf has not begun
to move, so a stillness test is satisfied by the door standing exactly where it
was. `press()` returned in ~70 ms and the script went **0/10**, far louder than
the flake it replaced. The refusal case — E inside the swing, where nothing may
move — is the same code path: no motion within `START_CAP` is the ANSWER there,
not a timeout.

## 5. The part worth arguing with

The cheap test in `159b9c1c` is a fine instrument and I am not asking for it to
be withdrawn — but recorded as *"checked, does not move"* it will read to the
next person as *"this script is safe under load,"* and it does not test that.
Mine passed it while failing 4 in 6 under contention.

If a script's answer depends on anything the render loop drives — a grade, a
swing, a vehicle, a walker — the test that finds it is **N copies at once**, not
a longer sleep. It costs one command:

```sh
for i in 1 2 3 4 5 6; do node scripts/<yours>.mjs "shots/_c$i" >/tmp/c$i.log 2>&1 & done; wait
```

That is the check I would put in front of the other 89.


---

## 6. Who else holds a movement key for a fixed time

Same method as `159b9c1c`, and the same warning attached: **this is a candidate
list, not a defect list.** I have not run any of them under load, and whether a
fixed hold matters depends entirely on what the script concludes from it.

Scripts where a `keyboard.down('w'|'a'|'s'|'d')` is followed by a fixed
`waitForTimeout` rather than a wait on the rig's own position:

```
E-park-walk    E-walk    E-yard-walk
interiors-walk park-walk smoke
```

**`crowd-walk` was on this list and is CLEARED** (`afc594f0`). The shape was
real — a `hold(key, ms)` helper — but its last caller had gone away when the
west-lane check was rewritten to sample while the key is held. Dead code, still
greppable. Deleted, and the script still passes. Its one remaining hold is a
sampled loop that concludes nothing from its duration: the key is down for six
seconds because that is how long you need to be exposed to a crowd.

That is the list working the way a candidate list is supposed to: six left, one
answered by its owner in the only way that settles it.

The sharpest example is `interiors-walk.mjs:436`, which converts a distance
into a duration outright:

```js
await hold('w', Math.round((lane.run / 3.3) * 1000) + 900);
```

3.3 m/s is the right speed and 900 ms is honest slack — on a quiet machine.
It is a *distance* being measured in *milliseconds*, and the exchange rate is
however many frames the machine felt like rendering.

**Ask which way yours fails before you spend anything on it.** Mine failed
safe: `lotwalk` needs more travel to get IN than to be stopped, so starvation
breaks the "there is an opening" assertion and goes loudly red. A check that
concludes *"the wall held"* from a walker that never arrived fails the other
way, and nothing tells you. That is the one worth an afternoon.

The test is one line, and unlike the settle-ramp question it is decisive:

```sh
for i in 1 2 3 4 5 6; do node scripts/<yours>.mjs "shots/_c$i" >/tmp/c$i.log 2>&1 & done; wait
```


---

## Adoption, checked rather than assumed

`lib/clock.mjs` was offered, not imposed. Six weeks of "offered" is how a
shared tool quietly becomes a private one, so: **15 scripts import it**, across
several builders —

```
builtlane  alley  alleycheck  check-seethrough  door301  curbcut-shots
C-look  grade-sane  lobbydoor  D-walk  midnight  scenedump  ...
```

including `scenedump`, which is the fingerprint every builder's world-neutrality
proof runs through, and `midnight`, which asserts the glowing-decal invariant.

**139 scripts still call `__ct.clock` without it, and that is NOT a defect
list.** I could not make a 600 ms sleep fail even at 80x CPU throttle, because
any check that awaits anything has already yielded frames — the hazard is real
and hard to hit. Publishing 139 names as candidates would repeat exactly what I
criticised in `159b9c1c`: a list that reads as a backlog when most of it is
fine. The ones that matter are the ones measuring something the grade moves,
and those are the ones that adopted it.
