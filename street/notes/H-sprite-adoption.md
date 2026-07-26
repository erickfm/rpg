# `citizenSprite` is shipped — who has taken it, and who has not

The queue asked me to do the half that unblocks everyone else: export a
drop-in `citizenSprite(look, opts)` from `ct/citizens.ts` so builders F, G and
C can each swap a painted plane for one call without waiting on the interior
kit. **That is done and in use.** `notes/CITIZEN-STYLE.md` is written and other
builders are citing it in their own comments (`ct/lot.ts:897` — "ONE CALL to
H's citizenSprite, per notes/CITIZEN-STYLE.md").

This note is the routing information the desk needs for the other half, which
is not mine: **`ct/int-*.ts` belongs to F and G and I have not touched them.**

## Taken it — 5 modules

`ct/apartment.ts` · `ct/interior.ts` · `ct/lot.ts` · `ct/park.ts` ·
`ct/weeds.ts` (the last cites it as the pattern rather than calling it)

## Have not — every one of the ten interiors

Each of these still has hand-drawn figures. The counts are person-ish
identifiers and `PlaneGeometry` calls, so they are an INDICATION of where the
cardboard people are and not a precise inventory — whoever takes the file
should look rather than trust the number:

```
int-hotel.ts     12 person refs   17 planes
int-library.ts   10               8
int-church.ts     8               3
int-thrift.ts     8               5
int-bodega.ts     6               7
int-burger.ts     6               5
int-diner.ts      6               5
int-tax.ts        6               6
int-casino.ts     5              10
int-pawn.ts       3              13
```

The user's words for why this matters: *"the people inside these places are
always flat and not like the people on the street"*. The diner waitress was the
first, and the casino, hotel and tax office copied her because she was the
nearest example — one missing document produced four cardboard people, which is
what `CITIZEN-STYLE.md` exists to stop happening a fifth time.

## The signature, so nobody has to read the file

```ts
citizenSprite(look: Look, o: {
  facing?: number;    // atan2(vx, vz); 0 = facing +z
  h?: number; w?: number;   // scale; height and width vary independently of `build`
  cadence?: number;   // steps per second while walking
  ...
})
```

It returns a ready-to-add billboarding mesh with the 8-angle atlas already
wired — the same facing behaviour the street sprites use. **It updates on a
`HOOK.LATE` per-frame hook, so a probe must let a frame render before reading
its view** (that cost me a session once: a keeper reported as facing the wrong
way was a stale read, in a room that was fine).

**If the atlas cannot do what a caller needs, ask the desk and I extend it** —
that is the line in the style guide and I would rather add a `Look` option than
have another figure hand-drawn beside it.
