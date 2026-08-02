# w4 — item 5i, drop the redundant chrome on the loan desk and the letter — FIXED

## Root cause (one line)
Same as item 0c, exactly as the item says: `ct/hud.ts`'s `makePanel()`
always wrapped a caller's screen in a second, framework-drawn cabinet
(bezel, title band, caption strip), but `int-bank.ts`'s loan application
(`draw`) and `tenancy.ts`'s letter (`drawLetter`) each already paint a
complete, self-contained fascia of their own — the loan's own letterhead and
`FIRST FEDERAL` masthead, the letter's own paper, fold creases and sender
line — filling their canvas edge to edge. `chrome: 'none'` (added to
`PanelSpec` by item 0c/w8, already landed) already exists for exactly this;
these two panels were simply never switched to it, which is precisely what
w8's own handoff flagged as found-but-out-of-grant.

## What I did
`ct/int-bank.ts`: `ct-loan` panel's `chrome: 'cloth'` -> `chrome: 'none'`,
removed the now-meaningless `title: 'LOAN APPLICATION'` (frameless has no
title band to put it in, and the form's own masthead already says what it
is). `ct/tenancy.ts`: `ct-letter` panel's `chrome: 'cloth'` -> `chrome:
'none'` (it already had no `title` set, for its own stated reason — the
sender line at the top of the paper).

## Verification
- **New check**, `scripts/w4-frameless-loan-letter.mjs` (did not edit
  `w8-frameless-panels.mjs` — OWNERSHIP.md: don't edit another agent's
  script; wrote a new one in the same shape instead). Opens each panel via
  `window.__hud.openPanel(id)`, a general test affordance `hud.ts` already
  exposes — confirmed both panels are built EAGERLY at world start (`ct-loan`
  is a top-level `makePanel()` call in int-bank.ts's room builder; `ct-letter`
  via `buildPanel()` called directly at `tenancy.ts:900`, outside any
  interaction), so `openPanel` opens the exact same object a real
  interaction would, not a separate path.
- Asserts the canvas is now EXACTLY the caller's own declared size: `ct-loan`
  300x214 (source: `int-bank.ts`'s own `w: 300, h: 214`); `ct-letter` 192x178
  (`SHEET` is module-private, not exported, so cited by line —
  `tenancy.ts:616 const SHEET = { w: 192, h: 178 }` — rather than retyped
  blind, GOTCHAS §8).
- **Mutation-tested per GOTCHAS §27**: stashed both file changes, rebuilt,
  re-ran — both FAIL, at the exact old padded sizes (`ct-loan` 328x274,
  `ct-letter` 220x224 — both exactly `BEZEL*2` wider and
  `BEZEL*2+TITLE_H+CAPTION` taller than the fixed sizes, confirming the
  padding source rather than coincidence). Restored, rebuilt, re-ran — both
  PASS again.
- Also asserts Escape closes each panel and stands the player back up
  (BUILDER-BRIEF §11 — a panel you cannot close is the worst bug this
  project ships), and zero console errors. All PASS.
- **Existing suites, unmodified, both full green**: `M-bank-int-walk.mjs`
  (the bank's own 54-check assertion suite, including the entire loan flow —
  read the form, apply, get refused, get approved, collect at the teller,
  pay it back, a partial payment, the desk answering at 3am — through the
  now-frameless `ct-loan` panel) — 54/54. `N-post-waiting.mjs` (mailbox/rent
  assertion suite, including opening and reading real letters through
  `ct-letter`) — all green.
- tsc clean. `npm run build` clean (same two pre-existing, unrelated
  warnings). `bugsweep.mjs` against the built preview — exit 0, zero
  STATION MISS, zero new console errors.
- **A screenshot briefly worried me and was wrong.** `shots/w4-ct-loan.png`
  (not committed) looked, to my eye, like it still had an outer beige bezel
  with a faint "LOAN APPLICATION" title. I did not trust that — GOTCHAS §1/
  BUILDER-BRIEF: screenshots are for looking, never for proving — and
  checked the live DOM directly instead: `#ct-loan` has exactly two
  children, the 300x214 canvas and the plain-text caption div, nothing else.
  No bezel element exists to produce what I thought I saw; it was the dark
  radial vignette (`#ct-panelback`) plus the bank interior's own architecture
  showing through it. My own verdict, from the DOM, not the screenshot:
  clean, matching the numeric assertion that already passed.

## What I did NOT check
Did not attempt true pixel-perfect world-anchoring (the panel projected onto
real 3-D screen geometry, the way the TV does) — w8's own note already
flagged that as a separate, larger follow-up needing exports from files this
item does not name, and item 5i doesn't ask for it either. Did not
investigate the pockets/wallet panel — w8 already ruled it needs a different
(held-object) treatment and this item explicitly says to ask the desk before
touching it, which I have not done because I did not touch it.

## Derived vs. copied
`SHEET`'s value (192, 178) is copied from `tenancy.ts:616` by citation (line
number given) because it is module-private and cannot be imported — the
honest fallback GOTCHAS §8 describes when import isn't possible. Everything
else (the `w:300,h:214` expectation, the panel ids, the mutation-tested old
padded sizes) is either read live off the running world or taken directly
from the two files this item names.
