import * as THREE from 'three';
import { pixTex, dither } from './paint';
import { L, ROAD_HALF, FACE, rnd } from './rng';
import { treeSprite, TREE_W, treePitTex, hydrantSprite, pigeonSprite, payphoneTex,
         paperTex, scrapTex } from './tex-world';
import { gutterSurfaceY, GUTTER_W } from './tex-ground';
import { ORDER, type CtxBuild } from './ctx';

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
  const { scene, flat, obstacle, boards, wetMats, sidewalkY, KERB_H } = ctx;
  const WET = new THREE.Color(0x5a626e);
  // ── weather: some hours it rains ────────────────────────────────────────
  const RAIN_N = 500;
  const RAIN_BOX = 30;   // world-space wrap period for raindrops
  const rainPos = new Float32Array(RAIN_N * 3);
  for (let i = 0; i < RAIN_N; i++) {
    rainPos[i * 3] = (Math.random() - 0.5) * RAIN_BOX;
    rainPos[i * 3 + 1] = Math.random() * 14;
    rainPos[i * 3 + 2] = (Math.random() - 0.5) * RAIN_BOX;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(rainPos, 3));
  const rainT = pixTex(8, 16, (g) => {
    // one texel wide, not two — a 2 px streak reads as a thick dash at this
    // point size and the rain looked like falling grit rather than water
    g.fillStyle = 'rgba(214,222,232,0.75)'; g.fillRect(4, 1, 1, 14);
  });
  const rainM = new THREE.PointsMaterial({ map: rainT, size: 0.22, transparent: true, opacity: 0, depthWrite: false });
  const rain = new THREE.Points(rainGeo, rainM);
  rain.visible = false;
  scene.add(rain);
  let rainLevel = 0;      // is it raining RIGHT NOW — drives the falling drops
  // The ground has its own state, and it is not rainLevel. Tying the wet look
  // straight to the rain made the street bone dry the instant the last drop
  // landed, which is the one thing a wet street never does.
  let wetness = 0;        // how wet the GROUND is: rises fast, falls slowly
  let soak = 0;           // how long it has been coming down — a long storm
                          // leaves more water to get rid of
  let puddleLevel = 0;    // standing water, which LAGS wetness in both
                          // directions: it is still finding the low spots
                          // after the rain stops, so it peaks late
  const RAIN_SKY = new THREE.Color('#5a626e');
  const rainAt = (h: number) => ((Math.imul(h, 2246822519) >>> 0) % 100) < 22;

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
  const lampHeads: { x: number; z: number }[] = [];
  // Each entry keeps the PART's offset inside its parent, not just the parent,
  // so a 4.5 m car doesn't shift as one block — its near end catches the pool
  // and its far end doesn't.
  interface Lit { root: THREE.Object3D; ox: number; oz: number; m: THREE.MeshBasicMaterial; base: THREE.Color; pool: boolean; floor: number; wetK: number }
  const litList: Lit[] = [];
  const litSeen = new Set<THREE.Material>();
  const LAMP_R = 4.0;        // the pools read about this wide
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
  const FLOOR_GROUND = 0.07, FLOOR_LOW = 0.19, FLOOR_HIGH = 0.05;
  const POOL_GAIN = 12;        // what a lamp hands back, against the deep floor
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
  const ambient = (floor: number) => 1 - nightNow * (1 - floor);
  const register = (root: THREE.Object3D, pool: boolean) => {
    root.traverse((o) => {
      const mm = (o as THREE.Mesh).material;
      if (!mm) return;
      for (const m of (Array.isArray(mm) ? mm : [mm]) as THREE.MeshBasicMaterial[]) {
        if (!m || !m.color || m.transparent || litSeen.has(m)) continue;
        // Excluded ONLY for genuinely non-diffuse surfaces — glass, chrome
        // and rubber, flagged in ct/cars.ts. There used to be a luminance
        // floor here too, and it is why a person in a dark coat walked under
        // a lamp and got nothing: every dark garment, dark car body, railing
        // and the dumpster fell under it and was skipped outright. Light
        // falls on dark things as well; the multiply model already gets the
        // rest right, since a dark base times the same factor stays dark —
        // it just stops being BLACK.
        if (m.userData?.noLight) continue;
        const c = m.color;
        litSeen.add(m);
        // things in the street are street-level: they go as dark as the road
        // and the lamps buy them back
        litList.push({ root, ox: o.position.x, oz: o.position.z, m, base: c.clone(), pool, floor: FLOOR_GROUND, wetK: 0 });
      }
    });
  };
  const lit = (root: THREE.Object3D) => register(root, true);
  // Everything else on the block: it loses the ambient at night like anything
  // would, but a lamp does not pick it out — the buildings already get the
  // wall splash and the road already gets the pool decal, and warming a 12 m
  // wall off its centre point would be wrong anyway.
  const dimWorld = (root: THREE.Object3D) => {
    root.traverse((o) => {
      if (Math.abs(o.position.x) > 100) return;      // interiors keep their own light
      const mm = (o as THREE.Mesh).material;
      if (!mm) return;
      for (const m of (Array.isArray(mm) ? mm : [mm]) as THREE.MeshBasicMaterial[]) {
        if (!m || !m.color || m.transparent || litSeen.has(m)) continue;
        if (wetMats.some((w) => w.m === m)) continue; // updateRain owns those
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
        const poolable = wy.y < 4.5 && Number.isFinite(span) && span < 6;
        litList.push({ root: o, ox: 0, oz: 0, m, base: m.color.clone(), pool: poolable,
                       floor: floorFor(wy.y), wetK: wetKFor(wy.y) });
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
  };
  let litLast = -1;
  let wetLast = 0;
  const updateLit = (night: number) => {
    nightNow = night;
    // Free in broad daylight — but this pass now carries the RAIN as well as
    // the night, so a dry-and-sunny early-out has to check both or walls
    // never get wet during a daytime storm. That is exactly what happened.
    if (night <= 0.001 && litLast <= 0.001 && wetness <= 0.004 && wetLast <= 0.004) return;
    wetLast = wetness;
    litLast = night;
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
      const a = e.root.rotation.y, ca = Math.cos(a), sa = Math.sin(a);
      const px = e.root.position.x + e.ox * ca + e.oz * sa;
      const pz = e.root.position.z - e.ox * sa + e.oz * ca;
      let best = 0;
      for (const h of lampHeads) {
        const dx = px - h.x, dz = pz - h.z;
        const d2 = dx * dx + dz * dz;
        if (d2 >= LAMP_R * LAMP_R) continue;
        const f = 1 - Math.sqrt(d2) / LAMP_R;
        if (f > best) best = f;
      }
      // smoothstep, not a square: squared only reaches 0.23 two metres from
      // the head, too faint to read as lit at all
      const k = night * (best * best * (3 - 2 * best));
      // dark by default, and the lamp gives it back — capped so a pool reads
      // as lit rather than blown out
      const mul = Math.min(1, amb * (1 + k * POOL_GAIN));
      e.m.color.setRGB(
        e.base.r * mul * (1 + (WARM_R - 1) * k),
        e.base.g * mul * (1 + (WARM_G - 1) * k),
        e.base.b * mul * (1 + (WARM_B - 1) * k),
      );
    }
  };

  // Splash-back: the bottom of a wall is wetter than the top, and no amount of
  // per-material tinting can say that because a facade is ONE mesh with one
  // colour. This is the gradient, as a thin sheet stood against the wall.
  const splashT = pixTex(32, 32, (g) => {
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
  });
  splashT.wrapS = splashT.wrapT = THREE.RepeatWrapping;
  const splashMats: THREE.MeshBasicMaterial[] = [];

  // light spilling onto the wall behind each lamp, so the brick beside a
  // lamp isn't as flat-black as the brick mid-block
  const wallSplashT = pixTex(32, 48, (g) => {
    const gr = g.createRadialGradient(16, 17, 1, 16, 17, 26);
    gr.addColorStop(0, 'rgba(255,192,116,0.55)');
    gr.addColorStop(0.45, 'rgba(255,176,96,0.20)');
    gr.addColorStop(1, 'rgba(255,176,96,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 48);
  });

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
  const pitGeo = new THREE.PlaneGeometry(0.8, 1.0);
  const pitMat = new THREE.MeshBasicMaterial({ map: pitT });
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
  for (let z = -2; z > -L + 8; z -= 14) {
    const s = Math.round(z / 14) % 2 === 0 ? 1 : -1;
    const tx = s * (ROAD_HALF + 0.4);               // kerb-side; pit road-edge sits on the kerb
    const pz2 = Math.round(z - 0.5) + 0.5 + (TREE_SHIFT[treeIdx] ?? 0); // snapped to the 1 m slab grid
    // rnd() is consumed for EVERY tree regardless, so trimming one does not
    // shift the seeded stream and change the others.
    const H = Math.round((90 + Math.floor(rnd() * 24)) * (TREE_TRIM[treeIdx] ?? 1));
    const tree = board(treeSprite(treeIdx, H), TREE_W * TREE_PX, H * TREE_PX, tx, pz2);
    tree.position.y = sidewalkY;
    lit(tree);
    const pit = new THREE.Mesh(pitGeo, pitMat);
    pit.rotation.x = -Math.PI / 2;
    pit.position.set(tx, sidewalkY + 0.006, pz2);
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
  const lampGlowT = pixTex(32, 32, (g) => {
    const gr = g.createRadialGradient(16, 16, 1, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,198,120,0.90)');
    gr.addColorStop(0.5, 'rgba(255,178,96,0.30)');
    gr.addColorStop(1, 'rgba(255,178,96,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  });
  const lampPoolT = pixTex(48, 48, (g) => {
    const gr = g.createRadialGradient(24, 24, 2, 24, 24, 24);
    gr.addColorStop(0, 'rgba(255,190,110,0.55)');
    gr.addColorStop(0.55, 'rgba(255,180,100,0.15)');
    gr.addColorStop(1, 'rgba(255,180,100,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 48, 48);
  });
  const poleM = new THREE.MeshBasicMaterial({ color: 0x24291f });   // dark cast iron
  const poleHi = new THREE.MeshBasicMaterial({ color: 0x323826 });
  const lensM = new THREE.MeshBasicMaterial({ color: 0x3a3324 });   // shared: dark glass by day, warms at night
  const lensDay = new THREE.Color(0x3a3324), lensLit = new THREE.Color(0xffcc82);
  const LAMP_H = 5.0;
  const makeLamp = (s: number, z: number) => {
    const bx = s * (ROAD_HALF + 0.55);          // just inside the kerb
    const reach = 1.25;                         // crook arm reaches over the road
    const headX = bx - s * reach;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.5, 0.28), poleHi);
    base.position.set(bx, sidewalkY + 0.25, z); scene.add(base);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.14, LAMP_H, 0.14), poleM);
    pole.position.set(bx, sidewalkY + LAMP_H / 2, z); scene.add(pole);
    // clean L crook: vertical pole + one horizontal arm (no diagonal strut) +
    // a lamp head that hangs DOWN off the arm's far end
    const arm = new THREE.Mesh(new THREE.BoxGeometry(reach, 0.12, 0.12), poleM);
    arm.position.set(bx - s * reach / 2, sidewalkY + LAMP_H - 0.05, z); scene.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.32), poleHi);
    head.position.set(headX, sidewalkY + LAMP_H - 0.16, z); scene.add(head);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.24), lensM);
    lens.position.set(headX, sidewalkY + LAMP_H - 0.31, z); scene.add(lens);
    obstacle({ minX: bx - 0.2, maxX: bx + 0.2, minZ: z - 0.2, maxZ: z + 0.2 });
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
    halo.position.set(headX, sidewalkY + LAMP_H - 0.31, z);
    boards.push({ m: halo }); scene.add(halo);
    nightLit.push({ mat: halo.material as THREE.MeshBasicMaterial, base: 1.0 });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4),
      new THREE.MeshBasicMaterial({ map: lampPoolT, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(headX, 0.02, z); scene.add(pool);
    lampHeads.push({ x: headX, z });
    // light spilling up the wall behind the lamp, on the same night curve as
    // the halo — otherwise the brick beside a lamp is as black as the brick
    // mid-block, which is what makes the street read as unlit
    const splash = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 5.0),
      new THREE.MeshBasicMaterial({ map: wallSplashT, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    splash.position.set(s * (FACE - 0.06), sidewalkY + 2.7, z);
    splash.rotation.y = -s * Math.PI / 2;   // face the street, not the brick
    scene.add(splash);
    nightLit.push({ mat: splash.material as THREE.MeshBasicMaterial, base: 0.62 });
    nightLit.push({ mat: pool.material as THREE.MeshBasicMaterial, base: 0.85 });
  };
  // staggered down the block, kept clear of the tree pits (every 14 m at −2,−16…)
  [[-1, -9], [1, -23], [-1, -37], [1, -51], [-1, -65], [1, -79]].forEach(([s, z]) => makeLamp(s, z));
  // two more lighting the corner turn
  makeLamp(-1, -93);
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
  const crumbT = pixTex(32, 32, (g) => {
    g.fillStyle = '#d9c9a0';
    for (let i = 0; i < 42; i++) g.fillRect(Math.floor(Math.random() * 30), Math.floor(Math.random() * 30), 2, 2);
  });
  const crumbMat = new THREE.MeshBasicMaterial({ map: crumbT, alphaTest: 0.5, side: THREE.DoubleSide });
  let crumbs: { x: number; z: number; y: number; t: number; m: THREE.Mesh } | null = null;

  // ── the payphone ────────────────────────────────────────────────────────
  //
  // It stood at z = -11, which is inside the library's entrance bay — it was
  // standing in the doorway. Moved north to the MERIDIAN frontage (z -5 … 5),
  // which is the same stretch of walk so it stays where the player expects
  // it, and MERIDIAN is exactly the bland modern slab that gets a payphone
  // bolted to it. Clear of the lamp at z = -9 and of the doors.
  //
  // Also SLIMMED, from 0.9 m deep to 0.3. It is a wall-mounted phone on a
  // backboard, not a booth, and the old depth ate half the two-metre walk:
  // its collider reached x = -5.95, which with the rig's 0.36 m radius blocked
  // everything out to -5.59 and closed the only through-lane on this side
  // (the lamps already block from -6.11). At 0.3 m it sits entirely inside
  // the wall's own collider shadow and costs the walk nothing. The face you
  // actually look at is unchanged: 0.9 m wide, 2.3 m tall.
  const PHONE_Z = -3.0;
  const phone = new THREE.Mesh(new THREE.BoxGeometry(0.30, 2.3, 0.9), flat(payphoneTex()));
  phone.position.set(-(FACE - 0.15), sidewalkY + 1.15, PHONE_Z);
  scene.add(phone);
  lit(phone);
  obstacle({ minX: -FACE, maxX: -(FACE - 0.30), minZ: PHONE_Z - 0.55, maxZ: PHONE_Z + 0.55 });

  // weather: the rain comes and goes by the hour, and the ground
  // remembers it — every registered wet surface darkens as it comes in
  // Registered rather than called by name from the sim loop. PROPS order: it
  // must run AFTER the world state hooks (it reads the hour) and BEFORE the
  // billboard pass, because it tints the wet ground the billboards sit on.
  ctx.onFrame((f) => updateRain(f.dt, f.px, f.pz, f.hourAbs), ORDER.PROPS);

  const updateRain = (dt: number, px: number, pz: number, hAbs: number) => {
    const wantRain = rainAt(hAbs) && px < 100 ? 1 : 0;
    rainLevel += (wantRain - rainLevel) * Math.min(1, dt * 0.6);
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
    for (const w of wetMats) {
      // Not every surface gives the water up at the same rate. The road crown
      // sheds it first; the gutter is where it is all running TO, so that
      // holds on longest. We can tell them apart by the shape of their sheet
      // — the kerb and gutter are long thin strips, everything else is a
      // broad surface — which keeps this local instead of needing a new field
      // on the shared WetSurface type.
      const img = (w.m.map?.image as { height?: number } | undefined);
      const holdsWater = !!img?.height && img.height < 32;
      const wSurf = Math.pow(wetness, holdsWater ? 0.55 : 1.7);
      w.m.color.copy(w.base).lerp(WET, wSurf * 0.95).multiplyScalar(amb);
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
    // Chased off WETNESS, slowly, and aimed a little past it — so while the
    // wetness is already ebbing the pools are still filling, and they crest
    // AFTER the rain has stopped. That late peak is the thing you notice
    // walking out after a storm.
    puddleLevel += (wetness * 1.06 - puddleLevel) * Math.min(1, dt * 0.09);
    for (const q of puddles) {
      const fill = Math.min(1, Math.max(0, (puddleLevel - q.lo) / (q.hi - q.lo)));
      q.m.opacity = q.max * fill;
      q.m.visible = fill > 0.02;             // bone dry means NO puddle at all
      // never lighter than the road it sits on: the faint sky sheen in the
      // sheet has to come down with the ambient or it glows at 3am
      q.m.color.setScalar(amb);
    }
    rain.visible = rainLevel > 0.02;
    if (rain.visible) {
      rainM.opacity = 0.55 * rainLevel;
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
        let ry = rp.getY(i) - dt * 13;
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
  const flatDecal = (tex: THREE.Texture, w: number, d: number, x: number, z: number, rot: number, y: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, transparent: true }));
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
  for (let i = 0; i < 7; i++) {
    const s2 = rnd() < 0.5 ? -1 : 1;
    const z = -6 - rnd() * (L - 18);
    const x = s2 * (GUT - rnd() * 0.20);
    // this draw used to pick can-or-scrap; it now picks between the two
    // approved sheets, so the seeded stream is unchanged (GOTCHAS §2)
    if (rnd() < 0.42) {
      flatDecal(paperT[i % 4], 0.30, 0.24, x, z, rnd() * Math.PI, 0.014);
    } else {
      flatDecal(scrapT[i % 3], 0.26, 0.22, x, z, rnd() * Math.PI, 0.014);
    }
  }
  // paper trash — flyers, folded sheets, pulpy soaked handbills. More of
  // these than cans: paper is what actually collects along a wet kerb.
  for (let i = 0; i < 5; i++) {
    const s2 = rnd() < 0.5 ? -1 : 1;
    const pw = 0.34 + rnd() * 0.14, pd = 0.26 + rnd() * 0.10;
    const px2 = s2 * (GUT - rnd() * 0.22);
    flatDecal(paperT[i % 4], pw, pd, px2, -8 - rnd() * (L - 20), rnd() * Math.PI, surfaceY(px2));
  }
  // one piece up on the sidewalk, against the kerb. This was the can, and it
  // is the exact one the user pointed at — green band, black ring, reading as
  // a sticker on the slab. Same spot, approved sheet.
  flatDecal(scrapT[1], 0.28, 0.24, ROAD_HALF + 0.22, -47.5, 0.7, sidewalkY);


  // ── puddles ─────────────────────────────────────────────────────────────
  // The ground tinting alone reads as "damp"; standing water is what makes it
  // read as RAIN. These sit in the gutter and in low spots on the road, fade
  // in behind the rain curve (water takes a moment to pool, so they lag), and
  // carry a pale sheen so they catch the sky rather than just being dark.
  // Appended last: rnd() is a shared seeded stream and everything above draws
  // from it.
  const puddleT = pixTex(48, 32, (g) => {
    // Water on asphalt is DARKER than the dry road, not lighter. The first
    // version had a big pale sheen and at night it read as a glowing blob
    // sitting on the tarmac. Now: a dark body, a soft alpha edge so it does
    // not look like a decal, and only a whisper of sky sheen.
    const ring = (rx: number, ry: number, col: string) => {
      g.fillStyle = col; g.beginPath(); g.ellipse(24, 16, rx, ry, 0, 0, Math.PI * 2); g.fill();
    };
    ring(23, 14, 'rgba(20,24,32,0.30)');     // soft outer feather
    ring(20, 12, 'rgba(17,21,28,0.55)');
    ring(16, 9.5, 'rgba(14,18,24,0.72)');    // dark body
    g.fillStyle = 'rgba(120,140,168,0.16)';  // faint sky glance, off-centre
    g.beginPath(); g.ellipse(19, 12, 7, 3, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(150,168,196,0.13)';  // one thin catch-light streak
    g.fillRect(14, 19, 11, 1);
  });
  // Each puddle is its OWN material, so they do not all fade in lockstep —
  // one shared opacity was why none of them read. lo/hi is the window of
  // standing water over which this one fills: a deep hollow starts collecting
  // almost at once and is the last thing left, while a shallow smear needs a
  // real storm and goes first.
  // Water at a catch basin does not sit in a circle — it RUNS, down the pan
  // and into the mouth, and it is narrow because the pan is narrow. The
  // symmetric 2.5 m sheet that used to sit on the drain was the same defect as
  // the lamp glow: a large soft gradient blob in a world of hard texels, and
  // the user's read was "what is this it looks bad". So this sheet is stepped
  // and directional — a one-texel wetted edge, quantised, widest at the mouth
  // and thinning up-grade, with hard catch-light texels rather than a sheen.
  const trackT = pixTex(16, 64, (g) => {
    for (let y = 0; y < 64; y++) {
      const t = 1 - y / 63;                                     // 1 at the mouth
      const half = Math.max(1, Math.round(1.3 + t * 5.2 + (((y >> 2) % 3 === 1) ? 1 : 0)));
      g.fillStyle = 'rgba(15,19,26,0.80)';
      g.fillRect(8 - half + 1, y, half * 2 - 2, 1);
      g.fillStyle = 'rgba(20,25,33,0.46)';                      // the wetted edge, one texel, hard
      g.fillRect(8 - half, y, 1, 1); g.fillRect(8 + half - 1, y, 1, 1);
    }
    g.fillStyle = 'rgba(150,168,196,0.18)';
    for (const [x, y] of [[7, 11], [8, 11], [9, 29], [6, 43], [8, 51]]) g.fillRect(x, y, 1, 1);
  });
  interface Puddle { m: THREE.MeshBasicMaterial; lo: number; hi: number; max: number }
  const puddles: Puddle[] = [];
  // `run` makes it a directed track instead of a blob. Both rnd() draws happen
  // either way, even when the shape is given, so the seeded stream does not
  // move when a puddle changes shape (GOTCHAS §2).
  const addPuddle = (x: number, z: number, w: number, lo: number, hi: number, max: number,
                     run?: { len: number; tex: THREE.Texture }) => {
    const m = new THREE.MeshBasicMaterial({
      map: run ? run.tex : puddleT, transparent: true, opacity: 0, depthWrite: false });
    m.visible = false;
    const aspect = 0.42 + rnd() * 0.3, spin = rnd() * Math.PI;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, run ? run.len : w * aspect), m);
    p.rotation.x = -Math.PI / 2;            // a ground DECAL, never a billboard
    p.rotation.z = run ? 0 : spin;          // a run lies ALONG the gutter, so it is never spun
    p.position.set(x, surfaceY(x) + 0.005, z);   // a film ON the surface, not through it
    scene.add(p);
    puddles.push({ m, lo, hi, max });
  };
  // Where water actually goes. The gutter pan first — that is what it is for
  // — then the catch basins it drains to, then a few low spots out on the
  // crown, then under the drip line where an awning sheds onto the walk.
  const PAN_X = ROAD_HALF - 0.28;           // in the pan, hard against the kerb
  for (let i = 0; i < 6; i++) {
    const s2 = rnd() < 0.5 ? -1 : 1;
    addPuddle(s2 * (PAN_X - rnd() * 0.22), -6 - rnd() * (L - 18),
              1.5 + rnd() * 2.2, 0.04 + rnd() * 0.10, 0.42 + rnd() * 0.3, 0.62 + rnd() * 0.22);
  }
  // The two catch basins (ct/tex-ground.ts puts them here) — the lowest points
  // on the block, so these fill first and outlast everything. Laid ALONG the
  // pan and running into the mouth, up-grade of each basin, not spread round
  // it: the gutter is 45 cm wide and water in it is a ribbon, not a pool.
  const BASIN_Z = [-92.5, -105];
  addPuddle(ROAD_HALF - 0.24, BASIN_Z[0] + 1.30, 0.40, 0.02, 0.30, 0.80,
            { len: 2.6, tex: trackT });
  addPuddle(-(ROAD_HALF - 0.24), BASIN_Z[1] + 1.15, 0.40, 0.02, 0.32, 0.78,
            { len: 2.3, tex: trackT });
  // The permanent stain, dry or wet, and it FOLLOWS THE WATER: a narrow track
  // down the pan that darkens as it converges on the mouth. The version this
  // replaces sat symmetrically around the grate, which is the one thing water
  // never does — grime goes where the flow goes, and the flow is a ribbon in
  // the last 20 cm against the kerb.
  const stainT = pixTex(16, 64, (g) => {
    for (let y = 0; y < 64; y++) {
      const t = 1 - y / 63;                                     // 1 at the mouth
      const half = Math.max(1, Math.round(0.9 + t * 4.4 + (((y >> 1) % 4 === 2) ? 1 : 0)));
      g.fillStyle = `rgba(38,34,28,${(0.12 + t * 0.44).toFixed(3)})`;
      g.fillRect(8 - half, y, half * 2, 1);
      g.fillStyle = `rgba(22,21,18,${(0.12 + t * 0.42).toFixed(3)})`;
      g.fillRect(7, y, 2, 1);                                   // the channel it actually runs in
    }
  });
  const stain = (x: number, z: number, len: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, len),
      new THREE.MeshBasicMaterial({ map: stainT, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, surfaceY(x) + 0.003, z);
    scene.add(m);
  };
  stain(ROAD_HALF - 0.22, BASIN_Z[0] + 1.55, 3.1);
  stain(-(ROAD_HALF - 0.22), BASIN_Z[1] + 1.40, 2.8);
  // low spots out on the road: these need a proper storm and dry first
  for (let i = 0; i < 3; i++) {
    const s2 = rnd() < 0.5 ? -1 : 1;
    addPuddle(s2 * (1.2 + rnd() * 2.2), -10 - rnd() * (L - 26),
              1.3 + rnd() * 1.5, 0.45 + rnd() * 0.22, 0.9, 0.44 + rnd() * 0.16);
  }
  // under the drip line: an awning sheds its whole roof onto one strip of walk
  for (let i = 0; i < 2; i++) {
    const s2 = rnd() < 0.5 ? -1 : 1;
    addPuddle(s2 * (ROAD_HALF + 0.9), -14 - rnd() * (L - 34),
              1.0 + rnd() * 0.9, 0.16 + rnd() * 0.12, 0.6, 0.5 + rnd() * 0.14);
  }

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
  const STOP_Z = -33.5, BENCH_Z = -36.6;
  const metalM = new THREE.MeshBasicMaterial({ color: 0x2b3138 });
  // the bench gets its OWN instance: the lamplight registry binds a material
  // to one position, and the bench stands 3 m from the pole
  const benchM = new THREE.MeshBasicMaterial({ color: 0x2b3138 });
  const flatT2 = (m: THREE.Texture) => new THREE.MeshBasicMaterial({ map: m, side: THREE.DoubleSide });

  // the flag sign — dark blue field, white pictogram, route number
  const flagT = pixTex(32, 44, (g) => {
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
  });
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
  const slatT = pixTex(48, 12, (g) => {
    g.fillStyle = '#6a5a42'; g.fillRect(0, 0, 48, 12);
    g.fillStyle = 'rgba(0,0,0,0.32)';
    for (let y = 3; y < 12; y += 4) g.fillRect(0, y, 48, 1);   // slat gaps
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let y = 0; y < 12; y += 4) g.fillRect(0, y, 48, 1);
    dither(g, 48, 12, 40);
  });
  const adT = pixTex(96, 22, (g) => {
    g.fillStyle = '#c9c2ae'; g.fillRect(0, 0, 96, 22);
    g.fillStyle = '#8a2c22'; g.fillRect(0, 0, 96, 6);
    g.fillStyle = '#e8e4d8'; g.font = 'bold 5px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText("TONY'S PIZZA", 48, 3);
    g.fillStyle = '#2b3138'; g.font = 'bold 6px monospace';
    g.fillText('555-0143', 48, 12);
    g.fillStyle = '#6a6458'; g.font = '5px monospace';
    g.fillText('TWO SLICES $1.75', 48, 18);
    dither(g, 96, 22, 50);
  });
  // A bus bench, built the way one actually is: a horizontal SEAT of slats at
  // 0.45 m, a BACKREST rising from the seat's back edge to 0.88 m, and four
  // legs under it. The advertisement is printed ON the backrest — it is the
  // panel you lean against, not a billboard standing behind the seat.
  //
  // The back edge is the ROAD side, because that is the way ad benches face:
  // the sitter looks at the shopfronts and the advertiser gets the traffic.
  const BX_BACK = ROAD_HALF + 0.10;          // outer face of the backrest
  const BX_SEAT0 = BX_BACK + 0.07;           // seat starts where the back ends
  const BX_SEAT1 = BX_SEAT0 + 0.50;          // 0.50 m of seat depth
  const SEAT_Y = sidewalkY + 0.45;
  const BACK_TOP = sidewalkY + 0.88;
  const BENCH_L = 1.8;

  // backrest = the ad panel. [+x, -x, +y, -y, +z, -z]: slats face the sitter,
  // the ad faces the roadway.
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.07, BACK_TOP - SEAT_Y, BENCH_L),
    [flatT2(slatT), flatT2(adT), benchM, benchM, benchM, benchM]);
  back.position.set(BX_BACK + 0.035, (SEAT_Y + BACK_TOP) / 2, BENCH_Z);
  scene.add(back);
  lit(back);
  // seat: three slats with gaps, so it reads as seating rather than a slab
  for (let i = 0; i < 3; i++) {
    const w = 0.15;
    const slat = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, BENCH_L),
      [benchM, benchM, flatT2(slatT), benchM, flatT2(slatT), flatT2(slatT)]);
    slat.position.set(BX_SEAT0 + w / 2 + i * 0.175, SEAT_Y - 0.025, BENCH_Z);
    scene.add(slat);
    lit(slat);
  }
  // four legs, not a solid box
  for (const sz of [-1, 1]) for (const lx of [BX_SEAT0 + 0.05, BX_SEAT1 - 0.05]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.06), benchM);
    leg.position.set(lx, sidewalkY + 0.225, BENCH_Z + sz * 0.78);
    scene.add(leg);
  }
  // a proper contact shadow on the flags, so it sits ON the pavement
  const benchShadowT = pixTex(24, 48, (g) => {
    const gr = g.createLinearGradient(0, 0, 24, 0);
    gr.addColorStop(0, 'rgba(20,18,15,0.34)');
    gr.addColorStop(0.7, 'rgba(20,18,15,0.16)');
    gr.addColorStop(1, 'rgba(20,18,15,0)');
    g.fillStyle = gr; g.fillRect(0, 2, 24, 44);
  });
  const bshadow = new THREE.Mesh(new THREE.PlaneGeometry(0.78, BENCH_L + 0.12),
    new THREE.MeshBasicMaterial({ map: benchShadowT, transparent: true, depthWrite: false }));
  bshadow.rotation.x = -Math.PI / 2;
  bshadow.position.set(BX_BACK + 0.36, sidewalkY + 0.004, BENCH_Z);
  scene.add(bshadow);
  // the collider stays inside the lamp-pole envelope (they block to x ≈ 6.11
  // with the rig's 0.36 m radius) so the bench never becomes the pinch point
  obstacle({ minX: BX_BACK - 0.05, maxX: BX_SEAT1, minZ: BENCH_Z - 0.92, maxZ: BENCH_Z + 0.92 });

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
  const shadeT = pixTex(16, 16, (g) => {
    g.fillStyle = 'rgba(0,0,0,0.34)'; g.fillRect(2, 3, 12, 10);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(1, 2, 14, 12);
  });
  // The contact shadow needs its OWN material: flatDecal sets alphaTest 0.5,
  // and every texel of a soft shadow is below that, so shadows drawn through
  // flatDecal were being discarded outright and nothing sat on the ground.
  const contact = (w: number, d: number, x: number, z: number, y: number, rot: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ map: shadeT, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = rot;
    m.position.set(x, y + 0.003, z);
    scene.add(m);
  };
  const FOOT: Record<string, [number, number]> = {
    'coffee cup': [0.42, 0.30],
    'folded newspaper': [0.54, 0.42],
    'flattened cardboard': [0.82, 0.58],
    'milk crate': [0.48, 0.48],
    'fountain cup': [0.60, 0.34],
  };
  const ALLEY_Y = 0.006;                  // ct/street.ts lays the alley slab at 0.005
  const drop = (name: string, x: number, z: number, yaw: number, y?: number) => {
    const make = CATALOGUE.find((c) => c[0] === name)?.[1];
    if (!make) return;
    const o = make();
    // every candidate carries its own built-in skew; this turns the whole
    // piece on top of it, so no two placements of one object are copies
    o.rotation.y += yaw;
    const gy = y ?? surfaceY(x);          // surfaceY knows the gutter's cross-slope
    o.position.set(x, gy, z);
    // tagged so scripts/trash.mjs can find MY litter and not every group in
    // the scene — the side street and the car lot have their own props sitting
    // at ground level and they are not mine to measure
    o.userData.litter = name;
    o.userData.groundY = gy;
    scene.add(o);
    lit(o);                               // they take the lamplight like anything else
    const [fw, fd] = FOOT[name] ?? [0.5, 0.4];
    contact(fw, fd, x, z, gy, yaw);
  };
  // Where rubbish actually ends up: against the kerb where the water leaves it,
  // in the alley by the bins, blown up against the building line, and under the
  // one bench on the block. Nothing is solid — you walk straight over litter —
  // so the big pieces are kept off the walking line by placement rather than by
  // a collider, which is the only way to add them without touching the 2 m lane.
  // Hand-placed, no rnd(), so the seeded stream is untouched (GOTCHAS §2).
  const GUT_L = -(ROAD_HALF - 0.14), GUT_R = ROAD_HALF - 0.14;
  // the gutter line
  drop('coffee cup', GUT_L, -21.6, 0.90);
  drop('coffee cup', GUT_R + 0.04, -33.9, 1.70);
  drop('fountain cup', GUT_R + 0.02, -54.3, -2.20);
  drop('folded newspaper', GUT_L + 0.04, -68.4, 0.30);
  // the alley, round the dumpster — crates live here, not on a sidewalk
  drop('milk crate', -12.20, -39.60, 0.35, ALLEY_Y);
  drop('milk crate', -11.55, -40.35, -0.80, ALLEY_Y);
  drop('flattened cardboard', -10.60, -41.45, 0.90, ALLEY_Y);
  drop('fountain cup', -9.40, -42.40, -1.20, ALLEY_Y);
  drop('folded newspaper', -12.60, -42.05, 0.40, ALLEY_Y);
  // blown up against the building line, clear of the tree pits (x ±5.0…5.8)
  drop('flattened cardboard', 6.58, -26.5, -0.35);
  drop('milk crate', -6.74, -58.2, 0.55);
  drop('folded newspaper', 6.66, -76.0, 1.10);
  // under the bus bench, which is the one place on this street people sit
  drop('coffee cup', 5.42, -37.2, 0.70);
  drop('folded newspaper', 5.52, -36.0, -0.50);

  return {
    setLampNight: (v) => {
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
      scene.add(m);
      if (crumbs) scene.remove(crumbs.m);
      crumbs = { x, z, y, t: 35, m };
    },
    updateRain,
    updatePigeons,
  };
}
