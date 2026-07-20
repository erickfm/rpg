import { describe, expect, it } from 'vitest';
import {
  BUILDINGS, CITY_HALF, INTERACTABLES, PARKED, PLAYER_CAR, PLAYER_SPAWN, PROPS, WALK_EDGE,
  frontOf, onRoad, resolveCollision, roadAcross, staticColliders,
} from './city';

describe('city layout', () => {
  it('keeps every building off the roads and sidewalks, inside the city', () => {
    for (const b of BUILDINGS) {
      for (const [cx, cz] of [
        [b.x - b.w / 2, b.z - b.d / 2],
        [b.x + b.w / 2, b.z - b.d / 2],
        [b.x - b.w / 2, b.z + b.d / 2],
        [b.x + b.w / 2, b.z + b.d / 2],
      ]) {
        expect(roadAcross(cx, cz), `${b.id} crowds a road`).toBeGreaterThanOrEqual(WALK_EDGE);
        expect(Math.abs(cx)).toBeLessThanOrEqual(CITY_HALF);
        expect(Math.abs(cz)).toBeLessThanOrEqual(CITY_HALF);
      }
    }
  });

  it('no two buildings overlap', () => {
    for (let i = 0; i < BUILDINGS.length; i++) {
      for (let j = i + 1; j < BUILDINGS.length; j++) {
        const a = BUILDINGS[i];
        const b = BUILDINGS[j];
        const overlap =
          Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.z - b.z) < (a.d + b.d) / 2;
        expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });

  it('every interactable is standable (not inside a collider)', () => {
    const colliders = staticColliders();
    for (const it of INTERACTABLES) {
      const [x, z] = resolveCollision(it.x, it.z, 0.35, colliders);
      const moved = Math.hypot(x - it.x, z - it.z);
      expect(moved, `${it.id} spot is blocked`).toBeLessThan(0.01);
    }
  });

  it('doors face outward from their buildings', () => {
    for (const b of BUILDINGS.filter(b => b.name)) {
      const f = frontOf(b);
      const inside =
        Math.abs(f.x + f.nx * 1.6 - b.x) < b.w / 2 && Math.abs(f.z + f.nz * 1.6 - b.z) < b.d / 2;
      expect(inside, `${b.id} door is inside the building`).toBe(false);
    }
  });

  it('parked cars sit on asphalt; the player car too', () => {
    for (const c of [...PARKED.slice(0, 5), PLAYER_CAR]) {
      // street-parked cars hug a road lane (dealership lot cars excluded)
      expect(onRoad(c.x, c.z), `car at ${c.x},${c.z} is off the road`).toBe(true);
    }
  });

  it('the player spawn is clear', () => {
    const colliders = staticColliders();
    const [x, z] = resolveCollision(PLAYER_SPAWN.x, PLAYER_SPAWN.z, 0.35, colliders);
    expect(Math.hypot(x - PLAYER_SPAWN.x, z - PLAYER_SPAWN.z)).toBeLessThan(0.01);
  });

  it('props stay off the asphalt', () => {
    for (const p of PROPS) {
      expect(onRoad(p.x, p.z), `${p.kind} at ${p.x},${p.z} is on the road`).toBe(false);
    }
  });

  it('collision slides around boxes and clamps to bounds', () => {
    const colliders = staticColliders();
    const home = BUILDINGS.find(b => b.id === 'home')!;
    const [x] = resolveCollision(home.x + 1, home.z, 0.35, colliders);
    expect(Math.abs(x - home.x)).toBeGreaterThan(1); // pushed out
    expect(resolveCollision(999, -999, 0.35, [])).toEqual([CITY_HALF - 0.35, -(CITY_HALF - 0.35)]);
  });
});
