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

## IT IS NOT A HIDDEN PROMPT — THE INTERACTION IS GONE

This decides the triage (GOTCHAS §23, real is not the same as visible). Pressing
E blind, from where the door puts you, with three letters 0.44 m away:

```
before   3 waiting, prompt hidden
E        -> reading = null, waiting = 3, panel shut
```

**Nothing happens.** So this is not a cosmetic fault over a working key — it is
the feature not being there for the first quarter-minute you are in the room,
which is the exact moment the request is about.

## Why, and the line

The landing hysteresis in `crosstown.ts`: *"after any transition, nothing is
offered until you have taken a step away from the spot you arrived on … what is
held off is EVERYWHERE YOU JUST LANDED."* That is a good rule and it fixed a
real bug — *"im literally stuck here"*, doors sucking you straight back in.

The trouble is the **radius against this particular room**, and it is one
constant. `src/proto/crosstown.ts:932`:

```js
if (landing && Math.hypot(px - landing.x, pz - landing.z) > 1.2) landing = null;
```

**1.2 m.** My bisection agreed before I found the line — nothing at 1.0 m,
prompt at 1.4 m — and the source settles it.

Worth reading beside it, from the block that SETS the latch
(`crosstown.ts:1004-1006`): it is armed only when a transition moved you more
than 1.0 m, and its stated purpose is *"everything would stop the ATM
re-offering 'check balance' after one press, and a seat re-offering 'stand
up'."* **Every case named is about the spot you just USED.** Line 932 suppresses
every spot within 1.2 m of where you landed, which is much broader than the
invariant it is protecting. And C's bank of boxes
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
3. **Exempt spots the player was not transported by.** Narrowest fix, and now
   the best-evidenced one: the code's own comment names only the ATM, a seat and
   a door — all of them *the spot you just used*. Nothing in that list wants a
   neighbouring module's trigger held off.

**And a number, so nobody has to re-derive it:** the bank of boxes is 1.03 m
from the arrival point and its stand is 0.44 m. Anything under **1.2 m** of a
door's landing spot is currently unreachable on arrival, in every interior.

## AND A ONE-LINE FIX THAT IS C's, if the desk would rather not touch the latch

I dismissed this too quickly the first time and I was wrong to. The latch is
measured **from where the transition PUT you**, and that point is C's, one line
in `ct/apartment.ts`:

```js
act: () => ctx.player.jumpTo(AX(1.2), AZI(1.3), Math.PI, 0),   // (201.2, -18.7)
```

Every candidate landing inside the lobby, measured against my published stand at
(201.61, −18.53), checked for colliders against a 0.36 m capsule:

```
                 distance to the stand   clears the 1.2 m latch   inside a collider
(201.2, -18.7)   0.44                    NO   <- today            no
(201.2, -19.6)   1.15                    NO                       no
(200.6, -19.5)   1.40                    yes                      no
(200.5, -19.6)   1.54                    yes                      no
(200.4, -19.5)   1.55                    yes                      no
(200.4, -19.7)   1.68                    yes                      YES — into the front wall
```

**`(200.5, −19.6)` works**: just inside the front door and a little to the west
side, 1.54 m from the boxes, on clear floor. You land, the latch is armed at a
point 1.54 m from the mailbox trigger, and walking the metre and a half to the
boxes takes you *further* from the landing — so the latch has already released
by the time you arrive.

**It is a workaround and I am labelling it one.** The latch's breadth still
affects every other interior whose first interactable is inside 1.2 m; this only
moves *my* room out of the blast. If the desk fixes line 932, C should not move
anything.

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
