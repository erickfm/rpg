# Item 285 — DISPROVED. The ATM never lies; the probe stood inside a wall.

Queue worker **onehundredfourteen**, 2026-08-03. **`src/proto/crosstown.ts`
UNTOUCHED — no world code changed.** Measured on the **built bundle**
(`vite preview`, port **4482**), commit `397e4a140`.

Read `notes/onehundredfifteen-item285-scoping.md` first. It got the structure
right and did the hard half; this does the two measurements it named as missing
and one it did not, and the answer comes out cleaner than it expected: **the row
is false at both spots, not one.**

---

## 1. The claim, and what a real approach actually shows

> *"The ATM displays its `[E]` prompt at yaw 0, and pressing `[E]` at yaw 0 does
> nothing."*

`scripts/probes/w114-item285-atm-press.mjs`, both spots × three stand-offs ×
four cardinal yaws, **drift 0.00 m at every one of the 24 stations** — the world
did not move the player anywhere:

```
station                       drift   prompt                                 panel across 1.5 s   travel
  z7.288 d0.9 yaw 0       0.00   [E] into FIRST FEDERAL                 nullx15       moved 446.11 m
  z7.288 d0.9 yaw pi/2    0.00   [E] FIRST FEDERAL — use the machine    ct-atmx15     moved 0.07 m
  z7.288 d1.2 yaw 0       0.00   [E] into FIRST FEDERAL                 nullx15       moved 445.81 m
  z8.238 d1.2 yaw 0       0.00   [E] into FIRST FEDERAL                 nullx15       moved 445.81 m
  …
```

**At yaw 0 the ATM is not what is on offer. The bank DOOR is — at both spots, at
0.9 m, 1.2 m and 1.6 m.** And the door is not lying either: pressing it moves the
player **445–446 m**, which is the bank interior. `panel = null` is the correct
outcome of pressing a door.

onehundredfifteen found this true at `(-7, 8.238)` and called the other spot a
genuine mismatch. **From a stand-off it is not.** Its report was taken at the
spot's own centre; mine is taken from where a player stands. **Both halves of the
row's evidence are a door working properly.**

## 2. WHY THE ORIGINAL MEASUREMENT SAID OTHERWISE — and it is not a small thing

`w109-atm-approach.mjs:32` warps to `(s.x, s.z)` — the spot's own coordinates,
`x = -FACE`, **inside the bank facade** (`ct/bank.ts:655`). From in there,
`pickSpot`'s **tier 1 is `d < RADIUS`** — *the spot's centre is inside your own
body* — and **tier 1 wins regardless of which way you are facing**. So the ATM
prompt appeared at yaw 0 because the probe was standing in the machine, and
whether it appeared at all depended on how far `unstick` shoved the player out of
the wall.

**A yaw sweep taken from inside a wall is not a yaw sweep**, and this one produced
a user-facing bug report about a world that behaves correctly. My stations report
their drift on every line precisely so this cannot recur silently.

## 3. "Never opened" or "opened and shut"? — NEVER OPENED, and it never should have

The one measurement the scoping note asked for (§6): sample the panel across the
press rather than once at the end. Fifteen samples over 1.5 s, every station.

- Where the prompt names the ATM: **`ct-atm` on the first sample and on all
  fifteen** — 12 of 12 stations. It opens immediately and stays open.
- Where the prompt names the door: **`null` on all fifteen.** Not a flicker. So it
  is not "opened and shut", not the `DISMISS_LOCKOUT`, not `open` returning early
  — the ATM's `act()` was never the thing that ran.

## 4. WHICH SIDE WAS WRONG — the row's own "done when"

**Neither. The instrument was.** onehundredfifteen showed structurally that they
*cannot* disagree — one `pickSpot` at `crosstown.ts:2252`, one `active`, feeding
both `hud.prompt` and `active.act()` in the same frame — and this is that argument
confirmed at runtime across 24 stations: **every prompt was delivered by the press,
without exception.**

## 5. The five diegetic tenants — 0 lying prompts in 27 stations

The half the row asked for and the scoping note recorded as *"not examined at
all"*. `scripts/probes/w114-item285-tenants.mjs`, four approach directions × three
stand-offs, each aimed at the tenant, drift-filtered:

| tenant | registered label | panel | stations where the prompt named it | lies |
|---|---|---|---|---|
| ATM (reference) | `FIRST FEDERAL — use the machine` | `ct-atm` | 3 | **0** |
| slots | `sit at the slot` | `ct-slots` | 2 | **0** |
| library PC | `sit at the computer` | `ct-library-pc` | 6 | **0** |
| loan | `read the loan application` | `ct-loan` | 6 | **0** |
| mail | `open your mailbox — 3 letters` | `ct-letter` | 7 | **0** |
| calendar | `read the calendar` | `ct-calendar` | 3 (walked) | **0** |

**Nothing copied the defect, because there is no defect to copy.**

## 6. TWO WAYS MY OWN PROBE NEARLY REPORTED NOTHING IN GREEN

Both are worth more than the result, because both would have shipped as a pass.

**(a) `slots` came back MISSING — and that was my regex.** `ct/slots.ts:2356`
writes `'play the slot machine'`, so I matched `/slot machine/i`. The world
registers **`sit at the slot`**, seventeen of them
(`w114-item285-casino-labels.mjs`). A tenant reported *"MISSING — no spot matches
this label"* is indistinguishable, in a summary, from a tenant that was checked.
**A probe that asks for the wrong string measures nothing and says so in green.**

**(b) The calendar was never exercised at all.** My station picker takes the four
compass points around a spot and filters only for *drift*. **The calendar hangs on
a wall**, so half those stations are inside masonry — and a player standing in
masonry sees nothing at all, which is exactly what came back: `(none)` at **8 of
8**. That would have been summarised as "calendar: no lying prompts found".

So the calendar was re-done as a **walk** — the row's own instruction, *"VERIFY BY
WALKING UP AND PRESSING"* — from the flat 301 door toward the bed, reading the
prompt every stride (`w114-item285-calendar-walk.mjs`). It exits **3** if the
calendar is never offered, rather than passing:

```
  0.45    close the door
  0.28    close the door
  0.09    read the calendar    ct-calendar
  0.19    read the calendar    ct-calendar
  0.36    read the calendar    ct-calendar

calendar offered at 3 strides; the press raised its panel at 3 of them
```

## 7. What the desk should do

1. **Close 285. No world change; the row is false.** The user's *"the atm
   interface is so good"* stands and nothing was restyled or narrowed.
2. **`scripts/probes/w109-atm-approach.mjs` is a lying instrument and is still
   live.** Its warp-to-spot-centre is the entire origin of this row. It is not
   named by my item so I did not edit it (BUILDER-BRIEF §9) — **queue a one-line
   header on it, or delete it**, and cite `w114-item285-atm-press.mjs`, which does
   the same sweep from a stand-off and prints drift.
3. **Unrelated but found on the way and worth a row of its own:** at 1.6 m the ATM
   is correctly *not* offered at yaw π/2 or π — `r + TOUCH_MARGIN` is 1.40 — but it
   *is* offered at −π/2, because that is the one heading aimed at it. That is the
   aim tier behaving exactly as item 98 left it, and it is noted only so the next
   reader does not mistake the asymmetry for a bug.

## Inherited state

`npx tsc --noEmit` clean. **No source file changed by this item**, so the sweep
and health results recorded for item 98 still stand (`health.mjs` → WORLD OK;
`bugsweep.mjs` → 96 shots, 0 STATION MISS). Console errors: **0** on every probe
run above. Port 4482.

| probe | question |
|---|---|
| `w114-item285-atm-press.mjs` | prompt, panel-across-the-press and travel, from a real stand-off |
| `w114-item285-tenants.mjs` | do the five tenants show a prompt the press will not deliver? |
| `w114-item285-calendar-walk.mjs` | the calendar, walked, because the station sweep could not reach it |
| `w114-item285-casino-labels.mjs` | what are the casino spots actually called? |
