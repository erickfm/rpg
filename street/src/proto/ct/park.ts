import * as THREE from 'three';
import type { AABB } from '../fp';
// DERIVED, NOT RETYPED (BUILDER-BRIEF §8). `BENCH_CLEAR` below is built out of
// the player's own collision radius and the world's smallest meaningful gap, so
// re-tuning either steps every bench in the park back with it. `fp.ts` imports
// only three and a type, so this cannot make a cycle — `no-import-cycles` is
// registered and green on it.
import { RADIUS, TOUCH_MARGIN } from '../fp';
import { BUILD, type CtxBuild, type Site } from './ctx';
import { pixTex, dither, declareSurface } from './paint';
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

// RE-EXPORTED, NOT REDECLARED. This was a third hand-typed copy of `Site` —
// ct/ctx.ts has the real one and ct/street.ts carries a structural twin for
// `openSite`'s own return — and the copies had already drifted: `Site` grew a
// `displace` member for item 172 and this one silently did not, so `buildPark`
// was handed a site whose ground it could move and could not see the handle.
// The typecheck caught it; nothing else would have.
export type { Site };

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
  // THE PATHS GO THROUGH A's `slabTex`. This is a CHARACTER swap, not a fix for
  // a bare quad — the paths have been textured since park.ts:140 and the
  // complaint was never that they had no texture, it was that they read as
  // ROAD. `slabTex` keeps the colour I already chose (A measured worst channel
  // drift of 1 to 4 across three real cases) and replaces hand-rolled speckle
  // with grain at the world's density, which is what gives a surface scale.
  //
  // `joint: 0` because hoggin has no joints — it is gravel rolled into clay,
  // not slabs — and `grain: 0.18` reads as that aggregate rather than as
  // stone. The dirt branch keeps its own painter: it draws the grass creeping
  // in at the edges, which is a thing about worn ground and not about paving.
  //
  // …and `grain: 0.18` was over `slabTex`'s own 0.14 pebble threshold, so on
  // top of the speckle it laid 2 px STONES at full contrast. That is the
  // confetti in the frame the user called awful: bright chips scattered evenly
  // over a flat pale field, which is the look of terrazzo, not of earth.
  //
  // ONE WRAPPED CANVAS FOR THE WHOLE LOOP, not a bespoke one per piece.
  // Everything that reads as path — the circuit, the gate spur, the shelter
  // apron — samples this same 4 m tile through WORLD-METRE UVs, so the grain is
  // continuous across every join and every corner instead of each rectangle
  // carrying its own independently-rolled noise that stops dead at its edge.
  // The tile is drawn wrapped (every mark repeated across both seams) so it
  // repeats invisibly.
  const PATH_TILE = 4;                              // metres per repeat
  let loopTexCache: THREE.Texture | null = null;
  const loopTex = () => {
    // ONE texture object, shared by every path surface. It can be shared
    // because the UVs are world metres and the repeat is 1 — nothing is scaled
    // per mesh, so there is nothing per mesh to hold.
    if (loopTexCache) return loopTexCache;
    const S = PATH_TILE * 32;                       // 128 px, the world's density
    const t = pixTex(S, S, (g) => {
      const r = clcg(0x51c0a7);
      g.fillStyle = PATH; g.fillRect(0, 0, S, S);
      /** paint a mark and its wraps, so the tile has no seam */
      const wrapped = (x: number, y: number, w: number, h: number) => {
        for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) g.fillRect(x + dx, y + dy, w, h);
      };
      // THREE SCALES, and it needs all three. A ground texture that carries
      // only one is what reads as a pattern rather than as a place: the old one
      // had a single scale (1 px pepper) and my first pass at this had a single
      // scale (5 px mottle) and both went flat at ten paces for the same
      // reason. Metre-scale first, so the path is not one tone down its length.
      for (let i = 0; i < 16; i++) {
        g.fillStyle = r() < 0.68 ? `rgba(104,92,66,${(0.07 + r() * 0.09).toFixed(3)})`
                                 : `rgba(186,172,138,${(0.05 + r() * 0.06).toFixed(3)})`;
        wrapped(Math.floor(r() * S), Math.floor(r() * S),
          16 + Math.floor(r() * 26), 12 + Math.floor(r() * 22));
      }
      // hand-scale mottle: rolled clay with gravel in it, weighted DARK. The
      // first pass weighted it light and the path came out the colour of sand.
      for (let i = 0; i < 120; i++) {
        g.fillStyle = r() < 0.72 ? `rgba(118,104,74,${(0.12 + r() * 0.16).toFixed(3)})`
                                 : `rgba(190,176,142,${(0.05 + r() * 0.09).toFixed(3)})`;
        wrapped(Math.floor(r() * S), Math.floor(r() * S), 3 + Math.floor(r() * 7), 2 + Math.floor(r() * 5));
      }
      // the aggregate, and mostly on the DARK side. The bright chips at full
      // contrast are what sparkled — grit you read as texture and never as
      // dots is what a gravel path actually gives you at this density.
      for (let i = 0; i < Math.round(S * S * 0.055); i++) {
        g.fillStyle = r() > 0.42 ? PATH_D : 'rgba(120,106,76,0.6)';
        g.fillRect(Math.floor(r() * S), Math.floor(r() * S), 1, 1);
      }
      // a very few pale ones, so it is not uniformly dark grit either
      for (let i = 0; i < Math.round(S * S * 0.006); i++) {
        g.fillStyle = `rgba(179,163,124,${(0.30 + r() * 0.25).toFixed(2)})`;
        g.fillRect(Math.floor(r() * S), Math.floor(r() * S), 1, 1);
      }
      dither(g, S, S, Math.round(S * S * 0.02));
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    loopTexCache = t;
    return t;
  };
  const surfaceTex = (wM: number, dM: number, kind: 'path' | 'dirt') => {
    if (kind === 'path') return loopTex();
    const PW = Math.max(8, Math.round(wM * 32)), PH = Math.max(8, Math.round(dM * 32));
    return pixTex(PW, PH, (g) => {
      const r = clcg(0x2b7f31);
      g.fillStyle = DIRT;
      g.fillRect(0, 0, PW, PH);
      // the aggregate: hoggin is gravel rolled into clay, so it reads as
      // speckle at two scales rather than as a flat colour
      for (let i = 0; i < Math.round(PW * PH * 0.02); i++) {
        const k = r();
        g.fillStyle = k > 0.6 ? DIRT_D : DIRT;
        g.fillRect(Math.floor(r() * PW), Math.floor(r() * PH), 1 + Math.floor(r() * 2), 1);
      }
      // …and the edges go first: grass creeps in from both sides in patches
      g.fillStyle = 'rgba(96,104,78,0.55)';
      for (let i = 0; i < Math.round(PH * 0.5); i++) {
        const y = Math.floor(r() * PH), d = 1 + Math.floor(r() * 4);
        if (r() < 0.5) g.fillRect(0, y, d, 1 + Math.floor(r() * 3));
        else g.fillRect(PW - d, y, d, 1 + Math.floor(r() * 3));
      }
      if (kind === 'dirt') {
        // A WORN PATH HAS NO EDGE. This is the user's "shadow geometry" and the
        // audit's most-visible finding: these strips read as hard-edged brown
        // BANDS cutting across the grass. Nibbling the edge in patches, which is
        // what the loop above does, still leaves a boundary - it just makes it a
        // ragged one.
        //
        // It is D's alley mistake in grass. Their words, on sixteen strokes
        // radiating from a drain: "I drew the FLOW rather than the mark the flow
        // leaves." A desire line is not a strip of dirt laid on a lawn, it is
        // grass that gets thinner until there is none, and the thing to draw is
        // the THINNING.
        //
        // D washed theirs into the floor's own texture with a canvas gradient.
        // These cannot go into the field's texture - they drape over the mound
        // and need their own subdivided geometry - but they do not need alpha
        // either: the strip lies on grass, so fading its edges TO THE GRASS
        // COLOUR is what fading to transparent would look like, without a
        // transparent material. That matters, because `transparent: true` puts a
        // surface on dimWorld's skip list (GOTCHAS 22) and this one would then
        // sit at full daylight brightness after dark.
        const GRASS = '#727a56';                  // between MOW_LIGHT and MOW_DARK
        const wash = g.createLinearGradient(0, 0, PW, 0);
        wash.addColorStop(0.00, GRASS);
        wash.addColorStop(0.30, 'rgba(114,122,86,0)');
        wash.addColorStop(0.70, 'rgba(114,122,86,0)');
        wash.addColorStop(1.00, GRASS);
        g.fillStyle = wash;
        g.fillRect(0, 0, PW, PH);
        // and the fade line itself wanders, so the two edges are not parallel
        for (let y = 0; y < PH; y++) {
          const bite = Math.round((0.10 + r() * 0.16) * PW);
          g.fillStyle = 'rgba(114,122,86,0.5)';
          if (r() < 0.55) g.fillRect(0, y, bite, 1);
          if (r() < 0.55) g.fillRect(PW - bite, y, bite, 1);
        }
      }
      // (the tar repair that used to sit here is gone, and the path branch
      //  now returns before this point — see `loopTex` above)
      dither(g, PW, PH, Math.round(wM * dM * 8));
    });
  };
  /** a flat run of surface, laid in the x/z plane */
  const lay = (x0: number, x1: number, z0: number, z1: number, kind: 'path' | 'dirt') => {
    const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const seg = (m: number) => Math.max(1, Math.min(24, Math.round(m / 0.22)));
    const geo = kind === 'path' ? new THREE.PlaneGeometry(w, d, seg(w), seg(d))
                                : new THREE.PlaneGeometry(w, d);
    if (kind === 'path') {
      // WORLD-METRE UVs, the same ones the loop's band uses. A spur or an apron
      // that meets the circuit then samples the same tile at the same phase, so
      // the grain runs straight through the join. With 0…1 UVs it would stretch
      // one whole 4 m tile across whatever size the rectangle happened to be —
      // which is the old fault (every piece its own independently-rolled patch)
      // wearing a new hat.
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      const p = geo.attributes.position as THREE.BufferAttribute;
      // rotation.x = -π/2 below sends local +y to world -z
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, (cx + p.getX(i)) / PATH_TILE, (cz - p.getY(i)) / PATH_TILE);
      }
      uv.needsUpdate = true;
      // …AND THE SAME CROSS-SECTION. Without this the circuit had a walked
      // spine and the gate spur meeting it stayed a flat rectangle, so the one
      // join every visitor crosses read as two different materials — which is
      // the fault this whole pass exists to end, moved one metre along. An
      // elongated run is worn across its SHORT axis; a square apron (the
      // shelter's) has no direction to be worn along, so it takes a flat
      // mid-tread tone rather than a spine that would point nowhere.
      const long = Math.max(w, d), short = Math.min(w, d);
      const acrossX = w < d;                          // the short axis is x
      const col = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        const wx = cx + p.getX(i), wz = cz - p.getY(i);
        const c = long / short > 1.5
          ? tread(((acrossX ? wx - cx : wz - cz) / (short / 2)) * (PATH_W / 2), acrossX ? wz : wx)
          : tread(PATH_W * 0.22, wx + wz);
        col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    const mat = wet(flat(surfaceTex(w, d, kind)));
    if (kind === 'path') mat.vertexColors = true;
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx, KERB_H + LIFT, cz);
    // SAY WHAT IT IS. `scripts/bench-clearance.mjs` has to know which surfaces
    // in the park are WALKED before it can ask whether a bench crowds one, and a
    // check that reconstructed the loop from `lx0/lx1/lz0/lz1` would be a second
    // copy of the layout that goes stale the day somebody re-cuts a leg. The
    // rectangle is banked so the check reads the surface that was actually laid,
    // in the extent it was actually laid at.
    m.userData.parkGround = kind;
    m.userData.parkRect = { minX: Math.min(x0, x1), maxX: Math.max(x0, x1),
      minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1) };
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
  const KERB_D = KERB_W - 0.01, KERB_H_TOT = KERB_H + KERB_TOP;
  // ── ITEM 162: ONE MATERIAL CANNOT DRESS SIX FACES OF DIFFERENT SHAPES ─────
  //
  // This was **the single worst face in the world** — 16363x texel aspect,
  // 0.27 x 4363 px/m on a 30 x 0.22 m face, roughly four thousand times coarser
  // along its length than the room standard. It was not a badly chosen number;
  // it was a correct number applied to the wrong faces.
  //
  // `kerbT` is authored for the TOP: an 8 x 64 canvas standing for 0.25 m of
  // width and 2 m of length, with `repeat(1, W/2)`. On the top face that is
  // 0.24 m over 8 px = 33 px/m across and 30 m over 15x64 px = 32 px/m along —
  // square, and the 32 px/m is where this kerb's density is declared. But a
  // BoxGeometry with ONE material hands that same mapping to the ±x faces,
  // whose axes are the 30 m LENGTH and the 0.22 m HEIGHT, so `u` spread 8 texels
  // over 30 m and `v` packed 960 into 0.22 m.
  //
  // So each pair of faces gets a material whose repeat is DERIVED FROM THAT
  // FACE'S OWN DIMENSIONS at the same 32 px/m (BUILDER-BRIEF §7b). The top is
  // untouched — its numbers were already right and are now simply written as
  // the derivation they always were.
  //
  // BoxGeometry group order is [+x, -x, +y, -y, +z, -z].
  const KERB_PPM = 32;                              // = the canvas: 8 px over KERB_W
  /** a granite face at KERB_PPM, tiled from its own metres */
  const kerbFace = (wm: number, hm: number) => {
    const t = pixTex(64, 16, (g) => {
      const r = clcg(0x9e31b2);
      g.fillStyle = '#8e8b83'; g.fillRect(0, 0, 64, 16);
      for (let i = 0; i < 180; i++) {
        const k = r();
        g.fillStyle = k > 0.7 ? '#9c998f' : k > 0.35 ? '#84817a' : '#77746d';
        g.fillRect(Math.floor(r() * 64), Math.floor(r() * 16), 1, 1);
      }
      // a joint every 1 m ALONG THE RUN, which on this canvas is u — the top's
      // joints run the other way because on the top face the run is v. Reusing
      // one canvas for both is what would put the joints across the kerb.
      g.fillStyle = 'rgba(40,38,34,0.4)';
      for (let x = 0; x < 64; x += 32) g.fillRect(x, 0, 1, 16);
      g.fillStyle = 'rgba(74,86,58,0.35)';          // moss, at the grass side
      for (let i = 0; i < 18; i++) g.fillRect(Math.floor(r() * 64), 16 - 1 - Math.floor(r() * 3), 1 + Math.floor(r() * 2), 1);
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    // DERIVED: metres x px/m, over the canvas that carries them.
    t.repeat.set(wm * KERB_PPM / 64, hm * KERB_PPM / 16);
    return wet(flat(t));
  };
  const sideM = kerbFace(W, KERB_H_TOT);            // the 30 m runs
  const endM = kerbFace(KERB_D, KERB_H_TOT);        // the two little end caps
  const topM = wet(flat(kerbT));                    // unchanged, already square
  const kerb = new THREE.Mesh(new THREE.BoxGeometry(KERB_D, KERB_H_TOT, W),
    [sideM, sideM, topM, topM, endM, endM]);
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

  // ── THE LOOP IS ONE SURFACE NOW, NOT FOUR LEGS AND FOUR PATCHES ──────────
  //
  // The user, on a frame of a turn: *"look at this path corner it looks so
  // messed up."* He is right, and there were three faults stacked in one spot:
  //
  //   THE TURN WAS A SEPARATE ROTATED QUAD dropped over the junction, drawn
  //     0.6 m longer than the gap it filled so its square ends poked ears out
  //     into the grass past both legs.
  //   IT WAS WIDER THAN THE PATH. A PATH_W band crossing a PATH_W band at 45°
  //     covers PATH_W/cos45 = 2.12 m of it, so the turn measured half again as
  //     wide as either leg it joined and read as a lozenge, not a bend.
  //   THE EDGING CROSSED ITSELF IN THE MIDDLE OF IT. The four strips each ran
  //     the FULL length of their leg (`lz0…lz1`) while the legs themselves
  //     stopped `CHAM` short, so all four overran into the turn and drew a grey
  //     X on the corner. That is the thing the screenshot is actually of.
  //
  // A path does not have corners; it has a plan. So the plan is ONE closed
  // octagonal ring, and everything that follows the loop — the surface, the
  // edging, the hoop rail — is generated from that one function at a different
  // offset. Nothing can fail to mitre, because nothing is drawn twice, and the
  // §6 y-separation hack the old corners needed is gone with them: there is not
  // one overlapping pair of coplanar surfaces left in the loop.
  //
  // THE IDENTITY THAT MAKES IT WORK: offsetting a 45°-chamfered rectangle
  // outward by `t` grows the rectangle by `t` on every side AND grows the
  // chamfer by `t·(2 − √2)`. Two rings built that way are a constant distance
  // apart the whole way round, corners included — which is exactly what "the
  // path keeps its width through the turn" means, and it is why a corner can no
  // longer be a different width from its legs.
  const CH_K = 2 - Math.SQRT2;
  /** the loop's centreline offset outward by `t` m, as its 8 corner points */
  const ringPts = (t: number): [number, number][] => {
    const x0 = lx0 - t, x1 = lx1 + t, z0 = lz0 - t, z1 = lz1 + t;
    const c = CHAM + t * CH_K;
    return [[x0 + c, z0], [x1 - c, z0], [x1, z0 + c], [x1, z1 - c],
            [x1 - c, z1], [x0 + c, z1], [x0, z1 - c], [x0, z0 + c]];
  };
  // Every ring is cut into the SAME number of pieces per edge, taken off the
  // centreline, so vertex i of one ring is always opposite vertex i of the
  // next and a band between two rings closes with no seam and no bookkeeping.
  const SEG = 1.1;                                   // metres per piece
  const cuts = ringPts(0).map((p, i, a) => {
    const q = a[(i + 1) % 8];
    return Math.max(1, Math.round(Math.hypot(q[0] - p[0], q[1] - p[1]) / SEG));
  });
  const NCOL = cuts.reduce((a, b) => a + b, 0);
  const ring = (t: number) => {
    const P = ringPts(t), out: [number, number][] = [];
    for (let i = 0; i < 8; i++) {
      const a = P[i], b = P[(i + 1) % 8];
      for (let k = 0; k < cuts[i]; k++) {
        const f = k / cuts[i];
        out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
      }
    }
    return out;
  };
  // arc length round the centreline, for anything that wants to vary ALONG the
  // path rather than across it
  const ARC: number[] = [];
  {
    const m = ring(0);
    let s = 0;
    for (let i = 0; i < NCOL; i++) {
      ARC.push(s);
      const a = m[i], b = m[(i + 1) % NCOL];
      s += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
  }

  /**
   * A closed band round the loop: one quad strip per pair of consecutive
   * rings, laid flat at `y`. UVs are WORLD METRES, so a wrapped texture is
   * continuous across every corner for free — there is no per-piece canvas to
   * fail to line up with its neighbour.
   */
  const band = (rows: number[], y: number, mat: THREE.MeshBasicMaterial, tile: number,
                tint: (t: number, s: number) => [number, number, number]) => {
    const pts = rows.map((t) => ring(t));
    const pos: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
    for (let r = 0; r < rows.length; r++) {
      for (let i = 0; i < NCOL; i++) {
        const [x, z] = pts[r][i];
        pos.push(x, y, z);
        uv.push(x / tile, z / tile);
        col.push(...tint(rows[r], ARC[i]));
      }
    }
    for (let r = 0; r + 1 < rows.length; r++) {
      for (let i = 0; i < NCOL; i++) {
        const j = (i + 1) % NCOL;
        const a = r * NCOL + i, b = r * NCOL + j;
        const c = (r + 1) * NCOL + i, d = (r + 1) * NCOL + j;
        idx.push(a, c, d, a, d, b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    mat.vertexColors = true;
    mat.side = THREE.DoubleSide;                     // a ground decal, seen from above only
    const m = new THREE.Mesh(geo, mat);
    scene.add(m);
    return m;
  };

  // ── WHY THE SURFACE READ AWFUL, AND THE ANSWER ──────────────────────────
  //
  // The user, second rejection of this surface: *"the path looks awful."* The
  // first rejection (see PATH above) was that it read as ROAD and the answer
  // was the warm hoggin palette, which is right and stays. What is wrong now is
  // not the colour, it is that THE PATH HAS NO STRUCTURE: isotropic 1-texel
  // pepper at even density over a flat pale field, identical from one shoulder
  // to the other and from one end to the other. Nothing about it says people
  // walk here. That is the read of poured aggregate — terrazzo — not of ground.
  //
  // Re-rolling the noise is the change that already failed, so the answer is
  // not in the canvas at all, it is in the SHADING ACROSS THE WIDTH. A path
  // that is walked is polished pale down the spine where feet go, dirtier and
  // damper at the shoulders where they do not, and dies into the turf at its
  // margin instead of stopping at a line. That is a cross-section, and a
  // cross-section is the one thing a tiling texture cannot hold — so it goes
  // where this file already puts form in an unlit world: vertex colour, the
  // same technique and the same 0.78…1.26 range the field's relief uses.
  //
  // It also fixes the join for free. The outermost ring is pulled down AND
  // toward olive, so the last 100 mm of path is the colour of thin grass and
  // the edging sits on a margin rather than on a butt joint.
  const H = PATH_W / 2;
  const tread = (t: number, s: number): [number, number, number] => {
    // AND THE WORN LINE WANDERS. This is where the direction of travel comes
    // from, and it is why the cross-section is a function of arc length rather
    // than a per-ring constant: a pale stripe pinned to the centreline for 70 m
    // is a stripe, not wear. Drifting it slowly from one side to the other —
    // which is what a formal path that people cut the corners of actually
    // looks like — gives the surface a line running ALONG it, and because the
    // drift is driven by distance round the loop it carries through the turns
    // instead of stopping at them.
    const drift = 0.20 * Math.sin(s * 0.17 + 0.6) + 0.11 * Math.sin(s * 0.41 + 2.3);
    const u = Math.min(1, Math.abs(t - drift) / H);
    const k = u * u;                          // pale across the middle, falling
                                              // away only near the shoulders
    const lum = (1.03 - 0.33 * k)
      * (1 + 0.035 * Math.sin(s * 0.29) + 0.022 * Math.sin(s * 0.81 + 1.9));
    // …and the shoulder goes OLIVE as well as dark, which is the join to the
    // grass: the last 100 mm of path is the colour of turf that has been walked
    // thin, so the edge is a margin instead of a butt joint.
    return [lum * (1 - 0.07 * k), lum * (1 + 0.04 * k), lum * (1 - 0.15 * k)];
  };
  const TREAD = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1].map((f) => f * H);
  {
    const loop = band(TREAD, KERB_H + LIFT, wet(flat(loopTex())), PATH_TILE, tread);
    // THE CIRCUIT, AS A THING A CHECK CAN ASK ABOUT. `lay()` banks its rectangles
    // (`userData.parkRect`) but the loop is not a rectangle — it is an octagonal
    // BAND, and `scripts/bench-clearance.mjs` measured 2 walked surfaces in a park
    // with a 110 m circuit until this existed. The eight-point CENTRELINE plus a
    // half-width is the honest shape of it: the same `ringPts(0)` every leg of
    // the loop is cut from, and `H`, which is `PATH_W / 2` and the actual outer
    // row of TREAD. Re-cut a leg and the banked polygon re-cuts with it.
    loop.userData.parkGround = 'path';
    loop.userData.parkLoop = { centreline: ringPts(0), halfWidth: H };
  }

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
  // not a feature.
  //
  // ── 2026-08-03: THE CROWN IS OFF AND THE HOLLOWS ARE REAL (item 172) ─────
  //
  // The user: *"try to add some y diversity here. the height is soooo flat."*
  // He was right, and the file already knew why. What was here was
  //
  //   a CROWN     +0.10 m               the whole field, domed
  //   a MOUND     +0.30 m over σ 3.1    the thing you walk up
  //   a DISH      -0.09 m over σ 2.6    the bit that would puddle
  //   a CORNER    -0.10 m over σ 5.2    the ground falling away to the south-east
  //
  // — measured end to end at 0.366 m of total relief across the whole site
  // (`scripts/probes/w83-park-relief.mjs`). 0.366 m over 32 x 30 m IS flat, at
  // human scale, and no amount of shading was going to argue otherwise.
  //
  // THE CROWN WAS NEVER A DESIGN, IT WAS A WORKAROUND, and the note it replaced
  // said so: *"The park site is floored by one flat 32 x 30 m plane at KERB_H,
  // drawn by `openSite` in ct/street.ts, and it is not mine and does not move."*
  // Because that plane was opaque and immovable, a hollow cut below it was
  // drawn UNDER the ground while the floor picker still lowered the player into
  // it — *"you walk down into a dip that is not there"* — so the dish and the
  // corner had to be carved out of an artificial dome instead, and every metre
  // of grade the dome's own rim consumed came off the mound's budget.
  //
  // The same note named the fix and could not reach it: *"If ct/street.ts ever
  // lets a module own its site's ground, the crown can come off and the hollows
  // can be real."* `Site.displace` is that, and it is called below. The crown
  // is gone, the `Math.max(0, …)` clamp that pinned every dip to the site plane
  // is gone, and the two hollows are cut into ground that moves with them.
  //
  // WHAT IT BOUGHT, swept on a 0.2 m grid over the whole site, before → after:
  //
  //   RANGE   0.366 m  →  0.633 m      +73%, and the mound alone is +83%
  //   GRADE   1 in 9.4 →  1 in 9.6     GENTLER, not steeper
  //   STEP    0.3 mm   →  0.3 mm       where the grass meets the paths
  //   FLOOR   0.140 m  →  0.057 m      still above the roadway
  //
  // Both of the free wins came from removing workarounds rather than from
  // spending the grade budget: the crown's rim gave back one share, and
  // swapping the gaussians for a bounded-slope profile (see `land`) gave back
  // the other. THE ITEM'S OWN FIGURE FOR THE OLD GRADE — "1 in 12" — WAS WRONG;
  // it is the pre-crown number, and the comment this replaces already said the
  // crown took it to 1 in 9.1. Measured on the built world: 1 in 9.4.
  //
  // WHAT STILL CAPS IT, for whoever comes next. The relief must be zero where
  // the grass meets the loop, because the paths are laid level; that puts the
  // rise's whole run inside the FIELD, which is 17.75 x 16.5 m — not the site's
  // 32 x 30. A landform that is zero on a rectangle's boundary cannot exceed
  // grade x inradius, so 8.25 m of run at 1 in 8 is a hard ceiling of about
  // 1.0 m however it is shaped. To go past that the LOOP ITSELF has to be
  // draped on the relief the way the desire lines already are, which moves the
  // benches (item 170) and the shelter (item 171) and is not this item's.
  //
  // The old numbers, kept because they are still the reason for two placements:
  // a gaussian's own steepest slope is A/(σ√e), which for a 0.45 m mound over
  // σ 4.6 is a comfortable 1 in 17 — but the rim mask multiplies the whole
  // field, so where it bit into a mound still 0.4 m high it ADDED its own
  // 1-in-6 bank on top. And a -0.13 m dish on a 0.14 m kerb puts the floor
  // 8 mm above the roadway, which is where the floor constraint comes from.
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
  // THE CREST DOES NOT MOVE. `mndX`/`mndZ` are read by four other things — the
  // shaggy patch in the mowing texture, the bench at +2.1, the tree at -0.7,
  // and the mound's own tree — and the bench belongs to item 170, which is
  // claimed. The mound gets TALLER and WIDER here; it does not get relocated,
  // so nothing else in the file moves in x or z.
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
  // ── A HOLLOW MAY NOT SIT ON A MOUND'S FLANK. A RISE MAY. ────────────────
  //
  // This is the rule the placements below follow and it was measured, not
  // reasoned: the first sweep of this rewrite put the dish and the corner fall
  // where the old gaussians had them, inside the mound's skirt, and came back
  // at 1 in 7.1 at x -19.60 z -85.80 — a point where the mound descends
  // eastward at 0.121 and the corner fall descends eastward at 0.036, and the
  // two ADD to 0.141.
  //
  // A RISE on the same flank does not do this. Between a mound and a
  // neighbouring swell there is a SADDLE, so their gradients OPPOSE and
  // partially cancel; past the swell's far toe the mound is already zero. That
  // asymmetry is why the swell below is allowed to overlap the mound and the
  // dish is not, and it is worth knowing before moving any of them.
  //
  // So the dish goes to the north-east corner, 8.94 m from the mound's centre —
  // far enough that its own support only reaches the mound's soft outer fifth,
  // where the mound's slope has ramped most of the way down.
  const dshX = fx1 - 3.4, dshZ = fz1 - 3.4;
  // ── WHY THERE IS ONLY ONE RISE, WHICH IS NOT WHAT I SET OUT TO BUILD ────
  //
  // Two extra features were built here and both were MEASURED OUT rather than
  // argued out, and the numbers are worth keeping because the next person will
  // want to add them back:
  //
  //   a SOUTH-EAST CORNER FALL, -0.083 m — the old σ 5.2 one. Every position it
  //     can take is inside the mound's descending south-east flank, and a
  //     hollow on a descending flank ADDS (see the rule above). It measured
  //     1 in 7.1 at x -19.60 z -85.80.
  //   a NORTH-WEST SWELL, +0.18 m over r 4.4 — a second crest, for a lawn with
  //     a saddle in it rather than one dome. I expected this to be free, on the
  //     reasoning that a rise opposes a mound in the saddle between them. IT IS
  //     ONLY FREE ON THE LINE JOINING THEM. Off that line — x -28.20 z -82.60,
  //     west of the mound and south of the swell — climbing east AND north
  //     climbs both, and the components add: 0.111 of mound plus 0.027 of
  //     swell. Swept at 1 in 8.0 against 1 in 8.6 for the mound alone.
  //
  // Costed properly, the swell buys a second crest for 0.034 m of RANGE off the
  // mound at a fixed grade, which is the wrong way round: the user's complaint
  // is about height, and the mound is where height is cheapest. So the whole
  // budget goes to the mound.
  //
  // MND_H IS THE ONE DIAL, AND THE DESK HAS NOW TURNED IT (item 235). Grade
  // scales linearly with it: 0.485 → 1 in 9.4, which is what the park measured
  // before item 172; 0.570 → 1 in 8.0 and 0.653 m of range. It was set to the
  // first so that item 172 could deliver +55% relief at an unchanged grade and
  // nobody had to weigh the result against a constraint. The desk then took the
  // trade explicitly — the user's words were "the height is soooo flat", three
  // os of emphasis — on the grounds that 1 in 8.0 is still a stroll: a kerb ramp
  // is far steeper, and a real grass bank is 1 in 4. Both numbers below are
  // SWEPT, not predicted (`scripts/probes/w83-park-relief.mjs`).
  //
  // THE CEILING ABOVE THIS DIAL IS NOT FAR, and it is not another number in this
  // file. Relief must be ZERO where the grass meets the level loop, so the whole
  // run lives inside the FIELD — 17.75 x 16.5 m, not the site's 32 x 30 — and a
  // landform zero on a rectangle's boundary cannot exceed grade x inradius. At
  // 1 in 8 that caps ANY shape near 1.0 m. Going past it needs the loop itself
  // draped on the relief, which moves the benches (item 170) and the shelter
  // (item 171). That is a separate piece of work; do not start it here.
  // ── ONE LANDFORM PRIMITIVE, WITH A SLOPE YOU CAN BUDGET ──────────────────
  //
  // The old relief was three gaussians, and a gaussian is the wrong tool here
  // for two reasons that between them cost this park most of its height:
  //
  //   IT IS STEEPEST WHERE IT IS HALFWAY UP. A gaussian's peak slope is
  //     A/(sigma*sqrt(e)) — 1.65x the average slope it needs to climb its own
  //     radius. So a third of the grade budget is spent on the one band around
  //     the bump, and the crest has to be lowered until that band is legal.
  //     This profile ramps its slope in and out and is LINEAR in between, so
  //     the peak is 1.25x the average. Same budget, 32% more height.
  //   IT NEVER REACHES ZERO. exp() is positive everywhere, so every feature
  //     sits in every other feature's skirt. That is not theoretical: the note
  //     above records a -0.09 m dish that measured +0.15 because the mound was
  //     still 0.11 m tall underneath it, 4.6 m away. `land` is EXACTLY zero
  //     past r1, so a hollow placed outside a mound's radius is the depth it
  //     says it is, and the sweep confirms it rather than the author hoping.
  //
  // r0 is the flat crest, r1 the toe. Peak grade is 1.25*h/(r1-r0) — the number
  // to check against the budget before touching anything, and then to confirm
  // with `scripts/probes/w83-park-relief.mjs` because the features add where
  // they overlap and no per-feature sum can see that.
  const land = (x: number, z: number, cx: number, cz: number,
    r0: number, r1: number, h: number) => {
    const d = Math.hypot(x - cx, z - cz);
    if (d >= r1) return 0;
    if (d <= r0) return h;
    const t = (r1 - d) / (r1 - r0);       // 0 at the toe, 1 at the crest
    // The slope ramps 0 -> s over the first fifth, holds s, ramps back to 0
    // over the last fifth; integrating that gives s*(1-a), so s = h/(1-a)
    // normalises the crest to exactly h. Both joins are C1 — no crease.
    const a = 0.2, s = h / (1 - a);
    return t < a ? (s * t * t) / (2 * a)
      : t < 1 - a ? s * (t - a / 2)
        : s * (1 - a) - (s * (1 - t) * (1 - t)) / (2 * a);
  };
  // ── THE FEATURES, AND WHAT EACH COSTS IN GRADE ───────────────────────────
  //   MOUND  +0.570 m  r 0.7…6.4   1.25*0.570/5.7 = 0.125 → 1 in 8.0
  //   DISH   -0.083 m  r 0.4…3.4   1.25*0.083/3.0 = 0.035 → 1 in 29
  //
  // The mound is 90% taller than the 0.30 m it replaces. The composite grade is
  // 1 in 8.0, against 1 in 9.4 both before item 172 and after it — this is the
  // trade item 235 bought deliberately, range for grade, and it is the ONLY
  // number here that got worse. Per-feature arithmetic is the BUDGET, not the
  // answer — features add where they overlap and no sum written here can see
  // that — so both are confirmed against
  // `scripts/probes/w83-park-relief.mjs` on the built world, and three times
  // now that sweep has disagreed with a comment in this block and been right.
  //
  // NOTE THE HEADROOM AGAINST `EDGE_G` BELOW, because it is now thin: the peak
  // grade 0.125 sits just under the 0.13 edge clamp, so the clamp remains very
  // nearly the no-op it is meant to be. Raise MND_H further and the clamp starts
  // engaging across the field, flattening the crest instead of the rim — the
  // shape would change character before the numbers said anything obvious.
  const MND_H = 0.570, HOLLOW = -0.083;
  const relief = (x: number, z: number) => {
    const inset = Math.min(x - fx0, fx1 - x, z - fz0, fz1 - z);
    if (inset <= 0) return 0;
    // THE CROWN IS GONE. It was +0.10 m over the whole field, and it existed
    // for exactly one reason: the site's flat plane was opaque and this module
    // could not move it, so a hollow had to be cut out of an artificial dome or
    // it would be drawn underneath the ground. `site.displace` below now hands
    // this module that plane, so the hollows are cut into the real ground and
    // `Math.max(0, ...)` — which clamped every dip to the site plane and was
    // the other half of the same workaround — goes with it.
    const m = land(x, z, mndX, mndZ, 0.7, 6.4, MND_H);
    const d = land(x, z, dshX, dshZ, 0.4, 3.4, HOLLOW);
    // ── THE EDGE WEDGE, which replaces the rim mask ────────────────────────
    //
    // What was here was `* smoothstep(inset / 5.5)` — the whole field scaled
    // toward zero over the last 5.5 m. It forces relief to zero at the path,
    // which is right, but it does it by MULTIPLYING, and multiplying a
    // half-height mound by a falling mask adds the mask's own slope on top of
    // the mound's. That is not a hypothesis: the first sweep of this rewrite
    // came back at 1 in 5.7 at x -23.60 z -88.00, and the arithmetic accounts
    // for it exactly — 0.1206 of mound plus 0.0669 of mask = 0.1764. The old
    // comment recorded the same mechanism biting the same way ("it ADDS its own
    // 1-in-6 bank on top") and the answer then was to lower the mound.
    //
    // A WEDGE BOUNDS THE THING THE CONSTRAINT IS ACTUALLY ABOUT. Clamping the
    // relief inside +/- inset*EDGE_G says directly what the item demands — the
    // ground is level where it meets the paving, and no slope anywhere near
    // that join is steeper than EDGE_G — instead of saying it sideways through
    // a fade width and hoping. It cannot add slope, because a clamp only ever
    // removes it: where it engages the grade is exactly EDGE_G, and where it
    // does not it is the landform's own.
    //
    // It is very nearly a no-op today, which is the intent: the features are
    // sized to die on their own and the clamp is the guarantee that survives
    // somebody re-tuning them. 1 in 7.7.
    const EDGE_G = 0.13;
    const f = m + d;
    const cap = inset * EDGE_G;
    return Math.max(-cap, Math.min(cap, f));
  };

  /** The floor of the park, at a point. Flat everywhere the relief is. */
  const parkY = (x: number, z: number) => KERB_H + relief(x, z);

  // ── AND THE SITE'S OWN GROUND TAKES THE SAME SHAPE ───────────────────────
  //
  // This one line is the whole of item 172. Until `Site.displace` existed the
  // park was drawing relief on top of somebody else's flat opaque plane, which
  // is why it needed a crown to keep its hollows above that plane and why its
  // total range was 0.366 m.
  //
  // THE SAME FUNCTION, A THIRD CONSUMER. `relief` already had two — the field
  // mesh is displaced by it and the floor picker answers it — and the file's
  // stated discipline is that the shape you see and the height you walk on
  // cannot be two descriptions of one thing. The ground under both is now the
  // third, from the same function, so it cannot drift from either.
  //
  // It is safe outside the field for free: `relief` returns 0 the moment
  // `inset` goes non-positive, so the 6 m planted margin, the path loop, the
  // kerb line and the strip under the party walls are all left at exactly
  // KERB_H — nothing that stands on the site's flat ground has moved, and the
  // paths stay level without being told anything.
  //
  // ── AND IT IS SUNK 30 mm UNDER THE GRASS, WHICH IS NOT COSMETIC ─────────
  //
  // The field mesh rides `LIFT * 0.5` — 3 mm — above the site plane, which was
  // ample while the plane was flat. Once BOTH are curved it is not, because
  // they are curved at DIFFERENT TESSELLATIONS: the field is
  // `PlaneGeometry(17.75, 16.5, 27, 25)` at 0.657 m, the site plane
  // `(32, 30, 48, 45)` at 0.667 m, and neither grid's vertices land on the
  // other's. A flat facet across a convex crest sits below the true surface by
  // κh²/8, and the relief's sharpest curvature is 0.093 m⁻¹ where `land` ramps
  // its slope in — so each mesh sags up to 5.2 mm mid-facet, out of phase with
  // the other. Where the field sags and the site plane does not, the plane
  // stands 2.2 mm PROUD OF THE GRASS and the site's grey shows through it in
  // slivers. That is GOTCHAS §6 with a curve in it, and no screenshot at this
  // scale would reliably show it.
  //
  // 30 mm clears the worst case six times over. It costs nothing: the field
  // mesh covers `fx0…fx1 x fz0…fz1` exactly, so every millimetre of the sunk
  // region is under grass, and the sag ramps from zero over the first 0.6 m
  // INSIDE the boundary — so the two surfaces still meet flush exactly where
  // the grass ends and the site's own ground takes over.
  //
  // The floor picker is untouched by this: it answers `relief`, not the plane.
  const SAG = 0.03;
  site.displace?.((x, z) => {
    const inset = Math.min(x - fx0, fx1 - x, z - fz0, fz1 - z);
    if (inset <= 0) return 0;
    return relief(x, z) - SAG * Math.min(1, inset / 0.6);
  });

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
// TWO INDEPENDENT VARIABLES, and only one of them was doing the work.
//
// CONTRAST is what made the turf read as churned: this pair sits at ~6.9%
// peak-to-trough, where the previous one read 11.4% — the point at which mown
// grass stops looking like nap and starts looking like paint.
//
// WIDTH is not that, and narrowing it was a mistake I made by reading one
// sentence as one instruction. 1.5 m is a real mower deck, and a mown field
// reads as mown precisely BECAUSE the bands are as wide as the machine that
// cut them. At 1.03 m they were narrower than any mower exists, which is a
// second way of looking wrong — it just does not look wrong in the same way.
// `E-field` scans a line across the rendered frame and will fail if either
// drifts back: over 14% is stripes, under 1.5% is not there at all.
const MOW_LIGHT = '#767d58', MOW_DARK = '#6f7653', MOW_BAND = 1.5;

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
    // NO BALD RING EITHER. It was the last of the ground wear and it goes with
    // the desire lines: the user's *"looks like a couple of dirt bikes ran
    // through it all"* is about scattered dark patches on the lawn, and a 4.4 m
    // brown disc in the corner of the field is one of them.
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
  // ── NO GROUND WEAR ON THE FIELD ─────────────────────────────────────────
  //
  // The user, on the tenth criticism of this park: *"looks like a couple of
  // dirt bikes ran through it all."* They are describing these, and they are
  // right. All wear is out: four desire lines and the bald ring under the
  // corner tree.
  //
  // The desk's own reading is that the BRIEF caused it — *"worn dirt on the
  // desire lines"* became scattered wear across the whole lawn. But the way it
  // got there is mine, and it is the same shape as the seven-lines-cut-to-three
  // edit that used to sit here: each round I reduced the wear a little instead
  // of asking whether it belonged. I softened these edges twenty minutes ago
  // rather than removing them, which is another turn of the same handle.
  //
  // A desire line is a COHERENT TRACK between two real destinations. Three
  // fanning from a gate plus a corner cut is not evidence of where people
  // walk, it is texture. Clean mown grass reads better than a churned field,
  // and the field is the largest thing in the park.
  //
  // If wear comes back it is ONE track between two places a player actually
  // goes — gate to shelter — and nothing else. `worn()` is kept for that.

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
      // THE PICKETS REACH THE BOTTOM EDGE, and the bottom rail is AT it.
      //
      // They used to stop 3 texels short of it and the bottom rail sat above
      // that, so the last 0.17 m of this plane was empty air standing on the
      // coping — the user's "the pickets do not meet anything at the bottom".
      // The gap closes by CONSTRUCTION now: the rail is the bottom row, so a
      // picket cannot end above it whatever RH rounds to.
      const pitch = Math.max(3, Math.round(0.17 * 12));
      for (let x = 2; x < RW; x += pitch) g.fillRect(x, 2, 2, RH - 2);
      g.fillRect(0, 0, RW, 2);                      // top rail
      g.fillRect(0, RH - 2, RW, 2);                 // bottom rail, ON the coping
      g.fillStyle = '#4a5049';                      // and the rust that follows
      for (let x = 2; x < RW; x += pitch * 3) g.fillRect(x, RH - 9, 2, 6);
    });
  };
  const railM = (lenM: number) => new THREE.MeshBasicMaterial({
    map: railTex(lenM), alphaTest: 0.5, side: THREE.DoubleSide,
  });
  // MEASURED, not assumed — and the assumption was backwards.
  //
  // This said street.ts stands its wall on the PAVEMENT side of the line, at
  // x -7.00…-6.64, and put the railings at `site.maxX + WALL_T / 2`. Read out
  // of the built world, the wall is at **x -7.36 … -7.00**: the PARK side. So
  // the railings stood at -6.82, which is 0.36 m off the wall's centre and
  // 0.18 m clear of the wall altogether, out over the pavement. That is the
  // user's "the railing is offset from the wall beneath it", it is why the two
  // lines disagree along the whole run, and it was also quietly encroaching
  // the 2 m lane that is supposed to be sacred.
  //
  // The wall's TOP does agree with the 0.62 assumed here (measured 0.76 =
  // KERB_H + 0.62), so this is my error and not a seam bug — nothing to route
  // to D. The centre now comes off the same edge the wall is built from.
  const RAIL_X = site.maxX - WALL_T / 2;
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
  // QUIETER. The user: the edging is "very stark" — near-white against a dark
  // path. Lifting the path to buff fixed half of that by raising what sits
  // beside it; this is the other half. A municipal path edging is a concrete
  // kerb that has been rained on for thirty years, which is a warm mid-grey,
  // not a white line. Pulled down and warmed so it reads as a quiet kerb
  // rather than as a stripe drawn along the path.
  const PK_STONE = stoneCanvas('#8b8578', '#7e7869', '#968f81');
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
  // EVERY BENCH REGISTERS ITS FOOTPRINT. The `claim()` registry below was
  // built for the bin-versus-noticeboard case and benches were never added to
  // it — so a bin could be, and was, placed standing inside a bench. That is
  // the fault the user photographed, and it is the same class the registry
  // exists to prevent. `claim` is declared after the benches are built, so
  // they bank their boxes here and the registry is seeded with them.
  const benchBoxes: AABB[] = [];
  // ── EVERY BENCH STANDS THIS FAR OFF THE PATH. A RULE, NOT A NUDGE ─────────
  //
  // The user, twice, and the second time PLURAL: *"bench is a lil too close to
  // the path"* -> *"benches need space away from the path."* Nudging the one he
  // photographed is what earned the second report, so this is a constant every
  // placement derives from, and `scripts/bench-clearance.mjs` fails if a future
  // bench crowds the path.
  //
  // MEASURED BEFORE IT WAS CHANGED, and every bench in the park OVERHANGS the
  // path. The bench's registered collider is `SEAT_D` deep either side of its
  // centre, so the clearance from the path edge to what a walker can actually
  // hit is `offset - PATH_W / 2 - SEAT_D`:
  //
  //     the two z legs   lx +- (PATH_W / 2 + 0.42)   ->  -0.04 m   INSIDE the path
  //     the two x legs   lz +- 1.05                  ->  -0.16 m   INSIDE the path
  //
  // Two different hand-typed offsets, neither named, and both negative. That is
  // the drift the item describes and the reason his screenshot shows a bench
  // with its front legs on the kerb and the seat hanging over it.
  //
  // THE FIGURE IS DERIVED FROM THE PLAYER, NOT CHOSEN. A walker is entitled to
  // the WHOLE path: his centre may reach the very edge of it, and his body then
  // overhangs that edge by his own collision radius. `fp.ts:87 RADIUS = 0.36` is
  // therefore the distance at which a bench starts being something he collides
  // with while still legitimately on the path. Clearance = RADIUS + a margin, so
  // that passing it is not BRUSHING it — BUILDER-BRIEF §10, "a person should be
  // able to walk past a shelf without brushing it". The margin is TOUCH_MARGIN,
  // the world's own smallest meaningful gap (`fp.ts:764`), rather than a number
  // I liked: 0.36 + 0.15 = 0.51 m.
  //
  // Imported, never retyped. Re-tune the player's radius and every bench in the
  // park steps back with it.
  const BENCH_CLEAR = RADIUS + TOUCH_MARGIN;
  /** half-depth of a bench ACROSS its run — the collider `bench()` registers. */
  const BENCH_SEAT_D = 0.46;
  /** centre-to-centre: path centreline to bench centre, on any leg. */
  const BENCH_OFFSET = PATH_W / 2 + BENCH_CLEAR + BENCH_SEAT_D;
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
    // SEAT_D IS THE HOISTED ONE. It is the collider half-depth the placements
    // above derive `BENCH_OFFSET` from, and two copies of it drifting apart is
    // exactly how the clearance went negative (BUILDER-BRIEF §8).
    const L = 1.72, SEAT_Y = 0.45, SEAT_D = BENCH_SEAT_D;
    // ── WHAT YOU ACTUALLY SIT ON, DERIVED ONCE ──────────────────────────
    //
    // The user: *"[screenshot] bench texture is off and **sitting looks
    // nonsensical**."* Measured, by sitting on all ten
    // (`probes/w89-item106-sit-on-the-bench.mjs`): the player sank **0.080 m
    // into the slats on 9 of them**, identically.
    //
    // `SEAT_Y` is the height of the FRAME — the leg and the seat rail are built
    // off it. The slats then sit 0.055 m proud of that and are 0.05 thick, so
    // the surface a person rests on is 0.08 m higher than `SEAT_Y` and the seat
    // registered `h: 0.45` — a hand-typed literal that was not even `SEAT_Y`.
    //
    // THIS IS A KNOWN FAMILY, third occurrence. `ct/int-church.ts` records a pew
    // whose top face was 0.50 while `ctx.seat()` registered 0.54, and
    // `ct/int-casino.ts`'s STOOL_TOP comment says it in capitals: THE SEAT IS
    // THE TOP FACE, NOT THE CENTRE OF THE CUSHION. So it is derived here and
    // used by both the slats and the seat, and the two cannot drift again.
    const SLAT_T = 0.05;
    const SLAT_Y = SEAT_Y + 0.055;          // the slat's CENTRE
    const SEAT_TOP = SLAT_Y + SLAT_T / 2;   // …and its top face: what you sit on
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
      put(new THREE.Mesh(new THREE.BoxGeometry(L, SLAT_T, 0.15), i % 2 ? woodM2 : woodM),
        0, SLAT_Y, z);
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
    // …AND THE SAME BOX, ON THE GROUP, so a check can ask about THE COLLIDER a
    // walker actually hits rather than about the geometry inside it — the two
    // differ by 0.20 m here, and it is the collider that decides whether passing
    // a bench is brushing it. Banked here rather than recomputed by the checker,
    // which would be a second copy of this line (BUILDER-BRIEF §8).
    g.userData.parkBench = { minX: bx - hx, maxX: bx + hx, minZ: bz - hz, maxZ: bz + hz };
    // banked for the footprint registry: a bin may not stand in this
    benchBoxes.push({ minX: bx - hx - 0.1, maxX: bx + hx + 0.1,
      minZ: bz - hz - 0.1, maxZ: bz + hz + 0.1 });
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
    // yaws come from `facingAcrossZLeg`/`facingAcrossXLeg`, which are atan2 in
    // that same order. With the
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
    // THE SEAT'S YAW IS NOT THE MESH'S YAW, and this is the tenth orientation
    // bug — the one that was hiding UNDER the eighth.
    //
    // This world has two conventions and they differ by a z-flip:
    //     a MESH rotated by rotation.y = t faces (sin t,  cos t)
    //     the PLAYER/camera at yaw t looks along (sin t, -cos t)
    // three.js cameras look down local -z, meshes are authored facing +z, and
    // nothing reconciles them. Measured, not reasoned: warping to yaw 0 and
    // holding W moves -z, and yaw PI moves +z.
    //
    // `facingAcrossZLeg`/`facingAcrossXLeg` return the MESH value, which is right for the bench body and
    // is why the backrest genuinely sits on the wall side. Handing that same
    // number to ctx.seat pointed the SITTER the other way, so the bench faced
    // the park and the person on it faced the wall. I confirmed 9/9 "facing
    // into the park" twice on a check that shared the mistake, and only found
    // it by doing what the user actually asked for - sitting in one and
    // looking. camera = PI - mesh.
    ctx.seat({
      // h is SEAT_TOP, not SEAT_Y: see the derivation above. This was `0.45`.
      //
      // …PLUS WHERE THE BENCH ITSELF STANDS. `h` is measured from the ground
      // under the player (`fp.ts:486` adds it to `sgy`), but the bench group is
      // parked at `y0` — the LOWEST of three ground samples, so that a bench on
      // a slope rests on the ground rather than hovering at one corner. On flat
      // grass those agree and this term is 0; on the park's relief they differ
      // by 0.034 m, and without this the seat is right on nine benches and
      // wrong on the tenth. Measured both ways rather than assumed.
      x: bx, z: bz, yaw: Math.PI - yaw, h: SEAT_TOP + y0 - parkY(bx, bz),
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
  //
  // FOURTH TIME THE BENCHES HAVE COME BACK: *"these park benches are askew.
  // they should be in line with the path."* `Math.atan2(loopCx - bx, loopCz -
  // bz)` is a BEARING TO A POINT — the loop's own centre — and that only
  // equals "square to the run" at the exact midpoint of a leg. Anywhere else
  // on a 27 m leg it rotates toward the centre and goes off-square, worse the
  // further out you stand, which is exactly "askew" and exactly why it only
  // showed up once benches were spread along the full length of each leg.
  //
  // The loop's perimeter is axis-aligned (chamfered corners aside, and no
  // bench stands on a chamfer), so every leg a bench stands on runs along
  // exactly one axis. "Square to the run, facing the park side" is then: face
  // along the OTHER axis, using only THAT axis's offset from the loop centre
  // — the same bearing-to-centre principle §27 asked for, just with the
  // along-the-run component zeroed instead of left in. That keeps it derived
  // and loop-shape-agnostic (re-cut a leg and every bench on it re-derives)
  // without going back to a typed literal per leg, which is the mistake this
  // is replacing.
  const loopCx = (lx0 + lx1) / 2, loopCz = (lz0 + lz1) / 2;
  // a leg running in z (fixed x, varying z, i.e. the two street/west legs):
  // face along x only
  const facingAcrossZLeg = (bx: number, bz: number): [number, number, number] =>
    [bx, bz, Math.atan2(loopCx - bx, 0)];
  // a leg running in x (fixed z, varying x, i.e. the two end legs): face
  // along z only
  const facingAcrossXLeg = (bx: number, bz: number): [number, number, number] =>
    [bx, bz, Math.atan2(0, loopCz - bz)];
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
    if (clearOfGate(z)) benchRun.push(facingAcrossZLeg(lx1 + BENCH_OFFSET, z));
    benchRun.push(facingAcrossZLeg(lx0 - BENCH_OFFSET, z));
  }
  for (const x of spaced(lx0 + 4.5, lx1 - 4.5, 9.4)) {
    benchRun.push(facingAcrossXLeg(x, lz0 - BENCH_OFFSET));
    benchRun.push(facingAcrossXLeg(x, lz1 + BENCH_OFFSET));
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
  // SEEDED WITH THE BENCHES, which are already down by the time this exists.
  const footprints: AABB[] = [...benchBoxes];
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
  // Same granite as the frontage kerb.
  //
  // ── THIS IS THE GREY X ON THE CORNER ────────────────────────────────────
  //
  // It was four straight strips, each drawn the FULL length of its leg
  // (`lz0…lz1`, `lx0…lx1`) while the legs themselves stopped `CHAM` short of
  // the turn. So all four ran on past the end of the path they were edging,
  // straight through the corner and out into the grass beyond it, and the two
  // pairs crossed each other in the middle of the turn. What the user
  // photographed and called "so messed up" is literally a grey cross painted
  // over the corner, and no amount of work on the corner PATCH would have
  // touched it — the fault was never in the corner, it was in the edging that
  // did not know the corner existed.
  //
  // Now it is two closed rings off the loop's own `ring()`, so it mitres
  // through every turn by construction and cannot overrun something it is a
  // constant offset from.
  //
  // Two other things came off it in the same pass, both the user's own words:
  //
  //   FLAT, NOT PROUD. It stood 70 mm up as a box, which is a ROAD kerb
  //     profile — a road detail on a park path is exactly the complaint this
  //     surface has now been rejected twice for. A path edging is a haunched
  //     strip you walk over without noticing, and this world has a documented
  //     dislike of lips on paths (see the corners' §6 note above).
  //   IT GOES THROUGH `wet()`. The path did and the edging did not, so in rain
  //     the path darkened and the edging stayed put — which is why in the
  //     user's own dusk frame it reads as near-white rails flanking a dark
  //     brown path, the "very stark" he reported once already and which the
  //     palette change only half fixed. The two surfaces now weather together.
  const EDGE_T = 0.14;                               // how wide the strip reads
  const edgeM = () => {
    const m = wet(stoneOf(PK_STONE, 2.0, EDGE_T));
    m.map!.wrapS = m.map!.wrapT = THREE.RepeatWrapping;
    m.map!.repeat.set(1, 1);
    return m;
  };
  // A touch of the same wander, so the strip is not one flat grey ribbon for
  // 70 m either — the reason it read as a drawn line rather than as stone.
  const edgeTint = (_t: number, s: number): [number, number, number] => {
    const k = 0.93 + 0.05 * Math.sin(s * 0.23 + 1.1) + 0.03 * Math.sin(s * 0.71);
    return [k, k, k * 0.98];
  };
  for (const s of [-1, 1]) {
    band([s * (PATH_W / 2 - 0.04), s * (PATH_W / 2 + EDGE_T - 0.04)],
      KERB_H + LIFT * 1.6, edgeM(), PK_TILE, edgeTint);
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
  /** one hoop, standing across the path's direction, yawed to follow it */
  const hoop = (x: number, z: number, yaw: number, lean: number) => {
    const w = 0.58, h = 0.29;
    const g = new THREE.Group();
    for (const d of [-w / 2, w / 2]) {                  // two legs
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, 0.05), hoopM);
      leg.position.set(0, h / 2, d);
      leg.rotation.z = lean;
      g.add(leg);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, w), hoopM);
    top.position.set(0, h, 0);
    top.rotation.z = lean;
    g.add(top);
    g.position.set(x, KERB_H, z);
    g.rotation.y = yaw;
    scene.add(g);
  };
  // ── THE HOOPS FOLLOW THE LOOP, INCLUDING ROUND THE TURNS ────────────────
  //
  // They used to be four axis-aligned runs at `lz0+1.2 … lz1-1.2`, which meant
  // that at every corner two runs met at a hard right angle in the grass while
  // the path beside them chamfered — a square corner drawn next to a mitred
  // one, in the same frame, at the same distance. It is a smaller part of "this
  // corner looks messed up" than the grey X, but it is the same fault: a thing
  // that follows the path was told about the legs and not about the plan.
  //
  // 0.72 m apart, not 1.15. THE GREY CHEVRONS THE USER ASKED ABOUT are these:
  // a run of low iron hoop edging, the municipal thing that keeps feet off the
  // grass. At 1.15 m centres each hoop stands alone against the turf and reads
  // as a bracket somebody dropped — which is exactly what was reported, and a
  // fair reading of it. Closed up, the run reads as one piece of edging.
  const hp = clcg(0x64bb17);
  const HOOP_STEP = 0.72;
  {
    // THE FIELD SIDE ONLY — a negative offset is inside the loop. The run has
    // always been the inner one (it is what gives the grass an edge); putting
    // one outside as well would fence the gate spur off from the circuit.
    const pts = ringPts(-(PATH_W / 2 + 0.25));
    let s = 0;                                        // distance still to walk
    for (let i = 0; i < 8; i++) {
      const a = pts[i], b = pts[(i + 1) % 8];
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
      const yaw = Math.atan2(dx, dz);                 // this world's forward is (sin, cos)
      for (; s < len; s += HOOP_STEP) {
        const f = s / len;
        hoop(a[0] + dx * f, a[1] + dz * f, yaw, (hp() - 0.5) * 0.22);
      }
      s -= len;                                       // carried to the next edge
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
  // ── THE SHELTER IS DELETED ───────────────────────────────────────────────
  //
  // Third failure, and the desk's rule here is two failures then delete. It
  // offered the choice one more time — one coherent structure, or a bench and
  // a tree — and I am taking the bench and the tree rather than spending a
  // fourth attempt on a thing the user has now called ugly, fucked and jank.
  //
  // What is worth recording is that I could not see it. I MEASURED this roof
  // as correct: four identical posts, tops equal to 0.01 m, eaves seated
  // 0.50 m below the plate, `E-shelter` green. The user still read the eaves
  // as not landing and a bench as half outside. When a measurement says fixed
  // three times and the person looking says broken three times, the
  // measurement is answering a question nobody asked — my check tested the
  // eaves against the POST TOPS, and what reads wrong is the roof against the
  // whole silhouette. I never found the question that matched what they saw.
  //
  // A bench under a tree at the end of the axis does the same job the shelter
  // was there for — it terminates the view from the gate and gives the deep
  // half of the loop a destination — with nothing to get wrong.
  // ── THE SHELTER, RESTORED ────────────────────────────────────────────────
  //
  // I deleted this on a ruling of "third attempt or delete", and the desk has
  // withdrawn that ruling: the user liked the shelter and was complaining about
  // its EXECUTION, not the thing itself. So every past complaint is a DEFECT
  // LIST, not a verdict, and the list is: no z-fighting on the roof, posts
  // meeting the roof and the deck squarely, nothing intersecting the bin or the
  // noticeboard, and a floor you can actually stand under.
  //
  // Restored from the deleted block rather than rebuilt from memory — the
  // geometry it had was measured correct (four identical posts, tops equal to
  // 0.01 m, one BufferGeometry roof whose eaves hang 0.50 m below the plate)
  // and rebuilding would have risked losing that while trying to keep it.
  //
  // THE FLOOR IS THE APRON. It was already here, laid when the shelter was
  // gone, and it is exactly what the defect list asks for: the same buff
  // hoggin as the loop, abutting the west leg's own edge so the two surfaces
  // meet without fighting for a height (GOTCHAS 6). A shelter standing on the
  // site's grey slab is a shelter with no floor under it.
  const bx0 = shX + 0.5;
  lay(shX - 2.6, lx0 - PATH_W / 2, shZ - 2.6, shZ + 2.6, 'path');
  const SH_H = 1.55;                           // half the square plan, post centres
  // 0.22, not 0.18. The user's word was "spindly", and 0.18 m of section
  // carrying 2.4 m is 13:1 — right at the edge where a post stops reading as
  // something holding a roof up and starts reading as a stick.
  const SH_POST = 0.24;
  // 3.00, not 2.40. *"should be taller a lil bit"* — and the number that
  // matters is not the post top, it is the EAVES, because the eaves are the
  // low point and the thing you stand under. At 2.40 the skirt bottom sat at
  // 2.04 m world, which is a hand's breadth over a standing player. It is now
  // 2.47 m: clear air.
  const SH_TOP = 3.00;                         // post top, and the eaves
  // 0.55, and the overhang is half of what "chopped" means: the posts have to
  // sit INBOARD of the eave, so the roof reads as terminating past them rather
  // than being cut off at them.
  const SH_OVER = 0.55;                        // even, all four sides
  // 1.05. Raising the posts without re-pitching gives a taller FLAT lid, which
  // reads more chopped rather than less. The pitch goes 0.613 to 0.677 with the
  // raise, so the roof gets steeper as it gets higher.
  const SH_RISE = 1.05;                        // apex above the eaves
  // 0.24, not 0.14. The other half of "a thin skewed slab": a roof seen from
  // outside is mostly its EDGE, and a 0.14 m fascia at 4 m reads as a knife
  // edge — which is what a parasol has and a roof does not.
  // 0.30: the FASCIA. The other half of "chopped" — a roof seen from outside
  // is mostly its edge, and an edge with no depth is a plate that has been cut
  // square. This is the board that runs round the perimeter and gives the roof
  // a thickness you can see when you look up at it.
  const SH_SKIRT = 0.30;                       // the eaves' own depth, the fascia
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

    // ── THE UNDERSIDE IS WHAT YOU ACTUALLY LOOK AT ──────────────────────────
    //
    // You stand in a shelter and look UP. Until now that was the raw back of
    // the roof slopes: one flat tone across the whole ceiling, which is the
    // same fault B named on the forecourt — an untextured surface has no grain
    // and no joints, so it reads as a tint rather than as a thing.
    //
    // Boarded, across the span, at the eaves line so it closes the roof rather
    // than floating inside it. The boards run in one direction like real
    // ceiling boarding, with a rafter every 0.62 m across them — that pitch is
    // what gives the ceiling scale when you are two metres under it.
    const CEIL = E * 2;
    // ── THE JOINT WAS A THIRD OF EVERY BOARD ────────────────────────────────
    //
    // The user, item 171: *"shelter roof is still bugged in terms of
    // graphics."* Screenshot from under it, looking up: a dense
    // high-frequency stripe grid that shimmers instead of reading as boards.
    // He is right, and the arithmetic says exactly why.
    //
    // This canvas was `CEIL * 16` — 16 px/m — with the board pitch written as
    // `Math.max(3, Math.round(0.16 * 16))`. At 16 px/m a 0.16 m board is
    // **2.56 px**, so:
    //
    //     board  = round(2.56) = 3 px       the `max(3, …)` floor also fired
    //     face   = board - 1  = 2 px        what you see of the board
    //     joint  =              1 px        THE SHADOW IS 33% OF THE BOARD
    //
    // Two texels of timber and one of shadow is not boarding with a joint in
    // it, it is a 2:1 stripe — which is precisely the "dense stripe grid" in
    // his screenshot. The rafters had the same disease one step further on:
    // `max(2, round(0.07 * 16))` = max(2, **1**) = 2 px = **0.125 m**, against
    // the 0.07 m the line asks for, 79% over.
    //
    // **BOTH `Math.max` FLOORS FIRING IS THE CODE SAYING IT HAS RUN OUT OF
    // PIXELS.** A floor that is reached is a density that cannot draw its own
    // content, and it fails silently: every texel stayed perfectly square, so
    // `scripts/texdensity.mjs` — which judges an undeclared face on texel
    // ASPECT — never flagged it and never could. See the handoff note.
    //
    // ── SO: DECLARE THE DENSITY, DERIVE EVERY PITCH FROM IT (§7b) ───────────
    //
    // 32 px/m, an INTEGER multiple of the world's `WALL_PPM` of 8
    // (`ct/tex-world.ts:34`, and :67 for why the multiple must be integer:
    // "for surfaces that carry fine content … integer keeps texels square and
    // the course grid commensurate"). It is also the density B established for
    // every jointed surface in the world — `ct/civic.ts:404`, *"every other
    // ground surface here derives its canvas from its real metres at one
    // density — 32 px/m — and carries aggregate, staining and scoring
    // joints"* — and a boarded ceiling is a jointed surface.
    //
    // Every pitch below is now a WHOLE NUMBER of texels at that density, so
    // nothing rounds and nothing drifts across the span:
    //
    //     board pitch   0.25   m  =  8 px      joint 1 px =  12.5% of a board
    //     rafter pitch  0.625  m  = 20 px      the 0.62 m the note above asks
    //                                          for, landed on a texel
    //     rafter width  0.0625 m  =  2 px      was 0.125 m
    //
    // The board goes 0.16 m -> 0.25 m and that is the point, not a side
    // effect: 0.16 m boarding is finer than any density this world paints at,
    // and drawing it anyway is what produced the shimmer. Widening it is what
    // makes it read as boards from two metres underneath.
    const CEIL_PPM = 32;                       // 4 x WALL_PPM (ct/tex-world.ts:34)
    const BOARD_M = 0.25, RAFT_M = 0.625, RAFT_W_M = 0.0625;
    const ceilT = pixTex(Math.round(CEIL * CEIL_PPM), Math.round(CEIL * CEIL_PPM), (g) => {
      const px = Math.round(CEIL * CEIL_PPM), r = clcg(0x5ad13b);
      g.fillStyle = '#6b5f4a'; g.fillRect(0, 0, px, px);
      const board = Math.round(BOARD_M * CEIL_PPM);
      for (let y = 0; y < px; y += board) {
        g.fillStyle = r() > 0.5 ? '#75684f' : '#635844';
        g.fillRect(0, y, px, board - 1);
        g.fillStyle = 'rgba(38,30,22,0.45)';       // the shadow in each joint
        g.fillRect(0, y + board - 1, px, 1);
      }
      const raft = Math.round(RAFT_M * CEIL_PPM);
      for (let x = 0; x < px; x += raft) {         // rafters across the boards
        g.fillStyle = '#584e3d'; g.fillRect(x, 0, Math.round(RAFT_W_M * CEIL_PPM), px);
      }
      dither(g, px, px, Math.round(px * px * 0.01));
    });
    // DECLARED, so the next density sweep can judge this face instead of
    // guessing at it. `pixTex` leaves `userData.surface` unset and an
    // undeclared face is one `texdensity.mjs` can only test for squareness.
    declareSurface(ceilT, 'detail');
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(CEIL, CEIL), flat(ceilT));
    ceil.rotation.x = Math.PI / 2;                 // facing DOWN, at the player
    ceil.position.set(shX, KERB_H + SH_TOP - (SH_RISE / SH_H) * SH_OVER - SH_SKIRT + 0.005, shZ);
    shelterG.add(ceil);
    scene.add(shelterG);
  }
  // one bench, centred under it, facing out of the park's approach
  // …and it faces INTO THE PARK, like every other bench. It ran along x and
  // faced down the wall, which the per-instance facing check caught at dot 0.00
  // — square to the park rather than away from it, which is why looking at it
  // had not shown it up. The shelter stands at the park's west end, so the
  // interior is +x: the bench runs in z and faces east.
  // ONE GROUP, like every other bench. This one is built inline rather than
  // through `bench()`, so its slats and its own cast ends had no shared
  // ancestor and `E-benchsweep` read them as two props intersecting. A bench
  // overlapping itself is how it is built.
  const shelterBench = new THREE.Group();
  const SB_L = SH_H * 2 - 0.55;
  for (let i = 0; i < 3; i++) {
    const sl = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, SB_L), i % 2 ? woodM2 : woodM);
    sl.position.set(shX - 0.17 + i * 0.17, KERB_H + 0.45, shZ);
    shelterBench.add(sl);
  }
  for (const dz of [-1, 1]) {
    const end = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.45, 0.12), ironM);
    end.position.set(shX, KERB_H + 0.225, shZ + dz * (SB_L / 2 - 0.06));
    shelterBench.add(end);
  }
  scene.add(shelterBench);
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
    // PI - mesh yaw: the sitter's convention, not the mesh's. See bench().
    x: shX, z: shZ, yaw: Math.PI - Math.atan2(loopCx - shX, loopCz - shZ), h: 0.45,
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
  // ── TREE HEIGHTS: THE ITEM'S CLAIM WAS WRONG, AND WIDENED ANYWAY ─────────
  //
  // Item 172's second half says *"the trees are all roughly one canopy height,
  // the lamps one height, the wall one height — so even once the ground moves,
  // the silhouette stays a flat band."* MEASURED FIRST
  // (`scripts/probes/w83-park-canopy.mjs`, 12 trees selected by their 0.3 m
  // bark trunk rather than by size, which is the only non-circular way to pick
  // them): canopy tops ran 6.76 m to 9.54 m, a 2.79 m spread with sd 0.97 and
  // 9 of 12 distinct. They were never one height, and the previous author's
  // `6.6 + t2()*2.8` says so in the source.
  //
  // WIDENED REGARDLESS, because the user's ask is height diversity and this is
  // the cheapest place left to buy it now the ground is done: 5.6…10.6 m of
  // tree against 6.6…9.4, so the spread nearly doubles. The party walls are
  // `wallHeight(4)` = 13.0 m, so the tallest still stands below the skyline the
  // boundary gives it rather than poking over it.
  //
  // THE TRUNK IS NOW A FRACTION OF THE HEIGHT, not an independent draw. It used
  // to be `2.6 + t2()*1.0` against a height drawn separately, so a short tree
  // could roll a tall trunk — at the new range that pairs a 5.6 m tree with a
  // 3.6 m trunk and leaves a 2 m lollipop on a pole. 34–46% is the proportion
  // the old pair actually produced across its own range, so this keeps the
  // shape and lets the size move.
  //
  // No `rnd()`: `clcg(seed)` is per-tree and the object count is unchanged, so
  // the seeded stream and every texture downstream of it are untouched
  // (GOTCHAS §2).
  const tree = (x: number, z: number, seed: number) => {
    const t2 = clcg(seed);
    const h = 5.6 + t2() * 5.0, spread = 4.0 + t2() * 2.8, trunk = h * (0.34 + t2() * 0.12);
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
    // The tree run used to step around the shelter's footprint. The shelter is
    // gone and a TREE is half of what replaced it, so the exclusion shrinks to
    // the bench itself — the deep end of the axis now terminates in a tree
    // standing over a bench, which is what the shelter was there to do.
    if (Math.abs(tx - shX) < 2.6 && Math.abs(z - shZ) < 2.6) continue;   // the shelter
    tree(tx, z, 0x400 + Math.round(z * 3));                              // the back wall
  }
  // AND A TREE OVER THE BENCH. The desk's replacement for the shelter was "a
  // bench and a TREE", and I placed the bench and then told the tree run to
  // step around it — so the axis from the gate terminated in three benches in
  // a row against a wall with nothing over them, which reads as a bus stop,
  // not as the destination the shelter used to be.
  //
  // Set BESIDE the bench rather than on it: a tree you sit under is offset so
  // its trunk is not in your back and its canopy still reaches over you. This
  // is the one thing standing at the deep end now, so it is deliberate rather
  // than drawn from the boundary run's spacing.
  // NOT inside the shelter. This tree was planted when the shelter was gone
  // and would now stand in it; moved clear of the 2 m post ring, where it still
  // shades the deep end without touching anything.
  tree(shX - 3.9, shZ - 2.9, 0xE55);
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
  const clump = (x: number, z: number, n: number, spread: number,
    keep?: (px: number, pz: number) => boolean) => {
    for (let i = 0; i < n; i++) {
      // tight falloff: most of the clump sits inside a third of its spread
      const r = spread * Math.pow(wsd(), 1.8);
      const a2 = wsd() * Math.PI * 2;
      const big = wsd() < 0.13;
      const px = x + Math.cos(a2) * r, pz = z + Math.sin(a2) * r;
      // NOTHING GROWS DOWN THE MIDDLE OF A PATH PEOPLE WALK ON. The clump
      // CENTRES were always near the edge, but a clump scatters up to 0.64 m
      // and half the path is only 0.75 m, so individual tufts were landing
      // across the centre line — which is what the user is looking at. Placing
      // the centre correctly is not the same as placing the plant correctly,
      // and only the plant is visible.
      if (keep && !keep(px, pz)) continue;
      tuft(px, pz, wsd() < 0.17 ? 'dry' : 'dark',
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
        // STRADDLE the edge rather than sitting inside it: a weed at the kerb
        // of a path is half on the path and half in the grass, and the half in
        // the grass is the half that survives the mower.
        const off = half + 0.04 + wsd() * 0.30;
        clump(ax + ux * t + nx * sgn * off, az + uz * t + nz * sgn * off,
          2 + Math.floor(wsd() * 5), 0.34 + wsd() * 0.3,
          // and no tuft closer to the centre line than the edge itself
          (px, pz) => Math.abs((px - ax) * nx + (pz - az) * nz) >= half * 0.94);
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
  for (const dx of [-1.55, 1.55]) for (const dz of [-1.55, 1.55]) around(shX + dx, shZ + dz, 0.2, 2);   // the shelter posts
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
