import * as THREE from 'three';
import { pixTex, dither, declareSurface } from './paint';
import { L, ROAD_HALF, FACE, rnd } from './rng';
import { treeSprite, TREE_W, treePitTex, hydrantSprite, pigeonSprite,
         paperTex, scrapTex } from './tex-world';
import { gutterSurfaceY, GUTTER_W, KERB_CHAMFER as CHAMFER, soldierCourse,
         alley2Ground } from './tex-ground';
import { ORDER, type CtxBuild } from './ctx';
import { ALLEY2_SLAB_Y } from './alley-floor';
import { weedTuft } from './weeds';
import { BAY } from './bodega-corner';

// ── everything standing on the sidewalk, and the weather over it ──────────
//
// Rain, street trees, the bishop-crook lamps, the hydrant, the payphone, and
// the pigeons that peck along the kerb. Grouped because they share one job:
// they are the block's furniture. Nothing here is a building.
//
// ORDER IS LOAD-BEARING. The seeded stream (rnd) sets tree heights and pigeon
// placement, and the harness seeds Math.random to fingerprint the painted
// textures — so the sequence rain → trees → lamps → hydrant → pigeons →
// payphone must not be shuffled, here or against the modules around it.

export interface Props {
  /** streetlamp lenses + halos + road pools, on the night curve (0…1).
   *  Also drives the lamplight tint over everything registered with lit(). */
  setLampNight: (v: number) => void;
  /** register an object standing in the street so it CATCHES the lamplight.
   *  Same idea as the wet registry, but keyed on position: the object's
   *  distance to the nearest lamp head decides how much amber it takes. */
  lit: (root: THREE.Object3D) => void;
  /** register the rest of the block so it loses the ambient after dark */
  dimWorld: (root: THREE.Object3D) => void;
  /** rain flattens the light — nudge the sky colour toward the storm grey */
  rainSky: (c: THREE.Color) => void;
  /** advance the weather: fades in/out by the hour, tints the wet ground */
  updateRain: (dt: number, px: number, pz: number, hAbs: number) => void;
  /** drop a handful of cereal — replaces whatever was already down */
  scatter: (x: number, z: number, y: number) => void;
  updatePigeons: (dt: number, t: number, px: number, pz: number) => void;
}

export function buildProps(ctx: CtxBuild): Props {
  const { scene, flat, wet, obstacle, boards, wetMats, sidewalkY, KERB_H, seat, site } = ctx;
  // The wet registration is published from ct/tex-ground.ts, not here. This
  // module builds at crosstown.ts:210 and buildStreet — which places vice — at
  // :103, so anything set here arrives too late for a build-time caller. That
  // is the flaw in my first answer to 08ad3f0b, found by checking the call
  // order instead of assuming `scene` meant "available".
  // Everything this module adds gets userData.mod = 'props' at the end of
  // build (ct/lot.ts:1633's idiom). Measured before doing it: 726 of 3383
  // meshes in the world carried this stamp, all of them from two modules,
  // so 79% of any "whose face is this" question was still inference — which
  // is what put 9e1bce93 two rounds behind on faces that turned out to be
  // mine, and what GOTCHAS 25 records nearly misrouting a third time.
  const mark = scene.children.length;
  const WET = new THREE.Color(0x5a626e);
  // ── weather: some hours it rains ────────────────────────────────────────
  // A builder looking at a daytime storm reported "no rain particles in frame",
  // and they were right — but not for the reason either of us first guessed.
  //
  // Not daylight: the per-drop contrast against the sky is 111 of 255 levels at
  // 15:00 against 131 at 05:00, so a drop is nearly as visible by day.
  // Not the count: tripling it to 1500 made no visible difference at all.
  //
  // It is the SIZE. A drop was 0.22 world units with size attenuation on, and
  // the streak inside its sheet is one texel of eight — so at 15 m, in an 88°
  // field over 900 px, each drop is about 7 px tall and well under a pixel
  // WIDE. A sub-pixel hairline is mostly thrown away by the pixel grid however
  // many of them there are, which is exactly why more did not help.
  //
  // ── AND THAT IS WHY THE COUNT CAN BE RAISED NOW ─────────────────────────
  // The line above is still true of the world it was written in and is the
  // reason the count is only being touched now. Once size went 0.22 → 0.36 and
  // the sheath gave each drop its own contrast, a drop stopped being a
  // sub-pixel hairline — so N stopped multiplying nothing and started
  // multiplying something. Measured, not assumed: at rainLevel 0.99 the drops
  // painted 1.1–13.7% of the frame facing four ways, and the frame looking
  // south — the one with the most sky in it — carried about two dozen
  // countable streaks. Two dozen streaks is a drizzle at ANY opacity, which is
  // the real answer to "rain never gets heavy": rainLevel already reaches
  // 0.999 (measured), it just had nothing but alpha to spend itself on.
  //
  // 500 drops in a 30 x 14 x 30 m box is 0.04 per cubic metre. 2600 is 0.21,
  // and about a quarter of the box is in frame at any time, so a downpour is
  // ~650 streaks rather than ~130. The per-frame wrap loop is O(N) on a typed
  // array — 2600 is nothing next to the 3383-mesh scene it falls through.
  const RAIN_N = 2600;
  const RAIN_BOX = 30;   // world-space wrap period for raindrops
  const rainPos = new Float32Array(RAIN_N * 3);
  for (let i = 0; i < RAIN_N; i++) {
    rainPos[i * 3] = (Math.random() - 0.5) * RAIN_BOX;
    rainPos[i * 3 + 1] = Math.random() * 14;
    rainPos[i * 3 + 2] = (Math.random() - 0.5) * RAIN_BOX;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(rainPos, 3));
  const rainT = declareSurface(pixTex(8, 16, (g) => {
    // ── A PALE DROP ON A PALE SKY IS AN INVISIBLE DROP ────────────────────
    //
    // The user: *"how come i face some directions and it's not raining and then
    // i face a different direction and it is raining?"* — reported twice.
    //
    // It was never the rain. Counting drops inside the view frustum from one
    // spot, facing three ways: 142 down the street, 129 up it, 126 across at a
    // wall. The volume is even in every direction, so RAIN_BOX and the wrap are
    // NOT the bug and must not be touched.
    //
    // It is CONTRAST. This streak was `rgba(214,222,232)` — pale blue-white —
    // against a scene fog of `0x8a97a2`, pale blue-grey. Face along the street
    // and the top half of the view is sky and fog, near enough the same colour
    // that at a drizzle's ~0.16 opacity the drops dissolve into it. Face across
    // at dark brick and the identical drops read fine.
    //
    // So the drop needs to carry its own contrast rather than borrow it from
    // whatever is behind: a DARK SHEATH either side of a bright core. Against
    // sky the sheath reads; against brick the core does. One of the two always
    // has something to bite on, whatever it is falling in front of.
    //
    // The core stays ONE texel, which the previous note is right about — a
    // 2 px core reads as a thick dash at this point size and turns the rain to
    // falling grit. The sheath is the neighbouring columns at low alpha, so the
    // streak still measures one texel of bright and does not fatten.
    g.fillStyle = 'rgba(38,46,58,0.38)';                  // sheath, for pale skies
    g.fillRect(3, 1, 1, 14); g.fillRect(5, 1, 1, 14);
    g.fillStyle = 'rgba(226,234,244,0.82)';               // core, for dark walls
    g.fillRect(4, 1, 1, 14);
  }), 'detail');
  const rainM = new THREE.PointsMaterial({ map: rainT, size: 0.36, transparent: true, opacity: 0, depthWrite: false });
  // ── A DROP 60 cm FROM YOUR EYE IS A WHITE POST ──────────────────────────
  // Size attenuation makes gl_PointSize grow as 1/distance with no ceiling, so
  // a drop that wraps in close to the camera draws as a 200 px pale bar
  // standing in the middle of the street. It reads as a lamp post, not as
  // rain, and it is the one thing raising the drop count makes strictly worse:
  // the near-field is a fixed fraction of the box, so five times the drops is
  // five times the posts (~7 within 2 m at N=2600, against ~1.3 at N=500).
  //
  // Clamped in the shader rather than by moving drops out of a bubble around
  // the player: every drop must keep wrapping by WHOLE multiples of RAIN_BOX
  // or it stops being world-locked, which scripts/rain-check.mjs asserts and
  // which was itself a reported bug ("a personal rain cloud you could never
  // walk out from under"). Nothing moves here — the same drop is drawn, just
  // never taller than a hand's width of screen.
  rainM.onBeforeCompile = (s) => {
    const line = 'if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );';
    if (!s.vertexShader.includes(line)) return;   // three changed the chunk: leave it alone
    s.vertexShader = s.vertexShader.replace(line, `${line}\n\t\tgl_PointSize = min( gl_PointSize, 46.0 );`);
  };
  const rain = new THREE.Points(rainGeo, rainM);
  // ── THIS IS WHY IT RAINS IN SOME DIRECTIONS AND NOT OTHERS ──────────────
  // The user, twice: *"how come i face some directions and it's not raining
  // and then i face a different direction and it is raining?"* It was read as
  // a contrast problem both times. The sheath above is a real improvement and
  // should stay, but it was never the cause. THIS is.
  //
  // The renderer computes a geometry's bounding sphere ONCE, lazily, and
  // caches it on the geometry — measured live: centre (0, 7, 0), radius 21.5,
  // which is the box of random positions this file fills in at BUILD time,
  // sitting at the world origin. The drops then spend the rest of the game
  // being wrapped in world space to follow the player (see updateRain), and
  // nothing ever recomputes that sphere. The object's own transform never
  // moves either — deliberately, because the rain is world-locked — so the
  // renderer keeps culling a 21.5 m sphere at the origin while the drops it
  // describes are wherever you are.
  //
  // Standing on the pavement at (-6, -34) you are 34.5 m outside that sphere,
  // so the cull test stops being about the rain and becomes "can you see the
  // middle of the map". Measured there with onBeforeRender, which fires only
  // for objects that survive the cull: the rain was drawn on 4 of 8 headings
  // and drawn in ZERO frames on the other 4 — not faint, not low contrast,
  // ABSENT. scripts/w16-raindrawn.mjs is that check and it fails if this line
  // is removed.
  //
  // Culling is worthless here anyway: the volume is recentred on the camera
  // every frame, so the correct answer is always "visible". Recomputing the
  // sphere each frame would also work and would cost an O(N) pass over 2600
  // drops to arrive at that same answer.
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);
  let rainLevel = 0;      // is it raining RIGHT NOW — drives the falling drops
  let stormNow = 1;       // how HARD this particular storm is; see stormAt
  // The ground has its own state, and it is not rainLevel. Tying the wet look
  // straight to the rain made the street bone dry the instant the last drop
  // landed, which is the one thing a wet street never does.
  let wetness = 0;        // how wet the GROUND is: rises fast, falls slowly
  let soak = 0;           // how long it has been coming down — a long storm
                          // leaves more water to get rid of
  const RAIN_SKY = new THREE.Color('#5a626e');
  // STANDING PUDDLES ARE GONE — desk ruling, 2026-07-25, after five passes.
  // `puddleLevel`, `roadNow` and `PUDDLE_C` lived here and existed only to
  // colour them; the live road-luminance tracking in updateRain went with
  // them. See the note where the meshes used to be built, further down.
  // RAIN HAS TO BE FINDABLE. It was 6 hours in 24 and the first one a hundred
  // real seconds from spawn, and the user has now asked about rain four times
  // — a feature nobody can see is not a feature. Two changes, and only one of
  // them is the odds.
  //
  // The odds go to 8 hashed hours in 24, and they CLUSTER — 0,1 then 5,6 then
  // 10,11 then 15, 20 — because weather arrives as fronts rather than as
  // isolated hours.
  //
  // The opening storm is separate and deliberate. The world starts at 13:20
  // and a game hour is 60 real seconds, so the first hashed storm at 15:00 is
  // 100 seconds of standing about. The hash cannot be made to rain at 14:00
  // without raining nearly always — its value there is 94 of 100 — so this is
  // an explicit exception rather than a tuned threshold, and it puts the first
  // storm 40 seconds from spawn.
  const OPENING_H = 14;
  // WHY A MIXER AND NOT A MULTIPLY. `Math.imul(h, K) % 100` looks like a hash
  // and is an arithmetic progression: consecutive hours step by K mod 100, so
  // the rainy hours land on a lattice. cd37b59b did the arithmetic over 5000
  // game days and found the consequence —
  //
  //   dry spells were ONLY EVER 1, 2, 3, 4, 7 or 8 hours, capped at 8
  //   a midday with twelve dry hours behind it had never occurred, and could not
  //
  // A street that is never dry for more than eight hours never reads as dry,
  // which quietly costs the contrast "make wetness last a lil after it stops
  // raining" was asked for. The weather was periodic, not random.
  //
  // Murmur3's finalizer avalanches instead, and the spell lengths come out as
  // independent hourly draws actually look:
  //
  //   dry   1h x5590  2h x4180  3h x3262 … 12h x223 … 23h x15
  //   wet   1h x17052 2h x4282  3h x1019 … 7h x2
  //   frequency 25.3% before, 25.1% after — the rate is unchanged
  const mixHour = (h: number) => {
    let x = h | 0;
    x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b);
    x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35);
    x ^= x >>> 16;
    return x >>> 0;
  };
  const rainAt = (h: number) =>
    (((h % 24) + 24) % 24) === OPENING_H || (mixHour(h) % 100) < 30;
  // PUBLISHED, so nothing has to mirror it. scripts/rain.mjs and
  // scripts/wetness.mjs each carried a hand-copy with the comment "keep in step
  // with rainAt() in ct/props.ts" — two copies of a formula that just turned out
  // to be wrong, which is two places to forget.
  scene.userData.rainAt = rainAt;
  // ── HOW HARD, not just WHETHER ──────────────────────────────────────────
  // `rainAt` answers a yes/no question and `rainLevel` is only the ramp onto
  // that answer — it settles at 0.999 within ~11 real seconds of a wet hour
  // starting (measured), and a game hour is 60 real seconds, so EVERY storm
  // was the same storm. There was no intensity axis anywhere in the weather.
  //
  // `stormAt` is that axis. Same murmur3 finalizer as the hour draw, offset so
  // it is an independent draw rather than a second read of the same bits.
  //
  // TWO SEPARATE KNOBS, AND THE USER'S COMPLAINT SITS AT BOTH ENDS OF THEM.
  //
  //   *"rain seems extra intense now. thats fine but i want a drizzle to also
  //    exist and be more likely than the downpour featured here."*
  //
  // This used to be `0.62 + 0.38 * u` — a UNIFORM draw over 0.62…1.00. Sampled
  // over 20000 hours that is 6607 storms of which **100% were at half strength
  // or heavier**, mean 0.811, and the bottom twelve histogram bins were empty.
  // Drizzle was not rare, it was unreachable.
  //
  // The obvious move — drop the floor — is half the fix and the dangerous half.
  // The 0.62 floor is on file against the OPPOSITE complaint, that rain is too
  // faint, so lowering it alone trades one report for the other. Both knobs
  // have to move, and they do different jobs:
  //
  //   FLOOR  makes drizzle POSSIBLE.  Set to 0.34 by looking, not by taste:
  //          frames were taken across the new range from street level against a
  //          bright sky (the hardest case to read), and 0.34 is the lowest
  //          strength where the drops still plainly read as rain rather than as
  //          a few specks. `heavy` spends itself on drop COUNT, opacity and
  //          fall speed at once, so at 0.34 that is ~884 of 2600 drops at 0.24
  //          alpha coming down at 16 m/s — thinner and slower than the old
  //          weakest storm, still unmistakably weather.
  //
  //   CURVE  makes drizzle LIKELY, which is the half he actually asked for.
  //          Squaring the uniform is the whole change. It is worth stating why
  //          it is defensible rather than merely convenient: for u uniform,
  //          u**2 has density 1/(2*sqrt(x)), which is strictly DECREASING over
  //          the whole range — so every light band is more common than any
  //          equally wide heavier band, everywhere, not just on average. The
  //          mean moves from the midpoint to a third of the way up.
  //
  // A distribution is invisible in one frame, so it is checked as a histogram
  // over thousands of storms by `scripts/probes/w59-storm-dist.mjs`, which
  // fails if the light half stops outnumbering the heavy half.
  //
  // The RATE of rain is deliberately untouched — `rainAt` still says it rains
  // about a third of hours. Only how hard changed.
  const STORM_FLOOR = 0.34;
  const stormAt = (h: number) => {
    const u = (mixHour(h + 9973) % 1024) / 1023;
    return STORM_FLOOR + (1 - STORM_FLOOR) * u * u;
  };
  scene.userData.stormAt = stormAt;

  // billboard sprites: trees, hydrant, pigeons
  function board(tex: THREE.Texture, w: number, h: number, x: number, z: number): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(w, h);
    geo.translate(0, h / 2, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }));
    m.position.set(x, 0, z);
    boards.push({ m });
    scene.add(m);
    return m;
  }
  // ── the lamplight registry ──────────────────────────────────────────────
  //
  // The world is entirely MeshBasic — there are no lights to respond to — so
  // "being lit" is done the same way "being wet" already is: keep the base
  // colour of every material that stands in the street, and each frame lerp
  // it toward a sodium amber. Unlike rain this depends on WHERE the thing is,
  // so we keep the root object too and measure it against the lamp heads.
  //
  // Cost: a few dozen objects against eight lamps, once a frame, and only
  // after dusk — by day the night curve is 0 and the whole pass returns
  // immediately. No per-vertex or per-pixel work anywhere.
  // A LAMP HEAD, and its pool may be a street lamp's or a doorway fitting's.
  // `r`/`core` default to LAMP_R/LAMP_CORE where they are absent, so every
  // existing push is unchanged; only the auto-registered wall fittings in
  // dimWorld carry the short ones.
  const lampHeads: { x: number; z: number; r?: number; core?: number }[] = [];
  /** a bulkhead over a back door is a 60 W fitting, not sodium on a pole */
  const FITTING_R = 2.6, FITTING_CORE = 0.7, FITTING_MAX = 1.6;
  /** materials already taken as auto-sources, so one sheet cannot seed two */
  const LAMP_SEEN = new WeakSet<THREE.Material>();
  // ── DECLARING A LIGHT, from any module ──────────────────────────────────
  //
  // `lampHeads` is what updateLit pools from, and it was private. That is the
  // fault behind the alley back door: D hung a wall lamp over it, and the lamp
  // GLOWS but does not CAST, because there is no way for another module to say
  // "there is a light here". So the glow is painted into the wall sheet, the
  // door is a different mesh with no such painting, and the pool stops dead on
  // the door's outline. I told D to call `ctx.lit(doorMesh)` and that was wrong
  // — the door is already registered and already poolable; what is missing is
  // the SOURCE.
  //
  // Published on the scene rather than through ctx, deliberately: ct/tex-ground
  // already publishes the wet registration this way for exactly the same reason
  // — "reachable by anyone holding `scene`" — and it means crosstown.ts, which
  // is not mine, needs no edit for a builder to light something.
  //
  // Read EVERY FRAME by updateLit, so it does not matter when you call this
  // relative to the grade. A lamp declared after dimWorld still pools.
  //
  //     (scene.userData as any).addLamp?.(x, z)
  //
  // It takes the head's world x/z only. Height is not a parameter because the
  // pool model is planar — LAMP_R is a radius on the ground, and a wall lamp
  // 2.5 m up pools the same as a street head 5 m up. That is a simplification
  // and it is the one already in use for all 21 lamps.
  //
  // IT RETURNS A WAY TO TAKE THE LIGHT BACK OUT, and that is not decoration.
  // C registered the television in 301 through this, then had to DELETE the
  // registration rather than switch it off — because until now a head could
  // only ever be added. Until C spotted it, the set pooled light on the boards
  // all night with the screen dark, which fights *"make the unilluminated
  // stuff darker, it should feel scarier at night"* directly, in the one room
  // he sleeps in. A light that can be turned on and never off is not a light,
  // it is a decision.
  //
  //     const off = (scene.userData as any).addLamp?.(x, z);
  //     ...
  //     off?.();          // dark again; call addLamp once more to relight
  //
  // The remover is idempotent and safe to call twice — it removes THIS head by
  // identity, not by position, so two fittings at the same coordinate cannot
  // put each other out.
  (scene.userData as Record<string, unknown>).addLamp =
    (x: number, z: number, r?: number, core?: number) => {
      const head = { x, z, r, core };
      lampHeads.push(head);
      return () => {
        const i = lampHeads.indexOf(head);
        if (i >= 0) lampHeads.splice(i, 1);
      };
    };
  // Each entry keeps the PART's offset inside its parent, not just the parent,
  // so a 4.5 m car doesn't shift as one block — its near end catches the pool
  // and its far end doesn't.
  // `wx/wz` — A FIXED WORLD POINT, for anything that does not move.
  //
  // The pool branch of updateLit locates a material as `root.position` plus
  // `ox/oz` rotated by `root.rotation.y`. That is exactly right for a car: the
  // root is the car group, the offsets are the part's place within it, and the
  // whole thing drives around.
  //
  // It is wrong for everything dimWorld collects, which registers
  // `{ root: o, ox: 0, oz: 0 }` — so the sample point is `o.position`, the
  // mesh's LOCAL position. That is the world position only when nothing above
  // it in the scene graph is transformed, and plenty is. Measured at 23:00:
  //
  //   149 materials within 1.8 m of a lamp by WORLD position — only 42 poolLit
  //    17 materials carrying poolLit while over 9 m from any lamp
  //
  // The second number is the one that cannot be argued with: `poolLit` is
  // stamped when a pool holds a material at full daylight, and there is no lamp
  // within nine metres of those seventeen. One offender stands at world
  // (3.7, -49.7), 1.39 m from a lamp, while its local (0.0, -1.3) is 8.7 m from
  // one — so it is graded as if it were somewhere it is not.
  //
  // Static geometry does not need the moving-root machinery at all, so when
  // `wx/wz` are present the pool branch uses them directly. Cars keep the old
  // path; nothing about them changes.
  interface Lit { root: THREE.Object3D; ox: number; oz: number; m: THREE.MeshBasicMaterial;
                  base: THREE.Color; pool: boolean; floor: number; wetK: number;
                  wx?: number; wz?: number;
                  // the mesh's world AABB in plan, and how much of the pool it can
                  // take. See the note at `poolable` — these exist so a pool is
                  // sampled at the nearest point of a surface rather than at its
                  // centre, which is what made pools stop at invisible seams.
                  bx0?: number; bx1?: number; bz0?: number; bz1?: number; sizeW?: number;
                  // THE POOL NOW HAPPENS IN THE SHADER, and this is the one
                  // value it needs from the CPU: this material's ambient for
                  // this frame. Per material because the night floor is per
                  // elevation — a shopfront and the road under it are on
                  // different floors and must stay that way. Present only on
                  // entries whose material was handed to attachPool.
                  ambU?: { value: number } }
  const litList: Lit[] = [];
  const litSeen = new Set<THREE.Material>();
  // WHAT COUNTS AS GLASS. The night grading skips translucent materials on
  // purpose — blending a graded colour through a pane is the pane's business,
  // not the grader's. But `transparent` alone is the wrong test, because a
  // material that also sets `alphaTest` is not translucent at all: alphaTest
  // DISCARDS the fragment, so it never blends and grading it is safe.
  //
  // GOTCHAS §22 names the failure and ct/lot.ts was fixed for it, but the flag
  // pair is set in a lot of places — measured, 101 materials across the street,
  // the car lot and the park were standing at 100% of daylight brightness at
  // 23:00 while the road under them sat at 4.5%. Fixing each one means finding
  // every author; fixing the TEST fixes all of them at once, and it is right on
  // its own terms rather than as a workaround. A mis-flagged cut-out now joins
  // the world's grading; genuine glass still does not.
  // WAS `m.transparent && !(m.alphaTest > 0)`, and e91df374 is right that it
  // carried three meanings at once:
  //
  //   1. ADDITIVE LIGHT — halos, pools, the wall splash. Driven by nightLit on
  //      their own curve; grading them would fight that. 50 of my 67.
  //   2. GENUINE non-diffuse surfaces — glass, chrome, rubber. Those carry
  //      `noLight`, the house convention, honoured on the line below.
  //   3. ORDINARY TRANSPARENT DECALS — contact shadows, grime stains. Diffuse
  //      surfaces that happen to blend, and they were being excluded with the
  //      other two.
  //
  // Measured what (3) cost: every litter piece has a transparent sub-material
  // and it did not dim.
  //
  //   milk crate opaque parts   noon 1.000 -> night 0.045
  //   milk crate transparent    noon 1.000 -> night 1.000
  //
  // That is the crate photographed glowing. A contact shadow held at full
  // daylight over ground at 0.045 is a black hole under the object at midnight.
  //
  // Only ADDITIVE is excluded here now; `noLight` at :280 still covers real
  // glass, so nothing that was deliberately exempt loses its exemption.
  const isGlass = (m: THREE.MeshBasicMaterial) => m.blending === THREE.AdditiveBlending;
  // How far a lamp reaches, and how it gets there. A sodium head 5 m up on a
  // 1.25 m crook lights a STRETCH of pavement — you walk out of one pool and
  // into the next — and the old 4 m radius with a straight linear falloff made
  // a spot instead, bright directly underneath and gone by the time you had
  // taken three steps.
  //
  // The fix is deliberately "keep the centre, move the edge": inside
  // LAMP_CORE the light is at full strength, and only outside it does the
  // shoulder begin, running all the way out to LAMP_R. So the brightest part
  // is exactly as bright as it was — this is not a brightening pass — but it
  // holds that value across a real patch of ground and then takes 5 m to die
  // instead of 4. Combined with the floors coming down, that is more CONTRAST
  // rather than more light: the lit stretch is longer AND the gap between two
  // of them is darker.
  //
  // 7 m is chosen against the lamp spacing, not picked. Heads sit at x = ±4.3
  // alternating every 14 m, so consecutive heads are 16.4 m apart; at 7 m the
  // pools still fall short of each other by 2.4 m and the dark stretch between
  // them survives. Take this much past 8 and the street becomes continuously
  // lit, which is the opposite of what was asked for.
  const LAMP_R = 7.0, LAMP_CORE = 1.8;
  // Sodium light WARMS a surface, it does not repaint it. So the base colour
  // is MULTIPLIED by a warm factor rather than lerped toward amber: a dark
  // green sedan stays a dark green sedan, slightly warmer. Lerping toward a
  // flat amber dragged every dark texel — glass, wheel arches, tyre rubber —
  // up toward brown, which is what read as a graphics bug. Multiplying can't
  // do that: near-black × 1.15 is still near-black.
  const WARM_R = 1.15, WARM_G = 1.05, WARM_B = 0.85;
  // ── night, done in the WORLD instead of on the lens ────────────────────
  //
  // A fullscreen wash does not make darkness, it removes CONTRAST: every
  // surface loses the same light, so the gaps between lamps end up exactly as
  // bright as the pools under them and the frame flattens to one grey. So the
  // wash is pulled right down (see ct/hud.ts) and the materials themselves go
  // dark, the same way wetMats already takes them toward wet.
  //
  // That gives the lamps something to work against: NIGHT_FLOOR is what is
  // left of the ambient at 3am, and POOL_GAIN is what a lamp hands back — so
  // a car under a lamp sits near daylight while the kerb 8 m away is at a
  // third of it. The dynamic range is the gap between those two numbers.
  // A single NIGHT_FLOOR of 0.30 left a third of daylight on every unlit
  // surface, which is why the road read as daylight asphalt with a filter over
  // it. It is now per-surface, because HEIGHT COSTS LIGHT — the lamps are 5 m
  // up and throw down, so nothing above them has anything lighting it at all,
  // while a shop window is its own light source and must not come down with
  // the street.
  //
  //   GROUND  road, walk, cars, people — between lamps this is nearly black,
  //           and you should lose the kerb line in it. POOL_GAIN buys it back
  //           under a lamp, which is where the dynamic range now lives.
  //   LOW     shopfronts, signs, lit windows at eye level. Deliberately left
  //           where it was: these are the reward for the street going dark.
  //   HIGH    upper floors and roofs. A 5th-floor window surround has nothing
  //           on it.
  // ── rain on the WALLS ───────────────────────────────────────────────────
  //
  // Only horizontal surfaces were ever in wetMats, so every facade stayed bone
  // dry through a storm and the rain read as something happening to the floor.
  // Walls join through the SAME sweep that darkens them at night — one writer
  // per material, which is the rule that keeps this from fighting the night
  // pass.
  //
  // A wet wall is not just a darker wall: it goes cooler and more saturated,
  // it is worst at the BASE where the pavement throws splash back at it, and
  // it dries from the top down. The base/top split is expressible because the
  // shopfront box and the facade box above it are separate meshes — the same
  // property the night grading leans on.
  const WET_WALL = new THREE.Color(0.72, 0.80, 0.94);   // darker AND cooler
  const SPLASH_H = 1.15;        // how far up the pavement throws water
  // FLOOR_LOW was 0.30 and had quietly become the brightest thing left: with
  // GROUND at 0.07 the eye-level band sat at FOUR TIMES the road, which is
  // much of what still read as "not dark enough". Lit signage keeps its
  // brightness because it is bright in the SHEET; the unlit masonry beside it
  // has no business being four times the pavement.
  // Night five. All three floors come down, because what was being asked for
  // across four rounds is CONTRAST, not less light — and the way to get it is
  // to make the unlit parts darker while the lamps hand back exactly as much
  // as they did. Wider pools (piece 1) against deeper gaps (here) is the same
  // idea pushed from both ends, and "scarier" is what that combination
  // produces.
  //
  // FLOOR_SIGN is the piece that makes this safe. A lit window or an
  // illuminated fascia must NOT come down with the masonry beside it — that is
  // the whole reward for a dark street — and until now nothing could tell them
  // apart, because every one of these materials has color = white and keeps
  // all of its brightness in the TEXTURE. See isSelfLit below.
  const FLOOR_GROUND = 0.045, FLOOR_LOW = 0.115, FLOOR_HIGH = 0.03;
  const FLOOR_SIGN = 1.0;      // a light source does not dim when the sun sets
  // WAS 12, AND 12 WAS CALIBRATED AGAINST A WORLD WHERE ALMOST NOTHING POOLED.
  //
  // With the span taper in force the only things a lamp could hand light back
  // to were objects under ~6 m across — a hydrant, a person, a car — so the
  // gain was set by how bright those small things should get, and it never had
  // to describe an AREA. Now that the road and the pavement take the same term,
  // 12 covers most of the near field: at full night the ambient is 0.045, so
  // 0.045 x (1 + 12) = 0.585, and a 14 m circle of ground at 58% of daylight
  // reads as "the street is lit" rather than "there is a lamp there". Measured
  // on the four standing frames, mean luminance roughly doubled, and looking at
  // them the dark asphalt the user likes had gone flat and grey.
  //
  // 6.5 puts a fully-pooled surface at 0.045 x 7.5 = 0.34, which is about where
  // the painted road decal already sat (0.72 opacity additive over the same
  // floor) — so the pool under a lamp lands close to the one the user has been
  // looking at all along, and the change is that the pavement and the car now
  // get it too instead of only the roadway.
  const POOL_GAIN = 6.5;       // what a lamp hands back, against the deep floor
  const LOW_Y = 3.0, HIGH_Y = 12.0;   // the elevation the light runs out over
  // splash-back is a ground-level phenomenon: full strength at the pavement,
  // gone by the second floor. Also used as the drying rate — the top dries
  // first because it was never as wet.
  // Full strength at the pavement and never below a third up top: rain wets a
  // whole building, it just soaks the bottom worst. Decaying to almost nothing
  // by the second storey (the first cut of this) left the upper floors 2%
  // darker, which is not visible at all.
  const wetKFor = (y: number) => Math.max(0.35, Math.min(1, 1.15 - y / 12));
  const floorFor = (y: number) => {
    if (y <= 1.0) return FLOOR_GROUND;
    const t = Math.min(1, Math.max(0, (y - LOW_Y) / (HIGH_Y - LOW_Y)));
    return FLOOR_LOW + (FLOOR_HIGH - FLOOR_LOW) * t;
  };
  let nightNow = 0;
  /** where the player is standing, for picking which lamps to upload. Written
   *  by updateRain, which is handed it every frame; updateLit is not. */
  let playerX = 0, playerZ = 0;
  const ambient = (floor: number) => 1 - nightNow * (1 - floor);
  // ── LAMPLIGHT PER FRAGMENT, WHICH IS THE WHOLE OF ITEM 95 ───────────────
  //
  // The user: *"lighting needs a full refactor. it isnt consistent anywhere.
  // this is a prime example. the lighting only affects the street but not the
  // sidewalk. it doesnt affect the car at all."* He is right, and the cause is
  // not a registry anybody forgot to sign up to — it is that a pool was
  // computed ONCE PER MATERIAL.
  //
  // Measured before touching anything (scripts/probes/w45-whatisdark.mjs), at
  // the lamp at (4.1, -23), every material within 4.5 m of the head, daylight
  // colour against 23:00 colour:
  //
  //     held up by the lamp (night/day > 0.5):   3
  //     at the night floor  (night/day <= 0.2): 38
  //
  // and the three were a 0.1 x 0.1 lamp post and two 0.1 x 0.1 sign posts.
  // The road ribbon (60 x 124.5) read 0.045. The kerb (1.9 x 92.8) read 0.045.
  // Every shopfront read 0.030-0.115. They were not unregistered — they nearly
  // all carried `graded` — they were registered and then REFUSED, by the span
  // taper below feeding `poolable = wy.y < 4.5 && sizeW > 0`.
  //
  // AND THE TAPER WAS RIGHT. Its own comment states the real ceiling: "one
  // material carries ONE tint, so a 92 m road ribbon cannot hold a gradient.
  // Pool it and the whole street lifts uniformly, which would flatten the
  // pools the user likes — I did exactly that once with a shared-material fix
  // and had to revert it." That is true of every fix that stays on the CPU.
  // Every surface a lamp stands on in this world is longer than 12 m, so the
  // taper was not excluding an unlucky few: it was excluding ALL GROUND, by
  // construction, and the pool you can see on the road is not tinting at all —
  // it is a painted 5.6 x 5.6 additive quad laid on the roadway. There is no
  // such quad on the sidewalk and none on a car, which is the screenshot.
  //
  // So the fix is to move the SAME MATH one stage down the pipe: evaluate the
  // pool at each fragment's world x/z instead of once at the mesh's centre.
  // Then a 92 m ribbon holds a gradient, the taper's premise dissolves, and
  // every surface is lit on identical terms whether or not anyone remembered
  // it — which is what "consistent anywhere" has to mean.
  //
  // THIS IS NOT CONVERTING THE WORLD TO REAL LIGHTS, and that distinction is
  // the reason it is safe. There are no normals in this, no diffuse term, no
  // light type, no shading of any kind. Every material stays MeshBasicMaterial
  // and every texel keeps its painted value; the only thing added is the
  // existing falloff — LAMP_R, LAMP_CORE, the same smoothstep, the same
  // POOL_GAIN, the same WARM_* multiply — read at a fragment instead of at a
  // centroid. A surface far from every lamp comes out bit-identical to what it
  // was. That is why the "warmed greenhouse" failure cannot recur here: the
  // thing that made 8 px/m art read as a brown slab was shading it by normal,
  // and there is no normal anywhere in this block.
  //
  // Cost: one program, shared. The injected source is identical for every
  // material, so three.js compiles it once and every patched material reuses
  // it — customProgramCacheKey below makes that explicit rather than lucky.
  // ── WHAT THIS COSTS, MEASURED, AND WHY IT IS 16 AND NOT 64 ─────────────
  //
  // First cut uploaded all 27 heads into 64 slots and let every patched
  // fragment walk the list. Frame time at (2.6, -23), 120 frames, median:
  //
  //                    day 13:00     night 23:00
  //     before          47.1 ms        50.0 ms
  //     64 slots, all   64.7 ms       129.8 ms
  //
  // Night went 2.6x slower — 20 fps to 8 — and DAY got 38% slower too, which
  // is the tell: the loop ran in broad daylight, when uPoolNight is 0 and every
  // iteration is multiplied away. Two things follow, and both are in the shader
  // rather than in how much light there is:
  //
  //   1. Skip the whole block unless it is actually night. The branch is on a
  //      uniform, so it is coherent across every fragment in the draw and costs
  //      nothing to take.
  //   2. Upload only the lamps NEAR THE PLAYER. A pool is 7 m across; the 16th
  //      nearest head is already ~60 m away, past the point where its pool is
  //      more than a smudge in the fog. updateRain is handed the player's
  //      position every frame, so this needs no new plumbing.
  //
  // 16 slots rather than 27 also matters on its own: a uniform-bounded loop is
  // not guaranteed to early-out on every driver, so POOL_MAX is the real worst
  // case and it should be the smallest number that cannot be noticed.
  const POOL_MAX = 12;                 // uniform slots; 27 heads exist, nearest win
  const poolLampU = Array.from({ length: POOL_MAX }, () => new THREE.Vector4());
  const uPoolLamps = { value: poolLampU };
  /** scratch for the nearest-first sort, reused so the per-frame pass allocates
   *  nothing */
  const lampNear: { x: number; z: number; r?: number; core?: number }[] = [];
  const uPoolCount = { value: 0 };
  const uPoolNight = { value: 0 };
  // THE POOL IS PLANAR — it always was; `addLamp` takes x/z and no height, and
  // the note there says so. On the ground that is exactly right. On a wall it
  // is not: a planar pool would light a 15 m facade evenly to the roofline,
  // because every fragment shares the lamp's plan distance. The old code hid
  // that behind `wy.y < 4.5`, a cliff on the MESH's centre — which is why a
  // shopfront whose box runs y 0-15 got nothing at its base either.
  //
  // Per fragment the honest form is available: fade the pool out with the
  // fragment's own height. Full strength up to a car roof, gone by the top of
  // a shopfront, so a lamp lights the ground, the cars and the people on it
  // and the bottom of what they stand against — and the fifth floor still has
  // nothing on it, which is what FLOOR_HIGH is for.
  const POOL_Y0 = 2.2, POOL_Y1 = 4.5;
  const nf = (n: number) => n.toFixed(5);
  const POOL_FRAG = `
// TWO UNIFORM-OR-VARYING TESTS BEFORE THE LOOP, both exact rather than
// approximations. Daylight skips it outright. And a fragment above POOL_Y1 is
// multiplied to zero by the height fade below anyway, so walking the lamp list
// for it is pure waste — this is most of the fragments on a 15 m facade, and
// facades are the deepest overdraw on the street.
if (uPoolNight > 0.0 && vPoolW.y < ${nf(POOL_Y1)}) {
  float w45best = 0.0;
  for (int i = 0; i < ${POOL_MAX}; i++) {
    if (i >= uPoolCount) break;
    vec4 L = uPoolLamps[i];                       // x, z, radius, core
    // BRANCHLESS, AND IT IS THE SAME FUNCTION, not an approximation of it:
    //   1 - (d - C)/(R - C)  ==  (R - d)/(R - C)
    // so the "full strength inside the core" case is just the clamp at 1, and
    // the "past the radius" case is the clamp at 0. Two branches per lamp per
    // fragment came out of the inner loop for nothing.
    float d = distance(vPoolW.xz, L.xy);
    w45best = max(w45best, clamp((L.z - d) / max(L.z - L.w, 1e-3), 0.0, 1.0));
  }
  // the same smoothstep the CPU pass used, and the same reason: squared alone
  // only reaches 0.23 two metres out, too faint to read as lit at all
  float w45k = uPoolNight * (w45best * w45best * (3.0 - 2.0 * w45best));
  w45k *= 1.0 - smoothstep(${nf(POOL_Y0)}, ${nf(POOL_Y1)}, vPoolW.y);
  float w45mul = min(1.0, uPoolAmb * (1.0 + w45k * ${nf(POOL_GAIN)}));
  // diffuseColor already carries base * uPoolAmb, written by updateLit, so
  // dividing it back out lands exactly on the old formula's base * mul * warm
  diffuseColor.rgb *= (w45mul / max(uPoolAmb, 1e-4)) * vec3(
    1.0 + (${nf(WARM_R)} - 1.0) * w45k,
    1.0 + (${nf(WARM_G)} - 1.0) * w45k,
    1.0 + (${nf(WARM_B)} - 1.0) * w45k);
}`;
  /** ambient uniforms for the WET registry, whose materials updateRain owns
   *  and which therefore never appear in litList. Keyed by material because
   *  `WetSurface` lives in ct/ctx.ts and is not this module's to widen. */
  const wetPoolAmb = new Map<THREE.MeshBasicMaterial, { value: number }>();
  /** Give one material the per-fragment pool. `ambU` is its own ambient for
   *  this frame — per material because the night floor is per elevation. */
  const attachPool = (m: THREE.MeshBasicMaterial, ambU: { value: number }) => {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uPoolLamps = uPoolLamps;
      sh.uniforms.uPoolCount = uPoolCount;
      sh.uniforms.uPoolNight = uPoolNight;
      sh.uniforms.uPoolAmb = ambU;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vPoolW;')
        // after <begin_vertex>, `transformed` is the local position this vertex
        // will actually be drawn at, so the world point is exact even where a
        // parent group is transformed — which is the same bug the wx/wz fields
        // were added to fix on the CPU side.
        .replace('#include <project_vertex>',
          'vPoolW = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#include <project_vertex>');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vPoolW;
uniform vec4 uPoolLamps[${POOL_MAX}];
uniform int uPoolCount;
uniform float uPoolNight;
uniform float uPoolAmb;`)
        // AFTER <color_fragment>, not before: that chunk is what folds the
        // `diffuse` uniform into diffuseColor, and the pool has to act on the
        // graded colour rather than on the raw map.
        .replace('#include <color_fragment>', `#include <color_fragment>${POOL_FRAG}`);
    };
    // Every patched material injects byte-identical source, so they share one
    // compiled program. Saying so beats letting three.js discover it.
    m.customProgramCacheKey = () => 'w45pool';
    m.needsUpdate = true;
  };
  const register = (root: THREE.Object3D, pool: boolean) => {
    root.traverse((o) => {
      const mm = (o as THREE.Mesh).material;
      if (!mm) return;
      for (const m of (Array.isArray(mm) ? mm : [mm]) as THREE.MeshBasicMaterial[]) {
        if (!m || !m.color || isGlass(m) || litSeen.has(m)) continue;
        // Excluded ONLY for genuinely non-diffuse surfaces — glass, chrome
        // and rubber, flagged in ct/cars.ts. There used to be a luminance
        // floor here too, and it is why a person in a dark coat walked under
        // a lamp and got nothing: every dark garment, dark car body, railing
        // and the dumpster fell under it and was skipped outright. Light
        // falls on dark things as well; the multiply model already gets the
        // rest right, since a dark base times the same factor stays dark —
        // it just stops being BLACK.
        if (m.userData?.noLight) continue;
        // ONE WRITER PER MATERIAL. dimWorld has this guard and register() did
        // not, so a material already owned by updateRain could also join
        // litList and be written every frame by both — and the two wet paths
        // are about 30x apart in strength, so the loser would not lose subtly.
        //
        // NOT a latent trap — a live one, and the callers are in THIS FILE.
        // I first wrote that lit() is only called on "a tree and two lots of
        // cars", having grepped the other modules for `.lit(`; props.ts calls it
        // bare, five times — lit(tree), lit(hyd), lit(phone), lit(pole)/lit(flag)
        // and lit(backGrp) — and those roots have my own ground decals in their
        // subtrees. The bus bench is the clearest: lit(backGrp) reaches the
        // bench's contact shadow, which updateRain already owns.
        //
        // Measured by toggling this line: 14 mesh/material pairs change hands,
        // all of them `props` 16x16 PlaneGeometry decals at y 0.01-0.14 — grime
        // stains, litter contact shadows, the bench shadow. Dry, nothing moves;
        // in rain, 344 materials render darker. (The `roadLum` reference this
        // used to explain went with the standing puddles — it existed to pick
        // a road colour to tint them against. The 344 still darken.)
        if (wetMats.some((w) => w.m === m)) continue;   // updateRain owns those
        const c = m.color;
        litSeen.add(m);
        // things in the street are street-level: they go as dark as the road
        // and the lamps buy them back
        // STAMPED, so "was offered to the dimmer and did not move" is decidable
        // from outside. Requested in notes/A-nightgrade.md, and it is the other
        // half of the selfLit stamp: without it, graded-but-unchanged and
        // never-handed-to-dimWorld are the same picture from out there, which
        // is why that check's un-boxed number was 417 and answered nothing.
        m.userData.graded = true;
        // A LIGHT REGISTERED THROUGH lit() WAS BEING DIMMED LIKE MASONRY.
        //
        // This path hard-coded FLOOR_GROUND and never asked whether the thing
        // it was grading emits. dimWorld does ask — but dimWorld skips anything
        // already in litSeen, and everything handed to lit() is in litSeen by
        // the line above. So props.lit(x) has been the one way into the night
        // grade that CANNOT hold a light bright. The payphone's backlit header
        // graded to 0.0933 at 23:00 with the enamel beside it, which is the
        // opposite of what it is for.
        //
        // It honours the DECLARATION only, not isSelfLit's heuristic. Running
        // the heuristic here would be a wider change than it looks: lit() is
        // called on the bus bench group, whose TONY'S PIZZA ad is bright
        // saturated ink and would start burning at full daylight after dark —
        // the exact false positive the `printed` opt-out exists to undo. One
        // flag, set by the owner who knows, and nothing else moves.
        const emits = !!m.userData?.lightSource;
        if (emits) m.userData.selfLit = true;
        const takesPool = pool && !emits;
        // A CAR IS THE OTHER HALF OF THE USER'S SENTENCE. "it doesnt affect the
        // car at all" — and crosstown.ts does call props.lit(car), so the car
        // WAS in this list and still came out flat. The reason is two lines
        // down from here in the old code: this path stores `ox/oz` and the pool
        // branch sampled `root.position + offset`, one point for a 4.5 m body,
        // against a 1.8 m core. A car half in a pool got the whole car's answer
        // from wherever its origin happened to fall. Per fragment there is no
        // origin to be unlucky about: the near wing lights and the far one does
        // not, which is what a sodium lamp does to a parked car.
        const ambU = takesPool ? { value: 1 } : undefined;
        if (ambU) attachPool(m, ambU);
        litList.push({ root, ox: o.position.x, oz: o.position.z, m, base: c.clone(),
                       pool: takesPool, floor: emits ? FLOOR_SIGN : FLOOR_GROUND, wetK: 0, ambU });
      }
    });
  };
  const lit = (root: THREE.Object3D) => register(root, true);
  // ── REGISTERING SOMETHING BUILT AFTER THE WORLD WAS ────────────────────
  //
  // `lit` and `dimWorld` are both build-time calls, so ANYTHING CONSTRUCTED
  // LATER IS PERMANENTLY UNLIT — it is in no registry and carries no shader,
  // and it stays at full daylight colour after dark. Measured: a car placed by
  // `__ct.carVariant` comes back 0 of 33 body materials patched, and it is the
  // same fleet geometry that is correctly lit when the parked cars are built.
  //
  // This is the one piece of the desk's diagnosis that is literally true —
  // "anything that never registered is never lit" — but it is true of things
  // built after buildProps, not of the modules it named, all of which do
  // register. There is no runtime path in or out today, which is why it has
  // never been visible: almost everything is built once at load.
  //
  // Published on scene.userData, exactly as addLamp is at :326 and for the same
  // stated reason — reachable by anyone holding `scene`, so no caller needs an
  // edit and ct/ctx.ts does not have to be widened.
  //
  //     (scene.userData as any).addLit?.(obj)
  //
  // It is idempotent: register() skips any material already in litSeen, so
  // calling it twice on the same object costs a traverse and changes nothing.
  (scene.userData as Record<string, unknown>).addLit =
    (root: THREE.Object3D) => { lit(root); };
  // Everything else on the block: it loses the ambient at night like anything
  // would, but a lamp does not pick it out — the buildings already get the
  // wall splash and the road already gets the pool decal, and warming a 12 m
  // wall off its centre point would be wrong anyway.
  // Is this sheet carrying its OWN light?
  //
  // There is no flag to read and there cannot be one: the shopfronts, signage
  // and windows are built in ct/street.ts and ct/civic.ts, which are not mine,
  // and in any case every one of those materials has color = white and keeps
  // all of its brightness in the texture. So m.color cannot distinguish a lit
  // window from dark brick — they are the same white. The sheet has to be
  // looked at.
  //
  // The test is bright AND CHROMATIC, and the second half is the important
  // one. Brightness alone fails: a white awning stripe and a pale roller
  // shutter are both near-white, and both genuinely should go dark at 3am
  // because neither is a light source. What a lit window, a neon tube and an
  // illuminated fascia have in common is saturated colour held at high value,
  // and unlit architecture — brick, concrete, painted steel — does not have
  // that anywhere on it.
  //
  // Cached per texture: sheets are shared across many meshes and this reads
  // the whole canvas.
  const sheetLit = new Map<string, boolean>();
  // ── THE OPT-OUT: `m.userData.printed` ─────────────────────────────────────
  //
  // "There is no flag to read and there cannot be one" (above) was true only
  // because nothing outside this file was setting one. C is, on ~40 lot
  // materials, so the premise has expired and the paragraph above should be
  // read as history.
  //
  // `printed` means: THIS SHEET IS INK, NOT A LIGHT — grade me like masonry.
  // It exists because the heuristic cannot win on printed signage. A price
  // card or a pole sign IS its artwork: saturated colour held at high value is
  // exactly what "bright and chromatic" tests for, so the sheets score 62–97%
  // hot and are held at FLOOR_SIGN with the yard black behind them. Lowering
  // the 8% threshold does not generalise — that only worked for the bunting at
  // 13.3%, one point over — and the 85.3% sheet is the pole sign the user had
  // just had ENLARGED and re-contrasted for legibility, so making it dimmer to
  // satisfy a detector would undo a request.
  //
  // It also settles the disagreement C measured: the lot salesman at 13.2% hot
  // is called a light and does not dim, while a street pedestrian at 23% hot —
  // same `citizenSprite`, same atlas generator — is called masonry and dims
  // 95.5%. A hotter sheet classed as "light" and a cooler one as "not" is the
  // proof that the threshold is not what decides; sprite atlases simply do not
  // sort by it. A hand flag is the honest answer for those, not a better number.
  //
  // THE FLAG TAKES THE MATERIAL, NOT THE TEXTURE, and that is deliberate: the
  // check now reads `isSelfLit(m)` so the opt-out cannot be bypassed by a
  // future caller who has a map in hand and calls it directly. `cLight` is the
  // opposite flag and stays C's — set by hand where something really is a light.
  const isSelfLit = (m: THREE.MeshBasicMaterial): boolean => {
    if (m.userData?.printed) return false;
    // …and the same declaration the other way. `printed` says "these bright
    // texels are ink, grade me"; `lightSource` says "this really is lit, hold
    // me". Both exist because a texture cannot tell you which it is, and the
    // alternative is tuning artwork until it squeaks over a threshold — which
    // is exactly what the desk told C not to do, and rightly.
    //
    // The payphone's backlit header is the first user: a small acrylic panel
    // with a blue field and cream letters. It reads 0.0% hot, because the blue
    // is not bright and the cream is not saturated, so the heuristic would
    // grade it down to FLOOR_GROUND with the enamel around it — and the desk's
    // note on moving the phone says plainly that a payphone SHOULD glow a
    // little. Declared, not nudged.
    if (m.userData?.lightSource) return true;
    const t = m.map;
    const img = t?.image as HTMLCanvasElement | undefined;
    if (!img || typeof img.getContext !== 'function') return false;
    const key = t!.uuid;
    const seen = sheetLit.get(key);
    if (seen !== undefined) return seen;
    let hot = 0, n = 0;
    try {
      const g = img.getContext('2d', { willReadFrequently: true });
      const d = g!.getImageData(0, 0, img.width, img.height).data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 128) continue;                 // transparent texels say nothing
        n++;
        const mx = Math.max(d[i], d[i + 1], d[i + 2]);
        const mn = Math.min(d[i], d[i + 1], d[i + 2]);
        if (mx > 199 && mx - mn > 26) hot++;          // bright, and not grey
      }
    } catch { /* zero-sized or unreadable — treat as ordinary masonry */ }
    // 0.20, RAISED FROM 0.08, and the bodega corner is why. The user:
    // "that exact rectangle doesnt look like the other stuff" — a hard-edged
    // bright rectangle on the facade covering the fascia and the brick round
    // the door, with no falloff, while the brick beside it graded normally.
    //
    // MEASURED, not guessed. That sheet is **0.083 hot** — it squeaked over
    // the old bar — so 92% of it is masonry being held at FLOOR_SIGN because
    // 8% of it is a lit window. One material carries one tint, so holding the
    // sheet for its lit texels holds the brick with them, and the rectangle is
    // the texture's own outline. That is the shape he is objecting to.
    //
    // The bar is safe at 0.20 because the population is bimodal, counted at
    // 23:00 over all 86 selfLit sheets:
    //
    //     under 0.15 hot   17     mostly masonry — the rectangles
    //     0.15 - 0.30       5
    //     0.30 - 0.50       5
    //     over 0.50        59     neon, signage, lit window sheets
    //
    // Nothing that is genuinely a light source lives near the bar. And the
    // upper-floor lit windows are NOT at risk from this: the three sheets up
    // there measure 0.0 hot and are stamped by hand in ct/street.ts:387, so
    // they never consult this heuristic at all. "Lit windows and signs must
    // NOT dim" is confirmed and stays true.
    const v = n > 0 && hot / n > 0.20;
    sheetLit.set(key, v);
    return v;
  };
  const dimWorld = (root: THREE.Object3D) => {
    root.traverse((o) => {
      // WORLD x, not local. This read `o.position.x`, which is the world x only
      // when nothing above the mesh is transformed — and the rooms are built in
      // groups that are. Measured: 18 interior meshes were being graded by the
      // street's night curve despite this guard, the furthest standing at world
      // x 199.7 while its own position.x reads -0.8. "Interiors keep their own
      // light" is what the line says and now what it does.
      //
      // Called once, from crosstown.ts:458, so the extra world-position lookup
      // costs nothing per frame.
      const wp = new THREE.Vector3(); o.getWorldPosition(wp);
      if (Math.abs(wp.x) > 100) return;              // interiors keep their own light
      const mm = (o as THREE.Mesh).material;
      if (!mm) return;
      for (const m of (Array.isArray(mm) ? mm : [mm]) as THREE.MeshBasicMaterial[]) {
        if (!m || !m.color || isGlass(m) || litSeen.has(m)) continue;
        if (wetMats.some((w) => w.m === m)) continue; // updateRain owns those
        // HONOUR noLight HERE TOO. It was read only by register() above, so the
        // flag meant "do not grade me" for geometry handed to props.lit()
        // explicitly and meant NOTHING for geometry this scene-wide sweep
        // collected. Same flag, same file, opposite outcomes, decided by which
        // loop reached the material first.
        //
        // Found by another builder failing to break their own check: marking a
        // side-street tree material noLight left it dimming 0.814 -> 0.038
        // exactly as before. They reported it with measurements rather than as
        // a suspicion, which is why it was actionable at all.
        //
        // Their one inference I could not reproduce is that the car fleet's
        // noLight materials "do take effect, because crosstown.ts calls
        // props.lit(car)". They do not — see below. The observation was right
        // and the mechanism was half of it.
        //
        // AND IT IS WORSE THAN "ONE PATH ONLY": the flag has never worked on
        // EITHER path. register() tests it BEFORE its own `litSeen.add`, so a
        // noLight material is skipped there without being marked seen — and
        // this sweep then collects and grades it. The flag did not exempt
        // anything; it only moved which loop did the grading.
        //
        // NOT `continue`, WHICH WAS MY FIRST FIX AND WAS WRONG. Skipping here
        // means the material is never graded at all, so it keeps its DAYLIGHT
        // colour after dark. Measured: snapshotting all 5536 materials at 23:00
        // moved 389 of them from 010101 to 101114 — tyres and engine bays
        // sitting brighter than the road they stand on.
        //
        // What the flag is for is written where it is set, at ct/cars.ts:791:
        // "a lit engine bay reads as a brown tray". It excludes a surface from
        // LAMPLIGHT, not from nightfall. A tyre still darkens at night; it just
        // never takes the sodium warm term. That is precisely `pool: false`,
        // and the machinery already exists — the non-pool branch of updateLit
        // applies ambient by elevation and no warm or pool term at all.
        //
        // So honour it by registering WITHOUT poolability rather than by
        // refusing to register.
        const noLamp = !!m.userData?.noLight;
        litSeen.add(m);
        // world geometry is graded by its own elevation — the shopfront box
        // and the facade box above it are separate meshes, which is what makes
        // "dark upper floors, lit signage" expressible at all
        const wy = new THREE.Vector3(); o.getWorldPosition(wy);
        // A lamp beside a wall should splash on it. Warming a 12 m facade off
        // its CENTRE would be wrong — one number cannot describe a surface
        // that long — so only geometry short enough for a centre point to
        // mean anything joins the pools. Long facades keep the additive wall
        // splash, which is per-lamp and correctly placed.
        const bx = new THREE.Box3().setFromObject(o);
        const span = Math.max(bx.max.x - bx.min.x, bx.max.z - bx.min.z);
        // ── THE SPAN CLIFF, AND WHY IT IS NOW A TAPER ────────────────────
        //
        // This read `span < 6`, a hard cutoff, and it is the third of the
        // user's three lighting reports: "a warm light pool on the brick that
        // stops dead at a straight vertical line with nothing there to stop
        // it". A wall built as two meshes, one 5.9 m and one 6.1 m, had one
        // half pooling and the other not — and the seam between them is
        // invisible, because both halves carry the same brick.
        //
        // The cutoff exists for a real reason and I am not deleting it: one
        // material carries ONE tint, so a 92 m road ribbon cannot hold a
        // gradient. Pool it and the whole street lifts uniformly, which would
        // flatten the pools the user likes — I did exactly that once with a
        // shared-material fix and had to revert it.
        //
        // So: a smooth taper instead of a step. Full weight up to 6 m, nothing
        // beyond 12, smoothstep between. Two halves of a wall either side of
        // 6 m now differ by a hair instead of by everything, and the 92 m
        // ribbons stay at zero exactly as before.
        const SPAN_FULL = 6, SPAN_NONE = 12;
        const tw = Number.isFinite(span)
          ? 1 - Math.min(1, Math.max(0, (span - SPAN_FULL) / (SPAN_NONE - SPAN_FULL)))
          : 0;
        const sizeW = tw * tw * (3 - 2 * tw);
        // ── PUBLISH THE TAPER SO IT CAN BE CHECKED FROM OUTSIDE ──────────
        //
        // The weight above was stored ONLY on `litList`, which is a module
        // internal. Nothing outside this file could read it, so
        // `scripts/wallpool.mjs` verified the taper by RETYPING the smoothstep
        // and comparing the world against its own restatement of the world —
        // it agreed with itself and could not go red on any change to the two
        // lines above. Row L260 was demoted CONFIRMED -> LANDED for exactly
        // that reason: "a row confirmed on an instrument that cannot
        // distinguish the world from its own copy of the rule is not
        // confirmed."
        //
        // BOTH numbers, not just the weight. `sizeW` alone is unfalsifiable —
        // any value looks correct with nothing to relate it to. The span is
        // the taper's INPUT, so publishing the pair makes the rule a query:
        // a checker can read (span, sizeW) off the world and test the
        // properties the taper exists to provide (monotone, continuous, full
        // below the knee, zero above it) without ever restating the formula.
        // BUILDER-BRIEF §8: derive, never retype.
        //
        // On the MESH, not the material, because the span is a property of
        // this mesh's bounding box while one material may dress several. A
        // mesh whose material some earlier mesh already registered is skipped
        // by the `litSeen` guard above and correctly carries nothing — it is
        // not in the pooling registry either.
        o.userData.sizeW = sizeW;
        o.userData.poolSpan = span;
        // ── THE SPAN CLIFF IS GONE, AND SO IS THE CENTRE-HEIGHT CLIFF ──────
        //
        // This was `wy.y < 4.5 && sizeW > 0` and both halves were centroid
        // tests, which is what put every large surface in the world outside
        // the light:
        //
        //   sizeW > 0   is false beyond a 12 m span, and the road ribbon is
        //               124.9 m, the kerb 92.8 m, the shopfronts 13-23.5 m.
        //               NO GROUND IN THIS WORLD PASSED IT. That was correct
        //               while one material carried one tint; the shader pool
        //               removes the premise, so the taper is no longer what
        //               decides whether a surface may be lit.
        //   wy.y < 4.5  is the mesh's CENTRE height, so a shopfront whose box
        //               runs y 0-15 has a centre at 10.7 and was refused —
        //               including the part of it standing on the pavement.
        //
        // Both are now questions the fragment answers for itself: the height
        // fade at POOL_Y0/POOL_Y1 does the second one honestly, per fragment,
        // and the first one simply is not a question any more. What is left
        // here is only "could any part of this mesh be near the ground", read
        // off the box's BASE rather than its middle — a cheap way to avoid
        // patching a shader onto roofs and sky that can never take a pool.
        //
        // `sizeW` is still computed and still published on the mesh: it is the
        // taper's own instrument (scripts/wallpool.mjs reads the (span, sizeW)
        // pair) and the additive wall splash still uses the taper's idea. It
        // just no longer gates poolability.
        const poolable = bx.min.y < POOL_Y1;
        const selfLit = isSelfLit(m);
        // Say so on the material. A sheet held at FLOOR_SIGN is graded and
        // deliberately kept bright, which from outside is indistinguishable
        // from a sheet that was never graded at all — and scripts/nightgrade
        // reports the second as a bug. It was handing owners thirteen tickets
        // for a neon sign and eleven lit window panels doing exactly what the
        // user asked for: "Lit windows and signs must NOT dim with it."
        if (selfLit) m.userData.selfLit = true;
        m.userData.graded = true;
        const dimTakesPool = poolable && !selfLit && !noLamp;
        // noLamp still means exactly what ct/cars.ts set it for — "a lit engine
        // bay reads as a brown tray" — and it still means it the same way:
        // registered, dimmed by nightfall, never handed the warm term. It just
        // now buys an unpatched shader as well as `pool: false`.
        const dimAmbU = dimTakesPool ? { value: 1 } : undefined;
        if (dimAmbU) attachPool(m, dimAmbU);
        litList.push({ root: o, ox: 0, oz: 0, m, base: m.color.clone(), ambU: dimAmbU,
                       // wy is this mesh's WORLD position, already computed above
                       // for the elevation floor. The pool branch needs the same
                       // point and was using o.position instead.
                       wx: wy.x, wz: wy.z,
                       bx0: bx.min.x, bx1: bx.max.x, bz0: bx.min.z, bz1: bx.max.z, sizeW,
                       pool: dimTakesPool,
                       floor: selfLit ? FLOOR_SIGN : floorFor(wy.y),
                       // SELF-LIT MEANS "DO NOT DIM ME", NOT "DO NOT WET ME".
                       // This zeroed wetK for anything isSelfLit() matched, and
                       // isSelfLit matches a facade sheet with lit windows drawn
                       // into it — which is most of the upper building line.
                       // Measured in rain at 14:00: 17 of 26 high wall materials
                       // and 2 of 2 mid ones carry the flag, and their tint sits
                       // at exactly 1.0000 while the ground-level brick drops to
                       // 0.9024. The user asked for rain to wet the BUILDINGS
                       // and not just the ground; above head height it was not
                       // wetting them at all.
                       //
                       // The night floor is what honours "lit windows and signs
                       // must NOT dim" — FLOOR_SIGN, two lines up, and that is
                       // untouched. Rain is a different question: a neon sign
                       // still gets wet. Half weight rather than full, because
                       // the bright texels are carrying the light and should not
                       // take the whole wet lerp.
                       wetK: selfLit ? wetKFor(wy.y) * 0.5 : wetKFor(wy.y) });
        // ── A FITTING THAT SAYS IT IS A LIGHT SHOULD CAST ONE ────────────
        //
        // "lighting on this alley back door looks messed up like it gets
        // cropped by door." shots/user-alley-door-light-crop.png is exact: a
        // warm dome of light on the brick, and the door under it DEAD BLACK,
        // the glow stopping at its top edge.
        //
        // MEASURED, at the door itself (scripts/alleydoor.mjs) — it is at
        // (19.40, 1.06, -55.45) and directly above it, at y 2.15, sits a
        // 1.5 x 1.5 m selfLit quad held at tint 1.0. That quad IS the dome.
        // It is a DECAL: nothing near that door is a registered lamp, so
        // updateLit hands out nothing, and everything around it sits at the
        // night floor. The glow does not stop at the door because the door
        // rejects it — it stops because it was never light, only paint.
        //
        // I published `scene.userData.addLamp` so any module could declare a
        // light, and told D to add one line. Grep, today: one definition, ZERO
        // callers. That is the desk's point exactly — receive by DEFAULT, or a
        // prop is born broken and stays broken until somebody remembers.
        //
        // So a small self-lit mesh IS a lamp, and no longer has to say so.
        //
        // WHY IT IS NOT A STREET LAMP, which is the part that keeps this safe:
        // a bulkhead over a back door is a 60 W fitting, not sodium on a pole.
        // It gets a DOORWAY pool — 2.6 m against LAMP_R's 7.0 — so the census
        // below adds local light at doorways without lifting the street, which
        // the user has asked four times to keep dark.
        //
        // SIZE-BOUNDED for the same reason: a lit WINDOW is a sheet metres
        // across and must never become a source. Measured over the whole world
        // at 22:30, this predicate takes 37 meshes and leaves 76 self-lit
        // sheets excluded as too big.
        if (selfLit && !LAMP_SEEN.has(m)) {
          const w = bx.max.x - bx.min.x, h = bx.max.y - bx.min.y, d = bx.max.z - bx.min.z;
          const small = Math.max(w, h, d) <= FITTING_MAX;
          if (small && wy.y >= 0.5 && wy.y <= 6.0
              // and not a second head on a lamp that already has one — the
              // street lamps' own lenses are self-lit and would double up
              && !lampHeads.some((q) => Math.hypot(q.x - wy.x, q.z - wy.z) < 1.2)) {
            LAMP_SEEN.add(m);
            lampHeads.push({ x: wy.x, z: wy.z, r: FITTING_R, core: FITTING_CORE });
          }
        }
      }
    });
    // ── and stand a splash sheet against every wall on the building line ──
    //
    // Derived from the scene rather than from a roster, which is the whole
    // point: the alley gap, the library's recessed courtyard and any setback
    // a builder adds later all handle themselves, because a gap in the walls
    // is simply a gap in the intervals. No cooperation needed from D or E.
    root.updateMatrixWorld(true);
    const runs: Record<number, [number, number][]> = { [-1]: [], [1]: [] };
    const bb = new THREE.Box3();
    root.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh || !(o as THREE.Mesh).geometry) return;
      bb.setFromObject(o);
      if (bb.max.y - bb.min.y < 2) return;                     // not a wall
      if (bb.max.x > 90 || bb.min.x < -90) return;             // interiors
      const side = Math.abs(bb.max.x + FACE) < 0.4 ? -1
                 : Math.abs(bb.min.x - FACE) < 0.4 ? 1 : 0;    // on the building line?
      if (!side) return;
      runs[side].push([bb.min.z, bb.max.z]);
    });
    for (const key of [-1, 1]) {
      const iv = runs[key].sort((a, b) => a[0] - b[0]);
      const merged: [number, number][] = [];
      for (const r of iv) {
        const last = merged[merged.length - 1];
        if (last && r[0] <= last[1] + 0.05) last[1] = Math.max(last[1], r[1]);
        else merged.push([r[0], r[1]]);
      }
      for (const [z0, z1] of merged) {
        const len = z1 - z0;
        if (len < 1.5) continue;
        const t = splashT.clone(); t.needsUpdate = true;
        t.repeat.set(len / 4, 1);                              // a streak every ~4 m
        const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0, depthWrite: false });
        const q = new THREE.Mesh(new THREE.PlaneGeometry(len, SPLASH_H), m);
        q.position.set(key * (FACE - 0.03), sidewalkY + SPLASH_H / 2, (z0 + z1) / 2);
        q.rotation.y = -key * Math.PI / 2;                     // face the street
        scene.add(q);
        splashMats.push(m);
      }
    }

    // ── and push the litter out of the buildings ────────────────────────────
    //
    // The footprint rule tests against GROUND SURFACES. It has nothing to say
    // about a wall, so a piece placed near a frontage resolves its height
    // perfectly and then grows into the stallriser — which is what happened to
    // the milk crate, and A has since made those shopfronts project further.
    //
    // Two things this deliberately does NOT do:
    //
    // · It does not test against the collider set. ctx exposes obstacle() to
    //   REGISTER a box and offers no way to read them back, so a module cannot
    //   see them — but more to the point that would be the wrong test. The bug
    //   is VISUAL. A stallriser, a sill or a projecting sign that has no
    //   collider still clips, and a collider that is bigger than its geometry
    //   would shove litter around for no visible reason.
    // · It does not test in plan. The two pieces under the bus bench are
    //   inside the bench's x/z footprint on purpose — they are UNDER the seat,
    //   which is the whole point of putting them there. Only a real 3D overlap
    //   counts.
    //
    // It runs HERE because dimWorld is the one place a module is handed the
    // finished world. At the time the litter is placed, the shopfronts it must
    // avoid do not exist yet.
    const solidsNear: THREE.Box3[] = [];
    const bx3 = new THREE.Box3();
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      // TEST ANCESTRY, NOT THE NODE. `drop()` tags the GROUP (:3519,
      // `o.userData.litter = name`) and nothing inside it, so `o.userData
      // ?.litter` — which is what this line used to read — is false for every
      // mesh a piece of litter is actually MADE of. A milk crate's four
      // uprights therefore landed in `solidsNear`, the group's own box overlaps
      // them by construction, and the pass below shoved each crate clear of its
      // own sides.
      //
      // THAT, NOT THE SHOPFRONT, IS WHAT PUT A CRATE IN THE USER'S DOORWAY, and
      // the comment at the top of this block blaming the projecting frontage is
      // wrong — worker seventyseven proved it under item 204 and I re-measured
      // it here. It bit crates alone because of the `h < 0.25` gate below:
      // cardboard and newspaper lie flatter and never enter the set at all.
      // Measured before the fix, `scripts/probes/w78-litter-landed.mjs`: all
      // three crates carried 4 self-solids each and every one of the eleven
      // flat pieces carried 0, and the three crates were the only litter in the
      // world that had moved from where it was authored.
      //
      // Worse, the move was AIMED: the `towardRoad` weighting below prefers a
      // separation toward x 0, so a crate against the west frontage was pushed
      // out into the walk rather than back against the wall.
      //
      // The ancestry walk is the one `scripts/footprint.mjs:113` already uses
      // for the same question — "is this mesh part of the thing I am placing,
      // or part of the world it must avoid?" — copied deliberately rather than
      // invented, so the check and the placer agree about what a clip is.
      let up: THREE.Object3D | null = o;
      while (up) { if (up.userData?.litter) return; up = up.parent; }
      bx3.setFromObject(o);
      if (!Number.isFinite(bx3.min.x)) return;
      const h = bx3.max.y - bx3.min.y;
      if (h < 0.25 || bx3.min.y > 1.6) return;      // ground sheets, and things hung high
      if (bx3.max.x - bx3.min.x > 40 || bx3.max.z - bx3.min.z > 60) return;  // whole-block sheets
      solidsNear.push(bx3.clone());
    });
    const litterBox = new THREE.Box3();
    for (const o of root.children.slice()) {
      const kind = o.userData?.litter;
      if (!kind) continue;
      for (let pass = 0; pass < 6; pass++) {
        o.updateMatrixWorld(true);
        litterBox.setFromObject(o);
        let best: { ax: 'x' | 'z'; d: number; score: number } | null = null;
        for (const b2 of solidsNear) {
          if (litterBox.max.x <= b2.min.x || litterBox.min.x >= b2.max.x) continue;
          if (litterBox.max.z <= b2.min.z || litterBox.min.z >= b2.max.z) continue;
          if (litterBox.max.y <= b2.min.y || litterBox.min.y >= b2.max.y) continue;
          // minimum translation that separates them, in x or z
          for (const [ax, lo, hi, blo, bhi] of [
            ['x', litterBox.min.x, litterBox.max.x, b2.min.x, b2.max.x],
            ['z', litterBox.min.z, litterBox.max.z, b2.min.z, b2.max.z]] as const) {
            for (const d of [blo - hi - 0.01, bhi - lo + 0.01]) {
              if (Math.abs(d) > 0.7) continue;      // never teleport a piece across the walk
              // Prefer moving TOWARD THE ROAD. A piece against a frontage is
              // nearly always clipping the frontage, and sliding it along the
              // wall in z only finds the next window sill; stepping off the
              // wall ends it in one move. Weighted rather than forced, so a
              // piece that genuinely only needs a nudge in z still gets one.
              const towardRoad = ax === 'x' && Math.abs(o.position.x + d) < Math.abs(o.position.x);
              const score = Math.abs(d) * (towardRoad ? 0.45 : 1);
              if (!best || score < best.score) best = { ax, d, score };
            }
          }
        }
        if (!best) break;
        if (best.ax === 'x') {
          // still may not straddle the kerb, and the ground under it changes
          const nx = clearOfKerb(o.position.x + best.d, o.userData.halfX ?? 0.3);
          o.position.x = nx;
          if (o.userData.onStreet) {
            const gy2 = groundUnder(nx, o.userData.halfX ?? 0.3);
            o.position.y += gy2 - o.userData.groundY;
            o.userData.groundY = gy2;
          }
        } else {
          o.position.z += best.d;
        }
      }
    }
  };
  let litLast = -1;
  let wetLast = 0;
  const updateLit = (night: number) => {
    nightNow = night;
    // PUBLISH WHAT THIS MODULE KNOWS. 4462995c: ct/vice.ts derives "how dark is
    // it" from scene.background luminance, and props.ts lerps the sky toward
    // RAIN_SKY when it rains — so a downpour LIFTS the value its heuristic
    // reads and it puts 12.5% LESS glow on wet asphalt, which is backwards
    // against a brief that asks for colour thrown onto wet asphalt.
    //
    // Its ruling was that this belongs here: "let the thing that knows say so,
    // instead of three modules each guessing it from appearances". It is right,
    // and it is the same move as declareSurface, userData.mod and the isGlass
    // split — every one of those replaced an inference with a declaration.
    //
    // On scene.userData rather than the Frame interface because ct/ctx.ts is
    // not mine to widen, and because every module already holds `scene`. A
    // reader needs no new plumbing and no cross-module material sampling, which
    // 4462995c rightly called worse than the bug.
    scene.userData.nightFactor = night;      // 0 broad day … 1 fully night
    scene.userData.rainLevel = rainLevel;    // 0 dry … 1 downpour
    scene.userData.wetness = wetness;        // how wet the GROUND is; lags rain
    // Free in broad daylight — but this pass now carries the RAIN as well as
    // the night, so a dry-and-sunny early-out has to check both or walls
    // never get wet during a daytime storm. That is exactly what happened.
    if (night <= 0.001 && litLast <= 0.001 && wetness <= 0.004 && wetLast <= 0.004) return;
    wetLast = wetness;
    litLast = night;
    // ── HAND THE LAMPS TO THE GPU ──────────────────────────────────────────
    //
    // One upload for the whole world, not one per material: `uPoolLamps` is a
    // single uniform object shared by every patched material, so writing it
    // here reaches all of them. Packed as (x, z, radius, core) because that is
    // exactly what the falloff below reads, and per-head rather than global so
    // a 2.6 m door bulkhead keeps lighting only its doorway.
    //
    // The count is published so a check can ask the world how many lights it
    // thinks it has, instead of counting lamp posts in a screenshot.
    // NEAREST THE PLAYER WIN. 27 heads exist and 16 slots are uploaded, so the
    // order matters: taking them in build order would hand the GPU whichever
    // lamps happened to be created first, which on the side street is nowhere
    // near the player. Sorted by plan distance to where he is standing, so the
    // ones that can actually put light in frame are always the ones present.
    //
    // Sorting 27 entries once a frame, after dusk only, against a shader that
    // was costing 80 ms — this is not the expensive end of the change.
    lampNear.length = 0;
    for (const h of lampHeads) lampNear.push(h);
    if (lampNear.length > POOL_MAX) {
      lampNear.sort((a, b) =>
        ((a.x - playerX) ** 2 + (a.z - playerZ) ** 2)
        - ((b.x - playerX) ** 2 + (b.z - playerZ) ** 2));
    }
    const nLamps = Math.min(lampNear.length, POOL_MAX);
    for (let i = 0; i < nLamps; i++) {
      const h = lampNear[i];
      poolLampU[i].set(h.x, h.z, h.r ?? LAMP_R, h.core ?? LAMP_CORE);
    }
    uPoolCount.value = nLamps;
    uPoolNight.value = night;
    scene.userData.lampHeadCount = lampHeads.length;
    scene.userData.lampHeadsUploaded = nLamps;
    for (const e of litList) {
      const amb = ambient(e.floor);
      if (!e.pool) {
        // world geometry: ambient by height, and rain by height too. The top
        // of a building dries first because it was never as wet — the same
        // exponent trick the gutter uses, inverted.
        let r = e.base.r * amb, g2 = e.base.g * amb, b2 = e.base.b * amb;
        if (e.wetK > 0 && wetness > 0.004) {
          const w = Math.pow(wetness, 0.7 + (1 - e.wetK) * 1.6) * e.wetK
                  * (1 - 0.4 * nightNow);          // never take a wet wall to black
          r *= 1 + (WET_WALL.r - 1) * w;
          g2 *= 1 + (WET_WALL.g - 1) * w;
          b2 *= 1 + (WET_WALL.b - 1) * w;
        }
        e.m.color.setRGB(r, g2, b2);
        continue;
      }
      // the part's world position — cars only ever rotate about Y
      // A fixed world point wins when it was recorded — see the note on Lit.
      // Only cars need the rotate-about-the-root form, and only cars move.
      const a = e.root.rotation.y, ca = Math.cos(a), sa = Math.sin(a);
      const px = e.wx !== undefined ? e.wx : e.root.position.x + e.ox * ca + e.oz * sa;
      const pz = e.wz !== undefined ? e.wz : e.root.position.z - e.ox * sa + e.oz * ca;
      let best = 0;
      for (const h of lampHeads) {
        // NEAREST POINT ON THE SURFACE, not its centre. A 5 m wall whose centre
        // is 6 m from a lamp has an end 3.5 m away and is plainly lit there;
        // sampling the centre called the whole thing unlit. Falling back to the
        // point form for anything without a box (cars, which move).
        const qx = e.bx0 !== undefined ? Math.min(Math.max(h.x, e.bx0), e.bx1!) : px;
        const qz = e.bz0 !== undefined ? Math.min(Math.max(h.z, e.bz0), e.bz1!) : pz;
        const dx = qx - h.x, dz = qz - h.z;
        const d2 = dx * dx + dz * dz;
        // PER-HEAD radius. A street lamp lights a stretch of pavement; a
        // bulkhead over a back door lights the doorway and nothing else, and
        // giving them the same 7 m reach is how "light the door" becomes
        // "light the alley", which the desk ruled out in as many words.
        const R = h.r ?? LAMP_R, CORE = h.core ?? LAMP_CORE;
        if (d2 >= R * R) continue;
        const d = Math.sqrt(d2);
        // full strength across the core, then the shoulder — the whole point
        // of the change is that this is flat, not a peak
        const f = d <= CORE ? 1 : 1 - (d - CORE) / (R - CORE);
        if (f > best) best = f;
      }
      // smoothstep, not a square: squared only reaches 0.23 two metres from
      // the head, too faint to read as lit at all
      //
      // `sizeW` IS GONE FROM THIS PRODUCT and that is the change. It was here
      // to stop a big shared material lifting uniformly, which was the right
      // answer to the wrong stage of the pipeline: it made the taper decide
      // how BRIGHT a surface could get from how BIG it was, so the 92 m kerb
      // could only ever be at zero. The gradient the taper was standing in for
      // now exists for real, in the fragment.
      const k = night * (best * best * (3 - 2 * best));
      // dark by default, and the lamp gives it back — capped so a pool reads
      // as lit rather than blown out
      const mul = Math.min(1, amb * (1 + k * POOL_GAIN));
      // SAY WHEN A LAMP IS HOLDING SOMETHING UP. The cap means anything close
      // enough to a lamp comes back to exactly its daylight colour, so it is
      // graded, written every frame, and UNCHANGED — which from outside looks
      // identical to never having been touched. That is the last thing
      // nightgrade could not explain: one 3.90 m rail in the park at 0.076
      // luminance, 3.29 m from a lantern, which its own elevation test could
      // not account for because the cause is horizontal, not vertical.
      //
      // Written only on change, so this costs nothing per frame in the steady
      // state — most materials are either in a pool all night or never.
      const held = mul > 0.995 && k > 0;
      if (!!e.m.userData.poolLit !== held) e.m.userData.poolLit = held;
      // ── AND THE COLOUR IS NOW JUST THE AMBIENT ─────────────────────────
      //
      // The warm term and the gain moved into POOL_FRAG, which applies them at
      // the fragment. All this pass still owes the material is its ambient for
      // this frame — the elevation floor, which is a property of the mesh and
      // not of the pixel, so it belongs here.
      //
      // `mul` and `k` above are still computed, and only for `poolLit`. That
      // flag answers "is a lamp holding this material up", which several
      // checks read; it is a per-MATERIAL question and the shader cannot
      // answer it, so the CPU keeps doing so. It costs a few dozen entries
      // against ~21 heads, once a frame, after dusk only.
      e.ambU!.value = amb;
      e.m.color.setRGB(e.base.r * amb, e.base.g * amb, e.base.b * amb);
    }
  };

  // Splash-back: the bottom of a wall is wetter than the top, and no amount of
  // per-material tinting can say that because a facade is ONE mesh with one
  // colour. This is the gradient, as a thin sheet stood against the wall.
  const splashT = declareSurface(pixTex(32, 32, (g) => {
    for (let y = 0; y < 32; y++) {
      // opaque at the pavement, gone by roughly a metre up
      const a = Math.pow(1 - y / 31, 2.1) * 0.62;
      g.fillStyle = `rgba(28,34,44,${a.toFixed(3)})`;
      g.fillRect(0, y, 32, 1);
    }
    // water running down from a sill or a coping, which is what actually says
    // "it has been raining" rather than "someone dimmed the wall"
    for (const [x, w, h] of [[3, 2, 26], [11, 1, 31], [17, 2, 18], [24, 1, 29], [29, 2, 22]] as [number, number, number][]) {
      for (let y = 32 - h; y < 32; y++) {
        const a = 0.30 * Math.pow(1 - (y - (32 - h)) / h, 0.35);
        g.fillStyle = `rgba(24,30,40,${a.toFixed(3)})`;
        g.fillRect(x, y, w, 1);
      }
    }
  }), 'detail');
  splashT.wrapS = splashT.wrapT = THREE.RepeatWrapping;
  const splashMats: THREE.MeshBasicMaterial[] = [];

  // light spilling onto the wall behind each lamp, so the brick beside a
  // lamp isn't as flat-black as the brick mid-block
  //
  // ── ITEM 156: THIS GRADIENT USED TO BE CUT OFF BY ITS OWN CANVAS ─────────
  //
  // The user, at night: *"whats going on here with the light reflecting against
  // the invisible wall?"* — and he was looking at this quad's EDGE.
  //
  // It was `createRadialGradient(16, 17, 1, 16, 17, 26)` painted onto a canvas
  // **32 px wide**. A radial gradient reaches its last colour stop at its outer
  // RADIUS, and 26 is well outside this canvas's half-width of 16: the farthest
  // any pixel gets from the centre horizontally is 16, which is only 0.615 of
  // the way along the ramp, where the stops still interpolate to **alpha 0.14**
  // — a quarter of the 0.55 peak. So the falloff never reached zero before the
  // texture ran out, and an ADDITIVE 3.4 m quad ended mid-gradient: a straight
  // vertical edge of light down a brick wall, exactly as if the light had
  // stopped against something that is not there. The top edge (distance 17)
  // was truncated the same way; only the bottom (distance 30, past 26) ever
  // faded out properly, which is why the artifact reads as a panel of light
  // with a soft lower hem and hard sides.
  //
  // MEASURED, not inferred, before it was touched: at z -50 looking east the
  // night/day luminance ratio jumps **0.303 between two adjacent pixel columns**
  // against a same-camera noise floor of 0.030 — a signal-to-noise of 10.1, the
  // only station on the street to clear the bar
  // (`scripts/probes/w87-item156-lightedge.mjs`).
  //
  // THE FIX IS TO MAKE THE FALLOFF REACH ZERO AT EVERY EDGE OF ITS OWN CANVAS,
  // which a circular gradient cannot do on a non-square texture whose centre is
  // off-centre. So the falloff is drawn per pixel against a distance normalised
  // SEPARATELY in each direction — the centre sits 17 px down a 48 px canvas, so
  // "up" has 17 px to fade in and "down" has 31 — and clamped to 0 at 1. That
  // is zero along all four edges by construction, whatever the canvas aspect or
  // where the centre sits, so this cannot silently come back if either changes.
  const wallSplashT = declareSurface(pixTex(32, 48, (g) => {
    const CX = 16, CY = 17, PEAK = 0.55;
    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 32; x++) {
        const dx = (x + 0.5 - CX) / CX;                       // 0 at centre, 1 at either side
        const ey = y + 0.5 < CY ? CY : 48 - CY;               // 17 above, 31 below
        const dy = (y + 0.5 - CY) / ey;
        const d = Math.min(1, Math.hypot(dx, dy));
        // same shape as the old stops (0.55 core, ~0.15 at 45%), but it lands
        // on exactly 0 at d = 1 instead of being clipped at 0.14
        const a = PEAK * Math.pow(1 - d, 2.2);
        if (a < 0.002) continue;
        // warm at the core, cooling slightly outward, as the stops did
        const r = 255, gg = Math.round(192 - 16 * d), bl = Math.round(116 - 20 * d);
        g.fillStyle = `rgba(${r},${gg},${bl},${a.toFixed(3)})`;
        g.fillRect(x, y, 1, 1);
      }
    }
  }), 'detail');

  // street trees — the sprite cutouts are back (they belong here): fixed
  // crown texels, trunk-only variation, planted in dirt pits, and only the
  // trunk is solid so the sidewalk stays walkable. The bed hugs the KERB side
  // (a 1×2-slab strip) so the building half of the 2 m walk is a clear lane
  // you can always slip past on — no more full-width tree blocking the path.
  const TREE_PX = 0.05; // world units per texel
  const pitT = treePitTex();
  // a 0.8 m planting strip flush against the kerb (x 5.0–5.8). The player
  // RADIUS is 0.42 and the building wall's collider already reaches x≈6.28,
  // so the trunk collider must be tight and kerb-hugging to leave a real lane:
  // trunk to 5.48 + 0.42 = walkable from x≈5.9, wall from x≈6.28 → ~0.4 m clear.
  // Width 0.8 is deliberate and stays — it's what leaves a real lane past the
  // tree. Length was 2.0 (two whole slabs down the walk, which read as a long
  // trench); 1.0 is a single slab, so the pit is a square-ish bed like a real
  // tree well instead of a strip.
  // The pit used to be 0.8 wide starting at x = ±5.0 — hard against the kerb
  // line, with no walk between it and the drop, and in fact 6.25 cm PAST the
  // walk, because the walk sheet starts at ROAD_HALF + CH where the arris
  // chamfer ends. So the pit's road edge was overhanging the chamfer, which my
  // own report flagged and nothing had picked up.
  //
  // Real street trees sit inboard with a continuous strip of pavement at the
  // kerb — you need somewhere to stand when you get out of a car, and the
  // strip is what stops the pit edge crumbling into the gutter. PIT_CLEAR is
  // that strip, and it is the same at every pit on the block.
  //
  // HOW MUCH clearance is not a matter of taste — it is bounded by the walking
  // lane, and I got this wrong once already. A slab's width was asked for and
  // provably does not fit: the walk is 1.94 m usable (ROAD_HALF + CH to FACE),
  // so a 1 m band plus a 0.8 m pit leaves 14 cm at the building line.
  //
  // Worse, my first answer at 0.50 m CLOSED THE LANE. The trunk collider moves
  // with the pit, and the lamp poles already block out to x ≈ 6.11 with the
  // rig's 0.36 m radius while the wall bites at 6.34 — so the gap a walker
  // gets past a lamp is 23 cm, and a tree pushed out to 5.86 blocked to 6.30
  // and left 4 cm. `npm run bus walk` caught it; a screenshot never would.
  //
  // So the trunk is capped at the point where a tree blocks no further than a
  // lamp already does, and the pit is derived from that rather than the other
  // way round. 0.32 m — about a foot of pavement at the kerb, the same at all
  // seven pits, and the chamfer overhang gone.
  // MOVED IN AGAIN, to 5.46, and this one is a TRADE rather than a free win —
  // the audit that asked for it did not know this constant carries a second
  // user request.
  //
  // The finding: the tightest squeeze in the world was 0.90 m of walk on the
  // west side at z -71.4, free span -6.64 … -5.74, and the auditor ranks it as
  // FELT rather than seen, which is worse. It is labelled a "sign/meter post"
  // there; measured, it is this tree's trunk collider — 0.16 x 0.24 at x ±5.66,
  // which is exactly what the loop below builds. The label is wrong, the
  // collider is right.
  //
  // At 5.46 the trunk blocks to 5.54 and the building-side lane becomes 1.10 m,
  // the number the audit predicted, matching the lamps at 5.55.
  //
  // WHAT IT COSTS. PIT_CLEAR was 0.32 m because the user asked for "a bit of
  // clearence on the curb side" and disliked how close the tree BASES sat to
  // the edge. Moving the trunk in takes that strip down. Two mitigations and
  // one honest admission:
  //   · the TRUNK's own kerb-side face lands at 5.38 — 0.32 m off the walk
  //     edge, which is precisely where the PIT edge sits today. The thing the
  //     user was actually looking at, the base against the kerb, keeps the
  //     clearance it was given.
  //   · the PIT stays where it is. Only the trunk moves. A tree is not planted
  //     dead-centre in its well on a narrow footway — it sits toward the kerb,
  //     which is both what happens and what keeps the visible strip intact.
  //
  // My own footprint check caught the first attempt at this: I narrowed the pit
  // to 0.44 and moved it with the trunk, and the strip fell to 0.178 m against
  // an assertion of 0.20. The right answer was not to lower the assertion — it
  // encodes a user request — but to stop moving the two things together.
  const TRUNK_X = 5.46;                      // blocks to 5.54, as the lamps do
  // THE WELL IS CENTRED ON THE TRUNK. It was not: PIT_X 5.56 against TRUNK_X
  // 5.46 put 0.18 m of dirt on the kerb side and 0.38 m on the building side,
  // and the user read it correctly as the trunk shoved against the kerb edge.
  //
  // It was NOT the kerb-clearance fix that split them — 7d32dae25 used one
  // constant for both. 1a88b8c1b did, moving the TREE kerb-ward to open a 0.90 m
  // walking squeeze to 1.10 m and leaving the well where it was. The tree moved;
  // the pit did not.
  //
  // So the trunk is the thing that cannot move: it is pinned at 5.46 by that
  // lane. Everything else is a trade between how much dirt the well holds and
  // how much walk is left at the kerb, and the USER HAS NOW MADE THAT TRADE:
  //
  //   "tree in the dirt looks janky, i think we need to make the dirt patch a
  //    lil bigger on the curb side"
  //
  // I had centred the well at 0.36 m wide, which put 0.18 m of dirt either side
  // and kept the kerb strip at 0.2175 — the number the earlier request, "a bit
  // of clearence on the curb side", had been answered with. Equal, but thin on
  // exactly the side they are looking at.
  //
  // 0.56 m, still centred on the trunk: 0.28 m of dirt each side, and the strip
  // spends down to 0.118 m. That strip exists so the well does not crumble into
  // the gutter, and 12 cm still does that; the earlier number was my choice
  // rather than theirs, and this instruction is the later one. scripts/
  // footprint.mjs asserted > 0.20 and now asserts > 0.10, deliberately.
  //
  // A wider well than this needs the trunk to move building-ward and the
  // walking lane pays for it, which is a trade I will not make quietly.
  const PIT_X = TRUNK_X;                     // centred on the trunk, not offset from it
  const PIT_W = 0.56;
  // DERIVED, and it moves nothing: the well is positioned from PIT_X below.
  // Kept because the number is the promise ('a bit of pavement at the kerb'),
  // but change PIT_X to change the world — editing this line does nothing.
  // 0.118 m of walk at the kerb. It said 0.28 for a while, which is the DIRT
  // half-width from the paragraph above and not this strip at all — two numbers
  // that happen to sit four lines apart. Since this constant is "the promise",
  // a wrong number on it is the kind of thing that gets quoted back as fact.
  const PIT_CLEAR = PIT_X - PIT_W / 2 - (ROAD_HALF + CHAMFER);
  // LENGTH ALONG THE STREET IS FREE, and it is where the dirt comes back.
  //
  // Centring the well on the trunk capped its width at 0.36 m — the walk is
  // only 1.94 m wide and the kerb strip has to stay over 0.20 m. Looked at from
  // above that reads as a narrow slot rather than a tree well, which is the
  // "tight" half of what the user was seeing.
  //
  // Nothing constrains the OTHER axis. The trees are 14 m apart and the pit runs
  // along the street, not across it, so lengthening costs no walk, no kerb
  // clearance and no lane. 1.4 m brings the dirt back to 0.50 m2 against the
  // 0.56 m2 the off-centre 0.56 x 1.0 well had, and it reads as a well again.
  const PIT_L = 1.4;
  const pitGeo = new THREE.PlaneGeometry(PIT_W, PIT_L);
  // THE DIRT GETS WET. Measured: the walk the pits are cut into goes 1.000 ->
  // 0.226 in rain, -77%, while the pit dirt moved 0.0% — seven patches of bone
  // dry earth in a wet street, and earth is the WORST surface to leave dry,
  // because wet soil darkens further than concrete does, not less. It is the
  // same class as the catch basin castings a round ago and the gutter decals
  // before that: a small surface that nobody registered because the big one
  // beside it looked right.
  //
  // Registered rather than hand-tinted, so updateRain owns it and is its one
  // writer — ct/props.ts skips wetMats materials in both grading paths.
  const pitMat = wet(new THREE.MeshBasicMaterial({ map: pitT }));
  // Hand-tuned height exceptions. This is a hand-authored block, so a tree
  // that reads wrong in its particular spot gets trimmed by index rather than
  // by re-rolling the seed and disturbing every other tree. treeIdx 2 stands
  // at z=-30, in front of ARCADE (which spans z -35..-22), and drew tall
  // enough to crowd the sign.
  const TREE_TRIM: Record<number, number> = { 2: 0.85 };
  // ── keep clear of the library doors ─────────────────────────────────────
  //
  // ct/street.ts stands the LIBRARY at zw = -5.0 with w = 16, so it runs
  // z -5 … -21, and ct/civic.ts centres its entrance bay (BAY_W = 5.0) on the
  // middle of that: the doors open onto z -15.5 … -10.5. Builder E is
  // recessing that bay into a courtyard, which would have left a payphone and
  // a street tree standing in the middle of it.
  //
  // Nothing of mine goes in this span, plus a stride either side so the
  // approach reads as an approach. If E moves the library, this is the one
  // number to change.
  const LIB_DOOR_Z0 = -17.0, LIB_DOOR_Z1 = -9.0;
  // Tree 1 fell at z = -15.5, dead on the south jamb. Shifted south onto the
  // library's solid flank, where a tree in front of stonework is right rather
  // than in the way. Kept on the half-metre so its pit still lands on the slab
  // grid — see the walk sheet's phase in ct/tex-ground.ts.
  const TREE_SHIFT: Record<number, number> = { 1: -4 };
  let treeIdx = 0;

  // ── the crown underside ─────────────────────────────────────────────────
  //
  // Foliage seen from BELOW: in shade, so darker than the sheet's lit top, and
  // with the branch structure showing through rather than a flat green disc.
  // One texture per tree variant, cached, because 7 trees share 4 palettes.
  const underCache = new Map<number, THREE.Texture>();
  const crownUnderTex = (v: number): THREE.Texture => {
    const hit = underCache.get(v % 4);
    if (hit) return hit;
    const D = 64;
    // DETERMINISTIC. rnd() here would shift the seeded stream and move every
    // tree and pigeon in the world (GOTCHAS 2).
    let s2 = Math.imul(v + 7, 2246822519) >>> 0;
    const rr = () => { s2 = (Math.imul(s2, 1664525) + 1013904223) >>> 0; return s2 / 4294967296; };
    const PAL = [['#22401f', '#1a3319', '#2c5226'], ['#2c3d1f', '#22301a', '#3a4f28'],
                 ['#26401f', '#1d3119', '#33532a'], ['#1f3d26', '#17301e', '#2a5233']][v % 4];
    const t = declareSurface(pixTex(D, D, (g) => {
      g.clearRect(0, 0, D, D);
      const c = D / 2;
      // the mass, ragged at the rim only — notches that reach inside are what
      // punched holes in the front sheet and the same mistake is available here
      g.fillStyle = PAL[0];
      g.beginPath(); g.ellipse(c, c, c - 3, c - 3, 0, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2 + rr() * 0.3, d = 1.0 + rr() * 0.10;
        g.fillStyle = PAL[0];
        g.beginPath();
        g.ellipse(c + Math.cos(a) * (c - 3) * d * 0.94, c + Math.sin(a) * (c - 3) * d * 0.94,
                  2 + rr() * 3, 2 + rr() * 3, 0, 0, Math.PI * 2);
        g.fill();
      }
      // branches radiating from the trunk, which is what you actually see
      // looking up through a canopy
      g.strokeStyle = '#3a2b1e'; g.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + rr() * 0.6;
        g.lineWidth = 2.4 - (i % 3) * 0.5;
        g.beginPath(); g.moveTo(c, c);
        g.lineTo(c + Math.cos(a) * (c - 6) * (0.6 + rr() * 0.35),
                 c + Math.sin(a) * (c - 6) * (0.6 + rr() * 0.35));
        g.stroke();
      }
      // clumping, so it is not a flat disc of one green
      for (let i = 0; i < 34; i++) {
        const a = rr() * Math.PI * 2, d = rr() * (c - 6);
        g.fillStyle = rr() < 0.5 ? PAL[1] : PAL[2];
        g.beginPath();
        g.ellipse(c + Math.cos(a) * d, c + Math.sin(a) * d,
                  3 + rr() * 6, 3 + rr() * 5, rr() * Math.PI, 0, Math.PI * 2);
        g.fill();
      }
      dither(g, D, D, 260);
    }), 'detail');
    underCache.set(v % 4, t);
    return t;
  };
  const crownUnder = (x: number, y: number, z: number, r: number, v: number) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 14),
      new THREE.MeshBasicMaterial({ map: crownUnderTex(v), alphaTest: 0.5,
                                    side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;          // lies flat; edge-on from every side view
    m.position.set(x, y, z);
    m.userData.crownUnder = true;
    scene.add(m);
    lit(m);
    return m;
  };
  for (let z = -2; z > -L + 8; z -= 14) {
    const s = Math.round(z / 14) % 2 === 0 ? 1 : -1;
    const tx = s * TRUNK_X;                        // the trunk, inboard of the lane
    const px = s * PIT_X;                          // the well it stands in, which does not move
    const pz2 = Math.round(z - 0.5) + 0.5 + (TREE_SHIFT[treeIdx] ?? 0); // snapped to the 1 m slab grid
    // rnd() is consumed for EVERY tree regardless, so trimming one does not
    // shift the seeded stream and change the others.
    const H = Math.round((90 + Math.floor(rnd() * 24)) * (TREE_TRIM[treeIdx] ?? 1));
    const tree = board(treeSprite(treeIdx, H), TREE_W * TREE_PX, H * TREE_PX, tx, pz2);
    tree.position.y = sidewalkY;
    lit(tree);
    // THE CANOPY HAD NO UNDERSIDE, which is the fault the user has now reported
    // twice — "tree looks transparent in parts that probably shouldnt be
    // transparent?" — and the second shot is taken looking straight UP.
    //
    // MEASURED BEFORE GUESSING, because the obvious suspect was wrong. The
    // canopy sheet's alpha histogram puts only 0.30% of its texels in the
    // 0.3-0.7 band that alphaTest 0.5 turns into holes, so dithered edges are
    // NOT what he is seeing. What he is seeing is geometry: crosstown.ts:840
    // spins every board on Y alone, so a billboard always faces you
    // horizontally and NEVER tilts. Stand under one and look up and you are
    // looking at a vertical card edge-on with sky all round it. Measured from
    // underneath: 21 of 37 canopies showed sky overhead, several at 100%.
    //
    // So the missing thing is a surface that faces DOWN. This is that: a crown
    // underside, level, at the height the sheet paints its crown, sized just
    // inside the silhouette so the billboard still owns every side view. It is
    // not "make the canopy bigger" — from any angle but underneath it is
    // edge-on and contributes nothing.
    crownUnder(tx, sidewalkY + (H - 26) * TREE_PX, pz2,
               TREE_W * TREE_PX * 0.40, treeIdx);
    const pit = new THREE.Mesh(pitGeo, pitMat);
    // tagged for scripts/footprint.mjs — see the note by `drop`. Anything of
    // mine that sits on the ground near the building line gets checked against
    // it, not only the litter, because the litter is simply the class that
    // failed first.
    pit.userData.groundProp = 'tree pit';
    pit.rotation.x = -Math.PI / 2;
    pit.position.set(px, sidewalkY + 0.006, pz2);
    scene.add(pit);
    obstacle({ minX: tx - 0.08, maxX: tx + 0.08, minZ: pz2 - 0.12, maxZ: pz2 + 0.12 });
    treeIdx++;
  }

  // ── streetlamps: sodium-vapor heads on bishop-crook poles. Dark cast iron
  //    by day; at dusk the lens warms up and an amber halo pools over the wet
  //    asphalt. Opacity is driven off the same night curve as the sky. ──────
  const nightLit: { mat: THREE.MeshBasicMaterial; base: number }[] = [];
  // REVERTED to the smooth radial sheets, deliberately. A stepped/dithered
  // rewrite of both of these shipped and came back worse — "street lights look
  // so much worse than they did before" (shots/user-lamppool-bad.png). It read
  // as a rendering artefact: a 50% checkerboard ring metres wide around the
  // ground pool, hard concentric bands inside it, and a saturated orange disc
  // brighter than the light it was meant to imply.
  //
  // The lesson is about what dither MEANS here. This world is hard-edged
  // texels, but the house dither — dither() on the walls — is a handful of
  // texels at low alpha, break-up. A 50% checker at high contrast across a
  // broad band is not that; at these radii (1.7 m and 3.4 m) each texel is
  // 5-7 cm on screen and the pattern reads as pattern. Light is the one thing
  // in this world with no hard edge in reality, and the smooth sheets were
  // already doing that job. Do not re-quantise these without a small test.
  const lampGlowT = declareSurface(pixTex(32, 32, (g) => {
    const gr = g.createRadialGradient(16, 16, 1, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,198,120,0.90)');
    gr.addColorStop(0.5, 'rgba(255,178,96,0.30)');
    gr.addColorStop(1, 'rgba(255,178,96,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  }), 'detail');
  // NOT WET, AND THIS IS THE JUDGEMENT baa675d7 ASKED FOR. Its sweep lists ten
  // of my decals as "transparent, unmoved, lying on ground that got wet" — four
  // 5.60 street pools and six 4.40 park pools. They are additive LIGHT, not
  // material: a pool is the lamp's beam on the road, and rain does not wet a
  // beam. Registering them would hand their colour to updateRain, which would
  // then fight nightLit for it — one writer per material, lost twice over.
  //
  // The other nine on that list ARE ground and are registered: the grime stains
  // and every litter contact shadow. Saying so here so the class does not get
  // re-filed the next time somebody sweeps it.
  const lampPoolT = declareSurface(pixTex(48, 48, (g) => {
    const gr = g.createRadialGradient(24, 24, 2, 24, 24, 24);
    gr.addColorStop(0, 'rgba(255,190,110,0.55)');
    gr.addColorStop(0.55, 'rgba(255,180,100,0.15)');
    gr.addColorStop(1, 'rgba(255,180,100,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 48, 48);
  }), 'detail');
  const poleM = new THREE.MeshBasicMaterial({ color: 0x24291f });   // dark cast iron
  const poleHi = new THREE.MeshBasicMaterial({ color: 0x323826 });
  const lensM = new THREE.MeshBasicMaterial({ color: 0x3a3324 });   // shared: dark glass by day, warms at night
  const lensDay = new THREE.Color(0x3a3324), lensLit = new THREE.Color(0xffcc82);
  const LAMP_H = 5.0;
  // A lamp anywhere, pointing anywhere. This used to be hardwired to the main
  // street — pole at s * (ROAD_HALF + 0.55), arm reaching along -x — which is
  // why builder H could not put lamps on the side street and said so in
  // ct/sidestreet.ts: the bishop-crook geometry is inline here and the
  // lamplight registry `lampHeads` is private to this module, so "a lamp built
  // out there would be a dark post that lights nothing, worse than no lamp".
  //
  // (bx, bz) is the foot of the pole and (dx, dz) is the unit direction the
  // crook reaches — toward the roadway. The main street passes (-s, 0) and the
  // side street passes (0, ±1), and nothing else about a lamp changes.
  const makeLampAt = (bx: number, bz: number, dx: number, dz: number,
                      splashSide: number | null) => {
    const reach = 1.25;                         // crook arm reaches over the road
    const headX = bx + dx * reach, headZ = bz + dz * reach;
    const z = bz;                               // pole's own z, for the pole parts
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.5, 0.28), poleHi);
    base.position.set(bx, sidewalkY + 0.25, z); scene.add(base);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.14, LAMP_H, 0.14), poleM);
    pole.position.set(bx, sidewalkY + LAMP_H / 2, z); scene.add(pole);
    // clean L crook: vertical pole + one horizontal arm (no diagonal strut) +
    // a lamp head that hangs DOWN off the arm's far end
    // the arm runs along the reach, so its long axis swaps with the direction
    const arm = new THREE.Mesh(
      dx !== 0 ? new THREE.BoxGeometry(reach, 0.12, 0.12)
               : new THREE.BoxGeometry(0.12, 0.12, reach), poleM);
    arm.position.set(bx + dx * reach / 2, sidewalkY + LAMP_H - 0.05, bz + dz * reach / 2);
    scene.add(arm);
    const head = new THREE.Mesh(
      dx !== 0 ? new THREE.BoxGeometry(0.34, 0.26, 0.32)
               : new THREE.BoxGeometry(0.32, 0.26, 0.34), poleHi);
    head.userData.lampPart = 'head';
    head.position.set(headX, sidewalkY + LAMP_H - 0.16, headZ); scene.add(head);
    const lens = new THREE.Mesh(
      dx !== 0 ? new THREE.BoxGeometry(0.26, 0.08, 0.24)
               : new THREE.BoxGeometry(0.24, 0.08, 0.26), lensM);
    lens.userData.lampPart = 'lens';
    lens.position.set(headX, sidewalkY + LAMP_H - 0.31, headZ); scene.add(lens);
    obstacle({ minX: bx - 0.2, maxX: bx + 0.2, minZ: bz - 0.2, maxZ: bz + 0.2 });
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7),
      new THREE.MeshBasicMaterial({ map: lampGlowT, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    // THE one change on top of the revert: anchor the glow to the lens.
    //
    // The complaint was that the halo floats BESIDE the head, and it is not a
    // drawing problem — it is depth. The halo is additive with depthWrite off
    // but depth TEST on, and it was centred at LAMP_H - 0.22, which is inside
    // the head box (centre -0.16, 0.26 tall, so it spans -0.29 … -0.03). The
    // opaque head therefore ate the bright core and left only the fringe
    // sticking out past its edges — a smudge to one side of a dark box, which
    // is exactly what shots/user-lampglow.png shows.
    //
    // The lens is the thing that is actually lit, and it hangs BELOW the head
    // (centre -0.31, spanning -0.35 … -0.27). Centre the halo there and the
    // core sits on the glowing lens with nothing in front of it, so the light
    // reads as coming out of the lamp. 9 cm, no redraw.
    halo.userData.lampPart = 'halo';
    halo.position.set(headX, sidewalkY + LAMP_H - 0.31, headZ);
    boards.push({ m: halo }); scene.add(halo);
    nightLit.push({ mat: halo.material as THREE.MeshBasicMaterial, base: 1.0 });
    // The wash on the road widens with the reach, or the litter and the people
    // stay lit over a stretch of pavement that is visibly dark. Same sheet,
    // same peak — a bigger plane spreads the SAME falloff over more ground,
    // which is exactly "move the edge". Base opacity comes down a touch
    // because a wider bright area adds up to more light even at equal peak.
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.6),
      new THREE.MeshBasicMaterial({ map: lampPoolT, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(headX, 0.02, headZ); scene.add(pool);
    lampHeads.push({ x: headX, z: headZ });
    // light spilling up the wall behind the lamp, on the same night curve as
    // the halo — otherwise the brick beside a lamp is as black as the brick
    // mid-block, which is what makes the street read as unlit
    // Light up the wall behind the lamp — otherwise the brick beside a lamp is
    // as black as the brick mid-block, which is what makes a street read as
    // unlit. Only where a facade is actually KNOWN to be: the main street's
    // building line is at |x| = FACE, and the side street's is not mine to
    // guess at. A splash sheet standing where there is no wall is a bright
    // rectangle hanging in the air, which is worse than no splash.
    if (splashSide !== null) {
      const splash = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 5.0),
        new THREE.MeshBasicMaterial({ map: wallSplashT, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      splash.position.set(splashSide * (FACE - 0.06), sidewalkY + 2.7, z);
      splash.rotation.y = -splashSide * Math.PI / 2;   // face the street, not the brick
      scene.add(splash);
      nightLit.push({ mat: splash.material as THREE.MeshBasicMaterial, base: 0.62 });
    }
    // ── THE PAINTED ROAD POOL COMES DOWN, BECAUSE IT IS NOW DOUBLE-COUNTED ──
    //
    // This 5.6 m additive quad existed because nothing else could put light on
    // the ground: the ground is in wetMats, which both night-grading loops
    // skip, so a decal was the only mechanism available. It is also the whole
    // of the user's complaint — a quad was laid on the ROADWAY and never on the
    // pavement, so the road had a pool and the sidewalk did not, and no amount
    // of registering things could have changed that.
    //
    // Now that the ground takes the real falloff per fragment, the quad is the
    // same light a second time, in one place only. Left at full strength the
    // road sat about twice as bright as before while the pavement beside it was
    // correct, which is the original inconsistency with its sign flipped.
    //
    // Kept at a low base rather than deleted: at 0.22 it is no longer the light
    // — the shader is — but it still puts a soft bloom right under the head
    // where wet asphalt would scatter it, and that read better than nothing in
    // the frames. Deleting the mesh outright is the tidier change and it is
    // NOT the one I am making, because the pool sheet is also what the park
    // lanterns use at :1851 and that call is on the same texture.
    nightLit.push({ mat: pool.material as THREE.MeshBasicMaterial, base: 0.22 });
  };
  // 0.35 OFF THE KERB, not 0.55. The lane audit traced twelve separate stretches
  // of walk under 1.00 m — both walks, both side streets — to this one number,
  // and found nothing was encroaching: every post in the world sits at exactly
  // ±5.55, all placed correctly to the same rule, and the rule simply left too
  // little behind it. That is one constant, not twelve tickets.
  //
  // Kerb 5.00, facade collider 6.70, so the lane is 1.70 m. A post at 5.55
  // occupies 5.35…5.75 and eats 0.75 m of it while leaving 0.35 m of slack it
  // was not using on the ROAD side. Moved to 5.35 it occupies 5.15…5.55: still
  // 0.15 m clear of the kerb, nothing over the carriageway, and every 0.95 m
  // stretch becomes 1.15 m.
  //
  // The base is 0.28 wide, so it spans 5.21…5.49 and stays comfortably inside
  // the walk, which starts at ROAD_HALF + CH = 5.0625 — checked, because the
  // audit explicitly did not claim it and asked someone to eyeball it.
  const LAMP_OFF = 0.35;
  const makeLamp = (s: number, z: number) =>
    makeLampAt(s * (ROAD_HALF + LAMP_OFF), z, -s, 0, s);
  // A PARK LAMP: a post with a lantern on top, no crook and no arm. Shorter
  // than the street's 5 m because it lights a footpath rather than a roadway.
  //
  // IT STANDS ON THE PARK'S FLOOR, AND THE PARK SAYS WHERE THAT IS. This read
  // `const y0 = KERB_H` under a comment asserting the park's ground "is at
  // KERB_H" — true when written, and an assumption about somebody else's module
  // rather than a fact I could defend. 46b330d35 is the owner of that ground
  // arriving to say they had re-cut the loop these lamps sit along and crowned
  // the field 0.10 m with a mound reaching 0.37, and asking whether I had
  // stranded a lamp in it. I had not — all ten still stand at 0.140 — but that
  // was luck rather than design, and they had to come and check MY file to find
  // out.
  //
  // crosstown.ts publishes the park's site at :203, seven lines before
  // buildProps at :210, and Site carries its floor as `y`. So ask. KERB_H stays
  // as the fallback for the case where the site is not published, which is the
  // only case where a constant was ever the right answer.
  const PARK_LAMP_H = 3.4;
  const makeParkLamp = (x: number, z: number) => {
    const y0 = site('park')?.y ?? KERB_H;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.42, 0.26), poleHi);
    base.position.set(x, y0 + 0.21, z); scene.add(base);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.11, PARK_LAMP_H, 0.11), poleM);
    pole.position.set(x, y0 + PARK_LAMP_H / 2, z); scene.add(pole);
    // THE GLASS IS THE LANTERN. The first version had an opaque 0.30 body with
    // the lens sealed inside it, which is wrong twice over: the glass — the
    // only part that lights up — was invisible, and the halo's core sat inside
    // an opaque box and got eaten. That is exactly the defect the street lamps
    // were rebuilt for, shipped again an hour later on a new lamp, and my own
    // scripts/glow.mjs caught it the moment it was taught what a park lantern
    // looks like.
    //
    // A park lantern is a collar, a glazed box, and a cap over it. Nothing
    // stands in front of the glass.
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.24), poleHi);
    collar.userData.lampPart = 'head';
    collar.position.set(x, y0 + PARK_LAMP_H + 0.03, z); scene.add(collar);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.22), lensM);
    // TAGGED, not left to be recognised by its dimensions. scripts/park.mjs
    // matched the glass by an exact 0.22 x 0.20 x 0.22 and went silently blind
    // the moment those numbers changed — reporting ZERO park lamps in a park
    // that has ten. That is the third time a check keyed to exact geometry has
    // stopped seeing the thing it checks, so this one is keyed to a name.
    lens.userData.parkLantern = true;
    lens.userData.lampPart = 'lens';
    lens.position.set(x, y0 + PARK_LAMP_H + 0.20, z); scene.add(lens);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.07, 0.36), poleM);
    cap.position.set(x, y0 + PARK_LAMP_H + 0.37, z); scene.add(cap);
    obstacle({ minX: x - 0.16, maxX: x + 0.16, minZ: z - 0.16, maxZ: z + 0.16 });
    // the halo, anchored on the lens exactly as the street's is
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({ map: lampGlowT, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending }));
    // on the glass, which is now the thing that is actually lit and has
    // nothing in front of it
    halo.userData.lampPart = 'halo';
    halo.position.set(x, y0 + PARK_LAMP_H + 0.20, z);
    boards.push({ m: halo }); scene.add(halo);
    nightLit.push({ mat: halo.material as THREE.MeshBasicMaterial, base: 1.0 });
    // the pool on the ground. Smaller than the street's 5.6 m because the
    // lantern is 1.6 m lower — the same light from lower down covers less.
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4),
      new THREE.MeshBasicMaterial({ map: lampPoolT, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.rotation.x = -Math.PI / 2;
    // ABOVE THE PARK'S WHOLE GROUND STACK, not 2 cm off the base slab.
    //
    // ct/park.ts separates its coplanar ground detail in y, on a LIFT = 0.006
    // unit: field at 0.5, paths 1.0, litter 1.5, the bald ring 2.0, the desire
    // lines 2.5 — so the detail tops out ~15 mm above the terrain, and the
    // terrain is a mound rather than a flat slab. My pool sat at +0.02 off the
    // base, which put it INSIDE that stack.
    //
    // Measured: three of the ten park pools were partly covered by opaque
    // desire-line panels at y 0.176 against a decal at 0.160 — 11.96 m2 of
    // overlap in total, worst single patch 3.61 m2 out of a 19.36 m2 pool. The
    // pool is additive light with depthWrite off, but it still depth-TESTS, and
    // opaque geometry draws first, so where they cross the lamplight simply
    // stops. A dark patch inside a lit pool.
    //
    // A lamp's pool is light falling ON the ground, so it belongs above
    // everything lying on the ground. +0.05 clears the top of the stack by
    // 14 mm; there is no z-fighting to trade against because this never writes
    // depth, and 5 cm of float is imperceptible on a light decal. Checked that
    // nothing is lost the other way: at the old height no pool had any of its
    // area under the terrain, so raising it only increases clearance.
    pool.position.set(x, y0 + 0.05, z); scene.add(pool);
    nightLit.push({ mat: pool.material as THREE.MeshBasicMaterial, base: 0.72 });
    lampHeads.push({ x, z });
  };
  // staggered down the block, kept clear of the tree pits (every 14 m at −2,−16…)
  [[-1, -9], [1, -23], [-1, -37], [1, -51], [-1, -65], [1, -79]].forEach(([s, z]) => makeLamp(s, z));
  // two more lighting the corner turn
  makeLamp(-1, -93);

  // ── THE PARK, which had no light source at all ──────────────────────────
  //
  // The auditor: "NOT lit — ZERO light sources; black at night." The user:
  // "maybe the shittiest park ive ever seen". A 32 x 30 m park with nothing
  // emitting light, in a world whose night floors I have just taken down to
  // 0.045, is a black void — and builder E could not fix it, because lamps
  // live in this file. It has been waiting on me.
  //
  // A park lamp is NOT a street lamp. No bishop crook and no arm reaching over
  // a roadway: a shorter post with a lantern on top of it, throwing straight
  // down onto the path it stands beside. Same glow sheet, same ground pool,
  // same lampHeads registry, so anything standing near one warms exactly as it
  // does on the street.
  //
  // WHERE THEY GO IS DERIVED, NOT GUESSED. The desk offered to get the path
  // coordinates from E, and the park has been re-cut twice tonight — which is
  // the argument for not holding a number at all. ct/park.ts builds its loop
  // entirely from ctx.site('park') plus four offsets, so this reads the same
  // site and applies the same four. If the park moves again, the lamps move
  // with it. scripts/park.mjs then checks every lamp actually stands beside
  // the path, so if E changes those offsets this fails loudly instead of
  // quietly lighting the grass.
  const parkSite = site('park');
  if (parkSite) {
    // ct/park.ts: backX = minX + 3.2, EDGE_X = maxX - KERB_W (0.25),
    //             lx1 = EDGE_X - 1.35, lz0/lz1 = minZ/maxZ -+ 1.7
    const lx0 = parkSite.minX + 3.2, lx1 = parkSite.maxX - 0.25 - 1.35;
    const lz0 = parkSite.minZ + 1.7, lz1 = parkSite.maxZ - 1.7;
    // Lamps stand on the GRASS just off the path, on the field side of every
    // leg — which is where park lamps stand, and which keeps the 1.5 m path
    // itself completely clear of a new collider.
    const OFF = 0.95;
    const legs: [number, number, number, number][] = [
      [lx1 - OFF, lz0, lx1 - OFF, lz1],     // street leg, field side
      [lx0 + OFF, lz1, lx0 + OFF, lz0],     // back leg, field side
    ];
    // Spaced so the path READS END TO END: four to a leg over ~26.6 m is one
    // every 8.9 m, which is tighter than the street's 14 m on purpose. A park
    // path is what you are looking along, and the gaps between street lamps
    // are a feature of a street rather than of a footpath you have to follow.
    for (const [ax, az, bx2, bz] of legs) {
      for (let k = 0; k < 4; k++) {
        const u = (k + 0.5) / 4;
        makeParkLamp(ax + (bx2 - ax) * u, az + (bz - az) * u);
      }
    }
    // and one at each end of the loop, so the corners are not the dark bit
    for (const cz of [lz0 + 0.95, lz1 - 0.95]) {
      makeParkLamp((lx0 + lx1) / 2, cz);
    }
  }

  // ── the side street, which had no lamps at all after dark ───────────────
  //
  // Builder H was blocked on this and said exactly why in ct/sidestreet.ts:
  // the crook geometry was inline here and `lampHeads` is private, so a lamp
  // built from that module "would be a dark post that lights nothing — worse
  // than no lamp". makeLampAt above is the factory that unblocks it, and these
  // are the lamps; H's file needs no edit and neither does crosstown.ts.
  //
  // DENSITY FALLS OFF, matching what H did with the trees and the parked cars:
  // gaps grow eastward, 14 then 16, rather than the main street's even 14. The
  // one thing NOT thinned to nothing is the last stretch — H leaves 42…55
  // deliberately bare of trees and cars, but a street that goes pitch dark
  // before the fog does is the problem being fixed, not the effect wanted, so
  // the last lamp sits at 50.
  //
  // Placed to interleave with H's trees rather than beside them: those are at
  // x 13 and 31 on the north walk and 21 and 43 on the south, so these sit at
  // 20 north, 34 south, 50 north and no lamp is within 7 m of a tree on its
  // own side. The walk past each is the same 0.5 m the main street gets,
  // because the offsets are the same offsets.
  const SIDE_Z0 = -98, SIDE_Z1 = -108;   // as declared in crosstown.ts
  // KEEP OFF THE DOOR LINES. Builder F traced a walk that stopped 1.86 m short
  // of the casino door to a 0.4 m post at (50.0, -97.65) — which is this lamp,
  // and F attributed it to "H or D" because street furniture is usually
  // theirs. It is mine.
  //
  // The pinch is not the lamp being misplaced: the north side-street walk is
  // 1.70 m of clear space (kerb -98 to shopfront collider -96.30), so a lamp
  // 0.35 m off the kerb leaves 1.15 m — exactly what every main-street lamp
  // leaves after the lane audit, and the standard this world now runs to.
  // 1.15 m is fine to WALK past. It is not fine to stand in front of a DOOR
  // in, where you have to stop, turn and press a key: 0.43 m of standing room
  // once a 0.72 m player is subtracted.
  //
  // So the lamp moves off the door's line rather than the offset changing. The
  // two doors on this walk are the hotel at x 39.51 and the casino at 51.29
  // (ct/int-hotel.ts and ct/int-casino.ts declare them), and x = 45 is the
  // clear middle — 5.5 m from one and 6.3 m from the other. It costs the
  // eastward thinning its last step, 14 then 11 instead of 14 then 16, which
  // is a spacing preference losing to a doorway. That is the right way round.
  const SIDE_DOORS = [39.51, 51.29];
  for (const [lx, side] of [[20, 1], [34, -1], [45, 1]] as [number, 1 | -1][]) {
    if (side > 0 && SIDE_DOORS.some((d) => Math.abs(d - lx) < 3)) continue;
    // side +1 is the NORTH kerb at SIDE_Z0, and the pole stands 0.55 m out on
    // the walk with the crook reaching south over the road; -1 mirrors it.
    // same offset as the main street's, and for the same reason — three of the
    // twelve tight stretches the audit found are on these two walks
    const bz = side > 0 ? SIDE_Z0 + LAMP_OFF : SIDE_Z1 - LAMP_OFF;
    makeLampAt(lx, bz, 0, side > 0 ? -1 : 1, null);
  }
  makeLamp(1, -93);

  // hydrant on the right sidewalk — hard against the kerb like the trees, with
  // a tight collider, so it doesn't block the building-side walking lane
  const hyX = ROAD_HALF + 0.35, hyZ = -6;
  const hyd = board(hydrantSprite(), 0.8, 1.2, hyX, hyZ);
  hyd.position.y = sidewalkY;
  lit(hyd);
  obstacle({ minX: hyX - 0.18, maxX: hyX + 0.18, minZ: hyZ - 0.18, maxZ: hyZ + 0.18 });
  // pigeons peck along the kerb — most spook when you walk up; the odd bold
  // one holds its ground until you all but step on it
  interface Pigeon {
    m: THREE.Mesh; x: number; z: number; y: number;
    vx: number; vy: number; vz: number;
    state: 'peck' | 'fly'; bold: boolean; t: number; ph: number;
  }
  const pigeons: Pigeon[] = [];
  const pigeonT = pigeonSprite();
  for (let i = 0; i < 4; i++) {
    const x = -(ROAD_HALF + 0.5 + rnd() * 1.2), z = -20 - rnd() * 4;
    const b = board(pigeonT, 0.42, 0.42, x, z);
    pigeons.push({ m: b, x, z, y: 0, vx: 0, vy: 0, vz: 0, state: 'peck', bold: rnd() < 0.18, t: 0, ph: i * 2.4 });
  }
  // scattered cereal draws them in and holds them there
  const crumbT = declareSurface(pixTex(32, 32, (g) => {
    g.fillStyle = '#d9c9a0';
    for (let i = 0; i < 42; i++) g.fillRect(Math.floor(Math.random() * 30), Math.floor(Math.random() * 30), 2, 2);
  }), 'detail');
  const crumbMat = new THREE.MeshBasicMaterial({ map: crumbT, alphaTest: 0.5, side: THREE.DoubleSide });
  let crumbs: { x: number; z: number; y: number; t: number; m: THREE.Mesh } | null = null;

  // ── the payphone ────────────────────────────────────────────────────────
  //
  // MOVED TO THE ALLEY MOUTH, and rebuilt as a shelter with real depth.
  //
  // The user, on shots/user-phone-booth.png, offered to move it or delete it.
  // The desk ruled MOVE, and named three candidates — the bodega corner, the
  // alley mouth, or beside the bus bench. The alley mouth, for three reasons
  // and the third is the one that decided it:
  //
  //  · it is the classic spot, and it gives the alley entrance a reason for
  //    somebody to be standing there
  //  · ct/crowd-net.ts already has a node called `w-alley` at (-6, -40) with
  //    no `act` on it — the one stop on the west walk with nothing to do
  //  · IT IS THE ONLY ONE OF THE THREE WHERE DEPTH IS FREE. The desk asked for
  //    real depth and a visible side wall, and the walk is 2 m with walkers
  //    running at x = -6 ± 0.55 (STRAY in crowd-net), so anything against the
  //    shopfronts may be 0.45 m deep at the absolute most. The alley mouth is
  //    a gap in the building line — measured, no collider between z -43.5 and
  //    -37.0 — so a 0.62 m shelter stands entirely OUTSIDE the walk and costs
  //    the sacred lane nothing at all.
  //
  // Where it was: dead centre of the MERIDIAN window, covering the blinds and
  // cutting the facade in half, and 0.30 m deep so that head-on it had no
  // side to see and read as a printed panel leaning on the wall. Both of the
  // user's complaints in one object, and both were placement and depth.
  //
  // It stands on the ALLEY FLOOR (y ~ 0.005), which is 0.14 m below the walk,
  // and 5 cm clear of the walk slab's west face — abut, never coincide
  // (GOTCHAS 6): a booth flush against x = -7 would z-fight the kerb slab down
  // its whole height.
  const PHONE_X = -7.62, PHONE_Z = -37.35;
  const P_W = 1.00, P_D = 0.62, P_H = 2.30;
  const P_Y = 0.005;                       // the alley floor, NOT sidewalkY

  // enamelled steel: pale institutional grey-blue, a darker kick at the
  // bottom where boots and mops have been, rivets down the corners
  const boothPanel = declareSurface(pixTex(32, 74, (g) => {
    g.fillStyle = '#9aa0a4'; g.fillRect(0, 0, 32, 74);
    g.fillStyle = '#7d8489'; g.fillRect(0, 60, 32, 14);            // kick panel
    g.fillStyle = '#6d7479'; g.fillRect(0, 59, 32, 1);
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, 0, 1, 74);
    g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(31, 0, 1, 74);
    for (let y = 3; y < 74; y += 9) {                              // rivets
      g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(2, y, 1, 1); g.fillRect(29, y, 1, 1);
    }
    // DETERMINISTIC LOCAL HASH, not rnd() and not Math.random(). GOTCHAS 2:
    // there is ONE seeded rnd() stream and its call ORDER is load-bearing, so
    // drawing 66 numbers here would shuffle every pigeon and every piece of
    // litter built after this line. This sheet has to look the same either way.
    const h = (i: number) => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
    for (let i = 0; i < 22; i++) {
      const x = Math.floor(h(i) * 30), y = Math.floor(h(i + 91) * 70);
      g.fillStyle = `rgba(46,44,40,${0.06 + h(i + 173) * 0.14})`;
      g.fillRect(x, y, 1 + Math.floor(h(i + 257) * 4), 1);
    }
    dither(g, 32, 74, 90);
  }), 'detail');

  // the backlit header. Cream on blue, and DECLARED a light source rather
  // than drawn hot enough to trip the heuristic — see isSelfLit above.
  const boothHead = declareSurface(pixTex(30, 9, (g) => {
    g.fillStyle = '#2f5490'; g.fillRect(0, 0, 30, 9);
    g.fillStyle = '#3f68a8'; g.fillRect(1, 1, 28, 3);              // the tube behind it
    g.fillStyle = '#f2eee0'; g.font = 'bold 6px monospace'; g.textAlign = 'center';
    g.fillText('PHONE', 15, 7);
    g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(0, 8, 30, 1);
  }), 'detail');

  // the instrument: dark chassis, steel keypad plate, coin box, handset on
  // its hook down the left with the armoured cord under it
  const boothPhone = declareSurface(pixTex(22, 38, (g) => {
    g.fillStyle = '#20242a'; g.fillRect(0, 0, 22, 38);
    g.fillStyle = '#2b3037'; g.fillRect(1, 1, 20, 36);
    g.fillStyle = '#9ba1a6'; g.fillRect(9, 4, 11, 13);             // keypad plate
    g.fillStyle = '#3a3f46';
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) g.fillRect(10 + c * 3, 5 + r * 3, 2, 2);
    g.fillStyle = '#7e848a'; g.fillRect(9, 19, 11, 5);             // coin plate
    g.fillStyle = '#15181c'; g.fillRect(12, 20, 5, 1);             // slot
    g.fillStyle = '#8d9298'; g.fillRect(9, 27, 11, 8);             // instruction card
    g.fillStyle = '#4a4f55'; for (let y = 29; y < 34; y += 2) g.fillRect(10, y, 8, 1);
    g.fillStyle = '#14171b'; g.fillRect(2, 3, 5, 16);              // handset on the hook
    g.fillStyle = '#23272d'; g.fillRect(3, 5, 3, 12);
    g.fillStyle = '#181b20';                                        // armoured cord
    for (let y = 20; y < 34; y += 2) g.fillRect(3 + (y % 4 === 0 ? 0 : 1), y, 3, 1);
    dither(g, 22, 38, 40);
  }), 'detail');

  const box = (w: number, h: number, d: number, x: number, y: number, z: number,
               m: THREE.Material) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    b.userData.payphone = true;      // findable by name, not by size — park.mjs
    scene.add(b);
    return b;
  };
  const panel = flat(boothPanel);
  const backZ = PHONE_Z + P_D / 2 - 0.03;
  const frontZ = PHONE_Z - P_D / 2;
  // back slab, two side wings, and a canopy that projects past both
  const parts = [
    box(P_W, P_H, 0.06, PHONE_X, P_Y + P_H / 2, backZ, panel),
    box(0.06, P_H - 0.22, P_D - 0.06, PHONE_X - (P_W / 2 - 0.03), P_Y + (P_H - 0.22) / 2, PHONE_Z + 0.03, panel),
    box(0.06, P_H - 0.22, P_D - 0.06, PHONE_X + (P_W / 2 - 0.03), P_Y + (P_H - 0.22) / 2, PHONE_Z + 0.03, panel),
    box(P_W + 0.10, 0.17, P_D + 0.09, PHONE_X, P_Y + P_H - 0.085, PHONE_Z - 0.03, panel),
    // the shelf you put a coffee on, and the directory swinging under it
    box(0.66, 0.05, 0.24, PHONE_X, P_Y + 1.02, backZ - 0.15, panel),
    box(0.20, 0.26, 0.06, PHONE_X + 0.20, P_Y + 0.87, backZ - 0.15, panel),
  ];
  // the instrument, proud of the back slab so it is an object bolted on rather
  // than a picture printed on it
  parts.push(box(0.44, 0.76, 0.15, PHONE_X, P_Y + 1.52, backZ - 0.10, flat(boothPhone)));
  // and the header, on the canopy's front face and only there
  const headM = flat(boothHead);
  headM.userData.lightSource = true;
  parts.push(box(P_W - 0.04, 0.24, 0.05, PHONE_X, P_Y + P_H - 0.30, frontZ - 0.015, headM));
  for (const p of parts) lit(p);
  // The collider is the shelter's own footprint and NOTHING MORE. It ends at
  // x = -7.07, so the walk (x -7.00 … -5.06) is untouched and no walker can be
  // pushed toward the road by it.
  obstacle({ minX: PHONE_X - P_W / 2 - 0.05, maxX: PHONE_X + P_W / 2 + 0.05,
             minZ: PHONE_Z - P_D / 2 - 0.05, maxZ: PHONE_Z + P_D / 2 + 0.05 });

  // weather: the rain comes and goes by the hour, and the ground
  // remembers it — every registered wet surface darkens as it comes in
  // Registered rather than called by name from the sim loop. PROPS order: it
  // must run AFTER the world state hooks (it reads the hour) and BEFORE the
  // billboard pass, because it tints the wet ground the billboards sit on.
  ctx.onFrame((f) => updateRain(f.dt, f.px, f.pz, f.hourAbs), ORDER.PROPS);

  const updateRain = (dt: number, px: number, pz: number, hAbs: number) => {
    playerX = px; playerZ = pz;      // for the lamp cull in updateLit
    const wantRain = rainAt(hAbs) && px < 100 ? 1 : 0;
    rainLevel += (wantRain - rainLevel) * Math.min(1, dt * 0.6);
    // LATCHED, not read live. `stormAt(hAbs)` on the hour the rain STOPS is a
    // different draw from the storm that is currently fading out, so reading it
    // every frame would step the drop count sideways mid-fade — the one moment
    // the player is looking straight at it. Hold the strength for as long as it
    // is actually raining and let it ride the fade out.
    if (wantRain) stormNow = stormAt(hAbs);
    // Published for the same reason rainAt is: an instrument that re-derives
    // "how heavy is it right now" from the material's alpha is re-deriving a
    // number the world already knows, and that is exactly how the reading this
    // item was built on ("rainLevel never exceeds 0.28") came out wrong.
    scene.userData.stormNow = stormNow;
    scene.userData.rainHeavy = rainLevel * stormNow;
    if (px > 100) rainLevel = 0; // it NEVER rains indoors — cut, don't fade
    // Wet fast, dry slow. Soaking takes seconds; drying takes minutes of game
    // time, longer after a long storm and longer again at night when there is
    // no sun on it. This asymmetry is the whole point — it is what makes the
    // street remember the weather.
    if (rainLevel > 0.02) {
      wetness += (1 - wetness) * Math.min(1, dt * 0.55);
      soak = Math.min(1, soak + dt / 100);
    } else {
      const dryFor = 48 * (1 + soak * 1.5) * (1 + nightNow * 1.1);
      wetness = Math.max(0, wetness - dt / dryFor);
      soak = Math.max(0, soak - dt / (dryFor * 2));
    }
    // The ground darkens + cools as it wets down (roads and walks) — AND
    // loses the ambient after dark. updateRain is the single writer for these
    // materials, so it has to compose both; when it only did the wet half,
    // the road and the sidewalk kept full daylight brightness all night,
    // which is exactly why they read as "daylight asphalt with a filter".
    const amb = ambient(FLOOR_GROUND);
    // ── THE GROUND IS NOT IN litList AT ALL, AND THAT IS THE SIDEWALK BUG ──
    //
    // Both night-grading loops skip anything in wetMats — "one writer per
    // material", which is right and must stay. But the road, the sidewalk, the
    // kerb and the gutter are ALL wet surfaces, so the entire ground plane of
    // the world was never in the lamplight registry in the first place. Not
    // refused by the span taper: absent, and so far upstream of it that the
    // taper was a red herring for the ground specifically.
    //
    // Which is why the visible pool on the road is a painted additive quad and
    // not light: with no ground in the pool registry, a decal was the only way
    // anything could appear under a lamp at all. And a decal was placed on the
    // roadway and never on the pavement, which is the user's sentence word for
    // word — "the lighting only affects the street but not the sidewalk".
    //
    // Fixed here rather than by moving the ground into litList, because
    // updateRain must remain its single writer. The pool is not a colour write
    // — it is a shader the material carries — so the two do not fight: this
    // loop keeps writing the wet-and-graded colour, and hands the fragment the
    // ambient it used, exactly as the litList path does.
    for (const w of wetMats) {
      if (w.m.userData.noLight || w.m.blending === THREE.AdditiveBlending) continue;
      let u = wetPoolAmb.get(w.m);
      if (!u) { u = { value: 1 }; wetPoolAmb.set(w.m, u); attachPool(w.m, u); }
      u.value = amb;
    }
    for (const w of wetMats) {
      // The wet registry is graded too — updateRain owns these colours, and the
      // note asking for the stamp called this out as the other blind spot. Same
      // key so one test covers both, plus `wet` for anything that needs to know
      // WHICH writer owns it.
      if (!w.m.userData.graded) { w.m.userData.graded = true; w.m.userData.wet = true; }
      // Not every surface gives the water up at the same rate. The road crown
      // sheds it first; the gutter is where it is all running TO, so that
      // holds on longest. We can tell them apart by the shape of their sheet
      // — the kerb and gutter are long thin strips, everything else is a
      // broad surface — which keeps this local instead of needing a new field
      // on the shared WetSurface type.
      const img = (w.m.map?.image as { height?: number; width?: number } | undefined);
      const holdsWater = !!img?.height && img.height < 32;
      const wSurf = Math.pow(wetness, holdsWater ? 0.55 : 1.7);
      // WET DARKENS. IT NEVER LIGHTENS, and until 5a24c796 this could.
      //
      // The lerp pulls a surface toward WET, a fixed grey-blue at luminance
      // ~0.14. That darkens everything it was written for — asphalt, concrete,
      // the gutter pan — because they are all brighter than it. Register
      // anything DARKER and the same line runs the other way: the casino's red
      // entrance runner, #7a2028 at 0.053, came out at 0.1148. +116%, a pale
      // grey-blue mat lighter than the wet pavement around it.
      //
      // That was found by wiring a dark surface to the registerWet I published
      // and LOOKING at it. The number alone read as a success — it moved, in a
      // registry every other ground surface uses — which is the whole argument
      // for the screenshot.
      //
      // Clamping per channel keeps every existing surface bit-identical: they
      // are brighter than WET, so the lerp already lowers them and the min is a
      // no-op. It only bites on the case that was wrong. A near-black surface
      // now stays near-black when it rains, which is what wet asphalt does to
      // something already darker than wet asphalt.
      const c = w.m.color.copy(w.base).lerp(WET, wSurf * 0.95);
      c.r = Math.min(c.r, w.base.r);
      c.g = Math.min(c.g, w.base.g);
      c.b = Math.min(c.b, w.base.b);
      c.multiplyScalar(amb);
    }
    // water pools slower than it falls, and lingers after it stops
    // the walls' splash-back rides the same ground state, so it lingers after
    // the rain exactly as the street does. Eased off at night so a wet wall in
    // the dark does not go to black.
    for (const m of splashMats) {
      // 0.55 not 1.0: the sheet's own alpha peaks at 0.62, and stacking a full
      // strength multiplier on top of that paints the base of every wall solid
      m.opacity = 0.55 * Math.pow(wetness, 0.8) * (1 - 0.45 * nightNow);
      m.visible = m.opacity > 0.015;
    }
    // The puddle fill/colour pass stood here. Note what did NOT go with it:
    // `wetness` still rises fast and falls slowly, so the street still stays
    // wet after the rain stops. That was the liked half and it is untouched.
    rain.visible = rainLevel > 0.02;
    if (rain.visible) {
      // HEAVY IS A COUNT, NOT AN ALPHA. Opacity alone cannot make rain heavy —
      // it makes the same drizzle louder, and past about 0.6 the drops go from
      // faint to hard-edged without ever getting more numerous. So `heavy`
      // spends itself on three things at once, which is what actually reads as
      // weather: how MANY drops are drawn, how solid each one is, and how fast
      // they fall.
      const heavy = rainLevel * stormNow;
      rainM.opacity = 0.72 * heavy;
      // The draw range is the density axis. Positions were randomised at build
      // over the whole box, so the first n of them are a uniform sample of it —
      // taking a prefix thins the rain evenly instead of clearing one corner.
      // Floored so the weakest moment of the fade is still recognisably rain
      // rather than four drops hanging in the air.
      rainGeo.setDrawRange(0, Math.max(120, Math.round(RAIN_N * heavy)));
      // Rain that falls at one speed whatever the sky is doing reads as a
      // screen effect. 13 m/s was the drizzle's speed; a downpour comes down.
      const fall = 13 + 9 * heavy;
      // Rain belongs to the WORLD, not to the camera. The volume used to be
      // pinned to the player every frame (rain.position.set(px,0,pz)) with
      // fixed local x/z, so every drop translated exactly with you — a
      // personal rain cloud you could never walk out from under.
      //
      // Now drops live in world coordinates and only ever wrap by a WHOLE box
      // width when they fall outside the volume around you. Because the
      // distribution is uniform, a full-period jump is invisible — so you get
      // rain that stays put in the world while still covering wherever you are.
      const rp = rain.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < RAIN_N; i++) {
        let ry = rp.getY(i) - dt * fall;
        if (ry < 0) ry += 14;
        const rx = rp.getX(i), rz = rp.getZ(i);
        rp.setXYZ(i,
          rx - RAIN_BOX * Math.round((rx - px) / RAIN_BOX),
          ry,
          rz - RAIN_BOX * Math.round((rz - pz) / RAIN_BOX));
      }
      rp.needsUpdate = true;
    }
  };

  // pigeons: peck, chase scattered cereal, spook when approached
  const updatePigeons = (dt: number, t: number, px: number, pz: number) => {
    // the star dome rides with the player — this is the hook that already
    // receives the position every frame, and stars have no parallax
    starDome.position.set(px, 0, pz);
    if (crumbs) {
      crumbs.t -= dt;
      if (crumbs.t <= 0) { scene.remove(crumbs.m); crumbs = null; }
    }
    for (const pg of pigeons) {
      if (pg.state === 'peck') {
        const cd = crumbs ? Math.hypot(crumbs.x - pg.x, crumbs.z - pg.z) : Infinity;
        if (crumbs && cd > 1.1 && cd < 9) { // cereal pulls them in
          const a = Math.atan2(crumbs.x - pg.x, crumbs.z - pg.z);
          pg.x += Math.sin(a) * 1.5 * dt; pg.z += Math.cos(a) * 1.5 * dt;
        }
        const d = Math.hypot(px - pg.x, pz - pg.z);
        const spookAt = cd < 1.4 ? 0.5 : pg.bold ? 0.7 : 3.5; // feeding birds let you get close
        if (d < spookAt) {
          pg.state = 'fly'; pg.t = 0;
          const a = Math.atan2(pg.x - px, pg.z - pz) + (rnd() - 0.5) * 0.8;
          pg.vx = Math.sin(a) * 3.2; pg.vz = Math.cos(a) * 3.2; pg.vy = 2.6;
        }
        const pgy = Math.abs(pg.x) > ROAD_HALF && Math.abs(pg.x) < FACE + 0.3 ? KERB_H : 0;
        pg.m.position.set(pg.x, pgy + Math.max(0, Math.sin(t * 6 + pg.ph)) * 0.06, pg.z);
      } else {
        pg.t += dt;
        pg.x += pg.vx * dt; pg.z += pg.vz * dt;
        pg.vy = Math.min(pg.vy + dt * 1.5, 3.4);
        pg.y += pg.vy * dt;
        if (Math.abs(pg.x) > FACE - 0.6) { pg.x = Math.sign(pg.x) * (FACE - 0.6); pg.vx = 0; } // climb the wall, don't pass it
        pg.m.position.set(pg.x, sidewalkY + pg.y + Math.sin(t * 24) * 0.05, pg.z);
        if (pg.t > 4) {
          // settle somewhere new down the block, away from the player
          pg.state = 'peck'; pg.y = 0; pg.bold = rnd() < 0.18;
          pg.x = (rnd() < 0.5 ? -1 : 1) * (ROAD_HALF + 0.4 + rnd() * 1.4);
          pg.z = -8 - rnd() * (L - 20);
          if (Math.hypot(px - pg.x, pz - pg.z) < 8) {
            pg.z = Math.max(-L + 6, Math.min(2, pz > -L / 2 ? pz - 25 : pz + 25));
          }
        }
      }
    }
  };


  // ── litter, in the gutter where it actually collects ────────────────────
  // Placed LAST on purpose: rnd() is a shared seeded stream and the trees and
  // pigeons above draw from it, so anything new has to come after them or it
  // shifts the whole world. Kept deliberately sparse — the note was "just
  // trying to add detail and realism. dont go over board." Nothing here is
  // solid; you walk straight over it.
  // What is the ground actually AT, under a decal at this x? Three different
  // surfaces meet along the kerb line and they are at three different heights:
  // the road at 0, the gutter pan cross-sloped from 0.018 down to 0.006 at the
  // kerb, and the walk up at sidewalkY. Laying everything at one flat y is why
  // the gutter puddles ended up UNDER the pan and the awning ones under the
  // pavement.
  const surfaceY = (x: number) => {
    const ax = Math.abs(x);
    if (ax > ROAD_HALF) return sidewalkY;                       // up on the walk
    if (ax > ROAD_HALF - GUTTER_W) return gutterSurfaceY(ROAD_HALF - ax);
    return 0;                                                   // open road
  };
  // ── nothing may straddle a step in the ground ───────────────────────────
  //
  // This is the THIRD generation of one bug, so this time it is a rule rather
  // than a fix:
  //   1. everything was laid at a single flat y, and the gutter puddles ended
  //      up under the cross-sloped pan
  //   2. surfaceY(x) fixed that by sampling the ground at a POINT — which is
  //      right for a decal, because a decal has no thickness and no extent
  //   3. the litter is 3D solids with real extent, so a point sample says
  //      "this is on the walk" while a third of the object is inside the kerb
  //
  // The ground has one CLIFF in it — the kerb face at |x| = ROAD_HALF, a 12 cm
  // step — and one small lip where the gutter pan meets the asphalt, which is
  // 18 mm. They want opposite treatment.
  //
  // Nothing may straddle the cliff. Whatever single y it is given, part of the
  // object ends up inside the kerb, and no y exists that is right for both
  // sides. So slide it clear by its own half-extent, to whichever side is
  // nearer, leaving 5 mm — which also gets the look that was wanted, a piece
  // resting hard AGAINST the kerb rather than growing through it.
  //
  // The lip wants the opposite. Pushing every piece of gutter litter clear of
  // an 18 mm step would march all of it out into the road, which is not where
  // litter goes. There, sample the ground across the whole footprint and take
  // the HIGHEST, so a piece rides up on the lip instead of sinking under it.
  const KERB_X = ROAD_HALF;
  // half-extent along x of a w × d rectangle turned by rot on the ground plane
  const halfX = (w: number, d: number, rot: number) =>
    (Math.abs(Math.cos(rot)) * w + Math.abs(Math.sin(rot)) * d) / 2;
  const clearOfKerb = (x: number, hx: number) => {
    for (const line of [KERB_X, -KERB_X]) {
      if (x - hx < line && x + hx > line) {
        const lo = line - hx - 0.005, hi = line + hx + 0.005;
        return Math.abs(lo - x) <= Math.abs(hi - x) ? lo : hi;
      }
    }
    return x;
  };
  // the ground under a footprint that has already been cleared of the kerb, so
  // taking the max cannot accidentally lift something onto the walk
  // Sampled ACROSS the footprint, not at three points. Three was not enough:
  // the gutter pan rises toward the asphalt joint, so a piece whose footprint
  // straddles the joint has its highest ground somewhere in the middle of its
  // own span — at |x| = ROAD_HALF - GUTTER_W — and end-and-centre samples walk
  // straight past it. That left the fountain cups seated 2 mm under the
  // concrete, which is exactly the class of bug this function exists to stop.
  const groundUnder = (x: number, hx: number) => {
    let hi = surfaceY(x);
    for (let i = 0; i <= 8; i++) hi = Math.max(hi, surfaceY(x - hx + (2 * hx * i) / 8));
    return hi;
  };
  const flatDecal = (tex: THREE.Texture, w: number, d: number, x: number, z: number, rot: number, y: number) => {
    // alphaTest ONLY — no `transparent`. GOTCHAS §22, and it was my own file as
    // well as ct/lot.ts's. A cut-out DISCARDS its fragment and never blends, so
    // the flag buys nothing, and it puts the material on dimWorld's skip list —
    // which exists for glass. Every piece of gutter litter therefore stood at
    // 93% of daylight brightness at 23:00 while the road it sat on was at 4.5%.
    // Silent by construction: nobody screenshots litter at midnight.
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5 }));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = rot;
    m.position.set(x, y + 0.004, z);
    scene.add(m);
    return m;
  };
  const paperT = [paperTex(0), paperTex(1), paperTex(2), paperTex(3)];
  const scrapT = [scrapTex(0), scrapTex(1), scrapTex(2)];
  // the gutter line: just off the kerb face, on the road side
  // Hard against the kerb. This was ROAD_HALF - 0.22, chosen before the gutter
  // pan existed; once the pan went in, the litter sat just OUTSIDE it on open
  // asphalt, which is not where litter collects. Water runs to the kerb and
  // takes the rubbish with it, so it piles in the last few centimetres.
  const GUT = ROAD_HALF - 0.10;
  // NO canTopTex. The user, on the green-and-white one against the kerb: "i
  // dont like the trash that looks like this please get rid of all of them."
  // The sheet is still drawn in ct/tex-world.ts; nothing places it any more.
  //
  // The reason is worth carrying into everything else on the ground, because
  // it is the opposite of what the sheet's own comment claims. canTopTex rings
  // itself with a solid #16181c border on all four sides to protect the
  // silhouette at ~10 screen pixels. At that size a full border stops reading
  // as shading and reads as an OUTLINE — so the thing looks like a sticker
  // printed on the pavement rather than an object lying on it. The two pieces
  // the user did approve (scrapTex and paperTex, both below) have no ring at
  // all; their dark side does the work. Let the object's own shading carry the
  // silhouette, never a border.
  // Every one of these goes through the footprint rule above. A 0.48 m sheet
  // centred 10 cm off the kerb reaches 14 cm PAST it, and the half that lands
  // on the walk sits 12 cm underground — the same defect as the litter, in the
  // flat primitive, and it was here before the solids ever were.
  for (let i = 0; i < 7; i++) {
    const s2 = rnd() < 0.5 ? -1 : 1;
    const z = -6 - rnd() * (L - 18);
    const x = s2 * (GUT - rnd() * 0.20);
    // this draw used to pick can-or-scrap; it now picks between the two
    // approved sheets, so the seeded stream is unchanged (GOTCHAS §2)
    const paper = rnd() < 0.42;
    const rot = rnd() * Math.PI;
    const w = paper ? 0.30 : 0.26, d = paper ? 0.24 : 0.22;
    const hx = halfX(w, d, rot), cx = clearOfKerb(x, hx);
    flatDecal(paper ? paperT[i % 4] : scrapT[i % 3], w, d, cx, z, rot, groundUnder(cx, hx));
  }
  // paper trash — flyers, folded sheets, pulpy soaked handbills. More of
  // these than cans: paper is what actually collects along a wet kerb.
  for (let i = 0; i < 5; i++) {
    const s2 = rnd() < 0.5 ? -1 : 1;
    const pw = 0.34 + rnd() * 0.14, pd = 0.26 + rnd() * 0.10;
    const px2 = s2 * (GUT - rnd() * 0.22);
    const pz3 = -8 - rnd() * (L - 20), prot = rnd() * Math.PI;
    const phx = halfX(pw, pd, prot), pcx = clearOfKerb(px2, phx);
    flatDecal(paperT[i % 4], pw, pd, pcx, pz3, prot, groundUnder(pcx, phx));
  }
  // one piece up on the sidewalk, against the kerb. This was the can, and it
  // is the exact one the user pointed at — green band, black ring, reading as
  // a sticker on the slab. Same spot, approved sheet.
  {
    const w = 0.28, d = 0.24, rot = 0.7, hx = halfX(w, d, rot);
    const cx = clearOfKerb(ROAD_HALF + 0.22, hx);
    flatDecal(scrapT[1], w, d, cx, -47.5, rot, groundUnder(cx, hx));
  }


  // ── standing puddles: REMOVED, and not to be re-added ───────────────────
  //
  // DESK RULING, 2026-07-25, after five passes. The user's verdict on the last
  // one: a pale smear, lighter than the surface around it, soft-edged, and
  // straddling the kerb line — the glowing puddle they had already rejected
  // twice, plus the footprint fault, in a single object.
  //
  // The five: buried under the pan; contrast-inverted so they vanished in the
  // rain; ribbons in the gutter; a dark band down the middle of the pavement;
  // and then this. The desk's terms when it approved the fifth were explicit —
  // if it missed, standing water comes out and only the road sheen stays.
  // It missed.
  //
  // WHAT STAYED, because every part of it is confirmed and liked: the wet-look
  // darkening, the wetness outlasting the rain, the rain itself, the wet walls,
  // the gutter stain below. Only the standing sheets are gone. If you are here
  // because the street looks dry after a storm, it is not — `wetness` still
  // drives every registered surface and still ebbs slowly. Look at the road.
  //
  // The diagnosis that came out of this was right and is worth keeping even
  // though the feature is not: a puddle drawn as a FIXED dark colour inverts
  // its own contrast, because the wet tint crushes the road several times
  // darker in a storm and overtakes the sheet — so the water ends up lighter
  // than the road it lies on, at exactly the moment it should be most visible.
  // Anything reflective added here later has to be defined relative to the
  // surface it sits on, never as an absolute.
  //
  // THE SEEDED STREAM IS LOAD-BEARING (GOTCHAS 2). The placement loop drew
  // rnd() five times per patch, seven times over, and those 35 draws sat in
  // the MIDDLE of this module's construction — deleting them outright would
  // shift every later draw and move trees, pigeons and litter across the whole
  // block. So the draws stay and only the meshes go. This loop looks like dead
  // code and is not: it holds the stream's position.
  for (let i = 0; i < 7; i++) { rnd(); rnd(); rnd(); rnd(); rnd(); }
  const BASIN_Z = [-92.5, -105];
  // The permanent stain, dry or wet, and it FOLLOWS THE WATER: a narrow track
  // down the pan that darkens as it converges on the mouth. The version this
  // replaces sat symmetrically around the grate, which is the one thing water
  // never does — grime goes where the flow goes, and the flow is a ribbon in
  // the last 20 cm against the kerb.
  const stainT = declareSurface(pixTex(16, 64, (g) => {
    for (let y = 0; y < 64; y++) {
      const t = 1 - y / 63;                                     // 1 at the mouth
      const half = Math.max(1, Math.round(0.9 + t * 4.4 + (((y >> 1) % 4 === 2) ? 1 : 0)));
      g.fillStyle = `rgba(38,34,28,${(0.12 + t * 0.44).toFixed(3)})`;
      g.fillRect(8 - half, y, half * 2, 1);
      g.fillStyle = `rgba(22,21,18,${(0.12 + t * 0.42).toFixed(3)})`;
      g.fillRect(7, y, 2, 1);                                   // the channel it actually runs in
    }
  }), 'ground');
  const stain = (x: number, z: number, len: number) => {
    // WET. baa675d7 enumerated every transparent decal lying on ground that got
    // wet and found 19 of mine. This one is the clearest yes: it is grime on the
    // concrete that FOLLOWS the water — a dry stain beside a road at -83% is the
    // defect that commit was written about.
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, len),
      wet(new THREE.MeshBasicMaterial({ map: stainT, transparent: true, depthWrite: false })));
    m.rotation.x = -Math.PI / 2;
    // a grime decal is ON the concrete, unlike water, so it takes the highest
    // ground under its footprint — under the pan's high side it is invisible
    m.position.set(x, groundUnder(x, 0.17) + 0.003, z);
    scene.add(m);
  };
  stain(ROAD_HALF - 0.22, BASIN_Z[0] + 1.55, 3.1);
  stain(-(ROAD_HALF - 0.22), BASIN_Z[1] + 1.40, 2.8);
  // NO water on the road crown and NONE on the pavement. Both are gone
  // deliberately rather than tuned: a puddle out on the crown is on ground the
  // water is running OFF, and the two awning strips at x = ±5.75 were the
  // thing the user pointed at — a dark band down the middle of a footway,
  // which is not somewhere water stands. The gutter is the whole story.

  // ── the 42 stop: a flag on a pole, and a bench ──────────────────────────
  //
  // Period-correct for '97: a painted metal flag sign on a slim pole, and a
  // slat bench carrying an advertisement. No shelter, no timetable case, no
  // real-time sign — those come later. The bench ad faces the ROADWAY, which
  // is why these benches sit with their backs to the kerb: the advertiser is
  // buying the eyes of passing traffic, not the riders'.
  //
  // Placement is constrained by the walking lane, which this user guards.
  // Everything here hugs the kerb INSIDE the envelope the lamp poles already
  // set (they block out to x ≈ 6.11 with the rig's 0.36 m radius, and the
  // wall bites at 6.34): the bench reaches only 5.66, so it never becomes the
  // narrowest point on the walk. The spot is the long clear run between the
  // tree at z = −29.5 and the lamp at z = −51, clear of the Whitmore door.
  // The bench sits 1.5 m down-street of the flag — close enough to read as
  // one piece of furniture with it, far enough that you can stand at the pole
  // without stepping over someone's knees. It was 3.1 m away, which is far
  // enough to read as unrelated street furniture that happens to be nearby.
  const STOP_Z = -33.5, BENCH_Z = -35.0;
  const metalM = new THREE.MeshBasicMaterial({ color: 0x2b3138 });
  // the bench gets its OWN instance: the lamplight registry binds a material
  // to one position, and the bench stands 3 m from the pole
  const benchM = new THREE.MeshBasicMaterial({ color: 0x2b3138 });
  const flatT2 = (m: THREE.Texture) => new THREE.MeshBasicMaterial({ map: m, side: THREE.DoubleSide });

  // the flag sign — dark blue field, white pictogram, route number
  const flagT = declareSurface(pixTex(32, 44, (g) => {
    g.fillStyle = '#e8e4d8'; g.fillRect(0, 0, 32, 44);
    g.fillStyle = '#2c4a7a'; g.fillRect(1, 1, 30, 42);
    g.fillStyle = '#e8e4d8'; g.fillRect(2, 12, 28, 20);
    // a little bus, side on
    g.fillStyle = '#2c4a7a'; g.fillRect(5, 16, 22, 11);
    g.fillStyle = '#e8e4d8';
    for (let x = 7; x < 25; x += 5) g.fillRect(x, 18, 3, 4);
    g.fillStyle = '#2c4a7a'; g.fillRect(7, 27, 3, 2); g.fillRect(22, 27, 3, 2);
    g.fillStyle = '#e8e4d8';
    g.font = 'bold 8px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('BUS', 16, 7);
    g.fillText('42', 16, 38);
  }), 'sign');
  // Sign height is set to the standard: the bottom of a bus stop flag sits
  // 2.2–2.5 m above the walk. This one is at the LOW end, 2.20.
  const FLAG_BOT = 2.20, FLAG_H = 0.52;
  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.08, FLAG_BOT + FLAG_H + 0.08, 0.08), metalM);
  pole.position.set(ROAD_HALF + 0.32, sidewalkY + (FLAG_BOT + FLAG_H + 0.08) / 2, STOP_Z);
  scene.add(pole);
  // the flag faces UP-STREET so it reads to an approaching bus (and to you,
  // walking down the block); it is painted on both faces like a real one
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.40, FLAG_H, 0.04), flatT2(flagT));
  flag.position.set(ROAD_HALF + 0.32, sidewalkY + FLAG_BOT + FLAG_H / 2, STOP_Z);
  scene.add(flag);
  lit(pole); lit(flag);
  obstacle({ minX: ROAD_HALF + 0.23, maxX: ROAD_HALF + 0.41, minZ: STOP_Z - 0.09, maxZ: STOP_Z + 0.09 });

  // the bench: slat seat, slat back, cast ends, ad panel to the road
  const slatT = declareSurface(pixTex(48, 12, (g) => {
    g.fillStyle = '#6a5a42'; g.fillRect(0, 0, 48, 12);
    g.fillStyle = 'rgba(0,0,0,0.32)';
    for (let y = 3; y < 12; y += 4) g.fillRect(0, y, 48, 1);   // slat gaps
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let y = 0; y < 12; y += 4) g.fillRect(0, y, 48, 1);
    dither(g, 48, 12, 40);
  }), 'detail');
  // `slatT` ABOVE IS THE BACKREST'S BOARD, AND ONLY THE BACKREST'S.
  //
  // 48 x 12 over the backrest's 1.80 x 0.44 m face is 26.7 x 27.3 px/m — square
  // to within 2%, and its gap lines run along the 1.80 m, which is what a
  // slatted back looks like. It was ALSO handed to the three seat slats, whose
  // top face is 0.15 x 1.80 m — the same canvas on a face with u and v swapped
  // AND twelve times the aspect. Measured on the built bundle: 320 x 6.67 px/m,
  // a 48x stretch, on the three faces the player looks straight down at while
  // sitting. It also drew cross-bench "slat gaps" onto a board that is itself
  // one slat, so the seat read as if grooved the wrong way.
  //
  // A seat slat gets its own board, drawn for its own proportions: 8 x 96 is
  // exactly 0.15 : 1.80, so ONE derived repeat lands 32 px/m on both axes, and
  // the grain runs ALONG the board (the v axis here) as a sawn board's does.
  const seatSlatT = declareSurface(pixTex(8, 96, (g) => {
    g.fillStyle = '#6a5a42'; g.fillRect(0, 0, 8, 96);
    // Deterministic on purpose — NOT rnd(). That is the shared LCG this module
    // draws prop positions from (see the note at the tree loop), and spending
    // it here would move every prop placed afterwards.
    g.fillStyle = 'rgba(0,0,0,0.10)';
    g.fillRect(1, 0, 1, 96); g.fillRect(5, 0, 1, 96);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(3, 0, 1, 96); g.fillRect(6, 0, 1, 96);
    g.fillStyle = 'rgba(0,0,0,0.08)';                    // a little lengthwise figure
    for (let y = 0; y < 96; y += 13) g.fillRect(2, y, 1, 7);
    for (let y = 6; y < 96; y += 17) g.fillRect(4, y, 1, 9);
    dither(g, 8, 96, 60);
  }), 'detail');
  // 32 px/m is this world's standard density. `tex-ground.ts:181` owns it as a
  // module-private `WPM` and does not export it, so this is a CITED COPY per
  // BUILDER-BRIEF §8, not a second source of truth — hoisting it to a shared
  // export is in my handoff as a follow-up.
  const PPM = 32;
  /** a wood material drawing THIS face's own metres at 32 px/m (§7b) */
  const woodFace = (t: THREE.Texture, cw: number, ch: number, wM: number, hM: number) => {
    const c = t.clone();
    c.needsUpdate = true;
    c.wrapS = THREE.RepeatWrapping; c.wrapT = THREE.RepeatWrapping;
    c.repeat.set((wM * PPM) / cw, (hM * PPM) / ch);
    return new THREE.MeshBasicMaterial({ map: c, side: THREE.DoubleSide });
  };
  // Laid out for the PLATE it now sits on, not for the whole backrest. The copy
  // is unchanged — it was approved — but every element is inset so nothing runs
  // to an edge: the red band stops 5 px short on both sides and starts 3 px
  // down, and the two lines below have clear cream above and beneath them. A
  // frame over a FULL-BLEED ad ate the top of TONY'S PIZZA and cut the red band
  // in half, which is what a bezel does to artwork drawn as if it were not
  // there. The canvas is 112 x 24 to match the plate's 4.67:1, so the texels
  // stay square (GOTCHAS §5).
  const adT = declareSurface(pixTex(112, 24, (g) => {
    g.fillStyle = '#c9c2ae'; g.fillRect(0, 0, 112, 24);
    g.fillStyle = '#8a2c22'; g.fillRect(5, 3, 102, 8);
    g.fillStyle = '#e8e4d8'; g.font = 'bold 5px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText("TONY'S PIZZA", 56, 7);
    g.fillStyle = '#2b3138'; g.font = 'bold 6px monospace';
    g.fillText('555-0143', 56, 15);
    g.fillStyle = '#6a6458'; g.font = '5px monospace';
    g.fillText('TWO SLICES $1.75', 56, 20.5);
    dither(g, 112, 24, 50);
  }), 'sign');
  // THE BENCH TURNED ROUND. The user, twice: "like the back of the bus is in
  // the front? doesnt make sense".
  //
  // What I built was defensible and still read wrong, which is worth being
  // honest about. Real American ad benches DO sit with their backs to the
  // roadway — the advertiser is buying the eyes of passing traffic, not the
  // riders' — so the ad went on the backrest facing the street and the sitter
  // faced the shopfronts. But from the only place a player ever stands, that
  // arrangement puts a 1.8 m board between you and the seat: you see the back
  // of the thing first, the seat is hidden behind it, and it reads as a fence
  // with a plank in front. Being right about street furniture does not help if
  // the object does not read as a bench.
  //
  // So it faces the road now, which is also what a rider wants — you sit at a
  // bus stop looking for the bus. That puts the backrest BEHIND the sitter on
  // the building side, where an ad on it would face a brick wall. TONY'S PIZZA
  // moves to the KICK PANEL, the board below the seat front, which is a real
  // place bench ads go and is the part of a bench a passing car actually sees.
  // Every constraint met at once, and nothing hidden behind anything.
  //
  // AT THE KERB and BESIDE THE POLE, both of which it was not: it was 3.1 m
  // down the block from the flag, which is far enough to read as unrelated
  // street furniture rather than as part of the stop.
  // 5.07 rather than 5.12, and the 5 cm is not cosmetic: the recline below
  // throws the top of the backrest 9 cm further from the kerb, and the bench
  // may not block past x ≈ 5.75 or it becomes the narrowest point on the walk
  // — the lamp poles cap that at 6.11 with the rig's 0.36 m radius. Still
  // outboard of the chamfer at 5.0625, so it is on the walk and not over it.
  const BX_FRONT = ROAD_HALF + 0.07;         // the road-side face, hard by the kerb
  const BX_SEAT0 = BX_FRONT;
  const BX_SEAT1 = BX_SEAT0 + 0.50;          // 0.50 m of seat depth
  const BX_BACK = BX_SEAT1;                  // backrest behind the sitter
  const SEAT_Y = sidewalkY + 0.45;
  const BENCH_L = 1.8;
  // RECLINE. Dead vertical is why it read as a board rather than a seat —
  // nothing you would actually lean on is at 90 degrees. 12 degrees off
  // vertical, and the panel is lengthened to 0.44 so that after the lean its
  // top still lands at 0.88 above the walk, which is the height that was
  // approved.
  const RECLINE = 0.21;                      // ~12 degrees
  const BACK_LEN = 0.44;                     // along the panel, not vertical
  const BACK_TOP = SEAT_Y + BACK_LEN * Math.cos(RECLINE);

  // backrest: slats on the sitter's side, plain on the wall side. 43 cm of it
  // above the seat, which is what makes it a bench and not a shelf.
  // THE AD LIVES ON THE BACKREST, which is where a real bus-bench ad lives and
  // is the biggest flat face anyone actually reads. It goes on the ROAD side
  // (-x), which is counter-intuitive for a bench that faces the road until you
  // look at one: the seat pan is only 0.45 m up and the back rises to 0.88, so
  // from the roadway the whole of that face is in view above the seat. It is
  // only occluded when somebody is actually sitting there, which is exactly
  // how the real ones behave. The sitter leans on its other side.
  //
  // The recline helps it, too — tilted back 12 degrees the panel is angled up
  // toward the eye of a passing driver rather than edge-on to them.
  //
  // Pivoted at its FOOT, not its centre: the joint with the seat is the thing
  // a recline most easily opens up, and rotating about the seat's back edge
  // means the two cannot separate no matter what angle is chosen.
  //
  // BEZELLED. Flush, the ad read as paint on a plank — a real bus-bench ad is
  // a printed panel MOUNTED in a frame, and the frame is most of what says
  // "sign" rather than "painted board". Four thin bars proud of the panel face
  // on all four sides, in the bench's dark metal against the cream print, so
  // the difference is material and not just relief. 20 mm on a 440 mm panel:
  // a heavier frame at this scale starts eating the copy, which is the whole
  // reason the ad is up here.
  //
  // Built as a GROUP so the bezel rides the recline with the panel instead of
  // being positioned in a rotated frame by hand — one rotation, applied once,
  // and the frame cannot drift off the thing it frames.
  const backGrp = new THREE.Group();
  const backGeo = new THREE.BoxGeometry(0.07, BACK_LEN, BENCH_L);
  backGeo.translate(0, BACK_LEN / 2, 0);
  // the backrest itself is plain on the road side now — the ad is a plate
  const back = new THREE.Mesh(backGeo,
    [flatT2(slatT), benchM, benchM, benchM, benchM, benchM]);
  backGrp.add(back);
  const BZ = 0.020, BZP = 0.010;             // bar section, and how proud it sits
  const bezelX = -0.035 - BZP / 2;           // just off the ad face, which is -x
  for (const by of [BZ / 2, BACK_LEN - BZ / 2]) {          // top and bottom rails
    const bar = new THREE.Mesh(new THREE.BoxGeometry(BZP, BZ, BENCH_L), benchM);
    bar.userData.benchBezel = 'rail';
    bar.position.set(bezelX, by, 0); backGrp.add(bar);
  }
  for (const bz of [-1, 1]) {                              // the two stiles
    const bar = new THREE.Mesh(new THREE.BoxGeometry(BZP, BACK_LEN, BZ), benchM);
    bar.userData.benchBezel = 'stile';
    bar.position.set(bezelX, BACK_LEN / 2, bz * (BENCH_L / 2 - BZ / 2));
    backGrp.add(bar);
  }
  // THE AD IS A PLATE INSIDE THE FRAME, not a print with a frame laid over it.
  // The frame's clear opening is BACK_LEN - 2*BZ by BENCH_L - 2*BZ, and the
  // plate is inset a further 15 mm all round inside that, so there is an equal
  // margin of frame-to-artwork on all four sides and the artwork cannot be
  // clipped by the thing that is meant to surround it. The plate stands 4 mm
  // proud against the frame's 10 mm, so the frame visibly stands OVER it —
  // which is the difference between a mounted sign and a painted board.
  const AD_M = 0.015;
  const adPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.004, BACK_LEN - 2 * BZ - 2 * AD_M, BENCH_L - 2 * BZ - 2 * AD_M),
    [flatT2(adT), flatT2(adT), benchM, benchM, benchM, benchM]);
  // NAMED, not left to be found by shape. An auditor went looking for the ad
  // panel world-wide and could not find it — reasonably, because it searched
  // for "a 1.8 x 0.6 upright board" and this is a 1.73 x 0.37 plate 4 mm thick,
  // reclined 12 degrees with the backrest. A failed SEARCH is worse than a
  // failed shot: it cannot tell "not there" from "not shaped how I guessed".
  adPlate.userData.benchAd = "TONY'S PIZZA";
  adPlate.position.set(-0.035 - 0.002, BACK_LEN / 2, 0);
  backGrp.add(adPlate);
  backGrp.userData.groundProp = 'bench back';
  backGrp.position.set(BX_BACK + 0.035, SEAT_Y, BENCH_Z);
  backGrp.rotation.z = -RECLINE;             // top leans AWAY from the sitter
  scene.add(backGrp);
  lit(backGrp);
  // seat: three slats with gaps, so it reads as seating rather than a slab
  for (let i = 0; i < 3; i++) {
    const w = 0.15;
    // Group order [+x, −x, +y, −y, +z, −z] on a box authored (w, 0.05, BENCH_L):
    // +y is the 0.15 x 1.80 m face you sit on, ±z the 0.15 x 0.05 m sawn ends.
    // Both take the seat's own board with the repeat derived from their own
    // metres; the long ±x sides and the underside stay cast iron as before.
    const slat = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, BENCH_L), [
      benchM, benchM,
      woodFace(seatSlatT, 8, 96, w, BENCH_L),
      benchM,
      woodFace(seatSlatT, 8, 96, w, 0.05),
      woodFace(seatSlatT, 8, 96, w, 0.05),
    ]);
    slat.userData.groundProp = 'bench seat';
    slat.position.set(BX_SEAT0 + w / 2 + i * 0.175, SEAT_Y - 0.025, BENCH_Z);
    scene.add(slat);
    lit(slat);
  }
  // NO SKIRT. There was a slatted board under the seat front; it did nothing
  // structurally or visually and it made the bench read as a heavy box rather
  // than a seat on legs. The GAP under a bench is most of what makes one look
  // light, and on a pavement this narrow it also opens the sightline along the
  // walk. The legs carry the seat on their own, which is what legs are for.
  // four legs, not a solid box
  // THE LEGS WERE COPLANAR WITH THE SEAT. They stood 0.45 above the walk and
  // the slats' top face is at exactly 0.45 too, so leg top and slat top shared
  // a plane and z-fought — which is why they read as dark bars painted ACROSS
  // the wood rather than as legs under it (GOTCHAS §6).
  //
  // The fix is NOT to make them abut. Two faces that abut in the same plane
  // still share it. The leg top is BURIED 2 cm inside the slat instead, so it
  // is coplanar with nothing and hidden in solid geometry, while 40 cm of leg
  // stands clear below the seat where a leg belongs. Each leg sits within a
  // slat's own width in x — 5.10…5.16 under the first slat, 5.49…5.55 under
  // the third — so it never shows through a slat gap either.
  //
  // Set further in from the ends as well, so the seat visibly overhangs its
  // supports instead of stopping flush with them.
  const LEG_TOP = SEAT_Y - 0.02, LEG_H = LEG_TOP - sidewalkY;
  for (const sz of [-1, 1]) for (const lx of [BX_SEAT0 + 0.06, BX_SEAT1 - 0.05]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, LEG_H, 0.06), benchM);
    leg.userData.groundProp = 'bench leg';
    leg.position.set(lx, sidewalkY + LEG_H / 2, BENCH_Z + sz * 0.72);
    scene.add(leg);
  }
  // NO CONTACT SHADOW UNDER THE BENCH. There was one — a 0.66 x 1.92 m quad at
  // 34% black on the flags — and it is gone with the twelve litter ones below.
  // NOTHING IN THIS WORLD CASTS A SHADOW. Not the buildings, not the lamp
  // columns, not the cars. So a dark shape printed on the ground has no caster
  // the eye can find, and it stops reading as a shadow and starts reading as a
  // stain or a hole in the pavement — which is what Erick called it: "remove
  // the shadow texture". Four legs standing on the flags is what makes the
  // bench sit on the ground; a smudge was never doing that work.
  // the collider stays inside the lamp-pole envelope (they block to x ≈ 6.11
  // with the rig's 0.36 m radius) so the bench never becomes the pinch point
  // The collider follows the RECLINE. The reclined panel's top-back corner is
  // the furthest point on the bench from the kerb, and it is 9 cm past where
  // the upright one reached — derived here rather than left at the old number,
  // because the walking lane is decided by whichever prop reaches furthest and
  // this is now a candidate for that.
  const BENCH_MAX_X = BX_BACK + 0.035 + 0.035 * Math.cos(RECLINE) + BACK_LEN * Math.sin(RECLINE);
  obstacle({ minX: BX_FRONT, maxX: BENCH_MAX_X, minZ: BENCH_Z - 0.92, maxZ: BENCH_Z + 0.92 });
  // ── and you can sit on it ────────────────────────────────────────────────
  // It never was registered, which is a real gap rather than a refinement: the
  // standing instruction quoted at the top of ct/ctx.ts is "for every seat in
  // the game i want to be able to sit down", and the most obviously sittable
  // object on the block was not offering itself. Two places, because 1.8 m of
  // bench is two people.
  //
  // yaw = -pi/2 is -x, the roadway — you sit at a bus stop looking for the
  // bus, which is the same reasoning that turned the bench round. You are
  // offered it from the walking lane, since the bench itself is solid and you
  // cannot stand where the seat is.
  for (const dz of [-0.45, 0.45]) {
    seat({
      x: (BX_SEAT0 + BX_SEAT1) / 2, z: BENCH_Z + dz,
      // r 1.40, not 0.95. MEASURED against how a player actually walks past:
      // the free lane here is only 1.27 m (bench back at 5.73, shopfronts at
      // 7.0) and the spot sits at x 6.15, so at 0.95 the margin was 0.25 m
      // mid-lane, 0.94 m hugging the bench and 0.99 m — a MISS — standing one
      // pace past it. A trigger sized for standing right against the object is
      // missed by someone walking by at normal distance, which is what the user
      // hit: "cannot be sat on from the street".
      //
      // 1.40 covers the whole width of the lane and both ends of the bench.
      // Larger than the 0.62-0.66 the interior seats use, deliberately: those
      // are reached in a room where you walk up to a chair, this one is passed
      // at walking pace on a pavement.
      yaw: -Math.PI / 2, h: 0.45, r: 1.40,
      approach: { x: BENCH_MAX_X + 0.42, z: BENCH_Z + dz },
      label: 'sit at the stop',
    });
  }

  // ══════════════════ FLOOR TRASH ═════════════════════════════════════════
  //
  // The comparison rig is down. Verdict: "coffee cup is good, i like newspaper
  // as well, 3 + 5 respectively" — so the cup and the folded newspaper are
  // placed through the world below and the other five stay drawn but unplaced.
  // They are kept on purpose: two kinds of litter is thin, and reviving a
  // candidate that is already drawn is minutes, whereas drawing a new one from
  // nothing is another round of this.
  //
  // Why these seven and not the fourteen that came before — v1 was fourteen
  // flat decals and the user could not identify one of them. The rig did its
  // job (it got that verdict in one look) but the approach was wrong, for two
  // reasons worth keeping:
  //
  //   · I JUDGED THEM FROM ABOVE. A flat decal seen from 1.7 m eye height two
  //     metres away is viewed at about 15-20 degrees off the ground, which
  //     squashes it to roughly a quarter of its depth. Every shape that read
  //     beautifully top-down was a three-pixel smear in the only view the game
  //     actually has.
  //   · FLAT IS THE WRONG PRIMITIVE. Real litter has height, and that height
  //     gives it a VERTICAL face — which is the face you see standing up. A
  //     decal has none. So these are low 3D solids now: a short cylinder lying
  //     down, a low box. (GOTCHAS §3 forbids BILLBOARDS on the ground because
  //     they rotate and stand up to face you. Low geometry is not a billboard
  //     and has none of that problem.)
  //
  // Also: seven candidates, not fourteen. A cigarette end, a bottle cap, a
  // lottery slip and a receipt are 2-4 cm objects — one or two texels here,
  // unreadable at any density — so they are cut rather than iterated on.
  // And everything is drawn 1.5-2x life size, because this is a pixel world
  // and legibility beats measurement; the cat is not to scale either.
  //
  // Nothing here is solid — you walk straight over litter. Uses no rnd() at
  // all: every position, angle and grime level below is hand-placed, so the
  // seeded stream is untouched and no tree or pigeon moves (GOTCHAS §2).
  const tsurf = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
    const t = pixTex(w, h, draw); return new THREE.MeshBasicMaterial({ map: t });
  };
  const plain = (c: string) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c) });
  // a short cylinder lying along x — the primitive that does the most work
  // here, because a can, a bottle and a cup are all one
  const lying = (r1: number, r2: number, len: number, side: THREE.Material, cap: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, 10), [side, cap, cap]);
    m.rotation.z = Math.PI / 2;
    return m;
  };
  // Everything ever drawn for this, in the order it was drawn. What actually
  // goes on the ground is chosen by name in RIG below, so a candidate can be
  // shelved or revived without moving any code.
  const CATALOGUE: [string, () => THREE.Object3D][] = [
    ['crushed can', () => {
      const g0 = new THREE.Group();
      const can = lying(0.075, 0.075, 0.30,
        tsurf(24, 24, (g) => {
          g.fillStyle = '#b9bcc2'; g.fillRect(0, 0, 24, 24);
          g.fillStyle = '#c0392b'; g.fillRect(0, 9, 24, 7);            // the band that says CAN
          g.fillStyle = '#8e9298'; g.fillRect(0, 5, 24, 1); g.fillRect(0, 18, 24, 1);
          g.fillStyle = '#6f7378'; g.fillRect(7, 0, 1, 24); g.fillRect(16, 0, 1, 24);  // crush creases
        }), plain('#8e9298'));
      can.scale.y = 0.62;                                    // crushed, not round
      can.position.y = 0.075 * 0.62; g0.add(can); return g0; }],
    ['glass bottle', () => {
      const g0 = new THREE.Group();
      const side = tsurf(24, 24, (g) => {
        g.fillStyle = '#3f6b4a'; g.fillRect(0, 0, 24, 24);
        g.fillStyle = '#5d8f68'; g.fillRect(0, 2, 24, 3);              // highlight along the length
        g.fillStyle = '#e6e0cc'; g.fillRect(0, 10, 24, 8);             // the label
        g.fillStyle = '#8a3a2e'; g.fillRect(0, 13, 24, 2);
      });
      const body = lying(0.062, 0.062, 0.30, side, plain('#345c40'));
      body.position.set(0, 0.062, 0); g0.add(body);
      const neck = lying(0.032, 0.05, 0.13, plain('#3f6b4a'), plain('#2b4a34'));
      neck.position.set(0.21, 0.062, 0); g0.add(neck);
      return g0; }],
    ['coffee cup', () => {
      const g0 = new THREE.Group();
      const cup = lying(0.078, 0.055, 0.26,
        tsurf(24, 24, (g) => {
          g.fillStyle = '#e4e0d4'; g.fillRect(0, 0, 24, 24);
          g.fillStyle = '#b8b2a4'; g.fillRect(0, 0, 24, 2);
          g.fillStyle = '#8a3a2e'; g.fillRect(0, 11, 24, 5);           // a printed band
        }), plain('#cfc9ba'));
      cup.position.set(0, 0.072, 0); g0.add(cup);
      const lid = lying(0.084, 0.084, 0.035, plain('#3a2f28'), plain('#2b241f'));
      lid.position.set(-0.145, 0.078, 0); g0.add(lid);                 // dark lid, unmistakable
      // TRUE SCALE, at the desk's own correction. It had said "draw them
      // oversized, the cat is not to scale either", which was right when nothing
      // on the ground read at all, and it has overshot: drawn full size this cup
      // measures 0.29 m end to end against a 1 m paving slab, and the user is
      // looking at the joints as a ruler. A 16 oz coffee cup is about 0.15 m.
      // 0.58 puts it there. Everything inside the group — the lid offset, the
      // shadow, the seating height drop() measures off the geometry — scales
      // with it, which is why this is one number and not five.
      g0.scale.setScalar(0.58);
      return g0; }],
    ['takeout container', () => {
      const g0 = new THREE.Group();
      const sideM = tsurf(24, 16, (g) => {
        g.fillStyle = '#e8e6de'; g.fillRect(0, 0, 24, 16);
        g.fillStyle = '#9c988c'; g.fillRect(0, 6, 24, 2);              // the lid seam
        g.fillStyle = '#c8c4b8'; g.fillRect(0, 14, 24, 2);
      });
      const box2 = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.115, 0.24),
        [sideM, sideM, tsurf(16, 16, (g) => {
          g.fillStyle = '#f0eee6'; g.fillRect(0, 0, 16, 16);
          g.fillStyle = '#b5b2a6'; g.fillRect(0, 7, 16, 1); g.fillRect(7, 0, 1, 16);
        }), plain('#a8a498'), sideM, sideM]);
      box2.position.y = 0.0575; box2.rotation.y = 0.22; g0.add(box2); return g0; }],
    // PICKED (5), then reworked on the note "newspaper needs to be grimier and
    // thinner". Thinner is geometry: it was a 5.5 cm slab, which is a phone
    // book, not a paper. A folded broadsheet lying on the ground is about two
    // centimetres, so 0.024 — and once it is that thin the silhouette has to
    // come from somewhere else, hence the half-open leaf lifted off the top.
    // Grimier is surface: it was near-white, which reads as dropped one second
    // ago on a street where nothing else is clean.
    ['folded newspaper', () => {
      const g0 = new THREE.Group();
      // only two or three texels tall at this thickness, so the page edge is
      // two stripes and no more — anything finer is mush at 2 cm
      const edge = tsurf(24, 4, (g) => {
        g.fillStyle = '#8f887a'; g.fillRect(0, 0, 24, 4);
        g.fillStyle = '#6e685d'; g.fillRect(0, 2, 24, 1);
      });
      const face = tsurf(32, 24, (g) => {
        g.fillStyle = '#9d9483'; g.fillRect(0, 0, 32, 24);             // newsprint, weathered grey-brown
        // ink bled by the rain: the masthead first, then a soft halo under it
        g.fillStyle = '#3a352d'; g.fillRect(3, 2, 26, 4);
        g.fillStyle = 'rgba(58,53,45,0.42)'; g.fillRect(2, 6, 28, 2);
        // columns, broken up where the paper has soaked through
        for (let y = 10; y < 22; y += 2) {
          g.fillStyle = '#6a6459';
          g.fillRect(4, y, 11, 1);
          if (y !== 16) g.fillRect(18, y, 10, 1);
        }
        // the fold — the darkest line on it, because that is where the dirt
        // and the wear both go
        g.fillStyle = '#544e44'; g.fillRect(0, 12, 32, 1);
        g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, 13, 32, 1);
        // one corner has been sitting in water: darker, and the ink there is
        // gone rather than sharp
        g.fillStyle = 'rgba(52,46,38,0.55)'; g.fillRect(0, 17, 11, 7);
        g.fillStyle = 'rgba(38,34,28,0.45)'; g.fillRect(0, 20, 7, 4);
        // and somebody has stepped on it
        g.fillStyle = 'rgba(30,27,23,0.40)';
        for (let k = 0; k < 4; k++) g.fillRect(19 + k * 3, 3 + k, 2, 9);
        dither(g, 32, 24, 40);
      });
      const np = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.024, 0.30),
        [edge, edge, face, plain('#7d7668'), edge, edge]);
      np.position.y = 0.012; g0.add(np);
      // the top leaf, half lifted off the fold. Two centimetres of paper has
      // no silhouette from standing height; this gives it one, and it is what
      // says FOLDED rather than "flat grey rectangle".
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.010, 0.26),
        [edge, edge, face, plain('#7d7668'), edge, edge]);
      leaf.position.set(-0.05, 0.030, 0.015);
      leaf.rotation.set(0, 0.20, -0.13);
      g0.add(leaf);
      g0.rotation.y = -0.15; return g0; }],
    ['chip bag', () => {
      const g0 = new THREE.Group();
      const sideM = tsurf(24, 14, (g) => {
        g.fillStyle = '#31435e'; g.fillRect(0, 0, 24, 14);
        g.fillStyle = '#e0a92e'; g.fillRect(3, 3, 12, 8);              // the loud block
        g.fillStyle = '#c8443a'; g.fillRect(17, 4, 5, 6);
        g.fillStyle = '#6d7f96'; g.fillRect(0, 0, 24, 1);              // foil glint
      });
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.10, 0.21),
        [sideM, sideM, sideM, plain('#26344a'), sideM, sideM]);
      bag.position.y = 0.05; bag.rotation.y = 0.4; g0.add(bag);
      const crum = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.15), plain('#3c5070'));
      crum.position.set(0.14, 0.075, 0.03); crum.rotation.y = -0.3; g0.add(crum);
      return g0; }],
    ['cigarette pack', () => {
      const g0 = new THREE.Group();
      const sideM = tsurf(16, 14, (g) => {
        g.fillStyle = '#e6e2d8'; g.fillRect(0, 0, 16, 14);
        g.fillStyle = '#b8322c'; g.fillRect(0, 0, 16, 5);              // red top
        g.fillStyle = '#9a968c'; g.fillRect(0, 9, 16, 1);
      });
      const pk = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.10, 0.13),
        [sideM, sideM, sideM, plain('#c6c2b6'), sideM, sideM]);
      pk.position.y = 0.05; pk.rotation.y = -0.5; g0.add(pk); return g0; }],

    // ── ROUND THREE ──────────────────────────────────────────────────────
    // The selection rule comes straight out of round two's result rather than
    // out of taste. Two of seven passed — the coffee cup and a large flat
    // rectangle with a fold — and what they share is a strong, simple
    // SILHOUETTE at size. Everything that failed was small, soft-edged, or
    // both. So every candidate here is large and has an outline you would
    // recognise as a black shape with the texture switched off, and each one
    // carries a single feature no other candidate has: handles, a bail, a
    // straw, corrugated flutes, a bottle neck out of a bag.
    ['pizza box', () => {
      const g0 = new THREE.Group();
      const top = tsurf(24, 24, (g) => {
        g.fillStyle = '#c9b493'; g.fillRect(0, 0, 24, 24);              // kraft board
        g.fillStyle = '#a8322c'; g.fillRect(3, 8, 18, 6);               // the logo band
        g.fillStyle = '#e2d8c2'; g.fillRect(5, 10, 14, 2);
        g.fillStyle = 'rgba(92,70,40,0.45)'; g.fillRect(2, 16, 11, 6);  // grease through the board
        dither(g, 24, 24, 30);
      });
      const sideM = tsurf(24, 6, (g) => {
        g.fillStyle = '#bda98a'; g.fillRect(0, 0, 24, 6);
        g.fillStyle = '#8e7c62'; g.fillRect(0, 3, 24, 1);
      });
      const faces = [sideM, sideM, top, plain('#9c8a6d'), sideM, sideM];
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.05, 0.52), faces);
      base.position.y = 0.025; g0.add(base);
      // the lid, hinged open. A closed pizza box is a flat brown square and so
      // is flattened cardboard; the propped lid is what separates them.
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.03, 0.52), faces);
      lid.geometry.translate(0, 0, -0.26);              // pivot on the hinge edge
      lid.position.set(0, 0.055, 0.26); lid.rotation.x = -0.62;
      g0.add(lid);
      g0.rotation.y = 0.28; return g0; }],
    ['flattened cardboard', () => {
      const g0 = new THREE.Group();
      const face = tsurf(24, 16, (g) => {
        g.fillStyle = '#b09272'; g.fillRect(0, 0, 24, 16);
        g.fillStyle = '#8d7358'; g.fillRect(0, 7, 24, 1);               // the score it folds on
        g.fillStyle = 'rgba(60,45,30,0.40)'; g.fillRect(14, 9, 8, 5);   // damp
        g.fillStyle = '#7a6248'; g.fillRect(4, 2, 9, 1); g.fillRect(4, 4, 6, 1);
        dither(g, 24, 16, 26);
      });
      // the flutes on the cut edge are the whole identification — it is the
      // one thing that says CARDBOARD and not "a brown rectangle"
      const corr = tsurf(24, 4, (g) => {
        g.fillStyle = '#c4a988'; g.fillRect(0, 0, 24, 4);
        for (let x = 0; x < 24; x += 2) { g.fillStyle = '#8b7357'; g.fillRect(x, 1, 1, 3); }
      });
      const faces = [corr, corr, face, plain('#8d7358'), corr, corr];
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.020, 0.46), faces);
      sh.position.y = 0.010; g0.add(sh);
      const sh2 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.018, 0.36), faces);
      sh2.position.set(0.14, 0.031, -0.09); sh2.rotation.set(0, 0.52, -0.10);
      g0.add(sh2);                                     // a second piece riding up on the first
      g0.rotation.y = -0.22; return g0; }],
    ['plastic bag', () => {
      const g0 = new THREE.Group();
      const skin = tsurf(20, 16, (g) => {
        g.fillStyle = '#e8ecef'; g.fillRect(0, 0, 20, 16);
        g.fillStyle = '#cdd4d9'; g.fillRect(0, 4, 20, 2); g.fillRect(0, 11, 20, 1);
        g.fillStyle = '#c0392b'; g.fillRect(4, 6, 5, 4);                // printed marks
        g.fillStyle = '#2f5fa8'; g.fillRect(12, 7, 4, 3);
      });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.21, 0.26), skin);
      body.position.y = 0.105; body.rotation.y = 0.30; g0.add(body);
      const lump = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.13, 0.18), skin);
      lump.position.set(-0.18, 0.065, 0.05); lump.rotation.y = -0.42; g0.add(lump);
      // the handles are the point. A white lump on the floor is nothing; two
      // loops standing off the top of it is a shopping bag from thirty metres.
      const hm = plain('#dfe4e8');
      for (const s3 of [-1, 1]) {
        const arc = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.013, 4, 9, Math.PI), hm);
        arc.position.set(s3 * 0.075, 0.205, 0.02);
        arc.rotation.y = 0.30;
        g0.add(arc);
      }
      return g0; }],
    ['40oz in a bag', () => {
      const g0 = new THREE.Group();
      const bagM = tsurf(24, 24, (g) => {
        g.fillStyle = '#a8865c'; g.fillRect(0, 0, 24, 24);
        for (let x = 2; x < 24; x += 6) { g.fillStyle = '#93764f'; g.fillRect(x, 0, 1, 24); }
        g.fillStyle = '#8d6f49'; g.fillRect(0, 5, 24, 1); g.fillRect(0, 14, 24, 1);
        dither(g, 24, 24, 28);
      });
      const sleeve = lying(0.088, 0.088, 0.34, bagM, plain('#8d6f49'));
      sleeve.position.y = 0.088; g0.add(sleeve);
      const flare = lying(0.105, 0.090, 0.05, bagM, plain('#8d6f49'));
      flare.position.set(0.175, 0.088, 0); g0.add(flare);               // torn top of the sleeve
      // the green neck out of the brown paper is the joke and the read
      const neck = lying(0.044, 0.064, 0.15, plain('#3f6b4a'), plain('#2b4a34'));
      neck.position.set(0.265, 0.088, 0); g0.add(neck);
      const cap = lying(0.046, 0.046, 0.03, plain('#c9a227'), plain('#b08e1c'));
      cap.position.set(0.350, 0.088, 0); g0.add(cap);
      g0.rotation.y = 0.55; return g0; }],
    ['milk crate', () => {
      const g0 = new THREE.Group();
      const wallM = tsurf(20, 12, (g) => {
        g.fillStyle = '#2f5fa8'; g.fillRect(0, 0, 20, 12);
        g.fillStyle = 'rgba(0,0,0,0.50)';
        for (let x = 2; x < 19; x += 4) g.fillRect(x, 3, 2, 7);         // the lattice
        g.fillStyle = '#4a7cc4'; g.fillRect(0, 0, 20, 2);               // top rail
      });
      // built as four walls round an open floor, because the OPEN TOP is the
      // silhouette that says crate and a solid box would just be a box
      const S = 0.36, H = 0.25, T = 0.030;
      const wall = (w: number, d: number, x: number, z: number) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wallM);
        m.position.set(x, H / 2, z); return m;
      };
      g0.add(wall(S, T, 0, S / 2 - T / 2), wall(S, T, 0, -S / 2 + T / 2),
             wall(T, S, S / 2 - T / 2, 0), wall(T, S, -S / 2 + T / 2, 0));
      const flr = new THREE.Mesh(new THREE.BoxGeometry(S, 0.022, S), plain('#254980'));
      flr.position.y = 0.011; g0.add(flr);
      g0.rotation.y = 0.34; return g0; }],
    ['broken umbrella', () => {
      const g0 = new THREE.Group();
      const canopyM = tsurf(24, 12, (g) => {
        g.fillStyle = '#23262e'; g.fillRect(0, 0, 24, 12);
        g.fillStyle = '#31353f'; g.fillRect(0, 3, 24, 1);
        for (let x = 3; x < 24; x += 6) { g.fillStyle = '#171920'; g.fillRect(x, 0, 1, 12); }
      });
      // a half-collapsed canopy: a low-sided cone laid over and squashed
      const cap2 = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.36, 7), canopyM);
      cap2.rotation.z = Math.PI / 2;
      cap2.scale.z = 0.62;                                              // flattened, not a party hat
      cap2.position.set(-0.14, 0.12, 0);
      g0.add(cap2);
      const shaft = lying(0.015, 0.015, 0.46, plain('#3a3d45'), plain('#2b2e35'));
      shaft.position.set(0.28, 0.048, 0.02); g0.add(shaft);
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.015, 4, 9, Math.PI * 1.25), plain('#5a4632'));
      hook.position.set(0.52, 0.05, 0.02); hook.rotation.x = -Math.PI / 2;
      g0.add(hook);                                                     // the crook handle, flat on the floor
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.011, 0.011), plain('#4a4e57'));
      rib.position.set(-0.20, 0.10, 0.14); rib.rotation.set(0, 0.55, 0.32);
      g0.add(rib);                                                      // one rib sprung out — this is why it is in the bin
      g0.rotation.y = -0.35; return g0; }],
    ['swollen phone book', () => {
      const g0 = new THREE.Group();
      const pages = tsurf(24, 12, (g) => {
        g.fillStyle = '#d8c46a'; g.fillRect(0, 0, 24, 12);              // the yellow block, which IS the identification
        for (let y = 0; y < 12; y += 2) { g.fillStyle = '#b8a352'; g.fillRect(0, y, 24, 1); }
        g.fillStyle = 'rgba(70,58,30,0.50)'; g.fillRect(0, 8, 24, 4);   // wicked up from the bottom
      });
      const cov = tsurf(24, 20, (g) => {
        g.fillStyle = '#8d3a34'; g.fillRect(0, 0, 24, 20);
        g.fillStyle = '#c9b98a'; g.fillRect(3, 3, 18, 5);
        g.fillStyle = '#5e2823'; g.fillRect(0, 15, 24, 5);              // the water line
        dither(g, 24, 20, 34);
      });
      const faces = [pages, pages, cov, plain('#6d2c27'), pages, pages];
      const bk = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.13, 0.44), faces);
      bk.position.y = 0.065; g0.add(bk);
      // swollen: a second block riding on top and tilted, so the top face is
      // bowed rather than flat — a flat-topped block reads as a brick
      const bow = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.06, 0.38), faces);
      bow.position.set(0.01, 0.155, 0); bow.rotation.set(0.07, 0, 0.06); g0.add(bow);
      g0.rotation.y = -0.30; return g0; }],
    ['bundled newspapers', () => {
      const g0 = new THREE.Group();
      const stackM = tsurf(24, 16, (g) => {
        g.fillStyle = '#a49b88'; g.fillRect(0, 0, 24, 16);
        for (let y = 1; y < 16; y += 2) { g.fillStyle = '#847c6c'; g.fillRect(0, y, 24, 1); }
        g.fillStyle = 'rgba(40,36,30,0.35)'; g.fillRect(0, 12, 24, 4);
      });
      const topM = tsurf(24, 18, (g) => {
        g.fillStyle = '#9d9483'; g.fillRect(0, 0, 24, 18);
        g.fillStyle = '#3a352d'; g.fillRect(3, 2, 18, 4);
        for (let y = 9; y < 17; y += 2) { g.fillStyle = '#6a6459'; g.fillRect(4, y, 16, 1); }
      });
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.20, 0.32),
        [stackM, stackM, topM, plain('#7d7668'), stackM, stackM]);
      st.position.y = 0.10; g0.add(st);
      // the string is what makes this a BUNDLE rather than a heap, and it is
      // the only difference between this and candidate 2 at a glance
      const str = plain('#d9d2bd');
      for (const cz of [-0.09, 0.09]) {
        const over = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.013, 0.015), str);
        over.position.set(0, 0.206, cz); g0.add(over);
        for (const sx of [-1, 1]) {
          const down = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.21, 0.015), str);
          down.position.set(sx * 0.215, 0.10, cz); g0.add(down);
        }
      }
      g0.rotation.y = 0.24; return g0; }],
    // Both cups ship, so they have to be told apart at a glance or they are
    // one object drawn twice rather than two of five types. The coffee cup is
    // NOT touched — it has passed twice and changing it to make room for this
    // one would be spending approval I already have. The separation is pushed
    // entirely into the fountain cup, on four axes at once:
    //   length   0.42 against the coffee cup's 0.26 — nearly double, and the
    //            single strongest cue at distance
    //   taper    0.112 down to 0.060, a soda cup's real profile; the coffee
    //            cup barely tapers at all
    //   colour   a RED body with white waves against a cream body. At twenty
    //            metres this is "the red one" and "the pale one"
    //   parts    a white lid and a straw; the coffee cup has a dark lid and
    //            nothing else
    ['fountain cup', () => {
      const g0 = new THREE.Group();
      const cupM = tsurf(24, 24, (g) => {
        g.fillStyle = '#c0392b'; g.fillRect(0, 0, 24, 24);              // red field, not a band
        g.fillStyle = '#f0ece0'; g.fillRect(0, 6, 24, 5);               // the white wave
        g.fillStyle = '#f0ece0'; g.fillRect(0, 14, 24, 2);
        g.fillStyle = '#e6c84a'; g.fillRect(0, 17, 24, 2);
        g.fillStyle = '#9c2f24'; g.fillRect(0, 22, 24, 2);              // shaded toward the base
        g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, 12, 24, 1);     // one wax crease
      });
      const cup2 = lying(0.112, 0.060, 0.42, cupM, plain('#a83226'));
      cup2.position.y = 0.104; g0.add(cup2);
      const lid2 = lying(0.120, 0.120, 0.036, plain('#e2ddd0'), plain('#cbc5b6'));
      lid2.position.set(-0.228, 0.110, 0); g0.add(lid2);
      // The straw lies OFF the ground at one end. Flat on the floor it was
      // invisible at walking distance — a 2 cm stick on grey concrete is
      // nothing — and the straw is the one part of this the coffee cup can
      // never have, so it has to be in the silhouette rather than in the
      // texture. Tilted up, it breaks the cup's outline against the sky-lit
      // ground and reads from ten metres.
      const straw = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.022, 0.022), plain('#e04a3d'));
      straw.position.set(-0.40, 0.058, 0.08);
      straw.rotation.set(0, 0.58, 0.26);
      g0.add(straw);
      // Same correction as the coffee cup. This one was the worse of the two:
      // 0.42 m of body and a 0.36 m straw, against a real large fountain drink
      // at about 0.20 m. The straw is what carries it at distance, so it is
      // scaled with the cup rather than left long — a life-size cup wearing an
      // oversized straw would read as a mistake rather than as a cup.
      g0.scale.setScalar(0.55);
      g0.rotation.y = -0.42; return g0; }],
    ['paint can', () => {
      const g0 = new THREE.Group();
      const canM = tsurf(24, 20, (g) => {
        g.fillStyle = '#9aa0a6'; g.fillRect(0, 0, 24, 20);
        g.fillStyle = '#7d8288'; g.fillRect(0, 0, 24, 2); g.fillRect(0, 17, 24, 3);  // rolled rim, base
        g.fillStyle = '#c9c3b2'; g.fillRect(3, 5, 18, 9);               // label
        g.fillStyle = '#2f5fa8'; g.fillRect(5, 7, 14, 3);
        g.fillStyle = 'rgba(47,95,168,0.75)'; g.fillRect(1, 13, 8, 7);  // a run of paint down the side
        dither(g, 24, 20, 30);
      });
      const can2 = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.25, 12),
        [canM, plain('#8b9096'), plain('#7d8288')]);
      can2.position.y = 0.125; g0.add(can2);
      // the bail handle — an upright cylinder is a tin; an upright cylinder
      // with a wire hoop over it is a paint can
      const bail = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.009, 4, 10, Math.PI), plain('#6e737a'));
      bail.position.set(0, 0.25, 0); bail.rotation.y = 0.42; g0.add(bail);
      // the lid levered off and dropped beside it, paint side up
      const lid3 = new THREE.Mesh(new THREE.CylinderGeometry(0.120, 0.120, 0.016, 12),
        [plain('#8b9096'), plain('#2f5fa8'), plain('#8b9096')]);
      lid3.position.set(0.23, 0.008, 0.10); g0.add(lid3);
      return g0; }],
  ];
  // The rig line, in the order the user sees it. 1 and 2 are the two that
  // already passed and they lead so every new candidate is judged against a
  // bar that has cleared, not against its neighbours. Anything in CATALOGUE
  // and not named here is drawn but unplaced — see the shelf note below.
  // THE RIG IS DOWN. Round three's verdict: 2 folded newspaper, 4 flattened
  // cardboard, 7 milk crate, 11 fountain cup, plus 1 the coffee cup, which
  // passed in round two and was never retracted — "i like having both cups".
  // Five types. The numbered line, the numerals and the two alley rows are
  // gone; they are in git history if a fourth round ever needs them.
  //
  // NOT PLACED, still drawn, in CATALOGUE above: crushed can, glass bottle,
  // takeout container, chip bag, cigarette pack, pizza box, plastic bag,
  // 40oz in a bag, broken umbrella, swollen phone book, bundled newspapers,
  // paint can. Reviving any of them is one line in DROPS.
  //
  // There is deliberately NO per-instance grime here. The theory was that
  // grime variation is what carried the two gutter decals the user liked; it
  // was not — those are hand-drawn variants picked by index, and the desk
  // withdrew the guess. Building the mechanism now would be inventing it to
  // fit a theory nobody holds. Rotation is the only thing that varies, and
  // five distinct objects is the actual vocabulary.
  // NO CONTACT SHADOWS. Each dropped piece used to carry a child quad of
  // `shadeT` — soft black, 0.92 of the piece's own footprint — printed on the
  // ground under it. Twelve of them, plus the bench's, all deleted.
  //
  // NOTHING IN THIS WORLD CASTS A SHADOW: no building, no lamp column, no car,
  // no citizen. Thirteen decals were the only exception, so instead of seating
  // the litter they read as unexplained dark marks on the road and in the
  // alley — the eye hunts for a caster, finds none, and files it as a defect.
  // Erick has now asked three times in one session for dark ground shapes to
  // go, one of them by name: "remove the shadow texture". They go.
  //
  // What actually seats a piece is `drop()` below putting its measured bottom
  // exactly on the ground, which it still does.
  const ALLEY_Y = 0.006;                  // ct/street.ts lays the alley slab at 0.005
  const drop = (name: string, x: number, z: number, yaw: number, y?: number) => {
    const make = CATALOGUE.find((c) => c[0] === name)?.[1];
    if (!make) return;
    const o = make();
    // MEASURE, do not declare. Every number about a piece's size and seating is
    // taken from its own geometry now, because every one of them that was
    // hand-written turned out to be wrong: the base heights had the cups 6 and
    // 8 mm underground, and the half-extent guess missed that the fountain
    // cup's straw reaches 58 cm on one side and 21 on the other.
    //
    // ORDER, now that the contact shadow is gone. That shadow used to be
    // attached as a child BEFORE this box was taken, so the box covered the
    // piece AND its smudge. Two things followed, and only one of them mattered:
    //
    //   · HEIGHT — unaffected, provably. The shadow sat at `bbL.min.y + 0.003`,
    //     i.e. ABOVE the piece's own lowest point, so it never contributed to
    //     `bb.min.y` and the seating line `gy - bb.min.y` is bit-for-bit what it
    //     was. Nothing sinks and nothing floats. That was the risk worth
    //     checking before touching this, and it is not a risk.
    //   · HALF-EXTENT — the shadow was a rectangle at 0.92 of the piece's LOCAL
    //     footprint, and a rectangle turned 86 degrees has corners that reach
    //     past the world box of the thin cylinder it covers. So it could only
    //     ever make `hx` LARGER. Dropping it makes `hx` the piece's true
    //     half-extent, which is the number `clearOfKerb` and the building-line
    //     clamp actually want. Where the clamp is binding — the gutter drops,
    //     laid hard against the kerb — a piece now sits a centimetre or two
    //     nearer the kerb, which is nearer to where it was authored. Padding
    //     the clearance for a phantom would be keeping a fudge for a thing that
    //     no longer exists.
    //
    // So: turn the piece, then measure the piece. One box, no children.
    // every candidate carries its own built-in skew; this turns the whole
    // piece on top of it, so no two placements of one object are copies
    o.rotation.y += yaw;
    o.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(o);   // still at the origin, so this is the half-extent
    const hx = Math.max(-bb.min.x, bb.max.x);
    // the alley has no kerb and its own walls; the street has both a kerb and
    // a building line, and growing through a wall is the same bug as growing
    // through a kerb
    let cx = y === undefined ? clearOfKerb(x, hx) : x;
    if (y === undefined) cx = Math.min(FACE - hx - 0.02, Math.max(-FACE + hx + 0.02, cx));
    const gy = y ?? groundUnder(cx, hx);
    o.position.set(cx, gy - bb.min.y, z);
    // tagged so scripts/trash.mjs can find MY litter and not every group in
    // the scene — the side street and the car lot have their own props sitting
    // at ground level and they are not mine to measure
    o.userData.litter = name;
    o.userData.groundY = gy;
    o.userData.halfX = hx;
    // WHERE THIS PIECE WAS ASKED FOR, AND WHERE THIS FUNCTION PUT IT — recorded
    // for item 225, which is the guard over item 219.
    //
    // A prop's final position is set in TWO places and they answer different
    // questions. `authored*` is the literal argument at the call site below.
    // `placed*` is where this function leaves it, after `clearOfKerb` and the
    // building-line clamp above have had their deterministic say. Anything
    // further is `dimWorld`'s push-out pass (:1240), which runs much later, and
    // THAT is the stage that shoved three crates out of their own side panels.
    //
    // Published rather than re-derived by the check, because the alternative is
    // fourteen hand-typed coordinate pairs in a harness — BUILDER-BRIEF §8's
    // "a second hand-typed copy of a number is the single most expensive habit
    // in this codebase", and a copy that would silently stop matching the day
    // somebody nudges a piece. Two numbers per group, on a group that already
    // carries four other fields, and nothing reads them at runtime.
    o.userData.authoredX = x;
    o.userData.authoredZ = z;
    o.userData.placedX = cx;
    o.userData.placedZ = z;
    // whether groundY came from surfaceY (street) or was handed in (the alley
    // slab). Only a street piece may have its height re-resolved if something
    // later nudges it — surfaceY would put an alley piece 13 cm in the air.
    o.userData.onStreet = y === undefined;
    scene.add(o);
    lit(o);                               // they take the lamplight like anything else
  };

  // Where rubbish actually ends up: against the kerb where the water leaves it,
  // in the alley by the bins, blown up against the building line, and under the
  // one bench on the block. Nothing is solid — you walk straight over litter —
  // so the big pieces are kept off the walking line by placement rather than by
  // a collider, which is the only way to add them without touching the 2 m lane.
  // Hand-placed, no rnd(), so the seeded stream is untouched (GOTCHAS §2).
  const GUT_L = -(ROAD_HALF - 0.14), GUT_R = ROAD_HALF - 0.14;
  // The gutter line, and every piece here lies ALONG the kerb rather than
  // across it. That is what actually happens — a cup rolls until the kerb
  // stops it — and it is also what lets them sit hard against the kerb at all:
  // the fountain cup measures 1.16 m across its worst diagonal once the straw
  // is counted, so laid across the pan it can only ever be centred out on the
  // asphalt. Turned along the kerb its half-extent is 12 cm and it fits in a
  // 45 cm pan with room to spare. Each yaw is offset a little from square so
  // they are not parallel copies.
  // CUPS ARE THE RAREST OF THE FIVE NOW, not the commonest. They were 5 of the
  // 14 pieces on the ground and the user caught two of them in one frame — the
  // gutter cup at z -33.9 and the bench cup at -35.30 are 1.4 m apart, which is
  // exactly the pairing they described. One coffee cup and one fountain cup
  // survive, 19 m apart and on opposite sides of the street; the rest of these
  // slots become the types that were under-represented.
  //
  // The count is unchanged at 14 so the litter population stays where it was —
  // scripts/footprint.mjs floors it, and thinning by deletion would have traded
  // one complaint for another.
  drop('folded newspaper', GUT_L, -21.6, -1.62);
  // NOT a milk crate: this file's own note two blocks down says crates live in
  // the alley round the dumpster, "not on a sidewalk", and I had put one in the
  // street gutter reaching for a type that would not pair with anything. Moved
  // to z -46 as well as retyped, which puts 19.5 m between it and the cardboard
  // at -26.5 and 30 m to the one at -76.
  drop('flattened cardboard', GUT_R + 0.04, -46.0, 1.49);
  drop('fountain cup', GUT_R + 0.02, -54.3, 1.92);
  drop('folded newspaper', GUT_L + 0.04, -68.4, 1.80);
  // the alley, round the dumpster — crates live here, not on a sidewalk
  //
  // ⚠ THESE TWO x VALUES ARE STATED, NOT ROUNDED, AND THEY ARE NOT FREE TO
  // TIDY. They were -12.20 and -11.55 until the self-push bug at :1268 was
  // fixed, and the bug shoved both of them +0.56 m and +0.53 m east — so what
  // has actually been standing in the alley for weeks, and what the user has
  // seen and signed off on, is -11.639 and -11.016.
  //
  // `ct/cat.ts:239-300` settled that alley frame over SEVEN iterations against
  // his own screenshots and names *"both crates"* among the things that must
  // read from the alley mouth. Fixing the push without this would have silently
  // slid an approved composition half a metre, which is a regression dressed as
  // a correction. The desk's ruling on item 219 was explicit: fix the bug, then
  // place these two deliberately.
  //
  // So the composition is now IN THE CODE rather than an accident of a defect —
  // which is the point. If somebody wants them at round numbers, that is a
  // conversation with the user about the picture, not a clean-up.
  drop('milk crate', -11.639, -39.60, 0.35, ALLEY_Y);
  drop('milk crate', -11.016, -40.35, -0.80, ALLEY_Y);
  drop('flattened cardboard', -10.60, -41.45, 0.90, ALLEY_Y);
  drop('flattened cardboard', -9.40, -42.40, -1.06, ALLEY_Y);   // was the second fountain cup
  drop('folded newspaper', -12.60, -42.05, 0.40, ALLEY_Y);
  // (the third crate is placed below, in the slot it has always occupied)
  // blown up against the building line, clear of the tree pits (x ±5.0…5.8)
  drop('flattened cardboard', 6.58, -26.5, -0.35);
  // THE THIRD CRATE, MOVED OFF THE THRIFT FRONTAGE AND INTO THE ALLEY.
  //
  // THE `drop` CALL STAYS IN THIS SLOT ON PURPOSE — only its arguments moved.
  // Every maker in CATALOGUE builds a different number of objects, and three's
  // generateUUID() draws from the same seeded Math.random the dithering uses
  // (GOTCHAS 75), so re-ordering two drops re-rolls every dithered texture
  // painted after them. Read that as: this is a coordinate change and nothing
  // else, and `places` should differ by exactly one entry.
  //
  // *"get rid of the trash crate in front of the thrift store. or move it
  // somewhere else"* (2026-08-02). He offered both; this MOVES it, because
  // deleting is the one thing the note eighteen lines up rules out — the
  // population is floored by scripts/footprint.mjs and *"thinning by deletion
  // would have traded one complaint for another"*. So it goes where this file
  // already says crates go, three lines up: the alley, round the dumpster.
  //
  // ROOT CAUSE — AND IT IS NOT THE SHOPFRONT. The dimWorld note at :1245 blames
  // the frontage (*"grows into the stallriser … A has since made those
  // shopfronts project further"*), and that reads plausibly, but it is not what
  // is happening. Measured with scripts/probes/w77-what-pushed-it.mjs, which
  // re-runs that pass's own overlap test with its own filters:
  //
  //   **A MILK CRATE IS PUSHED OUT OF ITS OWN SIDE PANELS.** :1268 skips a
  //   solid with `o.userData?.litter`, but only the litter GROUP carries that
  //   tag — `drop()` sets it at :3519 on `o`, never on the panels inside it. So
  //   the crate's four uprights land in `solidsNear`, the group's box overlaps
  //   them by construction, and the pass shoves the group clear of itself.
  //
  //   It bites the crate and nothing else because of the :1271 height gate,
  //   `h < 0.25` — cardboard and newspapers are flatter than that and their
  //   meshes never enter the set. A crate's panels are 0.25 m exactly.
  //
  //   The evidence is the shift being one crate wide, every time: authored
  //   -12.20 lands at -11.64, -11.55 at -11.02, -6.74 at -6.12. Three crates,
  //   +0.56 / +0.53 / +0.62, against half-extents of 0.30 / 0.28. The two flat
  //   types do not move at all. And the spot this line asks for overlaps
  //   **nothing real** — the probe reports 0 solids there once ancestry is
  //   tested the way scripts/footprint.mjs:113 already tests it.
  //
  //   On the street that push is aimed: `towardRoad` weights a move toward x 0
  //   at 0.45, so a crate against the west frontage is shoved OUT INTO THE WALK
  //   — which put it 1.12 m from the THRIFT door spot. Nobody placed a crate in
  //   his doorway; a repair pass walked it there.
  //
  // NOT FIXED HERE, deliberately, and this is the part to read before
  // "correcting" it: the one-line fix (test the ancestry, not `o.userData`)
  // moves the two ALLEY crates 0.55 m west, back to where they were authored —
  // and those two are landmarks in a frame the user signed off. ct/cat.ts:239
  // records SEVEN placements settled against his own screenshots, listing
  // *"both crates"* among the things that must read from the alley mouth. So
  // the fix regresses an approved composition and the two have to move
  // together. That is a decision, not a tidy-up. Queued for the desk.
  //
  // WHERE IT IS NOW — the LANDED position, not this line's argument. The self
  // -push above moves it +0.42 m east, so it asks for -9.30 and arrives at
  // **(-8.88, -37.54)**, which is where the clearances below were measured and
  // where shots/w77-alley-crate-after.png shows it. Compensating for the push
  // with a magic offset would be a second wrong number, so the request stays
  // honest and the outcome is recorded.
  //
  //   0.90 m  from the dumpster's east face      a crate beside the bin
  //   0.54 m  from the payphone hood's west jamb
  //   0.32 m  off the alley's north wall         it leans on the wall
  //   3.44 m  from the nearest other crate
  //   4.94 m  from the cat
  //
  // AND IT IS BEHIND THE CAT'S CAMERA. The approved frame is taken from
  // (-8.5, -39.5) at yaw -0.785; the bearing from there to this spot is 124°
  // off that axis, so it cannot enter the shot. Checked by LOOKING, not by the
  // trig: shots/w77-cat-frame-before.png and -after.png are the same picture —
  // KOBRA left, SNAK right of the corner, both crates, the grate below centre,
  // the cat on the paper.
  drop('milk crate', -9.30, -37.45, -0.29, ALLEY_Y);
  // cardboard rather than a fourth newspaper: -68.4 is a newspaper 7.6 m up the
  // street and the two would have paired the way the cups did, across the road
  // rather than along it
  drop('flattened cardboard', 6.66, -76.0, 1.10);
  // under the bus bench, which is the one place on this street people sit
  // between the legs, which stand at x 5.13 and 5.52 and z -35.78 and -34.22
  drop('coffee cup', 5.32, -35.30, 0.70);
  drop('folded newspaper', 5.30, -34.80, -0.50);

  // ── the bodega's cut corner: a soldier course along the cant ─────────────
  //
  // The auditor routed this: the walk is scored on a square 1 m grid and the
  // bodega cuts its corner at 45°, so the joints ran into the bay's foot. A cut
  // corner wants its paving cut to match, which in the street means one row of
  // flags laid PARALLEL to the face so the field joints die against a band.
  //
  // BUILT HERE, NOT IN ct/tex-ground.ts, because of build order. `BAY` is
  // published by ct/bodega-corner.ts and is null until the corner exists —
  // buildGround runs at crosstown.ts:66 and buildStreet at :121, so the ground
  // cannot see it. buildProps runs at :225, after both. The helper still lives
  // in tex-ground beside the other paving; only the placement moved.
  //
  // The first version of this hand-typed the cut from two mullions I measured
  // and then walked into the wall to locate — 0.40 m of offset arithmetic and a
  // rotation sign I got backwards, which the auditor caught. None of that is
  // needed now: the bay publishes its own endpoints, centre and normal, so if
  // the corner is ever re-cut the course follows it instead of sitting where
  // the corner used to be.
  if (BAY) {
    const HALF = 0.42 / 2;                       // the course's own half-width
    // stand it clear of the wall along the published face normal
    const cx = BAY.centre.x + BAY.normal.x * HALF;
    const cz = BAY.centre.z + BAY.normal.z * HALF;
    // ALONG-FACE AXIS TAKEN FROM THE PUBLICATION, not derived here. I had this
    // as `atan2(b - a)`, and deriving it is the step that went 90° out: the
    // auditor's words were "the band extends 0.42 m ALONG the face and 2.60 m
    // PERPENDICULAR to it — B's two numbers, swapped".
    //
    // 0b8aad148 publishes `yawAlong` and `tangent` for exactly that reason —
    // "publishing one axis of a pair is half a fact" — so the hand-derivation
    // goes. Nothing about the cut's direction is computed in this file now.
    soldierCourse(scene, cx, cz, BAY.yawAlong, BAY.faceWidth, 0.42, KERB_H,
                  (t) => wet(flat(t)));
  }

  // ── weeds in the kerb seam ──────────────────────────────────────────────
  //
  // C's tuft, placed by me. `ct/weeds.ts` says so itself: "a lot puts them where
  // no car drives, a street puts them in the KERB SEAM, a park puts them at a
  // path edge. This knows how a weed LOOKS, not where one grows." So the look is
  // C's and the placement is a fact about my ground.
  //
  // The user's brief, quoted in E's park note: "absent from the middle of the
  // path where feet keep it clear. That contrast between a worn clean centre and
  // a weedy edge is the whole effect." On a street the worn clean centre is the
  // road and the walk; the weedy edge is the seam where the gutter pan dies into
  // the kerb face, which is where grit collects and nothing sweeps.
  //
  // NOT `rnd()`. GOTCHAS §2: ct/rng.ts is ONE seeded stream and tree heights and
  // pigeon placement draw from it as they are constructed, so taking draws here
  // would move every tree in the world. This uses its own hash of the loop
  // index, which is deterministic, reproducible and touches nothing else.
  const weedRnd = (i: number, salt: number) => {
    let h = Math.imul((i * 2654435761) ^ (salt * 1013904223), 2246822519);
    h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
    return ((h >>> 0) % 10000) / 10000;
  };
  // EACH ONE HAS A REASON. First pass scattered 44 of these every 2.4 m along
  // both kerbs and the user was right about it: "a little too many grasses in
  // the streets. like way too many. should be more rare."
  //
  // A weed on a city street is an EXCEPTION, not a texture. It grows where
  // nothing disturbs it — the joint at the foot of a post that no broom reaches
  // round, the grit collar against a basin casting where the water stands. It
  // does not grow evenly along a pavement people walk down every day, and an
  // even line is what made it read as ground cover instead of neglect.
  //
  // So placement is DERIVED FROM THE THINGS THAT SHELTER IT rather than from a
  // loop counter. `lampHeads` is already built above, so a post cannot move out
  // from under a tuft — and if a lamp is ever removed its weed goes with it.
  // Every one sits in the kerb seam on the ROAD side, clear of the 2 m walk.
  //
  // The lot is C's and the park is E's and both are meant to be weedier than
  // this. Neither is touched here.
  {
    const streetLamps = lampHeads.filter((h) => Math.abs(h.x) < 9)
                                 .sort((p1, p2) => p2.z - p1.z);
    // EVERY THIRD, not every other. The lamps alternate sides down the block, so
    // taking every other one put all four tufts on the west kerb — a pattern
    // again, just a coarser one, and the thing I was trying to avoid. Every
    // third lands on both sides and leaves longer gaps.
    const spots: { z: number; side: number; why: string }[] = streetLamps
      .filter((_, i) => i % 3 === 0)
      .map((h) => ({ z: h.z + 0.22, side: Math.sign(h.x), why: 'lamp foot' }));
    // the two catch basin castings: grit and standing water collect against the
    // frame, and the sweeper cannot get in against it
    spots.push({ z: -92.5 + 0.62, side: 1, why: 'east basin collar' });
    spots.push({ z: -105 - 0.62, side: -1, why: 'west basin collar' });
    let wi = 0;
    for (const sp of spots) {
      wi++;
      if (Math.abs(sp.z - 2.6) < 5.0 && sp.side > 0) continue;   // the lot's drive
      const x = sp.side * (ROAD_HALF - 0.035 - weedRnd(wi, 13) * 0.05);
      scene.add(weedTuft({
        // gutterSurfaceY takes the distance OUT FROM THE KERB LINE, not a
        // coordinate — the pan is cross-sloped, so a tuft 35 mm out sits higher
        // than one 85 mm out and both sit on the concrete rather than in it.
        x, z: sp.z, y: gutterSurfaceY(ROAD_HALF - Math.abs(x)),
        tone: 'dark',
        scale: 0.6 + weedRnd(wi, 17) * 0.25,
        seed: wi * 31,
      }));
    }
  }

  // ── stars, on clear nights only ─────────────────────────────────────────
  //
  // Hard single texels and nothing else. PointsMaterial with sizeAttenuation
  // OFF draws a fixed-size square in SCREEN space, which is exactly a texel —
  // no sprite, no map, no falloff. That matters more here than usual: the one
  // note this world has now given twice is that a smooth glow among hard
  // texels reads as a rendering artefact, and a star drawn with a soft halo
  // would be that same mistake a third time.
  //
  // Two tiers — a scattering of small ones and a handful of larger, whiter
  // ones for the eye to catch. Ninety altogether, which is something you
  // notice when you look up rather than a planetarium. Nothing below about 20
  // degrees of elevation, because that is buildings and fog.
  //
  // The dome rides with the player. At radius 150 inside a 220 m camera a
  // fixed dome would visibly swing over a 96 m street, and stars do not have
  // parallax.
  //
  // Appended at the very END of the module, after every other rnd() draw, so
  // the seeded stream is untouched and no tree or pigeon moves (GOTCHAS §2).
  const STAR_R = 150;
  const starDome = new THREE.Group();
  const starMats: { m: THREE.PointsMaterial; base: number }[] = [];
  const starField = (n: number, size: number, col: number, base: number) => {
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const az = rnd() * Math.PI * 2;
      // uniform over the cap ABOVE 20 degrees. Uniform in the angle instead
      // would crowd them all around the zenith, which is the giveaway that a
      // star field was generated rather than observed.
      const el = Math.asin(0.34 + rnd() * 0.66);
      const cr = Math.cos(el) * STAR_R;
      pos[i * 3] = Math.cos(az) * cr;
      pos[i * 3 + 1] = Math.sin(el) * STAR_R;
      pos[i * 3 + 2] = Math.sin(az) * cr;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ size, sizeAttenuation: false, color: col,
      transparent: true, opacity: 0, depthWrite: false, fog: false });
    starDome.add(new THREE.Points(g, m));
    starMats.push({ m, base });
  };
  starField(77, 2, 0xbcc6d6, 0.72);     // the scattering
  starField(13, 3, 0xffffff, 1.0);      // the handful that carry
  starDome.visible = false;
  scene.add(starDome);

  for (let i = mark; i < scene.children.length; i++) {
    scene.children[i].traverse((n) => { n.userData.mod = 'props'; });
  }

  // ── the pawn alley's ground ─────────────────────────────────────────────
  //
  // The slot is cut in ct/street.ts, which is D's, and D left the floor a flat
  // placeholder saying in as many words that the ground is mine. The dressing
  // is `alley2Ground` in ct/tex-ground.ts; the CALL is here because of when
  // things build: tex-ground builds at crosstown.ts:66 before any building
  // exists, ct/street.ts cuts the alley during buildWorld at 241, and this file
  // builds at 243. Laying it from the ground module found no alley and silently
  // laid nothing.
  //
  // THE RECTANGLE IS READ FROM D'S OWN WALLS, never copied. `alley2 = 'flank'`
  // is stamped on both flanks and `'end'` on the back wall, so the slot reports
  // its own extent and cannot drift out of sync with the module that cuts it.
  // If those stamps ever go, this lays nothing rather than laying a floor
  // somewhere wrong, and scripts/alley2.mjs says so out loud.
  {
    let fz0 = Infinity, fz1 = -Infinity, endX: number | null = null;
    scene.traverse((o) => {
      const tag = (o as THREE.Mesh).userData?.alley2;
      if (!tag) return;
      const p2 = new THREE.Vector3(); o.getWorldPosition(p2);
      if (tag === 'flank') { fz0 = Math.min(fz0, p2.z); fz1 = Math.max(fz1, p2.z); }
      if (tag === 'end') endX = p2.x;
    });
    if (isFinite(fz0) && isFinite(fz1) && endX !== null && fz1 > fz0) {
      const ex: number = endX;
      // ── FLUSH WITH THE PAVEMENT ─────────────────────────────────────────
      //
      // *"make the long alley flush with the sidewalk"* (2026-08-04). This was
      // 0.009 — a few mm over ct/street.ts's 0.005 placeholder so the two could
      // not z-fight — which is road level, 13 cm below the walk that opens onto
      // it. `ALLEY2_SLAB_Y` is KERB_H, so the slab and the paving are now one
      // surface and there is no step at the mouth. The placeholder is 13 cm
      // BELOW this now rather than 4 mm, so the z-fight it was dodging cannot
      // happen either way.
      //
      // Everything alley2Ground lays — channel, gully, both vents — is placed
      // relative to this `y`, so they come up with it and stay flush in it.
      alley2Ground(scene, FACE, ex, fz0, fz1, ALLEY2_SLAB_Y, (t) => wet(flat(t)), wet);
      // ── AND THE PLAYER WALKS ON WHAT THEY SEE ───────────────────────────
      //
      // Raising the paint alone would have been the worse bug: a join that
      // LOOKS flush and still drops you 13 cm. `groundPick`'s final fallback in
      // crosstown.ts answers KERB_H only out to |x| < FACE + 0.3 and 0 beyond
      // it, so from 30 cm inside the mouth the whole alley walked at road
      // level. This is the same move the park, the car lot and the library
      // courtyard already make — the module that owns the ground says how high
      // it is, rather than crosstown.ts learning another rectangle.
      //
      // The rect is D's own walls, read above, so it cannot drift from the slot
      // it describes. It starts at FACE, where the fallback is already
      // answering KERB_H, so the two agree across the seam instead of meeting
      // at it.
      ctx.ground((x, z) => (x >= FACE && x <= ex && z >= fz0 && z <= fz1)
        ? ALLEY2_SLAB_Y : null);
    }
  }

  return {
    setLampNight: (v) => {
      // Stars are gated on the WEATHER, not faded by it. Rain means cloud, and
      // cloud means no stars — not dimmer ones — so this goes to nothing well
      // before the storm is at full strength.
      const clear = Math.max(0, 1 - rainLevel * 2.4);
      const sv = v * clear;
      starDome.visible = sv > 0.004;
      if (starDome.visible) for (const s of starMats) s.m.opacity = s.base * sv;
      for (const g of nightLit) g.mat.opacity = g.base * v;
      lensM.color.copy(lensDay).lerp(lensLit, v);
      updateLit(v);   // and everything standing in a pool takes the amber
    },
    lit,
    dimWorld,
    rainSky: (c) => { if (rainLevel > 0.01) c.lerp(RAIN_SKY, rainLevel * 0.5); },
    scatter: (x, z, y) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), crumbMat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = rnd() * Math.PI;
      m.position.set(x, y + 0.012, z);
      m.userData.mod = 'props';   // added at runtime, past the build-time sweep
      scene.add(m);
      if (crumbs) scene.remove(crumbs.m);
      crumbs = { x, z, y, t: 35, m };
    },
    updateRain,
    updatePigeons,
  };
}
