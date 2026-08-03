# Item 216 — the ATM PIN on the purse, and the panel caption's width budget

Worker onehundrednineteen, 2026-08-03. Worktree
`.claude/worktrees/agent-afc27ccac00de3b3d`, port **4750** (`ss -ltn` showed it
free; 4751+ also free, 5177 is the live world and was not touched).

Files changed: `src/proto/ct/atm.ts`, `src/proto/ct/hud.ts`.
The row named `ct/atm.ts` in its file column but names `ct/hud.ts` and
`ct/atm-face.ts` in its body — `Purse` lives in `ct/hud.ts` and the caption is
drawn there, so both edits are inside the item. **`ct/atm-face.ts` was not
touched** (the item says do not change the keypad or the fascia dispatch, and
nothing here needed to).

---

## 1. The PIN now lives on `Purse`, and it was not a no-op

`ct/atm.ts` held the enrolled PIN in a module `let storedPin`, with its own
docstring asking for exactly this hoist and explaining why 184 could not take it
(`Purse` is in a file 184 did not name). It is now **`purse.pin?: string`**,
beside `cash`, `account` and `card`.

**Root cause of why it was wrong:** the PIN is a property of the CARD, and it was
outliving the card. As module state it survived any rebuild of the purse — a new
game, a second world in one page, a harness building its own purse — so the
machine stayed enrolled with the previous card's PIN while the cash and the
balance started over. It now has the lifetime of the thing it guards, which is
the invariant the row asks for ("*a PIN that forgets itself differently from the
cash it guards will read as a bug*").

`undefined` means "never enrolled" and is what draws `CHOOSE A PIN` — no
sentinel, no seeding. Read through one helper, `enrolled()`, so the null-purse
case has one answer in one place.

New test hook `__atm.enrolledOnPurse()` — a **boolean**, not the PIN. It reads
`ctx.purse.pin`, i.e. the object `crosstown.ts` built and the wallet and the loan
desk also hold, so a check can see *where* the PIN lives rather than only that
the machine behaves.

## 2. The caption's width budget: `CW * scale`, capped at `92vw`

**The row says "no width budget". That is not quite it, and the difference is
why nobody had seen it.** There was a limit; it was `50vw`, and it had nothing
to do with the panel. `hud.ts`'s `wrap` is `position:fixed; left:50%` with no
`right`, so an auto-width child shrink-to-fits against the space from the
midline to the right edge — **exactly half the viewport**, whatever the panel's
size.

Measured, on the ATM's PIN screen (the longest caption this panel has):

| viewport | before | after |
|---|---|---|
| 1920×1080 | 1 line, box 487.6 px | 1 line, box 600 px |
| 1280×800 | 1 line, box 487.6 px | 1 line, box 600 px |
| 1024×640 | 1 line, box 487.6 px | 1 line, box 600 px |
| **800×600** | **2 lines, box clamped to 400 px** | **1 line, box 600 px** |

The break-even was a **976 px** window and below that the caption split in half.

The budget is now the panel's **own glass**: `CW * scale`, which is 600 CSS px
for the ATM — *a caption may never be wider than the thing it captions*. Derived,
not typed (BUILDER-BRIEF §8), and published on `cap.dataset.budget` so a check
reads the number the code used instead of a second copy of it. `width` rather
than `max-width`, because only an explicit width takes shrink-to-fit out of play;
`max-width:92vw` then keeps it on screen in a window narrower than the glass,
wrapping instead of overhanging.

This is the framework's caption, so **mail 155, library PC 157, loan 185 and
slots 208 inherit it** — which is the row's stated reason for caring.

Longest string, measured as ink rather than as a box:
**520.1 px in a 600 px budget, 87% used.**

---

## The check

`scripts/w119-caption-budget.mjs` — **standing check, re-run it after anything
that touches `hud.ts`'s caption or the ATM's hints.**

```sh
SHOT_URL=http://localhost:<your port>/ node scripts/w119-caption-budget.mjs [--selftest]
```

It sweeps 1920×1080 / 1280×800 / 1024×640 / 800×600, opens the machine with a
**held** `[E]` (§5), reaches the PIN screen by **clicking INSERT CARD with the
real mouse** projected onto the fascia's own mesh (the row asks for the mouse;
the projection asks `__atm.buttonPoint` where the button is rather than
re-deriving the layout), and asserts a **range, not a floor**: one line, ink
`> 0`, ink `<= budget`, box on screen. A caption measuring 0 px would sail
through a bare "it fits".

**Both signs.** `--selftest` overwrites the caption with a 145-character string —
placed *after* the last `paint()` write to `cap.textContent`, which is the whole
of GOTCHAS 91 — and requires the check to go red (1154 px of ink over a 600 px
budget, 2 lines), then restores it and requires the original figure back to
within 0.5 px.

**The PIN assertion was mutation-tested against a real code change**, not a DOM
poke: `submitPin` was put back to storing into module state and the tree rebuilt.
`w119-caption-budget.mjs` went **exit 1 with 2 FAILED**, both of them the purse
assertions and neither of them a caption assertion — the isolation is real. The
existing `scripts/w67-atm-pin.mjs` also went exit 1 (6 FAILED) on that mutant.
Reverted and both are green again.

**Five runs, 1280×800: 414.5 / 520.1 px of ink on every one of the five. Spread
zero** — DOM text metrics are deterministic here, unlike the renderer.

Exit codes, quoted from the command and not from after a pipe:

| | before | mutant | after |
|---|---|---|---|
| `scripts/w119-caption-budget.mjs --selftest` | (did not exist) | **1** | **0** |
| `scripts/w67-atm-pin.mjs` | **0** | **1** | **0** |
| `npm run typecheck` | — | — | **0** |
| `npm run build` | — | — | **0** |
| `node scripts/health.mjs` | — | — | **0**, `WORLD OK` |
| `npm run sweep` | — | — | **0**, `0 STATION MISS, 0 COVERAGE`, 0 errors |

All verification is on the **built bundle** (`npx vite preview --port 4750
--strictPort`), never on dev.

---

## FOUND AND NOT FIXED — the row's word "overlaps" points at something real, but
## not at what the row and `ct/atm.ts:792` say it is

**The caption does not overlap `[E] leave`, and it never could.** `[E] leave` is
concatenated into the *same single text node* by `hud.ts`
(`cap.textContent = \`${label}   ·   ${way}\``). And `#ct-prompt`, the other
`[E]` label, is `display:none` while a panel is open — measured, it does not
appear in the box list at all. Both `ct/atm.ts:792`'s comment and the queue row
inherit that claim from each other; it is wrong.

**What it really overlaps is the machine's own bottom key row.** The caption is
pinned at `bottom:7%` over the 3-D world, and on the ATM that lands squarely on
**CLR / 0 / ENT**, obscuring all three keycap labels and making the caption text
itself hard to read against pale key faces. Shots, both post-change:

- `shots/w119-216-pin-1280x800.png`
- `shots/w119-216-pin-800x600.png`

**Not fixed here, deliberately.** `bottom:7%` is shared by all six diegetic
panels (`ct-atm`, `ct-library-pc`, `ct-letter`, `ct-loan`, `ct-calendar`,
`ct-slots`), so moving it is a change to five things nobody has looked at, and
where it *should* go is a design call, not a mechanical one — the clear cabinet
face below the keys is only ~17 px tall at 1280×800 before the cash mouth starts.
The two candidates worth ranking:

1. a per-panel `PanelSpec.captionBottom`, defaulting to `7%`, so the ATM alone
   moves and the other five are provably untouched;
2. drop the caption onto the tube's own empty bottom band, where a real machine
   prints its instructions — but `hud.ts:1011` records why captions were taken
   OFF the glass (the library PC's taskbar clock), so that one is ATM-only too.

**Also queued rather than taken:** `__ct.purse()` in `crosstown.ts:1653` does not
publish `pin`, so the neutral view of the purse cannot see the field. Adding
`pin: purse.pin !== undefined` there is a one-liner, but `crosstown.ts` is
desk-owned and this item does not name it (§9).

## Values: derived or copied

- `CAP_W` — **derived**, `CW * scale`, inside `makePanel` where both already are.
- `lines` in the check — **derived** from the element's own computed
  `line-height`, not from a typed 18.2.
- the budget the check compares against — **read from the DOM**
  (`cap.dataset.budget`), so the code and the check cannot drift.
- 976 px, 487.6 px, 520.1 px, 87% — all **measured** on this tree, never
  predicted.
