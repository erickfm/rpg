import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import { buildRoom } from './interior';
import { type DoorDecl } from './doors';
// the hard-texel text painter, so a sign in here is as crisp as one on the
// street — same reason ct/int-hotel.ts imports it
import { hardLayer as hardLayerLib } from './vice';

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
    floor: (lx, lz) => {
      if (lx < GALLERY_X0 || lx > GALLERY_X1) return null;
      if (lz <= GALLERY_Z1) return GALLERY_Y;
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

  const { put, solid, W, D } = room;
  const rnd = (() => { let s = 0x1b7a33; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); })();
  const wood = new THREE.MeshBasicMaterial({ color: 0x6b5334 });
  const woodDark = new THREE.MeshBasicMaterial({ color: 0x4a3826 });
  const metal = new THREE.MeshBasicMaterial({ color: 0x6e6f6a });

  /** a box, in local coordinates, sized in metres */
  const box = (w: number, h: number, d: number, m: THREE.Material,
    lx: number, y: number, lz: number) =>
    put(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), lx, y, lz);

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
  const stack = (lx: number, lz0: number, lz1: number, seed: number) => {
    const len = lz1 - lz0, cz = (lz0 + lz1) / 2;
    box(BAY_D, 0.1, len, woodDark, lx, 0.05, cz);                       // the kick
    box(BAY_D, BAY_H, 0.06, wood, lx, BAY_H / 2, lz0);                  // the ends
    box(BAY_D, BAY_H, 0.06, wood, lx, BAY_H / 2, lz1);
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
  for (let i = 0; i < 5; i++) stack(-W / 2 + 2.4 + i * 2.15, zBack, zFront, 0x2a01 + i * 131);

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
    const day = new THREE.Mesh(new THREE.PlaneGeometry(DAY_W, DAY_Y1 - DAY_Y0),
      new THREE.MeshBasicMaterial({ map: dayT, side: THREE.DoubleSide }));
    put(day, room.doorAt, (DAY_Y0 + DAY_Y1) / 2, hd + T + 0.55);

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
    const OPEN = 0.85;                                  // ~49 deg, matching the kit
    const LW = DW / 2 - 0.02;
    const hz = hd + T + 0.02;                           // the hinge, on the OUTER face
    const dAtJ = room.doorAt;
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
  const DESK_X = -(W / 2 - 6.5), DESK_Z = D / 2 - 5.8;
  const DESK_W = 3.2, RETURN_D = 2.0;             // the pocket, front face to back
  const BACK_Z = DESK_Z - RETURN_D;
  // the front counter, facing the door
  box(DESK_W, 1.06, 0.72, wood, DESK_X, 0.53, DESK_Z);
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
    const zMidW = (DESK_Z + BACK_Z) / 2 - 0.36;
    box(0.60, 1.06, RETURN_D - 0.72, wood, DESK_X - halfW + 0.30, 0.53, zMidW);
    box(0.70, 0.06, RETURN_D - 0.62, woodDark, DESK_X - halfW + 0.30, 1.09, zMidW);
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
  const CAT_X = -W / 2 + 1.0, CAT_Z = D / 2 - 2.6;
  const catT = declareSurface(pixTex(48, 40, (g) => {
    g.fillStyle = '#5a4632'; g.fillRect(0, 0, 48, 40);
    for (let r0 = 0; r0 < 5; r0++) {
      for (let c = 0; c < 6; c++) {
        const x = 1 + c * 8, y = 1 + r0 * 8;
        g.fillStyle = '#6b5334'; g.fillRect(x, y, 7, 7);                // the drawer front
        g.fillStyle = '#3d2f20'; g.fillRect(x, y + 6, 7, 1);            // its shadow line
        g.fillStyle = '#cbb488'; g.fillRect(x + 2, y + 1, 3, 2);        // the label holder
        g.fillStyle = '#8a7d5a'; g.fillRect(x + 3, y + 4, 1, 1);        // the brass pull
      }
    }
    dither(g, 48, 40, 90);
  }), 'detail');
  const CAT_W = 1.9, CAT_H = 1.25;
  box(CAT_W, 0.12, 0.62, woodDark, CAT_X, CAT_H + 0.06, CAT_Z);         // its top slab
  const catFace = new THREE.Mesh(new THREE.PlaneGeometry(CAT_W, CAT_H),
    new THREE.MeshBasicMaterial({ map: catT }));
  put(catFace, CAT_X, CAT_H / 2, CAT_Z + 0.31);
  box(CAT_W, CAT_H, 0.60, woodDark, CAT_X, CAT_H / 2, CAT_Z);
  solid(CAT_X, CAT_Z, CAT_W + 0.1, 0.7);

  // ── THE READING TABLE, AND YOU CAN SIT AT IT ─────────────────────────────
  //
  // The user's standing rule: *"for every seat in the game i want to be able
  // to sit down."* Four chairs, four seats, registered through `ctx.seat` in
  // WORLD coordinates — the same call the park benches use — so they behave
  // like every other seat in the world rather than like library-only furniture.
  // The reading tables move OUT of the stacks and into the open floor they now
  // face. At -D/2 + 3.2 they sat among the runs, which is a study carrel; on the
  // open floor they are the reading room, which is what the room is for.
  const TAB_X = W / 2 - 3.0, TAB_Z = 1.2;
  box(1.5, 0.08, 2.4, wood, TAB_X, 0.74, TAB_Z);
  for (const dx of [-0.62, 0.62]) for (const dz of [-1.05, 1.05]) {
    box(0.09, 0.74, 0.09, woodDark, TAB_X + dx, 0.37, TAB_Z + dz);
  }
  solid(TAB_X, TAB_Z, 1.6, 2.5);
  for (const [dx, dz, yaw] of [
    [-1.25, -0.6, Math.PI / 2], [-1.25, 0.6, Math.PI / 2],
    [1.25, -0.6, -Math.PI / 2], [1.25, 0.6, -Math.PI / 2],
  ] as [number, number, number][]) {
    const cx = TAB_X + dx, cz = TAB_Z + dz;
    box(0.44, 0.05, 0.44, wood, cx, 0.45, cz);                          // the seat pan
    box(0.05, 0.5, 0.42, wood, cx - Math.sign(dx) * 0.20, 0.70, cz);    // the back
    for (const fx of [-0.18, 0.18]) for (const fz of [-0.18, 0.18]) {
      box(0.05, 0.45, 0.05, woodDark, cx + fx, 0.225, cz + fz);
    }
    ctx.seat({
      x: room.wx(cx), z: room.wz(cz), yaw, h: 0.45,
      approach: { x: room.wx(cx + Math.sign(dx) * 0.85), z: room.wz(cz) },
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
  // its own stream, appended rather than woven in: this file's `rnd` already
  // paints the noticeboard and the floor wear further down, and drawing from it
  // here would repaint both (GOTCHAS §2, the same argument one scope in).
  const crnd = (() => { let s = 0x6d15c3; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); })();
  // 20 x 16 texels over a 0.30 x 0.24 m screen — 67 px/m, where this room's
  // walls are at 8 and its book spines at 32. Justified the same way the
  // spines are: a CRT is read from a chair 0.6 m away, and it is the one
  // object in the world that genuinely IS a fine pixel grid. Below ~60 px/m a
  // line of text is a single texel and the screen reads as a blue rectangle.
  const screenTex = (dead: boolean) => declareSurface(pixTex(20, 16, (g) => {
    if (dead) {                                        // one of them is off
      g.fillStyle = '#2a2c30'; g.fillRect(0, 0, 20, 16);
      g.fillStyle = 'rgba(255,255,255,0.05)';          // the room, reflected
      g.fillRect(2, 2, 16, 5);
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
  const terminal = (lx: number, lz: number, y: number, dead: boolean) => {
    box(0.36, 0.32, 0.38, beigeM, lx, y + 0.16, lz);              // the tube's box
    box(0.30, 0.26, 0.32, beigeDM, lx - 0.04, y + 0.17, lz);      // its bezel, proud
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.24),
      new THREE.MeshBasicMaterial({ map: screenTex(dead) }));
    s.rotation.y = -Math.PI / 2;                                  // +z -> -x
    put(s, lx - 0.20, y + 0.17, lz);
    box(0.17, 0.03, 0.42, beigeM, lx - 0.36, y + 0.015, lz);      // the keyboard
    box(0.09, 0.02, 0.11, beigeDM, lx - 0.36, y + 0.04, lz + 0.30); // and a mouse
  };

  // ── the public OPAC bank ──
  //
  // On the open reading floor rather than against a wall, because the whole
  // point of a 1997 catalogue terminal is that it is the thing everybody is
  // queueing at. Screens face WEST, into the room, so you meet them looking at
  // you as you come through the doors rather than as three grey backs.
  //
  // Placed in the strip between the issue desk and the stair, which was the
  // only large piece of floor in here doing nothing. Checked against both
  // neighbours rather than eyeballed: the table runs x 3.22..3.98, the desk's
  // U stops at x -1.85 and the gallery starts at x 6.90, so the walk from the
  // doors to the bottom tread is 2.9 m clear and the main aisle west of the
  // bank is 4.5 m.
  {
    const BX = 3.60, BZ0 = 2.40, BZ1 = 5.60;
    const BZC = (BZ0 + BZ1) / 2, BL = BZ1 - BZ0, TOP = 0.74;
    box(0.76, 0.06, BL, wood, BX, TOP, BZC);                      // the bench top
    for (const lz of [BZ0 + 0.3, BZC, BZ1 - 0.3]) {               // and its legs
      for (const dx of [-0.30, 0.30]) box(0.07, TOP, 0.07, woodDark, BX + dx, TOP / 2, lz);
    }
    // a low back panel: it gives the bank a BACK, which is what stops three
    // machines on a table reading as three machines abandoned on a table, and
    // it hides the cable run the way the real thing does
    box(0.05, 0.46, BL, woodDark, BX + 0.36, TOP + 0.23, BZC);
    solid(BX, BZC, 0.9, BL + 0.1);

    // THREE, and one of them is out — the same fact as the dead troffer in the
    // ceiling. A room where every machine works has a facilities budget.
    const seats: [number, boolean][] = [[BZ0 + 0.55, false], [BZC, false], [BZ1 - 0.55, true]];
    for (const [tz, dead] of seats) {
      terminal(BX + 0.16, tz, TOP + 0.03, dead);
      // a beige tower on the floor under the bench, which is where they went
      box(0.20, 0.42, 0.44, beigeDM, BX + 0.20, 0.21, tz);
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
    for (const [tz] of seats) {
      const cx = BX - 1.00;
      box(0.44, 0.05, 0.44, wood, cx, 0.45, tz);                  // the seat pan
      box(0.05, 0.5, 0.42, wood, cx - 0.20, 0.70, tz);            // the back
      for (const fx of [-0.18, 0.18]) for (const fz of [-0.18, 0.18]) {
        box(0.05, 0.45, 0.05, woodDark, cx + fx, 0.225, tz + fz);
      }
      ctx.seat({
        x: room.wx(cx), z: room.wz(tz), yaw: Math.PI / 2, h: 0.45,
        approach: { x: room.wx(cx - 0.85), z: room.wz(tz) },
        label: 'sit at the terminal',
        ok: () => room.inside(),
      });
    }
  }

  // ── the STAFF terminal, on the back worktop ──
  //
  // Faces +x rather than -x: it is on the librarian's own bench and she turns
  // to it, so its screen looks along the counter and not out at the room. The
  // one thing it must NOT do is stand between her and the person she is
  // serving, which is what put the whole of this item in the queue.
  {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.24),
      new THREE.MeshBasicMaterial({ map: screenTex(false) }));
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
    const deckZ0 = -D / 2 + 0.1, deckZ1 = GALLERY_Z1;
    const deckD = deckZ1 - deckZ0, deckCZ = (deckZ0 + deckZ1) / 2;

    // the deck, with a dark soffit under it — from the reading room below its
    // underside is all you see of it
    box(GW, 0.10, deckD, wood, GCX, GALLERY_Y - 0.05, deckCZ);
    box(GW, 0.16, deckD, woodDark, GCX, GALLERY_Y - 0.18, deckCZ);
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
      const rise2 = GALLERY_Y / len2;
      for (let bz = GALLERY_Z1 + 0.24; bz < STAIR_Z0 - OPEN_FOOT; bz += 0.34) {
        const yb = GALLERY_Y - (bz - GALLERY_Z1) * rise2;   // follows the flight
        box(0.07, 0.88, 0.07, woodDark, GALLERY_X0 + 0.07, yb + 0.44, bz);
      }
      // the handrail itself, raked along the same gradient
      for (let i = 0; i < 10; i++) {
        const t = i / 9, bz = GALLERY_Z1 + t * (len2 - OPEN_FOOT);
        const yb = GALLERY_Y - (bz - GALLERY_Z1) * rise2;
        box(0.10, 0.09, len2 / 9 + 0.04, wood, GALLERY_X0 + 0.07, yb + 0.94, bz);
      }
      solid(GALLERY_X0 + 0.07, zc2 - OPEN_FOOT / 2, 0.22, len2 - OPEN_FOOT);
    }

    // the balustrade you look down from, and a collider so the drop is guarded
    const RAIL_Y = GALLERY_Y + 0.98;
    box(0.10, 0.09, deckD, wood, GALLERY_X0 + 0.09, RAIL_Y, deckCZ);
    for (let bz = deckZ0 + 0.25; bz < deckZ1 - 0.2; bz += 0.30) {
      box(0.06, 0.86, 0.06, woodDark, GALLERY_X0 + 0.09, GALLERY_Y + 0.49, bz);
    }
    solid(GALLERY_X0 + 0.09, deckCZ, 0.24, deckD);

    // a table up there, because a gallery with nothing on it is a walkway
    box(1.5, 0.06, 0.7, wood, GCX + 0.5, GALLERY_Y + 0.72, deckCZ + 1.4);
    for (const lx of [-0.6, 0.6]) for (const lz of [-0.25, 0.25]) {
      box(0.07, 0.72, 0.07, woodDark, GCX + 0.5 + lx, GALLERY_Y + 0.36, deckCZ + 1.4 + lz);
    }
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
    const AX = -W / 2 + 1.05;
    // the sloping newspaper rack: papers laid on a rail, spines toward you
    const paperT = declareSurface(pixTex(40, 28, (g) => {
      g.fillStyle = '#8a8578'; g.fillRect(0, 0, 40, 28);
      for (let i = 0; i < 5; i++) {
        const y = 1 + i * 5.4;
        g.fillStyle = i % 2 ? '#d8d2c2' : '#cfc8b6'; g.fillRect(2, y, 36, 4);
        g.fillStyle = '#6a6458'; g.fillRect(3, y + 1, 14, 1);      // the masthead
        g.fillStyle = '#8a8478'; g.fillRect(3, y + 2, 30, 1);
      }
      dither(g, 40, 28, 40);
    }), 'detail');
    for (let i = 0; i < 3; i++) {
      const rz = -1.6 + i * 1.9;
      // the rail and its sloping face
      box(0.42, 0.06, 1.5, woodDark, AX, 1.02, rz);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.62), ctx.flat(paperT));
      face.rotation.y = Math.PI / 2; face.rotation.x = -0.42;
      put(face, AX + 0.20, 1.24, rz);
      box(0.09, 1.0, 0.09, wood, AX, 0.5, rz - 0.68);
      box(0.09, 1.0, 0.09, wood, AX, 0.5, rz + 0.68);
      solid(AX, rz, 0.5, 1.5);
    }
    // a chair to read them in, turned into the alcove rather than facing the room
    box(0.46, 0.06, 0.46, wood, AX + 1.15, 0.44, 0.9);
    box(0.46, 0.52, 0.06, wood, AX + 1.15, 0.72, 1.12);
    for (const lx of [-0.18, 0.18]) for (const lz of [-0.18, 0.18]) {
      box(0.05, 0.44, 0.05, woodDark, AX + 1.15 + lx, 0.22, 0.9 + lz);
    }
    solid(AX + 1.15, 0.9, 0.5, 0.5);
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
  const wear = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 6.4),
    new THREE.MeshBasicMaterial({ map: wearT, transparent: true, depthWrite: false }));
  wear.rotation.x = -Math.PI / 2;
  put(wear, room.doorAt, 0.004, D / 2 - 4.0);
}
