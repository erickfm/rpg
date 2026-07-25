# The library interior — the tenth room

*"i want to build out the insides of the following: burger barn. diner.
**library**. tax service. pawn shop. bodega. thrift store. my room. the casino.
the hotel. ill let you divide all that up its pretty intense."*

Nine of those were built. Mine was not. The doors have been shut since the
courtyard landed, and I had it recorded in my own quality report as *"scope
rather than a defect: it needs an interior, not a fix"* — which is a polite way
of saying I kept finding smaller things to do. `ct/int-library.ts` now exists
and the room is open.

## What is in it

A 1997 municipal branch. The character comes from the same place the exterior's
does — it is CIVIC and it is UNDERFUNDED, and those pull against each other in
every object:

- **3.6 m ceiling** where a shop is 2.9. The kit's own note says a library wants
  more, and this is the number that stops a room this size reading as a shop
  unit with shelves in it.
- **Four stack bays**, running away from the door so you look *along* them. A
  library reads as a library because of the corridors between the bays.
- **The card catalogue** — 60 drawers, brass pulls, label holders. The object
  that dates the room: in 1997 the terminal is on order and this is still the
  catalogue.
- **The issue desk**, solid to the floor (a counter you can see the librarian's
  knees under is a shop counter, not a civic one), with a date stamp and wire
  trays, and a librarian behind it drawn from the 8-angle citizen atlas.
- **A reading table with four chairs, and you can sit on all four** — the user's
  standing rule, *"for every seat in the game i want to be able to sit down"*,
  registered through the same `ctx.seat` the park benches use.
- **One of the four ceiling troffers is out**, the lino is worn through on the
  walking line, and the noticeboard is papered.

## The door needed its own declaration

Every other room sits behind a flat shopfront at x = ±FACE, so the kit derives
the `[E]` spot 0.75 m out from that plane. The library does not — `ct/civic.ts`
recesses it 3.2 m into a courtyard and puts a flight in front of it. Measured
along the door axis rather than assumed:

| x | floor | |
|---|---|---|
| −11.8 … −10.2 | 0.99 | the threshold platform |
| −10.2 … −8.4 | ramp | the flight |
| −8.4 … | 0.14 | the courtyard |

So `DOOR` carries a `face` on the platform, and the way out lands at the foot of
the steps — 2.35 m clear of the way-in trigger, which the kit checks because
landing inside it sucks you straight back in.

**The trigger had to be 1.6 m, not the kit's 1.05.** Walking up the steps carries
you to x −11.61, which is 1.36 m past a trigger centred on −10.25: the prompt
appeared as you passed through it and was gone by the time you stopped, so
pressing E at the doors did nothing at all. Found by walking it.

## Two faults worth naming

**The books were on the wrong faces.** A `PlaneGeometry` faces +z, so
`rotation.y = 0 | π` hung every shelf of spines on the *end* of its bay, pointing
down the aisle. The result was a wall of books straight ahead and blank brown
board on both sides of every aisle — the faces you actually walk between. R_y(±π/2)
turns +z to +x, which is where the books live.

**The spines were ledger-sized.** At 16 px/m one texel is 6.25 cm, so the
narrowest book the texture could draw was already wider than a real one and most
came out 12–19 cm. A shelf is read from under a metre away: at 32 px/m a texel is
3.1 cm and a 1–2 texel spine is 3–6 cm, which is a paperback and a hardback.

## And why every [E] test in this repo is flaky

`crosstown.ts` dispatches E **edge-triggered inside the frame loop**:

```js
const feedDown = input.keys.has('e');
if (feedDown && !feedHeld) { active.act(); }
```

Playwright's `keyboard.press` sends keydown and keyup with no delay between them.
If both land inside one frame, the loop samples `keys` before and after and never
sees the key down — **the press does not happen**, intermittently, depending on
where it falls against the frame boundary.

That is the mechanism behind the `seats-walk` reds I reported to the desk this
morning as "not reproducible, and I do not believe it". I was right that the
seats were fine and wrong to leave it there: a seat that refuses E once and works
the next time is not a flaky seat, it is a press that fell between two frames.
**Any harness driving `[E]` should hold the key ~120 ms**, not `press` it. Mine
now does.

## Walked, not looked at

`scripts/E-library-in.mjs`: the room is in the belt; walking up the steps offers
the way in; E puts you inside; the table has four seats and you can sit on one;
the way out is offered and lands you at x −7.90, z −13.00, gy 0.14 — the foot of
your own flight — without the way-in prompt coming straight back up. No console
errors. Shots in `shots/E-library/`.

## The rest of the brief, checked against the user's words

`FEATURE-REQUESTS.md` carries the roster brief with both my buildings quoted.

**Church — *"catholic, beautiful"*, "tallest thing on its stretch".** Measured
by module stamp rather than by a guessed z-window: the church tops out at
**32.70 m** at the cross, against **22.00 m** for the tallest thing on the
stretch that is not it. Holds, by 10.70 m. (My first measurement said it failed
by 11.10 m — it had binned the church's own tower, which stands 10 m up the
street from the nave, as a neighbour.)

**Library — "grand but unmaintained".** The grandeur was built; the second half
of that sentence was not. There was soot from the cornice and a flat 0.18-alpha
rectangle under each sill, which is measurable and barely visible. Now:

- water comes off the ENDS of a sill, not evenly off its middle, so each window
  sheds five separate runs from each outer corner, longest and darkest at the
  corner itself;
- the bottom 1.25 m is soiled — splash-back, grit and a green cast, densest at
  grade. A stone plinth the same colour at the ground as at first-floor sill
  level is a building somebody looks after, which is exactly what the user said
  this one is not.

_Builder E, 2026-07-25._
