# Item 279 — the CHECK was wrong. The world had been right for a while.

**Worker onehundredtwentythree, 2026-08-03.** Port **4194**, built bundle,
`npx vite preview`. Row's numbers stamp was ⟨2026-08-03 12:11⟩, ~3 h old, so it
was re-measured first: **it reproduces on merged mainline.**

## The verdict the row asked for

> **DONE WHEN: `D-walk`'s ATM leg passes for a reason you can state, you say
> whether the check or the world was wrong, and a deliberate break still
> reddens it.**

**The check was wrong.** Not stale — *inverted*. It asserted the exact thing the
user asked not to happen.

`scripts/D-walk.mjs` counted full-screen DOM overlays (`>300×200`, `position:
fixed|absolute`) and asserted the count went **up** when you press `[E]` at the
cash machine. `ct/atm.ts:775` gives its panel

```ts
surface: { mesh: screenMesh, standoff: 0.75, fov: 58, hot: hotAt, click: clickAt },
```

on the user's own words — *"i want … the screen on the literal atm be the
overlay"*, and item 0c, *"i never want there to be menus popping up unless they
are embedded to look as if they are in the actual game"*. So opening the machine
paints the panel's canvas onto the cabinet's raked screen face **in the world**.

Measured (`scripts/probes/w123-item279-what-opens.mjs`, `…-on-the-machine.mjs`):

| | closed | open |
|---|---|---|
| DOM overlays >300×200 | 3 (`div#app`, `div#ct-watch`, `div#ct-wallet`) | **3** |
| `#ct-atm` wrapper | opacity 0 | opacity 1, but its **canvas is 0×0** |
| screen mesh's `map.image` | its own baked 99×68 fascia | **the 300×205 panel canvas** |
| `__hud.panel()` | `null` | `"ct-atm"` |
| `__atm.padLive()` | `false` | `true` |

The framework hands the pixels to the mesh and collapses the screen-space
canvas, so a `>300×200` predicate **can never see it**. `3 → 3` for ever.

**And the clause below it was a sleeper.** `and ESC gets you back out of it:
3 -> 3` passed on every run — of a machine that had never opened.

**The old assertion would have gone GREEN on the regression.** Measured: with
`surface:` taken back off, the overlay count goes **3 → 5**, which is exactly
what the old check wanted. It was guarding the opposite of the requirement.

## What the leg says now

State reads, all deterministic, all two-sided, ~milliseconds:

```
the ATM cabinet is registered and nothing is up yet: up null, onMachine false, padLive false, panels 7
and pressing E opens the machine: null -> "ct-atm", padLive false -> true
and it opens ON THE CABINET — the screen face wears the panel canvas: onMachine false -> true
and ESC gets you back out of it: up "ct-atm" -> null, onMachine true -> false, padLive true -> false
```

- **Population floor**: `__hud.panels()` must contain `ct-atm` and nothing may
  already be up, or everything below is meaningless.
- **`onMachine` retypes no number.** `makePanel`'s `CanvasTexture` is a *view*
  onto the panel's own canvas, so while the cabinet wears the panel its
  `material.map.image` **IS** the `#ct-atm` canvas element. An identity, not a
  dimension — BUILDER-BRIEF §8.
- **`padLive` only moves in `onOpen`/`onClose`**, so it proves the framework
  really ran the open rather than something merely looking open.
- **The ESC clause now carries `a1.up === 'ct-atm'` inside its predicate**, so it
  cannot report green on a machine that never opened. That is GOTCHAS 34, and it
  is the bug the leg had.
- **`hold('e', 120)` instead of `press('e')`**, using the helper this file
  already has. Measured (`…-tap-vs-hold.mjs`): a bare tap opens it 5/5 once the
  world is warm but **fails on a cold page** — so the tap is *not* why this leg
  was red (it runs last, minutes in), but it would have made the leg depend on
  how long the run before it took. One word, no new harness.

## §10a — what I deliberately did NOT enshrine

The standing rule landed mid-item: *"stay away from tests that are failure
prone"*, *"tests should not take longer than the work to code itself"*.

I had written a fifth clause asserting **"and nothing popped up over the camera
— no new full-screen overlay"**, reusing the old DOM count inverted. It works:
**3 → 3** clean, **3 → 5** under the screen-space mutation. **I removed it.** It
is a world-wide DOM heuristic that any future HUD element trips for a benign
reason, and it caught nothing `onMachine` did not already catch — under mutation
2 the two failed together. The number is here in the note instead of in a clause
that can cry wolf. The comment in `D-walk.mjs` says the same, so nobody re-adds
it thinking it was an oversight.

## A deliberate break still reddens it — two mutations

| mutation | result |
|---|---|
| `openAtm()` no longer calls `panel.open()` | **3 FAILS** — E opens nothing, not on the cabinet, and ESC (previously the sleeper) now fails too |
| `surface:` removed, i.e. back to a screen-space pop-up | **1 FAIL** — `onMachine false -> false`. This is the regression against the user's words, and it is the one the old check rewarded |

Total cost of the leg: four `page.evaluate` reads. No timing, no pixels, no
repeat runs.

## What I did not touch

- **`ct/atm.ts` is unmodified.** Both mutations were applied, measured and
  reverted; `git status` is clean on it.
- The **cold-page tap** finding is real but is not a defect in anything the row
  covers: a bare `press('e')` 420 ms after load does not register, warm it does.
  If another script presses `[E]` as its first act after `goto`, it has this
  bug. I did not audit for that — **it is an honest gap**, and a grep for
  `keyboard.press('e')` early in a file would find any others.
- The other legs of `D-walk` were already green and are untouched.
