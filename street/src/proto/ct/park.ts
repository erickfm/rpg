import * as THREE from 'three';
import type { AABB } from '../fp';
import { BUILD, type CtxBuild } from './ctx';
import { pixTex, dither } from './paint';
import { weedTuft } from './weeds';

// What stands IN the park. `ct/street.ts` owns the SITE — the ground, the two
// party walls the gap exposed, the rear elevation and the low boundary along
// the street line — and hands the extents over; this file owns everything you
// find once you are inside. Same split `ct/civic.ts` already has with the
// library and the church.
//
// This is the first thing on the block that is not a building, and that is
// the whole opportunity: everything else here is a wall you walk past. So the
// job is not "decorate 30 m of grass", it is to make a place you walk INTO —
// which means an edge you cross, and somewhere to walk once you are over it.
//
// The hand is the library's, which the user liked: municipal, once cared
// about, not cared for since. Nothing here is pretty. The paths are the
// cheapest surface a parks department could lay, they go where people
// actually walk, and where they do not, the grass is worn through to dirt
// anyway.

export interface Site { minX: number; maxX: number; minZ: number; maxZ: number; y: number }

// A local LCG, because `rnd()` in ct/rng.ts is the ONE seeded stream and its
// order is load-bearing for every tree height and pigeon in the world
// (GOTCHAS §2). Nothing in here may draw from it.
const clcg = (s: number) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);

// A PARK PATH IS NOT A ROAD, and this one was.
//
// The user, on a review frame: *"THE PATHS READ AS ROAD. They are the same dark
// grey as the carriageway, so the park looks like it has tarmac streets through
// it... This one change will do more than anything else on the list."*
//
// They were right and the numbers say why. The old buff was #7d7565, which sits
// between the carriageway's #46413a and the walk's #84817a and shares their
// grey cast, so in rain or at dusk — which is when the review frame was taken —
// it collapses onto the road. Hoggin is gravel rolled into clay: it is WARM and
// it is LIGHT, and those are the two axes that separate it from asphalt under
// every light in the day.
const PATH = '#9c8b66', PATH_D = '#8a7a58', PATH_L = '#b3a37c';
// A WORN LINE IN TURF IS THIN GRASS, NOT BARE EARTH — which is what these were.
//
// The user, on the field: *"what is this"*, and the desk read it as the mowing
// stripes being near-black wedges. Standing in it at noon says otherwise, and
// the honest answer matters more than a quick agreement: **the wedges are the
// DESIRE LINES.** #6b5d47 is mud, roughly half the luminance of either mown
// green, and I had laid SEVEN of them fanning across the open middle at up to
// 0.75 m wide. In a dim frame they go near-black and read as shadows or
// diggings. The mowing stripes were behind them the whole time, doing nothing,
// because nothing subtle survives next to something that loud.
//
// So the dirt moves most of the way back to grass: paler, desaturated, barely
// browner than the turf either side. That is what a path worn across a lawn
// actually looks like — the grass gives up before the soil shows.
const DIRT = '#7c7658', DIRT_D = '#6f6a4e';

// ONE SUN FOR THE PARK. The field bakes its relief shading against this, and
// so does the shelter roof — a world lit from two directions reads as neither.
// Materials here are `MeshBasicMaterial`, so every bit of form in the park is
// baked into vertex colour or it does not exist.
const SUN = new THREE.Vector3(-0.42, 0.80, 0.43).normalize();


// Takes the build context the whole world is given, plus the site extents
// ct/street.ts published. The entry point already holds both — it reads
// `street.park` for the floor height — so wiring this is one line there and
// nothing has to be threaded through street.ts.
export const ORDER = BUILD.SITE;

/**
 * The world loader's entry point — see `ct/world.ts`. A NEW export beside
 * `buildPark`, which is unchanged: it still takes its site explicitly, so any
 * existing caller keeps working.
 *
 * The site comes from the roster by name now instead of being relayed by the
 * desk. This module was finished and invisible for days waiting on exactly
 * that relay.
 */
export function register(ctx: CtxBuild) {
  const site = ctx.site('park');
  if (!site) { console.warn('[park] the block has no site named "park" — nothing built'); return; }
  buildPark(ctx, site);
}

export function buildPark(ctx: CtxBuild, site: Site, gate?: [number, number]) {
  const { scene, flat, wet, KERB_H, obstacle } = ctx;
  const colliders: AABB[] = [];
  const solid = (b: AABB) => { colliders.push(b); obstacle(b); return b; };

  const W = site.maxZ - site.minZ;                 // the frontage, 30 m
  // the opening in the street-line boundary. Defaults to the middle 28% —
  // what `openSite`'s `gate: 0.36` leaves either side. If D changes that
  // fraction this is the number that has to follow it.
  const [gz0, gz1] = gate ?? [site.minZ + W * 0.36, site.maxZ - W * 0.36];
  const gateMid = (gz0 + gz1) / 2;

  // How far back you can actually GET, which is NOT how far back the park
  // goes. The site is 32 m deep now; `crosstown.ts` still clamps the player
  // at x = -13.4, so 25 m of it cannot be walked into. See notes/BLOCKED-E.md.
  //
  // Laid out at the site's TRUE size throughout, which for a while meant the
  // back half was visible and unreachable: `bounds.minX` clamped the player
  // at -13.4 in a 32 m park. F has moved it to -40, so the whole thing walks
  // now and the layout needed no changes for that — which was the point of
  // measuring everything off `site` rather than off what you could reach.
  const backX = site.minX + 3.2;

  // ── THE EDGE LINE ────────────────────────────────────────────────────────
  //
  // The user's standing rule: *"in general we should not encroach the already
  // cramped sidewalk."* So the park has ONE line, and everything it owns is
  // west of it. Bins, benches, piers, planting, paths — all of it. Only the
  // railings and the gate opening touch the pavement, because those ARE the
  // boundary.
  //
  // It was not obeyed and the user photographed the result: the bin stood
  // 0.23 m out on the walk, the bench 0.36 m, the pier's cap 0.07 m. All
  // three were placed off the path rather than off the line, which is the
  // mistake — a rule you have to remember at every call site is a rule that
  // gets forgotten at one of them. `inside()` is that rule as arithmetic:
  // give it a half-width and it hands back the furthest east a thing may
  // stand.
  const KERB_W = 0.25;
  const EDGE_X = site.maxX - KERB_W;              // grass starts here
  const inside = (halfWidth: number) => EDGE_X - halfWidth - 0.05;

  // ── surfaces ─────────────────────────────────────────────────────────────
  //
  // Everything laid on the grass is a flat DECAL 6 mm above it, the way the
  // tree pits in ct/props.ts are — never a billboard, which would stand up on
  // end the moment you looked down at it (GOTCHAS §3). 6 mm because two
  // coplanar surfaces z-fight (§6) and this world has been bitten by that at
  // the corner roads, the sidewalk and the chamfer.
  const LIFT = 0.006;
  // 32 px/m, the ground art's density, and the canvas is sized from the
  // surface's real metres so the texels stay square whatever shape it is.
  const surfaceTex = (wM: number, dM: number, kind: 'path' | 'dirt') => {
    const PW = Math.max(8, Math.round(wM * 32)), PH = Math.max(8, Math.round(dM * 32));
    return pixTex(PW, PH, (g) => {
      const r = clcg(kind === 'path' ? 0x51c0de : 0x2b7f31);
      g.fillStyle = kind === 'path' ? PATH : DIRT;
      g.fillRect(0, 0, PW, PH);
      // the aggregate: hoggin is gravel rolled into clay, so it reads as
      // speckle at two scales rather than as a flat colour
      for (let i = 0; i < Math.round(PW * PH * 0.02); i++) {
        const k = r();
        g.fillStyle = kind === 'path'
          ? (k > 0.72 ? PATH_L : k > 0.34 ? PATH_D : PATH)
          : (k > 0.6 ? DIRT_D : DIRT);
        g.fillRect(Math.floor(r() * PW), Math.floor(r() * PH), 1 + Math.floor(r() * 2), 1);
      }
      // …and the edges go first: grass creeps in from both sides in patches
      g.fillStyle = 'rgba(96,104,78,0.55)';
      for (let i = 0; i < Math.round(PH * 0.5); i++) {
        const y = Math.floor(r() * PH), d = 1 + Math.floor(r() * 4);
        if (r() < 0.5) g.fillRect(0, y, d, 1 + Math.floor(r() * 3));
        else g.fillRect(PW - d, y, d, 1 + Math.floor(r() * 3));
      }
      if (kind === 'path') {
        // A REPAIR, NOT A HOLE. The user, on the same frame: *"black rectangles
        // sitting on the path mid-right that read as holes or missing
        // texture."* That is this patch. It was #4c4a48 — near-black against
        // the old path and pitch-black against the new buff — with a hard
        // 2 px shadow along its top edge, which is exactly how a missing
        // texture looks.
        //
        // I had this in my own quality report and waved it through: "reads as a
        // tar repair, which is what it is meant to be. Cosmetic and arguably
        // correct." It is not correct, and the user found it before I did. A
        // real cold-patch repair is BROWNER and only a little darker than what
        // it is patching, and it has a ragged edge because it is shovelled in.
        const ax = Math.round(PW * 0.2), ay = Math.round(PH * 0.42);
        const aw = Math.round(PW * 0.55), ah = Math.max(2, Math.round(PH * 0.06));
        g.fillStyle = '#6e6047';
        g.fillRect(ax, ay, aw, ah);
        g.fillStyle = '#7a6c52';                     // the coarse aggregate in it
        for (let i = 0; i < aw * ah * 0.3; i++) {
          g.fillRect(ax + Math.floor(r() * aw), ay + Math.floor(r() * ah), 1, 1);
        }
        for (let x = ax; x < ax + aw; x++) {         // shovelled, so the edge is ragged
          g.fillStyle = PATH;
          if (r() < 0.45) g.fillRect(x, ay, 1, 1);
          if (r() < 0.45) g.fillRect(x, ay + ah - 1, 1, 1);
        }
      }
      dither(g, PW, PH, Math.round(wM * dM * 8));
    });
  };
  /** a flat run of surface, laid in the x/z plane */
  const lay = (x0: number, x1: number, z0: number, z1: number, kind: 'path' | 'dirt') => {
    const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), wet(flat(surfaceTex(w, d, kind))));
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, KERB_H + LIFT, (z0 + z1) / 2);
    scene.add(m);
    return m;
  };

  // ── the kerb ─────────────────────────────────────────────────────────────
  //
  // Grass ran straight into the pavement in a raw butt joint at a slightly
  // different level, so it read as two surfaces that happened to meet — worst
  // across the gate, where there is no boundary wall to hide it. A park has a
  // NAMED edge: granite kerb, grass inside it, paving outside, standing a
  // little proud of both so the join is a thing rather than an accident.
  //
  // It ABUTS and never overlaps (GOTCHAS §6): its east face stops 10 mm short
  // of the walk's west face at x = -FACE rather than meeting it exactly,
  // because two coincident vertical faces back to back are precisely what
  // z-fights, and that ragged look in the screenshot may already have been
  // it. The 10 mm is invisible at this world's texel density.
  const kerbT = pixTex(Math.round(KERB_W * 32), 64, (g) => {
    const r = clcg(0x9e31b2), KW = Math.round(KERB_W * 32);
    g.fillStyle = '#8e8b83'; g.fillRect(0, 0, KW, 64);
    for (let i = 0; i < 120; i++) {                 // granite, so speckle not grain
      const k = r();
      g.fillStyle = k > 0.7 ? '#9c998f' : k > 0.35 ? '#84817a' : '#77746d';
      g.fillRect(Math.floor(r() * KW), Math.floor(r() * 64), 1, 1);
    }
    g.fillStyle = 'rgba(40,38,34,0.4)';             // a joint every 1 m
    for (let y = 0; y < 64; y += 32) g.fillRect(0, y, KW, 1);
    g.fillStyle = 'rgba(74,86,58,0.35)';            // moss on the grass side
    for (let i = 0; i < 26; i++) g.fillRect(0, Math.floor(r() * 64), 1 + Math.floor(r() * 2), 1 + Math.floor(r() * 3));
  });
  kerbT.wrapS = kerbT.wrapT = THREE.RepeatWrapping;
  kerbT.repeat.set(1, W / 2);
  const KERB_TOP = 0.08;                            // how proud it stands
  const kerb = new THREE.Mesh(new THREE.BoxGeometry(KERB_W - 0.01, KERB_H + KERB_TOP, W),
    wet(flat(kerbT)));
  kerb.position.set(EDGE_X + (KERB_W - 0.01) / 2 - 0.005, (KERB_H + KERB_TOP) / 2, (site.minZ + site.maxZ) / 2);
  scene.add(kerb);

  // ── the field, and the loop around it ────────────────────────────────────
  //
  // The user's layout, and every part of it is doing something:
  //
  //   THE FIELD is the largest thing in the park, and it is open. Mown grass
  //     and nothing standing in it. A park you can see across is bigger than
  //     a park you cannot, and everything else here is arranged around
  //     keeping this one rectangle clear.
  //   THE LOOP goes AROUND the field, not across it. That is what makes a
  //     small park feel bigger than it is: a circuit has no end to arrive at,
  //     so you walk it rather than crossing it, and 60 m of walking fits in
  //     30 m of park. A path across would halve the field and finish in four
  //     seconds.
  //   The gate opens onto the loop rather than into the middle of the grass.
  //
  // It is all measured off the site extents and the reachable line, so when
  // the park is deepened the field grows and the loop grows with it — the
  // shape is right at 7 m and it is the same shape at 30 m.
  const PATH_W = 1.5;
  // ── THE LOOP HAS TO READ AS A CIRCUIT ────────────────────────────────────
  //
  // It was a rectangle hugging the site boundary — the street leg 1.35 m off
  // the railings, the back leg 3.2 m off the wall — and from anywhere on it
  // you saw one straight run 27 m long with a fence beside it. That is a path
  // ALONG something, which is why "give it a loop" came back after the loop
  // was built: nothing you could stand on let you see the circuit.
  //
  // Two changes, both about perception rather than plan:
  //
  //   INSET IT. Brought 6 m in on every side, so it has grass on BOTH sides
  //     and the perimeter becomes a planted band rather than a gap. A path
  //     with park on both sides reads as being in the park.
  //   TURN THE CORNERS. Each is chamfered rather than square, so the path
  //     visibly bends and the next leg is already in view as you reach it.
  //     A right angle at 1.5 m wide reads as two paths meeting; a 2.6 m
  //     chamfer reads as one path going round.
  //
  // The field inside is 19 × 16 m and still the largest single thing here.
  const INSET = 6.0, CHAM = 2.6;
  const lx0 = site.minX + INSET + 0.5, lx1 = EDGE_X - INSET;
  const lz0 = site.minZ + INSET, lz1 = site.maxZ - INSET;
  // the four straight legs, each stopped short by the chamfer
  lay(lx0 - PATH_W / 2, lx0 + PATH_W / 2, lz0 + CHAM, lz1 - CHAM, 'path');   // back
  lay(lx1 - PATH_W / 2, lx1 + PATH_W / 2, lz0 + CHAM, lz1 - CHAM, 'path');   // street
  for (const lz of [lz0, lz1]) {
    lay(lx0 + CHAM, lx1 - CHAM, lz - PATH_W / 2, lz + PATH_W / 2, 'path');   // the ends
  }
  // …and the four corners that turn between them.
  //
  // They OVERLAP the legs on purpose: a PATH_W-wide diagonal meeting a
  // PATH_W-wide straight at 45° leaves a triangular notch on the outside of
  // every turn unless it runs past the join, so each corner is drawn 0.3 m long
  // at both ends. That is eight overlaps of two coplanar surfaces, and both
  // were at exactly KERB_H + LIFT — the §6 fault, and the flavour of it that a
  // screenshot cannot be trusted on, because which surface wins depth-fights is
  // view-dependent and a still frame may show either.
  //
  // §6 says abut, never overlap, and where an overlap is the right drawing the
  // answer this file already uses everywhere else is to separate in y: the
  // field is at LIFT × 0.5, the paths at 1.0, litter at 1.5, the bald ring at
  // 2.0, the desire lines at 2.5. The corners take 1.25 — 1.5 mm over the legs
  // they cross, under everything laid on the grass, and far too little to read
  // as a lip on a path you walk over.
  const corner = (cx: number, cz: number, sx: number, sz: number) => {
    const len = Math.hypot(CHAM, CHAM) + PATH_W * 0.4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(PATH_W, len),
      wet(flat(surfaceTex(PATH_W, len, 'path'))));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -Math.atan2(sx * CHAM, sz * CHAM);
    m.position.set(cx + sx * CHAM / 2, KERB_H + LIFT * 1.25, cz + sz * CHAM / 2);
    scene.add(m);
  };
  corner(lx0, lz0 + CHAM, 1, -1);
  corner(lx0, lz1 - CHAM, 1, 1);
  corner(lx1, lz0 + CHAM, -1, -1);
  corner(lx1, lz1 - CHAM, -1, 1);
  // In from the gate to MEET the circuit — to its near edge, not through it.
  // Written as `lx1` this ran to the leg's CENTRELINE and overlapped its east
  // half, 0.75 × 1.9 m of two coplanar path surfaces at the same height, in the
  // one place every visitor walks over on the way in. Axis-aligned rectangles
  // can abut exactly, which is what §6 actually asks for, so this is the edge
  // rather than a y-separation like the corners need.
  lay(site.maxX, lx1 + PATH_W / 2, gateMid - 1.9 / 2, gateMid + 1.9 / 2, 'path');

  // The field itself: mown, and mown in stripes, because a parks department
  // mows in stripes and it is the cheapest way to say "this is maintained,
  // just about" over a large flat area that would otherwise be one colour.
  const fx0 = lx0 + PATH_W / 2, fx1 = lx1 - PATH_W / 2;
  const fz0 = lz0 + PATH_W / 2, fz1 = lz1 - PATH_W / 2;
  const fW = fx1 - fx0, fD = fz1 - fz0;

  // ── TOPOGRAPHY ────────────────────────────────────────────────────────
  //
  // Everything in this world is dead flat except kerbs and steps, and a
  // park is where that stops being acceptable: ground that rises is the
  // cheapest way to make a space feel like somewhere rather than a surface.
  //
  // It is GENTLE on purpose. The player is a 2D walker whose floor comes
  // from a picker (GOTCHAS §7), so anything you could trip over is a bug,
  // not a feature. A crown and three gaussians:
  //
  //   a CROWN     +0.10 m         the whole field, domed
  //   a MOUND     +0.30 m over σ 3.1   the thing you walk up
  //   a DISH      -0.09 m over σ 2.6   the bit that would puddle
  //   a CORNER    -0.10 m over σ 5.2   the ground falling away to the south-east
  //
  // THE CROWN IS WHY THE HOLLOWS EXIST AT ALL. The park site is floored by one
  // flat 32 × 30 m plane at KERB_H, drawn by `openSite` in ct/street.ts, and it
  // is not mine and does not move. My first relief put the dish 90 mm and the
  // corner 100 mm BELOW it, so both were drawn underneath an opaque plane: the
  // hollows were invisible while the floor picker still lowered you into them,
  // which is worse than not having them — you walk down into a dip that is not
  // there. Measured, not guessed: at four points in the two hollows the top
  // surface was the site plane and the grass was 16–79 mm under it.
  //
  // Real turf is crowned for drainage, so the fix is also the truer shape: dome
  // the whole field by 0.10 and cut the hollows into the dome. Nothing then
  // goes below the site plane, the dish still reads as an 86 mm hollow against
  // the ground around it, and the corner still falls away — to exactly the
  // paving level, which is as far as it is allowed to go.
  //
  // The cost is honest: the rim now has to climb the crown as well, so the
  // steepest grade goes from 1 in 12 to 1 in 9.1 even with the fade widened
  // from 3 m to 5.5. Still a lawn you stroll up, and I would rather have that
  // than hollows nobody can see. If ct/street.ts ever lets a module own its
  // site's ground, the crown can come off and the hollows can be real.
  //
  // The numbers were SWEPT, not eyeballed, and my first set was wrong in two
  // ways a drawing would never have shown. A gaussian's own steepest slope is
  // A/(σ√e), which for a 0.45 m mound over σ 4.6 is a comfortable 1 in 17 —
  // but the rim mask below multiplies the whole field, so where it bites into
  // a mound that is still 0.4 m high it ADDS its own 1-in-6 bank on top. And
  // a -0.13 m dish on a 0.14 m kerb puts the floor 8 mm above the roadway.
  // Sampling the composite on a 0.2 m grid instead: steepest 1 in 12 (a lawn
  // you stroll up, a quarter of what a kerb ramp gets away with), floor never
  // below 0.056 m, and 0.0 mm of step where the grass meets the paths.
  //
  // Two rules keep it honest:
  //
  //   THE PATHS STAY LEVEL. A municipal path is laid level and a decal laid
  //     on a slope would either bury itself or float. The relief fades to
  //     zero over the last 3 m of the field, so the grass meets the loop flat
  //     and the paths need to know nothing about any of this. The two decals
  //     that DO cross the grass — the desire lines and the litter — are draped
  //     on the same function instead, because a worn line that stops at the
  //     foot of a mound is not a worn line.
  //   ONE FUNCTION, TWO CONSUMERS. The mesh is displaced by `relief` and the
  //     floor picker answers `relief`. That is the whole discipline of §7 —
  //     the shape you see and the height you walk on cannot be two
  //     descriptions of the same thing, or they drift.
  const mndX = fx0 + (fx1 - fx0) * 0.46, mndZ = (fz0 + fz1) / 2 - 1.6;
  // The dish sits well clear of the mound, and that clearance was measured
  // rather than assumed: at 4.6 m apart the mound's own skirt is still +0.11 m
  // there, which cancelled a -0.09 m dish outright and left a hollow that read
  // 0.15 — ABOVE the level ground it was meant to dip below. The walk caught
  // it; the drawing never would have.
  // 5.5 m in, which is where the rim fade has finished. At 4.4 the dish sat
  // inside the fade, so both it AND the ground around it were scaled toward
  // zero and it could never be deep — it measured 36 mm against its
  // surroundings instead of the 90 mm it is drawn as.
  const dshX = fx1 - 5.5, dshZ = fz1 - 5.5;
  // 2.6 m in from the corner of the grass, not 1.4. At 1.4 the deepest part of
  // the fall sat UNDER the loop's chamfered corner path, which cuts diagonally
  // across exactly that corner of the field — so the one place the fall was at
  // full depth was the one place you could not see grass. Found by a drape
  // sample that reported a path on top and was right to.
  const cnrX = fx1 - 2.6, cnrZ = fz0 + 2.6;
  const gauss = (d2: number, sig: number) => Math.exp(-d2 / (2 * sig * sig));
  const relief = (x: number, z: number) => {
    const inset = Math.min(x - fx0, fx1 - x, z - fz0, fz1 - z);
    if (inset <= 0) return 0;
    // smoothstep, not a linear ramp: a linear mask has a corner in it where
    // it reaches 1, and a corner in the mask is a crease in the lawn
    const t = Math.min(1, inset / 5.5), rim = t * t * (3 - 2 * t);
    const CROWN = 0.10;
    const m = 0.30 * gauss((x - mndX) ** 2 + (z - mndZ) ** 2, 3.1);
    const d = -0.09 * gauss((x - dshX) ** 2 + (z - dshZ) ** 2, 2.6);
    const c = -0.10 * gauss((x - cnrX) ** 2 + (z - cnrZ) ** 2, 5.2);
    return Math.max(0, CROWN + m + d + c) * rim;   // never below the site plane
  };

  /** The floor of the park, at a point. Flat everywhere the relief is. */
  const parkY = (x: number, z: number) => KERB_H + relief(x, z);

  if (fW > 0.5 && fD > 0.5) {
    // ── MOWING STRIPES ────────────────────────────────────────────────────
    //
    // A flat green plane will never read as grass at this world's density —
    // the texture cannot carry blades, and adding speckle just makes a green
    // plane with grit on it. What reads as MOWN GRASS at any distance is the
    // thing a mower physically leaves behind: alternating light and dark
    // bands, because the roller lays the blades toward you on one pass and
    // away on the next, and the two catch the light differently.
    //
    // So: two greens with real separation, 2.2 m bands, ONE direction across
    // the whole field. The previous attempt had 1.6 m bands at 16% alpha,
    // which is a stripe you can measure and cannot see.
    //
    // Then it is broken the way turf actually breaks, because a field mown
    // this morning is a golf course and this one was cut a fortnight ago:
    // worn dirt where the desire lines cross it, a bald ring under the
    // heaviest tree where nothing grows and the mower cannot reach, and the
    // stripes simply stop where the path takes over — the field plane ends at
    // the loop, so that one comes free.
    // TWO GREENS 12% APART, IN 1.5 m BANDS. The desk: *"Real mowing stripes are a
// SUBTLE contrast — two greens maybe 10-15 percent apart in tone, not 60 — and
// they are narrow."* These were 2.2 m and about 20% apart, which was already
// closer than the frame suggested; what actually buried them was the mud of the
// desire lines beside them. Both are fixed together, because either alone would
// have looked like a fix and not been one.
// MEASURED ON SCREEN, not chosen by eye. The pair below reads at ~6%
// peak-to-trough across the turf; the previous pair read at 12.7%, which is
// where mown grass stops looking like nap and starts looking like paint —
// the user's "cut the contrast hard". A gang mower's swathe is 0.5-1.5 m and
// 1.5 was the top of that range, so the band narrows with it.
// `E-field` scans a line across the rendered frame and will fail if either
// drifts back: over 14% is stripes, under 1.5% is not there at all.
const MOW_LIGHT = '#767d58', MOW_DARK = '#6f7653', MOW_BAND = 1.0;

    const mownT = pixTex(Math.max(8, Math.round(fW * 16)), Math.max(8, Math.round(fD * 16)), (g) => {
      const r = clcg(0x4fd21a);
      const MW = Math.max(8, Math.round(fW * 16)), MH = Math.max(8, Math.round(fD * 16));
      const band = Math.max(6, Math.round(MOW_BAND * 16));
      for (let z = 0, i = 0; z < MH; z += band, i++) {
        g.fillStyle = i % 2 ? MOW_DARK : MOW_LIGHT;
        g.fillRect(0, z, MW, Math.min(band, MH - z));
        // the roller's own edge is never dead straight
        g.fillStyle = i % 2 ? MOW_LIGHT : MOW_DARK;
        for (let x = 0; x < MW; x += 3 + Math.floor(r() * 5)) {
          if (r() < 0.45) g.fillRect(x, z, 2 + Math.floor(r() * 3), 1);
        }
      }
      // a turn at one end of every other pass, where the mower swung round
      g.fillStyle = 'rgba(97,106,69,0.5)';
      for (let z = 0, i = 0; z < MH; z += band, i++) {
        if (i % 2) g.fillRect(MW - Math.round(1.5 * 16), z, Math.round(1.5 * 16), band);
      }
      // …and the stripes STOP where the mound takes over. A ride-on mower
      // does not stripe a rise, it goes round it, so the crest is shaggier and
      // unbanded — which is also the piece of evidence that makes the mound
      // read as a mound in plan rather than as a tonal patch.
      //
      // Painted into the field's own canvas rather than laid over it as a
      // second mesh: one texture, no coplanar decal to keep off the grass
      // (§6), no cut-out material to get wrong at midnight (§22). The field's
      // UVs run 0..1 across its own rect, so world metres convert directly —
      // and the direction of v was CHECKED rather than derived, by looking
      // straight down at the mound's south flank and at its mirror image on
      // the far side of the field: tufts on one, stripes on the other
      // (`shots/E-mound/z-south-flank.png`, `z-north-mirror.png`). A UV flip
      // would have put the unmown patch on bare grass 6 m from the mound and
      // looked entirely deliberate from every angle a player stands at.
      const uAt = (x: number) => ((x - fx0) / fW) * MW;
      const vAt = (z: number) => ((z - fz0) / fD) * MH;
      const shaggy = (cx: number, cz: number, rad: number) => {
        const px = uAt(cx), py = vAt(cz), rx = (rad / fW) * MW, ry = (rad / fD) * MH;
        g.save();
        g.beginPath();
        g.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
        g.clip();
        g.fillStyle = '#6f7750';                              // between the two greens
        g.fillRect(px - rx, py - ry, rx * 2, ry * 2);
        for (let i = 0; i < 260; i++) {                       // tufts, not bands
          g.fillStyle = r() < 0.5 ? 'rgba(124,131,88,0.55)' : 'rgba(90,99,66,0.55)';
          g.fillRect(px - rx + r() * rx * 2, py - ry + r() * ry * 2,
            2 + Math.floor(r() * 4), 2 + Math.floor(r() * 3));
        }
        g.restore();
      };
      shaggy(mndX, mndZ, 4.6);

      g.fillStyle = 'rgba(120,104,72,0.45)';                  // thin and worn
      for (let i = 0; i < 40; i++) {
        g.fillRect(Math.floor(r() * MW), Math.floor(r() * MH), 3 + Math.floor(r() * 8), 2 + Math.floor(r() * 5));
      }
      g.fillStyle = 'rgba(74,86,58,0.35)';                    // and darker where it thrives
      for (let i = 0; i < 24; i++) {
        g.fillRect(Math.floor(r() * MW), Math.floor(r() * MH), 4 + Math.floor(r() * 9), 3 + Math.floor(r() * 6));
      }
      dither(g, MW, MH, Math.round(fW * fD * 4));
    });
    const fCx = (fx0 + fx1) / 2, fCz = (fz0 + fz1) / 2;
    // 1.5 vertices per metre: enough to carry a σ 3.1 crest without faceting
    const fieldGeo = new THREE.PlaneGeometry(fW, fD, Math.round(fW * 1.5), Math.round(fD * 1.5));
    fieldGeo.rotateX(-Math.PI / 2);                    // bake it, so y is up
    const fp = fieldGeo.attributes.position;
    for (let i = 0; i < fp.count; i++) {
      fp.setY(i, relief(fp.getX(i) + fCx, fp.getZ(i) + fCz));
    }
    fp.needsUpdate = true;
    fieldGeo.computeVertexNormals();
    // …and SHADE it, because otherwise none of this is visible. Every material
    // in this world is `MeshBasicMaterial` — unlit — so a slope is exactly the
    // same colour as level ground and a 0.31 m mound reads only as a silhouette
    // you notice once you are standing on it. Walking it proved the relief was
    // there; looking at it proved you could not see it.
    //
    // So the light is baked into vertex colours: one fixed sun, one dot with
    // the vertex normal, and a deliberate ZERO at flat ground — the multiplier
    // is 1.0 exactly where the normal is straight up, so the level three
    // quarters of the field keeps the mown texture's own colour and its stripes
    // are not washed out. Only the slopes move.
    //
    // The gain is 5.5, which is not physical and is not meant to be. A 1-in-12
    // slope tilts its normal by 5°, and 5° of lambert on a mid-green is about
    // 2% — invisible. The alternative was a taller mound, and I costed it: at
    // 0.52 m the composite grade goes to 1 in 6, because the rim mask has to
    // take more height away over the same 3 m and does it with its own bank.
    // Steeper ground to make gentle ground visible is the wrong trade in a
    // world the brief calls gentle twice, so the exaggeration goes in the
    // shading, where it costs nothing underfoot.
    const nrm = fieldGeo.attributes.normal;
    // Slope is not the only cue, and on its own it is the weak one: it changes
    // with where you stand, so from the crest itself the mound mostly vanishes.
    // The one that works from every angle is what the ground does to the GRASS.
    // High ground drains and goes dry and yellow at the crown; a hollow holds
    // water and stays dark and green. That is a height tint, not a slope tint,
    // and it draws the shape of the relief in plan whether you are on it, beside
    // it or looking across it from the gate.
    const shade = new Float32Array(fp.count * 3);
    for (let i = 0; i < fp.count; i++) {
      const d = nrm.getX(i) * SUN.x + nrm.getY(i) * SUN.y + nrm.getZ(i) * SUN.z;
      const k = Math.max(0.78, Math.min(1.26, 1 + 5.5 * (d - SUN.y)));
      const h = fp.getY(i);                       // + on the mound, - in the dish
      const dry = Math.max(0, Math.min(1, h / 0.30));
      const damp = Math.max(0, Math.min(1, -h / 0.09));
      shade[i * 3] = k * (1 + 0.10 * dry - 0.09 * damp);
      shade[i * 3 + 1] = k * (1 + 0.05 * dry - 0.02 * damp);
      shade[i * 3 + 2] = k * (1 - 0.09 * dry - 0.04 * damp);
    }
    fieldGeo.setAttribute('color', new THREE.BufferAttribute(shade, 3));
    const fieldM = wet(flat(mownT));
    fieldM.vertexColors = true;
    const field = new THREE.Mesh(fieldGeo, fieldM);
    field.position.set(fCx, KERB_H + LIFT * 0.5, fCz);
    scene.add(field);
    // …and the floor picker answers the SAME function the mesh was built from,
    // through the same `parkY` the benches and the trees stand on. `crosstown.ts`
    // asks the registered grounds BEFORE its flat per-site rule, so this wins
    // inside the field and everything outside it falls through to `site.y`
    // unchanged — the paths stay level without being told anything.
    ctx.ground((x, z) => {
      if (x < fx0 || x > fx1 || z < fz0 || z > fz1) return null;
      return parkY(x, z);
    }, ORDER);
    // the bald ring under the heaviest tree in the field's corner — dry shade,
    // roots, and a mower that cannot get under the skirt of it
    const baldT = pixTex(32, 32, (g) => {
      const r = clcg(0x1a77e2);
      g.clearRect(0, 0, 32, 32);
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const d = Math.hypot(x - 16, y - 16) / 16;
        if (d > 0.92 - r() * 0.28) continue;
        const k = r();
        g.fillStyle = d > 0.6 ? (k > 0.5 ? '#6b6446' : '#77704f')
          : (k > 0.66 ? '#7d7256' : k > 0.3 ? '#6e6449' : '#615840');
        g.fillRect(x, y, 1, 1);
      }
    });
    // Draped, not lifted by one number. A 4.4 m quad offset by the relief at
    // its CENTRE is only right at its centre; this one sits where the ground
    // starts climbing toward the mound and its uphill edge was 7.5 mm INSIDE
    // the grass. Same treatment as the desire lines — subdivided and put on
    // the same function the field was built from.
    const baldX = fx0 + 3.2, baldZ = fz1 - 3.4;
    const baldG = new THREE.PlaneGeometry(4.4, 4.4, 9, 9);
    baldG.rotateX(-Math.PI / 2);
    const bp = baldG.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      bp.setY(i, relief(bp.getX(i) + baldX, bp.getZ(i) + baldZ) + LIFT * 2.0);
    }
    bp.needsUpdate = true;
    const bald = new THREE.Mesh(baldG,
      new THREE.MeshBasicMaterial({ map: baldT, alphaTest: 0.5, side: THREE.DoubleSide }));
    bald.position.set(baldX, KERB_H, baldZ);
    scene.add(bald);
  }

  // ── the desire lines ─────────────────────────────────────────────────────
  //
  // The loop is the path; these are what people do instead of walking it. Two
  // corners cut, and one straight across the field from the gate — the line
  // everyone takes when they are crossing the park rather than using it, and
  // the one piece of evidence that the loop is a choice.
  // Each line gets its OWN height in the stack. They cross each other — that is
  // what a desire-line network does — and drawn at one lift the crossings are
  // two coplanar dirt strips fighting for the same pixels. E-coplanar found the
  // pair that meet on the mound at y 0.3034, which is the sort of flicker you
  // see and cannot place. 0.4 × LIFT apart is 2.4 mm, invisible as a step and
  // decisive to the depth buffer.
  let wornN = 0;
  const worn = (x0: number, z0: number, x1: number, z1: number, w = 0.75) => {
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
    // A desire line goes OVER the mound — that is what a desire line does —
    // so it is subdivided along its length and draped on the same relief the
    // grass was displaced by, rather than laid flat and buried by it. The
    // rotations are baked into the geometry instead of set on the mesh so the
    // vertices are in world axes and can be asked for their own height.
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    // Lie the plane down, THEN turn it about the vertical. The first cut of
    // this baked `rotateZ(-atan2(dx, dz))` before `rotateX(-π/2)` — the same
    // two angles the mesh used to carry as `rotation.z` and `rotation.x` — on
    // the assumption that baking them in that order reproduces what an Euler
    // 'XYZ' mesh transform does. It does not: the line came out on the OTHER
    // DIAGONAL, running from the wrong corner, at x -32 it sat at z -83 where
    // it belonged at -78.5. Every desire line in the park fanned the wrong way
    // from the gate for as long as that was in.
    //
    // Derived rather than guessed the second time. After `rotateX(-π/2)` the
    // plane's length axis (local +y) points at world -z; turning by φ about Y
    // sends it to (-sin φ, 0, -cos φ), so the φ that lands it on (dx, dz) is
    // atan2(-dx, -dz), and there is no second angle to get wrong.
    //
    // 2 segments per metre both ways, not 1 along and 1 across: this is draped
    // on the relief and two tessellations of one curve only agree at their
    // shared vertices. A coarse strip cuts the chord under a fine field and
    // sinks into it, which looks exactly like a worn path that fades out over
    // the mound.
    const geo = new THREE.PlaneGeometry(w, len,
      Math.max(2, Math.round(w * 2)), Math.max(2, Math.round(len * 2)));
    geo.rotateX(-Math.PI / 2);
    geo.rotateY(Math.atan2(-dx, -dz));
    const wp = geo.attributes.position;
    for (let i = 0; i < wp.count; i++) {
      wp.setY(i, relief(wp.getX(i) + cx, wp.getZ(i) + cz) + LIFT * (2.5 + wornN * 0.4));
    }
    wp.needsUpdate = true;
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, wet(flat(surfaceTex(w, len, 'dirt'))));
    m.position.set(cx, KERB_H, cz);
    scene.add(m);
    wornN++;
  };
  // A NETWORK, not a line. At 7 m one shortcut was the whole story; across a
  // 26 m field one line reads as a scratch. These are the four crossings
  // anybody actually makes — gate to each far corner, gate straight through,
  // and the two corners of the loop nobody walks round.
  worn(lx1 - 0.4, gateMid, lx0 + 0.4, gateMid + 4.5, 0.55);       // straight across
  worn(lx1 - 1.2, gateMid - 1.4, lx0 + 3.0, lz0 + 5.0, 0.5);      // to the south corner
  worn(lx1 - 1.2, gateMid + 1.4, lx0 + 3.0, lz1 - 5.0, 0.5);      // and the north
  for (const sgn of [-1, 1]) {
    const cz = sgn < 0 ? lz0 : lz1;
    // THREE LINES, NOT SEVEN. A desire-line network is evidence of where people
    // go; seven of them is a ploughed field. The corner cuts nearest the gate
    // are the two anybody actually makes, so they stay and the rest go.
    if (sgn > 0) worn(lx1 - 0.9, cz - sgn * 0.9, lx1 - 2.6, cz - sgn * 2.4, 0.42);
  }

  // ── the fence ────────────────────────────────────────────────────────────
  //
  // street.ts puts a 0.62 m boundary wall along the street line with the gate
  // left open in the middle. That is an edge but it is not a room: you read a
  // low wall as something to sit on, and an iron fence as something you are
  // inside. So the railings stand ON that wall and the gate gets piers.
  //
  // COUPLING: the wall's height and thickness are street.ts's, not published,
  // and read off here as 0.62 / 0.36. If D changes them these follow.
  const WALL_H = 0.62, WALL_T = 0.36, RAIL_H = 0.95;
  const railTex = (lenM: number) => {
    const RW = Math.max(16, Math.round(lenM * 12)), RH = Math.round(RAIL_H * 12);
    return pixTex(RW, RH, (g) => {
      g.clearRect(0, 0, RW, RH);
      g.fillStyle = '#3a3f39';
      const pitch = Math.max(3, Math.round(0.17 * 12));
      for (let x = 2; x < RW; x += pitch) g.fillRect(x, 2, 2, RH - 3);
      g.fillRect(0, 0, RW, 2);                      // top rail
      g.fillRect(0, RH - 4, RW, 2);                 // bottom rail
      g.fillStyle = '#4a5049';                      // and the rust that follows
      for (let x = 2; x < RW; x += pitch * 3) g.fillRect(x, RH - 10, 2, 7);
    });
  };
  const railM = (lenM: number) => new THREE.MeshBasicMaterial({
    map: railTex(lenM), alphaTest: 0.5, side: THREE.DoubleSide,
  });
  // ct/street.ts stands its boundary wall on the PAVEMENT side of the line
  // (x -7.00…-6.64), so the railings belong at its centre — they were 0.18 m
  // inside the park, floating clear of the wall they are supposed to top.
  const RAIL_X = site.maxX + WALL_T / 2;
  for (const [rz0, rz1] of [[site.minZ + 0.3, gz0], [gz1, site.maxZ - 0.3]] as [number, number][]) {
    const len = rz1 - rz0;
    if (len <= 0.2) continue;
    const rail = new THREE.Mesh(new THREE.PlaneGeometry(len, RAIL_H), railM(len));
    rail.rotation.y = Math.PI / 2;
    rail.position.set(RAIL_X, KERB_H + WALL_H + RAIL_H / 2, (rz0 + rz1) / 2);
    scene.add(rail);
  }
  // the gate piers. Brick, not stone — this is a parks department, not a
  // civic architect, and the library is 90 m away being the other thing.
  const pierT = pixTex(16, 40, (g) => {
    const r = clcg(0x7ac91e);
    g.fillStyle = '#7a4a3a'; g.fillRect(0, 0, 16, 40);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < 40; y += 5) g.fillRect(0, y, 16, 1);
    for (let y = 0; y < 40; y += 10) for (let x = (y % 20) ? 0 : 4; x < 16; x += 9) g.fillRect(x, y, 1, 5);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 14; i++) g.fillRect(Math.floor(r() * 16), Math.floor(r() * 40), 2, 1);
    g.fillStyle = '#8a7a62'; g.fillRect(0, 0, 16, 3);            // coping
  });
  const pierM = flat(pierT);
  // ── THE SAME AUDIT B RAN ON THE FORECOURT, RUN ON THE PARK ──────────────
  //
  // The desk, after B's measurements: *"check the rest of what you own for
  // untextured flat-colour meshes, because the church forecourt and the park
  // will have the same."* They do. The memorial, the drinking fountain, the
  // copings and the kerb edging were all flat colour, and B's sentence applies
  // to every one of them: *"a flat colour is not a material... an untextured
  // quad has no grain for the eye to attach to and no joints to give it scale,
  // so it reads as a tint over the paving rather than as a piece of paving."*
  //
  // One stone canvas at the world's 32 px/m, cloned per member with its repeat
  // taken from that member's real metres. Same fix as the shelter's timber and
  // the library's steps, for the same reason.
  const PK_TILE = 1.5, PK_PX = Math.round(PK_TILE * 32);
  const stoneCanvas = (base: string, lo: string, hi: string) =>
    pixTex(PK_PX, PK_PX, (g) => {
      const r = clcg(0x3f19a2);
      g.fillStyle = base; g.fillRect(0, 0, PK_PX, PK_PX);
      for (let i = 0; i < PK_PX * PK_PX * 0.2; i++) {
        g.fillStyle = r() > 0.6 ? hi : lo;
        g.fillRect(Math.floor(r() * PK_PX), Math.floor(r() * PK_PX), 1, 1);
      }
      for (let i = 0; i < 6; i++) {                    // weathering in patches
        g.fillStyle = `rgba(72,68,56,${(0.05 + r() * 0.07).toFixed(3)})`;
        g.fillRect(Math.floor(r() * PK_PX), Math.floor(r() * PK_PX),
          4 + Math.floor(r() * 11), 3 + Math.floor(r() * 8));
      }
      dither(g, PK_PX, PK_PX, Math.round(PK_PX * PK_PX * 0.05));
    });
  const PK_STONE = stoneCanvas('#9a958a', '#8c8779', '#a9a496');
  const PK_CONC = stoneCanvas('#8a8478', '#7d786c', '#99938６'.replace('６', '6'));
  const stoneOf = (t: THREE.Texture, wM: number, hM: number) => {
    const c = t.clone();
    c.needsUpdate = true;
    c.wrapS = THREE.RepeatWrapping; c.wrapT = THREE.RepeatWrapping;
    c.repeat.set(Math.max(0.15, wM / PK_TILE), Math.max(0.15, hM / PK_TILE));
    return flat(c);
  };
  const capM = stoneOf(PK_STONE, 1.0, 0.3);
  for (const gz of [gz0, gz1]) {
    const px = inside(0.35), dir = gz === gz0 ? -1 : 1;   // cap included
    const pier = new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.62, 0.56), pierM);
    pier.position.set(px, KERB_H + 0.81, gz + dir * 0.28);
    scene.add(pier);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.13, 0.7), capM);
    cap.position.set(px, KERB_H + 1.69, gz + dir * 0.28);
    scene.add(cap);
    solid({ minX: px - 0.28, maxX: px + 0.28, minZ: gz + dir * 0.28 - 0.28, maxZ: gz + dir * 0.28 + 0.28 });
    // the leaf, standing open against the railing the way a park gate does
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.15), railM(1.2));
    leaf.rotation.y = Math.PI / 2;
    leaf.position.set(px - 0.62, KERB_H + 0.6, gz + dir * 0.86);
    scene.add(leaf);
  }

  // ── what you find once you are in ────────────────────────────────────────
  //
  // Four things, and all of them face INTO the park rather than out at the
  // traffic. A bench turned to the street is a bus stop; a bench turned to
  // the path is a park. That is most of the difference between this and the
  // 30 m of pavement outside it.
  const woodM = new THREE.MeshBasicMaterial({ color: 0x5c4a33 });
  const woodM2 = new THREE.MeshBasicMaterial({ color: 0x51402c });
  const ironM = new THREE.MeshBasicMaterial({ color: 0x39403a });
  const concM = stoneOf(PK_CONC, 0.5, 1.1);          // the drinking fountain

  // Benches: heavy cast ends and slatted seat and back, the pattern every
  // parks department in America bolted down and never replaced. They stand
  // along the spine, facing it, which is the only thing there is to look at.
  //
  // SITTABLE, through `ctx.seat` — the user's *"for every seat in the game i
  // want to be able to sit down"*, and F's registration means this needs
  // nothing from the desk. The seat pan is 0.45 above the park floor, and the
  // trigger sits on the seat with the approach out on the path, because the
  // bench's own collider would otherwise keep you further away than `r`.
  // Benches face the FIELD, with their backs to the perimeter — the whole
  // point of the loop is that there is something to look at from it. A bench
  // turned to the street is a bus stop.
  //
  // SITTABLE, through `ctx.seat` — the user's *"for every seat in the game i
  // want to be able to sit down"*, and F's registration means this needs
  // nothing from the desk. The trigger sits ON the pan with its approach out
  // on the path, because the bench's own collider would otherwise hold you
  // further away than `r`.
  const bench = (bx: number, bz: number, yaw: number) => {
    // ── REBUILT, AFTER B'S BUS BENCH ─────────────────────────────────────────
    //
    // The user: *"THE BENCH LOOKS AWFUL: the backrest is a separate panel
    // floating behind and above the seat, not joined to it — it reads as three
    // disconnected pieces rather than a bench."* Exactly what it was: two seat
    // slats at one height, two back slats at another, and a pair of cast ends
    // that touched neither. Three things in a row is not a bench.
    //
    // B rebuilt the bus bench over four passes and the two lessons are in
    // ct/props.ts in as many words:
    //
    //   RECLINE. *"Dead vertical is why it read as a board rather than a seat —
    //     nothing you would actually lean on is at 90 degrees."* 12° here too.
    //   PIVOT AT THE FOOT, NOT THE CENTRE. *"the joint with the seat is the
    //     thing a recline most easily opens up, and rotating about the seat's
    //     back edge means the two cannot separate no matter what angle is
    //     chosen."* So the back's geometry is translated up before it is
    //     rotated, and its origin sits exactly on the seat's back edge.
    //
    // And the third thing that makes it one object rather than three: the cast
    // ends are an L — a leg under the seat and a stile that RISES BEHIND IT to
    // carry the back. That is what a park bench end actually is, and it is the
    // piece that was missing, so nothing had anything to be attached to.
    //
    // Built in local coordinates in a group and turned once, instead of the old
    // axis-by-axis arithmetic: one rotation, applied to everything, so no part
    // can drift out of line with another.
    const g = new THREE.Group();
    const L = 1.72, SEAT_Y = 0.45, SEAT_D = 0.46;
    const RECLINE = 0.21, BACK_LEN = 0.44;
    const put = (m: THREE.Object3D, x: number, y: number, z: number) => {
      m.position.set(x, y, z); g.add(m); return m;
    };
    // the two cast ends: leg, seat rail, and the stile that carries the back
    for (const sx of [-1, 1]) {
      const ex = sx * (L / 2 - 0.05);
      put(new THREE.Mesh(new THREE.BoxGeometry(0.09, SEAT_Y, SEAT_D * 0.9), ironM),
        ex, SEAT_Y / 2, 0.02);                                  // the leg
      put(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, SEAT_D + 0.06), ironM),
        ex, SEAT_Y + 0.02, 0.0);                                // the seat rail
      const stile = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, BACK_LEN + 0.06, 0.07), ironM);
      stile.position.set(ex, SEAT_Y + (BACK_LEN + 0.06) / 2 * Math.cos(RECLINE),
        -SEAT_D / 2 - (BACK_LEN + 0.06) / 2 * Math.sin(RECLINE));
      stile.rotation.x = -RECLINE;                              // leans with the back
      g.add(stile);
    }
    // the seat: three slats, front to back
    for (let i = 0; i < 3; i++) {
      const z = SEAT_D / 2 - 0.09 - i * 0.165;
      put(new THREE.Mesh(new THREE.BoxGeometry(L, 0.05, 0.15), i % 2 ? woodM2 : woodM),
        0, SEAT_Y + 0.055, z);
    }
    // the back: its own group, origin ON the seat's back edge, then reclined —
    // so the joint cannot open however the angle is chosen
    const back = new THREE.Group();
    for (let i = 0; i < 2; i++) {
      const geo = new THREE.BoxGeometry(L, 0.155, 0.05);
      const sl = new THREE.Mesh(geo, i % 2 ? woodM2 : woodM);
      sl.position.set(0, 0.10 + i * 0.20, 0);
      back.add(sl);
    }
    back.position.set(0, SEAT_Y + 0.03, -SEAT_D / 2);
    back.rotation.x = -RECLINE;
    g.add(back);
    const y0 = Math.min(parkY(bx, bz), parkY(bx + Math.cos(yaw) * 0.8, bz + Math.sin(yaw) * 0.8),
      parkY(bx - Math.cos(yaw) * 0.8, bz - Math.sin(yaw) * 0.8));
    g.position.set(bx, y0, bz);
    g.rotation.y = yaw;
    scene.add(g);
    const along = Math.abs(Math.round(Math.cos(yaw)));
    const hx = along ? L / 2 : SEAT_D, hz = along ? SEAT_D : L / 2;
    solid({ minX: bx - hx, maxX: bx + hx, minZ: bz - hz, maxZ: bz + hz });
    // THE FACING, named so it cannot collide with anything outside. The rewrite
    // dropped the old locals `fx`/`fz` and this line kept using them — so `fx`
    // silently resolved to the FOUNTAIN's `fx`, declared 90 lines further down.
    // It typechecked, threw `Cannot access 'fx' before initialization` at build
    // time, and world.ts caught it per-module — so the park lost every object
    // after the benches: the fountain, the memorial, the shelter, the trees and
    // the shrubs. A green typecheck and a park with no trees in it.
    // +cos, not -cos. THE NINTH ORIENTATION BUG, and the one GOTCHAS 27 was
    // written for: this world's forward is (sin yaw, cos yaw) — `E-benchface`
    // uses it, the shelter's hand-set approach agrees with it, and the seat
    // yaws come from `facingIn`, which is atan2 in that same order. With the
    // sign flipped the APPROACH landed behind the bench, so the way to sit
    // down was to walk round the back of it.
    //
    // It hid because it only shows where cos(yaw) rounds to ±1: the four
    // benches on the park's z sides. The five on the x sides have cos ≈ 0,
    // faceZ rounds to 0 either way, and they were always right. Four of nine
    // wrong is exactly the "verify each instance rather than assuming the
    // mirror" half of the rule — and on ONE of the four there is a collider
    // behind the bench, which is the user's *"cannot sit on a bench"*.
    const faceX = Math.round(Math.sin(yaw)), faceZ = Math.round(Math.cos(yaw));
    ctx.seat({
      x: bx, z: bz, yaw, h: 0.45,
      approach: { x: bx + faceX * 0.95, z: bz + faceZ * 0.95 },
      label: 'sit on the bench',
    });
  };
  // A RUN of benches, not a token few. The park went from 7 m deep to 32 —
  // five times the area — and the furniture did not scale with it, which is
  // the whole reason it read as a yard with a bench in it. They stand along
  // the loop at roughly 9 m, close enough that there is always one in view
  // and far enough that two are never in the same shot.
  //
  // The run is stepped off the gate rather than off the end of the park, and
  // it SKIPS the entry: the first cut of this walked a bench straight into the
  // gate opening at z = -83 and you could not get in. GOTCHAS §8 — anything
  // near a way in has to treat the approach as reserved space.
  // THE DRINKING FOUNTAIN'S FOOTPRINT, declared before the benches are laid
  // out so they can be tested against it. The user: *"THE BENCH CLIPS THE
  // DRINKING FOUNTAIN: its right end and backrest pass straight through the
  // pale plinth. Measure box against box and separate them."* Both stand on the
  // street leg at x -11.95 and -12.08, so a bench whose z lands near the
  // fountain's runs straight through it. Measured and filtered below rather
  // than nudged by hand, so it stays true if either of them moves.
  const FOUNT_X = lx1 + PATH_W / 2 + 0.55, FOUNT_Z = gateMid - 4.2;
  const FOUNT = { minX: FOUNT_X - 0.42, maxX: FOUNT_X + 0.42,
    minZ: FOUNT_Z - 0.42, maxZ: FOUNT_Z + 0.42 };
  const BENCH_HALF = 0.86, BENCH_DEEP = 0.46;        // half-length, and depth each way
  const clearOfFountain = (bx: number, bz: number, yaw: number) => {
    const along = Math.abs(Math.round(Math.cos(yaw)));  // 1 if the bench runs in x
    const hx = along ? BENCH_HALF : BENCH_DEEP, hz = along ? BENCH_DEEP : BENCH_HALF;
    return bx + hx < FOUNT.minX - 0.12 || bx - hx > FOUNT.maxX + 0.12
      || bz + hz < FOUNT.minZ - 0.12 || bz - hz > FOUNT.maxZ + 0.12;
  };
  // ── WHICH WAY A BENCH FACES IS DERIVED, NEVER TYPED ──────────────────────
  //
  // The user, on the eighth orientation bug of the session: *"the park's
  // path-side benches have their BACKS toward the path, so a person sitting on
  // them faces AWAY from the park... a bench beside a park path faces INTO the
  // park — at the field, the trees, the shelter — and its back is to the fence.
  // That is not just correct, it is the whole reason the bench is there."*
  //
  // GOTCHAS §27: derive facing from what the object should FACE, never from a
  // constant. Every bench had its yaw typed as a literal — `-Math.PI / 2`,
  // `Math.PI`, `0` — chosen by hand for each leg, which is four chances to get
  // it wrong and no way to be told that you did. And I did get it wrong, in the
  // most instructive way: rebuilding the bench moved its local front from -z to
  // +z, which silently REVERSED every bench whose yaw was not ±π/2. The
  // literals were still there, still looked deliberate, and now meant the
  // opposite of what they had.
  //
  // So the yaw comes from the geometry: the bench faces the middle of the loop,
  // wherever the bench is and however the loop is re-cut. A bench added on a
  // side that does not exist yet cannot come out backwards, because nothing
  // about its direction is written down.
  const loopCx = (lx0 + lx1) / 2, loopCz = (lz0 + lz1) / 2;
  const facingIn = (bx: number, bz: number): [number, number, number] =>
    // the bench's local +z is its front, so this is the yaw that points +z at
    // the park's interior
    [bx, bz, Math.atan2(loopCx - bx, loopCz - bz)];
  const benchRun: [number, number, number][] = [];
  const clearOfGate = (z: number) => Math.abs(z - gateMid) > 2.6;
  const spaced = (from: number, to: number, step: number) => {
    const out: number[] = [];
    for (let v = from; v <= to + 0.01; v += step) out.push(v);
    return out;
  };
  // The run was stepped from `gateMid - 26.4`, which is 11 m south of the
  // park: the first two iterations fell outside it and were filtered away, so
  // a 27 m leg got TWO benches and the back leg got none, because its push
  // sat under the gate's `continue`. Counting the registered seats is what
  // showed it — eight in a park with a 110 m circuit. Both legs are stepped
  // over their own length now.
  for (const z of spaced(lz0 + 4.0, lz1 - 4.0, 9.2)) {
    if (clearOfGate(z)) benchRun.push(facingIn(lx1 + PATH_W / 2 + 0.42, z));
    benchRun.push(facingIn(lx0 - PATH_W / 2 - 0.42, z));
  }
  for (const x of spaced(lx0 + 4.5, lx1 - 4.5, 9.4)) {
    benchRun.push(facingIn(x, lz0 - 1.05));
    benchRun.push(facingIn(x, lz1 + 1.05));
  }
  for (const [bx, bz, yaw] of benchRun) {
    if (!clearOfFountain(bx, bz, yaw)) continue;      // it would stand in the fountain
    bench(bx, bz, yaw);
  }
  // The mound gets the one thing worth walking off the path for: a tree, and a
  // bench under it turned to face back down the slope at the gate. This is the
  // whole argument for the relief — off the circuit, up 0.45 m, with a view of
  // where you came in — and it is only worth anything if there is a reason to
  // stand on it.
  bench(mndX + 2.1, mndZ + 0.4, Math.PI / 2);

  // The drinking fountain. Municipal, chipped, and it has not worked in
  // years — which is the same sentence as the library, and on purpose.
  // OUTSIDE the loop, in the planted band. Everything here used to sit "just
  // inside the leg", which was against the boundary; with the loop 6 m in,
  // the same offsets would have stood it in the middle of the open field.
  const fx = lx1 + PATH_W / 2 + 0.55, fz = gateMid - 4.2;
  const fPed = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.86, 0.34), concM);
  fPed.position.set(fx, KERB_H + 0.43, fz);
  scene.add(fPed);
  const fBowl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.44), concM);
  fBowl.position.set(fx, KERB_H + 0.93, fz);
  scene.add(fBowl);
  const fBasin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.26), new THREE.MeshBasicMaterial({ color: 0x4e5a52 }));
  fBasin.position.set(fx, KERB_H + 1.0, fz);
  scene.add(fBasin);
  const fSpout = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.06), ironM);
  fSpout.position.set(fx + 0.15, KERB_H + 1.05, fz);
  scene.add(fSpout);
  solid({ minX: fx - 0.3, maxX: fx + 0.3, minZ: fz - 0.28, maxZ: fz + 0.28 });

  // The bin, by the gate where the litter actually is
  const binT = pixTex(8, 14, (g) => {
    g.fillStyle = '#333a2b'; g.fillRect(0, 0, 8, 14);
    g.fillStyle = '#4e5340';
    for (const x of [1, 3, 5]) g.fillRect(x, 2, 1, 10);
    g.fillRect(0, 3, 8, 1); g.fillRect(0, 10, 8, 1);
    g.fillStyle = '#2b3226'; g.fillRect(0, 0, 8, 2); g.fillRect(0, 12, 8, 2);
  });
  // ── planting ─────────────────────────────────────────────────────────────
  //
  // The rear elevation IS the view from the gate at this depth — 13 m of
  // blank brick 7 m away — and the only thing that can be done about it
  // until the park is deepened is to break its base. There is exactly 0.75 m
  // between the back leg of the loop and the wall, so the hedge is 0.65 deep
  // and lives entirely in it. Its collider stops you 0.36 m short, which is
  // beside the path and not on it — walked, not assumed.
  //
  // It is a privet hedge that nobody has cut square in years: it runs in
  // lengths with gaps where bits have died out, and it is taller at one end
  // than the other. What this actually wants is TREES along the back, which
  // are ct/props.ts and builder B's — asked for through the desk rather than
  // reached into (GOTCHAS §2: the seeded stream's order is load-bearing).
  const shrubT = pixTex(16, 16, (g) => {
    const r = clcg(0x3ea77c);
    g.fillStyle = '#3f5232'; g.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 90; i++) {
      const k = r();
      g.fillStyle = k > 0.62 ? '#4e6440' : k > 0.3 ? '#374a2c' : '#2b3a23';
      g.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1 + Math.floor(r() * 2), 1);
    }
  });
  const shrubM = flat(shrubT);
  const rb = clcg(0x11d0ee);
  const hedgeX = site.minX + 0.33;                  // 0.65 deep against the wall
  for (let z = site.minZ + 1.2; z < site.maxZ - 1.2;) {
    const run = 3.0 + rb() * 4.0;
    const end = Math.min(z + run, site.maxZ - 1.2);
    const h = 1.5 + rb() * 0.55;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.65, h, end - z), shrubM);
    seg.position.set(hedgeX, KERB_H + h / 2, (z + end) / 2);
    scene.add(seg);
    solid({ minX: site.minX, maxX: site.minX + 0.7, minZ: z, maxZ: end });
    z = end + 0.9 + rb() * 1.6;                     // the gaps where it died out
  }
  // and a shrub in each corner by the railings, where the mower never reaches
  for (const cz of [site.minZ + 0.62, site.maxZ - 0.62]) {
    const h = 1.1 + rb() * 0.7, w = 0.82;
    const sh = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), shrubM);
    sh.position.set(lx1 - 0.2, KERB_H + h / 2, cz);
    // Same plant, same licence to merge as a run's own blocks: when the flank
    // runs were extended to the street end they grew over these two, and what
    // that actually looks like is one lumpier corner shrub — this one is
    // taller than the run, so it still breaks the top line.
    sh.userData.massed = true;
    scene.add(sh);
    solid({ minX: lx1 - 0.2 - w / 2, maxX: lx1 - 0.2 + w / 2, minZ: cz - w / 2, maxZ: cz + w / 2 });
  }

  // Bins where the benches are, because that is where the litter is.
  // bins beside the benches at BOTH ends of the park, not just the street end
  // ── NOTHING STANDS INSIDE ANYTHING ELSE ──────────────────────────────────
  //
  // The user has found three of these by eye: the bench through the fountain,
  // the bin inside the noticeboard, and a tree inside the shelter. Three is a
  // class, not three accidents, so this is a rule rather than a third nudge —
  // *"Measure box against box."*
  //
  // Every prop that stands on the ground registers its footprint here as it is
  // placed, and anything placed afterwards is tested against the ones already
  // down. The bin and the noticeboard are the case that shows why it was
  // needed: `inside(0.23)` and `inside(0.28)` put them 0.05 m apart in x, so
  // any bin whose z lands near the board's is inside it — and nothing in the
  // code said so, because each was placed correctly against the KERB and
  // neither knew about the other.
  // Declared HERE, above the registry that tests against it, rather than beside
  // the mesh that draws it 25 lines further down. `claim(nbX…)` referencing it
  // from up here would otherwise be a temporal dead zone — the exact fault that
  // silently emptied this module of trees earlier today, and one I am not
  // repeating in the fix for it.
  const nbX = inside(0.28), nbZ = gateMid - 2.6;
  const footprints: AABB[] = [];
  const claim = (minX: number, maxX: number, minZ: number, maxZ: number) => {
    const box = { minX, maxX, minZ, maxZ };
    for (const q of footprints) {
      if (box.maxX <= q.minX + 0.02 || box.minX >= q.maxX - 0.02) continue;
      if (box.maxZ <= q.minZ + 0.02 || box.minZ >= q.maxZ - 0.02) continue;
      return false;                                   // it would stand in something
    }
    footprints.push(box);
    return true;
  };
  claim(nbX - 0.4, nbX + 0.4, nbZ - 0.75, nbZ + 0.75);   // the noticeboard, first
  const binAt: [number, number][] = [
    [inside(0.23), gateMid + 3.2], [inside(0.23), lz0 + 6.0],
    [inside(0.23), lz1 - 6.0], [inside(0.23), gateMid - 12.5],
    [lx1 - 14.5, lz0 - 1.5], [lx1 - 18.0, lz1 + 1.5],
    [lx0 + 4.8, gateMid + 2.0],          // by the shelter at the far end
  ];
  for (const [bx2, bz] of binAt) {
    if (!claim(bx2 - 0.3, bx2 + 0.3, bz - 0.3, bz + 0.3)) continue;
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.8, 0.46), flat(binT));
    b2.position.set(bx2, KERB_H + 0.4, bz);
    scene.add(b2);
    solid({ minX: bx2 - 0.26, maxX: bx2 + 0.26, minZ: bz - 0.26, maxZ: bz + 0.26 });
  }

  // The noticeboard at the gate. Every municipal park has one and nothing on
  // it is current: a byelaws plate nobody reads and the ghost of a poster.
  const nbT = pixTex(28, 20, (g) => {
    g.fillStyle = '#2e3a2c'; g.fillRect(0, 0, 28, 20);
    g.fillStyle = '#cfc9b8'; g.fillRect(2, 2, 24, 15);
    g.fillStyle = '#8d8878';
    for (let y = 5; y < 15; y += 2) g.fillRect(4, y, 20, 1);
    g.fillStyle = '#6a6456'; g.fillRect(4, 3, 20, 2);
    g.fillStyle = 'rgba(120,110,80,0.5)'; g.fillRect(15, 7, 9, 8);
  });
  // Grouped for the same reason as the memorial: a panel BOLTED to two posts
  // has to bite into them, and the sweep should be reading that as one
  // noticeboard rather than as the very fault it was written to catch.
  const board = new THREE.Group();
  const nb = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.72, 1.0), flat(nbT));
  nb.position.set(nbX, KERB_H + 1.28, nbZ);
  board.add(nb);
  for (const d of [-0.4, 0.4]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.6, 0.09), ironM);
    post.position.set(nbX, KERB_H + 0.8, nbZ + d);
    board.add(post);
  }
  scene.add(board);
  solid({ minX: nbX - 0.3, maxX: nbX + 0.3, minZ: nbZ - 0.55, maxZ: nbZ + 0.55 });

  // ── the loop, edged ──────────────────────────────────────────────────────
  //
  // A municipal path has an edging strip holding the grass off it, and
  // without one the loop's edges dissolve into the field at any distance.
  // Same granite as the frontage kerb, laid flat rather than proud.
  const edgeM = stoneOf(PK_STONE, 2.0, 0.14);        // the path edging
  const edging = (x0: number, x1: number, z0: number, z1: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1 - x0), 0.07, Math.abs(z1 - z0)), edgeM);
    m.position.set((x0 + x1) / 2, KERB_H + 0.035, (z0 + z1) / 2);
    scene.add(m);
  };
  for (const lx of [lx0, lx1]) {
    for (const d of [-1, 1]) edging(lx + d * PATH_W / 2 - 0.06, lx + d * PATH_W / 2 + 0.06, lz0, lz1);
  }
  for (const lz of [lz0, lz1]) {
    for (const d of [-1, 1]) edging(lx0, lx1, lz + d * PATH_W / 2 - 0.06, lz + d * PATH_W / 2 + 0.06);
  }

  // ── ivy on the walls ─────────────────────────────────────────────────────
  //
  // Three blank brick flanks are what make it a yard, and the trees that
  // would really break them up are ct/props.ts and builder B's. What this
  // file CAN do is grow ivy up them: alpha-tested patches with a ragged top
  // edge, at different heights, so the wall reads as an old boundary rather
  // than as a new one. It does not fix the yard on its own — see
  // notes/BLOCKED-E.md — but it is the half that is mine.
  const ivyT = (seed: number, wM: number, hM: number) => {
    const IW = Math.max(16, Math.round(wM * 6)), IH = Math.max(16, Math.round(hM * 6));
    return pixTex(IW, IH, (g) => {
      const r = clcg(seed);
      g.clearRect(0, 0, IW, IH);
      for (let x = 0; x < IW; x++) {
        const top = Math.round(IH * (0.12 + 0.5 * Math.abs(Math.sin(x * 0.21 + seed))));
        for (let y = top; y < IH; y++) {
          if (y < top + 3 && r() < 0.45) continue;          // a ragged growing edge
          const k = r();
          g.fillStyle = k > 0.68 ? '#4a6238' : k > 0.34 ? '#3b5130' : '#2e4126';
          g.fillRect(x, y, 1, 1);
        }
      }
    });
  };
  const ivy = (x: number, z: number, wM: number, hM: number, ry: number, seed: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wM, hM), new THREE.MeshBasicMaterial({
      map: ivyT(seed, wM, hM), alphaTest: 0.5, side: THREE.DoubleSide,
    }));
    m.position.set(x, hM / 2, z);
    m.rotation.y = ry;
    scene.add(m);
  };
  const iv = clcg(0x5b1ea2);
  for (let z = site.minZ + 2; z < site.maxZ - 2;) {          // the back wall
    const w2 = 4 + iv() * 5;
    ivy(site.minX + 0.06, z + w2 / 2, w2, 6.0 + iv() * 4.0, Math.PI / 2, 0x31 + Math.round(z));
    z += w2 + 1 + iv() * 3;
  }
  for (const [zAt, ry] of [[site.minZ + 0.06, 0], [site.maxZ - 0.06, Math.PI]] as [number, number][]) {
    for (let x = site.minX + 2; x < site.maxX - 4;) {        // and the two flanks
      const w2 = 4 + iv() * 5;
      ivy(x + w2 / 2, zAt, w2, 5.0 + iv() * 3.5, ry, 0x77 + Math.round(x));
      x += w2 + 2 + iv() * 4;
    }
  }

  // ── the one thing to look at ─────────────────────────────────────────────
  //
  // A park needs a reason to walk round it, and it goes where the loop turns
  // so that the turn is the reason. A borough war memorial: two steps, a
  // plinth with a plaque nobody has read in years, and a stone shaft. It is
  // the most municipal object there is, it is the right period, and it gives
  // the loop a destination that is not the gate you came in by.
  // outside the loop's north-east turn, so the corner has a reason to be
  // there and the field is not intruded on
  const memX = lx1 + 2.4, memZ = lz1 + 2.4;
  const stoneA = stoneOf(PK_STONE, 1.2, 1.2);        // the memorial
  const stoneB = stoneOf(PK_CONC, 1.2, 1.2);
  for (const [i, w2] of [[0, 2.4], [1, 1.9]] as [number, number][]) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(w2, 0.18, w2), i % 2 ? stoneB : stoneA);
    st.position.set(memX, KERB_H + 0.09 + i * 0.18, memZ);
    scene.add(st);
  }
  const plinthT = pixTex(16, 20, (g) => {
    const r = clcg(0x2f81aa);
    g.fillStyle = '#928c80'; g.fillRect(0, 0, 16, 20);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = r() > 0.5 ? '#9c968a' : '#857f74';
      g.fillRect(Math.floor(r() * 16), Math.floor(r() * 20), 1, 1);
    }
    g.fillStyle = '#6e6a5e'; g.fillRect(3, 6, 10, 8);            // the plaque
    g.fillStyle = 'rgba(210,204,188,0.35)';
    for (let y = 8; y < 13; y += 2) g.fillRect(4, y, 8, 1);
    g.fillStyle = 'rgba(46,38,30,0.25)';                          // and its weather
    for (let i = 0; i < 10; i++) g.fillRect(Math.floor(r() * 16), 14, 1, Math.round(r() * 6));
  });
  // ONE GROUP, because it is one object. A plinth, a shaft standing on it and
  // a cap over the shaft's top are supposed to interpenetrate — masonry is cut
  // to sit INTO the course below, not balanced on it. Loose in the scene they
  // read to `E-overlap` as three props inside each other, and that noise is
  // what let a real bin-inside-a-noticeboard hide in the same list.
  const memorial = new THREE.Group();
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.3, 1.15), flat(plinthT));
  plinth.position.set(memX, KERB_H + 0.36 + 0.65, memZ);
  memorial.add(plinth);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.62, 2.5, 0.62), stoneA);
  shaft.position.set(memX, KERB_H + 1.66 + 1.25, memZ);
  memorial.add(shaft);
  const capStone = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), stoneB);
  capStone.position.set(memX, KERB_H + 4.12, memZ);
  memorial.add(capStone);
  scene.add(memorial);
  solid({ minX: memX - 1.25, maxX: memX + 1.25, minZ: memZ - 1.25, maxZ: memZ + 1.25 });

  // ── hoop rail, and a shelter at the far end ─────────────────────────────
  //
  // The auditor's *"bare lawn"* is fair about the MIDDLE, not the edges: the
  // trees broke the walls, but between them lay 25 m of undifferentiated
  // grass, and a field with no edge and nothing beyond it reads as a vacant
  // lot however well it is mown. Two things fix that without closing the
  // field, which the user asked to be the largest thing in the park:
  //
  //   HOOP RAIL along the field side of the loop. The most municipal object
  //     there is — bent bar, knee high, half of them leaning. It gives the
  //     grass an edge and it draws the loop's line away into the distance,
  //     which is what tells you how deep the park is. No collider: a hoop is
  //     something you step over, and a knee-high wall you cannot cross would
  //     be worse than none.
  //   A SHELTER on the gate's axis at the far end, 26 m away, terminating the
  //     view. The memorial gives the near turn a destination; this gives the
  //     deep half one, and it is the thing you walk the loop to reach.
  const hoopM = new THREE.MeshBasicMaterial({ color: 0x3d4239 });
  const hoop = (x: number, z: number, alongZ: boolean, lean: number) => {
    const w = 0.58, h = 0.29;
    for (const d of [-w / 2, w / 2]) {                  // two legs
      const leg = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? 0.05 : 0.05, h, 0.05), hoopM);
      leg.position.set(x + (alongZ ? 0 : d), KERB_H + h / 2, z + (alongZ ? d : 0));
      leg.rotation.x = alongZ ? 0 : lean;
      leg.rotation.z = alongZ ? lean : 0;
      scene.add(leg);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? 0.05 : w, 0.05, alongZ ? w : 0.05), hoopM);
    top.position.set(x, KERB_H + h, z);
    top.rotation.z = lean;
    scene.add(top);
  };
  const hp = clcg(0x64bb17);
  for (const [lx, side] of [[lx0, 1], [lx1, -1]] as [number, number][]) {
    // 0.72 m apart, not 1.15. THE GREY CHEVRONS THE USER ASKED ABOUT are
    // these: a run of low iron hoop edging, the municipal thing that keeps feet
    // off the grass. At 1.15 m centres each hoop stands alone against the turf
    // and reads as a bracket somebody dropped — which is exactly what was
    // reported, and a fair reading of it. Closed up, the run reads as one piece
    // of edging, which is what a hoop rail is.
    for (let z = lz0 + 1.2; z < lz1 - 1.2; z += 0.72) {
      hoop(lx + side * (PATH_W / 2 + 0.25), z, true, (hp() - 0.5) * 0.22);
    }
  }
  for (const [lz, side] of [[lz0, 1], [lz1, -1]] as [number, number][]) {
    for (let x = lx0 + 1.2; x < lx1 - 1.2; x += 0.72) {
      hoop(x, lz + side * (PATH_W / 2 + 0.25), false, (hp() - 0.5) * 0.22);
    }
  }

  // the shelter: four posts, a pitched roof, a bench in it, and the paint
  // going. Municipal, and the one thing at the far end worth walking to.
  // 3.0 m off the back leg, not 2.6: at 2.6 the west posts blocked to
  // x = -35.28 and the path's east edge is -35.05, so the shelter stood in
  // the loop. It is a destination beside the path, never on it.
  // beyond the back leg on the gate's axis: still the thing that terminates
  // the view from the gate, now standing in the band rather than the field
  const shX = lx0 - 3.4, shZ = gateMid;
  // Textured rather than flat-coloured, under A's density mandate: this is a
  // 4 m roof and a set of 2.5 m posts, the largest plain surfaces I own, and a
  // 16 x 16 map of felt and sawn grain costs nothing.
  //
  // It is NOT here to fix the night. I thought it was: the shelter reads as
  // the brightest thing in the park at 22:30, I sampled `material.color` at
  // both clocks, saw a plain 0x4a4e56 come back 0x4f5050, and concluded that
  // `dimWorld` was REPLACING the colour of untextured materials rather than
  // multiplying it — which would have made every flat-coloured material in the
  // world glow, and I had a note written for the desk saying so.
  //
  // It is wrong. `props.ts` stamps `userData.graded` on everything it takes,
  // and every one of these materials carries it; the model keeps each
  // material's own colour as `base` and multiplies. What is actually
  // happening is `POOL_GAIN 12` from a lamp head 3.7 m away — the shelter
  // stands between two of them — which saturates any surface that close,
  // whatever its colour. The 0x4a4e56 → 0x4f5050 reading was the lamp, not a
  // tint. Left here because a wrong reading of a real measurement is worth
  // more written down than deleted.
  const tim = clcg(0x51a7c3);
  /** A 2 m tile, and every member repeats it by its own REAL METRES.
   *
   *  §5, which I broke this morning in the act of citing the density mandate.
   *  A 16 px map with no repeat is one tile stretched over whatever face it
   *  lands on, so the density falls out of the member's size and is different
   *  for every one: measured on what I had shipped, 4.0 px/m across the roof
   *  slope and 114 px/m up the front plate, against the world's WALL_PPM of 8.
   *  Fine detail plus a stretch is worse than no detail — it is grain that
   *  changes scale between two pieces of the same shelter.
   *
   *  16 px over 2 m is exactly 8 px/m, so the repeat is just metres / 2. The
   *  texture is cloned rather than rebuilt: `repeat` lives on the Texture, not
   *  the material, and a clone shares the image. Box faces all take one repeat,
   *  so it is set from the face that is actually seen — the narrow ones here
   *  are 0.14–0.16 m and carry no detail anybody can resolve (§4).
   */
  const TILE_M = 2.0;
  const tiled = (t: THREE.Texture, wM: number, hM: number) => {
    const c = t.clone();
    c.needsUpdate = true;
    c.wrapS = THREE.RepeatWrapping; c.wrapT = THREE.RepeatWrapping;
    c.repeat.set(wM / TILE_M, hM / TILE_M);
    return flat(c);
  };
  const postT = pixTex(16, 16, (g) => {
    g.fillStyle = '#5a4a34'; g.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 26; i++) {                        // sawn timber grain
      g.fillStyle = tim() < 0.5 ? 'rgba(74,60,42,0.55)' : 'rgba(104,88,64,0.4)';
      g.fillRect(0, Math.floor(tim() * 16), 16, 1);
    }
    dither(g, 16, 16, 26);
  });
  const roofT = pixTex(16, 16, (g) => {
    g.fillStyle = '#4a4e56'; g.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 30; i++) {                        // felt, patched and worn
      g.fillStyle = tim() < 0.45 ? 'rgba(58,62,70,0.6)' : 'rgba(88,92,100,0.35)';
      g.fillRect(Math.floor(tim() * 16), Math.floor(tim() * 16),
        1 + Math.floor(tim() * 3), 1 + Math.floor(tim() * 2));
    }
    dither(g, 16, 16, 30);
  });
  const postM = tiled(postT, 0.16, 2.5);                  // the four uprights
  const plateM = tiled(postT, 3.6, 0.14);                 // the wall plate, front
  const endPlateM = tiled(postT, 2.14, 0.14);             // …and the ends, which
                                                          // are a different length
                                                          // and so a different repeat
  const roofM = tiled(roofT, 4.0, 1.45);                  // a slope
  const ridgeM = tiled(roofT, 4.0, 0.34);
  // ── THE SHELTER, THIRD AND LAST ATTEMPT ─────────────────────────────────
  //
  // Ruled on by the desk after two failures: *"EITHER build it as one simple
  // honest structure — four posts of identical square section on a square plan,
  // ONE hipped roof that sits ON the post tops with even overhang on all four
  // sides, and a bench centred under it — OR delete the shelter entirely...
  // If you go for the roof, build it as a single mesh rather than assembling
  // slabs, because assembling slabs is what has failed twice."*
  //
  // Taking the roof, and taking the instruction literally, because the
  // instruction is a diagnosis of my two failures and it is correct. Both times
  // I assembled the roof out of positioned boxes, and both times the pieces
  // ended up at angles to each other and off the frame — a slab I place at a
  // rotation is a slab I can place wrongly, and I did, twice.
  //
  // THE ROOF IS ONE BufferGeometry. A hip on a square plan is four triangles
  // from the eaves to a single apex, and the apex is ONE VERTEX shared by all
  // four — so the slopes cannot be at different angles to each other and cannot
  // float apart, because there is nothing to hold apart. The eaves ring is four
  // quads in the same buffer, giving the roof real thickness at its edge, and
  // every vertex is derived from the post positions rather than typed. It sits
  // on the post tops by construction: the eaves are AT post-top height.
  //
  // Square plan, identical posts, bench centred. Nothing else.
  const SH_H = 1.55;                           // half the square plan, post centres
  // 0.22, not 0.18. The user's word was "spindly", and 0.18 m of section
  // carrying 2.4 m is 13:1 — right at the edge where a post stops reading as
  // something holding a roof up and starts reading as a stick.
  const SH_POST = 0.22;
  const SH_TOP = 2.40;                         // post top, and the eaves
  const SH_OVER = 0.42;                        // even, all four sides
  const SH_RISE = 0.95;                        // apex above the eaves
  // 0.24, not 0.14. The other half of "a thin skewed slab": a roof seen from
  // outside is mostly its EDGE, and a 0.14 m fascia at 4 m reads as a knife
  // edge — which is what a parasol has and a roof does not.
  const SH_SKIRT = 0.24;                       // the eaves' own depth
  const E = SH_H + SH_OVER;
  // Posts, pads and roof are ONE shelter. Now that the eaves correctly wrap
  // down over the post tops, that seating shows up as four prop-on-prop
  // overlaps in `E-overlap` — the fix reading as the fault it fixed.
  const shelterG = new THREE.Group();
  for (const dx of [-SH_H, SH_H]) for (const dz of [-SH_H, SH_H]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(SH_POST, SH_TOP, SH_POST), postM);
    post.position.set(shX + dx, KERB_H + SH_TOP / 2, shZ + dz);
    shelterG.add(post);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(SH_POST + 0.16, 0.10, SH_POST + 0.16), plateM);
    pad.position.set(shX + dx, KERB_H + 0.05, shZ + dz);
    shelterG.add(pad);
    solid({ minX: shX + dx - SH_POST / 2, maxX: shX + dx + SH_POST / 2,
      minZ: shZ + dz - SH_POST / 2, maxZ: shZ + dz + SH_POST / 2 });
  }
  {
    // THE ROOF HAS TO TOUCH THE POST TOPS, and the first two attempts did not.
    //
    // Putting the eaves at the post-top height LOOKS right in the source and
    // is wrong in the world: the eaves are at the OVERHANG radius E, the posts
    // stand inboard at SH_H, and the slope has already climbed by the time it
    // gets there. Measured, that left the underside 0.20 m clear of all four
    // posts — the roof floating over them, which is exactly the "thin skewed
    // slab that does not sit on its posts" the user has now said twice.
    //
    // A hipped roof's rafters cross the wall plate and keep going DOWN past
    // it, so the eaves hang below the post top rather than level with it. So
    // fix the slope from the apex through the post top and let the overhang
    // fall where it falls: at r = SH_H the surface is exactly SH_TOP.
    const ya = SH_TOP + SH_RISE;
    const y1 = SH_TOP - (SH_RISE / SH_H) * SH_OVER;
    const y0 = y1 - SH_SKIRT;
    const c = [[-E, -E], [E, -E], [E, E], [-E, E]];      // the four eaves corners
    const pos: number[] = [], uv: number[] = [];
    const push = (x: number, y: number, z: number, u: number, v: number) => {
      pos.push(x, y, z); uv.push(u, v);
    };
    for (let i = 0; i < 4; i++) {
      const [ax, az] = c[i], [bx, bz] = c[(i + 1) % 4];
      // the eaves skirt, so the roof has an edge you can see rather than a
      // paper rim
      push(ax, y0, az, 0, 0); push(bx, y0, bz, 1, 0); push(bx, y1, bz, 1, 1);
      push(ax, y0, az, 0, 0); push(bx, y1, bz, 1, 1); push(ax, y1, az, 0, 1);
      // and the slope up to the shared apex
      push(ax, y1, az, 0, 0); push(bx, y1, bz, 1, 0); push(0, ya, 0, 0.5, 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
    geo.computeVertexNormals();
    // FOUR FACES THE SAME COLOUR IS NOT A PYRAMID, IT IS AN UMBRELLA.
    //
    // Seating the roof on the posts fixed the geometry and it still read as a
    // parasol, because a hipped roof's whole form is that its faces catch the
    // light differently — and under `MeshBasicMaterial` nothing does that for
    // you. Flat tone across all four slopes gives a silhouette with no
    // interior, which the eye files as fabric.
    //
    // The buffer is non-indexed, so `computeVertexNormals` has already left
    // each triangle's three vertices carrying that triangle's own normal:
    // shading per vertex here IS shading per face. Same sun and the same
    // clamped-lambert shape the field uses, so the two agree.
    const nrm = geo.attributes.normal;
    const shade = new Float32Array(pos.length);
    for (let i = 0; i < nrm.count; i++) {
      const d = nrm.getX(i) * SUN.x + nrm.getY(i) * SUN.y + nrm.getZ(i) * SUN.z;
      const k = Math.max(0.70, Math.min(1.22, 0.90 + 0.60 * d));
      shade[i * 3] = k; shade[i * 3 + 1] = k; shade[i * 3 + 2] = k * 0.99;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(shade, 3));
    const shadedRoofM = roofM.clone();          // not the shared slope material
    shadedRoofM.vertexColors = true;
    const roof = new THREE.Mesh(geo, shadedRoofM);
    roof.position.set(shX, KERB_H, shZ);
    shelterG.add(roof);
    scene.add(shelterG);
  }
  // one bench, centred under it, facing out of the park's approach
  // …and it faces INTO THE PARK, like every other bench. It ran along x and
  // faced down the wall, which the per-instance facing check caught at dot 0.00
  // — square to the park rather than away from it, which is why looking at it
  // had not shown it up. The shelter stands at the park's west end, so the
  // interior is +x: the bench runs in z and faces east.
  const SB_L = SH_H * 2 - 0.55;
  for (let i = 0; i < 3; i++) {
    const sl = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, SB_L), i % 2 ? woodM2 : woodM);
    sl.position.set(shX - 0.17 + i * 0.17, KERB_H + 0.45, shZ);
    scene.add(sl);
  }
  for (const dz of [-1, 1]) {
    const end = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.45, 0.12), ironM);
    end.position.set(shX, KERB_H + 0.225, shZ + dz * (SB_L / 2 - 0.06));
    scene.add(end);
  }
  solid({ minX: shX - 0.32, maxX: shX + 0.32,
    minZ: shZ - SB_L / 2 - 0.1, maxZ: shZ + SB_L / 2 + 0.1 });
  // …AND YOU CAN SIT ON IT. Eleven benches on the loop take [E] and the one
  // destination the loop exists for did not — you walk 26 m to the thing that
  // terminates the axis and it turns out to be scenery. It was the only bench
  // in the park built by hand rather than through `bench()`, which is exactly
  // how it missed the registration every other one gets for free.
  //
  // Facing +z, out of the open side toward the park, and the approach point is
  // 0.95 m in front of the slats — INSIDE the shelter but clear of the bench's
  // own collider, which ends at shZ - 0.4. A collider eats the [E] trigger it
  // sits on (§8), so the corridor you press it from has to be outside the box.
  ctx.seat({
    x: shX, z: shZ, yaw: Math.atan2(loopCx - shX, loopCz - shZ), h: 0.45,
    approach: { x: shX + 1.05, z: shZ },
    label: 'sit in the shelter',
  });

  // ── the trees ────────────────────────────────────────────────────────────
  //
  // *"bare lawn, three blank brick walls"* — and this is what fixes the walls.
  // Ivy softened their base; only a canopy standing in front of them breaks
  // them, and at 32 m deep a token few reads as no trees at all. This is a
  // RUN: every ~6 m along all three boundaries, and a second line inside the
  // loop's street leg so the open middle is framed rather than merely empty.
  //
  // These are the PARK's trees and they live here, not in ct/props.ts. B owns
  // the STREET trees — the billboard cutouts that turn to face you — and a
  // park tree is stood in, walked under and seen from every side, so it is
  // three crossed alpha panels that do NOT turn. A billboard would spin as
  // you walked round it, which at this size is the difference between a tree
  // and a poster of a tree.
  //
  // No `rnd()`: the seeded stream's order is load-bearing (GOTCHAS §2) and
  // every tree height in the world hangs off it. These carry their own LCG.
  const leafT = (seed: number) => pixTex(24, 24, (g) => {
    const r = clcg(seed);
    g.clearRect(0, 0, 24, 24);
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 24; x++) {
        const dx = (x - 12) / 12, dy = (y - 11) / 12;
        if (Math.hypot(dx, dy * 1.15) > 0.92 + (r() - 0.5) * 0.3) continue;
        const k = r(), edge = Math.hypot(dx, dy * 1.15) > 0.62;
        g.fillStyle = edge ? (k > 0.5 ? '#4a6238' : '#3d5330')
          : (k > 0.62 ? '#3b5130' : k > 0.28 ? '#2f4326' : '#26361f');
        g.fillRect(x, y, 1, 1);
      }
    }
  });
  // BARK, not a brown column. The flat-colour audit the desk asked for caught
  // the stone — the memorial, the fountain, the copings, the edging — and I
  // stopped there. The tree trunks are the most-seen vertical surface in the
  // park, one is in nearly every frame of it, and they were a single brown with
  // no grain at all. B's sentence applies to a trunk exactly as it does to a
  // paving slab: with nothing for the eye to attach to it reads as a tint.
  //
  // Vertical fissures, because that is what bark is at this distance: broken
  // dark runs down the length of it with the odd pale one, and no horizontal
  // detail to fight the trunk's own direction.
  const barkT = pixTex(16, 48, (g) => {
    const r = clcg(0x2b8d41);
    g.fillStyle = '#4a3d2e'; g.fillRect(0, 0, 16, 48);
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(r() * 16), y = Math.floor(r() * 48);
      const len = 5 + Math.floor(r() * 18), w = 1 + (r() < 0.25 ? 1 : 0);
      g.fillStyle = r() < 0.62 ? '#3b3124' : '#584a37';
      g.fillRect(x, y, w, Math.min(len, 48 - y));
    }
    for (let i = 0; i < 5; i++) {                       // a few pale weathered runs
      g.fillStyle = 'rgba(126,112,88,0.30)';
      g.fillRect(Math.floor(r() * 16), Math.floor(r() * 48), 1, 6 + Math.floor(r() * 12));
    }
    dither(g, 16, 48, 60);
  });
  const barkM = (() => {
    const t = barkT.clone();
    t.needsUpdate = true;
    t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 2.2);                               // ~3 m of trunk per tile
    return flat(t);
  })();
  const tree = (x: number, z: number, seed: number) => {
    const t2 = clcg(seed);
    const h = 6.6 + t2() * 2.8, spread = 4.4 + t2() * 2.0, trunk = 2.6 + t2() * 1.0;
    const gy = parkY(x, z);                           // a tree on the mound too
    const tk = new THREE.Mesh(new THREE.BoxGeometry(0.3, trunk + 0.6, 0.3), barkM);
    tk.position.set(x, gy + (trunk + 0.6) / 2, z);
    scene.add(tk);
    const mat = new THREE.MeshBasicMaterial({
      map: leafT(seed), alphaTest: 0.5, side: THREE.DoubleSide,
    });
    for (let i = 0; i < 3; i++) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(spread, h - trunk), mat);
      pl.position.set(x, gy + trunk + (h - trunk) / 2, z);
      pl.rotation.y = (i * Math.PI) / 3;
      scene.add(pl);
    }
    solid({ minX: x - 0.2, maxX: x + 0.2, minZ: z - 0.2, maxZ: z + 0.2 });
  };
  const tsd = clcg(0x2c9f41);
  // The back line stands BEHIND the loop's back leg, not on it. At
  // site.minX + 2.0 its trunks blocked to x = -35.74 and the path centre is
  // -35.80, so the back leg could not be walked — found the day the clamp
  // lifted and the leg could be walked for the first time. Same fault the
  // flank lines had. 1.4 m off the wall clears the path by 0.7 m.
  // …and the back line skips the shelter, which stands in front of it. A trunk
  // was rising through the roof — the third prop-on-prop overlap the user found
  // by eye, and the reason the rule above exists.
  for (let z = site.minZ + 2.2; z < site.maxZ - 2.0; z += 5.4 + tsd() * 1.4) {
    const tx = site.minX + 1.4 + tsd() * 0.4;
    if (Math.abs(tx - shX) < 2.6 && Math.abs(z - shZ) < 2.6) continue;
    tree(tx, z, 0x400 + Math.round(z * 3));                              // the back wall
  }
  // INBOARD of the loop's end legs, not against the flank walls: the first
  // cut planted them at site.maxZ - 2.0, which is inside the north end leg's
  // 1.5 m width, and the loop stopped being walkable. 1.7 m inside the path
  // still reads as a boundary line and still breaks the wall behind it.
  // The mound's own tree, out in the open middle beside the bench — the one
  // tree in the park that is not part of a boundary line. It stands where the
  // ground is highest, which is how you read a mound as a mound from the gate:
  // by something on top of it being higher than everything around it.
  tree(mndX - 0.7, mndZ - 0.6, 0xE01);
  for (const zAt of [lz0 + 1.7, lz1 - 1.7]) {                            // both flanks
    for (let x = site.minX + 5.5; x < lx1 - 1.5; x += 5.8 + tsd() * 1.6) {
      tree(x, zAt + (zAt < gateMid ? -tsd() * 0.5 : tsd() * 0.5), 0x800 + Math.round(x * 3));
    }
  }
  for (let z = lz0 + 3.0; z < lz1 - 3.0; z += 7.2 + tsd() * 2.0) {       // framing the field
    if (Math.abs(z - gateMid) < 4.5) continue;                           // the entry stays open
    tree(lx1 + 3.4, z, 0xC00 + Math.round(z * 3));
  }

  // ── THE SHRUB LAYER ──────────────────────────────────────────────────────
  //
  // The user, on a review frame: *"SHRUBS ON THE EDGES... the boundary is trees
  // standing in front of bare brick with nothing at their feet. Real park edges
  // have a shrub layer under the trees — it is what hides the base of a wall and
  // makes a boundary read as planting rather than as a fence of trunks. Low
  // massed shrubs along the walls, varied in height, denser where the wall is
  // blankest."*
  //
  // Exactly right, and the back wall already had a privet hedge for the same
  // reason — it was the two FLANKS that were bare, which is where the review
  // frame was looking. Three rules out of that sentence:
  //
  //   LOW AND MASSED, not a row of identical bushes. Each run is 2-5 m long and
  //     built of two or three boxes of different heights and depths, so the top
  //     line is broken and the face is not flat.
  //   DENSER WHERE THE WALL IS BLANKEST. Density is driven by distance to the
  //     nearest tree: in the gaps between trunks the runs are longer, taller and
  //     closer together, and where a tree already breaks the wall they thin out.
  //     That is what "denser where the wall is blankest" asks for, and it is a
  //     rule rather than a hand-placed guess.
  //   AND THEY LEAVE THEIR FEET ALONE. C's weed tuft is coming and the desk has
  //     asked that the shrub layer and the tufts work together, so the runs are
  //     held 0.15 m off the wall and are not sealed to the ground — there is a
  //     line at the base for weeds to sit in rather than a skirting board.
  const flankTreeX: number[] = [];
  for (let x = site.minX + 5.5; x < lx1 - 1.5; x += 5.8 + tsd() * 1.6) flankTreeX.push(x);
  // A SHRUB IS NOT A BOX. Each run was one slab with a flat top and square
  // ends, which against faceted trees and stepped conifers read as a green
  // crate — the same fault as the shelter roof in a different material. Real
  // massed planting has a BROKEN TOP LINE, so each run is built from three or
  // four blocks of different heights and depths, stepping along, with the ends
  // dropping away. One collider for the whole run, because you should not be
  // able to walk into the middle of a bush.
  const shrubRun = (cx: number, cz: number, len: number, h: number, depth: number,
    alongX: boolean) => {
    const n = 3 + Math.floor(sb() * 2);
    const seg = len / n;
    for (let i = 0; i < n; i++) {
      // taller in the middle of a run, lower at its ends — how a clump grows
      const mid = 1 - Math.abs((i + 0.5) / n - 0.5) * 2;
      const hi = h * (0.62 + mid * 0.30 + sb() * 0.16);
      const di = depth * (0.78 + sb() * 0.3);
      const off = (i + 0.5) * seg - len / 2;
      const w = alongX ? seg * (0.9 + sb() * 0.25) : di;
      const d = alongX ? di : seg * (0.9 + sb() * 0.25);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, hi, d), shrubM);
      m.position.set(alongX ? cx + off : cx + (sb() - 0.5) * 0.12,
        KERB_H + hi / 2,
        alongX ? cz + (sb() - 0.5) * 0.12 : cz + off);
      // Blocks in a run are MEANT to interpenetrate — that overlap is what
      // makes a run read as one massed shrub instead of a row of crates, and
      // the ends of adjacent runs merge for the same reason. `E-overlap`
      // counted every one of them and reported 23 hits of which none was a
      // fault, which is a sweep that cannot answer the question it exists for.
      m.userData.massed = true;
      scene.add(m);
    }
    const w = alongX ? len : depth, d = alongX ? depth : len;
    solid({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
  };
  const sb = clcg(0x7ac41f);
  for (const [wallZ, inward] of [[site.minZ, 1], [site.maxZ, -1]] as [number, number][]) {
    // TO THE STREET END, not to the loop. The first cut stopped at `lx1`, the
    // loop's street leg — so the last 6 m of both flank walls, the stretch you
    // stand in front of when you walk through the gate, had none. The user
    // looked at exactly that stretch and said there were no shrubs, and they
    // were right about the part of the park they could see.
    let x = site.minX + 1.0;
    while (x < site.maxX - 1.4) {
      // how blank is the wall here? distance to the nearest tree along this flank
      const gap = Math.min(...flankTreeX.map((tx) => Math.abs(tx - x)), 99);
      const blank = Math.min(1, gap / 3.2);              // 0 under a tree, 1 in the open
      const len = 2.0 + blank * 3.0 + sb() * 1.2;
      const h = 0.55 + blank * 0.55 + sb() * 0.35;       // 0.55-1.45 m, taller in the open
      const depth = 0.7 + blank * 0.5 + sb() * 0.3;
      const cz = wallZ + inward * (0.15 + depth / 2);    // 0.15 clear of the brick
      shrubRun(x + len / 2, cz, len, h, depth, true);
      // a second, lower mass in front of about half of them, so the layer has a
      // front edge that is not a straight line
      if (sb() < 0.55) {
        const h2 = h * (0.45 + sb() * 0.25), d2 = depth * 0.6;
        shrubRun(x + len * (0.25 + sb() * 0.4), cz + inward * (depth / 2 + d2 / 2 - 0.1),
          len * (0.4 + sb() * 0.35), h2, d2, true);
      }
      x += len + (0.3 + (1 - blank) * 2.2 + sb() * 0.8);  // gaps open up under the trees
    }
  }

  // ── WEEDS, WHERE NOBODY STRIMS ───────────────────────────────────────────
  //
  // The user: *"grass sprouting through cracked paving... in the cracks and
  // joints of the path, thicker at its edges where the mower cannot reach;
  // along the base of the boundary walls...; around the feet of the lamp posts,
  // the memorial and the bench legs, where nothing is ever strimmed... Vary the
  // density — heaviest at edges and against verticals, absent from the middle
  // of the path where feet keep it clear. That contrast between a worn clean
  // centre and a weedy edge is the whole effect."*
  //
  // C's `weedTuft` draws them; this places them. Not a second tuft — the look
  // lives in one file so a fix to it fixes every caller, which is the same
  // reason `citizenSprite` is one call for a person.
  //
  // The last sentence of that brief is the design: **nothing goes in the middle
  // of a path.** Every run below seeds its two EDGES and leaves the centre
  // alone, because the effect is the contrast and a tuft in the walking line
  // would destroy it. Height comes off `parkY`, never remembered — the file's
  // own docs say to ask, and the park's ground is not flat any more.
  const wsd = clcg(0x5eed11);
  // TONE BY C'S RULE, not by eye. weeds.ts: `dry` is for ground that is PALER
  // OR GREENER than the tuft, `dark` for asphalt and shadow. Every surface a
  // tuft stands on in this park — the new buff hoggin at #9c8b66 and the site's
  // grey slab — is DARKER than the dry palette's mid #a2955a, so `dark` is the
  // one that separates by hue instead of laying straw on straw. I had them all
  // on `dry` first and they read as a hay crop down both edges of the path.
  const tuft = (x: number, z: number, tone: 'dark' | 'dry' = 'dark', scale = 1) => {
    scene.add(weedTuft({ x, z, y: parkY(x, z), tone, scale,
      seed: Math.floor(wsd() * 1e6) }));
  };
  // ── CLUMPS, NOT A DOTTED LINE ────────────────────────────────────────────
  //
  // The user: *"the weed tufts along the park path are EVENLY SPACED and all
  // the same size, so they read as a dotted line rather than as plants...
  // VARIATION, RANDOM PLACING, CLUSTERING."* All three were missing and the
  // third is the one that matters:
  //
  //   *"weeds do not distribute evenly OR uniformly at random, they grow in
  //   CLUMPS where a seed landed and spread... A metre of nothing followed by a
  //   dense patch of five looks natural; one every 80 cm never will."*
  //
  // That is exactly right and it is also a warning about the obvious fix: my
  // first pass stepped `t += per + rnd*0.55`, which is evenly-spaced-plus-noise
  // and still reads as a row, because jitter moves a tuft off the beat without
  // ever leaving a bare metre. So the run is not walked at all now. A small
  // number of CLUMP CENTRES are drawn along it, each gets a handful of tufts
  // with a tight falloff, and the gaps between clumps are whatever the draw
  // leaves — sometimes nothing, sometimes three metres.
  //
  // Variation comes from three places, because scale alone still reads as one
  // plant photocopied: `scale` runs 0.55-1.45 with a few deliberately large,
  // `seed` is different per tuft so C's tuft turns and leans differently, and
  // one in six takes the other tone so the green is not uniform.
  //
  // On the seeded stream: these draw from `wsd`, a local LCG of my own, NOT the
  // shared `rnd()`. The desk's warning is about appending draws to the world
  // stream and shifting everything downstream of them; a private stream cannot
  // do that from any position in the file, which is why the park has used one
  // since it was written.
  const clump = (x: number, z: number, n: number, spread: number) => {
    for (let i = 0; i < n; i++) {
      // tight falloff: most of the clump sits inside a third of its spread
      const r = spread * Math.pow(wsd(), 1.8);
      const a2 = wsd() * Math.PI * 2;
      const big = wsd() < 0.13;
      tuft(x + Math.cos(a2) * r, z + Math.sin(a2) * r,
        wsd() < 0.17 ? 'dry' : 'dark',
        big ? 1.15 + wsd() * 0.3 : 0.55 + wsd() * 0.5);
    }
  };
  /** both edges of a straight run, in clumps, and never its middle */
  const tuftEdges = (ax: number, az: number, bx: number, bz: number,
    half: number, per = 3.4) => {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.5) return;
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    const nx = -uz, nz = ux;
    // how many clumps this run gets, then WHERE they fall is drawn — not
    // stepped. Two can land close together and leave four metres bare, which
    // is the thing that reads as planting rather than as spacing.
    const n = Math.max(1, Math.round(len / per));
    for (const sgn of [-1, 1]) {
      for (let i = 0; i < n; i++) {
        const t = 0.4 + wsd() * (len - 0.8);
        const off = half - 0.02 - wsd() * 0.26;
        clump(ax + ux * t + nx * sgn * off, az + uz * t + nz * sgn * off,
          2 + Math.floor(wsd() * 5), 0.34 + wsd() * 0.3);
      }
    }
  };
  const HALF = PATH_W / 2;
  tuftEdges(lx0, lz0 + CHAM, lx0, lz1 - CHAM, HALF);                    // back leg
  tuftEdges(lx1, lz0 + CHAM, lx1, lz1 - CHAM, HALF);                    // street leg
  for (const lz of [lz0, lz1]) tuftEdges(lx0 + CHAM, lz, lx1 - CHAM, lz, HALF);
  tuftEdges(site.maxX - 0.6, gateMid, lx1 + HALF, gateMid, 0.95, 2.4);  // the gate spur
  // the chamfered corners: the outside of a turn is where a mower gives up
  for (const [cx, cz, sx, sz] of [[lx0, lz0 + CHAM, 1, -1], [lx0, lz1 - CHAM, 1, 1],
    [lx1, lz0 + CHAM, -1, -1], [lx1, lz1 - CHAM, -1, 1]] as [number, number, number, number][]) {
    tuftEdges(cx, cz, cx + sx * CHAM, cz + sz * CHAM, HALF, 2.0);
  }
  // ALONG THE FOOT OF THE WALLS, which is also where the shrub layer stands —
  // the desk asked that the two work together, so these sit in front of the
  // shrubs rather than under them, in the line left clear for exactly this.
  // the wall feet, clumped the same way — a stepped loop here would put the
  // dotted line back along three more edges
  for (const [wallZ, inward] of [[site.minZ, 1], [site.maxZ, -1]] as [number, number][]) {
    const runX = (lx1 + 1.0) - (site.minX + 1.0);
    for (let i = 0; i < Math.round(runX / 2.6); i++) {
      clump(site.minX + 1.0 + wsd() * runX, wallZ + inward * (0.10 + wsd() * 0.3),
        2 + Math.floor(wsd() * 5), 0.36 + wsd() * 0.3);
    }
  }
  const runZ2 = (site.maxZ - 1.0) - (site.minZ + 1.0);
  for (let i = 0; i < Math.round(runZ2 / 2.6); i++) {
    clump(site.minX + 0.10 + wsd() * 0.3, site.minZ + 1.0 + wsd() * runZ2,
      2 + Math.floor(wsd() * 5), 0.36 + wsd() * 0.3);
  }
  // AND AGAINST EVERY VERTICAL — nothing is ever strimmed round a post.
  // against a vertical, weeds bank on ONE side rather than ringing it evenly —
  // whichever side the mower turns away from. So a ring is drawn as one or two
  // clumps on an arc, not as n points round a circle.
  const around = (x: number, z: number, r: number, n: number) => {
    const side = wsd() * Math.PI * 2;
    for (let k = 0; k < 1 + (wsd() < 0.45 ? 1 : 0); k++) {
      const a = side + k * (1.6 + wsd());
      clump(x + Math.cos(a) * r, z + Math.sin(a) * r,
        Math.max(2, Math.round(n / 2)), 0.26 + wsd() * 0.2);
    }
  };
  around(memX, memZ, 1.15, 7);                                   // the memorial plinth
  around(fx, fz, 0.75, 5);                                       // the fountain
  for (const dx of [-1.6, 1.6]) for (const dz of [-1.15, 1.15]) around(shX + dx, shZ + dz, 0.2, 2);
  for (const [bx, bz] of benchRun) around(bx, bz, 0.95, 3);      // every bench's feet

  // ── signs of use ─────────────────────────────────────────────────────────
  //
  // *"come at this with some more life and energy"* — and life in a park like
  // this one is not ornament, it is EVIDENCE that people are here when you
  // are not. A park with nothing dropped in it reads as a model of a park.
  // All of it lies flat as a decal (GOTCHAS §3: a billboard would stand on
  // end the moment you looked down) except the trolley, which is the joke.
  const litterT = (seed: number, kind: 'paper' | 'can' | 'leaves') => pixTex(16, 16, (g) => {
    const r = clcg(seed);
    g.clearRect(0, 0, 16, 16);
    if (kind === 'paper') {
      g.fillStyle = '#cfc9b4';
      for (let i = 0; i < 5; i++) g.fillRect(3 + Math.floor(r() * 8), 4 + Math.floor(r() * 8), 3 + Math.floor(r() * 3), 2);
      g.fillStyle = 'rgba(120,112,92,0.55)'; g.fillRect(5, 8, 6, 1);
    } else if (kind === 'can') {
      g.fillStyle = '#9aa2a6'; g.fillRect(6, 6, 5, 3);
      g.fillStyle = '#7a3e3c'; g.fillRect(6, 7, 5, 1);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(6, 9, 5, 1);
    } else {
      for (let i = 0; i < 22; i++) {
        const k = r();
        g.fillStyle = k > 0.6 ? '#6a5a32' : k > 0.3 ? '#7b6a3c' : '#54492a';
        g.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1 + Math.floor(r() * 2), 1);
      }
    }
  });
  const drop = (x: number, z: number, sz: number, kind: 'paper' | 'can' | 'leaves', seed: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz), new THREE.MeshBasicMaterial({
      map: litterT(seed, kind), alphaTest: 0.5, side: THREE.DoubleSide,
    }));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = seed;
    // above the whole decal stack, not in the middle of it: the desire lines now
    // reach LIFT × 5.3 and litter dropped at 1.5 sank into the ones it lay on
    m.position.set(x, parkY(x, z) + LIFT * 6.0, z);
    scene.add(m);
  };
  const lr = clcg(0x7c1de3);
  for (let i = 0; i < 14; i++) {                       // blown against the kerbs
    const along = lr();
    const z = site.minZ + 2 + along * (W - 4);
    const x = lr() < 0.55 ? lx1 + PATH_W / 2 + 0.2 + lr() * 0.9 : lx1 - PATH_W / 2 - 0.3 - lr() * 3.5;
    drop(x, z, 0.3 + lr() * 0.25, lr() < 0.45 ? 'paper' : 'can', 0x100 + i * 7);
  }
  for (let i = 0; i < 9; i++) {                        // leaf drift in the corners
    const cx = lr() < 0.5 ? site.minX + 1.6 + lr() * 3 : lx1 - lr() * 3;
    const cz = lr() < 0.5 ? site.minZ + 1.6 + lr() * 4 : site.maxZ - 1.6 - lr() * 4;
    drop(cx, cz, 1.1 + lr() * 0.9, 'leaves', 0x200 + i * 11);
  }

  // A trolley from the supermarket that is not on this block, on its side in
  // the grass. Nobody in the parks department is coming for it.
  const trolleyM = new THREE.MeshBasicMaterial({ color: 0x9aa0a4 });
  const meshT = pixTex(12, 10, (g) => {
    g.clearRect(0, 0, 12, 10);
    g.fillStyle = '#9aa0a4';
    for (let x = 0; x < 12; x += 3) g.fillRect(x, 0, 1, 10);
    for (let y = 0; y < 10; y += 3) g.fillRect(0, y, 12, 1);
  });
  const tx = lx0 + 3.4, tz = gateMid - 7.5;
  for (const [dx, dz, ry] of [[0, 0, 0], [0.42, 0, 0], [0.21, 0.3, Math.PI / 2]] as [number, number, number][]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.42), new THREE.MeshBasicMaterial({
      map: meshT, alphaTest: 0.5, side: THREE.DoubleSide,
    }));
    side.position.set(tx + dx, KERB_H + 0.21, tz + dz);
    side.rotation.y = ry;
    scene.add(side);
  }
  for (const [wx2, wz2] of [[-0.2, -0.18], [0.55, -0.18]] as [number, number][]) {
    const wheel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.05), trolleyM);
    wheel.position.set(tx + wx2, KERB_H + 0.33, tz + wz2);
    scene.add(wheel);
  }
  solid({ minX: tx - 0.35, maxX: tx + 0.75, minZ: tz - 0.35, maxZ: tz + 0.5 });

  return { colliders };
}
