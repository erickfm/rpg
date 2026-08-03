# Item 232 — the margin call sites, and a ghost in the prompt

**Worker eightyeight, 2026-08-03.** Port **4440** (verified free with `ss -ltn`;
4186, 4270-71, 4370, 4380, 4410, 4420 and 5177 were taken). Everything below was
measured on the **built bundle** under `vite preview`, not on dev.

---

## The row's central claim is true, and the population was bigger again

`fp.ts` today:

```
771  export const REACH_MARGIN = 0.6;
778  export const TOUCH_MARGIN = 0.15;
991    const touching = d < s.r + TOUCH_MARGIN;        ← the aim-free predicate
1006     && (!seated || d < s.r + REACH_MARGIN);       ← REACH only when SEATED
1124   ring(spot.r + REACH_MARGIN, …)                  ← the debug ring
```

The desk said 9 call sites in 6 files; worker eightyfour corrected it to 16
files. **Both undercount, because `grep REACH_MARGIN` cannot see a hand-typed
`0.6`** — and one of the two registered checks the row is really about,
`A-eye-height-holds.mjs:162`, was exactly that (`s.d <= s.r + 0.6`). Searching
for `r + 0.6` as well as for the symbol is what found it.

## What the wrong margin actually costs — measured, not argued

`scripts/probes/w88-margin-population.mjs`. The disputed ring
`r+0.15 .. r+0.60` is **0.45 m wide around every spot**. Standing in it, facing
180° away, at every live spot that can be stood at:

| | |
|---|---|
| spots sampled in the band | **10** |
| a `r + 0.6` check calls "within reach" | **10** |
| the world actually offers | **0** |
| control, standing inside the radius | **7 of 11** produce a prompt |

So the false-green rate inside the band is **100%**.

## The two REGISTERED checks — proven red where they were green

`scripts/probes/w88-registered-checks-flip.mjs`, **2 of 2, identical across five
runs** (`w88-flip-x5.sh`):

| check | spot | old `r+0.6` | new `r+0.15` | the world |
|---|---|---|---|---|
| `O-jail-walk.mjs` | HOUSE OF DETENTION, r 1.05 | near ✓ (green) | not near (**RED**) | offers nothing |
| `A-eye-height-holds.mjs` | sleep until morning, r 0.75 | near ✓ (green) | not near (**RED**) | offers nothing |

**The flip could not be shown by re-running the checks as they stand, and that
is a finding rather than a dodge:** at both of them the player ends up **0.18 m**
from the spot, inside *both* margins. The false green is **latent** — it bites
when the door or the stopping point moves ~1.2 m, not today.

**A canfail case was tried and rejected.** Shrinking `interior.ts:1435`'s
`doorR` until the player falls in the band also drives
`lookTolerance(r, d) = atan2(r, max(0.35, d))` to 0 rad, so nothing in the world
can be aimed at either and the check goes red for three reasons at once. Item
233's rule is that CAUGHT must mean red *because of* the mutation.

`canfail eye-gate-flat` still reports **1/1 CAUGHT** after my edits, so
`A-eye-height-holds` kept its sensitivity.

## ⚠ THE FINDING THAT OUTLIVES THIS ROW: `#ct-prompt`.textContent IS A GHOST

`ct/hud.ts:1715`:

```js
if (text === null || panelUp()) { promptDiv.style.display = 'none'; return; }
promptDiv.textContent = text;
```

**It hides the element and returns WITHOUT clearing the text.** The prompt
therefore keeps the last thing it ever offered, permanently.

Measured (`probes/w88-does-prompt-clear.mjs`): warped **40 m** up the street
from the jail door, and again after a real `'w'` movement nudge, `textContent`
still read `[E] into the HOUSE OF DETENTION`.

**`display` is the truth; `textContent` is only the caption on it.**

This is not mine alone: **75 scripts read `#ct-prompt`, and 18 never mention
`display` at all.** Any of them that concludes *"not offered"* from an empty or
stale string is reading a corpse. I fixed it in the file I hold
(`A-eye-height-holds.mjs`, whose entire verdict rested on that read) and in my
own probes. **The other 17 are a queue item, not something I touched.**

It is also what made the jail look impossible for an hour: a spot 1.34 m away
and 180° off axis appeared to be offered, and it was the screen lying.

## Per-call-site decisions — this is NOT a blanket replace

**TOUCH** (standing, aim-free — `fp.ts:991`):
`O-jail-walk.mjs` near test · `A-eye-height-holds.mjs` candidate filter ·
`O-verify-N-rent.mjs` · `probes/O-jail-walk-fix.mjs` · `probes/F-diag-owalk.mjs`
near test.

**REACH, and correctly so:**

- `O-verify-C-stuckfix.mjs` — the player is **SEATED** (`sit()` is awaited three
  lines above), and `fp.ts:1006` is the seated clause. **The constant was right;
  only the derivation was wrong** (hand-typed `0.6` → `__ct.reachMargin()`).
- `probes/w74-why-not-offered.mjs` — seated diagnostic; now derives both and
  additionally reports `touchingIfStanding`.
- **The way-out landing bounds in `O-jail-walk.mjs` and `F-diag-owalk.mjs`.**
  These assert `gap > bound`, so a **smaller** margin is the **weaker** test:
  swapping to touch would drop the bar 1.65 m → 1.20 m and pass landings they
  currently reject (BUILDER-BRIEF §7). An *aimed* player re-triggers from up to
  6 m with no margin at all, so 0.15 is a floor on the real re-entry distance,
  not a description of it. Measured gap is 2.20 m, clearing the 1.65 m bound by
  0.55 m.

**DELETED:** `A-verify-select-through.mjs`'s `const REACH = 0.6` — it was passed
into `p.evaluate` and **never referenced in the body**, carried a dead citation
(`fp.ts:486`; it is at `:771`), and asked for a fix that has since landed.

## Runtime `fp.ts` imports — 5 converted, 3 blocked, 1 deliberate

The import 404s on the bundle, re-measured today:
`UNAVAILABLE — Failed to fetch dynamically imported module`, while `__ct` gives
`reachMargin()=0.6 touchMargin()=0.15`.

**Converted** to `__ct.touchMargin()` / `reachMargin()` / `playerRadius()`, each
with an abort if the accessor does not resolve: `probes/w40-301-grid.mjs`,
`probes/w54-doorway-yaw.mjs`, `probes/w54-turn-stability.mjs`,
`probes/w54-firing-station.mjs`, `w40-bed-vs-door.mjs`. The last now prints a
real `RADIUS=0.36 TOUCH_MARGIN=0.15` where the import gave `undefined`.

**BLOCKED, and I did not take them** — they need `lookTolerance` or `pickSpot`,
and **neither is published on `__ct`**. Publishing them is a `crosstown.ts`
edit, and item 232 does not name that file (BUILDER-BRIEF §9):

- `probes/w40-227-frame.mjs:53` and `probes/w40-301-who.mjs:41` — `lookTolerance`
- `probes/w40-resolver-map.mjs:103` — `pickSpot`

**Deliberate, leave alone:** `probes/w80-touchmargin-reachable.mjs` — its whole
job is to measure that the import fails.

## Five faults this probe found in itself

Worth recording, because every one would have produced a confident wrong number:

1. one approach bearing walks into the facade — try 16;
2. "is there a prompt" scored a **neighbour's** prompt as this spot's;
3. the yaw was computed from the position *asked for*, not the one *landed in*,
   so "facing away" was sometimes facing at it (flip rate 2,2,1,1,1);
4. `waitForTimeout` is not a frame — pump rAF;
5. the ghost prompt above.

## What I inherited, and did not cause

- `O-jail-walk.mjs` — **1 of 11 red**, `and on the PAVEMENT, not in the road —
  55 < 60.12 < 57`. Identical before and after my change; nothing to do with
  margins.
- `A-verify-select-through.mjs` — **33 leaks through a wall**, pre-existing. My
  change there removed a provably unused parameter and cannot have moved it.
- `O-verify-C-stuckfix.mjs` — **1 of 2 disagreed**, `no "stop watching" prompt
  while seated`. The script's own text records this as its earlier finding, and
  my edit kept the identical value (0.6), only deriving it.

## Verification

`npm run sweep` → **sweep findings: none (0 STATION MISS, 0 COVERAGE)** ·
`node scripts/health.mjs` → **WORLD OK** · `npm run typecheck` → **clean** ·
`canfail eye-gate-flat` → **1/1 CAUGHT**.
