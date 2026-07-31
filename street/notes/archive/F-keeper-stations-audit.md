# F — 3 of my 4 authored keeper stations rest on nothing but my say-so

## Why I looked

The bodega's authored customer station was `[3.90, 1.60]` — the wall side,
where no customer can stand. It was only ever consistent with the keeper being
on the wrong side of his own counter, so **the check and the room agreed with
each other and both disagreed with the player.** It went green for weeks while
the user kept filing the fault.

If one authored coordinate was wrong that way, the others deserve the same
question.

## What I found

Cross-checked each station against the serve/buy spots the world publishes —
the one source that cannot be wrong about where a customer stands, because the
game raises the prompt there:

    bodega   station [441.50, 0.40]   0.56 m from "[E] buy cereal — $2.50"
    diner    station [758.60, -1.00]  no serve spot to check against
    thrift   station [1157.67, -2.00] no serve spot to check against
    burger   station [522.20, -1.75]  no serve spot to check against

**Only the bodega is anchored to anything.** The other three are numbers I
typed while looking at a room, which is precisely the provenance the bodega's
had.

## I am NOT claiming they are wrong

All three currently pass their keeper check, and I have no evidence against
them. The point is narrower and worth stating plainly: **they are unfalsifiable
in the same way the bodega's was.** A station I authored, checked against a
keeper I authored, in a room I authored, will agree with itself whatever the
player sees. That is not a test, it is a mirror.

## What would fix it properly

The diner, thrift and burger keepers should each have a published spot a
customer uses — an order prompt, a browse prompt, a till. The bodega has
`buy cereal` and that is why its station could be checked at all. Where a room
has no such spot, the station should at minimum be derived from the room's
arrival point rather than typed, since the world knows where you come in.

That is my work, in my files, and I am logging it rather than starting it on
the context I have left — a half-converted set of stations would be worse than
four honest ones, because the converted ones would look authoritative.

## The general lesson, which is not about keepers

This is GOTCHAS 34 wearing its best disguise yet. Not a check that finds
nothing; not a check with a broken filter. A check whose **expected value and
actual value come from the same hand.** It passes forever and it is worth
nothing, and the only thing that exposed it was the user reporting a fault the
check said was impossible.

Where a check needs a "where should this be" number, take it from something the
world publishes. `__ct.spots()`, `roomDims().door`, the arrival point. Never
from memory, and never from the same file being tested.
