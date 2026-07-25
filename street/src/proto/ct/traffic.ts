import * as THREE from 'three';
import type { AABB } from '../fp';
import { ROAD_HALF, DRIVE_X, rnd } from './rng';
import { ORDER, type CtxBuild } from './ctx';
import { type CarKind, makeCar, makeBus } from './cars';

// ── TRAFFIC — the road network, and what drives on it ──────────────────────
//
// Split out of crosstown.ts, where a vehicle was a z coordinate and a
// direction: it drove up and down ONE axis and vanished at z = -L + 6 = -90,
// eight metres short of the corner. So the best-looking thing on the block was
// a place the world stopped rather than a place anything went through.
//
// Now the street is a T. A vehicle follows a ROUTE — a chain of straights and
// circular arcs — and its position, heading, lean and steering all come off
// that one path parameter. That is the whole trick: nothing snaps, because
// nothing is set directly.
//
// ═══ the junction ═════════════════════════════════════════════════════════
//
// The main drag runs south down -z and DEAD-ENDS in the side street, which
// runs east. Two arms, so there are exactly two movements through it:
//
//         │ ↓ │              southbound  →  turn east   (the tight one)
//         │   │              westbound    →  turn north  (the wide one)
//     ────┘   └──── J
//      ←         ←
//     ─────────────
//
// Every number below is FORCED by the lane geometry — none of it is tuned.
// Both arcs are concentric about the kerb corner J = (ROAD_HALF, SIDE_Z0),
// because a 90° arc joining two perpendicular lane centre lines has exactly
// one radius: the corner's offset from the lane. A vehicle in the lane d off
// the centre line therefore turns through
//
//     tight (south → east)   r = ROAD_HALF - d     ends on z = SIDE_Z0 - r
//     wide  (west  → north)  r = ROAD_HALF + d     ends on x = -d
//
// which lands every arc end exactly on the far road's own lane centre. Traffic
// keeps RIGHT (southbound sits at +x, which is a driver's right when heading
// -z), so the tight arc is the right turn and the wide one crosses the
// oncoming lane — same as any real intersection.
//
// The useful consequence: **the two routes never intersect.** Concentric arcs
// of different radii cannot cross, and the four straights sit on four
// different lane lines. Two vehicles can be in this junction at once and
// cannot conflict, so there is no reservation, no priority rule and no
// deadlock to get wrong. scripts/corner-traffic.mjs proves it by running both
// movements at the same time.
//
// ═══ what still has to be true ════════════════════════════════════════════
//
// · The PARKED cars are not traffic. They are built in crosstown.ts off the
//   seeded stream and this module never sees them.
// · The 42 still calls at the stop, southbound only — see `busStop` below.
//   scripts/bus.mjs is the contract and it is unchanged.

/** a straight run, or a circular arc, in the ground plane */
type Seg =
  | { k: 'line'; x0: number; z0: number; hx: number; hz: number; len: number }
  | { k: 'arc'; cx: number; cz: number; r: number; a0: number; sweep: number; len: number };

interface Pose { x: number; z: number; yaw: number;
  /** turn radius here — Infinity on a straight */
  r: number;
  /** +1 turning left, -1 turning right, 0 straight */
  turn: number }

/** rotation.y for a heading. The car models are built nose-first down -z, so
 *  yaw 0 faces -z — which is why southbound has always been rotation 0. */
const yawFor = (hx: number, hz: number) => Math.atan2(-hx, -hz);

const line = (x0: number, z0: number, x1: number, z1: number): Seg => {
  const dx = x1 - x0, dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  return { k: 'line', x0, z0, hx: dx / len, hz: dz / len, len };
};
/** `sweep` is signed: the direction θ travels, which is what decides whether
 *  the arc is a left or a right turn. */
const arc = (cx: number, cz: number, r: number, a0: number, sweep: number): Seg =>
  ({ k: 'arc', cx, cz, r, a0, sweep, len: Math.abs(sweep) * r });

function poseAt(seg: Seg, u: number): Pose {
  if (seg.k === 'line') {
    return { x: seg.x0 + seg.hx * u, z: seg.z0 + seg.hz * u, yaw: yawFor(seg.hx, seg.hz), r: Infinity, turn: 0 };
  }
  const d = Math.sign(seg.sweep);
  const a = seg.a0 + d * (u / seg.r);
  const x = seg.cx + seg.r * Math.cos(a);
  const z = seg.cz + seg.r * Math.sin(a);
  // tangent: θ increasing runs anticlockwise in (x, z), decreasing runs the
  // other way, so the heading flips with the sweep sign
  const hx = d > 0 ? -Math.sin(a) : Math.sin(a);
  const hz = d > 0 ? Math.cos(a) : -Math.cos(a);
  // is the centre to the left of travel? left = (hz, -hx)
  const turn = Math.sign((seg.cx - x) * hz + (seg.cz - z) * -hx);
  return { x, z, yaw: yawFor(hx, hz), r: seg.r, turn };
}

class Route {
  segs: Seg[];
  len: number;
  constructor(segs: Seg[]) {
    this.segs = segs;
    this.len = segs.reduce((a, s) => a + s.len, 0);
  }
  at(s: number): Pose {
    let u = Math.max(0, s);
    for (const seg of this.segs) {
      if (u <= seg.len) return poseAt(seg, u);
      u -= seg.len;
    }
    return poseAt(this.segs[this.segs.length - 1], this.segs[this.segs.length - 1].len);
  }
  /** the tightest radius anywhere in [s, s + ahead] — what to brake for */
  minRadius(s: number, ahead: number): number {
    let r = Infinity, u = s;
    const end = s + ahead;
    // sample rather than solve: segments are few and short, and a 1 m step
    // cannot skip an arc (the tightest here is 1.35 m long × π/2)
    while (u < end) { r = Math.min(r, this.at(u).r); u += 1; }
    return Math.min(r, this.at(end).r);
  }
}

export type RouteName = 'NE' | 'EN';

export interface TrafficOpts {
  /** the junction: the main street's south end, and the side street's north kerb */
  SIDE_Z0: number;
  /** how far east the side street runs before the fog takes it */
  SIDE_X1: number;
  /** lamplight registry — a vehicle standing in a pool catches it */
  lit: (root: THREE.Object3D) => void;
  /** register a vehicle collider: blocks the player, and the crowd steers
   *  around it. One per vehicle in the pool, parked far away while idle. */
  vehicleBox: (b: AABB) => AABB;
  /** everybody on foot. Traffic will not drive through a person. */
  peopleAt: () => { x: number; z: number }[];
}

interface Vehicle {
  obj: THREE.Group;
  box: AABB;
  route: Route | null;
  name: RouteName;
  s: number;
  spd: number;
  /** metres to the right of the lane — the bus's pull-in to the kerb */
  lat: number;
  dwell: number;
  served: boolean;
  /** how long it has been held up by somebody in the road */
  held: number;
  /** last applied front-wheel angle, so a probe can check the wheels agree
   *  with the body instead of guessing which child mesh is a front wheel */
  steer: number;
}

export interface Traffic {
  /** test affordance: every vehicle that is out, and what it is doing */
  info: () => { x: number; z: number; yaw: number; spd: number; route: RouteName; s: number; lean: number; steer: number }[];
  /** test affordance: put the 42 on the block now (scripts/bus.mjs) */
  bus: (z: number, dir: 1 | -1) => void;
  busInfo: () => number[];
  /** test affordance: force a vehicle onto a route now, ignoring the one-at-a
   *  -time rule. `s` starts it that many metres along, which is how two
   *  movements are staged to reach the junction at the same moment — the two
   *  arms are different lengths, so spawning both at once does NOT do it. */
  spawn: (route: RouteName, which?: 'car' | 'bus' | 'taxi', s?: number) => void;
}

// How hard a driver is willing to corner, and how hard to brake for it. 3 m/s²
// is a brisk but unremarkable turn; it is what sets the speed through the
// corner, so a car arrives at the junction already slowing.
const A_LAT = 3.0, A_BRAKE = 3.5;
/** how much body roll one m/s² of cornering buys. At 8 px/m a physically
 *  honest 1° lean is a third of a pixel, so this is deliberately exaggerated
 *  to about 3° at the limit — enough to read, not enough to look like a boat. */
const LEAN_PER_A = 0.019, LEAN_MAX = 0.06;
const STEER_MAX = 0.61;              // 35°, about a real lock
/** nobody gets driven into: how close a person may be to the path ahead */
const CLEAR_R = 2.0;
/** …and how far short of them a driver comes to rest */
const STOP_GAP = 2.0;

export function buildTraffic(ctx: CtxBuild, o: TrafficOpts): Traffic {
  const { scene, player } = ctx;
  const JZ = o.SIDE_Z0, JX = ROAD_HALF;      // the kerb corner both arcs turn about
  const ENTRY_Z = 8;                         // main street, north end — as it always was
  const EAST_X = o.SIDE_X1 - 3;              // side street, east end, in the haze
  const MID_Z = JZ - ROAD_HALF;              // the side street's centre line

  // ── the fleet ───────────────────────────────────────────────────────────
  // Usually a plain car; the taxi is a rare sight and the 42 rarer still —
  // roughly one pass in nine. Unchanged, including the order they are painted
  // in: these textures come off the shared Math.random stream.
  const plain = [makeCar('sedan', 2), makeCar('hatch', 4), makeCar('van', 5), makeCar('sedan', 3)];
  const taxi = makeCar('sedan', 0, true);
  const bus = makeBus();
  const fleet = [...plain, taxi, bus];
  fleet.forEach((c) => { c.visible = false; scene.add(c); o.lit(c); });

  // ── the two routes, per lane offset ─────────────────────────────────────
  // The bus hugs the centre line (laneX 1.35, it is too wide to share the
  // cars' lane), so it gets its own slightly different pair.
  const routeCache = new Map<string, Route>();
  const routeFor = (name: RouteName, d: number): Route => {
    const key = `${name}:${d}`;
    const hit = routeCache.get(key);
    if (hit) return hit;
    const rt = new Route(name === 'NE'
      // south down the main street, right turn through the corner, away east
      ? [line(d, ENTRY_Z, d, JZ),
        arc(JX, JZ, ROAD_HALF - d, Math.PI, Math.PI / 2),
        line(JX, JZ - (ROAD_HALF - d), EAST_X, JZ - (ROAD_HALF - d))]
      // west up the side street, left turn across the mouth, away north
      : [line(EAST_X, MID_Z - d, JX, MID_Z - d),
        arc(JX, JZ, ROAD_HALF + d, -Math.PI / 2, -Math.PI / 2),
        line(-d, JZ, -d, ENTRY_Z)]);
    routeCache.set(key, rt);
    return rt;
  };
  // At a dead end with the player watching, a car turns around rather than
  // popping out of existence — one tight arc across the centre line, which is
  // what the two lanes being 2d apart makes it. The bus cannot do this (a 30
  // footer needs four times the room) so it is never asked to.
  const uTurn = (name: RouteName, d: number): Route => new Route(name === 'NE'
    ? [arc(EAST_X, MID_Z, d, Math.PI / 2, -Math.PI), ...routeFor('EN', d).segs]
    : [arc(0, ENTRY_Z, d, Math.PI, -Math.PI), ...routeFor('NE', d).segs]);

  // ── the vehicles that are out ───────────────────────────────────────────
  const active: Vehicle[] = [];
  const boxes = new Map<THREE.Group, AABB>();
  for (const c of fleet) {
    boxes.set(c, o.vehicleBox({ minX: 999, maxX: 999, minZ: 999, maxZ: 999 }));
  }
  let wait = 5;                 // gap between vehicles
  let maxActive = 1;            // one on the block at a time — a deliberate choice
  const laneOf = (c: THREE.Group) => (c.userData.laneX ?? DRIVE_X) as number;

  const put = (c: THREE.Group, name: RouteName, s: number): Vehicle => {
    const v: Vehicle = {
      obj: c, box: boxes.get(c)!, route: routeFor(name, laneOf(c)), name, s,
      spd: (c.userData.speed ?? 8.5) as number,   // already rolling
      lat: 0, dwell: 0, served: false, held: 0, steer: 0,
    };
    c.visible = true;
    bus.userData.setDoors(false);
    active.push(v);
    pose(v);
    return v;
  };
  const clear = (v: Vehicle) => {
    v.obj.visible = false;
    v.box.minX = v.box.maxX = v.box.minZ = v.box.maxZ = 999;
    active.splice(active.indexOf(v), 1);
  };

  // ── the 42 at the stop ──────────────────────────────────────────────────
  // Southbound only: the doors are on the bus's local +x, which is the east
  // kerb only when it faces -z, and the stop is on the east walk. Northbound
  // is serving the other side of the route and sails past. Straight out of
  // crosstown.ts, keyed on the southbound straight instead of on cruiseDir.
  const STOP_FLAG_Z = -33.5;                                        // the flag pole (ct/props.ts)
  const BUS_STOP_Z = STOP_FLAG_Z - (bus.userData.doorZ as number);  // centre when the door lines up
  const KERB_LAT = 3.55 - (bus.userData.laneX as number);           // how far in it pulls
  const busStop = (v: Vehicle, dt: number, want: number): number => {
    const dz = v.obj.position.z - BUS_STOP_Z;      // metres short of the stop
    if (!v.served && dz < 16 && dz > -1) {
      // brake in proportion to what's left, so it arrives at a standstill
      want = Math.min(want, Math.max(0, (bus.userData.speed as number) * Math.min(1, dz / 11)));
      if (dz < 0.35) { v.dwell = 4 + rnd() * 3; v.served = true; }
    }
    if (v.dwell > 0) { v.dwell -= dt; want = 0; }
    bus.userData.setDoors(v.dwell > 0);
    // and it pulls in to the kerb to serve, then eases back out
    const pull = (!v.served && dz < 20) || v.dwell > 0 || (v.served && dz > -16);
    v.lat += ((pull ? KERB_LAT : 0) - v.lat) * Math.min(1, dt * 1.2);
    return want;
  };

  /** put the mesh where the path says, and lean and steer to match */
  function pose(v: Vehicle) {
    const p = v.route!.at(v.s);
    const hx = -Math.sin(p.yaw), hz = -Math.cos(p.yaw);      // heading from yaw
    // the lateral offset rides on the path's own right-hand normal — right of
    // a heading (hx, hz) is (-hz, hx) — so the bus's pull-in to the kerb is
    // still correct if it ever has to happen somewhere that is not straight
    v.obj.position.set(p.x - hz * v.lat, 0, p.z + hx * v.lat);
    const a = p.r === Infinity ? 0 : (v.spd * v.spd) / p.r;  // lateral accel
    // leans AWAY from the turn centre: a right turn drops the left side
    const lean = THREE.MathUtils.clamp(-p.turn * a * LEAN_PER_A, -LEAN_MAX, LEAN_MAX);
    v.obj.rotation.set(0, p.yaw, lean);                      // XYZ: roll is about its own length
    const wb = (v.obj.userData.wheelbase ?? 2.9) as number;
    // the front wheels point where the arc is going: tan δ = wheelbase / r,
    // which is the whole of the bicycle model and is why they cannot disagree
    // with the body
    v.steer = p.r === Infinity ? 0
      : THREE.MathUtils.clamp(p.turn * Math.atan(wb / p.r), -STEER_MAX, STEER_MAX);
    (v.obj.userData.steer as ((a: number) => void) | undefined)?.(v.steer);
    // the collider is the body's box turned into an AABB — a car across the
    // junction is 5 m wide in x and 2.3 m in z, the opposite of one on the
    // main street, and the crowd reads these boxes every frame
    const hl = (v.obj.userData.halfLen ?? 2.5) as number;
    const ex = Math.abs(hx) * hl + Math.abs(hz) * 1.15;
    const ez = Math.abs(hz) * hl + Math.abs(hx) * 1.15;
    v.box.minX = v.obj.position.x - ex; v.box.maxX = v.obj.position.x + ex;
    v.box.minZ = v.obj.position.z - ez; v.box.maxZ = v.obj.position.z + ez;
  }

  /** how far along the path the first thing worth stopping for is — a person,
   *  the player, or the back of the vehicle in front. Infinity if it is clear.
   *  A distance rather than a yes/no, so the braking can be proportional: a
   *  car that slams to a halt 19 m short of somebody reads as stopping for no
   *  reason, which is exactly what the first cut of this did. */
  const blockedAt = (v: Vehicle, ahead: number): number => {
    const folk = o.peopleAt();
    const px = player.x(), pz = player.z();
    let hit = Infinity;
    for (let u = 1; u <= ahead; u += 1.5) {
      const p = v.route!.at(v.s + u);
      if (Math.hypot(px - p.x, pz - p.z) < CLEAR_R) { hit = u; break; }
      let stop = false;
      for (const f of folk) if (Math.hypot(f.x - p.x, f.z - p.z) < CLEAR_R) { stop = true; break; }
      if (stop) { hit = u; break; }
    }
    // …and don't drive into the back of the one in front. Measured in ROUTE
    // space, not as a radius around its body: the two movements' arcs pass 2 ×
    // laneX = 3 m apart, which is INSIDE a 5 m car's bounding circle, so a
    // proximity test flags a car on the other arc as an obstruction and both
    // stop dead for each other. In route space there is nothing to confuse —
    // only a vehicle on my own route can be in front of me.
    //
    // The one manoeuvre that crosses the other route is the dead-end U-turn.
    // It cannot collide while `maxActive` is 1; RAISE THAT AND THIS NEEDS A
    // CROSS-ROUTE CHECK.
    for (const w of active) {
      if (w === v || w.name !== v.name) continue;
      const back = w.s - ((w.obj.userData.halfLen ?? 2.5) as number);
      const gap = back - v.s - ((v.obj.userData.halfLen ?? 2.5) as number);
      if (gap > 0 && gap < ahead) hit = Math.min(hit, gap);
    }
    return hit;
  };

  ctx.onFrame(({ dt, px, pz }) => {
    // ── spawn ─────────────────────────────────────────────────────────────
    if (active.length < maxActive) {
      wait -= dt;
      if (wait <= 0) {
        const roll = rnd();
        const c = roll < 0.11 ? bus : roll < 0.26 ? taxi : plain[Math.floor(rnd() * plain.length)];
        if (!c.visible) {
          // enter from the arm the player is FARTHER from, as it always did —
          // now that is a choice between two arms rather than two ends
          const dNE = Math.hypot(px - 0, pz - ENTRY_Z);
          const dEN = Math.hypot(px - EAST_X, pz - MID_Z);
          put(c, dNE > dEN ? 'NE' : 'EN', 0);
        }
      }
    }
    // ── drive ─────────────────────────────────────────────────────────────
    for (const v of [...active]) {
      const base = (v.obj.userData.speed ?? 8.5) as number;
      let want = base;
      // slow for the corner: brake early enough to be at cornering speed by
      // the time the arc starts, so it is never a mid-turn lurch
      const look = Math.max(4, (v.spd * v.spd) / (2 * A_BRAKE));
      const r = v.route!.minRadius(v.s, look);
      if (r !== Infinity) want = Math.min(want, Math.sqrt(A_LAT * r));
      if (v.obj === bus && v.name === 'NE') want = busStop(v, dt, want);
      // and give way to anybody in the road ahead — the crossing at the corner
      // is the case this exists for, but it holds anywhere on the route.
      const stopDist = Math.max(4, (v.spd * v.spd) / (2 * A_BRAKE) + 4);
      const block = blockedAt(v, stopDist);
      // The braking curve, not a proportional one: the fastest it may be going
      // and still stop in the room left is sqrt(2·a·room). Proportional braking
      // reads fine but the eased speed LAGS the target, and the lag is about
      // 5 m at 8.5 m/s — enough that the first cut of this drove up to 0.12 m
      // from somebody standing on the crossing. So this also clamps the speed
      // itself, below, rather than only asking for it.
      const room = block === Infinity ? Infinity : Math.max(0, block - STOP_GAP);
      const safe = room === Infinity ? Infinity : Math.sqrt(2 * A_BRAKE * room);
      if (block < Infinity) { want = Math.min(want, safe); v.held += dt; } else v.held = 0;
      v.spd += (want - v.spd) * Math.min(1, dt * 1.7);
      // comfort caps (the corner) may be eased through; a person in the road
      // may not be
      if (v.spd > safe) v.spd = safe;
      if (v.spd < 0.02) v.spd = 0;
      v.s += v.spd * dt;
      // ── end of the line ─────────────────────────────────────────────────
      if (v.s >= v.route!.len) {
        const exit = v.route!.at(v.route!.len);
        const watched = Math.hypot(px - exit.x, pz - exit.z) < 25;
        const canTurn = ((v.obj.userData.halfLen ?? 2.5) as number) < 3;
        if (watched && canTurn) {
          // dead end with somebody watching: turn around and drive back out
          v.route = uTurn(v.name, laneOf(v.obj));
          v.name = v.name === 'NE' ? 'EN' : 'NE';
          v.s = 0;
          v.served = false;
        } else {
          clear(v);
          wait = 18 + rnd() * 24;
          continue;
        }
      }
      pose(v);
    }
  }, ORDER.LATE);

  return {
    info: () => active.map((v) => ({
      x: v.obj.position.x, z: v.obj.position.z, yaw: v.obj.rotation.y, spd: v.spd,
      route: v.name, s: v.s, lean: v.obj.rotation.z, steer: v.steer,
    })),
    // the 42 is rare on purpose, so put it on the block now. `z` is a main
    // street coordinate, as it was when the sim was one axis: southbound is
    // the NE route's first straight, northbound the EN route's last.
    bus: (z, dir) => {
      for (const v of [...active]) clear(v);
      const d = laneOf(bus);
      if (dir === -1) put(bus, 'NE', ENTRY_Z - z);
      else {
        const rt = routeFor('EN', d);
        put(bus, 'EN', rt.segs[0].len + rt.segs[1].len + (z - JZ));
      }
      wait = 0;
    },
    busInfo: () => {
      const v = active.find((a) => a.obj === bus);
      return [bus.position.x, bus.position.z, v?.spd ?? 0, v?.dwell ?? 0, v?.served ? 1 : 0];
    },
    spawn: (route, which = 'car', s = 0) => {
      const c = which === 'bus' ? bus : which === 'taxi' ? taxi : plain[0];
      if (c.visible) return;
      maxActive = Math.max(maxActive, active.length + 1);
      put(c, route, s);
    },
  };
}
