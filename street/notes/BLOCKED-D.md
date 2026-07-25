# Builder D — blocked

## LIVE BLOCK: the ATM. A ruling, not work.

The only open D request is the ATM (`REJECTED` plus the user's fresh
`"the atm is still not right"`). **The desk has instructed me not to start a
fourth attempt**, and that instruction is right: three attempts each changed a
different variable, so nobody knows which one is wrong.

**Evidence is filed and the object is untouched:** `notes/D-atm-evidence.md`,
with eye-height shots at `shots/atm-eye-{front,left30,right30}.png` (camY 1.760
world = 1.62 m above the pavement, 1.5 m out, front and 30° each side).

Eight of the nine asked-for figures measure correct in the built world. Two
candidates remain and I am deliberately not choosing:

1. **fascia HEIGHT 0.68 m** against *"about 1.0 m tall"* — the only geometric
   miss. It fell out as a remainder of three pinned heights instead of being
   set, and raising it conflicts with the screen height already asked for, so
   the two figures may never have been meant to hold at once.
2. **Not geometry at all** — the machine body is within **4%** luminance of the
   bank wall (`#8d949b` vs `#9a9ca0`), so a genuine 0.17 m recess has nothing to
   read against head-on. If this is the fault, three geometry attempts were
   always going to miss it.

**What unblocks me:** the desk or the user says which. Then it is one change,
not another guess.

Nothing else of mine is open — five D rows are CONFIRMED and the queue is
discharged.

---

# Earlier, and RESOLVED — kept for the record


`7b100b65` closes its bodega tally with *"canted bay → **no `__frontages`
entry** → prompt off the walk line → trigger disc centred in the recess. Four
anomalies, one cause."*

I went to publish that missing entry. **There is one already, and it is worse
than missing: it describes the wrong face.**

## Measured, both channels, same build

```
__frontages BODEGA   axis "x"  loWorld 10.4  hiWorld 16.45  facePos -96
                     frontageM 6.05          doorWorld 12.82

doorStandFor('BODEGA')                       (7.47, -95.53)
```

Those are not the same door. They are not even the same wall.

- `__frontages` describes the bodega's **side-street wing** — `BODEGA_WING`
  6.05 m, placed by my `placeBldZ(FACE + 3.4, -94.3, …)` at x 10.4 → 16.45
  facing z = −96 — and puts a door at x 12.82 on it.
- The bodega's actual customer door is on the **canted bay** at (8.0, −95.0),
  normal (−√½, −√½), which is what `DOOR.face` declares and what
  `declaredDoors()` publishes.

**They are about 5 m apart.**

### How bad, measured rather than asserted

I wrote "anything deriving a trigger disc, a stand point or a camera from
`__frontages['BODEGA']` aims at a blank shopfront". Checked it, and it wants
qualifying twice:

**Nothing reads it today.** `frontageWorld()` has no callers outside
`ct/tex-world.ts`, and `__frontages` appears exactly once elsewhere — in a
`crosstown.ts:611` comment which already says the quiet part: *"`__frontages`
is A's and covers flat shopfronts only, so the BODEGA — whose door is on a
canted bay and is deliberately never handed to the painter — was invisible to
anything auditing doors."* The `doors:` affordance beside it exists to cover
exactly this case. So the wrong entry is **latent, not live**.

**And it is not aimed at a blank wall.** Shot the wing square on: it is a
proper shopfront — BODEGA sign band, glazing, stallriser, crates outside — with
a painted door roughly centred. The frontage entry describes that wall
accurately.

So the defect is narrower and stranger than I first wrote: the wing carries a
**painted door you cannot open**, and the frontage published under the name
`BODEGA` points at it. Nothing is broken until something believes it.

## Whose

**Mine.** `ct/street.ts` calls `placeBldZ` for the wing with `nm: 'BODEGA'`,
and the shopfront system registers a frontage under whatever name it is given.
The wing legitimately *displays* the name — it is the bodega's side elevation
and its band reads BODEGA correctly — but it should not be the thing that
answers "where is the bodega's door".

## Why I cannot just fix it

`Placement` (`ct/tex-world.ts:322`) is axis-aligned by construction:

```ts
axis: 'x' | 'z';  loWorld / hiWorld;  facePos;  outward: 1 | -1;  uDir: 1 | -1;
```

A 45° face has no `axis` and no single `facePos`. So the bay cannot register a
frontage that is *correct*, and the choice is between three things I should not
make alone:

1. **Stop the wing claiming the name** — ~~one line in my file~~. **It is not.
   I checked, and this is the thing that decides the whole item.**

   `b.nm` drives BOTH ends:

   ```
   ct/street.ts:936   shopfrontTex(b.brick, b.nm, …)     paints BODEGA on the band
   ct/street.ts:933   shopfrontRelief({ name: b.nm, … })
   ct/tex-world.ts:744  registerFrontage(o.name, …)      registers under BODEGA
   ```

   So renaming the wing to stop it answering for the bodega also **repaints its
   sign**, and the sign is correct — the wing IS the bodega's side elevation and
   should read BODEGA. There is no way to separate the two from my file.

   The smallest thing that would work is an **optional `frontageName` on
   `shopfrontRelief`'s options**, defaulting to `name`: additive, no existing
   caller changes, and the wing then passes `frontageName: 'BODEGA WING'` or
   opts out of registration entirely. That is `ct/tex-world.ts` — A's file and
   A's API shape, not something I should decide by writing it.
2. **Teach `Placement` about a canted face** — an `angle`, or a
   `(origin, along, outward)` vector form. Correct, reusable, and A's type in
   A's file.
3. **Let `declaredDoors()` be the answer for cut faces** and have consumers
   check it — it already carries `face: {x, z, nx, nz}` and already returns
   the right point for BODEGA today.

My preference is 1 now and 2 when someone is next in that type — 1 removes a
wrong answer immediately, which is worth more than adding a right one later.
But 1 alone will make a tool that expects nine frontages find eight, so it
wants saying out loud rather than doing quietly.

**Who:** the desk to pick, A if it is 2. **Not urgent** on the evidence above —
but it becomes urgent the moment `7b100b65`'s shared door-disc arithmetic is
written, because that is a consumer, and it is the one thing that would make
this live.

## Not blocked, and worth folding in

`7b100b65`'s proposed fix — derive every door spot from the published frontage,
radius reaching the kerb and stopping — cannot include the bodega under any of
the three options except 2. Under 1 or 3 the bodega needs its own arm, which is
the thing that note was trying to eliminate. Worth knowing before someone
writes the shared arithmetic and finds it is shared by eight.

---

## The audit found the same thing from the other side, and it agrees

`request-audit.md` §"One gap in the roster itself": *"The BODEGA has no
published frontage. Probing (6, −95.4) … returns nothing from `__frontages`,
while every other shopfront I probed resolves."*

Both true, and worth reconciling because they imply different fixes: there IS a
BODEGA entry, and it does not cover the bay. Probing the bay finds nothing;
probing by name finds the wing. "No frontage" and "a frontage on the wrong
wall" look the same from a point probe and are not the same bug.

The audit also anticipates the state option 1 would produce and accepts it in
advance: *"a roster that covers every shopfront but one is still a large
improvement, and the one it misses is the one shaped differently … but a future
finding on the bodega's face will come back `(no frontage covers it)` and look
unattributable when it is not."*

So the consumer who would most notice the missing entry has already said the
missing entry is preferable to the wrong one — provided it is written down,
which this note is.

---

## `10f8da2d` withdraws "no frontage" — and this blocker is NOT what it closed

The auditor has corrected their own claim: *"I reported twice that the BODEGA
has no published frontage and built a narrative on it… One of those three
[probes] was my own bug."* Their probes assumed every frontage was axis-z and
compared a z coordinate against an x span, so `route.mjs` returned "(no
frontage covers it)" for one that covers it perfectly well.

That matches what I measured, and my note already anticipated the confusion:
*"'No frontage' and 'a frontage on the wrong wall' look the same from a point
probe and are not the same bug."*

**So the existence question is settled and the placement question is untouched.**
The entry is real, it is axis-x on the side street's north face at z = −96, and
its `doorWorld` is **12.82** — the wing's painted door, the one that opens onto
nothing. The customer door is on the canted bay at (8.0, −95.0), which is what
`declaredDoors()` publishes and what the `[E]` uses.

Anyone reading `10f8da2d` alone would reasonably conclude the bodega frontage
item is closed. It is not. What changed is that one of the three reasons the
bodega looked odd was an artefact; the other two — the canted bay having no
representable `Placement`, and the frontage naming the wrong door — are the
ones this file is about, and neither has moved.

**Still needs the same decision**: an optional `frontageName` on
`shopfrontRelief` (A's file), or a `Placement` that can express a 45° face, or
a documented rule that `declaredDoors()` is the answer for cut faces.

---

## `eba406e1` makes the wrong answer DETECTABLE — which changes which option is cheapest

`FrontageWorld.doorDeclared` now records whether a frontage's door came from a
room's declaration or from the painter's fallback layout. Measured at HEAD:

```
BODEGA frontage:  { doorWorld: 12.8234, doorDeclared: false }
16 frontages, 5 with doorDeclared
```

**So the bodega's frontage door is not merely on the wrong wall — it is flagged
as a guess.** x 12.82 is where the painter would put a door on a 6.05 m
frontage, not where any room said its door is. The bodega's room declares its
door on the canted bay through `DOOR.face`, and that declaration cannot reach a
frontage whose `Placement` has no way to describe a 45° wall.

That does not close this item — the entry still answers for the bodega and
still points at the wing — but it changes the shape of the risk and therefore
the cost of each option:

- **Option 3 (document that `declaredDoors()` is the authority for cut faces)
  just got much cheaper.** A consumer no longer has to know about the bodega
  specifically; it can check `doorDeclared` and decline to trust any frontage
  door that was guessed. That is a general rule with a general signal behind it,
  which is what was missing when I wrote the three options.
- **Option 1 (stop the wing claiming the name)** still needs the
  `frontageName` split, because `b.nm` drives paint and registration together.
- **Option 2 (a `Placement` that can express 45°)** is still the only one that
  produces a *correct* entry rather than an absent or ignorable one.

My preference has moved to **3 now, 2 whenever someone is next in that type**.
1 buys least: it removes a guessed answer that is already labelled as a guess.

Still the desk's call, and A's if it is 2.

---

## Timing: the contract is being handed to F, and it does not mention cut faces

`cb696d3d` publishes `notes/A-frontage-signature.md` — the exact frontage export,
extracted from source, *"for the desk to hand to F"*. It is a good document and
it carries `doorDeclared` with its meaning spelled out.

It mentions `declaredDoors`, `cut face`, `canted` and `bodega` **zero times**.

That matters right now rather than eventually, because F is about to build
against it. What a reader takes from that contract today:

```
__frontages is where a shop's door is.
doorDeclared tells you whether a room said so or the painter guessed.
```

Both true. What is missing is the third case:

```
For a CUT FACE the room DID say — and its answer is not in this record at all.
It is in declaredDoors() / doorStandFor(), because Placement cannot describe
a 45° wall.
```

Without that, `doorDeclared: false` on BODEGA reads as *"no room declared this
door"*. The room declared it precisely; the declaration simply cannot reach a
frontage whose `axis` is `'x' | 'z'`. A consumer following the contract
faithfully will conclude the bodega has no authored door and either use the
painter's guess at x 12.82 — the wing's decorative door, 5 m from the real one —
or skip the shop.

**One sentence in that document would close it**, and it is A's document:

> A shop whose door is on a cut face has no representable `Placement`, so its
> door is not here. `declaredDoors()` is the authority for those.

This is not a new blocker and it does not change the three options. It is the
same item, arriving at the moment it is cheapest to fix — before a second
consumer is written against the gap rather than after.

---

## The authority I am recommending is itself lossy in the bundle

Ran the house suite. One real red in the project, `doors-declared`, and it lands
on this item:

```
mode: BUILT BUNDLE
8 modules declare a DOOR; 7 reached declaredDoors()

DECLARED BUT NEVER COLLECTED:
  GOLDEN ACES      src/proto/ct/int-casino.ts
```

My preference above is **option 3 — document that `declaredDoors()` is the
authority for cut faces**. That recommendation was made against a function I had
only ever exercised for the BODEGA. In the built bundle it silently drops a
building.

**It does not change the recommendation, and I checked rather than assumed: the
BODEGA is among the 7 that arrive.** Option 3 works for the case this blocker is
about, today, in the artefact.

**It does change what the sentence has to say.** "`declaredDoors()` is the
authority for cut faces" would be handed to F as a guarantee, and it is not one
yet — a room in an import cycle with `doors.ts` can declare a door that never
reaches the collector, with no error and no gap in the count unless you go
looking for the total. If option 3 is chosen, the wording needs the caveat:

> `declaredDoors()` is the authority for cut faces. It is collected through an
> eager glob and a module in an import cycle with `doors.ts` can be missed in
> the built bundle — `scripts/doors-declared.mjs` is the check that says so.
> Compare the declared count with the collected count before trusting a miss.

**The underlying defect is diagnosed and is not mine.** `seam-audit.md` Round 16
has it exactly: six of the eight rooms import only `type DoorDecl`, which is
erased, so they have no runtime edge at all; only `int-casino` and `int-hotel`
import the value `doorStandFor`, and they are the two chamfered corners. The fix
is to move `doorStandFor` into a leaf module that globs nothing, then change two
import lines. **Three files, one of them new.**

`ct/doors.ts` still has no owner in `OWNERSHIP.md` — I flagged that some rounds
back and it is now blocking a real red rather than a hypothetical one.
`int-casino.ts` and `int-hotel.ts` are not mine. **Desk: this needs an owner,
and the diagnosis is already complete enough that whoever takes it is doing
twenty minutes of typing rather than an investigation.**

---

## Audited against HEAD, the way `580963ad` audited its own — nothing here is stale

A checked their blocker for sections that had gone false and found two. I did
the same to this file rather than assume it had aged well. Re-measured at
`580963ad`:

```
__frontages is an ARRAY of 16; 5 with doorDeclared
BODEGA  axis x  lo 10.4  hi 16.45  facePos -96  doorWorld 12.8234  doorDeclared false
```

**Every figure in this file still holds.** The entry exists, it is the wing, its
door is at 12.82, and it is still flagged as a guess. `frontageWorld()` still has
no callers outside `ct/tex-world.ts`, so it is still latent rather than live. And
`notes/A-frontage-signature.md` still mentions `declaredDoors`, `cut face`,
`canted` and `bodega` **zero times**, so the timing section stands too.

### One thing HAS changed, and it is the caveat I added last round

`doors-declared` at HEAD:

```
8 modules declare a DOOR; 8 reached declaredDoors()
every declared door arrived.
```

The casino's door is back. **The caveat is not withdrawn**, because `29ce42d8`
says it plainly — the door is fixed, the mechanism that lost it is not. Three
modules still resolve to an undefined namespace at collection time. If option 3
is chosen, the wording still needs to say that `declaredDoors()` is collected
through an eager glob and that a count is the only way to notice a miss. What
changes is that the example is now historical rather than current.

### And a trap in the contract itself, which I fell into just now

My own probe read `__frontages['BODEGA']` and got `undefined`. I nearly reported
that this blocker's central claim had gone false.

**`__frontages` is an ARRAY, not a name-keyed map.** `A-frontage-signature.md`
says *"every `FrontageWorld` with its `name`, for scripts"*, which reads
naturally as a map — `Object.keys()` on the array returns sixteen INDICES, so a
wrong probe even reports a plausible count of 16 before failing on the lookup.

That is worth one word in A's document before F builds against it, and it is a
candidate explanation for `10f8da2d`'s withdrawn "the BODEGA has no published
frontage" — a name lookup against an array returns exactly nothing, for every
shop, in a way that looks like a finding about one.

---

# NOTHING LIVE — both entries below are now closed

**Item 1 is ANSWERED and built** (see the RESOLVED block appended to it), and
item 2 was withdrawn earlier. **I have no open blockers.** Kept rather than
deleted because the question and the answer together are the record of the one
thing in this project that has consistently worked: asking before drawing a
second copy of somebody else's asset.

## 1. The alley grate — RESOLVED. B exported the casting; asking was the right call

The queue item says: *"If the casting itself is B's asset rather than yours, ask
the desk and B exports it rather than you drawing a second one — a second grate
design is exactly how this project ended up with two of everything."*

**It is B's and there is nothing to import.** `ct/tex-ground.ts` builds the kerb
inlets as `const basin = (kx, z, side) => …` — a local, not an export.
`OWNERSHIP.md`: `tex-ground.ts = B`.

**The question: ask B to export the casting, and I place it?**

What is mine either way, and what I will do the moment the casting lands: the
drain sits MID-FLOOR with the alley falling to it, so it wants a square frame
rather than a kerb-side one, the paving dished slightly into it, and staining
where the water runs. What is B's is the **bars, frame and throat**.

Today mine is not geometry at all — it is `fillRect` bars painted into
`alleyFloorT` at 24 px/m, which is exactly why it reads as four lines with no
hole. Full write-up in `notes/D-alley-grate.md`.

> **RESOLVED — B exported `floorDrain()` and the grate is built.**
>
> Not `basin` with the kerb filed off: a mid-floor variant with the **throat
> dropped**, because a yard gully takes water from every side rather than down a
> gutter, so a throat has nowhere to go. That is a better answer than the one I
> asked for, and it is why asking was worth the wait — I would have drawn a
> square frame with a throat in it and been subtly wrong about the object.
>
> **One grate design, two correct variants. I drew nothing.** 12 solids, 7 bars,
> **11 mm rebate** (bars sunk under the frame top, which is the whole difference
> between a hole and four stripes), frame 24 mm proud, placed at the bottom of
> the dished paving. The alley now falls 6 cm over 2.6 m into it and the player
> falls with it. `scripts/alleydish.mjs` and `notes/D-alley-grate.md`.

## 2. WITHDRAWN — "the bodega corner bay is blocked on A"

My report has said for several rounds that following A's shopfront vocabulary
needs five names exported from `ct/tex-world.ts`, and the queue item repeats it
back to me with an offer to queue it to A.

**Do not queue it. A has already exported all five:**

```
tex-world.ts:973   export const HI
tex-world.ts:980   export function reveal
tex-world.ts:989   export function proud
tex-world.ts:998   export function glazed
tex-world.ts:1009  export function mullions
```

So the bodega corner is **not blocked** and is mine to take. My own note was
stale and would have cost A a round of work that was already done.
