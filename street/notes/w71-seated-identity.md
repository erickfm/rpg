# Item 217 — the w69 probes sat on a pose no seat owned

Worker **seventyone**, 2026-08-02. `scripts/probes/w69-seated-offers.mjs` and
`scripts/probes/w69-seated-loan.mjs` only. **No world code touched.**

## Root cause, one line

`crosstown.ts:1864` is `sit: (pose) => rig.sit(pose)` — it stores **the caller's
own object** — and both machine modules match their seat by identity
(`ct/library-pc.ts:56`, `ct/slots.ts:1836`, `s.pose === pose`), so a probe that
sat with a freshly-built `{x, z, yaw, h}` literal sat on a pose **no seat owned**
and every seat-triggered behaviour silently did not fire.

## I took fix (b), and (a) as the row states it would now be HARMFUL

The row offers **(a)** *"make `__ct.sit` take a seat index"* and calls it the
stronger fix, and **(b)** *"make the two probes sit by identity — fetch the real
pose from `ct.seats()` and pass that object"*. Two corrections:

**1. (b) as described is impossible.** `page.evaluate` **serialises its
arguments**. Fetching the pose in node and passing "that object" hands the page a
**copy**, which is a fresh literal, which is the bug. Identity is precisely what
does not survive that boundary — the same fact `actorColliders()` and
`citAvoid()`'s `actor` flag are both built around. **The lookup has to happen
inside the page**, and the working form is:

```js
await p.evaluate((k) => window.__ct.sit(window.__ct.seats()[k].pose), i);
```

**2. That idiom is already landed, in three probes.** Worker seventyfour — the
one that found this — wrote it into `w74-seated-e.mjs:71`,
`w74-does-the-poll-fire.mjs:40` and `w74-why-not-offered.mjs:26`, with the same
comment. **So (a) is not "stronger", it is breaking:** changing `__ct.sit`'s
signature to take an index would break all three of those call sites, and adding
an index *variant* alongside the pose form leaves the footgun open for every
future probe anyway — it does not remove it. Following the established, working
precedent is the whole of BUILDER-BRIEF §7's argument.

## 188's number MOVED, and the row asked for that honestly

| | before | after |
|---|---|---|
| only standing up on offer | — | **127** |
| **opened a machine, `[ESC]` out** | **0 — none ever opened** | **92** |
| something also on offer (head-on) | 0 | 0 |
| could not be seated | 2 | **0** |
| **NO WAY OUT** | 102 (on the first identity run) | **0** |
| accounted for | — | **219 of 219** |

**It is still 219/219, and it is a different 219.** Item 188's acceptance
evidence was taken with an instrument in which **no machine seat ever opened a
machine** — 87 slot stools, 4 blackjack seats and 2 library terminals all
behaved like plain chairs. **188's proof was not wrong about the seats it
measured; it simply never measured the 92 seats that are the interesting ones.**
Stable across two consecutive runs (127 / 92 / 0 / 0 both times).

## The repair exposed two further faults, both fixed here

**1. The loop died at the first slot.** Sitting seat 89 opens `ct-slots`;
`ct/hud.ts` blocks keydown while a panel is up, so `stand()` never fired, and
`rig.sit` refuses to hop between seats — so **every seat after 89 failed to seat
at all.** That is what produced the contiguous tail of nulls. Measured: `could
not be seated` went 2 → 0 once the panel was closed between seats.

**2. "No prompt" is the wrong test for a machine seat.** `hud` hides the prompt
while a panel is open, so demanding prompt text reported **102 of 219 seats as
"no way out"** when the way out is Escape. And on the first cut of the repair I
required a stand-up prompt *after* Escape — which failed **93 correct exits**,
because **`[ESC]` closes the panel AND stands the player up in one press.**

The check is now BUILDER-BRIEF §11's actual rule — *a view you cannot leave is
the worst bug this project ships* — expressed as: press Escape, and require that
you end up **free**, which is either off the seat or still on it with the exit
named. **That is strictly stronger than the text test it replaces: it exercises
the exit instead of reading about it.**

> I nearly shipped that second fault as a finding. 93 seats reporting "trapped"
> looked exactly like a real defect, and it was my own assertion being wrong
> about a correct world — GOTCHAS §7's "half of all defects here are the
> instrument". The tell was that `panel=null` in every one of the 93: Escape had
> plainly worked.

## Proof

- `w69-seated-offers.mjs` — 219 seats, **0 with no way out**, exit 0, twice.
- `w69-seated-loan.mjs` — all clear, exit 0. Sits the bank client chair, gets
  `"[E] stand up"` head-on, `"[E] read the loan application · [ESC] stand up"`
  when aimed, opens the form on the paper (seated, fov 45, eye 1.354), and **one
  ESC closes the form and leaves the chair**.
- The seat population floor (`< 200 seats → exit 3`) was already there and still
  holds at 219.
- **No world file was touched**, so no sweep/fp is owed — the build the probes
  measured (`afcc7191b`) is mainline's world plus my two probe edits.

## Found and not fixed

1. **`scripts/probes/w74-baseline.mjs:41` is a THIRD probe with the same
   fresh-literal `sit`.** It is not named by item 217. It is a diagnostic rather
   than an acceptance check, so it misleads whoever reads it rather than
   certifying anything — but it is one line and should follow.
   `grep -rn "__ct.sit({" scripts/` finds it and nothing else, so after that the
   pattern is gone from the tree.
2. **The footgun itself is still armed.** Both fixes here are call-site fixes; a
   future probe can still hand `__ct.sit` a literal and get a silent
   half-working sit. **The real cure is in `crosstown.ts`, which item 217 does
   not name**: make `sit` reject a pose that is not in `SEATS` — *throw*, rather
   than adding an index overload — so the mistake is impossible instead of
   merely documented, and the three w74 call sites keep working unchanged. That
   is a small, separate row and I did not take it (BUILDER-BRIEF §9).
3. **`something ALSO on offer` is 0 across all 219 head-on**, which is correct
   and worth stating so nobody reads it as a regression: nothing should be
   offered when you are looking at nothing. The seated-offer behaviour item 188
   built is proved by the loan probe's aimed case, not by this counter.
