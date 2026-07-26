# Two checks are matching wording the world no longer says

Found by `scripts/D-dead-prompt-literals.mjs` (new, registered). Neither is
mine, and neither would show up as a failure — both match *nothing* and pass.

## 1. `libboard.mjs:15` — the frieze was renamed out from under it

```js
const s = window.__ct.spots().find(q => /PVBLIC LIBRARY/i.test(q.label||''));
```

`ct/civic.ts:744` records the change: *"PUBLIC, not PVBLIC. The V was deliberate
and defensible … The user has now read it as a typo twice, and that settles
it."* The frieze is **PUBLIC** now. This `find` returns `undefined` for ever.

## 2. `spot-coverage.mjs:89` — a coverage row that covers nothing

```js
['civic-doors-walk', (s) => /doors of the/i.test(s.label)],
```

No spot label contains `doors of the`. The only occurrence anywhere is a
**comment** in `ct/int-bank.ts:24` quoting the user. So this row attributes zero
spots to `civic-doors-walk` — and a coverage table whose row matches nothing
reports the cheerful version of the truth: nothing uncovered, because nothing
counted. GOTCHAS §34.

## The general shape, for whoever owns these

A label is **presentation**. It belongs to whoever last wrote the interaction and
it changes on their afternoon, not yours. Match the **noun the roster owns**
(`FIRST FEDERAL`, `No. 227`) rather than the **verb the interaction owns**
(`check balance`, `use the machine`) — that is the one-line change that would
have saved M's bank run, two clauses of my `D-walk`, and my own
`D-confirmed-prompts`.
