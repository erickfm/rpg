import * as THREE from 'three';
import { BUILD, type CtxBuild } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import { frontageWorld, frontageOf, SHOP_BAND_H } from './tex-world';
import type { AABB } from '../fp';
import {
  frameBox, frameFromWorld, frameGroup, type SiteFrame,
} from './sites';

// THE COLLEGE COURTYARD — the outside of CROSSTOWN COMMUNITY COLLEGE.
//
// *"hey please improve the ourdoor facade of the community college. feel free
//  to make a little courtyard. make it nice. a little quiant campus."*
//   (2026-08-09)
//
// ── WHERE THE COURTYARD COMES FROM ──────────────────────────────────────────
//
// NOT from the pavement — the 2 m lane is sacred and nothing here touches it.
// The college's shell is recessed 4.5 m behind the street's building line
// (`ct/street.ts` passes `placeBldZ` a zc shifted by `COLLEGE_YARD_D`, and
// shells are 14–23.5 m deep, so the depth is the building's own). That leaves
// a frontage-wide x 4.5 m notch between the party walls of whatever the college
// stands between — two real brick flanks the street already painted, which is
// exactly what a small campus court sits between. (It was 11 m wide between
// SMOKES and the corner block when it was written; the college has 23.2 m of the
// main street now and SMOKES has been deleted, but the shape of the argument is
// the same and the module derives its own extents.) This module builds
// everything IN the notch:
// paving, the low wall and gate, the path, the planting, the lamps, the sign.
//
// Everything solid stands at z ≤ -110.05 — behind the building line — so the
// crowd's walk and the player's lane are untouched by construction.
//
// ── THE AXIS IS THE DESIGN ──────────────────────────────────────────────────
//
// Gate, path, doorcase: one line at x 51.5. `BANDS.college` centres the door
// (`ct/tex-world.ts`), the path below runs at the same x, and the gate piers
// straddle it — so from the far pavement you see straight through the gate to
// the double doors. Everything else is symmetric about that line: two beds,
// two trees, two benches, and the two one-off objects (the name stub, the
// notice board) balanced one each side.
export const COLLEGE_YARD_D = 4.5;

// ── THE COLLEGE IS ON THE MAIN STREET NOW ────────────────────────────────────
//
// *"swap the used car lot and the college pls"* (2026-08-11). It stood on the
// last 11 m of the side street's south row, at x 46…57; it now has the 23.2 m
// of the main street's east side that the used car lot occupied, and the lot
// has the 11 m. `ct/street.ts` has the arithmetic and why it is a swap of slots
// and not of footprints.
//
// THIS FILE USED TO TYPE ITS OWN POSITION — `X0 = 46, X1 = 57, WALK_Z = -110`,
// under a comment claiming they were "checked against the registry at build
// time". **They were not.** `frontageWorld()` was fetched and used only for a
// null test; every other field was ignored. So a college that moved would have
// had a complete courtyard — paving, path, wall, gate, sign, notice board,
// trees, benches, lamps, a 17 m party wall and every collider for it — built at
// x 46…57 on top of whatever now stands there, silently. That is the class of
// bug this swap was sent to find, and it was armed in the file the swap starts
// in.
//
// IT IS DERIVED NOW, and the axis with it. The module still builds in the frame
// it was authored for — x along the frontage from 0, z running back from the
// building line at 0 into the yard — and `ct/sites.ts` turns that frame onto
// whichever street the registry says the college is on. Same move as the car
// lot's, in the opposite direction, and the same reason: an axis is not
// something 400 lines of hand-placed masonry should have to carry.
const CX_OF = (w: number) => w / 2;          // the axis, in local terms
const WALK_Z = 0;                            // the building line, local
const FACE_Z = WALK_Z - COLLEGE_YARD_D;      // the recessed facade plane, local

// `COLLEGE_FACE_Z` WAS RE-EXPORTED FROM HERE AND IS GONE. It was
// `= SOUTH_WALK_BOUND_Z`, and `crosstown.ts` imported it to derive
// `WORLD_BOUNDS.minZ` — a name that stopped being true the moment the college
// left the side street, because the southernmost ground a player can stand on
// is the USED CAR LOT'S back fence and `ct/sites.ts` owns that geometry. The
// trunk now imports `SOUTH_WALK_BOUND_Z` from `ct/sites.ts` directly, which is
// where it has always been declared; this module was only ever a hop, and a hop
// through the college is exactly what made the name lie. THE NUMBER IS
// UNCHANGED — it is the same constant, reached without the detour. It is
// load-bearing: that clamp is the only thing stopping the player leaving the
// world at the south, and it must follow the lot's back wall or you get
// *"i cant walk into …"* a third time.

/** THE EAST PARTY WALL'S OWN FOOTPRINT, and the one place it is written.
 *
 *  The wall (built far below) stands INSIDE the college's lot, against its
 *  east property line — so its outer face is `X1` and its inner face is
 *  `PW_X0`. Everything in the yard that runs east — the low wall, the coping,
 *  the planting bed — stops at `PW_X0`, because that is where the yard
 *  actually ends. They used to stop at `X1 - small`, i.e. 0.45 m PAST the
 *  wall's inner face, which buried their ends inside it and put the low
 *  wall's north face on exactly the same plane as the party wall's:
 *  *"graphics overlap between jail and college"* (2026-08-11). */
const PW_T = 0.50;

export const ORDER = BUILD.PROPS;

export function register(ctx: CtxBuild): void {
  // The registry is the check that street.ts actually recessed the shell —
  // if the roster loses the college, build no courtyard to nowhere. AND IT IS
  // THE POSITION, now, not just a null test.
  const FW = frontageWorld('COMMUNITY COLLEGE');
  if (!FW) {
    console.warn('[college-yard] no COMMUNITY COLLEGE frontage registered — building nothing.');
    return;
  }
  const X0 = 0, X1 = FW.frontageM;
  const CX = CX_OF(X1);                        // the axis, in local terms
  const PW_X0 = X1 - PW_T;                     // the party wall's inner face
  // The building line: one recess OUT from the recessed facade, on the facade's
  // own axis. `outward` is which way the front looks, so this is arithmetic and
  // not a case analysis.
  const lineOn = FW.facePos + FW.outward * COLLEGE_YARD_D;
  const local = { minX: X0, maxX: X1, minZ: FACE_Z, maxZ: WALK_Z };
  // ── WHICH STREET, AND THEREFORE WHICH WAY THE FRAME TURNS ────────────────
  //
  // Authored on a cross street's south row: frontage along +x, front looking
  // +z, yard running back into -z. That is the identity frame. On the main
  // street's east side the frontage runs along z and the front looks -x, which
  // is that frame turned a quarter turn: local +x → world +z, local -z →
  // world +x. Both are right angles, so `frameBox` is exact (ct/sites.ts).
  let fr: SiteFrame | null = null;
  if (FW.axis === 'x' && FW.outward === 1) fr = { rotY: 0, ox: FW.loWorld, oz: lineOn, local };
  else if (FW.axis === 'z' && FW.outward === -1) fr = { rotY: -Math.PI / 2, ox: lineOn, oz: FW.loWorld, local };
  if (!fr) {
    console.warn(`[college-yard] the college's frontage runs along ${FW.axis} looking `
      + `${FW.outward > 0 ? '+' : '-'}${FW.axis === 'x' ? 'z' : 'x'}, which this module has no `
      + 'frame for — building nothing rather than a courtyard laid sideways.');
    return;
  }
  const { flat, KERB_H } = ctx;
  const grp = frameGroup(fr);
  ctx.scene.add(grp);
  // Geometry rides the group; a collider does not — `ctx.obstacle` takes a
  // WORLD box and a group transform never reaches it. Turn it here or the yard
  // looks right and collides at ninety degrees to itself.
  const obstacle = (b: AABB) => ctx.obstacle(frameBox(fr!, b));
  const put = (m: THREE.Object3D, x: number, y: number, z: number) => {
    m.position.set(x, y, z); grp.add(m); return m;
  };

  // ── the ground: the yard is pavement-height, and the world must know ──────
  // The base walk stops at the building line; without this the notch answers
  // road height and the player steps 12 cm DOWN through the paving.
  // …asked in WORLD coordinates, answered in the yard's own — the ground stack
  // has no idea this module is framed and must not have to.
  ctx.ground((wx, wz) => {
    const [x, z] = frameFromWorld(fr!, wx, wz);
    return x >= X0 && x <= X1 && z <= WALK_Z && z >= FACE_Z ? KERB_H : null;
  });

  // ── the paving: clay paviours, laid coursed, dark red-brown ───────────────
  // Brick underfoot is what separates a yard from a continuation of the
  // pavement's concrete flags — the church and the park make the same move.
  // One canvas covers 1.0 m (GOTCHAS §5): four 0.25 m courses of half-bond.
  const pavT = declareSurface(pixTex(32, 32, (g) => {
    g.fillStyle = '#7a4a38'; g.fillRect(0, 0, 32, 32);
    const ROW = ['#835040', '#74463a', '#7e4c3a', '#6e4236'];
    for (let r = 0; r < 4; r++) {
      g.fillStyle = ROW[r];
      for (let c = 0; c < 4; c++) g.fillRect(c * 8 + (r % 2) * 4 - 4, r * 8, 7, 7);
    }
    g.fillStyle = 'rgba(40,28,22,0.35)';
    for (let r = 1; r < 4; r++) g.fillRect(0, r * 8 - 1, 32, 1);     // the joints
    dither(g, 32, 32, 26);
  }), 'ground');
  pavT.wrapS = pavT.wrapT = THREE.RepeatWrapping;
  pavT.repeat.set(X1 - X0, COLLEGE_YARD_D);
  const pavM = ctx.wet(flat(pavT));
  const pav = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, COLLEGE_YARD_D), pavM);
  pav.rotation.x = -Math.PI / 2;
  put(pav, CX, KERB_H + 0.008, WALK_Z - COLLEGE_YARD_D / 2);

  // the path: pale stone flags on the axis, gate to door, proud by 6 mm
  const flagT = declareSurface(pixTex(32, 32, (g) => {
    g.fillStyle = '#b8ae96'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#aca288'; g.fillRect(0, 0, 32, 15); g.fillRect(16, 16, 16, 16);
    g.fillStyle = 'rgba(60,50,40,0.30)';
    g.fillRect(0, 15, 32, 1); g.fillRect(15, 0, 1, 32);
    dither(g, 32, 32, 22);
  }), 'ground');
  flagT.wrapS = flagT.wrapT = THREE.RepeatWrapping;
  flagT.repeat.set(1.8, COLLEGE_YARD_D);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(1.8, COLLEGE_YARD_D), ctx.wet(flat(flagT)));
  path.rotation.x = -Math.PI / 2;
  put(path, CX, KERB_H + 0.014, WALK_Z - COLLEGE_YARD_D / 2);

  // ── the low wall and the gate piers, on the building line ─────────────────
  // 0.82 m of brick with a stone coping — high enough to make a court, low
  // enough to see the whole facade over. The gate is 2.0 m clear between the
  // pier faces, so the lane THROUGH the yard is as wide as the one outside it.
  const brickT = declareSurface(pixTex(32, 16, (g) => {
    g.fillStyle = '#6e4234'; g.fillRect(0, 0, 32, 16);
    g.fillStyle = 'rgba(30,20,16,0.40)';
    for (let r = 1; r < 4; r++) g.fillRect(0, r * 4 - 1, 32, 1);
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 3; c++) g.fillRect(((c * 11 + (r % 2) * 5) % 32), r * 4, 1, 3);
    dither(g, 32, 16, 24);
  }), 'detail');
  brickT.wrapS = brickT.wrapT = THREE.RepeatWrapping;
  const brickFor = (wM: number, hM: number) => {
    const t = brickT.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(wM / 1.0, hM / 0.5);
    t.needsUpdate = true;
    return flat(t);
  };
  const stoneM = new THREE.MeshBasicMaterial({ color: 0xc9bfa4 });
  const WALL_H = 0.82, WALL_T = 0.30, WALL_Z = WALK_Z - 0.20;      // -110.05…-110.35
  // The east run DIES INTO THE PARTY WALL at `PW_X0` — abut, never overlap,
  // which is `ct/street.ts`'s own rule for two neighbours sharing a boundary
  // plane. It ran to `X1 - 0.05` (56.95) while the party wall's inner face is
  // at 56.50, so its last 0.45 m stood inside the wall with both boxes ending
  // on z −110.05: half a metre of brick and granite fighting for the same
  // pixels, which is what the user photographed. The west run is unchanged —
  // the neighbouring shell's own flank is the wall on that side and it stands
  // at `X0`. (That neighbour was SMOKES when this was written, on the side
  // street; SMOKES is deleted and the college is on the main street, and the
  // run is derived, so it followed.)
  for (const [a, b] of [[X0 + 0.05, CX - 1.50], [CX + 1.50, PW_X0]] as const) {
    const w = b - a, c = (a + b) / 2;
    put(new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, WALL_T), brickFor(w, WALL_H)),
      c, KERB_H + WALL_H / 2, WALL_Z);
    put(new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.07, WALL_T + 0.08), stoneM),
      c, KERB_H + WALL_H + 0.035, WALL_Z);
    // capped at the coping's top face (2026-08-09, "collision that goes to
    // the moon") — a 0.86 m wall is a jump-on ledge, not a wall to the sky
    obstacle({
      minX: a, maxX: b, minZ: WALL_Z - WALL_T / 2 - 0.04, maxZ: WALL_Z + WALL_T / 2 + 0.04,
      maxY: KERB_H + WALL_H + 0.07,
    });
  }
  // the piers, and the two lamps that make it an evening school from the street
  for (const px of [CX - 1.25, CX + 1.25]) {
    put(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.55, 0.5), brickFor(0.5, 1.55)),
      px, KERB_H + 0.775, WALL_Z);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.62), stoneM),
      px, KERB_H + 1.59, WALL_Z);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.22),
      new THREE.MeshBasicMaterial({ color: 0x2e2a24 })), px, KERB_H + 1.76, WALL_Z);
    // …and the lamps are LIT now, which they never were. The comment above has
    // always called them "the two lamps that make it an evening school from the
    // street", but a flat-coloured box has no texture for `props.ts`'s
    // `isSelfLit` to read, so both graded down into the night with the brick
    // and the pier went dark at the top. `userData.lightSource` is the hand
    // declaration for that exact case; a fresh instance per pier because the
    // lamp census is keyed by material. See THE LANTERNS, below, which is the
    // same decision at the door and the place it is argued.
    const pierGlass = new THREE.MeshBasicMaterial({ color: 0xf2c86a });
    pierGlass.userData.lightSource = true;
    put(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.17, 0.15), pierGlass),
      px, KERB_H + 1.755, WALL_Z);
    // the lamp's top face: pier cap 1.59 + lantern body + finial band
    obstacle({
      minX: px - 0.31, maxX: px + 0.31, minZ: WALL_Z - 0.31, maxZ: WALL_Z + 0.31,
      maxY: KERB_H + 1.89,
    });
  }

  // ── the name, built in masonry, not hung: a brick stub west of the gate ────
  // 288 x 120 for a 1.8 x 0.72 m plate = 160 px/m — the shop-board standard,
  // because a plate at the pavement is read from two metres. The first cut was
  // 53 px/m with an 8 px font: *"the sign is too blurry"*.
  const signT = declareSurface(pixTex(288, 120, (g) => {
    g.fillStyle = '#6a2430'; g.fillRect(0, 0, 288, 120);
    g.strokeStyle = '#c9bfa4'; g.lineWidth = 5; g.strokeRect(9, 9, 270, 102);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 26px monospace'; g.fillStyle = '#efe8d4';
    g.fillText('CROSSTOWN', 144, 36);
    g.fillText('COMMUNITY COLLEGE', 144, 63);
    g.font = '15px monospace'; g.fillStyle = '#d8b86a';
    g.fillText('EST 1971 · EVENING DIVISION', 144, 96);
  }), 'sign');
  {
    const SX = X0 + 1.7, SZ = WALK_Z - 1.1;
    put(new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.55, 0.35), brickFor(2.0, 1.55)),
      SX, KERB_H + 0.775, SZ);
    put(new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 0.45), stoneM),
      SX, KERB_H + 1.59, SZ);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.72),
      flat(signT));
    put(plate, SX, KERB_H + 1.10, SZ + 0.181);          // faces the street
    // the stub's coping top: 1.59 centre + 0.04 half-thickness
    obstacle({
      minX: SX - 1.0, maxX: SX + 1.0, minZ: SZ - 0.18, maxZ: SZ + 0.18,
      maxY: KERB_H + 1.63,
    });
  }

  // ── the notice board east of the gate, glazed, on two posts ───────────────
  // 216 x 126 for 1.32 x 0.74 m = 163 px/m, same argument as the plate: the
  // headline is read from the pavement, the flyers only need to read AS flyers.
  const noteT = declareSurface(pixTex(216, 126, (g) => {
    g.fillStyle = '#b08a54'; g.fillRect(0, 0, 216, 126);             // the cork
    g.fillStyle = '#3a332a';
    g.fillRect(0, 0, 216, 6); g.fillRect(0, 120, 216, 6);
    g.fillRect(0, 0, 6, 126); g.fillRect(210, 0, 6, 126);
    g.fillStyle = '#6a2430'; g.fillRect(12, 12, 192, 24);
    g.font = 'bold 15px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#efe8d4'; g.fillText('EVENING DIVISION', 108, 25);
    const PAPER = ['#f4efe0', '#ffffff', '#f0e4c8'];
    for (let i = 0; i < 4; i++) {
      const x = 15 + i * 51, y = 45 + (i % 2) * 12;
      g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(x + 3, y + 3, 42, 54);
      g.fillStyle = PAPER[i % PAPER.length]; g.fillRect(x, y, 42, 54);
      g.fillStyle = 'rgba(40,30,20,0.60)';
      for (let l = 0; l < 5; l++) g.fillRect(x + 6, y + 9 + l * 9, 30 - (l % 2) * 9, 3);
    }
    g.fillStyle = 'rgba(200,220,235,0.15)'; g.fillRect(6, 6, 90, 114);  // the glass
    dither(g, 216, 126, 40);
  }), 'sign');
  {
    const NX = X1 - 1.6, NZ = WALK_Z - 1.1;
    const dark = new THREE.MeshBasicMaterial({ color: 0x3a332a });
    for (const dx of [-0.62, 0.62])
      put(new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.65, 0.08), dark), NX + dx, KERB_H + 0.825, NZ);
    put(new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.86, 0.09), dark), NX, KERB_H + 1.22, NZ);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 0.74), flat(noteT));
    put(face, NX, KERB_H + 1.22, NZ + 0.051);           // read from the pavement
    // the posts' top: 0.825 centre + 0.825 half-height
    obstacle({
      minX: NX - 0.70, maxX: NX + 0.70, minZ: NZ - 0.10, maxZ: NZ + 0.10,
      maxY: KERB_H + 1.65,
    });
  }

  // ── the planting: two beds along the facade, two young trees in planters ──
  const bedTop = declareSurface(pixTex(32, 8, (g) => {
    g.fillStyle = '#3a2e22'; g.fillRect(0, 0, 32, 8);                // the soil
    const BLOOM = ['#8a2c42', '#c8a230', '#efe8d4'];                 // maroon and gold
    for (let i = 0; i < 14; i++) {
      g.fillStyle = '#3d5a34'; g.fillRect((i * 7) % 32, (i * 3) % 8, 2, 2);
      g.fillStyle = BLOOM[i % BLOOM.length]; g.fillRect((i * 7 + 1) % 32, (i * 3 + 1) % 8, 1, 1);
    }
    dither(g, 32, 8, 18);
  }), 'detail');
  // …and the east bed keeps its 0.3 m margin off the wall it runs to, which is
  // the party wall's inner face, not the property line 0.5 m inside it.
  for (const [a, b] of [[X0 + 0.3, CX - 1.3], [CX + 1.3, PW_X0 - 0.3]] as const) {
    const w = b - a, c = (a + b) / 2, BZ = FACE_Z + 0.35, BD = 0.5;
    put(new THREE.Mesh(new THREE.BoxGeometry(w, 0.32, BD), brickFor(w, 0.32)),
      c, KERB_H + 0.16, BZ);
    const t = bedTop.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(w / 1.0, 1); t.needsUpdate = true;
    const top = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.10, BD - 0.10), flat(t));
    top.rotation.x = -Math.PI / 2;
    put(top, c, KERB_H + 0.33, BZ);
    // capped at the soil plane, a 0.33 m kerb of planting, not a wall
    obstacle({ minX: a, maxX: b, minZ: BZ - BD / 2, maxZ: BZ + BD / 2, maxY: KERB_H + 0.33 });
  }
  // the trees: young, in square brick planters — a quaint campus is planted,
  // and two is a colonnade at this scale. Park grammar: bark box, crossed
  // alpha planes, never a billboard.
  const leafT = declareSurface(pixTex(48, 40, (g) => {
    const GREEN = ['#3d5a34', '#4a6a3c', '#35502e'];
    for (let i = 0; i < 46; i++) {
      g.fillStyle = GREEN[i % GREEN.length];
      const x = 4 + (i * 11) % 40, y = 2 + (i * 7) % 30;
      g.fillRect(x, y, 5 + (i % 3) * 2, 4 + ((i + 1) % 3) * 2);
    }
  }), 'detail');
  const leafM = new THREE.MeshBasicMaterial({ map: leafT, alphaTest: 0.5, side: THREE.DoubleSide });
  const barkM = new THREE.MeshBasicMaterial({ color: 0x4a3828 });
  for (const tx of [X0 + 1.9, X1 - 1.9]) {
    const TZ = WALK_Z - 2.5;
    put(new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.45, 1.15), brickFor(1.15, 0.45)),
      tx, KERB_H + 0.225, TZ);
    put(new THREE.Mesh(new THREE.BoxGeometry(1.21, 0.06, 1.21), stoneM),
      tx, KERB_H + 0.48, TZ);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.9, 0.16), barkM),
      tx, KERB_H + 1.30, TZ);
    for (let i = 0; i < 3; i++) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.2), leafM);
      pl.rotation.y = (i * Math.PI) / 3;
      put(pl, tx, KERB_H + 3.15, TZ);
    }
    // capped at the planter's stone rim (0.48 + 0.03); the young trunk pokes
    // through the stand plane the way a bench's back slats do
    obstacle({ minX: tx - 0.62, maxX: tx + 0.62, minZ: TZ - 0.62, maxZ: TZ + 0.62, maxY: KERB_H + 0.51 });
  }

  // ══ THE EAST PARTY WALL — closing the slot to the sky ══════════════════════
  //
  // *"gotta fix this"* (2026-08-09, with a photograph of rain falling through
  // a full-height crack between the buildings). The recess assumed the corner
  // block sealed the yard's east side. IT DOES NOT: the jail sits BACK behind
  // its own forecourt (`ct/jail.ts`, `FX = site.minX + FORE`), so there has
  // never been a wall at x = 57 below the street line — LOANS's own east
  // party wall was what filled it, and recessing the shell removed exactly
  // that stretch. The west side really is sealed (the neighbouring shell's box
  // runs deep past the yard — it was SMOKES' 14 m when this was written, on the
  // side street, and SMOKES is deleted now); this wall is the missing four
  // metres on the other side, built
  // in the corner block's own family — granite ashlar base, sooted brick
  // above — to the college shell's full 17.2 m, so the yard reads as a notch
  // carved between solid buildings.
  //
  // ── AND IT HAS TO REACH THE CORNER, which for one pass it did not ─────────
  //
  // *"gap here and graphics overlap between jail and college"* (2026-08-11,
  // photographed from the pavement at the corner). The wall was drawn 0.02 m
  // short in x and 0.05 m short in z — east face at 56.98, north face at
  // −110.05 — while its COLLIDER already ran the full x 56.50…57.00,
  // z −114.50…−110.00. The jail's forecourt flank screen starts at exactly
  // (x 57, z −110) and runs east (`ct/jail.ts`, `site.minX`…`FX` on `Z_S`).
  // So the two buildings' solids missed each other diagonally and left a
  // 2 cm x 13.6 m chimney open at the corner: the yard's east side is capped
  // by the college shell only from z −114.5 back, so a sightline into that
  // notch went straight past the block into the void south-east of it. The
  // mesh was smaller than the collision the world already asserted for it.
  //
  // BOTH FACES ARE NOW THE FOOTPRINT, NOT AN OFFSET. East face = `X1`, the
  // college's own property line and the plane both side-street rosters end on;
  // north face = `WALK_Z`, the building line. The jail's screen owns x ≥ 57
  // and z ≥ −110; this wall owns x ≤ 57 and z ≤ −110; they share the corner
  // EDGE and no face area, which is `ct/street.ts`'s abut-never-overlap rule
  // and therefore not the coplanar z-fight that got the old cross building
  // demolished (GOTCHAS §6). Move either building and the join follows,
  // instead of a nudged number relocating the fault.
  {
    const PW_X1 = X1;                     // the east property line
    const PW_Z0 = FACE_Z, PW_Z1 = WALK_Z; // shell face to building line
    const PW_H = 17.2;                    // gh 4.2 + 3.4 + 4 floors x 2.4
    // The jail is the other half of this join. It is not this module's to
    // place, so disagreement is a loud line rather than a silent slot — the
    // same shape `ct/jail.ts` uses when its own published site moves.
    // THE JAIL IS NOT THE OTHER HALF OF THIS JOIN ANY MORE. This wall used to
    // abut the jail's forecourt screen at (57, -110) and warned if the jail's
    // published site moved off x 57. The college is on the main street now: the
    // wall stands at the yard's high-frontage end, which is the block's north
    // end at z 14.2, and what it meets there is the cap building — `CAP_W =
    // 2 * FACE`, *"exactly the street, no more"*, sealing x -7…7 and nothing
    // beyond. So this wall is not a nicety, it is the ONLY thing closing the
    // yard on that side, and it is the same escape class (item 221) the lot's
    // north flank was: a site closed on one axis-half with nothing closing the
    // other. Abut-never-overlap still holds — the wall owns up to the property
    // line and no further — but there is no second module to disagree with, so
    // there is nothing left to warn about and a warning that cannot fire is
    // worse than none.
    const PW_D = PW_Z1 - PW_Z0;           // 4.5 m of run
    const TW = Math.round(PW_D * 8);      // 8 px/m — masonry wants courses, not letters
    const partyT = declareSurface(pixTex(TW, 138, (g) => {
      g.fillStyle = '#6b4034'; g.fillRect(0, 0, TW, 138);            // the brick field
      g.fillStyle = 'rgba(30,22,16,0.35)';
      for (let y = 0; y < 138; y += 4) g.fillRect(0, y, TW, 1);      // the courses
      g.fillStyle = 'rgba(0,0,0,0.22)';                              // the soot, heavier up top
      for (let i = 0; i < 30; i++) g.fillRect((i * 11) % TW, (i * 17) % 90, 3, 2);
      // the granite ashlar base, 3.0 m of it — the corner block's own move
      g.fillStyle = '#8a8d88'; g.fillRect(0, 114, TW, 24);
      g.fillStyle = 'rgba(40,42,40,0.45)';
      for (let y = 114; y < 138; y += 6) g.fillRect(0, y, TW, 1);
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 3; c++) g.fillRect((c * 12 + (r % 2) * 6) % TW, 114 + r * 6, 1, 6);
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, 114, TW, 1);  // the string course
      dither(g, TW, 138, 40);
    }), 'detail');
    put(new THREE.Mesh(
      new THREE.BoxGeometry(PW_X1 - PW_X0, PW_H, PW_D), flat(partyT)),
      (PW_X0 + PW_X1) / 2, PW_H / 2, (PW_Z0 + PW_Z1) / 2);
    // UNCHANGED, to the centimetre: this was already x 56.50…57.00,
    // z −114.50…−110.00 (it was written as `PW_Z1 + 0.05` off the short mesh).
    // The 2 m lane is untouched — nothing here has ever crossed the building
    // line, and the wall now simply fills the box it always collided as.
    obstacle({ minX: PW_X0, maxX: PW_X1, minZ: PW_Z0, maxZ: PW_Z1 });
  }

  // ══ THE NAME, READABLE — a high-density applied frieze ═════════════════════
  //
  // *"the sign is too blurry. make things readable"* (2026-08-09). The band
  // texture the facade is painted at is 16 px/m (WALL_PPM 8 x SHOP_MULT 2), so
  // the 0.4 m incised letters were six texels tall — mush at any distance.
  // The world's answer to a surface that must be READ is an applied one at
  // its own density (the shop boards are 150 px/m): this plane sits exactly
  // over the painted frieze, 64 px/m, and keeps the incised-stone look —
  // carved is fine, mushy isn't.
  {
    // …and it is 81% of the frontage, not 8.9 m. It was written against an 11 m
    // front; the college has 23.2 now, and a plate sized for the old building
    // would sit as a stripe in the middle of the new one while the PAINTED
    // frieze underneath it — which `ct/tex-world.ts` lays out off `wMeters` —
    // ran the full width behind it.
    const FR_W = X1 * 0.809, FR_H = 0.86;
    const frT = declareSurface(pixTex(Math.round(FR_W * 64), Math.round(FR_H * 64), (g) => {
      const W = Math.round(FR_W * 64), H = Math.round(FR_H * 64);
      g.fillStyle = '#d3c9ae'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#b0a68b';
      g.fillRect(0, 4, W, 3); g.fillRect(0, H - 7, W, 3);            // the stone rails
      g.font = 'bold 30px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(250,244,225,0.55)';                        // the lit cut edge
      g.fillText('CROSSTOWN COMMUNITY COLLEGE', W / 2 + 1, H / 2 + 3);
      g.fillStyle = '#5a4f3c';                                       // the incision
      g.fillText('CROSSTOWN COMMUNITY COLLEGE', W / 2, H / 2 + 1);
      dither(g, W, H, 30);
    }), 'sign');
    put(new THREE.Mesh(new THREE.PlaneGeometry(FR_W, FR_H), flat(frT)),
      CX, 3.64, FACE_Z + 0.035);          // over the painted frieze, proud of the band
  }

  // ══ THE FRONT ITSELF — the civic order, BUILT rather than painted ══════════
  //
  // *"make the cc facade a bit nicer"* (2026-08-11, straight on from the path,
  // at night). What that shot shows is a flat brick wall with two holes and a
  // door in it, and nothing about it says civic building.
  //
  // THE PAINTING IS NOT WHAT IS MISSING. `collegeFront` (ct/tex-world.ts)
  // already draws a stone frieze, a pilastered doorcase, four sash windows, a
  // fanlight and a plinth, and `shopfrontRelief` already stands FIVE real
  // mouldings off this wall — cornice, bed mould, opening head, cill, plinth.
  // Two things flatten all of it:
  //
  //   · every one of those mouldings is tinted from the ROSTER COLOUR
  //     (`joineryOf`, × 0.72 / × 0.55 / × 0.45), and this building's roster
  //     colour is maroon. Dark trim on dark brick is invisible; a civic
  //     building's mouldings are the one thing on it that are PALE.
  //   · a painted `proud()` is a lit arris and a cast shadow — texels, drawn
  //     as if lit from the front. After dark the whole band grades to one
  //     tone and every moulding in it goes with it. That is the "very dark
  //     facade" in the photograph, and no repaint fixes it, because the
  //     brightness is exactly what nightfall takes away.
  //
  // So the order is BUILT. Stone standing off the wall keeps its silhouette at
  // any hour, because an edge you can see round is not a texel — the same
  // argument that took the NAME off the 16 px/m canvas and onto a plane above.
  // Everything below hangs on the facade plane inside this module's own frame
  // and is sized off `frontageOf`, so it follows the college if it moves again.
  //
  // AND IT IS LAID OVER THE EXISTING RELIEF, never through it. Measured off
  // `shopfrontRelief`: cornice y 4.10…4.20 (0.20 proud), bed mould 3.11…3.18
  // (0.13), opening head 2.775…2.905 (0.12), cill 0.325…0.415 (0.11), plinth
  // 0…0.12 (0.09). Every piece here either sits in the clear between two of
  // those or lands squarely ON one and turns it into the dark member of a
  // proper moulding — a pale corona over a dark bed is a cornice, which is
  // what that pairing has always been.
  {
    // The band's own datum: `collegeFront` paints in metres DOWN from
    // SHOP_BAND_H, and the band's foot is world y 0 (the road), so a height in
    // the painter's terms is `SHOP_BAND_H - thatDepth` here. The three numbers
    // below are `BANDS.college`'s and are TYPED, because BANDS is private to
    // ct/tex-world.ts and this module may not edit that file to export it.
    // They move together with the painter or the stone lands off the paint.
    const BT = SHOP_BAND_H;                    // 4.2 — the top of the band
    const OG = 0.18;                           // BANDS.college's opening gap
    const SILL_M = 0.65;                       // collegeFront's `winB = H - m(0.65)`
    const RUN_A = 0.62, WIN_W = 1.40, CASE_M = 0.10;   // its window run
    const PIL = 0.34;                          // its painted pilaster width

    const F = frontageOf('COMMUNITY COLLEGE', X1);
    const DW = F.doorWidthM;                   // 1.2 — one number, painted and walked
    const dL = CX - DW / 2, dR = CX + DW / 2;
    const CASE_L = dL - PIL, CASE_R = dR + PIL;
    const HEAD_Y = F.fasciaBottomM - OG;       // 3.00 — the head of every opening
    const GLZ_TOP = F.glazingTopM;             // 2.78 — the window heads
    // The blank field between the doorcase and the nearest window is exactly
    // one `gap` of collegeFront's own window run, and it is the dead middle of
    // the photograph: 2.4 m of brick, floor to frieze, either side of the door.
    const BAY = ((CASE_L - CASE_M) - RUN_A - 2 * WIN_W) / 3;
    const BAY_CX = (CASE_L - CASE_M) - BAY / 2;          // west; east mirrors it
    // The run the stone may occupy. It stops at the party wall's INNER face for
    // the same reason the low wall and the beds do — that is where this college
    // actually ends; the last 0.5 m of frontage is behind its own masonry.
    const RUN_LO = X0, RUN_HI = PW_X0;

    const CAST = new THREE.MeshBasicMaterial({ color: 0xd3c9ae });   // COLLEGE_STONE
    const CAST_D = new THREE.MeshBasicMaterial({ color: 0xb0a68b });
    const CAST_L = new THREE.MeshBasicMaterial({ color: 0xe8dfc6 });
    const GRANITE = new THREE.MeshBasicMaterial({ color: 0x8a8d88 });
    const IRON = new THREE.MeshBasicMaterial({ color: 0x2e2a24 });
    // Flat materials mean a box is a SILHOUETTE — six faces, one colour, no
    // shading to say which of them is on top. So the relief is carried the way
    // `proud()` carries it in paint: a pale arris along the top face and a dark
    // line tucked under the projection. Three boxes, and it reads as stone.
    const course = (x0: number, x1: number, y0: number, y1: number, d: number,
                    face: THREE.Material = CAST) => {
      const w = x1 - x0, cx = (x0 + x1) / 2;
      if (w <= 0.02) return;
      put(new THREE.Mesh(new THREE.BoxGeometry(w, y1 - y0, d), face),
        cx, (y0 + y1) / 2, FACE_Z + 0.01 + d / 2);
      put(new THREE.Mesh(new THREE.BoxGeometry(w, 0.035, d + 0.012), CAST_L),
        cx, y1 - 0.017, FACE_Z + 0.01 + (d + 0.012) / 2);            // the arris
      put(new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d * 0.6),
        new THREE.MeshBasicMaterial({ color: 0x2a1e18 })),
        cx, y0 - 0.025, FACE_Z + 0.01 + d * 0.3);                    // its shadow
    };

    // ── 1. THE CORONA, over the frieze ──────────────────────────────────────
    // The wall had no TOP: above the frieze the brick simply carries on into
    // shadow, which is what makes it read as a slab rather than a building.
    // `shopfrontRelief`'s cornice is already there at 4.10…4.20 in dark maroon;
    // this is the pale member that turns it into a cornice instead of a stripe,
    // and being the deepest thing on the wall it is also what finally throws
    // the frieze into relief. 4.2 m up — nothing can reach it.
    course(RUN_LO, RUN_HI, BT, BT + 0.24, 0.32);

    // ── 2. THE SILL COURSE, run right across the front ──────────────────────
    // The wall had no BOTTOM and no horizontal: four windows floating in brick
    // with 2.4 m of nothing between them and the door. A continuous stone band
    // at the sill line is the cheapest thing in architecture that fixes both —
    // it ties the openings into one storey and gives the eye a base line.
    //
    // AT THE SILLS, and not lower, because lower is not seen: the planting beds
    // stand 0.60 m off this wall and 0.45 m tall along everything but the
    // centre bay, so a plinth course would be built entirely behind them. This
    // lands at 0.53…0.69, clear above the soil, and it swallows collegeFront's
    // PAINTED sills at exactly the same height rather than fighting them.
    // It BREAKS at the doorcase, which stands on its own.
    for (const [a, b] of [[RUN_LO, CASE_L - 0.13], [CASE_R + 0.13, RUN_HI]] as const) {
      course(a, b, SILL_M - 0.12, SILL_M + 0.04, 0.16);
      // Capped at the course's top face, the way the low wall and the beds are
      // — a 0.69 m ledge is something you step onto, not a wall to the sky. It
      // is 0.17 m of projection off masonry that is ALREADY solid, so it takes
      // nothing off the yard: the door's own stand point is 0.75 m out
      // (ct/int-college.ts) and stays 0.58 m clear of it.
      obstacle({ minX: a, maxX: b, minZ: FACE_Z, maxZ: FACE_Z + 0.18, maxY: SILL_M + 0.04 });
    }

    // ── 3. THE DOORCASE, in stone ───────────────────────────────────────────
    // The entrance was a hole with a thin painted surround, and an entrance is
    // the whole argument of a civic front: it is the one place a college spends
    // money. Two pilasters on granite bases, carrying a projecting hood.
    //
    // NO COLLIDER ON ANY OF IT, deliberately. Each piece stands at most 0.30 m
    // proud of a wall that is already solid, so the only thing a box here could
    // do is stand two solids either side of a 1.2 m opening — which is the
    // exact shape that produced *"i cant walk into the community college"*
    // (2026-08-09). Clipping 0.16 m into a pilaster is a cheap fault; a door
    // you cannot thread is not.
    for (const s of [-1, 1] as const) {
      const px = CX + s * (DW / 2 + PIL / 2);
      course(px - PIL / 2, px + PIL / 2, KERB_H, HEAD_Y, 0.16);
      // the granite base each stands on — a plinth for the one part of this
      // wall that the beds do not hide
      course(px - PIL / 2 - 0.05, px + PIL / 2 + 0.05, KERB_H, KERB_H + 0.44, 0.21, GRANITE);
    }
    // the hood: clear above `shopfrontRelief`'s opening head (2.905) and clear
    // below the frieze plane's own bottom edge (3.21), which is the 0.30 m of
    // wall this is allowed to occupy
    course(CASE_L - 0.15, CASE_R + 0.15, HEAD_Y - 0.06, HEAD_Y + 0.14, 0.30);

    // ── 4. THE LANTERNS — AND THIS ONE IS A LOOK DECISION ───────────────────
    //
    // *A CIVIC BUILDING'S ENTRANCE BEING LIT IS A DIFFERENT QUESTION FROM ITS
    // SIGN BEING LIT.* `380a05fc` made every fascia declare `lit` or `printed`
    // and left the college PRINTED on purpose, and that stays true — the name
    // over this door does not burn, and a community college does not floodlight
    // its own signboard. What this adds is two bulkhead lanterns beside the
    // door, which is not signage: it is the light you leave on because there is
    // a class in the building until nine.
    //
    // The file already SAID it wanted this — the gate piers carry lamps under a
    // comment calling them "the two lamps that make it an evening school from
    // the street" — and they have never lit. `props.ts` grades a plain
    // MeshBasicMaterial by its elevation like any other masonry unless it can
    // read a hot TEXTURE off it, and a 0.15 m box of flat colour has no map at
    // all, so `isSelfLit` returns false and the lamp goes out with the wall
    // behind it. `userData.lightSource` is the hand declaration for exactly
    // that case ("this really is lit, hold me"), and props.ts then treats a
    // small self-lit mesh as a FITTING: held at FLOOR_SIGN, and casting a 2.6 m
    // doorway pool rather than a 7 m street lamp's. Four warm pools inside the
    // court, none of them on the pavement, which is the lighting the block has
    // asked four times to keep dark.
    //
    // ERICK MAY WANT TO RULE ON IT. It is two lines (`lightSource` here and on
    // the pier lamp below) and reverting them puts the yard back in the dark
    // with the geometry unchanged.
    for (const s of [-1, 1] as const) {
      const px = CX + s * (DW / 2 + PIL / 2);
      const LY = 2.28;
      // ONE MATERIAL PER LANTERN, and props.ts's own reason: its lamp census
      // is `LAMP_SEEN`, keyed by MATERIAL, so two lanterns sharing one instance
      // are one light and the second door is dark. (`shopfrontRelief` keeps
      // separate instances for the same class of reason, one line up from the
      // grader that reads them.)
      const LAMP_GLASS = new THREE.MeshBasicMaterial({ color: 0xf2c86a });
      LAMP_GLASS.userData.lightSource = true;
      put(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.20), IRON),
        px, LY + 0.30, FACE_Z + 0.22);                               // the bracket arm
      put(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.24), IRON),
        px, LY + 0.27, FACE_Z + 0.32);                               // the lantern's cap
      put(new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.26, 0.20), IRON),
        px, LY + 0.11, FACE_Z + 0.32);                               // its frame
      put(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.21, 0.15), LAMP_GLASS),
        px, LY + 0.11, FACE_Z + 0.32);                               // the glass
    }

    // ── 5. THE DEDICATION TABLET, and a banner on the other dead bay ────────
    //
    // 2.4 m of blank brick either side of the doorcase, floor to frieze, is the
    // middle third of the photograph and the reason the front reads as a wall
    // with holes in it. Better-rhythmed fenestration is the textbook answer and
    // it is a `collegeFront` change, which this module may not make today; what
    // a real 1971 municipal college puts on that brick is a cornerstone and a
    // banner, and both are cheap and both are in-frame.
    //
    // Everything here is above the sill course and below the opening heads, and
    // nothing is more than 0.16 m proud, so no collider: the tablet's bottom
    // edge is 0.80 m up with a planting bed standing 0.60 m in front of it, and
    // the banner's is 0.98 m up on the wall (GLZ_TOP − 0.95 − 0.85; an earlier
    // note here claimed 1.45, and that half-metre is what hid the tablet).
    const tabT = declareSurface(pixTex(176, 74, (g) => {
      g.fillStyle = '#d3c9ae'; g.fillRect(0, 0, 176, 74);
      g.fillStyle = '#b0a68b'; g.fillRect(0, 0, 176, 3); g.fillRect(0, 71, 176, 3);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const [t, y, f] of [['ERECTED A.D. 1971', 27, 'bold 15px monospace'],
                               ['CITY OF CROSSTOWN', 51, '12px monospace']] as const) {
        g.font = f;
        g.fillStyle = 'rgba(252,246,228,0.60)'; g.fillText(t, 88, y + 1);   // the cut edge
        g.fillStyle = '#5a4f3c'; g.fillText(t, 88, y);                      // the incision
      }
      dither(g, 176, 74, 20);
    }), 'sign');
    {
      // one tablet, not two — a cornerstone is asymmetric everywhere it exists,
      // and the west bay is the one the path arrives past
      const tab = new THREE.Mesh(new THREE.PlaneGeometry(1.10, 0.46), flat(tabT));
      put(new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.54, 0.07), CAST_D),
        BAY_CX, 1.03, FACE_Z + 0.045);                               // its surround
      put(tab, BAY_CX, 1.03, FACE_Z + 0.09);
    }
    const banT = declareSurface(pixTex(128, 272, (g) => {
      g.fillStyle = '#6a2430'; g.fillRect(0, 0, 128, 272);
      g.strokeStyle = '#d3c9ae'; g.lineWidth = 3; g.strokeRect(7, 7, 114, 258);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#efe8d4';
      g.font = 'bold 15px monospace'; g.fillText('CROSSTOWN', 64, 32);
      g.fillRect(22, 45, 84, 2);
      g.font = 'bold 17px monospace';
      g.fillText('COMMUNITY', 64, 66); g.fillText('COLLEGE', 64, 88);
      // the seal: a ring with the college's initials, the way a pennant carries
      // a crest — legible as a MARK at 1.7 m of banner, which is all it has to be
      g.strokeStyle = '#d8b86a'; g.lineWidth = 4;
      g.beginPath(); g.arc(64, 160, 38, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 2;
      g.beginPath(); g.arc(64, 160, 30, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#d8b86a'; g.font = 'bold 24px monospace'; g.fillText('CCC', 64, 161);
      g.fillStyle = '#efe8d4'; g.fillRect(22, 218, 84, 2);
      g.font = '13px monospace'; g.fillStyle = '#d8b86a';
      g.fillText('EST. 1971', 64, 238);
      dither(g, 128, 272, 34);
    }), 'sign');
    // ONE BANNER, ON THE EAST BAY — there were two, and the west one hung at
    // BAY_CX, the tablet's own centre: its lower half (bottom edge 0.98, see
    // above) draped straight over the tablet's face (y 0.76…1.30, 5 cm behind
    // it), which is the dead centre of *"the facade is quite crowded …
    // many overlapping textures"* (2026-08-15). Two banners also put the
    // college's name on this wall four times in one view, counting the frieze
    // and the yard plate. So the bays get one thing each — tablet west, banner
    // east — which is this module's own one-off rule from the top of the file:
    // the name stub and the notice board, balanced one each side.
    {
      const bx = CX + (CX - BAY_CX);            // the west bay's centre, mirrored east
      put(new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.05, 0.05), IRON),
        bx, GLZ_TOP - 0.08, FACE_Z + 0.13);                          // the hanging rod
      put(new THREE.Mesh(new THREE.PlaneGeometry(0.80, 1.70), flat(banT)),
        bx, GLZ_TOP - 0.95, FACE_Z + 0.14);
    }
  }

  // ── two benches facing each other across the path ─────────────────────────
  // Timber slats on dark cast ends, the park's bench idiom at yard scale.
  // Their backs are to the trees; you sit under a canopy and face the axis.
  //
  // ── AND THEY READ AS TWO DARK WEDGES, which is how they got looked at ─────
  //
  // Not reported — spotted in the facade shot of 2026-08-11, where the pair in
  // the foreground are unidentifiable slabs flanking the path. Two faults, and
  // the file's own comment above is the witness for the second:
  //
  //   · THE SLATS WERE ALL IN ONE PLACE. Three boards were laid at `dy` 0,
  //     0.07, 0.14, which resolve to x offsets of ∓0.035, 0, ±0.035 and y
  //     offsets of ∓0.007, 0, ±0.007 — a 7 mm spread on a 0.40 m board, so the
  //     three overlapped into one solid 0.47 m slab with no gap between them
  //     anywhere. A bench is READ by its slats; without them it is a plank.
  //     They are laid across the seat now, three 0.115 m boards at 0.15 pitch,
  //     which leaves 0.035 m of daylight between each.
  //   · THE BACK WAS ON THE WRONG SIDE. "Their backs are to the trees; you sit
  //     under a canopy and face the axis" — the trees are OUTBOARD (x0+1.9 and
  //     x1-1.9) and the path is inboard, so the back belongs on the outer face.
  //     It was at `BX - s * 0.26`, i.e. between the seat and the path, tilting
  //     `s * 0.22` further over the path: you sat facing the party wall with a
  //     backrest leaning across the gate line. Both signs flip.
  //
  // Geometry only — the collider is unchanged and still capped at the seat
  // boards, and neither bench moved by a millimetre THEN. They did on
  // 2026-08-24: *"benches are clipping pls fix"* — at BZ −3.3 the slats ran to
  // z −4.11 and the far end support to −4.05, both inside the planting bed
  // (z −4.40…−3.90, brick to 0.32 high). BZ −3.0 leaves 9 cm of daylight
  // between slat end (−3.81) and bed, and the collider (BZ ± 0.85) follows.
  const slatM = new THREE.MeshBasicMaterial({ color: 0x8a6a42 });
  const endM = new THREE.MeshBasicMaterial({ color: 0x2e2a26 });
  for (const s of [-1, 1]) {
    const BX = CX + s * 1.95, BZ = WALK_Z - 3.0;
    for (const dz of [-0.7, 0.7])
      put(new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.10), endM), BX, KERB_H + 0.21, BZ + dz);
    for (const dx of [-0.15, 0, 0.15])
      put(new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.05, 1.62), slatM),
        BX + dx, KERB_H + 0.44, BZ);
    // the back, on the outer face, tilted away from the path
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 1.62), slatM);
    back.rotation.z = -s * 0.22;
    put(back, BX + s * 0.26, KERB_H + 0.70, BZ);
    // capped at the seat boards' top face — a bench is a jump-on, and standing
    // on it puts the tilted back beside your shins, not a wall over your head
    obstacle({ minX: BX - 0.36, maxX: BX + 0.36, minZ: BZ - 0.85, maxZ: BZ + 0.85, maxY: KERB_H + 0.47 });
  }
}
