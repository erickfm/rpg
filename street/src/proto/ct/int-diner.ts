import * as THREE from 'three';
import type { AABB } from '../fp';
import type { CtxBuild } from './ctx';
import { pixTex, dither } from './paint';
import { buildRoom } from './interior';
import { FACE } from './rng';

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
// The diner stands on the west side of the block at z ≈ 9.6, first slot in
// the WEST roster. Its door on the street is at x = -(FACE - 0.45).
export function buildDiner(ctx: CtxBuild): AABB[] {
  const DZ = 9.6;
  const room = buildRoom(ctx, {
    id: 'diner',
    label: 'into the DINER',
    w: 8.6, d: 7.0, h: 3.0,
    palette: { floor: 0xb0a996, wall: 0xc4bca8, ceil: 0xbdb6a4, trim: 0x4a3a2a },
    door: {
      x: -(FACE - 0.45), z: DZ, r: 1.05,
      at: -2.6, width: 1.15,
      // Step out ALONG the walk, not across it. Landing straight out from the
      // door put you 0.65 m from the way-in trigger — inside it — so the
      // street prompt still read "into the DINER" and the next E took you
      // back. Going 1.5 m down the walk clears the trigger without crowding
      // the kerb: at x = -6.1 the 0.36 m capsule sits between the facade at
      // -7.0 and the kerb edge at -5.0, well inside the 2 m lane (GOTCHAS §9).
      outX: -(FACE - 0.9), outZ: DZ - 1.5, outYaw: Math.PI / 2, outGy: ctx.KERB_H,
    },
    window: { at: 1.6, w: 4.6, h: 1.55, sill: 0.9 },
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
  const CZ = -hd + 1.5, CL = 6.4;
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
  for (let i = 0; i < 6; i++) {
    const sx = -CL / 2 + 0.55 + i * ((CL - 1.1) / 5);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.66, 6), chromeM);
    put(post, sx, 0.33, CZ + 1.0);
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.1, 10), stoolTopM);
    put(seat, sx, 0.71, CZ + 1.0);
    solid(sx, CZ + 1.0, 0.34, 0.34);
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
  const BW = 1.35;                 // bench width — one booth
  const TZ = hd - 1.35;            // table centres, a stride off the window
  const BXS = [0.35, 1.95, 3.55];  // three booths, sharing dividers, under the glass
  for (const bx of BXS) {
    for (const dz of [-0.6, 0.6]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(BW, 0.45, 0.55), vinylM);
      put(bench, bx, 0.225, TZ + dz);
      const backr = new THREE.Mesh(new THREE.BoxGeometry(BW, 0.62, 0.12), vinylM);
      put(backr, bx, 0.76, TZ + dz * 1.49);
    }
    const tbl = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.07, 0.7), formicaFor(1.15, 0.7));
    put(tbl, bx, 0.74, TZ);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.72, 0.09), chromeM);
    put(leg, bx, 0.36, TZ);
  }
  // ONE collider for the whole bank, not nine. The dividers between booths are
  // 0.25 m apart — narrower than the 0.72 m player — so boxing each bench
  // separately only creates slots you can wedge into and have to shuffle back
  // out of. The bank is furniture you walk around, so it blocks as one thing.
  solid((BXS[0] + BXS[BXS.length - 1]) / 2, TZ,
    BXS[BXS.length - 1] - BXS[0] + BW, 1.9);

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
  const wT = pixTex(40, 64, (g) => {
    g.fillStyle = '#4a7a6a'; g.fillRect(9, 24, 22, 26);            // uniform dress
    g.fillStyle = '#d8d4c8'; g.fillRect(12, 30, 16, 20);           // apron
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(12, 30, 16, 2);
    g.fillStyle = '#3a5a50'; g.fillRect(11, 50, 8, 12); g.fillRect(21, 50, 8, 12);
    g.fillStyle = '#c9946a'; g.fillRect(4, 26, 5, 14); g.fillRect(31, 26, 5, 14);
    g.fillStyle = '#b8845a'; g.fillRect(14, 9, 12, 14);            // head
    g.fillStyle = '#5a3a22'; g.fillRect(13, 6, 14, 6);             // hair up
    g.fillStyle = '#241a12'; g.fillRect(16, 15, 2, 2); g.fillRect(22, 15, 2, 2);
    g.fillStyle = '#8a3a3a'; g.fillRect(18, 19, 4, 1);
    dither(g, 40, 64, 20);
  });
  const waitress = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.9),
    new THREE.MeshBasicMaterial({ map: wT, alphaTest: 0.5, side: THREE.DoubleSide }));
  put(waitress, -1.4, 0.95, CZ - 0.55);

  return room.colliders;
}
