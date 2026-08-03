# w72 — locate a room from `roomDims().cx`, never from the slab formula

Item 212. Ports **4280** (`vite preview` over `dist/`, for `G-rooms-walk`) and
**4281** (`vite dev`, for `interiors-walk`, which imports `ct/doors.ts` inside
the page and cannot run against a built preview — item 164).

## Root cause, one line

`ct/interior.ts` gives every interior an 80 m slab and **used to** centre the
room in it; item 196's party wall shoves two rooms to a shared slab boundary so
one opening can be cut through both flank walls, and both harnesses were still
deriving the room's position from the slab — **34.32 m out** (GOTCHAS 86).

```js
-  cx = 400 + Math.floor((inside[0] - 400) / 80) * 80 + 40;   // the SLAB centre
+  cx = built.cx;                                             // the ROOM centre
```

`__ct.roomDims()` has published `cx` all along and both files already held it:
`interiors-walk` fetches `DIMS` at :370 and picks `built` out of it at the top
of the room loop; `G-rooms-walk` needed one `await p.evaluate(() =>
window.__ct.roomDims())` before its loop. **The slab formula is kept in both**,
because it is still true about *which slab* a point is in — it is simply not
where the room is. `G-rooms-walk` now prints it beside the real centre:

```
note  casino: room centre 885.68 is 34.32 m off its slab centre 920 — party wall (GOTCHAS 86)
note  hotel:  room centre 874.32 is 34.32 m off its slab centre 840 — party wall (GOTCHAS 86)
```

Those are GOTCHAS 86's own two numbers, arrived at from the world rather than
copied — which is the point of asking.

## ⚠ THE SLAB FORMULA WAS NOT THE ONLY THING BROKEN BY 196, AND IT WAS NOT THE
## BIGGEST

`G-rooms-walk`'s casino entry regex was still `label: /SEVENS/`, and that regex
**gates entry**: it never matched, so the casino was never walked, and the legs
behind it fell over too. That is most of the `113/114 → 62/65` drop, not the
slab formula alone. `interiors-walk:197` had the same stale regex.

**It is the CHECK that was stale, not the world, and I had this backwards at
first.** I filed it under item 209 as a mainline regression — *"the marquee
still paints SEVENS"* — and that is wrong. `ae06532ad` **repainted the
elevation**, to the user's own words *"make it a combo orpheus hotel and
casino"*:

```
ct/vice.ts   - track(g, 'CASINO', …)            - h.fillText('SEVENS', 92, 58);
             + track(g, 'ORPHEUS', …)           + h.fillText('ORPHEUS', 92, 58);
             - fitTube(g, 'SEVENS', …)          - h.fillText('OPEN ALL NITE', …)
             + fitTube(g, 'CASINO', …)          + h.fillText('HOTEL & CASINO', …)
```

**The word SEVENS is no longer painted anywhere on that building**, and
`int-casino.ts:134` renamed the prompt to match its own sign. The leg is called
*"the painted entrance and the [E] spot still agree"* — they now agree, and the
regex was the last thing still using the old address. Both regexes are
`/ORPHEUS CASINO/` now; deliberately not bare `/ORPHEUS/`, which is the HOTEL's
label two entries down and would match either door now that the two are one
property.

**`building: 'SEVENS'` is UNCHANGED in both files and must stay** — it is the
key into `vice.VICE`, `VICE_DOOR_X` and the DoorDecl registry. The address
changed; the registry key did not. `int-casino.ts:128` says the same thing
about itself.

**Correction filed against my own earlier note**: `notes/w72-index-pairing.md`
§2 says item 196 left a real contradiction. It did not. That paragraph is
superseded by this one.

## Before and after, per file

| | before 196 | with 196 (broken) | after this fix |
|---|---|---|---|
| `G-rooms-walk` (full suite) | **113/114** | 62/65 | **113/114**, twice running |
| `interiors-walk casino` | — | 13/29 | **25/28** |
| `interiors-walk hotel` | — | 17/29 | **26/27** |
| `interiors-walk church` (control) | — | 25/25 | **26/26** |

`G-rooms-walk`'s one red is the pre-existing `[interior:hotel] NO BUILDING
NAME`, the same one every bugsweep prints. **The pass count is back exactly
where it was before item 196**, and the suite size is unchanged: the registry
guard I added is an `exit 3`, not a results row, precisely so the number the
desk compares across runs does not move for a guard that can only ever pass.

`--selftest` still red for the right reasons — **all 4 inverted truths fail**,
including item 209's night-light inversion, exit 0.

### The item-209 leg is not merely unaffected — it got HONEST

Item 212's DONE-WHEN asks that `interiors-walk`'s uuid-keyed leg be
undisturbed. It is (`0/69 dimmed, 2 excluded as self-animating, judged 69 of
71` on the casino). But `G-rooms-walk`'s copy of that leg **changed its
population**, and that is the fix working:

```
                casino  hotel  tax  pawn
wrong centre        57     29    56    59     distinct materials judged
roomDims().cx       69     50    56    59
```

`tax` and `pawn` are unmoved — they are not party-walled, so their slab centre
*was* their room centre. The casino and hotel gained 12 and 21 materials
because the 7 m sample box was previously centred 34.32 m away and half of it
was over dead ground. **My item-209 note observed that the hotel judged only 29
distinct materials and that a typed floor of 40 would have failed it. That 29
was itself an artefact of the wrong centre — it is 50.** The derived floor
(`max(8, 50% of sampled)`) is still the right shape and is unaffected either
way, but the reasoning in that note leaned on a number this item corrects.

## Found and NOT fixed

1. **`interiors-walk casino` has 2 reds that are the party doorway itself.**
   *"walked OUT of the room going −x — from local −3.79 to −9.81, room is 5.5 ×
   18"* and *"the room holds you in … 24 runs from 6 spread points, 1 escapes"*.
   The hotel is at the lower x, so −x from the casino is the opening item 196
   cut on purpose — *"i should be able to walk from one into the other"*. The
   containment legs do not know a room may now have a legitimate interior
   doorway. **The adjacent leg already distinguishes the case** — *"you cannot
   walk out through the doorway onto dead ground"* passes — so the fix is to
   let the containment legs consult the same thing. **Wants its own row**;
   `interiors-walk` is item 212's file only for the slab formula, and widening
   a containment check is a judgement call, not a mechanical fix.
2. **`the customer station comes from the world, not from memory`** fails in
   both the casino and the hotel: *"no served-spot published in this room"*.
   Pre-existing, documented in `F-keeper-stations-audit.md`, untouched by this
   item.
3. **`scripts/G-vice-walk.mjs`'s `/SEVENS/` is the same stale regex** and it is
   red for the same reason (17/18, *"SEVENS: the painted entrance and the [E]
   spot still agree — prompt=[E] into the ORPHEUS CASINO"*). It is a registered
   check (`checks.mjs:741`). Item 212 does not name that file, so I have not
   touched it — the fix is the identical one-line change to `/ORPHEUS CASINO/`
   at its `['SEVENS', SVN.px, /SEVENS/]` entry. **Wants a row; it is one line.**
4. **`crowd-walk.mjs:76` — the item 209 finding still stands**, measured at
   ~19% mispair with a demonstrated false green. See
   `notes/w72-index-pairing.md` §1.
