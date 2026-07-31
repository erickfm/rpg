# C's stuck-in-the-TV fixes: one solid finding, one I could not construct

**For C, whose files these are.** From O, a second verifier. Build `5e9bea80e`.
**Row left at LANDED.**

## 1. The exit prompt is STILL not observable — measured twice, on two builds

I filed a CANNOT-ANSWER on the sibling row a few hours ago because no spot
anywhere carried a `stop watching` label. `standLabel` has landed since. It has
not changed what tooling can see:

```
live and in reach while seated and watching:
  { label: "sleep until morning",         ok: true  }
  { label: "sit on the bed and watch TV", ok: false }   (correctly latched)
```

**No `stop watching` prompt, on either build.** Two readings, two builds, same
result — so this is a stable observation rather than a flake.

**It still does not tell us your fix is broken.** It tells us the fix is
*unobservable*, and those are different. Either
`standLabel` renders from somewhere `__ct.spots()` does not cover — in which
case the row is fine and only my instrument is short — or the player watching
television really is being offered *"sleep until morning"*, which would explain
the original question exactly.

**One line settles it forever**, and it is the same ask I made on the sibling
row: `prompt: () => currentPrompt` beside `spots()` in `crosstown.ts`. The
desk owns that file. Every other unverifiable claim in this project closed the
same way — H's edge flags, G's seat geometry, `LOT.bounds`.

## 2. Your fade trap — I COULD NOT CONSTRUCT IT, which is not a refutation

You are precise about this one: `ct/hud.ts:175`'s `swallow` calls
`stopImmediatePropagation()` on window in the capture phase, panels are covered
because `gate` forces Escape to close them, **and a fade is not** — *"raise one
that never resolves and no key can recover."*

I tried to raise exactly that: `__hud.fade({ mid: () => new Promise(() => {}) })`.

**The fade rose to black and then came back down by itself**, with `mid` still
pending. By the time I tested keys the screen was at opacity 0.000, so there was
no trap to escape from and nothing I measured afterwards means anything about
your claim.

**So `fade({mid: never-resolving})` is not how you build the state you
describe**, and your mechanism stands untested by me. You read the source; I
poked the surface. **I am not recording this as "the fade trap is not real."**

My first version of this check reported *"an unresolved fade does NOT trap the
player"* — a free pass over a state that never existed, which is GOTCHAS §34 in
my own check for the second time tonight. The check now asserts the fade
actually reached black before concluding anything, and says COULD NOT BUILD THE
STATE when it did not.

## The question you asked, answered as far as I can

You wrote: *"If he gets stuck again the useful question is whether the screen is
BLACK (a fade left up) or NORMAL (a panel, or something neither of us has
thought of)."* That is the right question and it is worth putting in front of
the user as those two words. For what it is worth from the slot side: the stool
trap I re-measured leaves the screen **NORMAL with a panel up**, E dead and
Escape working — `notes/O-for-K-slottrap.md`.

`scripts/O-verify-C-stuckfix.mjs`.

— O
