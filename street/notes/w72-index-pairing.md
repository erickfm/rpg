# w72 — the compare-by-array-index pattern in the three remaining sites

Item 209. Port **4280**, `vite preview` over `dist/` (the BUILT bundle, GOTCHAS
28), aimed with `SHOT_URL` on every run. Worktree reset from the initial commit
first — GOTCHAS 54, fourteen for fourteen now.

## What changed

All three sites sampled a BOX of the world into a flat array and compared
`a[i]` against `b[i]`. Index N is the same material twice only while nothing
enters, leaves or reorders inside the box. All three now key on
`material.uuid`, judge only the intersection of the two samples, take **four**
samples at each hour and exclude anything that moved across them as
self-animating, and carry a **derived** population floor.

| file | leg | before | after |
|---|---|---|---|
| `scripts/G-rooms-walk.mjs` | the room keeps its own light after dark | `noon.filter((c,i) => night[i] !== undefined && night[i] !== c)` | uuid map, 4 samples/hour, floor `max(8, 50% of sampled)` |
| `scripts/G-vice-walk.mjs` | the brick and stone DO go dark after dark | `day.dull.filter((v,i) => nite.dull[i] !== undefined && nite.dull[i] !== v)` | same, on both the `lit` and `dull` sets |
| `scripts/O-jail-night-probe.mjs` | (probe) | `if (night[i].hex !== noon[i].hex)` | same, plus exit 3 on an empty judged set |

The two suites also gained a selftest inversion **for this leg**, which neither
had: every existing inversion in both files is a geometry leg, so the rewrite
could have turned either leg into something that measures nothing and the
selftest would still have printed green. That is GOTCHAS 34 inside the tool
whose whole job is catching it.

## ⚠ THE ROW'S PREMISE IS HALF RIGHT, AND THE HALF THAT IS WRONG MATTERS

**The bug is real, latent and now fixed. I could not make it FIRE in any of the
three, and the row says G-rooms-walk is "the most exposed".**

`scripts/probes/w72-index-vs-identity.mjs` takes **six samples at one clock
time** — nothing about the night grade changes between them, so an honest
comparison must say 0 and anything the index arithmetic reports is mispairing.
Run against the exact boxes the three checks use:

```
subject                        arr len(s)   uniq  UNSTABLE BY INDEX  UNSTABLE BY UUID
G-rooms-walk casino                  746     57                 0                 0 of 57
G-rooms-walk hotel                    67     29                 0                 0 of 29
G-rooms-walk tax                     211     56                 0                 0 of 56
G-rooms-walk pawn                    174     59                 0                 0 of 59
G-vice-walk frontages                 53     19                 0                 0 of 19
O-jail-night-probe                   501     97                 0                 0 of 97
```

Array length was **constant across all six samples in all six boxes**. Nothing
enters or leaves any of them: the four rooms sit at x 400–680, and GOTCHAS 74
records citizens staying inside x −6.25…6.25 by measurement; the vice frontage
box (x 33…58, z −99…−90) is off the corridor too. `interiors-walk` flaked
because the casino's **interior** has something that animates; these three
boxes have **nothing self-animating at all** — `0 excluded as self-animating`
in every run of every room.

So the fix is right, the pattern was a live landmine, and **"its populations
are 4× the casino's, so this one is the most exposed" does not survive
contact.** Two separate things are being compared there:

- **441/155/137/123 in G-rooms-walk's own comment are ARRAY ENTRIES.** Today
  they read 746/67/211/174 — the rooms have been furnished since.
- They collapse to **57/29/56/59 DISTINCT materials.** This world shares
  materials heavily: the casino's 746 array entries are 57 materials.
- `interiors-walk`'s casino figure of 58 was already uuid-keyed. **57 against
  58 — it is the same room measured the same way, not a quarter of it.**

### The consequence, and it is not cosmetic

**G-rooms-walk's typed population floor of 40 would have failed the hotel the
moment the comparison became honest** — the hotel judges 29 distinct materials.
`G-vice-walk`'s floor of 40 would have failed the frontages outright at 19. A
floor typed against an array count is meaningless against a uuid count, and
"the check went red on a world that is fine" is the most expensive kind of
failure here. Both floors are now `max(8, 50% of what was actually sampled)` —
`interiors-walk`'s shape, a fraction rather than a count, so it scales with the
room instead of going stale when somebody adds props.

## Proof

**Five runs each, unchanged source, identical every time** (the row is explicit
that one green run is not evidence — the broken version passed three times in
four). `scripts/probes/w72-five-runs.sh`.

```
G-vice-walk          run 1..5  exit=0   16/19 distinct opaque materials changed        18/18 passed
G-rooms-walk         run 1..5  exit=1   57/57 · 29/29 · 56/56 · 59/59 kept their colour  113/114 passed
O-jail-night-probe   run 1..5  exit=0   97 judged, 0 self-animating, 1 dimmed of 97
```

`G-rooms-walk`'s single red is **pre-existing and not mine**: `[interior:hotel]
NO BUILDING NAME`, the same one every bugsweep prints. It was there on the
baseline run before I touched the file (`113/114`, same leg).

Baseline for comparison, same server, pre-fix: `G-vice-walk` 18/18 with `50/53
opaque materials changed`; `G-rooms-walk` 113/114 with `746/746 · 67/67 ·
211/211 · 174/174`. The verdicts did not move — only the arithmetic behind
them, and the number of materials it can honestly speak about.

**And both legs still go red for their own reason**, watched:

```
G-rooms-walk --selftest
  selftest: handed 2470 interior meshes to the night dimmer — the night-light leg MUST now go red
  0/59 interior materials kept their colour while the world went night 0.00 → 1.00
  all 4 failed as they must                                       exit 0

G-vice-walk --selftest
  0/19 distinct opaque materials changed (0 excluded as self-animating)
  all 3 failed as they must                                       exit 0
```

Both redden with a **full population** — 59 of 59, 19 of 19 — not as `NOTHING
TO CHECK`. A vacuous red would prove nothing about the comparison.

The mutations differ because the two legs assert opposite things.
`G-rooms-walk` asserts nothing dims, so its inversion hands interior meshes to
`scene.userData.addLit` (`ct/props.ts:851`, the one runtime path into the night
grade) — the real failure, not a simulation of it, aimed at the room centres
`__ct.roomDims()` publishes and at the same 7 m box the leg samples.
`G-vice-walk` asserts the brick *does* dim, so its inversion takes the "day"
sample at 02:00 as well and leaves the sweep nothing to change.

Both selftest banners now count the list instead of saying "two" and "three"
next to lists of three and four.

**Suite-level:** `npm run sweep` — 96 shots, **0 STATION MISS, 0 COVERAGE**, no
new console errors (the only warnings are the known `[interior:hotel] NO
BUILDING NAME`, the THREE.Clock deprecation, the Canvas2D `willReadFrequently`
notices and `CONTEXT_LOST_WEBGL`, all pre-existing). `node scripts/health.mjs`
**exit 0, WORLD OK**. `npx tsc --noEmit` **exit 0**.

## Found and NOT fixed

### 1. `scripts/crowd-walk.mjs:76` — SAME PATTERN, REGISTERED, MEASURED FIRING

```js
const moved = w0.filter((p, i) => Math.abs(p.z - (w1[i]?.z ?? p.z)) > 0.2).length;
check(moved >= 4, `they are walking — ${moved}/6 moved >0.2 m in 1.5 s`);
```

Registered at `scripts/checks.mjs:777`. Two samples of `__ct.walkers()` **1500
ms apart**, paired by array position — and unlike the six boxes above, **the
subject of this one is by definition moving.**

**The file creates the hazard itself, and that is why it is a one-line fix.**
`ct/crowd.ts:751` maps the `citizens` array in its own stable order, so the raw
index already *is* identity. `crowd-walk.mjs:64` then appends

```js
.sort((a, b) => a.x - b.x || a.z - b.z)
```

— sorting by a coordinate that changes. `c.lane` (which `walkers()` publishes as
`x`) is mutable: `ct/crowd.ts:382` and `:392` move it as the crowd routes over
the graph.

**Measured, not deduced** — `scripts/probes/w72-crowdwalk-sort.mjs` takes
crowd-walk's own two samples 1500 ms apart and reports the honest count (paired
by cast index) beside the count crowd-walk computes:

```
run A   12 of 60 trials reordered      281 moved by cast index   285 as crowd-walk counts it
run B   11 of 60 trials reordered      281 moved by cast index   285 as crowd-walk counts it
```

**~19% of trials reorder, and the disagreement crosses the check's own
threshold.** Trial 47 of both runs:

```
run A   0,4,2,3,1,5 -> 0,4,2,3,5,1    truth 2/6    crowd-walk counts 4/6
run B   0,4,2,3,1,5 -> 0,4,2,3,5,1    truth 3/6    crowd-walk counts 4/6
```

The assertion is `moved >= 4`. Both of those are **RED by the truth and GREEN as
counted** — a demonstrated false green, which is the dangerous direction: a
mispair can only ever ADD to a count of "how many moved", so a stalled crowd can
certify as walking.

**⚠ MY OWN FIRST PROBE SAID THIS WAS SAFE, AND IT WAS THE PROBE.** Twelve trials
gave **0/12 reordered** and I was one step from filing crowd-walk as clean. The
crowd starts in six fixed home lanes (`ct/crowd.ts:262`, ±(ROAD_HALF + 1.05 +
0.17·k)) and does not begin routing across the block until roughly a minute in,
so a short probe measures the ordering while it is still static. **The first
reorder in run B is trial 13; in run A it is trial 40.** Anything sampling this
crowd needs a horizon of minutes, not seconds.

`__ct.walkers()` publishes no id, so the fix is to keep an unsorted copy for the
movement leg — the sort exists for readable output, not for the arithmetic — but
`crowd-walk.mjs` is not a file item 209 names, so I have not touched it. **Wants
its own row, and it is the strongest instance of this bug now left in the
tree.**

### 2. ⚠ RETRACTED — see `notes/w72-roomdims-not-slab.md`. THE CHECK WAS STALE, NOT THE WORLD

**I got the direction wrong below and I am leaving it standing rather than
editing it away.** Item 196 did not leave a contradiction: it **repainted the
elevation** to the user's own words *"make it a combo orpheus hotel and
casino"* — `ct/vice.ts` now draws `ORPHEUS` over `CASINO` on the marquee and
`ORPHEUS` / `HOTEL & CASINO` on the board, so **the word SEVENS is no longer
painted on that building at all**. The prompt was renamed to match its own
sign, which is exactly what the leg's name asks for. The `/SEVENS/` regex in
the two harnesses was the last thing still using the old address, and I fixed
it under item 212. I reached the wrong conclusion by checking that `ct/vice.ts`
still contained the STRING `'SEVENS'` — it does, as a **roster key**
(`VICE_DOOR_X`, `vice.VICE`, the DoorDecl registry), which is not the same
thing as the painted address. GOTCHAS 7's own lesson: I confirmed a grep, not a
surface.

The original paragraph follows.

### 2 (as originally filed). MERGING MAINLINE IN TURNED BOTH SUITES RED, AND IT IS ITEM 196

Between my five-run proof (`e540c3723`) and the mainline merge, **item 196
landed a door-label rename that neither suite can enter the casino through**:

```
ae06532ad  Item 196: the two frontages become ONE property from the pavement
  src/proto/ct/int-casino.ts:134
  -    label: 'into SEVENS',
  +    label: 'into the ORPHEUS CASINO',
```

Post-merge, same server, same commands:

```
G-vice-walk    17/18   FAIL  SEVENS: the painted entrance and the [E] spot still agree
                             prompt="[E] into the ORPHEUS CASINO"
G-rooms-walk   34/41   FAIL  casino: no [E] spot matching /SEVENS/
                       FAIL  casino: walking up to the door raises the prompt
                       + a cascade — casino and hotel are never entered, so their
                         legs report "no floor plane found" and the tax leg reads
                         a street prompt
```

**This is not a stale check and I have deliberately not loosened it to pass**
(BUILDER-BRIEF §7). The assertion is literally *"the painted entrance and the
[E] spot still agree"*, and they now disagree: `ct/vice.ts` still names the
building **SEVENS** at :76, :760, :814, :961 and :1950 — the roster, the band,
the door x and the blade. Only the interior door's prompt was renamed. So the
marquee over the door reads SEVENS and the prompt under it reads ORPHEUS
CASINO, which is also the HOTEL's name, and *"instead of calling the casino
golden aces call it SEVENS"* is the user's own request (LEDGER, CONFIRMED).

**Not mine, and checkable.** My five stability runs at `e540c3723` were
`113/114` and `18/18`, five for five. My diff on both files touches only the
night-light leg and the selftest — `git diff 946ccce11 a49f494ae -- scripts/G-rooms-walk.mjs`
has hunks at :162, :192, :213, :949, :970 and :1033, none of them near the door
or label legs. **Wants its own row: either item 196 keeps the door named SEVENS,
or the marquee changes too — but they cannot disagree.**

### 3. The jail probe reports 1 dimmed material, and it is tagged `selfLit`

Post-fix, judging 97 distinct materials with 0 self-animating:

```
total dimmed 1 of 97
  uuid a1af9daa-7087-49f8-9bf6-3f20b9deb08b   MeshBasicMaterial   matUserData {"selfLit":true}
  world (1006.37, 2.42, -5.60)      noon 0xF0FFF6  →  night 0xB3B3BA
```

A material carrying `selfLit: true` is being dimmed by the night sweep anyway.
I have not chased whether `selfLit` is meant to be honoured on `MeshBasic` — it
is a finding of the probe, not of this item, and it is one material of 97.
**Wants its own row.** (It is also a genuine reading now: pre-fix the same probe
could have attributed it to a mispair.)

### 4. Checked and cleared — the pattern is NOT in these

| site | why it is safe |
|---|---|
| `scripts/crowd-net.mjs:111` (registered, `checks.mjs:774`) | reads `window.__ct.walkers()` with **no sort**, so the index is the `citizens` array order — stable identity. The one that got it right |
| `scripts/rain-check.mjs:102`, `scripts/w16-rainlock.mjs:59` | index into a `BufferAttribute`; a vertex index **is** identity |
| `scripts/probes/E-drape.mjs:167` | `shoulder` is built by `low.map((q,i) => …)` over a fixed list of four sample points in one pass — positional correspondence is constructed, not assumed |
| `scripts/L-slots-feel.mjs:219` | fixed-length reel array; reel *i* is reel *i* |
| `scripts/M-verify-church-lancets.mjs:87` | static lancet geometry, sampled either side of an edit |
| `scripts/packages.mjs:153` | two HUD strings word-by-word — cosmetic only; the assertion is `gained`, not this line |

### 5. One that is adjacent but not this bug — `scripts/lamplight.mjs:70`

`near(x, z)` picks **the nearest GROUP** to a fixed point at each sample and
traverses it. Index *within* the chosen car is honest, but traffic cars move, so
the two samples can describe **two different cars** — the whole subject swaps,
not two entries in it. Not registered in `checks.mjs`. Recorded, not routed.

## What I derived vs copied

The fix shape — uuid keying, four samples, derived animated set, fractional
floor — is **copied deliberately** from `scripts/interiors-walk.mjs:1166–1224`,
as the row asked (`sample` at :1183, the floor at :1227 — the row cites :1166
and :1191, which are the surrounding comment). It is not retyped: the same reasoning is restated in each
file's own comment because these three files are read on their own, and the two
suites' floors had to be re-derived (`interiors-walk`'s numbers do not transfer
— 40 against 19 is the whole point of §1 above).

The 500 ms inter-sample gap and the four-sample count come from sixtyfour's
measurement that two samples 450 ms apart were **not** enough. I did not re-run
that experiment; my boxes have nothing animating in them, so I could not have
reproduced it either way and I am not claiming to have re-established it.
