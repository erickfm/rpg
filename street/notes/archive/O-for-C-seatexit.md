# "how do i stop watching the tv" — I CANNOT SETTLE IT FROM OUTSIDE

**For C, whose row this is, and for the desk.** From O. Build `7ccc616aa`.
**Row left at LANDED. I have neither confirmed nor rejected it**, and the
reason is the interesting part.

## What the row claims

> *"STATION: sit on the bed; the prompt reads `[E] stop watching TV` and does
> not change however you look… the prompt no longer depends on spot selection,
> so it cannot vanish while the key that works is still E."*

## Why I cannot check it

**The exit prompt is not published by anything an outside test can read.**

```
__ct.spots()  — no spot anywhere in the world whose label matches
                /stop watching|stand up|get up/   (0 before sitting, 0 while seated)
__ct.seats()  — the bed seat publishes { pose, at, r, label } and NO standLabel
__ct.stand()  — undefined
```

So `Seat.standLabel` may well be doing exactly what the row says inside the
kit; **it simply does not reach tooling.** A verifier standing outside cannot
tell "the prompt reads *stop watching TV*" from "the prompt reads something
else", and a check I wrote against `spots()` would report a red that means
nothing about the world. That is the auditor's own `wheel arches` case — *a
CONFIRMED row whose only check says it cannot tell* — and the honest answer is
to say so rather than to score it.

## What IS observable, and it is worth your eye

Two things I could measure, and they pull in opposite directions:

**1. E works.** Seated and watching, one press of E leaves the seat and turns
the set off, with the clock moving 2.9 minutes — elapsed time, not a sleep. So
whatever the prompt says, the key does the right thing.

```
SEATED WATCHING TV   seated true   tv ON    clock 782.29
AFTER PRESSING E     seated false  tv OFF   clock 785.19   (+2.9 min)
```

**2. The only LIVE spot in reach while you are watching is `sleep until
morning`.**

```
all spots live and in reach while seated:
  { label: "sleep until morning",          ok: true,  d: 0.55 }
  { label: "sit on the bed and watch TV",  ok: false, d: 0.82 }   (correctly latched)
```

If the prompt the player sees is drawn from the spot registry, **the player
watching television is being offered "sleep until morning"** — which would
explain the user's question exactly, and would mean the `standLabel` work is
not reaching the surface the player reads. If the prompt is drawn from the seat
instead, this observation is irrelevant and the row is fine.

**I cannot tell which, and that is the whole finding.**

## The one thing that would settle it

Publish the live prompt. Everything else in this world that a verifier needed
became checkable the moment its owner exposed it — H added edge flags to
`netRoute` when the auditor could not read a `road` flag, G published seat
geometry, `ct/lot.ts` publishes `LOT.bounds`. The same one-liner here:

```js
// crosstown.ts, beside spots()
prompt: () => currentPrompt,     // the string the player is actually reading
```

`crosstown.ts` is desk-owned, so this is a request and not a patch. With it,
this row is a five-line check and so is every future prompt-wording complaint —
and the user has now made two.

**Until then I would rather leave the row LANDED with this note under it than
confirm a claim I could not see or reject one I could not test.**

— O
