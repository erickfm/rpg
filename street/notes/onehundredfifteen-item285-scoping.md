# Item 285 — the ATM "[E] at yaw 0 does not open": SCOPED, NOT FIXED

Released un-fixed after the desk redirected me to item 286. This is what I
measured, so the next holder does not start from the row's framing — **which is
wrong at one of the two spots and structurally impossible at both.**

Measured 2026-08-03 ~13:30, on the **built bundle**, port 4712, commit `66555ca60`.

## 1. It reproduces exactly

`SHOT_URL=http://localhost:4712/ node scripts/probes/w109-atm-approach.mjs`

```
ATM spots: [{x:-7, z:7.288}, {x:-7, z:8.238}]
(-7, 7.288) yaw  0.00  prompt="[E] FIRST FEDERAL — use the machine"  panel=null
(-7, 7.288) yaw  1.57  prompt="[E] FIRST FEDERAL — use the machine"  panel=ct-atm
(-7, 7.288) yaw  3.14  prompt="[E] FIRST FEDERAL — use the machine"  panel=ct-atm
(-7, 7.288) yaw -1.57  prompt="[E] FIRST FEDERAL — use the machine"  panel=ct-atm
(-7, 8.238) yaw  0.00  prompt="[E] into FIRST FEDERAL"               panel=null
(-7, 8.238) yaw  1.57  prompt="[E] FIRST FEDERAL — use the machine"  panel=ct-atm
(-7, 8.238) yaw  3.14  prompt="[E] FIRST FEDERAL — use the machine"  panel=ct-atm
(-7, 8.238) yaw -1.57  prompt="[E] FIRST FEDERAL — use the machine"  panel=ct-atm
```

## 2. THE ROW'S FRAMING CANNOT BE RIGHT — one `pickSpot`, one `active`

The row asks whether "the PROMPT is over-generous or the OPEN is over-strict".
**Neither. They cannot disagree.** `crosstown.ts` calls `pickSpot` **once per
frame, at line 2239**, and the same `active` feeds both:

- `crosstown.ts:2241` — `const active: Spot | null = picked ? picked.spot : null;`
- `crosstown.ts:2253` — `hud.prompt(active ? \`[E] ${active.label()}\` : null)` ← the prompt
- `crosstown.ts:2287` — `active.act();` ← the press

Same variable, same frame. There is **no second predicate** for the press to be
stricter about. So "make the prompt and the open agree" is not the fix, and
looking for a `TOUCH_MARGIN`/`REACH_MARGIN` split (the row's suggestion) is a
dead end — **`pickSpot` is the only consumer of either constant**, and it runs
once.

The mismatch is therefore **downstream of the pick**: `act()` runs and its
effect is not a raised panel.

## 3. AT THE SECOND SPOT THE PROMPT DOES NOT LIE AT ALL

`(-7, 8.238) yaw 0` prompts **`[E] into FIRST FEDERAL`** — that is the **bank
door**, a different spot, and `panel=null` is the *correct* result of pressing
it (a door does not raise a panel; it moves you). The row asserts the ATM
prompt is shown at yaw 0 at BOTH spots. **It is not.** Half the reported
evidence is a door behaving properly, and any fix "confirmed" by making this
row go green would be green for the wrong reason.

Only `(-7, 7.288) yaw 0` is a genuine prompt/act mismatch.

## 4. THE PROBE'S WARP IS AN UNCONTROLLED VARIABLE — fix this first

`w109-atm-approach.mjs:32` does `warp(s.x, s.z, yaw, 0, 0)` — it warps the
player to **the spot's own x,z**, which is `x = -FACE`, i.e. **inside the bank
facade** (`ct/bank.ts:655-656`, `{x: -FACE, z: zc, r: 1.25}`). Where the player
actually ends up is then decided by the rig's `unstick`, not by the probe.

That matters because `pickSpot`'s **tier 1 is `d < RADIUS`** ("the spot's centre
is inside your own body", `fp.ts:1018`), which wins *regardless of yaw*. Whether
tier 1 fires therefore depends on how far unstick shoved the player — which is
exactly why the two spots disagree at yaw 0 above. **A yaw sweep from inside a
wall is not the player's approach**, and the user's complaint is about walking
up to the machine.

**Next holder: re-measure from a realistic stand-off** (~1.0-1.2 m out from the
facade, `x > -7`), not from the spot centre, and record `__ct.pos()` after the
warp so the distance is a known quantity rather than an unstick outcome.

## 5. What I ruled out

- **`dismissedAt` / `DISMISS_LOCKOUT`** (`ct/hud.ts:1150-1162`, 500 ms) — the
  probe waits 350 + 600 = 950 ms after `closePanels()` before pressing, so the
  lockout has expired. Not this.
- **The ghost prompt** (row's own warning) — ruled out: the prompt *changes* with
  yaw at `(-7, 8.238)` (ATM ⇄ door), so it is live, not a stale string.
- **`openAtm()` itself** (`ct/atm.ts:747`) — no yaw term; `if (!panel || !PURSE)
  return;` then `panel.open()`.

## 6. The open question I did not get to

At `(-7, 7.288) yaw 0`: `active` is the ATM, `act()` → `openAtm()` → `panel.open()`,
and `panel()` still reads `null` 1300 ms later. Either `open()` returned early at
`ct/hud.ts:1157` (`if (open) return;`) / `:1162` (lockout), **or it opened and
something closed it again**. I did not distinguish these.

**Sample the panel repeatedly across the press** (e.g. every 100 ms for 1.5 s)
rather than once at the end — a single late read cannot tell "never opened" from
"opened and shut". That is the one measurement that splits the remaining cases,
and it is ~10 lines on top of the existing probe.

## 7. Not checked

The row's "five diegetic tenants that copy this pattern" (slots, mail, library
PC, loan, calendar) — **not examined at all.**
