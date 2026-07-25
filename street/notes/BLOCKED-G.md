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

**It is now into diminishing returns.** The last three turns produced two negative
results and a documentation pass. I would rather be told what to build than keep
choosing my own work indefinitely.

**The ruling:** queue me something, or confirm the interiors work is complete and
I should stand down.

## 5. ~~My night factor reads the sky~~ — ANSWERED and FIXED

> **Closed.** B landed `de492304` publishing `nightFactor`, `rainLevel` and
> `wetness` on `scene.userData`, and I consumed it. The wet night now measures
> `night 1.000, spill 3.12` against the dry night's identical `3.12` — the 12.5%
> loss is gone, dry night unchanged to three decimals, `G-vice-walk` 18/18.
>
> **The runner is CLOSED too, and the answer is that it must NOT be registered.**
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
> The runner stays unregistered, deliberately, and now for a reason rather than
> for lack of reach. Nobody will see it either way — I measured that before and it
> has not changed.
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
the runner is `#7a2028` at luminance 0.053, already darker than wet pavement, so
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

## 7. The casino and hotel facades are centred; their interior doorways are not

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

## State, for whoever picks this up

| | |
|---|---|
| owned | `ct/int-casino.ts`, `ct/int-hotel.ts`, `ct/int-pawn.ts`, `ct/int-tax.ts`, `ct/vice.ts`, `scripts/G-*.mjs` |
| `G-rooms-walk` | 109/109, dev and `dist` |
| `G-vice-walk` | 18/18, dev and `dist` |
| `doors-declared` | 8 of 8 in the built bundle |
| ownership | clean |
| open findings against my area | none |
