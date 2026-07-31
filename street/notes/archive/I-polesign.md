# The pole sign: all three complaints are answered in the world

Builder I, 2026-07-25. The rest of my fourth queue item, after the `printed`
half shipped on its own (`notes/I-printed.md`).

The item carries three separate user complaints. **All three were already fixed**
— in `938cce350` (*a cabinet you can read, on two faces instead of one*) and
`33cf77604` (*one message, CROSSTOWN AUTO, and an arrow that points at the
gate*). Neither was ever checked from where the user judges it, which is the
street, so that is what this is.

| complaint | state | evidence |
|---|---|---|
| *"simplify to ONE message"* | done | name + `USED CARS` strapline. The phone number is gone from the cabinet entirely; it lives on the fence banner where someone standing at the lot can read it |
| *"the panel is tiny against an enormous pole"* | done | 2.4 × 3.2 → **6.0 × 4.5 m** on a 15.5 m mast. `CROSSTOWN` is 0.51 m of letter and `AUTO` is 1.19 m, against 0.31 m for both before |
| *"the two faces read as skewed rather than flat or back-to-back"* | done | two single-sided planes, measured at x **7.71 and 8.09**, both at z 8.19, headings ±1.57 — parallel, 0.38 m apart, back-to-back, clearing a 0.13 m mast |

## Walked and looked at, from four angles

Screenshots are for looking, so these are looking, not proving — the numbers
above are the proof.

- `shots/I-sign-far-kerb.png` — **13.9 m out, from across the street**, which is
  the viewpoint the size was argued about. `CROSSTOWN / AUTO / USED CARS` is
  legible, the cabinet dominates the mast rather than perching on it, and the
  arrow points at the gate.
- `shots/I-sign-obl50.png` — **50° off the face normal.** This is the one that
  matters for "skewed": foreshortened as any flat panel is, and it reads as ONE
  solid cabinet. No hollow, no gap between the faces, no two-planes-at-an-angle.
- `shots/I-sign-street.png`, `shots/I-sign-obl25.png` — 7.2 m and 25° off.

## A shot of mine that missed, said rather than quietly dropped

My first "edge-on" frame (`shots/I-sign-edge-on.png`) contains **no pole sign at
all** — it is sky, the flagpole and a fence. I had aimed a one-off script by
coordinate and never asked whether the subject was in the frame, which is the
exact failure `scripts/aim.mjs` was written about: *"a frame that does not
contain its subject is reported as a miss, not quietly filed as evidence."*

Recording it because it nearly became evidence. Two of the numbers in the table
above would have been "confirmed" by a picture of a flagpole.

The replacement is the 25/50/70° set. At 70° the sign is genuinely occluded by a
street tree, which is not a lot defect and not mine.

## No source change

`ct/lot.ts` is untouched by this half. The two ledger rows — *"pole sign panel
too small / skewed"* and *"big sign should be simpler"* — describe a sign that no
longer exists.
