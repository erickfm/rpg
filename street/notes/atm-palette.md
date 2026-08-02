# The ATM's two looks — reconciled, cabinets kept as the reference

> *"i hate the look of the atm. i want it to look more like the graphics of the
> atm we already designed"*

The desk's ruling (`FEATURE-REQUESTS.md`, `LEDGER.md` row 321): **the facade
cabinets are the keeper.** They stay exactly as A built them. This row is the
interface panel (`ct/atm.ts`), redrawn to read as the same machine.

## Before / after

Both photographed on this build, standing at the SAME machine so the
comparison is honest:

- `shots/K/atm-palette-cabinet.png` — the two cabinets in the bank wall,
  unchanged. Charcoal bodies, green screens, pale keypads, in a stone recess.
- `shots/K/atm-palette-panel-idle.png`, `-panel-pin.png`, `-panel-menu.png`,
  `-panel-withdraw.png` — the interface, after this change. Charcoal chrome,
  a green-phosphor CRT with scanlines, the same worn-pale key tone as the
  cabinet's keypad.

Before this change the interface was `UI.amber` text on a beige `UI.case`
bezel (see `git show 40ee8400a^:street/src/proto/ct/atm.ts` for the old
version) — amber-on-beige against the cabinet's green-on-charcoal, which is
the fault the user named. Judged side by side, the four screens above and the
cabinet shot now read as one machine shop's work, not two.

## Where the colours came from — sourced, not eyeballed, and NOT exported

Every colour used in the panel's redraw is copied verbatim out of
`ct/bank.ts`'s own `atmPanelTex`/`atmNiche` (A's file — the machine actually
built into the wall), cited by line, at the top of `ct/atm.ts`:

```
CAB_BODY      bank.ts:324  '#414a52'                the gunmetal cabinet body
CAB_BEZEL     bank.ts:328  '#1c2026'                 CRT surround
CAB_GLASS     bank.ts:329  '#0d1418'                 CRT glass, near black
CAB_PHOSPHOR  bank.ts:330  '#3f6a4a'                 the green tube itself
CAB_TEXT_DIM  bank.ts:336  rgba(180,255,190,0.32)    dim phosphor text
CAB_TEXT_LIT  bank.ts:340  rgba(180,255,190,0.5)     bright phosphor text/cursor
CAB_SLOT      bank.ts:347  '#2b3036'                 card/cash slot housing
CAB_SLOT_DARK bank.ts:348  '#0a0c0e'                 slot opening
CAB_LIT       bank.ts:349  '#63c27a'                 the lit card-slot arrow
CAB_SHELF     bank.ts:356  '#363d44'                 keypad shelf
CAB_KEY_HI    bank.ts:363  '#c6cbcf'                 a worn (pale) key face
CAB_KEY_LO    bank.ts:363  '#aab0b6'                 an unworn key face
```

A few extra tones (button/case highlight and shadow, the printed button ink)
have no direct line to cite — the cabinet conveys them with real 3D shading,
not a 2D literal — so they are derived ARITHMETICALLY from `CAB_BODY` by a
small `shade(hex, amt)` helper rather than picked by eye. The only judgement
call left in the file is "how much lighter/darker", never "which colour".

**I did not export this palette from `bank.ts`, and that is the finding to
report rather than a shortcut I took.** `ct/bank.ts` never names these values
today — they are inline literals inside a closure (`atmPanelTex`), not
module-level constants — so there was nothing to `export` yet. Turning them
into a shared, named palette means adding an export to a file `OWNERSHIP.md`
gives to A. This row's own brief is explicit that I may **read** A's file to
source the palette and must **not** restyle the cabinets; it does not extend
to editing A's file, and `OWNERSHIP.md`'s one-file-one-owner rule only carves
out "read-only, may add a new export" for the four **desk-owned** shared
modules (`ctx.ts`, `rng.ts`, `fp.ts`, `crosstown.ts`) — `bank.ts` is not one
of those. So the values above are a precise, cited transcription, not an
import, and that gap is real: if A repaints the cabinet, this file will not
follow automatically.

This is not a new failure mode for the project — `ct/vice.ts` declares
`GOLD`/`RED` for the hotel's palette and `int-hotel.ts` duplicates two of the
three as literals instead of importing them (see the LEDGER row on the hotel
interior/exterior drift, which flags exactly this: "the values agree today
and nothing keeps them agreeing"). **Recommended follow-up for the desk:** ask
A to hoist the ATM's colours in `bank.ts` into a named, exported
`ATM_PALETTE`, the same fix already recommended and not yet done for
`vice.ts`. Once that lands, the block at the top of `ct/atm.ts` becomes an
`import` and the citation comment (with its line numbers, already a stale-
measurement risk per GOTCHAS §44) can be deleted outright.

## What did NOT change

- **The cabinets** (`ct/bank.ts`) — untouched, not even read for edits, only
  read for values.
- **The panel's layout** — numbered side buttons, CARD/CASH slots, the FIRST
  FEDERAL SAVINGS header, and the screen's copy are exactly as they were. This
  was a palette and material pass, not a redesign, per the brief.
- **Every other 'machine' panel** (the slot machine, `ct/slots.ts`) — `ct/hud.ts`
  gained an optional `caseTint` override on `PanelSpec` so the ATM could take
  its own charcoal chrome without recolouring the shared beige `UI.case` every
  other machine panel still uses. Verified with `scripts/L-slots-inworld.mjs`
  (sit at a stool, play, cash out, ESC) — all green, unaffected.

## Verified

- `SHOT_URL=http://localhost:4197/ node scripts/K-atm-walk.mjs` — full pass,
  dev server: reachable via the wall's own `[E]`, card/PIN/menu/balance/
  withdraw/cash/receipt/card, ESC closes it, walking away mid-session costs
  nothing, **the world freeze lifts when it closes**, and no console errors.
- Same script, same result, against the **built bundle**
  (`npm run build && npx vite preview --port 4198`) — GOTCHAS §37, a dev-only
  pass proves nothing about what ships.
- `node scripts/bugsweep.mjs` against both dev and the bundle — 93 shots, zero
  new console errors, zero STATION MISS.
- `npx tsc --noEmit` and `npm run build` — clean.
- `scripts/ownership.sh K` — every changed file is mine.

## Files touched

- `street/src/proto/ct/atm.ts` — the palette constants, the `shade()` helper,
  and every colour literal in `drawScreen`/`register` swapped for a cabinet-
  sourced one.
- `street/src/proto/ct/hud.ts` — added `PanelSpec.caseTint` (optional, defaults
  to the existing `UI.case*` tones for every caller that does not pass it) so
  the ATM's chrome could change without recolouring the slots machine.
- `street/scripts/K-atm-palette-shot.mjs` — the before/after/cabinet
  screenshot script used above; kept for the next person who touches this.
