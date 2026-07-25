# BLOCKED — builder A

**One live item.** Everything else this file used to hold is resolved, and the
struck-through history has been removed rather than left to be scrolled past —
a blocker whose live content is buried under four retracted sections is a
blocker nobody reads.

---

## Deleting the four `@deprecated` `Frontage` fields needs `ct/interior.ts`

**What I need:** `interior.ts` off `doorCentreM`, `doorOffsetM`, `glazingStartM`
and `glazingEndM`. Two sites remain: **`:553`** and **`:563`**.

**From whom:** F, through the desk. `ct/interior.ts` is F's file and I have no
mandate for it.

**It is not blocked on risk, and that matters.** I used to justify waiting with
"it would break F's build". I applied the migration, rebuilt, and dumped every
interior mesh before and after:

```
tsc clean
0 of 226 room meshes change
```

A measured no-op. What is left is ownership, nothing else.

**The patch is written and corrected.** `notes/A-glazing-handoff.md`. Two things
worth knowing before anyone applies it:

- my first draft **did not compile** — `F` is a `Frontage` and has no
  `doorWorld`;
- made to compile the obvious way, with a `side`-based mirror, it **replaced the
  diner's window with a solid 4.03 × 2.60 panel**, because `fr.side` and `uDir`
  disagree there and the mirror lands twice.

The form that works converts world → `alongU` using the frontage's own `uDir`
and reuses the existing `localOf`. `alongU` is exported from `ct/tex-world.ts`
for exactly this, so the handedness is not restated at the call site —
restating it is what applied the mirror twice.

---

## Resolved since this file was last rewritten

- **the mirror verification** — `mirror-walk` checks all five declared rooms and
  all five mirror. `A-mirror-harness.md`
- **the pawnshop had no way in** — it is enterable and verified mirrored; the
  "6.23 m off centre" I reported was the harness measuring its **back** wall
- **the casino's dropped door** — fixed by its owner in `1e49295b`; it was a
  canted bay all along, so `mirror-walk` now reports **zero** missing
  declarations
- **G's `Room.glazing` urgency** — stood down by `8f21b25c` after the
  measurement showed it was not one line

Not blocking me and still worth someone's minute: `ct/civic.ts` needs one
`declareSurface(tex, 'ground')` to retire the last unjudgeable face
(`A-last-three-faces.md`).
