# F — `room.clock()` has landed. Signature, and every clock still unconverted.

The user: *"make sure all the clocks throughout the world (library, diner, etc.
tell the time accurately)"*. That is a property of the world, not a bug in one
clock, so it is a kit primitive rather than nine fixes.

## The signature

```ts
room.clock({
  lx: number; y: number; lz: number;   // where, in room-local coordinates
  r?: number;                          // face radius, m. 0.22 = shop wall clock
  rotY?: number;                       // which way it looks; 0 faces +z, like sign()
  face?: number; rim?: number; hands?: number;   // colours
});
```

Same shape as `person()` and `ctx.seat()`: the caller says WHERE and WHAT KIND,
the kit builds the dial and registers the frame hook. **Adoption is one line.**

```ts
room.clock({ lx: 0, y: 2.6, lz: -D / 2 + 0.06, r: 0.21 });
room.clock({ lx: WALL_X, y: 2.15, lz: 0.3, r: 0.17, rotY: -Math.PI / 2 });
```

## What it guarantees

- **Both hands move, and the hour hand creeps.** At 13:30 it sits exactly
  halfway between 1 and 2 — the thing that gives a fake clock away.
- **It reads `hourF` every frame and caches nothing**, so when C's sleep
  advances time the hands follow the jump without the clock knowing sleep
  exists. Nothing to wire on C's side.
- **Hands pivot at one end.** The geometry is translated by half its length
  before rotation; a hand rotated about its centre sweeps from the middle of
  the dial and reads as a propeller.

Measured in the running world at two times, reading the hand rotations back
out of the scene:

    13:30   hour -0.790 (want -0.785, halfway 1->2)   minute -3.194 (want -3.142, at 6)
    16:00   hour -2.099 (want -2.094, at 4)           minute -0.052 (want 0, at 12)

The residual is half a minute of clock ramp, not error. The diner (x=755) and
the library (x=920) return **identical** angles, which is the actual ask: every
face agrees with game time and therefore with every other face and the wrist.

## Converted (mine)

| file | line | was |
|---|---|---|
| `ct/int-library.ts` | 587 | painted 24×24 face, hands baked at a fixed hour |
| `ct/int-diner.ts` | 332 | painted 20×20 face, hands baked at a fixed hour |

## NOT converted — please route

Not mine to touch, all one line each:

| file | line | what |
|---|---|---|
| `ct/int-hotel.ts` | 421 | lobby wall clock, painted 24×24 — **should be converted** |
| `ct/int-tax.ts` | 293–298 | wall clock, painted 32×32 — **should be converted** |
| `ct/apartment.ts` | — | C's room; the desk lists a clock here |

## Deliberately skipped, with reasons

- **`ct/int-hotel.ts:670` — the lift floor dial.** Its own comment says it is
  stopped between floors on purpose. A stopped lift dial is a detail, not a
  wrong clock, and wiring it to game time would delete the detail.
- **`ct/int-pawn.ts:421` — the dials in the cabinet.** Merchandise. Watches for
  sale in a pawn shop are not synchronised, and making them so would look
  stranger than leaving them.
- **`ct/int-casino.ts`** — has no clock, on purpose, and the tax office's
  comment says so explicitly. A casino with a clock is a casino that has lost
  the joke. Left alone.
- **`ct/hud.ts`** — the wristwatch. It already reads game time and is the
  reference every other face is now checked against. Nothing to change.
- **`ct/vice.ts`** — the grep hits are `createRadialGradient(16, 16, ...)`,
  not clocks. Not a clock file.

Naming the skips because a sweep that converts everything it greps is a sweep
that stopped reading.
