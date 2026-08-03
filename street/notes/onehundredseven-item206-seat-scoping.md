# w107 — item 206, SCOPED AND HALF-LANDED, released at a file boundary

Worker **onehundredseven**. Port **4188**. Built bundle throughout.
**Released, not marked done** — see "Why this is released" at the foot.

> *"you sit and its the loan process as an integrated overlay."* Closing a panel
> from a chair ejects you from the chair.

---

## THE ITEM NAMES ONE STAND-UP PATH. THERE ARE TWO.

The row says the cause is `crosstown.ts`'s `FOCUS.leave()` and that *"`leave()`
should re-sit the remembered pose"*. **That is true and it is not sufficient.**
Closing a panel runs, in `ct/hud.ts`'s `close()`, in this order:

```
hud.ts:1318   FOCUS?.leave()          ← the line the item names   (crosstown.ts)
hud.ts:1329   undo?.()                ← the caller's `release`
hud.ts:1331   if (seatedAtOpen) { if (__ct.seated()) __ct.stand(); }   ← ct/hud.ts
```

**`ct/hud.ts:1331` is a second, independent, unconditional stand-up**, and it
runs *after* `leave()`. It captures `seatedAtOpen` at open time and cannot tell
*"the panel seated you"* from *"you were already in a chair"* — the same
distinction the fix makes on the crosstown side. So fixing `leave()` alone is a
no-op for this bug: the chair is given back and then taken away four lines
later.

**`ct/hud.ts` is not named by this item, and item 277 — *"exiting any overlay
leaves the mouse dead"* — is live and holds the overlay-exit path.** So I
stopped there (BUILDER-BRIEF §9).

---

## What I did land, in `crosstown.ts` only

`FOCUS.enter` records `rig.seatedOn` as `focus.chair` — null unless a **seat**
put the player there, because `rig.sit` early-returns while seated
(`fp.ts:285`) and therefore never overwrites a chair's pose. `FOCUS.leave` then
gives it back.

**⚠ `stand()` then `sit()` is not a roundabout way of doing nothing, and simply
skipping the `stand()` does not work.** `fp.ts:251` registers a **capture-phase**
Escape listener that sets a private `forceUp` whenever Escape is pressed while
seated — deliberately, because `ct/hud.ts`'s gate is the thing it exists to
survive — and `update()`'s seated branch consumes it **on the next frame**. Leave
the player seated without clearing it and they are ejected one frame later
instead of immediately: the same bug wearing a delay, and invisible to any check
that reads `seated` once. `stand()` clears `forceUp` unconditionally (its own
comment says that is the point of doing it there) and `sit()` puts the chair
back. The round trip is exact — `stand()` returns the player to `standFrom` and
`sit()` re-records `standFrom` from that same position.

### It is proved to work, with the one foreign line isolated

`scripts/probes/w107-seat-keeps-you.mjs`, on the built bundle, at the library
computer:

| build | result |
|---|---|
| mainline `ct/hud.ts` | **9/13** — ejected immediately and still ejected 30 frames later |
| `ct/hud.ts:1331` neutralised **locally, never committed** | **13/13** |

At 13/13 the seated prompt reads **`[E] use the computer   ·   [ESC] stand up`**
— item 188's contract exactly, so ESC is not ambiguous. `[E]` does **not** stand
you up there and must not: `ct/library-pc.ts:896` registers that spot precisely
so that *"the day 206 lands a dismissed machine has no way back at all"*.

**The exact remaining change**, for whoever owns `ct/hud.ts`: `seatedAtOpen`
needs to become *"the panel's own opening seated the player"* rather than
*"the player was seated"* — i.e. record the seat pose at open and only stand if
it is `null`, mirroring `focus.chair`.

---

## TWO DEFECTS FOUND ON THE WAY, neither of them this item

### 1. ⚠ SITTING IN THE BANK'S CLIENT CHAIR BLINDS THE SEATED `[E]` FOREVER

**Item 188's shipped contract does not hold today, and it misses by 13 cm.**

`crosstown.ts:2290` latches `landing` whenever an act moves the player more than
**1.0 m** — the anti-yo-yo rule for doors, and right for them.
`crosstown.ts:2188` then makes `canSee` return **false for every spot** while
`landing` is set, and `crosstown.ts:2155` clears it only by **walking 1.2 m
away**.

**A seat is an act that moves you and then takes your legs.** Measured
(`scripts/probes/w107-seated-landing.mjs`):

- **2 of the world's 219 seats** move the player more than 1.0 m when you sit:
  `sit in the shelter` and **`sit in the client chair`**.
- The client chair moves you **1.13 m**. Immediately after sitting,
  `__ct.landing()` reads `{x: 444.4, z: 2.62, clearIn: 1.2}` — *you must walk
  1.2 m to clear it, and you are sitting down.*
- So from that chair the seated prompt is **`[E] stand up`** and nothing else,
  at 10:00 with the bank open, with `read the loan application` `ok`, **0.95 m
  away and aimed dead at it**.

That is the chair item 188 built `[E] read the loan application` on, and the
row for item 206 quotes the loan overlay as the thing being spoiled. **It cannot
be spoiled, because it cannot be opened.**

The fix is one line and it belongs to whoever owns the dispatch: **a seat should
not latch `landing`** — the latch exists to stop a door yo-yoing you back, and a
chair is the one transition after which the player provably cannot take the step
that clears it.

### 2. My own instrument, twice

- I called `q.label()` on a `SEATS` entry. `crosstown.ts:399` declares `label`
  as a plain **string**; only `SPOTS` carries a thunk. I guessed a shape instead
  of reading it.
- My first stage assumed you could sit and press `[E]`. You have to **turn your
  head** first — the application is 43° off the seat's own yaw against
  `lookTolerance`'s 15° cap. That is `pickSpot`'s seated rule working as item
  188 designed it, not a fault, and a probe has to be told to look.

---

## Why this is released rather than marked done

The item's DONE WHEN is *"closing a panel from a chair leaves you in the
chair"*. **It does not, on mainline, and it cannot until `ct/hud.ts:1331`
changes** — a file this item does not name, whose overlay-exit path is held by
item 277 right now.

Everything I could do inside `crosstown.ts` is committed, measured and proved by
isolation. Re-queue this with **`ct/hud.ts` named**, or hand it to whoever
finishes 277.

Nothing is left in a worse state: on mainline the crosstown half is inert (the
chair is re-seated and then stood up by hud, exactly as before), `tsc` is clean
and `health.mjs` reads `WORLD OK`.
