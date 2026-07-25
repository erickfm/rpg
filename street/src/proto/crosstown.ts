import * as THREE from 'three';
import type { Proto } from './types';
import { FPRig, type AABB } from './fp';

// ═══════════════════════════════════════════════════════════════════════════
// CROSSTOWN '97 — the small world. One hand-authored street.
//
// Scoped down on purpose: no streaming, no procedural grid. This is the
// original narrow street, finished properly — closed at both ends by cross
// buildings half-swallowed in fog, upgraded with the 8-angle citizens and
// the painted car fleet from the milestone. We grow it from here, together,
// block by deliberate block.
// ═══════════════════════════════════════════════════════════════════════════
import { ROAD_HALF, WALK, FACE, PARK_X, FOG_NEAR, FOG_FAR, rnd } from './ct/rng';
import { pixTex } from './ct/paint';
import { asphaltTex } from './ct/tex-world';
import { buildGround } from './ct/tex-ground';
import { type CarKind, makeCar } from './ct/cars';
import { buildTraffic } from './ct/traffic';
import { buildBodega } from './ct/bodega';
import { buildStreet } from './ct/street';
import { buildCrowd, type Crowd } from './ct/crowd';
import { ORDER, type Board, type CtxBuild, type WetSurface, type Spot, type PlayerRef, type Frame, type FrameHook } from './ct/ctx';
import { buildApartment } from './ct/apartment';
import { makeHud, type Purse } from './ct/hud';
import { buildProps } from './ct/props';
import { interiorGround, interiorMaxX } from './ct/interior';
import { buildDiner } from './ct/int-diner';

// ═══════════════════════════════ the world ════════════════════════════════

export function makeCrosstown(): Proto {
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(88, 1, 0.1, 220);
  scene.background = new THREE.Color(0x8a97a2);
  scene.fog = new THREE.Fog(0x8a97a2, FOG_NEAR, FOG_FAR);
  scene.add(new THREE.AmbientLight(0xffffff, 1.1), new THREE.HemisphereLight(0xd8dce0, 0x6a6258, 0.5));

  const flat = (m: THREE.Texture) => new THREE.MeshBasicMaterial({ map: m });

  // ground: the main street, and a side street it turns into at the south
  // end (the corner). Same road width, same kerbs, fog owns the far end.
  const SIDE_Z0 = -98, SIDE_Z1 = -108;  // side-street road band
  const SIDE_X1 = 55;                   // side street runs east to here
  // wet-look plumbing: horizontal ground surfaces darken + cool as the rain
  // comes in (everything is unlit, so ct/props tints the map materials). The
  // registry lives here because the roads below are the first thing to join it.
  const wetMats: WetSurface[] = [];
  const wet = (m: THREE.MeshBasicMaterial) => { wetMats.push({ m, base: m.color.clone() }); return m; };
  // the two road planes ABUT at z = -98 — never overlap, never z-fight
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, 36 - SIDE_Z0), wet(flat(asphaltTex())));
  road.rotation.x = -Math.PI / 2; road.position.z = (36 + SIDE_Z0) / 2;
  scene.add(road);
  const sideRoad = new THREE.Mesh(new THREE.PlaneGeometry(SIDE_X1 + 7, 10), wet(flat(asphaltTex(SIDE_X1 + 7, 10))));
  sideRoad.rotation.x = -Math.PI / 2;
  sideRoad.position.set((SIDE_X1 - 7) / 2, 0, (SIDE_Z0 + SIDE_Z1) / 2);
  scene.add(sideRoad);
  // the sidewalks, the kerb, the gutter pan and the two corner returns —
  // one module owns every surface you walk on (see ct/tex-ground.ts). It
  // hands back the ground height for the patches it owns, because the corner
  // is a radius now and one of the returns ramps down to the crossing.
  const KERB_H = 0.14;
  const ground = buildGround({ scene, flat, wet, KERB_H, SIDE_Z0, SIDE_Z1, SIDE_X1, asphalt: asphaltTex });
  const sidewalkY = KERB_H; // prop base height on the walks
  const lineT = pixTex(8, 32, (g) => { g.fillStyle = '#b8a24e'; g.fillRect(2, 0, 4, 18); });
  lineT.wrapS = lineT.wrapT = THREE.RepeatWrapping;
  lineT.repeat.set(1, 38);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 36 - SIDE_Z0), new THREE.MeshBasicMaterial({ map: lineT, alphaTest: 0.5 }));
  line.rotation.x = -Math.PI / 2;
  line.position.set(0, 0.03, (36 + SIDE_Z0) / 2);
  const lineT2 = lineT.clone();
  lineT2.repeat.set(1, 22);
  lineT2.needsUpdate = true;
  const line2 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 48), new THREE.MeshBasicMaterial({ map: lineT2, alphaTest: 0.5 }));
  line2.rotation.x = -Math.PI / 2;
  line2.rotation.z = Math.PI / 2;
  line2.position.set(30, 0.032, (SIDE_Z0 + SIDE_Z1) / 2);
  scene.add(line2);
  scene.add(line);

  // buildings — every one a specific place, laid by hand end to end.
  // West carries the walk-up (No. 227, res facade, entrance at z=-31) and
  // the alley; nothing on the street is filler.
  const AZ0 = -37, AZ1 = -43.5; // the alley gap in the left wall
  const boards: Board[] = [];
  buildStreet({ scene, flat, wet, sidewalkY, KERB_H, boards, AZ0, AZ1, SIDE_X1, SIDE_Z0, SIDE_Z1 });
  // solid props the citizens must steer AROUND (never walk/phase through) —
  // trees, lamp poles, the hydrant, the payphone, and the cars. Declared up
  // here because every module that builds appends to the same two lists.
  const propColliders: AABB[] = [];
  const citAvoid: AABB[] = [];
  const obstacle = (b: AABB) => { propColliders.push(b); citAvoid.push(b); return b; };
  // ── interaction registry ────────────────────────────────────────────────
  // Modules register their own [E] spots; this file no longer enumerates them.
  // `rig` and the teleport are created ~200 lines below, so the accessors are
  // lazy closures — they are only ever CALLED at runtime, by which point both
  // exist.
  const SPOTS: Spot[] = [];
  let rig!: FPRig;
  let jumpToImpl!: (x: number, z: number, yaw: number, gy: number) => void;
  const player: PlayerRef = {
    x: () => rig.pos.x,
    z: () => rig.pos.z,
    gy: () => apt.gy(),
    jumpTo: (x, z, yaw, gy) => jumpToImpl(x, z, yaw, gy),
  };
  // per-frame hooks, sorted by declared order once the world is built — so
  // moving a module's build call cannot silently change run order
  const HOOKS: { fn: FrameHook; order: number }[] = [];
  const ctx: CtxBuild = {
    scene, flat, wet, obstacle, boards, wetMats, sidewalkY, KERB_H,
    spot: (sp) => { SPOTS.push(sp); },
    onFrame: (fn, order = ORDER.PROPS) => { HOOKS.push({ fn, order }); },
    player,
  };
  const apt = buildApartment(ctx);

  // ── the clock and the pockets, and the HUD that draws them ──────────────
  let totalMin = 13 * 60 + 20; // one real second = one game minute
  const purse: Purse = { cash: 14.5, inv: { CEREAL: 3 } }; // some cash, a box of cereal
  let rmbHeld = false;
  let feedHeld = false;
  const hud = makeHud(purse);

  // ── the bodega interior — one bright little room off the corner ─────────
  const bodegaColliders = buildBodega(scene);

  // ── the block's furniture, and the weather over it ─────────────────────
  const props = buildProps(ctx);

  // ── the parked cars ─────────────────────────────────────────────────────
  //
  // How well each is parked is DRAWN, not hand-placed. Hand-tuning offsets
  // only swaps one fixed arrangement for another; this samples a spread, so
  // near-perfect parking is a legitimate outcome rather than something the
  // arrangement excludes. Drawn off the SEEDED stream, so it is stable within
  // a session rather than jittering frame to frame.
  //
  // A van used to stand at z=-78 in front of THRIFT and has been cut. Its
  // collider lived in this table, so it went with it — the table below is the
  // single source for the parked fleet, its boxes and its lamplight entries.
  //
  // The two hard walls, which the spread cannot cross:
  //   PARK_SNUG  |x| + 1.05 = 4.98 < ROAD_HALF — collider never on the walk
  //   PARK_OUT   |x| − 1.05 = 2.57 — collider never in the travel lane
  //              (cars cruise at 1.5 and the bus at 1.35, both to 2.55)
  const PARK_SNUG = 3.93, PARK_OUT = 3.62;
  // Each car gets a tidiness CLASS, and the classes are dealt out shuffled.
  // Drawing all three independently is the obvious thing and it is wrong at
  // this sample size: with only three cars, three tidy ones comes up about a
  // fifth of the time, which is the machined row this was meant to fix (the
  // first seeded draw did exactly that — 4 cm, 6 cm, 2 cm, all square).
  // Stratifying guarantees the ROW reads as varied, while each car's actual
  // gap and angle are still drawn inside its class. Perfect parking stays a
  // real outcome — one car always gets it.
  const PARK_CLASS = ['perfect', 'ordinary', 'out'];
  for (let i = PARK_CLASS.length - 1; i > 0; i--) {   // Fisher–Yates, seeded
    const j = Math.floor(rnd() * (i + 1));
    [PARK_CLASS[i], PARK_CLASS[j]] = [PARK_CLASS[j], PARK_CLASS[i]];
  }
  const parkGap = (cls: string) =>
    cls === 'perfect' ? rnd() * 0.05
      : cls === 'ordinary' ? 0.05 + rnd() * 0.12
        : 0.17 + rnd() * 0.14;                  // out from the kerb
  const parkYaw = (cls: string) => {
    const s = rnd() < 0.5 ? -1 : 1;
    return s * (cls === 'perfect' ? rnd() * 0.012
      : cls === 'ordinary' ? 0.012 + rnd() * 0.038
        : 0.04 + rnd() * 0.06);                 // left it at an angle
  };
  // kind, colour, which kerb, roughly where
  const parked: [CarKind, number, number, number][] = [
    ['sedan', 1, 1, -13],
    ['pickup', 3, -1, -33],
    ['hatch', 5, 1, -49],
  ];
  const carColliders: AABB[] = [];
  const carHalf: Record<CarKind, number> = { sedan: 2.4, hatch: 2.05, pickup: 2.6, van: 2.45 };
  parked.forEach(([kind, ci, side, z0], pi) => {
    const cls = PARK_CLASS[pi % PARK_CLASS.length];
    const gap = Math.min(parkGap(cls), PARK_SNUG - PARK_OUT);
    const x = side * (PARK_SNUG - gap);
    const z = z0 + (rnd() - 0.5) * 2.4;         // and they don't sit on a rhythm
    const ry = (side > 0 ? 0 : Math.PI) + parkYaw(cls);
    const car = makeCar(kind, ci);
    car.position.set(x, 0, z);
    car.rotation.y = ry;
    scene.add(car);
    props.lit(car);          // parked in a lamp pool? then it catches it
    const cb = { minX: x - 1.05, maxX: x + 1.05, minZ: z - carHalf[kind], maxZ: z + carHalf[kind] };
    carColliders.push(cb); citAvoid.push(cb);
  });
  // ── the traffic, and the road network it drives ─────────────────────────
  //
  // The fleet, the junction at the corner and the driving all live in
  // ct/traffic.ts. Built HERE, at this exact point in the sequence, because
  // the car textures paint off the shared Math.random stream — moving the call
  // re-grains every texture painted after it. `crowd` is assigned a few lines
  // below and the accessor is only ever CALLED at runtime, so the lazy closure
  // is safe (same pattern as `rig`).
  let crowd!: Crowd;
  const vehicleBoxes: AABB[] = [];   // one per vehicle in the pool, parked at 999 while idle
  const traffic = buildTraffic(ctx, {
    SIDE_Z0, SIDE_X1,
    lit: props.lit,
    vehicleBox: (b) => { vehicleBoxes.push(b); citAvoid.push(b); return b; },
    peopleAt: () => crowd.walkers(),
  });

  // ── the people on the block ─────────────────────────────────────────────
  //
  // The cast and the walking sim live in ct/crowd.ts. Built HERE, at this
  // exact point in the sequence, because the atlases paint off the shared
  // Math.random stream — moving the call re-grains every texture after it.
  crowd = buildCrowd(ctx, {
    citAvoid,
    solid: (b) => { propColliders.push(b); },
    lit: props.lit,
  });

  // ── the interior belt, built LAST ───────────────────────────────────────
  //
  // Rooms parked far out along +x that you teleport into. Each claims its own
  // slab from ct/interior.ts and registers its own way in and out, so adding
  // one does NOT mean editing this file — which is the whole reason ten of
  // them can be built in parallel.
  //
  // Last on purpose, and it must stay last. GOTCHAS §2 is about the seeded
  // rnd() stream, but the same argument applies to the paint layer's
  // Math.random: the fingerprint harness seeds it, so a module that paints
  // mid-build shifts the grain of every texture painted after it. Built here,
  // ten new interiors add 500 objects to the world and change nothing about
  // the street — which is the only way `fpdiff` can still answer the question
  // it exists to answer while this programme is running.
  const dinerColliders = buildDiner(ctx);

  const colliders: AABB[] = [
    { minX: FACE - 0.3, maxX: FACE + 8, minZ: -96, maxZ: 20 },              // right wall (stops at the corner)
    { minX: -FACE - 8, maxX: -FACE + 0.3, minZ: -112, maxZ: AZ1 },          // left wall south of alley, wraps the corner
    { minX: -FACE - 8, maxX: -FACE + 0.3, minZ: AZ0, maxZ: 20 },            // left wall north of alley
    { minX: 6.8, maxX: SIDE_X1 + 2, minZ: -96.3, maxZ: -92 },               // corner shops, north of the side street
    { minX: -7, maxX: SIDE_X1 + 2, minZ: -113, maxZ: -109.7 },              // south side of the side street
    { minX: SIDE_X1 + 1.7, maxX: SIDE_X1 + 9, minZ: -112, maxZ: -92 },      // east end of the side street
    // the two fruit crates, one box each and no wider than the crate it is.
    // This was a single 2.2 m box spanning the whole canted-bay frontage with
    // the bodega's [E] spot stranded inside it — the reason you could not get
    // into the shop. The crates have moved east, clear of the doorway; if they
    // move again these two must follow, or the door closes itself.
    { minX: 9.74, maxX: 10.36, minZ: -96.56, maxZ: -96.00 },
    { minX: 10.64, maxX: 11.26, minZ: -96.53, maxZ: -95.97 },
    { minX: -FACE - 7.6, maxX: -FACE - 6.2, minZ: AZ1 - 0.5, maxZ: AZ0 + 0.5 }, // alley end wall
    { minX: -12.5, maxX: -9.9, minZ: AZ0 - 1.75, maxZ: AZ0 - 0.55 },        // dumpster
    ...propColliders,
    ...carColliders,
    ...apt.colliders,
    ...bodegaColliders,
    // The east edge of the OLD world, which used to be the `maxX: 260` bound.
    //
    // Moving that bound out to the interior belt quietly un-hid a hole: the
    // bodega's east wall has a gap around z = -21, and sprinting at it now
    // carries you out of the shop and 200 m across the dead ground between
    // the bodega and the first slab. The bound was covering for it. Putting a
    // real wall back where the bound was restores exactly the old behaviour
    // without reaching into `ct/bodega.ts`, which is not this builder's file —
    // the gap itself is reported to the desk in notes/feat-interiors.md.
    { minX: 260, maxX: 262, minZ: -112, maxZ: 20 },
    ...dinerColliders,
    // the traffic pool replaces the single hand-placed cruiser: one box per
    // vehicle, parked at x=999 while idle (see ct/traffic.ts)
    ...vehicleBoxes,
  ];
  // Everything is built by now, so sweep the block into the night registry:
  // the buildings, the ground, the furniture. Anything already registered for
  // the lamplight (cars, people, kerb props) or owned by the rain keeps its
  // own entry — this only picks up what nothing else was tinting, which is
  // most of the world and all of the reason it used to flatten after dark.
  props.dimWorld(scene);

  rig = new FPRig(cam, { x: -1.4, z: 9, yaw: 0 }, {
    // maxX reaches only as far as the interiors actually built — every room
    // is constructed by now, so this is the real east edge, not a reservation
    bounds: { minX: -FACE - 6.4, maxX: interiorMaxX(), minZ: -110.6, maxZ: 13 },
    colliders, speed: 3.3, run: 6.8, bob: 0.045,
    groundY: (x, z) => {
      // the interior belt owns its own floors — each room answers for its
      // slab, so a builder can put a step or a mezzanine in a shop without
      // this file knowing anything about it
      const ig = interiorGround(x, z);
      if (ig !== null) return apt.setGy(ig);
      if (x > 230) return apt.setGy(0);  // bodega interior, flat
      if (x > 100) return apt.ground(x, z);
      // the kerb returns are curved and the corner one ramps — the ground
      // module owns those patches and answers null everywhere else
      const k = ground.gy(x, z);
      if (k !== null) return apt.setGy(k);
      if (z < SIDE_Z0 + 2) { // the corner and the side street
        if (z > SIDE_Z0) return apt.setGy(Math.abs(x) > ROAD_HALF ? KERB_H : 0);
        if (z < SIDE_Z1) return apt.setGy(KERB_H);
        return apt.setGy(x > SIDE_X1 || x < -ROAD_HALF ? KERB_H : 0);
      }
      return apt.setGy(Math.abs(x) > ROAD_HALF && Math.abs(x) < FACE + 0.3 ? KERB_H : 0);
    },
  });

  // debug/tour hook
  // E is one key for the whole world: doors, buying, feeding the birds
  jumpToImpl = (x: number, z: number, yaw: number, gy: number) => {
    rig.pos.set(x, rig.pos.y, z);
    rig.yaw = yaw;
    apt.setGy(gy);
  };
  HOOKS.sort((a, b) => a.order - b.order);

  const jumpTo = jumpToImpl;
  // The walk-up's two spots used to live here. ct/apartment.ts registers them
  // itself now, via ctx.spot — the entry point does not enumerate them.
  SPOTS.push(
    {
      x: 8.7, z: -96.85, r: 1.1,
      ok: () => rig.pos.x < 100,
      label: () => 'into the BODEGA',
      act: () => jumpTo(241.3, -17, Math.PI / 2, 0),
    },
    {
      x: 240.5, z: -17, r: 1.0,
      ok: () => rig.pos.x > 230,
      label: () => 'out to the street',
      // step out onto the north side-street walk, facing OUT across the street —
      // clear of the corner wall + fruit crates, and well outside the re-enter
      // trigger radius so you can't get sucked straight back in (the old bug)
      act: () => jumpTo(11, -97.3, 0, KERB_H),
    },
    {
      x: 242.2, z: -17.5, r: 1.0,
      ok: () => rig.pos.x > 230,
      label: () => purse.cash >= 2.5 ? 'buy cereal — $2.50' : 'cereal $2.50 — you’re short',
      act: () => { if (purse.cash >= 2.5) { purse.cash -= 2.5; purse.inv.CEREAL = (purse.inv.CEREAL ?? 0) + 1; hud.refreshWallet(); } },
    },
    {
      x: 246.9, z: -14.6, r: 1.0,
      ok: () => rig.pos.x > 230,
      label: () => purse.cash >= 1.25 ? 'buy soda — $1.25' : 'soda $1.25 — you’re short',
      act: () => { if (purse.cash >= 1.25) { purse.cash -= 1.25; purse.inv.SODA = (purse.inv.SODA ?? 0) + 1; hud.refreshWallet(); } },
    },
  );

  (window as any).__ct = {
    warp: (x: number, z: number, yaw?: number, gy?: number, pitch?: number) => {
      rig.pos.set(x, rig.pos.y, z);
      if (yaw !== undefined) rig.yaw = yaw;
      if (gy !== undefined) apt.setGy(gy);
      if (pitch !== undefined) rig.pitch = pitch;
    },
    clock: (h: number, m = 0) => { totalMin = h * 60 + m; },
    // test affordance: the 42 is rare on purpose, so put it on the block now
    bus: (z = -20, dir: 1 | -1 = -1) => traffic.bus(z, dir),
    // …and read back what it's doing, so the stop can be verified as motion
    // rather than guessed at from a still
    busInfo: () => traffic.busInfo(),
    // test affordance: every vehicle that is out, and what it is doing —
    // position, heading, speed, lean and steer (scripts/corner-traffic.mjs)
    traffic: () => traffic.info(),
    // test affordance: force a movement through the junction NOW, rather than
    // waiting out a 18–42 s gap between passes
    drive: (route: 'NE' | 'EN' = 'NE', which: 'car' | 'bus' | 'taxi' = 'car', s = 0) => traffic.spawn(route, which, s),
    hermit: (v: boolean | null) => apt.forceHermit(v),
    atlases: () => crowd.atlases(),
    // test affordance: who is on the block, how big and how fast
    people: () => crowd.people(),
    pos: () => [rig.pos.x, rig.pos.y, rig.pos.z, apt.gy()],
    scene: () => scene,   // test affordance: structural fingerprinting (scripts/scenedump.mjs)
  };

  return {
    key: 'crosstown', name: 'CROSSTOWN ’97',
    feel: 'The small world — one hand-made street. We grow it from here.',
    scene, camera: cam, pointerLock: true,
    configure(r) {
      r.toneMapping = THREE.NoToneMapping;
      r.shadowMap.enabled = false;
    },
    update(dt, t, input) {
      rig.update(dt, input);
      const px = rig.pos.x, pz = rig.pos.z;

      // the clock: one real second is one game minute
      totalMin += dt;
      const clockMin = totalMin % 1440;
      const hourF = clockMin / 60;
      const skyCol = hud.skyAt(hourF);
      props.rainSky(skyCol); // rain flattens the light
      (scene.background as THREE.Color).copy(skyCol);
      const night = hud.nightAt(hourF);
      hud.setNight(night);
      // streetlamps warm up on the same night curve (0 by day, full at deep night)
      const lampNight = THREE.MathUtils.clamp((night - 0.03) / 0.28, 0, 1);
      props.setLampNight(lampNight);
      // Fog goes DARKER than the sky once the sun is down. By day it matches,
      // so the street simply fades into the haze; after dark, distance falling
      // toward black instead of toward the sky grey gives depth down the block
      // for free — the far end reads as unlit rather than as bright haze.
      scene.fog!.color.copy(skyCol).multiplyScalar(1 - 0.5 * lampNight);
      // ── registered per-frame hooks ────────────────────────────────────
      // Modules register these; this loop does not know what any of them are.
      // Sorted by declared ORDER at build time, so run order is a property of
      // the hook, not of where the module happened to be constructed.
      const frame: Frame = {
        dt, t, px, pz, gy: apt.gy(),
        hourAbs: Math.floor(totalMin / 60), hourF, night,
      };
      for (const h of HOOKS) h.fn(frame);
      // look down: your watch
      hud.watch(rig.pitch < -0.95, Math.floor(clockMin));
      // right-click: flip the wallet out / away
      const rmb = input.keys.has('rmb');
      if (rmb && !rmbHeld) hud.toggleWallet();
      rmbHeld = rmb;
      // E: nearest live spot wins; with nothing near, E feeds the birds
      let active: Spot | null = null;
      for (const s of SPOTS) {
        if (s.ok() && Math.hypot(px - s.x, pz - s.z) < s.r) { active = s; break; }
      }
      hud.prompt(active ? `[E] ${active.label()}` : null);
      // E dispatch (edge-triggered)
      const feedDown = input.keys.has('e');
      if (feedDown && !feedHeld) {
        if (active) {
          active.act();
        } else if ((purse.inv.CEREAL ?? 0) > 0 && px < 100) {
          purse.inv.CEREAL--;
          props.scatter(px + Math.sin(rig.yaw) * 1.3, pz - Math.cos(rig.yaw) * 1.3, apt.gy());
          hud.refreshWallet();
        }
      }
      feedHeld = feedDown;

      // billboards face the player
      for (const b of boards) {
        b.m.rotation.y = Math.atan2(px - b.m.position.x, pz - b.m.position.z);
      }
      // the crowd walks itself and the traffic drives itself — ct/crowd.ts and
      // ct/traffic.ts each register a LATE frame hook
      // pigeons: peck, chase scattered cereal, spook when approached
      props.updatePigeons(dt, t, px, pz);
    },
  };
}
