import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import { buildRoom } from './interior';

// ST BRIGID'S — the inside, because the user asked to go in and could not.
//
// *"church i still cant walk into i cant walk up the stairs or go in, same as
// library."* The stairs were the first half and they climb now. The second half
// — GO IN — was never delivered: the flight got a locked-door response while
// the desk's own note said the choice was *"a prompt that opens a real room, or
// a locked-door response"* and nobody ever ruled. The user re-reported it. A
// locked door is a fine answer to a building nobody asked to enter, and the
// wrong answer to one they have now asked about twice.
//
// The brief for the outside was *"catholic, beautiful"*, and the inside has to
// pay that off in the one currency an interior has, which is not detail — it is
// PROPORTION. Every other room in this world is a box you are in; a church is
// a volume you are under. So:
//
//   height    6.4 m, against 2.75 for the thrift and 2.5 for the casino. It is
//             the tallest interior in the game by a factor of two, and that
//             single number does more than any amount of furniture.
//   length    16 m of nave, so the altar is far enough away to walk toward.
//   width     kept NARROW at 8.5. A wide room reads as a hall; a tall narrow
//             one reads as a nave, and the ratio is the whole effect.
//
// Everything else in here is subtraction. A church at 3 p.m. on a weekday is
// empty, dim and quiet, and the temptation is to fill it — but the thrift store
// two doors down is the room that earns its density, and this one earns the
// opposite. Pews, a floor, a window, an altar, and a great deal of air.
export const DOOR = {
  building: 'ST BRIGID',
  w: 12, cz: -79.5, side: 1, at: 0, width: 1.4,
  // A CUT FACE, like the bodega's: the church sits back behind its own forecourt
  // rather than on the shopfront line, so its door is not on the building band
  // at all. Measured off the flight the player actually climbs — the landing
  // tops out at x 9.1…9.6 over z −81.7…−77.2, so the doors are at the far edge
  // of that, facing back down the steps toward the street.
  face: { x: 9.6, z: -79.5, nx: -1, nz: 0 },
};

export function buildChurch(ctx: CtxBuild) {
  const room = buildRoom(ctx, {
    id: 'church',
    label: 'into ST BRIGID\'S',
    w: 8.5, d: 16, h: 6.4,
    // Cold stone, not shop plaster. The floor is the flagstone the forecourt
    // uses so the threshold reads as continuous; the walls go pale and chalky
    // and the ceiling is nearly white, because height you cannot see the top of
    // is height you do not feel.
    palette: { floor: 0x6e6a62, wall: 0xa8a294, ceil: 0xbdb8ab, trim: 0x8a8274 },
    door: {
      x: 8.85, z: -79.5, r: 1.2,
      // OUT ONTO THE FLIGHT, clear of the way IN.
      //
      // This first read `outX: 8.6` — 0.25 m from the door spot, which has a
      // 1.2 m radius. So you stepped out of the church and were standing in the
      // trigger that puts you back in it: the prompt still said "[E] into ST
      // BRIGID'S" and pressing E again, which is the natural thing to do after
      // arriving somewhere, sucked you straight back inside. Verified as a
      // player, not inferred — walked out, read the prompt, pressed E, ended up
      // back in the nave.
      //
      // 7.2 is 1.65 m from the door spot, so you land OUTSIDE it, on the flight,
      // facing down the steps toward the street. The way back in is one step
      // forward, which is what a door should cost.
      outX: 7.2, outZ: -79.5, outYaw: -Math.PI / 2,
      at: 0, width: 1.4,
    },
    // ONE light source, and it is not a fitting. A church is lit by its
    // windows; a strip of fluorescents would undo the room in a single frame.
    light: { kind: 'dome', tint: 0xd8d2c0, count: 2 },
  });

  const { put, solid, wx, wz } = room;
  const hw = 8.5 / 2, hd = 16 / 2;

  // ── the floor is flagstones, not boards ──
  const flagT = declareSurface(pixTex(64, 64, (g) => {
    g.fillStyle = '#6e6a62'; g.fillRect(0, 0, 64, 64);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        g.fillStyle = ['#6a665e', '#726e66', '#67635b', '#757168'][(r * 4 + c) % 4];
        g.fillRect(c * 16 + 1, r * 16 + 1, 14, 14);
      }
    }
    dither(g, 64, 64, 420);
  }), 'ground');
  flagT.wrapS = flagT.wrapT = THREE.RepeatWrapping;
  flagT.repeat.set(8.5 / 2, 16 / 2);              // GOTCHAS 5: repeat off real metres
  const flags = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 16), ctx.flat(flagT));
  flags.rotation.x = -Math.PI / 2;
  put(flags, 0, 0.012, 0);

  // ── the pews ──
  //
  // Two banks either side of a centre aisle you can actually process down. The
  // aisle is 1.6 m: wide enough that the room invites you up it, which is the
  // whole point of a nave, and the one place in this world where a WIDE gap is
  // correct rather than lazy.
  const woodM = new THREE.MeshBasicMaterial({ color: 0x5a4632 });
  const AISLE = 1.6, PEW_W = (8.5 - AISLE) / 2 - 0.55;
  const PEW_CX = AISLE / 2 + PEW_W / 2;
  for (let i = 0; i < 9; i++) {
    const pz = -hd + 3.2 + i * 1.05;
    for (const side of [-1, 1]) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(PEW_W, 0.08, 0.42), woodM);
      put(seat, side * PEW_CX, 0.46, pz);
      const back = new THREE.Mesh(new THREE.BoxGeometry(PEW_W, 0.62, 0.07), woodM);
      put(back, side * PEW_CX, 0.75, pz - 0.24);
      for (const end of [-PEW_W / 2 + 0.05, PEW_W / 2 - 0.05]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.4), woodM);
        put(leg, side * PEW_CX + end, 0.23, pz);
      }
      // THE BACKREST IS SOLID, THE SEAT IS NOT.
      //
      // This was `solid(…, pz, PEW_W, 0.5)` — the whole pew — which put the
      // seat point INSIDE its own collider, so 14 of the 18 came back
      // "UNREACHABLE — no standable point within its 0.62 m trigger". The
      // user asked that every seat in the game be sittable and I shipped a
      // church of benches you cannot reach, which is the same fault as the
      // burger stool that took three attempts to find.
      //
      // A pew is not a wall. You step into the row and sit, so only the back
      // rail blocks — which is what stops you walking through the bank and is
      // the only part that should.
      solid(side * PEW_CX, pz - 0.24, PEW_W, 0.16);
      // …and you can sit in it. The user asked that EVERY seat in the game be
      // sittable, and a church full of benches you cannot use would be the
      // largest exception in the world.
      ctx.seat({
        x: wx(side * PEW_CX), z: wz(pz), yaw: Math.PI, h: 0.54, r: 0.62,
        label: 'sit in the pew',
      });
    }
  }

  // ── the altar end ──
  //
  // Raised one step, which is the only level change inside and the reason the
  // far end reads as somewhere rather than as the back wall.
  const stoneM = new THREE.MeshBasicMaterial({ color: 0x9a9488 });
  const dais = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.18, 2.6), stoneM);
  put(dais, 0, 0.09, hd - 2.2);
  const altar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.95, 0.75),
    new THREE.MeshBasicMaterial({ color: 0xb0a894 }));
  put(altar, 0, 0.18 + 0.475, hd - 2.4);
  solid(0, hd - 2.4, 2.2, 0.75);
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.3, 0.8),
    new THREE.MeshBasicMaterial({ color: 0xd8d0bc }));
  put(cloth, 0, 0.18 + 0.82, hd - 2.4);
  for (const dx of [-0.7, 0.7]) {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.34, 6),
      new THREE.MeshBasicMaterial({ color: 0xb8a24e }));
    put(stick, dx, 0.18 + 0.95 + 0.17, hd - 2.4);
  }

  // ── the east window, which is the light in the room ──
  //
  // Painted rather than glazed: the lancets outside are texel work in E's
  // facade, so the inside answers them in the same idiom instead of pretending
  // to be glass. Deep colours on a black lead grid — a rose reads as jewels in
  // a dark room, which is exactly what it is for.
  const roseT = declareSurface(pixTex(48, 72, (g) => {
    g.fillStyle = '#14120f'; g.fillRect(0, 0, 48, 72);
    const cols = ['#2f4a7a', '#7a2f38', '#8a6a2a', '#2f6a4a', '#5a2f6a'];
    for (let y = 2; y < 70; y += 5) {
      for (let x = 2; x < 46; x += 5) {
        const dx = (x - 24) / 22, dy = (y - 36) / 34;
        if (dx * dx + dy * dy > 1) continue;
        g.fillStyle = cols[(x * 7 + y * 3) % cols.length];
        g.fillRect(x, y, 4, 4);
      }
    }
  }), 'sign');
  room.sign(roseT, 2.4, 3.6, 0, 3.4, hd - 0.09);

  // ── one person, four rows back, and she is the difference ──
  //
  // The room shipped with `keeper: null` and the reasoning was sound as far as
  // it went: a weekday afternoon church is empty, and the emptiness is the
  // effect. But the user has said twice that interiors here feel wrong for
  // exactly the neighbouring reason — *"the people inside these places are
  // always flat and not like the people on the street"*, and of the bodega,
  // *"a bit small and sad"*. Empty and SAD are one bad decision apart.
  //
  // So: one woman, seated, four rows back on the left, facing the altar. Not a
  // keeper — nobody is minding a church — which is why `keeper: null` in the
  // harness stays correct: there is no counter and nobody to serve you. She is
  // scenery with a pulse, and a single figure in a sixteen-metre nave reads as
  // quiet, where nobody at all reads as unfinished.
  //
  // Head bowed is not something the atlas can do, so this does the readable
  // version: seated height, dark coat, still. From the 8-angle atlas like every
  // other figure in the world — the whole point of the user's complaint was
  // that interior people were cardboard when the street's were not.
  const PRAY_Z = -hd + 3.2 + 3 * 1.05;
  room.person({
    jacket: '#3a3640', pants: '#2e2b33', skin: '#c9a48a', hair: '#7a7068',
    fit: 'coat', accent: '#5a5260', cut: 'short', build: 0,
  }, -PEW_CX, PRAY_Z, { facing: 0, h: 0.62, w: 0.92 });

  // ── a rack of votive candles by the door, the one warm thing ──
  const rack = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.34),
    new THREE.MeshBasicMaterial({ color: 0x4a4038 }));
  put(rack, -hw + 0.9, 0.78, -hd + 2.0);
  for (let i = 0; i < 7; i++) {
    const lit = i !== 2 && i !== 5;                 // most of them burnt out
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, lit ? 0.13 : 0.05, 6),
      new THREE.MeshBasicMaterial({ color: lit ? 0xe8c87a : 0xbdb6a4 }));
    put(c, -hw + 0.9 - 0.36 + i * 0.12, 0.81 + (lit ? 0.065 : 0.025), -hd + 2.0);
  }
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.78, 0.12),
    new THREE.MeshBasicMaterial({ color: 0x4a4038 }));
  put(stand, -hw + 0.9, 0.39, -hd + 2.0);
  solid(-hw + 0.9, -hd + 2.0, 0.9, 0.36);
}
