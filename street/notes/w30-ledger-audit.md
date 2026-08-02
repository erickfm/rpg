# Item 66 — ledger sample drawn and fixed; 2 of 20 verified, 18 handed back

**Handing this back part-done, deliberately.** The item's deliverable is a
**pass rate**, and a pass rate assembled from rows I did not have room to measure
properly would be a number about trustworthiness that is itself untrustworthy —
which is precisely the failure the item exists to correct. What I have left is
not enough for eighteen more honest verdicts, and thinning them to reach twenty
would be the worst possible outcome for this particular item.

So: the expensive, easy-to-get-wrong part is done and committed, and the next
builder continues the **same** sample rather than re-drawing one.

## What is done

**The sample is drawn, seeded and reproducible** —
`scripts/probes/w30-ledger-sample.mjs`, `n=20`, **seed `20260802`**,
Fisher-Yates without replacement over the 238 rows matching `^| CONFIRMED |`.
It prints its seed. **Re-run it and you get the identical twenty**, which is what
stops the audit from quietly becoming a hand-picked sample — the one way an audit
whose whole output is a pass rate can flatter itself.

```
L 80 [B] puddles look awful            L198 [B] drive entrance graphically bugged
L 82 [B] isSelfLit misclassifies       L204 [G] church entrance geometry
L106 [D] ATM inlaid, slanted, lower    L215 [D] narrow long detailed alley
L121 [A] thrift facade chopped off     L218 [E] park still needs work, bench
L122 [A] pavement shows through glass  L226 [D] add detail to this alley
L125 [F] thrift interior too thin      L245 [C] window frame top right
L163 [E] gazebo shelter / bin in sign  L260 [B] why does the lighting catch
L167 [D] align these crates to wall    L274 [C] neighbour just disappears
L187 [D] cat on right side of trash    L320 [J] library feels cramped
L195 [H] kid's face is multi colour    L197 [B] wetness lasts after rain
```

**Two rows re-verified against the world as it is now** — not against the
evidence they cite, which the item is explicit about
(`scripts/probes/w30-ledger-verify.mjs`):

| row | verdict | fresh measurement |
|---|---|---|
| **L125** thrift *"too thin"* | **HOLDS** | still exactly **11.3 × 9.4** |
| **L320** library *"cramped"* | **HOLDS** | **20.0 × 22.0**, 27 colliders inside, **0 RED** |

Both cells now carry a dated `RE-VERIFIED w30` stamp.

**L125 turned up the ledger's own documented failure mode.** The claim holds, but
the *evidence has gone stale*: the cell said thrift was **"sixth of ten"** by
narrowest dimension, and it is now **seventh of thirteen** — the world has gained
`apt301`, `jail` and `bank` since. Six rooms are narrower (apt301 3.1, diner 7.0,
pawn 8.0, burger 8.5, tax 8.5, bodega 8.8), so the row's *conclusion* — it is not
the thin one — is untouched, and only the ordinal moved. Corrected in the cell,
which is what LEDGER.md's own *"EVIDENCE GOES STALE"* rule asks for. **This is
worth flagging as a pattern:** any ledger row whose evidence is a RANK or a COUNT
over the world's rooms is stale by construction every time a room lands, and
several of the remaining eighteen are of that shape.

**L320 is now measurable in a way it was not this morning.** The row was raised
off the V overlay's red, and as of item 65 that overlay no longer scores moving
actors — so a re-verification of any red-based row gets a stable answer instead of
one that changes with where the pedestrians are standing. The library has no
actors in it, so this particular row is unaffected either way, but rows L167 and
L215 (crates, alley) are outdoors and would have been.

## Method, for whoever takes this on

Verify from the **world**, never from the cell. Both rows above were decided by a
single structural query, and that is the shape to look for first: a claim that
reduces to a number `__ct` already publishes (`roomDims()`, `colliders()`,
`spots()`, `walkers()`) is decidable in seconds and cannot be argued with.

The remaining eighteen are **not all like that**, and that is the real cost:
L121, L218, L245, L260 and L198 are visual judgements about facades, framing and
lighting, and the project's own rule is that **screenshots are for LOOKING, never
for PROVING**. Those need a station to stand at and a look, one at a time.
L274 (*"neighbour just disappears… make him go in his apt and close the door"*)
is behavioural and needs observation over time, not a snapshot.

## Found and NOT fixed

1. **Eighteen rows of the drawn sample are unverified**, listed above. Continue
   with `node scripts/probes/w30-ledger-sample.mjs 20 20260802` — same seed, same
   twenty, no re-draw.
2. **No pass rate is stated, on purpose.** 2 of 2 measured held, and that is
   **not** a pass rate — a denominator of two says nothing about 238 rows, and
   quoting "100%" off it would be exactly the kind of confident, unfounded number
   this item was written to hunt. The rate is worth having only at n=20.
3. **Rank- and count-based evidence cells go stale silently** whenever the world
   gains a room, as L125 did. Worth a sweep of its own: grep the ledger for
   ordinals and totals and re-derive each.
