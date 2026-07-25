## audit/seams — interiors round 7: exits all correct, light is not

Queue `## Now` (interiors, standing) at `bfbb0b7c`. No new rooms and no wiring
change since round 6, so this round closes two gaps I had been carrying in my
own coverage section rather than measuring.

Touched:   notes/interior-audit.md (+Round 7), notes/audit-seams.md,
           scripts/exits.mjs (new), scripts/intcompare.mjs (new)
           **nothing under street/src/**
Base:      bfbb0b7c

### Exits — sound in all three rooms

Stood on each way-out spot, pressed E, checked the landing:

| room | lands | on walk | to its own trigger | prompt on landing | can move |
|---|---|---|---|---|---|
| diner | (−6.10, 8.10) | yes | 1.57 m (r = 1.05) | none | 4/4 |
| burger barn | (−6.10, −26.75) | yes | 1.57 m | none | 4/4 |
| thrift | (−6.10, −73.44) | yes | 1.57 m | none | 4/4 |

Identical and correct in every respect the kit set out to guarantee. **The exit
half of the door contract is sound.** Previously only the diner had been walked.

### Light — the number I had been reporting was the wrong number

Matched cameras in all three rooms (`shots/cmp-*-back.png`):

| | fixture | glow | reads as |
|---|---|---|---|
| diner | one warm dome | soft radial pool | warm, low, cosy |
| burger barn | four cool troffers | hard rectangular bloom, near-white | **very bright** |
| thrift | two tubes | one faint pool, one **none at all** | **flat, dim** |

Colour temperature is defensible — warm diner, cool fast food, cool thrift is
right for the venues. **Level is not**: walking diner → burger → thrift the
exposure jumps hard both ways.

Worth flagging about my own method: the ceiling-luminance figures I reported for
six rounds (0.714 / 0.832 / 0.745) **understated this badly.** They measure the
ceiling *material*, not the additive glow on top of it, and the glow is what the
eye reads. Judging it needed a matched camera, not a better statistic.

New finding 15: the kit fixes lamp **count** from room depth and leaves
**output** entirely free — backwards. Count is what a builder should choose;
output is what has to agree across ten rooms.
New finding 16: the thrift's two tubes glow differently from each other — one
has a ceiling pool, one has none. Reads as a broken fixture, not a choice.

Left:      Jamb reveals not re-shot in burger/thrift (thickness measures 0.18 in
           both, and the reveal was verified in the diner in round 1). Four of
           seven rooms source-only; three of ten unwritten.
