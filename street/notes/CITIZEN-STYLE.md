# People in CROSSTOWN '97

**If you need a person, CALL THE ATLAS. Do not draw a plane.**

`ct/citizens.ts` is the only place a person is drawn properly in this world. It
paints one sprite sheet per person: **5 views** — front, 3/4, profile, 3/4 back,
back — **× 2 walk frames**, mirrored at draw time for the other side, so a
citizen turns to face you through 8 angles and animates when it walks.

This document exists because that was not written down. Four people in this world
are cardboard as a result: the diner waitress was hand-drawn as a single-view
plane, and the casino, the hotel and the tax office each copied her, because she
was the nearest example anybody could find. One missing page, four flat people.

---

## What it looks like

![the range](../shots/citizen-range.png)

`shots/citizen-range.png` — twelve people across the whole range, five painted
views each, with the `Look` that made them printed underneath. **Look at it
before you write any code.** Regenerate it any time `ct/citizens.ts` changes:

```bash
SHOT_URL=http://localhost:4187/ node scripts/citizen-sheet.mjs
```

That is the answer to "what kind of people does this world have" — not the
adjectives below, the sheet.

---

## Calling it

```ts
import { type Look, citizenAtlas, viewFor, FW, FH } from './citizens';

const tex = citizenAtlas({
  jacket: '#37505e', pants: '#2b2f36', skin: '#8d5a34', hair: '#1c1410',
  fit: 'plain', cut: 'short', build: 0, stride: 3,
});
tex.repeat.set(1 / 5, 1 / 2);          // ONE cell of a 5 × 2 sheet

// the geometry is translated so the ORIGIN IS AT THE FEET, so scaling height
// never lifts anyone off the floor or sinks them into it
const geo = new THREE.PlaneGeometry(0.95, 1.9);
geo.translate(0, 0.95, 0);
const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
  map: tex, alphaTest: 0.5, side: THREE.DoubleSide,
}));
mesh.scale.set(0.98, 1.02, 1);         // width, height — see `build` below
```

Then per frame, pick the cell. `viewFor` takes the angle from the person's
FACING to the camera and returns which column to show and whether to mirror it:

```ts
mesh.rotation.y = Math.atan2(px - x, pz - z);        // billboard toward the camera
const camAng = Math.atan2(px - x, pz - z);
const [col, mirror] = viewFor(camAng - facing);       // facing = atan2(vx, vz)
tex.repeat.x = mirror ? -1 / 5 : 1 / 5;
tex.offset.x = mirror ? (col + 1) / 5 : col / 5;
tex.offset.y = row === 0 ? 0.5 : 0;                   // row 0 = standing
```

`facing` is the direction the person is **going**, as `atan2(vx, vz)` — not a
±1 axis code. A standing person keeps the last one rather than snapping to face
+z.

A worked example of all of this, including a stationary person, is
`ct/apartment.ts` (the hermit). The full walking version is `ct/crowd.ts`.

---

## Every `Look` option

| field | range | what it does |
|---|---|---|
| `skin` | any hex | The full range you would actually see on a street — the cast runs `#3b2416` to `#f6d8b8`. Do not cluster; the sheet shows the spread. |
| `hair` | any hex | Matched to the skin the way it falls in life, not assigned at random. |
| `jacket` | any hex | The garment body. Muted 1997 palette — nothing saturated. |
| `pants` | any hex | Legs. Ignored when `fit: 'dress'`, which shows skin instead. |
| `fit` | `plain` `cap` `dress` `hoodie` `coat` | Garment shape, not just colour: a coat has a longer torso and a centre seam, a dress flares over the hips, a hoodie's hood covers the head, a cap sits over the hair. |
| `cut` | `short` `crop` `long` `tied` `bald` | Hair SHAPE. `long` is a volume from behind, not a filled rectangle; `bald` builds the crown out of skin; `tied` is a knot. Ignored under a hoodie, which covers it. |
| `build` | `-1` `0` `+1` | Torso and shoulder half-width — 6, 7 or 8 texels. A SILHOUETTE change, separate from mesh scale, so the broad ones are not the slight ones blown up. |
| `stride` | `2`…`5` | How far the legs swing on the moving frame. Tie it to pace: `Math.max(2, Math.min(5, Math.round(3.2 * Math.sqrt(speed) * heightScale)))`. A fast walker takes LONGER steps, not just quicker ones. |
| `accent` | any hex | The cap's colour. Only used by `fit: 'cap'`. |
| `grime` | `0`…`1` | Unwashed: sweat-yellowed collar and pits, stains down the front. Low-alpha blotches, so it reads as dirt in cloth rather than as pattern. |

**Mesh scale carries the rest.** Height and width scale independently of
`build`, so vary them together with it — the cast runs `hs` 0.91–1.09 and `ws`
0.92–1.10. Scale the MESH for size; use `build` for shape.

---

## The rules that are easy to get wrong

Each of these is a bug that shipped and was reported.

**A face is one tone with features on it.** The head is 10 texels across, so a
3-texel band of shading reads as an AREA, not as light — the user asked "whats up
with this kids face? its multi color?". Rim shading on a face is 1 texel at about
`rgba(…,0.07)`. The torso can take 2 texels because it is 14 wide; the face
cannot. **No dither, no fine noise, no wide bands on anything head-sized.**

**A stationary person must not march in place.** Feet only stride while actually
walking: hold frame 0 (`offset.y = 0.5`) when halted. A person standing with
their legs mid-swing reads as broken.

**A hood crops the head.** `fit: 'hoodie'` paints over the outer texels, so
anything you put at the edge of the face disappears under it — and anything
*subtle* in the middle is all that survives. Check hooded fits specifically; the
three-band face was worst under a hood.

**A profile foot needs a toe.** In the profile view the ankle sits near the BACK
of the foot: about 1 texel of heel behind it and the rest forward. A foot
symmetric about the ankle cannot say which way it points and reads as backwards —
that took three attempts. The profile column faces LEFT (nose at `cx-7`, cap brim
at `cx-9`), and `viewFor` mirrors it for the other side, so getting it right once
gets both profiles right.

**Legs must not coincide.** At stride 0 the two profile legs used to draw at the
same x, so a standing person had one leg. They keep a 1-texel split at rest.

**Alpha, not translucency.** The material uses `alphaTest: 0.5`, so any fill
under 50% alpha simply is not drawn where it does not overlap something opaque.
A 35%-black "shadow leg" painted on empty canvas draws nothing at all.

---

## If the atlas cannot do what you need

**Ask the desk and extend the atlas.** Do not hand-draw a person beside it — that
is exactly how four cardboard people got into this world. Adding a `fit`, a `cut`
or a new `Look` field is a small change to one file, and then everybody has it.

`ct/citizens.ts` is owned by builder H. It is a shared leaf module: read it
freely, and route changes through the desk so all three callers move together.

**Interiors:** builder F is adding `room.person()` to the interior kit, which
wraps this atlas so a room can stand somebody in it without touching any of the
above. When that lands, **use it** — it is the right level for a room. This
document stays the reference for what the options mean and what the sheet looks
like. Coordinate through the desk rather than duplicating it.
