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
    // 9.5, up from 6.4. "Much taller than anything else you can enter" was the
    // instruction and 6.4 did not deliver it — the library reading room is 6.4
    // too, so the church was merely joint-tallest. Nothing else in the world
    // comes within 3 m of this now, which is the only way the height reads as a
    // fact about the church rather than as a number in a file.
    w: 8.5, d: 16, h: 9.5,
    // Cold stone, not shop plaster. The floor is the flagstone the forecourt
    // uses so the threshold reads as continuous; the walls go pale and chalky
    // and the ceiling is nearly white, because height you cannot see the top of
    // is height you do not feel.
    // THE CHANCEL STEP, and the first user of the kit's new `floor`. The dais
    // at the altar end was a box you walked into; now it is a level you walk
    // ONTO, answered by the same picker the exterior flights use.
    floor: [{ x0: -3.2, x1: 3.2, z0: 8 - 3.5, z1: 8, y: 0.18 }],
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
      // the back is on the DOOR side of the seat, so you sit facing -z, down the
      // nave toward the altar
      put(back, side * PEW_CX, 0.75, pz + 0.24);
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
      solid(side * PEW_CX, pz + 0.24, PEW_W, 0.16);
      // …and you can sit in it. The user asked that EVERY seat in the game be
      // sittable, and a church full of benches you cannot use would be the
      // largest exception in the world.
      ctx.seat({
        x: wx(side * PEW_CX), z: wz(pz), yaw: 0, h: 0.54, r: 0.62,
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
  // -hd + 2.4, NOT hd - 2.4. The kit cuts the door into the front wall at local
  // +hd and puts the way-out spot at hd - 0.55, so the FAR end of a room is
  // negative z. At hd - 2.4 this altar stood 2.4 m from the door: you walked in
  // and were on it, every pew faced away down the nave, and the 16 m of length
  // this room's own comment calls "the whole effect" was behind you. It also
  // blocked the entrance outright -- 0.51 m in and you were against the altar's
  // collider, which is what "the church is locked" turned into once the door
  // opened.
  put(altar, 0, 0.18 + 0.475, -hd + 2.4);
  solid(0, -hd + 2.4, 2.2, 0.75);
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.3, 0.8),
    new THREE.MeshBasicMaterial({ color: 0xd8d0bc }));
  put(cloth, 0, 0.18 + 0.82, -hd + 2.4);
  for (const dx of [-0.7, 0.7]) {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.34, 6),
      new THREE.MeshBasicMaterial({ color: 0xb8a24e }));
    put(stick, dx, 0.18 + 0.95 + 0.17, -hd + 2.4);
  }

  // ── the chancel step is NOT here, and this is why ────────────────────
  //
  // "Altar and chancel step" is in the brief and I built one: a raised sanctuary
  // floor across the width with an altar rail. It went in on top of the
  // ENTRANCE, and walking in stopped dead — 0.49 m and you are against a rail.
  //
  // I had the room's ends backwards. Measured rather than assumed once it broke:
  // the way-out spot is at local z 7.45 and the altar's collider is at z 5.22 to
  // 5.97, so the door and the altar are at the SAME end of this nave, with the
  // pews running away from both. I had reasoned "altar at hd - 2.4, therefore the
  // door is at -hd" from the file's own prose about a 16 m nave, and the prose
  // and the geometry do not agree.
  //
  // That disagreement is E's room to settle, not mine to guess at on a room I
  // was handed an hour ago — moving an altar is a bigger decision than adding a
  // step. So the step is not here, the entrance is clear, and this is written
  // down where the next person will find it.
  //
  // It is also blocked twice over: a step you can walk UP needs the floor
  // function that ct/interior.ts:1000 hardcodes to `() => 0`, which is the same
  // missing spec field as the library's stair. See notes/BLOCKED-G.md.

  // ── the side chapel, and the candles nobody is tending ────────────────
  //
  // A votive stand at the back of the north aisle: a rack of lit candles, most
  // of them burnt down, in front of a small painted statue on a bracket. It is
  // the one warm thing in the room, which is what makes the rest read as cold.
  {
    const CX = -hw + 0.95, CZ = hd - 2.6;
    const ironM = new THREE.MeshBasicMaterial({ color: 0x3a3630 });
    const waxM = new THREE.MeshBasicMaterial({ color: 0xe8dfc4 });
    const flameM = new THREE.MeshBasicMaterial({
      color: 0xffd88a, transparent: true, opacity: 0.9, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false });
    // the stand
    put(new THREE.Mesh(new THREE.BoxGeometry(1.30, 0.06, 0.34), ironM), CX, 0.86, CZ);
    for (const dx of [-0.6, 0.6]) {
      put(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.86, 0.05), ironM), CX + dx, 0.43, CZ);
    }
    // the candles: five rows of unequal stubs, and only some alight
    let ci = 0;
    for (let gx = -0.55; gx <= 0.56; gx += 0.135) {
      for (const gz of [-0.09, 0.09]) {
        const burn = [0.16, 0.09, 0.21, 0.05, 0.13, 0.07][ci % 6];
        const lit = ci % 3 !== 1;                       // two in three still going
        put(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, burn, 6), waxM),
          CX + gx, 0.89 + burn / 2, CZ + gz);
        if (lit) {
          put(new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), flameM),
            CX + gx, 0.89 + burn + 0.045, CZ + gz);
        }
        ci++;
      }
    }
    // the statue on its bracket above them
    put(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.10, 0.26),
      new THREE.MeshBasicMaterial({ color: 0x8a8274 })), CX, 1.42, CZ - 0.16);
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.13, 0.52, 8),
      new THREE.MeshBasicMaterial({ color: 0xc8c2b2 })), CX, 1.73, CZ - 0.16);
    put(new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xd8d2c4 })), CX, 2.04, CZ - 0.16);
    solid(CX, CZ, 1.4, 0.5);
  }

  // ── the confessional ──────────────────────────────────────────────────
  //
  // Back of the south aisle, where it belongs: a dark oak box with three bays —
  // priest in the middle behind a curtain, a kneeler either side — and a violet
  // stole hung on the outside of the middle door, which is how you know it is
  // in use rather than furniture.
  {
    const FX = hw - 0.75, FZ = hd - 2.9;
    const oakM = new THREE.MeshBasicMaterial({ color: 0x4a3826 });
    const oakDM = new THREE.MeshBasicMaterial({ color: 0x372a1c });
    const BOXW = 0.98, BOXH = 2.42, BOXD = 2.70;
    put(new THREE.Mesh(new THREE.BoxGeometry(BOXW, BOXH, BOXD), oakM), FX, BOXH / 2, FZ);
    // the cornice, which is what stops it reading as a wardrobe
    put(new THREE.Mesh(new THREE.BoxGeometry(BOXW + 0.14, 0.12, BOXD + 0.14), oakDM),
      FX, BOXH + 0.06, FZ);
    // three bays down the aisle face: two kneeler openings and the priest's
    for (const [dz, tall] of [[-0.92, false], [0, true], [0.92, false]] as [number, boolean][]) {
      put(new THREE.Mesh(new THREE.BoxGeometry(0.05, tall ? 1.95 : 1.55, 0.74), oakDM),
        FX - BOXW / 2 - 0.02, (tall ? 1.95 : 1.55) / 2 + 0.16, FZ + dz);
    }
    // the violet stole over the middle door
    put(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.62, 0.11),
      new THREE.MeshBasicMaterial({ color: 0x5a3a6a })), FX - BOXW / 2 - 0.05, 1.42, FZ + 0.22);
    solid(FX, FZ, BOXW + 0.2, BOXD);
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
  // the east window belongs at the far end, over the altar, not on the wall you
  // came in through
  room.sign(roseT, 2.4, 3.6, 0, 3.4, -hd + 0.09);

  // ── …and the light it throws on the stone ─────────────────────────────
  //
  // "The lancets and rose window throwing coloured light on stone" is the line
  // in the brief, and until now the rose was a lit picture on a wall: bright
  // itself and changing nothing around it. A window that does not colour the
  // room it is in reads as a poster of a window.
  //
  // Everything in this world is unlit MeshBasicMaterial, so "light" is not a
  // lighting change — it is additive geometry, the same trick the casino's
  // spill and the lamp pools use. Five patches in the rose's own five glass
  // colours, thrown DOWN the nave from a window 3.4 m up: a long lozenge on the
  // floor where the sun would land, and two smaller ones riding up the side
  // walls where the splay catches them.
  //
  // Deliberately weak. A church in the afternoon is dim with a few burning
  // colours in it, not a disco; each patch is opacity 0.10 to 0.16, which reads
  // as stain on stone rather than as a projector.
  {
    const GLASS = ['#2f4a7a', '#7a2f38', '#8a6a2a', '#2f6a4a', '#5a2f6a'];
    const patch = (hex: string, w: number, d: number, lx: number, lz: number, op: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({
        color: new THREE.Color(hex), transparent: true, opacity: op,
        depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      m.rotation.x = -Math.PI / 2;
      put(m, lx, 0.02, lz);
      return m;
    };
    // the floor lozenge, brightest nearest the window and stretched up the nave
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      patch(GLASS[i], 2.3 - t * 0.6, 1.5, (i % 2 ? 0.28 : -0.28) * (1 - t),
        -hd + 1.5 + i * 1.45, 0.16 - t * 0.06);
    }
    // I also put two patches on the side walls, where a reveal would splay the
    // light sideways, and took them out again after looking: additive blue on a
    // pale stone wall desaturates to grey, so a 2.6 x 1.7 rectangle of it reads
    // as a flat PANEL hung on the wall rather than as light falling on one. On
    // the floor the same colours work, because the floor is darker and the shape
    // is long and irregular. Not every surface takes the same trick.
  }

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
  }, -PEW_CX, PRAY_Z, { facing: Math.PI, h: 0.62, w: 0.92 });

  // ── a rack of votive candles by the door, the one warm thing ──
  //
  // MOVED, and it is the same sign error as the altar. This sat at `-hd + 2.0`
  // while the comment above it said "by the door" — and -hd is the FAR end under
  // the kit's convention, so it was up beside the altar, 11 m from the door it
  // was written for. The prose was right and the arithmetic was not, which is
  // exactly how the altar was wrong too.
  //
  // It now stands beside the votive stand at the near end rather than duplicating
  // it: this is the plain iron rack people actually light candles at, and the
  // stand a couple of metres along has the statue over it. Two racks eleven
  // metres apart, one of them contradicting its own comment, was the state
  // before.
  const rack = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.34),
    new THREE.MeshBasicMaterial({ color: 0x4a4038 }));
  put(rack, -hw + 0.9, 0.78, hd - 5.4);
  for (let i = 0; i < 7; i++) {
    const lit = i !== 2 && i !== 5;                 // most of them burnt out
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, lit ? 0.13 : 0.05, 6),
      new THREE.MeshBasicMaterial({ color: lit ? 0xe8c87a : 0xbdb6a4 }));
    put(c, -hw + 0.9 - 0.36 + i * 0.12, 0.81 + (lit ? 0.065 : 0.025), hd - 5.4);
  }
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.78, 0.12),
    new THREE.MeshBasicMaterial({ color: 0x4a4038 }));
  put(stand, -hw + 0.9, 0.39, hd - 5.4);
  solid(-hw + 0.9, hd - 5.4, 0.9, 0.36);
}
