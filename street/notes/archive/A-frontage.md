# Builder A — frontage descriptor, D unblocked, two dead detectors

## The export F is waiting on

```ts
export interface Frontage {
  frontageM: number;      // full width of the shopfront, metres
  doorCentreM: number;    // door centre, metres from the LEFT edge of the frontage
  doorOffsetM: number;    // the same fact, signed metres from the CENTRE
  doorWidthM: number;
  glazingStartM: number;  // the glazed span, metres from the left edge
  glazingEndM: number;
  stallriserH: number;    // metres above the pavement
  fasciaH: number;        // metres
}

export function frontageOf(name: string, wMeters: number): Frontage
```

`import { frontageOf } from './tex-world'`. Landed in `9c49ef7d`.

Distances run along the frontage from its left edge as the painter's canvas
sees it — the same direction `wMeters` measures. Heights run up from the
pavement. **`doorOffsetM` is the `at:` convention the rooms already use**, so it
drops straight in without conversion; `doorCentreM` is the same number from the
left edge. They cannot disagree, because one is computed from the other.

The painters now DRAW from this: every door line is
`m(F.doorCentreM - F.doorWidthM / 2)`. It is not a description of what the
painter does, it is what the painter does.

### The numbers F will want

| shop | w | doorOffsetM (`at:`) | what the room currently says |
|---|---|---|---|
| BURGER BARN | 16 | **0.00** | `int-burger.ts at: -3.6` |
| DINER | 12 | **+4.78** | `int-diner.ts at: -2.6` |
| A-1 TAX | 13 | +3.14 | — |
| PAWN | 15 | +6.15 | — |
| THRIFT | 14 | −5.72 | — |
| CAFE | 11.2 | +2.85 | — |
| HARDWARE | 12 | 0.00 | — |
| GROCERY | 16 | +4.39 | — |
| LAUNDRY | 9.2 | −2.21 | — |
| MERIDIAN | 10 | −2.47 | — |
| BARBER | 12.5 | −1.63 | — |
| LIQUOR | 13 | +3.43 | — |
| DELI | 11 | +2.79 | — |
| RECORDS | 10 | +2.47 | — |
| BODEGA | 10 | +1.23 | — |

`stallriserH` is 0.50–0.63 m and `fasciaH` 0.78–1.05 m depending on character.

The two rows with a comparison are the misalignments the auditor measured.
Burger barn's facade door is dead centre while its room puts it 3.6 m left; the
diner's is 7.4 m out. **Those are now readable rather than guessed at.**

## Doors did not move — measured, not assumed

The brief said publish the existing positions, do not move anything. I compared
the old texel expressions against the new descriptor for all 15 shops:

- **13 are bit-identical**
- **DINER and CAFE differ by exactly one texel** (0.063 m), because a sum of
  rounded terms became one rounded sum

That is a rounding artifact, not a repositioning, and both ends now agree on it.
Moving doors so the facades match the rooms is a separate change and a separate
commit — say the word and I will take it, but it should probably be F's call
which end moves.

Determinism was already there and is unchanged: only the block default varied,
and it already hashed off the shop name. That hash moved into `doorFrac()`
untouched. The five characters place their door by design.

## Builder D is unblocked, both halves

`BLOCKED-D.md` asked for five exports and a sequencing decision.

- **Exports landed** (`5b1e8991`): `HI`/`SH`/`DP`, `Band`,
  `reveal`/`proud`/`glazed`/`mullions`. No signature changed.
  **`Band` was not already exported** as that note assumed — without it the five
  would have blocked again one line later.
- **Window lights: I am out of `ct/tex-world.ts`.** D was waiting on
  confirmation my mandate had closed. It has. `litAt(f, c)` was left static
  precisely so it could be driven off the night curve.

## Two detectors in `desk.sh` were silently dead

Both found because my own queue has been byte-identical for three sessions
while listing six landed items, and nothing surfaced it.

1. **Stale-queue check** (`fb65b1c1`) globbed `notes/*$short*.md` on the
   WORKTREE name. Reports named after their topic matched; reports named after
   the builder letter did not, because `notes/*split2b*.md` is not a file.
   It was suppressing `split2b`, `civic` (`E-churchyard.md`) and `entrance`
   (`C-lot.md`).
2. **Blocker check** (`9094ce83`) looked for `BLOCKED-$short.md` while the
   README tells builders to write `BLOCKED-<you>.md` — and half of them are
   "you" by letter. `BLOCKED-A.md`, written exactly as instructed, was
   invisible. **So were `BLOCKED-D.md` and `BLOCKED-E.md`, which already
   existed.** D had been waiting on five keywords from a file I own: verbatim
   the failure the README says that check exists to prevent.

It now also looks in the builder's own worktree, tagging unlanded ones — a
blocker matters most before it lands, since the builder files it and moves on.

**Re-run `scripts/desk.sh`.** The board is noisier and more of it is true.

## Queue state

`## Now` lists five items. One is the frontage descriptor above; the other four
are on mainline and have been for one to three sessions. Per the queue README
the report is the authority, so I have not redone them and have not edited the
file. `A-shopfronts.md`, `A-toolchain.md` and this note cover them.
