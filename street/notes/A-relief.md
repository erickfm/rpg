# Builder A — the shopfronts have real projection now

Mandate item, landed in **`c91bd15b`**: `ct/tex-world.ts` + `ct/street.ts`, one
commit. `BLOCKED-A.md` deleted.

## What the diff in D's file is

**13 lines: one import name and two call sites.** No roster, no building depth,
no flank material, no collider. Both call sites are one statement each,
immediately after the shop mesh is added:

```ts
if (!b.res) shopfrontRelief({ scene, name: b.nm, wMeters: b.w, trim: b.col,
  x: side * FACE, z: cz, rotY: side < 0 ? Math.PI / 2 : -Math.PI / 2 });
```

The walk-up is skipped — it has a doorcase, not a shopfront.

## What it does, and why mouldings rather than slabs

Shading makes a painted plane read as built, and at 16 px/m that is the right
answer for a 50 mm lip. What it cannot give you is what you see walking *past* a
shop rather than standing square to it: the sign edge catching light down the
street, the stallriser stepping out at your shin, the glass sitting back behind
its jambs. That is silhouette, and silhouette needs geometry.

But a solid projecting fascia box **covers the painted sign**, and a solid
stallriser covers its panels — the depth would come at the cost of the art that
was just put there. A real shopfront frames its fascia with a cornice above and
a bed-mould below, and its glass with jambs and a cill. So: seven mouldings —
cornice, bed-mould, two jambs, head, cill, plinth.

Everything derives from `frontageOf()`, so the relief lands exactly on the
painted features instead of beside them. That is the whole reason the descriptor
exists, and this is the first thing to consume it.

`shots/r-oblique.png` is the view that matters — down the street at an angle,
where the fascias now step out of the wall. `shots/r-square.png` shows the
mouldings landing on the painted features without covering the sign.

## Three fields added to `Frontage` — F gets one for free

```ts
fasciaBottomM: number;   // underside of the fascia, metres above the pavement
glazingBottomM: number;  // the WINDOW SILL HEIGHT
glazingTopM: number;
```

Additive; nothing existing changed. **`glazingBottomM` is the `sill:` the
int-*.ts rooms hand-type** — `int-tax.ts` says `sill: 0.95`, `int-pawn.ts`
`sill: 0.95`, `int-thrift.ts` `sill: 0.9`. Those are now readable from the same
authority as the door position rather than guessed alongside it.

## No collider change — walk-proved, not asserted

Nothing projects past **0.30 m**, because `street.ts`'s footprint colliders
already start at `FACE - 0.3`. So the reserved space was there before I arrived.

Proved by walking rather than by arithmetic:

- 13.2 m along the west frontage past DINER and THRIFT, unobstructed
- pushing straight into the shopfront stops the player at **x = −6.33**, and the
  deepest moulding reaches **−6.80** — 0.47 m of clearance

You cannot touch them. **I did not change collision and did not need to.** If a
future piece wants to project further than 0.30 m, that is a conversation with
D, not a bigger number in my file; the constraint is written into the function's
doc comment so the next person meets it before the ruler.

## One trap worth knowing

Each moulding gets its **own material instance**. `props.ts`'s `dimWorld()`
grades a material once, by the elevation of the first mesh it sees wearing it —
share one between the cornice and the plinth and the whole set gets graded as if
it lived at whichever height came first. That would have shown up as a fascia
lit like a kerb, at night only, which is a horrible thing to debug later.

## Conflict discipline

Rebased immediately before starting, again before touching `street.ts`, and
again before committing. `street.ts` was still at `cedf7680` every time — **no
change of D's landed under me and there was no conflict to resolve.** Had there
been, I would have stopped and said so rather than resolving it.
