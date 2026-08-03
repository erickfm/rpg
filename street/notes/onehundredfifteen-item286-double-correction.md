# Item 286 — items 272 and 280 did overlap, and the overlap was exactly 0.275 m

**Verdict: KEEP BOTH. Remove only the overlap.** The desk's fear was real and
its shape was precise — not "two fixes that both help a bit", but *the same
number applied twice*.

Worker onehundredfifteen, 2026-08-03. Built bundle, port 4712, from `d747c9a0a`.

---

## 1. What the two fixes actually are

| | what it moves | how far |
|---|---|---|
| **280** | the **body** — `seatFwd` moves the sprite forward along `facing` | the seat's **half-depth** ("put the hip on the front lip") |
| **272** | the **art** — the profile shin is drawn at `cx - KNEE` | `SEATED_KNEE_M` = 12 texels × 1.9 m / 64 = **0.356 m** |

These sound independent — one places the body, the other draws the limb. They
are not, and citizens.ts says so in its own comment (`:176-179`):

> a booth bench is 0.55 m deep, so its front face is 0.275 m ahead of **a sitter
> placed at the bench centre**, and 0.275 m is 9.3 texels … A knee at 12 clears
> it; a knee at 8 would not.

**KNEE = 12 was sized on the assumption that the hip is at the bench CENTRE.**
Item 280 then moved the hip to the bench LIP — the exact 0.275 m the knee was
already drawn to cover. Both authors solved the same occlusion; neither knew.

## 2. What it looked like in the diner (the room he photographed)

Booth geometry (`int-diner.ts:230-232`): `BENCH_W 0.55`, `TABLE_W 0.76`. Bench
centres sit at `bx ± 0.655`; the table spans `bx ± 0.38`.

- **hip**, with 280: `0.655 − 0.275 = ±0.38` — **exactly on the table edge**
- **shin**, +272's 0.356: `±0.02` — **both sitters' legs on the booth centreline,
  under the middle of the table, interpenetrating each other**

`shots/w112-zoom-1-both.png` shows it: two pairs of legs converging in the
middle of the aisle. With the overlap removed (`w112-zoom-1-final.png`) the man
sits back against the backrest, thigh forward, shoe on the checker floor.

**Independent corroboration, and this is the strongest single number here.** With
the overlap removed the diner reads **931 and 895** texels below the seat line —
*exactly* the figures item 272's author reported in the queue row. With both
applied it read 2253 / 1651, inflated because the sitters had been shoved out
past the cushion. **272 was verified against `seatFwd = 0` and the row's own
numbers prove it.**

## 3. MY FIRST FIX WAS WRONG, AND THE PHOTOGRAPHS CAUGHT IT

I first wrote `seatFwd = max(0, halfDepth − SEATED_KNEE_M)` — subtract the reach
the art supplies. That is right for the diner and **wrong for the jail bunk**,
which is the one seat in this world a player can view only **straight down its
own axis** (the cell is locked; the corridor is the only vantage). A 1.92 m
mattress slab is then a full-height occluder between the sitter and the player,
and subtracting the full reach leaves the shin **coplanar with the slab's end
face** — zero clearance — so it swallowed the leg again.

Shot from one fixed vantage, `scripts/probes/w115-bunk-zoom.mjs`:

| seatFwd | file | what you see |
|---|---|---|
| 0.960 (280 as landed) | `shots/w115-bunk-z045-PREFIX.png` | **whole leg, shin and shoe** |
| 0.685 (− reference depth) | `shots/w115-bunk-z045-v2.png` | shoe and a sliver |
| 0.604 (− full knee reach) | `shots/w115-bunk-fixed.png` | **shoe only** |

Item 280's author hit the same wall from the other side and wrote it down: `-0.26`
"hid his legs exactly as before … A seat you are looking straight down the axis
of is unforgiving that way." **He was right, and a subtraction rule of any size
would have quietly undone his fix.**

## 4. The rule that shipped

Not *how much to shave* but **whether the art can reach past this seat's front
face at all** — `ct/citizens.ts`:

```ts
const askedFwd = o.seatFwd ?? 0;
const seatFwd = askedFwd > SEATED_KNEE_M ? askedFwd : 0;
```

| seat | half-depth | vs 0.356 | result |
|---|---|---|---|
| diner booth | 0.275 | ≤ | **0** — the redraw clears it |
| jail lobby bench | 0.210 | ≤ | **0** |
| casino lounge | 0.115 | ≤ | **0** |
| jail bunk | 0.960 | > | **0.960 — untouched, 280 intact** |

`SEATED_KNEE_TEXELS` and `SPRITE_H_M` are hoisted to module scope so the art and
the placement derive the reach from one number instead of two hand-typed copies
(BUILDER-BRIEF §8). `KNEE` at the drawing site and `H` in `citizenPlane` now read
from them.

**Both landed fixes keep doing exactly what each was verified for. Only the
overlap is gone.** 272's backwards-profile-thigh fix and its pulled-back arms are
untouched — I changed no art, only how far the body is moved.

## 5. Verification, all on the built bundle

| check | result |
|---|---|
| `w112-legs-below-the-seat.mjs` | **PASS** — 14 sitters, 6 judged, **0** showing nothing below the seat |
| `w113-280-sit-affected.mjs` | **33/33 seated, 33/33 stood back up** |
| `w113-280-item93-inside.mjs` | **HOLDS** — 123/111/12, suppressed set identical |
| **item 93's 219-entry seat vector** | **byte-identical**, sha256 `17ae6aad…` |
| `node scripts/health.mjs` | `WORLD OK`, exit 0 |
| `node scripts/bugsweep.mjs` | **0 STATION MISS, 0 COVERAGE** |
| `tsc --noEmit` | clean |

**The seat-vector check is A/B'd and self-tested both signs**, because a hash
that never moves is a stable meaningless green: measured `17ae6aad` *with* the
fix and *with the fix reverted* (identical, as item 280 promised — seats are
claimed at build time, `seatFwd` is applied in `update()`), then mutated a single
diner seat radius 0.85 → 0.86 and watched it go to `20dbc58a`. New probe
`scripts/probes/w115-seat-vector-hash.mjs`, with a 200-seat population floor.

## 6. Looked at, all 14

`w112-every-sitter.mjs` (6 rooms) plus tight crops on the decisive ones. Diner
×2 and jail bunk ×1 photographed individually and compared before/after. Jail
lobby bench and casino lounge — the other two my change moves — both read as a
man on a bench with his legs out (`w112-room-jail-final.png`,
`w112-room-casino-final.png`). The bank officer, three library readers, the
church pew and the four slot players are occluded by desk/counter/machine and
were left alone, as the row instructed.

## 7. Not fixed, for the desk to queue

- **`w112-legs-below-the-seat.mjs` judges only 6 of 14.** Five casino sitters and
  one jail sitter come back `TOO NOISY` (animated slot screens) or `NOT VISIBLE`.
  It is honest about it — three outcomes, not two — but **the check cannot see
  the casino at all**, which is 5 of the 14. Freezing the slot reels for the
  duration of the diff would recover them.
- **Nothing detects OVER-correction.** Both authors' probes test a *floor* (is
  any leg visible). Neither could have caught this bug — both passed with the
  double correction live. A ceiling check ("is the hip still on the seat it is
  registered to?") is what would have failed on 2026-08-02 and does not exist.
