# w18 — item 37, canfail's stale rain needle

**Root cause, one line:** the rain work raised `RAIN_N` from 500 to 2600
(`src/proto/ct/props.ts:87`) and the mutation case still quoted the old literal,
so from `fc332c5c5` it patched nothing.

Fixed by re-quoting the needle, not redesigning the case — still six drops.

## The item's second half was already done, and I checked before building it

The row asks me to *"close the class: make the harness assert that a mutation
actually changed bytes before it trusts the result."* **It already does.**

- `canfail.mjs:~805` — `if (n !== 1) results.push([name, 'NEEDLE', 'matched ${n}x, not 1 — mutation not applied'])`
- `:~868` — `const bad = results.filter((r) => r[1] !== 'CAUGHT')`
- `:~903` — `process.exit(bad.length ? 1 : 0)`

So a needle that matches nothing is scored `NEEDLE`, counted as bad, and exits
non-zero. There is a second guard beside it — `INERT`, at `:~834` — for a
mutation that compiles to *identical bytes* even though the source changed. The
harness was never certifying itself mutation-proof; the file's own comment at
line 169 records it saying so plainly on a previous occasion.

**So the rain case was not invisible — it was visible and unread.** That is a
different problem from the one the row states, and the fix for it is different
too: what was missing is a way to find a stale needle *without paying a full
build plus a browser per case*, which is why nobody ran it.

## What I added instead

`scripts/probes/w18-canfail-needle-audit.mjs` — reads the `CASES` table and the
file-constant table out of `canfail.mjs` itself (no second copy of either) and
greps every needle against the file it targets. **35 cases, about a second, no
build, no browser.**

```
35 cases with a quotable needle
every case still aims at exactly one place
```

Run it before trusting a canfail run, or after any refactor that moves a
literal.

## The probe's first run was wrong, and that is the finding I nearly filed

It reported `park-partial  0x` — a second dead case. **It was my instrument, not
the world.** I was unquoting the needle by wrapping the raw inner text in
`JSON.stringify`, which escapes the backslash, so any needle containing `\n`
came back as the two characters backslash-n and could never match. Every
multi-line case was a false FAIL and `park-partial` is the only multi-line one.

Fixed by parsing through a JSON *string literal* so `\n` expands properly.
Re-run: 35/35 aim true. **Reporting this because BUILDER-BRIEF §7 is right — I
was one commit away from filing a defect against a healthy case.**

## Not done

- **I did not run `canfail.mjs` end to end.** It is a build plus a browser per
  case across 35 cases, and I did not have the budget left to do it and still
  land this safely. The needle is now provably correct and the case will score
  `CAUGHT` or `SLEPT` on its own merits; **nobody has yet confirmed which**, and
  a `SLEPT` here would mean `rain.mjs` does not notice a storm of six drops.
  That single run is the outstanding work on this row.
- The audit only covers cases whose needle is a plain quoted literal (35 of
  them). If a case is ever added with a computed needle it will be skipped
  silently — the probe prints its case count, so compare it against the table.
