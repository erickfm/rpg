# The seat exit is not missing — it is misnamed. One field, in F's kit

The desk, on the user having to ask how to stand up: *"while seated there is no
prompt telling him E gets him up... check whether this is general, because I
suspect it is."*

**Measured first, and the suspicion is half right.** The hole is not
persistence — it is the word.

## The prompt is there, and it is not intermittent

Sat on the bed in 301 and sampled the prompt across a grid of look directions,
because look-based selection was the obvious way for it to be flaky:

```
  exit prompt while seated, 9 yaws x 5 pitches
    pitch -0.50   Y Y Y Y Y Y Y Y Y
    pitch -0.25   Y Y Y Y Y Y Y Y Y
    pitch  0.00   Y Y Y Y Y Y Y Y Y
    pitch  0.25   Y Y Y Y Y Y Y Y Y
    pitch  0.50   Y Y Y Y Y Y Y Y Y

  visible in 45 of 45 look directions
```

`crosstown.ts:236` registers the stand spot centred on the seat with
`ok: () => rig.seatedOn === pose`, and `canSee` short-circuits at `dist < 0.45`
— you are standing on it, so it can never be occluded. **No seat in the world
can lose its exit prompt by looking away.** That part of the kit is sound and
does not need changing.

## What it says is `stand up`, and a caller cannot change it

`crosstown.ts:237`:

```ts
label: () => 'stand up',        // hardcoded
```

`Seat.label` sets the SIT prompt only. There is no `standLabel`, so every seat
in the world exits with the same three words.

That is fine for a bench: sitting is momentary and obvious. It is not fine for
a seat that puts you in a **state** — watching television, playing a slot
machine, using a terminal — where the thing you want to stop is the activity,
not the posture. The user read `[E] stand up`, did not connect it with
"stop watching", and asked.

## The ask: one optional field

```ts
// ct/ctx.ts, on Seat, beside `label`
/** prompt shown while seated. Defaults to 'stand up'. Give a STATE seat a
 *  verb for the activity — 'stop watching TV', 'leave the machine'. */
standLabel?: string;

// src/proto/crosstown.ts:237
label: () => s.standLabel ?? 'stand up',
```

**I have not applied it** — `ctx.ts` and the seat pairing in `crosstown.ts` are
not mine, and a private stand-up prompt in `apartment.ts` is exactly the
second-seating-system mistake the desk praised me for avoiding. The moment it
lands I will pass `standLabel: 'stop watching TV'` and it is one line here.

**Who else wants it, so it is worth doing once:** L's slot stools (being wired
now — a slot is the most state-like seat in the world), the casino tables, the
library reading chairs and terminals, the church pews, the bank waiting bench.

## And the forgiving exit — there is nothing to be forgiving with

The desk: *"if there is an escape or a back binding anywhere in this world, it
should work here."* There is not one. Grepped `crosstown.ts`, `fp.ts` and
`hud.ts` for `Escape`, `Esc`, `KeyQ` and `Backspace`: **no hits anywhere**. The
HUD's own legend lists click, WASD, Shift, C, Space, E, look-down and
right-click, and nothing else.

So E is not one key among several that he had to guess between — it is the only
interaction key the world has. Adding a second exit binding is an input-layer
decision in files that are not mine; I am flagging it rather than inventing a
key that nothing else in the world uses.
