# w58 — item 143: `[E]` closes a machine view, not just Escape

**The user:** *"instead of getting out of the atm view or the slots or literally
whatever. instread of using esc for that lets make it e."*

Port **4192** (4186 was already serving another builder's world — 4192 answered
`000`). Verified on the **built bundle** via `npx vite preview`, not dev.

---

## Why it read badly, in one line

**`[E]` opened the machine and only Escape closed it — so the key the player is
told about everywhere else in the world did nothing once he was inside.**

And, after the first fix, a second one-liner: **the caption's bare trailing `E`
read as a truncated list item rather than a key**, because every sibling token in
that strip is a key *and* a verb.

---

## What changed

Three files. Two are mine by the item; the third is flagged below.

### `ct/hud.ts` — the close lives in the one gate every panel shares

`gate()` already sees every keydown for every panel, so `[E]` was added beside
Escape there. **The ATM, slots, blackjack, the bank loan desk, the landlord
letters and the pockets all got it without being edited** — that is the whole
reason the item said "the panel framework, not each machine", and it held.

Escape is kept, as the desk recommended. It costs nothing and this project's
worst bug is a view you cannot leave.

### The latch — the part that actually took the work

`[E]` now drives **both edges of one toggle**, so the press that does one must
never be read as the press that does the other. There are two bounces and both
are real:

- **Closing.** `crosstown.ts:2038` reads `E` as an edge off a held-keys Set once
  per rendered frame. Closing tears the gate down, so the auto-repeats of a key
  still held land in the world and re-open the machine just left.
- **Opening.** The gate goes up while the opening `E` is still down, and the gate
  now reads `E` as "leave" — so leaning on the key would open a machine and shut
  it again a few hundred ms later.

`dismissedAt` (500 ms) does **not** cover either: it is the same order as a
typical auto-repeat delay, so it is a race not a rule, and it guards only the
panel's own `open()` while the spot's `act()` — which may also *seat* the player
— runs regardless.

So: **the key must be physically released before it acts again.** While latched,
every keydown for that key is swallowed at capture; the real keyup disarms it.
A timer cannot substitute — `down → 90 ms → up` is how the checks drive `[E]`,
so a clock-based latch passes every check and still fails a human.

**The bug inside the fix, found by measuring:** `releaseHeld()` fires a synthetic
`keyup` for every `HELD_KEYS` entry — `e` among them — and it runs immediately
*after* the open-side latch arms. `latchSeen` took that for the player letting
go, so the latch disarmed itself microseconds after arming and the first repeat
shut the machine. **Only a trusted release disarms it now.** `__hud.latched()`
read `null` one frame after an `open()` that had just called `latch('e')`; that
readout is what found it, and it is kept as a test affordance
(`__hud.held()` / `__hud.latched()`) because a latch nobody can read is a latch
nobody can prove.

### `ct/library-pc.ts` — ⚠ A FILE THE ITEM DOES NOT NAME

**The item says the library PC must get `[E]` "from one place" with the others.
That is wrong for this one machine, and the user's own feature is the evidence.**

`library-pc.ts:377` is a **free-text search field** — `k.length === 1 &&
/[a-z0-9 '-]/i` takes any single character. A global `[E]`-to-close would make
the letter *e* untypable and eject the player mid-word: *Emma*, *Frankenstein*
and *The Republic* all become unsearchable.

So the framework got an opt-out — `PanelSpec.typing?: () => boolean`, "I am
eating text right now, so `E` is a letter and not the exit" — and the terminal
declares it for its catalogue screen only. Its desktop and Minesweeper screens
take `[E]` like everything else. **The caption is derived from the same flag, so
it cannot advertise a key that will not work.**

**This is one declaration line plus its hint text in a file item 143 does not
name** (BUILDER-BRIEF §9). I checked the queue first: no other builder holds
`library-pc.ts`, and only item 143 was DOING. **This also vindicates keeping
Escape** — the catalogue would otherwise have had no exit at all.

### The caption

`ESC` → `[E] leave` (and `[ESC] step back` where the panel types). Bracketed
because **`[E]` is already how this world names that key**: `hud.prompt` writes
`[E] <label>` over every spot. The dedupe tests the bare key, so a caller that
wrote its own exit hint does not get a second one.

---

## My verdict on the after-images

`shots/w58/`, all taken from the player's own standing position.

- **`02` ATM** — *"click a button, or press its number · [E] leave"*. Reads as an
  instruction and a way out. Good.
- **`06` slots** — *"SPACE spin · B bet · M max · I insert $5 · C cash out ·
  [E] leave"*. **This is the shot that made me change it.** The first cut ended
  `· C cash out · E` and the bare `E` scanned as a list that got cut off. With
  the bracket and the verb it now has the same shape as its neighbours and the
  bracket ties it to the world prompt. Good.
- **`04` library catalogue** — *"TAB desktop · [ESC] step back"*, correctly the
  only panel still pointing at Escape. Good.

---

## How it is proved

`scripts/probes/w58-e-closes-machines.mjs` — **exit code is the verdict.**

- the **ATM from every screen it can reach** (idle, pin, menu, balance,
  withdraw, card, cash, receipt), `[E]` and Escape each, driven by the machine's
  own documented number keys rather than reaching past the interface
- **slots and blackjack sat on for real** — `openPanel` alone is not enough, a
  LATE frame hook shuts them unless the player is genuinely seated; both stand
  back up on close, checked against `__ct.seated()`
- **the bounce, both directions**, with the key *leaned on* (Playwright marks
  repeat `down()`s `repeat: true`, which is what auto-repeat sends)
- **the catalogue still types `emma`**
- **feet move after every close** — tries forward *and* back, because closing
  leaves the player nose-to-cabinet and `W` walks into the collider

**Mutation-tested three ways, each isolating its own guard:**

| mutation | result |
|---|---|
| `EXIT_KEY = 'f13'` (E is not the exit) | exit 1, 18 failures |
| drop the `isTrusted` guard in `latchSeen` | exit 1, **only** the open-side bounce |
| catalogue does not declare `typing` | exit 1, typing closes the terminal |

A fourth attempt (`false && …`) **failed to compile, and the probe then passed
against the stale `dist/`** — worth knowing: *a failed build leaves the previous
bundle in place, so a mutation test can go green while measuring the old world.*
Every mutation run since greps the build for `built in` before believing it.

`node scripts/bugsweep.mjs` — **0 STATION MISS, 0 COVERAGE**, no new console
errors (the Clock/getImageData/WebGL warnings are pre-existing).
`scripts/health.mjs` WORLD OK. `tsc --noEmit` clean.

---

## Found and NOT fixed — for the desk to queue

1. **The ATM's `thanks` screen is unreachable.** `rows()` still defines it and
   `onKey` still has `if (screen === 'thanks') panel?.close()`, but the `card`
   row now does `screen = 'idle'; panel?.close()` directly (per *"take card from
   atm should immediately get us out"*). Dead code, harmless, but the tenth
   screen the item mentions no longer exists. Not touched — it is behaviour the
   user asked for.

2. **`scripts/probes/w58-caption-shots.mjs` needed a 2.5 s settle after `__ct`
   appears.** `__ct` is published while geometry and textures are still
   building, so the first frame is **solid black** — which reads exactly like a
   culled or broken world. I bisected against mainline before spotting it. **Any
   probe that shoots straight after `waitForFunction(__ct)` is photographing a
   world that has not been drawn yet**, and this is a plausible source of past
   "the room is black" reports. Worth a GOTCHAS entry.

3. **76 surfaces still have no declared density** (343 texture creations vs 267
   declarations, per BUILDER-BRIEF §7b). Untouched by this item, still true.

4. **`A-verify-select-through` is red on mainline** (35/44) — pre-existing, not
   this work, confirmed before I started.
