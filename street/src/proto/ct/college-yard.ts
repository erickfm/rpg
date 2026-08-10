import * as THREE from 'three';
import { BUILD, type CtxBuild } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
import { frontageWorld } from './tex-world';

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
// an 11 x 4.5 m notch between the party walls of SMOKES and the corner block
// — two real brick flanks the street already painted, which is exactly what a
// small campus court sits between. This module builds everything IN the notch:
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

// The frontage: SOUTH2 runs -7 +18 +12 +12 +11 = 46, and the college is the
// 11 m to the run's end at 57 (`ct/street.ts`, the roster the widths of which
// are load-bearing). Typed here, checked against the registry at build time.
const X0 = 46, X1 = 57;
const CX = (X0 + X1) / 2;                    // 51.5 — the axis
const WALK_Z = -110;                         // the street's building line
const FACE_Z = WALK_Z - COLLEGE_YARD_D;      // the recessed facade plane
/** The recessed facade plane, exported for ONE consumer: `crosstown.ts`
 *  derives the world's south walk bound from it (`WORLD_BOUNDS.minZ`), so a
 *  future deeper recess moves the clamp with it instead of re-shipping
 *  *"i cant walk into the community college"* (2026-08-09). */
export const COLLEGE_FACE_Z = FACE_Z;

export const ORDER = BUILD.PROPS;

export function register(ctx: CtxBuild): void {
  // The registry is the check that street.ts actually recessed the shell —
  // if the roster loses the college, build no courtyard to nowhere.
  const FW = frontageWorld('COMMUNITY COLLEGE');
  if (!FW) {
    console.warn('[college-yard] no COMMUNITY COLLEGE frontage registered — building nothing.');
    return;
  }
  const { scene, flat, obstacle, KERB_H } = ctx;
  const put = (m: THREE.Object3D, x: number, y: number, z: number) => {
    m.position.set(x, y, z); scene.add(m); return m;
  };

  // ── the ground: the yard is pavement-height, and the world must know ──────
  // The base walk stops at the building line; without this the notch answers
  // road height and the player steps 12 cm DOWN through the paving.
  ctx.ground((x, z) =>
    x >= X0 && x <= X1 && z <= WALK_Z && z >= FACE_Z ? KERB_H : null);

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
  for (const [a, b] of [[X0 + 0.05, CX - 1.50], [CX + 1.50, X1 - 0.05]] as const) {
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
    put(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.17, 0.15),
      new THREE.MeshBasicMaterial({ color: 0xf2c86a })), px, KERB_H + 1.755, WALL_Z);
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
  for (const [a, b] of [[X0 + 0.3, CX - 1.3], [CX + 1.3, X1 - 0.3]] as const) {
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
  // that stretch. The west side really is sealed (SMOKES' box runs 14 m deep
  // past the yard); this wall is the east side's missing four metres, built
  // in the corner block's own family — granite ashlar base, sooted brick
  // above — to the college shell's full 17.2 m, so the yard reads as a notch
  // carved between solid buildings.
  //
  // Its east face stops at x 56.98, 0.02 shy of the x = 57 plane the jail
  // publishes its frontage on — the exact coplanar z-fight that got the old
  // cross building demolished (GOTCHAS §6).
  {
    const PW_X0 = 56.50, PW_X1 = 56.98;
    const PW_Z0 = -114.5, PW_Z1 = WALK_Z - 0.05;
    const PW_H = 17.2;                    // gh 4.2 + 3.4 + 4 floors x 2.4
    const partyT = declareSurface(pixTex(34, 138, (g) => {
      // 4.15 x 17.2 m at 8 px/m — masonry wants courses, not letters
      g.fillStyle = '#6b4034'; g.fillRect(0, 0, 34, 138);            // the brick field
      g.fillStyle = 'rgba(30,22,16,0.35)';
      for (let y = 0; y < 138; y += 4) g.fillRect(0, y, 34, 1);      // the courses
      g.fillStyle = 'rgba(0,0,0,0.22)';                              // the soot, heavier up top
      for (let i = 0; i < 30; i++) g.fillRect((i * 11) % 34, (i * 17) % 90, 3, 2);
      // the granite ashlar base, 3.0 m of it — the corner block's own move
      g.fillStyle = '#8a8d88'; g.fillRect(0, 114, 34, 24);
      g.fillStyle = 'rgba(40,42,40,0.45)';
      for (let y = 114; y < 138; y += 6) g.fillRect(0, y, 34, 1);
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 3; c++) g.fillRect((c * 12 + (r % 2) * 6) % 34, 114 + r * 6, 1, 6);
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, 114, 34, 1);  // the string course
      dither(g, 34, 138, 40);
    }), 'detail');
    put(new THREE.Mesh(
      new THREE.BoxGeometry(PW_X1 - PW_X0, PW_H, PW_Z1 - PW_Z0), flat(partyT)),
      (PW_X0 + PW_X1) / 2, PW_H / 2, (PW_Z0 + PW_Z1) / 2);
    obstacle({ minX: PW_X0, maxX: 57.0, minZ: PW_Z0, maxZ: PW_Z1 + 0.05 });
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
    const FR_W = 8.9, FR_H = 0.86;
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

  // ── two benches facing each other across the path ─────────────────────────
  // Timber slats on dark cast ends, the park's bench idiom at yard scale.
  // Their backs are to the trees; you sit under a canopy and face the axis.
  const slatM = new THREE.MeshBasicMaterial({ color: 0x8a6a42 });
  const endM = new THREE.MeshBasicMaterial({ color: 0x2e2a26 });
  for (const s of [-1, 1]) {
    const BX = CX + s * 1.95, BZ = WALK_Z - 3.3;
    for (const dz of [-0.7, 0.7])
      put(new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.10), endM), BX, KERB_H + 0.21, BZ + dz);
    for (const dy of [0, 0.07, 0.14])
      put(new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.045, 1.62), slatM),
        BX + (dy - 0.07) * -s * 0.5, KERB_H + 0.44 + (dy - 0.07) * 0.1, BZ);
    // the back, tilted away from the path
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 1.62), slatM);
    back.rotation.z = s * 0.22;
    put(back, BX - s * 0.26, KERB_H + 0.70, BZ);
    // capped at the seat boards' top face — a bench is a jump-on, and standing
    // on it puts the tilted back beside your shins, not a wall over your head
    obstacle({ minX: BX - 0.36, maxX: BX + 0.36, minZ: BZ - 0.85, maxZ: BZ + 0.85, maxY: KERB_H + 0.47 });
  }
}
