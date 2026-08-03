# w55 — SEVENS is on the machine now

Item 100. Ports used: **4183** (dev) and **4194** (built preview). Both proved
`000` before starting; 4180–4182, 4184, 4185, 4189, 4192–4195, 4197, 4198 were
all free at the time, so the port pressure the last few builders hit has eased.

> *"slots similarly need to be embedded into the game like i mentioned with the
> atm. fixed perspective. embedded interactable overlay to make it look realistic
> and immersion forward."*

## Did the framework hold up unchanged? YES — and this is the headline

**`ct/hud.ts` and `crosstown.ts` are not touched. The whole diff is
`ct/slots.ts` plus four probes.** Hanging the canvas on a mesh, deriving the
pose from the face's own normal, locking the look, freezing the feet,
raycasting the pointer back into canvas pixels, the Win98 arrow/hand, ESC
always closing, giving the fov and the feet back, putting the object's own face
back — every one of those is w41's, called. Not one line of it is re-implemented
here, and I never had to reach for a second copy.

The seam guide in `notes/w41-diegetic-screens.md` was accurate on every point it
made about *this* item: `hot`/`click` really do arrive in my own canvas pixels,
so `BET ONE`/`MAX BET`/`SPIN`/`CASH OUT` answer for themselves; `PanelSpec.key`
really is untouched, so SPACE/B/V/M/I/C all still work. **The menu is gone, the
keys are not.**

## Where the ATM's answer stopped transferring, and what I did about it

One thing in the guide did not survive contact, and it is worth the next
person's attention because it is about the WORLD, not the framework.

`ct/bank.ts` builds the ATM's raked screen as its own plane, with its own single
material, tagged `userData.atmPart = 'screen'`. `ct/atm.ts` finds it in four
lines. **There is no equivalent on a slot machine.** Measured
(`scripts/probes/w55-slot-mesh.mjs`): the cabinet you sit at is ONE
`BoxGeometry(0.6, 1.45, 0.6)` wearing an **array of six materials**, its front
being index 4. It has no screen mesh because until now it had no screen.

Two consequences, and the second is the one that shaped the work:

1. **`ct/hud.ts:899` would throw.** It reads `mesh.material` as a single
   `MeshBasicMaterial` and calls `.color.getHex()` on it; on a six-material array
   that is `undefined.getHex()`, inside `open()`, before the panel is live. The
   framework is not wrong to assume this — a surface is a face, and a box is six
   of them — but **any future tenant hanging a panel on a multi-material mesh
   will hit it, and it will present as "the panel stopped opening".**
2. Even if it could, painting onto index 4 repaints the *whole* front, including
   the shadowed body and coin tray that `paintMachine` does not draw.

So `ct/slots.ts` supplies its own screen: a thin plane, parented to the cabinet,
6 mm proud of the face you are looking at, cut to the canvas's aspect and hung
from the cabinet's top edge. The cabinet keeps its body and its tray; the plane
is the part that comes alive. That is the same division of labour `ct/atm.ts`
has with the ATM's niche, keypad and cash mouth.

**`ct/int-casino.ts` is not imported, not touched, and none of `AVENUE`,
`SLOT_PITCH`, `SLOT_N`, `BANK_Z` or `STOOL_TOP` appears anywhere in my file.**
The cabinet is found by casting a ray forward from the stool the player is on;
its width and its top come from its own geometry's bounding box; which face to
hang on comes from the normal of the face the ray hit. That was the explicit
alternative `ct/slots.ts`'s own `SLOT_SEAT_LABEL` note warned against, on a
layout whose comments record it moving five separate times.

The plane is built **lazily, on the first sit**. A scenedump never opens a
panel, so `objects` is 8415 either way and no `ct-slots-screen` exists in a
freshly loaded world — measured, not assumed.

## The face had to be re-cut, and that was most of the work

The face was **320 × 256 — landscape**. That is free for a rectangle floating in
front of the camera and wrong the moment it lands on an object: the cabinet is
0.6 m × 1.45 m, so a 1.25:1 picture on its front is nearly a 2× horizontal
smear. w41's guide says this in one line — *"Your canvas should be cut to your
mesh face's aspect, or it will stretch"* — and it is the difference between
"there is a UI here" and *"the interface reads as being on the machine"*.

It is now **320 × 483**: 0.6 m × 0.9056 m at **533 px/m both ways**, square
texels, which is BUILDER-BRIEF §7b's rule stated for a canvas. The width comes
from the cabinet's bounding box at open time and the height is that width over
this aspect, so only ONE of the two numbers is a choice I made.

Every band was **re-spaced, not scaled**, and the 227 new pixels went where the
landscape layout had been shaving:

| | was | is | why |
|---|---|---|---|
| topper | 26 px, 17 px type | 66 px, 36 px type | a marquee you can read |
| pay table | 48 px, **8 px type** | 100 px, 13 px type | the only thing making the odds legible |
| reel glass | 90 px, rowH 30 | 108 px, rowH 36 | grows LEAST on purpose — a reel window is about a third of a metre on a real upright, and a half-metre letterbox would stop it reading as a slot machine |
| meters | 21 px | 36 px | |
| button deck | 14 px, 7 px type | 26 px, 12 px type | they are click targets now |
| bill acceptor | — | 18 px | new, see below |

Symbol art grew with the row by **moving its literals**, not by wrapping the call
in `g.scale()`. `scripts/L-slots-glass.mjs`'s recorder logs a `fillRect`'s RAW
ARGUMENTS, so a scale around the call would have been invisible to it — the check
would have gone on passing while measuring a size nothing draws at any more.
`bars` went 46 → 50 rather than the proportional 55, because the shadow is drawn
a pixel proud each side and that check separates a symbol from its neighbours at
`GLASS.reelW * 0.7` = 58.8 px; 52 clears it by 6.8 px, 57 would clear it by 1.8.

**A bill acceptor is new, and the mouse is why.** The four deck buttons have
never included an INSERT — `I` did it, and a keyboard player is never stuck. A
player working the machine with the mouse sits down at an empty meter, reads
`INSERT COIN`, and has nothing on the face to press. That is w41's PIN-pad
finding happening again in a different machine, and a 1997 cabinet has a bill
validator in exactly that place, so the affordance the mouse needs and the part
the cabinet was missing are the same object.

`DECK` is declared once and read by the painter, by `deckAt` and by `deckLive`,
so a button cannot be drawn where a click does not land or lit when pressing it
does nothing. A click is routed through the **same `onKey`** the keyboard uses.

## Two things the frame had to be MEASURED for

Both of these I got wrong by reasoning and right by shooting.

1. **Standoff 1.35 is worse than 1.15.** Backing off frames more room, which is
   what the ATM wanted — but `crosstown.ts`'s `poseFor` clamps the eye to a
   minimum of 1.05 m above the floor, and this face's centre is at 0.997 m, so
   the eye takes the clamp. From 1.05 m looking level, backing off brings **the
   stool you are sitting on** up into the shot: at 1.35 its cushion and both
   neighbours' rise over the button deck and cover it.
2. **The cushion cuts the face at canvas y 454.** The first layout put the bill
   acceptor at 462–480 and the deck's lower edge at 456 — the acceptor was
   invisible and SPIN was clipped. Every live band now ends by 438 and the rest
   is deck underside, in shadow, which is what a cabinet has there anyway.

I also backed off to 1.35 for a reason that turned out to be **wrong**: I thought
the framework's caption was printing over the bill acceptor. Measured, at 1.15 the
face's bottom edge is at 595 of 700 px and the caption band starts at 615. They
never touched.

## What `fp` says, and what it took to make that mean anything

`fpdiff` against mainline's `ct/slots.ts` reports **1018 of 1458 textures and
2069 structure entries differing**, with the object count, every dimension and
every tint IDENTICAL. That is GOTCHAS 75's signature, and the honest thing to do
with it was not to shrug.

- **Control first:** the same build fingerprinted twice gives textures, structure
  and tints IDENTICAL and 6 pigeons drifted. So `fp` is stable here and the
  comparison is not noise.
- **Isolated:** with the `three` import removed and **every other line of item 100
  in place** — the whole portrait re-cut, the screen plane, the hit test —
  `fpdiff` reports textures IDENTICAL, structure IDENTICAL, tints IDENTICAL, 7
  pigeons. **So the face and the surface move nothing.** `ct/slots.ts` taking any
  edge on `three` (dynamic or static — I tried both, same result) reorders the
  bundle's module graph enough to shift the `generateUUID` stream that
  `scenedump.mjs` seeds, and everything built after the shift re-dithers.
- **It is invisible in the game.** `dither()` calls `Math.random` unseeded at
  build time (GOTCHAS §1), so the noise on those textures already differs on
  every page load. Only a SEEDED dump has a pattern to change. What it costs is
  `fp`'s readability across this one commit, which is why it is written into
  `ct/slots.ts` rather than left for the next person to rediscover as a
  catastrophe.

I settled on the **static** import: `ct/hud.ts` is fetched dynamically because it
reaches `virtual:build-stamp` and sits in `ct/world.ts`'s glob cycle, and neither
is true of `three`. Node loads it fine — checked by running all three offline
slots checks against the file with the static import in place, not assumed. It
also closes a real window in which `three` had not resolved yet and a player
sitting down would silently have got the screen-space fallback.

## How it was proved

All on the **built bundle** (`vite preview`, port 4194) as well as dev.

| | |
|---|---|
| `scripts/probes/w55-mouse-walk.mjs` | 20/20 — a whole sitting by **real page clicks onto the mesh**: bill acceptor, BET ONE, MAX BET, SPIN, CASH OUT, both cursors, money in and out of the one wallet, and SPACE/B/V still working. Three runs out of three |
| `scripts/probes/w55-escape-every-state.mjs` | 34/34 — **all six states** (idle empty, idle loaded, mid-spin, mid-payout, in attract, after re-sitting), each proving panel down + off the stool + fov handed back + cursor released + **the feet actually move** |
| `scripts/L-slots-inworld.mjs` (existing) | all pass — including its own assertion that ESC leaves both the machine and the seat |
| `scripts/L-slots-glass.mjs` / `-rtp` / `-feel` | all pass — the maths, the reels and the re-cut glass |
| `scripts/K-no-panel-traps.mjs` | all good — every other panel in the world still closes |
| `npm run fpdiff` | see above — isolated to one import, world unmoved |
| `node scripts/health.mjs` | WORLD OK, exit 0 |
| `node scripts/bugsweep.mjs` | 96 shots, **0 STATION MISS, 0 COVERAGE**, no new console errors |

`w55-slot-mesh.mjs` and `w55-slot-look.mjs` are the one-shot measurements behind
the findings above, in `scripts/probes/` per §7a. Final frames in `/tmp/w55-ship/`.

**Three reds on this item were the instrument, not the world**, which is close to
BUILDER-BRIEF §7's stated base rate and each is written up where it bit:

1. `B` after `MAX BET` — the stake was already at the top of the ladder, so the
   machine was right to do nothing.
2. `W` after standing up — you get up *facing the machine*, so walking forward
   goes into a collider. It read 0.00 m on one stool and a plausible-looking
   0.75 m on five others, which was a player sliding along that collider: the
   same non-answer wearing a believable number, which is worse. It backs away now.
3. **The mouse walk racing the fly-in** — this one cost an hour. The probe
   projects a canvas pixel to a page coordinate through the camera *as it is*,
   then clicks ~100 ms later through a camera that has eased on. The bill
   acceptor read HAND and the click landed on SPIN, dead at an empty meter, so
   nothing happened and every verdict after it fell over. The machine was correct
   at every instant — `hot` and `click` each raycast the live camera — and the
   instrument was comparing two frames. It now polls until the camera stops
   moving. **The earlier "passing" runs were passing by luck of timing**, which is
   the part worth remembering.

## My own verdict on the after-images

`/tmp/w55-ship/2-seated.png`, built bundle, against the old screen-space panel.

**Before:** a flat rectangle in the middle of a dimmed room. It is a dialog box
and nothing else, and the user is right that it does not look integrated.

**After:** it reads as a machine you are sitting at. The cabinet's marquee, pay
glass, reel window, meters, bill slot and button deck are in their own
proportions on the cabinet's own front; the neighbouring machines are lit either
side wearing their baked faces, the gold valance and its bulbs are overhead, the
stools are in the foreground, and the world behind is not dimmed. `5-after-escape.png`
is the one I would show him second — the machine is back to its own face,
indistinguishable from its neighbours, `[E] sit at the slot` offered again, and
you are standing in the aisle.

Honest reservations: the pay table softens a little at the top of the frame
where the texture minifies, and the deck underside band is plain shadow where a
real cabinet would have a coin tray — I left that alone rather than draw a second
tray over the baked one below it.

## Found and NOT fixed — for the desk to queue

1. **`ct/hud.ts` cannot take a multi-material mesh, and fails by throwing.**
   `hud.ts:899` does `mesh.material as MeshBasicMaterial` then `.color.getHex()`.
   I worked around it by supplying my own single-material plane, which was the
   right answer for the slots anyway — but the *next* caller will hit this and it
   will present as "the panel stopped opening", inside `open()`, with the gate
   half-installed. A two-line guard (`Array.isArray(mesh.material)` → treat as no
   surface, and warn) would turn a throw into the documented degrade the rest of
   that code path already promises. `ct/hud.ts`, not my file.

2. **The cabinet's topper box wears a squashed copy of the whole cabinet front.**
   `ct/int-casino.ts:739` puts a `BoxGeometry(0.56, 0.30, 0.30)` at y 1.60 using
   `slotMats[row[i]][4]` — the *front* texture, which is a picture of an entire
   slot machine — so every cabinet has a tiny second slot machine sitting on top
   of it. Visible in every frame I took, and pre-existing. `ct/int-casino.ts`.

3. **The live face and the baked face do not agree.** Sit down and the machine's
   front becomes considerably richer than the one you were looking at a second
   ago, and than its neighbours'. This is exactly w41's finding 1 on the ATM, one
   room over, and the user has caught this class ("one object that does not agree
   with itself") on the bank door and the ATM palette already. The fix is in
   `ct/int-casino.ts`'s `slotSkin`: draw the pay-table block and the four-button
   deck into the idle texture so the layouts line up. Not my file and not this row.

4. **`scripts/K-atm-walk.mjs` is stale and prints FAILED while exiting 0.** Its
   line 157 asserts `screen === 'thanks'` after TAKE CARD, but commit `1ab300666`
   deliberately made TAKE CARD reset to `'idle'` and close the panel, per
   *"take card from atm should immediately get us out of the menu"*. So it is red
   on mainline for a landed change, and it is also one of the checks the brief
   warns about — **`echo $?` is 0 on a run that prints `1 FAILED`**. I did not
   touch `ct/atm.ts` or that script; my whole diff is `ct/slots.ts` and four new
   probes.

5. **A diegetic panel still cannot nominate where its caption goes** — w41 filed
   this and it is still true. I dealt with it by keeping every live band clear of
   the bottom of the face, but the next machine will have the same conversation.

6. **The cursor shape can go stale during the 0.4 s fly-in.** It is only updated
   on `mousemove`, so if the camera eases under a stationary pointer the hand or
   arrow reflects where the pointer *was* aiming until you next move the mouse.
   Self-correcting, one frame's worth of wrong, and it is what my probe tripped
   over. Not worth a row on its own; noted in case it ever compounds.

## Item 143 (`[E]` also closes machine views)

Nothing here makes that harder. The close path is entirely the framework's —
`onClose` hides the plane and cashes out, and that is all my file contributes —
so `[E]` reaching `panel.close()` will work the same way ESC does today. The
`w55-escape-every-state.mjs` cases should be re-pointed at `[E]` rather than
duplicated when that lands.
