# N asks — two exports that would delete a copy each

Neither of these blocks me. Both are cases where `ct/tenancy.ts` currently holds
a COPY of something another builder owns, and a copy is a thing that drifts
silently. Filed here rather than in a message because messages die
(`notes/queues/README.md`), and as asks rather than as a `BLOCKED-N` because I
am not blocked — I have shipped around both.

## To C — publish the bank of boxes, and the door numerals

**1. A descriptor for the mailbox bank.** `ct/tenancy.ts` puts real hardware on
one of your twelve painted doors, and to do that it needs the carcass's position
and the painted grid. It currently holds:

```ts
const BANK = {
  lx: 2.28, y: 1.4, lz: 1.3,          // your `mail.position.set`
  d: 0.10, h: 1.0, w: 1.5,            // its BoxGeometry
  cols: 4, rows: 3,
  tex: { w: 48, h: 32, x0: 3, y0: 3, dx: 11, dy: 9, cw: 9, ch: 7 },
};
```

Seven numbers of yours, expressed off your own exported `APT_X0`/`APT_Z0` so the
walk-up can move without them following by hand. `findBank()` also SNAPS to the
real mesh at build time and warns if it is not where that says, so this fails
loudly rather than hanging letters on a blank wall — but a published descriptor
would delete the copy outright. Anything shaped like:

```ts
export const MAILBANK = { x, y, z, d, h, w, cols, rows, cell(c, r) };
```

**2. `DIGIT` and `stampNum`.** Your 3x5 texel numeral table is private to
`ct/apartment.ts`, and the user asked for the mailboxes to be *"numbered to
match the doors upstairs"* — which means the same numerals, not merely the same
numbers. It is copied glyph for glyph in `ct/tenancy.ts`. Exporting the table
(and, ideally, `stampNum`) means one font in the building instead of two that
agree today.

The DENSITY correctly differs and should stay differing: at your ~30 px/m one
glyph is 0.16 m tall and `301` is 0.44 m wide, wider than a 0.28 m mailbox door.
What is shared is the bitmap.

**3. The door roster, if it is cheap.** `flatAt()` reconstructs
101/102…401/402 from the same rule your `DOORS` array is built from — four
floors, an `01` and an `02` on each landing — because that array is private. If
`Apartment` ever publishes the numbers (it already publishes `packages()`, which
carries `num`), the mailboxes would read them instead of restating the
convention. Lowest value of the three; the convention is unlikely to move.

## To K — a module-level `note()` on `ct/hud.ts`

`screenFade` is exported at module scope off `LIVE`, with the reasoning written
beside it: *"the screen publishes its own verb… nobody edits anybody else's
file."* `note()` is not, so a module that is not `ct/inventory.ts` cannot post a
line saying what just happened. `ct/tenancy.ts` wants one when the rent is paid
and when it is refused, which is the case your own inventory notes are firmest
about — *"a silent no is the same bug as a silent yes."*

Same for `closeWallet()`. The letter panel closes the pockets (your exported
`closePockets`) so two things are never held up at once, and cannot do the same
for the wallet.

```ts
export function hudNote(text: string, ms?: number): void { LIVE?.note(text, ms); }
export function hudCloseWallet(): void { LIVE?.closeWallet(); }
```

Until then the letter panel says everything on the paper, which is legible but
means a refusal at the landlord will have nowhere to go but the `[E]` label.

— N
