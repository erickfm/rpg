import { describe, it, expect } from 'vitest';
import { distanceTo, arrived, compass8, clampToBox } from './nav';

describe('distance + arrival', () => {
  it('measures straight-line distance', () => {
    expect(distanceTo(0, 0, 3, 4)).toBe(5);
  });

  it('arrives inside the radius, not outside', () => {
    expect(arrived(0, 0, 3, 4)).toBe(true); // 5 <= 5
    expect(arrived(0, 0, 3, 4, 4)).toBe(false);
    expect(arrived(10, 10, 10, 12)).toBe(true);
  });
});

describe('compass8', () => {
  it('names the four cardinals (north is −z)', () => {
    expect(compass8(0, -10)).toBe('N');
    expect(compass8(10, 0)).toBe('E');
    expect(compass8(0, 10)).toBe('S');
    expect(compass8(-10, 0)).toBe('W');
  });

  it('names the diagonals', () => {
    expect(compass8(10, -10)).toBe('NE');
    expect(compass8(10, 10)).toBe('SE');
    expect(compass8(-10, 10)).toBe('SW');
    expect(compass8(-10, -10)).toBe('NW');
  });
});

describe('clampToBox', () => {
  it('leaves an interior point where it is', () => {
    expect(clampToBox(50, 50, 60, 55, 0, 100)).toEqual([60, 55]);
  });

  it('pins a point past the right edge onto the border', () => {
    const [x, y] = clampToBox(50, 50, 200, 50, 0, 100);
    expect(x).toBe(100);
    expect(y).toBe(50);
  });

  it('pins a diagonal overshoot onto the nearest crossed edge', () => {
    const [x, y] = clampToBox(50, 50, 130, 90, 0, 100);
    // ray hits the right edge (x=100) first: t = 50/80 = 0.625 -> y = 50 + 40*0.625 = 75
    expect(x).toBeCloseTo(100);
    expect(y).toBeCloseTo(75);
  });
});
