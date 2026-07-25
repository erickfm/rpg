# Every seam-audit finding routed to `ct/street.ts` is now closed

`notes/seam-audit.md`'s triage table lists most of these as **"still live"**.
It is out of date — six of the eight were closed by other people's work or by
the block re-cast, and two I closed today. Written down because I have now
re-opened this table twice looking for work, and the desk will too.

Checked one at a time, on current mainline, not inferred from the table.

| # | audit says | actually | evidence |
|---|---|---|---|
| 1 | still live — untextured party walls, `endM` a flat `#53382e` | **closed** | `endM` survives only as a comment at `ct/street.ts:351` explaining what it used to be. Every flank derives from its own building's brick (`e466c43c`), and they now carry party-wall marks too. |
| 2 | still live — four brick sizes round the bodega corner, `bodegaBrick` hard-codes 11.7 px/m | **closed on my side** | `bodegaBrick` no longer exists — A's masonry-density mandate deleted the local painter. 0 hits in the file. The `facadeTex` half was A's and is theirs to confirm. |
| 4 | still live — alley floor 9.7 px/m against a 32 px/m walk | **closed today** | `507bbc62`. 24 px/m computed from the alley's real metres; grain per square metre; stains sized in metres; a real 0.4 m drain. |
| 5 | still live — you cannot enter the bodega from the sidewalk | **closed** | `scripts/D-walk.mjs` walks it from the side street and gets `[E] into the BODEGA` every run. The trigger was re-centred on the drawn door and sized to where a player comes to rest. |
| 9 | medium — `facadeTex(…, 22)` painted for 22 m on a 24 m face, 7.33 px/m vs 8.0 | **closed** | it is `facadeTex('#5c4436', 4, 24, 13.6, 0)` now — painted for the face it is mapped onto. |
| 10 | medium — 1.45 m of OPTICIAN buried inside its neighbour | **closed by the re-cast** | OPTICIAN is not in `NORTH2` any more. Walked the roster arithmetic: FLOWERS 16.45, CHOP SUEY 22.45, HOTEL ORPHEUS 33.45, GOLDEN ACES 45.45 → **57.00**, and the east cross building spans **57.00 … 63.00**. They abut exactly — no overlap and no gap. |
| 12 | still live — `bayFrontT` at 16.97 px/m against 8 px/m next door | **closed** | the bay is `masonry(CFW, SHOP, 0, SHOP_MULT)` — the same density function and the same multiplier as the `shopfrontTex` it abuts, so they cannot diverge. |
| 16 | still live — sky over the alley's back wall | **closed today** | `8a7dd3e1`. The end wall's height is derived from the taller of the two buildings the alley is cut between, so it cannot fall behind a floor-count change again. |

## The pattern worth taking from this

Five of the eight were fixed by a change made somewhere else for another
reason — a roster re-cast, a density mandate, a painter deletion. The audit is
a snapshot and the triage is a snapshot of a snapshot; neither notices when
something else closes a finding.

So: **re-measure before re-queuing.** Each row above took under a minute to
check and every one of them would have cost a builder an hour to "fix"
something already fixed.

## Still open in the audit, and NOT mine

- **3 and 7** — shop band vs wall courses, and courses breaking on a
  floor-count change. Both `facadeTex`/`shopfrontTex`, builder A.
- **11** — tree pits off the slab grid. `ct/props.ts` (B) + `ct/tex-ground.ts`.
- **6, 20** — road grain and centre-line dash pitch. `crosstown.ts`.
- **8** — north cross building density, marked "not re-shot". Its roster
  changed too, so it wants the same one-minute re-measure before anyone acts
  on it.
