# Park review — the user's three items

Graded the way `AUDIT-TRIAGE.md` grades: by **whether a player can see it**.
Their frame is `shots/user-parkreview.png`; mine are in `shots/E-parkreview/`.

## 1. "THE PATHS READ AS ROAD" — fixed for my half, and the bigger half is D's

The user: *"They are the same dark grey as the carriageway... This one change
will do more than anything else on the list."*

**Mine, done.** The loop's buff was `#7d7565`, which sits between the
carriageway's `#46413a` and the walk's `#84817a` and shares their grey cast, so
in rain or at dusk — which is when the review frame was taken — it collapses
onto the road. Hoggin is gravel rolled into clay: **warm and light**, which are
the two axes that separate it from asphalt under every light in the day. Now
`#9c8b66`. It reads as gravel from the gate and underfoot.

**The bigger half is not mine, and this is the one to route.** The dark slab
paving that fills most of the user's frame is the park SITE's ground — a single
32 × 30 m plane at `y = 0.14` stamped `mod: street`, drawn by `openSite` in
`ct/street.ts`. Measured at five points across the park; the perimeter band
between the boundary and the loop is all that plane. My module cannot repaint it
without laying a second surface over another module's ground, which is the §6
overlap I have spent the day removing.

→ **D**: the park site's ground reads as carriageway. Same request, same frame.

## 2. "SHRUBS ON THE EDGES" — done

The user: *"the boundary is trees standing in front of bare brick with nothing
at their feet... Low massed shrubs along the walls, varied in height, denser
where the wall is blankest."*

The back wall already had a privet hedge for exactly this reason; it was the two
**flanks** that were bare, and the flanks are what the review frame is looking
at. Three rules straight out of that sentence:

- **low and massed** — each run is 2–5 m of two or three boxes at different
  heights and depths, so the top line is broken and the face is not flat;
- **denser where the wall is blankest** — density is driven by distance to the
  nearest tree along that flank. In the gaps the runs are longer, taller and
  closer together; under a trunk they thin and open up. A rule, not a guess;
- **they leave their feet alone** — held 0.15 m off the brick and not sealed to
  the ground, so C's weed tuft has a line to sit in when it lands. The desk
  asked that the shrub layer and the tufts work together; drawing my own weeds
  now would be the second tuft in the world, so I have not.

## 3. Graphics review

| finding | can a player see it? | status |
|---|---|---|
| **Black rectangles on the path** | **Yes** — they read as holes or missing texture | **FIXED, and it was mine twice over.** That is the asphalt patch inside `surfaceTex`: `#4c4a48`, near-black against the old path and pitch-black against the new buff, with a hard 2 px shadow along its top edge — which is exactly how a missing texture looks. Worse, **I had it in my own quality report and waved it through**: *"reads as a tar repair, which is what it is meant to be. Cosmetic and arguably correct."* It is not correct. A cold-patch repair is browner, only a little darker than what it patches, and ragged-edged because it is shovelled in. Now it is. |
| **Long dark diagonal streaks on the paving** | **Yes** — a hard band across the foreground | **NOT MINE, and it correlates with D's.** The surface carrying them at those coordinates is the site ground, `mod: street`. D's own report records that module's three horizontal ground planes as *"the alley floor and the two open-site grounds (park and car lot)"* — so the park floor the user is seeing streaks on is literally one of the three surfaces D is working on. Same module, same class. → **D**, with this correlation rather than a second guess at it. |
| **White path edging very stark** | **Yes, and the user predicted the fix** | Improved by item 1 as they said it would be: the edging has not changed, the surface beside it has, so the contrast is down. Worth re-judging on the next frame rather than tuning now. |

## 4. Weeds — C's tuft, placed

Held until `ct/weeds.ts` landed rather than drawing a second one, as asked. The
placement is the user's own brief, and its last sentence is the design:
*"absent from the middle of the path where feet keep it clear. That contrast
between a worn clean centre and a weedy edge is the whole effect."* So every run
seeds its two EDGES and leaves the centre alone — both sides of all four loop
legs, the four chamfered corners, the gate spur, the foot of all three walls in
the line the shrub layer was held clear for, and a ring at the base of the
memorial, the fountain, the shelter posts and every bench.

**Tone by C's rule, not by eye.** `weeds.ts` says `dry` is for ground PALER OR
GREENER than the tuft and `dark` for asphalt and shadow. Every surface a tuft
stands on here — the new buff hoggin at `#9c8b66` and the site's grey slab — is
darker than the dry palette's mid `#a2955a`, so `dark` is the tone that
separates by hue. I had them all on `dry` first and they read as a hay crop down
both edges of the path; the rule was in the file and I had not applied it.

Height comes from `parkY`, never remembered — the file's docs say to ask, and
this park's ground stopped being flat this morning.

## Walked

`E-park-walk` 16/16 after the shrubs went in — the new runs are colliders and
none of them reaches the loop or the sacred lane.

_Builder E, 2026-07-25._
