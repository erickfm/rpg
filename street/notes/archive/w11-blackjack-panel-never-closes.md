# w11 → desk: FOUND, NOT FIXED — the blackjack panel can never auto-close, and it locks E for the rest of the session

**Not fixed. `ct/blackjack.ts` is not a file any item I held named, so per
`BUILDER-BRIEF.md` §9 this is reported rather than edited.** Found while
running `scripts/seats-walk.mjs` as extra verification for item 0f (not
required by that item, run for confidence) — it cascaded to 172/228 failures,
which led here.

## Root cause, in one line

`ct/blackjack.ts`'s per-frame hook gates its auto-close on `dismissed !==
null`, but `dismissed` is unconditionally forced to `null` **on the same
frame, one line above**, whenever the seat clears — so the guard can never be
true and the panel never closes on its own.

## The code, `ct/blackjack.ts:1273-1283`

```ts
ctx.onFrame((f) => {
  if (!panel) return;
  const seat = seatedAtTable();
  if (seat === null) dismissed = null;                    // line 1276
  if (!panel.isOpen()) {
    lastT = -1;
    if (seat !== null && seat !== dismissed) { lastT = f.t; panel.open(); }
    return;
  }
  if (seat === null && dismissed !== null) { panel.close(); return; }   // line 1282 — DEAD
  ...
```

Compare `ct/slots.ts:1402-1416`, which this was clearly copied from — same
shape, same variable names, one difference:

```ts
ctx.onFrame((f) => {
  if (!panel) return;
  const stool = seatedSlot();
  if (stool === null) dismissed = null;
  if (!panel!.isOpen()) { ... return; }
  // Left the seat some other way — a room transition stands you up directly
  // (`crosstown.ts:653`), which is the same path that would miss an `onStand`
  // hook. Closing here cashes out through `onClose`.
  if (stool === null) { panel!.close(); return; }          // UNCONDITIONAL
  ...
```

`slots.ts` closes unconditionally on `stool === null`. `blackjack.ts` added
`&& dismissed !== null` — and because `dismissed` was already reset to `null`
on the line directly above in the same tick, that added condition is
`false && …` is not even needed: it is **always `null !== null` = false**
whenever `seat === null`, so the branch is unreachable code that looks live.

## Why it matters, and why the file's own comment is wrong

The comment at `blackjack.ts:1200-1204` says this guard is "currently
unreachable… since C's seat-exit fix… leaving the panel leaves the seat as
well" — true for the ONE path it was thinking about (pressing Escape on the
open panel). But `slots.ts`'s own comment two lines above the equivalent code
names the path that matters: *"Left the seat some other way — a room
transition stands you up directly, which is the same path that would miss an
`onStand` hook."* That is `crosstown.ts`'s `jumpToImpl` (`if (rig.seated)
rig.stand();`, used by real door/site transitions) — currently unlikely to
reach a blackjack seat only because no door sits that close today, per that
function's own comment — **but it is exactly the shape of thing this project
already got bitten by once** (item 0f, just closed: two independent "stand
me up" paths, one of which forgets to clean up after itself).

**Verified live** with `scripts/w11-blackjack-panel-stuck.mjs` (new, this
session): sit at blackjack, force-stand via `__ct.stand()` — the same kind of
external stand a room transition or this project's own test harness performs
— and the panel is *still* reported open **500 ms (many frames) later**.
Worse: pressing `E` at a **completely unrelated bench**, in a different part
of the world, does nothing at all — `seated` stays `false` and the panel
handle stays `'ct-blackjack'`. The stale panel's capture-phase gate
(`ct/hud.ts`'s `gateUp(true)`) is still up, swallowing every keydown in the
game, everywhere, permanently, for the rest of the session:

```
after sit:                          { seated: true,  panel: 'ct-blackjack' }
after external stand (500ms later): { seated: false, panel: 'ct-blackjack' }
bench prompt was: [E] sit down       state after E at bench: { seated: false, panel: 'ct-blackjack' }
```

This is the exact failure class `BUILDER-BRIEF.md` §11 names as the worst bug
this project ships — except worse than a single trapped seat, because the
stuck gate is global: **every `[E]` in the world goes dead**, not just the
one at the table. Escape still works (fp.ts's own capture listener is
independent of this panel state and isn't gated by it), so a player is not
permanently stuck — but every interaction in the game silently stops
responding until they happen to notice Escape still functions, and even then
the panel visually never goes away since nothing calls its `close()`.

## Not currently reachable through documented normal play

I looked for a real player action that force-stands the player at the
blackjack table without going through the panel's own Escape/close path, and
did not find one — every seat currently sits far enough from every door that
`jumpToImpl`'s force-stand cannot fire mid-game (that function's own comment
in `crosstown.ts` says so explicitly). **This is what let it ship unnoticed.**
It became directly, concretely reachable the moment `scripts/seats-walk.mjs`'s
own reset step (`__ct.stand()`, line ~106 of that script) exercised it — which
means any future feature that can force-stand a seated player from outside
the panel (a new door near the casino, a scripted event, a "sleep" or
"quick-travel" action reaching into the casino) will hit this without warning.

## The fix, for whoever takes it (not done here — `blackjack.ts` is not a file this session's items granted)

Match `slots.ts`'s shape: drop the `dismissed !== null` condition from the
close check, or reorder so the close check runs *before* `dismissed` is
reset. Either:

```ts
if (seat === null) { panel.close(); dismissed = null; return; }
```

or simply delete `&& dismissed !== null` at line 1282, matching `slots.ts`
exactly. The `dismissed` variable and its `onClose` assignment can likely be
deleted as genuinely dead code afterward (the file's own comment already
argues it is unreachable through the path it was written for), but that is a
separate, smaller cleanup and should be a deliberate choice by whoever owns
the file, not bundled silently into the close-condition fix.

## Also: `scripts/seats-walk.mjs` has a smaller, separate instrument gap

Independent of the blackjack bug above: every slot-machine and blackjack seat
in the suite (`'sit at the slot'`, `'sit at the blackjack table'` — ~100 of
228 registered seats) **will always fail the suite's own "E stands you back
up" sub-check** (`scripts/seats-walk.mjs:213-214`), because sitting at either
opens a panel that swallows `E` for game actions (spin/hit/stand/etc.)
instead of leaving it to the state-exit dispatch — standing up at a
panel-opened seat requires **Escape**, not **E**, and the suite only tries
`E`. This is not a world bug (verified: `w11-panel-cascade-check.mjs`, run
earlier this session, showed a lone slot seat recovers correctly and a
completely different seat sits fine immediately afterward) — it is the suite
modelling every seat as a plain look-and-sit seat when ~100 of them are not.
Queue item 5f already flagged a symptom of this ("~40 unrelated seats failing
consecutively past #200") without finding the mechanism; this note gives the
mechanism for both the small, permanent per-panel-seat false-fail and the
much larger cascade that the actual blackjack bug above causes on top of it.

## Verified

- `scripts/w11-panel-cascade-check.mjs` (new): confirms `slots.ts` recovers
  correctly from an external stand (panel closes, a subsequent different seat
  sits normally) — isolating the bug to `blackjack.ts` specifically, not to
  the general panel/seat framework.
- `scripts/w11-blackjack-panel-stuck.mjs` (new): confirms the blackjack panel
  stays open indefinitely after an external stand, and that this deadlocks
  `[E]` everywhere in the world, not just at the table.
- Read `ct/slots.ts:1402-1422` and `ct/blackjack.ts:1273-1283` side by side to
  find the exact one-line divergence, rather than inferring it from behaviour
  alone.

## Derived vs. copied

Line numbers and code quoted above were read directly from the two files this
session, not retyped from memory or a screenshot.

---

*w11. Did not touch `ct/blackjack.ts` — not a file any item I held named.
New files: `scripts/w11-panel-cascade-check.mjs`,
`scripts/w11-blackjack-panel-stuck.mjs`.*
