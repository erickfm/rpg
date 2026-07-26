import * as THREE from 'three';
import type { AABB } from '../fp';
import { type Look, citizenAtlas, citizenPlane, sectorAt, viewAt } from './citizens';
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
  /** index in the cast — the deterministic tie-break when two of them meet */
  id: number;
  /** the lateral offset COMMITTED to, so a pass is not re-decided every frame */
  pick: number;
  /** the smoothed heading the sprite is drawn from, and the view sector it is
   *  holding — both exist to stop a walker twitching, see the frame hook */
  head: number; sector: number;
  /** the last position known to be legal, and how long we have been illegal —
   *  the crowd's half of what ct/fp.ts does for the player rig */
  good: { x: number; z: number }; stuckT: number;
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
  /** test affordance: where each person is AND what they are doing, because
   *  x/z alone cannot tell a citizen waiting 20 s for the 42 from one jammed
   *  against a crossing — and "pedestrians pile up and get stuck" is exactly
   *  that distinction. `wait` is the errand timer, `doing` the errand, `jam`
   *  the seconds this walker has been unable to make progress. */
  walkers: () => { x: number; z: number; wait: number; doing: string; jam: number; ghost: boolean }[];
  /** test affordance: which atlas column each person is showing and whether it
   *  is mirrored, with the billboard's yaw and their direction of travel. This
   *  is what makes "does the painted toe point the way they walk" checkable —
   *  the profile column is asymmetric now, so the mirror matters and a
   *  screenshot of one angle cannot answer it (scripts/feet-check.mjs). */
  views: () => { vx: number; vz: number; col: number; mirror: boolean; yaw: number;
    moving: boolean; doing: string; to: string }[];
  /** Paint an arbitrary Look and hand back the sheet as a data URL. This is how
   *  notes/CITIZEN-STYLE.md's contact sheet is generated — an agent needs to SEE
   *  the range of people the atlas makes, not read adjectives about them. */
  paint: (look: Look) => string;
  /** test affordance: route between two named nodes of the walkable network, so
   *  a probe can assert the graph CONNECTS rather than waiting to observe a trip
   *  that depends on a random destination draw (scripts/crowd-net.mjs) */
  /** test affordance: a route BETWEEN TWO NAMED NODES, and the edges it walks.
   *  `road` on an edge is what "cross at the crossing, and only at the
   *  crossing" comes to, and until now it was unreadable from outside — an
   *  audit could see that nobody was stranded at the side street's east end
   *  but not that the edge there is flagged, which is a different claim. */
  netRoute: (fromId: string, toId: string) => {
    hops: number; len: number;
    edges: { from: string; to: string; road: boolean; half: number; len: number }[];
    crossings: number;
  } | null;
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
    const geo = citizenPlane();
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
      was: -1, back: -1, id: i, pick: 0, head: i % 2 ? 0 : Math.PI, sector: -1,
      good: { x: lane, z }, stuckT: 0,
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

  // ── being somewhere illegal, and leaving ────────────────────────────────
  //
  // The sim could only ever REFUSE motion: every candidate position was tested
  // and a blocked walker simply stood. That is fine until it is standing
  // somewhere it should not be, and then nothing recovers it — which is the pair
  // frozen on the carriageway either side of a parked car.
  //
  // ct/fp.ts solved exactly this for the player rig, so this is that solution
  // with the crowd's own numbers rather than a second invention: the minimum
  // translation out of a box (the smallest of the four axis escapes, which for an
  // AABB is the shortest way out), eased rather than snapped so a walker resting
  // legally against a wall is never shoved, and a last-known-good fallback when
  // the push keeps cancelling.
  const CIT_R = 0.28;          // the same footprint clearAt tests with
  const UNSTICK = 1.4;         // m/s — walk out, do not teleport
  const PATIENCE = 1.2;        // s of getting nowhere before falling back
  /** Push out of a box — and PREFER THE PAVEMENT when there is a choice.
   *
   *  The plain minimum translation is what F's `fp.ts` does for the rig, and it
   *  is right for a capsule that may stand anywhere. A citizen may NOT stand
   *  anywhere: it belongs on the 2 m walk. Pushing it out of a car parked at
   *  the kerb by the shortest route pushes it INTO THE ROAD about half the
   *  time, because the shortest way out of a kerbside box is usually
   *  roadward — and the queue's diagnosis of the user's shot is exactly that,
   *  "a walker shoved off the kerb to get round a bin is a bug in the
   *  avoidance, not in the graph".
   *
   *  So all four exits are scored, not just measured: the cost is how far the
   *  push is PLUS how far it leaves you from the line you were walking. A
   *  slightly longer push that keeps you on the pavement wins.
   */
  const escapeFrom = (c: AABB, x: number, z: number,
    /** the walk line to stay near: the edge being walked, if there is one */
    line?: { ax: number; az: number; bx: number; bz: number }) => {
    const left = x - (c.minX - CIT_R);
    const right = (c.maxX + CIT_R) - x;
    const back = z - (c.minZ - CIT_R);
    const front = (c.maxZ + CIT_R) - z;
    if (left <= 0 || right <= 0 || back <= 0 || front <= 0) return null;   // outside
    const opts = [{ dx: -left, dz: 0 }, { dx: right, dz: 0 },
      { dx: 0, dz: -back }, { dx: 0, dz: front }];
    if (!line) {
      const d = Math.min(left, right, back, front);
      if (d === left) return opts[0];
      if (d === right) return opts[1];
      if (d === back) return opts[2];
      return opts[3];
    }
    const offLine = (px: number, pz: number) => {
      const vx = line.bx - line.ax, vz = line.bz - line.az;
      const L2 = vx * vx + vz * vz;
      const t = L2 < 1e-9 ? 0
        : Math.max(0, Math.min(1, ((px - line.ax) * vx + (pz - line.az) * vz) / L2));
      return Math.hypot(px - (line.ax + t * vx), pz - (line.az + t * vz));
    };
    let best = opts[0], bestCost = Infinity;
    for (const o2 of opts) {
      // 1.4 weights "stay on the walk" above "move the least". Below about 1
      // the shortest push still wins next to a kerbside car, which is the
      // case this exists for.
      const cost = Math.hypot(o2.dx, o2.dz) + 1.4 * offLine(x + o2.dx, z + o2.dz);
      if (cost < bestCost) { bestCost = cost; best = o2; }
    }
    return best;
  };
  /** push a citizen out of anything it is inside, and if that gets nowhere put it
   *  back on the last node it legally stood on */
  const unstick = (c: Citizen, dt: number) => {
    // the line this walker should be on, so a push can prefer to keep it there
    const la = c.at >= 0 ? net.nodes[c.at] : null;
    const lb = c.route.length ? net.nodes[c.route[0]] : null;
    const line = la && lb ? { ax: la.x, az: la.z, bx: lb.x, bz: lb.z }
      : la ? { ax: la.x, az: la.z, bx: la.x, bz: la.z } : undefined;
    let px = 0, pz = 0;
    for (const b of o.citAvoid) {
      const e = escapeFrom(b, c.lane, c.z, line);
      if (e) { px += e.dx; pz += e.dz; }
    }
    if (px === 0 && pz === 0) {                 // legal: remember it
      c.good.x = c.lane; c.good.z = c.z;
      c.stuckT = 0;
      return;
    }
    c.stuckT += dt;
    const len = Math.hypot(px, pz);
    if (len > 1e-6) {
      const step = Math.min(len, UNSTICK * dt);
      c.lane += (px / len) * step;
      c.z += (pz / len) * step;
    }
    if (c.stuckT > PATIENCE) {
      // Back to the last node we know is legal — a node, not just the last
      // position, because a walker shoved off the kerb wants to be back ON the
      // pavement network, not a metre further along the gutter.
      const home = c.at >= 0 ? net.nodes[c.at] : null;
      const to = home && !o.citAvoid.some((b) => escapeFrom(b, home.x, home.z, undefined))
        ? { x: home.x, z: home.z } : c.good;
      c.lane = to.x; c.z = to.z;
      c.route = []; c.pick = 0; c.stuckT = 0;   // and re-plan from there
    }
  };

  /** seconds of getting nowhere before a walker stops waiting and goes round */
  const JAM_GIVE_UP = 2.0;

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
      // A quarter of trips ignore the local radius. That share is load-bearing
      // in BOTH directions and was tuned twice: too few long trips and the side
      // street empties out (nobody routes round the corner at all), too many and
      // everybody is permanently in transit and the errands stop showing,
      // because a cross-block walk takes the best part of a minute.
      const local = rnd() < 0.85 ? 26 : 1e9;          // metres, as the crow flies
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
  /** Blocked here: take another path, rather than waiting for the world to
   *  clear. The node we cannot reach is struck out of the graph FOR THIS
   *  WALKER, and the same destination is re-routed around it — which is the
   *  whole point. Clearing the route and re-planning (what this used to do)
   *  runs Dijkstra over an unchanged graph and returns the identical path
   *  through the identical blockage, so the walker walks back into it and jams
   *  again; that loop is the pile-up not dispersing once it forms.
   *
   *  If there is no way round — a dead-end shopfront, the closed east end — the
   *  fallback is to give up on this errand and pick a new one, which is at
   *  least motion. */
  const reroute = (c: Citizen) => {
    c.jam = 0;
    const blocked = c.route[0];
    const dest = c.route[c.route.length - 1];
    const from = c.at >= 0 ? c.at : net.nearest(c.lane, c.z);
    if (blocked === undefined || dest === undefined) { c.route = []; return; }
    const alt = net.route(from, dest, new Set([blocked]));
    if (alt.length > 1 && alt[1] !== blocked) {
      c.route = alt.slice(1);
      c.at = from;
      c.pick = c.bias;                 // the committed offset failed with it
    } else {
      c.route = [];                    // no way round: somewhere else to be
    }
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
        const ai = c.at >= 0 ? c.at : c.route[0];
        const A = net.nodes[ai];
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
        // `jam` is time spent GETTING NOWHERE, and it used to be time spent
        // with anybody ahead at all — which counted a perfectly good follow at
        // matched pace as a jam. It is now set below, once we know whether this
        // frame actually moved.
        // ── who gives way ─────────────────────────────────────────────────
        //
        // ASYMMETRIC, on purpose. Both-bear-right is symmetric, and a symmetric
        // rule is what makes two walkers in a lane too narrow for two abreast
        // each step aside into the other's new path, every frame, for as long as
        // they are near each other — the back-and-forth in the report.
        //
        // But only a HEAD-ON meeting needs anybody to stand. Treating a walker
        // you have merely caught up with as a conflict was my first cut and it
        // starved the block: everybody spent their time waiting instead of
        // walking, nobody completed a long trip, and the side street emptied.
        // Catching somebody up is a FOLLOW — match their pace and stay behind.
        //
        // And the tie-break alternates by PAIR PARITY rather than always
        // favouring the higher id. Fixed for any given pair, so it cannot
        // oscillate; different across pairs, so no one walker is the one who
        // always gives way (id 0 yielded to all five of the others, which is
        // how the starvation showed up).
        let held = false, follow = 0;
        if (ahead) {
          // SOMEBODY PARKED IS NOT SOMEBODY TO NEGOTIATE WITH. This is the
          // pile-up. Giving way is for two people who both want to move; a
          // citizen standing at a window for twelve seconds, or hesitating in a
          // doorway for eight, is furniture. The old test could not tell them
          // apart — a stopped walker read as `theirs <= 1e-4`, i.e. as a
          // head-on meeting — so one of the pair stood for as long as the other
          // one's errand lasted, and whoever came up behind THEM stood too. Six
          // people and two errands is all it takes.
          //
          // The user's diagnosis is the fix: the walk logic should allow people
          // to walk around things. A parked walker is a thing to walk around,
          // so we neither hold nor follow — we fall through to the offset search
          // below, which is already the "go round it" manoeuvre.
          const parked = ahead.wait > 0;
          const mine = Math.hypot(c.vx, c.vz), theirs = Math.hypot(ahead.vx, ahead.vz);
          const headOn = mine > 1e-4 && theirs > 1e-4
            && (c.vx * ahead.vx + c.vz * ahead.vz) / (mine * theirs) < 0;
          if (parked) {
            // nothing: go round
          } else if (headOn || theirs <= 1e-4) {
            const lowerYields = (c.id + ahead.id) % 2 === 0;
            held = lowerYields ? c.id < ahead.id : c.id > ahead.id;
            // …but not for ever. A yield is meant to last the second it takes
            // the other one to pass. If it has not resolved in JAM_GIVE_UP, the
            // rule has failed for this pair and standing longer will not fix it.
            if (c.jam > JAM_GIVE_UP * 0.5) held = false;
          } else {
            follow = theirs / dt;                     // their speed, to match
          }
        }
        const step = held ? 0 : Math.min(c.sp, follow || c.sp) * dt;
        // try the intended offset first, then wider — prop avoidance and
        // passing are the same manoeuvre. Never wider than the walk allows.
        // STICKY: whatever offset worked last frame is tried first, and a new
        // one is only searched for — and then COMMITTED — when it stops working.
        // Re-deriving the choice from scratch every frame is the other half of
        // the oscillation: the candidate list is ordered, so a walker would
        // snap back to its preferred side the instant that side cleared, which
        // is the moment the other walker had just moved out of it.
        // How wide is what we are walking on? A walk is narrow; a crossing is
        // as wide as its stripes, and the candidates spread to fill it, so
        // people cross abreast in lanes instead of single file through a node.
        const half = net.halfOf(ai, c.route[0]);
        const k = half / STRAY;
        const want = (ahead ? Math.max(0.3, c.bias) : c.bias) * k;
        let placed = false;
        for (const off of [c.pick, want, want + 0.4 * k, want - 0.8 * k, 0,
          want + 0.8 * k, want - 0.4 * k]) {
          const o2 = Math.max(-half, Math.min(half, off));
          const nt = t + step;
          const nx = A.x + dx * nt + rx * o2;
          const nz2 = A.z + dz * nt + rz * o2;
          if (clearAt(nx, nz2) && clearOfPeople(nx, nz2, c)) {
            vx = nx - c.lane; vz = nz2 - c.z;
            c.lane = nx; c.z = nz2;
            c.pick = o2;                              // committed until it fails
            placed = true;
            break;
          }
        }
        // ── did this frame actually get anywhere? ─────────────────────────
        //
        // THE ESCAPE HATCH USED TO LIVE INSIDE `!placed`, AND THAT IS WHY
        // PEOPLE STUCK FOR EVER. A held walker sets step = 0, so the very first
        // candidate offset — its own current position — is clear, `placed` goes
        // true, and the re-plan below was never reached. Its jam timer counted
        // up the whole time: the watch that found this measured one walker at
        // 29.8 s of a 60 s minute, standing, with `placed` true every frame.
        //
        // So progress is measured, not inferred from which branch we fell down.
        // An escalation, not a single rule: give way for half a second, then
        // stop giving way and try to go ROUND (the offset search), and only if
        // that is still getting nowhere take a different path entirely. Firing
        // the last two together would reroute a walker on the very frame it
        // first tried to step round somebody, which throws away the cheap fix.
        const got = Math.hypot(vx, vz);
        if (got < c.sp * dt * 0.35) {
          c.jam += dt;
          if (c.jam > JAM_GIVE_UP) reroute(c);
        } else c.jam = Math.max(0, c.jam - dt * 2);
        // ── ARRIVING IS MEASURED ALONG THE EDGE, NOT AS THE CROW FLIES ────
        //
        // THIS WAS MY BUG AND IT IS THE ONE THAT PUT PEOPLE IN THE ROAD.
        // The test used to be `hypot(B - position) < 0.45`. That works only
        // while a walker stays near the edge's centre line, and I then gave
        // crossings 1.3 m of lateral offset so people could cross abreast. A
        // walker committed to a wide lane is NEVER within 0.45 m of the node
        // it is heading for, so it never arrives — it walks straight past B
        // and on along the edge's direction for ever, out into the
        // carriageway and off the end of the block, until a collider stops it
        // dead. That is "these people are stuck": they are not stuck at all,
        // they have overshot and been halted by the first thing they hit.
        //
        // Found by direction, not by guessing: the escapees were travelling
        // (-0.21, -0.96), and the side crossing n-bodega -> s-win1 runs
        // (-0.26, -0.96).
        //
        // Projecting onto the edge makes arrival independent of how far off
        // the line somebody is walking, which is the property the lateral
        // offset needs and the euclidean test never had.
        const tNow = (c.lane - A.x) * dx + (c.z - A.z) * dz;
        if (tNow >= len - 0.45) {
          // COMING OFF A CROSSING, COME BACK TO THE WALK. Arriving by
          // projection means a walker can reach the node while still 1.3 m off
          // the line, which is fine mid-route — the next edge just starts from
          // its own projection — but at a DESTINATION it would stand there,
          // and a crossing's 1.3 m off the line is the middle of the road.
          // So the perpendicular offset is clamped back to a walk's width the
          // moment the node is reached.
          const off = (c.lane - B.x) * rx + (c.z - B.z) * rz;
          const keep = Math.max(-STRAY, Math.min(STRAY, off));
          if (off !== keep) {
            c.lane += (keep - off) * rx;
            c.z += (keep - off) * rz;
            c.pick = keep;
          }
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
      // resolve an illegal position rather than merely refusing to move into
      // one — never leave a walker standing somewhere it should not be
      unstick(c, dt);
      c.vx = vx; c.vz = vz;
      if (c.ghost) {
        c.box.minX = c.box.maxX = 1e5; c.box.minZ = c.box.maxZ = 1e5; // slip past you
      } else {
        c.box.minX = c.lane - 0.25; c.box.maxX = c.lane + 0.25;
        c.box.minZ = c.z - 0.25; c.box.maxZ = c.z + 0.25;
      }
      c.mesh.position.set(c.lane, sidewalkY, c.z);
      c.mesh.rotation.y = Math.atan2(px - c.lane, pz - c.z);
      // Facing follows the ACTUAL direction of travel — it used to be
      // atan2(0, dir), which only knew ±z, and was wrong the moment somebody
      // turned the corner. But the RAW per-frame velocity is not a heading: it
      // carries every lateral correction the avoidance makes, so feeding it
      // straight to the sprite is the third source of twitching. Ease toward it
      // instead, and keep the last heading while standing still so a halted
      // person does not snap round to face +z.
      if (Math.hypot(c.vx, c.vz) > 1e-4) {
        const want = Math.atan2(c.vx, c.vz);
        let d = want - c.head;
        while (d > Math.PI) d -= 2 * Math.PI;         // by the short way round
        while (d < -Math.PI) d += 2 * Math.PI;
        c.head += d * Math.min(1, dt * 7);
      }
      c.dir = c.head;
      const camAng = Math.atan2(px - c.lane, pz - c.z);
      // ── view hysteresis ───────────────────────────────────────────────
      //
      // Rounding the heading to one of 8 sectors switches view at the exact
      // midpoint, so a heading sitting on a boundary flips between two painted
      // columns every frame and the whole person reads as twitching. Hold the
      // current sector until the heading is clearly past the boundary — a fifth
      // of a sector, 9° — so crossing it is a decision rather than a coin flip.
      const sPos = sectorAt(camAng - c.dir);
      if (c.sector < 0) c.sector = Math.round(sPos) % 8;
      let away = sPos - c.sector;
      while (away > 4) away -= 8;
      while (away < -4) away += 8;
      if (Math.abs(away) > 0.7) c.sector = ((Math.round(sPos) % 8) + 8) % 8;
      const [col, mirror] = viewAt(c.sector);
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
    walkers: () => citizens.map((c) => ({ x: c.lane, z: c.z, wait: +c.wait.toFixed(2),
      doing: c.doing, jam: +c.jam.toFixed(2), ghost: !!c.ghost })),
    // the DIRECTION OF TRAVEL, not a ±1 axis code: since the crowd routes over
    // a graph, people walk east and west too, and the feet check has to compare
    // the painted toe against an arbitrary heading
    paint: (look) => {
      const t = citizenAtlas(look);
      return (t.image as HTMLCanvasElement).toDataURL();
    },
    netRoute: (fromId, toId) => {
      const a = net.nodes.findIndex((n) => n.id === fromId);
      const b = net.nodes.findIndex((n) => n.id === toId);
      if (a < 0 || b < 0) return null;
      const r = net.route(a, b);
      let len = 0;
      for (let i = 0; i + 1 < r.length; i++) {
        len += Math.hypot(net.nodes[r[i]].x - net.nodes[r[i + 1]].x,
          net.nodes[r[i]].z - net.nodes[r[i + 1]].z);
      }
      // ── THE EDGES, SO AN OUTSIDE TEST CAN READ A ROAD FLAG ─────────────
      //
      // The auditor could not verify the east-end crossing fix and said so
      // rather than passing it: "window.__ct.netRoute exposes no net, nodes or
      // edges, so an outside test cannot read an edge's road flag.
      // Behaviourally nothing is stranded at that end, which is consistent
      // with the fix and not evidence of it — the flag governs lateral
      // allowance, not whether anyone gets stuck." That is exactly right, and
      // it is my affordance that was too thin.
      //
      // Added to the RETURN rather than as a new `__ct` entry on purpose:
      // `crosstown.ts` is DESK-owned and already wires `netRoute` through, so
      // widening what it answers needs no edit to a file that is not mine.
      // `hops` and `len` are untouched, so existing callers are unaffected.
      const step = [];
      for (let i = 0; i + 1 < r.length; i++) {
        const [u, v] = [r[i], r[i + 1]];
        step.push({ from: net.nodes[u].id, to: net.nodes[v].id,
          road: net.isCrossing(u, v),
          half: +net.halfOf(u, v).toFixed(2),
          len: +Math.hypot(net.nodes[u].x - net.nodes[v].x,
            net.nodes[u].z - net.nodes[v].z).toFixed(2) });
      }
      return { hops: r.length, len, edges: step,
        crossings: step.filter((e) => e.road).length };
    },
    views: () => citizens.map((c) => ({
      vx: c.vx, vz: c.vz, col: c.view?.col ?? -1, mirror: !!c.view?.mirror,
      yaw: c.view?.yaw ?? 0, moving: !!c.view?.moving,
      doing: c.wait > 0 ? c.doing : 'walking',
      to: c.route.length ? net.nodes[c.route[c.route.length - 1]].id : '-',
    })),
  };
}
