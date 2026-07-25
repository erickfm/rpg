import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither } from './paint';
import { buildRoom } from './interior';
import { type DoorDecl } from './doors';

// HOTEL ORPHEUS, the lobby.
//
// The brief is a gap, not a room: it WAS grand and it is not any more, and the
// distance between those two is the whole thing. So every object in here is
// one of two kinds, and the room is built out of the argument between them:
//
//   what is still grand          what has happened to it
//   ─────────────────────────    ──────────────────────────────────────
//   a real tile floor            a vinyl runner over the worn track
//   a mahogany reception desk    one clerk on a dead shift behind it
//   a full wall of pigeonholes   most of the keys still in them
//   a proper lift with a dial    the dial stopped between floors
//   a planted palm               dead, and nobody has moved it
//   four matched lobby chairs    three that do not match
//   four ceiling fittings        one of them out
//
// None of that reads if the shabbiness is drawn as dirt. It has to be drawn as
// REPLACEMENT — the vinyl is a different material from the tile, the chairs are
// different shapes, the dead lamp is a different colour from the lit ones. A
// grand room with grime on it is just a dirty grand room.
//
// HOTEL ORPHEUS stands on the side street at x ∈ [33.45, 45.45] in street.ts's
// NORTH2 roster, facade on z = -96.0, with its blade sign hung off the east end
// of the building. The door is painted at u = 0.4948 of a 96-texel shopfront,
// which lands at world x = 39.51 — derived and walked in
// notes/G-interiors2-prep.md, not eyeballed.
/**
 * WHERE THIS ROOM'S DOOR IS, declared as a world POINT and an outward NORMAL.
 *
 * This building fronts the SIDE STREET: the roster lays it out along x from
 * 33.45 to 45.45 and its facade faces −z, so "signed metres from the frontage
 * centre along z" — the form the main-block rooms use — cannot describe it.
 *
 * It does not need to. `face` was added for the bodega's canted bay and it is
 * not a chamfer special case: a point plus a normal is the GENERAL form, and
 * the main block's `cz`/`side` is the shorthand for the common one.
 * `doorPointFor` already derives one from the other. I had this written up as
 * needing a type change; it needed reading my own type properly.
 *
 * The point is G's, unchanged and already walked — declaring it publishes it
 * to tooling without moving anything.
 */
export const DOOR: DoorDecl = {
  building: 'HOTEL ORPHEUS', w: 12.0, cz: 39.45, side: 1, at: 0, width: 1.15,
  face: { x: 39.51, z: -96.0, nx: 0, nz: -1 },
};

export function buildHotel(ctx: CtxBuild): void {
  const DOOR_X = 39.51, WALK_Z = -97.0;
  const room = buildRoom(ctx, {
    id: 'hotel',
    label: 'into the HOTEL ORPHEUS',
    // 3.4 m, the tallest room in the belt so far and deliberately so. The
    // casino two doors down is 2.5 m and presses on you; this one has to do
    // the opposite before it can have fallen from anywhere.
    w: 11.0, d: 9.0, h: 3.4,
    palette: { floor: 0x9a9086, wall: 0x8a7f6e, ceil: 0xa89c88, trim: 0x5a4028 },
    door: {
      x: DOOR_X, z: WALK_Z, r: 1.05,
      at: -3.4, width: 1.15,
      // Along the walk, east, for the same reason as the casino: the north
      // side-street walk is a 2 m band and the building collider eats down to
      // z = -96.3, so stepping BACK from the door cannot clear a 1.05 m
      // trigger without putting you in the road. 1.55 m along it gives 1.57 m.
      outX: DOOR_X + 1.55, outZ: WALK_Z - 0.25, outYaw: 0, outGy: ctx.KERB_H,
    },
    // A lobby has a window — it is the one room on my list that wants people
    // outside to see in. East of the door, clear of it by 0.6 m so the kit's
    // overlap check has nothing to say.
    window: { at: 2.6, w: 4.0, h: 1.7, sill: 0.9 },
  });

  const { put, solid } = room;
  const hw = room.W / 2, hd = room.D / 2;
  const BRASS = 0x9a7c3a, MAHOG = 0x4a2a20;
  const brassM = new THREE.MeshBasicMaterial({ color: BRASS });
  const mahogM = new THREE.MeshBasicMaterial({ color: MAHOG });

  // ── the tile floor, and the vinyl over the worn part ──
  //
  // The tile is the grand half: a bordered period pattern, cream and ochre
  // with a dark inset at the crossings, laid at ~20 px/m to agree with the
  // kit's own floor (GOTCHAS §5 — density comes from real metres).
  const tileT = pixTex(48, 48, (g) => {
    g.fillStyle = '#b9ab93'; g.fillRect(0, 0, 48, 48);
    g.fillStyle = '#a2907a';                                   // the grout grid
    for (const v of [0, 24]) { g.fillRect(v, 0, 1, 48); g.fillRect(0, v, 48, 1); }
    g.fillStyle = '#8a7256';                                   // dark inset at each crossing
    for (const cx of [0, 24, 48]) for (const cy of [0, 24, 48]) g.fillRect(cx - 2, cy - 2, 4, 4);
    g.fillStyle = '#c8bca6';                                   // a lighter field inside each tile
    for (const cx of [12, 36]) for (const cy of [12, 36]) g.fillRect(cx - 7, cy - 7, 14, 14);
    g.fillStyle = '#9c8a70';
    for (const cx of [12, 36]) for (const cy of [12, 36]) {
      g.fillRect(cx - 2, cy - 7, 4, 1); g.fillRect(cx - 2, cy + 6, 4, 1);
      g.fillRect(cx - 7, cy - 2, 1, 4); g.fillRect(cx + 6, cy - 2, 1, 4);
    }
    dither(g, 48, 48, 90);
  });
  tileT.wrapS = tileT.wrapT = THREE.RepeatWrapping;
  tileT.repeat.set(Math.round(room.W / 2.4), Math.round(room.D / 2.4));
  const tile = new THREE.Mesh(new THREE.PlaneGeometry(room.W, room.D), ctx.flat(tileT));
  tile.rotation.x = -Math.PI / 2;
  put(tile, 0, 0.012, 0);

  // …and the shabby half, laid ON the track people actually walk: door to
  // desk. It is a different MATERIAL, not a dirtier tile — sheet vinyl in a
  // colour that never matched, with the tile still showing at its edges. That
  // is what makes it read as a repair rather than as wear.
  const vinylT = pixTex(32, 48, (g) => {
    g.fillStyle = '#6a6358'; g.fillRect(0, 0, 32, 48);
    g.fillStyle = 'rgba(255,255,255,0.06)';
    for (let y = 0; y < 48; y += 6) g.fillRect(0, y, 32, 1);    // the roll's own grain
    g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(0, 0, 2, 48); g.fillRect(30, 0, 2, 48);
    dither(g, 32, 48, 70);
  });
  vinylT.wrapS = vinylT.wrapT = THREE.RepeatWrapping;
  vinylT.repeat.set(1, 3);
  const vinyl = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 6.8), ctx.flat(vinylT));
  vinyl.rotation.x = -Math.PI / 2;
  put(vinyl, -3.75, 0.014, 0.8);

  // ── the reception desk ──
  //
  // Down the west wall rather than facing the door, which is how a lobby of
  // this size was actually planned: you come in, the room opens to your right,
  // and the desk is the thing you walk ALONG. Deep counter, mahogany front,
  // brass rail on top.
  const DESK_X = -4.55, DESK_Z = -1.0, DESK_L = 4.4;
  const deskT = pixTex(24, 56, (g) => {
    g.fillStyle = '#4a2a20'; g.fillRect(0, 0, 24, 56);
    g.fillStyle = '#5c382a';                                    // raised panels
    for (let y = 6; y < 52; y += 16) g.fillRect(3, y, 18, 12);
    g.fillStyle = 'rgba(0,0,0,0.30)';
    for (let y = 6; y < 52; y += 16) g.fillRect(3, y + 11, 18, 1);
    g.fillStyle = '#6a4630'; g.fillRect(0, 0, 24, 3);           // the counter's edge
    dither(g, 24, 56, 34);
  });
  const deskM = ctx.flat(deskT);
  const deskTopM = new THREE.MeshBasicMaterial({ color: 0x5c3826 });
  put(new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.12, DESK_L),
    [deskM, deskM, deskTopM, deskM, deskM, deskM]), DESK_X, 0.56, DESK_Z);
  // the brass rail along the top — plain colour, no texture. It is 0.06 m
  // thick, well under the 0.3 m that GOTCHAS §4 says can hold no fine detail.
  put(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, DESK_L), brassM),
    DESK_X + 0.33, 1.18, DESK_Z);
  solid(DESK_X, DESK_Z, 0.75, DESK_L);
  // the bell, and the register open beside it — the two things on the counter
  put(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.06, 8), brassM),
    DESK_X + 0.1, 1.15, DESK_Z + 1.5);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.5),
    new THREE.MeshBasicMaterial({ color: 0xd8d0bc })), DESK_X + 0.05, 1.14, DESK_Z - 0.6);

  // ── the clerk ─────────────────────────────────────────────────────────
  //
  // The user: *"the people inside these places are always flat and not like the
  // people on the street"*. This lobby had nobody in it at all, which read as
  // closed rather than as quiet — an empty desk under a full key rack says the
  // hotel has shut, and the story here is that it is open and nearly nobody is
  // staying.
  //
  // So: one clerk, in the 0.6 m staff strip between the desk and the west wall,
  // facing across the counter into the room — `facing: PI/2` is atan2(vx, vz)
  // toward +x. Shirt and tie, no jacket, because it is a long shift on a quiet
  // night. `room.person` is the kit's wrapper over the same atlas every citizen
  // outside uses — the right altitude for a room, per notes/CITIZEN-STYLE.md,
  // and it owns the per-frame turn so the room does not wire one.
  room.person({ jacket: '#8a8478', pants: '#3a3630', skin: '#8d5a34', hair: '#241a12',
      accent: '#6a2a30', fit: 'plain', cut: 'crop', build: 0, stride: 2 }, DESK_X - 0.62, DESK_Z + 0.35, { facing: Math.PI / 2, h: 1.0, w: 0.98 });

  // ── the pigeonholes, on the wall behind the desk ──
  //
  // The single most hotel-lobby object there is, and the one that carries the
  // story: most of the keys are still on their hooks, which means most of the
  // rooms are empty. A few holes have mail in them that nobody has collected.
  const holesT = pixTex(96, 40, (g) => {
    g.fillStyle = '#3a2418'; g.fillRect(0, 0, 96, 40);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 12; c++) {
      const x = 2 + c * 8, y = 2 + r * 9;
      g.fillStyle = '#241610'; g.fillRect(x, y, 7, 8);          // the hole itself
      g.fillStyle = '#4a2e1e'; g.fillRect(x, y, 7, 1);
      // a key on its hook in most of them, mail in a few, empty in the rest
      const n = r * 12 + c;
      if (n % 7 !== 3) { g.fillStyle = '#9a7c3a'; g.fillRect(x + 3, y + 3, 1, 4); g.fillRect(x + 3, y + 6, 2, 1); }
      if (n % 11 === 5) { g.fillStyle = '#c8c0aa'; g.fillRect(x + 1, y + 5, 5, 3); }
    }
    g.fillStyle = '#5a4028'; g.fillRect(0, 38, 96, 2);          // the shelf under
    dither(g, 96, 40, 50);
  });
  const holes = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.5), ctx.flat(holesT));
  holes.rotation.y = Math.PI / 2;                                // faces +x, into the room
  put(holes, -hw + 0.06, 1.85, DESK_Z);

  // the rate card, framed under glass beside the pigeonholes. Weekly rates,
  // because that is what a hotel quotes when it has stopped being a hotel for
  // travellers and become one for residents — the whole fall, in four lines.
  const rateT = pixTex(40, 28, (g) => {
    g.fillStyle = '#e2dac4'; g.fillRect(0, 0, 40, 28);
    g.fillStyle = '#5a4028'; g.fillRect(0, 0, 40, 1); g.fillRect(0, 27, 40, 1);
    g.fillRect(0, 0, 1, 28); g.fillRect(39, 0, 1, 28);
    g.fillStyle = '#3a2a1a'; g.font = 'bold 6px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('WEEKLY', 20, 6);
    g.font = '5px monospace'; g.textAlign = 'left';
    const rows: [string, string][] = [['SINGLE', '42'], ['DOUBLE', '55'], ['BATH', '+6']];
    rows.forEach(([a, b], i) => {
      g.textAlign = 'left'; g.fillText(a, 4, 14 + i * 5);
      g.textAlign = 'right'; g.fillText(b, 36, 14 + i * 5);
    });
    g.fillStyle = 'rgba(190,215,225,0.20)'; g.fillRect(1, 1, 38, 26);   // the glass over it
  });
  const rate = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.52), ctx.flat(rateT));
  rate.rotation.y = Math.PI / 2;
  put(rate, -hw + 0.06, 1.55, DESK_Z + 2.85);

  // ── the lift ──
  //
  // East wall. No collider: the room's own wall already stops you 0.36 m short
  // of it, so a box here would only be a second wall in the same place — and
  // an unnecessary collider next to nothing is how the bodega's door got eaten
  // (GOTCHAS §8).
  const liftT = pixTex(48, 56, (g) => {
    g.fillStyle = '#6a6258'; g.fillRect(0, 0, 48, 56);          // the surround
    g.fillStyle = '#8a8478'; g.fillRect(3, 2, 42, 52);          // the doors
    g.fillStyle = '#5a544a'; g.fillRect(23, 2, 2, 52);          // the seam between them
    g.fillStyle = '#9a9488'; g.fillRect(3, 2, 42, 1);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let x = 6; x < 45; x += 6) g.fillRect(x, 3, 1, 50);    // fluted panels
    g.fillStyle = '#9a7c3a'; g.fillRect(38, 26, 5, 8);          // the call plate
    g.fillStyle = '#2a2620'; g.fillRect(39, 28, 3, 2);
    dither(g, 48, 56, 40);
  });
  const lift = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.25), ctx.flat(liftT));
  lift.rotation.y = -Math.PI / 2;                                // faces -x, into the room
  put(lift, hw - 0.06, 1.13, -2.0);

  // the floor dial over it, stopped between floors — the detail that says the
  // lift has not moved in a while without anyone having to write it down
  const dialT = pixTex(40, 22, (g) => {
    g.fillStyle = '#3a2a1a'; g.fillRect(0, 0, 40, 22);
    g.fillStyle = '#d8cfb4'; g.fillRect(2, 2, 36, 18);
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 1;
    g.beginPath(); g.arc(20, 20, 14, Math.PI, Math.PI * 2); g.stroke();
    g.fillStyle = '#3a2a1a';
    for (let i = 0; i <= 5; i++) {                               // the floor ticks
      const a = Math.PI + (i / 5) * Math.PI;
      g.fillRect(Math.round(20 + Math.cos(a) * 11) - 1, Math.round(20 + Math.sin(a) * 11) - 1, 2, 2);
    }
    g.fillStyle = '#8a2c22';                                     // the needle, between 2 and 3
    const na = Math.PI + 0.46 * Math.PI;
    for (let t = 0; t < 11; t++) g.fillRect(Math.round(20 + Math.cos(na) * t), Math.round(20 + Math.sin(na) * t), 1, 1);
  });
  const dial = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.44), ctx.flat(dialT));
  dial.rotation.y = -Math.PI / 2;
  put(dial, hw - 0.06, 2.62, -2.0);

  // ── the lobby chairs, and the table they no longer match ──
  //
  // Three chairs, three different frames and three different colours: the
  // matched set went years ago and these arrived one at a time. They block as
  // ONE collider with the table, not four — the gaps between them are 0.4 m
  // and the player is 0.72 m across, so per-chair boxes would only carve slots
  // to wedge into, which is the lesson the diner's booths taught.
  const CH_X = 1.6, CH_Z = 2.2;
  const chair = (lx: number, lz: number, col: number, back: number, ry: number) => {
    const m = new THREE.MeshBasicMaterial({ color: col });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.5), m);
    seat.rotation.y = ry; put(seat, lx, 0.42, lz);
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.52, back, 0.1), m);
    br.rotation.y = ry;
    put(br, lx - Math.sin(ry) * 0.2, 0.48 + back / 2, lz - Math.cos(ry) * 0.2);
    for (const sx of [-0.2, 0.2]) for (const sz of [-0.2, 0.2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 0.05), mahogM);
      put(leg, lx + sx, 0.18, lz + sz);
    }
  };
  chair(0.5, 2.3, 0x5a6a5c, 0.5, 1.2);      // a green wing-back, the oldest of them
  chair(2.7, 2.3, 0x7a5a3a, 0.38, -1.1);    // a tan one, lower and newer
  chair(1.6, 3.2, 0x6a4a52, 0.44, Math.PI); // maroon, facing the window
  const lowT = pixTex(32, 20, (g) => {
    g.fillStyle = '#5c3826'; g.fillRect(0, 0, 32, 20);
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, 0, 32, 2);
    g.fillStyle = 'rgba(0,0,0,0.20)';
    for (let x = 0; x < 32; x += 7) g.fillRect(x, 0, 1, 20);
    dither(g, 32, 20, 20);
  });
  put(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.6), ctx.flat(lowT)), CH_X, 0.44, CH_Z);
  for (const sx of [-0.4, 0.4]) for (const sz of [-0.2, 0.2]) {
    put(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.05), mahogM), CH_X + sx, 0.21, CH_Z + sz);
  }
  // an ashtray stand and a folded newspaper nobody has cleared
  put(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.22),
    new THREE.MeshBasicMaterial({ color: 0xb0a894 })), CH_X + 0.15, 0.48, CH_Z);
  solid(CH_X, CH_Z, 3.0, 2.0);

  // ── the dead palm ──
  //
  // In the corner by the door, where it was put to be the first thing you saw.
  // Drawn as a sprite with alphaTest, the same treatment as the diner's
  // waitress — a plant is all silhouette and a box cannot do it.
  const palmT = pixTex(40, 56, (g) => {
    g.fillStyle = '#6a4a2a'; g.fillRect(18, 22, 3, 22);          // the trunk
    // fronds, all of them hanging DOWN — that is the whole difference between
    // a palm and a dead palm, and it is worth more than any amount of brown
    const frond = (x0: number, y0: number, dx: number, n: number, col: string) => {
      g.fillStyle = col;
      for (let i = 0; i < n; i++) {
        g.fillRect(Math.round(x0 + dx * i), Math.round(y0 + i * i * 0.16), 2, 2);
      }
    };
    frond(19, 12, -2.0, 9, '#7a6a34');
    frond(20, 11, 2.1, 9, '#6a5c2c');
    frond(19, 14, -1.2, 8, '#5c5228');
    frond(20, 13, 1.3, 8, '#7a6a34');
    frond(19, 10, -0.3, 7, '#6a5c2c');
    g.fillStyle = '#8a7c3a'; g.fillRect(17, 8, 5, 5);            // the crown, gone to straw
    g.fillStyle = '#8a5a3a'; g.fillRect(12, 44, 15, 12);         // the pot
    g.fillStyle = '#7a4a2e'; g.fillRect(11, 43, 17, 3);
    g.fillStyle = '#3a2e22'; g.fillRect(14, 45, 11, 2);          // dry soil
    dither(g, 40, 56, 24);
  });
  const palm = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.6),
    new THREE.MeshBasicMaterial({ map: palmT, alphaTest: 0.5, side: THREE.DoubleSide }));
  put(palm, -4.8, 0.8, 3.6);
  solid(-4.8, 3.6, 0.5, 0.5);

  // ── the hotel in its prime, hung crooked over the back wall ──
  //
  // The back wall was the one bare surface in the room, and the thing that
  // belongs on it is the argument the whole lobby is making: a framed
  // photograph of the ORPHEUS when the awning was new and there were cars
  // outside. Hung a few degrees off level, because nobody has straightened it
  // in years — which says more about the place than any amount of dirt would.
  const photoT = pixTex(56, 40, (g) => {
    g.fillStyle = '#4a3624'; g.fillRect(0, 0, 56, 40);           // the frame
    g.fillStyle = '#6a5238'; g.fillRect(1, 1, 54, 38);
    g.fillStyle = '#cfc6ae'; g.fillRect(4, 4, 48, 32);           // the mount
    g.fillStyle = '#9a9184'; g.fillRect(7, 7, 42, 26);           // the photograph, gone sepia
    g.fillStyle = '#7a7266'; g.fillRect(7, 7, 42, 9);            // the building above
    g.fillStyle = '#6a6256';
    for (let x = 9; x < 48; x += 6) g.fillRect(x, 9, 3, 5);      // its windows
    g.fillStyle = '#8a7c5a'; g.fillRect(7, 16, 42, 3);           // the awning, when it was new
    g.fillStyle = '#5a5248'; g.fillRect(7, 27, 42, 6);           // the street
    g.fillStyle = '#6a6258';
    for (const cx of [12, 24, 38]) g.fillRect(cx, 24, 8, 4);     // cars outside it
    g.fillStyle = 'rgba(190,215,225,0.14)'; g.fillRect(4, 4, 48, 32);
    dither(g, 56, 40, 30);
  });
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.75), ctx.flat(photoT));
  photo.rotation.z = 0.035;                                       // crooked, and left that way
  put(photo, 1.2, 1.85, -hd + 0.06);

  // a standing ashtray by the lift — the one piece of furniture in a 1997
  // lobby that is still doing the job it was bought for
  put(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.62, 8),
    new THREE.MeshBasicMaterial({ color: 0x6a6258 })), 4.5, 0.31, -0.7);
  put(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.09, 8), brassM), 4.5, 0.66, -0.7);

  // ── a picture rail, chipped ──
  put(new THREE.Mesh(new THREE.BoxGeometry(room.W, 0.07, 0.04), mahogM), 0, 2.35, -hd + 0.02);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, room.D), mahogM), -hw + 0.02, 2.35, 0);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, room.D), mahogM), hw - 0.02, 2.35, 0);

  // ── four fittings, and one of them is out ──
  //
  // The kit hangs its own glow down the centreline and that stays; these are
  // the lobby's own fixtures, and they are here because the brief asks for one
  // lamp out — which is not something the kit can express, and is not worth a
  // kit change when the room can just own its own lamps. The dead one is drawn
  // DIFFERENTLY, not just unlit: a cold grey shade against three warm ones. An
  // unlit copy of a lit thing reads as a rendering mistake; a different colour
  // reads as a dead bulb.
  const glowT = pixTex(32, 32, (g) => {
    const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15);
    gr.addColorStop(0, 'rgba(248,214,140,0.42)');
    gr.addColorStop(1, 'rgba(248,214,140,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  });
  const glowM = new THREE.MeshBasicMaterial({
    map: glowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const litShadeM = new THREE.MeshBasicMaterial({ color: 0xe0cf9a });
  const deadShadeM = new THREE.MeshBasicMaterial({ color: 0x6e6a62 });
  const FITTINGS: [number, number, boolean][] = [
    [-2.8, -2.4, true], [2.8, -2.4, false], [-2.8, 2.4, true], [2.8, 2.4, true],
  ];
  for (const [lx, lz, lit] of FITTINGS) {
    put(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.06), mahogM), lx, room.H - 0.11, lz);
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.22, 0.16, 8), lit ? litShadeM : deadShadeM),
      lx, room.H - 0.28, lz);
    if (lit) {
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), glowM);
      gl.rotation.x = Math.PI / 2;
      put(gl, lx, room.H - 0.45, lz);
    }
  }

}
