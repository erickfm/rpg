# Float audit — objects that touch nothing

**Branch** `audit/seams`, based on `add-stick-and-city98` @ `a8dd629` · read-only ·
nothing under `street/src/` touched. Port 4184.

Brief: *"the sign up top is completely floating. make sure for stuff like this we
pay more attention."* The GOLDEN ACES pylon was already known and assigned to
builder E. The job was to find the others first.

**Answer: there is one more, and it is the same defect on the other sign — the
HOTEL blade hangs 0.47 m clear of the hotel wall with its lowest point 4.1 m up
in open air, attached to nothing.** Everything else in the world that reads as
unsupported is either a light (correctly weightless) or a false positive of the
detector, and both classes are written up below so the next sweep is cheap.

## Instruments

| script | what it answers |
|---|---|
| `scripts/floats.mjs` | *does this touch anything at all* — world-space bbox contact graph, flood-filled from everything that reaches the ground. Writes `shots/float-report.json`. |
| `scripts/support.mjs` | *is what it touches capable of holding it* — classifies each contact as BELOW / LATERAL / ABOVE and measures the contact area. Writes `shots/support-report.json`. |
| `scripts/floatgap.mjs` | *what is this particular object actually near* — nearest-neighbour gaps for one mesh. **This is the check to run after a fix:** the gap must come back 0, and to the right thing. |
| `scripts/floatshots.mjs` | the confirmation shots, sky behind each candidate |

**The contact tolerance is 0.05 m and that is not a free parameter.** This
project mounts flat detail deliberately proud of its wall — alley placas at
0.05, the buzzer at 0.02, the church plaque at 0.02, the alley flanks at 0.01.
At EPS 0.01 the detector reports 25 floating components and most of them are
those intentional mountings; at 0.05 it reports 11 and every one is real or a
light. Anything still unsupported at 5 cm is a genuine float.

Scene at time of audit: 576 meshes, 530 visible.

## Findings

| # | sev | object | file | world coords | camera | what's wrong | screenshot |
|---|-----|--------|------|--------------|--------|--------------|------------|
| 1 | **high** | **HOTEL ORPHEUS blade sign + its mast** | `ct/street.ts` (`if (hotel)` block) | mast `(44.35, 7.4, −96.72)`, 0.22 × 6.6 × 0.5, bottom at **y = 4.10**; two sign planes at x 44.22 / 44.48 | `(40.0, −98.5)` → `(44.35, −96.7)`, pitch 0.62 · `(44.35, −100.5)` pitch 0.75 | **Nothing connects it to the building.** Measured nearest neighbours: its own two sign planes at 0.02 m, then **0.47 m of clear air to the hotel wall**. The mast is a vertical post whose lower end stops 4.1 m above the sidewalk with nothing under it and nothing behind it — no bracket, no arm, no wall contact. `mast.position.set(hx, 7.4, −96.72)`: both the height and the 0.72 m stand-off are hand-typed, and the facade is at z = −96.0. | `float-F-blade-mast-side`, `float-F-blade-mast-below`, `float-F-blade-mast-under` |
| 2 | **high** *(already assigned to E)* | **GOLDEN ACES rooftop pylon** — 2 legs, frame, 2 sign faces | `ct/street.ts` (`if (casino)` block) | legs `(51.23, 19.3, −98.2)` and `(51.23, 19.3, −91.8)`, bottoms at y = 17.2; frame + faces at `(51.23, 25.2, −95.0)` | `(44.35, −100.5)` pitch 0.75 · `(51.23, −101.0)` pitch 1.00 | Confirmed, and **worse than reported**: the casino shell is z −96.0…−92.6, so both legs stand 0.8 m behind and 2.2 m in front of any roof — 2.05 m from the nearest building. And **the legs do not even reach the sign they carry**: nearest-neighbour gap from leg to frame is **0.10 m**. The whole assembly is three disconnected pieces in mid-air. | `float-F-aces-legs`, `float-F-aces-legs-side`, `float-F-blade-mast-side` |

### Lights — weightless by design, not defects

12 additive-blended planes float, correctly: 6 streetlamp halos (±4.3, y 4.92),
2 bodega bulb glows (244, 2.45), 4 apartment stairwell bulb glows. These are
light, not objects. Listed so the next sweep does not re-open them — `floats.mjs`
tags them `[additive/glow]` for exactly this reason.

### False positives — checked and sound

Each of these trips a support heuristic and is correct in the world. Recording
them is the point: it is what stops the next auditor re-walking them.

| object | why it trips | why it is fine |
|---|---|---|
| streetlamp arms, heads, lenses (8 lamps) | cantilevered off a 0.14 m pole, whose largest face is well under the "big enough to carry something" threshold | the arm's bbox overlaps the pole by 0.065 m — genuinely attached |
| library entablature, two 16 m runs at `(−6.8, 12–13.2, −13)` | projects from the facade with no footing under it | it *is* the facade — a cornice, built proud. `float-F-library-cornice` |
| church buttress set-offs, 4 at `(±, 12.6, −109.8)` | 0.2 m proud of the church face | they are the weatherings on the buttresses. `float-F-church-boxes` |
| church cross, `(8.5, 32.2, −111.5)` | the two sticks only graze each other (0.02 m²) | that is what a cross is; the shaft's foot meets the tower top at y = 31.2 |
| bus-stop flag, `(5.32, 2.6, −33.5)` | 0.042 m² graze | the pole runs through it to the ground. `float-F-plate-east` |
| apartment stair flights, landings, balusters, door furniture | small parts, bbox grazes | gap 0 to core wall, treads and floor |
| apartment ceiling domes | 0.038 m² graze | gap 0 to their cylinder fitting, which is 0.03 m from the ceiling |
| bodega ceiling, `(244, 2.7, −15)` | reported as touching nothing at first | detector bug, since fixed: interior walls are single planes (GOTCHAS §12) so a footprint-area test returns zero against them. `support.mjs` now gives zero-thickness geometry a nominal extent for area purposes only. |

## Patterns

**One root cause, and it is not quite the one the brief guessed.** The brief
predicted "authored at a y constant instead of derived from the thing below it".
Half right — the axis is the giveaway:

> **A mounted object's position is written as a literal on every axis, including
> the axis that decides whether it meets its host at all.**

- The blade's defect is in **z**, not y: `mast.position.set(hx, 7.4, −96.72)`.
  The stand-off 0.72 m was typed; the facade is at −96.0; the mast is 0.5 deep.
  Nobody subtracted.
- The pylon's defect is in **z too**: `−95.0 ± 3.2` for the legs against a shell
  that runs −96.0…−92.6. Its y *is* derived (`top = SHOP_BAND_H + 3.4 + 4*2.4`)
  and its y is the one thing that is right — the legs' feet land exactly on the
  roof plane. They just land on it 2.2 m past where the roof stops.

So the rule worth adopting is not "derive y" but: **every mounted object takes
the mounting surface's own coordinate as an input, on the axis of the mounting.**
A blade takes the facade z. A roof pylon takes the roof's z extent, not just its
height. Written that way, both bugs are impossible rather than merely fixed.

**Corollary the two instances share: nothing checks that a support reaches what
it supports.** The pylon's legs miss the sign frame by 0.10 m — a support that
does not touch its load, which no amount of care in placing the *sign* would
catch. `scripts/floatgap.mjs` is the cheap standing check: after any fix, the
nearest-neighbour gap must be 0, and to the intended thing.

## Coverage — what I did NOT get to

- **Interiors are 228 of the 576 meshes and I only swept them automatically.**
  The shop interiors (`int-diner`, `int-burger`, `int-thrift`, `int-casino`,
  `int-hotel`, `int-pawn`, `int-tax`) were in the contact graph and produced no
  un-anchored components, but I confirmed only the apartment and the bodega by
  eye. A shelf or a light fitting inside one of those rooms would have to float
  by more than 5 cm to show up, and I have not looked at any of them.
- **The brief's category list is not fully exhausted by observation.** Wires,
  aerials and fire escapes: the detector found no un-anchored geometry matching
  them, but I did not verify they exist to be checked. If any are added later
  they need a re-run, not an assumption.
- **Moving objects are audited at one instant.** Citizens, pigeons and the
  cruising car were sampled at t ≈ 2 s. A pigeon mid-flight is legitimately
  airborne; a citizen whose feet leave the walk on a kerb ramp would not be
  caught by a single frame. Worth a repeat sweep at several times.
- **Only daylight.** Nothing here should be time-dependent, but the lamp halos
  are opacity-driven and I did not re-run at night.

---

# Round 2 — both signs fixed; one new float, and it is indoors

Base `add-stick-and-city98` @ `5803367e`. Re-ran `scripts/floats.mjs`.

**Both findings closed.** `d2e5d02d` ("Signs: give both of them something to
stand on") anchored the pair. The detector now reports **3 floating components
out of 1,098 meshes**, down from 11 of 530:

| | round 1 | **now** |
|---|---|---|
| GOLDEN ACES pylon (legs, frame, 2 faces) | floating, legs 2.05 m from any roof | **anchored** |
| HOTEL blade + mast | floating, 0.47 m off the wall, base 4.10 m up in air | **anchored — visible brackets tie it to the brick** (`shots/tf-T4-aces.png`) |
| lamp halos, bulb glows | additive, weightless by design | 2 remain, unchanged and correct |

## New finding 3 — a price card floats inside the thrift store

| # | sev | object | file | world coords | what's wrong |
|---|-----|--------|------|--------------|--------------|
| 3 | low | two coincident mapped planes, 0.44 × 0.22 m | `ct/int-thrift.ts` | (602.2, 1.42, −2.42) | A two-sided card — the `twoSided` two-plane idiom — hovers **0.325 m above the shelf under it** (a 2.7 × 0.05 × 0.68 counter top at y = 0.985). Nearest anchored geometry in any direction is that shelf, 0.325 m away. No stand, no bracket, no wire. |

Small, indoors, and low severity on its own. It matters because of where it is:
**the first float found inside a kit room.** The float brief named "hanging shop
signage" as a category and this is the first instance; with seven rooms written
and three more to come, it is worth builders knowing that `scripts/floats.mjs`
covers interiors too — it walks the whole scene graph, slabs included.

## Coverage — round 2

- The **mirroring** of the two signs (seam audit R1) was **not** re-verified this
  pass. It needs the matched opposite-side pair that settled it originally, and
  a steep-angle shot is not enough to judge. Unknown, not clean.
- Moving objects sampled at one instant, as before.
