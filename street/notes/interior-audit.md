# Interior audit — ten rooms, four builders, one kit

**Branch** `audit/seams`, based on `add-stick-and-city98` @ `ea641af` · read-only ·
nothing under `street/src/` touched. Port 4184.

**One of the ten rooms exists.** `ct/int-diner.ts` is the only kit room in the
tree; `int-burger`, `int-thrift`, `int-casino`, `int-hotel`, `int-pawn` and
`int-tax` are named in `OWNERSHIP.md` but not written yet. So "judge them as a
set" is currently a set of three: the diner (on the kit) and the apartment and
bodega (both predate it).

That changes where the leverage is, and it is worth saying plainly: **with nine
rooms still to be written, the defects worth finding are the ones the kit does
not prevent, because each of those will land nine more times.** This report is
therefore mostly an audit of the kit's contract, measured through the one room
that exercises it.

Instrument: `scripts/interiors.mjs` measures every interior region (ceiling,
clear size, wall thickness, floor/wall texel density, palette luminance, lamp
count, group discipline) and walks the entry and exit of each.
`scripts/interiors2-3.mjs` are the follow-up probes. Raw numbers in
`shots/interior-report.json`.

## The set, measured

| axis | apartment (pre-kit) | bodega (pre-kit) | **diner (kit)** |
|---|---|---|---|
| clear size | 2.4 × 8.4 (hall) | 8.0 × 8.0 | 8.6 × 7.0 |
| ceiling height | 2.55 per storey | 2.70 | 3.00 |
| wall thickness | 0.028 … 0.295, eight values | **0 — single planes** | **0.18 uniform** |
| floor px/m | **35.6** | **24.0** | **18.6 × 18.3** |
| wall px/m | 23.7 × 23.7 | **11.9 × 20 (non-square)** | 11.9 × 12.0 (square) |
| ceiling | textured | flat colour | flat colour |
| wall luminance | 0.51 | 1.00 | 1.00 |
| glow planes | 17 | 2 | 2 |

## Findings

| # | sev | instance | file | what's wrong | evidence |
|---|-----|----------|------|--------------|----------|
| 1 | **high** | floor and walls disagree inside **every** kit room | `ct/interior.ts` | The kit derives its two big surfaces from two unrelated constants: the floor from 32 px per **1.6 m** (≈20 px/m nominal), the walls from 32 px per `TILE_M` **2.7 m** (11.85 px/m). Measured in the diner: floor **18.6 × 18.3**, walls **11.9 × 12.0** — a **1.55 : 1** mismatch inside one room, in the two surfaces that fill most of the frame. It is identical in all ten rooms by construction. This is seam pattern #1 reproduced one layer down. | `shots/interior-report.json`, `shots/int-diner-front.png` |
| 2 | **high** | the floor density is not constant — it varies ±33 % with room size | `ct/interior.ts` | `linoT.repeat.set(round(W/1.6), round(D/1.6))`. The rounding to a whole tile count defeats the intent: W = 8.6 → 5 → **18.6** px/m; W = 8.0 → 5 → **20.0**; W = 2.4 → 2 → **26.7**; W = 2.0 → 1 → **16.0**. Ten rooms of ten sizes get ten floor densities spanning **1.67 : 1**, which is the "ten unrelated games" failure the kit was written to prevent. The comment says density comes "from the room's REAL METRES" — it does, then rounds it away. | measured across the region sweep |
| 3 | medium | the ceiling is an untextured flat colour | `ct/interior.ts` | `ceil` is a plain `MeshBasicMaterial({color})` against a textured floor and grained walls. It reads as a hole when you look up. Logged in the seam audit as finding 24 on the bodega; the kit has now institutionalised it for all ten. | `shots/int-bodega-cmp.png` |
| 4 | medium | nothing bounds palette luminance between rooms | `ct/interior.ts` | `palette` is four free hex ints, and the flat materials — not the glow — are what set a room's brightness. Measured wall luminance is 1.00 in both the diner and the bodega, ceiling 0.71 vs 0.67; with ten builders choosing freely there is no bound at all. The kit fixes lamp *count* (`round(D/3.5)`) and glow colour, i.e. the part that does not matter, and leaves the part that does. "Light level and colour temperature" is a set axis and it is currently unenforced. | region sweep |
| 5 | medium | the two pre-kit rooms are the odd ones out and are not on the kit | `ct/bodega.ts`, `ct/apartment.ts` | Bodega: walls are **zero-thickness planes**, texels **11.9 × 20** (1.68 : 1 anisotropic), no jambs, no reveal. The user's complaint that produced the kit — *"i need a door and not paper thin walls"* — is still literally true in the bodega. Apartment: floor 35.6 px/m against the diner's 18.6, and eight different wall thicknesses. As a set of three the world currently offers wall thicknesses of {0, 0.028–0.295, 0.18} and floor densities of {24.0, 35.6, 18.6}. | `shots/int-bodega-cmp.png` |
| 6 | medium | a room shorter than 2.15 m silently loses its door but keeps the hole | `ct/interior.ts` | `DOOR_H` is a fixed 2.15 regardless of `spec.h`. If a builder passes `h` below that, `addHole` rejects the door (`y1 > H`), `holes` comes back empty, and the front wall is built as one solid run — while the collider gap at `dAt ± dW/2` and **both** `[E]` spots are still registered from the same numbers. Result: an invisible doorway you walk through and a prompt with no door. Not currently triggered (the diner is 3.0 m); it is a trap laid for nine rooms not yet written. | source |
| 7 | low | `interiorMaxX()` is order-dependent and read once | `ct/interior.ts`, `crosstown.ts` | `bounds.maxX` is set from it when the rig is constructed (`crosstown.ts:285`), and it returns `SLAB_X0 + SLABS.length * SLAB_W`. Any room built *after* the rig extends the slab list but not the bound, so the last rooms would sit outside the player's walkable bounds. Correct today — the diner is built at line 240 — and a one-line trap for the nine still to land. | source |
| 8 | low | dead space inside a claimed slab has a ground height but no floor | `ct/interior.ts` | `interiorGround` answers `0` anywhere within a claimed slab, but only the room has a floor mesh. Unreachable today because the room's colliders hold you in; it becomes reachable the first time a builder puts a second space in their slab, or a teleport overshoots. | source |

## Checked and sound — recorded so nobody re-walks them

The kit's door machinery is correct, and I tested it rather than reading it.
**I nearly filed two false positives here** — my first walk test reported no
prompt at the diner door, and my first exit probe reported the player unable to
move. Both were my own errors: a bad DOM visibility check, and a way-out spot I
guessed at instead of computing from `dAt`/`hd`. Recomputed and re-run:

- **Entry is reachable from every approach.** North along the west walk, south
  along it, and straight in off the road all close to **0.21 m** against a
  1.05 m trigger. The prompt fires (`[E] into the DINER`). No repeat of
  GOTCHAS §8.
- **The way-out spot and the arrival point both show the prompt; the middle of
  the room does not.** That is exactly the kit's stated intent — you land a
  stride clear of the threshold with the way-out prompt already up.
- **Walking at the doorway from inside stops at z = 3.30**, i.e. inside the
  reveal with the prompt showing, and you cannot continue into the dead slab.
  The blocker-on-the-far-face trick works.
- **The exit landing is legal** — free to move in 4/4 directions, on the west
  walk at the right building, facing out across the street.
- **Group discipline is respected**: 0 of the diner's 56 meshes hold a local x,
  so the night sweep will not eat the furniture.
- **The kit's own warnings did not fire** for the diner — it passes its checks.
- **Room size against frontage is right, and it is the rule to hold the other
  nine to**: clear 8.6 + 2 × 0.18 = **8.96 m** against DINER's 9.2 m roster
  width. A room should fill its shopfront to within a wall thickness.

## Patterns

**1. The kit enforces structure and leaves finish free — and finish is what
makes ten rooms read as one world.** Everything that would break *obviously* is
locked down: addressing, wall thickness, jambs, door height, the collider that
cannot swallow the trigger, the exit-gap check. Everything that will break
*quietly* is a free parameter: floor density, palette, ceiling treatment. The
kit's own preamble names the fear correctly — "you would feel it immediately as
ten unrelated games" — and then guards the half of it that a builder would
probably have got right anyway.

**2. Same root cause as seam pattern #1, one layer down.** Two painters in one
file each pick their own px/m from their own constant, and nothing ties them.
The exterior now has `WALL_PPM`; interiors have 1.6 m for floors and 2.7 m for
walls, and no shared datum. The fix has the same shape: **one `INTERIOR_PPM`,
both surfaces derived from it, and the floor's repeat computed so the tile count
lands on the density rather than the density landing on the tile count.**

**3. Every check the kit performs is a `console.warn`.** The checks themselves
are good — overlapping openings, a door taller than the room, an exit inside its
own trigger. But a warning is invisible in a headless build and to a builder who
does not open the console. `scripts/interiors.mjs` already captures them; they
would be worth a build gate before nine more rooms arrive.

**4. The two pre-kit rooms should be ported, not grandfathered.** The bodega is
the room a player is most likely to enter first and it is the one that still has
paper walls. Every axis this audit measures puts it outside the set.

## Coverage — what I did NOT get to

- **Nine of the ten rooms do not exist.** Everything above is the kit measured
  through one room. When the others land the set comparison has to be re-run —
  the instrument is written and takes one command.
- **The queue asks whether each interior's window agrees with where its building
  stands on the street.** For the diner the *frontage* check passes (8.96 m
  against 9.2 m). The window's position along that frontage is a design
  correspondence between two objects in different parts of the world, and I
  could not verify it geometrically — I can only state the rule for the others:
  the room's front wall is the shopfront, so window centre and width should be
  read off the same numbers `ct/street.ts` paints the glazing from.
- **Light was measured, not judged.** I have luminance figures for the flat
  materials but did not compare rooms side by side by eye at matched exposure,
  which is the only way "colour temperature" really gets settled.
- **The apartment was measured by region, not walked**, this pass — its stairs,
  landings and room 301 were walked in the seam audit and have changed since.
- Daylight only; interiors are excluded from the night sweep by design, but I
  did not verify that exclusion still holds for the kit's rooms.

---

# Round 2 — no new rooms; the entry triggers are living on borrowed margin

Base `add-stick-and-city98` @ `bcd2c82`. **Still one kit room.** `int-diner.ts`
is the only interior in the tree; F's burger barn and G's casino are assigned
but not committed. The set comparison above is unchanged and stands.

What did change is a desk finding routed to D in the same commit: *"crosstown.ts
hand-writes the block's collision as two rectangles spanning the whole street,
independent of what any module draws."* That is the third bullet of this queue
item — "is any room enterable from a spot that a collider swallows" — so I
measured it rather than waiting for the nine rooms.

## Measured (`scripts/triggers.mjs`)

The blanket walls are `crosstown.ts:238–240`. Their inner faces are at
x = ±(FACE − 0.3) = ±6.7; the player capsule is 0.36, so the closest a player
can ever get is **x = ±6.34**. Every street-side `[E]` trigger sits somewhere in
that band. Walked from three directions each, with real key input:

| trigger | r | closest reachable | **margin** | centre reachable? |
|---|---|---|---|---|
| DINER (kit room) | 1.05 | 0.21 | **0.84 m (80 %)** | **no — blocked** |
| No. 227 street door | 1.05 | 0.21 | **0.84 m (80 %)** | **no — blocked** |
| BODEGA corner store | 1.10 | 0.00 | 1.10 m (100 %) | yes |

**The bodega finding from the seam audit is closed** — its trigger centre is now
reachable with the full radius available. Recorded so it is not re-opened.

## Finding 9 — two of three entry triggers have their centre inside a wall

| # | sev | instance | file | what's wrong |
|---|-----|----------|------|--------------|
| 9 | medium | DINER and No. 227 street doors | `ct/interior.ts` (kit contract) + `crosstown.ts:238–240` | Both spots sit 0.45 m off the facade (`±(FACE − 0.45)` = ±6.55) while the blanket wall makes everything past ±6.34 unreachable. The trigger centre is **0.21 m inside solid collision** and the prompt fires only because the radius is five times the intrusion. Nothing is broken today; what is broken is that **nobody is accounting for the margin.** |

Why this is the interiors item's problem rather than D's alone:

- **The convention propagates.** The diner places its door at 0.45 m off the
  facade; that is the reference the other nine will copy, so nine more triggers
  will each start 0.21 m in debt.
- **The margin is a shared budget with no owner.** It is spent by anything a
  props builder puts outside a door — a bench, an A-board, a planter, a bin.
  The bodega became un-enterable by exactly this route: blanket wall first, then
  the fruit crates on top, and the 0.36 m capsule turned 0.84 m of slack into
  −0.31. One prop was enough.
- **The kit checks the mirror image of this and not this.** `buildRoom` already
  warns when the way-out landing falls inside the way-in trigger
  (`outGap < doorR + 0.35`) — the entry side gets no equivalent. The file that
  owns the door contract validates one end of it.

**Recommended, and it belongs in `ct/interior.ts` beside the check that is
already there:** assert a minimum *reachable* margin at the entry spot, not just
a minimum distance at the exit. The kit cannot see the collider list, but the
desk can hand it one — and the check only has to run at build time, once per
room, to stop nine doors shipping in debt.

## Patterns — an addition

The collision commit's own diagnosis is the fourth instance of the pattern this
audit trail keeps finding, and it is worth naming as one thing:

> **Values that describe what a module built are being authored somewhere else,
> by hand, as literals.** Seam pattern #1: texture density per painter instead
> of from the surface. Float pattern: a mounted object's position typed instead
> of taken from its host. Now collision: the block's solid geometry hand-written
> in `crosstown.ts` instead of registered by the module that drew it.

Same failure, three subsystems, and each time the fix has been the same shape —
the thing that knows the truth should be the thing that publishes it. The
interior kit already works this way for colliders (`room.solid`) and for spots
(`ctx.spot`), which is why interiors are the one subsystem where this class of
bug has *not* appeared. It is the model, not the exception.

## Coverage — round 2

- **No new rooms**, so nothing new to compare. The instrument runs in one
  command when F and G land.
- I measured the three street-side triggers that exist. I did **not** enumerate
  triggers from `SPOTS` directly — it is not exposed on `__ct` — so if a module
  registers a spot I did not know about, I did not test it.
- The margin figures are for the world as it stands **today**, with today's
  props. They are a snapshot of a budget that other builders spend.

---

# Round 3 — three rooms written, two in the world

Base `add-stick-and-city98` @ `1b990d7`. F's burger barn (`8bc06cb`… `343ad61`)
and G's casino (`8bc06cb`) have both landed as files. Measured with the same
instrument; shots `shots/int2-*.png`.

## The set as it now stands

| axis | bodega (pre-kit) | **diner** | **burger barn** | casino (spec only) |
|---|---|---|---|---|
| in the world? | yes | yes | yes | **no** |
| clear size | 8.0 × 8.0 | 8.6 × 7.0 | 11.0 × 8.5 | 10.5 × 9.0 |
| ceiling | 2.70 | **3.00** | **3.20** | **2.50** |
| wall thickness | 0 | 0.18 | 0.18 | — |
| floor px/m | 24.0 | 18.6 × 18.3 | **20.4 × 18.8** | — |
| wall px/m | 11.9 × 20 | 11.9 × 12.0 | 11.9 × 11.9 | — |
| ceiling textured | no | no | no | — |
| ceiling luminance | 0.668 | 0.714 | 0.832 | **0.169** |
| glows | 2 | 2 | 4 | — |
| clear + walls ÷ frontage | — | 8.96 / 9.2 = **97 %** | 11.36 / 16 = **71 %** | — |

## Findings

| # | sev | instance | file | what's wrong |
|---|-----|----------|------|--------------|
| 10 | **high** | **the casino is not in the world** | `crosstown.ts` | `buildCasino` is exported from `ct/int-casino.ts` and **never called**. `grep -rn buildCasino src/` returns only its own definition. Slab 2 measures empty; there is no `[E] into GOLDEN ACES` anywhere. A whole room — slot machines, carpet, the lot — is written, committed and unreachable. The kit deliberately removed the need to touch `crosstown.ts` to register *spots*, but the one-line `buildX(ctx)` construction call still lives there, so every room still has a desk-contended step that nothing checks. |
| 11 | **high** | ceiling heights spread 0.7 m across three rooms | the three room specs | 2.50 (casino) / 3.00 (diner) / 3.20 (burger). The kit's default is 2.9 and its own comment says *"2.9 is a shop; a casino or a library wants more"* — the casino is the one room that asked for **less**, 0.4 m under the shop default. Whatever the intent, three rooms built to a shared kit now differ by more than the kit's whole stated range. |
| 12 | medium | room size against shopfront frontage | `ct/int-burger.ts` | The diner fills its frontage: 8.6 clear + 2 × 0.18 = **8.96 m** against DINER's 9.2 m — 97 %. The burger barn is 11.0 + 0.36 = **11.36 m** inside a **16 m** shopfront — **71 %**, leaving 4.6 m of frontage with no room behind it. The rule this audit proposed after round 1 is already broken by the second room, which is what an unenforced rule does. |
| 13 | medium | the entry-trigger debt propagated exactly as predicted | `ct/interior.ts` | Round 2 predicted every room copying the diner's 0.45 m door offset would start 0.21 m inside the blanket wall. The burger barn does: closest reachable **0.21 m**, margin **0.84 m (80 %)**, centre **blocked**. Three of four street triggers are now in debt. The bodega, the one that was fixed, holds at 96 %. |

**Unchanged and still open from round 1** — A's cross-file density mandate was
exteriors only, so nothing here moved:

- finding 1, floor vs wall inside a room: 18.6–20.4 px/m against 11.9 — still ~1.6 : 1.
- finding 2, floor density not constant: diner 18.6 × 18.3, burger **20.4 × 18.8**
  — now visibly anisotropic *within* a single room, because `round(W/1.6)` and
  `round(D/1.6)` land on different multiples for a room that is not square.
- finding 3, ceilings untextured in both kit rooms.
- finding 4, palette luminance unbounded: ceilings now measure 0.169 → 0.832, a
  **5 : 1** spread with nothing constraining it.

## What is working

Worth saying, because it is most of the kit: the two rooms that are in the world
read as one place. Wall thickness is 0.18 in both, wall texel density is 11.9
square in both, the shell/jamb/reveal language is identical, and the door
machinery works in the burger barn exactly as it does in the diner. The failures
above are all in the parameters the kit leaves free, not in the parts it owns —
which is the round-1 pattern holding up under a second and third builder.

## Coverage — round 3

- The casino could only be read from source; it is not in the scene, so its
  ceiling, densities and door could not be measured. Its numbers above are
  from `ct/int-casino.ts`, not from the world.
- Seven of ten rooms are still unwritten.
- Light was measured as material luminance again, not judged side by side.

---

# Round 4 — four rooms written, two in the world

Base `add-stick-and-city98` @ `096ec73`. Since round 3: G's casino still not
wired, and G's **hotel** landed (`99eda8f`). D's collision refactor also landed
(`8a7941f`, "Collision follows geometry: each module registers its own
footprint"), so the trigger margins were re-measured against it.

| axis | **diner** | **burger barn** | casino (spec only) | hotel (spec only) |
|---|---|---|---|---|
| in the world? | yes | yes | **no** | **no** |
| clear size | 8.6 × 7.0 | 11.0 × 8.5 | 10.5 × 9.0 | 11.0 × 9.0 |
| ceiling | 3.00 | 3.20 | **2.50** | **3.40** |
| clear + walls ÷ frontage | 8.96 / 9.2 = 97 % | **11.36 / 16 = 71 %** | 10.86 / 11.55 = 94 % | 11.36 / 12 = 95 % |
| floor px/m | 18.6 × 18.3 | 20.4 × 18.8 | — | — |
| wall px/m | 11.9 × 12.0 | 11.9 × 11.9 | — | — |

## Findings

| # | sev | instance | file | what's wrong |
|---|-----|----------|------|--------------|
| 10 | **high** *(escalated)* | **two of four written rooms are not in the world** | `crosstown.ts` | Round 3 reported the casino unwired. The hotel has now landed the same way: `buildHotel` is exported from `ct/int-hotel.ts` and never called, exactly as `buildCasino` is not. Slabs 2 and 3 both measure **empty**. This is no longer a one-off — **50 % of finished interior work is unreachable**, and the second instance arrived after the first was reported. The kit removed the need to touch `crosstown.ts` to register *spots*; the one-line `buildX(ctx)` construction call still lives there, is desk-contended, and nothing checks it. Two rooms of furniture, lighting and collision exist and no player can ever see them. |
| 11 | **high** *(widened)* | ceiling heights span 0.9 m | the four room specs | casino **2.50** / diner 3.00 / burger 3.20 / hotel **3.40**, against a kit default of 2.9. Round 3 measured a 0.7 m spread across three rooms; the fourth widened it. Nothing in `RoomSpec` bounds `h`. |
| 14 | medium | D's collision refactor did not change the entry-trigger debt | `ct/interior.ts` | Re-measured after `8a7941f`: diner, No. 227 and burger barn are all still **0.21 m closest / 0.84 m margin / centre blocked**, byte-identical to round 2. The refactor changed *what* is solid — correctly, and it fixed E's courtyard — but not the 0.3 m inset at the facade that puts every kit-convention door spot inside collision. The finding stands unaltered. |

**Correcting my own round 3.** I wrote that the frontage rule was "already broken
by the second room", implying a systemic failure. With four rooms measured that
reads too strongly: the diner fills 97 % of its shopfront, the hotel 95 %, the
casino 94 %. **The burger barn at 71 % is a single outlier, not a pattern** — an
11 m room behind a 16 m frontage, leaving 4.6 m with nothing behind it. Worth
fixing on its own terms; not evidence the rule is being ignored.

**Unchanged from round 1** — still nothing bounding them: floor vs wall density
(18.6–20.4 against 11.9), floor density anisotropic within a room, ceilings
untextured, palette luminance unbounded.

## Patterns — an addition

Finding 10 is the interior instance of the pattern this trail keeps meeting, and
it is worth stating in its own terms because the fix is different:

> **The kit made the *contents* of a room self-registering and left the room's
> own existence hand-wired.** `room.solid`, `ctx.spot` and the slab allocator all
> mean a builder never edits shared state — and then the room only exists if
> somebody remembers one line in the most contended file in the project.

Everything else the kit owns is checked at build time; this is the one step that
is not, and it is the step whose failure is total. A room that is 0.4 m too low
still ships. A room that is never constructed ships as nothing. **The cheapest
guard is an assert, not a convention:** the kit already knows every id it has
handed a slab to, so it can compare that list against the ids it was asked to
build and warn on the difference — or `crosstown.ts` can build from a manifest
the room modules export rather than from hand-written calls.

## Coverage — round 4

- The casino and hotel could only be read from source. Their ceilings, densities,
  light and door behaviour are **unmeasured**, and their frontage figures above
  are computed from their specs, not from the world.
- Six of ten rooms unwritten.
- The hotel's commit message mentions "the fall it is still standing in" — I did
  not investigate; it is not in the world to walk.

---

# Round 5 — five rooms written, three in the world; the frontage gap is real after all

Base `add-stick-and-city98` @ `378b3c4`. F's **thrift store** landed and **is
wired**. The casino and hotel are still not.

| axis | **diner** | **burger barn** | **thrift** | casino* | hotel* |
|---|---|---|---|---|---|
| in the world? | yes | yes | yes | **no** | **no** |
| clear size | 8.6 × 7.0 | 11.0 × 8.5 | 8.0 × 6.5 | 10.5 × 9.0 | 11.0 × 9.0 |
| ceiling | 3.00 | 3.20 | 2.75 | 2.50 | 3.40 |
| wall thickness | 0.18 | 0.18 | 0.18 | — | — |
| wall px/m | 11.9 × 12.0 | 11.9 × 11.9 | 11.9 × 12.0 | — | — |
| floor px/m | 18.6 × 18.3 | 20.4 × 18.8 | 20.0 × 19.7 | — | — |
| ceiling luminance | 0.714 | 0.832 | 0.745 | 0.169 | — |
| glows | 2 | 4 | 2 | — | — |

\* spec only — not in the world, so unmeasured.

## Finding 12, restated: room width is uncorrelated with frontage

Round 3 called the burger barn a broken rule; round 4 called it a single
outlier. Both were wrong, and so was my first draft of this round — I wrote that
the gap correlated with frontage width, then checked the roster and found DINER
is **12 m** now, not the 9.2 m I measured in round 1. The block has been re-cast
since. Recomputed against the current roster:

| room | clear + walls | shopfront frontage | fill |
|---|---|---|---|
| diner | 8.96 m | 12 m | **75 %** |
| burger barn | 11.36 m | 16 m | **71 %** |
| thrift | 8.36 m | 14 m | **60 %** |
| hotel* | 11.36 m | 12 m | 95 % |
| casino* | 10.86 m | 11.55 m | 94 % |

There is no correlation. A 12 m frontage got both 8.6 m (diner) and 11.0 m
(hotel); the widest frontage on the block, 16 m, got 11.0 m; the 14 m got the
narrowest room of the five. What the numbers actually show is simpler:

> **Every room is between 8.0 and 11.0 m wide, whatever it stands behind.** Five
> independent builders converged on the same range without reference to the
> building — which is what a free parameter with no reference value looks like.

The three rooms that "fill their frontage" do so because their frontage happens
to be near 11 m, not because anyone matched them. So the fill percentage is the
wrong statistic; the finding is that **`w` is chosen by feel and nothing connects
it to the shopfront the player just walked through.**

The fix is a kit concern, not a per-room one: `RoomSpec` should take the frontage
and derive `w`, or warn when `w + 2T` falls short of it. `ct/street.ts` already
knows every building's roster width, and — as the stale 9.2 → 12 m above shows —
that width moves, so any hand-copied number goes stale silently.

## Findings

| # | sev | instance | what's wrong |
|---|-----|----------|--------------|
| 10 | **high** *(unchanged)* | casino and hotel still unwired | `buildCasino` and `buildHotel` still never called; slab 3 measures empty. Two of five finished rooms unreachable, unchanged since round 4. |
| 12 | **medium** *(restated)* | rooms do not grow to their frontage | see above — correlates with frontage width, not with builder |
| 13 | medium | trigger debt now on four of five street doors | thrift measures **0.21 m closest / 0.84 m margin / centre blocked**, identical to the diner and burger barn. Every kit-convention door inherits it. |
| 11 | **high** *(unchanged)* | ceiling spread 0.9 m | thrift at 2.75 sits inside the existing range; casino 2.50 → hotel 3.40 still bounds it |

**What is holding.** Wall thickness 0.18 and wall texel density 11.9 × 12.0 are
now identical across three independently built rooms. That is the kit's owned
half working exactly as intended, and it is the strongest evidence yet that the
split between "what the kit enforces" and "what it leaves free" is the whole
story of this audit.

## Coverage — round 5

- Casino and hotel remain source-only; six of ten rooms unwritten.
- Floor density still varies (18.6–20.4) and is still anisotropic within rooms.

---

# Round 6 — seven rooms written, three in the world

Base `add-stick-and-city98` @ `499892c7`. Since round 5: **`int-pawn.ts`** and
**`int-tax.ts`** landed. Neither is wired. Neither are the casino or the hotel.

## Finding 10, escalated twice over

| | round 3 | round 4 | **round 6** |
|---|---|---|---|
| rooms written | 4 | 4 | **7** |
| rooms in the world | 2 | 2 | **3** |
| unwired | casino | casino, hotel | **casino, hotel, pawn, tax** |

`buildCasino`, `buildHotel`, `buildPawn` and `buildTax` are all exported and
none is called. `grep -c` in `crosstown.ts` returns 0 for each; slab 3 measures
empty. **Four of seven finished rooms are unreachable, and the count has grown
in each of the three rounds since it was first reported.** Two builders have now
each shipped two rooms that no player can enter.

This is the strongest evidence yet for the mechanism named in round 4: the kit
made a room's *contents* self-registering and left the room's *own existence* as
one hand-written line in the most contended file in the project, with nothing
checking it. It is not a builder oversight three times over — it is a missing
build-time assert. The kit already knows every id it has handed a slab to.

## Finding 13, differentiated — the collision refactor reached one stretch

Round 5 reported the entry-trigger debt as uniform. It no longer is: the thrift
store now measures **0.01 m closest / 1.04 m margin / centre reachable**, where
in round 5 it was 0.21 / 0.84 / blocked. Its door coordinate has not changed.

So I mapped the reachable limit along both facades (`scripts/facade.mjs`, walking
into the wall every 4 m):

| stretch | limiting x | meaning |
|---|---|---|
| west wall, z ≥ −68 | **−6.29 … −6.34** | still inset 0.3 m |
| west wall, z ≤ −72 | **−6.64** | at the true facade — refactor applied |
| east wall, entire length | **6.28 … 6.34** | still inset 0.3 m |

*(the outliers at −7.3 to −9.4 are the alley, the new park and the library
courtyard, where there is no building to stop you — correct)*

> **D's "collision follows geometry" has reached the west facade south of about
> z = −70 and nowhere else.** Everything north of it, and the whole east wall,
> still stops the player at ±6.3 against a facade at ±7.

That is exactly why the thrift store came good and the diner, burger barn and
No. 227 did not — thrift's door sits at z = −74.94, inside the converted stretch.
It also gives a one-number acceptance test for the rest of the work: **the limit
should read ±6.64 everywhere a facade stands.**

## The two new rooms (spec only — not in the world)

| | pawn | tax |
|---|---|---|
| clear | 11.0 × 8.0 | 12.0 × 8.5 |
| ceiling | 2.80 | 2.75 |
| frontage | 15 m | 13 m |
| clear + walls ÷ frontage | 11.36 / 15 = **76 %** | 12.36 / 13 = **95 %** |

I drafted this section claiming both new rooms fill their frontage and that "the
three low ones are the three oldest" — then read the roster and found **PAWN is
15 m, not the 12 m I assumed**. That is the second time this round-trip has
caught me: roster widths move, and any number of mine older than one rebase is
suspect. Corrected, the seven rooms read:

| room | clear + walls | frontage | fill |
|---|---|---|---|
| thrift | 8.36 m | 12.5 m | 67 % |
| burger barn | 11.36 m | 16 m | 71 % |
| diner | 8.96 m | 12 m | 75 % |
| pawn* | 11.36 m | 15 m | 76 % |
| casino* | 10.86 m | 11.55 m | 94 % |
| hotel* | 11.36 m | 12 m | 95 % |
| tax* | 12.36 m | 13 m | 95 % |

Round 5's statement survives and the "newest fill better" story does not: room
widths are 8.0–12.0 m against frontages of 11.55–16 m, with **no relationship
between the two**. Every room that "fills its frontage" is one that happens to
stand behind a narrow building. The tax office is the first room anyone has
built wider than 11 m.

**Ceiling spread unchanged at 0.9 m** — casino 2.50, thrift 2.75, tax 2.75, pawn
2.80, diner 3.00, burger 3.20, hotel 3.40.

## Coverage — round 6

- Four of seven rooms are source-only; their ceilings, densities, light, doors
  and colliders are **unmeasured**. Everything above about them is read off
  `RoomSpec`, not off the world.
- Three of ten rooms still unwritten.

---

# Round 7 — closing my own coverage gaps: exits walked, light judged

Base `add-stick-and-city98` @ `bfbb0b7c`. No new rooms and no wiring change
since round 6, so this round closes two gaps I had been carrying in the
"coverage" section rather than measuring: the exits of the rooms I never walked
out of, and light judged side by side instead of as a luminance number.

## Exits — all three correct and identical (`scripts/exits.mjs`)

Stood on each room's way-out spot, pressed E, and checked where the player
actually lands:

| room | prompt inside | lands at | on the walk? | distance to its own way-in trigger | prompt on landing | can move? |
|---|---|---|---|---|---|---|
| diner | `[E] out to the street` | (−6.10, 8.10) | yes | 1.57 m (trigger r = 1.05) | none | 4/4 |
| burger barn | `[E] out to the street` | (−6.10, −26.75) | yes | 1.57 m | none | 4/4 |
| thrift | `[E] out to the street` | (−6.10, −73.44) | yes | 1.57 m | none | 4/4 |

Identical in all three, and correct in every respect the kit set out to
guarantee: you land on the sidewalk at kerb height, 1.57 m clear of the trigger
you just used so you cannot be sucked back in, with no prompt showing so the E
you are still holding does nothing. **The exit half of the door contract is
sound across every room that is in the world.**

## Light, judged as a set (`shots/cmp-*-back.png`, matched cameras)

Same station in each room — 1.5 m in from the front wall, on the centreline,
looking at the back wall, same pitch — so these are comparable by eye:

| | fixture | glow | reads as |
|---|---|---|---|
| diner | one warm dome | soft radial pool on the ceiling | warm, low, cosy |
| burger barn | **four cool troffers** | **hard-edged rectangular bloom, near-white** | very bright, cool |
| thrift | two fluorescent tubes | almost none — one tube has a faint pool, the other has **no glow at all** | flat, dim, cool |

**Colour temperature is defensible; level is not.** Warm diner, cool fast food,
cool thrift is exactly right for the venues. But walking diner → burger → thrift
the exposure jumps hard in both directions: the burger barn's ceiling is near-
white and its troffers bloom, while the thrift's tubes barely register as light
sources at all. The luminance figures I have been reporting (0.714 / 0.832 /
0.745) understated this badly — they measure the ceiling material, not the glow
on top of it, and the glow is what the eye reads.

| # | sev | instance | file | what's wrong |
|---|-----|----------|------|--------------|
| 15 | medium | three rooms, three lighting *systems* | `ct/interior.ts` + the three room files | The kit supplies one warm radial bulb and a `light: {kind, tint, count}` escape hatch. The diner takes the default, the burger barn declares four cool troffers, the thrift draws tube fixtures with next to no glow. Nothing relates their **output** — so the set has one room you squint in and one you can barely see the light in. The kit fixes lamp count from depth (`round(D/3.5)`) and leaves brightness entirely free, which is backwards: count is the thing a builder should choose and output is the thing that has to agree. |
| 16 | low | the thrift's two tubes glow differently from each other | `ct/int-thrift.ts` | One tube has a faint ceiling pool, the other has none. Inconsistent within a single room, which reads as one fixture being broken rather than as a lighting choice. |

**Finding 3 confirmed visually:** all three ceilings are the flat untextured
colour. In the thrift and the diner it reads as an absence; in the burger barn
the troffer bloom covers for it.

## Coverage — round 7

- **Jamb reveals: checked, sound.** `shots/cmp-burger-reveal.png` and
  `shots/cmp-thrift-reveal.png` — both openings show the jamb return on *both*
  sides, the header over, and the leaf swung clear, each in its own trim colour
  (burger red, thrift brown). The 0.18 m wall is doing exactly what the kit
  claims for it: *"there is no way to get a paper wall out of this kit."* With
  the diner from round 1 that is all three rooms verified, and it is the single
  strongest thing the kit does.
- Four of seven rooms still source-only; three of ten unwritten.

---

# Round 8 — six rooms in the world, and the margin prediction came true

Base `add-stick-and-city98` @ `fb99b135`. `0e00db8c` **wired the casino, the
hotel and the tax office** — finding 10 acted on. **PAWN is still unwired**
(`buildPawn` count 0), so it is now 1 of 7 rather than 4 of 7.

## The set, six rooms, all measured in the world

| | diner | burger | thrift | casino | hotel | tax |
|---|---|---|---|---|---|---|
| clear | 8.6 × 7.0 | 11.0 × 8.5 | 8.0 × 6.5 | 10.5 × 9.0 | 11.0 × 9.0 | 12.0 × 8.5 |
| ceiling | 3.00 | 3.20 | 2.75 | **2.50** | **3.40** | 2.75 |
| **wall thickness** | **0.18** | **0.18** | **0.18** | **0.18** | **0.18** | **0.18** |
| **wall px/m** | 11.9 × 12.0 | 11.9 × 11.9 | 11.9 × 12.0 | 11.9 × 12.0 | 11.9 × 11.8 | 11.9 × 12.0 |
| floor px/m | 18.6 × 18.3 | 20.4 × 18.8 | 20.0 × 19.7 | 21.3 × 21.3 | 20.4 × 21.3 | 21.3 × 18.8 |
| ceiling luminance | 0.714 | 0.832 | 0.745 | **0.148** | 0.616 | 0.767 |
| glows | 2 | 4 | 2 | 6 | 6 | 6 |
| fill of frontage | 75 % | 71 % | 67 % | 94 % | 95 % | 95 % |

**Wall thickness and wall texel density are identical across all six rooms built
by four different agents.** That is the clearest result in this whole audit: the
half of the shell the kit owns is perfect, six for six, and every disagreement in
the table is in a parameter it leaves free. Ceiling spread 0.9 m over six
distinct values; ceiling luminance spans **5.6 : 1**; floor density 18.3–21.3 and
still anisotropic inside individual rooms.

Round 5's frontage statement now rests on six measured rooms rather than specs:
widths run **8.0–12.0 m against frontages of 11.55–16 m**, with no relationship
between them.

## Finding 17 — a prop has re-blocked the thrift door, exactly as predicted

Round 2 said of the entry-trigger margin:

> *"The margin is a shared budget with no owner. It is spent by anything a props
> builder puts outside a door… the bodega proves one prop is enough."*

That has now happened to the one door that had been fixed. Thrift measured
**0.01 m closest / 1.04 m margin / reachable** in round 6. It now measures
**0.27 m / 0.78 m / blocked.** Its door coordinate has not changed.

The cause, found by querying what is near it: a **`BoxGeometry` 0.36 × 0.62 ×
10.5 m at (−6.82, 0.45, −73.55)** — a 10.5 m run of low furniture hard against
the facade, placed by `cc7e0e76` ("place the approved five through the world").
It occupies x −7.00 … −6.64, so with the 0.36 m capsule the player is stopped at
**x = −6.28**. The door spot is at −6.55. |−6.55 − (−6.28)| = **0.27 m** — the
measured regression exactly.

Nobody did anything wrong. The props builder placed a bench against a wall; the
interior builder put a door spot 0.45 m off the facade; the collision refactor
made that stretch reachable. Three correct decisions, and the door went back
inside solid, because **no one owns the number that says whether a door is still
reachable.** That is the argument for the build-time assert this audit proposed
in round 2, now with a worked example.

## Trigger status, all seven street doors

| door | closest | margin | centre |
|---|---|---|---|
| GOLDEN ACES | 0.01 | 1.04 (99 %) | reachable |
| HOTEL ORPHEUS | 0.02 | 1.03 (98 %) | reachable |
| BODEGA | 0.03 | 1.07 (97 %) | reachable |
| DINER | 0.21 | 0.84 (80 %) | blocked |
| BURGER BARN | 0.21 | 0.84 (80 %) | blocked |
| No. 227 | 0.21 | 0.84 (80 %) | blocked |
| A-1 TAX | 0.21 | 0.84 (80 %) | blocked |
| THRIFT | **0.27** | **0.78 (74 %)** | blocked — **regressed** |

The two side-street doors are reachable, which fits the round-6 facade map: the
conversion has reached the side street and the west/east main-street walls are
still inset.

## A false positive I caught before filing

My batch probe reported the GOLDEN ACES door showing `[E] into the HOTEL
ORPHEUS`. Standing directly on each of the three new spots and reading the HUD
gives `into GOLDEN ACES`, `into the HOTEL ORPHEUS` and `into A-1 TAX SERVICE` —
all correct. The batch reading was my script keeping any prompt seen during an
approach run, not a mislabelled door. Recorded because it is the third time this
audit that a batch measurement has needed a direct check before it was safe to
report.

## Coverage — round 8

- PAWN is still source-only; three of ten rooms unwritten.
- Light judged side by side in round 7 for three rooms; the three newly wired
  ones have **not** been through that comparison.

---

# Round 9 — the bodega's migration to `ctx.spot` is behaviour-neutral

Base `add-stick-and-city98` @ `a4c64a82`. One interior change since round 8:
`5e1d58cd`, "Bodega's two door spots register themselves" — the last pre-kit
room moved off hand-written `SPOTS` entries in `crosstown.ts` and onto the kit's
`ctx.spot`.

Re-ran the trigger harness. **No regression:** the bodega measures **0.03 m
closest / 1.07 m margin (97 %) / centre reachable**, with the correct
`[E] into the BODEGA` prompt — identical to round 8, before the migration.

Worth recording rather than assuming, because this is the migration that removes
the last hand-wired entry point from `crosstown.ts`, and the failure mode if it
had gone wrong is the one this audit has met twice: a door that still looks
right in source and cannot be reached in the world.

All other triggers unchanged from round 8, including THRIFT still at 0.27 / 0.78
/ blocked (finding 17 — the prop against the facade is still there).

**Pawn is still unwired.**
