import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither } from './paint';
import { buildRoom } from './interior';
import { FACE } from './rng';

// The PAWN SHOP, inside.
//
// The queue gave this room its plan in one sentence: *"a pawn shop is built to
// keep you at arm's length, and the geometry can say that."* So the geometry
// says it, and everything else follows from that one decision:
//
//   · a 1.25 m counter — chest height, not waist height — running the whole
//     room bar the entry pocket, with the east end hard against the wall so
//     there is no way round it;
//   · a customer strip 1.1 m deep in front of it. You come in, you turn, and
//     you shuffle sideways along a slot. That is the entire floor you get;
//   · everything worth having is on the far side of it. The tools, the TV
//     stack, the guitars and the brass are all visible and none of them is
//     reachable, which is the difference between a pawn shop and a junk shop;
//   · bars on the INSIDE of the window as well as the outside, so the light
//     coming in is already cut into strips before it reaches you.
//
// Every price is handwritten on a tag, because a pawn shop has no two of
// anything and therefore nothing it can print a label for.
//
// ── THE DOOR IS AN ASSUMPTION, AND IT IS THE ONLY ONE ─────────────────────
//
// PAWN stands on the east side of the block, z ∈ [-65.0, -53.0] in street.ts's
// EAST roster, facade on x = +7.0. But `pawnFront` PAINTS NO DOOR — it is a
// board, a barred window and a stallriser, and unlike burgerFront (W*0.44),
// taxFront (W*0.5) and shopfrontTex (W*0.48) there is no door rect anywhere in
// it. `street.ts` is D's and this is raised with the desk, so rather than stall
// the whole room on one number, the [E] spot below is placed where the house
// convention would put a door — shopfrontTex's W*0.48, which on a 12 m / 96
// texel front lands at z = -59.06, within 6 cm of the building's centre.
//
// Nothing else in this file depends on it. When D paints the door, DOOR_Z is
// the one line to change, and any door drawn to any of the three existing
// conventions lands inside this spot's 1.05 m trigger anyway.
export function buildPawn(ctx: CtxBuild): void {
  const DOOR_Z = -59.06;
  const room = buildRoom(ctx, {
    id: 'pawn',
    label: 'into the PAWN SHOP',
    w: 11.0, d: 8.0, h: 2.8,
    palette: { floor: 0x6a6058, wall: 0x7a6f5e, ceil: 0x6e675c, trim: 0x3a2c22 },
    door: {
      x: FACE - 0.45, z: DOOR_Z, r: 1.05,
      // The door has its OWN pocket at the west end, and that is load-bearing
      // rather than decorative: the kit lands you at (door.at, hd - 1.15), so
      // a counter that spanned the door's x would have to sit at least 1.51 m
      // back to keep the landing clear — and 1.51 m of customer floor is not a
      // pawn shop, it is a shop. Putting the door beside the counter instead
      // lets the counter come forward to 1.1 m and the brief survives.
      at: -4.3, width: 1.15,
      // south along the east walk, same as the tax office. The nearest street
      // furniture is the tree at z = -57.5 and the lamp at z = -51, both clear.
      outX: FACE - 0.9, outZ: DOOR_Z - 1.5, outYaw: -Math.PI / 2, outGy: ctx.KERB_H,
    },
    window: { at: 1.6, w: 4.6, h: 1.5, sill: 0.95 },
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
  // Sheet vinyl in a colour chosen to not show anything, scuffed to bare in
  // the one strip customers are allowed to stand in.
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
  // the worn strip, exactly as wide as the slot you are allowed to stand in
  const worn = new THREE.Mesh(new THREE.PlaneGeometry(9.0, 1.0),
    new THREE.MeshBasicMaterial({ color: 0x7c7268 }));
  worn.rotation.x = -Math.PI / 2;
  put(worn, 0.9, 0.014, hd - 0.55);

  // ── the counter: a long glass case, and the room's whole argument ──
  const CTR_X0 = -3.3, CTR_X1 = hw, CTR_ZC = 2.55, CTR_D = 0.7;
  const CTR_CX = (CTR_X0 + CTR_X1) / 2, CTR_W = CTR_X1 - CTR_X0;
  const caseT = pixTex(96, 22, (g) => {
    g.fillStyle = 'rgba(24,26,28,0.85)'; g.fillRect(0, 0, 96, 22);
    g.fillStyle = '#4a4640'; g.fillRect(0, 10, 96, 1);            // the shelf inside
    // rings on the top shelf, watches on the lower — each on its own tag
    for (let i = 0; i < 11; i++) {
      const x = 4 + i * 8;
      g.fillStyle = '#c9a45e'; g.beginPath(); g.arc(x + 2, 5, 2, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = '#c9a45e'; g.lineWidth = 1; g.stroke();
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
  // the solid base, chest-high…
  put(new THREE.Mesh(new THREE.BoxGeometry(CTR_W, 0.9, CTR_D),
    [frontM, frontM, woodM, frontM, frontM, frontM]), CTR_CX, 0.45, CTR_ZC);
  // …the glass case on top of it, which is where everything small lives…
  put(new THREE.Mesh(new THREE.BoxGeometry(CTR_W, 0.3, CTR_D),
    [caseM, caseM, caseM, caseM, caseM, caseM]), CTR_CX, 1.05, CTR_ZC);
  // …and the worn timber top you put your hands on
  put(new THREE.Mesh(new THREE.BoxGeometry(CTR_W, 0.06, CTR_D + 0.1), woodM), CTR_CX, 1.23, CTR_ZC);
  solid(CTR_CX, CTR_ZC, CTR_W, CTR_D);

  // the till, and the tethered pen, on the customer's side of nothing
  put(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.34),
    new THREE.MeshBasicMaterial({ color: 0x4a4a44 })), 4.2, 1.39, CTR_ZC);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.24),
    new THREE.MeshBasicMaterial({ color: 0xded4b8 })), -1.4, 1.27, CTR_ZC + 0.2);

  // ── the tool wall, filling the west end so there is no way round ──
  //
  // It reads as the shop's deep shelving, and it is also the thing that makes
  // the entry pocket a pocket: without it you would simply walk down the west
  // side and round the back of the counter, and the room would stop meaning
  // anything.
  const toolT = pixTex(64, 88, (g) => {
    g.fillStyle = '#4a453c'; g.fillRect(0, 0, 64, 88);
    g.fillStyle = '#3a3630'; g.fillRect(2, 2, 60, 84);
    // pegboard, and the shadow-board outlines of tools that are gone
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 4; y < 86; y += 3) for (let x = 4; x < 62; x += 3) g.fillRect(x, y, 1, 1);
    const tools: [number, number, number, number, string][] = [
      [6, 6, 4, 20, '#8a8478'], [14, 6, 3, 16, '#8a8478'], [22, 8, 6, 10, '#6a5a3a'],
      [34, 6, 4, 22, '#8a8478'], [44, 8, 8, 6, '#7a6a4a'], [56, 6, 3, 18, '#8a8478'],
      [6, 32, 7, 12, '#6a5a3a'], [18, 34, 10, 8, '#8a8478'], [34, 32, 5, 16, '#7a6a4a'],
      [46, 34, 9, 10, '#8a8478'], [8, 52, 12, 9, '#6a5a3a'], [26, 52, 6, 14, '#8a8478'],
      [40, 54, 11, 8, '#7a6a4a'], [8, 70, 9, 11, '#8a8478'], [24, 70, 14, 7, '#6a5a3a'],
      [44, 68, 6, 13, '#8a8478'],
    ];
    for (const [x, y, w, h, col] of tools) {
      g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(x + 1, y + 1, w, h);
      g.fillStyle = col; g.fillRect(x, y, w, h);
      tag(g, x, y + h);
    }
    // the shelf edges
    g.fillStyle = '#5a5348';
    for (const y of [29, 49, 65, 84]) g.fillRect(2, y, 60, 2);
    dither(g, 64, 88, 60);
  });
  const UNIT_X0 = -hw, UNIT_X1 = -3.5, UNIT_Z0 = -hd, UNIT_Z1 = 2.15;
  const uCx = (UNIT_X0 + UNIT_X1) / 2, uCz = (UNIT_Z0 + UNIT_Z1) / 2;
  const uW = UNIT_X1 - UNIT_X0, uD = UNIT_Z1 - UNIT_Z0;
  const toolM = ctx.flat(toolT);
  const carcM = new THREE.MeshBasicMaterial({ color: 0x4a453c });
  put(new THREE.Mesh(new THREE.BoxGeometry(uW, 2.3, uD),
    [toolM, toolM, carcM, carcM, toolM, toolM]), uCx, 1.15, uCz);
  solid(uCx, uCz, uW, uD);

  // ── the far wall: guitars over a bench, all of it out of reach ──
  const guitarT = pixTex(96, 44, (g) => {
    g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, 96, 44);
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
  const guitars = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 3.0),
    new THREE.MeshBasicMaterial({ map: guitarT, alphaTest: 0.5 }));
  put(guitars, 1.4, 1.65, -hd + 0.07);
  // the wall they hang on, and the bench under them
  put(new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.85, 0.55), woodM), 1.1, 0.42, -hd + 0.3);

  // ── brass, on the east wall ──
  const brassT = pixTex(40, 72, (g) => {
    g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, 40, 72);
    // a trumpet, a trombone and a sax, read as silhouettes because that is all
    // a brass instrument is at eight pixels to the metre
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
  const brass = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.7),
    new THREE.MeshBasicMaterial({ map: brassT, alphaTest: 0.5 }));
  brass.rotation.y = -Math.PI / 2;
  put(brass, hw - 0.07, 1.6, -1.2);

  // ── the TV stack ──
  //
  // Four sets of four different vintages stacked in a corner, none of them on.
  // A pawn shop's TV stack is always this: the thing nobody redeemed.
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
  const sizes: [number, number, number][] = [[0.78, 0.62, 0.6], [0.7, 0.56, 0.55], [0.62, 0.5, 0.5], [0.54, 0.44, 0.46]];
  let ty = 0;
  for (const [w, h, d] of sizes) {
    put(new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      [tvBackM, tvBackM, tvBackM, tvBackM, tvM, tvBackM]), 4.3, ty + h / 2, -2.9);
    ty += h;
  }

  // ── bars on the INSIDE of the window ──
  //
  // The brief asks for them explicitly, and they are the detail that decides
  // how this room feels: the daylight is already cut into strips before it
  // gets to you. One plane with an alphaTest cutout rather than thirty boxes —
  // the world draws detail with textures and keeps geometry for what you can
  // walk into.
  const barT = pixTex(48, 16, (g) => {
    g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, 48, 16);
    g.fillStyle = '#2e2a26';
    for (let x = 1; x < 48; x += 4) g.fillRect(x, 0, 1, 16);
    g.fillRect(0, 1, 48, 1); g.fillRect(0, 14, 48, 1);
  });
  barT.wrapS = THREE.RepeatWrapping;
  barT.repeat.set(6, 1);
  const bars = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 1.55),
    new THREE.MeshBasicMaterial({ map: barT, alphaTest: 0.5, side: THREE.DoubleSide }));
  put(bars, 1.6, 1.72, hd - 0.14);

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
  put(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), ctx.flat(noticeT)),
    -1.8, 1.95, -hd + 0.07);

  // one caged bulb over the counter — additive, and hung well clear of the
  // ceiling so it lights the room rather than painting the plaster above it
  const glowT = pixTex(32, 32, (g) => {
    const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15);
    gr.addColorStop(0, 'rgba(244,214,150,0.40)');
    gr.addColorStop(1, 'rgba(244,214,150,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  });
  const glowM = new THREE.MeshBasicMaterial({
    map: glowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const lx of [-1.0, 3.2]) {
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.12, 8), steelM), lx, room.H - 0.16, CTR_ZC - 0.4);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), glowM);
    gl.rotation.x = Math.PI / 2;
    put(gl, lx, room.H - 0.42, CTR_ZC - 0.4);
  }
}
