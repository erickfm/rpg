import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import { buildRoom } from './interior';
import { type DoorDecl } from './doors';
import { JAIL, JAIL_DOOR, JAIL_STEEL, jailLeafTex } from './jail';
import { leafPair, LEAF_AJAR } from './vice';

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
      // DERIVED FROM THE DOOR, not hand-typed. This used to be the literal
      // 56.0 — 0.88 m clear of the OLD building face at x 56.88, back when the
      // building was flush against the site's own edge. The walkability fix
      // (`notes/O-jail-site-walkable.md`) set the building back into a
      // forecourt, which moved `JAIL_DOOR.x` with it; a literal here would have
      // silently landed the player 5 m from a door that had moved, the exact
      // "typed twice" fault this room's own door declaration exists to avoid
      // (GOTCHAS §20). Same 0.88 m clearance, now measured off the door that
      // actually exists.
      outX: JAIL_DOOR.x - 0.88, outZ: JAIL_DOOR.z + 2.2, outYaw: -Math.PI / 2, outGy: ctx.KERB_H,
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
  // How deep the slat is, front to back. Named because the sitter's forward
  // offset derives from it (item 280) and a second hand-typed 0.42 is exactly
  // the habit BUILDER-BRIEF §8 exists to stop.
  const BENCH_D = 0.42;
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
    const w = along === 'x' ? len : BENCH_D, d = along === 'x' ? BENCH_D : len;
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
    { facing: Math.PI / 2, seated: true, y: BENCH_Y,
      // …and forward to the front of the slat, or the bench bisects her legs:
      // the slat passed straight through the middle of them, shins in front and
      // thighs behind, so she read as embedded in the furniture. Derived from
      // BENCH_D, which the bench builder above draws from. (Item 280.)
      seatFwd: BENCH_D / 2 },
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

  // ── THE SALLY PORT, FROM THE INSIDE ───────────────────────────────────────
  //
  // Item 105. The user: *"jail interior front door also looks bad and doesnt
  // match outside."* He was right, and it was the third building he had said it
  // about. What he was looking at is in `shots/w56/jail-inside.png`: one flat
  // blue-grey slab with a single 3-pixel handle, against the two pressed-panel
  // steel leaves in `shots/w56/jail-outside.png`.
  //
  // THE POSITION WAS NEVER WRONG. `JAIL_DOOR` single-sources it and
  // `scripts/doormatch12.mjs` agreed the two faces line up — which is why three
  // reports of this survived a check that claimed 12 of 12. The two faces
  // disagreed about WHAT THE DOOR IS. `DoorDecl.leaf` publishes `frame.colour`
  // and `glazing`, `ct/interior.ts` honours both, and this room already declared
  // `steel` / `'none'` — so the kit painted the slab the right COLOUR and it
  // still did not match, because panels, kick plate and leaf COUNT are what the
  // eye reads and a `DoorLeaf` cannot carry any of them.
  //
  // So: the recipe `ct/interior.ts:1343` names for exactly this room, and which
  // bank, casino, hotel, library and pawn already use — hide the kit's one leaf,
  // hang the room's own pair. The kit's own note says its `leaves: 2` is
  // unimplemented and that closing it inside the kit gave three other rooms two
  // stacked doors; this is the one-file version it recommends instead.
  const DW = JAIL.DOOR_W, DH = Math.min(JAIL.DOOR_H, room.H - 0.2), dAt = room.doorAt;
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
    else console.warn(`[interior:jail] expected 1 kit door leaf to hide, found ${hits.length}`
      + ' — the jail now has both the kit door and its own. ct/interior.ts changed shape.');
  }
  // The leaves themselves: `jailLeafTex()` is the SAME `THREE.Texture` the
  // facade hangs outside, not a copy of it — see the note on that function in
  // `ct/jail.ts`. Two faces, one drawing, and no arithmetic in between that
  // could drift.
  const jailLeafM = new THREE.MeshBasicMaterial({ map: jailLeafTex(), side: THREE.DoubleSide });
  // `OPEN = 0.55` used to live here, and its own comment said what was wrong
  // with it: *"the casino's and the bank's"*. It was copied, and it left the
  // sally port 31.5° open from the lobby while the street pair — the SAME
  // `jailLeafTex()`, 565 m away — stood shut. The angle is `LEAF_AJAR` now and
  // there is no argument to copy.
  const GAP = 0.03;
  leafPair(put, jailLeafM, dAt, DW, DH, hd - 0.12, 'jail', GAP);
  // The pull handle, at the FREE edge of each leaf — the outside has one and a
  // door without one is the "single tiny handle" complaint wearing the other hat.
  //
  // COPIED ARITHMETIC, DECLARED AS SUCH (BUILDER-BRIEF §8). These four lines are
  // `leafPair`'s own leaf placement, `ct/vice.ts:181-190`: hinge at
  // `dAt + sx*DW/2`, leaf `LW = DW/2 - gap` long, swung `open` into the room.
  // `leafPair` builds its leaves and returns nothing, so there is no transform
  // to read back and no way to hang these as children without the LOCAL-position
  // dimming `ct/interior.ts` warns about. FOLLOW-UP FOR THE DESK: have
  // `leafPair` return its two meshes, and this block reads them instead — that
  // edits `ct/vice.ts`, which this item does not name.
  const LW = DW / 2 - GAP;
  for (const sx of [-1, 1] as const) {
    const hx = dAt + sx * DW / 2;
    const t = 0.86;                              // along the leaf, hinge -> free edge
    const px = hx - sx * Math.cos(LEAF_AJAR) * LW * t;
    const pz = hd - 0.12 - Math.sin(LEAF_AJAR) * LW * t;
    const pull = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.05),
      new THREE.MeshBasicMaterial({ color: JAIL_STEEL.dark }));
    pull.rotation.y = -sx * LEAF_AJAR;
    put(pull, px, 1.02, pz);
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
  //
  // NOT AT lx 0, and that was the second half of item 105 — *"a clock appears to
  // hang ON the door."* It did, and it was not a trick of the angle: the clock
  // sat at lx 0, which is `door.at`, on the front wall, spanning y 2.31…2.79
  // inside a door opening that runs y 0…3.06. It was a disc floating in the
  // doorway. Nothing was parented wrongly — it was placed dead centre over a
  // door whose head it could not clear.
  //
  // It cannot go ABOVE the head either: this room is 3.3 m and the opening is
  // 3.06, so there are 0.24 m of wall over it and the clock is 0.48 across. So
  // it moves along the wall instead, clear of the reveal:
  // 2.20 − DOOR_W/2 (1.20) − r (0.24) = 0.76 m of daylight.
  room.clock({ lx: -2.2, y: 2.55, lz: hd - 0.14, r: 0.24, rotY: Math.PI,
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

  // ══ THE THRESHOLD ══════════════════════════════════════════════════════
  //
  // *"The interesting part of a jail is the threshold between the public half
  // and the locked half; build that."*
  //
  // It is built as a line you can see through and a line you can walk through,
  // and they are not the same line. The COUNTER is glazed to the ceiling: you
  // can see the whole of the working side of the building and reach none of
  // it. The GATE beside it stands open and you can walk straight through.
  //
  // That the gate is OPEN is a decision, and the reasoning is worth having on
  // the record because the obvious alternative is to lock it:
  //
  //   · a player who can see the interesting half and never reach it reads it
  //     as unfinished, not as forbidden. This project has that failure mode
  //     written down — `ct/civic-doors.ts`: *"a climb that ends in silence is
  //     a bug the player cannot distinguish from an unfinished build."*
  //   · the thing that SHOULD be locked is the cell, and it is. You walk the
  //     corridor, you look through the bars at a bunk made up for somebody,
  //     and you cannot go in. That is the image.
  //   · and there is NO WAY TO GET ARRESTED here, per the desk. The cells are
  //     a place, not a consequence.
  const CNT_Z = hd - 7.4;              // the counter line
  const CNT_X1 = 0.4;                  // it runs from the -x wall to here
  const GATE_X0 = 0.5, GATE_X1 = 2.6;  // and the way through is this gap
  const CNT_H = 1.12;                  // worktop height

  const steelM = new THREE.MeshBasicMaterial({ color: 0x51565a });
  const darkSteelM = new THREE.MeshBasicMaterial({ color: 0x33383c });
  const barM = new THREE.MeshBasicMaterial({ color: 0x3d4246 });

  // ── GLAZED BLOCK, because a flat colour is not a material ──────────────
  //
  // The queue said it and I broke it: *"Every big surface takes a real
  // texture… A blank grey wall in a jail will read as unfinished, not as
  // institutional."* The gate's wall stub was 4.2 x 3.3 m of `color: P.tile`
  // and nothing else, and so was every pier between the cells — the largest
  // flat fields in the room, in the two places a player stands closest to
  // them. `shots/O-room-gate.png` before this commit is 4 square metres of
  // undifferentiated green.
  //
  // What it is now is what these walls actually are: glazed structural block,
  // laid in a running bond, dark below the dado line and pale above, with the
  // capping course between. It carries the room's own wainscot colours so the
  // piers read as part of the room rather than as objects standing in it.
  const BLOCK_PPM = 16;
  const blockTex = (wM: number, hM: number) => {
    const W = Math.max(8, Math.round(wM * BLOCK_PPM)), H = Math.max(8, Math.round(hM * BLOCK_PPM));
    const bw = Math.max(3, Math.round(0.40 * BLOCK_PPM));    // 400 x 200 block
    const bh = Math.max(2, Math.round(0.20 * BLOCK_PPM));
    const DADO = 1.35;                                        // matches the kit's wainscot
    const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
    return declareSurface(pixTex(W, H, (g) => {
      for (let row = 0; row * bh < H; row++) {
        const yTop = H - (row + 1) * bh;
        const yMid = (row + 0.5) * bh / BLOCK_PPM;            // metres up from the floor
        const below = yMid < DADO;
        g.fillStyle = below ? hex(P.tile) : hex(P.wall);
        g.fillRect(0, yTop, W, bh);
        // the capping course at the dado line, which is what a real tiled
        // dado terminates in and what stops the two fields just abutting
        if (Math.abs(yMid - DADO) < 0.11) { g.fillStyle = '#47564a'; g.fillRect(0, yTop, W, bh); }
        // joints: a recessed bed joint and half-lapped perpends
        g.fillStyle = 'rgba(0,0,0,0.24)'; g.fillRect(0, yTop + bh - 1, W, 1);
        g.fillStyle = below ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.13)';
        g.fillRect(0, yTop, W, 1);
        const off = (row % 2) ? 0 : Math.round(bw / 2);
        for (let x = off; x < W; x += bw) {
          g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(x, yTop, 1, bh - 1);
          // per-block tone drift — glazed block is fired and no two match
          const v = Math.random();
          g.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.01 + v * 0.06})` : `rgba(255,255,255,${(v - 0.5) * 0.06})`;
          g.fillRect(x + 1, yTop + 1, bw - 2, bh - 2);
        }
      }
      // scuffing along the bottom, where trolleys and boots reach
      for (let i = 0; i < W * 6; i++) {
        const x = Math.random() * W, y = H - Math.pow(Math.random(), 2) * H * 0.22;
        g.fillStyle = `rgba(28,28,24,${0.04 + Math.random() * 0.12})`;
        g.fillRect(x, y, 2, 1);
      }
      dither(g, W, H, Math.round(W * H * 0.015));
    }), 'brick');
  };
  /** materials for a box whose faces need the block laid at their own real
   *  size. Texture repeat must derive from the surface's REAL METRES or the
   *  texels stop being square (GOTCHAS §5) — the same fault that smeared the
   *  side street's asphalt. Face order is [+x, −x, +y, −y, +z, −z]. */
  const blockBox = (dx: number, dy: number, dz: number) => {
    const onX = ctx.flat(blockTex(dz, dy));      // the ±x faces span dz
    const onZ = ctx.flat(blockTex(dx, dy));      // the ±z faces span dx
    const cap = new THREE.MeshBasicMaterial({ color: P.ceil });
    return [onX, onX, cap, cap, onZ, onZ];
  };

  // ── the counter ────────────────────────────────────────────────────────
  const cntT = declareSurface(pixTex(72, 28, (g) => {
    g.fillStyle = '#6b5f4c'; g.fillRect(0, 0, 72, 28);
    // a recessed panel run along the public face, and a kick that has been
    // kicked — the front of a counter is at shoe height and it shows
    for (let x = 3; x < 72; x += 17) {
      g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(x, 4, 14, 17);
      g.fillStyle = '#75694f'; g.fillRect(x + 1, 5, 12, 15);
    }
    g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(0, 24, 72, 4);
    for (let i = 0; i < 140; i++) {
      const x = Math.random() * 72, y = 22 + Math.random() * 6;
      g.fillStyle = `rgba(30,26,20,${0.06 + Math.random() * 0.18})`;
      g.fillRect(x, y, 2, 1);
    }
    dither(g, 72, 28, 90);
  }), 'detail');
  const topT = declareSurface(pixTex(48, 16, (g) => {
    g.fillStyle = '#8e8676'; g.fillRect(0, 0, 48, 16);
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * 48, y = Math.random() * 16, v = Math.random();
      g.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.04 + v * 0.10})` : `rgba(255,255,255,${(v - 0.5) * 0.14})`;
      g.fillRect(x, y, 1, 1);
    }
  }), 'detail');
  const CNT_W = CNT_X1 - -hw, CNT_CX = (-hw + CNT_X1) / 2;
  {
    const body = new THREE.Mesh(new THREE.BoxGeometry(CNT_W, CNT_H, 0.72), ctx.flat(cntT));
    put(body, CNT_CX, CNT_H / 2, CNT_Z);
    const top = new THREE.Mesh(new THREE.BoxGeometry(CNT_W + 0.12, 0.06, 0.86), ctx.flat(topT));
    put(top, CNT_CX, CNT_H + 0.03, CNT_Z);
    solid(CNT_CX, CNT_Z, CNT_W + 0.12, 0.9);
  }

  // ── the glazed screen, counter top to ceiling ──────────────────────────
  //
  // TWO back-to-back single-sided planes, not one DoubleSide plane. GOTCHAS
  // §22: `transparent` on a DoubleSide mesh puts both faces in the sorted
  // queue and the far one can paint over the near one. And no `alphaTest` —
  // this is genuine translucency, not a cut-out, so it correctly carries
  // `transparent` alone.
  //
  // It is glass and it is NOT clean: a screen in a public building is
  // fingerprinted at hand height and dusty at the top, and that is most of
  // what stops a transparent plane reading as a hole in the air.
  const GLASS_H = room.H - CNT_H - 0.06;
  const glassT = declareSurface(pixTex(96, 40, (g) => {
    g.fillStyle = 'rgba(210,222,214,0.10)'; g.fillRect(0, 0, 96, 40);
    for (let i = 0; i < 260; i++) {          // smears at hand height
      const x = Math.random() * 96, y = 24 + Math.random() * 14;
      g.fillStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.09})`;
      g.fillRect(x, y, 2, 2);
    }
    for (let i = 0; i < 90; i++) {           // dust along the top
      const x = Math.random() * 96, y = Math.random() * 7;
      g.fillStyle = `rgba(210,206,190,${0.05 + Math.random() * 0.10})`;
      g.fillRect(x, y, 1, 1);
    }
  }), 'detail');
  const glassM = () => new THREE.MeshBasicMaterial({
    map: glassT, transparent: true, opacity: 0.42, side: THREE.FrontSide,
    depthWrite: false,
  });
  for (const [dz, ry] of [[0.012, 0], [-0.012, Math.PI]] as const) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(CNT_W, GLASS_H), glassM());
    pane.rotation.y = ry;
    put(pane, CNT_CX, CNT_H + 0.06 + GLASS_H / 2, CNT_Z + dz);
  }
  // mullions, and the two things that make a screen read as a screen rather
  // than as a window: a SPEAK-HOLE and a PAPER SLOT
  for (let i = 0; i <= 5; i++) {
    const lx = -hw + (CNT_W * i) / 5;
    put(new THREE.Mesh(new THREE.BoxGeometry(0.06, GLASS_H, 0.10), steelM),
      lx, CNT_H + 0.06 + GLASS_H / 2, CNT_Z);
  }
  put(new THREE.Mesh(new THREE.BoxGeometry(CNT_W, 0.07, 0.11), steelM),
    CNT_CX, room.H - 0.04, CNT_Z);
  const SPEAK_X = -1.6;                       // the station you are served at
  {
    // a perforated disc, on the lobby side and repeated on the back so it is
    // the same object from both sides
    const holeT = declareSurface(pixTex(24, 24, (g) => {
      g.fillStyle = '#4a4f52'; g.fillRect(0, 0, 24, 24);
      g.fillStyle = '#1a1d1f';
      for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
        if ((r - 2) ** 2 + (c - 2) ** 2 > 6) continue;
        g.fillRect(4 + c * 4, 4 + r * 4, 2, 2);
      }
    }), 'detail');
    for (const dz of [0.055, -0.055]) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), ctx.flat(holeT));
      d.rotation.y = dz > 0 ? 0 : Math.PI;
      put(d, SPEAK_X, CNT_H + 0.72, CNT_Z + dz);
    }
    // the paper slot: a gap in the glass with a steel tray under it
    put(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.045, 0.28), steelM), SPEAK_X, CNT_H + 0.09, CNT_Z);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.30), darkSteelM), SPEAK_X, CNT_H + 0.115, CNT_Z);
  }

  // ── the desk sergeant ──────────────────────────────────────────────────
  //
  // FACING THE DOOR, derived from what he faces rather than copied — GOTCHAS
  // §33's rule, and its test: stand where a visitor stands and ask whether he
  // is looking at you or past you. The lobby is at +z, so he faces +z, which
  // is `facing: 0` in the atlas's `atan2(vx, vz)`.
  //
  // The uniform needs no new atlas option, which I checked before assuming:
  // a navy jacket with `fit: 'cap'` and a dark accent is a peaked cap over a
  // tunic at this density. `notes/CITIZEN-STYLE.md` is explicit that adding a
  // `fit` is a change to H's file and goes through the desk — this needed no
  // such thing.
  room.person(
    { jacket: '#2f3a4c', pants: '#2b3038', skin: '#e6bb92', hair: '#4a4038',
      fit: 'cap', accent: '#20262f', cut: 'short', build: 1, stride: 2 },
    SPEAK_X, CNT_Z - 0.62, { facing: 0 },
  );

  // what is behind him: a key board, a ledger open on the worktop, a
  // typewriter, and a wall of forms. All of it visible, none of it reachable —
  // which is the counter's whole job.
  {
    const keyT = declareSurface(pixTex(40, 28, (g) => {
      g.fillStyle = '#5a5348'; g.fillRect(0, 0, 40, 28);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(1, 1, 38, 26);
      g.fillStyle = '#6c6456'; g.fillRect(2, 2, 36, 24);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
        if (Math.random() < 0.22) continue;                 // hooks with no key
        g.fillStyle = '#3a3630'; g.fillRect(4 + c * 4, 5 + r * 6, 1, 4);
        g.fillStyle = Math.random() < 0.5 ? '#b8a878' : '#8a8a80';
        g.fillRect(3 + c * 4, 8 + r * 6, 3, 3);
      }
      dither(g, 40, 28, 60);
    }), 'sign');
    const kb = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), ctx.flat(keyT));
    kb.rotation.y = Math.PI;                 // on the far side, looking back at +z
    put(kb, -4.4, 1.85, CNT_Z - 1.28);
    // the ledger, open, on the worktop
    const ledM = new THREE.MeshBasicMaterial({ color: 0xdad3bd });
    put(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.035, 0.36), ledM), SPEAK_X + 0.9, CNT_H + 0.08, CNT_Z - 0.2);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.36), new THREE.MeshBasicMaterial({ color: 0x6a2c2c })),
      SPEAK_X + 0.9, CNT_H + 0.09, CNT_Z - 0.2);
    // a typewriter, squared to the counter like everything else in here
    const tw = new THREE.MeshBasicMaterial({ color: 0x3a3a38 });
    put(new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.16, 0.34), tw), -3.4, CNT_H + 0.14, CNT_Z - 0.24);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.10, 0.06), tw), -3.4, CNT_H + 0.27, CNT_Z - 0.36);
  }

  // ── the gate ───────────────────────────────────────────────────────────
  //
  // A steel frame with a barred leaf standing OPEN against the wall. The frame
  // is what makes the threshold legible: you pass through something, and you
  // can see that it is a thing that closes.
  const GATE_CX = (GATE_X0 + GATE_X1) / 2, GATE_W = GATE_X1 - GATE_X0;
  const GATE_H = 2.35;
  {
    for (const lx of [GATE_X0, GATE_X1]) {
      put(new THREE.Mesh(new THREE.BoxGeometry(0.14, GATE_H, 0.30), steelM), lx, GATE_H / 2, CNT_Z);
    }
    put(new THREE.Mesh(new THREE.BoxGeometry(GATE_W + 0.14, 0.16, 0.30), steelM), GATE_CX, GATE_H, CNT_Z);
    // ── the leaf, STOOD 60 DEGREES OPEN ───────────────────────────────
    //
    // Two earlier positions were both correct and both useless, and the reason
    // is the same each time: an open gate has to be SEEN to be a gate.
    //
    //   flat against the stub, hinged on the stub side — geometrically what a
    //     gate does, and from the lobby it is edge-on AND occluded by the very
    //     wall it folds against. The frame read as an empty doorway
    //     (`shots/O-room-gate.png`, twice, before this)
    //   fully open at 90 degrees — same problem with extra steps
    //
    // 60 degrees is what a gate propped open actually looks like, and it is the
    // angle at which the bars face into the room you are standing in. The
    // opening was widened 1.6 -> 2.1 m to pay for it, so the leaf never narrows
    // the way through below what a 0.72 m capsule needs — measured by walking
    // it, not by eye.
    //
    // The leaf is built CLOSED, lying along +x from the hinge, and rotated
    // open. Building it in the open position and rotating toward closed is what
    // made the last two versions hard to reason about: the closed position is
    // the one the geometry means.
    const HINGE = GATE_X0, LEAF = GATE_W - 0.10;
    const OPEN = 1.05;                       // 60 degrees, into the cell block
    const leaf = new THREE.Group();
    for (let i = 0; i <= 7; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.045, GATE_H - 0.16, 0.045), barM);
      b.position.set((LEAF * i) / 7, (GATE_H - 0.16) / 2, 0);
      leaf.add(b);
    }
    for (const y of [0.35, GATE_H - 0.45]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(LEAF, 0.05, 0.05), barM);
      r.position.set(LEAF / 2, y, 0);
      leaf.add(r);
    }
    // the lock stile at the free edge, which is the end that closes
    const stile = new THREE.Mesh(new THREE.BoxGeometry(0.07, GATE_H - 0.16, 0.09), steelM);
    stile.position.set(LEAF, (GATE_H - 0.16) / 2, 0);
    leaf.add(stile);
    leaf.rotation.y = OPEN;
    put(leaf, HINGE, 0, CNT_Z);
    // THE COLLIDER FOLLOWS THE SWING, computed from the SAME angle the mesh is
    // rotated by. I re-derived it by hand once and got the sign of the x term
    // backwards, which put a 1.06 m solid INSIDE the opening: the leaf swung one
    // way and the thing that stops you swung the other, so the gate looked open
    // and was shut. The walk caught it — 5.84 m into a 26 m room — which is why
    // the room is walked and not looked at. GOTCHAS 33, fourth time in this
    // building.
    //
    // three.js rotates (x, z) about y by t to (x cos t + z sin t,
    // -x sin t + z cos t). The free edge is at local (LEAF, 0):
    const tipX = LEAF * Math.cos(OPEN);
    const tipZ = -LEAF * Math.sin(OPEN);
    solid(HINGE + tipX / 2, CNT_Z + tipZ / 2, Math.abs(tipX) + 0.10, Math.abs(tipZ) + 0.10);
    // the stub of wall the leaf folds against, so the gate has somewhere to be
    put(new THREE.Mesh(new THREE.BoxGeometry(hw - GATE_X1, room.H, 0.30),
      blockBox(hw - GATE_X1, room.H, 0.30)), (GATE_X1 + hw) / 2, room.H / 2, CNT_Z);
    solid((GATE_X1 + hw) / 2, CNT_Z, hw - GATE_X1, 0.36);
  }

  // ══ THE CELL BLOCK ══════════════════════════════════════════════════════
  //
  // Four cells down the −x side, a corridor past them, and the bars are the
  // point. Real geometry on a spacing you can see between, never a painted
  // bar — the same argument as the exterior's windows and as the flat
  // waitress the atlas exists to prevent (GOTCHAS §21).
  // CELLS DOWN BOTH SIDES, and the second run is a correction rather than an
  // ornament. With one run the corridor measured 9.5 m across — that is a hall
  // with cells along one wall, not a cell block, and it photographed as an
  // empty gymnasium (`shots/O-room-corridor.png` before this). The corollary to
  // GOTCHAS §45 says to measure the largest continuous free run rather than the
  // square metres; here the fault was the opposite of the library's, too much
  // undifferentiated floor rather than too little. Two runs bring it to 5.2 m,
  // which is a corridor you walk down with bars on both sides.
  const CELL_D = 3.8;                         // how deep a cell is
  const CELL_X1 = -hw + CELL_D;               // the barred face of the WEST run
  const CELLS: { z0: number; z1: number }[] = [];
  {
    let z = CNT_Z - 1.9;
    for (let i = 0; i < 4; i++) {
      CELLS.push({ z0: z - 3.4, z1: z });
      z -= 3.8;                               // 3.4 of cell, 0.4 of pier
    }
  }

  const cellFloorT = declareSurface(pixTex(64, 64, (g) => {
    g.fillStyle = '#55524b'; g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * 64, y = Math.random() * 64, v = Math.random();
      g.fillStyle = v < 0.6 ? `rgba(0,0,0,${0.03 + v * 0.10})` : `rgba(220,214,200,${(v - 0.6) * 0.16})`;
      g.fillRect(x, y, 1, 1);
    }
  }), 'ground');
  const cellFloorM = ctx.flat(cellFloorT);
  const bunkM = new THREE.MeshBasicMaterial({ color: 0x4c5155 });
  const mattM = new THREE.MeshBasicMaterial({ color: 0x6e6656 });
  const blankM = new THREE.MeshBasicMaterial({ color: 0x5a4f44 });
  const porcM = new THREE.MeshBasicMaterial({ color: 0xc8c6ba });
  const wallM = new THREE.MeshBasicMaterial({ color: P.tile });

  // the daylight slot at the back of every cell. It DIMS WITH THE WORLD —
  // a bright window at two in the morning is the tell that a room is a set.
  //
  // ── IT WAS NOT ACTUALLY GETTING DARK, AND THIS READ THE WRONG QUANTITY ──
  //
  // Measured at 02:00 before the fix: #f0f3f6 -> #b3b7ba. That is a LIGHT GREY
  // at two in the morning — precisely the tell the line above exists to
  // prevent. The cause is `f.night`, which is NOT how night it is:
  //
  //   f.night                     the hud's raw wash curve. `NIGHT_STOPS`
  //                               (ct/hud.ts:1225) TOPS OUT AT 0.58, and at
  //                               02:00 it is flat 0.58 — it never reaches 1.
  //   scene.userData.nightFactor  "0 broad day … 1 fully night", published by
  //                               props.ts:1340 for exactly this purpose.
  //
  // It reproduces to the byte: 0.87 - 0.72 * 0.58 = 0.4524 linear, which is
  // sRGB 0xb3 — the measured value. So the slot only ever travelled 58% of the
  // way to the darkness this code already asked for.
  //
  // `ct/int-library.ts:677-686` documents this exact trap — *"two different
  // quantities with almost the same name … I shipped the wrong one for one
  // build"* — and its daylight panel is the precedent this now follows.
  //
  // AND THE ENDPOINTS ARE sRGB, LERPED, NOT `setRGB` ARITHMETIC. That is the
  // library's SECOND documented trap at :687: `setRGB` writes a LINEAR value,
  // so hand-computed coefficients render brighter than they read. The two
  // constants below are the OLD FORMULA'S OWN ENDPOINTS evaluated properly —
  // day is n=0 (#f0f3f6, byte-identical to what noon already showed, so
  // daylight does not move) and night is n=1 (#6c6f76), the darkness the
  // author asked for and never got. Derived from the code that was here, not
  // chosen by me.
  //
  // `Color.set(hex)` converts sRGB -> working space and `lerp` runs there, so
  // the interpolation is the same one the library does.
  const SLOT_DAY = new THREE.Color(0xf0f3f6);
  const SLOT_NIGHT = new THREE.Color(0x6c6f76);
  const slotM = new THREE.MeshBasicMaterial({ color: 0xdfe6ea });
  // KEPT, and it is not the defect the queue row supposed. `dimWorld` returns
  // early for |world x| > 100 (props.ts:977) and this room sits at x ~1006, so
  // the world grader has never touched this material — `userData.graded` reads
  // false on it, which is how we know. The flag is inert today and is left as
  // the standing declaration that this surface grades ITSELF; removing it would
  // only matter on the day interiors move inside that radius, and then it would
  // matter a great deal.
  slotM.userData.selfLit = true;
  ctx.onFrame(() => {
    const n = (ctx.scene.userData.nightFactor as number) ?? 0;
    slotM.color.copy(SLOT_DAY).lerp(SLOT_NIGHT, n);
  });

  /**
   * ONE CELL, on a given side of the corridor.
   *
   * `side` is −1 for the west run and +1 for the east, and EVERY x in here is
   * derived from it. GOTCHAS §41 is exactly this shape: *"when geometry is
   * mirrored… checking one instance proves nothing about the other. The mirror
   * is precisely the operation that breaks handedness."* The lock box, the
   * basin, the bunk and the door swing all have a side, and a second run
   * written as a copy with a flipped sign is how the car lot's far row ended up
   * facing backwards.
   *
   *   backX   the room wall this cell is against
   *   faceX   the barred face, always CORRIDOR-side of backX
   *   inward  the direction from the bars toward the back wall
   */
  const cell = (side: -1 | 1, c: { z0: number; z1: number }, occupied: boolean) => {
    const backX = side * hw;
    const faceX = backX - side * CELL_D;
    const inward = -side;                      // bars -> back wall
    const cz = (c.z0 + c.z1) / 2, cw = c.z1 - c.z0;
    const midX = backX + inward * (CELL_D / 2);
    // the piers between cells, full height and full depth
    for (const pz of [c.z1 + 0.2, c.z0 - 0.2]) {
      put(new THREE.Mesh(new THREE.BoxGeometry(CELL_D, room.H, 0.4),
        blockBox(CELL_D, room.H, 0.4)), midX, room.H / 2, pz);
      solid(midX, pz, CELL_D, 0.4);
    }
    // the cell floor, a shade darker than the corridor's
    const f = new THREE.Mesh(new THREE.PlaneGeometry(CELL_D, cw), cellFloorM);
    f.rotation.x = -Math.PI / 2;
    put(f, midX, 0.018, cz);

    // ── THE BARS, and you can see between them ──
    //
    // 0.11 m clear between 0.05 m bars. Wider than a real cell, deliberately:
    // at this world's ~8 px/m a true 4-inch gap closes up to nothing at any
    // distance and the run reads as a solid grey panel — which is the exact
    // failure the queue warned about, a bar you cannot see through being no
    // better than a painted one.
    const GAP = 0.16;
    const n = Math.floor(cw / GAP);
    const DOOR_W2 = 0.95, doorZ0 = cz - DOOR_W2 / 2, doorZ1 = cz + DOOR_W2 / 2;
    for (let k = 0; k <= n; k++) {
      const bz = c.z0 + (cw * k) / n;
      if (bz > doorZ0 - 0.02 && bz < doorZ1 + 0.02) continue;   // the doorway
      put(new THREE.Mesh(new THREE.BoxGeometry(0.05, room.H, 0.05), barM), faceX, room.H / 2, bz);
    }
    // the rails, and a head-height transom over the whole face
    for (const y of [0.42, 1.62, room.H - 0.10]) {
      put(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, cw), barM), faceX, y, cz);
    }
    // ── the cell door: barred, hinged, and SHUT ──
    {
      const leaf = new THREE.Group();
      for (let k = 0; k <= 6; k++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.24, 0.05), barM);
        b.position.set(0, 1.12, (DOOR_W2 * k) / 6);
        leaf.add(b);
      }
      for (const y of [0.42, 1.62, 2.20]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, DOOR_W2), barM);
        r.position.set(0, y, DOOR_W2 / 2);
        leaf.add(r);
      }
      // THE LOCK BOX IS ON THE CORRIDOR SIDE, which is the whole statement the
      // door makes — and it is `-side * 0.06`, derived, not a constant copied
      // from the other run. Copied, it would sit INSIDE the east cells.
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.26, 0.16), steelM);
      lock.position.set(-side * 0.06, 1.06, DOOR_W2 - 0.06);
      leaf.add(lock);
      put(leaf, faceX, 0, doorZ0);
      put(new THREE.Mesh(new THREE.BoxGeometry(0.06, room.H - 2.28, DOOR_W2),
        blockBox(0.06, room.H - 2.28, DOOR_W2)), faceX, (room.H + 2.28) / 2, cz);
    }
    // the whole barred face is solid: you look through it, you do not go in
    solid(faceX, cz, 0.12, cw);

    // ── what is inside, and it is furnished for somebody ──
    const BUNK_Y = 0.46;
    // Head at the back wall, foot toward the bars: the bunk runs ALONG the
    // sitter's line of sight, which is why the man on it needs a big forward
    // offset and the lobby bench needs a small one (item 280).
    const BUNK_L = 1.92;
    const bunkX = backX + inward * 1.15;         // against the back wall
    put(new THREE.Mesh(new THREE.BoxGeometry(BUNK_L, 0.10, 0.72), bunkM), bunkX, BUNK_Y, cz + 0.5);
    for (const t of [0.30, 2.00]) {
      put(new THREE.Mesh(new THREE.BoxGeometry(0.07, BUNK_Y, 0.07), bunkM),
        backX + inward * t, BUNK_Y / 2, cz + 0.5);
    }
    put(new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.09, 0.64), mattM), bunkX, BUNK_Y + 0.09, cz + 0.5);
    // a blanket, folded at the foot on the empty ones and thrown back on the
    // one that is occupied — the difference between a cell and a cell somebody
    // is in
    if (occupied) {
      put(new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.07, 0.60), blankM),
        backX + inward * 1.85, BUNK_Y + 0.17, cz + 0.48);
    } else {
      put(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.13, 0.58), blankM),
        backX + inward * 1.95, BUNK_Y + 0.19, cz + 0.5);
    }
    // basin and stool, both against the back wall and derived from it
    put(new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.16, 0.34), porcM),
      backX + inward * 0.26, 0.86, cz - 1.05);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.10, 0.05), steelM),
      backX + inward * 0.12, 1.00, cz - 1.05);
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 8), bunkM),
      backX + inward * 1.9, 0.44, cz - 1.15);
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 6), bunkM),
      backX + inward * 1.9, 0.21, cz - 1.15);
    // the slot window, high in the back wall, barred on its own account
    put(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.44, 0.80), slotM),
      backX + inward * 0.03, 2.42, cz);
    for (let k = 0; k < 4; k++) {
      put(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.44, 0.035), barM),
        backX + inward * 0.07, 2.42, cz - 0.30 + k * 0.20);
    }
    return { bunkX, cz: cz + 0.5, faceX, bunkL: BUNK_L };
  };

  // Four each side. The two runs are built by the SAME function with a
  // different `side`, so there is no second copy to drift — and both are
  // photographed from the corridor in `scripts/O-jailroom-look.mjs`, because
  // GOTCHAS §41 is that checking one instance proves nothing about the other.
  const occupiedCell = cell(-1, CELLS[1], true);
  CELLS.forEach((c, i) => { if (i !== 1) cell(-1, c, false); });
  CELLS.forEach((c) => cell(1, c, false));

  // THE MAN IN CELL TWO. One occupied cell out of eight, not eight: eight is a
  // set, one is a place where somebody is. He sits on the bunk with the blanket
  // thrown back, facing the bars — which is what you do when you hear somebody
  // in the corridor, and it is what makes the corridor feel watched rather
  // than toured.
  //
  // Seated: the origin is the HIP and goes on the SEAT TOP, not the floor
  // (`notes/H-seated-sprite.md`). The bunk top with its mattress is
  // 0.46 + 0.09 + 0.045 = 0.595. If that ever needs a fudge the atlas is wrong
  // and it goes to H, not patched here.
  //
  // His facing is derived from where the bars are relative to him, not typed:
  // he is in the WEST run, so the corridor is at +x, so he looks +x.
  room.person(
    { jacket: '#6a6358', pants: '#4a4640', skin: '#7a4a28', hair: '#22201c',
      fit: 'plain', cut: 'crop', build: 0, stride: 2, grime: 0.55, seated: true },
    occupiedCell.bunkX, occupiedCell.cz,
    { facing: Math.atan2(occupiedCell.faceX - occupiedCell.bunkX, 0), seated: true, y: 0.595,
      // THE WORST SEATED FIGURE IN THE WORLD BEFORE THIS (item 280): he sat at
      // the CENTRE of a bunk that runs 0.96 m in the exact direction he faces,
      // so the mattress swallowed his whole lower body and he read as a torso
      // floating over the blanket with two shoes poking out of it. Every other
      // sitter loses its legs to a cushion a quarter of a metre deep; this one
      // lost them to a bed.
      //
      // So he moves to the FOOT of the bunk, which is where a man sitting up
      // facing the bars actually sits — feet on the floor, blanket behind him.
      // Half the bunk's own length, less a hip's width so he is ON it and not
      // perched off the end. Derived from BUNK_L, which the cell above draws
      // the frame and the mattress from.
      seatFwd: occupiedCell.bunkL / 2 - 0.26 },
  );

  // ── the corridor's own light ───────────────────────────────────────────
  //
  // Caged bulkheads, not troffers. The kit's ceiling run is the LOBBY's light
  // and it is a suspended commercial tray; the cell block is the part of the
  // building where a fitting has to survive being hit, so it gets the fixture
  // that says so. One per cell, over the corridor rather than over the cells,
  // which is also true: you do not put a light where a prisoner can reach it.
  const cageM = new THREE.MeshBasicMaterial({ color: 0xf2efdc });
  cageM.userData.selfLit = true;
  for (const c of CELLS) {
    const cz = (c.z0 + c.z1) / 2;
    for (const lx of [CELL_X1 + 0.8, -CELL_X1 - 0.8]) {
      put(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.10, 0.22), cageM), lx, room.H - 0.10, cz);
      for (let k = 0; k < 3; k++) {
        put(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.03, 0.03), darkSteelM),
          lx, room.H - 0.10, cz - 0.07 + k * 0.07);
      }
    }
  }

  // ── the end of the corridor ────────────────────────────────────────────
  //
  // A mop sink, a bucket and a stack of chairs. The corridor has to END in
  // something: a run of cells that stops at a blank wall reads as a room that
  // ran out, and this is the corner of every institution in the world.
  {
    const bz = -hd + 1.1;
    put(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.34, 0.62), porcM), -1.9, 0.17, bz);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, 0.05), steelM), -2.1, 0.65, bz);
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.30, 8),
      new THREE.MeshBasicMaterial({ color: 0x63594a })), -1.1, 0.15, bz - 0.1);
    solid(-1.7, bz, 1.6, 0.9);
    const chairM = new THREE.MeshBasicMaterial({ color: 0x4a5560 });
    for (let k = 0; k < 5; k++) {
      put(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.44), chairM), 1.9, 0.44 + k * 0.075, bz + 0.3);
      put(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.05), chairM), 1.9, 0.68 + k * 0.075, bz + 0.52);
    }
    solid(1.9, bz + 0.4, 0.6, 0.8);
  }
}
