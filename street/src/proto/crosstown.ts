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
import { buildSideStreet } from './ct/sidestreet';
import { nudgeClear, corridor, ENTERABLE, PASSABLE } from './ct/gap';
import { buildStreet } from './ct/street';
import { buildWorld, worldRegistrants } from './ct/world';
import { COURT } from './ct/civic';
import { buildCrowd, type Crowd } from './ct/crowd';
import { ORDER, BUILD, type Site, type Board, type CtxBuild, type WetSurface, type Spot, type PlayerRef, type Frame, type FrameHook } from './ct/ctx';
import { buildApartment, SPAWN } from './ct/apartment';
import { makeHud, type Purse } from './ct/hud';
import { buildProps } from './ct/props';
import { interiorGround, interiorMaxX, interiorMaxZ, interiorColliders, interiorRoomIds, interiorRooms } from './ct/interior';
import { publishDeclaredDoors, declaredDoors, doorPointFor, doorStandFor } from './ct/doors';

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
  // The library and churchyard steps are CLIMBABLE, and this is the line that
  // says so. ct/civic.ts leaves the flight SOLID until the entry point asks
  // `courtGround` for the floor — E's call, and the right one: open treads
  // with nothing answering for their height is walking through stone at
  // pavement level, which is worse than what it replaces.
  //
  // It must be set BEFORE buildStreet, which is what places the library and
  // reads this as it draws. Setting it after gets you a picker that reports a
  // 0.99 m landing and a flight you still cannot climb.
  COURT.climbable = true;
  // Every room states where its door is before a single facade is painted —
  // the rooms are built last, so they cannot speak for themselves in time.
  // See ct/doors.ts.
  publishDeclaredDoors();
  // ── pockets, HUD and the [E] register, hoisted ABOVE the builders ──────
  //
  // They used to sit just above `ctx`. ct/street.ts now registers the ATM's own
  // [E] during its build, so the register has to exist before any builder runs.
  // Moved, not changed — same declarations, same values, three lines earlier.
  // (D, for the ATM interaction; flagged, as with the purse field itself.)
  const SPOTS: Spot[] = [];
  const purse: Purse = { cash: 14.5, inv: { CEREAL: 3 } }; // some cash, a box of cereal
  const hud = makeHud(purse);
  // Modules that answer for a patch of floor. Asked in declared order, first
  // non-null wins — see ctx.ground. The entry point no longer names any of
  // them, which is what lets a builder ship a staircase that works.
  //
  // Hoisted for the same reason SPOTS was, and by the same hand: ct/street.ts
  // registers the dished alley paving during its build, so the register has to
  // exist before any builder runs. Moved, not changed. (D; flagged.)
  const GROUNDS: { fn: (x: number, z: number) => number | null; order: number }[] = [];

  const street = buildStreet({ scene, flat, wet, sidewalkY, KERB_H, boards, AZ0, AZ1, SIDE_X1, SIDE_Z0, SIDE_Z1,
    // so ct/street.ts can register the ATM's own [E] and the alley dish's own
    // floor height — D, additive, flagged
    spot: (sp) => { SPOTS.push(sp); }, purse, refreshWallet: () => hud.refreshWallet(),
    ground: (fn, order = BUILD.PROPS) => { GROUNDS.push({ fn, order }); } });
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
  // (GROUNDS is declared above the builders now — see the hoist.)
  // Named ground, published by whoever lays the block out and asked for by
  // name by whoever builds on it. See ctx.ts `Site`.
  const SITES = new Map<string, Site>();
  // every registered seat, for the test harness only — `scripts/seats-walk.mjs`
  // sits on all of them. Six different owners will be registering furniture
  // through ctx.seat(); none of them can verify it without being able to
  // enumerate what got registered.
  const SEATS: { pose: { x: number; z: number; yaw: number; h: number };
    at: { x: number; z: number }; r: number; label: string }[] = [];
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
  // ── the pockets, and the HUD that draws them ────────────────────────────
  //
  // Declared above the BUILDERS now, not merely above ctx — see the hoist.

  const ctx: CtxBuild = {
    scene, flat, wet, obstacle, boards, wetMats, sidewalkY, KERB_H,
    spot: (sp) => { SPOTS.push(sp); },
    purse,
    refreshWallet: () => hud.refreshWallet(),
    ground: (fn, order = BUILD.PROPS) => { GROUNDS.push({ fn, order }); },
    site: (name) => SITES.get(name) ?? null,
    publishSite: (name, st) => { SITES.set(name, st); },
    // ── seats ───────────────────────────────────────────────────────────
    //
    // A seat is TWO ordinary spots: one to sit, one to stand. Building it out
    // of the existing interaction registry rather than adding a parallel one
    // means the E dispatch below does not change at all, and a seat behaves
    // like every other prompt in the world for free.
    //
    // The pairing is what keeps it honest. `sit` is dead while you are seated
    // — every seat's is, so no seat can be hopped to from another — and
    // `stand` is live only for the seat you are actually on, which it knows
    // by identity, not by position.
    seat: (s) => {
      const pose = { x: s.x, z: s.z, yaw: s.yaw, h: s.h };
      const at = s.approach ?? { x: s.x, z: s.z };
      SEATS.push({ pose, at, r: s.r ?? 0.75, label: s.label ?? 'sit down' });
      SPOTS.push({
        x: at.x, z: at.z, r: s.r ?? 0.75,
        ok: () => !rig.seated && (s.ok ? s.ok() : true),
        label: () => s.label ?? 'sit down',
        act: () => rig.sit(pose),
      });
      SPOTS.push({
        // centred on the SEAT, because that is where you are while on it
        x: s.x, z: s.z, r: 0.5,
        ok: () => rig.seatedOn === pose,
        label: () => 'stand up',
        act: () => rig.stand(),
      });
    },
    onFrame: (fn, order = ORDER.PROPS) => { HOOKS.push({ fn, order }); },
    player,
    clock: {
      now: () => ({ hour: Math.floor((totalMin % 1440) / 60), minute: Math.floor(totalMin % 60),
        totalMin }),
      advance: (minutes: number, opts?: { overSeconds?: number }) => {
        if (!(minutes > 0)) return;
        const over = opts?.overSeconds ?? 1.5;
        if (over <= 0) { totalMin += minutes; return; }
        clockRamp += minutes;
        clockRampRate = Math.max(clockRampRate, minutes / over);
      },
    },
  };
  const apt = buildApartment(ctx);

  // ── the clock ───────────────────────────────────────────────────────────
  let totalMin = 13 * 60 + 20; // one real second = one game minute
  // A RAMP, not a jump. `ctx.clock.advance` adds to this and the sim drains it
  // a slice per frame, so everything that reads the clock fresh — the sky
  // curve, the night wash, the lamps, the rain schedule — sweeps instead of
  // cutting, and none of them needs to know a sleep happened. Snapping is what
  // would fight them.
  let clockRamp = 0;          // game minutes still owed
  let clockRampRate = 0;      // game minutes per real second
  let rmbHeld = false;
  let feedHeld = false;


  // ── the block's furniture, and the weather over it ─────────────────────
  // ── everything the block cleared ground for ─────────────────────────────
  //
  // `buildStreet` opens the sites and publishes their extents; the modules
  // that fill them ask for them by name. Until ct/street.ts publishes these
  // itself, this file relays the two it already receives — the relay it
  // replaces is the desk copying a z-span out of D's roster by hand, which
  // failed twice.
  ctx.publishSite('park', street.park);
  ctx.publishSite('lot', street.lot);
  // Modules are found by `ct/world.ts` and run in ORDER bands. This band sits
  // exactly where buildPark/buildLot were called, so construction order — and
  // therefore every tree height and pigeon in the world — is unchanged.
  buildWorld(ctx, 0, BUILD.PROPS - 1);

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
  const carColliders: AABB[] = [];
  // …and the fleet itself, because the gap rule cannot be finished here: half the
  // things a car might trap you against are registered by modules built LATER.
  // See settleParking() at the bottom of the build.
  const parkedFleet: { car: THREE.Group; cb: AABB; half: number; kind: CarKind }[] = [];
  const carHalf: Record<CarKind, number> = { sedan: 2.4, hatch: 2.05, pickup: 2.6, van: 2.45 };
  // ── nobody parks across an alley mouth ──────────────────────────────────
  //
  // The truck stood on the west kerb at z0 = -33, and the draw below spreads
  // each car ±1.2 m off its nominal spot — so its tail reached z = -36.8, half
  // a metre off the alley gap at AZ0 = -37, and it closed the sight line into
  // the alley where the dumpster, the cat and the graffiti are.
  //
  // The arrangement is DRAWN now, not hand-placed, so the fix is to move the
  // CONSTRAINT and let the draw keep its spread: the nominal spot is derived as
  // the closest the truck can stand north of the mouth with its whole body, the
  // full spread, and a sight line, all clear of it. Hand-placing a new z here
  // would just be a different fixed arrangement.
  const ALLEY_SIGHT = 2.5;                      // clear space off the mouth
  const PARK_SPREAD = 2.4;                      // the ±1.2 m the draw applies
  const truckZ0 = AZ0 + ALLEY_SIGHT + carHalf.pickup + PARK_SPREAD / 2;
  // kind, colour, which kerb, roughly where
  const parked: [CarKind, number, number, number][] = [
    ['sedan', 1, 1, -13],
    ['pickup', 3, -1, truckZ0],
    ['hatch', 5, 1, -49],
  ];
  parked.forEach(([kind, ci, side, z0], pi) => {
    const cls = PARK_CLASS[pi % PARK_CLASS.length];
    const gap = Math.min(parkGap(cls), PARK_SNUG - PARK_OUT);
    const x = side * (PARK_SNUG - gap);
    const zDrawn = z0 + (rnd() - 0.5) * 2.4;    // and they don't sit on a rhythm
    // ── never leave a gap the player can enter but not leave ──────────────
    //
    // The drawn spot is kept unless it makes a corridor 0.40–0.95 m wide against
    // something already solid — a kerb prop, a tree pit, the bus bench, the car
    // in front. Then it takes the NEAREST legal spot instead, so the spread the
    // distribution chose survives and only the trap is removed. See ct/gap.ts;
    // hand-placing a fixed offset back would just be a different arrangement,
    // and the trap moves with the draw anyway.
    const box = (zz: number) => ({
      minX: x - 1.05, maxX: x + 1.05, minZ: zz - carHalf[kind], maxZ: zz + carHalf[kind],
    });
    // reach 4.5 m, not the 3 m default: a kerb prop's z-span has to be cleared
    // ENTIRELY to remove an x-corridor between it and the car beside it, and a
    // 5.2 m truck against a prop mid-block needs most of its own length to do
    // that. The nearest legal spot is still taken, so the spread survives.
    const fit = nudgeClear(zDrawn, box, [...propColliders, ...carColliders], 4.5);
    if (!fit.ok) console.warn(`[parking] ${kind} at z=${zDrawn.toFixed(2)} leaves a trap-band gap and no clear spot within 3 m`);
    const z = fit.at;
    const ry = (side > 0 ? 0 : Math.PI) + parkYaw(cls);
    const car = makeCar(kind, ci);
    car.position.set(x, 0, z);
    car.rotation.y = ry;
    scene.add(car);
    props.lit(car);          // parked in a lamp pool? then it catches it
    const cb = box(z);
    carColliders.push(cb); citAvoid.push(cb);
    parkedFleet.push({ car, cb, half: carHalf[kind], kind });
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
    SIDE_Z0, SIDE_Z1, SIDE_X1,
  });

  // ── the interior belt, built LAST ───────────────────────────────────────
  //
  // Rooms parked far out along +x that you teleport into. Each claims its own
  // slab from ct/interior.ts and registers its own way in and out, so adding
  // one does NOT mean editing this file — which is the whole reason ten of
  // them can be built in parallel.
  //
  // Last on purpose, and it must stay last.
  //
  // GOTCHAS §2 is about the seeded rnd() stream. The same argument applies,
  // harder, to the paint layer's Math.random — which the fingerprint harness
  // seeds. And it is not only `dither()` that draws from it: three.js burns
  // FOUR Math.random calls per object in `generateUUID`, so under the harness
  // every mesh, material and texture you CREATE shifts the grain of every
  // texture painted after it. Build a room in the middle and you repaint half
  // the block.
  //
  // Built here, after the last street object exists, ten interiors can add a
  // thousand objects and the street's fingerprint does not move — which is the
  // only reason it can still answer the question it exists to answer while
  // this programme is running. (Interiors do reshuffle each OTHER's grain;
  // that is harmless, because the shipped world's Math.random is unseeded and
  // repaints every load anyway.)
  // Adding a room is NO lines here. `buildAllInteriors` finds every
  // `ct/int-*.ts` and builds it, so writing the file is what puts the room in
  // the world — see the note on that function for the three rooms that sat
  // finished and unreachable because this used to be a hand-maintained list.
  // Colliders come back through `interiorColliders()`, spread once below.
  buildWorld(ctx, BUILD.PROPS, 99);


  // ── the side street's furniture — trees and parked cars ─────────────────
  //
  // AFTER the interior belt on purpose, and the reason is the paragraph above.
  // These are street objects, so they belong with the street belt by rights —
  // but creating a mesh burns Math.random in `generateUUID`, so a module placed
  // in the middle re-grains every texture painted after it. Built here, after
  // everything else that paints, it re-grains NOTHING: the fingerprint against
  // mainline comes back as pure additions, which is the only way to show that
  // adding content did not disturb the block. Still before `dimWorld` below, so
  // the trees and cars go dark after sunset with the rest of the world.
  //
  // If this ever needs to move earlier, expect the interiors' grain to shift —
  // harmless in the shipped world (Math.random is unseeded there and repaints
  // every load) but it will make the next refactor's fingerprint unreadable.
  buildSideStreet(ctx, { SIDE_Z0, SIDE_Z1, lit: props.lit });

  const colliders: AABB[] = [
    // The block's collision comes from the modules that DRAW it, not from
    // rectangles written here. This used to be two blanket walls spanning the
    // whole street, plus one across the corner shops, and because they knew
    // nothing about the buildings they described, collision could not follow
    // geometry: they walled off E's library courtyard and squared off the
    // bodega's canted corner. ct/street.ts now registers a real footprint per
    // building as it places it — following the chamfer, leaving the alley
    // mouth open, and skipping the library entirely so ct/civic.ts's own
    // colliders are the only thing there.
    ...street.colliders,
    ...COURT.colliders,
    { minX: SIDE_X1 + 1.7, maxX: SIDE_X1 + 9, minZ: -112, maxZ: -92 },      // east end of the side street
    ...propColliders,
    ...carColliders,
    ...apt.colliders,
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
    ...interiorColliders(),
    // the traffic pool replaces the single hand-placed cruiser: one box per
    // vehicle, parked at x=999 while idle (see ct/traffic.ts)
    ...vehicleBoxes,
  ];
  // Everything is built by now, so sweep the block into the night registry:
  // the buildings, the ground, the furniture. Anything already registered for
  // the lamplight (cars, people, kerb props) or owned by the rain keeps its
  // own entry — this only picks up what nothing else was tinting, which is
  // most of the world and all of the reason it used to flatten after dark.
  // ── settle the parking, now that everything solid exists ────────────────
  //
  // The dangerous-gap rule was applied when each car was drawn, and that was too
  // early: props.ts's kerb furniture is in place by then, but the park, the car
  // lot, the side street and the interiors all register obstacles AFTER, so a
  // car could be nudged clear of everything that existed and still end up 0.78 m
  // from a bin planted later. That is exactly what shipped — the probe found two,
  // and the build logged no warning because at the time it looked fine.
  //
  // So the rule runs again here, against the FINISHED world, and moves the car
  // and its collider together. Same nudge, same nearest-legal-spot behaviour, so
  // the drawn spread still survives.
  for (const p of parkedFleet) {
    // against EVERY solid box in the world, not just propColliders: the one that
    // caught us out belongs to a module that hands back its own collider list
    // (the walls, the walk-up, the bodega, the interiors) and never goes through
    // ctx.obstacle at all, so a check against propColliders cannot see it. That
    // is why the first version of this pass reported success and shipped a trap.
    const others = colliders.filter((b) => b !== p.cb);
    const z0 = p.car.position.z;
    const at = (zz: number) => ({
      minX: p.cb.minX, maxX: p.cb.maxX, minZ: zz - p.half, maxZ: zz + p.half,
    });
    const fit = nudgeClear(z0, at, others, 4.5);
    if (!fit.ok) {
      console.warn(`[parking] ${p.kind} at z=${z0.toFixed(2)} still leaves a trap-band gap`);
      continue;
    }
    if (fit.moved !== 0) {
      p.car.position.z = fit.at;
      p.cb.minZ = fit.at - p.half; p.cb.maxZ = fit.at + p.half;
    }
  }

  props.dimWorld(scene);

  // YOU WAKE UP IN YOUR ROOM. "also make me spawn in my room" — the coordinate
  // is not typed here, it is `SPAWN` in ct/apartment.ts, derived from that
  // building's own APT_X0/APT_Z0/ST0 so it follows the walk-up if it ever moves.
  // A copy of it here would be the exact defect the checks sweep for.
  //
  // SET THE FLOOR FIRST. This is the whole reason `SPAWN` carries a `gy` and
  // not just x/z/yaw: `aptGround` picks the storey nearest the LAST height and
  // refuses to step up more than 0.6 m (ct/apartment.ts, "no stepping up half a
  // storey"). With `lastGy` still 0, the first ground query from three storeys
  // up finds the lobby slab, not room 301's — you would spawn at the right
  // x/z and fall through to the ground floor. Seeding the picker means the
  // hysteresis starts settled on the floor you are actually standing on.
  apt.setGy(SPAWN.gy);
  rig = new FPRig(cam, { x: SPAWN.x, z: SPAWN.z, yaw: SPAWN.yaw }, {
    // maxX reaches only as far as the interiors actually built — every room
    // is constructed by now, so this is the real east edge, not a reservation
    // The west bound is DERIVED from the sites the street opened, not typed.
    //
    // It was -FACE - 6.4 = -13.40, right when the deepest thing off the block
    // was an alley. D deepened the park to 32 m and nothing followed: you walk
    // in, stop dead at -13.40, and the lamps, the trees, the benches and the
    // loop are all in front of you and unreachable. The user has only ever
    // seen the first seven metres of it, which is what "the shittiest park ive
    // ever seen" was actually describing. E flagged the shape of it before the
    // depth landed — "deepening the site alone builds a park you can see and
    // not enter".
    //
    // A fix landed in parallel with this one, hard-coding -FACE - 33 to clear
    // the park's rear wall at -39, having walked the whole west side at 1.5 m
    // intervals to confirm nothing else out there becomes reachable — west of
    // the building line every metre is already spoken for by a shell's own
    // footprint, so the clamp never stopped you anywhere except the park.
    // That check holds and is worth keeping written down. The number is
    // derived rather than typed because that is the part that cannot go stale:
    // the next site to deepen would need someone to remember this line again.
    // maxZ ASKS THE BELT, the way maxX always has. 13 is the end of the
    // street; a room deeper than 26 m reaches past it and the player was
    // clamped short of its own front wall, unable to reach the way-out spot at
    // `hd - 0.55`. Measured by G on the casino at d 30 (BLOCKED-G 1b).
    bounds: { minX: westBound(), maxX: interiorMaxX(), minZ: -110.6,
      maxZ: Math.max(13, interiorMaxZ()) },
    colliders, speed: 3.3, run: 6.8, bob: 0.045,
    groundY: (x, z) => groundPick(x, z),
  });

  /** How far west the world goes: past the deepest open site, or past the
   *  building line if there are none. The 1.2 m is the same cushion the old
   *  constant carried past the alley. */
  function westBound(): number {
    let deepest = -FACE - 6.4;
    for (const st of [street.park, street.lot]) {
      if (st && st.minX < deepest) deepest = st.minX;
    }
    return deepest - 1.2;
  }

  function groundPick(x: number, z: number): number {
    {
      // whoever registered themselves, in declared order
      for (const g of GROUNDS) {
        const y = g.fn(x, z);
        if (y !== null) return apt.setGy(y);
      }
      // the interior belt owns its own floors — each room answers for its
      // slab, so a builder can put a step or a mezzanine in a shop without
      // this file knowing anything about it
      const ig = interiorGround(x, z);
      if (ig !== null) return apt.setGy(ig);
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
      // The open sites — the park and the car lot — are paved at KERB_H and
      // reach 7-8 m back, past where the rule below stops answering. Same
      // problem as the courtyard, same answer: the module that owns the ground
      // says how high it is and this reads it off one value per site.
      for (const st of [street.park, street.lot]) {
        if (x >= st.minX && x <= st.maxX && z >= st.minZ && z <= st.maxZ) return apt.setGy(st.y);
      }
      // The library courtyard is paved at KERB_H and reaches back well past
      // FACE + 0.3, where the rule below stops answering — walk into it and
      // the floor drops away. ct/civic.ts publishes its extents and its paving
      // level for exactly this, so the notch and the floor come off ONE import
      // instead of being restated here.
      return apt.setGy(Math.abs(x) > ROAD_HALF && Math.abs(x) < FACE + 0.3 ? KERB_H : 0);
    }
  }

  // debug/tour hook
  // E is one key for the whole world: doors, buying, feeding the birds
  jumpToImpl = (x: number, z: number, yaw: number, gy: number) => {
    // Get up first. A door or a till within reach of a chair would otherwise
    // teleport you across the world still sitting on furniture you left
    // behind — and `stand()` would then try to put you back on a spot in the
    // room you have just left. No seat is currently that close to a door;
    // this is here so that the first one somebody registers is not a bug.
    if (rig.seated) rig.stand();
    rig.pos.set(x, rig.pos.y, z);
    rig.yaw = yaw;
    apt.setGy(gy);
  };
  HOOKS.sort((a, b) => a.order - b.order);
  GROUNDS.sort((a, b) => a.order - b.order);

  const jumpTo = jumpToImpl;
  // The walk-up's two spots used to live here. ct/apartment.ts registers them
  // itself now, via ctx.spot — the entry point does not enumerate them.
  // The hand-written SPOTS block is GONE. Every `[E]` in the world is now
  // registered by the module that draws the thing you press it on — the last
  // two were the bodega's counters, and they went home to ct/bodega.ts once
  // ctx started carrying the purse.

  (window as any).__ct = {
    warp: (x: number, z: number, yaw?: number, gy?: number, pitch?: number) => {
      rig.pos.set(x, rig.pos.y, z);
      if (yaw !== undefined) rig.yaw = yaw;
      if (gy !== undefined) apt.setGy(gy);
      if (pitch !== undefined) rig.pitch = pitch;
    },
    clock: (h: number, m = 0) => { totalMin = h * 60 + m; clockRamp = 0; clockRampRate = 0; },
    // test affordance for the ctx.clock verb, the same way colliders() and
    // groundAt() expose their registries — a capability nobody can drive from
    // a harness is a capability nobody can prove works.
    advanceClock: (minutes: number, overSeconds?: number) => {
      if (!(minutes > 0)) return;
      const over = overSeconds ?? 1.5;
      if (over <= 0) { totalMin += minutes; return; }
      clockRamp += minutes;
      clockRampRate = Math.max(clockRampRate, minutes / over);
    },
    clockNow: () => ({ hour: Math.floor((totalMin % 1440) / 60),
      minute: Math.floor(totalMin % 60), totalMin }),
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
    drive: (route: 'NE' | 'EN' = 'NE', which: 'car' | 'bus' | 'taxi' = 'car', s = 0, add = false) => traffic.spawn(route, which, s, add),
    // test affordance: stand one car of any kind and any CarState in front of
    // the player, for scripts/carstate.mjs. Builds nothing at load time.
    carVariant: (kind: CarKind = 'sedan', state: Record<string, unknown> = {}, x = 0, z = 0, ry = 0) => {
      const c = makeCar(kind, 3, false, state as never);
      c.position.set(x, 0, z); c.rotation.y = ry;
      c.userData.probe = true;
      scene.add(c);
      return c;                    // the OBJECT: a count tells a probe nothing it can check
    },
    hermit: (v: boolean | null) => apt.forceHermit(v),
    atlases: () => crowd.atlases(),
    // test affordance: who is on the block, how big and how fast
    people: () => crowd.people(),
    // test affordance: which painted angle each person is showing, mirrored or
    // not, so the profile feet can be checked against travel (scripts/feet-check.mjs)
    views: () => crowd.views(),
    // test affordance: where everybody is standing, for the routing probe
    walkers: () => crowd.walkers(),
    // test affordance: route two named nodes of the walkable network
    netRoute: (a: string, b: string) => crowd.netRoute(a, b),
    // test affordance: THE dangerous-gap predicate, so scripts/gaps.mjs asks the
    // same code the parked draw is constrained by. It had its own copy and the
    // two disagreed about a near-degenerate pair — which is the only reason that
    // corridor was ever in doubt. One implementation, no drift.
    gapRule: () => ({ ENTERABLE, PASSABLE }),
    corridor: (a: AABB, b: AABB) => corridor(a, b),
    // paint any Look — how notes/CITIZEN-STYLE.md's contact sheet is made
    person: (look: any) => crowd.paint(look),
    pos: () => [rig.pos.x, rig.pos.y, rig.pos.z, apt.gy()],
    // test affordance: "is my [E] spot inside something solid?" is the single
    // most expensive question in this project — GOTCHAS §8, and the reason the
    // bodega was un-enterable — and it was previously only answerable by
    // bisecting the walk with the player. Read-only view of the live list.
    colliders: () => colliders,
    rooms: () => interiorRoomIds(),
    // resolved room geometry, so a harness never carries its own copy
    roomDims: () => interiorRooms(),
    modules: () => worldRegistrants(),
    // test affordance, like colliders() and seats(): every registered [E], so
    // scripts/spots-walk.mjs can check the whole set rather than the ones
    // somebody remembered. Labels are evaluated, which is why they come back
    // as strings and not thunks.
    // Every declared door as tooling sees it: world point, outward normal, and
    // the spot you stand on. `__frontages` is A's and covers flat shopfronts
    // only, so the BODEGA — whose door is on a canted bay and is deliberately
    // never handed to the painter — was invisible to anything auditing doors.
    // Recorded as "tooling only, costs a player nothing", which is true and is
    // also how the bodega's own misalignment went unnoticed for so long.
    doors: () => declaredDoors().map((d) => ({
      building: d.building, chamfer: !!d.face,
      point: doorPointFor(d.building), stand: doorStandFor(d.building),
      widthM: d.width ?? null,
    })),
    spots: () => SPOTS.map((sp) => ({ x: sp.x, z: sp.z, r: sp.r, label: sp.label(), ok: sp.ok() })),
    seats: () => SEATS,
    camY: () => cam.position.y,
    yaw: () => rig.yaw,
    // test affordance: read the floor picker directly, without moving anybody
    groundAt: (x: number, z: number) => groundPick(x, z),
    seated: () => (rig.seated ? rig.seatedOn : null),
    stand: () => rig.stand(),
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
      // …plus any ramped advance somebody asked for. Drained at a bounded rate
      // so a sleep sweeps the night curve rather than cutting through it.
      if (clockRamp > 0) {
        const slice = Math.min(clockRamp, clockRampRate * dt);
        totalMin += slice;
        clockRamp -= slice;
        if (clockRamp <= 0.001) { clockRamp = 0; clockRampRate = 0; }
      }
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
      // and the flats above the shops light up on a curve of their own — the
      // block keeps people's hours, not the sun's (ct/street.ts owns the shape)
      street.setWindows(hourF);
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
        // props.ts owns the drying model and publishes the result here each
        // frame; this reads it rather than keeping a second copy, so there is
        // still exactly one writer.
        wet: (scene.userData.wetness as number | undefined) ?? 0,
      };
      for (const h of HOOKS) h.fn(frame);
      // look down: your watch
      hud.watch(rig.pitch < -0.95, Math.floor(clockMin));
      // right-click: flip the wallet out / away
      const rmb = input.keys.has('rmb');
      if (rmb && !rmbHeld) hud.toggleWallet();
      rmbHeld = rmb;
      // E: nearest live spot wins; with nothing near, E feeds the birds
      //
      // It said "nearest" and did FIRST-REGISTERED — the loop broke on the
      // first spot in range, so with two triggers overlapping you got whichever
      // module happened to build earlier, however far away it was. Three cases
      // were live: standing exactly on the second of two diner booths offered
      // the first, 0.67 m away, and the bus stop bench did the same at 0.9 m.
      // You walk to a seat, press E, and sit down in the one next to it.
      //
      // Found by asking whether any two spot radii overlap at all (171 pairs
      // do; all but three are a seat and its own "stand up", which are
      // mutually exclusive through ok()). Kept as an assertion in
      // scripts/seats-walk.mjs: stand ON a seat, and that is the seat offered.
      let active: Spot | null = null;
      let best = Infinity;
      for (const s of SPOTS) {
        if (!s.ok()) continue;
        const d = Math.hypot(px - s.x, pz - s.z);
        if (d < s.r && d < best) { active = s; best = d; }
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
