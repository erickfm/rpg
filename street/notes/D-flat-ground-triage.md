# The street's flat-colour ground: the number moved, and some of it is not ground

Routed to me as *"27 ground-facing surfaces, 43 m²"* with `slabTex` published by
A and the instruction to fix the class rather than the instances. Two things to
correct before anyone adopts, both measured.

## The count has moved: 35 surfaces, 49 m²

`scripts/A-flat-ground.mjs` is the authority — it is the predicate the 123-surface
world-wide figure came from — and at HEAD it reports:

```
street              35 surfaces    49 m²    19 distinct tones
biggest             0.36 × 10.5 m  #6d6455  at (-7.2, 0.45, -92.5)
```

Not 27/43. Worth saying because the routing note's number is what an adopter
would check themselves against, and it would not match.

## And the biggest of them is a RAILING, not ground

`#6d6455` is `railM` in `ct/street.ts` — `openSite`'s railing. A's predicate
counts a surface as ground-facing when its normal points up, which a rail cap's
does. So does a kerb top, a sill, a plinth ledge. **They are up-facing; they are
not ground.**

`slabTex` paints paving grain and a joint. On a rail cap that is wrong — it would
read as a strip of pavement balanced on the railing, which is a worse fault than
the flat tone it replaces, and it is the kind of thing that gets reported as
*"why does the railing look like a path"*.

My own first probe made the same mistake in the other direction: filtering on
"thin and near the ground" it found **73 faces / 37.5 m²**, mostly shopfront
stallriser ledges at y 0.32. Three predicates, three different populations. That
is GOTCHAS §25 — read what the column is actually asking before acting on it.

## So this item is triage, not a sweep

The class fix is right and `slabTex` is the right tool **for the surfaces that
are actually ground**. The street's 35 need sorting first:

| | what it is | what it wants |
|---|---|---|
| open-site railing caps | metal | leave alone, or a metal grain — NOT paving |
| kerb tops, sills, plinth ledges | stone trim | a fine stone grain at most, no joint |
| genuine ground slabs | ground | `slabTex` with a joint, as briefed |

**Nobody should adopt blanket.** The 49 m² is a long tail of small trim, and the
real bulk of the world-wide 454 m² is `ct/tex-ground.ts`'s own big sheets —
245 m², 180 m², 116 m² and 94 m² — which are B's, not mine.

I have not repainted anything. A wrong texture on 35 surfaces is harder to
notice and harder to undo than a flat tone, and this is the last-ranked item on
my queue rather than one the user is waiting on.
