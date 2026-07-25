## audit/seams — interiors round 3: the casino is written but not in the world

Queue `## Now` (interiors, standing) re-walked at `1b990d7`.
Report: `notes/interior-audit.md`, Round 3 appended.

Touched:   notes/interior-audit.md (+Round 3), notes/audit-seams.md,
           scripts/interiors.mjs (regions widened), scripts/triggers.mjs
           (+burger), scripts/intshots.mjs (new)
           **nothing under street/src/**
Base:      1b990d7

### Two high findings

**1 — `buildCasino` is never called.** G's room is written, committed and
unreachable: `grep -rn buildCasino src/` returns only its own definition, slab 2
measures empty, and no `[E] into GOLDEN ACES` exists. The kit removed the need to
touch `crosstown.ts` to register *spots*, but the one-line `buildX(ctx)`
construction call still lives there — so every room keeps a desk-contended step
that nothing checks. **Route to whoever owns `crosstown.ts`; it is one line.**

**2 — ceiling heights now span 0.7 m.** casino 2.50 / diner 3.00 / burger 3.20,
against a kit default of 2.9 whose comment says *"a casino or a library wants
more"*. The casino asked for 0.4 m **less** than the shop default.

### Also

- **Frontage rule already broken by the second room.** Diner fills 97 % of its
  shopfront (8.96 m of 9.2). Burger barn fills **71 %** — 11.36 m inside a 16 m
  frontage, 4.6 m of shopfront with no room behind it.
- **The entry-trigger debt propagated exactly as round 2 predicted.** Burger
  copied the diner's 0.45 m door offset, so its trigger centre is 0.21 m inside
  the blanket wall, margin 0.84 m (80 %). Three of four street triggers are now
  in debt. The bodega, once fixed, holds at 96 %.
- **Round-1 findings 1–4 all unchanged** — A's density mandate was exteriors
  only. Floor vs wall still ~1.6 : 1; floor density now anisotropic *within* the
  burger barn (20.4 × 18.8) because `round(W/1.6)` and `round(D/1.6)` land on
  different multiples in a non-square room; ceilings untextured; palette
  luminance spans 5 : 1 with nothing bounding it.

### What is working

The two rooms that are in the world read as one place — 0.18 m walls, 11.9 px/m
square wall texels, identical shell and reveal language, door machinery correct
in both. Every failure above is in a parameter the kit leaves free, not in a
part it owns. That is the round-1 pattern holding under a second and third
builder, which is the strongest evidence yet for closing those four findings.

Left:      Casino measurable only from source until it is wired. Seven of ten
           rooms unwritten. Light measured as luminance, not judged side by side.
