import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import { buildRoom } from './interior';
import { type DoorDecl } from './doors';
import { JAIL, JAIL_DOOR } from './jail';

// ── INSIDE THE HOUSE OF DETENTION ─────────────────────────────────────────
//
// The outside is `ct/jail.ts`. This is the room, and the split is required
// rather than chosen: `ct/doors.ts:146` collects door declarations from a glob
// of `./int-*.ts` and nothing else — a `DOOR` declared in `jail.ts` would be
// dropped silently — and `scripts/world-wired.mjs:123` fails on a room id with
// no matching `int-<id>.ts`. Same shape as G's `vice.ts` / `int-casino.ts`.
//
// ── WHAT THIS ROOM IS FOR ────────────────────────────────────────────────
//
// The queue named the thing worth building: *"the interesting part of a jail
// is the threshold between the public half and the locked half; build that."*
//
// So the room is a SEQUENCE, not a box with furniture in it. Walking its
// length you are told three times that you are on the wrong side of something:
//
//   lz +13 … +6    THE LOBBY        public. A bench, a board, a payphone, a
//                                   clock, and somebody who has been waiting
//   lz  +6 … +4    THE COUNTER      glazed to the ceiling, a speak-hole, a
//                                   hatch. You talk through it, not over it
//   lz  +4 … -13   THE CELL BLOCK   a corridor with cells down one side, bars
//                                   you can look through, and one man in one
//                                   of them
//
// ── GOTCHAS 45, which decides the plan ───────────────────────────────────
//
// *"'match the exterior' means WHICH SIDE THE DOOR IS ON — not the
// dimensions… Take the room you need."* The door outside is dead centre of a
// 14 m frontage, on the side street's own centre line, so it is dead centre of
// the front wall in here (`at: 0`). Nothing else about the outside constrains
// this room, and the kit gives every interior its own 80 m slab at x >= 400.
//
// The width is still pinned, and not by the facade: the user's rule, which the
// casino was sent back for breaking — *"KEEP THE FRONTAGE WIDTH, GROW THE
// DEPTH, hard"*. 12.8 m is `roomWidthFor(14)`, the kit's own answer for a 14 m
// frontage. The depth is where the room is allowed to be a jail.

/**
 * WHERE THE DOOR IS — a world POINT and an OUTWARD NORMAL, which is the general
 * form `ct/doors.ts` takes and what `ct/int-casino.ts` uses for the same
 * reason: this building fronts no roster axis, so "signed metres along the
 * frontage" cannot describe it.
 *
 * Every number comes from `JAIL_DOOR` in `ct/jail.ts`, which is itself checked
 * against `ctx.site('jail')` at build time. Nothing here is typed twice: the
 * two-authorings fault is what put a single-leaf door in a double-door casino
 * and a diner's prompt outside a bank.
 */
export const DOOR: DoorDecl = {
  building: 'JAIL', w: JAIL.Z_N - JAIL.Z_S, cz: JAIL_DOOR.z, side: 1, at: 0,
  // WHAT THE DOOR IS, not only where. The facade builds a 2.4 m steel double
  // leaf with no glazing; without this the kit would give the room a 1.10 m
  // timber door with a vision panel, which is exactly the disagreement the
  // user reported on the casino — *"the interior door doesnt match the
  // exterior doorway"*.
  leaf: {
    clearW: JAIL.DOOR_W, h: JAIL.DOOR_H, leaves: 2,
    frame: { colour: 0x3a3c40, material: 'steel' }, glazing: 'none',
  },
  face: { x: JAIL_DOOR.x, z: JAIL_DOOR.z, nx: JAIL_DOOR.nx, nz: JAIL_DOOR.nz },
};

/** where you stand to use it. Derived here rather than fetched from the
 *  registry with `doorStandFor`, because that is a RUNTIME import of
 *  `./doors`, and a runtime edge back to that module is what dropped SEVENS'
 *  door from the built bundle (GOTCHAS §28). `ct/int-casino.ts` does the same
 *  and says the same. */
const standOf = (d: DoorDecl, standoff = 0.75) =>
  ({ x: d.face!.x + d.face!.nx * standoff, z: d.face!.z + d.face!.nz * standoff });

// ── the palette ───────────────────────────────────────────────────────────
//
// Institutional green to the waist, magnolia gone grey above, a floor that has
// been mopped more often than it has been cleaned. Nothing here is a choice
// anybody made; it is what the budget bought in about 1974 and nobody has been
// given money to change since.
const P = {
  floor: 0x6d6a62,
  wall: 0xa8a595,
  ceil: 0x9c9a8c,
  trim: 0x4a5a4c,
  tile: 0x5c6f5e,          // the dado
  grout: 0x8a8a7c,
};

export function buildJail(ctx: CtxBuild): void {
  const room = buildRoom(ctx, {
    id: 'jail',
    building: 'JAIL',                 // finds the DoorLeaf declared above
    label: 'into the HOUSE OF DETENTION',
    // 12.8 is the kit's `roomWidthFor(14)` — the frontage, kept. 26 m of depth
    // is where the cell block goes, and the kit's slab is 80 m so it costs
    // nothing. 3.3 m of height because a civic lobby ECHOES: it is the
    // opposite decision to the casino's low ceiling and made for the same
    // reason, that height is psychology rather than volume.
    w: 12.8, d: 26.0, h: 3.3,
    palette: { floor: P.floor, wall: P.wall, ceil: P.ceil, trim: P.trim },
    // Tiled to the waist. The kit's own note: a commercial room that is
    // plaster to the floor reads as a bedroom, and there is no building type
    // more tiled-to-the-waist than this one.
    wainscot: { h: 1.35, tile: 0.32, face: P.tile, grout: P.grout },
    // A recessed fluorescent tray, and ONE OF THEM IS OUT. `ct/interior.ts:369`
    // put it best: *"a room where every light works is a room that has a
    // facilities budget, which is a thing some of these places conspicuously
    // do not have."* This is that room.
    light: { kind: 'troffer', tint: 0xdfe4d8, count: 8, dead: [2, 5] },
    door: {
      // From the DECLARATION, never typed again beside it.
      ...standOf(DOOR), r: 1.05,
      at: 0,
      // no `width`: the kit takes the opening from the declared leaf, and
      // typing it here is how a room ends up overriding its own building.
      //
      // STEPPING OUT lands 2.2 m NORTH along the pavement, not back from the
      // door. A spot's REACH is not its radius — `fp.ts` adds REACH_MARGIN =
      // 0.6 on top of r, so this r 1.05 way-in spot is live out to 1.65 m, and
      // landing inside it means E-to-leave immediately offers E-to-enter and a
      // second press bounces you back inside. That fault is written up in
      // `ct/int-casino.ts` and `ct/int-hotel.ts`; this is the same fix.
      // hypot(0.25, 2.2) = 2.21 m, clear by 0.56.
      //
      // And it lands ON THE PAVEMENT, not in the road: the walk here runs
      // x 55.0…56.88, so x = 56.0 is 1.0 m clear of the kerb and 0.88 m clear
      // of the building. Facing west, down the length of the street.
      outX: 56.0, outZ: JAIL_DOOR.z + 2.2, outYaw: -Math.PI / 2, outGy: ctx.KERB_H,
    },
    // NO WINDOW, and it is the one room in the world where that needs no
    // excuse. The elevation outside gives the street two barred slots 3 m up
    // and nothing else; a shopfront window here would contradict the building.
  });

  const { put, solid } = room;
  const hw = room.W / 2, hd = room.D / 2;

  // ── the floor: composition tile, with the pattern walked off it ─────────
  //
  // The one detail that says how many people have crossed this room. The path
  // from the door to the counter is worn pale and the corners are not — which
  // is a fact about the building, not a texture effect, so it is painted as a
  // band down the middle rather than as noise everywhere.
  const FLOOR_PPM = 24;
  const fw = Math.round(room.W * FLOOR_PPM), fd = Math.round(room.D * FLOOR_PPM);
  const floorT = declareSurface(pixTex(fw, fd, (g) => {
    g.fillStyle = '#6d6a62'; g.fillRect(0, 0, fw, fd);
    const T = Math.round(0.3 * FLOOR_PPM);          // 12-inch composition tile
    for (let y = 0; y < fd; y += T) for (let x = 0; x < fw; x += T) {
      const v = Math.random();
      g.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.02 + v * 0.10})`
                            : `rgba(255,255,255,${(v - 0.5) * 0.09})`;
      g.fillRect(x, y, T - 1, T - 1);
    }
    g.fillStyle = 'rgba(0,0,0,0.20)';
    for (let y = 0; y <= fd; y += T) g.fillRect(0, y, fw, 1);
    for (let x = 0; x <= fw; x += T) g.fillRect(x, 0, 1, fd);
    // the traffic lane, worn pale, down the centre from the door to the counter
    for (let i = 0; i < fw * fd * 0.05; i++) {
      const x = fw / 2 + (Math.random() - 0.5) * fw * 0.28;
      const y = fd * (0.5 + Math.random() * 0.5);
      g.fillStyle = `rgba(226,222,206,${0.03 + Math.random() * 0.10})`;
      g.fillRect(x, y, 1, 1);
    }
    dither(g, fw, fd, Math.round(fw * fd * 0.02));
  }), 'ground');
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.W, room.D), ctx.flat(floorT));
  floor.rotation.x = -Math.PI / 2;
  put(floor, 0, 0.012, 0);

  // ── the lobby ───────────────────────────────────────────────────────────
  //
  // Built to be unpleasant to wait in, which is a design brief and not an
  // apology: every object here is bolted down, wipe-clean, or behind glass.
  const BENCH_Y = 0.46;                 // the seat top. `notes/H-seated-sprite.md`
                                        // measured 48 of the world's seats at
                                        // this height, and a sitter's origin is
                                        // the hip — so this number has to be the
                                        // one the sprite is placed at.
  const woodT = declareSurface(pixTex(64, 16, (g) => {
    g.fillStyle = '#6a5a44'; g.fillRect(0, 0, 64, 16);
    for (let i = 0; i < 5; i++) {
      const y = i * 3 + 1;
      g.fillStyle = `rgba(0,0,0,${0.10 + Math.random() * 0.10})`;
      g.fillRect(0, y, 64, 1);
    }
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * 64, y = Math.random() * 16;
      g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,240,210,0.07)';
      g.fillRect(x, y, 2, 1);
    }
  }), 'detail');
  const woodM = ctx.flat(woodT);
  const legM = new THREE.MeshBasicMaterial({ color: 0x4a4c4a });
  /** a bolted-down bench: slat seat, no back, cast legs. Against a wall, so
   *  the front is the side that faces the room — derived from which wall it is
   *  on, never copied from a sibling (GOTCHAS §33). */
  const bench = (lx: number, lz: number, len: number, along: 'x' | 'z') => {
    const w = along === 'x' ? len : 0.42, d = along === 'x' ? 0.42 : len;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, d), woodM);
    put(seat, lx, BENCH_Y, lz);
    const n = Math.max(2, Math.round(len / 1.6));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5;
      const px = along === 'x' ? lx + t * len : lx;
      const pz = along === 'x' ? lz : lz + t * len;
      put(new THREE.Mesh(new THREE.BoxGeometry(0.07, BENCH_Y - 0.04, 0.30), legM), px, (BENCH_Y - 0.04) / 2, pz);
    }
    solid(lx, lz, w + 0.1, d + 0.1);
    return { y: BENCH_Y };
  };
  bench(-hw + 0.42, hd - 4.2, 4.6, 'z');
  bench(hw - 0.42, hd - 4.2, 4.6, 'z');

  // SOMEBODY WHO HAS BEEN WAITING. Not a criminal — this is the public half of
  // the building, and the person who is actually in a jail lobby at two in the
  // afternoon is somebody's mother with her coat still on. One figure does
  // more for this room than every bar in the cell block.
  //
  // `seated: true` is a field on the LOOK, and the origin moves with the pose:
  // standing is the painted shoe and goes on the floor, seated is the hip and
  // goes on THE SEAT TOP. `citizenPlane` owns that offset — if this ever needs
  // a y fudge the atlas is wrong and it goes to H (`notes/H-seated-sprite.md`).
  room.person(
    { jacket: '#4a4038', pants: '#3a3630', skin: '#8d5a34', hair: '#2a2018',
      fit: 'coat', cut: 'tied', build: 0, stride: 2, seated: true },
    -hw + 0.42, hd - 3.0,
    // facing ACROSS the room toward the counter, which is what you look at
    // when you are waiting to be called. Derived from the thing she faces.
    { facing: Math.PI / 2, seated: true, y: BENCH_Y },
  );

  // ── the notice board ────────────────────────────────────────────────────
  //
  // Nothing on it is legible and everything on it is old. Bail bond cards, a
  // missing notice, a court list nobody has taken down.
  const boardT = declareSurface(pixTex(88, 60, (g) => {
    g.fillStyle = '#4a4436'; g.fillRect(0, 0, 88, 60);
    g.fillStyle = '#3a3528'; g.fillRect(2, 2, 84, 56);
    const notice = (x: number, y: number, w: number, h: number, tilt: number, tint: string) => {
      g.save(); g.translate(x, y); g.rotate(tilt);
      g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(1, 1, w, h);
      g.fillStyle = tint; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(60,55,45,0.55)';
      for (let r = 3; r < h - 2; r += 3) g.fillRect(2, r, w - 4 - (r % 6 ? 0 : 5), 1);
      g.restore();
    };
    notice(7, 6, 24, 30, -0.04, '#d8d2bc');
    notice(36, 9, 20, 26, 0.05, '#cfc9b2');
    notice(60, 5, 22, 18, -0.02, '#dcd4b8');
    notice(58, 28, 24, 26, 0.03, '#c8c2ae');
    notice(9, 39, 20, 15, 0.06, '#d2ccb4');
    notice(33, 38, 20, 17, -0.05, '#bfb9a4');
    dither(g, 88, 60, 180);
  }), 'sign');
  {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 1.2), ctx.flat(boardT));
    b.rotation.y = -Math.PI / 2;                    // faces −x… see below
    put(b, hw - 0.06, 1.85, hd - 2.2);
    // ON THE +x WALL, so it must look back toward −x. A board hung facing the
    // wall it is screwed to is the commonest version of GOTCHAS §33 in an
    // interior, and it is invisible in a screenshot taken from the other side.
    b.rotation.y = -Math.PI / 2;
  }

  // ── the clock ───────────────────────────────────────────────────────────
  //
  // Through the kit, not hand-rolled. The user asked for this by name — *"make
  // sure all the clocks throughout the world (library, diner, etc.) tell the
  // time accurately"* — and that is a property of the world rather than of one
  // clock: a room that builds its own drifts from every other face the first
  // time anybody touches it. `ct/interior.ts:406`.
  //
  // A lobby you wait in needs a clock more than any other room in this game.
  room.clock({ lx: 0, y: 2.55, lz: hd - 0.14, r: 0.24, rotY: Math.PI,
    face: 0xe8e6d8, rim: 0x3a3c3a, hands: 0x22201c });

  // ── the payphone ────────────────────────────────────────────────────────
  const phoneM = new THREE.MeshBasicMaterial({ color: 0x2e3a34 });
  const chromeM = new THREE.MeshBasicMaterial({ color: 0x8a8c88 });
  put(new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.62, 0.30), phoneM), hw - 0.07, 1.42, hd - 5.4);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.20, 0.09), phoneM), hw - 0.17, 1.30, hd - 5.55);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.10, 0.14), chromeM), hw - 0.10, 1.06, hd - 5.4);
  // the cord, hanging — three short segments rather than a curve, because a
  // curve at this density is a straight line with extra vertices
  for (let i = 0; i < 3; i++) {
    put(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.03), phoneM),
      hw - 0.16 + i * 0.012, 1.14 - i * 0.15, hd - 5.55 + i * 0.02);
  }

  // ── a bin, and a radiator ───────────────────────────────────────────────
  const binM = new THREE.MeshBasicMaterial({ color: 0x3f4a42 });
  put(new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.16, 0.62, 8), binM), hw - 0.44, 0.31, hd - 6.4);
  solid(hw - 0.44, hd - 6.4, 0.42, 0.42);
  const radM = new THREE.MeshBasicMaterial({ color: 0xb4b0a0 });
  for (let i = 0; i < 11; i++) {
    put(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.58, 0.055), radM),
      -hw + 0.10, 0.36, hd - 6.9 + i * 0.09);
  }
}
