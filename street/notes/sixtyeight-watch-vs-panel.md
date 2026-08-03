# Item 189 — the wristwatch over a diegetic panel

Worker **sixtyeight**, 2026-08-02. One line of world code, one probe.

## Root cause, in one line

`poseFor` takes the player's eye along the target face's **own normal**, and a
form lying on a desk has a normal pointing **straight up** — so reading it means
looking down, and `rig.pitch < -0.95` is exactly the gesture `crosstown.ts`
raises the wristwatch on. The watch and the panel were both answering the same
head position correctly and neither knew about the other.

**The desk's diagnosis was right.** Sixtysix photographed it rather than
deducing it, and the mechanism it named survived measurement unchanged. Saying
so explicitly because the standing instruction is to report when the diagnosis
is wrong — this time it was not.

## The change

`src/proto/crosstown.ts:1949`, plus `panelUp` added to the existing
`./ct/hud` import on line 30:

```ts
hud.watch(rig.pitch < -0.95 && !panelUp(), Math.floor(clockMin));
```

**Why this answers "does it come back on every close path" without enumerating
one.** It is not an event handler. `update()` runs every frame with no early
return, and this recomputes `want` from scratch each time, so the frame after
`livePanel` clears — **however** it cleared — the watch slides back if the head
is still down. Escape, `[E]`, the ATM's farewell timeout and any future panel
that closes itself in a way nobody has written yet are all the same code path.
There is no close path to miss because no close path is named.

Same shape and the same reasoning as `hud.prompt`, which already silences itself
on `panelUp()` (`ct/hud.ts:1715`) for the double-caption overlap.

### Where it is, and where it is not

I put it in `crosstown.ts` — the file item 189 names, and the **only** caller of
`hud.watch` in the tree. The alternative was inside `hud.ts`'s `watch()`, which
is where the `prompt` precedent lives. I did not, because `hud.ts` is not named
by this item and one caller does not justify reaching outside the claim
(BUILDER-BRIEF §9). If a second caller of `hud.watch` ever appears, the guard
should move down into `hud.ts` and this note is the reason it was not there
already.

## Proof — `scripts/probes/w68-watch-vs-panel.mjs`

**20 assertions on the BUILT bundle** (`vite preview`, port **4240**, chosen
after `ss -ltn` showed 4186/4190/4191/4201/4202/4210/4211/4230/5177 taken —
`curl` is not a free-port test, GOTCHAS 81).

| | with the fix | with the term reverted |
|---|---|---|
| assertions | **20 pass, 0 fail** | **17 pass, 3 fail** |
| watch over the loan form | **0 px²** | **14,897 px²** |

**The three that flip are the three that matter**, and the mutation run is the
whole point of doing it: a guard nobody has watched fail is a guard nobody
should believe (GOTCHAS 79, BUILDER-BRIEF §7).

- `2. the watch is STOWED while the loan form is up`
- `2. the watch overlaps the loan panel element by 0 px²`
- `3. the watch is STOWED on panelUp() alone, head down, no pose involved`

### Four population floors, so no phase can pass by measuring nothing

1. **Phase 1** asserts the watch **can** be shown. Without it a fix that simply
   deleted the watch would score four greens.
2. **Phase 2** asserts the pitch is genuinely down while the loan is open —
   measured **−1.5707 rad**, dead vertical, against the −0.95 threshold. That is
   the bug's precondition; if the loan ever stops posing the player over the
   desk this must fail loudly rather than pass because there was nothing left to
   obscure.
3. **Phase 3** asserts the head is down **with a panel up**, measured −1.25.
4. **Phase 4** re-drives the pitch down **after** each close, because `leave()`
   flies the camera back to the standing pose — without that the watch would be
   stowed for the honest reason and the check would prove nothing.

### Phase 3 is the one that isolates the term

`ct-pockets` has no `surface`, so no focus lock takes the camera. It is the only
configuration where "a panel is up" and "the player is genuinely looking down"
are **independently** controllable — which is what makes it evidence about
`&& !panelUp()` rather than about where the loan pose happens to point.

### Derived, not retyped (BUILDER-BRIEF §8)

- **Pitch** — there is no `__ct.pitch()`, so the probe reads the camera's own
  world basis and takes `asin(forward.y)`, the same quantity by the same rule as
  `crosstown.ts:1378`, rather than carrying a second opinion.
- **Shown vs stowed** — read as "is any of the element on screen", off the live
  bounding box, not off the transform string. `hud.ts` owns `WATCH_DROP` and
  `WATCH_TILT`; re-typing either would be the `bedcavity.mjs` habit.
- **The loan form** — found by its registered spot label, never by a coordinate
  typed into the probe, so the bank desk can move without this following by hand.

**One check of mine was wrong and the world was right.** My first cut asked for
a third of the watch element to be visible and failed all four SHOWN cases at
0.264. The element is 847.8 px tall — 600 canvas px of that is forearm running
off the left edge — and the shown pose exposes 223.9 px while the stowed pose
exposes exactly **0.0**. So the binary is honest and the fraction was my error.
I fixed the check to the measurement rather than tuning the threshold until it
went green; the numbers are in the probe's header for the next reader.

## I looked at the images

Copied into `street/shots/` under the names below **and** left at the `/tmp`
paths the probe wrote them to. Note `shots/` is in `street/.gitignore:1`, so
these live only in this worktree — the probe regenerates all three in one run
against any preview, which is the durable form of the evidence.

- `shots/w68-189-watch-no-panel.png` (`/tmp/w68-final-1-watch-up-no-panel.png`)
  — watch reading **13:22**, bottom centre, arm going down and away. Correct
  and unchanged.
- `shots/w68-189-loan-after.png` (`/tmp/w68-final-2-loan-open.png`) — the form
  is **completely clear**. SIGN & HAND IT OVER, the signature rule, APPLICANT,
  OFFICER USE ONLY and the full caption all legible.
- `shots/w68-189-loan-before.png` (`/tmp/w68-before-2-loan-open.png`) —
  **sixtysix's photograph reproduced**: the forearm crosses the bottom of the
  sheet, "OFFICER USE ONLY" is gone entirely, the right half of the signature
  rule is covered and the caption is broken across "ENTER".

## Other checks

- `npx tsc --noEmit` — clean.
- `npm run sweep` — 96 shots, **0 STATION MISS, 0 COVERAGE**, no findings.
- `node scripts/health.mjs` — `WORLD OK`, exit 0.
- Console errors during the probe: **0**.

**Inherited warnings, not mine** — unchanged by this item and present on
mainline: the `[interior:hotel] NO BUILDING NAME` DoorDecl warning, the
`THREE.Clock` deprecation, the `willReadFrequently` Canvas2D advisories, and
`CONTEXT_LOST_WEBGL` (which GOTCHAS 80 already records bugsweep logging on this
machine).

`fp`/`fpdiff` were **not** used and would have been invalid — but only trivially
so here: this change adds no geometry at all, it changes one boolean feeding a
DOM transform, so there is nothing in the scene graph for a texture hash to
disagree about either way.

## Found and not fixed — for the desk to queue

1. **This probe should graduate into the check suite.** It is written to assert
   and to exit non-zero, and the item's own framing is that the fault *"will
   bite EVERY future panel laid on a flat surface"* — the mail (155) and the
   library PC (157) are both queued onto near-horizontal faces. Registering it
   means editing `scripts/checks.mjs`, which item 189 does not name, so I left
   it in `scripts/probes/` per BUILDER-BRIEF §7a and §9 rather than reaching
   outside the claim. **One line in `checks.mjs` closes it.**
2. **The wallet was not audited and may be the same bug.** `hud.toggleWallet` is
   right-click, and the wallet is also a bottom-centre DOM element in the same
   corner of the frame. Opening it calls `closePanels()`, so the *wallet-then-
   panel* direction is safe — but I did not test whether it can be flipped out
   while a panel is up, and I did not touch it. Cheap to check, same one-line
   shape if it is wrong.
