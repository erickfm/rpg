# Item 216 — SCOPED, NOT FIXED. And half of it is already satisfied.

Worker **onehundrednine**, 2026-08-03. Released un-actioned after measuring, on
build `9825d1234`+mainline, port 4650, **on the built bundle**. No code changed.

I ran out of session before I could implement, guard and mutation-test this
properly, and the brief is explicit that a scoping note beats a `done.sh` over
work only scoped. What follows is the measurement, which changes the item.

---

## Part 2 (the hint line) — THE PREMISE IS WRONG, and the work is nearly nil

The row says the hint line *"has no width budget and text already overlaps"*, and
cites 184's builder, who wrote in `ct/atm.ts` that it *"already overlaps the `[E]
leave` label and the CLR/0/ENT key row"*.

**Measured at the real panel size, 1280 × 800, with the ATM actually open**
(`scripts/probes/w109-216-hint-width.mjs`):

| screen | caption text | width | box |
|---|---|---|---|
| MENU | `click a button, or press its number   ·   [E] leave` | **382.0 px** | x 449 → 831, y 725.8, h 18.2 |
| PIN | `click the keys below, or type it — CLR backs out   ·   [E] leave` | **487.6 px** | x 396.2 → 883.8, y 725.8, h 18.2 |

**There is no DOM overlap, on either screen.** Specifically:

1. **It does not overlap the `[E] leave` label, because that label IS part of the
   same string.** `ct/hud.ts:1068-1080` appends `   ·   [E] leave` to the
   caller's own hint and writes the result into one `<div>`. There are not two
   elements to collide. The widths above are the whole line including it.
2. **It does not overlap the CLR/0/ENT key row, because that row is not in the
   DOM.** For a diegetic panel `hud.ts` sets `cv.style.display = 'none'` — the
   canvas the keypad is painted into is **hidden**, and the keys the player sees
   are the ones on the 3-D fascia mesh in the world.
3. **Nothing else visible is near it.** With the ATM up, `#ct-prompt` is not
   shown and `#ct-watch` is stowed off-screen at y 823.3 in an 800 px viewport
   (item 189's fix, which I re-verified this session).
4. **It is a single line and does not wrap** — h = 18.2 px at `font:13px/1.4`.

So whatever 184's builder saw, it is **not a DOM collision**. The plausible
reading of their words is a *visual* one: the caption sits at `bottom:7%` of the
viewport and the machine's own physical keypad is in frame right there, so the
text reads as sitting over the machine. That is a **placement** question, not a
width one, and it is not what this row asks for.

### The budget already exists — it just is not stated

`ct/atm.ts:331` declares `const W = 300, H = 205` and the panel spec declares
`scale: 2`. A **non-diegetic** frameless panel's caption is bounded by the
canvas above it, i.e. `W * scale = 600 px`. That is the natural, **derived**
budget, and both strings already fit it:

```
budget   W * scale            600.0 px
MENU     382.0 px             64% of budget
PIN      487.6 px             81% of budget   ← the longest
headroom 112.4 px
```

**So "prove the longest string fits" is already true against the only
non-arbitrary budget available.** What is genuinely missing is that *nothing
states or enforces it* — a future tenant (mail 155, library PC 157, loan 185,
slots 208) can write a 74-character hint and no check will say a word. 184's
builder tried one and recorded that it "made it markedly worse".

### What the next builder should actually do — small

1. State the budget in `ct/atm.ts` **derived**, not typed:
   `const HINT_BUDGET_PX = W * scale;` beside the `hint` spec.
2. The enforcement belongs in `ct/hud.ts`, not `ct/atm.ts`, because the caption
   is the framework's element and the `· [E] leave` suffix is the framework's
   text — **a caller cannot budget a string it does not finish building.** One
   `max-width` on `cap` plus a dev-time warn when the measured width exceeds it
   would cover all five tenants at once instead of just this one.
3. Guard it by **measuring the rendered `getBoundingClientRect().width` of the
   caption div** for every screen the panel can reach, against the declared
   budget. Do not count characters — the font is proportional-ish and the `·`
   and `—` are wide.
4. **Population floor:** assert the probe actually reached both ATM screens
   (idle/menu *and* pin). A run that never pressed INSERT CARD measures the
   short string twice and passes while never seeing the long one.

**⚠ `ct/hud.ts` is NOT named by this item.** If the next builder takes the
framework fix above, the row needs to name it.

---

## Part 1 (`Purse.pin`) — real, untouched, and it needs a file the row does not name

Currently `ct/atm.ts:150` holds `let storedPin: string | null = null;` as module
state. 184's builder documented the compromise and queued exactly this hoist:
*"Queued rather than taken: hoist `pin?: string` onto `Purse` when someone is
next in `ct/hud.ts`."*

`Purse` is declared at **`ct/hud.ts:15-32`**, beside `account?: number` and
`card?: boolean` — `account`'s own docstring records the identical coordination
problem being solved the identical way.

**The row names only `ct/atm.ts`, and this cannot be done without editing
`ct/hud.ts`.** That is BUILDER-BRIEF §9's boundary exactly, and the reason I am
reporting it rather than quietly widening scope. The row should name
`ct/hud.ts` as well; it is a one-line field addition plus swapping
`storedPin` for `PURSE.pin` in the four places `ct/atm.ts` touches it
(`atm.ts:150`, and the reads/writes around `submitPin`).

**Behaviourally nothing changes today** — 184's builder measured this too:
`openAtm` is one module shared by every ATM, so there is exactly one card and one
PIN either way. The value is that the PIN then persists *by the same mechanism*
as the cash it guards, which is what the row's "the PIN persists the way cash
does" is really asking for.

---

## What I did NOT do

Everything. **No source file was changed for this item.** The only artefact is
`scripts/probes/w109-216-hint-width.mjs`, which produced the table above and is
worth keeping because it is the measurement the next builder would otherwise
repeat.
