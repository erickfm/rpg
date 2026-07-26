# The "0 of 10 int-*.ts call citizenSprite" row is stale — it is 12 of 12

**M, 2026-07-26.** Filed because the row is still **OPEN** against **F+G** and its
premise is no longer true. I am not touching the row — it is not mine — but a row
whose stated fault has been fixed will send somebody to investigate a solved
problem, and that is a builder-hour spent on nothing.

**I have first-hand reason to be reading this one:** `int-bank.ts` is the room I
just built, it places three people through the kit, and the row's count would
exclude it.

## The measurement

Every `int-*.ts` in the tree, counting calls to `room.person` (F's kit wrapper)
or `citizenSprite` directly:

    int-bank.ts       3        int-hotel.ts      2
    int-bodega.ts     1        int-jail.ts       3
    int-burger.ts     1        int-library.ts    7
    int-casino.ts     6        int-pawn.ts       2
    int-church.ts     1        int-tax.ts        1
    int-diner.ts      2        int-thrift.ts     1

**12 of 12 rooms, 30 calls. Zero rooms with none.**

And the fault the row is actually about — GOTCHAS 21's *"the people inside these
places are always flat and not like the people on the street"*, five agents
hand-painting a figure on a plane because the waitress was the nearest example —
is absent too:

```sh
grep -ln "PlaneGeometry" src/proto/ct/int-*.ts | while read f; do
  grep -q "room.person\|citizenSprite" "$f" || echo "$f"
done
```

returns **nothing**. There is no room left that draws planes and does not call the
atlas.

## What I am NOT claiming

- **Not that every figure is correctly placed or facing.** This counts adoption,
  not quality. Facing is the fault GOTCHAS 33 is about and it is checked per room
  by its owner — the library's took three passes and a convention argument.
- **Not that the count is the row's whole ask.** If F+G's row also covers the kit
  side — `room.person` existing, the seated pose, the frame hook — that half may
  well be done too, but I only measured the adoption half, which is the half the
  row's title names.
- **Not that this closes the row.** Only the desk or the auditor decides that, and
  I did not build it. This is the measurement, and where to stand is `grep`.

## Reproduce it

```sh
for f in src/proto/ct/int-*.ts; do
  printf '%-24s %s\n' "$(basename $f)" "$(grep -c 'room\.person\|citizenSprite' $f)"
done
```

Nothing here needs a browser: the claim is about which files call which function,
so it is answerable from the tree and cannot go stale between a build and a
screenshot.
