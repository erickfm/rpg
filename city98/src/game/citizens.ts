import * as THREE from 'three';
import { CITIZENS, citizenSpot, type Citizen } from '../core/citizens';
import { SHIRT_COLORS, HAIR_COLORS, SKIN_COLORS } from '../core/appearance';
import { folkFromId } from '../core/folk';
import { makeAvatar, type PersonMesh } from '../render/people';

interface Actor {
  c: Citizen;
  mesh: PersonMesh;
  x: number; z: number;
  phase: number;
}

/** The named cast: each walks toward its scheduled spot and faces the player near. */
export class Citizens {
  private actors: Actor[] = [];

  constructor(scene: THREE.Scene, minute: number) {
    for (const c of CITIZENS) {
      const mesh = makeAvatar(SHIRT_COLORS[c.shirt], HAIR_COLORS[c.hair], SKIN_COLORS[c.skin], folkFromId(c.id));
      const { spot } = citizenSpot(c, minute);
      mesh.group.position.set(spot.x, 0, spot.z);
      scene.add(mesh.group);
      this.actors.push({ c, mesh, x: spot.x, z: spot.z, phase: Math.random() * 6 });
    }
  }

  update(dt: number, minute: number, playerX: number, playerZ: number): void {
    for (const a of this.actors) {
      const { spot } = citizenSpot(a.c, minute);
      const dx = spot.x - a.x;
      const dz = spot.z - a.z;
      const dist = Math.hypot(dx, dz);
      const walking = dist > 0.4;
      if (walking) {
        const step = Math.min(dist, 2.2 * dt);
        a.x += (dx / dist) * step;
        a.z += (dz / dist) * step;
        a.phase += dt * 8;
      }
      a.mesh.group.position.set(a.x, 0, a.z);

      const toPlayer = Math.hypot(playerX - a.x, playerZ - a.z);
      if (toPlayer < 3) {
        a.mesh.group.rotation.y = Math.atan2(playerX - a.x, playerZ - a.z) + Math.PI;
      } else if (walking) {
        a.mesh.group.rotation.y = Math.atan2(dx, dz) + Math.PI;
      }

      const swing = walking ? Math.sin(a.phase) * 0.5 : 0;
      a.mesh.leftLeg.rotation.x = swing;
      a.mesh.rightLeg.rotation.x = -swing;
      a.mesh.leftArm.rotation.x = -swing * 0.7;
      a.mesh.rightArm.rotation.x = swing * 0.7;
    }
  }

  /** Nearest citizen within radius, for the talk prompt. */
  nearest(x: number, z: number, radius: number): { id: string; name: string } | null {
    let best: Actor | null = null;
    let bestD = radius;
    for (const a of this.actors) {
      const d = Math.hypot(a.x - x, a.z - z);
      if (d < bestD) { best = a; bestD = d; }
    }
    return best ? { id: best.c.id, name: best.c.name } : null;
  }

  nearestPos(x: number, z: number): [number, number] | null {
    let best: Actor | null = null;
    let bestD = Infinity;
    for (const a of this.actors) {
      const d = Math.hypot(a.x - x, a.z - z);
      if (d < bestD) { best = a; bestD = d; }
    }
    return best ? [best.x, best.z] : null;
  }
}
