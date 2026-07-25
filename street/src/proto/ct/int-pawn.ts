import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import { buildRoom } from './interior';
import { type DoorDecl } from './doors';
import { FACE } from './rng';

// The PAWN SHOP, inside.
//
// ── WHAT WAS WRONG WITH THE FIRST ONE ─────────────────────────────────────
//
// The user: *"pawn shop interior is janky and odd. i immediately hit a counter.
// it's like i'm behind the counter i don't get it."*
//
// The first version took "a pawn shop keeps you at arm's length" and built it
// out of floor area: a counter running the length of the room with a 1.1 m
// strip in front of it. It was a faithful reading of the brief and it was
// wrong, because a metre of floor is not a shop — it is a service passage, and
// with every good thing on the far side of the counter the player read
// themselves as staff rather than as a customer.
//
// The lesson, and it generalises: **"kept at arm's length" is a property of the
// COUNTER, not of the customer's floor.** A high counter with the stock behind
// it says it on its own. Taking the floor away as well says something else —
// that you are not in the shop at all.
//
// So this version keeps every object and moves exactly one thing: the counter.
//
//   · ONE counter, straight across the back, wall to wall. Not wrapping — a
//     wrap is what makes a room read as the wrong side of the counter.
//   · 1.25 m high, which is chest height and is where the arm's length lives.
//   · The whole front of the room is customer floor: 5.8 m of clear depth
//     against the two the brief asked for. You can stand, turn, and walk the
//     length of the case without touching a wall.
//   · You land in the middle of that floor facing the shop, so the first thing
//     you see is the case, the guitars over it and the cage — not a worktop
//     40 cm from your face.
//
// Everything worth having is still behind the counter and still unreachable.
// That is the pawn shop. The customer just has somewhere to stand now.
//
// ── THE DOOR ──────────────────────────────────────────────────────────────
//
// PAWN stands on the east side of the block, z ∈ [-65.0, -53.0] in street.ts's
// EAST roster, facade on x = +7.0. `pawnFront` still paints no door — the only
// shopfront painter in that file that does not — so the desk set the door at
// the house convention, z = -59.06, which is the building's centre to within
// 6 cm.
//
// `at` is DERIVED from that world position rather than typed, so when the
// frontage descriptor lands and publishes a door centre, changing DOOR_Z moves
// the room's doorway, the standing room and the [E] spot together. Typing a
// local offset beside a world one is exactly how the diner's prompt ended up
// outside the bank.
/**
 * WHERE THIS ROOM'S DOOR IS — declared by the ROOM; the facade follows it.
 * See ct/doors.ts for why that direction. Written against the position this
 * room is actually laid out around, so the painted shopfront door moves to
 * match rather than the furniture moving to match the paint.
 */
export const DOOR: DoorDecl = {
  building: 'PAWN', w: 15, cz: -60.5, side: 1, at: 0, width: 1.15,
};

export function buildPawn(ctx: CtxBuild): void {
  const BLD_Z0 = -65.0, BLD_Z1 = -53.0;
  // Outside you face the facade and your right hand runs toward +z; inside you
  // face into the room and your right hand runs toward -x. The two are mirror
  // images because you turned round, so world +z maps to local +x.

  const room = buildRoom(ctx, {
    id: 'pawn',
    label: 'into the PAWN SHOP',
    d: 8.0, h: 2.8,
    palette: { floor: 0x6a6058, wall: 0x7a6f5e, ceil: 0x6e675c, trim: 0x3a2c22 },
    // The width DERIVES from the frontage now — roomWidthFor(15) = 13.8.
    //
    // It was pinned at an explicit 10.0 with the reason "a room that silently
    // grows to 13.8 strands its own fittings in the middle of the floor". That
    // was a fair worry and it does not hold: every fitting in here is placed
    // against `hw` or `room.doorAt`, not against a remembered number, so they
    // all tracked the walls. Tried it and looked — counter spans the full run,
    // the tools/guitars/brass spread across the longer back wall, the island
    // and the shelving unit stay against their own walls. Nothing stranded.
    //
    // And the pinned version had a cost the note did not mention: a 10 m room
    // behind a 15 m shopfront is the false front the kit's own comment objects
    // to.
    //
    // I also offered this as the likely cause of A's mirror harness reading this
    // room's door 6.23 m off centre. That was wrong and the claim is withdrawn:
    // A traced it to their scan measuring the BACK wall, not the doorway, and
    // retracted the finding. The width change stands on the two reasons above —
    // it does not fix anything, it just stops the room being smaller than the
    // shopfront it sits behind.
    frontage: { name: 'PAWN', w: 15, cz: -60.5, side: 1 },
    door: { r: 1.05, at: DOOR.at, width: DOOR.width },
    // The glazing sits east of the door. One window rather than a pair either
    // side, because the kit opens one — and a pawn shop with a single barred
    // window and a solid pier beside it is right anyway.
    window: { at: 2.6, w: 3.6, h: 1.5, sill: 0.95 },
  });

  const { put, solid } = room;
  const hw = room.W / 2, hd = room.D / 2;
  const DARKWOOD = 0x3a2c22, STEEL = 0x8a8880;
  const woodM = new THREE.MeshBasicMaterial({ color: DARKWOOD });
  const steelM = new THREE.MeshBasicMaterial({ color: STEEL });

  // a handwritten tag, the one thing every object in this room has in common
  const tag = (g: CanvasRenderingContext2D, x: number, y: number) => {
    g.fillStyle = '#ded4b8'; g.fillRect(x, y, 5, 4);
    g.fillStyle = '#3a3630'; g.fillRect(x + 1, y + 1, 3, 1);
    g.fillStyle = '#8a8478'; g.fillRect(x + 2, y - 1, 1, 1);
  };

  // ── the floor ──
  const floorT = declareSurface(pixTex(40, 40, (g) => {
    g.fillStyle = '#6a6058'; g.fillRect(0, 0, 40, 40);
    g.fillStyle = 'rgba(0,0,0,0.10)';
    for (let i = 0; i < 60; i++) g.fillRect((i * 17) % 40, (i * 23) % 40, 3, 1);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 30; i++) g.fillRect((i * 29) % 40, (i * 11) % 40, 2, 2);
    dither(g, 40, 40, 70);
  }), 'ground');
  floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping;
  floorT.repeat.set(Math.round(room.W / 2.0), Math.round(room.D / 2.0));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.W, room.D), ctx.flat(floorT));
  floor.rotation.x = -Math.PI / 2;
  put(floor, 0, 0.012, 0);
  // Worn where people actually stand: a wide patch from the door to the case,
  // not the long thin strip the old corridor left. Wear is evidence of where
  // the room is used, so it has to agree with the new plan or it contradicts it.
  const worn = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.4),
    new THREE.MeshBasicMaterial({ color: 0x7c7268 }));
  worn.rotation.x = -Math.PI / 2;
  // the worn patch follows the DOOR, wherever the facade has put it
  put(worn, room.doorAt + 0.3, 0.014, -0.4);

  // ── the counter: one run, straight across the back ──
  const CTR_ZC = -hd + 1.1, CTR_D = 0.75;
  const caseT = declareSurface(pixTex(96, 22, (g) => {
    g.fillStyle = 'rgba(24,26,28,0.85)'; g.fillRect(0, 0, 96, 22);
    g.fillStyle = '#4a4640'; g.fillRect(0, 10, 96, 1);            // the shelf inside
    // rings on the top shelf, watches on the lower — each on its own tag
    for (let i = 0; i < 11; i++) {
      const x = 4 + i * 8;
      g.strokeStyle = '#c9a45e'; g.lineWidth = 1;
      g.beginPath(); g.arc(x + 2, 5, 2, 0, Math.PI * 2); g.stroke();
      g.fillStyle = i % 3 === 0 ? '#b8c0c8' : '#c9a45e'; g.fillRect(x, 13, 5, 4);
      g.fillStyle = '#8a8478'; g.fillRect(x + 1, 17, 3, 1);
      if (i % 2 === 0) tag(g, x, 18);
    }
    g.fillStyle = 'rgba(190,215,225,0.16)'; g.fillRect(0, 0, 96, 9);  // the glass
    g.fillStyle = '#8a8478'; g.fillRect(0, 0, 96, 1); g.fillRect(0, 21, 96, 1);
  }), 'detail');
  const frontT = declareSurface(pixTex(96, 26, (g) => {
    g.fillStyle = '#3a2c22'; g.fillRect(0, 0, 96, 26);
    g.fillStyle = '#4a3a2c';
    for (let x = 2; x < 96; x += 12) g.fillRect(x, 3, 9, 20);      // panelled
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (let x = 2; x < 96; x += 12) g.fillRect(x, 22, 9, 1);
    g.fillStyle = '#5a4636'; g.fillRect(0, 0, 96, 2);
    dither(g, 96, 26, 50);
  }), 'detail');
  const caseM = ctx.flat(caseT), frontM = ctx.flat(frontT);
  put(new THREE.Mesh(new THREE.BoxGeometry(room.W, 0.9, CTR_D),
    [frontM, frontM, woodM, frontM, frontM, frontM]), 0, 0.45, CTR_ZC);
  put(new THREE.Mesh(new THREE.BoxGeometry(room.W, 0.3, CTR_D),
    [caseM, caseM, caseM, caseM, caseM, caseM]), 0, 1.05, CTR_ZC);
  put(new THREE.Mesh(new THREE.BoxGeometry(room.W, 0.06, CTR_D + 0.1), woodM), 0, 1.23, CTR_ZC);
  // Wall to wall, so the staff strip behind it is sealed without needing a
  // second run of anything. This is the ONE counter and it does not turn.
  solid(0, CTR_ZC, room.W, CTR_D);

  // the till, and a tethered pen on the customer's side of the glass
  put(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.34),
    new THREE.MeshBasicMaterial({ color: 0x4a4a44 })), 3.6, 1.39, CTR_ZC);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.24),
    new THREE.MeshBasicMaterial({ color: 0xded4b8 })), -1.2, 1.27, CTR_ZC + 0.22);

  // ── the broker, behind the counter where he belongs ───────────────────
  //
  // The user: *"the people inside these places are always flat and not like the
  // people on the street"*. This shop had nobody in it, which undercut the
  // whole point of the room — a counter built to keep you at arm's length is
  // just furniture if there is nobody on the other side of it holding the line.
  //
  // He stands in the staff strip behind the counter, facing the customer floor:
  // `facing: PI` is atan2(vx, vz) toward +z, which is out toward the door. A
  // little grime, because this is a shop where the proprietor works the bench
  // himself. `room.person` is the kit's wrapper over the same atlas the street
  // citizens use, and it owns the per-frame turn — see notes/CITIZEN-STYLE.md.
  room.person({ jacket: '#4a4238', pants: '#2e2a26', skin: '#c9946a', hair: '#6a6058',
      accent: '#8a2c22', fit: 'plain', cut: 'bald', build: 1, stride: 2, grime: 0.35 }, room.doorAt + 1.6, CTR_ZC - 0.62, { facing: Math.PI, h: 1.0, w: 1.03 });

  // ── the back wall, which is now what you walk in facing ──
  //
  // Everything the shop is proud of, hung where the customer sees it over the
  // case and cannot reach it. Read left to right: the tools, the guitars, the
  // brass. That order is deliberate — the guitars are dead centre because they
  // are the thing you come in for.
  const toolT = declareSurface(pixTex(64, 40, (g) => {
    g.fillStyle = '#4a453c'; g.fillRect(0, 0, 64, 40);
    g.fillStyle = '#3a3630'; g.fillRect(2, 2, 60, 36);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 4; y < 38; y += 3) for (let x = 4; x < 62; x += 3) g.fillRect(x, y, 1, 1);
    const tools: [number, number, number, number, string][] = [
      [6, 5, 4, 14, '#8a8478'], [14, 5, 3, 11, '#8a8478'], [22, 6, 6, 7, '#6a5a3a'],
      [34, 5, 4, 15, '#8a8478'], [44, 6, 8, 5, '#7a6a4a'], [56, 5, 3, 12, '#8a8478'],
      [6, 24, 7, 9, '#6a5a3a'], [18, 25, 10, 6, '#8a8478'], [34, 23, 5, 11, '#7a6a4a'],
      [46, 25, 9, 7, '#8a8478'],
    ];
    for (const [x, y, w, h, col] of tools) {
      g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(x + 1, y + 1, w, h);
      g.fillStyle = col; g.fillRect(x, y, w, h);
      tag(g, x, y + h);
    }
    g.fillStyle = '#5a5348'; g.fillRect(2, 21, 60, 2); g.fillRect(2, 36, 60, 2);
    dither(g, 64, 40, 40);
  }), 'detail');
  put(new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.2), ctx.flat(toolT)), -3.1, 2.05, -hd + 0.07);

  const guitarT = declareSurface(pixTex(96, 44, (g) => {
    g.clearRect(0, 0, 96, 44);
    const bodies = ['#8a4a2a', '#3a3a44', '#6a3a2a', '#7a6a3a', '#4a2a2a', '#5a5a4a'];
    for (let i = 0; i < 6; i++) {
      const x = 5 + i * 15, col = bodies[i];
      g.fillStyle = '#2e2620'; g.fillRect(x + 4, 2, 2, 22);        // the neck
      g.fillStyle = '#4a3a2a'; g.fillRect(x + 3, 0, 4, 4);         // the head
      g.fillStyle = col;                                           // the body
      g.fillRect(x, 22, 11, 8); g.fillRect(x + 1, 30, 9, 6);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(x + 5, 27, 2, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c9a45e'; g.fillRect(x + 2, 32, 7, 1);
      tag(g, x + 3, 37);
    }
  }), 'detail');
  // Sized and hung to clear the counter top at 1.25 m. Hung centred on the wall
  // instead, the counter ate the bottom half of every instrument — which is the
  // half with the body on it, so a wall of guitars read as a row of necks.
  put(new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.45),
    new THREE.MeshBasicMaterial({ map: guitarT, alphaTest: 0.5 })), 0.4, 2.05, -hd + 0.08);

  const brassT = declareSurface(pixTex(40, 72, (g) => {
    g.clearRect(0, 0, 40, 72);
    g.fillStyle = '#b08a3a';
    g.fillRect(6, 6, 20, 3); g.fillRect(24, 4, 4, 7);              // trumpet + bell
    g.fillStyle = '#c9a45e'; g.fillRect(8, 9, 3, 4); g.fillRect(13, 9, 3, 4); g.fillRect(18, 9, 3, 4);
    tag(g, 10, 14);
    g.fillStyle = '#a8823a';
    g.fillRect(4, 26, 26, 3); g.fillRect(4, 29, 3, 8); g.fillRect(28, 24, 5, 8);  // trombone
    tag(g, 12, 33);
    g.fillStyle = '#b08a3a';                                        // sax
    g.fillRect(14, 46, 4, 14); g.fillRect(12, 60, 10, 6); g.fillRect(15, 42, 3, 5);
    g.fillStyle = '#c9a45e'; for (let i = 0; i < 4; i++) g.fillRect(19, 48 + i * 3, 2, 2);
    tag(g, 24, 56);
  }), 'detail');
  put(new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.42),
    new THREE.MeshBasicMaterial({ map: brassT, alphaTest: 0.5 })), 3.9, 2.05, -hd + 0.08);

  // ── the TV stack, standing in the staff strip behind the counter ──
  //
  // Four sets of four different vintages, none of them on. A pawn shop's TV
  // stack is always this: the thing nobody redeemed. Stacked to 2.1 m so it
  // shows well over a 1.25 m counter — a stack you cannot see is not a stack.
  const tvT = declareSurface(pixTex(32, 26, (g) => {
    g.fillStyle = '#4a453c'; g.fillRect(0, 0, 32, 26);
    g.fillStyle = '#2a2a2e'; g.fillRect(3, 3, 20, 17);             // the tube, dark
    g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(4, 4, 18, 6);
    g.fillStyle = '#5a5348'; g.fillRect(25, 4, 5, 16);             // the control panel
    g.fillStyle = '#8a8478'; g.fillRect(26, 6, 3, 2); g.fillRect(26, 10, 3, 2);
    tag(g, 25, 21);
    dither(g, 32, 26, 20);
  }), 'detail');
  const tvM = ctx.flat(tvT);
  const tvBackM = new THREE.MeshBasicMaterial({ color: 0x3a3630 });
  const sizes: [number, number, number][] = [[0.78, 0.62, 0.55], [0.7, 0.56, 0.5], [0.62, 0.5, 0.46], [0.54, 0.44, 0.42]];
  let ty = 0;
  for (const [w, h, d] of sizes) {
    put(new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      [tvBackM, tvBackM, tvBackM, tvBackM, tvM, tvBackM]), -4.3, ty + h / 2, -hd + 0.42);
    ty += h;
  }

  // ── one floor case, so the customer floor has a reason to exist ──
  //
  // Not a second counter and not a wrap: a low island you walk around, which is
  // what stops 10 × 5.8 m of clear floor reading as a warehouse. Set well west
  // of the door so the way in and the way to the counter are both open.
  const ISL_X = -2.4, ISL_Z = 0.9;
  put(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.78, 0.8),
    [frontM, frontM, woodM, frontM, frontM, frontM]), ISL_X, 0.39, ISL_Z);
  put(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.26, 0.8),
    [caseM, caseM, caseM, caseM, caseM, caseM]), ISL_X, 0.91, ISL_Z);
  put(new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.05, 0.86), woodM), ISL_X, 1.06, ISL_Z);
  solid(ISL_X, ISL_Z, 2.0, 0.8);

  // ── a locked cabinet on the west wall, on the customer's side ──
  //
  // The one thing the customer can walk right up to, and it is still glass and
  // still locked. It keeps that wall from being blank without giving anything
  // away.
  const cabT = declareSurface(pixTex(48, 40, (g) => {
    g.fillStyle = '#3a3630'; g.fillRect(0, 0, 48, 40);
    g.fillStyle = '#241f22'; g.fillRect(3, 3, 42, 34);
    g.fillStyle = '#4a4640'; g.fillRect(3, 14, 42, 1); g.fillRect(3, 26, 42, 1);
    const goods: [number, number, number, number, string][] = [
      [7, 6, 6, 6, '#c9a45e'], [17, 7, 5, 5, '#b8c0c8'], [26, 5, 8, 7, '#8a4a2a'],
      [8, 17, 7, 7, '#7a6a4a'], [20, 18, 9, 5, '#c9a45e'], [33, 17, 6, 7, '#b8c0c8'],
      [7, 29, 10, 6, '#6a5a3a'], [22, 29, 7, 6, '#8a4a2a'], [33, 30, 6, 5, '#c9a45e'],
    ];
    for (const [x, y, w, h, col] of goods) { g.fillStyle = col; g.fillRect(x, y, w, h); tag(g, x, y + h); }
    g.fillStyle = 'rgba(190,215,225,0.14)'; g.fillRect(3, 3, 42, 34);
    g.fillStyle = '#8a8478'; g.fillRect(23, 3, 2, 34);             // the mullion
    dither(g, 48, 40, 26);
  }), 'detail');
  const cab = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), ctx.flat(cabT));
  cab.rotation.y = Math.PI / 2;                                    // faces +x, into the room
  put(cab, -hw + 0.06, 1.5, -0.6);

  // ── the east wall: shelved stereo, and the sign that pays for the shop ──
  //
  // Found by looking, the same way builder F found the diner's bare wall. The
  // counter runs along the back and the case sits in the middle of the floor,
  // which left this whole wall — the one on your right as you come in — as
  // plaster. A pawn shop is defined by having something on every surface; an
  // empty wall in one reads as a room that was not finished.
  //
  // Shelved stereo separates, because the brief asks for stereo stacks and the
  // TV stack behind the counter is the only place they were. These are on the
  // CUSTOMER side, which is right: the big electronics are what a shop like
  // this puts where you can see the model numbers, and they are too heavy to
  // walk off with.
  const shelfT = declareSurface(pixTex(72, 48, (g) => {
    g.fillStyle = '#3a3630'; g.fillRect(0, 0, 72, 48);
    g.fillStyle = '#4a453c'; g.fillRect(1, 1, 70, 46);
    // four shelves of separates — amps, decks, tuners, a pair of speakers
    for (let r = 0; r < 4; r++) {
      const y = 3 + r * 11;
      g.fillStyle = '#2a2620'; g.fillRect(2, y + 9, 68, 2);            // the shelf edge
      const kit: [number, number, string][] = r === 3
        ? [[4, 26, '#2e2a26'], [42, 26, '#2e2a26']]                     // speakers, bottom
        : [[4, 20, '#3a3a40'], [26, 18, '#33333a'], [46, 22, '#3a3a40']];
      for (const [x, w, col] of kit) {
        g.fillStyle = col; g.fillRect(x, y, w, 9);
        g.fillStyle = '#8a8478'; g.fillRect(x + 1, y + 1, w - 2, 1);    // the fascia line
        g.fillStyle = '#c9a45e'; g.fillRect(x + 2, y + 5, 3, 2);        // a dial
        g.fillStyle = '#6a8a6a'; g.fillRect(x + w - 6, y + 4, 4, 2);    // a lit meter
        tag(g, x + Math.round(w / 2) - 2, y + 9);
      }
    }
    dither(g, 72, 48, 44);
  }), 'detail');
  const SH_W = 3.6, SH_H = 2.0, SH_X = hw - 0.22;
  const carcM = new THREE.MeshBasicMaterial({ color: 0x3a3630 });
  // Index 1 is the -x face, which is the one looking into the room. Index 0 is
  // +x and points into the wall — the same slip that hid the marquee's copy
  // against the brick outside. On a box, work out which face the player is on
  // before choosing the slot.
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.42, SH_H, SH_W),
    [carcM, ctx.flat(shelfT), carcM, carcM, carcM, carcM]);
  shelf.position.set(0, 0, 0);
  put(shelf, SH_X, SH_H / 2, -0.4);
  solid(SH_X, -0.4, 0.42, SH_W);

  // WE BUY GOLD, over it. The one sign a pawn shop always has, and the only
  // thing in this room that is addressed to the street rather than to you.
  const goldT = declareSurface(pixTex(64, 18, (g) => {
    g.fillStyle = '#2a2018'; g.fillRect(0, 0, 64, 18);
    g.fillStyle = '#8a6a2c'; g.fillRect(0, 0, 64, 1); g.fillRect(0, 17, 64, 1);
    g.fillStyle = '#e8c25a'; g.font = 'bold 9px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('WE BUY GOLD', 32, 9);
  }), 'sign');
  const goldSign = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.54), ctx.flat(goldT));
  goldSign.rotation.y = -Math.PI / 2;                 // faces -x, into the room
  put(goldSign, hw - 0.06, 2.32, -0.4);

  // and two horns hung high where nothing can reach them
  const hornT = declareSurface(pixTex(40, 24, (g) => {
    g.clearRect(0, 0, 40, 24);
    g.fillStyle = '#b08a3a';
    g.fillRect(3, 4, 22, 3); g.fillRect(23, 2, 5, 7);
    g.fillStyle = '#c9a45e'; for (const x of [7, 12, 17]) g.fillRect(x, 7, 3, 3);
    tag(g, 9, 11);
    g.fillStyle = '#a8823a';
    g.fillRect(3, 16, 24, 3); g.fillRect(26, 14, 5, 7);
    tag(g, 12, 19);
  }), 'detail');
  const horns = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9),
    new THREE.MeshBasicMaterial({ map: hornT, alphaTest: 0.5 }));
  horns.rotation.y = -Math.PI / 2;
  put(horns, hw - 0.06, 2.3, 2.1);

  // ── bars on the INSIDE of the window as well as the outside ──
  //
  // The brief asks for them and they are the detail that decides how the room
  // feels: the daylight is already cut into strips before it gets to you. One
  // plane with an alphaTest cutout rather than thirty boxes.
  const barT = declareSurface(pixTex(48, 16, (g) => {
    g.clearRect(0, 0, 48, 16);
    g.fillStyle = '#2e2a26';
    for (let x = 1; x < 48; x += 4) g.fillRect(x, 0, 1, 16);
    g.fillRect(0, 1, 48, 1); g.fillRect(0, 14, 48, 1);
  }), 'detail');
  barT.wrapS = THREE.RepeatWrapping;
  barT.repeat.set(5, 1);
  const bars = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 1.55),
    new THREE.MeshBasicMaterial({ map: barT, alphaTest: 0.5, side: THREE.DoubleSide }));
  put(bars, 2.6, 1.72, hd - 0.14);

  // ── the sign that says the quiet part ──
  const noticeT = declareSurface(pixTex(48, 18, (g) => {
    g.fillStyle = '#ded4b8'; g.fillRect(0, 0, 48, 18);
    g.fillStyle = '#3a2c22'; g.fillRect(0, 0, 48, 1); g.fillRect(0, 17, 48, 1);
    g.fillStyle = '#8a2c22'; g.font = 'bold 7px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('NO CHECKS', 24, 6);
    g.fillStyle = '#3a2c22'; g.font = '5px monospace';
    g.fillText('30 DAYS TO REDEEM', 24, 13);
  }), 'sign');
  put(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), ctx.flat(noticeT)), 2.0, 2.42, -hd + 0.07);

  // two caged bulbs over the counter, hung clear of the ceiling so they light
  // the room rather than painting the plaster above it
  const glowT = declareSurface(pixTex(32, 32, (g) => {
    const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15);
    gr.addColorStop(0, 'rgba(244,214,150,0.40)');
    gr.addColorStop(1, 'rgba(244,214,150,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  }), 'detail');
  const glowM = new THREE.MeshBasicMaterial({
    map: glowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const lx of [-2.6, 2.6]) {
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.12, 8), steelM), lx, room.H - 0.16, CTR_ZC + 0.6);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), glowM);
    gl.rotation.x = Math.PI / 2;
    put(gl, lx, room.H - 0.42, CTR_ZC + 0.6);
  }
}
