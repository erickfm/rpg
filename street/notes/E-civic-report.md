# Quality pass — the library, the church, the park

Graded the way `AUDIT-TRIAGE.md` grades: by **whether a player can see it**, not
by how cleanly I can measure it.

This started as a look at three finished areas and turned into something else.
The first pass found four things by looking. The second pass — after the park
gained relief — found nine more, and **not one of them was visible in a
screenshot**. They were found by asking the world questions: which mesh is on
top, what is the floor here, do these two surfaces share a height. That is the
finding behind all the other findings, and it is why three new checks exist.

Method: `E-verify` (six areas now), `nightgrade` per area box, and a read of both
files against the gotcha list. Shots in `shots/E-audit/`, `E-mound/`,
`E-shelter/`, `E-park-night/`.

## Still open — route these

| # | finding | can a player see it? | where |
|---|---|---|---|
| 1 | **The library courtyard and the churchyard have NO light source at all.** Not dim — unlit. The courtyard has benches you sit on and steps you climb; at 22:30 you cannot see the doors you are standing in front of | **Yes, and it is the exact complaint the park got** | lamps are `ct/props.ts` (B) |
| 3 | **The gate lamp stands on the park's entry centreline**, 1 m inside the gate at x −7.9, z −83. You side-step it going in | **Yes** | `ct/props.ts` (B), **but the coordinate was mine** |
| 5 | **The park site's ground is a flat plane nobody may displace.** `openSite` in `ct/street.ts` floors each site with one opaque 32 × 30 m plane at `KERB_H`. A module that owns relief cannot cut below it, so my dish and corner fall had to be re-cut as hollows in a crown rather than real depressions | **Not any more** — but it caps how much topography the park can ever have | `ct/street.ts` (D), constrains `ct/park.ts` |

Finding **3** is worth naming as a mistake rather than a defect. I handed B a
table of lamp coordinates so the park would not be re-cut a third time, and one
of them puts a lamp in the middle of my own gateway. I checked those positions
against my colliders and never against the entry path I had drawn myself.

## Found and fixed since

All in `ct/park.ts` or `ct/civic.ts` unless noted. Ordered by what a player
would have noticed.

| finding | what it looked like | how it was found |
|---|---|---|
| **The dish and the corner fall were drawn UNDER the park's own paving** | The two hollows were invisible and the floor picker still lowered you into them — you walked down into a dip that was not there | `E-coplanar`, then measured: at four points the site plane was on top and the grass 16–79 mm beneath |
| **Every desire line ran the wrong diagonal** | The network fanned from the wrong corner of the gate. A mirrored fan still looks like a fan | reading the strip's own vertices after a drape check pointed at them |
| **Both civic flights had never been tested** | Nothing — the world was correct. The harnesses reported "all walks passed" having SKIPPED both climbs for hours | the wired/unwired probe read a shared last-written value |
| **The shelter's bench was not a seat** | You walk 26 m to the thing the loop exists for and it is scenery | `__ct.seats()` had no seat inside it |
| **The shelter roof read as a slab** | Its two slopes bottomed out at exactly the height of the wall plate drawn beneath them, so no part of the pitch was ever visible | looking, at the one angle that shows it |
| **The gate spur ran 0.75 m into the loop's street leg** | Two coplanar path surfaces fighting for depth, in the one place every visitor walks | `E-coplanar` |
| **Two desire lines fought where they cross** | Flicker on the mound you notice and cannot place | `E-coplanar` |
| **The mound bench floated 36 mm at one end** | A gap under a cast end, on 1-in-17 ground | `E-onslope` |
| **Desire lines and the bald patch sank into the grass** | A worn path that fades out over a mound looks like a worn path that stops there | `E-drape` |
| **The shelter's textures broke §5** | Grain that changes scale between two pieces of one shelter: 4.0 px/m across the roof, 114.3 up the front plate, against the world's 8 | computed from the member sizes |

## The checks that came out of it

Three new, all in `E-verify`, all written because the fault they catch is
invisible in a screenshot:

- **`E-drape.mjs`** — what is laid on the grass stays on top of it. A vertical
  ray needs no Raycaster (the page publishes no `three`): point-in-triangle in
  XZ plus one barycentric height.
- **`E-onslope.mjs`** — what stands on the grass is not floating above it.
- **`E-coplanar.mjs`** — no two *visible* surfaces share a height (§6). Names
  which two meshes coincide, with sizes and positions.

**Every one of them was wrong before it was right**, and that is the part worth
recording:

- `E-coplanar` first reported 83 points that were all correct geometry — two
  rectangles sharing an edge, with the ray landing on the boundary line. A hit
  now has to survive a 5 cm nudge, which an abutment cannot do.
- It then reported the UNDERSIDES of stacked boxes. Only upward-facing
  triangles can fight over a pixel you see.
- `E-onslope` first compared terrain to terrain and reported the same 36 mm gap
  *after* the bench had been fixed, because it was measuring the hill.
- `E-drape` asserted the field must be the top surface, which fails wherever
  anything legitimately stands on the grass — at one sample a bench 4 cm up.
- `E-park-walk` asserted the dish was lower than `KERB_H`. A hollow is a hollow
  relative to the ground around it.

A check that fires on correct geometry teaches you to ignore it. Each of these
was fixed rather than tuned to pass.

## And the harnesses themselves

The largest single finding of the pass. **Every floor reading in my four
harnesses teleported the player and read `pos()[3]`** — that is `apt.gy()`, a
last-written value that the citizens on the pavement also write, so the answer
is whoever asked the picker last. It cost real diagnoses in both civic areas: a
single stale read decided which HALF of a suite ran, so both flights went
untested while the runs reported green. `window.__ct.groundAt(x, z)` asks the
picker directly. A median of three does not help — it is not noise, it is a
different question being answered.

Two more, same shape:

- **`E-yard-walk`'s gate probe** was one un-retried walk deciding OPEN vs
  SEALED, so one citizen in the gateway turned the climb into a SKIP and the
  run still said everything passed.
- **`E-verify` echoed only the lines it recognised**, so when every child exited
  3 on the provenance guard it reported *"5 of 5 areas failed — do not land
  this"* with no line of why, on a build where all five pass by hand.

The lane legs now downgrade to a NOTE when nothing static is within 0.8 m: §9 is
the check that most needs believing when it fires, and it went red twice today
for a busy pavement. `E-walk --selftest` exercises that branch — and caught my
first rig, which forced the walk 3 m past the library into the next building's
footprint where a collider legitimately is.

### A six-area pass cannot outrun the merge train

Worth the desk knowing, because it is not a fault in anything and it will bite
anyone who writes a long harness.

`E-verify` takes about twenty minutes over six areas under load. The merge train
rebases builders more often than that, so HEAD moves out from under `dist/`
mid-run and every remaining area exits 3 on the provenance guard. It took three
attempts to catch a window; the successful one reads **`all 6 areas walk`**.

That is the guard doing its job and there is nothing to fix in it — but it does
mean the practical unit of verification here is the individual harness, and an
aggregate is a thing you get when you are lucky rather than a gate you can rely
on. If the desk ever wants `land.sh` to gate on one, it will need either a much
faster suite or a way to pin the tree for the duration.

It is also the clearest argument for the echo fix that went in today. The run
before the good one came back *"5 of 6 areas failed — do not land this"*, and
because the banner is now echoed it said exactly why: the served build was
`9bffa9ed7` and the checkout was `be0767d62`. Before this morning that was five
bare `FAILED` lines on a build where every harness passes by hand, which sends
you looking at the world instead of at the build you are serving.

### The integration world can be probed but cannot be WALKED

My work is landed, so "does it hold up in the world the user actually plays" is
finally a question I can ask, and `which-world.mjs` supports it with
`SHOT_WORLD=integration`. The answer splits cleanly in two, and the split is not
documented anywhere.

**Geometry and floors: identical to my tree.** `groundAt` at the church door
0.55 and the library flight 0.42 in both. `E-drape` and `E-onslope` both fully
green against `:5177`. Every floor probe in `E-park-walk` agreed to the
millimetre — 66 level points, the mound at 0.51, the dish 50 mm deep, the
transect 347 mm.

**Anything that WALKS is worthless there.** `live-integrate.sh` rebuilds every
15 s and that RELOADS THE PAGE, so a harness longer than about fifteen seconds
has the ground taken out from under it:

    page.evaluate: Execution context was destroyed,
      most likely because of a navigation

`E-walk` got eleven passes and then died on exactly that. `E-yard-walk` reported
the church flight failing at *x −1.40, gy 0.00* — the middle of the road, 10 m
west of the church — and `E-park-walk` walked to *z 9.00*, a hundred metres out
of the park. Neither is a fault in the world: the page reloaded, the player went
back to spawn, and the walk carried on from there. I went looking for a church
that had moved before spotting it.

The banner in `which-world.mjs` warns about "one page error: Vite's HMR socket".
That undersells it — the socket dropping is cosmetic, the navigation is not, and
a builder reading only the banner will trust a walk result they should throw
away. Worth a stronger warning there, and it is shared code so I have not
touched it.

### A wait loop whose pattern matches the waiter never ends

Not about the world, and it cost the shared machine more than anything else I
did today.

I used a lot of

    until [ -z "$(pgrep -f 'node scripts/seats-walk')" ]; do sleep 10; done

to wait on long harnesses. `pgrep -f` matches full command lines, and that loop's
own command line contains the pattern — so it always sees a match, never sees
the thing it is waiting for finish, and spins forever. I left **eleven** of them
running. Two had been polling every ten seconds for three hours; one had
survived from a previous session and had been going for **sixteen**.

The bill landed on everyone. This box has sat at load 30–50 all day with five
builders on it, and a good share of that was mine. It also cost me directly:
several of my own runs crawled, and I spent turns diagnosing "the harness keeps
restarting E-verify" when I was competing with myself.

If you need to wait on a process, match something the waiter cannot contain —
`pgrep -f "^node scripts/foo"`, or watch the output file, or just have the thing
you started signal you. And check for strays before blaming the machine.

## Record, do not route

| finding | why not |
|---|---|
| **Both civic doors are closed forever** — you climb steps to a leaf 0.36 m away with no prompt | Scope, not a defect: it needs an interior. `ct/interior.ts` already lists E as a consumer |
| **library ashlar at 9.41 px/m** | Already open as `AUDIT-TRIAGE` R7b |
| **The path's asphalt patch lands at the park entry** | Reads as a tar repair, which is what it is |
| **Hoop rail has no collider** | Deliberate: a knee-high wall you cannot cross would be worse |
| **The church's painted steps sit behind the real flight** | Occluded at every angle you can stand at. Latent if the flight moves |
| **The corner fall reaches only paving level** | Consequence of finding 5, not a defect of its own |

## Clean, and worth not re-checking

- **§22 `alphaTest` + `transparent`** — zero in either file. `nightgrade`: park
  `alphaCut` 1.000 → 0.302, opaque 0.128 → 0.024.
- **§3 ground billboards** — none. **§10 mirrored art** — every `DoubleSide`
  plane is symmetric by construction. **§2 the seeded stream** — no `rnd()` draw
  in either file; the only two matches are comments explaining why not.
- **§9 the sacred lane** — audited by collider and driven on foot, both ways.
- **Wiring** — every export of mine has a reader.
- **The `dimWorld` scare** — I measured a plain material getting *lighter* at
  night and had a note written saying `dimWorld` replaces colour instead of
  multiplying it, which would have made every flat-coloured material in the
  world glow. It is wrong: `props.ts` stamps `userData.graded` on all of them
  and the model is a multiply. What I measured was `POOL_GAIN 12` from a lamp
  head 3.7 m away. Recorded so nobody re-opens it.

_Builder E, 2026-07-25._

---

# Second quality pass — 26 July, graded from player stations

The desk's method instruction, in the user's words: *"take screenshots yourself
and grade it and make sure you are impressed with it. be skeptical."* So this
pass is 19 stations × day and night, each one somewhere a player arrives under
their own steam, shot by `scripts/E-qpass.mjs` and graded by opening every
frame. **The canonical station for the park is the gate, on foot from the
pavement** — the desk's ruling, and the one the user's own screenshots use.

**The headline is not about the world.** I ran my own suite first and it
reported four red areas. **Not one of them was the world.** All four were my
probes answering a different question from the one asked, and finding that out
took most of the pass. What the world actually looks like is further down.

## The four reds that were mine, not the world's

| the check said | the truth | why it lied |
|---|---|---|
| the library frontage lane is blocked | it is clear; the sacred 2 m holds | `colliders()` **publishes the citizens** |
| the courtyard floor sits at 0.99 in four places | 48 samples, all 0.14 | it read `pos()[3]`, not the picker |
| the courtyard descent ends at gy 0.99 | floor 0.14, eye 1.62 — correct | same shared last-written value |
| the park stopped getting wet | `#ffffff → #a5a7ac` | it sampled two DRY moments, off the wrong mesh |

### `__ct.colliders()` contains moving people — this one is everybody's

**494 colliders; 6 of them move every frame.** They are 0.5 × 0.5 m boxes
sliding along z in the two pavement lanes, x −6.25…−5.75 and 5.75…6.25. They
are the pedestrians.

That matters well beyond my file. **Any harness that uses `colliders()` to
establish "nothing static is here" is unsound**, because a person standing in a
lane is in that list and looks exactly like a bollard. Mine did, on the check
guarding §9 — the sacred lane — which is the one that most needs believing when
it goes red.

I found it by noticing the blocking box was at z −13.84…−13.34 in one run and
−13.81…−13.31 in the next. **Three centimetres.** Static geometry is
bit-identical between runs of a seeded world; a person is not.

**The fix, for anyone who wants it:** snapshot `colliders()` twice about half a
second apart and keep only the boxes present at *identical coordinates* in
both. Everything that moved, arrived or vanished is alive.

### And three smaller traps, all documented in-file

- **`pos()[3]` is a shared last-written value** with several writers. Use
  `__ct.groundAt(x, z)` — the picker, GOTCHAS §7. `probeLanding` in `E-walk`
  was fixed for this weeks ago and *the floor grid beside it was not*, which is
  how it came to report four broken points in a courtyard that is fine.
- **`rainAt()` takes the ABSOLUTE hour** and `clock(h, m)` sets the time of
  **day**. Picking a "wet hour" and setting the clock to it does nothing.
  `updateRain` also gates on `px < 100`, so a rain check can spin forty game
  hours indoors and conclude the weather is broken. Drive time and watch
  `rainLevel`; stand in the park you are asking about.
- **`pos()[1]` is a CONSTANT, not a world y.** Measured at six places with
  floors from 0.14 to 0.99 — pavement, both flights, the mound crest — it reads
  **1.62 at every one**. It is eye height *above* the floor. I added it to two
  assertions today as an independent second opinion and it is not one: the
  identical term turned a correct church flight **red** and went **green** in
  `E-walk`, where the walk happens to end on the 0.14 pavement and the constant
  matched what I was predicting. Same wrong idea, opposite outcomes, **and the
  green one is the more expensive** — it would have sat there being cited.
- **A WebGL canvas is empty to `drawImage`** — the drawing buffer is discarded
  after compositing unless `preserveDrawingBuffer` is set. My frame guard read
  one colour off a world that was visibly drawing. Measure the PNG you wrote,
  not the live canvas.

## Still open, ranked by whether a player can see it

| # | finding | can a player see it? | whose |
|---|---|---|---|
| 1 | **The churchyard and the library courtyard have no light source at all.** Measured, not eyeballed: `church-yard-night.png` contains **six distinct colours** in the whole frame. You cannot see the door you are standing at | **Yes — it is the complaint the park already got** | lamps are `ct/props.ts` (B) |
| 2 | **The canopy soffit over the library doors is a flat untextured near-black slab.** It is directly above the entrance, filling the top of frame at the one station every player stands at | **Yes** | **mine**, `ct/civic.ts` |
| 3 | **The mowing stripes do not read from the gate.** At the ruled 1.5 m / 6.9% the field reads as a flat olive plane from the canonical station | **Yes — this is the whole point of the feature** | **mine**, but the numbers are a desk ruling |
| 4 | **The park is walled by tall blank brick on three sides**, so it reads as a yard between buildings rather than a park | **Yes, in every frame** | not mine — the neighbours' backs |

**Finding 3 is a report, not a change.** The desk ruled width and contrast
explicitly after I raised the conflict, and said *"code presence is NOT the
test — if you cannot immediately read alternating mown bands, they are not
working, whatever the source says."* By that test, from the station the desk
itself made canonical, they are not working. Both frames are in
`shots/E-qpass/`. I have not touched the numbers; **the ruling is the desk's to
revisit, and it may reasonably decide the subtlety is correct** — a mown field
in flat midday light is subtle. But it should decide it having seen the frame.

**Finding 4 is worth a sentence** because it is the largest single thing making
the park read wrong, and it is nobody's defect — it is what happens when a park
is inlaid into a block of buildings. Anything that broke that brick up along
the park boundary would buy more than any further work inside the park.

## What is genuinely good, and worth not undoing

Graded skeptically, these are the things I would defend:

- **The shelter reads correctly.** Four posts on a square plan, one roof seated
  on their tops with a real overhang and fascia, the posts inboard of the eave,
  a boarded ceiling you see from underneath, a bench inside it. This is the
  thing that failed three times; `park-shelter-day.png`.
- **The path is unmistakably a park path**, not the carriageway. The single
  biggest win of the whole park effort, and it holds.
- **The benches face the park**, sitter's back to the boundary.
- **The boundary railing has its bottom rail**, the pickets run down to meet it,
  and it sits on its wall — the three faults the user listed, all closed.
- **The weeds cluster at the path edges** with bare gaps, and none grows down
  the middle.
- **No ground wear.** `worn()` is defined and never called; the field is clean
  mown grass, as ruled.
- **The library steps and landing carry the flag texture** — A's `plazaTex`
  adoption landed and it reads as civic paving.
- **The fanlight is cropped to its arch** and PUBLIC LIBRARY reads from the
  pavement.

## Two things I checked and did NOT file

Worth recording, because a rejected finding costs one paragraph and a false one
costs somebody a day.

- **The park at night is the best frame in the whole set.** Ten lanterns in
  three ranks throwing warm pools down the full length, stars, the shelter in
  silhouette, the noticeboard lit. `park-gate-approach-night.png`. That is the
  row the ledger already confirms, and it holds from the canonical station —
  which is exactly what makes finding 1 stark: the same block, fifty metres
  away, has courtyards with no light in them at all.
- **The heavy dark band along the bottom of the railing frames is NOT an
  untextured surface.** It reads like one at a glance, and I nearly filed it.
  `railTex` in both files draws pickets, a top rail, a bottom rail and rust on
  a 12 px/m canvas; what the frame shows is the wall coping seen from 3 m with
  the railing edge-on above it. Checked in the source after seeing it, not
  instead of seeing it.

## A station of my own that was wrong

`church-tower` stood at z −88 and **photographed the BODEGA.** I would have
graded a corner shop as a church if I had not opened the frame. The church is
at x 9.5–11.3, z −73.5…−86, its tower the 17 m mesh at (11.3, −79.5), and the
gate is on that axis — measured off the world, not remembered. The stations are
corrected in `E-qpass.mjs` and the reason is written beside them.

It is the same mistake as the four above, one level out: **I filtered on a
coordinate I remembered rather than one the world reported.** Ten times today
the answer was the same — *ask the object what it is.*

_Builder E, 2026-07-26._

---

## Postscript, same day: two rows verified for other people, and the pile is empty

Written here rather than in a second file because the method is the point.

**K/C's sleep fade** — CONFIRMED. Station: the bed in 301 at 23:10, with
`[E] sleep until morning` on screen *before* anything was pressed. Screen luma
off the composited PNG: **t+120 ms 0.394 → t+400 and t+550 BLACK at 0.0000 →
t+1900 0.520**, and the world comes back *brighter* because the clock has run to
dawn. `scripts/E-sleep-fades-to-black.mjs`, with a negative control
(`E_NOPRESS=1`, same eleven frames, no keypress → exit 3) and an in-trace
positive control. The positive control was needed: the station is an unlit
bedroom whose *pre-press* luma is already 0.0065, so "it went to 0.0000" against
that would have been a green earned by the room being dark.

**O's jail** — CONFIRMED, all six stations walked and looked at. The claim that
needed the most care was the one the row puts in capitals, *is the sergeant
looking at you or past you*. **These are 8-sector sprites whose painted sector
is chosen relative to the VIEWER**, so a figure facing the camera proves nothing
on its own. What settles it is a frame in the same run where a uniformed figure
at the same counter **shows his back** — the system encodes real facing, so the
frontal sergeant is a fact about him rather than about the renderer. And *one
man in one of the cells* was not settled by looking into two cells and calling
it empty: a census of person-sized alpha-tested quads returns **exactly three**,
at the lobby bench, the counter, and **(994.8, −1.3) inside the left cell run** —
and the frame at 14 m shows him through the bars.

**Three wrong turns on the jail, all mine**, and they are the same one: I guessed
the interior coordinates and photographed a blank wall; pressed `[E]` from 2.23 m
away from a 1.05 m trigger and was one line from reporting the door dead; and
waited a flat 900 ms for the door transition instead of polling for it — which
is the exact false red O's own file warns about at length.

**The verification pile is empty.** Every LANDED row in `LEDGER.md` has been
checked by somebody who is not its author.

_Builder E, 2026-07-26._
