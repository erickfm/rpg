# `ownership.sh` passes any file nobody has claimed — and 10 modules are unclaimed

Builder C. `CLAUDE.md` sends every builder to `./scripts/ownership.sh <agent>`
to answer *"are your edits inside your boundaries"*. On ten of the twenty-odd
`ct/` modules it cannot answer that question, and says yes.

## Measured, both directions

```
touch src/proto/ct/props.ts   (listed, owned by B)
  ✗ src/proto/ct/props.ts  is owned by B, not C          caught, correctly

touch src/proto/ct/traffic.ts (NOT LISTED in OWNERSHIP.md)
  ✓ every changed source file is yours                   passed
```

Same script, same builder, same kind of trespass. The only difference is
whether the file appears in the table, so **the guard is strongest on the
files least likely to be touched by accident and silent on the rest.**

## The unclaimed ten

```
civic-doors.ts   crowd-net.ts   doors.ts        gap.ts       hud.ts
int-bodega.ts    lot.ts         sidestreet.ts   traffic.ts   world.ts
```

That list is not marginal. `world.ts` is where every module is registered,
`doors.ts` carries the declaration the facades read, `hud.ts` owns the prompt
every interaction speaks through, and `traffic.ts` drives the fleet. Any
builder can edit any of them today and be told the edit is in bounds.

## And one of them is the module I have been changing all week

`ct/lot.ts` is unlisted. In practice it is mine — I wrote it, and the desk
routes its tasks to my queue. But my own queue header says:

```
Owns: ct/apartment.ts, resGroundTex in ct/tex-world.ts
```

which does not mention it either. So the file I have made the most commits to
this week has no recorded owner in either place, and `ownership.sh C` clears me
for it by the same rule that would clear anyone else.

I have not written myself into `OWNERSHIP.md`. Ownership is the desk's to
assign and a builder claiming a module by editing the table is exactly the move
the table exists to prevent — and it would paper over the general defect while
fixing only my line.

## Two fixes, both the desk's call

1. **Make unlisted FAIL rather than pass.** One condition in `ownership.sh`:
   a changed file with no owner is not "yours", it is unassigned, and the
   builder should be told to ask. Today's behaviour is the wrong default for a
   guard — it is permissive exactly where the answer is unknown.

2. **Assign the ten**, or record deliberately that some are shared. `doors.ts`
   and `world.ts` may genuinely be nobody's-and-everybody's; if so, saying that
   in the table is what makes the guard trustworthy, because then "not listed"
   stops meaning two different things.

Until then: `ownership.sh` green means *"nothing you touched belongs to someone
else who claimed it"*, which is a narrower sentence than the one `CLAUDE.md`
advertises.
