# BLOCKED-K — three one-line asks, none of them mine to make

None of these stops me working; each stops a finished thing being reachable,
attributable, or true. Filed here because `scripts/desk.sh` surfaces this file as
an ACTION and a handoff note is not read by the person who has to act.

---

## 1. C — the sleep verb never calls the fade. **This is a live user request.**

The desk re-opened the row on it: *"CONFIRMED and not true at the same time."*
The capability works — A, D and H each reproduced that independently — and
`ct/apartment.ts`'s **"sleep until morning" advances the clock without it**, so
the screen never goes black.

```ts
import { screenFade } from './hud';
…
act: () => screenFade({ mid: () => ctx.clock.advance(minsToMorning, { overSeconds: 0 }) }),
```

`overSeconds: 0` matters: the ramp exists only because there was nothing to hide
the jump behind, and a ramp still running when the fade-in starts puts the sky
sweep back on screen. Shape and reasoning: `notes/K-screen-fade.md`.

**I have added the check that would have caught this and it is RED on purpose**
(`K-sleep-fade`, registered in `checks.mjs`). It presses the bed's own `[E]` and
watches the screen rather than the clock:

```
a player can reach the sleep prompt (standing at 197.05, -17.2)
the bed: clock moved 572.8 min, peak overlay opacity 0 over 65 samples
OK    pressing E at the bed advances the clock (572.8 min)
FAIL  …AND THE SCREEN GOES BLACK WHILE IT DOES (peak 0)
```

It goes green the moment that line lands. **Everything above it in that file was
green while the world had no fade in it at all** — a check that proves a kit
works is not a check that the kit is used, and that gap is mine.

**One thing for you while you are in there, found by the sweep and not filed as
a fault:** the bed now carries two spots, and **from about half the standing
positions around it, `sit on the bed and watch TV` wins the pick over `sleep
until morning`**. Both are yours. It is reachable — 43–45 of 81 swept squares
offer sleep — so this is not a blocker, but a player who approaches from the
wrong side gets the television when they meant to go to bed.

## 1b. DESK — **you cannot get back up off a seat.** 225 seats. Found tonight.

Not mine to fix — the latch is in `crosstown.ts` — and it is the most
player-visible thing I have hit. *"for every seat in the game i want to be able
to sit down"* is a user request, and so is *"im literally stuck here"*.

**Sit down on any seat you reached from more than about a metre away and there
is no way off it.** `crosstown.ts` latches `landing` when an `[E]` moves the
player more than a stride, and `canSee` then refuses **every** spot until they
walk 1.2 m clear of it. A seated player cannot walk. So no prompt is ever
offered again — including `stand up`, which is an ordinary spot like any other.

**Sitting down is itself a move of more than a stride** whenever you were
standing more than a metre from the pose. Measured on the street bench:

```
travel 0.97 m   landing not latched   GOT UP
travel 1.03 m   landing LATCHED       STUCK
travel 1.12 / 1.24 / 1.38 / 1.53 m    STUCK
```

Reproduced on the bed in 301 as well, where it also swallows `sleep until
morning`. **The comment above that very line anticipates this failure** — it
says latching everything "would stop … a seat re-offering `stand up`" — so the
intent is already right and only the threshold is wrong.

Two shapes that would close it, for whoever owns the file: clear `landing`
whenever `rig.seated`, or exempt a seat's own stand-up spot from the sight test.

`scripts/K-seat-lets-you-up.mjs`, registered in `checks.mjs`, red on purpose and
carrying its own control (the near approach, which works) so the red cannot be
read as "nobody pressed anything".

## 2. ~~A — the ATM's `[E]` hook~~ **DONE. A has wired it.**

Verified from the world at build `290814d75`: standing on the pavement at the
bank wall the prompt reads **`[E] FIRST FEDERAL — use the machine`** and pressing
it opens the cabinet. `shots/K/atm-from-the-street.png`. `K-atm-walk` now opens
it through that `[E]` rather than through `__atm.open()`, which is the half that
would have caught the machine being unreachable in the first place.

**One consequence, and it is mine to help with rather than M's to absorb:** the
label change broke `scripts/M-bank-int-walk.mjs`, which found the ATM by matching
`/check balance|balance \$/i` against its prompt. D diagnosed it. The fix is to
read the money as DATA — `__inv.cash()`, `__atm.account()`, `__atm.cash()` —
which is published for exactly this. Written up in `notes/K-money-is-data.md`.
**A prompt label is not an API**, and three of them have been reworded this
session.

## 3. Desk — `src/proto/ct/atm.ts` has no owner

New file. `scripts/ownership.sh K` passes it **by default rather than by
decision**, which `OWNERSHIP.md` itself records as costing a day, twice. I am
assuming it is mine; please write it down either way.

I also now own the shared panel framework inside `ct/hud.ts` (`makePanel`, `UI`)
that L and any future full-screen interface calls. `hud.ts` already has my name
against it, so that one is worth knowing rather than deciding.

---

## Not blocking, recorded so it is not re-derived

- **`ctx.player` publishes no facing.** `PlayerRef` has `x`, `z`, `gy` and no
  `yaw`, so a dropped item lands at the player's **feet** rather than in front of
  them — you have to look down to see it. One field fixes it.
- **The watch's forearm is bare skin.** `ct/hud.ts` carries `player.sleeve` and
  `player.cuff` for a wardrobe and `drawWatch` reads neither. That watch has had
  two unasked-for redraws reverted, so it wants a ruling and I have not touched
  it. `notes/K-queue-item-4-is-stale.md`.

— K
