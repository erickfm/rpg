import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import { buildRoom } from './interior';
import { type DoorDecl } from './doors';
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
  const carpetT = declareSurface(pixTex(48, 48, (g) => {
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
  }), 'ground');
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
  const ceilT = declareSurface(pixTex(32, 32, (g) => {
    g.fillStyle = '#b6b2a2'; g.fillRect(0, 0, 32, 32);           // the T-bar
    g.fillStyle = '#cdc9b8'; g.fillRect(1, 1, 30, 30);           // the tile
    g.fillStyle = 'rgba(0,0,0,0.05)';                            // its fissured face
    for (let i = 0; i < 26; i++) {
      g.fillRect(3 + ((i * 7) % 26), 3 + ((i * 11) % 26), 2, 1);
    }
    g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(1, 1, 30, 1);
    dither(g, 32, 32, 18);
  }), 'detail');
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
  const glowT = declareSurface(pixTex(32, 32, (g) => {
    const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15);
    gr.addColorStop(0, 'rgba(226,232,214,0.34)');
    gr.addColorStop(1, 'rgba(226,232,214,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  }), 'detail');
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
  const cabT = declareSurface(pixTex(64, 44, (g) => {
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
  }), 'detail');
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
  const deskTopT = declareSurface(pixTex(48, 32, (g) => {
    g.fillStyle = '#a89c82'; g.fillRect(0, 0, 48, 32);            // oak-effect laminate
    g.fillStyle = 'rgba(120,90,50,0.16)';
    for (let i = 0; i < 40; i++) g.fillRect(0, (i * 5) % 32, 48, 1);
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, 0, 48, 1);
    dither(g, 48, 32, 26);
  }), 'detail');
  const deskTopM = ctx.flat(deskTopT);
  const deskSideM = new THREE.MeshBasicMaterial({ color: 0x6e6a60 });
  const paperM = new THREE.MeshBasicMaterial({ color: 0xe4dfcc });
  // The two chair positions, named because the preparer's FACING is derived from
  // them (GOTCHAS §23). Local z, and the client sits on the +z side — nearer the
  // door — with the preparer beyond the desk on the -z side.
  const PREP_CZ = -2.15, CLIENT_CZ = -0.75;
  const LAMP_DX = -2.6;              // the desk that is in use; the other is spare

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
    chair(PREP_CZ, 0x4a5560, 0.5);    // the preparer's, blue-grey, with a back
    chair(CLIENT_CZ, 0x6a5f4e, 0.42); // the client's, brown, and lower
    // AND THE CLIENT'S CHAIR IS SITTABLE, which it was not. The standing rule is
    // *"for every seat in the game i want to be able to sit down"*, and this room
    // registered the three waiting chairs by the door and neither of the two
    // chairs a client actually uses — the ones at the desks, facing the preparer.
    // `interiors-walk` even calls local (-2.6, -0.75) "the client chair" as its
    // customer station, so the harness knew about a seat the room did not offer.
    //
    // The seat top is read off `chair()` above: a 0.09 box centred at 0.44, so
    // 0.485. Facing -z, across the desk at the preparer, which is the whole point
    // of that chair. Approach a stride back from it on the door side, so the sit
    // spot and the stand spot cannot share a coordinate.
    ctx.seat({
      x: room.wx(dx), z: room.wz(CLIENT_CZ), yaw: 0, h: 0.485,
      approach: { x: room.wx(dx), z: room.wz(CLIENT_CZ + 0.85) },
      label: 'sit down with the preparer', ok: () => room.inside(),
    });
    // ONE collider for the desk and both its chairs. The gaps between them are
    // under the 0.72 m player, so per-object boxes would only carve slots to
    // wedge into — the lesson the diner's booths taught.
    solid(dx, -1.15, 1.9, 1.9);
  };
  desk(LAMP_DX, true);
  desk(1.4, false);

  // ── the preparer, at the desk that has the lamp ───────────────────────
  //
  // The user: *"the people inside these places are always flat and not like the
  // people on the street"*. One person, at one of the two desks — the one with
  // the lamp on it, because that is the desk that is being used and the other
  // one is the reason this office has two.
  //
  // FACING IS DERIVED FROM THE CLIENT CHAIR, not typed. GOTCHAS §23: anything
  // with a front will end up backwards if its heading is a constant copied from
  // a sibling, and this one was — it read `facing: Math.PI` with a comment
  // claiming PI was "toward +z, out toward the door". It is not. `person` takes
  // `atan2(vx, vz)` with 0 = +z, so PI points at -z, which is the back wall. The
  // preparer stood beside his desk looking away from the person he is serving,
  // and the comment asserting otherwise is why it survived a reading.
  //
  // Now: he stands behind his own chair and looks at the client's. Move either
  // chair and the heading follows.
  //
  // Deliberately the dullest Look in the world: grey-blue shirt, grey trousers,
  // nothing accented. This room's whole joke is that it is drab on purpose and
  // made with care, and a flamboyant preparer would break it.
  //
  // Standing rather than seated: the atlas paints people upright and a sitting
  // pose is not one of its five views, so he is on his feet beside the chair —
  // a preparer who has got up to file something. Faking a sit by sinking the
  // sprite into the floor would cut his legs off at the shin.
  const PREP_X = LAMP_DX, PREP_Z = PREP_CZ - 0.30;      // stood behind his chair
  room.person({ jacket: '#5a6470', pants: '#4a4a44', skin: '#e6bb92', hair: '#4a4038',
      fit: 'plain', cut: 'short', build: 0, stride: 2 }, PREP_X, PREP_Z,
    { facing: Math.atan2(LAMP_DX - PREP_X, CLIENT_CZ - PREP_Z), h: 0.99, w: 0.98 });

  // ── the pinboard ──
  //
  // West wall. IRS notices, a rates table and a curling poster, each pinned at
  // its own small angle — the only thing in this room that is not square, and
  // only because paper will not stay square.
  const boardT = declareSurface(pixTex(80, 56, (g) => {
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
  }), 'sign');
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.2), ctx.flat(boardT));
  board.rotation.y = Math.PI / 2;                                 // faces +x, into the room
  put(board, -hw + 0.06, 1.55, -1.0);

  // ── the wall clock ──
  //
  // The casino has no clock, on purpose. This room has one, on purpose, and it
  // is the plainest object in it: a white face, black hands, a grey rim, hung
  // dead centre over the cabinets where everybody waiting can watch it.
  const clockT = declareSurface(pixTex(32, 32, (g) => {
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
  }), 'sign');
  const clock = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42),
    new THREE.MeshBasicMaterial({ map: clockT, alphaTest: 0.5 }));
  put(clock, 0, 2.18, -hd + 0.06);

  // ── the fake plant ──
  //
  // THE FOLIAGE WAS NOT JOINED TO THE POT, and the user asked what was wrong
  // with it rather than calling it a bad plant, which is the tell.
  //
  // The desk's guess was that the pot and the foliage are two objects taking y
  // from two places, and to parent one to the other. Worth checking before
  // fixing: they are not two objects. It is ONE plane and ONE texture, so
  // nothing can drift — the gap is DRAWN IN. On the old 36x48 canvas the leaf
  // sprays ran from y 4 to about y 20 and the pot started at y 31, so 11 texels
  // of a 48-texel plane — 0.275 m of the 1.2 m it stood — was blank between
  // them, and no stem was drawn at all. Same visible fault, different cause, and
  // the fix is not a parent or a nudge: it is to draw the thing joined.
  //
  // The pot was correctly on the floor. That part of the report checks out: the
  // plane sat at y 0.6 with height 1.2, so its bottom edge was exactly 0.
  //
  // AND IT HAD TO BECOME RECOGNISABLE. His standard, from the alley: "i cant
  // tell what any of it is. these should be recognizable." What was there was
  // two diagonal lines of 3x3 blocks radiating from one point — a wide V, which
  // reads as an arrow glyph. This is a dracaena: a short trunk out of visible
  // soil and six blades of DIFFERENT lengths fanning from it, drawn back to
  // front in three tones so they overlap.
  //
  // 40x64 on a 0.9 x 1.44 m plane is ~44 px/m, in line with the other small
  // objects in this world (GOTCHAS 5) and enough canvas to taper a blade.
  const plantT = declareSurface(pixTex(40, 64, (g) => {
    // a blade: from base to tip, narrowing, so it reads as a leaf and not a line
    const blade = (bx: number, by: number, tx: number, ty: number, w0: number, col: string) => {
      g.fillStyle = col;
      const n = Math.max(Math.abs(tx - bx), Math.abs(ty - by));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = bx + (tx - bx) * t, y = by + (ty - by) * t;
        const w = Math.max(1, Math.round(w0 * (1 - t * 0.8)));
        g.fillRect(Math.round(x - w / 2), Math.round(y), w, 2);
      }
    };
    // BACK blades first, darkest — the overlap is what stops it reading flat
    blade(20, 42, 5, 19, 5, '#2f4a2a');
    blade(20, 42, 34, 24, 5, '#33512d');
    // middle
    blade(20, 41, 9, 8, 5, '#3f6238');
    blade(20, 41, 31, 11, 5, '#456a3c');
    // front, lightest and shortest, so the eye reads depth
    blade(20, 40, 16, 5, 6, '#4f7a44');
    blade(20, 40, 26, 16, 6, '#4a7040');
    // the trunk, out of the soil and INTO the blades — the join that was missing
    g.fillStyle = '#5a4a30'; g.fillRect(18, 38, 4, 12);
    g.fillStyle = '#6a5838'; g.fillRect(18, 38, 1, 12);
    // dust, on the foliage only: this thing has never been watered or wiped
    g.fillStyle = 'rgba(180,175,150,0.16)'; g.fillRect(4, 4, 32, 34);
    // the soil it stands in, above the rim so you can see it
    g.fillStyle = '#2e2418'; g.fillRect(12, 45, 16, 5);
    g.fillStyle = '#3a2e20'; g.fillRect(14, 45, 5, 2); g.fillRect(22, 46, 4, 2);
    // the plastic pot, tapered, with a rim over the soil line
    for (let y = 47; y < 64; y++) {
      const inset = Math.round((y - 47) * 0.18);
      g.fillStyle = y < 52 ? '#5f5f56' : '#585850';
      g.fillRect(11 + inset, y, 18 - inset * 2, 1);
    }
    g.fillStyle = '#6a6a60'; g.fillRect(10, 44, 20, 3);                 // the rim
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(24, 48, 4, 15);        // one side in shadow
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(12, 48, 2, 14);
    dither(g, 40, 64, 22);
  }), 'detail');
  const plant = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.44),
    new THREE.MeshBasicMaterial({ map: plantT, alphaTest: 0.5, side: THREE.DoubleSide }));
  // 0.72 = half of 1.44, so the pot's base sits ON the floor. Derived from the
  // plane's own height rather than typed, because that is the number the old one
  // got right and the next size change is where it would have been lost.
  // z -3.93, not -3.5: at -3.5 its collider stopped 0.43 m short of the back
  // wall and left a slot behind the pot. Still the same corner, just against the
  // wall the way a pot plant in a corner actually stands.
  put(plant, 5.2, 1.44 / 2, -3.93);
  solid(5.2, -3.93, 0.45, 0.5);

  // ── A WORKING OFFICE, not a furnished one ─────────────────────────────
  //
  // The user, on the plant shot: "the tax office is nearly empty - bare walls,
  // bare floor, one bin, one plant", and F measured it among the three thinnest
  // rooms in the world. His rule with it, which decides everything below: "MORE
  // THINGS IS NOT THE ANSWER ON ITS OWN ... a few considered things arranged and
  // aligned, not clutter. Density is a diagnosis, not a target."
  //
  // So I checked his list against what is already here rather than building it
  // twice. Present and NOT rebuilt: the desks with a chair on each side (the
  // preparer's and the client's, both), the filing cabinet run, the wall clock,
  // the strip lights, the pinboard. Genuinely missing: STACKED FORMS, a FRAMED
  // LICENCE, a NOTICE ABOUT DEADLINES.
  //
  // And the shape of the emptiness matters more than the count. The door is at
  // local x -4.2 in the front wall, the desks sit at z -2.1..-0.2 and the
  // cabinets along the back — so the whole FRONT-EAST quarter, about 8 x 4 m, is
  // bare carpet, and every wall above 1.6 m is bare plaster. That is where these
  // go, and they go against walls in rows, because a row of linked chairs is
  // aligned by construction.
  {
    const boxM = new THREE.MeshBasicMaterial({ color: 0x8a7a5c });      // manila
    const boxLidM = new THREE.MeshBasicMaterial({ color: 0x9a8a6a });
    const chairM = new THREE.MeshBasicMaterial({ color: 0x4a5560 });
    const frameM = new THREE.MeshBasicMaterial({ color: 0x4a4038 });
    const bx = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) =>
      put(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z);

    // A WAITING ROW against the front wall, east of the door, facing the desks.
    // Linked chairs on a common rail is the one piece of furniture that cannot
    // be "strewn about" — it is bolted into a line. Clear of the way-out spot at
    // (-4.2, 3.7): the nearest chair is at x 0.6, 4.8 m away.
    const WAIT_Z = hd - 0.62;
    bx(2.62, 0.06, 0.08, steelM, 1.25, 0.10, WAIT_Z - 0.18);           // the rail
    for (const cx of [0.6, 1.25, 1.9]) {
      bx(0.52, 0.10, 0.46, chairM, cx, 0.42, WAIT_Z);                  // the seat
      bx(0.52, 0.42, 0.07, chairM, cx, 0.68, WAIT_Z - 0.20);           // the back
      for (const sx of [-0.2, 0.2]) bx(0.04, 0.38, 0.04, steelM, cx + sx, 0.19, WAIT_Z + 0.16);
      // every seat sittable, which is the standing rule for anything you can sit
      // on — "for every seat in the game i want to be able to sit down"
      ctx.seat({
        x: room.wx(cx), z: room.wz(WAIT_Z + 0.04), yaw: 0, h: 0.47,
        approach: { x: room.wx(cx), z: room.wz(WAIT_Z - 0.85) },
        label: 'sit and wait', ok: () => room.inside(),
      });
    }
    // The collider reaches THE WALL, not just the back of the chairs. At 0.75
    // deep it stopped 0.30 m short of the plaster and left a slot you could
    // stand in behind a bolted-down row — GOTCHAS 9, and roomaisle caught it as
    // a 0.5 m minimum the moment I measured. Spans z 3.20 -> hd.
    solid(1.25, (3.20 + hd) / 2, 2.9, hd - 3.20);

    // the low table the waiting row shares, with the forms nobody has filled in
    bx(0.72, 0.04, 0.52, frameM, 3.1, 0.44, WAIT_Z - 0.04);
    for (const sx of [-0.3, 0.3]) for (const sz of [-0.18, 0.18]) {
      bx(0.05, 0.42, 0.05, steelM, 3.1 + sx, 0.21, WAIT_Z - 0.04 + sz);
    }
    bx(0.26, 0.03, 0.34, paperM, 3.02, 0.475, WAIT_Z - 0.04);
    bx(0.22, 0.02, 0.30, paperM, 3.3, 0.475, WAIT_Z + 0.06);
    solid(3.1, (3.34 + hd) / 2, 0.9, hd - 3.34);          // to the wall, same reason

    // STACKED FORMS — the thing a tax office has more of than anything else.
    // Boxed and stacked on the floor at the end of the cabinet run, where the
    // overflow actually goes, and squared to the back wall.
    // x 2.85 and 3.65, so the first stack's collider butts against the cabinet
    // run's east end at 2.5 and the second against the first — no 0.5 m slot
    // between a stack and the cabinets, which is where one was.
    for (const [sx, n] of [[2.85, 3], [3.65, 2]] as [number, number][]) {
      for (let i = 0; i < n; i++) {
        bx(0.62, 0.30, 0.42, boxM, sx, 0.15 + i * 0.31, -hd + 0.34);
        bx(0.64, 0.03, 0.44, boxLidM, sx, 0.31 + i * 0.31, -hd + 0.34);
        // the label everybody writes on the end of a box of forms
        bx(0.24, 0.10, 0.02, paperM, sx, 0.18 + i * 0.31, -hd + 0.34 + 0.22);
      }
      solid(sx, -hd + 0.34, 0.7, 0.5);
    }

    // A WATER COOLER in the bare front-east corner. Recognisable in one second,
    // which is the standard he set on the alley — "i cant tell what any of it is.
    // these should be recognizable" — and a 1997 office has one.
    {
      const CX2 = hw - 0.55, CZ2 = 2.5;
      bx(0.42, 0.92, 0.42, new THREE.MeshBasicMaterial({ color: 0xd8d4c8 }), CX2, 0.46, CZ2);
      bx(0.30, 0.06, 0.30, steelM, CX2, 0.95, CZ2);                    // the collar
      // the bottle: blue, and visibly a bottle rather than a box — narrow neck
      const water = new THREE.MeshBasicMaterial({ color: 0x7ba8c4 });
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.14, 0.44, 10), water), CX2, 1.20, CZ2);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.17, 0.14, 10), water), CX2, 1.49, CZ2);
      bx(0.06, 0.10, 0.06, new THREE.MeshBasicMaterial({ color: 0x3a5a6a }), CX2 - 0.24, 0.62, CZ2);
      // the cone cups, in their tube on the side
      bx(0.09, 0.26, 0.09, paperM, CX2 + 0.24, 0.74, CZ2);
      // to the east wall in x, so there is no 0.19 m slot behind it
      solid((5.075 + (hw - 0.09)) / 2, CZ2, (hw - 0.09) - 5.075, 0.55);
    }

    // THE FRAMED LICENCE AND THE DEADLINE NOTICE, on the east wall — the one
    // wall in this room with nothing on it at all. Hung on ONE line at one
    // height, because two frames at two heights is the "off center and stuff"
    // the hotel just had to answer for.
    //
    // Lettering is drawn from a 3x5 block font rather than with fillText: this
    // room's text has to be crisp at 1.7 m and canvas text ANTIALIASES, which is
    // what made the casino blade blurry. A rect per texel cannot have a fringe.
    const F35: Record<string, string[]> = {
      A: ['111', '101', '111', '101', '101'], P: ['111', '101', '111', '100', '100'],
      R: ['111', '101', '111', '110', '101'], I: ['111', '010', '010', '010', '111'],
      L: ['100', '100', '100', '100', '111'], D: ['110', '101', '101', '101', '110'],
      U: ['101', '101', '101', '101', '111'], E: ['111', '100', '111', '100', '111'],
      '1': ['010', '110', '010', '010', '111'], '5': ['111', '100', '111', '001', '111'],
      ' ': ['000', '000', '000', '000', '000'],
    };
    const word = (g: CanvasRenderingContext2D, s: string, x: number, y: number, px: number, col: string) => {
      g.fillStyle = col;
      let cx2 = x;
      for (const ch of s) {
        const rows = F35[ch] ?? F35[' '];
        for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
          if (rows[r][c] === '1') g.fillRect(cx2 + c * px, y + r * px, px, px);
        }
        cx2 += 4 * px;
      }
      return cx2 - x - px;                       // the drawn width, so it can be centred
    };

    // the deadline notice: the one piece of paper in the room a client reads
    const dueT = declareSurface(pixTex(48, 34, (g) => {
      g.fillStyle = '#e8e2cc'; g.fillRect(0, 0, 48, 34);
      g.fillStyle = '#8a2c22'; g.fillRect(0, 0, 48, 3); g.fillRect(0, 31, 48, 3);
      word(g, 'APR 15', 5, 8, 2, '#2e2a24');
      word(g, 'DUE', 17, 21, 2, '#8a2c22');
      dither(g, 48, 34, 12);
    }), 'sign');
    const due = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.52), ctx.flat(dueT));
    due.rotation.y = -Math.PI / 2;                                     // faces -x, into the room
    put(due, hw - 0.07, 1.70, 0.4);
    bx(0.04, 0.60, 0.82, frameM, hw - 0.04, 1.70, 0.4);

    // the licence, beside it on the same line: a certificate is mostly seal,
    // rule and signature, and none of it is meant to be read from the floor
    const licT = declareSurface(pixTex(40, 34, (g) => {
      g.fillStyle = '#dfe0d4'; g.fillRect(0, 0, 40, 34);
      g.fillStyle = '#b8ae90'; g.fillRect(2, 2, 36, 30);
      g.fillStyle = '#e8e4d2'; g.fillRect(4, 4, 32, 26);
      g.fillStyle = 'rgba(70,62,50,0.55)';
      for (let ly = 8; ly < 22; ly += 3) g.fillRect(7, ly, 26 - ((ly * 5) % 7), 1);
      g.fillStyle = '#8a7a3a'; g.beginPath(); g.arc(11, 26, 3, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(60,52,42,0.7)'; g.fillRect(18, 26, 15, 1);   // the signature
      dither(g, 40, 34, 10);
    }), 'sign');
    const lic = new THREE.Mesh(new THREE.PlaneGeometry(0.60, 0.50), ctx.flat(licT));
    lic.rotation.y = -Math.PI / 2;
    put(lic, hw - 0.07, 1.70, -0.9);
    bx(0.04, 0.58, 0.68, frameM, hw - 0.04, 1.70, -0.9);

    // a coat stand by the door, because everybody who comes in here in April is
    // wearing a coat. Just outside the way-out spot's reach, against the wall.
    {
      const KX = -2.3, KZ = hd - 0.5;
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.72, 6), steelM), KX, 0.86, KZ);
      put(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 10),
        new THREE.MeshBasicMaterial({ color: DARKSTEEL })), KX, 0.02, KZ);
      // Arms with HOOKS on them, and a coat hanging. A bare pole with three
      // 0.20 x 0.03 stubs read as a stanchion — I could not name it in one
      // second from the door, which is his test. The thing that makes a coat
      // stand a coat stand is a coat.
      for (const a of [0, 2.09, 4.19]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.045, 0.045), steelM);
        arm.rotation.y = a;
        put(arm, KX + Math.cos(a) * 0.15, 1.68, KZ + Math.sin(a) * 0.15);
        // the hook turned up at the end of each arm
        const hook = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.05), steelM);
        put(hook, KX + Math.cos(a) * 0.29, 1.73, KZ + Math.sin(a) * 0.29);
      }
      // somebody's overcoat, on the arm facing the room: shoulders, then body,
      // in the drab brown every coat in this world's crowd is
      const coatM = new THREE.MeshBasicMaterial({ color: 0x5a4a3a });
      bx(0.38, 0.15, 0.20, coatM, KX + 0.20, 1.55, KZ);
      bx(0.33, 0.74, 0.17, coatM, KX + 0.20, 1.10, KZ);
      bx(0.33, 0.05, 0.18, new THREE.MeshBasicMaterial({ color: 0x4a3c2e }),
        KX + 0.20, 1.46, KZ);                                          // the belt line
      solid(KX, (3.50 + hd) / 2, 0.45, hd - 3.50);        // to the wall, same reason
    }
  }

  // a skirting, because the room would not have been built without one
  put(new THREE.Mesh(new THREE.BoxGeometry(room.W, 0.11, 0.03),
    new THREE.MeshBasicMaterial({ color: 0x6a6458 })), 0, 0.055, -hd + 0.015);
}
