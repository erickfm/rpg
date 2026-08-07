import * as THREE from 'three';
import { ORDER as HOOK, type CtxBuild } from './ctx';
import { pixTex, dither, declareSurface, slabTex } from './paint';
import { buildRoom } from './interior';
import { citizenSprite } from './citizens';
import { type DoorDecl } from './doors';
import { PASSABLE } from './gap';
// the hard-texel text painter, so a sign in here is as crisp as one on the
// street — same reason ct/int-hotel.ts imports it
import { hardLayer as hardLayerLib, LEAF_AJAR, doorRebate } from './vice';

// PUBLIC LIBRARY, inside.
//
// The user asked for ten interiors in one breath — *"i want to build out the
// insides of the following: burger barn. diner. library. tax service. pawn
// shop. bodega. thrift store. my room. the casino. the hotel."* — and this was
// the last one standing. Nine were built while mine sat in my own notes filed
// as "scope rather than a defect", which is a polite way of saying I kept
// finding smaller things to do. The doors have been shut since the courtyard
// landed.
//
// A 1997 municipal branch, and the character comes from the same place the
// exterior's does: it is CIVIC and it is UNDERFUNDED, and those pull against
// each other in every object.
//
//   · civic — the ceiling is 3.6 m where a shop is 2.9, because the building
//     is trying to be dignified. The kit's own note says a library wants more.
//   · underfunded — one of the four fluorescent troffers is out, the lino is
//     worn through on the walking line, and the card catalogue is still in
//     service in a year when it should not have been.
//
// The card catalogue is the object that dates the room. In 1997 a branch this
// size had a terminal on order and a hardwood cabinet of 60 drawers still
// carrying the collection, and the drawers are what people actually touched.
//
// The door is the reason this room needed its own `face`. Every other room in
// the kit sits behind a flat shopfront at x = ±FACE, so the kit derives the
// [E] spot 0.75 m out from that plane. The library does not: `ct/civic.ts`
// recesses it 3.2 m into a courtyard and puts a flight of steps in front, so
// its threshold is 0.99 m above the street and 3.2 m behind the building line.
// Measured along the door axis rather than assumed:
//
//   x -11.8 … -10.2   gy 0.99   the threshold platform
//   x -10.2 …  -8.4   ramp      the flight, 0.99 down to 0.14
//   x  -8.4 …          gy 0.14  the courtyard
//
// So the door point is declared ON the platform with its normal facing out
// across the courtyard, and the way back out lands at the foot of the steps —
// far enough clear of the way-in trigger that pressing E to leave cannot suck
// you straight back in, which the kit checks and has caught before.
const XF = -10.2;                       // the recessed facade plane, from civic.ts
const DOOR_Z = -13.0;                   // the library's axis, and the flight's

// WHAT THE DOOR IS, measured off the facade rather than remembered.
//
// The user: *"library entrance doesnt match exterior"*
// (`Screenshot from 2026-07-25 22-05-14.png`, taken from inside, facing out).
//
// He is right, and it is the exact fault `DoorLeaf` was invented for — one
// fact authored twice. `ct/civic.ts` paints the entrance at the back of the
// 1.8 m recess as a 40x48 texture across BAY_W 5.0 m by BAY_H 6.0 m, which is
// 8 px/m, so its texels convert straight to metres:
//
//   leaves      fillRect(10, 16, 20, 32)          2.50 m wide, 4.00 m tall
//   meeting     fillRect(19, 16,  2, 32)          a centre stile, so TWO leaves
//   push plates fillRect(16/22, 30, 2, 4)         brass, #c9a45e
//   fanlight    archFill(20, 22, 6, 16)           2.75 m wide, 4.00 -> 5.25 m
//   transom     fillRect( 9, 16, 22, 1)           STONE_D, under the fanlight
//   orders      archFill(20, 26, 4) / (20, 22, 6) 3.25 m and 2.75 m, round-headed
//   leaf colour #4a3a26 timber, in a #2a2118 reveal
//
// The interior had the kit's fallback: ONE 1.60 x 2.15 flush leaf with a
// vision panel and a rectangular head. Same doorway, two designs.
//
// So the room declares the leaf it actually has and the kit builds the opening
// from it. Nothing outside interiors reads `width` or `leaf` — checked:
// `doorLeafFor` has one caller (ct/interior.ts) and `declareDoorWorld` is
// handed the door's POSITION only — so this cannot move E's facade, which is
// as it should be. The authority runs room -> facade (GOTCHAS §45), and here
// the room is simply catching up with a facade that was already right.
export const DOOR: DoorDecl = {
  building: 'LIBRARY', w: 16, cz: -13, side: -1, at: 0, width: 2.5,
  leaf: {
    clearW: 2.5, h: 4.0, leaves: 2,
    frame: { colour: 0x4a3a26, material: 'timber' }, glazing: 'none',
  },
  face: { x: XF - 0.8, z: DOOR_Z, nx: 1, nz: 0 },
};

// The gallery's own numbers, above buildRoom because the floor function inside
// the spec closes over them. x 4.30 to the east wall, deck at 2.90, and the
// flight running from z 6.60 at the bottom up to z 2.00 at the top.
// The gallery hugs the east wall of a 20 m room. It was 4.30..7.30 in a 14.8 m
// one; taking the width moves it out with the wall rather than leaving it
// stranded mid-floor.
const GALLERY_X0 = 6.90, GALLERY_X1 = 9.90, GALLERY_Y = 2.90;
// The flight's foot is at STAIR_Z0. It once had to stand CLEAR of the vestibule
// pier, which spanned the room at z = D/2 - VEST_D = 6.80: at 6.60 the foot was
// 0.2 m from that pier — no room to stand and step onto it, so the stair was
// reachable only in theory. That was what "inaccessible because of walls" meant:
// not the balustrade, the porch built in front of it.
// THAT PIER IS GONE (the vestibule was deleted below, 2026-07-25), so 5.40 is no
// longer holding anything off. It stays because 5.40 is also what makes the run
// 4.80 m for 2.90 of rise; it is now a stair number rather than a clearance one.
//
// 5.40 leaves 1.4 m of floor to turn onto the bottom tread, and dropping the
// top to 0.60 keeps the run at 4.80 m for 2.90 of rise — 31 degrees, still a
// real stair.
const GALLERY_Z1 = 0.60, STAIR_Z0 = 5.40;

export function buildLibrary(ctx: CtxBuild): void {
  const room = buildRoom(ctx, {
    id: 'library',
    label: 'into the PUBLIC LIBRARY',
    // "Make the library interior larger and more ambitious. More halls and stair
    // ways." 11 m deep was one room; 22 m is a building you walk through.
    // WIDER THAN THE BUILDING, on the user's ruling: "you can make it wider than
    // it actually is outside too... no one is going to take a ruler and measure
    // the width of the inner and outer." The room took roomWidthFor(16) = 14.8
    // from its frontage; a gallery down one side of that leaves the floor below
    // it narrow, which is the shape complaint the auditor measured. 20 m gives
    // the stacks their runs AND the gallery its strip without either squeezing
    // the other.
    w: 20.0,
    d: 22.0,
    // 6.4, up from 3.6. The tall half of "small dark vestibule, then through into
    // a tall reading room" — that contrast IS the experience of a Carnegie
    // branch. It was first done with a dropped soffit over the entry; the user
    // rejected that (see the deleted vestibule below), so the contrast is now
    // carried by the DOORWAY — a 4 m opening in a deep reveal under a 6.4 m
    // ceiling — which is where a real branch gets it anyway.
    h: 6.4,
    palette: {
      floor: 0x6f7a63,      // green-grey lino, the municipal default
      wall: 0xc9c0a8,       // cream distemper
      ceil: 0xcdc8bb,
      trim: 0x5a4632,       // dark stained oak
    },
    // ── THE LEVEL CHANGE, which is the whole point of the item ────────────
    //
    // "A STAIR to a gallery running round the reading room with a balustrade you
    // look down from", and the desk: "a level change is what makes an interior
    // read as a building rather than a room."
    //
    // bd3ee7d7a gave the spec this field. Function form rather than the level
    // list because a flight is a ramp, not a stack of boxes: the picker walks
    // you smoothly up it and the drawn treads ride within half a riser, which is
    // what ct/apartment.ts and the civic steps both do. null means "not mine",
    // so the rest of the room stays flat without being enumerated.
    //
    // 2.90 m of rise over a 4.60 m run is 32°, a real stair, and the deck clears
    // the 1.95 m bays under it by nearly a metre.
    // ══ AND YOU CAN WALK UNDER IT NOW ════════════════════════════════════
    //
    // *"i cant currently walk under the balcony"* (2026-08-05), and then
    // *"make interiors level aware"*.
    //
    // He was right and the cause was this function. It used to answer
    // `GALLERY_Y` for EVERY point in the gallery's x band with `lz <=
    // GALLERY_Z1` — which is the deck AND the whole 3.0 x 11.6 m of room
    // underneath it. There was no ground floor under the balcony at all: the
    // balcony WAS the floor, and 34.8 m² of a 440 m² room could only ever be
    // stood on top of. Headroom was never the problem — the soffit is at 2.64 m
    // and the edge beam at 2.45, which is a metre of air over a 1.62 m eye.
    //
    // The kit could not express it: `RoomSpec.floor` was one number per point.
    // It now takes an ARRAY of candidate surfaces and picks between them with
    // hysteresis against the level the player is on, so this says the true
    // thing — under the deck there are two floors, and which one you are on
    // depends on whether you took the stair.
    //
    // THE RAMP STAYS SINGLE-VALUED, and that is what makes the transition work
    // in both directions. Walking up, it commits a height that climbs smoothly
    // to 2.90 by the time you reach z GALLERY_Z1, so the first two-candidate
    // cell you meet finds 2.90 within reach and keeps you on the deck. Walking
    // down, the same in reverse. There is nowhere on the stair the memory can
    // be anything but the stair.
    floor: (lx, lz) => {
      if (lx < GALLERY_X0 || lx > GALLERY_X1) return null;
      if (lz <= GALLERY_Z1) return [0, GALLERY_Y];        // the deck, and the room under it
      if (lz <= STAIR_Z0) return GALLERY_Y * (STAIR_Z0 - lz) / (STAIR_Z0 - GALLERY_Z1);
      return null;
    },
    frontage: { name: 'LIBRARY', w: 16, cz: -13, side: -1 },
    door: {
      // 1.6, not the kit's 1.05. Every other room's trigger sits on an open
      // pavement where you stop AT the facade; this one is at the back of a
      // 1.6 m doorway reveal at the top of a flight, and walking up the steps
      // carries you to x -11.61 — 1.36 m past a 1.05 m trigger centred on
      // -10.25. The prompt appeared as you passed through it and was gone by
      // the time you came to rest, so pressing E at the doors did nothing at
      // all. Measured, after it did exactly that to me. 1.6 covers the whole
      // platform from the top nosing to the back of the reveal, and still
      // leaves the way-out landing 2.35 m clear of it.
      r: 1.6, at: DOOR.at, width: DOOR.width,
      // the foot of the flight, in the courtyard, facing back out of it
      outX: -7.9, outZ: DOOR_Z, outYaw: Math.PI / 2, outGy: 0.14,
    },
    // Four trays on the ceiling and ONE OF THEM IS OUT. A room where every
    // light works is a room with a facilities budget.
    light: { kind: 'troffer', tint: 0xfdf6e2, count: 4, dead: [2] },
  });

  const { put, solid, solidAt, W, D } = room;
  const rnd = (() => { let s = 0x1b7a33; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); })();
  const wood = new THREE.MeshBasicMaterial({ color: 0x6b5334 });
  const woodDark = new THREE.MeshBasicMaterial({ color: 0x4a3826 });
  const metal = new THREE.MeshBasicMaterial({ color: 0x6e6f6a });

  /** a box, in local coordinates, sized in metres */
  // `m` takes an ARRAY as well as a single material, which is what
  // `THREE.Mesh` has always accepted — `boxFace` below already had to build its
  // own `new THREE.Mesh` purely because this signature refused one. A bay end
  // needs grain on TWO opposite faces (item 273), which is one face more than
  // `boxFace` can express and no reason at all for a third helper.
  const box = (w: number, h: number, d: number, m: THREE.Material | THREE.Material[],
    lx: number, y: number, lz: number) =>
    put(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), lx, y, lz);

  // ── EVERY CHAIR IN THIS ROOM IS ONE NUMBER: THE TOP OF ITS PAN ──
  //
  // Routed to me inside G's evidence cell for "guy sitting in casino is
  // clipping through his seat", which swept all ten rooms and found mine still
  // wrong: *"library 3 STILL WRONG — ct/int-library.ts, builder J: registered
  // 0.45 against a true top of 0.475, sunk 2.5 cm … a one-constant fix at J's
  // end; not H's pose."* G is right and the diagnosis is exactly theirs, one
  // room over: ONE STOOL HEIGHT AUTHORED TWICE.
  //
  // My pan is 0.05 thick CENTRED at 0.45, so it spans 0.425..0.475 and its top
  // face is 0.475 — while `ctx.seat({ h })` and the sitter both took 0.45, the
  // pan's CENTRE. A figure placed correctly on a seat that under-reports itself
  // by half a pan sinks by half a pan. My own commit for the sitters said "0.45
  // is passed because it is the seat pan these chairs are built with", which is
  // the error in one sentence: it is the pan's centre, not the pan's top.
  //
  // NO Y FUDGE, per H's rule in notes/H-seated-sprite.md — the atlas is right
  // and a fudge would mean the atlas is wrong. Instead the TOP FACE is declared
  // once and the pan is derived DOWNWARD from it, so the mesh, `ctx.seat()` and
  // every sitter read one number, and the pan can change thickness without the
  // seat height silently moving.
  const SEAT_TOP = 0.475, PAN_T = 0.05;
  const PAN_Y = SEAT_TOP - PAN_T / 2;          // where the pan's CENTRE goes

  // ── GRAIN ON THE BIG FLAT FACES ──────────────────────────────────────────
  //
  // The queue's last row: *"any large blank surface left in the room takes A's
  // `slabTex` — it keeps your colour (measured drift 1-4) and gives edge
  // density."* A's own account of why is the part worth carrying:
  //
  //   *"the fault was never the colour — it was that a colour alone has no
  //   grain and no joint, so nothing gives it scale."*
  //
  // ONE FACE AT A TIME, sized from THAT FACE'S METRES. A `BoxGeometry`'s six
  // faces each span the full 0..1 of the map, so handing a single texture to
  // the whole box stretches a 3 m top and a 0.16 m edge over the same canvas —
  // GOTCHAS §5, the asphalt that came out 21 m by 0.33 m. So the face index is
  // given explicitly and the painter is told the real metres of that face.
  //
  // `joint: 0` throughout: these are TIMBER, not paving, and A's note is
  // specific that joints-off is what a surface wants when it should read as
  // scale rather than as slabs.
  const FACE_PY = 2, FACE_NY = 3, FACE_PZ = 4;
  const grained = (w: number, d: number, base: string) =>
    new THREE.MeshBasicMaterial({
      map: slabTex({ wMeters: w, dMeters: d, base, joint: 0, grain: 0.11, kind: 'detail' }),
    });
  /** a box whose one named face carries grain and whose others keep `m` */
  const boxFace = (w: number, h: number, d: number, m: THREE.Material,
    lx: number, y: number, lz: number,
    face: number, fw: number, fd: number, base: string) => {
    const mats: THREE.Material[] = [m, m, m, m, m, m];
    mats[face] = grained(fw, fd, base);
    return put(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats), lx, y, lz);
  };

  // ── BOOKS ────────────────────────────────────────────────────────────────
  //
  // Painted, not modelled. A shelf of individual spine boxes is thousands of
  // meshes for a wall of colour you read at 8 px/m, and A's density mandate is
  // about texel density rather than geometry: the spines have to be the right
  // WIDTH in metres, which a texture sized from real metres gives for free.
  const SPINE = ['#7a3b30', '#3f5470', '#6a6234', '#4a3f5c', '#8a6a34',
    '#35564a', '#7d5a3c', '#2f3f52', '#6d3550'];
  const shelfTex = (wM: number, hM: number, seed: number) => {
    const r = (() => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); })();
    // 32 px/m, not the street's 8 and not 16. A shelf is read from under a
    // metre away and a book spine is 2–5 cm wide: at 16 px/m one texel is
    // 6.25 cm, so the narrowest book the texture could draw was already wider
    // than a real one and most came out 12–19 cm. They looked like ledgers.
    // At 32 px/m a texel is 3.1 cm and a 1–2 texel spine is 3–6 cm, which is a
    // paperback and a hardback.
    const PPM = 32, Wp = Math.max(8, Math.round(wM * PPM)), Hp = Math.max(8, Math.round(hM * PPM));
    return declareSurface(pixTex(Wp, Hp, (g) => {
      g.fillStyle = '#241a12'; g.fillRect(0, 0, Wp, Hp);      // the dark of the shelf
      let x = 1;
      while (x < Wp - 1) {
        const w = 1 + Math.floor(r() * 2);                    // 1–2 texels: 3–6 cm
        const lean = r() < 0.06 ? 4 : 0;                       // the odd book fallen over
        const top = 2 + lean + Math.floor(r() * 3);             // uneven heights
        g.fillStyle = SPINE[Math.floor(r() * SPINE.length)];
        g.fillRect(x, top, w, Hp - top - 1);
        if (r() < 0.35) {                                     // the Dewey label
          g.fillStyle = 'rgba(226,220,200,0.55)';
          g.fillRect(x, Hp - 6, w, 2);
        }
        x += w + (r() < 0.10 ? 3 : 0);                        // gaps where books are out
      }
      dither(g, Wp, Hp, Math.round(wM * hM * 10));
    }), 'detail');
  };

  // ── THE STACKS ───────────────────────────────────────────────────────────
  //
  // Runs perpendicular to the front wall so you look ALONG them from the door
  // — a library reads as a library because of the corridors between the bays,
  // not because of the books themselves. Stopped well short of the front so
  // the desk and the catalogue have the room, and short of the back wall so
  // the aisle returns.
  const BAY_H = 1.95, BAY_D = 0.52;

  // ══ THE END PANELS — *"some bookshelves are flat?"* (item 273) ═══════════
  //
  // MEASURED FIRST, because the row's stated cause is wrong and it matters
  // which. The row points at ct/int-library.ts:302-308, the ±π/2 book-plane
  // rotation this file has been bitten by once already. **Every book plane in
  // this room is oriented correctly** — `scripts/probes/w107-library-blank.mjs`
  // reads all of them and the only planes whose normal runs along z are the
  // BACK-WALL run's, which is where its books belong. Not one is on the end of
  // a bay pointing down an aisle. That bug is fixed and stayed fixed.
  //
  // WHAT HE IS ACTUALLY LOOKING AT is the bay END: `BoxGeometry(0.52, 1.95,
  // 0.06)` in flat `wood`, **1.01 m² of untextured colour**, standing square
  // across the mouth of every aisle. The census finds **twenty** of them,
  // 20.2 m² in total, and they are the largest blank thing in the room after
  // the gallery deck.
  //
  // AND ITEM 115 DOUBLED THEM HOURS AGO. It cut a 1.70 m cross aisle through
  // the stacks — the right fix, and its own measurements hold — but splitting
  // five runs into ten stacks turns 10 end panels into 20, and puts ten of them
  // square across the new route. `shots/w107-lib-before-cross.png` is that: two
  // slabs of flat brown filling the frame down a corridor built to be walked.
  //
  // THE FIX IS NOT DEPTH AND NOT A BOX. The row is explicit and so is the
  // previous author: the books are planes on purpose and stay planes. What is
  // wrong is that a face nothing painted was left to be read as a face. Two
  // things, both of which this file already owns the tools for:
  //
  //   · GRAIN, from A's `slabTex`, on the two big faces — the room's own note
  //     at :218 says *"any large blank surface left in the room takes A's
  //     slabTex"* and the end panels are the surfaces it was written about.
  //     One material, shared: every end panel in the room is the same
  //     0.52 × 1.95 m face, so 40 faces need one texture, not forty.
  //   · A RANGE PLATE. Grain alone makes it a nicer blank panel. A stack end
  //     in a real branch library carries the Dewey band it holds, and that is
  //     what makes the object read as *the end of the 800s* rather than as a
  //     board — and it tells the player which way to walk, which is the whole
  //     point of the cross aisle item 115 cut.
  //
  // Nothing here touches an aisle. STACK_PITCH, AISLE and CROSS are unchanged,
  // the panel is the same 0.06 m board it was, and the plate stands 8 mm proud
  // of it — 1.55 m stays 1.55 m, as item 115's note requires.
  const END_T = 0.06;
  const endGrain = grained(BAY_D, BAY_H, '#6b5334');
  /** face order is [+x, −x, +y, −y, +z, −z]; a ±z face of a (w, h, d) box
   *  presents (w, h) = (0.52, 1.95), which is what `endGrain` was cut for. */
  const endMatsZ: THREE.Material[] = [wood, wood, wood, wood, endGrain, endGrain];
  /** …and a ±x face of a (d, h, w) box presents the same two metres. */
  const endMatsX: THREE.Material[] = [endGrain, endGrain, wood, wood, wood, wood];

  // The plate: a cream card in a dark holder, 0.36 × 0.22 m on a 54 × 33 canvas
  // — exactly 150 px/m on BOTH axes, derived from the metres rather than
  // accepted from a default (§7b). It is denser than the room's 32 px/m walls
  // on purpose and for the same reason `shelfTex` is: this is read from a metre
  // away, and a Dewey band nobody can spell is not a sign.
  const PLATE_W = 0.36, PLATE_H = 0.22, PLATE_PPM = 150;
  const plateTex = (band: string, name: string) => {
    const Wp = Math.round(PLATE_W * PLATE_PPM), Hp = Math.round(PLATE_H * PLATE_PPM);
    return declareSurface(pixTex(Wp, Hp, (g) => {
      g.fillStyle = '#3a352c'; g.fillRect(0, 0, Wp, Hp);              // the holder
      g.fillStyle = '#ded8c4'; g.fillRect(2, 2, Wp - 4, Hp - 4);      // the card
      g.fillStyle = '#c9c2ac'; g.fillRect(2, Hp - 5, Wp - 4, 3);      // a shadow in the holder
      hardLayerLib(g, '#2b2a26', (h) => {
        h.fillStyle = '#2b2a26';
        h.textAlign = 'center'; h.textBaseline = 'middle';
        h.font = 'bold 13px monospace'; h.fillText(band, Wp / 2, 12);
        h.font = 'bold 8px monospace'; h.fillText(name, Wp / 2, 25);
      });
      dither(g, Wp, Hp, 24);
    }), 'sign');
  };

  const stack = (lx: number, lz0: number, lz1: number, seed: number,
    band: string, name: string) => {
    const len = lz1 - lz0, cz = (lz0 + lz1) / 2;
    box(BAY_D, 0.1, len, woodDark, lx, 0.05, cz);                       // the kick
    // THE TWO ENDS, and their plates. `out` is which way this end looks, so the
    // plate's rotation is derived from it rather than written twice — GOTCHAS
    // §41: a mirrored pair is where the bug hides, and `ctx.flat` is not
    // double-sided, so getting it wrong here leaves an INVISIBLE plate rather
    // than a backwards one, which is worse to spot.
    for (const [lz, out] of [[lz0, -1], [lz1, 1]] as [number, number][]) {
      put(new THREE.Mesh(new THREE.BoxGeometry(BAY_D, BAY_H, END_T), endMatsZ),
        lx, BAY_H / 2, lz);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(PLATE_W, PLATE_H),
        ctx.flat(plateTex(band, name)));
      plate.rotation.y = out > 0 ? 0 : Math.PI;
      plate.userData.stackPlate = band;
      // 1.50 m: above the top shelf's books (1.76 is their top edge, 1.56 the
      // board) would put it on the crown; a real end-panel holder sits at the
      // height you read standing, and this is it.
      put(plate, lx, 1.50, lz + out * (END_T / 2 + 0.008));
    }
    box(0.06, BAY_H, len, wood, lx, BAY_H / 2, cz);                     // the spine board
    for (let i = 0; i < 4; i++) {                                       // four shelves a side
      // 0.42 apart, not 0.45: at 0.45 the top shelf's books stood at 2.05 m
      // against a 1.95 m bay and floated over the top of their own case.
      const y = 0.30 + i * 0.42;
      box(BAY_D, 0.04, len, wood, lx, y, cz);
      for (const s of [-1, 1]) {                                        // books, both faces
        const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.36),
          new THREE.MeshBasicMaterial({ map: shelfTex(len, 0.36, seed + i * 7 + (s > 0 ? 3 : 0)) }));
        // ±π/2, not 0/π. A PlaneGeometry faces +z, so a book plane left at
        // rotation 0 hangs on the END of the bay pointing down the aisle: the
        // shelves piled up as a wall of spines straight ahead while the sides
        // of every stack — the faces you actually walk between — were blank
        // brown board. R_y(π/2) turns +z to +x, which is the face the books
        // are on.
        m.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
        put(m, lx + s * (BAY_D / 2 - 0.02), y + 0.20, cz);
      }
    }
    solid(lx, cz, BAY_D + 0.08, len);
  };
  // Six runs, not four, and they start behind the desk rather than behind the
  // door: 13.9 m of shelving down a 22 m room. The 2.15 m spacing is unchanged
  // and it is the number that matters — 1.63 m of aisle between 1.95 m bays is
  // "too narrow to see over" for a 1.6 m eye, which is what makes the stacks
  // read as stacks rather than as shelving against a wall.
  // THE STACKS STOP AT z -2.0 AND THE ROOM BREATHES AGAIN.
  //
  // The auditor, on this room at build 4a311be0a: it did double, 163 -> 326 m²,
  // but its median clear aisle fell from 8.40 m to 2.10 m — the NARROWEST of all
  // ten interiors, tighter than the bodega's 3.85 m which that audit ranked
  // severity 1. Free floor was a normal 81%, so the space was not consumed: it
  // was cut into strips. Six runs spanning the full 13.9 m of new depth meant
  // that at nearly every depth in the room, the widest continuous thing you
  // could stand in was one 1.63 m aisle.
  //
  // "Cramped is a statement about shape, not area" is the finding, and it is
  // right. So the stacks take the REAR half only and the front half is one
  // continuous reading floor — which is also what a Carnegie branch actually is:
  // you come in through the doors into an open hall with tables in it, and the
  // stacks are behind and around. Same six runs, same 2.15 m spacing, same
  // 1.63 m aisles between 1.95 m bays; they are simply 7.7 m long instead of
  // 13.9, and the 13 m of depth in front of them is now unbroken wall to wall.
  const zBack = -D / 2 + 1.3, zFront = -2.0;
  // FIVE runs, not six: the sixth stood at x 5.75 and the gallery needs the east
  // strip from 4.3 to the wall. A run of shelving is worth less than a level
  // change — the user named the stair and did not name a sixth bay.
  //
  // ── AND A CROSS AISLE THROUGH THEM, 2026-08-03 (item 115) ────────────────
  //
  // *"library is crowded in some areas and spacious in others."* Measured, the
  // stack block is the crowded half: five parallel runs, 7.7 m long, with the
  // only way between them at the ends. Every aisle is 1.55 m and PASSABLE is
  // 0.95, so nothing here is a trap and nothing wants widening — the room has
  // already had one spacing pass and four trap-gap fixes, and the note above
  // records what happened when the runs were long: median clear aisle 2.10 m,
  // the narrowest of all ten interiors, because the floor had been cut into
  // strips. Widening again would undo the fix that shortened them.
  //
  // What is actually wrong is that the block has no way THROUGH it. Standing at
  // the hall end you must commit to a 7.7 m walk down a 1.55 m slot and come
  // back the same way, because the runs are unbroken from the back wall to the
  // reading floor. Real stack ranges are broken by a cross aisle for exactly
  // this reason, and it costs 5 x 1.7 m of shelving to buy a second route
  // through the densest part of the room.
  //
  // The pitch is UNCHANGED and derived rather than retyped, so the aisles it
  // sets cannot drift: the cross aisle is one notch wider than the aisles it
  // joins, so the route across is never the tightest thing in the block.
  const STACK_PITCH = 2.15;
  const AISLE = STACK_PITCH - (BAY_D + 0.08);   // 1.55 m, collider face to collider face
  const CROSS = AISLE + 0.15;                   // 1.70 m — wider than what it joins
  const zMid = (zBack + zFront) / 2;
  // WHAT IS ON EACH STACK, so the end plates say something true. The Dewey
  // hundreds, ten bands over ten stacks, ascending west to east and — within a
  // run — from the half you meet first walking in from the hall to the half
  // behind the cross aisle. That is how a branch actually numbers its ranges,
  // and it means the plates are a route as well as a label: the cross aisle
  // item 115 cut is now something you can navigate BY rather than merely walk
  // through. Ten entries for ten stacks; the loop indexes them, so a sixth run
  // would fail to compile rather than silently repeat the 800s.
  const DEWEY: [string, string][] = [
    ['000-099', 'GENERAL'],    ['100-199', 'PHILOSOPHY'],
    ['200-299', 'RELIGION'],   ['300-399', 'SOCIAL SCI'],
    ['400-499', 'LANGUAGE'],   ['500-599', 'SCIENCE'],
    ['600-699', 'TECHNOLOGY'], ['700-799', 'THE ARTS'],
    ['800-899', 'LITERATURE'], ['900-999', 'HISTORY'],
  ];
  for (let i = 0; i < 5; i++) {
    const lx = -W / 2 + 2.4 + i * STACK_PITCH;
    const [frontBand, frontName] = DEWEY[i * 2];
    const [backBand, backName] = DEWEY[i * 2 + 1];
    // zFront is the hall end, zBack the back wall — so the FRONT half takes the
    // lower band of the pair.
    stack(lx, zBack, zMid - CROSS / 2, 0x2a01 + i * 131, backBand, backName);
    stack(lx, zMid + CROSS / 2, zFront, 0x2b07 + i * 131, frontBand, frontName);
  }

  // ── SHELVING AGAINST A WALL, one face of books ───────────────────────────
  //
  // The free-standing `stack` above is a double-sided bay you walk between.
  // This is the other kind, and a Carnegie hall has both: a run fixed to a
  // wall, books facing the room, no aisle behind it. It costs no floor at all,
  // which is the whole reason it is the first thing to reach for when a room
  // measures thin — see the density note at the foot of this file.
  //
  // `along` is the axis the run extends on and `face` is which way the books
  // look on the other one. Both are given rather than derived because the two
  // callers below sit on walls at right angles to each other, and a run that
  // guesses its own facing is GOTCHAS §33 waiting to happen.
  const wallRun = (lx: number, lz: number, len: number,
    along: 'x' | 'z', face: -1 | 1, seed: number, base = 0,
    /** what is ON the shelves — spines by default, covers for periodicals */
    tex: (wM: number, hM: number, seed: number) => THREE.Texture = shelfTex) => {
    const ax = along === 'x';
    const size = (u: number, v: number) => (ax ? [u, v] : [v, u]) as [number, number];
    const at = (u: number, v: number) => (ax ? [lx + u, lz + v] : [lx + v, lz + u]) as [number, number];
    const [kw, kd] = size(len, BAY_D);
    const [k0, k1] = at(0, 0);
    box(kw, 0.1, kd, woodDark, k0, base + 0.05, k1);                   // the kick
    for (const e of [-len / 2, len / 2]) {                             // the ends
      const [ew, ed] = size(0.06, BAY_D);
      const [e0, e1] = at(e, 0);
      // The same 0.52 × 1.95 blank face as the free-standing stacks' ends, and
      // it takes the same shared grain. WHICH FACE PAIR depends on the run's
      // axis: a run along x is a (0.06, 1.95, 0.52) box whose big faces are ±x;
      // along z it is (0.52, 1.95, 0.06) and they are ±z. Both present the same
      // two metres, which is why one texture serves. No range plate here — a
      // wall run is not a range you walk into, and a sign on one would be a
      // label on a wall rather than a way through a block.
      box(ew, BAY_H, ed, ax ? endMatsX : endMatsZ, e0, base + BAY_H / 2, e1);
    }
    const [bw, bd] = size(len, 0.06);                                  // the back board
    const [b0, b1] = at(0, -face * (BAY_D / 2 - 0.03));
    box(bw, BAY_H, bd, wood, b0, base + BAY_H / 2, b1);
    for (let i = 0; i < 4; i++) {
      const y = base + 0.30 + i * 0.42;
      const [sw, sd] = size(len, BAY_D);
      const [s0, s1] = at(0, 0);
      box(sw, 0.04, sd, wood, s0, y, s1);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.36),
        new THREE.MeshBasicMaterial({ map: tex(len, 0.36, seed + i * 11) }));
      // a PlaneGeometry faces +z. For a run extending along x the books look
      // along ±z, which is rotation 0 or PI; along z they look along ±x, which
      // is ±PI/2. Written as the four cases rather than one clever expression,
      // because this is exactly the arithmetic §33 keeps catching.
      m.rotation.y = ax ? (face > 0 ? 0 : Math.PI) : (face > 0 ? Math.PI / 2 : -Math.PI / 2);
      const [p0, p1] = at(0, face * (BAY_D / 2 - 0.02));
      put(m, p0, y + 0.20, p1);
    }
    // A RUN ON THE GALLERY IS FENCED TO THE GALLERY. `base` is the level it
    // stands on, so a run at 2.90 registers a collider that only exists while
    // the player is up there — it used to be a floor-to-ceiling wall standing
    // in the middle of the ground floor under the deck. The two callers at
    // base 0 are unchanged: `solidAt` and `solid` build the same box, and one
    // of them is simply never parked.
    const fence = base > 0.001
      ? (lx2: number, lz2: number, w2: number, d2: number) => solidAt(base, lx2, lz2, w2, d2)
      : solid;
    fence(lx, lz, ...(ax ? [len + 0.08, BAY_D + 0.08] : [BAY_D + 0.08, len + 0.08]) as [number, number]);
  };

  // THE BACK WALL'S EAST BAY. The five free-standing runs above occupy x -7.6
  // to 1.0 and stop 1.3 m short of the back wall, which is not enough to walk
  // behind them — so shelving goes where the stacks are NOT, on the clear span
  // east of them. Measured against the gallery's own constant rather than
  // typed: the deck's west edge is GALLERY_X0, so the run stops 0.3 m short.
  wallRun((2.2 + (GALLERY_X0 - 0.3)) / 2, -D / 2 + BAY_D / 2 + 0.06,
    (GALLERY_X0 - 0.3) - 2.2, 'x', 1, 0x71a3);

  // ── THE REFERENCE BAY — GIVING THE BACK-EAST QUARTER A REASON ────────────
  //
  // *"library layout needs a reorg. try to find a better way to use the space
  // to organize all the stuff in it."*
  //
  // The measured dead area. The five free-standing runs stop at x 1.0 and the
  // gallery's posts stand at 6.86, so x 1.30..6.86 by z -11..-2 — **50 m², an
  // eighth of the room** — held the wall run above and nothing else. It was not
  // a route to anywhere either: the stacks are entered from their own ends and
  // the gallery from the far side, so a player had no reason to walk into it
  // and, walking in by accident, found a back wall.
  //
  // It has BOTH now. It is the way to the computer bay under the deck, which is
  // traffic, and it is a room in its own right — the reference end, which is
  // what a branch does with the floor behind its stacks: the oversize atlases,
  // a table to open them on, and the shelving that is already on that wall.
  //
  // NOT CLOSED OFF. The other honest answer was a wall, and a wall here would
  // seal the only way to the bay under the balcony from the north.
  //
  // Clearances, collider face to collider face:
  //   the last stack run   x 1.30   the table's collider     2.40   1.10 m
  //   the deck posts       x 6.86   the table's collider     4.40   2.46 m
  //   the wall run         z -10.42 the plan chest           -9.05  1.37 m
  //   the plan chest       z -7.95  the table                -5.20  2.75 m
  //   the table            z -4.00  the globe                -2.83  1.17 m
  {
    const REF_X = 3.4;
    // the table: 1.8 x 1.0, chairs on its two long sides. Four seats, all
    // registered — the room's standing rule is *"for every seat in the game i
    // want to be able to sit down"*.
    const RF_Z = -4.6, RF_W = 1.8, RF_D = 1.0;
    boxFace(RF_W, 0.07, RF_D, wood, REF_X, 0.74, RF_Z, FACE_PY, RF_W, RF_D, '#6b5334');
    for (const dx of [-RF_W / 2 + 0.16, RF_W / 2 - 0.16]) {
      for (const dz of [-RF_D / 2 + 0.14, RF_D / 2 - 0.14]) {
        box(0.09, 0.74, 0.09, woodDark, REF_X + dx, 0.37, RF_Z + dz);
      }
    }
    solid(REF_X, RF_Z, RF_W + 0.2, RF_D + 0.2);
    for (const side of [-1, 1] as const) {
      for (const dx of [-0.55, 0.55]) {
        const cx = REF_X + dx, cz = RF_Z + side * 0.90;
        box(0.44, PAN_T, 0.44, wood, cx, PAN_Y, cz);
        box(0.44, 0.5, 0.05, wood, cx, 0.70, cz + side * 0.20);
        for (const fx of [-0.18, 0.18]) for (const fz of [-0.18, 0.18]) {
          box(0.05, 0.45, 0.05, woodDark, cx + fx, 0.225, cz + fz);
        }
        ctx.seat({
          // the CAMERA convention, as everywhere in this file: a chair on the
          // -z side of the table faces +z, which is yaw PI. Derived from the
          // side, so the two sides cannot disagree (GOTCHAS §33).
          x: room.wx(cx), z: room.wz(cz), yaw: side < 0 ? Math.PI : 0, h: SEAT_TOP,
          approach: { x: room.wx(cx), z: room.wz(cz + side * 0.85) },
          label: 'sit at the reference table',
          ok: () => room.inside(),
        });
      }
    }
    // THE PLAN CHEST, and it is the object that says "reference" rather than
    // "another table". Oversize atlases and the borough's own sheets live flat
    // in a chest of shallow drawers, which is why one is always standing in
    // this corner of a branch — and it is 0.85 m tall, so it does not stand in
    // the sightline from the hall the way a case would.
    const PC_Z = -8.5, PC_W = 1.6, PC_D = 0.9, PC_H = 0.85;
    boxFace(PC_W, PC_H, PC_D, woodDark, REF_X, PC_H / 2, PC_Z,
      FACE_PZ, PC_W, PC_H, '#4a3826');
    box(PC_W + 0.06, 0.06, PC_D + 0.06, wood, REF_X, PC_H + 0.03, PC_Z);   // its top slab
    // five shallow drawers, each with a brass pull, drawn as members rather
    // than painted: a plan chest read from 2 m is its drawer lines
    // …each one 5 mm INTO the carcass and its pull 5 mm into the drawer, so no
    // pair of faces is flush (GOTCHAS §6). A drawer front laid exactly on the
    // face it sits in is the z-fight this file has already paid for twice.
    const brassPull = new THREE.MeshBasicMaterial({ color: 0xc9a45e });
    for (let i = 0; i < 5; i++) {
      const y = 0.10 + i * 0.145;
      box(PC_W - 0.06, 0.10, 0.03, wood, REF_X, y, PC_Z + PC_D / 2 + 0.010);
      box(0.16, 0.03, 0.03, brassPull, REF_X, y, PC_Z + PC_D / 2 + 0.035);
    }
    solid(REF_X, PC_Z, PC_W + 0.1, PC_D + 0.1);
    // an atlas left open on top of it — the boards under the leaves, each layer
    // overlapping the one below by 5 mm rather than resting on it
    box(0.66, 0.02, 0.48, woodDark, REF_X, PC_H + 0.045, PC_Z);
    box(0.62, 0.03, 0.44, new THREE.MeshBasicMaterial({ color: 0xd8d2be }),
      REF_X, PC_H + 0.065, PC_Z);
    // AND THE BAY IS NAMED. A zone a player cannot name is a zone they walk
    // through; the stack ends carry their Dewey bands for exactly this reason,
    // and this is the same argument one scale up. Over the wall run, clear of
    // the STAFF ONLY door at x 3.6.
    const refSignT = declareSurface(pixTex(48, 12, (g) => {
      g.fillStyle = '#4a4638'; g.fillRect(0, 0, 48, 12);
      hardLayerLib(g, '#d8d2c0', (h) => {
        h.fillStyle = '#d8d2c0'; h.font = 'bold 7px monospace';
        h.textAlign = 'center'; h.textBaseline = 'middle';
        h.fillText('REFERENCE', 24, 6);
      });
    }), 'sign');
    put(new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.30), ctx.flat(refSignT)),
      5.4, 2.50, -D / 2 + 0.08);
  }

  // ── THE VESTIBULE — REMOVED, 2026-07-25 ──────────────────────────────────
  //
  // The user, on `Screenshot from 2026-07-25 22-05-35.png`, standing in the
  // middle of the reading room and looking back at the entrance:
  //
  //   *"get rid of this weird internal structure inside the library"*
  //
  // It was a dropped soffit 2.6 m over the first 4.2 m of the room, with a
  // 5.6 m opening in it and a stone pier either side, meant as the low dark
  // vestibule you come through into the tall bright hall. From INSIDE the
  // vestibule it worked; the screenshot the user sent is from the other side,
  // and from there it is what he called it — a flat untextured 2.6 m wall
  // spanning all 20 m of the room with a rectangular hole in it, standing in
  // front of the front wall for no reason a player can see. GOTCHAS §41's
  // rule, from the other end: a thing built to be looked THROUGH was only ever
  // checked from the side you look through it from.
  //
  // Deleted rather than redrawn. GOTCHAS §46 says a complaint about execution
  // is not a verdict on the thing — but "this weird internal structure" is not
  // a defect list, it is a man who does not recognise the object at all, and
  // that is a verdict. Two things follow from the deletion and neither is a
  // loss:
  //
  //   · The low-to-tall contrast now comes from the DOORWAY instead, which is
  //     where a Carnegie branch actually gets it: a 4 m arched opening in a
  //     0.9 m thick reveal, below a 6.4 m ceiling. See the entrance below.
  //   · The 2.6 m soffit was also the reason the hall's own height was
  //     invisible from the door. It is not any more.
  //
  // The piers carried colliders across the room at z = 6.80. Those go with
  // them, which widens the way in from 5.6 m to the full 20.

  // ── THE ENTRANCE, FROM THE INSIDE ────────────────────────────────────────
  //
  // *"library entrance doesnt match exterior"*, and the numbers it has to match
  // are read off `ct/civic.ts` at the top of this file, not chosen to look
  // similar. The DECLARATION above gives the kit the 2.50 x 4.00 opening; this
  // block gives that opening the doorcase, the fanlight and the two leaves the
  // facade has, on the side you see them from.
  //
  // Everything here is in THIS file because `ct/interior.ts` is F's and the kit
  // hangs one flush leaf with a vision panel regardless of what the declaration
  // says — `leaves` and `glazing` are declared and not yet consumed. Same
  // position `ct/int-casino.ts` was in and the same shape of answer: hide the
  // kit's leaf, draw the building's own, and say out loud that this deletes
  // itself the day the kit grows the feature.
  {
    const LEAF_J = DOOR.leaf!;
    const DW = LEAF_J.clearW, DH = Math.min(LEAF_J.h, room.H - 0.2);
    const hd = D / 2, T = 0.18;                 // the kit's front wall: hd .. hd+T

    // The kit hangs ONE leaf, propped open, 32x64 texels, and it is half of
    // what the user is objecting to. Hidden rather than edited — and ASSERTED,
    // because silently missing it leaves the flush door standing in the middle
    // of the new one, which is worse than the fault. Lifted from
    // ct/int-casino.ts, which has been doing this since the casino's own
    // door/facade disagreement.
    {
      const hits: THREE.Mesh[] = [];
      room.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || m.geometry?.type !== 'PlaneGeometry') return;
        const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshBasicMaterial;
        const img = mat?.map?.image as HTMLCanvasElement | undefined;
        if (img && img.width === 32 && img.height === 64) hits.push(m);
      });
      if (hits.length === 1) hits[0].visible = false;
      else console.warn(`[interior:library] expected 1 kit door leaf to hide, found ${hits.length}`
        + ' — the library now has both the kit door and its own. ct/interior.ts changed shape.');
    }

    // ── the stone, borrowed by VALUE from ct/civic.ts ──
    //
    // E's `ashlar`, `archFill` and `archHW` are private to that file and it is
    // read-never-edit for me, so the three of them are re-stated here. What is
    // shared is the DATA — the colours and the bond — because two doorcases
    // that are meant to be one doorway must not drift on tone. If the kit ever
    // grows a stone painter these go.
    const STONE = '#a89e88', STONE_D = '#8a806c', STONE_L = '#c2b8a0';
    const GLASS = '#8a97a2', TIMBER = '#4a3a26', BRASS = '#c9a45e';
    // 16 px/m, where the facade paints the same doorway at 8.
    //
    // The METRES are identical — that is what "match the exterior" means and it
    // is asserted below. What differs is the grain, for the reason the shelf
    // texture in this file is at 32 while the street is at 8: the facade is
    // read from across a forecourt and this is read from arm's length, and at
    // 8 px/m the fanlight's centre bar came out 25 cm wide and sat in the glass
    // as a dark blob. At 16 a texel is 6 cm and the same bar is a glazing bar.
    const PPM = 16;
    const COURSE = Math.round(0.75 * PPM), BLOCK = Math.round(2.75 * PPM);
    const ashlar = (g: CanvasRenderingContext2D, w: number, h: number, r: () => number) => {
      g.fillStyle = STONE; g.fillRect(0, 0, w, h);
      for (let y = 0, i = 0; y < h; y += COURSE, i++) {
        const off = (i % 2) ? 0 : Math.round(BLOCK / 2);
        for (let x = -off; x < w; x += BLOCK) {
          const k = r();
          if (k > 0.8) g.fillStyle = STONE_L; else if (k < 0.22) g.fillStyle = STONE_D; else continue;
          g.fillRect(x + 1, y + 1, BLOCK - 2, COURSE - 2);
        }
      }
      g.fillStyle = 'rgba(255,255,255,0.16)';
      for (let y = 0; y < h; y += COURSE) g.fillRect(0, y, w, 1);
      g.fillStyle = 'rgba(0,0,0,0.15)';
      for (let y = 0; y < h; y += COURSE) g.fillRect(0, y + 1, w, 1);
    };
    // the stepped round head, and its half-width at a row, off ONE curve —
    // civic.ts's own lesson: "an opening and the thing inside it have to come
    // off one curve, two descriptions of the same edge will always drift"
    const archHW = (w: number, yTop: number, y: number) => {
      const rr = Math.floor(w / 2), dy = y - yTop;
      if (dy >= rr) return rr;
      if (dy < 0) return 0;
      return Math.round(Math.sqrt(Math.max(0, rr * rr - (rr - dy) * (rr - dy))));
    };
    const archFill = (g: CanvasRenderingContext2D, cx: number, w: number,
      yTop: number, yBot: number, col: string) => {
      const rr = Math.floor(w / 2);
      g.fillStyle = col;
      if (yBot > yTop + rr) g.fillRect(cx - rr, yTop + rr, w, yBot - (yTop + rr));
      for (let dy = 0; dy <= rr; dy++) {
        const hw = archHW(w, yTop, yTop + dy);
        if (hw > 0) g.fillRect(cx - hw, yTop + dy, hw * 2, 1);
      }
    };

    // ── the doorcase: one panel, with the doorway cut OUT of it ──
    //
    // Cut out rather than drawn round, so the arch, the fanlight, the transom
    // and the reveal all come off the same canvas and cannot drift from each
    // other by a texel. alphaTest and NOT transparent — GOTCHAS §22: this is a
    // cut-out, and putting it in the sorted queue is how a DoubleSide neighbour
    // starts painting over it.
    // EVERY NUMBER BELOW IS A METRE, converted once. The whole point of this
    // block is that it agrees with a facade in somebody else's file, and the
    // way that agreement rots is a texel count typed next to a comment saying
    // what it means in metres (GOTCHAS §20 — aim from the source).
    const CASE_W = 3.75, CASE_H = 5.625;               // the doorcase's own extent
    const ORDER_W = 3.25, ORDER_Y = 5.50;              // the outer order
    const REVEAL_W = 2.75, REVEAL_Y = 5.25;            // the inner order + fanlight
    const m = (v: number) => Math.round(v * PPM);
    const CW = m(CASE_W), CH = m(CASE_H), cx = Math.round(CW / 2);
    const caseT = declareSurface(pixTex(CW, CH, (g) => {
      const yOf = (v: number) => Math.round(CH - v * PPM);
      const r2 = (() => { let s = 0x51b3a7; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); })();
      ashlar(g, CW, CH, r2);
      archFill(g, cx, m(ORDER_W), yOf(ORDER_Y), CH, STONE_D);
      archFill(g, cx, m(REVEAL_W), yOf(REVEAL_Y), CH, STONE);
      // the fanlight, CUT TO THE ARCH — same cx, same width, same yTop as the
      // opening it sits in, stopped at the transom over the doors
      const fTop = yOf(REVEAL_Y), fBot = yOf(DH);
      archFill(g, cx, m(REVEAL_W), fTop, fBot, GLASS);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      const bar = Math.max(1, m(0.10));
      g.fillRect(cx - Math.round(bar / 2), fTop + m(0.25), bar, fBot - fTop - m(0.25));
      for (const by of [yOf(4.90), yOf(4.55)]) {        // …and its two lights
        const hw = archHW(m(REVEAL_W), fTop, by);
        if (hw > 1) g.fillRect(cx - hw, by, hw * 2, Math.max(1, m(0.06)));
      }
      g.fillStyle = STONE_D;                            // the transom under it
      g.fillRect(cx - m(REVEAL_W) / 2, fBot, m(REVEAL_W), Math.max(1, m(0.10)));
      dither(g, CW, CH, Math.round(CASE_W * CASE_H * 12));
      // THE HOLE — 2.50 m across and 4.00 tall, centred, which is the same
      // opening the kit cut in the wall behind this panel.
      const hw2 = m(DW) / 2;
      g.clearRect(cx - hw2, yOf(DH) + Math.max(1, m(0.10)), hw2 * 2, CH);
    }), 'sign');
    const caseP = new THREE.Mesh(new THREE.PlaneGeometry(CASE_W, CASE_H),
      new THREE.MeshBasicMaterial({ map: caseT, alphaTest: 0.5 }));
    caseP.rotation.y = Math.PI;                        // face into the room
    put(caseP, room.doorAt, CASE_H / 2, hd - 0.03);

    // ── THE FANLIGHT IS GLASS, SO IT GOES DARK TOO ──
    //
    // The second instance of the fault the daylight panel had, and I am not
    // leaving it half-corrected — GOTCHAS §44: "half a correction is most of
    // the way to none." The stone doorcase is an INTERIOR surface and correctly
    // stays lit at 2am. The fanlight in it is not stone, it is a window, and a
    // window over a dark street should not glow pale blue above a dark doorway.
    //
    // Drawn as its own plane a hair proud of the doorcase rather than by
    // splitting caseT, because caseT's whole property is that the arch, the
    // glass, the transom and the reveal come off ONE curve and cannot drift by
    // a texel. Same `archFill`, same cx, same width, same yTop — so this is the
    // same curve again, not a second description of it.
    const FAN_H = REVEAL_Y - DH;
    const fanT = declareSurface(pixTex(m(REVEAL_W), m(FAN_H), (g) => {
      const w = m(REVEAL_W), h = m(FAN_H), fcx = Math.round(w / 2);
      g.clearRect(0, 0, w, h);
      archFill(g, fcx, w, 0, h, GLASS);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      const bar = Math.max(1, m(0.10));
      g.fillRect(fcx - Math.round(bar / 2), m(0.25), bar, h - m(0.25));
      for (const by of [m(0.35), m(0.70)]) {
        const hw = archHW(w, 0, by);
        if (hw > 1) g.fillRect(fcx - hw, by, hw * 2, Math.max(1, m(0.06)));
      }
    }), 'sign');
    const fanM = new THREE.MeshBasicMaterial({ map: fanT, alphaTest: 0.5 });
    const fanP = new THREE.Mesh(new THREE.PlaneGeometry(REVEAL_W, FAN_H), fanM);
    fanP.rotation.y = Math.PI;
    put(fanP, room.doorAt, DH + FAN_H / 2, hd - 0.05);
    // the same two endpoint colours the daylight panel uses, for the same
    // reason and off the same measurement
    ctx.onFrame(() => {
      const n = (ctx.scene.userData.nightFactor as number) ?? 0;
      fanM.color.setRGB(1, 1, 1).lerp(new THREE.Color(0x3c3c3c), n);
    }, HOOK.LATE);

    // A REAL PROFILE, which is what civic.ts says tells a civic building from a
    // shopfront: two jamb pilasters and an impost band, proud of the panel, so
    // the doorcase has a silhouette from an angle and not only head-on.
    const stoneM = new THREE.MeshBasicMaterial({ color: 0xa89e88 });
    const stoneDM = new THREE.MeshBasicMaterial({ color: 0x8a806c });
    for (const sx of [-1, 1]) {
      box(0.22, DH + 0.30, 0.20, stoneM, room.doorAt + sx * (DW / 2 + 0.11), (DH + 0.30) / 2, hd - 0.13);
    }
    box(DW + 0.90, 0.18, 0.22, stoneM, room.doorAt, DH + 0.32, hd - 0.14);   // the impost
    box(DW + 0.60, 0.06, 0.24, stoneDM, room.doorAt, DH + 0.20, hd - 0.15);  // its shadow
    box(DW + 0.44, 0.05, 0.30, stoneDM, room.doorAt, 0.025, hd - 0.12);      // the threshold

    // ── daylight, so the opening reads as an opening ──
    //
    // The kit gives a CUT-FACE room a bright panel outside its doorway and a
    // flat-wall room nothing, so this hole looked out onto empty scene: a flat
    // slate field that reads as neither outside nor wall. What is actually out
    // there is the forecourt — pale paving under a pale sky — so that is what
    // this is, two bands and a horizon, not one card.
    //
    // SIZED SO ITS EDGES ARE NEVER IN SHOT. The first cut was 4.6 m tall
    // starting at floor level and there was a slate band under the doors in
    // every screenshot: the panel's bottom edge subtends 27° below the horizon
    // from a player's eye and the threshold subtends 28°, so a one-degree
    // wedge of empty scene showed between them. Interiors are parked at
    // x > 100 where there is no ground and no sky, and empty scene reads as a
    // flat blue-grey card — the exact thing this panel exists to cover. It now
    // runs 1.6 m BELOW the floor and 6 m wide against a 2.5 m opening.
    const DAY_W = 6.0, DAY_Y0 = -1.6, DAY_Y1 = 5.0;
    const yIn = (v: number) => Math.round((DAY_Y1 - v) / (DAY_Y1 - DAY_Y0) * 44);
    const dayT = declareSurface(pixTex(32, 44, (g) => {
      g.fillStyle = '#cfdae4'; g.fillRect(0, 0, 32, 44);          // sky over the court
      g.fillStyle = '#8f8878'; g.fillRect(0, 0, 32, yIn(4.2));    // the recess head, in shadow
      g.fillStyle = '#b8b0a0'; g.fillRect(0, yIn(1.5), 32, yIn(1.1) - yIn(1.5));
      g.fillStyle = '#a89e88'; g.fillRect(0, yIn(1.1), 32, 44);   // the forecourt paving
      g.fillStyle = 'rgba(0,0,0,0.10)';                           // and its joints
      for (let y = yIn(0.9); y < 44; y += 3) g.fillRect(0, y, 32, 1);
      dither(g, 32, 44, 80);
    }), 'sign');
    const dayM = new THREE.MeshBasicMaterial({ map: dayT, side: THREE.DoubleSide });
    const day = new THREE.Mesh(new THREE.PlaneGeometry(DAY_W, DAY_Y1 - DAY_Y0), dayM);
    put(day, room.doorAt, (DAY_Y0 + DAY_Y1) / 2, hd + T + 0.55);
    // ── AND IT GOES DARK WITH THE WORLD, 2026-07-26 ──
    //
    // Found by shooting this room at an hour I had never shot it at. At 02:00
    // the forecourt outside IS properly dark and looking OUT through these
    // doors gave you full noon daylight — the doorway was a lightbox at 2am.
    //
    // `dimWorld` skips |x| > 100, so nothing in an interior is graded. That is
    // RIGHT for the room: a shop with its lights on at 2am is exactly what a
    // lit window promises from the street. It is wrong for THIS, because this
    // is not room light — it is a picture of OUTSIDE, and outside is dark.
    //
    // GOTCHAS §22 names the case and the remedy: a surface the grader will not
    // touch, painted to depict one it does, "should dim its own from its
    // onFrame, matching the factor the world is measured applying rather than
    // picking one. ct/lot.ts does."
    //
    // So it is measured, on the very surface this panel depicts — the library's
    // own forecourt, sampled through the world's own materials:
    //
    //   scene.userData.nightFactor   13:20  0        02:00  1
    //   forecourt paving  (y 0.14)   #ffffff  ->  #3c3c3c   x 0.235
    //   the flight's steps(y 0.16)   #ffffff  ->  #918e89   x 0.569
    //
    // The paving is the band that reads as the lightbox and it is most of the
    // panel, so the panel follows the paving. The two differing factors are
    // recorded rather than averaged: they are the world's, not mine, and if a
    // later pass makes this look wrong the number to argue with is 0.235.
    // READ `scene.userData.nightFactor`, NOT the frame's `night`. They are two
    // different quantities with almost the same name — GOTCHAS §25's shape —
    // and I shipped the wrong one for one build:
    //
    //   f.night                       hud's raw wash curve. NIGHT_STOPS tops
    //                                 out at 0.58, so it never reaches 1.
    //   scene.userData.nightFactor    "0 broad day … 1 fully night", published
    //                                 by props.ts's dimWorld for precisely this
    //                                 reason: "let the thing that knows say so,
    //                                 instead of three modules each guessing it
    //                                 from appearances".
    //
    // AND SET THE COLOUR THE WAY THE MEASUREMENT WAS TAKEN. The second wrong
    // build used `setScalar(0.235)`, which writes a LINEAR value, while 0.235
    // came from `getHexString()` — an sRGB readout. Linear 0.235 displays as
    // #858585, more than twice the brightness intended, and the formula looked
    // perfectly correct while doing it. Caught only by measuring the tint back
    // out and finding #858585 where #3c3c3c was expected, twice in a row.
    //
    // So the endpoints are the world's own graded colours for the surface this
    // panel depicts, and it lerps between them:
    //
    //   the library forecourt paving   13:20 #ffffff   02:00 #3c3c3c
    //   its flight's steps             13:20 #ffffff   02:00 #918e89
    //
    // The paving is the band that reads as the lightbox and is most of the
    // panel, so the panel follows the paving. Both are recorded rather than
    // averaged: they are the world's numbers, not mine, and if a later pass
    // makes this look wrong then #3c3c3c is the value to argue with.
    const DAY_TINT = new THREE.Color(0xffffff);
    const NIGHT_TINT = new THREE.Color(0x3c3c3c);
    ctx.onFrame(() => {
      const n = (ctx.scene.userData.nightFactor as number) ?? 0;
      dayM.color.copy(DAY_TINT).lerp(NIGHT_TINT, n);
    }, HOOK.LATE);

    // ── the two leaves, standing open ──
    //
    // OUTWARD, into the recess, for the same reason the kit swings its own leaf
    // out: a pair swung inward at any angle wide enough to read as open sweeps
    // straight across the way-out [E] spot at (0, hd - 0.55), and at any angle
    // narrow enough to clear it they read as shut.
    //
    // Hinged on their own jamb by arithmetic, not by a pivot Group: a child of
    // a nested group carries a LOCAL position and `dimWorld` reads that, which
    // is the note in ct/interior.ts and the reason the kit does it this way.
    const leafT = declareSurface(pixTex(16, 48, (g) => {
      g.fillStyle = TIMBER; g.fillRect(0, 0, 16, 48);
      g.fillStyle = 'rgba(0,0,0,0.22)';                 // two sunk panels
      g.fillRect(2, 4, 12, 18); g.fillRect(2, 25, 12, 18);
      g.fillStyle = 'rgba(226,214,186,0.10)';
      g.fillRect(2, 4, 12, 1); g.fillRect(2, 25, 12, 1);
      g.fillStyle = BRASS; g.fillRect(11, 27, 3, 6);    // the push plate, leading edge
      dither(g, 16, 48, 70);
    }), 'detail');
    // BACK TO BACK, NOT DOUBLE-SIDED, and the rear plane takes the SAME texture
    // unflipped — GOTCHAS §35. The rotation has already done the mirroring, and
    // flipping it again would put the brass on the hinge stile, which is the
    // one place a door handle is never.
    // `0.85` — *"~49 deg, matching the kit"* — was here, and matching the kit
    // was the problem: the kit's angle is not a decision anybody made about a
    // library, and the user's own words about this entrance were *"the door
    // reads as SHUT-BUT-OPEN"* (quoted in full at `ct/int-pawn.ts:177`). These
    // leaves are hand-rolled rather than `leafPair`'s — they are back-to-back
    // planes on the OUTER face, not a mirrored pair — so the shared angle has
    // to be imported rather than inherited from the helper.
    const OPEN = LEAF_AJAR;                             // vice.ts — one angle, world-wide
    const LW = DW / 2 - 0.02;
    const hz = hd + T + 0.02;                           // the hinge, on the OUTER face
    const dAtJ = room.doorAt;
    // The same rebate `leafPair` puts behind every other shut pair. This room
    // does not call `leafPair` — its leaves are back-to-back planes on the
    // outer face — so it asks for the piece rather than getting it for free,
    // and the piece is imported rather than copied. Without it the 2 x 0.02 m
    // between the leaves is a slot onto the void behind the doorway, which is
    // exactly what it photographed as.
    doorRebate(put, dAtJ, DW, DH, hz);
    for (const sx of [-1, 1]) {
      const hx = dAtJ + sx * DW / 2;                    // each leaf on its own jamb
      const th = -sx * OPEN;
      // a plane at rotation.y = th has its local +x along (cos th, 0, -sin th)
      // and its normal along (sin th, 0, cos th). The leaf runs from its hinge
      // toward the middle of the opening, which is -sx in world x, so its
      // centre is half a leaf back along that direction.
      const cxl = hx - sx * Math.cos(th) * LW / 2;
      const czl = hz + sx * Math.sin(th) * LW / 2;
      const nx = Math.sin(th), nz = Math.cos(th);       // the leaf's own normal
      for (const face of [1, -1]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(LW, DH * 0.98),
          new THREE.MeshBasicMaterial({ map: leafT }));
        m.rotation.y = face > 0 ? th : th + Math.PI;
        // a hair apart ALONG THE LEAF'S OWN NORMAL, not along z: two planes
        // separated on a world axis are still coplanar when the leaf is raked,
        // which is the z-fight in GOTCHAS §6 wearing a rotation.
        put(m, cxl + face * nx * 0.008, DH * 0.49, czl + face * nz * 0.008);
      }
    }
  }

  // ── THE ISSUE DESK ───────────────────────────────────────────────────────
  //
  // Between the door and the stacks, turned so the librarian faces whoever
  // comes in. Its front is a solid panel to the floor: a counter you can see
  // the librarian's knees under is a shop counter, not a civic one.
  // Moved back from D/2 - 2.5 to D/2 - 5.8: at the old number the desk stood
  // inside the vestibule, and the whole point of the vestibule is that it is
  // small, dark and EMPTY — you come through it and the room opens.
  //
  // And moved WEST, from W/2 - 2.9 to W/2 - 6.5, because the stair needs the
  // east strip. At 4.5 its collider ran x 3.0 to 6.0 and stood straight across
  // the foot of the flight: walking to the stair you stopped dead at z 6.03,
  // which is the desk's face plus a capsule radius. The desk still faces the
  // door — it is the first thing you meet coming out of the vestibule — it is
  // simply no longer parked in front of the only way upstairs.
  // WEST OF THE AXIS. At W/2 - 6.5 the desk sat at x 2.0..5.0, z 4.75..5.65 —
  // straight across the route from the arch to the stair, so walking at the
  // gallery you stopped dead on the counter. The user's instruction was "if the
  // stair is behind the desk, move the stair, not the walls"; here the stair has
  // to stay on the wall it serves, so the DESK moves and the effect is the same
  // — the east half of the room is now clear from the arch to the bottom tread.
  //
  // It still faces the door and is still the first thing you meet coming in,
  // which is all a circulation desk has to be.
  //
  // ── AND IT HAS A BACK NOW, 2026-07-25 ──
  //
  // *"librarian orientation is so bad"*
  // (`Screenshot from 2026-07-25 22-04-43.png`, taken from the reading room).
  //
  // She was NOT facing the wrong way and she was NOT on the wrong side: her
  // facing is derived from the desk (GOTCHAS §33) and the staff side is the
  // one away from the door, both correct. The fault is that the desk was a
  // single 2.9 x 0.72 counter with nothing behind it, so "behind the desk" is
  // a fact about z that the picture cannot carry. From the door she reads
  // right; from the reading room — where the player spends the whole visit and
  // where that screenshot was taken — you see a figure standing on open floor
  // with a counter in front of her and her back to you, which is exactly what
  // "standing in front of the desk" looks like.
  //
  // GOTCHAS §41 again, and it is the third time in this one file: a thing was
  // verified from ONE side. So the repair is not to move her, it is to give
  // the room the information — the desk becomes a U with a staff pocket, and
  // she stands INSIDE it. From the door: behind her counter. From the reading
  // room: behind her back worktop. There is now no angle from which she is
  // standing in the open.
  // ── AND BACK TO THE ENTRANCE END, 2026-08-03 (item 115) ──
  //
  // *"library is crowded in some areas and spacious in others. try a different
  // layout thanks."* Gridded 4 x 4, the room answered in one line: the zone
  // holding this desk was 47% furniture and the whole entrance third averaged
  // 5%. The desk and the long reading table were stacked in the SAME zone while
  // 110 m2 by the doors held a card catalogue and an umbrella stand.
  //
  // THE 5.8 WAS CLEARANCE FOR SOMETHING THAT NO LONGER EXISTS. Read the comment
  // above: the desk was pushed back from D/2 - 2.5 to D/2 - 5.8 because at the
  // old number "the desk stood inside the vestibule". The vestibule was DELETED
  // on 2026-07-25 — its piers carried the colliders across the room at z 6.80
  // and they went with it (see THE VESTIBULE — REMOVED). So this constant has
  // been holding the desk 3.3 m off the entrance to clear a structure that has
  // not been in the room for a week. That is the same fault the reading table
  // hit two hundred lines down and the file names it there: **a constant that
  // was right stopped being right because a DIFFERENT constant moved**, and
  // nothing flagged it because both numbers were correct when written.
  //
  // So it goes back where a circulation desk belongs — just inside the doors,
  // the first thing you meet — and the reading hall behind it is one continuous
  // floor from the desk to the stacks instead of a room with a counter marooned
  // in the middle of it.
  //
  // AND WEST, from 6.5 to 5.0. At 6.5 the collider's east face was 0.60 m off
  // the door opening's west jamb (the opening is 2.5 m on the door axis); that
  // was harmless when the desk sat 5.8 m inside, and is a counter in the
  // doorway once it moves forward. At 5.0 the collider runs x -6.65..-3.35, so
  // the east face stands 2.10 m off that jamb and centres the desk in the
  // entrance hall's west half — the stair and the entrance table have the east.
  //
  // The returns trolley parks inside that 2.10 m, by derivation and not by
  // accident: its x is `DESK_EAST + PASSABLE + 0.10 + …`, which leaves exactly
  // 1.05 m between desk and trolley however the desk moves. So the lane in is
  // 1.05 m west of the trolley and 4.88 m east of it, and neither is in
  // gap.ts's 0.40–0.95 trap band.
  //
  // WALKED, not eyeballed — scripts/probes/w98-library-relayout-walk.mjs, five
  // runs on the built bundle: in at the doors and down to the hall 5/5, and
  // walking up to the counter comes to rest at z 9.22 with a spread of 0.00 m,
  // which is `VISITOR_Z` (DESK_Z + 0.75 = 9.15) to within a capsule radius.
  const DESK_X = -(W / 2 - 5.0), DESK_Z = D / 2 - 2.6;
  const DESK_W = 3.2, RETURN_D = 2.0;             // the pocket, front face to back
  const BACK_Z = DESK_Z - RETURN_D;
  // the front counter, facing the door
  // the counter's public face is 3.2 x 1.06 m of one tone and it is the first
  // large surface you meet coming through the doors
  boxFace(DESK_W, 1.06, 0.72, wood, DESK_X, 0.53, DESK_Z,
    FACE_PZ, DESK_W, 1.06, '#6b5334');
  box(DESK_W + 0.1, 0.06, 0.82, woodDark, DESK_X, 1.09, DESK_Z);        // the worn top
  box(0.5, 0.16, 0.34, woodDark, DESK_X - 1.05, 1.20, DESK_Z);          // date stamp block
  box(0.34, 0.10, 0.26, metal, DESK_X + 0.75, 1.17, DESK_Z);            // a wire tray
  box(0.30, 0.08, 0.24, metal, DESK_X + 0.75, 1.27, DESK_Z);
  // THE RETURNS, and there are two of them with a gap between.
  //
  // The west one runs the full depth; the east one is a 0.8 m stub off the
  // counter, leaving a 0.9 m staff gap at the back-east corner. One return was
  // not enough: viewed from the east the pocket was open the whole way through
  // and she stood in the gap with her legs in full view, which is the same
  // "standing in the open" reading the user reported, surviving on the one
  // side I had not looked from. GOTCHAS §41 — check EACH side independently.
  // A stub reads as the counter turning its corner; a full second return would
  // make it a kiosk with the staff sealed in.
  {
    const halfW = DESK_W / 2;
    // THE WEST RETURN RUNS FROM ONE MEMBER TO THE OTHER, ends derived rather
    // than a length guessed from RETURN_D. It was `RETURN_D - 0.72` centred on
    // a hand-computed midpoint, which left a 0.36 m hole in the counter body
    // and a 0.26 m gap in its top exactly at the corner — you could see through
    // the desk. Found in the sweep the user asked for after the stair handrail:
    // *"he notices unbroken lines, so it is worth a sweep of every rail, kerb
    // and coping in your room while you have your eye in."* He was right that
    // there was another one, and it was the same shape: two members that come
    // close instead of meeting.
    const wFront = DESK_Z - 0.36;               // the front counter's back face
    const wBack = BACK_Z + 0.30;                // the back worktop's front face
    const wLen = wFront - wBack, wMid = (wFront + wBack) / 2;
    box(0.60, 1.06, wLen, wood, DESK_X - halfW + 0.30, 0.53, wMid);
    box(0.70, 0.06, wLen, woodDark, DESK_X - halfW + 0.30, 1.09, wMid);
    const STUB = 0.80, zMidE = DESK_Z - 0.36 - STUB / 2;
    box(0.60, 1.06, STUB, wood, DESK_X + halfW - 0.30, 0.53, zMidE);
    box(0.70, 0.06, STUB + 0.10, woodDark, DESK_X + halfW - 0.30, 1.09, zMidE);
  }
  // the back worktop — lower than the counter, because it is a work surface and
  // not a barrier, and because the librarian has to read over it
  box(DESK_W, 0.74, 0.60, wood, DESK_X, 0.37, BACK_Z);
  box(DESK_W + 0.1, 0.05, 0.70, woodDark, DESK_X, 0.765, BACK_Z);
  // ONE COLLIDER OVER THE WHOLE U, so the pocket is staff-only by geometry
  // rather than by hoping nobody walks in. 3.3 x 2.7 out of a 440 m2 room; the
  // aisle measurement after this change is in the commit message.
  solid(DESK_X, (DESK_Z + BACK_Z) / 2 + 0.06, DESK_W + 0.1, RETURN_D + 0.75);

  // ── THE CARD CATALOGUE ───────────────────────────────────────────────────
  //
  // The object that dates the room. Sixty drawers with brass pulls and label
  // holders; in 1997 the terminal is on order and this is still the catalogue.
  // ── TURNED TO FACE THE ROOM, AND MADE LEGIBLE, 2026-07-25 ──
  //
  // Found by shooting the two objects in here I had never pointed a camera at.
  // Two faults, and the first is the one that matters:
  //
  //   IT FACED THE FRONT WALL. The drawer face was a plane at CAT_Z + 0.31
  //   looking +z, which is toward the entrance — so from anywhere in the body
  //   of the room, which is where a player spends the whole visit, the object
  //   was a 1.9 x 1.25 x 0.6 m featureless dark brown box. The queue's own
  //   warning is that the user "has flagged large blank internal masses in this
  //   room TWICE".
  //
  //   AND EVEN HEAD-ON IT DID NOT READ. Carcass #5a4632, drawer #6b5334, label
  //   #cbb488 — three browns within a few points of each other at 25 px/m. Set
  //   beside the magazine case built an hour earlier, which reads instantly,
  //   it was a speckled block.
  //
  // Both are the same standard the user set for the periodicals: "if you cannot
  // name the object in one second it is not done." A card catalogue is one of
  // the most recognisable objects there is — a grid of small drawers, each with
  // a CREAM CARD in a holder and a brass pull — and the cream card is the whole
  // tell. It was the one tone missing.
  //
  // So: against the west wall with its drawers facing EAST into the room, 60 of
  // them (which is what the note above has always claimed), at 34 px/m so a
  // drawer is 6 x 8 texels — enough for a label, a pull and a shadow, and not
  // enough for anything finer, so nothing finer is drawn.
  const CAT_X = -W / 2 + 0.35, CAT_Z = D / 2 - 2.6;
  const CAT_W = 1.9, CAT_H = 1.25, CAT_D = 0.60;
  const CAT_COLS = 10, CAT_ROWS = 6;
  const catT = declareSurface(pixTex(64, 48, (g) => {
    g.fillStyle = '#2f2418'; g.fillRect(0, 0, 64, 48);                  // the carcass
    const cw = Math.floor(64 / CAT_COLS), ch = Math.floor(48 / CAT_ROWS);
    for (let r0 = 0; r0 < CAT_ROWS; r0++) {
      for (let c = 0; c < CAT_COLS; c++) {
        const x = 2 + c * cw, y = 1 + r0 * ch;
        g.fillStyle = '#7a6144'; g.fillRect(x, y, cw - 1, ch - 1);       // the drawer front
        g.fillStyle = '#241b12'; g.fillRect(x, y + ch - 2, cw - 1, 1);   // its shadow line
        g.fillStyle = '#e8e0c8'; g.fillRect(x + 1, y + 1, cw - 3, 2);    // THE CARD — the tell
        g.fillStyle = '#8a8068'; g.fillRect(x + 1, y + 2, cw - 3, 1);    // its typed line
        g.fillStyle = '#c9a45e'; g.fillRect(x + Math.floor(cw / 2) - 1, y + ch - 4, 2, 1); // the pull
      }
    }
    dither(g, 64, 48, 70);
  }), 'detail');
  // the body, with grain on the two faces you see from the floor rather than
  // flat colour — A's helper, sized from each face's own metres (GOTCHAS §5)
  boxFace(CAT_D, CAT_H, CAT_W, woodDark, CAT_X, CAT_H / 2, CAT_Z,
    FACE_PZ, CAT_D, CAT_H, '#4a3826');
  box(CAT_D + 0.04, 0.12, CAT_W + 0.04, woodDark, CAT_X, CAT_H + 0.06, CAT_Z);  // its top slab
  const catFace = new THREE.Mesh(new THREE.PlaneGeometry(CAT_W, CAT_H),
    new THREE.MeshBasicMaterial({ map: catT }));
  catFace.rotation.y = Math.PI / 2;                                     // +z -> +x, into the room
  put(catFace, CAT_X + CAT_D / 2 + 0.01, CAT_H / 2, CAT_Z);
  // a tray of loose cards on the top, because the drawers are the thing people
  // actually touched and a catalogue nobody has opened reads as furniture
  box(0.26, 0.05, 0.36, woodDark, CAT_X, CAT_H + 0.14, CAT_Z + 0.4);
  box(0.20, 0.06, 0.30, new THREE.MeshBasicMaterial({ color: 0xe8e0c8 }),
    CAT_X, CAT_H + 0.18, CAT_Z + 0.4);
  solid(CAT_X, CAT_Z, CAT_D + 0.1, CAT_W + 0.1);

  // ── THE READING TABLE, AND YOU CAN SIT AT IT ─────────────────────────────
  //
  // The user's standing rule: *"for every seat in the game i want to be able
  // to sit down."* Four chairs, four seats, registered through `ctx.seat` in
  // WORLD coordinates — the same call the park benches use — so they behave
  // like every other seat in the world rather than like library-only furniture.
  // The reading tables move OUT of the stacks and into the open floor they now
  // face. At -D/2 + 3.2 they sat among the runs, which is a study carrel; on the
  // open floor they are the reading room, which is what the room is for.
  //
  // ── AND OUT OF THE STAIRCASE, 2026-07-25 ──
  //
  // It was at (W/2 - 3.0, 1.2) = local (7.00, 1.20), with a 1.6 x 2.5 m
  // collider running x 6.20..7.80, z -0.05..2.45. The gallery occupies
  // x 6.90..9.90 and its flight runs z 0.60..5.40, so **the table was standing
  // inside the stairs** — buried under the treads, with its collider eating the
  // west portion of the flight.
  //
  // Nobody put it there. It was placed when the gallery was x 4.30..7.30 in a
  // 14.8 m room; widening the room to 20 m moved the gallery out with the east
  // wall (the note above GALLERY_X0 says so in as many words) and the gallery
  // walked over the table where it stood. **A constant that was right stopped
  // being right because a DIFFERENT constant moved**, which is why nothing
  // flagged it: both numbers were correct when written.
  //
  // Found by walking the flight, not by looking at it — from every camera in
  // the room the table is hidden under the deck's soffit, and the only symptom
  // is that a player climbing the west side of the stair stops dead partway up.
  // That is CLAUDE.md's rule ("anything involving movement, collision or floors
  // must be verified by ACTUALLY WALKING IT") earning its place, and it is why
  // scripts/J-gallery-walk.mjs now exists.
  //
  // Moved to the entrance end, which was the last large piece of empty floor
  // and is where a second, smaller table belongs anyway — you come in, and
  // there is somewhere to sit down with what you are carrying.
  // ── AND ITS CHAIRS ALL FACE THE ROOM, 2026-07-26 ──
  //
  // Found by SITTING IN IT, which is the one player action I had never
  // performed in my own room. GOTCHAS §33's last rule: *"do the player's
  // action. Sitting on the bench showed brick wall filling the frame. Nothing
  // short of sitting in it had caught it in three attempts."*
  //
  // The table kept its old orientation when it moved to the entrance end, so
  // two of its four chairs seated you facing EAST at a blank stretch of plaster
  // 5.5 m away — the park benches' failure, in the session that quotes them.
  //
  // A quarter turn was my first fix and it was WRONG, which is worth recording
  // because the reasoning sounded right: chairs facing ±z, one side looking at
  // the entrance doorcase. Sat in it and the north pair still faced blank wall
  // — the doorcase is on the door axis at x 0 and this table is 5.8 m east of
  // it, so "+z" here is front wall, not doors.
  //
  // MEASURED WHAT IS ACTUALLY WORTH LOOKING AT from this corner, instead of
  // guessing a third time. At z ≈ 8.4 the room is empty in every direction but
  // one: east is wall, west is wall past the desk, +z is the front wall unless
  // you are standing on the door axis. Only −z has anything in it — the hall,
  // the desk, the stacks, the terminals and the stair.
  //
  // So this is now what a library entrance table actually is: a bench along the
  // front wall with its chairs on ONE side, and you sit with your back to the
  // doors looking into the room. Four seats, four good views, and no seat that
  // exists only to make the table symmetrical.
  const TAB_X = 5.80, TAB_Z = 9.30;
  box(2.4, 0.08, 0.90, wood, TAB_X, 0.74, TAB_Z);
  for (const dx of [-1.05, 1.05]) for (const dz of [-0.33, 0.33]) {
    box(0.09, 0.74, 0.09, woodDark, TAB_X + dx, 0.37, TAB_Z + dz);
  }
  solid(TAB_X, TAB_Z, 2.5, 1.0);
  for (const dx of [-0.9, -0.3, 0.3, 0.9]) {
    const cx = TAB_X + dx, cz = TAB_Z - 0.80;
    box(0.44, PAN_T, 0.44, wood, cx, PAN_Y, cz);                        // the seat pan
    box(0.44, 0.5, 0.05, wood, cx, 0.70, cz - 0.20);                    // the back
    for (const fx of [-0.18, 0.18]) for (const fz of [-0.18, 0.18]) {
      box(0.05, 0.45, 0.05, woodDark, cx + fx, 0.225, cz + fz);
    }
    ctx.seat({
      // FACE THE TABLE. `ctx.seat` hands its yaw to the rig, so this is the
      // CAMERA convention and not the sprite one: yaw 0 looks along −z, yaw PI
      // along +z. The chairs stand at `TAB_Z - 0.80`, so the table is at HIGHER
      // z than the sitter and facing it is PI — which the chair's own geometry
      // has said all along, because the back three lines up is drawn at
      // `cz - 0.20`, behind a +z-facing sitter. This read `yaw: 0` and put you
      // with your nose 0.20 m from your own backrest and the table at your
      // shoulder blades. (scripts/seat-facing.mjs, rule B.)
      x: room.wx(cx), z: room.wz(cz), yaw: Math.PI, h: SEAT_TOP,
      approach: { x: room.wx(cx), z: room.wz(cz - 0.85) },
      label: 'sit at the table',
      // only offered while you are actually in here, like every kit seat
      ok: () => room.inside(),
    });
  }

  // ── THE LIBRARIAN ────────────────────────────────────────────────────────
  // Behind the desk, facing the door. Drawn from the 8-angle citizen atlas
  // rather than as a flat plane — the kit exists because the diner's waitress
  // was cardboard from every angle but dead ahead.
  //
  // IN THE POCKET, not merely on the staff side of a line. She stands midway
  // between the counter she serves over and the worktop she works at, which is
  // the one position where every camera in the room has a piece of furniture
  // between her and it. Derived from the desk's own two faces, so moving the
  // desk moves her and moving her is impossible without moving the desk.
  const STAFF_OFF = RETURN_D / 2;
  const LIB_Z = DESK_Z - STAFF_OFF;          // between counter and back worktop
  const VISITOR_Z = DESK_Z + 0.75;           // where you stand to be served
  room.person({
    jacket: '#5a6470', pants: '#3f4450', skin: '#c9a184', hair: '#6b5236',
    fit: 'plain', cut: 'short', build: 0,
  // BOTH NUMBERS DERIVED FROM THE DESK, not typed beside it.
  //
  // The user: the librarian "is standing in front of the circulation desk rather
  // than behind it". She was in fact behind it — DESK_Z - 0.75 is the staff side,
  // because the kit's door is at +hd and a visitor therefore arrives from +z —
  // but she was FACING Math.PI, which is -z, straight away from the room and the
  // door. A figure behind a counter with its back to the customer reads exactly
  // like a figure standing on the wrong side of it, which is what was seen.
  //
  // So: STAFF is the side away from the door, and the visitor stands the same
  // distance on the other side. The facing is the vector from her to them. Move
  // the desk and both follow; turn the room round and both follow. This is the
  // ninth orientation fault of the session and GOTCHAS §23's rule is the one
  // that would have caught every one of them — derive facing from what the
  // object faces, never as a constant.
  }, DESK_X, LIB_Z, { facing: Math.atan2(0, VISITOR_Z - LIB_Z), h: 0.97, w: 0.95 });

  // ── THE COMPUTERS ────────────────────────────────────────────────────────
  //
  // *"also i want computers in the library"*, same message as the librarian.
  //
  // 1997 is exactly the year for this and the room already had the other half
  // of the joke written into it: the header of this file says the card
  // catalogue is here because "in 1997 a branch this size had a terminal ON
  // ORDER and a hardwood cabinet of 60 drawers still carrying the collection."
  // The terminals have arrived. The catalogue stays — a branch that has just
  // been given four PCs does not throw out sixty drawers of cards the same
  // week, it puts the machines in the middle of the floor and leaves the
  // cabinet where it is, and the two standing in one room IS the year.
  //
  // Beige boxes, CRTs, mechanical keyboards, and a text OPAC: pale characters
  // on blue, which is what a 1997 branch catalogue actually looked like.
  const BEIGE = 0xd8d0bc, BEIGE_D = 0xb8b0a0;
  const beigeM = new THREE.MeshBasicMaterial({ color: BEIGE });
  const beigeDM = new THREE.MeshBasicMaterial({ color: BEIGE_D });
  const matM = new THREE.MeshBasicMaterial({ color: 0x3a4048 });   // the mouse mat
  const cableM = new THREE.MeshBasicMaterial({ color: 0x2c2c2e });  // and the flex
  // its own stream, appended rather than woven in: this file's `rnd` already
  // paints the noticeboard and the floor wear further down, and drawing from it
  // here would repaint both (GOTCHAS §2, the same argument one scope in).
  const crnd = (() => { let s = 0x6d15c3; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); })();
  // 20 x 16 texels over a 0.30 x 0.24 m screen — 67 px/m, where this room's
  // walls are at 8 and its book spines at 32. Justified the same way the
  // spines are: a CRT is read from a chair 0.6 m away, and it is the one
  // object in the world that genuinely IS a fine pixel grid. Below ~60 px/m a
  // line of text is a single texel and the screen reads as a blue rectangle.
  //
  // THREE KINDS, and the queue asked for the middle one by name: *"give at
  // least one screen a lit amber or green catalogue prompt; a dark screen reads
  // as a box."* A branch in 1997 has both machines standing side by side — the
  // PC the grant paid for, and the amber serial terminal wired to the same
  // catalogue that has been there since 1989 — so the pair is the period
  // rather than an inconsistency.
  const screenTex = (kind: 'pc' | 'amber' | 'dead') => declareSurface(pixTex(20, 16, (g) => {
    if (kind === 'dead') {                             // one of them is off
      g.fillStyle = '#2a2c30'; g.fillRect(0, 0, 20, 16);
      g.fillStyle = 'rgba(255,255,255,0.05)';          // the room, reflected
      g.fillRect(2, 2, 16, 5);
      return;
    }
    if (kind === 'amber') {
      g.fillStyle = '#140f06'; g.fillRect(0, 0, 20, 16);
      g.fillStyle = '#e8a83c';
      g.fillRect(2, 2, 11, 1);                         // CATALOGUE ENQUIRY
      g.fillStyle = '#a8781c';
      for (let i = 0; i < 4; i++) g.fillRect(2, 6 + i * 2, 4 + Math.floor(crnd() * 9), 1);
      g.fillStyle = '#e8a83c';
      g.fillRect(2, 14, 1, 1); g.fillRect(4, 14, 2, 1);  // the prompt and its block cursor
      // scanlines: an amber CRT is the one screen in this world where they are
      // literally true rather than an effect
      g.fillStyle = 'rgba(0,0,0,0.20)';
      for (let y = 1; y < 16; y += 2) g.fillRect(0, y, 20, 1);
      return;
    }
    g.fillStyle = '#16224a'; g.fillRect(0, 0, 20, 16);
    g.fillStyle = '#c8d4e8'; g.fillRect(1, 1, 18, 1);  // the title bar
    g.fillStyle = '#16224a'; g.fillRect(3, 1, 2, 1); g.fillRect(9, 1, 3, 1);
    for (let i = 0; i < 5; i++) {                      // lines of the catalogue
      const y = 4 + i * 2;
      g.fillStyle = '#a8b8d8';
      g.fillRect(2, y, 3 + Math.floor(crnd() * 4), 1);
      g.fillStyle = '#8898b8';
      g.fillRect(9, y, 4 + Math.floor(crnd() * 8), 1);
    }
    g.fillStyle = '#e8b040'; g.fillRect(2, 14, 2, 1);  // the cursor
  }), 'sign');

  /** one beige terminal, facing -x, on a surface whose top is at `y` */
  const terminal = (lx: number, lz: number, y: number, kind: 'pc' | 'amber' | 'dead') => {
    box(0.36, 0.32, 0.38, beigeM, lx, y + 0.16, lz);              // the tube's box
    box(0.30, 0.26, 0.32, beigeDM, lx - 0.04, y + 0.17, lz);      // its bezel, proud
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.24),
      new THREE.MeshBasicMaterial({ map: screenTex(kind) }));
    s.rotation.y = -Math.PI / 2;                                  // +z -> -x
    put(s, lx - 0.20, y + 0.17, lz);
    // KEYBOARD AND MAT SIT INSIDE THE DESK. At -0.36 from the tube the
    // keyboard's front edge cleared the bench by -0.065 m, i.e. it did not:
    // it hung over the front. Both are pulled in to -0.42 against a bench that
    // is now 0.92 deep, which puts 0.10 m of desk in front of the keyboard.
    box(0.17, 0.03, 0.42, beigeM, lx - 0.42, y + 0.015, lz);      // the keyboard
    box(0.20, 0.004, 0.24, matM, lx - 0.42, y + 0.002, lz + 0.30);  // the mat…
    box(0.09, 0.02, 0.11, beigeDM, lx - 0.42, y + 0.015, lz + 0.30); // …and its mouse
  };

  // ── the public OPAC bank, UNDER THE BALCONY ──
  //
  // *"library layout needs a reorg … the librarian desk the shelves the
  // computer area, the reading tables. also use the underneath of the balcony.
  // i cant currently walk under the balcony"* (2026-08-05). `b9e9c26e` made the
  // floor level-aware and gave the room back the 34.8 m² under the deck; this
  // is the half that was held back so he could walk it first.
  //
  // THE BANK WAS AN ISLAND IN THE MAIN WALK. It stood at x 3.07..4.13,
  // z 2.35..5.65 — dead in the line from the doorway (x 0, z 11) to the foot of
  // the flight (x 6.90..9.90, z 5.40), which is the one route across this room
  // that everybody takes twice. A bank of terminals is not a thing to walk
  // round; the queue at it stands where the queue for the stair is.
  //
  // AND UNDER THE DECK IS EXACTLY THE ROOM FOR IT. 2.64 m of headroom over a
  // 3.0 x 11.6 m strip: too low for a 1.95 m stack to stand under without
  // reading as a cellar, and precisely right for a bench of machines you sit
  // at. A low-ceilinged bay of beige boxes under a timber gallery is what a
  // branch that has just been given four PCs actually does with them, and it
  // gives the deck something to be OVER — from the reading floor the soffit now
  // roofs a room instead of hanging over nothing.
  //
  // AGAINST THE EAST WALL, at the SOUTH end of the bay, so you meet it the
  // moment you duck under the deck coming from the hall. Screens still face
  // WEST, so the amber prompt is read from the reading floor between the deck's
  // posts rather than being sealed in.
  //
  // ⚠ EVERY COLLIDER UNDER THIS DECK IS `solidAt(0, …)`, NOT `solid`. A
  // collider is a 2D AABB extruded to infinite height, so a bench registered
  // with a plain `solid` down here would stand in the middle of the GALLERY
  // 2.90 m above it — an invisible wall in a library, which is the worst thing
  // this room can ship. `solidAt(0, …)` is live while the player is on the
  // ground and parked while they are on the deck. Same fix, one level down,
  // as the balustrade above.
  //
  // Measured, ground level, under the deck:
  //   deck posts (collider) east face   x 7.12
  //   bench collider          west face x 8.97      1.85 m of clear lane
  //   bench collider         south face z -0.75     1.35 m to the stair-head fence
  //   bench collider         north face z -4.05     1.05 m to the printer stand
  // and the bay is open to the hall along the WHOLE 11.6 m of its west side —
  // three 0.26 m posts in 11.6 m — so the lane is a bay you step into sideways,
  // never a corridor you have to commit to.
  // hoisted out of the block below: the seated reader further down this file
  // needs the middle terminal's chair, and a sitter placed from a second copy
  // of these numbers is the two-authorings fault this whole file keeps fixing.
  const BX = 9.50, BZ0 = -4.00, BZ1 = -0.80;
  const BZC = (BZ0 + BZ1) / 2, BL = BZ1 - BZ0, BENCH_TOP = 0.74;
  const TERM_CX = BX - 1.00;              // where its chairs stand
  // WHICH terminal has somebody at it, read by the chair loop below and by the
  // sitter further down. The PC at the near end, NOT the amber one in the
  // middle: a person sitting at a bank of terminals occludes their own screen
  // from behind, which is correct and is also how I hid the one screen the
  // queue asked for by name ("give at least one screen a lit amber or green
  // catalogue prompt"). Shot it, saw the amber gone, moved the person.
  const TERM_TAKEN_Z = BZ0 + 0.55;
  // ⚠ A SEAT UNDER THE DECK IS OFFERED FROM UNDER THE DECK ONLY.
  //
  // `Seat` carries no level and `fp.ts`'s picker is 2D, so a chair at
  // (8.50, -3.45) is within `r` of the very same x/z on the GALLERY 2.90 m
  // above it. Without this the prompt reads through the floor and pressing E on
  // the deck seats you on a chair you are standing over.
  //
  // `ctx.player.gy()` is documented as "the GROUND under him, never his own y",
  // which is exactly the quantity wanted: 0 on this floor, GALLERY_Y on the
  // deck. Halfway between them is the test, derived rather than typed, so it
  // follows the deck if the deck ever moves.
  const underDeck = () => room.inside() && ctx.player.gy() < GALLERY_Y / 2;
  {
    const TOP = BENCH_TOP;
    // 0.92 m deep, not 0.76. The user: *"check they are not clipping their
    // desks"* — measured, the keyboard's front edge overhung the bench by
    // 0.065 m, and *"a 15-inch CRT sits ON a desk with room in front of it for
    // a keyboard"*. A monitor 0.36 deep plus a keyboard 0.17 plus clearance
    // does not fit in 0.76, so the desk grows rather than the kit being
    // shuffled: "make the desk a proper run of catalogue desks".
    boxFace(0.92, 0.06, BL, wood, BX, TOP, BZC,                   // the bench top
      FACE_PY, 0.92, BL, '#6b5334');
    for (const lz of [BZ0 + 0.3, BZC, BZ1 - 0.3]) {               // and its legs
      for (const dx of [-0.38, 0.38]) box(0.07, TOP, 0.07, woodDark, BX + dx, TOP / 2, lz);
    }
    // a low back panel: it gives the bank a BACK, which is what stops three
    // machines on a table reading as three machines abandoned on a table, and
    // it hides the cable run the way the real thing does
    box(0.05, 0.46, BL, woodDark, BX + 0.42, TOP + 0.23, BZC);
    solidAt(0, BX, BZC, 1.06, BL + 0.1);

    // THREE, and one of them is out — the same fact as the dead troffer in the
    // ceiling. A room where every machine works has a facilities budget.
    // The middle one is the amber terminal: the oldest machine gets the middle
    // position because that is where a thing nobody chose to move ends up.
    const seats: ['pc' | 'amber' | 'dead', number][] =
      [['pc', BZ0 + 0.55], ['amber', BZC], ['dead', BZ1 - 0.55]];
    for (const [kind, tz] of seats) {
      terminal(BX + 0.22, tz, TOP + 0.03, kind);
      // a beige tower on the floor under the bench, which is where they went
      box(0.20, 0.42, 0.44, beigeDM, BX + 0.26, 0.21, tz);
      // THE COILED CABLE, which the user lists among the five things that make
      // one of these read as a terminal. I answered it with a cable TRAY last
      // time on the grounds that a flex is sub-texel — true of the coil, and
      // not of the drop: the run from the back of the monitor down behind the
      // bench to the tower is 0.4 m of dark against beige and reads fine. The
      // tray stays under the bench; this is what you can see from a chair.
      box(0.05, 0.44, 0.05, cableM, BX + 0.40, TOP - 0.14, tz + 0.12);
      box(0.05, 0.05, 0.16, cableM, BX + 0.40, TOP + 0.06, tz + 0.16);
    }
    // THE CABLE RUN, under the back edge of the top. The queue asked for coiled
    // cables and this is the honest version of that: at 8-16 px/m a flex is
    // well under a texel, so a modelled coil would be a dark blob rather than a
    // cable. What IS legible at this scale is the tray they all disappear into,
    // which is the thing you actually see under a bench of terminals.
    box(0.10, 0.09, BL - 0.2, woodDark, BX + 0.38, TOP - 0.10, BZC);

    // ── the dot-matrix printer, on its own stand at the end of the run ──
    //
    // Its own stand rather than a place on the bench: fan-fold paper feeds from
    // underneath, which is why these always stood on a trolley of their own,
    // and the bench is 3.2 m for three seats with nothing spare.
    //
    // STOOD BACK FURTHER THAN IT LOOKS LIKE IT NEEDS TO, and that is the fix,
    // not a style choice: at the old `BZ1 + 0.85` the gap between the bench's
    // own collider (back face `BZC + (BL + 0.1) / 2`) and the stand's near
    // face measured 0.44 m — inside `gap.ts`'s 0.40-0.95 trap band, wide
    // enough to step into and too narrow to turn round in. Flagged by w4
    // while fixing item 5g, unfixed until now (item 5j). Derived from
    // `PASSABLE` rather than a bigger literal, so it stays provably clear if
    // the bench ever changes depth.
    //
    // IT MOVED TO THE OTHER END OF THE BENCH when the bank went under the deck.
    // Derived off the bench's SOUTH face it landed at z 0.66, standing on the
    // stair-head fence at the mouth of the bay — the one 3 m of this strip that
    // has to stay clear, because it is where you walk in. Off the NORTH face it
    // sits deeper in the bay with the same `PASSABLE`-derived gap, which is
    // also where a printer belongs: away from the door, next to nobody.
    {
      const BENCH_NORTH = BZC - (BL + 0.1) / 2;
      const px = BX, pz = BENCH_NORTH - PASSABLE - 0.10 - 0.36;   // -0.36 = the stand's own half-depth
      box(0.70, 0.06, 0.62, wood, px, 0.72, pz);                  // the stand
      for (const dx of [-0.28, 0.28]) for (const dz of [-0.25, 0.25]) {
        box(0.06, 0.72, 0.06, woodDark, px + dx, 0.36, pz + dz);
      }
      // FOUR TONES, NOT ONE. The first cut had the body, the hood, the paper
      // and the fan-fold box all within a few points of the same off-white and
      // it read as a stack of pale blocks — the printer was in the room and
      // was not recognisable as a printer. Body beige, hood smoked grey, paper
      // white, box cardboard: each part reads because its neighbour does not.
      const smoke = new THREE.MeshBasicMaterial({ color: 0x63635e });
      const paper = new THREE.MeshBasicMaterial({ color: 0xe8e4d6 });
      const card = new THREE.MeshBasicMaterial({ color: 0x9a8464 });
      const slot = new THREE.MeshBasicMaterial({ color: 0x33302a });
      box(0.46, 0.15, 0.58, beigeDM, px, 0.825, pz);              // the printer's body
      box(0.30, 0.03, 0.46, slot, px - 0.04, 0.90, pz);           // the paper slot, sunk
      box(0.26, 0.11, 0.48, smoke, px + 0.06, 0.955, pz);         // the smoked hood over it
      box(0.02, 0.09, 0.50, slot, px - 0.07, 0.955, pz);          // the tractor strip
      // the sheet coming out of the top, folding back over the hood
      box(0.24, 0.012, 0.50, paper, px - 0.10, 0.925, pz);
      box(0.014, 0.20, 0.50, paper, px - 0.21, 1.01, pz);
      // and the fan-fold carton it feeds from, on the shelf below
      box(0.40, 0.30, 0.50, card, px, 0.15, pz);
      box(0.34, 0.05, 0.44, paper, px, 0.32, pz);                 // the stack in it
      solidAt(0, px, pz, 0.8, 0.72);                              // ground only — see the bank
    }

    // ── and you can sit at them ──
    //
    // The user's standing rule: *"for every seat in the game i want to be able
    // to sit down."* Chairs west of the bench, facing the screens.
    //
    // yaw PI/2 is the CAMERA convention, not the mesh one, because `ctx.seat`
    // hands its yaw to the rig — GOTCHAS §33, which cost the park benches a
    // round when the same number was computed for a mesh and spent on a
    // camera. The rig looks along (sin t, -cos t), so PI/2 looks along +x,
    // which is at the screens. The reading table's west chairs use the same
    // number, which is the cross-check: same side, same value.
    for (const [, tz] of seats) {
      const cx = TERM_CX;
      box(0.44, PAN_T, 0.44, wood, cx, PAN_Y, tz);                // the seat pan
      box(0.05, 0.5, 0.42, wood, cx - 0.20, 0.70, tz);            // the back
      for (const fx of [-0.18, 0.18]) for (const fz of [-0.18, 0.18]) {
        box(0.05, 0.45, 0.05, woodDark, cx + fx, 0.225, tz + fz);
      }
      // AN OCCUPIED CHAIR IS NOT A FREE ONE. Somebody is at the middle
      // terminal (further down this file), and a seat offered under a person
      // sits the player inside them. The user's rule is *"for every seat in
      // the game i want to be able to sit down"*, and a chair that visibly has
      // somebody in it is not an exception to that rule — it is the rule
      // reading correctly, because the chair is taken.
      if (Math.abs(tz - TERM_TAKEN_Z) < 0.01) continue;
      ctx.seat({
        x: room.wx(cx), z: room.wz(tz), yaw: Math.PI / 2, h: SEAT_TOP,
        approach: { x: room.wx(cx - 0.85), z: room.wz(tz) },
        // MUST MATCH `SEAT_LABEL` in `ct/library-pc.ts` EXACTLY — that module
        // opens its desktop only for a seat carrying this string, the same way
        // slots.ts joins on 'sit at the slot'. It read 'sit at the terminal'
        // while the PC waited on 'sit at the computer', so the whole computer
        // was unreachable — character-for-character the bug that left blackjack
        // unplayable for days. A terminal is a dumb glass teletype; what is
        // drawn here is a beige mid-90s PC.
        label: 'sit at the computer',
        ok: underDeck,
      });
    }
  }

  // ── THE STUDY CARRELS, THE REST OF THE UNDER-DECK BAY ────────────────────
  //
  // *"also use the underneath of the balcony."* The terminals take the south
  // 3.2 m of an 11.6 m strip; this is what the other end is for.
  //
  // CARRELS ARE THE OBJECT THE LOW CEILING WANTS. The deck's soffit is at
  // 2.64 m and its edge beam at 2.45 — a metre of air over a 1.62 m eye, which
  // is fine to walk under and wrong to stand a 1.95 m bay of books under: a
  // stack down here would leave 0.69 m of daylight over it and read as a
  // cellar. A desk you sit at is 0.74 m tall and its divider tops out at 1.19,
  // so the whole bay stays under half the headroom and the deck reads as a
  // ceiling rather than as a lid.
  //
  // Three of them, one continuous top with fins between, against the east wall
  // and hard up to the back wall — which is also what fixes the clearances.
  // Stood 0.5 m off the back wall the run left a 0.51 m slot behind it, inside
  // `gap.ts`'s 0.40-0.95 trap band; abutted, the only gap it has is the one in
  // front of it, and that is the lane.
  //
  //   back wall inner face   z -11.00   the run's north end   -10.95   abuts
  //   the printer stand      z  -5.82   the run's collider    -7.41    1.59 m
  //   the deck posts         x   7.12   the run's collider     9.30    2.18 m
  //
  // Colliders `solidAt(0, …)` for the reason at the head of the bank: a plain
  // `solid` here is a wall standing in the middle of the gallery above.
  {
    const CAR_X = W / 2 - 0.30 - 0.06;              // 0.60 deep, off the east wall
    const CAR_D = 0.60, CAR_TOP = 0.74, FIN = 0.06, FIN_H = 0.45;
    const CAR_N = 3, CAR_LEN = 3.50;
    const CAR_Z1 = -D / 2 + 0.05;                   // the north end, against the wall
    const CAR_Z0 = CAR_Z1 + CAR_LEN;                // …and the south end
    const CAR_CZ = (CAR_Z0 + CAR_Z1) / 2;
    const BAY = (CAR_LEN - (CAR_N + 1) * FIN) / CAR_N;
    boxFace(CAR_D, 0.05, CAR_LEN, wood, CAR_X, CAR_TOP, CAR_CZ,
      FACE_PY, CAR_D, CAR_LEN, '#6b5334');          // the one worktop
    // the fins, and a leg under each: four of them, so every carrel is a bay
    // with a divider on both sides rather than a share of one long table
    for (let i = 0; i <= CAR_N; i++) {
      const fz = CAR_Z1 + FIN / 2 + i * (BAY + FIN);
      box(CAR_D, FIN_H, FIN, woodDark, CAR_X, CAR_TOP + FIN_H / 2, fz);
      for (const dx of [-0.24, 0.24]) {
        box(0.06, CAR_TOP, 0.06, woodDark, CAR_X + dx, CAR_TOP / 2, fz);
      }
    }
    solidAt(0, CAR_X, CAR_CZ, CAR_D + 0.08, CAR_LEN + 0.08);
    // A LAMP AND A CHAIR PER BAY, and the chair is a seat. Same pan constant as
    // every other chair in the room, same `underDeck` guard as the terminals —
    // the picker is 2D and these sit directly under the gallery's own walkway.
    const brassM = new THREE.MeshBasicMaterial({ color: 0xa8863c });
    const shadeM = new THREE.MeshBasicMaterial({ color: 0x2f5744 });
    const glowM = new THREE.MeshBasicMaterial({ color: 0xe8dcb0 });
    for (let i = 0; i < CAR_N; i++) {
      const cz = CAR_Z1 + FIN + BAY / 2 + i * (BAY + FIN);
      box(0.07, 0.26, 0.07, brassM, CAR_X + 0.20, CAR_TOP + 0.15, cz);   // the stem
      box(0.20, 0.08, 0.16, shadeM, CAR_X + 0.10, CAR_TOP + 0.30, cz);   // its shade
      box(0.16, 0.02, 0.12, glowM, CAR_X + 0.10, CAR_TOP + 0.255, cz);   // and the light in it
      // the chair, pulled up to the desk: 0.32 m of knee room off its front face
      const cx = CAR_X - CAR_D / 2 - 0.32 - 0.22;
      box(0.44, PAN_T, 0.44, wood, cx, PAN_Y, cz);
      box(0.05, 0.5, 0.42, wood, cx - 0.20, 0.70, cz);                   // the back
      for (const fx of [-0.18, 0.18]) for (const fz of [-0.18, 0.18]) {
        box(0.05, 0.45, 0.05, woodDark, cx + fx, 0.225, cz + fz);
      }
      ctx.seat({
        // yaw PI/2 is the CAMERA convention (GOTCHAS §33) and looks along +x,
        // which is at the desk — the same number as the terminals two blocks
        // up, for the same reason: same wall, same side of it.
        x: room.wx(cx), z: room.wz(cz), yaw: Math.PI / 2, h: SEAT_TOP,
        approach: { x: room.wx(cx - 0.85), z: room.wz(cz) },
        label: 'sit at the study carrel',
        ok: underDeck,
      });
    }
    // somebody has left their work out in the middle bay
    const midZ = CAR_Z1 + FIN + BAY * 1.5 + FIN;
    box(0.26, 0.03, 0.20, new THREE.MeshBasicMaterial({ color: 0xe4dfcd }),
      CAR_X - 0.10, CAR_TOP + 0.04, midZ);
    box(0.20, 0.09, 0.15, woodDark, CAR_X + 0.06, CAR_TOP + 0.07, midZ - 0.30);
  }

  // ── the STAFF terminal, on the back worktop ──
  //
  // Faces +x rather than -x: it is on the librarian's own bench and she turns
  // to it, so its screen looks along the counter and not out at the room. The
  // one thing it must NOT do is stand between her and the person she is
  // serving, which is what put the whole of this item in the queue.
  {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.24),
      new THREE.MeshBasicMaterial({ map: screenTex('pc') }));
    s.rotation.y = Math.PI / 2;                                   // +z -> +x
    box(0.36, 0.32, 0.38, beigeM, DESK_X - 0.95, 0.79 + 0.16, BACK_Z);
    box(0.30, 0.26, 0.32, beigeDM, DESK_X - 0.91, 0.79 + 0.17, BACK_Z);
    put(s, DESK_X - 0.75, 0.79 + 0.17, BACK_Z);
    box(0.17, 0.03, 0.42, beigeM, DESK_X - 0.59, 0.79 + 0.015, BACK_Z);
  }

  // ── THE GALLERY, AND THE STAIR UP TO IT ──────────────────────────────────
  //
  // The floor FUNCTION in the spec above is what you walk on; this is what you
  // see. They are two authorings of one shape, so the drawing derives from the
  // same five constants rather than being typed to match: change GALLERY_Y and
  // the deck, treads, balustrade and soffit all follow.
  {
    const GW = GALLERY_X1 - GALLERY_X0, GCX = (GALLERY_X0 + GALLERY_X1) / 2;
    // THE DECK REACHES THE BACK WALL. It stopped at -D/2 + 0.1, leaving a
    // 0.1 m slot between the deck and the wall — and the floor picker answers
    // for the whole x band, so you could stand on 10 cm of gallery that was
    // not drawn. Found in the same sweep as the handrail: the user notices
    // unbroken lines, and a floor that stops short of its wall is one.
    // ABUTS, does not overlap (GOTCHAS §6).
    const deckZ0 = -D / 2, deckZ1 = GALLERY_Z1;
    const deckD = deckZ1 - deckZ0, deckCZ = (deckZ0 + deckZ1) / 2;
    // ONE LINE FOR BOTH BALUSTRADES. The stair's rail and the gallery's used
    // to sit on different x and different y, which is how their junction came
    // to be 8 cm apart. Now there is one x and one height above the walking
    // surface, and the two members meet by construction.
    const RAIL_X = GALLERY_X0 + 0.09, RAIL_H = 0.98;

    // the deck, with a dark soffit under it — from the reading room below its
    // underside is all you see of it
    boxFace(GW, 0.10, deckD, wood, GCX, GALLERY_Y - 0.05, deckCZ,
      FACE_PY, GW, deckD, '#6b5334');            // 3.0 x 11.5 m, and you walk on it
    // ITS UNDERSIDE IS THE BIGGEST FLAT FACE IN THE ROOM — 34.5 m2 of one
    // dark tone, and from the whole reading floor it is most of what the
    // gallery IS. If only one surface in here took A's helper it would be
    // this one.
    boxFace(GW, 0.16, deckD, woodDark, GCX, GALLERY_Y - 0.18, deckCZ,
      FACE_NY, GW, deckD, '#4a3826');
    box(0.16, 0.34, deckD, woodDark, GALLERY_X0 + 0.08, GALLERY_Y - 0.28, deckCZ);
    for (const pz of [deckZ0 + 1.2, deckCZ, deckZ1 - 1.2]) {
      box(0.18, GALLERY_Y - 0.34, 0.18, woodDark, GALLERY_X0 + 0.09, (GALLERY_Y - 0.34) / 2, pz);
      solid(GALLERY_X0 + 0.09, pz, 0.26, 0.26);
    }

    // the treads, riding the ramp the picker walks — ct/civic.ts's rule: answer
    // the smooth gradient and let the drawn steps sit within half a riser, or
    // the camera jolts at every nosing
    const N = 12, run = (STAIR_Z0 - GALLERY_Z1) / N, rise = GALLERY_Y / N;
    for (let i = 0; i < N; i++) {
      const tz = STAIR_Z0 - (i + 0.5) * run, ty = (i + 0.5) * rise;
      box(GW, 0.06, run + 0.02, wood, GCX, ty, tz);
      box(GW, rise, 0.05, woodDark, GCX, ty - rise / 2, tz - run / 2);
    }
    // ── AND THE STRINGERS THAT CARRY THEM ──
    //
    // Found by doing what the queue asks — *"walk both floors, and grade them
    // skeptically"* — and standing at the FOOT of the flight, which is the one
    // place a player looks at a stair from and the one place I had not shot.
    // From there a tread is a 3 m plank with nothing under it and nothing at
    // its ends, and twelve of them read as a cascade of shelves hanging in the
    // air. Every other view is three-quarter and hides it, which is why this
    // survived: the stair had been checked for whether you can CLIMB it, never
    // for what it looks like from where you start climbing.
    //
    // Two raked boards under the tread ends, on the flight's own gradient, so
    // changing GALLERY_Y or STAIR_Z0 moves them with everything else.
    {
      const drop = GALLERY_Y, tread = STAIR_Z0 - GALLERY_Z1;
      const pitch = Math.atan2(drop, tread), len = Math.hypot(drop, tread);
      for (const sx of [-1, 1]) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.36, len), woodDark);
        s.rotation.x = pitch;
        put(s, GCX + sx * (GW / 2 - 0.04), drop / 2 - 0.20, (STAIR_Z0 + GALLERY_Z1) / 2);
      }
    }
    // AN OPEN BALUSTRADE ON THE FLIGHT, NOT A WALL. This was a solid
    // 0.14 x 3.80 x 4.60 slab of dark timber down the open side of the stair —
    // "the largest object in his view and a featureless untextured rectangle",
    // and the thing that made the gallery read as inaccessible: it hid the
    // flight from the room, so the best object in here was something you could
    // look at and not reach.
    //
    // The rail does the job the wall was there for — you still cannot step off
    // the flight, because the collider stays — and you can now SEE the stair
    // from the floor, which is what makes it reachable without hunting.
    {
      // THE BOTTOM OF THE FLIGHT IS OPEN TO THE ROOM. With the balustrade running
      // the full length you could only join the stair at its foot, from a 1.4 m
      // band behind what was then the vestibule pier — two turns and a corridor
      // you could not see from the door. That is "reachable" but not the ask,
      // which was reachable
      // OBVIOUSLY, "without opening a map in your head".
      //
      // Leaving the lowest 1.5 m of the flight unrailed lets you step onto it
      // sideways off the open floor, which is what an open-string stair in a
      // public hall actually is. The rail still guards the part with a drop.
      const OPEN_FOOT = 1.5;
      const zc2 = (STAIR_Z0 + GALLERY_Z1) / 2, len2 = STAIR_Z0 - GALLERY_Z1;
      // ── ONE RAKING MEMBER, NOT TEN CAPS ──
      //
      // The user, on `shots/user-library-railing.png`:
      //
      //   *"the STAIR's handrail is not a rail at all. Each post has its own
      //   short horizontal cap sitting on top of it, and the caps do not touch
      //   each other — going up the flight you get a row of disconnected T
      //   shapes with gaps of air between them."*
      //
      // Exactly right, and the arithmetic says why. It was ten HORIZONTAL boxes
      // at ten descending heights: consecutive ones sat 0.222 m apart
      // vertically and were only 0.09 m tall, so there was 0.13 m of air
      // between each cap and the next. A stepped handrail is the same fault in
      // a different disguise.
      //
      // He also gave me the reference: *"the GALLERY balustrade at the left of
      // that shot is fine — balusters with a continuous top rail — so you have
      // a working reference twenty pixels away from the broken one."* So this
      // is now the same construction, off the same three constants.
      //
      // AND THE ENDS ACTUALLY JOIN, which is the half that would have survived
      // a fix to the rail alone. Measured before: the stair rail's top sat at
      // y 3.84 and x 7.07 while the gallery rail sits at y 3.88 and x 6.99 —
      // 4 cm below it and 8 cm inboard, so the two members passed each other.
      // GOTCHAS §41 and his own warning: *"a junction that looks right from
      // below can be an inch apart from above."* Both now derive from RAIL_X
      // and RAIL_H, so they cannot miss.
      const surfaceAt = (z: number) => GALLERY_Y * (STAIR_Z0 - z) / len2;
      const zBot = STAIR_Z0 - OPEN_FOOT, zTop = GALLERY_Z1;
      const yBot = surfaceAt(zBot) + RAIL_H, yTop = GALLERY_Y + RAIL_H;
      // balusters, each one reaching the UNDERSIDE of the rail rather than
      // stopping 5 cm short of it as they did
      const BAL_H = RAIL_H - 0.045;
      for (let bz = zTop + 0.24; bz < zBot; bz += 0.34) {
        box(0.07, BAL_H, 0.07, woodDark, RAIL_X, surfaceAt(bz) + BAL_H / 2, bz);
      }
      // the newel the rail dies into at the foot of the railed section — a
      // handrail that simply stops in mid-air is the same complaint again
      box(0.12, RAIL_H + 0.20, 0.12, wood, RAIL_X, surfaceAt(zBot) + (RAIL_H + 0.20) / 2, zBot);
      // THE RAIL: one box, rotated to the flight's own pitch, running 0.12 past
      // each end so it penetrates the newel below and the gallery rail above
      // rather than merely touching them.
      const pitch = Math.atan2(yTop - yBot, zBot - zTop);
      const railLen = Math.hypot(zBot - zTop, yTop - yBot);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.09, railLen + 0.24), wood);
      rail.rotation.x = pitch;
      put(rail, RAIL_X, (yBot + yTop) / 2, (zBot + zTop) / 2);
      solid(RAIL_X, zc2 - OPEN_FOOT / 2, 0.22, len2 - OPEN_FOOT);
    }

    // the balustrade you look down from, and a collider so the drop is guarded.
    // Its balusters now reach the rail's underside exactly, from the same
    // BAL_H the flight's use — they were 1.5 cm short, which is invisible and
    // is still the same defect the stair was reported for.
    const GBAL_H = RAIL_H - 0.045;
    box(0.10, 0.09, deckD, wood, RAIL_X, GALLERY_Y + RAIL_H, deckCZ);
    for (let bz = deckZ0 + 0.25; bz < deckZ1 - 0.2; bz += 0.30) {
      box(0.06, GBAL_H, 0.06, woodDark, RAIL_X, GALLERY_Y + GBAL_H / 2, bz);
    }
    // ══ THE ONE COLLIDER THAT WAS WALLING OFF THE WHOLE ROOM BELOW ═══════════
    //
    // This was a plain `solid`, and the note that used to sit under the gallery
    // shelves said so cheerfully: *"their colliders cost the ground floor
    // nothing: the balustrade already stops you at GALLERY_X0 + 0.09 down
    // there"*. That was true, and it was the second half of *"i cant currently
    // walk under the balcony"*. A collider is a 2D AABB extruded to infinite
    // height, so a railing 2.9 m up was a wall standing on the floor.
    //
    // `solidAt` fences it to the deck's own level: live while the player is on
    // the gallery, parked outside the world while they are underneath it. And
    // it MUST stay live up there — the deck's west edge is the only side of it
    // that is not a wall or the stair, and one step past GALLERY_X0 answers the
    // ground floor and drops you 2.90 m. Falling through a floor is worse than
    // anything this item was raised to fix.
    solidAt(GALLERY_Y, RAIL_X, deckCZ, 0.24, deckD);

    // ══ AND THE CLIFF THE NEW FLOOR CREATED, WHICH IS THE OTHER WAY ROUND ════
    //
    // Opening the ground under the deck put a 2.90 m step in the middle of the
    // room, and it faces UP rather than down. The deck's south edge at
    // GALLERY_Z1 abuts the TOP of the flight: one step south out of the new
    // space, at z 0.61, and the picker answers the ramp at 2.89 — a 2.9 m
    // elevator, because a ramp has one candidate and always wins.
    //
    // THE RAMP CANNOT BE MADE TWO-VALUED TO FIX THIS, and that is worth
    // recording because it is the obvious idea. Offer [0, ramp] along the
    // flight and the stair stops working: at the foot the ramp is 0.24 m, which
    // is inside LEVEL_SNAP of the floor, so the picker would keep choosing the
    // ground and you could never climb. The flight has to be single-valued.
    //
    // So the space under the deck ENDS where the stair begins, fenced at ground
    // level only. Parked while you are on the gallery, so walking off the deck
    // onto the stair head — the way down — is untouched. The 2.8 m of open
    // crossing this closes is under the descending flight anyway.
    solidAt(0, GCX, GALLERY_Z1 + 0.06, GW, 0.12);

    // a table up there, because a gallery with nothing on it is a walkway
    box(1.5, 0.06, 0.7, wood, GCX + 0.5, GALLERY_Y + 0.72, deckCZ + 1.4);
    for (const lx of [-0.6, 0.6]) for (const lz of [-0.25, 0.25]) {
      box(0.07, 0.72, 0.07, woodDark, GCX + 0.5 + lx, GALLERY_Y + 0.36, deckCZ + 1.4 + lz);
    }

    // AND SHELVES, which is what a gallery in a Carnegie branch is FOR. It ran
    // round the room to reach the high books; a gallery with a rail and a table
    // is a viewing platform, and the user climbed it once to look down and had
    // no second reason to go up. Two runs against the east wall, books facing
    // the rail, split so the deck reads as having a middle.
    //
    // Their colliders are FENCED TO THE DECK, via `wallRun`'s `base`. This note
    // used to read "their colliders cost the ground floor nothing: the
    // balustrade already stops you at GALLERY_X0 + 0.09 down there" — which was
    // true, and was half the reason there was no room under the balcony.
    const SHELF_X = W / 2 - BAY_D / 2 - 0.06;
    // TWO SUB-PASSABLE PINCHES ON THE DECK, flagged by w4 while fixing item
    // 5g, unfixed until now (item 5j). `wallRun`'s own `solid()` pads a run's
    // z-span by 0.08 m total (0.04 m past each end) so the gap the PLAYER
    // actually walks through is 0.04-0.08 m narrower than the z0/z1 numbers
    // below suggest — the old `deckZ0 + 0.5` wall gap measured 0.46 m clear
    // and the old `-6.4`/`-5.4` middle gap measured 0.92 m, both inside
    // `gap.ts`'s 0.40-0.95 trap band. Widened, not removed: same two runs,
    // same "the deck reads as having a middle" break, just spaced far enough
    // apart that both gaps clear `PASSABLE` with margin, derived so the
    // padding is compensated rather than guessed.
    const GALLERY_SHELF_CLEAR = PASSABLE + 0.15;
    const WALLRUN_PAD = 0.04;                       // half of solid()'s own len+0.08
    const shelfZ0 = deckZ0 + GALLERY_SHELF_CLEAR + WALLRUN_PAD, shelfMid0 = -6.4;
    const shelfMid1 = shelfMid0 + GALLERY_SHELF_CLEAR + 2 * WALLRUN_PAD;
    for (const [z0, z1, seed] of [[shelfZ0, shelfMid0, 0x9a11], [shelfMid1, -1.4, 0x9a22]] as [number, number, number][]) {
      wallRun(SHELF_X, (z0 + z1) / 2, z1 - z0, 'z', -1, seed, GALLERY_Y);
    }
  }

  // ── THE READING ROOM'S OWN TABLE, AND THE PEOPLE AT IT ───────────────────
  //
  // Routed by the desk from F's measurement: the library reads at 0.62 things
  // per m², one of the three thinnest interiors in the world, beside the pawn
  // shop and the hotel. And with it, the correction that matters more than the
  // number: *"density is a DIAGNOSIS, not a target — a big quiet civic room
  // with a few well-placed things beats a cluttered one"*, read beside
  // `roomaisle`, because the two pull against each other and this room has
  // already been cut into strips once.
  //
  // So the answer is not to scatter objects. It is that a 440 m² reading hall
  // had ONE four-seat table in it, which is not a reading room — it is a
  // corridor with a table. A Carnegie hall's centrepiece is a RANK of long
  // tables under the windows, and that is one object, in one place, that a
  // player reads as the point of the room.
  //
  // ══ AND IT IS A RANK NOW, AND IT IS IN THE DAYLIGHT ══════════════════════
  //
  // *"library layout needs a reorg … the reading tables"* (2026-08-05).
  //
  // The comment above says a Carnegie hall's centrepiece is "a RANK of long
  // tables under the windows" and then built ONE table, at x -4.0, z 0.6 — the
  // dead centre of a 22 m room, 10.4 m from the doorway. **THIS ROOM HAS NO
  // WINDOWS.** `DOOR.leaf.glazing` is `'none'` and there is not a pane in any
  // of the four walls: the doorway and its fanlight are the only daylight in
  // 440 m², and the table was as far from them as it is possible to sit.
  //
  // So the rank is real — two tables, not one — and it comes FORWARD, into the
  // half of the room the doors actually light. It is also what you now see on
  // entering, which the single table never was: from the threshold you look
  // down a hall of lamp-lit tables with the stacks behind them, and the room
  // states what it is in one glance instead of reading as a corridor.
  //
  // Nothing in it is taller than 1.17 m (the lamp shades), so the rank does not
  // block the sightline to the stacks, the stair or the gallery. That is the
  // whole argument for putting TABLES in front of the door and shelving behind
  // them, rather than the other way round.
  //
  // Measured against every neighbour, collider face to collider face:
  //
  //   the issue desk's U   z 6.085   the north table's collider ends 5.05  1.03 m
  //   the two tables                 2.10 m between their colliders
  //   the stacks begin at  z -1.96   the south table's collider ends 0.35  2.31 m
  //   the deck posts at    x  6.86   the tables' east end is at      1.10  5.76 m
  //   the alcove case at   x -9.42   the tables' west end is at     -3.90  5.52 m
  //
  // The two chairs that face each other across the 2.10 m gap leave 1.06 m
  // between their backs, which is the aisle between two ranks of a reading
  // room and is what that gap is for.
  const RT_X = -1.4, RT_LEN = 4.8, RT_D = 1.10;
  // THE RANK: the near table in the doorway's light, the far one behind it.
  const RT_Z_N = 4.4, RT_Z_S = 1.0;
  // WHICH CHAIRS HAVE SOMEBODY IN THEM — one list, read twice: once to skip
  // registering the chair as free, and once to place the reader. Two lists
  // would drift, and this file has fixed that fault four times already.
  // It carries the TABLE now as well as the chair, because there are two.
  const TAKEN = [{ z: RT_Z_N, dx: -1.6, side: -1 },
    { z: RT_Z_S, dx: 1.6, side: 1 }] as const;
  // ONE TABLE, BUILT TWICE. The rank has to be two authorings of one object or
  // the pair drifts — the fault this file has fixed four times — so everything
  // below is a function of the table's own z and nothing else.
  const readingTable = (RT_Z: number) => {
    boxFace(RT_LEN, 0.08, RT_D, wood, RT_X, 0.74, RT_Z,
      FACE_PY, RT_LEN, RT_D, '#6b5334');
    for (const dx of [-RT_LEN / 2 + 0.3, 0, RT_LEN / 2 - 0.3]) {
      for (const dz of [-RT_D / 2 + 0.15, RT_D / 2 - 0.15]) {
        box(0.09, 0.74, 0.09, woodDark, RT_X + dx, 0.37, RT_Z + dz);
      }
    }
    // the brass reading lamps down the spine — the one detail that says
    // "reading room" rather than "canteen", and they are lit surfaces in a
    // world where nothing is lit, so the shades do the work
    const shade = new THREE.MeshBasicMaterial({ color: 0x2f5744 });
    const brass = new THREE.MeshBasicMaterial({ color: 0xa8863c });
    const glow = new THREE.MeshBasicMaterial({ color: 0xe8dcb0 });
    for (const dx of [-1.5, 0, 1.5]) {
      box(0.10, 0.34, 0.10, brass, RT_X + dx, 0.95, RT_Z);
      box(0.44, 0.11, 0.24, shade, RT_X + dx, 1.17, RT_Z);
      box(0.38, 0.02, 0.18, glow, RT_X + dx, 1.11, RT_Z);
    }
    solid(RT_X, RT_Z, RT_LEN + 0.2, RT_D + 0.2);

    // SIX CHAIRS, THREE A SIDE, and every one of them registered. The user's
    // standing rule is *"for every seat in the game i want to be able to sit
    // down"*, and a rank of reading chairs you cannot use is the exact thing
    // that rule exists to stop.
    //
    // yaw is the CAMERA convention because `ctx.seat` hands it to the rig
    // (GOTCHAS §33). A chair north of the table faces +z, which is camera yaw
    // PI; south faces -z, which is 0. Derived from the side rather than typed
    // per chair, so the two sides cannot disagree.
    for (const side of [-1, 1] as const) {
      for (const dx of [-1.6, 0, 1.6]) {
        const cx = RT_X + dx, cz = RT_Z + side * 0.95;
        box(0.44, PAN_T, 0.44, wood, cx, PAN_Y, cz);
        box(0.44, 0.5, 0.05, wood, cx, 0.70, cz + side * 0.20);
        for (const fx of [-0.18, 0.18]) for (const fz of [-0.18, 0.18]) {
          box(0.05, 0.45, 0.05, woodDark, cx + fx, 0.225, cz + fz);
        }
        // …and these two have readers in them. Same rule as the terminals:
        // one predicate, `TAKEN`, decides both who is drawn sitting there and
        // which chairs are offered, so the two can never disagree. When I first
        // shipped the readers all six chairs were still registered and you
        // could sit down INSIDE one of them.
        if (TAKEN.some((t) => t.z === RT_Z && t.dx === dx && t.side === side)) continue;
        ctx.seat({
          x: room.wx(cx), z: room.wz(cz),
          yaw: side < 0 ? Math.PI : 0, h: SEAT_TOP,
          approach: { x: room.wx(cx), z: room.wz(cz + side * 0.85) },
          label: 'sit at the reading table',
          ok: () => room.inside(),
        });
      }
    }
  };
  readingTable(RT_Z_N);
  readingTable(RT_Z_S);

  // ── PEOPLE, SEATED, FROM THE ATLAS ───────────────────────────────────────
  //
  // The queue's *"adopt citizenSprite … the reading tables and the new
  // terminals want sitters"*, and behind it the user's own line: *"i want the
  // people inside the buildings to be as detailed and quake-view like as the
  // pedestrians on the street."*
  //
  // `room.person` places at the FLOOR, which is right for a keeper and wrong
  // for a sitter, so these go through `citizenSprite` directly — the call
  // H wrote up in `notes/H-seated-sprite.md`. One rule and it is H's, in
  // bold: **the seated origin is the HIP, so place it at the SEAT TOP, and if
  // you find yourself adding a y fudge, stop and tell H — that means the atlas
  // is wrong, not your room.** No fudge here: `SEAT_TOP` is the TOP of the
  // pan, declared once beside the pan itself, and that is what H's rule asks
  // for. (This comment used to say "0.45 is the seat pan these chairs are
  // built with". 0.45 was the pan's CENTRE, not its top, and the readers sat
  // 2.5 cm into their chairs for it. Left in as the reason `SEAT_TOP` exists.)
  const sitter = (look: Parameters<typeof citizenSprite>[0], lx: number, lz: number, facing: number) => {
    const s = citizenSprite({ ...look, seated: true }, { facing, h: 0.97, w: 0.95 });
    put(s.mesh, lx, SEAT_TOP, lz);
    // TAG THEM AS PEOPLE, exactly as `room.person` does. These figures do not
    // go through the kit — a sitter is placed at the seat top, not the floor —
    // so nothing else sets this, and `ct/interior.ts` says in as many words
    // that the tag "is the only thing that knows which meshes are people",
    // because a shape test also catches the thrift's mannequin and the diner's
    // framed photographs. Without it these readers are 8-angle citizens that
    // no world-level people check can see: a sweep asking "does every figure
    // turn?" or "is every seated figure on its seat" skips them silently, and
    // a check that skips a figure reports GREEN rather than reporting nothing.
    s.mesh.userData.citizen = true;
    s.mesh.userData.seated = true;
    ctx.onFrame((f) => s.update(f.px, f.pz, f.dt), HOOK.LATE);
  };
  // A reader at the long table, on the far side, facing back across it — so
  // walking up to the table you meet a face and not a back. Facing is the
  // MESH/sprite convention here (`atan2(vx, vz)`, 0 = +z), which is NOT the
  // camera one two blocks above; they differ by the z-flip in GOTCHAS §33 and
  // this is the one place in the file where both appear within twenty lines.
  //
  // PLACED FROM `TAKEN`, the same list the chair loop skips, so a reader can
  // never end up in a chair that is still offered or a chair be left empty and
  // unregistered. A reader on the -z side faces +z (sprite yaw 0) and one on
  // the +z side faces -z, derived from the side rather than typed per person.
  const LOOKS = [
    { jacket: '#6a5a48', pants: '#3a3f46', skin: '#8a5f3c', hair: '#241c14',
      fit: 'plain', cut: 'short', build: 0 },
    { jacket: '#4a5a52', pants: '#443c34', skin: '#e0b48c', hair: '#a8925c',
      fit: 'plain', cut: 'long', build: 1 },
  ] as const;
  TAKEN.forEach((t, i) => {
    sitter(LOOKS[i % LOOKS.length], RT_X + t.dx, t.z + t.side * 0.95,
      t.side < 0 ? 0 : Math.PI);
  });

  // AND ONE AT THE TERMINALS — the queue's row names them: *"the reading
  // tables and the new terminals want sitters."* At the PC on the near end,
  // for the reason recorded beside TERM_TAKEN_Z: a sitter occludes their own
  // screen, and in the middle they stood exactly in front of the amber prompt
  // the queue asked for. Facing +x, at the screens, which is sprite yaw
  // PI/2 — the chair's own `ctx.seat` yaw two hundred lines up is also PI/2 and
  // that is a COINCIDENCE of this axis, not the same convention (GOTCHAS §33:
  // the camera looks along (sin t, -cos t) and a sprite faces (sin t, cos t),
  // and they agree only where cos is zero).
  sitter({ jacket: '#7a6a52', pants: '#4a4438', skin: '#c98f5e', hair: '#3a2c1e',
    fit: 'plain', cut: 'short', build: 1 }, TERM_CX, TERM_TAKEN_Z, Math.PI / 2);

  // ── THE THINGS THAT SAY THE ROOM IS USED ─────────────────────────────────
  //
  // Not density — four objects will not move a per-m² figure and are not meant
  // to. These are the props that say somebody works here: a trolley of returns
  // waiting to be shelved, a globe nobody has updated since the Soviet Union,
  // a bin, and a stand full of umbrellas because it has been raining.
  {
    // the returns trolley, parked at the open east end of the issue desk.
    //
    // PUSHED FURTHER EAST THAN IT LOOKS LIKE IT NEEDS, and that is the fix:
    // at the old `TR_X = -0.9` the gap between the desk's own U-collider
    // (east face `DESK_X + (DESK_W + 0.1) / 2`) and the trolley's west face
    // measured 0.64 m — inside `gap.ts`'s 0.40-0.95 trap band. Flagged by w4
    // while fixing item 5g, unfixed until now (item 5j). Derived from
    // `PASSABLE` rather than a bigger literal, so it stays provably clear if
    // the desk's own footprint ever changes.
    const DESK_EAST = DESK_X + (DESK_W + 0.1) / 2;
    // TR_Z WAS THE LITERAL 4.2 AND IS NOW DERIVED. 4.2 is exactly the desk
    // collider's own centre `(DESK_Z + BACK_Z) / 2` at the desk's old z — it was
    // a correct number typed a second time, which is the habit BUILDER-BRIEF §8
    // names as the most expensive one here. Moving the desk to the entrance
    // (item 115) would have left the trolley parked 3.2 m away on open floor.
    const TR_X = DESK_EAST + PASSABLE + 0.10 + 0.31;   // +0.31 = the trolley's own half-width
    const TR_Z = (DESK_Z + BACK_Z) / 2;
    box(0.52, 0.06, 0.86, wood, TR_X, 0.80, TR_Z);
    box(0.52, 0.06, 0.86, wood, TR_X, 0.42, TR_Z);
    for (const dx of [-0.22, 0.22]) for (const dz of [-0.38, 0.38]) {
      box(0.05, 0.80, 0.05, woodDark, TR_X + dx, 0.40, TR_Z + dz);
      box(0.07, 0.07, 0.07, metal, TR_X + dx, 0.035, TR_Z + dz);   // its castors
    }
    // ══ THE RETURNS ARE MODELLED, AND ONLY THESE ═════════════════════════════
    //
    // *"bookshelf in the library looks bad because the graphic is flat here for
    // the books"* (2026-08-05, on this cart beside the issue desk).
    //
    // He is right, and the honest finding is that the cart and the tall runs he
    // can see behind it are THE SAME TECHNIQUE — a `shelfTex` plane hung in the
    // opening. What differs is where you stand relative to it. A stack or a
    // wall run is a 0.52 m deep case: shelf board over, kick under, end panels
    // either side, a back board behind. The plane is framed by real geometry on
    // four sides and you read it from 3–8 m nearly head-on, so it never has to
    // carry the depth itself — the case around it does. This cart is two open
    // boards on four legs with NOTHING around the plane, parked a metre from
    // the desk everybody walks to, and you meet it obliquely. At that range and
    // that angle a zero-thickness rectangle is a rectangle.
    //
    // So the cart — and only the cart — gets real books. Not modelled books:
    // upright slabs, which is all the idiom wants. Spine art on the +x face,
    // page-cream on the top because a standing eye looks DOWN at a 0.83 m
    // shelf, plain cover colour on the other four faces. That last part is the
    // rule two items today were fixed for breaking: one texture on six faces
    // gives you a label on the back of the object.
    //
    // Nine materials total, shared by every book here. Variation comes from the
    // book's INDEX through `bhash`, deliberately NOT from `rnd` above — that
    // stream is consumed in draw order by the whole room and taking from it
    // here would shift every prop built after this block.
    /** deterministic per-book noise from an index, 0..1. Not `rnd`. */
    const bhash = (i: number, salt: number) => {
      let s = Math.imul((i + 1) ^ Math.imul(salt, 0x9e3779b1), 2246822519) >>> 0;
      s ^= s >>> 13; s = Math.imul(s, 3266489917) >>> 0;
      return (s >>> 8) / 16777216;
    };
    const dim = (hex: string, f: number) => {
      const n = parseInt(hex.slice(1), 16);
      return (Math.round(((n >> 16) & 255) * f) << 16)
        | (Math.round(((n >> 8) & 255) * f) << 8) | Math.round((n & 255) * f);
    };
    const pages = new THREE.MeshBasicMaterial({ color: 0xd6cfb4 });
    /** face order is [+x, −x, +y, −y, +z, −z] — GOTCHAS, same as the end panels */
    const bookMats = SPINE.map((c) => {
      // 6 × 32 px for a ~4 × 26 cm spine: ~150 px/m, the plate's density and for
      // the plate's reason — this is read from under a metre away.
      const face = new THREE.MeshBasicMaterial({
        map: declareSurface(pixTex(6, 32, (g) => {
          g.fillStyle = c; g.fillRect(0, 0, 6, 32);
          g.fillStyle = 'rgba(0,0,0,0.32)';                       // the hinge joints
          g.fillRect(0, 0, 1, 32); g.fillRect(5, 0, 1, 32);
          g.fillStyle = 'rgba(236,230,208,0.72)'; g.fillRect(1, 7, 4, 4);   // the title
          g.fillStyle = 'rgba(226,220,200,0.55)'; g.fillRect(1, 26, 4, 3);  // the Dewey label
          dither(g, 6, 32, 12);
        }), 'detail'),
      });
      const cover = new THREE.MeshBasicMaterial({ color: dim(c, 0.7) });
      return [face, cover, pages, cover, cover, cover] as THREE.Material[];
    });
    // The board TOPS, derived: the two 0.06 m shelves are centred at 0.80 and
    // 0.42, so their surfaces are 0.83 and 0.45 and the books stand ON them
    // rather than 3 cm over them the way the planes did. Tallest book is 0.30
    // against the lower shelf's 0.32 m of clearance to the board above it.
    for (const [top, len, salt] of [[0.83, 0.66, 3], [0.45, 0.78, 7]] as [number, number, number][]) {
      let z = TR_Z - len / 2 + 0.012;
      const zEnd = TR_Z + len / 2 - 0.012;
      for (let i = 0; i < 40 && z < zEnd; i++) {
        const w = 0.028 + bhash(i, salt) * 0.030;        // 2.8–5.8 cm spines
        if (z + w > zEnd) break;
        const h = 0.20 + bhash(i, salt + 31) * 0.10;     // 20–30 cm tall
        const d = 0.13 + bhash(i, salt + 61) * 0.04;     // 13–17 cm deep
        // the front edge varies by up to 3 cm, because a cart of returns is not
        // a faced shelf — and because it means no two neighbours are coplanar.
        const fx = TR_X + 0.20 - bhash(i, salt + 89) * 0.03;
        box(d, h, w, bookMats[Math.floor(bhash(i, salt + 97) * SPINE.length)],
          fx - d / 2, top + h / 2, z + w / 2);
        z += w + (bhash(i, salt + 127) < 0.14 ? 0.024 : 0.004);   // the odd gap
      }
    }
    // unchanged: the books' front faces reach TR_X + 0.20, inside this
    // collider's own +0.31 half-width, so nothing new stands in the lane.
    solid(TR_X, TR_Z, 0.62, 0.96);

    // THE GLOBE, AND IT MOVED WITH THE ROOM. It stood at (-7.0, -0.9), which
    // was "on the floor west of the reading table" when the table was at
    // x -4.0, z 0.6. The rank is 5 m north-east of that now and the globe was
    // left standing on its own in the middle of the floor — the same
    // a-constant-that-was-right-stopped-being-right fault this file has fixed
    // for the desk, the trolley and the bin.
    //
    // It goes to the mouth of the reference bay, which is where a globe belongs
    // anyway: it stands at the turn off the hall and announces the bay, the way
    // the stack end plates announce the ranges. 1.17 m clear of the reference
    // table, 1.87 m west to the last stack run, 3.23 m east to the deck posts.
    const GL_X = 3.4, GL_Z = -2.6;
    box(0.34, 0.05, 0.34, woodDark, GL_X, 0.025, GL_Z);
    box(0.07, 0.66, 0.07, woodDark, GL_X, 0.36, GL_Z);
    box(0.40, 0.06, 0.40, new THREE.MeshBasicMaterial({ color: 0xa8863c }), GL_X, 0.72, GL_Z);
    const globeT = declareSurface(pixTex(24, 12, (g) => {
      g.fillStyle = '#5b7f96'; g.fillRect(0, 0, 24, 12);              // the sea
      g.fillStyle = '#8a9a62';
      g.fillRect(2, 3, 5, 6); g.fillRect(9, 2, 7, 5); g.fillRect(13, 7, 4, 4);
      g.fillRect(19, 4, 4, 3);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, 24, 1);
      dither(g, 24, 12, 26);
    }), 'detail');
    const gl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36),
      new THREE.MeshBasicMaterial({ map: globeT }));
    put(gl, GL_X, 0.94, GL_Z);
    gl.rotation.y = 0.6;
    solid(GL_X, GL_Z, 0.46, 0.46);

    // a bin by the desk, and a stand of umbrellas by the doors.
    // "by the desk" is now TRUE BY CONSTRUCTION rather than by coincidence:
    // (-0.9, 5.5) is exactly (DESK_X + 2.6, DESK_Z + 0.3) at the desk's old
    // position, so this was the same retyped-constant fault as the trolley
    // above and it would have stranded the bin in open floor (item 115).
    const BIN_X = DESK_X + 2.6, BIN_Z = DESK_Z + 0.3;
    box(0.32, 0.44, 0.32, metal, BIN_X, 0.22, BIN_Z);
    box(0.34, 0.03, 0.34, woodDark, BIN_X, 0.45, BIN_Z);
    const UM_X = 2.3, UM_Z = D / 2 - 1.2;
    box(0.30, 0.52, 0.30, metal, UM_X, 0.26, UM_Z);
    for (const [dx, dz, c] of [[-0.06, -0.05, 0x3a3f52], [0.05, 0.04, 0x5a3a34],
      [0.02, -0.07, 0x3f4a3a]] as [number, number, number][]) {
      box(0.05, 0.86, 0.05, new THREE.MeshBasicMaterial({ color: c }), UM_X + dx, 0.43, UM_Z + dz);
    }
    solid(UM_X, UM_Z, 0.4, 0.4);

    // and what the readers left on the table — ONE ITEM IN FRONT OF EACH OF
    // THEM, off `TAKEN` rather than off a table constant, so a paper cannot end
    // up on an empty table while a reader sits at a bare one. The open sheet
    // goes to the first reader and the pile of books to the second, each on
    // THEIR side of THEIR table.
    const paperM = new THREE.MeshBasicMaterial({ color: 0xe4dfcd });
    box(0.30, 0.04, 0.22, paperM,
      RT_X + TAKEN[0].dx, 0.80, TAKEN[0].z + TAKEN[0].side * 0.30);
    // two books, the upper one smaller than the lower, so no pair of sides is
    // coplanar (GOTCHAS §6) — the same footprint twice would z-fight down both
    // long edges of the pile.
    const pileZ = TAKEN[1].z + TAKEN[1].side * 0.20;
    box(0.24, 0.14, 0.18, woodDark, RT_X + TAKEN[1].dx, 0.85, pileZ);
    box(0.22, 0.12, 0.16, wood, RT_X + TAKEN[1].dx, 0.98, pileZ);
  }

  // ── THE PERIODICALS ALCOVE ───────────────────────────────────────────────
  //
  // The queue's third space, after the vestibule and the reading room: "a
  // children's or periodicals alcove". It goes in the strip between the west
  // ends of the stacks and the west wall — 2.4 m the stacks do not use, which is
  // exactly an alcove's worth and is why the room reads as having corners rather
  // than as one rectangle with shelving in it.
  //
  // Periodicals rather than children's, because the one figure in this room is a
  // librarian and the one on the street outside is nobody's parent; a children's
  // corner with no children in it reads as closed.
  {
    // ── THE NEWSPAPER STAND IS GONE, ON ITS THIRD REPORT ────────────────────
    //
    // The user: *"remove this weird table in the library."* He said REMOVE, and
    // this file had already written down the rule that settles it — the stand's
    // own comment read *"Second attempt at this object. If it misses again it
    // goes (START-HERE: two failures, then delete)."* This is the miss.
    //
    // WHAT HE WAS ACTUALLY LOOKING AT, measured rather than guessed. It is not a
    // table: it was a raked newspaper stand (a body, a capping rail and a lid at
    // 12°), and the lid is the angled board he describes jutting out. It stood
    // flush to the west wall at `AX = -W/2 + 0.35`, spanning x -9.91…-9.39 —
    // and the wall-mounted magazine case (`wallRun` below) is at x -9.68 and
    // spans -9.94…-9.42. The two overlapped across nearly their whole depth,
    // with the stand's z -2.45…-1.35 sitting wholly inside the case's -2.6…2.6.
    // **The stand was standing inside the shelving**, which is exactly the
    // "intersects the shelving" in the report. Confirmed in the built world by
    // AABB overlap before it was touched.
    //
    // Being flush to the wall — the fix that resolved the earlier cramping
    // report (item 5g) — is what pushed it into the case in the first place.
    // The two constraints could not both be met by moving it, which is the
    // strongest argument that the object was in the wrong room, not the wrong
    // place. Removing it returns that strip to the magazine case alone, and the
    // case already reads (the user said so of the shelves in the same shot), so
    // the gap is not a hole: what is left there is the object that belongs.
    //
    // THE CHAIR STAYS, and its clearance rationale is the part of the old note
    // worth keeping. It has always been derived from the CASE's own east edge
    // rather than from an offset to the stand, precisely so it cannot drift out
    // of clearance if the neighbour moves — and the neighbour has now moved as
    // far as it can go. Measured then at 0.63 m against the case, the same trap
    // class gap.ts's corridor() paints red; deriving it is what fixed that.
    // It now reads as a chair to sit and read the magazines in.
    const caseEastEdge = -W / 2 + BAY_D + 0.06;     // wallRun's own lx + BAY_D / 2
    const CHAIR_X = caseEastEdge + PASSABLE + 0.25 + 0.15;  // +chair half-width (solid w 0.5), +margin
    // ── REBUILT AS A FACE-OUT CASE, 2026-07-25 ──
    //
    // The user, and he filed it as `user-library-computers.png` because he
    // could not tell what it was:
    //
    //   *"three enormous pale grey slabs, tilted back at about thirty degrees,
    //   overhanging small tables that are far too narrow for them. They read
    //   as drawing boards, or venetian blinds propped on trestles — anything
    //   but a terminal. Whats going on here"*
    //
    // He is describing THIS, not the terminals — the terminals are in a build
    // he has not been given yet. And naming it as a completely different
    // object is the whole finding, against his own test: *"stand where a
    // borrower would walk up, at normal eye height, and if you cannot name the
    // object in one second it is not done."*
    //
    // Every one of his three diagnoses was literally true of it: a raked plane
    // with no body (a slab), 0.42 rad of rake (24°, he said thirty), and a
    // 1.5 m face on a 0.42 m rail (overhanging a table too narrow for it). The
    // "venetian blind" was the texture — five horizontal pale stripes.
    //
    // THE FIX IS HIS OWN OBSERVATION, and it is the most useful line in the
    // message: *"The bookshelf and the blue display case in the same shot are
    // working fine, which is worth noting: they read instantly."* So the
    // periodicals stop being a shape this world has no vocabulary for and
    // become the shape it reads best — a case of the same build as the stacks,
    // with COVERS facing out instead of spines. A magazine rack in a library
    // is face-out anyway; that is what distinguishes it from the book stacks
    // standing four metres away.
    //
    // Second attempt at this object. If it misses again it goes (START-HERE:
    // two failures, then delete) — but it is not a redraw of the same idea, it
    // is the same idea in a vocabulary that is measured to work.
    // `paperT`, the folded-broadsheet texture, went with the stand it was drawn
    // for — it had no other consumer. Its lesson survives in `magT` below, which
    // was written from the same note: five even horizontal stripes read as a
    // venetian blind, so a printed thing needs a masthead, a headline block and
    // a picture, not stripes.
    const magT = (wM: number, hM: number, seed: number) => {
      const r = (() => { let q = seed >>> 0; return () => ((q = (Math.imul(q, 1664525) + 1013904223) >>> 0) / 4294967296); })();
      // 32 px/m, the same as the book spines beside it, so the two cases are
      // one density. A cover is ~0.21 m across = 7 texels, which is enough for
      // a masthead band, a picture block and two cover lines and is not enough
      // for anything finer — so nothing finer is drawn.
      const PPM = 32, Wp = Math.max(8, Math.round(wM * PPM)), Hp = Math.max(8, Math.round(hM * PPM));
      const MAST = ['#8a3b30', '#2f4f6a', '#6a6234', '#4a3f5c', '#35564a', '#7d5a3c'];
      return declareSurface(pixTex(Wp, Hp, (g) => {
        g.fillStyle = '#241a12'; g.fillRect(0, 0, Wp, Hp);        // the dark of the case
        let x = 1;
        while (x < Wp - 2) {
          const w = 6 + Math.floor(r() * 2);                       // ~0.20 m covers
          if (x + w > Wp - 1) break;
          g.fillStyle = ['#d8d2c2', '#cfd4d8', '#e0d6c0', '#c8cfc4'][Math.floor(r() * 4)];
          g.fillRect(x, 1, w, Hp - 2);                             // the cover
          g.fillStyle = MAST[Math.floor(r() * MAST.length)];
          g.fillRect(x, 1, w, 2);                                  // its masthead
          g.fillStyle = 'rgba(60,52,38,0.40)';
          g.fillRect(x + 1, 5, w - 2, Hp - 8);                     // the picture
          g.fillStyle = 'rgba(60,52,38,0.30)';
          g.fillRect(x + 1, Hp - 3, w - 3, 1);                     // a cover line
          x += w + 1;                                              // the gap between
        }
        dither(g, Wp, Hp, Math.round(wM * hM * 8));
      }), 'detail');
    };
    // ONE case, against the wall, where three slabs stood in the open. Its
    // length is the alcove's own strip and its build is `wallRun` — the same
    // painter, kick, ends, shelves and back board as the stacks, which is the
    // point: it reads because they read.
    wallRun(-W / 2 + BAY_D / 2 + 0.06, 0.0, 5.2, 'z', 1, 0x4c11, 0, magT);
    // The last newspaper stand stood here, at z -1.9, inside the magazine case
    // above. It is removed — see the note at the top of this block. Its
    // `solid()` went with it, so the strip in front of the case is now clear
    // floor rather than a 0.6 m obstruction a metre off the chair.
    // a chair to sit and read in, turned into the alcove rather than facing the room
    box(0.46, 0.06, 0.46, wood, CHAIR_X, 0.44, 0.9);
    box(0.46, 0.52, 0.06, wood, CHAIR_X, 0.72, 1.12);
    for (const lx of [-0.18, 0.18]) for (const lz of [-0.18, 0.18]) {
      box(0.05, 0.44, 0.05, woodDark, CHAIR_X + lx, 0.22, 0.9 + lz);
    }
    solid(CHAIR_X, 0.9, 0.5, 0.5);

    // ── AND SOMETHING ON THE WALL ABOVE THEM ──
    //
    // Standing in the alcove, everything above 1.3 m was 5 m of blank cream
    // plaster — the largest untouched surface left in the room once the deck's
    // soffit took its grain. The queue's own warning is that the user "has
    // flagged large blank internal masses in this room TWICE", so an empty wall
    // is not a neutral background here, it is the complaint waiting to happen.
    //
    // A FRAMED BOROUGH MAP, which is what is actually on that wall in a branch
    // library, and it dates the room as hard as the card catalogue does: the
    // streets are the ones the player has been walking, and the block is drawn
    // as this world draws blocks.
    const mapT = declareSurface(pixTex(56, 40, (g) => {
      g.fillStyle = '#d8d2be'; g.fillRect(0, 0, 56, 40);                 // the paper
      g.fillStyle = '#b8bfa8';                                            // parks
      g.fillRect(4, 26, 13, 10); g.fillRect(38, 5, 14, 9);
      g.fillStyle = '#c4beaa';                                            // the blocks
      for (const [bx, by, bw, bh] of [[4, 4, 12, 8], [20, 4, 14, 8], [4, 15, 12, 8],
        [20, 15, 14, 8], [38, 15, 14, 8], [20, 26, 14, 10], [38, 26, 14, 10]] as [number, number, number, number][]) {
        g.fillRect(bx, by, bw, bh);
        g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(bx, by + bh - 1, bw, 1);
        g.fillStyle = '#c4beaa';
      }
      g.fillStyle = '#8a8578';                                            // the streets
      for (const x of [17, 35]) g.fillRect(x, 2, 2, 36);
      for (const y of [12, 23]) g.fillRect(2, y, 52, 2);
      g.fillStyle = '#7a3b30'; g.fillRect(24, 17, 3, 3);                  // YOU ARE HERE
      g.fillStyle = '#3a3630'; g.fillRect(2, 2, 52, 1); g.fillRect(2, 37, 52, 1);
      g.fillRect(2, 2, 1, 36); g.fillRect(53, 2, 1, 36);
      dither(g, 56, 40, 90);
    }), 'sign');
    const MAP_W = 1.9, MAP_H = 1.36, MAP_Z = 0.3, MAP_Y = 2.9;
    // the frame first, as a box proud of the wall, so the map has a rebate and
    // an edge rather than being a sticker — the same reason the doorcase got
    // pilasters instead of paint
    box(0.07, MAP_H + 0.16, MAP_W + 0.16, woodDark, -W / 2 + 0.05, MAP_Y, MAP_Z);
    const mp = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, MAP_H),
      new THREE.MeshBasicMaterial({ map: mapT }));
    mp.rotation.y = Math.PI / 2;                                          // faces +x
    put(mp, -W / 2 + 0.10, MAP_Y, MAP_Z);
  }

  // ── BACK OF HOUSE, AND IT DOES NOT OPEN ──────────────────────────────────
  //
  // Also the queue's: "back-of-house doors that do not open". A public building
  // is half rooms you are not allowed into, and a far wall with nothing on it
  // says the building stops there. These carry no [E] and never will — the point
  // is that they are shut, not that they are a puzzle.
  {
    const BZ = -D / 2 + 0.07;
    const plateT = declareSurface(pixTex(28, 8, (g) => {
      g.fillStyle = '#4a4638'; g.fillRect(0, 0, 28, 8);
      hardLayerLib(g, '#d8d2c0', (h) => {
        h.fillStyle = '#d8d2c0'; h.font = 'bold 5px monospace';
        h.textAlign = 'center'; h.textBaseline = 'middle';
        h.fillText('STAFF ONLY', 14, 4);
      });
    }), 'sign');
    for (const [bx, plate] of [[-3.6, true], [3.6, false]] as [number, boolean][]) {
      // the door itself: flush panel, dark, with a plain lever handle
      box(0.96, 2.10, 0.08, woodDark, bx, 1.05, BZ + 0.05);
      box(1.10, 2.24, 0.05, wood, bx, 1.12, BZ);              // the casing round it
      box(0.10, 0.04, 0.05, metal, bx + 0.36, 1.02, BZ + 0.10);
      if (plate) {
        put(new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.18), ctx.flat(plateT)),
          bx, 1.62, BZ + 0.11);
      }
      solid(bx, BZ + 0.05, 1.1, 0.2);
    }
  }

  // ── WHAT IS ON THE WALLS ─────────────────────────────────────────────────
  //
  // A branch library is papered in notices, and they are the cheapest way to
  // say the place is used by somebody. Painted onto one board rather than
  // modelled: at this texel density a pinned sheet IS a rectangle of off-white.
  const noticeT = declareSurface(pixTex(56, 40, (g) => {
    g.fillStyle = '#7a6a4e'; g.fillRect(0, 0, 56, 40);                  // cork
    for (let i = 0; i < 11; i++) {
      const w = 8 + Math.floor(rnd() * 9), h = 7 + Math.floor(rnd() * 8);
      const x = 2 + Math.floor(rnd() * (52 - w)), y = 2 + Math.floor(rnd() * (36 - h));
      g.fillStyle = ['#ded7c4', '#e6e2d2', '#d8cfb8', '#cfd8d2'][Math.floor(rnd() * 4)];
      g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(60,52,38,0.45)';                              // lines of type
      for (let l = 2; l < h - 1; l += 2) g.fillRect(x + 1, y + l, w - 2, 1);
      g.fillStyle = '#b23c2e'; g.fillRect(x + Math.floor(w / 2), y, 1, 1);   // the pin
    }
    dither(g, 56, 40, 70);
  }), 'detail');
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.3),
    new THREE.MeshBasicMaterial({ map: noticeT }));
  put(board, -W / 2 + 0.06, 1.75, D / 2 - 5.4).rotation.y = Math.PI / 2;

  // The clock, high on the back wall where a civic room always puts it.
  //
  // Was a PAINTED FACE - hands baked into a 24x24 texture at a fixed hour, so
  // it disagreed with the diner, with every other clock, and with the wrist.
  // The user: "make sure all the clocks throughout the world (library, diner,
  // etc. tell the time accurately)". Now the kit's primitive, which reads
  // hourF every frame, so all of them agree by construction.
  room.clock({ lx: 0, y: 2.6, lz: -D / 2 + 0.06, r: 0.21 });

  // ── THE FLOOR, WORN WHERE PEOPLE WALK ────────────────────────────────────
  //
  // One decal down the middle of the room, from the door toward the stacks.
  // Municipal lino wears in a line, and the line is where everybody goes.
  //
  // IT STOPS AT THE READING RANK NOW. It ran z 3.80..10.20 and the near table's
  // collider reaches 5.05, so with the tables forward the worn walking line ran
  // UNDER a table — a wear mark where nobody can walk. The traffic forks here
  // anyway, west to the issue desk and east to the stair, so the honest line is
  // the one length everybody shares: the doorway into the hall.
  const wearT = declareSurface(pixTex(24, 96, (g) => {
    g.clearRect(0, 0, 24, 96);
    for (let y = 0; y < 96; y++) {
      const t = Math.abs(y / 96 - 0.5) * 2;
      for (let x = 0; x < 24; x++) {
        const d = Math.abs(x / 24 - 0.5) * 2;
        if (d + t * 0.45 + rnd() * 0.35 > 0.85) continue;
        g.fillStyle = rnd() < 0.5 ? 'rgba(150,152,136,0.30)' : 'rgba(126,130,114,0.24)';
        g.fillRect(x, y, 1, 1);
      }
    }
  }), 'ground');
  const WEAR_L = 4.6;
  const wear = new THREE.Mesh(new THREE.PlaneGeometry(1.5, WEAR_L),
    new THREE.MeshBasicMaterial({ map: wearT, transparent: true, depthWrite: false }));
  wear.rotation.x = -Math.PI / 2;
  put(wear, room.doorAt, 0.004, D / 2 - WEAR_L / 2);
}
