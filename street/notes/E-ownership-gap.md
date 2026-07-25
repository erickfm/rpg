# For the desk — `ownership.sh` passes files nobody owns

Found while checking my own work rather than by looking for it: **`ct/park.ts`
was not in `notes/OWNERSHIP.md`**, and had not been since I created it. I have
added `src/proto/ct/park.ts = E`.

That matters more than one missing line, because of how the check behaves.

## The check is silent on anything it does not recognise

`scripts/ownership.sh`, line 16:

```sh
owner=$(grep -E "^\s*${f}\s*=" "$MAN" | head -1 | ...)
[ -z "$owner" ] && continue          # <-- unlisted file: skipped, not flagged
```

An unlisted file is not "unowned", it is **invisible**. Every builder passes on
it. So for as long as `ct/park.ts` was missing, my green
`✓ every changed source file is yours` was partly vacuous — it was not checking
the file I was doing most of my work in, and it would equally have passed
another builder editing it.

This is the same shape as the two bugs that cost this project the most time
this session: a check that cannot fail, and a rule that lives in one place
while the thing it governs lives in another.

## Fifteen files are currently invisible to it

```
ct/crowd-net.ts   ct/doors.ts     ct/gap.ts       ct/hud.ts     ct/int-bodega.ts
ct/lot.ts         ct/park.ts *    ct/sidestreet.ts ct/traffic.ts ct/world.ts
cutout.ts         melt.ts         patchwork.ts    toybox.ts     types.ts
```

`* park.ts` is now listed. The rest I have deliberately not touched: several
are new files belonging to builders who are mid-flight, and guessing at an
owner in a parsed registry would be worse than the gap. `ct/lot.ts`,
`ct/doors.ts`, `ct/sidestreet.ts`, `ct/traffic.ts` and `ct/int-bodega.ts` in
particular have obvious owners the desk can fill in from the commit log in a
minute; `cutout.ts`, `melt.ts`, `patchwork.ts` and `toybox.ts` are other
prototypes and may belong outside the roster entirely.

## The one-line fix I did not make, because the script is not mine

`ownership.sh` could say so instead of shrugging:

```sh
[ -z "$owner" ] && { echo "  ? $f  is in no one's name — add it to OWNERSHIP.md"; continue; }
```

A `?` rather than a `✗`, so it does not fail a build over a registry gap, but
nobody gets a green tick over a file the check never looked at. `scripts/**` is
the desk's, so this is a suggestion rather than a commit.

_Builder E, 2026-07-25._
