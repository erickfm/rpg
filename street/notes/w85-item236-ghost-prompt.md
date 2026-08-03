# w85 — item 236: the ghost prompt, fixed at the source

Measured on the **built bundle** at port **4410**.

## The row was right in every clause

`ct/hud.ts` `prompt()` hid `#ct-prompt` and returned **without clearing
`textContent`**, so the last caption lingered indefinitely. Confirmed at the
source and reproduced: with the line reverted, my guard finds **18 ghost
readings**, e.g. `[E] into FIRST FEDERAL` read from a hidden element.

**Root cause, one line:** hiding an element does not empty it, and every reader
that asks "what is the world offering?" asks `textContent`, not `display`.

## The fix

```ts
if (text === null || panelUp()) {
  promptDiv!.style.display = 'none';
  promptDiv!.textContent = '';      // <- this
  return;
}
```

**At the source, not in the readers** — one line repairs all 77 at once, where
patching the 16 would leave the next reader written holding the same loaded gun.

## Verified nothing depended on the stale value FIRST

The row said to check before changing the setter. The only `#ct-prompt` mentions
anywhere in `src/` outside this block are **three comments**
(`main.ts:91`, `hud.ts:875`, `hud.ts:1100`). No in-game reader consumes it. Safe.

## The audit of the readers

| | |
|---|---|
| scripts referencing `#ct-prompt` | **77** |
| guard on visibility (`display`/`offsetParent`/`getComputedStyle`) | **61** — already correct, left alone |
| do **not** guard | **16** |

**All 16 are now correct by construction, not by luck**, and I checked the one
way that could have failed to be true: a reader that treats `''` as *absent* is
fixed by this change, but a reader comparing the text to `null` would still see
a value, because `'' !== null`. **Zero of the 16 compare to `null`** — they all
use truthiness or `?? null`. So none needed touching.

Two of the 16 are worker eightyeight's own diagnostic probes
(`w88-does-prompt-clear.mjs`, `w88-why-jail-offers.mjs`), which read the raw
`textContent` deliberately because that is the thing they were written to
expose. They are still correct and now report `null` at 60 m up the street where
they previously reported the jail.

## How many verdicts MOVED: zero

Only **one** of the 16 unguarded readers is a registered check in `checks.mjs`:
`w40-bed-vs-door`. Run against the pre-fix `dist/` and then against the rebuilt
one:

```
BEFORE  MEASURED FINE — both ends of the knob hold, and the band between them does too.
AFTER   MEASURED FINE — both ends of the knob hold, and the band between them does too.
```

The other 15 are unregistered probes, and the 61 guarded readers cannot change
by construction. **So no past suite verdict needs to be distrusted on account of
this** — the damage was to ad-hoc probing, which is exactly where eightyeight
hit it, and it is real damage even though it never reached the board.

## The new guard: `scripts/prompt-not-a-ghost.mjs` (registered)

Asserts the **invariant**, not the one symptom:

> **hidden ⇔ empty**

Both directions, deliberately. "Hidden but full" is the ghost; **"shown but
empty" is its mirror** — a caption bar with nothing in it — and a check testing
only one direction would pass a future `prompt()` that cleared the text and
forgot to hide the box.

Population floors on both, because "no ghosts" over a run where the prompt never
appeared is the same sentence as "no ghosts":

```
281 published spots
28 of 40 sampled spots SHOWED a caption
6 of 6 open-ground points HID it
0 ghosts · 0 empty caption bars
```

**Proven to fail**: with the one line reverted and the bundle rebuilt it reports
`18 ghost(s)`; restored, it passes. No `canfail` case added — item 229 is
someone else's file this session.

## Not fixed / worth knowing

- The 16 unguarded readers are *correct* now but still **fragile**: they would
  break again the moment anything re-introduces a stale caption anywhere. The
  registered guard above is the compensating control, which is the cheaper trade
  than editing 16 files.
- `panelUp()` also suppresses the prompt, so the invariant holds while a panel
  is open too — the guard samples spots only with no panel up, so that path is
  argued rather than measured. A follow-up could open each frameless panel and
  re-assert.
