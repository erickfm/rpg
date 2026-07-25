import * as THREE from 'three';
import type { AABB } from '../fp';
import { type Look, citizenAtlas, viewFor } from './citizens';
import { ROAD_HALF, rnd } from './rng';
import { buildNet, STRAY, type Activity, type Net } from './crowd-net';
import { ORDER, type CtxBuild } from './ctx';

// ── the crowd: who is on the block, and how they walk it ───────────────────
//
// Split out of crosstown.ts, which was carrying both the cast and the walking
// sim inline. `ct/citizens.ts` is the ATLAS — it paints one person's sprite
// sheet and is shared by three modules, so it stays desk-owned. This file is
// the SIM: the cast list, the steering, the prop avoidance and the politeness
// rules about the player. Nothing here is called from anywhere else.
//
// Lifted verbatim in the split — same cast, same numbers, same order of
// construction, so every texture and position comes back identical.

/** What the crowd needs from the world that the build context does not carry. */
export interface CrowdOpts {
  /** solid props people steer AROUND — trees, lamps, parked cars, and the
   *  moving cruiser's box, which follows it. Read live every frame, so the
   *  list may still be appended to after the crowd is built. */
  citAvoid: AABB[];
  /** register a person's footprint as solid to the PLAYER. People are not in
   *  `citAvoid`, so they phase each other but never a tree. */
  solid: (b: AABB) => void;
  /** the lamplight registry — people walk through the pools too */
  lit: (root: THREE.Object3D) => void;
  /** the side street's dimensions, for laying out the walkable network — they
   *  live in crosstown.ts, not in ct/rng.ts */
  SIDE_Z0: number; SIDE_Z1: number; SIDE_X1: number;
}

// Six of them, and no two are the same person recoloured. Each carries its
// own height, build, skin, hair shape, garment and walking speed. Build is
// a SILHOUETTE change in the atlas (torso and shoulder width), separate
// from the mesh scale, so the tall ones aren't just the short ones blown up.
//
// Skin runs the full range you'd actually see on a city street, and hair is
// matched to it the way it falls in life rather than assigned at random.
// Everyone is painted by the same routine with the same shading.
interface Person {
  look: Look; hs: number; ws: number; sp: number;
}
const CAST: Person[] = [
  // tall, broad, long coat, close-cropped hair
  { look: { jacket: '#3a4a63', pants: '#2b2f36', skin: '#6b4226', hair: '#141014', fit: 'coat', cut: 'crop', build: 1 },
    hs: 1.09, ws: 1.07, sp: 1.55 },
  // small and quick, ball cap, hair tied back under it
  { look: { jacket: '#7a3a34', pants: '#3f4650', skin: '#e6bb92', hair: '#8c5a2e', fit: 'cap', accent: '#8a3a2e', cut: 'tied', build: -1 },
    hs: 0.91, ws: 0.94, sp: 1.72 },
  // unhurried, long hair, dress
  { look: { jacket: '#3f5a46', pants: '#3f5a46', skin: '#c9946a', hair: '#241a10', fit: 'dress', cut: 'long', build: 0 },
    hs: 0.97, ws: 0.99, sp: 0.68 },
  // heavy-set, hood up, ambling
  { look: { jacket: '#5c5266', pants: '#2b2f36', skin: '#4a2c1a', hair: '#141014', fit: 'hoodie', cut: 'short', build: 1 },
    hs: 1.05, ws: 1.10, sp: 0.86 },
  // slight, older, bald, brisk
  { look: { jacket: '#6a5a3a', pants: '#23262c', skin: '#f0c8a0', hair: '#b8b2a6', fit: 'plain', cut: 'bald', build: -1 },
    hs: 0.94, ws: 0.92, sp: 1.34 },
  // average everything, long dark hair, steady pace
  { look: { jacket: '#37505e', pants: '#2b2f36', skin: '#8d5a34', hair: '#1c1410', fit: 'plain', cut: 'long', build: 0 },
    hs: 1.02, ws: 1.00, sp: 1.08 },
];
// Stride is tied to speed, and so is cadence — but each only by the ROOT of
// it, because a walker who doubles their pace does not double both. Longer
// legs also cover more ground, so height feeds in. Without this a fast
// walker just cycles the same short steps quicker, which reads as skating.
const strideFor = (sp: number, hs: number) =>
  Math.max(2, Math.min(5, Math.round(3.2 * Math.sqrt(sp) * hs)));

interface Citizen {
  mesh: THREE.Mesh; tex: THREE.Texture; lane: number; home: number; z: number;
  dir: number; sp: number; ph: number; box: AABB; stuck: number; ghost: boolean;
  anim: number; cad: number;
  /** the rest of the route, as node indices; empty means "needs a plan" */
  route: number[];
  /** the node last reached, -1 before the first plan */
  at: number;
  /** seconds still to spend standing here, doing `doing` */
  wait: number;
  doing: Activity;
  /** how long something has been in the way — the passing rule's timer */
  jam: number;
  /** where this trip started, and where a double-back should head for */
  was: number; back: number;
  /** this trip's lateral bias across the walk */
  bias: number;
  /** this frame's movement, which is what the sprite's facing comes off now */
  vx: number; vz: number;
  /** what the sprite is currently showing — for the feet check, see `views` */
  view?: { col: number; mirror: boolean; yaw: number; moving: boolean } }

export interface Crowd {
  /** test affordance: every person's painted sprite sheet (scripts/people.mjs) */
  atlases: () => string[];
  /** test affordance: who is on the block, how big and how fast */
  people: () => { sp: number; cad: number; hs: number; ws: number; footY: number }[];
  /** where everybody is standing right now. Read by ct/traffic.ts, which will
   *  not drive through a person — so this has to be live positions, not the
   *  build-time cast. */
  walkers: () => { x: number; z: number }[];
  /** test affordance: which atlas column each person is showing and whether it
   *  is mirrored, with the billboard's yaw and their direction of travel. This
   *  is what makes "does the painted toe point the way they walk" checkable —
   *  the profile column is asymmetric now, so the mirror matters and a
   *  screenshot of one angle cannot answer it (scripts/feet-check.mjs). */
  views: () => { vx: number; vz: number; col: number; mirror: boolean; yaw: number;
    moving: boolean; doing: string; to: string }[];
}

export function buildCrowd(ctx: CtxBuild, o: CrowdOpts): Crowd {
  const { scene, sidewalkY } = ctx;
  const net = buildNet(o);
  const citizens: Citizen[] = [];

  CAST.forEach((p, i) => {
    const tex = citizenAtlas({ ...p.look, stride: strideFor(p.sp, p.hs) });
    tex.repeat.set(1 / 5, 1 / 2);
    // the geometry is translated so the origin is at the FEET, so scaling
    // height never lifts anyone off the pavement or sinks them into it
    const geo = new THREE.PlaneGeometry(0.95, 1.9);
    geo.translate(0, 0.95, 0);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }));
    mesh.scale.set(p.ws, p.hs, 1);
    // home lanes sit in the clear strip between the kerb props and the wall
    const lane = (i % 2 ? 1 : -1) * (ROAD_HALF + 1.05 + (i % 3) * 0.17);
    const z = 4 - i * 16; // spread thin over the whole block
    mesh.position.set(lane, sidewalkY, z);
    scene.add(mesh);
    o.lit(mesh);             // people walk through the pools too
    // ±0.25, not ±0.30: bodies read the tiniest bit too wide to slip past.
    // With the rig's 0.36 m radius that puts the gap needed to squeeze by a
    // person at 0.61 m instead of 0.72 m.
    const box: AABB = { minX: lane - 0.25, maxX: lane + 0.25, minZ: z - 0.25, maxZ: z + 0.25 };
    o.solid(box);            // people are solid — the box follows them
    citizens.push({
      mesh, tex, lane, home: lane, z, dir: i % 2 ? 1 : -1, sp: p.sp,
      ph: i * 1.3, box, stuck: 0, ghost: false, anim: i * 1.3,
      cad: 5 * Math.sqrt(p.sp) / p.hs,   // cadence: long legs swing slower
      route: [], at: -1, wait: 0, doing: 'none', jam: 0, bias: 0, vx: 0, vz: 0,
      was: -1, back: -1,
    });
  });

  // is a citizen's footprint clear of every solid PROP (trees, cars, …)?
  // (the player isn't in this set — people phase the player, never props)
  const clearAt = (x: number, z: number) =>
    !o.citAvoid.some((a) => x + 0.28 > a.minX && x - 0.28 < a.maxX && z + 0.28 > a.minZ && z - 0.28 < a.maxZ);
  /** …and clear of everybody ELSE. The old sim never checked this: people
   *  walked straight through one another, which is the one thing the brief
   *  called a non-negotiable. A candidate position is only taken if it is clear
   *  of props AND of every other body, so overlapping is impossible rather than
   *  merely discouraged — the first cut here paused and then squeezed through
   *  after 0.8 s, which is walking through somebody politely. */
  const clearOfPeople = (x: number, z: number, self: Citizen) =>
    !citizens.some((q) => q !== self && !q.ghost && Math.hypot(q.lane - x, q.z - z) < 0.46);

  // ── having somewhere to be ──────────────────────────────────────────────
  //
  // A destination and a reason for it. The old sim gave everybody the same
  // errand — walk to the end of the block, turn round — which is why varying
  // their speeds did not make the street feel any more alive: six people doing
  // one thing at six paces is still six people doing one thing.
  //
  // Weighted so most trips are just a walk somewhere, with the errands
  // sprinkled in; `rnd()` here runs at RUNTIME only, never during the build.
  const WAIT: Record<Activity, [number, number]> = {
    window: [5, 12],      // stop and look in
    door: [4, 8],         // hesitate in a doorway
    bench: [12, 25],      // wait for the 42
    corner: [1.5, 4],     // pause at the kerb before crossing
    none: [0.5, 2.5],     // even a plain stretch gets a beat, so nobody pivots
  };
  const plan = (c: Citizen) => {
    const from = c.at >= 0 ? c.at : net.nearest(c.lane, c.z);
    if (c.back >= 0 && c.back !== from) {              // double back
      c.route = net.route(from, c.back).slice(1);
      c.was = from; c.at = from; c.back = -1;
      c.bias = (rnd() - 0.5) * 2 * STRAY;
      if (c.route.length) return;
    }
    c.was = from;
    // pick somewhere that is not where we already are, biased toward the marked
    // errands — and every so often turn straight round and double back, which
    // is the one thing a shortest path will never do on its own
    // Mostly somewhere NEARBY and mostly somewhere with a reason to go: real
    // pedestrians potter about locally, and it is arrivals that produce the
    // stopping and looking, so long treks across the whole block have to be the
    // minority or nobody is ever seen doing anything.
    const here = net.nodes[from];
    let to = from;
    for (let tries = 0; tries < 10 && to === from; tries++) {
      const wantAct = rnd() < 0.75;
      const local = rnd() < 0.88 ? 26 : 1e9;          // metres, as the crow flies
      const pool = net.nodes
        .map((n, i) => ({ n, i }))
        .filter(({ n, i }) => i !== from && (!wantAct || n.act)
          && Math.hypot(n.x - here.x, n.z - here.z) < local)
        .map(({ i }) => i);
      if (pool.length) to = pool[Math.floor(rnd() * pool.length)];
    }
    c.route = net.route(from, to).slice(1);
    c.at = from;
    if (!c.route.length) c.route = [net.adj[from][Math.floor(rnd() * net.adj[from].length)].to];
    // a personal lateral bias, redrawn each trip, so the same person does not
    // always hug the same side of the walk
    c.bias = (rnd() - 0.5) * 2 * STRAY;
  };
  const arrive = (c: Citizen) => {
    const act = net.nodes[c.at]?.act ?? 'none';
    const [lo, hi] = WAIT[act];
    c.wait = lo + rnd() * (hi - lo);
    c.doing = act;
    // …and sometimes, having got there, turn straight round and go back the way
    // you came. A shortest path will never do that on its own, and it is the
    // thing that stops the block reading as a conveyor belt.
    c.back = rnd() < 0.22 ? c.was : -1;
  };

  // citizens: ping-pong the block, show the correct painted angle. They are
  // SOLID and politely halt a step short of you — but if held up against you
  // for a beat (stuck timer), they give up and squeeze through, going
  // non-solid only until they're clear, then solid again. So they never
  // wall you in for good, and never become permanently uncollidable.
  //
  // LATE: the crowd reads the world's finished state — including the moving
  // car's box, which the traffic pass writes at the end of the frame.
  ctx.onFrame(({ dt, px, pz }) => {
    for (const c of citizens) {
      const dist = Math.hypot(px - c.lane, pz - c.z);
      if (dist < 1.05) c.stuck += dt; else c.stuck = Math.max(0, c.stuck - dt * 2);
      if (!c.ghost && c.stuck > 1.4) c.ghost = true;       // fed up → push past YOU
      if (c.ghost && dist > 1.4) { c.ghost = false; c.stuck = 0; } // clear → solid again
      const holding = dist < 1.0 && !c.ghost;              // standing a step short of you
      // ── the plan ────────────────────────────────────────────────────────
      // Everybody is on their way SOMEWHERE and does something when they get
      // there. Planned at runtime, never at build: a rnd() draw while the world
      // is being constructed would shift every tree height and parked car after
      // it (GOTCHAS §2).
      if (!c.route.length) plan(c);
      let moving = !holding && c.wait <= 0;
      if (c.wait > 0) c.wait -= dt;
      let vx = 0, vz = 0;
      if (moving && c.route.length) {
        // ── walk the current edge ─────────────────────────────────────────
        //
        // The position is kept ON THE EDGE plus a lateral offset, rather than
        // by nudging it sideways each frame. The first cut did the latter and
        // the nudges ACCUMULATED — there was nothing pulling anybody back to
        // the line, so a few seconds of prop avoidance walked people off the
        // kerb and into the roadway. Measuring the offset from the edge makes
        // straying off the walk impossible by construction.
        const A = net.nodes[c.at >= 0 ? c.at : c.route[0]];
        const B = net.nodes[c.route[0]];
        let dx = B.x - A.x, dz = B.z - A.z;
        const len = Math.hypot(dx, dz) || 1;
        dx /= len; dz /= len;
        const rx = -dz, rz = dx;                       // to the right of travel
        // where we are along the edge, and how far off its line
        const t = (c.lane - A.x) * dx + (c.z - A.z) * dz;
        // somebody in the way? Slow, and after a beat pass on YOUR right — a
        // rule both parties apply, so a head-on meeting resolves instead of
        // deadlocking.
        const ahead = citizens.find((q) => q !== c
          && Math.hypot(q.lane - (c.lane + dx * 0.7), q.z - (c.z + dz * 0.7)) < 0.62);
        if (ahead) c.jam += dt; else c.jam = Math.max(0, c.jam - dt * 2);
        const held = ahead && c.jam < 0.8;             // a pause before squeezing by
        const step = held ? 0 : c.sp * dt;
        // try the intended offset first, then wider — prop avoidance and
        // passing are the same manoeuvre. Never wider than the walk allows.
        const want = ahead ? Math.max(0.3, c.bias) : c.bias;
        let placed = false;
        for (const off of [want, want + 0.4, want - 0.8, 0, want + 0.8, want - 0.4]) {
          const o2 = Math.max(-STRAY, Math.min(STRAY, off));
          const nt = t + step;
          const nx = A.x + dx * nt + rx * o2;
          const nz2 = A.z + dz * nt + rz * o2;
          if (clearAt(nx, nz2) && clearOfPeople(nx, nz2, c)) {
            vx = nx - c.lane; vz = nz2 - c.z;
            c.lane = nx; c.z = nz2;
            placed = true;
            break;
          }
        }
        if (!placed) {
          // nothing clear either side: STAND. Never advance into somebody, and
          // never shove through a prop. If it stays blocked long enough, take a
          // different route from here rather than waiting forever — which is
          // also what stops two people meeting head-on in a doorway from
          // standing there for good.
          c.jam += dt;
          if (c.jam > 2.5) { c.route = []; c.jam = 0; }
        }
        if (Math.hypot(B.x - c.lane, B.z - c.z) < 0.45) {
          c.at = c.route.shift()!;
          if (!c.route.length) arrive(c);              // that was the destination
          // …or stop HERE, part way, if this spot is worth stopping at. Waiting
          // only at destinations made stops rare and clustered: a trip across
          // the block takes the best part of a minute, so six people were
          // walking 95% of the time and the errands never showed. Pausing en
          // route is also just what people do — you pass a window and stop at
          // it without that window being where you were going.
          else if (net.nodes[c.at].act && rnd() < 0.35) arrive(c);
        }
      }
      c.vx = vx; c.vz = vz;
      if (c.ghost) {
        c.box.minX = c.box.maxX = 1e5; c.box.minZ = c.box.maxZ = 1e5; // slip past you
      } else {
        c.box.minX = c.lane - 0.25; c.box.maxX = c.lane + 0.25;
        c.box.minZ = c.z - 0.25; c.box.maxZ = c.z + 0.25;
      }
      c.mesh.position.set(c.lane, sidewalkY, c.z);
      c.mesh.rotation.y = Math.atan2(px - c.lane, pz - c.z);
      // Facing follows the ACTUAL direction of travel. It used to be
      // atan2(0, dir), which only knew ±z — fine when everybody walked one
      // axis, wrong the moment somebody turns the corner and walks east. The
      // last non-zero movement is kept so a person standing still keeps facing
      // the way they were going rather than snapping to face +z.
      if (Math.hypot(c.vx, c.vz) > 1e-4) c.dir = Math.atan2(c.vx, c.vz);
      const facing = c.dir;
      const camAng = Math.atan2(px - c.lane, pz - c.z);
      const [col, mirror] = viewFor(camAng - facing);
      // feet only stride while actually walking; stand still (feet together)
      // when halted, so a stopped person isn't marching in place
      if (moving) c.anim += dt * c.cad;   // per-person cadence, see strideFor
      const row = moving ? Math.floor(c.anim) % 2 : 0;
      c.tex.repeat.x = mirror ? -1 / 5 : 1 / 5;
      c.tex.offset.x = mirror ? (col + 1) / 5 : col / 5;
      c.tex.offset.y = row === 0 ? 0.5 : 0;
      c.view = { col, mirror, yaw: c.mesh.rotation.y, moving };
    }
  }, ORDER.LATE);

  return {
    atlases: () => citizens.map((c) => (c.tex.image as HTMLCanvasElement).toDataURL()),
    people: () => citizens.map((c) => ({
      sp: c.sp, cad: c.cad, hs: c.mesh.scale.y, ws: c.mesh.scale.x,
      footY: c.mesh.position.y,
    })),
    walkers: () => citizens.map((c) => ({ x: c.lane, z: c.z })),
    // the DIRECTION OF TRAVEL, not a ±1 axis code: since the crowd routes over
    // a graph, people walk east and west too, and the feet check has to compare
    // the painted toe against an arbitrary heading
    views: () => citizens.map((c) => ({
      vx: c.vx, vz: c.vz, col: c.view?.col ?? -1, mirror: !!c.view?.mirror,
      yaw: c.view?.yaw ?? 0, moving: !!c.view?.moving,
      doing: c.wait > 0 ? c.doing : 'walking',
      to: c.route.length ? net.nodes[c.route[c.route.length - 1]].id : '-',
    })),
  };
}
