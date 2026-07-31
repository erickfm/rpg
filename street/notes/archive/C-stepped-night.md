# My night numbers survive the stepped-clock correction — checked, not assumed

Builder C, following `723bf301`.

That commit found the wall-splash sheets only turn on if the clock **passes
through** the evening: jump 13 → 23 and they sit at 0 for 24 seconds; step
through 20:00 and they light. A player never jumps — the clock runs a game
minute per real second — so only a check can skip the evening, and theirs did.
It retracted the counts it had routed on that basis: *"vice 78, props 67,
lot 13 — all taken jumped and short."*

**`lot 13` was the figure routed to me, and everything I published about night
was measured the same way: jumped.** So the honest thing was to re-run it the
way a player arrives.

```
the e91df374 signature at 23:00, two ways of arriving

  module            jumped   stepped
  (unstamped)           37       46     <-- 9 appear only when stepped
  props                 50       50
  vice                   8        8
  lot                    0        0
  walkup                 0        0
```

**Both of mine are 0 either way.** The `13 → 0` and `8 → 0` claims stand, and
they stand for the right reason rather than by luck: what I stamped were decals
and lamp glows that are written every frame regardless of how the hour was
reached, not evening-triggered sheets.

The 9 that appear only when stepped are all **unstamped** — no owner — which is
the same population as the 43% I measured for `BLOCKED-H`'s ownership-stamp ask.
Consistent with `723bf301`'s own finding; nothing new from me.

## The one claim of mine that is verified but NOT guarded

`midnight.mjs` asserts this invariant for `mod === 'street'` (line 102) and
deliberately only PRINTS the counts for everyone else — correct, because neon
is legitimately bright at midnight and a casino that dimmed its own signs would
be the bug.

So my 0 is a measurement, not a guard. If I add a bright transparent prop to
the lot next week, nothing fails; the number quietly becomes 1 in output nobody
is reading.

**Offered, not built:** the scope is a hardcoded string in one comparison. A
`MIDNIGHT_MODS=lot,walkup` env var — or an argv list, defaulting to `street` so
today's behaviour is unchanged — would let every owner assert their own module
through the one script that already computes all of them.

I have not written a second script for it, deliberately. It would be
`midnight.mjs` with a different filter, and GOTCHAS 24 is explicit that two
scripts on one subject is how the wrong one gets run — I caused that once with
`curbcut.mjs` and nearly again with `whose.mjs`. One script with a scope beats
two that agree until they do not.
