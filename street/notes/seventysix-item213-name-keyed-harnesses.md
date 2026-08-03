# seventysix — item 213: harnesses that identified a room by its display name

Worktree `agent-aefac5f31c45d2c09`, branched off `add-stick-and-city98` at
`9fbd3b781`. Ports **4320** (dev) and **4321** (`vite preview` of `dist/`).
Both were confirmed free with `ss -ltn` and bound with `--strictPort`.

---

## What the item said, and what was actually there

> THREE HARNESSES IDENTIFY THE CASINO BY THE LITERAL STRING `SEVENS` … Every one
> currently reports the prompt is up and `E` works — **so they are GREEN, and
> they are green by luck.**

**Both halves of that were wrong, and in the direction that matters.**

**There are FOUR, not three.** The fourth is `scripts/G-vice-walk.mjs:353`,
`['SEVENS', SVN.px, /SEVENS/]`. It is the only one of the four **registered in
`npm run checks`** (`checks.mjs:773`, slow tier), so it is the only one that was
failing where anybody would see it. (The desk sent this mid-item as a new
finding from worker seventytwo; I had already found and fixed it. Its report
said "one line" — it is not: the row needs the shared resolver and a population
floor like the other three, or the same rename breaks it again.)

**And none of them was green.** The rename has already landed. Measured on
`9fbd3b781`, before I changed anything:

| harness | before | after |
|---|---|---|
| `G-rooms-walk.mjs casino` | **3/6**, exit 1 | 5/6 |
| `interiors-walk.mjs casino` | **13/30**, exit 1 | 17/30 |
| `G-vice-walk.mjs` (registered) | **17/18**, exit 1 | **18/18**, exit 0 |
| `casinodoor.mjs` | printed `SEVENS spots registered: 0` and **exited 0** | 6/6, exit 0 |

`__ct.spots()` returns **0 spots matching `/SEVENS/`**. The casino's prompt has
read `into the ORPHEUS CASINO` since item 196. The failure the item predicted —
"they will fail in a way that looks like the casino door broke" — had already
happened; the desk read the board as green because `casinodoor.mjs`, the one
that says CASINO on the tin, cannot fail.

### A second bug the rename had already introduced, unreported

`/ORPHEUS/` now matches **two** street spots — the hotel at `(39.51, -96.75)`
and the casino at `(51.29, -96.75)`. Both `G-rooms-walk` and `interiors-walk`
used it as the hotel's key and resolved it with `spots.find`, which returns the
**first registration**, not the right one. It happened to be the hotel. That is
luck, and it is the kind the item was written about.

---

## The fix

`scripts/lib/entry-spot.mjs` (new). It joins `__ct.doors()[building].stand` to
`__ct.spots()` **on coordinates** and hands back whatever label the world
publishes today.

**The join is exact, not nearest-neighbour.** Measured over all 12 declared
doors (`scripts/probes/w76-door-shape.mjs`): the nearest `[E]` spot to each
published `stand` is **0.000 m away, 12 times out of 12**. `TOL = 0.05` exists
only so a door that has *lost* its spot resolves to `null` instead of silently
borrowing a neighbour's.

**What it keys on** is `DoorDecl.building` — the roster key, not a display name.
`ct/int-casino.ts:131` already says renaming it "is a break dressed as a
rename", so it is exactly the stable identifier this needed. Rows in the three
walking suites now carry `building:` and no `label:` at all.

Files changed:

- `scripts/lib/entry-spot.mjs` — new
- `scripts/G-rooms-walk.mjs` — 4 rows, 3 use sites
- `scripts/interiors-walk.mjs` — 12 rows, 4 use sites
- `scripts/G-vice-walk.mjs` — 2 rows, 1 use site
- `scripts/casinodoor.mjs` — rewritten
- `src/proto/ct/apartment.ts` — the TV slate

`interiors-walk`'s jail row was already carrying a **hand-maintained two-name
alias list**, `/JAIL|HOUSE OF DETENTION/`, written after the display name moved
under it and six checks failed on a working door. That is the same debt paid a
different way, and it is gone too.

### Population floors, because both negative assertions could pass vacuously

`you are NOT standing in the re-entry trigger after stepping out` asserts a
**non**-match. With the label unresolvable, `isEntry` is false for everything
and the row goes green having measured nothing. Both copies now require
`room.entryLabel != null` first and print
`NO entry label resolved … — nothing was measured` when it is not.

---

## `casinodoor.mjs` — the ninth check found unable to fail

It had **no assertion of any kind**. It printed counts and exited 0 whatever it
found. On `88605f3ed` it printed a clean statement that the casino has no door —
`SEVENS spots registered: 0` — and **exited 0**.

It now has 6 assertions and 3 population floors:

- `__ct.doors()` empty → **exit 2**, not 1: "I measured nothing" is neither
  "fine" nor "broken"
- the sweep must have taken all 25 sample points
- `results.length === 0` → exit 2

**Two mutation cases, because one certifies one leg.**

- `--selftest` pushes a collider onto the live `__ct.colliders()` over the
  door's own published stand. **Watched: 1 of 6 red**, the E-press leg. It
  cannot reach the others, because the sweep uses `warp`, which does no
  collision resolution — so I did not pretend it did.
- `--selftest-gone` drops `SEVENS` out of `__ct.doors()`, which is exactly the
  `e6c08482` failure this file was written for. **Watched: 4 of 6 red**, legs
  1–4.

Together they redden 5 of the 6. The selftest **names which legs must go red**,
so a mutation that misses its target cannot be laundered into a pass by some
unrelated row failing.

Writing it caught a real one: `entrySpots` was being called *before* the
mutation, so legs 1 and 2 were reading a pre-mutation copy and `--selftest-gone`
stayed green. Fixed by re-indexing after the mutation.

Stability: **5 runs on unchanged source, 6/6 and exit 0 every time**
(`scripts/probes/w76-stability.sh`). Also 6/6 against the **built bundle** on
4321.

---

## FINDING: `__ct.reachMargin()`'s docstring describes a predicate the world stopped using

Worth a queue item on its own.

`crosstown.ts:1814` states that "whether you are standing AT it is
`d < r + REACH_MARGIN`", and publishes `__ct.reachMargin()` (0.6) **specifically
so scripts stop hand-typing it** — noting that two scripts had already
reconstructed the predicate by hand.

**That predicate is no longer the one an unaimed player is tested against.**
`fp.ts:977` is `const touching = d < s.r + TOUCH_MARGIN`, `TOUCH_MARGIN = 0.15`
(`fp.ts:764`). The aim-free pass was cut to a quarter of the old slack when the
user said *"i feel like i select stuff without even looking at it."*
`REACH_MARGIN` now applies only when you **are** aimed at the spot.

I found this by believing the docstring: `r + REACH_MARGIN` predicts a 3.11 m
chord and **5** sampled hits on the casino trigger. The world gives **4**.
`r + TOUCH_MARGIN` predicts a 2.13 m chord and exactly 4.

**`TOUCH_MARGIN` is exported from `fp.ts` but NOT published on `__ct`**, so a
harness cannot derive it without hand-copying `0.15`, which BUILDER-BRIEF §8
forbids. So `casinodoor`'s band assertion is a **lower bound** — the trigger must
fire across at least the chord of its own published radius — which needs no
margin constant and cannot over-claim.

**Queued follow-up:** publish `touchMargin: () => TOUCH_MARGIN` next to
`reachMargin` in `crosstown.ts:1825`, correct the docstring above it, and tighten
`casinodoor`'s band leg from a bound to an equality. I did not do it because
`crosstown.ts` is not named by item 213.

---

## The TV ad

`ct/apartment.ts` (the item said :2638; it is **:2667**) advertised `SEVENS` — an
ad for a business the street no longer has, which is precisely the fault behind
*"make the ads actually be representative of the businesses we created thus
far"*.

Now `['ORPHEUS', 'CASINO', 'FREE BUFFET', 'MUST BE 21']` — the facade's own
two-line arrangement (`ct/vice.ts:1264`: category line ORPHEUS, name board
CASINO). **Stacked rather than one line, and the reason is measured**: `tvFit`
sizes to fit, and `'ORPHEUS CASINO'` at 14 characters only fits at **px 3**, its
documented floor ("below that the glyphs stop being glyphs"). Stacked, both
words draw at px 5, the size the rest of the slate uses. `slate` lays lines at
`8 + i*8` and `tvSafeY` clamps the last, so row 4 lands at y 32 against a safe
bottom of 46.

The internal `name:` fields moved `sevens slate`/`sevens quote` →
`orpheus slate`/`orpheus quote`. Nothing references them (grepped).

`w48-tv-title-safe` (registered): **all legs green, 27/27 spots watched, tightest
ink at row 3 against a safe top of 3.**

**I looked at it.** `scripts/probes/w76-look-at-the-slate.mjs` sits on the bed,
waits for the segment by name and dumps the 64×48 canvas at 8×.
ORPHEUS and CASINO read cleanly at px 5; FREE BUFFET and MUST BE 21 read at px 4.

**Pre-existing, NOT introduced here, not fixed:** `FREE BUFFET` at px 4 is
58.7 px wide on a 64 px screen and its glyphs cross the slate's border rule,
which is drawn at x 2…62 with an inner edge at 3. Both those lines are unchanged
by me — same text, same size, same width — so the overrun predates this item. It
affects any slate line of 11+ characters.

---

## NOT MINE, NOT FIXED — for the desk to queue

### 1. The casino leaks. 8 escapes in 24 containment runs.

`interiors-walk casino`, both before and after my change, identical numbers:

```
FAIL  casino: walked OUT of the room going -x
        from local -5.14,-17.64 ended at -11.15,-17.64 — room is 5.5 x 18
FAIL  casino: walked OUT of the room going -z
        from local -5.14,-17.64 ended at -5.14,-23.64 — room is 5.5 x 18
FAIL  casino: the room holds you in, from every direction, everywhere in it
        24 runs from 6 spread points, 8 escapes
FAIL  casino: you cannot walk out through the doorway onto dead ground
        walking at the door reached z=19 (front wall at 18)
```

`__ct.roomDims()` publishes the casino at **w 11, d 36**. `ct/int-casino.ts`'s
own comments describe a depth that was bisected to 26 because 30 broke the way
out. **The room grew to 36 and the walls did not follow.** The player walks
6 m past the side wall. This is a live containment hole, it is red in a
registered slow-tier check, and it is nothing to do with item 213.

### 2. Two suites report a floor the casino and hotel both have

`G-rooms-walk`: `the room reports its own extents — no floor plane found`, for
**casino and hotel, not tax or pawn**. `interiors-walk`: `the floor mesh is
where the rig thinks the floor is — lowest floor mesh y=not found`.

**There is a floor.** `scripts/probes/w76-casino-extents.mjs` finds
**5 flat meshes at y=0 under the casino and 9 under the hotel**, ~797 m² and
~665 m² of coverage against 396 m² and 286 m² needed. The two rooms `ct/vice.ts`
owns are the two the floor-plane detector cannot see — it is almost certainly
looking for a `PlaneGeometry` where these use boxes. **Instrument, not world**
(BUILDER-BRIEF §7), but it is red in two registered suites.

### 3. `casinodoor.mjs` is still not registered in `npm run checks`

It can fail now and it has two watched mutation cases, so it is ready. I did not
add the row because `scripts/checks.mjs` is not named by item 213 and another
builder may hold it. Suggested row (fast tier, ~15 s, does not walk):

```js
['casinodoor', 'can a player still get into the casino from the street?',
  ['casinodoor-walled', 'casinodoor-gone']],
```

### 4. Three hand-typed door positions in `interiors-walk.mjs` are 0.25 m stale

The nine rooms with a `front:` tuple derive `doorX/doorZ` from
`doorStandFor()`. The three side-street rooms do not — they carry literals:

```js
id: 'church', … doorX: 8.85,  doorZ: -79.5,  at: 0,    sideStreet: true,
id: 'casino', … doorX: 51.29, doorZ: -97.0,  at: -3.2, sideStreet: true,
id: 'hotel',  … doorX: 39.51, doorZ: -97.0,  at: -3.4, sideStreet: true,
```

The world publishes the casino and hotel stands at **z = -96.75**, so both are
**0.25 m off the declaration** they are meant to be testing. They pass only
because the trigger radius swallows it — which is the exact failure
`G-rooms-walk`'s own header describes at commit `095c7d63` and the reason that
file stopped typing them. BUILDER-BRIEF §8. Not fixed here: changing a walk's
start point changes what the walk measures, and that is not item 213.

### 5. `reportWorld(p)` was called with no URL

`casinodoor.mjs:12` printed `measuring undefined`. Fixed here in passing. Worth
grepping the other 796 scripts for the same call shape — it is GOTCHAS 48
wearing a different hat.

---

## What I did NOT change, on purpose

Seven scripts use the string `SEVENS` and are **correct**: `doormatch12.mjs:89`,
`doorside2.mjs:99`, `doorlook12.mjs:32`, `facadewidth.mjs:37`, `bigtwo.mjs:17`,
`H-leafpair-guard.mjs:16`, `probes/doorcount.mjs:14`. Every one uses it as a key
into `__ct.doors()[].building`, never against a label. Checked each use site
rather than grepping and swapping.

`interiors-walk.mjs:1110` matches served-spot labels on
`/buy|order|serve|till|counter/i`. That is a semantic verb match, not a business
name, so a rename cannot break it. Left alone.
