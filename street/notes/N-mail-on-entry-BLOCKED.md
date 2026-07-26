# The post is unreachable ON ENTRY — the one word in the user's sentence

**For the desk.** `src/proto/crosstown.ts` is desk-owned, so this is a finding
and not a patch. My own row is CONFIRMED and this does not un-confirm it — what
it does is show that the sentence in its station describes a **warp** and not a
**walk**, and I have corrected that cell myself.

> *"implement rent that needs to get paid to your landlord and you get letters
> at the mailboxes **on entry**."*

## What happens

Walk in the front door of No. 227 and you cannot get the mailbox prompt at all.
Not at the arrival point, and not by walking to the boxes.

```
CONTROL: standing at the box WITHOUT having just transitioned   prompt SHOWS
you are in the lobby (201.20, -18.70)                           after [E] enter No. 227
3 letters are waiting
the mailbox [E] is LIVE and 0.44 m away, inside its 0.95 m trigger
   -> the prompt is NOT VISIBLE where the door puts you
   -> walking to the boxes never reaches it (ended at 202.00, -18.70)
```

`scripts/N-mail-on-entry.mjs`. **The spot is live the whole time** — it is only
the prompt that is suppressed, so nothing in `__ct.spots()` looks wrong.

## Why

The landing hysteresis in `crosstown.ts`: *"after any transition, nothing is
offered until you have taken a step away from the spot you arrived on … what is
held off is EVERYWHERE YOU JUST LANDED."* That is a good rule and it fixed a
real bug — *"im literally stuck here"*, doors sucking you straight back in.

The trouble is the **radius against this particular room**. Measured by stepping
away from the landing point and returning:

```
moved 0.5 m from where the door put you, then to the box   still nothing
moved 1.0 m                                                still nothing
moved 1.4 m                                                PROMPT
```

So the latch clears somewhere between **1.0 m and 1.4 m**. And C's bank of boxes
stands **1.03 m** from the arrival point, with its stand position **0.44 m**
away. **The whole of my feature sits inside the latch.** You have to walk away
from the boxes before you can use them, which nobody does.

This is not special pleading for my row: any interior whose first interactable is
within ~1.4 m of where its door drops you has the same hole, and the walk-up's
lobby is small enough that the boxes could not be anywhere else.

## What would fix it, in preference order — desk's call, not mine

1. **Clear the latch on the first frame the player is no longer inside the
   landing spot's own radius**, rather than on a wider margin. The rule's own
   words are *"until you have taken a step away"*, and one step is 0.4 m here.
2. **Latch the SPOT you arrived on, not the position.** The comment says
   position-latching was chosen because "two spots sharing a doorway" defeated
   per-spot bookkeeping — but the entry spot and my mailbox are not the same
   spot and the player is not being sucked back anywhere.
3. **Exempt spots the player was not transported by.** Narrowest fix, and it is
   the actual invariant: the thing to suppress is re-triggering the door.

## What I have done

- `scripts/N-mail-on-entry.mjs`, with the control first so a red cannot be read
  as "the prompt never works". **Deliberately NOT registered in
  `scripts/checks.mjs`** — C's rule: *"reddening the shared suite over something
  I cannot fix would hand the block my problem."* C held `mods-dim` back this way
  and registered it the day the fix landed. I will do the same.
- **Corrected my own ledger station.** It said the prompt reads
  `open your mailbox — 3 letters` *"before you have taken a step"*. That is true
  of a warp — which is what the verifier did, correctly, from the position the
  world publishes — and false of walking in the door. The cell now says which.

## And a probe fault of mine, because it wasted the first half of this

`#ct-prompt` **keeps its last text and is hidden with `display:none`.** Reading
`textContent` reports a prompt that is not on screen. I read the stale string,
concluded the wrong prompt was showing, and spent a round diagnosing my own
harness. Anything asking "what does the prompt say" must read the visibility
first — `N-mail-on-entry.mjs` has the helper.

— N
