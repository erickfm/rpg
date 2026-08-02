# The ATM cabinet's colours were a closure with nothing to export — hoisted

Item 6 from `notes/QUEUE.md`, file `ct/bank.ts`. Build at commit `49965390e`.

## Root cause, one line

`atmPanelTex`'s twelve colours (gunmetal body, CRT bezel/glass/phosphor,
slot housings, keypad shelf and key wear) were `const` string literals
declared *inside* `buildBank`'s closure, so there was nothing at module
scope for `ct/atm.ts` — the `[E]` interface the user asked to be "made to
look more like the graphics of the atm we already designed" — to `import`.
`ct/atm.ts` worked around that by copying all twelve values out verbatim
with a line-cited comment, which was correct the moment it was written and
had no mechanism keeping it correct afterward. Exactly the same "one fact
authored twice" shape `BANK_DOOR` already fixed for the door two rows ago
in this same file.

## What changed

Added `export const ATM_PALETTE = { body, bezel, glass, phosphor, textDim,
textLit, slot, slotDark, lit, shelf, keyHi, keyLo }` at module scope, right
after `BANK_DOOR`, using the same 12 values `ct/atm.ts`'s own comment
already cited by line. `atmPanelTex` now reads `ATM_PALETTE.<name>` at
every one of those 12 sites instead of the literal — including the two
extra reuses of the slot colour (cash slot, receipt slot) that weren't in
`ct/atm.ts`'s citation table but are the same semantic colour. Nothing else
in the closure changed: the lip colour, the highlight/shadow rgba overlays
and the unworn/worn-key well shadow are not part of the cited palette and
were left as they were.

## Not done, and why — the actual follow-up

`ct/atm.ts` still carries its own copy of these 12 values. This item names
only `ct/bank.ts`; switching `ct/atm.ts` to `import { ATM_PALETTE } from
'./bank'` and deleting its local `CAB_*` constants is the natural next step
(literally what `ct/atm.ts`'s own comment asked the desk for: "hoist this
file's own ATM colours into a named, exported `ATM_PALETTE` in `bank.ts`,
so this block can become an import") but is a second file, unnamed by this
item, not touched here. `ct/atm.ts` isn't listed in `OWNERSHIP.md` at all.
Recommend queuing "`ct/atm.ts`: import `ATM_PALETTE` from `./bank`, delete
the local `CAB_*` copy" as its own item.

## Verified

- `npx tsc --noEmit`: clean.
- `npx vite build`: clean (pre-existing `INEFFECTIVE_DYNAMIC_IMPORT` /
  chunk-size warnings only, unrelated).
- `npm run fp before` (stashed) → `npm run fp after` (restored) →
  `node scripts/fpdiff.mjs shots/before.json shots/after.json`:
  **textures IDENTICAL, structure IDENTICAL** — this is a pure hoist, no
  pixel or geometry changed. The only differences reported (3 tints, 3
  places) are the casino/hotel chase-light animation and pigeon drift the
  script itself documents as this project's noise floor, not this change.
- `SHOT_URL=http://localhost:4182/ node scripts/bugsweep.mjs`: 93 shots,
  zero STATION MISS, no new console warnings.

## Derivation

Every `ATM_PALETTE` value is the literal already sitting in `atmPanelTex`
(now referenced instead of retyped) — nothing was guessed or matched by
eye. `ct/atm.ts`'s own comment had already cited these exact 12 values by
line against an earlier build SHA, which is how I found all twelve sites
without missing the two extra `slot`/`slotDark` reuses its citation table
didn't mention.
