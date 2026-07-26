import * as THREE from 'three';

/**
 * A CLOCK FACE THAT TELLS THE TIME — for rooms AND for facades.
 *
 * The user: *"make sure all the clocks throughout the world (library, diner,
 * etc. tell the time accurately)"*. **Throughout the world** — and I originally
 * read that as "in the rooms", built `room.clock()`, and reported the job half
 * done. Then I counted hands across the whole scene:
 *
 *     hands inside room slabs:   7
 *     hands outside room slabs:  0
 *
 * Not one exterior clock moves. The church tower carries a LIT face that is,
 * at night, the most visible clock in the game — on a tower, illuminated,
 * readable from most of the street — and it shows a fixed hour. The clocks the
 * player actually looks at were the ones I had not covered.
 *
 * `room.clock()` could not fix that: it is a room primitive and a facade is not
 * inside a `buildRoom`. So the hand-driving lives here instead, callable by
 * anything with a scene graph and a frame hook, and `room.clock()` is now a
 * thin wrapper over it.
 *
 * **One mechanism for the world.** That is the same argument that made the
 * floor picker and the door descriptor right: if each surface hand-rolls a
 * clock they drift apart the first time anyone touches one, and a tower
 * disagreeing with a diner is exactly the bug that was filed.
 *
 * ── For a facade (E, the church tower) ────────────────────────────────
 *
 *     import { clockFace } from './clockface';
 *
 *     const face = clockFace({ r: 0.9, hands: 0x1a1a1a });
 *     face.group.rotation.y = -Math.PI / 2;      // point it down the street
 *     face.group.position.set(wx, wy, wz);
 *     scene.add(face.group);
 *     ctx.onFrame((f) => face.update(f.hourF));  // that is the whole wiring
 *
 * `update` takes `hourF` — hour of day as a float, 0…24 — and nothing else. It
 * caches nothing, so when the clock JUMPS (sleeping, a wristwatch set) the
 * hands jump with it without this file knowing sleep exists.
 */
export interface ClockFace {
  /** add this to your scene, or to a room group via its `put` */
  group: THREE.Group;
  /** call every frame with `hourF` (0…24). No caching — jumps follow. */
  update: (hourF: number) => void;
}

export function clockFace(o: {
  /** face radius in metres. 0.22 is a shop wall clock; a tower wants ~0.9 */
  r?: number;
  face?: number; rim?: number; hands?: number;
} = {}): ClockFace {
  const R = o.r ?? 0.22;
  const faceC = o.face ?? 0xe8e4d8, rimC = o.rim ?? 0x3a3630, handC = o.hands ?? 0x22201c;
  const group = new THREE.Group();

  // rim, then face a hair in front of it so neither z-fights
  group.add(new THREE.Mesh(new THREE.CircleGeometry(R, 20),
    new THREE.MeshBasicMaterial({ color: rimC })));
  const face = new THREE.Mesh(new THREE.CircleGeometry(R * 0.88, 20),
    new THREE.MeshBasicMaterial({ color: faceC }));
  face.position.z = R * 0.018;
  group.add(face);

  // the twelve hours, long at 12/3/6/9 the way a real dial marks them
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const quarter = i % 3 === 0;
    const tick = new THREE.Mesh(
      new THREE.PlaneGeometry(quarter ? R * 0.10 : R * 0.055, quarter ? R * 0.20 : R * 0.12),
      new THREE.MeshBasicMaterial({ color: rimC }));
    const rr = R * 0.88 - (quarter ? R * 0.11 : R * 0.07);
    tick.position.set(Math.sin(a) * rr, Math.cos(a) * rr, R * 0.027);
    tick.rotation.z = -a;
    group.add(tick);
  }

  // Hands pivot at one END, so the geometry is pushed up by half its length
  // before any rotation. A hand rotated about its centre sweeps from the middle
  // of the dial and reads as a propeller.
  const hand = (len: number, wdt: number, z: number) => {
    const geo = new THREE.PlaneGeometry(wdt, len);
    geo.translate(0, len / 2, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: handC }));
    m.position.z = z;
    group.add(m);
    return m;
  };
  const hourH = hand(R * 0.52, R * 0.09, R * 0.036);
  const minH = hand(R * 0.78, R * 0.06, R * 0.045);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(R * 0.06, 8),
    new THREE.MeshBasicMaterial({ color: rimC }));
  cap.position.z = R * 0.054;
  group.add(cap);

  return {
    group,
    // BOTH HANDS MOVE, AND THE HOUR HAND CREEPS. At 13:30 it sits halfway
    // between 1 and 2, which is the thing that gives a fake clock away.
    // Angles run clockwise, hence the minus.
    update: (hourF: number) => {
      minH.rotation.z = -((hourF % 1) * Math.PI * 2);
      hourH.rotation.z = -(((hourF % 12) / 12) * Math.PI * 2);
    },
  };
}
