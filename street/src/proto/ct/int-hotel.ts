import * as THREE from 'three';
import type { CtxBuild } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import { buildRoom } from './interior';
import { type DoorDecl } from './doors';
import { VICE_DOOR_X } from './vice';

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
// REPLACEMENT — the vinyl is a different material from the carpet, the chairs are
// different shapes, the dead lamp is a different colour from the lit ones. A
// grand room with grime on it is just a dirty grand room.
//
// HOTEL ORPHEUS stands on the side street at x ∈ [33.45, 45.45] in street.ts's
// NORTH2 roster, facade on z = -96.0, with its blade sign hung off the east end
// of the building. The door is painted by ct/vice.ts, which is where the x
// lives — derived and walked in notes/G-interiors2-prep.md, not eyeballed.
// This said "u = 0.4948 of a 96-texel shopfront"; the band is 192 texels and
// the u is 0.495, so both figures were wrong. See the casino's note.
/**
 * The [E] spot, derived from THIS FILE's own `face` rather than looked up.
 *
 * It is the same arithmetic `doors.ts`'s `doorStandFor` does — point plus
 * outward normal times the standoff — but computed here, so this module does not
 * import a VALUE from `./doors`. That import is what put this file in a runtime
 * cycle with the door registry, and a module in that cycle resolves to an
 * undefined namespace in the Rollup bundle, so its `DOOR` was collected in dev
 * and silently dropped in `dist`. Type-only imports are erased and cost nothing,
 * which is why the other six rooms were never affected.
 *
 * The standoff default is duplicated from `doors.ts` and that is the price.
 *
 * I first wrote that walking to the door guards it. It does not, and I checked
 * rather than leaving the claim standing: with this constant drifted to 1.00,
 * every walking check still passed, because they all approach through a 1.05 m
 * trigger radius that swallows a 0.25 m error whole. That is the same blindness
 * the typed door constants had, asserted a second time instead of tested.
 *
 * What actually guards it is a comparison of the two NUMBERS, no walking
 * involved: `spots-walk.mjs` does it across the world, and `G-rooms-walk.mjs`
 * now does it for these four rooms — "every [E] spot sits exactly on its
 * published door", within 1 cm.
 */
const standOf = (d: DoorDecl, standoff = 0.75) =>
  ({ x: d.face!.x + d.face!.nx * standoff, z: d.face!.z + d.face!.nz * standoff });

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
  // Read from ct/vice.ts, which paints the entrance at this x — see the casino's
  // decl and VICE_DOOR_X for why the painter is the authority and not this file.
  face: { x: VICE_DOOR_X['HOTEL ORPHEUS'], z: -96.0, nx: 0, nz: -1 },
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
    // THE FACADE'S PALETTE, BROUGHT INSIDE. The user, twice: what is outside is
    // "deep red, gold, black, bulb-lit letters and a lit porte-cochere" and what
    // was in here was "a pale beige room with plain tile ... clean, plain,
    // municipal". These are ct/vice.ts's own constants for this elevation --
    // RED #8e1f2a, RED_D #5a1520, GOLD_D #8a6a22 -- not colours that merely
    // resemble them, for the same reason `tube` is one exported painter rather
    // than two: someone walking in from that facade has to recognise the
    // building. Faded, not municipal: the wall sits between RED and RED_D so it
    // reads as deep red gone dusty, and the ceiling is darker than the wall so
    // the room feels tall and the light hangs IN it.
    palette: { floor: 0x5a2430, wall: 0x6d2029, ceil: 0x2e1c1e, trim: 0x8a6a22 },
    door: {
      // From the DECLARATION above, not typed again here. Hand-typing it
      // beside a declaration is the two-authorings problem in miniature, and
      // it had already drifted: this spot sat at z = {WALK_Z} = -97.0 while the
      // published door puts you at -96.75, 0.25 m apart. Small, and exactly
      // the class that grows — scripts/spots-walk.mjs now compares the two and
      // is how the gap was found.
      //
      // Derived by `standOf` rather than fetched with `doorStandFor`. Same
      // number; the difference is that asking the registry for it is a runtime
      // import, and that import is what dropped this building's door from the
      // built bundle. See `standOf` above.
      ...standOf(DOOR), r: 1.05,
      // CENTRED to match the facade, for the reason written out in full in
      // int-casino.ts: the portal on this elevation is at the frontage centre
      // (39.51 of [33.45, 45.45], mid 39.45) and this was -3.4, so the same wall
      // read centre from the street and a third to the right from inside. The
      // user's rule is "i need the facades to line up with the interior".
      at: 0, width: 1.15,
      // Along the walk, east, for the same reason as the casino: the north
      // side-street walk is a 2 m band and the building collider eats down to
      // z = -96.3, so stepping BACK from the door cannot clear a 1.05 m
      // trigger without putting you in the road. 1.55 m along it gives 1.57 m.
      outX: DOOR_X + 1.55, outZ: WALK_Z - 0.25, outYaw: 0, outGy: ctx.KERB_H,
    },
    // A lobby has a window — it is the one room on my list that wants people
    // outside to see in. East of the door, clear of it by 0.6 m so the kit's
    // overlap check has nothing to say.
    // Moved east and narrowed because the door moved to centre. At `at: 2.6,
    // w: 4.0` this spanned local x [0.6, 4.6]; a centred 1.15 m door spans
    // [-0.575, 0.575], so the two would have met with 2.5 cm between them and
    // the kit's overlap check would have had something to say. [1.5, 5.1] keeps
    // 0.93 m clear of the door and 0.4 m off the corner (half-width 5.5).
    window: { at: 3.3, w: 3.6, h: 1.7, sill: 0.9 },
  });

  const { put, solid } = room;
  const hw = room.W / 2, hd = room.D / 2;

  // ── the way in, matched to the doorway you came through ───────────────
  //
  // The same fault the user caught on the casino, found by doing what they then
  // asked -- "check your other five rooms' doors against their facades too".
  // Outside this one is a wide entrance in a pale stone case with two dark
  // glazed leaves and a brass post between them; inside was the kit's single
  // narrow leaf with a small window.
  //
  // Temporary and by hand, exactly as in int-casino.ts: F is extending the
  // frontage descriptor to publish door FORM, ct/interior.ts is F's, and this
  // should be deleted the day that lands. Colours are ct/vice.ts's own entrance
  // for this elevation -- #8a8478 and #9a9488 stone, #3a3428 leaf, the warm
  // glaze over it -- rather than colours chosen to look similar.
  const STONE = 0x8a8478, STONE_L = 0x9a9488;
  const stoneM = new THREE.MeshBasicMaterial({ color: STONE });
  const stoneLM = new THREE.MeshBasicMaterial({ color: STONE_L });
  const DW = 1.15, DH = 2.15, dAt = room.doorAt;
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
    else console.warn(`[interior:hotel] expected 1 kit door leaf to hide, found ${hits.length}`
      + ' — the lobby now has both the kit door and its own. ct/interior.ts changed shape.');
  }
  // the stone case: head, its lit top edge, and the two jambs
  put(new THREE.Mesh(new THREE.BoxGeometry(DW + 0.42, 0.20, 0.12), stoneM), dAt, DH + 0.08, hd - 0.07);
  put(new THREE.Mesh(new THREE.BoxGeometry(DW + 0.42, 0.04, 0.13), stoneLM), dAt, DH + 0.17, hd - 0.07);
  for (const sx of [-1, 1]) {
    put(new THREE.Mesh(new THREE.BoxGeometry(0.19, DH + 0.20, 0.12), stoneM),
      dAt + sx * (DW / 2 + 0.12), (DH + 0.20) / 2, hd - 0.07);
  }
  // two leaves, and the brass post between them that the facade also has
  const hLeafT = declareSurface(pixTex(24, 56, (g) => {
    g.fillStyle = '#141118'; g.fillRect(0, 0, 24, 56);
    g.fillStyle = '#3a3428'; g.fillRect(2, 2, 20, 52);
    g.fillStyle = 'rgba(232,200,138,0.30)'; g.fillRect(3, 3, 18, 44);
    g.fillStyle = 'rgba(255,246,224,0.16)';
    for (let i = 0; i < 9; i++) g.fillRect(4 + i, 4 + i * 2, 16 - i, 1);
    g.fillStyle = '#2a251c'; g.fillRect(2, 46, 20, 8);            // the kick panel
    g.fillStyle = '#9a7c3a'; g.fillRect(18, 22, 2, 12);           // brass pull
    dither(g, 24, 56, 36);
  }), 'detail');
  const hLeafM = new THREE.MeshBasicMaterial({ map: hLeafT, side: THREE.DoubleSide });
  const LW = DW / 2 - 0.04, OPEN = 0.50;
  for (const sx of [-1, 1]) {
    const hx = dAt + sx * DW / 2;
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(LW, DH - 0.06), hLeafM);
    leaf.rotation.y = -sx * OPEN;
    put(leaf, hx - sx * Math.cos(OPEN) * LW / 2, (DH - 0.06) / 2,
      hd - 0.13 - Math.sin(OPEN) * LW / 2);
  }
  put(new THREE.Mesh(new THREE.BoxGeometry(0.05, DH - 0.06, 0.05),
    new THREE.MeshBasicMaterial({ color: 0x9a7c3a })), dAt, (DH - 0.06) / 2, hd - 0.13);
  const BRASS = 0x9a7c3a, MAHOG = 0x4a2a20;
  const brassM = new THREE.MeshBasicMaterial({ color: BRASS });
  const mahogM = new THREE.MeshBasicMaterial({ color: MAHOG });

  // ── the carpet, and the vinyl over the worn part ──
  //
  // This was plain cream-and-ochre TILE and it was the single biggest reason the
  // room read municipal. "Patterned carpet doing far too much rather than plain
  // tile" is the instruction, and it is the same instruction the casino got and
  // the user liked the result of, so this is deliberately the same hand: 48x48
  // at the kit's density, a gold lattice on deep red, a colour fighting the gold,
  // and one motif too many.
  //
  // Not a copy of the casino's, though. A casino's carpet is designed to stop
  // you looking down; a hotel's is trying to look expensive, so this is a
  // bordered medallion — a repeating centre with a frame around it — rather than
  // an all-over diamond scatter.
  const carpetT = declareSurface(pixTex(48, 48, (g) => {
    g.fillStyle = '#5a2430'; g.fillRect(0, 0, 48, 48);
    // the border frame, two golds so it has a highlight and a shadow side
    g.fillStyle = '#8a6a22';
    for (const v of [0, 24]) { g.fillRect(v, 0, 2, 48); g.fillRect(0, v, 48, 2); }
    g.fillStyle = '#d8a83a';
    for (const v of [0, 24]) { g.fillRect(v, 0, 1, 48); g.fillRect(0, v, 48, 1); }
    // the medallion in each cell: a lozenge, ring and pip stacked
    const cells: [number, number][] = [[12, 12], [36, 12], [12, 36], [36, 36]];
    g.fillStyle = '#8a6a22';
    for (const [cx, cy] of cells) for (let t = 0; t <= 7; t++) {
      const r = 7 - t;
      g.fillRect(cx + t, cy - r, 1, 1); g.fillRect(cx - t, cy - r, 1, 1);
      g.fillRect(cx + t, cy + r, 1, 1); g.fillRect(cx - t, cy + r, 1, 1);
    }
    g.strokeStyle = '#3d5a4a'; g.lineWidth = 1;                 // a green fighting the gold
    for (const [cx, cy] of cells) { g.beginPath(); g.arc(cx + 0.5, cy + 0.5, 3, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = '#d8a83a';
    for (const [cx, cy] of cells) g.fillRect(cx - 1, cy - 1, 2, 2);
    // and the motif too many: a fleuron at every border crossing
    g.fillStyle = '#a8863a';
    for (const cx of [0, 24, 48]) for (const cy of [0, 24, 48]) {
      g.fillRect(cx - 3, cy, 7, 1); g.fillRect(cx, cy - 3, 1, 7);
      g.fillRect(cx - 1, cy - 1, 3, 3);
    }
    dither(g, 48, 48, 130);
  }), 'ground');
  carpetT.wrapS = carpetT.wrapT = THREE.RepeatWrapping;
  carpetT.repeat.set(Math.round(room.W / 2.4), Math.round(room.D / 2.4));
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(room.W, room.D), ctx.flat(carpetT));
  carpet.rotation.x = -Math.PI / 2;
  put(carpet, 0, 0.012, 0);

  // …and the shabby half, laid ON the track people actually walk: door to
  // desk. It is a different MATERIAL, not a dirtier tile — sheet vinyl in a
  // colour that never matched, with the carpet still showing at its edges. That
  // is what makes it read as a repair rather than as wear — and it matters more
  // now the floor under it is grand: sheet vinyl over a gold medallion carpet is
  // exactly the shape of a place that peaked decades ago.
  const vinylT = declareSurface(pixTex(32, 48, (g) => {
    g.fillStyle = '#6a6358'; g.fillRect(0, 0, 32, 48);
    g.fillStyle = 'rgba(255,255,255,0.06)';
    for (let y = 0; y < 48; y += 6) g.fillRect(0, y, 32, 1);    // the roll's own grain
    g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(0, 0, 2, 48); g.fillRect(30, 0, 2, 48);
    dither(g, 32, 48, 70);
  }), 'ground');
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
  const deskT = declareSurface(pixTex(24, 56, (g) => {
    g.fillStyle = '#4a2a20'; g.fillRect(0, 0, 24, 56);
    g.fillStyle = '#5c382a';                                    // raised panels
    for (let y = 6; y < 52; y += 16) g.fillRect(3, y, 18, 12);
    g.fillStyle = 'rgba(0,0,0,0.30)';
    for (let y = 6; y < 52; y += 16) g.fillRect(3, y + 11, 18, 1);
    g.fillStyle = '#6a4630'; g.fillRect(0, 0, 24, 3);           // the counter's edge
    dither(g, 24, 56, 34);
  }), 'detail');
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

  // ── brass and mirror behind the desk, and drapes at the window ────────
  //
  // The last two things the instruction names. Both are cheap and both do a lot,
  // because they are what a lobby has and a waiting room does not.
  //
  // The mirror is a tall dark panel in a gold frame rather than a real
  // reflection: this world has no reflective material and a flat pale rectangle
  // would read as a hole. Dark glass with a highlight raked across it reads as
  // mirror at a glance, which is the same trick the casino's bronzed glazing
  // plays on the street outside.
  const mirrorT = declareSurface(pixTex(24, 40, (g) => {
    g.fillStyle = '#241a1c'; g.fillRect(0, 0, 24, 40);
    g.fillStyle = 'rgba(216,168,58,0.10)';
    for (let i = 0; i < 14; i++) g.fillRect(2 + i, 3 + i * 2, 8 - Math.floor(i / 3), 1);
    g.fillStyle = 'rgba(255,246,224,0.13)'; g.fillRect(3, 2, 2, 34);
    dither(g, 24, 40, 40);
  }), 'detail');
  for (const mz of [DESK_Z - 1.4, DESK_Z + 1.4]) {
    put(new THREE.Mesh(new THREE.PlaneGeometry(1.25, 2.1), new THREE.MeshBasicMaterial({ color: 0xd8a83a })),
      -hw + 0.05, 1.85, mz).rotation.y = Math.PI / 2;
    put(new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.9), ctx.flat(mirrorT)),
      -hw + 0.07, 1.85, mz).rotation.y = Math.PI / 2;
  }

  // Tall drapes at the window — floor length, not sill length, which is the
  // whole difference between a lobby and an office. The window is at local
  // x 3.3, 3.6 m wide with its sill at 0.9, so the pair hangs outside that at
  // 1.5 and 5.1 and falls from the head to the floor.
  const drapeT = declareSurface(pixTex(16, 64, (g) => {
    g.fillStyle = '#5a1520'; g.fillRect(0, 0, 16, 64);
    for (let x = 0; x < 16; x += 3) {                    // the folds
      g.fillStyle = 'rgba(0,0,0,0.26)'; g.fillRect(x, 0, 1, 64);
      g.fillStyle = 'rgba(216,168,58,0.10)'; g.fillRect(x + 1, 0, 1, 64);
    }
    g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(0, 58, 16, 6);   // dust at the hem
    dither(g, 16, 64, 60);
  }), 'detail');
  const drapeM = ctx.flat(drapeT);
  for (const dx of [1.5, 5.1]) {
    put(new THREE.Mesh(new THREE.PlaneGeometry(0.85, 2.75), drapeM), dx, 1.375, hd - 0.09);
  }
  // the pelmet the pair hangs from, in the same gold as everything else up high
  put(new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.22, 0.12),
    new THREE.MeshBasicMaterial({ color: 0x8a6a22 })), 3.3, 2.86, hd - 0.10);

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
  const CLERK_X = DESK_X - 0.62, CLERK_Z = DESK_Z + 0.35;   // behind the counter
  room.person({ jacket: '#8a8478', pants: '#3a3630', skin: '#8d5a34', hair: '#241a12',
      accent: '#6a2a30', fit: 'plain', cut: 'crop', build: 0, stride: 2 },
    CLERK_X, CLERK_Z,
    // Derived from where the GUEST stands, not typed and not aimed at the desk.
    // `Math.PI / 2` was right, but it is the same copied-constant shape that left
    // the tax preparer and the pawnbroker facing their back walls (GOTCHAS §23).
    //
    // Aiming at the desk CENTRE was my first attempt and it is wrong by 30°: the
    // clerk stands off-centre along the counter, so the centre is diagonally
    // forward of him while the guest is straight across. The desk is 0.75 m deep
    // in x down the west wall, so the guest stands at its +x face, level with the
    // clerk — which is what this points at, and it stays right if he moves along
    // the counter.
    { facing: Math.atan2((DESK_X + 0.375) - CLERK_X, CLERK_Z - CLERK_Z), h: 1.0, w: 0.98 });

  // ── the pigeonholes, on the wall behind the desk ──
  //
  // The single most hotel-lobby object there is, and the one that carries the
  // story: most of the keys are still on their hooks, which means most of the
  // rooms are empty. A few holes have mail in them that nobody has collected.
  const holesT = declareSurface(pixTex(96, 40, (g) => {
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
  }), 'detail');
  const holes = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.5), ctx.flat(holesT));
  holes.rotation.y = Math.PI / 2;                                // faces +x, into the room
  put(holes, -hw + 0.06, 1.85, DESK_Z);

  // the rate card, framed under glass beside the pigeonholes. Weekly rates,
  // because that is what a hotel quotes when it has stopped being a hotel for
  // travellers and become one for residents — the whole fall, in four lines.
  const rateT = declareSurface(pixTex(40, 28, (g) => {
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
  }), 'sign');
  const rate = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.52), ctx.flat(rateT));
  rate.rotation.y = Math.PI / 2;
  put(rate, -hw + 0.06, 1.55, DESK_Z + 2.85);

  // ── the lift ──
  //
  // East wall. No collider: the room's own wall already stops you 0.36 m short
  // of it, so a box here would only be a second wall in the same place — and
  // an unnecessary collider next to nothing is how the bodega's door got eaten
  // (GOTCHAS §8).
  const liftT = declareSurface(pixTex(48, 56, (g) => {
    g.fillStyle = '#6a6258'; g.fillRect(0, 0, 48, 56);          // the surround
    g.fillStyle = '#8a8478'; g.fillRect(3, 2, 42, 52);          // the doors
    g.fillStyle = '#5a544a'; g.fillRect(23, 2, 2, 52);          // the seam between them
    g.fillStyle = '#9a9488'; g.fillRect(3, 2, 42, 1);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let x = 6; x < 45; x += 6) g.fillRect(x, 3, 1, 50);    // fluted panels
    g.fillStyle = '#9a7c3a'; g.fillRect(38, 26, 5, 8);          // the call plate
    g.fillStyle = '#2a2620'; g.fillRect(39, 28, 3, 2);
    dither(g, 48, 56, 40);
  }), 'detail');
  const lift = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.25), ctx.flat(liftT));
  lift.rotation.y = -Math.PI / 2;                                // faces -x, into the room
  put(lift, hw - 0.06, 1.13, -2.0);

  // the floor dial over it, stopped between floors — the detail that says the
  // lift has not moved in a while without anyone having to write it down
  const dialT = declareSurface(pixTex(40, 22, (g) => {
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
  }), 'detail');
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
  // Shifted east from 1.6 when the door moved to centre. The seating collider
  // is 3.0 x 2.0 about this point, so at 1.6 it spanned local x [0.1, 3.1] --
  // directly in front of a centred door, and walking in put you straight into
  // it. That is the pawn shop's "i immediately hit a counter" all over again,
  // caught by G-rooms-walk's spawn probe rather than by the user this time.
  // At 2.6 it spans [1.1, 4.1]: clear of a 0.36 m player entering at x 0, under
  // the window where lobby seating wants to be, and leaving 1.4 m between the
  // chairs and the east wall. 3.0 was the first try and pushed that lane down to
  // 1.0 m -- walkable, but a squeeze the room did not used to have.
  const CH_X = 2.6, CH_Z = 2.2;
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
  const lowT = declareSurface(pixTex(32, 20, (g) => {
    g.fillStyle = '#5c3826'; g.fillRect(0, 0, 32, 20);
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, 0, 32, 2);
    g.fillStyle = 'rgba(0,0,0,0.20)';
    for (let x = 0; x < 32; x += 7) g.fillRect(x, 0, 1, 20);
    dither(g, 32, 20, 20);
  }), 'detail');
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
  const palmT = declareSurface(pixTex(40, 56, (g) => {
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
  }), 'detail');
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
  const photoT = declareSurface(pixTex(56, 40, (g) => {
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
  }), 'detail');
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
  const glowT = declareSurface(pixTex(32, 32, (g) => {
    const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15);
    gr.addColorStop(0, 'rgba(248,214,140,0.42)');
    gr.addColorStop(1, 'rgba(248,214,140,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  }), 'detail');
  const glowM = new THREE.MeshBasicMaterial({
    map: glowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  // "a chandelier or a run of glass fixtures instead of flush ceiling discs".
  // A RUN, not a chandelier, because the brief this room was built to also says
  // one lamp is out, and four fixtures with one dead tells that story where a
  // single central chandelier cannot. They hang now — brass stem, brass gallery,
  // faceted glass bowl — instead of sitting flush, which is most of what makes a
  // ceiling read as tall.
  const litShadeM = new THREE.MeshBasicMaterial({ color: 0xf0d9a0 });
  const deadShadeM = new THREE.MeshBasicMaterial({ color: 0x6e6a62 });
  const galleryM = new THREE.MeshBasicMaterial({ color: 0xd8a83a });
  const FITTINGS: [number, number, boolean][] = [
    [-2.8, -2.4, true], [2.8, -2.4, false], [-2.8, 2.4, true], [2.8, 2.4, true],
  ];
  for (const [lx, lz, lit] of FITTINGS) {
    // the stem: brass, and long enough that the fitting is IN the room
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.52, 6), brassM), lx, room.H - 0.26, lz);
    // the gallery it hangs from, and the ceiling rose above it
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.10, 0.05, 8), galleryM), lx, room.H - 0.03, lz);
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.06, 6), galleryM), lx, room.H - 0.55, lz);
    // the bowl: a faceted glass dish, wider and shallower than the old disc
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.16, 0.24, 8), lit ? litShadeM : deadShadeM),
      lx, room.H - 0.70, lz);
    if (lit) {
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), glowM);
      gl.rotation.x = Math.PI / 2;
      put(gl, lx, room.H - 0.45, lz);
    }
  }

}
