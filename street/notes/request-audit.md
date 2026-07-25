# Request audit — verifying the user's asks end to end

**Branch** `audit/seams`, base `add-stick-and-city98` @ `c889ed23` · read-only.
Instruments: `scripts/checks.mjs`, `scripts/playershots.mjs`, `scripts/blade2.mjs`.

**This report is INCOMPLETE and the incompleteness is the main thing to know
about it.** I got solid results for five of the twelve priority checks. The
other seven were probed with mis-aimed cameras — several of my walk tests
carried the player's position over between checks, so the "car lot" test ended
up standing where the "church" test finished — and I am not willing to grade a
request DONE or NOT DONE on a measurement I know is wrong. Those are listed as
**NOT CHECKED**, not as failures.

## Verified

| ask | verdict | what I actually observed |
|---|---|---|
| *"for every seat in the game i want to be able to sit down"* — the **park** benches | **DONE** | Walking the park interior, `[E] sit on the bench` appears at two separate benches. |
| same ask — the **car lot** | **DONE** | `[E] sit on the bench` appears at five points across the lot interior. The lot's waiting bench (`0c0ac79c`, "somewhere to wait while they run your credit") is sittable. |
| same ask — the **library courtyard** | **NOT DONE**, and it is known | `ct/civic.ts:65` says it outright: *"The library's benches were built before `ctx.seat` existed and never went back for it, so the courtyard had furniture you could not sit on while the park's identical benches worked."* A `civicSeats()` export now exists to fix it; my frontage sweep found **no sit prompt anywhere along the library frontage**, so the wiring has not landed. **This is the one on this list most likely to annoy — the user asked for *every* seat, and the exception is the building they asked to be recessed into a courtyard.** |
| **HOTEL ORPHEUS blade**, read from the **west** | **DONE** | `shots/pl-P1-blade-from-west.png` — reads "HOTEL ORPHEUS" top to bottom, correct-handed, legible from the street. |
| **GOLDEN ACES** signage generally | **DONE** | `shots/pl-P2-blade-from-east.png` — the ACES marquee and vertical blade both read correctly, and the frontage now carries "LOOSEST SLOTS / #1 BLACKJACK / 24 HRS" and a VACANCY sign. The *"more detail for both the hotel and golden aces facades"* ask is visibly satisfied. |
| **LIBRARY steps** | **INCONCLUSIVE — leaning NOT DONE** | Walked at them from the pavement at z = −13: ground height stayed at 0.14 the whole way and the player stopped dead at x = −7.0, the facade line. No rise, no prompt. But `a25df0c1` ("Open the library steps: ask `ct/civic.ts` for the civic floor") has landed, so either the steps are somewhere other than where I walked, or they are not reachable from the pavement. **Wants one properly aimed re-test before anyone acts on it.** |

## NOT CHECKED — probes were unreliable, do not read anything into these

church steps · car lot entry from the street · `[E]` prompts sitting on the
actual facade doors for BODEGA / DINER / TAX (my earlier `doorsweep.mjs` shows
all nine doors fire, but *"the facades line up with the interior"* is a
different question and `4fa27232` has only just landed) · interior people, 8
angles vs flat planes · bench ad framed and legs non-coplanar · wheel arches ·
puddles in the gutter · closing the 301 door · park lit and alive.

Screenshots exist for several of these (`shots/pl-P5…P15`) but I have not read
them, and an unread screenshot is not an observation.

## What the next pass needs

1. **Fix the probe harness first.** `scripts/checks.mjs` re-warps per check but
   the walk tests share state; each check must re-warp *and* verify it landed
   where it meant to before pressing a key. Two of my three walk tests silently
   ran from the wrong place.
2. **Aim from the source, not from memory.** The library, church, park and lot
   have all moved this session. Every coordinate in my probe was hand-typed,
   which is the exact defect this audit has reported four times — including
   once when it was my own trigger harness holding a stale diner z.
   `scripts/doorsweep.mjs` is the model: it finds things by walking, and it has
   never been wrong.
3. **Then grade all 45**, in the priority order the user gave.

## The one finding worth routing now

**The library courtyard benches cannot be sat on.** It is the only item here I
can state with confidence and it is a direct, repeated user ask — *"for every
seat in the game i want to be able to sit down"* — with a known cause and an
export (`civicSeats()`) already written for it. Wants **E**.
