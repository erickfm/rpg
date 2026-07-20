import * as THREE from 'three';
import { BLOCK_RINGS, ringLength, ringPoint } from '../world/city';
import { makePerson, type PersonMesh } from '../render/people';
import { mulberry32 } from '../core/rng';

const NAMES = [
  'Gary', 'Donna', 'Phil', 'Marcy', 'Todd', 'Denise', 'Randy', 'Carol',
  'Kevin', 'Tammy', 'Bruce', 'Linda', 'Chuck', 'Sheila', 'Ernie', 'Pam',
];

export const BARKS = [
  '"They put a new machine in at the Neon Dragon. It eats quarters AND dreams."',
  '"Video Palace charged me a late fee on a tape I never rented. Classic Video Palace."',
  '"Datacorp\'s hiring again. Third time this month. Draw your own conclusions."',
  '"The coffee at the Sunrise is basically legal rocket fuel."',
  '"Nice day for it. Whatever it is you\'re doing."',
  '"I\'m walking here. Well — strolling."',
  '"Big Ray tried to sell me a wagon with three hubcaps. THREE."',
  '"You hear the payphone by the park just rings sometimes? Nobody\'s there."',
  '"Y2K\'s gonna be nothing. Or everything. Fifty-fifty."',
  '"Rent went up again. Everything goes up except my bowling average."',
  '"The donut place glazes twice. That\'s the secret. You didn\'t hear it from me."',
  '"Lost my pager in the fountain. If it beeps, that\'s me."',
];

interface Ped {
  mesh: PersonMesh;
  name: string;
  bark: string;
  ring: number;
  s: number; // distance along the ring
  speed: number;
  dir: 1 | -1;
  phase: number;
  paused: number; // seconds left standing still (chatting, idling)
}

const PED_COUNT = 14;

/** The citizens: they walk their block, pause politely, and have opinions. */
export class Peds {
  private peds: Ped[] = [];

  constructor(scene: THREE.Scene) {
    const rng = mulberry32(98);
    for (let i = 0; i < PED_COUNT; i++) {
      const mesh = makePerson(rng);
      // weight the downtown and nearby blocks
      const ring = [4, 4, 4, 1, 3, 5, 7, 0, 2, 6, 8, 4, 5, 3][i % 14];
      const ped: Ped = {
        mesh,
        name: NAMES[i % NAMES.length],
        bark: BARKS[Math.floor(rng() * BARKS.length)],
        ring,
        s: rng() * ringLength(BLOCK_RINGS[ring]),
        speed: 1.5 + rng() * 0.9,
        dir: rng() < 0.5 ? 1 : -1,
        phase: rng() * Math.PI * 2,
        paused: 0,
      };
      scene.add(mesh.group);
      this.peds.push(ped);
    }
  }

  update(dt: number, playerX: number, playerZ: number): void {
    for (const ped of this.peds) {
      const ring = BLOCK_RINGS[ped.ring];
      const here = ringPoint(ring, ped.s);
      const playerDist = Math.hypot(here.x - playerX, here.z - playerZ);

      const walking = ped.paused <= 0 && playerDist > 2.1;
      if (ped.paused > 0) ped.paused -= dt;

      if (walking) {
        ped.s += ped.dir * ped.speed * dt;
        ped.phase += dt * ped.speed * 3.4;
        if (Math.random() < dt * 0.02) ped.paused = 2 + Math.random() * 4; // stop and take in the view
      }

      const p = ringPoint(ring, ped.s);
      ped.mesh.group.position.set(p.x, 0, p.z);

      if (playerDist <= 2.6) {
        // face the player politely
        ped.mesh.group.rotation.y = Math.atan2(playerX - p.x, playerZ - p.z) + Math.PI;
      } else {
        ped.mesh.group.rotation.y = ped.dir === 1 ? p.heading : p.heading + Math.PI;
      }

      const swing = walking ? Math.sin(ped.phase) * 0.55 : 0;
      ped.mesh.leftLeg.rotation.x = swing;
      ped.mesh.rightLeg.rotation.x = -swing;
      ped.mesh.leftArm.rotation.x = -swing * 0.7;
      ped.mesh.rightArm.rotation.x = swing * 0.7;
    }
  }

  nearest(x: number, z: number, radius: number): { name: string; bark: string } | null {
    let best: Ped | null = null;
    let bestD = radius;
    for (const ped of this.peds) {
      const d = Math.hypot(ped.mesh.group.position.x - x, ped.mesh.group.position.z - z);
      if (d < bestD) {
        best = ped;
        bestD = d;
      }
    }
    return best ? { name: best.name, bark: best.bark } : null;
  }

  nearestPos(x: number, z: number): [number, number] | null {
    let best: Ped | null = null;
    let bestD = Infinity;
    for (const ped of this.peds) {
      const d = Math.hypot(ped.mesh.group.position.x - x, ped.mesh.group.position.z - z);
      if (d < bestD) {
        best = ped;
        bestD = d;
      }
    }
    return best ? [best.mesh.group.position.x, best.mesh.group.position.z] : null;
  }

  count(): number {
    return this.peds.length;
  }
}
