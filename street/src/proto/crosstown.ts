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
import { L, ROAD_HALF, WALK, FACE, PARK_X, DRIVE_X, FOG_NEAR, FOG_FAR, rnd } from './ct/rng';
import { pixTex } from './ct/paint';
import { asphaltTex } from './ct/tex-world';
import { buildGround } from './ct/tex-ground';
import { type CarKind, makeCar, makeBus } from './ct/cars';
import { buildBodega } from './ct/bodega';
import { buildStreet } from './ct/street';
import { type Fit, citizenAtlas, viewFor } from './ct/citizens';
import { type Board, type CtxBuild, type WetSurface } from './ct/ctx';
import { buildApartment } from './ct/apartment';
import { makeHud, type Purse } from './ct/hud';
import { buildProps } from './ct/props';

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
  const ctx: CtxBuild = { scene, flat, wet, obstacle, boards, wetMats, sidewalkY, KERB_H };
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

  // parked cars — a mixed fleet in the parking lanes, parked by PEOPLE.
  // Four cars sitting at exactly ±PARK_X with 0.02 rad of yaw read as a
  // machined row, so: the distance off the kerb varies by ~0.3 m, the yaw
  // spread is up to 0.1 rad and not all one way, and the gaps between them
  // are deliberately uneven. The hatch is the badly-parked one — out from
  // the kerb AND crooked — because one obvious offender does more than
  // nudging all four. Nobody parks in the hydrant's red zone (z -9.5…-2.5).
  //
  // Hard limit: |x| + 1.05 (the collider half-width) must stay under
  // ROAD_HALF, or a parked car's box lands on the sidewalk.
  const parked: [CarKind, number, number, number, number][] = [
    ['sedan', 1, PARK_X + 0.03, -13, 0.035],          // snug to the kerb, near square
    ['pickup', 3, -(PARK_X - 0.10), -33, Math.PI - 0.075], // a touch out, nose in
    ['hatch', 5, PARK_X - 0.27, -49, -0.10],          // the offender: out and crooked
    ['van', 2, -(PARK_X + 0.02), -78, Math.PI + 0.025], // tucked in tight
  ];
  const carColliders: AABB[] = [];
  const carHalf: Record<CarKind, number> = { sedan: 2.4, hatch: 2.05, pickup: 2.6, van: 2.45 };
  parked.forEach(([kind, ci, x, z, ry]) => {
    const car = makeCar(kind, ci);
    car.position.set(x, 0, z);
    car.rotation.y = ry;
    scene.add(car);
    props.lit(car);          // parked in a lamp pool? then it catches it
    const cb = { minX: x - 1.05, maxX: x + 1.05, minZ: z - carHalf[kind], maxZ: z + carHalf[kind] };
    carColliders.push(cb); citAvoid.push(cb);
  });
  // traffic: one vehicle on the block at a time, entering from a foggy end,
  // driving through, and leaving. Usually a plain car; the taxi is a rare
  // sight and the 42 bus rarer still — roughly one pass in nine.
  const plain = [makeCar('sedan', 2), makeCar('hatch', 4), makeCar('van', 5), makeCar('sedan', 3)];
  const taxi = makeCar('sedan', 0, true);
  const bus = makeBus();
  const traffic = [...plain, taxi, bus];
  traffic.forEach((c) => { c.visible = false; scene.add(c); props.lit(c); });
  let cruiser = traffic[0];
  let cruiseDir = -1;
  let cruiseWait = 5; // gap between cars
  // the 42 actually calls at the stop. Only SOUTHBOUND: the doors are on the
  // bus's local +x, which is the east kerb only when it faces -z, and the
  // stop is on the east walk. A northbound bus is serving the other side of
  // the route and sails past — the pair stop across the street isn't built.
  const STOP_FLAG_Z = -33.5;                       // the flag pole (ct/props.ts)
  const BUS_STOP_Z = STOP_FLAG_Z - (bus.userData.doorZ as number); // centre when the door lines up
  let cruiseSpd = 0;      // eased, so the bus brakes and pulls away smoothly
  let busDwell = 0;       // seconds left standing at the stop
  let busServed = false;  // this run has already called
  const cruiserBox: AABB = { minX: 999, maxX: 999, minZ: 999, maxZ: 999 };
  citAvoid.push(cruiserBox); // the moving car, too — its box follows it each frame

  // 8-angle citizens walking the block — no two the same size or style
  interface Outfit { j: string; p: string; s: string; h: string; fit: Fit; acc: string; hs: number; ws: number }
  const OUTFITS: Outfit[] = [
    { j: '#3a4a63', p: '#2b2f36', s: '#c9946a', h: '#241a10', fit: 'plain', acc: '', hs: 1.0, ws: 1.0 },
    { j: '#7a3a34', p: '#3f4650', s: '#b8845a', h: '#101010', fit: 'cap', acc: '#8a3a2e', hs: 1.08, ws: 1.04 },
    { j: '#3f5a46', p: '#3f5a46', s: '#d9a97c', h: '#8c5a2e', fit: 'dress', acc: '', hs: 0.94, ws: 0.96 },
    { j: '#5c5266', p: '#2b2f36', s: '#c9946a', h: '#3a2c20', fit: 'hoodie', acc: '', hs: 1.12, ws: 1.08 },
    { j: '#6a5a3a', p: '#23262c', s: '#b8845a', h: '#d9c25a', fit: 'plain', acc: '', hs: 0.9, ws: 0.94 },
    { j: '#37505e', p: '#2b2f36', s: '#d9a97c', h: '#1c1410', fit: 'cap', acc: '#2c4a7a', hs: 1.02, ws: 1.0 },
    { j: '#6e3a5a', p: '#6e3a5a', s: '#e0b088', h: '#4a2c18', fit: 'dress', acc: '', hs: 1.05, ws: 0.98 },
    { j: '#2f4a4a', p: '#3f4650', s: '#b8845a', h: '#5a3a24', fit: 'hoodie', acc: '', hs: 0.96, ws: 1.06 },
  ];
  interface Citizen { mesh: THREE.Mesh; tex: THREE.Texture; lane: number; home: number; z: number; dir: number; sp: number; ph: number; box: AABB; stuck: number; ghost: boolean; anim: number }
  const citizens: Citizen[] = [];
  // a quiet block: four out on the street at a time, one of each fit
  const CAST = [OUTFITS[0], OUTFITS[1], OUTFITS[2], OUTFITS[3]];
  CAST.forEach((o, i) => {
    const tex = citizenAtlas(o.j, o.p, o.s, o.h, o.fit, o.acc);
    tex.repeat.set(1 / 5, 1 / 2);
    const geo = new THREE.PlaneGeometry(0.95, 1.9);
    geo.translate(0, 0.95, 0);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }));
    mesh.scale.set(o.ws, o.hs, 1);
    // home lanes sit in the clear strip between the kerb props and the wall
    const lane = (i % 2 ? 1 : -1) * (ROAD_HALF + 1.05 + (i % 3) * 0.17);
    const z = 2 - i * 23; // spread thin over the whole block
    mesh.position.set(lane, sidewalkY, z);
    scene.add(mesh);
    props.lit(mesh);         // people walk through the pools too
    // ±0.25, not ±0.30: bodies read the tiniest bit too wide to slip past.
    // With the rig's 0.36 m radius that puts the gap needed to squeeze by a
    // person at 0.61 m instead of 0.72 m.
    const box: AABB = { minX: lane - 0.25, maxX: lane + 0.25, minZ: z - 0.25, maxZ: z + 0.25 };
    propColliders.push(box); // people are solid — the box follows them
    citizens.push({ mesh, tex, lane, home: lane, z, dir: i % 2 ? 1 : -1, sp: 0.85 + (i % 4) * 0.3, ph: i * 1.3, box, stuck: 0, ghost: false, anim: i * 1.3 });
  });

  const colliders: AABB[] = [
    { minX: FACE - 0.3, maxX: FACE + 8, minZ: -96, maxZ: 20 },              // right wall (stops at the corner)
    { minX: -FACE - 8, maxX: -FACE + 0.3, minZ: -112, maxZ: AZ1 },          // left wall south of alley, wraps the corner
    { minX: -FACE - 8, maxX: -FACE + 0.3, minZ: AZ0, maxZ: 20 },            // left wall north of alley
    { minX: 6.8, maxX: SIDE_X1 + 2, minZ: -96.3, maxZ: -92 },               // corner shops, north of the side street
    { minX: -7, maxX: SIDE_X1 + 2, minZ: -113, maxZ: -109.7 },              // south side of the side street
    { minX: SIDE_X1 + 1.7, maxX: SIDE_X1 + 9, minZ: -112, maxZ: -92 },      // east end of the side street
    { minX: 7.5, maxX: 9.7, minZ: -96.9, maxZ: -96.2 },                     // bodega fruit crates
    { minX: -FACE - 7.6, maxX: -FACE - 6.2, minZ: AZ1 - 0.5, maxZ: AZ0 + 0.5 }, // alley end wall
    { minX: -12.5, maxX: -9.9, minZ: AZ0 - 1.75, maxZ: AZ0 - 0.55 },        // dumpster
    ...propColliders,
    ...carColliders,
    ...apt.colliders,
    ...bodegaColliders,
    cruiserBox,
  ];
  const rig = new FPRig(cam, { x: -1.4, z: 9, yaw: 0 }, {
    bounds: { minX: -FACE - 6.4, maxX: 260, minZ: -110.6, maxZ: 13 },
    colliders, speed: 3.3, run: 6.8, bob: 0.045,
    groundY: (x, z) => {
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
  interface Spot { x: number; z: number; r: number; label: () => string; ok: () => boolean; act: () => void }
  const jumpTo = (x: number, z: number, yaw: number, gy: number) => {
    rig.pos.set(x, rig.pos.y, z);
    rig.yaw = yaw;
    apt.setGy(gy);
  };
  const SPOTS: Spot[] = [
    {
      x: FACE - 0.45, z: -44, r: 1.05,
      ok: () => rig.pos.x < 100 && apt.gy() < 1,
      label: () => 'enter THE WHITMORE',
      act: () => jumpTo(apt.AX(1.2), apt.AZI(1.3), Math.PI, 0),
    },
    {
      x: apt.AX(1.2), z: apt.AZI(0.4), r: 0.95,
      ok: () => rig.pos.x > 100 && rig.pos.x < 230 && apt.gy() < 0.5,
      label: () => 'out to the street',
      act: () => jumpTo(FACE - 1.1, -44, -Math.PI / 2, KERB_H),
    },
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
  ];

  (window as any).__ct = {
    warp: (x: number, z: number, yaw?: number, gy?: number, pitch?: number) => {
      rig.pos.set(x, rig.pos.y, z);
      if (yaw !== undefined) rig.yaw = yaw;
      if (gy !== undefined) apt.setGy(gy);
      if (pitch !== undefined) rig.pitch = pitch;
    },
    clock: (h: number, m = 0) => { totalMin = h * 60 + m; },
    // test affordance: the 42 is rare on purpose, so put it on the block now
    bus: (z = -20, dir: 1 | -1 = -1) => {
      cruiser = bus;
      cruiseDir = dir;
      const lx = (bus.userData.laneX ?? DRIVE_X) as number;
      cruiser.position.set(dir === -1 ? lx : -lx, 0, z);
      cruiser.rotation.y = dir === -1 ? 0 : Math.PI;
      cruiser.visible = true;
      cruiseWait = 0;
      cruiseSpd = (bus.userData.speed ?? 8.5) as number;
      busDwell = 0; busServed = false;
      bus.userData.setDoors(false);
    },
    // …and read back what it's doing, so the stop can be verified as motion
    // rather than guessed at from a still
    busInfo: () => [bus.position.x, bus.position.z, cruiseSpd, busDwell, busServed ? 1 : 0],
    hermit: (v: boolean | null) => apt.forceHermit(v),
    atlases: () => citizens.map((c) => (c.tex.image as HTMLCanvasElement).toDataURL()),
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
      scene.fog!.color.copy(skyCol);
      const night = hud.nightAt(hourF);
      hud.setNight(night);
      // streetlamps warm up on the same night curve (0 by day, full at deep night)
      const lampNight = THREE.MathUtils.clamp((night - 0.03) / 0.28, 0, 1);
      props.setLampNight(lampNight);
      // the hermit keeps his own hours — mostly afternoons
      apt.updateHermit(Math.floor(totalMin / 60));
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
      // weather: the rain comes and goes by the hour
      props.updateRain(dt, px, pz, Math.floor(totalMin / 60));

      // floor-aware stair guards (2D colliders, so they follow the floor)
      apt.updateCaps(px);
      // billboards face the player
      for (const b of boards) {
        b.m.rotation.y = Math.atan2(px - b.m.position.x, pz - b.m.position.z);
      }
      // citizens: ping-pong the block, show the correct painted angle. They are
      // SOLID and politely halt a step short of you — but if held up against you
      // for a beat (stuck timer), they give up and squeeze through, going
      // non-solid only until they're clear, then solid again. So they never
      // wall you in for good, and never become permanently uncollidable.
      // is a citizen's footprint clear of every solid PROP (trees, cars, …)?
      // (the player isn't in this set — people phase the player, never props)
      const clearAt = (x: number, z: number) =>
        !citAvoid.some((a) => x + 0.28 > a.minX && x - 0.28 < a.maxX && z + 0.28 > a.minZ && z - 0.28 < a.maxZ);
      for (const c of citizens) {
        const dist = Math.hypot(px - c.lane, pz - c.z);
        if (dist < 1.05) c.stuck += dt; else c.stuck = Math.max(0, c.stuck - dt * 2);
        if (!c.ghost && c.stuck > 1.4) c.ghost = true;       // fed up → push past YOU
        if (c.ghost && dist > 1.4) { c.ghost = false; c.stuck = 0; } // clear → solid again
        const holding = dist < 1.0 && !c.ghost;              // standing a step short of you
        let moving = !holding;
        if (moving) {
          const s = Math.sign(c.home);
          const nz = c.z + c.dir * c.sp * dt;
          if (clearAt(c.lane, nz)) {
            c.z = nz;
            c.lane += (c.home - c.lane) * Math.min(1, dt * 2); // ease back to home lane
          } else {
            // a solid prop is ahead — step laterally to go AROUND it (never through)
            let target: number | null = null;
            for (const off of [0.45, 0.8, -0.45, 1.15]) {
              const x = c.home + off * s;
              if (Math.abs(x) >= ROAD_HALF + 0.55 && Math.abs(x) <= FACE - 0.35 && clearAt(x, nz)) { target = x; break; }
            }
            if (target !== null) {
              c.lane += (target - c.lane) * Math.min(1, dt * 5);
              if (clearAt(c.lane, c.z + c.dir * c.sp * dt * 0.5)) c.z += c.dir * c.sp * dt * 0.5;
            } else { c.dir *= -1; moving = false; }  // boxed in — turn back
          }
        }
        if (c.z < -L + 4) { c.z = -L + 4; c.dir = 1; }
        if (c.z > 10) { c.z = 10; c.dir = -1; }
        if (c.ghost) {
          c.box.minX = c.box.maxX = 1e5; c.box.minZ = c.box.maxZ = 1e5; // slip past you
        } else {
          c.box.minX = c.lane - 0.25; c.box.maxX = c.lane + 0.25;
          c.box.minZ = c.z - 0.25; c.box.maxZ = c.z + 0.25;
        }
        c.mesh.position.set(c.lane, sidewalkY, c.z);
        c.mesh.rotation.y = Math.atan2(px - c.lane, pz - c.z);
        const facing = Math.atan2(0, c.dir); // 0 for +z, π for -z... atan2(0,-1)=π ✓
        const camAng = Math.atan2(px - c.lane, pz - c.z);
        const [col, mirror] = viewFor(camAng - facing);
        // feet only stride while actually walking; stand still (feet together)
        // when halted, so a stopped person isn't marching in place
        if (moving) c.anim += dt * 5 * c.sp;
        const row = moving ? Math.floor(c.anim) % 2 : 0;
        c.tex.repeat.x = mirror ? -1 / 5 : 1 / 5;
        c.tex.offset.x = mirror ? (col + 1) / 5 : col / 5;
        c.tex.offset.y = row === 0 ? 0.5 : 0;
      }
      // traffic: one car at a time drives through, entering from whichever
      // end the player can't see into
      // each vehicle carries its own lane offset, length and speed, so the
      // bus can hug the centre line (it is too wide to share the cars' lane
      // without brushing the parked ones) and roll slower than they do
      const laneX = () => (cruiser.userData.laneX ?? DRIVE_X) as number;
      if (cruiseWait > 0) {
        cruiseWait -= dt;
        if (cruiseWait <= 0) {
          // mostly a plain car; the taxi about one pass in seven, the bus
          // about one in nine
          const roll = rnd();
          cruiser = roll < 0.11 ? bus : roll < 0.26 ? taxi : plain[Math.floor(rnd() * plain.length)];
          cruiseDir = pz < -L / 2 ? -1 : 1; // enter from the end farther from the player
          cruiser.position.set(cruiseDir === -1 ? laneX() : -laneX(), 0, cruiseDir === -1 ? 8 : -L + 6);
          cruiser.rotation.y = cruiseDir === -1 ? 0 : Math.PI;
          cruiser.visible = true;
          cruiseSpd = (cruiser.userData.speed ?? 8.5) as number; // already rolling
          busDwell = 0; busServed = false;
          bus.userData.setDoors(false);
        }
      } else {
        const base = (cruiser.userData.speed ?? 8.5) as number;
        let want = base;
        if (cruiser === bus && cruiseDir === -1) {
          const dz = cruiser.position.z - BUS_STOP_Z;   // metres short of the stop
          if (!busServed && dz < 16 && dz > -1) {
            // brake in proportion to what's left, so it arrives at a standstill
            want = Math.max(0, base * Math.min(1, dz / 11));
            if (dz < 0.35) { busDwell = 4 + rnd() * 3; busServed = true; }
          }
          if (busDwell > 0) { busDwell -= dt; want = 0; }
          bus.userData.setDoors(busDwell > 0);
          // and it pulls in to the kerb to serve, then eases back out
          const tx = (!busServed && dz < 20) || busDwell > 0 || (busServed && dz > -16) ? 3.55 : laneX();
          cruiser.position.x += (tx - cruiser.position.x) * Math.min(1, dt * 1.2);
        }
        cruiseSpd += (want - cruiseSpd) * Math.min(1, dt * 1.7);
        cruiser.position.z += cruiseDir * cruiseSpd * dt;
        const endZ = cruiseDir === -1 ? -L + 6 : 8;
        if (cruiseDir === -1 ? cruiser.position.z < endZ : cruiser.position.z > endZ) {
          if (Math.abs(pz - endZ) > 25) {
            cruiser.visible = false; // slips around the corner in the fog
            cruiseWait = 18 + rnd() * 24;
          } else {
            // the player is watching this corner — turn around, don't vanish
            cruiseDir = -cruiseDir;
            cruiser.position.x = cruiseDir === -1 ? laneX() : -laneX();
            cruiser.rotation.y = cruiseDir === -1 ? 0 : Math.PI;
          }
        }
      }
      // its collider follows (parked far away while nothing is out)
      if (cruiser.visible) {
        const hl = (cruiser.userData.halfLen ?? 2.5) as number;
        cruiserBox.minX = cruiser.position.x - 1.15;
        cruiserBox.maxX = cruiser.position.x + 1.15;
        cruiserBox.minZ = cruiser.position.z - hl;
        cruiserBox.maxZ = cruiser.position.z + hl;
      } else {
        cruiserBox.minX = cruiserBox.maxX = cruiserBox.minZ = cruiserBox.maxZ = 999;
      }
      // pigeons: peck, chase scattered cereal, spook when approached
      props.updatePigeons(dt, t, px, pz);
    },
  };
}
