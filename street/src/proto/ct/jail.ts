import * as THREE from 'three';
import { BUILD, type CtxBuild } from './ctx';
import { pixTex, declareSurface, dither, slabTex } from './paint';
import { masonry, WALK_PROJECTION } from './tex-world';
import { plazaTex, walkTex } from './tex-ground';

// ── CITY OF CROSSTOWN · HOUSE OF DETENTION ────────────────────────────────
//
// *"also we need a jail. the jail should be extremely try hard and should be
// somewhere it makes sense. probably over by the casino tbh lol"*
//
// This file is the OUTSIDE. The room is `ct/int-jail.ts` — the same split G
// holds between `ct/vice.ts` and `ct/int-casino.ts`, and it is not a
// preference: `ct/doors.ts` collects door declarations from a glob of
// `./int-*.ts` and nothing else, and `scripts/world-wired.mjs` fails outright
// on a room id with no matching `int-<id>.ts`.
//
// ── WHERE IT STANDS, and why it costs the block nothing ──────────────────
//
// The closed east end of the side street. Approved by the desk 2026-07-26 on
// the reasoning in `notes/O-jail-site.md`: the two side-street roster runs
// both stop dead on x = 57 —
//
//     NORTH2   16.45 + 6 + 11 + 12 + 11.55        = 57.0   (SEVENS ends here)
//     SOUTH2   -7 + 9.5 + 8.5 + 12 + 12 + 11 + 11 = 57.0   (LOANS ends here)
//
// — and the east cap is on NEITHER cursor. So this building is placed directly,
// outside both roster walks, and nothing before it or after it moves. That is
// the whole of why it could be sited here at all: `ct/street.ts:249` says those
// widths are load-bearing, and one of the totals is why the bodega lands on its
// corner.
//
// It also answers a dead end this project has failed to justify twice. The desk
// ruled in H's queue that the east end was *"a closed end of a minor side
// street, not a frontage; there is nothing there to walk to"*, and declined to
// add pavement to justify a graph node; B painted a crossing instead; the user
// has since asked for that crossing removed and the ring closed another way.
// A municipal building is a thing to walk to.
//
// ── the section, in world coordinates ────────────────────────────────────
//
//        x = 55        x = 57                            x = 69
//         kerb          facade                             back
//          │              │                                  │
//          │◄── 2.0 m ───►│                                  │
//          │   pavement   │        the House of Detention    │
//                         │                                  │
//   z = -96  ── SEVENS ends here, the jail's north flank abuts its east face
//   z = -110 ── LOANS  ends here, the south flank abuts its east face
//   z = -103 ── the side street's centre line, and the door is dead on it:
//               you walk 60 m down the middle of the street toward this door.

/** ORDER: the SITE band, which is where a building belongs — and, being a
 *  NEW module, every `rnd()` draw it makes lands after every existing one in
 *  its band (ties break on filename, and `jail.ts` sorts last among them). So
 *  no tree height and no pigeon in the world moves. GOTCHAS §2. */
export const ORDER = BUILD.SITE;

/**
 * THE SITE, published as one object so that the room, the door and the
 * collider are all derived from it rather than each hand-typing a coordinate.
 *
 * GOTCHAS §20 counts six failures of the other way round in this project — a
 * stale diner z, a hand-typed room offset, a hand-typed DZ — and the desk's
 * ruling was explicit that I should not retype a number out of D's file.
 * `ct/int-jail.ts` imports this; nothing in the room repeats a number.
 */
export const JAIL = {
  /** the SITE's own front edge. Both roster runs end on it, and it is what
   *  gets checked against `ctx.site('jail').minX` at build time — NOT the
   *  building's own face any more (see `FORE` below). */
  SITE_X: 57.0,
  /**
   * THE WALKABILITY FIX (`notes/O-jail-site-walkable.md`). The building used
   * to start flush on `SITE_X` and run the full offered depth, so the
   * building's solid mass and the site's own bounds were nearly the same
   * rectangle — `ctx.obstacle` covered x 56.88…69 of a published site
   * 57…75, and `scripts/bugsweep.mjs`'s site stations (computed as fixed
   * fractions of the site's own bounding box, the same shape it uses for the
   * genuinely-open park and lot) landed INSIDE the building at 18% and 50%
   * along it. `fp.ts`'s `unstick()` could not always find a way out of a
   * deep interior point within its 0.45 s patience and reverted the whole
   * move — measured landing the player back at the used car lot, 113 m away.
   *
   * FORE sets the building back from the site's edge into a real walkable
   * forecourt, so the site is no longer "almost entirely building": a paved
   * plaza in front, a solid civic block, and — because DEPTH below no longer
   * eats the whole 18 m offered — a real fenced yard behind it. Measured
   * empirically against the sweep's own three sample points (18%, 50%, 82%
   * along the site's long axis) with the full world's other 522 colliders in
   * play, not just calculated: FORE 4.0 / DEPTH 4.0 leaves both the 18% and
   * 50% points on open ground with 0.28–1.76 m of clearance, no push
   * required at all — see the worked table in the handoff note.
   */
  FORE: 4.0,
  /** the frontage, which is exactly the side street's own section: 2 m north
   *  walk + 10 m carriageway + 2 m south walk */
  Z_S: -110.0, Z_N: -96.0,
  /** how far back the BUILDING runs, from its own face (SITE_X + FORE), not
   *  from the site's edge. Shortened from the original 12.0 as part of the
   *  walkability fix above — the interior room is a wholly separate
   *  coordinate space (`ct/int-jail.ts`, x > 400) sized on its own terms, so
   *  a shallower exterior shell costs the room nothing. What used to be
   *  wasted, unreachable depth behind the building (12…75 was offered to 18,
   *  built to 12) is now a real yard: SITE_X+FORE+DEPTH (65) to the site's
   *  own back edge (75) — 10 m, not 6, and reachable because nothing pinches
   *  the walk down to zero width to get there any more. */
  DEPTH: 4.0,
  /** heights, from the street surface up */
  BASE_H: 4.6,          // the stone ground floor, and the sally port is in it
  UPPER_H: 6.6,         // two brick floors of 3.3
  CORNICE_H: 0.6,
  PARAPET_H: 1.8,
  /** the clear door opening */
  DOOR_W: 2.4, DOOR_H: 3.06,
  /**
   * How far the sally port is recessed BEHIND the facade plane.
   *
   * The depth goes IN, and that is only possible because D deleted the filler
   * box that used to fill x 57…63. It matters which way round it goes: the
   * pavement here is 2.00 m kerb to facade, and the whole reason this site was
   * approved is that it WIDENS the walk. A recess is free of that budget and a
   * projection is not, so every centimetre of depth here is one the player
   * still gets to walk on.
   *
   * (For one pass this was `PORTAL_PROUD: 0.28`, a projecting aedicule, built
   * while the filler box was still standing — a recess into it rendered as 12 m
   * of somebody else's brown brick, which is in `shots/O-jail-day-atdoor.png`
   * from before D's deletion landed. That was the right call for that hour and
   * it is the wrong one now.)
   */
  RECESS: 0.55,
} as const;

/** the building's own facade plane — `SITE_X + FORE`, i.e. set back from the
 *  site's front edge into the forecourt. Exported separately from `JAIL`
 *  because `int-jail.ts` and `JAIL_DOOR` both need the BUILDING's face, not
 *  the site's, and typing `JAIL.SITE_X + JAIL.FORE` at every call site is
 *  exactly the two-authorings fault `JAIL_DOOR` itself exists to avoid. */
export const JAIL_FACE_X = JAIL.SITE_X + JAIL.FORE;

/** the door, as a world POINT and an OUTWARD NORMAL — the general form
 *  `ct/doors.ts` takes, which is what `ct/int-casino.ts` uses for the same
 *  reason: this building fronts no roster axis, so "signed metres along the
 *  frontage" cannot describe it. The room declares this; the facade below
 *  builds its opening from the same object. */
export const JAIL_DOOR = {
  x: JAIL_FACE_X, z: (JAIL.Z_S + JAIL.Z_N) / 2, nx: -1, nz: 0,
} as const;

/** total height to the top of the parapet */
const TOP = JAIL.BASE_H + JAIL.UPPER_H + JAIL.CORNICE_H + JAIL.PARAPET_H;   // 13.6

// The parapet reaching 13.6 was chosen while `ct/street.ts`'s 13.6 m filler box
// was still standing behind this building, so that no strip of its brown brick
// showed over the top. **D has deleted that box and the number stays**, because
// it is right on its own merits: a civic building closing a street should stand
// over its neighbours, and SEVENS and LOANS are both 13.0.

// ── the palette ───────────────────────────────────────────────────────────
//
// Grey-green granite over dark engineering brick. Not black: a black building
// at the end of a foggy street reads as a hole. This is the colour of a
// building nobody has cleaned since it went up.
//
// THE STONE WAS `#6e6f68` FOR ONE PASS AND IT WAS WRONG — measured against its
// own screenshot rather than argued: at 1.8 m the base read as near-white
// cinder block, a full value step lighter than every other ground floor on the
// street, and it made the building look like a warehouse rather than the one
// building on the block you do not want to enter. Darkened, and the per-block
// drift widened at the same time, because a pale field shows a flat tone and a
// dark one hides it.
const STONE = '#585a53';
const BRICK = '#4a3a34';
const STEEL = 0x3a3c40;
const STEEL_DK = 0x26282c;

export function register(ctx: CtxBuild): void {
  const { scene, flat } = ctx;

  // ── where, ASKED FOR rather than assumed ────────────────────────────────
  //
  // `ctx.site('jail')` is D's, and D has published it: the frontage at
  // `SIDE_X1 + 2`, the z band at the side street's own walks, 18 m of depth
  // offered *"deeper than the widest shell on the block… O may take less"*.
  // Not one of those numbers is typed here. Move the side street and this
  // building follows it, which is the whole point of asking — GOTCHAS §20
  // counts six failures of copying a coordinate out of somebody else's file.
  //
  // A module that asks for a site it was not given must build NOTHING and say
  // so (`ct/ctx.ts:201`). The constants in `JAIL` above stay as the
  // ASSERTION — what this building believes it was granted — and a
  // disagreement with the site is a loud console line rather than a silently
  // misplaced building.
  const site = ctx.site('jail');
  if (!site) {
    console.warn('[jail] no site published for "jail" — building nothing. '
      + 'ct/street.ts owns the block layout; ask the desk, do not hand-type it.');
    return;
  }
  if (Math.abs(site.minX - JAIL.SITE_X) > 0.01 || Math.abs(site.minZ - JAIL.Z_S) > 0.01
      || Math.abs(site.maxZ - JAIL.Z_N) > 0.01) {
    console.warn(`[jail] the published site has MOVED: x ${site.minX} z ${site.minZ}…${site.maxZ}, `
      + `against the approved x ${JAIL.SITE_X} z ${JAIL.Z_S}…${JAIL.Z_N}. Following the site.`);
  }
  // FX is the BUILDING's face, not the site's edge — set back by JAIL.FORE
  // into a walkable forecourt (see JAIL.FORE's own comment for why). Still
  // fully derived from the live site, never hand-typed: move the side street
  // and both the forecourt and the building follow it.
  const FX = site.minX + JAIL.FORE;
  const Z_S = site.minZ;
  const Z_N = site.maxZ;
  const W = Z_N - Z_S;                       // 14.0
  const CZ = (Z_S + Z_N) / 2;                // -103.0, the street's centre line
  const BX = FX + JAIL.DEPTH;                // the back of the building
  const DEP = BX - FX;
  const SX = site.minX;                      // the site's own front edge, for the forecourt below

  /** everything this module adds, stamped with its owner so an audit does not
   *  have to infer whose face it is looking at from geography — `ct/street.ts`
   *  measured 79% of cross-agent attribution being inference, and inference
   *  misrouted thirteen faults onto one module. Never overwrites. */
  const add = <T extends THREE.Object3D>(o: T): T => {
    o.traverse((n) => { if (!n.userData.mod) n.userData.mod = 'jail'; });
    scene.add(o);
    return o;
  };

  // ── STONE ──────────────────────────────────────────────────────────────
  //
  // *"A flat colour is not a material… A blank grey wall in a jail will read as
  // unfinished, not as institutional."* So the base is drawn as what it is:
  // rusticated ashlar, deep-jointed, every block chamfered so it catches the
  // light on its top and left arris and loses it on the bottom and right.
  //
  // Painted through `masonry()` rather than beside it, for the density
  // declaration and the whole-texel canvas rounding the desk ruled on — but
  // with its own coursing rather than `surf.courses`, because that lays a brick
  // bond and this is stone. The stamp says `brick`; what it actually asserts is
  // "this face is on the masonry grid at this density", which is true.
  // 8 courses in the 4.6 m base, not 6. The first pass drew 0.767 m courses of
  // 1.4 m blocks and at walking distance they read as breeze block — a civic
  // ashlar course is about the height of a step, and the eye counts them.
  const COURSE = 0.575;
  const BLOCK = 1.15;
  const stoneTex = (wM: number, hM: number, baseY: number) => {
    const s = masonry(wM, hM, baseY, 2);      // 16 px/m — you stand right at this
    return s.paint((g) => {
      g.fillStyle = STONE;
      g.fillRect(0, 0, s.W, s.H);
      const ch = Math.max(2, Math.round(COURSE * s.ppm));
      const bw = Math.max(3, Math.round(BLOCK * s.ppm));
      // Courses walk up from the WORLD grid, not from the canvas bottom, so the
      // bond continues across the two boxes this facade is built from instead
      // of restarting at each seam.
      const k0 = Math.ceil(baseY / COURSE);
      for (let k = k0; (k * COURSE - baseY) <= hM; k++) {
        const yW = k * COURSE - baseY;
        const y = Math.round(s.H - yW * s.ppm);
        // the recessed joint, and the two arrises either side of it
        g.fillStyle = 'rgba(0,0,0,0.40)'; g.fillRect(0, y, s.W, 2);
        g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(0, y + 2, s.W, 1);
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, y - 1, s.W, 1);
        // perpends, half-lapped course by course so it is a bond and not a grid
        const off = (k % 2) ? 0 : Math.round(bw / 2);
        for (let x = off; x < s.W; x += bw) {
          g.fillStyle = 'rgba(0,0,0,0.36)'; g.fillRect(x, y - ch + 2, 2, ch - 2);
          g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x + 2, y - ch + 2, 1, ch - 2);
        }
        // per-block tone drift: ashlar is quarried, so no two blocks match, and
        // this is the whole difference between stone and a painted panel
        for (let x = off; x < s.W; x += bw) {
          const v = Math.random();
          g.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.03 + v * 0.16})`
                                : `rgba(255,255,255,${(v - 0.5) * 0.10})`;
          g.fillRect(x + 2, y - ch + 3, bw - 3, ch - 4);
        }
      }
      // soot, heavier at the bottom where the traffic throws it up
      for (let i = 0; i < s.W * s.H * 0.10; i++) {
        const x = Math.random() * s.W, y = s.H - Math.pow(Math.random(), 1.7) * s.H;
        g.fillStyle = `rgba(24,22,20,${0.06 + Math.random() * 0.16})`;
        g.fillRect(x, y, 1, 1);
      }
      dither(g, s.W, s.H, Math.round(s.W * s.H * 0.02));
    });
  };

  // ── DRESSED STONE, for the trim — which is NOT ashlar ───────────────────
  //
  // Sills, jambs, the door head and the string course are each ONE dressed
  // stone. They were all wearing `surroundM = stoneTex(1.0, 1.0, 0)` — a single
  // 16x16 ashlar canvas reused on boxes from 0.08 m to 14 m — and that is the
  // long tail of queue item 6: the same "16 px/m" stamp came out at 1.14 px/m
  // on the 14 m string course and 200 px/m on an 0.08 m window sill, a 175x
  // spread of actual block size all claiming one density. Painting each at its
  // own size would not have helped either, because a 0.575 m ashlar course
  // cannot be drawn on an 0.08 m face at all.
  //
  // So it is drawn as what it is. A dressed stone has no coursing and no
  // perpends, only a face, a lit top arris and a shadowed underside — the line
  // the string course's own comment says it exists to throw. Declared
  // 'detail', NOT stamped as masonry, because it is not a run of brick and a
  // seam tool must not compare it to one. That is a change in what is drawn,
  // not a relabelling of what was there: the ashlar joints are gone from the
  // trim, which is why the sills read as one stone now.
  //
  // AND THE DECLARATION MUST NOT BE WHAT MAKES THIS PASS. Dropping the masonry
  // stamp takes trim out of the seam tool's like-for-like question, so on its
  // own that would be exactly the "loosen the check until it goes green" move
  // BUILDER-BRIEF §7 forbids. So the density is DERIVED from the wall the trim
  // sits against — the same `masonry(…, 2)` call `stoneTex` makes, so the trim
  // draws at the ashlar's own 16 px/m and cannot be a visible mismatch beside
  // it whatever it is labelled. Measured after: 15.71–16.36 px/m on the jambs,
  // the door head and the string course.
  //
  // The two window-sill sizes are the exception and the reason 'detail' is the
  // honest label rather than a convenience: a lit arris, a face and a shadowed
  // underside is three texels at minimum, and three texels over an 0.08 m sill
  // is 37 px/m however it is declared. A sill that thin cannot carry a course
  // and must not be compared to one.
  const DRESS_PPM = masonry(1, 1, 0, 2).ppm;
  const dressed = (wM: number, hM: number) => {
    const W = Math.max(3, Math.round(wM * DRESS_PPM));
    const H = Math.max(3, Math.round(hM * DRESS_PPM));
    // The arris is a PHYSICAL EDGE, so it is sized in metres and not as a
    // fraction of the piece: a fraction gave the 3.75 m portal jamb half a
    // metre of highlight down its top, which reads as a pale panel rather than
    // as a chamfered edge, while giving the 0.08 m sill the same one texel it
    // gets here anyway. One texel at the wall's own density is what a 20 mm
    // chamfer is worth at 16 px/m.
    const arris = Math.max(1, Math.round(0.04 * DRESS_PPM));
    return declareSurface(pixTex(W, H, (g) => {
      g.fillStyle = STONE; g.fillRect(0, 0, W, H);
      // quarried grain: the same per-block drift the ashlar has, without the
      // blocks, so trim and wall still read as one material
      for (let i = 0; i < W * H * 0.16; i++) {
        const x = Math.random() * W, y = Math.random() * H, v = Math.random();
        g.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.03 + v * 0.15})`
                              : `rgba(255,255,255,${(v - 0.5) * 0.10})`;
        g.fillRect(x, y, 1, 1);
      }
      g.fillStyle = 'rgba(255,255,255,0.09)'; g.fillRect(0, 0, W, arris);
      g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(0, H - arris, W, arris);
      // soot collects on a projecting band's top face and washes down its front
      for (let i = 0; i < W * H * 0.05; i++) {
        const x = Math.random() * W, y = H - Math.pow(Math.random(), 2.0) * H;
        g.fillStyle = `rgba(24,22,20,${0.05 + Math.random() * 0.14})`;
        g.fillRect(x, y, 1, 1);
      }
      dither(g, W, H, Math.round(W * H * 0.02));
    }), 'detail');
  };

  // ── BRICK, with the windows painted into it ────────────────────────────
  //
  // The openings are PAINTED and the bars are GEOMETRY. Both halves are needed
  // and they do different jobs: the paint is what reads at 40 m down the street
  // — which is where this building is seen from most — and the bars are what
  // reads from the pavement, where a painted bar would be the same mistake as
  // the flat waitress the atlas exists to prevent.
  const BAYS = 5;
  const bayZ = (i: number) => Z_S + W * (i + 0.5) / BAYS;   // world z of a bay centre
  /** windows: [sill, head] in metres above the street, per floor */
  const ROWS: [number, number][] = [[6.15, 7.60], [9.25, 10.70]];
  const WIN_W = 0.85;

  const upperTex = (wM: number, hM: number, baseY: number, front: boolean) => {
    const s = masonry(wM, hM, baseY, 2);
    return s.paint((g) => {
      g.fillStyle = BRICK;
      g.fillRect(0, 0, s.W, s.H);
      s.courses(g, 'rgba(198,188,170,0.13)');
      // vertical soot streaks under every opening, which is what actually says
      // "nobody has washed this" — flat grime reads as a tint
      for (let i = 0; i < s.W * s.H * 0.05; i++) {
        const x = Math.random() * s.W, y = Math.random() * s.H;
        g.fillStyle = `rgba(24,20,18,${0.04 + Math.random() * 0.10})`;
        g.fillRect(x, y, 1, 1);
      }
      if (!front) { dither(g, s.W, s.H, Math.round(s.W * s.H * 0.02)); return; }
      // ── the openings ──
      for (let i = 0; i < BAYS; i++) {
        const uM = bayZ(i) - Z_S;                 // metres along the facade's u
        for (const [sill, head] of ROWS) {
          const x0 = Math.round((uM - WIN_W / 2) * s.ppm);
          const wpx = Math.max(4, Math.round(WIN_W * s.ppm));
          const y0 = Math.round(s.H - (head - baseY) * s.ppm);
          const y1 = Math.round(s.H - (sill - baseY) * s.ppm);
          const hpx = y1 - y0;
          // the void. Not black — a hole in a wall in daylight is the colour of
          // the room behind it, and this room has a dead fluorescent in it.
          g.fillStyle = '#1b1d1e'; g.fillRect(x0, y0, wpx, hpx);
          // the reveal: light down one jamb and across the head, dark down the
          // other, which is the whole of how a painted opening gets depth
          g.fillStyle = 'rgba(0,0,0,0.45)';
          g.fillRect(x0, y0, 2, hpx); g.fillRect(x0, y0, wpx, 2);
          g.fillStyle = 'rgba(255,255,255,0.08)';
          g.fillRect(x0 + wpx - 1, y0, 1, hpx);
          // a segmental brick arch over it — one course, stepped
          g.fillStyle = 'rgba(0,0,0,0.22)';
          g.fillRect(x0 - 2, y0 - 3, wpx + 4, 3);
          g.fillStyle = 'rgba(255,255,255,0.07)';
          g.fillRect(x0 - 2, y0 - 3, wpx + 4, 1);
          // and the bars, painted as well as built — this is the read at 40 m
          g.fillStyle = 'rgba(20,22,24,0.85)';
          for (let b = 1; b <= 4; b++) {
            g.fillRect(x0 + Math.round(wpx * b / 5), y0 + 2, 1, hpx - 2);
          }
          g.fillRect(x0, y0 + Math.round(hpx / 2), wpx, 1);
        }
      }
      dither(g, s.W, s.H, Math.round(s.W * s.H * 0.02));
    });
  };

  const roofM = new THREE.MeshBasicMaterial({ color: 0x2b2d33 });
  /** a box with the FACADE on its −x face. BoxGeometry face order is
   *  [+x, −x, +y, −y, +z, −z], so index 1 is the face that looks down the
   *  street and 4/5 are the flanks. Getting that index wrong is how a facade
   *  ends up painted on the back of a building.
   *
   *  THE BACK IS NOT A FLANK. Index 0 used to be handed `flank` too, and that
   *  is the whole of queue item 6's 227 seam disagreements: on
   *  `BoxGeometry(depth, height, width)` the ±x faces are `width` metres
   *  across and the ±z faces are `depth`, so a flank texture painted for
   *  `depth` was being stretched over a face `width` wide. Measured on the
   *  upper shell that is a 4 m canvas over a 14 m face — 4.57 px/m against a
   *  declared 16, brick drawn three and a half times too big, on the wall the
   *  yard looks straight at.
   *
   *  `back` therefore defaults to `face`, DERIVED rather than chosen: both ±x
   *  faces span exactly `width × height`, and every `face` texture in this
   *  file is painted at exactly that size. Pass a `back` explicitly only when
   *  the front carries something the back must not — the upper storey's
   *  painted windows are the one case. */
  const shell = (
    depth: number, height: number, width: number,
    cx: number, cy: number, cz: number,
    face: THREE.Material, flank: THREE.Material,
    back: THREE.Material = face,
  ) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(depth, height, width),
      [back, face, roofM, roofM, flank, flank]);
    m.position.set(cx, cy, cz);
    return add(m);
  };

  // ── the ground floor: two piers, a lintel, and the port between them ────
  //
  // Built as four boxes rather than one, so the sally port is a REAL opening
  // with REAL jambs and a REAL soffit. GOTCHAS §12 is about openings cut in
  // paper with zero visible depth — *"if you add an opening, give it a jamb"* —
  // and the jambs here are the piers' own inner faces, the soffit is the
  // lintel's underside, and the back of the recess is a fourth box so the
  // doorway is a doorway and not a 12 m tunnel into the building.
  const D_HW = JAIL.DOOR_W / 2;
  const LINT_Y = JAIL.DOOR_H + 0.14;                 // the head, above the 0.14 kerb
  const pierS_W = (CZ - D_HW) - Z_S;                 // 5.8
  const pierN_W = Z_N - (CZ + D_HW);                 // 5.8
  // A FLANK TEXTURE IS SIZED TO THE BOX IT IS ON, not to the tallest one.
  // `stoneFlank` was painted DEP x BASE_H and handed to all four boxes below,
  // but only the two piers are DEP wide and BASE_H tall: the lintel is 1.4 m
  // tall and the recess back is 3.45 m deep, so the same canvas came out at
  // 52.86 and 23.13 px/m against a declared 16. Each box now paints its own,
  // at its own depth, its own height and its own `baseY` — which is also what
  // keeps the ashlar bond walking up the WORLD grid across the seam between
  // them, exactly as `stoneTex`'s own comment requires.
  const stoneFlank = flat(stoneTex(DEP, JAIL.BASE_H, 0));
  shell(DEP, JAIL.BASE_H, pierS_W, FX + DEP / 2, JAIL.BASE_H / 2, Z_S + pierS_W / 2,
    flat(stoneTex(pierS_W, JAIL.BASE_H, 0)), stoneFlank);
  shell(DEP, JAIL.BASE_H, pierN_W, FX + DEP / 2, JAIL.BASE_H / 2, Z_N - pierN_W / 2,
    flat(stoneTex(pierN_W, JAIL.BASE_H, 0)), stoneFlank);
  shell(DEP, JAIL.BASE_H - LINT_Y, JAIL.DOOR_W, FX + DEP / 2,
    (LINT_Y + JAIL.BASE_H) / 2, CZ,
    flat(stoneTex(JAIL.DOOR_W, JAIL.BASE_H - LINT_Y, LINT_Y)),
    flat(stoneTex(DEP, JAIL.BASE_H - LINT_Y, LINT_Y)));
  shell(DEP - JAIL.RECESS, LINT_Y, JAIL.DOOR_W,
    FX + JAIL.RECESS + (DEP - JAIL.RECESS) / 2, LINT_Y / 2, CZ,
    flat(stoneTex(JAIL.DOOR_W, LINT_Y, 0)),
    flat(stoneTex(DEP - JAIL.RECESS, LINT_Y, 0)));

  // ── the upper floors, the cornice and the parapet ───────────────────────
  const UY = JAIL.BASE_H;
  // The back gets its own W-wide brick — the same run as the facade, minus the
  // openings. It cannot reuse `face` (that one has the windows painted into it)
  // and it must not reuse `flank` (that one is DEP metres wide, and stretching
  // it across W is the bug this shell's `back` parameter exists to end).
  shell(DEP, JAIL.UPPER_H, W, FX + DEP / 2, UY + JAIL.UPPER_H / 2, CZ,
    flat(upperTex(W, JAIL.UPPER_H, UY, true)),
    flat(upperTex(DEP, JAIL.UPPER_H, UY, false)),
    flat(upperTex(W, JAIL.UPPER_H, UY, false)));

  // The cornice projects FORWARD only. Extending it sideways would poke it
  // through SEVENS' and LOANS' east walls, which stop dead on this same plane —
  // GOTCHAS §6: abut, never overlap.
  const CY = UY + JAIL.UPPER_H;
  const CORN_PROUD = 0.24;
  shell(DEP + CORN_PROUD, JAIL.CORNICE_H, W,
    FX - CORN_PROUD + (DEP + CORN_PROUD) / 2, CY + JAIL.CORNICE_H / 2, CZ,
    flat(stoneTex(W, JAIL.CORNICE_H, CY)), flat(stoneTex(DEP + CORN_PROUD, JAIL.CORNICE_H, CY)));

  const PY = CY + JAIL.CORNICE_H;
  shell(DEP, JAIL.PARAPET_H, W, FX + DEP / 2, PY + JAIL.PARAPET_H / 2, CZ,
    flat(upperTex(W, JAIL.PARAPET_H, PY, false)),
    flat(upperTex(DEP, JAIL.PARAPET_H, PY, false)));

  // ── the sally port ──────────────────────────────────────────────────────
  //
  // Steel, two leaves, no glazing. `ct/int-jail.ts` declares the same leaf on
  // the `DoorLeaf` so the room's opening and this one cannot disagree — which
  // is the bug the user reported on the casino, *"the interior door doesnt
  // match the exterior doorway"*, and the reason `DoorDecl.leaf` exists.
  const steelM = new THREE.MeshBasicMaterial({ color: STEEL });
  const steelDkM = new THREE.MeshBasicMaterial({ color: STEEL_DK });
  /** a plain box, in world coordinates */
  const box = (w: number, h: number, d: number, m: THREE.Material,
               x: number, y: number, z: number) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    return add(b);
  };

  const DOOR_FACE = FX + JAIL.RECESS;                // the leaf plane, 0.6 m back
  const SILL = 0.14;                                 // the kerb; the sill is flush
  const leafW = JAIL.DOOR_W / 2;
  const doorT = declareSurface(pixTex(24, 64, (g) => {
    g.fillStyle = '#3a3c40'; g.fillRect(0, 0, 24, 64);
    // pressed panels — two per leaf, the shape every steel service door has
    for (const [py, ph] of [[6, 22], [34, 22]] as const) {
      g.fillStyle = 'rgba(0,0,0,0.26)'; g.fillRect(3, py, 18, ph);
      g.fillStyle = '#42444a'; g.fillRect(4, py + 1, 16, ph - 2);
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(4, py + 1, 16, 1);
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(4, py + ph - 2, 16, 1);
    }
    // rust creeping up from the threshold, and a kick plate over it
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * 24, y = 64 - Math.pow(Math.random(), 2) * 14;
      g.fillStyle = `rgba(96,58,34,${0.08 + Math.random() * 0.22})`;
      g.fillRect(x, y, 1, 1);
    }
    g.fillStyle = '#4a4c52'; g.fillRect(2, 56, 20, 6);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(2, 56, 20, 1);
    dither(g, 24, 64, 60);
  }), 'detail');
  const doorM = flat(doorT);
  for (const s of [-1, 1]) {
    box(0.09, JAIL.DOOR_H - 0.02, leafW - 0.02, doorM,
      DOOR_FACE + 0.045, SILL + (JAIL.DOOR_H - 0.02) / 2 - 0.07, CZ + s * leafW / 2);
  }
  // the meeting stile, a pull handle on each leaf, and the threshold
  box(0.12, JAIL.DOOR_H - 0.02, 0.06, steelDkM, DOOR_FACE + 0.05, SILL + JAIL.DOOR_H / 2 - 0.07, CZ);
  for (const s of [-1, 1]) {
    box(0.06, 0.34, 0.05, steelDkM, DOOR_FACE - 0.02, SILL + 1.02, CZ + s * 0.18);
  }
  // slabTex, not the flat steelDkM: the threshold is walked on and sits right
  // beside the textured portal paving, so a flat quad here is exactly item
  // 0a's defect class. The box is only 0.05 m tall, so one mapped material
  // on all six faces (rather than a top-only array) is enough — the sides
  // are a sliver nobody sees edge-on.
  const thresholdM = new THREE.MeshBasicMaterial({
    color: STEEL_DK,
    map: slabTex({ wMeters: JAIL.RECESS + 0.06, dMeters: JAIL.DOOR_W, base: '#26282c', joint: 0, grain: 0.12 }),
  });
  box(JAIL.RECESS + 0.06, 0.05, JAIL.DOOR_W, thresholdM,
    FX + JAIL.RECESS / 2, SILL + 0.02, CZ);

  // ── the portal surround ─────────────────────────────────────────────────
  //
  // It projects 0.12 and no further, which is `WALK_PROJECTION` — the depth of
  // the deepest thing this world puts at walking height, and the number the
  // block's colliders are cut to. A civic portal wants to be deeper than that,
  // and the depth comes from the 0.6 m RECESS going in rather than from stone
  // coming out: a sally port is a recess, not a porch, and a projection past
  // 0.12 would be eating the pavement the whole site was chosen to widen.
  const PROUD = WALK_PROJECTION;
  // Each piece of trim paints at ITS OWN face size — `box(w,h,d)` shows its
  // −x face, which spans d x h. One shared 1 m canvas is what put a 175x
  // spread of block size on five different boxes; see `dressed()` above.
  const jambW = 0.7;
  const jambM = flat(dressed(jambW, LINT_Y + 0.55));
  for (const s of [-1, 1]) {
    box(PROUD, LINT_Y + 0.55, jambW, jambM,
      FX - PROUD / 2, (LINT_Y + 0.55) / 2, CZ + s * (D_HW + jambW / 2));
  }
  box(PROUD, 0.55, JAIL.DOOR_W + 2 * jambW,
    flat(dressed(JAIL.DOOR_W + 2 * jambW, 0.55)),
    FX - PROUD / 2, LINT_Y + 0.275, CZ);

  // ── the municipal plate ─────────────────────────────────────────────────
  //
  // `HOUSE OF DETENTION` is asymmetric ON PURPOSE. GOTCHAS §10 is a HOTEL blade
  // that shipped mirrored and got away with it because H, O and T read the same
  // both ways — only the E and the L gave it away. The S, F and N here make a
  // mirror visible in the first screenshot.
  //
  // It is ONE single-sided plane, not a DoubleSide one: nobody can get behind
  // this wall, so the back-to-back pair GOTCHAS §35 prescribes would be a second
  // plane nothing can ever see.
  const GLYPH: Record<string, number[]> = {
    A: [0b01110, 0b10001, 0b11111, 0b10001, 0b10001], B: [0b11110, 0b10001, 0b11110, 0b10001, 0b11110],
    C: [0b01111, 0b10000, 0b10000, 0b10000, 0b01111], D: [0b11110, 0b10001, 0b10001, 0b10001, 0b11110],
    E: [0b11111, 0b10000, 0b11110, 0b10000, 0b11111], F: [0b11111, 0b10000, 0b11110, 0b10000, 0b10000],
    G: [0b01111, 0b10000, 0b10011, 0b10001, 0b01111], H: [0b10001, 0b10001, 0b11111, 0b10001, 0b10001],
    I: [0b11111, 0b00100, 0b00100, 0b00100, 0b11111], J: [0b00111, 0b00010, 0b00010, 0b10010, 0b01100],
    K: [0b10001, 0b10010, 0b11100, 0b10010, 0b10001], L: [0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
    M: [0b10001, 0b11011, 0b10101, 0b10001, 0b10001], N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001],
    O: [0b01110, 0b10001, 0b10001, 0b10001, 0b01110], P: [0b11110, 0b10001, 0b11110, 0b10000, 0b10000],
    Q: [0b01110, 0b10001, 0b10101, 0b10010, 0b01101], R: [0b11110, 0b10001, 0b11110, 0b10010, 0b10001],
    S: [0b01111, 0b10000, 0b01110, 0b00001, 0b11110], T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100],
    U: [0b10001, 0b10001, 0b10001, 0b10001, 0b01110], V: [0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
    W: [0b10001, 0b10001, 0b10101, 0b11011, 0b10001], X: [0b10001, 0b01010, 0b00100, 0b01010, 0b10001],
    Y: [0b10001, 0b01010, 0b00100, 0b00100, 0b00100], Z: [0b11111, 0b00010, 0b00100, 0b01000, 0b11111],
    '0': [0b01110, 0b10011, 0b10101, 0b11001, 0b01110], '1': [0b00100, 0b01100, 0b00100, 0b00100, 0b01110],
    '2': [0b11110, 0b00001, 0b01110, 0b10000, 0b11111], '3': [0b11110, 0b00001, 0b01110, 0b00001, 0b11110],
    '4': [0b10010, 0b10010, 0b11111, 0b00010, 0b00010], '5': [0b11111, 0b10000, 0b11110, 0b00001, 0b11110],
    '6': [0b01110, 0b10000, 0b11110, 0b10001, 0b01110], '7': [0b11111, 0b00010, 0b00100, 0b01000, 0b01000],
    '8': [0b01110, 0b10001, 0b01110, 0b10001, 0b01110], '9': [0b01110, 0b10001, 0b01111, 0b00001, 0b01110],
    '·': [0, 0, 0b00100, 0, 0], ' ': [0, 0, 0, 0, 0],
  };
  /** stamp a word as texel blocks. A glyph this table does not have draws as a
   *  SOLID BLOCK, not as a space — `ct/lot.ts` shipped "BUY ERE AY ERE" because
   *  a missing glyph is indistinguishable from good kerning. */
  const stamp = (g: CanvasRenderingContext2D, s: string, x0: number, y0: number,
                 px: number, ink: string) => {
    g.fillStyle = ink;
    for (let i = 0; i < s.length; i++) {
      const rows = GLYPH[s[i]] ?? [0b11111, 0b11111, 0b11111, 0b11111, 0b11111];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
        if (rows[r] & (1 << (4 - c))) g.fillRect(x0 + (i * 6 + c) * px, y0 + r * px, px, px);
      }
    }
  };
  // THE FIRST PASS OVERFLOWED AND SHIPPED "ITY OF CROSSTOW / E OF DETEN" —
  // `shots/O-jail-day-approach.png` before this commit. The arithmetic is worth
  // writing down because it is the whole of the fix and nothing about it is
  // guessable from looking:
  //
  //   a line of n characters is  n * 6 * px  texels wide and  5 * px  tall
  //   so in METRES it is  n * 6 * px / ppm  wide and  5 * px / ppm  tall
  //
  // The binding line is `HOUSE OF DETENTION`, 18 characters. At px = 1 and
  // ppm = 24 that is 4.50 m wide inside a 5.20 m plate, with 0.208 m letters —
  // taller than the LOANS fascia across the street, which reads from the far
  // kerb. The old numbers asked for 18 * 6 * 3 = 324 texels on a 187-texel
  // canvas: it was never going to fit and nothing said so.
  const PLATE_W = 5.2, PLATE_H = 0.75, PLATE_PPM = 24;
  const pw = Math.round(PLATE_W * PLATE_PPM), ph = Math.round(PLATE_H * PLATE_PPM);
  const plateT = declareSurface(pixTex(pw, ph, (g) => {
    g.fillStyle = '#5d5e57'; g.fillRect(0, 0, pw, ph);
    // a cast plate is a raised field inside a bevelled frame
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, 0, pw, 2);
    g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(0, ph - 2, pw, 2);
    g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(3, 3, pw - 6, ph - 6);
    g.fillStyle = '#66675f'; g.fillRect(5, 5, pw - 10, ph - 10);
    const line = (s: string, px: number, y: number) => {
      const wpx = s.length * 6 * px - px;
      // A line that does not fit is a line somebody will ship without noticing —
      // it clips at the canvas edge and the first and last words simply go.
      // Say so rather than draw it.
      if (wpx > pw - 4) console.warn(`[jail] plate line "${s}" needs ${wpx}px of ${pw}px — it will clip`);
      const x = Math.round((pw - wpx) / 2);
      stamp(g, s, x, y + 1, px, 'rgba(0,0,0,0.34)');    // the cast shadow first
      stamp(g, s, x, y, px, '#20221f');
    };
    line('CITY OF CROSSTOWN', 1, 3);
    line('HOUSE OF DETENTION', 1, 11);
    dither(g, pw, ph, 220);
  }), 'sign');
  {
    // `rotation.y = -π/2` faces −x, and on that plane the texture's u runs +z,
    // which is the reader's right when they are looking at it. GOTCHAS §35: the
    // rotation has ALREADY done the mirroring and flipping the texture as well
    // would undo it. Verified by standing in the street and reading it.
    const p = new THREE.Mesh(new THREE.PlaneGeometry(PLATE_W, PLATE_H),
      new THREE.MeshBasicMaterial({ map: plateT, side: THREE.FrontSide }));
    p.rotation.y = -Math.PI / 2;
    // centred in the frieze between the portal head and the top of the stone,
    // so it sits ON something rather than floating on a field of ashlar
    p.position.set(FX - PROUD - 0.02, (LINT_Y + 0.55 + JAIL.BASE_H) / 2, CZ);
    add(p);
  }

  // ── the bars, which are the point ───────────────────────────────────────
  //
  // Real geometry, on every opening. A barred window painted on a wall is the
  // same class of mistake as a person painted on a plane, and this is the one
  // detail the whole building is recognised by.
  const barM = new THREE.MeshBasicMaterial({ color: 0x2a2c2e });
  /** a barred grille standing PROUD of a face, in the plane x = xf */
  const grille = (xf: number, z: number, y0: number, y1: number, w: number, n: number) => {
    const h = y1 - y0;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      box(0.05, h, 0.045, barM, xf, (y0 + y1) / 2, z - w / 2 + t * w);
    }
    // two horizontal ties — a grille with only uprights reads as a fence
    for (const ty of [y0 + h * 0.32, y0 + h * 0.68]) {
      box(0.045, 0.045, w, barM, xf, ty, z);
    }
  };
  const winSillM = flat(dressed(WIN_W + 0.30, 0.08));
  for (let i = 0; i < BAYS; i++) {
    const z = bayZ(i);
    for (const [sill, head] of ROWS) {
      grille(FX - 0.045, z, sill + 0.03, head - 0.03, WIN_W - 0.06, 5);
      // a stone sill under each, projecting just enough to throw a line
      box(0.10, 0.08, WIN_W + 0.30, winSillM, FX - 0.05, sill - 0.05, z);
    }
  }

  // ── two slot windows in the stone, either side of the port ──────────────
  //
  // Ground-floor openings are what you actually walk past, so they are the ones
  // that have to hold up at 1.8 m. Small, high and heavily barred — a lock-up
  // gives its street elevation as little as it can.
  const SLOT_W = 0.72, SLOT_Y0 = 3.05, SLOT_Y1 = 3.95;
  const slotT = declareSurface(pixTex(16, 20, (g) => {
    g.fillStyle = '#17191a'; g.fillRect(0, 0, 16, 20);
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, 16, 3); g.fillRect(0, 0, 3, 20);
    g.fillStyle = 'rgba(150,150,140,0.10)'; g.fillRect(13, 3, 3, 17);
    dither(g, 16, 20, 30);
  }), 'detail');
  const slotSillM = flat(dressed(SLOT_W + 0.26, 0.09));
  for (const s of [-1, 1]) {
    const z = CZ + s * 2.85;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(SLOT_W, SLOT_Y1 - SLOT_Y0), flat(slotT));
    p.rotation.y = -Math.PI / 2;
    p.position.set(FX - 0.015, (SLOT_Y0 + SLOT_Y1) / 2, z);
    add(p);
    grille(FX - 0.05, z, SLOT_Y0 + 0.04, SLOT_Y1 - 0.04, SLOT_W - 0.08, 4);
    box(0.10, 0.09, SLOT_W + 0.26, slotSillM, FX - 0.05, SLOT_Y0 - 0.06, z);
  }

  // ── a string course, where the stone gives out and the brick starts ─────
  //
  // The first pass ran ashlar straight into engineering brick with nothing
  // between them and the junction read as two textures meeting rather than as
  // one building — `shots/O-jail-day-approach.png` before this. A civic base
  // always terminates in a band; it is one box and it does most of the work of
  // making the elevation look composed.
  box(0.16, 0.26, W, flat(dressed(W, 0.26)), FX - 0.06, JAIL.BASE_H - 0.02, CZ);

  // ── the lamps ──────────────────────────────────────────────────────────
  //
  // TWO, flanking the door, not one over it. The single overhead lamp was
  // built first and it landed at 4.15 m — dead behind the municipal plate,
  // which is centred at 4.175. Neither could be seen properly and nothing in
  // the code connected them: two objects, two independently reasonable
  // heights, one occupying the other. A flanking pair is also the more
  // truthful fixture for a precinct entrance, so this is not a workaround.
  //
  // They hang at 3.3 m — well over a 1.8 m player — so the 0.42 m of arm is
  // nowhere near the walking lane the collider is cut to. `ct/street.ts:196`
  // makes exactly this argument about the cornice: *"the cornice is deeper but
  // it is 3.5 m up"*.
  const LAMP_Y = 3.30;
  const lensM = new THREE.MeshBasicMaterial({
    color: 0xffe6a8, transparent: true, opacity: 0.25, fog: false, depthWrite: false });
  // THIS FIXTURE CARRIES ITS OWN LIGHT — `userData.selfLit` is the convention
  // for saying so, so the night sweep's exclusion is DECLARED rather than
  // incidental (GOTCHAS §22, and ct/street.ts:397 makes the same declaration
  // for the same reason).
  lensM.userData.selfLit = true;
  const LAMP_DZ = 2.16;                   // clear of the portal jamb at 1.90
  for (const s of [-1, 1]) {
    const lz = CZ + s * LAMP_DZ;
    box(0.34, 0.05, 0.06, steelDkM, FX - 0.17, LAMP_Y + 0.26, lz);         // the arm
    box(0.06, 0.24, 0.06, steelDkM, FX - 0.02, LAMP_Y + 0.14, lz);         // the wall drop
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.18, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x3f3a30, side: THREE.DoubleSide }));
    shade.position.set(FX - 0.32, LAMP_Y + 0.16, lz);
    add(shade);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 6), lensM);
    lens.position.set(FX - 0.32, LAMP_Y + 0.05, lz);
    add(lens);
  }
  // the pool it throws on the stone, and on the pavement under it
  const soft = declareSurface(pixTex(32, 32, (g) => {
    const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15);
    gr.addColorStop(0, 'rgba(255,255,255,0.85)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  }), 'detail');
  const poolM = new THREE.MeshBasicMaterial({
    map: soft, color: 0xffd899, transparent: true, opacity: 0, depthWrite: false,
    fog: false, blending: THREE.AdditiveBlending });
  poolM.userData.selfLit = true;
  // One pool per lamp, on the stone and on the pavement — a single pool for two
  // fixtures would put the brightest patch of wall midway between them, which
  // is the one place neither lamp is.
  for (const s of [-1, 1]) {
    const lz = CZ + s * LAMP_DZ;
    const wallPool = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.0), poolM);
    wallPool.rotation.y = -Math.PI / 2;
    wallPool.position.set(FX - 0.06, LAMP_Y - 0.7, lz);
    add(wallPool);
    const groundPool = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.2), poolM);
    groundPool.rotation.x = -Math.PI / 2;
    groundPool.position.set(FX - 0.8, ctx.sidewalkY + 0.012, lz);
    add(groundPool);
  }
  ctx.onFrame(({ night }) => {
    lensM.opacity = 0.25 + 0.72 * night;
    poolM.opacity = 0.42 * night;
  });

  // ── THE FORECOURT and THE YARD — the ground `JAIL.FORE` and the shorter
  // `JAIL.DEPTH` actually free up, dressed rather than left bare ───────────
  //
  // Appended at the END of the module's build, per GOTCHAS §2: this is a NEW
  // `rnd()`-consuming block and jail.ts already sorts last in its band, so
  // nothing upstream shifts.
  //
  // The forecourt (site edge `SX` to the building's own face `FX`) is granite
  // civic paving, not the ordinary walk sheet — `plazaTex` is what the library
  // steps use for exactly this reason, cooler and greyer than `walkTex` so an
  // approach to a civic building reads as a different pour than the sidewalk
  // it continues from.
  const forecourt = new THREE.Mesh(new THREE.PlaneGeometry(FX - SX, W),
    new THREE.MeshBasicMaterial({ map: plazaTex(SX, FX, Z_S, Z_N) }));
  forecourt.rotation.x = -Math.PI / 2;
  forecourt.position.set((SX + FX) / 2, ctx.sidewalkY + 0.006, CZ);
  add(forecourt);

  // The yard (the building's back `BX` to the site's own back edge) is plain
  // worn concrete — `walkTex`, the same sheet the sidewalk wears, because an
  // exercise yard is poured utility concrete, not dressed stone. A low fence
  // caps it at the far end rather than leaving the site's own edge undressed
  // — the desk's own site comment says nothing is out there and the fog
  // closes behind it, which used to mean the player could never find out;
  // now they can walk right up to the fence and see for themselves.
  const SMX = site.maxX;
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(SMX - BX, W),
    new THREE.MeshBasicMaterial({ map: walkTex(BX, SMX, Z_S, Z_N) }));
  yard.rotation.x = -Math.PI / 2;
  yard.position.set((BX + SMX) / 2, ctx.sidewalkY + 0.006, CZ);
  add(yard);

  const FENCE_X = SMX - 0.35;
  const FENCE_H = 2.4;
  // ── THE YARD FENCE — and why it was the user's "shadow fence" ───────────
  //
  // Item 114, his FIFTH report of the class: *"shadow fence still here. shadow
  // geometry in general needs to be removed."* This was it, and the line below
  // used to be its whole implementation:
  //
  //     new THREE.MeshBasicMaterial({ color: 0x2a2c2e, transparent: true,
  //                                   opacity: 0.75, side: THREE.DoubleSide })
  //
  // A 14 x 2.4 m plane, flat charcoal, NO MAP. The comment on the posts below
  // has always said they are "a touch taller than the mesh they carry" — but
  // the mesh was never drawn, so what stood here was a translucent grey sheet
  // with four posts in front of it. Standing in the yard it is the ONLY
  // untextured surface in frame, among grained brick, banded stone and jointed
  // paving, so the eye does not read it as a fence at all: it reads as a
  // shadow cast across the back of the yard. That is the user's word, exactly.
  //
  // THE CURE IS THE ONE ct/lot.ts ALREADY PROVED, and its `linkPanel`
  // (`ct/lot.ts:311-333`) writes the reasoning out in full: **`alphaTest`
  // WITHOUT `transparent: true`.** A cut-out discards the fragment rather than
  // blending it, so `transparent` buys a chain-link fence nothing and costs it
  // two things — the sorted transparent queue, and, the one that shows, a
  // material that reads as a pale sheet instead of as wire you see through.
  // Dropping the flag also takes this surface OUT of the translucent-plane
  // population the item is sweeping: there is now no standing translucent
  // plane on the jail site at all, rather than a better-looking one.
  //
  // COPIED, NOT IMPORTED, and deliberately: `linkPanel` and its `linkT` are
  // locals inside ct/lot.ts's build function (`:290` and `:311`), not exports,
  // and hoisting them to ct/paint.ts is a lot.ts edit that item 114 does not
  // name. Cited rather than silently re-derived, per BUILDER-BRIEF §8, and a
  // follow-up to hoist one shared `linkPanel` is in my handoff note.
  //
  // Drawn as texels, one texel wide, tile wrapping on 24 so the diamonds run
  // continuously across the panel — a stroked diagonal antialiases to grey
  // mush and NearestFilter then magnifies the mush (ct/lot.ts:286-289).
  const MESH_M = 0.3;          // one tile of diamonds per 0.3 m — ct/lot.ts:311
  const linkT = declareSurface(pixTex(24, 24, (g) => {
    g.clearRect(0, 0, 24, 24);
    // Darker and cooler than the car lot's galvanised #7c848d. This fence is
    // weathered institutional steel at the back of a jail yard, not a
    // dealer's frontage he wants you to look at, and against this yard's pale
    // concrete a lot-bright wire would pull the eye to the least interesting
    // thing in the view.
    g.fillStyle = '#5a626a';
    for (let i = 0; i < 24; i++) for (const off of [0, 8, 16]) {
      // TWO texels of wire, not one: at 0.3 m per tile a single-texel diagonal
      // is sub-pixel from across the yard, alphaTest drops it, and the fence
      // is simply not there — ct/lot.ts:295-301, which is that bug's own note.
      for (const w of [0, 1]) {
        g.fillRect(((i + off + w) % 24), i, 1, 1);
        g.fillRect((((off - i + w) % 24) + 24) % 24, i, 1, 1);
      }
    }
  }), 'detail');
  linkT.wrapS = linkT.wrapT = THREE.RepeatWrapping;
  // DERIVED from the panel's own run and height, never typed — BUILDER-BRIEF
  // §7b. Move the fence or resize the yard and the diamonds stay 0.3 m.
  linkT.repeat.set(W / MESH_M, FENCE_H / MESH_M);
  linkT.needsUpdate = true;
  const fenceM = new THREE.MeshBasicMaterial({ map: linkT, alphaTest: 0.4, side: THREE.DoubleSide });
  const fence = new THREE.Mesh(new THREE.PlaneGeometry(W, FENCE_H), fenceM);
  fence.rotation.y = Math.PI / 2;
  fence.position.set(FENCE_X, FENCE_H / 2, CZ);
  add(fence);
  // TOP AND BOTTOM RAILS. ct/lot.ts:606-610 is the lesson: a chain-link fence
  // is not read from its mesh — the mesh is near-invisible at any distance —
  // it is read from its FRAMEWORK. This had posts and nothing else, which is
  // half a fence; the rails are what stop the wire reading as a floating haze
  // and give the run a hard silhouette line against the sky.
  for (const [ry, t] of [[FENCE_H, 0.06], [0.05, 0.05]] as [number, number][]) {
    box(t, t, W, steelDkM, FENCE_X, ry, CZ);
  }
  // fence posts, every 3.5 m, a touch taller than the mesh they carry
  for (let pz = Z_S + 1.0; pz <= Z_N - 1.0 + 0.01; pz += 3.5) {
    box(0.10, FENCE_H + 0.2, 0.10, steelDkM, FENCE_X, (FENCE_H + 0.2) / 2, pz);
  }
  // IT COLLIDES. First cut left it decorative — "the site already ends in
  // the void beyond SMX, a real collider buys nothing" — and
  // `scripts/O-jail-walk-fix.mjs` caught that reasoning being wrong the first
  // time it actually walked the yard on foot: a player walks straight through
  // a fence they can see, which reads as broken geometry, not as open ground.
  // GOTCHAS §27 — a check that is only run once, by hand, on a mutation that
  // does not test the real path, is decoration; this is the version that
  // walked it. Thin (0.1 m either side of the panel) and well clear of the
  // sweep's own "back" station at x 71.76, so it caps the yard without
  // reopening the walkability bug this file exists to fix.
  ctx.obstacle({ minX: FENCE_X - 0.1, maxX: FENCE_X + 0.1, minZ: Z_S, maxZ: Z_N });

  // ── THE FLANK SCREENS — closing the gap the walkability fix opened ──────
  //
  // URGENT, queue item 0: *"the jail has empty gaps around it."* The desk
  // approved shortening `JAIL.DEPTH` from 12 to 4 this morning to free up a
  // real, walkable yard, and verified it from exactly one angle — head-on,
  // dead centre of the side street, the one view where the facade hides its
  // own flanks. From any oblique one, measured here with
  // `scripts/w2-jail-look.mjs along-south-flank`: the building's own
  // north/south end walls are only `DEP` (4 m) deep, so past them is 9.65 m
  // of open yard and then a 2.4 m fence — nothing between that and the sky
  // for the 13.6 m of height the building itself stands. You are not
  // looking at a building with a yard behind it; you are looking at a thin
  // slab standing in an empty lot.
  //
  // NOT `DEPTH` BACK TO 12 — the desk's own ruling is explicit that this
  // would reopen the unwalkable-mass fault `notes/O-jail-site-walkable.md`
  // exists to fix, and the yard is real ground the user can now reach.
  // Instead, a screen along each flank line, from the back of the real
  // building (`BX`) to the fence (`FENCE_X`) it already stops at, wearing
  // the SAME stone-then-brick profile the building itself does — freshly
  // sized to its own 9.65 m run rather than the building's 4 m textures
  // stretched over it, which is what `stoneFlank`/`upperTex` above are
  // already sized for and exactly why they are not reused here.
  //
  // THIN AND AT THE PROPERTY LINE — 0.2 m, standing where the yard's own
  // floor plane already ends (`Z_S`/`Z_N`), same move `FENCE_X`'s collider
  // above made for the back edge. It costs the yard's walkable WIDTH
  // nothing: the floor was never wider than `Z_S…Z_N` to begin with, so
  // this draws a wall where an invisible edge already stood rather than
  // narrowing anything a player could reach. `ctx.obstacle` below matches
  // the same "thin, at the edge" shape as the fence's own.
  //
  // It also happens to be the right building for the idea rather than a
  // patch bolted on: a real House of Detention's exercise yard is WALLED,
  // not open to the next lot. This was never only a gap to close.
  const SCR_T = 0.2;
  const SCR_LEN = FENCE_X - BX;
  const scrCx = BX + SCR_LEN / 2;
  const scrBase = flat(stoneTex(SCR_LEN, JAIL.BASE_H, 0));
  const scrUpper = flat(upperTex(SCR_LEN, JAIL.UPPER_H, UY, false));
  const scrCap = flat(stoneTex(SCR_LEN, JAIL.CORNICE_H + JAIL.PARAPET_H, CY));
  // THE END CAPS ARE 0.2 m, NOT 9.65. `shell`'s `face`/`back` slots are the ±x
  // faces, and on THIS wall those are the thin returns, not the elevation — the
  // long run is the `flank` pair. Passing `scrBase` into both slots therefore
  // squeezed the 9.65 m canvas into a 0.2 m face and drew it at 770 px/m
  // against a declared 16, the worst reading in queue item 6 and 72 of its 227
  // pairs. The wall's free end stands 13.6 m tall in the middle of a yard the
  // player can walk to, so it is not a hidden face. Same courses, same baseY,
  // same declared density — only sized to the face it is actually on, which is
  // the rule the comment above already states for the run itself.
  const scrEndBase = flat(stoneTex(SCR_T, JAIL.BASE_H, 0));
  const scrEndUpper = flat(upperTex(SCR_T, JAIL.UPPER_H, UY, false));
  const scrEndCap = flat(stoneTex(SCR_T, JAIL.CORNICE_H + JAIL.PARAPET_H, CY));
  for (const zLine of [Z_S + SCR_T / 2, Z_N - SCR_T / 2]) {
    shell(SCR_LEN, JAIL.BASE_H, SCR_T, scrCx, JAIL.BASE_H / 2, zLine, scrEndBase, scrBase);
    shell(SCR_LEN, JAIL.UPPER_H, SCR_T, scrCx, UY + JAIL.UPPER_H / 2, zLine, scrEndUpper, scrUpper);
    // one plain stone cap rather than repeating the building's own
    // cornice-then-parapet break — a perimeter wall reads as a wall precisely
    // by NOT being as ornamented as the building it enclosures, the same
    // distinction a real yard wall keeps from the elevation behind it.
    shell(SCR_LEN, JAIL.CORNICE_H + JAIL.PARAPET_H, SCR_T, scrCx,
      CY + (JAIL.CORNICE_H + JAIL.PARAPET_H) / 2, zLine, scrEndCap, scrCap);
    ctx.obstacle({ minX: BX, maxX: FENCE_X, minZ: zLine - SCR_T / 2, maxZ: zLine + SCR_T / 2 });
  }

  // ── collision, registered by the module that draws the building ─────────
  //
  // The desk's ruling: `crosstown.ts:491` held a hand-written collider standing
  // in for this building before it existed, and *"a collider in the entry point
  // standing in for a building that is about to be replaced is exactly the
  // wiring the registration pattern exists to remove."* It is deleted in the
  // same commit as this line.
  //
  // The front face is cut to `WALK_PROJECTION`, not to the legacy 0.30 — the
  // difference is 0.18 m of pavement per facade, which `ct/street.ts:196` calls
  // the single biggest encroachment on the block. That took the walk across
  // the closed end from 1.70 m to 1.88 m against a 0.72 m capsule, raw gap,
  // capsule not subtracted (GOTCHAS §29) — before the walkability fix moved
  // the building back into a forecourt (`notes/O-jail-site-walkable.md`),
  // which widens it far further still: the walk down the middle of the street
  // now runs open all the way to the building's own face, `JAIL.FORE` (4 m)
  // past where it used to stop.
  //
  // ONE OBSTACLE FOR THE BUILDING ITSELF — `FX - PROUD` to `BX` — not for the
  // forecourt or the yard either side of it, and a second, thin one for the
  // fence capping the yard (registered just above, beside the fence it
  // belongs to, not hand-typed twice here). That is the walkability fix
  // itself: the old collider ran `site.minX` to `BX` and covered nearly the
  // whole published site; this one covers only the building's own footprint,
  // now a third of the site rather than two-thirds of it, and the forecourt
  // and yard drawn above are open ground with nothing registered over them.
  ctx.obstacle({ minX: FX - PROUD, maxX: BX, minZ: Z_S, maxZ: Z_N });
}
