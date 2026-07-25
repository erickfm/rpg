# BLOCKED — builder G

**All eight queued items are delivered and landed.** Nothing here is waiting on
work; each item is waiting on a ruling or on someone else's file. I have been
reporting these in handoff prose for several sessions, which is the wrong place —
H's `54f08066` made that case and this is me taking it.

**A caution about this filename.** I wrote a `BLOCKED-G.md` once before and it was
**wrong** — it claimed the tax and pawn doors were unreachable, when the frontage
migration was half-landed and the two numbers were 1.44 m apart for a reason. I
deleted it rather than leave it to mislead. Everything below is measured at
current mainline and says how.

---

## 1. My queue item tells the next reader to reintroduce the mirroring bug

**This is the one I would fix first**, because it is live and it will cost
somebody the same day it cost me.

`notes/queues/G-interiors2.md`, the blade item, says:

> Fix it properly: **two single-sided planes back to back**, a hair apart, with
> the texture flipped horizontally on the rear one.

The first half is right. **The last clause is wrong and causes the defect it is
trying to prevent.** Rotating a plane to `ry = +π/2` instead of `−π/2` already
reverses where its u axis points in the world — at `−π/2` u runs along `+z`, at
`+π/2` along `−z`, and each is the screen-right of a viewer standing on that
side. The same texture therefore reads correctly from both ends. Flipping the
rear one applies a **second** mirror that cancels the first.

That is exactly what I shipped, and the fix was to **remove** a flip, not add one.

`scripts/G-vice-walk.mjs` now asserts the two faces carry the *identical* texture,
and it fails both ways of mirroring — by pixels (`61.4% identical`) and by
sampling transform (`repeat.x = -1`). **So anyone who follows the written
instruction will now fail a check that tells them the instruction is wrong**,
which is survivable but silly.

**The ruling:** the desk owns that file — I do not edit it. Please drop the last
clause. `GOTCHAS.md` §10 itself is fine; it warns about `DoubleSide` and says to
test with asymmetric text, which is correct.

## 2. `ct/doors.ts` has no owner, and the class is still open

The **instance** is fixed: GOLDEN ACES was missing from `declaredDoors()` in the
built bundle for many commits, and `1e49295b` closed it inside my own two files by
dropping the runtime import that put them in the registry's cycle. `doors-declared`
reads **8 of 8** in `dist` at current mainline.

**The class is not.** `civic-doors.ts`, `interior.ts` and `world.ts` still resolve
to undefined namespaces at collection time. They declare no doors today, so
nothing is lost — but the next module that declares one from inside that cycle
drops it the same silent way, in the bundle only, with no error.

D raised the ownership gap in `BLOCKED-D.md`, H in `BLOCKED-H.md` §3. **The ruling
is an owner, not a patch** — the diagnosis is complete and `notes/G-casino-door-fix.md`
records two fixes that do *not* work, so whoever takes it need not re-run those.

## 3. My queue's bookkeeping does not match the world

`notes/queues/G-interiors2.md` shows **all 8 items unchecked** and `## Done` still
reads *"(nothing yet — you are new)"*. Every one is built, landed and verified.

This is not cosmetic: `./scripts/desk.sh` and `./scripts/queues.sh` report builder
state *from that file*, so anything reading them sees me with 8 items outstanding
and nothing done. The item-to-commit map is in `notes/G-interiors2-handoff.md`
under "Every item in `notes/queues/G-interiors2.md`, and where it landed".

**The ruling:** the desk writes that file; I only read it.

## 4. And the actual blocker: there is no next item

My queue has had no undelivered work for a long stretch. I have kept going by
auditing my own instruments and answering other builders' routings, and that has
been genuinely productive — it found the dropped casino door, six user
requirements with no check behind them, and four faults in checks I had written
and believed.

**It is now into diminishing returns.** The last three turns produced two negative
results and a documentation pass. I would rather be told what to build than keep
choosing my own work indefinitely.

**The ruling:** queue me something, or confirm the interiors work is complete and
I should stand down.

---

## State, for whoever picks this up

| | |
|---|---|
| owned | `ct/int-casino.ts`, `ct/int-hotel.ts`, `ct/int-pawn.ts`, `ct/int-tax.ts`, `ct/vice.ts`, `scripts/G-*.mjs` |
| `G-rooms-walk` | 109/109, dev and `dist` |
| `G-vice-walk` | 18/18, dev and `dist` |
| `doors-declared` | 8 of 8 in the built bundle |
| ownership | clean |
| open findings against my area | none |
