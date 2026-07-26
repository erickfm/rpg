# I could not verify the sleep fade, and the reason is worth more than a verdict

K's fix **is in the tree** — `ct/apartment.ts:1918` calls
`screenFade({ mid: () => ctx.clock.advance(mins, { overSeconds: 0 }) })`. H
confirmed it and says they watched it go black. **I am not contradicting H.**

I could not reach the bed's `[E]` reliably enough to test it, and that is the
finding I can stand behind.

## What I measured, control first

The instrument is sound: driving `window.__hud.fade({ mid })` directly and
sampling `#ct-fade` in-page at 25 ms gives **peak opacity 1.000, 15 of ~26
samples black**. So a fade is visible to this probe when one happens.

Around the bed, from a fixed coordinate:

```
(197.05, -17.20) yaw 0     -> [E] close the door
(197.05, -17.20) yaw 180   -> [E] sleep until morning   (90 ms after warp)
(197.05, -17.20) yaw 180   -> [E] close the door        (500 ms after warp)
(197.00, -17.00) facing bed-> [E] sleep until morning   (one run)
(197.00, -17.00) facing bed-> [E] close the door        (next run, same code)
```

**Same coordinates, same yaw, different offer between runs.** Standing still and
sampling the prompt every 25 ms for 3 s shows **no flicker** — it settles on one
answer and holds it. So it is not oscillating; it is *deciding differently* from
one page load to the next.

Once, with `[E] sleep until morning` on screen, pressing E left the prompt
reading `[E] open the door` — the door had closed. I am **not** claiming prompt
and dispatch disagree: I read the prompt, then pressed a moment later, and the
pick may have settled elsewhere in between. Proving that needs the pick sampled
in the same frame as the press, which `__ct` does not currently expose.

## Why this matters beyond one row

K already warned it: *"the bed carries two spots and C's TV seat wins the pick
from about half the squares around it"*. There are now **three** contenders in
that corner — the bed, C's TV seat, and 301's door — and which one a fixed
square offers is not stable across loads.

That is the shape of two complaints the user has already made in his own words:
*"how do i stop watching the tv"* and *"pressing e doesnt get me out of it"*. A
player standing in one place, pressing E, and getting a different verb than the
one on screen would describe it exactly that way.

## What would settle it

**A read-back of the picked spot on `__ct`** — the spot object the dispatch will
actually fire, not the label the HUD drew. With that, "the prompt and the press
agree" becomes a one-line assertion in the same frame, and any verifier can
check it. Without it, everyone standing near that bed is testing a coin flip
and reporting whichever side came up.

Routed to the desk rather than to K or C: the contention is *between* their
spots, so it is not either module's bug to fix alone.
