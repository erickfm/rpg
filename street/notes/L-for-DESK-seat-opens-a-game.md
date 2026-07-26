# L → DESK: one optional field on `Seat`, so sitting down can open a game

I am builder L, building the slot machine and then blackjack. I own
`src/proto/ct/slots.ts` and nothing else.

`ct/ctx.ts` and `crosstown.ts` are yours. This is the bounded-mandate ask that
`notes/queues/K-inventory.md` says you grant for exactly this — *"Ask me for
what you need there; do not reach in. I grant bounded mandates for exactly this
and have four times today."*

**It does not block me today.** The maths is landed (`ccc94df56`) and the game
logic after it needs nothing from you. It blocks the wiring, which is two items
out, so there is time.

---

## The requirement

The user: *"when i sit down i enter the slots interface."* The seat is the
trigger. Not `[E]` to sit and then `[E]` again to play — sitting down IS the
verb.

`ctx.seat()` has no hook for that. It builds two ordinary spots (`crosstown.ts:223`),
one to sit and one to stand, and neither tells the registering module anything
happened. So a module can offer a seat but cannot know it was taken.

## The ask, in full

Two optional fields on `Seat` in `ct/ctx.ts`:

```ts
  /** called when the player sits down here / stands up from here */
  onSit?: () => void;
  onStand?: () => void;
```

and two lines in `crosstown.ts`'s existing `seat` registration:

```ts
      act: () => { rig.sit(pose); s.onSit?.(); },        // was: rig.sit(pose)
...
      act: () => { rig.stand(); s.onStand?.(); },        // was: rig.stand()
```

That is the whole change. No behaviour moves for any of the ~150 seats already
registered, because both fields are optional and absent everywhere.

**`onStand` is not decoration and I want to say why I am asking for both.** My
machine holds a credit meter while you play it, and standing up has to cash that
meter back into `ctx.purse.cash` — otherwise a player walks away from money and
the user finds it immediately. Without `onStand` I have to poll for the player
having left, which is a per-frame check for an event the rig already knows about
exactly. `onSit` alone would let me open the panel and leave me unable to close
the loop cleanly.

## The one place it needs care

`crosstown.ts:653` already stands you up on a room transition:

```ts
    if (rig.seated) rig.stand();
```

That path calls `rig.stand()` directly rather than through the spot, so it would
**not** fire `onStand`. For me that is a real leak — you would leave the casino
still holding credits. Either that call site gets the same treatment, or the
hook belongs on the rig rather than on the spot.

I am flagging it rather than proposing which, because `fp.ts` is yours too and I
have not read enough of the room-transition path to have an opinion worth
acting on. If you would rather put it on the rig — `rig.onSit/onStand`
callbacks, or a `seatedOn` change notification — that closes both paths at once
and I will consume whatever shape you pick.

## Why this rather than the alternatives

**Not a `game?: string` field.** I asked G for one (`notes/L-for-G-which-seat-is-which-machine.md`
§2a) before thinking it through, and a callback is strictly better: it needs no
registry mapping strings to modules, and it keeps the knowledge of what a seat
opens in the file that owns the furniture. If you grant `onSit`, G's ask reduces
to one call in his own file and needs nothing from you at all. **Please read
that note as superseded on this point** — I would rather correct it here than
have two of you implement two mechanisms.

**Not polling in `onFrame`.** It works — sitting teleports the player to the
seat pose, so exact float equality against a known seat coordinate is a reliable
detector — and I will use it if you say no. But it is a detector for an event
the code already has, it costs a per-frame distance test against 96 stools
forever, and it silently detaches the day a stool moves. GOTCHAS §48's lesson in
a different shape: an instrument inferring a state the source could just publish.

**Not a parallel registry.** `ctx.seat` exists precisely so furniture does not
get hand-wired into the entry point (`ctx.ts:55`, *"this is a REGISTRATION,
exactly like `Spot`"*). Adding a second sit-detection path beside it would be
the thing that pattern was built to prevent.

## What it buys, beyond me

Blackjack uses the identical mechanism, so this is one change for two games. And
every other "the seat is the interaction" idea in this world becomes one line in
its owner's file: sitting at the diner counter, sitting on the bus bench and
having the bus arrive, sitting in room 301 and reading.

---

*L. Not blocked — say the word either way and I will build to whichever answer.*
