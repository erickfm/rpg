# BLOCKED — builder G

**All eight queued items are delivered and landed.** Nothing here is waiting on
work; each item is waiting on a ruling or on someone else's file. I have been
reporting these in handoff prose for several sessions, which is the wrong place —
H's `54f08066` made that case and this is me taking it.

**A caution about this filename.** I wrote a `BLOCKED-G.md` once before and it was
**wrong** — it claimed the tax and pawn doors were unreachable, when the frontage
migration was half-landed and the two numbers were 1.44 m apart for a reason. I
deleted it rather than leave it to mislead. Everything below is measured at
current mainline and says how.

---

## 1. My queue item tells the next reader to reintroduce the mirroring bug

**This is the one I would fix first**, because it is live and it will cost
somebody the same day it cost me.

`notes/queues/G-interiors2.md`, the blade item, says:

> Fix it properly: **two single-sided planes back to back**, a hair apart, with
> the texture flipped horizontally on the rear one.

The first half is right. **The last clause is wrong and causes the defect it is
trying to prevent.** Rotating a plane to `ry = +π/2` instead of `−π/2` already
reverses where its u axis points in the world — at `−π/2` u runs along `+z`, at
`+π/2` along `−z`, and each is the screen-right of a viewer standing on that
side. The same texture therefore reads correctly from both ends. Flipping the
rear one applies a **second** mirror that cancels the first.

That is exactly what I shipped, and the fix was to **remove** a flip, not add one.

`scripts/G-vice-walk.mjs` now asserts the two faces carry the *identical* texture,
and it fails both ways of mirroring — by pixels (`61.4% identical`) and by
sampling transform (`repeat.x = -1`). **So anyone who follows the written
instruction will now fail a check that tells them the instruction is wrong**,
which is survivable but silly.

**The ruling:** the desk owns that file — I do not edit it. Please drop the last
clause. `GOTCHAS.md` §10 itself is fine; it warns about `DoubleSide` and says to
test with asymmetric text, which is correct.

**Since written up as `GOTCHAS.md` §35**, with the u-axis mapping derived rather
than asserted, so the rule survives this queue item being fixed or not. That is
the most I can do from outside the file: a reader who follows the clause now hits
a shared landmine entry that contradicts it *and* a red from `G-vice-walk`. It
still wants the one-line deletion — two things telling you the instruction is
wrong is worse than the instruction being right.

## 2. `ct/doors.ts` has no owner, and the class is still open

The **instance** is fixed: GOLDEN ACES was missing from `declaredDoors()` in the
built bundle for many commits, and `1e49295b` closed it inside my own two files by
dropping the runtime import that put them in the registry's cycle. `doors-declared`
reads **8 of 8** in `dist` at current mainline.

**The class is not.** `civic-doors.ts`, `interior.ts` and `world.ts` still resolve
to undefined namespaces at collection time. They declare no doors today, so
nothing is lost — but the next module that declares one from inside that cycle
drops it the same silent way, in the bundle only, with no error.

D raised the ownership gap in `BLOCKED-D.md`, H in `BLOCKED-H.md` §3. **The ruling
is an owner, not a patch** — the diagnosis is complete and `notes/G-casino-door-fix.md`
records two fixes that do *not* work, so whoever takes it need not re-run those.

## 3. My queue's bookkeeping does not match the world

`notes/queues/G-interiors2.md` shows **all 8 items unchecked** and `## Done` still
reads *"(nothing yet — you are new)"*. Every one is built, landed and verified.

This is not cosmetic: `./scripts/desk.sh` and `./scripts/queues.sh` report builder
state *from that file*, so anything reading them sees me with 8 items outstanding
and nothing done. The item-to-commit map is in `notes/G-interiors2-handoff.md`
under "Every item in `notes/queues/G-interiors2.md`, and where it landed".

**The ruling:** the desk writes that file; I only read it.

## 4. And the actual blocker: there is no next item

My queue has had no undelivered work for a long stretch. I have kept going by
auditing my own instruments and answering other builders' routings, and that has
been genuinely productive — it found the dropped casino door, six user
requirements with no check behind them, and four faults in checks I had written
and believed.

**UPDATED — I said this was into diminishing returns, and it was not.** That
sentence was written after three quiet turns and it aged badly within the hour.
What the unqueued mode has produced *since filing this item*:

| | |
|---|---|
| real defects fixed | the night factor reading a sky that rain lifts; the entrance runner never soaking; **two of four keepers facing their back walls** |
| the user found one of those | the tax preparer — the other three I only checked *because* he asked |
| checks added | casino window, blade texture (both mirror routes), chase running, dead bulbs, keeper facing, pavement spill |
| instrument faults fixed in checks I wrote | 22 stopwatch probes, a citizen-contaminated band, a dev-only reach, a 500 ms read that is one frame under load |
| my own claims corrected | six, including one where I told another builder to route through the hour that causes the bug |

**So the honest position is not "diminishing returns", it is "productive but
unqueued".** Nearly all of it came from reacting to other builders' findings —
they publish a signal or a hazard, I check my area against it. That works, and it
has caught things a queue would not have named. It is also **reactive**: I cannot
schedule it, and the one item a user reported by hand was worth more than any of
it.

**The ruling I am asking for has changed shape.** Not "am I idle" — I am not.
It is whether this is the best use of the seat, given the four other rulings above
are one line each and would let me do directed work again.

## 5. ~~My night factor reads the sky~~ — ANSWERED and FIXED

> **Closed.** B landed `de492304` publishing `nightFactor`, `rainLevel` and
> `wetness` on `scene.userData`, and I consumed it. The wet night now measures
> `night 1.000, spill 3.12` against the dry night's identical `3.12` — the 12.5%
> loss is gone, dry night unchanged to three decimals, `G-vice-walk` 18/18.
>
> **SUPERSEDED AGAIN — the runner IS registered now, and correctly.** What follows
> was true for about an hour. B clamped the wet lerp per channel in `e24c959a`,
> directly on the finding below, so a surface darker than `WET` can no longer be
> pulled up toward it. I re-wired the runner in `fe4567d8`: `#7a2028 → #5d2028`,
> **−34% by day and −35% at night**, the same strength the rest of the registry
> shows, red channel dropping while green and blue hold. Checked by eye too —
> still a red carpet, simply darker.
>
> Kept below because the sequence is the point: a fix that was wrong, a note
> saying why, a clamp that made it right, and the same fix landing an hour later.
>
> **What follows called the runner CLOSED as "must NOT be registered". That is now
> wrong.**
> B then landed `2bab45b7`, re-exporting `ctx.wet` as
> `scene.userData.registerWet`, so the reach problem is gone entirely. I wired it
> — deferred to the first frame, because `crosstown.ts` builds street at :103 and
> props at :210, so there is no `registerWet` to call when this module runs — and
> then looked at it.
>
> **It was much worse than the defect.** `props.ts:1183` does
> `w.m.color.copy(w.base).lerp(WET, wSurf * 0.95)`. That darkens a surface
> *brighter* than `WET`, which is every broad ground sheet it was written for. The
> runner is `#7a2028` at luminance 0.053, **darker** than `WET`, so the lerp runs
> the other way: measured 0.0532 → 0.1148, **+116%**, and on screen the casino's
> red carpet turns into a pale grey-blue mat, lighter than the wet pavement around
> it. Reverted.
>
> **So the finding is about the export, not my mat:** `registerWet` is a
> replacement, not a darkening, for anything darker than `WET`. B's caveat covers
> the writer conflict — *"register the surfaces you do not paint yourself"* — and
> this is a second one worth adding beside it: **and only surfaces brighter than
> `WET`.** The centre lines qualify; a dark decal does not.
>
> ~~The runner stays unregistered, deliberately~~ — see the head of this item. It
> is registered, and the reason it could not be has since been fixed.
>
> Kept below because the reasoning is the useful part: the pattern was two shared
> systems in a row, and the fix for both was publication rather than plumbing.

**A defect of mine, measured, modest, and needing one signal I do not have.**

`ct/vice.ts`'s driver derives "how dark is it" from `scene.background` luminance.
That is a proxy, and rain breaks it: `props.ts:2386` does
`rainSky: (c) => c.lerp(RAIN_SKY, rainLevel * 0.5)`, so a downpour **lifts** the
sky my heuristic reads.

```
23:00 dry night   background 0.0052   night factor 1.000   spill total 3.12
00:00 WET night   background 0.0616   night factor 0.865   spill total 2.73
```

**12.5% less glow on the wet night**, and the direction is the wrong one — wet
asphalt should carry more colour, not less. It is the brief's own image:
*"throwing colour onto wet asphalt"*. See `shots/G-vice-wetnight-*.png`.

**Honest about the size:** 12.5% is marginal and I would not swear it is visible;
the wet-night shots still look right. This is a wrong-direction coupling worth
correcting, not a broken facade.

**Why I have not fixed it.** `buildVice` receives `{ scene, flat, solid, KERB_H }`
— no rain level and no night factor. I could infer rain by sampling another
module's ground materials from inside my tick, and that would be a worse thing
than the bug: a hidden cross-module read that breaks silently when someone
repaints a road.

### The same gap, a second time: the entrance runner never gets wet

`b209275c` found the road centre lines bone dry while the road darkened 83%, so I
swept my own ground surfaces for it. Six of the seven are additive glow and
correctly unaffected. The seventh is not:

```
vice surfaces lying on the ground — dry 13:00 vs raining 15:00
  3x1.5  at x 51.3, y 0.15   OPAQUE DECAL   lum 0.053 → 0.053   0%
```

That is `ct/vice.ts:734`, the red runner over the casino's brass threshold. The
pavement it sits on goes −20% in the rain and the road −78%; the runner does not
move, because it was never registered with `wet()`. **Structurally identical to
the centre lines.**

**Visually it is close to nothing**, and I would rather say so than inflate it:
the runner is `#7a2028` at luminance 0.053 — **and the comparison I drew from that
was invalid, see the correction at the end of this item** — already darker than
wet pavement, so
"fails to darken further" is not something anyone will see. The centre lines were
bone white on an 83%-darkened road, which is a different order of wrong.

**I did not fix it, for the same reason as above.** `wet()` is right there in
`CtxBuild` (`ct/ctx.ts:150`) and `ct/street.ts` uses it freely — but `buildVice`
is handed `{ scene, flat, solid, KERB_H }` and nothing else, so my module cannot
reach it. The fix is two lines: add `wet` to my signature, and pass it at the one
call site that exists solely to construct my module (`street.ts:982`). I have not
made it because `street.ts` is contended and my cross-file mandate was spent on
the extraction, and **a negligible visual gain is not worth a conflict in a file
five people are editing.**

**Why this matters more than either defect does.** Two shared systems in a row —
the night grade and the wet-look — have turned out to be ones `vice.ts` cannot
participate in, not because of a decision but because the constructor call passes
four things. The buildings are the world's only light sources and they sit on its
wettest surface, so those are exactly the two systems they most need.

**The ruling:** pass the night factor — or `rainLevel` — into module ticks, so
`vice.ts` reads the number `props.ts` already computes instead of re-deriving a
proxy from the sky. That is `ct/props.ts`'s call. It is the same shape as H's
`BLOCKED-H` §3 and C's `isGlass` split: **let the thing that knows say so, rather
than have three modules each guess it from appearances.**

### CORRECTION: "already darker than wet pavement" compared a colour to a tint

`114c5bef7` establishes that **`MeshBasicMaterial.color` is a TINT, white by
default** — the texture carries the appearance, so at noon every textured
material reads as luminance 1.0 by construction rather than because it is bright.

I leaned on exactly that mistake. The runner is a flat material with **no map**,
so its 0.053 is real. The pavement and the road are **textured with white tints**,
so their 1.0 and 0.797 are tint values, not brightness. Putting the two side by
side and concluding *"the runner is already darker than wet pavement, so nobody
will see it"* compared a colour against a placeholder.

**What survives:** every DELTA. Grading multiplies the tint, so "did this material
darken, and by how much" is sound — the runner's −34% by day and −35% at night,
the road's −78%, the 51-of-65 at −83.5%, and the six opaque `vice` materials that
do not dim. Those are ratios of a quantity against itself.

**What does not:** any comparison of luminance BETWEEN a flat-coloured material
and a textured one. That includes the sentence above, and the claim it was
supporting — I do not actually know whether the runner reads darker or lighter
than the pavement it sits on, because I never measured the pavement's appearance,
only its tint.

**It does not change what shipped.** The runner is registered and darkens with
everything else; the fix stands on its delta. What is withdrawn is the reason I
gave for it not mattering, which was never measured.

#### Then I measured it, and the claim holds — on evidence I never had

Appearance is texture mean × tint, so a flat material and a textured one become
comparable. At night, dry against rainy, fresh world each and settled to plateau:

```
              textured   tint dry → wet      APPEARANCE dry → wet
  runner      no         0.0017 → 0.0016     0.0017 → 0.0016
  side walk   no         0.0044 → 0.0043     0.0044 → 0.0043
  side road   yes        0.0135 → 0.0074     0.0032 → 0.0018
```

**The runner IS darker than the pavement it sits on** — 0.0017 against 0.0044, at
night, measured like against like. So "nobody will see it" survives.

Two things worth keeping anyway. The **numbers I originally quoted were the wrong
ones**: I cited 0.053 against 1.0, which were daytime tints, and the real night
appearances are 0.0017 against 0.0044 — a different quantity, a different pair of
values, and only the ordering in common. And the **side walk turns out to carry no
texture at all**, so its tint was its appearance all along; the material I assumed
was textured is not the one my selector matches. I was right by luck about which
of the two was flat.

**Withdrawing it was still correct.** A conclusion that happens to hold is not the
same as one that was measured, and I had asserted it twice off a comparison that
could not support it.

## 6. Two user requests about my buildings are logged against builder E

Checked `FEATURE-REQUESTS.md` — the source of truth in the user's own words —
against what my queue actually contains, in case a request about these buildings
never reached me. Two did not:

| the user's words | routed to | actual state |
|---|---|---|
| *"i want more detail for both the hotel and golden aces casino facades"* | **E** | **satisfied — by me.** This is the exteriors overhaul, six commits, `ct/vice.ts` |
| *"the sign up top is completely floating. make sure for stuff like this we pay more attention."* (GOLDEN ACES roof sign) | **E** | **satisfied. Measured, not assumed** |

**The floating sign is fixed.** Casino roof top is y = 17.2; four legs rise from
17.16 to 19.44; the pylon sits at 19.4 → 26.0, landing exactly on them. Nothing
hangs. The 0.15 m spheres sitting 0.1 m proud of the roofline are bulbs on
standoffs — the false-positive class `float-audit.md` already documented.

*(First run of that probe said the sign was 6.6 m INSIDE the roof, because my
"roof" was the tallest wide box and the pylon structure was being counted as its
own support. Fixed by restricting the roof to the building mass. Reporting the
number, not the first number.)*

**Nothing to build. The risk is a collision, not a gap.** Those two entries route
work in `ct/vice.ts` to another builder, and `vice.ts` did not exist when they
were logged — the facades moved to me afterwards, and the rooftop pylon came with
them (`vice.ts:1009`, *"kept, unchanged from the version street.ts carried"*).
Every commit touching that file since is mine. **If E picks either up, they edit a
file I own, on work already delivered.**

**The ruling:** re-point both entries at G, or mark them done. `FEATURE-REQUESTS.md`
is the desk's file.

**And the inverse is clean, which completes the picture.** I checked the log the
other way too — every request routed *to* G. There are exactly two:

```
:33  "i want to build out the insides of the following…"  → G: casino, hotel, pawn, tax
:89  "the front facade of the casino and the hotel are so low effort and boring"
     → G, extracted into ct/vice.ts
```

Both delivered. **So nothing a user has asked for is outstanding against me** —
the two entries above are also delivered, they are simply filed under another
builder's name. There is no user-visible work waiting in my area, which is worth
the desk knowing when it decides what to do with the seat.

## 8. `nightgrade`'s one red is my bulbs — needs one line in `props.ts` (B)

**Full write-up and measurements: `notes/G-nightgrade-bulbs.md`.** Short version,
because it was billed in `05694164a` as the suite's one genuine world fault:

- It is **not** a degenerate mesh. `0.00x0.00` is the check printing missing
  `width`/`height` params; the object is a `SphereGeometry(0.075, 6, 4)`.
- It is my blade-sign chase bulbs, and **not dimming at night is what the brief
  asks of them** — these two buildings are the only light sources in the world.
- `nightgrade` is **flaky on it**: 1,0,1,0,1 over five runs of one build, because
  it samples one instant per hour and the chase is somewhere different each time.
  Second flaky check in that suite run, not the solid fault.

**Blocked on:** `props.ts:420` computes `selfLit` from the material's texture
only, so an untextured author-driven light has no way to declare itself. One
line, B's call:

```ts
const selfLit = isSelfLit(m.map) || m.userData.selfLit === true;
```

It is a real behavioural fix, not check-silencing — it moves the bulbs to
`FLOOR_SIGN`, sets `wetK: 0`, and drops them out of the lamp pools they currently
join for nothing. If B takes it I set the flag in `vice.ts` in the same landing.
The three ways I could have silenced this from inside my own file are listed in
the note, with why each is a trick rather than a fix.

## 7. ~~The casino and hotel facades are centred; their interior doorways are not~~ FIXED

> **CLOSED by centring both interior doorways.** Not by a ruling — by noticing
> the item was never a ruling. I had it as a trade between two design options:
> centring the interior costs a composition, moving the facade costs the marquee
> symmetry on an elevation the user praised. It is actually a user instruction
> against a preference of mine, and the off-centre door was *my* choice, argued
> for in a comment in my own file. Those do not rank equally. I sat on a
> user-reported fault for several sessions and wrote test harnesses instead.
>
> Centred the interior rather than moving the facade, which satisfies the rule
> and leaves the praised elevation alone. Centring surfaced a second fault the
> checks caught: the hotel's lobby seating then sat directly in front of its own
> door — "i immediately hit a counter", in the lobby this time. Chairs and window
> moved with it. 114/114, 18/18, 8 of 8, walked not screenshotted.
>
> **The general lesson, which is the part worth keeping:** when an item is filed
> as "a ruling I cannot take alone", check whether one side of the trade is
> something the user asked for in their own words. If it is, it is not a ruling.

**What follows is the original entry, kept for the measurements.**

**A decision, not a bug, and not mine to take alone** — it trades against the
facade the user called "the best thing in the world right now".

The user's first handedness complaint was *"i need the facades to line up with the
interior. so if the door on the interior is full right then the facade must
match"*. `mirror-walk` checks that for five rooms and passes. **It cannot check
mine**: it lists three canted bays as "deliberately never handed to the painter,
not a fault", and GOLDEN ACES and HOTEL ORPHEUS are two of them — their facades
are painted by `ct/vice.ts`, not by the frontage painter. So they sit outside both
harnesses, and measured:

```
GOLDEN ACES    facade door x 51.29 of [45.45, 57.00], mid 51.225  → CENTRE
               interior doorway declared at local x -3.2 of ±5.25 → LEFT
HOTEL ORPHEUS  facade door x 39.51 of [33.45, 45.45], mid 39.45   → CENTRE
               interior doorway declared at local x -3.4 of ±5.5  → LEFT
```

**Both facades put the entrance dead centre and both interiors put it a third of
the way to one side.** Not the gross case the user described, but the same
disagreement.

**The interior side is deliberate and documented.** `int-casino.ts`: *"The door is
off to one side, so walking in puts the length of the slot banks across your view
rather than an aisle straight down the middle."* Moving it to centre costs that
composition. Moving the FACADE door off-centre instead costs the marquee's
symmetry, the gold portal's placement and the `[E]` spot — on the elevation the
user singled out. **Neither is free, which is why this is a ruling and not a
commit.**

**One caveat on the measurement, since I nearly filed it wrong.** My collider
probe read the hotel's doorway at local −4.83, against a declared −3.4. That room
has a window as well as a door in the front wall, and my "the run that sits proud
of the wall line" heuristic almost certainly found the glazing. The numbers above
are the DECLARATIONS, which are the authority; the probe is only how I noticed.

---

## PICKING THIS UP FRESH — `./scripts/desk.sh` recommends it

`desk.sh` reports **`interiors2 is at its CONTEXT LIMIT — its queue file holds the
brief, so consider restarting it fresh rather than letting it compact mid-item`**.
The board is right, and the handover is clean: **0 unlanded commits, 0 dirty
files**, everything through the merge train.

Read in this order:

1. **this file** — six things waiting on a ruling, none of them work
2. `notes/G-interiors2-handoff.md` — starts with a "READ THIS FIRST" index naming
   what is current, what is superseded and what is stale
3. `notes/queues/G-interiors2.md` — the brief. **All 8 items are delivered**;
   `## Done` is empty because the desk writes that file and I only read it

Nothing is half-finished. There is no work in progress to resume.

## State, for whoever picks this up

| | |
|---|---|
| owned | `ct/int-casino.ts`, `ct/int-hotel.ts`, `ct/int-pawn.ts`, `ct/int-tax.ts`, `ct/vice.ts`, `scripts/G-*.mjs` |
| `G-rooms-walk` | **114/114**, dev and `dist`, `--selftest` fails all 3 inverted truths |
| `G-vice-walk` | **18/18**, dev and `dist`, `--selftest` fails both |
| `doors-declared` | 8 of 8 in the built bundle |
| re-verified against `dist` | at `cc2d8bb56`, after the selftests, the flag guard, the keeper check and the `groundAt` swap — every one of those could have broken bundle-compatibility and none did |
| registered in `npm run checks` | **no** — see `notes/G-offer-checks-entry.md`; `58cc18fa8` shows why nobody can currently fix that |
| ownership | clean |
| open findings against my area | none |
