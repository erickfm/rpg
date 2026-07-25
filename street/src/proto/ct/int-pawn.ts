import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither } from './paint';
import { buildRoom } from './interior';
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
export function buildPawn(ctx: CtxBuild): void {
  const DOOR_Z = -59.06;
  const BLD_Z0 = -65.0, BLD_Z1 = -53.0;
  // Outside you face the facade and your right hand runs toward +z; inside you
  // face into the room and your right hand runs toward -x. The two are mirror
  // images because you turned round, so world +z maps to local +x.
  const DOOR_AT = DOOR_Z - (BLD_Z0 + BLD_Z1) / 2;

  const room = buildRoom(ctx, {
    id: 'pawn',
    label: 'into the PAWN SHOP',
    w: 10.0, d: 8.0, h: 2.8,
    palette: { floor: 0x6a6058, wall: 0x7a6f5e, ceil: 0x6e675c, trim: 0x3a2c22 },
    door: {
      x: FACE - 0.45, z: DOOR_Z, r: 1.05,
      at: DOOR_AT, width: 1.15,
      // south along the east walk, same as the tax office. The nearest street
      // furniture is the tree at z = -57.5 and the lamp at z = -51, both clear.
      outX: FACE - 0.9, outZ: DOOR_Z - 1.5, outYaw: -Math.PI / 2, outGy: ctx.KERB_H,
    },
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
  const floorT = pixTex(40, 40, (g) => {
    g.fillStyle = '#6a6058'; g.fillRect(0, 0, 40, 40);
    g.fillStyle = 'rgba(0,0,0,0.10)';
    for (let i = 0; i < 60; i++) g.fillRect((i * 17) % 40, (i * 23) % 40, 3, 1);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 30; i++) g.fillRect((i * 29) % 40, (i * 11) % 40, 2, 2);
    dither(g, 40, 40, 70);
  });
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
  put(worn, DOOR_AT + 0.3, 0.014, -0.4);

  // ── the counter: one run, straight across the back ──
  const CTR_ZC = -hd + 1.1, CTR_D = 0.75;
  const caseT = pixTex(96, 22, (g) => {
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
  });
  const frontT = pixTex(96, 26, (g) => {
    g.fillStyle = '#3a2c22'; g.fillRect(0, 0, 96, 26);
    g.fillStyle = '#4a3a2c';
    for (let x = 2; x < 96; x += 12) g.fillRect(x, 3, 9, 20);      // panelled
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (let x = 2; x < 96; x += 12) g.fillRect(x, 22, 9, 1);
    g.fillStyle = '#5a4636'; g.fillRect(0, 0, 96, 2);
    dither(g, 96, 26, 50);
  });
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

  // ── the back wall, which is now what you walk in facing ──
  //
  // Everything the shop is proud of, hung where the customer sees it over the
  // case and cannot reach it. Read left to right: the tools, the guitars, the
  // brass. That order is deliberate — the guitars are dead centre because they
  // are the thing you come in for.
  const toolT = pixTex(64, 40, (g) => {
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
  });
  put(new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.2), ctx.flat(toolT)), -3.1, 2.05, -hd + 0.07);

  const guitarT = pixTex(96, 44, (g) => {
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
  });
  // Sized and hung to clear the counter top at 1.25 m. Hung centred on the wall
  // instead, the counter ate the bottom half of every instrument — which is the
  // half with the body on it, so a wall of guitars read as a row of necks.
  put(new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.45),
    new THREE.MeshBasicMaterial({ map: guitarT, alphaTest: 0.5 })), 0.4, 2.05, -hd + 0.08);

  const brassT = pixTex(40, 72, (g) => {
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
  });
  put(new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.42),
    new THREE.MeshBasicMaterial({ map: brassT, alphaTest: 0.5 })), 3.9, 2.05, -hd + 0.08);

  // ── the TV stack, standing in the staff strip behind the counter ──
  //
  // Four sets of four different vintages, none of them on. A pawn shop's TV
  // stack is always this: the thing nobody redeemed. Stacked to 2.1 m so it
  // shows well over a 1.25 m counter — a stack you cannot see is not a stack.
  const tvT = pixTex(32, 26, (g) => {
    g.fillStyle = '#4a453c'; g.fillRect(0, 0, 32, 26);
    g.fillStyle = '#2a2a2e'; g.fillRect(3, 3, 20, 17);             // the tube, dark
    g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(4, 4, 18, 6);
    g.fillStyle = '#5a5348'; g.fillRect(25, 4, 5, 16);             // the control panel
    g.fillStyle = '#8a8478'; g.fillRect(26, 6, 3, 2); g.fillRect(26, 10, 3, 2);
    tag(g, 25, 21);
    dither(g, 32, 26, 20);
  });
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
  const cabT = pixTex(48, 40, (g) => {
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
  });
  const cab = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), ctx.flat(cabT));
  cab.rotation.y = Math.PI / 2;                                    // faces +x, into the room
  put(cab, -hw + 0.06, 1.5, -0.6);

  // ── bars on the INSIDE of the window as well as the outside ──
  //
  // The brief asks for them and they are the detail that decides how the room
  // feels: the daylight is already cut into strips before it gets to you. One
  // plane with an alphaTest cutout rather than thirty boxes.
  const barT = pixTex(48, 16, (g) => {
    g.clearRect(0, 0, 48, 16);
    g.fillStyle = '#2e2a26';
    for (let x = 1; x < 48; x += 4) g.fillRect(x, 0, 1, 16);
    g.fillRect(0, 1, 48, 1); g.fillRect(0, 14, 48, 1);
  });
  barT.wrapS = THREE.RepeatWrapping;
  barT.repeat.set(5, 1);
  const bars = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 1.55),
    new THREE.MeshBasicMaterial({ map: barT, alphaTest: 0.5, side: THREE.DoubleSide }));
  put(bars, 2.6, 1.72, hd - 0.14);

  // ── the sign that says the quiet part ──
  const noticeT = pixTex(48, 18, (g) => {
    g.fillStyle = '#ded4b8'; g.fillRect(0, 0, 48, 18);
    g.fillStyle = '#3a2c22'; g.fillRect(0, 0, 48, 1); g.fillRect(0, 17, 48, 1);
    g.fillStyle = '#8a2c22'; g.font = 'bold 7px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('NO CHECKS', 24, 6);
    g.fillStyle = '#3a2c22'; g.font = '5px monospace';
    g.fillText('30 DAYS TO REDEEM', 24, 13);
  });
  put(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), ctx.flat(noticeT)), 2.0, 2.42, -hd + 0.07);

  // two caged bulbs over the counter, hung clear of the ceiling so they light
  // the room rather than painting the plaster above it
  const glowT = pixTex(32, 32, (g) => {
    const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15);
    gr.addColorStop(0, 'rgba(244,214,150,0.40)');
    gr.addColorStop(1, 'rgba(244,214,150,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  });
  const glowM = new THREE.MeshBasicMaterial({
    map: glowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const lx of [-2.6, 2.6]) {
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.12, 8), steelM), lx, room.H - 0.16, CTR_ZC + 0.6);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), glowM);
    gl.rotation.x = Math.PI / 2;
    put(gl, lx, room.H - 0.42, CTR_ZC + 0.6);
  }
}
