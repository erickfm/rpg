# w107 — item 216, RELEASED: both halves live in `ct/hud.ts`, which item 277 holds

Worker **onehundredseven**. Measured, not built. **Released un-actioned** —
no world code changed.

The row names **`ct/atm.ts`**. Neither half of it can be done there.

---

## (1) `Purse` wants a `pin?: string` — ALREADY SATISFIED BEHAVIOURALLY

The DONE WHEN is *"the PIN persists the way cash does"*. **It already does.**

`ct/atm.ts:150` holds `storedPin` as module state, and the file's own comment
explains why that is behaviourally identical today:

> *"`openAtm` is one module shared by every ATM in the world, so there is
> exactly one card and one PIN either way."*

Confirmed by grep: **`storedPin` is read at five sites and all five are inside
`ct/atm.ts`.** Nothing outside the module reads a PIN, so there is no second
reader that could disagree with it — which is the failure mode the row is
worried about (*"a PIN that forgets itself differently from the cash it
guards"*). Both `storedPin` and `purse.cash` are session-scoped with no save, so
they forget at exactly the same moment.

What is left is a **tidiness hoist**, and the field it wants to land on —
`Purse` — is declared at **`ct/hud.ts:15`**. That is not this item's file, and
`ct/atm.ts`'s own comment already queued it in those terms: *"hoist `pin?:
string` onto `Purse` when someone is next in `ct/hud.ts`."*

## (2) The hint line — the overlap is `ct/hud.ts`'s LAYOUT, not `ct/atm.ts`'s text

`ct/atm.ts:773` opens the panel with **`chrome: 'none'`**. For a frameless panel
`ct/hud.ts` does **not** draw the hint into the caller's canvas at all — it puts
it in a **DOM element below the glass** (`hud.ts:954-963`, `cap`), screen-space
and centred, deliberately: *"a caption below the glass can never fight content
the caller owns."*

For a **diegetic** panel that reasoning does not hold. The canvas is projected
onto the machine's face in the world, so the screen-space caption lands wherever
the fascia happens to be — which is exactly what item 184's builder recorded:

> *"This line is drawn across the bottom of the viewport and it already overlaps
> the `[E] leave` label and the CLR/0/ENT key row — visible on the MENU screen
> too, with the original 34-character text, so the overlap is not mine."*

**So shortening the string in `ct/atm.ts` cannot fix it and never could** — the
34-character text overlaps too. There is no width budget to give it in
`ct/atm.ts`, because `ct/atm.ts` does not own the box it is drawn in.

This is **w41's own finding 4**, still open and now costing a second item:
> *"a diegetic panel might want to nominate where its caption goes."*

## The actual fix, for whoever owns `ct/hud.ts`

Both halves are one visit to that file:

1. `pin?: string` on `Purse` (`hud.ts:15`), beside `account` and `card`, with the
   same "seeded on first use" note `account` already carries. Then `ct/atm.ts`
   swaps `storedPin` for `PURSE.pin` — a two-line follow-up in a file that is
   free.
2. Give `cap` a **width budget** and, for a **diegetic** panel, place it where it
   cannot land on the caller's own artwork — the framework knows it is diegetic
   (`screenFocusReady()` / the `surface` branch) and the caller does not know
   where its face will be on screen.

## Why released rather than done

**`ct/hud.ts` is live under item 277** (*"exiting any overlay leaves the mouse
dead"*), confirmed on the claim board while I held this. Two builders in the
panel layer at once is the cross-builder conflict BUILDER-BRIEF §9 exists to
stop, and it is the second time today this queue has pointed an `ct/atm.ts`-
shaped item at a `ct/hud.ts`-shaped fix (item 206 was the first).

**Re-queue with `ct/hud.ts` named**, and it is worth pairing with 206 and 277 —
all three are the same file and the same panel-exit path.
