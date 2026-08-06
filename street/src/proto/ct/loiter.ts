import type { CitizenSprite } from './citizens';

// ── SOMEBODY WAITING ──────────────────────────────────────────────────────
//
// A person who is not going anywhere, but is not a statue either: they stroll
// between a handful of posts, stand a while at each looking at something worth
// looking at, and TURN TO FACE YOU when you come near.
//
// ⚠ WHY THIS IS A FILE AND NOT A COPY. It was written for the landlord —
// *"landlord should meander downstairs not just always be in one
// orientation."* (2026-08-05) — and the very next ask was a kid loitering in
// the park, which is the same behaviour in a different room. This project has a
// standing rule about that: *"the look lives in one file so a fix to it fixes
// every caller, which is the same reason `citizenSprite` is one call for a
// person"* (ct/park.ts, on weed tufts). Two hand-rolled wanders would drift the
// way the umbrella's grip row and the atlas's fist drifted — two numbers in two
// files, each citing the other in a comment.
//
// ⚠ AND WHY IT IS NOT A PATHFINDER. Nobody using this is TRAVELLING. A waiting
// man's route is three or four places he already stands; the whole art is the
// PAUSES and the head turn, not the line between them. There is no steering, no
// avoidance and no collision here: the caller gives a box the person may not
// leave, and every post is inside it, so there is nothing to steer around.
//
// IT OWNS NOTHING BUT MOVEMENT. It does not know about clocks, rent, spots or
// colliders — the caller decides whether the person is present at all, and
// reads `x`/`z` back to drag its own `[E]` spot and its own AABB along.
//
// EVERYTHING BELOW THE POSITION IS `citizenSprite`'S. The eight painted views,
// the mirrored rear columns, the two-frame walk cycle and the view hysteresis
// that stops a sprite twitching on a sector boundary all live there already;
// this supplies only a heading and a walking flag, which is exactly the split
// `ct/crowd.ts` uses on the street.

/** Somewhere to stand, and what to look at once you are standing there.
 *
 *  `lx`/`lz` is a REAL OBJECT — a door, a stair, a bank of mailboxes, a park
 *  gate. A man idling stares at something; an idle heading drawn at random
 *  reads as a bug, and it is the cheapest half of "he is alive". */
export interface LoiterPost { x: number; z: number; lx: number; lz: number }

export interface LoiterOpts {
  /** at least two, or he has nowhere to go */
  posts: LoiterPost[];
  /**
   * THE BOX HE MAY NOT LEAVE, enforced on the POSITION and not merely on the
   * posts. Every post should already be inside it, so this never fires in
   * normal use — it is here so that editing a post by hand cannot walk somebody
   * into a wall, a stair or another module's trigger circle without the clamp
   * catching it first. That is not hypothetical: the landlord's post exists
   * where it does because his old trigger swallowed 101's landing parcel whole.
   */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** m/s. A stroll, not a walk — 0.4 is about right for somebody killing time. */
  speed?: number;
  /** how near you have to be before he stops and looks at you, in metres */
  notice?: number;
  /** initial heading, atan2(vx, vz) — 0 faces +z, π faces −z */
  facing?: number;
  /** seconds standing at a post, drawn between the two */
  pause?: [number, number];
  /** ground height under him. Flat floors omit it; the park's relief does not. */
  y?: (x: number, z: number) => number;
}

export interface Loiter {
  /** where he is THIS frame — drag your `[E]` spot and your collider here */
  readonly x: number;
  readonly z: number;
  /** which way he is TURNED, atan2(vx, vz), and whether his feet are moving */
  readonly facing: number;
  readonly walking: boolean;
  /**
   * Once per frame, while he is present.
   *
   * `noticeOk` is the caller's own gate on whether the player is even in the
   * same place — the right floor, inside the room. Distance alone would have an
   * indoor citizen turn to follow somebody two storeys up.
   */
  tick(px: number, pz: number, dt: number, noticeOk?: boolean): void;
  /** put him back on his first post, standing, facing his initial heading —
   *  for anyone who comes and goes, so he does not fade in mid-stride at
   *  wherever he happened to stop yesterday */
  reset(): void;
}

export function loiter(spr: CitizenSprite, o: LoiterOpts): Loiter {
  const posts = o.posts;
  const speed = o.speed ?? 0.42;
  const notice = o.notice ?? 2.6;
  const face0 = o.facing ?? 0;
  const [pMin, pMax] = o.pause ?? [2.5, 7.5];
  const groundY = o.y ?? (() => 0);
  let x = posts[0].x, z = posts[0].z;
  let head = face0;
  let post = 0;
  let wait = pMin;
  let moving = false;

  /** turn the short way round, at a human rate. Lifted from `ct/crowd.ts`,
   *  which learned it the hard way: snapping the heading is the third source of
   *  the sprite twitching between two painted columns. */
  const turn = (want: number, dt: number, rate: number) => {
    let d = want - head;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    head += d * Math.min(1, dt * rate);
  };

  return {
    get x() { return x; },
    get z() { return z; },
    get facing() { return head; },
    get walking() { return moving; },
    reset() {
      post = 0; x = posts[0].x; z = posts[0].z;
      head = face0; moving = false; wait = pMin;
    },
    tick(px, pz, dt, noticeOk = true) {
      const p = posts[post];
      // ── DOES HE NOTICE YOU ───────────────────────────────────────────────
      //
      // The single cheapest line here for what it buys. Inside `notice` metres
      // he STOPS WHERE HE IS and turns to face the player. Someone who keeps
      // pacing while you stand in front of him is a machine; someone who turns
      // his head is a person waiting for you. Distance only, no sight line —
      // he is expecting you.
      if (noticeOk && Math.hypot(px - x, pz - z) < notice) {
        turn(Math.atan2(px - x, pz - z), dt, 6);
        spr.setWalking(false);
        // he KEEPS the post he was walking to, so stepping away resumes the
        // stroll rather than re-rolling a destination on the spot
        wait = Math.max(wait, 1.2);
      } else if (moving) {
        const dx = p.x - x, dz = p.z - z;
        const d = Math.hypot(dx, dz);
        if (d < 0.06) {
          x = p.x; z = p.z;
          moving = false;
          wait = pMin + Math.random() * (pMax - pMin);
        } else {
          const step = Math.min(d, speed * dt);
          x += (dx / d) * step; z += (dz / d) * step;
          turn(Math.atan2(dx, dz), dt, 4.5);   // HE FACES WHERE HE IS GOING
          spr.setWalking(true);
        }
      } else {
        spr.setWalking(false);
        turn(Math.atan2(p.lx - x, p.lz - z), dt, 2.2);   // …and looks at it
        wait -= dt;
        if (wait <= 0) {
          // any post but this one, so he always actually goes somewhere
          let n = Math.floor(Math.random() * (posts.length - 1));
          if (n >= post) n += 1;
          post = n;
          moving = true;
        }
      }
      // ⚠ RUNTIME `Math.random`, NEVER the world's seeded `rnd()`. GOTCHAS 2:
      // that stream's ORDER is load-bearing and one extra draw re-grains every
      // texture built after it. These draws happen on a frame, long after the
      // last texture is baked, so they cannot reach it.
      x = Math.min(o.bounds.maxX, Math.max(o.bounds.minX, x));
      z = Math.min(o.bounds.maxZ, Math.max(o.bounds.minZ, z));
      spr.mesh.position.set(x, groundY(x, z), z);
      spr.setFacing(head);
      spr.update(px, pz, dt);
    },
  };
}
