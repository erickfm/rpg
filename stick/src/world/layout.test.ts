import { describe, expect, it } from 'vitest';
import {
  CITY, CITY_HALF, NPC_POSTS, ROADS, SPAWN, YELLOW_CAR,
  buildingById, nearestDoor, onRoad, resolveCollision,
} from './layout';

describe('the 2D World layout', () => {
  it('has all twelve locations of the original', () => {
    const ids = CITY.map(b => b.id).sort();
    expect(ids).toEqual([
      'apartment', 'bank', 'busdepot', 'casino', 'castle', 'fineline',
      'mcsticks', 'newlines', 'pawn', 'stickys', 'store', 'uofs',
    ]);
  });

  it('no building overlaps another', () => {
    for (let i = 0; i < CITY.length; i++) {
      for (let j = i + 1; j < CITY.length; j++) {
        const a = CITY[i];
        const b = CITY[j];
        const overlapX = Math.abs(a.x - b.x) < (a.w + b.w) / 2;
        const overlapZ = Math.abs(a.z - b.z) < (a.d + b.d) / 2;
        expect(overlapX && overlapZ, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });

  it('no building corner lands on a road, and all fit on the island', () => {
    for (const b of CITY) {
      for (const [cx, cz] of [
        [b.x - b.w / 2, b.z - b.d / 2],
        [b.x + b.w / 2, b.z - b.d / 2],
        [b.x - b.w / 2, b.z + b.d / 2],
        [b.x + b.w / 2, b.z + b.d / 2],
      ]) {
        expect(onRoad(cx, cz), `${b.id} touches a road`).toBe(false);
      }
      expect(Math.abs(b.x) + b.w / 2).toBeLessThanOrEqual(CITY_HALF);
      expect(Math.abs(b.z) + b.d / 2).toBeLessThanOrEqual(CITY_HALF);
    }
  });

  it('doors are outside their buildings and reachable', () => {
    for (const b of CITY) {
      const inside = Math.abs(b.doorX - b.x) < b.w / 2 && Math.abs(b.doorZ - b.z) < b.d / 2;
      expect(inside, `${b.id} door is inside`).toBe(false);
      expect(nearestDoor(b.doorX, b.doorZ)?.id).toBe(b.id);
    }
  });

  it('the roads form the original offset cross', () => {
    expect(ROADS).toHaveLength(3);
    const arms = ROADS.filter(r => r.axis === 'x');
    expect(arms).toHaveLength(2);
    expect(arms[0].at).not.toBe(arms[1].at); // offset, not a plain cross
    expect(onRoad(0, 50)).toBe(true);
    expect(onRoad(-50, -30)).toBe(true);
    expect(onRoad(50, 10)).toBe(true);
    expect(onRoad(-50, 10)).toBe(false); // west arm doesn't extend east
  });

  it('spawn, the yellow car, and NPC posts sit on open ground', () => {
    const spots = [
      [SPAWN.x, SPAWN.z],
      [YELLOW_CAR.x, YELLOW_CAR.z],
      ...NPC_POSTS.flatMap(n => [
        [n.ax, n.az],
        [n.bx, n.bz],
      ]),
    ];
    for (const [x, z] of spots) {
      expect(resolveCollision(x, z, 0.6)).toEqual([x, z]);
    }
  });

  it('collision pushes out of footprints and clamps to the island', () => {
    const home = buildingById('apartment');
    const [x, z] = resolveCollision(home.x + 1, home.z, 0.6);
    const eps = 1e-9;
    const inside =
      Math.abs(x - home.x) < home.w / 2 + 0.6 - eps &&
      Math.abs(z - home.z) < home.d / 2 + 0.6 - eps;
    expect(inside).toBe(false);
    expect(resolveCollision(1000, -1000, 0.6)).toEqual([CITY_HALF - 0.6, -(CITY_HALF - 0.6)]);
  });
});
