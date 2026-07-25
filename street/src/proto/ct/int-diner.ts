import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither } from './paint';
import { buildRoom } from './interior';
import { type DoorDecl } from './doors';

// The DINER, inside.
//
// This is the REFERENCE interior — the first room built on `ct/interior.ts`,
// and the worked example the other nine are meant to be read against. If you
// are building one of the others, copy the shape of this file: take the shell
// from `buildRoom`, furnish in LOCAL coordinates, register your colliders
// through `room.solid`, and never touch `crosstown.ts`.
//
// What makes a diner a diner, and none of it is the food: a long counter with
// stools bolted to the floor, booths under the window, a checker floor, and
// the back-bar wall of machines behind the counter that the customer never
// touches. Get those four and it reads instantly; miss the counter and it is
// just a room with tables.
//
// WHERE IT IS is no longer written down here at all.
//
// This file used to carry `DZ`, a hand-typed world z for the door. It was
// wrong twice: once when D moved the DINER across the alley and the prompt
// ended up outside a bank, and again when A's frontage descriptor moved the
// painted door 4.8 m along the shopfront. A constant cannot know either of
// those happened.
//
// The room now names its building and the kit reads `frontageOf()` — the one
// authority the painter also draws from. The door, its width, the glazing, the
// [E] spot on the pavement and the spot you step back out onto all come from
// there. The only facts left in this file are which building it is and how
// wide, and those come out of D's roster.
/**
 * WHERE THIS ROOM'S DOOR IS. Declared here, in the local terms the room is
 * actually laid out around, and the FACADE follows it — `ct/doors.ts` explains
 * why that direction and not the other one.
 *
 * `at` is the number this room was built against: the counter, the seating and
 * the walking route are all placed relative to it. Changing it moves the
 * painted shopfront door to match, not the other way round.
 */
export const DOOR: DoorDecl = {
  building: 'DINER', w: 12, cz: -49.5, side: -1, at: -2.6, width: 1.15,
};

export function buildDiner(ctx: CtxBuild): void {
  const room = buildRoom(ctx, {
    id: 'diner',
    label: 'into the DINER',
    // width comes from the frontage — a diner with a longer counter is a
    // better diner, and an 8.6 m room behind a 12 m front is a false front
    d: 7.0, h: 3.0,
    palette: { floor: 0xb0a996, wall: 0xc4bca8, ceil: 0xbdb6a4, trim: 0x4a3a2a },
    frontage: { name: 'DINER', w: 12, cz: -49.5, side: -1 },
    // door, width, the [E] spot on the street and the way back out are all
    // derived from that — see RoomSpec.frontage. Nothing here is typed twice.
    door: { r: 1.05, at: DOOR.at, width: DOOR.width },
  });

  const { put, solid } = room;
  const hw = room.W / 2, hd = room.D / 2;

  // ── the checker floor ──
  //
  // Laid over the kit's plain lino rather than replacing it: the kit sizes its
  // texture off the room's real metres and this has to agree with that, or the
  // tiles stop being square (GOTCHAS §5).
  const checkT = pixTex(32, 32, (g) => {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      g.fillStyle = (x + y) % 2 ? '#2e2c2a' : '#cec6b4';
      g.fillRect(x * 16, y * 16, 16, 16);
    }
    dither(g, 32, 32, 24);
  });
  checkT.wrapS = checkT.wrapT = THREE.RepeatWrapping;
  checkT.repeat.set(Math.round(room.W / 1.2), Math.round(room.D / 1.2));
  const chk = new THREE.Mesh(new THREE.PlaneGeometry(room.W, room.D), ctx.flat(checkT));
  chk.rotation.x = -Math.PI / 2;
  put(chk, 0, 0.012, 0);

  // ── the counter ──
  //
  // Runs along the back, 0.62 m deep with a 0.28 m overhang you can get your
  // knees under. The overhang is the difference between a counter and a wall
  // with a shelf on it.
  const CZ = -hd + 1.5, CL = 7.8;
  const formicaT = pixTex(64, 16, (g) => {
    g.fillStyle = '#c8bfa4'; g.fillRect(0, 0, 64, 16);
    g.fillStyle = 'rgba(90,70,50,0.25)';
    for (let i = 0; i < 90; i++) g.fillRect(Math.floor(Math.random() * 64), Math.floor(Math.random() * 16), 1, 1);
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(0, 0, 64, 2);
  });
  // The speckle is the same boiled-wheat formica on the counter and on the
  // tables, so it has to be the same SIZE on both. Left unrepeated it was one
  // tile stretched over whatever it landed on: 10 px/m across a 6.4 m counter
  // and 55 px/m across a 1.15 m table, which is why the tables looked strewn
  // with crumbs next to a counter that looked clean (GOTCHAS §5).
  const FORMICA_M = 5.0, FORMICA_D = 1.25;   // what one 64×16 tile covers
  const formicaFor = (wM: number, dM: number) => {
    const t = formicaT.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(wM / FORMICA_M, dM / FORMICA_D);
    t.needsUpdate = true;
    return ctx.flat(t);
  };
  const sideT = pixTex(64, 32, (g) => {
    g.fillStyle = '#9a2f2c'; g.fillRect(0, 0, 64, 32);           // red vinyl skirt
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 1, 32);      // ribbed panels
    g.fillStyle = '#cfc7b6'; g.fillRect(0, 28, 64, 4);            // chrome kick rail
    dither(g, 64, 32, 30);
  });
  const chromeM = new THREE.MeshBasicMaterial({ color: 0xcfc7b6 });
  const topM = formicaFor(CL, 0.62), skirtM = ctx.flat(sideT);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(CL, 1.02, 0.62),
    [skirtM, skirtM, topM, skirtM, skirtM, skirtM]);
  put(counter, 0, 0.51, CZ);
  solid(0, CZ, CL, 0.62);
  // the overhang, and the chrome edge under it
  const lip = new THREE.Mesh(new THREE.BoxGeometry(CL, 0.06, 0.28), formicaFor(CL, 0.28));
  put(lip, 0, 0.99, CZ + 0.45);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(CL, 0.05, 0.06), chromeM);
  put(edge, 0, 0.955, CZ + 0.59);

  // stools: bolted down, so a fixed pitch and no two at odd angles
  const stoolTopM = new THREE.MeshBasicMaterial({ color: 0x9a2f2c });
  const STOOLS = 7;   // one more than the old 9.2 m room could hold
  for (let i = 0; i < STOOLS; i++) {
    const sx = -CL / 2 + 0.55 + i * ((CL - 1.1) / (STOOLS - 1));
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.66, 6), chromeM);
    put(post, sx, 0.33, CZ + 1.0);
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.1, 10), stoolTopM);
    put(seat, sx, 0.71, CZ + 1.0);
    solid(sx, CZ + 1.0, 0.34, 0.34);
    // …and you can sit on it. Facing −z, which is the counter: the whole
    // point of a counter stool is that it aims you at the back bar.
    ctx.seat({
      x: room.wx(sx), z: room.wz(CZ + 1.0), yaw: 0, h: 0.71, r: 0.62,
      ok: room.inside, label: 'sit at the counter',
    });
  }

  // ── the back bar ──
  //
  // Everything the customer never touches, stacked against the back wall: pie
  // case, urns, the pass to the kitchen. It is what you look AT while you eat,
  // so it carries most of the room's detail.
  const backT = pixTex(96, 40, (g) => {
    g.fillStyle = '#8f8a7c'; g.fillRect(0, 0, 96, 40);
    g.fillStyle = '#cfc7b6'; g.fillRect(0, 16, 96, 3);            // shelf
    g.fillStyle = '#2a2c30';                                       // coffee urns
    for (const x of [8, 20]) { g.fillRect(x, 4, 9, 12); g.fillStyle = '#cfc7b6'; g.fillRect(x + 2, 12, 5, 2); g.fillStyle = '#2a2c30'; }
    g.fillStyle = '#b8342a'; g.fillRect(36, 6, 7, 10);             // ketchup row
    g.fillStyle = '#d8c84a'; g.fillRect(45, 6, 7, 10);
    g.fillStyle = '#3a4650'; g.fillRect(60, 2, 30, 14);            // the pass
    g.fillStyle = '#d8a02a'; g.fillRect(63, 5, 24, 8);             // heat lamp glow
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(60, 2, 30, 1);
    g.fillStyle = '#6a6256'; g.fillRect(0, 19, 96, 21);            // cupboards under
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let x = 0; x < 96; x += 16) g.fillRect(x, 19, 1, 21);
    dither(g, 96, 40, 40);
  });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(CL, 2.2), ctx.flat(backT));
  put(back, 0, 1.35, -hd + 0.05);

  // pie case on the counter — the one thing at eye level, so it gets to be
  // the brightest object in the room
  const pieT = pixTex(24, 24, (g) => {
    g.fillStyle = 'rgba(190,215,225,0.35)'; g.fillRect(0, 0, 24, 24);
    g.fillStyle = '#cfc7b6'; g.fillRect(0, 0, 24, 2); g.fillRect(0, 22, 24, 2);
    g.fillStyle = '#cfc7b6'; g.fillRect(0, 11, 24, 2);
    g.fillStyle = '#c98a3a'; g.fillRect(3, 5, 8, 6);               // pie
    g.fillStyle = '#8a3a4a'; g.fillRect(13, 5, 8, 6);
    g.fillStyle = '#d8c8a0'; g.fillRect(3, 16, 8, 5);
    g.fillStyle = '#6a4a2a'; g.fillRect(13, 16, 8, 5);
  });
  const pie = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.5),
    new THREE.MeshBasicMaterial({ map: pieT, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  put(pie, CL / 2 - 0.7, 1.3, CZ);

  // ── the bank of booths under the window ──
  //
  // A booth seats two a side: a 1.35 m bench and a table you can reach across.
  // The first pass built them 2.4 m wide with a 2.2 × 1.1 m table, which is a
  // boardroom, and next to a 1.15 m door the whole room read as built for
  // giants. Right-sized, three of them fit the window where two sprawled —
  // and three is what makes it a diner rather than a room with tables in it.
  const vinylM = new THREE.MeshBasicMaterial({ color: 0x7a2a28 });

  // ── the booth run, along the window ──
  //
  // The user: *"the booths should be perpendicular to the wall and line the
  // window like a regular diner anywhere you go."* They were islands standing
  // in the middle of the floor, which is a restaurant, not a diner.
  //
  // A real window booth run is one continuous bank: each BENCH is long and
  // points away from the glass, the two benches of a booth sit either side of
  // a table so you face your companion ACROSS the room's width with the window
  // at your shoulder, and adjacent booths are back to back — booth n's far
  // bench and booth n+1's near bench share a divider. The run lines the whole
  // window, and the aisle is what is left between it and the counter. Counter
  // down one side, booths down the other, aisle between: that is the plan of
  // every diner there has ever been.
  const BENCH_W = 0.55;            // across the room — how wide you sit
  const BENCH_L = 1.5;             // away from the window — how long the seat is
  const TABLE_W = 0.76;            // the gap between two benches of one booth
  const BACK_T = 0.12;
  const HALF = TABLE_W / 2 + BENCH_W;                 // booth centre to bench outer
  const PITCH = 2 * HALF + BACK_T;                    // back-to-back neighbours
  // benches sit against the glass, their aisle end pointing into the room
  const BZ = hd - 0.2 - BENCH_L / 2;

  // The run starts clear of the DOOR and fills to the far wall, because the
  // door is in this same wall — wherever the facade has put it. Laid out
  // against a remembered position the bank ended up standing across the
  // doorway once already.
  const away = room.doorAt > 0 ? -1 : 1;
  const runStart = room.doorAt + away * (1.15 / 2 + 0.9);   // clear of the opening
  const wallEnd = away * (hw - 0.25);
  const span = Math.abs(wallEnd - runStart);
  const nBooths = Math.max(1, Math.floor((span - BACK_T) / PITCH));
  const BXS = Array.from({ length: nBooths }, (_, i) => runStart + away * (HALF + BACK_T / 2 + i * PITCH));

  const napkinT = pixTex(8, 8, (g) => {
    g.fillStyle = '#cfc7b6'; g.fillRect(0, 0, 8, 8);
    g.fillStyle = '#9aa0a6'; g.fillRect(0, 0, 8, 2);
  });
  for (const bx of BXS) {
    for (const sx of [-1, 1]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(BENCH_W, 0.45, BENCH_L), vinylM);
      put(bench, bx + sx * (TABLE_W / 2 + BENCH_W / 2), 0.225, BZ);
      // the back is on the OUTER side of each bench: that face is the divider
      // the neighbouring booth sits against
      const backr = new THREE.Mesh(new THREE.BoxGeometry(BACK_T, 0.62, BENCH_L), vinylM);
      put(backr, bx + sx * (HALF + BACK_T / 2), 0.76, BZ);
      // …and you can sit on it, facing your companion across the table
      ctx.seat({
        x: room.wx(bx + sx * (TABLE_W / 2 + BENCH_W / 2)),
        z: room.wz(BZ - BENCH_L / 2 + 0.45),        // the aisle end, where you get in
        yaw: sx < 0 ? Math.PI / 2 : -Math.PI / 2,   // across the table
        h: 0.45, r: 0.85, ok: room.inside, label: 'take a booth seat',
      });
    }
    const tbl = new THREE.Mesh(new THREE.BoxGeometry(TABLE_W, 0.07, BENCH_L - 0.25), formicaFor(TABLE_W, BENCH_L - 0.25));
    put(tbl, bx, 0.74, BZ);
    const tEdge = new THREE.Mesh(new THREE.BoxGeometry(TABLE_W + 0.04, 0.04, BENCH_L - 0.21), chromeM);
    put(tEdge, bx, 0.705, BZ);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.72, 0.09), chromeM);
    put(leg, bx, 0.36, BZ);
    // a napkin dispenser and a ketchup bottle, against the window end of the
    // table where they live in every diner
    const nap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.1), ctx.flat(napkinT));
    put(nap, bx - 0.16, 0.83, BZ + BENCH_L / 2 - 0.35);
    const ket = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.19, 6),
      new THREE.MeshBasicMaterial({ color: 0xb8342a }));
    put(ket, bx + 0.14, 0.87, BZ + BENCH_L / 2 - 0.35);
  }
  // ONE collider for the whole bank. The dividers are back to back with no gap
  // at all, so boxing benches separately would only build slots too narrow to
  // stand in and too deep to shuffle out of.
  const runLo = Math.min(BXS[0], BXS[BXS.length - 1]) - HALF - BACK_T / 2;
  const runHi = Math.max(BXS[0], BXS[BXS.length - 1]) + HALF + BACK_T / 2;
  solid((runLo + runHi) / 2, BZ, runHi - runLo, BENCH_L + BACK_T);

  // ── the menu board, over the pass ──
  const menuT = pixTex(96, 32, (g) => {
    g.fillStyle = '#22262a'; g.fillRect(0, 0, 96, 32);
    g.fillStyle = '#d8d0b8'; g.font = 'bold 7px monospace'; g.textAlign = 'left';
    const rows: [string, string][] = [
      ['EGGS ANY STYLE', '2.25'], ['BURGER PLATTER', '3.75'],
      ['COFFEE', '.65'], ['PIE  SLICE', '1.40'],
    ];
    rows.forEach(([a, b], i) => { g.fillText(a, 4, 8 + i * 7); g.textAlign = 'right'; g.fillText(b, 92, 8 + i * 7); g.textAlign = 'left'; });
  });
  const menu = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.0), ctx.flat(menuT));
  put(menu, 0, 2.45, -hd + 0.06);

  // ── the waitress, behind the counter ──
  //
  // From the citizen atlas, like everyone on the street. She used to be one
  // hand-painted front view on a plane, and because this is the REFERENCE
  // interior every room built after her copied that — so "the people inside
  // these places are always flat and not like the people on the street" is a
  // complaint that starts here. She turns through eight painted views now.
  //
  // Green uniform dress with a pale apron over it, hair up: the same person,
  // described to the atlas instead of drawn by hand. `ct/citizens.ts` is H's
  // and has no apron option yet, so the apron is the accent colour — close
  // enough that she reads right, and worth asking H for properly.
  room.person({
    jacket: '#4a7a6a', pants: '#3a5a50', skin: '#b8845a', hair: '#5a3a22',
    fit: 'dress', accent: '#d8d4c8', cut: 'tied', build: -1,
  }, -1.4, CZ - 0.55, { facing: Math.PI, h: 0.97, w: 0.95 });

}
