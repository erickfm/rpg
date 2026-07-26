# BLOCKED — A — the flat-colour ground row cannot close from my files

**Row:** *"123 ground-facing surfaces across the world are untextured flat
colour (~454 m²)"* — LIVE, routed to me.

**Blocked on:** a bounded cross-file mandate, **or** E / D / park's owner
adopting. Either unblocks it. I am not asking for the mandate over the owners
doing it; the desk's brief said *do not repaint anyone's approved artwork*, so
that call is the desk's.

## My half is done and landed

The desk's framing was *"you own the shared painters so you fix the CLASS, not
the instances — publish helpers so owners adopt in one line, and tell me which
owners to route."* All four complaints now have a published helper:

| complaint | helper | whose |
|---|---|---|
| library forecourt shadow patches | `plazaTex` | B's, already written to E's dimensions |
| driveway apron as flat grey | `apronTex` | B's |
| library interior blank slab | `slabTex({ joint: 2.0 })` | mine, `ct/paint.ts` |
| park paths reading as road | `slabTex({ joint: 0, grain: 0.18 })` | mine |

`slabTex` keeps the owner's colour — worst channel drift 1–4 across three real
cases — and takes edge density from a flat quad's zero to 9–17%. Verified on a
box top face, which is the shape civic's landing and flight actually are.
`scripts/A-slabtex-proof.mjs` asserts it and exits non-zero.

## Why I cannot finish it

**Neither file I own creates a ground mesh.** Measured, not assumed:
`ct/tex-world.ts` and `ct/paint.ts` are painter files — they make textures, and
neither contains a single ground-facing mesh. Every one of the 123 surfaces is
in `ct/civic.ts` (E), `ct/lot.ts`, `ct/street.ts` (D) or `ct/park.ts`.

So there is no subset of this row I can advance by editing my own files. The
work that remains is one line per surface in four files that are not mine, and
`OWNERSHIP.md` plus the brief's "do not repaint approved artwork" both say that
is not mine to take unasked.

## What unblocks it, cheapest first

1. **Route E** — the two surfaces the user actually pointed at, both in
   `civic.ts`. `plazaTex` for the forecourt landing and flight, `slabTex` for
   the interior slab. The exact snippet, including the materials-array index
   for a box top, is in `notes/A-flat-ground-routing.md`.
2. **Route park's owner** — `slabTex({ joint: 0, grain: 0.18 })`. Note the
   paths are already textured (`park.ts:140`), so this is a character swap and
   not a bare quad; whoever takes it should know that before they go looking
   for an untextured surface.
3. **Or grant me a bounded mandate** for `civic.ts` and `park.ts` — one commit,
   ground materials only, nothing else touched. Short now the snippet is proven.

## One thing I could not do, said plainly

**I could not reproduce B's census of 123 / 454 m²** and have published no
number of my own. Three predicates, each wrong: `y ≤ 1.6` counted 307 by
sweeping in roofs and the interior rooms; tightening to `y ≤ 0.7` gave 61 and
was still counting cars; and both missed civic entirely, because its offenders
are box TOP faces in a materials array and I was reading `mats[0]`. B's number
stands — it was measured by someone who knew the module. I have also not built
a check on that predicate, because a guard I have had wrong three times would
file false faults against other people's modules.

## I tried to preview it and abandoned that too

To make the decision easy I tried to apply `slabTex` to the real civic surfaces
at runtime — no source change, just a screenshot of what adoption buys. **I
could not reliably locate them: fourth failed attempt.** The probe came back
holding cars again (1.8 x 4.5 m boxes at y 0.59 in green, red, blue and yellow)
because my guess at the library's x range was wrong.

Recording it rather than trying a fifth time. The same predicate has now failed
four ways — roofs, interior rooms, cars, and `mats[0]` on box faces — and a
preview would not change who makes this call anyway. **The owners can see their
own surfaces without a probe; I cannot see them without one.** That asymmetry
is most of the argument for routing this to them rather than to me.

What the desk already has is enough to decide on: the helper is measured
(colour drift 1-4, edge density 0 -> 9-17%), proven on a box top face, and the
exact snippet is in `notes/A-flat-ground-routing.md`.
