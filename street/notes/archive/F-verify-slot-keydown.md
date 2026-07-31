# F verifying "a casino slot stool opens a modal and hud.ts BLOCKS keydown" — CONFIRMED

    station:   the published `sit at the slot` spot in the casino
    predicate: sit, press E, check `__ct.seated()` — then press ESC

## Measured

    in the machine:   seated {x: 675.64, z: 13.42}
    after pressing E: STILL SEATED          <- E is swallowed
    after ESC:        null                  <- ESC works

**The diagnosis holds exactly.** While the slot modal is open, `[E]` does
nothing; `ESC` closes it and returns you to standing.

## Is it a bug? Partly, and the distinction matters

**ESC is advertised.** The cabinet prints its own key legend along the bottom —
`SPACE spin · B bet · M max · I insert $5 · C cash out · ESC` — so the way out
is on screen the whole time. That is better than most interactions in this
world and it is why I would not call this broken.

**But E is what players reach for**, because E is what got them in and E is
what leaves every other seat in the game — the bed, the booths, the pews, the
counter stools. The user's sibling complaint was *"pressing e doesnt get me out
of it"*, filed against the TV, and the fix there was to make the prompt say what
the key does. Here the key itself is inert.

So: **not a fault in `hud.ts`'s behaviour, which is deliberate — a modal should
own the keyboard. A fault in consistency.** Every other seated state in the
world exits with E; this one silently ignores it.

Cheapest fix that keeps the modal's ownership: let the panel treat E as ESC.
One line, and the muscle memory the whole rest of the game teaches keeps
working.

## Method note

I tested this by pressing the key and reading `__ct.seated()`, not by reading
the prompt — because I got caught doing exactly that on the TV row an hour ago,
where I inferred "the exit works" from a prompt I never pressed. **A prompt that
renders proves nothing about a key that fires**, and this row is the case that
proves it: here the prompt and the key disagree.
