import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import { buildRoom } from './interior';
import { type DoorDecl } from './doors';

// PVBLIC LIBRARY, inside.
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

export const DOOR: DoorDecl = {
  building: 'LIBRARY', w: 16, cz: -13, side: -1, at: 0, width: 1.6,
  face: { x: XF - 0.8, z: DOOR_Z, nx: 1, nz: 0 },
};

export function buildLibrary(ctx: CtxBuild): void {
  const room = buildRoom(ctx, {
    id: 'library',
    label: 'into the PVBLIC LIBRARY',
    d: 11.0,
    // 3.6 m. The one number that does the most work in here: it is what stops
    // a room this size reading as a shop unit with shelves in it.
    h: 3.6,
    palette: {
      floor: 0x6f7a63,      // green-grey lino, the municipal default
      wall: 0xc9c0a8,       // cream distemper
      ceil: 0xcdc8bb,
      trim: 0x5a4632,       // dark stained oak
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
  const zBack = -D / 2 + 1.3, zFront = D / 2 - 4.6;
  for (let i = 0; i < 4; i++) stack(-W / 2 + 2.4 + i * 2.15, zBack, zFront, 0x2a01 + i * 131);

  // ── THE ISSUE DESK ───────────────────────────────────────────────────────
  //
  // Between the door and the stacks, turned so the librarian faces whoever
  // comes in. Its front is a solid panel to the floor: a counter you can see
  // the librarian's knees under is a shop counter, not a civic one.
  const DESK_X = W / 2 - 2.9, DESK_Z = D / 2 - 2.5;
  box(2.9, 1.06, 0.72, wood, DESK_X, 0.53, DESK_Z);
  box(3.0, 0.06, 0.82, woodDark, DESK_X, 1.09, DESK_Z);                 // the worn top
  box(0.5, 0.16, 0.34, woodDark, DESK_X - 0.9, 1.20, DESK_Z);           // date stamp block
  box(0.34, 0.10, 0.26, metal, DESK_X + 0.6, 1.17, DESK_Z);             // a wire tray
  box(0.30, 0.08, 0.24, metal, DESK_X + 0.6, 1.27, DESK_Z);
  solid(DESK_X, DESK_Z, 3.0, 0.9);

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
  const TAB_X = W / 2 - 3.0, TAB_Z = -D / 2 + 3.2;
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
  room.person({
    jacket: '#5a6470', pants: '#3f4450', skin: '#c9a184', hair: '#6b5236',
    fit: 'plain', cut: 'short', build: 0,
  }, DESK_X, DESK_Z - 0.75, { facing: Math.PI, h: 0.97, w: 0.95 });

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

  // the clock, high on the back wall where a civic room always puts it
  const clockT = declareSurface(pixTex(24, 24, (g) => {
    g.fillStyle = '#3a352c'; g.fillRect(0, 0, 24, 24);
    g.fillStyle = '#e8e4d6'; g.fillRect(2, 2, 20, 20);
    g.fillStyle = '#3a352c';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.fillRect(12 + Math.round(Math.sin(a) * 8), 12 - Math.round(Math.cos(a) * 8), 1, 1);
    }
    g.fillRect(12, 6, 1, 7); g.fillRect(12, 12, 5, 1);
  }), 'sign');
  const clock = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42),
    new THREE.MeshBasicMaterial({ map: clockT }));
  put(clock, 0, 2.6, -D / 2 + 0.06);

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
