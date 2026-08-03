# Item 208 — the slot machine, described before it was edited

**Worker seventythree, 2026-08-02. Port 4290.**

The user, with a screenshot: *"this is what the slot machine looks like to me.
it is incredibly ugly and nothing like a classic slot machine. in fact describe
the image to me first then edit your code."*

He asked to be shown we looked. So this note opens with what was actually on the
screen, taken from his own vantage before a line changed:
`shots/w73-before/` — `1-standing.png` (the room), `2-seated.png` (his frame),
`4-settled.png` (reels at rest, which is where the cherry shows).

---

## 1. What I saw, before editing

The face is 320 canvas px wide and lands on ~320 screen px from the stool, so a
canvas pixel **is** a screen pixel here. Detail at canvas resolution is exactly
as visible as it looks in the artwork.

**Topper.** `SEVENS` in flat muted gold on near-black, ringed by 30 white
squares 4 px on a side at a 10 px pitch, laid straight on the cabinet. They read
as a perforated stamp edge. A three-phase chase was already running and could
not be seen, because lit and unlit differ by about as much as the panel does.

**Pay table.** 300 x 100 — the largest element on a 320 x 483 face. Eight lines
of 13 px words in two columns under a thin gold rule. It reads as a spreadsheet.

**Reel windows.** Three cream rectangles behind gold frames.

**Symbols.** The seven is a blocky stepped glyph 26 px wide with a 1 px drop
shadow — thin, and with nothing separating red from cream it reads as a squiggle.
The bars are stacks of flat gold rectangles with a 1 px shadow, **and carry no
lettering at all**, which is most of why they read as blocks. The cherries are
two 7 px circles.

**Payline.** A red hairline with two hairline pips.
**Meters.** CREDITS / BET / WIN PAID in green on dark — these read well.
**Buttons.** Four flat fills with a 2 px light on the top edge only.

**And the finding that settles the whole item.** In `1-standing.png` the room's
cabinets — baked textures out of `ct/int-casino.ts` — are **red and blue bodies
under bright gold marquee bars with saturated red and green symbol blocks**. In
`2-seated.png` the machine you are sitting at is `#241e22` under `#d8a83a`, and
**the two cabinets either side of the live face in that same frame are visibly
brighter than it**. Sitting down at a slot machine made it duller than the
scenery. That is not taste; it is in one screenshot.

## 2. Where the desk's description was wrong

Its verdict was right and three of its observations were not. Recording them
because two would have sent me to build something that is already there.

| the brief said | what is true |
|---|---|
| reel windows have "no curvature, no top/bottom shading" | **The shading exists** — `paintReel` drew 9 rows of ink at up to 0.5 alpha at both ends. On a 108 px window that is 8% of its height at half strength, i.e. a smudge. The edit is "make it read", not "add it" |
| "NO CHERRY IS VISIBLE, and a cherry is the one symbol everybody can name" | **There is a cherry** (`cherry()`), and it is in `4-settled.png`. The real defect is that two 7 px berries in an 84 x 36 cell read as pips |
| "a thin **typographic** red 7" | it is hand-built from stepped rects, not type. Thin and unoutlined — yes; typographic — no |

The **cause** the brief gave was right and is worth keeping: `slots.ts:818` said
the palette was read off `ct/int-casino.ts` because *"a machine you walk up to
and a machine you sit at should not be two designs."* Sound reasoning, wrong
result — it dressed the machine in the **carpet's** colours. Overturned by the
user's request; the file now says so at length in place of the old note.

## 3. What changed (all in `src/proto/ct/slots.ts`)

- **Palette.** Red body, hotter gold, near-white reel cream so black outlines
  have something to bite on, three-colour bulbs, a chrome family for the deck.
- **Every symbol is outlined in ink.** That is the single biggest change. The
  seven goes 26 -> 34 px with a 10 px stem, an ink outline, a lit top edge and a
  gold bevel; the single bar **says BAR**; the cherries go to 9.5 px berries
  with ink rings, outlined stems, a leaf with a midrib and a white specular.
- **The pay table is pictures.** Each row draws the three symbols that pay,
  derived from the line's own text (`payArt`), with the pay in bold gold and the
  line's name demoted to a 7 px caption. Four rows, two columns, 25 px each.
- **42 bulbs on a ring** with sockets and halos, ordered round the ring so the
  chase travels; 6 steps/s idle, 11 in attract, and on a win it goes to every
  other bulb at 16.
- **Buttons are caps in bezels** — ink edge, light top-left, shadow
  bottom-right, recessed chrome plate. SPIN is red.
- **The reel glass**: 16 rows of drum falloff instead of 9 and squared so it
  reads as a cylinder, a reflected-room sheen, glass turning away at each side,
  and a chrome surround outside the gold frame.
- **Payline**: a glow on a win, and pointers that point **at** the line — the old
  pair widened towards the glass, so they read as two arrows fleeing the reels.
- **Bill acceptor** dressed as a validator: steel plate, routed black mouth, lit
  throat, two guide arrows.

**The maths is untouched.** `L-slots-rtp.mjs` still enumerates **92.834%**.

## 4. A defect found by looking, and fixed

At bet 5 the attract band said **`SEVENS PAY 250`** while the pay table two
bands above it correctly said **1250**. It was a literal string. This is exactly
the fault `L-slots-glass.mjs` devotes a section to — *"misinformed by the
machine while being paid correctly by it"* — and it survived because that check
only ever read the pay table. It is derived from `PAYTABLE`'s top-paying row now,
by pay rather than by index. Found in `shots/w73-face/attract.png`.

## 5. How it was proved

- **`scripts/probes/w73-slot-face.mjs`** (new) pulls the panel's own canvas off
  the mesh — `material.map.image`, which *is* the canvas, so what is measured is
  what reaches the mesh — and writes idle / max bet / attract / win at native
  320 x 483. `shots/w73-face/`. **The first cut's pay table was a tangle in
  these and was re-laid out because of them**, not because a check said so.
- **`scripts/probes/w73-slot-buttons-click.mjs`** (new) — **there was no pointer
  check for the slots at all.** It sweeps the real mouse over the deck, reads
  the hand cursor (which `ct/hud.ts:779` sets from `spec.surface.hot`, i.e. the
  same `deckAt` a click goes through), asserts four separate hot runs for four
  `DECK` entries, then clicks two of them and watches the machine change. It has
  a population floor and a negative case, so it cannot pass by measuring nothing.
- `L-slots-glass.mjs all` — **29 of 29**, 54/54 reel cells, 16/16 pay lines at
  both bet sizes, 0 NaN, 0 off-panel. `L-slots-feel`, `L-slots-rtp`,
  `L-slots-inworld` all green.
- The verdict shot is `shots/w73-after/2-seated.png` against
  `shots/w73-before/2-seated.png`, same vantage, same seat.

**One check caught a real regression and it is worth naming.** My first version
had the whole ring blink on and off with the payline at 8 Hz. `L-slots-glass`
compares the face at t = 0 and t = 0.34 and demands they differ — and
`floor(0 * 8)` and `floor(0.34 * 8)` are both even, so a *paying* machine painted
two identical frames a third of a second apart. The check was right, and the
design was worse anyway: a ring that blinks in unison is one lamp.

## 6. Constraints I had to work inside, for whoever edits this next

`L-slots-glass.mjs` isolates a symbol from its neighbours by taking only marks
with `|x-cx| < 42`, `|y-cy| < 18`, `w < 58.8`, `h < 36`. So **every mark of a
symbol must have its top edge within cy +/- 18 and be under 58.8 px wide.** The
symbol outlines are 2 px horizontally and 1 px vertically for exactly that
reason. Anything drawn across a reel window must span the full 84 px (or be
taller than 36) or it will corrupt a signature. There must be **exactly three**
`strokeRect`s at `reelW+2 x h+2`, and **exactly one** `fillRect` at
`w === GLASS.w, h <= 1` — the check finds the windows and the payline by those.
Nothing may have a local y outside `[0, 483]`.

## 7. Found and not fixed

- **`FACE`, `GLASS` and the panel aspect are untouched** — the plane still
  measures 0.6 x 0.9056 m, map 320 x 483, as the item required.
- The reel row is 36 px, which caps how large any symbol can be. A visibly
  bigger symbol needs `GLASS.rowH` to grow, which moves the payline and the
  three-row window and is a bigger change than this item wanted.
- `DECK_UNDER` moved 438 -> 444 to clear the buttons' new bezel. Still nine
  pixels above the stool crest at 454, which is the number that matters and is
  measured (`w55-slot-look.mjs`).
