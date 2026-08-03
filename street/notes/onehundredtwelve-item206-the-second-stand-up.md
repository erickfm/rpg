# Item 206 — closing a panel from a chair now leaves you in the chair

**Worker onehundredtwelve, 2026-08-03. Ports 4681 (dev) and 4682 (built preview).**

## Root cause, in one line

**There were TWO unconditional stand-ups, in two files, and fixing either alone
is inert** — worker onehundredseven's `crosstown.ts` half re-seated the chair and
`ct/hud.ts`'s `close()` stood the player straight back up three lines later.

## What was already done, and what this adds

`onehundredseven` landed the `crosstown.ts` half (`06ed3b33d`) and released the
item at the file boundary with a note saying exactly this. It is kept unchanged
and built on — in particular **it restores the remembered pose rather than
recomputing one**, which matters now that item 280 ships per-seat sprite
placement: a recomputed pose can land the player somewhere item 93's 219-entry
seat-offer vector does not expect.

This adds the second half:

- `ScreenFocus.leave` is now `() => boolean` — **it reports whether it put the
  player back on a chair they already held.**
- `ct/hud.ts`'s `close()` captures that and **skips its own structural stand-up
  in exactly that case.**

**Why the answer has to travel between the files rather than be decided in one.**
`ct/hud.ts` knows the player was seated when the panel opened (`seatedAtOpen`).
Only the focus controller knows whether that seat was the player's own, because
only it called `rig.sit` and watched it early-return (`fp.ts:285`). Neither can
answer alone, which is why the diagnosis kept coming out half right.

**The anti-trap guarantee is not weakened.** The case now skipped is the one
where the player is provably not stranded: back on a seat they walked to, whose
own `[E]`/`[ESC]` contract stood them up before any panel existed. A machine that
seated you, and a screen-space panel with no focus controller at all, still stand
you up exactly as before.

## Proof

**`scripts/probes/w107-seat-keeps-you.mjs` — 9/13 → 13/13**, on the **built
bundle**, including the two that only a second file could fix:

```
ok  STILL IN THE CHAIR one frame after Escape
ok  STILL IN THE CHAIR 30 frames later — forceUp did not eject us late
ok  [E] out of the panel ALSO leaves you in the chair
ok  the prompt names BOTH exits, so ESC is never ambiguous
    ("[E] use the computer   ·   [ESC] stand up")
ok  a second Escape stands you up out of the chair
```

**Item 188's contract re-measured rather than trusted** (BUILDER-BRIEF §6b — the
row's 29/0 is unstamped). `scripts/probes/w69-seated-offers.mjs`, all 219 seats,
run on the tree **before** and **after**:

```
                              before        after
only standing up on offer       126          126
opened a machine, [ESC] out      93           93
NO WAY OUT                        0            0     <- BUILDER-BRIEF §11
```

**The distribution is identical.** What changed is the outcome at the 93 machine
seats: `[ESC] -> stood up` becomes `[ESC] -> still seated`, with the prompt still
naming both exits. That is the item, measured across 93 seats rather than the one
the probe walks.

`tsc --noEmit` clean · `health.mjs` WORLD OK · `bugsweep` 0 STATION MISS, 0 new
console errors — all on the built bundle.

## Found and NOT fixed

1. **⚠ THE ATM EXIT PATH IS NOT DRIVEN, AND I COULD NOT DRIVE IT.** The desk
   asked for it by name. `scripts/probes/w112-item206-standing-exits.mjs` finds
   the spot from the world (`ct/bank.ts:658`, `"FIRST FEDERAL — use the
   machine"` — the string "ATM" appears nowhere in it, which is worth knowing),
   stands at it, and gets the prompt:

   ```
   approach 0: prompt="[E] FIRST FEDERAL — use the machine"
   approach 0: [E] pressed, ct-panelback still down     (after 1.7 s)
   ```

   So the prompt is offered and a held `[E]` does not raise `#ct-panelback`.
   Either the ATM's panel does not use that backdrop, or `[E]` is not firing
   there. **This is the same gap that made onehundredseven's probe skip its own
   standing section** (*"no ATM spot offered right now — skipped, and NOT counted
   as a pass"*), so it predates this item. The probe **exits 3** rather than
   passing over nothing.

   **What I can say about the ATM without measuring it is reasoning, not
   evidence, and it is labelled as such:** the player is standing, so `chair` is
   `null`, `leave()` returns `false`, and `close()` takes the identical branch it
   took before this change. The code path is untouched. *That is an argument, not
   a measurement, and the desk should treat it as one.*

2. **The bank's client chair still blinds the seated `[E]`** — 1.13 m of seat
   movement against `landing`'s 1.0 m latch, 2 of 219 seats. Reported by
   onehundredseven, confirmed still present, deliberately not absorbed here; the
   desk said it is being queued separately.

3. **`ct/hud.ts`'s `close()` had no way to tell a caller's release from its own
   fallback.** The `exit`/`release` mechanism and the `seatedAtOpen` fallback now
   overlap in one more way. Not a defect today, but if a third rule lands in this
   function it wants collapsing into one "how do I undo the way in" record.
