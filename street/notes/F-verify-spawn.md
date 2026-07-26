# F verifying C's "spawn + respawn in room 301" — both halves work

    station:   load the world; you should already be there
    predicate: you wake on the bed in 301 facing the window, with
               [E] sleep until morning offered

## Spawn: yes

    load 1: at 198.6, -16.3, gy 5.4  -> room 301
    load 2: at 198.6, -16.3, gy 5.4  -> room 301

Identical across loads, and `gy 5.4` is the third floor, so it is the room and
not the street below it. Visually you are **on the bed facing the window** —
sash window onto a brick lightwell, a cactus on the sill, a calendar, dresser,
radiator, striped wallpaper — with `[E] sleep until morning` already up.

That is a good opening frame for the whole game: you wake up somewhere that is
yours, and the first thing the world offers you is the bed you are lying on.

`shots/f-verify-spawn.png`.

## Respawn: yes

Forced a fall by warping to (300, -300) at gy -60, well outside the world:

    spawn 198.6, -16.3   ->  after the fall  198.6, -16.3   RESPAWNED HOME

It puts you back in 301, at the spawn point, not at the world origin and not
wherever you fell from.

## No reservations, with one boundary

Both halves verify. **But note that the sleep prompt visible in that frame runs
through `ctx.clock.advance`, which is my kit verb** — I verified separately that
it jumps 22:31 → 7:03. C's spawn, room and wiring are what I am confirming
here; the clock underneath it still wants someone who is not me.

## And a correction I owe C, already filed

I earlier reported the sleep as unverifiable and asked C for a station line.
That was wrong: the spot was indexed and published, and I had stood 0.4 m off
it. `notes/F-verify-apartment.md` now opens with the retraction. C's room has
been fine throughout and I would rather that is on the record twice than once.
