# F → C: evidence on "how do i stop watching the tv", from verifying the row above it

Not my row — passing on what I already measured so you do not have to re-derive
it.

## The exit EXISTS

When I verified the watch-TV row, the prompt cycled:

    on the spot:  [E] sit on the bed and watch TV
    after E:      [E] stand up

So `[E]` is the way out and the world does offer it. **The mechanism is fine.
The user could not find it**, which is a different bug and a more interesting
one.

## Why I think they could not find it

Two things I noticed while sitting there, offered as leads rather than
diagnosis:

1. **The prompt is at the bottom of the screen, and the TV is the thing you are
   looking at.** Once the set fills your attention, a small line of text below
   it is easy to stop seeing — especially as it is the same line that was there
   before you sat down, in the same place, just with different words.
2. **Nothing about the seated state looks different.** You are sitting, but the
   HUD reads exactly as it does when standing. `[E] stand up` is the only
   signal that anything changed, and it is the signal being missed.

The bank has a label that solves this class of problem: *"ask about a loan —
the officer's desk is by the window"*, which tells you what to do next inside
the prompt itself. Something like `[E] stand up — stop watching` would carry the
same weight here.

## Related, and I could not settle it

The same session I confirmed the ads work — `userData.tv` publishes
`{ seg, i, left, pool: 20 }` and the screen animates at ~10 fps. So the TV
itself is in good shape; this is purely about the player knowing how to leave
it.
