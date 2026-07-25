import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither } from './paint';
import { buildRoom } from './interior';
import { type DoorDecl } from './doors';
import { citizenSprite } from './citizens';
import { FACE } from './rng';

// A-1 TAX SERVICE, inside.
//
// The queue's brief is a dare: *"the dullest room in the world, done with as
// much care as the casino — that contrast is the joke."* So the discipline here
// is the opposite of the casino's. Nothing in this room is trying to hold your
// attention, and the way to make that land is to be exact about it rather than
// to be lazy about it:
//
//   · every colour is a landlord colour — magnolia walls, grey carpet tile,
//     a ceiling the same magnolia with the light gone out of it;
//   · the furniture is all one system, bought at once and never added to:
//     two identical desks, two identical chairs, one run of cabinets;
//   · everything is square to the walls. The casino has nothing square to
//     anything; here the only thing off-axis in the room is the paper on the
//     pinboard, and that is because paper cannot help it;
//   · the one ornament is a fake plant, and it is dusty.
//
// The joke only works if the care is real, so the details are the ones you
// would actually find: the label holders on the drawer fronts, the wire trays,
// the phone with its cord, the ceiling tile that has been pushed up and never
// pushed back. A room drawn carelessly reads as unfinished, not as dull.
//
// A-1 TAX stands on the east side of the block, z ∈ [-22.0, -9.0] in
// street.ts's EAST roster, facade on x = +7.0. `taxFront` paints its door at
// W * 0.5 of a 104-texel shopfront, which lands at world z = -15.25 — derived
// and walked in notes/G-interiors2-prep.md, not eyeballed.
/**
 * WHERE THIS ROOM'S DOOR IS — declared by the ROOM; the facade follows it.
 * See ct/doors.ts for why that direction. Written against the position this
 * room is actually laid out around, so the painted shopfront door moves to
 * match rather than the furniture moving to match the paint.
 */
export const DOOR: DoorDecl = {
  building: 'A-1 TAX', w: 13, cz: -15.5, side: 1, at: -4.2, width: 1.15,
};

export function buildTax(ctx: CtxBuild): void {
  const room = buildRoom(ctx, {
    id: 'tax',
    label: 'into A-1 TAX SERVICE',
    // 2.75 m — a suspended ceiling dropped under whatever the building
    // actually gives you, which is what every one of these offices did.
    d: 8.5, h: 2.75,
    palette: { floor: 0x8e8a7e, wall: 0xc2bda8, ceil: 0xc8c4b4, trim: 0x6a6458 },
    frontage: { name: 'A-1 TAX', w: 13, cz: -15.5, side: 1 },
    // The door, its width, the [E] spot on the pavement and the way back out
    // all derive from DOOR above — one authoring, not two. The [E] spot used
    // to be hand-typed at z = -15.25 while the room was laid out around a door
    // 4.9 m away from it, which is the misalignment the user reported.
    door: { r: 1.05, at: DOOR.at, width: DOOR.width },
  });

  const { put, solid } = room;
  const hw = room.W / 2, hd = room.D / 2;
  const STEEL = 0x8a8880, DARKSTEEL = 0x5a5850;
  const steelM = new THREE.MeshBasicMaterial({ color: STEEL });

  // ── the floor: carpet tile, and nothing else has ever been here ──
  //
  // 500 mm commercial carpet tile laid quarter-turned, which is how it comes
  // and how nobody ever re-lays it. The whole character is that alternate
  // tiles catch the light differently — that faint chequer is the only pattern
  // in the room, and it is not a pattern anybody chose.
  const carpetT = pixTex(48, 48, (g) => {
    g.fillStyle = '#8e8a7e'; g.fillRect(0, 0, 48, 48);
    for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
      const turned = (tx + ty) % 2 === 1;
      g.fillStyle = turned ? '#8a8578' : '#928e82';
      g.fillRect(tx * 24, ty * 24, 24, 24);
      // the nap, running one way in one tile and the other way in its neighbour
      g.fillStyle = 'rgba(0,0,0,0.05)';
      for (let i = 2; i < 24; i += 3) {
        if (turned) g.fillRect(tx * 24, ty * 24 + i, 24, 1);
        else g.fillRect(tx * 24 + i, ty * 24, 1, 24);
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.10)';
    g.fillRect(0, 23, 48, 1); g.fillRect(23, 0, 1, 48);          // the tile joints
    dither(g, 48, 48, 60);
  });
  carpetT.wrapS = carpetT.wrapT = THREE.RepeatWrapping;
  carpetT.repeat.set(Math.round(room.W / 2.0), Math.round(room.D / 2.0));
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(room.W, room.D), ctx.flat(carpetT));
  carpet.rotation.x = -Math.PI / 2;
  put(carpet, 0, 0.012, 0);

  // ── the suspended ceiling ──
  //
  // Mineral tile in a T-bar grid, with one tile pushed up out of its frame and
  // never pushed back — the single detail in this room that says a person has
  // been in here, and it is a person who was looking for a stopcock.
  const ceilT = pixTex(32, 32, (g) => {
    g.fillStyle = '#b6b2a2'; g.fillRect(0, 0, 32, 32);           // the T-bar
    g.fillStyle = '#cdc9b8'; g.fillRect(1, 1, 30, 30);           // the tile
    g.fillStyle = 'rgba(0,0,0,0.05)';                            // its fissured face
    for (let i = 0; i < 26; i++) {
      g.fillRect(3 + ((i * 7) % 26), 3 + ((i * 11) % 26), 2, 1);
    }
    g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(1, 1, 30, 1);
    dither(g, 32, 32, 18);
  });
  ceilT.wrapS = ceilT.wrapT = THREE.RepeatWrapping;
  ceilT.repeat.set(Math.round(room.W / 1.2), Math.round(room.D / 1.2));
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(room.W, room.D), ctx.flat(ceilT));
  ceil.rotation.x = Math.PI / 2;
  put(ceil, 0, room.H - 0.02, 0);
  // the tile somebody lifted, sitting proud of the grid on one corner
  const lifted = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.04, 1.15),
    new THREE.MeshBasicMaterial({ color: 0xb0ac9c }));
  lifted.rotation.z = 0.09;
  put(lifted, 4.3, room.H - 0.06, -2.4);

  // ── strip lighting ──
  //
  // Four twin fittings on the grid, square to everything. The glow planes hang
  // 0.2 m under the diffusers rather than against them: additive blending
  // brightens whatever is BEHIND the plane, so a glow flush to the ceiling
  // paints the ceiling instead of the room — the casino taught me that one.
  const glowT = pixTex(32, 32, (g) => {
    const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15);
    gr.addColorStop(0, 'rgba(226,232,214,0.34)');
    gr.addColorStop(1, 'rgba(226,232,214,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  });
  const glowM = new THREE.MeshBasicMaterial({
    map: glowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const diffuserM = new THREE.MeshBasicMaterial({ color: 0xe6e8d8 });
  for (const lz of [-2.5, 0.7]) for (const lx of [-3.4, 3.4]) {
    put(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 0.26), diffuserM), lx, room.H - 0.08, lz);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.3), glowM);
    gl.rotation.x = Math.PI / 2;
    put(gl, lx, room.H - 0.28, lz);
  }

  // ── the wall of filing cabinets ──
  //
  // Five four-drawer units in a row down the back wall, all the same, all
  // full. The label holders are the detail worth having: a strip of card in a
  // chrome frame on every drawer, which is what makes a bank of grey boxes
  // read as somebody's filing rather than as lockers.
  const cabT = pixTex(64, 44, (g) => {
    g.fillStyle = '#8a8880'; g.fillRect(0, 0, 64, 44);
    for (let d = 0; d < 4; d++) {
      const y = 1 + d * 11;
      g.fillStyle = '#928f86'; g.fillRect(1, y, 62, 10);          // the drawer front
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(1, y + 10, 62, 1);
      g.fillStyle = '#6a6860'; g.fillRect(26, y + 6, 12, 2);      // the pull
      g.fillStyle = '#b8b4a8'; g.fillRect(6, y + 3, 14, 4);       // the label holder
      g.fillStyle = '#e8e4d4'; g.fillRect(7, y + 4, 12, 2);       // the card in it
    }
    dither(g, 64, 44, 40);
  });
  const cabM = ctx.flat(cabT);
  const CAB_Z = -hd + 0.28, CAB_X0 = -5.5, CAB_N = 5, CAB_W = 1.6;
  for (let i = 0; i < CAB_N; i++) {
    put(new THREE.Mesh(new THREE.BoxGeometry(CAB_W, 1.32, 0.55),
      [cabM, cabM, steelM, steelM, cabM, cabM]),
      CAB_X0 + CAB_W / 2 + i * CAB_W, 0.66, CAB_Z);
  }
  // one collider for the whole run, not one per unit — the units abut, and
  // per-unit boxes would only make seams to catch on
  solid(CAB_X0 + (CAB_N * CAB_W) / 2, CAB_Z, CAB_N * CAB_W, 0.55);
  // the box of files that did not fit, on top
  put(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.4),
    new THREE.MeshBasicMaterial({ color: 0xa89a7c })), -3.4, 1.47, CAB_Z);

  // ── two desks, identical, square to the wall ──
  const deskTopT = pixTex(48, 32, (g) => {
    g.fillStyle = '#a89c82'; g.fillRect(0, 0, 48, 32);            // oak-effect laminate
    g.fillStyle = 'rgba(120,90,50,0.16)';
    for (let i = 0; i < 40; i++) g.fillRect(0, (i * 5) % 32, 48, 1);
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, 0, 48, 1);
    dither(g, 48, 32, 26);
  });
  const deskTopM = ctx.flat(deskTopT);
  const deskSideM = new THREE.MeshBasicMaterial({ color: 0x6e6a60 });
  const paperM = new THREE.MeshBasicMaterial({ color: 0xe4dfcc });
  const desk = (dx: number, lamp: boolean) => {
    put(new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.74, 0.8),
      [deskSideM, deskSideM, deskTopM, deskSideM, deskSideM, deskSideM]), dx, 0.37, -1.5);
    // the modesty panel, which is the whole reason a client desk looks like this
    put(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.04), deskSideM), dx, 0.28, -1.14);
    // wire trays, in and out, one stacked on the other
    for (let t = 0; t < 2; t++) {
      put(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.26), steelM), dx + 0.62, 0.79 + t * 0.09, -1.62);
      put(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.22), paperM), dx + 0.62, 0.765 + t * 0.09, -1.62);
    }
    // the phone, and the forms in front of the client
    put(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.2),
      new THREE.MeshBasicMaterial({ color: 0x36342e })), dx - 0.62, 0.79, -1.62);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.4), paperM), dx, 0.76, -1.28);
    if (lamp) {
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.34, 6), steelM), dx + 0.05, 0.92, -1.78);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.07, 0.1, 8),
        new THREE.MeshBasicMaterial({ color: 0x2e5a4a })), dx + 0.05, 1.12, -1.78);
    }
    // the two chairs: the preparer's, and the client's on the near side
    const chair = (cz: number, col: number, back: number) => {
      const m = new THREE.MeshBasicMaterial({ color: col });
      put(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.09, 0.44), m), dx, 0.44, cz);
      put(new THREE.Mesh(new THREE.BoxGeometry(0.46, back, 0.07),
        m), dx, 0.5 + back / 2, cz + (cz < -1.5 ? -0.2 : 0.2));
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), steelM), dx, 0.22, cz);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 10),
        new THREE.MeshBasicMaterial({ color: DARKSTEEL })), dx, 0.03, cz);
    };
    chair(-2.15, 0x4a5560, 0.5);    // the preparer's, blue-grey, with a back
    chair(-0.75, 0x6a5f4e, 0.42);   // the client's, brown, and lower
    // ONE collider for the desk and both its chairs. The gaps between them are
    // under the 0.72 m player, so per-object boxes would only carve slots to
    // wedge into — the lesson the diner's booths taught.
    solid(dx, -1.15, 1.9, 1.9);
  };
  desk(-2.6, true);
  desk(1.4, false);

  // ── the preparer, at the desk that has the lamp ───────────────────────
  //
  // The user: *"the people inside these places are always flat and not like the
  // people on the street"*. One person, at one of the two desks — the one with
  // the lamp on it, because that is the desk that is being used and the other
  // one is the reason this office has two.
  //
  // He sits on the far side facing the client chair, `facing: PI` — atan2(vx,
  // vz) toward +z, which is out toward the door. Deliberately the dullest Look
  // in the world: grey-blue shirt, grey trousers, nothing accented. This room's
  // whole joke is that it is drab on purpose and made with care, and a
  // flamboyant preparer would break it.
  //
  // Standing rather than seated: the atlas paints people upright and a sitting
  // pose is not one of its five views, so he is on his feet beside the chair —
  // a preparer who has got up to file something. Faking a sit by sinking the
  // sprite into the floor would cut his legs off at the shin.
  const preparer = citizenSprite(
    { jacket: '#5a6470', pants: '#4a4a44', skin: '#e6bb92', hair: '#4a4038',
      fit: 'plain', cut: 'short', build: 0, stride: 2 },
    { facing: Math.PI, h: 0.99, w: 0.98 },
  );
  put(preparer.mesh, -2.6, 0, -2.45);                // origin at the FEET
  ctx.onFrame(({ px, pz, dt }) => preparer.update(px, pz, dt));

  // ── the pinboard ──
  //
  // West wall. IRS notices, a rates table and a curling poster, each pinned at
  // its own small angle — the only thing in this room that is not square, and
  // only because paper will not stay square.
  const boardT = pixTex(80, 56, (g) => {
    g.fillStyle = '#8a7250'; g.fillRect(0, 0, 80, 56);           // cork
    g.fillStyle = 'rgba(0,0,0,0.10)';
    for (let i = 0; i < 200; i++) g.fillRect((i * 13) % 80, (i * 29) % 56, 1, 1);
    g.fillStyle = '#5a4830'; g.fillRect(0, 0, 80, 2); g.fillRect(0, 54, 80, 2);
    g.fillRect(0, 0, 2, 56); g.fillRect(78, 0, 2, 56);
    const notice = (x: number, y: number, w: number, h: number, tilt: number, tint: string) => {
      g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(tilt); g.translate(-w / 2, -h / 2);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(1, 1, w, h);
      g.fillStyle = tint; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(60,50,40,0.55)';                        // lines of type
      for (let ly = 3; ly < h - 2; ly += 3) g.fillRect(2, ly, w - 4 - ((ly * 7) % 5), 1);
      g.fillStyle = '#8a2c22'; g.fillRect(2, 2, Math.max(4, w - 10), 1);
      g.restore();
      g.fillStyle = '#c9a45e'; g.fillRect(Math.round(x + w / 2), Math.round(y) - 1, 2, 2);  // the pin
    };
    notice(5, 5, 22, 28, -0.05, '#e6e0cc');
    notice(31, 4, 20, 22, 0.04, '#dfe4d8');
    notice(55, 6, 20, 26, -0.03, '#e6e0cc');
    notice(8, 36, 26, 16, 0.03, '#e2d8c0');
    notice(40, 32, 30, 20, -0.02, '#dfe4d8');
    dither(g, 80, 56, 40);
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.2), ctx.flat(boardT));
  board.rotation.y = Math.PI / 2;                                 // faces +x, into the room
  put(board, -hw + 0.06, 1.55, -1.0);

  // ── the wall clock ──
  //
  // The casino has no clock, on purpose. This room has one, on purpose, and it
  // is the plainest object in it: a white face, black hands, a grey rim, hung
  // dead centre over the cabinets where everybody waiting can watch it.
  const clockT = pixTex(32, 32, (g) => {
    g.fillStyle = '#6e6a60'; g.beginPath(); g.arc(16, 16, 15, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8e4d8'; g.beginPath(); g.arc(16, 16, 13, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2e2c28';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.fillRect(Math.round(16 + Math.sin(a) * 11) - 1, Math.round(16 - Math.cos(a) * 11) - 1,
        i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
    }
    for (let t = 0; t < 7; t++) g.fillRect(16 + Math.round(Math.sin(2.1) * t), 16 - Math.round(Math.cos(2.1) * t), 1, 1);
    for (let t = 0; t < 10; t++) g.fillRect(16 + Math.round(Math.sin(-1.1) * t), 16 - Math.round(Math.cos(-1.1) * t), 1, 1);
    g.fillStyle = '#8a2c22'; g.fillRect(15, 15, 2, 2);
  });
  const clock = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42),
    new THREE.MeshBasicMaterial({ map: clockT, alphaTest: 0.5 }));
  put(clock, 0, 2.18, -hd + 0.06);

  // ── the fake plant ──
  //
  // The room's one ornament, and it is plastic. Drawn upright and evenly
  // spaced, which is exactly what gives it away — a real plant leans toward
  // the window and this one has never had a reason to.
  const plantT = pixTex(36, 48, (g) => {
    g.fillStyle = '#3a5a34';
    const leaf = (x0: number, y0: number, dx: number, dy: number, n: number, col: string) => {
      g.fillStyle = col;
      for (let i = 0; i < n; i++) g.fillRect(Math.round(x0 + dx * i), Math.round(y0 + dy * i), 3, 3);
    };
    leaf(17, 6, -1.5, 1.6, 8, '#3f6238');
    leaf(18, 6, 1.5, 1.6, 8, '#37552f');
    leaf(17, 10, -2.2, 1.1, 7, '#456a3c');
    leaf(18, 10, 2.2, 1.1, 7, '#3f6238');
    leaf(17, 4, -0.2, 1.8, 8, '#4a7040');
    g.fillStyle = 'rgba(180,175,150,0.18)'; g.fillRect(8, 4, 20, 26);   // dust on every leaf
    g.fillStyle = '#5a5a52'; g.fillRect(12, 32, 12, 16);                // the plastic pot
    g.fillStyle = '#6a6a60'; g.fillRect(11, 31, 14, 3);
    g.fillStyle = '#2e2a22'; g.fillRect(14, 33, 8, 2);
    dither(g, 36, 48, 18);
  });
  const plant = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.2),
    new THREE.MeshBasicMaterial({ map: plantT, alphaTest: 0.5, side: THREE.DoubleSide }));
  put(plant, 5.2, 0.6, -3.5);
  solid(5.2, -3.5, 0.45, 0.45);

  // a skirting, because the room would not have been built without one
  put(new THREE.Mesh(new THREE.BoxGeometry(room.W, 0.11, 0.03),
    new THREE.MeshBasicMaterial({ color: 0x6a6458 })), 0, 0.055, -hd + 0.015);
}
